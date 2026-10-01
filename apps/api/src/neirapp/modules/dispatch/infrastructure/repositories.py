from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.dispatch.application.dto import EarningsSummary
from neirapp.modules.dispatch.domain.entities import (
    CourierLocation,
    CourierProfile,
    CourierRating,
    Delivery,
    DeliveryStatus,
    DeliveryStop,
    VehicleType,
)
from neirapp.modules.dispatch.domain.errors import OrderAlreadyClaimed
from neirapp.modules.dispatch.infrastructure.models import (
    CourierLocationModel,
    CourierProfileModel,
    CourierRatingModel,
    DeliveryModel,
    DeliveryStopModel,
    VehicleSettingModel,
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
        courier_earnings_cop=model.courier_earnings_cop,
        platform_earnings_cop=model.platform_earnings_cop,
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
                courier_earnings_cop=delivery.courier_earnings_cop,
                platform_earnings_cop=delivery.platform_earnings_cop,
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
        # La entrega viva del pedido (asignada o entregada); las canceladas son solo historial.
        result = await self._session.execute(
            select(DeliveryModel).where(
                DeliveryModel.order_id == order_id,
                DeliveryModel.status != DeliveryStatus.CANCELLED.value,
            )
        )
        model = result.scalar_one_or_none()
        return _to_delivery(model) if model else None

    async def get_by_stop_store_order(self, store_order_id: UUID) -> Delivery | None:
        result = await self._session.execute(
            select(DeliveryModel)
            .join(DeliveryStopModel, DeliveryStopModel.delivery_id == DeliveryModel.id)
            .where(
                DeliveryStopModel.store_order_id == store_order_id,
                DeliveryModel.status != DeliveryStatus.CANCELLED.value,
            )
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

    async def earnings_summary(self) -> EarningsSummary:
        result = await self._session.execute(
            select(
                func.count(DeliveryModel.id),
                func.coalesce(func.sum(DeliveryModel.courier_earnings_cop), 0),
                func.coalesce(func.sum(DeliveryModel.platform_earnings_cop), 0),
            ).where(DeliveryModel.status == DeliveryStatus.DELIVERED.value)
        )
        deliveries, courier, platform = result.one()
        return EarningsSummary(deliveries=deliveries, courier_cop=courier, platform_cop=platform)

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


class SqlAlchemyVehicleSettingsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_all(self) -> dict[VehicleType, bool]:
        result = await self._session.execute(select(VehicleSettingModel))
        return {VehicleType(m.vehicle_type): m.is_enabled for m in result.scalars()}

    async def set_enabled(self, vehicle_type: VehicleType, is_enabled: bool) -> None:
        model = await self._session.get(VehicleSettingModel, vehicle_type.value)
        if model is None:
            self._session.add(
                VehicleSettingModel(vehicle_type=vehicle_type.value, is_enabled=is_enabled)
            )
        else:
            model.is_enabled = is_enabled
        await self._session.flush()


def _to_rating(model: CourierRatingModel) -> CourierRating:
    return CourierRating(
        id=model.id,
        delivery_id=model.delivery_id,
        order_id=model.order_id,
        courier_id=model.courier_id,
        customer_id=model.customer_id,
        rating=model.rating,
        comment=model.comment,
        created_at=model.created_at,
    )


class SqlAlchemyCourierRatingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, rating: CourierRating) -> None:
        self._session.add(
            CourierRatingModel(
                id=rating.id,
                delivery_id=rating.delivery_id,
                order_id=rating.order_id,
                courier_id=rating.courier_id,
                customer_id=rating.customer_id,
                rating=rating.rating,
                comment=rating.comment,
                created_at=rating.created_at,
            )
        )
        await self._session.flush()

    async def get_by_delivery(self, delivery_id: UUID) -> CourierRating | None:
        result = await self._session.execute(
            select(CourierRatingModel).where(CourierRatingModel.delivery_id == delivery_id)
        )
        model = result.scalar_one_or_none()
        return _to_rating(model) if model else None

    async def list_all(self) -> list[CourierRating]:
        result = await self._session.execute(
            select(CourierRatingModel).order_by(CourierRatingModel.created_at.desc())
        )
        return [_to_rating(m) for m in result.scalars()]


class SqlAlchemyCourierLocationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def upsert(self, location: CourierLocation) -> None:
        model = await self._session.get(CourierLocationModel, location.courier_id)
        if model is None:
            self._session.add(
                CourierLocationModel(
                    courier_id=location.courier_id,
                    lat=location.lat,
                    lng=location.lng,
                    heading=location.heading,
                    updated_at=location.updated_at,
                )
            )
        else:
            model.lat = location.lat
            model.lng = location.lng
            model.heading = location.heading
            model.updated_at = location.updated_at
        await self._session.flush()

    async def list_since(self, since: datetime) -> list[CourierLocation]:
        result = await self._session.execute(
            select(CourierLocationModel).where(CourierLocationModel.updated_at >= since)
        )
        return [
            CourierLocation(
                courier_id=m.courier_id,
                lat=m.lat,
                lng=m.lng,
                heading=m.heading,
                updated_at=m.updated_at,
            )
            for m in result.scalars()
        ]
