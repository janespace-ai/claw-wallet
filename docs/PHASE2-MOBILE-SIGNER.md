# Phase 2: Mobile Signer Architecture (远景设计)

> **状态**: 规划中 — 本文档记录 Phase 2 的设计思路，待 Phase 1（auth-hardening）稳定后实施。

## 核心架构：私钥仅存手机，电脑零秘密

Phase 1 的安全模型依赖「强密码 + Signer 进程隔离」，但私钥仍然存储在电脑上的 keystore 文件中。Phase 2 的目标是彻底消除电脑端的密钥材料：

```
Phase 1 (当前):
  电脑: keystore.json (加密私钥) + Signer daemon
  威胁: 攻击者获取 keystore → 需破解强密码 (实际不可行)

Phase 2 (目标):
  电脑: 仅存钱包地址 + 手机公钥
  手机: 私钥 (Secure Enclave)
  威胁: 攻击者完全控制电脑 → 无任何密钥材料可偷
```

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

## Phase 3 展望: ERC-4337 Account Abstraction

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
