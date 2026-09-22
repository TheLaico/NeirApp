import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { unwrap } from "../../lib/errors";

export function usePendingStores() {
  return useQuery({
    queryKey: ["pending-stores"],
    queryFn: async () => unwrap(await api.GET("/api/v1/stores/pending")),
  });
}

export function useSetStoreApproval(storeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (is_approved: boolean) =>
      unwrap(
        await api.PATCH("/api/v1/stores/{store_id}/approval", {
          params: { path: { store_id: storeId } },
          body: { is_approved },
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["pending-stores"] }),
  });
}
