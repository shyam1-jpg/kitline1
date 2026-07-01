/* ============================================================
   Kitchen OS — UI helpers: icons, toasts, modals, formatting
   ============================================================ */
(function () {
  // --- Inline SVG icon set (stroke-based) ---
  const I = {
    dashboard:'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    temp:'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z',
    alert:'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
    check:'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    records:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    sites:'M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01',
    reports:'M3 3v18h18M18 17V9M13 17V5M8 17v-3',
    team:'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
    allerq:'M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
    labels:'M20.59 13.41 13.42 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
    waste:'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
    settings:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
    logout:'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    bell:'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
    plus:'M12 5v14M5 12h14',
    download:'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    search:'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
    chevron:'M9 18l6-6-6-6',
    battery:'M3 7h16a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM23 11v2',
    signal:'M2 20h.01M6 16v4M10 12v8M14 8v12M18 4v16',
    print:'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
    qr:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14h1M14 20h1M20 20h1M17 17h1',
    leaf:'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10zM2 21c0-3 1.85-5.36 5.08-6',
    clock:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    recipe:'M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20M9 7h6M9 11h4',
    image:'M3 3h18v18H3z M3 16l5-5 4 4 4-4 5 5 M9 8.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z',
    help:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3 M12 17h.01',
    truck:'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 18.5a2 2 0 1 0 0 .01M18.5 18.5a2 2 0 1 0 0 .01',
    cap:'M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 3 3 6 3s6-2 6-3v-5',
    shield:'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM12 8v4M12 16h.01',
    wrench:'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8 6.2 21l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.7 2.7-2.3-2.3z',
    mail:'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
    box:'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.3 7 12 12l8.7-5M12 22V12',
    layers:'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    snow:'M12 2v20M4.2 7l15.6 9M19.8 7 4.2 16M2 12h20M5 5l2 .5M19 19l-2-.5',
    droplet:'M12 2.7 6 9.5a6 6 0 1 0 12 0z',
    grid:'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    menu:'M4 6h16M4 12h16M4 18h16',
    coin:'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7v10M9.5 9.2a2.2 2.2 0 0 1 2.5-1.2c1.2 0 2 .7 2 1.6 0 2-4.5 1.2-4.5 3.4 0 1 .9 1.7 2.2 1.7a2.3 2.3 0 0 0 2.3-1.2',
    rocket:'M5 13c-1.5 1.5-2 5-2 5s3.5-.5 5-2M12 15l-3-3a14 14 0 0 1 3-6c2.5-2.6 5-3 6-3 0 1-.4 3.5-3 6a14 14 0 0 1-6 3z M9 12H5l3-4M12 15v4l4-3',
    globe:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  };

  function icon(name, cls) {
    const d = I[name] || I.dashboard;
    return `<svg class="${cls||'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d.split('M').filter(Boolean).map(p=>`<path d="M${p}"/>`).join('')}</svg>`;
  }

  // --- Toasts ---
  function toast(msg, kind) {
    const layer = document.getElementById('toast-layer');
    const el = document.createElement('div');
    const color = kind==='error' ? '#dc2626' : kind==='warn' ? '#d97706' : '#10b981';
    el.className = 'toast';
    el.innerHTML = `<span class="pulse-dot" style="background:${color}"></span><span>${msg}</span>`;
    layer.appendChild(el);
    setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateX(20px)'; el.style.transition='all .3s'; }, 2600);
    setTimeout(()=> el.remove(), 3000);
  }

  // --- Modal ---
  function modal(title, bodyHtml, opts) {
    opts = opts || {};
    const layer = document.getElementById('modal-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = `
      <div class="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" data-close></div>
      <div class="relative h-full w-full flex items-center justify-center p-4">
        <div class="modal-card card w-full ${opts.wide?'max-w-2xl':'max-w-md'} max-h-[90vh] overflow-auto">
          <div class="flex items-center justify-between px-5 py-4 border-b border-ink-100">
            <h3 class="font-bold text-lg">${title}</h3>
            <button class="text-ink-400 hover:text-ink-700 text-2xl leading-none" data-close>&times;</button>
          </div>
          <div class="p-5">${bodyHtml}</div>
        </div>
      </div>`;
    layer.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    return layer;
  }
  function closeModal() {
    const layer = document.getElementById('modal-layer');
    layer.classList.add('hidden');
    layer.classList.remove('modal-layer--recipe');
    layer.innerHTML = '';
  }

  /** Full-width scrollable preview for recipe cards (matches print layout on screen). */
  function recipePreviewModal(title, bodyHtml) {
    const layer = document.getElementById('modal-layer');
    layer.classList.remove('hidden');
    layer.classList.add('modal-layer--recipe');
    layer.innerHTML = `
      <div class="recipe-modal-backdrop" data-close></div>
      <div class="recipe-modal-scroll">
        <div class="recipe-modal-inner">
          <div class="recipe-modal-toolbar no-print">
            <div class="recipe-modal-toolbar__title">${escapeHtml(title)}</div>
            <button type="button" class="recipe-modal-close" data-close aria-label="Close">&times;</button>
          </div>
          ${bodyHtml}
        </div>
      </div>`;
    layer.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    return layer;
  }

  // --- Formatters ---
  const fmt = {
    money(n, cur) {
      const sym = { GBP:'£', USD:'$', EUR:'€' }[cur||'GBP'] || '£';
      return sym + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },
    ago(iso) {
      const s = (Date.now() - new Date(iso).getTime())/1000;
      if (s < 60) return 'just now';
      if (s < 3600) return Math.floor(s/60) + 'm ago';
      if (s < 86400) return Math.floor(s/3600) + 'h ago';
      return Math.floor(s/86400) + 'd ago';
    },
    date(iso) { return new Date(iso).toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' }); },
    datetime(iso) { return new Date(iso).toLocaleString(undefined, { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); },
    temp(t) { return (t>0?'':'') + t.toFixed(1) + '°C'; },
  };

  function escapeHtml(s) {
    return String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(r => r.map(c => {
      const v = String(c==null?'':c);
      return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  /** Keep print CSS active until the browser finishes printing (not a fixed 500ms timeout). */
  function printWithBodyClass(modeClass) {
    const other = modeClass === 'print-recipe' ? 'print-label' : 'print-recipe';
    document.body.classList.remove(other);
    document.body.classList.add(modeClass);
    const layer = document.getElementById('modal-layer');
    if (layer) layer.classList.remove('hidden');
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove(modeClass);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(cleanup, 120000);
    window.print();
  }

  /** Open a clean print window (avoids blank prints from modal/fixed overlays). */
  function openPrintDocument(title, bodyHtml, opts) {
    opts = opts || {};
    const w = window.open('', '_blank');
    if (!w) {
      toast('Allow pop-ups to print', 'warn');
      return null;
    }
    const origin = location.origin || '';
    const build = (window.App && window.App.config && window.App.config.build) || 'print';
    const safeBuild = String(build).replace(/[^a-zA-Z0-9._-]/g, '');
    const cssHref = origin + '/css/styles.css?v=' + safeBuild;
    const pageSize = opts.pageSize || 'A4 portrait';
    const margin = opts.margin || '10mm 12mm';
    const padding = opts.padding != null ? opts.padding : '12px';
    const extraStyle = opts.extraStyle || '';
    const autoPrint = opts.autoPrint !== false;
    w.document.open();
    w.document.write('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>' + escapeHtml(title) +
      '</title><link rel="stylesheet" href="' + cssHref + '"><style>@page{size:' + pageSize + ';margin:' + margin + ';}' +
      'body{margin:0;padding:' + padding + ';background:#fff;}.no-print{display:none!important;}' + extraStyle +
      '</style></head><body>' + bodyHtml +
      (autoPrint ? '<script>window.addEventListener("load",function(){setTimeout(function(){window.print();},600);});<\/script>' : '') +
      '</body></html>');
    w.document.close();
    return w;
  }

  window.UI = { icon, toast, modal, recipePreviewModal, closeModal, fmt, escapeHtml, downloadCsv, printWithBodyClass, openPrintDocument };
})();
