import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { localCatalog, useLocalCatalog } from '../../features/stores/localCatalog.js';
import { formatCop } from '../../lib/money.js';

/** Productos de una tienda local: agregar, marcar disponible o agotado y eliminar. */
export default function ProductManager({ store }) {
  const catalog = useLocalCatalog();
  const products = catalog.products[store.id] ?? [];
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState({});

  const submit = (e) => {
    e.preventDefault();
    const priceCop = Number(price.replace(/\D/g, ''));
    const next = {};
    if (name.trim().length < 2) next.name = 'Escribe el nombre del producto.';
    if (!priceCop || priceCop > 50_000_000) next.price = 'Escribe un precio válido en pesos (mayor a 0).';
    setErrors(next);
    if (Object.keys(next).length) return;
    localCatalog.addProduct(store.id, { name, description, price_cop: priceCop });
    setName('');
    setPrice('');
    setDescription('');
  };

  return (
    <div className="a-products">
      <h3>Productos de {store.name}</h3>

      <form className="a-product-form" onSubmit={submit} noValidate>
        <div className="a-field">
          <label htmlFor={`pn-${store.id}`}>Nombre</label>
          <input id={`pn-${store.id}`} value={name} maxLength={120} placeholder="Ej: Pan de bono" onChange={(e) => setName(e.target.value)} aria-invalid={errors.name ? 'true' : undefined} />
          {errors.name && <small className="a-err">{errors.name}</small>}
        </div>
        <div className="a-field">
          <label htmlFor={`pp-${store.id}`}>Precio (COP)</label>
          <input id={`pp-${store.id}`} inputMode="numeric" value={price} placeholder="3500" onChange={(e) => setPrice(e.target.value.replace(/\D/g, ''))} aria-invalid={errors.price ? 'true' : undefined} />
          {errors.price && <small className="a-err">{errors.price}</small>}
        </div>
        <div className="a-field wide">
          <label htmlFor={`pd-${store.id}`}>Descripción (opcional)</label>
          <input id={`pd-${store.id}`} value={description} maxLength={500} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <button type="submit" className="a-btn primary">
          <Plus size={16} aria-hidden="true" />
          Agregar
        </button>
      </form>

      {products.length === 0 ? (
        <p className="a-empty">Esta tienda todavía no tiene productos.</p>
      ) : (
        <ul className="a-product-list">
          {products.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                <span>{p.description || 'Sin descripción'}</span>
              </div>
              <span className="a-price">{formatCop(p.price_cop)}</span>
              <button
                type="button"
                role="switch"
                aria-checked={p.is_available}
                aria-label={`${p.name}: ${p.is_available ? 'disponible' : 'agotado'}`}
                className={`a-switch${p.is_available ? ' on' : ''}`}
                onClick={() => localCatalog.updateProduct(store.id, p.id, { is_available: !p.is_available })}
              >
                <span />
              </button>
              <small className="a-avail">{p.is_available ? 'Disponible' : 'Agotado'}</small>
              <button type="button" className="a-icon-btn" aria-label={`Eliminar ${p.name}`} onClick={() => localCatalog.removeProduct(store.id, p.id)}>
                <Trash2 size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
