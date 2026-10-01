import { authRequest } from '../../services/auth.js';

const API = '/api/v1';

// Solicitudes de negocios que quieren vender en NeirAPP (módulo `leads`).
export const leadsApi = {
  submit: (body) => authRequest(`${API}/leads/merchants`, { method: 'POST', body }),
  // Solo administrador.
  list: () => authRequest(`${API}/leads/merchants`),
  setContacted: (id, isContacted) => authRequest(`${API}/leads/merchants/${id}`, { method: 'PATCH', body: { is_contacted: isContacted } }),
};
