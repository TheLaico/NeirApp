import { authRequest } from '../../services/auth.js';

const API = '/api/v1/marketplace';

// MarquetNeira: muebles en venta o alquiler (módulo `marketplace` de la API).
export const marketplaceApi = {
  list: () => authRequest(`${API}/listings`),
  get: (id) => authRequest(`${API}/listings/${id}`),
  report: (id, reason, details) => authRequest(`${API}/listings/${id}/reports`, { method: 'POST', body: { reason, details } }),
  // Mis publicaciones (cualquier persona con cuenta).
  mine: () => authRequest(`${API}/me/listings`),
  create: (body) => authRequest(`${API}/me/listings`, { method: 'POST', body }),
  update: (id, body) => authRequest(`${API}/me/listings/${id}`, { method: 'PUT', body }),
  setActive: (id, isActive) => authRequest(`${API}/me/listings/${id}/active`, { method: 'PUT', body: { is_active: isActive } }),
  remove: (id) => authRequest(`${API}/me/listings/${id}`, { method: 'DELETE' }),
  pay: (id, reference) => authRequest(`${API}/me/listings/${id}/payments`, { method: 'POST', body: { reference } }),
  cancelPayment: (paymentId) => authRequest(`${API}/me/payments/${paymentId}/cancel`, { method: 'PUT', body: {} }),
  // Solo administrador.
  pendingPayments: () => authRequest(`${API}/admin/payments`),
  approvePayment: (id) => authRequest(`${API}/admin/payments/${id}/approve`, { method: 'PUT', body: {} }),
  rejectPayment: (id, note) => authRequest(`${API}/admin/payments/${id}/reject`, { method: 'PUT', body: { note } }),
  reports: () => authRequest(`${API}/admin/reports`),
  dismissReports: (listingId) => authRequest(`${API}/admin/listings/${listingId}/dismiss-reports`, { method: 'PUT', body: {} }),
  removeListing: (listingId, note) => authRequest(`${API}/admin/listings/${listingId}/remove`, { method: 'PUT', body: { note } }),
  restoreListing: (listingId) => authRequest(`${API}/admin/listings/${listingId}/restore`, { method: 'PUT', body: {} }),
};
