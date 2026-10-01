import { useState } from 'react';
import DevViewSwitcher from './components/dev/DevViewSwitcher.jsx';
import { CartProvider } from './features/cart/CartContext.jsx';
import { FavoritesProvider } from './features/favorites/FavoritesContext.jsx';
import { OrdersProvider } from './features/orders/OrdersContext.jsx';
import OrderTracker from './features/orders/OrderTracker.jsx';
import { NotificationsProvider } from './features/notifications/NotificationsContext.jsx';
import { PaymentsProvider } from './features/payments/PaymentsContext.jsx';
import { SettingsProvider } from './features/settings/SettingsContext.jsx';
import { Router, useNavigate, usePath } from './lib/router.jsx';
import AdminCouriersPage from './pages/admin/AdminCouriersPage.jsx';
import AdminLeadsPage from './pages/admin/AdminLeadsPage.jsx';
import AdminLiveMapPage from './pages/admin/AdminLiveMapPage.jsx';
import AdminShippingPage from './pages/admin/AdminShippingPage.jsx';
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx';
import AdminProfessionalsPage from './pages/admin/AdminProfessionalsPage.jsx';
import AdminRolesPage from './pages/admin/AdminRolesPage.jsx';
import AdminStoresPage from './pages/admin/AdminStoresPage.jsx';
import CheckoutPage from './pages/checkout/CheckoutPage.jsx';
import CourierPage from './pages/courier/CourierPage.jsx';
import FavoritesPage from './pages/favorites/FavoritesPage.jsx';
import HomePage from './pages/home/HomePage.jsx';
import MapPage from './pages/home/MapPage.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import MorePage from './pages/more/MorePage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';
import PaymentsPage from './pages/payments/PaymentsPage.jsx';
import PlansPage from './pages/professional/PlansPage.jsx';
import ProfessionalPage from './pages/professional/ProfessionalPage.jsx';
import ProfessionalProfilePage from './pages/professionals/ProfessionalProfilePage.jsx';
import ProfessionalsPage from './pages/professionals/ProfessionalsPage.jsx';
import SubcategoryProfessionalsPage from './pages/professionals/SubcategoryProfessionalsPage.jsx';
import RegisterPage from './pages/register/RegisterPage.jsx';
import MerchantPage from './pages/merchant/MerchantPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import { getSession, logout } from './services/auth.js';

// Rutas de las páginas autenticadas. Cualquier otra ruta cae en el inicio.
const ROUTES = {
  '/mapa': MapPage,
  '/mas': MorePage,
  '/profesionales': ProfessionalsPage,
  '/profesionales/categoria': SubcategoryProfessionalsPage,
  '/profesionales/perfil': ProfessionalProfilePage,
  '/favoritos': FavoritesPage,
  '/pedidos': OrdersPage,
  '/checkout': CheckoutPage,
  '/admin': AdminOverviewPage,
  '/admin/tiendas': AdminStoresPage,
  '/admin/roles': AdminRolesPage,
  '/admin/repartidores': AdminCouriersPage,
  '/admin/profesionales': AdminProfessionalsPage,
  '/admin/envios': AdminShippingPage,
  '/admin/mapa': AdminLiveMapPage,
  '/admin/solicitudes': AdminLeadsPage,
  '/repartidor': CourierPage,
  '/comercio': MerchantPage,
  '/profesional': ProfessionalPage,
  '/profesional/planes': PlansPage,
  '/notificaciones': NotificationsPage,
  '/pagos': PaymentsPage,
  '/configuracion': SettingsPage,
};

function AuthenticatedApp({ user, onLogout, onUserChange }) {
  const path = usePath();
  const Page = ROUTES[path] ?? HomePage;

  return (
    <SettingsProvider>
      <NotificationsProvider>
        <PaymentsProvider>
          <OrdersProvider>
            <CartProvider>
              <FavoritesProvider>
                <Page user={user} onLogout={onLogout} onUserChange={onUserChange} />
                <OrderTracker userId={user.id} />
                <DevViewSwitcher user={user} />
              </FavoritesProvider>
            </CartProvider>
          </OrdersProvider>
        </PaymentsProvider>
      </NotificationsProvider>
    </SettingsProvider>
  );
}

function Root() {
  const [user, setUser] = useState(getSession);
  const [screen, setScreen] = useState('login');
  const navigate = useNavigate();

  if (user) {
    return (
      <AuthenticatedApp
        user={user}
        onUserChange={setUser}
        onLogout={() => {
          logout();
          setUser(null);
          setScreen('login');
          navigate('/');
        }}
      />
    );
  }

  return screen === 'login' ? (
    <LoginPage onGoRegister={() => setScreen('register')} onSuccess={setUser} />
  ) : (
    <RegisterPage onGoLogin={() => setScreen('login')} onSuccess={setUser} />
  );
}

export default function App() {
  return (
    <Router>
      <Root />
    </Router>
  );
}
