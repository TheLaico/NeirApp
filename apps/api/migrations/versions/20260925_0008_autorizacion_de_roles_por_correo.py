"""autorizacion de roles por correo (repartidor, comerciante)

Revision ID: 0008
Revises: 0007
Create Date: 2026-09-25 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "identity_role_grants",
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("granted_by", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("email", "role", name=op.f("pk_identity_role_grants")),
    )


def downgrade() -> None:
    op.drop_table("identity_role_grants")
