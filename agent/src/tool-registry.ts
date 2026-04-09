import type { Address } from "viem";

import type { ChainAdapter } from "./chain.js";
import type { PolicyEngine } from "./policy.js";
import type { ContactsManager } from "./contacts.js";
import type { TransactionHistory } from "./history.js";
import type { TransferService } from "./transfer.js";
import type { WalletConnection } from "./wallet-connection.js";
import type { SupportedChain, ToolDefinition } from "./types.js";
import { logger } from "./logger.js";

import { createWalletCreateTool } from "./tools/wallet-create.js";
import { createWalletImportTool } from "./tools/wallet-import.js";
import {
  createWalletBalanceTool,
  createWalletAddressTool,
  createWalletEstimateGasTool,
} from "./tools/wallet-balance.js";
import { createWalletSendTool } from "./tools/wallet-send.js";
import { createWalletContactsTools } from "./tools/wallet-contacts.js";
import { createWalletPolicyTools } from "./tools/wallet-policy.js";
import { createWalletApprovalTools } from "./tools/wallet-approval.js";
import { createWalletHistoryTool } from "./tools/wallet-history.js";
import { createWalletPairTool } from "./tools/wallet-pair.js";
import { createWalletSignTypedDataTool } from "./tools/wallet-sign-typed-data.js";
import { createWalletCallContractTool } from "./tools/wallet-call-contract.js";
import { createWalletReadContractTool } from "./tools/wallet-read-contract.js";

export interface ToolDependencies {
  walletConnection: WalletConnection;
  chainAdapter: ChainAdapter;
  getAddress: () => Address | null;
  getTransferService: () => TransferService | null;
  contacts: ContactsManager;
  policy: PolicyEngine;
  history: TransactionHistory;
  defaultChain: SupportedChain;
}

export function createAllTools(deps: ToolDependencies): ToolDefinition[] {
  const tools = [
    createWalletCreateTool(),
    createWalletImportTool(),
    createWalletPairTool(deps.walletConnection),
    createWalletAddressTool(deps.getAddress),
    createWalletBalanceTool(deps.chainAdapter, deps.getAddress, deps.defaultChain, deps.walletConnection),
    createWalletEstimateGasTool(deps.chainAdapter, deps.defaultChain),
    createWalletSendTool(deps.getTransferService, deps.defaultChain),
    ...createWalletContactsTools(deps.walletConnection, deps.contacts, deps.defaultChain),
    ...createWalletPolicyTools(deps.policy),
    ...createWalletApprovalTools(deps.policy),
    createWalletHistoryTool(deps.history),
    createWalletSignTypedDataTool(deps.walletConnection, deps.getAddress),
    createWalletCallContractTool(deps.walletConnection, deps.chainAdapter, deps.contacts, deps.getAddress, deps.defaultChain),
    createWalletReadContractTool(deps.chainAdapter, deps.getAddress, deps.defaultChain),
  ];

  // Wrap all tools with logging
  return tools.map(tool => ({
    ...tool,
    execute: async (args: any) => {
      logger.log("TOOL", `Executing ${tool.name}`, { args });
      const startTime = Date.now();
      try {
        const result = await tool.execute(args);
        const duration = Date.now() - startTime;
        logger.log("TOOL", `${tool.name} completed in ${duration}ms`, { result });
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error("TOOL", `${tool.name} failed after ${duration}ms`, {
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
          } : String(error)
        });
        throw error;
      }
    }
  }));
}
