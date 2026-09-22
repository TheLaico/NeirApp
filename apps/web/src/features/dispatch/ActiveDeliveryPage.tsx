import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { TextField } from "../../shared/ui/TextField";
import { useCancelDelivery, useConfirmDelivery, useMyActiveDelivery } from "./api";
import type { DeliveryDto, DeliveryStopDto } from "./types";

function orderedStops(delivery: DeliveryDto): DeliveryStopDto[] {
  const byId = new Map(delivery.stops.map((s) => [s.store_order_id, s]));
  const ordered = delivery.suggested_stop_order.map((id) => byId.get(id)).filter(Boolean) as DeliveryStopDto[];
  const pickedUp = delivery.stops.filter((s) => s.is_picked_up);
  return [...ordered, ...pickedUp];
}

function StopRow({ stop, index }: { stop: DeliveryStopDto; index: number }) {
  return (
    <li className="flex items-start gap-3 rounded-card border border-line bg-white p-4 shadow-soft">
      {stop.is_picked_up ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      ) : (
        <Circle size={20} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">
          {index + 1}. {stop.store_name}
        </p>
        {stop.is_picked_up ? (
          <p className="text-sm text-muted">Recogido</p>
        ) : (
          <p className="text-sm text-muted">
            Código para la tienda: <span className="font-mono font-semibold text-ink">{stop.pickup_code}</span>
          </p>
        )}
      </div>
    </li>
  );
}

function ConfirmDeliveryForm({ delivery }: { delivery: DeliveryDto }) {
  const [code, setCode] = useState("");
  const confirmDelivery = useConfirmDelivery();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        confirmDelivery.mutate({ deliveryId: delivery.id, code });
      }}
      className="space-y-3 rounded-card border border-line bg-white p-4 shadow-soft"
    >
      <p className="text-sm font-medium text-ink">Confirmar entrega al cliente</p>
      <p className="text-sm text-muted">Pídele al cliente el código de entrega y escríbelo aquí.</p>
      {confirmDelivery.isError && <ErrorAlert message={errorMessage(confirmDelivery.error)} />}
      <TextField
        label="Código de entrega"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={16}
      />
      <Button type="submit" fullWidth loading={confirmDelivery.isPending}>
        Confirmar entrega
      </Button>
    </form>
  );
}

function CancelDeliveryButton({ deliveryId }: { deliveryId: string }) {
  const cancel = useCancelDelivery();
  return (
    <Button
      variant="ghost"
      className="h-9 px-3"
      loading={cancel.isPending}
      onClick={() => cancel.mutate(deliveryId)}
    >
      Cancelar entrega
    </Button>
  );
}

export function ActiveDeliveryPage() {
  const active = useMyActiveDelivery();

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

        <h1 className="mb-4 text-2xl">Mi entrega actual</h1>

        {active.isPending && <p className="text-muted">Cargando…</p>}
        {active.isError && <ErrorAlert message={errorMessage(active.error)} />}

        {active.data === null && (
          <p className="text-muted">
            No tienes ninguna entrega en curso.{" "}
            <Link to="/repartidor/disponibles" className="font-medium text-brand hover:underline">
              Ver pedidos disponibles
            </Link>
            .
          </p>
        )}

        {active.data && (
          <div className="space-y-4">
            <ul className="space-y-3">
              {orderedStops(active.data).map((stop, i) => (
                <StopRow key={stop.store_order_id} stop={stop} index={i} />
              ))}
            </ul>

            {active.data.all_stops_picked_up ? (
              <ConfirmDeliveryForm delivery={active.data} />
            ) : (
              <p className="text-sm text-muted">
                Recoge todos los pedidos para poder confirmar la entrega final.
              </p>
            )}

            <CancelDeliveryButton deliveryId={active.data.id} />
          </div>
        )}
      </main>
    </div>
  );
}
