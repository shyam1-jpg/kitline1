'use strict';

let sql = null;
let usePg = false;
let initPromise = null;

async function runSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS academy_users (
      email TEXT PRIMARY KEY,
      profile JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS academy_sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      last_used TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS academy_sessions_email ON academy_sessions(email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS academy_enrollments (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      course_title TEXT NOT NULL,
      amount_pence INT DEFAULT 0,
      paid BOOLEAN NOT NULL DEFAULT FALSE,
      stripe_session_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS academy_enrollments_email ON academy_enrollments(email)`;
  await sql`
    CREATE TABLE IF NOT EXISTS academy_email_verifications (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS academy_password_resets (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL
    )`;
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    if (!process.env.DATABASE_URL) return false;
    try {
      const { neon } = require('@neondatabase/serverless');
      sql = neon(process.env.DATABASE_URL);
      await runSchema();
      usePg = true;
      console.log('[academy-store] Using Neon Postgres');
      return true;
    } catch (e) {
      console.warn('[academy-store] Postgres unavailable, using JSON file:', e.message);
      return false;
    }
  })();
  return initPromise;
}

function usingPostgres() {
  return usePg;
}

async function migrateFromJson(db) {
  if (!usePg || !db) return;
  const users = db.academyUsers || {};
  const emails = Object.keys(users);
  if (!emails.length) return;
  for (const email of emails) {
    const existing = await sql`SELECT email FROM academy_users WHERE email = ${email}`;
    if (existing.length) continue;
    await sql`INSERT INTO academy_users (email, profile) VALUES (${email}, ${users[email]})`;
  }
  const regs = db.academyRegistrations || [];
  for (const r of regs) {
    if (!r.email) continue;
    const dup = await sql`SELECT id FROM academy_enrollments WHERE email = ${r.email} AND course_title = 'registration' LIMIT 1`;
    if (dup.length) continue;
    await sql`INSERT INTO academy_enrollments (email, course_title, paid, created_at) VALUES (${r.email}, 'registration', false, ${r.at || new Date().toISOString()})`;
  }
  console.log('[academy-store] Migrated', emails.length, 'users from JSON to Postgres');
}

async function getUser(db, email) {
  const em = (email || '').toLowerCase().trim();
  if (!em) return null;
  if (usePg) {
    const rows = await sql`SELECT profile FROM academy_users WHERE email = ${em}`;
    return rows[0] ? rows[0].profile : null;
  }
  return (db.academyUsers && db.academyUsers[em]) || null;
}

async function saveUser(db, email, user) {
  const em = (email || '').toLowerCase().trim();
  if (usePg) {
    user.updatedAt = new Date().toISOString();
    await sql`
      INSERT INTO academy_users (email, profile, updated_at)
      VALUES (${em}, ${user}, NOW())
      ON CONFLICT (email) DO UPDATE SET profile = ${user}, updated_at = NOW()
    `;
  }
  db.academyUsers = db.academyUsers || {};
  db.academyUsers[em] = user;
}

async function deleteSession(db, token) {
  if (usePg && token) {
    await sql`DELETE FROM academy_sessions WHERE token = ${token}`;
  }
  if (token && db.academyTokens && db.academyTokens[token]) delete db.academyTokens[token];
}

async function saveSession(db, token, email, expiresAt) {
  const em = email.toLowerCase();
  const exp = new Date(expiresAt).toISOString();
  if (usePg) {
    await sql`
      INSERT INTO academy_sessions (token, email, expires_at, last_used)
      VALUES (${token}, ${em}, ${exp}, NOW())
      ON CONFLICT (token) DO UPDATE SET last_used = NOW()
    `;
  }
  db.academyTokens = db.academyTokens || {};
  db.academyTokens[token] = { email: em, issued: Date.now(), expiresAt, lastUsed: Date.now() };
}

async function revokeAllSessions(db, email) {
  const em = email.toLowerCase();
  if (usePg) {
    await sql`DELETE FROM academy_sessions WHERE email = ${em}`;
  }
  Object.keys(db.academyTokens || {}).forEach((tok) => {
    if (db.academyTokens[tok].email === em) delete db.academyTokens[tok];
  });
}

async function sessionEntry(db, token) {
  if (!token || !token.startsWith('acad_')) return null;
  if (usePg) {
    const rows = await sql`SELECT email, expires_at FROM academy_sessions WHERE token = ${token}`;
    if (!rows.length) return null;
    const exp = new Date(rows[0].expires_at).getTime();
    if (Date.now() > exp) {
      await sql`DELETE FROM academy_sessions WHERE token = ${token}`;
      return null;
    }
    await sql`UPDATE academy_sessions SET last_used = NOW() WHERE token = ${token}`;
    return { email: rows[0].email, expiresAt: exp, lastUsed: Date.now() };
  }
  const entry = db.academyTokens && db.academyTokens[token];
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    delete db.academyTokens[token];
    return null;
  }
  entry.lastUsed = Date.now();
  return entry;
}

async function addRegistration(db, row) {
  db.academyRegistrations = db.academyRegistrations || [];
  db.academyRegistrations.unshift(row);
  if (usePg) {
    await sql`
      INSERT INTO academy_enrollments (email, course_title, paid, created_at)
      VALUES (${row.email}, 'registration', false, ${row.at || new Date().toISOString()})
    `;
  }
}

async function listRegistrations(db) {
  if (usePg) {
    const rows = await sql`
      SELECT u.email, u.profile, u.created_at
      FROM academy_users u
      ORDER BY u.created_at DESC
      LIMIT 5000
    `;
    return rows.map((r) => {
      const p = r.profile || {};
      return {
        at: r.created_at,
        email: r.email,
        firstName: p.firstName,
        lastName: p.lastName,
        country: p.country,
        lang: p.lang,
        ageGroup: p.ageGroup,
        gender: p.gender,
        phone: p.phone,
        city: p.city,
        postcode: p.postcode,
      };
    });
  }
  return db.academyRegistrations || [];
}

async function addEnrollment(db, { email, courseTitle, amountPence, paid, stripeSessionId }) {
  const row = {
    email: email.toLowerCase(),
    courseTitle,
    amountPence: amountPence || 0,
    paid: !!paid,
    stripeSessionId: stripeSessionId || '',
    at: new Date().toISOString(),
  };
  db.academyEnrollments = db.academyEnrollments || [];
  if (!db.academyEnrollments.find((e) => e.email === row.email && e.courseTitle === row.courseTitle && e.paid)) {
    db.academyEnrollments.unshift(row);
  }
  if (usePg) {
    await sql`
      INSERT INTO academy_enrollments (email, course_title, amount_pence, paid, stripe_session_id)
      VALUES (${row.email}, ${courseTitle}, ${row.amountPence}, ${row.paid}, ${stripeSessionId || null})
    `;
  }
  return row;
}

async function listEnrollments(db, email) {
  const em = (email || '').toLowerCase();
  if (usePg) {
    const rows = await sql`
      SELECT course_title, amount_pence, paid, created_at
      FROM academy_enrollments
      WHERE email = ${em} AND course_title <> 'registration' AND paid = true
      ORDER BY created_at DESC
    `;
    return rows.map((r) => ({
      courseTitle: r.course_title,
      amountPence: r.amount_pence,
      paid: r.paid,
      at: r.created_at,
    }));
  }
  return (db.academyEnrollments || []).filter((e) => e.email === em && e.paid);
}

async function saveEmailVerification(db, token, email, expires) {
  db.academyEmailVerifications = db.academyEmailVerifications || {};
  db.academyEmailVerifications[token] = { email: email.toLowerCase(), expires };
  if (usePg) {
    await sql`
      INSERT INTO academy_email_verifications (token, email, expires_at)
      VALUES (${token}, ${email.toLowerCase()}, ${new Date(expires).toISOString()})
    `;
  }
}

async function getEmailVerification(db, token) {
  if (usePg) {
    const rows = await sql`SELECT email, expires_at FROM academy_email_verifications WHERE token = ${token}`;
    if (!rows.length) return null;
    return { email: rows[0].email, expires: new Date(rows[0].expires_at).getTime() };
  }
  return db.academyEmailVerifications && db.academyEmailVerifications[token];
}

async function deleteEmailVerification(db, token) {
  if (usePg) await sql`DELETE FROM academy_email_verifications WHERE token = ${token}`;
  if (db.academyEmailVerifications) delete db.academyEmailVerifications[token];
}

async function savePasswordReset(db, token, email, expires) {
  db.academyPasswordResets = db.academyPasswordResets || {};
  db.academyPasswordResets[token] = { email: email.toLowerCase(), expires };
  if (usePg) {
    await sql`
      INSERT INTO academy_password_resets (token, email, expires_at)
      VALUES (${token}, ${email.toLowerCase()}, ${new Date(expires).toISOString()})
    `;
  }
}

async function getPasswordReset(db, token) {
  if (usePg) {
    const rows = await sql`SELECT email, expires_at FROM academy_password_resets WHERE token = ${token}`;
    if (!rows.length) return null;
    return { email: rows[0].email, expires: new Date(rows[0].expires_at).getTime() };
  }
  return db.academyPasswordResets && db.academyPasswordResets[token];
}

async function deletePasswordReset(db, token) {
  if (usePg) await sql`DELETE FROM academy_password_resets WHERE token = ${token}`;
  if (db.academyPasswordResets) delete db.academyPasswordResets[token];
}

module.exports = {
  init,
  usingPostgres,
  migrateFromJson,
  getUser,
  saveUser,
  deleteSession,
  saveSession,
  revokeAllSessions,
  sessionEntry,
  addRegistration,
  listRegistrations,
  addEnrollment,
  listEnrollments,
  saveEmailVerification,
  getEmailVerification,
  deleteEmailVerification,
  savePasswordReset,
  getPasswordReset,
  deletePasswordReset,
};
