import { useEffect, useState } from 'react';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Texto de ejemplo que se "escribe" y se borra solo, letra por letra, para usarlo como placeholder de un buscador
 * ("Busca pizza…", "Busca pan de queso…"). Mientras `active` es false (el usuario está escribiendo o el campo tiene
 * foco) se detiene. Con movimiento reducido devuelve el primer ejemplo, quieto.
 */
export function useTypingPlaceholder(examples, { prefix = '', active = true, fallback = '' } = {}) {
  const [text, setText] = useState('');
  const enabled = Boolean(examples?.length) && active && !reduceMotion();

  useEffect(() => {
    if (!enabled) return undefined;
    let index = 0;
    let length = 0;
    let deleting = false;
    let timer;
    const tick = () => {
      const word = examples[index % examples.length];
      if (!deleting) {
        length += 1;
        setText(word.slice(0, length));
        if (length >= word.length) {
          deleting = true;
          timer = setTimeout(tick, 1400); // se queda un momento escrito
          return;
        }
        timer = setTimeout(tick, 85);
      } else {
        length -= 1;
        setText(word.slice(0, length));
        if (length <= 0) {
          deleting = false;
          index += 1;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 40);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [enabled, examples]);

  if (!examples?.length) return fallback;
  if (!enabled) return reduceMotion() ? `${prefix}${examples[0]}` : fallback;
  return `${prefix}${text}`;
}
