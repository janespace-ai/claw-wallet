import { describe, it, expect } from "vitest";
import {
  createRequest,
  createSuccess,
  createError,
  parseRequest,
  RpcErrorCode,
} from "../../agent/signer/ipc-protocol.js";

describe("IPC protocol", () => {
  it("creates valid request", () => {
    const req = createRequest("get_address", undefined, 1);
    expect(req.jsonrpc).toBe("2.0");
    expect(req.method).toBe("get_address");
    expect(req.id).toBe(1);
  });

  it("creates success response", () => {
    const res = createSuccess(1, { address: "0x123" });
    expect(res.jsonrpc).toBe("2.0");
    expect(res.result).toEqual({ address: "0x123" });
    expect(res.id).toBe(1);
  });

  it("creates error response", () => {
    const res = createError(1, RpcErrorCode.METHOD_NOT_FOUND, "nope");
    expect(res.error.code).toBe(-32601);
    expect(res.error.message).toBe("nope");
  });

  it("parses valid request JSON", () => {
    const json = JSON.stringify({ jsonrpc: "2.0", method: "lock", id: 42 });
    const req = parseRequest(json);
    expect(req.method).toBe("lock");
    expect(req.id).toBe(42);
  });

  it("rejects invalid JSON-RPC", () => {
    expect(() => parseRequest('{"foo":"bar"}')).toThrow("Invalid JSON-RPC");
    expect(() => parseRequest("not json")).toThrow();
  });
});
