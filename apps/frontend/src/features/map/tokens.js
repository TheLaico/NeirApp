// Identidad visual de Neira (tomada de packages/design-tokens de la rama neirapp-architecture-plan).
export const colors = {
  brand: '#236B4A',
  brandDeep: '#174936',
  brandSoft: '#DCEBDD',
  terracotta: '#B6533C',
  panela: '#D9A441',
  cream: '#F8F5ED',
  ink: '#202724',
  muted: '#66736D',
  line: '#DDE3DE',
};

// Paleta del mapa: la misma de la app (crema, verde Neira, verde profundo, terracota y panela).
export const mapColors = {
  background: '#C3DDAF', // suelo verde suave: hace resaltar las casas claras
  water: '#B4D8D5',
  waterDeep: '#86BFBB',
  waterLine: '#D3EBE8',
  urban: '#F3EFE2',
  park: '#A8D093',
  parkEdge: '#8DBB8E',
  sport: '#D6E8C8',
  cemetery: '#DDE6D6',
  forest: '#6FA57F',
  grass: '#D3E6C8',
  farm: '#DCE8C6',
  track: '#C8B48A',
  boundary: '#236B4A',
  // Calles en gris carbón con un borde claro que las separa de la vegetación.
  roadCasing: '#F6F4E8',
  roadMinor: '#7F8884',
  roadMedium: '#6D7773',
  roadMajor: '#5C6662',
  roadMajorCasing: '#F6F4E8',
  path: '#98A09B',
  // Calle Real (peatonal): roja, del terracota de la marca, para que destaque como una vía principal.
  roadReal: '#B6533C',
  roadRealCasing: '#F6F4E8',
  roadRealLabelHalo: '#8A3A28',
  roadRealDash: '#F8F5ED',
  roadLabel: '#F8F5ED',
  roadLabelHalo: '#5C6662',
  // Casas en gris beige, más claras que las calles, para que resalten sobre el suelo verde.
  building: '#BEB7A4',
  buildingEdge: '#8F8671',
  buildingWarm: '#B4AC98',
  church: '#FFFBF1',
  churchRoof: '#B6533C',
  contour: '#4F8467',
  label: '#174936',
  labelWater: '#3E8A8C',
  halo: '#F8F5ED',
  // El resplandor de las calles principales solo se ve de noche (ver `mapColorsNight`); de día es invisible.
  roadGlow: 'rgba(0,0,0,0)',
};

/**
 * Paleta nocturna: fondo y vegetación oscuros, calles cálidas y brillantes como si tuvieran alumbrado
 * público. Se activa con la preferencia "Mapa nocturno automático" (ver SettingsContext) solo si además
 * es de noche (ver `isNightTime` en `theme.js`); por defecto el mapa siempre se ve de día.
 */
export const mapColorsNight = {
  background: '#101C15',
  water: '#0E3049',
  waterDeep: '#081F30',
  waterLine: '#2E5E78',
  urban: '#182018',
  park: '#16241A',
  parkEdge: '#0F1B13',
  sport: '#182618',
  cemetery: '#141F16',
  forest: '#122A19',
  grass: '#16281A',
  farm: '#1B2417',
  track: '#5C4E30',
  boundary: '#2E6B4C',
  roadCasing: '#070B08',
  // Entre más importante la vía, más brillante: como una ciudad real vista de noche, donde las avenidas
  // se notan más que las calles locales.
  roadMinor: '#9C8148',
  roadMedium: '#DDB76A',
  roadMajor: '#FCE3A0',
  roadMajorCasing: '#1C1509',
  path: '#4F5C51',
  roadReal: '#E8763F',
  roadRealCasing: '#20120A',
  roadRealLabelHalo: '#170B06',
  roadRealDash: '#2A1710',
  roadLabel: '#F3ECDB',
  roadLabelHalo: '#0E0B07',
  building: '#2C332C',
  buildingEdge: '#1A201A',
  buildingWarm: '#3A3A2E',
  church: '#5A5240',
  churchRoof: '#7A3A28',
  contour: '#274A38',
  label: '#DCEBDD',
  labelWater: '#7FC4CC',
  halo: '#0A0F0B',
  // Resplandor cálido bajo la Calle Real y las vías principales, como si las alumbrara el alumbrado público.
  roadGlow: 'rgba(240, 200, 119, 0.35)',
};

export const storeCategoryColors = {
  general: '#236B4A',
  restaurant: '#B6533C',
  supermarket: '#236B4A',
  pharmacy: '#4A7C8C',
  bakery: '#D9A441',
  cafe: '#7A5A3A',
};
