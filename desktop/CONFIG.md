# Desktop 配置说明

在 `desktop/` 目录下复制示例为实际配置：

- 通用示例：`cp config.example.json config.json`
- 生产环境可参考：`config.prod.example.json`
- 本地开发（本地链、放宽限额）可参考：`config.local.example.json`

运行时从当前工作目录读取 `config.json`（见 `src/main/config.ts`）。未出现的字段使用代码内默认值。

## 环境变量（覆盖同名字段）

| 变量 | 作用 |
|------|------|
| `CLAW_DESKTOP_RELAY_URL` | 中继 WebSocket URL |
| `CLAW_DESKTOP_IP_POLICY` | `block` / `warn` / `allow` |
| `CLAW_DESKTOP_LOCK_MODE` | `convenience` / `strict` |
| `CLAW_DESKTOP_SCRYPT_N` | 密钥派生 scrypt 参数 N（数字字符串） |

## 顶层字段

| 路径 | 说明 |
|------|------|
| `relayUrl` | 中继 WebSocket 地址，例如 `ws://localhost:8080`。 |
| `ipChangePolicy` | 对端 IP 变化：`block` 拒绝、`warn` 提示、`allow` 忽略。 |
| `lockMode` | `convenience` 可使用生物识别；`strict` 要求密码 + 空闲锁定。 |
| `chains` | 可选。按链覆盖 RPC；可省略则使用内置默认公共 RPC。 |
| `chains.ethereum.rpcUrl` | 以太坊主网 RPC；留空或省略该链则走默认。 |
| `chains.base.rpcUrl` | Base 主网 RPC；同上。 |
| `relay.reconnectBaseMs` | 首次重连前基础延迟（毫秒）。 |
| `relay.reconnectMaxMs` | 重连退避上限（毫秒）。 |
| `signing.dailyLimitUsd` | 单日自动批准交易 USD 总额上限。 |
| `signing.perTxLimitUsd` | 单笔自动批准交易 USD 上限。 |
| `signing.tokenWhitelist` | 允许自动批准的代币符号列表。 |
| `signing.autoApproveWithinBudget` | 为 `true` 时，在限额内可能无需桌面弹窗即可签名；`false` 时每笔链上交易需应用内批准（钱包场景建议 `false`）。 |
| `lock.strictIdleTimeoutMs` | `strict` 模式下空闲多久自动锁定（毫秒，例如 `300000` = 5 分钟）。 |
| `security.maxEvents` | 内存中保留的安全事件条数上限。 |
| `keyring.scryptN` | 可选。Keystore 的 scrypt `N`（默认 `16384`）。勿过大，以免超出 Electron/OpenSSL 内存限制；可被 `CLAW_DESKTOP_SCRYPT_N` 覆盖。 |

## 本地开发示例文件说明

`config.local.example.json` 中常见调整：本地 Anvil/Hardhat RPC（如 `8545` / `8546`）、更短的重连间隔、更高的签名限额、以及可选的更长 `strictIdleTimeoutMs` 等。请仅作本地使用，勿用于生产。

本地链示例（与示例中的端口对齐）：以太坊 `npx hardhat node --chain-id 1 --port 8545`；Base `npx hardhat node --chain-id 8453 --port 8546`。
