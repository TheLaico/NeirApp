import { Star } from 'lucide-react';
import { useState } from 'react';

/** Estrellas de solo lectura (admite medias: 4.5 pinta cuatro y media). */
export function Stars({ value = 0, size = 16, className = '' }) {
  return (
    <span className={`lg-stars ${className}`.trim()} role="img" aria-label={`${value.toLocaleString('es-CO')} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - n + 1));
        return (
          <span key={n} className="lg-star" style={{ width: size, height: size }}>
            <Star size={size} aria-hidden="true" className="lg-star-bg" />
            {fill > 0 && (
              <span className="lg-star-fill" style={{ width: `${fill * 100}%` }}>
                <Star size={size} aria-hidden="true" fill="currentColor" />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

const WORDS = ['', 'Malo', 'Regular', 'Bueno', 'Muy bueno', 'Excelente'];

/** Para calificar: cinco botones (con teclado también). */
export function StarsInput({ value, onChange, size = 30 }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className="lg-stars-input">
      <span role="radiogroup" aria-label="Calificación" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
            className={n <= shown ? 'on' : ''}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
          >
            <Star size={size} aria-hidden="true" fill={n <= shown ? 'currentColor' : 'none'} />
          </button>
        ))}
      </span>
      <small>{WORDS[shown]}</small>
    </span>
  );
}

/** "4,8 ★★★★★ (124 reseñas)" o "Sin reseñas aún". */
export function RatingLine({ hotel, size = 15 }) {
  if (!hotel.reviews_count) return <span className="lg-rating none">Sin reseñas aún</span>;
  return (
    <span className="lg-rating">
      <strong>{hotel.rating.toLocaleString('es-CO', { minimumFractionDigits: 1 })}</strong>
      <Stars value={hotel.rating} size={size} />
      <span>({hotel.reviews_count === 1 ? '1 reseña' : `${hotel.reviews_count} reseñas`})</span>
    </span>
  );
}
