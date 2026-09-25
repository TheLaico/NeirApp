import { LocateFixed, MapPin, PackageOpen, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { useOrders } from '../../features/orders/OrdersContext.jsx';
import { PROVIDERS } from '../../features/payments/providers.js';
import { formatCop } from '../../lib/money.js';
import { mapLink } from '../../lib/geo.js';
import { useNavigate } from '../../lib/router.jsx';
import './orders-page.css';

const TABS = [
  { id: 'active', label: 'En curso', empty: 'No tienes pedidos en curso.' },
  { id: 'history', label: 'Historial', empty: 'Todavía no tienes pedidos anteriores.' },
];

const STATUS = {
  confirmed: { label: 'Confirmado', tone: 'ok' },
  awaiting_payment: { label: 'Esperando pago', tone: 'wait' },
  payment_failed: { label: 'Pago no completado', tone: 'bad' },
};

const paymentText = (p) => {
  const name = PROVIDERS[p.provider]?.label ?? p.provider;
  if (p.status === 'approved') return `Pagado con ${name}`;
  if (p.status === 'cash_on_delivery') return 'Pago en efectivo al recibir';
  if (p.status === 'pending') return `Pago pendiente (${name})`;
  return `Pago no aprobado (${name})`;
};

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function OrderCard({ order }) {
  const status = STATUS[order.status] ?? STATUS.awaiting_payment;
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const stores = [...new Set(order.items.map((i) => i.storeName))];
  return (
    <li className="order-card">
      <header>
        <div>
          <strong>{order.id}</strong>
          <time dateTime={order.createdAt}>{dateFormat.format(new Date(order.createdAt))}</time>
        </div>
        <span className={`order-status ${status.tone}`}>{status.label}</span>
      </header>

      <ul className="order-items">
        {order.items.slice(0, 3).map((i) => (
          <li key={`${i.storeId}-${i.productId}`}>
            <span>
              {i.quantity} × {i.name}
            </span>
            <span>{formatCop(i.priceCop * i.quantity)}</span>
          </li>
        ))}
        {order.items.length > 3 && <li className="more">y {order.items.length - 3} producto(s) más…</li>}
      </ul>

      <footer>
        <div className="order-meta">
          <span>
            {units} {units === 1 ? 'producto' : 'productos'} · {stores.join(', ')}
          </span>
          <span>{paymentText(order.payment)}</span>
          <span>
            <MapPin size={13} aria-hidden="true" /> {order.delivery.address}
          </span>
          {order.delivery.location && (
            <span>
              <LocateFixed size={13} aria-hidden="true" /> Ubicación compartida ·{' '}
              <a href={mapLink(order.delivery.location)} target="_blank" rel="noreferrer">
                ver en el mapa
              </a>
            </span>
          )}
        </div>
        <strong className="order-total">{formatCop(order.totalCop)}</strong>
      </footer>
    </li>
  );
}

/** Página "Mis pedidos": pedidos hechos desde el checkout. */
export default function OrdersPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { totalItems, totalCop } = useCart();
  const { orders } = useOrders();
  const [tab, setTab] = useState('active');
  const current = TABS.find((t) => t.id === tab);

  const shown = orders.filter((o) => (tab === 'active' ? o.status !== 'payment_failed' : o.status === 'payment_failed'));

  return (
    <PageShell user={user} onLogout={onLogout} title="Mis pedidos" subtitle="Sigue tus pedidos y revisa tu historial de compras.">
      <div className="page-narrow">
        {totalItems > 0 && (
          <section className="page-card cart-summary" aria-label="Carrito actual">
            <ShoppingBag size={26} aria-hidden="true" />
            <div>
              <strong>
                Tienes {totalItems} {totalItems === 1 ? 'producto' : 'productos'} en tu carrito
              </strong>
              <span>Total: {formatCop(totalCop)}</span>
            </div>
            <button type="button" className="btn-solid" onClick={() => navigate('/checkout')}>
              Ir a pagar
            </button>
          </section>
        )}

        <div className="tabs" role="tablist" aria-label="Estado de los pedidos">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <section className="page-card" role="tabpanel">
            <div className="empty-state">
              <PackageOpen size={46} aria-hidden="true" />
              <p>{current.empty}</p>
              <small>Cuando hagas un pedido, lo verás aquí con su estado.</small>
              <button type="button" className="btn-solid" onClick={() => navigate('/')}>
                Explorar tiendas
              </button>
            </div>
          </section>
        ) : (
          <ul className="order-list" role="tabpanel">
            {shown.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
