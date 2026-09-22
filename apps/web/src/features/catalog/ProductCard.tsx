import { ImageOff, Plus } from "lucide-react";
import { formatCop } from "../../lib/money";
import { Button } from "../../shared/ui/Button";
import { QuantityStepper } from "../../shared/ui/QuantityStepper";
import { useCartStore } from "../cart/store";
import type { ProductDto } from "../stores/types";

export function ProductCard({
  product,
  storeId,
  storeName,
}: {
  product: ProductDto;
  storeId: string;
  storeName: string;
}) {
  const add = useCartStore((s) => s.add);
  const setQuantity = useCartStore((s) => s.setQuantity);
  const quantity = useCartStore((s) => s.groups[storeId]?.lines[product.id]?.quantity ?? 0);

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-line bg-white shadow-soft">
      <div className="grid aspect-[4/3] place-items-center bg-brand-soft/60">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <ImageOff size={28} className="text-brand-deep/40" aria-hidden="true" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-1 text-[15px] font-medium text-ink">{product.name}</h3>
        {product.description && (
          <p className="line-clamp-2 text-sm text-muted">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-display text-base font-semibold text-ink">
            {formatCop(product.price_cop)}
          </span>
          {!product.is_available ? (
            <span className="text-sm text-muted">Agotado</span>
          ) : quantity > 0 ? (
            <QuantityStepper
              quantity={quantity}
              onChange={(next) => setQuantity(storeId, product.id, next)}
            />
          ) : (
            <Button
              variant="secondary"
              className="h-9 px-3"
              onClick={() => add(storeId, storeName, product)}
            >
              <Plus size={16} aria-hidden="true" />
              Agregar
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
