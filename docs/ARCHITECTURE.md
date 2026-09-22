# Arquitectura de NeirApp

Marketplace local de Neira, Caldas: tiendas con catálogo en línea, clientes que compran de varias
tiendas a la vez y repartidores que recogen y entregan. Este documento es la referencia de diseño.

**Implementado:** Fase 0 (monorepo, módulo `identity`) y Fase 1 (mapa de Neira, módulo `stores`
con catálogo, carrito multi-tienda, búsqueda, panel del comercio). Pendiente: Fase 2 en adelante
(pedidos, pagos, despacho de repartidores, wallet).

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

### Endpoints (`/api/v1`)

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/stores` | Bearer | El usuario autenticado queda como dueño. |
| GET | `/stores` | — | Filtro opcional `category`. Alimenta el mapa. |
| GET | `/stores/me` | Bearer | La tienda del usuario, o `null`. |
| GET | `/stores/{id}` | — | 404 si no existe. |
| PATCH | `/stores/{id}` | Bearer, dueño | Nombre/categoría/descripción. |
| PATCH | `/stores/{id}/open` | Bearer, dueño | Abrir/cerrar la tienda. |
| GET | `/stores/{id}/products` | — | Filtro opcional `only_available`. |
| POST/PATCH/DELETE | `/stores/{id}/products/...` | Bearer, dueño | CRUD del catálogo. |
| PATCH | `/stores/{id}/products/{id}/availability` | Bearer, dueño | Agotado/disponible. |
| GET | `/products/search` | — | `q`, `category`, `max_price_cop`, `sort`. |

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
- **Sin aprobación de tiendas**: cualquier usuario autenticado puede abrir una tienda sin revisión
  de un admin. Aceptable para probar con pocas tiendas reales (ver roadmap); antes de abrir el
  registro al público hace falta el backoffice de aprobación (Fase 2/4) o al menos un flag manual.
- **Carrito sin persistencia de servidor**: vive solo en `localStorage` del cliente (ver "Carrito"
  arriba). Se pierde entre dispositivos y no bloquea inventario. Se resuelve con `Order`/
  `StoreOrder` en la Fase 2.
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

## Cómo correr el proyecto

Ver [README.md](../README.md).
