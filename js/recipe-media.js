/* Kiteline — recipe hero images, step-by-step media */
(function () {
  'use strict';

  const VIDEO_MAX_MB = 12;

  function escapeSvg(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function svgProImage(name, category) {
    const hue = ((name || 'R').charCodeAt(0) * 7) % 360;
    const title = (name || 'Recipe').length > 34 ? (name || 'Recipe').slice(0, 32) + '…' : (name || 'Recipe');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="400" viewBox="0 0 700 400">
<defs><linearGradient id="kg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="hsl(${hue},52%,40%)"/><stop offset="100%" stop-color="hsl(${(hue + 42) % 360},48%,24%)"/></linearGradient></defs>
<rect width="700" height="400" fill="url(#kg)"/>
<rect x="0" y="0" width="700" height="400" fill="url(#kg)"/>
<circle cx="580" cy="100" r="120" fill="rgba(255,255,255,.06)"/>
<circle cx="640" cy="60" r="40" fill="rgba(255,255,255,.08)"/>
<text x="28" y="48" fill="rgba(255,255,255,.75)" font-family="Arial,sans-serif" font-size="13" font-weight="700" letter-spacing="2">KITELINE</text>
<text x="28" y="300" fill="#ffffff" font-family="Georgia,serif" font-size="32" font-weight="700">${escapeSvg(title)}</text>
<text x="28" y="334" fill="#ccfbf1" font-family="Arial,sans-serif" font-size="15" font-weight="700">${escapeSvg(category || 'Recipe')}</text>
<text x="28" y="368" fill="rgba(255,255,255,.55)" font-family="Arial,sans-serif" font-size="12">Professional kitchen recipe card</text>
</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function heroSrc(r) {
    if (!r) return null;
    return r.image || r.proImage || null;
  }

  function generateProImage(name, category, cb) {
    cb(svgProImage(name, category));
  }

  function readVideoFile(file, cb, fail) {
    if (!file) return;
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
      if (fail) fail('Video too large — max ' + VIDEO_MAX_MB + ' MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => cb(e.target.result);
    reader.onerror = () => { if (fail) fail('Could not read video'); };
    reader.readAsDataURL(file);
  }

  function stepsFromRecipe(r) {
    if (r && r.stepByStep && Array.isArray(r.steps) && r.steps.length) {
      return r.steps.map((s) => ({
        text: s.text || '',
        image: s.image || null,
        video: s.video || null,
      }));
    }
    return (r && r.method || []).map((text) => ({ text, image: null, video: null }));
  }

  function renderStepCards(steps, escapeHtml) {
    if (!steps || !steps.length) return '<p class="text-ink-400">No steps yet.</p>';
    return `<div class="recipe-steps">${steps.map((s, i) => {
      const img = s.image ? `<img src="${s.image}" alt="" class="recipe-step__img">` : '';
      const vid = s.video
        ? `<video class="recipe-step__vid no-print" controls playsinline preload="metadata" src="${s.video}"></video><p class="recipe-step__vid-print print-only">▶ Short video attached to this step (view in app)</p>`
        : '';
      return `<article class="recipe-step">
        <div class="recipe-step__head"><span class="recipe-step__num">${i + 1}</span><span class="recipe-step__label">Step ${i + 1}</span></div>
        <p class="recipe-step__text">${escapeHtml(s.text)}</p>
        ${img}${vid}
      </article>`;
    }).join('')}</div>`;
  }

  window.RecipeMedia = {
    VIDEO_MAX_MB,
    svgProImage,
    heroSrc,
    generateProImage,
    readVideoFile,
    stepsFromRecipe,
    renderStepCards,
  };
})();
