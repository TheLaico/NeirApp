import { AlertCircle, CheckCircle2, Clock, ExternalLink, EyeOff, FileText, Loader2, Paperclip, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { uploadCertificateFile } from '../../features/media/api.js';
import { professionalsApi } from '../../features/professionals/api.js';
import {
  CERTIFICATE_KINDS,
  FILE_TYPES,
  MAX_CERTIFICATES,
  STATUS,
  emptyCertificate,
  fromApi,
  isPdf,
  issuerLine,
  kindOf,
  toApi,
  validateCertificate,
} from '../../features/professionals/certificates.js';

const ERROR_FIELDS = { invalid_certificate_title: 'title', invalid_certificate_year: 'year', invalid_certificate_file: 'file' };

/**
 * "Certificados": títulos, tarjeta profesional, especializaciones y cursos. Cada uno lo revisa el equipo de NeirAPP;
 * los verificados (y que el profesional decida mostrar) aparecen en su perfil con el sello de verificado.
 */
export default function CertificatesView() {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [editing, setEditing] = useState(null); // null, 'new' o el id que se edita
  const [notice, setNotice] = useState({ text: '', bad: false });
  const { list } = state;

  const load = useCallback(async () => {
    try {
      const data = await professionalsApi.myCertificates();
      setState({ list: data.map(fromApi), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (c) => setState((s) => ({ ...s, list: s.list.map((x) => (x.id === c.id ? c : x)) }));

  const onSaved = (certificate, isNew, previousStatus) => {
    setState((s) => ({ ...s, list: isNew ? [certificate, ...s.list] : s.list.map((x) => (x.id === certificate.id ? certificate : x)) }));
    setEditing(null);
    const backToReview = !isNew && previousStatus !== 'pending' && certificate.status === 'pending';
    setNotice({
      text: isNew
        ? `“${certificate.title}” quedó en revisión. Te avisaremos cuando el equipo de NeirAPP lo apruebe.`
        : backToReview
          ? 'Cambios guardados. Como cambiaste el certificado, vuelve a revisión.'
          : 'Cambios guardados.',
      bad: false,
    });
  };

  const toggleShow = async (c) => {
    const next = { ...c, showOnProfile: !c.showOnProfile };
    replace(next);
    try {
      replace(fromApi(await professionalsApi.updateCertificate(c.id, toApi(next))));
    } catch (err) {
      replace(c);
      setNotice({ text: err.message, bad: true });
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`¿Eliminar “${c.title}”?`)) return;
    try {
      await professionalsApi.deleteCertificate(c.id);
      setState((s) => ({ ...s, list: s.list.filter((x) => x.id !== c.id) }));
    } catch (err) {
      setNotice({ text: err.message, bad: true });
    }
  };

  const counts = { verified: 0, pending: 0, rejected: 0 };
  list.forEach((c) => (counts[c.status] += 1));
  const full = list.length >= MAX_CERTIFICATES;

  return (
    <div className="ct">
      <div className="sv-head">
        <div>
          <h1>Certificados</h1>
          <p>Sube tu título, tarjeta profesional y cursos. El equipo de NeirAPP los revisa y, cuando están verificados, tu perfil muestra el sello de profesional verificado.</p>
        </div>
        {editing !== 'new' && list.length > 0 && (
          <button type="button" className="cr-btn primary sv-add" disabled={full} onClick={() => setEditing('new')}>
            <Plus size={18} aria-hidden="true" /> Agregar certificado
          </button>
        )}
      </div>

      {list.length > 0 && (
        <div className="ct-summary">
          <span className="ct-chip verified">
            <CheckCircle2 size={15} aria-hidden="true" /> {counts.verified} {counts.verified === 1 ? 'verificado' : 'verificados'}
          </span>
          {counts.pending > 0 && (
            <span className="ct-chip pending">
              <Clock size={15} aria-hidden="true" /> {counts.pending} en revisión
            </span>
          )}
          {counts.rejected > 0 && (
            <span className="ct-chip rejected">
              <AlertCircle size={15} aria-hidden="true" /> {counts.rejected} por corregir
            </span>
          )}
        </div>
      )}

      {notice.text && (
        <p className={`sv-notice${notice.bad ? ' bad' : ''}`} role="status">
          {notice.text}
        </p>
      )}

      {state.loading ? (
        <p className="cr-empty">Cargando…</p>
      ) : state.error ? (
        <div className="cr-state">
          <p className="cr-error" role="alert">
            {state.error}
          </p>
          <button type="button" className="cr-btn ghost" onClick={load}>
            Reintentar
          </button>
        </div>
      ) : (
        <>
          {editing === 'new' && <CertificateForm key="new" onCancel={() => setEditing(null)} onSaved={(c) => onSaved(c, true)} />}

          {list.length === 0 && editing !== 'new' ? (
            <section className="sv-empty">
              <span className="sv-empty-ico">
                <ShieldCheck size={34} aria-hidden="true" />
              </span>
              <h2>Gana la confianza de tus clientes</h2>
              <p>Los perfiles con certificados verificados muestran el sello de NeirAPP. Empieza con tu título o tu tarjeta profesional, en PDF o en una foto clara.</p>
              <button type="button" className="cr-btn primary" onClick={() => setEditing('new')}>
                <Plus size={18} aria-hidden="true" /> Agregar mi primer certificado
              </button>
            </section>
          ) : (
            <ul className="ct-list">
              {list.map((c) => {
                if (editing === c.id) {
                  return (
                    <li key={c.id}>
                      <CertificateForm initial={c} onCancel={() => setEditing(null)} onSaved={(saved) => onSaved(saved, false, c.status)} />
                    </li>
                  );
                }
                const { Icon, label } = kindOf(c.kind);
                const status = STATUS[c.status];
                return (
                  <li key={c.id} className={`ct-item ${status.tone}`}>
                    <span className="ct-ico">
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <div className="ct-main">
                      <div className="ct-top">
                        <strong>{c.title}</strong>
                        <span className={`ct-status ${status.tone}`}>
                          {c.status === 'verified' ? <CheckCircle2 size={14} aria-hidden="true" /> : c.status === 'pending' ? <Clock size={14} aria-hidden="true" /> : <AlertCircle size={14} aria-hidden="true" />}
                          {status.label}
                        </span>
                      </div>
                      <p className="ct-kind">
                        {label}
                        {issuerLine(c) && ` · ${issuerLine(c)}`}
                      </p>
                      {c.status === 'rejected' && c.reviewNote && (
                        <p className="ct-note">
                          <b>Motivo:</b> {c.reviewNote}
                          {/[.!?]$/.test(c.reviewNote) ? '' : '.'} Corrígelo y vuelve a enviarlo con el botón de editar.
                        </p>
                      )}
                      {c.status === 'pending' && <p className="ct-help">{status.help}</p>}
                      <div className="ct-links">
                        <a href={c.fileUrl} target="_blank" rel="noreferrer">
                          {isPdf(c.fileUrl) ? <FileText size={15} aria-hidden="true" /> : <Paperclip size={15} aria-hidden="true" />}
                          Ver {isPdf(c.fileUrl) ? 'PDF' : 'foto'} <ExternalLink size={13} aria-hidden="true" />
                        </a>
                        {!c.showOnProfile && (
                          <span className="sv-hidden-tag">
                            <EyeOff size={14} aria-hidden="true" /> No se muestra en tu perfil
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sv-item-actions">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={c.showOnProfile}
                        aria-label={`${c.title}: ${c.showOnProfile ? 'se muestra en tu perfil' : 'oculto'}`}
                        title={c.showOnProfile ? 'Se muestra en tu perfil (cuando esté verificado)' : 'Oculto en tu perfil'}
                        className={`a-switch${c.showOnProfile ? ' on' : ''}`}
                        onClick={() => toggleShow(c)}
                      >
                        <span />
                      </button>
                      <button type="button" className="sv-icon" aria-label={`Editar ${c.title}`} onClick={() => setEditing(c.id)}>
                        <Pencil size={17} aria-hidden="true" />
                      </button>
                      <button type="button" className="sv-icon danger" aria-label={`Eliminar ${c.title}`} onClick={() => remove(c)}>
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <aside className="sv-tip">
            <ShieldCheck size={20} aria-hidden="true" />
            <p>
              Los documentos solo los ve el equipo de NeirAPP mientras se revisan. Cuando estén verificados, los clientes ven el nombre del título y la institución, y pueden abrir el archivo
              si decides mostrarlo. <b>Tapa tu número de cédula</b> antes de subir la foto si no quieres que se vea.
            </p>
          </aside>
        </>
      )}
    </div>
  );
}

/** Formulario para agregar o editar un certificado: sube el archivo (PDF o foto) y guarda los datos. */
function CertificateForm({ initial, onCancel, onSaved }) {
  const [draft, setDraft] = useState(initial ?? emptyCertificate());
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const fileInput = useRef(null);
  const isNew = !initial;
  const prefix = initial?.id ?? 'new';
  const kind = kindOf(draft.kind);

  const update = (patch) => {
    setServerError('');
    setDraft((d) => ({ ...d, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k === 'fileUrl' ? 'file' : k]);
      return next;
    });
  };

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!FILE_TYPES.includes(file.type)) {
      setErrors((x) => ({ ...x, file: 'Elige un PDF o una foto JPG, PNG o WebP.' }));
      return;
    }
    setUploading(true);
    setErrors((x) => ({ ...x, file: undefined }));
    try {
      const url = await uploadCertificateFile(file);
      setFileName(file.name);
      update({ fileUrl: url });
    } catch (err) {
      setErrors((x) => ({ ...x, file: err.message }));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validateCertificate(draft);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(`ct-${prefix}-${first}`)?.focus();
    setSaving(true);
    try {
      const body = toApi(draft);
      const saved = isNew ? await professionalsApi.addCertificate(body) : await professionalsApi.updateCertificate(initial.id, body);
      onSaved(fromApi(saved));
    } catch (err) {
      const key = ERROR_FIELDS[err.code];
      if (key) setErrors({ [key]: err.message });
      else setServerError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="sv-form" onSubmit={submit} noValidate>
      <div className="sv-form-head">
        <h2>{isNew ? 'Nuevo certificado' : 'Editar certificado'}</h2>
        <button type="button" className="sv-icon" aria-label="Cancelar" onClick={onCancel}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {!isNew && initial.status === 'verified' && <p className="ct-warn">Si cambias el tipo, el nombre, la institución, el año o el archivo, vuelve a revisión.</p>}

      <fieldset className="sv-price-field">
        <legend>Tipo</legend>
        <div className="ct-kinds" role="radiogroup" aria-label="Tipo de certificado">
          {CERTIFICATE_KINDS.map(({ key, label, Icon }) => (
            <button key={key} type="button" role="radio" aria-checked={draft.kind === key} className={draft.kind === key ? 'on' : ''} onClick={() => update({ kind: key })}>
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label>
        Nombre del título o certificado
        <input id={`ct-${prefix}-title`} value={draft.title} maxLength={100} placeholder={kind.example} aria-invalid={Boolean(errors.title)} onChange={(e) => update({ title: e.target.value })} autoFocus />
        {errors.title && <small className="pf-error">{errors.title}</small>}
      </label>

      <div className="sv-form-row ct-row">
        <label>
          <span>
            Institución <span className="sv-optional">(opcional)</span>
          </span>
          <input value={draft.issuer} maxLength={100} placeholder="Ej: Universidad de Caldas" onChange={(e) => update({ issuer: e.target.value })} />
        </label>
        <label>
          <span>
            Año <span className="sv-optional">(opcional)</span>
          </span>
          <input id={`ct-${prefix}-year`} inputMode="numeric" maxLength={4} value={draft.year} placeholder="2018" aria-invalid={Boolean(errors.year)} onChange={(e) => update({ year: e.target.value.replace(/\D/g, '').slice(0, 4) })} />
          {errors.year && <small className="pf-error">{errors.year}</small>}
        </label>
      </div>

      <div className="ct-file">
        <span className="ct-file-label">Archivo</span>
        <div className={`ct-file-box${draft.fileUrl ? ' has' : ''}${errors.file ? ' bad' : ''}`}>
          {draft.fileUrl && !isPdf(draft.fileUrl) ? (
            <img src={draft.fileUrl} alt="" />
          ) : (
            <span className="ct-file-ico">{uploading ? <Loader2 size={24} className="cr-spin" aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}</span>
          )}
          <span className="ct-file-text">
            <strong>{uploading ? 'Subiendo…' : draft.fileUrl ? fileName || (isPdf(draft.fileUrl) ? 'Documento PDF' : 'Foto del certificado') : 'Sin archivo'}</strong>
            <small>PDF o foto (JPG, PNG o WebP), hasta 10 MB.</small>
            {draft.fileUrl && (
              <a href={draft.fileUrl} target="_blank" rel="noreferrer">
                Ver archivo <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </span>
          <button id={`ct-${prefix}-file`} type="button" className="cr-btn ghost sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
            <Paperclip size={16} aria-hidden="true" /> {draft.fileUrl ? 'Cambiar' : 'Adjuntar'}
          </button>
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={pickFile} />
        </div>
        {errors.file && <small className="pf-error">{errors.file}</small>}
      </div>

      <div className="sv-visible">
        <span>
          <strong>Mostrar en mi perfil</strong>
          <small>Cuando esté verificado, los clientes lo verán en tu perfil.</small>
        </span>
        <button type="button" role="switch" aria-checked={draft.showOnProfile} aria-label="Mostrar en mi perfil" className={`a-switch${draft.showOnProfile ? ' on' : ''}`} onClick={() => update({ showOnProfile: !draft.showOnProfile })}>
          <span />
        </button>
      </div>

      {serverError && (
        <p className="pf-error" role="alert">
          {serverError}
        </p>
      )}
      <div className="sv-form-actions">
        <button type="button" className="cr-btn ghost" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="cr-btn primary" disabled={saving || uploading}>
          {saving && <Loader2 size={18} className="cr-spin" aria-hidden="true" />}
          {isNew ? 'Enviar a revisión' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
