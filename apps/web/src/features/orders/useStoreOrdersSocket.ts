import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getAccessToken } from "../auth/session";
import { API_BASE_URL } from "../../lib/env";

/**
 * Notificaciones en vivo de pedidos nuevos para el panel del comercio (ver
 * apps/api .../ordering/presentation/ws_manager.py). El mensaje es solo un aviso — siempre se
 * invalida la query y se vuelve a pedir el estado real por REST, nunca se confía en el payload.
 * Si el socket se cae, reintenta cada pocos segundos; `useStoreOrders` también refresca solo con
 * un intervalo como respaldo por si la reconexión tarda.
 */
export function useStoreOrdersSocket(storeId: string | undefined, onNewOrder: () => void): void {
  const queryClient = useQueryClient();
  const onNewOrderRef = useRef(onNewOrder);

  // Mutar un ref durante el render está prohibido (rompe los supuestos del compilador de React);
  // se actualiza en un efecto aparte, que corre después de cada render antes del próximo evento.
  useEffect(() => {
    onNewOrderRef.current = onNewOrder;
  });

  useEffect(() => {
    if (!storeId) return;

    let socket: WebSocket | null = null;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = async () => {
      const token = await getAccessToken();
      if (!token || stopped) return;

      const wsUrl = new URL(`/api/v1/stores/${storeId}/orders/ws`, API_BASE_URL);
      wsUrl.protocol = wsUrl.protocol === "https:" ? "wss:" : "ws:";
      wsUrl.searchParams.set("token", token);

      socket = new WebSocket(wsUrl);
      socket.onmessage = () => {
        void queryClient.invalidateQueries({ queryKey: ["store-orders", storeId] });
        onNewOrderRef.current();
      };
      socket.onclose = () => {
        if (!stopped) retryTimer = setTimeout(connect, 3000);
      };
    };
    void connect();

    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      socket?.close();
    };
  }, [storeId, queryClient]);
}
