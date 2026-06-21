'use strict';

async function verifyCaptcha(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY || '';
  if (!secret) {
    if (process.env.ACADEMY_REQUIRE_CAPTCHA === 'true') {
      return { ok: false, error: 'CAPTCHA not configured on server' };
    }
    return { ok: true, skipped: true };
  }
  if (!token) return { ok: false, error: 'Complete the CAPTCHA check' };

  const isTurnstile = !!process.env.TURNSTILE_SECRET_KEY;
  const url = isTurnstile
    ? 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
    : 'https://www.google.com/recaptcha/api/siteverify';

  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== 'unknown') body.set('remoteip', ip);

  const res = await fetch(url, { method: 'POST', body });
  const data = await res.json().catch(() => ({}));
  if (data.success) return { ok: true };
  return { ok: false, error: 'CAPTCHA failed — try again' };
}

function captchaPublicConfig() {
  return {
    turnstileSiteKey: process.env.TURNSTILE_SITE_KEY || '',
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || '',
    required: !!(process.env.TURNSTILE_SECRET_KEY || process.env.RECAPTCHA_SECRET_KEY)
      || process.env.ACADEMY_REQUIRE_CAPTCHA === 'true',
  };
}

module.exports = { verifyCaptcha, captchaPublicConfig };
