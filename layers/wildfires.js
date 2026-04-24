const URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&days=7&status=open&limit=200';

export async function fetchWildfires() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`EONET HTTP ${res.status}`);
  const data = await res.json();
  return parseEONET(data.events);
}

function parseEONET(events) {
  return events.flatMap(evt => {
    const geo = evt.geometry?.[evt.geometry.length - 1];
    if (!geo || geo.type !== 'Point') return [];
    const [lon, lat] = geo.coordinates;
    if (isNaN(lat) || isNaN(lon)) return [];
    return [{
      lat,
      lon,
      title: evt.title,
      date:  new Date(geo.date),
      acres: geo.magnitudeValue ?? null,
      unit:  geo.magnitudeUnit ?? '',
    }];
  });
}
