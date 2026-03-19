## Why

Relay Server 的核心模块（hub WebSocket 中继、middleware、iputil）当前零测试覆盖，pairing 模块也存在过期码解析、异常 JSON 等场景的覆盖缺口。缺少测试意味着框架迁移到 Hertz 后的行为正确性无法被自动验证，后续功能迭代和重构的回归风险高。需要为每个模块补充充分的端到端测试用例，建立质量基线。

## What Changes

- 新增 `internal/hub/hub_test.go`：WebSocket 连接、配对中继、断连通知、速率限制、pair 容量限制等端到端测试
- 新增 `internal/middleware/middleware_test.go`：CORS 中间件和 Access Log 中间件的行为验证
- 新增 `internal/iputil/iputil_test.go`：IP 提取逻辑的多场景覆盖
- 补充 `internal/pairing/pairing_test.go`：过期码解析、异常 JSON、大小写无关性等缺失场景
- 新增 `cmd/relay/main_test.go`：服务级集成测试，验证路由注册、健康端点、中间件串联

## Capabilities

### New Capabilities
- `server-e2e-testing`: 服务器各模块的端到端测试能力，涵盖 WebSocket、HTTP handler、中间件、工具函数的自动化验证

### Modified Capabilities

_(无需修改现有 spec — 本次仅增加测试，不改变行为需求)_

## Impact

- **代码**: `server/` 下新增 4 个测试文件，补充 1 个测试文件
- **依赖**: 可能需要添加 `net/http/httptest`（标准库）用于 WebSocket 端到端测试
- **API**: 无变更
- **CI**: 测试用例数从 6 增加到 25+ 个
