from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `store_id`/`store_owner_user_id` referencian tiendas de `stores`, y `customer_id` un usuario de
# `identity` — ninguno lleva foreign key, por la misma razón que en `stores`: no acoplar el
# esquema entre módulos (ver la nota en stores/infrastructure/models.py).


class OrderModel(Base):
    __tablename__ = "orders"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    delivery_lat: Mapped[float] = mapped_column(Float)
    delivery_lng: Mapped[float] = mapped_column(Float)
    delivery_notes: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)

    store_orders: Mapped[list["StoreOrderModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin", order_by="StoreOrderModel.created_at"
    )


class StoreOrderModel(Base):
    __tablename__ = "order_store_orders"
    __table_args__ = (Index("ix_order_store_orders_store_id_status", "store_id", "status"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    order_id: Mapped[UUID] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    store_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    store_name: Mapped[str] = mapped_column(String(120))
    store_owner_user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)

    lines: Mapped[list["OrderLineModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class OrderLineModel(Base):
    """`OrderLine` es un value object en el dominio (sin id propio); esta tabla sí necesita una
    clave primaria para persistirlo, pero el mapeo de vuelta a dominio la descarta."""

    __tablename__ = "order_lines"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=uuid4)
    store_order_id: Mapped[UUID] = mapped_column(
        ForeignKey("order_store_orders.id", ondelete="CASCADE"), index=True
    )
    product_id: Mapped[UUID] = mapped_column(Uuid)
    name: Mapped[str] = mapped_column(String(120))
    price_cop: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer)
