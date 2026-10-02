from uuid import UUID

from neirapp.modules.professionals.application.app import ProfessionalsApp
from neirapp.modules.professionals.domain.notifications import NotificationKind


class NotificationsAdapter:
    """Implementa el `NotifierPort` de MarquetNeira, Proveedores, Hospedaje, Reservas y
    Transporte con los avisos de `professionals` (la campana es una sola). Vive en la composición
    para que ningún módulo dependa del otro."""

    def __init__(self, professionals: ProfessionalsApp) -> None:
        self._professionals = professionals

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None:
        await self._professionals.send_notification(
            user_id, NotificationKind(kind), title, body, link
        )
