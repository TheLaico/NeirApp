import { Bell, ChevronRight, Settings, ShoppingBag, Wallet } from 'lucide-react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useNavigate } from '../../lib/router.jsx';
import './more-page.css';

// El resto de las secciones del celular (las que no caben en la barra inferior de 5 pestañas:
// Inicio, Mapa, Carrito, Favoritos, Más).
const ITEMS = [
  { to: '/pedidos', label: 'Mis pedidos', text: 'Sigue tus pedidos y tu historial.', Icon: ShoppingBag },
  { to: '/notificaciones', label: 'Notificaciones', text: 'Avisos de tus pedidos y novedades.', Icon: Bell, badgeKey: 'notifications' },
  { to: '/pagos', label: 'Métodos de pago', text: 'Nequi, Mercado Pago o efectivo.', Icon: Wallet },
  { to: '/configuracion', label: 'Configuración', text: 'Tu perfil, preferencias y cuenta.', Icon: Settings },
];

/** Página "Más": en el celular agrupa lo que no cabe en la barra inferior. */
export default function MorePage({ user, onLogout }) {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <PageShell user={user} onLogout={onLogout} title="Más" subtitle="El resto de NeirAPP, todo en un solo lugar.">
      <div className="page-narrow">
        <ul className="more-list">
          {ITEMS.map(({ to, label, text, Icon, badgeKey }) => {
            const badge = badgeKey === 'notifications' ? unreadCount : 0;
            return (
              <li key={to}>
                <button type="button" onClick={() => navigate(to)}>
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
    </PageShell>
  );
}
