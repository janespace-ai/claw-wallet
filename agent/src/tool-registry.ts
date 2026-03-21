import type { Address } from "viem";

import type { ChainAdapter } from "./chain.js";
import type { PolicyEngine } from "./policy.js";
import type { ContactsManager } from "./contacts.js";
import type { TransactionHistory } from "./history.js";
import type { TransferService } from "./transfer.js";
import type { SignerClient } from "./signer/ipc-client.js";
import type { SupportedChain, ToolDefinition } from "./types.js";

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

export interface ToolDependencies {
  signerClient: SignerClient;
  chainAdapter: ChainAdapter;
  getAddress: () => Address | null;
  getTransferService: () => TransferService | null;
  contacts: ContactsManager;
  policy: PolicyEngine;
  history: TransactionHistory;
  defaultChain: SupportedChain;
}

export function createAllTools(deps: ToolDependencies): ToolDefinition[] {
  return [
    createWalletCreateTool(deps.signerClient),
    createWalletImportTool(deps.signerClient),
    createWalletPairTool(deps.signerClient),
    createWalletAddressTool(deps.getAddress),
    createWalletBalanceTool(deps.chainAdapter, deps.getAddress, deps.defaultChain),
    createWalletEstimateGasTool(deps.chainAdapter, deps.defaultChain),
    createWalletSendTool(deps.getTransferService, deps.defaultChain),
    ...createWalletContactsTools(deps.contacts, deps.defaultChain),
    ...createWalletPolicyTools(deps.policy),
    ...createWalletApprovalTools(deps.policy),
    createWalletHistoryTool(deps.history),
  ];
}
