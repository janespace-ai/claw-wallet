## Context

当前 Signer 有三种 AuthProvider：TuiAuthProvider（终端，已实现）、GuiAuthProvider（空壳）、WebhookAuthProvider（空壳）。桌面环境下用户需要图形化的密码输入弹窗和交易确认界面。同时 `generateWallet()` 使用 `randomBytes(32)` 直接生成私钥，不支持 BIP-39 助记词备份。

Agent 与 Signer 通过 IPC 通信，交互是同步阻塞的——Agent 发出 RPC 后等待 Signer 返回。Signer 在等待用户输入期间阻塞 RPC 响应，Agent 在此期间无法给用户更多反馈。

## Goals / Non-Goals

**Goals:**
- 实现跨平台 GUI 密码弹窗（macOS / Windows / Linux）
- BIP-39 助记词生成和 BIP-44 派生标准路径
- 助记词安全导出（仅 GUI 展示，不经 IPC）
- Agent 通过 Tool 描述预判弹窗，预先告知用户

**Non-Goals:**
- 不做 Electron/Tauri 桌面应用（保持纯 Node.js CLI）
- 不做旧钱包助记词迁移（旧钱包无助记词，export_mnemonic 返回错误）
- 不做 WebhookAuthProvider 实现（后续独立 change）
- 不做手机端相关功能（Phase 2 范畴）

## Decisions

### 1. GUI 技术: localhost HTTP + 系统浏览器

**选择**: Signer 启动临时 HTTP server (127.0.0.1:随机端口)，用 `open` 命令打开系统浏览器展示 HTML 页面。

**替代方案:**
- AppleScript / PowerShell 原生对话框 — 自定义能力极弱，无法做密码强度条、交易详情展示
- node-dialog / zenity — 依赖系统安装额外包，Linux 下不可靠
- Electron — 引入过重依赖，不适合 CLI 工具

**理由**: 零原生依赖、完全可定制 UI、跨平台（所有 OS 都有浏览器）。密码只在 localhost 传输。

### 2. HTTP 安全机制: 一次性 token + 单次响应

每次弹窗请求：
1. 生成 `crypto.randomUUID()` 作为 session token
2. 浏览器 URL: `http://127.0.0.1:{port}/dialog?token={uuid}`
3. 页面提交时 POST 携带 token
4. Server 验证 token 匹配后立即关闭监听
5. Token 使用一次即失效

防护：其他本地进程无法猜到 token，无法注入或截获密码。

### 3. BIP-39 实现: @scure/bip39 + @scure/bip32

**选择**: noble 系列加密库（@scure/bip39、@scure/bip32）。

**替代方案:**
- ethers.js HDNode — 会引入整个 ethers 依赖
- bitcoinjs/bip39 — 较老，有 Buffer polyfill 问题

**理由**: 纯 JS、零 native 依赖、审计过的密码学库、与 viem 生态一致（viem 底层也用 noble）。

### 4. 助记词存储: 独立加密文件 mnemonic.enc

**选择**: 助记词用与 keystore 相同的密码加密，存为 `mnemonic.enc`（AES-256-GCM + scrypt KDF），与 `keystore.json` 同目录。

**替代方案:**
- 存在 keystore.json 内部 — 破坏标准 V3 格式兼容性
- 不存储，只在创建时展示一次 — 用户可能错过备份

**理由**: 独立存储保持 keystore V3 兼容性；用户随时可通过 `export_mnemonic` 安全查看；删除 `mnemonic.enc` 即可"销毁"助记词只保留私钥。

### 5. 助记词导出安全: GUI-only 展示

`export_mnemonic` RPC 流程：
1. Signer 收到请求 → 弹出密码输入 GUI
2. 用户输入密码 → 解密 mnemonic.enc
3. Signer 弹出第二个 GUI 页面展示助记词（允许复制）
4. 页面设 60 秒自动关闭
5. IPC 返回 `{ exported: true }` — 无助记词内容

助记词全程不经过 IPC，Agent 无法获取。

### 6. Agent 预判: Tool 描述驱动

同步阻塞模式下，Agent 通过 Tool 的 `description` 字段得知操作会触发弹窗，在调用 RPC 前先回话告知用户。

示例 Tool 描述：
```
wallet_create: "创建钱包。会弹出密码设置窗口，请提前告知用户在弹窗中输入密码。"
wallet_send: "发送交易。超出自动授权时会弹出确认窗口，请提前告知用户。"
wallet_export_mnemonic: "导出助记词。助记词通过安全弹窗展示，不会返回给你。请告知用户在弹窗中查看。"
```

### 7. GUI 页面类型

| 页面 | 用途 | 内容 |
|------|------|------|
| password-create | 创建/导入钱包 | 双密码输入 + 实时强度条 + 校验反馈 |
| password-input | 解锁/交易确认/授权 | 单密码输入 + 操作描述 |
| tx-confirm | 交易确认 (Level 1) | 交易详情 + 确认/拒绝按钮 |
| mnemonic-display | 助记词展示 | 12 词网格 + 复制按钮 + 60s 倒计时 |

### 8. AuthProvider 接口扩展

新增 `displaySecretToUser(title, secret)` 方法：
- TUI: 直接打印到 /dev/tty（已有类似能力）
- GUI: 弹出浏览器展示页面
- 助记词展示走这个通道，不走 IPC 返回值

## Risks / Trade-offs

- **[浏览器可能未安装]** → 极端 Linux 服务器无浏览器时回退到 TUI 提示；GuiAuthProvider 构造时检测 `open` 命令可用性
- **[弹窗被浏览器拦截]** → 使用 `child_process.exec` 直接调用 `open`/`xdg-open`/`start`，不会被浏览器弹窗拦截器阻止
- **[密码通过 HTTP 传输]** → 仅 127.0.0.1 本地回环，不经过网络；一次性 token 防其他进程访问
- **[旧钱包无助记词]** → `export_mnemonic` 对无 `mnemonic.enc` 的钱包返回清晰错误提示，不影响现有功能
- **[BIP-39 增加新依赖]** → @scure 系列轻量且与 viem 生态一致，维护活跃
