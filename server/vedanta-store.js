'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'vedanta-store.json');

function emptyStore() {
  return {
    staff: [],
    rota: {},
    clock: {},
    leave_requests: [],
    audit_log: [],
    pins: {},
    updatedAt: null,
  };
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_FILE)) return emptyStore();
    const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
    return { ...emptyStore(), ...raw };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2));
  return store;
}

function getSnapshot() {
  return readStore();
}

function mergeBulk(incoming) {
  const store = readStore();
  if (Array.isArray(incoming.staff) && incoming.staff.length) {
    incoming.staff.forEach((s) => {
      const i = store.staff.findIndex((x) => String(x.id) === String(s.id));
      if (i >= 0) store.staff[i] = s;
      else store.staff.push(s);
    });
    store.staff.sort((a, b) => a.id - b.id);
  }
  if (incoming.rota && typeof incoming.rota === 'object') {
    Object.assign(store.rota, incoming.rota);
  }
  if (incoming.clock && typeof incoming.clock === 'object') {
    Object.assign(store.clock, incoming.clock);
  }
  if (Array.isArray(incoming.leave_requests)) {
    incoming.leave_requests.forEach((r) => {
      const i = store.leave_requests.findIndex((x) => x.id === r.id);
      if (i >= 0) store.leave_requests[i] = r;
      else store.leave_requests.push(r);
    });
  }
  if (Array.isArray(incoming.audit_log)) {
    const ids = new Set(store.audit_log.map((a) => a.id));
    incoming.audit_log.forEach((a) => {
      if (!ids.has(a.id)) store.audit_log.unshift(a);
    });
    store.audit_log = store.audit_log.slice(0, 500);
  }
  if (incoming.pins && typeof incoming.pins === 'object') {
    store.pins = { ...store.pins, ...incoming.pins };
  }
  return writeStore(store);
}

function applyPatch(ops) {
  const store = readStore();
  const list = Array.isArray(ops) ? ops : [ops];
  list.forEach((op) => {
    const c = op.c || op.collection;
    const id = op.id;
    const data = op.data;
    const del = op.delete || op.del;
    if (!c) return;

    if (c === 'staff') {
      if (del) store.staff = store.staff.filter((s) => String(s.id) !== String(id));
      else if (data) {
        const i = store.staff.findIndex((s) => String(s.id) === String(id));
        if (i >= 0) store.staff[i] = data;
        else store.staff.push(data);
        store.staff.sort((a, b) => a.id - b.id);
      }
    } else if (c === 'rota' || c === 'clock') {
      if (!store[c]) store[c] = {};
      if (del) delete store[c][id];
      else if (data) store[c][id] = data;
    } else if (c === 'leave_requests') {
      if (del) store.leave_requests = store.leave_requests.filter((r) => r.id !== id);
      else if (data) {
        const i = store.leave_requests.findIndex((r) => r.id === id);
        if (i >= 0) store.leave_requests[i] = data;
        else store.leave_requests.push(data);
      }
    } else if (c === 'audit_log') {
      if (data) {
        const i = store.audit_log.findIndex((a) => a.id === id);
        if (i >= 0) store.audit_log[i] = data;
        else store.audit_log.unshift(data);
        store.audit_log = store.audit_log.slice(0, 500);
      }
    } else if (c === 'pins') {
      if (data) store.pins = data;
    }
  });
  return writeStore(store);
}

module.exports = {
  getSnapshot,
  mergeBulk,
  applyPatch,
  STORE_FILE,
};
