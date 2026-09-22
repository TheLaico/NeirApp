import { ArrowLeft, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { formatCop } from "../../lib/money";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { QuantityStepper } from "../../shared/ui/QuantityStepper";
import { cartGroups, cartTotalCop, useCartStore } from "./store";

export function CartPage() {
  const navigate = useNavigate();
  const rawGroups = useCartStore((s) => s.groups);
  const groups = useMemo(() => cartGroups(rawGroups), [rawGroups]);
  const total = useMemo(() => cartTotalCop(rawGroups), [rawGroups]);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const removeLine = useCartStore((s) => s.removeLine);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Seguir comprando
        </Link>

        <h1 className="mb-4 text-2xl">Tu carrito</h1>

        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-white py-16 text-center shadow-soft">
            <ShoppingBag size={32} className="text-brand-deep/40" aria-hidden="true" />
            <p className="text-muted">Aún no has agregado productos.</p>
            <Link to="/" className="font-medium text-brand hover:underline">
              Explorar tiendas
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section
                key={group.storeId}
                className="rounded-card border border-line bg-white p-4 shadow-soft"
              >
                <h2 className="mb-3 font-display text-base font-semibold">{group.storeName}</h2>
                <ul className="divide-y divide-line">
                  {group.lines.map(({ product, quantity }) => (
                    <li key={product.id} className="flex items-center gap-3 py-3">
                      <div className="flex-1">
                        <p className="text-[15px] text-ink">{product.name}</p>
                        <p className="text-sm text-muted">{formatCop(product.price_cop)} c/u</p>
                      </div>
                      <QuantityStepper
                        quantity={quantity}
                        onChange={(next) => setQuantity(group.storeId, product.id, next)}
                      />
                      <span className="w-24 text-right font-medium tabular-nums">
                        {formatCop(product.price_cop * quantity)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar ${product.name}`}
                        onClick={() => removeLine(group.storeId, product.id)}
                        className="text-muted hover:text-terracotta"
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <div className="flex items-center justify-between rounded-card border border-line bg-white p-4 shadow-soft">
              <span className="font-display text-lg font-semibold">Total</span>
              <span className="font-display text-xl font-bold text-ink">{formatCop(total)}</span>
            </div>

            <Button fullWidth onClick={() => navigate("/checkout")}>
              Continuar
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
