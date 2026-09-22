import { ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { useAvailableDeliveries, useClaimDelivery, useMyActiveDelivery } from "./api";
import type { ClaimableOrderDto } from "./types";

function AvailableOrderCard({ order }: { order: ClaimableOrderDto }) {
  const claim = useClaimDelivery();
  const navigate = useNavigate();

  return (
    <li className="rounded-card border border-line bg-white p-4 shadow-soft">
      {claim.isError && claim.variables === order.order_id && (
        <div className="mb-3">
          <ErrorAlert message={errorMessage(claim.error)} />
        </div>
      )}
      <p className="mb-2 text-sm font-medium text-ink">
        {order.stops.length} {order.stops.length === 1 ? "tienda" : "tiendas"}
      </p>
      <ul className="mb-3 space-y-1">
        {order.stops.map((stop) => (
          <li key={stop.store_order_id} className="text-sm text-muted">
            {stop.store_name}
          </li>
        ))}
      </ul>
      {order.delivery_notes && (
        <p className="mb-3 text-sm text-muted">Notas de entrega: {order.delivery_notes}</p>
      )}
      <Button
        className="h-9 px-3"
        loading={claim.isPending && claim.variables === order.order_id}
        onClick={() =>
          claim.mutate(order.order_id, {
            onSuccess: () => void navigate("/repartidor/actual"),
          })
        }
      >
        Tomar este pedido
      </Button>
    </li>
  );
}

export function AvailableDeliveriesPage() {
  const active = useMyActiveDelivery();
  const available = useAvailableDeliveries();

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

        <h1 className="mb-4 text-2xl">Pedidos disponibles</h1>

        {active.data && (
          <div className="mb-4 rounded-control bg-panela/20 px-4 py-3 text-sm text-ink">
            Ya tienes una entrega en curso.{" "}
            <Link to="/repartidor/actual" className="font-medium text-brand hover:underline">
              Ir a mi entrega actual
            </Link>
          </div>
        )}

        {available.isPending && <p className="text-muted">Cargando…</p>}
        {available.isError && <ErrorAlert message={errorMessage(available.error)} />}
        {available.data?.length === 0 && (
          <p className="text-muted">No hay pedidos disponibles por ahora.</p>
        )}

        <ul className="space-y-3">
          {available.data?.map((order) => (
            <AvailableOrderCard key={order.order_id} order={order} />
          ))}
        </ul>
      </main>
    </div>
  );
}
