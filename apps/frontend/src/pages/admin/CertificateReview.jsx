import { CheckCircle2, ExternalLink, FileText, Loader2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { professionalsApi } from '../../features/professionals/api.js';
import { isPdf, issuerLine, kindOf } from '../../features/professionals/certificates.js';

const day = (iso) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

/**
 * "Certificados por revisar": el admin abre el archivo y lo aprueba o lo rechaza con el motivo (el profesional lo ve
 * en su panel). Solo los aprobados aparecen en el perfil público, con el sello de verificado.
 */
export default function CertificateReview({ onReviewed }) {
  const [state, setState] = useState({ list: [], loading: true, error: '' });
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // id del que se está rechazando
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setState({ list: await professionalsApi.pendingCertificates(), loading: false, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (certificate, approve) => {
    setError('');
    setBusyId(certificate.id);
    try {
      await professionalsApi.reviewCertificate(certificate.id, approve, approve ? '' : note);
      setState((s) => ({ ...s, list: s.list.filter((c) => c.id !== certificate.id) }));
      setRejecting(null);
      setNote('');
      onReviewed?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="a-card">
      <h2>Certificados por revisar {state.list.length > 0 && <span className="a-count">{state.list.length}</span>}</h2>
      <p className="a-card-hint">Abre cada archivo y confirma que el nombre coincide con el del profesional. Solo los aprobados se ven en su perfil.</p>
      {error && (
        <p className="a-err" role="alert">
          {error}
        </p>
      )}
      {state.loading ? (
        <p className="a-empty">Cargando…</p>
      ) : state.error ? (
        <p className="a-err" role="alert">
          {state.error}
        </p>
      ) : state.list.length === 0 ? (
        <p className="a-empty">No hay certificados pendientes. 🎉</p>
      ) : (
        <ul className="a-store-list">
          {state.list.map((c) => {
            const { Icon, label } = kindOf(c.kind);
            const busy = busyId === c.id;
            return (
              <li key={c.id} className="a-store a-cert">
                <div className="a-store-row">
                  <span className="a-store-icon" style={{ background: '#0f5238' }}>
                    <Icon size={20} color="#fff" aria-hidden="true" />
                  </span>
                  <div className="a-store-info">
                    <strong>{c.title}</strong>
                    <span>
                      {c.professional_name || 'Profesional sin perfil'} · {label}
                      {issuerLine(c) && ` · ${issuerLine(c)}`} · enviado el {day(c.updated_at)}
                    </span>
                  </div>
                  <a className="a-btn ghost" href={c.file_url} target="_blank" rel="noreferrer">
                    {isPdf(c.file_url) ? <FileText size={16} aria-hidden="true" /> : <ExternalLink size={16} aria-hidden="true" />}
                    Ver {isPdf(c.file_url) ? 'PDF' : 'foto'}
                  </a>
                  <button type="button" className="a-btn primary" disabled={busy} onClick={() => review(c, true)}>
                    {busy && rejecting !== c.id ? <Loader2 size={16} className="a-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
                    Aprobar
                  </button>
                  <button
                    type="button"
                    className="a-btn danger-ghost"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(rejecting === c.id ? null : c.id);
                      setNote('');
                    }}
                  >
                    <XCircle size={16} aria-hidden="true" /> Rechazar
                  </button>
                </div>
                {rejecting === c.id && (
                  <form
                    className="a-reject"
                    onSubmit={(e) => {
                      e.preventDefault();
                      review(c, false);
                    }}
                  >
                    <label htmlFor={`reject-${c.id}`}>Motivo (lo verá el profesional)</label>
                    <input id={`reject-${c.id}`} value={note} maxLength={200} placeholder="Ej: El documento está borroso, súbelo de nuevo con mejor luz" onChange={(e) => setNote(e.target.value)} autoFocus />
                    <button type="submit" className="a-btn danger" disabled={busy || note.trim().length < 5}>
                      Enviar rechazo
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
