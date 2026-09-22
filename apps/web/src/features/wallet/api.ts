import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { unwrap } from "../../lib/errors";

export function useWalletBalance() {
  return useQuery({
    queryKey: ["wallet-balance"],
    queryFn: async () => unwrap(await api.GET("/api/v1/wallet/balance")),
  });
}

export function useWalletLedger() {
  return useQuery({
    queryKey: ["wallet-ledger"],
    queryFn: async () => unwrap(await api.GET("/api/v1/wallet/ledger")),
  });
}

export function useRequestWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amountCop: number) =>
      unwrap(await api.POST("/api/v1/wallet/withdrawals", { body: { amount_cop: amountCop } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet-ledger"] });
    },
  });
}
