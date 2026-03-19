## 0. Monorepo 目录重构与老代码清理

- [x] 0.1 将 src/ 重命名为 agent/ 并更新所有 import 路径和 tsconfig.json 配置
- [x] 0.2 创建 server/ 目录结构 (go.mod, cmd/relay/, internal/hub/, internal/pairing/)
- [x] 0.3 创建 desktop/ 目录结构 (package.json, tsconfig.json, src/main/, src/renderer/, src/shared/, electron-builder.yml)
- [x] 0.4 删除 bin/claw-signer.ts (Signer 独立 CLI 入口)
- [x] 0.5 删除 agent/keystore.ts 和 tests/keystore.test.ts (Keystore V3 加解密)
- [x] 0.6 删除 agent/mnemonic.ts 和 tests/mnemonic.test.ts (本地助记词管理)
- [x] 0.7 删除 agent/signer/auth-provider.ts (AuthProvider 接口定义)
- [x] 0.8 删除 agent/signer/gui-auth.ts 和 agent/signer/gui-pages/ 整个目录 (GUI AuthProvider)
- [x] 0.9 删除 agent/signer/tui-auth.ts (TUI AuthProvider)
- [x] 0.10 删除 agent/signer/webhook-auth.ts (Webhook AuthProvider)
- [x] 0.11 删除 agent/signer/password-strength.ts 和 tests/signer/password-strength.test.ts
- [x] 0.12 删除 agent/signer/rate-limiter.ts 和 tests/signer/rate-limiter.test.ts
- [x] 0.13 删除 agent/signer/session.ts 和 tests/signer/session.test.ts
- [x] 0.14 删除 agent/signer/allowance.ts 和 tests/signer/allowance.test.ts
- [x] 0.15 删除 agent/signer/audit-log.ts
- [x] 0.16 删除 agent/signer/daemon.ts (本地密钥 Signer, 将重写为 relay-client.ts)
- [x] 0.17 删除 tests/signer/auth-hardening.test.ts 和 tests/signer/gui-mnemonic.test.ts
- [x] 0.18 删除 agent/tools/wallet-export-mnemonic.ts (助记词导出迁移到 Electron App)
- [x] 0.19 从根 package.json 移除 @scure/bip39, @scure/bip32 依赖 (将在 desktop/package.json 添加)
- [x] 0.20 更新 agent/signer/index.ts: 移除所有已删除模块的导出, 仅保留 IPC 和 relay client
- [x] 0.21 更新 agent/index.ts: 移除 wallet_export_mnemonic 注册, 调整 tool 数量
- [x] 0.22 修复所有因重命名和删除产生的 TypeScript 编译错误和 import 引用
- [x] 0.23 更新 tsup.config.ts 和 package.json 中的入口路径 (src/ -> agent/)
- [x] 0.24 更新现有测试以适配新架构 (e2e.test.ts, integration.test.ts 等)

## 1. Go Relay Server (server/)

- [x] 1.1 初始化 Go 项目 (server/go.mod, 基础目录结构)
- [x] 1.2 实现 WebSocket Hub: 按 pairId 路由消息, 注入 sourceIP 字段
- [x] 1.3 实现短码配对 HTTP API: POST /pair/create, GET /pair/{shortCode}, 内存缓存 + 10min TTL
- [x] 1.4 实现 Rate Limiting: 配对创建 10次/分钟/IP, WebSocket 消息 100条/秒/连接
- [x] 1.5 添加 Relay 单元测试和集成测试
- [x] 1.6 编写 Dockerfile 和部署文档

## 2. E2EE 通信层 (desktop/src/shared/ + agent/signer/ 共享)

- [x] 2.1 实现 X25519 ECDH 密钥交换 (使用 @noble/curves)
- [x] 2.2 实现 HKDF-SHA256 派生 AES-256-GCM 对称密钥
- [x] 2.3 实现 AES-256-GCM 消息加解密 + 递增 nonce 防重放
- [x] 2.4 实现反重放保护: 序列号校验、间隔过大检测 (>100 拒绝)
- [x] 2.5 实现 WebSocket 传输层: 连接管理、指数退避自动重连、断线重握手
- [x] 2.6 添加 E2EE 通信层单元测试

## 3. Agent 侧 Signer 改造 (agent/signer/ 轻量 Relay Client)

- [x] 3.1 新建 agent/signer/relay-client.ts: E2EE Relay Client, 替代 daemon.ts
- [x] 3.2 实现 wallet_pair RPC 方法: 短码解析、E2EE 握手、machineId 交换、配对信息持久化
- [x] 3.3 实现 sign_transaction 转发: 通过 E2EE 通道发送至 Electron App, 等待响应 (120s 超时)
- [x] 3.4 实现 get_address 从配对配置文件读取
- [x] 3.5 实现 create_wallet / import_wallet 返回引导消息 (指向 Electron App)
- [x] 3.6 实现 Electron App 离线错误处理
- [x] 3.7 添加改造后的 Signer 单元测试和集成测试

## 4. Electron App — 项目脚手架与基础框架 (desktop/)

- [x] 4.1 初始化 Electron 项目 (electron-forge 或 electron-builder, TypeScript 配置)
- [x] 4.2 配置 Electron 安全: 禁用渲染进程 nodeIntegration, 使用 contextBridge + preload
- [x] 4.3 实现主进程/渲染进程 IPC 通信架构
- [x] 4.4 实现系统托盘: 最小化到托盘、状态图标 (已连接/已断开)、托盘菜单
- [x] 4.5 配置打包和分发 (macOS .dmg, Windows .exe, Linux .AppImage)

## 5. Electron App — 密钥管理 (desktop/src/main/)

- [x] 5.1 实现 BIP-39 助记词生成 (12 词) 和 BIP-44 私钥派生
- [x] 5.2 实现 AES-256-GCM 加密存储 (Scrypt KDF 密码派生)
- [x] 5.3 实现创建钱包 UI: 密码输入 + 确认, 强密码校验, 助记词显示 + 备份确认
- [x] 5.4 实现导入钱包 UI: 助记词导入 / 私钥导入, 密码设置
- [x] 5.5 实现助记词导出 UI: 密码验证后显示 (不使用生物识别), 一次性查看
- [x] 5.6 添加密钥管理单元测试

## 6. Electron App — 生物识别认证 (desktop/src/main/)

- [x] 6.1 集成 macOS Touch ID: systemPreferences.promptTouchID() + Keychain 存储派生密钥
- [x] 6.2 集成 Windows Hello: native module + Credential Locker 存储派生密钥
- [x] 6.3 实现 Linux 密码降级: 使用 Electron safeStorage + libsecret
- [x] 6.4 实现首次启动密码必须输入, 后续启动生物识别解锁
- [x] 6.5 实现生物识别失败降级为密码输入
- [x] 6.6 实现设置中启用/禁用生物识别选项
- [x] 6.7 添加生物识别流程测试 (mock 平台 API)

## 7. Electron App — 签名引擎与 Allowance (desktop/src/main/)

- [x] 7.1 实现 Allowance 预算引擎: 日限额、单笔限额、Token 白名单、地址白名单
- [x] 7.2 实现自动签名逻辑: 预算内静默签名 + 清除内存密钥
- [x] 7.3 实现交易确认弹窗 UI: 交易详情展示、确认/拒绝按钮
- [x] 7.4 实现 Allowance 设置 UI: 限额配置、Token 列表管理
- [x] 7.5 实现签名后 Allowance 预算扣减和日期重置
- [x] 7.6 添加签名引擎和 Allowance 测试

## 8. Electron App — 配对与通信 (desktop/src/main/ + desktop/src/shared/)

- [x] 8.1 集成 E2EE 通信层 (复用第 2 组的共享库)
- [x] 8.2 实现配对码生成 UI: 生成短码、倒计时显示 (10min)、复制按钮
- [x] 8.3 实现配对确认弹窗: 显示 Agent 设备信息、需要生物识别/密码确认
- [x] 8.4 实现已配对设备管理 UI: 设备列表、状态显示、撤销配对
- [x] 8.5 实现配对信息加密持久化
- [x] 8.6 实现 WebSocket 连接管理: 自动连接 Relay、断线重连、状态同步到 UI

## 9. Electron App — 安全监控 (desktop/src/main/)

- [x] 9.1 实现 IP 变化检测: 对比 Relay 注入的 sourceIP 与已记录 IP
- [x] 9.2 实现设备指纹绑定: 配对时记录, 请求时校验
- [x] 9.3 实现安全告警 UI: IP 变化告警, 三级响应 (冻结/单次允许/信任新设备)
- [x] 9.4 实现冻结模式: 30 分钟内拒绝所有签名, 倒计时显示
- [x] 9.5 实现同机检测: machineId 对比, 强制告警弹窗 (需手动输入确认), 持久风险标记
- [x] 9.6 实现安全事件审计日志 (本地存储)
- [x] 9.7 添加安全监控测试

## 10. Electron App — 锁屏策略 (desktop/src/main/)

- [x] 10.1 实现便利模式 (默认): 闲置保留内存密钥, 预算内自动签名继续
- [x] 10.2 实现严格模式: 闲置超时后清除内存密钥, 拒签直到重新认证
- [x] 10.3 实现手动锁定: 快捷键 + UI 按钮, 立即清除内存密钥
- [x] 10.4 实现系统锁屏联动: 系统休眠/锁屏时清除密钥, 唤醒后需认证
- [x] 10.5 实现锁屏模式切换设置 UI
- [x] 10.6 添加锁屏策略测试

## 11. Agent Tool 更新 (agent/tools/)

- [x] 11.1 新增 wallet_pair Tool: 接收配对码, 调用 Signer wallet_pair RPC
- [x] 11.2 更新 wallet_create Tool: 返回引导消息 (在 Electron App 中创建)
- [x] 11.3 更新 wallet_import Tool: 返回引导消息 (在 Electron App 中导入)
- [x] 11.4 更新 wallet_send Tool 描述: 反映新的远程签名流程
- [x] 11.5 注册新 Tool, 更新 agent/index.ts (移除 wallet_export_mnemonic)

## 12. 端到端测试与文档

- [x] 12.1 编写端到端集成测试: 配对 -> 自动签名 -> 确认签名 -> IP 变化告警完整流程
- [x] 12.2 编写 Relay 压力测试: 并发连接、消息吞吐、短码过期
- [x] 12.3 更新 PHASE2-MOBILE-SIGNER.md 文档: 标记 Phase 2A Electron App 已实施
- [x] 12.4 编写 Electron App 用户指南: 安装、首次配对、日常使用、故障排除
- [x] 12.5 更新项目 README: 添加 Phase 2 架构说明和使用流程
