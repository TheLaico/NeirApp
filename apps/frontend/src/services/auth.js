import { roleOf } from '../config/roles.js';

// Autenticación simulada en el navegador (localStorage).
// Cuando exista el backend, basta con reemplazar el cuerpo de estas funciones
// por llamadas a la API; las pantallas no necesitan cambios.

const USERS_KEY = 'neirapp.users';
const SESSION_KEY = 'neirapp.session';

const readUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY)) ?? [];
  } catch {
    return [];
  }
};

const hash = async (text) => {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

// El rol no se guarda: se calcula siempre a partir del correo, así un cambio en config/roles.js aplica de inmediato.
const publicUser = ({ passwordHash, ...user }) => ({ ...user, role: roleOf(user.email) });

const startSession = (user) => {
  const safe = publicUser(user);
  localStorage.setItem(SESSION_KEY, JSON.stringify(safe));
  return safe;
};

export const getSession = () => {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return session ? { ...session, role: roleOf(session.email) } : null;
  } catch {
    return null;
  }
};

export const logout = () => localStorage.removeItem(SESSION_KEY);

export async function register({ name, email, phone, password }) {
  const users = readUsers();
  const mail = email.trim().toLowerCase();

  if (users.some((u) => u.email === mail)) {
    throw new Error('Ya existe una cuenta con ese correo electrónico.');
  }

  const user = {
    id: crypto.randomUUID(),
    name: name.trim(),
    email: mail,
    phone: phone.trim(),
    passwordHash: await hash(password),
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
  return startSession(user);
}

export async function login({ identifier, password }) {
  const id = identifier.trim().toLowerCase();
  const user = readUsers().find((u) => u.email === id || u.name.toLowerCase() === id);

  if (!user || user.passwordHash !== (await hash(password))) {
    throw new Error('Correo/usuario o contraseña incorrectos.');
  }
  return startSession(user);
}

export async function updateProfile(id, { name, phone }) {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) throw new Error('No se encontró tu cuenta.');

  users[index] = { ...users[index], name: name.trim(), phone: phone.trim() };
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return startSession(users[index]);
}
