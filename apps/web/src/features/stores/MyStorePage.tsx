import { MyProductList } from "../catalog/MyProductList";
import { Navbar } from "../../shared/ui/Navbar";
import { useMyStore, useSetStoreOpen } from "./api";
import { CreateStoreForm } from "./CreateStoreForm";
import { CATEGORY_LABELS, StoreBadge } from "./StoreIcon";

function StoreManagementPanel({ store }: { store: NonNullable<ReturnType<typeof useMyStore>["data"]> }) {
  const setOpen = useSetStoreOpen(store.id);

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line bg-white p-5 shadow-soft">
        <div className="flex items-center gap-4">
          <StoreBadge category={store.category} size={56} />
          <div>
            <h1 className="text-xl">{store.name}</h1>
            <p className="text-sm text-muted">{CATEGORY_LABELS[store.category]}</p>
          </div>
        </div>
        <label className="flex items-center gap-2.5 rounded-control bg-brand-soft px-3.5 py-2 text-sm font-medium text-brand-deep">
          <input
            type="checkbox"
            className="size-4 accent-brand"
            checked={store.is_open}
            onChange={(e) => setOpen.mutate(e.target.checked)}
          />
          {store.is_open ? "Tienda abierta" : "Tienda cerrada"}
        </label>
      </header>

      <MyProductList storeId={store.id} />
    </div>
  );
}

export function MyStorePage() {
  const myStore = useMyStore(true);

  return (
    <div className="min-h-dvh">
      <Navbar />
      <main className="mx-auto w-full max-w-4xl px-4 py-6">
        {myStore.isPending && <p className="text-muted">Cargando…</p>}
        {myStore.isError && <p className="text-terracotta">No pudimos cargar tu tienda.</p>}
        {myStore.data === null && <CreateStoreForm />}
        {myStore.data && <StoreManagementPanel store={myStore.data} />}
      </main>
    </div>
  );
}
