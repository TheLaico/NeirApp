import { KeyRound, MapPin, PackageOpen, ShoppingBag, Star } from 'lucide-react';
import { useState } from 'react';
import PageShell from '../../components/layout/PageShell.jsx';
import { useCart } from '../../features/cart/CartContext.jsx';
import { usePolled } from '../../features/courier/api.js';
import { ordersApi, shortId } from '../../features/orders/api.js';
import { reviewsApi } from '../../features/reviews/api.js';
import { formatCop } from '../../lib/money.js';
import { mapLink } from '../../lib/geo.js';
import { useNavigate } from '../../lib/router.jsx';
import './orders-page.css';

const TABS = [
  { id: 'active', label: 'En curso', empty: 'No tienes pedidos en curso.' },
  { id: 'history', label: 'Historial', empty: 'Todavía no tienes pedidos anteriores.' },
];

// Estado de cada tienda dentro del pedido, dicho para el cliente.
const STORE_STATUS = {
  paid: { label: 'Esperando a que la tienda lo acepte', tone: 'wait' },
  accepted: { label: 'La tienda aceptó tu pedido', tone: 'ok' },
  preparing: { label: 'Lo están preparando', tone: 'ok' },
  ready: { label: 'Listo para que lo recoja el repartidor', tone: 'ok' },
  handed_over: { label: 'Ya lo tiene el repartidor', tone: 'ok' },
  rejected: { label: 'La tienda no pudo aceptarlo', tone: 'bad' },
};

const dateFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// Con estos estados ya puede haber un repartidor asignado, así que vale la pena pedir su código.
const MAY_HAVE_DELIVERY = ['accepted', 'preparing', 'ready', 'handed_over'];

/** Pedidos del cliente y, para los que ya tienen repartidor, su entrega (con el código que el cliente debe dar). */
async function loadOrders() {
  const orders = (await ordersApi.list()).filter((o) => o.store_orders.some((so) => so.status !== 'pending_payment'));
  const deliveries = {};
  await Promise.all(
    orders
      .filter((o) => o.store_orders.some((so) => MAY_HAVE_DELIVERY.includes(so.status)))
      .map(async (o) => {
        try {
          deliveries[o.id] = await ordersApi.delivery(o.id);
        } catch {
          deliveries[o.id] = null;
        }
      }),
  );

  // Reseñas ya escritas (por pedido de tienda): así no se ofrece calificar dos veces.
  const reviews = {};
  const storeIds = new Set();
  for (const o of orders) {
    if (deliveries[o.id]?.status !== 'delivered') continue;
    for (const so of o.store_orders) if (so.status === 'handed_over') storeIds.add(so.store_id);
  }
  await Promise.all(
    [...storeIds].map(async (storeId) => {
      try {
        for (const r of await reviewsApi.list(storeId)) reviews[r.store_order_id] = r;
      } catch {
        /* sin reseñas: solo no se muestran */
      }
    }),
  );
  return { orders, deliveries, reviews };
}

const isHistory = (order, delivery) =>
  order.store_orders.every((so) => so.status === 'rejected') || delivery?.status === 'delivered' || delivery?.status === 'cancelled';

/** Calificar la tienda de un pedido ya entregado: estrellas y, si quiere, un comentario. */
/** Formulario de estrellas y comentario. `send(rating, comment)` guarda la calificación; sirve para tiendas y repartidores. */
function RatingForm({ title = '¿Cómo te fue con esta tienda?', note, send: save, onDone }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Elige de 1 a 5 estrellas.');
    setError('');
    setBusy(true);
    try {
      await save(rating, comment.trim());
      await onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="order-rate" onSubmit={send} noValidate>
      <strong>{title}</strong>
      {note && <small>{note}</small>}
      <div className="rate-stars" role="radiogroup" aria-label="Calificación">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`} onClick={() => setRating(n)}>
            <Star size={26} fill={n <= rating ? '#F2A81D' : 'none'} color="#F2A81D" aria-hidden="true" />
          </button>
        ))}
      </div>
      <input value={comment} maxLength={500} placeholder="Cuéntanos más (opcional)" aria-label="Comentario" onChange={(e) => setComment(e.target.value)} />
      {error && <small className="err" role="alert">{error}</small>}
      <button type="submit" className="btn-solid" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar calificación'}
      </button>
    </form>
  );
}

function OrderCard({ order, delivery, reviews, onRated }) {
  const created = new Date(order.created_at);
  return (
    <li className="order-card">
      <header>
        <div>
          <strong>Pedido #{shortId(order.id)}</strong>
          <time dateTime={order.created_at}>{dateFormat.format(created)}</time>
        </div>
      </header>

      {delivery?.status === 'assigned' && (
        <div className="order-code" role="status">
          <KeyRound size={18} aria-hidden="true" />
          <div>
            <span>Tu código de entrega</span>
            <strong>{delivery.delivery_code}</strong>
            <small>
              Dáselo al repartidor cuando te llegue el pedido ({delivery.stops_picked_up} de {delivery.stops_total}{' '}
              {delivery.stops_total === 1 ? 'tienda recogida' : 'tiendas recogidas'}).
            </small>
          </div>
        </div>
      )}

      {order.store_orders.map((so) => {
        const delivered = delivery?.status === 'delivered' && so.status === 'handed_over';
        const status = delivered ? { label: 'Entregado', tone: 'ok' } : (STORE_STATUS[so.status] ?? { label: so.status, tone: 'wait' });
        return (
          <div key={so.id} className="order-store">
            <div className="order-store-head">
              <strong>{so.store_name}</strong>
              <span className={`order-status ${status.tone}`}>{status.label}</span>
            </div>
            <ul className="order-items">
              {so.lines.map((l) => (
                <li key={l.product_id}>
                  <span>
                    {l.quantity} × {l.name}
                  </span>
                  <span>{formatCop(l.subtotal_cop)}</span>
                </li>
              ))}
            </ul>
            {so.rejection_reason && <p className="order-reject">Motivo: {so.rejection_reason}</p>}
            {delivered && (reviews[so.id] ? (
              <div className="order-rated">
                <span>Tu calificación: {'★'.repeat(reviews[so.id].rating)}{'☆'.repeat(5 - reviews[so.id].rating)}</span>
                {reviews[so.id].comment && <p>“{reviews[so.id].comment}”</p>}
                {reviews[so.id].merchant_reply && (
                  <p className="order-reply">
                    <strong>Respuesta de {so.store_name}:</strong> {reviews[so.id].merchant_reply}
                  </p>
                )}
              </div>
            ) : (
              <RatingForm send={(rating, comment) => reviewsApi.create(so.id, rating, comment)} onDone={onRated} />
            ))}
          </div>
        );
      })}

      {delivery?.status === 'delivered' && (
        <div className="order-courier">
          {delivery.my_rating ? (
            <div className="order-rated">
              <span>Tu calificación al repartidor: {'★'.repeat(delivery.my_rating.rating)}{'☆'.repeat(5 - delivery.my_rating.rating)}</span>
              {delivery.my_rating.comment && <p>“{delivery.my_rating.comment}”</p>}
              <small>Solo la ve el equipo de NeirAPP.</small>
            </div>
          ) : (
            <RatingForm
              title="¿Cómo fue el servicio del repartidor?"
              note="Tu calificación es privada: solo la ve el equipo de NeirAPP."
              send={(rating, comment) => ordersApi.rateCourier(order.id, rating, comment)}
              onDone={onRated}
            />
          )}
        </div>
      )}

      <footer>
        <div className="order-meta">
          {order.delivery_fee_cop > 0 && <span>Envío incluido: {formatCop(order.delivery_fee_cop)}</span>}
          {order.delivery_notes && (
            <span>
              <MapPin size={13} aria-hidden="true" /> {order.delivery_notes}
            </span>
          )}
          <span>
            <a href={mapLink({ lat: order.delivery_lat, lng: order.delivery_lng })} target="_blank" rel="noreferrer">
              Ver punto de entrega en el mapa
            </a>
          </span>
        </div>
        <strong className="order-total">{formatCop(order.total_cop)}</strong>
      </footer>
    </li>
  );
}

/** Página "Mis pedidos": los pedidos reales del cliente, con el estado que va dando cada tienda. */
export default function OrdersPage({ user, onLogout }) {
  const navigate = useNavigate();
  const { totalItems, totalCop } = useCart();
  const { data, error, loading, refresh } = usePolled(loadOrders, { every: 10000 });
  const [tab, setTab] = useState('active');
  const current = TABS.find((t) => t.id === tab);

  const shown = (data?.orders ?? []).filter((o) => isHistory(o, data.deliveries[o.id]) === (tab === 'history'));

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

        {error && !data && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {loading && <p className="empty-state">Cargando tus pedidos…</p>}

        {data && shown.length === 0 ? (
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
              <OrderCard key={o.id} order={o} delivery={data.deliveries[o.id]} reviews={data.reviews} onRated={refresh} />
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
