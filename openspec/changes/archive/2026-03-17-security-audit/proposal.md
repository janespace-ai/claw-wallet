## Why

claw-wallet 是一个管理用户加密资产私钥和链上交易的 Web3 钱包。安全漏洞可能直接导致资金损失。初始实现已完成核心功能，但尚未进行系统性的安全审计。代码中已识别出多个安全隐患：私钥内存清除不彻底（JS 字符串不可变）、输入验证不足（地址格式/金额边界/keystore schema）、KDF 参数未做边界检查（可被利用做 DoS）、文件权限未限制等。在发布前必须进行全面的安全测试和加固。

## What Changes

- **新增安全测试套件**：覆盖密钥管理、密码学实现、输入验证、策略引擎绕过、文件安全、RPC 安全等 6 大领域的专项测试
- **加固输入验证**：所有地址参数增加 checksum 校验、金额参数增加 NaN/Infinity/负数检查、keystore JSON schema 验证、KDF 参数边界检查
- **加固内存安全**：改进私钥清除机制（使用 Buffer 替代 Hex 字符串传递）、密码内存驻留时间最小化
- **加固文件安全**：keystore 文件写入时设置 0600 权限、数据目录路径规范化防遍历
- **加固 RPC 安全**：响应验证、超时控制、余额一致性检查
- **加固策略引擎**：浮点精度问题修复、并发交易时序攻击防护、审批 ID 防枚举

## Capabilities

### New Capabilities

- `security-keystore`: 密钥管理安全测试——私钥生成熵质量、加密算法正确性、内存清除验证、keystore 文件完整性校验、密码强度检查、KDF 参数防篡改
- `security-input-validation`: 输入验证安全测试——地址格式与 checksum 校验、金额边界值（0/负数/溢出/NaN）、token 解析注入、联系人名称注入、恶意 keystore JSON
- `security-policy-bypass`: 策略引擎绕过测试——限额精度攻击（浮点误差累积）、并发请求竞态、时间窗口操纵、审批队列篡改、白名单绕过
- `security-file-system`: 文件系统安全测试——keystore 文件权限、数据目录路径遍历、符号链接攻击、并发读写一致性、敏感数据泄露到日志
- `security-rpc`: RPC 通信安全测试——恶意 RPC 响应处理、RPC 超时与重试、交易广播中间人、余额查询一致性、Gas 估算操纵
- `security-hardening`: 安全加固实现——地址 checksum 校验函数、金额安全解析函数、文件安全写入函数、keystore schema 验证、内存安全改进

### Modified Capabilities

- `wallet-core`: 增加 keystore schema 验证、KDF 参数边界检查、改进私钥内存清除
- `token-transfer`: 增加地址 checksum 校验、金额安全解析、防止 parseFloat 精度问题
- `policy-engine`: 修复浮点精度累积问题、增加并发安全机制

## Impact

- **修改文件**：`keystore.ts`（schema 验证 + 内存安全）、`transfer.ts`（输入验证）、`policy.ts`（精度修复）、`chain.ts`（RPC 防护）、`contacts.ts`（输入验证）
- **新增文件**：`tests/security/` 目录下 6 个安全测试文件、`src/validation.ts`（共享验证函数）
- **新增依赖**：无（全部使用 Node.js 内置 + viem 已有功能）
- **不影响现有 API**：所有变更向后兼容，仅增加防御性检查
