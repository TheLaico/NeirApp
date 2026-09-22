/**
 * URL base de la API, siempre absoluta.
 *
 * Se usa el origen actual por defecto en vez de una cadena vacía: aunque un navegador real
 * resuelve `fetch("/api/...")` contra `document.baseURI`, el `Request` de Node (usado por
 * openapi-fetch y por los tests con Vitest) exige una URL absoluta y lanza si es relativa.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
