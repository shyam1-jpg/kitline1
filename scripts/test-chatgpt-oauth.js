'use strict';

const assert = require('assert');
const crypto = require('crypto');
const aiAuth = require('../server/ai-auth');
const aiOauth = require('../server/ai-oauth');
const aiMcp = require('../server/ai-mcp');

async function main() {
  const meta = aiOauth.authorizationServerMetadata({ headers: { host: 'kiteline.uk', 'x-forwarded-proto': 'https' } });
  assert.ok(meta.code_challenge_methods_supported.includes('S256'));
  assert.ok(meta.token_endpoint_auth_methods_supported.includes('none'));
  assert.ok(meta.registration_endpoint.endsWith('/api/ai/oauth/register'));

  const resource = aiOauth.protectedResourceMetadata({ headers: { host: 'kiteline.uk', 'x-forwarded-proto': 'https' } });
  assert.strictEqual(resource.resource, 'https://kiteline.uk/mcp');
  assert.strictEqual(resource.authorization_servers[0], 'https://kiteline.uk');

  const email = 'owner@example.test';
  const tenantId = 'tenant_test';
  const siteId = 'site_test';
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~'.slice(0, 64);
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const db = {
    users: { [email]: { email, tenantId, name: 'Owner' } },
    tenants: {
      [tenantId]: {
        _tenantId: tenantId,
        org: { name: 'Test Kitchen' },
        currentSite: siteId,
        sites: [{ id: siteId, name: 'Main Kitchen' }],
        team: [{ email, access: 'Admin', siteId }],
        recipes: [], menus: [], sensors: [], records: [], batches: [], suppliers: [],
      },
    },
    aiTokens: {}, oauthCodes: {}, oauthPending: {}, oauthClients: {}, audit: [],
    _tenantVersion: 1,
  };
  const code = 'oac_test';
  db.oauthCodes[code] = {
    code,
    email,
    tenantId,
    clientId: 'kiteline-chatgpt',
    redirectUri: 'https://chatgpt.com/connector/oauth/test',
    permissions: aiAuth.defaultPermissions({ create_menu_drafts: true }),
    scope: 'kiteline.read kiteline.write',
    resource: 'https://kiteline.uk/mcp',
    codeChallenge: challenge,
    expires: Date.now() + 60000,
  };
  const token = aiOauth.exchangeToken(db, {
    grant_type: 'authorization_code',
    client_id: 'kiteline-chatgpt',
    code,
    redirect_uri: 'https://chatgpt.com/connector/oauth/test',
    resource: 'https://kiteline.uk/mcp',
    code_verifier: verifier,
  }, function () {}, { audit: function () {} }, '127.0.0.1');
  assert.strictEqual(token.status, 200);
  assert.ok(token.body.access_token.startsWith('kl_ai_'));

  const resolved = aiAuth.resolveAiAuth(db, { headers: { authorization: 'Bearer ' + token.body.access_token } });
  assert.ok(resolved && resolved.entry.oauth);
  assert.ok(resolved.entry.scopes.includes('kiteline.write'));

  const list = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    { db, req: { headers: {} }, ip: '127.0.0.1', writeDb: function () {} },
  );
  assert.strictEqual(list.status, 200);
  assert.ok(list.payload.result.tools.every((t) => Array.isArray(t.securitySchemes) && t.securitySchemes[0].type === 'oauth2'));

  const unauth = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'search_recipes', arguments: {} } },
    { db, req: { headers: {} }, ip: '127.0.0.1', writeDb: function () {} },
  );
  assert.strictEqual(unauth.status, 401);
  assert.ok(unauth.headers['WWW-Authenticate'].includes('resource_metadata='));
  assert.ok(unauth.payload.result._meta['mcp/www_authenticate']);

  console.log('PASS ChatGPT OAuth metadata, PKCE token exchange, scope binding and MCP auth challenge');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
