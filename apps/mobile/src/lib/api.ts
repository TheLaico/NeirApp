import { createApiClient } from "@neirapp/api-client";
import { useAuthStore } from "@/features/auth/store";
import { getAccessToken } from "@/lib/session";
import { API_BASE_URL } from "@/lib/env";

/** Cliente sin autenticación: para login y registro. */
export const publicApi = createApiClient({ baseUrl: API_BASE_URL });

/** Cliente autenticado: adjunta el access token y lo renueva si está por vencer. */
export const api = createApiClient({ baseUrl: API_BASE_URL, getAccessToken });

// Si el servidor rechaza un token que enviamos, la sesión ya no sirve.
api.use({
  onResponse({ request, response }) {
    if (response.status === 401 && request.headers.has("Authorization")) {
      useAuthStore.getState().clear();
    }
    return response;
  },
});
