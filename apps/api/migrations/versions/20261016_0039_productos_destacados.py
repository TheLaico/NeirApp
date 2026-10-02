"""Productos destacados: el comerciante paga $ 7.000 para salir en "Productos recomendados"

Revision ID: 0039
Revises: 0038
Create Date: 2026-10-16 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039"
down_revision: str | None = "0038"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "store_product_promotions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "store_id",
            sa.Uuid(),
            sa.ForeignKey("stores.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            sa.Uuid(),
            sa.ForeignKey("store_products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("amount_cop", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("note", sa.String(300), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True, index=True),
    )


def downgrade() -> None:
    op.drop_table("store_product_promotions")
