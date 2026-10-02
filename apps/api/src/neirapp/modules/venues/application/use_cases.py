from dataclasses import dataclass
from datetime import date, timedelta, timezone
from uuid import UUID

from neirapp.modules.venues.application.ports import (
    AccessPort,
    BookingRepository,
    NotifierPort,
    ReviewRepository,
    VenueRepository,
)
from neirapp.modules.venues.domain.bookings import Booking, BookingData, BookingStatus
from neirapp.modules.venues.domain.errors import (
    BookingNotFound,
    CannotBookOwnVenue,
    CannotReviewOwnVenue,
    NotYourVenue,
    ReviewNotFound,
    TooManyPendingBookings,
    VenueNotFound,
)
from neirapp.modules.venues.domain.reviews import Rating, Review
from neirapp.modules.venues.domain.venues import Venue, VenueData
from neirapp.shared.application.ports import Clock

# A dónde lleva cada aviso en el frontend.
VENUE_BOOKINGS = "/establecimiento?seccion=bookings"
VENUE_REVIEWS = "/establecimiento?seccion=reviews"
MY_BOOKINGS = "/reservas/mis-reservas"
COLOMBIA = timezone(timedelta(hours=-5))  # Sin horario de verano
MAX_PENDING_PER_VENUE = 3
_MONTHS = (
    "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
)  # fmt: skip


def _day(d: date) -> str:
    return f"{d.day} {_MONTHS[d.month - 1]}"


def _when(b: Booking) -> str:
    hour, minute = (int(x) for x in b.at.split(":"))
    suffix = "a. m." if hour < 12 else "p. m."
    return f"el {_day(b.day)} a las {hour % 12 or 12}:{minute:02d} {suffix}"


def _people(n: int) -> str:
    return "1 persona" if n == 1 else f"{n} personas"


def _first(name: str) -> str:
    return name.split(" ")[0] if name else "Alguien"


@dataclass(frozen=True)
class VenueCard:
    """Un lugar con su calificación, como lo ven los clientes."""

    venue: Venue
    rating: Rating


async def _public_venue(venues: VenueRepository, access: AccessPort, venue_id: UUID) -> Venue:
    venue = await venues.get(venue_id)
    if venue is None or not venue.is_listed or venue_id not in await access.venue_ids():
        raise VenueNotFound()
    return venue


async def _own_venue(venues: VenueRepository, user_id: UUID) -> Venue:
    venue = await venues.get(user_id)
    if venue is None:
        raise VenueNotFound()
    return venue


class GetMyVenue:
    def __init__(self, venues: VenueRepository, reviews: ReviewRepository) -> None:
        self._venues = venues
        self._reviews = reviews

    async def __call__(self, user_id: UUID) -> VenueCard:
        venue = await _own_venue(self._venues, user_id)
        return VenueCard(venue, Rating.of(await self._reviews.list_for(user_id)))


class SaveMyVenue:
    """Crea el lugar la primera vez y lo actualiza las siguientes."""

    def __init__(self, venues: VenueRepository, reviews: ReviewRepository, clock: Clock) -> None:
        self._venues = venues
        self._reviews = reviews
        self._clock = clock

    async def __call__(self, user_id: UUID, data: VenueData) -> VenueCard:
        now = self._clock.now()
        venue = await self._venues.get(user_id)
        if venue is None:
            venue = Venue.create(user_id, data, now)
        else:
            venue.update(data, now)
        await self._venues.save(venue)
        return VenueCard(venue, Rating.of(await self._reviews.list_for(user_id)))


class ListVenues:
    """Lo que ven los clientes: lugares autorizados y visibles. Primero los destacados, luego los
    mejor calificados."""

    def __init__(
        self, venues: VenueRepository, reviews: ReviewRepository, access: AccessPort
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._access = access

    async def __call__(self) -> list[VenueCard]:
        allowed = await self._access.venue_ids()
        ratings = await self._reviews.ratings()
        cards = [
            VenueCard(v, ratings.get(v.user_id, Rating(0.0, 0)))
            for v in await self._venues.list_all()
            if v.user_id in allowed and v.is_listed
        ]
        return sorted(
            cards,
            key=lambda c: (
                not c.venue.is_featured,
                -c.rating.average,
                -c.rating.count,
                c.venue.name.lower(),
            ),
        )


class GetVenue:
    def __init__(
        self, venues: VenueRepository, reviews: ReviewRepository, access: AccessPort
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._access = access

    async def __call__(self, venue_id: UUID) -> VenueCard:
        venue = await _public_venue(self._venues, self._access, venue_id)
        return VenueCard(venue, Rating.of(await self._reviews.list_for(venue_id)))


class ListVenueReviews:
    def __init__(
        self, venues: VenueRepository, reviews: ReviewRepository, access: AccessPort
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._access = access

    async def __call__(self, venue_id: UUID) -> list[Review]:
        await _public_venue(self._venues, self._access, venue_id)
        return await self._reviews.list_for(venue_id)


class RateVenue:
    """Califica un lugar (1 a 5 estrellas). Una reseña por persona: la repite y se actualiza."""

    def __init__(
        self,
        venues: VenueRepository,
        reviews: ReviewRepository,
        access: AccessPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._access = access
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, venue_id: UUID, user_id: UUID, author: str, stars: int, comment: str
    ) -> Review:
        venue = await _public_venue(self._venues, self._access, venue_id)
        if venue.user_id == user_id:
            raise CannotReviewOwnVenue()
        now = self._clock.now()
        review = await self._reviews.get_by(venue_id, user_id)
        is_new = review is None
        if review is None:
            review = Review.create(venue_id, user_id, author, stars, comment, now)
        else:
            review.edit(stars, comment, now)
            review.author_name = author
        await self._reviews.save(review)
        if is_new:
            await self._notifier.notify(
                venue.user_id,
                "venue_review_new",
                f"Nueva reseña de {review.stars} ★",
                f"{_first(author)} calificó {venue.name}. Respóndele desde tu panel.",
                VENUE_REVIEWS,
            )
        return review


class ListMyVenueReviews:
    def __init__(self, venues: VenueRepository, reviews: ReviewRepository) -> None:
        self._venues = venues
        self._reviews = reviews

    async def __call__(self, owner_id: UUID) -> list[Review]:
        await _own_venue(self._venues, owner_id)
        return await self._reviews.list_for(owner_id)


class ReplyToReview:
    """El lugar responde (o borra su respuesta, con texto vacío) una reseña."""

    def __init__(
        self,
        venues: VenueRepository,
        reviews: ReviewRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, owner_id: UUID, review_id: UUID, text: str) -> Review:
        review = await self._reviews.get(review_id)
        if review is None:
            raise ReviewNotFound()
        if review.venue_id != owner_id:
            raise NotYourVenue()
        venue = await _own_venue(self._venues, owner_id)
        had_reply = bool(review.reply)
        review.answer(text, self._clock.now())
        await self._reviews.save(review)
        if review.reply and not had_reply:
            await self._notifier.notify(
                review.user_id,
                "venue_review_reply",
                f"{venue.name} respondió tu reseña",
                review.reply[:140],
                f"/reservas/lugar?id={venue.user_id}",
            )
        return review


@dataclass(frozen=True)
class BookingView:
    """Una reserva con los datos del lugar para mostrarla y contactarlo."""

    booking: Booking
    venue_name: str
    venue_photo: str
    venue_phone: str
    venue_whatsapp: str
    venue_address: str
    venue_lat: float
    venue_lng: float


def _view(b: Booking, venue: Venue | None) -> BookingView:
    if venue is None:
        return BookingView(b, "Lugar", "", "", "", "", 0.0, 0.0)
    photo = venue.photos[0] if venue.photos else ""
    return BookingView(
        b, venue.name, photo, venue.phone, venue.whatsapp, venue.address, venue.lat, venue.lng
    )


class RequestBooking:
    """El cliente pide fecha, hora y personas; el lugar confirma o rechaza. NeirAPP no cobra."""

    def __init__(
        self,
        venues: VenueRepository,
        bookings: BookingRepository,
        access: AccessPort,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._venues = venues
        self._bookings = bookings
        self._access = access
        self._notifier = notifier
        self._clock = clock

    async def __call__(
        self, venue_id: UUID, customer_id: UUID, name: str, data: BookingData
    ) -> BookingView:
        venue = await _public_venue(self._venues, self._access, venue_id)
        if venue.user_id == customer_id:
            raise CannotBookOwnVenue()
        mine = await self._bookings.list_for_customer(customer_id)
        pending = [b for b in mine if b.venue_id == venue_id and b.status is BookingStatus.PENDING]
        if len(pending) >= MAX_PENDING_PER_VENUE:
            raise TooManyPendingBookings()
        now = self._clock.now()
        booking = Booking.request(venue, customer_id, name, data, now.astimezone(COLOMBIA), now)
        await self._bookings.save(booking)
        await self._notifier.notify(
            venue.user_id,
            "booking_new",
            "Nueva solicitud de reserva",
            f"{_first(name)} quiere reservar {_when(booking)} para {_people(booking.people)}.",
            VENUE_BOOKINGS,
        )
        return _view(booking, venue)


class ListMyBookings:
    def __init__(self, venues: VenueRepository, bookings: BookingRepository) -> None:
        self._venues = venues
        self._bookings = bookings

    async def __call__(self, customer_id: UUID) -> list[BookingView]:
        cache: dict[UUID, Venue | None] = {}
        views = []
        for b in await self._bookings.list_for_customer(customer_id):
            if b.venue_id not in cache:
                cache[b.venue_id] = await self._venues.get(b.venue_id)
            views.append(_view(b, cache[b.venue_id]))
        return views


class CancelBooking:
    """El cliente cancela su reserva (pendiente o confirmada)."""

    def __init__(
        self,
        venues: VenueRepository,
        bookings: BookingRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._venues = venues
        self._bookings = bookings
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, customer_id: UUID, booking_id: UUID) -> BookingView:
        booking = await self._bookings.get(booking_id)
        if booking is None or booking.customer_id != customer_id:
            raise BookingNotFound()
        booking.cancel(self._clock.now())
        await self._bookings.save(booking)
        await self._notifier.notify(
            booking.venue_id,
            "booking_cancelled",
            "Cancelaron una reserva",
            f"{_first(booking.customer_name)} canceló su reserva de {_when(booking)}.",
            VENUE_BOOKINGS,
        )
        return _view(booking, await self._venues.get(booking.venue_id))


class ListVenueBookings:
    def __init__(self, venues: VenueRepository, bookings: BookingRepository) -> None:
        self._venues = venues
        self._bookings = bookings

    async def __call__(self, owner_id: UUID) -> list[Booking]:
        await _own_venue(self._venues, owner_id)
        return await self._bookings.list_for_venue(owner_id)


class AnswerBooking:
    """El lugar confirma o rechaza una solicitud, con una nota opcional para el cliente."""

    def __init__(
        self,
        venues: VenueRepository,
        bookings: BookingRepository,
        notifier: NotifierPort,
        clock: Clock,
    ) -> None:
        self._venues = venues
        self._bookings = bookings
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, owner_id: UUID, booking_id: UUID, accept: bool, note: str) -> Booking:
        booking = await self._bookings.get(booking_id)
        if booking is None:
            raise BookingNotFound()
        if booking.venue_id != owner_id:
            raise NotYourVenue()
        venue = await _own_venue(self._venues, owner_id)
        now = self._clock.now()
        if accept:
            booking.confirm(note, now)
            kind, title = "booking_confirmed", f"{venue.name} confirmó tu reserva"
            body = f"Te esperan {_when(booking)} ({_people(booking.people)})."
        else:
            booking.decline(note, now)
            kind, title = "booking_declined", f"{venue.name} no pudo confirmar tu reserva"
            body = booking.venue_note or "No tienen disponibilidad para esa fecha y hora."
        await self._bookings.save(booking)
        await self._notifier.notify(booking.customer_id, kind, title, body, MY_BOOKINGS)
        return booking


@dataclass(frozen=True)
class VenueRow:
    """Para el administrador: un lugar con su calificación y si su cuenta tiene acceso."""

    card: VenueCard
    has_access: bool


class ListVenuesForAdmin:
    def __init__(
        self, venues: VenueRepository, reviews: ReviewRepository, access: AccessPort
    ) -> None:
        self._venues = venues
        self._reviews = reviews
        self._access = access

    async def __call__(self) -> list[VenueRow]:
        allowed = await self._access.venue_ids()
        ratings = await self._reviews.ratings()
        rows = [
            VenueRow(VenueCard(v, ratings.get(v.user_id, Rating(0.0, 0))), v.user_id in allowed)
            for v in await self._venues.list_all()
        ]
        return sorted(rows, key=lambda r: (not r.card.venue.is_featured, r.card.venue.name))


class SetFeatured:
    """El administrador decide si un lugar sale en "Lugares destacados" y con qué fondo."""

    def __init__(self, venues: VenueRepository, reviews: ReviewRepository) -> None:
        self._venues = venues
        self._reviews = reviews

    async def __call__(self, venue_id: UUID, featured: bool, banner_url: str) -> VenueCard:
        venue = await _own_venue(self._venues, venue_id)
        venue.set_featured(featured, banner_url)
        await self._venues.save(venue)
        return VenueCard(venue, Rating.of(await self._reviews.list_for(venue_id)))
