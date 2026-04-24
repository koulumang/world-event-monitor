const URL = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson';

export async function fetchEarthquakes() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`USGS HTTP ${res.status}`);
  const data = await res.json();

  return data.features.map(f => ({
    lat:     f.geometry.coordinates[1],
    lon:     f.geometry.coordinates[0],
    depth:   f.geometry.coordinates[2],
    mag:     f.properties.mag ?? 0,
    place:   f.properties.place ?? 'Unknown location',
    time:    new Date(f.properties.time),
    tsunami: f.properties.tsunami === 1,
    sig:     f.properties.sig ?? 0,
    url:     f.properties.url,
  })).filter(e => e.mag > 0 && !isNaN(e.lat) && !isNaN(e.lon));
}
