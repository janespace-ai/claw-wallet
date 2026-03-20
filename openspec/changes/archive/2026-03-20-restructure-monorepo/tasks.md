## 1. 迁移构建配置到 agent/

- [x] 1.1 将根目录 `package.json` 移动到 `agent/package.json`
- [x] 1.2 将根目录 `package-lock.json` 移动到 `agent/package-lock.json`
- [x] 1.3 将根目录 `tsconfig.json` 移动到 `agent/tsconfig.json`，修改 `rootDir` 为 `"."`，`include` 为 `["."]`，`exclude` 添加 `"tests"`
- [x] 1.4 将根目录 `tsup.config.ts` 移动到 `agent/tsup.config.ts`，修改 entry 为 `"index.ts"`

## 2. 迁移测试目录

- [x] 2.1 将 `tests/` 目录整体移动到 `agent/tests/`
- [x] 2.2 更新根级测试文件（`e2e.test.ts`、`chain.test.ts`、`contacts.test.ts`、`history.test.ts`、`policy.test.ts`）的 import 路径：`../agent/xxx` → `../xxx`
- [x] 2.3 更新嵌套测试文件（`e2ee/*.test.ts`、`security/*.test.ts`、`signer/*.test.ts`）的 import 路径：`../../agent/xxx` → `../../xxx`

## 3. 清理根目录

- [x] 3.1 删除根目录的 `dist/` 目录（Agent 构建产物）
- [x] 3.2 删除根目录的 `node_modules/` 目录（Agent 依赖）
- [x] 3.3 删除空的 `bin/` 目录
- [x] 3.4 更新根目录 `.gitignore`：调整路径以匹配新结构（`agent/dist/`、`agent/node_modules/` 等），也可保持通配模式 `dist/`、`node_modules/` 不变

## 4. 验证

- [x] 4.1 在 `agent/` 下执行 `npm install` 确认依赖安装正常
- [x] 4.2 在 `agent/` 下执行 `npm run build` 确认构建正常
- [x] 4.3 在 `agent/` 下执行 `npm run typecheck` 确认类型检查通过
- [x] 4.4 在 `agent/` 下执行 `npm test` 确认所有测试通过
