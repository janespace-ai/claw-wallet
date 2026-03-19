<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <b>Deutsch</b> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Geben Sie Ihrem KI-Agenten eine echte Wallet — sicher.**

Eine nicht-verwahrende Krypto-Wallet für [OpenClaw](https://getclaw.sh) KI-Agenten. Private Schlüssel befinden sich in einer separaten **Electron-Desktop-Wallet**, vollständig isoliert vom KI-Modell. Der Agent und die Desktop-App kommunizieren über einen **E2EE (Ende-zu-Ende-verschlüsselten)** Kanal durch einen **Go-Relay-Server** — der Relay leitet nur Chiffretext weiter und kann Nachrichten niemals lesen oder manipulieren.

> Private Schlüssel berühren niemals das KI-Modell. Nicht auf derselben Maschine, nicht im selben Prozess, nicht im Speicher. Der Agent sieht nur Wallet-Adressen und Transaktions-Hashes.

---

## Architektur

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ Zero secrets │                               │ Stateless    │                               │ Holds all keys   │
│ Tool APIs    │                               │ WS forwarder │                               │ Signs locally    │
│ JSON-RPC IPC │                               │ IP binding   │                               │ Security monitor │
│ 17 MCP tools │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  Agent never sees:                                                        Desktop holds:     │
       │  • private keys                                                           • BIP-39 mnemonic  │
       │  • mnemonics                                                              • Keystore V3 file │
       │  • key material                                                           • Signing engine    │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Drei-Komponenten-Design**: Jede Komponente hat eine einzige Verantwortung. Selbst wenn der Host des Agenten vollständig kompromittiert wird, erhält der Angreifer kein Schlüsselmaterial.

---

## Benutzerinteraktionsablauf

### Ersteinrichtung: Kopplung

Nur einmalig erforderlich. Nach der ersten Kopplung erfolgt die Wiederverbindung vollautomatisch.

```
 You                          Desktop Wallet                 Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Create wallet
    (set password,            Generates BIP-39 mnemonic
     backup mnemonic)         Encrypts with AES-256-GCM
                              + scrypt KDF
                                    │
 2. Click "Generate           Generates 8-char pairing
    Pairing Code"             code (valid 10 min)
                                    │
 3. Copy code to Agent              │                                              Agent calls
    (or send via secure             │                                              wallet_pair
    channel)                        │                                              { shortCode }
                                    │                         ◄──── Agent registers ────┘
                                    │                               with code
                              Desktop connects ────────────►  Relay matches pair
                              X25519 key exchange ◄─────────► E2EE session established
                                    │
                              Saves persistent comm          Agent saves persistent
                              key pair (encrypted)           comm key pair (0600)
                                    │
                              Derives deterministic          Derives same pairId
                              pairId = SHA256(addr +         = SHA256(addr +
                              agentPubKey)[:16]              agentPubKey)[:16]
                                    │
 ✓ Paired!                    Ready to sign                  Ready to transact
```

### Tägliche Nutzung: Automatische Wiederverbindung

Nach der ersten Kopplung verbinden sich Agent und Desktop beim Neustart automatisch wieder — keine Benutzeraktion erforderlich.

```
 Agent restarts               Desktop restarts
       │                             │
 Loads persistent             Loads persistent
 comm key pair                comm key pair (decrypts
 from disk                    with wallet password)
       │                             │
 Recomputes pairId            Recomputes same pairId
       │                             │
 Connects to Relay ──────────► Relay routes by pairId ──────► Desktop receives
       │                                                             │
 Sends extended handshake:                                    Three-level verification:
 • publicKey                                                  ✓ Level 1: Public key matches stored key
 • machineId                                                  ✓ Level 2: machineId matches stored ID
 • reconnect: true                                            ✓ Level 3: IP change policy (configurable)
       │                                                             │
 E2EE session restored ◄──────────────────────────────────── Session active
       │                                                             │
 Ready to transact                                            Ready to sign
```

### Transaktionsablauf

```
 You (chat with Agent)                AI Agent                        Desktop Wallet
──────────────────────────────────────────────────────────────────────────────────────
 "Send 0.5 ETH to Bob           wallet_send
  on Base"                         to: "bob"  (contact)
                                   amount: 0.5
                                   chain: base
                                        │
                                 Resolve contact ──► Bob = 0x742d...
                                 Build tx request
                                        │
                                 E2EE encrypt ──────────────────► Decrypt request
                                                                       │
                                                                 Policy check:
                                                                   ✓ Within per-tx limit
                                                                   ✓ Within daily limit
                                                                   ✓ Device not frozen
                                                                       │
                                                                 Decrypt private key
                                                                 Sign transaction
                                                                 Zero key from memory
                                                                 Broadcast to chain
                                                                       │
                                 Receive result ◄────────────────── tx hash + receipt
                                        │
                                 Return to you:
                                 "Sent 0.5 ETH to Bob
                                  tx: 0xab3f..."
```

---

## Sicherheitsarchitektur

claw-wallet verwendet **gestaffelte Verteidigung** mit zwei unabhängigen Sicherheitsdomänen: **Kommunikationssicherheit** (wie Komponenten kommunizieren) und **Schlüsselsicherheit** (wie Schlüssel gespeichert und verwendet werden).

### Teil A: Kommunikationssicherheit

#### 1. Ende-zu-Ende-Verschlüsselung (E2EE)

Alle Nachrichten zwischen Agent und Desktop sind Ende-zu-Ende-verschlüsselt. Der Relay-Server sieht nur Chiffretext.

| Komponente | Detail |
|------------|--------|
| **Schlüsselaustausch** | X25519 ECDH (Curve25519) |
| **Schlüsselableitung** | HKDF-SHA256 |
| **Verschlüsselung** | AES-256-GCM (authentifiziert) |
| **Anti-Replay** | Inkrementierender Nonce pro Nachricht |
| **Forward Secrecy** | Neue ephemere Schlüssel pro Sitzung |

#### 2. Automatische Kopplung und Wiederverbindung

Manuelle Kopplung ist nur einmalig erforderlich. Das System verwendet **persistente Kommunikationsschlüsselpaare** und **deterministische Paar-IDs** für die automatische Wiederverbindung:

- **Persistente Schlüsselpaare**: X25519-Schlüsselpaare werden auf der Festplatte gespeichert — verschlüsselt mit dem Wallet-Passwort auf dem Desktop (scrypt + AES-256-GCM), durch Dateiberechtigungen geschützt (0600) auf dem Agenten
- **Deterministische PairId**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — beide Seiten berechnen unabhängig dieselbe ID, keine Koordination erforderlich
- **Wiederverbindung ohne Interaktion**: Beim Neustart laden beide Seiten ihre gespeicherten Schlüssel, berechnen die pairId neu und verbinden sich automatisch über den Relay

#### 3. Drei-Stufen-Wiederverbindungsverifizierung

Wenn sich ein Agent erneut verbindet, führt der Desktop drei Identitätsprüfungen durch, bevor eine Signierung zugelassen wird:

| Stufe | Prüfung | Aktion bei Fehler |
|-------|---------|-------------------|
| **Stufe 1** (Hart) | Öffentlicher Schlüssel stimmt mit gespeichertem Schlüssel überein | Ablehnung + erzwungene Neukopplung |
| **Stufe 2** (Hart) | machineId stimmt mit gespeicherter ID überein | Sitzung einfrieren + erzwungene Neukopplung |
| **Stufe 3** (Konfigurierbar) | IP-Adressänderungsrichtlinie | `block` / `warn` (Standard) / `allow` |

- **machineId**: SHA256(Hostname + MAC-Adresse) — erkennt, ob der Agent auf eine andere Maschine verschoben wurde
- **Sitzungseinfrierung**: Wenn eine Identitätsabweichung erkannt wird, werden alle Signierungsanfragen blockiert, bis der Benutzer manuell eine Neukopplung durchführt
- **IP-Richtlinie**: Konfigurierbar pro Deployment — `block` lehnt sofort ab, `warn` warnt den Benutzer, erlaubt aber (mit Toleranz im gleichen Subnetz), `allow` überspringt die Prüfung

#### 4. Relay-seitige Schutzmaßnahmen

Der Go-Relay-Server erzwingt zusätzliche Sicherheitsmaßnahmen, obwohl er den Nachrichteninhalt nicht lesen kann:

| Schutzmaßnahme | Detail |
|----------------|--------|
| **IP-Bindung pro pairId** | Maximal 2 verschiedene Quell-IPs pro Paar gleichzeitig |
| **Verbindungsratenlimit** | Maximal 10 neue WebSocket-Verbindungen pro pairId pro Minute |
| **Verbindungsverdrängung** | Wenn sich ein dritter Client mit einem Paar verbindet, wird der älteste verdrängt |
| **Metadaten-Protokollierung** | Verbindungsereignisse mit gekürzter pairId für Audits protokolliert |

#### 5. Manueller Neukopplungs-Fallback

Wenn die automatische Wiederverbindung fehlschlägt (Gerätewechsel, Schlüsselbeschädigung usw.):

- **Agent-Seite**: Die RPC-Methode `wallet_repair` löscht gespeicherte Kopplungsdaten und setzt den Zustand zurück
- **Desktop-Seite**: Aktion „Gerät neu koppeln" im Sicherheits-Panel der Benutzeroberfläche
- Beide Seiten generieren neue Schlüsselpaare, was einen neuen Kopplungscode-Austausch erfordert

### Teil B: Schlüsselsicherheit

#### 6. Schlüsselisolierung — Schlüssel berühren niemals das KI-Modell

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  NO access to:     │                   │  Private key only  │
│  - private keys    │                   │  decrypted inside  │
│  - keystore file   │                   │  signTransaction() │
│  - password        │                   │  then zeroed       │
└────────────────────┘                   └────────────────────┘
```

Der Agent interagiert ausschließlich über Tool-APIs. Kein Tool gibt jemals Schlüsselmaterial zurück.

#### 7. Verschlüsselung im Ruhezustand — Keystore V3

| Komponente | Detail |
|------------|--------|
| **Verschlüsselung** | AES-256-GCM (authentifizierte Verschlüsselung) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 Byte zufällig pro Verschlüsselung |
| **IV** | 16 Byte zufällig pro Verschlüsselung |
| **Auth-Tag** | GCM-Tag verhindert Chiffretext-Manipulation |
| **Dateiberechtigungen** | 0600 (nur Eigentümer lesen/schreiben) |

#### 8. Speichersicherheit

- Private Schlüssel werden nur während `signTransaction()` / `signMessage()` entschlüsselt
- Schlüsselpuffer werden mit `Buffer.fill(0)` in `finally`-Blöcken genullt — auch wenn die Signierung fehlschlägt
- Entschlüsseltes Schlüsselmaterial existiert im Speicher für Millisekunden, nicht Sekunden

#### 9. Richtlinien-Engine — Unabhängige Ausgabenkontrollen

Die Richtlinien-Engine wird **vor** jeder Signierung ausgeführt und kann nicht durch Prompt-Injection umgangen werden:

| Kontrolle | Standard | Beschreibung |
|-----------|----------|-------------|
| Limit pro Transaktion | 100 $ | Maximaler Betrag einer einzelnen Transaktion |
| Tageslimit | 500 $ | Gleitendes 24-Stunden-Ausgabenlimit |
| Adress-Whitelist | Leer | In überwachtem Modus erforderlich |
| Betriebsmodus | Überwacht | `supervised` (Whitelist erforderlich) oder `autonomous` (nur Limits) |
| Genehmigungswarteschlange | 24h Ablauf | Blockierte Transaktionen werden zur manuellen Prüfung eingereiht |

**Anti-Umgehungsmaßnahmen:**
- Ganzzahl-Cent-Arithmetik zur Vermeidung von Gleitkomma-Präzisionsangriffen
- Groß-/Kleinschreibung-unempfindlicher Whitelist-Abgleich
- Kryptographisch zufällige Genehmigungs-IDs (nicht sequentiell, nicht erratbar)

#### 10. Eingabevalidierung

| Eingabe | Validierung |
|---------|-----------|
| Adresse | Hex-Format, Länge=42, EIP-55-Prüfsumme via viem |
| Betrag | Lehnt NaN, Infinity, negativ, Null, leer ab |
| Chain | Strikte Whitelist (`base`, `ethereum`) |
| Token-Symbol | Maximal 20 Zeichen, lehnt Injektionszeichen ab |
| Kontaktname | Maximal 100 Zeichen, lehnt Pfadtraversierung ab |

#### 11. Dateisystem- und RPC-Sicherheit

- **Atomare Schreibvorgänge**: Schreiben in temporäre Datei → Umbenennen (verhindert Beschädigung bei Absturz)
- **0600-Berechtigungen**: Nur der Eigentümer kann sensible Dateien lesen/schreiben
- **Pfadtraversierungs-Schutz**: `sanitizePath()` lehnt Pfade außerhalb des Datenverzeichnisses ab
- **Gas-Plausibilitätsprüfungen**: Lehnt Gas von 0 und Gas-Schätzungen > 30M ab
- **Kein Schlüssel-Leak**: Fehlermeldungen enthalten niemals private Schlüssel oder Passwörter

---

## Funktionen

- **Nicht-verwahrend und isoliert** — Schlüssel auf dem Desktop, Agent hält keinerlei Geheimnisse
- **Ende-zu-Ende-verschlüsselt** — X25519 + AES-256-GCM, Relay sieht nur Chiffretext
- **Automatische Kopplung** — Einmalige Einrichtung, automatische Wiederverbindung nach Neustarts
- **Drei-Stufen-Verifizierung** — Öffentlicher Schlüssel + Geräte-Fingerabdruck + IP-Richtlinie bei jeder Wiederverbindung
- **Keystore V3-Verschlüsselung** — AES-256-GCM + scrypt KDF für Schlüssel im Ruhezustand
- **Richtlinien-Engine** — Limits pro Transaktion und täglich, Adress-Whitelist, Genehmigungswarteschlange
- **Multi-Chain EVM** — Base (Standard, niedrige Gas-Kosten) und Ethereum Mainnet, erweiterbar auf jede EVM-Chain
- **Dualer Betriebsmodus** — Überwacht (menschliche Genehmigung) oder Autonom (innerhalb der Limits)
- **Agenten-Kontakte** — P2P-Adressbuch mit Namensauflösung
- **Saldenüberwachung** — Hintergrund-Abfrage für eingehende Überweisungen
- **Transaktionsverlauf** — Lokaler Cache mit vollständigen Aufzeichnungen
- **Containerisierter Relay** — Go-Relay-Server mit Docker-Unterstützung (Hertz-Framework)
- **17 MCP-Tools** — Einsatzbereite Tool-Definitionen für die Integration von KI-Agenten

---

## Schnellstart

### Voraussetzungen

- Node.js ≥ 18
- Go ≥ 1.21 (für den Relay-Server)
- Ein OpenClaw-kompatibles KI-Agenten-Framework

### 1. Relay-Server starten

```bash
cd server
go run cmd/relay/main.go
# Standard: :8765
```

Oder mit Docker:

```bash
cd server
docker compose up -d
```

### 2. Desktop-Wallet starten

```bash
cd desktop
npm install
npm run dev
```

### 3. Wallet erstellen und koppeln

1. In der Desktop-App: Passwort festlegen → Mnemonik sichern
2. Auf „Kopplungscode generieren" klicken → den 8-stelligen Code kopieren
3. In Ihrem Agenten `wallet_pair({ shortCode: "ABCD1234" })` aufrufen
4. Fertig — E2EE-Sitzung hergestellt, automatische Wiederverbindung aktiviert

### 4. Mit Ihrem Agenten verwenden

Der Agent bietet 17 Tools. Beispielkonversation:

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## Verfügbare Tools

| Tool | Beschreibung |
|------|-------------|
| **Wallet-Verwaltung** | |
| `wallet_create` | Neue Wallet mit verschlüsseltem Keystore erstellen |
| `wallet_import` | Bestehende Wallet über privaten Schlüssel importieren |
| `wallet_address` | Aktuelle Wallet-Adresse abrufen |
| `wallet_pair` | Mit Desktop-Wallet über Kurzcode koppeln |
| **Guthaben und Gas** | |
| `wallet_balance` | ETH- oder ERC-20-Token-Guthaben abfragen |
| `wallet_estimate_gas` | Gas-Kosten vor dem Senden schätzen |
| **Transaktionen** | |
| `wallet_send` | ETH oder ERC-20-Token senden (unterstützt Kontaktnamen) |
| `wallet_history` | Paginierten Transaktionsverlauf abfragen |
| **Kontakte** | |
| `wallet_contacts_add` | Kontakt mit Multi-Chain-Adressen hinzufügen oder aktualisieren |
| `wallet_contacts_list` | Alle gespeicherten Kontakte auflisten |
| `wallet_contacts_resolve` | Adresse eines Kontakts nach Name nachschlagen |
| `wallet_contacts_remove` | Einen Kontakt entfernen |
| **Richtlinien und Genehmigungen** | |
| `wallet_policy_get` | Aktuelle Sicherheitsrichtlinie anzeigen |
| `wallet_policy_set` | Ausgabenlimits, Whitelist oder Modus aktualisieren |
| `wallet_approval_list` | Ausstehende Transaktionsgenehmigungen auflisten |
| `wallet_approval_approve` | Eine Transaktion in der Warteschlange genehmigen |
| `wallet_approval_reject` | Eine Transaktion in der Warteschlange ablehnen |

---

## Projektstruktur

```
wallet/
├── agent/                 # AI Agent framework (TypeScript) — zero secrets
│   ├── index.ts           # ClawWallet class — orchestrates tools & signer
│   ├── e2ee/              # E2EE crypto, WebSocket transport, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, key serialization
│   │   ├── transport.ts   # E2EE WebSocket client with extended handshake
│   │   └── machine-id.ts  # Device fingerprint (SHA256 of hostname:MAC)
│   ├── signer/            # RelaySigner — persistent pairing, auto-reconnect
│   │   ├── relay-client.ts    # Relay connection, deterministic pairId, repair
│   │   ├── ipc-server.ts     # Unix domain socket IPC server
│   │   └── ipc-client.ts     # IPC client for tool → signer communication
│   ├── tools/             # 17 MCP tool definitions
│   └── *.ts               # Policy, contacts, history, monitor, validation
│
├── desktop/               # Electron Desktop Wallet — holds all secrets
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # BIP-39 mnemonic, Keystore V3 encrypt/decrypt
│       │   ├── signing-engine.ts   # Transaction signing with memory zeroing
│       │   ├── relay-bridge.ts     # E2EE relay, three-level verification, session freeze
│       │   ├── security-monitor.ts # IP/device change detection, alerts
│       │   └── lock-manager.ts     # Wallet lock/unlock, idle timeout
│       ├── preload/                # Secure contextBridge (no nodeIntegration)
│       ├── renderer/               # HTML/CSS/JS UI
│       └── shared/
│           └── e2ee-crypto.ts      # Shared E2EE primitives
│
└── server/                # Go Relay Server (Hertz) — stateless forwarder
    ├── cmd/relay/main.go  # Entry point, route setup
    ├── internal/
    │   ├── hub/           # WebSocket hub, IP binding, rate limiting
    │   ├── pairing/       # Short code generation & resolution
    │   ├── middleware/     # CORS, access logging
    │   └── iputil/        # IP extraction utilities
    ├── Dockerfile         # Multi-stage build
    └── docker-compose.yml # One-command deployment
```

---

## Unterstützte Chains und Token

| Chain | Chain ID | Standard-RPC | Integrierte Token |
|-------|----------|-------------|-------------------|
| Base | 8453 | Öffentliches Base RPC | USDC, USDT |
| Ethereum | 1 | Öffentliches Ethereum RPC | USDC, USDT |

Jeder ERC-20-Token kann durch Angabe seiner Vertragsadresse verwendet werden. Chains sind erweiterbar — fügen Sie jede EVM-kompatible Chain über die Konfiguration hinzu.

---

## Entwicklung

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Docker deployment
cd server && docker compose up --build
```

### Testsuite

| Kategorie | Was getestet wird |
|-----------|-------------------|
| **Keystore** | Schlüsselgenerierung, Verschlüsselung/Entschlüsselung, falsches Passwort, V3-Struktur |
| **Richtlinien** | Limits, Whitelist, Modi, Genehmigungsworkflow, Ganzzahl-Cent-Arithmetik |
| **E2EE** | Schlüsselpaar-Serialisierung, deterministische pairId-Ableitung |
| **Relay Hub** | WebSocket-Routing, Paar-IP-Bindung, Verbindungsratenlimitierung |
| **Kopplung** | Kurzcode-Generierung, Ablauf, Auflösung |
| **Middleware** | CORS-Konfiguration, Zugriffprotokollierung |
| **Sicherheit** | Schlüsselentropie, Speicherlöschung, Eingabeinjektion, Dateiberechtigungen, Pfadtraversierung, RPC-Sicherheit |

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| „Wallet app offline" | Stellen Sie sicher, dass die Desktop-Wallet läuft und mit dem Relay verbunden ist |
| „Pairing code expired" | Generieren Sie einen neuen Code (10 Min. TTL) |
| Signierungsanfragen blockiert | Prüfen Sie, ob die Sitzung eingefroren ist (Identitätsabweichung) — bei Bedarf neu koppeln |
| IP-Änderungswarnung | IP-Richtlinie konfigurieren: `block` / `warn` / `allow` |
| Agent kann sich nicht wiederverbinden | Verwenden Sie `wallet_repair`, um Kopplungsdaten zu löschen und neu zu koppeln |
| Warnung gleiche Maschine | Verschieben Sie die Desktop-Wallet auf ein separates Gerät für volle Sicherheit |

---

## Lizenz

MIT
