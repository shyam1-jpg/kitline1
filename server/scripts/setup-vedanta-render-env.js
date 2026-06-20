'use strict';
/**
 * Apply Vedanta Gmail SMTP env vars to Render (kitline1).
 * Requires one-time Render API key: https://dashboard.render.com/u/settings#api-keys
 *
 * Usage:
 *   set RENDER_API_KEY=your_key
 *   node server/scripts/setup-vedanta-render-env.js
 * Optional: set SMTP_PASS in server/.env or pass as argument
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'kitline1';

function loadDotEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

function api(method, urlPath, body) {
  const key = process.env.RENDER_API_KEY;
  if (!key) throw new Error('Set RENDER_API_KEY (from Render → Account → API Keys)');
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.render.com',
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let parsed = raw;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { /* text */ }
          if (res.statusCode >= 400) {
            reject(new Error(`Render API ${res.statusCode}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : raw}`));
          } else resolve(parsed);
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function findServiceId() {
  if (process.env.RENDER_SERVICE_ID) return process.env.RENDER_SERVICE_ID;
  const list = await api('GET', '/v1/services?limit=100');
  const items = Array.isArray(list) ? list.map((x) => x.service || x) : (list.items || []);
  const svc = items.find((s) => (s.name || s.service?.name) === SERVICE_NAME);
  const id = svc?.id || svc?.service?.id;
  if (!id) throw new Error(`Service "${SERVICE_NAME}" not found on your Render account`);
  return id;
}

async function setEnv(serviceId, key, value) {
  await api('PUT', `/v1/services/${serviceId}/env-vars/${encodeURIComponent(key)}`, { value: String(value) });
  console.log('  ✓', key);
}

async function main() {
  loadDotEnv();
  const smtpPass = process.argv[2] || process.env.SMTP_PASS;
  if (!smtpPass) {
    console.error('Missing SMTP_PASS. Use Google App Password (not normal login).');
    console.error('Create at: https://myaccount.google.com/apppasswords');
    console.error('Then: node server/scripts/setup-vedanta-render-env.js YOUR_APP_PASSWORD');
    process.exit(1);
  }

  const vars = {
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'shyam.prasad@thevedanta.org',
    SMTP_PASS: smtpPass,
    SMTP_FROM: 'The Vedanta Rota <shyam.prasad@thevedanta.org>',
    VEDANTA_REPORT_EMAIL: 'Operation@thevedanta.org',
    VEDANTA_REPORTS_ENABLED: 'false',
    VEDANTA_FB_PROJECT: 'the-vedanta',
  };

  console.log('Finding Render service', SERVICE_NAME, '…');
  const serviceId = await findServiceId();
  console.log('Service ID:', serviceId);
  console.log('Setting environment variables…');
  for (const [key, value] of Object.entries(vars)) {
    await setEnv(serviceId, key, value);
  }
  console.log('\nDone. Render will redeploy (~3 min).');
  console.log('Check: https://kiteline.uk/api/vedanta/reports/status');
  console.log('Test: Admin → Settings → Send test weekly report (manual only).');
}

main().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
