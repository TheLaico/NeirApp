from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from neirapp.modules.dispatch.application.deliveries import suggested_stop_order
from neirapp.modules.dispatch.application.ports import UnitOfWorkFactory
from neirapp.modules.dispatch.domain.entities import (
    CourierLocation,
    CourierProfile,
    Delivery,
    VehicleType,
)
from neirapp.modules.dispatch.domain.errors import CourierNotVerified, CourierProfileNotFound
from neirapp.shared.application.ports import Clock

# Un repartidor cuenta como "en línea" si su app reportó posición en los últimos 90 segundos.
ONLINE_WINDOW = timedelta(seconds=90)
# Solo se muestran los que reportaron en las últimas 24 horas (los demás no tienen posición útil).
VISIBLE_WINDOW = timedelta(hours=24)


@dataclass(frozen=True)
class LiveStop:
    """Una tienda donde el repartidor debe recoger (parte de su entrega en curso)."""

    store_name: str
    lat: float
    lng: float
    is_picked_up: bool


@dataclass(frozen=True)
class LiveCourier:
    """Un repartidor en el mapa en vivo del administrador."""

    courier_id: UUID  # id del usuario en `identity`
    vehicle_type: VehicleType
    plate: str | None
    lat: float
    lng: float
    heading: float | None
    updated_at: datetime
    is_online: bool
    active_order_id: UUID | None
    stops_picked_up: int
    stops_total: int
    # Lo que tiene que recorrer: las tiendas (en el orden sugerido) y la casa del cliente.
    stops: tuple[LiveStop, ...] = ()
    delivery_lat: float | None = None
    delivery_lng: float | None = None


def _ordered_stops(delivery: Delivery) -> tuple[LiveStop, ...]:
    rank = {sid: i for i, sid in enumerate(suggested_stop_order(delivery))}
    ordered = sorted(delivery.stops, key=lambda s: rank.get(s.store_order_id, 0))
    return tuple(LiveStop(s.store_name, s.lat, s.lng, s.is_picked_up) for s in ordered)


class UpdateMyLocation:
    """El repartidor verificado reporta dónde está (la app lo hace cada pocos segundos)."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(
        self, user_id: UUID, *, lat: float, lng: float, heading: float | None
    ) -> CourierLocation:
        async with self._uow_factory() as uow:
            profile = await uow.couriers.get_by_user(user_id)
            if profile is None:
                raise CourierProfileNotFound()
            if not profile.is_verified:
                raise CourierNotVerified()
            location = CourierLocation.create(
                courier_id=user_id, lat=lat, lng=lng, heading=heading, now=self._clock.now()
            )
            await uow.courier_locations.upsert(location)
            await uow.commit()
        return location


class ListLiveCouriers:
    """Repartidores con su última posición y su entrega en curso, para el mapa del administrador."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self) -> list[LiveCourier]:
        now = self._clock.now()
        live: list[LiveCourier] = []
        async with self._uow_factory() as uow:
            for location in await uow.courier_locations.list_since(now - VISIBLE_WINDOW):
                profile: CourierProfile | None = await uow.couriers.get_by_user(location.courier_id)
                if profile is None:
                    continue
                delivery = await uow.deliveries.get_active_for_courier(location.courier_id)
                live.append(
                    LiveCourier(
                        courier_id=location.courier_id,
                        vehicle_type=profile.vehicle_type,
                        plate=profile.plate,
                        lat=location.lat,
                        lng=location.lng,
                        heading=location.heading,
                        updated_at=location.updated_at,
                        is_online=now - location.updated_at <= ONLINE_WINDOW,
                        active_order_id=delivery.order_id if delivery else None,
                        stops_picked_up=(
                            sum(1 for s in delivery.stops if s.is_picked_up) if delivery else 0
                        ),
                        stops_total=len(delivery.stops) if delivery else 0,
                        stops=_ordered_stops(delivery) if delivery else (),
                        delivery_lat=delivery.delivery_lat if delivery else None,
                        delivery_lng=delivery.delivery_lng if delivery else None,
                    )
                )
        return live
