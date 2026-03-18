## 1. Signer 核心基础设施

- [x] 1.1 创建 `src/signer/` 目录结构
- [x] 1.2 实现 `src/signer/ipc-protocol.ts`：定义 JSON-RPC 2.0 请求/响应类型和方法枚举
- [x] 1.3 实现 `src/signer/ipc-server.ts`：Unix Domain Socket 服务端，监听、解析 JSON-RPC、分发到 handler
- [x] 1.4 实现 `src/signer/ipc-client.ts`：Unix Domain Socket 客户端，连接、发送请求、等待响应、超时处理
- [x] 1.5 实现 `src/signer/session.ts`：derivedKey 缓存管理，unlock/lock/TTL 过期/零填充清除
- [x] 1.6 实现 `src/signer/daemon.ts`：Signer 守护进程入口，加载 keystore、启动 IPC 服务、信号处理（SIGTERM/SIGINT 清除 derivedKey + 删除 socket 文件）
- [x] 1.7 单元测试：IPC 协议序列化/反序列化、session TTL 过期和零填充

## 2. AuthProvider 适配器

- [x] 2.1 定义 `src/signer/auth-provider.ts`：`AuthProvider` 接口（requestPin, requestConfirm, requestSecretInput, notify）和 `SigningContext` 类型
- [x] 2.2 实现 `src/signer/tui-auth.ts`：`TuiAuthProvider`，通过 `/dev/tty` 直接读取用户输入（独立于 Agent stdin）
- [x] 2.3 实现 `src/signer/gui-auth.ts`：`GuiAuthProvider` 骨架，使用 `node-notifier` 或原生对话框（桌面场景）
- [x] 2.4 实现 `src/signer/webhook-auth.ts`：`WebhookAuthProvider` 骨架，HTTP POST 通知 + 轮询响应
- [x] 2.5 单元测试：TuiAuthProvider mock 测试（模拟 tty 输入）

## 3. Allowance 预授权策略

- [x] 3.1 实现 `src/signer/allowance.ts`：AllowancePolicy 定义、默认策略（maxPerTxUsd:100, maxDailyUsd:500, allowedTokens, allowedRecipients）
- [x] 3.2 实现 allowance 检查逻辑：per-tx 限额、日累计（整数分cents）、token 白名单、recipient 白名单
- [x] 3.3 实现 allowance 持久化：安全写入/读取（复用 secureWriteFile）
- [x] 3.4 实现 `set_allowance` IPC handler：必须 Level 2 审批
- [x] 3.5 实现三级授权判定：Level 0 自动签、Level 1 快速确认、Level 2 完整审批
- [x] 3.6 单元测试：allowance 策略匹配、daily 累计精度、Level 判定逻辑

## 4. Signer IPC Handlers

- [x] 4.1 实现 `get_address` handler：从 keystore 返回地址，无需认证
- [x] 4.2 实现 `create_wallet` handler：通过 AuthProvider 收集 PIN → generateWallet → encryptKey → saveKeystore → 返回地址
- [x] 4.3 实现 `import_wallet` handler（交互模式）：通过 AuthProvider 收集私钥和 PIN → encryptKey → saveKeystore → 返回地址
- [x] 4.4 实现 `import_wallet` handler（keystore 文件模式）：读取文件 → AuthProvider 收集旧密码和新 PIN → 解密 → 重新加密 → 保存
- [x] 4.5 实现 `sign_transaction` handler：检查 allowance → 决定授权级别 → 可能弹 UI → 解密签名 → 清除私钥 → 返回 signedTx
- [x] 4.6 实现 `sign_message` handler：类似 sign_transaction，Level 1 确认
- [x] 4.7 实现 `unlock` / `lock` handlers：session 管理
- [x] 4.8 实现 `get_allowance` handler：返回当前策略
- [x] 4.9 单元测试：每个 handler 的正常路径和错误路径（使用 mock AuthProvider）

## 5. 签名审计日志

- [x] 5.1 实现 `src/signer/audit-log.ts`：记录每笔签名操作（时间戳、收件人、金额、token、链、授权级别、结果）
- [x] 5.2 审计日志使用 secureWriteFile 持久化
- [x] 5.3 单元测试：审计日志记录和查询

## 6. Tool 层改造

- [x] 6.1 修改 `src/tools/wallet-create.ts`：移除 `password` 参数，改为通过 SignerClient IPC 调用 `create_wallet`
- [x] 6.2 修改 `src/tools/wallet-import.ts`：移除 `private_key` 和 `password` 参数，改为通过 SignerClient IPC 调用 `import_wallet`
- [x] 6.3 修改 `src/tools/wallet-send.ts`：内部签名改为 SignerClient IPC 调用
- [x] 6.4 修改 `src/transfer.ts`：`TransferService` 构造去掉 `password`，签名改为 IPC 委托（接受 `SignerClient` 替代 `keystore+password`）
- [x] 6.5 修改 `src/index.ts`：`ClawWallet` 移除 `password` 字段，增加 `SignerClient` 连接管理
- [x] 6.6 确保所有 Tool 参数 schema 中不含 `password` 或 `private_key`

## 7. Plugin 生命周期适配

- [x] 7.1 `ClawWallet.initialize()` 增加 Signer 连接检查，返回清晰错误
- [x] 7.2 `ClawWallet.shutdown()` 断开 Signer 连接
- [x] 7.3 可选：支持 auto-spawn Signer 进程（配置项）

## 8. 测试适配与新增

- [x] 8.1 创建 `tests/signer/` 目录
- [x] 8.2 实现 Signer 集成测试：启动 daemon → IPC 创建钱包 → IPC 签名 → 验证签名有效
- [x] 8.3 实现 Allowance 安全测试：小额自动签名、超限触发确认、日累计精度
- [x] 8.4 实现隔离性测试：验证 Tool 进程无法访问 keystore 内容、无法获取密码
- [x] 8.5 适配现有 `tests/keystore.test.ts`：使用 IPC mock 或直接测试 keystore 函数（仅 Signer 内部使用）
- [x] 8.6 适配现有 `tests/e2e.test.ts`：使用内嵌 Signer 或 mock SignerClient
- [x] 8.7 适配现有安全测试 `tests/security/*.test.ts`

## 9. CLI 入口

- [x] 9.1 创建 `bin/claw-signer.ts`：CLI 入口 `claw-signer start [--auth tui|gui|webhook] [--socket-path] [--ttl]`
- [x] 9.2 `package.json` 增加 `bin` 字段注册 `claw-signer` 命令
- [x] 9.3 添加 `claw-signer` 到构建配置

## 10. 回归验证

- [x] 10.1 运行全部现有测试，确认零回归（或已适配通过）
- [x] 10.2 运行全部新增 Signer 测试，确认全部通过
- [x] 10.3 运行 TypeScript 类型检查，确认无类型错误
- [x] 10.4 运行构建，确认 ESM + CJS 输出正常
