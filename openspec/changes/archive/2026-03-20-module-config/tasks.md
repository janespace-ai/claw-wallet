## 1. Server 配置化

- [x] 1.1 在 `server/` 下创建 `internal/config/config.go`，定义 `Config` 结构体及所有子结构体（WSConfig、RateLimitConfig、PairingConfig），每个字段带英文注释说明用途、默认值和环境变量名，包含 json tag
- [x] 1.2 实现 `LoadConfig()` 函数：读取 `config.json` → 环境变量覆盖 → 返回合并后的 Config
- [x] 1.3 修改 `cmd/relay/main.go`：调用 `LoadConfig()`，将 Config 传递给 hub、pairing、middleware
- [x] 1.4 修改 `internal/hub/hub.go`
- [x] 1.5 修改 `internal/pairing/pairing.go`
- [x] 1.6 修改 `internal/middleware/cors.go`
- [x] 1.7 创建 `server/config.example.json` 示例配置文件，每个字段旁用 `_comment_<field>` 键提供英文说明
- [x] 1.8 更新 `server/.gitignore`（或根 `.gitignore`）排除 `server/config.json`

## 2. Desktop 配置扩展

- [x] 2.1 扩展 `desktop/src/main/config.ts`
- [x] 2.2 修改 `desktop/src/main/relay-bridge.ts`
- [x] 2.3 修改 `desktop/src/main/signing-engine.ts`
- [x] 2.4 修改 `desktop/src/main/lock-manager.ts`
- [x] 2.5 修改 `desktop/src/main/security-monitor.ts`
- [x] 2.6 修改 `desktop/src/main/index.ts`
- [x] 2.7 更新 `desktop/config.example.json`

## 3. Agent 配置化

- [x] 3.1 创建 `agent/config.ts`
- [x] 3.2 修改 `agent/signer/relay-client.ts`
- [x] 3.3 修改 `agent/e2ee/transport.ts`
- [x] 3.4 修改 `agent/policy.ts`
- [x] 3.5 创建 `agent/config.example.json`
- [x] 3.6 更新根 `.gitignore` 排除 `agent/config.json`

## 4. 验证

- [x] 4.1 Server：`go build ./...` 编译通过
- [x] 4.2 Desktop：`npm run build` 编译通过（仅保留之前就存在的模块缺失错误）
- [x] 4.3 Agent：`npm run build && npm run typecheck` 编译和类型检查通过
- [x] 4.4 Agent：`npm test` 所有测试通过（94 tests, 13 files）
