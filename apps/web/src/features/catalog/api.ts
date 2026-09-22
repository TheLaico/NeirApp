import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "../../lib/api";
import { unwrap } from "../../lib/errors";
import type { StoreCategory } from "../stores/types";

export function useStoreProducts(storeId: string | undefined, onlyAvailable = false) {
  return useQuery({
    queryKey: ["store-products", storeId, onlyAvailable],
    enabled: !!storeId,
    queryFn: async () =>
      unwrap(
        await publicApi.GET("/api/v1/stores/{store_id}/products", {
          params: { path: { store_id: storeId! }, query: { only_available: onlyAvailable } },
        }),
      ),
  });
}

function invalidateStoreProducts(queryClient: ReturnType<typeof useQueryClient>, storeId: string) {
  void queryClient.invalidateQueries({ queryKey: ["store-products", storeId] });
}

export function useCreateProduct(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateProductRequest"]) =>
      unwrap(
        await api.POST("/api/v1/stores/{store_id}/products", {
          params: { path: { store_id: storeId } },
          body,
        }),
      ),
    onSuccess: () => invalidateStoreProducts(queryClient, storeId),
  });
}

export function useUpdateProduct(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      body,
    }: {
      productId: string;
      body: Schemas["UpdateProductRequest"];
    }) =>
      unwrap(
        await api.PATCH("/api/v1/stores/{store_id}/products/{product_id}", {
          params: { path: { store_id: storeId, product_id: productId } },
          body,
        }),
      ),
    onSuccess: () => invalidateStoreProducts(queryClient, storeId),
  });
}

export function useSetProductAvailability(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, isAvailable }: { productId: string; isAvailable: boolean }) =>
      unwrap(
        await api.PATCH("/api/v1/stores/{store_id}/products/{product_id}/availability", {
          params: { path: { store_id: storeId, product_id: productId } },
          body: { is_available: isAvailable },
        }),
      ),
    onSuccess: () => invalidateStoreProducts(queryClient, storeId),
  });
}

export function useDeleteProduct(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await api.DELETE("/api/v1/stores/{store_id}/products/{product_id}", {
        params: { path: { store_id: storeId, product_id: productId } },
      });
      if (result.error) unwrap(result);
    },
    onSuccess: () => invalidateStoreProducts(queryClient, storeId),
  });
}

export interface ProductSearchFilters {
  q: string;
  category?: StoreCategory;
  maxPriceCop?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
}

export function useSearchProducts(filters: ProductSearchFilters, enabled: boolean) {
  return useQuery({
    queryKey: ["product-search", filters],
    enabled,
    queryFn: async () =>
      unwrap(
        await publicApi.GET("/api/v1/products/search", {
          params: {
            query: {
              q: filters.q,
              category: filters.category,
              max_price_cop: filters.maxPriceCop,
              sort: filters.sort,
            },
          },
        }),
      ),
  });
}
