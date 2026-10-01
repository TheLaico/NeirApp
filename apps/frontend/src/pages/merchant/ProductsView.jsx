import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ImagePicker from '../../components/mobile/ImagePicker.jsx';
import { usePolled } from '../../features/courier/api.js';
import { storesApi } from '../../features/stores/api.js';
import { formatCop } from '../../lib/money.js';

const EMPTY = { name: '', price: '', description: '', image: '' };
const digits = (v) => v.replace(/\D/g, '');

/** Formulario de un producto: sirve para crear uno nuevo y para editar uno existente. */
function ProductForm({ initial = EMPTY, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: key === 'price' ? digits(e.target.value) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const priceCop = Number(values.price);
    if (values.name.trim().length < 2) return setError('Escribe el nombre del producto.');
    if (!priceCop || priceCop > 50_000_000) return setError('Escribe un precio válido en pesos (mayor a 0).');
    setError('');
    setSaving(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        description: values.description.trim(),
        price_cop: priceCop,
        image_url: values.image, // '' quita la foto
      });
      if (!onCancel) setValues(EMPTY);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="cr-form" onSubmit={submit} noValidate>
      <ImagePicker label="Foto del producto" shape="square" value={values.image} onChange={(image) => setValues((v) => ({ ...v, image }))} />
      <label>
        Nombre
        <input value={values.name} maxLength={120} placeholder="Ej: Pan de bono" onChange={set('name')} />
      </label>
      <label>
        Precio (COP)
        <input value={values.price} inputMode="numeric" placeholder="3500" onChange={set('price')} />
      </label>
      <label>
        Descripción (opcional)
        <textarea className="cr-textarea" rows={2} maxLength={500} value={values.description} onChange={set('description')} />
      </label>
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      <div className="cr-actions">
        {onCancel && (
          <button type="button" className="cr-btn ghost sm" disabled={saving} onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="submit" className="cr-btn primary sm" disabled={saving}>
          {saving ? <Loader2 size={18} className="cr-spin" aria-hidden="true" /> : !onCancel && <Plus size={18} aria-hidden="true" />}
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Productos de la tienda: agregar, editar (nombre, precio, descripción, foto), disponible o agotado, y eliminar. */
export default function ProductsView({ store, query = '' }) {
  const { data: products, error: loadError, loading, refresh } = usePolled(() => storesApi.products(store.id));
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const act = async (fn) => {
    setError('');
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <>
      <section className="cr-card">
        <h2>Agregar producto</h2>
        <ProductForm submitLabel="Agregar" onSubmit={(body) => storesApi.addProduct(store.id, body).then(refresh)} />
      </section>

      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="cr-empty">Cargando…</p>}
      {loadError && !products && (
        <p className="cr-error" role="alert">
          {loadError}
        </p>
      )}
      {products?.length === 0 && <p className="cr-empty">Todavía no tienes productos. Agrega el primero arriba.</p>}

      <ul className="cr-list">
        {products?.filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())).map((p) => (
          <li key={p.id} className="cr-card">
            {editing === p.id ? (
              <ProductForm
                initial={{ name: p.name, price: String(p.price_cop), description: p.description ?? '', image: p.image_url ?? '' }}
                submitLabel="Guardar cambios"
                onCancel={() => setEditing(null)}
                onSubmit={async (body) => {
                  await storesApi.updateProduct(store.id, p.id, body);
                  await refresh();
                  setEditing(null);
                }}
              />
            ) : (
              <>
                <div className="cr-product-row">
                  {p.image_url && <img className="cr-thumb" src={p.image_url} alt="" loading="lazy" />}
                  <div>
                    <div className="cr-card-head">
                      <strong>{p.name}</strong>
                      <span>{formatCop(p.price_cop)}</span>
                    </div>
                    {p.description && <p className="cr-muted">{p.description}</p>}
                  </div>
                </div>
                <div className="cr-switch-row">
                  <small>{p.is_available ? 'Disponible' : 'Agotado'}</small>
                  <div className="cr-row">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.is_available}
                      aria-label={`${p.name}: ${p.is_available ? 'disponible' : 'agotado'}`}
                      className={`a-switch${p.is_available ? ' on' : ''}`}
                      onClick={() => act(() => storesApi.setProductAvailable(store.id, p.id, !p.is_available))}
                    >
                      <span />
                    </button>
                    <button type="button" className="a-icon-btn" aria-label={`Editar ${p.name}`} onClick={() => setEditing(p.id)}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="a-icon-btn danger"
                      aria-label={`Eliminar ${p.name}`}
                      onClick={() => window.confirm(`¿Eliminar “${p.name}”?`) && act(() => storesApi.removeProduct(store.id, p.id))}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
