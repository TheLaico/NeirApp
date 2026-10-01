from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.pricing.domain.entities import DeliveryPricing
from neirapp.modules.pricing.infrastructure.models import DeliveryPricingModel

_ROW_ID = 1


class SqlAlchemyPricingStore:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self) -> DeliveryPricing | None:
        async with self._session_factory() as session:
            row = await session.get(DeliveryPricingModel, _ROW_ID)
            if row is None:
                return None
            return DeliveryPricing(row.delivery_fee_cop, row.courier_share_percent)

    async def save(self, pricing: DeliveryPricing) -> None:
        async with self._session_factory() as session:
            row = await session.get(DeliveryPricingModel, _ROW_ID)
            if row is None:
                session.add(
                    DeliveryPricingModel(
                        id=_ROW_ID,
                        delivery_fee_cop=pricing.delivery_fee_cop,
                        courier_share_percent=pricing.courier_share_percent,
                    )
                )
            else:
                row.delivery_fee_cop = pricing.delivery_fee_cop
                row.courier_share_percent = pricing.courier_share_percent
            await session.commit()
