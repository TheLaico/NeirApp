import { authRequest, getAccessToken } from '../../services/auth.js';

const ENDPOINT = '/api/v1/uploads/images';
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1280; // las fotos de celular son enormes: se reducen antes de subirlas
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Reduce una foto grande a ~1280 px de lado mayor (JPEG). Si algo falla, devuelve el archivo original. */
async function shrink(file) {
  try {
    if (file.type === 'image/webp' && file.size < 400 * 1024) return file;
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 900 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Sube una foto y devuelve su URL (`/api/v1/uploads/images/…`) para guardarla en la tienda o el producto. */
export async function uploadImage(file) {
  if (!TYPES.includes(file.type)) throw new Error('Elige una foto JPG, PNG o WebP.');
  const body = await shrink(file);
  if (body.size > MAX_BYTES) throw new Error('La foto pesa demasiado (máximo 10 MB).');

  // Renueva el token si venció antes de mandar el archivo (el cuerpo no es JSON, así que no pasa por authRequest).
  await authRequest('/api/v1/identity/me');
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': body.type || file.type, Authorization: `Bearer ${getAccessToken()}` },
      body,
    });
  } catch {
    throw new Error('No se pudo subir la foto. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'No se pudo subir la foto.');
  return data.url;
}

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Sube un PDF (certificados de profesionales) y devuelve su URL (`/api/v1/uploads/documents/…`). */
export async function uploadDocument(file) {
  if (file.type !== 'application/pdf') throw new Error('Elige un archivo PDF.');
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('El documento pesa demasiado (máximo 10 MB).');
  await authRequest('/api/v1/identity/me'); // renueva el token si venció (ver uploadImage)
  let res;
  try {
    res = await fetch('/api/v1/uploads/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf', Authorization: `Bearer ${getAccessToken()}` },
      body: file,
    });
  } catch {
    throw new Error('No se pudo subir el documento. Revisa tu conexión.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || 'No se pudo subir el documento.');
  return data.url;
}

/** Sube un certificado: PDF tal cual, o foto (se reduce como cualquier imagen). */
export const uploadCertificateFile = (file) => (file.type === 'application/pdf' ? uploadDocument(file) : uploadImage(file));
