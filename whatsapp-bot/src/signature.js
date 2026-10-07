'use strict';

const crypto = require('crypto');

function signBody(rawBody, appSecret) {
  return 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
}

function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader || rawBody == null) return false;
  const incoming = String(signatureHeader);
  if (!incoming.startsWith('sha256=')) return false;
  const expected = signBody(rawBody, appSecret);
  const a = Buffer.from(incoming);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function tokensMatch(provided, expected) {
  if (!provided || !expected) return false;
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signBody, isValidSignature, tokensMatch };
