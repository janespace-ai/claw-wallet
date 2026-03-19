# Phase 3 远景：Mobile Signer Architecture

> **状态**: 远景规划 — 本文档记录未来 Mobile Signer 的设计方向。
>
> **当前实现（Phase 2）**：claw-wallet 已实现 **Electron 桌面钱包** 作为签名端，通过 E2EE WebSocket 中继与 Agent 通信。详见 [PHASE2-ELECTRON-WALLET.md](PHASE2-ELECTRON-WALLET.md)。
>
> 本文所述的 Mobile Signer 是在 Desktop Wallet 基础上的进一步演进，将签名端从桌面应用迁移至手机，利用 Secure Enclave 提供硬件级密钥保护。Phase 2 中已建立的 E2EE 通信协议、自动配对机制和三级验证体系可直接复用。

## 与 Phase 2 Desktop Wallet 的关系

Phase 2（当前）和 Phase 3（远景）的核心差异：

```
Phase 2 (当前 — Electron Desktop Wallet):
  Agent:   零秘密，通过 E2EE Relay 通信
  桌面钱包: Keystore V3 加密存储私钥 (scrypt + AES-256-GCM)
  安全特性: 自动配对/重连、三级验证、Relay IP 绑定/限流

Phase 3 (远景 — Mobile Signer):
  Agent:   零秘密，复用 E2EE Relay 通信协议
  手机:    私钥存储在 Secure Enclave (硬件隔离)
  新增特性: 生物识别认证、硬件级密钥保护、QR 配对
```

Phase 2 的以下基础设施可直接复用于 Phase 3：
- E2EE 通信协议（X25519 + AES-256-GCM）
- Go Relay Server（WebSocket 转发、IP 绑定、速率限制）
- 持久化通信密钥对与确定性 pairId
- 三级重连验证（公钥 + 设备指纹 + IP 策略）
- 策略引擎（Allowance 预算）

## 核心架构：私钥仅存手机，电脑零秘密

### 架构图

```
┌────────────────────┐        ┌─────────────────────────┐
│   电脑 (Agent)     │        │   手机 (Wallet App)     │
│                    │        │                         │
│   Agent 进程       │  IPC   │   私钥 (Secure Enclave) │
│   ↓               │        │   签名引擎              │
│   Signer 进程      │ ←E2EE→ │   Allowance 引擎        │
│   (无密钥材料)     │        │   用户确认 UI           │
│   仅知道地址+公钥  │        │   生物识别认证          │
│                    │        │                         │
└────────────────────┘        └─────────────────────────┘
```

## 非对称挑战-响应认证

替代 TOTP 等对称方案。TOTP 需要在本地存储 Secret（攻击者读到后可自行生成验证码）；非对称方案本地仅存公钥，读到也没用。

### 配对流程

1. 手机 App 生成 Ed25519 密钥对
2. 手机将**公钥**编码为 QR 码
3. 电脑 Signer 扫描 QR 码 → 保存公钥到 `mobile-auth.json`
4. 双方交换临时密钥建立 E2EE 通道

### 签名确认流程

```
Agent 发起交易
  ↓
Signer 构建 challenge = { txHash, to, amount, nonce, timestamp }
  ↓
Signer → E2EE → 手机
  ↓
手机弹出确认界面: "发送 0.1 ETH → 0xABC...?"
  ↓
用户指纹/面部确认
  ↓
手机用私钥签名 challenge → signature
  ↓
手机 → E2EE → Signer
  ↓
Signer 用公钥验证 signature ✓
Signer 验证 nonce 未使用 (防重放) ✓
Signer 验证 timestamp 在窗口内 ✓
  ↓
确认通过 → 执行链上签名 (手机完成)
```

### 安全属性

- 电脑被完全攻破：攻击者只有公钥，无法伪造签名
- TOTP Secret 泄露问题：不存在（没有对称 Secret）
- 重放攻击：nonce + timestamp 双重防护

## 通讯通道

手机和电脑之间需要实时通讯通道。

### 方案选择

| 方案 | 优点 | 缺点 |
|------|------|------|
| 局域网直连 (mDNS) | 零依赖、低延迟 | 必须同一 WiFi |
| E2EE Relay (WebSocket) | 跨网络、手机随时可达 | 需要中继服务 |
| QR 码接力 | 完全气隙隔离 | Agent 无法自动交易 |

### 推荐: 混合方案

- **近场**: 优先局域网直连（同一 WiFi 自动发现）
- **远场**: fallback 到 E2EE Relay（Cloudflare Workers 或自建）
- Relay 只转发密文，无法解密或篡改
- 基于 WalletConnect v2 协议模型: QR 配对 + X25519 密钥交换 + AES-256-GCM

## Allowance 与 Agent 自主性

手机签名不意味着每笔都要用户手动确认。

### 预授权预算

用户在手机 App 上设置:
- 每日总额: 500 USDT
- 单笔上限: 100 USDT
- 允许代币: ETH, USDC, USDT
- 有效期: 24 小时

手机 App 在预算内**自动签名**（后台静默完成），超出预算时弹出确认。

### 两种实现路径

**EOA (普通钱包) — 手机常驻在线**:
- 手机 App 内置 Allowance 逻辑
- 预算内: App 自动签名，不弹通知
- 超预算: App 弹出确认界面
- 要求手机保持网络连接

**Smart Contract Wallet (ERC-4337) — 手机可离线**:
- 链上合约定义 Session Key 权限
- 用户在手机上签署 Session Key 授权
- 电脑持有 Session Key，直接签名（链上限制）
- 手机离线也不影响小额交易

## Phase 3 终极方案: ERC-4337 Account Abstraction

ERC-4337 是终极方案，提供链上强制的权限分离。

### 架构

```
Smart Contract Wallet (链上)
├── Owner Key (手机 Secure Enclave) → 无限制
├── Session Key (电脑) → 受限:
│   ├── 单笔 ≤ $100
│   ├── 日累计 ≤ $500
│   ├── 仅限 ETH/USDC/USDT
│   └── 有效期 24 小时
└── 这些规则在链上强制执行 (数学保证)
```

### 优势

- Session Key 泄露: 攻击者最多花 $500/天（链上限制）
- 电脑完全被控: 同上，且用户可用手机随时撤销 Session Key
- 不需要手机实时在线: Session Key 授权后独立运行

### 限制

- 需要链支持 ERC-4337 (Base, Optimism, Arbitrum 已支持)
- 首次部署合约钱包有 gas 成本
- 生态仍在早期
