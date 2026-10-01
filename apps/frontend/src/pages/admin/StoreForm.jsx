import { Crosshair, Loader2, LocateFixed } from 'lucide-react';
import { useState } from 'react';
import { NEIRA_CENTER } from '../../features/map/constants.js';
import { NeiraMap } from '../../features/map/NeiraMap.jsx';
import { CATEGORY_LABEL } from '../../features/stores/categories.jsx';
import { storesApi } from '../../features/stores/api.js';
import { getCurrentPosition, isInsideDeliveryArea } from '../../lib/geo.js';

/** Formulario "Nueva tienda": datos básicos y ubicación (clic en el mapa, GPS o centro del pueblo). */
export default function StoreForm({ otherStores, onCreated, onCancel }) {
  const [ownerEmail, setOwnerEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null); // { lat, lng }
  const [errors, setErrors] = useState({});
  const [locating, setLocating] = useState(false);

  const pick = (lat, lng) => {
    if (!isInsideDeliveryArea({ lat, lng })) {
      setErrors((e) => ({ ...e, location: 'Ese punto está fuera de Neira. Elige un lugar dentro del pueblo.' }));
      return;
    }
    setLocation({ lat, lng });
    setErrors((e) => ({ ...e, location: undefined }));
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      pick(lat, lng);
    } catch (err) {
      setErrors((e) => ({ ...e, location: err.message }));
    } finally {
      setLocating(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^\S+@\S+\.\S+$/.test(ownerEmail.trim())) next.owner = 'Escribe el correo del comerciante dueño de la tienda.';
    if (name.trim().length < 2) next.name = 'Escribe el nombre de la tienda (mínimo 2 letras).';
    if (!location) next.location = 'Elige la ubicación de la tienda en el mapa.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const store = await storesApi.adminCreate({
        name: name.trim(),
        category,
        description: description.trim(),
        owner_email: ownerEmail.trim(),
        ...location,
      });
      onCreated(store);
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="a-card a-form" onSubmit={submit} noValidate aria-label="Nueva tienda">
      <h2>Nueva tienda</h2>

      <div className="a-grid">
        <div className="a-field">
          <label htmlFor="st-name">Nombre de la tienda</label>
          <input id="st-name" value={name} maxLength={120} placeholder="Ej: Panadería El Trigal" onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? 'true' : undefined} />
          {errors.name && <small className="a-err">{errors.name}</small>}
        </div>
        <div className="a-field">
          <label htmlFor="st-cat">Categoría</label>
          <select id="st-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="a-field">
        <label htmlFor="st-owner">Correo del comerciante (dueño)</label>
        <input id="st-owner" type="email" autoComplete="off" value={ownerEmail} placeholder="comerciante@correo.com" onChange={(e) => setOwnerEmail(e.target.value)} aria-invalid={errors.owner ? 'true' : undefined} />
        {errors.owner ? <small className="a-err">{errors.owner}</small> : <small>Debe tener cuenta y el rol de comerciante (sección Roles).</small>}
      </div>

      <div className="a-field">
        <label htmlFor="st-desc">Descripción</label>
        <textarea id="st-desc" rows={3} maxLength={500} value={description} placeholder="Cuéntale a los clientes qué vende la tienda." onChange={(e) => setDescription(e.target.value)} />
        <small>{description.length}/500</small>
      </div>

      <div className="a-field">
        <span className="a-label">Ubicación</span>
        <div className="a-map">
          <NeiraMap stores={otherStores} showBuildings={false} onPick={pick} pin={location} />
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
          <span className="a-coords">{location ? `Lat ${location.lat} · Lng ${location.lng}` : 'Toca el mapa para colocar la tienda'}</span>
        </div>
        {errors.location && <small className="a-err">{errors.location}</small>}
      </div>

      {errors.form && (
        <p className="a-err" role="alert">
          {errors.form}
        </p>
      )}

      <div className="a-form-actions">
        <button type="submit" className="a-btn primary" disabled={saving}>
          {saving && <Loader2 className="a-spin" size={16} aria-hidden="true" />}
          Crear tienda
        </button>
        <button type="button" className="a-btn ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
