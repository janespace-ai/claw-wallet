## Why

Signer isolation 架构将密钥操作隔离到独立进程，但实际测试暴露了三个关键缺陷：
1. **创建钱包时没有弹出密码输入** — TestAuthProvider 硬编码 PIN 可能被误用于生产环境，导致钱包使用默认弱密码
2. **无密码强度校验** — 当前接受任意字符串（包括空字符串）作为加密密码，6 位 PIN 在离线暴力破解下约 28 小时可破
3. **无速率限制** — Signer 对连续失败的认证请求没有任何限制

Phase 1 目标：在当前 Signer 架构上快速加固认证安全，让密码强度达到抗暴力破解水平，同时记录 Phase 2（手机签名架构）的远景设计。

## What Changes

- **强制强密码**：创建/导入钱包时要求 ≥ 12 位密码，包含大小写字母+数字+特殊字符，拒绝 top-10000 常见弱密码，输入两次确认
- **密码强度校验器**：在 Signer 内部实现密码强度检查模块，所有密码入口统一校验
- **速率限制**：Signer 对失败认证实施递增延迟（1-3 次正常，4-5 次等 30 秒，6-10 次等 5 分钟，10 次以上锁定 1 小时）
- **Session 完善**：大额交易（超出 Allowance）强制要求重新输入密码，即使 Session 有效；Session TTL 用户可配置
- **AuthProvider 生产保护**：确保生产启动时不可能使用 TestAuthProvider，CLI 必须显式指定 `--auth-type`
- **Phase 2 远景文档**：记录手机签名架构设计（私钥仅存手机，非对称挑战-响应确认，E2EE 中继通道），作为未来演进方向

## Capabilities

### New Capabilities
- `password-strength`: 密码强度校验模块 — 最小长度、字符复杂度、弱密码字典、输入确认
- `auth-rate-limit`: 认证速率限制 — 失败计数、递增延迟、锁定机制、告警

### Modified Capabilities
- `signer-daemon`: 集成密码强度校验到 create_wallet/import_wallet 流程；集成速率限制到所有认证端点
- `signer-auth`: 大额交易强制重新认证（bypass Session）；AuthProvider 生产保护机制
- `signer-allowance`: Session bypass 规则 — 超出 Allowance 的交易即使 Session 有效也需重新认证

## Impact

- **src/signer/daemon.ts**: 集成密码校验和速率限制
- **src/signer/auth-provider.ts**: 新增生产环境保护接口
- **src/signer/session.ts**: 添加 bypass 逻辑
- **bin/claw-signer.ts**: 强制 --auth-type 参数
- **新增文件**: `src/signer/password-strength.ts`, `src/signer/rate-limiter.ts`
- **新增文档**: `docs/PHASE2-MOBILE-SIGNER.md` (手机签名架构远景)
- **测试**: 密码强度测试、速率限制测试、Session bypass 测试
