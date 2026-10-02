"""Proveedores: suscripción mensual (aparecer y publicar el catálogo)

Revision ID: 0033
Revises: 0032
Create Date: 2026-10-10 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0033"
down_revision: str | None = "0032"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "suppliers_supplier", sa.Column("paid_until", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_table(
        "suppliers_payment",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("supplier_id", sa.Uuid(), nullable=False, index=True),
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
    op.drop_table("suppliers_payment")
    with op.batch_alter_table("suppliers_supplier") as batch:
        batch.drop_column("paid_until")
