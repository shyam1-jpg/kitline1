/* ============================================================
   Kiteline Kitchen Compliance — views (SafeServe / H&S only)
   ============================================================ */
(function () {
  const S = window.Store;
  const C = window.Compliance;
  const { icon, toast, modal, closeModal, fmt, escapeHtml } = window.UI;

  const MODULE_TEMPLATES = {
    hsChecks: 'Daily / weekly H&S walkthrough — areas checked, findings, corrective action, manager sign-off. Code: KHS.',
    riskAssessments: 'Generic kitchen risk assessment — hazard, who is at risk, existing controls, further action, review date. Code: KRA.',
    coshh: 'COSHH register entry — product, hazard, storage, PPE, exposure limits, SDS date. Code: KCOSHH.',
    accidents: 'Accident book — injured person, location, first aid, RIDDOR flag, witness, corrective action. Code: KACC.',
    inductions: 'Staff induction — topics covered (hygiene, fire, allergens, temps), trainer, signed. Code: KHS.',
    manualHandling: 'Safe system of work — task, load weight, safe method, team lift required. Code: KSSW.',
    safetyChecks: 'Fire exits & extinguishers, PPE stock, or first-aid kit — pass/fail and action. Code: KHS.',
    foodComplaints: 'Food complaint or alleged food poisoning — product, issue, illness reported, investigation. Code: KFS.',
    probeCalibration: 'Probe calibration — ice 0°C / boiling 100°C check, adjustment, next due date. Code: KFS.',
    thirdPartyEvents: 'External caterer or event — menu approved, allergen brief, temp checks, sign-off. Code: KFS.',
    haccpPlans: 'Full HACCP plan — hazards, CCPs, limits, monitoring, corrective actions, verification. Code: KHACCP.',
    fsmsDocuments: 'FSMS policy documents — version, owner, review date, approval status. Code: KFS.',
    equipmentMaintenance: 'Equipment PPM / service record — due date, provider, result (separate from repair tickets). Code: KHS.',
    auditExport: 'Export all compliance modules as CSV inside a ZIP, JSON pack, or print for your EHO visit.',
  };

  function activeTab() {
    const h = (location.hash || '').replace(/^#/, '');
    const m = h.match(/^compliance(?:-(\w+))?$/);
    if (m && m[1] && C.MODULES.some(x => x.id === m[1])) return m[1];
    return 'overview';
  }

  function currentUser() {
    return window.App && window.App.currentUser ? window.App.currentUser() : { name: 'User', role: 'Staff', rank: 3 };
  }

  function siteName(id) {
    const s = S.site(id);
    return (s && s.name) ? s.name : 'Kitchen';
  }

  function sectionHeader(title, subtitle, actions) {
    return `<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div><h1 class="text-2xl font-extrabold tracking-tight">${title}</h1>
      ${subtitle ? `<p class="text-ink-500 text-sm mt-1">${subtitle}</p>` : ''}</div>
      <div class="flex gap-2 flex-wrap">${actions || ''}</div></div>`;
  }

  function codeBadge(code) {
    if (!code) return '';
    return `<span class="badge badge-blue text-[10px]" title="${escapeHtml(C.CODES[code] || code)}">${code}</span>`;
  }

  function templateBanner(moduleId) {
    const t = MODULE_TEMPLATES[moduleId];
    if (!t) return '';
    const mod = C.MODULES.find(m => m.id === moduleId);
    return `<div class="card card-pad mb-4 border-l-4 border-brand-500 bg-gradient-to-r from-brand-50 to-white">
      <div class="flex flex-wrap items-start gap-2 mb-1">${mod && mod.code ? codeBadge(mod.code) : ''}<span class="font-bold text-sm text-brand-800">Template guide</span></div>
      <p class="text-sm text-ink-600">${escapeHtml(t)}</p>
    </div>`;
  }

  function deniedHtml() {
    return `<div class="card card-pad fade-in text-center py-12">
      <div class="text-ink-400 mb-3">${icon('shield', 'ico mx-auto w-10 h-10')}</div>
      <h3 class="font-bold text-lg">Manager access required</h3>
      <p class="text-sm text-ink-500 mt-2">This register is manager-only. You can still log new records where the add buttons are shown.</p>
    </div>`;
  }

  function sensorTone(s) {
    if (s.temp > s.max || s.temp < s.min) return { cls: 'text-red-600', label: 'Breach' };
    if (s.temp >= s.max - 0.6 || s.temp <= s.min + 0.6) return { cls: 'text-amber-600', label: 'Warning' };
    return { cls: 'text-brand-700', label: 'OK' };
  }

  function linkedOpsStrip(site) {
    const sensors = S.sensorsForSite(site).filter(s => s.type === 'fridge' || s.type === 'freezer').slice(0, 4);
    const openAlerts = (S.db.alerts || []).filter(a => a.status === 'open' && a.site === site).length;
    const ch = S.db.org && S.db.org.channels ? S.db.org.channels : { sms: true, email: true, push: true };
    const sensorCards = sensors.length ? sensors.map(s => {
      const t = sensorTone(s);
      return `<a href="#temps" class="block p-3 rounded-xl border border-ink-100 hover:border-brand-300 hover:bg-white transition-colors">
        <div class="text-xs text-ink-400 truncate">${escapeHtml(s.name)}</div>
        <div class="text-xl font-extrabold ${t.cls}">${fmt.temp(s.temp)}</div>
        <div class="text-[10px] text-ink-400">${t.label} · ${fmt.ago(s.updated)}</div>
      </a>`;
    }).join('') : `<p class="text-sm text-ink-400 col-span-2">No fridge sensors for this site — add under Temperatures.</p>`;

    return `<div class="grid lg:grid-cols-2 gap-4 mb-6">
      <div class="card card-pad" style="background:linear-gradient(135deg,#0ea5e914,#fff)">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold flex items-center gap-2">${icon('temp', 'w-5 h-5 text-sky-600')} Live fridge &amp; freezer readings</h3>
          <a href="#temps" class="text-xs font-semibold text-brand-600">All sensors →</a>
        </div>
        <div class="grid grid-cols-2 gap-2">${sensorCards}</div>
        <p class="text-xs text-ink-400 mt-3">LoRaWAN probes log automatically. Manual probe readings go in <a href="#temps" class="text-brand-600 font-semibold">Fridge &amp; Freezer Temps</a> or <a href="#compliance-probeCalibration" class="text-brand-600 font-semibold">Probe Calibration</a>.</p>
      </div>
      <div class="card card-pad" style="background:linear-gradient(135deg,#dc262614,#fff)">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-bold flex items-center gap-2">${icon('bell', 'w-5 h-5 text-red-600')} SMS &amp; mobile alerts</h3>
          <a href="#alerts" class="text-xs font-semibold text-brand-600">Open alerts →</a>
        </div>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span>SMS channel</span><span class="badge ${ch.sms ? 'badge-green' : 'badge-gray'}">${ch.sms ? 'On' : 'Off'}</span></div>
          <div class="flex justify-between"><span>Email alerts</span><span class="badge ${ch.email ? 'badge-green' : 'badge-gray'}">${ch.email ? 'On' : 'Off'}</span></div>
          <div class="flex justify-between"><span>Open alerts (this site)</span><span class="font-bold ${openAlerts ? 'text-red-600' : ''}">${openAlerts}</span></div>
        </div>
        <div class="flex flex-wrap gap-2 mt-4">
          <a href="#alerts" class="btn btn-ghost btn-sm">${icon('alert', 'ico')} Alerts</a>
          <a href="#settings" class="btn btn-ghost btn-sm">${icon('settings', 'ico')} Test SMS</a>
          <a href="#team" class="btn btn-ghost btn-sm">${icon('team', 'ico')} Team mobiles</a>
        </div>
        <p class="text-xs text-ink-400 mt-2">Add mobile numbers on Team for SMS. Turn channels on in Alerts or Settings.</p>
      </div>
    </div>`;
  }

  function tabNav(tab) {
    return `<div class="flex flex-wrap gap-1 mb-5 border-b border-ink-100 pb-2 overflow-x-auto">
      ${C.MODULES.map(m => {
        if (m.managerOnly && currentUser().rank < 2) return '';
        const on = tab === m.id;
        const href = m.id === 'overview' ? '#compliance' : '#compliance-' + m.id;
        return `<a href="${href}" class="btn btn-sm ${on ? 'btn-primary' : 'btn-ghost'} whitespace-nowrap">${m.code ? codeBadge(m.code) + ' ' : ''}${escapeHtml(m.label)}</a>`;
      }).join('')}
    </div>`;
  }

  function pushRecord(key, rec) {
    C.ensure(S.db);
    S.db.compliance[key].unshift(rec);
    S.persist();
    if (S.logActivity) S.logActivity((S.db.team[0] && S.db.team[0].id) || 'u_sarah', 'Compliance: ' + (rec.ref || key));
  }

  function showRecordModal(key, rec) {
    const skip = { id: 1, site: 1, steps: 1 };
    const rows = Object.keys(rec).filter(k => !skip[k] && typeof rec[k] !== 'object').map(k =>
      `<tr><td class="text-xs font-semibold text-ink-500 pr-4 py-1">${escapeHtml(k)}</td><td class="text-sm py-1">${escapeHtml(String(rec[k]))}</td></tr>`
    ).join('');
    modal((rec.ref || 'Record') + (rec.code ? ' · ' + rec.code : ''), `
      <table class="w-full text-left">${rows}</table>
      ${rec.steps ? `<p class="text-xs text-ink-400 mt-3">${rec.steps.length} HACCP step(s) — use Full plan to view table.</p>` : ''}
      <button class="btn btn-ghost btn-sm w-full mt-3" onclick="window.print()">${icon('print', 'ico')} Print record</button>`, { wide: true });
  }

  function listCard(key, r, bodyHtml, actions) {
    return `<div class="card card-pad fade-in">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div><span class="font-bold">${escapeHtml(r.ref || r.title || 'Record')}</span>
        <div class="text-xs text-ink-400">${fmt.date(r.at || r.date)} ${r.status ? ' · ' + escapeHtml(r.status) : ''}</div></div>
        ${r.code ? codeBadge(r.code) : ''}
      </div>
      ${bodyHtml}
      <div class="flex gap-2 mt-3 flex-wrap">
        <button type="button" class="btn btn-ghost btn-sm" data-view-record="${key}" data-record-id="${escapeHtml(r.id)}">${icon('records', 'ico')} View full record</button>
        ${actions || ''}
      </div>
    </div>`;
  }

  function renderOverview(site) {
    const counts = C.counts(site);
    const modules = C.MODULES.filter(m => m.id !== 'overview' && m.id !== 'auditExport');
    return `
      ${linkedOpsStrip(site)}
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div class="kpi fade-in"><div class="text-ink-500 text-xs font-semibold uppercase">Records</div><div class="v">${counts.total}</div><div class="text-ink-400 text-xs mt-1">This site</div></div>
        <div class="kpi fade-in"><div class="text-ink-500 text-xs font-semibold uppercase">Risk (KRA)</div><div class="v">${counts.riskAssessments}</div></div>
        <div class="kpi fade-in"><div class="text-ink-500 text-xs font-semibold uppercase">Open KACC</div><div class="v">${(C.siteRecords('accidents', site).filter(a => a.status !== 'Closed')).length}</div></div>
        <div class="kpi fade-in"><div class="text-ink-500 text-xs font-semibold uppercase">FSMS docs</div><div class="v">${counts.fsmsDocuments}</div></div>
      </div>
      <h2 class="font-bold text-sm uppercase tracking-wide text-ink-400 mb-3">Compliance modules — sample templates loaded</h2>
      <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
        ${modules.map(m => {
          const n = counts[m.id] || 0;
          return `<a href="#compliance-${m.id}" class="card card-pad fade-in text-left hover:shadow-lg hover:-translate-y-0.5 transition-all block group">
            <div class="flex items-start justify-between gap-2 mb-2">
              <span class="font-bold group-hover:text-brand-700">${escapeHtml(m.label)}</span>
              ${m.code ? codeBadge(m.code) : ''}
            </div>
            <div class="text-2xl font-extrabold text-brand-700">${n}</div>
            <div class="text-xs text-ink-400 mt-1">${icon(m.icon, 'ico inline w-3 h-3')} ${n ? 'View samples' : 'Open to add'} →</div>
          </a>`;
        }).join('')}
      </div>
      <div class="card card-pad bg-ink-50 border-ink-100">
        <h3 class="font-bold mb-2">Still in their own modules (not duplicated)</h3>
        <p class="text-sm text-ink-600 mb-3">Daily HACCP checklists, automatic fridge logs, cleaning, deliveries, recipes, labels, allergen menus, and waste.</p>
        <div class="flex flex-wrap gap-2">
          <a href="#temps" class="btn btn-primary btn-sm">${icon('temp', 'ico')} Fridge temps</a>
          <a href="#haccp" class="btn btn-ghost btn-sm">${icon('check', 'ico')} HACCP checks</a>
          <a href="#alerts" class="btn btn-ghost btn-sm">${icon('alert', 'ico')} Alerts &amp; SMS</a>
          <a href="#records" class="btn btn-ghost btn-sm">${icon('records', 'ico')} Cooking logs</a>
        </div>
      </div>`;
  }

  function renderHsChecks(site) {
    const list = C.siteRecords('hsChecks', site);
    const cards = list.map(r => listCard('hsChecks', r,
      `<div class="text-sm"><b>${escapeHtml(r.type)}</b> — ${escapeHtml(r.areas)}<br>${escapeHtml(r.findings)}</div>`)).join('')
      || '<p class="text-ink-400 text-sm py-4">No samples yet — use Log H&amp;S check.</p>';
    return templateBanner('hsChecks') + `
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="hs">${icon('plus', 'ico')} Log H&amp;S check</button></div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderRisk(site) {
    const addBtn = `<div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="ra">${icon('plus', 'ico')} New risk assessment</button></div>`;
    if (!C.canViewSensitiveList('riskAssessments')) {
      const n = C.siteRecords('riskAssessments', site).length;
      return templateBanner('riskAssessments') + addBtn + `<div class="card card-pad text-sm text-ink-500">Register is manager-only. ${n} sample(s) on file for managers.</div>`;
    }
    const list = C.siteRecords('riskAssessments', site);
    const cards = list.map(r => listCard('riskAssessments', r,
      `<div class="text-sm"><b>${escapeHtml(r.area)}</b><br>Hazards: ${escapeHtml(r.hazards)}<br>Risk ${r.risk} → residual ${r.residual}</div>`)).join('');
    return templateBanner('riskAssessments') + addBtn + `<div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderCoshh(site) {
    const addBtn = `<div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="coshh">${icon('plus', 'ico')} Add COSHH record</button></div>`;
    if (!C.canViewSensitiveList('coshh')) return templateBanner('coshh') + addBtn + `<div class="card card-pad text-sm text-ink-500">COSHH register (KCOSHH) is manager-only.</div>`;
    const list = C.siteRecords('coshh', site);
    const cards = list.map(r => listCard('coshh', r,
      `<div class="text-sm"><b>${escapeHtml(r.product)}</b> — ${escapeHtml(r.hazard)}<br>Storage: ${escapeHtml(r.storage)} · PPE: ${escapeHtml(r.ppe)}</div>`)).join('');
    return templateBanner('coshh') + addBtn + `<div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderAccidents(site) {
    const addBtn = `<div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="acc">${icon('plus', 'ico')} Report accident</button></div>`;
    if (!C.canViewSensitiveList('accidents')) return templateBanner('accidents') + addBtn + `<div class="card card-pad text-sm text-ink-500">Accident book (KACC) is manager-only after you submit a report.</div>`;
    const list = C.siteRecords('accidents', site);
    const cards = list.map(r => listCard('accidents', r,
      `<div class="text-sm"><b>${escapeHtml(r.injured)}</b> — ${escapeHtml(r.type)}<br>${escapeHtml(r.description)}</div>`,
      r.status !== 'Closed' ? `<button type="button" class="btn btn-ghost btn-sm" data-close-acc="${escapeHtml(r.id)}">Close</button>` : '')).join('');
    return templateBanner('accidents') + addBtn + `<div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderInductions(site) {
    const list = C.siteRecords('inductions', site);
    const cards = list.map(r => listCard('inductions', r,
      `<div class="text-sm"><b>${escapeHtml(r.staff)}</b> — ${escapeHtml(r.trainer)}<br>${escapeHtml(r.topics)}<br>${r.signed ? '<span class="badge badge-green">Signed</span>' : '<span class="badge badge-amber">Pending</span>'}</div>`)).join('');
    return templateBanner('inductions') + `
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="ind">${icon('plus', 'ico')} Log induction</button></div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderManual(site) {
    const list = C.siteRecords('manualHandling', site);
    const cards = list.map(r => listCard('manualHandling', r,
      `<div class="text-sm"><b>${escapeHtml(r.task)}</b> — ${escapeHtml(r.load)}<br>${escapeHtml(r.method)}</div>`)).join('');
    return templateBanner('manualHandling') + `
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="mh">${icon('plus', 'ico')} Add safe system of work</button></div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderSafetyChecks(site) {
    const list = C.siteRecords('safetyChecks', site);
    const cards = list.map(r => listCard('safetyChecks', r,
      `<div class="text-sm"><b>${escapeHtml(r.checkType)}</b> — ${escapeHtml(r.result)}<br>${escapeHtml(r.items)}</div>`)).join('');
    return templateBanner('safetyChecks') + `
      <div class="flex flex-wrap justify-end gap-2 mb-3">
        <button type="button" class="btn btn-primary btn-sm" data-add="sc" data-type="Fire">Fire check</button>
        <button type="button" class="btn btn-primary btn-sm" data-add="sc" data-type="PPE">PPE check</button>
        <button type="button" class="btn btn-primary btn-sm" data-add="sc" data-type="First Aid">First aid check</button>
      </div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderComplaints(site) {
    const addBtns = `<div class="flex flex-wrap justify-end gap-2 mb-3">
      <button type="button" class="btn btn-primary btn-sm" data-add="fc" data-type="Food complaint">Food complaint</button>
      <button type="button" class="btn btn-primary btn-sm" data-add="fc" data-type="Food poisoning allegation">Poisoning allegation</button>
    </div>`;
    if (!C.canViewSensitiveList('foodComplaints')) return templateBanner('foodComplaints') + addBtns + `<div class="card card-pad text-sm text-ink-500">Complaint register (KFS) is manager-only. Staff can still log new complaints above.</div>`;
    const list = C.siteRecords('foodComplaints', site);
    const cards = list.map(r => listCard('foodComplaints', r,
      `<div class="text-sm"><b>${escapeHtml(r.type)}</b> — ${escapeHtml(r.product)}<br>${escapeHtml(r.issue)} ${r.illness ? '<span class="badge badge-red">Illness</span>' : ''}</div>`)).join('');
    return templateBanner('foodComplaints') + addBtns + `<div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderProbe(site) {
    const list = C.siteRecords('probeCalibration', site);
    const cards = list.map(r => listCard('probeCalibration', r,
      `<div class="text-sm"><b>${escapeHtml(r.probe)}</b><br>Ice ${r.iceReading}°C · Boil ${r.boilReading}°C · ${escapeHtml(r.adjustment)}</div>`)).join('');
    return templateBanner('probeCalibration') + `
      <div class="flex flex-wrap justify-end gap-2 mb-3">
        <a href="#temps" class="btn btn-ghost btn-sm">${icon('temp', 'ico')} Live fridge sensors</a>
        <button type="button" class="btn btn-primary btn-sm" data-add="probe">${icon('plus', 'ico')} Log calibration</button>
      </div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderThirdParty(site) {
    const list = C.siteRecords('thirdPartyEvents', site);
    const cards = list.map(r => listCard('thirdPartyEvents', r,
      `<div class="text-sm"><b>${escapeHtml(r.event)}</b> — ${escapeHtml(r.caterer)}<br>Signed off: ${escapeHtml(r.signedOff || '—')}</div>`)).join('');
    return templateBanner('thirdPartyEvents') + `
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="tp">${icon('plus', 'ico')} Log event / caterer</button></div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderHaccpPlan(site) {
    const addBtn = `<div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="haccp">${icon('plus', 'ico')} New HACCP plan from template</button></div>`;
    if (!C.canViewSensitiveList('haccpPlans')) return templateBanner('haccpPlans') + addBtn + `<div class="card card-pad text-sm text-ink-500">Full KHACCP plans are manager-only. Daily CCP logs stay in <a href="#haccp" class="text-brand-600 font-semibold">HACCP &amp; Checklists</a>.</div>`;
    const list = C.siteRecords('haccpPlans', site);
    const cards = list.map(r => listCard('haccpPlans', r,
      `<div class="text-sm"><b>${escapeHtml(r.title)}</b> v${escapeHtml(r.version)}<br>${escapeHtml(r.scope)}</div>`,
      `<button type="button" class="btn btn-ghost btn-sm" data-view-haccp="${escapeHtml(r.id)}">Full plan table</button>`)).join('');
    return templateBanner('haccpPlans') + addBtn + `<div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderFsms(site) {
    if (!C.canViewSensitiveList('fsmsDocuments')) return templateBanner('fsmsDocuments') + `<div class="card card-pad text-sm text-ink-500">FSMS document register is manager-only.</div>`;
    const list = C.siteRecords('fsmsDocuments', site);
    const rows = list.map(r => `<tr class="hover:bg-ink-50">
      <td>${codeBadge(r.code)} ${escapeHtml(r.ref)}</td>
      <td><b>${escapeHtml(r.title)}</b><div class="text-xs text-ink-400">${escapeHtml(r.section)}</div></td>
      <td>v${escapeHtml(r.version)}</td>
      <td><span class="badge ${r.status === 'Approved' ? 'badge-green' : 'badge-amber'}">${escapeHtml(r.status)}</span></td>
      <td>${escapeHtml(r.reviewDate)}</td>
      <td><button type="button" class="btn btn-ghost btn-sm" data-view-record="fsmsDocuments" data-record-id="${escapeHtml(r.id)}">View</button></td>
    </tr>`).join('');
    return templateBanner('fsmsDocuments') + `
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-seed-fsms">${icon('plus', 'ico')} Add FSMS template</button></div>
      <div class="card overflow-x-auto"><table class="table text-sm"><thead><tr><th>Ref</th><th>Document</th><th>Ver</th><th>Status</th><th>Review</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderEquipMaint(site) {
    const list = C.siteRecords('equipmentMaintenance', site);
    const cards = list.map(r => listCard('equipmentMaintenance', r,
      `<div class="text-sm"><b>${escapeHtml(r.equipment)}</b> — ${escapeHtml(r.type)}<br>Due ${escapeHtml(r.due)} · ${escapeHtml(r.result)}</div>`)).join('');
    return templateBanner('equipmentMaintenance') + `
      <p class="text-xs text-ink-400 mb-3">Scheduled PPM — repair tickets stay in <a href="#maintenance" class="text-brand-600 font-semibold">Maintenance</a>.</p>
      <div class="flex justify-end mb-3"><button type="button" class="btn btn-primary btn-sm" data-add="em">${icon('plus', 'ico')} Log maintenance</button></div>
      <div class="grid md:grid-cols-2 gap-4">${cards}</div>`;
  }

  function renderAuditExport(site) {
    if (!C.canExport()) return deniedHtml();
    const sName = siteName(site);
    const counts = C.counts(site);
    const rows = Object.keys(C.emptyCompliance()).map(k => {
      const mod = C.MODULES.find(m => m.id === k);
      return `<tr><td>${escapeHtml(mod ? mod.label : k)}</td><td class="text-center font-semibold">${counts[k] || 0}</td><td>${mod && mod.code ? codeBadge(mod.code) : '—'}</td></tr>`;
    }).join('');
    return templateBanner('auditExport') + `
      <div class="card card-pad mb-4"><h3 class="font-bold mb-2">Sample counts — ${escapeHtml(sName)}</h3>
        <table class="table text-sm"><thead><tr><th>Module</th><th>Records</th><th>Code</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      <div class="card card-pad" id="complianceAuditPrint">
        <h3 class="font-bold text-lg mb-2">EHO audit pack</h3>
        <div class="flex flex-wrap gap-2 mb-4">
          <button type="button" class="btn btn-primary btn-sm" data-export-zip">${icon('download', 'ico')} ZIP audit pack</button>
          <button type="button" class="btn btn-ghost btn-sm" data-export-json">${icon('download', 'ico')} JSON pack</button>
          <button type="button" class="btn btn-ghost btn-sm" data-print-audit">${icon('print', 'ico')} Print / PDF</button>
        </div>
        <div class="flex flex-wrap gap-2">${Object.keys(C.emptyCompliance()).map(k => `<button type="button" class="btn btn-ghost btn-sm" data-csv-mod="${k}">${k}.csv</button>`).join('')}</div>
      </div>`;
  }

  const RENDERERS = {
    overview: renderOverview, hsChecks: renderHsChecks, riskAssessments: renderRisk, coshh: renderCoshh,
    accidents: renderAccidents, inductions: renderInductions, manualHandling: renderManual, safetyChecks: renderSafetyChecks,
    foodComplaints: renderComplaints, probeCalibration: renderProbe, thirdPartyEvents: renderThirdParty,
    haccpPlans: renderHaccpPlan, fsmsDocuments: renderFsms, equipmentMaintenance: renderEquipMaint, auditExport: renderAuditExport,
  };

  function compliance() {
    const site = S.db.currentSite;
    C.ensure(S.db);
    const tab = activeTab();
    if (!C.canViewModule(tab)) {
      return { title: 'Kitchen Compliance', html: sectionHeader('Kitchen Compliance', 'SafeServe · H&S · FSMS') + deniedHtml(), mount() {} };
    }
    const body = (RENDERERS[tab] || renderOverview)(site);
    const html = `
      ${sectionHeader('Kitchen Compliance', 'SafeServe · Health &amp; Safety · FSMS · ' + escapeHtml(siteName(site)), `
        <a href="#temps" class="btn btn-ghost btn-sm">${icon('temp', 'ico')} Fridge temps</a>
        <a href="#alerts" class="btn btn-ghost btn-sm">${icon('alert', 'ico')} SMS alerts</a>
        <a href="#reports" class="btn btn-ghost btn-sm">${icon('reports', 'ico')} Reports</a>`)}
      ${tabNav(tab)}
      <div class="compliance-panel fade-in">${body}</div>`;
    return {
      title: 'Kitchen Compliance',
      html,
      mount() {
        const root = document.getElementById('view');
        if (!root) return;

        root.querySelectorAll('[data-view-record]').forEach(btn => {
          btn.onclick = () => {
            const key = btn.dataset.viewRecord;
            const rec = (S.db.compliance[key] || []).find(x => x.id === btn.dataset.recordId);
            if (rec) showRecordModal(key, rec);
            else toast('Record not found', 'warn');
          };
        });

        const addHs = root.querySelector('[data-add="hs"]');
        if (addHs) addHs.onclick = () => {
          modal('Log H&S check (KHS)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Check type (e.g. Daily walkthrough)">
            <input id="f2" class="input" placeholder="Areas covered">
            <textarea id="f3" class="input" rows="2" placeholder="Findings"></textarea>
            <textarea id="f4" class="input" rows="2" placeholder="Action taken"></textarea>
            <button type="button" class="btn btn-primary w-full" id="save">Save KHS record</button></div>`);
          document.getElementById('save').onclick = () => {
            const type = document.getElementById('f1').value.trim();
            if (!type) return toast('Enter check type', 'warn');
            pushRecord('hsChecks', { id: S.uid('khs'), ref: C.nextRef('KHS', 'hsChecks'), site, type, areas: document.getElementById('f2').value.trim(), findings: document.getElementById('f3').value.trim(), action: document.getElementById('f4').value.trim(), status: 'Open', by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KHS' });
            closeModal(); toast('KHS record saved'); window.App.render();
          };
        };

        const addRa = root.querySelector('[data-add="ra"]');
        if (addRa) addRa.onclick = () => {
          modal('New risk assessment (KRA)', `<div class="space-y-3">
            <select id="f1" class="select">${C.RISK_AREAS.map(a => `<option>${escapeHtml(a)}</option>`).join('')}</select>
            <input id="f2" class="input" placeholder="Specific area / activity">
            <textarea id="f3" class="input" rows="2" placeholder="Hazards identified"></textarea>
            <textarea id="f4" class="input" rows="2" placeholder="Existing controls"></textarea>
            <div class="grid grid-cols-3 gap-2"><input id="f5" class="input" type="number" min="1" max="5" value="2"><input id="f6" class="input" type="number" min="1" max="5" value="3"><input id="f7" class="input" type="date"></div>
            <button type="button" class="btn btn-primary w-full" id="save">Save KRA</button></div>`);
          document.getElementById('save').onclick = () => {
            const area = document.getElementById('f2').value.trim() || document.getElementById('f1').value;
            const l = +document.getElementById('f5').value, sev = +document.getElementById('f6').value;
            pushRecord('riskAssessments', { id: S.uid('kra'), ref: C.nextRef('KRA', 'riskAssessments'), site, area, hazards: document.getElementById('f3').value.trim(), persons: 'Kitchen staff', existing: document.getElementById('f4').value.trim(), further: '', likelihood: l, severity: sev, risk: l * sev, residual: Math.max(1, l + sev - 2), reviewDate: document.getElementById('f7').value || new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KRA', status: 'Active' });
            closeModal(); toast('Risk assessment saved'); window.App.render();
          };
        };

        const addCoshh = root.querySelector('[data-add="coshh"]');
        if (addCoshh) addCoshh.onclick = () => {
          modal('COSHH record (KCOSHH)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Product name">
            <input id="f2" class="input" placeholder="Hazard classification">
            <input id="f3" class="input" placeholder="Storage location">
            <input id="f4" class="input" placeholder="PPE required">
            <button type="button" class="btn btn-primary w-full" id="save">Save KCOSHH</button></div>`);
          document.getElementById('save').onclick = () => {
            const product = document.getElementById('f1').value.trim();
            if (!product) return toast('Enter product name', 'warn');
            pushRecord('coshh', { id: S.uid('kc'), ref: C.nextRef('KCOSHH', 'coshh'), site, product, supplier: '', hazard: document.getElementById('f2').value.trim(), storage: document.getElementById('f3').value.trim(), ppe: document.getElementById('f4').value.trim(), exposure: '', emergency: '', sdsDate: new Date().toISOString().slice(0, 10), reviewDate: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KCOSHH' });
            closeModal(); toast('COSHH record saved'); window.App.render();
          };
        };

        const addAcc = root.querySelector('[data-add="acc"]');
        if (addAcc) addAcc.onclick = () => {
          modal('Accident report (KACC)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Injured person name">
            <input id="f2" class="input" type="date" value="${new Date().toISOString().slice(0, 10)}">
            <input id="f3" class="input" placeholder="Location">
            <input id="f4" class="input" placeholder="Injury type">
            <textarea id="f5" class="input" rows="3" placeholder="Description"></textarea>
            <textarea id="f6" class="input" rows="2" placeholder="First aid given"></textarea>
            <label class="text-sm"><input type="checkbox" id="f7"> RIDDOR reportable</label>
            <button type="button" class="btn btn-primary w-full" id="save">Save KACC</button></div>`);
          document.getElementById('save').onclick = () => {
            const injured = document.getElementById('f1').value.trim();
            if (!injured) return toast('Enter name', 'warn');
            pushRecord('accidents', { id: S.uid('kacc'), ref: C.nextRef('KACC', 'accidents'), site, injured, role: '', date: document.getElementById('f2').value, time: new Date().toTimeString().slice(0, 5), location: document.getElementById('f3').value.trim(), type: document.getElementById('f4').value.trim(), description: document.getElementById('f5').value.trim(), firstAid: document.getElementById('f6').value.trim(), riddor: document.getElementById('f7').checked, witness: '', action: '', status: 'Open', by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KACC' });
            closeModal(); toast('Accident recorded'); window.App.render();
          };
        };

        root.querySelectorAll('[data-close-acc]').forEach(b => b.onclick = () => {
          const inc = S.db.compliance.accidents.find(x => x.id === b.dataset.closeAcc);
          if (inc) { inc.status = 'Closed'; S.persist(); window.App.render(); toast('Accident closed'); }
        });

        const addInd = root.querySelector('[data-add="ind"]');
        if (addInd) addInd.onclick = () => {
          modal('Staff induction (KHS)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Staff name">
            <input id="f2" class="input" placeholder="Trainer">
            <textarea id="f3" class="input" rows="3" placeholder="Topics covered"></textarea>
            <button type="button" class="btn btn-primary w-full" id="save">Save induction</button></div>`);
          document.getElementById('save').onclick = () => {
            const staff = document.getElementById('f1').value.trim();
            if (!staff) return toast('Enter staff name', 'warn');
            pushRecord('inductions', { id: S.uid('ind'), ref: C.nextRef('KHS', 'inductions'), site, staff, trainer: document.getElementById('f2').value.trim(), topics: document.getElementById('f3').value.trim(), signed: true, at: S.now(), reviewDate: new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10), code: 'KHS' });
            closeModal(); toast('Induction logged'); window.App.render();
          };
        };

        const addMh = root.querySelector('[data-add="mh"]');
        if (addMh) addMh.onclick = () => {
          modal('Manual handling (KSSW)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Task description">
            <input id="f2" class="input" placeholder="Load weight">
            <textarea id="f3" class="input" rows="3" placeholder="Safe method"></textarea>
            <label class="text-sm"><input type="checkbox" id="f4"> Team lift required</label>
            <button type="button" class="btn btn-primary w-full" id="save">Save KSSW</button></div>`);
          document.getElementById('save').onclick = () => {
            const task = document.getElementById('f1').value.trim();
            if (!task) return toast('Enter task', 'warn');
            pushRecord('manualHandling', { id: S.uid('kssw'), ref: C.nextRef('KSSW', 'manualHandling'), site, task, load: document.getElementById('f2').value.trim(), method: document.getElementById('f3').value.trim(), teamLift: document.getElementById('f4').checked, training: true, lastReview: new Date().toISOString().slice(0, 10), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KSSW' });
            closeModal(); toast('KSSW saved'); window.App.render();
          };
        };

        root.querySelectorAll('[data-add="sc"]').forEach(btn => {
          btn.onclick = () => {
            const checkType = btn.dataset.type;
            modal(checkType + ' check (KHS)', `<div class="space-y-3">
              <textarea id="f1" class="input" rows="3" placeholder="Items checked"></textarea>
              <select id="f2" class="select"><option>Pass</option><option>Fail</option><option>Action required</option></select>
              <input id="f3" class="input" placeholder="Action if needed">
              <button type="button" class="btn btn-primary w-full" id="save">Save check</button></div>`);
            document.getElementById('save').onclick = () => {
              pushRecord('safetyChecks', { id: S.uid('sc'), ref: C.nextRef('KHS', 'safetyChecks'), site, checkType, items: document.getElementById('f1').value.trim(), result: document.getElementById('f2').value, action: document.getElementById('f3').value.trim(), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KHS' });
              closeModal(); toast('Check saved'); window.App.render();
            };
          };
        });

        root.querySelectorAll('[data-add="fc"]').forEach(btn => {
          btn.onclick = () => {
            const type = btn.dataset.type;
            modal(type + ' (KFS)', `<div class="space-y-3">
              <input id="f1" class="input" placeholder="Customer / complainant">
              <input id="f2" class="input" placeholder="Product">
              <textarea id="f3" class="input" rows="3" placeholder="Issue"></textarea>
              <label class="text-sm"><input type="checkbox" id="f4"> Illness reported</label>
              <textarea id="f5" class="input" rows="2" placeholder="Action taken"></textarea>
              <button type="button" class="btn btn-primary w-full" id="save">Save KFS record</button></div>`);
            document.getElementById('save').onclick = () => {
              pushRecord('foodComplaints', { id: S.uid('kfs'), ref: C.nextRef('KFS', 'foodComplaints'), site, type, customer: document.getElementById('f1').value.trim(), date: new Date().toISOString().slice(0, 10), product: document.getElementById('f2').value.trim(), issue: document.getElementById('f3').value.trim(), illness: document.getElementById('f4').checked, notified: currentUser().name, action: document.getElementById('f5').value.trim(), status: 'Open', by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KFS' });
              closeModal(); toast('KFS record saved'); window.App.render();
            };
          };
        });

        const addProbe = root.querySelector('[data-add="probe"]');
        if (addProbe) addProbe.onclick = () => {
          modal('Probe calibration (KFS)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Probe ID">
            <input id="f2" class="input" type="number" step="0.1" placeholder="Ice bath °C">
            <input id="f3" class="input" type="number" step="0.1" placeholder="Boiling °C">
            <input id="f4" class="input" placeholder="Adjustment / result">
            <input id="f5" class="input" type="date">
            <button type="button" class="btn btn-primary w-full" id="save">Save calibration</button></div>`);
          document.getElementById('save').onclick = () => {
            const probe = document.getElementById('f1').value.trim();
            if (!probe) return toast('Enter probe name', 'warn');
            pushRecord('probeCalibration', { id: S.uid('pc'), ref: C.nextRef('KFS', 'probeCalibration'), site, probe, method: 'Ice 0°C / boiling 100°C', iceReading: +document.getElementById('f2').value, boilReading: +document.getElementById('f3').value, adjustment: document.getElementById('f4').value.trim() || 'Within tolerance', nextDue: document.getElementById('f5').value || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KFS' });
            closeModal(); toast('Calibration logged'); window.App.render();
          };
        };

        const addTp = root.querySelector('[data-add="tp"]');
        if (addTp) addTp.onclick = () => {
          modal('Third-party event (KFS)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Event name">
            <input id="f2" class="input" placeholder="Caterer">
            <input id="f3" class="input" type="date" value="${new Date().toISOString().slice(0, 10)}">
            <input id="f4" class="input" placeholder="Signed off by">
            <textarea id="f5" class="input" rows="2" placeholder="Notes"></textarea>
            <button type="button" class="btn btn-primary w-full" id="save">Save event record</button></div>`);
          document.getElementById('save').onclick = () => {
            const event = document.getElementById('f1').value.trim();
            if (!event) return toast('Enter event name', 'warn');
            pushRecord('thirdPartyEvents', { id: S.uid('tp'), ref: C.nextRef('KFS', 'thirdPartyEvents'), site, event, caterer: document.getElementById('f2').value.trim(), date: document.getElementById('f3').value, menuApproved: true, allergenBrief: true, tempChecks: true, signedOff: document.getElementById('f4').value.trim(), notes: document.getElementById('f5').value.trim(), by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KFS' });
            closeModal(); toast('Event record saved'); window.App.render();
          };
        };

        const addHaccp = root.querySelector('[data-add="haccp"]');
        if (addHaccp) addHaccp.onclick = () => {
            pushRecord('haccpPlans', { id: S.uid('hp'), ref: C.nextRef('KHACCP', 'haccpPlans'), site, title: 'Kitchen HACCP plan', version: '1.0', owner: currentUser().name, scope: siteName(site) + ' — main kitchen', steps: C.HACCP_STEPS.map(s => Object.assign({}, s)), reviewDate: new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10), approvedBy: currentUser().name, at: S.now(), code: 'KHACCP', status: 'Draft' });
          toast('HACCP plan created from template'); window.App.render();
        };

        root.querySelectorAll('[data-view-haccp]').forEach(b => {
          b.onclick = () => {
            const plan = S.db.compliance.haccpPlans.find(x => x.id === b.dataset.viewHaccp);
            if (!plan) return toast('Plan not found', 'warn');
            const rows = (plan.steps || []).map(s => `<tr><td>${s.step}</td><td>${escapeHtml(s.hazard)}</td><td>${s.ccp ? 'Yes' : 'No'}</td><td>${escapeHtml(s.limit)}</td><td>${escapeHtml(s.monitor)}</td><td>${escapeHtml(s.corrective)}</td></tr>`).join('');
            modal('HACCP Plan ' + plan.ref, `<div class="text-sm mb-3"><b>${escapeHtml(plan.title)}</b> v${escapeHtml(plan.version)}</div>
              <div class="overflow-x-auto max-h-[60vh]"><table class="table text-xs"><thead><tr><th>#</th><th>Hazard</th><th>CCP</th><th>Limit</th><th>Monitor</th><th>Corrective</th></tr></thead><tbody>${rows}</tbody></table></div>`, { wide: true });
          };
        });

        const seedFsms = root.querySelector('[data-seed-fsms]');
        if (seedFsms) seedFsms.onclick = () => {
          const t = C.FSMS_TEMPLATES.find(x => !C.siteRecords('fsmsDocuments', site).some(d => d.title === x.title));
          if (!t) return toast('All FSMS templates already added', 'warn');
          pushRecord('fsmsDocuments', { id: S.uid('fsms'), ref: C.nextRef('KFS', 'fsmsDocuments'), site, title: t.title, section: t.section, version: '1.0', status: 'Draft', reviewDate: new Date(Date.now() + t.reviewMonths * 30 * 864e5).toISOString().slice(0, 10), owner: currentUser().name, at: S.now(), code: 'KFS' });
          toast('FSMS document added'); window.App.render();
        };

        const addEm = root.querySelector('[data-add="em"]');
        if (addEm) addEm.onclick = () => {
          modal('Equipment maintenance (KHS)', `<div class="space-y-3">
            <input id="f1" class="input" placeholder="Equipment">
            <input id="f2" class="input" placeholder="Maintenance type">
            <input id="f3" class="input" type="date">
            <input id="f4" class="input" placeholder="Provider">
            <button type="button" class="btn btn-primary w-full" id="save">Save record</button></div>`);
          document.getElementById('save').onclick = () => {
            const equipment = document.getElementById('f1').value.trim();
            if (!equipment) return toast('Enter equipment', 'warn');
            pushRecord('equipmentMaintenance', { id: S.uid('em'), ref: C.nextRef('KHS', 'equipmentMaintenance'), site, equipment, type: document.getElementById('f2').value.trim(), due: document.getElementById('f3').value, completed: '', provider: document.getElementById('f4').value.trim(), result: 'Scheduled', nextDue: document.getElementById('f3').value, by: (S.db.team[0] && S.db.team[0].id) || 'u_sarah', at: S.now(), code: 'KHS' });
            closeModal(); toast('Maintenance record saved'); window.App.render();
          };
        };

        const zipBtn = root.querySelector('[data-export-zip]');
        if (zipBtn) zipBtn.onclick = () => {
          zipBtn.disabled = true;
          C.exportAuditZip(site).then(() => toast('Audit ZIP downloaded')).catch(e => toast(e.message || 'Export failed', 'error')).finally(() => { zipBtn.disabled = false; });
        };
        root.querySelector('[data-export-json]') && (root.querySelector('[data-export-json]').onclick = () => C.exportAuditZip(site).then(() => toast('Audit pack downloaded')));
        root.querySelector('[data-print-audit]') && (root.querySelector('[data-print-audit]').onclick = () => window.print());
        root.querySelectorAll('[data-csv-mod]').forEach(b => { b.onclick = () => { C.exportModuleCsv(b.dataset.csvMod, site); toast('CSV exported'); }; });
      },
    };
  }

  window.ComplianceViews = { compliance };
  if (window.Views) Object.assign(window.Views, window.ComplianceViews);
})();
