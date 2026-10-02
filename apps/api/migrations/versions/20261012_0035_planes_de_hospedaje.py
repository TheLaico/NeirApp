"""Hospedaje: planes pagos (aparecer $ 25.000 y destacarse $ 4.900 al mes)

Los hoteles recomendados ya no los marca el administrador a mano: son los que pagan el plan
Destacado. Los hoteles que ya existían quedan sin plan hasta que paguen (o el administrador les
active un mes).

Revision ID: 0035
Revises: 0034
Create Date: 2026-10-12 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035"
down_revision: str | None = "0034"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("lodging_hotel", sa.Column("paid_until", sa.DateTime(timezone=True)))
    op.add_column("lodging_hotel", sa.Column("featured_until", sa.DateTime(timezone=True)))
    op.drop_column("lodging_hotel", "is_recommended")
    op.create_table(
        "lodging_payment",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("hotel_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("amount_cop", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("note", sa.String(300), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("lodging_payment")
    op.add_column(
        "lodging_hotel",
        sa.Column("is_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.drop_column("lodging_hotel", "featured_until")
    op.drop_column("lodging_hotel", "paid_until")
