'use strict';
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'menu-creator', '_site');
const DEST = path.join(__dirname, '..', 'site', 'menu-creator');
const BASE = '/menu-creator/';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!fs.existsSync(SRC)) {
  console.error('Missing menu-creator/_site - run: cd ../menu-creator && npm run build');
  process.exit(1);
}

if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);

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
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

const swPath = path.join(DEST, 'service-worker.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/const CACHE_NAME = "[^"]+"/, 'const CACHE_NAME = "menu-creator-kiteline-v1"');
  const assets = [
    BASE,
    BASE + 'index.html',
    BASE + 'install.html',
    BASE + 'manifest.json',
    BASE + 'icons/icon-192.png',
    BASE + 'icons/icon-512.png',
    BASE + 'icons/apple-touch-icon.png',
  ];
  sw = sw.replace(/const ASSETS = \[[\s\S]*?\];/, 'const ASSETS = ' + JSON.stringify(assets, null, 2) + ';');
  fs.writeFileSync(swPath, sw);
}

const indexPath = path.join(DEST, 'index.html');
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');
  html = html.replace(
    'navigator.serviceWorker.register("./service-worker.js")',
    'navigator.serviceWorker.register("/menu-creator/service-worker.js",{scope:"/menu-creator/"})'
  );
  html = html.replace(
    'fetch("./imports/menu-calendar-bundle.json',
    'fetch("/menu-creator/imports/menu-calendar-bundle.json'
  );
  fs.writeFileSync(indexPath, html);
}

console.log('Menu Creator synced to site/menu-creator/ (' + BASE + ')');