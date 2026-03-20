## Why

项目从 Phase 1（单一 Agent SDK）演进到 Phase 2（Agent + Desktop Wallet + Relay Server 三组件架构），但根目录结构仍停留在 Phase 1 的布局——根目录的 `package.json`、`tsconfig.json`、`tsup.config.ts` 全部只为 `agent/` 服务，`tests/` 也只包含 Agent 的测试。这导致三个独立组件在目录层级上不对称、职责混乱，新开发者难以理解项目结构，且根目录 `npm install` 只安装 Agent 依赖，容易产生误解。

## What Changes

- **将 Agent 的构建配置移入 `agent/` 目录**：把根目录的 `package.json`、`package-lock.json`、`tsconfig.json`、`tsup.config.ts` 移入 `agent/`，使 Agent 与 Desktop、Server 在结构上完全平级
- **将 `tests/` 移入 `agent/`**：Agent 的测试归属到 Agent 目录下，变为 `agent/tests/`
- **清理根目录的 `dist/` 和 `node_modules/`**：这些是 Agent 的构建产物和依赖，移入 `agent/` 后不再需要
- **删除空的 `bin/` 目录**：当前为空，无实际用途
- **在根目录新建协调用的 `package.json`**（可选）：如果需要，可添加一个轻量级的根 `package.json` 提供 workspace-level 的脚本（如 `npm run build:all`），或者根目录完全不放 `package.json`
- **更新所有 import 路径和配置引用**：确保迁移后 Agent 的构建、测试、类型检查都正常工作

## Capabilities

### New Capabilities

（无新 capability——本次变更是纯结构重组，不引入新功能或新 spec）

### Modified Capabilities

（无——不涉及任何 spec 级别的需求变更，仅调整文件组织方式）

## Impact

- **代码文件**：`package.json`、`package-lock.json`、`tsconfig.json`、`tsup.config.ts` 从根目录移入 `agent/`；`tests/` 目录移入 `agent/tests/`；`dist/`、`node_modules/`、`bin/` 从根目录清理
- **构建流程**：Agent 的 `npm install`、`npm run build`、`npm test` 需要在 `agent/` 下执行，而非根目录
- **CI/CD**：如有 GitHub Actions 或其他 CI 配置引用根目录的构建命令，需同步更新
- **npm publish**：Agent 库的发布路径变为 `agent/` 目录
- **开发者体验**：三组件结构清晰对称，新人可快速定位每个组件的入口
