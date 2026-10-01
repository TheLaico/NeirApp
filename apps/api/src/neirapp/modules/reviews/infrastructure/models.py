from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base, UTCDateTime

# `customer_id` referencia a identity_users.id, sin foreign key: mismo motivo que en el resto de
# módulos (no acoplar el esquema entre módulos).


class ReviewModel(Base):
    __tablename__ = "reviews"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True)
    # único: a lo sumo una calificación por pedido-tienda (ver Review en domain/entities.py).
    store_order_id: Mapped[UUID] = mapped_column(Uuid, unique=True, index=True)
    order_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    store_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    customer_id: Mapped[UUID] = mapped_column(Uuid, index=True)
    rating: Mapped[int] = mapped_column()
    comment: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime)
    merchant_reply: Mapped[str | None] = mapped_column(String(500))
    replied_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
