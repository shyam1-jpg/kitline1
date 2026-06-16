/* ============================================================
   Kitchen OS — Zero-dependency Node backend
   - Real auth (scrypt password hashing + bearer tokens)
   - Server-side persistence to data/db.json
   - REST API + static hosting for the app and marketing site
   Run:  node server/server.js   (from the kitchen-os folder)
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');          // kitchen-os/
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 4000;
// Shared secret that physical devices / gateways use to push readings.
const INGEST_KEY = process.env.INGEST_KEY || 'kiteline-demo-key';
const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
// Demo only when explicitly enabled, or local dev. Production (Render) is secure by default.
const DEMO_MODE = process.env.DEMO_MODE === 'true'
  || (!isProd && process.env.DEMO_MODE !== 'false');
// Early access: registration open unless explicitly disabled.
const ALLOW_REGISTER = process.env.ALLOW_REGISTER !== 'false';
const APP_URL = (process.env.APP_URL || '').replace(/\/$/, '');
const notify = require('./notify');
const waitlist = require('./waitlist');
const billing = require('./billing');

function ensureBreachAlerts(state) {
  if (!state || !Array.isArray(state.sensors)) return [];
  state.alerts = state.alerts || [];
  const created = [];
  state.sensors.forEach((s) => {
    if (s.temp > s.max || s.temp < s.min) {
      const open = state.alerts.find((a) => a.sensor === s.id && a.status === 'open');
      if (!open) {
        const a = {
          id: 'al_' + crypto.randomBytes(4).toString('hex'),
          severity: 'critical', site: s.siteId, sensor: s.id,
          title: s.name + ' out of safe range',
          detail: s.temp + '°C (limit ' + s.min + '–' + s.max + '°C)',
          at: new Date().toISOString(), status: 'open',
        };
        state.alerts.unshift(a);
        created.push(a);
      }
    }
  });
  return created;
}

/* ---------------- tiny JSON "database" ---------------- */
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const db = { users: {}, tokens: {}, state: null };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  }
}
function readDb() { ensureDb(); return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
function writeDb(db) {
  // Synchronous write so newly issued tokens / state are durable before we respond
  // (avoids a read-after-write race on the very next request).
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

/* ---------------- auth helpers ---------------- */
function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
  } catch { return false; }
}

function bootstrapProductionDb() {
  if (DEMO_MODE) return;
  const ownerEmail = (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase().trim();
  const ownerPass = process.env.OWNER_PASSWORD;
  const db = readDb();
  db.passwordResets = db.passwordResets || {};
  if (!ownerPass) {
    if (!db.users[ownerEmail]) {
      console.warn('  WARNING: Set OWNER_PASSWORD in env to create the owner account.');
    }
    return;
  }
  db.users[ownerEmail] = {
    email: ownerEmail,
    name: process.env.OWNER_NAME || (db.users[ownerEmail] && db.users[ownerEmail].name) || 'Owner',
    pass: hashPassword(ownerPass),
    emailVerified: true,
    createdAt: (db.users[ownerEmail] && db.users[ownerEmail].createdAt) || new Date().toISOString(),
  };
  writeDb(db);
  console.log('  Owner login ready: ' + ownerEmail + ' (password from OWNER_PASSWORD env)');
}

// Load 100 demo recipes + full kitchen data on Render / fresh installs.
function bootstrapDemoKitchen() {
  const seedFile = path.join(__dirname, 'demo-state.json');
  if (!fs.existsSync(seedFile)) return;
  const db = readDb();
  const recipes = db.state && Array.isArray(db.state.recipes) ? db.state.recipes.length : 0;
  if (recipes < 100) {
    try {
      db.state = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
      db.state.currentSite = 'site_grove';
      writeDb(db);
      console.log('  Demo kitchen loaded — ' + (db.state.recipes || []).length + ' recipes');
    } catch (e) {
      console.warn('  Demo seed failed:', e.message);
    }
    return;
  }
  // Wrong site selected → empty recipes page (e.g. Crown & Anchor has no recipes)
  const site = db.state.currentSite || 'site_grove';
  const forSite = db.state.recipes.filter((r) => r.site === site).length;
  if (forSite === 0) {
    db.state.currentSite = 'site_grove';
    writeDb(db);
    console.log('  Reset kitchen to The Grove Hotel (recipes live here)');
  }
}
function newToken() { return crypto.randomBytes(24).toString('hex'); }

const REQUIRE_EMAIL_VERIFY = process.env.REQUIRE_EMAIL_VERIFY !== 'false' && !DEMO_MODE;

function publicUser(user) {
  return { email: user.email, name: user.name, emailVerified: user.emailVerified !== false };
}

async function sendVerificationEmail(db, email, baseUrl) {
  const verifyToken = crypto.randomBytes(24).toString('hex');
  db.emailVerifications = db.emailVerifications || {};
  db.emailVerifications[verifyToken] = { email, expires: Date.now() + 48 * 3600000 };
  writeDb(db);
  const verifyUrl = `${baseUrl}/app#verify-email?token=${verifyToken}`;
  const msg = {
    subject: 'Verify your Kiteline email',
    text: `Welcome to Kiteline!\n\nVerify your email to activate your account:\n\n${verifyUrl}\n\nThis link expires in 48 hours.`,
    html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px">
      <h2 style="color:#0d9488">Verify your Kiteline email</h2>
      <p>Thanks for registering. Confirm your email to sign in and use your kitchen workspace.</p>
      <p><a href="${verifyUrl}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;font-weight:bold;border-radius:8px;text-decoration:none">Verify email address</a></p>
      <p style="color:#64748b;font-size:13px">Or copy this link: ${verifyUrl}</p>
      <p style="color:#64748b;font-size:13px">Link expires in 48 hours.</p>
    </div>`,
  };
  await notify.sendRawEmail(email, msg);
  const showLink = process.env.SHOW_RESET_LINK === 'true' || !notify.emailEnabled();
  return { verifyUrl: showLink ? verifyUrl : undefined };
}

function userFromReq(db, req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const email = db.tokens[token];
  return email ? db.users[email] : null;
}

/* ---------------- http helpers ---------------- */
function send(res, code, obj, headers) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' }, headers || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 30e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); } });
  });
}
function readRawBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 30e6) req.destroy(); });
    req.on('end', () => resolve(data));
  });
}

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.ico':'image/x-icon', '.map':'application/json',
  '.webmanifest':'application/manifest+json' };

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || ext === '.svg') {
    headers['Cache-Control'] = 'public, max-age=86400';
  }
  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    res.writeHead(200, headers);
    stream.pipe(res);
  });
  stream.on('error', () => send(res, 404, { error: 'Not found' }));
}
// Prevent path traversal
function safeJoin(base, target) {
  const p = path.normalize(path.join(base, target));
  return p.startsWith(base) ? p : null;
}

/* ---------------- API routes ---------------- */
async function handleApi(req, res, url) {
  const db = readDb();
  const route = url.pathname.replace(/^\/api/, '');
  const body = (req.method === 'POST' || req.method === 'PUT') ? await readBody(req) : {};

  // GET /api/config — public app flags (demo UI, registration)
  if (route === '/config' && req.method === 'GET') {
    return send(res, 200, {
      demo: DEMO_MODE,
      register: ALLOW_REGISTER,
      emailVerification: REQUIRE_EMAIL_VERIFY,
      billing: billing.isConfigured(),
      plans: billing.planCatalog(),
    });
  }

  // GET /api/billing/config — public plan list + Stripe enabled flag
  if (route === '/billing/config' && req.method === 'GET') {
    return send(res, 200, { enabled: billing.isConfigured(), plans: billing.planCatalog() });
  }

  // POST /api/billing/checkout — Stripe Checkout (email required)
  if (route === '/billing/checkout' && req.method === 'POST') {
    if (!billing.isConfigured()) {
      return send(res, 503, { error: 'Online checkout not configured yet — email shyam_1@hotmail.co.uk for an invoice.' });
    }
    try {
      const result = await billing.createCheckout({ plan: body.plan, email: body.email });
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, { error: e.message || 'Checkout failed' });
    }
  }

  // POST /api/waitlist — hardware interest (no payment, no stock)
  if (route === '/waitlist' && req.method === 'POST') {
    const result = waitlist.add(body);
    if (result.error) return send(res, 409, result);
    notify.notifyWaitlistSignup(result.entry || body).catch((e) => {
      console.error('[waitlist] owner email failed:', e.message);
    });
    return send(res, 200, result);
  }

  // GET /api/waitlist/summary — public counts only (no personal data)
  if (route === '/waitlist/summary' && req.method === 'GET') {
    return send(res, 200, waitlist.summary(waitlist.read()));
  }

  // POST /api/register
  if (route === '/register' && req.method === 'POST') {
    if (!ALLOW_REGISTER) return send(res, 403, { error: 'Registration disabled' });
    const email = (body.email || '').toLowerCase().trim();
    if (!email || !body.password) return send(res, 400, { error: 'Email and password required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return send(res, 400, { error: 'Enter a valid email address' });
    if (body.password.length < 8) return send(res, 400, { error: 'Password must be at least 8 characters' });
    if (db.users[email]) {
      const existing = db.users[email];
      if (REQUIRE_EMAIL_VERIFY && existing.emailVerified === false) {
        return send(res, 409, { error: 'Account exists but email not verified — check your inbox or resend the link.', code: 'email_not_verified' });
      }
      return send(res, 409, { error: 'Account already exists — sign in or reset your password' });
    }
    const name = (body.name || email.split('@')[0]).trim();
    const skipVerify = DEMO_MODE || !REQUIRE_EMAIL_VERIFY;
    db.users[email] = {
      email,
      name,
      pass: hashPassword(body.password),
      emailVerified: skipVerify,
      createdAt: new Date().toISOString(),
    };
    if (skipVerify) {
      const token = newToken();
      db.tokens[token] = email;
      writeDb(db);
      return send(res, 200, { token, user: publicUser(db.users[email]), needsVerification: false });
    }
    writeDb(db);
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    const mail = await sendVerificationEmail(db, email, base);
    return send(res, 200, {
      ok: true,
      needsVerification: true,
      message: notify.emailEnabled()
        ? 'Account created — check your email and click Verify to activate your account.'
        : 'Account created — use the verification link below (email not configured on server).',
      verifyUrl: mail.verifyUrl,
    });
  }

  // POST /api/verify-email
  if (route === '/verify-email' && req.method === 'POST') {
    const verifyToken = body.token || '';
    if (!verifyToken) return send(res, 400, { error: 'Verification token required' });
    db.emailVerifications = db.emailVerifications || {};
    const entry = db.emailVerifications[verifyToken];
    if (!entry || entry.expires < Date.now()) {
      return send(res, 400, { error: 'Verification link expired or invalid — register again or resend link' });
    }
    const email = entry.email;
    const user = db.users[email];
    if (!user) return send(res, 404, { error: 'Account not found' });
    user.emailVerified = true;
    delete db.emailVerifications[verifyToken];
    const token = newToken();
    db.tokens[token] = email;
    writeDb(db);
    return send(res, 200, { ok: true, token, user: publicUser(user), message: 'Email verified — you are signed in' });
  }

  // POST /api/resend-verification
  if (route === '/resend-verification' && req.method === 'POST') {
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return send(res, 400, { error: 'Email required' });
    const user = db.users[email];
    if (!user) {
      return send(res, 200, { ok: true, message: 'If that email is registered, we sent a new verification link.' });
    }
    if (user.emailVerified !== false) {
      return send(res, 200, { ok: true, message: 'This email is already verified — you can sign in.' });
    }
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    const mail = await sendVerificationEmail(db, email, base);
    return send(res, 200, {
      ok: true,
      message: notify.emailEnabled()
        ? 'Verification email sent — check your inbox (and spam folder).'
        : 'Use the verification link below.',
      verifyUrl: mail.verifyUrl,
    });
  }

  // POST /api/forgot-password
  if (route === '/forgot-password' && req.method === 'POST') {
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return send(res, 400, { error: 'Email required' });
    const user = db.users[email];
    if (!user) {
      return send(res, 200, { ok: true, message: 'If that email is registered, we sent reset instructions.' });
    }
    const resetToken = crypto.randomBytes(24).toString('hex');
    db.passwordResets = db.passwordResets || {};
    db.passwordResets[resetToken] = { email, expires: Date.now() + 3600000 };
    writeDb(db);
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    const resetUrl = `${base}/app#reset-password?token=${resetToken}`;
    const msg = {
      subject: 'Reset your Kiteline password',
      text: `Reset your Kiteline password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.`,
      html: `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px">
        <h2 style="color:#0d9488">Reset your Kiteline password</h2>
        <p><a href="${resetUrl}" style="color:#0d9488;font-weight:bold">Click here to choose a new password</a></p>
        <p style="color:#64748b;font-size:13px">Link expires in 1 hour. If you did not ask for this, ignore this email.</p>
      </div>`,
    };
    await notify.sendRawEmail(email, msg);
    const showLink = process.env.SHOW_RESET_LINK === 'true' || !notify.emailEnabled();
    return send(res, 200, {
      ok: true,
      message: notify.emailEnabled()
        ? 'If that email is registered, we sent reset instructions.'
        : 'Email not configured — use the reset link below (also saved on server).',
      resetUrl: showLink ? resetUrl : undefined,
    });
  }

  // POST /api/reset-password
  if (route === '/reset-password' && req.method === 'POST') {
    const resetToken = body.token || '';
    const password = body.password || '';
    if (!resetToken || !password) return send(res, 400, { error: 'Token and new password required' });
    if (password.length < 4) return send(res, 400, { error: 'Password must be at least 4 characters' });
    db.passwordResets = db.passwordResets || {};
    const entry = db.passwordResets[resetToken];
    if (!entry || entry.expires < Date.now()) {
      return send(res, 400, { error: 'Reset link expired or invalid — request a new one' });
    }
    const email = entry.email;
    if (!db.users[email]) return send(res, 404, { error: 'Account not found' });
    db.users[email].pass = hashPassword(password);
    delete db.passwordResets[resetToken];
    writeDb(db);
    return send(res, 200, { ok: true, message: 'Password updated — you can sign in now' });
  }

  // POST /api/login
  if (route === '/login' && req.method === 'POST') {
    const email = (body.email || '').toLowerCase().trim();
    const password = body.password || '';
    if (!email) return send(res, 400, { error: 'Email required' });
    if (!password) return send(res, 400, { error: 'Password required' });
    let user = db.users[email];
    if (DEMO_MODE) {
      if (!user) {
        user = db.users[email] = { email, name: email.split('@')[0], pass: hashPassword(password), createdAt: new Date().toISOString() };
      } else {
        user.pass = hashPassword(password);
      }
    } else {
      if (!user || !verifyPassword(password, user.pass)) {
        return send(res, 401, { error: 'Invalid email or password' });
      }
      if (REQUIRE_EMAIL_VERIFY && user.emailVerified === false) {
        return send(res, 403, {
          error: 'Verify your email before signing in — check your inbox or resend the verification link.',
          code: 'email_not_verified',
        });
      }
    }
    const token = newToken(); db.tokens[token] = email; writeDb(db);
    return send(res, 200, { token, user: publicUser(user) });
  }

  // POST /api/ingest — physical sensors / LoRaWAN gateways push live readings here.
  // Auth via the x-api-key header (not a user token). Accepts one reading or a batch.
  //   { "sensorId":"s1", "temp":3.4, "battery":92, "signal":88, "ts":"2026-01-01T00:00:00Z" }
  //   { "readings":[ {sensorId,temp}, ... ] }
  if (route === '/ingest' && req.method === 'POST') {
    const key = req.headers['x-api-key'] || '';
    if (key !== INGEST_KEY) return send(res, 401, { error: 'Invalid or missing x-api-key' });
    if (!db.state || !Array.isArray(db.state.sensors)) {
      return send(res, 409, { error: 'No kitchen state yet — open the app once so sensors exist.' });
    }
    const readings = Array.isArray(body.readings) ? body.readings : [body];
    db.state.alerts = db.state.alerts || [];
    let updated = 0; const unknown = [];
    readings.forEach(r => {
      const id = r.sensorId || r.id;
      const s = db.state.sensors.find(x => x.id === id);
      if (!s) { unknown.push(id); return; }
      if (typeof r.temp === 'number') { s.temp = +r.temp.toFixed(1); s.history = (s.history || []).concat(s.temp).slice(-24); }
      if (typeof r.battery === 'number') s.battery = r.battery;
      if (typeof r.signal === 'number') s.signal = r.signal;
      s.updated = r.ts || new Date().toISOString();
      updated++;
    });
    const prevState = JSON.parse(JSON.stringify(db.state));
    ensureBreachAlerts(db.state);
    const mail = await notify.processNewAlerts(prevState, db.state);
    db.state._updatedAt = new Date().toISOString();
    db.state._updatedBy = 'device';
    writeDb(db);
    return send(res, 200, { ok: true, updated, unknown, notified: mail.length });
  }

  // POST /api/maintenance/update — the repair/maintenance department (or an email-reply
  // webhook) pushes live updates back into a ticket. Auth via x-api-key.
  //   { "ticketId":"mt2", "status":"In progress", "message":"Engineer en route", "by":"CoolFix", "ref":"CF-99" }
  if (route === '/maintenance/update' && req.method === 'POST') {
    const key = req.headers['x-api-key'] || '';
    if (key !== INGEST_KEY) return send(res, 401, { error: 'Invalid or missing x-api-key' });
    if (!db.state || !Array.isArray(db.state.maintenance)) return send(res, 409, { error: 'No tickets yet.' });
    const t = db.state.maintenance.find(x => x.id === body.ticketId || (body.ref && x.ref === body.ref));
    if (!t) return send(res, 404, { error: 'Ticket not found' });
    if (body.status) t.status = body.status;
    if (body.ref) t.ref = body.ref;
    if (body.message) t.thread.push({ at: new Date().toISOString(), by: body.by || t.dept || 'Maintenance', type: 'dept', body: String(body.message) });
    db.state._updatedAt = new Date().toISOString();
    db.state._updatedBy = 'dept';
    writeDb(db);
    return send(res, 200, { ok: true, ticket: { id: t.id, status: t.status, messages: t.thread.length } });
  }

  // everything below requires auth
  const me = userFromReq(db, req);
  if (!me) return send(res, 401, { error: 'Unauthorized' });

  if (route === '/me' && req.method === 'GET') return send(res, 200, { user: publicUser(me) });

  if (route === '/logout' && req.method === 'POST') {
    const token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '');
    delete db.tokens[token]; writeDb(db);
    return send(res, 200, { ok: true });
  }

  // Shared org state (cross-device, multi-user, last-write-wins)
  if (route === '/state' && req.method === 'GET') {
    if (db.state && db.state.org && db.state.org.name === 'Brigade') {
      db.state.org.name = 'Kiteline';
      db.state.org.plan = 'Complete Kiteline';
      writeDb(db);
    }
    if (db.state && Array.isArray(db.state.recipes)) {
      const site = db.state.currentSite || 'site_grove';
      if (!db.state.recipes.some((r) => r.site === site)) {
        db.state.currentSite = 'site_grove';
        writeDb(db);
      }
    }
    return send(res, 200, { state: db.state });
  }
  if (route === '/state' && req.method === 'PUT') {
    const prevState = db.state ? JSON.parse(JSON.stringify(db.state)) : null;
    db.state = body.state || db.state;
    ensureBreachAlerts(db.state);
    const mail = await notify.processNewAlerts(prevState, db.state);
    db.state._updatedAt = new Date().toISOString();
    db.state._updatedBy = me.email;
    writeDb(db);
    return send(res, 200, { ok: true, _updatedAt: db.state._updatedAt, notified: mail });
  }

  // POST /api/notify/test — send test email and/or SMS
  if (route === '/notify/test' && req.method === 'POST') {
    if (!db.state) return send(res, 409, { error: 'No kitchen state yet' });
    const channel = (body.channel || 'email').toLowerCase();
    if (channel === 'sms') {
      const result = await notify.sendTestSms(db.state);
      return send(res, 200, { ok: true, result });
    }
    if (channel === 'both') {
      const email = await notify.sendTestEmail(db.state);
      const sms = await notify.sendTestSms(db.state);
      return send(res, 200, { ok: true, result: { email, sms } });
    }
    const result = await notify.sendTestEmail(db.state);
    return send(res, 200, { ok: true, result });
  }

  // GET /api/notify/status — which channels are configured (SMTP / Twilio)
  if (route === '/notify/status' && req.method === 'GET') {
    return send(res, 200, notify.channelStatus());
  }

  // GET /api/ingest/info — ingest URL + API key for sensor hardware setup (auth required)
  if (route === '/ingest/info' && req.method === 'GET') {
    const host = (process.env.APP_URL || '').replace(/\/$/, '')
      || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host || 'localhost:4001'}`;
    return send(res, 200, {
      ingestUrl: `${host}/api/ingest`,
      apiKey: INGEST_KEY,
      demoKey: INGEST_KEY === 'kiteline-demo-key',
    });
  }

  // GET /api/waitlist — owner-only full list (see who wants to buy what)
  if (route === '/waitlist' && req.method === 'GET') {
    const ownerEmail = (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase().trim();
    if (me.email.toLowerCase() !== ownerEmail) return send(res, 403, { error: 'Owner only' });
    const list = waitlist.read();
    return send(res, 200, { entries: list, summary: waitlist.summary(list) });
  }

  // GET /api/billing/status — current user's subscription
  if (route === '/billing/status' && req.method === 'GET') {
    const sub = billing.getSubscription(db, me.email);
    return send(res, 200, {
      enabled: billing.isConfigured(),
      subscription: sub || { status: 'none', plan: null },
    });
  }

  // POST /api/billing/portal — Stripe customer portal (manage/cancel)
  if (route === '/billing/portal' && req.method === 'POST') {
    if (!billing.isConfigured()) return send(res, 503, { error: 'Billing not configured' });
    try {
      const result = await billing.createPortalSession(me.email, db);
      return send(res, 200, result);
    } catch (e) {
      return send(res, 400, { error: e.message || 'Portal failed' });
    }
  }

  return send(res, 404, { error: 'Unknown API route' });
}

/* ---------------- static + routing ---------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'OPTIONS') return send(res, 204, '');

  try {
    // Health check (for uptime monitors / load balancers)
    if (url.pathname === '/health' || url.pathname === '/api/health') {
      return send(res, 200, { ok: true, service: 'kiteline', uptime: Math.round(process.uptime()), now: new Date().toISOString() });
    }

    // Stripe webhook needs raw body (before JSON parser in handleApi)
    if (url.pathname === '/api/billing/webhook' && req.method === 'POST') {
      const raw = await readRawBody(req);
      const sig = req.headers['stripe-signature'] || '';
      const db = readDb();
      const result = await billing.handleWebhook(raw, sig, db, writeDb);
      return send(res, result.ok ? 200 : 400, result);
    }

    if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);

    // Marketing site at "/"
    if (url.pathname === '/' || url.pathname === '') return serveFile(res, path.join(ROOT, 'site', 'index.html'));

    // App at "/app" — serve SPA for all /app/* paths (hash router + deep links)
    if (url.pathname === '/app' || url.pathname.startsWith('/app/')) {
      return serveFile(res, path.join(ROOT, 'index.html'));
    }

    // Static files (css, js, marketing pages). Try root first.
    let target = safeJoin(ROOT, url.pathname);
    if (target && fs.existsSync(target) && fs.statSync(target).isFile()) return serveFile(res, target);

    // Then try the site/ folder (so /pricing.html works)
    let siteTarget = safeJoin(path.join(ROOT, 'site'), url.pathname);
    if (siteTarget && fs.existsSync(siteTarget) && fs.statSync(siteTarget).isFile()) return serveFile(res, siteTarget);

    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    return send(res, 500, { error: String(e && e.message || e) });
  }
});

bootstrapDemoKitchen();
bootstrapProductionDb();

// Listen on several ports locally; single PORT in production (Render, Railway, etc.)
const envPorts = isProd ? [] : (process.env.PORTS || '').split(',').map(s => parseInt(s.trim(), 10)).filter(Boolean);
const PORTS = isProd
  ? [Number(process.env.PORT) || 4000]
  : Array.from(new Set([Number(PORT), ...envPorts, 4000, 4001, 4002]));
const HOST = process.env.HOST || '0.0.0.0';

function lanIp() {
  const os = require('os');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

console.log('\n  Kiteline — Kitchen Operations Platform');
console.log('  ----------------------------------');
const mobileIp = lanIp();
PORTS.forEach((p, i) => {
  const srv = (i === 0) ? server : http.createServer(server.listeners('request')[0]);
  srv.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.log('  (port ' + p + ' already in use — skipped)');
    else console.error(e);
  });
  srv.listen(p, HOST, () => {
    if (isProd) {
      console.log('  Live: ' + (process.env.APP_URL || 'https://kiteline.uk').replace(/\/$/, '') + '/app');
    } else {
      console.log('  PC:     http://localhost:' + p + '/app');
      if (mobileIp) console.log('  Phone:  http://' + mobileIp + ':' + p + '/app  (same Wi‑Fi)');
    }
    if (i === PORTS.length - 1) {
      if (DEMO_MODE) console.log('\n  Demo mode — any login creates/updates an account.');
      else console.log('\n  Production auth — use your owner credentials (OWNER_EMAIL / OWNER_PASSWORD).');
      if (!isProd) console.log('  Press Ctrl+C to stop.');
      console.log('');
    }
  });
});

// Keep the process alive and log fatal errors instead of crashing silently.
process.on('uncaughtException', (e) => console.error('Uncaught exception:', e));
process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));
