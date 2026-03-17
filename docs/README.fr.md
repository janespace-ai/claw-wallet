<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <b>Français</b> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Donnez à votre Agent IA un vrai portefeuille — en toute sécurité.**

Plugin de portefeuille Web3 pour le framework d'agents IA [OpenClaw](https://getclaw.sh). Un portefeuille crypto auto-hébergé, non custodial et local, qui permet aux agents IA de gérer des actifs, envoyer des transactions et interagir avec les blockchains EVM — tout en garantissant que les clés privées restent chiffrées et totalement isolées du LLM.

> Les clés privées ne sont jamais exposées au modèle IA. L'agent opère via l'API Tool et ne reçoit que des adresses et des hachages de transaction.

---

## Pourquoi claw-wallet ?

Quand un agent IA doit agir on-chain (transactions, paiements, stratégies DeFi), il fait face à une contradiction fondamentale : **le modèle doit exécuter des actions, mais ne doit jamais voir les clés privées**. claw-wallet résout ce problème grâce à une architecture en couches clairement séparées :

```
┌─────────────────────────────────────────────────────────────┐
│                    Votre Agent IA (LLM)                     │
│                                                             │
│  "Envoie 10 USDC à Alice sur Base"                          │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│  Moteur de   │───▶│  Coffre-fort  │    │
│  │ (16 outils) │    │  politiques  │    │  de clés      │    │
│  │             │    │ (limites et  │    │ (AES-256-GCM  │    │
│  │             │    │  approbation)│    │  + scrypt)    │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                         Signe et diffuse    │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  Chaînes EVM │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Ce que le LLM peut voir :** adresses de portefeuille, soldes, hachages de transaction, état des politiques.
**Ce que le LLM ne peut pas voir :** clés privées, phrases mnémoniques, matériel cryptographique déchiffré.

---

## Fonctionnalités

- **Non custodial & local** — Les clés sont chiffrées et stockées sur votre machine, aucune dépendance cloud.
- **Chiffrement Keystore V3** — AES-256-GCM + scrypt KDF, le même standard utilisé par les clients Ethereum.
- **Moteur de politiques** — Limites par transaction et journalières, liste blanche d'adresses, file d'attente d'approbation humaine. Même si l'agent subit une injection de prompt, le moteur de politiques bloque les transactions non autorisées.
- **Multi-chaînes EVM** — Supporte Base (par défaut, faibles frais de Gas) et le réseau principal Ethereum. Extensible à toute chaîne EVM.
- **Deux modes d'exécution** — Mode supervisé (approbation humaine) ou mode autonome (exécution automatique dans les limites).
- **Carnet d'adresses de l'agent** — Répertoire d'adresses pair-à-pair. Les agents échangent leurs adresses et les résolvent automatiquement par nom.
- **Surveillance des soldes** — Scrutation en arrière-plan pour détecter les transferts entrants, notifications en temps réel.
- **Historique des transactions** — Cache local de toutes les transactions envoyées/reçues.
- **16 outils OpenClaw** — Définitions d'outils prêtes à l'emploi, intégration transparente avec les agents IA.

---

## Cas d'utilisation

### Scénario 1 : Humain → Agent → Contrat / Institution

Vous demandez à l'agent de payer un commerçant, de créer un NFT ou d'interagir avec un protocole DeFi.

```
 Vous (conversation)              Votre Agent                      On-chain
─────────────────────────────────────────────────────────────────────────────
 "Paie 50 USDC à la              wallet_contacts_resolve            Uniswap
  trésorerie Uniswap             → 0x1a9C...                       Contrat de
  sur Ethereum"                                                     trésorerie
                                   wallet_send                         │
                                     to: 0x1a9C...                     │
                                     amount: 50                        │
                                     token: USDC                       │
                                     chain: ethereum                   │
                                            │                          │
                                   Vérification des politiques :       │
                                     ✓ $50 < $100 limite par tx        │
                                     ✓ Total journalier < $500         │
                                     ✓ 0x1a9C dans la liste blanche    │
                                            │                          │
                                   Signe → Diffuse ───────────────────▶│
                                            │                          │
                                   Retour: tx hash 0xab3f...     ✓ Confirmé
```

**Usages typiques :** paiements d'abonnements SaaS, achats de services on-chain, interactions avec des protocoles DeFi, dépôts sur des plateformes d'échange. La liste blanche d'adresses garantit que l'agent ne peut transférer qu'aux adresses de contrats pré-approuvées.

### Scénario 2 : Humain → Agent → Un autre Agent

Vous demandez à votre agent de payer un autre agent IA pour obtenir un service — les agents résolvent automatiquement les adresses via le carnet d'adresses.

```
 Vous (conversation)        Votre Agent                   Agent de Bob
──────────────────────────────────────────────────────────────────
 "Envoie 10 USDC          wallet_contacts_add
  à l'agent de Bob         name: "bob-agent"
  sur Base"                base: 0x742d...
                                  │
                           wallet_send
                             to: "bob-agent"     ◄── Résolu via le carnet
                             amount: 10
                             token: USDC
                             chain: base
                                  │
                           Politique ✓ → Signe → Diffuse ─────▶ 0x742d...
                                  │                              │
                           tx: 0xef01...                    Le moniteur de Bob
                                                            détecte +10 USDC
                                                            Notifie l'agent de Bob
```

**Usages typiques :** paiement d'appels API entre agents, achat de données, récompenses pour tâches collaboratives. Le carnet d'adresses rend les paiements récurrents entre agents aussi simples qu'utiliser un nom — sans avoir à coller une adresse à chaque fois.

### Scénario 3 : Agent en mode autonome

L'agent fonctionne de manière indépendante — il exécute des transactions, achète des services ou ajuste un portefeuille d'investissement de façon autonome dans les limites définies. Aucune intervention humaine nécessaire pour les transactions individuelles.

```
 Agent (mode autonome)                                      On-chain
──────────────────────────────────────────────────────────────────
 Détecte : prix de l'ETH en baisse de 5%
 Décision : opportunité d'achat

 wallet_balance → 500 USDC disponibles
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (dans la liste blanche)
   amount: 200
   token: USDC
   chain: base
         │
 Moteur de politiques :
   ✓ $200 > $100 limite par tx  ← Bloqué
   → Mis en file d'approbation (id: a3f8...)

 ─── Option A : Augmenter la limite ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 Renvoi → Politique ✓ → Signe → Diffuse → Confirmé

 ─── Option B : Approbation humaine ───
 wallet_approval_approve("a3f8...")
 → Signe → Diffuse → Confirmé
```

**Usages typiques :** yield farming DeFi, stratégies de trading automatisées, paiements d'abonnements récurrents, rééquilibrage de portefeuille. Le moteur de politiques agit comme un **garde-fou** — même un agent entièrement autonome opère dans des limites de dépenses configurables.

### Comparaison des modes

| | Mode supervisé | Mode autonome |
|---|---|---|
| **Décideur** | Approbation humaine requise pour chaque transaction hors liste blanche | L'agent décide de façon autonome dans les limites |
| **Liste blanche requise** | Oui — les adresses non listées sont bloquées | Non — toute adresse est autorisée dans les limites |
| **Limites de dépenses** | Limites par transaction + journalières appliquées | Limites par transaction + journalières appliquées |
| **Cas d'usage** | Portefeuilles à forte valeur, phase d'établissement de la confiance | Opérations courantes, bots de trading |
| **Dépassement de limite** | Mis en file → approbation/rejet humain | Mis en file → approbation/rejet humain |

---

## Démarrage rapide

### Installation

```bash
npm install claw-wallet
```

### Utilisation de base

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// Enregistrer les 16 outils dans votre agent OpenClaw
const tools = wallet.getTools();

// ... L'agent s'exécute, utilise les outils pour envoyer/recevoir/gérer ...

// Arrêt propre : sauvegarde l'historique, le carnet d'adresses et les politiques sur disque
await wallet.shutdown();
```

---

## Fonctionnement

### Flux de transaction

Le flux complet, de l'intention de l'agent à la confirmation on-chain :

```
  L'agent dit : "Envoie 0.5 ETH à Bob sur Base"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. Validation des entrées          │  Format d'adresse, plage de montant,
  │     validateAddress / validateAmount │  liste blanche de chaînes, symbole de token
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. Résolution du destinataire      │  "Bob" → Recherche dans le carnet
  │     Nom de contact ou adresse 0x    │  → 0x742d...4a (chaîne Base)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. Vérification du solde           │  Solde ETH ≥ montant + Gas ?
  │     getBalance + estimateGas        │  ERC-20 : solde token + frais Gas en ETH
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. Contrôle des politiques         │  ✓ Dans la limite par tx ($100) ?
  │     PolicyEngine.checkTransaction   │  ✓ Dans la limite journalière ($500) ?
  │                                     │  ✓ Adresse dans la liste blanche
  │                                     │    (mode supervisé) ?
  │     Bloqué ? → File d'approbation   │  → Retourne un ID d'approbation
  │     Approuvé ? → Continuer ↓        │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. Signature de la transaction     │  Déchiffre la clé (scrypt + AES-256-GCM)
  │     Coffre → Déchiffre → Signe      │  Signe avec viem
  │     → Mise à zéro immédiate du      │  Dans le bloc finally{}
  │       buffer de clé                 │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. Diffusion et confirmation       │  Envoie la transaction brute au RPC
  │     broadcastTransaction            │  Attend le reçu
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. Enregistrement et retour        │  Sauvegarde dans l'historique local
  │     TransactionHistory.addRecord    │  Retourne : { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### Flux d'approbation (mode supervisé)

Quand une transaction dépasse les limites ou que l'adresse de destination n'est pas dans la liste blanche :

```
  Agent → wallet_send → Politique bloque → Retourne un ID d'approbation
                                        │
              ┌─────────────────────────┘
              ▼
  Revue humaine :  wallet_approval_list  →  Consulter les détails des transactions en attente
                   wallet_approval_approve(id)  →  Transaction exécutée
                   wallet_approval_reject(id)   →  Transaction annulée
                   (Expiration automatique après 24 heures)
```

---

## Outils disponibles

claw-wallet fournit 16 outils que l'agent peut invoquer :

| Outil | Description |
|-------|-------------|
| **Gestion du portefeuille** | |
| `wallet_create` | Crée un nouveau portefeuille, génère un coffre-fort chiffré |
| `wallet_import` | Importe un portefeuille existant via une clé privée |
| `wallet_address` | Récupère l'adresse du portefeuille actuel (sans déchiffrement) |
| **Soldes & Gas** | |
| `wallet_balance` | Consulte le solde en ETH ou en tokens ERC-20 |
| `wallet_estimate_gas` | Estime les frais de Gas d'une transaction |
| **Transactions** | |
| `wallet_send` | Envoie des ETH ou des tokens ERC-20 (supporte les noms de contacts) |
| `wallet_history` | Consulte l'historique paginé des transactions |
| **Carnet d'adresses** | |
| `wallet_contacts_add` | Ajoute ou met à jour un contact (supporte les adresses multi-chaînes) |
| `wallet_contacts_list` | Liste tous les contacts |
| `wallet_contacts_resolve` | Recherche l'adresse d'un contact par son nom |
| `wallet_contacts_remove` | Supprime un contact |
| **Politiques & Approbations** | |
| `wallet_policy_get` | Consulte la politique de sécurité actuelle |
| `wallet_policy_set` | Met à jour les limites de dépenses, la liste blanche ou le mode |
| `wallet_approval_list` | Liste les transactions en attente d'approbation |
| `wallet_approval_approve` | Approuve une transaction en file d'attente |
| `wallet_approval_reject` | Rejette une transaction en file d'attente |

---

## Modèle de sécurité

claw-wallet adopte une stratégie de **défense en profondeur** — plusieurs couches de sécurité indépendantes garantissent qu'aucun point de défaillance unique ne peut entraîner une fuite de clé ou un transfert non autorisé.

### 1. Isolation des clés — Les clés ne touchent jamais le LLM

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     Agent IA       │ ◄──────────────── │   claw-wallet      │
│                    │ Adresses, hachages│                    │
│  N'a pas accès à : │ de transaction    │  La clé privée     │
│  - Clés privées    │                   │  n'est déchiffrée  │
│  - Fichiers keystore│                  │  que dans          │
│  - Mot de passe    │                   │  signTransaction() │
│                    │                   │  puis mise à zéro  │
└────────────────────┘                   └────────────────────┘
```

L'agent interagit uniquement via l'API Tool. Aucun outil ne retourne de matériel cryptographique. Même `wallet_create` ne retourne que l'adresse.

### 2. Chiffrement au repos — Keystore V3

| Composant | Détails |
|-----------|---------|
| **Algorithme de chiffrement** | AES-256-GCM (chiffrement authentifié) |
| **Dérivation de clé** | scrypt (N=131072, r=8, p=1) |
| **Sel** | 32 octets aléatoires générés à chaque chiffrement |
| **Vecteur d'initialisation** | 16 octets aléatoires générés à chaque chiffrement |
| **Tag d'authentification** | Le tag GCM empêche la falsification du chiffré |
| **Permissions fichier** | 0600 (lecture/écriture uniquement par le propriétaire) |

La clé privée est chiffrée via une dérivation de clé scrypt et un chiffrement AES-256-GCM. Un sel et un IV aléatoires sont générés à chaque opération, de sorte que la même clé + mot de passe produit un chiffré différent à chaque fois.

### 3. Sécurité mémoire

- La clé privée n'est déchiffrée que pendant l'exécution de `signTransaction()` / `signMessage()`.
- Le buffer de clé est mis à zéro dans le bloc `finally` via `Buffer.fill(0)` — même si la signature lève une exception.
- Le matériel cryptographique déchiffré ne reste en mémoire que quelques millisecondes.

### 4. Moteur de politiques — Contrôle indépendant des dépenses

Le moteur de politiques s'exécute **avant** toute opération de signature et ne peut pas être contourné par une injection de prompt :

| Contrôle | Valeur par défaut | Description |
|----------|-------------------|-------------|
| Limite par transaction | $100 | Montant maximal par transaction |
| Limite journalière | $500 | Plafond cumulé sur une période glissante de 24 heures |
| Liste blanche d'adresses | Vide | Obligatoire en mode supervisé |
| Mode d'exécution | Supervisé | `supervised` (liste blanche requise) ou `autonomous` (limites uniquement) |
| File d'approbation | Expiration 24 h | Les transactions bloquées sont mises en file d'attente pour revue humaine |

**Mesures anti-contournement :**
- Tous les montants en dollars utilisent l'**arithmétique en centimes entiers** (multiplication par 100, arrondi), empêchant les attaques par précision flottante (ex. : plusieurs transactions de $0.51 exploitant les erreurs d'arrondi).
- La correspondance de la liste blanche est **insensible à la casse**, empêchant le contournement par mélange de majuscules et minuscules dans les adresses.
- Les identifiants d'approbation utilisent des **nombres aléatoires cryptographiques** (8 octets hexadécimaux) — non séquentiels et impossibles à deviner.

### 5. Validation des entrées — Un garde à chaque frontière

| Entrée | Règles de validation |
|--------|---------------------|
| Adresse | Format hexadécimal, longueur=42, checksum EIP-55 |
| Montant | Rejette NaN, Infinity, négatif, zéro, vide |
| Chaîne | Liste blanche stricte (`base`, `ethereum`) |
| Symbole de token | Maximum 20 caractères, rejette les caractères d'injection `<>"'\`/\` |
| Nom de contact | Maximum 100 caractères, rejette la traversée de chemin (`..`, `/`, `\`) |
| JSON Keystore | Structure V3 complète + limites des paramètres KDF (n ≤ 2²⁰) |

### 6. Sécurité du système de fichiers

- **Écriture atomique :** écriture dans un fichier temporaire → renommage (prévient la corruption en cas de plantage).
- **Permissions 0600 :** seul le propriétaire peut lire et écrire le coffre-fort, le carnet d'adresses, l'historique et les fichiers de politique.
- **Protection contre la traversée de chemin :** `sanitizePath()` résout et rejette les chemins en dehors du répertoire de données.

### 7. Sécurité RPC

- **Clampage des soldes négatifs :** les soldes négatifs retournés par le RPC sont traités comme 0.
- **Vérification de cohérence du Gas :** rejette les estimations de Gas à 0 et > 30 millions.
- **Aucune fuite de clé :** les messages d'erreur ne contiennent jamais de clé privée ni de mot de passe.

---

## Configuration

```typescript
const wallet = new ClawWallet({
  // Répertoire de données (défaut : ~/.openclaw/wallet)
  dataDir: "~/.openclaw/wallet",

  // Chaîne par défaut (défaut : "base")
  defaultChain: "base",

  // Nœuds RPC personnalisés (optionnel)
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },

  // Mot de passe principal (ou défini via wallet.setPassword())
  password: process.env.WALLET_PASSWORD,

  // Intervalle de scrutation de la surveillance des soldes (défaut : 30 secondes)
  pollIntervalMs: 30_000,

  // Callback de notification pour les transferts entrants
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## Stockage des données

Toutes les données sont stockées localement (jamais envoyées vers le cloud) :

```
~/.openclaw/wallet/
├── keystore.json    # Clé privée chiffrée (Keystore V3, chmod 0600)
├── contacts.json    # Carnet d'adresses de l'agent
├── history.json     # Cache de l'historique des transactions
└── policy.json      # Politique de sécurité et file d'approbation
```

---

## Chaînes et tokens supportés

| Chaîne | Chain ID | RPC par défaut | Tokens intégrés |
|--------|----------|----------------|-----------------|
| Base | 8453 | RPC public Base | USDC, USDT |
| Ethereum | 1 | RPC public Ethereum | USDC, USDT |

N'importe quel token ERC-20 peut être utilisé en fournissant son adresse de contrat. Les chaînes sont extensibles — ajoutez n'importe quelle chaîne compatible EVM via la configuration.

---

## Architecture

```
src/
├── index.ts          Classe ClawWallet — orchestre tous les sous-systèmes
├── types.ts          Types et interfaces TypeScript partagés
├── keystore.ts       Génération de clés, chiffrement/déchiffrement (AES-256-GCM + scrypt), signature
├── chain.ts          Adaptateur blockchain multi-chaînes (viem PublicClient)
├── transfer.ts       Construction de transaction : validation → politique → signature → diffusion
├── policy.ts         Limites de dépenses, liste blanche, file d'approbation, arithmétique en centimes
├── contacts.ts       Répertoire d'adresses nommées avec résolution multi-chaînes
├── history.ts        Historique local des transactions (avec sérialisation BigInt)
├── monitor.ts        Scrutation des soldes en arrière-plan et détection des variations
├── validation.ts     Nettoyage des entrées, I/O fichier sécurisé, protection traversée de chemin
└── tools/            16 définitions d'outils OpenClaw
    ├── wallet-create.ts
    ├── wallet-import.ts
    ├── wallet-balance.ts       (solde + adresse + estimation Gas)
    ├── wallet-send.ts
    ├── wallet-contacts.ts      (liste + ajout + résolution + suppression)
    ├── wallet-policy.ts        (consultation + mise à jour)
    ├── wallet-approval.ts      (liste + approbation + rejet)
    └── wallet-history.ts
```

**Philosophie de dépendances :** Minimaliste. Seul [viem](https://viem.sh) est utilisé pour les interactions blockchain. Toutes les fonctions cryptographiques utilisent le module natif `node:crypto` de Node.js (scrypt, AES-256-GCM, randomBytes) — aucune bibliothèque cryptographique tierce.

---

## Développement

```bash
# Installer les dépendances
npm install

# Exécuter les tests
npm test

# Vérification des types
npm run typecheck

# Build (sortie ESM + CJS + .d.ts)
npm run build

# Développement en mode watch
npm run dev
```

### Suite de tests

Le projet comprend des tests fonctionnels et de sécurité complets :

| Catégorie | Contenu des tests |
|-----------|-------------------|
| **Coffre-fort** | Génération de clés, chiffrement/déchiffrement, mot de passe erroné, structure V3, persistance |
| **Chaîne** | Création de client, cache, Chain ID, encodage calldata ERC-20 |
| **Carnet d'adresses** | Opérations CRUD, résolution multi-chaînes, recherche insensible à la casse, persistance |
| **Historique** | Gestion des enregistrements, pagination, sérialisation BigInt |
| **Politiques** | Limites, liste blanche, modes, flux d'approbation, persistance |
| **Bout en bout** | Cycle de vie complet, de la création du portefeuille aux 16 outils |
| **Sécurité : Coffre-fort** | Entropie des clés, IV/sel aléatoires, détection de falsification, mise à zéro mémoire, protection DoS KDF, résistance au bruteforce (≥100ms pour le déchiffrement) |
| **Sécurité : Entrées** | Injection adresse/montant/token/contact, schéma Keystore malveillant |
| **Sécurité : Politiques** | Attaque par précision flottante, précision en centimes entiers, unicité des ID d'approbation, cumul journalier concurrent |
| **Sécurité : Fichiers** | Permissions fichier (0600), protection traversée de chemin, écriture atomique |
| **Sécurité : RPC** | Validation des soldes, vérification de la plage Gas, aucune fuite de clé dans les erreurs |

---

## Prérequis

- Node.js ≥ 18
- Un framework d'agent IA compatible OpenClaw (ou tout framework supportant les définitions d'outils)

---

## Licence

MIT
