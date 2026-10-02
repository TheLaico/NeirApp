import { roleOf } from '../config/roles.js';

// Autenticación contra la API (/api/v1/identity). La sesión (usuario + tokens) se guarda en localStorage;
// `getSession` y `logout` siguen siendo síncronos para no tocar las pantallas.

const SESSION_KEY = 'neirapp.session';
const API = '/api/v1/identity';

// El rol de la interfaz sale de los roles reales del backend; DEVELOPER_EMAILS queda solo como respaldo de UI.
const uiRole = (email, roles = []) => (roles.includes('admin') ? 'admin' : roleOf(email));

const toUser = ({ id, email, full_name: name, phone, roles, must_accept_terms: mustAcceptTerms }) => ({
  id,
  email,
  name,
  phone,
  roles,
  mustAcceptTerms,
  role: uiRole(email, roles),
});

const readStored = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

const save = (user, tokens) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ user, tokens }));
  return user;
};

async function request(path, { method = 'GET', body, token } = {}) {
  let res;
  try {
    res = await fetch(path.startsWith('/api/') ? path : `${API}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Inténtalo de nuevo.');
  }
  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = Array.isArray(data?.errors) ? data.errors[0]?.msg : null;
    throw Object.assign(new Error(first || data?.detail || 'Ocurrió un error inesperado.'), {
      status: res.status,
      code: data?.code,
    });
  }
  return data;
}

/** Para endpoints públicos (sin sesión), con el mismo manejo de errores que el resto de la API. */
export const publicRequest = (path, options) => request(path, options);

export const getSession = () => {
  const stored = readStored();
  return stored?.user ? { ...stored.user, role: uiRole(stored.user.email, stored.user.roles) } : null;
};

/** Access token vigente para llamar endpoints protegidos (`Authorization: Bearer ...`). */
export const getAccessToken = () => readStored()?.tokens?.access_token ?? null;

export const logout = () => {
  const refresh = readStored()?.tokens?.refresh_token;
  localStorage.removeItem(SESSION_KEY);
  if (refresh) request('/logout', { method: 'POST', body: { refresh_token: refresh } }).catch(() => {});
};

const startSession = ({ user, tokens }) => save(toUser(user), tokens);

export async function register({ name, email, phone, password }) {
  // Los términos se aceptan con el envío del formulario; falta un checkbox explícito en RegisterPage.
  return startSession(
    await request('/register', {
      method: 'POST',
      body: {
        full_name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
        accepted_terms: true,
      },
    }),
  );
}

export async function login({ identifier, password }) {
  return startSession(
    await request('/login', { method: 'POST', body: { email: identifier.trim().toLowerCase(), password } }),
  );
}

let refreshing = null;

// Renueva los tokens con el refresh token. Se comparte la promesa para no gastar el mismo refresh dos veces.
function refreshTokens() {
  refreshing ??= (async () => {
    const stored = readStored();
    if (!stored?.tokens?.refresh_token) throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
    const data = await request('/refresh', { method: 'POST', body: { refresh_token: stored.tokens.refresh_token } });
    save(toUser(data.user), data.tokens);
    return data.tokens;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Llama a un endpoint protegido (ruta de identidad, o `/api/...` completa); si el access token expiró, renueva la sesión y reintenta una vez. */
export async function authRequest(path, options = {}) {
  const attempt = (tokens) => request(path, { ...options, token: tokens?.access_token });
  try {
    return await attempt(readStored()?.tokens);
  } catch (err) {
    if (err.status !== 401) throw err;
    let tokens;
    try {
      tokens = await refreshTokens();
    } catch {
      localStorage.removeItem(SESSION_KEY);
      window.location.assign('/');
      throw new Error('Tu sesión expiró. Inicia sesión de nuevo.');
    }
    return attempt(tokens);
  }
}

export async function updateProfile(_id, { name, phone }) {
  const profile = await authRequest('/me', { method: 'PATCH', body: { full_name: name.trim(), phone: phone.trim() } });
  return save(toUser(profile), readStored()?.tokens);
}

/** Cambia la contraseña. La API cierra las demás sesiones y entrega tokens nuevos para seguir conectado aquí. */
export async function changePassword({ current, next }) {
  const data = await authRequest('/me/password', { method: 'POST', body: { current_password: current, new_password: next } });
  return save(toUser(data.user), data.tokens);
}
