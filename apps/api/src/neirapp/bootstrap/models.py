"""Importa los modelos de todos los módulos para que queden registrados en `Base.metadata`.

Alembic (autogenerate) y los tests que crean tablas importan este módulo.
"""

from neirapp.modules.dispatch.infrastructure import models as dispatch_models
from neirapp.modules.identity.infrastructure import models as identity_models
from neirapp.modules.ordering.infrastructure import models as ordering_models
from neirapp.modules.stores.infrastructure import models as stores_models
from neirapp.modules.wallet.infrastructure import models as wallet_models
from neirapp.shared.infrastructure.db import Base

__all__ = [
    "Base",
    "dispatch_models",
    "identity_models",
    "ordering_models",
    "stores_models",
    "wallet_models",
]
