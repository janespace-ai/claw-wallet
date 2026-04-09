import type { AnyAgentTool, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { ClawWallet } from "./index.js";

// Initialize wallet at module load; tools await this before first execution
// so pairing/contacts/policy data is loaded from disk before any call.
const wallet = new ClawWallet();
const initPromise = wallet.initialize();

export default {
  id: "claw-wallet",
  name: "Claw Wallet",
  description:
    "Web3 wallet tools — balance, send, DeFi contract calls, EIP-712 signing",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    for (const tool of wallet.getTools()) {
      api.registerTool({
        label: tool.name.replace(/_/g, " "),
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        execute: async (args: Record<string, unknown>) => {
          await initPromise; // ensure pairing data loaded before first call
          return tool.execute(args);
        },
      } as AnyAgentTool);
    }
  },
};
