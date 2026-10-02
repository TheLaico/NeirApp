from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.lodging.application.use_cases import HotelCard, HotelRow, ReservationView
from neirapp.modules.lodging.domain.hotels import (
    MAX_DESCRIPTION,
    MAX_PHOTOS,
    Amenity,
    HotelData,
    HotelKind,
)
from neirapp.modules.lodging.domain.reservations import (
    Reservation,
    ReservationData,
    ReservationStatus,
)
from neirapp.modules.lodging.domain.reviews import Review
from neirapp.modules.lodging.presentation.dependencies import LodgingDep

router = APIRouter(prefix="/lodging", tags=["lodging"])

RequireHotel = Annotated[User, Depends(require_roles(Role.HOTEL, Role.ADMIN))]
RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]


class HotelRequest(BaseModel):
    name: str = Field(max_length=200)
    kind: HotelKind
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    address: str = Field(max_length=240)
    lat: float
    lng: float
    phone: str = Field(max_length=30)
    price_from_cop: int
    photos: list[str] = Field(max_length=MAX_PHOTOS * 2)
    tagline: str = Field(default="", max_length=200)
    whatsapp: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=320)
    amenities: list[Amenity] = Field(default_factory=list, max_length=len(Amenity))
    check_in: str = Field(default="15:00", max_length=5)
    check_out: str = Field(default="12:00", max_length=5)
    is_listed: bool = True

    def to_data(self) -> HotelData:
        return HotelData(**self.model_dump())


class HotelResponse(BaseModel):
    id: UUID
    name: str
    kind: HotelKind
    tagline: str
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    whatsapp: str
    email: str
    price_from_cop: int
    amenities: list[Amenity]
    photos: list[str]
    check_in: str
    check_out: str
    is_listed: bool
    is_recommended: bool
    banner_url: str
    rating: float
    reviews_count: int
    updated_at: datetime

    @classmethod
    def from_card(cls, card: HotelCard) -> "HotelResponse":
        h = card.hotel
        return cls(
            id=h.user_id,
            name=h.name,
            kind=h.kind,
            tagline=h.tagline,
            description=h.description,
            address=h.address,
            lat=h.lat,
            lng=h.lng,
            phone=h.phone,
            whatsapp=h.whatsapp,
            email=h.email,
            price_from_cop=h.price_from_cop,
            amenities=h.amenities,
            photos=h.photos,
            check_in=h.check_in,
            check_out=h.check_out,
            is_listed=h.is_listed,
            is_recommended=h.is_recommended,
            banner_url=h.banner_url,
            rating=card.rating.average,
            reviews_count=card.rating.count,
            updated_at=h.updated_at,
        )


class ReviewResponse(BaseModel):
    id: UUID
    hotel_id: UUID
    user_id: UUID
    author_name: str
    stars: int
    comment: str
    reply: str
    replied_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, r: Review) -> "ReviewResponse":
        return cls(
            id=r.id,
            hotel_id=r.hotel_id,
            user_id=r.user_id,
            author_name=r.author_name,
            stars=r.stars,
            comment=r.comment,
            reply=r.reply,
            replied_at=r.replied_at,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )


class ReviewBody(BaseModel):
    stars: int
    comment: str = Field(default="", max_length=1000)


class ReplyBody(BaseModel):
    text: str = Field(default="", max_length=1000)


class ReservationBody(BaseModel):
    check_in: date
    check_out: date
    guests: int
    phone: str = Field(max_length=30)
    rooms: int = 1
    message: str = Field(default="", max_length=1000)

    def to_data(self) -> ReservationData:
        return ReservationData(**self.model_dump())


class NoteBody(BaseModel):
    note: str = Field(default="", max_length=600)


class ReservationResponse(BaseModel):
    id: UUID
    hotel_id: UUID
    customer_name: str
    phone: str
    check_in: date
    check_out: date
    nights: int
    guests: int
    rooms: int
    message: str
    status: ReservationStatus
    hotel_note: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, r: Reservation) -> "ReservationResponse":
        return cls(
            id=r.id,
            hotel_id=r.hotel_id,
            customer_name=r.customer_name,
            phone=r.phone,
            check_in=r.check_in,
            check_out=r.check_out,
            nights=r.nights,
            guests=r.guests,
            rooms=r.rooms,
            message=r.message,
            status=r.status,
            hotel_note=r.hotel_note,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )


class StayHotel(BaseModel):
    name: str
    photo: str
    phone: str
    whatsapp: str
    address: str


class MyReservationResponse(ReservationResponse):
    hotel: StayHotel

    @classmethod
    def from_view(cls, v: ReservationView) -> "MyReservationResponse":
        base = ReservationResponse.from_domain(v.reservation).model_dump()
        hotel = StayHotel(
            name=v.hotel_name,
            photo=v.hotel_photo,
            phone=v.hotel_phone,
            whatsapp=v.hotel_whatsapp,
            address=v.hotel_address,
        )
        return cls(**base, hotel=hotel)


class HotelRowResponse(BaseModel):
    hotel: HotelResponse
    has_access: bool

    @classmethod
    def from_row(cls, row: HotelRow) -> "HotelRowResponse":
        return cls(hotel=HotelResponse.from_card(row.card), has_access=row.has_access)


class RecommendedBody(BaseModel):
    recommended: bool
    banner_url: str = Field(default="", max_length=300)


# --- Turistas -------------------------------------------------------------------------------


@router.get("/hotels", response_model=list[HotelResponse])
async def list_hotels(app: LodgingDep) -> list[HotelResponse]:
    """Hospedajes de Neira: primero los recomendados, luego los mejor calificados."""
    return [HotelResponse.from_card(c) for c in await app.list_hotels()]


@router.get("/hotels/{hotel_id}", response_model=HotelResponse)
async def get_hotel(hotel_id: UUID, app: LodgingDep) -> HotelResponse:
    return HotelResponse.from_card(await app.get_hotel(hotel_id))


@router.get("/hotels/{hotel_id}/reviews", response_model=list[ReviewResponse])
async def list_hotel_reviews(hotel_id: UUID, app: LodgingDep) -> list[ReviewResponse]:
    return [ReviewResponse.from_domain(r) for r in await app.list_hotel_reviews(hotel_id)]


@router.put("/hotels/{hotel_id}/reviews/mine", response_model=ReviewResponse)
async def rate_hotel(
    hotel_id: UUID, body: ReviewBody, user: CurrentUser, app: LodgingDep
) -> ReviewResponse:
    """Califica el hospedaje (1 a 5 estrellas). Si ya lo había calificado, actualiza su reseña."""
    review = await app.rate_hotel(hotel_id, user.id, user.full_name, body.stars, body.comment)
    return ReviewResponse.from_domain(review)


@router.post(
    "/hotels/{hotel_id}/reservations", response_model=MyReservationResponse, status_code=201
)
async def request_reservation(
    hotel_id: UUID, body: ReservationBody, user: CurrentUser, app: LodgingDep
) -> MyReservationResponse:
    """Pide una reserva; el hospedaje la confirma o la rechaza."""
    view = await app.request_reservation(hotel_id, user.id, user.full_name, body.to_data())
    return MyReservationResponse.from_view(view)


@router.get("/reservations/mine", response_model=list[MyReservationResponse])
async def list_my_reservations(user: CurrentUser, app: LodgingDep) -> list[MyReservationResponse]:
    return [MyReservationResponse.from_view(v) for v in await app.list_my_reservations(user.id)]


@router.put("/reservations/{reservation_id}/cancel", response_model=MyReservationResponse)
async def cancel_reservation(
    reservation_id: UUID, user: CurrentUser, app: LodgingDep
) -> MyReservationResponse:
    return MyReservationResponse.from_view(await app.cancel_reservation(user.id, reservation_id))


# --- Panel del hospedaje --------------------------------------------------------------------


@router.get("/me", response_model=HotelResponse)
async def get_my_hotel(user: RequireHotel, app: LodgingDep) -> HotelResponse:
    """El hospedaje de la cuenta (404 si todavía no lo ha creado)."""
    return HotelResponse.from_card(await app.get_my_hotel(user.id))


@router.put("/me", response_model=HotelResponse)
async def save_my_hotel(body: HotelRequest, user: RequireHotel, app: LodgingDep) -> HotelResponse:
    return HotelResponse.from_card(await app.save_my_hotel(user.id, body.to_data()))


@router.get("/me/reviews", response_model=list[ReviewResponse])
async def list_my_hotel_reviews(user: RequireHotel, app: LodgingDep) -> list[ReviewResponse]:
    return [ReviewResponse.from_domain(r) for r in await app.list_my_hotel_reviews(user.id)]


@router.put("/me/reviews/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    review_id: UUID, body: ReplyBody, user: RequireHotel, app: LodgingDep
) -> ReviewResponse:
    """Responde una reseña (texto vacío borra la respuesta)."""
    return ReviewResponse.from_domain(await app.reply_to_review(user.id, review_id, body.text))


@router.get("/me/reservations", response_model=list[ReservationResponse])
async def list_hotel_reservations(user: RequireHotel, app: LodgingDep) -> list[ReservationResponse]:
    return [ReservationResponse.from_domain(r) for r in await app.list_hotel_reservations(user.id)]


@router.put("/me/reservations/{reservation_id}/confirm", response_model=ReservationResponse)
async def confirm_reservation(
    reservation_id: UUID, body: NoteBody, user: RequireHotel, app: LodgingDep
) -> ReservationResponse:
    reservation = await app.answer_reservation(user.id, reservation_id, True, body.note)
    return ReservationResponse.from_domain(reservation)


@router.put("/me/reservations/{reservation_id}/decline", response_model=ReservationResponse)
async def decline_reservation(
    reservation_id: UUID, body: NoteBody, user: RequireHotel, app: LodgingDep
) -> ReservationResponse:
    reservation = await app.answer_reservation(user.id, reservation_id, False, body.note)
    return ReservationResponse.from_domain(reservation)


# --- Administrador --------------------------------------------------------------------------


@router.get("/admin/hotels", response_model=list[HotelRowResponse])
async def list_hotels_for_admin(_admin: RequireAdmin, app: LodgingDep) -> list[HotelRowResponse]:
    """Todos los hospedajes (también los ocultos), primero los recomendados."""
    return [HotelRowResponse.from_row(r) for r in await app.list_hotels_for_admin()]


@router.put("/admin/hotels/{hotel_id}/recommended", response_model=HotelResponse)
async def set_recommended(
    hotel_id: UUID, body: RecommendedBody, _admin: RequireAdmin, app: LodgingDep
) -> HotelResponse:
    """Decide si sale en "Hoteles recomendados" y la imagen de fondo de su banner."""
    card = await app.set_recommended(hotel_id, body.recommended, body.banner_url)
    return HotelResponse.from_card(card)
