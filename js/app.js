/* ============================================================
   Kitchen OS — App shell, auth, router & IoT simulation
   ============================================================ */
(function () {
  const S = window.Store;
  const V = window.Views;
  const { icon, toast } = window.UI;

  const NAV = [
    { id:'home', label:'Home', icon:'grid' },
    { sep:'Live Ops', sepKey:'liveops' },
    { id:'wflive', label:'Happening Now', icon:'temp' },
    { id:'wfdone', label:'Completed Today', icon:'check' },
    { id:'wfout', label:'Outstanding', icon:'layers' },
    { id:'wfod', label:'Overdue', icon:'alert' },
    { id:'wfstaff', label:'Staff Working', icon:'team' },
    { id:'wfdel', label:'Deliveries Today', icon:'truck' },
    { id:'wfprod', label:'Food Production', icon:'recipe' },
    { id:'wfclean', label:'Cleaning Status', icon:'check' },
    { id:'wfhaccp', label:'HACCP Status', icon:'shield' },
    { id:'wfperf', label:'Performance', icon:'dashboard' },
    { id:'dashboard', label:'Dashboard', icon:'dashboard' },
    { id:'taskoverview', label:'Task Overview', icon:'check' },
    { id:'temps', label:'Temperatures', icon:'temp' },
    { id:'alerts', label:'Alerts', icon:'alert' },
    { id:'haccp', label:'HACCP & Checklists', icon:'check' },
    { id:'deliveries', label:'Deliveries', icon:'truck' },
    { id:'records', label:'Records', icon:'records' },
    { id:'cooling', label:'Cooling', icon:'snow' },
    { id:'holding', label:'Hot & Cold Hold', icon:'temp' },
    { id:'phlogs', label:'pH Monitor', icon:'droplet' },
    { id:'batches', label:'Batches', icon:'layers' },
    { id:'suppliers', label:'Suppliers', icon:'truck' },
    { id:'incidents', label:'Incidents', icon:'shield' },
    { id:'maintenance', label:'Maintenance', icon:'wrench' },
    { id:'assets', label:'Assets & Equipment', icon:'box' },
    { id:'sites', label:'Sites', icon:'sites' },
    { id:'reports', label:'Reports', icon:'reports' },
    { id:'team', label:'Team', icon:'team' },
    { id:'training', label:'Training', icon:'cap' },
    { id:'recipes', label:'Recipes', icon:'recipe' },
    { id:'foodcost', label:'Food Cost', icon:'coin' },
    { id:'manual', label:'User Manual', icon:'help' },
    { sep:'Products' },
    { id:'allerq', label:'MenuGuard', icon:'allerq' },
    { id:'labels', label:'LabelSmart', icon:'labels' },
    { id:'waste', label:'WasteWise', icon:'waste' },
    { sep:'' },
    { id:'settings', label:'Settings', icon:'settings' },
  ];

  const t = (k, fb) => (window.I18n ? window.I18n.t(k) : fb);
  const brandLogo = (size, light) =>
    `<div class="brand-lockup${size==='lg'?' brand-lockup--lg':''}${light?' brand-lockup--light':''}">
      <img src="/kiteline-logo.png?v=mark" alt="" class="brand-mark" width="36" height="36">
      <span class="brand-name">Kit<em>eline</em></span>
    </div>`;

  /* ---------- ROLES & PERMISSIONS ---------- */
  const RANK = { Staff: 1, Manager: 2, Admin: 3 };
  // Minimum role required per route (anything not listed = Staff/all access)
  const ROUTE_ROLE = {
    suppliers:'Manager', assets:'Manager', sites:'Manager', reports:'Manager',
    team:'Manager', training:'Manager', foodcost:'Manager', settings:'Admin',
  };
  // Resolve the signed-in user + role. Works on existing data (infers role from job title).
  function currentUser() {
    const email = (window.Api && S.remote) ? (window.Api.email() || '') : ((S.session && S.session() && S.session().email) || '');
    const member = (S.db.team || []).find(m => (m.email || '').toLowerCase() === email.toLowerCase());
    let role;
    if (member && member.access && RANK[member.access]) role = member.access;
    else if (member) {
      const title = (member.role || '').toLowerCase();
      if (/head chef|owner|director|admin|proprietor|gm|general manager/.test(title)) role = 'Admin';
      else if (/manager|compliance|supervisor|lead|head/.test(title)) role = 'Manager';
      else role = 'Staff';
    } else role = (window.App && window.App.config && window.App.config.demo) ? 'Admin' : 'Staff';
    return {
      email,
      name: member ? member.name : (email ? email.split('@')[0] : 'Owner'),
      title: member ? member.role : 'Account Owner',
      initials: member ? member.initials : (email ? email.slice(0,2).toUpperCase() : 'OW'),
      role, rank: RANK[role] || 3,
    };
  }
  function canAccess(routeId, rank) {
    const need = ROUTE_ROLE[routeId];
    return !need || rank >= RANK[need];
  }
  const roleBadge = (role) => {
    const c = role==='Admin' ? 'badge-green' : role==='Manager' ? 'badge-blue' : 'badge-gray';
    return `<span class="badge ${c}">${role}</span>`;
  };

  const App = {
    route: (location.hash || '#home').slice(1),
    config: { demo: true, register: true },

    closeMobileNav() {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebarOverlay')?.classList.remove('open');
    },
    openMobileNav() {
      document.getElementById('sidebar')?.classList.add('open');
      document.getElementById('sidebarOverlay')?.classList.add('open');
    },

    resolveRoute() {
      // Support deep links like /app/temps → /app#temps (fixes mobile refresh & PWA)
      const m = location.pathname.match(/^\/app\/([^/?#]+)\/?$/);
      if (m && !location.hash) {
        const page = decodeURIComponent(m[1]);
        location.replace('/app#' + page);
        return page;
      }
      return (location.hash || '#home').slice(1) || 'home';
    },

    authed() {
      if (S.remote && window.Api) return !!window.Api.token();
      return !!S.session();
    },

    async signOut() {
      if (S.remote && window.Api) { await window.Api.logout(); } else { S.logout(); }
      toast('Signed out');
      this.renderLogin();
    },

    async boot() {
      this.route = this.resolveRoute();
      window.addEventListener('hashchange', () => { this.route = location.hash.slice(1) || 'home'; this.render(); });
      window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); this.openPalette(); }
      });

      // Detect backend. If present, use real auth + server-side state.
      if (window.Api) {
        S.remote = await window.Api.ping();
        if (S.remote) {
          try {
            const cfg = await fetch('/api/config').then(r => r.json());
            if (cfg && typeof cfg.demo === 'boolean') this.config = cfg;
          } catch {}
        }
      }

      if (S.remote && window.Api.token()) {
        try {
          await window.Api.me();            // validate token
          await S.hydrateFromServer();      // pull shared state
          this.render();
        } catch (e) {
          window.Api.setToken(null);
          this.renderLogin();
        }
      } else if (S.remote) {
        this.renderLogin();
      } else {
        // offline / file:// mode
        if (!S.session()) this.renderLogin(); else this.render();
      }

      this.startSimulation();
    },

    /* ---------- LOGIN ---------- */
    renderLogin() {
      const demo = this.config.demo;
      const demoDefaults = demo ? { email: 'shyam_1@hotmail.co.uk', pw: 'shyam' } : { email: '', pw: '' };
      document.getElementById('root').innerHTML = `
        <div class="min-h-screen grid lg:grid-cols-2">
          <div class="hidden lg:flex flex-col justify-between p-12 text-white" style="background:linear-gradient(135deg,#0f766e,#0b1220)">
            <div class="flex items-center"><img src="/kiteline-wordmark.png?v=k" alt="Kiteline" class="h-9"></div>
            <div>
              <h1 class="text-4xl font-extrabold leading-tight">The Command Line for Professional Kitchens</h1>
              <p class="mt-4 text-white/70 text-lg">Food safety, allergen menus, labelling, and waste — in one early-access platform. Try the demo free; paid plans when we onboard your kitchen.</p>
              <div class="grid grid-cols-2 gap-4 mt-8">
                ${[['Live','Software today'],['Beta','Menus & labels'],['Pilot','Sensors soon'],['Demo','Sample data']].map(([v,l])=>`<div><div class="text-2xl font-extrabold">${v}</div><div class="text-white/60 text-sm">${l}</div></div>`).join('')}
              </div>
            </div>
            <div class="text-white/50 text-sm">SafeServe · Temperature Monitoring · MenuGuard · LabelSmart · WasteWise</div>
          </div>
          <div class="flex items-center justify-center p-6">
            <div class="w-full max-w-sm">
              <div class="lg:hidden mb-6">${brandLogo('lg', true)}</div>
              <h2 class="text-2xl font-extrabold">Welcome back</h2>
              <p class="text-ink-500 mb-6">Sign in to access your kitchen tools.</p>
              <label class="label">Email address</label>
              <input id="email" class="input mb-4" value="${demoDefaults.email}" placeholder="you@restaurant.com" autocomplete="username">
              <label class="label">Password</label>
              <input id="pw" type="password" class="input mb-5" value="${demoDefaults.pw}" placeholder="••••••••" autocomplete="current-password">
              <button class="btn btn-primary w-full" id="signin">Sign in</button>
              ${demo ? `<div class="mt-5">
                <div class="text-xs text-ink-400 mb-2 text-center">Quick demo logins (different access levels)</div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button class="btn btn-ghost btn-sm" data-demo="shyam_1@hotmail.co.uk" data-pw="shyam">Owner</button>
                  <button class="btn btn-ghost btn-sm" data-demo="sarah@kiteline.uk" data-pw="demo1234">Admin</button>
                  <button class="btn btn-ghost btn-sm" data-demo="lena@kiteline.uk" data-pw="demo1234">Manager</button>
                  <button class="btn btn-ghost btn-sm" data-demo="james@kiteline.uk" data-pw="demo1234">Staff</button>
                </div>
              </div>
              <p class="text-center text-ink-400 text-sm mt-4">Demo build — any credentials work. Admins see everything; Managers & Staff see less.</p>` : ''}
            </div>
          </div>
        </div>`;
      if (demo) {
        document.querySelectorAll('[data-demo]').forEach(b => b.onclick = () => {
          document.getElementById('email').value = b.dataset.demo;
          document.getElementById('pw').value = b.dataset.pw || 'demo1234';
          document.getElementById('signin').click();
        });
      }
      document.getElementById('signin').onclick = async () => {
        const email = document.getElementById('email').value;
        const pw = document.getElementById('pw').value;
        const btn = document.getElementById('signin');
        if (S.remote && window.Api) {
          btn.disabled = true; btn.textContent = 'Signing in…';
          try {
            await window.Api.login(email, pw);
            await S.hydrateFromServer();
            toast('Signed in'); this.render();
          } catch (e) {
            toast(e.message || 'Login failed', 'error');
            btn.disabled = false; btn.textContent = 'Sign in';
          }
        } else {
          S.login(email);
          toast('Signed in (offline)'); this.render();
        }
      };
    },

    /* ---------- APP SHELL ---------- */
    render() {
      if (!this.authed()) return this.renderLogin();
      const me = currentUser();
      let r = this.route;
      // route guard: bounce to home if this role can't access the route
      if (!canAccess(r, me.rank)) { toast('You don’t have access to that section', 'warn'); r = 'home'; this.route = 'home'; if (location.hash.slice(1) !== 'home') location.hash = 'home'; }
      const unknown = !V[r];
      if (unknown) { toast('Page not found — showing Home', 'warn'); r = 'home'; this.route = 'home'; if (location.hash.slice(1) !== 'home') location.hash = 'home'; }
      const view = (V[r] || V.home)();
      const site = S.site();
      const openAlerts = S.db.alerts.filter(a => a.status==='open').length;

      document.getElementById('root').innerHTML = `
        <div id="sidebarOverlay" class="sidebar-overlay"></div>
        <div class="app-shell">
          <aside id="sidebar" class="sidebar flex flex-col p-4">
            <div class="flex items-center justify-between px-2 mb-6">
              ${brandLogo()}
              <button class="md:hidden text-ink-400 hover:text-white" id="closeNav" aria-label="Close menu">${icon('chevron','w-5 h-5 rotate-180')}</button>
            </div>
            <nav class="flex-1 space-y-1 overflow-auto">
              ${NAV.filter(n => n.sep!==undefined || canAccess(n.id, me.rank)).map(n => n.sep!==undefined
                ? `<div class="text-[10px] uppercase tracking-wider text-ink-500 font-bold px-3 pt-4 pb-1">${n.sepKey?t('nav.'+n.sepKey,n.sep):n.sep==='Products'?t('nav.products','Products'):n.sep}</div>`
                : `<a class="nav-link ${r===n.id?'active':''}" href="#${n.id}">${icon(n.icon)} <span>${t('nav.'+n.id, n.label)}</span>${n.id==='alerts'&&openAlerts?`<span class="ml-auto badge badge-red">${openAlerts}</span>`:''}</a>`
              ).join('')}
            </nav>
            <div class="border-t border-white/10 pt-3 mt-3">
              <div class="flex items-center gap-2 px-2 mb-2">
                <div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">${me.initials}</div>
                <div class="flex-1 min-w-0"><div class="text-white text-sm font-semibold truncate">${me.name}</div><div class="text-ink-500 text-xs truncate">${me.title}</div></div>
              </div>
              <div class="px-2 mb-2">${roleBadge(me.role)}</div>
              <button class="btn btn-ghost btn-sm w-full justify-center text-ink-300 hover:text-white hover:bg-white/10" id="logout">${icon('logout','w-4 h-4')} Sign out</button>
            </div>
          </aside>

          <main class="min-w-0">
            <header class="bg-white border-b border-ink-100 px-5 py-3 flex items-center justify-between sticky top-0 z-30">
              <div class="flex items-center gap-3">
                <button class="mobile-nav-btn btn btn-ghost btn-sm !px-2" id="menuBtn" aria-label="Open menu">${icon('menu','w-5 h-5')}</button>
                <select id="siteSwitch" class="select !w-auto !py-1.5 font-semibold text-sm">
                  ${S.db.sites.map(s=>`<option value="${s.id}" ${s.id===S.db.currentSite?'selected':''}>${s.name}</option>`).join('')}
                </select>
                <span class="hidden sm:flex items-center gap-1.5 text-xs text-ink-400"><span class="pulse-dot pulse-live"></span> ${t('top.live','Live')}</span>
              </div>
              <div class="flex items-center gap-2.5">
                <button id="paletteBtn" class="flex items-center gap-2 text-sm text-ink-400 border border-ink-200 rounded-lg px-3 py-1.5 hover:bg-ink-50">${icon('search','w-4 h-4')} <span class="hidden md:inline">${t('top.search','Search…')}</span></button>
                <select id="langSel" class="select !w-auto !py-1.5 text-sm" title="Language">
                  ${(window.I18n?window.I18n.langs:['en']).map(l=>`<option value="${l}" ${window.I18n&&l===window.I18n.lang?'selected':''}>${window.I18n?window.I18n.langName(l):l}</option>`).join('')}
                </select>
                <a href="#alerts" class="relative text-ink-500 hover:text-ink-800">${icon('bell','w-5 h-5')}${openAlerts?`<span class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">${openAlerts}</span>`:''}</a>
                <button id="headerLogout" class="btn btn-ghost btn-sm text-ink-600">${icon('logout','w-4 h-4')} <span class="hidden sm:inline">Sign out</span></button>
              </div>
            </header>
            <div class="p-5 max-w-[1400px] mx-auto" id="view">${view.html}</div>
          </main>
        </div>`;

      document.getElementById('logout').onclick = () => this.signOut();
      document.getElementById('headerLogout').onclick = () => this.signOut();
      document.getElementById('menuBtn')?.addEventListener('click', () => this.openMobileNav());
      document.getElementById('closeNav')?.addEventListener('click', () => this.closeMobileNav());
      document.getElementById('sidebarOverlay')?.addEventListener('click', () => this.closeMobileNav());
      document.querySelectorAll('#sidebar .nav-link').forEach(a => a.addEventListener('click', () => this.closeMobileNav()));
      document.getElementById('siteSwitch').onchange = (e) => { S.setSite(e.target.value); this.render(); };
      const langSel = document.getElementById('langSel');
      if (langSel) langSel.onchange = (e) => { if (window.I18n) window.I18n.setLang(e.target.value); this.render(); };
      const pb = document.getElementById('paletteBtn');
      if (pb) pb.onclick = () => this.openPalette();
      document.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => { location.hash = el.dataset.nav; });
      if (view.mount) view.mount();
    },

    /* ---------- COMMAND PALETTE (Ctrl/Cmd + K) ---------- */
    openPalette() {
      if (!this.authed()) return;
      const meRank = currentUser().rank;
      const dests = NAV.filter(n => n.sep === undefined && canAccess(n.id, meRank)).map(n => ({
        label: t('nav.'+n.id, n.label), hint: 'Go to', icon: n.icon, run: () => { location.hash = n.id; }
      }));
      const actions = [
        ...(canAccess('sites', meRank) ? [{ label: t('nav.sites','Sites')+': switch site', hint:'Action', icon:'sites', run: () => { location.hash = 'sites'; } }] : []),
        ...(canAccess('settings', meRank) ? [{ label: 'Reset demo data', hint:'Danger', icon:'settings', run: () => { location.hash = 'settings'; } }] : []),
        { label: 'Sign out', hint:'Account', icon:'logout', run: () => this.signOut() },
      ];
      const items = dests.concat(actions);
      const layer = document.getElementById('modal-layer');
      layer.classList.remove('hidden');
      const render = (q) => {
        const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
        layer.querySelector('#cpList').innerHTML = filtered.length ? filtered.map((i, idx) =>
          `<button class="cp-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${idx===0?'bg-brand-50':''}" data-i="${items.indexOf(i)}">
            <span class="text-ink-400">${icon(i.icon,'w-4 h-4')}</span>
            <span class="flex-1 text-sm font-medium">${i.label}</span>
            <span class="text-[10px] text-ink-400 uppercase tracking-wide">${i.hint}</span>
          </button>`).join('') : '<div class="px-3 py-6 text-center text-ink-400 text-sm">No results</div>';
        layer.querySelectorAll('.cp-item').forEach(b => b.onclick = () => { const it = items[+b.dataset.i]; UI.closeModal(); it.run(); });
      };
      layer.innerHTML = `
        <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" data-close></div>
        <div class="relative h-full w-full flex items-start justify-center pt-24 p-4">
          <div class="modal-card card w-full max-w-lg overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-ink-100">
              ${icon('search','w-5 h-5 text-ink-400')}
              <input id="cpInput" class="flex-1 outline-none text-sm" placeholder="Type to search pages and actions…" autocomplete="off">
              <span class="text-[10px] text-ink-400 border border-ink-200 rounded px-1.5 py-0.5">ESC</span>
            </div>
            <div id="cpList" class="p-2 max-h-80 overflow-auto"></div>
          </div>
        </div>`;
      layer.querySelector('[data-close]').onclick = UI.closeModal;
      const input = layer.querySelector('#cpInput');
      render('');
      input.focus();
      input.oninput = () => render(input.value);
      input.onkeydown = (e) => {
        if (e.key === 'Escape') return UI.closeModal();
        if (e.key === 'Enter') { const first = layer.querySelector('.cp-item'); if (first) first.click(); }
      };
    },

    /* ---------- IoT SIMULATION ----------
       Mimics LoRaWAN sensors streaming live readings. Generates
       alerts automatically when a reading breaches its range. */
    startSimulation() {
      if (this._sim) return;
      this._sim = setInterval(async () => {
        if (!this.authed()) return;

        // LIVE mode: when a backend is present, reflect real readings pushed to
        // /api/ingest instead of generating fake data.
        if (S.remote) {
          const wfChanged = S.tickWorkflows();
          const changed = await S.pullLive();
          if ((changed || wfChanged) && /^(home|hub|wflive|wfdone|wfout|wfod|wfstaff|wfdel|wfprod|wfclean|wfhaccp|wfperf|dashboard|temps|alerts|maintenance)$/.test(this.route) && !document.querySelector('#modal-layer').innerHTML) {
            this.render();
          }
          return;
        }

        // Advance live kitchen workflows (supplier, prep, HACCP, etc.)
        const wfChanged = S.tickWorkflows();

        // OFFLINE/demo mode: simulate sensor drift locally.
        let changed = wfChanged;
        S.db.sensors.forEach(s => {
          const drift = (Math.random()*0.6 - 0.3);
          s.temp = +(s.temp + drift).toFixed(1);
          s.history.push(s.temp); s.history = s.history.slice(-24);
          s.updated = S.now();
          if ((s.temp > s.max || s.temp < s.min)) {
            const exists = S.db.alerts.find(a => a.sensor===s.id && a.status==='open');
            if (!exists) {
              S.db.alerts.unshift({ id:S.uid(), severity:'critical', site:s.siteId, sensor:s.id,
                title:s.name+' out of safe range', detail:s.temp+'°C (limit '+s.min+'–'+s.max+'°C)', at:S.now(), status:'open' });
              if (s.siteId === S.db.currentSite) toast(s.name+' breach: '+s.temp+'°C','error');
            }
          }
          changed = true;
        });
        if (changed) {
          S.persist();
          // Soft refresh only on live views to avoid disrupting forms
          if (/^(home|hub|wflive|wfdone|wfout|wfod|wfstaff|wfdel|wfprod|wfclean|wfhaccp|wfperf|dashboard|temps)$/.test(this.route) && !document.querySelector('#modal-layer').innerHTML) {
            this.render();
          }
        } else if (wfChanged && /^(home|hub|wflive|wfdone|wfout|wfod|wfstaff|wfdel|wfprod|wfclean|wfhaccp|wfperf)$/.test(this.route) && !document.querySelector('#modal-layer').innerHTML) {
          this.render();
        }
      }, 5000);
    },
  };

  window.App = App;
  document.addEventListener('DOMContentLoaded', () => App.boot());
})();
