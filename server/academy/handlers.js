'use strict';

const crypto = require('crypto');
const academyStore = require('./store');
const academyCaptcha = require('./captcha');
const academyTotp = require('./totp');
const academyCookies = require('./cookies');
const academyBilling = require('./billing');
const academyFounder = require('./founder');
const billing = require('../billing');

const FREE_ACADEMY_COURSES = ['ai-world-starter', 'html-starter', 'css-starter', 'js-starter', 'python-starter'];

function prepareAcademyUser(user, paidEnrollments) {
  academyFounder.prepareAcademyAccess(user, ensureAcademyLearning, paidEnrollments);
  return user;
}

function ensureAcademyLearning(user) {
  if (!user) return user;
  if (!user.learning) {
    user.learning = { enrolled: FREE_ACADEMY_COURSES.slice(), progress: { courses: {} } };
    return user;
  }
  if (!Array.isArray(user.learning.enrolled)) user.learning.enrolled = FREE_ACADEMY_COURSES.slice();
  FREE_ACADEMY_COURSES.forEach((id) => {
    if (user.learning.enrolled.indexOf(id) < 0) user.learning.enrolled.push(id);
  });
  if (!user.learning.progress) user.learning.progress = { courses: {} };
  if (!user.learning.progress.courses) user.learning.progress.courses = {};
  return user;
}

function academyAdminKey() {
  return process.env.ACADEMY_ADMIN_KEY || '';
}

function isAcademyAdmin(req, body) {
  const key = academyAdminKey();
  if (!key) {
    const owner = (body && body.ownerEmail) || '';
    return billing.isOwner(owner);
  }
  const provided = (req.headers['x-academy-admin'] || (body && body.adminKey) || '').trim();
  return provided && provided === key;
}

function academySend(res, req, code, obj, opts, send, isProd) {
  const extra = {};
  if (opts && opts.token) extra['Set-Cookie'] = academyCookies.buildAcademySessionCookie(opts.token, isProd);
  if (opts && opts.clearSession) extra['Set-Cookie'] = academyCookies.buildClearAcademySessionCookie(isProd);
  const out = Object.assign({}, obj);
  if (opts && opts.token && out.token) delete out.token;
  return send(res, code, out, extra, req);
}

async function issueAcademySession(db, email) {
  const days = Number(process.env.ACADEMY_SESSION_DAYS || 7);
  const token = 'acad_' + crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + days * 86400000;
  await academyStore.saveSession(db, token, email, expiresAt);
  return token;
}

async function resolveAcademyUser(db, req, academyEmailVerificationRequired) {
  const token = academyCookies.academySessionToken(req);
  if (!token) return { user: null, token: '' };
  const entry = await academyStore.sessionEntry(db, token);
  if (!entry) return { user: null, token: '' };
  const user = await academyStore.getUser(db, entry.email);
  if (!user) return { user: null, token: '' };
  if (academyEmailVerificationRequired && academyEmailVerificationRequired() && user.emailVerified === false) {
    return { user: null, token: '' };
  }
  return { user, token };
}

function issue2faPending(db, email) {
  db.academy2faPending = db.academy2faPending || {};
  const pending = '2fa_' + crypto.randomBytes(24).toString('hex');
  db.academy2faPending[pending] = { email: email.toLowerCase(), expires: Date.now() + 300000 };
  return pending;
}

function consume2faPending(db, pending) {
  db.academy2faPending = db.academy2faPending || {};
  const entry = db.academy2faPending[pending];
  if (!entry || entry.expires < Date.now()) {
    if (entry) delete db.academy2faPending[pending];
    return null;
  }
  delete db.academy2faPending[pending];
  return entry.email;
}

function ctxEmailVerificationRequired() {
  return process.env.ACADEMY_REQUIRE_EMAIL_VERIFY === 'true' && require('../notify').smtpConfigured();
}

async function handleAcademyRoute(ctx) {
  const {
    route, req, res, body, ip, db, writeDb, send, isProd, APP_URL, url,
    security, notify, hashPassword, verifyPassword,
    validateAcademyProfile, publicAcademyUser, academyEmailVerificationRequired,
    sendAcademyVerificationEmail, completeAcademyEmailVerification,
  } = ctx;

  const apiSend = (code, obj, opts) => { academySend(res, req, code, obj, opts, send, isProd); return true; };
  const plainSend = (code, obj) => { send(res, code, obj, null, req); return true; };
  const academyPublicUser = (user) => Object.assign({}, publicAcademyUser(user), academyFounder.publicUserFlags(user));

  if (route === '/academy/config' && req.method === 'GET') {
    return plainSend(200, {
      emailVerification: academyEmailVerificationRequired(),
      emailConfigured: notify.smtpConfigured(),
      minPasswordScore: 3,
      minPasswordLength: 10,
      captcha: academyCaptcha.captchaPublicConfig(),
      stripe: academyBilling.isConfigured(),
      postgres: academyStore.usingPostgres(),
      sessionCookie: true,
      staffLoginPath: '/academy/staff.html',
    });
  }

  if (route === '/academy/staff/login' && req.method === 'POST') {
    const staffId = (body.staffId || '').trim();
    const email = (body.email || '').toLowerCase().trim();
    const password = body.password || '';
    if (!academyFounder.isValidStaffId(staffId)) {
      return plainSend(403, { error: 'Invalid staff login ID', code: 'invalid_staff_id' });
    }
    if (!email || !password) return plainSend(400, { error: 'Email and password required' });
    const user = await academyStore.getUser(db, email);
    if (!user || !verifyPassword(password, user.pass)) {
      security.audit(db, 'academy_staff_login_failed', { ip, email });
      writeDb(db);
      return plainSend(401, { error: 'Invalid email, password, or staff ID', code: 'invalid_credentials' });
    }
    if (academyEmailVerificationRequired() && user.emailVerified === false) {
      return plainSend(403, { error: 'Verify your email before using staff login.', code: 'email_not_verified' });
    }
    user.staffAccess = true;
    user.staffAccessAt = new Date().toISOString();
    const enrollments = await academyStore.listEnrollments(db, email);
    prepareAcademyUser(user, enrollments);
    await academyStore.saveUser(db, email, user);
    await academyStore.revokeAllSessions(db, email);
    const token = await issueAcademySession(db, email);
    security.audit(db, 'academy_staff_login_success', { ip, email });
    writeDb(db);
    return apiSend(200, {
      ok: true,
      user: academyPublicUser(user),
      message: 'Staff login successful — all courses unlocked in preview mode.',
    }, { token });
  }

  if (route === '/academy/register' && req.method === 'POST') {
    db.academyUsers = db.academyUsers || {};
    const rlReg = security.checkRateLimit(req, 'register');
    if (!rlReg.ok) return plainSend(429, { error: 'Too many registration attempts. Try again later.', code: 'rate_limited', retryAfter: rlReg.retryAfter });
    const cap = await academyCaptcha.verifyCaptcha(body.captchaToken, ip);
    if (!cap.ok) return plainSend(400, { error: cap.error });
    const password = body.password || '';
    const passwordConfirm = body.passwordConfirm || '';
    if (!password || !passwordConfirm) return plainSend(400, { error: 'Password and confirmation are required' });
    if (password !== passwordConfirm) return plainSend(400, { error: 'Passwords do not match' });
    const profileCheck = validateAcademyProfile(body);
    if (!profileCheck.ok) return plainSend(400, { error: profileCheck.error });
    const profile = profileCheck.profile;
    const pwCheck = security.validatePassword(password, profile.email);
    if (!pwCheck.ok) return plainSend(400, { error: pwCheck.error });
    if (security.passwordScore(password) < 3) {
      return plainSend(400, { error: 'Password too weak — use 12+ characters with upper, lower, number and symbol' });
    }
    const existing = await academyStore.getUser(db, profile.email);
    if (existing) return plainSend(409, { error: 'Account already exists — sign in instead', code: 'exists' });
    const needVerify = academyEmailVerificationRequired();
    const user = {
      ...profile,
      name: `${profile.firstName} ${profile.lastName}`.trim(),
      pass: hashPassword(password),
      emailVerified: !needVerify,
      failedAttempts: 0,
      totpEnabled: false,
      createdAt: new Date().toISOString(),
      learning: {
        enrolled: FREE_ACADEMY_COURSES.slice(),
        progress: { courses: {} },
      },
    };
    await academyStore.saveUser(db, profile.email, user);
    await academyStore.addRegistration(db, {
      at: user.createdAt, email: profile.email, firstName: profile.firstName, lastName: profile.lastName,
      country: profile.country, lang: profile.lang, ageGroup: profile.ageGroup, gender: profile.gender,
    });
    security.audit(db, 'academy_register', { ip, email: profile.email, country: profile.country, lang: profile.lang });
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    if (needVerify) {
      writeDb(db);
      const mail = await sendAcademyVerificationEmail(db, profile.email, base);
      return plainSend(200, {
        ok: true,
        needsVerification: true,
        emailSent: !!mail.emailSent,
        message: mail.emailSent
          ? 'Account created. We emailed you a verification link — check your inbox and spam/junk.'
          : 'Account created, but the verification email could not be sent. Please try Resend verification in a few minutes, or email contact@kiteline.uk for help.',
      });
    }
    const token = await issueAcademySession(db, profile.email);
    writeDb(db);
    prepareAcademyUser(user, []);
    return apiSend(200, {
      ok: true,
      user: academyPublicUser(user),
      message: 'Account created — welcome to Kiteline Academy',
    }, { token });
  }

  if (route === '/academy/login' && req.method === 'POST') {
    const rlLogin = security.checkRateLimit(req, 'login');
    if (!rlLogin.ok) return plainSend(429, { error: 'Too many login attempts. Try again later.', code: 'rate_limited', retryAfter: rlLogin.retryAfter });
    const cap = await academyCaptcha.verifyCaptcha(body.captchaToken, ip);
    if (!cap.ok) return plainSend(400, { error: cap.error });
    const email = (body.email || '').toLowerCase().trim();
    const password = body.password || '';
    if (!email || !password) return plainSend(400, { error: 'Email and password required' });
    const user = await academyStore.getUser(db, email);
    if (!user) {
      security.audit(db, 'academy_login_failed', { ip, email, detail: 'unknown_email' });
      writeDb(db);
      return plainSend(401, { error: 'Invalid email or password', code: 'invalid_credentials' });
    }
    if (security.isLocked(user)) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return plainSend(423, { error: 'Account temporarily locked after failed attempts. Try again in ' + mins + ' minute(s).', code: 'account_locked' });
    }
    if (academyEmailVerificationRequired() && user.emailVerified === false) {
      return plainSend(403, { error: 'Verify your email before signing in — click Resend verification on the sign-in form and check your inbox and spam/junk.', code: 'email_not_verified' });
    }
    if (!academyEmailVerificationRequired() && user.emailVerified === false) {
      user.emailVerified = true;
    }
    if (!verifyPassword(password, user.pass)) {
      security.recordFailedLogin(user);
      security.audit(db, 'academy_login_failed', { ip, email, detail: 'bad_password' });
      await academyStore.saveUser(db, email, user);
      writeDb(db);
      return plainSend(401, { error: 'Invalid email or password', code: 'invalid_credentials' });
    }
    security.clearLoginFailures(user);
    const enrollments = await academyStore.listEnrollments(db, email);
    prepareAcademyUser(user, enrollments);
    await academyStore.saveUser(db, email, user);
    if (user.totpEnabled && user.totpSecret) {
      const pendingToken = issue2faPending(db, email);
      writeDb(db);
      return plainSend(200, { ok: true, needs2fa: true, pendingToken, message: 'Enter the 6-digit code from your authenticator app.' });
    }
    await academyStore.revokeAllSessions(db, email);
    const token = await issueAcademySession(db, email);
    security.audit(db, 'academy_login_success', { ip, email });
    writeDb(db);
    return apiSend(200, { ok: true, user: academyPublicUser(user) }, { token });
  }

  if (route === '/academy/2fa/verify-login' && req.method === 'POST') {
    const pending = body.pendingToken || '';
    const code = body.code || '';
    const email = consume2faPending(db, pending);
    if (!email) return plainSend(400, { error: '2FA session expired — sign in again' });
    const user = await academyStore.getUser(db, email);
    if (!user || !user.totpSecret || !academyTotp.verifyTotp(user.totpSecret, code)) {
      return plainSend(401, { error: 'Invalid authenticator code' });
    }
    await academyStore.revokeAllSessions(db, email);
    const token = await issueAcademySession(db, email);
    const enrollments = await academyStore.listEnrollments(db, email);
    prepareAcademyUser(user, enrollments);
    await academyStore.saveUser(db, email, user);
    security.audit(db, 'academy_2fa_login', { ip, email });
    writeDb(db);
    return apiSend(200, { ok: true, user: academyPublicUser(user) }, { token });
  }

  if (route === '/academy/logout' && req.method === 'POST') {
    const token = academyCookies.academySessionToken(req) || body.token || '';
    await academyStore.deleteSession(db, token);
    writeDb(db);
    return apiSend(200, { ok: true }, { clearSession: true });
  }

  if (route === '/academy/verify-email' && req.method === 'POST') {
    const result = await completeAcademyEmailVerification(db, body.token || '', ip);
    if (!result.ok) return plainSend(400, { error: result.error });
    if (result.token) {
      return apiSend(200, { ok: true, user: result.user, message: result.message }, { token: result.token });
    }
    return plainSend(200, result);
  }

  if (route === '/academy/forgot-password' && req.method === 'POST') {
    const rl = security.checkRateLimit(req, 'forgot');
    if (!rl.ok) return plainSend(429, { error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return plainSend(400, { error: 'Email required' });
    const user = await academyStore.getUser(db, email);
    if (user) {
      const resetToken = crypto.randomBytes(24).toString('hex');
      await academyStore.savePasswordReset(db, resetToken, email, Date.now() + 3600000);
      writeDb(db);
      const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
      const resetUrl = `${base}/academy/?reset=${resetToken}`;
      const msg = {
        subject: 'Reset your Kiteline Academy password',
        text: `Reset link (1 hour):\n${resetUrl}`,
        html: `<div style="font-family:Inter,sans-serif;max-width:520px"><h2 style="color:#36e6ff">Reset Kiteline Academy password</h2><p><a href="${resetUrl}" style="display:inline-block;padding:12px 20px;background:#36e6ff;color:#061020;font-weight:bold;border-radius:8px;text-decoration:none">Reset password</a></p><p style="color:#64748b;font-size:13px">${resetUrl}</p></div>`,
      };
      const sendResult = await notify.sendRawEmail(email, msg).catch((e) => {
        console.error('[academy] reset email failed:', e.message);
        return { mode: 'outbox', smtpError: e.message };
      });
      return plainSend(200, {
        ok: true,
        message: 'If that email is registered, we sent a reset link — check inbox and spam.',
      });
    }
    return plainSend(200, { ok: true, message: 'If that email is registered, we sent a reset link.' });
  }

  if (route === '/academy/resend-verification' && req.method === 'POST') {
    const rl = security.checkRateLimit(req, 'resend');
    if (!rl.ok) return plainSend(429, { error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return plainSend(400, { error: 'Email required' });
    const user = await academyStore.getUser(db, email);
    if (!user) {
      return plainSend(200, { ok: true, message: 'If that email is registered, we sent a new verification link.' });
    }
    if (user.emailVerified !== false) {
      return plainSend(200, { ok: true, message: 'This email is already verified — you can sign in.' });
    }
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    const mail = await sendAcademyVerificationEmail(db, email, base);
    writeDb(db);
    return plainSend(200, {
      ok: true,
      emailSent: !!mail.emailSent,
      message: mail.emailSent
        ? 'Verification email sent — check your inbox and spam/junk.'
        : 'The verification email could not be sent right now. Please try again in a few minutes, or email contact@kiteline.uk for help.',
    });
  }

  if (route === '/academy/contact' && req.method === 'POST') {
    const rl = security.checkRateLimit(req, 'contact');
    if (!rl.ok) return plainSend(429, { error: 'Too many messages. Try again later.', retryAfter: rl.retryAfter });
    const name = String(body.name || '').trim().slice(0, 120);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    const interest = String(body.interest || '').trim().slice(0, 120);
    const message = String(body.message || '').trim().slice(0, 4000);
    const consent = body.consent === true;
    if (!name || !email || !message) return plainSend(400, { error: 'Name, email and message are required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return plainSend(400, { error: 'Enter a valid email address' });
    if (!consent) return plainSend(400, { error: 'Please tick the consent checkbox' });
    db.academyContactMessages = db.academyContactMessages || [];
    const ref = 'KA-' + Date.now().toString(36).toUpperCase();
    db.academyContactMessages.push({ ref, at: new Date().toISOString(), name, email, interest, message, consent: true, ip });
    security.audit(db, 'academy_contact_message', { ip, email, ref });
    writeDb(db);
    const support = process.env.ACADEMY_REPLY_TO || 'contact@kiteline.uk';
    notify.sendRawEmail(support, {
      subject: `[Academy contact ${ref}] ${interest || 'General'} — ${name}`,
      text: `Ref: ${ref}\nName: ${name}\nEmail: ${email}\nInterest: ${interest || '-'}\n\n${message}`,
      replyTo: email,
    }).catch((e) => console.error('[academy] contact notify failed:', e.message));
    notify.sendRawEmail(email, {
      subject: `Kiteline Academy — we received your message (${ref})`,
      text: `Hello ${name},\n\nThanks for contacting Kiteline Academy. Your reference is ${ref}.\nWe usually reply within 24-48 hours (UK time).\n\nYour message:\n${message}\n\nKiteline Academy · contact@kiteline.uk`,
      replyTo: support,
    }).catch(() => {});
    return plainSend(200, { ok: true, ref, message: 'Message received — reference ' + ref + '. We reply within 24–48 hours.' });
  }

  if (route === '/academy/newsletter' && req.method === 'POST') {
    const rl = security.checkRateLimit(req, 'contact');
    if (!rl.ok) return plainSend(429, { error: 'Too many requests. Try again later.', retryAfter: rl.retryAfter });
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return plainSend(400, { error: 'Enter a valid email address' });
    db.academyNewsletter = db.academyNewsletter || [];
    if (!db.academyNewsletter.find((s) => s.email === email && !s.unsubscribedAt)) {
      db.academyNewsletter.push({ email, consentAt: new Date().toISOString(), ip });
    }
    security.audit(db, 'academy_newsletter_subscribe', { ip, email });
    writeDb(db);
    return plainSend(200, { ok: true, message: 'Subscribed — you can unsubscribe anytime by emailing contact@kiteline.uk.' });
  }

  if (route === '/academy/reset-password' && req.method === 'POST') {
    const resetToken = body.token || '';
    const password = body.password || '';
    const entry = await academyStore.getPasswordReset(db, resetToken);
    if (!entry || entry.expires < Date.now()) return plainSend(400, { error: 'Reset link expired or invalid' });
    const user = await academyStore.getUser(db, entry.email);
    if (!user) return plainSend(404, { error: 'Account not found' });
    const pwCheck = security.validatePassword(password, entry.email);
    if (!pwCheck.ok) return plainSend(400, { error: pwCheck.error });
    if (security.passwordScore(password) < 3) return plainSend(400, { error: 'Password too weak' });
    user.pass = hashPassword(password);
    security.clearLoginFailures(user);
    await academyStore.saveUser(db, entry.email, user);
    await academyStore.deletePasswordReset(db, resetToken);
    await academyStore.revokeAllSessions(db, entry.email);
    const token = await issueAcademySession(db, entry.email);
    security.audit(db, 'academy_password_reset', { ip, email: entry.email });
    writeDb(db);
    const enrollments = await academyStore.listEnrollments(db, entry.email);
    prepareAcademyUser(user, enrollments);
    return apiSend(200, { ok: true, user: academyPublicUser(user), message: 'Password updated — signed in.' }, { token });
  }

  if (route === '/academy/me' && req.method === 'GET') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Not signed in or session expired' });
    const enrollments = await academyStore.listEnrollments(db, user.email);
    ensureAcademyLearning(user);
    prepareAcademyUser(user, enrollments);
    await academyStore.saveUser(db, user.email, user);
    writeDb(db);
    return plainSend(200, {
      user: Object.assign({}, academyPublicUser(user), {
        totpEnabled: !!(user.totpEnabled && user.totpSecret),
      }),
      enrollments: enrollments.map((e) => e.courseTitle),
      learning: user.learning,
    });
  }

  if (route === '/academy/progress' && req.method === 'GET') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Not signed in or session expired' });
    ensureAcademyLearning(user);
    const enrollments = await academyStore.listEnrollments(db, user.email);
    prepareAcademyUser(user, enrollments);
    await academyStore.saveUser(db, user.email, user);
    writeDb(db);
    return plainSend(200, {
      progress: user.learning.progress || { courses: {} },
      enrolled: user.learning.enrolled || FREE_ACADEMY_COURSES.slice(),
    });
  }

  if (route === '/academy/progress' && req.method === 'POST') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Not signed in or session expired' });
    const courseId = (body.courseId || '').trim();
    const lessonId = (body.lessonId || '').trim();
    if (!courseId || !lessonId) return plainSend(400, { error: 'courseId and lessonId required' });
    ensureAcademyLearning(user);
    const enrollments = await academyStore.listEnrollments(db, user.email);
    prepareAcademyUser(user, enrollments);
    user.learning.progress = user.learning.progress || { courses: {} };
    const cp = user.learning.progress.courses[courseId] || { completed: [], quizScores: {} };
    if (!Array.isArray(cp.completed)) cp.completed = [];
    if (cp.completed.indexOf(lessonId) < 0) cp.completed.push(lessonId);
    if (body.completed && Array.isArray(body.completed)) cp.completed = body.completed;
    if (body.quizScores && typeof body.quizScores === 'object') cp.quizScores = body.quizScores;
    user.learning.progress.courses[courseId] = cp;
    user.learning.progress.updatedAt = new Date().toISOString();
    await academyStore.saveUser(db, user.email, user);
    writeDb(db);
    return plainSend(200, { ok: true, progress: user.learning.progress, enrolled: user.learning.enrolled });
  }

  if (route === '/academy/2fa/setup' && req.method === 'POST') {
    const { user, token } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Sign in required' });
    const secret = academyTotp.generateSecret();
    user.totpPendingSecret = secret;
    await academyStore.saveUser(db, user.email, user);
    writeDb(db);
    return plainSend(200, {
      ok: true,
      secret,
      uri: academyTotp.otpauthUri(secret, user.email, 'Kiteline Academy'),
      message: 'Scan the URI in Google Authenticator, Authy, or Microsoft Authenticator, then confirm with a code.',
    });
  }

  if (route === '/academy/2fa/enable' && req.method === 'POST') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user || !user.totpPendingSecret) return plainSend(400, { error: 'Run 2FA setup first' });
    if (!academyTotp.verifyTotp(user.totpPendingSecret, body.code)) {
      return plainSend(400, { error: 'Invalid code — check your authenticator app' });
    }
    user.totpSecret = user.totpPendingSecret;
    user.totpEnabled = true;
    delete user.totpPendingSecret;
    await academyStore.saveUser(db, user.email, user);
    security.audit(db, 'academy_2fa_enabled', { ip, email: user.email });
    writeDb(db);
    return plainSend(200, { ok: true, message: 'Two-factor authentication enabled.' });
  }

  if (route === '/academy/2fa/disable' && req.method === 'POST') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Sign in required' });
    const password = body.password || '';
    if (!verifyPassword(password, user.pass)) return plainSend(401, { error: 'Password incorrect' });
    if (user.totpSecret && !academyTotp.verifyTotp(user.totpSecret, body.code)) {
      return plainSend(401, { error: 'Invalid authenticator code' });
    }
    delete user.totpSecret;
    delete user.totpPendingSecret;
    user.totpEnabled = false;
    await academyStore.saveUser(db, user.email, user);
    security.audit(db, 'academy_2fa_disabled', { ip, email: user.email });
    writeDb(db);
    return plainSend(200, { ok: true, message: 'Two-factor authentication disabled.' });
  }

  if (route === '/academy/checkout' && req.method === 'POST') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Sign in to purchase a course' });
    const courseTitle = (body.courseTitle || '').trim();
    const pence = body.amountPence != null
      ? Math.round(Number(body.amountPence))
      : Math.round(Number(body.price || 0) * 100);
    if (!courseTitle) return plainSend(400, { error: 'Course title required' });
    if (pence < 100) return plainSend(400, { error: 'Invalid course price' });
    if (!academyBilling.isConfigured()) {
      return plainSend(503, { error: 'Stripe not configured — contact contact@kiteline.uk', demo: true });
    }
    const base = APP_URL || `${url.protocol}//${req.headers.host || 'localhost'}`;
    try {
      const session = await academyBilling.createCourseCheckout({
        email: user.email,
        courseTitle,
        amountPence: pence,
        baseUrl: base,
      });
      return plainSend(200, { ok: true, url: session.url, sessionId: session.sessionId });
    } catch (e) {
      return plainSend(500, { error: e.message || 'Checkout failed' });
    }
  }

  if (route === '/academy/enrollments' && req.method === 'GET') {
    const { user } = await resolveAcademyUser(db, req, academyEmailVerificationRequired);
    if (!user) return plainSend(401, { error: 'Sign in required' });
    const enrollments = await academyStore.listEnrollments(db, user.email);
    return plainSend(200, { enrollments });
  }

  if (route === '/academy/admin/students' && req.method === 'GET') {
    if (!isAcademyAdmin(req, body)) return plainSend(403, { error: 'Admin access denied' });
    const students = await academyStore.listRegistrations(db);
    return plainSend(200, { students, storage: academyStore.usingPostgres() ? 'postgres' : 'json' });
  }

  if (route === '/academy/admin/export' && req.method === 'GET') {
    if (!isAcademyAdmin(req, null)) return plainSend(403, { error: 'Admin access denied' });
    const students = await academyStore.listRegistrations(db);
    const header = ['registeredAt', 'email', 'firstName', 'lastName', 'country', 'city', 'postcode', 'lang', 'ageGroup', 'gender'];
    const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [header.join(',')].concat(students.map((s) => header.map((h) => {
      const map = { registeredAt: s.at, email: s.email, firstName: s.firstName, lastName: s.lastName, country: s.country, city: s.city, postcode: s.postcode, lang: s.lang, ageGroup: s.ageGroup, gender: s.gender };
      return esc(map[h]);
    }).join(',')));
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="kitline-academy-students.csv"',
    });
    res.end(lines.join('\n'));
    return true;
  }

  return false;
}

module.exports = { handleAcademyRoute, resolveAcademyUser, issueAcademySession };
