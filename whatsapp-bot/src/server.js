'use strict';

const { loadConfig, canSend } = require('./config');
const { createApp } = require('./app');

const config = loadConfig();
const app = createApp({ config });

const server = app.listen(config.port, () => {
  console.log('');
  console.log(`  ${config.botName}`);
  console.log(`  Webhook:  http://localhost:${config.port}/webhook`);
  console.log(`  Health:   http://localhost:${config.port}/health`);
  if (!config.verifyToken) {
    console.warn('  Missing WHATSAPP_VERIFY_TOKEN — Meta will not be able to verify this webhook.');
  }
  if (!config.appSecret) {
    console.warn('  Missing WHATSAPP_APP_SECRET — inbound POSTs will be rejected.');
  }
  if (!canSend(config)) {
    console.warn('  Missing phone number ID or access token — replies will be logged as dry-run.');
  }
  console.log('');
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
