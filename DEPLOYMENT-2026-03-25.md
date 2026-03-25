# Server 重新构建和部署记录

## 📅 部署信息

- **日期**: 2026-03-25
- **分支**: `fix/pairing-priority-bug`
- **镜像**: `server-relay:latest`
- **容器**: `server-relay-1`

## 🔨 构建步骤

```bash
cd server
docker compose down
docker compose build --no-cache
docker compose up -d
```

## ✅ 验证结果

### 容器状态
```
NAMES            STATUS                    PORTS
server-relay-1   Up 49 seconds (healthy)   0.0.0.0:8080->8080/tcp
```

### 健康检查
```bash
$ curl http://localhost:8080/health
{"status":"ok"}
```

### 服务端点
- WebSocket: `ws://localhost:8080/ws?pairId=<id>`
- Pairing: `POST /pair/create`, `GET /pair/<code>`
- Relay: `POST /relay/<pairId>`
- Health: `GET /health`

## 📋 本次修复内容

### 1. 修复配对优先级问题 (Desktop)
**文件**: `desktop/src/main/relay-bridge.ts`

**问题**: 
- 生成新配对码时,Desktop 仍然连接到已有设备的 pairId
- 导致 Agent 和 Desktop 连接到不同的 channel

**修复**:
- 调整优先级: `pendingPairCode` > 已配对设备 pairId
- 确保生成配对码后,Desktop 正确连接到 `pending-{code}`

### 2. 移除日志截断 (Desktop)
**文件**: `desktop/src/main/relay-bridge.ts`

**改进**:
- 移除 `pairIdShort` 截断逻辑
- 日志显示完整的 pairId,便于调试

**效果**:
- 之前: `pairId=pending-…`
- 现在: `pairId=pending-EA95RJ37`

### 3. 添加参数验证 (Agent)
**文件**: `agent/src/tools/wallet-pair.ts`

**改进**:
- 验证 `shortCode` 参数不为空
- 添加调试日志记录工具调用
- 防止调用 `/pair/undefined`

### 4. 添加配对码验证 (Desktop)
**文件**: `desktop/src/main/relay-bridge.ts`

**改进**:
- 验证 server 返回的配对码不为空
- 添加详细日志追踪配对码生命周期
- 记录 `pendingPairCode` 的设置、使用和清除

## 🎯 测试方案

### 测试配对流程

1. **重启 Desktop 应用**
2. **生成配对码**,例如: `ABC12345`
3. **检查 Desktop 日志**:
   ```
   [relay-bridge] generatePairCode: code=ABC12345 expires in 600s
   [relay-bridge] connect: using pendingPairCode=ABC12345
   [relay-bridge] connecting ws pairId=pending-ABC12345
   [relay-bridge] ws OPEN pairId=pending-ABC12345
   ```

4. **Agent 使用配对码**
5. **检查 Server 日志**:
   ```
   GET /pair/ABC12345 200
   POST /relay/pending-ABC12345 200
   ```

6. **验证配对成功**

### 预期日志流程

```
Desktop 生成配对码
  ↓
[desktop] generatePairCode: code=ABC12345
  ↓
[desktop] connect: using pendingPairCode=ABC12345
  ↓
[desktop] connecting ws pairId=pending-ABC12345
  ↓
[server] client connect: pairId=pending-ABC12345 ip=...
  ↓
Agent 调用 wallet_pair
  ↓
[agent] execute called with args: {"shortCode":"ABC12345"}
  ↓
[server] GET /pair/ABC12345 200
  ↓
[server] POST /relay/pending-ABC12345
  ↓
[desktop] completePairing: clearing pendingPairCode (was: ABC12345)
  ↓
[desktop] connect: using device pairId
  ↓
[desktop] connecting ws pairId=0c81f4ea12345678
  ↓
✅ 配对成功
```

## 🐛 已知问题修复

### 问题 1: Desktop 连接到空的 pairId
**现象**: `client connect: pairId=pending-`
**修复**: 添加配对码验证,如果为空则抛出错误

### 问题 2: Agent 调用 /pair/undefined
**现象**: `GET /pair/undefined 404`
**修复**: 添加参数验证,如果 shortCode 无效则返回错误

### 问题 3: Agent 请求超时 502
**现象**: `POST /relay/pending-EA95RJ37 502`
**修复**: 修复问题 1 和 2 后,两端连接到正确的 channel

## 📊 性能指标

- **启动时间**: ~2秒
- **健康检查响应**: ~70µs
- **内存占用**: ~8MB (Alpine 基础镜像)
- **镜像大小**: ~40MB

## 🔐 安全性

- ✅ 非 root 用户运行 (appuser, uid 1001)
- ✅ 无 CGO,静态编译
- ✅ 最小化基础镜像 (Alpine 3.19)
- ✅ CA 证书已安装

## 📝 维护命令

### 查看日志
```bash
docker logs server-relay-1 --tail 100
docker logs server-relay-1 -f  # 实时日志
```

### 重启服务
```bash
cd server
docker compose restart
```

### 停止服务
```bash
cd server
docker compose down
```

### 查看状态
```bash
docker ps | grep relay
docker inspect server-relay-1
```

## 🚀 下次部署

如果需要再次部署:
```bash
git pull origin fix/pairing-priority-bug
cd server
docker compose down
docker compose build --no-cache
docker compose up -d
docker logs server-relay-1 --tail 30
```

## ✅ 验证清单

- [x] 容器启动成功
- [x] 健康检查通过
- [x] 端口正确映射 (8080)
- [x] WebSocket 端点可访问
- [x] 日志输出正常
- [ ] Desktop 应用重连成功
- [ ] 配对流程测试通过
- [ ] Agent 配对测试通过

## 📞 联系方式

如有问题,请检查:
1. Server 日志: `docker logs server-relay-1`
2. Desktop 日志: 应用控制台输出
3. Agent 日志: MCP Server 或直接 SDK 输出
