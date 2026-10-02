"""MarquetNeira: muebles en venta o alquiler, pagos de publicación y reportes

Revision ID: 0030
Revises: 0029
Create Date: 2026-10-07 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0030"
down_revision: str | None = "0029"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "marketplace_listing",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("seller_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("seller_name", sa.String(120), nullable=False),
        sa.Column("title", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("whatsapp", sa.String(10), nullable=False),
        sa.Column("price_cop", sa.Integer(), nullable=True),
        sa.Column("negotiable", sa.Boolean(), nullable=False),
        sa.Column("rent_period", sa.String(10), nullable=False),
        sa.Column("photos", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("removed", sa.Boolean(), nullable=False),
        sa.Column("removed_note", sa.String(300), nullable=False),
        sa.Column("paid_until", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "marketplace_payment",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("seller_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("amount_cop", sa.Integer(), nullable=False),
        sa.Column("reference", sa.String(120), nullable=False),
        sa.Column("note", sa.String(300), nullable=False),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "marketplace_report",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("listing_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("reporter_id", sa.Uuid(), nullable=False),
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("details", sa.String(500), nullable=False),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("marketplace_report")
    op.drop_table("marketplace_payment")
    op.drop_table("marketplace_listing")
