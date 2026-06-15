/* Kiteline — email + SMS alerts for temperature breaches */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const OUTBOX = path.join(DATA, 'outbox');
const SMS_OUTBOX = path.join(OUTBOX, 'sms');

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
}
loadEnvFile();

function accessOf(member) {
  if (member.access) return member.access;
  const t = (member.role || '').toLowerCase();
  if (/owner|head chef|director|admin|proprietor|gm|general manager/.test(t)) return 'Admin';
  if (/manager|compliance|supervisor|lead|head/.test(t)) return 'Manager';
  return 'Staff';
}

function normalizePhone(raw) {
  if (!raw) return null;
  let p = String(raw).replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+44' + p.slice(1);
  if (/^44\d/.test(p)) p = '+' + p;
  if (!p.startsWith('+')) p = '+44' + p;
  return p.length >= 10 ? p : null;
}

function emailRecipients(state, siteId) {
  const team = state.team || [];
  const extra = (process.env.NOTIFY_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
  const emails = new Set(extra);
  team.forEach((m) => {
    if (!m.email) return;
    const acc = accessOf(m);
    if (acc === 'Admin') emails.add(m.email.toLowerCase());
    else if (acc === 'Manager' && m.siteId === siteId) emails.add(m.email.toLowerCase());
  });
  if (!emails.size) emails.add('shyam_1@hotmail.co.uk');
  return [...emails];
}

function smsRecipients(state, siteId) {
  const phones = new Set();
  (process.env.NOTIFY_PHONE || '').split(',').forEach((s) => {
    const p = normalizePhone(s.trim());
    if (p) phones.add(p);
  });
  (state.team || []).forEach((m) => {
    const p = normalizePhone(m.phone);
    if (!p) return;
    const acc = accessOf(m);
    if (acc === 'Admin') phones.add(p);
    else if (acc === 'Manager' && m.siteId === siteId) phones.add(p);
  });
  return [...phones];
}

function siteName(state, siteId) {
  const s = (state.sites || []).find((x) => x.id === siteId);
  return s ? s.name : siteId || 'Kitchen';
}

function sensorName(state, sensorId) {
  const s = (state.sensors || []).find((x) => x.id === sensorId);
  return s ? s.name : 'Equipment';
}

function emailEnabled(state) {
  return !!(state.org && state.org.channels && state.org.channels.email);
}

function smsEnabled(state) {
  return !!(state.org && state.org.channels && state.org.channels.sms);
}

function buildMessage(state, alert) {
  const site = siteName(state, alert.site);
  const equip = alert.title || sensorName(state, alert.sensor);
  const subject = `[Kiteline] ${equip} — ${site}`;
  const text = [
    'Kiteline alert',
    '',
    `Site: ${site}`,
    `Alert: ${equip}`,
    `Detail: ${alert.detail || ''}`,
    `Time: ${alert.at || new Date().toISOString()}`,
    '',
    'Open Kiteline → Alerts to resolve.',
  ].join('\n');
  const smsText = `Kiteline: ${equip} at ${site}. ${alert.detail || 'Check app Alerts.'}`.slice(0, 320);
  const html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px">
    <h2 style="color:#0d9488;margin:0 0 12px">Kiteline alert</h2>
    <p style="margin:0 0 8px"><b>Site:</b> ${site}</p>
    <p style="margin:0 0 8px"><b>Equipment:</b> ${equip}</p>
    <p style="margin:0 0 8px"><b>Reading:</b> ${alert.detail || ''}</p>
    <p style="margin:0 0 16px;color:#64748b;font-size:13px">${alert.at || ''}</p>
    <p style="font-size:13px;color:#475569">Sign in to Kiteline → <b>Alerts</b> to acknowledge and resolve.</p>
  </div>`;
  return { subject, text, smsText, html };
}

async function sendViaSmtp(to, msg) {
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch { return null; }
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  const transporter = nodemailer.createTransport({
    host,
    port: +(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  });
  const from = process.env.SMTP_FROM || `Kiteline <${user}>`;
  const info = await transporter.sendMail({ from, to, subject: msg.subject, text: msg.text, html: msg.html });
  return { mode: 'smtp', messageId: info.messageId, to };
}

function sendToOutbox(to, msg) {
  if (!fs.existsSync(OUTBOX)) fs.mkdirSync(OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUTBOX, `${stamp}.html`);
  const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${msg.subject}</title></head>
    <body style="padding:24px;font-family:system-ui,sans-serif">
    <p style="color:#64748b;font-size:12px">To: ${to.join(', ')}</p>
    <h1 style="font-size:18px">${msg.subject}</h1>
    <pre style="background:#f8fafc;padding:16px;border-radius:8px;white-space:pre-wrap">${msg.text}</pre>
    ${msg.html}
    </body></html>`;
  fs.writeFileSync(file, body);
  return { mode: 'outbox', file, to };
}

async function sendViaTwilio(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return null;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const results = [];
  for (const phone of to) {
    const params = new URLSearchParams({ To: phone, From: from, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Twilio HTTP ${res.status}`);
    results.push({ phone, sid: data.sid });
  }
  return { mode: 'twilio', messages: results, to };
}

function sendSmsToOutbox(to, body) {
  if (!fs.existsSync(SMS_OUTBOX)) fs.mkdirSync(SMS_OUTBOX, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(SMS_OUTBOX, `${stamp}.txt`);
  fs.writeFileSync(file, `To: ${to.join(', ')}\n\n${body}\n`);
  return { mode: 'sms-outbox', file, to };
}

async function sendEmail(state, alert) {
  if (!emailEnabled(state)) return { skipped: true, reason: 'email channel disabled' };
  const to = emailRecipients(state, alert.site);
  const msg = buildMessage(state, alert);
  try {
    const smtp = await sendViaSmtp(to, msg);
    if (smtp) {
      console.log('[notify] SMTP sent →', to.join(', '), '|', msg.subject);
      return smtp;
    }
    const out = sendToOutbox(to, msg);
    console.log('[notify] Outbox saved →', out.file);
    return out;
  } catch (e) {
    const out = sendToOutbox(to, msg);
    console.error('[notify] SMTP failed, outbox fallback:', e.message);
    return Object.assign(out, { smtpError: e.message });
  }
}

async function sendSms(state, alert) {
  if (!smsEnabled(state)) return { skipped: true, reason: 'sms channel disabled' };
  const to = smsRecipients(state, alert.site);
  if (!to.length) return { skipped: true, reason: 'no phone numbers — set NOTIFY_PHONE or add mobile on Team' };
  const msg = buildMessage(state, alert);
  try {
    const tw = await sendViaTwilio(to, msg.smsText);
    if (tw) {
      console.log('[notify] SMS sent →', to.join(', '));
      return tw;
    }
    const out = sendSmsToOutbox(to, msg.smsText);
    console.log('[notify] SMS outbox →', out.file);
    return out;
  } catch (e) {
    const out = sendSmsToOutbox(to, msg.smsText);
    console.error('[notify] Twilio failed, outbox fallback:', e.message);
    return Object.assign(out, { twilioError: e.message });
  }
}

function newOpenAlerts(prevState, nextState) {
  const prev = new Set(((prevState && prevState.alerts) || []).map((a) => a.id));
  return ((nextState && nextState.alerts) || []).filter(
    (a) => a.status === 'open' && !prev.has(a.id) && !a._notified && !a._emailed
  );
}

async function notifyAlert(state, alert) {
  const email = await sendEmail(state, alert);
  const sms = await sendSms(state, alert);
  const sent = (email && !email.skipped) || (sms && !sms.skipped);
  if (sent) alert._notified = true;
  return { email, sms };
}

async function processNewAlerts(prevState, nextState) {
  const fresh = newOpenAlerts(prevState, nextState);
  const results = [];
  for (const alert of fresh) {
    const r = await notifyAlert(nextState, alert);
    results.push({ alertId: alert.id, ...r });
  }
  return results;
}

function testAlert(state) {
  return {
    id: 'test_' + Date.now(),
    severity: 'critical',
    site: state.currentSite || 'site_grove',
    sensor: 's1',
    title: 'Test alert — Walk-in Fridge',
    detail: '4.8°C (limit 0–4°C) — Kiteline test notification',
    at: new Date().toISOString(),
    status: 'open',
  };
}

async function sendTestEmail(state) {
  return sendEmail(state, testAlert(state));
}

async function sendTestSms(state) {
  return sendSms(state, testAlert(state));
}

function channelStatus() {
  return {
    email: {
      configured: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      smtpHost: process.env.SMTP_HOST || null,
    },
    sms: {
      configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      from: process.env.TWILIO_FROM_NUMBER || null,
    },
  };
}

function ownerEmails() {
  const emails = new Set();
  emails.add((process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase());
  (process.env.NOTIFY_TO || '').split(',').forEach((s) => {
    const e = s.trim().toLowerCase();
    if (e && e.includes('@')) emails.add(e);
  });
  return [...emails];
}

async function sendRawEmail(to, msg) {
  const list = Array.isArray(to) ? to : [to];
  try {
    const smtp = await sendViaSmtp(list, msg);
    if (smtp) {
      console.log('[notify] Email sent →', list.join(', '), '|', msg.subject);
      return smtp;
    }
    const out = sendToOutbox(list, msg);
    console.log('[notify] Outbox saved →', out.file);
    return out;
  } catch (e) {
    const out = sendToOutbox(list, msg);
    console.error('[notify] SMTP failed, outbox fallback:', e.message);
    return Object.assign(out, { smtpError: e.message });
  }
}

const WAITLIST_LABELS = {
  'sensor-kit': 'SafeServe Sensor Kit',
  'printer-bundle': 'LabelSmart Printer Bundle',
  'label-rolls': '62 mm Label Rolls',
  'full-bundle': 'Full bundle (software + hardware)',
};

async function notifyWaitlistSignup(entry) {
  const product = WAITLIST_LABELS[entry.product] || entry.product || 'Unknown';
  const subject = `[Kiteline] Waitlist: ${product} — ${entry.name}`;
  const text = [
    'New hardware waitlist sign-up',
    '',
    `Product: ${product}`,
    `Name: ${entry.name}`,
    `Email: ${entry.email}`,
    `Mobile: ${entry.phone || '—'}`,
    `Sites: ${entry.sites || '—'}`,
    `Notes: ${entry.note || '—'}`,
    `When: ${entry.at || new Date().toISOString()}`,
    '',
    'View all sign-ups in the app → Settings → Hardware waitlist',
  ].join('\n');
  const html = `<div style="font-family:Inter,system-ui,sans-serif;max-width:520px">
    <h2 style="color:#0d9488;margin:0 0 12px">New hardware waitlist sign-up</h2>
    <p style="margin:0 0 8px"><b>Product:</b> ${product}</p>
    <p style="margin:0 0 8px"><b>Name:</b> ${entry.name}</p>
    <p style="margin:0 0 8px"><b>Email:</b> <a href="mailto:${entry.email}">${entry.email}</a></p>
    <p style="margin:0 0 8px"><b>Mobile:</b> ${entry.phone || '—'}</p>
    <p style="margin:0 0 8px"><b>Sites:</b> ${entry.sites || '—'}</p>
    <p style="margin:0 0 8px"><b>Notes:</b> ${entry.note || '—'}</p>
    <p style="font-size:13px;color:#64748b">${entry.at || ''}</p>
  </div>`;
  return sendRawEmail(ownerEmails(), { subject, text, html });
}

module.exports = {
  sendEmail,
  sendSms,
  notifyAlert,
  processNewAlerts,
  sendTestEmail,
  sendTestSms,
  emailRecipients,
  smsRecipients,
  emailEnabled,
  smsEnabled,
  channelStatus,
  normalizePhone,
  notifyWaitlistSignup,
  sendRawEmail,
};
