// NOAA / National Weather Service — active severe weather alerts (US + territories).
// No API key needed. CORS-enabled. Returns GeoJSON FeatureCollection.
// Docs: https://www.weather.gov/documentation/services-web-api
const URL = 'https://api.weather.gov/alerts/active?status=actual&message_type=alert';

// Filter out the noisiest low-severity noise (statements, minor advisories)
const KEEP_SEVERITY = new Set(['Extreme', 'Severe', 'Moderate']);

export async function fetchNWS() {
  const res = await fetch(URL, {
    headers: { 'Accept': 'application/geo+json' },
  });
  if (!res.ok) throw new Error(`NWS HTTP ${res.status}`);
  const data = await res.json();
  return parseAlerts(data.features || []);
}

function parseAlerts(features) {
  const items = [];
  for (const f of features) {
    const p = f.properties || {};
    if (!KEEP_SEVERITY.has(p.severity)) continue;

    const center = centroid(f.geometry);
    if (!center) continue; // many alerts have null geometry (UGC-coded only) — skip

    items.push({
      lat: center[1],
      lon: center[0],
      title: p.event || 'Weather Alert',
      headline: p.headline || '',
      area: p.areaDesc || '',
      severity: p.severity || 'Unknown',
      urgency:  p.urgency  || 'Unknown',
      certainty: p.certainty || 'Unknown',
      sender: p.senderName || 'NWS',
      date: p.effective ? new Date(p.effective) : new Date(),
      expires: p.expires ? new Date(p.expires) : null,
    });
  }
  return items;
}

function centroid(geom) {
  if (!geom) return null;
  const coords = flattenRings(geom);
  if (!coords.length) return null;
  let x = 0, y = 0;
  for (const [lon, lat] of coords) { x += lon; y += lat; }
  return [x / coords.length, y / coords.length];
}

function flattenRings(geom) {
  // Handles Polygon, MultiPolygon — uses outer ring(s) for centroid
  if (geom.type === 'Polygon')      return geom.coordinates[0] || [];
  if (geom.type === 'MultiPolygon') return geom.coordinates.flatMap(poly => poly[0] || []);
  if (geom.type === 'Point')        return [geom.coordinates];
  return [];
}
