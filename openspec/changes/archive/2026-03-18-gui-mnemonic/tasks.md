## 1. BIP-39 助记词模块

- [x] 1.1 安装依赖 `@scure/bip39` 和 `@scure/bip32`
- [x] 1.2 创建 `src/mnemonic.ts` — 实现 `generateWalletWithMnemonic(): { mnemonic, privateKey, address }`
- [x] 1.3 实现 BIP-44 派生路径 `m/44'/60'/0'/0/0`
- [x] 1.4 实现助记词加密存储 `encryptMnemonic(mnemonic, password): Buffer` (AES-256-GCM + scrypt)
- [x] 1.5 实现助记词解密 `decryptMnemonic(encrypted, password): string`
- [x] 1.6 实现 `saveMnemonic(encrypted, filePath)` 和 `loadMnemonic(filePath)` — 权限 0600
- [x] 1.7 编写助记词模块单元测试 `tests/mnemonic.test.ts`

## 2. GuiAuthProvider — HTTP Server 基础

- [x] 2.1 创建 `src/signer/gui-auth.ts` — 重写 GuiAuthProvider 类
- [x] 2.2 实现 `startDialogServer(htmlContent, token): Promise<{ port, resultPromise }>` — 启动 127.0.0.1 临时 HTTP server
- [x] 2.3 实现一次性 token 验证逻辑 — GET 时检查 token 参数，POST 时验证 token 匹配
- [x] 2.4 实现跨平台浏览器打开 — macOS: `open`, Windows: `start`, Linux: `xdg-open`，失败时打印 URL 到 stderr
- [x] 2.5 实现 server 生命周期管理 — 收到有效 POST 或超时后关闭 server 释放端口

## 3. GUI 页面模板

- [x] 3.1 创建 `src/signer/gui-pages/password-create.html` — 双密码输入 + 实时强度条 + 校验反馈
- [x] 3.2 创建 `src/signer/gui-pages/password-input.html` — 单密码输入 + 操作描述
- [x] 3.3 创建 `src/signer/gui-pages/tx-confirm.html` — 交易详情展示 + 确认/拒绝按钮
- [x] 3.4 创建 `src/signer/gui-pages/mnemonic-display.html` — 12 词网格 + 复制按钮 + 60s 倒计时 + no-cache 头

## 4. GuiAuthProvider — 接口实现

- [x] 4.1 实现 `requestPin(context)` — 启动 password-input 页面，返回用户输入的密码
- [x] 4.2 实现 `requestConfirm(context)` — 启动 tx-confirm 页面，返回用户确认结果
- [x] 4.3 实现 `requestPasswordWithConfirmation(context, validator)` — 启动 password-create 页面，服务端校验强度后返回密码
- [x] 4.4 实现 `requestSecretInput(prompt)` — 启动通用密码输入页面
- [x] 4.5 实现 `displaySecretToUser(title, secret)` — 启动 mnemonic-display 页面，60s 超时后自动关闭
- [x] 4.6 实现 `notify(message)` — 系统通知 (console.log fallback)

## 5. AuthProvider 接口扩展

- [x] 5.1 在 `AuthProvider` 接口中添加 `displaySecretToUser(title: string, secret: string): Promise<void>` 方法
- [x] 5.2 在 `TuiAuthProvider` 中实现 `displaySecretToUser` — 输出到 `/dev/tty`
- [x] 5.3 更新 TestAuthProvider (tests) 实现新接口方法

## 6. Signer Daemon 集成

- [x] 6.1 修改 `handleCreateWallet` — 调用 `generateWalletWithMnemonic()` 替代 `generateWallet()`，加密保存助记词
- [x] 6.2 新增 `handleExportMnemonic` RPC 方法 — 密码验证 + 速率限制 + 通过 AuthProvider 展示助记词
- [x] 6.3 在 `handleRequest` 路由中注册 `export_mnemonic` 方法
- [x] 6.4 确保 `export_mnemonic` 的 IPC 返回值不包含助记词内容

## 7. Tool 描述更新

- [x] 7.1 在 `src/tools.ts` (或等效文件) 中更新 `wallet_create` Tool 描述 — 注明会弹出密码设置窗口
- [x] 7.2 更新 `wallet_send` Tool 描述 — 注明可能弹出确认窗口
- [x] 7.3 新增 `wallet_export_mnemonic` Tool — 注明助记词通过安全弹窗展示，不返回给 Agent

## 8. 测试

- [x] 8.1 编写 BIP-39 生成 + BIP-44 派生测试 — 助记词确定性派生相同地址
- [x] 8.2 编写助记词加密/解密测试 — 正确密码解密成功，错误密码失败
- [x] 8.3 编写 GuiAuthProvider 单元测试 — HTTP server 启动/关闭、token 验证
- [x] 8.4 编写 export_mnemonic 集成测试 — IPC 返回值不含助记词、无 mnemonic.enc 时返回错误
- [x] 8.5 编写 create_wallet 集成测试 — 确认同时生成 keystore.json 和 mnemonic.enc
- [x] 8.6 运行完整测试套件确认无回归
