'use strict';

/**
 * Compatibility wrapper around the Vedanta Ordering API.
 *
 * The main Kiteline HTTP server intentionally hands this prefix the raw
 * request stream before its JSON parser. We use one isolated sub-route as
 * the standards-compliant OAuth token endpoint because OAuth 2.1 clients
 * send application/x-www-form-urlencoded bodies.
 */

const core = require('./vedanta-ordering-core');
const aiOauth = require('./ai-oauth');

function handleApi(req, res, url) {
  if (url && url.pathname === '/api/vedanta-ordering/oauth/token') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      });
      res.end();
      return true;
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: 'method_not_allowed' }));
      return true;
    }
    return aiOauth.handleRawTokenHttp(req, res);
  }
  return core.handleApi(req, res, url);
}

module.exports = Object.assign({}, core, { handleApi });