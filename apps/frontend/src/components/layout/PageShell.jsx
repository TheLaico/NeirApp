import AppShell from './AppShell.jsx';
import './page-shell.css';

/**
 * Marco de las páginas de contenido (sin mapa): navbar y sidebar de AppShell más un área central
 * con título opcional. Si la página no pasa `onQuery`, el navbar oculta el buscador y las categorías.
 * `flush` quita el relleno y el scroll del área central, para páginas que gestionan su propio scroll.
 */
export default function PageShell({ title, subtitle, flush = false, className = '', children, ...shell }) {
  return (
    <AppShell {...shell} className={`page-view ${className}`.trim()}>
      <main className={`page-cell${flush ? ' flush' : ''}`}>
        {title && (
          <header className="page-head">
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </header>
        )}
        {children}
      </main>
    </AppShell>
  );
}
