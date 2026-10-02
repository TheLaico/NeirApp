import { authRequest } from '../../services/auth.js';

const API = '/api/v1/lodging';

// Hospedaje: hoteles de Neira, sus reseñas y las solicitudes de reserva (módulo `lodging` de la API).
export const lodgingApi = {
  list: () => authRequest(`${API}/hotels`),
  get: (id) => authRequest(`${API}/hotels/${id}`),
  reviews: (id) => authRequest(`${API}/hotels/${id}/reviews`),
  rate: (id, stars, comment) => authRequest(`${API}/hotels/${id}/reviews/mine`, { method: 'PUT', body: { stars, comment } }),
  reserve: (id, body) => authRequest(`${API}/hotels/${id}/reservations`, { method: 'POST', body }),
  myReservations: () => authRequest(`${API}/reservations/mine`),
  cancelReservation: (id) => authRequest(`${API}/reservations/${id}/cancel`, { method: 'PUT', body: {} }),
  // Panel del hospedaje.
  mine: () => authRequest(`${API}/me`),
  saveMine: (body) => authRequest(`${API}/me`, { method: 'PUT', body }),
  myReviews: () => authRequest(`${API}/me/reviews`),
  reply: (reviewId, text) => authRequest(`${API}/me/reviews/${reviewId}/reply`, { method: 'PUT', body: { text } }),
  hotelReservations: () => authRequest(`${API}/me/reservations`),
  confirm: (id, note) => authRequest(`${API}/me/reservations/${id}/confirm`, { method: 'PUT', body: { note } }),
  decline: (id, note) => authRequest(`${API}/me/reservations/${id}/decline`, { method: 'PUT', body: { note } }),
  // Solo administrador.
  adminHotels: () => authRequest(`${API}/admin/hotels`),
  setRecommended: (id, recommended, bannerUrl) =>
    authRequest(`${API}/admin/hotels/${id}/recommended`, { method: 'PUT', body: { recommended, banner_url: bannerUrl } }),
};
