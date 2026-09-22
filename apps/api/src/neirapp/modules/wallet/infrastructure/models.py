from datetime import datetime
from uuid import UUID

from sqlalchemy import Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `courier_id` referencia a identity_users.id, sin foreign key: mismo motivo que en `stores` y
# `ordering` (no acoplar el esquema entre módulos).


class LedgerEntryModel(Base):
    __tablename__ = "wallet_ledger_entries"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    courier_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    type: Mapped[str] = mapped_column(String(16))
    amount_cop: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(120))
    reference_id: Mapped[UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
