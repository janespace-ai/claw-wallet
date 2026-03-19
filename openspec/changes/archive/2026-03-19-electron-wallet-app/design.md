## Context

当前 claw-wallet 采用 Phase 1 架构：Signer 守护进程持有加密 keystore 文件，Agent 通过 Unix Socket IPC 请求签名。虽然有强密码、速率限制、GUI 认证等多层防护，但私钥仍然以加密文件形式存在于电脑上。一旦 Agent 被入侵，攻击者可能获取 keystore 文件进行离线暴力破解。

Phase 2 的核心架构变更是将私钥完全从 Agent 所在电脑移除，迁移到用户控制的独立设备（Electron 桌面应用）上。Agent 侧的 Signer 变为无密钥的轻量中继，通过 Go Relay 服务建立 E2EE 通道与 Electron Wallet App 通信。

**约束**：
- 移动端 App 需要应用商店审核，短期不可用 → 先用 Electron 桌面应用
- Electron 无摄像头扫码能力 → 采用短码复制粘贴配对
- 用户可能在不同网络使用 → 需要 Relay 中转而非仅局域网直连
- Electron App **不得**与 Agent 运行在同一台机器上 → 需检测并强制告警

## Goals / Non-Goals

**Goals:**
- 电脑端（Agent 侧）实现零密钥材料，从根本上消除密钥泄露风险
- 通过 Electron 跨平台桌面应用管理私钥，支持 macOS / Windows / Linux
- 支持 macOS Touch ID 和 Windows Hello 生物识别快速解锁
- 预算内交易静默自动签名，保持 Agent 自主性
- 超预算交易弹窗确认，保证大额安全
- IP + 设备指纹绑定，检测异常访问并降级为逐笔确认
- 检测 Agent 与 Electron App 同机运行并强制告警
- 配对流程无需摄像头，通过短码复制粘贴完成

**Non-Goals:**
- iOS / Android 原生移动 App（Phase 2B，本次不实现）
- ERC-4337 Account Abstraction（Phase 3）
- 局域网 mDNS 直连优化（未来增强，本次仅通过 Relay）
- 多钱包管理（本次仅支持单钱包）
- 链上治理或多签

## Decisions

### D1: Electron 桌面应用 vs 移动 App

**选择**: Electron 桌面应用 (Phase 2A)

**理由**: 移动 App 需要应用商店审核流程（iOS 数周至数月），而 Electron 可以立即分发和迭代。Electron 使用与主项目相同的 TypeScript/Node.js 技术栈，开发成本更低。未来调试稳定后再开发原生移动 App (Phase 2B)。

**替代方案**: React Native 跨平台 App — 虽可覆盖移动和桌面，但桌面端体验不如 Electron 原生，且初期不需要移动端。

### D2: 短码配对 vs QR 扫码

**选择**: Relay 辅助的短码配对 (8 位字母数字, Base36, 10 分钟过期)

**理由**: Electron 没有移动设备的摄像头扫码能力。短码通过 Relay 做临时映射（内存存储, TTL 10分钟），用户将短码告诉小龙虾 Agent（复制粘贴或口述），Agent 调用 `wallet_pair` 完成握手。8 位 Base36 = 2.8 万亿种组合 + 10 分钟过期，暴力枚举不可行。

**替代方案**: 完整配对信息直接复制 — 公钥等信息太长（100+ 字符），用户体验差。

### D3: Go Relay Server 设计

**选择**: Go 语言无状态 WebSocket Relay

**理由**: Go 天然适合高并发网络服务，二进制部署简单（Docker 单文件），内存占用低。Relay 不存储任何密钥，不解密 E2EE 消息，仅转发密文并注入源 IP。纯内存存储（配对短码缓存），无需数据库。

**职责边界**:
- 短码配对缓存（内存, 10min TTL）
- WebSocket 消息按 pairId 路由转发
- 在消息中注入 sourceIP（供客户端做 IP 变化检测）
- Rate limiting 防滥用
- 不持久化任何数据

### D4: E2EE 通道协议

**选择**: X25519 ECDH 密钥交换 + AES-256-GCM 对称加密

**理由**: 参考 WalletConnect v2 成熟模型。X25519 用于配对时协商共享密钥，后续通信使用 AES-256-GCM 加密。每条消息携带递增 nonce 防重放。连接断开后需要重新握手。

### D5: IP + 设备指纹安全监控

**选择**: Relay 源 IP 为主要信任锚 + 电脑自报设备指纹为辅助

**理由**: Relay 观察到的源 IP 是攻击者无法伪造的（除非在同一出口网络）。电脑自报的设备指纹（硬件信息 hash）可以被泄露后复制，因此只作辅助检查。当 IP 或指纹发生变化时，立即降级为逐笔手动确认，并向用户显示三级响应选项：拒绝并冻结 / 仅此次允许 / 信任新设备。

### D6: 锁屏策略 — 默认便利模式

**选择**: 闲置后保留内存密钥，预算内自动签名继续运行

**理由**: Agent 可能在后台持续进行交易（DeFi 策略、定时转账等），严格模式会打断工作流。便利模式下超预算交易仍需用户确认弹窗，资金风险可控。用户可在设置中切换到严格模式（闲置后清除内存密钥，全部签名暂停）。

### D7: 生物识别集成

**选择**: Electron safeStorage API + 平台原生生物识别

**理由**:
- macOS: `systemPreferences.promptTouchID(reason)` + Keychain
- Windows: Windows Hello API (通过 native module) + Credential Locker
- Linux: 降级为纯密码（无标准生物识别 API），使用 libsecret

首次启动必须输入密码。密码派生密钥存入 OS 安全存储（受生物识别保护）。后续启动通过生物识别访问 OS 存储取出派生密钥。

### D8: 同机运行检测

**选择**: 配对握手时双方交换 machineId，相同则强制告警

**理由**: Electron App 与 Agent 在同一台机器上时，进程隔离的安全意义大幅降低 — 攻击者控制该机器后可同时操控两个进程。检测手段：配对时通过 machineId（OS hostname + 网卡 MAC hash）判断，如果相同则在 Electron App 上显示高危告警，用户必须手动确认"我了解风险"才能继续。

### D9: Monorepo 目录结构 — 根目录三个子项目

**选择**: 在项目根目录使用 `server/`, `desktop/`, `agent/` 三个并列目录

**理由**: Go Relay Server、Electron App 和 Agent 各自有独立的语言生态和构建工具链。原 `src/` 重命名为 `agent/` 更清晰地表达其角色。三个目录各自独立管理依赖和构建。

**目录结构**:
```
wallet/                     # 项目根目录
  server/                   # Go Relay Server
    go.mod
    go.sum
    cmd/relay/main.go
    internal/hub/
    internal/pairing/
    Dockerfile
  desktop/                  # Electron Wallet App
    package.json
    tsconfig.json
    src/
      main/                 # Electron 主进程
      renderer/             # Electron 渲染进程
      shared/               # E2EE 通信层等共享代码
    electron-builder.yml
  agent/                    # Agent 侧代码 (原 src/)
    signer/                 # 轻量 Relay Client (大幅删减)
    tools/                  # Agent Tools (保留, 更新)
    chain.ts
    transfer.ts
    ...
```

### D10: Phase 1 老代码清理策略

**选择**: 彻底删除所有迁移到 Electron App 的代码，不保留向后兼容

**理由**: Phase 2 是全新架构，保留老代码会造成混乱和维护负担。密钥管理、认证、Allowance 等逻辑完全迁移到 `desktop/`，Agent 侧的 `agent/signer/` 仅保留 IPC 协议和 Relay Client。删除的依赖 (`@scure/bip39`, `@scure/bip32`) 也从根 `package.json` 移除（它们会在 `desktop/package.json` 中重新添加）。原 `src/` 整体重命名为 `agent/`。

**具体删除清单**:
- `bin/claw-signer.ts` — Signer 独立 CLI
- `agent/keystore.ts` — Keystore V3 加解密 (原 src/keystore.ts)
- `agent/mnemonic.ts` — BIP-39 助记词本地管理 (原 src/mnemonic.ts)
- `agent/signer/daemon.ts` — 密钥管理 Signer 守护进程 (重写为 relay-client.ts)
- `agent/signer/gui-auth.ts` + `agent/signer/gui-pages/*` — GUI AuthProvider
- `agent/signer/tui-auth.ts` — TUI AuthProvider
- `agent/signer/webhook-auth.ts` — Webhook AuthProvider
- `agent/signer/auth-provider.ts` — AuthProvider 接口
- `agent/signer/password-strength.ts` — 密码强度校验
- `agent/signer/rate-limiter.ts` — 速率限制
- `agent/signer/session.ts` — Session 管理
- `agent/signer/allowance.ts` — Allowance 引擎
- `agent/signer/audit-log.ts` — 审计日志
- `tests/keystore.test.ts`, `tests/mnemonic.test.ts`
- `tests/signer/auth-hardening.test.ts`, `tests/signer/gui-mnemonic.test.ts`, `tests/signer/session.test.ts`, `tests/signer/password-strength.test.ts`, `tests/signer/rate-limiter.test.ts`, `tests/signer/allowance.test.ts`

## Risks / Trade-offs

**[R1] Relay 单点故障** → Relay 设计为无状态可水平扩展，可部署多实例 + 负载均衡。客户端支持配置多个 Relay URL，自动 failover。

**[R2] Electron App 被入侵** → Electron App 持有私钥，如果 App 自身有漏洞（Electron 安全问题历史较多），私钥可能泄露。缓解：定期更新 Electron 版本，禁用 nodeIntegration 在渲染进程，使用 contextBridge 隔离，密钥仅在主进程内存中解密。

**[R3] E2EE 配对信息泄露** → 如果 Agent 被入侵，攻击者可能获取配对信息（X25519 私钥）并从另一台机器冒充。缓解：IP 变化检测 + 设备指纹绑定，异常时降级为逐笔确认并告警。

**[R4] Electron App 离线时 Agent 无法交易** → 这是"安全代价"。Electron App 需要以托盘模式常驻后台。如果用户关闭 App，Agent 的签名请求会返回"钱包离线"错误。

**[R5] 用户同机运行忽略告警** → 用户可能在相同机器上运行 Electron App 和 Agent（为了方便）并忽略风险告警。缓解：告警不可跳过，需要手动输入"我了解风险"文字确认，并在 App 界面持续显示风险标记。

## Open Questions

- Relay 服务是自建还是使用现成方案（如 WalletConnect Relay）？
- 未来 Phase 2B 移动 App 是否共享 Relay 服务？
- 是否需要支持多设备配对（一个钱包配对多个 Agent）？
