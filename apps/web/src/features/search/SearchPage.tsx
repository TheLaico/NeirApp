import { ArrowLeft, SearchIcon } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ProductCard } from "../catalog/ProductCard";
import { useSearchProducts } from "../catalog/api";
import { Navbar } from "../../shared/ui/Navbar";
import { CATEGORY_LABELS } from "../stores/StoreIcon";
import type { StoreCategory } from "../stores/types";

const SORTS = [
  { value: "relevance", label: "Más relevantes" },
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
] as const;

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get("q") ?? "");
  const category = (params.get("category") as StoreCategory | null) ?? undefined;
  const sort = (params.get("sort") as "relevance" | "price_asc" | "price_desc" | null) ?? "relevance";
  const q = params.get("q") ?? "";

  const results = useSearchProducts({ q, category, sort }, q.length > 0);

  const updateParams = (next: { q?: string; category?: string; sort?: string }) => {
    const merged = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    setParams(merged, { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ q: text });
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <SearchIcon
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Busca pizzas, medicamentos, pan…"
              aria-label="Buscar productos"
              className="h-12 w-full rounded-control border border-line bg-white pl-11 pr-4 text-[15px] focus:border-brand"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-control bg-brand px-5 font-display text-sm font-semibold text-white hover:bg-brand-deep"
          >
            Buscar
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateParams({ category: undefined })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${!category ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
          >
            Todas las categorías
          </button>
          {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => updateParams({ category: category === value ? undefined : value })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${category === value ? "bg-brand text-white" : "bg-brand-soft text-brand-deep"}`}
            >
              {label}
            </button>
          ))}

          <select
            aria-label="Ordenar por"
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="ml-auto rounded-control border border-line bg-white px-3 py-1.5 text-sm text-ink"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6">
          {q.length === 0 && <p className="text-muted">Escribe qué se te antoja hoy.</p>}
          {results.isPending && q.length > 0 && <p className="text-muted">Buscando…</p>}
          {results.data?.length === 0 && (
            <p className="text-muted">No encontramos productos para "{q}".</p>
          )}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.data?.map((result) => (
              <ProductCard
                key={result.product.id}
                product={result.product}
                storeId={result.store.id}
                storeName={result.store.name}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
