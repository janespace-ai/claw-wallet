## 1. Schema Migration — asset_cache 表

- [x] 1.1 在 `database-service.ts` 新增 `migrateToV7()` 方法，创建 `asset_cache` 表（含 `UNIQUE(address, symbol, chain_id)` 约束）和两个索引
- [x] 1.2 在 `migrate()` 方法中追加 v7 迁移入口（if versionAfterV6 < 7 模式）
- [x] 1.3 更新 `getStats()` 中 `latestKnown` 常量为 7

## 2. AssetCacheService — 缓存读写服务

- [x] 2.1 新建 `desktop/src/main/asset-cache-service.ts`，定义 `CachedAssetEntry` 接口（symbol, token, chain_id, chain_name, decimals, amount, raw_amount, price_usd, updated_at）
- [x] 2.2 实现构造函数，注入 `DatabaseService`，调用 `getDatabase()` 持有 db 引用（与 SigningHistory 保持一致的注入模式）
- [x] 2.3 实现 `getByAddress(address: string): CachedAssetEntry[]` — `SELECT * FROM asset_cache WHERE address = ? ORDER BY updated_at DESC`
- [x] 2.4 实现 `upsertMany(address: string, entries: CachedAssetEntry[])` — 使用 `INSERT INTO asset_cache (...) VALUES (...) ON CONFLICT(address, symbol, chain_id) DO UPDATE SET ...`，在事务中批量执行
- [x] 2.5 实现 `clearByAddress(address: string)` — `DELETE FROM asset_cache WHERE address = ?`

## 3. 主进程初始化与 IPC

- [x] 3.1 在 `desktop/src/main/index.ts` 实例化 `AssetCacheService`，注入已有 `databaseService`
- [x] 3.2 新增 IPC handler `cache:get-cached-assets` — 调用 `assetCacheService.getByAddress(address)` 并返回结果给渲染进程
- [x] 3.3 新增后台刷新函数 `startBackgroundRefresh(address, accountIndex, mainWindow)` — 触发两阶段刷新逻辑
- [x] 3.4 两阶段刷新 Phase 1：对缓存中已有资产并行查链上余额 + 价格，完成后调用 `upsertMany()`，发送 `cache:assets-refreshed` IPC 事件给渲染进程
- [x] 3.5 两阶段刷新 Phase 2：Phase 1 完成后，扫描常见资产白名单中不在缓存内的 token，发现非零余额时 upsert 并再次发送 `cache:assets-refreshed`
- [x] 3.6 在 `desktop/src/preload/index.ts` 暴露 `getCachedAssets(address)` 和 `startBackgroundRefresh(address)` 给渲染进程

## 4. BalanceService — 集成缓存写入

- [x] 4.1 修改 `getWalletBalances()` — 完整 fetch 成功后调用 `assetCacheService.upsertMany(address, entries)`（含价格数据）
- [x] 4.2 修改 `getCachedOrFetchBalances()` — 优先读 SQLite 缓存（via `getByAddress`），无缓存再走链上 fetch
- [x] 4.3 确保 `clearCache()` / `clearCacheForAddress()` 同时调用 `assetCacheService.clearByAddress()`

## 5. 渲染进程 — 三阶段加载逻辑

- [x] 5.1 修改 `app.js` 的 `loadWalletBalances()` — 先调 `wapi().getCachedAssets(address)`，有缓存则立即渲染
- [x] 5.2 有缓存时调用 `wapi().startBackgroundRefresh(address)` 触发后台刷新，不阻塞 UI
- [x] 5.3 监听 `cache:assets-refreshed` IPC 事件，合并更新 `currentBalances` / `currentPrices` 并重新渲染余额列表
- [x] 5.4 无缓存时保持原有全量加载逻辑作为 fallback

## 6. Agent 查询集成 — relay-account-channel

- [x] 6.1 修改 `relay-account-channel.ts` 的 `wallet_get_balances` 分支：无 `tokens`/`chain` 过滤时直接调 `assetCacheService.getByAddress()` 返回
- [x] 6.2 有过滤时：链上查询完成后调用 `assetCacheService.upsertMany()` 写回缓存
- [x] 6.3 无缓存 + 无过滤时：走链上 fetch（原逻辑），完成后 upsertMany 再返回

## 7. 测试与验证

- [x] 7.1 单元测试 `AssetCacheService`：getByAddress（空表）、upsertMany（新增）、upsertMany（更新已有条目）、clearByAddress
- [x] 7.2 测试 migration v7：全新数据库和已有 v6 数据库均能正确建表
- [ ] 7.3 集成测试：首页首次加载 → 缓存写入 → 模拟重启 → getByAddress 立即返回数据
- [ ] 7.4 集成测试：Agent 无过滤查询 → 命中 SQLite 缓存，不发 RPC
- [ ] 7.5 集成测试：Agent 有过滤查询 → upsert 到 asset_cache → getByAddress 可见新条目
- [ ] 7.6 手动验证：应用重启后首页渲染时间 < 200ms（有缓存场景）
