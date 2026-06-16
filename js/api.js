/* ============================================================
   Kitchen OS — API client (talks to the Node backend)
   Falls back gracefully to offline/localStorage mode if the
   backend is unreachable (e.g. when opened via file://).
   ============================================================ */
(function () {
  const TOKEN_KEY = 'kiteline.token';
  const EMAIL_KEY = 'kiteline.email';
  // Same-origin when served by the Node server; '' resolves relative paths.
  const BASE = '';

  function token() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }
  function email() { return localStorage.getItem(EMAIL_KEY) || ''; }
  function setEmail(e) { e ? localStorage.setItem(EMAIL_KEY, e) : localStorage.removeItem(EMAIL_KEY); }

  async function req(method, route, body) {
    const res = await fetch(BASE + '/api' + route, {
      method,
      headers: Object.assign({ 'Content-Type': 'application/json' },
        token() ? { 'Authorization': 'Bearer ' + token() } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || res.statusText), { status: res.status, data });
    return data;
  }

  const Api = {
    online: false,
    token,
    setToken,

    // Detect whether a backend is present (vs file:// / offline)
    async ping() {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 1500);
        const res = await fetch(BASE + '/api/me', { headers: token() ? { 'Authorization': 'Bearer ' + token() } : {}, signal: ctrl.signal });
        clearTimeout(t);
        this.online = res.status !== 0; // any HTTP response means backend exists
        return this.online;
      } catch { this.online = false; return false; }
    },

    email, setEmail,
    async login(email, password) {
      const data = await req('POST', '/login', { email, password });
      setToken(data.token); setEmail((data.user && data.user.email) || email);
      return data.user;
    },
    async register(email, password, name) {
      const data = await req('POST', '/register', { email, password, name });
      if (data.token) {
        setToken(data.token);
        setEmail((data.user && data.user.email) || email);
      }
      return data;
    },
    async verifyEmail(token) {
      const data = await req('POST', '/verify-email', { token });
      setToken(data.token);
      setEmail((data.user && data.user.email) || '');
      return data;
    },
    async resendVerification(email) {
      return req('POST', '/resend-verification', { email });
    },
    async forgotPassword(email) {
      return req('POST', '/forgot-password', { email });
    },
    async resetPassword(token, password) {
      return req('POST', '/reset-password', { token, password });
    },
    async me() { return (await req('GET', '/me')).user; },
    async logout() { try { await req('POST', '/logout'); } catch {} setToken(null); setEmail(null); },

    async getState() { return (await req('GET', '/state')).state; },
    async putState(state) { return req('PUT', '/state', { state }); },
    async testNotify(channel) { return req('POST', '/notify/test', { channel: channel || 'email' }); },
    async notifyStatus() { return req('GET', '/notify/status'); },
    async ingestInfo() { return req('GET', '/ingest/info'); },
    async getWaitlist() { return req('GET', '/waitlist'); },
    async billingConfig() { return req('GET', '/billing/config'); },
    async billingStatus() { return req('GET', '/billing/status'); },
    async billingCheckout(plan, email) { return req('POST', '/billing/checkout', { plan, email }); },
    async billingPortal() { return req('POST', '/billing/portal', {}); },
  };

  window.Api = Api;
})();
