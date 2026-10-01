from collections.abc import Callable
from datetime import datetime
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.dispatch.application.dto import (
    ClaimableOrderSnapshot,
    EarningsSummary,
    StoreLocationSnapshot,
)
from neirapp.modules.dispatch.domain.entities import (
    CourierLocation,
    CourierProfile,
    CourierRating,
    Delivery,
    VehicleType,
)


class StoresPort(Protocol):
    """Capa anticorrupción hacia `stores` (mismo patrón que el `CatalogPort` de `ordering`)."""

    async def get_store(self, store_id: UUID) -> StoreLocationSnapshot | None: ...


class OrderingPort(Protocol):
    """Capa anticorrupción hacia `ordering`."""

    async def get_claimable_order(self, order_id: UUID) -> ClaimableOrderSnapshot | None: ...

    async def list_claimable_orders(self) -> list[ClaimableOrderSnapshot]: ...

    async def is_store_order_ready(self, order_id: UUID, store_order_id: UUID) -> bool:
        """¿La tienda ya marcó ese pedido como listo? Solo entonces se lo entrega al repartidor."""
        ...

    async def ready_store_order_ids(self, order_id: UUID) -> set[UUID]:
        """Ids de los `StoreOrder` del pedido que la tienda ya marcó como listos."""
        ...

    async def mark_store_order_handed_over(self, store_order_id: UUID) -> None: ...

    async def get_order_customer_id(self, order_id: UUID) -> UUID | None:
        """Solo el dueño del pedido (el cliente) puede ver el código de entrega — a diferencia de
        `get_claimable_order`, esto debe funcionar incluso cuando ya no queda nada por recoger
        (el pedido entero está en camino), así que no se filtra por estado de los `StoreOrder`."""
        ...


class WalletPort(Protocol):
    """Capa anticorrupción hacia `wallet`."""

    async def credit_courier(
        self, courier_id: UUID, amount_cop: int, delivery_id: UUID
    ) -> None: ...


class CourierRepository(Protocol):
    async def add(self, profile: CourierProfile) -> None: ...

    async def get_by_user(self, user_id: UUID) -> CourierProfile | None: ...

    async def get(self, profile_id: UUID) -> CourierProfile | None: ...

    async def list_pending(self) -> list[CourierProfile]: ...

    async def update(self, profile: CourierProfile) -> None: ...


class VehicleSettingsRepository(Protocol):
    async def list_all(self) -> dict[VehicleType, bool]:
        """Solo los tipos que un admin configuró explícitamente."""
        ...

    async def set_enabled(self, vehicle_type: VehicleType, is_enabled: bool) -> None: ...


class DeliveryRepository(Protocol):
    async def add(self, delivery: Delivery) -> None: ...

    async def get(self, delivery_id: UUID) -> Delivery | None: ...

    async def get_by_order(self, order_id: UUID) -> Delivery | None: ...

    async def get_by_stop_store_order(self, store_order_id: UUID) -> Delivery | None: ...

    async def get_active_for_courier(self, courier_id: UUID) -> Delivery | None: ...

    async def list_by_courier(self, courier_id: UUID) -> list[Delivery]: ...

    async def earnings_summary(self) -> EarningsSummary: ...

    async def update(self, delivery: Delivery) -> None: ...


class CourierLocationRepository(Protocol):
    async def upsert(self, location: CourierLocation) -> None: ...

    async def list_since(self, since: datetime) -> list[CourierLocation]: ...


class CourierRatingRepository(Protocol):
    async def add(self, rating: CourierRating) -> None: ...

    async def get_by_delivery(self, delivery_id: UUID) -> CourierRating | None: ...

    async def list_all(self) -> list[CourierRating]: ...


class UnitOfWork(Protocol):
    @property
    def couriers(self) -> CourierRepository: ...

    @property
    def deliveries(self) -> DeliveryRepository: ...

    @property
    def vehicle_settings(self) -> VehicleSettingsRepository: ...

    @property
    def courier_ratings(self) -> CourierRatingRepository: ...

    @property
    def courier_locations(self) -> CourierLocationRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
