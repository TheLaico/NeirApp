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
  // Imagen decorativa opcional detrás del encabezado y el buscador (solo la usa el inicio, por ahora).
  // Se aplica con un `::before` en `.app` (ver app-shell.css), así que no afecta a ninguna otra página.
  heroImage,
  // Centra el logo en todo el ancho del encabezado en vez de dejarlo confinado a la columna de la barra
  // lateral (solo lo usa el inicio, por ahora; en móvil se queda arriba a la izquierda, como en el mockup).
  centerLogo,
  // Oculta el botón del carrito del navbar (por ejemplo, Profesionales: no vende productos, así que no
  // tiene sentido tenerlo ahí).
  hideCart,
  // Ver Topbar: ejemplos animados del buscador y resultados debajo de él (los usa el mapa).
  searchExamples,
  searchResults,
  children,
}) {
  const [cartOpen, setCartOpen] = useState(false);
  const openCart = () => setCartOpen(true);

  // Las páginas internas ocupan todo el ancho: quita el marco de tarjeta que usan las pantallas de login.
  useEffect(() => {
    document.body.classList.add('is-home');
    return () => document.body.classList.remove('is-home');
  }, []);

  return (
    <div
      className={`app ${heroImage ? 'has-hero' : ''} ${centerLogo ? 'center-logo' : ''} ${className}`.trim()}
      style={heroImage ? { '--hero-image': `url(${heroImage})` } : undefined}
    >
      <Topbar
        user={user}
        onLogout={onLogout}
        group={group}
        onGroup={onGroup}
        query={query}
        onQuery={onQuery}
        onOpenCart={openCart}
        hideCart={hideCart}
        searchExamples={searchExamples}
        searchResults={searchResults}
      />
      <Sidebar onOpenCart={openCart} />

      {children}

      {/* Sobrepuesto: nace en la barra lateral y se extiende sobre el contenido */}
      <img className="home-footer" src={footer} alt="" aria-hidden="true" />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
