from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.suppliers.application.ports import AccessPort, SupplierRepository
from neirapp.modules.suppliers.domain.entities import Supplier, SupplierCategory, SupplierData
from neirapp.modules.suppliers.domain.errors import SupplierNotFound
from neirapp.shared.application.ports import Clock


class GetMySupplier:
    def __init__(self, repo: SupplierRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> Supplier:
        supplier = await self._repo.get(user_id)
        if supplier is None:
            raise SupplierNotFound()
        return supplier


class SaveMySupplier:
    """Crea el perfil de la empresa la primera vez y lo reemplaza las siguientes."""

    def __init__(self, repo: SupplierRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, data: SupplierData) -> Supplier:
        now = self._clock.now()
        supplier = await self._repo.get(user_id)
        if supplier is None:
            supplier = Supplier.create(user_id, data, now)
        else:
            supplier.update(data, now)
        await self._repo.save(supplier)
        return supplier


@dataclass(frozen=True)
class SupplierFilter:
    category: SupplierCategory | None = None


class ListSuppliers:
    """Lo que ven los clientes: empresas que siguen autorizadas y no ocultaron su perfil."""

    def __init__(self, repo: SupplierRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, flt: SupplierFilter) -> list[Supplier]:
        allowed = await self._access.supplier_ids()
        return [
            s
            for s in await self._repo.list_all()
            if s.user_id in allowed
            and s.is_listed
            and (flt.category is None or s.category is flt.category)
        ]


class GetSupplier:
    def __init__(self, repo: SupplierRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, user_id: UUID) -> Supplier:
        supplier = await self._repo.get(user_id)
        if (
            supplier is None
            or not supplier.is_listed
            or user_id not in await self._access.supplier_ids()
        ):
            raise SupplierNotFound()
        return supplier
