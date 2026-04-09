## 1. 添加 OpenClaw plugin-sdk 依赖

- [x] 1.1 在 `agent/package.json` 的 `peerDependencies` 加入 `"openclaw": "*"`
- [x] 1.2 在 `devDependencies` 也加入 `"openclaw": "*"`（tsup 构建时需要）
- [ ] 1.3 运行 `npm install` 更新 lockfile（需修复 .npm 目录权限：`sudo chown -R $(id -u):$(id -g) ~/.npm`）

## 2. 迁移 SKILL.md

- [x] 2.1 `mkdir -p agent/skills/claw-wallet/`
- [x] 2.2 `mv skills/claw-wallet/SKILL.md agent/skills/claw-wallet/SKILL.md`
- [x] 2.3 检查是否还有其他文件在 `skills/claw-wallet/`，一并迁移或删除（同时迁移了 `skills/claw-wallet-update/` → `agent/skills/claw-wallet-update/`）
- [x] 2.4 删除空目录 `skills/`

## 3. 新建插件清单

- [x] 3.1 创建 `agent/openclaw.plugin.json`（内容见 design.md）

## 4. 新建插件入口

- [x] 4.1 创建 `agent/src/openclaw-plugin.ts`（内容见 design.md）
- [x] 4.2 确认 `ClawWallet` constructor 接受 `{ relayUrl: string }` 参数，或调整初始化方式

## 5. 更新构建配置

- [x] 5.1 修改 `agent/tsup.config.ts`：`entry` 数组加入 `"src/openclaw-plugin.ts"`
- [x] 5.2 运行 `npm run build`，确认 `dist/openclaw-plugin.js` 生成（DTS 仅为 index，plugin entry 无需类型声明文件）

## 6. 更新 package.json

- [x] 6.1 `files` 数组加入 `"skills"` 和 `"openclaw.plugin.json"`
- [x] 6.2 `exports` 加入 `"./openclaw"` 入口
- [x] 6.3 顶层加入 `"openclaw": { "extensions": ["./dist/openclaw-plugin.js"] }`

## 7. 验证

- [x] 7.1 `npm run build` 通过，无 TypeScript 错误
- [x] 7.2 `npm test` 通过（88 passed；contacts chain-mismatch 1 failure 为 pre-existing bug，与本次改动无关）
- [ ] 7.3 本地安装包后，`openclaw plugins install ./agent` 能正确加载插件
- [ ] 7.4 验证 19 个工具出现在 OpenClaw 工具列表中
- [ ] 7.5 验证 SKILL.md 被加载到 Claude 上下文

## 8. 更新文档

- [ ] 8.1 更新 `agent/CONFIG.md` 或 README：安装方式从 `skills install` 改为 `plugins install`
- [x] 8.2 在 SKILL.md 安装说明中更新命令（新增 `openclaw plugins install claw-wallet`，标记旧方式为 legacy）
