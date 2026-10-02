"""Logo de tienda: el ícono de la marca que se ve en el inicio

Revision ID: 0038
Revises: 0037
Create Date: 2026-10-15 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0038"
down_revision: str | None = "0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("stores", sa.Column("logo_url", sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column("stores", "logo_url")
