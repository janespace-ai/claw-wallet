## Why

根目录有 7 个顶层目录，其中 `mcp-server/` 和 `skills/` 都是 Agent 生态的衍生物——MCP 是 agent 工具的分发通道，skills 是 agent 工具的使用说明。它们与 `agent/` 的从属关系在当前平铺结构中不可见，新成员需要额外理解"mcp-server 和 agent 什么关系"。收纳后根目录只剩 `agent/`、`desktop/`、`server/` 三个核心模块，架构自解释。

## What Changes

- Move `mcp-server/` → `agent/mcp-server/`
- Move `skills/` → `agent/skills/`
- Update `agent/mcp-server/package.json` dependency path from `"file:../agent"` to `"file:.."`
- Update import paths if any relative references break
- Update `.gitignore`, `README`, and any CI scripts that reference old paths

## Capabilities

### New Capabilities
_(none)_

### Modified Capabilities
_(none — this is a pure structural refactor with no behavior changes)_

## Impact

- **Moved**: `mcp-server/` → `agent/mcp-server/`, `skills/` → `agent/skills/`
- **Updated**: `agent/mcp-server/package.json` dependency path
- **No behavior change**: all builds and tests must pass identically before and after
