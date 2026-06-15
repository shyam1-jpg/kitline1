'use strict';

const crypto = require('crypto');

const PLANS = {
  solo: {
    id: 'solo',
    name: 'SafeServe Solo',
    description: 'One site · one admin · HACCP, logs, reports',
    amount: 900,
    currency: 'gbp',
    orgPlan: 'SafeServe Solo',
  },
  team: {
    id: 'team',
    name: 'SafeServe Team',
    description: 'One site · multiple staff · all modules',
    amount: 1900,
    currency: 'gbp',
    orgPlan: 'SafeServe Team',
  },
};

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

function planCatalog() {
  return Object.values(PLANS).map((p) => ({
    id: p.id,
    name: p.name,
    amount: p.amount,
    currency: p.currency,
    display: '£' + (p.amount / 100) + '/mo',
  }));
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
  if (db.state && db.state.org) {
    const owner = (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase();
    if (key === owner || !db.subscriptions[key].orgSynced) {
      if (patch.status === 'active' && patch.orgPlan) {
        db.state.org.plan = patch.orgPlan;
        db.subscriptions[key].orgSynced = true;
      } else if (patch.status === 'canceled') {
        db.state.org.plan = 'Demo / trial';
      }
    }
  }
}

async function createCheckout({ plan, email }) {
  const p = PLANS[plan];
  if (!p) throw new Error('Unknown plan — use solo or team');
  const em = (email || '').toLowerCase().trim();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) throw new Error('Valid email required');

  const base = appBaseUrl();
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'subscription',
    'customer_email': em,
    'client_reference_id': em,
    'metadata[plan]': p.id,
    'metadata[email]': em,
    'subscription_data[metadata][plan]': p.id,
    'subscription_data[metadata][email]': em,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': p.currency,
    'line_items[0][price_data][unit_amount]': String(p.amount),
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': p.name,
    'line_items[0][price_data][product_data][description]': p.description,
    success_url: base + '/billing-success.html?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: base + '/pricing.html?checkout=cancel',
  });

  return { url: session.url, sessionId: session.id };
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
  const plan = planHint || (sub.metadata && sub.metadata.plan) || 'team';
  const p = PLANS[plan] || PLANS.team;
  return {
    plan: p.id,
    orgPlan: p.orgPlan,
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
    const email = ((session.metadata && session.metadata.email) || session.customer_email || session.client_reference_id || '').toLowerCase();
    const plan = (session.metadata && session.metadata.plan) || 'team';
    if (email && session.subscription) {
      let subObj = { plan, orgPlan: (PLANS[plan] || PLANS.team).orgPlan, status: 'active', stripeCustomerId: session.customer, stripeSubscriptionId: session.subscription };
      try {
        const sub = await fetchStripeSubscription(session.subscription);
        subObj = subscriptionFromStripe(sub, plan);
      } catch (e) {
        console.error('[billing] subscription fetch:', e.message);
      }
      applySubscription(db, email, subObj);
      writeDb(db);
      console.log('[billing] Subscribed:', email, subObj.plan);
    }
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = event.data.object;
    let email = ((sub.metadata && sub.metadata.email) || '').toLowerCase();
    if (!email) email = findEmailByCustomer(db, sub.customer) || '';
    const plan = (sub.metadata && sub.metadata.plan) || (email && getSubscription(db, email) && getSubscription(db, email).plan) || 'team';
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
  isConfigured,
  planCatalog,
  createCheckout,
  createPortalSession,
  getSubscription,
  handleWebhook,
  appBaseUrl,
};
