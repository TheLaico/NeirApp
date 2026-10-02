"""ajustes del profesional: mostrar el perfil en el directorio y recibir solicitudes

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-05 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Los perfiles existentes siguen visibles y recibiendo solicitudes, igual que los nuevos.
    for column in ("is_listed", "accepts_requests"):
        op.add_column(
            "professionals_profile",
            sa.Column(column, sa.Boolean(), nullable=False, server_default=sa.true()),
        )


def downgrade() -> None:
    op.drop_column("professionals_profile", "accepts_requests")
    op.drop_column("professionals_profile", "is_listed")
