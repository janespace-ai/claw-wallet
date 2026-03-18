import { connect, type Socket } from "node:net";
import {
  createRequest,
  type SignerMethod,
  type JsonRpcResponse,
  type JsonRpcSuccessResponse,
  type JsonRpcErrorResponse,
} from "./ipc-protocol.js";

const DEFAULT_TIMEOUT_MS = 120_000;

export class SignerClient {
  private socketPath: string;
  private timeoutMs: number;

  constructor(socketPath: string, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.socketPath = socketPath;
    this.timeoutMs = timeoutMs;
  }

  async call(method: SignerMethod, params?: Record<string, unknown>): Promise<unknown> {
    const req = createRequest(method, params);
    const res = await this.sendRaw(JSON.stringify(req));

    const parsed: JsonRpcResponse = JSON.parse(res);
    if ("error" in parsed && parsed.error) {
      const err = new SignerRpcError(parsed.error.message, parsed.error.code, parsed.error.data);
      throw err;
    }
    return (parsed as JsonRpcSuccessResponse).result;
  }

  private sendRaw(data: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket: Socket = connect({ path: this.socketPath });
      let buffer = "";
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          socket.destroy();
          reject(new Error("Signer IPC timeout"));
        }
      }, this.timeoutMs);

      socket.on("connect", () => {
        socket.write(data + "\n");
      });

      socket.on("data", (chunk) => {
        buffer += chunk.toString();
        const nl = buffer.indexOf("\n");
        if (nl !== -1) {
          const line = buffer.slice(0, nl);
          settled = true;
          clearTimeout(timer);
          socket.destroy();
          resolve(line);
        }
      });

      socket.on("error", (err) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          if ((err as NodeJS.ErrnoException).code === "ENOENT" || (err as NodeJS.ErrnoException).code === "ECONNREFUSED") {
            reject(new Error("Signer not running. Start with `claw-signer start`"));
          } else {
            reject(err);
          }
        }
      });
    });
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}

export class SignerRpcError extends Error {
  constructor(
    message: string,
    public code: number,
    public data?: unknown
  ) {
    super(message);
    this.name = "SignerRpcError";
  }
}
