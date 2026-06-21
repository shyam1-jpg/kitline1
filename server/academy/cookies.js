'use strict';

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 1) return;
    const k = part.slice(0, i).trim();
    const v = decodeURIComponent(part.slice(i + 1).trim());
    out[k] = v;
  });
  return out;
}

function academySessionToken(req) {
  const cookies = parseCookies(req);
  if (cookies.ka_session) return cookies.ka_session;
  const auth = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return auth.startsWith('acad_') ? auth : '';
}

function buildAcademySessionCookie(token, isProd) {
  const maxAge = Number(process.env.ACADEMY_SESSION_DAYS || 7) * 86400;
  const parts = [
    `ka_session=${token}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function buildClearAcademySessionCookie(isProd) {
  const parts = ['ka_session=', 'Path=/', 'HttpOnly', 'Max-Age=0', 'SameSite=Lax'];
  if (isProd) parts.push('Secure');
  return parts.join('; ');
}

function setAcademySessionCookie(res, token, isProd) {
  res.setHeader('Set-Cookie', buildAcademySessionCookie(token, isProd));
}

function clearAcademySessionCookie(res, isProd) {
  res.setHeader('Set-Cookie', buildClearAcademySessionCookie(isProd));
}

module.exports = {
  parseCookies,
  academySessionToken,
  setAcademySessionCookie,
  clearAcademySessionCookie,
  buildAcademySessionCookie,
  buildClearAcademySessionCookie,
};
