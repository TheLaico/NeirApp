"""permitir que un pedido vuelva a reclamarse si su entrega se cancelo

Antes `order_id` (entregas) y `store_order_id` (paradas) eran unicos para siempre, asi que una
entrega cancelada bloqueaba el pedido. Ahora solo es unica la entrega viva de cada pedido.

Revision ID: 0011
Revises: 0010
Create Date: 2026-09-25 19:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_LIVE = "status != 'cancelled'"


def upgrade() -> None:
    op.drop_index(op.f("ix_dispatch_deliveries_order_id"), table_name="dispatch_deliveries")
    op.create_index(
        op.f("ix_dispatch_deliveries_order_id"), "dispatch_deliveries", ["order_id"], unique=False
    )
    op.create_index(
        "uq_dispatch_deliveries_live_order",
        "dispatch_deliveries",
        ["order_id"],
        unique=True,
        sqlite_where=_text(_LIVE),
        postgresql_where=_text(_LIVE),
    )
    op.drop_index(
        op.f("ix_dispatch_delivery_stops_store_order_id"), table_name="dispatch_delivery_stops"
    )
    op.create_index(
        op.f("ix_dispatch_delivery_stops_store_order_id"),
        "dispatch_delivery_stops",
        ["store_order_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_dispatch_delivery_stops_store_order_id"), table_name="dispatch_delivery_stops"
    )
    op.create_index(
        op.f("ix_dispatch_delivery_stops_store_order_id"),
        "dispatch_delivery_stops",
        ["store_order_id"],
        unique=True,
    )
    op.drop_index("uq_dispatch_deliveries_live_order", table_name="dispatch_deliveries")
    op.drop_index(op.f("ix_dispatch_deliveries_order_id"), table_name="dispatch_deliveries")
    op.create_index(
        op.f("ix_dispatch_deliveries_order_id"), "dispatch_deliveries", ["order_id"], unique=True
    )


def _text(sql: str):  # type: ignore[no-untyped-def]
    import sqlalchemy as sa

    return sa.text(sql)
