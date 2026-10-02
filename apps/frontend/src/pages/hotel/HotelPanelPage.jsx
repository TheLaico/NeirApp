import { BedDouble, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { lodgingApi } from '../../features/lodging/api.js';
import { isActive } from '../../features/lodging/model.js';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import NotificationsView from '../professional/NotificationsView.jsx';
import '../professional/professional-panel.css';
import '../suppliers/suppliers.css';
import '../supplier/supplier-panel.css';
import '../lodging/lodging.css';
import HomeView from './HomeView.jsx';
import HotelFormView from './HotelFormView.jsx';
import PlanView from './PlanView.jsx';
import ReservationsView from './ReservationsView.jsx';
import ReviewsView from './ReviewsView.jsx';
import './hotel-panel.css';

const DESKTOP = '(min-width: 1100px)';

const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'hotel', label: 'Mi hotel', icon: 'shop' },
  { key: 'reservations', label: 'Reservas', icon: 'calendar' },
  { key: 'reviews', label: 'Reseñas', icon: 'star' },
  { key: 'plan', label: 'Plan', icon: 'wallet' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
];
const TABS = NAV.filter((n) => n.key !== 'notifications' && n.key !== 'reviews');

/**
 * Panel del hospedaje: su información (fotos, servicios, ubicación en el mapa, precio), las solicitudes de reserva
 * (confirmar o rechazar), las reseñas (responder) y sus avisos. Mismo marco que los demás paneles.
 */
export default function HotelPanelPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const allowed = user.roles?.includes('hotel') || canAccessAdmin(user);
  const [view, setView] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('seccion');
    return NAV.some((n) => n.key === section) ? section : 'home';
  });
  const { serverUnread: unread, reload: reloadNotices } = useNotifications();
  const [state, setState] = useState({ hotel: null, reservations: [], reviews: [], billing: null, loading: true, error: '' });

  const load = useCallback(async () => {
    try {
      const hotel = await lodgingApi.mine().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      const [reservations, reviews, billing] = hotel
        ? await Promise.all([lodgingApi.hotelReservations(), lodgingApi.myReviews(), lodgingApi.plan()])
        : [[], [], await lodgingApi.plan()];
      setState({ hotel, reservations, reviews, billing, loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    if (allowed) load();
  }, [allowed, load]);
  // Un aviso nuevo suele ser una reserva o una reseña: se vuelve a consultar.
  useEffect(() => {
    if (allowed && unread > 0) load();
  }, [allowed, unread, load]);

  const { hotel, reservations, reviews, billing } = state;
  const listed = isActive(billing?.listing.until);
  const setBilling = (b) => setState((s) => ({ ...s, billing: b }));
  const pending = reservations.filter((r) => r.status === 'pending').length;
  const unanswered = reviews.filter((r) => !r.reply).length;

  const save = async (body) => {
    const saved = await lodgingApi.saveMine(body);
    setState((s) => ({ ...s, hotel: saved }));
    return saved;
  };
  const replaceReservation = (r) => setState((s) => ({ ...s, reservations: s.reservations.map((x) => (x.id === r.id ? r : x)) }));
  const replaceReview = (r) => setState((s) => ({ ...s, reviews: s.reviews.map((x) => (x.id === r.id ? r : x)) }));

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de hospedaje</h1>
        <p>Pídele a un administrador que autorice el correo de tu hotel en Roles (rol Hotel).</p>
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
  } else if (view === 'hotel') {
    content = <HotelFormView user={user} hotel={hotel} onSave={save} onPublic={() => navigate(`/hospedaje/hotel?id=${hotel.id}`)} />;
  } else if (view === 'reservations') {
    content = <ReservationsView hotel={hotel} reservations={reservations} onChange={replaceReservation} onGo={setView} />;
  } else if (view === 'reviews') {
    content = <ReviewsView hotel={hotel} reviews={reviews} onChange={replaceReview} onGo={setView} />;
  } else if (view === 'plan') {
    content = (
      <PlanView
        hotel={hotel}
        billing={billing}
        onPay={async (kind, reference) => setBilling(await lodgingApi.pay(kind, reference))}
        onCancel={async (id) => setBilling(await lodgingApi.cancelPayment(id))}
        onGo={setView}
      />
    );
  } else if (view === 'notifications') {
    content = (
      <NotificationsView
        onGo={setView}
        onNavigate={navigate}
        panelPath="/hotel"
        about="Aquí te avisamos de nuevas reservas, cancelaciones, reseñas de tus huéspedes y cuando confirmemos tus pagos."
        empty="Todavía no tienes notificaciones. Cuando un turista pida una reserva o te califique, te avisaremos aquí."
      />
    );
  } else {
    content = <HomeView user={user} hotel={hotel} billing={billing} pending={pending} unanswered={unanswered} onGo={setView} onPublic={() => navigate(hotel ? `/hospedaje/hotel?id=${hotel.id}` : '/hospedaje')} />;
  }

  const shell = {
    user,
    profile: { name: hotel?.name || user.name, image: hotel?.photos?.[0], Icon: BedDouble, roleLabel: hotel?.is_recommended ? 'Hotel · Destacado' : listed ? 'Hotel · Plan activo' : 'Hotel' },
    nav: NAV,
    badges: { notifications: unread, reservations: pending, reviews: unanswered, plan: hotel && !listed && !billing?.listing.pending ? 1 : 0 },
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
