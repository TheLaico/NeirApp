from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.presentation.dependencies import CurrentUser
from neirapp.modules.ordering.application.orders import CreateOrderCommand, OrderItemCommand
from neirapp.modules.ordering.domain.entities import StoreOrderStatus
from neirapp.modules.ordering.presentation.dependencies import OrderingDep
from neirapp.modules.ordering.presentation.schemas import (
    CreateOrderRequest,
    OrderResponse,
    StoreOrderResponse,
)
from neirapp.modules.ordering.presentation.ws_manager import ConnectionManager
from neirapp.modules.stores.application.app import StoresApp
from neirapp.shared.domain.errors import DomainError

router = APIRouter(tags=["ordering"])


# --- Cliente -----------------------------------------------------------------


@router.post("/orders", response_model=OrderResponse, status_code=201)
async def create_order(
    body: CreateOrderRequest, user: CurrentUser, ordering: OrderingDep
) -> OrderResponse:
    order = await ordering.create_order(
        user.id,
        CreateOrderCommand(
            delivery_lat=body.delivery_lat,
            delivery_lng=body.delivery_lng,
            delivery_notes=body.delivery_notes,
            items=[
                OrderItemCommand(store_id=i.store_id, product_id=i.product_id, quantity=i.quantity)
                for i in body.items
            ],
        ),
    )
    return OrderResponse.from_domain(order)


@router.get("/orders", response_model=list[OrderResponse])
async def list_my_orders(user: CurrentUser, ordering: OrderingDep) -> list[OrderResponse]:
    orders = await ordering.list_my_orders(user.id)
    return [OrderResponse.from_domain(o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: UUID, user: CurrentUser, ordering: OrderingDep) -> OrderResponse:
    order = await ordering.get_order(order_id, user.id)
    return OrderResponse.from_domain(order)


@router.post("/orders/{order_id}/pay", response_model=OrderResponse)
async def pay_order(order_id: UUID, user: CurrentUser, ordering: OrderingDep) -> OrderResponse:
    """Cobra el pedido con la pasarela configurada (en desarrollo, `FakePaymentGateway`: aprueba
    siempre). Ver docs/ARCHITECTURE.md sobre cómo se conecta una pasarela real."""
    order = await ordering.pay_order(order_id, user.id)
    return OrderResponse.from_domain(order)


# --- Comercio ------------------------------------------------------------------


@router.get("/stores/{store_id}/orders", response_model=list[StoreOrderResponse])
async def list_store_orders(
    store_id: UUID, user: CurrentUser, ordering: OrderingDep, status: StoreOrderStatus | None = None
) -> list[StoreOrderResponse]:
    views = await ordering.list_store_orders(store_id, user.id, status=status)
    return [StoreOrderResponse.from_domain(v.store_order) for v in views]


@router.post("/store-orders/{store_order_id}/accept", response_model=StoreOrderResponse)
async def accept_store_order(
    store_order_id: UUID, user: CurrentUser, ordering: OrderingDep
) -> StoreOrderResponse:
    store_order = await ordering.accept_store_order(store_order_id, user.id)
    return StoreOrderResponse.from_domain(store_order)


@router.post("/store-orders/{store_order_id}/reject", response_model=StoreOrderResponse)
async def reject_store_order(
    store_order_id: UUID, user: CurrentUser, ordering: OrderingDep
) -> StoreOrderResponse:
    store_order = await ordering.reject_store_order(store_order_id, user.id)
    return StoreOrderResponse.from_domain(store_order)


@router.post("/store-orders/{store_order_id}/preparing", response_model=StoreOrderResponse)
async def start_preparing_store_order(
    store_order_id: UUID, user: CurrentUser, ordering: OrderingDep
) -> StoreOrderResponse:
    store_order = await ordering.start_preparing_store_order(store_order_id, user.id)
    return StoreOrderResponse.from_domain(store_order)


@router.post("/store-orders/{store_order_id}/ready", response_model=StoreOrderResponse)
async def mark_store_order_ready(
    store_order_id: UUID, user: CurrentUser, ordering: OrderingDep
) -> StoreOrderResponse:
    store_order = await ordering.mark_store_order_ready(store_order_id, user.id)
    return StoreOrderResponse.from_domain(store_order)


# --- Notificaciones en vivo ---------------------------------------------------


@router.websocket("/stores/{store_id}/orders/ws")
async def store_orders_ws(websocket: WebSocket, store_id: UUID, token: str) -> None:
    """El comercio se conecta con su access token en la query string (los navegadores no pueden
    mandar headers en el handshake de WebSocket) y recibe un aviso por cada pedido nuevo pagado.
    Es solo un "algo cambió, refresca" — el estado real siempre se vuelve a pedir por REST.
    Ver docs/ARCHITECTURE.md sobre por qué el token va en la URL y qué conviene hacer antes de
    producción.
    """
    identity: IdentityApp = websocket.app.state.identity
    stores: StoresApp = websocket.app.state.stores
    manager: ConnectionManager = websocket.app.state.order_notifications

    try:
        user = await identity.authenticate(token)
    except DomainError:
        await websocket.close(code=4401)
        return

    store = await stores.get_store_raw(store_id)
    if store is None or store.owner_user_id != user.id:
        await websocket.close(code=4403)
        return

    await manager.connect(store_id, websocket)
    try:
        while True:
            # No se espera nada del cliente; solo se usa para detectar la desconexión.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(store_id, websocket)
