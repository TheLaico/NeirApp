import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "../../lib/api";
import { unwrap } from "../../lib/errors";
import type { StoreCategory } from "./types";

export function useStores(category?: StoreCategory) {
  return useQuery({
    queryKey: ["stores", { category }],
    queryFn: async () =>
      unwrap(await publicApi.GET("/api/v1/stores", { params: { query: { category } } })),
  });
}

export function useStore(storeId: string | undefined) {
  return useQuery({
    queryKey: ["stores", storeId],
    enabled: !!storeId,
    queryFn: async () =>
      unwrap(
        await publicApi.GET("/api/v1/stores/{store_id}", { params: { path: { store_id: storeId! } } }),
      ),
  });
}

/** La tienda del usuario autenticado, o `null` si todavía no ha abierto una. */
export function useMyStore(enabled: boolean) {
  return useQuery({
    queryKey: ["my-store"],
    enabled,
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/me")),
  });
}

function invalidateStores(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ["stores"] });
  void queryClient.invalidateQueries({ queryKey: ["my-store"] });
}

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateStoreRequest"]) =>
      unwrap(await api.POST("/api/v1/stores", { body })),
    onSuccess: () => invalidateStores(queryClient),
  });
}

export function useUpdateStore(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["UpdateStoreRequest"]) =>
      unwrap(
        await api.PATCH("/api/v1/stores/{store_id}", { params: { path: { store_id: storeId } }, body }),
      ),
    onSuccess: () => invalidateStores(queryClient),
  });
}

export function useSetStoreOpen(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (is_open: boolean) =>
      unwrap(
        await api.PATCH("/api/v1/stores/{store_id}/open", {
          params: { path: { store_id: storeId } },
          body: { is_open },
        }),
      ),
    onSuccess: () => invalidateStores(queryClient),
  });
}
