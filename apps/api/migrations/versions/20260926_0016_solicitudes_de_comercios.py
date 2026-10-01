"""solicitudes de comercios que quieren vender en NeirApp

Revision ID: 0016
Revises: 0015
Create Date: 2026-09-26 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: str | None = "0015"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads_merchant",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("contact_name", sa.String(80), nullable=False),
        sa.Column("business_name", sa.String(80), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("is_contacted", sa.Boolean(), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("leads_merchant")
