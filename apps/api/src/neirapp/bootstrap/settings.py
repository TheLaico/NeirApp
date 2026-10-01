from typing import Literal, Self

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-secret-change-me-dev-only-secret-change-me"  # noqa: S105


class Settings(BaseSettings):
    """Configuración por variables de entorno con prefijo `NEIRAPP_` (o archivo `.env`)."""

    model_config = SettingsConfigDict(env_prefix="NEIRAPP_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+asyncpg://neirapp:neirapp@localhost:5432/neirapp"

    jwt_secret: SecretStr = SecretStr(_DEV_JWT_SECRET)
    jwt_issuer: str = "neirapp"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 30

    # Versiones vigentes de los documentos legales. Al cambiarlas, los usuarios deben re-aceptar.
    terms_version: str = "2026-09-01"
    privacy_version: str = "2026-09-01"

    # Carpeta (relativa a donde corre la API) donde se guardan las fotos subidas.
    uploads_dir: str = "uploads"

    cors_origins: list[str] = ["http://localhost:5173"]

    @model_validator(mode="after")
    def _forbid_dev_secret_in_production(self) -> Self:
        if (
            self.environment == "production"
            and self.jwt_secret.get_secret_value() == _DEV_JWT_SECRET
        ):
            raise ValueError("NEIRAPP_JWT_SECRET debe configurarse en producción.")
        return self
