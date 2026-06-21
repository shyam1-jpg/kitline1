'use strict';

const billing = require('../billing');

function stripeKey() {
  return process.env.STRIPE_SECRET_KEY || '';
}

async function stripeRequest(path, params) {
  const key = stripeKey();
  if (!key) throw new Error('Stripe is not configured — add STRIPE_SECRET_KEY');
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

function isConfigured() {
  return !!stripeKey();
}

async function createCourseCheckout({ email, courseTitle, amountPence, baseUrl }) {
  if (!isConfigured()) {
    throw new Error('Online payment not configured — email contact@kiteline.uk');
  }
  const amount = Math.max(100, Number(amountPence) || 0);
  const base = (baseUrl || 'https://kiteline.uk').replace(/\/$/, '');
  const session = await stripeRequest('/checkout/sessions', {
    mode: 'payment',
    'line_items[0][price_data][currency]': 'gbp',
    'line_items[0][price_data][product_data][name]': courseTitle,
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][quantity]': '1',
    customer_email: email,
    client_reference_id: email,
    'metadata[type]': 'academy_course',
    'metadata[email]': email,
    'metadata[courseTitle]': courseTitle,
    'metadata[amountPence]': String(amount),
    success_url: base + '/academy/?checkout=success&session_id={CHECKOUT_SESSION_ID}',
    cancel_url: base + '/academy/?checkout=cancel',
  });
  return { url: session.url, sessionId: session.id };
}

async function handleCheckoutCompleted(session, db, writeDb, addEnrollment) {
  const meta = session.metadata || {};
  if (meta.type !== 'academy_course') return false;
  const email = (meta.email || session.customer_email || session.client_reference_id || '').toLowerCase();
  const courseTitle = meta.courseTitle || 'Kitline Academy course';
  const amountPence = Number(meta.amountPence || session.amount_total || 0);
  if (!email) return false;
  await addEnrollment(db, {
    email,
    courseTitle,
    amountPence,
    paid: true,
    stripeSessionId: session.id,
  });
  writeDb(db);
  console.log('[academy-billing] Enrolled:', email, courseTitle);
  return true;
}

module.exports = {
  isConfigured,
  createCourseCheckout,
  handleCheckoutCompleted,
};
