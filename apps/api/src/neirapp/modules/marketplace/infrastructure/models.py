from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, BigInteger, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class ListingModel(Base):
    __tablename__ = "marketplace_listing"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # Cuenta de identity, sin foreign key: no acopla el esquema entre módulos.
    seller_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    seller_name: Mapped[str] = mapped_column(String(120), default="")
    title: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(10))
    category: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column()
    whatsapp: Mapped[str] = mapped_column(String(10))
    price_cop: Mapped[int | None] = mapped_column(BigInteger, default=None)
    negotiable: Mapped[bool] = mapped_column(default=False)
    rent_period: Mapped[str] = mapped_column(String(10), default="month")
    photos: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(default=True)
    removed: Mapped[bool] = mapped_column(default=False)
    removed_note: Mapped[str] = mapped_column(String(300), default="")
    paid_until: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class ListingPaymentModel(Base):
    __tablename__ = "marketplace_payment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    listing_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    seller_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    status: Mapped[str] = mapped_column(String(10), index=True)
    amount_cop: Mapped[int] = mapped_column()
    reference: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(String(300), default="")
    requested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    starts_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)


class ReportModel(Base):
    __tablename__ = "marketplace_report"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    listing_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    reporter_id: Mapped[UUID] = mapped_column(Uuid)
    reason: Mapped[str] = mapped_column(String(20))
    details: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
