import { join } from "node:path";
import { readFile, writeFile, mkdir, access, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { safeStorage, systemPreferences } from "electron";
import { ethers } from "ethers";

/** @scure/* is ESM-only; dynamic import keeps CommonJS main compatible with Electron `require("electron")`. */
let scurePromise: Promise<{
  HDKey: typeof import("@scure/bip32").HDKey;
  generateMnemonic: typeof import("@scure/bip39").generateMnemonic;
  mnemonicToSeedSync: typeof import("@scure/bip39").mnemonicToSeedSync;
  validateMnemonic: typeof import("@scure/bip39").validateMnemonic;
  wordlist: typeof import("@scure/bip39/wordlists/english.js").wordlist;
}> | null = null;

function loadScure() {
  if (!scurePromise) {
    scurePromise = (async () => {
      const [{ HDKey }, bip39, { wordlist }] = await Promise.all([
        import("@scure/bip32"),
        import("@scure/bip39"),
        import("@scure/bip39/wordlists/english.js"),
      ]);
      return { HDKey, ...bip39, wordlist };
    })();
  }
  return scurePromise;
}

const BIP44_ETH_PATH = "m/44'/60'/0'/0/0";
const SCRYPT_R = 8;
const SCRYPT_P = 1;

/** Node default maxmem formula; explicit so scrypt never uses a too-small cap for chosen N. */
function scryptOpts(n: number): { N: number; r: number; p: number; maxmem: number } {
  return {
    N: n,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 32 * 1024 * 1024 + 128 * SCRYPT_R * n,
  };
}
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

export type BiometricType = "touchid" | "windows-hello" | "none";

export function getBiometricType(): BiometricType {
  if (process.platform === "darwin") return "touchid";
  if (process.platform === "win32") return "windows-hello";
  return "none";
}

function promptWindowsHello(reason: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { execFile } = require("node:child_process") as typeof import("node:child_process");
    const script = `
      Add-Type -AssemblyName Windows.Security
      $result = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]::RequestVerificationAsync("${reason.replace(/"/g, '`"')}").GetAwaiter().GetResult()
      if ($result -ne 'Verified') { exit 1 }
    `;
    execFile("powershell.exe", ["-NoProfile", "-Command", script], (err) => {
      if (err) return reject(new Error("Windows Hello verification failed"));
      resolve();
    });
  });
}

export interface KeyManagerOptions {
  /** scrypt N for new keystores (from config). E2E_LOW_SCRYPT=1 forces 2^14 for speed. */
  scryptN?: number;
}

export class KeyManager {
  private dataDir: string;
  private storePath: string;
  private readonly scryptN: number;
  private store: EncryptedStore | null = null;
  private decryptedMnemonic: string | null = null;
  private decryptedPrivateKey: string | null = null;
  private address: string | null = null;
  private biometricEnabled = false;

  constructor(dataDir: string, options?: KeyManagerOptions) {
    this.dataDir = dataDir;
    this.storePath = join(dataDir, "keystore.enc.json");
    /** Prefer 2^14 via config in Electron (OpenSSL MEMORY_LIMIT); E2E forces 2^14 for speed. */
    this.scryptN =
      process.env.E2E_LOW_SCRYPT === "1" ? 2 ** 14 : (options?.scryptN ?? 16384);
  }

  async initialize(): Promise<void> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      await access(this.storePath);
      const raw = await readFile(this.storePath, "utf-8");
      this.store = JSON.parse(raw);
      this.address = this.store!.address;
    } catch {
      this.store = null;
    }
    try {
      await access(join(this.dataDir, "bio-credential.enc"));
      this.biometricEnabled = true;
    } catch {
      this.biometricEnabled = false;
    }
  }

  hasWallet(): boolean {
    return this.store !== null;
  }

  isUnlocked(): boolean {
    return this.decryptedPrivateKey !== null;
  }

  getAddress(): string | null {
    return this.address;
  }

  getPrivateKey(): string | null {
    return this.decryptedPrivateKey;
  }

  /** In-memory mnemonic when unlocked — main process only, never expose to renderer. */
  getMnemonicIfUnlocked(): string | null {
    return this.decryptedMnemonic;
  }

  /**
   * Re-derive signing key for BIP-44 account index (m/44'/60'/0'/0/index).
   * Requires wallet unlocked with mnemonic in memory.
   */
  setActiveAccountIndex(accountIndex: number): void {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error("Account index must be 0-9");
    }
    if (!this.decryptedMnemonic) {
      throw new Error("Wallet locked");
    }
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(this.decryptedMnemonic, undefined, path);
    this.decryptedPrivateKey = wallet.privateKey;
    this.address = wallet.address;
  }

  getPrivateKeyForAccountIndex(accountIndex: number): string {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error("Account index must be 0-9");
    }
    if (!this.decryptedMnemonic) {
      throw new Error("Wallet locked");
    }
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(this.decryptedMnemonic, undefined, path);
    return wallet.privateKey;
  }

  /** Derived address for a sub-account without changing the active signing key (multi-account relay). */
  getAddressForAccountIndex(accountIndex: number): string | null {
    if (accountIndex < 0 || accountIndex > 9) {
      throw new Error("Account index must be 0-9");
    }
    if (!this.decryptedMnemonic) {
      return null;
    }
    const path = `m/44'/60'/0'/0/${accountIndex}`;
    const wallet = ethers.HDNodeWallet.fromPhrase(this.decryptedMnemonic, undefined, path);
    return wallet.address;
  }

  async createWallet(password: string): Promise<{ address: string; mnemonic: string }> {
    if (this.store) throw new Error("Wallet already exists");
    this.validatePassword(password);

    const { HDKey, generateMnemonic, mnemonicToSeedSync, wordlist } = await loadScure();
    const mnemonic = generateMnemonic(wordlist, 128);
    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    const privateKeyHex = `0x${Buffer.from(child.privateKey).toString("hex")}`;
    const wallet = new ethers.Wallet(privateKeyHex);
    const address = wallet.address;

    await this.encryptAndSave(mnemonic, password, address);

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = privateKeyHex;
    this.address = address;

    seed.fill(0);
    child.privateKey.fill(0);

    return { address, mnemonic };
  }

  async importWallet(mnemonic: string, password: string): Promise<{ address: string }> {
    if (this.store) throw new Error("Wallet already exists");
    this.validatePassword(password);

    const { HDKey, mnemonicToSeedSync, validateMnemonic, wordlist } = await loadScure();
    if (!validateMnemonic(mnemonic, wordlist)) {
      throw new Error("Invalid mnemonic phrase");
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    const privateKeyHex = `0x${Buffer.from(child.privateKey).toString("hex")}`;
    const wallet = new ethers.Wallet(privateKeyHex);
    const address = wallet.address;

    await this.encryptAndSave(mnemonic, password, address);

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = privateKeyHex;
    this.address = address;

    seed.fill(0);
    child.privateKey.fill(0);

    return { address };
  }

  async unlock(password: string): Promise<void> {
    if (!this.store) throw new Error("No wallet found");
    if (this.isUnlocked()) return;

    const { HDKey, mnemonicToSeedSync } = await loadScure();
    const mnemonic = await this.decryptStore(password);
    const seed = mnemonicToSeedSync(mnemonic);
    const hdKey = HDKey.fromMasterSeed(seed);
    const child = hdKey.derive(BIP44_ETH_PATH);

    if (!child.privateKey) throw new Error("Failed to derive private key");

    this.decryptedMnemonic = mnemonic;
    this.decryptedPrivateKey = `0x${Buffer.from(child.privateKey).toString("hex")}`;

    seed.fill(0);
    child.privateKey.fill(0);
  }

  async unlockBiometric(): Promise<void> {
    const bioType = getBiometricType();
    if (bioType === "none") {
      throw new Error("Biometric not available on this platform");
    }

    const credPath = join(this.dataDir, "bio-credential.enc");
    let raw: string;
    try {
      raw = await readFile(credPath, "utf-8");
    } catch {
      throw new Error("Biometric credential not found. Please enable biometric first.");
    }

    if (bioType === "touchid") {
      await systemPreferences.promptTouchID("unlock Claw Wallet");
    } else if (bioType === "windows-hello") {
      await promptWindowsHello("Unlock Claw Wallet");
    }

    const encrypted = Buffer.from(raw, "base64");
    const password = safeStorage.decryptString(encrypted);
    await this.unlock(password);
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
    return getBiometricType() !== "none"
      && safeStorage.isEncryptionAvailable()
      && this.biometricEnabled;
  }

  getBiometricLabel(): string | null {
    const t = getBiometricType();
    if (t === "touchid") return "Touch ID";
    if (t === "windows-hello") return "Windows Hello";
    return null;
  }

  canEnableBiometric(): boolean {
    return getBiometricType() !== "none" && safeStorage.isEncryptionAvailable();
  }

  async setBiometricEnabled(enabled: boolean, password?: string): Promise<void> {
    const credPath = join(this.dataDir, "bio-credential.enc");
    if (enabled) {
      if (!password) throw new Error("Password is required to enable biometric");
      const encrypted = safeStorage.encryptString(password);
      await writeFile(credPath, encrypted.toString("base64"), { mode: 0o600 });
      this.biometricEnabled = true;
    } else {
      await this.clearBiometricCredential();
    }
  }

  private async clearBiometricCredential(): Promise<void> {
    const credPath = join(this.dataDir, "bio-credential.enc");
    try {
      await unlink(credPath);
    } catch {
      // file doesn't exist, that's fine
    }
    this.biometricEnabled = false;
  }

  private validatePassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
  }

  private async encryptAndSave(mnemonic: string, password: string, address: string): Promise<void> {
    const { scryptSync, createCipheriv } = await import("node:crypto");

    const salt = randomBytes(SALT_SIZE);
    const key = scryptSync(password, salt, 32, scryptOpts(this.scryptN));
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
      scrypt: { n: this.scryptN, r: SCRYPT_R, p: SCRYPT_P },
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

    const n = this.store.scrypt.n;
    const r = this.store.scrypt.r;
    const p = this.store.scrypt.p;
    const key = scryptSync(password, salt, 32, {
      N: n,
      r,
      p,
      maxmem: 32 * 1024 * 1024 + 128 * r * n,
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
