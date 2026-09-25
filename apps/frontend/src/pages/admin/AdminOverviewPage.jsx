import { Package, Plus, Receipt, Store } from 'lucide-react';
import { useOrders } from '../../features/orders/OrdersContext.jsx';
import { useStores } from '../../features/stores/api.js';
import { useLocalCatalog } from '../../features/stores/localCatalog.js';
import { useNavigate } from '../../lib/router.jsx';
import AdminLayout from './AdminLayout.jsx';

/** Panel de administrador: resumen. */
export default function AdminOverviewPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { stores } = useStores();
  const local = useLocalCatalog();
  const { orders } = useOrders();

  const productCount = Object.values(local.products).reduce((sum, list) => sum + list.length, 0);
  const stats = [
    { label: 'Tiendas en el mapa', value: stores.length, hint: `${stores.length - local.stores.length} del servidor · ${local.stores.length} locales`, Icon: Store },
    { label: 'Productos locales', value: productCount, hint: 'Creados desde este panel', Icon: Package },
    { label: 'Pedidos en este navegador', value: orders.length, hint: 'Hechos desde el checkout', Icon: Receipt },
  ];

  return (
    <AdminLayout
      user={user}
      onLogout={onLogout}
      title="Resumen"
      subtitle={`Hola, ${user.name.split(' ')[0]}. Aquí administras las tiendas de NeirAPP.`}
      actions={
        <button type="button" className="a-btn primary" onClick={() => navigate('/admin/tiendas?nueva=1')}>
          <Plus size={18} aria-hidden="true" />
          Crear tienda
        </button>
      }
    >
      <div className="a-stats">
        {stats.map(({ label, value, hint, Icon }) => (
          <section key={label} className="a-card a-stat">
            <span className="a-stat-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
              <small>{hint}</small>
            </div>
          </section>
        ))}
      </div>

      <section className="a-card a-note">
        <h2>Cómo funcionan las tiendas que creas aquí</h2>
        <p>
          Por ahora las tiendas y productos que creas en este panel se guardan <strong>en este navegador</strong> y aparecen en
          el mapa y en las listas de la app. Para publicarlas en el servidor hace falta la sesión real con el backend y la
          aprobación de un administrador; cuando eso exista, este panel pasa a guardarlas allí sin cambiar de pantalla.
        </p>
      </section>
    </AdminLayout>
  );
}
