from typing import Protocol
from uuid import UUID

from neirapp.modules.professionals.domain.appointments import AppointmentRequest
from neirapp.modules.professionals.domain.categories import Category, Subcategory
from neirapp.modules.professionals.domain.certificates import Certificate
from neirapp.modules.professionals.domain.entities import ProfessionalProfile
from neirapp.modules.professionals.domain.gallery import GalleryImage
from neirapp.modules.professionals.domain.services import ProfessionalService


class ProfileRepository(Protocol):
    async def get(self, user_id: UUID) -> ProfessionalProfile | None: ...

    async def save(self, profile: ProfessionalProfile) -> None:
        """Crea o reemplaza el perfil de esa cuenta."""
        ...

    async def list_all(self) -> list[ProfessionalProfile]: ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de profesional (el administrador puede quitarlo cuando quiera)."""

    async def professional_ids(self) -> set[UUID]: ...


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


class AppointmentRepository(Protocol):
    async def list_for_professional(self, professional_id: UUID) -> list[AppointmentRequest]:
        """Las solicitudes que recibió, las más recientes primero."""
        ...

    async def list_for_customer(self, customer_id: UUID) -> list[AppointmentRequest]:
        """Las que envió una persona, las más recientes primero."""
        ...

    async def get(self, request_id: UUID) -> AppointmentRequest | None: ...

    async def save(self, request: AppointmentRequest) -> None: ...
