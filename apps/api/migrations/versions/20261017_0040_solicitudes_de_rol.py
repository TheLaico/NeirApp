"""Solicitudes de rol: "¿Quieres formar parte de NeirAPP?" desde la pantalla de inicio de sesión

Revision ID: 0040
Revises: 0039
Create Date: 2026-10-17 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0040"
down_revision: str | None = "0039"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads_role_application",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("role", sa.String(20), nullable=False, index=True),
        sa.Column("full_name", sa.String(80), nullable=False),
        sa.Column("document_number", sa.String(15), nullable=False),
        sa.Column("phone", sa.String(32), nullable=False),
        sa.Column("email", sa.String(254), nullable=False, index=True),
        sa.Column("company_name", sa.String(120), nullable=False, server_default=""),
        sa.Column("company_id", sa.String(40), nullable=False, server_default=""),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("message", sa.String(600), nullable=False, server_default=""),
        sa.Column(
            "is_contacted", sa.Boolean(), nullable=False, server_default=sa.false(), index=True
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, index=True),
    )


def downgrade() -> None:
    op.drop_table("leads_role_application")
