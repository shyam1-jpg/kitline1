/* ============================================================
   Kiteline AI Brigade — run history + human approval queue
   Uses the existing Store.persist() path, so data syncs through
   Kiteline's normal workspace state API when the backend is online.
   Approval in this phase records a manager decision only; it never
   executes or mutates operational kitchen records.
   ============================================================ */
(function () {
  'use strict';

  var S = window.Store;
  var A = window.KitelineAgents;
  if (!S || !A || A.persistenceInstalled) return;

  var UI = window.UI || {};
  var esc = UI.escapeHtml || function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  };
  var toast = UI.toast || function () {};

  function now() { return new Date().toISOString(); }
  function uid(prefix) {
    if (S.uid) return S.uid(prefix);
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function actor() {
    try {
      if (window.App && window.App.currentUser) {
        var u = window.App.currentUser();
        return { email: u.email || '', name: u.name || '', role: u.role || '' };
      }
    } catch (_) {}
    return { email: window.Api && window.Api.email ? (window.Api.email() || '') : '', name: '', role: '' };
  }
  function ensure() {
    S.db.agentRuns = Array.isArray(S.db.agentRuns) ? S.db.agentRuns : [];
    S.db.agentApprovals = Array.isArray(S.db.agentApprovals) ? S.db.agentApprovals : [];
  }
  function persist() {
    ensure();
    if (S.persist) S.persist();
  }
  function siteId() {
    try {
      var site = S.site && S.site();
      return site && (site.id || site.siteId) || S.db.currentSite || null;
    } catch (_) { return S.db.currentSite || null; }
  }

  function riskForAction(text, run) {
    var q = String(text || '').toLowerCase();
    if (/allerg|haccp|temperature|probe|unsafe|quarantine|critical|food safety|calibration/.test(q)) return 'high';
    if (/purchase|order|supplier|maintenance|repair|training|cost|waste|assign/.test(q)) return 'medium';
    if (run && run.priority === 'critical') return 'high';
    return 'low';
  }

  function createApprovalsForRun(run) {
    ensure();
    var created = [];
    (run.nextActions || []).forEach(function (text, index) {
      var exists = S.db.agentApprovals.some(function (p) {
        return p.runId === run.runId && p.text === text;
      });
      if (exists) return;
      var p = {
        id: uid('aap'),
        runId: run.runId,
        site: run.snapshot && run.snapshot.site || siteId(),
        text: text,
        risk: riskForAction(text, run),
        status: 'pending',
        proposedAt: now(),
        proposedBy: 'AI Brigade Manager',
        sequence: index + 1,
        decisionAt: null,
        decidedBy: null,
        note: 'Decision record only. Execution is disabled in this phase.',
      };
      S.db.agentApprovals.unshift(p);
      created.push(p);
    });
    S.db.agentApprovals = S.db.agentApprovals.slice(0, 150);
    return created;
  }

  function saveRun(run) {
    ensure();
    var u = actor();
    var stored = {
      runId: run.runId,
      message: run.message,
      priority: run.priority,
      executiveSummary: run.executiveSummary,
      selectedAgents: run.selectedAgents || [],
      outputs: run.outputs || [],
      nextActions: run.nextActions || [],
      snapshot: run.snapshot || null,
      site: run.snapshot && run.snapshot.site || siteId(),
      completedAt: run.completedAt || now(),
      requestedBy: u,
      engine: run.engine || 'local-rules-v1',
      readOnly: true,
    };
    S.db.agentRuns.unshift(stored);
    S.db.agentRuns = S.db.agentRuns.slice(0, 50);
    var approvals = createApprovalsForRun(run);
    persist();
    run.approvalsCreated = approvals.length;
    return stored;
  }

  function history(limit) {
    ensure();
    var sid = siteId();
    return S.db.agentRuns.filter(function (r) { return !sid || !r.site || r.site === sid; }).slice(0, limit || 10);
  }
  function approvals(status, limit) {
    ensure();
    var sid = siteId();
    return S.db.agentApprovals.filter(function (p) {
      return (!sid || !p.site || p.site === sid) && (!status || p.status === status);
    }).slice(0, limit || 50);
  }
  function decide(id, decision) {
    ensure();
    if (decision !== 'approved' && decision !== 'rejected') throw new Error('Invalid approval decision');
    var row = S.db.agentApprovals.find(function (p) { return p.id === id; });
    if (!row) throw new Error('Approval item not found');
    if (row.status !== 'pending') throw new Error('This proposal has already been decided');
    row.status = decision;
    row.decisionAt = now();
    row.decidedBy = actor();
    row.executionStatus = 'disabled';
    persist();
    return row;
  }

  var originalRun = A.run;
  A.run = function (message) {
    var run = originalRun(message);
    saveRun(run);
    return run;
  };
  A.history = history;
  A.approvals = approvals;
  A.decideApproval = decide;
  A.saveRun = saveRun;
  A.persistenceInstalled = true;

  function riskBadge(risk) {
    if (risk === 'high') return 'bg-red-100 text-red-700';
    if (risk === 'medium') return 'bg-amber-100 text-amber-800';
    return 'bg-slate-100 text-slate-700';
  }
  function statusBadge(status) {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-slate-200 text-slate-700';
    return 'bg-blue-100 text-blue-700';
  }
  function renderHistory() {
    var rows = history(8);
    if (!rows.length) return '<p class="text-sm text-ink-500">No AI Brigade runs saved yet.</p>';
    return '<div class="space-y-2">' + rows.map(function (r) {
      return '<div class="rounded-xl border border-ink-200 p-3 bg-white">' +
        '<div class="flex items-start justify-between gap-3"><div><p class="font-semibold text-sm">' + esc(r.message) + '</p><p class="text-xs text-ink-400 mt-1">' + esc(r.completedAt || '') + ' · ' + esc((r.selectedAgents || []).map(function (a) { return a.name; }).join(', ')) + '</p></div>' +
        '<span class="text-[10px] px-2 py-1 rounded-full ' + (r.priority === 'critical' ? 'bg-red-100 text-red-700' : r.priority === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700') + '">' + esc(r.priority || 'normal') + '</span></div>' +
        '<p class="text-xs text-ink-600 mt-2">' + esc(r.executiveSummary || '') + '</p></div>';
    }).join('') + '</div>';
  }
  function renderApprovals() {
    var rows = approvals(null, 20);
    if (!rows.length) return '<p class="text-sm text-ink-500">No proposed actions yet. Run the Brigade to create a manager review queue.</p>';
    return '<div class="space-y-2">' + rows.map(function (p) {
      return '<div class="rounded-xl border border-ink-200 p-3 bg-white">' +
        '<div class="flex items-start justify-between gap-3"><div><p class="text-sm font-semibold">' + esc(p.text) + '</p><p class="text-xs text-ink-400 mt-1">Run ' + esc(p.runId) + ' · ' + esc(p.proposedAt) + '</p></div><div class="flex gap-1"><span class="text-[10px] px-2 py-1 rounded-full ' + riskBadge(p.risk) + '">' + esc(p.risk) + '</span><span class="text-[10px] px-2 py-1 rounded-full ' + statusBadge(p.status) + '">' + esc(p.status) + '</span></div></div>' +
        (p.status === 'pending' ? '<div class="flex gap-2 mt-3"><button class="btn btn-primary btn-sm" data-brigade-approve="' + esc(p.id) + '">Approve</button><button class="btn btn-secondary btn-sm" data-brigade-reject="' + esc(p.id) + '">Reject</button></div>' : '') +
        '<p class="text-[11px] text-ink-400 mt-2">Approval records the manager decision only. No operational action is executed automatically.</p></div>';
    }).join('') + '</div>';
  }

  function enhanceView() {
    if (!window.Views || !window.Views['ai-brigade'] || window.Views['ai-brigade']._persistenceWrapped) return;
    var baseFactory = window.Views['ai-brigade'];
    var wrapped = function () {
      var base = baseFactory();
      var originalMount = base.mount;
      base.html += '<section class="grid xl:grid-cols-2 gap-5 mt-6">' +
        '<div class="card p-5"><div class="flex items-center justify-between mb-3"><div><p class="text-xs font-bold uppercase tracking-wide text-ink-400">Audit trail</p><h3 class="font-bold text-lg">Recent agent runs</h3></div><span class="badge badge-gray">Saved</span></div><div id="brigadeHistory">' + renderHistory() + '</div></div>' +
        '<div class="card p-5"><div class="flex items-center justify-between mb-3"><div><p class="text-xs font-bold uppercase tracking-wide text-ink-400">Human control</p><h3 class="font-bold text-lg">Approval queue</h3></div><span class="badge badge-blue">No auto-execute</span></div><div id="brigadeApprovals">' + renderApprovals() + '</div></div>' +
        '</section>';
      base.mount = function () {
        if (originalMount) originalMount();
        function refreshPanels() {
          var h = document.getElementById('brigadeHistory');
          var q = document.getElementById('brigadeApprovals');
          if (h) h.innerHTML = renderHistory();
          if (q) q.innerHTML = renderApprovals();
          bindDecisions();
        }
        function bindDecisions() {
          document.querySelectorAll('[data-brigade-approve]').forEach(function (b) {
            b.onclick = function () {
              try { decide(b.getAttribute('data-brigade-approve'), 'approved'); toast('Action approved for future execution'); refreshPanels(); }
              catch (e) { toast(e.message || 'Could not approve', 'warn'); }
            };
          });
          document.querySelectorAll('[data-brigade-reject]').forEach(function (b) {
            b.onclick = function () {
              try { decide(b.getAttribute('data-brigade-reject'), 'rejected'); toast('Action rejected'); refreshPanels(); }
              catch (e) { toast(e.message || 'Could not reject', 'warn'); }
            };
          });
        }
        var runButton = document.getElementById('runBrigade');
        if (runButton) runButton.addEventListener('click', function () { setTimeout(refreshPanels, 450); });
        document.querySelectorAll('.brigadeQuick').forEach(function (b) { b.addEventListener('click', function () { setTimeout(refreshPanels, 450); }); });
        bindDecisions();
      };
      return base;
    };
    wrapped._persistenceWrapped = true;
    window.Views['ai-brigade'] = wrapped;
    if (window.App && window.App.route === 'ai-brigade' && window.App.render) setTimeout(function () { window.App.render(); }, 0);
  }

  enhanceView();
})();
