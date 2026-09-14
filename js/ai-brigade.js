/* ============================================================
   Kiteline AI Brigade — local multi-agent orchestration layer
   - Manager selects specialist agents from the live workspace
   - Read-only in v1: agents analyse and recommend, never mutate data
   - Offline-capable: uses Store.db, so no model/API key is required
   ============================================================ */
(function () {
  'use strict';

  const S = window.Store;
  const UI = window.UI || {};
  const esc = UI.escapeHtml || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])));
  const toast = UI.toast || (() => {});

  const MAX_SPECIALISTS = 4;

  function arr(v) { return Array.isArray(v) ? v : []; }
  function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
  function nowIso() { return new Date().toISOString(); }
  function today() { return nowIso().slice(0, 10); }
  function siteId() {
    try { const site = S && S.site && S.site(); return site && (site.id || site.siteId); } catch {}
    return S && S.db && (S.db.currentSite || S.db.siteId) || null;
  }
  function belongs(row) {
    const sid = siteId();
    if (!sid || !row) return true;
    const rid = row.site || row.siteId;
    return !rid || rid === sid;
  }
  function scoped(key) { return arr(S && S.db && S.db[key]).filter(belongs); }
  function lower(v) { return String(v || '').toLowerCase(); }
  function openStatus(v) { return /open|active|pending|overdue|critical|unresolved|due/i.test(String(v || '')); }
  function dateValue(v) { const t = Date.parse(v || ''); return Number.isFinite(t) ? t : null; }
  function withinDays(v, days) {
    const t = dateValue(v); if (!t) return false;
    const delta = t - Date.now(); return delta >= 0 && delta <= days * 86400000;
  }
  function expired(v) { const t = dateValue(v); return !!t && t < Date.now(); }
  function incompleteChecklist(c) {
    const items = arr(c.items || c.tasks || c.checks);
    if (!items.length) return openStatus(c.status);
    return items.some((i) => !(i.done || i.complete || i.completed || i.checked));
  }

  function workspaceSnapshot() {
    const db = (S && S.db) || {};
    const sensors = scoped('sensors');
    const alerts = scoped('alerts');
    const checklists = scoped('checklists');
    const recipes = scoped('recipes');
    const menus = scoped('menus');
    const batches = scoped('batches');
    const suppliers = scoped('suppliers');
    const incidents = scoped('incidents');
    const assets = scoped('assets');
    const waste = scoped('waste');
    const team = scoped('team');
    const training = scoped('training');
    const badSensors = sensors.filter((s) => num(s.temp) < num(s.min) || num(s.temp) > num(s.max));
    return {
      site: siteId(),
      generatedAt: nowIso(),
      counts: {
        sensors: sensors.length,
        tempBreaches: badSensors.length,
        openAlerts: alerts.filter((a) => openStatus(a.status)).length,
        incompleteChecklists: checklists.filter(incompleteChecklist).length,
        recipes: recipes.length,
        menus: menus.length,
        batches: batches.length,
        suppliers: suppliers.length,
        incidents: incidents.filter((i) => openStatus(i.status)).length,
        assets: assets.length,
        wasteEntries: waste.length,
        team: team.length,
        training: training.length,
      },
      org: db.org || {},
    };
  }

  function result(agent, severity, summary, findings, actions, metrics) {
    return {
      agentId: agent.id,
      name: agent.name,
      severity: severity || 'info',
      summary,
      findings: arr(findings).filter(Boolean),
      actions: arr(actions).filter(Boolean),
      metrics: metrics || {},
      completedAt: nowIso(),
    };
  }

  const AGENTS = [
    {
      id: 'food-safety', name: 'Food Safety Agent', domain: 'Safety', risk: 'high',
      description: 'Temperatures, live alerts, unsafe conditions and immediate corrective action.',
      keywords: ['temperature','temp','fridge','freezer','unsafe','safety','breach','probe','hot hold','cold hold','danger'],
      run(agent) {
        const sensors = scoped('sensors');
        const alerts = scoped('alerts').filter((a) => openStatus(a.status));
        const bad = sensors.filter((s) => num(s.temp) < num(s.min) || num(s.temp) > num(s.max));
        const findings = bad.map((s) => `${s.name || 'Sensor'} is ${s.temp}°C; configured range ${s.min}–${s.max}°C.`)
          .concat(alerts.slice(0, 4).map((a) => `Open alert: ${a.title || a.detail || a.type || 'Kitchen alert'}.`));
        return result(agent, bad.length || alerts.some((a) => /critical/i.test(a.severity)) ? 'critical' : alerts.length ? 'warning' : 'good',
          bad.length ? `${bad.length} live temperature breach${bad.length === 1 ? '' : 'es'} need attention.` : 'No live temperature breach detected in the current workspace.',
          findings,
          bad.length ? ['Quarantine affected high-risk food where required.', 'Verify with a calibrated probe and record the corrective action.', 'Escalate repeated equipment breaches to Maintenance.'] : ['Continue scheduled temperature checks and calibration.'],
          { sensors: sensors.length, breaches: bad.length, openAlerts: alerts.length });
      },
    },
    {
      id: 'haccp', name: 'HACCP Agent', domain: 'Compliance', risk: 'high',
      description: 'CCPs, opening/closing checks, records and corrective actions.',
      keywords: ['haccp','ccp','checklist','opening','closing','compliance','record','audit','corrective'],
      run(agent) {
        const lists = scoped('checklists').filter((c) => /haccp|opening|closing|food safety|ccp/i.test(`${c.name || ''} ${c.title || ''}`));
        const incomplete = lists.filter(incompleteChecklist);
        return result(agent, incomplete.length ? 'warning' : 'good',
          incomplete.length ? `${incomplete.length} HACCP/opening/closing checklist${incomplete.length === 1 ? '' : 's'} appear incomplete.` : 'No incomplete HACCP-style checklist was detected.',
          incomplete.slice(0, 6).map((c) => `${c.name || c.title || 'Checklist'} — ${c.status || 'in progress'}.`),
          incomplete.length ? ['Complete outstanding CCP/checklist items before shift close.', 'Record corrective action against every failed critical check.'] : ['Keep daily HACCP sign-off current.'],
          { relevantChecklists: lists.length, incomplete: incomplete.length });
      },
    },
    {
      id: 'allergen', name: 'Allergen & Dietary Agent', domain: 'Guest Safety', risk: 'high',
      description: 'Allergen completeness, dietary profiles, menu/recipe cross-checks.',
      keywords: ['allergen','allergy','dietary','vegan','vegetarian','jain','ekadashi','gluten','dairy','nut','sesame','soya','celery','mustard'],
      run(agent) {
        const recipes = scoped('recipes');
        const menus = scoped('menus');
        const missing = recipes.filter((r) => !Array.isArray(r.allergens) && !String(r.allergens || '').trim());
        const dietary = ((S.db || {}).org || {}).dietary || {};
        return result(agent, missing.length ? 'warning' : 'good',
          missing.length ? `${missing.length} recipe${missing.length === 1 ? '' : 's'} have no explicit allergen data.` : 'Recipe allergen fields are populated for the current site.',
          missing.slice(0, 8).map((r) => `${r.name || 'Unnamed recipe'} needs allergen verification.`)
            .concat(arr(dietary.enabled).length ? [`Enabled dietary profiles: ${arr(dietary.enabled).join(', ')}.`] : []),
          ['Never auto-confirm an allergy-safe meal from AI alone; verify the current recipe, labels and cross-contact controls.', missing.length ? 'Complete allergen fields before menu publication or service.' : 'Recheck allergens whenever ingredients or supplier specifications change.'],
          { recipes: recipes.length, menus: menus.length, missingAllergenData: missing.length });
      },
    },
    {
      id: 'stock', name: 'Stock Agent', domain: 'Inventory', risk: 'medium',
      description: 'Low stock, expiry risk, batches, FIFO and availability.',
      keywords: ['stock','inventory','batch','fifo','expiry','expire','low stock','reorder','store','storage'],
      run(agent) {
        const batches = scoped('batches');
        const low = batches.filter((b) => {
          const q = num(b.qty != null ? b.qty : b.quantity);
          const min = num(b.minQty != null ? b.minQty : b.reorderLevel);
          return min ? q <= min : q > 0 && q <= 2;
        });
        const exp = batches.filter((b) => withinDays(b.expiry || b.useBy || b.bestBefore, 3) || expired(b.expiry || b.useBy || b.bestBefore));
        return result(agent, exp.some((b) => expired(b.expiry || b.useBy || b.bestBefore)) ? 'critical' : (low.length || exp.length) ? 'warning' : 'good',
          `${low.length} low-stock and ${exp.length} near/over-expiry batch${exp.length === 1 ? '' : 'es'} detected.`,
          low.slice(0, 5).map((b) => `Low: ${b.name || b.product || b.sku || 'Stock item'} (${b.qty ?? b.quantity ?? '?'} ${b.unit || ''}).`)
            .concat(exp.slice(0, 5).map((b) => `Date check: ${b.name || b.product || 'Batch'} — ${b.expiry || b.useBy || b.bestBefore}.`)),
          ['Apply FIFO/FEFO and isolate expired stock.', low.length ? 'Create a purchasing review for low-stock items.' : 'Maintain par levels against forecast covers.'],
          { batches: batches.length, lowStock: low.length, dateRisk: exp.length });
      },
    },
    {
      id: 'purchasing', name: 'Purchasing Agent', domain: 'Procurement', risk: 'medium',
      description: 'Reorder needs, supplier coverage and purchasing priorities.',
      keywords: ['purchase','purchasing','order','buy','reorder','po','supplier','delivery','shopping list'],
      run(agent) {
        const batches = scoped('batches');
        const suppliers = scoped('suppliers');
        const low = batches.filter((b) => {
          const q = num(b.qty != null ? b.qty : b.quantity); const min = num(b.minQty != null ? b.minQty : b.reorderLevel);
          return min ? q <= min : q > 0 && q <= 2;
        });
        return result(agent, low.length ? 'warning' : 'good',
          low.length ? `${low.length} stock item${low.length === 1 ? '' : 's'} should be reviewed for ordering.` : 'No obvious low-stock reorder trigger detected.',
          low.slice(0, 8).map((b) => `${b.name || b.product || 'Item'} — current ${b.qty ?? b.quantity ?? '?'}, par ${b.minQty ?? b.reorderLevel ?? 'not set'}, supplier ${b.supplier || 'not assigned'}.`),
          [low.length ? 'Consolidate shortages by supplier before raising POs.' : 'Keep reorder levels aligned with forecast covers.', suppliers.length ? `Use the approved supplier register (${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} visible).` : 'Add approved suppliers before automated purchasing is enabled.'],
          { reorderCandidates: low.length, suppliers: suppliers.length });
      },
    },
    {
      id: 'menu', name: 'Menu Agent', domain: 'Menu Planning', risk: 'medium',
      description: 'Menu coverage, service readiness, dietary balance and recipe linkage.',
      keywords: ['menu','lunch','dinner','breakfast','covers','guest','service','dish','meal'],
      run(agent) {
        const menus = scoped('menus'); const recipes = scoped('recipes');
        const draft = menus.filter((m) => /draft|planning|incomplete/i.test(String(m.status || '')));
        return result(agent, !menus.length ? 'warning' : 'good',
          menus.length ? `${menus.length} menu${menus.length === 1 ? '' : 's'} available; ${draft.length} still appear draft/in planning.` : 'No menu is currently recorded for this site.',
          draft.slice(0, 6).map((m) => `${m.name || m.title || 'Menu'} — ${m.status || 'draft'}.`),
          ['Before publishing, cross-check every dish against current recipe, allergens, stock and guest dietary requirements.', !recipes.length ? 'Create standard recipe cards before using automated menu quantities.' : `Use the ${recipes.length} current recipe cards for scaling and production planning.`],
          { menus: menus.length, draftMenus: draft.length, recipes: recipes.length });
      },
    },
    {
      id: 'recipe', name: 'Recipe Agent', domain: 'Production Standards', risk: 'medium',
      description: 'Recipe completeness, method, yield, allergen and cost fields.',
      keywords: ['recipe','yield','portion','ingredient','method','cook','prep','production','scale'],
      run(agent) {
        const recipes = scoped('recipes');
        const incomplete = recipes.filter((r) => !arr(r.ingredients).length || !(arr(r.method).length || arr(r.proMethod).length || String(r.method || '').trim()));
        const noCost = recipes.filter((r) => !num(r.cost) && !num(r.costPerPortion));
        return result(agent, incomplete.length ? 'warning' : 'good',
          `${incomplete.length} incomplete recipe card${incomplete.length === 1 ? '' : 's'} and ${noCost.length} without costing data.`,
          incomplete.slice(0, 6).map((r) => `${r.name || 'Recipe'} is missing ingredients or method.`),
          [incomplete.length ? 'Complete standard recipe cards before production or training use.' : 'Recipe cards have basic production fields.', noCost.length ? 'Add ingredient/portion costing to improve menu margin decisions.' : 'Continue monitoring recipe cost changes.'],
          { recipes: recipes.length, incomplete: incomplete.length, missingCost: noCost.length });
      },
    },
    {
      id: 'costing', name: 'Costing Agent', domain: 'Finance', risk: 'medium',
      description: 'Recipe costs, waste cost and margin-data completeness.',
      keywords: ['cost','costing','budget','margin','profit','price','food cost','spend','saving'],
      run(agent) {
        const recipes = scoped('recipes'); const waste = scoped('waste');
        const missing = recipes.filter((r) => !num(r.cost) && !num(r.costPerPortion));
        const wasteCost = waste.reduce((n, w) => n + num(w.cost || w.value), 0);
        const recipeCost = recipes.reduce((n, r) => n + num(r.cost || r.costPerPortion), 0);
        return result(agent, missing.length ? 'warning' : 'good',
          `${missing.length} recipe${missing.length === 1 ? '' : 's'} lack cost data; recorded waste value is £${wasteCost.toFixed(2)}.`,
          missing.slice(0, 6).map((r) => `${r.name || 'Recipe'} needs costing.`),
          ['Prioritise costing high-volume dishes first.', wasteCost > 0 ? 'Compare waste cost against purchasing and production forecasts.' : 'Record waste value as well as weight for useful ROI reporting.'],
          { recipes: recipes.length, missingCost: missing.length, recordedRecipeCost: recipeCost, wasteCost });
      },
    },
    {
      id: 'cleaning', name: 'Cleaning Agent', domain: 'Hygiene', risk: 'high',
      description: 'Cleaning schedules, overdue hygiene tasks and sign-off.',
      keywords: ['clean','cleaning','deep clean','hygiene','sanitize','sanitise','potwash','dishwash','floor'],
      run(agent) {
        const lists = scoped('checklists').filter((c) => /clean|hygiene|sanit|closing/i.test(`${c.name || ''} ${c.title || ''}`));
        const incomplete = lists.filter(incompleteChecklist);
        return result(agent, incomplete.length ? 'warning' : 'good',
          incomplete.length ? `${incomplete.length} cleaning/hygiene checklist${incomplete.length === 1 ? '' : 's'} need completion.` : 'No incomplete cleaning checklist detected.',
          incomplete.slice(0, 8).map((c) => `${c.name || c.title || 'Cleaning checklist'} — ${c.status || 'in progress'}.`),
          [incomplete.length ? 'Assign owner and finish/sign each outstanding hygiene task.' : 'Maintain daily close-down and scheduled deep-clean verification.', 'Record completion time to build reliable labour/SOP timing data.'],
          { cleaningChecklists: lists.length, incomplete: incomplete.length });
      },
    },
    {
      id: 'maintenance', name: 'Maintenance Agent', domain: 'Equipment', risk: 'high',
      description: 'Equipment faults, incidents, assets and operational risk.',
      keywords: ['maintenance','equipment','fault','broken','repair','oven','fridge','freezer','dishwasher','machine','asset'],
      run(agent) {
        const incidents = scoped('incidents').filter((i) => openStatus(i.status));
        const assets = scoped('assets');
        const due = assets.filter((a) => withinDays(a.serviceDue || a.nextService || a.calibrationDue, 14) || expired(a.serviceDue || a.nextService || a.calibrationDue));
        return result(agent, incidents.length ? 'warning' : due.some((a) => expired(a.serviceDue || a.nextService || a.calibrationDue)) ? 'warning' : 'good',
          `${incidents.length} open incident/fault${incidents.length === 1 ? '' : 's'} and ${due.length} asset${due.length === 1 ? '' : 's'} with service/calibration dates requiring review.`,
          incidents.slice(0, 5).map((i) => `${i.title || i.type || 'Incident'} — ${i.status || 'open'}.`)
            .concat(due.slice(0, 5).map((a) => `${a.name || 'Asset'} — due ${a.serviceDue || a.nextService || a.calibrationDue}.`)),
          ['Remove unsafe equipment from use until assessed.', due.length ? 'Schedule due service/calibration and attach evidence to the asset record.' : 'Keep preventive maintenance dates current.'],
          { openIncidents: incidents.length, assets: assets.length, dueAssets: due.length });
      },
    },
    {
      id: 'waste', name: 'Waste Agent', domain: 'Sustainability', risk: 'low',
      description: 'Waste quantity/cost, likely drivers and reduction priorities.',
      keywords: ['waste','throw','bin','discard','spoil','overproduce','leftover','wastage'],
      run(agent) {
        const waste = scoped('waste');
        const cost = waste.reduce((n, w) => n + num(w.cost || w.value), 0);
        const reasons = {};
        waste.forEach((w) => { const r = w.reason || w.stage || 'Unspecified'; reasons[r] = (reasons[r] || 0) + 1; });
        const top = Object.entries(reasons).sort((a,b) => b[1]-a[1]).slice(0, 4);
        return result(agent, cost > 0 || waste.length ? 'info' : 'good',
          `${waste.length} waste entr${waste.length === 1 ? 'y' : 'ies'} recorded with £${cost.toFixed(2)} stated value.`,
          top.map(([r,c]) => `${r}: ${c} entr${c === 1 ? 'y' : 'ies'}.`),
          ['Link waste to production forecast, portioning and ordering decisions.', !cost && waste.length ? 'Add cost/value to waste entries to quantify savings.' : 'Review highest-frequency waste reason first.'],
          { entries: waste.length, cost });
      },
    },
    {
      id: 'supplier', name: 'Supplier Agent', domain: 'Supply Chain', risk: 'medium',
      description: 'Approved suppliers, due diligence, certification and supply risk.',
      keywords: ['supplier','vendor','brakes','suma','delivery','certificate','audit','approved'],
      run(agent) {
        const suppliers = scoped('suppliers');
        const attention = suppliers.filter((s) => /suspend|blocked|review|expired|inactive/i.test(String(s.status || '')) || expired(s.certificateExpiry || s.certExpiry) || withinDays(s.certificateExpiry || s.certExpiry, 30));
        return result(agent, attention.length ? 'warning' : 'good',
          attention.length ? `${attention.length} supplier record${attention.length === 1 ? '' : 's'} need due-diligence review.` : `${suppliers.length} supplier${suppliers.length === 1 ? '' : 's'} visible with no obvious status/date warning.`,
          attention.slice(0, 8).map((s) => `${s.name || 'Supplier'} — ${s.status || 'certificate review'}${s.certificateExpiry || s.certExpiry ? ` (${s.certificateExpiry || s.certExpiry})` : ''}.`),
          [attention.length ? 'Review approval status/certificates before the next order.' : 'Keep supplier specifications and allergen declarations current.'],
          { suppliers: suppliers.length, attention: attention.length });
      },
    },
    {
      id: 'training', name: 'Training Agent', domain: 'People', risk: 'medium',
      description: 'Training expiry, qualification gaps and competency reminders.',
      keywords: ['training','certificate','staff','team','competency','qualification','course','renewal'],
      run(agent) {
        const team = scoped('team'); const training = scoped('training');
        const expiredRows = training.filter((t) => expired(t.expiry || t.expires || t.validUntil));
        const due = training.filter((t) => withinDays(t.expiry || t.expires || t.validUntil, 30));
        return result(agent, expiredRows.length ? 'warning' : due.length ? 'info' : 'good',
          `${expiredRows.length} expired and ${due.length} soon-due training/certificate record${expiredRows.length + due.length === 1 ? '' : 's'}.`,
          expiredRows.slice(0, 5).map((t) => `${t.name || t.course || t.title || 'Training'} expired ${t.expiry || t.expires || t.validUntil}.`)
            .concat(due.slice(0, 5).map((t) => `${t.name || t.course || t.title || 'Training'} due ${t.expiry || t.expires || t.validUntil}.`)),
          [expiredRows.length ? 'Do not assign restricted duties where mandatory competency has expired.' : 'Plan renewals before expiry.', 'Use SOP completion evidence alongside formal training records.'],
          { team: team.length, trainingRecords: training.length, expired: expiredRows.length, dueSoon: due.length });
      },
    },
    {
      id: 'operations', name: 'Kitchen Operations Agent', domain: 'Operations', risk: 'medium',
      description: 'Cross-functional shift readiness, priorities and operational blockers.',
      keywords: ['today','shift','operations','kitchen','priority','ready','service','overview','manager','what needs attention'],
      run(agent) {
        const snap = workspaceSnapshot();
        const problems = [];
        if (snap.counts.tempBreaches) problems.push(`${snap.counts.tempBreaches} temperature breach(es)`);
        if (snap.counts.openAlerts) problems.push(`${snap.counts.openAlerts} open alert(s)`);
        if (snap.counts.incompleteChecklists) problems.push(`${snap.counts.incompleteChecklists} incomplete checklist(s)`);
        if (snap.counts.incidents) problems.push(`${snap.counts.incidents} open incident(s)`);
        return result(agent, problems.length ? 'warning' : 'good',
          problems.length ? `Operational attention: ${problems.join(', ')}.` : 'No major operational blocker was detected by the local workspace scan.',
          [`Current site: ${snap.site || 'all/unspecified'}.`, `Recipes ${snap.counts.recipes}; menus ${snap.counts.menus}; stock batches ${snap.counts.batches}; team ${snap.counts.team}.`],
          problems.length ? ['Clear safety/compliance blockers first, then service and commercial tasks.', 'Assign each action to one named person and record completion.'] : ['Proceed with service plan and keep live checks current.'],
          snap.counts);
      },
    },
    {
      id: 'compliance', name: 'Compliance Audit Agent', domain: 'Audit', risk: 'high',
      description: 'Cross-checks temperatures, checklists, incidents, training and records for audit readiness.',
      keywords: ['audit','compliance','eho','inspection','due diligence','legal','report','evidence'],
      run(agent) {
        const snap = workspaceSnapshot();
        const scoreDeductions = Math.min(100, snap.counts.tempBreaches * 20 + snap.counts.openAlerts * 5 + snap.counts.incompleteChecklists * 8 + snap.counts.incidents * 8);
        const score = Math.max(0, 100 - scoreDeductions);
        const findings = [];
        if (snap.counts.tempBreaches) findings.push(`${snap.counts.tempBreaches} live temperature breach(es).`);
        if (snap.counts.incompleteChecklists) findings.push(`${snap.counts.incompleteChecklists} incomplete checklist(s).`);
        if (snap.counts.incidents) findings.push(`${snap.counts.incidents} open incident(s).`);
        return result(agent, score < 70 ? 'critical' : score < 90 ? 'warning' : 'good',
          `Indicative local audit-readiness score: ${score}/100. This is an operational signal, not a legal certification.`,
          findings.length ? findings : ['No major gap detected in the basic workspace scan.'],
          ['Verify records, signatures, calibration evidence and corrective actions before an external audit.', 'Treat AI findings as a review aid; the responsible manager retains sign-off.'],
          { indicativeScore: score, ...snap.counts });
      },
    },
  ];

  const AGENT_MAP = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

  function plan(message) {
    const q = lower(message);
    const scored = AGENTS.map((a) => {
      let score = 0;
      a.keywords.forEach((k) => { if (q.includes(k)) score += k.includes(' ') ? 4 : 2; });
      if (a.id === 'operations') score += 0.2;
      if (a.id === 'compliance' && /audit|inspection|eho|compliance/.test(q)) score += 3;
      return { agent: a, score };
    }).sort((a,b) => b.score - a.score);
    let chosen = scored.filter((x) => x.score > 0).slice(0, MAX_SPECIALISTS).map((x) => x.agent);
    if (!chosen.length) chosen = ['operations','food-safety','haccp','stock'].map((id) => AGENT_MAP[id]);
    if (!chosen.some((a) => a.id === 'food-safety') && /service|guest|meal|production|today|shift/.test(q) && chosen.length < MAX_SPECIALISTS) chosen.push(AGENT_MAP['food-safety']);
    return chosen.slice(0, MAX_SPECIALISTS);
  }

  function run(message) {
    const selected = plan(message);
    const outputs = selected.map((a) => {
      try { return a.run(a, message); }
      catch (e) { return result(a, 'warning', 'Agent could not complete its local scan.', [e.message || String(e)], ['Review this area manually.']); }
    });
    const critical = outputs.filter((r) => r.severity === 'critical');
    const warning = outputs.filter((r) => r.severity === 'warning');
    const priority = critical.length ? 'critical' : warning.length ? 'warning' : 'normal';
    const actions = [];
    outputs.forEach((o) => o.actions.forEach((a) => { if (!actions.includes(a)) actions.push(a); }));
    return {
      runId: 'brigade_' + Date.now().toString(36),
      message,
      selectedAgents: selected.map((a) => ({ id:a.id, name:a.name, domain:a.domain, risk:a.risk })),
      outputs,
      priority,
      executiveSummary: critical.length
        ? `${critical.length} critical specialist finding${critical.length === 1 ? '' : 's'} require manager attention before lower-priority work.`
        : warning.length
          ? `${warning.length} specialist area${warning.length === 1 ? '' : 's'} need follow-up; no critical finding was generated by this local scan.`
          : 'The selected specialists found no critical or warning-level issue in the available Kiteline data.',
      nextActions: actions.slice(0, 7),
      snapshot: workspaceSnapshot(),
      readOnly: true,
      note: 'AI Brigade v1 is read-only and offline-capable. It analyses Kiteline workspace data and never changes records automatically.',
      completedAt: nowIso(),
    };
  }

  function badgeClass(severity) {
    if (severity === 'critical') return 'bg-red-100 text-red-700';
    if (severity === 'warning') return 'bg-amber-100 text-amber-800';
    if (severity === 'good') return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700';
  }

  function renderOutput(runData) {
    return `<div class="space-y-5">
      <div class="card p-5 border-l-4 ${runData.priority === 'critical' ? 'border-red-500' : runData.priority === 'warning' ? 'border-amber-500' : 'border-emerald-500'}">
        <div class="flex items-start justify-between gap-4">
          <div><p class="text-xs uppercase tracking-wide font-bold text-ink-400">Manager Agent</p><h3 class="text-lg font-bold text-ink-900 mt-1">${esc(runData.executiveSummary)}</h3></div>
          <span class="badge ${badgeClass(runData.priority === 'normal' ? 'good' : runData.priority)}">${esc(runData.priority)}</span>
        </div>
        <div class="mt-4"><p class="font-semibold text-sm mb-2">Next actions</p><ol class="list-decimal pl-5 text-sm text-ink-700 space-y-1">${runData.nextActions.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div>
      </div>
      <div class="grid xl:grid-cols-2 gap-4">
        ${runData.outputs.map((o) => `<article class="card p-5">
          <div class="flex items-start justify-between gap-3"><div><p class="text-xs font-bold uppercase tracking-wide text-brand-700">${esc(o.domain || '')}</p><h3 class="font-bold text-ink-900">${esc(o.name)}</h3></div><span class="badge ${badgeClass(o.severity)}">${esc(o.severity)}</span></div>
          <p class="mt-3 text-sm font-semibold text-ink-800">${esc(o.summary)}</p>
          ${o.findings.length ? `<div class="mt-3"><p class="text-xs font-bold uppercase text-ink-400">Findings</p><ul class="list-disc pl-5 mt-1 text-sm text-ink-600 space-y-1">${o.findings.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
          ${o.actions.length ? `<div class="mt-3"><p class="text-xs font-bold uppercase text-ink-400">Recommended</p><ul class="list-disc pl-5 mt-1 text-sm text-ink-600 space-y-1">${o.actions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
        </article>`).join('')}
      </div>
      <p class="text-xs text-ink-400">${esc(runData.note)} Run ${esc(runData.runId)} · ${esc(runData.completedAt)}</p>
    </div>`;
  }

  function agentCards() {
    return AGENTS.map((a) => `<div class="rounded-xl border border-ink-200 bg-white p-4">
      <div class="flex justify-between gap-2"><div><p class="font-bold text-sm">${esc(a.name)}</p><p class="text-xs text-ink-500">${esc(a.domain)}</p></div><span class="text-[10px] px-2 py-1 rounded-full h-fit ${a.risk === 'high' ? 'bg-red-50 text-red-700' : a.risk === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}">${esc(a.risk)} risk</span></div>
      <p class="text-xs text-ink-600 mt-2 leading-relaxed">${esc(a.description)}</p>
    </div>`).join('');
  }

  function view() {
    return {
      title: 'AI Brigade',
      html: `<div class="space-y-6">
        <section class="card p-6 bg-gradient-to-br from-brand-950 to-ink-950 text-white overflow-hidden relative">
          <div class="max-w-3xl relative z-10">
            <p class="text-brand-200 text-xs uppercase tracking-[0.18em] font-bold">Kiteline Multi-Agent Operations</p>
            <h2 class="text-2xl md:text-3xl font-extrabold mt-2">One manager. Specialist kitchen agents.</h2>
            <p class="text-white/70 mt-3 text-sm md:text-base">Ask about service, HACCP, allergens, stock, purchasing, recipes, costing, cleaning, maintenance, waste, suppliers or training. The Manager Agent selects up to ${MAX_SPECIALISTS} specialists and combines their findings.</p>
            <div class="mt-4 flex flex-wrap gap-2 text-xs"><span class="px-3 py-1 rounded-full bg-white/10">Read-only v1</span><span class="px-3 py-1 rounded-full bg-white/10">Offline-capable</span><span class="px-3 py-1 rounded-full bg-white/10">Uses live Kiteline workspace</span></div>
          </div>
        </section>

        <section class="card p-5">
          <label for="brigadePrompt" class="block text-sm font-bold text-ink-800">What do you want the kitchen agents to work on?</label>
          <textarea id="brigadePrompt" class="input mt-2 min-h-[110px]" placeholder="Example: Check whether we are ready for dinner service and tell me the top safety, stock and production priorities."></textarea>
          <div class="flex flex-wrap gap-2 mt-3">
            <button class="btn btn-primary" id="runBrigade">Run AI Brigade</button>
            <button class="btn btn-secondary brigadeQuick" data-q="Check today's kitchen readiness and give me the top priorities before service.">Shift readiness</button>
            <button class="btn btn-secondary brigadeQuick" data-q="Audit food safety, HACCP and cleaning risks for this site.">Safety audit</button>
            <button class="btn btn-secondary brigadeQuick" data-q="Check stock, suppliers and what needs ordering next.">Stock & ordering</button>
            <button class="btn btn-secondary brigadeQuick" data-q="Check recipes, menus, allergens and costing gaps.">Menu & recipe</button>
          </div>
          <div id="brigadePlan" class="mt-4 hidden"></div>
        </section>

        <section id="brigadeResults"></section>

        <section>
          <div class="flex items-end justify-between gap-4 mb-3"><div><p class="text-xs font-bold uppercase tracking-wide text-ink-400">Specialist registry</p><h3 class="font-bold text-lg">${AGENTS.length} agents available</h3></div><p class="text-xs text-ink-400">Max ${MAX_SPECIALISTS} per run</p></div>
          <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">${agentCards()}</div>
        </section>
      </div>`,
      mount() {
        const prompt = document.getElementById('brigadePrompt');
        const results = document.getElementById('brigadeResults');
        const planBox = document.getElementById('brigadePlan');
        const runBtn = document.getElementById('runBrigade');

        function showPlan(q) {
          const chosen = plan(q);
          planBox.classList.remove('hidden');
          planBox.innerHTML = `<div class="rounded-xl bg-ink-50 border border-ink-200 p-3"><p class="text-xs uppercase font-bold text-ink-400">Manager selected</p><div class="flex flex-wrap gap-2 mt-2">${chosen.map((a) => `<span class="badge badge-blue">${esc(a.name)}</span>`).join('')}</div></div>`;
        }
        function execute() {
          const q = String(prompt.value || '').trim();
          if (!q) { toast('Tell the AI Brigade what you need', 'warn'); prompt.focus(); return; }
          showPlan(q);
          runBtn.disabled = true; runBtn.textContent = 'Agents working…';
          results.innerHTML = `<div class="card p-6 text-sm text-ink-500">Manager Agent is coordinating specialists against the current Kiteline workspace…</div>`;
          setTimeout(() => {
            const data = run(q);
            results.innerHTML = renderOutput(data);
            runBtn.disabled = false; runBtn.textContent = 'Run AI Brigade';
          }, 180);
        }
        runBtn.onclick = execute;
        document.querySelectorAll('.brigadeQuick').forEach((b) => { b.onclick = () => { prompt.value = b.dataset.q || ''; execute(); }; });
        prompt.addEventListener('input', () => { if (prompt.value.trim().length > 3) showPlan(prompt.value); });
      },
    };
  }

  window.KitelineAgents = { registry: AGENTS, plan, run, maxSpecialists: MAX_SPECIALISTS, workspaceSnapshot };
  if (window.Views) window.Views['ai-brigade'] = view;
})();
