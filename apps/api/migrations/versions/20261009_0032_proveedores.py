"""Proveedores: empresas de Neira que venden al por mayor

Revision ID: 0032
Revises: 0031
Create Date: 2026-10-09 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0032"
down_revision: str | None = "0031"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "suppliers_supplier",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("company_name", sa.String(80), nullable=False),
        sa.Column("tagline", sa.String(80), nullable=False),
        sa.Column("category", sa.String(20), nullable=False, index=True),
        sa.Column("description", sa.String(400), nullable=False),
        sa.Column("phone", sa.String(10), nullable=False),
        sa.Column("whatsapp", sa.String(10), nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("address", sa.String(120), nullable=False),
        sa.Column("website", sa.String(210), nullable=False),
        sa.Column("facebook", sa.String(210), nullable=False),
        sa.Column("instagram", sa.String(210), nullable=False),
        sa.Column("logo_url", sa.String(300), nullable=False),
        sa.Column("cover_url", sa.String(300), nullable=False),
        sa.Column("catalog_url", sa.String(300), nullable=False),
        sa.Column("is_listed", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("suppliers_supplier")
