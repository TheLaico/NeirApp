import { ArrowLeft, Check, X } from "lucide-react";
import { Link } from "react-router";
import { Button } from "../../shared/ui/Button";
import { Navbar } from "../../shared/ui/Navbar";
import { CATEGORY_LABELS } from "../stores/StoreIcon";
import type { StoreDto } from "../stores/types";
import { usePendingStores, useSetStoreApproval } from "./api";

function PendingStoreCard({ store }: { store: StoreDto }) {
  const setApproval = useSetStoreApproval(store.id);

  return (
    <li className="flex items-center justify-between gap-4 rounded-card border border-line bg-white p-4 shadow-soft">
      <div>
        <p className="text-[15px] font-medium text-ink">{store.name}</p>
        <p className="text-sm text-muted">{CATEGORY_LABELS[store.category]}</p>
        {store.description && <p className="mt-1 text-sm text-muted">{store.description}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          className="h-9 px-3"
          loading={setApproval.isPending}
          onClick={() => setApproval.mutate(true)}
        >
          <Check size={16} aria-hidden="true" />
          Aprobar
        </Button>
        <Button
          variant="ghost"
          className="h-9 px-3"
          loading={setApproval.isPending}
          onClick={() => setApproval.mutate(false)}
        >
          <X size={16} aria-hidden="true" />
          Rechazar
        </Button>
      </div>
    </li>
  );
}

export function AdminStoresPage() {
  const pending = usePendingStores();

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al mapa
        </Link>

        <h1 className="mb-4 text-2xl">Tiendas por aprobar</h1>

        {pending.isPending && <p className="text-muted">Cargando…</p>}
        {pending.isError && <p className="text-terracotta">No pudimos cargar las tiendas pendientes.</p>}
        {pending.data?.length === 0 && (
          <p className="text-muted">No hay tiendas pendientes de revisión.</p>
        )}

        <ul className="space-y-3">
          {pending.data?.map((store) => (
            <PendingStoreCard key={store.id} store={store} />
          ))}
        </ul>
      </main>
    </div>
  );
}
