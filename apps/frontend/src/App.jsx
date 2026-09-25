import { useState } from 'react';
import { CartProvider } from './features/cart/CartContext.jsx';
import { FavoritesProvider } from './features/favorites/FavoritesContext.jsx';
import { OrdersProvider } from './features/orders/OrdersContext.jsx';
import { NotificationsProvider } from './features/notifications/NotificationsContext.jsx';
import { PaymentsProvider } from './features/payments/PaymentsContext.jsx';
import { SettingsProvider } from './features/settings/SettingsContext.jsx';
import { Router, useNavigate, usePath } from './lib/router.jsx';
import AdminOverviewPage from './pages/admin/AdminOverviewPage.jsx';
import AdminStoresPage from './pages/admin/AdminStoresPage.jsx';
import CheckoutPage from './pages/checkout/CheckoutPage.jsx';
import FavoritesPage from './pages/favorites/FavoritesPage.jsx';
import HomePage from './pages/home/HomePage.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import NotificationsPage from './pages/notifications/NotificationsPage.jsx';
import OrdersPage from './pages/orders/OrdersPage.jsx';
import PaymentsPage from './pages/payments/PaymentsPage.jsx';
import RegisterPage from './pages/register/RegisterPage.jsx';
import SettingsPage from './pages/settings/SettingsPage.jsx';
import { getSession, logout } from './services/auth.js';

// Rutas de las páginas autenticadas. Cualquier otra ruta cae en el inicio.
const ROUTES = {
  '/favoritos': FavoritesPage,
  '/pedidos': OrdersPage,
  '/checkout': CheckoutPage,
  '/admin': AdminOverviewPage,
  '/admin/tiendas': AdminStoresPage,
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
