'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { signBody } = require('../src/signature');
const { sampleInboundPayload } = require('../src/parse');
const { messagesUrl } = require('../src/graph');

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('webhook server', () => {
  const verifyToken = 'verify-me';
  const appSecret = 'test-app-secret';
  const sent = [];
  let server;
  let url;

  before(async () => {
    const app = createApp({
      config: {
        port: 0,
        phoneNumberId: '1234567890',
        accessToken: 'token',
        verifyToken,
        appSecret,
        apiVersion: 'v25.0',
        apiBase: 'https://graph.facebook.com',
        botName: 'Kiteline Assistant',
        nodeEnv: 'test',
      },
      sendText: async (_config, payload) => {
        sent.push(payload);
        return { messaging_product: 'whatsapp', messages: [{ id: 'wamid.out' }] };
      },
    });
    const started = await listen(app);
    server = started.server;
    url = started.url;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns the hub challenge when the verify token matches', async () => {
    const res = await fetch(
      `${url}/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=1158201444`
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), '1158201444');
  });

  it('rejects a wrong verify token', async () => {
    const res = await fetch(
      `${url}/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1`
    );
    assert.equal(res.status, 403);
  });

  it('rejects an unsigned or badly signed POST', async () => {
    const payload = sampleInboundPayload({ text: 'hello', id: 'wamid.bad-sig' });
    const raw = JSON.stringify(payload);
    const unsigned = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: raw,
    });
    assert.equal(unsigned.status, 403);

    const bad = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signBody(raw, 'wrong-secret'),
      },
      body: raw,
    });
    assert.equal(bad.status, 403);
  });

  it('replies to a signed hello and ignores a duplicate id', async () => {
    sent.length = 0;
    const payload = sampleInboundPayload({
      text: 'hello',
      name: 'Shyam Prasad',
      from: '447700900123',
      id: 'wamid.hello-1',
    });
    const raw = JSON.stringify(payload);
    const res = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signBody(raw, appSecret),
      },
      body: raw,
    });
    assert.equal(res.status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, '447700900123');
    assert.match(sent[0].body, /Hi Shyam Prasad/);

    const again = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signBody(raw, appSecret),
      },
      body: raw,
    });
    assert.equal(again.status, 200);
    assert.equal(sent.length, 1);
  });

  it('acks status-only webhooks without sending a reply', async () => {
    sent.length = 0;
    const payload = {
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                statuses: [{ id: 'wamid.out', status: 'delivered' }],
              },
            },
          ],
        },
      ],
    };
    const raw = JSON.stringify(payload);
    const res = await fetch(`${url}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signBody(raw, appSecret),
      },
      body: raw,
    });
    assert.equal(res.status, 200);
    assert.equal(sent.length, 0);
  });

  it('builds the Cloud API messages URL', () => {
    assert.equal(
      messagesUrl({
        apiBase: 'https://graph.facebook.com',
        apiVersion: 'v25.0',
        phoneNumberId: '1234567890',
      }),
      'https://graph.facebook.com/v25.0/1234567890/messages'
    );
  });

  it('serves health', async () => {
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.service, 'whatsapp-bot');
  });
});
