from uuid import UUID

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.ordering.application.dto import StoreOrderView
from neirapp.modules.ordering.domain.entities import Order, OrderLine, StoreOrder, StoreOrderStatus
from neirapp.modules.ordering.infrastructure.models import (
    OrderLineModel,
    OrderModel,
    StoreOrderModel,
)


def _to_line(model: OrderLineModel) -> OrderLine:
    return OrderLine(
        product_id=model.product_id,
        name=model.name,
        price_cop=model.price_cop,
        quantity=model.quantity,
    )


def _to_store_order(model: StoreOrderModel) -> StoreOrder:
    return StoreOrder(
        id=model.id,
        order_id=model.order_id,
        store_id=model.store_id,
        store_name=model.store_name,
        store_owner_user_id=model.store_owner_user_id,
        status=StoreOrderStatus(model.status),
        lines=[_to_line(m) for m in model.lines],
        created_at=model.created_at,
        updated_at=model.updated_at,
        rejection_reason=model.rejection_reason,
    )


def _to_order(model: OrderModel) -> Order:
    return Order(
        id=model.id,
        customer_id=model.customer_id,
        delivery_lat=model.delivery_lat,
        delivery_lng=model.delivery_lng,
        delivery_notes=model.delivery_notes,
        created_at=model.created_at,
        delivery_fee_cop=model.delivery_fee_cop,
        courier_earnings_cop=model.courier_earnings_cop,
        store_orders=[_to_store_order(m) for m in model.store_orders],
    )


def _store_order_model(store_order: StoreOrder) -> StoreOrderModel:
    return StoreOrderModel(
        id=store_order.id,
        order_id=store_order.order_id,
        store_id=store_order.store_id,
        store_name=store_order.store_name,
        store_owner_user_id=store_order.store_owner_user_id,
        status=store_order.status.value,
        created_at=store_order.created_at,
        updated_at=store_order.updated_at,
        lines=[
            OrderLineModel(
                product_id=line.product_id,
                name=line.name,
                price_cop=line.price_cop,
                quantity=line.quantity,
            )
            for line in store_order.lines
        ],
    )


class SqlAlchemyOrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, order: Order) -> None:
        self._session.add(
            OrderModel(
                id=order.id,
                customer_id=order.customer_id,
                delivery_lat=order.delivery_lat,
                delivery_lng=order.delivery_lng,
                delivery_notes=order.delivery_notes,
                delivery_fee_cop=order.delivery_fee_cop,
                courier_earnings_cop=order.courier_earnings_cop,
                created_at=order.created_at,
                store_orders=[_store_order_model(so) for so in order.store_orders],
            )
        )
        await self._session.flush()

    async def get(self, order_id: UUID) -> Order | None:
        model = await self._session.get(OrderModel, order_id)
        return _to_order(model) if model else None

    async def list_by_customer(self, customer_id: UUID) -> list[Order]:
        result = await self._session.execute(
            select(OrderModel)
            .where(OrderModel.customer_id == customer_id)
            .order_by(OrderModel.created_at.desc())
        )
        return [_to_order(m) for m in result.scalars()]

    async def list_claimable(self) -> list[Order]:
        claimable_statuses = (
            StoreOrderStatus.ACCEPTED.value,
            StoreOrderStatus.PREPARING.value,
            StoreOrderStatus.READY.value,
        )
        has_claimable_store_order = exists(
            select(StoreOrderModel.id).where(
                StoreOrderModel.order_id == OrderModel.id,
                StoreOrderModel.status.in_(claimable_statuses),
            )
        )
        result = await self._session.execute(
            select(OrderModel)
            .where(has_claimable_store_order)
            .order_by(OrderModel.created_at.desc())
        )
        return [_to_order(m) for m in result.scalars()]

    async def get_store_order(self, store_order_id: UUID) -> StoreOrderView | None:
        result = await self._session.execute(
            select(StoreOrderModel, OrderModel.customer_id)
            .join(OrderModel, OrderModel.id == StoreOrderModel.order_id)
            .where(StoreOrderModel.id == store_order_id)
        )
        row = result.first()
        if row is None:
            return None
        model, customer_id = row
        return StoreOrderView(
            store_order=_to_store_order(model), order_id=model.order_id, customer_id=customer_id
        )

    async def list_by_store(
        self, store_id: UUID, *, status: StoreOrderStatus | None = None
    ) -> list[StoreOrderView]:
        stmt = (
            select(StoreOrderModel, OrderModel.customer_id)
            .join(OrderModel, OrderModel.id == StoreOrderModel.order_id)
            .where(StoreOrderModel.store_id == store_id)
            .order_by(StoreOrderModel.created_at.desc())
        )
        if status is not None:
            stmt = stmt.where(StoreOrderModel.status == status.value)
        result = await self._session.execute(stmt)
        return [
            StoreOrderView(store_order=_to_store_order(m), order_id=m.order_id, customer_id=c)
            for m, c in result.all()
        ]

    async def update_store_order(self, store_order: StoreOrder) -> None:
        model = await self._session.get(StoreOrderModel, store_order.id)
        if model is None:
            raise LookupError(f"StoreOrder {store_order.id} no existe")
        model.status = store_order.status.value
        model.rejection_reason = store_order.rejection_reason
        model.updated_at = store_order.updated_at
        await self._session.flush()
