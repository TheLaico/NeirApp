import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStoreOrdersSocket } from "./useStoreOrdersSocket";

vi.mock("../auth/session", () => ({ getAccessToken: vi.fn().mockResolvedValue("access-token") }));

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;

  constructor(url: string | URL) {
    this.url = url.toString();
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useStoreOrdersSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("no conecta si no hay storeId", async () => {
    renderHook(() => useStoreOrdersSocket(undefined, vi.fn()), { wrapper });
    await new Promise((r) => setTimeout(r, 10));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("conecta con la URL de la tienda y el token en la query", async () => {
    renderHook(() => useStoreOrdersSocket("store-1", vi.fn()), { wrapper });

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
    const url = new URL(MockWebSocket.instances[0]!.url);
    expect(url.pathname).toBe("/api/v1/stores/store-1/orders/ws");
    expect(url.searchParams.get("token")).toBe("access-token");
    expect(["ws:", "wss:"]).toContain(url.protocol);
  });

  it("llama al callback cuando llega un mensaje", async () => {
    const onNewOrder = vi.fn();
    renderHook(() => useStoreOrdersSocket("store-1", onNewOrder), { wrapper });
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));

    MockWebSocket.instances[0]!.onmessage?.({ data: '{"type":"new_order"}' });

    expect(onNewOrder).toHaveBeenCalledTimes(1);
  });

  it("cierra el socket al desmontar y no reconecta", async () => {
    const { unmount } = renderHook(() => useStoreOrdersSocket("store-1", vi.fn()), { wrapper });
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));

    unmount();

    expect(MockWebSocket.instances[0]!.closed).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("reconecta si el socket se cierra solo (no por desmontaje)", async () => {
    renderHook(() => useStoreOrdersSocket("store-1", vi.fn()), { wrapper });
    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));

    MockWebSocket.instances[0]!.onclose?.();

    await waitFor(() => expect(MockWebSocket.instances).toHaveLength(2), { timeout: 5000 });
  });
});
