## Why

现有 README（英文 + 8 种语言翻译）和辅助文档仍停留在 Phase 1 的单组件 SDK 模型，与当前三组件架构（Agent + Desktop Wallet + Go Relay Server）严重脱节。用户首次阅读时无法理解系统的真实运行方式、自动配对流程和多层安全设计。需要全面重写文档，使其反映 Phase 2 的完整架构，并将用户交互体验放在最前面、安全设计作为重点说明。

## What Changes

- **重写 `README.md`（英文）**：从三组件架构视角重写，调整章节顺序——用户交互流程前置，安全架构重点突出（E2EE、自动配对/重连、三级验证、Relay 侧保护）
- **重写 `docs/README.zh-CN.md`**：中文版同步更新
- **重写其他 7 个语言版本的 README**（zh-TW, ja, ko, es, fr, de, pt）：同步更新
- **更新 `docs/PHASE2-ELECTRON-WALLET.md`**：增加自动配对/重连机制、三级验证、Relay 侧 IP 绑定与限流等新安全特性的说明
- **更新 `docs/AGENT_VERIFICATION.md`**：从 Phase 1 SDK 模式更新为 Phase 2 的 Agent + Desktop + Relay 验证流程
- **移除或标注 `docs/PHASE2-MOBILE-SIGNER.md`** 为 Phase 3 远景，避免与当前 Desktop Wallet 实现混淆

## Capabilities

### New Capabilities

（无新 capability——本次 change 仅涉及文档更新，不改变任何系统行为或技术 spec）

### Modified Capabilities

（无——文档更新不修改任何 spec 级别的需求）

## Impact

- **文档文件**：`README.md`、`docs/README.zh-CN.md`、`docs/README.zh-TW.md`、`docs/README.ja.md`、`docs/README.ko.md`、`docs/README.es.md`、`docs/README.fr.md`、`docs/README.de.md`、`docs/README.pt.md`、`docs/PHASE2-ELECTRON-WALLET.md`、`docs/AGENT_VERIFICATION.md`、`docs/PHASE2-MOBILE-SIGNER.md`
- **代码**：无代码变更
- **API**：无 API 变更
- **依赖**：无新增依赖
