'use strict';

const express = require('express');
const { loadConfig } = require('./config');
const { isValidSignature, tokensMatch } = require('./signature');
const { extractInboundMessages } = require('./parse');
const { replyFor, replyForNonText } = require('./bot');
const { sendText } = require('./graph');
const { createSeenStore } = require('./seen');

function createApp(options = {}) {
  const config = options.config || loadConfig();
  const send = options.sendText || sendText;
  const seen = options.seen || createSeenStore();
  const app = express();

  app.disable('x-powered-by');

  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'whatsapp-bot',
      bot: config.botName,
      configured: Boolean(config.phoneNumberId && config.accessToken && config.verifyToken && config.appSecret),
    });
  });

  app.get('/', (_req, res) => {
    res
      .type('html')
      .send(
        `<!doctype html><meta charset="utf-8"><title>${config.botName}</title>` +
          `<body style="font-family:system-ui;max-width:40rem;margin:3rem auto;line-height:1.5">` +
          `<h1>${config.botName}</h1>` +
          `<p>WhatsApp Cloud API webhook is running.</p>` +
          `<p>Point Meta at <code>/webhook</code> on this host. See <code>whatsapp-bot/README.md</code>.</p>` +
          `</body>`
      );
  });

  // Meta verification: GET ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && tokensMatch(token, config.verifyToken) && challenge != null) {
      console.log('[whatsapp-bot] webhook verified');
      return res.status(200).type('text/plain').send(String(challenge));
    }
    return res.status(403).type('text/plain').send('Forbidden');
  });

  app.post('/webhook', async (req, res) => {
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const skipSig = options.allowUnsigned === true && !config.appSecret;

    if (!skipSig) {
      if (!config.appSecret) {
        console.warn('[whatsapp-bot] WHATSAPP_APP_SECRET is not set; refusing unsigned webhook');
        return res.status(500).type('text/plain').send('App secret not configured');
      }
      if (!isValidSignature(raw, req.get('X-Hub-Signature-256'), config.appSecret)) {
        console.warn('[whatsapp-bot] invalid webhook signature');
        return res.status(403).type('text/plain').send('Invalid signature');
      }
    }

    const inbound = extractInboundMessages(req.body);
    for (const message of inbound) {
      if (seen.has(message.id)) continue;
      seen.add(message.id);

      const reply =
        message.type === 'text'
          ? replyFor(message.text, { name: message.name, from: message.from, botName: config.botName })
          : replyForNonText(message.type, { name: message.name, botName: config.botName });

      try {
        await send(config, { to: message.from, body: reply.text });
        console.log(`[whatsapp-bot] ${message.from} intent=${reply.intent}`);
      } catch (err) {
        console.error(`[whatsapp-bot] reply failed for ${message.id}:`, err.message || err);
      }
    }

    // Always 200 after a valid signature so Meta does not retry for hours.
    res.status(200).json({ ok: true });
  });

  return app;
}

module.exports = { createApp };
