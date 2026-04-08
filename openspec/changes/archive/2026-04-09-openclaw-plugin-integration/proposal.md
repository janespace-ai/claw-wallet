## Why

OpenClaw 每次调用大模型时，钱包工具不在 `tools` 数组里。Claude 只能通过读 SKILL.md 文档来"理解"有哪些工具，然后每次自己生成代码去调用 SDK，再通过子进程执行——这引入了进程冷启动和代码生成的双重延迟。

通过将 claw-wallet 注册为 OpenClaw plugin，工具在 OpenClaw 启动时一次性注册，之后每次 LLM 调用都直接携带这 17 个工具。Claude 通过原生 `tool_use` 机制调用，OpenClaw runtime 直接执行 `tool.execute()`，无子进程、无代码生成。

## What Changes

- 在 `agent/` 下新增 `openclaw.plugin.json`（OpenClaw 插件清单）
- 在 `agent/src/` 下新增 `openclaw-plugin.ts`（插件入口，~20 行适配层）
- 更新 `agent/package.json`：添加 `openclaw` 字段、扩展 `exports`、`files` 包含插件文件
- 更新 `agent/tsup.config.ts`：增加 `openclaw-plugin` 构建 entry
- 将 `skills/claw-wallet/SKILL.md` 移入 `agent/skills/claw-wallet/SKILL.md`（与 `agent-directory-restructure` 变更对齐，同时作为 plugin manifest 的 `skills` 引用目标）

## Capabilities

### New Capabilities

**OpenClaw 原生工具注册**：安装后执行 `openclaw plugins install claw-wallet`，17 个钱包工具自动注入 LLM context，Claude 可直接通过 `tool_use` 调用，无需生成代码。

**SKILL.md 同步加载**：plugin manifest 的 `skills` 字段指向 `agent/skills/claw-wallet/`，一条命令同时完成工具注册 + 上下文文档加载。

### Modified Capabilities

**安装方式变更**：从 `openclaw skills install claw-wallet` 迁移到 `openclaw plugins install claw-wallet`。旧的 skills install 路径可继续保留作为兼容通道，但主推 plugins install。

## Impact

- **新增**：`agent/openclaw.plugin.json`、`agent/src/openclaw-plugin.ts`
- **移动**：`skills/claw-wallet/SKILL.md` → `agent/skills/claw-wallet/SKILL.md`
- **修改**：`agent/package.json`、`agent/tsup.config.ts`
- **无行为变更**：现有 SDK API（`ClawWallet`、`getTools()`）完全不动
- **发布范围**：npm 包 `agent/` 下新增 `skills/` 和 `openclaw.plugin.json` 到 `files` 字段
