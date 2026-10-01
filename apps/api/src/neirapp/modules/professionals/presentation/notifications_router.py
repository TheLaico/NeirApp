from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from neirapp.modules.identity.presentation.dependencies import CurrentUser
from neirapp.modules.professionals.domain.notifications import Notification, NotificationKind
from neirapp.modules.professionals.presentation.dependencies import ProfessionalsDep

# Avisos de la persona que inició sesión (citas y certificados). Van en `/notifications` y no bajo
# `/professionals` porque también los reciben los clientes.
router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: UUID
    kind: NotificationKind
    title: str
    body: str
    link: str
    is_read: bool
    created_at: datetime

    @classmethod
    def from_domain(cls, n: Notification) -> "NotificationResponse":
        return cls(
            id=n.id,
            kind=n.kind,
            title=n.title,
            body=n.body,
            link=n.link,
            is_read=n.is_read,
            created_at=n.created_at,
        )


class InboxResponse(BaseModel):
    items: list[NotificationResponse]
    unread: int


@router.get("", response_model=InboxResponse)
async def list_notifications(user: CurrentUser, app: ProfessionalsDep) -> InboxResponse:
    """Las 50 más recientes y cuántas hay sin leer en total."""
    inbox = await app.list_my_notifications(user.id)
    return InboxResponse(
        items=[NotificationResponse.from_domain(n) for n in inbox.items], unread=inbox.unread
    )


@router.put("/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(user: CurrentUser, app: ProfessionalsDep) -> Response:
    await app.mark_notification_read(user.id, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: UUID, user: CurrentUser, app: ProfessionalsDep) -> Response:
    await app.mark_notification_read(user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all(user: CurrentUser, app: ProfessionalsDep) -> Response:
    await app.delete_notification(user.id, None)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_one(notification_id: UUID, user: CurrentUser, app: ProfessionalsDep) -> Response:
    await app.delete_notification(user.id, notification_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
