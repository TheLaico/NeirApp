import { Bell, Ellipsis, House, Map as MapIcon, Settings, ShoppingCart, Star, Wallet } from 'lucide-react';
import slogan from '../../assets/slogan.png';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import { useNavigate, usePath } from '../../lib/router.jsx';

// Computador: barra lateral completa. `to`: ruta de cada página.
const DESKTOP_ITEMS = [
  { id: 'inicio', label: 'Inicio', Icon: House, to: '/' },
  { id: 'mapa', label: 'Mapa', Icon: MapIcon, to: '/mapa' },
  { id: 'pedidos', label: 'Mis pedidos', Icon: ShoppingCart, to: '/pedidos' },
  { id: 'favoritos', label: 'Favoritos', Icon: Star, to: '/favoritos' },
  { id: 'notificaciones', label: 'Notificaciones', Icon: Bell, to: '/notificaciones' },
  { id: 'pagos', label: 'Métodos de pago', Icon: Wallet, to: '/pagos' },
  { id: 'config', label: 'Configuración', Icon: Settings, to: '/configuracion' },
];

// Celular: barra inferior de 5 pestañas. "Carrito" abre el cajón (no navega); "Más" agrupa el resto
// (Mis pedidos, Notificaciones, Métodos de pago, Configuración) en su propia página.
const MOBILE_ITEMS = [
  { id: 'inicio', label: 'Inicio', Icon: House, to: '/' },
  { id: 'mapa', label: 'Mapa', Icon: MapIcon, to: '/mapa' },
  { id: 'carrito', label: 'Carrito', Icon: ShoppingCart, action: 'cart' },
  { id: 'favoritos', label: 'Favoritos', Icon: Star, to: '/favoritos' },
  { id: 'mas', label: 'Más', Icon: Ellipsis, to: '/mas' },
];
const MOBILE_MORE_PATHS = ['/pedidos', '/notificaciones', '/pagos', '/configuracion', '/checkout'];

export default function Sidebar({ onOpenCart }) {
  const path = usePath();
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 1023px)');
  const { unreadCount } = useNotifications();
  const { totalItems } = useCart();

  const items = mobile ? MOBILE_ITEMS : DESKTOP_ITEMS;
  // Cualquier ruta desconocida cae en el inicio. El checkout pertenece a "Mis pedidos" (o a "Más" en celular),
  // y en celular las páginas que no tienen su propia pestaña pertenecen a "Más".
  const current = mobile ? (MOBILE_MORE_PATHS.includes(path) ? '/mas' : path) : path === '/checkout' ? '/pedidos' : path;
  const known = items.some((item) => item.to === current);

  return (
    <aside className="sidebar">
      <nav aria-label="Principal">
        {items.map(({ id, label, Icon, to, action }) => {
          const active = (to && to === current) || (to === '/' && !known);
          const badge = id === 'notificaciones' || id === 'mas' ? unreadCount : 0;
          // El carrito solo tiene su propio ícono en la barra inferior del celular.
          const cartCount = id === 'carrito' ? totalItems : 0;
          return (
            <button
              key={id}
              type="button"
              className={`side-item${active ? ' active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => (action === 'cart' ? onOpenCart?.() : navigate(to))}
            >
              <span className="side-ico">
                <Icon size={22} aria-hidden="true" fill={id === 'favoritos' ? 'currentColor' : 'none'} />
                {badge > 0 && <span className="side-badge">{badge}</span>}
                {cartCount > 0 && <span className="side-badge cart-count">{cartCount > 99 ? '99+' : cartCount}</span>}
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
