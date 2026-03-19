import { join } from "node:path";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { HDKey } from "@scure/bip32";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

const BIP44_ETH_PATH = "m/44'/60'/0'/0/0";
const SCRYPT_N = 2 ** 18;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_SIZE = 32;
const IV_SIZE = 12;

interface EncryptedStore {
  version: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  address: string;
  scrypt: { n: number; r: number; p: number };
}

export class KeyManager {
  private dataDir: string;
  private storePath: string;
  private store: EncryptedStore | null = null;
  private decryptedMnemonic: string | null = null;
  private decryptedPrivateKey: Hex | null = null;
  private address: Address | null = null;
  private biometricEnabled = false;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.storePath = join(dataDir, "keystore.enc.json");
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      await access(this.storePath);
      const raw = await readFile(this.storePath, "utf-8");
      this.store = JSON.parse(raw);
      this.address = this.store!.address as Address;
    } catch {
      this.store = null;
    }
  }

  hasWallet(): boolean {
    return this.store !== null;
  }

  isUnlocked(): boolean {
    return this.decryptedPrivateKey !== null;
  }

  getAddress(): Address | null {
    return this.address;
  }

  getPrivateKey(): Hex | null {
    return this.decryptedPrivateKey;
  }

  async createWallet(password: string): Promise<{ address: Address; mnemonic: string }> {
    if (this.store) throw new Error("Wallet already exists");
    this.validatePassword(password);

    const mnemonic = generateMnemonic(wordlist, 128);
    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    const privateKeyHex = `0x${Buffer.from(child.privateKey).toString("hex")}` as Hex;
    const account = privateKeyToAccount(privateKeyHex);

    await this.encryptAndSave(mnemonic, password, account.address);

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = privateKeyHex;
    this.address = account.address;

    seed.fill(0);
    child.privateKey.fill(0);

    return { address: account.address, mnemonic };
  }

  async importWallet(mnemonic: string, password: string): Promise<{ address: Address }> {
    if (this.store) throw new Error("Wallet already exists");
    this.validatePassword(password);

    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error("Invalid mnemonic phrase");
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    const privateKeyHex = `0x${Buffer.from(child.privateKey).toString("hex")}` as Hex;
    const account = privateKeyToAccount(privateKeyHex);

    await this.encryptAndSave(mnemonic, password, account.address);

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = privateKeyHex;
    this.address = account.address;

    seed.fill(0);
    child.privateKey.fill(0);

    return { address: account.address };
  }

  async unlock(password: string): Promise<void> {
    if (!this.store) throw new Error("No wallet found");
    if (this.isUnlocked()) return;

    const mnemonic = await this.decryptStore(password);
    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = `0x${Buffer.from(child.privateKey).toString("hex")}` as Hex;

    seed.fill(0);
    child.privateKey.fill(0);
  }

  async unlockBiometric(): Promise<void> {
    throw new Error("Biometric unlock not implemented for this platform");
  }

  lock(): void {
    if (this.decryptedMnemonic) {
      this.decryptedMnemonic = null;
    }
    this.decryptedPrivateKey = null;
  }

  async exportMnemonic(password: string): Promise<{ mnemonic: string }> {
    if (!this.store) throw new Error("No wallet found");
    const mnemonic = await this.decryptStore(password);
    return { mnemonic };
  }

  isBiometricAvailable(): boolean {
    return false;
  }

  async setBiometricEnabled(enabled: boolean): Promise<void> {
    this.biometricEnabled = enabled;
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
  }

  private async encryptAndSave(mnemonic: string, password: string, address: Address): Promise<void> {
    const { scryptSync, createCipheriv } = await import("node:crypto");

    const salt = randomBytes(SALT_SIZE);
    const key = scryptSync(password, salt, 32, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    const iv = randomBytes(IV_SIZE);

    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(mnemonic, "utf-8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    this.store = {
      version: 1,
      salt: salt.toString("hex"),
      iv: iv.toString("hex"),
      ciphertext: Buffer.concat([encrypted, authTag]).toString("hex"),
      address,
      scrypt: { n: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
    };

    await writeFile(this.storePath, JSON.stringify(this.store, null, 2), { mode: 0o600 });
  }

  private async decryptStore(password: string): Promise<string> {
    if (!this.store) throw new Error("No wallet found");

    const { scryptSync, createDecipheriv } = await import("node:crypto");

    const salt = Buffer.from(this.store.salt, "hex");
    const iv = Buffer.from(this.store.iv, "hex");
    const combined = Buffer.from(this.store.ciphertext, "hex");

    const ciphertext = combined.subarray(0, combined.length - 16);
    const authTag = combined.subarray(combined.length - 16);

    const key = scryptSync(password, salt, 32, {
      N: this.store.scrypt.n,
      r: this.store.scrypt.r,
      p: this.store.scrypt.p,
    });

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString("utf-8");
    } catch {
      throw new Error("Invalid password");
    }
  }
}
