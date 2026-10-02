from datetime import date, datetime
from uuid import UUID

from sqlalchemy import JSON, Date, Float, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class VenueModel(Base):
    __tablename__ = "venues_venue"

    # Un lugar por cuenta (identity_users.id), sin foreign key: no acopla los esquemas.
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(20))
    tagline: Mapped[str] = mapped_column(String(100), default="")
    description: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(10))
    whatsapp: Mapped[str] = mapped_column(String(10), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    features: Mapped[list[str]] = mapped_column(JSON, default=list)
    photos: Mapped[list[str]] = mapped_column(JSON, default=list)
    open_time: Mapped[str] = mapped_column(String(5))
    close_time: Mapped[str] = mapped_column(String(5))
    open_days: Mapped[list[int]] = mapped_column(JSON, default=list)
    max_people: Mapped[int] = mapped_column()
    price_cop: Mapped[int] = mapped_column(default=0)
    price_unit: Mapped[str] = mapped_column(String(10))
    is_listed: Mapped[bool] = mapped_column(default=True)
    is_featured: Mapped[bool] = mapped_column(default=False)
    banner_url: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class VenueReviewModel(Base):
    __tablename__ = "venues_review"
    __table_args__ = (UniqueConstraint("venue_id", "user_id", name="uq_venues_review_author"),)

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    venue_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    author_name: Mapped[str] = mapped_column(String(120))
    stars: Mapped[int] = mapped_column()
    comment: Mapped[str] = mapped_column(Text, default="")
    reply: Mapped[str] = mapped_column(Text, default="")
    replied_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)


class BookingModel(Base):
    __tablename__ = "venues_booking"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    venue_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(10))
    day: Mapped[date] = mapped_column(Date)
    at: Mapped[str] = mapped_column(String(5))
    people: Mapped[int] = mapped_column()
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), index=True)
    venue_note: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)
