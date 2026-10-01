from datetime import datetime
from uuid import UUID

from sqlalchemy import Float, ForeignKey, Index, Integer, String, Uuid, text
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


class VehicleSettingModel(Base):
    """Tipos de vehículo que un admin habilitó o deshabilitó; sin fila rige el valor por defecto."""

    __tablename__ = "dispatch_vehicle_settings"

    vehicle_type: Mapped[str] = mapped_column(String(16), primary_key=True)
    is_enabled: Mapped[bool]


_NOT_CANCELLED = text("status != 'cancelled'")


class DeliveryModel(Base):
    __tablename__ = "dispatch_deliveries"
    # Un pedido solo puede tener UNA entrega viva (asignada o entregada): es lo que hace atómico
    # "reclamar". Las canceladas no cuentan, así otro repartidor puede tomar el pedido de nuevo.
    __table_args__ = (
        Index(
            "uq_dispatch_deliveries_live_order",
            "order_id",
            unique=True,
            sqlite_where=_NOT_CANCELLED,
            postgresql_where=_NOT_CANCELLED,
        ),
    )

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    order_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    courier_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    status: Mapped[str] = mapped_column(String(16), index=True)
    delivery_lat: Mapped[float] = mapped_column(Float)
    delivery_lng: Mapped[float] = mapped_column(Float)
    delivery_code: Mapped[str] = mapped_column(String(16))
    courier_earnings_cop: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    platform_earnings_cop: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
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
    # Sin unicidad propia: si la entrega se cancela y otro repartidor la retoma, el pedido de
    # tienda vuelve a tener una parada. Las vivas ya son únicas por el índice de `order_id`.
    store_order_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    store_id: Mapped[UUID] = mapped_column(Uuid)
    store_name: Mapped[str] = mapped_column(String(120))
    store_owner_user_id: Mapped[UUID] = mapped_column(Uuid)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    pickup_code: Mapped[str] = mapped_column(String(16))
    picked_up_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class CourierRatingModel(Base):
    __tablename__ = "dispatch_courier_ratings"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # Una sola calificación por entrega.
    delivery_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    order_id: Mapped[UUID] = mapped_column(Uuid)
    courier_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)


class CourierLocationModel(Base):
    """Una fila por repartidor con su última posición (se reemplaza en cada reporte)."""

    __tablename__ = "dispatch_courier_locations"

    courier_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    heading: Mapped[float | None] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
