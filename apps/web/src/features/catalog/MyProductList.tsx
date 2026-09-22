import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatCop } from "../../lib/money";
import { Button } from "../../shared/ui/Button";
import type { ProductDto } from "../stores/types";
import { useDeleteProduct, useSetProductAvailability, useStoreProducts } from "./api";
import { ProductForm } from "./ProductForm";

export function MyProductList({ storeId }: { storeId: string }) {
  const products = useStoreProducts(storeId);
  const setAvailability = useSetProductAvailability(storeId);
  const deleteProduct = useDeleteProduct(storeId);
  const [editing, setEditing] = useState<ProductDto | "new" | null>(null);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg">Tu catálogo</h2>
        {editing === null && (
          <Button variant="secondary" className="h-9 px-3" onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden="true" />
            Nuevo producto
          </Button>
        )}
      </div>

      {editing !== null && (
        <div className="mb-4">
          <ProductForm
            storeId={storeId}
            product={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {products.data?.length === 0 && editing === null && (
        <p className="text-muted">Todavía no has agregado productos.</p>
      )}

      <ul className="space-y-2">
        {products.data?.map((product) => (
          <li
            key={product.id}
            className="flex items-center gap-3 rounded-card border border-line bg-white p-3.5 shadow-soft"
          >
            <div className="flex-1">
              <p className="text-[15px] text-ink">{product.name}</p>
              <p className="text-sm text-muted">{formatCop(product.price_cop)}</p>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={product.is_available}
                onChange={(e) =>
                  setAvailability.mutate({ productId: product.id, isAvailable: e.target.checked })
                }
              />
              Disponible
            </label>

            <button
              type="button"
              aria-label={`Editar ${product.name}`}
              onClick={() => setEditing(product)}
              className="text-muted hover:text-brand"
            >
              <Pencil size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Eliminar ${product.name}`}
              onClick={() => deleteProduct.mutate(product.id)}
              className="text-muted hover:text-terracotta"
            >
              <Trash2 size={17} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
