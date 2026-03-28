---
name: desktop-wallet-start
description: Start Claw Wallet Electron - desktop npm install and dev, config, troubleshooting.
---

# Claw Wallet 桌面钱包启动指引

## 适用场景

- 在仓库中第一次或重新运行桌面钱包开发版
- 排查 npm install、原生模块 better-sqlite3、Electron 无法启动等问题

## 环境与路径

- **Node.js**：建议 **20.x / 22.x LTS**；若使用 **24.x**，本地编译原生依赖时可能需要 `CXXFLAGS=-std=c++20`.
- 所有安装与启动命令在仓库的 **`desktop/`** 下执行：

```bash
cd desktop
```

## 首次安装依赖

```bash
npm install
```

**请勿**在项目目录对 npm 使用 `sudo`，否则 `node_modules` 可能出现属主为 `root` 的文件，导致 `EACCES`、`rename` 失败。若已误操作：

```bash
sudo chown -R "$(whoami)" node_modules
```

或删除后重装（不用 sudo）：

```bash
sudo rm -rf node_modules && npm install
```

### better-sqlite3 / node-gyp（Node 24）

若预构建超时或编译报 C++20 相关错误：

```bash
CXXFLAGS="-std=c++20" npm install
```

`postinstall` 会执行 `electron-rebuild -f -w better-sqlite3`，需能正常完成。

## 启动开发版

```bash
npm run dev
```

该脚本会先 `npm run build`，再通过 `scripts/run-electron.mjs` 启动 Electron。`run-electron.mjs` 会清除环境变量 **`ELECTRON_RUN_AS_NODE`**，避免 IDE 注入导致 `electron` 解析异常。

### 常用脚本（均在 `desktop/` 下）

| 命令 | 作用 |
|------|------|
| `npm run dev` | 构建并启动 Electron |
| `npm run build` | 仅完整构建 |
| `npm run typecheck` | TypeScript 检查 |
| `npm run build:main` | 仅编译主进程 |

## 配置与联调

- **`desktop/config.json`**：中继 **`relayUrl`**（可用 **`CLAW_DESKTOP_RELAY_URL`** 覆盖）、各链 **`chains.*.rpcUrl`**、签名预算 **`signing`** 等。
- 本地链 RPC 需与配置一致；Agent 端链与 RPC 需与桌面可连上的节点一致。

## 故障速查

| 现象 | 处理方向 |
|------|----------|
| `EACCES` / `rename` … `better-sqlite3` | 修复 `node_modules` 属主或删除后不用 sudo 重装 |
| Electron 启动异常 | 使用 `npm run dev`；不要带着 `ELECTRON_RUN_AS_NODE` 手动启动 |
| prebuild 超时 | 重试或 `CXXFLAGS` 走本地编译 |
| `Unknown env config "devdir"` | 检查 `~/.npmrc`，移除无效 `devdir`（可选） |

## Agent 使用本 skill 时

- 用户说「启动桌面钱包」：先 **`cd desktop`**，再 **`npm install`** / **`npm run dev`**。
- 拉代码后先确认 **`desktop/node_modules`** 安装成功，再排查功能问题。
