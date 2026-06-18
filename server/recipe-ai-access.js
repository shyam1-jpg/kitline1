'use strict';

const crypto = require('crypto');
const billing = require('./billing');

const ADDON_ID = 'recipe_ai';
const ADDON_NAME = 'Recipe AI Assistant';
const ADDON_AMOUNT = Number(process.env.RECIPE_AI_ADDON_GBP || 12) * 100; // pence, default £12/mo
const TEXT_LIMIT = Number(process.env.RECIPE_AI_TEXT_LIMIT || 150);
const IMAGE_LIMIT = Number(process.env.RECIPE_AI_IMAGE_LIMIT || 15);
const PLATFORM_ENABLED = process.env.RECIPE_AI_ENABLED === 'true';
const PLATFORM_KEY = (process.env.OPENAI_API_KEY || '').trim();

function encSecret() {
  const raw = process.env.DATA_ENCRYPTION_KEY || process.env.INGEST_KEY || '';
  if (!raw) return null;
  return crypto.scryptSync(raw, 'kiteline-recipe-ai', 32);
}

function encryptKey(plain) {
  const secret = encSecret();
  if (!secret || !plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

function decryptKey(stored) {
  const secret = encSecret();
  if (!secret || !stored) return null;
  try {
    const [ivB, tagB, dataB] = String(stored).split('.');
    if (!ivB || !tagB || !dataB) return null;
    const iv = Buffer.from(ivB, 'base64');
    const tag = Buffer.from(tagB, 'base64');
    const data = Buffer.from(dataB, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

function monthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ensureUserAi(user) {
  if (!user) return null;
  if (!user.recipeAi) user.recipeAi = { usage: {} };
  if (!user.recipeAi.usage) user.recipeAi.usage = {};
  const mk = monthKey();
  if (user.recipeAi.usage.period !== mk) {
    user.recipeAi.usage = { period: mk, text: 0, image: 0 };
  }
  return user.recipeAi;
}

function platformAvailable() {
  return PLATFORM_ENABLED && !!PLATFORM_KEY;
}

function addonCatalog() {
  return {
    id: ADDON_ID,
    name: ADDON_NAME,
    description: 'AI ingredients, method steps & food photos — billed to your company, not shared with other kitchens',
    amount: ADDON_AMOUNT,
    currency: 'gbp',
    display: '£' + (ADDON_AMOUNT / 100) + '/mo',
    textLimit: TEXT_LIMIT,
    imageLimit: IMAGE_LIMIT,
    stripeEnabled: billing.isConfigured(),
  };
}

function hasKitelineAddon(db, email) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user || !user.recipeAi) return false;
  if (user.recipeAi.grantedByOwner) return true;
  if (user.recipeAi.kitelineActive) return true;
  const sub = db.subscriptions && db.subscriptions[em];
  return !!(sub && sub.recipeAiActive);
}

function getStatus(db, email) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  const ai = user ? ensureUserAi(user) : null;
  const addon = addonCatalog();
  const owner = billing.isOwner(em);

  if (owner) {
    return {
      enabled: platformAvailable(),
      mode: platformAvailable() ? 'owner' : 'none',
      billing: 'included',
      message: platformAvailable()
        ? 'Owner account — platform AI key (your OpenAI bill on Render).'
        : 'Add OPENAI_API_KEY + RECIPE_AI_ENABLED on Render for owner AI.',
      hasOwnKey: false,
      kitelineAddon: false,
      usage: ai ? ai.usage : null,
      limits: { text: null, image: null },
      addon,
      platformAvailable: platformAvailable(),
    };
  }

  const ownKey = ai && ai.openaiKeyEnc ? decryptKey(ai.openaiKeyEnc) : null;
  if (ownKey) {
    return {
      enabled: true,
      mode: 'byok',
      billing: 'openai_direct',
      message: 'Using your company OpenAI key — OpenAI bills you directly.',
      hasOwnKey: true,
      keyHint: ownKey.slice(0, 7) + '…' + ownKey.slice(-4),
      kitelineAddon: false,
      usage: ai.usage,
      limits: { text: null, image: null },
      addon,
      platformAvailable: platformAvailable(),
    };
  }

  if (hasKitelineAddon(db, em) && platformAvailable()) {
    const usage = ai.usage;
    return {
      enabled: true,
      mode: ai.grantedByOwner ? 'granted' : 'kiteline',
      billing: ai.grantedByOwner ? 'granted_by_kiteline' : 'kiteline_subscription',
      message: ai.grantedByOwner
        ? 'Recipe AI enabled for your company by Kiteline support.'
        : 'Recipe AI subscription active — usage billed to your company via Kiteline.',
      hasOwnKey: false,
      kitelineAddon: true,
      usage,
      limits: { text: TEXT_LIMIT, image: IMAGE_LIMIT },
      addon,
      platformAvailable: platformAvailable(),
    };
  }

  return {
    enabled: false,
    mode: 'none',
    billing: 'none',
    message: platformAvailable()
      ? 'Subscribe to Recipe AI (£' + (ADDON_AMOUNT / 100) + '/mo) or add your own OpenAI API key in Settings.'
      : 'Recipe AI is not available on the server yet — contact contact@kiteline.uk or add your own OpenAI key in Settings.',
    hasOwnKey: false,
    kitelineAddon: false,
    usage: ai ? ai.usage : null,
    limits: { text: TEXT_LIMIT, image: IMAGE_LIMIT },
    addon,
    platformAvailable: platformAvailable(),
  };
}

function actionKind(action) {
  return action === 'image' ? 'image' : 'text';
}

function resolveAccess(db, email, action) {
  const st = getStatus(db, email);
  if (!st.enabled) {
    return {
      ok: false,
      status: st,
      error: st.mode === 'none' && !st.platformAvailable
        ? 'Recipe AI is not set up on Kiteline yet — subscribe, add your OpenAI key in Settings, or email contact@kiteline.uk'
        : 'Recipe AI not enabled for your company — subscribe in Settings or add your own OpenAI API key',
    };
  }

  let apiKey = null;
  let billTo = 'platform';

  if (st.mode === 'byok') {
    const user = db.users[(email || '').toLowerCase().trim()];
    apiKey = user && user.recipeAi && user.recipeAi.openaiKeyEnc
      ? decryptKey(user.recipeAi.openaiKeyEnc)
      : null;
    if (!apiKey) {
      return { ok: false, status: st, error: 'Your OpenAI key could not be read — re-enter it in Settings' };
    }
    billTo = 'customer_openai';
  } else {
    if (!platformAvailable()) {
      return { ok: false, status: st, error: 'Kiteline AI platform key not configured' };
    }
    apiKey = PLATFORM_KEY;
    billTo = st.mode === 'owner' ? 'owner' : 'kiteline_addon';

    if (st.mode !== 'owner' && st.limits) {
      const user = db.users[(email || '').toLowerCase().trim()];
      const ai = ensureUserAi(user);
      const kind = actionKind(action);
      if (kind === 'image' && ai.usage.image >= st.limits.image) {
        return {
          ok: false,
          status: st,
          error: `Monthly AI photo limit reached (${st.limits.image}). Upgrade or add your own OpenAI key in Settings.`,
        };
      }
      if (kind === 'text' && ai.usage.text >= st.limits.text) {
        return {
          ok: false,
          status: st,
          error: `Monthly AI text limit reached (${st.limits.text}). Upgrade or add your own OpenAI key in Settings.`,
        };
      }
    }
  }

  return { ok: true, apiKey, billTo, status: st };
}

function recordUsage(db, email, action) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user) return;
  const ai = ensureUserAi(user);
  const kind = actionKind(action);
  if (kind === 'image') ai.usage.image = (ai.usage.image || 0) + 1;
  else ai.usage.text = (ai.usage.text || 0) + 1;
}

function saveOwnKey(db, email, apiKey) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user) throw new Error('User not found');
  const key = String(apiKey || '').trim();
  if (!key.startsWith('sk-')) throw new Error('OpenAI API keys start with sk-');
  const ai = ensureUserAi(user);
  ai.openaiKeyEnc = encryptKey(key);
  if (!encSecret()) throw new Error('Server encryption not configured — contact Kiteline support');
  ai.mode = 'byok';
  ai.kitelineActive = false;
  return getStatus(db, em);
}

function removeOwnKey(db, email) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user || !user.recipeAi) return getStatus(db, em);
  delete user.recipeAi.openaiKeyEnc;
  if (!user.recipeAi.kitelineActive && !user.recipeAi.grantedByOwner) delete user.recipeAi.mode;
  return getStatus(db, em);
}

function grantAccess(db, targetEmail, enable) {
  const em = (targetEmail || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user) throw new Error('No account for that email — they must register first');
  const ai = ensureUserAi(user);
  ai.grantedByOwner = !!enable;
  if (enable) ai.kitelineActive = true;
  else if (!ai.openaiKeyEnc) {
    ai.kitelineActive = false;
    delete ai.grantedByOwner;
  }
  return getStatus(db, em);
}

function activateKitelineAddon(db, email, stripeMeta) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user) return;
  const ai = ensureUserAi(user);
  ai.kitelineActive = true;
  ai.mode = 'kiteline';
  if (stripeMeta && stripeMeta.subscriptionId) {
    ai.stripeSubscriptionId = stripeMeta.subscriptionId;
  }
  if (db.subscriptions && db.subscriptions[em]) {
    db.subscriptions[em].recipeAiActive = true;
  }
}

function deactivateKitelineAddon(db, email) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (user && user.recipeAi && !user.recipeAi.grantedByOwner && !user.recipeAi.openaiKeyEnc) {
    user.recipeAi.kitelineActive = false;
    delete user.recipeAi.stripeSubscriptionId;
  }
  if (db.subscriptions && db.subscriptions[em]) {
    db.subscriptions[em].recipeAiActive = false;
  }
}

module.exports = {
  ADDON_ID,
  addonCatalog,
  platformAvailable,
  getStatus,
  resolveAccess,
  recordUsage,
  saveOwnKey,
  removeOwnKey,
  grantAccess,
  activateKitelineAddon,
  deactivateKitelineAddon,
  encryptKey,
  decryptKey,
};
