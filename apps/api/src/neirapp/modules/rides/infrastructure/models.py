from datetime import datetime
from uuid import UUID

from sqlalchemy import Float, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class DriverModel(Base):
    __tablename__ = "rides_driver"

    # Un perfil por cuenta (identity_users.id), sin foreign key: no acopla los esquemas.
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(10))
    plate: Mapped[str] = mapped_column(String(7))
    vehicle_model: Mapped[str] = mapped_column(String(60), default="")
    model_year: Mapped[int] = mapped_column(default=0)
    color: Mapped[str] = mapped_column(String(30), default="")
    capacity: Mapped[int] = mapped_column(default=3)
    photo_url: Mapped[str] = mapped_column(String(300), default="")
    vehicle_photo_url: Mapped[str] = mapped_column(String(300), default="")
    is_online: Mapped[bool] = mapped_column(default=False, index=True)
    lat: Mapped[float | None] = mapped_column(Float, default=None)
    lng: Mapped[float | None] = mapped_column(Float, default=None)
    located_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class RideModel(Base):
    __tablename__ = "rides_ride"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    customer_phone: Mapped[str] = mapped_column(String(20))
    passengers: Mapped[int] = mapped_column()
    pickup_lat: Mapped[float] = mapped_column(Float)
    pickup_lng: Mapped[float] = mapped_column(Float)
    address: Mapped[str] = mapped_column(String(120))
    reference: Mapped[str] = mapped_column(String(120), default="")
    destination: Mapped[str] = mapped_column(String(120), default="")
    fare_cop: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(12), index=True)
    requested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    driver_id: Mapped[UUID | None] = mapped_column(Uuid, index=True, default=None)
    accepted_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    arrived_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    started_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    cancelled_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    cancelled_by: Mapped[str] = mapped_column(String(10), default="")
    customer_lat: Mapped[float | None] = mapped_column(Float, default=None)
    customer_lng: Mapped[float | None] = mapped_column(Float, default=None)
    customer_located_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    rating: Mapped[int] = mapped_column(default=0)
    rating_comment: Mapped[str] = mapped_column(String(300), default="")
