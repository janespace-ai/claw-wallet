## 1. 平台检测与 biometric 基础

- [x] 1.1 在 `key-manager.ts` 中新增 `getBiometricType()` 辅助函数：`process.platform === "darwin"` → `"touchid"`，`"win32"` → `"windows-hello"`，其他 → `"none"`
- [x] 1.2 实现 `isBiometricAvailable()`：检测 `getBiometricType() !== "none"` 且 `safeStorage.isEncryptionAvailable()` 且 `bio-credential.enc` 文件存在
- [x] 1.3 新增 `getBiometricLabel()` 方法：macOS 返回 `"Touch ID"`，Windows 返回 `"Windows Hello"`，用于 UI 按钮显示

## 2. 凭据存储

- [x] 2.1 实现 `setBiometricEnabled(enabled, password?)`：启用时用 `safeStorage.encryptString(password)` 加密密码，base64 编码写入 `<dataDir>/bio-credential.enc`；禁用时删除该文件并将 `biometricEnabled` 置为 false
- [x] 2.2 新增 `clearBiometricCredential()` 私有方法：删除 `bio-credential.enc` 文件，供密码变更等场景调用

## 3. 平台生物识别验证

- [x] 3.1 实现 macOS Touch ID 验证：在 `unlockBiometric()` 中，当 `getBiometricType() === "touchid"` 时调用 `systemPreferences.promptTouchID("unlock Claw Wallet")`，验证通过后从 `bio-credential.enc` 读取并 `safeStorage.decryptString()` 获取密码，调用 `unlock(password)`
- [x] 3.2 实现 Windows Hello 验证：当 `getBiometricType() === "windows-hello"` 时，使用 `child_process.execFile` 调用 PowerShell 脚本 `[Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync("Unlock Claw Wallet")`，验证通过后同样从 credential 文件解密密码并解锁
- [x] 3.3 对不支持的平台（Linux），`unlockBiometric()` 抛出明确错误 "Biometric not available on this platform"

## 4. 主进程集成

- [x] 4.1 修改 `index.ts` 中 `wallet:unlock` handler：密码解锁成功后，如果 biometric 可用（`getBiometricType() !== "none"` 且 `safeStorage.isEncryptionAvailable()`）且尚未启用，向 renderer 发送 `wallet:biometric-prompt` 事件
- [x] 4.2 修改 `wallet:set-biometric` handler：接收 `(enabled, password)` 参数，调用 `setBiometricEnabled(enabled, password)`
- [x] 4.3 新增 `wallet:biometric-label` handler：返回 `getBiometricLabel()` 的结果供 renderer 显示
- [x] 4.4 在 preload `index.ts` 中添加 `getBiometricLabel` 和 `onBiometricPrompt` 的 IPC 绑定

## 5. Renderer UI

- [x] 5.1 在 `app.js` 中监听 `wallet:biometric-prompt` 事件，弹出确认提示 "Enable {label} for quick unlock?"，确认后调用 `setBiometricEnabled(true, password)`
- [x] 5.2 解锁页面：biometric 可用时，获取 label 并更新按钮文案为 "Use Touch ID" / "Use Windows Hello"
- [x] 5.3 在 `index.html` Settings 区域添加 biometric toggle（checkbox），绑定 `setBiometricEnabled`
- [x] 5.4 在 `app.js` Settings 初始化时检测 biometric 可用性，不可用则隐藏 toggle

## 6. 验证

- [x] 6.1 `npm run build` 编译通过
- [ ] 6.2 手动验证 macOS：密码解锁 → 提示启用 Touch ID → 启用 → 重新进入 → Touch ID 解锁成功
- [ ] 6.3 验证 Linux：不显示 biometric 按钮，密码解锁正常工作
