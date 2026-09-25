/** Validación del formulario de registro. Devuelve un objeto { campo: mensaje } (vacío si todo está bien). */
export function validateRegistration(v) {
  const e = {};
  if (v.name.trim().length < 3) e.name = 'Ingresa tu nombre completo.';
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Ingresa un correo válido.';
  if (v.phone.replace(/\D/g, '').length < 7) e.phone = 'Ingresa un número de celular válido.';
  if (v.password.length < 6) e.password = 'La contraseña debe tener al menos 6 caracteres.';
  if (v.confirm !== v.password) e.confirm = 'Las contraseñas no coinciden.';
  return e;
}
