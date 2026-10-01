import { createContext, useContext, useMemo } from 'react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Preferencias del usuario, guardadas en el navegador.
const DEFAULTS = {
  orderNotifications: true,
  offersNotifications: false,
  mapHint: true,
  // Apagado por defecto: el mapa siempre se ve de día a menos que el usuario prenda esto.
  mapNightAuto: false,
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [prefs, setPrefs] = usePersistentState('neirapp.frontend.settings', DEFAULTS);

  const value = useMemo(
    () => ({
      prefs: { ...DEFAULTS, ...prefs },
      set: (key, val) => setPrefs((p) => ({ ...p, [key]: val })),
    }),
    [prefs, setPrefs],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings debe usarse dentro de <SettingsProvider>');
  return ctx;
}
