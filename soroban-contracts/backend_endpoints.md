# backend_endpoints.md

> Especificación de endpoints del backend Express + Node.js de **Nuv**.
> Cada sección describe el módulo de rutas, los endpoints que lo componen, la lógica esperada y qué funciones de la carpeta `contracts/` (equivalente al `consume_contracts.md`) deben invocarse.

---

## Convenciones generales

- Todos los endpoints retornan `{ success: true, data: ... }` en caso de éxito o `{ error: "mensaje" }` con el código HTTP correspondiente en caso de fallo.
- Los endpoints que interactúan con contratos Soroban pueden fallar si el contrato hace panic (wallet inactiva, rol incorrecto, fondos insuficientes, estado inválido). El backend debe capturar estos errores y retornarlos con `500`.
- En producción, ningún endpoint debe recibir claves privadas. El flujo correcto es construir el XDR sin firmar y retornarlo al cliente para que lo firme con Freighter/Albedo. En los ejemplos se muestra el flujo simplificado con `secret` por claridad.
- Las funciones de contratos se importan desde la carpeta `contracts/` del proyecto.

---

## authRoutes

> Autenticación basada en firma criptográfica de wallet Stellar. No hay contraseñas.

---

### `POST /auth/nonce`

Genera un mensaje aleatorio (nonce) que el cliente debe firmar con su wallet para probar posesión de la clave privada.

**Body:**
```json
{ "publicKey": "G..." }
```

**Lógica:**
1. Generar un nonce aleatorio y almacenarlo temporalmente (Redis / DB) asociado a `publicKey` con TTL de 5 minutos.
2. Retornar el nonce al cliente.

**Contratos:** ninguno.

**Response:**
```json
{ "success": true, "nonce": "nuv-auth:a1b2c3d4e5f6..." }
```

---

### `POST /auth/verify`

Verifica la firma del nonce y emite un JWT de sesión.

**Body:**
```json
{
  "publicKey": "G...",
  "signature": "hex...",
  "nonce": "nuv-auth:a1b2c3d4e5f6..."
}
```

**Lógica:**
1. Recuperar el nonce almacenado para `publicKey`. Si no existe o expiró → `401`.
2. Verificar la firma Ed25519 del nonce usando `@stellar/stellar-sdk` (`Keypair.verify`).
3. Si válida, buscar o crear el usuario en DB con `publicKey` como identificador único.
4. Emitir JWT con `{ userId, publicKey, role }`.
5. Invalidar el nonce usado.

**Contratos:** ninguno (la validación de identidad on-chain ocurre en `WalletRegistry`; aquí solo se verifica la firma criptográfica off-chain).

**Response:**
```json
{ "success": true, "token": "eyJ..." }
```

---

## userRoutes

> Gestión de perfiles de usuario. La reputación y el historial provienen de contratos on-chain.

---

### `GET /users/:publicKey`

Retorna el perfil completo de un usuario: datos off-chain (DB) + reputación y estado on-chain.

**Lógica:**
1. Buscar usuario en DB por `publicKey`.
2. Consultar reputación por categoría al contrato → `getReputation(callerPublicKey, publicKey, category)`.
3. Consultar si está baneado → `isBanned(callerPublicKey, publicKey)`.
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

### `GET /users/:publicKey/history`

Retorna el historial de eventos y proyectos en los que participó el usuario.

**Lógica:**
1. Consultar en DB los `event_id` y `project_id` asociados al usuario.
2. Para cada uno, consultar el estado actual on-chain con `getEvent` / `getProject`.
3. Retornar lista ordenada por fecha.

**Contratos (`contracts/event.js`, `contracts/project.js`):**
```js
getEvent(callerPublicKey, eventId)
getProject(callerPublicKey, projectId)
```

---

### `GET /users/ranking`

Retorna el ranking de freelancers ordenados por reputación total acumulada.

**Lógica:** consulta DB (reputaciones indexadas desde eventos on-chain, ordenadas y paginadas).

**Contratos:** ninguno directo.

---

### `PATCH /users/:publicKey`

Actualiza datos del perfil off-chain (username, bio, skills, avatar).

**Auth:** JWT requerido. Solo el propio usuario puede editar su perfil.

**Contratos:** ninguno.

---

## walletRoutes

> Gestión de la wallet interna de la empresa/reclutador, depósitos, retiros y consultas de saldo.

---

### `GET /wallet/balance`

Retorna el saldo disponible en MXNe de la wallet del usuario autenticado.

**Auth:** JWT requerido.

**Lógica:**
1. Obtener `publicKey` del JWT.
2. Consultar saldo del token MXNe en la cuenta Stellar del usuario vía Horizon API o Soroban.

**Contratos:** ninguno directo (consulta Horizon o `queryContract` sobre el token SAC de MXNe).

---

### `POST /wallet/deposit`

Registra un depósito de MXN → MXNe (vía SPEI o tarjeta). Proceso custodiado por la plataforma.

**Auth:** JWT requerido. Solo empresas/reclutadores.

**Body:**
```json
{ "amountMXN": 5000, "method": "SPEI" }
```

**Lógica:**
1. Crear orden de depósito en DB con estado `pending`.
2. Integrar con proveedor de pago (decaf u otro intermediario).
3. Al confirmar pago fiat, acreditar MXNe a la wallet del usuario on-chain.
4. Registrar transacción en DB.

**Contratos:** transferencia de token MXNe (SAC), fuera del scope de los contratos core.

---

### `POST /wallet/withdraw`

El freelancer solicita retirar MXNe a una cuenta externa.

**Auth:** JWT requerido. Solo freelancers.

**Body:**
```json
{ "amountMXNe": 1000, "destinationAccount": "G..." }
```

**Lógica:**
1. Validar saldo suficiente.
2. Crear orden de retiro en DB.
3. Procesar transferencia on-chain vía el intermediario (decaf).
4. Actualizar estado de la orden.

**Contratos:** transferencia de token MXNe (SAC).

---

### `GET /wallet/transactions`

Retorna el historial de transacciones (depósitos, retiros, pagos de eventos y proyectos) del usuario autenticado.

**Auth:** JWT requerido.

**Lógica:** consulta DB + registros on-chain indexados.

**Contratos:** ninguno directo.

---

## eventRoutes

> Módulo de competencias (eventos). Un reclutador crea un evento con premio en escrow; los freelancers aplican, envían entregables y el reclutador selecciona ganadores.

---

### `GET /events`

Lista todos los eventos activos y pasados. Soporta filtros por `status`, `category` y paginación.

**Lógica:** consulta DB indexada desde eventos on-chain. Para eventos activos puede enriquecer con estado on-chain.

**Contratos:** ninguno directo.

---

### `GET /events/:eventId`

Retorna los datos completos de un evento (metadatos off-chain + estado on-chain).

**Lógica:**
1. Consultar DB para metadatos off-chain (título, descripción, reglas, imagen).
2. Consultar estado on-chain.

**Contratos (`contracts/event.js`):**
```js
getEvent(callerPublicKey, eventId)
```

---

### `POST /events`

El reclutador crea un nuevo evento. El premio queda en escrow en el contrato.

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
1. Validar que el reclutador tenga saldo suficiente (wallet interna).
2. Llamar al contrato → retorna `eventId`.
3. Guardar metadatos off-chain en DB (`title`, `description`, `rules`, `eventId`).
4. Retornar `eventId`.

**Contratos (`contracts/event.js`):**
```js
// El contrato valida internamente: actividad + rol Recruiter (cross-contract → WalletRegistry)
createEvent(recruiterKeypair, prize, category, deadlineSubmit, deadlineSelect)
```

**Response:**
```json
{ "success": true, "eventId": "7" }
```

---

### `POST /events/:eventId/apply`

El freelancer se registra como participante en un evento.

**Auth:** JWT requerido. Rol `Freelancer`.

**Lógica:**
1. Llamar al contrato.
2. Registrar participación en DB para indexación e historial.

**Contratos (`contracts/event.js`):**
```js
// El contrato valida internamente: actividad + rol Freelancer (cross-contract → WalletRegistry)
applyToEvent(freelancerKeypair, eventId)
```

---

### `POST /events/:eventId/submit`

El freelancer envía su entregable (hash SHA-256 del trabajo).

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
// No re-valida wallet — la presencia en applicants ya garantiza validación previa al aplicar
submitEntry(freelancerKeypair, eventId, entryHash)
```

---

### `POST /events/:eventId/winners`

El reclutador selecciona a los ganadores. El contrato distribuye el 90% del premio entre ganadores y retiene 10% de comisión.

**Auth:** JWT requerido. Rol `Recruiter`. Solo el reclutador del evento.

**Body:**
```json
{ "winners": ["G...", "G..."] }
```

**Lógica:**
1. Llamar al contrato con la lista de ganadores.
2. El contrato actualiza reputación automáticamente (+10 ganadores, +1 participantes que enviaron).
3. Registrar resultado en DB y disparar notificaciones.

**Contratos (`contracts/event.js`):**
```js
selectWinners(recruiterKeypair, eventId, winners)
```

---

### `POST /events/:eventId/timeout`

Cierra el evento si el reclutador no seleccionó ganadores antes del `deadline_select`. Disparado vía cron job por la plataforma.

**Auth:** JWT opcional (la plataforma usa su `PLATFORM_SECRET` internamente).

**Lógica:** se recomienda llamar este endpoint desde `jobs/timeout.job.js` con la wallet de servicio de la plataforma, no exponerlo como endpoint público con auth de usuario.

**Contratos (`contracts/event.js`):**
```js
timeoutDistribute(platformKeypair, eventId)
```

---

## projectRoutes

> Módulo de contratación directa 1:1. El reclutador propone un proyecto a un freelancer específico con escrow programable.

---

### `GET /projects`

Lista los proyectos del usuario autenticado (como reclutador o como freelancer). Soporta filtros por `status`.

**Auth:** JWT requerido.

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

El reclutador crea un proyecto y deposita `amount + guarantee` en escrow.

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
1. Validar fondos suficientes del reclutador (`amount + guarantee`).
2. Llamar al contrato → retorna `projectId`.
3. El contrato valida reclutador (Recruiter) y freelancer (Freelancer) on-chain.
4. Guardar metadatos off-chain en DB y disparar notificación al freelancer.

**Contratos (`contracts/project.js`):**
```js
// Valida internamente: actividad + rol Recruiter y actividad + rol Freelancer
createProject(recruiterKeypair, freelancerPublicKey, amount, guarantee, deadline, category)
```

**Response:**
```json
{ "success": true, "projectId": "12" }
```

---

### `POST /projects/:projectId/accept`

El freelancer acepta el proyecto. El estado cambia a `Active`.

**Auth:** JWT requerido. Rol `Freelancer`. Solo el freelancer asignado al proyecto.

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

El reclutador aprueba la entrega. El contrato transfiere `amount + guarantee` al freelancer y otorga +5 reputación.

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

## disputeRoutes

> Resolución de disputas abiertas por rechazo de entrega en proyectos. Solo el admin de la plataforma puede resolver.

---

### `GET /disputes`

Lista todas las disputas abiertas (proyectos en estado `Disputed`).

**Auth:** JWT requerido. Rol `Admin`.

**Lógica:** consulta DB filtrando proyectos con `status = Disputed`.

**Contratos:** ninguno directo.

---

### `GET /disputes/:projectId`

Retorna el detalle de la disputa: datos del proyecto on-chain + evidencia off-chain (mensajes, entregables).

**Auth:** JWT requerido. Rol `Admin`.

**Contratos (`contracts/project.js`):**
```js
getProject(callerPublicKey, projectId)
```

---

### `POST /disputes/:projectId/resolve`

El admin resuelve la disputa a favor del freelancer o del reclutador.

**Auth:** JWT requerido. Rol `Admin`. Usa `ADMIN_SECRET` del servidor — nunca expuesto al cliente.

**Body:**
```json
{ "favorFreelancer": true }
```

**Lógica:**
1. Llamar al contrato con la decisión.
2. Si `favorFreelancer = true`: el contrato transfiere fondos al freelancer y otorga +5 reputación.
3. Si `favorFreelancer = false`: los fondos son devueltos al reclutador.
4. Actualizar estado en DB y disparar notificaciones a ambas partes.

**Contratos (`contracts/project.js`):**
```js
resolveDispute(adminKeypair, projectId, favorFreelancer)
```

---

## reputationRoutes

> Consulta y administración de reputación on-chain. Las modificaciones manuales solo las ejecuta el admin; en operación normal la reputación la gestionan automáticamente `EventContract` y `ProjectContract`.

---

### `GET /reputation/:publicKey`

Retorna la reputación de un usuario por categoría.

**Lógica:** consultar cada categoría activa al contrato y retornar mapa `{ category: score }`.

**Contratos (`contracts/reputation.js`):**
```js
getReputation(callerPublicKey, userPublicKey, category)
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

El admin aplica shadowban a un usuario.

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

El admin revierte el shadowban de un usuario.

**Auth:** JWT requerido. Rol `Admin`.

**Contratos (`contracts/reputation.js`):**
```js
unban(adminKeypair, userPublicKey)
```

---

### `POST /reputation/:publicKey/add`

El admin incrementa manualmente la reputación de un usuario en una categoría.

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "category": "design", "delta": 5 }
```

**Nota:** En operación normal este endpoint no debería necesitarse — la reputación la otorgan los contratos automáticamente al resolver eventos y proyectos. Reservado para ajustes excepcionales.

**Contratos (`contracts/reputation.js`):**
```js
// El contrato valida actividad de la wallet antes de acreditar (cross-contract → WalletRegistry)
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

**Nota:** El contrato tiene guard de underflow — si `delta > reputación actual` hace panic. Pre-validar con `getReputation` antes de llamar.

**Contratos (`contracts/reputation.js`):**
```js
// Guard interno: delta > current → panic. Pre-validar con getReputation.
removeReputation(adminKeypair, userPublicKey, category, delta)
```

---

## conversationRoutes

> Canales de comunicación entre reclutador y freelancer en el contexto de un proyecto o evento.

---

### `GET /conversations`

Lista las conversaciones del usuario autenticado.

**Auth:** JWT requerido.

**Lógica:** consulta DB filtrando por participante (`publicKey` del JWT).

**Contratos:** ninguno.

---

### `GET /conversations/:conversationId`

Retorna los metadatos de una conversación (participantes, tipo de contexto: proyecto o evento, `contextId`).

**Auth:** JWT requerido. Solo participantes de la conversación.

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
1. Validar que ambas partes pertenezcan al proyecto/evento indicado (consulta DB).
2. Crear conversación en DB si no existe ya para ese contexto (upsert).

**Contratos:** ninguno directo (la pertenencia al contexto se verifica desde DB indexada).

---

## messageRoutes

> Mensajes dentro de una conversación. Soporta texto plano y evidencia (links, archivos).

---

### `GET /conversations/:conversationId/messages`

Retorna los mensajes de una conversación, paginados.

**Auth:** JWT requerido. Solo participantes de la conversación.

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
3. Disparar notificación en tiempo real (WebSocket / push notification).

**Contratos:** ninguno.

---

## notificationRoutes

> Notificaciones del sistema. Son disparadas por el indexer on-chain o por la lógica de negocio del backend al detectar cambios de estado relevantes.

---

### `GET /notifications`

Retorna las notificaciones del usuario autenticado, paginadas. Soporta filtro por `read`.

**Auth:** JWT requerido.

**Contratos:** ninguno (lectura desde DB).

---

### `PATCH /notifications/:notificationId/read`

Marca una notificación como leída.

**Auth:** JWT requerido. Solo el propietario de la notificación.

**Contratos:** ninguno.

---

### `PATCH /notifications/read-all`

Marca todas las notificaciones del usuario autenticado como leídas.

**Auth:** JWT requerido.

**Contratos:** ninguno.

---

### Eventos que disparan notificaciones (generados internamente)

El backend crea notificaciones automáticamente al detectar los siguientes cambios de estado:

| Evento                         | Destinatario         | Mensaje sugerido                                       |
|--------------------------------|----------------------|--------------------------------------------------------|
| Nuevo evento creado            | Freelancers activos  | "Hay un nuevo evento en tu categoría: {title}"         |
| Aplicación recibida            | Reclutador           | "{freelancer} aplicó a tu evento {title}"              |
| Ganadores seleccionados        | Todos los participantes | "Los ganadores de {title} han sido anunciados"      |
| Proyecto propuesto             | Freelancer           | "Tienes una nueva propuesta de proyecto"               |
| Proyecto aceptado              | Reclutador           | "{freelancer} aceptó el proyecto"                      |
| Entrega recibida               | Reclutador           | "{freelancer} marcó el proyecto como entregado"        |
| Corrección solicitada          | Freelancer           | "El reclutador solicitó correcciones"                  |
| Entrega aprobada               | Freelancer           | "Tu entrega fue aprobada. Fondos liberados."           |
| Disputa abierta                | Admin + ambas partes | "Se abrió una disputa en el proyecto #{id}"            |
| Disputa resuelta               | Ambas partes         | "La disputa fue resuelta: {resultado}"                 |
| Pago recibido                  | Freelancer           | "Recibiste {amount} MXNe"                              |
| Reputación actualizada         | Usuario              | "Tu reputación en {category} cambió: +{delta} puntos" |

---

## categoryRoutes

> Categorías de habilidades disponibles en la plataforma (design, dev, marketing, etc.). Son la base del sistema de reputación segmentada por categoría.

---

### `GET /categories`

Retorna la lista de todas las categorías disponibles.

**Auth:** ninguna (endpoint público).

**Lógica:** lectura desde DB o configuración estática.

**Contratos:** ninguno (las categorías son strings `Symbol` en los contratos; no requieren registro on-chain).

---

### `POST /categories`

Crea una nueva categoría (solo admin).

**Auth:** JWT requerido. Rol `Admin`.

**Body:**
```json
{ "slug": "marketing", "label": "Marketing Digital", "icon": "📣" }
```

**Contratos:** ninguno.

---

## Resumen de contratos por módulo

| Módulo                | Funciones de contrato usadas                                                                      |
|-----------------------|---------------------------------------------------------------------------------------------------|
| `authRoutes`          | Ninguna                                                                                           |
| `userRoutes`          | `getReputation`, `isBanned`, `getEvent`, `getProject`                                             |
| `walletRoutes`        | Token SAC (MXNe), Horizon API                                                                     |
| `eventRoutes`         | `createEvent`, `applyToEvent`, `submitEntry`, `selectWinners`, `timeoutDistribute`, `getEvent`    |
| `projectRoutes`       | `createProject`, `acceptProject`, `submitDelivery`, `approveDelivery`, `requestCorrection`, `rejectDelivery`, `getProject` |
| `disputeRoutes`       | `resolveDispute`, `getProject`                                                                    |
| `reputationRoutes`    | `getReputation`, `isBanned`, `addReputation`, `removeReputation`, `shadowban`, `unban`            |
| `conversationRoutes`  | Ninguna                                                                                           |
| `messageRoutes`       | Ninguna                                                                                           |
| `notificationRoutes`  | Ninguna (disparadas por indexer o lógica de negocio)                                              |
| `categoryRoutes`      | Ninguna                                                                                           |

---

## Estructura de carpeta `contracts/` sugerida

```
contracts/
├── reputation.js      → getReputation, isBanned, addReputation, removeReputation, shadowban, unban
├── event.js           → createEvent, applyToEvent, submitEntry, selectWinners, timeoutDistribute, getEvent
├── project.js         → createProject, acceptProject, submitDelivery, approveDelivery,
│                        requestCorrection, rejectDelivery, resolveDispute,
│                        timeoutApprove, timeoutRefund, getProject
└── walletRegistry.js  → isActiveByWallet, getRoleByWallet
```

> Las funciones de cada archivo siguen exactamente los patrones definidos en `consume_contracts.md`, usando `invokeContract` para escrituras y `queryContract` para lecturas, ambos importados desde `soroban.helper.js`.
