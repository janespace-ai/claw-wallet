<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <b>Español</b> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

<p align="center">
  <a href="https://github.com/janespace-ai/claw-wallet"><img src="https://img.shields.io/github/stars/janespace-ai/claw-wallet?style=flat-square&logo=github" alt="GitHub Stars"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="Licencia"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/releases"><img src="https://img.shields.io/github/v/release/janespace-ai/claw-wallet?style=flat-square" alt="Lanzamiento"></a>
  <a href="https://github.com/janespace-ai/claw-wallet/commits/main"><img src="https://img.shields.io/github/last-commit/janespace-ai/claw-wallet?style=flat-square" alt="Ultimo Commit"></a>
</p>

<h1 align="center">Claw-Wallet</h1>

<p align="center">
  <b>Permite que tu AI Agent tenga una billetera real, de forma segura.</b><br>
  <i>Una billetera cripto sin custodia con aislamiento total de claves para AI Agents</i>
</p>

> **No eres desarrollador?** Visita **[janespace-ai.github.io](https://janespace-ai.github.io)** para la guia de usuario: instalacion, vinculacion y primeros pasos en minutos.

**Claw-Wallet** es una billetera cripto segura y sin custodia disenada especificamente para AI Agents como OpenClaw, Claude Code, Cursor y otros. Las claves privadas se almacenan en una **Desktop Wallet de Electron** independiente, completamente aislada del modelo de IA. El Agent y la aplicacion de escritorio se comunican a traves de un canal **E2EE (cifrado de extremo a extremo)** mediante un **Go Relay Server** -- el relay solo reenvIa texto cifrado y nunca puede leer ni alterar los mensajes.

> **Promesa de seguridad fundamental**: Las claves privadas nunca tocan el modelo de IA. No estan en la misma maquina, ni en el mismo proceso, ni en memoria. El Agent solo ve direcciones de billetera y hashes de transacciones.

## Caracteristicas principales

| Caracteristica | Descripcion |
|----------------|-------------|
| **Aislamiento total de claves** | Las claves permanecen en la Desktop Wallet; el Agent solo ve direcciones y hashes |
| **Soporte multi-cadena** | Ethereum, Base, Arbitrum, Optimism, Polygon, Linea, BSC, Sei |
| **Nativo para AI Agents** | Herramientas integradas para OpenClaw, Claude Code, Cursor, Codex, etc. |
| **Comunicacion E2EE** | Cifrado X25519 + AES-256-GCM; el relay solo ve texto cifrado |
| **Reconexion automatica** | Vincula una vez, reconecta automaticamente despues de reinicios |
| **Motor de politicas** | Limites por transaccion y diarios, listas blancas de direcciones, colas de aprobacion |
| **Desktop + CLI** | Aplicacion de escritorio Electron para gestion de claves + herramientas CLI para Agents |
| **Codigo abierto** | Licencia MIT -- inspecciona, modifica y contribuye |

## Comienza en 4 pasos

**Paso 1 -- Instala la Desktop Wallet**

Descarga la ultima version y abre la aplicacion. Crea una billetera, establece una contrasena y respalda tu frase mnemonica.

| Plataforma | Descarga |
|------------|----------|
| macOS (Apple Silicon) | [**Claw.Wallet-0.1.0-arm64.dmg**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet-0.1.0-arm64.dmg) |
| Windows | [**Claw.Wallet.Setup.0.1.0.exe**](https://github.com/janespace-ai/claw-wallet/releases/download/v0.1.0/Claw.Wallet.Setup.0.1.0.exe) |

> Todas las versiones: [github.com/janespace-ai/claw-wallet/releases](https://github.com/janespace-ai/claw-wallet/releases)

<img src="screenshots/welcome-dark.png" width="320" alt="Pantalla de bienvenida" />

**Paso 2 -- Conecta tu Agent**

**Usas OpenClaw?** Dile a OpenClaw directamente en el chat:

```
openclaw plugins install @janespace-ai/claw-wallet
```

**Usas Claude Code, Cline, Cursor u otro agent?** Pega esto en el chat de tu agent:

```
Install Claw Wallet: https://github.com/janespace-ai/claw-wallet
```

O instala por CLI:

```bash
npx skills add janespace-ai/claw-wallet
```

**Paso 3 -- Genera un codigo de vinculacion**

En la aplicacion de escritorio, haz clic en **"Generate Pairing Code"** y copia el codigo de 8 caracteres.

<img src="screenshots/pair-code-dark.png" width="320" alt="Pantalla de codigo de vinculacion" />

**Paso 4 -- Comienza a usar**

Pega el codigo de vinculacion en tu agent una sola vez. Despues de eso, el agent y la aplicacion de escritorio se reconectan automaticamente -- sin accion del usuario.

<img src="screenshots/tx-approval-dark.png" width="320" alt="Pantalla de aprobacion de transaccion" />

```
Tu:    "Envia 10 USDC a Bob en Base"
Agent: → resuelve contacto → construye tx → E2EE → Desktop firma → transmite
       "Enviados 10 USDC a Bob. tx: 0xab3f..."
```

---

## Arquitectura

```
┌──────────────┐        E2EE WebSocket        ┌──────────────┐        E2EE WebSocket        ┌──────────────────┐
│  AI Agent    │◄────────────────────────────►│  Go Relay    │◄────────────────────────────►│  Desktop Wallet  │
│  (TypeScript)│   X25519 + AES-256-GCM       │  Server      │   X25519 + AES-256-GCM       │  (Electron)      │
│              │                               │  (Hertz)     │                               │                  │
│ Cero secretos│                               │ Stateless    │                               │ Guarda claves    │
│ Tool APIs    │                               │ WS forwarder │                               │ Firma localmente │
│ JSON-RPC IPC │                               │ IP binding   │                               │ Monitor seguridad│
│ 17 tools     │                               │ Rate limiter │                               │ Lock manager     │
└──────────────┘                               └──────────────┘                               └──────────────────┘
       │                                                                                              │
       │  El Agent nunca ve:                                                    Desktop guarda:       │
       │  • claves privadas                                                    • Mnemonica BIP-39     │
       │  • mnemonicas                                                         • Archivo Keystore V3  │
       │  • material criptografico                                             • Motor de firma       │
       └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Diseno de tres componentes**: Cada componente tiene una unica responsabilidad. Incluso si el host del Agent se ve completamente comprometido, el atacante no obtiene ningun material criptografico.

---

## Flujo de interaccion del usuario

### Configuracion inicial: Vinculacion

Solo se requiere una vez. Despues de la vinculacion inicial, la reconexion es completamente automatica.

```
 Tu                           Desktop Wallet                 Relay Server              AI Agent
──────────────────────────────────────────────────────────────────────────────────────────────────
 1. Crear billetera
    (establecer contrasena,   Genera mnemonica BIP-39
     respaldar mnemonica)     Cifra con AES-256-GCM
                              + scrypt KDF
                                    │
 2. Clic en "Generate         Genera codigo de vinculacion
    Pairing Code"             de 8 caracteres (valido 10 min)
                                    │
 3. Copiar codigo al Agent          │                                              Agent llama
    (o enviar por canal             │                                              wallet_pair
    seguro)                         │                                              { shortCode }
                                    │                         ◄──── Agent se registra ────┘
                                    │                               con el codigo
                              Desktop se conecta ──────────►  Relay empareja
                              Intercambio de claves X25519 ◄─► Sesion E2EE establecida
                                    │
                              Guarda par de claves de         Agent guarda par de claves
                              comunicacion persistente        de comunicacion persistente
                              (cifrado)                       (0600)
                                    │
                              Deriva pairId determinista      Deriva el mismo pairId
                              = SHA256(addr +                 = SHA256(addr +
                              agentPubKey)[:16]               agentPubKey)[:16]
                                    │
 Vinculado!                   Listo para firmar               Listo para transaccionar
```

### Uso diario: Reconexion automatica

Despues de la vinculacion inicial, el Agent y la Desktop se reconectan automaticamente al reiniciar -- sin accion del usuario.

```
 Agent se reinicia            Desktop se reinicia
       │                             │
 Carga par de claves de       Carga par de claves de
 comunicacion persistente     comunicacion persistente
 desde disco                  (descifra con contrasena
                              de billetera)
       │                             │
 Recalcula pairId             Recalcula el mismo pairId
       │                             │
 Se conecta al Relay ────────► Relay enruta por pairId ──────► Desktop recibe
       │                                                             │
 Envia handshake extendido:                                   Verificacion de tres niveles:
 • publicKey                                                  Nivel 1: La clave publica coincide
 • machineId                                                  Nivel 2: El machineId coincide
 • reconnect: true                                            Nivel 3: Politica de cambio de IP
       │                                                             │
 Sesion E2EE restaurada ◄──────────────────────────────────── Sesion activa
       │                                                             │
 Listo para transaccionar                                     Listo para firmar
```

### Flujo de transacciones

```
 Tu (chat con Agent)                 AI Agent                        Desktop Wallet
──────────────────────────────────────────────────────────────────────────────────────
 "Envia 0.5 ETH a Bob          wallet_send
  en Base"                        to: "bob"  (contacto)
                                  amount: 0.5
                                  chain: base
                                       │
                                Resolver contacto ──► Bob = 0x742d...
                                Construir solicitud tx
                                       │
                                Cifrar E2EE ─────────────────► Descifrar solicitud
                                                                      │
                                                                Verificacion de politicas:
                                                                  Dentro del limite por tx
                                                                  Dentro del limite diario
                                                                  Dispositivo no congelado
                                                                      │
                                                                Descifrar clave privada
                                                                Firmar transaccion
                                                                Borrar clave de memoria
                                                                Transmitir a la cadena
                                                                      │
                                Recibir resultado ◄────────────────── hash tx + recibo
                                       │
                                Devolver al usuario:
                                "Enviados 0.5 ETH a Bob
                                 tx: 0xab3f..."
```

---

## Arquitectura de seguridad

claw-wallet utiliza **defensa en profundidad** con dos dominios de seguridad independientes: **seguridad de comunicacion** (como se comunican los componentes) y **seguridad de claves** (como se almacenan y usan las claves).

### Parte A: Seguridad de comunicacion

#### 1. Cifrado de extremo a extremo (E2EE)

Todos los mensajes entre el Agent y la Desktop estan cifrados de extremo a extremo. El servidor Relay solo ve texto cifrado.

| Componente | Detalle |
|------------|---------|
| **Intercambio de claves** | X25519 ECDH (Curve25519) |
| **Derivacion de claves** | HKDF-SHA256 |
| **Cifrado** | AES-256-GCM (autenticado) |
| **Anti-replay** | Nonce incremental por mensaje |
| **Forward Secrecy** | Nuevas claves efimeras por sesion |

#### 2. Vinculacion automatica y reconexion

La vinculacion manual solo se necesita una vez. El sistema utiliza **pares de claves de comunicacion persistentes** y **IDs de par deterministicos** para la reconexion automatica:

- **Pares de claves persistentes**: Los pares de claves X25519 se guardan en disco -- cifrados con la contrasena de la billetera en Desktop (scrypt + AES-256-GCM), protegidos por permisos de archivo (0600) en el Agent
- **PairId deterministico**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` -- ambos lados calculan el mismo ID de forma independiente, sin necesidad de coordinacion
- **Reconexion sin interaccion**: Al reiniciar, ambos lados cargan sus claves almacenadas, recalculan el pairId y se reconectan a traves del Relay automaticamente

#### 3. Verificacion de reconexion en tres niveles

Cuando un Agent se reconecta, la Desktop realiza tres verificaciones de identidad antes de permitir cualquier firma:

| Nivel | Verificacion | Accion ante falla |
|-------|-------------|-------------------|
| **Nivel 1** (Estricto) | La clave publica coincide con la almacenada | Rechazar + forzar re-vinculacion |
| **Nivel 2** (Estricto) | El machineId coincide con el almacenado | Congelar sesion + forzar re-vinculacion |
| **Nivel 3** (Configurable) | Politica de cambio de direccion IP | `block` / `warn` (predeterminado) / `allow` |

- **machineId**: SHA256(hostname + MAC address) -- detecta si el Agent se movio a otra maquina
- **Congelamiento de sesion**: Cuando se detecta una discrepancia de identidad, todas las solicitudes de firma se bloquean hasta que el usuario re-vincula manualmente
- **Politica de IP**: Configurable por despliegue -- `block` rechaza inmediatamente, `warn` alerta al usuario pero permite (con tolerancia de misma subred), `allow` omite la verificacion

#### 4. Proteccion del lado del Relay

El Go Relay Server aplica seguridad adicional aunque no puede leer el contenido de los mensajes:

| Proteccion | Detalle |
|------------|---------|
| **Vinculacion de IP por pairId** | Maximo 2 IPs de origen distintas por par simultaneamente |
| **Limite de velocidad de conexion** | Maximo 10 nuevas conexiones WebSocket por pairId por minuto |
| **Desconexion de conexiones** | Si un tercer cliente se conecta a un par, el mas antiguo es desconectado |
| **Registro de metadatos** | Eventos de conexion registrados con pairId truncado para auditoria |

#### 5. Re-vinculacion manual como respaldo

Cuando la reconexion automatica falla (cambio de dispositivo, corrupcion de claves, etc.):

- **Lado del Agent**: El metodo RPC `wallet_repair` borra los datos de vinculacion almacenados y restablece el estado
- **Lado de Desktop**: Accion "Re-pair Device" en el panel de seguridad
- Ambos lados generan pares de claves nuevos, requiriendo un nuevo intercambio de codigo de vinculacion

### Parte B: Seguridad de claves

#### 6. Aislamiento de claves -- Las claves nunca tocan el modelo de IA

```
┌────────────────────┐     Tool APIs     ┌────────────────────┐
│     AI Agent       │ ◄──────────────── │  Desktop Wallet    │
│                    │  direcciones,      │                    │
│  SIN acceso a:     │  hashes            │  La clave privada  │
│  - claves privadas │                   │  solo se descifra  │
│  - archivo keystore│                   │  dentro de         │
│  - contrasena      │                   │  signTransaction() │
│                    │                   │  y luego se borra  │
└────────────────────┘                   └────────────────────┘
```

El Agent interactua exclusivamente a traves de Tool APIs. Ninguna herramienta devuelve material criptografico.

#### 7. Cifrado en reposo -- Keystore V3

| Componente | Detalle |
|------------|---------|
| **Cifrado** | AES-256-GCM (cifrado autenticado) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes aleatorios por cifrado |
| **IV** | 16 bytes aleatorios por cifrado |
| **Auth Tag** | La etiqueta GCM previene la manipulacion del texto cifrado |
| **Permisos de archivo** | 0600 (solo lectura/escritura del propietario) |

#### 8. Seguridad de memoria

- Las claves privadas solo se descifran durante `signTransaction()` / `signMessage()`
- Los buffers de claves se borran con `Buffer.fill(0)` en bloques `finally` -- incluso si la firma falla
- El material criptografico descifrado existe en memoria por milisegundos, no segundos

#### 9. Motor de politicas -- Controles de gasto independientes

El motor de politicas se ejecuta **antes** de cualquier firma y no puede ser evadido mediante inyeccion de prompts:

| Control | Predeterminado | Descripcion |
|---------|---------------|-------------|
| Limite por transaccion | $100 | Monto maximo por transaccion individual |
| Limite diario | $500 | Tope de gasto acumulativo en 24h |
| Lista blanca de direcciones | Vacia | Requerida en modo supervisado |
| Modo de operacion | Supervisado | `supervised` (lista blanca requerida) o `autonomous` (solo limites) |
| Cola de aprobacion | Expiracion 24h | Las transacciones bloqueadas se encolan para revision manual |

**Medidas anti-evasion:**
- Aritmetica de centavos enteros para prevenir ataques de precision de punto flotante
- Coincidencia de lista blanca sin distincion de mayusculas/minusculas
- IDs de aprobacion criptograficamente aleatorios (no secuenciales, no predecibles)

#### 10. Validacion de entradas

| Entrada | Validacion |
|---------|-----------|
| Direccion | Formato hexadecimal, longitud=42, checksum EIP-55 via viem |
| Monto | Rechaza NaN, Infinity, negativos, cero, vacio |
| Cadena | Lista blanca estricta (`ethereum`, `base`, `linea`, `arbitrum`, `bsc`, `optimism`, `polygon`, `sei`) |
| Simbolo de token | Maximo 20 caracteres, rechaza caracteres de inyeccion |
| Nombre de contacto | Maximo 100 caracteres, rechaza path traversal |

#### 11. Seguridad del sistema de archivos y RPC

- **Escrituras atomicas**: escribir en archivo temporal -> renombrar (previene corrupcion ante fallos)
- **Permisos 0600**: solo el propietario puede leer/escribir archivos sensibles
- **Prevencion de path traversal**: `sanitizePath()` rechaza rutas fuera del directorio de datos
- **Verificaciones de gas**: rechaza estimaciones de 0 gas y > 30M gas
- **Sin filtracion de claves**: los mensajes de error nunca contienen claves privadas ni contrasenas

---

## Funcionalidades

- **Sin custodia y aislado** -- Las claves en Desktop, el Agent no tiene secretos
- **Cifrado de extremo a extremo** -- X25519 + AES-256-GCM, el Relay solo ve texto cifrado
- **Vinculacion automatica** -- Configuracion unica, reconexion automatica despues de reinicios
- **Verificacion de tres niveles** -- Clave publica + huella de dispositivo + politica de IP en cada reconexion
- **Cifrado Keystore V3** -- AES-256-GCM + scrypt KDF para claves en reposo
- **Motor de politicas** -- Limites de gasto por transaccion y diarios, lista blanca de direcciones, cola de aprobacion
- **8 cadenas EVM** -- Ethereum, Base, Linea, Arbitrum, BNB Chain, Optimism, Polygon, Sei; extensible a cualquier cadena EVM
- **Recuperacion de subcuentas** -- Escaneo y recuperacion de cuentas derivadas (BIP-44 m/44'/60'/0'/0/{n}) al restaurar la billetera
- **Modo de operacion dual** -- Supervisado (aprobacion humana) o Autonomo (dentro de limites)
- **Contactos del Agent** -- Libreta de direcciones P2P con resolucion de nombres
- **Monitoreo de saldos** -- Sondeo en segundo plano para transferencias entrantes
- **Historial de transacciones** -- Cache local con registros completos
- **Relay en contenedor** -- Go Relay Server con soporte Docker (framework Hertz)
- **17 herramientas de billetera** -- Publicadas en npm como [`@janespace-ai/claw-wallet`](https://www.npmjs.com/package/@janespace-ai/claw-wallet), instalables via `npm install @janespace-ai/claw-wallet` o `npx skills add janespace-ai/claw-wallet`
- **Internacionalizacion (i18n)** -- La aplicacion de escritorio soporta ingles y chino simplificado con cambio de idioma en tiempo real

---

## Inicio rapido

### Requisitos previos

- Node.js >= 18
- Go >= 1.21 (para el Relay Server)
- Un framework de AI Agent compatible con OpenClaw

### 1. Iniciar el Relay Server

```bash
cd server
go run cmd/relay/main.go
# Predeterminado: :8765
```

O con Docker:

```bash
cd server
docker compose up -d
```

### 2. Iniciar la Desktop Wallet

```bash
cd desktop
npm install
npm run dev
```

### 3. Crear una billetera y vincular

1. En la aplicacion Desktop: establecer contrasena -> respaldar mnemonica
2. Clic en "Generate Pairing Code" -> copiar el codigo de 8 caracteres
3. En tu Agent, ejecutar `wallet_pair({ shortCode: "ABCD1234" })`
4. Listo -- sesion E2EE establecida, reconexion automatica habilitada

### 4. Usar con tu Agent

17 herramientas disponibles. Ejemplo de conversacion:

```
Tu:    "Envia 10 USDC a Bob en Base"
Agent: wallet_contacts_resolve("bob") → 0x742d...
       wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
       → Politica OK → E2EE → Desktop firma → Transmite
       "Enviados 10 USDC a Bob. tx: 0xab3f..."
```

---

## Herramientas disponibles

| Herramienta | Descripcion |
|-------------|-------------|
| **Gestion de billetera** | |
| `wallet_create` | Crear una nueva billetera con keystore cifrado |
| `wallet_import` | Importar billetera existente mediante clave privada |
| `wallet_address` | Obtener la direccion actual de la billetera |
| `wallet_pair` | Vincular con la Desktop Wallet mediante codigo corto |
| **Saldo y gas** | |
| `wallet_balance` | Consultar saldo de ETH o tokens ERC-20 |
| `wallet_estimate_gas` | Estimar costo de gas antes de enviar |
| **Transacciones** | |
| `wallet_send` | Enviar ETH o tokens ERC-20 (soporta nombres de contactos) |
| `wallet_history` | Consultar historial de transacciones paginado |
| **Contactos** | |
| `wallet_contacts_add` | Agregar o actualizar un contacto con direcciones multi-cadena |
| `wallet_contacts_list` | Listar todos los contactos guardados |
| `wallet_contacts_resolve` | Buscar la direccion de un contacto por nombre |
| `wallet_contacts_remove` | Eliminar un contacto |
| **Politicas y aprobaciones** | |
| `wallet_policy_get` | Ver la politica de seguridad actual |
| `wallet_policy_set` | Actualizar limites de gasto, lista blanca o modo |
| `wallet_approval_list` | Listar aprobaciones de transacciones pendientes |
| `wallet_approval_approve` | Aprobar una transaccion en cola |
| `wallet_approval_reject` | Rechazar una transaccion en cola |

---

## Estructura del proyecto

```
wallet/
├── agent/                 # Framework del AI Agent (TypeScript) — cero secretos
│   ├── index.ts           # Clase ClawWallet — orquesta tools y signer
│   ├── e2ee/              # Cripto E2EE, transporte WebSocket, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, serializacion de claves
│   │   ├── transport.ts   # Cliente WebSocket E2EE con handshake extendido
│   │   └── machine-id.ts  # Huella de dispositivo (SHA256 de hostname:MAC)
│   ├── signer/            # RelaySigner — vinculacion persistente, auto-reconexion
│   │   ├── relay-client.ts    # Conexion Relay, pairId deterministico, reparacion
│   │   ├── ipc-server.ts     # Servidor IPC de socket de dominio Unix
│   │   └── ipc-client.ts     # Cliente IPC para comunicacion tool → signer
│   ├── tools/             # 17 definiciones de herramientas de billetera
│   └── *.ts               # Politicas, contactos, historial, monitor, validacion
│
├── desktop/               # Desktop Wallet Electron — guarda todos los secretos
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # Mnemonica BIP-39, cifrado/descifrado Keystore V3
│       │   ├── signing-engine.ts   # Firma de transacciones con borrado de memoria
│       │   ├── signing-history.ts  # Historial de actividad respaldado por SQLite
│       │   ├── tx-sync-service.ts  # Sincronizacion de estado de transacciones blockchain
│       │   ├── chain-adapter.ts    # Cliente RPC para recibos de transacciones
│       │   ├── database-service.ts # Conexion SQLite y migraciones de esquema
│       │   ├── price-service.ts    # Obtencion de precios multi-nivel (Gate.com, CoinGecko)
│       │   ├── balance-service.ts  # Agregacion de saldos de tokens entre cadenas
│       │   ├── relay-bridge.ts     # Relay E2EE, verificacion de tres niveles, congelamiento de sesion
│       │   ├── security-monitor.ts # Deteccion de cambios de IP/dispositivo, alertas
│       │   └── lock-manager.ts     # Bloqueo/desbloqueo de billetera, timeout por inactividad
│       ├── preload/                # contextBridge seguro (sin nodeIntegration)
│       ├── renderer/               # UI HTML/CSS/JS (pestana de actividad, visualizacion de saldo)
│       └── shared/
│           └── e2ee-crypto.ts      # Primitivas E2EE compartidas
│
└── server/                # Go Relay Server (Hertz) — reenviador sin estado
    ├── cmd/relay/main.go  # Punto de entrada, configuracion de rutas
    ├── internal/
    │   ├── hub/           # Hub WebSocket, vinculacion de IP, limitacion de velocidad
    │   ├── pairing/       # Generacion y resolucion de codigos cortos
    │   ├── middleware/     # CORS, registro de acceso
    │   └── iputil/        # Utilidades de extraccion de IP
    ├── Dockerfile         # Compilacion multi-etapa
    └── docker-compose.yml # Despliegue con un solo comando
```

---

## Cadenas y tokens soportados

| Cadena | Chain ID | Tokens integrados |
|--------|----------|-------------------|
| Ethereum | 1 | USDC, USDT |
| Base | 8453 | USDC, USDT |
| Linea | 59144 | USDC, USDT |
| Arbitrum | 42161 | USDC, USDT |
| BNB Chain | 56 | USDC, USDT |
| Optimism | 10 | USDC, USDT |
| Polygon | 137 | USDC, USDT |
| Sei EVM | 1329 | USDC |

Cualquier token ERC-20 puede utilizarse pasando su direccion de contrato. Las cadenas son extensibles -- agrega cualquier cadena compatible con EVM mediante configuracion.

### Configuracion de red Web3

Tanto el Agent como la Desktop soportan configuracion personalizada de endpoints RPC para produccion y desarrollo local.

#### Configuracion de produccion

Crea `config.json` con tus proveedores RPC preferidos:

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

#### Desarrollo local

Usa Hardhat o Anvil para pruebas locales en blockchain:

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

Inicia nodos locales:

```bash
# Simulacion de Ethereum (Chain ID: 1)
npx hardhat node --chain-id 1 --port 8545

# Simulacion de Base (Chain ID: 8453)
npx hardhat node --chain-id 8453 --port 8546
```

Consulta [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md) para la guia completa de configuracion.

#### Comportamiento predeterminado

Si no se proporciona la configuracion de `chains`, el sistema utiliza los endpoints RPC publicos integrados de viem.

---

## Desarrollo

```bash
# Agent (TypeScript)
cd agent && npm install && npm test

# Desktop (Electron)
cd desktop && npm install && npm run dev

# Relay Server (Go)
cd server && go test ./...

# Despliegue con Docker
cd server && docker compose up --build
```

### Suite de pruebas

| Categoria | Que se prueba |
|-----------|---------------|
| **Keystore** | Generacion de claves, cifrado/descifrado, contrasena incorrecta, estructura V3 |
| **Politicas** | Limites, lista blanca, modos, flujo de aprobacion, aritmetica de centavos enteros |
| **E2EE** | Serializacion de pares de claves, derivacion determinista de pairId |
| **Relay Hub** | Enrutamiento WebSocket, vinculacion IP de par, limitacion de velocidad de conexion |
| **Vinculacion** | Generacion de codigo corto, expiracion, resolucion |
| **Middleware** | Configuracion CORS, registro de acceso |
| **Seguridad** | Entropia de claves, borrado de memoria, inyeccion de entrada, permisos de archivo, path traversal, seguridad RPC |

---

## Solucion de problemas

| Problema | Solucion |
|----------|----------|
| "Wallet app offline" | Asegurate de que la Desktop Wallet este en ejecucion y conectada al Relay |
| "Pairing code expired" | Genera un nuevo codigo (TTL de 10 min) |
| Solicitudes de firma bloqueadas | Verifica si la sesion esta congelada (discrepancia de identidad) -- re-vincula si es necesario |
| Alerta de cambio de IP | Configura la politica de IP: `block` / `warn` / `allow` |
| El Agent no puede reconectarse | Usa `wallet_repair` para borrar datos de vinculacion y re-vincular |
| Advertencia de misma maquina | Mueve la Desktop Wallet a un dispositivo separado para seguridad completa |

---

## Internacionalizacion (i18n)

La aplicacion Desktop soporta multiples idiomas con cambio de idioma en tiempo real:

### Idiomas soportados

- **English (en)** -- Idioma predeterminado
- **Simplified Chinese (zh-CN)** -- Chino simplificado

### Funcionalidades

- **Deteccion automatica**: Detecta automaticamente el idioma del sistema en el primer inicio
- **Cambio manual**: Selector de idioma en el encabezado (esquina superior derecha)
- **Persistencia**: La preferencia del usuario se guarda en localStorage entre sesiones
- **Actualizaciones en tiempo real**: Los elementos estaticos de la UI (botones, etiquetas, pestanas) se actualizan inmediatamente
- **Experiencia fluida**: No se requiere reiniciar la aplicacion para cambiar de idioma

### Arquitectura

```
i18next Framework
├── Archivos de traduccion (desktop/locales/)
│   ├── en/
│   │   ├── common.json      # Botones, etiquetas, mensajes
│   │   ├── setup.json       # Flujo de configuracion de billetera
│   │   ├── activity.json    # Actividad de transacciones
│   │   ├── security.json    # Eventos de seguridad
│   │   ├── settings.json    # Panel de configuracion
│   │   ├── pairing.json     # Vinculacion de dispositivo
│   │   ├── errors.json      # Mensajes de error
│   │   ├── modals.json      # Dialogos de aprobacion, exportacion, alerta
│   │   └── contactsPage.json
│   └── zh-CN/ (misma estructura; mantener claves sincronizadas con en)
│   Nota: `npm run build` copia estos archivos a dist/renderer/locales/ para Electron.
├── Deteccion de idioma (i18n.js)
│   ├── 1. Verificar localStorage (preferencia del usuario)
│   ├── 2. Verificar navigator.language (sistema)
│   └── 3. Respaldo a ingles
└── Sistema de actualizacion del DOM
    ├── Atributos data-i18n para contenido estatico
    └── i18next.t() para contenido dinamico
```

### Agregar un nuevo idioma

1. Crear directorio de traduccion:
   ```bash
   mkdir -p desktop/locales/<lang-code>
   ```

2. Copiar y traducir todos los archivos JSON de `en/`:
   ```bash
   cp desktop/locales/en/*.json desktop/locales/<lang-code>/
   # Editar cada archivo para traducir los valores
   ```

3. Agregar opcion de idioma al selector en `index.html`:
   ```html
   <select id="language-selector">
     <option value="en">English</option>
     <option value="zh-CN">简体中文</option>
     <option value="<lang-code>">Tu Idioma</option>
   </select>
   ```

4. Actualizar la lista de namespaces en `i18n.js` si es necesario

### Convenciones de claves de traduccion

Usar nomenclatura jerarquica y semantica:

```
namespace.feature.element

Ejemplos:
- common.buttons.save
- setup.password.placeholder
- errors.wallet.createFailed
- activity.filters.pending
```

### Para desarrolladores

**HTML (contenido estatico)**:
```html
<button data-i18n="common.buttons.save">Save</button>
<input data-i18n-placeholder="setup.password.placeholder" />
```

**JavaScript (contenido dinamico)**:
```javascript
alert(i18next.t('errors.password.mismatch'));
document.title = i18next.t('common.labels.wallet');
```

**Con interpolacion**:
```javascript
const msg = i18next.t('common.contacts.removeConfirm', { name: 'Bob' });
// Traduccion: "Eliminar todas las entradas del contacto \"{name}\"?"
```

---

## Contribuir

Damos la bienvenida a contribuciones. Asi puedes ayudar:

### Reportar problemas
- **Reportes de errores**: Usa la pagina de [GitHub Issues](https://github.com/janespace-ai/claw-wallet/issues)
- **Solicitudes de funcionalidades**: Sugiere nuevas funcionalidades o mejoras
- **Vulnerabilidades de seguridad**: Reporta de forma privada por correo electronico (consulta el perfil de GitHub)

### Enviar Pull Requests
1. **Fork** del repositorio
2. **Crear una rama**: `git checkout -b feature/tu-funcionalidad`
3. **Confirmar cambios**: `git commit -m 'Agregar alguna funcionalidad'`
4. **Push**: `git push origin feature/tu-funcionalidad`
5. **Abrir un Pull Request**

### Configuracion de desarrollo
```bash
# Clonar el repositorio
git clone https://github.com/janespace-ai/claw-wallet.git
cd claw-wallet

# Instalar dependencias
npm install

# Compilar el proyecto
npm run build

# Ejecutar pruebas
npm test
```

### Areas donde se necesita ayuda
- **Documentacion**: Mejorar guias, agregar tutoriales, traducir a mas idiomas
- **Nuevas cadenas**: Agregar soporte para cadenas EVM o no-EVM adicionales
- **Mejoras de UI/UX**: Mejorar la interfaz de la Desktop Wallet
- **Pruebas**: Escribir pruebas unitarias/de integracion, mejorar la cobertura de pruebas

### Estilo de codigo
- Usar **TypeScript** con verificacion de tipos estricta
- Seguir el formato de **Prettier** (configurado en `.prettierrc`)
- Escribir mensajes de commit significativos
- Agregar pruebas para nueva funcionalidad

### Unete a la comunidad
- **Discord**: [Unete a nuestro servidor](https://discord.gg/clawd) (proximamente)
- **Twitter**: Sigue a [@janespace_ai](https://twitter.com/janespace_ai) para novedades
- **GitHub Discussions**: Inicia una discusion para preguntas o ideas

---

## Licencia

MIT (c) [janespace-ai](https://github.com/janespace-ai)
