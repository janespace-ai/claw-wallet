import type { Address, Hex } from "viem";
import { parseEther, parseUnits } from "viem";
import { ChainAdapter } from "./chain.js";
import { WalletConnection } from "./wallet-connection.js";
import { PolicyEngine } from "./policy.js";
import { ContactsManager } from "./contacts.js";
import { TransactionHistory } from "./history.js";
import type { SupportedChain, TxRecord } from "./types.js";
import { KNOWN_TOKENS } from "./types.js";
import { validateAddress, validateAmount, validateTokenSymbol } from "./validation.js";
import { logger } from "./logger.js";

export interface SendParams {
  to: string;
  amount: string;
  token?: string;
  chain: SupportedChain;
}

export interface SendResult {
  hash: Hex;
  status: "confirmed" | "failed";
  blockNumber?: bigint;
  gasUsed?: bigint;
  revertReason?: string;
}

export class TransferService {
  constructor(
    private chainAdapter: ChainAdapter,
    private walletAddress: Address,
    private walletConnection: WalletConnection,
    private policy: PolicyEngine,
    private contacts: ContactsManager,
    private history: TransactionHistory
  ) {}

  async sendETH(params: SendParams): Promise<SendResult> {
    logger.log("TransferService", "sendETH START", { params });

    const nativeSymbol = this.chainAdapter.getChain(params.chain).nativeCurrency.symbol;

    validateAmount(params.amount);
    logger.debug("TransferService", "Amount validated");

    const to = await this.resolveRecipient(params.to, params.chain);
    logger.log("TransferService", "Recipient resolved", { to });

    const value = parseEther(params.amount);
    logger.debug("TransferService", "Parsed amount", { value: value.toString() });

    logger.log("TransferService", "Fetching balance...");
    const { wei: balance } = await this.chainAdapter.getBalance(this.walletAddress, params.chain);
    logger.log("TransferService", "Balance fetched", { balance: balance.toString() });

    logger.log("TransferService", "Estimating gas...");
    const gasEstimate = await this.chainAdapter.estimateGas(
      { to, value },
      params.chain
    );
    logger.log("TransferService", "Gas estimated", {
      gas: gasEstimate.gas.toString(),
      gasPrice: gasEstimate.gasPrice.toString(),
      totalCost: gasEstimate.totalCostFormatted
    });

    if (balance < value + gasEstimate.totalCostWei) {
      const available = Number(balance) / 1e18;
      const error = `Insufficient ${nativeSymbol} balance on ${params.chain}. Available: ${available.toFixed(6)} ${nativeSymbol}, ` +
        `needed: ${params.amount} ${nativeSymbol} + ~${gasEstimate.totalCostFormatted} ${nativeSymbol} gas. ` +
        `Tip: Check balances on other chains with wallet_balance (no chain parameter) and consider bridging funds.`;
      logger.error("TransferService", error);
      throw new Error(error);
    }

    logger.log("TransferService", "Checking policy...");
    const amountUsd = parseFloat(params.amount);
    const policyResult = this.policy.checkTransaction(to, amountUsd, nativeSymbol, params.chain);
    if (!policyResult.allowed) {
      logger.warn("TransferService", "Policy blocked transaction", { reason: policyResult.reason });
      throw new PolicyBlockedError(policyResult.reason!, policyResult.approvalId);
    }
    logger.log("TransferService", "Policy check passed");

    logger.log("TransferService", "Fetching chainId and nonce from RPC...");
    const [chainId, nonce] = await Promise.all([
      this.chainAdapter.getChainId(params.chain),
      this.chainAdapter.getNonce(this.walletAddress, params.chain),
    ]);
    logger.log("TransferService", "Calling sendToWallet (sign_transaction)...", { 
      chainId,
      nonce,
      to,
      value: value.toString() 
    });
    
    const result = await this.walletConnection.sendToWallet("sign_transaction", {
      to,
      recipient: to,
      value: value.toString(),
      gas: gasEstimate.gas.toString(),
      gasPrice: gasEstimate.gasPrice.toString(),
      nonce: nonce.toString(),
      type: 0,
      chainId,
      /** Human-readable token amount for display / audit (desktop computes USD for limits). */
      amount_token: params.amount,
      token: nativeSymbol,
      chain: params.chain,
    }) as { signedTx: Hex; requestId: string };
    
    logger.log("TransferService", "Transaction signed, broadcasting...");

    const receipt = await this.chainAdapter.broadcastTransaction(result.signedTx, params.chain);
    logger.log("TransferService", "Transaction broadcast complete", { 
      hash: receipt.transactionHash,
      status: receipt.status 
    });

    const record: TxRecord = {
      hash: receipt.transactionHash,
      direction: "sent",
      from: this.walletAddress,
      to,
      amount: params.amount,
      token: nativeSymbol,
      chain: params.chain,
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      timestamp: Date.now(),
    };
    this.history.addRecord(record);

    await this.notifyTxAndMirrorContacts(
      result.requestId,
      receipt.status === "success",
      receipt.transactionHash,
      params.chain,
    );

    logger.log("TransferService", "sendETH COMPLETE");
    return {
      hash: receipt.transactionHash,
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }

  async sendERC20(params: SendParams): Promise<SendResult> {
    validateAmount(params.amount);
    if (params.token) validateTokenSymbol(params.token);
    const to = await this.resolveRecipient(params.to, params.chain);
    const tokenAddress = this.resolveTokenAddress(params.token!, params.chain);

    const tokenInfo = await this.chainAdapter.getTokenBalance(this.walletAddress, tokenAddress, params.chain);
    const amount = parseUnits(params.amount, tokenInfo.decimals);

    if (tokenInfo.raw < amount) {
      throw new Error(
        `Insufficient ${tokenInfo.symbol} balance on ${params.chain}. Available: ${tokenInfo.formatted}, needed: ${params.amount}. ` +
        `Tip: Check balances on other chains with wallet_balance and consider bridging funds.`
      );
    }

    const transferData = this.chainAdapter.buildERC20TransferData(to, amount);
    const gasEstimate = await this.chainAdapter.estimateGas(
      { from: this.walletAddress, to: tokenAddress, data: transferData },
      params.chain
    );

    const { wei: ethBalance } = await this.chainAdapter.getBalance(this.walletAddress, params.chain);
    if (ethBalance < gasEstimate.totalCostWei) {
      const nativeSymbol = this.chainAdapter.getChain(params.chain).nativeCurrency.symbol;
      throw new Error(
        `Insufficient ${nativeSymbol} for gas. Need ~${gasEstimate.totalCostFormatted} ${nativeSymbol}`
      );
    }

    const amountUsd = parseFloat(params.amount);
    const policyResult = this.policy.checkTransaction(to, amountUsd, tokenInfo.symbol, params.chain);
    if (!policyResult.allowed) {
      throw new PolicyBlockedError(policyResult.reason!, policyResult.approvalId);
    }

    const [chainId, nonce] = await Promise.all([
      this.chainAdapter.getChainId(params.chain),
      this.chainAdapter.getNonce(this.walletAddress, params.chain),
    ]);
    const result = await this.walletConnection.sendToWallet("sign_transaction", {
      to: tokenAddress,
      recipient: to,
      data: transferData,
      gas: gasEstimate.gas.toString(),
      gasPrice: gasEstimate.gasPrice.toString(),
      nonce: nonce.toString(),
      type: 0,
      chainId,
      amount_token: params.amount,
      token: tokenInfo.symbol,
      chain: params.chain,
    }) as { signedTx: Hex; requestId: string };

    const receipt = await this.chainAdapter.broadcastTransaction(result.signedTx, params.chain);

    const record: TxRecord = {
      hash: receipt.transactionHash,
      direction: "sent",
      from: this.walletAddress,
      to,
      amount: params.amount,
      token: tokenInfo.symbol,
      chain: params.chain,
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      timestamp: Date.now(),
    };
    this.history.addRecord(record);

    await this.notifyTxAndMirrorContacts(
      result.requestId,
      receipt.status === "success",
      receipt.transactionHash,
      params.chain,
    );

    return {
      hash: receipt.transactionHash,
      status: receipt.status === "success" ? "confirmed" : "failed",
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }

  async send(params: SendParams): Promise<SendResult> {
    const nativeSymbol = this.chainAdapter.getChain(params.chain).nativeCurrency.symbol.toUpperCase();
    if (!params.token || params.token.toUpperCase() === "ETH" || params.token.toUpperCase() === nativeSymbol) {
      return this.sendETH(params);
    }
    return this.sendERC20(params);
  }

  private async notifyTxAndMirrorContacts(
    requestId: string,
    success: boolean,
    txHash: string,
    chain: SupportedChain,
  ): Promise<void> {
    try {
      const raw = await this.walletConnection.sendToWallet("wallet_notify_tx_result", {
        requestId,
        success,
        txHash,
        chain,
      });
      const res = raw as {
        ok?: boolean;
        newContact?: { name: string; address: string; chain: string; trusted: boolean };
      };
      if (res?.newContact?.trusted === true) {
        const nc = res.newContact;
        const c = nc.chain as SupportedChain;
        this.contacts.addContact(nc.name, { [c]: nc.address as Address });
        this.contacts.setTrustedOnChain(nc.name, c, true);
        await this.contacts.save().catch(() => {});
      }
    } catch (notifyErr) {
      logger.warn(
        "TransferService",
        "wallet_notify_tx_result failed (non-fatal)",
        { error: (notifyErr as Error).message },
      );
    }
  }

  private async resolveRecipient(to: string, chain: SupportedChain): Promise<Address> {
    if (to.startsWith("0x") && to.length === 42) {
      return validateAddress(to);
    }

    const resolved = this.contacts.resolveContact(to, chain);
    if (resolved) return resolved.address;

    throw new Error(`Cannot resolve recipient "${to}". Not a valid address or known contact.`);
  }

  private resolveTokenAddress(tokenOrAddress: string, chain: SupportedChain): Address {
    validateTokenSymbol(tokenOrAddress);
    if (tokenOrAddress.startsWith("0x") && tokenOrAddress.length === 42) {
      return validateAddress(tokenOrAddress);
    }

    const chainTokens = KNOWN_TOKENS[chain];
    const address = chainTokens?.[tokenOrAddress.toUpperCase()];
    if (address) return address;

    throw new Error(
      `Unknown token "${tokenOrAddress}" on ${chain}. Use a contract address instead.`
    );
  }
}

export class PolicyBlockedError extends Error {
  constructor(
    message: string,
    public approvalId?: string
  ) {
    super(message);
    this.name = "PolicyBlockedError";
  }
}
