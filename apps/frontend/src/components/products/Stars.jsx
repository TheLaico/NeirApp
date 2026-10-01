import { Star } from 'lucide-react';
import { useId } from 'react';

/** Calificación con estrellas (admite media estrella). `value` de 0 a 5. */
export default function Stars({ value, size = 18 }) {
  const gradientId = useId();
  return (
    <span className="stars" role="img" aria-label={`${value.toFixed(1)} de 5 estrellas`}>
      <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id={gradientId}>
            <stop offset="50%" stopColor="#F2A81D" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          color="#F2A81D"
          fill={value >= n - 0.25 ? '#F2A81D' : value >= n - 0.75 ? `url(#${gradientId})` : 'none'}
        />
      ))}
    </span>
  );
}
