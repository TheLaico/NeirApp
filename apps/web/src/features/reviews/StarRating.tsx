import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
}

/**
 * Muestra 5 estrellas; si recibe `onChange` se vuelve interactiva (para calificar). La raíz es un
 * `<span>` (no `<div>`) a propósito: los usos en `StorePage`/`StoreReviewsSection` lo anidan
 * dentro de un `<p>`/`<span>`, y un `<div>` ahí rompe el parseo de HTML (React lo marca como error
 * de hidratación) — se encontró probando la app real en el navegador.
 */
export function StarRating({ value, onChange, size = 18 }: StarRatingProps) {
  const interactive = !!onChange;
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role={interactive ? "radiogroup" : undefined}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!interactive}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
          aria-pressed={interactive ? n <= value : undefined}
          onClick={() => onChange?.(n)}
          className={interactive ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            size={size}
            fill={n <= value ? "currentColor" : "none"}
            className={n <= value ? "text-panela" : "text-line"}
            aria-hidden="true"
          />
        </button>
      ))}
    </span>
  );
}
