import { Mic, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTypingPlaceholder } from '../../lib/useTypingPlaceholder.js';
import CatCarousel from './CatCarousel.jsx';
import './hero-search.css';

// ¿El navegador sabe transcribir voz? (Chrome/Edge sí; Firefox y Safari todavía no lo traen).
const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * Buscador grande del inicio y del mapa: píldora blanca con micrófono, sobre el fondo de montañas (`heroImage` de
 * AppShell), y debajo la pasarela de categorías de borde a borde. `examples` hace que el buscador vacío "escriba"
 * ejemplos solo; `results` se muestra flotando justo debajo de la píldora (accesos directos del mapa).
 */
export default function HeroSearch({
  value,
  onChange,
  placeholder = '¿Qué estás buscando?',
  ariaLabel = 'Buscar',
  examples,
  results,
  cats,
  activeCat,
  onSelectCat,
  className = '',
}) {
  const [listening, setListening] = useState(false);
  const [focused, setFocused] = useState(false);
  const recognitionRef = useRef(null);
  const typed = useTypingPlaceholder(examples, { prefix: 'Busca ', active: !value && !focused, fallback: placeholder });
  const shownPlaceholder = examples?.length && !value && !focused && typed !== placeholder ? `${typed}|` : placeholder;

  useEffect(() => () => recognitionRef.current?.stop(), []);

  const toggleVoiceSearch = () => {
    if (!SpeechRecognition) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (e) => onChange(e.results[0][0].transcript);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return (
    <section className={`feed-hero ${className}`.trim()}>
      <div className="feed-search-box">
        <label className="feed-search">
          <Search size={20} aria-hidden="true" />
          <input
            type="search"
            placeholder={shownPlaceholder}
            aria-label={ariaLabel}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button
            type="button"
            className={`feed-mic${listening ? ' listening' : ''}`}
            aria-label="Buscar por voz"
            aria-pressed={listening}
            title={SpeechRecognition ? (listening ? 'Escuchando…' : 'Buscar por voz') : 'Tu navegador no admite búsqueda por voz'}
            disabled={!SpeechRecognition}
            onClick={toggleVoiceSearch}
          >
            <Mic size={20} aria-hidden="true" />
          </button>
        </label>
        {results}
      </div>

      {cats && (
        <div className="feed-cats-wrap">
          <CatCarousel cats={cats} activeId={activeCat} onSelect={onSelectCat} />
        </div>
      )}
    </section>
  );
}
