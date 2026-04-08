## Why

每次切换到首页都从链上重新加载所有资产，导致用户等待数秒才能看到余额，严重影响桌面端体验。需要引入跨会话的持久化缓存，使用户能立即看到上次的资产状态，同时后台静默更新。

## What Changes

- **新增** 持久化资产缓存服务（`AssetCacheService`），将账户资产快照以 JSON 文件形式存储到 Electron userData 目录
- **新增** 首页加载策略：有缓存时先展示缓存数据，再后台分两阶段更新（已有资产 → 常见资产扫描）
- **修改** Agent 余额查询行为：无指定币种/链时直接返回磁盘缓存；有指定时链上查询后 upsert 回缓存
- **修改** `balance-aggregation` 缓存策略：从 10 秒内存缓存升级为持久化磁盘缓存 + 后台刷新机制

## Capabilities

### New Capabilities

- `asset-persistent-cache`: 跨会话的资产持久化缓存，包含余额快照存取、后台两阶段刷新、Agent 查询缓存集成

### Modified Capabilities

- `balance-aggregation`: 缓存策略从"10 秒内存缓存、每次打开首页重新加载"变更为"磁盘持久化、有缓存立即展示、后台更新"

## Impact

- **新文件**: `desktop/src/main/asset-cache-service.ts`
- **修改**: `desktop/src/main/balance-service.ts` — 集成持久化缓存读写
- **修改**: `desktop/src/renderer/app.js` — 首页加载逻辑改为"缓存先行 + 后台刷新"两阶段渲染
- **修改**: `desktop/src/main/relay-account-channel.ts` — `wallet_get_balances` 感知磁盘缓存
- **修改**: `desktop/src/main/index.ts` — 初始化 AssetCacheService，注册新 IPC handler
- **修改**: `desktop/src/preload/index.ts` — 暴露缓存相关 API 给渲染进程
- **依赖**: 无新增外部依赖，使用 Node.js `fs` 模块读写 JSON 文件
