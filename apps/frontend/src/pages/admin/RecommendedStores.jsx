import { ArrowDown, ArrowUp, Plus, Star, X } from 'lucide-react';
import { useState } from 'react';
import { storesApi } from '../../features/stores/api.js';

/**
 * Tiendas recomendadas: son las que ven los clientes primero en "Tiendas recomendadas".
 * El administrador elige cuáles y en qué posición; cada cambio se guarda al momento.
 */
export default function RecommendedStores({ stores, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toAdd, setToAdd] = useState('');

  const recommended = stores.filter((s) => s.recommended_position != null).sort((a, b) => a.recommended_position - b.recommended_position);
  const others = stores.filter((s) => s.recommended_position == null);

  const save = async (ids) => {
    setError('');
    setBusy(true);
    try {
      await storesApi.setRecommended(ids);
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const ids = recommended.map((s) => s.id);
  const move = (index, delta) => {
    const next = [...ids];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    save(next);
  };
  const remove = (id) => save(ids.filter((x) => x !== id));
  const add = async (e) => {
    e.preventDefault();
    if (!toAdd) return;
    await save([...ids, toAdd]);
    setToAdd('');
  };

  return (
    <section className="a-card">
      <h2>
        <Star size={18} aria-hidden="true" /> Tiendas recomendadas
      </h2>
      <p className="a-empty">Son las que ven primero los clientes en la lista de tiendas. Tú decides cuáles son y en qué posición aparecen. Si no eliges ninguna, se muestran todas.</p>

      {error && (
        <p className="a-err" role="alert">
          {error}
        </p>
      )}

      {recommended.length === 0 ? (
        <p className="a-empty">Todavía no hay tiendas recomendadas.</p>
      ) : (
        <ol className="a-store-list">
          {recommended.map((store, i) => (
            <li key={store.id} className="a-store-row a-grant">
              <span className="a-badge server">{i + 1}</span>
              <div className="a-store-info">
                <strong>{store.name}</strong>
                <span>
                  {store.label}
                  {store.rating != null && ` · ${store.rating} ★ (${store.reviews})`}
                </span>
              </div>
              <button type="button" className="a-icon-btn" aria-label={`Subir ${store.name}`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <button type="button" className="a-icon-btn" aria-label={`Bajar ${store.name}`} disabled={busy || i === recommended.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={18} aria-hidden="true" />
              </button>
              <button type="button" className="a-icon-btn" aria-label={`Quitar ${store.name} de las recomendadas`} disabled={busy} onClick={() => remove(store.id)}>
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {others.length > 0 && (
        <form className="a-form-actions" onSubmit={add}>
          <div className="a-field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="rec-add">Agregar una tienda</label>
            <select id="rec-add" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
              <option value="">Elige una tienda…</option>
              {others.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="a-btn primary" disabled={busy || !toAdd} style={{ alignSelf: 'flex-end' }}>
            <Plus size={18} aria-hidden="true" />
            Agregar al final
          </button>
        </form>
      )}
    </section>
  );
}
