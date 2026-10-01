import { Plus, Store } from 'lucide-react';
import { useStores } from '../../features/stores/api.js';
import { useNavigate } from '../../lib/router.jsx';
import AdminLayout from './AdminLayout.jsx';

/** Panel de administrador: resumen. */
export default function AdminOverviewPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { stores } = useStores();

  const stats = [
    { label: 'Tiendas en el mapa', value: stores.length, hint: 'Creadas en el servidor', Icon: Store },
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
        <h2>Cómo funcionan las tiendas</h2>
        <p>
          Las tiendas se crean aquí para un comerciante (por su correo, que antes debe tener el rol de comerciante en{' '}
          <strong>Roles</strong>). Ya viven en el servidor: salen en el mapa y el comerciante administra sus productos y
          recibe los pedidos desde su propio panel.
        </p>
      </section>
    </AdminLayout>
  );
}
