'use strict';

/**
 * ChatGPT/MCP compatibility wrapper.
 *
 * Keeps the proven Kiteline tool implementations in ai-mcp-core.js while
 * adding current OpenAI OAuth signalling: per-tool securitySchemes,
 * RFC 9728 discovery, and mcp/www_authenticate challenges.
 */

const crypto = require('crypto');
const security = require('./security');
const aiAuth = require('./ai-auth');
const core = require('./ai-mcp-core');

const RESOURCE_METADATA = 'https://kiteline.uk/api/ai/oauth/resource-metadata';
const READ_SCOPES = ['kiteline.read'];
const WRITE_SCOPES = ['kiteline.read', 'kiteline.write'];

function oauthSecurity(t) {
  return [{ type: 'oauth2', scopes: t.mutating ? WRITE_SCOPES : READ_SCOPES }];
}

const TOOL_DEFS = core.TOOL_DEFS.map((t) => Object.assign({}, t, {
  securitySchemes: oauthSecurity(t),
}));

function challenge(error, description, scopes) {
  const scope = (scopes && scopes.length ? scopes : READ_SCOPES).join(' ');
  const safeError = String(error || 'invalid_token').replace(/["\\]/g, '');
  const safeDescription = String(description || 'Connect Kiteline to continue').replace(/["\\]/g, '');
  return `Bearer resource_metadata="${RESOURCE_METADATA}", scope="${scope}", error="${safeError}", error_description="${safeDescription}"`;
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id: id == null ? null : id, result };
}

function toolErrorResult(id, message, scopes, errorCode) {
  const authChallenge = challenge(errorCode || 'invalid_token', message, scopes);
  const obj = { error: message, code: errorCode || 'authentication_required' };
  return jsonRpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }],
    structuredContent: obj,
    _meta: { 'mcp/www_authenticate': [authChallenge] },
    isError: true,
  });
}

function discovery() {
  const d = core.discovery();
  return Object.assign({}, d, {
    version: '1.3.0',
    description:
      'Secure Kiteline MCP for ChatGPT. OAuth links each ChatGPT connection to one Kiteline company workspace. ' +
      'Tenant boundaries, role permissions and explicit confirmation continue to apply to every tool call.',
    authentication: {
      type: 'oauth2.1',
      flow: 'authorization_code_pkce',
      pkce: 'S256',
      resource_metadata: RESOURCE_METADATA,
      authorization_server: 'https://kiteline.uk',
      note: 'ChatGPT should connect with OAuth. Manual kl_ai_ keys are legacy API credentials and are not required for MCP linking.',
    },
    chatgpt_setup: {
      important: 'Use the Kiteline MCP URL. ChatGPT should discover OAuth automatically and open the Kiteline sign-in/approval screen when a tool needs access.',
      steps: [
        'In a ChatGPT workspace/account that supports custom MCP apps, create or add a developer-mode app.',
        'Name: Kiteline',
        'MCP server URL: https://kiteline.uk/mcp',
        'Scan tools. Kiteline publishes OAuth security metadata on each tool.',
        'When ChatGPT asks to connect, sign in to Kiteline and approve the requested permissions.',
        'Return to the chat and enable Kiteline.',
      ],
    },
    tools: TOOL_DEFS.map((t) => ({
      name: t.name,
      description: t.description,
      mutating: t.mutating,
      confirmationRequired: t.mutating,
      annotations: t.annotations || null,
      securitySchemes: t.securitySchemes,
    })),
  });
}

async function handleJsonRpc(body, opts) {
  const msg = body && typeof body === 'object' ? body : null;
  const method = msg && String(msg.method || '');

  if (method === 'initialize') {
    const r = await core.handleJsonRpc(body, opts);
    if (r && r.payload && r.payload.result) {
      r.payload.result.serverInfo = Object.assign({}, r.payload.result.serverInfo, { version: '1.3.0' });
      r.payload.result.instructions =
        'Kiteline uses OAuth 2.1 Authorization Code + PKCE. Tools are tenant-scoped to the linked company workspace. ' +
        'Mutating/export tools still require confirm: true after explicit user approval.';
    }
    return r;
  }

  if (method === 'tools/list') {
    const r = await core.handleJsonRpc(body, opts);
    if (r && r.payload && r.payload.result && Array.isArray(r.payload.result.tools)) {
      r.payload.result.tools = r.payload.result.tools.map((tool) => {
        const def = TOOL_DEFS.find((t) => t.name === tool.name);
        return Object.assign({}, tool, {
          securitySchemes: def ? def.securitySchemes : [{ type: 'oauth2', scopes: READ_SCOPES }],
        });
      });
    }
    return r;
  }

  if (method === 'tools/call') {
    const name = String(msg && msg.params && msg.params.name || '');
    const def = TOOL_DEFS.find((t) => t.name === name);
    const scopes = def && def.mutating ? WRITE_SCOPES : READ_SCOPES;
    const auth = aiAuth.resolveAiAuth(opts.db, opts.req);
    if (!auth) {
      const header = challenge('invalid_token', 'Sign in to Kiteline and approve ChatGPT access to continue', scopes);
      return {
        status: 401,
        headers: { 'WWW-Authenticate': header },
        payload: toolErrorResult(msg.id, 'Authentication required: connect Kiteline to continue.', scopes, 'invalid_token'),
      };
    }
    if (auth.entry.oauth) {
      const granted = new Set(auth.entry.scopes || []);
      const missing = scopes.filter((s) => !granted.has(s));
      if (missing.length) {
        const header = challenge('insufficient_scope', `Additional Kiteline scope required: ${missing.join(' ')}`, scopes);
        return {
          status: 401,
          headers: { 'WWW-Authenticate': header },
          payload: toolErrorResult(msg.id, 'Additional Kiteline permission is required. Reconnect to approve the requested scope.', scopes, 'insufficient_scope'),
        };
      }
    }
  }

  return core.handleJsonRpc(body, opts);
}

function wantsEventStream(req) {
  const accept = String((req.headers && req.headers.accept) || '').toLowerCase();
  return accept.includes('text/event-stream');
}

function mcpCorsOrigin(req) {
  const origin = (req && req.headers && req.headers.origin) || '';
  if (!origin) return '*';
  if (/^https:\/\/([a-z0-9-]+\.)?(chatgpt\.com|openai\.com|oaistatic\.com)$/i.test(origin)) return origin;
  return security.corsOrigin(req, process.env.NODE_ENV === 'production' || !!process.env.RENDER);
}

function writeRaw(res, req, status, payload, extraHeaders) {
  const cors = mcpCorsOrigin(req);
  const headers = Object.assign({
    'Access-Control-Allow-Origin': cors,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, Accept, Mcp-Session-Id',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Cache-Control': 'no-store',
  }, extraHeaders || {});
  if (payload == null) {
    res.writeHead(status, security.securityHeaders(headers));
    return res.end();
  }
  headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, security.securityHeaders(headers));
  return res.end(text);
}

async function handleHttp(opts) {
  const { req, res, method, body, db, writeDb, ip, send } = opts;

  if (method === 'OPTIONS') return writeRaw(res, req, 204, null);
  if ((method === 'GET' || method === 'HEAD') && wantsEventStream(req)) {
    return writeRaw(res, req, 405, { error: 'SSE listen is not required; use POST JSON-RPC (streamable HTTP).' });
  }
  if (method === 'GET' || method === 'HEAD') return send(res, 200, discovery(), null, req);
  if (method === 'DELETE') return writeRaw(res, req, 200, { ok: true });

  if (method === 'POST') {
    const rpc = await handleJsonRpc(body, { db, req, ip, writeDb });
    if (rpc.empty) return writeRaw(res, req, rpc.status || 202, null, rpc.headers);
    const extra = Object.assign({}, rpc.headers || {});
    if (body && body.method === 'initialize') extra['Mcp-Session-Id'] = crypto.randomBytes(16).toString('hex');
    return writeRaw(res, req, rpc.status, rpc.payload, extra);
  }

  return send(res, 405, { error: 'Method not allowed. Use GET (discovery) or POST (JSON-RPC).' }, null, req);
}

module.exports = Object.assign({}, core, {
  handleHttp,
  handleJsonRpc,
  discovery,
  TOOL_DEFS,
  PROTOCOL_VERSION: core.PROTOCOL_VERSION,
});