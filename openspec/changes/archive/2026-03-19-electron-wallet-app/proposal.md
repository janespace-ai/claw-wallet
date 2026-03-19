## Why

当前 Phase 1 架构要求用户手动启动 Signer 守护进程，私钥以加密 keystore 形式存储在电脑本地。即使有强密码 + 速率限制保护，Agent 被黑后攻击者仍有可能获取 keystore 文件并进行离线暴力破解。Phase 2 将私钥完全从电脑移除，迁移到独立的 Electron 桌面钱包应用中，通过 E2EE WebSocket 通道与 Agent 通信，从根本上消除电脑端的密钥材料。

## What Changes

- **Monorepo 目录重构**：根目录新增 `server/` (Go Relay Server) 和 `desktop/` (Electron Wallet App) 两个独立子项目，原 `src/` 重命名为 `agent/` (Agent 侧代码)
- **删除 Phase 1 老代码**：移除所有本地密钥管理相关代码 — `agent/signer/` 下的 daemon 密钥逻辑、GUI/TUI AuthProvider、password-strength、rate-limiter、session 管理、gui-pages、`agent/mnemonic.ts`、`agent/keystore.ts`、`bin/claw-signer.ts`，以及对应的测试文件。Agent 侧仅保留轻量 Signer relay client 和 IPC 基础设施
- **新增 Go Relay 中转服务** (`server/`)：负责 WebSocket 消息转发（纯密文中转，不存储任何密钥），支持短码配对映射，注入源 IP 用于安全监控
- **新增 Electron Wallet App** (`desktop/`)：跨平台桌面钱包应用，持有私钥（BIP-39 助记词加密存储），集成签名引擎和 Allowance 预算管理，支持 macOS Touch ID / Windows Hello 生物识别解锁
- **改造 Agent 侧 Signer 为轻量模式**：不再持有任何密钥材料，仅通过 Relay 将签名请求转发给 Electron App
- **新增短码配对机制**：Electron App 生成短配对码，用户通过复制粘贴告诉小龙虾 Agent 完成配对，无需摄像头扫码
- **新增安全监控机制**：IP 绑定 + 设备指纹检测，IP/指纹变化时降级为逐笔手动确认并告警
- **锁屏策略**：默认便利模式 — 闲置后保留内存密钥，预算内自动签名继续运行，超预算仍需用户确认
- **同机检测与告警**：检测 Electron App 与 Agent 是否在同一台机器运行，强制提示用户安全风险（Agent 可操控同机 App 导致资金损失）

## Capabilities

### New Capabilities
- `go-relay-server`: Go 语言 WebSocket 中转服务，短码配对缓存（内存, 10min TTL），源 IP 注入，Rate limiting，无状态可水平扩展
- `electron-wallet-app`: Electron 跨平台桌面钱包应用，BIP-39 密钥管理，AES-256-GCM 加密存储，签名引擎（自动/确认），Allowance 预算管理 UI，配对码生成与管理
- `e2ee-communication`: X25519 ECDH 密钥交换 + AES-256-GCM 端到端加密通道，WebSocket 传输层，自动重连，消息序号防重放
- `device-security`: IP 变化检测，设备指纹绑定，异常行为降级（IP/指纹变化→逐笔确认），同机运行检测与强制告警，冻结/单次允许/信任新设备三级响应
- `biometric-auth`: macOS Touch ID / Windows Hello 集成，OS 安全存储（Keychain / Credential Locker）缓存派生密钥，Linux 降级为纯密码，首次启动必须密码，后续支持生物识别快速解锁
- `wallet-pairing`: 短码配对协议（Relay 辅助），复制粘贴式配对流程（无需摄像头），配对确认需生物识别/密码验证，配对信息管理（查看/撤销已配对设备）

### Modified Capabilities
- `signer-daemon`: 改造为轻量无密钥模式，签名请求通过 Relay 转发给 Electron App，新增 `wallet_pair` RPC 方法
- `signer-auth`: AuthProvider 扩展支持远程签名流程，Level 1/2 授权逻辑迁移到 Electron App 端
- `wallet-core`: 钱包创建/导入流程迁移到 Electron App 端，Agent 侧仅存地址和通信公钥

## Impact

- **Monorepo 目录结构**：
  - `server/` — Go Relay Server 独立子项目 (go.mod, cmd/, internal/)
  - `desktop/` — Electron Wallet App 独立子项目 (package.json, src/, electron/)
  - `agent/` — Agent 侧代码 (原 `src/` 重命名)，Signer 大幅精简
- **删除的 Phase 1 文件**：
  - `bin/claw-signer.ts` — 独立 Signer CLI (不再需要独立守护进程)
  - `agent/keystore.ts` — 本地 Keystore V3 加解密 (密钥管理迁移到 desktop/)
  - `agent/mnemonic.ts` — 本地助记词管理 (迁移到 desktop/)
  - `agent/signer/daemon.ts` — 本地密钥 Signer 守护进程逻辑 (重写为轻量 relay client)
  - `agent/signer/gui-auth.ts` + `agent/signer/gui-pages/` — GUI AuthProvider (认证迁移到 desktop/)
  - `agent/signer/tui-auth.ts` — TUI AuthProvider
  - `agent/signer/webhook-auth.ts` — Webhook AuthProvider
  - `agent/signer/auth-provider.ts` — AuthProvider 接口 (不再需要)
  - `agent/signer/password-strength.ts` — 密码强度校验 (迁移到 desktop/)
  - `agent/signer/rate-limiter.ts` — 速率限制 (迁移到 desktop/)
  - `agent/signer/session.ts` — Session 管理 (迁移到 desktop/)
  - `agent/signer/allowance.ts` — Allowance 引擎 (迁移到 desktop/)
  - `agent/signer/audit-log.ts` — 审计日志 (迁移到 desktop/)
  - `tests/keystore.test.ts`, `tests/mnemonic.test.ts` — 对应测试
  - `tests/signer/auth-hardening.test.ts`, `tests/signer/gui-mnemonic.test.ts` 等 — Phase 1 Signer 测试
- **保留的 Agent 侧文件**：
  - `agent/signer/ipc-client.ts`, `agent/signer/ipc-server.ts`, `agent/signer/ipc-protocol.ts` — IPC 基础设施
  - `agent/signer/index.ts` — Signer 模块入口 (重写)
  - `agent/tools/` — 全部保留，部分更新
  - `agent/chain.ts`, `agent/transfer.ts`, `agent/contacts.ts`, `agent/policy.ts` 等 — 业务逻辑保留
- **新增 Electron 项目**：`desktop/` 子项目，依赖 `electron`, `@noble/curves`, `@scure/bip39`, `@scure/bip32`
- **新增 Go Relay**：`server/` 子项目，Docker 单二进制部署
- **新增 Agent Tool**：`wallet_pair` 用于配对 Electron App
- **部署变更**：需要部署 Go Relay 服务
- **用户流程变更**：钱包创建/管理从 Agent 端迁移到 Electron App 端
- **开发路线**：Phase 2A (Electron) -> 调试稳定 -> Phase 2B (iOS/Android 原生 App)
