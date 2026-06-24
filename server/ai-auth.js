'use strict';

const crypto = require('crypto');

const TOKEN_PREFIX = 'kl_ai_';
const RANK = { Staff: 1, Manager: 2, Admin: 3 };

const PERMISSION_KEYS = [
  'read_recipes',
  'create_draft_recipes',
  'edit_approved_recipes',
  'read_allergen_data',
  'create_menu_drafts',
  'publish_menus',
  'read_temperature_logs',
  'add_temperature_logs',
  'read_haccp_records',
  'add_haccp_records',
  'export_reports',
  'manage_labels',
  'manage_stock',
  'manage_suppliers',
  'manage_rota',
  'delete_records',
];

function defaultPermissions(overrides) {
  const base = {
    read_recipes: true,
    create_draft_recipes: false,
    edit_approved_recipes: false,
    read_allergen_data: true,
    create_menu_drafts: false,
    publish_menus: false,
    read_temperature_logs: true,
    add_temperature_logs: false,
    read_haccp_records: true,
    add_haccp_records: false,
    export_reports: false,
    manage_labels: false,
    manage_stock: false,
    manage_suppliers: false,
    manage_rota: false,
    delete_records: false,
  };
  if (overrides && typeof overrides === 'object') {
    PERMISSION_KEYS.forEach((k) => {
      if (typeof overrides[k] === 'boolean') base[k] = overrides[k];
    });
  }
  return base;
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function uid() {
  return 'ait_' + crypto.randomBytes(8).toString('hex');
}

function issueToken() {
  return TOKEN_PREFIX + crypto.randomBytes(24).toString('hex');
}

function isAiToken(raw) {
  return String(raw || '').startsWith(TOKEN_PREFIX);
}

function ensureStore(db) {
  if (!db.aiTokens) db.aiTokens = {};
  return db.aiTokens;
}

function resolveRole(state, email) {
  const em = (email || '').toLowerCase().trim();
  const member = (state && state.team || []).find((t) => (t.email || '').toLowerCase() === em);
  if (member && member.access && RANK[member.access]) return member.access;
  if (member) {
    const title = (member.role || '').toLowerCase();
    if (/head chef|owner|director|admin|proprietor|gm|general manager/.test(title)) return 'Admin';
    if (/manager|compliance|supervisor|lead|head/.test(title)) return 'Manager';
    return 'Staff';
  }
  return 'Admin';
}

function accessibleSiteIds(state, email, tokenSiteIds) {
  const em = (email || '').toLowerCase().trim();
  const sites = (state && state.sites) || [];
  const role = resolveRole(state, email);
  if (role === 'Admin' && (!tokenSiteIds || !tokenSiteIds.length)) {
    return sites.map((s) => s.id);
  }
  const allowed = new Set();
  if (Array.isArray(tokenSiteIds) && tokenSiteIds.length) {
    tokenSiteIds.forEach((id) => allowed.add(id));
  }
  (state.team || []).forEach((t) => {
    if ((t.email || '').toLowerCase() === em && t.siteId) allowed.add(t.siteId);
  });
  if (!allowed.size && role === 'Admin') return sites.map((s) => s.id);
  return sites.filter((s) => allowed.has(s.id)).map((s) => s.id);
}

function createToken(db, email, opts) {
  const user = db.users[(email || '').toLowerCase().trim()];
  if (!user || !user.tenantId) throw new Error('No workspace for this account');
  const raw = issueToken();
  const id = uid();
  const store = ensureStore(db);
  store[id] = {
    id,
    hash: hashToken(raw),
    hint: raw.slice(0, 12) + '…',
    email: user.email,
    tenantId: user.tenantId,
    label: String((opts && opts.label) || 'ChatGPT').slice(0, 80),
    siteIds: Array.isArray(opts && opts.siteIds) ? opts.siteIds.filter(Boolean) : null,
    permissions: defaultPermissions(opts && opts.permissions),
    createdAt: new Date().toISOString(),
    lastUsed: null,
  };
  return { id, token: raw, entry: publicTokenEntry(store[id]) };
}

function publicTokenEntry(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    label: entry.label,
    hint: entry.hint,
    email: entry.email,
    siteIds: entry.siteIds,
    permissions: entry.permissions,
    createdAt: entry.createdAt,
    lastUsed: entry.lastUsed,
  };
}

function listTokensForUser(db, email) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  if (!user) return [];
  return Object.values(ensureStore(db))
    .filter((t) => t.email === em && t.tenantId === user.tenantId)
    .map(publicTokenEntry);
}

function revokeToken(db, email, tokenId) {
  const em = (email || '').toLowerCase().trim();
  const user = db.users[em];
  const store = ensureStore(db);
  const entry = store[tokenId];
  if (!entry || entry.email !== em || entry.tenantId !== user.tenantId) {
    throw new Error('Token not found');
  }
  delete store[tokenId];
  return true;
}

function resolveAiAuth(db, req) {
  const bearer = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  const apiKey = (req.headers['x-api-key'] || '').trim();
  const raw = isAiToken(bearer) ? bearer : (isAiToken(apiKey) ? apiKey : null);
  if (!raw) return null;

  const h = hashToken(raw);
  const store = ensureStore(db);
  const entry = Object.values(store).find((t) => t.hash === h);
  if (!entry) return null;
  entry.lastUsed = new Date().toISOString();
  const user = db.users[(entry.email || '').toLowerCase()];
  if (!user || user.tenantId !== entry.tenantId) return null;
  return { entry, user, raw };
}

function hasPermission(ctx, key) {
  return !!(ctx && ctx.entry && ctx.entry.permissions && ctx.entry.permissions[key]);
}

function roleAtLeast(role, min) {
  return (RANK[role] || 0) >= (RANK[min] || 99);
}

function requirePermission(ctx, key, minRole) {
  if (!hasPermission(ctx, key)) {
    return { ok: false, error: `AI permission denied: ${key}` };
  }
  const role = resolveRole(ctx.state, ctx.user.email);
  if (minRole && !roleAtLeast(role, minRole)) {
    return { ok: false, error: `Role ${role} cannot perform this action (requires ${minRole})` };
  }
  return { ok: true, role };
}

function requireConfirm(method, body) {
  if (!['POST', 'PUT', 'DELETE'].includes(method)) return { ok: true };
  if (body && body.confirm === true) return { ok: true };
  return {
    ok: false,
    error: 'Confirmation required — resend with "confirm": true after the user approves this change',
    code: 'confirmation_required',
  };
}

module.exports = {
  TOKEN_PREFIX,
  PERMISSION_KEYS,
  defaultPermissions,
  isAiToken,
  createToken,
  listTokensForUser,
  revokeToken,
  resolveAiAuth,
  resolveRole,
  accessibleSiteIds,
  hasPermission,
  requirePermission,
  requireConfirm,
  publicTokenEntry,
  RANK,
  roleAtLeast,
};
