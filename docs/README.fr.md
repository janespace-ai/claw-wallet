<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <b>Français</b> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Donnez à votre agent IA un vrai portefeuille — en toute sécurité.**

Un portefeuille crypto non-custodial pour les agents IA [OpenClaw](https://getclaw.sh). Les clés privées résident dans un **portefeuille de bureau Electron** séparé, totalement isolé du modèle IA. L'Agent et le bureau communiquent via un canal **E2EE (chiffrement de bout en bout)** à travers un **serveur relais Go** — le relais ne fait que transmettre du texte chiffré et ne peut jamais lire ni altérer les messages.

> Les clés privées ne touchent jamais le modèle IA. Pas sur la même machine, pas dans le même processus, pas en mémoire. L'Agent ne voit que les adresses de portefeuilles et les hachages de transactions.

---

## Architecture

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

**Architecture à trois composants** : chaque composant a une responsabilité unique. Même si l'hôte de l'Agent est entièrement compromis, l'attaquant n'obtient aucun matériel de clé.

---

## Flux d'interaction utilisateur

### Premier lancement : appairage

Requis une seule fois. Après l'appairage initial, la reconnexion est entièrement automatique.

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

### Utilisation quotidienne : reconnexion automatique

Après l'appairage initial, l'Agent et le bureau se reconnectent automatiquement au redémarrage — aucune action utilisateur requise.

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

### Flux de transaction

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

## Architecture de sécurité

claw-wallet utilise une **défense en profondeur** avec deux domaines de sécurité indépendants : la **sécurité des communications** (comment les composants communiquent) et la **sécurité des clés** (comment les clés sont stockées et utilisées).

### Partie A : Sécurité des communications

#### 1. Chiffrement de bout en bout (E2EE)

Tous les messages entre l'Agent et le bureau sont chiffrés de bout en bout. Le serveur relais ne voit que du texte chiffré.

| Composant | Détail |
|-----------|--------|
| **Échange de clés** | X25519 ECDH (Curve25519) |
| **Dérivation de clés** | HKDF-SHA256 |
| **Chiffrement** | AES-256-GCM (authentifié) |
| **Anti-rejeu** | Nonce incrémentiel par message |
| **Confidentialité persistante** | Nouvelles clés éphémères par session |

#### 2. Appairage automatique et reconnexion

L'appairage manuel n'est nécessaire qu'une seule fois. Le système utilise des **paires de clés de communication persistantes** et des **identifiants de paire déterministes** pour la reconnexion automatique :

- **Paires de clés persistantes** : les paires de clés X25519 sont enregistrées sur disque — chiffrées avec le mot de passe du portefeuille côté bureau (scrypt + AES-256-GCM), protégées par les permissions de fichier (0600) côté Agent
- **PairId déterministe** : `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — les deux côtés calculent indépendamment le même identifiant, aucune coordination nécessaire
- **Reconnexion sans intervention** : au redémarrage, les deux côtés chargent leurs clés stockées, recalculent le pairId et se reconnectent automatiquement via le relais

#### 3. Vérification de reconnexion à trois niveaux

Lorsqu'un Agent se reconnecte, le bureau effectue trois vérifications d'identité avant d'autoriser toute signature :

| Niveau | Vérification | Action en cas d'échec |
|--------|-------------|----------------------|
| **Niveau 1** (Strict) | La clé publique correspond à la clé stockée | Rejet + ré-appairage forcé |
| **Niveau 2** (Strict) | Le machineId correspond à l'ID stocké | Gel de session + ré-appairage forcé |
| **Niveau 3** (Configurable) | Politique de changement d'adresse IP | `block` / `warn` (par défaut) / `allow` |

- **machineId** : SHA256(nom d'hôte + adresse MAC) — détecte si l'Agent a été déplacé vers une autre machine
- **Gel de session** : lorsqu'une incompatibilité d'identité est détectée, toutes les demandes de signature sont bloquées jusqu'à ce que l'utilisateur effectue manuellement un ré-appairage
- **Politique IP** : configurable par déploiement — `block` rejette immédiatement, `warn` alerte l'utilisateur mais autorise (avec tolérance de même sous-réseau), `allow` ignore la vérification

#### 4. Protections côté relais

Le serveur relais Go applique des protections de sécurité supplémentaires même s'il ne peut pas lire le contenu des messages :

| Protection | Détail |
|------------|--------|
| **Liaison IP par pairId** | Maximum 2 adresses IP sources distinctes par paire simultanément |
| **Limite de débit des connexions** | Maximum 10 nouvelles connexions WebSocket par pairId par minute |
| **Éviction de connexions** | Si un troisième client se connecte à une paire, le plus ancien est évincé |
| **Journalisation des métadonnées** | Événements de connexion journalisés avec pairId tronqué pour l'audit |

#### 5. Ré-appairage manuel de secours

Lorsque la reconnexion automatique échoue (changement d'appareil, corruption de clés, etc.) :

- **Côté Agent** : la méthode RPC `wallet_repair` efface les données d'appairage stockées et réinitialise l'état
- **Côté bureau** : action « Ré-appairer l'appareil » dans l'interface du panneau de sécurité
- Les deux côtés génèrent de nouvelles paires de clés, nécessitant un nouvel échange de code d'appairage

### Partie B : Sécurité des clés

#### 6. Isolation des clés — Les clés ne touchent jamais le modèle IA

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

L'Agent interagit exclusivement via les API d'outils. Aucun outil ne retourne jamais de matériel de clé.

#### 7. Chiffrement au repos — Keystore V3

| Composant | Détail |
|-----------|--------|
| **Chiffrement** | AES-256-GCM (chiffrement authentifié) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Sel** | 32 octets aléatoires par chiffrement |
| **IV** | 16 octets aléatoires par chiffrement |
| **Tag d'authentification** | Le tag GCM empêche l'altération du texte chiffré |
| **Permissions de fichier** | 0600 (lecture/écriture propriétaire uniquement) |

#### 8. Sécurité mémoire

- Les clés privées ne sont déchiffrées que lors de `signTransaction()` / `signMessage()`
- Les tampons de clés sont mis à zéro avec `Buffer.fill(0)` dans les blocs `finally` — même si la signature échoue
- Le matériel de clé déchiffré existe en mémoire pendant des millisecondes, pas des secondes

#### 9. Moteur de politiques — Contrôles de dépenses indépendants

Le moteur de politiques s'exécute **avant** toute signature et ne peut pas être contourné par injection de prompt :

| Contrôle | Par défaut | Description |
|----------|-----------|-------------|
| Limite par transaction | 100 $ | Montant maximum par transaction |
| Limite journalière | 500 $ | Plafond de dépenses cumulées sur 24h glissantes |
| Liste blanche d'adresses | Vide | Obligatoire en mode supervisé |
| Mode opérationnel | Supervisé | `supervised` (liste blanche obligatoire) ou `autonomous` (limites uniquement) |
| File d'approbation | Expiration 24h | Les transactions bloquées sont mises en file pour examen manuel |

**Mesures anti-contournement :**
- Arithmétique en centimes entiers pour prévenir les attaques de précision en virgule flottante
- Correspondance insensible à la casse pour la liste blanche
- Identifiants d'approbation cryptographiquement aléatoires (non séquentiels, non devinables)

#### 10. Validation des entrées

| Entrée | Validation |
|--------|-----------|
| Adresse | Format hexadécimal, longueur=42, somme de contrôle EIP-55 via viem |
| Montant | Rejette NaN, Infinity, négatif, zéro, vide |
| Chaîne | Liste blanche stricte (`base`, `ethereum`) |
| Symbole de jeton | Maximum 20 caractères, rejette les caractères d'injection |
| Nom de contact | Maximum 100 caractères, rejette la traversée de chemin |

#### 11. Sécurité du système de fichiers et RPC

- **Écritures atomiques** : écriture dans un fichier temporaire → renommage (prévient la corruption en cas de crash)
- **Permissions 0600** : seul le propriétaire peut lire/écrire les fichiers sensibles
- **Prévention de traversée de chemin** : `sanitizePath()` rejette les chemins en dehors du répertoire de données
- **Vérifications de santé du gas** : rejette un gas de 0 et les estimations de gas > 30M
- **Aucune fuite de clé** : les messages d'erreur ne contiennent jamais de clés privées ou de mots de passe

---

## Fonctionnalités

- **Non-custodial et isolé** — Clés sur le bureau, l'Agent ne détient aucun secret
- **Chiffré de bout en bout** — X25519 + AES-256-GCM, le relais ne voit que du texte chiffré
- **Appairage automatique** — Configuration unique, reconnexion automatique après redémarrage
- **Vérification à trois niveaux** — Clé publique + empreinte d'appareil + politique IP à chaque reconnexion
- **Chiffrement Keystore V3** — AES-256-GCM + scrypt KDF pour les clés au repos
- **Moteur de politiques** — Limites par transaction et journalières, liste blanche d'adresses, file d'approbation
- **Multi-chaîne EVM** — Base (par défaut, faible gas) et Ethereum mainnet, extensible à toute chaîne EVM
- **Double mode opérationnel** — Supervisé (approbation humaine) ou Autonome (dans les limites)
- **Contacts de l'Agent** — Carnet d'adresses P2P avec résolution de noms
- **Surveillance des soldes** — Interrogation en arrière-plan pour les transferts entrants
- **Historique des transactions** — Cache local avec enregistrements complets
- **Relais conteneurisé** — Serveur relais Go avec support Docker (framework Hertz)
- **17 outils MCP** — Définitions d'outils prêtes à l'emploi pour l'intégration d'agents IA

---

## Démarrage rapide

### Prérequis

- Node.js ≥ 18
- Go ≥ 1.21 (pour le serveur relais)
- Un framework d'agent IA compatible OpenClaw

### 1. Démarrer le serveur relais

```bash
cd server
go run cmd/relay/main.go
# Par défaut : :8765
```

Ou avec Docker :

```bash
cd server
docker compose up -d
```

### 2. Démarrer le portefeuille de bureau

```bash
cd desktop
npm install
npm run dev
```

### 3. Créer un portefeuille et appairer

1. Dans l'application de bureau : définir un mot de passe → sauvegarder la phrase mnémonique
2. Cliquer sur « Générer un code d'appairage » → copier le code de 8 caractères
3. Dans votre Agent, appeler `wallet_pair({ shortCode: "ABCD1234" })`
4. Terminé — session E2EE établie, reconnexion automatique activée

### 4. Utiliser avec votre Agent

L'Agent fournit 17 outils. Exemple de conversation :

```
You:    "Send 10 USDC to Bob on Base"
Agent:  wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Policy ✓ → E2EE → Desktop signs → Broadcast
        "Sent 10 USDC to Bob. tx: 0xab3f..."
```

---

## Outils disponibles

| Outil | Description |
|-------|-------------|
| **Gestion du portefeuille** | |
| `wallet_create` | Créer un nouveau portefeuille avec keystore chiffré |
| `wallet_import` | Importer un portefeuille existant via clé privée |
| `wallet_address` | Obtenir l'adresse du portefeuille actuel |
| `wallet_pair` | Appairer avec le portefeuille de bureau via un code court |
| **Solde et gas** | |
| `wallet_balance` | Interroger le solde ETH ou d'un jeton ERC-20 |
| `wallet_estimate_gas` | Estimer le coût en gas avant l'envoi |
| **Transactions** | |
| `wallet_send` | Envoyer des ETH ou jetons ERC-20 (supporte les noms de contacts) |
| `wallet_history` | Consulter l'historique paginé des transactions |
| **Contacts** | |
| `wallet_contacts_add` | Ajouter ou mettre à jour un contact avec des adresses multi-chaînes |
| `wallet_contacts_list` | Lister tous les contacts enregistrés |
| `wallet_contacts_resolve` | Rechercher l'adresse d'un contact par nom |
| `wallet_contacts_remove` | Supprimer un contact |
| **Politiques et approbations** | |
| `wallet_policy_get` | Voir la politique de sécurité actuelle |
| `wallet_policy_set` | Modifier les limites de dépenses, la liste blanche ou le mode |
| `wallet_approval_list` | Lister les approbations de transactions en attente |
| `wallet_approval_approve` | Approuver une transaction en file d'attente |
| `wallet_approval_reject` | Rejeter une transaction en file d'attente |

---

## Structure du projet

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

## Chaînes et jetons supportés

| Chaîne | Chain ID | RPC par défaut | Jetons intégrés |
|--------|----------|----------------|-----------------|
| Base | 8453 | RPC public Base | USDC, USDT |
| Ethereum | 1 | RPC public Ethereum | USDC, USDT |

Tout jeton ERC-20 peut être utilisé en passant son adresse de contrat. Les chaînes sont extensibles — ajoutez n'importe quelle chaîne compatible EVM via la configuration.

---

## Développement

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

### Suite de tests

| Catégorie | Ce qui est testé |
|-----------|-----------------|
| **Keystore** | Génération de clés, chiffrement/déchiffrement, mot de passe erroné, structure V3 |
| **Politiques** | Limites, liste blanche, modes, flux d'approbation, arithmétique en centimes entiers |
| **E2EE** | Sérialisation des paires de clés, dérivation déterministe du pairId |
| **Relay Hub** | Routage WebSocket, liaison IP par paire, limitation du débit de connexion |
| **Appairage** | Génération de codes courts, expiration, résolution |
| **Middleware** | Configuration CORS, journalisation des accès |
| **Sécurité** | Entropie des clés, effacement mémoire, injection d'entrées, permissions de fichiers, traversée de chemin, sécurité RPC |

---

## Dépannage

| Problème | Solution |
|----------|---------|
| « Wallet app offline » | Vérifiez que le portefeuille de bureau est en cours d'exécution et connecté au relais |
| « Pairing code expired » | Générez un nouveau code (TTL de 10 min) |
| Demandes de signature bloquées | Vérifiez si la session est gelée (incompatibilité d'identité) — ré-appairez si nécessaire |
| Alerte de changement d'IP | Configurez la politique IP : `block` / `warn` / `allow` |
| L'Agent ne peut pas se reconnecter | Utilisez `wallet_repair` pour effacer les données d'appairage et ré-appairer |
| Avertissement même machine | Déplacez le portefeuille de bureau vers un appareil séparé pour une sécurité complète |

---

## Licence

MIT
