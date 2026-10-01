import { Crosshair, Loader2, LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { NEIRA_CENTER } from '../../features/map/constants.js';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import { storesApi } from '../../features/stores/api.js';
import { getCurrentPosition, isInsideDeliveryArea } from '../../lib/geo.js';

/**
 * Administración de una tienda existente: si aparece en el mapa, quién es su dueño (por correo) y dónde queda.
 * Cada bloque se guarda por separado.
 */
export default function StoreAdminEditor({ store, onChanged }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [email, setEmail] = useState(store.owner_email);
  const [location, setLocation] = useState({ lat: store.lat, lng: store.lng });
  const [locating, setLocating] = useState(false);

  const save = async (key, body, message) => {
    setError('');
    setSaved('');
    setBusy(key);
    try {
      await storesApi.adminUpdate(store.id, body);
      setSaved(message);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const pick = (lat, lng) => {
    if (!isInsideDeliveryArea({ lat, lng })) {
      setError('Ese punto está fuera de Neira. Elige un lugar dentro del pueblo.');
      return;
    }
    setError('');
    setLocation({ lat, lng });
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      pick(lat, lng);
    } catch (err) {
      setError(err.message);
    } finally {
      setLocating(false);
    }
  };

  const emailChanged = email.trim().toLowerCase() !== store.owner_email.toLowerCase();
  const moved = location.lat !== store.lat || location.lng !== store.lng;

  return (
    <div className="a-editor">
      <div className="a-editor-block">
        <div>
          <strong>Aparece en el mapa</strong>
          <small>{store.is_listed ? 'Los clientes la ven en el mapa, la búsqueda y su página.' : 'Oculta: los clientes no la ven ni pueden pedirle.'}</small>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={store.is_listed}
          aria-label={`${store.name}: ${store.is_listed ? 'visible en el mapa' : 'oculta'}`}
          className={`a-switch${store.is_listed ? ' on' : ''}`}
          disabled={busy === 'listed'}
          onClick={() => save('listed', { is_listed: !store.is_listed }, store.is_listed ? 'La tienda quedó oculta.' : 'La tienda ya aparece en el mapa.')}
        >
          <span />
        </button>
      </div>

      <form
        className="a-editor-block col"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Escribe un correo válido.');
          save('owner', { owner_email: email.trim() }, 'El dueño de la tienda cambió.');
        }}
      >
        <div className="a-field">
          <label htmlFor={`owner-${store.id}`}>Correo del dueño</label>
          <input id={`owner-${store.id}`} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <small>El nuevo dueño debe tener cuenta y el rol de comerciante, y no tener otra tienda.</small>
        </div>
        <div className="a-form-actions">
          <button type="submit" className="a-btn primary" disabled={busy === 'owner' || !emailChanged}>
            {busy === 'owner' && <Loader2 size={16} className="a-spin" aria-hidden="true" />}
            Cambiar dueño
          </button>
        </div>
      </form>

      <div className="a-editor-block col">
        <span className="a-label">Posición en el mapa</span>
        <div className="a-map">
          <NeiraMap stores={[]} showBuildings={false} bearing={0} onPick={pick} pin={location} />
        </div>
        <div className="a-map-actions">
          <button type="button" className="a-btn ghost" onClick={useMyLocation} disabled={locating}>
            {locating ? <Loader2 className="a-spin" size={16} aria-hidden="true" /> : <LocateFixed size={16} aria-hidden="true" />}
            Usar mi ubicación
          </button>
          <button type="button" className="a-btn ghost" onClick={() => pick(NEIRA_CENTER[1], NEIRA_CENTER[0])}>
            <Crosshair size={16} aria-hidden="true" />
            Centro de Neira
          </button>
          <span className="a-coords">
            Lat {location.lat} · Lng {location.lng}
          </span>
        </div>
        <div className="a-form-actions">
          <button type="button" className="a-btn primary" disabled={busy === 'position' || !moved} onClick={() => save('position', location, 'La posición de la tienda cambió.')}>
            {busy === 'position' && <Loader2 size={16} className="a-spin" aria-hidden="true" />}
            Guardar posición
          </button>
        </div>
      </div>

      {error && (
        <p className="a-err" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="a-success" role="status">
          {saved}
        </p>
      )}
    </div>
  );
}
