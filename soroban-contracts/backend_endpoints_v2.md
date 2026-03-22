# backend_endpoints.md — v2

> Especificación de endpoints del backend Express + Node.js de **Nuv**.
> Esta versión corrige los errores críticos, inconsistencias de diseño y omisiones de funcionalidad detectados en v1.

---

## Convenciones generales

- Todos los endpoints retornan `{ success: true, data: ... }` en caso de éxito o `{ error: "mensaje" }` con el código HTTP correspondiente en caso de fallo.
- Los endpoints que interactúan con contratos Soroban pueden fallar si el contrato hace panic (wallet inactiva, rol incorrecto, fondos insuficientes, estado inválido). El backend debe capturar estos errores y retornarlos con `500`.
- **Modelo custodial:** Nuv administra las claves privadas de los usuarios. El usuario se autentica con email + password; la plataforma firma las transacciones en su nombre usando la wallet custodiada.
- Todos los `body` y parámetros de query usan **camelCase** de forma uniforme (convención JS).
- Las funciones de contratos se importan desde la carpeta `contracts/` del proyecto.
- **Token de pago:** MXNe sobre Stellar (SAC). Todos los montos en los contratos son en MXNe. Asegurarse de que el deploy de los contratos use la dirección del token MXNe, no XLM ni USDC.
- **Parámetros de paginación estándar** para todos los endpoints de lista: `?page=1&limit=20`.

---

## authRoutes

> Autenticación custodial por email + password. La wallet Stellar se crea y custodia en el servidor; el usuario nunca maneja claves privadas.

---

### `POST /auth/register`

Registra un nuevo usuario, crea su wallet custodial on-chain y la persiste en DB.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "...",
  "role": "Freelancer"
}
```

**Lógica:**
1. Validar que el email no exista en DB.
2. Hashear password con bcrypt.
3. Llamar a `createWalletForUser(email, role, db)` del servicio de wallets:
   - Genera un nuevo `Keypair` Stellar.
   - Llama al contrato `WalletRegistry.register_user(publicKey, emailHash, role)` para registrar identidad on-chain.
   - Persiste `{ email, publicKey, encryptedSecret, role }` en DB.
4. Emitir JWT con `{ userId, publicKey, role }`.

**Contratos (`contracts/walletRegistry.js`):**
```js
registerUser(adminKeypair, newPublicKey, emailHash, role)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJ...",
    "publicKey": "G...",
    "role": "Freelancer"
  }
}
```

---

### `POST /auth/login`

Autentica al usuario con email + password y emite un JWT.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "..."
}
```

**Lógica:**
1. Buscar usuario en DB por email. Si no existe → `401`.
2. Comparar password con bcrypt.
3. Verificar que la wallet esté activa on-chain con `isActiveByWallet`.
4. Emitir JWT con `{ userId, publicKey, role }`.

**Contratos (`contracts/walletRegistry.js`):**
```js
// Pre-validación de actividad antes de emitir el JWT
isActiveByWallet(platformPublicKey, userPublicKey)
```

**Response:**
```json
{ "success": true, "data": { "token": "eyJ..." } }
```

---

## userRoutes

> Gestión de perfiles de usuario. La reputación y el historial provienen de contratos on-chain; los metadatos (username, bio, skills) son off-chain.

---

### `GET /users/:publicKey`

Retorna el perfil completo de un usuario.

**Lógica:**
1. Buscar usuario en DB por `publicKey`.
2. Consultar reputación por cada categoría activa → `getReputation`.
3. Consultar estado de ban → `isBanned`.
4. Combinar y retornar.

**Contratos (`contracts/reputation.js`):**
```js
getReputation(callerPublicKey, userPublicKey, category)
isBanned(callerPublicKey, userPublicKey)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "publicKey": "G...",
    "username": "...",
    "role": "Freelancer",
    "reputation": { "design": 12, "dev": 5 },
    "isBanned": false
  }
}
```

---

### `GET /users/:publicKey/wallet`

Retorna la `publicKey` asociada al email del usuario. Útil para flujos internos donde se necesita resolver la wallet a partir de la identidad.

**Auth:** JWT requerido. Solo el propio usuario o admin.

**Lógica:**
```js
getPublicKeyForUser(email, db)
```

**Response:**
```json
{ "success": true, "data": { "publicKey": "G..." } }
```

---

### `POST /users/:publicKey/wallet/rotate`

Rota la wallet custodial del usuario (genera nuevo keypair, actualiza on-chain y en DB).

**Auth:** JWT requerido. Solo el propio usuario o admin.

**Lógica:**
```js
rotateWallet(email, db)
// Genera nuevo keypair → llama a WalletRegistry.update_wallet → actualiza DB
```

**Contratos (`contracts/walletRegistry.js`):**
```js
updateWallet(adminKeypair, oldPublicKey, newPublicKey)
```

---

### `GET /users/:publicKey/history`

Retorna el historial de eventos y proyectos en los que participó el usuario.

**Query params:** `?page=1&limit=20&type=event|project`

**Lógica:**
1. Consultar en DB los `eventId` y `projectId` asociados al usuario.
2. Enriquecer con estado on-chain.

**Contratos (`contracts/event.js`, `contracts/project.js`):**
```js
getEvent(callerPublicKey, eventId)
getProject(callerPublicKey, projectId)
```

---

### `GET /users/ranking`

Retorna el ranking de freelancers ordenados por reputación total acumulada.

**Query params:** `?page=1&limit=20&category=design`

**Lógica:** consulta DB (reputaciones indexadas, ordenadas por total o por categoría si se especifica).

**Contratos:** ninguno directo.

---

### `PATCH /users/:publicKey`

Actualiza datos del perfil off-chain (username, bio, skills, avatar).

**Auth:** JWT requerido. Solo el propio usuario.

**Body:**
```json
{
  "username": "...",
  "bio": "...",
  "skills": ["design", "dev"],
  "avatarUrl": "https://..."
}
```

**Contratos:** ninguno.

---

## walletRoutes

> Gestión financiera de la wallet interna: saldo MXNe, depósitos y retiros. La gestión de identidad on-chain (registro, rotación) está en `userRoutes` y `authRoutes`.

---

### `GET /wallet/balance`

Retorna el saldo disponible en MXNe de la wallet del usuario autenticado.

**Auth:** JWT requerido.

**Lógica:**
1. Obtener `publicKey` del JWT.
2. Consultar saldo del token MXNe en la cuenta Stellar del usuario vía Horizon API.

**Contratos:** ninguno directo (consulta Horizon sobre el token SAC de MXNe).

**Response:**
```json
{ "success": true, "data": { "balanceMXNe": "1500.00" } }
```

---

### `POST /wallet/deposit`

Registra un depósito de MXN → MXNe vía SPEI o tarjeta. Proceso custodiado por la plataforma.

**Auth:** JWT requerido. Roles `Recruiter` o `Admin`.

**Body:**
```json
{ "amountMXN": 5000, "method": "SPEI" }
```

**Lógica:**
1. Crear orden de depósito en DB con estado `pending`.
2. Integrar con proveedor de pago (decaf u otro intermediario).
3. Al confirmar pago fiat, acreditar MXNe a la wallet on-chain.
4. Registrar transacción en DB y notificar al usuario.

**Contratos:** transferencia de token MXNe (SAC), fuera del scope de los contratos core.

---

### `POST /wallet/withdraw`

El freelancer solicita retirar MXNe a una cuenta Stellar externa.

**Auth:** JWT requerido. Rol `Freelancer`.

**Body:**
```json
{ "amountMXNe": 1000, "destinationAccount": "G..." }
```

**Lógica:**
1. Validar saldo suficiente.
2. Crear orden de retiro en DB.
3. Procesar transferencia on-chain vía el intermediario (decaf).
4. Actualizar estado de la orden y notificar al usuario.

**Contratos:** transferencia de token MXNe (SAC).

---

### `GET /wallet/transactions`

Retorna el historial de transacciones del usuario autenticado.

**Auth:** JWT requerido.

**Query params:** `?page=1&limit=20&type=deposit|withdraw|payment`

**Lógica:** consulta DB indexada por `publicKey`.

**Contratos:** ninguno directo.

---

## eventRoutes

> Módulo de competencias. Un reclutador crea un evento con premio en escrow en MXNe; los freelancers aplican, envían entregables y el reclutador selecciona ganadores.

---

### `GET /events`

Lista todos los eventos activos y pasados.

**Query params:** `?page=1&limit=20&status=Open&category=design`

**Lógica:** consulta DB indexada. Para eventos activos puede enriquecer con estado on-chain.

**Contratos:** ninguno directo.

---

### `GET /events/:eventId`

Retorna los datos completos de un evento (metadatos off-chain + estado on-chain).

**Lógica:**
1. Consultar DB para metadatos (título, descripción, reglas, imagen).
2. Consultar estado on-chain.

**Contratos (`contracts/event.js`):**
```js
getEvent(callerPublicKey, eventId)
```

---

### `POST /events`

El reclutador crea un nuevo evento. El premio queda en escrow en el contrato en MXNe.

**Auth:** JWT requerido. Rol `Recruiter`.

**Body:**
```json
{
  "prize": 5000,
  "category": "design",
  "deadlineSubmit": 1720000000,
  "deadlineSelect": 1720100000,
  "title": "Rediseña nuestra landing",
  "description": "...",
  "rules": "..."
}
```

**Lógica:**
1. Validar que el reclutador tenga saldo suficiente en MXNe.
2. Llamar al contrato → retorna `eventId`.
3. El contrato valida internamente actividad + rol `Recruiter` (cross-contract → `WalletRegistry`).
4. Guardar metadatos off-chain en DB.
5. Retornar `eventId`.

**Contratos (`contracts/event.js`):**
```js
// initialize recibe wallet_registry_addr como quinto argumento (ver deploy script)
createEvent(recruiterKeypair, prize, category, deadlineSubmit, deadlineSelect)
```

**Response:**
```json
{ "success": true, "data": { "eventId": "7" } }
```

---

### `POST /events/:eventId/apply`

El freelancer se registra como participante en un evento.

**Auth:** JWT requerido. Rol `Freelancer`.

**Lógica:**
1. Llamar al contrato. El contrato valida actividad + rol `Freelancer`.
2. Registrar participación en DB para indexación e historial.
3. Notificar al reclutador.

**Contratos (`contracts/event.js`):**
```js
applyToEvent(freelancerKeypair, eventId)
```

---

### `POST /events/:eventId/submit`

El freelancer envía su entregable (SHA-256 del trabajo).

**Auth:** JWT requerido. Rol `Freelancer`.

**Body:**
```json
{ "entryContent": "url o contenido del entregable" }
```

**Lógica:**
1. Calcular `SHA-256` del contenido en el backend.
2. Llamar al contrato con el hash.
3. Almacenar referencia del entregable (URL/IPFS) en DB.

**Contratos (`contracts/event.js`):**
```js
// No re-valida wallet — la presencia en applicants garantiza validación previa al aplicar
submitEntry(freelancerKeypair, eventId, entryHash)
```

---

### `POST /events/:eventId/winners`

El reclutador selecciona ganadores. El contrato distribuye el 90% del premio y retiene 10% de comisión. Actualiza reputación automáticamente (+10 ganadores, +1 participantes).

**Auth:** JWT requerido. Rol `Recruiter`. Solo el reclutador del evento.

**Body:**
```json
{ "winners": ["G...", "G..."] }
```

**Lógica:**
1. Llamar al contrato con la lista de ganadores.
2. Registrar resultado en DB y disparar notificaciones.

**Contratos (`contracts/event.js`):**
```js
selectWinners(recruiterKeypair, eventId, winners)
```

---

### `POST /events/:eventId/timeout`

Cierra el evento si el reclutador no seleccionó ganadores antes del `deadlineSelect`. Disparado internamente vía cron job; no debe exponerse como endpoint público de usuario.

**Auth:** Interno (usa `PLATFORM_SECRET`).

**Contratos (`contracts/event.js`):**
```js
timeoutDistribute(platformKeypair, eventId)
```

---

## projectRoutes

> Módulo de contratación directa 1:1. El reclutador propone un proyecto a un freelancer específico con escrow en MXNe.

---

### `GET /projects`

Lista los proyectos del usuario autenticado (como reclutador o freelancer).

**Auth:** JWT requerido.

**Query params:** `?page=1&limit=20&status=Active`

**Lógica:** consulta DB indexada por `publicKey` del usuario autenticado.

**Contratos:** ninguno directo.

---

### `GET /projects/:projectId`

Retorna los datos completos de un proyecto (metadatos off-chain + estado on-chain).

**Auth:** JWT requerido. Solo los participantes del proyecto.

**Contratos (`contracts/project.js`):**
```js
getProject(callerPublicKey, projectId)
```

---

### `POST /projects`

El reclutador crea un proyecto y deposita `amount + guarantee` en escrow en MXNe.

**Auth:** JWT requerido. Rol `Recruiter`.

**Body:**
```json
{
  "freelancerPublicKey": "G...",
  "amount": 3000,
  "guarantee": 500,
  "deadline": 1720500000,
  "category": "dev",
  "title": "Integración de pagos",
  "description": "..."
}
```

**Lógica:**
1. Validar fondos suficientes del reclutador (`amount + guarantee` en MXNe).
2. Llamar al contrato → retorna `projectId`.
3. El contrato valida ambas partes on-chain: reclutador (Recruiter) y freelancer (Freelancer).
4. Guardar metadatos off-chain en DB y notificar al freelancer.

**Contratos (`contracts/project.js`):**
```js
// initialize recibe wallet_registry_addr como quinto argumento (ver deploy script)
// Valida internamente: actividad + rol Recruiter y actividad + rol Freelancer
createProject(recruiterKeypair, freelancerPublicKey, amount, guarantee, deadline, category)
```

**Response:**
```json
{ "success": true, "data": { "projectId": "12" } }
```

---

### `POST /projects/:projectId/accept`

El freelancer acepta el proyecto. El estado cambia a `Active`.

**Auth:** JWT requerido. Rol `Freelancer`. Solo el freelancer asignado.

**Lógica:**
1. Llamar al contrato.
2. El contrato re-valida actividad del freelancer (protege contra desactivación post-creación).
3. Actualizar estado en DB y notificar al reclutador.

**Contratos (`contracts/project.js`):**
```js
// Re-valida actividad del freelancer — puede haber sido desactivado desde la creación
acceptProject(freelancerKeypair, projectId)
```

---

### `POST /projects/:projectId/deliver`

El freelancer envía su entregable. El estado cambia a `Delivered`.

**Auth:** JWT requerido. Rol `Freelancer`. Solo el freelancer asignado.

**Body:**
```json
{ "deliveryContent": "url o contenido del entregable" }
```

**Lógica:**
1. Calcular `SHA-256` del contenido.
2. Llamar al contrato con el hash.
3. Registrar referencia del entregable (URL/IPFS) en DB y notificar al reclutador.

**Contratos (`contracts/project.js`):**
```js
submitDelivery(freelancerKeypair, projectId, deliveryHash)
```

---

### `POST /projects/:projectId/approve`

El reclutador aprueba la entrega. Transfiere `amount + guarantee` al freelancer y otorga +5 reputación.

**Auth:** JWT requerido. Rol `Recruiter`. Solo el reclutador del proyecto.

**Lógica:**
1. Llamar al contrato.
2. Notificar al freelancer que los fondos fueron liberados.

**Contratos (`contracts/project.js`):**
```js
approveDelivery(recruiterKeypair, projectId)
```

---

### `POST /projects/:projectId/correction`

El reclutador solicita una ronda de correcciones (máximo 2). El estado cambia a `Correcting`.

**Auth:** JWT requerido. Rol `Recruiter`. Solo el reclutador del proyecto.

**Contratos (`contracts/project.js`):**
```js
requestCorrection(recruiterKeypair, projectId)
```

---

### `POST /projects/:projectId/reject`

El reclutador rechaza la entrega definitivamente. El estado cambia a `Disputed`.

**Auth:** JWT requerido. Rol `Recruiter`. Solo el reclutador del proyecto.

**Lógica:**
1. Llamar al contrato.
2. Notificar al admin que hay una disputa abierta.

**Contratos (`contracts/project.js`):**
```js
rejectDelivery(recruiterKeypair, projectId)
```

---

### `POST /projects/:projectId/timeout-approve`

Auto-aprueba el proyecto si el reclutador no revisó la entrega antes del `deadline`. El freelancer recibe `amount + guarantee` y +5 reputación. Disparado internamente vía cron job.

**Auth:** Interno (usa `PLATFORM_SECRET`).

**Lógica:** se invoca desde `jobs/timeout.job.js` para proyectos en estado `Delivered` con deadline vencido.

**Contratos (`contracts/project.js`):**
```js
timeoutApprove(platformKeypair, projectId)
```

---

### `POST /projects/:projectId/timeout-refund`

Devuelve `amount + guarantee` al reclutador si el freelancer nunca aceptó antes del `deadline`. Disparado internamente vía cron job.

**Auth:** Interno (usa `PLATFORM_SECRET`).

**Lógica:** se invoca desde `jobs/timeout.job.js` para proyectos en estado `Created` o `Correcting` con deadline vencido.

**Contratos (`contracts/project.js`):**
```js
timeoutRefund(platformKeypair, projectId)
```

> **Cron job unificado:** `jobs/timeout.job.js` debe manejar los timeouts de eventos y proyectos en el mismo schedule. Ver estructura sugerida al final del documento.

---

## disputeRoutes

> Resolución de disputas abiertas por rechazo de entrega en proyectos. Solo el admin puede resolver.

---

### `GET /disputes`

Lista todas las disputas abiertas (proyectos en estado `Disputed`).

**Auth:** JWT requerido. Rol `Admin`.

**Query params:** `?page=1&limit=20`

**Lógica:** consulta DB filtrando proyectos con `status = Disputed`.

**Contratos:** ninguno directo.

---

### `GET /disputes/:projectId`

Retorna el detalle de la disputa: datos on-chain + evidencia off-chain (mensajes, entregables).

**Auth:** JWT requerido. Rol `Admin`.

**Contratos (`contracts/project.js`):**
```js
getProject(callerPublicKey, projectId)
```

---

### `POST /disputes/:projectId/resolve`

El admin resuelve la disputa. `ADMIN_SECRET` nunca se expone al cliente — vive en variables de entorno del servidor.

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "favorFreelancer": true }
```

**Lógica:**
1. Llamar al contrato con la decisión.
2. Si `favorFreelancer = true`: fondos al freelancer + +5 reputación.
3. Si `favorFreelancer = false`: fondos devueltos al reclutador.
4. Actualizar estado en DB y notificar a ambas partes.

**Contratos (`contracts/project.js`):**
```js
resolveDispute(adminKeypair, projectId, favorFreelancer)
```

---

## reputationRoutes

> Consulta y administración de reputación on-chain. En operación normal la reputación la gestionan automáticamente `EventContract` y `ProjectContract`. Los endpoints de escritura son para ajustes manuales excepcionales.

---

### `GET /reputation/:publicKey`

Retorna la reputación de un usuario por categoría.

**Query params:** `?category=design` (opcional; sin filtro retorna todas las categorías)

**Contratos (`contracts/reputation.js`):**
```js
getReputation(callerPublicKey, userPublicKey, category)
```

**Response:**
```json
{ "success": true, "data": { "design": 12, "dev": 5 } }
```

---

### `GET /reputation/:publicKey/banned`

Verifica si un usuario está baneado.

**Contratos (`contracts/reputation.js`):**
```js
isBanned(callerPublicKey, userPublicKey)
```

---

### `POST /reputation/:publicKey/ban`

El admin aplica shadowban.

**Auth:** JWT requerido. Rol `Admin`.

**Lógica:**
1. Llamar al contrato `shadowban`.
2. Registrar acción en DB (log de moderación).

**Contratos (`contracts/reputation.js`):**
```js
shadowban(adminKeypair, userPublicKey)
```

---

### `POST /reputation/:publicKey/unban`

El admin revierte el shadowban.

**Auth:** JWT requerido. Rol `Admin`.

**Contratos (`contracts/reputation.js`):**
```js
unban(adminKeypair, userPublicKey)
```

---

### `POST /reputation/:publicKey/add`

El admin incrementa manualmente la reputación de un usuario.

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "category": "design", "delta": 5 }
```

**Nota:** El contrato valida actividad de la wallet antes de acreditar (cross-contract → `WalletRegistry`). Uso reservado para ajustes excepcionales.

**Contratos (`contracts/reputation.js`):**
```js
addReputation(adminKeypair, userPublicKey, category, delta)
```

---

### `POST /reputation/:publicKey/remove`

El admin decrementa manualmente la reputación de un usuario.

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "category": "design", "delta": 3 }
```

**Nota:** Guard de underflow en contrato: si `delta > reputación actual` hace panic. Pre-validar con `getReputation` antes de llamar.

**Contratos (`contracts/reputation.js`):**
```js
// Pre-validar: const current = await getReputation(...); if (delta > current) return error
removeReputation(adminKeypair, userPublicKey, category, delta)
```

---

## conversationRoutes

> Canales de comunicación entre reclutador y freelancer en el contexto de un proyecto o evento.

---

### `GET /conversations`

Lista las conversaciones del usuario autenticado.

**Auth:** JWT requerido.

**Query params:** `?page=1&limit=20`

**Lógica:** consulta DB filtrando por participante (`publicKey` del JWT).

**Contratos:** ninguno.

---

### `GET /conversations/:conversationId`

Retorna los metadatos de una conversación (participantes, `contextType`, `contextId`).

**Auth:** JWT requerido. Solo participantes.

**Contratos:** ninguno.

---

### `POST /conversations`

Crea un canal de comunicación asociado a un proyecto o evento.

**Auth:** JWT requerido.

**Body:**
```json
{
  "participantPublicKey": "G...",
  "contextType": "project",
  "contextId": "42"
}
```

**Lógica:**
1. Validar que ambas partes pertenezcan al proyecto/evento (consulta DB).
2. Upsert de conversación en DB para ese contexto.

**Contratos:** ninguno.

---

### `PATCH /conversations/:conversationId/archive`

Archiva una conversación (soft delete). No elimina mensajes.

**Auth:** JWT requerido. Solo participantes.

**Lógica:** actualizar campo `archivedAt` en DB.

**Contratos:** ninguno.

---

## messageRoutes

> Mensajes dentro de una conversación. Soporta texto plano y evidencia (links, archivos).

---

### `GET /conversations/:conversationId/messages`

Retorna los mensajes de una conversación, paginados.

**Auth:** JWT requerido. Solo participantes.

**Query params:** `?page=1&limit=50`

**Contratos:** ninguno.

---

### `POST /conversations/:conversationId/messages`

Envía un mensaje dentro de una conversación.

**Auth:** JWT requerido. Solo participantes.

**Body:**
```json
{
  "content": "Aquí está el avance del diseño",
  "attachmentUrl": "https://..."
}
```

**Lógica:**
1. Validar que el `publicKey` del JWT sea participante de la conversación.
2. Guardar mensaje en DB.
3. Disparar notificación en tiempo real (WebSocket / push).

**Contratos:** ninguno.

---

## notificationRoutes

> Notificaciones del sistema. Disparadas por el indexer on-chain o por la lógica de negocio al detectar cambios de estado.

---

### `GET /notifications`

Retorna las notificaciones del usuario autenticado.

**Auth:** JWT requerido.

**Query params:** `?page=1&limit=20&read=false`

**Contratos:** ninguno.

---

### `PATCH /notifications/:notificationId/read`

Marca una notificación como leída.

**Auth:** JWT requerido. Solo el propietario.

**Contratos:** ninguno.

---

### `PATCH /notifications/read-all`

Marca todas las notificaciones del usuario como leídas.

**Auth:** JWT requerido.

**Contratos:** ninguno.

---

### Eventos que disparan notificaciones (generados internamente)

| Evento                         | Destinatario            | Mensaje sugerido                                       |
|--------------------------------|-------------------------|--------------------------------------------------------|
| Nuevo evento creado            | Freelancers activos     | "Hay un nuevo evento en tu categoría: {title}"         |
| Aplicación recibida            | Reclutador              | "{username} aplicó a tu evento {title}"                |
| Ganadores seleccionados        | Todos los participantes | "Los ganadores de {title} han sido anunciados"         |
| Proyecto propuesto             | Freelancer              | "Tienes una nueva propuesta de proyecto"               |
| Proyecto aceptado              | Reclutador              | "{username} aceptó el proyecto"                        |
| Entrega recibida               | Reclutador              | "{username} marcó el proyecto como entregado"          |
| Corrección solicitada          | Freelancer              | "El reclutador solicitó correcciones"                  |
| Entrega aprobada               | Freelancer              | "Tu entrega fue aprobada. Fondos liberados."           |
| Disputa abierta                | Admin + ambas partes    | "Se abrió una disputa en el proyecto #{id}"            |
| Disputa resuelta               | Ambas partes            | "La disputa fue resuelta: {resultado}"                 |
| Pago recibido                  | Freelancer              | "Recibiste {amount} MXNe"                              |
| Reputación actualizada         | Usuario                 | "Tu reputación en {category} cambió: +{delta} puntos" |
| Wallet rotada                  | Usuario                 | "Tu wallet fue actualizada exitosamente"               |

---

## categoryRoutes

> Categorías de habilidades disponibles en la plataforma. Son la base del sistema de reputación segmentada.

---

### `GET /categories`

Retorna la lista de todas las categorías disponibles.

**Auth:** ninguna (endpoint público).

**Contratos:** ninguno.

**Response:**
```json
{
  "success": true,
  "data": [
    { "slug": "design", "label": "Diseño", "icon": "🎨" },
    { "slug": "dev", "label": "Desarrollo", "icon": "💻" }
  ]
}
```

---

### `GET /categories/:slug`

Retorna el detalle de una categoría individual, incluyendo su ranking de reputación.

**Auth:** ninguna (endpoint público).

**Query params:** `?page=1&limit=20` (para el ranking de usuarios en esa categoría)

**Lógica:**
1. Buscar categoría en DB por `slug`. Si no existe → `404`.
2. Retornar metadatos + ranking de usuarios con mayor reputación en esa categoría.

**Contratos:** ninguno directo (ranking desde DB indexada).

**Response:**
```json
{
  "success": true,
  "data": {
    "slug": "design",
    "label": "Diseño",
    "icon": "🎨",
    "ranking": [
      { "publicKey": "G...", "username": "...", "score": 45 }
    ]
  }
}
```

---

### `POST /categories`

Crea una nueva categoría.

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "slug": "marketing", "label": "Marketing Digital", "icon": "📣" }
```

**Contratos:** ninguno (las categorías son strings `Symbol` en los contratos; no requieren registro on-chain).

---

## Resumen de contratos por módulo

| Módulo                | Funciones de contrato usadas                                                                                      |
|-----------------------|-------------------------------------------------------------------------------------------------------------------|
| `authRoutes`          | `registerUser`, `isActiveByWallet`                                                                                |
| `userRoutes`          | `getReputation`, `isBanned`, `getEvent`, `getProject`, `updateWallet`                                             |
| `walletRoutes`        | Token SAC (MXNe), Horizon API                                                                                     |
| `eventRoutes`         | `createEvent`, `applyToEvent`, `submitEntry`, `selectWinners`, `timeoutDistribute`, `getEvent`                    |
| `projectRoutes`       | `createProject`, `acceptProject`, `submitDelivery`, `approveDelivery`, `requestCorrection`, `rejectDelivery`, `timeoutApprove`, `timeoutRefund`, `getProject` |
| `disputeRoutes`       | `resolveDispute`, `getProject`                                                                                    |
| `reputationRoutes`    | `getReputation`, `isBanned`, `addReputation`, `removeReputation`, `shadowban`, `unban`                            |
| `conversationRoutes`  | Ninguna                                                                                                           |
| `messageRoutes`       | Ninguna                                                                                                           |
| `notificationRoutes`  | Ninguna (disparadas por indexer o lógica de negocio)                                                              |
| `categoryRoutes`      | Ninguna                                                                                                           |

---

## Estructura de carpeta `contracts/` sugerida

```
contracts/
├── walletRegistry.js  → registerUser, isActiveByWallet, getRoleByWallet, updateWallet,
│                        deactivateUser, activateUser
├── reputation.js      → getReputation, isBanned, addReputation, removeReputation, shadowban, unban
├── event.js           → createEvent, applyToEvent, submitEntry, selectWinners, timeoutDistribute, getEvent
└── project.js         → createProject, acceptProject, submitDelivery, approveDelivery,
                         requestCorrection, rejectDelivery, resolveDispute,
                         timeoutApprove, timeoutRefund, getProject
```

> Las funciones de cada archivo siguen los patrones definidos en `consume_contracts.md`, usando `invokeContract` para escrituras y `queryContract` para lecturas, importados desde `soroban.helper.js`.

---

## Cron job de timeouts (estructura sugerida)

```js
// jobs/timeout.job.js
cron.schedule('*/10 * * * *', async () => {
  const platformKeypair = Keypair.fromSecret(process.env.PLATFORM_SECRET);

  // EventContract timeouts
  const expiredEvents = await db.getExpiredEvents('Open');
  for (const id of expiredEvents) {
    await timeoutDistribute(platformKeypair, id)
      .catch(err => console.error(`timeout_distribute event ${id}:`, err.message));
  }

  // ProjectContract timeouts
  const expiredDelivered  = await db.getExpiredProjects('Delivered');
  const expiredCreated    = await db.getExpiredProjects('Created');
  const expiredCorrecting = await db.getExpiredProjects('Correcting');

  for (const id of expiredDelivered) {
    await timeoutApprove(platformKeypair, id)
      .catch(err => console.error(`timeout_approve project ${id}:`, err.message));
  }

  for (const id of [...expiredCreated, ...expiredCorrecting]) {
    await timeoutRefund(platformKeypair, id)
      .catch(err => console.error(`timeout_refund project ${id}:`, err.message));
  }
});
```

---

## Notas de deploy — firmas actualizadas de `initialize`

Al desplegar los contratos, las firmas de `initialize` han cambiado respecto a versiones anteriores. Asegurarse de usar las siguientes:

| Contrato            | Firma actualizada de `initialize`                                                              |
|---------------------|-----------------------------------------------------------------------------------------------|
| `ReputationLedger`  | `initialize(adminAddr, walletRegistryAddr)`                                                   |
| `EventContract`     | `initialize(adminAddr, tokenAddr, reputationAddr, platformAddr, walletRegistryAddr)`          |
| `ProjectContract`   | `initialize(adminAddr, tokenAddr, reputationAddr, walletRegistryAddr)`                        |

> `tokenAddr` debe apuntar al contrato SAC del token **MXNe** en la red correspondiente (testnet o mainnet). No usar XLM ni USDC.
