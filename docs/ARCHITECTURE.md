# Arquitectura de NeirApp

Marketplace local de Neira, Caldas: tiendas con catálogo en línea, clientes que compran de varias
tiendas a la vez y repartidores que recogen y entregan. Este documento es la referencia de diseño.

**Implementado:** Fase 0 (monorepo, módulo `identity`), Fase 1 (mapa de Neira, módulo `stores` con
catálogo, carrito multi-tienda, búsqueda, panel del comercio) y Fase 2 (módulo `ordering`: pedidos
multi-tienda, pago con pasarela intercambiable, notificaciones en vivo al comercio, backoffice de
aprobación de tiendas). Pendiente: Fase 3 en adelante (despacho de repartidores, wallet real).

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
- **Búsqueda**: `LIKE` simple sobre nombre/descripción, con filtro por categoría y precio máximo, y
  orden por precio o nombre — portable entre SQLite (tests) y Postgres (prod) sin extensiones. Es
  la Etapa 1 descrita en el plan original; `tsvector`+`pg_trgm` y luego un motor dedicado quedan
  para la Fase 4.
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

## Camino a la app móvil

Los paquetes `design-tokens` y (más adelante) `shared`/`api-client` ya están separados de `apps/web`
para poder reusarse. Cuando llegue la Fase 5:
- Clientes y comercios: la PWA cubre casi todo; se puede envolver con Capacitor si se necesita
  presencia en las tiendas de apps.
- Repartidores: probablemente necesiten Expo (React Native) desde el principio, por el GPS en
  segundo plano y las notificaciones confiables que una PWA no garantiza bien.

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
