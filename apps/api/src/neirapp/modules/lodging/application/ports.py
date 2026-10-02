from typing import Protocol
from uuid import UUID

from neirapp.modules.lodging.domain.hotels import Hotel
from neirapp.modules.lodging.domain.payments import HotelPayment
from neirapp.modules.lodging.domain.reservations import Reservation
from neirapp.modules.lodging.domain.reviews import Rating, Review


class HotelRepository(Protocol):
    async def get(self, user_id: UUID) -> Hotel | None: ...

    async def save(self, hotel: Hotel) -> None:
        """Crea o reemplaza el hospedaje de esa cuenta."""
        ...

    async def list_all(self) -> list[Hotel]: ...


class ReviewRepository(Protocol):
    async def get(self, review_id: UUID) -> Review | None: ...

    async def get_by(self, hotel_id: UUID, user_id: UUID) -> Review | None: ...

    async def save(self, review: Review) -> None: ...

    async def list_for(self, hotel_id: UUID) -> list[Review]:
        """Las de un hospedaje, las más recientes primero."""
        ...

    async def ratings(self) -> dict[UUID, Rating]:
        """Promedio y cantidad de reseñas de cada hospedaje que tenga alguna."""
        ...


class ReservationRepository(Protocol):
    async def get(self, reservation_id: UUID) -> Reservation | None: ...

    async def save(self, reservation: Reservation) -> None: ...

    async def list_for_customer(self, customer_id: UUID) -> list[Reservation]:
        """Las del huésped, las más recientes primero."""
        ...

    async def list_for_hotel(self, hotel_id: UUID) -> list[Reservation]:
        """Las de un hospedaje, las más recientes primero."""
        ...


class PaymentRepository(Protocol):
    async def get(self, payment_id: UUID) -> HotelPayment | None: ...

    async def save(self, payment: HotelPayment) -> None: ...

    async def list_for(self, hotel_id: UUID) -> list[HotelPayment]:
        """Los de un hotel, los más recientes primero."""
        ...

    async def list_all(self) -> list[HotelPayment]:
        """Todos, los más recientes primero (para el panel del administrador)."""
        ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de hospedaje (autorizados por correo, más los administradores)."""

    async def hotel_ids(self) -> set[UUID]: ...


class NotifierPort(Protocol):
    """Deja un aviso en la campana de una persona (lo conecta la composición de la app)."""

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None: ...
