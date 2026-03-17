## Context

claw-wallet 是一个面向 OpenClaw AI Agent 的本地自托管 Web3 钱包，核心模块包括：密钥管理（keystore.ts）、链适配器（chain.ts）、转账服务（transfer.ts）、策略引擎（policy.ts）、联系人（contacts.ts）、余额监控（monitor.ts）、交易历史（history.ts），以及 16 个 OpenClaw Tool 定义。

通过代码审计识别出以下安全风险领域：
- 私钥在 JS 字符串形式下无法真正清除（immutable string）
- 地址参数仅做长度检查，无 checksum 校验
- 金额参数使用 `parseFloat` 转换存在精度和边界问题
- Keystore JSON 解析无 schema 验证，恶意 kdfparams 可导致 DoS
- 文件写入无权限控制，默认跟随 umask
- RPC 响应未做一致性验证

## Goals / Non-Goals

**Goals:**
- 建立覆盖 6 大安全领域的测试套件（密钥管理、输入验证、策略绕过、文件安全、RPC 安全、加固实现）
- 修复已识别的安全漏洞（输入验证、精度问题、文件权限、内存安全）
- 创建共享验证函数库（`src/validation.ts`），集中所有安全检查逻辑
- 确保所有安全测试可在 CI 中自动运行（无需真实区块链/RPC）

**Non-Goals:**
- 不做形式化验证或数学证明
- 不做智能合约审计（claw-wallet 不部署合约）
- 不做渗透测试（需要专业安全团队）
- 不做性能基准测试

## Decisions

### 1. 安全测试结构

**选择：`tests/security/` 独立目录，每个领域一个测试文件**

理由：
- 安全测试与功能测试关注点不同，分开管理更清晰
- 可单独运行安全测试套件：`npx vitest run tests/security/`
- 每个文件专注一个攻击面，便于审计评审

### 2. 输入验证策略——防御性验证函数

**选择：创建 `src/validation.ts` 共享验证模块**

所有验证集中在一个文件中：
- `validateAddress(input)` — EIP-55 checksum 校验 + 长度 + hex 字符
- `validateAmount(input)` — 非负、非 NaN、非 Infinity、合理范围
- `validateChain(input)` — 枚举白名单校验
- `validateKeystoreSchema(json)` — keystore V3 结构和参数边界验证
- `sanitizePath(basePath, userPath)` — 路径规范化防遍历

理由：
- 集中验证避免遍布各处的重复校验代码
- 单一修改点，便于维护和审计
- 每个验证函数都有对应的安全测试

### 3. 私钥内存安全改进

**选择：尽可能使用 Buffer 传递密钥，减少 Hex 字符串暴露窗口**

JavaScript 的 string 是不可变的，无法主动清除。改进策略：
- 内部签名流程中使用 `Buffer` 而非 `Hex` 字符串传递私钥
- 签名完成后立即 `buffer.fill(0)`
- `generateWallet()` 返回的 privateKey 仍为 Hex（兼容 viem API），但缩短生命周期
- 文档中明确告知此限制

这是 JavaScript 的固有限制，非完美方案，但是在不切换语言的前提下最好的做法。

### 4. 策略引擎精度修复

**选择：使用整数分（cents）而非浮点美元进行限额计算**

替代方案：使用 BigNumber 库

理由：
- `100.00 USD` 存储为 `10000 cents`，消除浮点精度问题
- 无需额外依赖
- 所有比较和累加都在整数域完成

### 5. Mock RPC 测试策略

**选择：使用 vitest mock 模拟 viem client 响应**

理由：
- 安全测试不应依赖真实 RPC（不稳定、慢、需要资金）
- Mock 可以精确控制恶意响应（假余额、超高 gas、异常值）
- 配合 `vi.spyOn` 验证内部调用是否正确

## Risks / Trade-offs

**[JS 内存安全固有限制] → 无法完全清除字符串形式的私钥**
缓解：最大程度使用 Buffer，缩短 string 存在时间，文档说明。真正需要内存安全应使用 Rust/C 实现签名模块（未来考虑）。

**[安全测试的完备性] → 测试覆盖了已知攻击面但无法穷举未知漏洞**
缓解：遵循 OWASP Smart Contract Security 指南 + Web3 钱包安全最佳实践。鼓励社区安全研究者提交 issue。

**[加固可能引入回归] → 新增的验证逻辑可能拒绝原本有效的输入**
缓解：所有加固配合对应测试。现有 55 个测试必须全部通过。
