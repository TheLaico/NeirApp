"""solicitudes de cita a profesionales ("Citas y solicitudes")

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-03 16:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0026"
down_revision: str | None = "0025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "professionals_appointment_request",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("professional_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_id", sa.Uuid(), nullable=False, index=True),
        sa.Column("customer_name", sa.String(80), nullable=False),
        sa.Column("customer_phone", sa.String(10), nullable=False),
        sa.Column("modality", sa.String(10), nullable=False),
        sa.Column("preferred_date", sa.Date(), nullable=True),
        sa.Column("preferred_time", sa.String(10), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("address", sa.String(160), nullable=False, server_default=""),
        sa.Column("service_id", sa.Uuid(), nullable=True),
        sa.Column("service_name", sa.String(80), nullable=False, server_default=""),
        sa.Column("status", sa.String(10), nullable=False, index=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.String(300), nullable=False, server_default=""),
        sa.Column("cancelled_by_customer", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("professionals_appointment_request")
