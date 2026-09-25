import { useEffect, useState } from 'react';
import footer from '../../assets/footer.png';
import CartDrawer from './CartDrawer.jsx';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import '../products/product-screen.css';
import './app-shell.css';

/**
 * Marco común de las páginas autenticadas: encabezado (logo, buscador, categorías, carrito y usuario),
 * barra lateral, paisaje sobrepuesto y carrito. Cada página aporta su contenido como hijos, que se
 * colocan en la cuadrícula `.app` (columnas: barra lateral · contenido · panel opcional).
 */
export default function AppShell({
  user,
  onLogout,
  group,
  onGroup,
  query,
  onQuery,
  className = '',
  children,
}) {
  const [cartOpen, setCartOpen] = useState(false);

  // Las páginas internas ocupan todo el ancho: quita el marco de tarjeta que usan las pantallas de login.
  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  return (
    <div className={`app ${className}`.trim()}>
      <Topbar
        user={user}
        onLogout={onLogout}
        group={group}
        onGroup={onGroup}
        query={query}
        onQuery={onQuery}
        onOpenCart={() => setCartOpen(true)}
      />
      <Sidebar />

      {children}

      {/* Sobrepuesto: nace en la barra lateral y se extiende sobre el contenido */}
      <img className="home-footer" src={footer} alt="" aria-hidden="true" />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
