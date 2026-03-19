<p align="center">
  <a href="../README.md">English</a> | <a href="README.zh-CN.md">简体中文</a> | <a href="README.zh-TW.md">繁體中文</a> | <a href="README.ja.md">日本語</a> | <a href="README.ko.md">한국어</a> | <b>Español</b> | <a href="README.fr.md">Français</a> | <a href="README.de.md">Deutsch</a> | <a href="README.pt.md">Português</a>
</p>

# claw-wallet

**Deja que tu Agente de IA tenga una billetera real — de forma segura.**

Una billetera cripto sin custodia para Agentes de IA de [OpenClaw](https://getclaw.sh). Las claves privadas residen en una **Billetera de Escritorio Electron** separada, completamente aislada del modelo de IA. El Agente y el Escritorio se comunican a través de un canal **E2EE (Cifrado de Extremo a Extremo)** mediante un **Servidor Relay en Go** — el relay solo reenvía texto cifrado y nunca puede leer ni manipular los mensajes.

> Las claves privadas nunca tocan el modelo de IA. No en la misma máquina, no en el mismo proceso, no en memoria. El Agente solo ve direcciones de billetera y hashes de transacciones.

---

## Arquitectura

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

**Diseño de tres componentes**: Cada componente tiene una única responsabilidad. Incluso si el host del Agente es completamente comprometido, el atacante no obtiene ningún material de claves.

---

## Flujo de Interacción del Usuario

### Primera Configuración: Emparejamiento

Solo se requiere una vez. Después del emparejamiento inicial, la reconexión es completamente automática.

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

### Uso Diario: Reconexión Automática

Después del emparejamiento inicial, el Agente y el Escritorio se reconectan automáticamente al reiniciar — no se requiere ninguna acción del usuario.

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

### Flujo de Transacciones

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

## Arquitectura de Seguridad

claw-wallet utiliza **defensa en profundidad** con dos dominios de seguridad independientes: **seguridad de comunicación** (cómo se comunican los componentes) y **seguridad de claves** (cómo se almacenan y utilizan las claves).

### Parte A: Seguridad de Comunicación

#### 1. Cifrado de Extremo a Extremo (E2EE)

Todos los mensajes entre el Agente y el Escritorio están cifrados de extremo a extremo. El servidor Relay solo ve texto cifrado.

| Componente | Detalle |
|-----------|--------|
| **Intercambio de Claves** | X25519 ECDH (Curve25519) |
| **Derivación de Claves** | HKDF-SHA256 |
| **Cifrado** | AES-256-GCM (autenticado) |
| **Anti-Repetición** | Nonce incremental por mensaje |
| **Secreto Futuro** | Nuevas claves efímeras por sesión |

#### 2. Emparejamiento y Reconexión Automáticos

El emparejamiento manual solo es necesario una vez. El sistema utiliza **pares de claves de comunicación persistentes** e **IDs de par determinísticos** para la reconexión automática:

- **Pares de Claves Persistentes**: Los pares de claves X25519 se guardan en disco — cifrados con la contraseña de la billetera en el Escritorio (scrypt + AES-256-GCM), protegidos por permisos de archivo (0600) en el Agente
- **PairId Determinístico**: `SHA256(walletAddress + ":" + agentPublicKeyHex)[:16]` — ambos lados calculan el mismo ID de forma independiente, sin necesidad de coordinación
- **Reconexión sin Interacción**: Al reiniciar, ambos lados cargan sus claves almacenadas, recalculan el pairId y se reconectan a través del Relay automáticamente

#### 3. Verificación de Reconexión en Tres Niveles

Cuando un Agente se reconecta, el Escritorio realiza tres verificaciones de identidad antes de permitir cualquier firma:

| Nivel | Verificación | Acción ante Fallo |
|-------|-------|----------------|
| **Nivel 1** (Estricto) | La clave pública coincide con la almacenada | Rechazar + forzar re-emparejamiento |
| **Nivel 2** (Estricto) | machineId coincide con el ID almacenado | Congelar sesión + forzar re-emparejamiento |
| **Nivel 3** (Configurable) | Política de cambio de IP | `block` / `warn` (por defecto) / `allow` |

- **machineId**: SHA256(hostname + dirección MAC) — detecta si el Agente se movió a una máquina diferente
- **Congelación de Sesión**: Cuando se detecta una discrepancia de identidad, todas las solicitudes de firma se bloquean hasta que el usuario vuelva a emparejar manualmente
- **Política de IP**: Configurable por despliegue — `block` rechaza inmediatamente, `warn` alerta al usuario pero permite (con tolerancia de misma subred), `allow` omite la verificación

#### 4. Protección del Lado del Relay

El Servidor Relay en Go aplica seguridad adicional aunque no pueda leer el contenido de los mensajes:

| Protección | Detalle |
|------------|--------|
| **Vinculación de IP por pairId** | Máximo 2 IPs de origen distintas por par simultáneamente |
| **Límite de Tasa de Conexión** | Máximo 10 nuevas conexiones WebSocket por pairId por minuto |
| **Desalojo de Conexiones** | Si un tercer cliente se conecta a un par, el más antiguo es desalojado |
| **Registro de Metadatos** | Eventos de conexión registrados con pairId truncado para auditoría |

#### 5. Respaldo de Re-Emparejamiento Manual

Cuando la reconexión automática falla (cambio de dispositivo, corrupción de claves, etc.):

- **Lado del Agente**: El método RPC `wallet_repair` limpia los datos de emparejamiento almacenados y restablece el estado
- **Lado del Escritorio**: Acción de UI "Re-emparejar Dispositivo" en el panel de seguridad
- Ambos lados generan pares de claves nuevos, requiriendo un nuevo intercambio de código de emparejamiento

### Parte B: Seguridad de Claves

#### 6. Aislamiento de Claves — Las Claves Nunca Tocan el Modelo de IA

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

El Agente interactúa exclusivamente a través de las APIs de herramientas. Ninguna herramienta devuelve material de claves.

#### 7. Cifrado en Reposo — Keystore V3

| Componente | Detalle |
|-----------|--------|
| **Cifrado** | AES-256-GCM (cifrado autenticado) |
| **KDF** | scrypt (N=131072, r=8, p=1) |
| **Salt** | 32 bytes aleatorios por cifrado |
| **IV** | 16 bytes aleatorios por cifrado |
| **Etiqueta de Autenticación** | La etiqueta GCM previene la manipulación del texto cifrado |
| **Permisos de Archivo** | 0600 (solo lectura/escritura del propietario) |

#### 8. Seguridad en Memoria

- Las claves privadas solo se descifran durante `signTransaction()` / `signMessage()`
- Los buffers de claves se llenan con ceros usando `Buffer.fill(0)` en bloques `finally` — incluso si la firma lanza un error
- El material de claves descifrado existe en memoria durante milisegundos, no segundos

#### 9. Motor de Políticas — Controles de Gasto Independientes

El motor de políticas se ejecuta **antes** de cualquier firma y no puede ser eludido mediante inyección de prompts:

| Control | Predeterminado | Descripción |
|---------|---------|-------------|
| Límite por transacción | $100 | Monto máximo por transacción individual |
| Límite diario | $500 | Tope de gasto acumulado en 24h rodantes |
| Lista blanca de direcciones | Vacía | Requerida en modo supervisado |
| Modo de operación | Supervisado | `supervised` (lista blanca requerida) o `autonomous` (solo límites) |
| Cola de aprobación | Expira en 24h | Las transacciones bloqueadas se encolan para revisión manual |

**Medidas anti-elusión:**
- Aritmética de centavos enteros para prevenir ataques de precisión de punto flotante
- Coincidencia de lista blanca sin distinción de mayúsculas/minúsculas
- IDs de aprobación criptográficamente aleatorios (no secuenciales, no adivinables)

#### 10. Validación de Entrada

| Entrada | Validación |
|-------|-----------|
| Dirección | Formato hexadecimal, longitud=42, checksum EIP-55 vía viem |
| Monto | Rechaza NaN, Infinity, negativos, cero, vacío |
| Cadena | Lista blanca estricta (`base`, `ethereum`) |
| Símbolo de token | Máximo 20 caracteres, rechaza caracteres de inyección |
| Nombre de contacto | Máximo 100 caracteres, rechaza traversal de ruta |

#### 11. Seguridad del Sistema de Archivos y RPC

- **Escrituras atómicas**: escribir en archivo temporal → renombrar (previene corrupción en caídas)
- **Permisos 0600**: solo el propietario puede leer/escribir archivos sensibles
- **Prevención de traversal de ruta**: `sanitizePath()` rechaza rutas fuera del directorio de datos
- **Verificaciones de cordura del gas**: rechaza estimaciones de gas de 0 y > 30M
- **Sin filtración de claves**: los mensajes de error nunca contienen claves privadas ni contraseñas

---

## Características

- **Sin custodia y aislada** — Las claves están en el Escritorio, el Agente no tiene secretos
- **Cifrado de extremo a extremo** — X25519 + AES-256-GCM, el Relay solo ve texto cifrado
- **Emparejamiento automático** — Configuración única, reconexión automática después de reinicios
- **Verificación de tres niveles** — Clave pública + huella del dispositivo + política de IP en cada reconexión
- **Cifrado Keystore V3** — AES-256-GCM + scrypt KDF para claves en reposo
- **Motor de políticas** — Límites de gasto por transacción y diarios, lista blanca de direcciones, cola de aprobación
- **Multi-cadena EVM** — Base (por defecto, gas bajo) y mainnet de Ethereum, extensible a cualquier cadena EVM
- **Doble modo de operación** — Supervisado (aprobación humana) o Autónomo (dentro de los límites)
- **Contactos del Agente** — Libreta de direcciones P2P con resolución de nombres
- **Monitoreo de saldo** — Sondeo en segundo plano para transferencias entrantes
- **Historial de transacciones** — Caché local con registros completos
- **Relay containerizado** — Servidor Relay en Go con soporte Docker (framework Hertz)
- **17 herramientas MCP** — Definiciones de herramientas listas para registrar para la integración de Agentes de IA

---

## Inicio Rápido

### Requisitos Previos

- Node.js ≥ 18
- Go ≥ 1.21 (para el Servidor Relay)
- Un framework de Agente de IA compatible con OpenClaw

### 1. Iniciar el Servidor Relay

```bash
cd server
go run cmd/relay/main.go
# Por defecto: :8765
```

O con Docker:

```bash
cd server
docker compose up -d
```

### 2. Iniciar la Billetera de Escritorio

```bash
cd desktop
npm install
npm run dev
```

### 3. Crear una Billetera y Emparejar

1. En la aplicación de Escritorio: establecer contraseña → respaldar la frase mnemónica
2. Haz clic en "Generate Pairing Code" → copia el código de 8 caracteres
3. En tu Agente, llama a `wallet_pair({ shortCode: "ABCD1234" })`
4. Listo — sesión E2EE establecida, reconexión automática habilitada

### 4. Usar con tu Agente

El Agente proporciona 17 herramientas. Ejemplo de conversación:

```
Tú:     "Envía 10 USDC a Bob en Base"
Agente: wallet_contacts_resolve("bob") → 0x742d...
        wallet_send({ to: "0x742d...", amount: 10, token: "USDC", chain: "base" })
        → Política ✓ → E2EE → Escritorio firma → Transmisión
        "Enviados 10 USDC a Bob. tx: 0xab3f..."
```

---

## Herramientas Disponibles

| Herramienta | Descripción |
|------|-------------|
| **Gestión de Billetera** | |
| `wallet_create` | Crear una nueva billetera con keystore cifrado |
| `wallet_import` | Importar billetera existente vía clave privada |
| `wallet_address` | Obtener la dirección de la billetera actual |
| `wallet_pair` | Emparejar con la Billetera de Escritorio mediante código corto |
| **Saldo y Gas** | |
| `wallet_balance` | Consultar saldo de ETH o tokens ERC-20 |
| `wallet_estimate_gas` | Estimar el costo de gas antes de enviar |
| **Transacciones** | |
| `wallet_send` | Enviar ETH o tokens ERC-20 (soporta nombres de contactos) |
| `wallet_history` | Consultar historial de transacciones paginado |
| **Contactos** | |
| `wallet_contacts_add` | Agregar o actualizar un contacto con direcciones multi-cadena |
| `wallet_contacts_list` | Listar todos los contactos guardados |
| `wallet_contacts_resolve` | Buscar la dirección de un contacto por nombre |
| `wallet_contacts_remove` | Eliminar un contacto |
| **Políticas y Aprobaciones** | |
| `wallet_policy_get` | Ver la política de seguridad actual |
| `wallet_policy_set` | Actualizar límites de gasto, lista blanca o modo |
| `wallet_approval_list` | Listar aprobaciones de transacciones pendientes |
| `wallet_approval_approve` | Aprobar una transacción en cola |
| `wallet_approval_reject` | Rechazar una transacción en cola |

---

## Estructura del Proyecto

```
wallet/
├── agent/                 # Framework del Agente de IA (TypeScript) — sin secretos
│   ├── index.ts           # Clase ClawWallet — orquesta herramientas y firmante
│   ├── e2ee/              # Cripto E2EE, transporte WebSocket, machine-id
│   │   ├── crypto.ts      # X25519, AES-256-GCM, HKDF, serialización de claves
│   │   ├── transport.ts   # Cliente WebSocket E2EE con handshake extendido
│   │   └── machine-id.ts  # Huella del dispositivo (SHA256 de hostname:MAC)
│   ├── signer/            # RelaySigner — emparejamiento persistente, auto-reconexión
│   │   ├── relay-client.ts    # Conexión Relay, pairId determinístico, reparación
│   │   ├── ipc-server.ts     # Servidor IPC con socket de dominio Unix
│   │   └── ipc-client.ts     # Cliente IPC para comunicación herramienta → firmante
│   ├── tools/             # 17 definiciones de herramientas MCP
│   └── *.ts               # Política, contactos, historial, monitor, validación
│
├── desktop/               # Billetera de Escritorio Electron — contiene todos los secretos
│   └── src/
│       ├── main/
│       │   ├── key-manager.ts      # Mnemónico BIP-39, cifrado/descifrado Keystore V3
│       │   ├── signing-engine.ts   # Firma de transacciones con limpieza de memoria
│       │   ├── relay-bridge.ts     # Relay E2EE, verificación de tres niveles, congelación de sesión
│       │   ├── security-monitor.ts # Detección de cambios de IP/dispositivo, alertas
│       │   └── lock-manager.ts     # Bloqueo/desbloqueo de billetera, timeout por inactividad
│       ├── preload/                # contextBridge seguro (sin nodeIntegration)
│       ├── renderer/               # UI HTML/CSS/JS
│       └── shared/
│           └── e2ee-crypto.ts      # Primitivas E2EE compartidas
│
└── server/                # Servidor Relay en Go (Hertz) — reenviador sin estado
    ├── cmd/relay/main.go  # Punto de entrada, configuración de rutas
    ├── internal/
    │   ├── hub/           # Hub WebSocket, vinculación de IP, limitación de tasa
    │   ├── pairing/       # Generación y resolución de códigos cortos
    │   ├── middleware/     # CORS, registro de accesos
    │   └── iputil/        # Utilidades de extracción de IP
    ├── Dockerfile         # Compilación multi-etapa
    └── docker-compose.yml # Despliegue con un solo comando
```

---

## Cadenas y Tokens Soportados

| Cadena | ID de Cadena | RPC Predeterminado | Tokens Integrados |
|-------|----------|-------------|-----------------|
| Base | 8453 | RPC público de Base | USDC, USDT |
| Ethereum | 1 | RPC público de Ethereum | USDC, USDT |

Cualquier token ERC-20 puede utilizarse pasando su dirección de contrato. Las cadenas son extensibles — agrega cualquier cadena compatible con EVM mediante configuración.

---

## Desarrollo

```bash
# Agente (TypeScript)
cd agent && npm install && npm test

# Escritorio (Electron)
cd desktop && npm install && npm run dev

# Servidor Relay (Go)
cd server && go test ./...

# Despliegue con Docker
cd server && docker compose up --build
```

### Suite de Pruebas

| Categoría | Qué se Prueba |
|----------|---------------|
| **Keystore** | Generación de claves, cifrado/descifrado, contraseña incorrecta, estructura V3 |
| **Políticas** | Límites, lista blanca, modos, flujo de aprobación, aritmética de centavos enteros |
| **E2EE** | Serialización de pares de claves, derivación determinística de pairId |
| **Hub del Relay** | Enrutamiento WebSocket, vinculación de IP por par, limitación de tasa de conexión |
| **Emparejamiento** | Generación de códigos cortos, expiración, resolución |
| **Middleware** | Configuración de CORS, registro de accesos |
| **Seguridad** | Entropía de claves, limpieza de memoria, inyección de entrada, permisos de archivo, traversal de ruta, seguridad RPC |

---

## Solución de Problemas

| Problema | Solución |
|-------|---------|
| "Wallet app offline" | Asegúrate de que la Billetera de Escritorio esté ejecutándose y conectada al Relay |
| "Pairing code expired" | Genera un nuevo código (TTL de 10 min) |
| Solicitudes de firma bloqueadas | Verifica si la sesión está congelada (discrepancia de identidad) — re-empareja si es necesario |
| Alerta de cambio de IP | Configura la política de IP: `block` / `warn` / `allow` |
| El Agente no puede reconectarse | Usa `wallet_repair` para limpiar los datos de emparejamiento y re-emparejar |
| Advertencia de misma máquina | Mueve la Billetera de Escritorio a un dispositivo separado para seguridad completa |

---

## Licencia

MIT
