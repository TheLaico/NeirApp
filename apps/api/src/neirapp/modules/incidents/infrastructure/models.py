from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `reporter_user_id` referencia a identity_users.id, sin foreign key: mismo motivo que en el resto
# de módulos (no acoplar el esquema entre módulos).


class IncidentModel(Base):
    __tablename__ = "incidents"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    order_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    reporter_user_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    reporter_role: Mapped[str] = mapped_column(String(16))
    category: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(16), index=True)
    resolution_note: Mapped[str | None] = mapped_column(String(1000))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    resolved_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
