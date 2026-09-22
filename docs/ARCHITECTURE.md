# Arquitectura de NeirApp

Marketplace local de Neira, Caldas: tiendas con catálogo en línea, clientes que compran de varias
tiendas a la vez y repartidores que recogen y entregan. Este documento es la referencia de diseño;
el [Fase 0] fue el primer corte implementado (monorepo, módulo `identity`).

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
| Mapa | MapLibre GL + tiles vectoriales propios (pendiente, Fase 1) | Para no parecer Google Maps. |

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

## Frontend

`apps/web` (Vite + React 19 + TypeScript). Estructura *feature-based*:

```
src/
  app/        # router, providers (React Query)
  features/
    auth/     # store (Zustand+persist), sesión con refresh, páginas de login/registro, TermsGate
    home/     # placeholder del mapa (Fase 1 lo reemplaza)
  lib/        # cliente API, manejo de errores, env
  shared/ui/  # componentes de diseño (Button, TextField, Navbar, AuthLayout…)
  styles/     # Tailwind v4 + theme.css de @neirapp/design-tokens
```

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

## Cómo correr el proyecto

Ver [README.md](../README.md).
