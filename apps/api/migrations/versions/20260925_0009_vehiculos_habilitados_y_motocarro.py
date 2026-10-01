"""tipos de vehiculo habilitados para repartidores (por defecto solo moto) y motocarro

Revision ID: 0009
Revises: 0008
Create Date: 2026-09-25 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dispatch_vehicle_settings",
        sa.Column("vehicle_type", sa.String(length=16), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("vehicle_type", name=op.f("pk_dispatch_vehicle_settings")),
    )


def downgrade() -> None:
    op.drop_table("dispatch_vehicle_settings")
