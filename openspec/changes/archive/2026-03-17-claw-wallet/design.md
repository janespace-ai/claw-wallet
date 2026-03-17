## Context

OpenClaw 是一个开源 AI Agent 框架，以本地运行、用户自管为核心理念。Agent 通过 Plugin/Skill 体系扩展能力，通过 Gateway 连接多个消息平台（Telegram、Slack、Discord 等），拥有 Agentic Loop 实现自主任务链。

当前生态缺少官方级 Web3 钱包方案。社区插件 openclast-wallet 提供基础 EVM 转账但无安全护栏。claw-wallet 将作为 OpenClaw Plugin 提供完整的链上交易能力。

**约束条件：**
- 纯开源社区项目（MIT 许可证）
- 本地自托管，不依赖云服务
- 与 OpenClaw 的 Plugin/Skill 体系深度集成
- Agent 进程不能接触私钥明文

## Goals / Non-Goals

**Goals:**
- 提供安全的本地密钥管理，私钥加密存储、签名时短暂解密后立即清除
- 实现双模式钱包：用户指挥 Agent 交易 + Agent 自主执行链上操作
- 内置应用层策略引擎，防止 Prompt Injection 导致的资金损失
- 支持 Agent 间 P2P 地址交换与转账
- 以 OpenClaw Plugin 形式分发，`openclaw plugins install` 即用

**Non-Goals:**
- 不做链上合约级限额（全托管模型下应用层策略已足够）
- 不做中心化托管服务
- 不做法币入金通道（MVP 阶段）
- 不做 x402 协议支持（MVP 阶段，后续迭代）
- 不做 Solana 等非 EVM 链支持（MVP 阶段）
- 不做多 Agent 多签
- 不做 NFT 操作

## Decisions

### 1. 进程内库 vs 独立进程

**选择：进程内库（npm 包直接在 Agent Runtime 中加载）**

替代方案：独立常驻进程通过 Unix Socket/IPC 通信

理由：
- OpenClaw Agent 本身就是长期运行进程，无需再起额外进程
- 同用户同机器下，进程隔离是"软"的（ptrace 可互读内存），安全收益有限
- 进程内库消除 IPC 复杂度（进程管理、通信协议、启停控制）
- 真正的安全防线是 Policy Engine + 密钥加密存储，而非进程边界
- LLM 通过 Tool 接口访问钱包功能，永远不接触内部实现

### 2. 密钥存储方案

**选择：Ethereum Keystore V3 格式 + AES-256-GCM 加密**

替代方案：OS Keychain（macOS Keychain / Linux libsecret）、MPC 分片、TEE

理由：
- Keystore V3 是以太坊生态标准格式，被 MetaMask、geth 等广泛使用
- 跨平台无额外依赖（纯 Node.js crypto 模块）
- 用户可导出 keystore 文件到其他钱包（互操作性）
- MVP 阶段用主密码加密，后续可叠加 OS Keychain 作为密码存储层

密钥使用流程：加密文件 → 用户密码解密 → 签名 → key.fill(0) 覆写内存 → 仅 txHash 返回给 Agent

### 3. 链交互库

**选择：viem**

替代方案：ethers.js、web3.js

理由：
- TypeScript 优先，类型安全
- 模块化设计，tree-shaking 友好，包体积小
- 当前 EVM 生态主流选择，Coinbase AgentKit 也在用
- 内置 ABI 编码/解码、Gas 估算、交易构建

### 4. 余额与收款感知

**选择：按需查链 + Agent 进程内定时轮询**

替代方案：独立 Watcher 进程、第三方 Webhook 服务

理由：
- 余额是链上状态的查询，不需要本地维护账本
- OpenClaw Agent 进程本身是长期运行的，可以内建轮询逻辑
- 定时轮询足够 MVP 使用，后续可升级为 WebSocket 事件订阅
- 不依赖第三方服务，符合本地自托管定位

### 5. 多链支持策略

**选择：默认 Base L2，同时支持 Ethereum mainnet，架构预留多链扩展**

理由：
- Base 的 Gas 费用极低，适合 Agent 高频交易场景
- USDC 在 Base 上原生支持
- viem 的 Chain 抽象层天然支持多链切换
- 通过 Chain Adapter 模式，后续添加 EVM 链只需注册配置

### 6. 项目结构

**选择：单包结构（single package）**

替代方案：monorepo（wallet-service + plugin 分包）

理由：
- 确定用进程内库后，无需拆分为服务端和客户端
- 单包更简单，安装和维护成本低
- 一个 npm 包 = 一个 OpenClaw Plugin，用户认知清晰
- 内部通过模块划分保持代码组织清晰

目录结构：
```
claw-wallet/
├── src/
│   ├── index.ts              # Plugin 入口，注册 Tools
│   ├── keystore.ts           # 密钥管理（生成/加密/解密/签名）
│   ├── chain.ts              # 链适配器（viem 封装，多链支持）
│   ├── policy.ts             # 策略引擎（限额/白名单/审批）
│   ├── transfer.ts           # 转账逻辑（ETH/ERC-20）
│   ├── contacts.ts           # 联系人管理
│   ├── monitor.ts            # 余额监控与通知
│   ├── history.ts            # 交易记录
│   ├── types.ts              # 共享类型定义
│   └── tools/                # OpenClaw Tool 定义
│       ├── wallet-create.ts
│       ├── wallet-balance.ts
│       ├── wallet-send.ts
│       ├── wallet-contacts.ts
│       ├── wallet-policy.ts
│       └── wallet-history.ts
├── package.json
├── tsconfig.json
└── README.md
```

数据存储：`~/.openclaw/wallet/`
```
~/.openclaw/wallet/
├── keystore.json       # 加密的私钥（Keystore V3 格式）
├── contacts.json       # 联系人地址簿
├── history.json        # 交易记录缓存
└── policy.json         # 策略配置
```

## Risks / Trade-offs

**[进程内库安全性] → 密钥与 Agent 在同一进程**
缓解：密钥加密存储，仅签名时短暂解密并立即覆写内存。LLM 仅通过 Tool API 交互，不接触内部状态。恶意第三方插件是主要风险，需在文档中告知用户只安装受信插件。

**[应用层策略被绕过] → Policy Engine 在应用层，理论上可被绕过**
缓解：在全托管模型下，签名操作必须经过 Policy Engine，没有绕过路径。除非 Agent 运行时本身被攻陷——但此时攻击者已有本机权限，超出钱包软件防护范围。

**[RPC 节点依赖] → 依赖外部 RPC 节点**
缓解：支持用户自配 RPC 端点。默认使用公共节点，文档推荐使用 Alchemy/Infura 免费额度以获得更好的稳定性。

**[主密码管理] → MVP 使用主密码加密密钥，用户体验略差**
缓解：首次设置时输入一次，进程运行期间保持解锁。后续版本添加 OS Keychain 集成。

**[定时轮询效率] → 轮询方式有延迟且消耗 RPC 配额**
缓解：默认 30 秒间隔，用户可自定义。后续升级为 WebSocket 事件订阅。MVP 阶段完全够用。
