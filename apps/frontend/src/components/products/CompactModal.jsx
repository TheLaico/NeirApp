import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** ¿Es una pantalla de celular o tableta? (menos de 1024 px, como el resto de la app) */
export const isCompactScreen = () => window.matchMedia('(max-width: 1023px)').matches;

/**
 * En celular y tableta muestra `children` como ventana emergente sobre toda la pantalla (el mapa puede quedar fuera de
 * vista al bajar la página); en computador los deja donde están, sobre el mapa. `children` es una `.product-screen`.
 */
export default function CompactModal({ compact, onClose, children }) {
  // Con la ventana abierta, la página de atrás no se desplaza.
  useEffect(() => {
    if (!compact) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [compact]);

  if (!compact) return children;
  return createPortal(
    <div className="ps-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>,
    document.body,
  );
}
