import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from '../../lib/router.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { formatCop } from '../../lib/money.js';
import QuantityStepper from '../products/QuantityStepper.jsx';

export default function CartDrawer({ open, onClose }) {
  const { groups, totalItems, totalCop, setQuantity, remove, clear } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-root">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Tu carrito">
        <header className="drawer-head">
          <h2>
            Tu carrito
            {totalItems > 0 && <span className="drawer-count">{totalItems}</span>}
          </h2>
          <button type="button" className="drawer-close" aria-label="Cerrar carrito" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {groups.length === 0 ? (
          <div className="drawer-empty">
            <ShoppingBag size={44} aria-hidden="true" />
            <p>Aún no has agregado productos.</p>
            <button type="button" className="drawer-link" onClick={onClose}>
              Explorar tiendas
            </button>
          </div>
        ) : (
          <>
            <div className="drawer-body">
              {groups.map((group) => (
                <section key={group.storeId} className="cart-group">
                  <h3>{group.storeName}</h3>
                  <ul>
                    {group.lines.map(({ product, quantity }) => (
                      <li key={product.id} className="cart-line">
                        <span className="cart-line-photo">
                          {product.image_url ? <img src={product.image_url} alt="" loading="lazy" /> : <ShoppingBag size={22} aria-hidden="true" />}
                        </span>
                        <div className="cart-line-info">
                          <strong>{product.name}</strong>
                          <span>{formatCop(product.price_cop)} c/u</span>
                        </div>
                        <QuantityStepper
                          quantity={quantity}
                          label={product.name}
                          onChange={(next) => setQuantity(group.storeId, product.id, next)}
                        />
                        <span className="cart-line-total">{formatCop(product.price_cop * quantity)}</span>
                        <button
                          type="button"
                          className="cart-remove"
                          aria-label={`Quitar ${product.name}`}
                          onClick={() => remove(group.storeId, product.id)}
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <footer className="drawer-foot">
              <div className="cart-total">
                <span>Total</span>
                <strong>{formatCop(totalCop)}</strong>
              </div>
              <button
                type="button"
                className="drawer-checkout"
                onClick={() => {
                  onClose();
                  navigate('/checkout');
                }}
              >
                Continuar al pago
              </button>
              <button type="button" className="drawer-clear" onClick={clear}>
                Vaciar carrito
              </button>
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
