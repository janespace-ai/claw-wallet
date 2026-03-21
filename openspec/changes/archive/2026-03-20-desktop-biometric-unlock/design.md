## Context

Desktop Wallet 的 `KeyManager` 已定义了 biometric 接口（`isBiometricAvailable`、`unlockBiometric`、`setBiometricEnabled`），preload 和 renderer 也已接好 IPC 管道和 UI 按钮，但实现为空。

需要根据运行平台选择不同的生物识别方案：

| 平台 | 生物识别方式 | 底层 API |
|------|-------------|----------|
| macOS | Touch ID | `systemPreferences.promptTouchID()` (Electron 内置) |
| Windows | Windows Hello | `native-hello` native module 或 PowerShell 调用 |
| Linux | 无 | fallback 到密码 |

所有平台统一使用 Electron `safeStorage` 加密存储密码凭据（macOS 用 Keychain，Windows 用 DPAPI，Linux 用 libsecret）。

## Goals / Non-Goals

**Goals:**
- macOS 上通过 Touch ID 实现快速解锁
- Windows 上通过 Windows Hello（指纹/面部/PIN）实现快速解锁
- Linux 上 graceful fallback，不显示 biometric 按钮
- 首次密码解锁成功后提示用户启用 biometric
- Settings 页面可开启/关闭 biometric
- UI 按钮文案根据平台自动适配（"Use Touch ID" / "Use Windows Hello"）

**Non-Goals:**
- Linux 生物识别支持（无统一 API）
- 替代密码登录（biometric 是便捷入口，密码始终作为 fallback）
- 修改加密钱包的存储格式

## Decisions

### 1. 平台检测与分发策略

**选择:** 在 `KeyManager` 中用 `process.platform` 检测平台，分发到不同的验证实现。

```typescript
function getBiometricType(): "touchid" | "windows-hello" | "none" {
  if (process.platform === "darwin") return "touchid";
  if (process.platform === "win32") return "windows-hello";
  return "none";
}
```

**理由:** 简单直接，Electron 在各平台有不同的 API，统一抽象没有必要。

### 2. 凭据存储：统一使用 Electron `safeStorage`

**选择:** `safeStorage.encryptString(password)` → 存储到 `<dataDir>/bio-credential.enc`（Buffer base64 编码写入）

**备选:** `keytar` 第三方库 — 功能类似但需 native 依赖，增加构建复杂度。

**理由:** `safeStorage` 是 Electron 内置 API，零外部依赖，跨平台自动使用 OS 最安全的存储后端。

### 3. macOS Touch ID 验证

**流程:**
1. `systemPreferences.promptTouchID("unlock Claw Wallet")` — Electron 内置，触发系统 Touch ID 对话框
2. 验证通过 → `safeStorage.decryptString()` 取回密码
3. 调用已有 `unlock(password)` 流程

**注意:** `promptTouchID` 在没有 Touch ID 的 Mac 上会 fallback 到系统密码输入框，行为安全。

### 4. Windows Hello 验证

**方案 A (首选):** 使用 `child_process` 调用 PowerShell 的 `[Windows.Security.Credentials.UI.UserConsentVerifier]` API，无需额外 native 模块。

**方案 B (备选):** 如果 PowerShell 方案不稳定，使用 `@nicolo-ribaudo/native-hello` npm 包。

**流程:**
1. 调用 Windows Hello 验证用户身份
2. 验证通过 → `safeStorage.decryptString()` 取回密码
3. 调用已有 `unlock(password)` 流程

### 5. 启用流程

1. 用户首次密码解锁成功
2. 检测 `getBiometricType() !== "none"` 且 `safeStorage.isEncryptionAvailable()` 且尚未启用
3. 向 renderer 发送提示事件 "Enable Touch ID / Windows Hello?"
4. 用户确认 → `setBiometricEnabled(true, password)` 加密存储密码
5. 下次进入解锁页面自动显示 biometric 按钮

### 6. 安全考虑

- 密码修改时自动清除 `bio-credential.enc`
- `safeStorage` 加密绑定到当前机器的 OS keychain，拷贝到其他机器无法解密
- biometric 验证失败不泄露任何信息，用户可 fallback 到密码

## Risks / Trade-offs

- **[Risk] Windows Hello PowerShell 方案兼容性** → 先实现方案 A，如果失败则 fallback 到 "none"（不显示按钮），后续可升级为方案 B
- **[Risk] safeStorage 在 CI/headless 环境不可用** → `isBiometricAvailable()` 检测并返回 false
- **[Risk] 密码变更后凭据失效** → 密码变更时主动清除 credential 文件
- **[Trade-off] 存储密码而非密钥** → 简单直接，不改动已有加密流程；攻击者如已破解 OS keychain 则说明已获得物理控制权，威胁模型可接受
