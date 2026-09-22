import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccessToken } from "./session";
import { useAuthStore } from "./store";

const USER = {
  id: "0d1c2a4e-0000-4000-8000-000000000001",
  email: "ana@correo.com",
  full_name: "Ana Gómez",
  phone: "+573001234567",
  roles: ["customer"] as ("customer" | "courier" | "store_staff" | "admin")[],
  must_accept_terms: false,
};

function session(accessToken: string, refreshToken: string, expiresInSeconds: number) {
  return {
    user: USER,
    tokens: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "bearer",
      expires_in: expiresInSeconds,
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("getAccessToken", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    useAuthStore.getState().clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("devuelve null si no hay sesión", async () => {
    expect(await getAccessToken()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve el token actual mientras no esté por vencer", async () => {
    useAuthStore.getState().setSession(session("access-1", "refresh-1", 900));
    expect(await getAccessToken()).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refresca cuando faltan menos de 30 s y guarda los tokens nuevos", async () => {
    useAuthStore.getState().setSession(session("access-1", "refresh-1", 10));
    fetchMock.mockResolvedValueOnce(jsonResponse(session("access-2", "refresh-2", 900)));

    expect(await getAccessToken()).toBe("access-2");

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toContain("/api/v1/identity/refresh");
    expect(await request.clone().json()).toEqual({ refresh_token: "refresh-1" });
    expect(useAuthStore.getState().refreshToken).toBe("refresh-2");
  });

  it("llamadas concurrentes comparten una sola petición de refresh", async () => {
    useAuthStore.getState().setSession(session("access-1", "refresh-1", 10));
    fetchMock.mockResolvedValue(jsonResponse(session("access-2", "refresh-2", 900)));

    const tokens = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);

    expect(tokens).toEqual(["access-2", "access-2", "access-2"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("cierra la sesión si el servidor rechaza el refresh token", async () => {
    useAuthStore.getState().setSession(session("access-1", "refresh-1", 10));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ title: "No autenticado", status: 401, code: "invalid_token", detail: "x" }, 401),
    );

    expect(await getAccessToken()).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("conserva la sesión si falla la red al refrescar", async () => {
    useAuthStore.getState().setSession(session("access-1", "refresh-1", 10));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    expect(await getAccessToken()).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBe("refresh-1");
  });
});
