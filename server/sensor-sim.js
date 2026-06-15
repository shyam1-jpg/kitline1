/* Kiteline — simulates 4 fridge sensors posting live readings to /api/ingest
   Run: npm run sensors:sim   (server must be running: npm start)
   Uses INGEST_KEY from env or kiteline-demo-key */
'use strict';

const fs = require('fs');
const path = require('path');

const HOST = process.env.SENSOR_HOST || 'http://localhost:4001';
const KEY = process.env.INGEST_KEY || 'kiteline-demo-key';
const INTERVAL = +(process.env.SENSOR_INTERVAL_MS || 45000);
const DB_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'db.json');

const FALLBACK = [
  { sensorId: 's1', base: 3.2, min: 1, max: 5, name: 'Walk-in Fridge' },
  { sensorId: 's2', base: -18.5, min: -22, max: -15, name: 'Walk-in Freezer' },
  { sensorId: 's3', base: 4.1, min: 1, max: 5, name: 'Prep Fridge' },
  { sensorId: 's4', base: 2.8, min: 0, max: 4, name: 'Dairy Fridge' },
];

function loadSensors() {
  try {
    if (!fs.existsSync(DB_FILE)) return FALLBACK;
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const list = (db.state && db.state.sensors) || [];
    const picked = list.filter((s) => /^s[1-4]$/.test(s.id)).slice(0, 4);
    if (picked.length < 2) return FALLBACK;
    return picked.map((s) => ({
      sensorId: s.id,
      base: s.temp,
      min: s.min,
      max: s.max,
      name: s.name,
    }));
  } catch {
    return FALLBACK;
  }
}

function drift(base, min, max, tick) {
  let t = base + (Math.random() * 0.8 - 0.4);
  if (tick % 20 === 0) t = max + 1.2 + Math.random();
  if (tick % 33 === 0) t = min - 0.8;
  return +Math.max(min - 2, Math.min(max + 2, t)).toFixed(1);
}

async function post(readings) {
  const res = await fetch(`${HOST}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': KEY },
    body: JSON.stringify({ readings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

async function tick(n) {
  const sensors = loadSensors();
  const readings = sensors.map((s) => ({
    sensorId: s.sensorId,
    temp: drift(s.base, s.min, s.max, n),
    battery: 70 + Math.floor(Math.random() * 28),
    signal: 75 + Math.floor(Math.random() * 20),
    ts: new Date().toISOString(),
  }));
  const r = await post(readings);
  const line = readings.map((x) => `${x.sensorId}=${x.temp}°C`).join(', ');
  console.log(`[sensor-sim] #${n} posted ${r.updated} readings (${line})`);
  if (r.notified && r.notified.length) console.log('[sensor-sim] alerts triggered notifications');
}

(async () => {
  console.log('Kiteline sensor simulator');
  console.log('  Target:', HOST + '/api/ingest');
  console.log('  Interval:', INTERVAL / 1000, 's');
  console.log('  Tip: open /app#temps and watch live updates\n');
  let n = 0;
  try {
    await tick(++n);
  } catch (e) {
    console.error('First post failed:', e.message);
    console.error('Is npm start running? Try SENSOR_HOST=http://localhost:4001');
    process.exit(1);
  }
  setInterval(() => tick(++n).catch((e) => console.error('[sensor-sim]', e.message)), INTERVAL);
})();
