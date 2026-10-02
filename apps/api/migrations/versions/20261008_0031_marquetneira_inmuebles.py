"""MarquetNeira pasa a inmuebles: categorías nuevas y precios grandes

Revision ID: 0031
Revises: 0030
Create Date: 2026-10-08 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0031"
down_revision: str | None = "0030"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Categorías de muebles que ya no existen; "office" sigue (ahora: oficinas y consultorios).
_OLD = (
    "living",
    "dining",
    "bedroom",
    "wardrobe",
    "chairs",
    "tables",
    "kitchen",
    "outdoor",
    "decor",
)
_NEW = (
    "house",
    "apartment",
    "building",
    "commercial",
    "farm",
    "lot",
    "warehouse",
    "room",
    "parking",
)


def _to_other(categories: tuple[str, ...]) -> None:
    listing = sa.table("marketplace_listing", sa.column("category", sa.String))
    op.execute(listing.update().where(listing.c.category.in_(categories)).values(category="other"))


def upgrade() -> None:
    _to_other(_OLD)
    # Una casa o una finca pasan fácil de 2.147 millones (el tope de un entero de 32 bits).
    with op.batch_alter_table("marketplace_listing") as batch:
        batch.alter_column("price_cop", type_=sa.BigInteger(), existing_nullable=True)


def downgrade() -> None:
    _to_other(_NEW)
    with op.batch_alter_table("marketplace_listing") as batch:
        batch.alter_column("price_cop", type_=sa.Integer(), existing_nullable=True)
