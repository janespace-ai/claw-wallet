## Context

claw-wallet 当前架构中，Agent 通过 Tool 参数直接传递 `password` 和 `private_key`，使得 LLM 在上下文中持有密钥材料。即使 security-audit 加固了输入验证、文件权限和 KDF 参数校验，也无法防止 Agent 被 prompt injection 诱导输出密码。

核心模块关系：
- `src/keystore.ts` — 密钥生成、加密、解密、签名（直接操作私钥）
- `src/transfer.ts` — `TransferService` 构造时接收 `password`，签名时调用 `signTransaction(keystore, password, tx)`
- `src/tools/wallet-create.ts` — Tool 参数含 `password`
- `src/tools/wallet-import.ts` — Tool 参数含 `private_key` + `password`
- `src/index.ts` — `ClawWallet` 构造/运行时持有 `password`

部署场景：桌面应用（Electron/Tauri）、纯 CLI、服务器 daemon 三种形态均需支持。

## Goals / Non-Goals

**Goals:**
- 从架构上保证 Agent 和 Tool 进程永远无法接触密码和私钥
- 签名操作在独立的 Signer 进程中完成，通过 IPC 通信
- 小额交易（预授权范围内）无需用户确认，支持 Agent 自主操作
- 预授权策略（Allowance）默认日限 500U，用户可配置
- 支持桌面 GUI、CLI TUI、服务器推送三种用户交互形态
- 保持现有 Tool 的功能语义不变（只是参数签名变更）

**Non-Goals:**
- 不实现硬件 HSM / Secure Enclave 集成（未来扩展点）
- 不实现 WebAuthn/Passkey 标准（先用 PIN + 可选生物识别）
- 不实现多钱包管理（仍然是单钱包）
- 不实现远程 Signer（Signer 与 Tool 在同一机器上）

## Decisions

### Decision 1: 双进程架构 — Signer 守护进程 + Tool 进程

**选择**: 独立 `claw-signer` 守护进程通过 Unix Domain Socket 与 Tool 进程通信。

**替代方案**:
- A) 同一进程内的隔离模块 — 无法真正隔离内存，Agent Tool 仍可能通过 `process.env` 或全局变量泄漏
- B) 子进程 fork — 每次签名 fork 一次，开销大，session 管理困难
- C) WASM 沙箱 — 复杂度极高，Node.js 生态支持有限

**理由**: Unix Socket IPC 是最小复杂度下的真正进程隔离。Socket 文件仅本地可达，权限可设为 0600。Node.js 的 `net` 模块原生支持 Unix Socket，无需额外依赖。

### Decision 2: IPC 协议 — JSON-RPC over Unix Socket

**选择**: 基于 JSON-RPC 2.0 的请求/响应协议。

```
请求: { jsonrpc: "2.0", method: "sign_transaction", params: { to, value, gas, chainId }, id: 1 }
响应: { jsonrpc: "2.0", result: { signedTx: "0x..." }, id: 1 }
```

**方法集**:
| method | 需要用户交互 | 描述 |
|---|---|---|
| `get_address` | 否 | 返回钱包地址 |
| `create_wallet` | 是 (设 PIN) | 在 Signer 内生成密钥并加密 |
| `import_wallet` | 是 (输入私钥+PIN) | 在 Signer 安全 UI 中输入私钥 |
| `sign_transaction` | 看 Allowance | 签名交易，可能自动或需确认 |
| `sign_message` | 是 (Level 1) | 签名消息 |
| `set_allowance` | 是 (Level 2) | 设置预授权策略 |
| `get_allowance` | 否 | 查询当前预授权状态 |
| `lock` | 否 | 清除 session，回到锁定态 |
| `unlock` | 是 (输入 PIN) | 解锁 session |

**理由**: JSON-RPC 简洁、语言无关、易调试。每个请求原子性独立，无需维护复杂的流式协议。

### Decision 3: 三级授权模型

**Level 0 — 预授权自动签名 (Allowance)**:
- Signer 维护一个 `AllowancePolicy` 对象
- 默认: `maxPerTxUsd: 100, maxDailyUsd: 500, allowedTokens: ["ETH", "USDC", "USDT"], allowedRecipients: [...whitelist]`
- 匹配策略的交易 Signer 直接签名，无用户交互
- 日累计使用整数分(cents)计算，复用 security-audit 的精度修复

**Level 1 — 快速确认**:
- 超出预授权但在合理范围 ($100-$1000)
- Signer 通过 AuthProvider 弹出确认界面
- 用户输入 PIN 或生物识别确认 (~2s)

**Level 2 — 完整审批**:
- 大额交易 (>$1000) 或修改预授权策略
- 展示完整交易详情，用户逐项检查后输入 PIN

**理由**: Level 0 保证 Agent 在日常操作中的流畅性，Level 1/2 为人类提供安全屏障。阈值可配置。

### Decision 4: AuthProvider 适配器模式

**选择**: 定义 `AuthProvider` 接口，三种实现：

```typescript
interface AuthProvider {
  requestPin(context: SigningContext): Promise<string>;
  requestConfirm(context: SigningContext): Promise<boolean>;
  requestSecretInput(prompt: string): Promise<string>;  // 私钥/助记词输入
  notify(message: string): void;  // 交易通知
}
```

| 实现 | 场景 | 交互方式 |
|---|---|---|
| `TuiAuthProvider` | CLI | readline on /dev/tty (独立于 Agent 的 stdin) |
| `GuiAuthProvider` | 桌面应用 | 原生对话框 (Electron dialog / node-notifier) |
| `WebhookAuthProvider` | 服务器 daemon | HTTP POST 到手机 App / Telegram Bot，轮询结果 |

**理由**: 适配器模式使核心 Signer 逻辑与 UI 解耦。CLI 模式通过 `/dev/tty` 直接读取终端输入，完全绕过 Agent 进程的 stdin/stdout。

### Decision 5: Session 管理

**选择**: 首次 `unlock` 时用 PIN 解密 keystore，将 `derivedKey` 缓存在 Signer 内存中。后续签名直接使用缓存。TTL 默认 30 分钟，可配置。

- `unlock` → 输入 PIN → scrypt 派生 derivedKey → 缓存
- 签名时 → 使用缓存的 derivedKey 直接解密私钥 → 签名 → 清除私钥
- TTL 到期或 `lock` → `derivedKey.fill(0)` → 回到锁定态

**理由**: 避免每次签名都做 scrypt 运算 (~200ms)。derivedKey 仅在 Signer 进程内存中，Agent 进程不可达。

### Decision 6: Tool 参数变更

移除敏感参数，Tool 变为纯粹的意图声明：

| Tool | 旧参数 | 新参数 |
|---|---|---|
| `wallet_create` | `{password}` | `{}` |
| `wallet_import` | `{private_key, password}` | `{}` 或 `{keystoreFile}` |
| `wallet_send` | `{to, amount, token, chain}` | 不变 |

Tool 内部不再调用 `keystore.signTransaction`，改为通过 `SignerClient` IPC 调用。

### Decision 7: 目录结构

```
src/
  signer/
    daemon.ts          — Signer 主进程入口
    ipc-server.ts      — Unix Socket JSON-RPC 服务端
    ipc-client.ts      — Tool 进程使用的客户端
    session.ts         — 解锁态管理 + derivedKey 缓存
    allowance.ts       — 预授权策略检查与消耗
    auth-provider.ts   — AuthProvider 接口定义
    tui-auth.ts        — CLI TUI 实现
    gui-auth.ts        — GUI 对话框实现 (可选)
    webhook-auth.ts    — Webhook 推送实现 (可选)
  keystore.ts          — 不变，但只由 Signer 进程 import
  ...
```

## Risks / Trade-offs

- **[Signer 进程未启动]** → Tool 调用 IPC 超时 → 返回清晰错误："Signer not running. Start with `claw-signer start`"。可选：Tool 进程自动 spawn Signer。
- **[Unix Socket 权限]** → Socket 文件创建时设置 0600，仅当前用户可连接。
- **[Signer 进程被 kill]** → derivedKey 随进程死亡自动清除（OS 释放内存）。重启后需要重新 unlock。
- **[TUI 模式下 /dev/tty 不可用]** → 在 Docker 等无 TTY 环境中回退到 WebhookAuthProvider 或环境变量 PIN。
- **[性能开销]** → IPC 增加 ~1ms 延迟，对链上交易场景可忽略。签名频繁时 session 缓存避免重复 scrypt。
- **[Agent 伪造交易]** → Level 1/2 确认界面展示完整交易详情，用户可核实。Level 0 受预授权策略限制，损失上限为日限额。
- **[预授权策略被 Agent 请求修改]** → `set_allowance` 固定为 Level 2 审批，必须用户完整确认。Agent 无法自行提升预算。
- **[BREAKING 变更]** → 现有测试需要适配 IPC mock。提供迁移期：旧参数暂时可用但打印 deprecation 警告。

## Open Questions

- Signer 进程是否应该自动管理生命周期（Tool 进程自动 spawn），还是要求用户手动启动？
- WebhookAuthProvider 的具体推送目标（Telegram Bot / 自定义 HTTP endpoint）在第一版需要支持哪些？
