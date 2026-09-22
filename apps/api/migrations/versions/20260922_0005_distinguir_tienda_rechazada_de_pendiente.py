"""distinguir tienda rechazada de pendiente

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-22 15:02:46.659592
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default explícito por la misma razón que en 0003_aprobacion_de_tiendas: agregar una
    # columna NOT NULL sin default fallaría en Postgres si ya hay filas. Las tiendas existentes
    # nacen sin rechazar, igual que las nuevas.
    op.add_column(
        "stores",
        sa.Column("is_rejected", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("stores", "is_rejected")
