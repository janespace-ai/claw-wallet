<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <b>Português</b>
</p>

# claw-wallet

**Dê ao seu Agente de IA uma carteira real — com segurança.**

Plugin de carteira Web3 para o framework de agentes de IA [OpenClaw](https://getclaw.sh). Carteira cripto local e auto-hospedada, não custodiante, que permite aos agentes gerenciar ativos, enviar transações e interagir com blockchains EVM — mantendo chaves privadas criptografadas e totalmente isoladas do LLM.

> Chaves privadas nunca tocam o modelo de IA. O agente opera por APIs de ferramentas que só retornam endereços e hashes de transação.

---

## Por que claw-wallet?

Quando agentes de IA precisam operar on-chain (negociação, pagamentos, estratégias DeFi), surge um conflito: **o modelo precisa agir, mas nunca pode ver a chave**. claw-wallet resolve isso com separação clara:

- **O LLM só vê:** endereço da carteira, saldos, hashes de transação, estado da política.
- **O LLM nunca vê:** chaves privadas, mnemonics, material de chave descriptografado.

---

## Recursos

- **Não custodiante e local** — Chaves criptografadas na sua máquina, zero dependência de nuvem.
- **Criptografia Keystore V3** — AES-256-GCM + scrypt KDF, mesmo padrão de clientes Ethereum.
- **Motor de políticas** — Limites por transação e diários, lista branca de endereços, fila de aprovação manual. Mesmo com prompt injection, o motor bloqueia transações não autorizadas.
- **Multi-chain EVM** — Base (padrão, baixo gas) e Ethereum mainnet.
- **Dois modos** — Supervisionado (aprovação humana) ou Autônomo (dentro dos limites).
- **Contactos do agente** — Caderno de endereços P2P; agentes resolvem endereços por nome.
- **Monitor de saldo** — Polling em segundo plano para transferências recebidas.
- **Histórico de transações** — Cache local de todas as transações enviadas/recebidas.
- **16 ferramentas OpenClaw** — Definições prontas para integrar ao agente.

---

## Casos de uso

**1. Humano → Agente → Contrato/Instituição**  
Você manda o agente pagar um comerciante, cunhar NFT ou interagir com protocolo DeFi. A lista branca garante envio só para endereços aprovados.

**2. Humano → Agente → Outro agente**  
Seu agente paga outro agente de IA por um serviço. Contactos resolvem endereços por nome (ex.: `"bob-agent"`). Típico: pagamento de API, compra de dados, recompensas colaborativas.

**3. Agente autônomo**  
O agente opera sozinho dentro dos limites (negociação, serviços, rebalanceamento). O motor de políticas age como **barreira**: mesmo agentes totalmente autônomos respeitam limites de gasto configuráveis.

| | Supervisionado | Autônomo |
|---|---|---|
| **Quem decide** | Humano para cada tx fora da lista | Agente dentro dos limites |
| **Lista branca** | Obrigatória | Não |
| **Limites** | Por tx + diário | Por tx + diário |

---

## Início rápido

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
// ... agente usa as ferramentas ...
await wallet.shutdown();
```

---

## Modelo de segurança

- **Isolamento de chaves** — Nenhuma ferramenta retorna material de chave; até `wallet_create` retorna só o endereço.
- **Criptografia** — Keystore V3: AES-256-GCM, scrypt (N=131072, r=8, p=1), salt/IV aleatórios, permissão de arquivo 0600.
- **Memória** — Chaves só descriptografadas em `signTransaction()`/`signMessage()` e zeradas em `finally` com `Buffer.fill(0)`.
- **Políticas** — Rodam antes de qualquer assinatura; valores em **centavos inteiros** contra ataques de precisão; lista branca case-insensitive; IDs de aprovação aleatórios.
- **Validação de entrada** — Endereço, valor, chain, token, nome de contacto e JSON do keystore validados; path traversal e parâmetros KDF inválidos rejeitados.
- **Sistema de ficheiros** — Escrita atómica (temp + rename), 0600, sem acesso fora do diretório de dados.
- **RPC** — Saldos negativos tratados como 0; gas 0 ou >30M rejeitado; sem chaves em mensagens de erro.

---

## Configuração e armazenamento

`dataDir` (padrão: `~/.openclaw/wallet`), `defaultChain`, `chains`, `password`, `pollIntervalMs`, `onBalanceChange`.  
Dados: `keystore.json`, `contacts.json`, `history.json`, `policy.json` — tudo local.

---

## Chains e tokens suportados

| Chain | Chain ID | Tokens embutidos |
|-------|----------|------------------|
| Base | 8453 | USDC, USDT |
| Ethereum | 1 | USDC, USDT |

ERC-20 por endereço de contrato; outras chains EVM por configuração.

---

## Desenvolvimento

```bash
npm install && npm test && npm run typecheck && npm run build
```

Testes funcionais e de segurança (keystore, chain, contacts, history, policy, E2E, input, RPC, ficheiros).

---

## Requisitos

Node.js ≥ 18; framework de agente compatível com OpenClaw ou com definição de ferramentas.

---

## Licença

MIT
