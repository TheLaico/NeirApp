from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from neirapp.modules.lodging.application.ports import (
    AccessPort,
    HotelRepository,
    NotifierPort,
    ReservationRepository,
    ReviewRepository,
)
from neirapp.modules.lodging.domain.errors import (
    CannotBookOwnHotel,
    CannotReviewOwnHotel,
    HotelNotFound,
    NotYourHotel,
    ReservationNotFound,
    ReviewNotFound,
    TooManyPendingReservations,
)
from neirapp.modules.lodging.domain.hotels import Hotel, HotelData
from neirapp.modules.lodging.domain.reservations import (
    Reservation,
    ReservationData,
    ReservationStatus,
)
from neirapp.modules.lodging.domain.reviews import Rating, Review
from neirapp.shared.application.ports import Clock

# A dónde lleva cada aviso en el frontend.
HOTEL_RESERVATIONS = "/hotel?seccion=reservations"
HOTEL_REVIEWS = "/hotel?seccion=reviews"
MY_RESERVATIONS = "/hospedaje/mis-reservas"
COLOMBIA = timezone(timedelta(hours=-5))  # Sin horario de verano
MAX_PENDING_PER_HOTEL = 3
_MONTHS = (
    "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
)  # fmt: skip


def _day(d: date) -> str:
    return f"{d.day} {_MONTHS[d.month - 1]}"


def _stay(r: Reservation) -> str:
    nights = "1 noche" if r.nights == 1 else f"{r.nights} noches"
    return f"del {_day(r.check_in)} al {_day(r.check_out)} ({nights})"


def _first(name: str) -> str:
    return name.split(" ")[0] if name else "Alguien"


@dataclass(frozen=True)
class HotelCard:
    """Un hospedaje con su calificación, como lo ven los turistas."""

    hotel: Hotel
    rating: Rating
    featured: bool  # Sale en "Hoteles recomendados" (plan Destacado al día)


def _card(hotel: Hotel, rating: Rating, now: datetime) -> HotelCard:
    return HotelCard(hotel, rating, hotel.is_featured(now))


async def _public_hotel(
    hotels: HotelRepository, access: AccessPort, hotel_id: UUID, now: datetime
) -> Hotel:
    hotel = await hotels.get(hotel_id)
    if hotel is None or not hotel.is_public(now) or hotel_id not in await access.hotel_ids():
        raise HotelNotFound()
    return hotel


async def _own_hotel(hotels: HotelRepository, user_id: UUID) -> Hotel:
    hotel = await hotels.get(user_id)
    if hotel is None:
        raise HotelNotFound()
    return hotel


class GetMyHotel:
    def __init__(self, hotels: HotelRepository, reviews: ReviewRepository, clock: Clock) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._clock = clock

    async def __call__(self, user_id: UUID) -> HotelCard:
        hotel = await _own_hotel(self._hotels, user_id)
        rating = Rating.of(await self._reviews.list_for(user_id))
        return _card(hotel, rating, self._clock.now())


class SaveMyHotel:
    """Crea el hospedaje la primera vez y lo actualiza las siguientes."""

    def __init__(self, hotels: HotelRepository, reviews: ReviewRepository, clock: Clock) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._clock = clock

    async def __call__(self, user_id: UUID, data: HotelData) -> HotelCard:
        now = self._clock.now()
        hotel = await self._hotels.get(user_id)
        if hotel is None:
            hotel = Hotel.create(user_id, data, now)
        else:
            hotel.update(data, now)
        await self._hotels.save(hotel)
        return _card(hotel, Rating.of(await self._reviews.list_for(user_id)), now)


class ListHotels:
    """Lo que ven los turistas: hospedajes autorizados, con el mes pagado y visibles. Primero los
    destacados (recomendados), luego los mejor calificados."""

    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._access = access
        self._clock = clock

    async def __call__(self) -> list[HotelCard]:
        allowed = await self._access.hotel_ids()
        ratings = await self._reviews.ratings()
        now = self._clock.now()
        cards = [
            _card(h, ratings.get(h.user_id, Rating(0.0, 0)), now)
            for h in await self._hotels.list_all()
            if h.user_id in allowed and h.is_public(now)
        ]
        return sorted(
            cards,
            key=lambda c: (
                not c.featured,
                -c.rating.average,
                -c.rating.count,
                c.hotel.name.lower(),
            ),
        )


class GetHotel:
    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._access = access
        self._clock = clock

    async def __call__(self, hotel_id: UUID) -> HotelCard:
        now = self._clock.now()
        hotel = await _public_hotel(self._hotels, self._access, hotel_id, now)
        return _card(hotel, Rating.of(await self._reviews.list_for(hotel_id)), now)


class ListHotelReviews:
    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        access: AccessPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._access = access
        self._clock = clock

    async def __call__(self, hotel_id: UUID) -> list[Review]:
        await _public_hotel(self._hotels, self._access, hotel_id, self._clock.now())
        return await self._reviews.list_for(hotel_id)


class RateHotel:
    """Califica un hospedaje (1 a 5 estrellas). Una reseña por persona: la repite y se actualiza."""

    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        access: AccessPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._access = access
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, hotel_id: UUID, user_id: UUID, author: str, stars: int, comment: str
    ) -> Review:
        now = self._clock.now()
        hotel = await _public_hotel(self._hotels, self._access, hotel_id, now)
        if hotel.user_id == user_id:
            raise CannotReviewOwnHotel()
        review = await self._reviews.get_by(hotel_id, user_id)
        is_new = review is None
        if review is None:
            review = Review.create(hotel_id, user_id, author, stars, comment, now)
        else:
            review.edit(stars, comment, now)
            review.author_name = author
        await self._reviews.save(review)
        if is_new:
            await self._notifier.notify(
                hotel.user_id,
                "hotel_review_new",
                f"Nueva reseña de {review.stars} ★",
                f"{_first(author)} calificó {hotel.name}. Respóndele desde tu panel.",
                HOTEL_REVIEWS,
            )
        return review


class ListMyHotelReviews:
    def __init__(self, hotels: HotelRepository, reviews: ReviewRepository) -> None:
        self._hotels = hotels
        self._reviews = reviews

    async def __call__(self, owner_id: UUID) -> list[Review]:
        await _own_hotel(self._hotels, owner_id)
        return await self._reviews.list_for(owner_id)


class ReplyToReview:
    """El hospedaje responde (o borra su respuesta, con texto vacío) una reseña."""

    def __init__(
        self,
        hotels: HotelRepository,
        reviews: ReviewRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reviews = reviews
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, owner_id: UUID, review_id: UUID, text: str) -> Review:
        review = await self._reviews.get(review_id)
        if review is None:
            raise ReviewNotFound()
        if review.hotel_id != owner_id:
            raise NotYourHotel()
        hotel = await _own_hotel(self._hotels, owner_id)
        had_reply = bool(review.reply)
        review.answer(text, self._clock.now())
        await self._reviews.save(review)
        if review.reply and not had_reply:
            await self._notifier.notify(
                review.user_id,
                "hotel_review_reply",
                f"{hotel.name} respondió tu reseña",
                review.reply[:140],
                f"/hospedaje/hotel?id={hotel.user_id}",
            )
        return review


@dataclass(frozen=True)
class ReservationView:
    """Una reserva con los datos del hospedaje para mostrarla y contactarlo."""

    reservation: Reservation
    hotel_name: str
    hotel_photo: str
    hotel_phone: str
    hotel_whatsapp: str
    hotel_address: str


def _view(r: Reservation, hotel: Hotel | None) -> ReservationView:
    if hotel is None:
        return ReservationView(r, "Hospedaje", "", "", "", "")
    photo = hotel.photos[0] if hotel.photos else ""
    return ReservationView(r, hotel.name, photo, hotel.phone, hotel.whatsapp, hotel.address)


class RequestReservation:
    """El turista pide fechas; el hospedaje confirma o rechaza. NeirAPP no cobra la estadía."""

    def __init__(
        self,
        hotels: HotelRepository,
        reservations: ReservationRepository,
        access: AccessPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reservations = reservations
        self._access = access
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, hotel_id: UUID, customer_id: UUID, name: str, data: ReservationData
    ) -> ReservationView:
        hotel = await _public_hotel(self._hotels, self._access, hotel_id, self._clock.now())
        if hotel.user_id == customer_id:
            raise CannotBookOwnHotel()
        mine = await self._reservations.list_for_customer(customer_id)
        pending = [
            r for r in mine if r.hotel_id == hotel_id and r.status is ReservationStatus.PENDING
        ]
        if len(pending) >= MAX_PENDING_PER_HOTEL:
            raise TooManyPendingReservations()
        now = self._clock.now()
        today = now.astimezone(COLOMBIA).date()
        reservation = Reservation.request(hotel_id, customer_id, name, data, today, now)
        await self._reservations.save(reservation)
        guests = "1 huésped" if data.guests == 1 else f"{data.guests} huéspedes"
        await self._notifier.notify(
            hotel.user_id,
            "reservation_new",
            "Nueva solicitud de reserva",
            f"{_first(name)} quiere hospedarse {_stay(reservation)}, {guests}.",
            HOTEL_RESERVATIONS,
        )
        return _view(reservation, hotel)


class ListMyReservations:
    def __init__(self, hotels: HotelRepository, reservations: ReservationRepository) -> None:
        self._hotels = hotels
        self._reservations = reservations

    async def __call__(self, customer_id: UUID) -> list[ReservationView]:
        cache: dict[UUID, Hotel | None] = {}
        views = []
        for r in await self._reservations.list_for_customer(customer_id):
            if r.hotel_id not in cache:
                cache[r.hotel_id] = await self._hotels.get(r.hotel_id)
            views.append(_view(r, cache[r.hotel_id]))
        return views


class CancelReservation:
    """El huésped cancela su reserva (pendiente o confirmada)."""

    def __init__(
        self,
        hotels: HotelRepository,
        reservations: ReservationRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reservations = reservations
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, customer_id: UUID, reservation_id: UUID) -> ReservationView:
        reservation = await self._reservations.get(reservation_id)
        if reservation is None or reservation.customer_id != customer_id:
            raise ReservationNotFound()
        reservation.cancel(self._clock.now())
        await self._reservations.save(reservation)
        hotel = await self._hotels.get(reservation.hotel_id)
        await self._notifier.notify(
            reservation.hotel_id,
            "reservation_cancelled",
            "Cancelaron una reserva",
            f"{_first(reservation.customer_name)} canceló su reserva {_stay(reservation)}.",
            HOTEL_RESERVATIONS,
        )
        return _view(reservation, hotel)


class ListHotelReservations:
    def __init__(self, hotels: HotelRepository, reservations: ReservationRepository) -> None:
        self._hotels = hotels
        self._reservations = reservations

    async def __call__(self, owner_id: UUID) -> list[Reservation]:
        await _own_hotel(self._hotels, owner_id)
        return await self._reservations.list_for_hotel(owner_id)


class AnswerReservation:
    """El hospedaje confirma o rechaza una solicitud, con una nota opcional para el huésped."""

    def __init__(
        self,
        hotels: HotelRepository,
        reservations: ReservationRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._hotels = hotels
        self._reservations = reservations
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, owner_id: UUID, reservation_id: UUID, accept: bool, note: str
    ) -> Reservation:
        reservation = await self._reservations.get(reservation_id)
        if reservation is None:
            raise ReservationNotFound()
        if reservation.hotel_id != owner_id:
            raise NotYourHotel()
        hotel = await _own_hotel(self._hotels, owner_id)
        now = self._clock.now()
        if accept:
            reservation.confirm(note, now)
            kind, title = "reservation_confirmed", f"{hotel.name} confirmó tu reserva"
            body = f"Te esperan {_stay(reservation)}. Llegada desde las {hotel.check_in}."
        else:
            reservation.decline(note, now)
            kind, title = "reservation_declined", f"{hotel.name} no pudo confirmar tu reserva"
            body = reservation.hotel_note or "No tienen disponibilidad para esas fechas."
        await self._reservations.save(reservation)
        await self._notifier.notify(reservation.customer_id, kind, title, body, MY_RESERVATIONS)
        return reservation
