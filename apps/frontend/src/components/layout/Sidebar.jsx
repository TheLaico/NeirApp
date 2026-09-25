import { Bell, House, Settings, ShoppingCart, Star, Wallet } from 'lucide-react';
import slogan from '../../assets/slogan.png';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useNavigate, usePath } from '../../lib/router.jsx';

// `to`: ruta de cada página.
const ITEMS = [
  { id: 'inicio', label: 'Inicio', Icon: House, to: '/' },
  { id: 'pedidos', label: 'Mis pedidos', Icon: ShoppingCart, to: '/pedidos' },
  { id: 'favoritos', label: 'Favoritos', Icon: Star, to: '/favoritos' },
  { id: 'notificaciones', label: 'Notificaciones', Icon: Bell, to: '/notificaciones' },
  { id: 'pagos', label: 'Métodos de pago', Icon: Wallet, to: '/pagos' },
  { id: 'config', label: 'Configuración', Icon: Settings, to: '/configuracion' },
];

export default function Sidebar() {
  const path = usePath();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  // Cualquier ruta desconocida cae en el inicio.
  // El checkout pertenece a "Mis pedidos".
  const current = path === '/checkout' ? '/pedidos' : path;
  const known = ITEMS.some((item) => item.to === current);

  return (
    <aside className="sidebar">
      <nav aria-label="Principal">
        {ITEMS.map(({ id, label, Icon, to }) => {
          const active = to === current || (to === '/' && !known);
          const badge = id === 'notificaciones' ? unreadCount : 0;
          return (
            <button
              key={id}
              type="button"
              className={`side-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(to)}
            >
              <span className="side-ico">
                <Icon size={22} aria-hidden="true" fill={id === 'favoritos' ? 'currentColor' : 'none'} />
                {badge > 0 && <span className="side-badge">{badge}</span>}
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className="side-art" aria-hidden="true">
        <img className="side-slogan" src={slogan} alt="" />
      </div>
    </aside>
  );
}
