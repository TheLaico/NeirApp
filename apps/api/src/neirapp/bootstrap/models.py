"""Importa los modelos de todos los módulos para que queden registrados en `Base.metadata`.

Alembic (autogenerate) y los tests que crean tablas importan este módulo.
"""

from neirapp.modules.dispatch.infrastructure import models as dispatch_models
from neirapp.modules.identity.infrastructure import models as identity_models
from neirapp.modules.incidents.infrastructure import models as incidents_models
from neirapp.modules.leads.infrastructure import models as leads_models
from neirapp.modules.marketplace.infrastructure import models as marketplace_models
from neirapp.modules.ordering.infrastructure import models as ordering_models
from neirapp.modules.pricing.infrastructure import models as pricing_models
from neirapp.modules.professionals.infrastructure import models as professionals_models
from neirapp.modules.reviews.infrastructure import models as reviews_models
from neirapp.modules.stores.infrastructure import models as stores_models
from neirapp.modules.wallet.infrastructure import models as wallet_models
from neirapp.shared.infrastructure.db import Base

__all__ = [
    "Base",
    "dispatch_models",
    "identity_models",
    "incidents_models",
    "leads_models",
    "marketplace_models",
    "ordering_models",
    "pricing_models",
    "professionals_models",
    "reviews_models",
    "stores_models",
    "wallet_models",
]
