"""calificaciones privadas de clientes a repartidores

Revision ID: 0017
Revises: 0016
Create Date: 2026-09-26 18:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: str | None = "0016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dispatch_courier_ratings",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("delivery_id", sa.Uuid(), nullable=False, unique=True, index=True),
        sa.Column("order_id", sa.Uuid(), nullable=False),
        sa.Column("courier_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_id", sa.Uuid(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("dispatch_courier_ratings")
