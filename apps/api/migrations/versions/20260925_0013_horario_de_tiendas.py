"""horario semanal de las tiendas y fechas en que no abren

Revision ID: 0013
Revises: 0012
Create Date: 2026-09-25 23:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "store_hours",
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False),
        sa.Column("opens", sa.Time(), nullable=True),
        sa.Column("closes", sa.Time(), nullable=True),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name=op.f("fk_store_hours_store_id_stores"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("store_id", "weekday", name=op.f("pk_store_hours")),
    )
    op.create_table(
        "store_closed_dates",
        sa.Column("store_id", sa.Uuid(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=120), nullable=False),
        sa.ForeignKeyConstraint(
            ["store_id"],
            ["stores.id"],
            name=op.f("fk_store_closed_dates_store_id_stores"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("store_id", "day", name=op.f("pk_store_closed_dates")),
    )


def downgrade() -> None:
    op.drop_table("store_closed_dates")
    op.drop_table("store_hours")
