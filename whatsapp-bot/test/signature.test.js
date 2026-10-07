'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { signBody, isValidSignature, tokensMatch } = require('../src/signature');

describe('signature', () => {
  it('accepts a matching HMAC and rejects a tampered one', () => {
    const secret = 'app-secret';
    const body = '{"object":"whatsapp_business_account"}';
    const header = signBody(body, secret);
    assert.equal(isValidSignature(body, header, secret), true);
    assert.equal(isValidSignature(body + 'x', header, secret), false);
    assert.equal(isValidSignature(body, 'sha256=deadbeef', secret), false);
    assert.equal(isValidSignature(body, header, 'wrong'), false);
    assert.equal(isValidSignature(body, 'md5=abc', secret), false);
  });

  it('compares verify tokens safely', () => {
    assert.equal(tokensMatch('same-token', 'same-token'), true);
    assert.equal(tokensMatch('same-token', 'other-token'), false);
    assert.equal(tokensMatch('', 'same-token'), false);
    assert.equal(tokensMatch('same-token', ''), false);
  });
});
