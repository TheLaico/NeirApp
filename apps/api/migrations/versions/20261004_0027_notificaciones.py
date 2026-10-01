"""notificaciones de citas y certificados (para profesionales y clientes)

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-04 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: str | None = "0026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "professionals_notification",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("body", sa.String(300), nullable=False),
        sa.Column("link", sa.String(120), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false(), index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("professionals_notification")
