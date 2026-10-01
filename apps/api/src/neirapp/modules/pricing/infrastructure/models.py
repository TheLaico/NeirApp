from sqlalchemy import Integer
from sqlalchemy.orm import Mapped, mapped_column

from neirapp.shared.infrastructure.db import Base


class DeliveryPricingModel(Base):
    """Una sola fila (id = 1) con la tarifa de envío configurada por el administrador."""

    __tablename__ = "pricing_delivery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    delivery_fee_cop: Mapped[int] = mapped_column(Integer)
    courier_share_percent: Mapped[int] = mapped_column(Integer)
