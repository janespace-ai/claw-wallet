# Agent configuration

Copy an example in `agent/` (or your process working directory):

- Default: `cp config.example.json config.json`
- Production: `config.prod.example.json`
- Local integration (local chain, higher limits): `config.local.example.json`

The agent loads `config.json` from the current working directory. `config.local.json` is a common local override (often gitignored); merging `relayUrl` is described in `src/resolve-relay-url.ts`.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `RELAY_URL` | Relay URL when not set via constructor options or `config.json`. |
| `DATA_DIR` | Data directory (pairing, contacts, policy, history); can also set `dataDir` in `config.json`. |
| `DEFAULT_CHAIN` | Default chain: `base` or `ethereum`. |
| `CLAW_AGENT_PAIR_TIMEOUT_MS` | Pairing validation request timeout in ms. |
| `CLAW_AGENT_RELAY_TIMEOUT_MS` | Relay request timeout to the desktop wallet in ms. |
| `CLAW_AGENT_SIGN_TIMEOUT_MS` | Timeout waiting for the desktop wallet to sign in ms (includes user approval). |
| `CLAW_AGENT_RECONNECT_BASE_MS` | Reconnect backoff base delay in ms. |
| `CLAW_AGENT_RECONNECT_MAX_MS` | Reconnect backoff cap in ms. |

## Top-level keys

| Path | Description |
|------|-------------|
| `relayUrl` | Relay URL for talking to the desktop wallet (HTTP/HTTPS; align with how the desktop `relayUrl` is deployed, ws/wss vs http). |
| `dataDir` | Path for pairing, contacts, policy, history; `~` expands to home. |
| `defaultChain` | Default chain: `base` or `ethereum`. |
| `chains` | Optional per-chain RPC overrides; omit to use viem’s built-in public RPCs. |
| `chains.*.rpcUrl` | RPC URL per chain; omit or use defaults as needed. |
| `pairTimeoutMs` | Pairing code validation timeout. |
| `relayTimeoutMs` | General relay request timeout. |
| `signTimeoutMs` | Signing wait timeout. |
| `reconnectBaseMs` | Defaults to `1000` if omitted from the file; set in `config.json` to override. |
| `reconnectMaxMs` | Defaults to `30000` if omitted; set in `config.json` to override. |
| `policy.perTxLimitUsd` | Manual approval required above this USD estimate per tx. |
| `policy.dailyLimitUsd` | Daily cumulative USD limit. |
| `policy.mode` | Policy mode label; the agent enforces USD limits. Trusted recipients are configured in the desktop wallet. |

## Local example file

`config.local.example.json` uses local node RPCs (e.g. `8545` / `8546`) and higher `policy` limits for development. **Not for production.**

Example local nodes: Ethereum `npx hardhat node --chain-id 1 --port 8545`; Base `npx hardhat node --chain-id 8453 --port 8546`.
