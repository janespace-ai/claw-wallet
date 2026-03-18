import { join } from "node:path";
import { homedir } from "node:os";
import { scryptSync, createDecipheriv } from "node:crypto";
import type { Hex, Address, TransactionSerializable } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { IpcServer } from "./ipc-server.js";
import { SessionManager } from "./session.js";
import { AllowanceManager, defaultAllowancePolicy } from "./allowance.js";
import { AuditLog, type AuditEntry } from "./audit-log.js";
import type { AuthProvider, SigningContext } from "./auth-provider.js";
import {
  createSuccess,
  createError,
  RpcErrorCode,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "./ipc-protocol.js";
import {
  generateWallet,
  encryptKey,
  decryptKey,
  loadKeystore,
  saveKeystore,
  keystoreExists,
  getAddress as getKeystoreAddress,
} from "../keystore.js";
import type { KeystoreV3 } from "../types.js";
import { validateKeystoreSchema } from "../validation.js";

export interface SignerDaemonOptions {
  dataDir?: string;
  socketPath?: string;
  authProvider: AuthProvider;
  sessionTtlMs?: number;
}

export class SignerDaemon {
  private server: IpcServer;
  private session: SessionManager;
  private allowance: AllowanceManager;
  private auditLog: AuditLog;
  private authProvider: AuthProvider;
  private dataDir: string;
  private keystore: KeystoreV3 | null = null;

  constructor(options: SignerDaemonOptions) {
    this.dataDir = options.dataDir ?? join(homedir(), ".openclaw", "wallet");
    const socketPath = options.socketPath ?? this.defaultSocketPath();
    this.authProvider = options.authProvider;
    this.session = new SessionManager(options.sessionTtlMs);
    this.allowance = new AllowanceManager(join(this.dataDir, "allowance.json"));
    this.auditLog = new AuditLog(join(this.dataDir, "audit-log.json"));
    this.server = new IpcServer(socketPath, (req) => this.handleRequest(req));
  }

  private defaultSocketPath(): string {
    return join("/tmp", `claw-signer-${process.getuid?.() ?? 0}.sock`);
  }

  async start(): Promise<void> {
    const { mkdir } = await import("node:fs/promises");
    await mkdir(this.dataDir, { recursive: true });
    await this.allowance.load();
    await this.auditLog.load();

    const ksPath = join(this.dataDir, "keystore.json");
    if (await keystoreExists(ksPath)) {
      this.keystore = await loadKeystore(ksPath);
    }

    await this.server.start();

    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
  }

  async shutdown(): Promise<void> {
    this.session.lock();
    await this.allowance.save();
    await this.auditLog.save();
    await this.server.stop();
  }

  getSocketPath(): string {
    return this.server.getSocketPath();
  }

  private async handleRequest(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    try {
      switch (req.method) {
        case "get_address":
          return this.handleGetAddress(req);
        case "create_wallet":
          return await this.handleCreateWallet(req);
        case "import_wallet":
          return await this.handleImportWallet(req);
        case "sign_transaction":
          return await this.handleSignTransaction(req);
        case "sign_message":
          return await this.handleSignMessage(req);
        case "unlock":
          return await this.handleUnlock(req);
        case "lock":
          return this.handleLock(req);
        case "get_allowance":
          return this.handleGetAllowance(req);
        case "set_allowance":
          return await this.handleSetAllowance(req);
        default:
          return createError(req.id, RpcErrorCode.METHOD_NOT_FOUND, `Unknown method: ${req.method}`);
      }
    } catch (err) {
      return createError(req.id, RpcErrorCode.INTERNAL_ERROR, (err as Error).message);
    }
  }

  private handleGetAddress(req: JsonRpcRequest): JsonRpcResponse {
    if (!this.keystore) {
      return createError(req.id, RpcErrorCode.NO_WALLET, "No wallet configured");
    }
    return createSuccess(req.id, { address: getKeystoreAddress(this.keystore) });
  }

  private async handleCreateWallet(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const ksPath = join(this.dataDir, "keystore.json");
    if (await keystoreExists(ksPath)) {
      return createError(req.id, RpcErrorCode.WALLET_EXISTS, "Wallet already exists");
    }

    const ctx: SigningContext = { operation: "create_wallet", level: 2 };
    const pin = await this.authProvider.requestPin(ctx);

    const { privateKey, address } = generateWallet();
    const keystore = encryptKey(privateKey, pin);
    const buf = Buffer.from(privateKey.slice(2), "hex");
    buf.fill(0);

    await saveKeystore(keystore, ksPath);
    this.keystore = keystore;

    this.authProvider.notify(`Wallet created: ${address}`);
    return createSuccess(req.id, { address });
  }

  private async handleImportWallet(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const ksPath = join(this.dataDir, "keystore.json");
    const keystoreFile = req.params?.keystoreFile as string | undefined;

    if (keystoreFile) {
      const ctx: SigningContext = { operation: "import_wallet", level: 2 };
      const oldPassword = await this.authProvider.requestSecretInput("Enter old keystore password");
      const newPin = await this.authProvider.requestPin(ctx);

      const existing = await loadKeystore(keystoreFile);
      const privateKey = decryptKey(existing, oldPassword);
      const newKeystore = encryptKey(privateKey, newPin);
      const buf = Buffer.from(privateKey.slice(2), "hex");
      buf.fill(0);

      await saveKeystore(newKeystore, ksPath);
      this.keystore = newKeystore;

      return createSuccess(req.id, { address: getKeystoreAddress(newKeystore) });
    }

    const privateKeyHex = await this.authProvider.requestSecretInput("Enter private key (0x...)");
    const ctx: SigningContext = { operation: "import_wallet", level: 2 };
    const pin = await this.authProvider.requestPin(ctx);

    try {
      privateKeyToAccount(privateKeyHex as Hex);
    } catch {
      return createError(req.id, RpcErrorCode.INVALID_PARAMS, "Invalid private key format");
    }

    const keystore = encryptKey(privateKeyHex as Hex, pin);
    await saveKeystore(keystore, ksPath);
    this.keystore = keystore;

    return createSuccess(req.id, { address: getKeystoreAddress(keystore) });
  }

  private async handleSignTransaction(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.keystore) {
      return createError(req.id, RpcErrorCode.NO_WALLET, "No wallet configured");
    }

    const p = req.params ?? {};
    const to = p.to as Address;
    const amountUsd = (p.amountUsd as number) ?? 0;
    const token = (p.token as string) ?? "ETH";
    const chain = (p.chain as string) ?? "base";

    const check = this.allowance.checkTransaction(amountUsd, token, to);

    if (check.level > 0) {
      const ctx: SigningContext = {
        operation: "send",
        to,
        amount: p.amount as string,
        token,
        chain: chain as any,
        level: check.level,
      };

      if (check.level === 1) {
        const confirmed = await this.authProvider.requestConfirm(ctx);
        if (!confirmed) {
          this.auditLog.add({ timestamp: Date.now(), recipient: to, amount: p.amount as string, token, chain: chain as any, authLevel: check.level, result: "rejected", operation: "sign_transaction" });
          return createError(req.id, RpcErrorCode.USER_REJECTED, "User rejected transaction");
        }
      } else {
        const pin = await this.authProvider.requestPin(ctx);
        if (!pin) {
          this.auditLog.add({ timestamp: Date.now(), recipient: to, amount: p.amount as string, token, chain: chain as any, authLevel: check.level, result: "rejected", operation: "sign_transaction" });
          return createError(req.id, RpcErrorCode.USER_REJECTED, "User rejected transaction");
        }
      }
    }

    const privateKey = await this.decryptWithSession();
    try {
      const account = privateKeyToAccount(privateKey);
      const tx: TransactionSerializable = {
        to: p.to as Address,
        value: p.value ? BigInt(p.value as string) : undefined,
        gas: p.gas ? BigInt(p.gas as string) : undefined,
        chainId: p.chainId ? Number(p.chainId) : undefined,
        data: p.data as `0x${string}` | undefined,
        type: "legacy" as const,
        gasPrice: p.gasPrice ? BigInt(p.gasPrice as string) : 1_000_000_000n,
      };
      const signedTx = await account.signTransaction(tx);

      this.allowance.recordSpending(amountUsd);
      const auditResult = check.level === 0 ? "auto-approved" : "user-confirmed";
      this.auditLog.add({
        timestamp: Date.now(), recipient: to, amount: p.amount as string,
        token, chain: chain as any, authLevel: check.level,
        result: auditResult as AuditEntry["result"], operation: "sign_transaction",
      });

      return createSuccess(req.id, { signedTx });
    } finally {
      const buf = Buffer.from(privateKey.slice(2), "hex");
      buf.fill(0);
    }
  }

  private async handleSignMessage(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.keystore) {
      return createError(req.id, RpcErrorCode.NO_WALLET, "No wallet configured");
    }

    const ctx: SigningContext = { operation: "sign_message", level: 1 };
    const confirmed = await this.authProvider.requestConfirm(ctx);
    if (!confirmed) {
      return createError(req.id, RpcErrorCode.USER_REJECTED, "User rejected message signing");
    }

    const privateKey = await this.decryptWithSession();
    try {
      const account = privateKeyToAccount(privateKey);
      const message = req.params?.message as string;
      const signature = await account.signMessage({ message });
      return createSuccess(req.id, { signature });
    } finally {
      const buf = Buffer.from(privateKey.slice(2), "hex");
      buf.fill(0);
    }
  }

  private async handleUnlock(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.keystore) {
      return createError(req.id, RpcErrorCode.NO_WALLET, "No wallet configured");
    }

    const ctx: SigningContext = { operation: "unlock", level: 2 };
    const pin = await this.authProvider.requestPin(ctx);

    const { kdfparams } = this.keystore.crypto;
    const salt = Buffer.from(kdfparams.salt, "hex");
    const derivedKey = scryptSync(pin, salt, kdfparams.dklen, {
      N: kdfparams.n, r: kdfparams.r, p: kdfparams.p,
      maxmem: 256 * 1024 * 1024,
    });

    // Verify the key is correct by attempting decrypt
    try {
      decryptKey(this.keystore, pin);
    } catch {
      return createError(req.id, RpcErrorCode.INVALID_PARAMS, "Invalid PIN");
    }

    this.session.unlock(derivedKey);
    return createSuccess(req.id, { status: "unlocked", ttlMs: this.session.getTtlMs() });
  }

  private handleLock(req: JsonRpcRequest): JsonRpcResponse {
    this.session.lock();
    return createSuccess(req.id, { status: "locked" });
  }

  private handleGetAllowance(req: JsonRpcRequest): JsonRpcResponse {
    return createSuccess(req.id, {
      policy: this.allowance.getPolicy(),
      dailyTotalUsd: this.allowance.getDailyTotalUsd(),
    });
  }

  private async handleSetAllowance(req: JsonRpcRequest): Promise<JsonRpcResponse> {
    const ctx: SigningContext = { operation: "set_allowance", level: 2 };
    const pin = await this.authProvider.requestPin(ctx);
    if (!pin) {
      return createError(req.id, RpcErrorCode.USER_REJECTED, "User rejected allowance change");
    }

    // Verify PIN
    if (this.keystore) {
      try { decryptKey(this.keystore, pin); } catch {
        return createError(req.id, RpcErrorCode.INVALID_PARAMS, "Invalid PIN");
      }
    }

    const policy = req.params?.policy as any;
    if (policy) {
      this.allowance.setPolicy({
        maxPerTxUsd: policy.maxPerTxUsd ?? 100,
        maxDailyUsd: policy.maxDailyUsd ?? 500,
        allowedTokens: policy.allowedTokens ?? ["ETH", "USDC", "USDT"],
        allowedRecipients: policy.allowedRecipients ?? [],
        enabled: policy.enabled ?? true,
      });
      await this.allowance.save();
    }

    return createSuccess(req.id, { policy: this.allowance.getPolicy() });
  }

  private async decryptWithSession(): Promise<Hex> {
    if (!this.keystore) throw new Error("No wallet configured");

    if (this.session.isUnlocked()) {
      const derivedKey = this.session.getDerivedKey()!;
      const { kdfparams, cipherparams } = this.keystore.crypto;
      const iv = Buffer.from(cipherparams.iv, "hex");
      const ciphertext = Buffer.from(this.keystore.crypto.ciphertext, "hex");
      const storedTag = Buffer.from(this.keystore.crypto.mac, "hex");

      const decipher = createDecipheriv("aes-256-gcm", derivedKey, iv);
      decipher.setAuthTag(storedTag);
      let decrypted: Buffer;
      try {
        decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      } catch {
        this.session.lock();
        throw new Error("Session key invalid — please unlock again");
      }
      const hex = `0x${decrypted.toString("hex")}` as Hex;
      decrypted.fill(0);
      return hex;
    }

    const ctx: SigningContext = { operation: "unlock", level: 2 };
    const pin = await this.authProvider.requestPin(ctx);
    const privateKey = decryptKey(this.keystore, pin);

    // Cache session for next time
    const { kdfparams } = this.keystore.crypto;
    const salt = Buffer.from(kdfparams.salt, "hex");
    const derivedKey = scryptSync(pin, salt, kdfparams.dklen, {
      N: kdfparams.n, r: kdfparams.r, p: kdfparams.p,
      maxmem: 256 * 1024 * 1024,
    });
    this.session.unlock(derivedKey);

    return privateKey;
  }
}
