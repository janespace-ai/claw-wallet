<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <b>Español</b> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Dale a tu Agente IA una billetera real — de forma segura.**

Plugin de billetera Web3 para el framework de agentes IA [OpenClaw](https://getclaw.sh). Una billetera cripto local, autocustodiada y sin custodia que permite a los agentes IA gestionar activos, enviar transacciones e interactuar con blockchains EVM, manteniendo las claves privadas cifradas y completamente aisladas del LLM.

> Las claves privadas nunca tocan el modelo de IA. El agente opera a través de la API de herramientas, que solo devuelve direcciones y hashes de transacciones.

---

## ¿Por qué claw-wallet?

Cuando un agente IA necesita operar on-chain (transacciones, pagos, estrategias DeFi), enfrenta una contradicción fundamental: **el modelo necesita ejecutar acciones, pero nunca debe ver las claves privadas**. claw-wallet resuelve este problema con un diseño de capas bien definido:

```
┌─────────────────────────────────────────────────────────────┐
│                    Tu Agente IA (LLM)                       │
│                                                             │
│  "Envía 10 USDC a Alice en Base"                            │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Tool APIs   │───▶│  Motor de    │───▶│  Almacén de  │    │
│  │ (16 tools)  │    │  Políticas   │    │  Claves      │    │
│  │             │    │ (límites y   │    │ (AES-256-GCM │    │
│  │             │    │  aprobación) │    │  + scrypt)   │    │
│  └─────────────┘    └──────────────┘    └──────┬───────┘    │
│                                                │            │
│                                          Firma y difunde    │
│                                                │            │
│                                         ┌──────▼───────┐    │
│                                         │  Cadenas EVM │    │
│                                         │  Base / ETH  │    │
│                                         └──────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Lo que el LLM puede ver:** Direcciones de billetera, saldos, hashes de transacciones, estado de políticas.
**Lo que el LLM no puede ver:** Claves privadas, frases mnemotécnicas, material criptográfico descifrado.

---

## Características

- **Sin custodia y ejecución local** — Las claves se almacenan cifradas en tu máquina, sin dependencia de la nube.
- **Cifrado Keystore V3** — AES-256-GCM + scrypt KDF, el mismo estándar utilizado por los clientes de Ethereum.
- **Motor de políticas** — Límites de gasto por transacción y diarios, lista blanca de direcciones, cola de aprobación humana. Incluso si el agente sufre un ataque de inyección de prompt, el motor de políticas bloquea las transacciones no autorizadas.
- **Multi-cadena EVM** — Compatible con Base (predeterminado, bajo Gas) y Ethereum mainnet. Extensible a cualquier cadena EVM.
- **Dos modos de operación** — Modo supervisado (aprobación humana) o modo autónomo (ejecución automática dentro de los límites).
- **Agenda de contactos del agente** — Libreta de direcciones P2P. Los agentes intercambian direcciones y las resuelven automáticamente por nombre.
- **Monitoreo de saldos** — Sondeo en segundo plano que detecta transferencias entrantes y notifica en tiempo real.
- **Historial de transacciones** — Caché local de todas las transacciones enviadas y recibidas.
- **16 herramientas OpenClaw** — Definiciones de herramientas plug-and-play, integración perfecta con agentes IA.

---

## Casos de uso

### Caso 1: Humano → Agente → Contrato / Institución

Le indicas al agente que pague a un comerciante, acuñe un NFT o interactúe con un protocolo DeFi.

```
 Tú (conversación)               Tu Agente                        On-chain
─────────────────────────────────────────────────────────────────────────────
 "Paga 50 USDC al              wallet_contacts_resolve            Uniswap
  tesoro de Uniswap            → 0x1a9C...                       Contrato
  en Ethereum"                                                    de tesoro
                                wallet_send                         │
                                  to: 0x1a9C...                     │
                                  amount: 50                        │
                                  token: USDC                       │
                                  chain: ethereum                   │
                                        │                           │
                                Motor de políticas:                 │
                                  ✓ $50 < límite de $100/tx        │
                                  ✓ Total diario dentro de $500    │
                                  ✓ 0x1a9C en lista blanca         │
                                        │                           │
                                Firma → Difunde ────────────────────▶│
                                        │                           │
                                Devuelve: tx hash 0xab3f...    ✓ Confirmada
```

**Usos típicos:** Pagos de suscripción SaaS, compras de servicios on-chain, interacción con protocolos DeFi, depósitos en exchanges. La lista blanca de direcciones garantiza que el agente solo pueda transferir a direcciones de contratos previamente aprobadas.

### Caso 2: Humano → Agente → Otro Agente

Le indicas a tu agente que pague a otro agente IA por un servicio. Los agentes resuelven direcciones automáticamente a través del sistema de contactos.

```
 Tú (conversación)          Tu Agente                    Agente de Bob
──────────────────────────────────────────────────────────────────
 "Envía 10 USDC al        wallet_contacts_add
  agente de Bob            name: "bob-agent"
  en Base"                 base: 0x742d...
                                │
                         wallet_send
                           to: "bob-agent"     ◄── Resuelto desde contactos
                           amount: 10
                           token: USDC
                           chain: base
                                │
                         Política ✓ → Firma → Difunde ──────────▶ 0x742d...
                                │                              │
                         tx: 0xef01...                    Monitor de Bob
                                                          detecta +10 USDC
                                                          notifica al agente
                                                          de Bob
```

**Usos típicos:** Pagos por llamadas API entre agentes, compra de datos, recompensas por tareas colaborativas. La agenda de contactos hace que los pagos recurrentes entre agentes sean tan simples como usar un nombre, sin necesidad de pegar direcciones cada vez.

### Caso 3: Agente autónomo

El agente opera de forma independiente, ejecutando transacciones, comprando servicios o ajustando carteras de inversión dentro de los límites de la política. Sin intervención humana por transacción individual.

```
 Agente (modo autónomo)                                     On-chain
──────────────────────────────────────────────────────────────────
 Detectado: precio de ETH bajó 5%
 Decisión: oportunidad de compra

 wallet_balance → 500 USDC disponibles
 wallet_estimate_gas → 0.0001 ETH

 wallet_send
   to: 0xDEX_ROUTER         (en lista blanca)
   amount: 200
   token: USDC
   chain: base
         │
 Motor de políticas:
   ✓ $200 > límite de $100/tx  ← Bloqueado
   → En cola de aprobación (id: a3f8...)

 ─── Opción A: Aumentar el límite ───
 wallet_policy_set
   perTransactionLimitUsd: 300
   mode: "autonomous"

 Reenviar → Política ✓ → Firma → Difunde → Confirmada

 ─── Opción B: Aprobación humana ───
 wallet_approval_approve("a3f8...")
 → Firma → Difunde → Confirmada
```

**Usos típicos:** Farming DeFi, estrategias de trading automatizado, pagos de suscripciones periódicas, rebalanceo de cartera. El motor de políticas actúa como **barrera de seguridad**: incluso un agente completamente autónomo opera dentro de límites de gasto configurables.

### Comparación de modos

| | Modo supervisado | Modo autónomo |
|---|---|---|
| **Quién decide** | Aprobación humana para cada tx fuera de lista blanca | El agente decide dentro de los límites |
| **Lista blanca requerida** | Sí — direcciones fuera de lista blanca son bloqueadas | No — cualquier dirección dentro de los límites |
| **Límites de gasto** | Límites por tx + diarios aplicados | Límites por tx + diarios aplicados |
| **Ideal para** | Billeteras de alto valor, establecer confianza inicial | Operaciones rutinarias, bots de trading |
| **Si se excede el límite** | En cola → Aprobación/rechazo humano | En cola → Aprobación/rechazo humano |

---

## Inicio rápido

### Instalación

```bash
npm install claw-wallet
```

### Uso básico

```typescript
import { ClawWallet } from "claw-wallet";

const wallet = new ClawWallet({
  defaultChain: "base",
  password: process.env.WALLET_PASSWORD,
});

await wallet.initialize();

// Registrar las 16 herramientas en tu agente OpenClaw
const tools = wallet.getTools();

// ... El agente se ejecuta, usando herramientas para enviar/recibir/gestionar ...

// Cierre ordenado: guarda historial, contactos y políticas en disco
await wallet.shutdown();
```

---

## Cómo funciona

### Flujo de transacción

Flujo completo desde la intención del agente hasta la confirmación on-chain:

```
  Agente dice: "Envía 0.5 ETH a Bob en Base"
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  1. Validación de entrada           │  Formato de dirección, rango de
  │     validateAddress / validateAmount│  cantidad, cadena, símbolo de token
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  2. Resolución de destinatario      │  "Bob" → búsqueda en contactos
  │     Nombre de contacto o dirección  │  → 0x742d...4a (cadena Base)
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  3. Verificación de saldo           │  Saldo ETH ≥ monto + Gas?
  │     getBalance + estimateGas       │  ERC-20: saldo del token + Gas ETH
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  4. Verificación de política        │  ✓ ¿Dentro del límite por tx ($100)?
  │     PolicyEngine.checkTransaction  │  ✓ ¿Dentro del límite diario ($500)?
  │                                     │  ✓ ¿Dirección en lista blanca
  │                                     │    (modo supervisado)?
  │     ¿Bloqueado? → Cola de          │  → Devuelve ID de aprobación
  │       aprobación                    │
  │     ¿Aprobado? → Continuar ↓       │
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  5. Firma de transacción            │  Descifra clave (scrypt + AES-256-GCM)
  │     Almacén → Descifrar → Firmar   │  Firma con viem
  │     → Limpia buffer inmediatamente  │  Limpieza en finally{}
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  6. Difusión y confirmación         │  Envía tx raw al RPC
  │     broadcastTransaction           │  Espera recibo
  └─────────────────┬───────────────────┘
                    │
                    ▼
  ┌─────────────────────────────────────┐
  │  7. Registro y retorno              │  Guarda en historial local
  │     TransactionHistory.addRecord   │  Devuelve: { hash, status, gasUsed }
  └─────────────────────────────────────┘
```

### Flujo de aprobación (modo supervisado)

Cuando una transacción excede los límites o la dirección destino no está en la lista blanca:

```
  Agente → wallet_send → Política bloquea → Devuelve ID de aprobación
                                        │
              ┌─────────────────────────┘
              ▼
  Revisión:  wallet_approval_list  →  Ver detalles de tx pendientes
  humana     wallet_approval_approve(id)  →  Transacción se ejecuta
             wallet_approval_reject(id)   →  Transacción cancelada
             (Expira automáticamente en 24 horas sin acción)
```

---

## Herramientas disponibles

claw-wallet proporciona 16 herramientas invocables por el agente:

| Herramienta | Descripción |
|------|------|
| **Gestión de billetera** | |
| `wallet_create` | Crea una nueva billetera, genera almacén de claves cifrado |
| `wallet_import` | Importa una billetera existente mediante clave privada |
| `wallet_address` | Obtiene la dirección actual de la billetera (sin descifrado) |
| **Saldos y Gas** | |
| `wallet_balance` | Consulta saldo de ETH o tokens ERC-20 |
| `wallet_estimate_gas` | Estima el coste de Gas de una transacción |
| **Transacciones** | |
| `wallet_send` | Envía ETH o tokens ERC-20 (compatible con nombres de contacto) |
| `wallet_history` | Consulta historial de transacciones paginado |
| **Contactos** | |
| `wallet_contacts_add` | Añade o actualiza un contacto (soporta direcciones multi-cadena) |
| `wallet_contacts_list` | Lista todos los contactos |
| `wallet_contacts_resolve` | Busca la dirección de un contacto por nombre |
| `wallet_contacts_remove` | Elimina un contacto |
| **Políticas y aprobaciones** | |
| `wallet_policy_get` | Consulta la política de seguridad actual |
| `wallet_policy_set` | Actualiza límites de gasto, lista blanca o modo |
| `wallet_approval_list` | Lista transacciones pendientes de aprobación |
| `wallet_approval_approve` | Aprueba una transacción en cola |
| `wallet_approval_reject` | Rechaza una transacción en cola |

---

## Modelo de seguridad

claw-wallet emplea una estrategia de **defensa en profundidad**: múltiples capas de seguridad independientes aseguran que ningún punto único de fallo pueda provocar la filtración de claves o transferencias no autorizadas.

### 1. Aislamiento de claves — Las claves nunca tocan el LLM

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     Agente IA      │ ◄──────────────── │   claw-wallet      │
│                    │ Direcciones,       │                    │
│  Sin acceso a:     │ hashes de tx      │  La clave privada  │
│  - Claves privadas │                   │  solo se descifra  │
│  - Archivos keystore│                  │  dentro de         │
│  - Contraseña      │                   │  signTransaction() │
│                    │                   │  y se limpia       │
│                    │                   │  inmediatamente     │
└────────────────────┘                   └────────────────────┘
```

El agente solo interactúa a través de la API de herramientas. Ninguna herramienta devuelve material criptográfico. Incluso `wallet_create` solo devuelve la dirección.

### 2. Cifrado en reposo — Keystore V3

| Componente | Detalle |
|------|------|
| **Algoritmo de cifrado** | AES-256-GCM (cifrado autenticado) |
| **Derivación de clave** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes aleatorios generados por cifrado |
| **Vector de inicialización** | 16 bytes aleatorios generados por cifrado |
| **Etiqueta de autenticación** | La etiqueta GCM previene la manipulación del texto cifrado |
| **Permisos de archivo** | 0600 (solo lectura/escritura para el propietario) |

La clave privada se cifra mediante derivación de clave scrypt y AES-256-GCM. Cada cifrado genera un salt e IV completamente nuevos y aleatorios, de modo que la misma clave + contraseña produce un texto cifrado diferente cada vez.

### 3. Seguridad en memoria

- Las claves privadas solo se descifran durante la ejecución de `signTransaction()` / `signMessage()`.
- El buffer de la clave se limpia con `Buffer.fill(0)` en el bloque `finally`, incluso si la firma lanza una excepción.
- El material criptográfico descifrado permanece en memoria solo durante milisegundos.

### 4. Motor de políticas — Control de gastos independiente

El motor de políticas se ejecuta **antes** de cualquier operación de firma y no puede eludirse mediante inyección de prompt:

| Control | Valor por defecto | Descripción |
|--------|--------|------|
| Límite por transacción | $100 | Monto máximo por transacción individual |
| Límite diario | $500 | Límite acumulativo en ventana de 24 horas |
| Lista blanca de direcciones | Vacía | Obligatoria en modo supervisado |
| Modo de operación | Supervisado | `supervised` (requiere lista blanca) o `autonomous` (solo límites) |
| Cola de aprobación | Expira en 24 horas | Las transacciones bloqueadas esperan revisión humana |

**Medidas anti-elusión:**
- Todos los montos en dólares usan **aritmética de centavos enteros** (multiplicar por 100, redondear), previniendo ataques de precisión de punto flotante (como múltiples transacciones de $0.51 que explotan errores de redondeo).
- La coincidencia de lista blanca **no distingue mayúsculas de minúsculas**, previniendo la elusión por mezcla de mayúsculas y minúsculas en direcciones.
- Los IDs de aprobación usan **números aleatorios criptográficos** (8 bytes hexadecimales) — no secuenciales, imposibles de adivinar.

### 5. Validación de entrada — Guardia en cada frontera

| Entrada | Reglas de validación |
|--------|---------|
| Dirección | Formato hexadecimal, longitud=42, checksum EIP-55 |
| Monto | Rechaza NaN, Infinity, negativos, cero, vacíos |
| Cadena | Lista blanca estricta (`base`, `ethereum`) |
| Símbolo de token | Máximo 20 caracteres, rechaza caracteres de inyección `<>"'\`/\` |
| Nombre de contacto | Máximo 100 caracteres, rechaza travesía de rutas (`..`, `/`, `\`) |
| JSON de Keystore | Estructura V3 completa + límites de parámetros KDF (n ≤ 2²⁰) |

### 6. Seguridad del sistema de archivos

- **Escritura atómica**: Escribe en archivo temporal → renombra (previene corrupción de datos en caso de fallo).
- **Permisos 0600**: Solo el propietario puede leer/escribir el almacén de claves, contactos, historial y archivos de política.
- **Protección contra travesía de rutas**: `sanitizePath()` resuelve y rechaza rutas fuera del directorio de datos.

### 7. Seguridad RPC

- **Clamp de saldo negativo**: Trata los saldos negativos devueltos por RPC como 0.
- **Verificación de Gas**: Rechaza estimaciones de Gas iguales a 0 o superiores a 30 millones.
- **Sin filtración de claves**: Los mensajes de error nunca contienen claves privadas ni contraseñas.

---

## Configuración

```typescript
const wallet = new ClawWallet({
  // Directorio de datos (por defecto: ~/.openclaw/wallet)
  dataDir: "~/.openclaw/wallet",

  // Cadena por defecto (por defecto: "base")
  defaultChain: "base",

  // Nodos RPC personalizados (opcional)
  chains: {
    base: { rpcUrl: "https://your-base-rpc.com" },
    ethereum: { rpcUrl: "https://your-eth-rpc.com" },
  },

  // Contraseña maestra (o establecer mediante wallet.setPassword())
  password: process.env.WALLET_PASSWORD,

  // Intervalo de sondeo de saldos (por defecto: 30 segundos)
  pollIntervalMs: 30_000,

  // Callback de notificación de transferencias entrantes
  onBalanceChange: (event) => {
    console.log(`${event.direction}: ${event.difference} ${event.token} on ${event.chain}`);
  },
});
```

---

## Almacenamiento de datos

Todos los datos se almacenan localmente (nunca se envían a la nube):

```
~/.openclaw/wallet/
├── keystore.json    # Clave privada cifrada (Keystore V3, chmod 0600)
├── contacts.json    # Agenda de contactos del agente
├── history.json     # Caché de historial de transacciones
└── policy.json      # Política de seguridad y cola de aprobaciones
```

---

## Cadenas y tokens compatibles

| Cadena | Chain ID | RPC por defecto | Tokens integrados |
|----|----------|----------|----------|
| Base | 8453 | RPC público de Base | USDC, USDT |
| Ethereum | 1 | RPC público de Ethereum | USDC, USDT |

Se puede usar cualquier token ERC-20 proporcionando la dirección del contrato. Las cadenas son extensibles — se puede añadir cualquier cadena compatible con EVM mediante configuración.

---

## Arquitectura

```
src/
├── index.ts          Clase ClawWallet — orquesta todos los subsistemas
├── types.ts          Tipos e interfaces TypeScript compartidos
├── keystore.ts       Generación de claves, cifrado/descifrado (AES-256-GCM + scrypt), firma
├── chain.ts          Adaptador blockchain multi-cadena (viem PublicClient)
├── transfer.ts       Construcción de tx: validación → política → firma → difusión
├── policy.ts         Límites de gasto, lista blanca, cola de aprobación, aritmética de centavos
├── contacts.ts       Libreta de direcciones con resolución multi-cadena
├── history.ts        Historial local de transacciones (con serialización BigInt)
├── monitor.ts        Sondeo de saldos en segundo plano y detección de cambios
├── validation.ts     Sanitización de entrada, E/S segura de archivos, protección contra travesía de rutas
└── tools/            16 definiciones de herramientas OpenClaw
    ├── wallet-create.ts
    ├── wallet-import.ts
    ├── wallet-balance.ts       (saldo + dirección + estimación de Gas)
    ├── wallet-send.ts
    ├── wallet-contacts.ts      (listar + añadir + resolver + eliminar)
    ├── wallet-policy.ts        (consultar + establecer)
    ├── wallet-approval.ts      (listar + aprobar + rechazar)
    └── wallet-history.ts
```

**Filosofía de dependencias:** Minimalista. Solo se usa [viem](https://viem.sh) para la interacción con blockchain. Toda la criptografía utiliza `node:crypto` integrado en Node.js (scrypt, AES-256-GCM, randomBytes) — sin bibliotecas criptográficas de terceros.

---

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar tests
npm test

# Verificación de tipos
npm run typecheck

# Compilar (salida ESM + CJS + .d.ts)
npm run build

# Desarrollo en modo observación
npm run dev
```

### Suite de tests

El proyecto incluye tests exhaustivos de funcionalidad y seguridad:

| Categoría | Contenido de las pruebas |
|------|---------|
| **Almacén de claves** | Generación de claves, cifrado/descifrado, contraseña incorrecta, estructura V3, persistencia |
| **Cadena** | Creación de cliente, caché, Chain ID, codificación calldata ERC-20 |
| **Contactos** | Operaciones CRUD, resolución multi-cadena, búsqueda insensible a mayúsculas, persistencia |
| **Historial** | Gestión de registros, paginación, serialización BigInt |
| **Políticas** | Límites, lista blanca, modo, flujo de aprobación, persistencia |
| **Extremo a extremo** | Ciclo de vida completo desde creación de billetera hasta las 16 herramientas |
| **Seguridad: Almacén** | Entropía de claves, IV/salt aleatorios, detección de manipulación, limpieza de memoria, protección DoS de KDF, resistencia a fuerza bruta (≥100ms de descifrado) |
| **Seguridad: Entrada** | Inyección en dirección/monto/token/contacto, esquema Keystore malicioso |
| **Seguridad: Política** | Ataques de precisión flotante, exactitud de centavos enteros, unicidad de IDs de aprobación, totales diarios concurrentes |
| **Seguridad: Archivos** | Permisos de archivo (0600), protección contra travesía de rutas, escritura atómica |
| **Seguridad: RPC** | Validación de saldos, verificación de rango de Gas, sin filtración de claves en errores |

---

## Requisitos del entorno

- Node.js ≥ 18
- Framework de agentes IA compatible con OpenClaw (o cualquier framework que soporte definiciones de herramientas)

---

## Licencia

MIT
