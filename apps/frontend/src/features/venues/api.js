import { authRequest } from '../../services/auth.js';

const API = '/api/v1/venues';

// Reservas: lugares de Neira que se reservan (restaurantes, canchas, salones…), sus reseñas y las reservas
// (módulo `venues` de la API).
export const venuesApi = {
  list: () => authRequest(`${API}/places`),
  get: (id) => authRequest(`${API}/places/${id}`),
  reviews: (id) => authRequest(`${API}/places/${id}/reviews`),
  rate: (id, stars, comment) => authRequest(`${API}/places/${id}/reviews/mine`, { method: 'PUT', body: { stars, comment } }),
  book: (id, body) => authRequest(`${API}/places/${id}/bookings`, { method: 'POST', body }),
  myBookings: () => authRequest(`${API}/bookings/mine`),
  cancelBooking: (id) => authRequest(`${API}/bookings/${id}/cancel`, { method: 'PUT', body: {} }),
  // Panel del establecimiento.
  mine: () => authRequest(`${API}/me`),
  saveMine: (body) => authRequest(`${API}/me`, { method: 'PUT', body }),
  myReviews: () => authRequest(`${API}/me/reviews`),
  reply: (reviewId, text) => authRequest(`${API}/me/reviews/${reviewId}/reply`, { method: 'PUT', body: { text } }),
  venueBookings: () => authRequest(`${API}/me/bookings`),
  confirm: (id, note) => authRequest(`${API}/me/bookings/${id}/confirm`, { method: 'PUT', body: { note } }),
  decline: (id, note) => authRequest(`${API}/me/bookings/${id}/decline`, { method: 'PUT', body: { note } }),
  // Solo administrador.
  adminPlaces: () => authRequest(`${API}/admin/places`),
  setFeatured: (id, featured, bannerUrl) => authRequest(`${API}/admin/places/${id}/featured`, { method: 'PUT', body: { featured, banner_url: bannerUrl } }),
};
