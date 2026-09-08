'use strict';

// Real HTTP OAuth flow against an isolated local server; never uses live accounts.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { once } = require('events');
const security = require('../server/security');

async function main() {
  const root = path.resolve(__dirname, '..');
  const scratch = path.join(root, '.test-work');
  fs.mkdirSync(scratch, { recursive: true });
  const dataDir = fs.mkdtempSync(path.join(scratch, 'oauth-'));
  const dbFile = path.join(dataDir, 'db.json');
  const email = 'oauth-test@example.test';
  const tenantId = 'tenant_oauth_test';
  const db = { users: { [email]: { email, tenantId, emailVerified: true } }, tokens: {},
    tenants: { [tenantId]: { _tenantId: tenantId, org: { name: 'OAuth Test' },
      sites: [{ id: 'site_test', name: 'Test Kitchen' }], currentSite: 'site_test',
      team: [{ email, access: 'Admin', siteId: 'site_test' }], recipes: [], menus: [],
      sensors: [], records: [], batches: [], suppliers: [] } }, _tenantVersion: 1 };
  const session = security.issueToken(db, email);
  fs.writeFileSync(dbFile, JSON.stringify(db));
  const probe = http.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: root,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
      NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1',
      DATA_DIR: dataDir, APP_URL: 'https://kiteline.uk', DEMO_MODE: 'false',
      INGEST_KEY: 'isolated-test-only', VEDANTA_REPORTS_ENABLED: 'false' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', b => { output += b; });
  child.stderr.on('data', b => { output += b; });
  const request = async (route, options = {}) => {
    const response = await fetch(base + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, body: text ? JSON.parse(text) : null };
  };
  const post = (route, body, token) => request(route, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body) });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { ready = (await request('/health')).status === 200; } catch (_) {}
      if (ready) break;
      if (child.exitCode !== null) throw new Error(output);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'local server starts');
    for (const route of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
      const meta = await request(route);
      assert.equal(meta.status, 200);
      assert.match(meta.headers.get('content-type'), /application\/json/);
      assert.equal(meta.body.resource, 'https://kiteline.uk/mcp');
    }
    const authMeta = await request('/.well-known/oauth-authorization-server');
    assert.equal(authMeta.body.token_endpoint, 'https://kiteline.uk/api/ai/oauth/token');
    const preflight = await request('/mcp', { method: 'OPTIONS', headers: { Origin: 'https://chatgpt.com',
      'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'mcp-protocol-version,mcp-session-id' } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://chatgpt.com');
    assert.match(preflight.headers.get('access-control-allow-headers'), /MCP-Protocol-Version/i);
    const rpc = (method, params, token) => post('/mcp', { jsonrpc: '2.0', id: 1, method, params }, token);
    assert.equal((await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {},
      clientInfo: { name: 'test', version: '1' } })).status, 200);
    assert.equal((await post('/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
    const unauth = await rpc('tools/call', { name: 'search_recipes', arguments: {} });
    assert.equal(unauth.status, 401);
    assert.ok(unauth.body.result._meta['mcp/www_authenticate']);
    assert.match(unauth.headers.get('access-control-expose-headers'), /WWW-Authenticate/);
    const redirectUri = 'https://chatgpt.com/connector/oauth/test';
    const registered = await post('/api/ai/oauth/register', { redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none', client_name: 'Local regression test' });
    assert.equal(registered.status, 201);
    const verifier = crypto.randomBytes(48).toString('base64url');
    const query = new URLSearchParams({ response_type: 'code', client_id: registered.body.client_id,
      redirect_uri: redirectUri, scope: 'kiteline.read kiteline.write', state: 'test-state',
      resource: 'https://kiteline.uk/mcp', code_challenge_method: 'S256',
      code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url') });
    const authorize = await request('/api/ai/oauth/authorize?' + query);
    assert.equal(authorize.status, 302);
    const pendingId = new URL(authorize.headers.get('location')).searchParams.get('ai_oauth');
    const approve = await post('/api/ai/oauth/approve', { pendingId, approve: true,
      permissions: { read_recipes: true, add_temperature_logs: true } }, session);
    assert.equal(approve.status, 200);
    const callback = new URL(approve.body.redirect);
    assert.equal(callback.searchParams.get('state'), 'test-state');
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: registered.body.client_id,
      redirect_uri: redirectUri, resource: 'https://kiteline.uk/mcp', code_verifier: verifier,
      code: callback.searchParams.get('code') });
    const exchange = await request('/api/ai/oauth/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    assert.equal(exchange.status, 200, JSON.stringify(exchange.body));
    const search = await rpc('tools/call', { name: 'search_recipes', arguments: {} }, exchange.body.access_token);
    assert.equal(search.status, 200);
    assert.ok(!search.body.result.isError);
    const replay = await request('/api/ai/oauth/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    assert.equal(replay.body.error, 'invalid_grant');
    const legacy = await request('/api/vedanta-ordering/oauth/token', { method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString() });
    assert.equal(legacy.body.error, 'invalid_grant');
    const stored = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    assert.ok(Object.values(stored.aiTokens).some(t => t.permissions.add_temperature_logs));
    console.log('PASS HTTP discovery, CORS, initialize, auth challenge, DCR, consent, form token exchange, authenticated tool, code replay rejection and legacy endpoint');
  } finally {
    const stopped = once(child, 'exit');
    child.kill();
    await stopped;
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
