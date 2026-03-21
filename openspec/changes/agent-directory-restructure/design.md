## Context

当前根目录有 `agent/`、`mcp-server/`、`skills/` 三个 Agent 相关目录平铺在顶层。`mcp-server/` 通过 `"claw-wallet": "file:../agent"` 依赖 `agent/`。`skills/` 包含两个 OpenClaw SKILL.md 文件，描述 agent 工具的使用和配置。

## Goals / Non-Goals

**Goals:**
- 将 `mcp-server/` 和 `skills/` 收纳到 `agent/` 下，使根目录只有 `agent/`、`desktop/`、`server/`、`openspec/`、`docs/`
- 所有构建和测试结果不变

**Non-Goals:**
- 不改任何源代码逻辑
- 不修改 npm 包名或版本
- 不修改 skills 内容

## Decisions

### 1. 直接 `mv` + 修路径

纯目录迁移，不涉及代码重构。只需更新 `package.json` 中的 `file:` 依赖路径和 `package-lock.json`。

### 2. agent/mcp-server/ 保持独立 package.json

`agent/mcp-server/` 仍是独立 npm 包，有自己的 `package.json`、`tsconfig.json`、`node_modules`。不合并到 agent 的构建流程中。

## Risks / Trade-offs

**[Risk] package-lock.json 路径失效** → 移动后在 `agent/mcp-server/` 重新 `npm install` 即可。

**[Risk] CI/CD 脚本引用旧路径** → 目前无 CI 配置文件，风险为零。
