'use strict';

const crypto = require('crypto');

const EXTRA_SITES = [
  {
    id: 'site_vedanta',
    name: 'Vedanta Kitchen',
    legalName: 'Vedanta Way Ltd',
    city: 'London',
    timezone: 'Europe/London',
    address: 'Vedanta Way',
    postcode: '—',
    country: 'UK',
    type: 'Kitchen',
    covers: 80,
    rating: 5,
    manager: 'Shyam Prasad',
    phone: '',
    email: 'shyam_1@hotmail.co.uk',
    opened: '2024',
    lastInspection: new Date().toISOString().slice(0, 10),
    status: 'Active',
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
  mkSensor('s23', 'Walk-in Fridge — Vedanta', 'fridge', 4, 1, 5, 'site_vedanta', 3.4, { location: 'Vedanta Kitchen', zone: 'Main cold store', notes: 'Vedanta Way Ltd — primary fridge' }),
  mkSensor('s24', 'Prep Fridge — Vedanta', 'fridge', 4, 1, 5, 'site_vedanta', 4.0, { location: 'Prep line', zone: 'Daily prep' }),
  mkSensor('s25', 'Freezer — Vedanta', 'freezer', -18, -22, -16, 'site_vedanta', -18.2, { location: 'Cold store', zone: 'Frozen' }),
  mkSensor('s26', 'Hot Hold — Vedanta', 'hot', 70, 63, 90, 'site_vedanta', 72.5, { location: 'Service', zone: 'Hot hold' }),
  mkSensor('s27', 'Regent Main Fridge', 'fridge', 4, 1, 5, 'site_regent', 3.6, { location: 'Hotel kitchen', zone: 'Main fridge' }),
  mkSensor('s28', 'Manor Park Freezer', 'freezer', -18, -22, -16, 'site_manor', -17.8, { location: 'Basement', zone: 'Frozen' }),
  mkSensor('s29', 'Coastal Bay Fridge', 'fridge', 4, 1, 5, 'site_coastal', 3.9, { location: 'Seafront kitchen', zone: 'Prep' }),
  mkSensor('s30', 'Highland Lodge Fridge', 'fridge', 4, 1, 5, 'site_highland', 3.3, { location: 'Main kitchen', zone: 'Chilled' }),
];

const EXTRA_TEAM = [
  { id: 'u_vedanta_mgr', name: 'Shyam Prasad', role: 'Owner — Vedanta Way Ltd', email: 'shyam_1@hotmail.co.uk', phone: '', siteId: 'site_vedanta', initials: 'SP', access: 'Admin' },
  { id: 'u_helen', name: 'Helen Croft', role: 'Head Chef', email: 'helen@kiteline.uk', siteId: 'site_regent', initials: 'HC', access: 'Manager' },
  { id: 'u_gordon', name: 'Gordon Reid', role: 'Executive Chef', email: 'gordon@kiteline.uk', siteId: 'site_manor', initials: 'GR', access: 'Manager' },
  { id: 'u_kate', name: 'Kate Morrison', role: 'Kitchen Manager', email: 'kate@kiteline.uk', siteId: 'site_coastal', initials: 'KM', access: 'Manager' },
  { id: 'u_angus', name: 'Angus MacLeod', role: 'Head Chef', email: 'angus@kiteline.uk', siteId: 'site_highland', initials: 'AM', access: 'Manager' },
];

function cloneRecipesForSite(recipes, fromSite, toSite, limit) {
  const src = recipes.filter((r) => r.site === fromSite).slice(0, limit);
  return src.map((r) => {
    const copy = JSON.parse(JSON.stringify(r));
    copy.id = 'r_' + crypto.randomBytes(4).toString('hex');
    copy.site = toSite;
    return copy;
  });
}

function mergeExtraSites(state) {
  if (!state) return false;
  let changed = false;
  state.sites = state.sites || [];
  state.sensors = state.sensors || [];
  state.team = state.team || [];
  state.recipes = state.recipes || [];

  EXTRA_SITES.forEach((site) => {
    if (!state.sites.some((s) => s.id === site.id)) {
      state.sites.push(JSON.parse(JSON.stringify(site)));
      changed = true;
    }
  });

  EXTRA_SENSORS.forEach((sensor) => {
    if (!state.sensors.some((s) => s.id === sensor.id)) {
      state.sensors.push(sensor);
      changed = true;
    }
  });

  EXTRA_TEAM.forEach((member) => {
    const existing = state.team.find((m) => m.id === member.id || (m.email && m.email === member.email && m.siteId === member.siteId));
    if (!existing) {
      state.team.push(member);
      changed = true;
    }
  });

  // Link owner Shyam to Vedanta Kitchen if still only on Grove
  const shyam = state.team.find((m) => (m.email || '').toLowerCase() === 'shyam_1@hotmail.co.uk');
  if (shyam && shyam.siteId === 'site_grove' && state.sites.some((s) => s.id === 'site_vedanta')) {
    shyam.siteId = 'site_vedanta';
    shyam.role = 'Owner — Vedanta Way Ltd';
    changed = true;
  }

  const vedantaRecipes = state.recipes.filter((r) => r.site === 'site_vedanta').length;
  if (vedantaRecipes < 20 && state.recipes.some((r) => r.site === 'site_grove')) {
    const clones = cloneRecipesForSite(state.recipes, 'site_grove', 'site_vedanta', 25);
    state.recipes.push(...clones);
    changed = true;
  }

  const vedanta = state.sites.find((s) => s.id === 'site_vedanta');
  if (vedanta) {
    if (vedanta.legalName === 'Vedant Way Ltd' || !vedanta.legalName) {
      vedanta.legalName = 'Vedanta Way Ltd';
      changed = true;
    }
    if (vedanta.address === 'Vedant Way') vedanta.address = 'Vedanta Way';
  }
  state.team.forEach((m) => {
    if ((m.role || '').includes('Vedant Way Ltd')) {
      m.role = m.role.replace('Vedant Way Ltd', 'Vedanta Way Ltd');
      changed = true;
    }
  });

  return changed;
}

module.exports = { EXTRA_SITES, mergeExtraSites };
