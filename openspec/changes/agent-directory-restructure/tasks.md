## 1. 迁移目录

- [x] 1.1 `mv mcp-server/ agent/mcp-server/`
- [x] 1.2 `mv skills/ agent/skills/`

## 2. 修复路径引用

- [x] 2.1 修改 `agent/mcp-server/package.json` 中 `"claw-wallet": "file:../agent"` → `"claw-wallet": "file:.."`
- [x] 2.2 删除 `agent/mcp-server/node_modules` 和 `package-lock.json`，重新 `npm install`
- [x] 2.3 检查 `.gitignore` 是否需要更新路径

## 3. 验证

- [x] 3.1 `npm run build` in `agent/` 通过
- [x] 3.2 `npm run build` in `agent/mcp-server/` 通过
- [x] 3.3 `npm test` in `agent/` 通过（98 tests）
- [x] 3.4 `npm test` in `agent/mcp-server/` 通过（4 tests）
