from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.notifications import Notification, NotificationKind
from neirapp.modules.professionals.infrastructure.models import NotificationModel


def _to_domain(m: NotificationModel) -> Notification:
    return Notification(
        id=m.id,
        user_id=m.user_id,
        kind=NotificationKind(m.kind),
        title=m.title,
        body=m.body,
        link=m.link,
        is_read=m.is_read,
        created_at=m.created_at,
    )


class SqlAlchemyNotificationRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def add(self, notification: Notification) -> None:
        async with self._session_factory() as session:
            session.add(
                NotificationModel(
                    id=notification.id,
                    user_id=notification.user_id,
                    kind=notification.kind.value,
                    title=notification.title,
                    body=notification.body,
                    link=notification.link,
                    is_read=notification.is_read,
                    created_at=notification.created_at,
                )
            )
            await session.commit()

    async def list_for(self, user_id: UUID, limit: int) -> list[Notification]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(NotificationModel)
                .where(NotificationModel.user_id == user_id)
                .order_by(NotificationModel.created_at.desc())
                .limit(limit)
            )
            return [_to_domain(m) for m in result.scalars()]

    async def count_unread(self, user_id: UUID) -> int:
        async with self._session_factory() as session:
            result = await session.execute(
                select(func.count())
                .select_from(NotificationModel)
                .where(NotificationModel.user_id == user_id, NotificationModel.is_read.is_(False))
            )
            return int(result.scalar_one())

    async def get(self, notification_id: UUID) -> Notification | None:
        async with self._session_factory() as session:
            model = await session.get(NotificationModel, notification_id)
            return _to_domain(model) if model else None

    async def mark_read(self, user_id: UUID, notification_id: UUID | None) -> None:
        async with self._session_factory() as session:
            query = update(NotificationModel).where(NotificationModel.user_id == user_id)
            if notification_id is not None:
                query = query.where(NotificationModel.id == notification_id)
            await session.execute(query.values(is_read=True))
            await session.commit()

    async def delete(self, user_id: UUID, notification_id: UUID | None) -> None:
        async with self._session_factory() as session:
            query = delete(NotificationModel).where(NotificationModel.user_id == user_id)
            if notification_id is not None:
                query = query.where(NotificationModel.id == notification_id)
            await session.execute(query)
            await session.commit()
