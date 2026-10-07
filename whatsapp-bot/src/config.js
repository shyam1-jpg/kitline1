'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function loadConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
    apiVersion: process.env.WHATSAPP_GRAPH_API_VERSION || 'v25.0',
    apiBase: (process.env.WHATSAPP_GRAPH_API_BASE || 'https://graph.facebook.com').replace(/\/$/, ''),
    botName: process.env.WHATSAPP_BOT_NAME || 'Kiteline Assistant',
    nodeEnv: process.env.NODE_ENV || 'development',
  };
}

function canSend(config) {
  return Boolean(config.phoneNumberId && config.accessToken);
}

module.exports = { loadConfig, canSend };
