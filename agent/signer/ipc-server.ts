import { createServer, type Server, type Socket } from "node:net";
import { unlinkSync } from "node:fs";
import {
  parseRequest,
  createError,
  RpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./ipc-protocol.js";

export type RequestHandler = (req: JsonRpcRequest) => Promise<JsonRpcResponse>;

export class IpcServer {
  private server: Server | null = null;
  private socketPath: string;
  private handler: RequestHandler;
  private connections: Set<Socket> = new Set();

  constructor(socketPath: string, handler: RequestHandler) {
    this.socketPath = socketPath;
    this.handler = handler;
  }

  async start(): Promise<void> {
    try { unlinkSync(this.socketPath); } catch {}

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.onConnection(socket));
      this.server.on("error", reject);
      this.server.listen(this.socketPath, () => {
        const { chmodSync } = require("node:fs");
        try { chmodSync(this.socketPath, 0o600); } catch {}
        resolve();
      });
    });
  }

  private onConnection(socket: Socket): void {
    this.connections.add(socket);
    let buffer = "";

    socket.on("data", async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const req = parseRequest(line);
          const res = await this.handler(req);
          socket.write(JSON.stringify(res) + "\n");
        } catch (err) {
          const errRes = createError(
            null,
            RpcErrorCode.PARSE_ERROR,
            err instanceof SyntaxError ? "Parse error" : (err as Error).message
          );
          socket.write(JSON.stringify(errRes) + "\n");
        }
      }
    });

    socket.on("close", () => this.connections.delete(socket));
    socket.on("error", () => this.connections.delete(socket));
  }

  async stop(): Promise<void> {
    for (const conn of this.connections) {
      conn.destroy();
    }
    this.connections.clear();

    return new Promise((resolve) => {
      if (!this.server) { resolve(); return; }
      this.server.close(() => {
        try { unlinkSync(this.socketPath); } catch {}
        this.server = null;
        resolve();
      });
    });
  }

  getSocketPath(): string {
    return this.socketPath;
  }
}
