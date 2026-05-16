import coords from './airportCoords.json';

export function getCoords(icao) {
  if (!icao) return null;
  const c = coords[icao.toUpperCase().trim()];
  return c ? { lat: c[0], lon: c[1] } : null;
}
