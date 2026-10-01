import { useCallback, useEffect, useState } from 'react';
import { authRequest } from '../../services/auth.js';

/** Roles que el administrador autoriza por correo. Los demás (cliente, admin) no se gestionan desde aquí. */
export const ASSIGNABLE_ROLES = [
  { value: 'courier', label: 'Repartidor' },
  { value: 'store_staff', label: 'Comerciante (dueño de local)' },
];

export const roleLabel = (role) => ASSIGNABLE_ROLES.find((r) => r.value === role)?.label ?? role;

const PATH = '/admin/role-grants';

/** Correos autorizados: lista, autorizar y quitar. Todo pasa por la API (solo responde a administradores). */
export function useRoleGrants() {
  const [state, setState] = useState({ grants: [], status: 'loading', error: '' });

  const load = useCallback(async () => {
    try {
      const grants = await authRequest(PATH);
      setState({ grants, status: 'ok', error: '' });
    } catch (err) {
      setState((s) => ({ ...s, status: 'error', error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grant = async (email, role) => {
    await authRequest(PATH, { method: 'POST', body: { email, role } });
    await load();
  };

  const revoke = async (email, role) => {
    await authRequest(`${PATH}?${new URLSearchParams({ email, role })}`, { method: 'DELETE' });
    await load();
  };

  return { ...state, grant, revoke };
}
