import { BottomDecor, DesktopSlogan, TopDecor } from './Decor.jsx';
import Logo from './Logo.jsx';
import './auth.css';

/**
 * Pantalla base de las páginas de acceso (iniciar sesión y crear cuenta): decoración, logo,
 * título y subtítulo. `topSlot` permite poner controles propios (por ejemplo, el botón de volver).
 */
export default function AuthScreen({ variant, title, subtitle, topSlot = null, children }) {
  return (
    <main className="screen">
      <TopDecor variant={variant} />
      {topSlot}
      <div className="content">
        <Logo />
        <h1 className="title">{title}</h1>
        <p className="subtitle">{subtitle}</p>
        {children}
      </div>
      <BottomDecor />
      <DesktopSlogan />
    </main>
  );
}
