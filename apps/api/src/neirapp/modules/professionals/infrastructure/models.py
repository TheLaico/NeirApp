from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class ProfessionalProfileModel(Base):
    __tablename__ = "professionals_profile"

    # Una fila por cuenta (identity_users.id), sin foreign key: no acopla el esquema entre módulos.
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    title: Mapped[str] = mapped_column(String(10), default="")
    full_name: Mapped[str] = mapped_column(String(80))
    headline: Mapped[str] = mapped_column(String(90), default="")
    category_id: Mapped[str] = mapped_column(String(60), index=True)
    subcategory_id: Mapped[str] = mapped_column(String(60), default="", index=True)
    experience_years: Mapped[int | None] = mapped_column(default=None)
    description: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(10))
    whatsapp: Mapped[str] = mapped_column(String(10), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    address: Mapped[str] = mapped_column(String(120), default="")
    schedule: Mapped[str] = mapped_column(String(120), default="")
    attends_office: Mapped[bool] = mapped_column(default=True)
    attends_home: Mapped[bool] = mapped_column(default=False)
    attends_online: Mapped[bool] = mapped_column(default=False)
    is_available: Mapped[bool] = mapped_column(default=True)
    photo_url: Mapped[str] = mapped_column(String(300), default="")
    is_featured: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)
