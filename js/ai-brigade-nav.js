/* Kiteline AI Brigade navigation launcher */
(function () {
  'use strict';
  function currentAccess() {
    try {
      var db = window.Store && window.Store.db || {};
      var email = window.Api && window.Api.email ? (window.Api.email() || '') : '';
      var member = (db.team || []).find(function (m) { return String(m.email || '').toLowerCase() === String(email).toLowerCase(); });
      if (member && /Admin|Manager/i.test(member.access || '')) return member.access;
      var title = String(member && member.role || '').toLowerCase();
      if (/head chef|owner|director|admin|proprietor|general manager|\bgm\b/.test(title)) return 'Admin';
      if (/manager|supervisor|lead|head/.test(title)) return 'Manager';
      return member ? 'Staff' : 'Admin';
    } catch (_) { return 'Staff'; }
  }
  function inject() {
    if (!/^(Admin|Manager)$/.test(currentAccess())) return;
    if (document.querySelector('[data-ai-brigade-nav]')) return;
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    var links = sidebar.querySelectorAll('a[href^="#"]');
    if (!links.length) return;
    var a = document.createElement('a');
    a.href = '#ai-brigade';
    a.setAttribute('data-ai-brigade-nav', '1');
    a.className = 'nav-item';
    a.innerHTML = '<span style="display:inline-flex;width:20px;height:20px;align-items:center;justify-content:center;font-weight:800">AI</span><span>AI Brigade</span><span style="margin-left:auto;font-size:10px;padding:2px 6px;border-radius:999px;background:#ccfbf1;color:#0f766e;font-weight:700">BETA</span>';
    var first = links[0];
    first.parentNode.insertBefore(a, first.nextSibling);
  }
  var obs = new MutationObserver(inject);
  obs.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('hashchange', inject);
  document.addEventListener('DOMContentLoaded', inject);
  setTimeout(inject, 300);
})();
