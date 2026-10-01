import { Construction, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import slogan from '../../assets/slogan.png';
import PanelDesktop from '../../components/panel/PanelDesktop.jsx';
import PanelMobile from '../../components/panel/PanelMobile.jsx';
import { canAccessAdmin } from '../../config/roles.js';
import { displayName, useProfessionalProfile } from '../../features/professionals/profile.js';
import { useNavigate } from '../../lib/router.jsx';
import { useMediaQuery } from '../../lib/useMediaQuery.js';
import '../admin/admin.css';
import HomeView from './HomeView.jsx';
import ProfileView from './ProfileView.jsx';
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
  const [profile, setProfile] = useProfessionalProfile(user);
  const name = displayName(profile) || user.name;
  const activity = { ...SAMPLE_ACTIVITY, hasDescription: profile.description.trim().length >= 80 };

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
  } else if (view === 'home') {
    content = <HomeView name={name} activity={activity} onGo={setView} onPlans={() => navigate('/profesional/planes')} />;
  } else if (view === 'profile') {
    content = <ProfileView profile={profile} onSave={setProfile} />;
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
    profile: { name, image: profile.photo, Icon: UserRound, roleLabel: 'Profesional' },
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
