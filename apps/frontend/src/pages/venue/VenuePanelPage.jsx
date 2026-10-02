import { CalendarCheck, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { venuesApi } from '../../features/venues/api.js';
import { useNotifications } from '../../features/notifications/NotificationsContext.jsx';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import NotificationsView from '../professional/NotificationsView.jsx';
import '../professional/professional-panel.css';
import '../suppliers/suppliers.css';
import '../supplier/supplier-panel.css';
import '../lodging/lodging.css';
import '../hotel/hotel-panel.css';
import '../venues/venues.css';
import BookingsView from './BookingsView.jsx';
import HomeView from './HomeView.jsx';
import ReviewsView from './ReviewsView.jsx';
import VenueFormView from './VenueFormView.jsx';

const DESKTOP = '(min-width: 1100px)';

const NAV = [
  { key: 'home', label: 'Inicio', icon: 'home' },
  { key: 'venue', label: 'Mi lugar', icon: 'shop' },
  { key: 'bookings', label: 'Reservas', icon: 'calendar' },
  { key: 'reviews', label: 'Reseñas', icon: 'star' },
  { key: 'notifications', label: 'Notificaciones', icon: 'bell' },
];
const TABS = NAV.slice(0, 4);

/**
 * Panel del establecimiento (restaurante, cancha, salón…): su ficha (fotos, horario, servicios, ubicación en el mapa,
 * precio), las solicitudes de reserva (confirmar o rechazar), las reseñas (responder) y sus avisos.
 */
export default function VenuePanelPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const allowed = user.roles?.includes('venue') || canAccessAdmin(user);
  const [view, setView] = useState(() => {
    const section = new URLSearchParams(window.location.search).get('seccion');
    return NAV.some((n) => n.key === section) ? section : 'home';
  });
  const { serverUnread: unread, reload: reloadNotices } = useNotifications();
  const [state, setState] = useState({ venue: null, bookings: [], reviews: [], loading: true, error: '' });

  const load = useCallback(async () => {
    try {
      const venue = await venuesApi.mine().catch((err) => {
        if (err.status === 404) return null;
        throw err;
      });
      const [bookings, reviews] = venue ? await Promise.all([venuesApi.venueBookings(), venuesApi.myReviews()]) : [[], []];
      setState({ venue, bookings, reviews, loading: false, error: '' });
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

  const { venue, bookings, reviews } = state;
  const pending = bookings.filter((b) => b.status === 'pending').length;
  const unanswered = reviews.filter((r) => !r.reply).length;

  const save = async (body) => {
    const saved = await venuesApi.saveMine(body);
    setState((s) => ({ ...s, venue: saved }));
    return saved;
  };
  const replaceBooking = (b) => setState((s) => ({ ...s, bookings: s.bookings.map((x) => (x.id === b.id ? b : x)) }));
  const replaceReview = (r) => setState((s) => ({ ...s, reviews: s.reviews.map((x) => (x.id === r.id ? r : x)) }));

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de establecimiento</h1>
        <p>Pídele a un administrador que autorice el correo de tu negocio en Roles (rol Establecimiento).</p>
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
  } else if (view === 'venue') {
    content = <VenueFormView user={user} venue={venue} onSave={save} onPublic={() => navigate(`/reservas/lugar?id=${venue.id}`)} />;
  } else if (view === 'bookings') {
    content = <BookingsView venue={venue} bookings={bookings} onChange={replaceBooking} onGo={setView} />;
  } else if (view === 'reviews') {
    content = <ReviewsView venue={venue} reviews={reviews} onChange={replaceReview} onGo={setView} />;
  } else if (view === 'notifications') {
    content = (
      <NotificationsView
        onGo={setView}
        onNavigate={navigate}
        panelPath="/establecimiento"
        about="Aquí te avisamos de nuevas reservas, cancelaciones y reseñas de tus clientes."
        empty="Todavía no tienes notificaciones. Cuando alguien pida una reserva o te califique, te avisaremos aquí."
      />
    );
  } else {
    content = <HomeView user={user} venue={venue} pending={pending} unanswered={unanswered} onGo={setView} onPublic={() => navigate(venue ? `/reservas/lugar?id=${venue.id}` : '/reservas')} />;
  }

  const shell = {
    user,
    profile: { name: venue?.name || user.name, image: venue?.photos?.[0], Icon: CalendarCheck, roleLabel: venue?.is_featured ? 'Establecimiento · Destacado' : 'Establecimiento' },
    nav: NAV,
    badges: { notifications: unread, bookings: pending, reviews: unanswered },
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
