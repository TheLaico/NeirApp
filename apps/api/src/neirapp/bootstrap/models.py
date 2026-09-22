"""Importa los modelos de todos los módulos para que queden registrados en `Base.metadata`.

Alembic (autogenerate) y los tests que crean tablas importan este módulo.
"""

from neirapp.modules.identity.infrastructure import models as identity_models
from neirapp.shared.infrastructure.db import Base

__all__ = ["Base", "identity_models"]
