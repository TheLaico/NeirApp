from datetime import datetime
from uuid import UUID

from sqlalchemy import Float, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `user_id`/`courier_id`/`store_owner_user_id` referencian usuarios de `identity`, y `store_id`
# tiendas de `stores` — ninguno lleva foreign key, mismo motivo que en el resto de módulos (no
# acoplar el esquema entre módulos).


class CourierProfileModel(Base):
    __tablename__ = "dispatch_courier_profiles"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    vehicle_type: Mapped[str] = mapped_column(String(16))
    plate: Mapped[str | None] = mapped_column(String(16))
    id_document_number: Mapped[str] = mapped_column(String(32))
    is_verified: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)


class DeliveryModel(Base):
    __tablename__ = "dispatch_deliveries"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # único: es lo que hace atómico "reclamar" un pedido (dos repartidores no pueden tener cada
    # uno su propia entrega para el mismo order_id — el segundo INSERT choca con esta restricción).
    order_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    courier_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    delivery_lat: Mapped[float] = mapped_column(Float)
    delivery_lng: Mapped[float] = mapped_column(Float)
    delivery_code: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)
    delivered_at: Mapped[datetime | None] = mapped_column(UTCDateTime)

    stops: Mapped[list["DeliveryStopModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class DeliveryStopModel(Base):
    __tablename__ = "dispatch_delivery_stops"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    delivery_id: Mapped[UUID] = mapped_column(
        ForeignKey("dispatch_deliveries.id", ondelete="CASCADE"), index=True
    )
    store_order_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    store_id: Mapped[UUID] = mapped_column(Uuid)
    store_name: Mapped[str] = mapped_column(String(120))
    store_owner_user_id: Mapped[UUID] = mapped_column(Uuid)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    pickup_code: Mapped[str] = mapped_column(String(16))
    picked_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
