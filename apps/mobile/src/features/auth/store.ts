import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Schemas } from "@neirapp/api-client";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type User = Schemas["UserResponse"];
export type AuthResponse = Schemas["AuthResponse"];

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** Instante (ms epoch) en que expira el access token. */
  accessExpiresAt: number | null;
  setSession: (auth: AuthResponse) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

const EMPTY = { user: null, accessToken: null, refreshToken: null, accessExpiresAt: null };

/**
 * Sesión del repartidor, persistida en `AsyncStorage` (equivalente a `localStorage` en la web).
 * Mismo modelo de datos que `apps/web/src/features/auth/store.ts` — cuando exista un paquete
 * `@neirapp/auth` compartido, este archivo y su par web deberían fusionarse ahí.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...EMPTY,
      setSession: ({ user, tokens }) =>
        set({
          user,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessExpiresAt: Date.now() + tokens.expires_in * 1000,
        }),
      setUser: (user) => set({ user }),
      clear: () => set(EMPTY),
    }),
    { name: "neirapp.auth", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
