## Context

`agent/` 是 claw-wallet 的 npm 包根目录（`package.json` 在此）。现有 SDK 通过 `ClawWallet.getTools()` 返回 17 个 `ToolDefinition` 对象，每个包含 `name`、`description`、`parameters`、`execute`。

OpenClaw plugin 系统要求：
- `openclaw.plugin.json`：插件清单（id、skills 路径、configSchema）
- `package.json` 中的 `openclaw.extensions` 字段：指向构建后的插件 entry
- 插件 entry 调用 `definePluginEntry({ register(api) { api.registerTool(...) } })`

OpenClaw `AnyAgentTool` 与现有 `ToolDefinition` 只差一个字段：`label`（显示名），可由 `name` 自动生成。

## Goals / Non-Goals

**Goals:**
- 注册全部 17 个工具到 OpenClaw，使其出现在 LLM tools 数组中
- 同时加载 SKILL.md 给 Claude 作上下文
- 所有新文件收纳在 `agent/` 下，npm publish 时一并打包

**Non-Goals:**
- 不修改任何现有工具的 `execute` 逻辑
- 不支持动态 RELAY_URL 配置（固定为 `http://localhost:8080`）
- 不改变 MCP server 的工作方式

## Decisions

### 1. RELAY_URL 硬编码为 `http://localhost:8080`

桌面应用固定在此端口启动 relay。打包时直接写入 plugin entry，用户无需配置环境变量。

### 2. 插件入口文件位置：`agent/src/openclaw-plugin.ts`

与现有 `src/index.ts` 并列，由 tsup 独立构建为 `dist/openclaw-plugin.js`。不创建独立子目录，保持结构简单。

### 3. `definePluginEntry` 使用同步 `register()`

`ClawWallet.getTools()` 是同步方法，工具注册无需 async。真正的网络连接发生在 `execute()` 被调用时（HTTP to relay），不阻塞启动。

### 4. `label` 字段由 `name` 生成

```
wallet_balance → "wallet balance"（下划线替换为空格）
```

### 5. SKILL.md 移入 `agent/skills/claw-wallet/`

与 `agent-directory-restructure` 变更方向一致。plugin manifest 通过 `"skills": ["./skills/claw-wallet"]` 引用。

## Architecture

```
openclaw plugins install claw-wallet
  │
  ├── 读 agent/openclaw.plugin.json
  │   ├── id: "claw-wallet"
  │   ├── skills: ["./skills/claw-wallet"]  ─────▶ 加载 SKILL.md 到 Claude 上下文
  │   └── extensions: via package.json
  │
  └── 加载 dist/openclaw-plugin.js
      └── definePluginEntry.register(api)
          └── new ClawWallet({ relayUrl: "http://localhost:8080" })
              └── getTools() × 17
                  └── api.registerTool({ label, ...tool }) × 17

LLM 调用时：
  OpenClaw → Anthropic API
    tools: [wallet_balance, wallet_send, wallet_call_contract, ...]
      ↓ LLM 返回 tool_use
    OpenClaw.tool.execute({ ... })  ← 直接函数调用，无子进程
      ↓
    WalletConnection.sendToWallet()  ← HTTP to localhost:8080
      ↓
    桌面应用处理、返回结果
```

## File Changes

### 新建：`agent/openclaw.plugin.json`

```json
{
  "id": "claw-wallet",
  "enabledByDefault": true,
  "skills": ["./skills/claw-wallet"],
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

### 新建：`agent/src/openclaw-plugin.ts`

```typescript
import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'
import { ClawWallet } from './index.js'

const RELAY_URL = 'http://localhost:8080'

export default definePluginEntry({
  id: 'claw-wallet',
  name: 'Claw Wallet',
  description: 'Web3 wallet tools — balance, send, DeFi contract calls, EIP-712 signing',
  register(api) {
    const wallet = new ClawWallet({ relayUrl: RELAY_URL })
    for (const tool of wallet.getTools()) {
      api.registerTool({
        label: tool.name.replace(/_/g, ' '),
        ...tool,
      })
    }
  },
})
```

### 修改：`agent/package.json`

```json
{
  "files": ["dist", "skills", "openclaw.plugin.json"],
  "exports": {
    ".": { "...existing..." },
    "./openclaw": {
      "types": "./dist/openclaw-plugin.d.ts",
      "import": "./dist/openclaw-plugin.js"
    }
  },
  "openclaw": {
    "extensions": ["./dist/openclaw-plugin.js"]
  }
}
```

### 修改：`agent/tsup.config.ts`

```typescript
entry: ["src/index.ts", "src/openclaw-plugin.ts"]
```

### 移动：`skills/claw-wallet/SKILL.md` → `agent/skills/claw-wallet/SKILL.md`

## Risks / Trade-offs

**[已确认] plugin-sdk 包名和导入路径**：
- 包名：`openclaw`（主包，非独立子包）
- 导入：`import { definePluginEntry } from 'openclaw/plugin-sdk/plugin-entry'`
- `openclaw` 加入 `agent/package.json` 的 `peerDependencies`（用户安装 claw-wallet plugin 时，OpenClaw 运行时已在环境中）

**[Trade-off] 同一包两种用途**：npm 包既是可直接 import 的 SDK，也是 OpenClaw plugin。这是有意为之——减少维护负担，一次发布覆盖两种场景。
