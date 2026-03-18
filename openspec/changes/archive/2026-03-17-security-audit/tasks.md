## 1. 安全加固基础设施

- [x] 1.1 创建 `src/validation.ts`：实现 `validateAddress()` — EIP-55 checksum 校验 + hex 字符 + 长度验证
- [x] 1.2 实现 `validateAmount()` — 非负、非 NaN、非 Infinity、非空、合理范围检查
- [x] 1.3 实现 `validateChain()` — 枚举白名单校验
- [x] 1.4 实现 `validateKeystoreSchema()` — keystore V3 结构验证 + KDF 参数边界检查（n ≤ 2^20, r ≤ 16, dklen = 32）
- [x] 1.5 实现 `validateContactName()` — 非空、长度限制 ≤ 100、路径遍历字符过滤
- [x] 1.6 实现 `validateTokenSymbol()` — 长度限制 ≤ 20、特殊字符过滤
- [x] 1.7 实现 `secureWriteFile()` — 原子写入（先写临时文件再 rename）+ 0600 权限设置
- [x] 1.8 实现 `sanitizePath()` — 路径规范化 + 防止目录遍历

## 2. 集成验证函数到现有代码

- [x] 2.1 修改 `keystore.ts`：`loadKeystore()` 增加 `validateKeystoreSchema()` 调用
- [x] 2.2 修改 `keystore.ts`：`decryptKey()` 增加 KDF 参数边界检查（拒绝 n > 2^20）
- [x] 2.3 修改 `keystore.ts`：`saveKeystore()` 使用 `secureWriteFile()` 替代普通 `writeFile`
- [x] 2.4 修改 `transfer.ts`：`resolveRecipient()` 增加 `validateAddress()` 调用
- [x] 2.5 修改 `transfer.ts`：`send()` 入口增加 `validateAmount()` 调用
- [x] 2.6 修改 `transfer.ts`：`resolveTokenAddress()` 增加 `validateTokenSymbol()` 或 `validateAddress()` 调用
- [x] 2.7 修改 `contacts.ts`：`addContact()` 增加 `validateContactName()` 和 `validateAddress()` 调用
- [x] 2.8 修改 `policy.ts`：将 `parseFloat(amount)` 替换为整数分计算（乘以 100 取整），修复浮点精度
- [x] 2.9 修改 `contacts.ts`、`history.ts`、`policy.ts`：`save()` 方法使用 `secureWriteFile()`
- [x] 2.10 确认所有现有 55 个测试仍然通过

## 3. 安全测试——密钥管理 (security-keystore)

- [x] 3.1 测试私钥熵质量：100 次生成全部唯一，无可预测模式
- [x] 3.2 测试加密正确性：密文不含明文子串、同密钥同密码产生不同密文
- [x] 3.3 测试认证标签防篡改：修改密文单字节后解密失败
- [x] 3.4 测试内存清除：签名完成后 Buffer 已被零填充
- [x] 3.5 测试签名异常时内存清除：signTransaction 失败时 Buffer 仍被清除
- [x] 3.6 测试 KDF 参数防篡改：拒绝 n=2^30、dklen=0、r=-1、缺失 salt
- [x] 3.7 测试 keystore schema 验证：缺失 crypto 字段、错误 version
- [x] 3.8 测试密码暴力抗性：decryptKey 至少耗时 100ms

## 4. 安全测试——输入验证 (security-input-validation)

- [x] 4.1 测试地址格式：有效 checksum 地址通过、非 hex 字符拒绝、错误长度拒绝、错误 checksum 拒绝、全小写通过
- [x] 4.2 测试金额边界：0 拒绝、负数拒绝、NaN 拒绝、Infinity 拒绝、超大数不溢出
- [x] 4.3 测试 token 输入：特殊字符拒绝、过长 symbol 拒绝
- [x] 4.4 测试联系人名称：路径遍历字符、空名称、过长名称
- [x] 4.5 测试恶意 keystore JSON：畸形 JSON、缺失字段、超大 kdfparams

## 5. 安全测试——策略引擎绕过 (security-policy-bypass)

- [x] 5.1 测试浮点精度攻击：大量小额交易是否能绕过日限额
- [x] 5.2 测试精度边界：$0.1 + $0.2 的累计是否正确
- [x] 5.3 测试审批 ID 随机性：100 个 ID 全部唯一且非顺序
- [x] 5.4 测试伪造审批 ID：fabricated ID 不产生副作用
- [x] 5.5 测试白名单大小写绕过：混合大小写地址匹配
- [x] 5.6 测试并发交易时限额累计是否正确

## 6. 安全测试——文件系统 (security-file-system)

- [x] 6.1 测试 keystore 文件权限为 0600
- [x] 6.2 测试路径遍历防护：dataDir 含 "../" 时被规范化
- [x] 6.3 测试原子写入：写入中断不破坏原有文件
- [x] 6.4 测试错误消息不含敏感数据：解密失败消息不含密钥
- [x] 6.5 测试所有 JSON 文件写入都使用安全写入函数

## 7. 安全测试——RPC 通信 (security-rpc)

- [x] 7.1 测试恶意 RPC 返回负余额：系统不崩溃
- [x] 7.2 测试 RPC 返回超大值：BigInt 不溢出
- [x] 7.3 测试 Gas 估算异常：超高 gas（>30M）被警告、0 gas 被拒绝
- [x] 7.4 测试交易广播失败：错误信息清晰且不含敏感数据
- [x] 7.5 测试 RPC 返回非预期类型：系统优雅降级

## 8. 回归验证

- [x] 8.1 运行全部现有测试（55 个），确认零回归
- [x] 8.2 运行全部安全测试，确认全部通过
- [x] 8.3 运行 TypeScript 类型检查，确认无类型错误
- [x] 8.4 运行构建，确认 ESM + CJS 输出正常
