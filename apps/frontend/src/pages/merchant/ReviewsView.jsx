import { Loader2, MessageSquareReply, Star } from 'lucide-react';
import { useState } from 'react';
import { usePolled } from '../../features/courier/api.js';
import { reviewsApi } from '../../features/reviews/api.js';
import { timeAgo } from '../../lib/time.js';

function StarRow({ value, size = 16 }) {
  return (
    <span className="cr-stars" role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= value ? 'currentColor' : 'none'} aria-hidden="true" />
      ))}
    </span>
  );
}

/** Una reseña con su respuesta: el dueño puede responder y luego editar lo que escribió. */
function ReviewCard({ review, onChanged }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.merchant_reply ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (text.trim().length < 2) return setError('Escribe tu respuesta (mínimo 2 letras).');
    setError('');
    setSaving(true);
    try {
      await reviewsApi.reply(review.id, text.trim());
      await onChanged();
      setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="cr-card">
      <div className="cr-card-head">
        <StarRow value={review.rating} />
        <small className="cr-muted">{timeAgo(review.created_at)}</small>
      </div>
      {review.comment ? <p>{review.comment}</p> : <p className="cr-muted">El cliente no dejó comentario.</p>}

      {review.merchant_reply && !open && (
        <div className="cr-reply">
          <strong>Tu respuesta</strong>
          {review.merchant_reply}
        </div>
      )}

      {open ? (
        <form className="cr-form" onSubmit={send} noValidate>
          <textarea
            className="cr-textarea"
            rows={3}
            maxLength={500}
            value={text}
            placeholder="Agradece, pide disculpas o explica lo que pasó. Tu respuesta es pública."
            aria-label="Tu respuesta a la reseña"
            onChange={(e) => setText(e.target.value)}
          />
          {error && (
            <p className="cr-error" role="alert">
              {error}
            </p>
          )}
          <div className="cr-actions">
            <button type="button" className="cr-btn ghost sm" disabled={saving} onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="cr-btn primary sm" disabled={saving}>
              {saving && <Loader2 size={16} className="cr-spin" aria-hidden="true" />}
              Publicar respuesta
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="cr-link-btn" onClick={() => setOpen(true)}>
          <MessageSquareReply size={16} aria-hidden="true" style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
          {review.merchant_reply ? 'Editar respuesta' : 'Responder'}
        </button>
      )}
    </li>
  );
}

/** Calificaciones de la tienda: promedio, cuántas hay de cada nota y cada reseña para responderla. */
export default function ReviewsView({ store }) {
  const load = async () => ({ summary: await reviewsApi.summary(store.id), reviews: await reviewsApi.list(store.id) });
  const { data, error, loading, refresh } = usePolled(load, { every: 30000 });
  const [onlyPending, setOnlyPending] = useState(false);

  if (loading) return <p className="cr-empty">Cargando calificaciones…</p>;
  if (error && !data) {
    return (
      <p className="cr-error" role="alert">
        {error}
      </p>
    );
  }

  const { summary, reviews } = data;
  const counts = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
  const unanswered = reviews.filter((r) => !r.merchant_reply).length;
  const shown = onlyPending ? reviews.filter((r) => !r.merchant_reply) : reviews;

  if (reviews.length === 0) {
    return (
      <div className="cr-state">
        <Star size={44} aria-hidden="true" />
        <h1>Aún no tienes calificaciones</h1>
        <p>Cuando un cliente califique un pedido entregado, aparecerá aquí y podrás responderle.</p>
      </div>
    );
  }

  return (
    <>
      <section className="cr-card">
        <div className="cr-card-head">
          <div>
            <strong style={{ fontSize: 30 }}>{summary.average.toFixed(1)}</strong>
            <StarRow value={Math.round(summary.average)} size={18} />
          </div>
          <span className="cr-chip">
            {summary.count} {summary.count === 1 ? 'calificación' : 'calificaciones'}
          </span>
        </div>
        <div className="cr-bars">
          {counts.map(({ n, count }) => (
            <div key={n} className="cr-bar-row">
              <span>{n}★</span>
              <span className="cr-bar-track">
                <span className="cr-bar-fill" style={{ display: 'block', width: `${(count / reviews.length) * 100}%` }} />
              </span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="cr-chips">
        <button type="button" className={onlyPending ? '' : 'on'} onClick={() => setOnlyPending(false)}>
          Todas ({reviews.length})
        </button>
        <button type="button" className={onlyPending ? 'on' : ''} onClick={() => setOnlyPending(true)}>
          Sin responder ({unanswered})
        </button>
      </div>

      {shown.length === 0 && <p className="cr-empty">¡Respondiste todas las reseñas!</p>}
      <ul className="cr-list">
        {shown.map((r) => (
          <ReviewCard key={r.id} review={r} onChanged={refresh} />
        ))}
      </ul>
    </>
  );
}
