# ReputationLedger

### Descripción

`ReputationLedger` es el contrato inteligente encargado de gestionar la reputación de los usuarios dentro de la plataforma Nuv.

Actúa como la **fuente única de verdad (single source of truth)** para la reputación, almacenando de forma inmutable los puntajes por usuario y categoría en la blockchain.

Este contrato no contiene lógica de negocio; únicamente registra y expone cambios de reputación generados por otros contratos como `EventContract` y `ProjectContract`.

Las funciones de este contrato son accedidas únicamente por el administrador del sistema y los contratos inteligentes desplegados y autorizados

---

## Modelo de Datos

| Claves del contrato       | Tipo      | Descripción                                               |
|------                     |------     |------------                                               |
| `Admin`                   | `Address` | Dirección de la plataforma (control total del contrato)   |
| `Rep(Address, Symbol)`    | `u32`     | Reputación de un usuario por categoría                    |
| `Banned(Address)`         | `bool`    | Indica si el usuario está baneado                         |
| `Authorized(Address)`     | `bool`    | Indica si el contrato que llama al método está baneado    |

---

## Control de Acceso

- Solo la **wallet de la plataforma (admin)** puede:
    - Modificar reputación
    - Aplicar shadowban
- Contratos autorizados (`EventContract`, `ProjectContract`) también podrán modificar reputación
    - El administrador es quien registra los contratos como autorizados

---

## Funciones del contrato

---

### `initialize`

```rust
initialize(admin: Address)

Inicializa `DataKey` con el valor de `Admin` = `admin`, la dirección ingresada tendrá los derechos sobre todas las funcionalidades


### `get_admin`

```rust
get_admin() -> Address

Devuelve la dirección del administrador actual registrado

### 

### `authorize_contract`

```rust
authorize_contract(contract: Address)

Autoriza a un contrato para interactuar con el Reputation Ledger.

Solo el administrador puede ejecutar esta función.

### `get_reputation`

```rust
get_reputation(user: Address, category: Symbol) -> u32

Devuelve la reputación de un usuario en una categoría específica.

Si el usuario no tiene reputación registrada, retorna 0.

### `is_banned`

```rust
is_banned(user: Address) -> bool

Indica si un usuario está baneado.

Retorna true si está baneado, false en caso contrario.

### `add_reputation`

```rust
add_reputation(caller: Address, user: Address, category: Symbol, delta: u32)

Incrementa la reputación de un usuario en una categoría.

Solo puede ser ejecutada por el administrador.

### `remove_reputation`

```rust
remove_reputation(caller: Address, user: Address, category: Symbol, delta: u32)

Reduce la reputación de un usuario en una categoría.

Solo puede ser ejecutada por el administrador.

### `shadowban`

```rust
shadowban(caller: Address, user: Address)

Marca a un usuario como baneado.

Solo el administrador puede ejecutar esta función.

### `unban`

```rust
unban(caller: Address, user: Address)

Revierte el estado de baneo de un usuario.

Solo el administrador puede ejecutar esta función.

# EventContract

### Descripción

`EventContract` es el contrato inteligente encargado de gestionar eventos/competencias dentro de la plataforma Nuv.

Permite a los reclutadores crear convocatorias con un premio en escrow, recibir aplicaciones de freelancers, evaluar entregables y distribuir recompensas a los ganadores. También actualiza automáticamente la reputación de los participantes mediante llamadas cruzadas al contrato `ReputationLedger`.

---

## Modelo de Datos

### `EventData`

| Campo              | Tipo                        | Descripción                                              |
|--------------------|-----------------------------|----------------------------------------------------------|
| `recruiter`        | `Address`                   | Cuenta del reclutador que creó el evento                 |
| `prize`            | `i128`                      | Premio total depositado en escrow                        |
| `category`         | `Symbol`                    | Categoría del evento (usada para reputación)             |
| `deadline_submit`  | `u64`                       | Timestamp límite para enviar entregables                 |
| `deadline_select`  | `u64`                       | Timestamp límite para seleccionar ganadores              |
| `status`           | `EventStatus`               | Estado actual del evento                                 |
| `applicants`       | `Vec<Address>`              | Lista de freelancers que aplicaron                       |
| `submissions`      | `Map<Address, BytesN<32>>`  | Mapa de freelancer → hash del entregable enviado         |

### `EventStatus`

| Variante    | Descripción                                              |
|-------------|----------------------------------------------------------|
| `Open`      | El evento está activo; se aceptan aplicaciones y envíos |
| `Closed`    | El evento cerró sin ganadores (timeout del reclutador)  |
| `Resolved`  | Ganadores seleccionados y premios distribuidos           |

### Claves de almacenamiento (`DataKey`)

| Clave             | Tipo      | Descripción                                        |
|-------------------|-----------|----------------------------------------------------|
| `Admin`           | `Address` | Dirección del administrador de la plataforma       |
| `Token`           | `Address` | Dirección del token de pago (XLM nativo o USDC)   |
| `ReputationAddr`  | `Address` | Dirección del contrato `ReputationLedger`          |
| `PlatformAddr`    | `Address` | Dirección que recibe la comisión de la plataforma  |
| `Counter`         | `u64`     | Contador auto-incremental para IDs de eventos      |
| `Event(u64)`      | `EventData` | Datos del evento identificado por su ID          |

---

## Control de Acceso

- El **reclutador** puede crear eventos y seleccionar ganadores de sus propios eventos.
- Los **freelancers** pueden aplicar a eventos y enviar entregables.
- La función `timeout_distribute` puede ser llamada por **cualquier cuenta** una vez vencido el plazo de selección.
- La distribución de premios y la actualización de reputación son ejecutadas **automáticamente** por el contrato al resolver un evento.

---

## Flujo del Evento
```
create_event → apply_to_event → submit_entry → select_winners
                                                     ↓ (si no ocurre antes del deadline_select)
                                              timeout_distribute
```

---

## Funciones del contrato

---

### `initialize`
```rust
initialize(admin: Address, token: Address, reputation_addr: Address, platform_addr: Address)
```

Inicializa el contrato con las direcciones esenciales. Solo puede ejecutarse una vez; llamadas posteriores generan un panic.

Registra el `admin`, el token de pago (`token`), la dirección del contrato de reputación (`reputation_addr`) y la dirección de la plataforma que recibirá comisiones (`platform_addr`).

---

### `create_event`
```rust
create_event(recruiter: Address, prize: i128, category: Symbol, deadline_submit: u64, deadline_select: u64) -> u64
```

Crea un nuevo evento y transfiere el `prize` al contrato en escrow. Retorna el `event_id` único generado.

Requisitos:
- `prize` debe ser mayor a 0.
- `deadline_submit` debe ser anterior a `deadline_select`.

---

### `apply_to_event`
```rust
apply_to_event(event_id: u64, freelancer: Address)
```

Registra a un freelancer como participante de un evento.

Requisitos:
- El evento debe estar en estado `Open`.
- El timestamp actual debe ser anterior a `deadline_submit`.
- El freelancer no puede haber aplicado previamente.

---

### `submit_entry`
```rust
submit_entry(event_id: u64, freelancer: Address, entry_hash: BytesN<32>)
```

Registra el entregable del freelancer como un hash de 32 bytes (huella del trabajo enviado).

Requisitos:
- El evento debe estar en estado `Open`.
- El timestamp actual debe ser anterior a `deadline_submit`.
- El freelancer debe haber aplicado previamente al evento.

---

### `select_winners`
```rust
select_winners(event_id: u64, winners: Vec<Address>)
```

El reclutador selecciona los ganadores del evento. Distribuye el premio y actualiza la reputación de todos los participantes.

**Distribución del premio:**
- Se cobra una comisión del **10%** a favor de la plataforma.
- El **90% restante** se divide equitativamente entre los ganadores.

**Actualización de reputación (vía `ReputationLedger`):**
- **Ganadores:** +10 puntos de reputación en la categoría del evento.
- **No ganadores que enviaron aplicación:** +1 punto de reputación en la categoría del evento.

Requisitos:
- Solo el reclutador del evento puede ejecutar esta función.
- El evento debe estar en estado `Open`.
- El timestamp actual debe ser igual o posterior a `deadline_submit`.
- La lista de ganadores no puede estar vacía.
- Cada ganador debe haber enviado un entregable.

---

### `timeout_distribute`
```rust
timeout_distribute(event_id: u64)
```

Si el reclutador no selecciona ganadores antes del `deadline_select`, cualquier cuenta puede invocar esta función para cerrar el evento. Los fondos son devueltos parcialmente al reclutador.

**Distribución en timeout:**
- Se cobra una comisión del **10%** a favor de la plataforma.
- El **90% restante** es devuelto al reclutador.

Requisitos:
- El evento debe estar en estado `Open`.
- El timestamp actual debe ser posterior a `deadline_select`.

---

### `get_event`
```rust
get_event(event_id: u64) -> EventData
```

Retorna los datos completos de un evento dado su `event_id`.

# ProjectContract

### Descripción

`ProjectContract` es el contrato inteligente encargado de gestionar proyectos privados dentro de la plataforma ProofWork.

A diferencia de `EventContract` (competencia abierta), un proyecto es un **acuerdo bilateral** entre un reclutador y un freelancer específico previamente asignado. El reclutador deposita el pago y una garantía en escrow, y el contrato gestiona el ciclo de vida completo: aceptación, entrega, correcciones, disputas y pagos.

---

## Modelo de Datos

### `ProjectData`

| Campo              | Tipo            | Descripción                                                        |
|--------------------|-----------------|--------------------------------------------------------------------|
| `recruiter`        | `Address`       | Cuenta del reclutador que creó el proyecto                         |
| `freelancer`       | `Address`       | Cuenta del freelancer asignado                                     |
| `amount`           | `i128`          | Pago principal por el trabajo                                      |
| `guarantee`        | `i128`          | Garantía adicional depositada por el reclutador                    |
| `deadline`         | `u64`           | Timestamp límite del proyecto                                      |
| `status`           | `ProjectStatus` | Estado actual del proyecto                                         |
| `delivery_hash`    | `BytesN<32>`    | Hash del entregable enviado (cero si aún no se ha enviado)         |
| `correction_count` | `u32`           | Número de rondas de corrección solicitadas (máximo 2)              |
| `category`         | `Symbol`        | Categoría del proyecto (usada para actualizar reputación)          |

### `ProjectStatus`

| Variante      | Descripción                                                              |
|---------------|--------------------------------------------------------------------------|
| `Created`     | Proyecto creado, esperando que el freelancer acepte                      |
| `Active`      | Freelancer aceptó, trabajo en curso                                      |
| `Delivered`   | Freelancer entregó, esperando revisión del reclutador                    |
| `Correcting`  | Reclutador solicitó correcciones, freelancer debe re-entregar            |
| `Disputed`    | Entrega rechazada, disputa abierta pendiente de resolución del admin     |
| `Completed`   | Proyecto aprobado y pago distribuido                                     |
| `Cancelled`   | Proyecto cancelado, fondos devueltos al reclutador                       |

### Claves de almacenamiento (`DataKey`)

| Clave            | Tipo          | Descripción                                        |
|------------------|---------------|----------------------------------------------------|
| `Admin`          | `Address`     | Dirección del administrador de la plataforma       |
| `Token`          | `Address`     | Dirección del token de pago                        |
| `ReputationAddr` | `Address`     | Dirección del contrato `ReputationLedger`          |
| `PlatformAddr`   | `Address`     | Dirección que recibe comisiones (reservada)        |
| `Counter`        | `u64`         | Contador auto-incremental para IDs de proyectos    |
| `Project(u64)`   | `ProjectData` | Datos del proyecto identificado por su ID          |

---

## Control de Acceso

| Función               | Quién puede ejecutarla                    |
|-----------------------|-------------------------------------------|
| `initialize`          | Admin (una sola vez)                      |
| `create_project`      | Cualquier reclutador                      |
| `accept_project`      | Solo el freelancer asignado               |
| `submit_delivery`     | Solo el freelancer asignado               |
| `approve_delivery`    | Solo el reclutador del proyecto           |
| `request_correction`  | Solo el reclutador del proyecto           |
| `reject_delivery`     | Solo el reclutador del proyecto           |
| `resolve_dispute`     | Solo el admin                             |
| `timeout_approve`     | Cualquier cuenta (tras vencer el deadline)|
| `timeout_refund`      | Cualquier cuenta (tras vencer el deadline)|
| `get_project`         | Cualquier cuenta (lectura pública)        |

---

## Flujo del Proyecto
```
create_project
      ↓
accept_project
      ↓
submit_delivery ←────────────────────────────┐
      ↓                                       │
      ├── approve_delivery → [Completed]      │
      │                                       │
      ├── request_correction (máx. 2) ────────┘
      │         ↓ (si se agotaron las rondas)
      └── reject_delivery → [Disputed]
                    ↓
             resolve_dispute
              ├── favor freelancer → [Completed]
              └── favor reclutador → [Cancelled]

Timeouts (cualquier cuenta puede invocarlos):
  - timeout_approve: si status = Delivered y deadline vencido → [Completed]
  - timeout_refund:  si status = Created   y deadline vencido → [Cancelled]
```

---

## Escrow y distribución de fondos

Al crear el proyecto, el reclutador deposita `amount + guarantee` en escrow.

| Escenario                        | Destino de los fondos                              |
|----------------------------------|----------------------------------------------------|
| Entrega aprobada                 | `amount + guarantee` → freelancer                  |
| Disputa resuelta a favor del freelancer | `amount + guarantee` → freelancer           |
| Disputa resuelta a favor del reclutador | `amount + guarantee` → reclutador          |
| Timeout sin aceptación (`Created`) | `amount + guarantee` → reclutador               |
| Timeout sin revisión (`Delivered`) | `amount + guarantee` → freelancer               |

> A diferencia de `EventContract`, `ProjectContract` **no cobra comisión de plataforma** en ningún escenario. La dirección `PlatformAddr` está reservada en el almacenamiento pero no se utiliza en la lógica actual.

---

## Funciones del contrato

---

### `initialize`
```rust
initialize(admin: Address, token: Address, reputation_addr: Address)
```

Inicializa el contrato. Solo puede ejecutarse una vez; llamadas posteriores generan un panic.

Registra el `admin`, el token de pago y la dirección del contrato de reputación.

---

### `create_project`
```rust
create_project(recruiter: Address, freelancer: Address, amount: i128, guarantee: i128, deadline: u64, category: Symbol) -> u64
```

Crea un nuevo proyecto y transfiere `amount + guarantee` al contrato en escrow. Retorna el `project_id` único generado.

Requisitos:
- `amount` debe ser mayor a 0.
- `guarantee` debe ser mayor o igual a 0.

---

### `accept_project`
```rust
accept_project(project_id: u64, freelancer: Address)
```

El freelancer asignado acepta el proyecto, activando el estado `Active`.

Requisitos:
- El proyecto debe estar en estado `Created`.
- Solo el freelancer registrado en el proyecto puede aceptar.

---

### `submit_delivery`
```rust
submit_delivery(project_id: u64, freelancer: Address, delivery_hash: BytesN<32>)
```

El freelancer envía su entregable como un hash de 32 bytes, cambiando el estado a `Delivered`.

Requisitos:
- Solo el freelancer asignado puede enviar.
- El proyecto debe estar en estado `Active` o `Correcting`.

---

### `approve_delivery`
```rust
approve_delivery(project_id: u64, recruiter: Address)
```

El reclutador aprueba la entrega. Transfiere `amount + guarantee` al freelancer y otorga +5 puntos de reputación en la categoría del proyecto.

Requisitos:
- Solo el reclutador del proyecto puede aprobar.
- El proyecto debe estar en estado `Delivered`.

---

### `request_correction`
```rust
request_correction(project_id: u64, recruiter: Address)
```

El reclutador solicita una ronda de correcciones, cambiando el estado a `Correcting`.

Requisitos:
- Solo el reclutador del proyecto puede solicitarlas.
- El proyecto debe estar en estado `Delivered`.
- No se pueden solicitar más de **2 rondas de corrección** en total.

---

### `reject_delivery`
```rust
reject_delivery(project_id: u64, recruiter: Address)
```

El reclutador rechaza la entrega definitivamente, abriendo una disputa (`Disputed`) para resolución del admin.

Requisitos:
- Solo el reclutador del proyecto puede rechazar.
- El proyecto debe estar en estado `Delivered`.

---

### `resolve_dispute`
```rust
resolve_dispute(project_id: u64, admin: Address, favor_freelancer: bool)
```

El admin resuelve una disputa abierta. Si `favor_freelancer` es `true`, el freelancer recibe `amount + guarantee` y +5 puntos de reputación. Si es `false`, los fondos son devueltos al reclutador.

Requisitos:
- Solo el admin registrado puede ejecutar esta función.
- El proyecto debe estar en estado `Disputed`.

---

### `timeout_approve`
```rust
timeout_approve(project_id: u64)
```

Si el reclutador no revisa una entrega antes del `deadline`, cualquier cuenta puede invocar esta función para auto-aprobar el proyecto. El freelancer recibe `amount + guarantee` y +5 puntos de reputación.

Requisitos:
- El proyecto debe estar en estado `Delivered`.
- El timestamp actual debe ser posterior al `deadline`.

---

### `timeout_refund`
```rust
timeout_refund(project_id: u64)
```

Si el freelancer nunca aceptó el proyecto antes del `deadline`, cualquier cuenta puede invocar esta función para devolver `amount + guarantee` al reclutador.

Requisitos:
- El proyecto debe estar en estado `Created`.
- El timestamp actual debe ser posterior al `deadline`.

---

### `get_project`
```rust
get_project(project_id: u64) -> ProjectData
```

Retorna los datos completos de un proyecto dado su `project_id`.