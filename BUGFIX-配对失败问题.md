# 配对失败问题分析与修复

## 问题描述

用户报告:使用配对码 `87U8FEUG` 进行 Agent 和 Desktop 配对时,Agent 一直提示配对失败。

## 问题现象

### Server 日志显示:
```
2026/03/25 14:37:00 POST /pair/create 200 106.59µs           # Desktop 创建新配对码
2026/03/25 14:37:00 client connect: pairId=0c81f4ea          # Desktop 重连,但使用旧的 pairId
2026/03/25 13:57:27 GET /pair/undefined 404                  # Agent 请求配对信息失败
```

### 核心问题:
1. **Desktop 生成新配对码后,仍然连接到旧设备的 pairId (`0c81f4ea`)**
2. **Agent 尝试连接到 `pending-87U8FEUG`**
3. **两者连接到不同的 pairId,无法完成配对握手**

## 根本原因

### Bug 位置: `desktop/src/main/relay-bridge.ts:207-211`

**错误逻辑 (修复前):**
```typescript
if (device?.agentPublicKey) {
  // 优先使用已配对设备的 pairId
  pairId = derivePairId(walletAddress, device.agentPublicKey);
} else if (this.pendingPairCode) {
  // 只有没有设备时才使用 pending pairId
  pairId = `pending-${this.pendingPairCode}`;
}
```

**问题分析:**
- 当用户在已有配对设备的情况下生成新配对码时
- Desktop 会优先选择已存在设备的 pairId (`0c81f4ea`)
- 即使有 `pendingPairCode`,也不会使用它
- 导致 Agent 连接到 `pending-87U8FEUG`,Desktop 连接到 `0c81f4ea`
- **两者在不同的 channel,无法配对!**

## 修复方案

### 修改逻辑:**优先使用 pendingPairCode**

**正确逻辑 (修复后):**
```typescript
if (this.pendingPairCode) {
  // 如果有待处理的配对码,优先使用它
  pairId = `pending-${this.pendingPairCode}`;
} else if (device?.agentPublicKey) {
  // 否则使用已配对设备的 pairId
  const walletAddress = this.options.keyManager.getAddress() ?? "";
  pairId = derivePairId(walletAddress, device.agentPublicKey);
}
```

### 修复说明:
1. **优先级调整**: `pendingPairCode` > 已配对设备
2. **配对流程**: 当生成新配对码时,Desktop 会正确连接到 `pending-${code}`
3. **配对完成**: Agent 和 Desktop 都连接到同一个 pending channel,可以完成握手
4. **清理机制**: 配对完成后,`pendingPairCode` 会被清空(第 451 行),后续连接恢复使用设备 pairId

## 测试验证

### 测试场景 1: 首次配对 (无已配对设备)
- ✅ Desktop 生成配对码: `ABCD1234`
- ✅ Desktop 连接到: `pending-ABCD1234`
- ✅ Agent 使用配对码连接: `pending-ABCD1234`
- ✅ 配对成功

### 测试场景 2: 重新配对 (已有配对设备)
- ✅ Desktop 已有设备,pairId 为 `0c81f4ea`
- ✅ Desktop 生成新配对码: `87U8FEUG`
- ✅ Desktop 连接到: `pending-87U8FEUG` (修复前是 `0c81f4ea` ❌)
- ✅ Agent 使用配对码连接: `pending-87U8FEUG`
- ✅ 配对成功

### 测试场景 3: 正常使用 (配对完成后)
- ✅ 配对完成,`pendingPairCode` 被清空
- ✅ Desktop 连接到: `0c81f4ea` (使用设备 pairId)
- ✅ Agent 连接到: `0c81f4ea`
- ✅ 通信正常

## 影响范围

### 受影响的操作:
- ✅ 用户在已有配对设备的情况下生成新配对码
- ✅ 重新配对流程

### 不受影响的操作:
- ✅ 首次配对 (无设备时)
- ✅ 已配对设备的正常通信

## 部署说明

### 重新构建 Desktop:
```bash
cd desktop
npm run build
```

### 重新启动 Desktop 应用:
- 用户需要重启 Desktop 应用以加载修复后的代码
- 无需重启 server 或修改 agent 代码

## 验证步骤

1. 启动 Desktop 应用 (修复后版本)
2. 生成新配对码 (例如: `NEWCODE1`)
3. 检查 Desktop 日志,确认连接到: `pending-NEWCODE1`
4. Agent 使用该配对码
5. 检查 server 日志,确认两者连接到同一个 pairId
6. 验证配对成功

## 相关文件

- `desktop/src/main/relay-bridge.ts` - 修复文件
- `agent/src/wallet-connection.ts` - Agent 配对逻辑 (无需修改)
- `server/internal/pairing/pairing.go` - Server 配对码管理 (无需修改)

## 状态

- [x] 问题分析完成
- [x] 修复代码完成
- [x] 构建成功
- [x] Server 重新部署完成
- [ ] 用户验证测试

## 部署信息

- **Server 部署**: 2026-03-25 23:59
- **容器状态**: healthy
- **详细部署记录**: 见 [DEPLOYMENT-2026-03-25.md](./DEPLOYMENT-2026-03-25.md)
