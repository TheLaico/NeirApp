import { createContext, useContext, useMemo } from 'react';
import { usePersistentState } from '../../lib/usePersistentState.js';

// Preferencias de pago del cliente: medio predeterminado y celular de Nequi.
// No se guardan números de tarjeta ni datos de cuentas: eso lo maneja cada pasarela.
const DEFAULTS = { defaultId: 'nequi', nequiPhone: '' };

const PaymentsContext = createContext(null);

export function PaymentsProvider({ children }) {
  const [prefs, setPrefs] = usePersistentState('neirapp.frontend.payment-prefs', DEFAULTS);

  const value = useMemo(
    () => ({
      defaultId: prefs.defaultId ?? DEFAULTS.defaultId,
      nequiPhone: prefs.nequiPhone ?? '',
      setDefault: (id) => setPrefs((p) => ({ ...p, defaultId: id })),
      setNequiPhone: (phone) => setPrefs((p) => ({ ...p, nequiPhone: phone })),
    }),
    [prefs, setPrefs],
  );

  return <PaymentsContext.Provider value={value}>{children}</PaymentsContext.Provider>;
}

export function usePayments() {
  const ctx = useContext(PaymentsContext);
  if (!ctx) throw new Error('usePayments debe usarse dentro de <PaymentsProvider>');
  return ctx;
}
