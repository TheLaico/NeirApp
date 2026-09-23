import { AlertTriangle, ArrowLeft, Bike } from "lucide-react";
import { Link, useParams } from "react-router";
import { formatCop } from "../../lib/money";
import { Navbar } from "../../shared/ui/Navbar";
import { useDeliveryForOrder } from "../dispatch/api";
import { ReviewStoreOrderForm } from "../reviews/ReviewStoreOrderForm";
import { useOrder } from "./api";
import { StoreOrderStatusBadge } from "./StoreOrderStatusBadge";

function DeliveryStatusCard({ orderId }: { orderId: string }) {
  const delivery = useDeliveryForOrder(orderId);
  if (!delivery.data) return null;

  const { status, delivery_code, stops_picked_up, stops_total } = delivery.data;
  return (
    <div className="mb-4 rounded-card border border-line bg-white p-4 shadow-soft">
      <div className="mb-2 flex items-center gap-2">
        <Bike size={18} className="text-brand" aria-hidden="true" />
        <h2 className="font-display text-base font-semibold">Tu repartidor va en camino</h2>
      </div>
      {status === "assigned" && (
        <>
          <p className="text-sm text-muted">
            {stops_picked_up} de {stops_total} recogidas confirmadas.
          </p>
          <p className="mt-2 text-sm text-ink">
            Dale este código al repartidor cuando te entregue tu pedido:{" "}
            <span className="font-mono text-base font-semibold">{delivery_code}</span>
          </p>
        </>
      )}
      {status === "delivered" && <p className="text-sm text-brand">Pedido entregado.</p>}
      {status === "cancelled" && (
        <p className="text-sm text-terracotta">La entrega se canceló. La tienda te contactará.</p>
      )}
    </div>
  );
}

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const order = useOrder(orderId);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/pedidos"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Mis pedidos
        </Link>

        {order.isPending && <p className="text-muted">Cargando…</p>}
        {order.isError && <p className="text-terracotta">No pudimos cargar este pedido.</p>}

        {order.data && (
          <>
            <h1 className="mb-1 text-2xl">Pedido</h1>
            <p className="mb-4 text-sm text-muted">
              {new Date(order.data.created_at).toLocaleString("es-CO", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>

            <DeliveryStatusCard orderId={order.data.id} />

            <div className="space-y-4">
              {order.data.store_orders.map((storeOrder) => (
                <section
                  key={storeOrder.id}
                  className="rounded-card border border-line bg-white p-4 shadow-soft"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-display text-base font-semibold">{storeOrder.store_name}</h2>
                    <StoreOrderStatusBadge status={storeOrder.status} />
                  </div>
                  <ul className="divide-y divide-line">
                    {storeOrder.lines.map((line) => (
                      <li
                        key={line.product_id}
                        className="flex justify-between py-2 text-sm text-ink"
                      >
                        <span>
                          {line.quantity} × {line.name}
                        </span>
                        <span className="tabular-nums">{formatCop(line.subtotal_cop)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-medium">
                    <span>Subtotal</span>
                    <span>{formatCop(storeOrder.subtotal_cop)}</span>
                  </div>
                  {storeOrder.status === "handed_over" && (
                    <div className="mt-3">
                      <ReviewStoreOrderForm storeOrderId={storeOrder.id} />
                    </div>
                  )}
                </section>
              ))}
            </div>

            <div className="mt-4 flex justify-between rounded-card border border-line bg-white p-4 font-display text-lg font-semibold shadow-soft">
              <span>Total</span>
              <span>{formatCop(order.data.total_cop)}</span>
            </div>

            <Link
              to={`/pedidos/${order.data.id}/reportar`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
            >
              <AlertTriangle size={16} aria-hidden="true" />
              Reportar un problema con este pedido
            </Link>
          </>
        )}
      </main>
    </div>
  );
}
