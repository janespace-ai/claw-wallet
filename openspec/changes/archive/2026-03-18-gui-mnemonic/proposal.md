## Why

当前 Signer 的用户交互仅支持 TUI（终端文本输入），在 macOS/Windows 等图形桌面环境下体验很差——用户看不到弹窗提示，Agent 也无法预先告知用户"请在弹窗中输入密码"。同时钱包使用 `randomBytes(32)` 直接生成私钥，不支持 BIP-39 助记词，用户无法标准化地备份和恢复钱包。

## What Changes

- **实现 `GuiAuthProvider`**：基于 localhost HTTP + 浏览器弹窗，提供跨平台的密码输入对话框、交易确认界面
- **BIP-39 助记词支持**：钱包创建改用 BIP-39 生成助记词 → BIP-44 派生私钥的标准流程
- **助记词安全导出**：新增 `export_mnemonic` RPC 方法，助记词仅通过 GUI 弹窗展示，不经过 IPC 返回给 Agent
- **Tool 描述增强**：在 OpenClaw Tool 描述中注明哪些操作会触发弹窗，Agent 据此预先告知用户

## Capabilities

### New Capabilities
- `gui-auth-provider`: 基于 localhost HTTP + 浏览器的图形化 AuthProvider 实现，包括密码输入、二次确认、交易详情展示、助记词安全展示弹窗
- `bip39-mnemonic`: BIP-39 助记词生成、BIP-44 派生、加密存储（mnemonic.enc）、安全导出

### Modified Capabilities
- `signer-daemon`: 新增 `export_mnemonic` RPC 方法；`create_wallet` 改为 BIP-39 路径生成
- `signer-auth`: `GuiAuthProvider` 从空壳变为完整实现；AuthProvider 接口新增 `displaySecretToUser` 方法用于安全展示助记词
- `wallet-core`: `generateWallet` 改为 BIP-39 + BIP-44 派生路径

## Impact

- **新增依赖**: `@scure/bip39`, `@scure/bip32` (noble 系列，纯 JS，无 native 依赖)
- **代码变更**: `src/keystore.ts`, `src/signer/gui-auth.ts`, `src/signer/daemon.ts`, `src/signer/auth-provider.ts`
- **新增文件**: GUI HTML/CSS 模板、`mnemonic.enc` 加密存储逻辑
- **兼容性**: 旧钱包（无助记词）仍可正常使用，`export_mnemonic` 对旧钱包返回错误提示
- **安全**: 助记词绝不经过 IPC 传输；localhost HTTP 使用一次性 token + 127.0.0.1 绑定
