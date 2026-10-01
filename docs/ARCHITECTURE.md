# Arquitectura de NeirApp

Marketplace local de Neira, Caldas: tiendas con catálogo en línea, clientes que compran de varias
tiendas a la vez y repartidores que recogen y entregan. Este documento es la referencia de diseño.

**Implementado:** Fase 0 (monorepo, módulo `identity`), Fase 1 (mapa de Neira, módulo `stores` con
catálogo, carrito multi-tienda, búsqueda, panel del comercio), Fase 2 (módulo `ordering`: pedidos
multi-tienda, pago con pasarela intercambiable, notificaciones en vivo al comercio, backoffice de
aprobación de tiendas), Fase 3 (módulos `dispatch` y `wallet`: repartidores, entregas, billetera) y
Fase 4 (búsqueda con relevancia real, módulos `reviews` e `incidents`) y Fase 5 (app nativa de
repartidor en Expo/React Native, `apps/mobile`). Pendiente: promociones (Fase 4, fuera de alcance a
propósito) y empaquetar cliente/comercio como app instalable (Fase 5, ver "Camino a la app móvil").

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Estilo de backend | Monolito modular (Clean/Hexagonal por módulo) | Un solo municipio, equipo pequeño. Los módulos quedan aislados y se pueden extraer a servicio si hace falta. |
| Backend | FastAPI + Python 3.12, SQLAlchemy 2 (async), Alembic, Pydantic v2 | — |
| Base de datos | PostgreSQL + PostGIS (SQLite solo para tests) | Geocercas, distancias y búsqueda de texto sin servicios extra. |
| Cache/colas/tiempo real | Redis | Pub/sub de WebSockets, rate limiting, locks, broker de Celery. |
| Frontend | React + TypeScript + Vite, PWA mobile-first | — |
| App móvil futura | Monorepo compartiendo tipos, cliente API, validaciones y design tokens | Ver "Camino a móvil". |
| Contrato API↔Web | OpenAPI → cliente TypeScript generado (`packages/api-client`) | El front nunca escribe fetch a mano ni se desincroniza del back. |
| Mapa | MapLibre GL, estilo propio sin tiles externos (ver "Mapa" más abajo) | Para no parecer Google Maps; funciona offline y sin costo de tiles. |

## Estructura del monorepo

```
apps/
  api/            # FastAPI (ver detalle abajo)
  web/            # React PWA
  mobile/         # Expo/React Native — app de repartidor (Fase 5, ver "Camino a la app móvil")
packages/
  api-client/     # Cliente TS generado desde openapi.json (fuente: apps/api)
  design-tokens/  # Colores, tipografía, radios (identidad "Neira Store")
infra/
  docker-compose.yml  # Postgres+PostGIS, Redis, MinIO, Mailpit (servicios de apoyo)
```

## Backend: capas por módulo

Cada módulo de negocio (`apps/api/src/neirapp/modules/<módulo>/`) es un bounded context con 4
capas, dependencia apuntando siempre hacia adentro:

```
domain/          # entidades, value objects, errores. Python puro: sin FastAPI, SQLAlchemy ni Pydantic.
application/     # casos de uso + puertos (Protocol). No importa web ni ORM.
infrastructure/  # repos SQLAlchemy, hashing, JWT: implementan los puertos de application/.
presentation/    # router FastAPI, schemas Pydantic, dependencias de inyección.
```

`shared/` tiene el kernel común (errores base, `Base`/`UTCDateTime` de SQLAlchemy, puerto `Clock`).
`bootstrap/` es el *composition root*: `container.py` conecta puertos con adaptadores concretos,
`app.py` construye la instancia de FastAPI.

**Reglas verificadas por CI** (`apps/api/pyproject.toml`, sección `[tool.importlinter]`):
1. Dentro de un módulo, `presentation`/`infrastructure` → `application` → `domain` (nunca al revés).
2. `domain` no importa FastAPI, SQLAlchemy, Pydantic, JWT ni Argon2.
3. `application` no importa FastAPI ni SQLAlchemy (sí puede usar Pydantic si hiciera falta un DTO).

Los módulos no se importan tablas ni repos entre sí; se comunican por puertos explícitos o (para
flujos de varios módulos, aún no implementado) eventos de dominio + outbox transaccional.

## Módulo `identity` (implementado)

Cubre lo que pedía el enunciado del cliente: registro con datos de contacto, aceptación de
términos y política de privacidad (una vez, versionada), login, roles (`customer`, `courier`,
`store_staff`, `admin` — un usuario puede tener varios) y sesiones.

- **Contraseñas**: Argon2id (`argon2-cffi`), hasheo en un hilo aparte para no bloquear el loop.
- **Sesión**: access token JWT de vida corta (15 min) + refresh token opaco (30 días), guardado
  hasheado (SHA-256) en base de datos. El refresh **rota** en cada uso; reusar uno ya rotado revoca
  toda la cadena (`family_id`) — mitiga robo de refresh token.
- **Términos y condiciones**: `TermsPolicy` en `Settings` define la versión vigente de cada
  documento. `identity_terms_acceptances` guarda cada aceptación con versión, fecha e IP. Si la
  versión vigente cambia, `must_accept_terms` vuelve a `true` en el perfil y el front bloquea la
  app con `TermsGate` hasta que el usuario re-acepte. `GET /identity/terms` expone las versiones
  vigentes (público, sin auth) para que el front sepa qué mostrar.
- **Errores**: todo error de dominio hereda de `DomainError` con un `code` estable
  (`email_already_registered`, `invalid_credentials`, …) y se traduce a `application/problem+json`
  (RFC 7807) en `shared/presentation/errors.py`. El front los muestra vía `ApiError`.

### Endpoints (`/api/v1/identity`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/register` | — | Crea cliente, registra aceptación de términos, devuelve sesión. |
| POST | `/login` | — | Mismo error para correo inexistente o clave incorrecta (no filtra cuáles existen). |
| POST | `/refresh` | — | Rota el refresh token. |
| POST | `/logout` | — | Idempotente. |
| GET | `/me` | Bearer | Perfil + `must_accept_terms`. |
| PATCH | `/me` | Bearer | Actualiza nombre/teléfono. |
| GET | `/terms` | — | Versiones vigentes de los documentos legales. |
| POST | `/terms/accept` | Bearer | Exige que `version` sea la vigente. |

## Módulo `stores` (implementado)

Cubre el catálogo en línea de cada tienda y el "buscador inteligente" (versión simple). **Decisión
deliberada:** a diferencia del plan original (`stores` y `catalog` como módulos separados), aquí
`Store` y `Product` viven en un solo módulo `stores`. Son entidades pequeñas, muy acopladas (todo
acceso a un producto pasa por validar el dueño de su tienda) y separarlas habría significado
inventar un puerto entre módulos para una necesidad que hoy no existe (YAGNI). Si `catalog` crece
(variantes, inventario, varias fotos) se puede extraer como módulo propio sin tocar `identity` ni
el resto del sistema — los repos ya son intercambiables detrás de sus puertos.

- **Geocerca de Neira**: `domain/geofence.py` valida con un punto-en-polígono (ray casting, Python
  puro, sin PostGIS) que la tienda quede dentro de un rectángulo aproximado del municipio. Es un
  placeholder documentado en el propio archivo — el polígono real del municipio llega con datos de
  OSM (ver "Riesgos abiertos"). Se aplica al crear la tienda y al reubicarla.
- **Dueño de la tienda**: cualquier usuario autenticado puede abrir una tienda (es dueño desde que
  la crea); no hay rol `store_staff` ni aprobación de un admin todavía. La autorización para editar
  el catálogo compara `store.owner_user_id` contra el usuario autenticado — más simple que un rol
  global, y suficiente mientras no haya varios empleados por tienda.
- **Acoplamiento entre módulos, solo en el borde**: `stores/presentation` reutiliza el `CurrentUser`
  de `identity/presentation` para autenticar (composición al nivel de FastAPI, no de dominio). Dos
  contratos de `import-linter` (`identity no depende de stores`, `dominio/aplicación de stores no
  depende de identity`) verifican en CI que la dependencia es de un solo sentido.
- **Búsqueda inteligente (Fase 4)**: `LIKE` sobre nombre de producto, descripción **y nombre de la
  tienda** (buscar "Pizzeria Napoli" encuentra su catálogo aunque ningún producto se llame así),
  con filtro por categoría y precio máximo. La relevancia ya no es un orden alfabético disfrazado:
  `_relevance_score` (`infrastructure/repositories.py`) arma un `CASE` de SQL que pondera nombre de
  producto exacto > empieza así > nombre de tienda coincide > nombre de producto contiene > tienda
  contiene > solo la descripción contiene, portable entre SQLite (tests) y Postgres (prod) sin
  extensiones. Etapa siguiente si hace falta tolerar errores de tipeo y sinónimos: `tsvector` +
  `pg_trgm`, o un motor dedicado (Meilisearch/Typesense) detrás del mismo `ProductRepository.search`.
- **Dinero**: `price_cop` es un entero (el peso colombiano no usa decimales), validado en el dominio
  (`0 < price_cop <= 50_000_000`).
- **Backoffice de aprobación** (Fase 2): una tienda nace con `is_approved=False` y solo aparece en
  el mapa, la búsqueda o su propia página pública una vez que un admin la aprueba
  (`PATCH /stores/{id}/approval`, protegido con `require_roles(Role.ADMIN)` de `identity`). El
  dueño puede seguir viendo y administrando su tienda mientras está pendiente (`GET /stores/me` no
  filtra por aprobación). **Lección de esta fase:** la primera versión solo tenía `is_approved:
  bool`, así que "aprobar" y "rechazar" dejaban el mismo valor (`False`) y una tienda rechazada
  nunca salía de la cola de pendientes del backoffice — un admin la rechazaba y, al recargar,
  seguía ahí. Se encontró probando el botón "Rechazar" de verdad en el navegador (ningún test
  automatizado cubría ese flujo). El arreglo agrega `is_rejected: bool`: `set_approved(True)` limpia
  el rechazo, `set_approved(False)` lo marca, y el listado de pendientes excluye
  `is_rejected=True`. No hay motivo/comentario del rechazo todavía — MVP.
- **Lectura interna sin filtrar** (`GetStoreRaw`, `GetProductRaw` en `stores/application/`): el
  módulo `ordering` necesita saber si una tienda existe y *por qué* no está disponible (no
  aprobada, cerrada), no solo un 404 genérico. Estos dos casos de uso nunca se exponen por HTTP;
  solo los usa el adaptador de `ordering` (ver más abajo).

### Endpoints (`/api/v1`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/stores` | Bearer | El usuario autenticado queda como dueño. |
| GET | `/stores` | — | Filtro opcional `category`. Solo tiendas aprobadas. Alimenta el mapa. |
| GET | `/stores/me` | Bearer | La tienda del usuario, o `null`. No filtra por aprobación. |
| GET | `/stores/pending` | Bearer, admin | Tiendas sin revisar (backoffice). |
| GET | `/stores/{id}` | — | 404 si no existe o no está aprobada. |
| PATCH | `/stores/{id}` | Bearer, dueño | Nombre/categoría/descripción. |
| PATCH | `/stores/{id}/open` | Bearer, dueño | Abrir/cerrar la tienda. |
| PATCH | `/stores/{id}/approval` | Bearer, admin | Aprobar o rechazar (backoffice). |
| GET | `/stores/{id}/products` | — | Filtro opcional `only_available`. |
| POST/PATCH/DELETE | `/stores/{id}/products/...` | Bearer, dueño | CRUD del catálogo. |
| PATCH | `/stores/{id}/products/{id}/availability` | Bearer, dueño | Agotado/disponible. |
| GET | `/products/search` | — | `q`, `category`, `max_price_cop`, `sort`. Solo tiendas aprobadas. |

## Módulo `ordering` (implementado, Fase 2)

Pedidos multi-tienda: el cliente arma un carrito con productos de varias tiendas, paga una vez por
el total y cada tienda recibe y gestiona su parte por separado.

- **`Order` → `StoreOrder` → `OrderLine`**: un pedido tiene un `StoreOrder` por cada tienda
  involucrada, cada uno con su propia máquina de estados: `pending_payment → paid → accepted|
  rejected → preparing → ready`. `ready` es terminal en esta fase — entregarle el pedido a un
  repartidor (`HANDED_OVER`) es la Fase 3 (módulo `dispatch`, no existe aún). Las transiciones
  inválidas (aceptar algo no pagado, marcar listo algo rechazado) se rechazan explícitas con
  `InvalidStoreOrderTransition`, verificado con una tabla `_TRANSITIONS` en el dominio.
- **El precio siempre sale del catálogo, nunca del cliente**: `OrderItemRequest` no tiene ningún
  campo de precio — es estructuralmente imposible mandar uno. `CreateOrder` lee nombre/precio
  vigentes del producto en el instante del pedido y los copia a `OrderLine` (snapshot inmutable);
  si la tienda cambia el precio después, los pedidos ya hechos no se alteran.
- **`CatalogPort`** (`application/ports.py`): capa anticorrupción hacia `stores`. `ordering` nunca
  importa las entidades ni los repos de `stores`, solo dos snapshots de solo lectura
  (`StoreSnapshot`, `ProductSnapshot`). El adaptador real (`infrastructure/catalog_adapter.py`)
  vive en infraestructura y es el único archivo de todo el módulo que sabe que `stores` existe —
  dos contratos de `import-linter` lo verifican (`el dominio/aplicación de ordering no depende de
  stores ni identity`, `stores no depende de ordering`).
- **`store_owner_user_id` va copiado en cada `StoreOrder`** (no se relee de `stores` en cada
  acción): aceptar/rechazar/preparar/marcar-listo autorizan comparando ese campo contra el usuario
  autenticado, sin ida y vuelta al módulo `stores`. Solo `ListStoreOrders` (listar pedidos de una
  tienda que quizás no tiene ninguno todavía) necesita `CatalogPort` para saber quién es el dueño.
- **Pago**: puerto `PaymentGateway` (`charge(order_id, amount_cop) -> bool`), con
  `FakePaymentGateway` como adaptador de desarrollo (aprueba siempre, al instante, sin redirección
  ni tarjeta). Un cobro cubre el pedido completo aunque tenga varias tiendas — la dispersión del
  dinero a cada una, descontando comisión, es la Fase 3 (`wallet`); aquí solo se confirma el cobro.
  Cambiar a una pasarela real (Wompi, ePayco, Mercado Pago) es un adaptador nuevo detrás del mismo
  puerto; una integración real necesitaría además un flujo asíncrono (checkout → redirección →
  webhook firmado e idempotente) en vez de una respuesta síncrona — ver "Riesgos abiertos".
- **Notificaciones en vivo al comercio**: `WS /stores/{id}/orders/ws` (FastAPI WebSocket nativo).
  `ConnectionManager` (en `presentation/`, no en `infrastructure/` — administrar objetos
  `WebSocket` crudos es un detalle de transporte web, no un adaptador a un servicio externo) es una
  sola instancia compartida: el router la usa directo para `connect`/`disconnect`, y se le pasa a
  `PayOrder` como implementación (estructural) del puerto `StoreNotifier`. El mensaje es solo un
  aviso ("algo cambió") — el cliente siempre vuelve a pedir el estado real por REST, nunca confía
  en el payload del socket. Alcanza para un solo proceso; con varias instancias en producción hace
  falta pub/sub (Redis) para que la notificación llegue sin importar en cuál instancia esté
  conectado el comercio.
- **Autenticación del WebSocket**: el navegador no puede mandar headers en el *handshake* de un
  WebSocket, así que el access token va en la query string (`?token=...`). Es una simplificación
  conocida — un token de corta duración en una URL puede quedar en logs del servidor o del proxy;
  antes de producción conviene un *ticket* de un solo uso de vida cortísima en vez del JWT completo.

### Endpoints (`/api/v1`)

| Método/protocolo | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/orders` | Bearer | Crea el pedido desde el carrito (`pending_payment`). |
| GET | `/orders` | Bearer | Los pedidos del cliente autenticado. |
| GET | `/orders/{id}` | Bearer, dueño | Detalle de un pedido propio. |
| POST | `/orders/{id}/pay` | Bearer, dueño | Cobra y marca cada `StoreOrder` como `paid`. |
| GET | `/stores/{id}/orders` | Bearer, dueño de la tienda | Filtro opcional `status`. |
| POST | `/store-orders/{id}/accept` | Bearer, dueño de la tienda | `paid → accepted`. |
| POST | `/store-orders/{id}/reject` | Bearer, dueño de la tienda | `paid → rejected`. |
| POST | `/store-orders/{id}/preparing` | Bearer, dueño de la tienda | `accepted → preparing`. |
| POST | `/store-orders/{id}/ready` | Bearer, dueño de la tienda | `preparing → ready`. |
| WS | `/stores/{id}/orders/ws?token=` | Query token, dueño de la tienda | Aviso de pedido nuevo. |

## Módulos `dispatch` y `wallet` (implementados, Fase 3)

Reparto de pedidos por repartidores independientes y su billetera de ganancias.

### `dispatch`

- **`CourierProfile`**: se crea con `is_verified=False`; un admin lo aprueba (`PATCH
  /couriers/{id}/verification`) antes de que el repartidor pueda ver o tomar pedidos —
  `_require_verified_courier` en `application/deliveries.py` es el único punto que gatea esto.
  Deliberadamente **no** se usa un rol de `identity` (`Role.COURIER`): eso habría requerido un
  nuevo puerto cruzado `IdentityPort.grant_role`; en vez de eso, dispatch gatea por su propio
  `CourierProfile.is_verified`, y un usuario sin perfil (o no verificado) simplemente no puede
  reclamar entregas — el resto de la app no necesita saber que alguien es repartidor.
- **`Delivery` / `DeliveryStop`**: una entrega tiene una parada por cada `StoreOrder` del pedido
  (varias tiendas → varias recogidas, una sola entrega final al cliente). Máquina de estados simple:
  `assigned → delivered | cancelled` (ambos terminales). Cada `DeliveryStop` lleva su propio código
  de recogida (`pickup_code`); la entrega completa tiene un `delivery_code` separado que ve el
  cliente, no el repartidor.
- **Reclamar un pedido es atómico vía restricción de base de datos, no un lock aplicativo**:
  `dispatch_deliveries.order_id` es `unique`. `ClaimDelivery` arma el `Delivery` en memoria, intenta
  insertarlo, y si otro repartidor ganó la carrera el `IntegrityError` se traduce a
  `OrderAlreadyClaimed()` (mismo patrón que `EmailAlreadyRegistered` en `identity`, Fase 0). No hace
  falta ningún `SELECT ... FOR UPDATE`: dos repartidores pueden intentar el mismo pedido a la vez y
  solo uno gana, sin condiciones de carrera.
- **Quién confirma cada código**: la **tienda** confirma la recogida (recibe el código de manos del
  repartidor y lo escribe en su panel — `POST /deliveries/store-orders/{store_order_id}/confirm-
  pickup`), y el **repartidor** confirma la entrega final (recibe el código del cliente —
  `POST /deliveries/{delivery_id}/confirm-delivery`). Ninguno de los dos endpoints vuelve a llamar a
  `stores` para autorizar: `store_owner_user_id` va copiado en cada `DeliveryStop` desde el momento
  de reclamar (vía `StoresPort.get_store`), el mismo patrón que `ordering` usa con sus `StoreOrder`.
- **Capas anticorrupción**: `StoresPort`, `OrderingPort` y `WalletPort` (`application/ports.py`) son
  los únicos puntos por los que `dispatch` sabe que esos módulos existen; los adaptadores concretos
  (`infrastructure/{stores,ordering,wallet}_adapter.py`) son infraestructura, no dominio ni
  aplicación — verificado por `import-linter`. `OrderingPort.get_order_customer_id(order_id)` existe
  solo para que el cliente pueda consultar su código de entrega a partir del `order_id` que ya
  conoce (no tiene forma de saber el `delivery_id`).
- **`suggest_route` (heurística de vecino más cercano)**: sin GPS en vivo del repartidor, la "ruta
  óptima" real no se puede calcular — no se sabe desde dónde arranca. Arranca en la primera parada
  tal como llega del backend y visita las demás por cercanía (Haversine), terminando en la
  dirección de entrega. No resuelve el TSP de forma óptima (NP-difícil) pero para las pocas paradas
  de un pedido típico da una ruta razonable; reemplazar por un motor real (OSRM, Valhalla) es la
  evolución natural.
- **`compute_earnings_cop` (tarifa plana + por parada)**: modelo de ingresos deliberadamente simple
  (`domain/pricing.py`), placeholder explícito para una decisión de negocio pendiente (tarifa por
  distancia, comisión, o ambas). Todo lo que depende de esto llama a esta función, nunca calcula el
  número por su cuenta.
- **Códigos sin hashear**: a diferencia de los refresh tokens de `identity` (SHA-256 hasheados), los
  códigos de recogida/entrega se guardan en texto plano (`domain/codes.py`, alfabeto sin
  0/O/1/I/L vía `secrets.choice()`). El riesgo es distinto: un refresh token filtrado da acceso
  indefinido a una cuenta; un código de recogida filtrado solo sirve para una única confirmación de
  una entrega específica, ya autenticada y autorizada por otros medios (`store_owner_user_id`,
  `is_owned_by_courier`) — el código es una prueba de "estuviste físicamente ahí", no una credencial.
- **Decisión de fusión**: el perfil de repartidor vive dentro de `dispatch` (no es un módulo propio)
  por la misma razón que `payments` se fusionó en `ordering` en la Fase 2 — no hay suficiente
  complejidad propia todavía para justificar el costo de otro módulo con sus propias capas.

### `wallet`

- **El saldo nunca se guarda editable**: siempre se calcula sumando `LedgerEntry.signed_amount_cop`
  (`compute_balance`, `domain/entities.py`) — créditos suman, débitos restan. Una fila mal escrita
  no puede "perder" plata sin dejar rastro: el histórico completo es la única fuente de verdad
  (estilo ledger de doble entrada, aunque aquí es de una sola columna por simplicidad).
- **`wallet` no depende de ningún otro módulo** (ni siquiera de `dispatch`): `CreditCourier` recibe
  un `courier_id: UUID` desnudo y un `reason`/`reference_id` de texto — no sabe qué es una entrega ni
  qué es un pedido. Es `dispatch` quien llama a `WalletPort.credit_courier` al confirmar una entrega
  (vía `infrastructure/wallet_adapter.py`), nunca al revés. Es el módulo con el contrato de
  aislamiento más estricto de toda la app (ver el contrato de import-linter dedicado), acorde a que
  es el único que toca dinero.
- **Retiro sin pasarela real**: `RequestWithdrawal` valida contra el saldo actual y aplica el débito
  al instante — mismo placeholder que `FakePaymentGateway` en `ordering` (Fase 2). Conectar una
  pasarela de desembolso real (transferencia bancaria, Nequi, Daviplata) es la evolución natural,
  probablemente con un estado `pending` intermedio en vez de aplicar el débito de inmediato.
- **`GET /wallet/balance` y `/ledger` nunca reciben un `courier_id` del cliente**: siempre usan
  `user.id` del token autenticado. Un usuario que nunca ha repartido simplemente tiene saldo 0 y no
  puede retirar nada — no hace falta verificar aparte que sea repartidor para que el endpoint sea
  seguro (a diferencia de `dispatch`, que sí gatea explícitamente por `is_verified`).

### `courier_id` es el `user_id` de `identity`, no el id del `CourierProfile`

**Bug real encontrado en esta fase** (tests de integración, no en el navegador): `Delivery.courier_id`
se pobló inicialmente con `CourierProfile.id` (razonable a primera vista: es el id "propio" de
dispatch para un repartidor). Pero `WalletPort.credit_courier` recibe ese mismo `delivery.courier_id`
y lo pasa tal cual a `wallet`, cuyo `GET /wallet/balance` calcula el saldo por `user.id` del token —
un id completamente distinto. Resultado: `ConfirmDelivery` acreditaba saldo a un id que el propio
repartidor nunca podía consultar (el saldo se "perdía" silenciosamente). Un test de integración que
confirmaba el flujo completo (reclamar → recoger → entregar → **consultar saldo**) lo detectó de
inmediato; un test que solo verificara "la entrega se marcó como entregada" no lo habría notado.

La corrección: `_require_verified_courier` devuelve `user_id` (no `profile.id`), así que
`Delivery.courier_id` es el mismo id que usan `wallet` y el resto de la app para identificar al
usuario. Esto también simplificó `CancelDelivery`/`ConfirmDelivery` — ya no hace falta resolver el
`CourierProfile` solo para comparar contra `delivery.courier_id`, una comparación directa contra
`user_id` alcanza. Lección: cuando dos módulos comparten un identificador de usuario a través de un
puerto, ese identificador debe ser el mismo en ambos lados desde el día uno — un id "propio" del
módulo que por casualidad también identifica al mismo usuario es una trampa.

### Endpoints (`/api/v1`)

| Método/protocolo | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/couriers/me` | Bearer | Crea el perfil de repartidor (`is_verified=False`). |
| GET | `/couriers/me` | Bearer | El perfil propio, o `null` si no existe. |
| GET | `/couriers/pending` | Bearer, admin | Perfiles sin verificar. |
| PATCH | `/couriers/{id}/verification` | Bearer, admin | Aprueba/revoca un perfil. |
| GET | `/deliveries/available` | Bearer, repartidor verificado | Pedidos listos para reclamar. |
| POST | `/deliveries/{order_id}/claim` | Bearer, repartidor verificado | Atómico (ver arriba). |
| GET | `/deliveries/mine/active` | Bearer, repartidor | La entrega en curso, o `null`. |
| GET | `/deliveries/mine/history` | Bearer, repartidor | Entregas terminadas (entregadas/canceladas). |
| POST | `/deliveries/{id}/confirm-delivery` | Bearer, repartidor dueño | Con el código del cliente. |
| POST | `/deliveries/{id}/cancel` | Bearer, repartidor dueño | Cancela una entrega en curso. |
| POST | `/deliveries/store-orders/{id}/confirm-pickup` | Bearer, dueño de la tienda | Con el código del repartidor. |
| GET | `/deliveries/by-order/{order_id}` | Bearer, cliente dueño del pedido | Código de entrega y progreso. |
| GET | `/wallet/balance` | Bearer | Saldo del usuario autenticado. |
| GET | `/wallet/ledger` | Bearer | Historial de movimientos. |
| POST | `/wallet/withdrawals` | Bearer | Retira saldo (al instante, sin pasarela real). |

## Módulos `reviews` e `incidents` (implementados, Fase 4)

Fase 4 del roadmap original ("Pulir") agrupaba búsqueda inteligente, calificaciones, promociones e
incidencias; se implementaron las tres primeras salvo promociones (la más invasiva: tocaba el
cálculo de precios de `ordering`), a elección explícita al arrancar la fase. La búsqueda inteligente
quedó documentada en el módulo `stores` (arriba); esta sección cubre los dos módulos nuevos.

### `reviews`

- **Una calificación por `StoreOrder`, no por tienda "en general"**: `Review` referencia un
  `store_order_id` puntual (restricción única en la tabla, mismo patrón atómico que
  `dispatch_deliveries.order_id` en la Fase 3) — así no se puede calificar sin haber comprado, y a
  lo sumo una vez por pedido. El promedio de la tienda (`compute_rating_summary`) nunca se guarda
  editable: siempre se calcula sumando las calificaciones existentes.
- **Simplificación deliberada — gatea en `handed_over`, no en la entrega real**: `CreateReview`
  solo exige que el `StoreOrder` esté en `handed_over` (la tienda ya se lo entregó al repartidor),
  no que el cliente ya lo tenga en mano. Verificar la entrega real requeriría que `reviews` conociera
  a `dispatch`, y el estado "completado" que ya expone `ordering` (`handed_over`) es suficiente señal
  para el MVP — documentado aquí para que quede explícito, no accidental.
- **Capa anticorrupción hacia `ordering`**: `OrderingPort.get_store_order(store_order_id)`
  (`application/ports.py`) es el único punto por el que `reviews` sabe que `ordering` existe;
  reutiliza el `get_store_order` que ya existía en `OrderRepository` (`ordering`) exponiéndolo vía
  un nuevo caso de uso interno, `GetStoreOrderViewRaw` — mismo patrón que `GetOrderRaw` de `dispatch`.
- **`stores` no depende de `reviews`**: para evitar un ciclo (`reviews` ya depende de `ordering`,
  que a su vez usa `stores`), la página de una tienda combina dos llamadas independientes
  (`GET /stores/{id}` y `GET /reviews/stores/{id}/summary`) en el frontend, no en el backend. La
  composición vive en el borde, igual que en `dispatch` con `stores`/`ordering`/`wallet`.

### `incidents`

- **El reportero puede ser el cliente o el repartidor del pedido — nunca lo declara el cliente**:
  `ReportIncident._resolve_role` primero pregunta a `ordering` (¿sos el cliente de este pedido?) y
  si no, a `dispatch` (¿sos el repartidor de esta entrega?); si ninguno responde que sí, rechaza con
  `NotAuthorizedToReport`. El rol nunca llega en el body del request.
- **Dos capas anticorrupción, una por cada módulo que consulta**: `OrderingPort.
  get_order_customer_id` (idéntico en firma al de `dispatch`, pero declarado de nuevo aquí — cada
  módulo consumidor es dueño de su propio puerto, incluso si coincide con el de otro) y
  `DispatchPort.get_delivery_courier_user_id`, resuelto por un nuevo caso de uso interno en
  `dispatch` (`GetDeliveryCourierUserIdRaw`) que expone `Delivery.courier_id` — que, desde la
  corrección de la Fase 3, ya es el `user_id` de `identity` (ver más abajo), así que no hace falta
  traducir nada más.
- **Backoffice simple, sin SLA ni asignación**: un reporte nace `open` y un admin lo mueve a
  `resolved` o `dismissed` con una nota opcional (`Incident.resolve`, misma tabla de transiciones
  explícita que `StoreOrderStatus`/`DeliveryStatus`). No hay categorías de severidad, tiempos de
  respuesta ni asignación a un agente — backoffice de una sola cola, suficiente mientras el volumen
  de reportes sea bajo.

### Endpoints (`/api/v1`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/reviews` | Bearer, cliente dueño del pedido | Solo si el `StoreOrder` está `handed_over`. |
| GET | `/reviews/stores/{store_id}` | — | Todas las calificaciones de una tienda. |
| GET | `/reviews/stores/{store_id}/summary` | — | Promedio y cantidad. |
| POST | `/incidents` | Bearer, cliente o repartidor del pedido | El rol se infiere, no se declara. |
| GET | `/incidents/mine` | Bearer | Los reportes propios. |
| GET | `/incidents` | Bearer, admin | Filtro opcional `status`. |
| PATCH | `/incidents/{id}/resolve` | Bearer, admin | `resolved` o `dismissed` + nota opcional. |

## Frontend

`apps/web` (Vite + React 19 + TypeScript). Estructura *feature-based*:

```
src/
  app/        # router, providers (React Query)
  features/
    auth/     # store (Zustand+persist), sesión con refresh, páginas de login/registro, TermsGate
    stores/   # tipos, hooks de tiendas, mapa→tienda, crear tienda, panel "mi tienda"
    catalog/  # hooks de productos, tarjeta de producto, formulario, lista de gestión
    map/      # NeiraMap (MapLibre GL)
    search/   # página de búsqueda con filtros
    cart/     # carrito multi-tienda (Zustand+persist)
    orders/   # checkout, mis pedidos, panel de pedidos del comercio, WS en vivo
    dispatch/ # onboarding de repartidor, pedidos disponibles, entrega activa/historial, admin
    wallet/   # saldo, movimientos, retiro
    reviews/  # StarRating, calificar un StoreOrder, sección de reviews en la página de tienda
    incidents/# reportar un problema, mis reportes, backoffice de resolución
    admin/    # backoffice: aprobar/rechazar tiendas pendientes
    home/     # mapa + filtros por categoría
  lib/        # cliente API, manejo de errores, env, formato de moneda
  shared/ui/  # componentes de diseño (Button, TextField, Navbar, AuthLayout…)
  styles/     # Tailwind v4 + theme.css de @neirapp/design-tokens
```

### Mapa

`features/map/NeiraMap.tsx` usa MapLibre GL con un estilo propio: sin tiles externos, solo un
fondo del color de marca y un par de formas GeoJSON ilustrativas (vegetación, río) — ver el
comentario en el archivo sobre por qué son decorativas y no geografía real. Los marcadores de
tienda son componentes React (`StoreIcon`) renderizados a HTML estático (`react-dom/server`) e
insertados como `Marker({element})`; el color y el ícono salen de `@neirapp/design-tokens`. El
mismo componente sirve para "elegir ubicación" (`pickMode`) al crear una tienda.

**Vite + maplibre-gl:** el pre-bundler de Vite reescribe la ruta del Web Worker interno de
MapLibre y lo rompe (las capas GeoJSON no cargan, aunque el mapa base sí). Se resolvió con
`optimizeDeps: { exclude: ["maplibre-gl"] }` en `vite.config.ts`.

### Carrito

`features/cart/store.ts` (Zustand+persist) guarda el carrito por tienda — un pedido puede mezclar
varias tiendas, como pide el negocio. Es solo del cliente por ahora: no hay endpoint de carrito en
el backend (llega con `Order`/`StoreOrder` en la Fase 2). **Lección de esta fase:** las funciones
derivadas (`cartGroups`, `cartTotalCop`, …) reciben el `groups` crudo del store, nunca el store
completo — pasarlas directo como selector de `useCartStore(cartGroups)` construye un array nuevo
en cada lectura y `useSyncExternalStore` entra en un bucle infinito de renders. El patrón correcto:
seleccionar el estado crudo (referencia estable) y derivar con `useMemo` en el componente. Se
encontró en vivo en el navegador (ver "Riesgos abiertos" sobre por qué los tests con mocks no lo
detectaron) y quedó como comentario en `cart/store.ts` para no repetirlo.

### Pedidos y notificaciones en vivo

`features/orders/CheckoutPage.tsx` reusa `NeiraMap` en modo `pickMode` para elegir la ubicación de
entrega (el mismo componente que "elegir ubicación de la tienda" en Fase 1) y encadena
`POST /orders` → `POST /orders/{id}/pay`. `features/orders/StoreOrdersPage.tsx` es el panel del
comercio: pestañas por estado, botones de acción según el estado de cada `StoreOrder`, y
`useStoreOrdersSocket` conectado a `WS /stores/{id}/orders/ws` para el aviso en vivo (banner +
invalidación de la query — `useStoreOrders` además refresca cada 15 s como respaldo si la conexión
tarda en reestablecerse). `features/admin/AdminStoresPage.tsx` es el backoffice de aprobación.

**Lección de esta fase — el proxy de Vite no reenvía WebSockets por defecto:** el hook conectaba
sin error visible, pero el servidor nunca veía la conexión (0 notificaciones en los logs de
uvicorn, aunque REST funcionaba perfecto). La causa: `server.proxy: { "/api": "http://localhost:8000"
}` en `vite.config.ts` reenvía HTTP pero no el *upgrade* de WebSocket — sin `ws: true` explícito,
`ws://localhost:5173/api/...` se queda intentando conectar contra el propio Vite, que no tiene esa
ruta. Ni los tests del backend (que hablan con FastAPI directo) ni los del frontend (WebSocket
global mockeado) pasan por el proxy de desarrollo, así que ninguno lo detectaba — solo apareció
probando la app real en el navegador con la API y la web corriendo por separado. El arreglo:
`proxy: { "/api": { target: "http://localhost:8000", ws: true } }`.

- **Cliente API tipado**: `packages/api-client` se genera con `openapi-typescript` a partir del
  OpenAPI exportado por la API (`npm run gen:api-client` desde la raíz, o los scripts del paquete).
  Nunca se escriben fetch a mano contra la API.
- **Sesión** (`features/auth/session.ts`): el access token se renueva 30 s antes de vencer.
  Las llamadas concurrentes comparten una sola petición de refresh (*single-flight*), y entre
  pestañas se usa `navigator.locks` para que solo una refresque a la vez — necesario porque el
  servidor trata el reuso de un refresh token rotado como robo y revoca la sesión completa.
- **Formularios**: `react-hook-form` + `zod`, validando lo mismo que el backend (el backend es la
  fuente de verdad; la validación del front es solo para UX).
- **Identidad visual**: los tokens de `@neirapp/design-tokens` (colores, tipografía, radios) se
  exponen como utilidades de Tailwind vía `theme.css`. El mismo `tokens.ts` alimentará el estilo
  del mapa (Fase 1) y, más adelante, la app de React Native.

### Repartidor y billetera (Fase 3)

`features/dispatch/CourierOnboardingPage.tsx` crea el perfil y refleja su estado (pendiente/
verificado) sin recargar — `useMyCourierProfile` invalidado tras el `POST`.
`AvailableDeliveriesPage.tsx` lista pedidos reclamables (`refetchInterval: 15s`, mismo patrón que
`useStoreOrders`) y al reclamar navega directo a `ActiveDeliveryPage.tsx`, que muestra las paradas
en el orden sugerido por el backend (`suggested_stop_order`) con el código de recogida de cada una,
y el formulario de código de entrega solo aparece cuando `all_stops_picked_up` es verdadero. La
confirmación de recogida vive del lado de la tienda: se agregó como una variante más de
`StoreOrderActions` en `StoreOrdersPage.tsx` (Fase 2) para el estado `ready`, en vez de una página
aparte — la tienda ya está viendo esa lista de pedidos, no tiene sentido mandarla a otro lugar.
Simétricamente, `OrderDetailPage.tsx` (cliente) gana una `DeliveryStatusCard` que solo se renderiza
si `GET /deliveries/by-order/{id}` devuelve algo distinto de `null` (nadie ha reclamado el pedido
todavía) y muestra el código de entrega mientras la entrega esté `assigned`.
`features/wallet/WalletPage.tsx` sigue el mismo patrón de balance+lista+formulario que el resto de
la app. `AdminCouriersPage.tsx` es un calco de `AdminStoresPage.tsx` (Fase 1); ambas páginas de
backoffice ahora se enlazan entre sí para no depender de que el admin recuerde las dos URLs.

**Lección de esta fase — sesión compartida entre pestañas del navegador durante la verificación
manual:** `useAuthStore` persiste en `localStorage`, que es *un solo* almacén por origen compartido
por todas las pestañas. Abrir varias pestañas para simular varios roles a la vez (dueño, admin,
repartidor, cliente) no funciona como sesiones independientes — cualquier `navigate` de página
completa en una pestaña relee el `localStorage` *actual*, que puede haber sido sobrescrito por otra
pestaña que inició sesión después. La única forma confiable de probar flujos multi-rol a mano es
secuencial en una sola pestaña (cerrar sesión → iniciar sesión con el siguiente usuario), nunca en
paralelo entre pestañas del mismo navegador — no es un bug de la app, es cómo funciona
`localStorage`, pero vale la pena dejarlo anotado para la próxima verificación manual.

### Calificaciones e incidencias (Fase 4)

`features/reviews/ReviewStoreOrderForm.tsx` se muestra en `OrderDetailPage.tsx` para cada
`StoreOrder` en estado `handed_over`; el botón de enviar queda deshabilitado hasta elegir al menos
una estrella. Si el envío falla con `review_already_exists` (409, el cliente ya calificó ese pedido
— posible si recarga la página después de un envío exitoso previo con estado local perdido), el
formulario lo trata como éxito silencioso en vez de mostrar un error confuso: mismo principio que
"un usuario no debería ver un error por algo que ya logró". `StorePage.tsx` combina
`GET /stores/{id}` y `GET /reviews/stores/{id}/summary` en dos hooks independientes (ver la nota de
`stores` no depende de `reviews` arriba) para mostrar el promedio junto al nombre de la tienda, y
`StoreReviewsSection.tsx` lista las calificaciones completas debajo del catálogo.

`features/incidents/ReportIncidentPage.tsx` es una sola página reusada por cliente y repartidor
(el backend infiere el rol, el frontend no necesita saberlo de antemano) — se enlaza desde
`OrderDetailPage.tsx` (cliente) y `ActiveDeliveryPage.tsx` (repartidor), y su botón "Volver" usa
`navigate(-1)` en vez de una ruta fija, porque el origen cambia según quién reporta.
`MyIncidentsPage.tsx` (enlazada desde el menú de usuario en `Navbar`) y `AdminIncidentsPage.tsx`
(pestañas por estado, con formulario de resolución inline) siguen el mismo patrón de lista+badge
que el resto del backoffice.

**Lección de esta fase — un `<div>` no puede vivir dentro de un `<p>`:** `StarRating.tsx` (usado
para mostrar el promedio junto al nombre de la tienda) originalmente renderizaba un `<div>` como
raíz. Anidado dentro del `<p>` de resumen de `StorePage.tsx`, el navegador cierra el `<p>` antes de
tiempo al parsear el HTML — React lo detecta y lo reporta como error de hidratación en consola,
aunque visualmente el layout seguía viéndose razonable (Flexbox no se queja de jerarquías DOM
"raras"). ESLint/TypeScript no detectan esto porque JSX no valida el modelo de contenido de HTML —
solo apareció al revisar la consola del navegador de verdad, no en los tests con jsdom (que no
siempre falla con anidamientos inválidos). El arreglo: la raíz de `StarRating` es un `<span>`
(contenido de fraseo, válido dentro de `<p>`/`<span>`/`<div>`), no un `<div>`. Regla general para
componentes pequeños de UI que se insertan dentro de texto: preferir `<span>` a `<div>` como raíz
salvo que el componente necesite ser un contenedor de bloque.

## Módulo `mobile` (implementado, Fase 5)

App nativa de repartidor: `apps/mobile`, Expo SDK 57 + React Native + TypeScript, dentro del mismo
monorepo npm workspaces. Cubre el alcance que se decidió explícitamente al arrancar la fase
(preguntado al usuario, ver el historial): solo la app de **repartidor**; empaquetar cliente/comercio
(PWA + Capacitor, según el plan original) sigue pendiente.

- **Por qué Expo y no envolver la web con Capacitor**: el repartidor es el único rol que
  necesitaría GPS en segundo plano y notificaciones push confiables más adelante — cosas que una
  PWA no garantiza bien en iOS. Esta fase **no implementa** ninguna de las dos todavía (no hay
  tracking en vivo ni push); solo se sentaron las bases (Expo, no Capacitor) para cuando haga falta,
  igual que la decisión original de arquitectura preveía.
- **Reuso real, no aspiracional**: `@neirapp/api-client` y `@neirapp/design-tokens` ya estaban
  diseñados para esto (`createApiClient` acepta cualquier `fetch` global, que React Native provee
  igual que el navegador; `tokens.ts` es JS puro, sin CSS). La app móvil los consume tal cual —
  cero cambios en esos paquetes. `fonts`/`shadows` del paquete sí son valores CSS (font-family con
  fallbacks, box-shadow) que no aplican a `StyleSheet` de RN; se reemplazan por equivalentes nativos
  en `apps/mobile/src/lib/theme.ts`, sin tocar el paquete compartido (que sigue siendo agnóstico de
  plataforma).
- **Expo Router con `src/app`**: rutas por archivo, con `Stack.Protected` (`guard: boolean`) para
  separar el flujo autenticado (`(tabs)`, grupo de pestañas: Disponibles, Entrega actual, Historial,
  Billetera, Perfil) del de login/registro — mismo patrón documentado en la guía oficial de
  autenticación de Expo Router. Una `SplashScreenController` mantiene la splash screen nativa visible
  hasta que `AsyncStorage` termine de rehidratar la sesión (evita el parpadeo de mostrar login y
  saltar a la app un instante después).
- **Sesión**: mismo modelo que la web (`useAuthStore` con Zustand+persist, mismo shape de datos),
  pero con `AsyncStorage` en vez de `localStorage` y sin coordinación entre pestañas (`navigator.locks`)
  porque una app móvil es una sola instancia — no hace falta. Cuando exista un paquete
  `@neirapp/auth` compartido, `apps/web/.../auth/store.ts` y su par móvil deberían fusionarse ahí.
- **Alcance de pantallas**: onboarding de repartidor (crear perfil, ver estado pendiente/verificado),
  pedidos disponibles + reclamar, entrega activa (paradas en el orden sugerido, códigos de recogida,
  confirmar entrega final), historial, billetera (saldo, movimientos, retiro) y reportar una
  incidencia (reutilizado desde la entrega activa y el detalle de pedido — aunque el detalle de
  pedido en sí es de la web, no de esta app). Deliberadamente fuera: recalificar tiendas (es del
  cliente), y el flujo de re-aceptación de términos cuando cambia de versión (`TermsGate` en la web)
  — la app solo manda `accepted_terms: true` al registrarse, sin manejar cambios de versión después.
- **`RequireVerifiedCourier`**: componente compartido que traduce los errores del backend
  (`courier_profile_not_found` 404, `courier_not_verified` 403) a una pantalla amigable en vez de
  dejar que la petición falle — las pantallas de Disponibles/Entrega activa/Historial lo comparten
  en vez de repetir el manejo tres veces.

**Bug real encontrado en vivo (Expo web, ver "Cómo se verificó" abajo) — reusar `ScreenContainer`
como encabezado parcial:** `index.tsx` (Disponibles) y `history.tsx` (Historial) envolvían el título
en `<ScreenContainer>` (pensado como contenedor de **toda** la pantalla, con `flex: 1` en su
`SafeAreaView`) para reusarlo como si fuera solo la fila del encabezado, con una `FlatList` aparte
debajo. Como `ScreenContainer` fuerza `flex: 1`, ese "encabezado" se expandía para ocupar *todo* el
alto disponible, empujando el mensaje de `RequireVerifiedCourier` (cuando no hay perfil/no está
verificado) hasta pegarlo contra la tab bar, con una franja vacía enorme en el medio — invisible en
un vistazo rápido porque el título seguía viéndose arriba, correcto. El arreglo: esas dos pantallas
arman su propio `SafeAreaView` + `View` de encabezado (sin `flex: 1`) en vez de reusar
`ScreenContainer`, que queda reservado para pantallas donde es el único contenedor de la pantalla
completa (login, registro, entrega activa, billetera, perfil, reportar incidencia). Lección: un
componente con `flex: 1` en su raíz no es seguro de reusar como pieza parcial de un layout compuesto.

**Cómo se verificó (sin simulador ni dispositivo físico en este entorno):** `tsc --noEmit`,
`expo lint` y `expo-doctor` limpios (integrados a `npm run typecheck`/`lint` de la raíz), y
`expo start --web` corriendo de verdad en el navegador (Metro compila a `react-native-web`) — ahí se
probó el flujo completo end-to-end: registro, onboarding de repartidor, verificación desde el
backoffice web (en otro origen: `localhost:8081` vs `localhost:5173`, cada uno con su propia sesión
en `localStorage`/`AsyncStorage`, sin el problema de "una sola sesión por navegador" que sí afectó
las pruebas manuales de la Fase 3), reclamar un pedido y ver el código de recogida. Esto **no**
reemplaza probar en un simulador/dispositivo real antes de publicar: `react-native-web` no ejercita
código nativo (GPS, notificaciones push, cámara), y layouts que dependen de comportamientos táctiles
específicos de iOS/Android pueden verse distintos.
- **CORS solo es un problema en este modo de verificación**: `expo start --web` corre en el
  navegador y por lo tanto sí sufre CORS, a diferencia de una app nativa compilada (que no manda
  `Origin` y nunca choca con `CORSMiddleware`). Hubo que agregar `http://localhost:8081` a
  `NEIRAPP_CORS_ORIGINS` en `.env` para poder probar — no hace falta para la app real en un teléfono,
  documentado acá para no repetir la confusión.
- **Duplicado de React en el monorepo (aviso conocido de `expo-doctor`)**: `apps/web` usa
  `react@^19.3.0` y `apps/mobile` fija `react@19.2.3` (la versión exacta que Expo SDK 57 probó con
  `react-native@0.86.3` — forzar la misma versión que la web podría romper renderizado nativo). Como
  los rangos son incompatibles, npm no las deduplica: cada app termina con su propia copia anidada.
  `expo-doctor` lo marca como "dependencias duplicadas", pero es inofensivo — la resolución de
  módulos de Node siempre encuentra primero el `node_modules` más cercano, así que cada app usa su
  propia copia sin cruzarse. No se intentó alinear las versiones a propósito, para no arriesgar la
  compatibilidad ya verificada de cualquiera de las dos apps.
- **`shadow*` deprecado en `react-native-web`**: la advertencia de consola ("`shadow*` style props
  are deprecated. Use `boxShadow`") sale solo al correr en modo web (`Card`/`Button` usan
  `shadowColor`/`shadowOffset`/etc., que sí son la API correcta y necesaria en nativo). No se resolvió
  con un `Platform.select` porque no afecta la app real (nativa) y el modo web es solo una
  herramienta de verificación en este entorno, no el producto final.

### Cómo correr la app móvil en desarrollo

```bash
cd apps/mobile
npx expo start          # QR para Expo Go / dispositivo o simulador
npx expo start --web    # Verificación rápida en el navegador (ver limitaciones arriba)
```

Necesita `EXPO_PUBLIC_API_BASE_URL` en un `.env` de `apps/mobile` apuntando a la IP de la LAN de la
API (no `localhost`, que en un dispositivo físico apunta al propio teléfono) — ver
`apps/mobile/src/lib/env.ts`.

## Camino a la app móvil

Repartidor: hecho (ver arriba). Pendiente de la fase original:
- **Clientes y comercios**: la PWA (`apps/web`) cubre casi todo; envolverla con Capacitor para que
  aparezca en las tiendas de apps sigue siendo la ruta más simple — no necesitan GPS en segundo plano
  ni notificaciones push tan críticas como el repartidor.
- **Repartidor, siguiente iteración**: rastreo GPS en vivo (`expo-location`, con permiso de segundo
  plano) para reemplazar la heurística de `suggest_route` con una ruta real, y notificaciones push
  (`expo-notifications`) para avisar pedidos nuevos sin depender de que el repartidor tenga la app
  abierta con `refetchInterval` sondeando.

## Riesgos abiertos / deuda técnica conocida

- **Tokens en localStorage**: el store de auth persiste el refresh token en `localStorage`
  (`features/auth/store.ts`), legible por cualquier XSS. Antes de producción, mover el refresh
  token a una cookie `httpOnly` + `SameSite=Strict` (requiere que la API y la web compartan
  dominio/subdominio, o un proxy inverso común).
- **Rate limiting**: no implementado aún. `/login` y `/register` deben limitarse por IP antes de
  exponer la API públicamente (fuerza bruta de contraseñas, spam de cuentas).
- **CORS/cookies**: si se adopta la cookie httpOnly, hay que revisar `CORSMiddleware`
  (`allow_credentials=True` y orígenes explícitos, no `*`).
- **Postgres real**: el desarrollo y CI corrieron contra SQLite (sin Docker disponible en esta
  sesión). Antes de escribir queries geoespaciales (PostGIS) o con `tsvector`, correr los tests de
  integración también contra Postgres real (testcontainers), porque SQLite no soporta esos tipos.
- **Verificación de correo/teléfono**: el registro no verifica el correo ni el celular. Antes de
  producción, decidir si se exige (afecta el flujo de UX y las notificaciones de pedidos).
- **Geocerca placeholder**: `NEIRA_POLYGON` (backend) y `NEIRA_BOUNDS` (frontend, en `NeiraMap.tsx`)
  son un rectángulo aproximado, no el polígono real del municipio. Reemplazar con datos de OSM
  antes de producción; ambos deben mantenerse sincronizados hasta que el backend exponga la
  geocerca por API en vez de duplicarla.
- **Carrito sin persistencia de servidor**: el carrito (antes de pagar) vive solo en `localStorage`
  del cliente — se pierde entre dispositivos y no bloquea inventario mientras está en el carrito.
  Una vez que el cliente paga, el pedido sí es 100% del servidor (`Order`/`StoreOrder`, Fase 2).
- **Sin aprobación automática de un `store_staff`**: seguir sin ese rol (ver la nota de Fase 1) es
  cada vez más notorio ahora que existe backoffice — hoy el único filtro es "un admin la aprobó",
  no "quién puede administrarla". Sigue siendo aceptable a esta escala (una tienda, un dueño).
- **No hay motivo de rechazo ni aviso al dueño**: `PATCH /stores/{id}/approval` con
  `is_approved=false` rechaza la tienda pero no guarda por qué ni le notifica al dueño — el dueño
  solo lo nota si vuelve a `/mi-tienda` y ve el aviso de "en revisión" (que hoy no distingue
  "pendiente" de "rechazada" en el texto, aunque el backend sí lo sabe con `is_rejected`).
- **Pasarela de pago falsa**: `FakePaymentGateway` aprueba cualquier cobro al instante — no hay
  dinero real moviéndose. Conectar una pasarela real (Wompi, ePayco, Mercado Pago) es un adaptador
  nuevo detrás de `PaymentGateway`, pero probablemente necesite cambiar el flujo síncrono actual
  (`POST /orders/{id}/pay` responde ya pagado) por uno asíncrono con webhook firmado e idempotente
  — en ese punto vale la pena extraer un módulo `payments` propio (ver la nota en el módulo
  `ordering` sobre por qué se mantuvo fusionado por ahora).
- **Token del WebSocket en la URL**: ver la nota de autenticación del WS en el módulo `ordering`.
  Un JWT de 15 minutos en la query string puede quedar en logs de acceso; antes de producción,
  cambiar a un *ticket* de un solo uso.
- **Notificaciones en vivo sin Redis**: `ConnectionManager` guarda las conexiones WebSocket en
  memoria del proceso. Funciona para un solo proceso (desarrollo y un despliegue pequeño), pero con
  varias instancias detrás de un balanceador una notificación puede no llegarle a un comercio
  conectado a otra instancia — hace falta pub/sub (Redis) antes de escalar horizontalmente.
- **El cliente no recibe notificaciones en vivo de su pedido**: solo el comercio tiene WebSocket
  (`ver "un comercio que no ve el pedido es el peor fallo posible"` del enunciado original). El
  cliente ve el estado de su pedido solo al volver a `/pedidos/{id}` (REST, sin *polling*
  automático todavía). Agregar esto es sencillo con la misma infraestructura de `ConnectionManager`.
- **Mapa sin geografía real**: `NeiraMap` no usa tiles de OSM (ver "Mapa" arriba); las formas de
  vegetación/río son decorativas. La Fase 1 del plan original preveía un extracto de OSM en
  PMTiles — quedó pendiente por requerir datos y herramientas externas (tippecanoe) no disponibles
  en esta sesión de desarrollo.
- **Selectores de Zustand**: ver la nota en "Carrito" sobre selectores que devuelven una referencia
  nueva en cada llamada. Ningún test (backend con mocks de fetch, ni componentes con jsdom) lo
  detectó — jsdom no puede montar MapLibre (WebGL), así que las páginas que lo usan (`HomePage`,
  `CreateStoreForm`, y por lo tanto casi todo el flujo de compra) solo se verifican corriendo la
  app de verdad en el navegador. Si se agregan más páginas con lógica de estado no trivial, vale
  la pena revisar sus selectores con la misma lupa.
- **Sin rastreo GPS del repartidor**: `suggest_route` (módulo `dispatch`) asume que la primera
  parada es donde arranca el repartidor porque no hay ninguna señal de ubicación en vivo. Antes de
  confiar en la ruta sugerida para algo más que una referencia, hace falta compartir ubicación en
  tiempo real (WebSocket, similar al de notificaciones de `ordering`, o un proveedor de mapas con
  tracking).
- **Tarifa de repartidor sin validar con el negocio**: `compute_earnings_cop` (tarifa plana + por
  parada) es un placeholder explícito — ver la nota del módulo `dispatch`. Cambiarlo es aislado
  (una sola función), pero el modelo de negocio real (por distancia, por tiempo, comisión sobre el
  pedido) todavía no está definido.
- **Retiro de billetera sin pasarela real**: mismo patrón que `FakePaymentGateway` — ver la nota del
  módulo `wallet`. No hay dinero real moviéndose todavía.
- **Códigos de recogida/entrega en texto plano**: ver la nota del módulo `dispatch` sobre por qué el
  riesgo es distinto al de un refresh token filtrado. Igual conviene revisarlo si el modelo de
  autorización alrededor cambia (por ejemplo, si se permite confirmar sin sesión autenticada).
- **Calificar solo exige `handed_over`, no la entrega real**: ver la nota del módulo `reviews`. Un
  cliente puede calificar antes de que el repartidor le entregue el pedido en mano. Aceptable para
  el MVP; si se vuelve un problema real, la solución es que `reviews` consulte a `dispatch` (nuevo
  puerto) en vez de conformarse con el estado de `ordering`.
- **Promociones no implementadas**: la Fase 4 del roadmap original incluía códigos de descuento
  aplicables en el checkout; se dejó fuera a propósito por ser la pieza más invasiva (requiere tocar
  el cálculo de precios inmutable de `ordering`, ver el patrón de *snapshot* en `OrderLine`). Sigue
  pendiente si el negocio lo necesita.
- **Backoffice de incidencias sin SLA**: ver la nota del módulo `incidents`. No hay plazos, prioridad
  ni asignación a un agente — funciona mientras el volumen de reportes sea manejable por una sola
  persona revisando una cola.
- **`reviews` no valida contenido tóxico ni spam**: cualquier cliente que complete un pedido puede
  dejar cualquier comentario (hasta 500 caracteres, sin moderación). Antes de producción, considerar
  un filtro básico o revisión manual si el volumen lo justifica.
- **App móvil sin probar en simulador/dispositivo real**: ver "Cómo se verificó" en el módulo
  `mobile`. Todo lo verificado en este entorno fue vía `expo start --web`; falta la pasada final en
  un simulador iOS/Android o Expo Go antes de considerarla lista para repartidores reales.
- **App móvil sin tests automatizados**: a diferencia de `apps/api` y `apps/web`, `apps/mobile` no
  tiene suite de tests (ni unitarios de dominio ni de componentes) — se apoya solo en `tsc`,
  `expo lint` y la verificación manual en el navegador. Si la app crece, vale la pena agregar Jest +
  `@testing-library/react-native` para la lógica de negocio (por ejemplo, `orderedStops` en la
  pantalla de entrega activa).
- **App móvil sin GPS en segundo plano ni notificaciones push**: la razón original para elegir Expo
  sobre Capacitor (ver el módulo `mobile`) todavía no se implementó — la app solo sondea la API
  (`refetchInterval`) igual que la web. Es la siguiente iteración natural, no un requisito de este
  MVP.

## Cómo conceder el rol admin en desarrollo

No hay ningún flujo de autoservicio para volverse admin (a propósito: sería un hueco de
seguridad). En desarrollo, se otorga insertando una fila en `identity_user_roles` — pero
**hazlo con SQLAlchemy, no con SQL crudo apuntando directo al archivo SQLite**. `Uuid` de
SQLAlchemy guarda los UUID en SQLite como 32 caracteres hex *sin guiones* (no hay tipo UUID
nativo); un `INSERT` a mano con el formato con guiones que devuelve la API en JSON
(`"44a8ef6d-ca66-..."`) inserta una fila que nunca hace *match* con las que escribe la propia
app, y cualquier query de roles la ignora en silencio. Esto se descubrió verificando el
backoffice en vivo: el rol "existía" en la tabla pero `/stores/pending` seguía devolviendo 403.
Ejemplo correcto (fuera de un endpoint HTTP, nunca expuesto):

```python
import asyncio
from uuid import UUID
from neirapp.bootstrap.settings import Settings
from neirapp.shared.infrastructure.db import create_engine, create_session_factory
from neirapp.modules.identity.infrastructure.models import UserRoleModel

async def grant_admin(user_id: str) -> None:
    engine = create_engine(Settings().database_url)
    async with create_session_factory(engine)() as session:
        # UUID(...), no el string tal cual: así SQLAlchemy lo serializa igual que el resto de la app.
        session.add(UserRoleModel(user_id=UUID(user_id), role="admin"))
        await session.commit()
    await engine.dispose()

asyncio.run(grant_admin("44a8ef6d-ca66-4c7e-a199-9613c85886ca"))
```

## Cómo correr el proyecto

Ver [README.md](../README.md).
