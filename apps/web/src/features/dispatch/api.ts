import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { unwrap } from "../../lib/errors";

export function useMyCourierProfile() {
  return useQuery({
    queryKey: ["my-courier-profile"],
    queryFn: async () => unwrap(await api.GET("/api/v1/couriers/me")),
  });
}

export function useCreateCourierProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateCourierProfileRequest"]) =>
      unwrap(await api.POST("/api/v1/couriers/me", { body })),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["my-courier-profile"] }),
  });
}

export function usePendingCouriers() {
  return useQuery({
    queryKey: ["pending-couriers"],
    queryFn: async () => unwrap(await api.GET("/api/v1/couriers/pending")),
  });
}

export function useVerifyCourier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ profileId, isVerified }: { profileId: string; isVerified: boolean }) =>
      unwrap(
        await api.PATCH("/api/v1/couriers/{profile_id}/verification", {
          params: { path: { profile_id: profileId } },
          body: { is_verified: isVerified },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-couriers"] }),
  });
}

export function useAvailableDeliveries() {
  return useQuery({
    queryKey: ["available-deliveries"],
    refetchInterval: 15_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/deliveries/available")),
  });
}

function invalidateDeliveries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["available-deliveries"] });
  void queryClient.invalidateQueries({ queryKey: ["active-delivery"] });
  void queryClient.invalidateQueries({ queryKey: ["delivery-history"] });
  void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
}

export function useClaimDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (orderId: string) =>
      unwrap(
        await api.POST("/api/v1/deliveries/{order_id}/claim", {
          params: { path: { order_id: orderId } },
        }),
      ),
    onSuccess: () => invalidateDeliveries(queryClient),
  });
}

export function useMyActiveDelivery() {
  return useQuery({
    queryKey: ["active-delivery"],
    refetchInterval: 10_000,
    queryFn: async () => unwrap(await api.GET("/api/v1/deliveries/mine/active")),
  });
}

export function useMyDeliveryHistory() {
  return useQuery({
    queryKey: ["delivery-history"],
    queryFn: async () => unwrap(await api.GET("/api/v1/deliveries/mine/history")),
  });
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, code }: { deliveryId: string; code: string }) =>
      unwrap(
        await api.POST("/api/v1/deliveries/{delivery_id}/confirm-delivery", {
          params: { path: { delivery_id: deliveryId } },
          body: { code },
        }),
      ),
    onSuccess: () => invalidateDeliveries(queryClient),
  });
}

export function useCancelDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) =>
      unwrap(
        await api.POST("/api/v1/deliveries/{delivery_id}/cancel", {
          params: { path: { delivery_id: deliveryId } },
        }),
      ),
    onSuccess: () => invalidateDeliveries(queryClient),
  });
}

export function useConfirmPickup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeOrderId, code }: { storeOrderId: string; code: string }) =>
      unwrap(
        await api.POST("/api/v1/deliveries/store-orders/{store_order_id}/confirm-pickup", {
          params: { path: { store_order_id: storeOrderId } },
          body: { code },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["store-orders"] }),
  });
}

/** `null` si el pedido todavía no lo ha tomado ningún repartidor. */
export function useDeliveryForOrder(orderId: string | undefined) {
  return useQuery({
    queryKey: ["delivery-for-order", orderId],
    enabled: !!orderId,
    refetchInterval: 10_000,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/deliveries/by-order/{order_id}", {
          params: { path: { order_id: orderId! } },
        }),
      ),
  });
}
