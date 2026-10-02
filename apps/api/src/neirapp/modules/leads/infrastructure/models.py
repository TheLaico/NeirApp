from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime


class MerchantLeadModel(Base):
    __tablename__ = "leads_merchant"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # Quién la envió (identity_users.id), sin foreign key: no se acopla el esquema entre módulos.
    user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    contact_name: Mapped[str] = mapped_column(String(80))
    business_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(32))
    is_contacted: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)


class RoleApplicationModel(Base):
    """Solicitud para formar parte de NeirAPP con un rol (ver domain/applications.py)."""

    __tablename__ = "leads_role_application"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    role: Mapped[str] = mapped_column(String(20), index=True)
    full_name: Mapped[str] = mapped_column(String(80))
    document_number: Mapped[str] = mapped_column(String(15))
    phone: Mapped[str] = mapped_column(String(32))
    email: Mapped[str] = mapped_column(String(254), index=True)
    company_name: Mapped[str] = mapped_column(String(120), default="")
    company_id: Mapped[str] = mapped_column(String(40), default="")
    details: Mapped[dict[str, str]] = mapped_column(JSON, default=dict)
    message: Mapped[str] = mapped_column(String(600), default="")
    is_contacted: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
