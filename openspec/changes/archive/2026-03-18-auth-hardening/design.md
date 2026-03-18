## Context

当前 Signer 隔离架构已将密钥操作从 Agent/Tool 进程分离到独立的 Signer daemon，通过 Unix Socket IPC 通信。但实际测试中发现认证环节存在以下问题：

- `handleCreateWallet` 调用 `authProvider.requestPin()` 但没有密码强度校验
- 测试中使用的 `TestAuthProvider` 返回硬编码 PIN，生产环境可能误用
- 无任何速率限制，攻击者控制 Agent 后可对 Signer 发起无限次认证尝试
- Session 有效期内所有交易自动通过，无法对大额交易强制重新认证

现有代码基础：`src/signer/daemon.ts`, `src/signer/session.ts`, `src/signer/auth-provider.ts`, `src/signer/allowance.ts`

## Goals / Non-Goals

**Goals:**
- 确保所有钱包创建/导入使用足够强的密码（抗离线暴力破解）
- 对失败认证实施速率限制，防止在线暴力破解
- 大额交易即使在 Session 内也需重新认证
- 生产环境不可能意外使用测试 AuthProvider
- 记录 Phase 2 手机签名架构远景文档

**Non-Goals:**
- 不修改 keystore 加密算法（scrypt 参数已足够）
- 不实现手机端 App（Phase 2 范畴）
- 不实现 TOTP（已被非对称挑战-响应方案取代，属 Phase 2）
- 不实现独立用户进程隔离（过于复杂，强密码方案足够）

## Decisions

### 1. 密码强度策略

**选择：≥ 12 位 + 字符多样性 + 弱密码字典**

规则：
- 最小长度 12 字符
- 必须包含：大写字母、小写字母、数字、特殊字符（各至少 1 个）
- 拒绝 top-10000 常见密码（内嵌压缩字典）
- 创建/导入时要求输入两次确认一致

替代方案：
- 短 PIN + DeviceKey 组合：已排除——同用户进程可读取 DeviceKey，退化为纯 PIN 暴力破解（28 小时可破 6 位）
- zxcvbn 熵评估：更智能但引入较大依赖，且规则透明度低。后续可考虑替换简单规则。

安全性量化：95^12 ≈ 5.4×10²³ 种组合 × 100ms/次 scrypt = 1.7×10¹⁵ 年，不可暴力破解。

### 2. 速率限制策略

**选择：Signer 进程内存级速率限制 + 持久化失败计数**

方案：
- 失败 1-3 次：正常提示重试
- 失败 4-5 次：强制等待 30 秒
- 失败 6-10 次：强制等待 5 分钟
- 失败 >10 次：锁定 1 小时 + 写入审计日志告警
- 成功认证后重置计数器
- 失败计数持久化到 `rate-limit.json`，防止重启绕过

替代方案：
- 纯内存计数：重启即绕过，不够安全
- IP 级限制：Signer 走 Unix Socket，无 IP 概念，不适用

### 3. Session Bypass 规则

**选择：超出 Allowance 的交易强制重新认证**

- Allowance 内交易：Session 有效时自动签名（不变）
- 超出单笔限额或需要 Level 1+ 确认：即使 Session 有效，也要求用户交互
- Level 2 操作（大额/策略修改）：总是要求输入密码，忽略 Session

这保持了小额自动支付的便利性，同时对大额交易增加一层保护。

### 4. AuthProvider 生产保护

**选择：CLI 强制 --auth-type 参数 + 运行时检查**

- `bin/claw-signer.ts` 的 `--auth-type` 参数改为必填
- 可选值：`tui` | `gui` | `webhook`
- 删除任何默认 fallback 到 TestAuthProvider 的路径
- SignerDaemon 构造函数增加运行时检查：如果 AuthProvider 的 `requestPin` 在 0ms 内返回，记录安全告警

### 5. Phase 2 远景文档

**选择：写入 `docs/PHASE2-MOBILE-SIGNER.md`，不创建 openspec change**

内容涵盖：
- 核心架构：私钥仅存手机 Secure Enclave，电脑零秘密
- 非对称挑战-响应认证（替代 TOTP）：本地只存公钥
- 通讯通道：局域网直连 + E2EE 中继 fallback
- 手机端 Allowance：预算内自动签名，超预算推送确认
- 远期 Phase 3：ERC-4337 Account Abstraction + Session Key 链上授权

## Risks / Trade-offs

- **[用户体验下降]** 强密码 12 位比 PIN 码输入更繁琐 → Session 缓存缓解（默认 30 分钟内只需输入一次）
- **[弱密码字典维护]** 内嵌 10000 条弱密码增加包体积约 80KB → 可接受，且压缩后更小
- **[速率限制被绕过]** 攻击者直接读取 keystore 文件离线暴力破解，不经过 Signer → 强密码兜底（12 位不可破解）
- **[Session Bypass 误判]** 汇率波动可能导致 USD 金额判定不准确 → 使用和 Allowance 相同的金额判定逻辑，保持一致性
- **[AuthProvider 检查误报]** 某些系统上 TUI 输入可能很快完成 → 检查阈值设为 10ms 而非 0ms，只是告警不阻断
