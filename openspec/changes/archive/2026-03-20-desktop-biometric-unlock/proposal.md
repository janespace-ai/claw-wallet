## Why

Desktop Wallet 每次启动都需要手动输入密码解锁，没有利用设备的生物识别能力。UI 和 IPC 管道已经搭建好（"Use Biometrics" 按钮、`unlockBiometric` IPC handler），但 `KeyManager` 中的实现是空的（`isBiometricAvailable()` 直接返回 `false`，`unlockBiometric()` 抛出 "not implemented" 错误）。需要接入各平台的生物识别 API 实现快速解锁。

## What Changes

- 实现跨平台生物识别解锁：
  - **macOS**: Touch ID — 使用 `systemPreferences.promptTouchID()` 验证身份
  - **Windows**: Windows Hello — 使用 `@nicolo-ribaudo/native-hello` 或类似 native 模块调用 Windows Hello API
  - **Linux**: 无标准生物识别 API，graceful fallback 到密码解锁
- 使用 Electron `safeStorage` 跨平台加密存储密码凭据
- `isBiometricAvailable()` 根据当前平台检测生物识别能力
- `setBiometricEnabled()` 实现密码的加密存储 / 清除
- `unlockBiometric()` 先触发平台对应的生物识别验证，通过后从 `safeStorage` 解密密码并解锁
- 解锁界面在 biometric 可用时自动显示对应按钮（macOS 显示 "Use Touch ID"，Windows 显示 "Use Windows Hello"）

## Capabilities

### New Capabilities

### Modified Capabilities

（无 spec 级别变更，现有 IPC 接口不变，纯实现层面改动）

## Impact

- `desktop/src/main/key-manager.ts` — 实现 biometric 相关方法，按平台分发
- `desktop/src/main/index.ts` — 首次密码解锁后提示启用 biometric
- `desktop/src/renderer/app.js` + `index.html` — 按平台显示不同的按钮文案，添加 Settings 开关
- 平台兼容性：macOS (Touch ID)、Windows (Windows Hello)、Linux (fallback 到密码)
