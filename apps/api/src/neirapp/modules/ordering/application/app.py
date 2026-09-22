from dataclasses import dataclass

from neirapp.modules.ordering.application.orders import (
    AcceptStoreOrder,
    CreateOrder,
    GetOrder,
    GetOrderRaw,
    ListClaimableOrders,
    ListMyOrders,
    ListStoreOrders,
    MarkStoreOrderHandedOverRaw,
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

    # Consumo interno de `dispatch` (nunca por HTTP): ver los docstrings de cada caso de uso.
    get_order_raw: GetOrderRaw
    list_claimable_orders: ListClaimableOrders
    mark_store_order_handed_over_raw: MarkStoreOrderHandedOverRaw
