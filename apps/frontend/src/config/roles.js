// Roles de la app.
//
// ⚠ Esto es solo un control de interfaz: con el login simulado en el navegador cualquiera puede registrarse
// con cualquier correo. Los permisos reales (crear tiendas, aprobarlas) los tiene que validar el backend
// con el rol del usuario autenticado; este archivo solo decide qué se muestra en pantalla.

/** Correos con rol de desarrollador (acceso al panel de administrador). */
export const DEVELOPER_EMAILS = ['rbx5640@gmail.com'];

export const ROLES = {
  developer: 'Desarrollador',
  customer: 'Cliente',
  courier: 'Repartidor',
  store_staff: 'Comerciante',
  professional: 'Profesional',
};

export const roleOf = (email = '') => (DEVELOPER_EMAILS.includes(email.trim().toLowerCase()) ? 'developer' : 'customer');

/** ¿Puede entrar al panel de administrador? */
export const canAccessAdmin = (user) => user?.role === 'developer' || user?.role === 'admin';
