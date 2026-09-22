import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { unwrap } from "../../lib/errors";
import type { StoreOrderStatus } from "./types";

export function useMyOrders() {
  return useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => unwrap(await api.GET("/api/v1/orders")),
  });
}

export function useOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["orders", orderId],
    enabled: !!orderId,
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/orders/{order_id}", { params: { path: { order_id: orderId! } } })),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateOrderRequest"]) =>
      unwrap(await api.POST("/api/v1/orders", { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-orders"] }),
  });
}

export function usePayOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) =>
      unwrap(
        await api.POST("/api/v1/orders/{order_id}/pay", { params: { path: { order_id: orderId } } }),
      ),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      void queryClient.invalidateQueries({ queryKey: ["orders", order.id] });
    },
  });
}

export function useStoreOrders(storeId: string | undefined, status?: StoreOrderStatus) {
  return useQuery({
    queryKey: ["store-orders", storeId, status],
    enabled: !!storeId,
    refetchInterval: 15_000, // respaldo por si se pierde la notificación WS (ver useStoreOrdersSocket)
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/stores/{store_id}/orders", {
          params: { path: { store_id: storeId! }, query: { status } },
        }),
      ),
  });
}

function invalidateStoreOrders(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["store-orders"] });
}

export function useAcceptStoreOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storeOrderId: string) =>
      unwrap(
        await api.POST("/api/v1/store-orders/{store_order_id}/accept", {
          params: { path: { store_order_id: storeOrderId } },
        }),
      ),
    onSuccess: () => invalidateStoreOrders(queryClient),
  });
}

export function useRejectStoreOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storeOrderId: string) =>
      unwrap(
        await api.POST("/api/v1/store-orders/{store_order_id}/reject", {
          params: { path: { store_order_id: storeOrderId } },
        }),
      ),
    onSuccess: () => invalidateStoreOrders(queryClient),
  });
}

export function useStartPreparingStoreOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storeOrderId: string) =>
      unwrap(
        await api.POST("/api/v1/store-orders/{store_order_id}/preparing", {
          params: { path: { store_order_id: storeOrderId } },
        }),
      ),
    onSuccess: () => invalidateStoreOrders(queryClient),
  });
}

export function useMarkStoreOrderReady() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (storeOrderId: string) =>
      unwrap(
        await api.POST("/api/v1/store-orders/{store_order_id}/ready", {
          params: { path: { store_order_id: storeOrderId } },
        }),
      ),
    onSuccess: () => invalidateStoreOrders(queryClient),
  });
}
