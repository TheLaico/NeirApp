import { ChevronDown, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canAccessAdmin } from '../../config/roles.js';
import { useNavigate } from '../../lib/router.jsx';
import './mobile.css';

/** Cierra `open` con clic fuera o Escape. */
function useDismiss(open, setOpen, ref) {
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
  }, [open, setOpen, ref]);
}

function ProfileMenu({ user, roleName, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useDismiss(open, setOpen, ref);

  return (
    <div ref={ref} className="cr-profile">
      <button type="button" className="cr-profile-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="cr-avatar">
          <UserRound size={18} aria-hidden="true" />
        </span>
        <span className="cr-profile-text">
          <strong>{user.name.split(' ')[0]}</strong>
          <small>{roleName}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="cr-dropdown">
          <button type="button" role="menuitem" onClick={onLogout}>
            <LogOut size={16} aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Marco de las apps para celular: navbar con menú de hamburguesa a la izquierda y el perfil (nombre y rol) con
 * "Cerrar sesión" a la derecha. `menu` = [{ key, label, Icon }]; `dots` marca con un punto las secciones con novedades.
 */
export default function MobileShell({ user, roleName, brand, BrandIcon, menu, view, onSelect, menuEnabled = true, dots = {}, onLogout, children }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  const current = menu.find((m) => m.key === view) ?? menu[0];

  return (
    <div className="cr">
      <header className="cr-bar">
        <button type="button" className="cr-icon" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <Menu size={24} aria-hidden="true" />
          {Object.values(dots).some(Boolean) && <span className="cr-dot cr-dot-bar" aria-hidden="true" />}
        </button>
        <h1 className="cr-title">{menuEnabled ? current.label : roleName}</h1>
        <ProfileMenu user={user} roleName={roleName} onLogout={onLogout} />
      </header>

      {menuOpen && (
        <>
          <div className="cr-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav className="cr-drawer" aria-label={`Menú de ${roleName.toLowerCase()}`}>
            <div className="cr-drawer-head">
              <span className="cr-brand">
                <BrandIcon size={22} aria-hidden="true" />
                <strong>{brand}</strong>
              </span>
              <button type="button" className="cr-icon" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            {menu.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`cr-nav${view === key ? ' active' : ''}`}
                aria-current={view === key ? 'page' : undefined}
                disabled={!menuEnabled}
                onClick={() => {
                  onSelect(key);
                  setMenuOpen(false);
                }}
              >
                <Icon size={20} aria-hidden="true" />
                {label}
                {dots[key] && <span className="cr-dot" aria-label="Hay novedades" />}
              </button>
            ))}
            {canAccessAdmin(user) && (
              <button type="button" className="cr-nav foot" onClick={() => navigate('/admin')}>
                <ShieldCheck size={20} aria-hidden="true" />
                Panel de administrador
              </button>
            )}
          </nav>
        </>
      )}

      <main className="cr-main">{children}</main>
    </div>
  );
}
