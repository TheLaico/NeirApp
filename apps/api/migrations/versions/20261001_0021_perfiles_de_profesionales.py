"""perfiles de profesionales (los arma cada profesional autorizado)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-01 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: str | None = "0020"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "professionals_profile",
        sa.Column("user_id", sa.Uuid(), primary_key=True),
        sa.Column("title", sa.String(10), nullable=False, server_default=""),
        sa.Column("full_name", sa.String(80), nullable=False),
        sa.Column("headline", sa.String(90), nullable=False, server_default=""),
        sa.Column("category_id", sa.String(60), nullable=False, index=True),
        sa.Column("subcategory_id", sa.String(60), nullable=False, server_default="", index=True),
        sa.Column("experience_years", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("phone", sa.String(10), nullable=False),
        sa.Column("whatsapp", sa.String(10), nullable=False, server_default=""),
        sa.Column("email", sa.String(320), nullable=False, server_default=""),
        sa.Column("address", sa.String(120), nullable=False, server_default=""),
        sa.Column("schedule", sa.String(120), nullable=False, server_default=""),
        sa.Column("attends_office", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("attends_home", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("attends_online", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("photo_url", sa.String(300), nullable=False, server_default=""),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("professionals_profile")
