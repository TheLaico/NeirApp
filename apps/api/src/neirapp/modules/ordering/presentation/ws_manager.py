from uuid import UUID

from fastapi import WebSocket


class ConnectionManager:
    """Registro de conexiones WebSocket vivas y notificaciones a un comercio cuando le llega un
    pedido nuevo, en memoria.

    Vive en `presentation`, no en `infrastructure`: manejar objetos `WebSocket` crudos (aceptar la
    conexión, mandar el mensaje, limpiar al desconectar) es un detalle del transporte web, no un
    adaptador a un servicio externo. `bootstrap/container.py` construye una sola instancia y la usa
    para dos cosas: el router la referencia directo para `connect`/`disconnect`, y se la pasa a
    `PayOrder` como implementación (estructural, sin heredar) del puerto `StoreNotifier` de
    `application/ports.py` — el caso de uso solo conoce ese puerto, nunca esta clase.

    Alcanza para un solo proceso (así corre esta app en desarrollo y en un despliegue pequeño).
    Con varias instancias detrás de un balanceador, una conexión WS vive en una sola instancia, así
    que hay que reemplazar esto por pub/sub (Redis) para que la notificación llegue sin importar en
    cuál instancia esté conectado el comercio — ver docs/ARCHITECTURE.md, "Riesgos abiertos".
    """

    def __init__(self) -> None:
        self._connections: dict[UUID, set[WebSocket]] = {}

    async def connect(self, store_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(store_id, set()).add(websocket)

    def disconnect(self, store_id: UUID, websocket: WebSocket) -> None:
        connections = self._connections.get(store_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self._connections.pop(store_id, None)

    async def notify_new_order(self, store_id: UUID, store_order_id: UUID) -> None:
        """Implementa `StoreNotifier`. El mensaje es solo un aviso ("algo cambió, refresca tu
        lista de pedidos"), no la fuente de verdad — el cliente vuelve a pedir el estado real."""
        connections = self._connections.get(store_id)
        if not connections:
            return
        payload = {"type": "new_order", "store_order_id": str(store_order_id)}
        disconnected = set()
        for websocket in connections:
            try:
                await websocket.send_json(payload)
            except Exception:  # un socket roto no debe tumbar la notificación a los demás
                disconnected.add(websocket)
        connections -= disconnected
