import { ArrowLeft, Bell } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { formatCop } from "../../lib/money";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { useMyStore } from "../stores/api";
import {
  useAcceptStoreOrder,
  useMarkStoreOrderReady,
  useRejectStoreOrder,
  useStartPreparingStoreOrder,
  useStoreOrders,
} from "./api";
import { StoreOrderStatusBadge } from "./StoreOrderStatusBadge";
import type { StoreOrderDto, StoreOrderStatus } from "./types";
import { useStoreOrdersSocket } from "./useStoreOrdersSocket";

const TABS: { value: StoreOrderStatus | undefined; label: string }[] = [
  { value: "paid", label: "Nuevos" },
  { value: "accepted", label: "Aceptados" },
  { value: "preparing", label: "Preparando" },
  { value: "ready", label: "Listos" },
  { value: undefined, label: "Todos" },
];

function StoreOrderActions({ storeOrder }: { storeOrder: StoreOrderDto }) {
  const accept = useAcceptStoreOrder();
  const reject = useRejectStoreOrder();
  const startPreparing = useStartPreparingStoreOrder();
  const markReady = useMarkStoreOrderReady();

  if (storeOrder.status === "paid") {
    return (
      <div className="flex gap-2">
        <Button
          className="h-9 px-3"
          loading={accept.isPending}
          onClick={() => accept.mutate(storeOrder.id)}
        >
          Aceptar
        </Button>
        <Button
          variant="ghost"
          className="h-9 px-3"
          loading={reject.isPending}
          onClick={() => reject.mutate(storeOrder.id)}
        >
          Rechazar
        </Button>
      </div>
    );
  }
  if (storeOrder.status === "accepted") {
    return (
      <Button
        className="h-9 px-3"
        loading={startPreparing.isPending}
        onClick={() => startPreparing.mutate(storeOrder.id)}
      >
        Empezar a preparar
      </Button>
    );
  }
  if (storeOrder.status === "preparing") {
    return (
      <Button
        className="h-9 px-3"
        loading={markReady.isPending}
        onClick={() => markReady.mutate(storeOrder.id)}
      >
        Marcar listo
      </Button>
    );
  }
  return null;
}

export function StoreOrdersPage() {
  const myStore = useMyStore(true);
  const storeId = myStore.data?.id;
  const [tab, setTab] = useState<StoreOrderStatus | undefined>("paid");
  const [justNotified, setJustNotified] = useState(false);
  const orders = useStoreOrders(storeId, tab);

  useStoreOrdersSocket(storeId, () => {
    setJustNotified(true);
    setTimeout(() => setJustNotified(false), 6000);
  });

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/mi-tienda"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Mi tienda
        </Link>

        <h1 className="mb-4 text-2xl">Pedidos</h1>

        {justNotified && (
          <div className="mb-4 flex items-center gap-2 rounded-control bg-panela/20 px-4 py-3 text-sm font-medium text-ink">
            <Bell size={16} className="text-panela" aria-hidden="true" />
            ¡Te llegó un pedido nuevo!
          </div>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => setTab(t.value)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === t.value ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {orders.isPending && <p className="text-muted">Cargando…</p>}
        {orders.data?.length === 0 && (
          <p className="text-muted">No hay pedidos {TABS.find((t) => t.value === tab)?.label.toLowerCase()}.</p>
        )}

        <ul className="space-y-3">
          {orders.data?.map((storeOrder) => (
            <li
              key={storeOrder.id}
              className="rounded-card border border-line bg-white p-4 shadow-soft"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted">
                  {new Date(storeOrder.created_at).toLocaleTimeString("es-CO", { timeStyle: "short" })}
                </span>
                <StoreOrderStatusBadge status={storeOrder.status} />
              </div>
              <ul className="mb-3 space-y-1">
                {storeOrder.lines.map((line) => (
                  <li key={line.product_id} className="flex justify-between text-sm text-ink">
                    <span>
                      {line.quantity} × {line.name}
                    </span>
                    <span className="tabular-nums text-muted">{formatCop(line.subtotal_cop)}</span>
                  </li>
                ))}
              </ul>
              <div className="mb-3 flex justify-between text-sm font-semibold text-ink">
                <span>Subtotal</span>
                <span>{formatCop(storeOrder.subtotal_cop)}</span>
              </div>
              <StoreOrderActions storeOrder={storeOrder} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
