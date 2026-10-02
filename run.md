Requisitos (una sola vez)
Python 3.12 o superior
Node.js 20 o superior
Docker Desktop (para la base de datos)
Terminal 1: base de datos (Docker)
cd C:\Users\rbx56\OneDrive\Desktop\NeirApp
docker compose -f infra/docker-compose.yml up -d
Esto levanta Postgres, Redis, MinIO y Mailpit (bandeja de correo de prueba en http://localhost:8025).

Terminal 2: API (FastAPI)
Primera vez:

cd C:\Users\rbx56\OneDrive\Desktop\NeirApp\apps\api
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
copy .env.example .env
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\uvicorn neirapp.main:app --reload
Las siguientes veces basta con:

cd C:\Users\rbx56\OneDrive\Desktop\NeirApp\apps\api
.\.venv\Scripts\uvicorn neirapp.main:app --reload
Cuando arranque, la API queda en http://localhost:8000 y la documentación en http://localhost:8000/docs.

¿Sin Docker? En el archivo apps\api\.env cambia la línea de la base de datos por:
NEIRAPP_DATABASE_URL=sqlite+aiosqlite:///./neirapp.db
y vuelve a correr .\.venv\Scripts\alembic upgrade head. Los tests usan SQLite, pero arrancar la app completa con SQLite no lo he probado, así que algunas funciones podrían comportarse distinto que con Postgres.

Terminal 3: frontend web (React + Vite)
Primera vez:

cd C:\Users\rbx56\OneDrive\Desktop\NeirApp\apps\frontend
npm install
npm run dev
Las siguientes veces: solo npm run dev.

Abre http://localhost:5173. Las llamadas a /api se redirigen solas a la API en el puerto 8000.

Opcional, terminal 4: app móvil del repartidor (Expo)
cd C:\Users\rbx56\OneDrive\Desktop\NeirApp
npm install
cd apps\mobile
copy .env.example .env
npm run start


cd C:\Users\rbx56\OneDrive\Desktop\NeirApp\apps\api
.\.venv\Scripts\uvicorn neirapp.main:app --reload


cd C:\Users\rbx56\OneDrive\Desktop\NeirApp\apps\frontend
npm run dev