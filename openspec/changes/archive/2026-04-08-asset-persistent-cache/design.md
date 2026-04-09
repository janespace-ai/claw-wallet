## Context

桌面端每次打开首页，`loadWalletBalances()` 都会对全部链（8条）的全部代币发起并行 RPC 查询，加上价格 API 请求，通常需要 3-10 秒才能渲染资产列表。

现有缓存层：
- `BalanceService`：10 秒内存 Map，应用重启即清空
- `PriceService`：5 分钟内存 Map，应用重启即清空

两者均为进程内缓存，跨会话无效。

项目已有 SQLite 基础设施（`better-sqlite3`，`DatabaseService` 单例，WAL 模式，`user_version` 迁移机制），当前 schema 版本为 v6，存储 `signing_history`、`desktop_contacts` 等表，数据库文件位于 `~/.claw-wallet/wallet.db`。

## Goals / Non-Goals

**Goals:**
- 首页秒开：有历史缓存时立即渲染，无需等待链上
- 持久化存储：复用现有 SQLite 数据库，跨 Electron 会话保存
- 后台静默刷新：缓存展示后异步更新，用户无感知
- Agent 集成：Agent 无指定查询直接读缓存；有指定查询写回缓存
- 零新依赖：复用 `better-sqlite3` 和 `DatabaseService`

**Non-Goals:**
- 不做 UI 改动（加载动画、骨架屏等）
- 不做跨账户全局缓存同步
- 不处理缓存加密（数据库文件已受系统权限保护）

## Decisions

### D1：存储方案 — SQLite 复用现有数据库

选择**在现有 `wallet.db` 中新增 `asset_cache` 表**（migration v7），不使用 JSON 文件。

- 原因：项目已有完整 SQLite 基础设施；WAL 模式原生支持并发安全；`INSERT OR REPLACE` / `ON CONFLICT DO UPDATE` 原子 upsert，无需手写写锁；与现有服务注入模式一致
- 备选：独立 JSON 文件（原方案）。缺点：需手写写锁防并发冲突；格式变更需 version 字段手动校验；不符合项目现有风格

### D2：表结构设计

```sql
-- Migration v7
CREATE TABLE asset_cache (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  address     TEXT    NOT NULL,          -- 钱包地址，精确匹配（不用 account_index，防地址换绑导致缓存错配）
  symbol      TEXT    NOT NULL,          -- 代币符号，如 "ETH"、"USDC"
  token       TEXT    NOT NULL,          -- 代币标识，如合约地址或原生标识
  chain_id    INTEGER NOT NULL,          -- EVM chain ID
  chain_name  TEXT    NOT NULL,          -- 链名称，如 "Ethereum"
  decimals    INTEGER NOT NULL,
  amount      TEXT    NOT NULL,          -- 人类可读数量，如 "1.5"
  raw_amount  TEXT    NOT NULL,          -- wei 精度字符串
  price_usd   REAL    NOT NULL DEFAULT 0, -- USD 单价，0 表示未知
  updated_at  INTEGER NOT NULL,          -- 毫秒时间戳，每条资产独立记录
  UNIQUE(address, symbol, chain_id)
);

CREATE INDEX idx_asset_cache_address ON asset_cache(address);
CREATE INDEX idx_asset_cache_updated ON asset_cache(updated_at DESC);
```

**主键选择 `address` 而非 `account_index`**：防止同一账号下地址更换（恢复助记词、换派生路径）时旧缓存错误展示给新地址。`address` 是精确身份标识。

`updated_at` 按行粒度存储（毫秒整数），与项目现有表的时间戳格式一致。`last_full_scan_at` 不存储——后台刷新完成后整体 upsert，时效性由各行 `updated_at` 体现。

### D3：首页加载策略 — 三阶段渲染

```
阶段 0（同步）：SELECT * FROM asset_cache WHERE address = ?
               → 有结果则立即渲染，再进入阶段 1
               → 无结果则直接走阶段 1+2（与现有逻辑等价）

阶段 1（异步）：对缓存中已有资产并行查链上余额 + 价格
               → 每条结果 upsert 回 asset_cache
               → 通过 IPC 事件推送差量到渲染进程

阶段 2（异步，阶段 1 完成后）：扫描常见资产白名单中不在缓存内的 token
               → 发现非零余额则 INSERT，推送 IPC 事件
               → 无新资产则静默完成
```

渲染进程监听 `cache:assets-refreshed` IPC 事件，merge 后刷新余额列表，无需用户触发。

### D4：Agent 查询集成策略

```
wallet_get_balances（relay）：
  IF tokens 未指定 AND chain 未指定:
    → SELECT * FROM asset_cache WHERE address = ?
    → 直接返回，不发 RPC 查询
  ELSE:
    → 链上查询指定 token+chain
    → INSERT OR REPLACE 结果到 asset_cache
    → 返回查询结果
```

upsert 按 `UNIQUE(address, symbol, chain_id)` 冲突策略自动去重更新。Agent 查询过的资产自动进入持久缓存，下次首页打开即可展示。

### D5：AssetCacheService 职责边界

新建 `AssetCacheService`，构造时注入 `DatabaseService`（与 `SigningHistory`、`AccountManager` 等现有服务保持一致的注入模式），只做 SQL 读写，不做链上查询。

```
BalanceService ──reads/writes──▶ AssetCacheService ──SQL──▶ wallet.db / asset_cache
RelayAccountChannel ──reads/writes──▶ AssetCacheService
```

### D6：后台刷新与渲染进程通信

主进程后台刷新（阶段 1/2）完成一批后，通过 `mainWindow.webContents.send('cache:assets-refreshed', { address, assets })` 推送。渲染进程监听并合并更新，无需用户触发。

## Risks / Trade-offs

- **SQLite 读取空结果（首次启动）** → 降级为现有全量加载逻辑，完成后写入缓存；行为与今天相同，无退化
- **缓存数据过旧** → 不设全局 TTL；后台刷新每次启动都会运行，`updated_at` 可供未来 UI 提示使用（本次不做）
- **并发写** → `better-sqlite3` 同步 API + Electron 单主进程，无并发写问题；WAL 模式保证 upsert 原子性，无需额外写锁
- **Schema 变更** → 走标准 `migrateToV7()` 路径，与现有迁移机制完全一致

## Migration Plan

1. 在 `database-service.ts` 新增 `migrateToV7()` 创建 `asset_cache` 表和索引
2. 新增 `AssetCacheService`，注入 `DatabaseService`，实现 `getByAddress` / `upsert` / `clear`
3. 在 `index.ts` 初始化并注入 `AssetCacheService`
4. 修改 `BalanceService.getWalletBalances()` 完成后写缓存
5. 修改 `app.js loadWalletBalances()` 为三阶段逻辑
6. 修改 `relay-account-channel.ts` wallet_get_balances 分支
7. 全程保留原有逻辑作为 fallback（缓存为空时退回原路径）

无需数据迁移，无 breaking change，可随时回滚。

## Open Questions

- 阶段 1 后台刷新时，UI 是否需要显示"正在更新"状态指示？（暂定：不做，保持简洁）
