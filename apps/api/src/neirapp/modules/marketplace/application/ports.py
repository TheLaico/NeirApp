from dataclasses import dataclass
from typing import Protocol
from uuid import UUID

from neirapp.modules.marketplace.domain.listings import Listing
from neirapp.modules.marketplace.domain.payments import ListingPayment
from neirapp.modules.marketplace.domain.reports import Report


class ListingRepository(Protocol):
    async def get(self, listing_id: UUID) -> Listing | None: ...

    async def save(self, listing: Listing) -> None:
        """Crea o reemplaza la publicación."""
        ...

    async def delete(self, listing_id: UUID) -> None:
        """La borra junto con sus pagos y reportes."""
        ...

    async def list_all(self) -> list[Listing]:
        """Todas, las más recientes primero."""
        ...

    async def list_for_seller(self, seller_id: UUID) -> list[Listing]:
        """Las de un vendedor, las más recientes primero."""
        ...


class PaymentRepository(Protocol):
    async def get(self, payment_id: UUID) -> ListingPayment | None: ...

    async def save(self, payment: ListingPayment) -> None: ...

    async def list_for_seller(self, seller_id: UUID) -> list[ListingPayment]:
        """Los de un vendedor, los más recientes primero."""
        ...

    async def list_pending(self) -> list[ListingPayment]:
        """Los que esperan confirmación, los más antiguos primero."""
        ...


class ReportRepository(Protocol):
    async def add(self, report: Report) -> None: ...

    async def list_open(self) -> list[Report]:
        """Los que esperan revisión, los más antiguos primero."""
        ...

    async def list_for_listing(self, listing_id: UUID) -> list[Report]: ...

    async def save_all(self, reports: list[Report]) -> None: ...


@dataclass(frozen=True)
class Account:
    name: str
    phone: str  # Como lo guarda identity: "+573101234567"


class AccountsPort(Protocol):
    """Datos de las cuentas, que viven en `identity`."""

    async def account(self, user_id: UUID) -> Account | None: ...

    async def admin_ids(self) -> set[UUID]: ...


class NotifierPort(Protocol):
    """Deja un aviso en la campana de una persona (lo implementa el módulo de avisos)."""

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None: ...
