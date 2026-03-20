## Context

项目当前三组件（Agent / Desktop / Server）的目录布局不对称：

- `agent/` — 源码目录，但构建配置（`package.json`、`tsconfig.json`、`tsup.config.ts`）和测试（`tests/`）放在根目录
- `desktop/` — 完全独立的 Electron 项目，自带 `package.json` 和 `tsconfig.json`
- `server/` — 完全独立的 Go 项目，自带 `go.mod`

根目录的 `package.json` name 是 `claw-wallet`（Agent 的 npm 包名），`tsconfig.json` 的 `rootDir` 指向 `agent`，`tsup.config.ts` 的 entry 是 `agent/index.ts`。这些都只服务于 Agent，但放在根目录造成混淆。

当前无 CI/CD 配置文件（无 `.github/workflows/`），无需担心 CI 迁移。

## Goals / Non-Goals

**Goals:**

- Agent 的所有构建配置和测试迁入 `agent/` 目录，使三个组件在结构上完全平级
- 迁移后 Agent 的 `npm install`、`npm run build`、`npm test`、`npm run typecheck` 均可在 `agent/` 下正常执行
- 清理根目录无用文件（空 `bin/`、Agent 的 `dist/`、`node_modules/`）
- 根目录保持简洁，只保留文档和跨组件协调文件

**Non-Goals:**

- 不引入 npm workspaces 或 monorepo 工具（turborepo、nx 等）——当前三组件技术栈不同（TS + TS + Go），workspaces 收益不大
- 不改变 Agent 的代码逻辑或 API
- 不改变 Desktop 或 Server 的目录结构（它们已经是独立的）
- 不创建根级 `package.json` 的 workspace 配置

## Decisions

### 1. Agent 构建配置迁移方案

**决策**：把 `package.json`、`package-lock.json`、`tsconfig.json`、`tsup.config.ts` 直接移入 `agent/`，并调整其中的路径引用。

**理由**：Agent 目录变为自包含项目，和 Desktop、Server 完全一致的模式——进入子目录后 `npm install && npm run build` 即可。

**路径调整细节**：
- `tsconfig.json`：`rootDir` 从 `"agent"` 改为 `"."`（当前目录），`include` 从 `["agent"]` 改为 `["."]`（排除 tests）
- `tsup.config.ts`：entry 从 `"agent/index.ts"` 改为 `"index.ts"`
- `package.json`：无路径引用需要修改，`main`/`module`/`types` 仍指向 `dist/`

### 2. 测试目录迁移方案

**决策**：将 `tests/` 整体移入 `agent/tests/`。

**理由**：测试全部针对 Agent 代码（import 路径如 `../../agent/xxx`），归属在 Agent 下最合理。

**路径调整细节**：
- 测试文件中的 import `../../agent/xxx` 变为 `../xxx`（上一级即 agent 根目录）
- 测试文件中的 import `../agent/xxx` 变为 `./xxx` 或 `../xxx`（视层级）
- `package.json` 的 `test` script 保持 `vitest run` 不变（vitest 自动发现 `tests/` 下的 `.test.ts`）

### 3. 根目录保留内容

**决策**：根目录不再放 `package.json`，只保留：

```
wallet/
├── agent/          # Agent TypeScript 库
├── desktop/        # Electron 桌面钱包
├── server/         # Go Relay Server
├── docs/           # 文档
├── openspec/       # OpenSpec 设计文件
├── README.md       # 项目总览
├── LICENSE
└── .gitignore
```

**理由**：根目录无需 `package.json`，因为没有跨组件的 npm 构建需求。每个组件独立管理依赖。

### 4. 清理策略

**决策**：删除根目录的 `dist/`、`node_modules/`、空 `bin/` 目录。

**理由**：这些都是 Agent 的产物，迁移后由 `agent/dist/`、`agent/node_modules/` 取代。

## Risks / Trade-offs

- **[npm publish 路径变化]** → 发布 Agent 包时需从 `agent/` 目录执行 `npm publish`，而非根目录。文档中需更新发布说明。
- **[开发者习惯变化]** → 之前在根目录 `npm test` 的习惯需改为 `cd agent && npm test`。通过 README 说明缓解。
- **[Git 历史中的 `tests/` 路径变化]** → `git log --follow` 可以追踪重命名，影响可控。
