import { CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { useState } from 'react';
import ImagePicker from '../../components/mobile/ImagePicker.jsx';
import { CATEGORY_LABEL } from '../../features/stores/categories.jsx';
import { storesApi } from '../../features/stores/api.js';
import { mapLink } from '../../lib/geo.js';

/** "Mi tienda": foto del local, nombre, categoría y descripción — lo que ven los clientes en el mapa. */
export default function StoreView({ store, onChanged }) {
  const [values, setValues] = useState({
    name: store.name,
    category: store.category,
    description: store.description ?? '',
    image: store.image_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const set = (key) => (e) => {
    setSaved(false);
    setValues((v) => ({ ...v, [key]: e.target.value }));
  };

  const dirty =
    values.name !== store.name ||
    values.category !== store.category ||
    values.description !== (store.description ?? '') ||
    values.image !== (store.image_url ?? '');

  const submit = async (e) => {
    e.preventDefault();
    if (values.name.trim().length < 2) return setError('El nombre de la tienda necesita al menos 2 letras.');
    setError('');
    setSaving(true);
    try {
      await storesApi.update(store.id, {
        name: values.name.trim(),
        category: values.category,
        description: values.description.trim(),
        image_url: values.image, // '' quita la foto
      });
      await onChanged();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <form className="cr-card cr-form" onSubmit={submit} noValidate>
        <h2>Así te ven tus clientes</h2>
        <ImagePicker
          label="Foto del local"
          hint="Una foto de la fachada o del mostrador. Se ve en la página de tu tienda."
          value={values.image}
          onChange={(image) => {
            setSaved(false);
            setValues((v) => ({ ...v, image }));
          }}
        />
        <label>
          Nombre de la tienda
          <input value={values.name} maxLength={120} onChange={set('name')} />
        </label>
        <label>
          Categoría
          <select value={values.category} onChange={set('category')}>
            {Object.entries(CATEGORY_LABEL).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Descripción
          <textarea
            className="cr-textarea"
            rows={4}
            maxLength={500}
            value={values.description}
            placeholder="Cuéntale a los clientes qué vendes, horarios, especialidades…"
            onChange={set('description')}
          />
          <small className="cr-muted">{values.description.length}/500</small>
        </label>
        {error && (
          <p className="cr-error" role="alert">
            {error}
          </p>
        )}
        {saved && !dirty && (
          <p className="cr-ok" role="status">
            <CheckCircle2 size={16} aria-hidden="true" /> Cambios guardados
          </p>
        )}
        <button type="submit" className="cr-btn primary" disabled={saving || !dirty}>
          {saving && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
          Guardar cambios
        </button>
      </form>

      <section className="cr-card">
        <h2>Ubicación</h2>
        <p className="cr-muted">
          Tu tienda aparece en el mapa de Neira en este punto. Si necesitas moverla, pídeselo a un administrador.
        </p>
        <a className="cr-link" href={mapLink({ lat: store.lat, lng: store.lng })} target="_blank" rel="noreferrer">
          <MapPin size={16} aria-hidden="true" />
          Ver ubicación en el mapa
        </a>
      </section>
    </>
  );
}
