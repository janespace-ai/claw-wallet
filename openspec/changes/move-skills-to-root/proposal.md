## Why

目前 `skills/` 目录藏在 `agent/skills/` 子目录下，`npx skills add` CLI 默认扫描仓库根目录，用户需要写成 `npx skills add janespace-ai/claw-wallet/agent` 才能安装，URL 不够简洁也不够直观。

同类项目（如 Binance binance-skills-hub）均将 `skills/` 放在仓库根目录，安装命令只需一个仓库地址。我们应该对齐这一约定，同时修复 SKILL.md 中的过时描述和遗留开发配置文件。

## What Changes

- 将 `agent/skills/` 目录整体移动到仓库根目录 `skills/`
- 删除 `agent/skills/claw-wallet/wallet.local.json`（含线上服务器 IP，不应随 skill 分发）
- SKILL.md 文本修正：`MCP tools` → `tools`
- SKILL.md 补充 `RELAY_URL` 默认值说明（`http://localhost:8080`，打开桌面 app 即自动启动）

## Capabilities

### Modified Capabilities

- `claw-wallet skill`：安装路径由 `janespace-ai/claw-wallet/agent` 简化为 `janespace-ai/claw-wallet`

## Impact

- **代码**：仅文件移动 + 少量文本修改，不涉及任何逻辑变更
- **API**：无变更
- **用户**：安装命令从 `npx skills add janespace-ai/claw-wallet/agent` 变为 `npx skills add janespace-ai/claw-wallet`
