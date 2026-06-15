'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'waitlist.json');

const PRODUCTS = ['sensor-kit', 'printer-bundle', 'label-rolls', 'full-bundle'];

function read() {
  try {
    if (!fs.existsSync(FILE)) return [];
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return [];
  }
}

function write(list) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function summary(list) {
  const counts = {};
  PRODUCTS.forEach((p) => { counts[p] = 0; });
  list.forEach((e) => {
    if (Object.prototype.hasOwnProperty.call(counts, e.product)) counts[e.product]++;
    else counts[e.product] = (counts[e.product] || 0) + 1;
  });
  return { total: list.length, counts };
}

function add(entry) {
  const email = (entry.email || '').toLowerCase().trim();
  const name = (entry.name || '').trim();
  const product = entry.product || 'sensor-kit';
  if (!email || !name) return { error: 'Name and email required' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Valid email required' };

  const list = read();
  const dup = list.find((e) => e.email === email && e.product === product);
  if (dup) return { error: 'You\'re already on the list for this product', summary: summary(list) };

  list.push({
    id: 'wl_' + crypto.randomBytes(4).toString('hex'),
    at: new Date().toISOString(),
    product,
    name,
    email,
    phone: (entry.phone || '').trim(),
    sites: entry.sites || '1',
    note: (entry.note || '').trim(),
  });
  write(list);
  const saved = list[list.length - 1];
  return { ok: true, entry: saved, summary: summary(list) };
}

module.exports = { add, read, summary, PRODUCTS };
