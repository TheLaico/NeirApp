"""aprobacion de tiendas

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-22 11:40:52.866032
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default explícito: sin él, agregar una columna NOT NULL fallaría en Postgres si ya
    # hay filas (SQLite es más permisivo, pero el server_default también documenta la intención:
    # las tiendas existentes nacen sin aprobar, igual que las nuevas). Se deja permanente: no
    # estorba (la app siempre manda el valor explícito) y evita un ALTER COLUMN extra en SQLite,
    # que solo lo soporta recreando la tabla (`batch_alter_table`).
    op.add_column(
        "stores",
        sa.Column("is_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(op.f("ix_stores_is_approved"), "stores", ["is_approved"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_stores_is_approved"), table_name="stores")
    op.drop_column("stores", "is_approved")
