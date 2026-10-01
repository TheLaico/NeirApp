# NeirApp

Marketplace local de Neira, Caldas: tiendas con catálogo en línea, clientes que compran de varias
tiendas a la vez, repartidores que recogen y entregan. Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
para el diseño completo y el roadmap por fases.

## Requisitos

- Python 3.12+
- Node.js 20+
- Docker (para Postgres, Redis, MinIO y Mailpit en desarrollo — opcional si usas SQLite)

## Arranque rápido

```bash
# Servicios de apoyo (Postgres+PostGIS, Redis, MinIO, Mailpit)
docker compose -f infra/docker-compose.yml up -d
```

### API

```bash
cd apps/api
python -m venv .venv
./.venv/Scripts/pip install -e ".[dev]"   # Linux/Mac: .venv/bin/pip
cp .env.example .env                       # ajusta NEIRAPP_DATABASE_URL si no usas Docker
./.venv/Scripts/alembic upgrade head
./.venv/Scripts/uvicorn neirapp.main:app --reload
```

La API queda en `http://localhost:8000` (`/docs` para Swagger UI en desarrollo).

### Frontend

```bash
cd apps/frontend
npm install
npm run dev -- --port 5174
```

El frontend queda en `http://localhost:5174`, con `/api` proxeado a la API en `:8000` (ver
`apps/frontend/vite.config.js`; el proxy reenvía HTTP y WebSocket).

Para probar el backoffice de aprobación de tiendas (`/admin/tiendas`) necesitas un usuario con rol
`admin`; no hay flujo de autoservicio para eso — ver
["Cómo conceder el rol admin en desarrollo"](docs/ARCHITECTURE.md#cómo-conceder-el-rol-admin-en-desarrollo).

### Móvil (repartidor)

```bash
cd apps/mobile
cp .env.example .env   # EXPO_PUBLIC_API_BASE_URL: IP de la LAN de la API, no localhost, si usas un teléfono
npm run start           # QR para Expo Go / simulador
npm run web              # verificación rápida en el navegador (ver limitaciones en ARCHITECTURE.md)
```

Ver ["Módulo `mobile`"](docs/ARCHITECTURE.md#módulo-mobile-implementado-fase-5) para el detalle de
qué cubre esta app (solo repartidor por ahora) y cómo se verificó sin simulador ni dispositivo.

## Comandos útiles

```bash
# API
cd apps/api
./.venv/Scripts/pytest                 # tests (unitarios + integración, corren contra SQLite)
./.venv/Scripts/ruff check . && ./.venv/Scripts/ruff format .
./.venv/Scripts/mypy
./.venv/Scripts/lint-imports           # valida las reglas de arquitectura (import-linter)
./.venv/Scripts/alembic revision --autogenerate -m "mensaje"

# Web y móvil (desde la raíz; --workspaces corre en ambos)
npm run typecheck
npm run lint
npm run test

# Solo móvil
cd apps/mobile
npx expo-doctor   # diagnóstico de dependencias/config específico de Expo
```

## Estructura

```
apps/api/           API (FastAPI, monolito modular)
apps/frontend/       Frontend web (React + Vite, JSX)
apps/mobile/         App de repartidor (Expo/React Native), Fase 5
packages/api-client/ Cliente TS generado desde el OpenAPI de la API
packages/design-tokens/  Identidad visual (colores, tipografía)
infra/               docker-compose de servicios de apoyo
docs/ARCHITECTURE.md Diseño completo y roadmap
```
