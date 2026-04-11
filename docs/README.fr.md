<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <b>Français</b> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw‑Wallet</h1>

<p align="center">
  <b>Donnez a votre Agent IA un vrai portefeuille — en toute securite.</b><br>
  <i>Un portefeuille crypto non-custodial avec isolation complete des cles pour les Agents IA</i>
</p>

> **Vous n'etes pas developpeur ?** Visitez **[janespace-ai.github.io](https://janespace-ai.github.io)** pour le guide utilisateur — installation, appairage et demarrage en quelques minutes.

**Claw-Wallet** est un portefeuille crypto securise et non-custodial concu specifiquement pour les Agents IA tels que OpenClaw, Claude Code, Cursor, et bien d'autres. Les cles privees sont stockees dans une **Application de Bureau Electron** separee, completement isolee du modele IA. L'Agent et l'Application de Bureau communiquent via un canal **E2EE (chiffrement de bout en bout)** a travers un **Serveur Relais Go** — le relais ne transmet que du texte chiffre et ne peut jamais lire ni alterer les messages.

> **Promesse de securite fondamentale** : Les cles privees ne touchent jamais le modele IA. Pas sur la meme machine, pas dans le meme processus, pas en memoire. L'Agent ne voit que les adresses de portefeuille et les hachages de transactions.

## Fonctionnalites Cles

| Fonctionnalite | Description |
|----------------|-------------|
| **Isolation complete des cles** | Les cles restent dans l'Application de Bureau ; l'Agent ne voit que les adresses et les hachages |
| **Support multi-chaines** | Ethereum, Base, Arbitrum, Optimism, Polygon, Linea, BSC, Sei |
| **Natif pour Agents IA** | Outils integres pour OpenClaw, Claude Code, Cursor, Codex, etc. |
| **Communication E2EE** | Chiffrement X25519 + AES-256-GCM ; le relais ne voit que du texte chiffre |
| **Reconnexion automatique** | Appairage unique, reconnexion automatique apres redemarrage |
| **Moteur de politiques** | Limites par transaction et journalieres, listes blanches d'adresses, files d'approbation |
| **Bureau + CLI** | Application Electron pour la gestion des cles + outils CLI pour les Agents |
| **Open Source** | Licence MIT — inspectez, modifiez et contribuez |

## Demarrage en 4 Etapes

**Etape 1 — Installer l'Application de Bureau**

Telechargez la derniere version et lancez l'application. Creez un portefeuille, definissez un mot de passe et sauvegardez votre phrase mnemonique.

| Plateforme | Telechargement |
|------------|----------------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> Toutes les versions : [github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Ecran d'accueil" />

**Etape 2 — Connecter Votre Agent**

**Vous utilisez OpenClaw ?** Dites directement a OpenClaw dans le chat :

```
openclaw plugins install @janespace-ai/claw-wallet
```

**Vous utilisez Claude Code, Cline, Cursor, ou un autre agent ?** Collez ceci dans le chat de votre agent :

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

Ou installez via CLI :

```bash
npx skills add janespace-ai/claw-wallet
```

**Etape 3 — Generer un Code d'Appairage**

Dans l'application de bureau, cliquez sur **"Generate Pairing Code"** et copiez le code a 8 caracteres.

<img src="screenshots/pair-code-dark.png" width="320" alt="Ecran du code d'appairage" />

**Etape 4 — Commencer a Utiliser**

Collez le code d'appairage dans votre agent une seule fois. Ensuite, l'agent et l'application de bureau se reconnectent automatiquement — aucune action de l'utilisateur n'est necessaire.

<img src="screenshots/tx-approval-dark.png" width="320" alt="Ecran d'approbation de transaction" />

```
Vous :  "Envoie 10 USDC a Bob sur Base"
Agent : → resout le contact → construit la tx → E2EE → le Bureau signe → diffusion
        "10 USDC envoyes a Bob. tx: 0xab3f..."
```

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
│ 17 tools     │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  L'Agent ne voit jamais :                                             Le Bureau detient :    │
       │  • cles privees                                                       • Mnemonique BIP-39    │
       │  • mnemoniques                                                        • Fichier Keystore V3  │
       │  • materiel cryptographique                                           • Moteur de signature  │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Conception a trois composants** : Chaque composant a une responsabilite unique. Meme si l'hote de l'Agent est entierement compromis, l'attaquant n'obtient aucun materiel cryptographique.

---

## Flux d'Interaction Utilisateur

### Premiere Configuration : Appairage

Necessaire une seule fois. Apres l'appairage initial, la reconnexion est entierement automatique.

```
 Vous                         Application de Bureau          Serveur Relais            Agent IA
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Creer le portefeuille
    (definir mot de passe,    Genere un mnemonique BIP-39
     sauvegarder mnemonique)  Chiffre avec AES-256-GCM
                              + scrypt KDF
                                    │
 2. Cliquer "Generate         Genere un code d'appairage
    Pairing Code"             de 8 caracteres (valide 10 min)
                                    │
 3. Copier le code vers             │                                              L'Agent appelle
    l'Agent (ou envoyer via         │                                              wallet_pair
    canal securise)                 │                                              { shortCode }
                                    │                         ◄──── L'Agent s'enregistre ────┘
                                    │                               avec le code
                              Le Bureau se connecte ────────►  Le Relais associe la paire
                              Echange de cles X25519 ◄──────► Session E2EE etablie
                                    │
                              Sauvegarde la paire de cles    L'Agent sauvegarde la paire
                              de comm persistante (chiffree) de cles de comm (0600)
                                    │
                              Derive un pairId               Derive le meme pairId
                              deterministe = SHA256(addr +   = SHA256(addr +
                              agentPubKey)[:16]              agentPubKey)[:16]
                                    │
 Appaire !                    Pret a signer                  Pret a transiger
```

### Utilisation Quotidienne : Reconnexion Automatique

Apres l'appairage initial, l'Agent et l'Application de Bureau se reconnectent automatiquement au redemarrage — aucune action de l'utilisateur n'est necessaire.

```
 L'Agent redemarre            Le Bureau redemarre
       │                             │
 Charge la paire de cles     Charge la paire de cles
 de comm persistante         de comm persistante (dechiffre
 depuis le disque            avec le mot de passe du portefeuille)
       │                             │
 Recalcule le pairId          Recalcule le meme pairId
       │                             │
 Se connecte au Relais ──────► Le Relais route par pairId ──────► Le Bureau recoit
       │                                                             │
 Envoie un handshake etendu :                                 Verification a trois niveaux :
 • publicKey                                                  Niveau 1 : La cle publique correspond
 • machineId                                                  Niveau 2 : Le machineId correspond
 • reconnect: true                                            Niveau 3 : Politique IP (configurable)
       │                                                             │
 Session E2EE restauree ◄──────────────────────────────────── Session active
       │                                                             │
 Pret a transiger                                             Pret a signer
```

### Flux de Transaction

```
 Vous (chat avec l'Agent)             Agent IA                       Application de Bureau
──────────────────────────────────────────────────────────────────────────────────────────────────
 "Envoie 0.5 ETH a Bob          wallet_send
  sur Base"                        to: "bob"  (contact)
                                   amount: 0.5
                                   chain: base
                                        │
                                 Resout le contact ──► Bob = 0x742d...
                                 Construit la requete tx
                                        │
                                 Chiffrement E2EE ──────────────────► Dechiffre la requete
                                                                       │
                                                                 Verification de politique :
                                                                   Dans la limite par tx
                                                                   Dans la limite journaliere
                                                                   Appareil non gele
                                                                       │
                                                                 Dechiffre la cle privee
                                                                 Signe la transaction
                                                                 Efface la cle de la memoire
                                                                 Diffuse sur la chaine
                                                                       │
                                 Recoit le resultat ◄────────────────── hachage tx + recu
                                        │
                                 Retourne a l'utilisateur :
                                 "0.5 ETH envoyes a Bob
                                  tx: 0xab3f..."
```

---

## Architecture de Securite

claw-wallet utilise une **defense en profondeur** avec deux domaines de securite independants : la **securite des communications** (comment les composants communiquent) et la **securite des cles** (comment les cles sont stockees et utilisees).

### Partie A : Securite des Communications

#### 1. Chiffrement de Bout en Bout (E2EE)

Tous les messages entre l'Agent et le Bureau sont chiffres de bout en bout. Le serveur Relais ne voit que du texte chiffre.

| Composant | Detail |
|-----------|--------|
| **Echange de cles** | X25519 ECDH (Curve25519) |
| **Derivation de cles** | HKDF-SHA256 |
| **Chiffrement** | AES-256-GCM (authentifie) |
| **Anti-rejeu** | Nonce incrementiel par message |
| **Confidentialite persistante** | Nouvelles cles ephemerales par session |

#### 2. Appairage Automatique et Reconnexion

L'appairage manuel n'est necessaire qu'une seule fois. Le systeme utilise des **paires de cles de communication persistantes** et des **identifiants de paire deterministes** pour la reconnexion automatique :

- **Paires de cles persistantes** : Les paires de cles X25519 sont sauvegardees sur disque — chiffrees avec le mot de passe du portefeuille sur le Bureau (scrypt + AES-256-GCM), protegees par permissions de fichier (0600) sur l'Agent
- **PairId deterministe** : `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — les deux cotes calculent le meme identifiant independamment, sans coordination necessaire
- **Reconnexion sans interaction** : Au redemarrage, les deux cotes chargent leurs cles stockees, recalculent le pairId et se reconnectent via le Relais automatiquement

#### 3. Verification de Reconnexion a Trois Niveaux

Lorsqu'un Agent se reconnecte, le Bureau effectue trois verifications d'identite avant d'autoriser toute signature :

| Niveau | Verification | Action en cas d'echec |
|--------|--------------|----------------------|
| **Niveau 1** (Strict) | La cle publique correspond a la cle stockee | Rejet + re-appairage force |
| **Niveau 2** (Strict) | Le machineId correspond a l'identifiant stocke | Gel de session + re-appairage force |
| **Niveau 3** (Configurable) | Politique de changement d'adresse IP | `block` / `warn` (par defaut) / `allow` |

- **machineId** : SHA256(nom d'hote + adresse MAC) — detecte si l'Agent a ete deplace vers une autre machine
- **Gel de session** : Lorsqu'une incompatibilite d'identite est detectee, toutes les demandes de signature sont bloquees jusqu'a ce que l'utilisateur refasse l'appairage manuellement
- **Politique IP** : Configurable par deploiement — `block` rejette immediatement, `warn` alerte l'utilisateur mais autorise (avec tolerance de meme sous-reseau), `allow` ignore la verification

#### 4. Protection Cote Relais

Le Serveur Relais Go applique des protections supplementaires meme s'il ne peut pas lire le contenu des messages :

| Protection | Detail |
|------------|--------|
| **Liaison IP par pairId** | Maximum 2 adresses IP sources distinctes par paire simultanement |
| **Limite de debit de connexion** | Maximum 10 nouvelles connexions WebSocket par pairId par minute |
| **Eviction de connexion** | Si un troisieme client se connecte a une paire, le plus ancien est evince |
| **Journalisation des metadonnees** | Evenements de connexion journalises avec pairId tronque pour audit |

#### 5. Re-appairage Manuel en Dernier Recours

Lorsque la reconnexion automatique echoue (changement d'appareil, corruption de cles, etc.) :

- **Cote Agent** : La methode RPC `wallet_repair` efface les donnees d'appairage stockees et reinitialise l'etat
- **Cote Bureau** : Action UI "Re-pair Device" dans le panneau de securite
- Les deux cotes generent de nouvelles paires de cles, necessitant un nouvel echange de code d'appairage

### Partie B : Securite des Cles

#### 6. Isolation des Cles — Les Cles ne Touchent Jamais le Modele IA

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  addresses, hashes │                    │
│  AUCUN acces a :   │                   │  La cle privee     │
│  - cles privees    │                   │  n'est dechiffree  │
│  - fichier keystore│                   │  que dans           │
│  - mot de passe    │                   │  signTransaction() │
│                    │                   │  puis effacee      │
└────────────────────┘                   └────────────────────┘
```

L'Agent interagit exclusivement via les Tool APIs. Aucun outil ne renvoie jamais de materiel cryptographique.

#### 7. Chiffrement au Repos — Keystore V3

| Composant | Detail |
|-----------|--------|
| **Chiffrement** | AES-256-GCM (chiffrement authentifie) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Sel** | 32 octets aleatoires par chiffrement |
| **IV** | 16 octets aleatoires par chiffrement |
| **Tag d'authentification** | Le tag GCM empeche la falsification du texte chiffre |
| **Permissions de fichier** | 0600 (lecture/ecriture proprietaire uniquement) |

#### 8. Securite Memoire

- Les cles privees ne sont dechiffrees que pendant `signTransaction()` / `signMessage()`
- Les tampons de cles sont mis a zero avec `Buffer.fill(0)` dans les blocs `finally` — meme si la signature echoue
- Le materiel cryptographique dechiffre existe en memoire pendant des millisecondes, pas des secondes

#### 9. Moteur de Politiques — Controles de Depenses Independants

Le moteur de politiques s'execute **avant** toute signature et ne peut pas etre contourne par injection de prompt :

| Controle | Par defaut | Description |
|----------|-----------|-------------|
| Limite par transaction | 100 $ | Montant maximum par transaction |
| Limite journaliere | 500 $ | Plafond de depenses cumulees sur 24h glissantes |
| Liste blanche d'adresses | Vide | Requise en mode supervise |
| Mode operationnel | Supervise | `supervised` (liste blanche requise) ou `autonomous` (limites uniquement) |
| File d'approbation | Expiration 24h | Les transactions bloquees sont mises en file d'attente pour revision manuelle |

**Mesures anti-contournement :**
- Arithmetique en centimes entiers pour prevenir les attaques de precision en virgule flottante
- Correspondance de liste blanche insensible a la casse
- Identifiants d'approbation aleatoires cryptographiques (non-sequentiels, non-devinables)

#### 10. Validation des Entrees

| Entree | Validation |
|--------|-----------|
| Adresse | Format hexadecimal, longueur=42, checksum EIP-55 via viem |
| Montant | Rejette NaN, Infinity, negatif, zero, vide |
| Chaine | Liste blanche stricte (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Symbole de token | Maximum 20 caracteres, rejette les caracteres d'injection |
| Nom de contact | Maximum 100 caracteres, rejette les traversees de chemin |

#### 11. Securite du Systeme de Fichiers et RPC

- **Ecritures atomiques** : ecriture dans un fichier temporaire puis renommage (previent la corruption en cas de crash)
- **Permissions 0600** : seul le proprietaire peut lire/ecrire les fichiers sensibles
- **Prevention de traversee de chemin** : `sanitizePath()` rejette les chemins hors du repertoire de donnees
- **Verifications de coherence du gas** : rejette les estimations de gas a 0 et superieures a 30M
- **Aucune fuite de cle** : les messages d'erreur ne contiennent jamais de cles privees ni de mots de passe

---

## Fonctionnalites

- **Non-custodial et isole** — Les cles sont sur le Bureau, l'Agent ne detient aucun secret
- **Chiffrement de bout en bout** — X25519 + AES-256-GCM, le Relais ne voit que du texte chiffre
- **Appairage automatique** — Configuration unique, reconnexion automatique apres redemarrage
- **Verification a trois niveaux** — Cle publique + empreinte d'appareil + politique IP a chaque reconnexion
- **Chiffrement Keystore V3** — AES-256-GCM + scrypt KDF pour les cles au repos
- **Moteur de politiques** — Limites par transaction et journalieres, liste blanche d'adresses, file d'approbation
- **8 chaines EVM** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei ; extensible a toute chaine EVM
- **Recuperation de sous-comptes** — Scanne et recupere les comptes derives (BIP-44 m/44'/60'/0'/0/{n}) lors de la restauration du portefeuille
- **Double mode operationnel** — Supervise (approbation humaine) ou Autonome (dans les limites)
- **Contacts de l'Agent** — Carnet d'adresses P2P avec resolution de noms
- **Surveillance des soldes** — Interrogation en arriere-plan pour les transferts entrants
- **Historique des transactions** — Cache local avec enregistrements complets
- **Relais conteneurise** — Serveur Relais Go avec support Docker (framework Hertz)
- **17 outils de portefeuille** — Publies sur npm sous [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet), installable via `npm install @janespace-ai/claw-wallet` ou `npx skills add janespace-ai/claw-wallet`
- **Internationalisation (i18n)** — L'application de bureau supporte l'anglais et le chinois simplifie avec changement de langue a l'execution

---

## Demarrage Rapide

### Prerequis

- Node.js >= 18
- Go >= 1.21 (pour le Serveur Relais)
- Un framework d'Agent IA compatible OpenClaw

### 1. Demarrer le Serveur Relais

```bash
cd server
go run cmd/relay/main.go
# Par defaut : :8765
```

Ou avec Docker :

```bash
cd server
docker compose up -d
```

### 2. Demarrer l'Application de Bureau

```bash
cd desktop
npm install
npm run dev
```

### 3. Creer un Portefeuille et Appairer

1. Dans l'application de Bureau : definir le mot de passe puis sauvegarder le mnemonique
2. Cliquer sur "Generate Pairing Code" puis copier le code a 8 caracteres
3. Dans votre Agent, appeler `wallet_pair({ shortCode: "ABCD1234" })`
4. Termine — session E2EE etablie, reconnexion automatique activee

### 4. Utiliser avec Votre Agent

17 outils disponibles. Exemple de conversation :

```
Vous :  "Envoie 10 USDC a Bob sur Base"
Agent : wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Politique OK → E2EE → Le Bureau signe → Diffusion
        "10 USDC envoyes a Bob. tx: 0xab3f..."
```

---

## Outils Disponibles

| Outil | Description |
|-------|-------------|
| **Gestion du Portefeuille** | |
| `wallet_create` | Creer un nouveau portefeuille avec keystore chiffre |
| `wallet_import` | Importer un portefeuille existant via cle privee |
| `wallet_address` | Obtenir l'adresse actuelle du portefeuille |
| `wallet_pair` | Appairer avec l'Application de Bureau via code court |
| **Solde et Gas** | |
| `wallet_balance` | Interroger le solde ETH ou de tokens ERC-20 |
| `wallet_estimate_gas` | Estimer le cout en gas avant l'envoi |
| **Transactions** | |
| `wallet_send` | Envoyer des ETH ou des tokens ERC-20 (supporte les noms de contacts) |
| `wallet_history` | Consulter l'historique pagine des transactions |
| **Contacts** | |
| `wallet_contacts_add` | Ajouter ou mettre a jour un contact avec des adresses multi-chaines |
| `wallet_contacts_list` | Lister tous les contacts sauvegardes |
| `wallet_contacts_resolve` | Rechercher l'adresse d'un contact par nom |
| `wallet_contacts_remove` | Supprimer un contact |
| **Politiques et Approbations** | |
| `wallet_policy_get` | Consulter la politique de securite actuelle |
| `wallet_policy_set` | Mettre a jour les limites de depenses, la liste blanche ou le mode |
| `wallet_approval_list` | Lister les approbations de transactions en attente |
| `wallet_approval_approve` | Approuver une transaction en file d'attente |
| `wallet_approval_reject` | Rejeter une transaction en file d'attente |

---

## Structure du Projet

```
wallet/
├── agent/                 # Framework Agent IA (TypeScript) — zero secrets
│   ├── index.ts           # Classe ClawWallet — orchestre les outils et le signataire
│   ├── e2ee/              # Crypto E2EE, transport WebSocket, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, serialisation des cles
│   │   ├── transport.ts   # Client WebSocket E2EE avec handshake etendu
│   │   └── machine-id.ts  # Empreinte d'appareil (SHA256 de hostname:MAC)
│   ├── signer/            # RelaySigner — appairage persistant, reconnexion auto
│   │   ├── relay-client.ts    # Connexion au Relais, pairId deterministe, reparation
│   │   ├── ipc-server.ts     # Serveur IPC par socket de domaine Unix
│   │   └── ipc-client.ts     # Client IPC pour communication outil → signataire
│   ├── tools/             # 17 definitions d'outils de portefeuille
│   └── *.ts               # Politique, contacts, historique, surveillance, validation
│
├── desktop/               # Application de Bureau Electron — detient tous les secrets
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # Mnemonique BIP-39, chiffrement/dechiffrement Keystore V3
│       │   ├── signing-engine.ts   # Signature de transactions avec effacement memoire
│       │   ├── signing-history.ts  # Historique d'activite des transactions sauvegarde en SQLite
│       │   ├── tx-sync-service.ts  # Synchronisation du statut des transactions blockchain
│       │   ├── chain-adapter.ts    # Client RPC pour les recus de transactions
│       │   ├── database-service.ts # Connexion SQLite et migrations de schema
│       │   ├── price-service.ts    # Recuperation de prix multi-niveaux (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # Agregation des soldes de tokens sur toutes les chaines
│       │   ├── relay-bridge.ts     # Relais E2EE, verification a trois niveaux, gel de session
│       │   ├── security-monitor.ts # Detection de changement d'IP/appareil, alertes
│       │   └── lock-manager.ts     # Verrouillage/deverrouillage du portefeuille, delai d'inactivite
│       ├── preload/                # contextBridge securise (pas de nodeIntegration)
│       ├── renderer/               # UI HTML/CSS/JS (onglet Activite, affichage des soldes)
│       └── shared/
│           └── e2ee-crypto.ts      # Primitives E2EE partagees
│
└── server/                # Serveur Relais Go (Hertz) — transmetteur sans etat
    ├── cmd/relay/main.go  # Point d'entree, configuration des routes
    ├── internal/
    │   ├── hub/           # Hub WebSocket, liaison IP, limitation de debit
    │   ├── pairing/       # Generation et resolution de codes courts
    │   ├── middleware/     # CORS, journalisation des acces
    │   └── iputil/        # Utilitaires d'extraction d'IP
    ├── Dockerfile         # Build multi-etapes
    └── docker-compose.yml # Deploiement en une commande
```

---

## Chaines et Tokens Supportes

| Chaine | Chain ID | Tokens Integres |
|--------|----------|-----------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

N'importe quel token ERC-20 peut etre utilise en passant son adresse de contrat. Les chaines sont extensibles — ajoutez n'importe quelle chaine compatible EVM via la configuration.

### Configuration Reseau Web3

L'Agent et l'Application de Bureau supportent la configuration personnalisee des endpoints RPC pour la production et le developpement local.

#### Configuration de Production

Creez un fichier `config.json` avec vos fournisseurs RPC preferes :

```json
{
  "relayUrl": "https://relay.your-domain.com",
  "defaultChain": "base",
  "chains": {
    "ethereum":  { "rpcUrl": "https://ethereum.publicnode.com" },
    "base":      { "rpcUrl": "https://mainnet.base.org" },
    "linea":     { "rpcUrl": "https://rpc.linea.build" },
    "arbitrum":  { "rpcUrl": "https://arb1.arbitrum.io/rpc" },
    "bsc":       { "rpcUrl": "https://bsc.publicnode.com" },
    "optimism":  { "rpcUrl": "https://optimism.publicnode.com" },
    "polygon":   { "rpcUrl": "https://polygon-bor-rpc.publicnode.com" },
    "sei":       { "rpcUrl": "https://evm-rpc.sei-apis.com" }
  }
}
```

#### Developpement Local

Utilisez Hardhat ou Anvil pour les tests blockchain locaux :

```json
{
  "relayUrl": "http://localhost:8080",
  "defaultChain": "ethereum",
  "chains": {
    "ethereum": { "rpcUrl": "http://localhost:8545" },
    "base":     { "rpcUrl": "http://localhost:8546" }
  }
}
```

Demarrez les noeuds locaux :

```bash
# Simulation Ethereum (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Simulation Base (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

Voir [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) pour le guide de configuration complet.

#### Comportement par Defaut

Si la configuration `chains` n'est pas fournie, le systeme utilise les endpoints RPC publics integres de viem.

---

## Developpement

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Bureau (Electron)
cd desktop && npm install && npm run dev

# Serveur Relais (Go)
cd server && go test ./...

# Deploiement Docker
cd server && docker compose up --build
```

### Suite de Tests

| Categorie | Ce qui est Teste |
|-----------|-----------------|
| **Keystore** | Generation de cles, chiffrement/dechiffrement, mauvais mot de passe, structure V3 |
| **Politique** | Limites, liste blanche, modes, flux d'approbation, arithmetique en centimes entiers |
| **E2EE** | Serialisation des paires de cles, derivation deterministe du pairId |
| **Hub Relais** | Routage WebSocket, liaison IP par paire, limitation de debit de connexion |
| **Appairage** | Generation de codes courts, expiration, resolution |
| **Middleware** | Configuration CORS, journalisation des acces |
| **Securite** | Entropie des cles, effacement memoire, injection d'entrees, permissions de fichiers, traversee de chemin, securite RPC |

---

## Depannage

| Probleme | Solution |
|----------|----------|
| "Wallet app offline" | Assurez-vous que l'Application de Bureau fonctionne et est connectee au Relais |
| "Pairing code expired" | Generez un nouveau code (duree de vie de 10 min) |
| Demandes de signature bloquees | Verifiez si la session est gelee (incompatibilite d'identite) — refaites l'appairage si necessaire |
| Alerte de changement d'IP | Configurez la politique IP : `block` / `warn` / `allow` |
| L'Agent ne peut pas se reconnecter | Utilisez `wallet_repair` pour effacer les donnees d'appairage et refaire l'appairage |
| Avertissement de meme machine | Deplacez l'Application de Bureau vers un appareil separe pour une securite complete |

---

## Internationalisation (i18n)

L'application de Bureau supporte plusieurs langues avec changement de langue a l'execution :

### Langues Supportees

- **English (en)** — Langue par defaut
- **Simplified Chinese (zh-CN)** — Chinois simplifie

### Fonctionnalites

- **Detection automatique** : Detecte automatiquement la langue du systeme au premier lancement
- **Changement manuel** : Selecteur de langue dans l'en-tete (coin superieur droit)
- **Persistance** : Preference utilisateur sauvegardee dans localStorage entre les sessions
- **Mises a jour a l'execution** : Les elements d'interface statiques (boutons, etiquettes, onglets) se mettent a jour immediatement
- **Experience fluide** : Aucun redemarrage de l'application n'est necessaire pour changer de langue

### Architecture

```
i18next Framework
├── Fichiers de Traduction (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # Boutons etiquettes messages
│   │   ├── setup.json       # Flux de configuration du portefeuille
│   │   ├── activity.json    # Activite des transactions
│   │   ├── security.json    # Evenements de securite
│   │   ├── settings.json    # Panneau de parametres
│   │   ├── pairing.json     # Appairage d'appareils
│   │   ├── errors.json      # Messages d'erreur
│   │   ├── modals.json      # Dialogues d'approbation, export, alerte
│   │   └── contactsPage.json
│   └── zh-CN/ (meme structure ; garder les cles synchronisees avec en)
│   Note : `npm run build` copie ces fichiers vers dist/renderer/locales/ pour Electron.
├── Detection de Langue (i18n.js)
│   ├── 1. Verifier localStorage (preference utilisateur)
│   ├── 2. Verifier navigator.language (systeme)
│   └── 3. Repli sur l'anglais
└── Systeme de Mise a Jour du DOM
    ├── Attributs data-i18n pour le contenu statique
    └── i18next.t() pour le contenu dynamique
```

### Ajouter une Nouvelle Langue

1. Creer le repertoire de traduction :
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. Copier et traduire tous les fichiers JSON depuis `en/` :
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # Editer chaque fichier pour traduire les valeurs
   ```

3. Ajouter l'option de langue au selecteur dans `index.html` :
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Votre Langue</option>
   </select>
   ```

4. Mettre a jour la liste des namespaces dans `i18n.js` si necessaire

### Conventions de Cles de Traduction

Utilisez un nommage hierarchique et semantique :

```
namespace.fonctionnalite.element

Exemples :
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### Pour les Developpeurs

**HTML (contenu statique)** :
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript (contenu dynamique)** :
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**Avec interpolation** :
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// Traduction : "Supprimer toutes les entrees du contact \"{name}\" ?"
```

---

## Contribuer

Les contributions sont les bienvenues ! Voici comment vous pouvez aider :

### Signaler des Problemes
- **Rapports de bugs** : Utilisez la page [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues)
- **Demandes de fonctionnalites** : Suggerez de nouvelles fonctionnalites ou ameliorations
- **Vulnerabilites de securite** : Veuillez signaler de maniere privee par email (voir le profil GitHub)

### Soumettre des Pull Requests
1. **Forker** le depot
2. **Creer une branche** : `git checkout -b feature/your-feature`
3. **Commiter les modifications** : `git commit -m 'Add some feature'`
4. **Pousser** : `git push origin feature/your-feature`
5. **Ouvrir une Pull Request**

### Configuration de l'Environnement de Developpement
```bash
# Cloner le depot
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# Installer les dependances
npm install

# Compiler le projet
npm run build

# Lancer les tests
npm test
```

### Domaines Necessitant de l'Aide
- **Documentation** : Ameliorer les guides, ajouter des tutoriels, traduire dans plus de langues
- **Nouvelles chaines** : Ajouter le support de chaines EVM ou non-EVM supplementaires
- **Ameliorations UI/UX** : Ameliorer l'interface de l'application de bureau
- **Tests** : Ecrire des tests unitaires/d'integration, ameliorer la couverture des tests

### Style de Code
- Utiliser **TypeScript** avec verification stricte des types
- Suivre le formatage **Prettier** (configure dans `.prettierrc`)
- Ecrire des messages de commit significatifs
- Ajouter des tests pour les nouvelles fonctionnalites

### Rejoindre la Communaute
- **Discord** : [Rejoindre notre serveur](https://discord.gg/clawd) (bientot disponible)
- **Twitter** : Suivre [@janespace_ai](https://twitter.com/janespace_ai) pour les mises a jour
- **GitHub Discussions** : Lancez une discussion pour vos questions ou idees

---

## Licence

MIT (c) [janespace-ai](https://github.com/janespace-ai)
