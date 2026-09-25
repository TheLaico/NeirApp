import { MapPin, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useStores } from '../../features/stores/api.js';
import { localCatalog, useLocalCatalog } from '../../features/stores/localCatalog.js';
import { usePath } from '../../lib/router.jsx';
import AdminLayout from './AdminLayout.jsx';
import ProductManager from './ProductManager.jsx';
import StoreForm from './StoreForm.jsx';

/** Panel de administrador: crear y administrar tiendas. */
export default function AdminStoresPage({ user, onLogout }) {
  usePath(); // se vuelve a dibujar al navegar
  const { stores } = useStores();
  const local = useLocalCatalog();
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).has('nueva'));
  const [managing, setManaging] = useState(null); // id de la tienda con el gestor de productos abierto
  const [justCreated, setJustCreated] = useState(null);

  const onCreated = (store) => {
    setCreating(false);
    setJustCreated(store.name);
    setManaging(store.id); // se abre el gestor para cargar sus productos
    window.history.replaceState(null, '', '/admin/tiendas');
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Tiendas"
      subtitle="Crea tiendas y carga sus productos. Aparecen en el mapa de la app."
      actions={
        !creating && (
          <button type="button" className="a-btn primary" onClick={() => setCreating(true)}>
            <Plus size={18} aria-hidden="true" />
            Nueva tienda
          </button>
        )
      }
    >
      {justCreated && (
        <p className="a-success" role="status">
          ✓ La tienda “{justCreated}” quedó creada y ya aparece en el mapa. Agrega sus productos abajo.
        </p>
      )}

      {creating && (
        <StoreForm ownerId={user.id} otherStores={stores} onCreated={onCreated} onCancel={() => setCreating(false)} />
      )}

      <ul className="a-store-list">
        {stores.length === 0 && <li className="a-empty">Todavía no hay tiendas.</li>}
        {stores.map((store) => {
          const isLocal = Boolean(store.isLocal);
          const count = isLocal ? (local.products[store.id] ?? []).length : null;
          return (
            <li key={store.id} className="a-card a-store">
              <div className="a-store-row">
                <span className="a-store-icon" style={{ background: store.color }}>
                  <store.Icon size={22} color="#fff" aria-hidden="true" />
                </span>
                <div className="a-store-info">
                  <strong>{store.name}</strong>
                  <span>
                    {store.label} · <MapPin size={12} aria-hidden="true" /> {store.lat.toFixed(4)}, {store.lng.toFixed(4)}
                  </span>
                </div>
                <span className={`a-badge ${isLocal ? 'local' : 'server'}`}>{isLocal ? 'Local' : 'Servidor'}</span>

                {isLocal ? (
                  <>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={store.is_open}
                      aria-label={`${store.name}: ${store.is_open ? 'abierta' : 'cerrada'}`}
                      className={`a-switch${store.is_open ? ' on' : ''}`}
                      onClick={() => localCatalog.updateStore(store.id, { is_open: !store.is_open })}
                    >
                      <span />
                    </button>
                    <small className="a-avail">{store.is_open ? 'Abierta' : 'Cerrada'}</small>
                    <button type="button" className="a-btn ghost" aria-expanded={managing === store.id} onClick={() => setManaging(managing === store.id ? null : store.id)}>
                      <Package size={16} aria-hidden="true" />
                      Productos ({count})
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn danger"
                      aria-label={`Eliminar ${store.name}`}
                      onClick={() => {
                        if (window.confirm(`¿Eliminar la tienda “${store.name}” y sus productos?`)) {
                          localCatalog.removeStore(store.id);
                          if (managing === store.id) setManaging(null);
                        }
                      }}
                    >
                      <Trash2 size={17} aria-hidden="true" />
                    </button>
                  </>
                ) : (
                  <small className="a-avail muted">Solo lectura</small>
                )}
              </div>

              {isLocal && managing === store.id && <ProductManager store={store} />}
            </li>
          );
        })}
      </ul>
    </AdminLayout>
  );
}
