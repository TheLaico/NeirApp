from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.professionals.application.ports import NotificationRepository
from neirapp.modules.professionals.domain.errors import NotificationNotFound
from neirapp.modules.professionals.domain.notifications import Notification, NotificationKind
from neirapp.shared.application.ports import Clock

MAX_LISTED = 50


@dataclass(frozen=True)
class Inbox:
    items: list[Notification]
    unread: int


class ListMyNotifications:
    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> Inbox:
        return Inbox(
            items=await self._repo.list_for(user_id, MAX_LISTED),
            unread=await self._repo.count_unread(user_id),
        )


async def _own(repo: NotificationRepository, user_id: UUID, notification_id: UUID) -> None:
    notification = await repo.get(notification_id)
    if notification is None or notification.user_id != user_id:
        raise NotificationNotFound()


class MarkNotificationRead:
    """`notification_id=None` marca todas."""

    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, notification_id: UUID | None) -> None:
        if notification_id is not None:
            await _own(self._repo, user_id, notification_id)
        await self._repo.mark_read(user_id, notification_id)


class DeleteNotification:
    """`notification_id=None` borra todas."""

    def __init__(self, repo: NotificationRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, notification_id: UUID | None) -> None:
        if notification_id is not None:
            await _own(self._repo, user_id, notification_id)
        await self._repo.delete(user_id, notification_id)


class SendNotification:
    """Deja un aviso en la campana de alguien. Lo usan otros módulos (MarquetNeira) desde la
    composición de la app, para que todos los avisos lleguen al mismo lugar."""

    def __init__(self, repo: NotificationRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(
        self, user_id: UUID, kind: NotificationKind, title: str, body: str, link: str
    ) -> None:
        await self._repo.add(Notification.new(user_id, kind, title, body, link, self._clock.now()))
