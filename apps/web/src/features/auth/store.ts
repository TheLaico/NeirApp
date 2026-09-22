import type { Schemas } from "@neirapp/api-client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
 * Sesión del usuario, persistida en localStorage.
 * Deuda conocida: los tokens en localStorage son legibles por cualquier XSS. Antes de producción
 * el refresh token debe pasar a una cookie httpOnly (ver docs/ARCHITECTURE.md, "Riesgos abiertos").
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
    { name: "neirapp.auth" },
  ),
);
