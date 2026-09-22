import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { cartGroups, cartTotalCop, useCartStore } from "../cart/store";
import { errorMessage } from "../../lib/errors";
import { formatCop } from "../../lib/money";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { NeiraMap } from "../map/NeiraMap";
import { useCreateOrder, usePayOrder } from "./api";

export function CheckoutPage() {
  const navigate = useNavigate();
  const rawGroups = useCartStore((s) => s.groups);
  const groups = useMemo(() => cartGroups(rawGroups), [rawGroups]);
  const total = useMemo(() => cartTotalCop(rawGroups), [rawGroups]);
  const clearCart = useCartStore((s) => s.clear);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [notes, setNotes] = useState("");
  const [locationError, setLocationError] = useState(false);

  const createOrder = useCreateOrder();
  const payOrder = usePayOrder();
  const isPaying = createOrder.isPending || payOrder.isPending;

  const handlePay = () => {
    if (!location) {
      setLocationError(true);
      return;
    }
    setLocationError(false);
    createOrder.mutate(
      {
        delivery_lat: location.lat,
        delivery_lng: location.lng,
        delivery_notes: notes,
        items: groups.flatMap((group) =>
          group.lines.map((line) => ({
            store_id: group.storeId,
            product_id: line.product.id,
            quantity: line.quantity,
          })),
        ),
      },
      {
        onSuccess: (order) => {
          payOrder.mutate(order.id, {
            onSuccess: () => {
              clearCart();
              navigate(`/pedidos/${order.id}`, { replace: true });
            },
          });
        },
      },
    );
  };

  if (groups.length === 0) {
    return (
      <div className="min-h-dvh">
        <Navbar />
        <main className="mx-auto w-full max-w-2xl px-4 py-6 text-center">
          <p className="text-muted">Tu carrito está vacío.</p>
          <Link to="/" className="font-medium text-brand hover:underline">
            Explorar tiendas
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link
          to="/carrito"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al carrito
        </Link>

        <h1 className="mb-4 text-2xl">Confirmar pedido</h1>

        {(createOrder.isError || payOrder.isError) && (
          <div className="mb-4">
            <ErrorAlert message={errorMessage(createOrder.error ?? payOrder.error)} />
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">¿Dónde te entregamos?</p>
          <p className="text-sm text-muted">Toca el mapa en el punto exacto de entrega.</p>
          <NeiraMap
            stores={[]}
            pickMode
            pickedLocation={location}
            onPick={(lat, lng) => {
              setLocation({ lat, lng });
              setLocationError(false);
            }}
            className="h-56 w-full overflow-hidden rounded-card border border-line"
          />
          {locationError && (
            <p role="alert" className="text-sm text-terracotta">
              Marca el punto de entrega en el mapa.
            </p>
          )}
        </div>

        <div className="mt-4 space-y-1.5">
          <label htmlFor="delivery-notes" className="block text-sm font-medium text-ink">
            Referencia para el repartidor (opcional)
          </label>
          <textarea
            id="delivery-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: casa azul, portón negro, segundo piso…"
            className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand"
          />
        </div>

        <div className="mt-5 space-y-2 rounded-card border border-line bg-white p-4 shadow-soft">
          {groups.map((group) => (
            <div key={group.storeId} className="flex justify-between text-sm">
              <span className="text-ink">{group.storeName}</span>
              <span className="text-muted">
                {formatCop(group.lines.reduce((s, l) => s + l.product.price_cop * l.quantity, 0))}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-line pt-2 font-display text-base font-semibold">
            <span>Total</span>
            <span>{formatCop(total)}</span>
          </div>
        </div>

        <p className="mt-3 text-xs text-muted">
          Pago de prueba: en esta fase se aprueba automáticamente, sin pasarela real.
        </p>

        <Button fullWidth loading={isPaying} onClick={handlePay} className="mt-4">
          Pagar {formatCop(total)}
        </Button>
      </main>
    </div>
  );
}
