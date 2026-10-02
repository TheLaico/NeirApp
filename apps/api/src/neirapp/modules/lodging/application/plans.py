"""Planes del hotel: aparecer en Hospedaje ($ 25.000 al mes) y destacarse ($ 4.900 al mes, sale en
"Hoteles recomendados"). Sin pasarela: el hotel paga por fuera y reporta el comprobante, y el
administrador lo confirma, lo rechaza o activa un mes directamente."""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID

from neirapp.modules.lodging.application.ports import (
    AccessPort,
    HotelRepository,
    NotifierPort,
    PaymentRepository,
    ReviewRepository,
)
from neirapp.modules.lodging.application.use_cases import HotelCard, _card, _own_hotel
from neirapp.modules.lodging.domain.errors import (
    HotelRequired,
    PaymentNotFound,
    PaymentPending,
)
from neirapp.modules.lodging.domain.hotels import Hotel
from neirapp.modules.lodging.domain.payments import HotelPayment, PaymentStatus, PlanKind
from neirapp.modules.lodging.domain.reviews import Rating
from neirapp.shared.application.ports import Clock

MY_PLAN = "/hotel?seccion=plan"
COLOMBIA = timezone(timedelta(hours=-5))
_MONTHS = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)  # fmt: skip


def _day(moment: datetime) -> str:
    local = moment.astimezone(COLOMBIA)
    return f"{local.day} de {_MONTHS[local.month - 1]}"


@dataclass(frozen=True)
class Plan:
    """Un plan del hotel: hasta cuándo lo tiene, el pago en revisión y el último rechazado."""

    kind: PlanKind
    until: datetime | None
    pending: HotelPayment | None
    rejected: HotelPayment | None


@dataclass(frozen=True)
class Billing:
    listing: Plan
    featured: Plan
    history: list[HotelPayment]  # Los aprobados, los más recientes primero


def _until(hotel: Hotel | None, kind: PlanKind) -> datetime | None:
    if hotel is None:
        return None
    return hotel.paid_until if kind is PlanKind.LISTING else hotel.featured_until


def _plan(hotel: Hotel | None, kind: PlanKind, payments: list[HotelPayment]) -> Plan:
    mine = [p for p in payments if p.kind is kind]
    pending = next((p for p in mine if p.status is PaymentStatus.PENDING), None)
    last = mine[0] if mine else None
    rejected = last if last and last.status is PaymentStatus.REJECTED else None
    return Plan(kind, _until(hotel, kind), pending, rejected)


def _billing(hotel: Hotel | None, payments: list[HotelPayment]) -> Billing:
    return Billing(
        _plan(hotel, PlanKind.LISTING, payments),
        _plan(hotel, PlanKind.FEATURED, payments),
        [p for p in payments if p.status is PaymentStatus.APPROVED],
    )


class GetMyBilling:
    def __init__(self, hotels: HotelRepository, payments: PaymentRepository) -> None:
        self._hotels = hotels
        self._payments = payments

    async def __call__(self, user_id: UUID) -> Billing:
        return _billing(await self._hotels.get(user_id), await self._payments.list_for(user_id))


class RequestPlanPayment:
    """El hotel pagó (por fuera) un mes de un plan y lo reporta para que lo confirmen."""

    def __init__(self, hotels: HotelRepository, payments: PaymentRepository, clock: Clock) -> None:
        self._hotels = hotels
        self._payments = payments
        self._clock = clock

    async def __call__(self, user_id: UUID, kind: PlanKind, reference: str) -> Billing:
        hotel = await self._hotels.get(user_id)
        if hotel is None:
            raise HotelRequired()
        mine = await self._payments.list_for(user_id)
        if any(p.kind is kind and p.status is PaymentStatus.PENDING for p in mine):
            raise PaymentPending()
        payment = HotelPayment.request(user_id, kind, reference, self._clock.now())
        await self._payments.save(payment)
        return _billing(hotel, await self._payments.list_for(user_id))


class CancelPlanPayment:
    def __init__(self, hotels: HotelRepository, payments: PaymentRepository) -> None:
        self._hotels = hotels
        self._payments = payments

    async def __call__(self, user_id: UUID, payment_id: UUID) -> Billing:
        payment = await self._payments.get(payment_id)
        if payment is None or payment.hotel_id != user_id:
            raise PaymentNotFound()
        payment.cancel()
        await self._payments.save(payment)
        return _billing(await self._hotels.get(user_id), await self._payments.list_for(user_id))


@dataclass(frozen=True)
class HotelRow:
    """Para el administrador: un hotel con su calificación, sus planes y si tiene acceso."""

    card: HotelCard
    billing: Billing
    has_access: bool


class ListHotelsForAdmin:
    """Todos los hoteles con ficha; primero los que tienen un pago por confirmar."""

    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        payments: PaymentRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._payments = payments
        self._access = access
        self._clock = clock

    async def __call__(self) -> list[HotelRow]:
        allowed = await self._access.hotel_ids()
        ratings = await self._reviews.ratings()
        everything = await self._payments.list_all()
        now = self._clock.now()
        rows = [
            HotelRow(
                _card(h, ratings.get(h.user_id, Rating(0.0, 0)), now),
                _billing(h, [p for p in everything if p.hotel_id == h.user_id]),
                h.user_id in allowed,
            )
            for h in await self._hotels.list_all()
        ]

        def oldest_pending(row: HotelRow) -> float:
            pending = [p for p in (row.billing.listing.pending, row.billing.featured.pending) if p]
            return min((p.requested_at.timestamp() for p in pending), default=float("inf"))

        return sorted(rows, key=lambda r: (oldest_pending(r), r.card.hotel.name.lower()))


_NOTICES = {
    PlanKind.LISTING: (
        "hotel_plan_activated",
        "Tu hotel ya aparece en Hospedaje",
        "{name} aparece en Hospedaje hasta el {day}.",
    ),
    PlanKind.FEATURED: (
        "hotel_featured",
        "Tu hotel está destacado",
        "{name} sale en Hoteles recomendados hasta el {day}.",
    ),
}


async def _activate(
    hotels: HotelRepository,
    payments: PaymentRepository,
    notifier: NotifierPort,
    hotel: Hotel,
    payment: HotelPayment,
    now: datetime,
) -> HotelPayment:
    # Si todavía le quedaba tiempo pagado, el mes nuevo empieza cuando termine: no pierde días.
    current = _until(hotel, payment.kind)
    payment.approve(current if current and current > now else now, now)
    if payment.kind is PlanKind.LISTING:
        hotel.paid_until = payment.expires_at
    else:
        hotel.featured_until = payment.expires_at
    await payments.save(payment)
    await hotels.save(hotel)
    kind, title, body = _NOTICES[payment.kind]
    day = _day(payment.expires_at or now)
    await notifier.notify(
        hotel.user_id, kind, title, body.format(name=hotel.name, day=day), MY_PLAN
    )
    return payment


class ApprovePlanPayment:
    """El administrador vio el pago: el plan corre 30 días más."""

    def __init__(
        self,
        hotels: HotelRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID) -> HotelPayment:
        payment = await self._payments.get(payment_id)
        hotel = await self._hotels.get(payment.hotel_id) if payment else None
        if payment is None or hotel is None:
            raise PaymentNotFound()
        return await _activate(
            self._hotels, self._payments, self._notifier, hotel, payment, self._clock.now()
        )


class GrantPlanMonth:
    """El administrador activa un mes directamente (cortesía o pago recibido por otro medio)."""

    def __init__(
        self,
        hotels: HotelRepository,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, hotel_id: UUID, kind: PlanKind) -> HotelPayment:
        hotel = await _own_hotel(self._hotels, hotel_id)
        now = self._clock.now()
        payment = HotelPayment.request(hotel_id, kind, "Activado por el administrador", now)
        return await _activate(self._hotels, self._payments, self._notifier, hotel, payment, now)


class RejectPlanPayment:
    def __init__(
        self,
        payments: PaymentRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._payments = payments
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, payment_id: UUID, note: str) -> HotelPayment:
        payment = await self._payments.get(payment_id)
        if payment is None:
            raise PaymentNotFound()
        payment.reject(note, self._clock.now())
        await self._payments.save(payment)
        await self._notifier.notify(
            payment.hotel_id,
            "hotel_payment_rejected",
            "No pudimos confirmar tu pago",
            f"{payment.note.rstrip('.')}. Revisa el pago y vuelve a enviarlo.",
            MY_PLAN,
        )
        return payment


class EndPlan:
    """El administrador quita un plan desde hoy."""

    def __init__(self, hotels: HotelRepository, reviews: ReviewRepository, clock: Clock) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._clock = clock

    async def __call__(self, hotel_id: UUID, kind: PlanKind) -> HotelCard:
        hotel = await _own_hotel(self._hotels, hotel_id)
        now = self._clock.now()
        current = _until(hotel, kind)
        if current and current > now:
            if kind is PlanKind.LISTING:
                hotel.paid_until = now
            else:
                hotel.featured_until = now
            await self._hotels.save(hotel)
        return _card(hotel, Rating.of(await self._reviews.list_for(hotel_id)), now)


class SetBanner:
    """El administrador elige la imagen de fondo del banner del hotel en "Hoteles recomendados"."""

    def __init__(self, hotels: HotelRepository, reviews: ReviewRepository, clock: Clock) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._clock = clock

    async def __call__(self, hotel_id: UUID, banner_url: str) -> HotelCard:
        hotel = await _own_hotel(self._hotels, hotel_id)
        hotel.set_banner(banner_url)
        await self._hotels.save(hotel)
        rating = Rating.of(await self._reviews.list_for(hotel_id))
        return _card(hotel, rating, self._clock.now())
