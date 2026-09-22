from dataclasses import dataclass

from neirapp.modules.ordering.application.orders import (
    AcceptStoreOrder,
    CreateOrder,
    GetOrder,
    ListMyOrders,
    ListStoreOrders,
    MarkStoreOrderReady,
    PayOrder,
    RejectStoreOrder,
    StartPreparingStoreOrder,
)


@dataclass(frozen=True)
class OrderingApp:
    """Fachada del módulo: lo único que la capa de presentación necesita conocer."""

    create_order: CreateOrder
    get_order: GetOrder
    list_my_orders: ListMyOrders
    pay_order: PayOrder

    list_store_orders: ListStoreOrders
    accept_store_order: AcceptStoreOrder
    reject_store_order: RejectStoreOrder
    start_preparing_store_order: StartPreparingStoreOrder
    mark_store_order_ready: MarkStoreOrderReady
