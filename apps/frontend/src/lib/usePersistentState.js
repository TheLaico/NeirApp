import { useEffect, useState } from 'react';

/** Como useState, pero guarda el valor en localStorage (sin romperse si el almacenamiento no está disponible). */
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      /* se usa el valor inicial */
    }
    return typeof initial === 'function' ? initial() : initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* el valor vive solo en memoria */
    }
  }, [key, value]);

  return [value, setValue];
}
