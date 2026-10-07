'use strict';

/**
 * Pull inbound user messages out of a WhatsApp Cloud API webhook body.
 * Status callbacks (sent / delivered / read) are ignored.
 */
function extractInboundMessages(payload) {
  const messages = [];
  if (!payload || !Array.isArray(payload.entry)) return messages;

  for (const entry of payload.entry) {
    const changes = (entry && entry.changes) || [];
    for (const change of changes) {
      const value = (change && change.value) || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const inbound = Array.isArray(value.messages) ? value.messages : [];
      for (const message of inbound) {
        if (!message || !message.id || !message.from) continue;
        const contact = contacts.find((c) => c.wa_id === message.from) || contacts[0] || {};
        messages.push({
          id: message.id,
          from: message.from,
          type: message.type || 'unknown',
          text: message.text && message.text.body ? String(message.text.body) : '',
          name: contact.profile && contact.profile.name ? String(contact.profile.name) : '',
          timestamp: message.timestamp || '',
        });
      }
    }
  }

  return messages;
}

function sampleInboundPayload({ from, text, name, id } = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WABA_ID',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15550001234',
                phone_number_id: 'PHONE_NUMBER_ID',
              },
              contacts: [
                {
                  profile: { name: name || 'Shyam Prasad' },
                  wa_id: from || '447700900123',
                },
              ],
              messages: [
                {
                  from: from || '447700900123',
                  id: id || 'wamid.test.' + Date.now(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: 'text',
                  text: { body: text || 'hello' },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

module.exports = { extractInboundMessages, sampleInboundPayload };
