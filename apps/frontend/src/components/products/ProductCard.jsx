import { Heart, Plus } from 'lucide-react';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useFavorites } from '../../features/favorites/FavoritesContext.jsx';
import { formatCop } from '../../lib/money.js';
import QuantityStepper from './QuantityStepper.jsx';

/** Tarjeta cuadrada de producto: abre el detalle, permite agregar al carrito y marcar favorito. */
export default function ProductCard({ product, store, selected = false, onOpen }) {
  const { Icon } = store;
  const { quantityOf, add, setQuantity } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const soldOut = product.is_available === false;
  const quantity = quantityOf(store.id, product.id);
  const favorite = isFavorite(product.id);

  return (
    <article
      className={`product${soldOut ? ' sold-out' : ''}${selected ? ' selected' : ''}`}
      title={product.description || product.name}
    >
      <button type="button" className="product-open" aria-label={`Ver ${product.name}`} onClick={() => onOpen(product)} />

      <div className="product-art" style={{ '--tint': store.color }}>
        {product.image_url ? (
          <img src={product.image_url} alt="" loading="lazy" />
        ) : (
          <Icon size={40} color="#fff" aria-hidden="true" />
        )}

        <button
          type="button"
          className={`card-fav${favorite ? ' on' : ''}`}
          aria-pressed={favorite}
          aria-label={favorite ? `Quitar ${product.name} de favoritos` : `Agregar ${product.name} a favoritos`}
          onClick={() => toggle(store, product)}
        >
          <Heart size={17} aria-hidden="true" fill={favorite ? 'currentColor' : 'none'} />
        </button>

        {soldOut && <span className="product-badge">Agotado</span>}
        {!soldOut && (
          <div className="product-add">
            {quantity === 0 ? (
              <button
                type="button"
                className="add-btn"
                aria-label={`Agregar ${product.name} al carrito`}
                onClick={() => add(store, product)}
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            ) : (
              <QuantityStepper
                quantity={quantity}
                label={product.name}
                onChange={(next) => setQuantity(store.id, product.id, next)}
              />
            )}
          </div>
        )}
      </div>

      <div className="product-info">
        <strong>{product.name}</strong>
        <span className="product-price">{formatCop(product.price_cop)}</span>
      </div>
    </article>
  );
}
