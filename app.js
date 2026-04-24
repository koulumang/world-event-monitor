import { fetchEarthquakes } from './layers/earthquakes.js';
import { fetchWildfires }   from './layers/wildfires.js';
import { fetchVolcanoes }   from './layers/volcanoes.js';
import { fetchStorms }      from './layers/storms.js';
import { fetchFloods }      from './layers/floods.js';
import { fetchGDELT, fetchDisease } from './layers/gdelt.js';
import { fetchAirQuality }  from './layers/airquality.js';

// ── Layer registry ────────────────────────────────────────────────
const LAYERS = [
  { key: 'crime',       label: 'Crime / Conflict', color: '#FF1744', fetch: fetchGDELT,       refresh: 900_000,  render: renderGDELT       },
  { key: 'disease',     label: 'Disease / Outbreak',color: '#AA00FF', fetch: fetchDisease,     refresh: 1_800_000,render: renderGDELT       },
  { key: 'earthquakes', label: 'Earthquakes',       color: '#FF6B00', fetch: fetchEarthquakes, refresh: 60_000,   render: renderEarthquakes },
  { key: 'wildfires',   label: 'Wildfires',         color: '#FFD700', fetch: fetchWildfires,   refresh: 300_000,  render: renderEONET       },
  { key: 'volcanoes',   label: 'Volcanoes',         color: '#C62828', fetch: fetchVolcanoes,   refresh: 300_000,  render: renderEONET       },
  { key: 'storms',      label: 'Severe Storms',     color: '#00E5FF', fetch: fetchStorms,      refresh: 300_000,  render: renderStorms      },
  { key: 'floods',      label: 'Floods',            color: '#1565C0', fetch: fetchFloods,      refresh: 300_000,  render: renderEONET       },
  { key: 'airquality',  label: 'Air Quality',       color: '#00E676', fetch: fetchAirQuality,  refresh: 600_000,  render: renderAirQuality  },
];

// ── State ─────────────────────────────────────────────────────────
const layerGroups  = {};
const layerEnabled = {};
const layerData    = {};
const feedItems    = [];

// ── Map init ──────────────────────────────────────────────────────
const map = L.map('map', {
  zoomControl: false,
  minZoom: 2,
  maxZoom: 12,
  worldCopyJump: true,
}).setView([20, 0], 3);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19,
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ── Loading overlay ───────────────────────────────────────────────
const overlay = document.createElement('div');
overlay.id = 'loading-overlay';
overlay.innerHTML = `
  <div class="loading-title">WORLD EVENT MONITOR</div>
  <div class="loading-bar-wrap"><div class="loading-bar" id="load-bar"></div></div>
  <div class="loading-status" id="load-status">Connecting to data feeds...</div>
`;
document.body.appendChild(overlay);

function setLoadProgress(pct, msg) {
  document.getElementById('load-bar').style.width = pct + '%';
  document.getElementById('load-status').textContent = msg;
}

// ── Pulse marker factory ──────────────────────────────────────────
export function makePulseIcon(color, sizePx, speed = '2s') {
  const half = sizePx / 2;
  return L.divIcon({
    className: '',
    iconSize: [sizePx * 3.5, sizePx * 3.5],
    iconAnchor: [sizePx * 3.5 / 2, sizePx * 3.5 / 2],
    html: `
      <div class="pulse-wrap" style="width:${sizePx*3.5}px;height:${sizePx*3.5}px;">
        <div class="pulse-core" style="
          width:${sizePx}px;height:${sizePx}px;
          background:${color};
          box-shadow:0 0 ${sizePx*1.2}px ${color}99;
        "></div>
        <div class="pulse-ring" style="
          --ring-color:${color};
          --core-size:${sizePx}px;
          --ring-speed:${speed};
        "></div>
        <div class="pulse-ring" style="
          --ring-color:${color};
          --core-size:${sizePx}px;
          --ring-speed:${speed};
          animation-delay:0.7s;
        "></div>
      </div>`,
  });
}

// ── Tooltip helper ────────────────────────────────────────────────
export function darkTip(title, lines = []) {
  return `<span class="tip-title">${title}</span>`
    + lines.map(l => `<span class="tip-meta">${l}</span><br>`).join('');
}

// ── Render functions ──────────────────────────────────────────────
function renderEarthquakes(key, items, color) {
  items.forEach(item => {
    const radius = Math.max(5, Math.min(22, item.mag * 4));
    const marker = L.marker([item.lat, item.lon], {
      icon: makePulseIcon(color, radius, item.mag > 5 ? '1.2s' : '2s'),
      zIndexOffset: Math.round(item.mag * 100),
    });
    marker.bindTooltip(darkTip(
      `M${item.mag.toFixed(1)} Earthquake`,
      [item.place, `Depth: ${item.depth} km`, fmtTime(item.time)]
        .concat(item.tsunami ? ['⚠ Tsunami warning'] : [])
    ), { className: 'dark-tip', direction: 'top', sticky: false });
    marker.addTo(layerGroups[key]);
  });
}

function renderEONET(key, items, color) {
  items.forEach(item => {
    const radius = item.acres
      ? Math.min(22, Math.max(6, Math.log10(item.acres + 1) * 7))
      : 8;
    const marker = L.marker([item.lat, item.lon], {
      icon: makePulseIcon(color, radius),
    });
    marker.bindTooltip(darkTip(
      item.title,
      [fmtTime(item.date)].concat(item.acres ? [`${item.acres.toLocaleString()} ${item.unit}`] : [])
    ), { className: 'dark-tip', direction: 'top', sticky: false });
    marker.addTo(layerGroups[key]);
  });
}

function renderStorms(key, items, color) {
  items.forEach(item => {
    const radius = Math.max(7, Math.min(24, (item.kts || 30) / 4.5));
    const marker = L.marker([item.lat, item.lon], {
      icon: makePulseIcon(color, radius, '1.5s'),
    });
    marker.bindTooltip(darkTip(
      item.title,
      [fmtTime(item.date)].concat(item.kts ? [`Wind: ${item.kts} kts`] : [])
    ), { className: 'dark-tip', direction: 'top', sticky: false });
    marker.addTo(layerGroups[key]);
  });
}

function renderGDELT(key, items, color) {
  items.forEach(item => {
    const radius = Math.max(5, Math.min(18, (item.counts || 1) * 1.5));
    const marker = L.marker([item.lat, item.lon], {
      icon: makePulseIcon(color, radius),
    });
    marker.bindTooltip(darkTip(
      item.name || 'Incident',
      [fmtTime(item.date)].concat(item.counts ? [`${item.counts} report${item.counts > 1 ? 's' : ''}`] : [])
    ), { className: 'dark-tip', direction: 'top', sticky: false });
    marker.addTo(layerGroups[key]);
  });
}

function renderAirQuality(key, items, color) {
  items.forEach(item => {
    const hue = Math.max(0, 120 - item.aqi * 0.4);
    const col = `hsl(${hue}, 100%, 55%)`;
    const radius = Math.max(5, Math.min(20, item.aqi / 14));
    const marker = L.marker([item.lat, item.lon], {
      icon: makePulseIcon(col, radius, '2.5s'),
    });
    let aqiLabel = item.aqi < 150 ? 'Unhealthy' : item.aqi < 200 ? 'Very Unhealthy' : 'Hazardous';
    marker.bindTooltip(darkTip(
      item.name,
      [`AQI: ${item.aqi} — ${aqiLabel}`, fmtTime(item.time)]
    ), { className: 'dark-tip', direction: 'top', sticky: false });
    marker.addTo(layerGroups[key]);
  });
}

// ── Layer orchestration ───────────────────────────────────────────
function initLayers() {
  LAYERS.forEach(layer => {
    layerGroups[layer.key]  = L.layerGroup().addTo(map);
    layerEnabled[layer.key] = true;
    layerData[layer.key]    = [];
  });
}

async function refreshLayer(layer) {
  try {
    const items = await layer.fetch();
    layerData[layer.key] = items;

    layerGroups[layer.key].clearLayers();
    if (layerEnabled[layer.key] && items.length) {
      layer.render(layer.key, items, layer.color);
    }

    updateCounts();
    if (items.length) pushToFeed(layer, items.slice(0, 4));
    logStatus(layer.label, items.length, true);
  } catch (err) {
    console.error(`[${layer.key}]`, err);
    logStatus(layer.label, 0, false);
  }
}

function scheduleRefreshes() {
  LAYERS.forEach(layer => {
    setInterval(() => refreshLayer(layer), layer.refresh);
  });
}

// ── Control panel ─────────────────────────────────────────────────
function buildControls() {
  const list = document.getElementById('layer-list');
  LAYERS.forEach(layer => {
    const row = document.createElement('div');
    row.className = 'layer-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.style.setProperty('--layer-color', layer.color);
    cb.addEventListener('change', () => {
      layerEnabled[layer.key] = cb.checked;
      if (!cb.checked) {
        layerGroups[layer.key].clearLayers();
      } else if (layerData[layer.key].length) {
        layer.render(layer.key, layerData[layer.key], layer.color);
      }
    });

    const dot = document.createElement('span');
    dot.className = 'layer-dot';
    dot.style.cssText = `background:${layer.color};color:${layer.color}`;

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.label;

    const count = document.createElement('span');
    count.className = 'layer-count';
    count.id = `count-${layer.key}`;
    count.textContent = '—';

    const label = document.createElement('label');
    label.append(cb, dot, name);
    row.append(label, count);
    list.appendChild(row);
  });
}

function updateCounts() {
  let total = 0;
  LAYERS.forEach(layer => {
    const n = layerData[layer.key]?.length ?? 0;
    total += n;
    const el = document.getElementById(`count-${layer.key}`);
    if (el) el.textContent = n;
  });
  document.getElementById('total-events').textContent = `${total.toLocaleString()} events tracked`;
}

// ── Live feed ─────────────────────────────────────────────────────
function pushToFeed(layer, items) {
  items.forEach(item => {
    const text = item.title || item.place || item.name || 'Event';
    feedItems.unshift({ color: layer.color, label: layer.label, text, time: new Date() });
  });
  if (feedItems.length > 200) feedItems.length = 200;
  renderFeed();
  updateTicker();
}

function renderFeed() {
  const ul = document.getElementById('feed-list');
  ul.innerHTML = feedItems.slice(0, 50).map(item => `
    <li class="feed-item">
      <div class="feed-header">
        <span class="feed-dot" style="background:${item.color};color:${item.color}"></span>
        <span class="feed-type" style="color:${item.color}">${item.label.toUpperCase()}</span>
        <span class="feed-time">${fmtTime(item.time)}</span>
      </div>
      <div class="feed-text">${item.text}</div>
    </li>`).join('');
}

function updateTicker() {
  const el = document.getElementById('ticker-content');
  const text = feedItems.slice(0, 40)
    .map(i => `[ ${i.label.toUpperCase()} ] ${i.text}`)
    .join('    •    ');
  el.textContent = text || 'Loading data feeds...';
  // Reset animation
  el.style.animation = 'none';
  el.offsetHeight; // reflow
  el.style.animation = '';
}

// ── Status log ────────────────────────────────────────────────────
function logStatus(label, count, ok) {
  const log = document.getElementById('status-log');
  const entry = document.createElement('div');
  entry.className = `status-entry ${ok ? 'ok' : 'err'}`;
  const now = new Date().toUTCString().slice(17, 25);
  entry.innerHTML = `<span class="status-time">${now}</span><span class="status-msg">${label}: ${ok ? count + ' events' : 'FAILED'}</span>`;
  log.prepend(entry);
  while (log.children.length > 10) log.lastChild.remove();
}

// ── Clock ─────────────────────────────────────────────────────────
function startClock() {
  const tick = () => {
    const now = new Date();
    document.getElementById('clock').textContent =
      now.toUTCString().slice(0, 25) + ' UTC';
  };
  tick();
  setInterval(tick, 1000);
}

// ── Utilities ─────────────────────────────────────────────────────
function fmtTime(d) {
  if (!d) return '';
  try {
    const date = d instanceof Date ? d : new Date(d);
    return date.toUTCString().slice(0, 25) + ' UTC';
  } catch { return ''; }
}

// ── Bootstrap ─────────────────────────────────────────────────────
async function boot() {
  initLayers();
  buildControls();
  startClock();

  setLoadProgress(10, 'Loading map tiles...');
  await new Promise(r => setTimeout(r, 400));

  let done = 0;
  const total = LAYERS.length;

  await Promise.all(LAYERS.map(async (layer, i) => {
    await new Promise(r => setTimeout(r, i * 400));
    setLoadProgress(10 + Math.round((done / total) * 80), `Fetching ${layer.label}...`);
    await refreshLayer(layer);
    done++;
    setLoadProgress(10 + Math.round((done / total) * 80), `Loaded ${layer.label}`);
  }));

  setLoadProgress(100, 'All feeds connected.');
  await new Promise(r => setTimeout(r, 500));
  overlay.classList.add('hidden');
  setTimeout(() => overlay.remove(), 700);

  scheduleRefreshes();
}

boot();
