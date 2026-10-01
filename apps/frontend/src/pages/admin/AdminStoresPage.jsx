import { EyeOff, MapPin, Plus, Settings2 } from 'lucide-react';
import { useState } from 'react';
import { useAdminStores } from '../../features/stores/api.js';
import { usePath } from '../../lib/router.jsx';
import AdminLayout from './AdminLayout.jsx';
import RecommendedStores from './RecommendedStores.jsx';
import StoreAdminEditor from './StoreAdminEditor.jsx';
import StoreForm from './StoreForm.jsx';

/** Panel de administrador: crear tiendas para los comerciantes. Todas viven en el servidor y salen en el mapa. */
export default function AdminStoresPage({ user, onLogout }) {
  usePath(); // se vuelve a dibujar al navegar
  const { stores, status, refresh } = useAdminStores();
  const [editing, setEditing] = useState(null); // id de la tienda que se está administrando
  const [creating, setCreating] = useState(() => new URLSearchParams(window.location.search).has('nueva'));
  const [justCreated, setJustCreated] = useState(null);

  const onCreated = (store) => {
    setCreating(false);
    setJustCreated(store.name);
    refresh();
    window.history.replaceState(null, '', '/admin/tiendas');
  };

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Tiendas"
      subtitle="Crea la tienda de un comerciante. Aparece en el mapa y él administra sus productos y pedidos."
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
          ✓ La tienda “{justCreated}” quedó creada y ya aparece en el mapa. El comerciante puede cargar sus productos desde su panel.
        </p>
      )}

      {creating && <StoreForm otherStores={stores.filter((s) => s.is_listed)} onCreated={onCreated} onCancel={() => setCreating(false)} />}

      {status === 'error' && (
        <p className="a-err" role="alert">
          No se pudieron cargar las tiendas.
        </p>
      )}

      {status === 'ok' && stores.length > 0 && <RecommendedStores stores={stores.filter((s) => s.is_approved && s.is_listed)} onChanged={refresh} />}

      <ul className="a-store-list">
        {status === 'ok' && stores.length === 0 && <li className="a-empty">Todavía no hay tiendas.</li>}
        {stores.map((store) => (
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
                <span>Dueño: {store.owner_email || 'sin dueño'}</span>
              </div>
              {!store.is_listed && (
                <span className="a-badge local">
                  <EyeOff size={12} aria-hidden="true" /> Oculta
                </span>
              )}
              <span className={`a-badge ${store.is_open ? 'server' : 'local'}`}>{store.is_open ? 'Abierta' : 'Cerrada'}</span>
              <button type="button" className="a-btn ghost" aria-expanded={editing === store.id} onClick={() => setEditing(editing === store.id ? null : store.id)}>
                <Settings2 size={16} aria-hidden="true" />
                {editing === store.id ? 'Cerrar' : 'Administrar'}
              </button>
            </div>
            {editing === store.id && <StoreAdminEditor key={store.id} store={store} onChanged={refresh} />}
          </li>
        ))}
      </ul>
    </AdminLayout>
  );
}
