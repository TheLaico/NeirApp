import { authRequest } from '../../services/auth.js';

const API = '/api/v1/suppliers';

// Proveedores: empresas de Neira que venden al por mayor (módulo `suppliers` de la API).
export const suppliersApi = {
  list: (category) => authRequest(`${API}${category ? `?category=${category}` : ''}`),
  get: (id) => authRequest(`${API}/${id}`),
  mine: () => authRequest(`${API}/me`),
  saveMine: (body) => authRequest(`${API}/me`, { method: 'PUT', body }),
};
