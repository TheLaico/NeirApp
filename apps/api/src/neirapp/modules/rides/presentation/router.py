from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.rides.application.use_cases import (
    DriverCard,
    Earnings,
    NearbyRequest,
    Period,
    RideView,
)
from neirapp.modules.rides.domain.drivers import MAX_CAPACITY, Driver, DriverData
from neirapp.modules.rides.domain.rides import (
    FARE_PER_PERSON_COP,
    MAX_PASSENGERS,
    Ride,
    RideData,
    RideStatus,
)
from neirapp.modules.rides.presentation.dependencies import RidesDep

router = APIRouter(prefix="/rides", tags=["rides"])

RequireDriver = Annotated[User, Depends(require_roles(Role.DRIVER, Role.ADMIN))]


class Point(BaseModel):
    lat: float
    lng: float


class DriverRequest(BaseModel):
    name: str = Field(max_length=200)
    phone: str = Field(max_length=30)
    plate: str = Field(max_length=20)
    vehicle_model: str = Field(default="", max_length=120)
    model_year: int = 0
    color: str = Field(default="", max_length=60)
    capacity: int = MAX_CAPACITY
    photo_url: str = Field(default="", max_length=300)
    vehicle_photo_url: str = Field(default="", max_length=300)

    def to_data(self) -> DriverData:
        return DriverData(**self.model_dump())


class DriverResponse(BaseModel):
    """El conductor como lo ve el cliente que va a recoger (y él mismo en su panel)."""

    id: UUID
    name: str
    phone: str
    plate: str
    plate_label: str
    vehicle_model: str
    model_year: int
    color: str
    capacity: int
    photo_url: str
    vehicle_photo_url: str
    is_online: bool
    lat: float | None
    lng: float | None
    located_at: datetime | None
    rating: float
    rating_count: int

    @classmethod
    def build(cls, d: Driver, rating: tuple[float, int]) -> "DriverResponse":
        return cls(
            id=d.user_id,
            name=d.name,
            phone=d.phone,
            plate=d.plate,
            plate_label=d.plate_label,
            vehicle_model=d.vehicle_model,
            model_year=d.model_year,
            color=d.color,
            capacity=d.capacity,
            photo_url=d.photo_url,
            vehicle_photo_url=d.vehicle_photo_url,
            is_online=d.is_online,
            lat=d.lat,
            lng=d.lng,
            located_at=d.located_at,
            rating=rating[0],
            rating_count=rating[1],
        )

    @classmethod
    def from_card(cls, card: DriverCard) -> "DriverResponse":
        return cls.build(card.driver, card.rating)


class RideResponse(BaseModel):
    id: UUID
    status: RideStatus
    passengers: int
    fare_cop: int
    pickup_lat: float
    pickup_lng: float
    address: str
    reference: str
    destination: str
    customer_name: str
    customer_phone: str
    customer_lat: float | None
    customer_lng: float | None
    customer_located_at: datetime | None
    requested_at: datetime
    accepted_at: datetime | None
    arrived_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None
    cancelled_at: datetime | None
    cancelled_by: str
    rating: int
    rating_comment: str
    eta_minutes: int | None
    driver: DriverResponse | None

    @classmethod
    def build(cls, r: Ride, view: RideView | None = None) -> "RideResponse":
        driver = view.driver if view else None
        return cls(
            id=r.id,
            status=r.status,
            passengers=r.passengers,
            fare_cop=r.fare_cop,
            pickup_lat=r.pickup_lat,
            pickup_lng=r.pickup_lng,
            address=r.address,
            reference=r.reference,
            destination=r.destination,
            customer_name=r.customer_name,
            customer_phone=r.customer_phone,
            customer_lat=r.customer_lat,
            customer_lng=r.customer_lng,
            customer_located_at=r.customer_located_at,
            requested_at=r.requested_at,
            accepted_at=r.accepted_at,
            arrived_at=r.arrived_at,
            started_at=r.started_at,
            completed_at=r.completed_at,
            cancelled_at=r.cancelled_at,
            cancelled_by=r.cancelled_by,
            rating=r.rating,
            rating_comment=r.rating_comment,
            eta_minutes=view.eta_minutes if view else None,
            driver=DriverResponse.build(driver, view.driver_rating) if view and driver else None,
        )

    @classmethod
    def from_view(cls, view: RideView) -> "RideResponse":
        return cls.build(view.ride, view)


class RideRequest(BaseModel):
    passengers: int = Field(ge=1, le=MAX_PASSENGERS)
    lat: float
    lng: float
    address: str = Field(max_length=240)
    reference: str = Field(default="", max_length=240)
    destination: str = Field(default="", max_length=240)

    def to_data(self) -> RideData:
        return RideData(**self.model_dump())


class RatingBody(BaseModel):
    stars: int
    comment: str = Field(default="", max_length=600)


class OnlineBody(BaseModel):
    online: bool


class LiveDriverResponse(BaseModel):
    lat: float
    lng: float
    busy: bool


class NearbyResponse(BaseModel):
    ride: RideResponse
    distance_km: float | None
    eta_minutes: int | None

    @classmethod
    def build(cls, n: NearbyRequest) -> "NearbyResponse":
        # Antes de aceptar, el conductor no ve el celular del cliente.
        ride = RideResponse.build(n.ride).model_copy(update={"customer_phone": ""})
        return cls(ride=ride, distance_km=n.distance_km, eta_minutes=n.eta_minutes)


class BucketResponse(BaseModel):
    label: str
    total_cop: int
    rides: int


class EarningsResponse(BaseModel):
    period: Period
    fare_per_person_cop: int = FARE_PER_PERSON_COP
    total_cop: int
    rides: int
    passengers: int
    buckets: list[BucketResponse]
    recent: list[RideResponse]
    rating: float
    rating_count: int

    @classmethod
    def build(cls, e: Earnings) -> "EarningsResponse":
        return cls(
            period=e.period,
            total_cop=e.total_cop,
            rides=e.rides,
            passengers=e.passengers,
            buckets=[
                BucketResponse(label=b.label, total_cop=b.total_cop, rides=b.rides)
                for b in e.buckets
            ],
            recent=[RideResponse.build(r) for r in e.recent],
            rating=e.rating[0],
            rating_count=e.rating[1],
        )


# --- Cliente --------------------------------------------------------------------------------


@router.get("/drivers/live", response_model=list[LiveDriverResponse])
async def list_live_drivers(_user: CurrentUser, app: RidesDep) -> list[LiveDriverResponse]:
    """Motocarros en servicio ahora mismo (solo su posición)."""
    return [
        LiveDriverResponse(lat=d.lat, lng=d.lng, busy=d.busy) for d in await app.list_live_drivers()
    ]


@router.post("", response_model=RideResponse, status_code=201)
async def request_ride(body: RideRequest, user: CurrentUser, app: RidesDep) -> RideResponse:
    """Pide un motocarro ($ 2.500 por persona, hasta 3 personas) desde ese punto."""
    ride = await app.request_ride(user.id, user.full_name, user.phone, body.to_data())
    return RideResponse.build(ride)


@router.get("/current", response_model=RideResponse | None)
async def get_current_ride(user: CurrentUser, app: RidesDep) -> RideResponse | None:
    """El viaje abierto del cliente (o el último terminado sin calificar); null si no hay."""
    view = await app.get_current_ride(user.id)
    return RideResponse.from_view(view) if view else None


@router.get("/mine", response_model=list[RideResponse])
async def list_my_rides(user: CurrentUser, app: RidesDep) -> list[RideResponse]:
    return [RideResponse.from_view(v) for v in await app.list_my_rides(user.id)]


# --- Conductor ------------------------------------------------------------------------------


@router.get("/driver/me", response_model=DriverResponse)
async def get_my_driver(user: RequireDriver, app: RidesDep) -> DriverResponse:
    """Perfil del conductor y su motocarro (404 si todavía no lo ha creado)."""
    return DriverResponse.from_card(await app.get_my_driver(user.id))


@router.put("/driver/me", response_model=DriverResponse)
async def save_my_driver(body: DriverRequest, user: RequireDriver, app: RidesDep) -> DriverResponse:
    return DriverResponse.from_card(await app.save_my_driver(user.id, body.to_data()))


@router.put("/driver/status", response_model=DriverResponse)
async def set_online(body: OnlineBody, user: RequireDriver, app: RidesDep) -> DriverResponse:
    """Disponible (recibe solicitudes) o no disponible."""
    return DriverResponse.from_card(await app.set_online(user.id, body.online))


@router.put("/driver/location", status_code=204)
async def update_driver_location(body: Point, user: RequireDriver, app: RidesDep) -> None:
    """Ubicación actual del motocarro (la app la manda cada pocos segundos)."""
    await app.update_driver_location(user.id, body.lat, body.lng)


@router.get("/driver/requests", response_model=list[NearbyResponse])
async def list_nearby_requests(user: RequireDriver, app: RidesDep) -> list[NearbyResponse]:
    """Solicitudes esperando conductor, las más cercanas primero."""
    return [NearbyResponse.build(n) for n in await app.list_nearby_requests(user.id)]


@router.get("/driver/current", response_model=RideResponse | None)
async def get_driver_current_ride(user: RequireDriver, app: RidesDep) -> RideResponse | None:
    view = await app.get_driver_current_ride(user.id)
    return RideResponse.from_view(view) if view else None


@router.get("/driver/earnings", response_model=EarningsResponse)
async def get_earnings(
    user: RequireDriver, app: RidesDep, period: Annotated[Period, Query()] = Period.TODAY
) -> EarningsResponse:
    """Ingresos de hoy (por hora), de la semana o del mes (por día), y los últimos viajes."""
    return EarningsResponse.build(await app.get_earnings(user.id, period))


@router.post("/{ride_id}/accept", response_model=RideResponse)
async def accept_ride(ride_id: UUID, user: RequireDriver, app: RidesDep) -> RideResponse:
    return RideResponse.from_view(await app.accept_ride(user.id, ride_id))


@router.put("/{ride_id}/arrived", response_model=RideResponse)
async def mark_arrived(ride_id: UUID, user: RequireDriver, app: RidesDep) -> RideResponse:
    return RideResponse.from_view(await app.mark_arrived(user.id, ride_id))


@router.put("/{ride_id}/start", response_model=RideResponse)
async def start_ride(ride_id: UUID, user: RequireDriver, app: RidesDep) -> RideResponse:
    return RideResponse.from_view(await app.start_ride(user.id, ride_id))


@router.put("/{ride_id}/complete", response_model=RideResponse)
async def complete_ride(ride_id: UUID, user: RequireDriver, app: RidesDep) -> RideResponse:
    return RideResponse.from_view(await app.complete_ride(user.id, ride_id))


# --- Ambos ----------------------------------------------------------------------------------


@router.get("/{ride_id}", response_model=RideResponse)
async def get_ride(ride_id: UUID, user: CurrentUser, app: RidesDep) -> RideResponse:
    """Un viaje, para el cliente que lo pidió o el conductor que lo lleva."""
    return RideResponse.from_view(await app.get_ride(user.id, ride_id))


@router.put("/{ride_id}/cancel", response_model=RideResponse)
async def cancel_ride(ride_id: UUID, user: CurrentUser, app: RidesDep) -> RideResponse:
    return RideResponse.from_view(await app.cancel_ride(user.id, ride_id))


@router.put("/{ride_id}/location", response_model=RideResponse)
async def share_location(
    ride_id: UUID, body: Point, user: CurrentUser, app: RidesDep
) -> RideResponse:
    """El cliente comparte dónde está mientras espera el motocarro."""
    return RideResponse.build(await app.share_location(user.id, ride_id, body.lat, body.lng))


@router.put("/{ride_id}/rate", response_model=RideResponse)
async def rate_ride(
    ride_id: UUID, body: RatingBody, user: CurrentUser, app: RidesDep
) -> RideResponse:
    return RideResponse.from_view(await app.rate_ride(user.id, ride_id, body.stars, body.comment))
