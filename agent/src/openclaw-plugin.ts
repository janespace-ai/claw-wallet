// openclaw is a peerDependency — available at runtime in the OpenClaw environment
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { definePluginEntry } = require("openclaw/plugin-sdk/plugin-entry");
import { ClawWallet } from "./index.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default definePluginEntry({
  id: "claw-wallet",
  name: "Claw Wallet",
  description:
    "Web3 wallet tools — balance, send, DeFi contract calls, EIP-712 signing",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async register(api: any) {
    // relayUrl resolves from: config.json → RELAY_URL env → cwd config → localhost:8080
    const wallet = new ClawWallet();
    await wallet.initialize();
    for (const tool of wallet.getTools()) {
      api.registerTool({
        label: tool.name.replace(/_/g, " "),
        ...tool,
      });
    }
  },
});
