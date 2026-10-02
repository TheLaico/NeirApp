from typing import Protocol
from uuid import UUID

from neirapp.modules.suppliers.domain.entities import Supplier


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
