import { ArrowLeft } from "lucide-react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Navbar } from "../../shared/ui/Navbar";
import { useMyDeliveryHistory } from "./api";
import type { DeliveryStatus } from "./types";

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  assigned: "En curso",
  delivered: "Entregada",
  cancelled: "Cancelada",
};

export function DeliveryHistoryPage() {
  const history = useMyDeliveryHistory();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/repartidor"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Repartidor
        </Link>

        <h1 className="mb-4 text-2xl">Historial de entregas</h1>

        {history.isPending && <p className="text-muted">Cargando…</p>}
        {history.isError && <ErrorAlert message={errorMessage(history.error)} />}
        {history.data?.length === 0 && <p className="text-muted">Todavía no has hecho entregas.</p>}

        <ul className="space-y-3">
          {history.data?.map((delivery) => (
            <li
              key={delivery.id}
              className="flex items-center justify-between rounded-card border border-line bg-white p-4 shadow-soft"
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {delivery.stops.length} {delivery.stops.length === 1 ? "tienda" : "tiendas"}
                </p>
                <p className="text-sm text-muted">
                  {new Date(delivery.created_at).toLocaleString("es-CO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-deep">
                {STATUS_LABELS[delivery.status]}
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
