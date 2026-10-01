"""dias con atencion las 24 horas (opcion 24/7)

Revision ID: 0014
Revises: 0013
Create Date: 2026-09-26 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "store_hours",
        sa.Column("all_day", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("store_hours", "all_day")
