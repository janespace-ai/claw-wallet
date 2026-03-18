## 1. 密码强度校验模块

- [x] 1.1 创建 `src/signer/password-strength.ts` — 实现 `validatePasswordStrength(password): { valid: boolean, errors: string[] }`
- [x] 1.2 实现最小长度检查 (≥ 12 字符)
- [x] 1.3 实现字符复杂度检查 (大写 + 小写 + 数字 + 特殊字符)
- [x] 1.4 内嵌 top-10000 弱密码字典 (压缩 Set，case-insensitive)
- [x] 1.5 实现弱密码字典匹配检查
- [x] 1.6 编写密码强度单元测试 `tests/signer/password-strength.test.ts`

## 2. 速率限制模块

- [x] 2.1 创建 `src/signer/rate-limiter.ts` — 实现 `RateLimiter` 类
- [x] 2.2 实现失败计数和递增延迟逻辑 (1-3: 无延迟, 4-5: 30s, 6-10: 5min, >10: 1h 锁定)
- [x] 2.3 实现 `checkRateLimit()` 方法 — 返回是否允许尝试及剩余等待时间
- [x] 2.4 实现 `recordFailure()` 和 `recordSuccess()` 方法
- [x] 2.5 实现持久化 — 读写 `rate-limit.json` (失败计数 + 锁定到期时间)
- [x] 2.6 实现重启恢复 — 加载时检查锁定是否已过期
- [x] 2.7 编写速率限制单元测试 `tests/signer/rate-limiter.test.ts`

## 3. Signer Daemon 集成

- [x] 3.1 在 `handleCreateWallet` 中集成密码强度校验 — 弱密码时通过 AuthProvider 提示并重新要求输入
- [x] 3.2 在 `handleCreateWallet` 中实现密码二次确认 — 调用 AuthProvider 两次并比对，最多 3 次重试
- [x] 3.3 在 `handleImportWallet` 中集成密码强度校验和二次确认 (新密码部分)
- [x] 3.4 在 `handleUnlock` 和 `decryptWithSession` 中集成速率限制 — 尝试前检查 `checkRateLimit()`
- [x] 3.5 在所有认证失败路径调用 `recordFailure()`，成功路径调用 `recordSuccess()`
- [x] 3.6 在 `handleSignTransaction` 中实现 Level 2 Session bypass — 超出 Allowance 时忽略 Session 缓存，强制重新输入密码

## 4. AuthProvider 生产保护

- [x] 4.1 修改 `bin/claw-signer.ts` — 将 `--auth-type` 改为必填参数，无参数时退出并打印错误
- [x] 4.2 在 `SignerDaemon` 中添加 AuthProvider 响应时间监控 — `requestPin` 返回 < 10ms 时写审计日志告警
- [x] 4.3 在 `AuthProvider` 接口中添加 `requestPasswordWithConfirmation(context, validator)` 方法 — 封装密码输入+校验+二次确认流程
- [x] 4.4 在 `TuiAuthProvider` 中实现 `requestPasswordWithConfirmation` — TTY 隐藏输入 + 校验反馈 + 二次确认

## 5. Session 增强

- [x] 5.1 修改 `SessionManager` — 添加 `bypassForLevel2` 配置选项
- [x] 5.2 在 `decryptWithSession` 中当 Level ≥ 2 时跳过缓存，强制走 AuthProvider
- [x] 5.3 支持 Session TTL 用户可配置 — `claw-signer --session-ttl <ms>` 参数 (已有，确认生效)

## 6. Phase 2 远景文档

- [x] 6.1 创建 `docs/PHASE2-MOBILE-SIGNER.md` — 记录手机签名架构远景
- [x] 6.2 撰写核心架构章节 — 私钥仅存手机 Secure Enclave，电脑零秘密
- [x] 6.3 撰写非对称挑战-响应认证章节 — 本地只存公钥，手机私钥签名验证
- [x] 6.4 撰写通讯通道章节 — 局域网直连 + E2EE 中继 fallback
- [x] 6.5 撰写 Allowance 与 Agent 自主性章节 — 手机端预授权预算
- [x] 6.6 撰写 Phase 3 展望章节 — ERC-4337 AA + 链上 Session Key

## 7. 测试

- [x] 7.1 编写 Signer 集成测试 — 创建钱包时弱密码被拒绝、强密码通过
- [x] 7.2 编写 Signer 集成测试 — 密码二次确认不一致被拒绝
- [x] 7.3 编写速率限制集成测试 — 连续失败后延迟生效，成功后重置
- [x] 7.4 编写 Session bypass 测试 — Level 2 交易即使 Session 有效也要求重新认证
- [x] 7.5 编写 AuthProvider 保护测试 — 无 --auth-type 参数时进程退出
- [x] 7.6 运行完整测试套件确认无回归
