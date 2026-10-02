import { useEffect, useRef } from 'react';
import './cat-carousel.css';

// Cuántas veces se repite la fila de categorías dentro de la pasarela: de sobra para que, en cualquier
// ancho de pantalla (aunque una vuelta sea más angosta que la pantalla, como en el mapa con 4 categorías),
// siempre quede contenido de más a los dos lados y el salto al reiniciar no se note.
const CAT_LOOPS = 12;

/**
 * Fila de categorías que se desliza sola hacia la izquierda y también se puede arrastrar con el mouse (o el dedo).
 * La usan el inicio y la barra superior del mapa. `cats`: [{ id, label, color, Icon }]; `activeId` marca la elegida.
 */
export default function CatCarousel({ cats, onSelect, activeId, className = '' }) {
  const trackRef = useRef(null);
  const unitRef = useRef(0);
  const drag = useRef({ active: false, moved: false, startX: 0, startScroll: 0 });
  const hovered = useRef(false);
  // Posición con decimales llevada aparte: `scrollLeft` se redondea a píxeles enteros en muchas pantallas
  // (p. ej. Windows al 100 %), así que sumarle medio píxel por cuadro se perdía en el redondeo y la fila
  // quedaba quieta "sin razón" según en qué posición estuviera.
  const pos = useRef(0);

  // El listado está repetido `CAT_LOOPS` veces: al acercarnos a cualquiera de las puntas saltamos
  // exactamente un "unit" (el ancho de una vuelta completa), que es invisible porque el patrón se repite.
  // El salto de la derecha se hace antes del tope real de desplazamiento: si la pantalla es más ancha que una
  // vuelta, `scrollLeft` no puede llegar a `unit * (CAT_LOOPS - 1)` y la fila se quedaba quieta en el tope.
  const wrap = () => {
    const unit = unitRef.current;
    const track = trackRef.current;
    if (!unit || !track) return;
    const max = Math.min(unit * (CAT_LOOPS - 1), track.scrollWidth - track.clientWidth - 1);
    if (pos.current < unit) pos.current += unit;
    else if (pos.current > max) pos.current -= unit;
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    // El ancho de una vuelta cambia si cargan las fuentes o cambia el tamaño de la ventana: se vuelve a medir.
    const measure = () => {
      const unit = track.scrollWidth / CAT_LOOPS;
      if (!unit) return;
      const offset = unitRef.current ? (pos.current % unitRef.current) / unitRef.current : 0;
      unitRef.current = unit;
      pos.current = unit * Math.floor(CAT_LOOPS / 2) + offset * unit;
      track.scrollLeft = pos.current;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);

    let raf;
    let last = performance.now();
    const SPEED = 30; // píxeles por segundo, igual en pantallas de 60 Hz que de 120 Hz
    const tick = (now) => {
      const dt = Math.min(now - last, 100) / 1000; // tras volver a la pestaña no da un salto
      last = now;
      // Se detiene con el mouse encima (no solo al arrastrar): si la fila se sigue moviendo bajo el
      // cursor, el clic puede caer sobre la categoría vecina en vez de la que se veía al apuntar.
      if (!drag.current.active && !hovered.current && unitRef.current) {
        pos.current += SPEED * dt;
        wrap();
        track.scrollLeft = pos.current;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  const onPointerDown = (e) => {
    const track = trackRef.current;
    drag.current = { active: true, moved: false, startX: e.clientX, startScroll: pos.current, pointerId: e.pointerId };
    track.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    pos.current = drag.current.startScroll - dx;
    wrap();
    trackRef.current.scrollLeft = pos.current;
    // Si la fila dio la vuelta durante el arrastre, el punto de partida se corre lo mismo para seguir al dedo.
    drag.current.startScroll = pos.current + dx;
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
      onLostPointerCapture={endDrag}
      onClick={onClick}
      // Solo con mouse: en el celular un toque también dispara "entrar" pero nunca "salir", y la fila
      // se quedaba pausada para siempre después de tocarla.
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') hovered.current = true; }}
      onPointerLeave={() => { hovered.current = false; }}
      // Rueda del mouse o deslizar con el trackpad mueven la fila por su cuenta: se sigue desde ahí.
      onScroll={(e) => {
        if (Math.abs(e.currentTarget.scrollLeft - pos.current) > 2) pos.current = e.currentTarget.scrollLeft;
      }}
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
