import { createApiClient } from "@neirapp/api-client";
import { useAuthStore } from "@/features/auth/store";
import { API_BASE_URL } from "@/lib/env";

const REFRESH_MARGIN_MS = 30_000;

// Cliente propio (sin middleware de auth) para evitar recursión al refrescar.
const refreshClient = createApiClient({ baseUrl: API_BASE_URL });

function freshAccessToken(): string | null {
  const { accessToken, accessExpiresAt } = useAuthStore.getState();
  if (accessToken && accessExpiresAt && accessExpiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return accessToken;
  }
  return null;
}

let inFlight: Promise<string | null> | null = null;

async function refresh(): Promise<string | null> {
  const { refreshToken, clear, setSession } = useAuthStore.getState();
  if (!refreshToken) return null;

  try {
    const { data, response } = await refreshClient.POST("/api/v1/identity/refresh", {
      body: { refresh_token: refreshToken },
    });
    if (data) {
      setSession(data);
      return data.tokens.access_token;
    }
    // 401 = refresh inválido/expirado/reusado: la sesión terminó. Otros errores (5xx) no la borran.
    if (response.status === 401) clear();
  } catch {
    // Sin red: conservamos la sesión y reintentamos en la próxima petición.
  }
  return null;
}

/**
 * Devuelve un access token vigente, renovándolo si está por vencer.
 * Single-flight: llamadas concurrentes comparten una única petición de refresh — a diferencia de
 * la web, no hace falta coordinar entre pestañas (una app móvil es una sola instancia).
 */
export async function getAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken } = useAuthStore.getState();
  if (!accessToken && !refreshToken) return null;

  const fresh = freshAccessToken();
  if (fresh) return fresh;

  inFlight ??= refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
