import { Bike, ChevronRight, KeyRound, Loader2, MapPin, ShoppingBag, Store } from 'lucide-react';
import { useState } from 'react';
import fallbackSlogan from '../../assets/slogan.png';
import { Leaf } from '../../components/common/Leaf.jsx';
import { NoticesCard as NoticesBase, StatsCard } from '../../components/panel/cards.jsx';
import { courierApi, vehicleLabel } from '../../features/courier/api.js';
import { longDate } from '../merchant/desktop/model.js';
import { availableMatches, buildNotifications, clock, DELIVERY_STATUS, earningsByDelivery, formatCop, shortCode, STORE_STATUS, todayStats } from './model.js';
import './courier-panel.css';

// Imágenes opcionales del panel del repartidor: si el archivo no está en `assets`, se usa una alternativa.
//   slogan-repartidor.png → eslogan del menú lateral (si falta, el de la app de clientes)
//   repartidor-promo.png  → tarjeta fija abajo a la derecha en escritorio (si falta, no se muestra)
const optional = import.meta.glob('../../assets/{slogan-repartidor,repartidor-promo}.png', { eager: true, import: 'default' });
const asset = (name) => Object.entries(optional).find(([path]) => path.endsWith(`/${name}`))?.[1];
export const SLOGAN = asset('slogan-repartidor.png') ?? fallbackSlogan;
const PROMO = asset('repartidor-promo.png');

export const NAV = [
  { key: 'dashboard', label: 'Resumen', icon: 'home' },
  { key: 'available', label: 'Pedidos', icon: 'bag' },
  { key: 'active', label: 'Entrega activa', icon: 'route' },
  { key: 'wallet', label: 'Billetera', icon: 'wallet' },
  { key: 'history', label: 'Historial', icon: 'clock' },
];

/** Tarjeta fija abajo a la derecha (solo si existe la imagen). */
export function PromoCard({ onGo }) {
  if (!PROMO) return null;
  return (
    <button type="button" className="md-promo" onClick={() => onGo('available')} aria-label="Toma más pedidos">
      <img src={PROMO} alt="" />
    </button>
  );
}

/** "Resumen de hoy": entregas completadas, lo ganado y el saldo de la billetera. */
export function TodayCard({ history, ledger, balance }) {
  const { deliveries, earned, balance: saldo } = todayStats(history, ledger, balance);
  return (
    <StatsCard
      date={longDate()}
      items={[
        { icon: 'order', value: deliveries, label: 'Entregas de hoy' },
        { icon: 'money', tone: 'gold', value: formatCop(earned), label: 'Ganado hoy' },
        { icon: 'wallet', value: formatCop(saldo), label: 'Saldo en billetera' },
      ]}
    />
  );
}

/** Avisos: pedidos por tomar, pagos recibidos, retiros y cancelaciones. */
export function NoticesCard({ available, active, history, ledger, onGo }) {
  return (
    <NoticesBase
      notices={buildNotifications(available, history, ledger, active)}
      onOpen={(n) => onGo(n.id.startsWith('ready') ? 'active' : n.kind === 'order' ? 'available' : n.kind === 'bad' ? 'history' : 'wallet')}
      onSeeAll={() => onGo('wallet')}
      empty="Aquí verás los pedidos por tomar y los pagos que recibas."
    />
  );
}

/** Banner de bienvenida: quién es, con qué vehículo reparte y si ya está verificado. */
function LocationNote({ status }) {
  if (status === 'sharing') return <p className="cr-loc ok">Ubicación compartida con NeirAPP</p>;
  if (status === 'denied') return <p className="cr-loc bad">Activa el permiso de ubicación del navegador para que NeirAPP sepa dónde estás.</p>;
  if (status === 'unsupported') return <p className="cr-loc bad">Este dispositivo no permite compartir la ubicación.</p>;
  return <p className="cr-loc">Buscando tu ubicación…</p>;
}

function Hero({ user, profile, availableCount, locationStatus }) {
  return (
    <section className="md-hero">
      <div className="md-hero-art" aria-hidden="true">
        <Leaf fill="#2d7a3d" style={{ right: 120, top: -20, width: 90, transform: 'rotate(28deg)' }} />
        <Leaf fill="#e8a92c" style={{ right: 40, bottom: -30, width: 80, transform: 'rotate(-150deg)' }} />
        <Leaf fill="#5a9a4a" style={{ right: 210, bottom: -40, width: 70, transform: 'rotate(160deg)' }} />
      </div>
      <div className="md-hero-body">
        <span className="md-hero-logo" style={{ background: '#e8531c' }}>
          <Bike size={46} color="#fff" aria-hidden="true" />
        </span>
        <div>
          <h1>Hola, {user.name.split(' ')[0]}</h1>
          <p className="md-hero-place">
            <MapPin size={18} fill="currentColor" aria-hidden="true" /> Neira, Caldas
          </p>
          <p className="md-hero-tag">
            {vehicleLabel(profile.vehicle_type)}
            {profile.plate ? ` · ${profile.plate}` : ''}
            <span className="md-pill done">Verificado</span>
          </p>
          <LocationNote status={locationStatus} />
          <p className="md-hero-sub">{availableCount === 0 ? 'Por ahora no hay pedidos por tomar.' : availableCount === 1 ? 'Hay 1 pedido esperándote.' : `Hay ${availableCount} pedidos esperándote.`}</p>
        </div>
      </div>
    </section>
  );
}

/** La entrega en curso: sus tiendas con su estado y los botones para seguirla. */
function ActiveCard({ active, onGo }) {
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Entrega activa</h2>
        {active && (
          <button type="button" className="md-more" onClick={() => onGo('active')}>
            Ver entrega <ChevronRight size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      {active ? (
        <>
          <p className="md-sub">
            Pedido #{shortCode(active.order_id)} · {active.stops.filter((s) => s.is_picked_up).length} de {active.stops.length} recogidas
          </p>
          <ul className="md-rows">
            {active.stops.map((stop) => (
              <li key={stop.store_order_id} className="md-row">
                <span className="md-bubble green sm">
                  <Store size={20} aria-hidden="true" />
                </span>
                <span className="md-row-main">
                  <strong>{stop.store_name}</strong>
                  <span>{stop.is_picked_up ? 'Ya la recogiste' : stop.is_ready ? '¡Ya está listo! Ve a recogerlo' : 'La tienda lo está preparando'}</span>
                </span>
                <span className={`md-pill ${stop.is_picked_up || stop.is_ready ? 'done' : 'prep'}`}>{stop.is_picked_up ? 'Recogido' : stop.is_ready ? 'Listo' : 'Preparando'}</span>
              </li>
            ))}
          </ul>
          <div className="cr-actions md-actions">
            <button type="button" className="cr-btn primary sm" onClick={() => onGo('active')}>
              Ver entrega
            </button>
            <button type="button" className="cr-btn ghost sm" disabled={!active.all_stops_picked_up} onClick={() => onGo('code')}>
              <KeyRound size={17} aria-hidden="true" />
              Introducir código
            </button>
          </div>
        </>
      ) : (
        <div className="md-empty-block">
          <p className="md-empty">No tienes una entrega en curso. Toma un pedido para empezar.</p>
          <button type="button" className="cr-btn primary sm" onClick={() => onGo('available')}>
            Ver pedidos disponibles
          </button>
        </div>
      )}
    </section>
  );
}

/** Los primeros pedidos por tomar, con su botón de aceptar. */
function AvailablePreview({ available, active, query, onGo, onClaimed }) {
  const [claiming, setClaiming] = useState(null);
  const [error, setError] = useState('');
  const list = (available ?? []).filter((o) => availableMatches(o, query)).slice(0, 3);

  const claim = async (orderId) => {
    setError('');
    setClaiming(orderId);
    try {
      await courierApi.claim(orderId);
      await onClaimed();
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Pedidos disponibles</h2>
        <button type="button" className="md-more" onClick={() => onGo('available')}>
          Ver todos <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      {error && (
        <p className="cr-error" role="alert">
          {error}
        </p>
      )}
      {active && <p className="md-sub">Termina tu entrega activa para tomar otro pedido.</p>}
      {!available ? (
        <p className="md-empty">Buscando pedidos…</p>
      ) : list.length === 0 ? (
        <p className="md-empty">{query ? 'Ningún pedido coincide con tu búsqueda.' : 'No hay pedidos disponibles por ahora. Se actualiza solo.'}</p>
      ) : (
        <ul className="md-rows">
          {list.map((o) => (
            <li key={o.order_id} className="md-row">
              <span className="md-bubble green sm">
                <ShoppingBag size={20} aria-hidden="true" />
              </span>
              <span className="md-row-main">
                <strong>
                  #{shortCode(o.order_id)} · {o.stops.map((s) => s.store_name).join(', ')}
                </strong>
                <span>
                  {o.stops.map((s) => STORE_STATUS[s.status] ?? s.status).join(' · ')}
                  <b className="md-money"> · Ganas {formatCop(o.courier_earnings_cop)}</b>
                </span>
              </span>
              <button type="button" className="cr-btn primary sm" disabled={Boolean(active) || claiming !== null} onClick={() => claim(o.order_id)}>
                {claiming === o.order_id && <Loader2 size={16} className="cr-spin" aria-hidden="true" />}
                Aceptar
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Las últimas entregas, con lo que dejó cada una. */
function RecentDeliveries({ history, ledger, onGo }) {
  const earnings = earningsByDelivery(ledger);
  const list = (history ?? []).slice(0, 4);
  return (
    <section className="md-card">
      <div className="md-card-head">
        <h2>Entregas recientes</h2>
        <button type="button" className="md-more" onClick={() => onGo('history')}>
          Ver todas <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
      {!history ? (
        <p className="md-empty">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="md-empty">Todavía no tienes entregas. Cuando completes una, aparecerá aquí.</p>
      ) : (
        <ul className="md-rows">
          {list.map((d) => {
            const status = DELIVERY_STATUS[d.status] ?? { label: d.status, tone: 'prep' };
            return (
              <li key={d.id} className="md-row">
                <span className="md-bubble green sm">
                  <Bike size={20} aria-hidden="true" />
                </span>
                <span className="md-row-main">
                  <strong>#{shortCode(d.order_id)}</strong>
                  <span>
                    {d.stops.map((s) => s.store_name).join(', ')}
                    {earnings.has(d.id) && <b className="md-money"> · +{formatCop(earnings.get(d.id))}</b>}
                  </span>
                </span>
                <span className="md-row-end">
                  <span className={`md-pill ${status.tone}`}>{status.label}</span>
                  <time dateTime={d.delivered_at ?? d.updated_at}>{clock(d.delivered_at ?? d.updated_at)}</time>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Contenido central del Resumen en escritorio. */
export function DashboardMain({ locationStatus, user, profile, active, available, history, ledger, query, onGo, onClaimed }) {
  return (
    <>
      <Hero user={user} profile={profile} availableCount={(available ?? []).length} locationStatus={locationStatus} />
      <ActiveCard active={active} onGo={onGo} />
      <AvailablePreview available={available} active={active} query={query} onGo={onGo} onClaimed={onClaimed} />
      <RecentDeliveries history={history} ledger={ledger} onGo={onGo} />
    </>
  );
}

/** El mismo Resumen para celular y tableta: una columna, con el resumen de hoy y los avisos entre las listas. */
export function DashboardStack({ balance, ...props }) {
  return (
    <>
      <Hero user={props.user} profile={props.profile} availableCount={(props.available ?? []).length} locationStatus={props.locationStatus} />
      <TodayCard history={props.history} ledger={props.ledger} balance={balance} />
      <ActiveCard active={props.active} onGo={props.onGo} />
      <AvailablePreview available={props.available} active={props.active} query={props.query} onGo={props.onGo} onClaimed={props.onClaimed} />
      <RecentDeliveries history={props.history} ledger={props.ledger} onGo={props.onGo} />
      <NoticesCard available={props.available} active={props.active} history={props.history} ledger={props.ledger} onGo={props.onGo} />
    </>
  );
}
