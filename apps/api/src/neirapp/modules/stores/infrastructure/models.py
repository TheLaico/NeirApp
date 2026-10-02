from datetime import date, datetime, time
from uuid import UUID

from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, Time, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `owner_user_id` referencia a identity_users.id, pero deliberadamente NO lleva una foreign key:
# los módulos no deben acoplarse a nivel de esquema, para poder extraer `stores` a su propio
# servicio/base de datos más adelante sin tocar `identity`. La integridad se garantiza en el
# caso de uso (el owner_user_id viene siempre del usuario autenticado).


class StoreModel(Base):
    __tablename__ = "stores"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    owner_user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    name: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(500))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    is_open: Mapped[bool] = mapped_column(default=True)
    # Un admin debe aprobarla antes de que sea visible para clientes (backoffice de aprobación).
    is_approved: Mapped[bool] = mapped_column(default=False, index=True)
    # Distingue "rechazada" de "todavía sin revisar" (las dos empiezan con is_approved=False).
    is_rejected: Mapped[bool] = mapped_column(default=False)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    logo_url: Mapped[str | None] = mapped_column(String(2048))
    recommended_position: Mapped[int | None] = mapped_column(Integer, index=True)
    is_listed: Mapped[bool] = mapped_column(default=True, server_default="1")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)

    hours: Mapped[list["StoreHoursModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )
    closed_dates: Mapped[list["StoreClosedDateModel"]] = relationship(
        cascade="all, delete-orphan", lazy="selectin"
    )


class StoreHoursModel(Base):
    """Horario de un día de la semana (0 = lunes). Sin filas, la tienda no tiene horario."""

    __tablename__ = "store_hours"

    store_id: Mapped[UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    weekday: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_open: Mapped[bool]
    opens: Mapped[time | None] = mapped_column(Time)
    closes: Mapped[time | None] = mapped_column(Time)
    all_day: Mapped[bool] = mapped_column(default=False, server_default="0")


class StoreClosedDateModel(Base):
    """Fecha puntual en que la tienda avisó que no abre."""

    __tablename__ = "store_closed_dates"

    store_id: Mapped[UUID] = mapped_column(
        ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    reason: Mapped[str] = mapped_column(String(120), default="")


class StoreProductModel(Base):
    __tablename__ = "store_products"
    __table_args__ = (Index("ix_store_products_store_id_name", "store_id", "name"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    store_id: Mapped[UUID] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(500))
    price_cop: Mapped[int] = mapped_column(Integer)
    image_url: Mapped[str | None] = mapped_column(String(2048))
    is_available: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
