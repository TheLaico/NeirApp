import { authRequest } from '../../services/auth.js';

const API = '/api/v1/professionals';

const query = (params) => {
  const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return q.toString() ? `?${q}` : '';
};

// Perfiles de profesionales (módulo `professionals` de la API).
export const professionalsApi = {
  mine: () => authRequest(`${API}/me`),
  saveMine: (body) => authRequest(`${API}/me`, { method: 'PUT', body }),
  list: ({ categoryId, subcategoryId } = {}) => authRequest(`${API}${query({ category_id: categoryId, subcategory_id: subcategoryId })}`),
  // Solo administrador.
  setFeatured: (userId, isFeatured) => authRequest(`${API}/${userId}/featured`, { method: 'PUT', body: { is_featured: isFeatured } }),
};
