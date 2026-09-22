import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "./hooks";
import { useAuthStore } from "./store";
import { TermsGate } from "./TermsGate";

/** Protege rutas privadas: exige sesión y que los términos vigentes estén aceptados. */
export function RequireAuth() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  // Refresca el perfil desde el servidor (roles y términos pueden haber cambiado).
  useMe(user !== null);

  if (!user) {
    return <Navigate to="/ingresar" replace state={{ from: location.pathname }} />;
  }
  if (user.must_accept_terms) return <TermsGate />;
  return <Outlet />;
}
