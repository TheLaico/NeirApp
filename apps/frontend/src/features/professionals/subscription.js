import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from './api.js';

// Plan del profesional (`GET /professionals/me/plan`): el vigente, las renovaciones ya pagadas, la solicitud que
// espera que el administrador confirme el pago y lo que permite hoy (fotos, certificados, solicitudes).

export const PLAN_NAMES = { basic: 'Básico', pro: 'Profesional', premium: 'Premium' };

/** "21 de octubre" (o "21 de octubre de 2027" si no es este año). */
export function dayLabel(iso) {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Días que le quedan al plan vigente (redondeado hacia arriba). */
export const daysLeft = (iso) => Math.max(0, Math.ceil((new Date(iso) - Date.now()) / 86400000));

/** Hasta cuándo tiene pagado: el vencimiento del plan vigente o de la última renovación ya activada. */
export function paidUntil(status) {
  const last = status?.upcoming?.[status.upcoming.length - 1];
  return last?.expires_at ?? status?.current?.expires_at ?? null;
}

export function useMyPlan(enabled = true) {
  const [state, setState] = useState({ status: null, loading: true, error: '' });

  const load = useCallback(async () => {
    try {
      setState({ status: await professionalsApi.myPlan(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const request = useCallback(async (plan, reference) => {
    const status = await professionalsApi.requestPlan(plan, reference);
    setState({ status, loading: false, error: '' });
    return status;
  }, []);

  const cancel = useCallback(async (id) => {
    const status = await professionalsApi.cancelPlanRequest(id);
    setState({ status, loading: false, error: '' });
    return status;
  }, []);

  return { ...state, reload: load, request, cancel };
}
