import { useEffect, useState } from 'react';
import './map-ambience.css';

// Momento del día según la hora local: cambia el tono de luz sobre el mapa.
const phaseOf = (hour) => {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 16) return 'day';
  if (hour >= 16 && hour < 18) return 'golden';
  if (hour >= 18 && hour < 19) return 'dusk';
  return 'night';
};

/** Capa decorativa encima del mapa: textura de papel, luz del día, sombras de nubes y créditos. */
export default function MapAmbience() {
  const [phase, setPhase] = useState(() => phaseOf(new Date().getHours()));

  useEffect(() => {
    const id = setInterval(() => setPhase(phaseOf(new Date().getHours())), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={`ambience phase-${phase}`} aria-hidden="true">
      <div className="amb-light" />
      <div className="amb-cloud c1" />
      <div className="amb-cloud c2" />
      <div className="amb-cloud c3" />
      <div className="amb-vignette" />
      <div className="amb-grain" />
      <p className="amb-credits">
        © colaboradores de OpenStreetMap · Relieve: Mapzen y NASA SRTM · Vegetación ilustrada
      </p>
    </div>
  );
}
