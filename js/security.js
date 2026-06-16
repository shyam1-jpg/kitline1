/* Kiteline — PIN + biometric guard for deletes and reset */
(function () {
  const PIN_SALT = 'kiteline.pin.salt';
  const PIN_HASH = 'kiteline.pin.hash';
  const WEBAUTHN_ID = 'kiteline.webauthn.id';
  const WEBAUTHN_USER = 'kiteline.webauthn.user';

  function rpId() {
    const h = location.hostname;
    if (!h || h === 'localhost' || h === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return null;
    return h;
  }

  function b64(buf) {
    const u = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let s = '';
    u.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromB64(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }

  async function hashPin(pin, salt) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 120000, hash: 'SHA-256' },
      key,
      256
    );
    return b64(bits);
  }

  function hasPin() { return !!localStorage.getItem(PIN_HASH); }
  function hasBiometric() { return !!localStorage.getItem(WEBAUTHN_ID) && !!rpId(); }
  function biometricAvailable() { return !!(window.PublicKeyCredential && rpId()); }

  async function setPin(pin, confirmPin) {
    pin = String(pin || '').replace(/\D/g, '');
    confirmPin = String(confirmPin || '').replace(/\D/g, '');
    if (pin.length < 4 || pin.length > 6) throw new Error('PIN must be 4–6 digits');
    if (pin !== confirmPin) throw new Error('PINs do not match');
    const salt = crypto.randomUUID();
    const hash = await hashPin(pin, salt);
    localStorage.setItem(PIN_SALT, salt);
    localStorage.setItem(PIN_HASH, hash);
  }

  async function verifyPin(pin) {
    if (!hasPin()) return false;
    pin = String(pin || '').replace(/\D/g, '');
    const salt = localStorage.getItem(PIN_SALT);
    const hash = localStorage.getItem(PIN_HASH);
    if (!salt || !hash) return false;
    return (await hashPin(pin, salt)) === hash;
  }

  async function registerBiometric() {
    const id = rpId();
    if (!id) throw new Error('Biometric works on kiteline.uk or the public link — not on a plain IP address');
    if (!window.PublicKeyCredential) throw new Error('This browser does not support biometrics');
    const email = (window.Api && window.Api.email()) || (window.Store && window.Store.session && window.Store.session()?.email) || 'owner@kiteline.uk';
    const name = email.split('@')[0];
    let userId = localStorage.getItem(WEBAUTHN_USER);
    if (!userId) { userId = crypto.randomUUID(); localStorage.setItem(WEBAUTHN_USER, userId); }
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'Kiteline', id },
        user: { id: new TextEncoder().encode(userId), name: email, displayName: name },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
      },
    });
    if (!cred) throw new Error('Biometric setup cancelled');
    localStorage.setItem(WEBAUTHN_ID, b64(cred.rawId));
  }

  async function verifyBiometric() {
    const id = rpId();
    const credId = localStorage.getItem(WEBAUTHN_ID);
    if (!id || !credId) return false;
    try {
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          rpId: id,
          allowCredentials: [{ id: fromB64(credId), type: 'public-key' }],
          userVerification: 'required',
          timeout: 60000,
        },
      });
      return !!cred;
    } catch { return false; }
  }

  function clearBiometric() {
    localStorage.removeItem(WEBAUTHN_ID);
    localStorage.removeItem(WEBAUTHN_USER);
  }

  function confirmDangerous(title, message, onOk) {
    return new Promise((resolve) => {
      if (!hasPin()) {
        window.UI.toast('Set a PIN in Settings → Security first', 'warn');
        location.hash = 'settings';
        resolve(false);
        return;
      }
      const layer = document.getElementById('modal-layer');
      const bio = hasBiometric();
      layer.classList.remove('hidden');
      layer.innerHTML = `
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" data-close></div>
        <div class="relative h-full w-full flex items-center justify-center p-4">
          <div class="modal-card card w-full max-w-sm">
            <div class="px-5 py-4 border-b border-ink-100">
              <h3 class="font-bold text-lg">${window.UI.escapeHtml(title)}</h3>
              <p class="text-sm text-ink-500 mt-1">${window.UI.escapeHtml(message)}</p>
            </div>
            <div class="p-5 space-y-3">
              <label class="label">Enter PIN to continue</label>
              <input id="secPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" class="input text-center text-2xl tracking-[0.4em]" placeholder="••••" autocomplete="off">
              ${bio ? `<button type="button" class="btn btn-primary w-full" id="secBio">${window.UI.icon('shield','w-4 h-4')} Use Face ID / Fingerprint</button>` : ''}
              <div class="flex gap-2 pt-1">
                <button type="button" class="btn btn-ghost flex-1" data-close>Cancel</button>
                <button type="button" class="btn btn-danger flex-1" id="secOk">Confirm</button>
              </div>
            </div>
          </div>
        </div>`;
      const close = () => { window.UI.closeModal(); resolve(false); };
      layer.querySelectorAll('[data-close]').forEach((b) => { b.onclick = close; });
      const pinEl = layer.querySelector('#secPin');
      const ok = async () => {
        if (!(await verifyPin(pinEl.value))) {
          window.UI.toast('Wrong PIN', 'error');
          pinEl.value = '';
          pinEl.focus();
          return;
        }
        window.UI.closeModal();
        if (onOk) await onOk();
        resolve(true);
      };
      layer.querySelector('#secOk').onclick = ok;
      pinEl.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
      const bioBtn = layer.querySelector('#secBio');
      if (bioBtn) {
        bioBtn.onclick = async () => {
          bioBtn.disabled = true;
          if (await verifyBiometric()) {
            window.UI.closeModal();
            if (onOk) await onOk();
            resolve(true);
          } else {
            window.UI.toast('Biometric check failed — use PIN', 'error');
            bioBtn.disabled = false;
          }
        };
      }
      pinEl.focus();
    });
  }

  window.Security = {
    hasPin, hasBiometric, biometricAvailable, rpId,
    setPin, verifyPin, registerBiometric, verifyBiometric, clearBiometric,
    confirmDangerous,
  };
})();
