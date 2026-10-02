from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from uuid import UUID

from neirapp.modules.rides.application.ports import (
    AccessPort,
    DriverRepository,
    NotifierPort,
    RideRepository,
)
from neirapp.modules.rides.domain.drivers import Driver, DriverData, mobile
from neirapp.modules.rides.domain.errors import (
    ActiveRideExists,
    DriverBusy,
    DriverOffline,
    DriverProfileRequired,
    NotYourRide,
    RideNotFound,
    RideTaken,
    TooManyPassengers,
)
from neirapp.modules.rides.domain.geo import distance_km, eta_minutes
from neirapp.modules.rides.domain.rides import REQUEST_TTL, Ride, RideData, RideStatus
from neirapp.shared.application.ports import Clock

COLOMBIA = timezone(timedelta(hours=-5))  # Sin horario de verano
TRACK = "/transporte/viaje?id={id}"  # Seguimiento en vivo del motocarro (cliente)
DRIVER_PANEL = "/conductor?seccion=trips"
# Cuánto tiempo después de terminado se le sigue mostrando el viaje al cliente para calificarlo.
RATE_WINDOW = timedelta(hours=3)
# Y el aviso de "nadie aceptó tu solicitud".
EXPIRED_NOTICE = timedelta(minutes=30)


def _first(name: str) -> str:
    return name.split(" ")[0] if name else "El cliente"


@dataclass(frozen=True)
class RideView:
    """Un viaje con lo que cada lado necesita ver: el conductor y su motocarro (para el cliente)
    y el tiempo estimado de llegada al punto de recogida."""

    ride: Ride
    driver: Driver | None
    driver_rating: tuple[float, int]
    eta_minutes: int | None


async def _view(rides: RideRepository, drivers: DriverRepository, ride: Ride) -> RideView:
    driver = await drivers.get(ride.driver_id) if ride.driver_id else None
    rating = await rides.rating_of(ride.driver_id) if ride.driver_id else (0.0, 0)
    eta = None
    if driver and ride.status is RideStatus.ACCEPTED and driver.lat is not None:
        eta = eta_minutes(driver.lat, driver.lng or 0.0, ride.pickup_lat, ride.pickup_lng)
    elif ride.status is RideStatus.ARRIVED:
        eta = 0
    return RideView(ride, driver, rating, eta)


async def _expire(rides: RideRepository, ride: Ride | None, now: datetime) -> Ride | None:
    if ride is not None and ride.expire_if_due(now):
        await rides.save(ride)
    return ride


async def _driver(drivers: DriverRepository, user_id: UUID) -> Driver:
    driver = await drivers.get(user_id)
    if driver is None:
        raise DriverProfileRequired()
    return driver


# --- Conductor: perfil, disponibilidad y ubicación ------------------------------------------


@dataclass(frozen=True)
class DriverCard:
    driver: Driver
    rating: tuple[float, int]


class GetMyDriver:
    def __init__(self, drivers: DriverRepository, rides: RideRepository) -> None:
        self._drivers = drivers
        self._rides = rides

    async def __call__(self, user_id: UUID) -> DriverCard:
        driver = await _driver(self._drivers, user_id)
        return DriverCard(driver, await self._rides.rating_of(user_id))


class SaveMyDriver:
    """Crea el perfil del conductor y su motocarro la primera vez y lo actualiza las siguientes."""

    def __init__(self, drivers: DriverRepository, rides: RideRepository, clock: Clock) -> None:
        self._drivers = drivers
        self._rides = rides
        self._clock = clock

    async def __call__(self, user_id: UUID, data: DriverData) -> DriverCard:
        now = self._clock.now()
        driver = await self._drivers.get(user_id)
        if driver is None:
            driver = Driver.create(user_id, data, now)
        else:
            driver.update(data, now)
        await self._drivers.save(driver)
        return DriverCard(driver, await self._rides.rating_of(user_id))


class SetOnline:
    """Disponible / no disponible para recibir solicitudes."""

    def __init__(self, drivers: DriverRepository, rides: RideRepository, clock: Clock) -> None:
        self._drivers = drivers
        self._rides = rides
        self._clock = clock

    async def __call__(self, user_id: UUID, online: bool) -> DriverCard:
        driver = await _driver(self._drivers, user_id)
        driver.is_online = online
        driver.updated_at = self._clock.now()
        await self._drivers.save(driver)
        return DriverCard(driver, await self._rides.rating_of(user_id))


class UpdateDriverLocation:
    def __init__(self, drivers: DriverRepository, clock: Clock) -> None:
        self._drivers = drivers
        self._clock = clock

    async def __call__(self, user_id: UUID, lat: float, lng: float) -> Driver:
        driver = await _driver(self._drivers, user_id)
        driver.locate(lat, lng, self._clock.now())
        await self._drivers.save(driver)
        return driver


@dataclass(frozen=True)
class LiveDriver:
    lat: float
    lng: float
    busy: bool  # Lleva o va por un cliente


class ListLiveDrivers:
    """Motocarros en servicio para el mapa del cliente: solo su posición, sin datos personales."""

    def __init__(
        self,
        drivers: DriverRepository,
        rides: RideRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._drivers = drivers
        self._rides = rides
        self._access = access
        self._clock = clock

    async def __call__(self) -> list[LiveDriver]:
        now = self._clock.now()
        allowed = await self._access.driver_ids()
        out = []
        for d in await self._drivers.list_online():
            if d.user_id in allowed and d.has_fresh_location(now) and d.lat and d.lng:
                busy = await self._rides.active_for_driver(d.user_id) is not None
                out.append(LiveDriver(d.lat, d.lng, busy))
        return out


# --- Cliente --------------------------------------------------------------------------------


class RequestRide:
    """El cliente pide un motocarro desde un punto. Solo puede tener un viaje abierto a la vez."""

    def __init__(self, rides: RideRepository, clock: Clock) -> None:
        self._rides = rides
        self._clock = clock

    async def __call__(self, customer_id: UUID, name: str, phone: str, data: RideData) -> Ride:
        now = self._clock.now()
        current = await _expire(
            self._rides, await self._rides.active_for_customer(customer_id), now
        )
        if current is not None and current.is_active:
            raise ActiveRideExists()
        ride = Ride.request(customer_id, name, mobile(phone), data, now)
        await self._rides.save(ride)
        return ride


class GetCurrentRide:
    """El viaje abierto del cliente (o el último terminado sin calificar, para pedirle la nota)."""

    def __init__(self, rides: RideRepository, drivers: DriverRepository, clock: Clock) -> None:
        self._rides = rides
        self._drivers = drivers
        self._clock = clock

    async def __call__(self, customer_id: UUID) -> RideView | None:
        now = self._clock.now()
        ride = await _expire(self._rides, await self._rides.active_for_customer(customer_id), now)
        if ride is None or not ride.is_active:
            recent = await self._rides.list_for_customer(customer_id, 1)
            last = recent[0] if recent else None
            show = last is not None and (
                # Terminado y sin calificar: se le pide la nota.
                (
                    last.status is RideStatus.COMPLETED
                    and not last.rating
                    and now - (last.completed_at or now) <= RATE_WINDOW
                )
                # Nadie lo aceptó: se le avisa para que vuelva a pedir.
                or (
                    last.status is RideStatus.EXPIRED
                    and now - last.requested_at <= REQUEST_TTL + EXPIRED_NOTICE
                )
            )
            if not show or last is None:
                return None
            ride = last
        return await _view(self._rides, self._drivers, ride)


class GetRide:
    """Un viaje, para el cliente que lo pidió o el conductor que lo lleva."""

    def __init__(self, rides: RideRepository, drivers: DriverRepository, clock: Clock) -> None:
        self._rides = rides
        self._drivers = drivers
        self._clock = clock

    async def __call__(self, user_id: UUID, ride_id: UUID) -> RideView:
        ride = await _expire(self._rides, await self._rides.get(ride_id), self._clock.now())
        if ride is None:
            raise RideNotFound()
        if user_id not in (ride.customer_id, ride.driver_id):
            raise NotYourRide()
        return await _view(self._rides, self._drivers, ride)


class ListMyRides:
    def __init__(self, rides: RideRepository, drivers: DriverRepository) -> None:
        self._rides = rides
        self._drivers = drivers

    async def __call__(self, customer_id: UUID) -> list[RideView]:
        rides = await self._rides.list_for_customer(customer_id, 20)
        return [await _view(self._rides, self._drivers, r) for r in rides]


class ShareLocation:
    """El cliente comparte dónde está mientras espera, para que el conductor lo encuentre."""

    def __init__(self, rides: RideRepository, clock: Clock) -> None:
        self._rides = rides
        self._clock = clock

    async def __call__(self, customer_id: UUID, ride_id: UUID, lat: float, lng: float) -> Ride:
        ride = await self._rides.get(ride_id)
        if ride is None or ride.customer_id != customer_id:
            raise RideNotFound()
        ride.share_location(lat, lng, self._clock.now())
        await self._rides.save(ride)
        return ride


class CancelRide:
    """Cancela el cliente (mientras no hayan arrancado) o el conductor (después de aceptar)."""

    def __init__(
        self,
        rides: RideRepository,
        drivers: DriverRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._rides = rides
        self._drivers = drivers
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, user_id: UUID, ride_id: UUID) -> RideView:
        ride = await self._rides.get(ride_id)
        if ride is None:
            raise RideNotFound()
        if user_id == ride.customer_id:
            by = "customer"
        elif user_id == ride.driver_id:
            by = "driver"
        else:
            raise NotYourRide()
        had_driver = ride.driver_id is not None and ride.status is not RideStatus.REQUESTED
        ride.cancel(by, self._clock.now())
        await self._rides.save(ride)
        if by == "customer" and had_driver and ride.driver_id:
            await self._notifier.notify(
                ride.driver_id,
                "ride_cancelled",
                "El cliente canceló el viaje",
                f"{_first(ride.customer_name)} canceló el viaje desde {ride.address}.",
                DRIVER_PANEL,
            )
        elif by == "driver":
            await self._notifier.notify(
                ride.customer_id,
                "ride_cancelled",
                "El conductor canceló tu viaje",
                "Puedes volver a pedir un motocarro: otro conductor lo tomará.",
                "/transporte",
            )
        return await _view(self._rides, self._drivers, ride)


class RateRide:
    def __init__(self, rides: RideRepository, drivers: DriverRepository) -> None:
        self._rides = rides
        self._drivers = drivers

    async def __call__(
        self, customer_id: UUID, ride_id: UUID, stars: int, comment: str
    ) -> RideView:
        ride = await self._rides.get(ride_id)
        if ride is None or ride.customer_id != customer_id:
            raise RideNotFound()
        ride.rate(stars, comment)
        await self._rides.save(ride)
        return await _view(self._rides, self._drivers, ride)


# --- Conductor: solicitudes y viaje -----------------------------------------------------------


@dataclass(frozen=True)
class NearbyRequest:
    ride: Ride
    distance_km: float | None
    eta_minutes: int | None


class ListNearbyRequests:
    """Las solicitudes que esperan conductor, las más cercanas primero (si sabe dónde está)."""

    def __init__(self, rides: RideRepository, drivers: DriverRepository, clock: Clock) -> None:
        self._rides = rides
        self._drivers = drivers
        self._clock = clock

    async def __call__(self, driver_id: UUID) -> list[NearbyRequest]:
        driver = await _driver(self._drivers, driver_id)
        now = self._clock.now()
        out = []
        for ride in await self._rides.list_requested():
            if await _expire(self._rides, ride, now) and ride.status is RideStatus.REQUESTED:
                if ride.customer_id == driver_id:
                    continue
                if driver.lat is not None and driver.lng is not None:
                    km = distance_km(driver.lat, driver.lng, ride.pickup_lat, ride.pickup_lng)
                    eta = eta_minutes(driver.lat, driver.lng, ride.pickup_lat, ride.pickup_lng)
                    out.append(NearbyRequest(ride, round(km, 2), eta))
                else:
                    out.append(NearbyRequest(ride, None, None))
        return sorted(out, key=lambda n: (n.distance_km is None, n.distance_km or 0.0))


class AcceptRide:
    """El conductor acepta una solicitud. Solo puede llevar un cliente a la vez, y si dos aceptan
    al mismo tiempo, se la queda el primero."""

    def __init__(
        self,
        rides: RideRepository,
        drivers: DriverRepository,
        access: AccessPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._rides = rides
        self._drivers = drivers
        self._access = access
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, driver_id: UUID, ride_id: UUID) -> RideView:
        driver = await _driver(self._drivers, driver_id)
        if not driver.is_online:
            raise DriverOffline()
        if driver_id not in await self._access.driver_ids():
            raise DriverProfileRequired("Tu cuenta ya no está autorizada como conductor.")
        if await self._rides.active_for_driver(driver_id) is not None:
            raise DriverBusy()
        now = self._clock.now()
        ride = await _expire(self._rides, await self._rides.get(ride_id), now)
        if ride is None:
            raise RideNotFound()
        if ride.status is not RideStatus.REQUESTED:
            raise RideTaken()
        if ride.customer_id == driver_id:
            raise NotYourRide("No puedes aceptar tu propia solicitud.")
        if ride.passengers > driver.capacity:
            raise TooManyPassengers()
        ride.accept(driver_id, now)
        if not await self._rides.claim(ride):
            raise RideTaken()
        view = await _view(self._rides, self._drivers, ride)
        eta = f" Llega en unos {view.eta_minutes} min." if view.eta_minutes else ""
        await self._notifier.notify(
            ride.customer_id,
            "ride_accepted",
            "¡Tu motocarro ha sido asignado!",
            f"{driver.name} ({driver.plate_label}) aceptó tu solicitud y va por ti.{eta}",
            TRACK.format(id=ride.id),
        )
        return view


class _DriverStep:
    def __init__(
        self,
        rides: RideRepository,
        drivers: DriverRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._rides = rides
        self._drivers = drivers
        self._notifier = notifier
        self._clock = clock

    async def _own(self, driver_id: UUID, ride_id: UUID) -> Ride:
        ride = await self._rides.get(ride_id)
        if ride is None:
            raise RideNotFound()
        if ride.driver_id != driver_id:
            raise NotYourRide()
        return ride


class MarkArrived(_DriverStep):
    """El conductor llegó al punto de recogida: se le avisa al cliente."""

    async def __call__(self, driver_id: UUID, ride_id: UUID) -> RideView:
        ride = await self._own(driver_id, ride_id)
        ride.mark_arrived(self._clock.now())
        await self._rides.save(ride)
        driver = await _driver(self._drivers, driver_id)
        await self._notifier.notify(
            ride.customer_id,
            "ride_arrived",
            "Tu motocarro llegó",
            f"{driver.name} te espera en {ride.address} (placa {driver.plate_label}).",
            TRACK.format(id=ride.id),
        )
        return await _view(self._rides, self._drivers, ride)


class StartRide(_DriverStep):
    async def __call__(self, driver_id: UUID, ride_id: UUID) -> RideView:
        ride = await self._own(driver_id, ride_id)
        ride.start(self._clock.now())
        await self._rides.save(ride)
        return await _view(self._rides, self._drivers, ride)


class CompleteRide(_DriverStep):
    async def __call__(self, driver_id: UUID, ride_id: UUID) -> RideView:
        ride = await self._own(driver_id, ride_id)
        ride.complete(self._clock.now())
        await self._rides.save(ride)
        await self._notifier.notify(
            ride.customer_id,
            "ride_completed",
            "¡Llegaste! ¿Cómo te fue?",
            "Califica a tu conductor: nos ayuda a mejorar el transporte en Neira.",
            TRACK.format(id=ride.id),
        )
        return await _view(self._rides, self._drivers, ride)


class GetDriverCurrentRide:
    def __init__(self, rides: RideRepository, drivers: DriverRepository) -> None:
        self._rides = rides
        self._drivers = drivers

    async def __call__(self, driver_id: UUID) -> RideView | None:
        ride = await self._rides.active_for_driver(driver_id)
        return await _view(self._rides, self._drivers, ride) if ride else None


class Period(StrEnum):
    TODAY = "today"
    WEEK = "week"
    MONTH = "month"


@dataclass(frozen=True)
class Bucket:
    label: str  # "6" (hora) o "2026-10-02" (día)
    total_cop: int
    rides: int


@dataclass(frozen=True)
class Earnings:
    period: Period
    total_cop: int
    rides: int
    passengers: int
    buckets: list[Bucket]
    recent: list[Ride]
    rating: tuple[float, int]


class GetEarnings:
    """Ingresos del conductor (viajes terminados): hoy por hora, la semana y el mes por día."""

    def __init__(self, rides: RideRepository, drivers: DriverRepository, clock: Clock) -> None:
        self._rides = rides
        self._drivers = drivers
        self._clock = clock

    async def __call__(self, driver_id: UUID, period: Period) -> Earnings:
        await _driver(self._drivers, driver_id)
        local_now = self._clock.now().astimezone(COLOMBIA)
        midnight = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
        days = {Period.TODAY: 0, Period.WEEK: 6, Period.MONTH: 29}[period]
        since = midnight - timedelta(days=days)
        rides = await self._rides.list_completed_for_driver(driver_id, since)

        def local(r: Ride) -> datetime:
            return (r.completed_at or r.requested_at).astimezone(COLOMBIA)

        def key(r: Ride) -> str:
            # Hoy se agrupa por hora; la semana y el mes, por día.
            moment = local(r)
            return str(moment.hour) if period is Period.TODAY else moment.date().isoformat()

        if period is Period.TODAY:
            labels = [str(h) for h in range(24)]
        else:
            labels = [(since + timedelta(days=d)).date().isoformat() for d in range(days + 1)]
        totals = {label: [0, 0] for label in labels}
        for r in rides:
            if key(r) in totals:
                totals[key(r)][0] += r.fare_cop
                totals[key(r)][1] += 1
        return Earnings(
            period=period,
            total_cop=sum(r.fare_cop for r in rides),
            rides=len(rides),
            passengers=sum(r.passengers for r in rides),
            buckets=[Bucket(label, t, n) for label, (t, n) in totals.items()],
            recent=rides[:20],
            rating=await self._rides.rating_of(driver_id),
        )
