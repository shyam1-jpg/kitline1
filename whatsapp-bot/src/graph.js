'use strict';

const { canSend } = require('./config');

function messagesUrl(config) {
  return `${config.apiBase}/${config.apiVersion}/${config.phoneNumberId}/messages`;
}

async function sendText(config, { to, body }) {
  if (!to || !body) {
    throw new Error('sendText requires `to` and `body`');
  }

  if (!canSend(config)) {
    console.log(`[whatsapp-bot] dry-run reply → ${to}: ${body}`);
    return { dryRun: true, to, body };
  }

  const res = await fetch(messagesUrl(config), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.error && data.error.message ? data.error.message : res.statusText;
    throw new Error(`Cloud API ${res.status}: ${detail}`);
  }
  return data;
}

module.exports = { sendText, messagesUrl };
