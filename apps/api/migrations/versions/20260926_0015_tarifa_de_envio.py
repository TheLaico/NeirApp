"""tarifa de envio configurable y reparto repartidor/plataforma

Revision ID: 0015
Revises: 0014
Create Date: 2026-09-26 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pricing_delivery",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("delivery_fee_cop", sa.Integer(), nullable=False),
        sa.Column("courier_share_percent", sa.Integer(), nullable=False),
    )
    for table, columns in (
        ("orders", ("delivery_fee_cop", "courier_earnings_cop")),
        ("dispatch_deliveries", ("courier_earnings_cop", "platform_earnings_cop")),
    ):
        for column in columns:
            op.add_column(
                table, sa.Column(column, sa.Integer(), nullable=False, server_default="0")
            )


def downgrade() -> None:
    for table, columns in (
        ("dispatch_deliveries", ("platform_earnings_cop", "courier_earnings_cop")),
        ("orders", ("courier_earnings_cop", "delivery_fee_cop")),
    ):
        for column in columns:
            op.drop_column(table, column)
    op.drop_table("pricing_delivery")
