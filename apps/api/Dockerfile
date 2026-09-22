FROM python:3.12-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

COPY pyproject.toml ./
COPY src ./src
RUN pip install .

COPY alembic.ini ./
COPY migrations ./migrations

RUN useradd --create-home --uid 1000 app
USER app

EXPOSE 8000
# --proxy-headers: la IP real del cliente llega en X-Forwarded-For desde el proxy inverso.
CMD ["uvicorn", "neirapp.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
