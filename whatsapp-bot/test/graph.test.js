'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sendText } = require('../src/graph');

describe('sendText', () => {
  it('dry-runs when credentials are missing', async () => {
    const result = await sendText(
      { phoneNumberId: '', accessToken: '' },
      { to: '447700900123', body: 'Hi' }
    );
    assert.equal(result.dryRun, true);
    assert.equal(result.to, '447700900123');
  });

  it('POSTs a text message to Graph API', async () => {
    const original = global.fetch;
    let called;
    global.fetch = async (url, init) => {
      called = { url, init };
      return {
        ok: true,
        json: async () => ({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.out' }] }),
      };
    };
    try {
      const data = await sendText(
        {
          apiBase: 'https://graph.facebook.com',
          apiVersion: 'v25.0',
          phoneNumberId: '106540352242922',
          accessToken: 'EAAJB',
        },
        { to: '447700900123', body: 'Hello from the bot' }
      );
      assert.equal(called.url, 'https://graph.facebook.com/v25.0/106540352242922/messages');
      assert.equal(called.init.method, 'POST');
      assert.equal(called.init.headers.Authorization, 'Bearer EAAJB');
      assert.deepEqual(JSON.parse(called.init.body), {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '447700900123',
        type: 'text',
        text: { preview_url: false, body: 'Hello from the bot' },
      });
      assert.equal(data.messages[0].id, 'wamid.out');
    } finally {
      global.fetch = original;
    }
  });
});
