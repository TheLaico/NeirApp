import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useFavorites } from '../../features/favorites/FavoritesContext.jsx';
import { useSettings } from '../../features/settings/SettingsContext.jsx';
import { updateProfile } from '../../services/auth.js';
import './settings-page.css';

const PREFERENCES = [
  { key: 'orderNotifications', title: 'Avisos de mis pedidos', text: 'Recibe una notificación cuando cambie el estado de un pedido.' },
  { key: 'offersNotifications', title: 'Ofertas y novedades', text: 'Entérate de promociones de las tiendas de Neira.' },
  { key: 'mapHint', title: 'Sugerencia del mapa', text: 'Muestra el aviso "Explora las tiendas" al entrar al inicio.' },
  { key: 'mapNightAuto', title: 'Mapa nocturno automático', text: 'De noche, el mapa se ve oscuro con las calles iluminadas. Apagado, siempre se ve de día.' },
];

function Switch({ checked, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch-btn" onClick={() => onChange(!checked)}>
      <span />
    </button>
  );
}

function ProfileForm({ user, onUserChange }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const dirty = name !== user.name || phone !== (user.phone ?? '');

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (name.trim().length < 3) next.name = 'Ingresa tu nombre completo.';
    if (phone.replace(/\D/g, '').length < 7) next.phone = 'Ingresa un número de celular válido.';
    setErrors(next);
    setSaved(false);
    if (Object.keys(next).length) return;
    onUserChange(await updateProfile(user.id, { name, phone }));
    setSaved(true);
  };

  return (
    <form className="page-card" onSubmit={submit} noValidate>
      <div className="profile-head">
        <span className="profile-avatar">
          <UserRound size={30} aria-hidden="true" />
        </span>
        <div>
          <h2>Mi perfil</h2>
          <p>Estos datos se usan para tus pedidos y entregas.</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="s-name">Nombre completo</label>
          <input id="s-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} aria-invalid={errors.name ? 'true' : undefined} />
          {errors.name && <small className="err">{errors.name}</small>}
        </div>
        <div className="form-field">
          <label htmlFor="s-phone">Número de celular</label>
          <input id="s-phone" type="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} aria-invalid={errors.phone ? 'true' : undefined} />
          {errors.phone && <small className="err">{errors.phone}</small>}
        </div>
        <div className="form-field">
          <label htmlFor="s-email">Correo electrónico</label>
          <input id="s-email" value={user.email} disabled />
          <small>El correo no se puede cambiar.</small>
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn-solid" disabled={!dirty}>
          Guardar cambios
        </button>
        {saved && (
          <span className="saved" role="status">
            ✓ Cambios guardados
          </span>
        )}
      </div>
    </form>
  );
}

/** Página "Configuración". */
export default function SettingsPage({ user, onLogout, onUserChange }) {
  const { prefs, set } = useSettings();
  const { totalItems, clear: clearCart } = useCart();
  const { count: favCount, clear: clearFavorites } = useFavorites();

  return (
    <PageShell user={user} onLogout={onLogout} title="Configuración" subtitle="Administra tu cuenta y tus preferencias.">
      <div className="page-narrow">
        <ProfileForm user={user} onUserChange={onUserChange} />

        <section className="page-card" aria-label="Preferencias">
          <h2>Preferencias</h2>
          <ul className="pref-list">
            {PREFERENCES.map(({ key, title, text }) => (
              <li key={key}>
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
                <Switch checked={prefs[key]} onChange={(v) => set(key, v)} label={title} />
              </li>
            ))}
          </ul>
        </section>

        <section className="page-card" aria-label="Mis datos">
          <h2>Mis datos</h2>
          <p>Se guardan en este dispositivo.</p>
          <div className="data-actions">
            <button type="button" className="btn-ghost btn-danger" disabled={totalItems === 0} onClick={clearCart}>
              Vaciar carrito ({totalItems})
            </button>
            <button type="button" className="btn-ghost btn-danger" disabled={favCount === 0} onClick={clearFavorites}>
              Borrar favoritos ({favCount})
            </button>
          </div>
        </section>

        <section className="page-card" aria-label="Sesión">
          <h2>Sesión</h2>
          <p>Sesión iniciada como {user.email}.</p>
          <div className="data-actions">
            <button type="button" className="btn-solid" onClick={onLogout}>
              <LogOut size={17} aria-hidden="true" />
              Cerrar sesión
            </button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
