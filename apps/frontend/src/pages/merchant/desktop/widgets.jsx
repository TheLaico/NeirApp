import promo from '../../../assets/tienda-promo.png';
import { NoticesCard as NoticesBase, StatsCard } from '../../../components/panel/cards.jsx';
import { formatCop } from '../../../lib/money.js';
import { buildNotifications, longDate, todayStats } from './model.js';
import '../../../components/layout/app-shell.css';
import '../../../components/panel/panel-desktop.css';

// Piezas del panel del comerciante que comparten el diseño de escritorio y el de celular/tableta.

export const NAV = [
  { key: 'dashboard', label: 'Resumen', icon: 'home' },
  { key: 'orders', label: 'Pedidos', icon: 'bag' },
  { key: 'products', label: 'Mis productos', icon: 'box' },
  { key: 'promote', label: 'Destacar productos', icon: 'award' },
  { key: 'store', label: 'Mi tienda', icon: 'shop' },
  { key: 'schedule', label: 'Horarios', icon: 'calendar' },
  { key: 'reviews', label: 'Calificaciones', icon: 'star' },
  { key: 'history', label: 'Historial', icon: 'clock' },
];

/** "Resumen de hoy": pedidos recibidos, ventas del día y calificación promedio. */
export function TodayCard({ orders, rating }) {
  const { received, sales, average } = todayStats(orders, rating);
  return (
    <StatsCard
      date={longDate()}
      items={[
        { icon: 'order', value: received, label: 'Pedidos recibidos' },
        { icon: 'money', tone: 'gold', value: formatCop(sales), label: 'Ventas del día' },
        { icon: 'star', value: average === null ? '—' : average.toFixed(1), label: 'Calificación promedio' },
      ]}
    />
  );
}

/** Avisos armados con lo que pasó: pedidos nuevos, entregas y calificaciones. */
export function NoticesCard({ orders, reviews, onGo }) {
  return (
    <NoticesBase
      notices={buildNotifications(orders, reviews)}
      onOpen={(n) => onGo(n.kind === 'review' ? 'reviews' : 'orders')}
      onSeeAll={() => onGo('orders')}
      empty="Aquí verás los pedidos nuevos y las calificaciones que lleguen."
    />
  );
}

/**
 * Tarjeta "Tu tienda también en NeirApp": la imagen trae el texto y el botón, y toda ella lleva a Mi tienda para personalizarla.
 * En escritorio va fija en la esquina inferior derecha; con `inline` (celular) es una tarjeta más del contenido.
 */
export function PromoCard({ onGo, inline = false }) {
  return (
    <button type="button" className={`md-promo${inline ? ' inline' : ''}`} onClick={() => onGo('store')} aria-label="Tu tienda también en NeirApp. ¡Haz crecer tu negocio! Personalizar mi tienda">
      <img src={promo} alt="" />
    </button>
  );
}
