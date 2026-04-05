## 1. 移动 skills 目录

- [x] 1.1 在仓库根目录创建 `skills/claw-wallet/` 目录
- [x] 1.2 将 `agent/skills/claw-wallet/SKILL.md` 移动到 `skills/claw-wallet/SKILL.md`
- [x] 1.3 删除 `agent/skills/claw-wallet/wallet.local.json`（含线上服务器 IP，不应对外分发）
- [x] 1.4 删除现在已空的 `agent/skills/` 目录

## 2. 修正 SKILL.md 内容

- [x] 2.1 将 `You have access to Claw Wallet MCP tools` 改为 `You have access to Claw Wallet tools`
- [x] 2.2 在 `primaryEnv: RELAY_URL` 下方补充注释说明：
  - 本地使用默认值：`http://localhost:8080`
  - 打开 Claw Wallet 桌面 app 后 relay 自动启动，无需额外配置

## 3. 验证

- [x] 3.1 确认 `skills/claw-wallet/SKILL.md` 文件存在且内容正确
- [x] 3.2 确认 `agent/skills/` 目录已完全删除
- [x] 3.3 确认 SKILL.md 中不再出现 "MCP tools" 字样
- [x] 3.4 确认 SKILL.md 中 RELAY_URL 有默认值说明

## 4. 更新 README

- [x] 4.1 英文 README：将 "Option 2: MCP Server" 替换为 "Option 1: Skills"，加入两种安装命令
- [x] 4.2 中文 README：新增"两种使用方式"章节，加入两种安装命令
- [x] 4.3 修正两份 README 中所有 "MCP tools" 旧引用

## 5. 提交

- [x] 5.1 提交并推送到远端
