from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.venues.application.use_cases import BookingView, VenueCard, VenueRow
from neirapp.modules.venues.domain.bookings import Booking, BookingData, BookingStatus
from neirapp.modules.venues.domain.reviews import Review
from neirapp.modules.venues.domain.venues import (
    MAX_DESCRIPTION,
    MAX_PHOTOS,
    Feature,
    PriceUnit,
    VenueCategory,
    VenueData,
)
from neirapp.modules.venues.presentation.dependencies import VenuesDep

router = APIRouter(prefix="/venues", tags=["venues"])

RequireVenue = Annotated[User, Depends(require_roles(Role.VENUE, Role.ADMIN))]
RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]


class VenueRequest(BaseModel):
    name: str = Field(max_length=200)
    category: VenueCategory
    description: str = Field(max_length=MAX_DESCRIPTION * 2)
    address: str = Field(max_length=240)
    lat: float
    lng: float
    phone: str = Field(max_length=30)
    photos: list[str] = Field(max_length=MAX_PHOTOS * 2)
    tagline: str = Field(default="", max_length=200)
    whatsapp: str = Field(default="", max_length=30)
    email: str = Field(default="", max_length=320)
    features: list[Feature] = Field(default_factory=list, max_length=len(Feature))
    open_time: str = Field(default="08:00", max_length=5)
    close_time: str = Field(default="22:00", max_length=5)
    open_days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6], max_length=7)
    max_people: int = 20
    price_cop: int = 0
    price_unit: PriceUnit = PriceUnit.PERSON
    is_listed: bool = True

    def to_data(self) -> VenueData:
        return VenueData(**self.model_dump())


class VenueResponse(BaseModel):
    id: UUID
    name: str
    category: VenueCategory
    tagline: str
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    whatsapp: str
    email: str
    features: list[Feature]
    photos: list[str]
    open_time: str
    close_time: str
    open_days: list[int]
    max_people: int
    price_cop: int
    price_unit: PriceUnit
    is_listed: bool
    is_featured: bool
    banner_url: str
    rating: float
    reviews_count: int
    updated_at: datetime

    @classmethod
    def from_card(cls, card: VenueCard) -> "VenueResponse":
        v = card.venue
        return cls(
            id=v.user_id,
            name=v.name,
            category=v.category,
            tagline=v.tagline,
            description=v.description,
            address=v.address,
            lat=v.lat,
            lng=v.lng,
            phone=v.phone,
            whatsapp=v.whatsapp,
            email=v.email,
            features=v.features,
            photos=v.photos,
            open_time=v.open_time,
            close_time=v.close_time,
            open_days=v.open_days,
            max_people=v.max_people,
            price_cop=v.price_cop,
            price_unit=v.price_unit,
            is_listed=v.is_listed,
            is_featured=v.is_featured,
            banner_url=v.banner_url,
            rating=card.rating.average,
            reviews_count=card.rating.count,
            updated_at=v.updated_at,
        )


class ReviewResponse(BaseModel):
    id: UUID
    venue_id: UUID
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
            venue_id=r.venue_id,
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


class BookingBody(BaseModel):
    day: date
    at: str = Field(max_length=5, description='Hora "HH:MM"')
    people: int
    phone: str = Field(max_length=30)
    message: str = Field(default="", max_length=1000)

    def to_data(self) -> BookingData:
        return BookingData(**self.model_dump())


class NoteBody(BaseModel):
    note: str = Field(default="", max_length=600)


class BookingResponse(BaseModel):
    id: UUID
    venue_id: UUID
    customer_name: str
    phone: str
    day: date
    at: str
    people: int
    message: str
    status: BookingStatus
    venue_note: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, b: Booking) -> "BookingResponse":
        return cls(
            id=b.id,
            venue_id=b.venue_id,
            customer_name=b.customer_name,
            phone=b.phone,
            day=b.day,
            at=b.at,
            people=b.people,
            message=b.message,
            status=b.status,
            venue_note=b.venue_note,
            created_at=b.created_at,
            updated_at=b.updated_at,
        )


class BookingVenue(BaseModel):
    name: str
    photo: str
    phone: str
    whatsapp: str
    address: str
    lat: float
    lng: float


class MyBookingResponse(BookingResponse):
    venue: BookingVenue

    @classmethod
    def from_view(cls, v: BookingView) -> "MyBookingResponse":
        base = BookingResponse.from_domain(v.booking).model_dump()
        venue = BookingVenue(
            name=v.venue_name,
            photo=v.venue_photo,
            phone=v.venue_phone,
            whatsapp=v.venue_whatsapp,
            address=v.venue_address,
            lat=v.venue_lat,
            lng=v.venue_lng,
        )
        return cls(**base, venue=venue)


class VenueRowResponse(BaseModel):
    venue: VenueResponse
    has_access: bool

    @classmethod
    def from_row(cls, row: VenueRow) -> "VenueRowResponse":
        return cls(venue=VenueResponse.from_card(row.card), has_access=row.has_access)


class FeaturedBody(BaseModel):
    featured: bool
    banner_url: str = Field(default="", max_length=300)


# --- Clientes -------------------------------------------------------------------------------


@router.get("/places", response_model=list[VenueResponse])
async def list_venues(app: VenuesDep) -> list[VenueResponse]:
    """Lugares de Neira que se reservan: primero los destacados, luego los mejor calificados."""
    return [VenueResponse.from_card(c) for c in await app.list_venues()]


@router.get("/places/{venue_id}", response_model=VenueResponse)
async def get_venue(venue_id: UUID, app: VenuesDep) -> VenueResponse:
    return VenueResponse.from_card(await app.get_venue(venue_id))


@router.get("/places/{venue_id}/reviews", response_model=list[ReviewResponse])
async def list_venue_reviews(venue_id: UUID, app: VenuesDep) -> list[ReviewResponse]:
    return [ReviewResponse.from_domain(r) for r in await app.list_venue_reviews(venue_id)]


@router.put("/places/{venue_id}/reviews/mine", response_model=ReviewResponse)
async def rate_venue(
    venue_id: UUID, body: ReviewBody, user: CurrentUser, app: VenuesDep
) -> ReviewResponse:
    """Califica el lugar (1 a 5 estrellas). Si ya lo había calificado, actualiza su reseña."""
    review = await app.rate_venue(venue_id, user.id, user.full_name, body.stars, body.comment)
    return ReviewResponse.from_domain(review)


@router.post("/places/{venue_id}/bookings", response_model=MyBookingResponse, status_code=201)
async def request_booking(
    venue_id: UUID, body: BookingBody, user: CurrentUser, app: VenuesDep
) -> MyBookingResponse:
    """Pide una reserva (fecha, hora y personas); el lugar la confirma o la rechaza."""
    view = await app.request_booking(venue_id, user.id, user.full_name, body.to_data())
    return MyBookingResponse.from_view(view)


@router.get("/bookings/mine", response_model=list[MyBookingResponse])
async def list_my_bookings(user: CurrentUser, app: VenuesDep) -> list[MyBookingResponse]:
    return [MyBookingResponse.from_view(v) for v in await app.list_my_bookings(user.id)]


@router.put("/bookings/{booking_id}/cancel", response_model=MyBookingResponse)
async def cancel_booking(booking_id: UUID, user: CurrentUser, app: VenuesDep) -> MyBookingResponse:
    return MyBookingResponse.from_view(await app.cancel_booking(user.id, booking_id))


# --- Panel del establecimiento --------------------------------------------------------------


@router.get("/me", response_model=VenueResponse)
async def get_my_venue(user: RequireVenue, app: VenuesDep) -> VenueResponse:
    """El lugar de la cuenta (404 si todavía no lo ha creado)."""
    return VenueResponse.from_card(await app.get_my_venue(user.id))


@router.put("/me", response_model=VenueResponse)
async def save_my_venue(body: VenueRequest, user: RequireVenue, app: VenuesDep) -> VenueResponse:
    return VenueResponse.from_card(await app.save_my_venue(user.id, body.to_data()))


@router.get("/me/reviews", response_model=list[ReviewResponse])
async def list_my_venue_reviews(user: RequireVenue, app: VenuesDep) -> list[ReviewResponse]:
    return [ReviewResponse.from_domain(r) for r in await app.list_my_venue_reviews(user.id)]


@router.put("/me/reviews/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    review_id: UUID, body: ReplyBody, user: RequireVenue, app: VenuesDep
) -> ReviewResponse:
    """Responde una reseña (texto vacío borra la respuesta)."""
    return ReviewResponse.from_domain(await app.reply_to_review(user.id, review_id, body.text))


@router.get("/me/bookings", response_model=list[BookingResponse])
async def list_venue_bookings(user: RequireVenue, app: VenuesDep) -> list[BookingResponse]:
    return [BookingResponse.from_domain(b) for b in await app.list_venue_bookings(user.id)]


@router.put("/me/bookings/{booking_id}/confirm", response_model=BookingResponse)
async def confirm_booking(
    booking_id: UUID, body: NoteBody, user: RequireVenue, app: VenuesDep
) -> BookingResponse:
    booking = await app.answer_booking(user.id, booking_id, True, body.note)
    return BookingResponse.from_domain(booking)


@router.put("/me/bookings/{booking_id}/decline", response_model=BookingResponse)
async def decline_booking(
    booking_id: UUID, body: NoteBody, user: RequireVenue, app: VenuesDep
) -> BookingResponse:
    booking = await app.answer_booking(user.id, booking_id, False, body.note)
    return BookingResponse.from_domain(booking)


# --- Administrador --------------------------------------------------------------------------


@router.get("/admin/places", response_model=list[VenueRowResponse])
async def list_venues_for_admin(_admin: RequireAdmin, app: VenuesDep) -> list[VenueRowResponse]:
    """Todos los lugares (también los ocultos), primero los destacados."""
    return [VenueRowResponse.from_row(r) for r in await app.list_venues_for_admin()]


@router.put("/admin/places/{venue_id}/featured", response_model=VenueResponse)
async def set_featured(
    venue_id: UUID, body: FeaturedBody, _admin: RequireAdmin, app: VenuesDep
) -> VenueResponse:
    """Decide si sale en "Lugares destacados" y la imagen de fondo de su banner."""
    card = await app.set_featured(venue_id, body.featured, body.banner_url)
    return VenueResponse.from_card(card)
