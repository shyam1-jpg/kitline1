'use strict';

const crypto = require('crypto');
const tenants = require('./tenants');
const aiAuth = require('./ai-auth');

const PENDING_MS = 10 * 60 * 1000;
const CODE_MS = 5 * 60 * 1000;

function clientId() {
  return (process.env.AI_OAUTH_CLIENT_ID || 'kiteline-chatgpt').trim();
}

function clientSecret() {
  return (process.env.AI_OAUTH_CLIENT_SECRET || '').trim();
}

function oauthConfigured() {
  return !!clientSecret();
}

function baseUrl(req) {
  const env = (process.env.APP_URL || '').replace(/\/$/, '');
  if (env) return env;
  return `https://${req.headers.host || 'kiteline.uk'}`;
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function ensureStores(db) {
  db.oauthPending = db.oauthPending || {};
  db.oauthCodes = db.oauthCodes || {};
}

function allowedRedirect(uri) {
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    if (host === 'chat.openai.com' || host === 'chatgpt.com' || host.endsWith('.openai.com')) return true;
    if (!oauthConfigured() && (host === 'localhost' || host === '127.0.0.1')) return true;
  } catch {
    return false;
  }
  return false;
}

function parseForm(raw) {
  const out = {};
  String(raw || '').split('&').forEach((pair) => {
    const [k, v] = pair.split('=').map((s) => decodeURIComponent((s || '').replace(/\+/g, ' ')));
    if (k) out[k] = v;
  });
  return out;
}

async function readTokenBody(req) {
  const ctype = String(req.headers['content-type'] || '').toLowerCase();
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; });
    req.on('end', () => {
      if (ctype.includes('application/x-www-form-urlencoded')) resolve(parseForm(data));
      else {
        try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
      }
    });
  });
}

function cleanup(db) {
  const now = Date.now();
  Object.entries(db.oauthPending || {}).forEach(([k, v]) => {
    if (!v || v.expires < now) delete db.oauthPending[k];
  });
  Object.entries(db.oauthCodes || {}).forEach(([k, v]) => {
    if (!v || v.expires < now) delete db.oauthCodes[k];
  });
}

function handleAuthorize(db, req, query, apiSend) {
  cleanup(db);
  ensureStores(db);
  const responseType = query.response_type || '';
  const cid = query.client_id || '';
  const redirectUri = query.redirect_uri || '';
  const state = query.state || '';
  const scope = query.scope || 'kiteline.read';

  if (responseType !== 'code') {
    return apiSend(400, { error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' });
  }
  if (cid !== clientId()) {
    return apiSend(400, { error: 'invalid_client', error_description: 'Unknown client_id' });
  }
  if (!redirectUri || !allowedRedirect(redirectUri)) {
    return apiSend(400, { error: 'invalid_redirect_uri', error_description: 'Redirect URI not allowed' });
  }

  const id = uid('oap');
  db.oauthPending[id] = {
    id,
    clientId: cid,
    redirectUri,
    state,
    scope,
    expires: Date.now() + PENDING_MS,
    createdAt: new Date().toISOString(),
  };

  const appUrl = `${baseUrl(req)}/app?ai_oauth=${encodeURIComponent(id)}`;
  return apiSend(302, '', { Location: appUrl });
}

function handlePending(db, query, apiSend) {
  ensureStores(db);
  const id = query.id || query.pendingId || '';
  const pending = db.oauthPending[id];
  if (!pending || pending.expires < Date.now()) {
    return apiSend(404, { error: 'OAuth request expired — start again from ChatGPT' });
  }
  return apiSend(200, {
    id: pending.id,
    clientName: 'ChatGPT',
    scope: pending.scope,
    createdAt: pending.createdAt,
    permissions: aiAuth.defaultPermissions({
      create_draft_recipes: true,
      create_menu_drafts: true,
      export_reports: true,
    }),
    permissionKeys: aiAuth.PERMISSION_KEYS,
  });
}

function handleApprove(db, sessionUser, body, ip, apiSend, writeDb, security) {
  ensureStores(db);
  const state = tenants.getStateForUser(db, sessionUser.email);
  if (!state) return apiSend(409, { error: 'No workspace for this account' });
  const role = aiAuth.resolveRole(state, sessionUser.email);
  if (!aiAuth.roleAtLeast(role, 'Admin')) {
    return apiSend(403, { error: 'Only Admins can authorise ChatGPT for this company' });
  }

  const pendingId = body.pendingId || body.id;
  const pending = db.oauthPending[pendingId];
  if (!pending || pending.expires < Date.now()) {
    return apiSend(404, { error: 'OAuth request expired — start again from ChatGPT' });
  }
  if (body.approve === false) {
    delete db.oauthPending[pendingId];
    writeDb(db);
    const sep = pending.redirectUri.includes('?') ? '&' : '?';
    const url = `${pending.redirectUri}${sep}error=access_denied&state=${encodeURIComponent(pending.state || '')}`;
    return apiSend(200, { ok: false, redirect: url });
  }

  const code = uid('oac');
  db.oauthCodes[code] = {
    code,
    email: sessionUser.email,
    tenantId: sessionUser.tenantId,
    clientId: pending.clientId,
    redirectUri: pending.redirectUri,
    permissions: aiAuth.defaultPermissions(body.permissions),
    expires: Date.now() + CODE_MS,
    createdAt: new Date().toISOString(),
  };
  delete db.oauthPending[pendingId];
  security.audit(db, 'ai_oauth_approve', { ip, email: sessionUser.email, detail: code });
  writeDb(db);

  const sep = pending.redirectUri.includes('?') ? '&' : '?';
  const redirect = `${pending.redirectUri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(pending.state || '')}`;
  return apiSend(200, { ok: true, redirect });
}

async function handleToken(db, req, apiSend, writeDb, security) {
  ensureStores(db);
  cleanup(db);
  const body = await readTokenBody(req);
  const grantType = body.grant_type || '';
  const cid = body.client_id || '';
  const secret = body.client_secret || '';

  if (cid !== clientId() || secret !== clientSecret()) {
    return apiSend(401, { error: 'invalid_client' });
  }
  if (grantType !== 'authorization_code') {
    return apiSend(400, { error: 'unsupported_grant_type' });
  }

  const code = body.code || '';
  const redirectUri = body.redirect_uri || '';
  const entry = db.oauthCodes[code];
  if (!entry || entry.expires < Date.now()) {
    return apiSend(400, { error: 'invalid_grant', error_description: 'Code expired or unknown' });
  }
  if (entry.redirectUri !== redirectUri) {
    return apiSend(400, { error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
  }
  delete db.oauthCodes[code];

  const created = aiAuth.createToken(db, entry.email, {
    label: 'ChatGPT OAuth',
    permissions: entry.permissions,
  });
  created.entry.oauth = true;
  security.audit(db, 'ai_oauth_token', { email: entry.email, detail: created.id });
  writeDb(db);

  return apiSend(200, {
    access_token: created.token,
    token_type: 'Bearer',
    expires_in: 86400 * 90,
    scope: 'kiteline',
  });
}

function publicConfig(req) {
  const base = baseUrl(req);
  return {
    enabled: oauthConfigured(),
    clientId: clientId(),
    authorizationUrl: `${base}/api/ai/oauth/authorize`,
    tokenUrl: `${base}/api/ai/oauth/token`,
    scope: 'kiteline.read kiteline.write',
    openapiUrl: `${base}/api/ai/openapi.json`,
    note: oauthConfigured()
      ? 'Set these URLs in ChatGPT GPT Actions OAuth settings.'
      : 'Set AI_OAUTH_CLIENT_SECRET on Render to enable OAuth for customers.',
  };
}

async function handleRoute(opts) {
  const {
    db, req, parts, method, body, ip, apiSend, userFromReq, writeDb, query, security,
  } = opts;
  const action = parts[1] || '';

  if (action === 'authorize' && method === 'GET') {
    const loc = handleAuthorize(db, req, query, apiSend);
    return loc;
  }

  if (action === 'config' && method === 'GET') {
    return apiSend(200, publicConfig(req));
  }

  if (action === 'pending' && method === 'GET') {
    return handlePending(db, query, apiSend);
  }

  if (action === 'approve' && method === 'POST') {
    const sessionUser = userFromReq(db, req);
    if (!sessionUser) return apiSend(401, { error: 'Sign in to approve ChatGPT access', code: 'session_required' });
    return handleApprove(db, sessionUser, body, ip, apiSend, writeDb, security);
  }

  if (action === 'token' && method === 'POST') {
    if (!oauthConfigured()) {
      return apiSend(503, { error: 'OAuth not configured — use API token or set AI_OAUTH_CLIENT_SECRET on server' });
    }
    return handleToken(db, req, apiSend, writeDb, security);
  }

  return apiSend(404, { error: 'Unknown OAuth route' });
}

module.exports = {
  oauthConfigured,
  publicConfig,
  handleRoute,
  clientId,
};
