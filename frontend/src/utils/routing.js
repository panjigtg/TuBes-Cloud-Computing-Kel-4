/**
 * OSRM Routing utilities.
 * Uses the free public OSRM server (no API key, OpenStreetMap based).
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetch a driving route between two coordinates from OSRM.
 *
 * @param {{latitude:number, longitude:number}} origin
 * @param {{latitude:number, longitude:number}} destination
 * @returns {Promise<{coordinates: Array<{latitude:number, longitude:number}>, steps: Array, distance:number, duration:number}>}
 */
export async function fetchRoute(origin, destination) {
  const url =
    `${OSRM_BASE}/${origin.longitude},${origin.latitude};` +
    `${destination.longitude},${destination.latitude}` +
    `?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM request failed: ${res.status}`);
  }
  const data = await res.json();

  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }

  const route = data.routes[0];

  // GeoJSON coordinates are [lng, lat] — convert to {latitude, longitude}
  const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
    latitude: lat,
    longitude: lng,
  }));

  const steps = (route.legs?.[0]?.steps || []).map((step) => ({
    coordinate: {
      latitude: step.maneuver.location[1],
      longitude: step.maneuver.location[0],
    },
    type: step.maneuver.type,
    modifier: step.maneuver.modifier,
    distance: step.distance,
    name: step.name || '',
    instruction: buildInstruction(step.maneuver, step.distance, step.name),
  }));

  return {
    coordinates,
    steps,
    distance: route.distance, // meters
    duration: route.duration, // seconds
  };
}

/**
 * Build a human-readable Indonesian instruction from an OSRM maneuver.
 */
export function buildInstruction(maneuver, distance, name) {
  const { type, modifier } = maneuver;
  const road = name ? ` ke ${name}` : '';
  const dist =
    distance >= 1000
      ? `${(distance / 1000).toFixed(1)} km`
      : `${Math.round(distance)} m`;

  switch (type) {
    case 'depart':
      return 'Mulai perjalanan';
    case 'arrive':
      return 'Anda telah tiba di tujuan';
    case 'turn':
    case 'end of road':
    case 'fork':
    case 'continue':
      return `${turnText(modifier)} dalam ${dist}${road}`;
    case 'roundabout':
    case 'rotary':
      return `Masuk bundaran dalam ${dist}`;
    case 'merge':
      return `Bergabung ${turnText(modifier)} dalam ${dist}`;
    default:
      return `Lanjut ${dist}${road}`;
  }
}

/**
 * Map an OSRM modifier to Indonesian turn text.
 */
export function turnText(modifier) {
  switch (modifier) {
    case 'left':
      return 'Belok kiri';
    case 'right':
      return 'Belok kanan';
    case 'slight left':
      return 'Belok sedikit ke kiri';
    case 'slight right':
      return 'Belok sedikit ke kanan';
    case 'sharp left':
      return 'Belok tajam ke kiri';
    case 'sharp right':
      return 'Belok tajam ke kanan';
    case 'straight':
      return 'Lurus';
    case 'uturn':
      return 'Putar balik';
    default:
      return 'Lurus';
  }
}

/**
 * Map an OSRM maneuver to a MaterialCommunityIcons name.
 */
export function maneuverIcon(type, modifier) {
  if (type === 'arrive') return 'map-marker-check';
  if (type === 'depart') return 'arrow-up-bold';
  switch (modifier) {
    case 'left':
      return 'arrow-top-left-bold';
    case 'right':
      return 'arrow-top-right-bold';
    case 'slight left':
      return 'arrow-top-left';
    case 'slight right':
      return 'arrow-top-right';
    case 'sharp left':
      return 'arrow-left-bold';
    case 'sharp right':
      return 'arrow-right-bold';
    case 'straight':
      return 'arrow-up-bold';
    case 'uturn':
      return 'backup-restore';
    default:
      return 'arrow-up-bold';
  }
}

/**
 * Format a duration in seconds to a readable Indonesian string.
 */
export function formatDuration(seconds) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} menit`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours} jam ${rem} menit` : `${hours} jam`;
}
