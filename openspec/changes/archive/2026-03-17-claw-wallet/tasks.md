## 1. 项目初始化

- [x] 1.1 初始化 npm 项目，配置 package.json（name: claw-wallet, type: module, TypeScript 相关配置）
- [x] 1.2 添加核心依赖：viem, typescript, tsup (打包)
- [x] 1.3 添加开发依赖：vitest, @types/node
- [x] 1.4 配置 tsconfig.json（strict mode, ESM, paths）
- [x] 1.5 创建项目目录结构（src/, src/tools/, tests/）
- [x] 1.6 创建 src/types.ts 定义共享类型（WalletConfig, KeystoreV3, PolicyConfig, Contact, TxRecord 等）

## 2. 密钥管理 (wallet-core)

- [x] 2.1 实现 keystore.ts：generateWallet() — 生成随机私钥 + 地址
- [x] 2.2 实现 keystore.ts：encryptKey() — 使用 scrypt + AES-256-GCM 加密私钥为 Keystore V3 格式
- [x] 2.3 实现 keystore.ts：decryptKey() — 用主密码解密 keystore，返回私钥
- [x] 2.4 实现 keystore.ts：signTransaction() — 解密→签名→覆写内存→返回签名结果
- [x] 2.5 实现 keystore.ts：saveKeystore() / loadKeystore() — 读写 ~/.openclaw/wallet/keystore.json
- [x] 2.6 实现 keystore.ts：getAddress() — 从 keystore 读取地址（无需解密）
- [x] 2.7 编写 keystore 模块的单元测试

## 3. 链适配器 (wallet-core)

- [x] 3.1 实现 chain.ts：创建 ChainAdapter 类，封装 viem publicClient/walletClient
- [x] 3.2 实现 chain.ts：支持 Base 和 Ethereum mainnet 的链配置
- [x] 3.3 实现 chain.ts：getBalance() — 查询 ETH 余额
- [x] 3.4 实现 chain.ts：getTokenBalance() — 查询 ERC-20 余额（带 decimals 格式化）
- [x] 3.5 实现 chain.ts：estimateGas() — Gas 估算
- [x] 3.6 实现 chain.ts：broadcastTransaction() — 广播已签名交易并等待确认
- [x] 3.7 实现 chain.ts：支持自定义 RPC 端点配置
- [x] 3.8 编写 chain 模块的单元测试

## 4. 转账功能 (token-transfer)

- [x] 4.1 实现 transfer.ts：sendETH() — 构建 ETH 转账交易
- [x] 4.2 实现 transfer.ts：sendERC20() — 构建 ERC-20 transfer 调用（支持 symbol 或合约地址）
- [x] 4.3 实现 transfer.ts：预检查余额（ETH 和 token 余额 + gas 费用）
- [x] 4.4 实现 transfer.ts：集成 Policy Engine 检查（转账前过策略）
- [x] 4.5 实现 transfer.ts：集成联系人解析（支持按名称转账）
- [x] 4.6 实现 transfer.ts：交易状态追踪（确认/失败/revert reason）
- [x] 4.7 编写 transfer 模块的单元测试

## 5. 策略引擎 (policy-engine)

- [x] 5.1 实现 policy.ts：loadPolicy() / savePolicy() — 读写 policy.json
- [x] 5.2 实现 policy.ts：createDefaultPolicy() — 生成默认策略（100 USD/笔，500 USD/日，supervised 模式）
- [x] 5.3 实现 policy.ts：checkTransaction() — 执行所有策略检查（限额、白名单、模式）
- [x] 5.4 实现 policy.ts：每日累计限额追踪（24 小时滚动窗口）
- [x] 5.5 实现 policy.ts：审批队列管理 — addToQueue(), approve(), reject(), list(), autoExpire()
- [x] 5.6 实现 policy.ts：updatePolicy() — 更新策略配置
- [x] 5.7 编写 policy 模块的单元测试

## 6. 联系人系统 (contacts)

- [x] 6.1 实现 contacts.ts：addContact() — 添加/更新联系人（支持多链地址）
- [x] 6.2 实现 contacts.ts：listContacts() — 列出所有联系人
- [x] 6.3 实现 contacts.ts：resolveContact() — 按名称+链解析地址
- [x] 6.4 实现 contacts.ts：removeContact() — 删除联系人
- [x] 6.5 实现 contacts.ts：loadContacts() / saveContacts() — 读写 contacts.json
- [x] 6.6 编写 contacts 模块的单元测试

## 7. 余额监控 (balance-monitor)

- [x] 7.1 实现 monitor.ts：BalanceMonitor 类 — 定时轮询余额变化
- [x] 7.2 实现 monitor.ts：start() / stop() — 启动和停止轮询
- [x] 7.3 实现 monitor.ts：检测余额变化并判断收款（排除已知出账交易）
- [x] 7.4 实现 monitor.ts：通知回调机制（供 Plugin 层对接 OpenClaw 消息通道）
- [x] 7.5 编写 monitor 模块的单元测试

## 8. 交易历史 (balance-monitor)

- [x] 8.1 实现 history.ts：addRecord() — 添加交易记录
- [x] 8.2 实现 history.ts：getHistory() — 查询历史记录（支持 limit/offset）
- [x] 8.3 实现 history.ts：loadHistory() / saveHistory() — 读写 history.json 缓存
- [x] 8.4 编写 history 模块的单元测试

## 9. OpenClaw Plugin 集成 (openclaw-plugin)

- [x] 9.1 实现 index.ts：Plugin 入口 — 注册所有 tools，管理生命周期
- [x] 9.2 实现 tools/wallet-create.ts：wallet_create tool（含参数 schema 和描述）
- [x] 9.3 实现 tools/wallet-import.ts：wallet_import tool
- [x] 9.4 实现 tools/wallet-balance.ts：wallet_balance 和 wallet_address tool
- [x] 9.5 实现 tools/wallet-send.ts：wallet_send 和 wallet_estimate_gas tool
- [x] 9.6 实现 tools/wallet-contacts.ts：wallet_contacts_* tools（list/add/resolve/remove）
- [x] 9.7 实现 tools/wallet-policy.ts：wallet_policy_get 和 wallet_policy_set tools
- [x] 9.8 实现 tools/wallet-approval.ts：wallet_approval_* tools（list/approve/reject）
- [x] 9.9 实现 tools/wallet-history.ts：wallet_history tool
- [x] 9.10 实现 Plugin 初始化逻辑（创建数据目录、加载配置、启动 monitor）
- [x] 9.11 实现 Plugin 关闭逻辑（停止 monitor、flush 数据）
- [x] 9.12 实现未配置钱包时的统一错误处理

## 10. 打包与文档

- [x] 10.1 配置 tsup 打包（输出 ESM + CJS）
- [x] 10.2 编写 README.md（安装、配置、使用示例、Tool 列表、安全说明）
- [x] 10.3 端到端流程验证（创建钱包→查余额→转账→查历史 完整链路）
