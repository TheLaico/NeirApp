"""servicios que ofrece cada profesional ("Mis servicios")

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-02 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: str | None = "0022"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "professionals_service",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("description", sa.String(300), nullable=False, server_default=""),
        sa.Column("price_kind", sa.String(10), nullable=False),
        sa.Column("price_cop", sa.Integer(), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("professionals_service")
