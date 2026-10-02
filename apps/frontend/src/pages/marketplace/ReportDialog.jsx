import { CheckCircle2, Flag, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { marketplaceApi } from '../../features/marketplace/api.js';
import { REPORT_REASONS } from '../../features/marketplace/model.js';

/**
 * Reportar una publicación inadecuada: se elige el motivo (y, si es "Otro", se cuenta qué pasa). Al enviarlo se
 * agradece y se avisa que el equipo la revisará; a los administradores les llega una notificación.
 */
export default function ReportDialog({ listing, onClose }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const box = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    box.current?.querySelector('input')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    if (!reason) {
      setError('Elige el motivo del reporte.');
      return;
    }
    if (reason === 'other' && details.trim().length < 5) {
      setError('Cuéntanos qué pasa con esta publicación.');
      return;
    }
    setSending(true);
    setError('');
    try {
      const { message } = await marketplaceApi.report(listing.id, reason, details.trim());
      setDone(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mq-scrim" onClick={onClose}>
      <div ref={box} className="mq-dialog" role="dialog" aria-modal="true" aria-labelledby="mq-report-title" onClick={(e) => e.stopPropagation()}>
        <div className="mq-dialog-head">
          <h2 id="mq-report-title">{done ? '¡Gracias por avisarnos!' : 'Reportar publicación'}</h2>
          <button type="button" className="mq-close" aria-label="Cerrar" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {done ? (
          <div className="mq-done">
            <CheckCircle2 size={52} aria-hidden="true" />
            <p>{done}</p>
            <button type="button" className="mq-btn primary" onClick={onClose}>
              Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <p className="mq-muted">
              ¿Qué pasa con <b>“{listing.title}”</b>? Tu reporte es anónimo: el vendedor no sabrá quién lo envió.
            </p>
            <fieldset className="mq-reasons">
              <legend className="mq-sr">Motivo</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.id} className={reason === r.id ? 'on' : ''}>
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} />
                  {r.label}
                </label>
              ))}
            </fieldset>
            <label className="mq-field">
              <span>
                Cuéntanos más <span className="mq-optional">{reason === 'other' ? '' : '(opcional)'}</span>
              </span>
              <textarea rows={3} maxLength={500} value={details} placeholder="Ej: pide el pago por adelantado y no muestra el inmueble" onChange={(e) => setDetails(e.target.value)} />
            </label>
            {error && (
              <p className="mq-error" role="alert">
                {error}
              </p>
            )}
            <div className="mq-dialog-actions">
              <button type="button" className="mq-btn ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="mq-btn danger" disabled={sending}>
                {sending ? <Loader2 size={17} className="mq-spin" aria-hidden="true" /> : <Flag size={17} aria-hidden="true" />} Enviar reporte
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
