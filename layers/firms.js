// NASA FIRMS — Fire Information for Resource Management System
// Real-time satellite fire/thermal-anomaly detections (VIIRS, ~375m resolution).
//
// Key is loaded from ../config.js (gitignored). See config.example.js for setup.
import { FIRMS_MAP_KEY as MAP_KEY } from '../config.js';

const SOURCE    = 'VIIRS_SNPP_NRT'; // highest-resolution near-real-time source
const DAY_RANGE = 1;                 // 1–10 days
const AREA      = 'world';
const MIN_FRP   = 10;                // Fire Radiative Power (MW) — filter noise
const MAX_POINTS = 1200;             // global cap to keep map performant

const URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/${SOURCE}/${AREA}/${DAY_RANGE}`;

export async function fetchFIRMS() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const csv = await res.text();
  return parseCSV(csv);
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const idx = {
    lat:        headers.indexOf('latitude'),
    lon:        headers.indexOf('longitude'),
    frp:        headers.indexOf('frp'),
    bright:     headers.indexOf('bright_ti4'),
    confidence: headers.indexOf('confidence'),
    date:       headers.indexOf('acq_date'),
    time:       headers.indexOf('acq_time'),
    daynight:   headers.indexOf('daynight'),
    sat:        headers.indexOf('satellite'),
  };

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const lat = parseFloat(cols[idx.lat]);
    const lon = parseFloat(cols[idx.lon]);
    const frp = parseFloat(cols[idx.frp]);
    if (isNaN(lat) || isNaN(lon) || isNaN(frp)) continue;
    if (frp < MIN_FRP) continue;
    if (cols[idx.confidence] === 'l') continue; // drop low-confidence

    // FIRMS time is HHMM UTC (e.g. "1342"), date is YYYY-MM-DD
    const rawTime = (cols[idx.time] || '0000').padStart(4, '0');
    const iso = `${cols[idx.date]}T${rawTime.slice(0, 2)}:${rawTime.slice(2, 4)}:00Z`;

    items.push({
      lat,
      lon,
      frp,
      title:      `Active fire (${frp.toFixed(0)} MW) @ ${lat.toFixed(2)}, ${lon.toFixed(2)}`,
      bright:     parseFloat(cols[idx.bright]) || null,
      confidence: cols[idx.confidence] || '',
      daynight:   cols[idx.daynight]   || '',
      satellite:  cols[idx.sat]        || '',
      date:       new Date(iso),
    });
  }

  // Keep the most intense detections if we blow the cap
  items.sort((a, b) => b.frp - a.frp);
  return items.slice(0, MAX_POINTS);
}
