import { Bike, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { courierApi, usePolled, walletApi } from '../../features/courier/api.js';
import { useShareLocation } from '../../features/courier/location.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import ActiveView from './ActiveView.jsx';
import AvailableView from './AvailableView.jsx';
import HistoryView from './HistoryView.jsx';
import OnboardingView from './OnboardingView.jsx';
import WalletView from './WalletView.jsx';
import { DashboardMain, DashboardStack, NAV, NoticesCard, PromoCard, SLOGAN, TodayCard } from './widgets.jsx';

const DESKTOP = '(min-width: 1100px)';

/**
 * Panel del repartidor. Mismo diseño que el del comerciante: en celular una pantalla a la vez con menú de hamburguesa;
 * en escritorio el panel completo con menú lateral, resumen de hoy y notificaciones.
 */
export default function CourierPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const [view, setView] = useState('dashboard');
  const [query, setQuery] = useState('');
  const allowed = canAccessAdmin(user) || user.roles?.includes('courier');

  const profile = usePolled(courierApi.profile, { enabled: allowed });
  const verified = profile.data?.is_verified === true;
  // La entrega activa se sondea: la tienda confirma la recogida desde su lado y aquí debe reflejarse.
  const active = usePolled(courierApi.active, { every: 10000, enabled: verified });
  const available = usePolled(courierApi.available, { every: 15000, enabled: verified });
  const history = usePolled(courierApi.history, { every: 30000, enabled: verified });
  const balance = usePolled(walletApi.balance, { every: 30000, enabled: verified });
  const ledger = usePolled(walletApi.ledger, { every: 30000, enabled: verified });

  // Aviso cuando una tienda de la entrega activa marca su pedido como listo (se detecta al sondear).
  const [notice, setNotice] = useState('');
  const seenReady = useRef(null);
  useEffect(() => {
    const stops = active.data?.stops;
    if (!stops) {
      seenReady.current = null;
      return;
    }
    const ready = new Set(stops.filter((s) => s.is_ready && !s.is_picked_up).map((s) => s.store_order_id));
    const previous = seenReady.current;
    seenReady.current = ready;
    if (!previous) return;
    const fresh = stops.find((s) => ready.has(s.store_order_id) && !previous.has(s.store_order_id));
    if (fresh) {
      setNotice(`¡${fresh.store_name} ya tiene el pedido listo!`);
      navigator.vibrate?.([200, 100, 200]);
    }
  }, [active.data]);

  // Con el panel abierto, la posición del repartidor se comparte con NeirAPP (la ve el administrador en su mapa en vivo).
  const locationStatus = useShareLocation(verified);

  const balanceCop = balance.data?.balance_cop ?? balance.data?.balance ?? 0;
  const availableCount = (available.data ?? []).length;

  const refreshMoney = async () => Promise.all([balance.refresh(), ledger.refresh()]);
  const onClaimed = async () => {
    await Promise.all([active.refresh(), available.refresh()]);
    setView('active');
  };
  // Al terminar o cancelar una entrega cambian el historial, los pedidos por tomar y la billetera.
  const onDeliveryChanged = async () => {
    await Promise.all([active.refresh(), available.refresh(), history.refresh(), refreshMoney()]);
  };

  let content = null;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de repartidor</h1>
        <p>Pídele a un administrador que autorice tu correo como repartidor.</p>
        <button type="button" className="cr-btn ghost" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  } else if (profile.loading) {
    content = <p className="cr-empty">Cargando…</p>;
  } else if (profile.error && !profile.data) {
    content = (
      <div className="cr-state">
        <p className="cr-error" role="alert">
          {profile.error}
        </p>
        <button type="button" className="cr-btn ghost" onClick={profile.refresh}>
          Reintentar
        </button>
      </div>
    );
  } else if (!profile.data || !verified) {
    content = <OnboardingView profile={profile.data} onCreated={profile.refresh} />;
  } else if (view === 'available') {
    content = <AvailableView orders={available.data} error={available.error} loading={available.loading} refresh={available.refresh} query={query} active={active.data} onClaimed={onClaimed} onOpenActive={() => setView('active')} />;
  } else if (view === 'wallet') {
    content = <WalletView balance={balanceCop} ledger={ledger.data} onChanged={refreshMoney} />;
  } else if (view === 'history') {
    content = <HistoryView history={history.data} ledger={ledger.data} error={history.error} query={query} />;
  } else if (view === 'active' || view === 'code') {
    content = (
      <ActiveView
        mode={view === 'code' ? 'code' : 'detail'}
        delivery={active.data}
        loading={active.loading}
        onChanged={onDeliveryChanged}
        onGoHome={() => setView('available')}
        onGoCode={() => setView('code')}
      />
    );
  }

  const readyCount = (active.data?.stops ?? []).filter((s) => s.is_ready && !s.is_picked_up).length;
  const toast = notice && (
    <button
      type="button"
      className="cr-toast"
      onClick={() => {
        setNotice('');
        setView('active');
      }}
    >
      {notice} Toca para verla.
    </button>
  );

  const dashboard = { locationStatus, user, profile: profile.data, active: active.data, available: available.data, history: history.data, ledger: ledger.data, query, onGo: setView, onClaimed };
  const center =
    verified && view === 'dashboard' ? (desktop ? <DashboardMain {...dashboard} /> : <DashboardStack {...dashboard} balance={balanceCop} />) : <div className="md-page">{content}</div>;

  const shell = {
    user,
    profile: { name: user.name, Icon: Bike, roleLabel: 'Repartidor' },
    nav: NAV,
    badges: { available: availableCount, active: active.data ? 1 : 0 },
    view: view === 'code' ? 'active' : view,
    onSelect: setView,
    bell: { count: availableCount + readyCount, label: `Notificaciones${readyCount ? `, ${readyCount} pedidos listos para recoger` : ''}`, onClick: () => setView(readyCount ? 'active' : 'available') },
    search: { placeholder: 'Buscar pedidos o tiendas…', value: query, onChange: setQuery },
    slogan: SLOGAN,
    menuEnabled: verified,
    onLogout,
  };

  if (desktop) {
    return (
      <PanelDesktop
        {...shell}
        right={
          <>
            <TodayCard history={history.data} ledger={ledger.data} balance={balanceCop} />
            <NoticesCard available={available.data} active={active.data} history={history.data} ledger={ledger.data} onGo={setView} />
          </>
        }
        promo={<PromoCard onGo={setView} />}
      >
        {toast}
        {center}
      </PanelDesktop>
    );
  }

  return <PanelMobile {...shell}>
      {toast}
      {center}
    </PanelMobile>;
}
