import { Construction, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { professionalsApi } from '../../features/professionals/api.js';
import { displayName, useProfessionalProfile } from '../../features/professionals/profile.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import '../admin/admin.css';
import GalleryView from './GalleryView.jsx';
import HomeView from './HomeView.jsx';
import ProfileView from './ProfileView.jsx';
import ServicesView from './ServicesView.jsx';
import { NAV, SAMPLE_ACTIVITY, TABS } from './model.js';
import './professional-panel.css';

const DESKTOP = '(min-width: 1100px)';

/**
 * Panel del profesional. El administrador autoriza su correo y aquí la persona arma su propio perfil.
 * Mismo marco que los paneles de comerciante y repartidor: menú lateral en escritorio, barra inferior en celular.
 */
export default function ProfessionalPage({ user, onLogout }) {
  const navigate = useNavigate();
  const desktop = useMediaQuery(DESKTOP);
  const [view, setView] = useState('home');
  const allowed = canAccessAdmin(user) || user.roles?.includes('professional');
  const mine = useProfessionalProfile(user);
  const profile = mine.profile;
  const name = (profile && displayName(profile)) || user.name;
  // Cuántas fotos tiene en la galería: el inicio le sugiere agregar si no tiene ninguna.
  const [images, setImages] = useState(null);
  useEffect(() => {
    if (!allowed) return;
    professionalsApi
      .myGallery()
      .then((list) => setImages(list.length))
      .catch(() => {});
  }, [allowed]);
  const activity = { ...SAMPLE_ACTIVITY, hasDescription: (profile?.description.trim().length ?? 0) >= 80, images: images ?? 0 };

  let content;
  if (!allowed) {
    content = (
      <div className="cr-state">
        <ShieldCheck size={44} aria-hidden="true" />
        <h1>No tienes acceso de profesional</h1>
        <p>Pídele a un administrador que autorice tu correo como profesional.</p>
        <button type="button" className="cr-btn ghost" onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>
    );
  } else if (mine.loading && !profile) {
    content = <p className="cr-empty">Cargando…</p>;
  } else if (mine.error && !profile) {
    content = (
      <div className="cr-state">
        <p className="cr-error" role="alert">
          {mine.error}
        </p>
        <button type="button" className="cr-btn ghost" onClick={mine.reload}>
          Reintentar
        </button>
      </div>
    );
  } else if (view === 'home') {
    content = <HomeView name={name} activity={activity} onGo={setView} onPlans={() => navigate('/profesional/planes')} />;
  } else if (view === 'gallery') {
    content = <GalleryView onCountChange={setImages} />;
  } else if (view === 'services') {
    content = <ServicesView onGoProfile={() => setView('profile')} />;
  } else if (view === 'profile') {
    content = <ProfileView profile={profile} published={mine.exists} onSave={mine.save} />;
  } else {
    const section = NAV.find((n) => n.key === view);
    content = (
      <div className="cr-state">
        <Construction size={44} aria-hidden="true" />
        <h1>{section?.label}</h1>
        <p>Esta sección estará disponible muy pronto.</p>
        <button type="button" className="cr-btn ghost" onClick={() => setView('home')}>
          Volver al inicio
        </button>
      </div>
    );
  }

  const shell = {
    user,
    profile: { name, image: profile?.photo, Icon: UserRound, roleLabel: 'Profesional' },
    nav: NAV,
    badges: { requests: activity.newRequests },
    view,
    onSelect: setView,
    bell: { count: activity.newRequests, label: `Notificaciones${activity.newRequests ? `, ${activity.newRequests} nuevas` : ''}`, onClick: () => setView('notifications') },
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
