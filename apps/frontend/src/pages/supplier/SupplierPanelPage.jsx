import { Building2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { suppliersApi } from '../../features/suppliers/api.js';
import { isPaid } from '../../features/suppliers/model.js';
import { useNavigate, usePath } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import NotificationsView from '../professional/NotificationsView.jsx';
import '../professional/professional-panel.css';
import '../suppliers/suppliers.css';
import CatalogView from './CatalogView.jsx';
import CompanyView from './CompanyView.jsx';
import HomeView from './HomeView.jsx';
import SubscriptionView from './SubscriptionView.jsx';
import './supplier-panel.css';

const DESKTOP = '(min-width: 1100px)';

const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'company', label: 'Mi empresa', icon: 'shop' },
  { key: 'catalog', label: 'Catálogo', icon: 'image' },
  { key: 'subscription', label: 'Suscripción', icon: 'wallet' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
];
const TABS = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'company', label: 'Mi empresa', icon: 'shop' },
  { key: 'catalog', label: 'Catálogo', icon: 'image' },
  { key: 'subscription', label: 'Suscripción', icon: 'wallet' },
];

/**
 * Panel del proveedor (empresa que vende al por mayor): su perfil, su catálogo (brochure), la suscripción de
 * $ 24.900 al mes para aparecer en Proveedores y sus avisos. Mismo marco que los paneles de profesional y comerciante.
 */
export default function SupplierPanelPage({ user, onLogout }) {
  const navigate = useNavigate();
  const path = usePath();
  const desktop = useMediaQuery(DESKTOP);
  const allowed = user.roles?.includes('supplier') || canAccessAdmin(user);
  const [view, setView] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('seccion');
    if (NAV.some((n) => n.key === section)) return section;
    return path === '/proveedores/mi-empresa' ? 'company' : 'home';
  });
  const { serverUnread: unread, reload: reloadNotices } = useNotifications();
  const [state, setState] = useState({ supplier: null, subscription: null, loading: true, error: '' });

  const load = useCallback(async () => {
    try {
      const supplier = await suppliersApi.mine().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      const subscription = await suppliersApi.subscription();
      setState({ supplier, subscription, loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);

  // Un aviso nuevo puede ser "tu suscripción está activa": se vuelve a consultar.
  useEffect(() => {
    if (allowed && unread > 0) load();
  }, [allowed, unread, load]);

  const { supplier, subscription } = state;
  const save = async (body) => {
    const saved = await suppliersApi.saveMine(body);
    setState((s) => ({ ...s, supplier: saved }));
    return saved;
  };
  const setSubscription = (sub) => setState((s) => ({ ...s, subscription: sub }));

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de proveedor</h1>
        <p>Pídele a un administrador que autorice el correo de tu empresa como proveedor.</p>
        <button type="button" className="sp-btn outline" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  } else if (state.loading) {
    content = <p className="sp-empty">Cargando…</p>;
  } else if (state.error) {
    content = (
      <div className="sp-empty">
        <p role="alert">{state.error}</p>
        <button type="button" className="sp-btn outline" onClick={load}>
          Reintentar
        </button>
      </div>
    );
  } else if (view === 'company') {
    content = <CompanyView user={user} supplier={supplier} onSave={save} />;
  } else if (view === 'catalog') {
    content = <CatalogView user={user} supplier={supplier} paidUntil={subscription?.paid_until} onSave={save} onGo={setView} />;
  } else if (view === 'subscription') {
    content = (
      <SubscriptionView
        supplier={supplier}
        subscription={subscription}
        onPay={async (reference) => setSubscription(await suppliersApi.pay(reference))}
        onCancel={async (id) => setSubscription(await suppliersApi.cancelPayment(id))}
        onGo={setView}
      />
    );
  } else if (view === 'notifications') {
    content = (
      <NotificationsView
        onGo={setView}
        onNavigate={navigate}
        panelPath="/proveedor"
        about="Aquí te avisamos cuando confirmemos tus pagos de suscripción."
        empty="Todavía no tienes notificaciones. Cuando confirmemos tu suscripción te avisaremos aquí."
      />
    );
  } else {
    content = <HomeView user={user} supplier={supplier} subscription={subscription} onGo={setView} onPublic={() => navigate('/proveedores')} />;
  }

  const paid = isPaid(subscription?.paid_until);
  const shell = {
    user,
    profile: {
      name: supplier?.company_name || user.name,
      image: supplier?.logo_url,
      Icon: Building2,
      roleLabel: paid ? 'Proveedor · Suscripción activa' : 'Proveedor',
    },
    nav: NAV,
    badges: { notifications: unread, subscription: !paid && supplier && !subscription?.pending ? 1 : 0 },
    view,
    onSelect: (key) => {
      setView(key);
      if (key === 'notifications') reloadNotices();
    },
    bell: {
      count: unread,
      label: `Notificaciones${unread ? `, ${unread} sin leer` : ''}`,
      onClick: () => {
        setView('notifications');
        reloadNotices();
      },
    },
    slogan,
    menuEnabled: allowed,
    onLogout,
  };

  return desktop ? (
    <PanelDesktop {...shell}>{content}</PanelDesktop>
  ) : (
    <PanelMobile {...shell} tabs={TABS}>
      {content}
    </PanelMobile>
  );
}

