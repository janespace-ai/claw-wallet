<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <b>Deutsch</b> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Deinem KI-Agent eine echte Wallet — sicher.**

Web3-Wallet-Plugin für das [OpenClaw](https://getclaw.sh) KI-Agent-Framework. Eine lokal selbst gehostete, nicht verwahrte Krypto-Wallet, die KI-Agenten ermöglicht, Vermögen zu verwalten, Transaktionen zu senden und mit EVM-Blockchains zu interagieren — dabei bleiben private Schlüssel verschlüsselt und vollständig vom LLM getrennt.

> Private Schlüssel berühren niemals das KI-Modell. Der Agent arbeitet über Tool-APIs, die nur Adressen und Transaktions-Hashes zurückgeben.

---

## Warum claw-wallet?

Wenn KI-Agenten on-chain agieren (Handel, Zahlungen, DeFi-Strategien), entsteht ein Grundkonflikt: **Das Modell muss handeln, darf den Schlüssel aber nie sehen**. claw-wallet löst das durch klare Trennung:

- **Das LLM sieht nur:** Wallet-Adresse, Kontostände, Transaktions-Hashes, Richtlinien-Status.
- **Das LLM sieht nie:** Private Schlüssel, Mnemonics, entschlüsseltes Schlüsselmaterial.

---

## Funktionen

- **Nicht verwahrt & lokal** — Schlüssel verschlüsselt auf deinem Rechner, keine Cloud-Abhängigkeit.
- **Keystore V3** — AES-256-GCM + scrypt KDF, gleicher Standard wie Ethereum-Clients.
- **Richtlinien-Engine** — Limits pro Transaktion und pro Tag, Adress-Whitelist, manuelle Freigabe-Warteschlange. Auch bei Prompt-Injection bleibt die Engine wirksam.
- **Multi-Chain EVM** — Base (Standard, geringe Gas-Kosten) und Ethereum Mainnet.
- **Zwei Modi** — Überwacht (menschliche Freigabe) oder Autonom (innerhalb der Limits).
- **Agent-Kontakte** — P2P-Adressbuch; Agenten lösen Adressen per Namen auf.
- **Kontostands-Monitor** — Hintergrund-Polling für eingehende Überweisungen.
- **Transaktionsverlauf** — Lokaler Cache aller gesendeten/empfangenen Transaktionen.
- **16 OpenClaw-Tools** — Fertige Tool-Definitionen zur Integration.

---

## Anwendungsfälle

**1. Mensch → Agent → Vertrag/Institution**  
Du weisest den Agenten an, einen Händler zu bezahlen, ein NFT zu prägen oder mit einem DeFi-Protokoll zu interagieren. Die Adress-Whitelist stellt sicher, dass nur vorher freigegebene Adressen beliefert werden.

**2. Mensch → Agent → anderer Agent**  
Dein Agent bezahlt einen anderen KI-Agenten für eine Leistung. Kontakte lösen Adressen per Namen (z. B. `"bob-agent"`). Typisch: API-Nutzung, Datenkauf, kollaborative Belohnungen.

**3. Autonomer Agent**  
Der Agent arbeitet eigenständig innerhalb der Richtlinien (Handel, Dienste, Rebalancing). Die Richtlinien-Engine wirkt als **Sicherheits-Schiene**: auch bei voller Autonomie gelten konfigurierbare Ausgabe-Limits.

| | Überwacht | Autonom |
|---|---|---|
| **Entscheider** | Mensch für jede tx außerhalb der Whitelist | Agent innerhalb der Limits |
| **Whitelist** | Erforderlich | Nein |
| **Limits** | Pro tx + täglich | Pro tx + täglich |

---

## Schnellstart

```bash
npm install claw-wallet
```

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();
const tools = wallet.getTools();
// ... Agent nutzt Tools ...
await wallet.shutdown();
```

---

## Sicherheitsmodell

- **Schlüssel-Isolation** — Kein Tool gibt Schlüsselmaterial zurück; selbst `wallet_create` liefert nur die Adresse.
- **Verschlüsselung** — Keystore V3: AES-256-GCM, scrypt (N=131072, r=8, p=1), zufälliges Salt/IV, Dateiberechtigung 0600.
- **Speicher** — Schlüssel werden nur in `signTransaction()`/`signMessage()` entschlüsselt und in `finally` mit `Buffer.fill(0)` gelöscht.
- **Richtlinien** — Laufen vor jeder Signatur; Beträge in **Cent-Ganzzahlen** gegen Float-Angriffe; Whitelist case-insensitive; Freigabe-IDs kryptographisch zufällig.
- **Eingabe** — Adresse, Betrag, Chain, Token, Kontaktname und Keystore-JSON werden validiert; Pfad-Traversal und ungültige KDF-Parameter abgelehnt.
- **Dateien** — Atomares Schreiben (Temp-Datei + Rename), 0600, kein Zugriff außerhalb des Datenverzeichnisses.
- **RPC** — Negative Salden als 0; Gas 0 oder >30M abgelehnt; keine Schlüssel in Fehlermeldungen.

---

## Konfiguration & Speicher

`dataDir` (Standard: `~/.openclaw/wallet`), `defaultChain`, `chains`, `password`, `pollIntervalMs`, `onBalanceChange`.  
Daten: `keystore.json`, `contacts.json`, `history.json`, `policy.json` — alles lokal.

---

## Unterstützte Chains & Tokens

| Chain | Chain ID | Built-in Tokens |
|-------|----------|-----------------|
| Base | 8453 | USDC, USDT |
| Ethereum | 1 | USDC, USDT |

ERC-20 per Vertragsadresse; weitere EVM-Chains per Konfiguration.

---

## Entwicklung

```bash
npm install && npm test && npm run typecheck && npm run build
```

Umfangreiche Funktions- und Sicherheitstests (Keystore, Chain, Contacts, History, Policy, E2E, Input, RPC, Dateisystem).

---

## Anforderungen

Node.js ≥ 18; OpenClaw-kompatibles oder Tool-fähiges Agent-Framework.

---

## Lizenz

MIT
