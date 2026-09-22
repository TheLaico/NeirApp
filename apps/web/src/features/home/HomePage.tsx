import { SearchIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { NeiraMap } from "../map/NeiraMap";
import { CATEGORY_LABELS } from "../stores/StoreIcon";
import { useStores } from "../stores/api";
import type { StoreCategory, StoreDto } from "../stores/types";
import { Navbar } from "../../shared/ui/Navbar";

export function HomePage() {
  const navigate = useNavigate();
  const [category, setCategory] = useState<StoreCategory | undefined>(undefined);
  const stores = useStores(category);

  const goToStore = useCallback((store: StoreDto) => navigate(`/tiendas/${store.id}`), [navigate]);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <button
          type="button"
          onClick={() => navigate("/buscar")}
          className="mb-4 flex h-12 w-full items-center gap-3 rounded-control border border-line bg-white px-4 text-left text-[15px] text-muted shadow-soft hover:border-brand"
        >
          <SearchIcon size={18} aria-hidden="true" />
          Busca pizzas, medicamentos, pan…
        </button>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(undefined)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${!category ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
          >
            Todas
          </button>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(category === value ? undefined : (value as StoreCategory))}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${category === value ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <section
          aria-label="Mapa de Neira"
          className="relative h-[60dvh] min-h-[360px] overflow-hidden rounded-card border border-line shadow-soft"
        >
          <NeiraMap stores={stores.data ?? []} onSelectStore={goToStore} className="size-full" />
        </section>

        {stores.data?.length === 0 && (
          <p className="mt-4 text-center text-muted">
            Todavía no hay tiendas registradas en esta categoría.
          </p>
        )}
      </main>
    </div>
  );
}
