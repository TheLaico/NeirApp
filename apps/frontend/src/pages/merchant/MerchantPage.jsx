import { ShieldCheck, Store } from 'lucide-react';
import { useState } from 'react';
import { canAccessAdmin } from '../../config/roles.js';
import { usePolled } from '../../features/courier/api.js';
import { isNew, useLiveStoreOrders } from '../../features/merchant/api.js';
import { reviewsApi } from '../../features/reviews/api.js';
import { storesApi } from '../../features/stores/api.js';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import { useNavigate } from '../../lib/router.jsx';
import '../admin/admin.css'; // interruptores y botones de icono compartidos con el panel de administrador
import DashboardMain, { DashboardStack } from './desktop/DashboardMain.jsx';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import slogan from '../../assets/slogan-comercio.png';
import { NAV, NoticesCard, PromoCard, TodayCard } from './desktop/widgets.jsx';
import HistoryView from './HistoryView.jsx';
import OrdersView from './OrdersView.jsx';
import ProductsView from './ProductsView.jsx';
import PromoteView from './PromoteView.jsx';
import ReviewsView from './ReviewsView.jsx';
import ScheduleView from './ScheduleView.jsx';
import StoreView from './StoreView.jsx';


const DESKTOP = '(min-width: 1100px)';

/**
 * Panel del comerciante. En celular, una pantalla a la vez con menú de hamburguesa; en escritorio, el panel completo
 * con menú lateral, resumen y notificaciones. Recibe los pedidos de la tienda y los acepta, rechaza o entrega al repartidor.
 */
export default function MerchantPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const [view, setView] = useState('dashboard');
  const [query, setQuery] = useState('');
  const allowed = canAccessAdmin(user) || user.roles?.includes('store_staff');

  const mine = usePolled(storesApi.mine, { enabled: allowed });
  const store = mine.data ?? null;
  const live = useLiveStoreOrders(store?.id);
  const pending = (live.data ?? []).filter(isNew).length;

  // El Resumen (en escritorio y en celular) muestra productos y calificaciones junto a los pedidos.
  const wide = Boolean(store);
  const products = usePolled(() => storesApi.products(store.id), { every: 30000, enabled: wide });
  const reviews = usePolled(() => reviewsApi.list(store.id), { every: 30000, enabled: wide });
  const rating = reviews.data
    ? { count: reviews.data.length, average: reviews.data.length ? reviews.data.reduce((t, r) => t + r.rating, 0) / reviews.data.length : 0 }
    : null;

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de comerciante</h1>
        <p>Pídele a un administrador que autorice tu correo como comerciante.</p>
        <button type="button" className="cr-btn ghost" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  } else if (mine.loading) {
    content = <p className="cr-empty">Cargando…</p>;
  } else if (mine.error && !store) {
    content = (
      <div className="cr-state">
        <p className="cr-error" role="alert">
          {mine.error}
        </p>
        <button type="button" className="cr-btn ghost" onClick={mine.refresh}>
          Reintentar
        </button>
      </div>
    );
  } else if (!store) {
    content = (
      <div className="cr-state">
        <Store size={44} aria-hidden="true" />
        <h1>Todavía no tienes una tienda</h1>
        <p>Un administrador debe crear tu tienda con este correo ({user.email}). Cuando lo haga, aquí verás tus pedidos.</p>
        <button type="button" className="cr-btn ghost" onClick={mine.refresh}>
          Ya la crearon, actualizar
        </button>
      </div>
    );
  } else if (view === 'dashboard') {
    content = null; // el Resumen se arma más abajo, distinto en escritorio y en celular
  } else if (view === 'products') {
    content = <ProductsView store={store} query={query} />;
  } else if (view === 'promote') {
    content = <PromoteView store={store} />;
  } else if (view === 'store') {
    content = <StoreView key={store.id} store={store} onChanged={mine.refresh} />;
  } else if (view === 'schedule') {
    content = <ScheduleView store={store} onStoreChanged={mine.refresh} />;
  } else if (view === 'reviews') {
    content = <ReviewsView store={store} />;
  } else if (view === 'history') {
    content = <HistoryView orders={live.data} />;
  } else {
    content = (
      <OrdersView store={store} orders={live.data} error={live.error} loading={live.loading} query={query} onChanged={live.refresh} onStoreChanged={mine.refresh} />
    );
  }

  const toast = live.notice && (
    <button
      type="button"
      className="cr-toast"
      onClick={() => {
        live.dismiss();
        setView('orders');
      }}
    >
      {live.notice} Toca para verlo.
    </button>
  );

  const center =
    view === 'dashboard' && store ? (
      desktop ? (
        <DashboardMain store={store} orders={live.data} products={products.data} query={query} onGo={setView} />
      ) : (
        <DashboardStack store={store} orders={live.data} products={products.data} reviews={reviews.data} rating={rating} query={query} onGo={setView} />
      )
    ) : (
      <div className="md-page">{content}</div>
    );

  const shell = {
    user,
    profile: { name: store?.name ?? user.name, image: store?.image_url, Icon: Store, roleLabel: 'Comerciante' },
    nav: NAV,
    badges: { orders: pending },
    view,
    onSelect: setView,
    bell: { count: pending, label: `Notificaciones${pending ? `, ${pending} pedidos nuevos` : ''}`, onClick: () => setView('orders') },
    search: { placeholder: 'Buscar pedidos o productos…', value: query, onChange: setQuery },
    slogan,
    menuEnabled: Boolean(store),
    onLogout,
  };

  if (desktop) {
    return (
      <PanelDesktop
        {...shell}
        right={
          <>
            <TodayCard orders={live.data} rating={rating} />
            <NoticesCard orders={live.data} reviews={reviews.data} onGo={setView} />
          </>
        }
        promo={<PromoCard onGo={setView} />}
      >
        {toast}
        {center}
      </PanelDesktop>
    );
  }

  return (
    <PanelMobile {...shell}>
      {toast}
      {center}
    </PanelMobile>
  );
}
