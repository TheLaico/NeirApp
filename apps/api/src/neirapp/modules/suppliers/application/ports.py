from typing import Protocol
from uuid import UUID

from neirapp.modules.suppliers.domain.entities import Supplier
from neirapp.modules.suppliers.domain.payments import SupplierPayment


class SupplierRepository(Protocol):
    async def get(self, user_id: UUID) -> Supplier | None: ...

    async def save(self, supplier: Supplier) -> None:
        """Crea o reemplaza el perfil de esa cuenta."""
        ...

    async def list_all(self) -> list[Supplier]:
        """Todos, los actualizados más recientemente primero."""
        ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de proveedor (el administrador lo autoriza por correo)."""

    async def supplier_ids(self) -> set[UUID]: ...


class PaymentRepository(Protocol):
    async def get(self, payment_id: UUID) -> SupplierPayment | None: ...

    async def save(self, payment: SupplierPayment) -> None: ...

    async def list_for(self, supplier_id: UUID) -> list[SupplierPayment]:
        """Los de una empresa, los más recientes primero."""
        ...

    async def list_pending(self) -> list[SupplierPayment]:
        """Los que esperan confirmación, los más antiguos primero."""
        ...


class NotifierPort(Protocol):
    """Deja un aviso en la campana de una persona (lo conecta la composición de la app)."""

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None: ...
