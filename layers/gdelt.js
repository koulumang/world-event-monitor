const PROXY = 'https://api.allorigins.win/get?url=';

const CRIME_QUERY = 'attack+shooting+bombing+conflict+violence+war+protest+riot+killing+arrest';
const DISEASE_QUERY = 'outbreak+epidemic+disease+virus+infection+pandemic+cholera+dengue+ebola';

async function fetchGDELTQuery(query, timespan = 1440, maxrows = 250) {
  const endpoint =
    `https://api.gdeltproject.org/api/v2/geo/geo` +
    `?query=${query}&mode=PointData&format=GeoJSON&TIMESPAN=${timespan}&MAXROWS=${maxrows}`;

  // Try direct first (works sometimes depending on CORS headers)
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.features) return parseGDELT(data.features);
    }
  } catch { /* fall through to proxy */ }

  // CORS proxy fallback
  const proxied = await fetch(PROXY + encodeURIComponent(endpoint), {
    signal: AbortSignal.timeout(15000),
  });
  if (!proxied.ok) throw new Error(`Proxy HTTP ${proxied.status}`);
  const wrapper = await proxied.json();
  const data = JSON.parse(wrapper.contents);
  if (!data?.features) return [];
  return parseGDELT(data.features);
}

function parseGDELT(features) {
  return features
    .filter(f => f.geometry?.coordinates?.length === 2)
    .map(f => ({
      lat:    f.geometry.coordinates[1],
      lon:    f.geometry.coordinates[0],
      name:   f.properties?.name ?? 'Unknown location',
      counts: f.properties?.counts ?? 1,
      date:   f.properties?.urldate ? parseGDELTDate(f.properties.urldate) : new Date(),
      url:    f.properties?.url ?? '',
    }))
    .filter(e => !isNaN(e.lat) && !isNaN(e.lon));
}

function parseGDELTDate(str) {
  // Format: "20260423T140000Z"
  try {
    return new Date(
      str.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z')
    );
  } catch { return new Date(); }
}

export async function fetchGDELT() {
  return fetchGDELTQuery(CRIME_QUERY, 1440, 250);
}

export async function fetchDisease() {
  return fetchGDELTQuery(DISEASE_QUERY, 2880, 100);
}
