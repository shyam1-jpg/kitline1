'use strict';

/**
 * Local MCP tool + tenant-isolation tests (no live password required).
 * Run: node scripts/test-mcp-tools.js
 */

const assert = require('assert');
const aiAuth = require('../server/ai-auth');
const aiMcp = require('../server/ai-mcp');
const tenants = require('../server/tenants');

function makeDb() {
  const db = {
    users: {},
    tenants: {},
    aiTokens: {},
    audit: [],
    _tenantVersion: 1,
  };

  function addCompany(email, name, recipeName, sensorName) {
    const tid = `tenant_${name.toLowerCase().replace(/\W+/g, '_')}`;
    const siteId = `site_${name.toLowerCase().replace(/\W+/g, '_')}`;
    db.users[email] = {
      email,
      name: `${name} Admin`,
      tenantId: tid,
      profile: { businessName: name },
    };
    db.tenants[tid] = {
      _tenantId: tid,
      _tenantPrivate: true,
      org: { name, currency: 'GBP' },
      currentSite: siteId,
      sites: [{ id: siteId, name: `${name} Kitchen`, type: 'restaurant' }],
      team: [{ name: 'Chef', email, access: 'Admin', siteId, clockPin: '9999' }],
      recipes: [
        {
          id: `rcp_${name}`,
          site: siteId,
          name: recipeName,
          allergens: ['Milk'],
          ingredients: [{ name: 'Flour', qty: 1, unit: 'kg' }],
          status: 'approved',
          cost: 3.5,
          servings: 4,
        },
      ],
      menus: [],
      sensors: [{ id: `sen_${name}`, site: siteId, name: sensorName, type: 'fridge', temp: 4, min: 0, max: 8, unit: '°C' }],
      records: [],
      batches: [{ id: `bat_${name}`, site: siteId, name: 'Milk', qty: 1, minQty: 5, unit: 'L' }],
      suppliers: [{ id: `sup_${name}`, site: siteId, name: `${name} Foods` }],
      allergens: ['Milk', 'Eggs'],
      compliance: { hsChecks: [] },
      checklists: [],
      labels: [],
      waste: [],
      alerts: [],
      workflows: [],
    };
    const created = aiAuth.createToken(db, email, {
      label: `${name} MCP`,
      permissions: aiAuth.defaultPermissions({
        read_recipes: true,
        create_menu_drafts: true,
        publish_menus: true,
        read_temperature_logs: true,
        add_temperature_logs: true,
        read_allergen_data: true,
        manage_stock: true,
        manage_suppliers: true,
        export_reports: true,
        manage_rota: true,
      }),
    });
    return { email, tid, siteId, token: created.token, recipeName, sensorName };
  }

  const a = addCompany('a@hotel-a.test', 'HotelA', 'HotelA Signature Curry', 'Walk-in Fridge A');
  const b = addCompany('b@cafe-b.test', 'CafeB', 'CafeB Secret Brownie', 'Display Fridge B');
  return { db, a, b };
}

function writes() {}

async function call(db, company, tool, args) {
  const req = { headers: { authorization: `Bearer ${company.token}` } };
  const auth = aiAuth.resolveAiAuth(db, req);
  assert.ok(auth, 'auth');
  const ctx = aiMcp.buildContext(db, auth);
  assert.ok(!ctx.error, ctx.error);
  return aiMcp.runTool(tool, args || {}, ctx, db, writes, '127.0.0.1');
}

async function main() {
  const results = [];
  function pass(name, detail) {
    results.push({ name, ok: true, detail });
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  }
  function fail(name, err) {
    results.push({ name, ok: false, detail: String(err) });
    console.error(`FAIL  ${name} — ${err}`);
  }

  const { db, a, b } = makeDb();

  // Discovery
  const disc = aiMcp.discovery();
  assert.strictEqual(disc.endpoint, 'https://kiteline.uk/mcp');
  assert.strictEqual(disc.tools.length, 7);
  pass('discovery', `${disc.tools.length} tools`);

  // initialize / tools/list JSON-RPC
  const init = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { db, req: { headers: {} }, ip: '127.0.0.1', writeDb: writes },
  );
  assert.strictEqual(init.status, 200);
  assert.ok(init.payload.result.serverInfo);
  pass('initialize');

  const list = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    { db, req: { headers: {} }, ip: '127.0.0.1', writeDb: writes },
  );
  const names = list.payload.result.tools.map((t) => t.name);
  [
    'search_recipes', 'create_menu', 'get_menus', 'get_missing_temperature_logs',
    'add_temperature_log', 'generate_allergen_report', 'generate_shopping_list',
  ].forEach((n) => assert.ok(names.includes(n), n));
  pass('tools/list', names.join(', '));

  // search_recipes A
  let r = await call(db, a, 'search_recipes', { q: 'Signature' });
  assert.ok(r.ok);
  assert.ok(r.data.recipes.some((x) => x.name.includes('HotelA')));
  assert.ok(!JSON.stringify(r.data).includes('clockPin'));
  assert.ok(!JSON.stringify(r.data).includes('9999'));
  pass('search_recipes', `${r.data.count} hit(s)`);

  // create_menu without confirm
  r = await call(db, a, 'create_menu', { name: 'Lunch' });
  assert.ok(!r.ok && r.code === 'confirmation_required');
  pass('create_menu confirmation gate');

  // create_menu with all dishes
  r = await call(db, a, 'create_menu', { name: 'Lunch Board', confirm: true });
  assert.ok(r.ok, r.error);
  assert.ok(r.data.menu.dishCount >= 1);
  assert.ok(r.data.menu.dishes.some((d) => d.name === a.recipeName));
  pass('create_menu uses all account dishes', `dishCount=${r.data.menu.dishCount}`);

  // get_menus
  r = await call(db, a, 'get_menus', {});
  assert.ok(r.ok);
  assert.ok(r.data.count >= 1);
  pass('get_menus', `${r.data.count} menu(s)`);

  // missing temps
  r = await call(db, a, 'get_missing_temperature_logs', {});
  assert.ok(r.ok);
  assert.ok(r.data.missingCount >= 1);
  pass('get_missing_temperature_logs', `${r.data.missingCount} missing`);

  // add temp without confirm
  r = await call(db, a, 'add_temperature_log', { equipment: a.sensorName, temp: 3.5 });
  assert.ok(!r.ok && r.code === 'confirmation_required');
  pass('add_temperature_log confirmation gate');

  r = await call(db, a, 'add_temperature_log', { equipment: a.sensorName, temp: 3.5, confirm: true });
  assert.ok(r.ok, r.error);
  pass('add_temperature_log', `${r.data.log.equipment}=${r.data.log.temp}`);

  r = await call(db, a, 'get_missing_temperature_logs', {});
  assert.strictEqual(r.data.missingCount, 0);
  pass('missing temps cleared after log');

  // allergen export confirm
  r = await call(db, a, 'generate_allergen_report', {});
  assert.ok(!r.ok && r.code === 'confirmation_required');
  pass('generate_allergen_report confirmation gate');

  r = await call(db, a, 'generate_allergen_report', { confirm: true });
  assert.ok(r.ok);
  assert.ok(r.data.dishes.some((d) => d.name === a.recipeName));
  pass('generate_allergen_report');

  r = await call(db, a, 'generate_shopping_list', {});
  assert.ok(!r.ok && r.code === 'confirmation_required');
  pass('generate_shopping_list confirmation gate');

  r = await call(db, a, 'generate_shopping_list', { confirm: true, fromMenus: true });
  assert.ok(r.ok, r.error);
  pass('generate_shopping_list', `${r.data.itemCount} item(s)`);

  // Isolation: A cannot see B recipe
  r = await call(db, a, 'search_recipes', { q: 'CafeB Secret' });
  assert.ok(r.ok);
  assert.strictEqual(r.data.count, 0);
  const blobA = JSON.stringify(r.data);
  assert.ok(!blobA.includes('CafeB Secret Brownie'));
  pass('isolation A cannot see B recipes');

  r = await call(db, b, 'search_recipes', { q: 'HotelA' });
  assert.ok(r.ok);
  assert.strictEqual(r.data.count, 0);
  pass('isolation B cannot see A recipes');

  // tools/call unauthorized
  const unauth = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'search_recipes', arguments: { q: 'x' } } },
    { db, req: { headers: {} }, ip: '127.0.0.1', writeDb: writes },
  );
  assert.strictEqual(unauth.status, 401);
  pass('tools/call rejects missing token');

  // tools/call authorized
  const authed = await aiMcp.handleJsonRpc(
    { jsonrpc: '2.0', id: 10, method: 'tools/call', params: { name: 'search_recipes', arguments: { q: 'Signature' } } },
    { db, req: { headers: { authorization: `Bearer ${a.token}` } }, ip: '127.0.0.1', writeDb: writes },
  );
  assert.strictEqual(authed.status, 200);
  assert.ok(!authed.payload.result.isError);
  pass('tools/call search_recipes via JSON-RPC');

  // ensure tenant helper still scopes
  assert.ok(tenants.getStateForUser(db, a.email).recipes[0].name.includes('HotelA'));
  assert.ok(tenants.getStateForUser(db, b.email).recipes[0].name.includes('CafeB'));

  const failed = results.filter((x) => !x.ok);
  console.log('\n---');
  console.log(`Results: ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
