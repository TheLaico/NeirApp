from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.dispatch.application.ports import UnitOfWorkFactory
from neirapp.modules.dispatch.domain.entities import (
    DEFAULT_ENABLED_VEHICLES,
    CourierProfile,
    VehicleType,
)
from neirapp.modules.dispatch.domain.errors import (
    CourierProfileAlreadyExists,
    CourierProfileNotFound,
    VehicleTypeNotEnabled,
)
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class CreateCourierProfileCommand:
    vehicle_type: VehicleType
    plate: str | None
    id_document_number: str


def _enabled_map(configured: dict[VehicleType, bool]) -> dict[VehicleType, bool]:
    """Todos los tipos con su estado: lo que configuró un admin, o el valor por defecto."""
    return {v: configured.get(v, v in DEFAULT_ENABLED_VEHICLES) for v in VehicleType}


class ListVehicleTypes:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self) -> dict[VehicleType, bool]:
        async with self._uow_factory() as uow:
            return _enabled_map(await uow.vehicle_settings.list_all())


class SetVehicleTypeEnabled:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self, vehicle_type: VehicleType, *, is_enabled: bool
    ) -> dict[VehicleType, bool]:
        async with self._uow_factory() as uow:
            await uow.vehicle_settings.set_enabled(vehicle_type, is_enabled)
            await uow.commit()
            return _enabled_map(await uow.vehicle_settings.list_all())


class CreateCourierProfile:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, user_id: UUID, cmd: CreateCourierProfileCommand) -> CourierProfile:
        async with self._uow_factory() as uow:
            if await uow.couriers.get_by_user(user_id) is not None:
                raise CourierProfileAlreadyExists()
            if not _enabled_map(await uow.vehicle_settings.list_all())[cmd.vehicle_type]:
                raise VehicleTypeNotEnabled()
            profile = CourierProfile.create(
                user_id=user_id,
                vehicle_type=cmd.vehicle_type,
                plate=cmd.plate,
                id_document_number=cmd.id_document_number,
                now=self._clock.now(),
            )
            await uow.couriers.add(profile)
            await uow.commit()
        return profile


class GetMyCourierProfile:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, user_id: UUID) -> CourierProfile | None:
        async with self._uow_factory() as uow:
            return await uow.couriers.get_by_user(user_id)


class ListPendingCouriers:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self) -> list[CourierProfile]:
        async with self._uow_factory() as uow:
            return await uow.couriers.list_pending()


class VerifyCourier:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, profile_id: UUID, *, is_verified: bool) -> CourierProfile:
        async with self._uow_factory() as uow:
            profile = await uow.couriers.get(profile_id)
            if profile is None:
                raise CourierProfileNotFound()
            profile.set_verified(is_verified)
            await uow.couriers.update(profile)
            await uow.commit()
        return profile
