from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.dispatch.domain.entities import (
    CourierProfile,
    Delivery,
    DeliveryStatus,
    DeliveryStop,
    VehicleType,
)
from neirapp.modules.dispatch.domain.errors import OrderAlreadyClaimed
from neirapp.modules.dispatch.infrastructure.models import (
    CourierProfileModel,
    DeliveryModel,
    DeliveryStopModel,
)


def _to_courier(model: CourierProfileModel) -> CourierProfile:
    return CourierProfile(
        id=model.id,
        user_id=model.user_id,
        vehicle_type=VehicleType(model.vehicle_type),
        plate=model.plate,
        id_document_number=model.id_document_number,
        is_verified=model.is_verified,
        created_at=model.created_at,
    )


def _to_stop(model: DeliveryStopModel) -> DeliveryStop:
    return DeliveryStop(
        store_order_id=model.store_order_id,
        store_id=model.store_id,
        store_name=model.store_name,
        store_owner_user_id=model.store_owner_user_id,
        lat=model.lat,
        lng=model.lng,
        pickup_code=model.pickup_code,
        picked_up_at=model.picked_up_at,
    )


def _to_delivery(model: DeliveryModel) -> Delivery:
    return Delivery(
        id=model.id,
        order_id=model.order_id,
        courier_id=model.courier_id,
        status=DeliveryStatus(model.status),
        stops=[_to_stop(m) for m in model.stops],
        delivery_lat=model.delivery_lat,
        delivery_lng=model.delivery_lng,
        delivery_code=model.delivery_code,
        created_at=model.created_at,
        updated_at=model.updated_at,
        delivered_at=model.delivered_at,
    )


class SqlAlchemyCourierRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, profile: CourierProfile) -> None:
        self._session.add(
            CourierProfileModel(
                id=profile.id,
                user_id=profile.user_id,
                vehicle_type=profile.vehicle_type.value,
                plate=profile.plate,
                id_document_number=profile.id_document_number,
                is_verified=profile.is_verified,
                created_at=profile.created_at,
            )
        )
        await self._session.flush()

    async def get_by_user(self, user_id: UUID) -> CourierProfile | None:
        result = await self._session.execute(
            select(CourierProfileModel).where(CourierProfileModel.user_id == user_id)
        )
        model = result.scalar_one_or_none()
        return _to_courier(model) if model else None

    async def get(self, profile_id: UUID) -> CourierProfile | None:
        model = await self._session.get(CourierProfileModel, profile_id)
        return _to_courier(model) if model else None

    async def list_pending(self) -> list[CourierProfile]:
        result = await self._session.execute(
            select(CourierProfileModel)
            .where(~CourierProfileModel.is_verified)
            .order_by(CourierProfileModel.created_at)
        )
        return [_to_courier(m) for m in result.scalars()]

    async def update(self, profile: CourierProfile) -> None:
        model = await self._session.get(CourierProfileModel, profile.id)
        if model is None:
            raise LookupError(f"Perfil de repartidor {profile.id} no existe")
        model.is_verified = profile.is_verified
        await self._session.flush()


def _stop_model(stop: DeliveryStop) -> DeliveryStopModel:
    return DeliveryStopModel(
        id=uuid4(),
        store_order_id=stop.store_order_id,
        store_id=stop.store_id,
        store_name=stop.store_name,
        store_owner_user_id=stop.store_owner_user_id,
        lat=stop.lat,
        lng=stop.lng,
        pickup_code=stop.pickup_code,
        picked_up_at=stop.picked_up_at,
    )


class SqlAlchemyDeliveryRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, delivery: Delivery) -> None:
        self._session.add(
            DeliveryModel(
                id=delivery.id,
                order_id=delivery.order_id,
                courier_id=delivery.courier_id,
                status=delivery.status.value,
                delivery_lat=delivery.delivery_lat,
                delivery_lng=delivery.delivery_lng,
                delivery_code=delivery.delivery_code,
                created_at=delivery.created_at,
                updated_at=delivery.updated_at,
                delivered_at=delivery.delivered_at,
                stops=[_stop_model(s) for s in delivery.stops],
            )
        )
        try:
            await self._session.flush()
        except IntegrityError as exc:  # dos repartidores reclamando el mismo pedido a la vez
            raise OrderAlreadyClaimed() from exc

    async def get(self, delivery_id: UUID) -> Delivery | None:
        model = await self._session.get(DeliveryModel, delivery_id)
        return _to_delivery(model) if model else None

    async def get_by_order(self, order_id: UUID) -> Delivery | None:
        result = await self._session.execute(
            select(DeliveryModel).where(DeliveryModel.order_id == order_id)
        )
        model = result.scalar_one_or_none()
        return _to_delivery(model) if model else None

    async def get_by_stop_store_order(self, store_order_id: UUID) -> Delivery | None:
        result = await self._session.execute(
            select(DeliveryModel)
            .join(DeliveryStopModel, DeliveryStopModel.delivery_id == DeliveryModel.id)
            .where(DeliveryStopModel.store_order_id == store_order_id)
        )
        model = result.scalar_one_or_none()
        return _to_delivery(model) if model else None

    async def get_active_for_courier(self, courier_id: UUID) -> Delivery | None:
        result = await self._session.execute(
            select(DeliveryModel).where(
                DeliveryModel.courier_id == courier_id,
                DeliveryModel.status == DeliveryStatus.ASSIGNED.value,
            )
        )
        model = result.scalar_one_or_none()
        return _to_delivery(model) if model else None

    async def list_by_courier(self, courier_id: UUID) -> list[Delivery]:
        result = await self._session.execute(
            select(DeliveryModel)
            .where(DeliveryModel.courier_id == courier_id)
            .order_by(DeliveryModel.created_at.desc())
        )
        return [_to_delivery(m) for m in result.scalars()]

    async def update(self, delivery: Delivery) -> None:
        model = await self._session.get(DeliveryModel, delivery.id)
        if model is None:
            raise LookupError(f"Entrega {delivery.id} no existe")
        model.status = delivery.status.value
        model.updated_at = delivery.updated_at
        model.delivered_at = delivery.delivered_at
        stops_by_store_order = {s.store_order_id: s for s in model.stops}
        for stop in delivery.stops:
            stop_model = stops_by_store_order[stop.store_order_id]
            stop_model.picked_up_at = stop.picked_up_at
        await self._session.flush()
