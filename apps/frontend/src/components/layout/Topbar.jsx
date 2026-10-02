import { ChevronDown, LogOut, Map as MapIcon, Search, ShieldCheck, ShoppingCart, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import CatCarousel from '../common/CatCarousel.jsx';
import logo from '../../assets/logo-neirapp.png';
import { GROUPS } from '../../features/stores/categories.jsx';
import { Leaf } from '../common/Leaf.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { canAccessAdmin, ROLES } from '../../config/roles.js';
import { useNavigate, usePath } from '../../lib/router.jsx';

// Las categorías de la barra (sin "Más", que no filtraba nada) para la pasarela que se desliza sola.
const TOP_GROUPS = Object.entries(GROUPS)
  .filter(([id]) => id !== 'mas')
  .map(([id, g]) => ({ id, ...g }));

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  return (
    <div ref={ref} className="user-menu">
      <button
        type="button"
        className="user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-avatar">
          <UserRound size={24} aria-hidden="true" />
        </span>
        <span className="user-text">
          <small>Bienvenido,</small>
          <strong>{user.name}</strong>
        </span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="user-dropdown">
          <div className="user-dropdown-head">
            <p>{user.name}</p>
            <small>{user.email}</small>
            {user.role !== 'customer' && <span className="role-tag">{ROLES[user.role] ?? user.role}</span>}
          </div>
          {canAccessAdmin(user) && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/admin');
              }}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              Panel de administrador
            </button>
          )}
          <button type="button" role="menuitem" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

export default function Topbar({
  user,
  onLogout,
  group,
  onGroup,
  query,
  onQuery,
  onOpenCart,
  hideCart,
}) {
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const path = usePath();

  return (
    <>
      <div className="logo-cell">
        <img src={logo} alt="NeirAPP" />
      </div>

      <header className="topbar">
        {onQuery && (
          <div className="search-wrap">
            <label className="search">
              <Search size={22} aria-hidden="true" />
              <input
                type="search"
                placeholder="Busca productos, tiendas o categorías..."
                aria-label="Buscar productos, tiendas o categorías"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
              />
            </label>
          </div>
        )}

        {/* Categorías generales de tiendas: solo en páginas que además filtran por ellas (ver `onGroup`).
            Algunas páginas quieren el buscador sin esto (por ejemplo Profesionales, que tiene las suyas
            propias más abajo en el cuerpo de la página). */}
        {onGroup && (
          <div className="cats">
            <CatCarousel cats={TOP_GROUPS} activeId={group ?? null} onSelect={(id) => onGroup(group === id ? null : id)} />
          </div>
        )}

        <div className="top-right">
          {/* Acceso al mapa: no hace falta estando ya en él. */}
          {path !== '/mapa' && (
            <button type="button" className="map-btn" aria-label="Ver el mapa de Neira" onClick={() => navigate('/mapa')}>
              <MapIcon size={22} aria-hidden="true" />
            </button>
          )}
          {!hideCart && (
            <button
              type="button"
              className="cart-btn"
              aria-label={`Carrito${totalItems ? `, ${totalItems} productos` : ''}`}
              onClick={onOpenCart}
            >
              <ShoppingCart size={24} aria-hidden="true" />
              {totalItems > 0 && <span className="cart-badge">{totalItems > 99 ? '99+' : totalItems}</span>}
            </button>
          )}
          <UserMenu user={user} onLogout={onLogout} />
        </div>

        <div className="top-leaves" aria-hidden="true">
          <Leaf fill="#2d7a3d" style={{ right: 28, top: -30, width: 60, transform: 'rotate(38deg)' }} />
          <Leaf fill="#e8a92c" style={{ right: -8, top: 8, width: 44, transform: 'rotate(18deg)' }} />
        </div>
      </header>
    </>
  );
}

