'use strict';

const crypto = require('crypto');
const tenants = require('./tenants');
const security = require('./security');
const aiAuth = require('./ai-auth');
const { buildOpenApi } = require('./ai-openapi');

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function appUrl(req) {
  const env = (process.env.APP_URL || '').replace(/\/$/, '');
  if (env) return env;
  const host = req.headers.host || 'kiteline.uk';
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    return `${req.headers['x-forwarded-proto'] || 'http'}://${host}`;
  }
  return `https://${host}`;
}

function inSite(row, siteId) {
  if (!row) return false;
  if (!siteId) return true;
  return row.site === siteId || row.siteId === siteId;
}

function filterSite(arr, siteId) {
  if (!Array.isArray(arr)) return [];
  return arr.filter((r) => inSite(r, siteId));
}

function resolveSiteId(ctx, query, body) {
  const requested = (query.site || (body && body.site) || '').trim();
  const allowed = ctx.siteIds;
  if (requested) {
    if (!allowed.includes(requested)) return { error: 'Site not allowed for this AI token' };
    return { siteId: requested };
  }
  if (allowed.length === 1) return { siteId: allowed[0] };
  if (ctx.state.currentSite && allowed.includes(ctx.state.currentSite)) {
    return { siteId: ctx.state.currentSite };
  }
  return { siteId: allowed[0] || null, warning: 'Multiple sites — pass ?site=site_id' };
}

function auditAi(db, ip, ctx, action, detail) {
  security.audit(db, 'ai_action', {
    ip,
    email: ctx.user.email,
    detail: JSON.stringify({
      actionType: action,
      endpoint: detail && detail.resource,
      method: detail && detail.method,
      tenantId: ctx.user.tenantId,
      orgName: ctx.state.org && ctx.state.org.name,
      site: detail && detail.site,
      at: new Date().toISOString(),
    }),
  });
}

function buildContext(db, auth) {
  const state = tenants.getStateForUser(db, auth.user.email);
  if (!state) return { error: 'No workspace for this account', status: 409 };
  const siteIds = aiAuth.accessibleSiteIds(state, auth.user.email, auth.entry.siteIds);
  return {
    entry: auth.entry,
    user: auth.user,
    state,
    siteIds,
    permissions: auth.entry.permissions,
  };
}

function saveState(db, ctx, nextState) {
  nextState._updatedAt = new Date().toISOString();
  nextState._updatedBy = `ai:${ctx.user.email}`;
  if (!tenants.setStateForUser(db, ctx.user.email, nextState)) {
    throw new Error('Could not save workspace');
  }
}

function temperatureLogs(state, siteId) {
  const records = filterSite(state.records || [], siteId);
  const sensors = filterSite(state.sensors || [], siteId).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type || 'fridge',
    temp: s.temp,
    min: s.min,
    max: s.max,
    unit: s.unit || '°C',
    lastReading: s.lastReading || s.updatedAt,
    site: s.site,
  }));
  return { records, sensors, missingToday: missingFridgeLogs(state, siteId) };
}

function missingFridgeLogs(state, siteId) {
  const today = new Date().toISOString().slice(0, 10);
  const sensors = filterSite(state.sensors || [], siteId);
  const records = filterSite(state.records || [], siteId);
  return sensors.filter((s) => {
    const logged = records.some((r) => {
      const d = (r.at || r.date || '').slice(0, 10);
      return d === today && (r.sensor === s.id || (r.equipment || '').toLowerCase().includes((s.name || '').toLowerCase()));
    });
    return !logged;
  }).map((s) => ({ id: s.id, name: s.name, site: s.site }));
}

function haccpLogs(state, siteId) {
  const comp = state.compliance || {};
  const checklists = filterSite(state.checklists || [], siteId);
  return {
    complianceChecks: filterSite(comp.hsChecks || [], siteId),
    haccpPlans: filterSite(comp.haccpPlans || [], siteId),
    checklists: checklists.filter((c) => /haccp|food safety|opening|closing/i.test(c.name || c.title || '')),
    records: filterSite(state.records || [], siteId),
  };
}

function cleaningChecks(state, siteId) {
  return filterSite(state.checklists || [], siteId).filter((c) =>
    /clean|hygiene|sanit/i.test(c.name || c.title || ''));
}

function allergenReport(state, siteId) {
  const recipes = filterSite(state.recipes || [], siteId);
  const statutory = state.allergens || [];
  const dishes = recipes.map((r) => ({
    id: r.id,
    name: r.name,
    allergens: r.allergens || [],
    status: r.status || 'draft',
    site: r.site,
  }));
  return { statutory, dishes };
}

function buildReport(state, siteId) {
  const temps = temperatureLogs(state, siteId);
  const haccp = haccpLogs(state, siteId);
  const waste = filterSite(state.waste || [], siteId);
  const labels = filterSite(state.labels || [], siteId);
  return {
    generatedAt: new Date().toISOString(),
    site: siteId,
    summary: {
      recipes: filterSite(state.recipes || [], siteId).length,
      menus: filterSite(state.menus || [], siteId).length,
      temperatureCompliance: temps.sensors.length
        ? Math.round((temps.sensors.filter((s) => s.temp >= s.min && s.temp <= s.max).length / temps.sensors.length) * 100)
        : 100,
      missingFridgeLogsToday: temps.missingToday.length,
      openAlerts: filterSite(state.alerts || [], siteId).filter((a) => a.status === 'open').length,
      wasteEntries7d: waste.length,
      labelsActive: labels.filter((l) => !l.used).length,
      haccpChecks: haccp.complianceChecks.length,
    },
    temperature: temps,
    haccp,
    waste,
    labels,
  };
}

async function handleResource(method, name, ctx, db, ip, query, body, apiSend, writeDb) {
  const siteRes = resolveSiteId(ctx, query, body);
  if (siteRes.error) return apiSend(403, { error: siteRes.error });

  const siteId = siteRes.siteId;
  const meta = { site: siteId, resource: name, method };

  if (name === 'me') {
    auditAi(db, ip, ctx, 'me', meta);
    return apiSend(200, {
      email: ctx.user.email,
      name: ctx.user.name,
      tenant: tenants.tenantInfo(db, ctx.user.email),
      role: aiAuth.resolveRole(ctx.state, ctx.user.email),
      permissions: ctx.permissions,
      sites: (ctx.state.sites || []).filter((s) => ctx.siteIds.includes(s.id)),
      token: { id: ctx.entry.id, label: ctx.entry.label },
    });
  }

  if (name === 'sites') {
    const perm = aiAuth.requirePermission(ctx, 'read_recipes');
    if (!perm.ok) return apiSend(403, { error: perm.error });
    auditAi(db, ip, ctx, 'sites', meta);
    return apiSend(200, {
      sites: (ctx.state.sites || []).filter((s) => ctx.siteIds.includes(s.id)),
      warning: siteRes.warning,
    });
  }

  if (name === 'recipes') {
    if (method === 'GET') {
      const perm = aiAuth.requirePermission(ctx, 'read_recipes');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      auditAi(db, ip, ctx, 'recipes_read', meta);
      return apiSend(200, { recipes: filterSite(ctx.state.recipes || [], siteId), warning: siteRes.warning });
    }
    if (method === 'POST') {
      const perm = aiAuth.requirePermission(ctx, 'create_draft_recipes', 'Staff');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      const conf = aiAuth.requireConfirm(method, body);
      if (!conf.ok) return apiSend(409, conf);
      const data = body.data || body;
      const recipe = Object.assign({
        id: uid('rcp'),
        site: siteId,
        status: 'draft',
        createdAt: new Date().toISOString(),
        createdBy: ctx.user.email,
        allergens: [],
        ingredients: [],
        steps: [],
      }, data);
      recipe.status = 'draft';
      const next = JSON.parse(JSON.stringify(ctx.state));
      next.recipes = next.recipes || [];
      next.recipes.push(recipe);
      saveState(db, ctx, next);
      writeDb(db);
      auditAi(db, ip, ctx, 'recipes_create', meta);
      return apiSend(201, { ok: true, recipe });
    }
  }

  if (name === 'menus') {
    if (method === 'GET') {
      const perm = aiAuth.requirePermission(ctx, 'read_recipes');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      auditAi(db, ip, ctx, 'menus_read', meta);
      return apiSend(200, { menus: filterSite(ctx.state.menus || [], siteId) });
    }
    if (method === 'POST') {
      const permKey = body.publish ? 'publish_menus' : 'create_menu_drafts';
      const perm = aiAuth.requirePermission(ctx, permKey, body.publish ? 'Manager' : 'Staff');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      const conf = aiAuth.requireConfirm(method, body);
      if (!conf.ok) return apiSend(409, conf);
      const data = body.data || body;
      const menu = Object.assign({
        id: uid('menu'),
        site: siteId,
        status: body.publish ? 'published' : 'draft',
        createdAt: new Date().toISOString(),
        createdBy: ctx.user.email,
        items: [],
      }, data);
      if (!body.publish) menu.status = 'draft';
      const next = JSON.parse(JSON.stringify(ctx.state));
      next.menus = next.menus || [];
      next.menus.push(menu);
      saveState(db, ctx, next);
      writeDb(db);
      auditAi(db, ip, ctx, 'menus_create', meta);
      return apiSend(201, { ok: true, menu });
    }
  }

  if (name === 'allergens') {
    const perm = aiAuth.requirePermission(ctx, 'read_allergen_data');
    if (!perm.ok) return apiSend(403, { error: perm.error });
    auditAi(db, ip, ctx, 'allergens_read', meta);
    return apiSend(200, allergenReport(ctx.state, siteId));
  }

  if (name === 'temperature-logs') {
    if (method === 'GET') {
      const perm = aiAuth.requirePermission(ctx, 'read_temperature_logs');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      auditAi(db, ip, ctx, 'temperature_read', meta);
      return apiSend(200, temperatureLogs(ctx.state, siteId));
    }
    if (method === 'POST') {
      const perm = aiAuth.requirePermission(ctx, 'add_temperature_logs', 'Staff');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      const conf = aiAuth.requireConfirm(method, body);
      if (!conf.ok) return apiSend(409, conf);
      const data = body.data || body;
      const record = Object.assign({
        id: uid('rec'),
        site: siteId,
        at: new Date().toISOString(),
        by: ctx.user.email,
        type: 'temperature',
      }, data);
      const next = JSON.parse(JSON.stringify(ctx.state));
      next.records = next.records || [];
      next.records.push(record);
      saveState(db, ctx, next);
      writeDb(db);
      auditAi(db, ip, ctx, 'temperature_add', meta);
      return apiSend(201, { ok: true, record });
    }
  }

  if (name === 'haccp-logs') {
    if (method === 'GET') {
      const perm = aiAuth.requirePermission(ctx, 'read_haccp_records');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      auditAi(db, ip, ctx, 'haccp_read', meta);
      return apiSend(200, haccpLogs(ctx.state, siteId));
    }
    if (method === 'POST') {
      const perm = aiAuth.requirePermission(ctx, 'add_haccp_records', 'Staff');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      const conf = aiAuth.requireConfirm(method, body);
      if (!conf.ok) return apiSend(409, conf);
      const data = body.data || body;
      const next = JSON.parse(JSON.stringify(ctx.state));
      next.compliance = next.compliance || { hsChecks: [] };
      next.compliance.hsChecks = next.compliance.hsChecks || [];
      const entry = Object.assign({
        id: uid('khs'),
        site: siteId,
        at: new Date().toISOString(),
        by: ctx.user.email,
        status: 'Open',
        code: 'KHS',
      }, data);
      next.compliance.hsChecks.push(entry);
      saveState(db, ctx, next);
      writeDb(db);
      auditAi(db, ip, ctx, 'haccp_add', meta);
      return apiSend(201, { ok: true, entry });
    }
  }

  if (name === 'cleaning-checks') {
    const perm = aiAuth.requirePermission(ctx, 'read_haccp_records');
    if (!perm.ok) return apiSend(403, { error: perm.error });
    auditAi(db, ip, ctx, 'cleaning_read', meta);
    return apiSend(200, { checks: cleaningChecks(ctx.state, siteId) });
  }

  if (name === 'fridge-freezer-units') {
    const perm = aiAuth.requirePermission(ctx, 'read_temperature_logs');
    if (!perm.ok) return apiSend(403, { error: perm.error });
    auditAi(db, ip, ctx, 'units_read', meta);
    return apiSend(200, {
      units: filterSite(ctx.state.sensors || [], siteId).map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        min: s.min,
        max: s.max,
        temp: s.temp,
        site: s.site,
      })),
    });
  }

  if (name === 'labels') {
    if (method === 'GET') {
      if (!aiAuth.hasPermission(ctx, 'read_recipes') && !aiAuth.hasPermission(ctx, 'manage_labels')) {
        return apiSend(403, { error: 'AI permission denied: read_recipes or manage_labels' });
      }
      auditAi(db, ip, ctx, 'labels_read', meta);
      return apiSend(200, { labels: filterSite(ctx.state.labels || [], siteId) });
    }
    if (method === 'POST') {
      const perm = aiAuth.requirePermission(ctx, 'manage_labels', 'Staff');
      if (!perm.ok) return apiSend(403, { error: perm.error });
      const conf = aiAuth.requireConfirm(method, body);
      if (!conf.ok) return apiSend(409, conf);
      const data = body.data || body;
      const label = Object.assign({
        id: uid('lbl'),
        site: siteId,
        createdAt: new Date().toISOString(),
        createdBy: ctx.user.email,
      }, data);
      const next = JSON.parse(JSON.stringify(ctx.state));
      next.labels = next.labels || [];
      next.labels.push(label);
      saveState(db, ctx, next);
      writeDb(db);
      auditAi(db, ip, ctx, 'labels_create', meta);
      return apiSend(201, { ok: true, label });
    }
  }

  if (name === 'stock') {
    if (method === 'GET') {
      if (!aiAuth.hasPermission(ctx, 'read_recipes') && !aiAuth.hasPermission(ctx, 'manage_stock')) {
        return apiSend(403, { error: 'AI permission denied: read_recipes or manage_stock' });
      }
      auditAi(db, ip, ctx, 'stock_read', meta);
      return apiSend(200, {
        batches: filterSite(ctx.state.batches || [], siteId),
        assets: filterSite(ctx.state.assets || [], siteId),
      });
    }
  }

  if (name === 'suppliers') {
    if (!aiAuth.hasPermission(ctx, 'read_recipes') && !aiAuth.hasPermission(ctx, 'manage_suppliers')) {
      return apiSend(403, { error: 'AI permission denied: read_recipes or manage_suppliers' });
    }
    auditAi(db, ip, ctx, 'suppliers_read', meta);
    return apiSend(200, { suppliers: filterSite(ctx.state.suppliers || [], siteId) });
  }

  if (name === 'orders') {
    if (!aiAuth.hasPermission(ctx, 'read_recipes') && !aiAuth.hasPermission(ctx, 'manage_suppliers')) {
      return apiSend(403, { error: 'AI permission denied: read_recipes or manage_suppliers' });
    }
    auditAi(db, ip, ctx, 'orders_read', meta);
    return apiSend(200, { orders: filterSite(ctx.state.deliveries || [], siteId) });
  }

  if (name === 'waste') {
    const perm = aiAuth.requirePermission(ctx, 'read_haccp_records');
    if (!perm.ok) return apiSend(403, { error: perm.error });
    auditAi(db, ip, ctx, 'waste_read', meta);
    return apiSend(200, { waste: filterSite(ctx.state.waste || [], siteId) });
  }

  if (name === 'rota') {
    if (!aiAuth.hasPermission(ctx, 'read_recipes') && !aiAuth.hasPermission(ctx, 'manage_rota')) {
      return apiSend(403, { error: 'AI permission denied: read_recipes or manage_rota' });
    }
    auditAi(db, ip, ctx, 'rota_read', meta);
    return apiSend(200, {
      team: filterSite(ctx.state.team || [], siteId),
      workflows: filterSite(ctx.state.workflows || [], siteId).filter((w) => /rota|shift|schedule/i.test(w.label || '')),
      note: 'Full staff rota may be on a separate Kiteline rota module if enabled for your organisation.',
    });
  }

  if (name === 'reports') {
    const perm = aiAuth.requirePermission(ctx, 'export_reports', 'Manager');
    if (!perm.ok) {
      const readPerm = aiAuth.requirePermission(ctx, 'read_haccp_records');
      if (!readPerm.ok) return apiSend(403, { error: perm.error });
      auditAi(db, ip, ctx, 'reports_summary', meta);
      return apiSend(200, {
        summaryOnly: true,
        message: 'Enable export_reports permission on the AI token for full inspection export.',
        report: buildReport(ctx.state, siteId),
      });
    }
    auditAi(db, ip, ctx, 'reports_export', meta);
    return apiSend(200, { export: true, report: buildReport(ctx.state, siteId) });
  }

  return apiSend(404, { error: 'Unknown AI resource' });
}

async function handleApi(opts) {
  const {
    db, req, route, method, body, ip, apiSend, userFromReq, writeDb, query,
  } = opts;

  if (!route.startsWith('/ai')) return false;

  const sub = route.replace(/^\/ai\/?/, '') || '';
  const parts = sub.split('/').filter(Boolean);
  const resource = parts[0] || '';

  if (resource === 'health' && method === 'GET') {
    await apiSend(200, {
      ok: true,
      service: 'kiteline-ai',
      version: '1.0.0',
      auth: 'AI token (kl_ai_…) via Bearer or x-api-key — not user passwords',
    });
    return true;
  }

  if (resource === 'openapi.json' && method === 'GET') {
    await apiSend(200, buildOpenApi(appUrl(req)));
    return true;
  }

  if (resource === 'tokens') {
    const sessionUser = userFromReq(db, req);
    if (!sessionUser) {
      await apiSend(401, { error: 'Sign in to manage AI tokens', code: 'session_required' });
      return true;
    }
    if (method === 'GET') {
      await apiSend(200, {
        tokens: aiAuth.listTokensForUser(db, sessionUser.email),
        permissionKeys: aiAuth.PERMISSION_KEYS,
        defaults: aiAuth.defaultPermissions(),
        howToConnect: {
          step1: 'Create a token here (POST) while signed in with your normal Kiteline session',
          step2: 'In ChatGPT → GPT Actions, import schema from /api/ai/openapi.json',
          step3: 'Set Authentication to API key or Bearer with your kl_ai_… token',
        },
      });
      return true;
    }
    if (method === 'POST') {
      try {
        const created = aiAuth.createToken(db, sessionUser.email, body || {});
        security.audit(db, 'ai_token_create', { ip, email: sessionUser.email, detail: created.id });
        writeDb(db);
        await apiSend(201, {
          ok: true,
          token: created.token,
          warning: 'Copy this token now — it will not be shown again.',
          entry: created.entry,
        });
      } catch (e) {
        await apiSend(400, { error: e.message || 'Could not create token' });
      }
      return true;
    }
    if (method === 'DELETE' && parts[1]) {
      try {
        aiAuth.revokeToken(db, sessionUser.email, parts[1]);
        security.audit(db, 'ai_token_revoke', { ip, email: sessionUser.email, detail: parts[1] });
        writeDb(db);
        await apiSend(200, { ok: true });
      } catch (e) {
        await apiSend(404, { error: e.message || 'Token not found' });
      }
      return true;
    }
    await apiSend(405, { error: 'Method not allowed' });
    return true;
  }

  const auth = aiAuth.resolveAiAuth(db, req);
  if (!auth) {
    await apiSend(401, {
      error: 'Invalid or missing Kiteline AI token',
      code: 'ai_token_required',
      hint: 'Use Bearer or x-api-key with a kl_ai_… token from POST /api/ai/tokens',
    });
    return true;
  }

  const ctx = buildContext(db, auth);
  if (ctx.error) {
    await apiSend(ctx.status || 403, { error: ctx.error });
    return true;
  }

  if (!resource) {
    await apiSend(200, {
      service: 'kiteline-ai',
      endpoints: [
        'me', 'sites', 'recipes', 'menus', 'allergens', 'temperature-logs', 'haccp-logs',
        'cleaning-checks', 'fridge-freezer-units', 'labels', 'stock', 'suppliers',
        'orders', 'waste', 'rota', 'reports',
      ],
    });
    return true;
  }

  await handleResource(method, resource, ctx, db, ip, query || {}, body, apiSend, writeDb);
  return true;
}

function mcpInfo() {
  return {
    name: 'kiteline',
    version: '1.0.0',
    status: 'stub',
    description: 'Kiteline MCP connector — use REST /api/ai for GPT Actions today.',
    openapi: '/api/ai/openapi.json',
    health: '/api/ai/health',
    docs: 'https://kiteline.uk',
  };
}

module.exports = { handleApi, mcpInfo };
