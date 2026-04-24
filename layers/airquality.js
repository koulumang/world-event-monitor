// WAQI (World Air Quality Index) — free token from https://aqicn.org/data-platform/token/
// Replace with your own token for production. The "demo" token works for low traffic.
const TOKEN = 'demo';

const BOUNDS = [
  { name: 'Global-1', latlng: '-60,-180,75,-60' },
  { name: 'Global-2', latlng: '-60,-60,75,60'   },
  { name: 'Global-3', latlng: '-60,60,75,180'   },
];

export async function fetchAirQuality() {
  const results = await Promise.allSettled(
    BOUNDS.map(b =>
      fetch(`https://api.waqi.info/map/bounds/?latlng=${b.latlng}&token=${TOKEN}`)
        .then(r => r.json())
    )
  );

  const stations = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const data = r.value;
    if (data.status !== 'ok' || !Array.isArray(data.data)) continue;
    data.data.forEach(s => {
      const aqi = Number(s.aqi);
      if (isNaN(aqi) || aqi <= 100) return; // only show unhealthy+
      if (isNaN(s.lat) || isNaN(s.lon)) return;
      stations.push({
        lat:  s.lat,
        lon:  s.lon,
        aqi,
        name: s.station?.name ?? 'Unknown station',
        time: s.station?.time ? new Date(s.station.time) : new Date(),
        url:  s.station?.url ?? '',
      });
    });
  }

  return stations;
}
