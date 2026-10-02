import { Loader2, MessageSquareReply, Pencil } from 'lucide-react';
import { useState } from 'react';
import { venuesApi } from '../../features/venues/api.js';
import { ReviewItem } from '../lodging/LodgingPage.jsx';
import { Stars } from '../lodging/Stars.jsx';

/** Reseñas del lugar: la calificación y responder (o editar la respuesta) a cada cliente. */
export default function ReviewsView({ venue: hotel, reviews, onChange, onGo }) {
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  if (!hotel) {
    return (
      <div className="spp-view">
        <div className="spp-head">
          <h1>Reseñas</h1>
        </div>
        <button type="button" className="spp-banner warn" onClick={() => onGo('venue')}>
          <span>Primero crea la ficha de tu lugar.</span>
        </button>
      </div>
    );
  }

  const shown = filter === 'pending' ? reviews.filter((r) => !r.reply) : reviews;
  const save = async (r, value) => {
    setBusy(true);
    setError('');
    try {
      onChange(await venuesApi.reply(r.id, value));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="spp-view">
      <div className="spp-head">
        <h1>Reseñas</h1>
        <p>Lo que dicen tus clientes en Reservas. Responder con amabilidad (también a las críticas) da confianza a quien está decidiendo dónde quedarse.</p>
      </div>
      <div className="htp-score">
        <strong>{hotel.reviews_count ? hotel.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 }) : '—'}</strong>
        <div>
          <Stars value={hotel.rating} size={20} />
          <span>{hotel.reviews_count === 1 ? '1 reseña' : `${hotel.reviews_count} reseñas`}</span>
        </div>
        <div className="htp-tabs small" role="tablist">
          <button type="button" role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Todas
          </button>
          <button type="button" role="tab" aria-selected={filter === 'pending'} className={filter === 'pending' ? 'on' : ''} onClick={() => setFilter('pending')}>
            Sin responder {reviews.some((r) => !r.reply) && <span>{reviews.filter((r) => !r.reply).length}</span>}
          </button>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="sp-empty">{reviews.length ? '¡Respondiste todas tus reseñas!' : 'Todavía no tienes reseñas. Cuando tus clientes te califiquen, aparecerán aquí.'}</p>
      ) : (
        <ul className="htp-reviews">
          {shown.map((r) => (
            <li key={r.id} className="htp-review">
              <ReviewItem review={editing === r.id ? { ...r, reply: '' } : r} hotelName={hotel.name} />
              {editing === r.id ? (
                <form
                  className="htp-answer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (text.trim().length < 2) return setError('Escribe tu respuesta.');
                    save(r, text.trim());
                  }}
                >
                  <textarea rows={3} maxLength={500} value={text} autoFocus placeholder={`Responde a ${r.author_name.split(' ')[0]}…`} onChange={(e) => setText(e.target.value)} />
                  {error && (
                    <p className="sp-error" role="alert">
                      {error}
                    </p>
                  )}
                  <div className="htp-res-actions">
                    {r.reply && (
                      <button type="button" className="sp-btn danger small" disabled={busy} onClick={() => save(r, '')}>
                        Borrar respuesta
                      </button>
                    )}
                    <button type="button" className="sp-btn outline small" onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                    <button type="submit" className="sp-btn primary small" disabled={busy}>
                      {busy && <Loader2 size={15} className="sp-spin" aria-hidden="true" />} Publicar respuesta
                    </button>
                  </div>
                </form>
              ) : (
                <div className="htp-res-actions">
                  <button type="button" className={`sp-btn small ${r.reply ? 'outline' : 'primary'}`} onClick={() => (setEditing(r.id), setText(r.reply), setError(''))}>
                    {r.reply ? <Pencil size={15} aria-hidden="true" /> : <MessageSquareReply size={15} aria-hidden="true" />} {r.reply ? 'Editar respuesta' : 'Responder'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
