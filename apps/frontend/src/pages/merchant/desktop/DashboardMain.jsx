import { ChevronRight, Heart, MapPin, MoreVertical, ShoppingCart } from 'lucide-react';
import { Leaf } from '../../../components/common/Leaf.jsx';
import { normalizeStore } from '../../../features/stores/categories.jsx';
import { formatCop } from '../../../lib/money.js';
import { clock, ORDER_STATUS, orderMatches, productsText, recentOrders, shortCode } from './model.js';
import { NoticesCard, PromoCard, TodayCard } from './widgets.jsx';

/** Banner con el nombre, la ubicación y la descripción de la tienda; a la derecha va su foto. */
function Hero({ store, onGo }) {
  const view = normalizeStore(store);
  return (
    <section className="md-hero">
      {store.image_url ? (
        <img className="md-hero-img" src={store.image_url} alt={`Foto de ${store.name}`} />
      ) : (
        <div className="md-hero-art" aria-hidden="true">
          <Leaf fill="#2d7a3d" style={{ right: 120, top: -20, width: 90, transform: 'rotate(28deg)' }} />
          <Leaf fill="#e8a92c" style={{ right: 40, bottom: -30, width: 80, transform: 'rotate(-150deg)' }} />
          <Leaf fill="#5a9a4a" style={{ right: 210, bottom: -40, width: 70, transform: 'rotate(160deg)' }} />
        </div>
      )}
      <div className="md-hero-body">
        <span className="md-hero-logo" style={{ background: view.color }}>
          <view.Icon size={46} color="#fff" aria-hidden="true" />
        </span>
        <div>
          <h1>{store.name}</h1>
          <p className="md-hero-place">
            <MapPin size={18} fill="currentColor" aria-hidden="true" /> Neira, Caldas
          </p>
          {store.description ? (
            <p className="md-hero-tag">
              {store.description} <Heart size={16} fill="#e8531c" color="#e8531c" aria-hidden="true" />
            </p>
          ) : (
            <button type="button" className="md-more md-hero-cta" onClick={() => onGo('store')}>
              Agrega una descripción y una foto en “Mi tienda” <ChevronRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function RecentOrders({ orders, query, onGo }) {
  const list = recentOrders(orders).filter((o) => orderMatches(o, query)).slice(0, 4);
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Pedidos recientes</h2>
        <button type="button" className="md-more" onClick={() => onGo('orders')}>
          Ver todos <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      {!orders ? (
        <p className="md-empty">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="md-empty">{query ? 'Ningún pedido coincide con tu búsqueda.' : 'Todavía no tienes pedidos. Te avisamos apenas llegue uno.'}</p>
      ) : (
        <ul className="md-orders">
          {list.map((o) => {
            const status = ORDER_STATUS[o.status] ?? { label: o.status, tone: 'prep' };
            return (
              <li key={o.id}>
                <button type="button" onClick={() => onGo(o.status === 'handed_over' || o.status === 'rejected' ? 'history' : 'orders')}>
                  <span className="md-bubble green sm">
                    <ShoppingCart size={20} aria-hidden="true" />
                  </span>
                  <span className="md-order-main">
                    <strong>#{shortCode(o.order_id)}</strong>
                    <span>
                      {formatCop(o.subtotal_cop)} <i>·</i> {productsText(o)}
                    </span>
                  </span>
                  <span className={`md-pill ${status.tone}`}>{status.label}</span>
                  <time dateTime={o.created_at}>{clock(o.created_at)}</time>
                  <ChevronRight size={18} aria-hidden="true" className="md-chev" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProductsPreview({ products, query, onGo }) {
  const q = query.trim().toLowerCase();
  const list = (products ?? []).filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 4);
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Mis productos</h2>
        <button type="button" className="md-more" onClick={() => onGo('products')}>
          Ver todos <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      {!products ? (
        <p className="md-empty">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="md-empty">{q ? 'Ningún producto coincide con tu búsqueda.' : 'Aún no tienes productos. Agrega el primero desde “Mis productos”.'}</p>
      ) : (
        <ul className="md-products">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onGo('products')} aria-label={`Ver ${p.name}`}>
                <span className="md-product-img">
                  {p.image_url ? <img src={p.image_url} alt="" loading="lazy" /> : <span>Sin foto</span>}
                  <span className="md-dots" aria-hidden="true">
                    <MoreVertical size={16} />
                  </span>
                </span>
                <strong>{p.name}</strong>
                <span className="md-price">{formatCop(p.price_cop)}</span>
                <small className={p.is_available ? 'on' : 'off'}>
                  <i aria-hidden="true" /> {p.is_available ? 'Disponible' : 'Agotado'}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Contenido central del Resumen en escritorio. */
export default function DashboardMain({ store, orders, products, query, onGo }) {
  return (
    <>
      <Hero store={store} onGo={onGo} />
      <RecentOrders orders={orders} query={query} onGo={onGo} />
      <ProductsPreview products={products} query={query} onGo={onGo} />
    </>
  );
}

/** El mismo Resumen para celular y tableta: todo en una columna, con el resumen de hoy y los avisos entre las listas. */
export function DashboardStack({ store, orders, products, reviews, rating, query, onGo }) {
  return (
    <>
      <Hero store={store} onGo={onGo} />
      <TodayCard orders={orders} rating={rating} />
      <RecentOrders orders={orders} query={query} onGo={onGo} />
      <ProductsPreview products={products} query={query} onGo={onGo} />
      <NoticesCard orders={orders} reviews={reviews} onGo={onGo} />
      <PromoCard onGo={onGo} inline />
    </>
  );
}
