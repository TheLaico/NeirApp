import { Award, BadgeCheck, BookOpen, FileText, GraduationCap } from 'lucide-react';

// Certificados del profesional (títulos, tarjeta profesional, cursos). Mismos límites que la API
// (apps/api/.../professionals/domain/certificates.py).

export const CERTIFICATE_KINDS = [
  { key: 'degree', label: 'Título profesional', Icon: GraduationCap, example: 'Ej: Médico cirujano' },
  { key: 'license', label: 'Tarjeta o registro profesional', Icon: BadgeCheck, example: 'Ej: Tarjeta profesional de medicina' },
  { key: 'specialization', label: 'Especialización o posgrado', Icon: Award, example: 'Ej: Especialista en pediatría' },
  { key: 'course', label: 'Curso o diplomado', Icon: BookOpen, example: 'Ej: Diplomado en primeros auxilios' },
  { key: 'other', label: 'Otro', Icon: FileText, example: 'Ej: Certificado de experiencia' },
];
export const kindOf = (key) => CERTIFICATE_KINDS.find((k) => k.key === key) ?? CERTIFICATE_KINDS[4];

export const STATUS = {
  pending: { label: 'En revisión', tone: 'pending', help: 'El equipo de NeirAPP lo está revisando. Suele tardar 1 a 2 días hábiles.' },
  verified: { label: 'Verificado', tone: 'verified', help: 'Aprobado por NeirAPP.' },
  rejected: { label: 'No aprobado', tone: 'rejected', help: '' },
};

export const MAX_CERTIFICATES = 20;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const thisYear = new Date().getFullYear();

export const isPdf = (url) => /\.pdf$/i.test(url ?? '');

export const emptyCertificate = () => ({ kind: 'degree', title: '', issuer: '', year: '', fileUrl: '', showOnProfile: true });

export const fromApi = (c) => ({
  id: c.id,
  kind: c.kind,
  title: c.title,
  issuer: c.issuer,
  year: c.year == null ? '' : String(c.year),
  fileUrl: c.file_url,
  showOnProfile: c.show_on_profile,
  status: c.status,
  reviewNote: c.review_note,
});

export const toApi = (d) => ({
  kind: d.kind,
  title: d.title.trim(),
  issuer: d.issuer.trim(),
  year: d.year === '' ? null : Number(d.year),
  file_url: d.fileUrl,
  show_on_profile: d.showOnProfile,
});

export function validateCertificate(d) {
  const errors = {};
  const title = d.title.trim();
  if (title.length < 3 || title.length > 100) errors.title = 'Escribe el nombre del título o certificado (entre 3 y 100 caracteres).';
  if (d.year !== '' && !(Number(d.year) >= 1950 && Number(d.year) <= thisYear + 1)) errors.year = `Escribe un año entre 1950 y ${thisYear + 1}.`;
  if (!d.fileUrl) errors.file = 'Adjunta el certificado en PDF o una foto.';
  return errors;
}

/** "Universidad de Caldas · 2015". */
export const issuerLine = (c) => [c.issuer, c.year].filter(Boolean).join(' · ');
