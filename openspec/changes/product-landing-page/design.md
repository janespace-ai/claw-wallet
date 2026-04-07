# Design: Product Landing Page

## Tech Stack

- **HTML + Tailwind CSS (CDN)** — no build step, no Node.js required
- **Static HTML** GitHub Actions workflow — commit → auto-deploy
- **Vanilla JS** — only for language redirect and mobile nav toggle (< 20 lines)
- Zero framework dependencies

Rationale: Matches the "Static HTML" workflow selected in GitHub Pages settings. Fastest path from code to live site.

## Repository Structure

This page is built in the `janespace-ai/janespace-ai.github.io` repo (not this repo):

```
janespace-ai.github.io/
├── index.html                  ← Root: auto-redirect based on browser lang
├── web/
│   ├── en/
│   │   └── index.html          ← English landing page
│   └── zh/
│       └── index.html          ← Chinese landing page
├── assets/
│   ├── screenshots/
│   │   ├── home-dark.png       ← 03 Home (Dark) — j2xlg
│   │   ├── pair-code-dark.png  ← 05 Home Pair Code (Dark) — MknpX
│   │   ├── tx-approval-dark.png← 07 Tx Approval (Dark) — fD7L8
│   │   └── welcome-dark.png    ← 01 Welcome (Dark) — nuKWU
│   └── logo.svg
└── .github/
    └── workflows/
        └── static.yml          ← GitHub Actions Static HTML workflow
```

## Page Sections

### 1. Navbar
- Logo (left) + Language switcher EN | 中文 (right)
- Sticky, dark background `#0D0F17`
- No hamburger on desktop; mobile collapses to top bar

### 2. Hero
```
[Left: text]                          [Right: screenshot — Home Dark]

  Tag: "AI × Web3"

  Title:
  EN: "Give Your AI Agent a Real Crypto Wallet"
  ZH: "让你的 AI Agent 拥有真正的加密钱包"

  Subtitle:
  EN: "Transfer tokens, swap on Uniswap, interact with DeFi — all in natural language.
       Your private keys never leave your device."
  ZH: "转账、Uniswap 兑换、DeFi 交互 — 全部通过自然语言完成。
       私钥永远不离开你的设备。"

  CTA buttons:
  [Download Desktop App ↓]   ← href="#" placeholder
  [View on GitHub →]         ← href to github.com/janespace-ai/claw-wallet
```

### 3. How It Works (4-step flow)
Four cards in a horizontal row (2×2 on mobile):

| Step | Icon | Title (EN) | Title (ZH) | Screenshot |
|------|------|------------|------------|------------|
| 1 | ⬇️ | Install Desktop App | 安装桌面应用 | welcome-dark.png |
| 2 | 🤖 | Install the Skill | 安装 Skill | — (code snippet) |
| 3 | 🔗 | Generate Pairing Code | 生成配对码 | pair-code-dark.png |
| 4 | ✨ | Start Using | 开始使用 | tx-approval-dark.png |

Step 2 shows a code block:
```
npx skills add janespace-ai/claw-wallet
```

### 4. Features Grid
Six feature cards (3×2):

| Icon | EN Title | ZH Title | EN Desc | ZH Desc |
|------|----------|----------|---------|---------|
| 🔐 | Keys Stay On Your Device | 私钥本地保管 | Private keys live in the desktop app, never in the AI model | 私钥存储在桌面应用，AI 模型永远无法访问 |
| 💸 | Send Tokens | 转账 | ETH, USDC, and more across Ethereum, Base, Arbitrum | 支持 ETH、USDC 等，覆盖以太坊、Base、Arbitrum |
| 🔄 | DeFi Swaps | DeFi 兑换 | Swap on Uniswap, deposit to Aave — via natural language | 通过自然语言在 Uniswap 兑换、向 Aave 存款 |
| ✍️ | EIP-712 Signing | EIP-712 签名 | Sign typed data for Hyperliquid orders, Permit2, and more | 为 Hyperliquid 下单、Permit2 授权等场景签名 |
| 👀 | You Approve Every Tx | 每笔交易你来审批 | Desktop app shows every request before signing | 每次签名前桌面应用都会展示请求详情 |
| 🌐 | Multi-Chain | 多链支持 | Ethereum, Base, Arbitrum, Polygon and more | 以太坊、Base、Arbitrum、Polygon 等 |

### 5. Security Section
Dark card with the architecture diagram (ASCII → styled HTML):

```
AI Agent  ←─ E2EE ─→  Relay Server  ←─ E2EE ─→  Desktop Wallet
(zero keys)           (sees ciphertext)          (holds all keys)
```

Copy:
- EN: "Three-component design. Even if the AI model is fully compromised, the attacker gains zero key material."
- ZH: "三组件隔离架构。即便 AI 模型完全被攻破，攻击者也无法获得任何密钥。"

### 6. Footer
- Links: GitHub | English | 中文
- License: MIT
- "Built for OpenClaw AI Agents"

## Visual Design

- **Background**: `#0D0F17` (matches desktop dark theme)
- **Primary accent**: `#6D6BF8` (purple, from desktop UI)
- **Text primary**: `#F0F0F5`
- **Text secondary**: `#8B8BA7`
- **Card background**: `#161824`
- **Border**: `#2A2D40`
- **Font**: System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- **Code blocks**: `#0F111A` bg, `#C4B5FD` text (Geist Mono style via `font-mono`)

## Language Switching

Root `index.html` auto-redirects:
```javascript
const lang = navigator.language.startsWith('zh') ? 'zh' : 'en';
window.location.replace(`/web/${lang}/`);
```

Each page has a language switcher in the navbar linking to the other language's path.

## Screenshot Assets

Export from Pencil (node IDs in `docs/design/desktop-redesign.pen`):

| File | Node ID | Screen |
|------|---------|--------|
| `welcome-dark.png` | `nuKWU` | 01 Welcome (Dark) |
| `home-dark.png` | `j2xlg` | 03 Home (Dark) |
| `pair-code-dark.png` | `MknpX` | 05 Home Pair Code (Dark) |
| `tx-approval-dark.png` | `fD7L8` | 07 Tx Approval (Dark) |

Screenshots should be displayed at ~280px wide with a subtle drop shadow and slight rotation (2°) for visual interest.

## GitHub Actions Workflow

The Static HTML workflow generated by GitHub Pages settings:
```yaml
# .github/workflows/static.yml (auto-generated, no changes needed)
# Deploys everything in repo root to GitHub Pages
```

No custom build step needed — all files are static.
