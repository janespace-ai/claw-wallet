import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { getAddress, isAddress } from "viem";
import type { Address } from "viem";
import type { KeystoreV3 } from "./types.js";
import type { SupportedChain } from "./types.js";

const SUPPORTED_CHAINS: SupportedChain[] = ["base", "ethereum"];
const MAX_CONTACT_NAME_LEN = 100;
const MAX_TOKEN_SYMBOL_LEN = 20;
const KDF_N_MAX = 2 ** 20;
const KDF_R_MAX = 16;
const KDF_DKLEN = 32;
const PATH_TRAVERSAL_PATTERN = /\.\.|[/\\]/;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Validates and returns checksummed address. Throws ValidationError on invalid input.
 */
export function validateAddress(input: unknown): Address {
  if (typeof input !== "string" || !input.startsWith("0x")) {
    throw new ValidationError("Address must be a hex string starting with 0x");
  }
  const trimmed = input.trim();
  if (trimmed.length !== 42) {
    throw new ValidationError("Address must be 40 hex characters (42 with 0x)");
  }
  const hexPart = trimmed.slice(2);
  if (!/^[0-9a-fA-F]+$/.test(hexPart)) {
    throw new ValidationError("Address contains non-hex characters");
  }
  if (!isAddress(trimmed, { strict: false })) {
    throw new ValidationError("Invalid address format");
  }
  return getAddress(trimmed) as Address;
}

/**
 * Validates amount string for transfers. Throws ValidationError on invalid input.
 */
export function validateAmount(input: unknown): string {
  if (input === undefined || input === null) {
    throw new ValidationError("Amount is required");
  }
  const s = String(input).trim();
  if (s === "") {
    throw new ValidationError("Amount cannot be empty");
  }
  const num = Number(s);
  if (Number.isNaN(num)) {
    throw new ValidationError("Invalid amount: not a number");
  }
  if (num <= 0) {
    throw new ValidationError("Amount must be positive");
  }
  if (!Number.isFinite(num)) {
    throw new ValidationError("Invalid amount: Infinity or too large");
  }
  return s;
}

/**
 * Validates chain name against whitelist.
 */
export function validateChain(input: unknown): SupportedChain {
  if (typeof input !== "string") {
    throw new ValidationError("Chain must be a string");
  }
  const chain = input.toLowerCase() as SupportedChain;
  if (!SUPPORTED_CHAINS.includes(chain)) {
    throw new ValidationError(`Unsupported chain. Must be one of: ${SUPPORTED_CHAINS.join(", ")}`);
  }
  return chain;
}

/**
 * Validates Keystore V3 structure and KDF parameters to prevent DoS.
 */
export function validateKeystoreSchema(data: unknown): asserts data is KeystoreV3 {
  if (data === null || typeof data !== "object") {
    throw new ValidationError("Keystore must be an object");
  }
  const ks = data as Record<string, unknown>;

  if (ks.version !== 3) {
    throw new ValidationError("Keystore version must be 3");
  }
  if (!ks.crypto || typeof ks.crypto !== "object") {
    throw new ValidationError("Keystore must have crypto object");
  }

  const crypto = ks.crypto as Record<string, unknown>;
  const required = ["cipher", "cipherparams", "ciphertext", "kdf", "kdfparams", "mac"];
  for (const key of required) {
    if (!(key in crypto)) {
      throw new ValidationError(`Keystore crypto missing field: ${key}`);
    }
  }

  const kdfparams = crypto.kdfparams as Record<string, unknown>;
  if (typeof kdfparams.n !== "number" || kdfparams.n > KDF_N_MAX || kdfparams.n < 2) {
    throw new ValidationError(`KDF parameter n must be between 2 and ${KDF_N_MAX}`);
  }
  if (typeof kdfparams.r !== "number" || kdfparams.r > KDF_R_MAX || kdfparams.r < 1) {
    throw new ValidationError(`KDF parameter r must be between 1 and ${KDF_R_MAX}`);
  }
  if (typeof kdfparams.p !== "number" || kdfparams.p < 1 || kdfparams.p > 8) {
    throw new ValidationError("KDF parameter p must be between 1 and 8");
  }
  if (typeof kdfparams.dklen !== "number" || kdfparams.dklen !== KDF_DKLEN) {
    throw new ValidationError(`KDF parameter dklen must be ${KDF_DKLEN}`);
  }
  if (typeof kdfparams.salt !== "string" || kdfparams.salt.length === 0) {
    throw new ValidationError("KDF parameter salt must be a non-empty string");
  }
}

/**
 * Validates contact name: non-empty, length limit, no path traversal characters.
 */
export function validateContactName(input: unknown): string {
  if (input === undefined || input === null) {
    throw new ValidationError("Contact name is required");
  }
  const s = String(input).trim();
  if (s.length === 0) {
    throw new ValidationError("Contact name cannot be empty");
  }
  if (s.length > MAX_CONTACT_NAME_LEN) {
    throw new ValidationError(`Contact name must be at most ${MAX_CONTACT_NAME_LEN} characters`);
  }
  if (PATH_TRAVERSAL_PATTERN.test(s)) {
    throw new ValidationError("Contact name cannot contain path separators or ..");
  }
  return s;
}

/**
 * Validates token symbol or address: length limit, no dangerous characters.
 */
export function validateTokenSymbol(input: unknown): string {
  if (input === undefined || input === null) {
    throw new ValidationError("Token is required");
  }
  const s = String(input).trim();
  if (s.length === 0) {
    throw new ValidationError("Token cannot be empty");
  }
  if (s.length > MAX_TOKEN_SYMBOL_LEN && !s.startsWith("0x")) {
    throw new ValidationError(`Token symbol must be at most ${MAX_TOKEN_SYMBOL_LEN} characters`);
  }
  if (s.startsWith("0x") && s.length === 42) {
    validateAddress(s);
    return s;
  }
  if (/[<>"'`\/\\]/.test(s)) {
    throw new ValidationError("Token symbol contains invalid characters");
  }
  return s;
}

/**
 * Writes file atomically with 0600 permissions (where supported).
 */
export async function secureWriteFile(filePath: string, data: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const dir = dirname(filePath);
  const name = `.${randomBytes(8).toString("hex")}.tmp`;
  const tempPath = join(dir, name);
  await writeFile(tempPath, data, "utf-8");
  const { rename, chmod } = await import("node:fs/promises");
  try {
    await chmod(tempPath, 0o600);
  } catch {
    // Windows may not support chmod
  }
  await rename(tempPath, filePath);
}

/**
 * Normalizes path and prevents directory traversal outside basePath.
 */
export function sanitizePath(basePath: string, userPath: string): string {
  const resolved = resolve(basePath, userPath);
  const base = resolve(basePath);
  if (!resolved.startsWith(base)) {
    throw new ValidationError("Path resolves outside allowed directory");
  }
  return resolved;
}
