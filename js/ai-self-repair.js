/* ============================================================
   Kiteline Self-Repair Agent
   - diagnoses local workspace/runtime integrity problems
   - only auto-fixes a narrow allowlist of reversible structure issues
   - never changes food-safety facts, allergens, HACCP records, orders,
     permissions, recipes, temperatures or compliance sign-off
   - every repair requires manager/admin confirmation and is audited
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var A = window.KitelineAgents;
  if (!S || !A || !Array.isArray(A.registry) || window.KitelineSelfRepair) return;

  var REQUIRED_ARRAYS = [
    'sites', 'team', 'recipes', 'menus', 'sensors', 'records', 'alerts',
    'checklists', 'batches', 'suppliers', 'incidents', 'assets', 'waste',
    'training', 'agentRuns', 'agentApprovals'
  ];

  function now() { return new Date().toISOString(); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function email() {
    try { return window.Api && window.Api.email ? (window.Api.email() || '') : ''; } catch (_) { return ''; }
  }
  function access() {
    try {
      var em = email().toLowerCase();
      var member = arr(S.db.team).find(function (m) { return String(m.email || '').toLowerCase() === em; });
      if (member && /^(Admin|Manager)$/i.test(String(member.access || ''))) return member.access;
      var role = String(member && member.role || '').toLowerCase();
      if (/owner|director|admin|head chef|general manager|\bgm\b/.test(role)) return 'Admin';
      if (/manager|supervisor|lead|head/.test(role)) return 'Manager';
      return member ? 'Staff' : 'Admin';
    } catch (_) { return 'Staff'; }
  }
  function duplicates(rows) {
    var seen = Object.create(null);
    var dup = [];
    arr(rows).forEach(function (r) {
      if (!r || !r.id) return;
      var id = String(r.id);
      if (seen[id]) dup.push(id); else seen[id] = true;
    });
    return dup;
  }

  function diagnose() {
    var db = S.db || {};
    var findings = [];
    var safeFixes = [];
    var manual = [];

    REQUIRED_ARRAYS.forEach(function (key) {
      if (db[key] == null) {
        findings.push({ severity: 'warning', code: 'missing_container', area: key, message: key + ' data container is missing.' });
        safeFixes.push({ type: 'create_missing_array', key: key });
      } else if (!Array.isArray(db[key])) {
        findings.push({ severity: 'critical', code: 'invalid_container_type', area: key, message: key + ' exists but is not an array. It will not be overwritten automatically.' });
        manual.push('Review and recover the ' + key + ' data before changing its structure.');
      }
    });

    var sites = arr(db.sites);
    if (sites.length) {
      var validCurrent = sites.some(function (s) { return s && s.id === db.currentSite; });
      if (!validCurrent) {
        findings.push({ severity: 'warning', code: 'invalid_current_site', area: 'sites', message: 'The current site points to a missing/invalid site.' });
        safeFixes.push({ type: 'set_current_site', siteId: sites[0].id });
      }
    } else {
      findings.push({ severity: 'warning', code: 'no_sites', area: 'sites', message: 'No kitchen/site is configured in this workspace.' });
      manual.push('Create or restore a site before production data is entered.');
    }

    REQUIRED_ARRAYS.forEach(function (key) {
      var d = duplicates(db[key]);
      if (d.length) {
        findings.push({ severity: 'warning', code: 'duplicate_ids', area: key, message: key + ' contains ' + d.length + ' duplicate ID(s).' });
        manual.push('Review duplicate ' + key + ' IDs. Self-Repair will not delete records automatically.');
      }
    });

    arr(db.sensors).forEach(function (s) {
      var min = Number(s && s.min), max = Number(s && s.max), temp = Number(s && s.temp);
      if (!s || !s.name || !Number.isFinite(min) || !Number.isFinite(max) || min >= max || !Number.isFinite(temp)) {
        findings.push({ severity: 'critical', code: 'sensor_config', area: 'sensors', message: 'A sensor has incomplete or invalid temperature configuration.' });
        manual.push('Verify sensor limits/readings manually; Self-Repair never invents food-safety temperatures.');
      }
    });

    var recipeIds = new Set(arr(db.recipes).map(function (r) { return r && r.id; }).filter(Boolean));
    arr(db.menus).forEach(function (m) {
      var items = arr(m && (m.dishes || m.items));
      items.forEach(function (item) {
        if (item && item.recipeId && !recipeIds.has(item.recipeId)) {
          findings.push({ severity: 'warning', code: 'orphan_recipe_link', area: 'menus', message: 'Menu "' + (m.name || m.title || 'Menu') + '" references a recipe that no longer exists.' });
        }
      });
    });

    arr(db.recipes).forEach(function (r) {
      if (!r || !String(r.name || '').trim()) findings.push({ severity: 'warning', code: 'recipe_name', area: 'recipes', message: 'A recipe record has no name.' });
      if (r && r.ingredients != null && !Array.isArray(r.ingredients)) findings.push({ severity: 'warning', code: 'recipe_ingredients_type', area: 'recipes', message: 'Recipe "' + (r.name || 'Unnamed') + '" has malformed ingredient data.' });
    });

    arr(db.agentRuns).forEach(function (r) {
      if (!r || !r.runId) findings.push({ severity: 'info', code: 'agent_history_shape', area: 'agents', message: 'An AI Brigade history row is missing its run ID.' });
    });
    arr(db.agentApprovals).forEach(function (p) {
      if (p && !/^(pending|approved|rejected)$/.test(String(p.status || ''))) findings.push({ severity: 'info', code: 'approval_status', area: 'agents', message: 'An AI approval record has an unknown status.' });
    });

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      findings.push({ severity: 'info', code: 'offline', area: 'connection', message: 'This device is offline. Kiteline can use local data, but server/ChatGPT checks cannot complete.' });
    }

    var critical = findings.filter(function (f) { return f.severity === 'critical'; }).length;
    var warnings = findings.filter(function (f) { return f.severity === 'warning'; }).length;
    return {
      generatedAt: now(),
      status: critical ? 'critical' : warnings ? 'warning' : 'healthy',
      critical: critical,
      warnings: warnings,
      findings: findings,
      safeFixes: safeFixes,
      manualActions: Array.from(new Set(manual)),
      online: typeof navigator === 'undefined' ? null : navigator.onLine,
    };
  }

  function appendAudit(before, applied) {
    if (S.db.selfRepairLog == null) S.db.selfRepairLog = [];
    if (!Array.isArray(S.db.selfRepairLog)) return;
    S.db.selfRepairLog.unshift({
      id: (S.uid ? S.uid('repair') : 'repair_' + Date.now().toString(36)),
      at: now(),
      by: email() || 'local-manager',
      access: access(),
      source: 'Kiteline Self-Repair Agent',
      applied: applied,
      beforeStatus: before.status,
      note: 'Only allowlisted reversible structure repairs were applied. Operational/safety data was not changed.',
    });
    S.db.selfRepairLog = S.db.selfRepairLog.slice(0, 100);
  }

  function repairSafe(confirm) {
    if (confirm !== true) throw new Error('Manager confirmation is required before Self-Repair can change workspace structure.');
    if (!/^(Admin|Manager)$/i.test(String(access()))) throw new Error('Manager or Admin access is required for Self-Repair.');

    var before = diagnose();
    var applied = [];
    before.safeFixes.forEach(function (fix) {
      if (fix.type === 'create_missing_array' && S.db[fix.key] == null) {
        S.db[fix.key] = [];
        applied.push('Created missing ' + fix.key + ' data container');
      }
      if (fix.type === 'set_current_site') {
        var valid = arr(S.db.sites).some(function (s) { return s && s.id === fix.siteId; });
        if (valid && !arr(S.db.sites).some(function (s) { return s && s.id === S.db.currentSite; })) {
          S.db.currentSite = fix.siteId;
          applied.push('Reset current site to the first valid workspace site');
        }
      }
    });
    appendAudit(before, applied);
    if (S.persist) S.persist();
    return { ok: true, applied: applied, before: before, after: diagnose() };
  }

  var agent = {
    id: 'self-repair',
    name: 'Kiteline Self-Repair Agent',
    domain: 'Platform Health',
    risk: 'high',
    description: 'Diagnoses broken workspace/runtime data and proposes or applies only allowlisted reversible repairs with manager approval.',
    keywords: ['repair','self repair','self-repair','broken','not working','error','bug','corrupt','corrupted','offline','sync','connection','chatgpt','mcp','oauth','platform','health check'],
    run: function (agentDef) {
      var d = diagnose();
      var findingText = d.findings.slice(0, 10).map(function (f) { return '[' + f.area + '] ' + f.message; });
      var actions = [];
      if (d.safeFixes.length) actions.push(d.safeFixes.length + ' reversible workspace structure repair(s) are available and require Manager/Admin approval.');
      d.manualActions.slice(0, 5).forEach(function (a) { actions.push(a); });
      actions.push('For server, OAuth or MCP faults, keep the system read-only and escalate the diagnostic rather than modifying authentication/security settings automatically.');
      return {
        agentId: agentDef.id,
        name: agentDef.name,
        domain: agentDef.domain,
        severity: d.status === 'healthy' ? 'good' : d.status,
        summary: d.status === 'healthy'
          ? 'Local Kiteline workspace integrity checks passed.'
          : d.critical + ' critical and ' + d.warnings + ' warning-level platform integrity finding(s) detected.',
        findings: findingText.length ? findingText : ['No structural workspace problem detected by the local self-repair scan.'],
        actions: actions,
        metrics: { critical: d.critical, warnings: d.warnings, safeRepairsAvailable: d.safeFixes.length, online: d.online },
        completedAt: now(),
      };
    }
  };

  if (!A.registry.some(function (x) { return x.id === agent.id; })) A.registry.push(agent);

  window.KitelineSelfRepair = {
    diagnose: diagnose,
    repairSafe: repairSafe,
    safetyBoundary: 'Never auto-repair allergens, HACCP, temperature facts, compliance sign-off, orders, permissions, recipes, auth secrets or destructive data issues.',
  };

  function injectControls() {
    if (location.hash !== '#ai-brigade' && location.hash !== '#/ai-brigade') return;
    var run = document.getElementById('runBrigade');
    if (!run || document.querySelector('[data-self-repair-control]')) return;
    var quick = document.createElement('button');
    quick.className = 'btn btn-secondary brigadeQuick';
    quick.setAttribute('data-self-repair-control', 'diagnose');
    quick.textContent = 'Self-repair diagnostic';
    quick.onclick = function () {
      var prompt = document.getElementById('brigadePrompt');
      if (prompt) prompt.value = 'Diagnose Kiteline platform health, broken data, sync, connection, ChatGPT MCP and repair risks.';
      run.click();
    };
    run.parentNode.appendChild(quick);

    var repair = document.createElement('button');
    repair.className = 'btn btn-secondary';
    repair.setAttribute('data-self-repair-control', 'repair');
    repair.textContent = 'Apply safe repair';
    repair.title = 'Only repairs missing data containers/current-site pointer; never safety, compliance, auth or business records.';
    repair.onclick = function () {
      var d = diagnose();
      if (!d.safeFixes.length) {
        (window.UI && window.UI.toast ? window.UI.toast : function () {})('No allowlisted safe repair is needed');
        return;
      }
      var ok = window.confirm('Self-Repair found ' + d.safeFixes.length + ' reversible structure repair(s). Apply them now? Food-safety, allergen, HACCP, purchasing, permissions and recipe data will not be changed.');
      if (!ok) return;
      try {
        var result = repairSafe(true);
        (window.UI && window.UI.toast ? window.UI.toast : function () {})('Self-Repair applied ' + result.applied.length + ' safe repair(s)');
        if (window.App && window.App.render) window.App.render();
      } catch (e) {
        (window.UI && window.UI.toast ? window.UI.toast : function () {})(e.message || 'Self-Repair failed', 'warn');
      }
    };
    run.parentNode.appendChild(repair);
  }

  var observer = new MutationObserver(injectControls);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', function () { setTimeout(injectControls, 0); });
  setTimeout(injectControls, 300);
})();