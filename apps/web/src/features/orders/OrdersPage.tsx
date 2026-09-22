import { ArrowLeft, Package } from "lucide-react";
import { Link } from "react-router";
import { formatCop } from "../../lib/money";
import { Navbar } from "../../shared/ui/Navbar";
import { useMyOrders } from "./api";
import { StoreOrderStatusBadge } from "./StoreOrderStatusBadge";

export function OrdersPage() {
  const orders = useMyOrders();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <h1 className="mb-4 text-2xl">Mis pedidos</h1>

        {orders.isPending && <p className="text-muted">Cargando…</p>}

        {orders.data?.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-white py-16 text-center shadow-soft">
            <Package size={32} className="text-brand-deep/40" aria-hidden="true" />
            <p className="text-muted">Todavía no has hecho ningún pedido.</p>
          </div>
        )}

        <ul className="space-y-3">
          {orders.data?.map((order) => (
            <li key={order.id}>
              <Link
                to={`/pedidos/${order.id}`}
                className="block rounded-card border border-line bg-white p-4 shadow-soft hover:border-brand"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {new Date(order.created_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                  <span className="font-display font-semibold text-ink">
                    {formatCop(order.total_cop)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {order.store_orders.map((so) => (
                    <span key={so.id} className="flex items-center gap-1.5 text-sm text-ink">
                      {so.store_name}
                      <StoreOrderStatusBadge status={so.status} />
                    </span>
                  ))}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
