<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <b>Português</b>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Release"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Last Commit"></a>
</p>

<h1 align="center">Claw‑Wallet</h1>

<p align="center">
  <b>Deixe seu Agente de IA segurar uma carteira real — com seguranca.</b><br>
  <i>Uma carteira cripto sem custodia com isolamento total de chaves para Agentes de IA</i>
</p>

> **Nao e desenvolvedor?** Visite **[janespace-ai.github.io](https://janespace-ai.github.io)** para o guia do usuario — instalacao, pareamento e primeiros passos em minutos.

**Claw-Wallet** e uma carteira cripto segura e sem custodia projetada especificamente para Agentes de IA como OpenClaw, Claude Code, Cursor e outros. As chaves privadas sao armazenadas em uma **Carteira Desktop Electron** separada, completamente isolada do modelo de IA. O Agente e o Desktop se comunicam atraves de um canal **E2EE (Criptografia Ponta a Ponta)** via um **Servidor Relay em Go** — o relay apenas encaminha texto cifrado e nunca pode ler ou adulterar mensagens.

> **Promessa Central de Seguranca**: As chaves privadas nunca tocam o modelo de IA. Nem na mesma maquina, nem no mesmo processo, nem em memoria. O Agente ve apenas enderecos de carteira e hashes de transacoes.

## Recursos Principais

| Recurso | Descricao |
|---------|-----------|
| **Isolamento Total de Chaves** | As chaves ficam na Carteira Desktop; o Agente ve apenas enderecos e hashes |
| **Suporte Multi-Chain** | Ethereum, Base, Arbitrum, Optimism, Polygon, Linea, BSC, Sei |
| **Nativo para Agentes de IA** | Ferramentas integradas para OpenClaw, Claude Code, Cursor, Codex, etc. |
| **Comunicacao E2EE** | Criptografia X25519 + AES-256-GCM; o relay ve apenas texto cifrado |
| **Reconexao Automatica** | Pareie uma vez, reconecte automaticamente apos reinicializacoes |
| **Motor de Politicas** | Limites por transacao e diarios, listas de enderecos permitidos, filas de aprovacao |
| **Desktop + CLI** | Aplicativo desktop Electron para gerenciamento de chaves + ferramentas CLI para Agentes |
| **Codigo Aberto** | Licenciado MIT — inspecione, modifique e contribua |

## Comece em 4 Passos

**Passo 1 — Instale a Carteira Desktop**

Baixe a versao mais recente e inicie o aplicativo. Crie uma carteira, defina uma senha e faca backup da sua frase mnemonica.

| Plataforma | Download |
|------------|----------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> Todas as versoes: [github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Tela de boas-vindas" />

**Passo 2 — Conecte Seu Agente**

**Usando OpenClaw?** Diga diretamente ao OpenClaw no chat:

```
openclaw plugins install @janespace-ai/claw-wallet
```

**Usando Claude Code, Cline, Cursor ou qualquer outro agente?** Cole isto no chat do seu agente:

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

Ou instale via CLI:

```bash
npx skills add janespace-ai/claw-wallet
```

**Passo 3 — Gere um Codigo de Pareamento**

No aplicativo desktop, clique em **"Generate Pairing Code"** e copie o codigo de 8 caracteres.

<img src="screenshots/pair-code-dark.png" width="320" alt="Tela do codigo de pareamento" />

**Passo 4 — Comece a Usar**

Cole o codigo de pareamento no seu agente uma unica vez. Depois disso, o agente e o desktop se reconectam automaticamente — nenhuma acao do usuario e necessaria.

<img src="screenshots/tx-approval-dark.png" width="320" alt="Tela de aprovacao de transacao" />

```
Voce:   "Envie 10 USDC para Bob na Base"
Agente: → resolve contato → constroi tx → E2EE → Desktop assina → transmite
        "Enviados 10 USDC para Bob. tx: 0xab3f..."
```

---

## Arquitetura

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
       │  Agent never sees:                                                        Desktop holds:     │
       │  • private keys                                                           • BIP-39 mnemonic  │
       │  • mnemonics                                                              • Keystore V3 file │
       │  • key material                                                           • Signing engine    │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Design de tres componentes**: Cada componente tem uma unica responsabilidade. Mesmo que o host do Agente seja completamente comprometido, o atacante obtem zero material de chaves.

---

## Fluxo de Interacao do Usuario

### Primeira Configuracao: Pareamento

Necessario apenas uma vez. Apos o pareamento inicial, a reconexao e totalmente automatica.

```
 Voce                         Carteira Desktop               Servidor Relay            Agente de IA
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Criar carteira
    (definir senha,           Gera mnemonica BIP-39
     backup da mnemonica)     Criptografa com AES-256-GCM
                              + scrypt KDF
                                    │
 2. Clique "Generate          Gera codigo de pareamento
    Pairing Code"             de 8 caracteres (valido 10 min)
                                    │
 3. Copie o codigo para             │                                              Agente chama
    o Agente (ou envie              │                                              wallet_pair
    por canal seguro)               │                                              { shortCode }
                                    │                         ◄──── Agente registra ────┘
                                    │                               com o codigo
                              Desktop conecta ────────────►  Relay combina par
                              Troca de chaves X25519 ◄─────────► Sessao E2EE estabelecida
                                    │
                              Salva par de chaves de          Agente salva par de chaves
                              comunicacao persistente         de comunicacao persistente
                              (criptografado)                 (permissoes 0600)
                                    │
                              Deriva pairId                   Deriva mesmo pairId
                              deterministico =               = SHA256(addr +
                              SHA256(addr +                   agentPubKey)[:16]
                              agentPubKey)[:16]
                                    │
 Pareado!                     Pronto para assinar            Pronto para transacionar
```

### Uso Diario: Reconexao Automatica

Apos o pareamento inicial, o Agente e o Desktop se reconectam automaticamente ao reiniciar — nenhuma acao do usuario e necessaria.

```
 Agente reinicia              Desktop reinicia
       │                             │
 Carrega par de chaves        Carrega par de chaves
 de comunicacao               de comunicacao persistente
 persistente do disco         (descriptografa com senha
       │                      da carteira)
 Recalcula pairId                    │
       │                      Recalcula mesmo pairId
 Conecta ao Relay ──────────► Relay roteia por pairId ──────► Desktop recebe
       │                                                             │
 Envia handshake estendido:                                   Verificacao em tres niveis:
 • publicKey                                                  Nivel 1: Chave publica corresponde a chave armazenada
 • machineId                                                  Nivel 2: machineId corresponde ao ID armazenado
 • reconnect: true                                            Nivel 3: Politica de mudanca de IP (configuravel)
       │                                                             │
 Sessao E2EE restaurada ◄──────────────────────────────────── Sessao ativa
       │                                                             │
 Pronto para transacionar                                     Pronto para assinar
```

### Fluxo de Transacao

```
 Voce (chat com Agente)              Agente de IA                    Carteira Desktop
──────────────────────────────────────────────────────────────────────────────────────
 "Envie 0.5 ETH para Bob       wallet_send
  na Base"                        to: "bob"  (contato)
                                  amount: 0.5
                                  chain: base
                                       │
                                Resolve contato ──► Bob = 0x742d...
                                Constroi requisicao de tx
                                       │
                                Criptografa E2EE ──────────────────► Descriptografa requisicao
                                                                       │
                                                                Verificacao de politica:
                                                                  Dentro do limite por tx
                                                                  Dentro do limite diario
                                                                  Dispositivo nao congelado
                                                                       │
                                                                Descriptografa chave privada
                                                                Assina transacao
                                                                Zera chave da memoria
                                                                Transmite para a chain
                                                                       │
                                Recebe resultado ◄────────────────── hash da tx + recibo
                                       │
                                Retorna para voce:
                                "Enviados 0.5 ETH para Bob
                                 tx: 0xab3f..."
```

---

## Arquitetura de Seguranca

claw-wallet utiliza **defesa em profundidade** com dois dominios de seguranca independentes: **seguranca de comunicacao** (como os componentes se comunicam) e **seguranca de chaves** (como as chaves sao armazenadas e utilizadas).

### Parte A: Seguranca de Comunicacao

#### 1. Criptografia Ponta a Ponta (E2EE)

Todas as mensagens entre o Agente e o Desktop sao criptografadas ponta a ponta. O servidor Relay ve apenas texto cifrado.

| Componente | Detalhe |
|------------|---------|
| **Troca de Chaves** | X25519 ECDH (Curve25519) |
| **Derivacao de Chaves** | HKDF-SHA256 |
| **Criptografia** | AES-256-GCM (autenticada) |
| **Anti-Replay** | Nonce incremental por mensagem |
| **Sigilo Futuro** | Novas chaves efemeras por sessao |

#### 2. Pareamento Automatico e Reconexao

O pareamento manual e necessario apenas uma vez. O sistema utiliza **pares de chaves de comunicacao persistentes** e **IDs de par deterministicos** para reconexao automatica:

- **Pares de Chaves Persistentes**: Pares de chaves X25519 sao salvos no disco — criptografados com a senha da carteira no Desktop (scrypt + AES-256-GCM), protegidos por permissoes de arquivo (0600) no Agente
- **PairId Deterministico**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — ambos os lados calculam o mesmo ID de forma independente, sem necessidade de coordenacao
- **Reconexao sem Interacao**: Ao reiniciar, ambos os lados carregam suas chaves armazenadas, recalculam o pairId e se reconectam atraves do Relay automaticamente

#### 3. Verificacao de Reconexao em Tres Niveis

Quando um Agente se reconecta, o Desktop realiza tres verificacoes de identidade antes de permitir qualquer assinatura:

| Nivel | Verificacao | Acao em Caso de Falha |
|-------|-------------|----------------------|
| **Nivel 1** (Rigido) | Chave publica corresponde a chave armazenada | Rejeitar + forcar re-pareamento |
| **Nivel 2** (Rigido) | machineId corresponde ao ID armazenado | Congelar sessao + forcar re-pareamento |
| **Nivel 3** (Configuravel) | Politica de mudanca de endereco IP | `block` / `warn` (padrao) / `allow` |

- **machineId**: SHA256(hostname + endereco MAC) — detecta se o Agente foi movido para outra maquina
- **Congelamento de Sessao**: Quando uma incompatibilidade de identidade e detectada, todas as solicitacoes de assinatura sao bloqueadas ate que o usuario re-pareie manualmente
- **Politica de IP**: Configuravel por implantacao — `block` rejeita imediatamente, `warn` alerta o usuario mas permite (com tolerancia de mesma sub-rede), `allow` ignora a verificacao

#### 4. Protecao do Lado do Relay

O Servidor Relay em Go aplica seguranca adicional mesmo sem poder ler o conteudo das mensagens:

| Protecao | Detalhe |
|----------|---------|
| **Vinculacao de IP por pairId** | Maximo de 2 IPs de origem distintos por par simultaneamente |
| **Limite de Taxa de Conexao** | Maximo de 10 novas conexoes WebSocket por pairId por minuto |
| **Desconexao de Conexoes** | Se um terceiro cliente se conecta a um par, o mais antigo e desconectado |
| **Log de Metadados** | Eventos de conexao registrados com pairId truncado para auditoria |

#### 5. Fallback de Re-Pareamento Manual

Quando a reconexao automatica falha (troca de dispositivo, corrupcao de chaves, etc.):

- **Lado do Agente**: Metodo RPC `wallet_repair` limpa os dados de pareamento armazenados e reinicia o estado
- **Lado do Desktop**: Acao "Re-pair Device" no painel de seguranca da interface
- Ambos os lados geram novos pares de chaves, exigindo uma nova troca de codigo de pareamento

### Parte B: Seguranca de Chaves

#### 6. Isolamento de Chaves — As Chaves Nunca Tocam o Modelo de IA

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

O Agente interage exclusivamente atraves de Tool APIs. Nenhuma ferramenta jamais retorna material de chaves.

#### 7. Criptografia em Repouso — Keystore V3

| Componente | Detalhe |
|------------|---------|
| **Cifra** | AES-256-GCM (criptografia autenticada) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes aleatorios por criptografia |
| **IV** | 16 bytes aleatorios por criptografia |
| **Tag de Autenticacao** | Tag GCM previne adulteracao do texto cifrado |
| **Permissoes de Arquivo** | 0600 (somente leitura/escrita pelo proprietario) |

#### 8. Seguranca de Memoria

- Chaves privadas sao descriptografadas apenas durante `signTransaction()` / `signMessage()`
- Buffers de chaves sao zerados com `Buffer.fill(0)` em blocos `finally` — mesmo se a assinatura lancar excecao
- Material de chave descriptografado existe em memoria por milissegundos, nao segundos

#### 9. Motor de Politicas — Controles de Gastos Independentes

O motor de politicas executa **antes** de qualquer assinatura e nao pode ser burlado por injecao de prompt:

| Controle | Padrao | Descricao |
|----------|--------|-----------|
| Limite por transacao | $100 | Valor maximo de uma unica transacao |
| Limite diario | $500 | Teto cumulativo de gastos em 24h corridas |
| Lista de enderecos permitidos | Vazia | Obrigatoria no modo supervisionado |
| Modo de operacao | Supervisionado | `supervised` (lista obrigatoria) ou `autonomous` (apenas limites) |
| Fila de aprovacao | Expira em 24h | Transacoes bloqueadas ficam em fila para revisao manual |

**Medidas anti-bypass:**
- Aritmetica inteira em centavos para prevenir ataques de precisao de ponto flutuante
- Correspondencia de lista de permitidos sem distincao de maiusculas/minusculas
- IDs de aprovacao criptograficamente aleatorios (nao sequenciais, nao advinaveis)

#### 10. Validacao de Entrada

| Entrada | Validacao |
|---------|-----------|
| Endereco | Formato hex, comprimento=42, checksum EIP-55 via viem |
| Valor | Rejeita NaN, Infinity, negativo, zero, vazio |
| Chain | Lista restrita (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Simbolo do token | Max 20 caracteres, rejeita caracteres de injecao |
| Nome do contato | Max 100 caracteres, rejeita path traversal |

#### 11. Seguranca de Sistema de Arquivos e RPC

- **Escritas atomicas**: escreve em arquivo temporario → renomeia (previne corrupcao em caso de falha)
- **Permissoes 0600**: somente o proprietario pode ler/escrever arquivos sensiveis
- **Prevencao de path traversal**: `sanitizePath()` rejeita caminhos fora do diretorio de dados
- **Verificacoes de sanidade de gas**: rejeita 0 gas e estimativas > 30M gas
- **Sem vazamento de chaves**: mensagens de erro nunca contem chaves privadas ou senhas

---

## Recursos

- **Sem custodia e isolado** — Chaves no Desktop, Agente nao possui nenhum segredo
- **Criptografia ponta a ponta** — X25519 + AES-256-GCM, Relay ve apenas texto cifrado
- **Pareamento automatico** — Configuracao unica, reconexao automatica apos reinicializacoes
- **Verificacao em tres niveis** — Chave publica + impressao digital do dispositivo + politica de IP em cada reconexao
- **Criptografia Keystore V3** — AES-256-GCM + scrypt KDF para chaves em repouso
- **Motor de politicas** — Limites por transacao e diarios, lista de enderecos permitidos, fila de aprovacao
- **8 chains EVM** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; extensivel para qualquer chain EVM
- **Recuperacao de sub-contas** — Escaneie e recupere contas derivadas (BIP-44 m/44'/60'/0'/0/{n}) durante a restauracao da carteira
- **Modo de operacao duplo** — Supervisionado (humano aprova) ou Autonomo (dentro dos limites)
- **Contatos do agente** — Agenda de enderecos P2P com resolucao de nomes
- **Monitoramento de saldo** — Polling em segundo plano para transferencias recebidas
- **Historico de transacoes** — Cache local com registros completos
- **Relay em container** — Servidor Relay em Go com suporte Docker (framework Hertz)
- **17 ferramentas de carteira** — Publicadas no npm como [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet), instalavel via `npm install @janespace-ai/claw-wallet` ou `npx skills add janespace-ai/claw-wallet`
- **Internacionalizacao (i18n)** — Aplicativo Desktop suporta Ingles e Chines Simplificado com troca de idioma em tempo de execucao

---

## Inicio Rapido

### Pre-requisitos

- Node.js >= 18
- Go >= 1.21 (para o Servidor Relay)
- Um framework de Agente de IA compativel com OpenClaw

### 1. Inicie o Servidor Relay

```bash
cd server
go run cmd/relay/main.go
# Padrao: :8765
```

Ou com Docker:

```bash
cd server
docker compose up -d
```

### 2. Inicie a Carteira Desktop

```bash
cd desktop
npm install
npm run dev
```

### 3. Crie uma Carteira e Pareie

1. No aplicativo Desktop: defina senha → faca backup da mnemonica
2. Clique em "Generate Pairing Code" → copie o codigo de 8 caracteres
3. No seu Agente, chame `wallet_pair({ shortCode: "ABCD1234" })`
4. Pronto — sessao E2EE estabelecida, reconexao automatica habilitada

### 4. Use com Seu Agente

17 ferramentas disponiveis. Exemplo de conversa:

```
Voce:    "Envie 10 USDC para Bob na Base"
Agente:  wallet_contacts_resolve("bob") → 0x742d...
         wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
         → Politica OK → E2EE → Desktop assina → Transmite
         "Enviados 10 USDC para Bob. tx: 0xab3f..."
```

---

## Ferramentas Disponiveis

| Ferramenta | Descricao |
|------------|-----------|
| **Gerenciamento de Carteira** | |
| `wallet_create` | Cria uma nova carteira com keystore criptografado |
| `wallet_import` | Importa carteira existente via chave privada |
| `wallet_address` | Obtem o endereco atual da carteira |
| `wallet_pair` | Pareia com a Carteira Desktop via codigo curto |
| **Saldo e Gas** | |
| `wallet_balance` | Consulta saldo de ETH ou token ERC-20 |
| `wallet_estimate_gas` | Estima custo de gas antes de enviar |
| **Transacoes** | |
| `wallet_send` | Envia ETH ou tokens ERC-20 (suporta nomes de contatos) |
| `wallet_history` | Consulta historico de transacoes paginado |
| **Contatos** | |
| `wallet_contacts_add` | Adiciona ou atualiza um contato com enderecos multi-chain |
| `wallet_contacts_list` | Lista todos os contatos salvos |
| `wallet_contacts_resolve` | Busca o endereco de um contato pelo nome |
| `wallet_contacts_remove` | Remove um contato |
| **Politicas e Aprovacoes** | |
| `wallet_policy_get` | Visualiza a politica de seguranca atual |
| `wallet_policy_set` | Atualiza limites de gastos, lista de permitidos ou modo |
| `wallet_approval_list` | Lista aprovacoes de transacoes pendentes |
| `wallet_approval_approve` | Aprova uma transacao na fila |
| `wallet_approval_reject` | Rejeita uma transacao na fila |

---

## Estrutura do Projeto

```
wallet/
├── agent/                 # Framework do Agente de IA (TypeScript) — zero segredos
│   ├── index.ts           # Classe ClawWallet — orquestra ferramentas e signer
│   ├── e2ee/              # Cripto E2EE, transporte WebSocket, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, serializacao de chaves
│   │   ├── transport.ts   # Cliente WebSocket E2EE com handshake estendido
│   │   └── machine-id.ts  # Impressao digital do dispositivo (SHA256 de hostname:MAC)
│   ├── signer/            # RelaySigner — pareamento persistente, reconexao automatica
│   │   ├── relay-client.ts    # Conexao com Relay, pairId deterministico, reparo
│   │   ├── ipc-server.ts     # Servidor IPC via Unix domain socket
│   │   └── ipc-client.ts     # Cliente IPC para comunicacao ferramenta → signer
│   ├── tools/             # 17 definicoes de ferramentas de carteira
│   └── *.ts               # Politica, contatos, historico, monitor, validacao
│
├── desktop/               # Carteira Desktop Electron — guarda todos os segredos
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # Mnemonica BIP-39, criptografia/descriptografia Keystore V3
│       │   ├── signing-engine.ts   # Assinatura de transacoes com zeragem de memoria
│       │   ├── signing-history.ts  # Historico de atividade de transacoes em SQLite
│       │   ├── tx-sync-service.ts  # Sincronizacao de status de transacoes na blockchain
│       │   ├── chain-adapter.ts    # Cliente RPC para recibos de transacoes
│       │   ├── database-service.ts # Conexao SQLite e migracoes de schema
│       │   ├── price-service.ts    # Busca de precos multi-nivel (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # Agregacao de saldo de tokens entre chains
│       │   ├── relay-bridge.ts     # Relay E2EE, verificacao em tres niveis, congelamento de sessao
│       │   ├── security-monitor.ts # Deteccao de mudancas de IP/dispositivo, alertas
│       │   └── lock-manager.ts     # Bloqueio/desbloqueio de carteira, timeout por inatividade
│       ├── preload/                # contextBridge seguro (sem nodeIntegration)
│       ├── renderer/               # Interface HTML/CSS/JS (Aba de Atividade, exibicao de saldo)
│       └── shared/
│           └── e2ee-crypto.ts      # Primitivas E2EE compartilhadas
│
└── server/                # Servidor Relay em Go (Hertz) — encaminhador sem estado
    ├── cmd/relay/main.go  # Ponto de entrada, configuracao de rotas
    ├── internal/
    │   ├── hub/           # Hub WebSocket, vinculacao de IP, limitacao de taxa
    │   ├── pairing/       # Geracao e resolucao de codigos curtos
    │   ├── middleware/     # CORS, log de acesso
    │   └── iputil/        # Utilitarios de extracao de IP
    ├── Dockerfile         # Build multi-estagio
    └── docker-compose.yml # Implantacao com um comando
```

---

## Chains e Tokens Suportados

| Chain | Chain ID | Tokens Integrados |
|-------|----------|-------------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

Qualquer token ERC-20 pode ser usado passando seu endereco de contrato. As chains sao extensiveis — adicione qualquer chain compativel com EVM atraves de configuracao.

### Configuracao de Rede Web3

Tanto o Agente quanto o Desktop suportam configuracao personalizada de endpoints RPC para producao e desenvolvimento local.

#### Configuracao de Producao

Crie `config.json` com seus provedores RPC preferidos:

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

#### Desenvolvimento Local

Use Hardhat ou Anvil para testes de blockchain local:

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

Inicie os nos locais:

```bash
# Simulacao Ethereum (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Simulacao Base (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

Consulte [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) para o guia completo de configuracao.

#### Comportamento Padrao

Se a configuracao `chains` nao for fornecida, o sistema utiliza os endpoints RPC publicos integrados do viem.

---

## Desenvolvimento

```bash
# Agente (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Servidor Relay (Go)
cd server && go test ./...

# Implantacao Docker
cd server && docker compose up --build
```

### Suite de Testes

| Categoria | O Que e Testado |
|-----------|-----------------|
| **Keystore** | Geracao de chaves, criptografia/descriptografia, senha incorreta, estrutura V3 |
| **Politica** | Limites, lista de permitidos, modos, fluxo de aprovacao, aritmetica inteira em centavos |
| **E2EE** | Serializacao de par de chaves, derivacao deterministicade pairId |
| **Relay Hub** | Roteamento WebSocket, vinculacao de IP por par, limitacao de taxa de conexao |
| **Pareamento** | Geracao de codigo curto, expiracao, resolucao |
| **Middleware** | Configuracao CORS, log de acesso |
| **Seguranca** | Entropia de chaves, limpeza de memoria, injecao de entrada, permissoes de arquivo, path traversal, seguranca RPC |

---

## Solucao de Problemas

| Problema | Solucao |
|----------|---------|
| "Wallet app offline" | Certifique-se de que a Carteira Desktop esta rodando e conectada ao Relay |
| "Pairing code expired" | Gere um novo codigo (TTL de 10 min) |
| Solicitacoes de assinatura bloqueadas | Verifique se a sessao esta congelada (incompatibilidade de identidade) — re-pareie se necessario |
| Alerta de mudanca de IP | Configure a politica de IP: `block` / `warn` / `allow` |
| Agente nao consegue reconectar | Use `wallet_repair` para limpar dados de pareamento e re-parear |
| Aviso de mesma maquina | Mova a Carteira Desktop para um dispositivo separado para seguranca completa |

---

## Internacionalizacao (i18n)

O aplicativo Desktop suporta multiplos idiomas com troca de idioma em tempo de execucao:

### Idiomas Suportados

- **English (en)** — Idioma padrao
- **Simplified Chinese (zh-CN)** — Chines Simplificado

### Recursos

- **Deteccao automatica**: Detecta automaticamente o idioma do sistema na primeira execucao
- **Troca manual**: Seletor de idioma no cabecalho (canto superior direito)
- **Persistencia**: Preferencia do usuario salva no localStorage entre sessoes
- **Atualizacoes em tempo de execucao**: Elementos estaticos da interface (botoes, rotulos, abas) atualizam imediatamente
- **UX fluida**: Nenhum reinicio do aplicativo necessario para mudancas de idioma

### Arquitetura

```
i18next Framework
├── Translation Files (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # Buttons labels messages
│   │   ├── setup.json       # Wallet setup flow
│   │   ├── activity.json    # Transaction activity
│   │   ├── security.json    # Security events
│   │   ├── settings.json    # Settings panel
│   │   ├── pairing.json     # Device pairing
│   │   ├── errors.json      # Error messages
│   │   ├── modals.json      # Approval export alert dialogs
│   │   └── contactsPage.json
│   └── zh-CN/ (same structure; keep keys in sync with en)
│   Note: `npm run build` copies these files to dist/renderer/locales/ for Electron.
├── Language Detection (i18n.js)
│   ├── 1. Check localStorage (user preference)
│   ├── 2. Check navigator.language (system)
│   └── 3. Fallback to English
└── DOM Update System
    ├── data-i18n attributes for static content
    └── i18next.t() for dynamic content
```

### Adicionando um Novo Idioma

1. Crie o diretorio de traducao:
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. Copie e traduza todos os arquivos JSON de `en/`:
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # Edite cada arquivo para traduzir os valores
   ```

3. Adicione a opcao de idioma ao seletor em `index.html`:
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Seu Idioma</option>
   </select>
   ```

4. Atualize a lista de namespaces em `i18n.js` se necessario

### Convencoes de Chaves de Traducao

Use nomenclatura hierarquica e semantica:

```
namespace.feature.element

Exemplos:
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### Para Desenvolvedores

**HTML (conteudo estatico)**:
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript (conteudo dinamico)**:
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**Com interpolacao**:
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// Traducao: "Remover todas as entradas do contato \"{name}\"?"
```

---

## Contribuindo

Contribuicoes sao bem-vindas! Veja como voce pode ajudar:

### Reportar Problemas
- **Relatorios de bugs**: Use a pagina de [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues)
- **Solicitacoes de recursos**: Sugira novos recursos ou melhorias
- **Vulnerabilidades de seguranca**: Por favor, reporte de forma privada por email (veja o perfil do GitHub)

### Enviar Pull Requests
1. **Fork** o repositorio
2. **Crie uma branch**: `git checkout -b feature/your-feature`
3. **Faca commit das mudancas**: `git commit -m 'Add some feature'`
4. **Push**: `git push origin feature/your-feature`
5. **Abra um Pull Request**

### Configuracao de Desenvolvimento
```bash
# Clone o repositorio
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# Instale as dependencias
npm install

# Compile o projeto
npm run build

# Execute os testes
npm test
```

### Areas que Precisam de Ajuda
- **Documentacao**: Melhore guias, adicione tutoriais, traduza para mais idiomas
- **Novas chains**: Adicione suporte para chains EVM ou nao-EVM adicionais
- **Melhorias de UI/UX**: Aprimore a interface da carteira desktop
- **Testes**: Escreva testes unitarios/de integracao, melhore a cobertura de testes

### Estilo de Codigo
- Use **TypeScript** com verificacao de tipos estrita
- Siga a formatacao do **Prettier** (configurado em `.prettierrc`)
- Escreva mensagens de commit significativas
- Adicione testes para novas funcionalidades

### Junte-se a Comunidade
- **Discord**: [Entre no nosso servidor](https://discord.gg/clawd) (em breve)
- **Twitter**: Siga [@janespace_ai](https://twitter.com/janespace_ai) para atualizacoes
- **GitHub Discussions**: Inicie uma discussao para perguntas ou ideias

---

## Licenca

MIT (c) [janespace-ai](https://github.com/janespace-ai)
