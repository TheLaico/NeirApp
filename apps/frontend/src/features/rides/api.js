import { authRequest } from '../../services/auth.js';

const API = '/api/v1/rides';

// Transporte: motocarros en tiempo real (módulo `rides` de la API).
export const ridesApi = {
  // Cliente.
  live: () => authRequest(`${API}/drivers/live`),
  request: (body) => authRequest(API, { method: 'POST', body }),
  current: () => authRequest(`${API}/current`),
  get: (id) => authRequest(`${API}/${id}`),
  mine: () => authRequest(`${API}/mine`),
  cancel: (id) => authRequest(`${API}/${id}/cancel`, { method: 'PUT', body: {} }),
  shareLocation: (id, lat, lng) => authRequest(`${API}/${id}/location`, { method: 'PUT', body: { lat, lng } }),
  rate: (id, stars, comment) => authRequest(`${API}/${id}/rate`, { method: 'PUT', body: { stars, comment } }),
  // Conductor.
  me: () => authRequest(`${API}/driver/me`),
  saveMe: (body) => authRequest(`${API}/driver/me`, { method: 'PUT', body }),
  setOnline: (online) => authRequest(`${API}/driver/status`, { method: 'PUT', body: { online } }),
  locate: (lat, lng) => authRequest(`${API}/driver/location`, { method: 'PUT', body: { lat, lng } }),
  requests: () => authRequest(`${API}/driver/requests`),
  driverCurrent: () => authRequest(`${API}/driver/current`),
  earnings: (period = 'today') => authRequest(`${API}/driver/earnings?period=${period}`),
  accept: (id) => authRequest(`${API}/${id}/accept`, { method: 'POST', body: {} }),
  arrived: (id) => authRequest(`${API}/${id}/arrived`, { method: 'PUT', body: {} }),
  start: (id) => authRequest(`${API}/${id}/start`, { method: 'PUT', body: {} }),
  complete: (id) => authRequest(`${API}/${id}/complete`, { method: 'PUT', body: {} }),
};
