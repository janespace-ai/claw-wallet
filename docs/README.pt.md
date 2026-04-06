<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <b>Português</b>
</p>

# claw-wallet

**Deixe seu Agente de IA ter uma carteira de verdade — com segurança.**

Uma carteira cripto sem custódia para Agentes de IA [OpenClaw](https://getclaw.sh). As chaves privadas ficam em uma **Carteira Desktop Electron** separada, completamente isolada do modelo de IA. O Agente e o Desktop se comunicam por um canal **E2EE (Criptografia Ponta-a-Ponta)** via um **Servidor de Retransmissão Go** — o relay apenas encaminha texto cifrado e nunca pode ler ou adulterar mensagens.

> As chaves privadas nunca tocam o modelo de IA. Não estão na mesma máquina, nem no mesmo processo, nem na memória. O Agente só vê endereços de carteira e hashes de transação.

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

**Design de três componentes**: Cada componente tem uma única responsabilidade. Mesmo que o host do Agente seja totalmente comprometido, o atacante não obtém nenhum material de chave.

---

## Fluxo de Interação do Usuário

### Configuração Inicial: Pareamento

Necessário apenas uma vez. Após o pareamento inicial, a reconexão é totalmente automática.

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

### Uso Diário: Reconexão Automática

Após o pareamento inicial, o Agente e o Desktop se reconectam automaticamente ao reiniciar — nenhuma ação do usuário é necessária.

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

### Fluxo de Transação

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

## Arquitetura de Segurança

claw-wallet utiliza **defesa em profundidade** com dois domínios de segurança independentes: **segurança de comunicação** (como os componentes se comunicam) e **segurança de chaves** (como as chaves são armazenadas e usadas).

### Parte A: Segurança de Comunicação

#### 1. Criptografia Ponta-a-Ponta (E2EE)

Todas as mensagens entre Agente e Desktop são criptografadas ponta-a-ponta. O servidor Relay só vê texto cifrado.

| Componente | Detalhe |
|-----------|--------|
| **Troca de Chaves** | X25519 ECDH (Curve25519) |
| **Derivação de Chave** | HKDF-SHA256 |
| **Criptografia** | AES-256-GCM (autenticada) |
| **Anti-Replay** | Nonce incremental por mensagem |
| **Sigilo Futuro** | Novas chaves efêmeras por sessão |

#### 2. Pareamento Automático e Reconexão

O pareamento manual só é necessário uma vez. O sistema usa **pares de chaves de comunicação persistentes** e **IDs de par determinísticos** para reconexão automática:

- **Pares de Chaves Persistentes**: Pares de chaves X25519 são salvos em disco — criptografados com a senha da carteira no Desktop (scrypt + AES-256-GCM), protegidos por permissão de arquivo (0600) no Agente
- **PairId Determinístico**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — ambos os lados calculam o mesmo ID independentemente, sem necessidade de coordenação
- **Reconexão sem Interação**: Ao reiniciar, ambos os lados carregam suas chaves armazenadas, recalculam o pairId e se reconectam pelo Relay automaticamente

#### 3. Verificação de Reconexão em Três Níveis

Quando um Agente se reconecta, o Desktop realiza três verificações de identidade antes de permitir qualquer assinatura:

| Nível | Verificação | Ação em Caso de Falha |
|-------|-------|----------------|
| **Nível 1** (Rígido) | Chave pública corresponde à chave armazenada | Rejeitar + forçar novo pareamento |
| **Nível 2** (Rígido) | machineId corresponde ao ID armazenado | Congelar sessão + forçar novo pareamento |
| **Nível 3** (Configurável) | Política de mudança de IP | `block` / `warn` (padrão) / `allow` |

- **machineId**: SHA256(hostname + endereço MAC) — detecta se o Agente mudou para uma máquina diferente
- **Congelamento de Sessão**: Quando uma incompatibilidade de identidade é detectada, todas as solicitações de assinatura são bloqueadas até que o usuário faça um novo pareamento manualmente
- **Política de IP**: Configurável por implantação — `block` rejeita imediatamente, `warn` alerta o usuário mas permite (com tolerância de mesma sub-rede), `allow` ignora a verificação

#### 4. Proteção no Lado do Relay

O Servidor de Retransmissão Go aplica segurança adicional mesmo sem poder ler o conteúdo das mensagens:

| Proteção | Detalhe |
|------------|--------|
| **Vinculação de IP por pairId** | Máximo de 2 IPs de origem distintos por par simultaneamente |
| **Limite de Taxa de Conexão** | Máximo de 10 novas conexões WebSocket por pairId por minuto |
| **Remoção de Conexão** | Se um terceiro cliente se conectar a um par, o mais antigo é removido |
| **Registro de Metadados** | Eventos de conexão registrados com pairId truncado para auditoria |

#### 5. Fallback de Novo Pareamento Manual

Quando a reconexão automática falha (mudança de dispositivo, corrupção de chave, etc.):

- **Lado do Agente**: método RPC `wallet_repair` limpa os dados de pareamento armazenados e redefine o estado
- **Lado do Desktop**: ação "Parear Dispositivo Novamente" na interface do painel de segurança
- Ambos os lados geram novos pares de chaves, exigindo uma nova troca de código de pareamento

### Parte B: Segurança de Chaves

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

O Agente interage exclusivamente através de Tool APIs. Nenhuma ferramenta retorna material de chave.

#### 7. Criptografia em Repouso — Keystore V3

| Componente | Detalhe |
|-----------|--------|
| **Cifra** | AES-256-GCM (criptografia autenticada) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes aleatórios por criptografia |
| **IV** | 16 bytes aleatórios por criptografia |
| **Tag de Autenticação** | Tag GCM impede adulteração do texto cifrado |
| **Permissões de Arquivo** | 0600 (somente leitura/escrita do proprietário) |

#### 8. Segurança de Memória

- Chaves privadas são descriptografadas apenas durante `signTransaction()` / `signMessage()`
- Buffers de chave são zerados com `Buffer.fill(0)` em blocos `finally` — mesmo se a assinatura lançar erro
- Material de chave descriptografado existe na memória por milissegundos, não segundos

#### 9. Motor de Políticas — Controles de Gastos Independentes

O motor de políticas é executado **antes** de qualquer assinatura e não pode ser contornado por injeção de prompt:

| Controle | Padrão | Descrição |
|---------|---------|-------------|
| Limite por transação | $100 | Valor máximo por transação única |
| Limite diário | $500 | Teto de gastos cumulativos em 24h |
| Lista de endereços permitidos | Vazia | Obrigatória no modo supervisionado |
| Modo de operação | Supervisionado | `supervised` (lista de permitidos obrigatória) ou `autonomous` (apenas limites) |
| Fila de aprovação | Expira em 24h | Transações bloqueadas aguardam revisão manual |

**Medidas anti-contorno:**
- Aritmética de centavos inteiros para prevenir ataques de precisão de ponto flutuante
- Correspondência de lista de permitidos sem distinção de maiúsculas/minúsculas
- IDs de aprovação criptograficamente aleatórios (não sequenciais, não adivinháveis)

#### 10. Validação de Entrada

| Entrada | Validação |
|-------|-----------|
| Endereço | Formato hex, comprimento=42, checksum EIP-55 via viem |
| Valor | Rejeita NaN, Infinity, negativo, zero, vazio |
| Chain | Lista restrita (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Símbolo do token | Máximo 20 caracteres, rejeita caracteres de injeção |
| Nome do contato | Máximo 100 caracteres, rejeita travessia de diretório |

#### 11. Segurança do Sistema de Arquivos e RPC

- **Escritas atômicas**: escreve em arquivo temporário → renomeia (previne corrupção em caso de falha)
- **Permissões 0600**: somente o proprietário pode ler/escrever arquivos sensíveis
- **Prevenção de travessia de diretório**: `sanitizePath()` rejeita caminhos fora do diretório de dados
- **Verificações de gas**: rejeita gas 0 e estimativas de gas > 30M
- **Sem vazamento de chaves**: mensagens de erro nunca contêm chaves privadas ou senhas

---

## Funcionalidades

- **Sem custódia e isolada** — Chaves no Desktop, Agente não possui segredos
- **Criptografia ponta-a-ponta** — X25519 + AES-256-GCM, Relay vê apenas texto cifrado
- **Pareamento automático** — Configuração única, reconexão automática após reinicializações
- **Verificação em três níveis** — Chave pública + impressão digital do dispositivo + política de IP a cada reconexão
- **Criptografia Keystore V3** — AES-256-GCM + scrypt KDF para chaves em repouso
- **Motor de políticas** — Limites por transação e diários, lista de endereços permitidos, fila de aprovação
- **8 chains EVM** — Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; extensível para qualquer chain EVM
- **Recuperação de subcontas** — Escaneia e recupera automaticamente contas derivadas BIP-44 (m/44'/60'/0'/0/{n}) ao restaurar a carteira
- **Modo de operação dual** — Supervisionado (humano aprova) ou Autônomo (dentro dos limites)
- **Contatos do Agente** — Catálogo de endereços P2P com resolução de nomes
- **Monitoramento de saldo** — Verificação em segundo plano para transferências recebidas
- **Histórico de transações** — Cache local com registros completos
- **Relay Containerizado** — Servidor de Retransmissão Go com suporte a Docker (framework Hertz)
- **17 ferramentas de wallet** — Definições de ferramentas prontas para uso na integração com Agente de IA

---

## Início Rápido

### Pré-requisitos

- Node.js ≥ 18
- Go ≥ 1.21 (para o Servidor de Retransmissão)
- Um framework de Agente de IA compatível com OpenClaw

### 1. Iniciar o Servidor de Retransmissão

```bash
cd server
go run cmd/relay/main.go
# Padrão: :8765
```

Ou com Docker:

```bash
cd server
docker compose up -d
```

### 2. Iniciar a Carteira Desktop

```bash
cd desktop
npm install
npm run dev
```

### 3. Criar uma Carteira e Parear

1. No aplicativo Desktop: definir senha → fazer backup da mnemônica
2. Clicar em "Generate Pairing Code" → copiar o código de 8 caracteres
3. No seu Agente, chamar `wallet_pair({ shortCode: "ABCD1234" })`
4. Pronto — sessão E2EE estabelecida, reconexão automática ativada

### 4. Usar com Seu Agente

O Agente disponibiliza 17 ferramentas. Exemplo de conversa:

```
Você:    "Envie 10 USDC para Bob na Base"
Agente:  wallet_contacts_resolve("bob") → 0x742d...
         wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
         → Política ✓ → E2EE → Desktop assina → Transmite
         "Enviados 10 USDC para Bob. tx: 0xab3f..."
```

---

## Ferramentas Disponíveis

| Ferramenta | Descrição |
|------|-------------|
| **Gestão da Carteira** | |
| `wallet_create` | Criar uma nova carteira com keystore criptografado |
| `wallet_import` | Importar carteira existente via chave privada |
| `wallet_address` | Obter o endereço atual da carteira |
| `wallet_pair` | Parear com a Carteira Desktop via código curto |
| **Saldo e Gas** | |
| `wallet_balance` | Consultar saldo de ETH ou token ERC-20 |
| `wallet_estimate_gas` | Estimar custo de gas antes de enviar |
| **Transações** | |
| `wallet_send` | Enviar ETH ou tokens ERC-20 (suporta nomes de contatos) |
| `wallet_history` | Consultar histórico de transações paginado |
| **Contatos** | |
| `wallet_contacts_add` | Adicionar ou atualizar um contato com endereços multi-chain |
| `wallet_contacts_list` | Listar todos os contatos salvos |
| `wallet_contacts_resolve` | Buscar o endereço de um contato pelo nome |
| `wallet_contacts_remove` | Remover um contato |
| **Política e Aprovações** | |
| `wallet_policy_get` | Visualizar a política de segurança atual |
| `wallet_policy_set` | Atualizar limites de gastos, lista de permitidos ou modo |
| `wallet_approval_list` | Listar aprovações de transações pendentes |
| `wallet_approval_approve` | Aprovar uma transação na fila |
| `wallet_approval_reject` | Rejeitar uma transação na fila |

---

## Estrutura do Projeto

```
wallet/
├── agent/                 # Framework do Agente de IA (TypeScript) — zero segredos
│   ├── index.ts           # Classe ClawWallet — orquestra ferramentas e assinador
│   ├── e2ee/              # Cripto E2EE, transporte WebSocket, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, serialização de chaves
│   │   ├── transport.ts   # Cliente WebSocket E2EE com handshake estendido
│   │   └── machine-id.ts  # Impressão digital do dispositivo (SHA256 de hostname:MAC)
│   ├── signer/            # RelaySigner — pareamento persistente, reconexão automática
│   │   ├── relay-client.ts    # Conexão relay, pairId determinístico, reparo
│   │   ├── ipc-server.ts     # Servidor IPC via Unix domain socket
│   │   └── ipc-client.ts     # Cliente IPC para comunicação ferramenta → assinador
│   ├── tools/             # 17 definições de ferramentas
│   └── *.ts               # Política, contatos, histórico, monitor, validação
│
├── desktop/               # Carteira Desktop Electron — guarda todos os segredos
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # Mnemônica BIP-39, criptografia/descriptografia Keystore V3
│       │   ├── signing-engine.ts   # Assinatura de transações com zeramento de memória
│       │   ├── relay-bridge.ts     # Relay E2EE, verificação em três níveis, congelamento de sessão
│       │   ├── security-monitor.ts # Detecção de mudança de IP/dispositivo, alertas
│       │   └── lock-manager.ts     # Bloqueio/desbloqueio de carteira, timeout por inatividade
│       ├── preload/                # contextBridge seguro (sem nodeIntegration)
│       ├── renderer/               # Interface HTML/CSS/JS
│       └── shared/
│           └── e2ee-crypto.ts      # Primitivas E2EE compartilhadas
│
└── server/                # Servidor de Retransmissão Go (Hertz) — encaminhador sem estado
    ├── cmd/relay/main.go  # Ponto de entrada, configuração de rotas
    ├── internal/
    │   ├── hub/           # Hub WebSocket, vinculação de IP, limitação de taxa
    │   ├── pairing/       # Geração e resolução de código curto
    │   ├── middleware/     # CORS, registro de acesso
    │   └── iputil/        # Utilitários de extração de IP
    ├── Dockerfile         # Build multi-estágio
    └── docker-compose.yml # Implantação com um único comando
```

---

## Chains e Tokens Suportados

| Chain | Chain ID | Tokens Integrados |
|-------|----------|-----------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

Qualquer token ERC-20 pode ser usado passando seu endereço de contrato. As chains são extensíveis — adicione qualquer chain compatível com EVM por meio de configuração.

---

## Desenvolvimento

```bash
# Agente (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Servidor de Retransmissão (Go)
cd server && go test ./...

# Implantação Docker
cd server && docker compose up --build
```

### Suíte de Testes

| Categoria | O que é Testado |
|----------|---------------|
| **Keystore** | Geração de chaves, criptografar/descriptografar, senha incorreta, estrutura V3 |
| **Política** | Limites, lista de permitidos, modos, fluxo de aprovação, aritmética de centavos inteiros |
| **E2EE** | Serialização de par de chaves, derivação determinística de pairId |
| **Relay Hub** | Roteamento WebSocket, vinculação de IP por par, limitação de taxa de conexão |
| **Pareamento** | Geração de código curto, expiração, resolução |
| **Middleware** | Configuração CORS, registro de acesso |
| **Segurança** | Entropia de chave, limpeza de memória, injeção de entrada, permissões de arquivo, travessia de diretório, segurança RPC |

---

## Solução de Problemas

| Problema | Solução |
|-------|---------|
| "Wallet app offline" | Certifique-se de que a Carteira Desktop está em execução e conectada ao Relay |
| "Pairing code expired" | Gere um novo código (TTL de 10 min) |
| Solicitações de assinatura bloqueadas | Verifique se a sessão está congelada (incompatibilidade de identidade) — faça novo pareamento se necessário |
| Alerta de mudança de IP | Configure a política de IP: `block` / `warn` / `allow` |
| Agente não consegue reconectar | Use `wallet_repair` para limpar dados de pareamento e parear novamente |
| Aviso de mesma máquina | Mova a Carteira Desktop para um dispositivo separado para segurança total |

---

## Licença

MIT
