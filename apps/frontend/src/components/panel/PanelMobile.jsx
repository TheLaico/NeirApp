import { Menu, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import footer from '../../assets/footer.png';
import logo from '../../assets/logo-neirapp.png';
import SolidIcon from '../icons/Solid.jsx';
import '../mobile/mobile.css'; // tarjetas, botones y formularios de las pantallas de gestión
import ProfileMenu from './ProfileMenu.jsx';
import './panel-desktop.css'; // piezas del diseño (tarjetas, círculos, etiquetas) que el celular reutiliza
import './panel-mobile.css';

/**
 * Marco de celular y tableta de los paneles, con el mismo diseño del de escritorio: barra superior con menú de
 * hamburguesa, logo, campana y perfil; buscador; y un menú lateral con íconos sólidos, eslogan y paisaje.
 * Recibe las mismas propiedades que `PanelDesktop` (menos `right` y `promo`: en celular van dentro del contenido).
 * Con `tabs` ([{ key, label, icon }]) cambia la hamburguesa por una barra de navegación fija abajo.
 */
export default function PanelMobile({ user, profile, nav, tabs, badges = {}, view, onSelect, bell, search, slogan, onLogout, menuEnabled = true, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const total = Object.values(badges).reduce((sum, n) => sum + (n || 0), 0);

  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  // El menú se cierra con Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const go = (key) => {
    onSelect(key);
    setMenuOpen(false);
  };

  return (
    <div className={`cr mm${tabs ? ' has-tabs' : ''}`}>
      <header className="mm-bar">
        {!tabs && (
          <button type="button" className="mm-icon" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Menu size={26} aria-hidden="true" />
            {total > 0 && <span className="mm-dot" aria-hidden="true" />}
          </button>
        )}
        <img className="mm-logo" src={logo} alt="NeirAPP" />
        {bell && (
          <button type="button" className="mm-icon mm-bell" aria-label={bell.label} disabled={!menuEnabled} onClick={bell.onClick}>
            <SolidIcon name="bell" size={25} />
            {bell.count > 0 && <span className="mm-badge">{bell.count > 99 ? '99+' : bell.count}</span>}
          </button>
        )}
        <ProfileMenu user={user} onLogout={onLogout} compact {...profile} />
      </header>

      {search && menuEnabled && (
        <label className="mm-search">
          <Search size={20} aria-hidden="true" />
          <input type="search" placeholder={search.placeholder} aria-label="Buscar" value={search.value} onChange={(e) => search.onChange(e.target.value)} />
        </label>
      )}

      <main className="mm-main">{children}</main>

      {tabs && (
        <nav className="mm-tabs" aria-label={`Panel de ${profile.roleLabel.toLowerCase()}`}>
          {tabs.map(({ key, label, icon }) => (
            <button key={key} type="button" className={`mm-tab${view === key ? ' active' : ''}`} aria-current={view === key ? 'page' : undefined} disabled={!menuEnabled} onClick={() => onSelect(key)}>
              <span className="mm-ico">
                <SolidIcon name={icon} size={24} />
                {badges[key] > 0 && <span className="mm-item-badge">{badges[key]}</span>}
              </span>
              {label}
            </button>
          ))}
        </nav>
      )}

      {menuOpen && (
        <>
          <div className="mm-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <nav className="mm-drawer" aria-label={`Panel de ${profile.roleLabel.toLowerCase()}`}>
            <div className="mm-drawer-head">
              <img src={logo} alt="NeirAPP" />
              <button type="button" className="mm-icon" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}>
                <X size={24} aria-hidden="true" />
              </button>
            </div>
            <div className="mm-nav">
              {nav.map(({ key, label, icon }) => (
                <button key={key} type="button" className={`mm-item${view === key ? ' active' : ''}`} aria-current={view === key ? 'page' : undefined} disabled={!menuEnabled} onClick={() => go(key)}>
                  <span className="mm-ico">
                    <SolidIcon name={icon} size={24} />
                    {badges[key] > 0 && <span className="mm-item-badge">{badges[key]}</span>}
                  </span>
                  {label}
                </button>
              ))}
            </div>
            <div className="mm-art" aria-hidden="true">
              <img className="mm-slogan" src={slogan} alt="" />
              <img className="mm-footer" src={footer} alt="" />
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
