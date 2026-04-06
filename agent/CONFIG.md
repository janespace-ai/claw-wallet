# Agent 配置说明

在 `agent/` 目录（或运行时的当前工作目录）复制示例：

- 通用：`cp config.example.json config.json`
- 生产：`config.prod.example.json`
- 本地联调（本地链、更高限额）：`config.local.example.json`

Agent 从当前工作目录读取 `config.json`。`config.local.json` 可被用于本地覆盖且通常加入 `.gitignore`；合并 `relayUrl` 的逻辑见 `src/resolve-relay-url.ts`。

## 环境变量

| 变量 | 作用 |
|------|------|
| `RELAY_URL` | 中继地址（若未在构造选项 / `config.json` 中设置则使用）。 |
| `DATA_DIR` | 数据目录（配对、联系人、策略、历史等）；也可写在 `config.json` 的 `dataDir`。 |
| `DEFAULT_CHAIN` | 默认链 `base` 或 `ethereum`。 |
| `CLAW_AGENT_PAIR_TIMEOUT_MS` | 配对校验请求超时（毫秒）。 |
| `CLAW_AGENT_RELAY_TIMEOUT_MS` | 发往桌面钱包的中继请求超时（毫秒）。 |
| `CLAW_AGENT_SIGN_TIMEOUT_MS` | 等待桌面钱包签名的超时（毫秒，含用户审批时间）。 |
| `CLAW_AGENT_RECONNECT_BASE_MS` | 重连退避基础延迟（毫秒）。 |
| `CLAW_AGENT_RECONNECT_MAX_MS` | 重连退避上限（毫秒）。 |

## 顶层字段

| 路径 | 说明 |
|------|------|
| `relayUrl` | 与桌面钱包通信的中继 URL（HTTP/HTTPS，与桌面 `relayUrl` 的 ws/wss 对应部署方式一致即可）。 |
| `dataDir` | 存储配对、联系人、策略、历史等的路径；可用 `~` 表示家目录。 |
| `defaultChain` | 默认链：`base` 或 `ethereum`。 |
| `chains` | 可选。按链 RPC 覆盖；省略则使用 viem 内置公共 RPC。 |
| `chains.*.rpcUrl` | 各链 RPC；留空可配合默认。 |
| `pairTimeoutMs` | 配对码校验超时。 |
| `relayTimeoutMs` | 通用中继请求超时。 |
| `signTimeoutMs` | 签名等待超时。 |
| `reconnectBaseMs` | 未在示例中列出时默认为 `1000`；可写入 `config.json` 覆盖。 |
| `reconnectMaxMs` | 未在示例中列出时默认为 `30000`；可写入 `config.json` 覆盖。 |
| `policy.perTxLimitUsd` | 单笔超过该 USD 估值则需人工审批。 |
| `policy.dailyLimitUsd` | 单日累计 USD 限额。 |
| `policy.mode` | 策略模式标签；Agent 侧重 USD 限额，可信收款方等在桌面端配置。 |

## 本地示例文件

`config.local.example.json` 使用本地节点 RPC（如 `8545`/`8546`），并提高 `policy` 限额以便开发；勿用于生产。

本地链示例：以太坊 `npx hardhat node --chain-id 1 --port 8545`；Base `npx hardhat node --chain-id 8453 --port 8546`。
