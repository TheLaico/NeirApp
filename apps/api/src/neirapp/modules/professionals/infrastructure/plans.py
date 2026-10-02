from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from neirapp.modules.professionals.domain.plans import PlanId, Subscription, SubscriptionStatus
from neirapp.modules.professionals.infrastructure.models import SubscriptionModel

_FIELDS = (
    "user_id",
    "payment_reference",
    "note",
    "requested_at",
    "reviewed_at",
    "starts_at",
    "expires_at",
)


def _to_domain(m: SubscriptionModel) -> Subscription:
    return Subscription(
        id=m.id,
        plan=PlanId(m.plan),
        status=SubscriptionStatus(m.status),
        **{name: getattr(m, name) for name in _FIELDS},
    )


async def _store(session: AsyncSession, subscription: Subscription) -> None:
    model = await session.get(SubscriptionModel, subscription.id)
    if model is None:
        model = SubscriptionModel(id=subscription.id)
        session.add(model)
    for name in _FIELDS:
        setattr(model, name, getattr(subscription, name))
    model.plan = subscription.plan.value
    model.status = subscription.status.value


class SqlAlchemySubscriptionRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def list_for(self, user_id: UUID) -> list[Subscription]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SubscriptionModel)
                .where(SubscriptionModel.user_id == user_id)
                .order_by(SubscriptionModel.requested_at.desc())
            )
            return [_to_domain(m) for m in result.scalars()]

    async def list_active(self) -> list[Subscription]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SubscriptionModel).where(
                    SubscriptionModel.status == SubscriptionStatus.ACTIVE.value
                )
            )
            return [_to_domain(m) for m in result.scalars()]

    async def list_pending(self) -> list[Subscription]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SubscriptionModel)
                .where(SubscriptionModel.status == SubscriptionStatus.PENDING.value)
                .order_by(SubscriptionModel.requested_at)
            )
            return [_to_domain(m) for m in result.scalars()]

    async def get(self, subscription_id: UUID) -> Subscription | None:
        async with self._session_factory() as session:
            model = await session.get(SubscriptionModel, subscription_id)
            return _to_domain(model) if model else None

    async def save_all(self, subscriptions: list[Subscription]) -> None:
        async with self._session_factory() as session:
            for subscription in subscriptions:
                await _store(session, subscription)
            await session.commit()
