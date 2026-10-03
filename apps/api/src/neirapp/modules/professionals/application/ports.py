from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from neirapp.modules.professionals.domain.categories import Category, Subcategory
from neirapp.modules.professionals.domain.certificates import Certificate
from neirapp.modules.professionals.domain.entities import ProfessionalProfile
from neirapp.modules.professionals.domain.gallery import GalleryImage
from neirapp.modules.professionals.domain.notifications import Notification
from neirapp.modules.professionals.domain.plans import Subscription
from neirapp.modules.professionals.domain.services import ProfessionalService


class ProfileRepository(Protocol):
    async def get(self, user_id: UUID) -> ProfessionalProfile | None: ...

    async def save(self, profile: ProfessionalProfile) -> None:
        """Crea o reemplaza el perfil de esa cuenta."""
        ...

    async def list_all(self) -> list[ProfessionalProfile]: ...


@dataclass(frozen=True)
class Account:
    """Datos de la cuenta (no del perfil público): para el administrador."""

    name: str
    email: str
    phone: str


class AccessPort(Protocol):
    """Quién tiene hoy acceso de profesional (el administrador puede quitarlo cuando quiera)."""

    async def professional_ids(self) -> set[UUID]: ...

    async def account(self, user_id: UUID) -> Account | None:
        """Nombre, correo y celular de la cuenta; None si ya no existe."""
        ...


class CategoryRepository(Protocol):
    async def list_all(self) -> list[Category]:
        """Todas, en el orden en que se crearon, con sus subcategorías."""
        ...

    async def get(self, category_id: str) -> Category | None: ...

    async def add(self, category: Category) -> None: ...

    async def delete(self, category_id: str) -> None: ...

    async def add_subcategory(self, category_id: str, sub: Subcategory) -> None: ...

    async def update_subcategory(self, category_id: str, sub: Subcategory) -> None: ...

    async def delete_subcategory(self, category_id: str, subcategory_id: str) -> None: ...


class ServiceRepository(Protocol):
    async def list_for(self, user_id: UUID) -> list[ProfessionalService]:
        """Los servicios de un profesional, en el orden en que los agregó."""
        ...

    async def get(self, service_id: UUID) -> ProfessionalService | None: ...

    async def save(self, service: ProfessionalService) -> None:
        """Crea o reemplaza el servicio."""
        ...

    async def delete(self, service_id: UUID) -> None: ...


class GalleryRepository(Protocol):
    async def list_for(self, user_id: UUID) -> list[GalleryImage]:
        """Las fotos de un profesional, en su orden (la primera es la portada)."""
        ...

    async def get(self, image_id: UUID) -> GalleryImage | None: ...

    async def save(self, image: GalleryImage) -> None:
        """Crea o reemplaza la foto."""
        ...

    async def set_positions(self, positions: dict[UUID, int]) -> None: ...

    async def delete(self, image_id: UUID) -> None: ...


class CertificateRepository(Protocol):
    async def list_for(self, user_id: UUID) -> list[Certificate]:
        """Los certificados de un profesional, los más recientes primero."""
        ...

    async def list_pending(self) -> list[Certificate]:
        """Los que esperan revisión, los más antiguos primero."""
        ...

    async def get(self, certificate_id: UUID) -> Certificate | None: ...

    async def save(self, certificate: Certificate) -> None: ...

    async def delete(self, certificate_id: UUID) -> None: ...


class NotificationRepository(Protocol):
    async def add(self, notification: Notification) -> None: ...

    async def list_for(self, user_id: UUID, limit: int) -> list[Notification]:
        """Las más recientes primero."""
        ...

    async def count_unread(self, user_id: UUID) -> int: ...

    async def get(self, notification_id: UUID) -> Notification | None: ...

    async def mark_read(self, user_id: UUID, notification_id: UUID | None) -> None:
        """Marca una como leída, o todas las de esa persona si `notification_id` es None."""
        ...

    async def delete(self, user_id: UUID, notification_id: UUID | None) -> None:
        """Borra una, o todas las de esa persona si `notification_id` es None."""
        ...


class SubscriptionRepository(Protocol):
    async def list_for(self, user_id: UUID) -> list[Subscription]:
        """Las de un profesional, las más recientes primero."""
        ...

    async def list_active(self) -> list[Subscription]:
        """Todas las activadas (vigentes, vencidas o por empezar) de todos los profesionales."""
        ...

    async def list_pending(self) -> list[Subscription]:
        """Las que esperan que el administrador confirme el pago, las más antiguas primero."""
        ...

    async def get(self, subscription_id: UUID) -> Subscription | None: ...

    async def save_all(self, subscriptions: list[Subscription]) -> None:
        """Crea o reemplaza varias a la vez (todas o ninguna)."""
        ...
