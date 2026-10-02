import { authRequest, publicRequest } from '../../services/auth.js';

const API = '/api/v1';

// Solicitudes de negocios que quieren vender en NeirAPP (módulo `leads`).
export const leadsApi = {
  submit: (body) => authRequest(`${API}/leads/merchants`, { method: 'POST', body }),
  // Solo administrador.
  list: () => authRequest(`${API}/leads/merchants`),
  setContacted: (id, isContacted) => authRequest(`${API}/leads/merchants/${id}`, { method: 'PATCH', body: { is_contacted: isContacted } }),
};

// "¿Quieres formar parte de NeirAPP?": solicitudes para entrar con un rol (repartidor, comerciante…).
export const applicationsApi = {
  // Pública: se envía desde la pantalla de inicio de sesión, sin cuenta.
  submit: (body) => publicRequest(`${API}/leads/applications`, { method: 'POST', body }),
  // Solo administrador.
  list: () => authRequest(`${API}/leads/applications`),
  setContacted: (id, isContacted) => authRequest(`${API}/leads/applications/${id}`, { method: 'PATCH', body: { is_contacted: isContacted } }),
};
