from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Uuid
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
