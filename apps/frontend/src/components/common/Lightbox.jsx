import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect } from 'react';
import './lightbox.css';

/**
 * Visor de fotos a pantalla completa. `images` = [{ id, url, caption }], `index` la que se muestra;
 * `onIndex(n)` cambia de foto y `onClose()` lo cierra. Se maneja con flechas del teclado y Escape.
 */
export default function Lightbox({ images, index, onIndex, onClose }) {
  const image = images[index];
  const many = images.length > 1;
  const go = (step) => onIndex((index + step + images.length) % images.length);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && many) onIndex((index + 1) % images.length);
      else if (e.key === 'ArrowLeft' && many) onIndex((index - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, images.length, many, onIndex, onClose]);

  if (!image) return null;

  return (
    <div className="lb" role="dialog" aria-modal="true" aria-label="Foto ampliada" onClick={onClose}>
      <button type="button" className="lb-btn lb-close" aria-label="Cerrar" onClick={onClose}>
        <X size={24} aria-hidden="true" />
      </button>
      {many && (
        <button
          type="button"
          className="lb-btn lb-prev"
          aria-label="Foto anterior"
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
        >
          <ChevronLeft size={28} aria-hidden="true" />
        </button>
      )}
      <figure className="lb-figure" onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.caption || `Foto ${index + 1}`} />
        <figcaption>
          {image.caption && <span>{image.caption}</span>}
          {many && (
            <small>
              {index + 1} de {images.length}
            </small>
          )}
        </figcaption>
      </figure>
      {many && (
        <button
          type="button"
          className="lb-btn lb-next"
          aria-label="Foto siguiente"
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
        >
          <ChevronRight size={28} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
