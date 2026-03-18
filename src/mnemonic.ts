import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey } from "@scure/bip32";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex, Address } from "viem";
import { secureWriteFile } from "./validation.js";

const BIP44_ETH_PATH = "m/44'/60'/0'/0/0";
const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DKLEN = 32;

export interface MnemonicWallet {
  mnemonic: string;
  privateKey: Hex;
  address: Address;
}

export function generateWalletWithMnemonic(): MnemonicWallet {
  const mnemonic = generateMnemonic(wordlist, 128);
  const { privateKey, address } = deriveFromMnemonic(mnemonic);
  return { mnemonic, privateKey, address };
}

export function deriveFromMnemonic(mnemonic: string): { privateKey: Hex; address: Address } {
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error("Invalid mnemonic phrase");
  }
  const seed = mnemonicToSeedSync(mnemonic);
  const hdKey = HDKey.fromMasterSeed(seed);
  const child = hdKey.derive(BIP44_ETH_PATH);
  if (!child.privateKey) throw new Error("Failed to derive private key");

  const privateKey = `0x${Buffer.from(child.privateKey).toString("hex")}` as Hex;
  const account = privateKeyToAccount(privateKey);

  seed.fill(0);
  child.privateKey.fill(0);

  return { privateKey, address: account.address };
}

export function encryptMnemonic(mnemonic: string, password: string): Buffer {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const derivedKey = scryptSync(password, salt, DKLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });

  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const plaintext = Buffer.from(mnemonic, "utf-8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  plaintext.fill(0);

  // Format: salt(32) + iv(16) + tag(16) + ciphertext
  return Buffer.concat([salt, iv, tag, ciphertext]);
}

export function decryptMnemonic(encrypted: Buffer, password: string): string {
  const salt = encrypted.subarray(0, 32);
  const iv = encrypted.subarray(32, 48);
  const tag = encrypted.subarray(48, 64);
  const ciphertext = encrypted.subarray(64);

  const derivedKey = scryptSync(password, salt, DKLEN, {
    N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });

  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(tag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Invalid password or corrupted mnemonic");
  }

  const mnemonic = decrypted.toString("utf-8");
  decrypted.fill(0);
  return mnemonic;
}

export async function saveMnemonic(encrypted: Buffer, filePath: string): Promise<void> {
  await secureWriteFile(filePath, encrypted.toString("base64"));
}

export async function loadMnemonic(filePath: string): Promise<Buffer> {
  const content = await readFile(filePath, "utf-8");
  return Buffer.from(content.trim(), "base64");
}

export async function mnemonicExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
