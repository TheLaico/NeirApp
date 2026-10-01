"""tiendas recomendadas por el administrador

Revision ID: 0018
Revises: 0017
Create Date: 2026-09-26 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: str | None = "0017"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stores", sa.Column("recommended_position", sa.Integer(), nullable=True))
    op.create_index("ix_stores_recommended_position", "stores", ["recommended_position"])


def downgrade() -> None:
    op.drop_index("ix_stores_recommended_position", table_name="stores")
    op.drop_column("stores", "recommended_position")
