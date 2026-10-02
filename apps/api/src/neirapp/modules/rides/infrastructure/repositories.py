from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.rides.domain.drivers import Driver
from neirapp.modules.rides.domain.rides import ACTIVE, ASSIGNED, Ride, RideStatus
from neirapp.modules.rides.infrastructure.models import DriverModel, RideModel

_DRIVER_FIELDS = (
    "name",
    "phone",
    "plate",
    "vehicle_model",
    "model_year",
    "color",
    "capacity",
    "photo_url",
    "vehicle_photo_url",
    "is_online",
    "lat",
    "lng",
    "located_at",
    "created_at",
    "updated_at",
)


def _driver(m: DriverModel) -> Driver:
    return Driver(user_id=m.user_id, **{name: getattr(m, name) for name in _DRIVER_FIELDS})


class SqlAlchemyDriverRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: UUID) -> Driver | None:
        async with self._session_factory() as session:
            model = await session.get(DriverModel, user_id)
            return _driver(model) if model else None

    async def save(self, driver: Driver) -> None:
        async with self._session_factory() as session:
            model = await session.get(DriverModel, driver.user_id)
            if model is None:
                model = DriverModel(user_id=driver.user_id)
                session.add(model)
            for name in _DRIVER_FIELDS:
                setattr(model, name, getattr(driver, name))
            await session.commit()

    async def list_online(self) -> list[Driver]:
        async with self._session_factory() as session:
            result = await session.execute(select(DriverModel).where(DriverModel.is_online))
            return [_driver(m) for m in result.scalars()]


_RIDE_FIELDS = (
    "customer_id",
    "customer_name",
    "customer_phone",
    "passengers",
    "pickup_lat",
    "pickup_lng",
    "address",
    "reference",
    "destination",
    "fare_cop",
    "requested_at",
    "driver_id",
    "accepted_at",
    "arrived_at",
    "started_at",
    "completed_at",
    "cancelled_at",
    "cancelled_by",
    "customer_lat",
    "customer_lng",
    "customer_located_at",
    "rating",
    "rating_comment",
)
_ACTIVE = [s.value for s in ACTIVE]
_ASSIGNED = [s.value for s in ASSIGNED]


def _ride(m: RideModel) -> Ride:
    return Ride(
        id=m.id,
        status=RideStatus(m.status),
        **{name: getattr(m, name) for name in _RIDE_FIELDS},
    )


class SqlAlchemyRideRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, ride_id: UUID) -> Ride | None:
        async with self._session_factory() as session:
            model = await session.get(RideModel, ride_id)
            return _ride(model) if model else None

    async def save(self, ride: Ride) -> None:
        async with self._session_factory() as session:
            model = await session.get(RideModel, ride.id)
            if model is None:
                model = RideModel(id=ride.id)
                session.add(model)
            for name in _RIDE_FIELDS:
                setattr(model, name, getattr(ride, name))
            model.status = ride.status.value
            await session.commit()

    async def claim(self, ride: Ride) -> bool:
        # Un UPDATE condicional: si otro conductor la tomó primero, no toca ninguna fila.
        async with self._session_factory() as session:
            result = await session.execute(
                update(RideModel)
                .where(
                    RideModel.id == ride.id,
                    RideModel.status == RideStatus.REQUESTED.value,
                )
                .values(
                    status=ride.status.value,
                    driver_id=ride.driver_id,
                    accepted_at=ride.accepted_at,
                )
            )
            await session.commit()
            return bool(getattr(result, "rowcount", 0))

    async def _first(self, *where: Any) -> Ride | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(RideModel).where(*where).order_by(RideModel.requested_at.desc()).limit(1)
            )
            model = result.scalar_one_or_none()
            return _ride(model) if model else None

    async def active_for_customer(self, customer_id: UUID) -> Ride | None:
        return await self._first(
            RideModel.customer_id == customer_id, RideModel.status.in_(_ACTIVE)
        )

    async def active_for_driver(self, driver_id: UUID) -> Ride | None:
        return await self._first(RideModel.driver_id == driver_id, RideModel.status.in_(_ASSIGNED))

    async def list_requested(self) -> list[Ride]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(RideModel)
                .where(RideModel.status == RideStatus.REQUESTED.value)
                .order_by(RideModel.requested_at)
            )
            return [_ride(m) for m in result.scalars()]

    async def list_for_customer(self, customer_id: UUID, limit: int) -> list[Ride]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(RideModel)
                .where(RideModel.customer_id == customer_id)
                .order_by(RideModel.requested_at.desc())
                .limit(limit)
            )
            return [_ride(m) for m in result.scalars()]

    async def list_completed_for_driver(self, driver_id: UUID, since: datetime) -> list[Ride]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(RideModel)
                .where(
                    RideModel.driver_id == driver_id,
                    RideModel.status == RideStatus.COMPLETED.value,
                    RideModel.completed_at >= since,
                )
                .order_by(RideModel.completed_at.desc())
            )
            return [_ride(m) for m in result.scalars()]

    async def rating_of(self, driver_id: UUID) -> tuple[float, int]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(func.avg(RideModel.rating), func.count(RideModel.id)).where(
                    RideModel.driver_id == driver_id, RideModel.rating > 0
                )
            )
            avg, count = result.one()
            return (round(float(avg), 1) if avg else 0.0, int(count))
