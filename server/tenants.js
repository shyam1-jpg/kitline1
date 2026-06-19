'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEMO_TENANT_ID = 'tenant_demo';
const TENANT_VERSION = 1;

function ownerEmail() {
  return (process.env.OWNER_EMAIL || 'shyam_1@hotmail.co.uk').toLowerCase().trim();
}

function isOwner(email) {
  return (email || '').toLowerCase().trim() === ownerEmail();
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString('hex')}`;
}

function emptyCollections() {
  return {
    sensors: [],
    checklists: [],
    records: [],
    alerts: [],
    menus: [],
    labels: [],
    waste: [],
    recipes: [],
    activity: [],
    workflows: [],
    suppliers: [],
    training: [],
    incidents: [],
    maintenance: [],
    deliveries: [],
    assets: [],
    batches: [],
    cooling: [],
    phlogs: [],
    holding: [],
    allergens: [
      'Celery', 'Cereals containing gluten', 'Crustaceans', 'Eggs', 'Fish', 'Lupin',
      'Milk', 'Molluscs', 'Mustard', 'Peanuts', 'Sesame', 'Soybeans',
      'Sulphur dioxide & sulphites', 'Tree nuts',
    ],
  };
}

function sampleRecipes(siteId) {
  const now = new Date().toISOString();
  return [
    {
      id: uid('r'), name: 'Sample — Tomato Soup', category: 'Starter', site: siteId,
      servings: 4, prepMins: 15, cookMins: 25, cost: 4.5, allergens: [],
      ingredients: [{ name: 'Tomatoes', qty: '400', unit: 'g' }, { name: 'Onion', qty: '1', unit: 'each' }],
      method: ['Sweat onion', 'Add tomatoes and simmer 20 min', 'Blend and season'],
      stepByStep: false, image: null, updatedAt: now, _sample: true,
    },
    {
      id: uid('r'), name: 'Sample — House Salad', category: 'Side', site: siteId,
      servings: 1, prepMins: 10, cookMins: 0, cost: 1.2, allergens: ['Mustard'],
      ingredients: [{ name: 'Mixed leaves', qty: '80', unit: 'g' }],
      method: ['Wash leaves', 'Toss with dressing before service'],
      stepByStep: false, image: null, updatedAt: now, _sample: true,
    },
  ];
}

function buildPrivateTenant(user, email, profile) {
  profile = profile || user.profile || {};
  const biz = String(profile.businessName || user.name || email.split('@')[0]).trim();
  const siteId = uid('site');
  const userId = uid('u');
  const initials = ((profile.firstName || user.name || '')[0] || '') + ((profile.lastName || '')[0] || '');
  const site = {
    id: siteId,
    name: biz,
    legalName: (profile.legalName || '').trim() || biz,
    city: (profile.city || '').trim() || '—',
    postcode: (profile.postcode || '').trim() || '',
    address: (profile.address || '').trim() || '',
    country: profile.country || 'United Kingdom',
    type: profile.businessType || 'Restaurant',
    timezone: 'Europe/London',
    manager: user.name || biz,
    phone: (profile.phone || '').trim(),
    email: email.toLowerCase(),
    status: 'Active',
  };
  const products = { fss: true, allerq: true, labels: true, waste: true };
  (profile.modules || []).forEach((m) => {
    if (m !== 'sensors' && products[m] !== undefined) products[m] = true;
  });
  const base = emptyCollections();
  return {
    ...base,
    org: {
      name: biz,
      legalName: (profile.legalName || '').trim() || biz,
      plan: 'Free trial',
      currency: 'GBP',
      products,
      channels: { sms: false, email: false, push: false },
      maxUsers: 5,
    },
    sites: [site],
    team: [{
      id: userId,
      name: user.name || biz,
      email: email.toLowerCase(),
      phone: (profile.phone || '').trim(),
      role: profile.jobRole || 'Owner / Director',
      access: 'Admin',
      siteId,
      initials: (initials.toUpperCase() || 'OW').slice(0, 2),
    }],
    recipes: sampleRecipes(siteId),
    checklists: [{
      id: uid('cl'),
      title: 'Opening checks',
      site: siteId,
      recurrence: 'Daily',
      due: new Date().toISOString().slice(0, 10),
      assignee: userId,
      items: [
        { id: uid('i'), text: 'Hand wash stations stocked', done: false },
        { id: uid('i'), text: 'Fridge temps logged', done: false },
      ],
    }],
    currentSite: siteId,
    _tenantId: null,
    _tenantPrivate: true,
    _isPrivate: true,
    _isDemo: false,
    _createdAt: new Date().toISOString(),
  };
}

function tagDemoState(state) {
  if (!state) return state;
  state._tenantId = DEMO_TENANT_ID;
  state._isDemo = true;
  state._tenantPrivate = false;
  state._isPrivate = false;
  return state;
}

function tagPrivateState(state, tenantId) {
  if (!state) return state;
  state._tenantId = tenantId;
  state._tenantPrivate = true;
  state._isPrivate = true;
  state._isDemo = false;
  return state;
}

function loadDemoFromFile() {
  const seedFile = path.join(__dirname, 'demo-state.json');
  if (!fs.existsSync(seedFile)) return null;
  try {
    return tagDemoState(JSON.parse(fs.readFileSync(seedFile, 'utf8')));
  } catch {
    return null;
  }
}

function ensureDemoTenant(db) {
  db.tenants = db.tenants || {};
  if (!db.tenants[DEMO_TENANT_ID]) {
    const fromState = db.state ? JSON.parse(JSON.stringify(db.state)) : null;
    db.tenants[DEMO_TENANT_ID] = tagDemoState(fromState || loadDemoFromFile() || buildPrivateTenant(
      { name: 'Demo', profile: { businessName: 'Kiteline Demo' } },
      'demo@kiteline.app',
      { businessName: 'Kiteline Demo', city: 'London', postcode: '—' }
    ));
  }
  return db.tenants[DEMO_TENANT_ID];
}

function adoptLegacyWorkspace(tenant, shared, email, user) {
  if (!shared || !Array.isArray(shared.sites)) return tenant;
  const em = email.toLowerCase();
  const biz = String((user.profile && user.profile.businessName) || user.name || '').trim().toLowerCase();
  const mySiteIds = new Set();
  shared.sites.forEach((s) => {
    if ((s.email || '').toLowerCase() === em) mySiteIds.add(s.id);
    if (biz && String(s.name || '').trim().toLowerCase() === biz) mySiteIds.add(s.id);
  });
  (shared.team || []).forEach((t) => {
    if ((t.email || '').toLowerCase() === em && t.siteId) mySiteIds.add(t.siteId);
  });
  if (!mySiteIds.size) return tenant;

  const siteList = shared.sites.filter((s) => mySiteIds.has(s.id));
  tenant.sites = siteList;
  tenant.currentSite = siteList[0].id;
  tenant.team = (shared.team || []).filter((t) => mySiteIds.has(t.siteId) || (t.email || '').toLowerCase() === em);
  if (siteList[0]) {
    tenant.org.name = siteList[0].name;
    if (siteList[0].legalName) tenant.org.legalName = siteList[0].legalName;
  }
  const inSite = (row) => {
    if (!row) return false;
    if (row.site && mySiteIds.has(row.site)) return true;
    if (row.siteId && mySiteIds.has(row.siteId)) return true;
    return false;
  };
  ['recipes', 'checklists', 'sensors', 'menus', 'labels', 'waste', 'records', 'alerts', 'workflows', 'deliveries', 'batches', 'cooling', 'phlogs', 'holding'].forEach((key) => {
    if (Array.isArray(shared[key])) tenant[key] = shared[key].filter(inSite);
  });
  return tenant;
}

function migrateToTenants(db) {
  if ((db._tenantVersion || 0) >= TENANT_VERSION) return db;
  db.tenants = db.tenants || {};
  const legacyShared = db.state ? JSON.parse(JSON.stringify(db.state)) : null;
  ensureDemoTenant(db);

  Object.entries(db.users || {}).forEach(([email, user]) => {
    const em = email.toLowerCase();
    if (user.tenantId && db.tenants[user.tenantId]) return;

    if (isOwner(em)) {
      user.tenantId = DEMO_TENANT_ID;
      return;
    }

    const tid = uid('tenant');
    let tenant = buildPrivateTenant(user, em, user.profile);
    tenant = adoptLegacyWorkspace(tenant, legacyShared, em, user);
    tagPrivateState(tenant, tid);
    db.tenants[tid] = tenant;
    user.tenantId = tid;
  });

  db._tenantVersion = TENANT_VERSION;
  db.state = db.tenants[DEMO_TENANT_ID];
  return db;
}

function prepareDb(db) {
  migrateToTenants(db);
  return db;
}

function getUser(db, email) {
  return db.users[(email || '').toLowerCase().trim()];
}

function getStateForUser(db, email) {
  prepareDb(db);
  const user = getUser(db, email);
  if (!user || !user.tenantId) return null;
  return db.tenants[user.tenantId] || null;
}

function setStateForUser(db, email, state) {
  const user = getUser(db, email);
  if (!user || !user.tenantId) return false;
  if (!db.tenants) db.tenants = {};
  const tid = user.tenantId;
  if (tid === DEMO_TENANT_ID && !isOwner(email)) return false;
  const meta = {
    _tenantId: tid,
    _isDemo: tid === DEMO_TENANT_ID,
    _tenantPrivate: tid !== DEMO_TENANT_ID,
    _isPrivate: tid !== DEMO_TENANT_ID,
  };
  db.tenants[tid] = Object.assign({}, state, meta);
  if (tid === DEMO_TENANT_ID) db.state = db.tenants[tid];
  return true;
}

function createTenantForRegistration(db, user, email, profile) {
  prepareDb(db);
  const tid = uid('tenant');
  const tenant = buildPrivateTenant(user, email, profile);
  tagPrivateState(tenant, tid);
  db.tenants[tid] = tenant;
  user.tenantId = tid;
  user.profile = profile;
  return tid;
}

function getDemoState(db) {
  prepareDb(db);
  return db.tenants[DEMO_TENANT_ID];
}

function tenantInfo(db, email) {
  const user = getUser(db, email);
  const state = getStateForUser(db, email);
  const tid = user && user.tenantId;
  return {
    id: tid,
    isDemo: tid === DEMO_TENANT_ID,
    isPrivate: tid && tid !== DEMO_TENANT_ID,
    orgName: state && state.org ? state.org.name : null,
  };
}

function bootstrapDemoKitchen(db) {
  prepareDb(db);
  const demo = db.tenants[DEMO_TENANT_ID];
  const seedFile = path.join(__dirname, 'demo-state.json');
  if (!fs.existsSync(seedFile)) return db;
  const recipes = demo && Array.isArray(demo.recipes) ? demo.recipes.length : 0;
  if (recipes < 100) {
    try {
      db.tenants[DEMO_TENANT_ID] = tagDemoState(JSON.parse(fs.readFileSync(seedFile, 'utf8')));
      db.tenants[DEMO_TENANT_ID].currentSite = 'site_grove';
      db.state = db.tenants[DEMO_TENANT_ID];
    } catch (e) {
      console.warn('  Demo seed failed:', e.message);
    }
    return db;
  }
  const site = demo.currentSite || 'site_grove';
  if (!demo.recipes.some((r) => r.site === site)) {
    demo.currentSite = 'site_grove';
  }
  const { mergeExtraSites } = require('./extra-sites');
  if (mergeExtraSites(demo)) {
    db.state = demo;
  }
  return db;
}

module.exports = {
  DEMO_TENANT_ID,
  TENANT_VERSION,
  isOwner,
  ownerEmail,
  prepareDb,
  migrateToTenants,
  getStateForUser,
  setStateForUser,
  createTenantForRegistration,
  getDemoState,
  tenantInfo,
  bootstrapDemoKitchen,
  buildPrivateTenant,
};
