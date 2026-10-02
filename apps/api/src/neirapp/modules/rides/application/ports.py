from datetime import datetime
from typing import Protocol
from uuid import UUID

from neirapp.modules.rides.domain.drivers import Driver
from neirapp.modules.rides.domain.rides import Ride


class DriverRepository(Protocol):
    async def get(self, user_id: UUID) -> Driver | None: ...

    async def save(self, driver: Driver) -> None:
        """Crea o reemplaza el perfil de esa cuenta."""
        ...

    async def list_online(self) -> list[Driver]: ...


class RideRepository(Protocol):
    async def get(self, ride_id: UUID) -> Ride | None: ...

    async def save(self, ride: Ride) -> None: ...

    async def claim(self, ride: Ride) -> bool:
        """Guarda la aceptación solo si el viaje seguía esperando conductor (dos conductores no
        pueden quedarse con el mismo). Devuelve si lo logró."""
        ...

    async def active_for_customer(self, customer_id: UUID) -> Ride | None: ...

    async def active_for_driver(self, driver_id: UUID) -> Ride | None: ...

    async def list_requested(self) -> list[Ride]:
        """Las solicitudes que esperan conductor, las más antiguas primero."""
        ...

    async def list_for_customer(self, customer_id: UUID, limit: int) -> list[Ride]:
        """Los viajes del cliente, los más recientes primero."""
        ...

    async def list_completed_for_driver(self, driver_id: UUID, since: datetime) -> list[Ride]:
        """Los viajes que terminó el conductor desde esa fecha, los más recientes primero."""
        ...

    async def rating_of(self, driver_id: UUID) -> tuple[float, int]:
        """Promedio (1 decimal) y cantidad de calificaciones del conductor."""
        ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de conductor (autorizados por correo, más los administradores)."""

    async def driver_ids(self) -> set[UUID]: ...


class NotifierPort(Protocol):
    """Deja un aviso en la campana de una persona (lo conecta la composición de la app)."""

    async def notify(self, user_id: UUID, kind: str, title: str, body: str, link: str) -> None: ...
