import { Search } from 'lucide-react';
import { useEffect } from 'react';
import footer from '../../assets/footer.png';
import logo from '../../assets/logo-neirapp.png';
import { Leaf } from '../common/Leaf.jsx';
import SolidIcon from '../icons/Solid.jsx';
import ProfileMenu from './ProfileMenu.jsx';
import '../layout/app-shell.css';
import './panel-desktop.css';

/**
 * Marco de escritorio de los paneles (comerciante, repartidor), con el mismo estilo de la app de clientes: logo y buscador
 * arriba con campana y perfil; menú lateral con eslogan y paisaje a la izquierda; contenido en el centro; y a la derecha
 * el contenido de `right` (resumen, avisos), con `promo` fijo en la esquina inferior derecha.
 *
 *   nav      → [{ key, label, icon }] con `icon` de `SolidIcon`
 *   badges   → { [key]: número } contador rojo sobre un botón del menú
 *   profile  → { name, image, Icon, roleLabel } para el menú del perfil
 *   bell     → { count, onClick, label }
 *   search   → { placeholder, value, onChange }; omitirlo oculta el buscador
 */
export default function PanelDesktop({ user, profile, nav, badges = {}, view, onSelect, bell, search, slogan, right, promo, onLogout, menuEnabled = true, children }) {
  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  return (
    <div className="app md">
      <div className="logo-cell">
        <img src={logo} alt="NeirAPP" />
      </div>

      <header className="topbar">
        {search && menuEnabled && (
          <label className="search">
            <Search size={22} aria-hidden="true" />
            <input type="search" placeholder={search.placeholder} aria-label="Buscar" value={search.value} onChange={(e) => search.onChange(e.target.value)} />
          </label>
        )}

        <div className="top-right">
          {bell && (
            <>
              <button type="button" className="cart-btn md-bell" aria-label={bell.label} disabled={!menuEnabled} onClick={bell.onClick}>
                <SolidIcon name="bell" size={26} />
                {bell.count > 0 && <span className="cart-badge">{bell.count > 99 ? '99+' : bell.count}</span>}
              </button>
              <span className="md-sep" aria-hidden="true" />
            </>
          )}
          <ProfileMenu user={user} onLogout={onLogout} {...profile} />
        </div>

        <div className="top-leaves" aria-hidden="true">
          <Leaf fill="#2d7a3d" style={{ right: 28, top: -30, width: 60, transform: 'rotate(38deg)' }} />
          <Leaf fill="#e8a92c" style={{ right: -8, top: 8, width: 44, transform: 'rotate(18deg)' }} />
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label={`Panel de ${profile.roleLabel.toLowerCase()}`}>
          {nav.map(({ key, label, icon }) => (
            <button key={key} type="button" className={`side-item${view === key ? ' active' : ''}`} aria-current={view === key ? 'page' : undefined} disabled={!menuEnabled} onClick={() => onSelect(key)}>
              <span className="side-ico">
                <SolidIcon name={icon} size={24} />
                {badges[key] > 0 && <span className="side-badge">{badges[key]}</span>}
              </span>
              {label}
            </button>
          ))}
        </nav>
        <div className="side-art" aria-hidden="true">
          <img className="side-slogan" src={slogan} alt="" />
        </div>
      </aside>

      <main className="md-main">{children}</main>

      <aside className="md-right" aria-label="Resumen y avisos">
        {right}
      </aside>

      {promo}

      <img className="home-footer" src={footer} alt="" aria-hidden="true" />
    </div>
  );
}
