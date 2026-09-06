'use strict';

/**
 * Kiteline OAuth 2.1 compatibility layer for ChatGPT MCP.
 *
 * - Authorization Code + PKCE (S256)
 * - Dynamic Client Registration (public clients, token auth method "none")
 * - RFC 9728 protected-resource metadata
 * - RFC 8414 authorization-server metadata
 * - Exact resource binding to https://kiteline.uk/mcp
 *
 * Existing kl_ai_ access tokens remain the internal opaque bearer format,
 * but ChatGPT obtains them through OAuth. Users never paste API keys into
 * ChatGPT for MCP authentication.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const tenants = require('./tenants');
const aiAuth = require('./ai-auth');
const securityModule = require('./security');

const PENDING_MS = 10 * 60 * 1000;
const CODE_MS = 5 * 60 * 1000;
const TOKEN_MS = 90 * 24 * 60 * 60 * 1000;
const RESOURCE = 'https://kiteline.uk/mcp';
const ISSUER = 'https://kiteline.uk';
const TOKEN_ENDPOINT = 'https://kiteline.uk/api/vedanta-ordering/oauth/token';
const REGISTRATION_ENDPOINT = 'https://kiteline.uk/api/ai/oauth/register';
const AUTHORIZATION_ENDPOINT = 'https://kiteline.uk/api/ai/oauth/authorize';
const PROTECTED_RESOURCE_METADATA = 'https://kiteline.uk/api/ai/oauth/resource-metadata';

function baseUrl(req) {
  const env = (process.env.APP_URL || '').replace(/\/$/, '');
  if (env) return env;
  const forwarded = req && req.headers && req.headers['x-forwarded-proto'];
  const proto = forwarded || ((process.env.NODE_ENV === 'production' || process.env.RENDER === 'true') ? 'https' : 'http');
  const host = req && req.headers && req.headers.host;
  return host ? `${proto}://${host}` : ISSUER;
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(16).toString('hex')}`;
}

function ensureStores(db) {
  db.oauthPending = db.oauthPending || {};
  db.oauthCodes = db.oauthCodes || {};
  db.oauthClients = db.oauthClients || {};
}

function cleanup(db) {
  ensureStores(db);
  const now = Date.now();
  Object.entries(db.oauthPending).forEach(([k, v]) => {
    if (!v || v.expires < now) delete db.oauthPending[k];
  });
  Object.entries(db.oauthCodes).forEach(([k, v]) => {
    if (!v || v.expires < now) delete db.oauthCodes[k];
  });
}

function allowedRedirect(uri) {
  try {
    const u = new URL(uri);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1') return false;
    if (host === 'chatgpt.com' || host.endsWith('.chatgpt.com')) return true;
    if (host === 'openai.com' || host.endsWith('.openai.com')) return true;
    if ((host === 'localhost' || host === '127.0.0.1') && process.env.NODE_ENV !== 'production' && process.env.RENDER !== 'true') return true;
  } catch (_) {
    return false;
  }
  return false;
}

function cleanScopes(scope) {
  const requested = String(scope || 'kiteline.read').split(/\s+/).filter(Boolean);
  const allowed = new Set(['kiteline.read', 'kiteline.write']);
  const out = requested.filter((s) => allowed.has(s));
  if (!out.includes('kiteline.read')) out.unshift('kiteline.read');
  return Array.from(new Set(out)).join(' ');
}

function clientRecord(db, clientId) {
  ensureStores(db);
  const stored = db.oauthClients[clientId];
  if (stored) return stored;
  if (clientId === 'kiteline-chatgpt') {
    return {
      client_id: clientId,
      client_name: 'ChatGPT',
      redirect_uris: [],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      legacy: true,
    };
  }
  return null;
}

function redirectAllowedForClient(client, redirectUri) {
  if (!client || !allowedRedirect(redirectUri)) return false;
  if (client.legacy) return true;
  return Array.isArray(client.redirect_uris) && client.redirect_uris.includes(redirectUri);
}

function verifyPkce(verifier, challenge) {
  const raw = String(verifier || '');
  if (raw.length < 43 || raw.length > 128) return false;
  const digest = crypto.createHash('sha256').update(raw).digest('base64url');
  const expected = Buffer.from(String(challenge || ''));
  const actual = Buffer.from(digest);
  if (expected.length !== actual.length) return false;
  try { return crypto.timingSafeEqual(expected, actual); } catch (_) { return false; }
}

function protectedResourceMetadata(req) {
  const base = baseUrl(req);
  const resource = base === ISSUER ? RESOURCE : `${base}/mcp`;
  return {
    resource,
    authorization_servers: [base],
    scopes_supported: ['kiteline.read', 'kiteline.write'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${base}/mcp`,
  };
}

function authorizationServerMetadata(req) {
  const base = baseUrl(req);
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/ai/oauth/authorize`,
    token_endpoint: base === ISSUER ? TOKEN_ENDPOINT : `${base}/api/vedanta-ordering/oauth/token`,
    registration_endpoint: `${base}/api/ai/oauth/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['kiteline.read', 'kiteline.write'],
  };
}

function handleRegister(db, body, apiSend, writeDb) {
  cleanup(db);
  const redirectUris = Array.isArray(body && body.redirect_uris) ? body.redirect_uris.map(String) : [];
  if (!redirectUris.length || redirectUris.length > 10 || redirectUris.some((u) => !allowedRedirect(u))) {
    return apiSend(400, { error: 'invalid_redirect_uri', error_description: 'A valid ChatGPT/OpenAI redirect_uris list is required' });
  }
  const authMethod = String((body && body.token_endpoint_auth_method) || 'none');
  if (authMethod !== 'none') {
    return apiSend(400, { error: 'invalid_client_metadata', error_description: 'Kiteline MCP uses a public PKCE client (token_endpoint_auth_method=none)' });
  }
  const clientId = uid('kldcr');
  const client = {
    client_id: clientId,
    client_name: String((body && body.client_name) || 'ChatGPT Kiteline').slice(0, 120),
    redirect_uris: redirectUris,
    grant_types: ['authorization_code'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: cleanScopes(body && body.scope),
    createdAt: new Date().toISOString(),
  };
  db.oauthClients[clientId] = client;
  writeDb(db);
  return apiSend(201, {
    client_id: clientId,
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    grant_types: client.grant_types,
    response_types: client.response_types,
    token_endpoint_auth_method: 'none',
    scope: client.scope,
  });
}

function handleAuthorize(db, req, query, apiSend, writeDb) {
  cleanup(db);
  const responseType = query.response_type || '';
  const clientId = query.client_id || '';
  const redirectUri = query.redirect_uri || '';
  const state = query.state || '';
  const scope = cleanScopes(query.scope || 'kiteline.read');
  const resource = String(query.resource || '');
  const codeChallenge = String(query.code_challenge || '');
  const codeChallengeMethod = String(query.code_challenge_method || '');
  const client = clientRecord(db, clientId);

  if (responseType !== 'code') {
    return apiSend(400, { error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' });
  }
  if (!client) return apiSend(400, { error: 'invalid_client', error_description: 'Unknown OAuth client' });
  if (!redirectUri || !redirectAllowedForClient(client, redirectUri)) {
    return apiSend(400, { error: 'invalid_redirect_uri', error_description: 'Redirect URI is not registered for this OAuth client' });
  }
  if (codeChallengeMethod !== 'S256' || !codeChallenge) {
    return apiSend(400, { error: 'invalid_request', error_description: 'PKCE code_challenge_method=S256 is required' });
  }
  const expectedResource = baseUrl(req) === ISSUER ? RESOURCE : `${baseUrl(req)}/mcp`;
  if (resource !== expectedResource) {
    return apiSend(400, { error: 'invalid_target', error_description: `resource must be ${expectedResource}` });
  }

  const id = uid('oap');
  db.oauthPending[id] = {
    id,
    clientId,
    clientName: client.client_name || 'ChatGPT',
    redirectUri,
    state,
    scope,
    resource,
    codeChallenge,
    codeChallengeMethod: 'S256',
    expires: Date.now() + PENDING_MS,
    createdAt: new Date().toISOString(),
  };
  writeDb(db);
  const appUrl = `${baseUrl(req)}/app?ai_oauth=${encodeURIComponent(id)}`;
  return apiSend(302, '', { Location: appUrl, 'Cache-Control': 'no-store' });
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
    clientName: pending.clientName || 'ChatGPT',
    scope: pending.scope,
    resource: pending.resource,
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
    const url = `${pending.redirectUri}${sep}error=access_denied&error_description=${encodeURIComponent('Kiteline access was not approved')}&state=${encodeURIComponent(pending.state || '')}`;
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
    scope: pending.scope,
    resource: pending.resource,
    codeChallenge: pending.codeChallenge,
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

function parseForm(raw) {
  const params = new URLSearchParams(String(raw || ''));
  const out = {};
  params.forEach((value, key) => { out[key] = value; });
  return out;
}

function exchangeToken(db, body, writeDb, security, ip) {
  ensureStores(db);
  cleanup(db);
  const grantType = String((body && body.grant_type) || '');
  const clientId = String((body && body.client_id) || '');
  const code = String((body && body.code) || '');
  const redirectUri = String((body && body.redirect_uri) || '');
  const resource = String((body && body.resource) || '');
  const verifier = String((body && body.code_verifier) || '');

  if (grantType !== 'authorization_code') {
    return { status: 400, body: { error: 'unsupported_grant_type' } };
  }
  const entry = db.oauthCodes[code];
  if (!entry || entry.expires < Date.now()) {
    return { status: 400, body: { error: 'invalid_grant', error_description: 'Code expired or unknown' } };
  }
  if (!clientId || clientId !== entry.clientId || !clientRecord(db, clientId)) {
    return { status: 401, body: { error: 'invalid_client' } };
  }
  if (entry.redirectUri !== redirectUri) {
    return { status: 400, body: { error: 'invalid_grant', error_description: 'redirect_uri mismatch' } };
  }
  if (resource !== entry.resource || resource !== RESOURCE) {
    return { status: 400, body: { error: 'invalid_target', error_description: `resource must be ${RESOURCE}` } };
  }
  if (!verifyPkce(verifier, entry.codeChallenge)) {
    return { status: 400, body: { error: 'invalid_grant', error_description: 'PKCE verification failed' } };
  }

  delete db.oauthCodes[code];
  const expiresAt = Date.now() + TOKEN_MS;
  const created = aiAuth.createToken(db, entry.email, {
    label: 'ChatGPT OAuth',
    permissions: entry.permissions,
    oauth: true,
    resource: entry.resource,
    scopes: String(entry.scope || 'kiteline.read').split(/\s+/).filter(Boolean),
    expiresAt,
  });
  security.audit(db, 'ai_oauth_token', { ip, email: entry.email, detail: created.id });
  writeDb(db);
  return {
    status: 200,
    body: {
      access_token: created.token,
      token_type: 'Bearer',
      expires_in: Math.floor(TOKEN_MS / 1000),
      scope: entry.scope || 'kiteline.read',
    },
  };
}

function handleTokenFromParsedBody(db, body, apiSend, writeDb, security, ip) {
  const result = exchangeToken(db, body || {}, writeDb, security, ip);
  return apiSend(result.status, result.body, { 'Cache-Control': 'no-store' });
}

function dbFile() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
  return path.join(dataDir, 'db.json');
}

function readMainDb() {
  const file = dbFile();
  const db = JSON.parse(fs.readFileSync(file, 'utf8'));
  tenants.prepareDb(db);
  return db;
}

function writeMainDb(db) {
  fs.writeFileSync(dbFile(), JSON.stringify(db, null, 2));
}

function handleRawTokenHttp(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > 1024 * 1024) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(400, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'invalid_request' }));
    }
  });
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8');
      const ctype = String(req.headers['content-type'] || '').toLowerCase();
      let body = {};
      if (ctype.includes('application/x-www-form-urlencoded')) body = parseForm(raw);
      else {
        try { body = raw ? JSON.parse(raw) : {}; } catch (_) { body = parseForm(raw); }
      }
      const db = readMainDb();
      const result = exchangeToken(db, body, writeMainDb, securityModule, securityModule.clientIp(req));
      res.writeHead(result.status, securityModule.securityHeaders({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }));
      res.end(JSON.stringify(result.body));
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: 'server_error', error_description: err.message || 'Token exchange failed' }));
      }
    }
  });
  return true;
}

function publicConfig(req) {
  const base = baseUrl(req);
  return {
    enabled: true,
    protocol: 'OAuth 2.1 Authorization Code + PKCE',
    issuer: base,
    resource: base === ISSUER ? RESOURCE : `${base}/mcp`,
    authorizationUrl: `${base}/api/ai/oauth/authorize`,
    tokenUrl: base === ISSUER ? TOKEN_ENDPOINT : `${base}/api/vedanta-ordering/oauth/token`,
    registrationUrl: `${base}/api/ai/oauth/register`,
    protectedResourceMetadata: `${base}/api/ai/oauth/resource-metadata`,
    authorizationServerMetadata: `${base}/api/ai/oauth/authorization-server-metadata`,
    scope: 'kiteline.read kiteline.write',
    note: 'ChatGPT MCP uses OAuth 2.1 + PKCE. Legacy kl_ai_ API tokens remain available for non-ChatGPT API clients.',
  };
}

async function handleRoute(opts) {
  const {
    db, req, parts, method, body, ip, apiSend, userFromReq, writeDb, query, security,
  } = opts;
  const action = parts[1] || '';

  if (action === 'authorize' && method === 'GET') {
    return handleAuthorize(db, req, query, apiSend, writeDb);
  }
  if (action === 'config' && method === 'GET') return apiSend(200, publicConfig(req));
  if (action === 'resource-metadata' && method === 'GET') return apiSend(200, protectedResourceMetadata(req), { 'Cache-Control': 'no-store' });
  if (action === 'authorization-server-metadata' && method === 'GET') return apiSend(200, authorizationServerMetadata(req), { 'Cache-Control': 'no-store' });
  if (action === 'register' && method === 'POST') return handleRegister(db, body || {}, apiSend, writeDb);
  if (action === 'pending' && method === 'GET') return handlePending(db, query, apiSend);
  if (action === 'approve' && method === 'POST') {
    const sessionUser = userFromReq(db, req);
    if (!sessionUser) return apiSend(401, { error: 'Sign in to approve ChatGPT access', code: 'session_required' });
    return handleApprove(db, sessionUser, body || {}, ip, apiSend, writeDb, security);
  }
  if (action === 'token' && method === 'POST') {
    return handleTokenFromParsedBody(db, body || {}, apiSend, writeDb, security, ip);
  }
  return apiSend(404, { error: 'Unknown OAuth route' });
}

module.exports = {
  RESOURCE,
  ISSUER,
  TOKEN_ENDPOINT,
  REGISTRATION_ENDPOINT,
  AUTHORIZATION_ENDPOINT,
  PROTECTED_RESOURCE_METADATA,
  publicConfig,
  protectedResourceMetadata,
  authorizationServerMetadata,
  handleRoute,
  handleRawTokenHttp,
  exchangeToken,
};