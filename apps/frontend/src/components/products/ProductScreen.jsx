import { ArrowLeft, Clock, Heart, ShoppingCart, Store, Truck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MAX_QUANTITY, useCart } from '../../features/cart/CartContext.jsx';
import { useFavorites } from '../../features/favorites/FavoritesContext.jsx';
import { useStoreReviews } from '../../features/reviews/api.js';
import { formatCop } from '../../lib/money.js';
import CompactModal, { isCompactScreen } from './CompactModal.jsx';
import { flyToCart } from '../../lib/flyToCart.js';
import Stars from './Stars.jsx';

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export default function ProductScreen({ product, store, onClose }) {
  const { Icon } = store;
  const compact = isCompactScreen();
  const { quantityOf, add, setQuantity } = useCart();
  const { summary, reviews, status } = useStoreReviews(store.id);
  const { isFavorite, toggle } = useFavorites();
  const favorite = isFavorite(product.id);
  const inCart = quantityOf(store.id, product.id);
  const [quantity, setQty] = useState(1);
  const soldOut = product.is_available === false;
  const closed = store.is_open === false; // con la tienda cerrada no se agrega al carrito

  // Cada producto nuevo arranca con cantidad 1.
  useEffect(() => setQty(1), [product.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addToCart = (e) => {
    flyToCart(e?.currentTarget?.closest('.product-screen')?.querySelector('.ps-art'), product.image_url);
    if (inCart === 0) {
      add(store, product);
      if (quantity > 1) setQuantity(store.id, product.id, quantity);
    } else {
      setQuantity(store.id, product.id, Math.min(MAX_QUANTITY, inCart + quantity));
    }
    setQty(1);
  };

  const screen = (
    <section className={`product-screen${compact ? ' as-modal' : ''}`} aria-label={`Detalle de ${product.name}`}>
      <div className="ps-scroll">
        <div className="ps-art" style={{ '--tint': store.color }}>
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} />
          ) : (
            <Icon size={84} color="#fff" aria-hidden="true" />
          )}
          <button type="button" className="ps-back" aria-label="Cerrar detalle del producto" onClick={onClose}>
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`ps-fav${favorite ? ' on' : ''}`}
            aria-pressed={favorite}
            aria-label={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            title={favorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            onClick={() => toggle(store, product)}
          >
            <Heart size={22} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
          </button>
          {soldOut && <span className="product-badge ps-badge">Agotado</span>}
        </div>

        <div className="ps-body">
          <span className="ps-cat">{store.label}</span>
          <h2>{product.name}</h2>

          <div className="ps-rating">
            {status === 'ok' && summary?.count > 0 ? (
              <>
                <Stars value={summary.average} />
                <strong>{summary.average.toFixed(1)}</strong>
                <span>
                  ({summary.count} {summary.count === 1 ? 'calificación' : 'calificaciones'} de la tienda)
                </span>
              </>
            ) : (
              <span>{status === 'loading' ? 'Cargando calificación…' : 'Aún sin calificaciones'}</span>
            )}
          </div>

          <p className="ps-price">{formatCop(product.price_cop)}</p>

          <h3>Descripción</h3>
          <p className="ps-desc">{product.description || 'Este producto todavía no tiene descripción.'}</p>

          <ul className="ps-facts">
            <li>
              <Store size={18} aria-hidden="true" />
              <span>
                Vendido por <strong>{store.name}</strong>
              </span>
            </li>
            <li>
              <Clock size={18} aria-hidden="true" />
              <span>{store.is_open === false ? 'Tienda cerrada por ahora' : 'Tienda abierta ahora'}</span>
            </li>
            <li>
              <Truck size={18} aria-hidden="true" />
              <span>Entrega a domicilio solo en Neira, Caldas</span>
            </li>
          </ul>

          <h3>Opiniones de la tienda</h3>
          {status === 'ok' && reviews.length === 0 && (
            <p className="ps-empty">Todavía nadie ha calificado esta tienda.</p>
          )}
          {status === 'error' && <p className="ps-empty">No se pudieron cargar las opiniones.</p>}
          <ul className="ps-reviews">
            {reviews.slice(0, 3).map((r) => (
              <li key={r.id}>
                <div>
                  <Stars value={r.rating} size={15} />
                  <time dateTime={r.created_at}>{dateFormat.format(new Date(r.created_at))}</time>
                </div>
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <footer className="ps-foot">
        <div className="stepper" role="group" aria-label="Cantidad">
          <button type="button" aria-label="Quitar uno" disabled={closed || quantity <= 1} onClick={() => setQty(quantity - 1)}>
            −
          </button>
          <span aria-live="polite">{quantity}</span>
          <button
            type="button"
            aria-label="Agregar uno"
            disabled={closed || quantity + inCart >= MAX_QUANTITY}
            onClick={() => setQty(quantity + 1)}
          >
            +
          </button>
        </div>
        <button type="button" className="ps-add" disabled={soldOut || closed} onClick={addToCart}>
          <ShoppingCart size={19} aria-hidden="true" />
          {soldOut ? 'Agotado' : closed ? 'Tienda cerrada por ahora' : `Agregar · ${formatCop(product.price_cop * quantity)}`}
        </button>
        {inCart > 0 && <span className="ps-incart">{inCart} en tu carrito</span>}
      </footer>
    </section>
  );

  return (
    <CompactModal compact={compact} onClose={onClose}>
      {screen}
    </CompactModal>
  );

}
