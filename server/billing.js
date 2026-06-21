'use strict';

const tenants = require('./tenants');

const crypto = require('crypto');

/** Monthly plans — price scales with team size; larger tiers get a lower per-user rate. Amounts in pence (GBP). */
const PLANS = {
  users_1: {
    id: 'users_1',
    name: 'Kiteline Starter',
    description: '1 user · 1 site · HACCP, logs, reports',
    amount: 1900,
    currency: 'gbp',
    maxUsers: 1,
    orgPlan: 'Kiteline Starter (1 user)',
  },
  users_5: {
    id: 'users_5',
    name: 'Kiteline Team 5',
    description: 'Up to 5 users · 1 site · all modules',
    amount: 4000,
    currency: 'gbp',
    maxUsers: 5,
    orgPlan: 'Kiteline Team (5 users)',
    popular: true,
  },
  users_10: {
    id: 'users_10',
    name: 'Kiteline Team 10',
    description: 'Up to 10 users · 1 site · all modules',
    amount: 7200,
    currency: 'gbp',
    maxUsers: 10,
    orgPlan: 'Kiteline Team (10 users)',
  },
  users_20: {
    id: 'users_20',
    name: 'Kiteline Team 20',
    description: 'Up to 20 users · multi-site · all modules',
    amount: 13000,
    currency: 'gbp',
    maxUsers: 20,
    orgPlan: 'Kiteline Team (20 users)',
  },
  users_50: {
    id: 'users_50',
    name: 'Kiteline Team 50',
    description: 'Up to 50 users · multi-site · volume discount',
    amount: 27500,
    currency: 'gbp',
    maxUsers: 50,
    orgPlan: 'Kiteline Team (50 users)',
    volumeDiscount: true,
  },
};

/** Legacy plan ids from older pricing page / settings */
const PLAN_ALIASES = {
  solo: 'users_1',
  team: 'users_5',
};

const TRIAL_DAYS = Number(process.env.TRIAL_DAYS || 14);
const TRIAL_MAX_USERS = Number(process.env.TRIAL_MAX_USERS || 5);

function recipeAiAccess() {
  return require('./recipe-ai-access');
}

function ownerEmail() {
  return (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase().trim();
}

function isOwner(email) {
  return (email || '').toLowerCase().trim() === ownerEmail();
}

function ensureTrial(user) {
  if (!user) return user;
  if (!user.trialEndsAt) {
    const startMs = user.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    user.trialStartedAt = user.trialStartedAt || user.createdAt || new Date(startMs).toISOString();
    user.trialEndsAt = new Date(startMs + TRIAL_DAYS * 86400000).toISOString();
  }
  return user;
}

function startTrial(user) {
  if (!user) return user;
  const now = Date.now();
  user.trialStartedAt = new Date(now).toISOString();
  user.trialEndsAt = new Date(now + TRIAL_DAYS * 86400000).toISOString();
  return user;
}

function getTrialInfo(user) {
  if (!user) return { active: false, expired: false, daysLeft: 0, endsAt: null, maxUsers: TRIAL_MAX_USERS };
  ensureTrial(user);
  const endsAt = user.trialEndsAt;
  const endsMs = new Date(endsAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((endsMs - Date.now()) / 86400000));
  const active = endsMs > Date.now();
  return {
    active,
    expired: !active,
    daysLeft,
    endsAt,
    startedAt: user.trialStartedAt,
    maxUsers: TRIAL_MAX_USERS,
    days: TRIAL_DAYS,
  };
}

function hasActiveSubscription(db, email) {
  const sub = getSubscription(db, email);
  return sub && sub.status === 'active';
}

function canAccess(db, email) {
  const em = (email || '').toLowerCase().trim();
  if (!em) return false;
  if (process.env.DEMO_MODE === 'true') return true;
  if (isOwner(em)) return true;
  if (hasActiveSubscription(db, em)) return true;
  const user = db.users[em];
  if (!user) return false;
  return getTrialInfo(user).active;
}

function orgForUser(db, email) {
  const state = tenants.getStateForUser(db, email);
  return state && state.org;
}

function syncOrgAccess(db, email) {
  const org = orgForUser(db, email);
  if (!org) return;
  const em = (email || '').toLowerCase().trim();
  if (isOwner(em)) {
    const sub = getSubscription(db, em);
    if (sub && sub.status === 'active' && sub.orgPlan) {
      org.plan = sub.orgPlan;
      if (sub.maxUsers) org.maxUsers = sub.maxUsers;
    } else if (/free trial/i.test(org.plan || '')) {
      org.plan = 'Complete Kiteline';
    }
    delete org.trialEndsAt;
    return;
  }
  if (hasActiveSubscription(db, em)) return;
  const user = db.users[em];
  if (!user) return;
  const trial = getTrialInfo(user);
  if (trial.active) {
    org.maxUsers = TRIAL_MAX_USERS;
    org.trialEndsAt = trial.endsAt;
  }
}

function getTrialStatus(db, email) {
  const em = (email || '').toLowerCase().trim();
  if (isOwner(em)) return { exempt: true, reason: 'owner' };
  if (hasActiveSubscription(db, em)) return { exempt: true, reason: 'subscription' };
  const user = db.users[em];
  if (!user) return { active: false, expired: true, daysLeft: 0 };
  const trial = getTrialInfo(user);
  return { exempt: false, ...trial };
}

function resolvePlanId(plan) {
  const id = (plan || '').trim();
  return PLAN_ALIASES[id] || id;
}

function secretKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

function webhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || '';
}

function isConfigured() {
  return !!secretKey();
}

function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:4001').replace(/\/$/, '');
}

function planById(id) {
  return PLANS[id] || null;
}

function planCatalog() {
  return Object.values(PLANS).map((p) => {
    const perUser = Math.round(p.amount / p.maxUsers);
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      amount: p.amount,
      currency: p.currency,
      maxUsers: p.maxUsers,
      display: '£' + (p.amount / 100) + '/mo',
      perUserDisplay: '£' + (perUser / 100).toFixed(perUser % 100 === 0 ? 0 : 2) + '/user',
      popular: !!p.popular,
      volumeDiscount: !!p.volumeDiscount,
    };
  });
}

async function stripeRequest(path, params) {
  const key = secretKey();
  if (!key) throw new Error('Stripe is not configured — add STRIPE_SECRET_KEY to server/.env');
  const body = new URLSearchParams(params).toString();
  const res = await fetch('https://api.stripe.com/v1' + path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Stripe HTTP ' + res.status);
  return data;
}

function ensureSubscriptions(db) {
  if (!db.subscriptions) db.subscriptions = {};
}

function getSubscription(db, email) {
  if (!email) return null;
  ensureSubscriptions(db);
  return db.subscriptions[email.toLowerCase()] || null;
}

function getUserLimit(db, email) {
  const em = (email || '').toLowerCase().trim();
  const sub = getSubscription(db, em);
  if (sub && sub.status === 'active' && sub.maxUsers) return sub.maxUsers;
  const user = db.users[em];
  if (user) {
    const trial = getTrialInfo(user);
    if (trial.active) return TRIAL_MAX_USERS;
  }
  const org = orgForUser(db, em);
  if (org && org.maxUsers) return org.maxUsers;
  return null;
}

function findEmailByCustomer(db, customerId) {
  if (!customerId) return null;
  ensureSubscriptions(db);
  for (const [email, sub] of Object.entries(db.subscriptions)) {
    if (sub.stripeCustomerId === customerId) return email;
  }
  return null;
}

function applySubscription(db, email, patch) {
  ensureSubscriptions(db);
  const key = email.toLowerCase();
  db.subscriptions[key] = Object.assign({}, db.subscriptions[key] || {}, patch, {
    email: key,
    updatedAt: new Date().toISOString(),
  });
  const org = orgForUser(db, key);
  if (org) {
    const owner = (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase();
    if (key === owner || !db.subscriptions[key].orgSynced) {
      if (patch.status === 'active' && patch.orgPlan) {
        org.plan = patch.orgPlan;
        if (patch.maxUsers) org.maxUsers = patch.maxUsers;
        db.subscriptions[key].orgSynced = true;
      } else if (patch.status === 'canceled') {
        org.plan = 'Demo / trial';
        delete org.maxUsers;
      }
    }
  }
}

async function createCheckout({ plan, email }) {
  const planId = resolvePlanId(plan);
  const p = PLANS[planId];
  if (!p) throw new Error('Unknown plan — pick a tier from the pricing page');
  const em = (email || '').toLowerCase().trim();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('Valid email required');

  const base = appBaseUrl();
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    'customer_email': em,
    'client_reference_id': em,
    'metadata[plan]': p.id,
    'metadata[email]': em,
    'metadata[maxUsers]': String(p.maxUsers),
    'subscription_data[metadata][plan]': p.id,
    'subscription_data[metadata][email]': em,
    'subscription_data[metadata][maxUsers]': String(p.maxUsers),
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': p.currency,
    'line_items[0][price_data][unit_amount]': String(p.amount),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': p.name,
    'line_items[0][price_data][product_data][description]': p.description,
    success_url: base + '/billing-success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: base + '/pricing.html?checkout=cancel',
  });

  return { url: session.url, sessionId: session.id, plan: p.id };
}

async function createRecipeAiCheckout({ email }) {
  const addon = recipeAiAccess().addonCatalog();
  if (!isConfigured()) {
    throw new Error('Online checkout not configured — email contact@kiteline.uk to enable Recipe AI for your company.');
  }
  const em = (email || '').toLowerCase().trim();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('Valid email required');
  const base = appBaseUrl();
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    'customer_email': em,
    'client_reference_id': em,
    'metadata[plan]': recipeAiAccess().ADDON_ID,
    'metadata[email]': em,
    'metadata[product]': 'recipe_ai',
    'subscription_data[metadata][plan]': recipeAiAccess().ADDON_ID,
    'subscription_data[metadata][email]': em,
    'subscription_data[metadata][product]': 'recipe_ai',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': addon.currency,
    'line_items[0][price_data][unit_amount]': String(addon.amount),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': addon.name,
    'line_items[0][price_data][product_data][description]': addon.description,
    success_url: base + '/billing-success.html?session_id={CHECKOUT_SESSION_ID}&addon=recipe_ai',
    cancel_url: base + '/app#settings',
  });
  return { url: session.url, sessionId: session.id, plan: recipeAiAccess().ADDON_ID };
}

async function createPortalSession(email, db) {
  const sub = getSubscription(db, email);
  if (!sub || !sub.stripeCustomerId) throw new Error('No active Stripe customer — subscribe first');
  const base = appBaseUrl();
  const session = await stripeRequest('/billing_portal/sessions', {
    customer: sub.stripeCustomerId,
    return_url: base + '/app#settings',
  });
  return { url: session.url };
}

function verifyWebhookSignature(rawBody, sigHeader) {
  const secret = webhookSecret();
  if (!secret) return false;
  if (!sigHeader) return false;
  const parts = {};
  sigHeader.split(',').forEach((bit) => {
    const i = bit.indexOf('=');
    if (i > 0) parts[bit.slice(0, i)] = bit.slice(i + 1);
  });
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;
  const signed = timestamp + '.' + rawBody;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(v1, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return v1 === expected;
  }
}

async function fetchStripeSubscription(subscriptionId) {
  const key = secretKey();
  const res = await fetch('https://api.stripe.com/v1/subscriptions/' + subscriptionId, {
    headers: { Authorization: 'Bearer ' + key },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || 'Stripe subscription fetch failed');
  return data;
}

function subscriptionFromStripe(sub, planHint) {
  const plan = resolvePlanId(planHint || (sub.metadata && sub.metadata.plan) || 'users_5');
  const p = PLANS[plan] || PLANS.users_5;
  const maxUsers = Number(sub.metadata && sub.metadata.maxUsers) || p.maxUsers;
  return {
    plan: p.id,
    orgPlan: p.orgPlan,
    maxUsers,
    status: sub.status,
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null,
  };
}

async function handleWebhook(rawBody, sigHeader, db, writeDb) {
  if (!verifyWebhookSignature(rawBody, sigHeader)) {
    return { ok: false, error: 'Invalid webhook signature' };
  }
  let event;
  try { event = JSON.parse(rawBody); } catch { return { ok: false, error: 'Invalid JSON' }; }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.metadata && session.metadata.type === 'academy_course') {
      try {
        const academyBilling = require('./academy/billing');
        const academyStore = require('./academy/store');
        const handled = await academyBilling.handleCheckoutCompleted(
          session,
          db,
          writeDb,
          academyStore.addEnrollment
        );
        if (handled) return { ok: true, type: event.type, academy: true };
      } catch (e) {
        console.error('[billing] academy checkout:', e.message);
      }
    }
    const email = ((session.metadata && session.metadata.email) || session.customer_email || session.client_reference_id || '').toLowerCase();
    const plan = resolvePlanId((session.metadata && session.metadata.plan) || 'users_5');
    if (email && session.subscription && plan === recipeAiAccess().ADDON_ID) {
      recipeAiAccess().activateKitelineAddon(db, email, { subscriptionId: session.subscription });
      ensureSubscriptions(db);
      db.subscriptions[email] = Object.assign({}, db.subscriptions[email] || {}, {
        email,
        recipeAiActive: true,
        stripeCustomerId: session.customer,
        recipeAiStripeSubscriptionId: session.subscription,
        updatedAt: new Date().toISOString(),
      });
      writeDb(db);
      console.log('[billing] Recipe AI subscribed:', email);
    } else if (email && session.subscription) {
      let subObj = {
        plan,
        orgPlan: (PLANS[plan] || PLANS.users_5).orgPlan,
        maxUsers: (PLANS[plan] || PLANS.users_5).maxUsers,
        status: 'active',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
      };
      try {
        const sub = await fetchStripeSubscription(session.subscription);
        subObj = subscriptionFromStripe(sub, plan);
      } catch (e) {
        console.error('[billing] subscription fetch:', e.message);
      }
      applySubscription(db, email, subObj);
      writeDb(db);
      console.log('[billing] Subscribed:', email, subObj.plan, subObj.maxUsers + ' users');
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    let email = ((sub.metadata && sub.metadata.email) || '').toLowerCase();
    if (!email) email = findEmailByCustomer(db, sub.customer) || '';
    const metaPlan = sub.metadata && sub.metadata.plan;
    if (email && metaPlan === recipeAiAccess().ADDON_ID) {
      if (sub.status === 'active') {
        recipeAiAccess().activateKitelineAddon(db, email, { subscriptionId: sub.id });
      } else {
        recipeAiAccess().deactivateKitelineAddon(db, email);
      }
      writeDb(db);
      console.log('[billing] Recipe AI subscription:', email, sub.status);
      return { ok: true, type: event.type };
    }
    const plan = resolvePlanId(
      (sub.metadata && sub.metadata.plan) ||
        (email && getSubscription(db, email) && getSubscription(db, email).plan) ||
        'users_5'
    );
    if (email) {
      applySubscription(db, email, subscriptionFromStripe(sub, plan));
      writeDb(db);
      console.log('[billing] Subscription updated:', email, sub.status);
    }
  }

  return { ok: true, type: event.type };
}

module.exports = {
  PLANS,
  PLAN_ALIASES,
  TRIAL_DAYS,
  TRIAL_MAX_USERS,
  resolvePlanId,
  isConfigured,
  planCatalog,
  planById,
  createCheckout,
  createRecipeAiCheckout,
  createPortalSession,
  getSubscription,
  getUserLimit,
  ensureTrial,
  startTrial,
  getTrialInfo,
  getTrialStatus,
  canAccess,
  syncOrgAccess,
  hasActiveSubscription,
  handleWebhook,
  appBaseUrl,
};
