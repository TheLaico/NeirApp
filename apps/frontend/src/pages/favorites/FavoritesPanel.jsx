import { Heart } from 'lucide-react';
import ProductCard from '../../components/products/ProductCard.jsx';

/** Lista de productos favoritos. `items`: [{ product, store }] ya filtrados por la página. */
export default function FavoritesPanel({
  items,
  totalSaved,
  loading,
  filtering,
  selectedProductId,
  onOpenProduct,
}) {
  return (
    <section className="panel favorites-panel" aria-label="Mis favoritos">
      <div className="panel-head">
        <h2>Mis favoritos</h2>
        {totalSaved > 0 && <span className="fav-count">{items.length}</span>}
      </div>

      {loading && <p className="panel-empty">Cargando favoritos…</p>}

      {!loading && items.length === 0 && totalSaved === 0 && (
        <div className="fav-empty">
          <Heart size={44} aria-hidden="true" />
          <p>Aún no tienes productos favoritos.</p>
          <small>Toca el corazón de un producto para guardarlo aquí.</small>
        </div>
      )}

      {!loading && items.length === 0 && totalSaved > 0 && filtering && (
        <p className="panel-empty">Ningún favorito coincide con tu búsqueda.</p>
      )}

      <div className="product-grid">
        {items.map(({ product, store }) => (
          <ProductCard
            key={product.id}
            product={product}
            store={store}
            selected={product.id === selectedProductId}
            onOpen={onOpenProduct}
          />
        ))}
      </div>
    </section>
  );
}
