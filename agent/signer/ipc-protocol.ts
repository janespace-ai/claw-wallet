import type { Hex, Address, TransactionSerializable } from "viem";

export const JSONRPC_VERSION = "2.0" as const;

export type SignerMethod =
  | "get_address"
  | "create_wallet"
  | "import_wallet"
  | "sign_transaction"
  | "sign_message"
  | "unlock"
  | "lock"
  | "get_allowance"
  | "set_allowance"
  | "wallet_pair"
  | "wallet_repair";

export interface JsonRpcRequest {
  jsonrpc: typeof JSONRPC_VERSION;
  method: SignerMethod;
  params?: Record<string, unknown>;
  id: number | string;
}

export interface JsonRpcSuccessResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  result: unknown;
  id: number | string;
}

export interface JsonRpcErrorResponse {
  jsonrpc: typeof JSONRPC_VERSION;
  error: { code: number; message: string; data?: unknown };
  id: number | string | null;
}

export type JsonRpcResponse = JsonRpcSuccessResponse | JsonRpcErrorResponse;

export const RpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SIGNER_LOCKED: -32000,
  USER_REJECTED: -32001,
  TIMEOUT: -32002,
  WALLET_EXISTS: -32003,
  NO_WALLET: -32004,
} as const;

export function createRequest(method: SignerMethod, params?: Record<string, unknown>, id?: number | string): JsonRpcRequest {
  return { jsonrpc: JSONRPC_VERSION, method, params, id: id ?? Date.now() };
}

export function createSuccess(id: number | string, result: unknown): JsonRpcSuccessResponse {
  return { jsonrpc: JSONRPC_VERSION, result, id };
}

export function createError(id: number | string | null, code: number, message: string, data?: unknown): JsonRpcErrorResponse {
  return { jsonrpc: JSONRPC_VERSION, error: { code, message, data }, id };
}

export function parseRequest(raw: string): JsonRpcRequest {
  const obj = JSON.parse(raw);
  if (obj.jsonrpc !== JSONRPC_VERSION || typeof obj.method !== "string") {
    throw new Error("Invalid JSON-RPC request");
  }
  return obj as JsonRpcRequest;
}
