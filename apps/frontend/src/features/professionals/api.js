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
  myServices: () => authRequest(`${API}/me/services`),
  addService: (body) => authRequest(`${API}/me/services`, { method: 'POST', body }),
  updateService: (id, body) => authRequest(`${API}/me/services/${id}`, { method: 'PUT', body }),
  deleteService: (id) => authRequest(`${API}/me/services/${id}`, { method: 'DELETE' }),
  services: (userId) => authRequest(`${API}/${userId}/services`),
  get: (userId) => authRequest(`${API}/${userId}`),
  list: ({ categoryId, subcategoryId } = {}) => authRequest(`${API}${query({ category_id: categoryId, subcategory_id: subcategoryId })}`),
  categories: () => authRequest(`${API}/categories`),
  // Solo administrador.
  createCategory: (body) => authRequest(`${API}/categories`, { method: 'POST', body }),
  deleteCategory: (id) => authRequest(`${API}/categories/${id}`, { method: 'DELETE' }),
  addSubcategory: (categoryId, body) => authRequest(`${API}/categories/${categoryId}/subcategories`, { method: 'POST', body }),
  setSubcategoryColor: (categoryId, subId, color) =>
    authRequest(`${API}/categories/${categoryId}/subcategories/${subId}/color`, { method: 'PUT', body: { color } }),
  deleteSubcategory: (categoryId, subId) => authRequest(`${API}/categories/${categoryId}/subcategories/${subId}`, { method: 'DELETE' }),
  setFeatured: (userId, isFeatured) => authRequest(`${API}/${userId}/featured`, { method: 'PUT', body: { is_featured: isFeatured } }),
};
