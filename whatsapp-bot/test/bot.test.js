'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { replyFor, replyForNonText } = require('../src/bot');

describe('replyFor', () => {
  it('greets hello / hi', () => {
    const hello = replyFor('Hello!', { name: 'Shyam Prasad', botName: 'Kiteline Assistant' });
    assert.equal(hello.intent, 'hello');
    assert.match(hello.text, /Hi Shyam Prasad/);
    assert.match(hello.text, /help/i);

    assert.equal(replyFor('hi', { name: 'Shyam' }).intent, 'hello');
    assert.equal(replyFor('good morning', { name: 'Shyam' }).intent, 'hello');
  });

  it('lists commands on help', () => {
    const help = replyFor('help', { name: 'Shyam', botName: 'Kiteline Assistant' });
    assert.equal(help.intent, 'help');
    assert.match(help.text, /hello/i);
    assert.match(help.text, /ping/i);
  });

  it('answers ping', () => {
    const ping = replyFor('ping');
    assert.equal(ping.intent, 'ping');
    assert.match(ping.text, /Pong/i);
  });

  it('falls back for unknown text', () => {
    const unknown = replyFor('book me a table for 7', { name: 'Shyam' });
    assert.equal(unknown.intent, 'unknown');
    assert.match(unknown.text, /book me a table for 7/);
    assert.match(unknown.text, /help/);
  });

  it('handles blank and non-text', () => {
    assert.equal(replyFor('   ', { name: 'Shyam' }).intent, 'empty');
    const image = replyForNonText('image', { name: 'Shyam' });
    assert.equal(image.intent, 'unsupported');
    assert.match(image.text, /image/);
  });
});
