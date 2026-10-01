// Íconos sólidos (rellenos) para el menú del panel del comerciante, dibujados sobre una cuadrícula de 24 px.
// Se pintan con `currentColor`: cambian solos entre verde (normal) y blanco (activo).

const PATHS = {
  // Casa
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  // Bolsa de compras
  bag: 'M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm-3 6a1 1 0 1 1-2 0V8h2v2zm6 0a1 1 0 1 1-2 0V8h2v2z',
  // Caja de productos
  box: 'M20 2H4a2 2 0 0 0-2 2v3c0 .72.43 1.34 1 1.69V20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8.69c.57-.35 1-.97 1-1.69V4a2 2 0 0 0-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z',
  // Tienda con toldo
  shop: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  // Estrella
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  // Reloj
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm.75 5v5.2l4 2.4-.75 1.25L11.25 13V7h1.5z',
  // Calendario
  calendar: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zM7 11h5v5H7z',
  // Billetera
  wallet: 'M21 18v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1h-9a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h9zm-9-2h10V8H12v8zm4-2.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z',
  // Ruta (flecha de navegación)
  route: 'M21 3 3 10.53v.98l6.84 2.65L12.48 21h.98L21 3z',
  // Campana
  bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  // Persona
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  // Maletín
  briefcase: 'M20 6h-4V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2zm-6 0h-4V4h4v2z',
  // Imagen
  image: 'M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z',
  // Certificado con cinta
  award: 'M20 2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h4v5l4-2 4 2v-5h4a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 13H4v-2h16v2zm0-5H4V4h16v6z',
  // Engranaje
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z',
};

/** Ícono sólido por nombre: `home`, `bag`, `box`, `shop`, `star`, `clock`, `calendar`, `wallet`, `route`, `bell`, `user`, `briefcase`, `image`, `award` o `gear`. */
export default function SolidIcon({ name, size = 24, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" aria-hidden="true" focusable="false" {...props}>
      <path d={PATHS[name]} />
    </svg>
  );
}
