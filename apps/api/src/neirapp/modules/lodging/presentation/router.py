from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.lodging.application.plans import Billing, HotelRow, Plan
from neirapp.modules.lodging.application.use_cases import HotelCard, ReservationView
from neirapp.modules.lodging.domain.hotels import (
    MAX_DESCRIPTION,
    MAX_PHOTOS,
    Amenity,
    HotelData,
    HotelKind,
)
from neirapp.modules.lodging.domain.payments import (
    MAX_REFERENCE,
    PLAN_DAYS,
    PLAN_FEES_COP,
    HotelPayment,
    PaymentStatus,
    PlanKind,
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
    is_recommended: bool  # Plan Destacado al día: sale en "Hoteles recomendados"
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
            is_recommended=card.featured,
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


class PaymentResponse(BaseModel):
    id: UUID
    kind: PlanKind
    status: PaymentStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    starts_at: datetime | None
    expires_at: datetime | None

    @classmethod
    def from_domain(cls, p: HotelPayment) -> "PaymentResponse":
        return cls(
            id=p.id,
            kind=p.kind,
            status=p.status,
            amount_cop=p.amount_cop,
            reference=p.reference,
            note=p.note,
            requested_at=p.requested_at,
            starts_at=p.starts_at,
            expires_at=p.expires_at,
        )


def _pay(p: HotelPayment | None) -> PaymentResponse | None:
    return PaymentResponse.from_domain(p) if p else None


class PlanResponse(BaseModel):
    kind: PlanKind
    fee_cop: int
    days: int = PLAN_DAYS
    until: datetime | None
    pending: PaymentResponse | None
    rejected: PaymentResponse | None

    @classmethod
    def from_domain(cls, plan: Plan) -> "PlanResponse":
        return cls(
            kind=plan.kind,
            fee_cop=PLAN_FEES_COP[plan.kind],
            until=plan.until,
            pending=_pay(plan.pending),
            rejected=_pay(plan.rejected),
        )


class BillingResponse(BaseModel):
    listing: PlanResponse
    featured: PlanResponse
    history: list[PaymentResponse]

    @classmethod
    def from_domain(cls, b: Billing) -> "BillingResponse":
        return cls(
            listing=PlanResponse.from_domain(b.listing),
            featured=PlanResponse.from_domain(b.featured),
            history=[PaymentResponse.from_domain(p) for p in b.history],
        )


class HotelRowResponse(BaseModel):
    hotel: HotelResponse
    billing: BillingResponse
    has_access: bool

    @classmethod
    def from_row(cls, row: HotelRow) -> "HotelRowResponse":
        return cls(
            hotel=HotelResponse.from_card(row.card),
            billing=BillingResponse.from_domain(row.billing),
            has_access=row.has_access,
        )


class PaymentBody(BaseModel):
    kind: PlanKind
    reference: str = Field(default="", max_length=MAX_REFERENCE * 2)


class KindBody(BaseModel):
    kind: PlanKind


class BannerBody(BaseModel):
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


# --- Planes del hotel ----------------------------------------------------------------------


@router.get("/me/plan", response_model=BillingResponse)
async def get_my_billing(user: RequireHotel, app: LodgingDep) -> BillingResponse:
    """Hasta cuándo aparece y está destacado, los pagos en revisión y el historial."""
    return BillingResponse.from_domain(await app.get_my_billing(user.id))


@router.post("/me/plan/payments", response_model=BillingResponse, status_code=201)
async def request_plan_payment(
    body: PaymentBody, user: RequireHotel, app: LodgingDep
) -> BillingResponse:
    """Reporta el pago de un mes ($ 25.000 aparecer, $ 4.900 destacado); el admin lo confirma."""
    billing = await app.request_plan_payment(user.id, body.kind, body.reference)
    return BillingResponse.from_domain(billing)


@router.put("/me/plan/payments/{payment_id}/cancel", response_model=BillingResponse)
async def cancel_plan_payment(
    payment_id: UUID, user: RequireHotel, app: LodgingDep
) -> BillingResponse:
    return BillingResponse.from_domain(await app.cancel_plan_payment(user.id, payment_id))


# --- Administrador --------------------------------------------------------------------------


@router.get("/admin/hotels", response_model=list[HotelRowResponse])
async def list_hotels_for_admin(_admin: RequireAdmin, app: LodgingDep) -> list[HotelRowResponse]:
    """Todos los hoteles con sus planes; primero los que tienen un pago por confirmar."""
    return [HotelRowResponse.from_row(r) for r in await app.list_hotels_for_admin()]


@router.put("/admin/payments/{payment_id}/approve", response_model=PaymentResponse)
async def approve_plan_payment(
    payment_id: UUID, _admin: RequireAdmin, app: LodgingDep
) -> PaymentResponse:
    return PaymentResponse.from_domain(await app.approve_plan_payment(payment_id))


@router.put("/admin/payments/{payment_id}/reject", response_model=PaymentResponse)
async def reject_plan_payment(
    payment_id: UUID, body: NoteBody, _admin: RequireAdmin, app: LodgingDep
) -> PaymentResponse:
    return PaymentResponse.from_domain(await app.reject_plan_payment(payment_id, body.note))


@router.post("/admin/hotels/{hotel_id}/grant-month", response_model=PaymentResponse)
async def grant_plan_month(
    hotel_id: UUID, body: KindBody, _admin: RequireAdmin, app: LodgingDep
) -> PaymentResponse:
    """Activa un mes de un plan sin pago reportado (cortesía o pago por otro medio)."""
    return PaymentResponse.from_domain(await app.grant_plan_month(hotel_id, body.kind))


@router.put("/admin/hotels/{hotel_id}/end", response_model=HotelResponse)
async def end_plan(
    hotel_id: UUID, body: KindBody, _admin: RequireAdmin, app: LodgingDep
) -> HotelResponse:
    """Quita un plan desde hoy."""
    return HotelResponse.from_card(await app.end_plan(hotel_id, body.kind))


@router.put("/admin/hotels/{hotel_id}/banner", response_model=HotelResponse)
async def set_banner(
    hotel_id: UUID, body: BannerBody, _admin: RequireAdmin, app: LodgingDep
) -> HotelResponse:
    """La imagen de fondo de su banner en "Hoteles recomendados" (vacío: usa su foto principal)."""
    return HotelResponse.from_card(await app.set_banner(hotel_id, body.banner_url))
