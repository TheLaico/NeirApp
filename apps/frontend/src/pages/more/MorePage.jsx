import { Bell, ChevronRight, LayoutGrid, Settings, ShoppingBag, Wallet } from 'lucide-react';
import { useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useNavigate } from '../../lib/router.jsx';
import { CategoriesModal, categoryPath } from '../home/categories.jsx';
import './more-page.css';

// El resto de las secciones del celular (las que no caben en la barra inferior de 5 pestañas:
// Inicio, Mapa, Carrito, Favoritos, Más).
// "Categorías" no navega: abre la ventana con todas las categorías (antes era el botón "Más" del inicio).
const ITEMS = [
  { id: 'categorias', label: 'Categorías', text: 'Domicilios, profesionales, hospedaje y más.', Icon: LayoutGrid, action: 'categories' },
  { to: '/pedidos', label: 'Mis pedidos', text: 'Sigue tus pedidos y tu historial.', Icon: ShoppingBag },
  { to: '/notificaciones', label: 'Notificaciones', text: 'Avisos de tus pedidos y novedades.', Icon: Bell, badgeKey: 'notifications' },
  { to: '/pagos', label: 'Métodos de pago', text: 'Nequi, Mercado Pago o efectivo.', Icon: Wallet },
  { to: '/configuracion', label: 'Configuración', text: 'Tu perfil, preferencias y cuenta.', Icon: Settings },
];

/** Página "Más": en el celular agrupa lo que no cabe en la barra inferior. */
export default function MorePage({ user, onLogout }) {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showCats, setShowCats] = useState(false);

  const openCategory = (id) => {
    const to = categoryPath(id);
    if (!to) return;
    setShowCats(false);
    navigate(to);
  };

  return (
    <PageShell user={user} onLogout={onLogout} title="Más" subtitle="El resto de NeirAPP, todo en un solo lugar.">
      <div className="page-narrow">
        <ul className="more-list">
          {ITEMS.map(({ id, to, label, text, Icon, badgeKey, action }) => {
            const badge = badgeKey === 'notifications' ? unreadCount : 0;
            return (
              <li key={id ?? to}>
                <button type="button" onClick={() => (action === 'categories' ? setShowCats(true) : navigate(to))}>
                  <span className="more-ico">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="more-text">
                    <strong>{label}</strong>
                    <span>{text}</span>
                  </span>
                  {badge > 0 && <span className="more-badge">{badge > 99 ? '99+' : badge}</span>}
                  <ChevronRight size={19} aria-hidden="true" className="more-chev" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {showCats && <CategoriesModal onSelect={openCategory} onClose={() => setShowCats(false)} />}
    </PageShell>
  );
}
