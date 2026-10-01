import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuthStore } from "./store";

interface AuthContextValue {
  /** `false` hasta que `AsyncStorage` termine de leerse — la splash screen se queda visible. */
  isHydrated: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isHydrated: false, isAuthenticated: false });

/**
 * Expone si la sesión ya se rehidrató desde `AsyncStorage` (async, a diferencia de `localStorage`
 * en la web) para que el layout raíz pueda mantener la splash screen hasta saber si hay sesión —
 * mostrar el login y luego saltar a la app un instante después se siente como un parpadeo.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(useAuthStore.persist.hasHydrated());
  const user = useAuthStore((s) => s.user);
  const refreshToken = useAuthStore((s) => s.refreshToken);

  useEffect(() => {
    if (isHydrated) return;
    return useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
  }, [isHydrated]);

  const isAuthenticated = !!user && !!refreshToken;

  return (
    <AuthContext.Provider value={{ isHydrated, isAuthenticated }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
