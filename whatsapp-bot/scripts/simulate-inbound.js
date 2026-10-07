'use strict';

/**
 * POST a signed fake inbound WhatsApp message at the local webhook.
 * Usage: npm run simulate -- hello
 */
require('../src/config');
const { signBody } = require('../src/signature');
const { sampleInboundPayload } = require('../src/parse');

async function main() {
  const text = process.argv.slice(2).join(' ') || 'hello';
  const port = process.env.PORT || 3000;
  const appSecret = process.env.WHATSAPP_APP_SECRET || 'test-app-secret';
  const payload = sampleInboundPayload({
    text,
    name: 'Shyam Prasad',
    from: '447700900123',
  });
  const raw = JSON.stringify(payload);

  const res = await fetch(`http://127.0.0.1:${port}/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signBody(raw, appSecret),
    },
    body: raw,
  });

  const body = await res.text();
  console.log(res.status, body);
  if (!res.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
