import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from "node:crypto";
import { readFile, mkdir, access } from "node:fs/promises";
import { dirname } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import { type Hex, type Address, type TransactionSerializable, type SignableMessage } from "viem";
import type { KeystoreV3 } from "./types.js";
import { validateKeystoreSchema, secureWriteFile } from "./validation.js";

const KDF_N_MAX = 2 ** 20;

const SCRYPT_N = 131072;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const DKLEN = 32;

function generateUUID(): string {
  return randomBytes(16).toString("hex").replace(
    /(.{8})(.{4})(.{4})(.{4})(.{12})/,
    "$1-$2-$3-$4-$5"
  );
}

export function generateWallet(): { privateKey: Hex; address: Address } {
  const keyBytes = randomBytes(32);
  const privateKey = `0x${keyBytes.toString("hex")}` as Hex;
  const account = privateKeyToAccount(privateKey);
  keyBytes.fill(0);
  return { privateKey, address: account.address };
}

export function encryptKey(privateKey: Hex, password: string): KeystoreV3 {
  const account = privateKeyToAccount(privateKey);
  const keyBuffer = Buffer.from(privateKey.slice(2), "hex");

  const salt = randomBytes(32);
  const iv = randomBytes(16);

  const derivedKey = scryptSync(password, salt, DKLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * 1024 * 1024,
  });

  const cipher = createCipheriv("aes-256-gcm", derivedKey, iv);
  const ciphertext = Buffer.concat([cipher.update(keyBuffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  keyBuffer.fill(0);

  const mac = Buffer.concat([tag, derivedKey.subarray(16)]);

  const keystore: KeystoreV3 = {
    address: account.address,
    crypto: {
      cipher: "aes-256-gcm",
      cipherparams: { iv: iv.toString("hex") },
      ciphertext: ciphertext.toString("hex"),
      kdf: "scrypt",
      kdfparams: {
        dklen: DKLEN,
        n: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        salt: salt.toString("hex"),
      },
      mac: tag.toString("hex"),
    },
    id: generateUUID(),
    version: 3,
  };

  return keystore;
}

export function decryptKey(keystore: KeystoreV3, password: string): Hex {
  const { kdfparams } = keystore.crypto;
  if (kdfparams.n > KDF_N_MAX) {
    throw new Error("KDF parameter n exceeds maximum allowed (potential DoS)");
  }
  const salt = Buffer.from(kdfparams.salt, "hex");
  const iv = Buffer.from(keystore.crypto.cipherparams.iv, "hex");
  const ciphertext = Buffer.from(keystore.crypto.ciphertext, "hex");
  const storedTag = Buffer.from(keystore.crypto.mac, "hex");

  const derivedKey = scryptSync(password, salt, kdfparams.dklen, {
    N: kdfparams.n,
    r: kdfparams.r,
    p: kdfparams.p,
    maxmem: 256 * 1024 * 1024,
  });

  const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
  decipher.setAuthTag(storedTag);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Invalid password or corrupted keystore");
  }

  const privateKey = `0x${decrypted.toString("hex")}` as Hex;
  decrypted.fill(0);
  return privateKey;
}

export async function signTransaction(
  keystore: KeystoreV3,
  password: string,
  tx: TransactionSerializable
): Promise<Hex> {
  const privateKey = decryptKey(keystore, password);
  try {
    const account = privateKeyToAccount(privateKey);
    const serialized = await account.signTransaction(tx);
    return serialized;
  } finally {
    clearPrivateKey(privateKey);
  }
}

export async function signMessage(
  keystore: KeystoreV3,
  password: string,
  message: SignableMessage
): Promise<Hex> {
  const privateKey = decryptKey(keystore, password);
  try {
    const account = privateKeyToAccount(privateKey);
    return await account.signMessage({ message });
  } finally {
    clearPrivateKey(privateKey);
  }
}

function clearPrivateKey(key: Hex): void {
  const buf = Buffer.from(key.slice(2), "hex");
  buf.fill(0);
}

export function getAddress(keystore: KeystoreV3): Address {
  return keystore.address;
}

export async function saveKeystore(keystore: KeystoreV3, filePath: string): Promise<void> {
  await secureWriteFile(filePath, JSON.stringify(keystore, null, 2));
}

export async function loadKeystore(filePath: string): Promise<KeystoreV3> {
  const content = await readFile(filePath, "utf-8");
  const data: unknown = JSON.parse(content);
  validateKeystoreSchema(data);
  return data as KeystoreV3;
}

export async function keystoreExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
