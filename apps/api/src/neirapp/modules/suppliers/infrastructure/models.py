from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class SupplierModel(Base):
    __tablename__ = "suppliers_supplier"

    # Una fila por cuenta (identity_users.id), sin foreign key: no acopla el esquema entre módulos.
    user_id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    company_name: Mapped[str] = mapped_column(String(80))
    tagline: Mapped[str] = mapped_column(String(80), default="")
    category: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(String(400))
    phone: Mapped[str] = mapped_column(String(10))
    whatsapp: Mapped[str] = mapped_column(String(10), default="")
    email: Mapped[str] = mapped_column(String(320), default="")
    address: Mapped[str] = mapped_column(String(120), default="")
    website: Mapped[str] = mapped_column(String(210), default="")
    facebook: Mapped[str] = mapped_column(String(210), default="")
    instagram: Mapped[str] = mapped_column(String(210), default="")
    logo_url: Mapped[str] = mapped_column(String(300), default="")
    cover_url: Mapped[str] = mapped_column(String(300), default="")
    catalog_url: Mapped[str] = mapped_column(String(300), default="")
    is_listed: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime)
