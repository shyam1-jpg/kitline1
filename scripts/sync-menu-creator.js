'use strict';
/**
 * Copy a Menu Creator static build into site/menu-creator/ and rewrite
 * paths so the PWA lives under /menu-creator/ on Kiteline.
 *
 * Usage:
 *   node scripts/sync-menu-creator.js [path-to-_site-or-static-root]
 *
 * Default source: ../menu-creator/_site (sibling checkout).
 * Preserves site/menu-creator/imports/ (calendar archive) if it exists.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC = path.resolve(
  process.argv[2] || path.join(__dirname, '..', '..', 'menu-creator', '_site')
);
const DEST = path.join(__dirname, '..', 'site', 'menu-creator');
const BASE = '/menu-creator/';
const SKIP_COPY = new Set([
  '.git',
  'node_modules',
  'scripts',
  '.github',
]);

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (SKIP_COPY.has(entry.name)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(SRC)) {
  console.error('Missing Menu Creator source at ' + SRC);
  console.error('Usage: node scripts/sync-menu-creator.js [path-to-_site]');
  console.error('Or: cd ../menu-creator && npm run build');
  process.exit(1);
}

const importsSrc = path.join(DEST, 'imports');
let importsTmp = null;
if (fs.existsSync(importsSrc)) {
  importsTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'menu-creator-imports-'));
  copyDir(importsSrc, importsTmp);
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);

if (importsTmp) {
  copyDir(importsTmp, path.join(DEST, 'imports'));
  fs.rmSync(importsTmp, { recursive: true, force: true });
}

let build = 'v1';
const indexPath = path.join(DEST, 'index.html');
if (fs.existsSync(indexPath)) {
  const m = fs.readFileSync(indexPath, 'utf8').match(/menu-creator-build"\s+content="([^"]+)"/);
  if (m) build = m[1];
}
const cacheName = 'menu-creator-kiteline-' + build;

const manifestPath = path.join(DEST, 'manifest.json');
if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.id = BASE;
  manifest.start_url = BASE;
  manifest.scope = BASE;
  manifest.icons = (manifest.icons || []).map((ic) => ({
    ...ic,
    src: ic.src.startsWith('/') ? ic.src : BASE + ic.src.replace(/^\.\//, ''),
  }));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

const assetCandidates = [
  BASE,
  BASE + 'index.html',
  BASE + 'vedanta-menu-creator.html',
  BASE + 'install.html',
  BASE + 'manifest.json',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-512.png',
  BASE + 'icons/apple-touch-icon.png',
  BASE + 'icons/icon-192.svg',
  BASE + 'icons/icon-512.svg',
  BASE + 'assets/vedanta-logo.png',
  BASE + 'assets/qr-thevedanta.png',
];
const assets = assetCandidates.filter((url) => {
  if (url === BASE) return true;
  return fs.existsSync(path.join(DEST, url.slice(BASE.length)));
});

const swPath = path.join(DEST, 'service-worker.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/const CACHE_NAME = "[^"]+"/, 'const CACHE_NAME = "' + cacheName + '"');
  sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, 'const ASSETS = ' + JSON.stringify(assets, null, 2) + ';');
  sw = sw.replace(/"\.\/vedanta-menu-creator\.html"/g, JSON.stringify(BASE + 'vedanta-menu-creator.html'));
  sw = sw.replace(/"\.\/install\.html"/g, JSON.stringify(BASE + 'install.html'));
  sw = sw.replace(/"\.\/index\.html"/g, JSON.stringify(BASE + 'index.html'));
  sw = sw.replace(/caches\.match\("\.\/"\)/g, 'caches.match(' + JSON.stringify(BASE) + ')');
  fs.writeFileSync(swPath, sw);
}

function rewriteHtml(filePath) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(
    /navigator\.serviceWorker\.register\(\s*["']\.\/service-worker\.js["']\s*,\s*\{\s*updateViaCache:\s*["']none["']\s*\}\s*\)/g,
    'navigator.serviceWorker.register("/menu-creator/service-worker.js",{scope:"/menu-creator/",updateViaCache:"none"})'
  );
  html = html.replace(
    /navigator\.serviceWorker\.register\(\s*["']\.\/service-worker\.js["']\s*\)/g,
    'navigator.serviceWorker.register("/menu-creator/service-worker.js",{scope:"/menu-creator/"})'
  );
  html = html.replace(
    /fetch\(\s*["']\.\/imports\/menu-calendar-bundle\.json/g,
    'fetch("/menu-creator/imports/menu-calendar-bundle.json'
  );
  fs.writeFileSync(filePath, html);
}

rewriteHtml(indexPath);
rewriteHtml(path.join(DEST, 'install.html'));

console.log('Menu Creator synced to site/menu-creator/ (' + BASE + ', ' + cacheName + ')');
