// GDACS — Global Disaster Alert and Coordination System (EU + UN backed).
// Worldwide coverage: earthquakes, tropical cyclones, floods, volcanoes, droughts, wildfires.
// No API key. Returns GeoJSON FeatureCollection.
// Docs: https://www.gdacs.org/
const URL = 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP';

// Skip Green (low) alerts to reduce noise — keep Orange + Red only
const KEEP_ALERTS = new Set(['Orange', 'Red']);

const TYPE_LABEL = {
  EQ: 'Earthquake',
  TC: 'Tropical Cyclone',
  FL: 'Flood',
  VO: 'Volcano',
  DR: 'Drought',
  WF: 'Wildfire',
};

export async function fetchGDACS() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`GDACS HTTP ${res.status}`);
  const data = await res.json();
  return parse(data.features || []);
}

function parse(features) {
  const items = [];
  for (const f of features) {
    const p = f.properties || {};
    if (!KEEP_ALERTS.has(p.alertlevel)) continue;

    const geom = f.geometry;
    if (!geom || geom.type !== 'Point') continue;
    const [lon, lat] = geom.coordinates;
    if (isNaN(lat) || isNaN(lon)) continue;

    const typeLabel = TYPE_LABEL[p.eventtype] || p.eventtype || 'Event';
    const name = p.eventname || p.name || typeLabel;

    items.push({
      lat,
      lon,
      title: `${typeLabel}: ${name}`,
      eventType: p.eventtype,
      alertLevel: p.alertlevel,
      country: p.country || '',
      severity: p.severitydata?.severitytext || '',
      score:    p.alertscore ?? null,
      date:     p.fromdate ? new Date(p.fromdate) : new Date(),
    });
  }
  return items;
}
