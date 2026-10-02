from datetime import date, datetime
from uuid import UUID

from sqlalchemy import JSON, Date, Float, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class HotelModel(Base):
    __tablename__ = "lodging_hotel"

    # Un hospedaje por cuenta (identity_users.id), sin foreign key: no acopla los esquemas.
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    kind: Mapped[str] = mapped_column(String(20))
    tagline: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(10))
    whatsapp: Mapped[str] = mapped_column(String(10), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    price_from_cop: Mapped[int] = mapped_column()
    amenities: Mapped[list[str]] = mapped_column(JSON, default=list)
    photos: Mapped[list[str]] = mapped_column(JSON, default=list)
    check_in: Mapped[str] = mapped_column(String(5), default="15:00")
    check_out: Mapped[str] = mapped_column(String(5), default="12:00")
    is_listed: Mapped[bool] = mapped_column(default=True)
    paid_until: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    featured_until: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    banner_url: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class HotelReviewModel(Base):
    __tablename__ = "lodging_review"
    __table_args__ = (UniqueConstraint("hotel_id", "user_id", name="uq_lodging_review_author"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    hotel_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    author_name: Mapped[str] = mapped_column(String(120))
    stars: Mapped[int] = mapped_column()
    comment: Mapped[str] = mapped_column(Text, default="")
    reply: Mapped[str] = mapped_column(Text, default="")
    replied_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class ReservationModel(Base):
    __tablename__ = "lodging_reservation"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    hotel_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(10))
    check_in: Mapped[date] = mapped_column(Date)
    check_out: Mapped[date] = mapped_column(Date)
    guests: Mapped[int] = mapped_column()
    rooms: Mapped[int] = mapped_column()
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    hotel_note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class HotelPaymentModel(Base):
    __tablename__ = "lodging_payment"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    hotel_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    kind: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(10), index=True)
    amount_cop: Mapped[int] = mapped_column()
    reference: Mapped[str] = mapped_column(String(120), default="")
    note: Mapped[str] = mapped_column(String(300), default="")
    requested_at: Mapped[datetime] = mapped_column(UTCDateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    starts_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    expires_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
