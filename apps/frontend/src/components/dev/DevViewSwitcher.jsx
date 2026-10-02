import { BedDouble, Bike, BriefcaseBusiness, Building2, CalendarCheck, Car, Code2, ShieldCheck, Store, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { canAccessAdmin } from '../../config/roles.js';
import { useNavigate, usePath } from '../../lib/router.jsx';
import './dev-switcher.css';

// Vista de cada rol. Se decide por la ruta, así el botón sirve igual en cualquier pantalla.
const VIEWS = [
  { key: 'customer', label: 'Cliente', to: '/', Icon: UserRound, match: (p) => !/^\/(admin|repartidor|comercio|profesional(\/|$)|proveedor(\/|$)|hotel(\/|$)|establecimiento(\/|$)|conductor(\/|$))/.test(p) && p !== '/proveedores/mi-empresa' },
  { key: 'courier', label: 'Repartidor', to: '/repartidor', Icon: Bike, match: (p) => p.startsWith('/repartidor') },
  { key: 'merchant', label: 'Comerciante', to: '/comercio', Icon: Store, match: (p) => p.startsWith('/comercio') },
  { key: 'professional', label: 'Profesional', to: '/profesional', Icon: BriefcaseBusiness, match: (p) => /^\/profesional(\/|$)/.test(p) },
  { key: 'supplier', label: 'Proveedor', to: '/proveedor', Icon: Building2, match: (p) => /^\/proveedor(\/|$)/.test(p) || p === '/proveedores/mi-empresa' },
  { key: 'hotel', label: 'Hotel', to: '/hotel', Icon: BedDouble, match: (p) => /^\/hotel(\/|$)/.test(p) },
  { key: 'venue', label: 'Establecimiento', to: '/establecimiento', Icon: CalendarCheck, match: (p) => /^\/establecimiento(\/|$)/.test(p) },
  { key: 'driver', label: 'Conductor', to: '/conductor', Icon: Car, match: (p) => /^\/conductor(\/|$)/.test(p) },
  { key: 'admin', label: 'Administrador', to: '/admin', Icon: ShieldCheck, match: (p) => p.startsWith('/admin') },
];

/** Botón flotante para saltar entre las vistas de cada rol. Solo lo ve el equipo de desarrollo. */
export default function DevViewSwitcher({ user }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const path = usePath();
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

  if (!canAccessAdmin(user)) return null;

  return (
    <div ref={ref} className="dev-switch">
      {open && (
        <div role="menu" className="dev-panel" aria-label="Cambiar de vista">
          <div className="dev-panel-head">
            <strong>Vista de desarrollo</strong>
            <button type="button" aria-label="Cerrar" onClick={() => setOpen(false)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {VIEWS.map(({ key, label, to, Icon, match }) => {
            const active = match(path);
            return (
              <button
                key={key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                className={`dev-item${active ? ' active' : ''}`}
                onClick={() => {
                  setOpen(false);
                  navigate(to);
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            );
          })}
          <small>Solo lo ves tú. No cambia tu rol real.</small>
        </div>
      )}
      <button type="button" className="dev-fab" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <Code2 size={18} aria-hidden="true" />
        DEV
      </button>
    </div>
  );
}
