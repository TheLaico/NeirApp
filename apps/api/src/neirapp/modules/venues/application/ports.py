from typing import Protocol
from uuid import UUID

from neirapp.modules.venues.domain.bookings import Booking
from neirapp.modules.venues.domain.reviews import Rating, Review
from neirapp.modules.venues.domain.venues import Venue


class VenueRepository(Protocol):
    async def get(self, user_id: UUID) -> Venue | None: ...

    async def save(self, venue: Venue) -> None:
        """Crea o reemplaza el lugar de esa cuenta."""
        ...

    async def list_all(self) -> list[Venue]: ...


class ReviewRepository(Protocol):
    async def get(self, review_id: UUID) -> Review | None: ...

    async def get_by(self, venue_id: UUID, user_id: UUID) -> Review | None: ...

    async def save(self, review: Review) -> None: ...

    async def list_for(self, venue_id: UUID) -> list[Review]:
        """Las de un lugar, las más recientes primero."""
        ...

    async def ratings(self) -> dict[UUID, Rating]:
        """Promedio y cantidad de reseñas de cada lugar que tenga alguna."""
        ...


class BookingRepository(Protocol):
    async def get(self, booking_id: UUID) -> Booking | None: ...

    async def save(self, booking: Booking) -> None: ...

    async def list_for_customer(self, customer_id: UUID) -> list[Booking]:
        """Las del cliente, las más recientes primero."""
        ...

    async def list_for_venue(self, venue_id: UUID) -> list[Booking]:
        """Las de un lugar, las más recientes primero."""
        ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de establecimiento (autorizados por correo, más los admins)."""

    async def venue_ids(self) -> set[UUID]: ...


class NotifierPort(Protocol):
    """Deja un aviso en la campana de una persona (lo conecta la composición de la app)."""

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None: ...
