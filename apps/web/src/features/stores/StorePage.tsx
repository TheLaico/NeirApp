import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";
import { useStoreProducts } from "../catalog/api";
import { ProductCard } from "../catalog/ProductCard";
import { Navbar } from "../../shared/ui/Navbar";
import { useStoreRatingSummary } from "../reviews/api";
import { StarRating } from "../reviews/StarRating";
import { StoreReviewsSection } from "../reviews/StoreReviewsSection";
import { useStore } from "./api";
import { CATEGORY_LABELS, StoreBadge } from "./StoreIcon";

export function StorePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const store = useStore(storeId);
  const products = useStoreProducts(storeId, true);
  const ratingSummary = useStoreRatingSummary(storeId);

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

        {store.isPending && <p className="text-muted">Cargando tienda…</p>}
        {store.isError && <p className="text-terracotta">No pudimos cargar esta tienda.</p>}

        {store.data && (
          <>
            <header className="flex items-start gap-4 rounded-card border border-line bg-white p-5 shadow-soft">
              <StoreBadge category={store.data.category} size={56} />
              <div>
                <h1 className="text-xl">{store.data.name}</h1>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
                  <span>
                    {CATEGORY_LABELS[store.data.category]} ·{" "}
                    {store.data.is_open ? (
                      <span className="text-brand">Abierta ahora</span>
                    ) : (
                      <span className="text-terracotta">Cerrada</span>
                    )}
                  </span>
                  {!!ratingSummary.data?.count && (
                    <span className="flex items-center gap-1">
                      <StarRating value={Math.round(ratingSummary.data.average)} size={14} />
                      {ratingSummary.data.average.toFixed(1)} ({ratingSummary.data.count})
                    </span>
                  )}
                </p>
                {store.data.description && (
                  <p className="mt-2 max-w-2xl text-sm text-ink">{store.data.description}</p>
                )}
              </div>
            </header>

            <section className="mt-6">
              <h2 className="mb-3 text-lg">Catálogo</h2>
              {products.isPending && <p className="text-muted">Cargando productos…</p>}
              {products.data?.length === 0 && (
                <p className="text-muted">Esta tienda todavía no tiene productos disponibles.</p>
              )}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {products.data?.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    storeId={store.data.id}
                    storeName={store.data.name}
                  />
                ))}
              </div>
            </section>

            <StoreReviewsSection storeId={store.data.id} />
          </>
        )}
      </main>
    </div>
  );
}
