import { ChevronDown, LogOut, Settings, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canAccessAdmin } from '../../config/roles.js';
import { useNavigate } from '../../lib/router.jsx';

/**
 * Perfil del panel (comerciante o repartidor) con "Cerrar sesión". Muestra la foto o un ícono, el nombre y el rol.
 * Con `compact` (celular) solo se ve el avatar. Con `onSettings` agrega "Configuración" (lo usa el profesional).
 */
export default function ProfileMenu({ user, name, image, Icon, roleLabel, onLogout, onSettings, compact = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

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
    <div ref={ref} className={`user-menu${compact ? ' compact' : ''}`}>
      <button type="button" className="user-btn" aria-haspopup="menu" aria-expanded={open} aria-label={`Perfil de ${name}`} onClick={() => setOpen((v) => !v)}>
        <span className="user-avatar md-avatar">{image ? <img src={image} alt="" /> : <Icon size={24} aria-hidden="true" />}</span>
        {!compact && (
          <>
            <span className="user-text">
              <strong>{name}</strong>
              <small>{roleLabel}</small>
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </>
        )}
      </button>
      {open && (
        <div role="menu" className="user-dropdown">
          <div className="user-dropdown-head">
            <p>{name}</p>
            <small>
              {roleLabel} · {user.email}
            </small>
          </div>
          {canAccessAdmin(user) && (
            <button type="button" role="menuitem" onClick={() => navigate('/admin')}>
              <ShieldCheck size={16} aria-hidden="true" />
              Panel de administrador
            </button>
          )}
          {onSettings && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
            >
              <Settings size={16} aria-hidden="true" />
              Configuración
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
