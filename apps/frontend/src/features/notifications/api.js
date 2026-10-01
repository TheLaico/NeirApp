import { authRequest } from '../../services/auth.js';

const API = '/api/v1/notifications';

// Avisos guardados en la API (citas y certificados de profesionales).
export const notificationsApi = {
  inbox: () => authRequest(API),
  read: (id) => authRequest(`${API}/${id}/read`, { method: 'PUT' }),
  readAll: () => authRequest(`${API}/read`, { method: 'PUT' }),
  remove: (id) => authRequest(`${API}/${id}`, { method: 'DELETE' }),
  clear: () => authRequest(API, { method: 'DELETE' }),
};
