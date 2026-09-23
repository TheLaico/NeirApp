import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "../../lib/api";
import { unwrap } from "../../lib/errors";

export function useStoreReviews(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-reviews", storeId],
    enabled: !!storeId,
    queryFn: async () =>
      unwrap(
        await publicApi.GET("/api/v1/reviews/stores/{store_id}", {
          params: { path: { store_id: storeId! } },
        }),
      ),
  });
}

export function useStoreRatingSummary(storeId: string | undefined) {
  return useQuery({
    queryKey: ["store-rating-summary", storeId],
    enabled: !!storeId,
    queryFn: async () =>
      unwrap(
        await publicApi.GET("/api/v1/reviews/stores/{store_id}/summary", {
          params: { path: { store_id: storeId! } },
        }),
      ),
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CreateReviewRequest"]) =>
      unwrap(await api.POST("/api/v1/reviews", { body })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["store-reviews"] });
      void queryClient.invalidateQueries({ queryKey: ["store-rating-summary"] });
    },
  });
}
