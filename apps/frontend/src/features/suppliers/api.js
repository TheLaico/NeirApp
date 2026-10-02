import { authRequest } from '../../services/auth.js';

const API = '/api/v1/suppliers';

// Proveedores: empresas de Neira que venden al por mayor (módulo `suppliers` de la API).
export const suppliersApi = {
  list: (category) => authRequest(`${API}${category ? `?category=${category}` : ''}`),
  get: (id) => authRequest(`${API}/${id}`),
  mine: () => authRequest(`${API}/me`),
  saveMine: (body) => authRequest(`${API}/me`, { method: 'PUT', body }),
  // Suscripción ($ 24.900 al mes): la empresa reporta el pago y el administrador lo confirma.
  subscription: () => authRequest(`${API}/me/subscription`),
  pay: (reference) => authRequest(`${API}/me/subscription/payments`, { method: 'POST', body: { reference } }),
  cancelPayment: (id) => authRequest(`${API}/me/subscription/payments/${id}/cancel`, { method: 'PUT', body: {} }),
  // Solo administrador.
  adminSubscriptions: () => authRequest(`${API}/admin/subscriptions`),
  approvePayment: (id) => authRequest(`${API}/admin/payments/${id}/approve`, { method: 'PUT', body: {} }),
  rejectPayment: (id, note) => authRequest(`${API}/admin/payments/${id}/reject`, { method: 'PUT', body: { note } }),
  grantMonth: (userId) => authRequest(`${API}/admin/${userId}/grant-month`, { method: 'POST', body: {} }),
  endSubscription: (userId) => authRequest(`${API}/admin/${userId}/end`, { method: 'PUT', body: {} }),
};
