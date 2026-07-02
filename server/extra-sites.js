'use strict';

const crypto = require('crypto');

const PILOT_PACK_VERSION = 2;

const EXTRA_SITES = [
  {
    id: 'site_vedanta',
    name: 'The Ve Kitchen One',
    legalName: 'The Vedanta Way Limited',
    city: 'London',
    timezone: 'Europe/London',
    address: 'The Ve Outlet One — Vedanta Campus',
    postcode: 'WD25 8HE',
    country: 'UK',
    type: 'School & Events Catering',
    covers: 520,
    rating: 5,
    manager: 'Shyam Prasad',
    phone: '',
    email: 'shyam_1@hotmail.co.uk',
    opened: '2018',
    lastInspection: new Date().toISOString().slice(0, 10),
    status: 'Active',
    pilot: true,
    tags: ['vedanta', 'school-meals'],
  },
  {
    id: 'site_govindas',
    name: 'Govindas Central Kitchen',
    legalName: 'Govindas Ltd',
    city: 'London',
    timezone: 'Europe/London',
    address: 'Bhaktivedanta Manor — School Meals Unit',
    postcode: 'WD25 8HE',
    country: 'UK',
    type: 'Vegetarian School Catering',
    covers: 1200,
    rating: 5,
    manager: 'Anita Sharma',
    phone: '+44 1923 851000',
    email: 'kitchen@govindas.demo',
    opened: '2010',
    lastInspection: new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10),
    status: 'Active',
    pilot: true,
    tags: ['govindas', 'vegetarian', 'school-meals'],
  },
  {
    id: 'site_regent',
    name: 'The Regent Hotel',
    city: 'London',
    timezone: 'Europe/London',
    address: '88 Regent Street',
    postcode: 'W1B 5RS',
    country: 'UK',
    type: 'Hotel',
    covers: 200,
    rating: 5,
    manager: 'Helen Croft',
    phone: '+44 20 7123 4600',
    email: 'regent@kiteline.uk',
    opened: '2012',
    lastInspection: new Date(Date.now() - 35 * 864e5).toISOString().slice(0, 10),
    status: 'Active',
  },
  {
    id: 'site_manor',
    name: 'Manor Park Hotel',
    city: 'Edinburgh',
    timezone: 'Europe/London',
    address: '12 Manor Park Gardens',
    postcode: 'EH12 5BF',
    country: 'UK',
    type: 'Hotel',
    covers: 140,
    rating: 4,
    manager: 'Gordon Reid',
    phone: '+44 131 555 0201',
    email: 'manor@kiteline.uk',
    opened: '2015',
    lastInspection: new Date(Date.now() - 50 * 864e5).toISOString().slice(0, 10),
    status: 'Active',
  },
  {
    id: 'site_coastal',
    name: 'Coastal Bay Hotel',
    city: 'Brighton',
    timezone: 'Europe/London',
    address: '5 Seafront Parade',
    postcode: 'BN1 2FJ',
    country: 'UK',
    type: 'Hotel',
    covers: 110,
    rating: 5,
    manager: 'Kate Morrison',
    phone: '+44 1273 555 0210',
    email: 'coastal@kiteline.uk',
    opened: '2018',
    lastInspection: new Date(Date.now() - 22 * 864e5).toISOString().slice(0, 10),
    status: 'Active',
  },
  {
    id: 'site_highland',
    name: 'Highland Lodge Hotel',
    city: 'Inverness',
    timezone: 'Europe/London',
    address: '3 Castle View Road',
    postcode: 'IV2 3EG',
    country: 'UK',
    type: 'Hotel',
    covers: 95,
    rating: 4,
    manager: 'Angus MacLeod',
    phone: '+44 1463 555 0220',
    email: 'highland@kiteline.uk',
    opened: '2017',
    lastInspection: new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10),
    status: 'Active',
  },
];

const PILOT_CLONE = [
  { key: 'checklists', siteKey: 'site' },
  { key: 'records', siteKey: 'site' },
  { key: 'alerts', siteKey: 'site' },
  { key: 'menus', siteKey: 'site' },
  { key: 'labels', siteKey: 'site' },
  { key: 'waste', siteKey: 'site' },
  { key: 'assets', siteKey: 'site' },
  { key: 'batches', siteKey: 'site' },
  { key: 'cooling', siteKey: 'site' },
  { key: 'phlogs', siteKey: 'site' },
  { key: 'holding', siteKey: 'site' },
  { key: 'deliveries', siteKey: 'site' },
  { key: 'incidents', siteKey: 'site' },
  { key: 'maintenance', siteKey: 'site' },
  { key: 'workflows', siteKey: 'site' },
];

const PILOT_CONFIG = [
  {
    id: 'site_vedanta',
    assigneeMap: { u_sarah: 'u_ved_chef', u_james: 'u_ved_sous', u_marco: 'u_ved_kp', u_amy: 'u_ved_comp' },
  },
  {
    id: 'site_govindas',
    assigneeMap: { u_sarah: 'u_gov_chef', u_james: 'u_gov_prep', u_marco: 'u_gov_kp', u_lena: 'u_gov_prep' },
  },
];

function mkSensor(id, name, type, target, min, max, siteId, temp, extra) {
  const hist = Array.from({ length: 24 }, (_, i) => +(temp + (Math.sin(i / 3) * 0.3) + (Math.random() * 0.4 - 0.2)).toFixed(1));
  return Object.assign({
    id, name, type, target, min, max, siteId, temp,
    location: 'Main kitchen',
    zone: 'Cold store',
    serial: 'KL-' + id.replace('s', 'SN') + '-2025',
    gateway: 'GW-' + siteId.replace('site_', '').toUpperCase(),
    probe: 'LoRaWAN PT100 probe',
    interval: '5 min',
    battery: 70 + Math.floor(Math.random() * 25),
    signal: 80 + Math.floor(Math.random() * 18),
    updated: new Date().toISOString(),
    history: hist,
  }, extra || {});
}

const EXTRA_SENSORS = [
  mkSensor('s_v1', 'The Ve Fridge 1', 'fridge', 4, 1, 5, 'site_vedanta', 3.2, { location: 'Main prep', zone: 'Chilled' }),
  mkSensor('s_v2', 'The Ve Fridge 2', 'fridge', 4, 1, 5, 'site_vedanta', 4.1, { location: 'Salad bar', zone: 'Produce' }),
  mkSensor('s_v3', 'The Ve Freezer 1', 'freezer', -18, -22, -16, 'site_vedanta', -18.4, { location: 'Cold store', zone: 'Frozen' }),
  mkSensor('s_v4', 'The Ve Hot Hold', 'hot', 70, 63, 90, 'site_vedanta', 71.2, { location: 'Service line', zone: 'Hot hold' }),
  mkSensor('s_v5', 'The Ve Blast Chiller', 'fridge', 3, 0, 5, 'site_vedanta', 2.6, { location: 'Prep', zone: 'Cooling CCP' }),
  mkSensor('s_g1', 'Govindas Walk-in Fridge', 'fridge', 4, 1, 5, 'site_govindas', 3.5, { location: 'Central kitchen', zone: 'Chilled' }),
  mkSensor('s_g2', 'Govindas Prep Fridge', 'fridge', 4, 1, 5, 'site_govindas', 3.9, { location: 'Vegetable prep', zone: 'Produce' }),
  mkSensor('s_g3', 'Govindas Freezer', 'freezer', -18, -22, -16, 'site_govindas', -19.0, { location: 'Stores', zone: 'Frozen' }),
  mkSensor('s_g4', 'Govindas Hot Hold', 'hot', 70, 63, 90, 'site_govindas', 73.1, { location: 'Dispatch', zone: 'Hot hold' }),
  mkSensor('s27', 'Regent Main Fridge', 'fridge', 4, 1, 5, 'site_regent', 3.6, { location: 'Hotel kitchen', zone: 'Main fridge' }),
  mkSensor('s28', 'Manor Park Freezer', 'freezer', -18, -22, -16, 'site_manor', -17.8, { location: 'Basement', zone: 'Frozen' }),
  mkSensor('s29', 'Coastal Bay Fridge', 'fridge', 4, 1, 5, 'site_coastal', 3.9, { location: 'Seafront kitchen', zone: 'Prep' }),
  mkSensor('s30', 'Highland Lodge Fridge', 'fridge', 4, 1, 5, 'site_highland', 3.3, { location: 'Main kitchen', zone: 'Chilled' }),
];

const EXTRA_TEAM = [
  { id: 'u_ved_chef', name: 'Priya Mehta', role: 'Head Chef', email: 'chef@vedantaway.demo', phone: '+44 7700 900101', siteId: 'site_vedanta', initials: 'PM', access: 'Manager', clockPin: '1111' },
  { id: 'u_ved_sous', name: 'James Okafor', role: 'Sous Chef', email: 'sous@vedantaway.demo', phone: '+44 7700 900102', siteId: 'site_vedanta', initials: 'JO', access: 'Staff', clockPin: '2222' },
  { id: 'u_ved_kp', name: 'Marco Rossi', role: 'Kitchen Porter', email: 'kp@vedantaway.demo', phone: '+44 7700 900103', siteId: 'site_vedanta', initials: 'MR', access: 'Staff', clockPin: '3333' },
  { id: 'u_ved_comp', name: 'Amy Chen', role: 'Compliance Lead', email: 'compliance@vedantaway.demo', phone: '+44 7700 900104', siteId: 'site_vedanta', initials: 'AC', access: 'Manager', clockPin: '4444' },
  { id: 'u_gov_mgr', name: 'Anita Sharma', role: 'Operations Director', email: 'anita@govindas.demo', phone: '+44 7700 900201', siteId: 'site_govindas', initials: 'AS', access: 'Admin', clockPin: '5555' },
  { id: 'u_gov_chef', name: 'Ravi Patel', role: 'Head Chef', email: 'ravi@govindas.demo', phone: '+44 7700 900202', siteId: 'site_govindas', initials: 'RP', access: 'Manager', clockPin: '6666' },
  { id: 'u_gov_prep', name: 'Lena Park', role: 'Prep Lead', email: 'prep@govindas.demo', phone: '+44 7700 900203', siteId: 'site_govindas', initials: 'LP', access: 'Staff', clockPin: '7777' },
  { id: 'u_gov_kp', name: 'Tom Hughes', role: 'Kitchen Porter', email: 'kp@govindas.demo', phone: '+44 7700 900204', siteId: 'site_govindas', initials: 'TH', access: 'Staff', clockPin: '8888' },
  { id: 'u_helen', name: 'Helen Croft', role: 'Head Chef', email: 'helen@kiteline.uk', siteId: 'site_regent', initials: 'HC', access: 'Manager' },
  { id: 'u_gordon', name: 'Gordon Reid', role: 'Executive Chef', email: 'gordon@kiteline.uk', siteId: 'site_manor', initials: 'GR', access: 'Manager' },
  { id: 'u_kate', name: 'Kate Morrison', role: 'Kitchen Manager', email: 'kate@kiteline.uk', siteId: 'site_coastal', initials: 'KM', access: 'Manager' },
  { id: 'u_angus', name: 'Angus MacLeod', role: 'Head Chef', email: 'angus@kiteline.uk', siteId: 'site_highland', initials: 'AM', access: 'Manager' },
];

function newId(prefix) {
  return prefix + '_' + crypto.randomBytes(4).toString('hex');
}

function remapPerson(row, map) {
  ['assignee', 'by', 'person', 'reportedBy'].forEach((f) => {
    if (row[f] && map[row[f]]) row[f] = map[row[f]];
  });
}

function pilotScore(state, siteId) {
  let n = 0;
  PILOT_CLONE.forEach(({ key, siteKey }) => {
    n += (state[key] || []).filter((r) => r[siteKey] === siteId).length;
  });
  n += (state.recipes || []).filter((r) => r.site === siteId).length;
  return n;
}

function cloneRecipesForSite(recipes, fromSite, toSite, limit) {
  const src = recipes.filter((r) => r.site === fromSite).slice(0, limit);
  return src.map((r) => {
    const copy = JSON.parse(JSON.stringify(r));
    copy.id = newId('r');
    copy.site = toSite;
    return copy;
  });
}

function clonePilotPack(state, fromSite, pilot) {
  const toSite = pilot.id;
  const map = pilot.assigneeMap || {};
  let changed = false;
  PILOT_CLONE.forEach(({ key, siteKey }) => {
    state[key] = state[key] || [];
    const have = state[key].filter((r) => r[siteKey] === toSite).length;
    if (have >= 5) return;
    state[key].filter((r) => r[siteKey] === fromSite).forEach((row) => {
      const c = JSON.parse(JSON.stringify(row));
      c.id = newId(key.slice(0, 2));
      c[siteKey] = toSite;
      remapPerson(c, map);
      state[key].push(c);
      changed = true;
    });
  });
  const recipeCount = (state.recipes || []).filter((r) => r.site === toSite).length;
  if (recipeCount < 30 && (state.recipes || []).some((r) => r.site === fromSite)) {
    const clones = cloneRecipesForSite(state.recipes, fromSite, toSite, 100);
    state.recipes.push(...clones);
    changed = true;
  }
  return changed;
}

function mergeExtraSites(state) {
  if (!state) return false;
  let changed = false;
  state.sites = state.sites || [];
  state.sensors = state.sensors || [];
  state.team = state.team || [];
  state.recipes = state.recipes || [];

  EXTRA_SITES.forEach((site) => {
    const existing = state.sites.find((s) => s.id === site.id);
    if (!existing) {
      state.sites.push(JSON.parse(JSON.stringify(site)));
      changed = true;
    } else if (site.pilot) {
      Object.assign(existing, JSON.parse(JSON.stringify(site)));
      changed = true;
    }
  });

  state.sensors = state.sensors.filter((s) => !['s23', 's24', 's25', 's26'].includes(s.id));

  EXTRA_SENSORS.forEach((sensor) => {
    const idx = state.sensors.findIndex((s) => s.id === sensor.id);
    if (idx < 0) {
      state.sensors.push(sensor);
      changed = true;
    } else if (sensor.siteId === 'site_vedanta' || sensor.siteId === 'site_govindas') {
      Object.assign(state.sensors[idx], sensor);
      changed = true;
    }
  });

  EXTRA_TEAM.forEach((member) => {
    const existing = state.team.find((m) => m.id === member.id);
    if (!existing) {
      state.team.push(member);
      changed = true;
    } else if (member.siteId === 'site_vedanta' || member.siteId === 'site_govindas') {
      Object.assign(existing, member);
      changed = true;
    }
  });

  const shyam = state.team.find((m) => (m.email || '').toLowerCase() === 'shyam_1@hotmail.co.uk');
  if (shyam && state.sites.some((s) => s.id === 'site_vedanta')) {
    shyam.siteId = 'site_vedanta';
    shyam.role = 'Owner & Director';
    shyam.access = 'Admin';
    if (!shyam.clockPin) shyam.clockPin = '1001';
    changed = true;
  }

  const from = 'site_grove';
  if (state.sites.some((s) => s.id === from)) {
    PILOT_CONFIG.forEach((pilot) => {
      if (pilotScore(state, pilot.id) < 40) {
        if (clonePilotPack(state, from, pilot)) changed = true;
      }
    });
  }

  if (state._pilotPackVersion !== PILOT_PACK_VERSION) {
    state._pilotPackVersion = PILOT_PACK_VERSION;
    state._pilotSites = PILOT_CONFIG.map((p) => p.id);
    changed = true;
  }

  return changed;
}

module.exports = { EXTRA_SITES, mergeExtraSites };
