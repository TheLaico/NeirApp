import { useEffect, useRef } from 'react';
import './cat-carousel.css';

// Cuántas veces se repite la fila de categorías dentro de la pasarela: de sobra para que, en cualquier
// ancho de pantalla, siempre quede contenido de más a los dos lados y el salto al reiniciar no se note.
const CAT_LOOPS = 6;

/**
 * Fila de categorías que se desliza sola hacia la izquierda y también se puede arrastrar con el mouse (o el dedo).
 * La usan el inicio y la barra superior del mapa. `cats`: [{ id, label, color, Icon }]; `activeId` marca la elegida.
 */
export default function CatCarousel({ cats, onSelect, activeId, className = '' }) {
  const trackRef = useRef(null);
  const unitRef = useRef(0);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const hovered = useRef(false);

  const wrap = () => {
    const track = trackRef.current;
    const unit = unitRef.current;
    if (!track || !unit) return;
    // El listado está repetido `CAT_LOOPS` veces: al acercarnos a cualquiera de las puntas saltamos
    // exactamente un "unit" (el ancho de una vuelta completa), que es invisible porque el patrón se repite.
    if (track.scrollLeft < unit) track.scrollLeft += unit;
    else if (track.scrollLeft > unit * (CAT_LOOPS - 1)) track.scrollLeft -= unit;
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    unitRef.current = track.scrollWidth / CAT_LOOPS;
    track.scrollLeft = unitRef.current * Math.floor(CAT_LOOPS / 2);

    let raf;
    const tick = () => {
      // Se detiene con el mouse encima (no solo al arrastrar): si la fila se sigue moviendo bajo el
      // cursor, el clic puede caer sobre la categoría vecina en vez de la que se veía al apuntar.
      if (!drag.current.active && !hovered.current) {
        track.scrollLeft += 0.5;
        wrap();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e) => {
    const track = trackRef.current;
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: track.scrollLeft, pointerId: e.pointerId };
    track.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    trackRef.current.scrollLeft = drag.current.startScroll - dx;
    wrap();
  };
  const endDrag = () => {
    drag.current.active = false;
    const track = trackRef.current;
    if (track?.hasPointerCapture(drag.current.pointerId)) track.releasePointerCapture(drag.current.pointerId);
  };
  // El clic se resuelve por coordenadas, no por a qué elemento "diga" el navegador que apuntó: con la fila
  // moviéndose (y la captura del arrastre de por medio) a veces el clic llega marcado como si hubiera caído
  // en el contenedor entero en vez de en el botón que de verdad está debajo del cursor en ese momento.
  const onClick = (e) => {
    if (drag.current.moved) return;
    const btn = e.target.closest('button[data-cat-id]') ?? document.elementFromPoint(e.clientX, e.clientY)?.closest('button[data-cat-id]');
    if (btn) onSelect(btn.dataset.catId);
  };

  const items = [];
  for (let loop = 0; loop < CAT_LOOPS; loop += 1) {
    cats.forEach((cat) => items.push({ ...cat, loop }));
  }

  return (
    <div
      className={`feed-cat-track ${className}`.trim()}
      ref={trackRef}
      role="group"
      aria-label="Categorías"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClick={onClick}
      onMouseEnter={() => { hovered.current = true; }}
      onMouseLeave={() => { hovered.current = false; }}
    >
      {items.map(({ id, label, color, Icon, loop }) => (
        <button
          key={`${loop}-${id}`}
          type="button"
          className={`feed-cat${id === activeId ? ' active' : ''}`}
          aria-pressed={activeId === undefined ? undefined : id === activeId}
          data-cat-id={id}
          tabIndex={loop === 0 ? 0 : -1}
          aria-hidden={loop === 0 ? undefined : true}
        >
          <span className="feed-cat-dot" style={{ background: color }}>
            <Icon size={22} color="#fff" aria-hidden="true" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
