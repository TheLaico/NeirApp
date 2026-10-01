import type { Schemas } from "@neirapp/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, publicApi } from "@/lib/api";
import { unwrap } from "@/lib/errors";
import { useAuthStore } from "./store";

type RegisterBody = Schemas["RegisterRequest"];
type LoginBody = Schemas["LoginRequest"];

export function useRegister() {
  return useMutation({
    mutationFn: async (body: RegisterBody) =>
      unwrap(await publicApi.POST("/api/v1/identity/register", { body })),
    onSuccess: (data) => useAuthStore.getState().setSession(data),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (body: LoginBody) =>
      unwrap(await publicApi.POST("/api/v1/identity/login", { body })),
    onSuccess: (data) => useAuthStore.getState().setSession(data),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        await publicApi
          .POST("/api/v1/identity/logout", { body: { refresh_token: refreshToken } })
          .catch(() => undefined);
      }
    },
    onSettled: () => {
      useAuthStore.getState().clear();
      queryClient.clear();
    },
  });
}

/** Perfil vigente del servidor (roles pueden cambiar desde la última sesión). */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ["me"],
    enabled,
    queryFn: async () => {
      const user = unwrap(await api.GET("/api/v1/identity/me"));
      useAuthStore.getState().setUser(user);
      return user;
    },
  });
}
