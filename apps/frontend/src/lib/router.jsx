import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Enrutador mínimo basado en la History API (sin dependencias): /  y  /favoritos, etc.
const RouterContext = createContext(null);

export function Router({ children }) {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // `to` puede traer parámetros (?nueva=1): la ruta que se compara es solo el pathname.
  const navigate = useCallback((to) => {
    const pathname = to.split(/[?#]/)[0];
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState(null, '', to);
    setPath(pathname);
    window.scrollTo(0, 0);
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter debe usarse dentro de <Router>');
  return ctx;
}

export const usePath = () => useRouter().path;
export const useNavigate = () => useRouter().navigate;
