'use strict';

const fs = require('fs');
const path = require('path');
const notify = require('./notify');

const FB_PROJECT = process.env.VEDANTA_FB_PROJECT || 'the-vedanta';
const FB_API_KEY = process.env.VEDANTA_FB_API_KEY || 'AIzaSyAufPj-x1FK5czAAnxOmVrm9lwMJ9oSTd0';
const REPORT_TO = (process.env.VEDANTA_REPORT_EMAIL || 'Operation@thevedanta.org').trim();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'vedanta-report-state.json');
const TZ = 'Europe/London';

function reportRecipients() {
  const extra = (process.env.VEDANTA_REPORT_CC || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [REPORT_TO, ...extra].filter(Boolean);
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { lastWeekly: null, lastMonthly: null };
  }
}

function saveState(state) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function ukNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function weekKey(d) {
  const mon = new Date(d);
  const day = mon.getDay();
  mon.setDate(mon.getDate() - day + (day === 0 ? -6 : 1));
  return mon.toISOString().slice(0, 10);
}

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseField(v) {
  if (!v || typeof v !== 'object') return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return parseFloat(v.doubleValue);
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  return null;
}

function parseDoc(doc) {
  const out = { _id: (doc.name || '').split('/').pop() };
  const fields = doc.fields || {};
  Object.keys(fields).forEach((k) => {
    out[k] = parseField(fields[k]);
  });
  return out;
}

async function fetchCollection(collectionId) {
  const items = [];
  let pageToken = '';
  const base = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/(default)/documents/${collectionId}`;
  do {
    const url = pageToken ? `${base}?pageToken=${encodeURIComponent(pageToken)}` : base;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`Firestore ${collectionId}: HTTP ${res.status} ${err.slice(0, 200)}`);
    }
    const data = await res.json();
    (data.documents || []).forEach((doc) => items.push(parseDoc(doc)));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return items;
}

async function loadVedantaData() {
  const [staff, clock, leaveRequests, auditLog] = await Promise.all([
    fetchCollection('staff').catch(() => []),
    fetchCollection('clock').catch(() => []),
    fetchCollection('leave_requests').catch(() => []),
    fetchCollection('audit_log').catch(() => []),
  ]);
  staff.sort((a, b) => (a.id || 0) - (b.id || 0));
  auditLog.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return { staff, clock, leaveRequests, auditLog, fetchedAt: new Date().toISOString() };
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: TZ, dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso || '—';
  }
}

function buildWeeklyReport(data) {
  const now = ukNow();
  const subject = `The Vedanta — Weekly Staff Rota Report (w/c ${weekKey(now)})`;
  const pendingLeave = data.leaveRequests.filter((r) => r.status === 'pending');
  const recentAudit = data.auditLog.slice(0, 40);
  const today = now.toISOString().slice(0, 10);
  const todayClock = data.clock.filter((c) => String(c._id || '').includes(today));

  const staffRows = data.staff.map((s) =>
    `<tr><td>${s.name || '—'}</td><td>${s.role || '—'}</td><td>${s.dept || '—'}</td><td>${s.type === 'temp' ? 'Cover' : 'Permanent'}</td><td>${s.annualLeft ?? '—'}</td></tr>`
  ).join('');

  const clockRows = todayClock.map((c) => {
    const sid = String(c._id || '').split('_')[0];
    const st = data.staff.find((x) => String(x.id) === sid);
    return `<tr><td>${st?.name || sid}</td><td>${c.clockIn || '—'}</td><td>${c.clockOut || '—'}</td></tr>`;
  }).join('') || '<tr><td colspan="3">No clock entries for today in cloud</td></tr>';

  const auditRows = recentAudit.map((a) =>
    `<tr><td>${fmtDate(a.at)}</td><td>${a.action || '—'}</td><td>${a.staffName || a.role || '—'}</td><td>${a.detail || ''}</td></tr>`
  ).join('') || '<tr><td colspan="4">No activity logged yet</td></tr>';

  const html = `
  <div style="font-family:Georgia,serif;max-width:640px;color:#1C1C1C">
    <h1 style="color:#B8963E;font-size:22px;margin:0 0 8px">The Vedanta — Weekly Report</h1>
    <p style="color:#666;font-size:13px;margin:0 0 20px">Week commencing ${weekKey(now)} · Generated ${fmtDate(data.fetchedAt)}</p>
    <p style="font-size:14px;line-height:1.6"><strong>Data source:</strong> Firebase Cloud (the-vedanta) — staff, rotas, clock in/out, leave &amp; login activity sync from all devices.</p>
    <h2 style="font-size:16px;color:#B8963E;border-bottom:2px solid #B8963E;padding-bottom:4px">Staff (${data.staff.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px" cellpadding="6" border="1">
      <tr style="background:#1C1C1C;color:#D4B86A"><th>Name</th><th>Role</th><th>Dept</th><th>Type</th><th>Leave left</th></tr>
      ${staffRows}
    </table>
    <h2 style="font-size:16px;color:#B8963E;border-bottom:2px solid #B8963E;padding-bottom:4px">Today's clock in/out</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px" cellpadding="6" border="1">
      <tr style="background:#1C1C1C;color:#D4B86A"><th>Staff</th><th>Clock in</th><th>Clock out</th></tr>
      ${clockRows}
    </table>
    <h2 style="font-size:16px;color:#B8963E;border-bottom:2px solid #B8963E;padding-bottom:4px">Pending leave (${pendingLeave.length})</h2>
    ${pendingLeave.length ? `<ul>${pendingLeave.map((r) => `<li>${r.staffName} — ${r.date}${r.note ? ' (' + r.note + ')' : ''}</li>`).join('')}</ul>` : '<p>None pending</p>'}
    <h2 style="font-size:16px;color:#B8963E;border-bottom:2px solid #B8963E;padding-bottom:4px">Recent login / logout activity</h2>
    <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:20px" cellpadding="5" border="1">
      <tr style="background:#1C1C1C;color:#D4B86A"><th>When</th><th>Action</th><th>Who</th><th>Detail</th></tr>
      ${auditRows}
    </table>
    <p style="font-size:12px;color:#888">App: <a href="https://kiteline.uk/vedanta-rota/">kiteline.uk/vedanta-rota</a> · Automatic weekly email every Monday ~7:00 UK</p>
  </div>`;

  const text = [
    subject,
    '',
    `Staff count: ${data.staff.length}`,
    `Pending leave: ${pendingLeave.length}`,
    `Recent activity entries: ${recentAudit.length}`,
    '',
    'Open app: https://kiteline.uk/vedanta-rota/',
  ].join('\n');

  return { subject, text, html };
}

function buildMonthlyReport(data) {
  const now = ukNow();
  const subject = `The Vedanta — Monthly Staff Report (${monthKey(now)})`;
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthClock = data.clock.filter((c) => String(c._id || '').includes(monthStart));
  const approvedLeave = data.leaveRequests.filter((r) => r.status === 'approved' && String(r.date || '').startsWith(monthStart));

  const html = `
  <div style="font-family:Georgia,serif;max-width:640px;color:#1C1C1C">
    <h1 style="color:#B8963E;font-size:22px;margin:0 0 8px">The Vedanta — Monthly Report</h1>
    <p style="color:#666;font-size:13px;margin:0 0 20px">${monthKey(now)} · Generated ${fmtDate(data.fetchedAt)}</p>
    <p style="font-size:14px"><strong>Backup:</strong> All rota, clock, staff PIN and leave data is stored in Firebase Firestore project <em>the-vedanta</em> and included in this report.</p>
    <ul style="font-size:14px;line-height:1.8">
      <li><strong>${data.staff.length}</strong> staff on system</li>
      <li><strong>${monthClock.length}</strong> clock in/out records this month</li>
      <li><strong>${approvedLeave.length}</strong> approved leave days this month</li>
      <li><strong>${data.auditLog.length}</strong> login/logout events in cloud</li>
    </ul>
    <h2 style="font-size:16px;color:#B8963E">Staff summary</h2>
    <table style="width:100%;border-collapse:collapse;font-size:12px" cellpadding="6" border="1">
      <tr style="background:#1C1C1C;color:#D4B86A"><th>Name</th><th>Department</th><th>Leave remaining</th></tr>
      ${data.staff.map((s) => `<tr><td>${s.name}</td><td>${s.dept}</td><td>${s.annualLeft ?? '—'} days</td></tr>`).join('')}
    </table>
    <p style="font-size:12px;color:#888;margin-top:24px">Sent automatically on the 27th of each month · <a href="https://kiteline.uk/vedanta-rota/">Open rota app</a></p>
  </div>`;

  const text = [
    subject,
    `Staff: ${data.staff.length}`,
    `Clock records this month: ${monthClock.length}`,
    `Approved leave this month: ${approvedLeave.length}`,
    'https://kiteline.uk/vedanta-rota/',
  ].join('\n');

  return { subject, text, html };
}

async function sendReport(type) {
  const data = await loadVedantaData();
  const msg = type === 'monthly' ? buildMonthlyReport(data) : buildWeeklyReport(data);
  const to = reportRecipients();
  const result = await notify.sendRawEmail(to, msg);
  console.log('[vedanta-report]', type, '→', to.join(', '), result.mode || 'ok');
  return { ok: true, type, to, result, staffCount: data.staff.length };
}

function shouldSendWeekly(now, state) {
  if (now.getDay() !== 1) return false;
  if (now.getHours() !== 7 || now.getMinutes() >= 20) return false;
  const key = weekKey(now);
  return state.lastWeekly !== key;
}

function shouldSendMonthly(now, state) {
  if (now.getDate() !== 27) return false;
  if (now.getHours() !== 7 || now.getMinutes() >= 20) return false;
  const key = monthKey(now);
  return state.lastMonthly !== key;
}

async function schedulerTick() {
  if (process.env.VEDANTA_REPORTS_ENABLED !== 'true') return;
  const now = ukNow();
  const state = loadState();
  try {
    if (shouldSendWeekly(now, state)) {
      await sendReport('weekly');
      state.lastWeekly = weekKey(now);
      saveState(state);
    } else if (shouldSendMonthly(now, state)) {
      await sendReport('monthly');
      state.lastMonthly = monthKey(now);
      saveState(state);
    }
  } catch (e) {
    console.error('[vedanta-report] scheduler error:', e.message);
  }
}

function autoEmailsEnabled() {
  return process.env.VEDANTA_REPORTS_ENABLED === 'true';
}

function startScheduler() {
  if (!autoEmailsEnabled()) {
    console.log('[vedanta-report] Automatic emails off — manual send only (Settings button). Set VEDANTA_REPORTS_ENABLED=true when going live.');
    return;
  }
  console.log('[vedanta-report] Scheduler on →', reportRecipients().join(', '), '| Mon 7:00 weekly · 27th 7:00 monthly (UK)');
  setInterval(schedulerTick, 10 * 60 * 1000);
  setTimeout(schedulerTick, 15000);
}

module.exports = {
  sendReport,
  loadVedantaData,
  startScheduler,
  reportRecipients,
  autoEmailsEnabled,
};
