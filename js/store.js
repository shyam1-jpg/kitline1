/* ============================================================
   Kitchen OS — Data Store
   Single source of truth. Persists to localStorage.
   No backend required (all client-side, mock + simulated IoT).
   ============================================================ */
(function () {
  const KEY = 'kiteline.db.v8';
  const SESSION = 'kiteline.session.v1';
  const SITE_ORIGIN = 'https://kiteline.uk';

  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
  const now = () => new Date().toISOString();
  const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
  const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();

  // The 14 statutory allergens (EU/UK Natasha's Law)
  const ALLERGENS = [
    'Celery','Cereals containing gluten','Crustaceans','Eggs','Fish','Lupin',
    'Milk','Molluscs','Mustard','Peanuts','Sesame','Soybeans',
    'Sulphur dioxide & sulphites','Tree nuts'
  ];

  function seedWorkflows(site) {
    const mk = (category, label, assignee, status, route, opts = {}) => {
      const h = opts.hoursAgo != null ? opts.hoursAgo : 1;
      const dueH = opts.dueHours != null ? opts.dueHours : (status === 'overdue' ? -2 : status === 'scheduled' ? 4 : 2);
      return {
        id: uid('wf'), site, category, label, status, assignee, route: route || null,
        dueAt: new Date(Date.now() + dueH * 36e5).toISOString(),
        startedAt: (status === 'in_progress' || status === 'completed') ? hoursAgo(Math.max(0.15, h * 0.5)) : null,
        completedAt: status === 'completed' ? hoursAgo(h) : null,
        updatedAt: hoursAgo(Math.random() * 0.5),
      };
    };
    const rows = [
      // Supplier Management
      ['Supplier Management','suppliers','Supplier order placed','u_sarah','completed',6],
      ['Supplier Management','suppliers','Supplier order received','u_james','in_progress',0.4],
      ['Supplier Management','suppliers','Invoice uploaded','u_sarah','completed',4.5],
      ['Supplier Management','suppliers','Invoice approved','u_sarah','overdue',8],
      ['Supplier Management','suppliers','Delivery checked','u_james','completed',3],
      ['Supplier Management','suppliers','Stock entered into system','u_james','in_progress',0.6],
      ['Supplier Management','suppliers','Quality check completed','u_sarah','scheduled',null],
      ['Supplier Management','suppliers','Credit note requested','u_sarah','overdue',10],
      ['Supplier Management','suppliers','New supplier added','u_sarah','completed',48],
      ['Supplier Management','suppliers','Supplier performance reviewed','u_sarah','scheduled',null],
      // Food Preparation
      ['Food Preparation','recipes','Prep list created','u_sarah','completed',5],
      ['Food Preparation','recipes','Vegetables being prepared','u_james','in_progress',0.3],
      ['Food Preparation','recipes','Soup production in progress','u_james','in_progress',0.5],
      ['Food Preparation','batches','Dessert production in progress','u_james','in_progress',0.7],
      ['Food Preparation','batches','Batch cooking completed','u_sarah','completed',2],
      ['Food Preparation','recipes','Recipe scaling completed','u_sarah','completed',3.5],
      ['Food Preparation','labels','Food cooled and labelled','u_james','in_progress',0.2],
      ['Food Preparation','batches','Food transferred to storage','u_james','scheduled',null],
      ['Food Preparation','batches','Production completed','u_sarah','scheduled',null],
      ['Food Preparation','holding','Ready for service','u_sarah','scheduled',null],
      // Fridge & Freezer Logs
      ['Fridge & Freezer Logs','temps','Fridge temperature recorded','u_james','completed',1],
      ['Fridge & Freezer Logs','temps','Freezer temperature recorded','u_james','completed',1.2],
      ['Fridge & Freezer Logs','temps','Temperature out-of-range alert','u_sarah','in_progress',0.1],
      ['Fridge & Freezer Logs','temps','Corrective action completed','u_sarah','completed',0.8],
      ['Fridge & Freezer Logs','haccp','Cleaning completed','u_james','completed',2],
      ['Fridge & Freezer Logs','maintenance','Maintenance reported','u_sarah','scheduled',null],
      ['Fridge & Freezer Logs','maintenance','Maintenance completed','u_james','completed',72],
      ['Fridge & Freezer Logs','temps','Stock rotation completed','u_james','completed',4],
      ['Fridge & Freezer Logs','labels','Expiry check completed','u_james','in_progress',0.4],
      ['Fridge & Freezer Logs','haccp','Daily log signed off','u_sarah','scheduled',null],
      // Health & Safety
      ['Health & Safety','haccp','Opening checks completed','u_james','completed',6],
      ['Health & Safety','haccp','Fire safety check completed','u_james','completed',5.5],
      ['Health & Safety','haccp','Equipment safety check completed','u_james','in_progress',0.5],
      ['Health & Safety','incidents','Accident reported','u_james','completed',120],
      ['Health & Safety','incidents','Corrective action completed','u_sarah','completed',48],
      ['Health & Safety','haccp','COSHH check completed','u_james','completed',3],
      ['Health & Safety','haccp','Pest control check completed','u_sarah','overdue',26],
      ['Health & Safety','haccp','Kitchen deep clean completed','u_james','scheduled',null],
      ['Health & Safety','haccp','Closing checks completed','u_sarah','scheduled',null],
      ['Health & Safety','haccp','Manager sign-off completed','u_sarah','scheduled',null],
      // HACCP & Compliance
      ['HACCP & Compliance','deliveries','Delivery temperature check','u_james','completed',3],
      ['HACCP & Compliance','records','Cooking temperature recorded','u_sarah','completed',2],
      ['HACCP & Compliance','cooling','Cooling temperature recorded','u_james','completed',5],
      ['HACCP & Compliance','holding','Hot holding temperature recorded','u_james','in_progress',0.3],
      ['HACCP & Compliance','allerq','Allergen check completed','u_sarah','completed',4],
      ['HACCP & Compliance','labels','Labelling completed','u_james','in_progress',0.5],
      ['HACCP & Compliance','waste','Food waste recorded','u_james','completed',1.5],
      ['HACCP & Compliance','haccp','Daily HACCP review completed','u_sarah','overdue',30],
      ['HACCP & Compliance','reports','Audit completed','u_sarah','scheduled',null],
      ['HACCP & Compliance','reports','Compliance report generated','u_sarah','scheduled',null],
    ];
    const base = rows.map(([cat, route, label, who, st, h]) => {
      const opts = {};
      if (h != null) opts.hoursAgo = h;
      if (st === 'scheduled') opts.dueHours = 2 + Math.random() * 6;
      if (st === 'overdue') opts.dueHours = -1 - Math.random() * 4;
      return mk(cat, label, who, st, route, opts);
    });
    // Pages 2–10: 9 extra pages × 10 items = 90 more (100 total = 10 pages of 10)
    const teamIds = ['u_sarah','u_james','u_lena','u_marco','u_amy'];
    const statuses = ['completed','in_progress','scheduled','overdue'];
    const cats = [
      ['Supplier Management','suppliers'],['Food Preparation','recipes'],['Fridge & Freezer Logs','temps'],
      ['Health & Safety','haccp'],['HACCP & Compliance','records'],
    ];
    const extra = [];
    for (let page = 2; page <= 10; page++) {
      for (let slot = 0; slot < 10; slot++) {
        const [cat, route] = cats[slot % cats.length];
        const ref = base[slot % base.length];
        const st = statuses[(page + slot) % statuses.length];
        const who = teamIds[(page + slot) % teamIds.length];
        extra.push(mk(cat, `${ref.label} — log ${page}.${slot + 1}`, who, st, route, {
          hoursAgo: st === 'completed' ? page * 0.7 + slot * 0.1 : 0.15 + slot * 0.05,
          dueHours: st === 'scheduled' ? page + slot * 0.3 : st === 'overdue' ? -page * 0.4 : 2,
        }));
      }
    }
    return base.concat(extra);
  }

  function seed() {
    const sites = [
      { id:'site_grove', name:'The Grove Hotel', city:'London', timezone:'Europe/London', address:'14 Park Lane', postcode:'W1K 1BE', country:'UK', type:'Hotel', covers:180, rating:5, manager:'Sarah Mitchell', phone:'+44 20 7123 4500', email:'grove@kiteline.uk', opened:'2016', lastInspection:daysAgo(45).slice(0,10), status:'Active' },
      { id:'site_dock', name:'Dockside Bistro', city:'Manchester', timezone:'Europe/London', address:'22 Salford Quays', postcode:'M50 3AZ', country:'UK', type:'Restaurant', covers:85, rating:5, manager:'Lena Park', phone:'+44 161 555 0192', email:'dock@kiteline.uk', opened:'2019', lastInspection:daysAgo(62).slice(0,10), status:'Active' },
      { id:'site_quay', name:'Harbour Quay Kitchen', city:'Bristol', timezone:'Europe/London', address:'8 Harbourside Walk', postcode:'BS1 5UH', country:'UK', type:'Restaurant', covers:120, rating:4, manager:'Amy Chen', phone:'+44 117 555 0144', email:'quay@kiteline.uk', opened:'2018', lastInspection:daysAgo(28).slice(0,10), status:'Active' },
      { id:'site_apex', name:'Apex Steakhouse', city:'Birmingham', timezone:'Europe/London', address:'101 Colmore Row', postcode:'B3 2BJ', country:'UK', type:'Steakhouse', covers:95, rating:5, manager:'David Okonkwo', phone:'+44 121 555 0177', email:'apex@kiteline.uk', opened:'2020', lastInspection:daysAgo(90).slice(0,10), status:'Active' },
      { id:'site_crown', name:'Crown & Anchor Pub', city:'Leeds', timezone:'Europe/London', address:'44 Briggate', postcode:'LS1 6HD', country:'UK', type:'Pub', covers:60, rating:4, manager:'Fiona Walsh', phone:'+44 113 555 0166', email:'crown@kiteline.uk', opened:'2015', lastInspection:daysAgo(120).slice(0,10), status:'Active' },
      { id:'site_river', name:'Riverside Café', city:'Cardiff', timezone:'Europe/London', address:'3 Cardiff Bay', postcode:'CF10 5AL', country:'UK', type:'Café', covers:45, rating:5, manager:'Tom Hughes', phone:'+44 29 555 0133', email:'river@kiteline.uk', opened:'2021', lastInspection:daysAgo(55).slice(0,10), status:'Active' },
      { id:'site_studio', name:'Studio Kitchen (Ghost)', city:'London', timezone:'Europe/London', address:'Unit 7, Park Royal Estate', postcode:'NW10 7LQ', country:'UK', type:'Ghost Kitchen', covers:0, rating:5, manager:'Priya Sharma', phone:'+44 20 555 0188', email:'studio@kiteline.uk', opened:'2022', lastInspection:daysAgo(40).slice(0,10), status:'Active' },
      { id:'site_academy', name:'Culinary Academy Kitchen', city:'Edinburgh', timezone:'Europe/London', address:'12 Lauriston Place', postcode:'EH3 9DF', country:'UK', type:'Education', covers:40, rating:5, manager:'Ewan Fraser', phone:'+44 131 555 0155', email:'academy@kiteline.uk', opened:'2017', lastInspection:daysAgo(75).slice(0,10), status:'Active' },
      { id:'site_marina', name:'Marina Fish & Grill', city:'Brighton', timezone:'Europe/London', address:'27 Madeira Drive', postcode:'BN2 1EN', country:'UK', type:'Seafood', covers:70, rating:4, manager:'Nina Kostova', phone:'+44 1273 555 0122', email:'marina@kiteline.uk', opened:'2019', lastInspection:daysAgo(33).slice(0,10), status:'Seasonal' },
      { id:'site_heathrow', name:'Terminal 3 Food Court', city:'Hounslow', timezone:'Europe/London', address:'Heathrow T3, Inner Ring E', postcode:'TW6 1QG', country:'UK', type:'Food Court', covers:220, rating:5, manager:'Raj Patel', phone:'+44 20 555 0199', email:'t3@kiteline.uk', opened:'2014', lastInspection:daysAgo(18).slice(0,10), status:'Active' },
      { id:'site_vedanta', name:'Vedanta Kitchen', legalName:'Vedanta Way Ltd', city:'London', timezone:'Europe/London', address:'Vedanta Way', postcode:'—', country:'UK', type:'Kitchen', covers:80, rating:5, manager:'Shyam Prasad', phone:'', email:'shyam_1@hotmail.co.uk', opened:'2024', lastInspection:daysAgo(10).slice(0,10), status:'Active' },
      { id:'site_regent', name:'The Regent Hotel', city:'London', timezone:'Europe/London', address:'88 Regent Street', postcode:'W1B 5RS', country:'UK', type:'Hotel', covers:200, rating:5, manager:'Helen Croft', phone:'+44 20 7123 4600', email:'regent@kiteline.uk', opened:'2012', lastInspection:daysAgo(35).slice(0,10), status:'Active' },
      { id:'site_manor', name:'Manor Park Hotel', city:'Edinburgh', timezone:'Europe/London', address:'12 Manor Park Gardens', postcode:'EH12 5BF', country:'UK', type:'Hotel', covers:140, rating:4, manager:'Gordon Reid', phone:'+44 131 555 0201', email:'manor@kiteline.uk', opened:'2015', lastInspection:daysAgo(50).slice(0,10), status:'Active' },
      { id:'site_coastal', name:'Coastal Bay Hotel', city:'Brighton', timezone:'Europe/London', address:'5 Seafront Parade', postcode:'BN1 2FJ', country:'UK', type:'Hotel', covers:110, rating:5, manager:'Kate Morrison', phone:'+44 1273 555 0210', email:'coastal@kiteline.uk', opened:'2018', lastInspection:daysAgo(22).slice(0,10), status:'Active' },
      { id:'site_highland', name:'Highland Lodge Hotel', city:'Inverness', timezone:'Europe/London', address:'3 Castle View Road', postcode:'IV2 3EG', country:'UK', type:'Hotel', covers:95, rating:4, manager:'Angus MacLeod', phone:'+44 1463 555 0220', email:'highland@kiteline.uk', opened:'2017', lastInspection:daysAgo(40).slice(0,10), status:'Active' },
    ];

    const team = [
      { id:'u_shyam', name:'Shyam Prasad', role:'Owner — Vedanta Way Ltd', email:'shyam_1@hotmail.co.uk', phone:'', siteId:'site_vedanta', initials:'SP', access:'Admin' },
      { id:'u_sarah', name:'Sarah Mitchell', role:'Head Chef', email:'sarah@kiteline.uk', siteId:'site_grove', initials:'SM', access:'Admin' },
      { id:'u_james', name:'James Okafor', role:'Sous Chef', email:'james@kiteline.uk', siteId:'site_grove', initials:'JO', access:'Staff' },
      { id:'u_lena', name:'Lena Park', role:'Kitchen Manager', email:'lena@kiteline.uk', siteId:'site_dock', initials:'LP', access:'Manager' },
      { id:'u_marco', name:'Marco Rossi', role:'Chef de Partie', email:'marco@kiteline.uk', siteId:'site_dock', initials:'MR', access:'Staff' },
      { id:'u_amy', name:'Amy Chen', role:'Compliance Lead', email:'amy@kiteline.uk', siteId:'site_quay', initials:'AC', access:'Manager' },
      { id:'u_david', name:'David Okonkwo', role:'Head Chef', email:'david@kiteline.uk', siteId:'site_apex', initials:'DO', access:'Manager' },
      { id:'u_fiona', name:'Fiona Walsh', role:'Pub Manager', email:'fiona@kiteline.uk', siteId:'site_crown', initials:'FW', access:'Manager' },
      { id:'u_tom', name:'Tom Hughes', role:'Head Barista', email:'tom@kiteline.uk', siteId:'site_river', initials:'TH', access:'Staff' },
      { id:'u_priya', name:'Priya Sharma', role:'Ops Lead', email:'priya@kiteline.uk', siteId:'site_studio', initials:'PS', access:'Manager' },
      { id:'u_ewan', name:'Ewan Fraser', role:'Training Chef', email:'ewan@kiteline.uk', siteId:'site_academy', initials:'EF', access:'Manager' },
      { id:'u_nina', name:'Nina Kostova', role:'Head Chef', email:'nina@kiteline.uk', siteId:'site_marina', initials:'NK', access:'Manager' },
      { id:'u_raj', name:'Raj Patel', role:'Food Court Manager', email:'raj@kiteline.uk', siteId:'site_heathrow', initials:'RP', access:'Manager' },
    ];

    // LoRaWAN sensors — rich metadata for audit-grade monitoring
    const mk = (id, name, type, target, min, max, siteId, temp, x = {}) => {
      const hist = Array.from({ length: 24 }, (_, i) => +(temp + (Math.sin(i / 3) * 0.4) + (Math.random() * 0.6 - 0.3)).toFixed(1));
      return {
        id, name, type, target, min, max, siteId, temp,
        location: x.location || 'Main kitchen',
        zone: x.zone || 'Cold store',
        serial: x.serial || ('KL-' + id.replace('s', 'SN') + '-2024'),
        gateway: x.gateway || ('GW-' + siteId.replace('site_', '').toUpperCase()),
        probe: x.probe || 'LoRaWAN PT100 probe',
        interval: x.interval || '5 min',
        humidity: x.humidity,
        doorOpen: !!x.doorOpen,
        calibrated: x.calibrated || daysAgo(28 + Math.floor(Math.random() * 60)).slice(0, 10),
        standard: x.standard || (type === 'hot' ? '≥63°C hot hold (UK)' : type === 'freezer' ? '≤-18°C frozen storage' : '0–5°C chilled (EC 852/2004)'),
        notes: x.notes || '',
        battery: x.battery != null ? x.battery : 68 + Math.floor(Math.random() * 32),
        signal: x.signal != null ? x.signal : 78 + Math.floor(Math.random() * 22),
        updated: hoursAgo(Math.random() * 0.3),
        history: hist,
      };
    };

    const sensors = [
      // The Grove Hotel — 10 sensors (full demo kitchen)
      mk('s1','Walk-in Fridge 1 — Proteins','fridge', 4, 1, 5, 'site_grove', 3.2, { location:'Basement cold store', zone:'Protein store', serial:'KL-SN001-2024', humidity:72, notes:'Primary protein walk-in — daily stock rotation' }),
      mk('s2','Walk-in Fridge 2 — Produce','fridge', 4, 1, 5, 'site_grove', 3.8, { location:'Basement cold store', zone:'Produce', serial:'KL-SN002-2024', humidity:78, notes:'Salad, veg & dairy — separate from raw protein' }),
      mk('s3','Freezer A — Main','freezer', -18, -22, -16, 'site_grove', -18.6, { location:'Basement cold store', zone:'Frozen proteins', serial:'KL-SN003-2024', notes:'Core temp log every 4h during service' }),
      mk('s4','Freezer B — Desserts','freezer', -18, -22, -16, 'site_grove', -19.1, { location:'Pastry section', zone:'Desserts & ice cream', serial:'KL-SN004-2024' }),
      mk('s5','Prep Fridge — Hot Line','fridge', 4, 1, 5, 'site_grove', 4.8, { location:'Main kitchen pass', zone:'Hot section prep', serial:'KL-SN005-2024', doorOpen:false, notes:'Near limit — check door seal after lunch service' }),
      mk('s6','Prep Fridge — Cold Line','fridge', 4, 1, 5, 'site_grove', 3.4, { location:'Main kitchen pass', zone:'Cold section prep', serial:'KL-SN006-2024' }),
      mk('s7','Hot Hold — Bain-Marie','hot', 70, 63, 90, 'site_grove', 74.2, { location:'Service line', zone:'Hot hold', serial:'KL-SN007-2024', probe:'IR + probe verify', standard:'≥63°C for 2 min (hot holding)' }),
      mk('s8','Hot Hold — Pass-through','hot', 70, 63, 90, 'site_grove', 71.8, { location:'Pass', zone:'Expedite', serial:'KL-SN008-2024' }),
      mk('s9','Blast Chiller','fridge', 3, 0, 5, 'site_grove', 2.1, { location:'Prep kitchen', zone:'Cooling CCP', serial:'KL-SN009-2024', standard:'≤5°C within 90 min (cooling CCP)', notes:'Linked to cooling log module' }),
      mk('s10','Display Fridge — Pastry','fridge', 4, 1, 5, 'site_grove', 4.1, { location:'Pastry display', zone:'Customer-facing', serial:'KL-SN010-2024', humidity:65 }),
      // Other sites — distributed monitoring
      mk('s11','Dessert Fridge','fridge', 4, 1, 5, 'site_dock', 3.1, { location:'Pastry', zone:'Desserts' }),
      mk('s12','Freezer B','freezer', -18, -22, -16, 'site_dock', -17.2, { location:'Cold store', zone:'Frozen' }),
      mk('s13','Bar Fridge','fridge', 4, 1, 5, 'site_quay', 5.6, { location:'Bar', zone:'Beverages', doorOpen:true, notes:'Door alarm triggered 12 min ago — engineer notified' }),
      mk('s14','Blast Chiller','fridge', 3, 0, 5, 'site_quay', 2.4, { location:'Prep', zone:'Cooling' }),
      mk('s15','Aging Fridge','fridge', 2, 0, 4, 'site_apex', 1.8, { location:'Dry-age room', zone:'Beef aging', standard:'0–4°C dry aging' }),
      mk('s16','Cellar Fridge','fridge', 4, 1, 5, 'site_crown', 3.9, { location:'Cellar', zone:'Beer & garnishes' }),
      mk('s17','Milk Fridge','fridge', 4, 1, 5, 'site_river', 3.5, { location:'Counter', zone:'Dairy' }),
      mk('s18','Brand A — Fridge','fridge', 4, 1, 5, 'site_studio', 3.0, { location:'Unit 7', zone:'Brand A prep' }),
      mk('s19','Training Fridge','fridge', 4, 1, 5, 'site_academy', 3.7, { location:'Teaching kitchen', zone:'Student prep' }),
      mk('s20','Fish Display','fridge', 2, 0, 4, 'site_marina', 2.8, { location:'Front counter', zone:'Fresh fish', standard:'0–4°C fresh fish display' }),
      mk('s21','T3 Unit 4 — Hot Hold','hot', 70, 63, 90, 'site_heathrow', 68.4, { location:'Unit 4', zone:'Hot hold', notes:'Below 63°C — corrective action logged' }),
      mk('s22','T3 Unit 7 — Fridge','fridge', 4, 1, 5, 'site_heathrow', 4.0, { location:'Unit 7', zone:'Prep' }),
      mk('s23','Walk-in Fridge — Vedanta','fridge', 4, 1, 5, 'site_vedanta', 3.4, { location:'Vedanta Kitchen', zone:'Main cold store', notes:'Vedanta Way Ltd' }),
      mk('s24','Prep Fridge — Vedanta','fridge', 4, 1, 5, 'site_vedanta', 4.0, { location:'Prep line', zone:'Daily prep' }),
      mk('s25','Freezer — Vedanta','freezer', -18, -22, -16, 'site_vedanta', -18.2, { location:'Cold store', zone:'Frozen' }),
      mk('s26','Hot Hold — Vedanta','hot', 70, 63, 90, 'site_vedanta', 72.5, { location:'Service', zone:'Hot hold' }),
      mk('s27','Regent Main Fridge','fridge', 4, 1, 5, 'site_regent', 3.6, { location:'Hotel kitchen', zone:'Main fridge' }),
      mk('s28','Manor Park Freezer','freezer', -18, -22, -16, 'site_manor', -17.8, { location:'Basement', zone:'Frozen' }),
      mk('s29','Coastal Bay Fridge','fridge', 4, 1, 5, 'site_coastal', 3.9, { location:'Seafront kitchen', zone:'Prep' }),
      mk('s30','Highland Lodge Fridge','fridge', 4, 1, 5, 'site_highland', 3.3, { location:'Main kitchen', zone:'Chilled' }),
    ];

    const clItem = (text, done, ccp) => ({ id:uid(), text, done:!!done, ccp:!!ccp });
    const checklists = [
      { id:'cl1', title:'Opening Checks — AM', site:'site_grove', recurrence:'Daily', due:'06:30', assignee:'u_james', category:'Opening', priority:'High', ccp:false, ccpRef:'', lastCompleted:hoursAgo(18).slice(0,16), signOffRequired:true,
        items:[
          clItem('CCP-1: Record all 10 fridge, freezer & hot-hold sensor readings (auto + manual verify)', true, true),
          clItem('CCP-2: Probe thermometer ice-point & boiling-point calibration check', true, true),
          clItem('Inspect overnight deliveries — temp, packaging, use-by dates', true),
          clItem('Verify allergen matrix & menu boards match today\'s service', false),
          clItem('Hand-wash stations stocked (soap, paper, sanitiser)', false),
          clItem('Visual hygiene walk-through — floors, drains, pest traps', false),
          clItem('Fire exits clear; first-aid kit sealed & in date', false),
        ]},
      { id:'cl2', title:'Closing Checks — PM', site:'site_grove', recurrence:'Daily', due:'23:00', assignee:'u_sarah', category:'Closing', priority:'High', ccp:false, lastCompleted:daysAgo(1).slice(0,16), signOffRequired:true,
        items:[
          clItem('CCP-3: All cooling records completed & signed off', false, true),
          clItem('CCP-4: Hot hold emptied or reheated above 75°C before discard', false, true),
          clItem('All prep surfaces cleaned, sanitised & air-dried', false),
          clItem('Waste logged in WasteWise; bins emptied & lids secured', false),
          clItem('Final temperature log exported to digital records', false),
          clItem('Doors & windows secured; alarm set', false),
        ]},
      { id:'cl3', title:'Weekly Deep Clean', site:'site_grove', recurrence:'Weekly', due:'Mon 10:00', assignee:'u_james', category:'Cleaning', priority:'Medium', ccp:false, lastCompleted:daysAgo(6).slice(0,16), signOffRequired:false,
        items:[
          clItem('Extraction canopy & filters degreased', true),
          clItem('Behind/under all equipment — move & clean', false),
          clItem('Descale dishwasher & check wash/rinse temps', false),
          clItem('Fridge door seals inspected & wiped', false),
          clItem('Pest control log reviewed; traps checked', false),
        ]},
      { id:'cl4', title:'Monthly HACCP Review', site:'site_grove', recurrence:'Monthly', due:'1st Mon 09:00', assignee:'u_sarah', category:'CCP', priority:'High', ccp:true, ccpRef:'HACCP-REV', lastCompleted:daysAgo(22).slice(0,16), signOffRequired:true,
        items:[
          clItem('Review all CCP logs for the past 30 days', false, true),
          clItem('Update hazard analysis if menu/process changed', false, true),
          clItem('Staff training records up to date', false),
          clItem('Supplier approvals & delivery rejections reviewed', false),
          clItem('Corrective action log — open items closed?', false),
        ]},
      { id:'cl5', title:'Delivery Acceptance CCP', site:'site_grove', recurrence:'Daily', due:'On arrival', assignee:'u_james', category:'CCP', priority:'High', ccp:true, ccpRef:'CCP-DEL', lastCompleted:hoursAgo(3).slice(0,16), signOffRequired:true,
        items:[
          clItem('Chilled goods ≤5°C at point of delivery', true, true),
          clItem('Frozen goods ≤-18°C & packaging intact', true, true),
          clItem('Use-by dates acceptable — FIFO applied', true),
          clItem('Rejections logged with reason & photo evidence', false, true),
        ]},
      { id:'cl6', title:'Opening Checks', site:'site_dock', recurrence:'Daily', due:'08:30', assignee:'u_marco', category:'Opening', priority:'High', ccp:false, lastCompleted:hoursAgo(10).slice(0,16), signOffRequired:true,
        items:[
          clItem('Record fridge & freezer temperatures', true, true),
          clItem('Check deliveries & date labels', true),
          clItem('Probe calibration check', false),
          clItem('Hand-wash stations stocked', false),
        ]},
      { id:'cl7', title:'Weekly Deep Clean', site:'site_dock', recurrence:'Weekly', due:'Wed 10:00', assignee:'u_lena', category:'Cleaning', priority:'Medium', ccp:false, lastCompleted:daysAgo(4).slice(0,16), signOffRequired:false,
        items:[
          clItem('Extraction filters degreased', true),
          clItem('Behind/under equipment cleaned', false),
          clItem('Descale dishwasher', false),
        ]},
      { id:'cl8', title:'Opening Checks', site:'site_quay', recurrence:'Daily', due:'07:30', assignee:'u_amy', category:'Opening', priority:'High', ccp:false, lastCompleted:hoursAgo(9).slice(0,16), signOffRequired:true,
        items:[
          clItem('Record all temperatures — incl. bar fridge', true, true),
          clItem('Visual hygiene walk-through', true),
          clItem('Allergen matrix up to date', false),
          clItem('First-aid & cleaning stock check', false),
        ]},
      { id:'cl9', title:'Closing Checks', site:'site_quay', recurrence:'Daily', due:'22:30', assignee:'u_amy', category:'Closing', priority:'High', ccp:false, lastCompleted:daysAgo(1).slice(0,16), signOffRequired:true,
        items:[
          clItem('Cooling records completed', false, true),
          clItem('All surfaces sanitised', false),
          clItem('Waste logged & bins emptied', false),
          clItem('Final temperature log', false),
        ]},
      { id:'cl10', title:'Opening Checks', site:'site_apex', recurrence:'Daily', due:'08:00', assignee:'u_david', category:'Opening', priority:'High', ccp:false, lastCompleted:hoursAgo(11).slice(0,16), signOffRequired:true,
        items:[
          clItem('Aging fridge & walk-in temps recorded', true, true),
          clItem('Probe calibration verified', true),
          clItem('Grill & salamander pre-heat temps logged', false),
        ]},
      { id:'cl11', title:'Daily Cleaning', site:'site_grove', recurrence:'Daily', due:'16:00', assignee:'u_james', category:'Cleaning', priority:'Medium', ccp:false, lastCompleted:hoursAgo(2).slice(0,16), signOffRequired:false,
        items:[
          clItem('Sanitise prep surfaces & colour-coded boards', true),
          clItem('Clean & descale coffee machine', false),
          clItem('Mop floors & clean floor drains', false),
        ]},
      { id:'cl12', title:'Food Court — Shift Open', site:'site_heathrow', recurrence:'Daily', due:'05:30', assignee:'u_raj', category:'Opening', priority:'High', ccp:true, ccpRef:'FC-OPEN', lastCompleted:hoursAgo(8).slice(0,16), signOffRequired:true,
        items:[
          clItem('All 8 unit fridges & hot holds logged', true, true),
          clItem('Hand-wash & glove stations stocked per unit', true),
          clItem('Unit 4 hot hold corrective action verified', false, true),
          clItem('Pest & waste contracts displayed', false),
        ]},
    ];

    const records = [
      { id:uid(), type:'Delivery',     site:'site_grove', by:'u_james', at:hoursAgo(3),  detail:{ supplier:'Brakes', item:'Chilled chicken', temp:2.8, accepted:true } },
      { id:uid(), type:'Cooking',      site:'site_grove', by:'u_sarah', at:hoursAgo(2),  detail:{ item:'Beef lasagne', temp:78.5, target:75 } },
      { id:uid(), type:'Cooling',      site:'site_grove', by:'u_james', at:hoursAgo(5),  detail:{ item:'Rice', start:62, end:7.5, mins:90 } },
      { id:uid(), type:'Reheating',    site:'site_dock',  by:'u_marco', at:hoursAgo(1),  detail:{ item:'Tomato soup', temp:82.1, target:75 } },
      { id:uid(), type:'Sanitization', site:'site_dock',  by:'u_lena',  at:hoursAgo(6),  detail:{ area:'Prep tables', chemical:'D10', contactMins:5 } },
    ];

    const alerts = [
      { id:uid(), severity:'critical', site:'site_quay', sensor:'s13', title:'Bar Fridge above safe range', detail:'5.6°C — exceeds 5°C limit · door open 12 min', at:hoursAgo(0.5), status:'open' },
      { id:uid(), severity:'warning', site:'site_grove', sensor:'s5', title:'Prep Fridge — Hot Line near limit', detail:'4.8°C — within 0.2°C of 5°C max · check door seal', at:hoursAgo(1.2), status:'open' },
      { id:uid(), severity:'critical', site:'site_heathrow', sensor:'s21', title:'T3 Unit 4 hot hold below 63°C', detail:'68.4°C logged but trending down — reheating required', at:hoursAgo(0.8), status:'open' },
      { id:uid(), severity:'info', site:'site_dock', sensor:null, title:'Closing checklist overdue', detail:'Closing Checks not completed by 23:00', at:hoursAgo(2), status:'acknowledged' },
      { id:uid(), severity:'warning', site:'site_grove', sensor:'s3', title:'Freezer A — door event', detail:'Door left open 4 min — resolved, temps recovered', at:daysAgo(1), status:'resolved' },
      { id:uid(), severity:'info', site:'site_marina', sensor:null, title:'Seasonal site — reduced monitoring', detail:'Marina Fish & Grill on summer hours — 2 sensors active', at:daysAgo(3), status:'acknowledged' },
    ];

    const menus = [
      { id:'m1', name:'À la Carte — Dinner', site:'site_grove', languages:['English','French','Spanish'],
        dishes:[
          { id:uid(), name:'Pan-seared Sea Bass', allergens:['Fish','Milk'], desc:'Crushed new potatoes, samphire, beurre blanc' },
          { id:uid(), name:'Wild Mushroom Risotto', allergens:['Milk','Sulphur dioxide & sulphites'], desc:'Parmesan, truffle oil' },
          { id:uid(), name:'Sticky Toffee Pudding', allergens:['Cereals containing gluten','Eggs','Milk'], desc:'Vanilla ice cream' },
        ]},
      { id:'m2', name:'Lunch Set Menu', site:'site_dock', languages:['English'],
        dishes:[
          { id:uid(), name:'Caesar Salad', allergens:['Fish','Eggs','Milk','Cereals containing gluten'], desc:'Anchovy dressing, croutons' },
          { id:uid(), name:'Falafel Wrap', allergens:['Cereals containing gluten','Sesame','Soybeans'], desc:'Hummus, pickles' },
        ]},
      { id:'m3', name:'Harbour Tasting Menu', site:'site_quay', languages:['English','French','Spanish','German'],
        dishes:[
          { id:uid(), name:'Seared Scallops', allergens:['Molluscs','Milk'], desc:'Pea purée, pancetta crumb' },
          { id:uid(), name:'Catch of the Day', allergens:['Fish','Milk','Sulphur dioxide & sulphites'], desc:'Seasonal market fish, beurre blanc' },
          { id:uid(), name:'Dark Chocolate Délice', allergens:['Eggs','Milk','Soybeans'], desc:'Salted caramel, honeycomb' },
        ]},
      { id:'m4', name:'Weekend Brunch', site:'site_grove', languages:['English','Spanish'],
        dishes:[
          { id:uid(), name:'Eggs Benedict', allergens:['Eggs','Milk','Cereals containing gluten'], desc:'Hollandaise, toasted muffin, ham' },
          { id:uid(), name:'Avocado & Feta Toast', allergens:['Cereals containing gluten','Milk','Sesame'], desc:'Sourdough, chilli, dukkah' },
          { id:uid(), name:'Pancake Stack', allergens:['Cereals containing gluten','Eggs','Milk'], desc:'Maple syrup, berries' },
        ]},
      { id:'m5', name:'Bar & Bites', site:'site_dock', languages:['English'],
        dishes:[
          { id:uid(), name:'Buttermilk Chicken', allergens:['Cereals containing gluten','Milk','Mustard'], desc:'Korean glaze, sesame' },
          { id:uid(), name:'Loaded Fries', allergens:['Milk'], desc:'Cheese sauce, jalapeños' },
        ]},
    ];

    const labels = [
      { id:uid(), product:'Cooked Rice', site:'site_grove', prepped:daysAgo(0), shelfDays:1, by:'u_james', allergens:[] },
      { id:uid(), product:'Beef Lasagne', site:'site_grove', prepped:daysAgo(1), shelfDays:2, by:'u_sarah', allergens:['Cereals containing gluten','Milk','Eggs'] },
      { id:uid(), product:'Cooked Chicken', site:'site_grove', prepped:daysAgo(0), shelfDays:2, by:'u_james', allergens:[] },
      { id:uid(), product:'Tomato & Basil Sauce', site:'site_grove', prepped:daysAgo(1), shelfDays:5, by:'u_sarah', allergens:['Celery'] },
      { id:uid(), product:'Tiramisu', site:'site_grove', prepped:daysAgo(0), shelfDays:2, by:'u_sarah', allergens:['Cereals containing gluten','Eggs','Milk'] },
      { id:uid(), product:'Open Milk (2L)', site:'site_grove', prepped:daysAgo(0), shelfDays:3, by:'u_james', allergens:['Milk'] },
      { id:uid(), product:'Hummus', site:'site_dock', prepped:daysAgo(1), shelfDays:3, by:'u_lena', allergens:['Sesame'] },
      { id:uid(), product:'Smoked Salmon (opened)', site:'site_dock', prepped:daysAgo(0), shelfDays:2, by:'u_marco', allergens:['Fish'] },
      { id:uid(), product:'Seafood Stock', site:'site_quay', prepped:daysAgo(0), shelfDays:3, by:'u_amy', allergens:['Crustaceans','Fish','Celery'] },
      { id:uid(), product:'Beurre Blanc', site:'site_quay', prepped:daysAgo(0), shelfDays:2, by:'u_amy', allergens:['Milk','Sulphur dioxide & sulphites'] },
      { id:uid(), product:'Salted Caramel', site:'site_quay', prepped:daysAgo(1), shelfDays:7, by:'u_amy', allergens:['Milk'] },
      { id:uid(), product:'Cooked Scallops', site:'site_quay', prepped:daysAgo(0), shelfDays:1, by:'u_amy', allergens:['Molluscs'] },
    ];

    // Pre-loaded example recipes (100 mixed — see js/recipe-seeds.js)
    const recipes = (typeof window !== 'undefined' && window.RecipeSeeds)
      ? window.RecipeSeeds.slice()
      : [
      { id:'r1', name:'Classic Beef Lasagne', category:'Main', site:'site_grove', servings:8, prepMins:40, cookMins:60,
        allergens:['Cereals containing gluten','Milk','Eggs'], image:null, cost:14.5, price:12.95, sold:86,
        ingredients:['500g beef mince','1 onion, finely diced','2 garlic cloves, crushed','800g chopped tomatoes','2 tbsp tomato purée','250g lasagne sheets','50g butter','50g plain flour','500ml milk','100g parmesan, grated'],
        method:['Brown the mince, then add onion and garlic until soft.','Stir in tomatoes and purée; simmer 30 minutes.','Make a roux with butter and flour, whisk in milk to a smooth béchamel.','Layer ragù, pasta sheets and béchamel, repeating to fill the dish.','Top with parmesan and bake at 180°C for 40 minutes until golden.'] },
    ];

    const waste = [
      { id:uid(), site:'site_grove', item:'Bread', kg:2.4, reason:'Overproduction', stage:'Prep', cost:6.0, at:daysAgo(0) },
      { id:uid(), site:'site_grove', item:'Vegetables', kg:1.8, reason:'Spoilage', stage:'Storage', cost:5.4, at:daysAgo(1) },
      { id:uid(), site:'site_dock',  item:'Plate waste', kg:4.1, reason:'Customer return', stage:'Service', cost:12.3, at:daysAgo(1) },
      { id:uid(), site:'site_grove', item:'Fish trim', kg:0.9, reason:'Trimming', stage:'Prep', cost:7.2, at:daysAgo(2) },
      { id:uid(), site:'site_dock',  item:'Dairy', kg:1.2, reason:'Expired', stage:'Storage', cost:4.1, at:daysAgo(3) },
    ];

    const activity = [
      { id:uid(), user:'u_james', action:'Completed temperature log', at:hoursAgo(2.9) },
      { id:uid(), user:'u_sarah', action:'Logged cooking record: Beef lasagne', at:hoursAgo(2) },
      { id:uid(), user:'u_lena',  action:'Acknowledged alert: Closing checklist overdue', at:hoursAgo(1.9) },
    ];

    // Live kitchen workflows — supplier, prep, temps, H&S, HACCP
    const workflows = seedWorkflows('site_grove');

    // Approved suppliers register (due-diligence)
    const suppliers = [
      { id:uid(), name:'Brakes Foodservice', category:'Ambient & Chilled', status:'Approved', contact:'orders@brakes.co.uk', phone:'0345 606 9090', rating:5, lastAudit:daysAgo(40), certExpiry:daysAgo(-300) },
      { id:uid(), name:'Direct Seafoods', category:'Fish & Seafood', status:'Approved', contact:'sales@directseafoods.co.uk', phone:'0117 963 0123', rating:4, lastAudit:daysAgo(70), certExpiry:daysAgo(-20) },
      { id:uid(), name:'Wellocks', category:'Fruit & Veg', status:'Approved', contact:'hello@wellocks.co.uk', phone:'0345 666 7766', rating:5, lastAudit:daysAgo(25), certExpiry:daysAgo(-150) },
      { id:uid(), name:'Bidfood', category:'Frozen & Ambient', status:'Pending', contact:'care@bidfood.co.uk', phone:'0370 366 6100', rating:3, lastAudit:daysAgo(120), certExpiry:daysAgo(-5) },
      { id:uid(), name:'Local Butchers Co.', category:'Meat & Poultry', status:'Suspended', contact:'info@localbutchers.co', phone:'0161 222 3344', rating:2, lastAudit:daysAgo(200), certExpiry:daysAgo(12) },
    ];

    // Staff training & certificates (with expiry tracking)
    const training = [
      { id:uid(), person:'u_sarah', course:'Level 3 Food Safety', completed:daysAgo(120), expires:daysAgo(-610) },
      { id:uid(), person:'u_sarah', course:'Allergen Awareness', completed:daysAgo(60), expires:daysAgo(-300) },
      { id:uid(), person:'u_james', course:'Level 2 Food Hygiene', completed:daysAgo(330), expires:daysAgo(20) },
      { id:uid(), person:'u_james', course:'HACCP Principles', completed:daysAgo(200), expires:daysAgo(-160) },
      { id:uid(), person:'u_lena',  course:'Level 3 Food Safety', completed:daysAgo(350), expires:daysAgo(15) },
      { id:uid(), person:'u_marco', course:'Allergen Awareness', completed:daysAgo(40), expires:daysAgo(-320) },
      { id:uid(), person:'u_amy',   course:'Level 2 Food Hygiene', completed:daysAgo(10), expires:daysAgo(-720) },
      { id:uid(), person:'u_amy',   course:'Personal Licence', completed:daysAgo(400), expires:daysAgo(-30) },
    ];

    // Assets & equipment register (service / warranty tracking)
    const assets = [
      { id:uid(), name:'Walk-in Fridge 1', type:'Refrigeration', site:'site_grove', serial:'WIF-2021-001', installed:daysAgo(800), lastService:daysAgo(60), nextService:daysAgo(-120), status:'Operational', supplier:'CoolFix Refrigeration' },
      { id:uid(), name:'Combi Oven', type:'Cooking', site:'site_grove', serial:'RAT-SCC-202', installed:daysAgo(500), lastService:daysAgo(200), nextService:daysAgo(-12), status:'Operational', supplier:'Rational UK' },
      { id:uid(), name:'Blast Chiller', type:'Refrigeration', site:'site_quay', serial:'FOS-BC-900', installed:daysAgo(300), lastService:daysAgo(20), nextService:daysAgo(-160), status:'Operational', supplier:'Foster' },
      { id:uid(), name:'Dishwasher', type:'Warewashing', site:'site_dock', serial:'WIN-PT-500', installed:daysAgo(900), lastService:daysAgo(400), nextService:daysAgo(-4), status:'Needs attention', supplier:'Winterhalter' },
      { id:uid(), name:'Extraction Hood', type:'Ventilation', site:'site_grove', serial:'EXT-HD-77', installed:daysAgo(1200), lastService:daysAgo(30), nextService:daysAgo(-150), status:'Operational', supplier:'Facilities Team' },
      { id:uid(), name:'Ice Machine', type:'Refrigeration', site:'site_dock', serial:'HOS-IM-45', installed:daysAgo(420), lastService:daysAgo(95), nextService:daysAgo(20), status:'Out of service', supplier:'Hoshizaki' },
    ];

    // Batch production records (cook → cool → use-by traceability)
    const batches = [
      { id:uid(), product:'Beef Lasagne', batchNo:'BL-240601', site:'site_grove', qty:'8 trays', made:daysAgo(0), cookTemp:78.5, coolResult:'Pass', useBy:daysAgo(-2), by:'u_sarah' },
      { id:uid(), product:'Chicken Curry', batchNo:'CC-240531', site:'site_grove', qty:'12 L', made:daysAgo(1), cookTemp:82.1, coolResult:'Pass', useBy:daysAgo(-1), by:'u_james' },
      { id:uid(), product:'Vegetable Stock', batchNo:'VS-240530', site:'site_dock', qty:'20 L', made:daysAgo(2), cookTemp:95.0, coolResult:'Fail', useBy:daysAgo(1), by:'u_lena' },
      { id:uid(), product:'Pulled Pork', batchNo:'PP-240529', site:'site_quay', qty:'6 kg', made:daysAgo(2), cookTemp:88.0, coolResult:'Pass', useBy:daysAgo(0), by:'u_amy' },
    ];

    // Cooling verification (2-stage: 60→21°C ≤2h, then →5°C ≤4h)
    const cooling = [
      { id:uid(), item:'Cooked Rice', site:'site_grove', startTemp:62, startAt:hoursAgo(6), s1Temp:20, s1Mins:115, s2Temp:5, s2Mins:230, by:'u_james', result:'Pass' },
      { id:uid(), item:'Beef Lasagne', site:'site_grove', startTemp:75, startAt:hoursAgo(8), s1Temp:21, s1Mins:120, s2Temp:6, s2Mins:250, by:'u_sarah', result:'Pass' },
      { id:uid(), item:'Gravy', site:'site_dock', startTemp:80, startAt:hoursAgo(10), s1Temp:30, s1Mins:140, s2Temp:9, s2Mins:300, by:'u_lena', result:'Fail' },
    ];

    // pH monitoring (acidified foods, sanitiser solutions)
    const phlogs = [
      { id:uid(), item:'Sushi rice', site:'site_quay', ph:4.1, target:'≤ 4.6', by:'u_amy', at:hoursAgo(3), result:'Pass' },
      { id:uid(), item:'Pickled vegetables', site:'site_grove', ph:3.8, target:'≤ 4.6', by:'u_sarah', at:hoursAgo(5), result:'Pass' },
      { id:uid(), item:'Sanitiser solution', site:'site_dock', ph:6.9, target:'6.5–7.5', by:'u_lena', at:hoursAgo(2), result:'Pass' },
      { id:uid(), item:'Chilli marinade', site:'site_grove', ph:5.2, target:'≤ 4.6', by:'u_james', at:hoursAgo(7), result:'Fail' },
    ];

    // Hot-hold & cold-hold temperature logs (hot ≥63°C, cold ≤8°C)
    const holding = [
      { id:uid(), unit:'Hot Hold Counter', kind:'Hot', site:'site_grove', temp:72.4, target:63, period:'Lunch', by:'u_james', at:hoursAgo(1), result:'Pass', action:'' },
      { id:uid(), unit:'Carvery Bain-Marie', kind:'Hot', site:'site_grove', temp:61.0, target:63, period:'Lunch', by:'u_sarah', at:hoursAgo(2), result:'Fail', action:'Reheated to 75°C and turned bain-marie up; rechecked OK.' },
      { id:uid(), unit:'Soup Kettle', kind:'Hot', site:'site_grove', temp:78.1, target:63, period:'Lunch', by:'u_james', at:hoursAgo(3), result:'Pass', action:'' },
      { id:uid(), unit:'Cold Buffet Well', kind:'Cold', site:'site_grove', temp:6.2, target:8, period:'Lunch', by:'u_sarah', at:hoursAgo(2), result:'Pass', action:'' },
      { id:uid(), unit:'Salad Bar', kind:'Cold', site:'site_dock', temp:4.5, target:8, period:'Dinner', by:'u_lena', at:hoursAgo(1), result:'Pass', action:'' },
      { id:uid(), unit:'Dessert Display', kind:'Cold', site:'site_quay', temp:9.2, target:8, period:'Dinner', by:'u_amy', at:hoursAgo(3), result:'Fail', action:'Moved stock to walk-in, called maintenance; unit re-checked at 5°C.' },
    ];

    // Maintenance / repair tickets — emailed to a department, with a live update thread
    const maintenance = [
      { id:'mt1', title:'Walk-in fridge not holding temperature', asset:'Walk-in Fridge 1', site:'site_grove', priority:'High', status:'In progress',
        dept:'CoolFix Refrigeration', email:'service@coolfix.example', createdBy:'u_sarah', createdAt:hoursAgo(20), ref:'CF-4821',
        thread:[
          { at:hoursAgo(20), by:'Sarah Mitchell', type:'app', subject:'URGENT: Walk-in Fridge 1 fault', body:'Walk-in Fridge 1 is reading 8°C, above the 5°C safe limit. Stock at risk — please attend as soon as possible.' },
          { at:hoursAgo(6),  by:'CoolFix Dispatch', type:'dept', body:'Job logged (ref CF-4821). Engineer assigned, ETA today 16:00.' },
        ] },
      { id:'mt2', title:'Dishwasher not draining', asset:'Dishwasher', site:'site_dock', priority:'Medium', status:'Open',
        dept:'Facilities Team', email:'maintenance@kiteline.uk', createdBy:'u_lena', createdAt:daysAgo(1), ref:'',
        thread:[
          { at:daysAgo(1), by:'Lena Park', type:'app', subject:'Dishwasher drainage issue', body:'Standing water left in the dishwasher after cycles — likely a blocked drain.' },
        ] },
      { id:'mt3', title:'Extraction fan noisy', asset:'Extraction Hood', site:'site_grove', priority:'Low', status:'Resolved',
        dept:'Facilities Team', email:'maintenance@kiteline.uk', createdBy:'u_james', createdAt:daysAgo(5), ref:'FAC-220',
        thread:[
          { at:daysAgo(5), by:'James Okafor', type:'app', subject:'Noisy extraction fan', body:'Bearing noise coming from the extraction hood motor.' },
          { at:daysAgo(3), by:'Facilities Team', type:'dept', body:'Attended site, replaced motor bearing and serviced unit. Marking as resolved.' },
        ] },
    ];

    // Goods-in deliveries — temperature & quality checks on arrival
    const deliveries = [
      { id:uid(), supplier:'Brakes', site:'site_grove', category:'Chilled', temp:2.8, target:5, packaging:'Good', dateCheck:'Pass', vehicle:'Clean', by:'u_james', at:hoursAgo(3), accepted:true, reason:'', items:'Chilled chicken, dairy, salad' },
      { id:uid(), supplier:'Bidfood', site:'site_grove', category:'Frozen', temp:-19.5, target:-18, packaging:'Good', dateCheck:'Pass', vehicle:'Clean', by:'u_sarah', at:hoursAgo(5), accepted:true, reason:'', items:'Frozen fries, peas, fish' },
      { id:uid(), supplier:'Fresh Direct', site:'site_grove', category:'Produce', temp:7.2, target:8, packaging:'Good', dateCheck:'Pass', vehicle:'Clean', by:'u_james', at:hoursAgo(7), accepted:true, reason:'', items:'Tomatoes, herbs, leaves' },
      { id:uid(), supplier:'MeatCo', site:'site_grove', category:'Chilled', temp:9.4, target:5, packaging:'Damaged', dateCheck:'Pass', vehicle:'Dirty', by:'u_sarah', at:hoursAgo(9), accepted:false, reason:'Delivery temp 9.4°C (above 5°C) and packaging damaged — rejected and returned with driver.', items:'Raw beef, lamb' },
      { id:uid(), supplier:'Dairy Fresh', site:'site_dock', category:'Dairy', temp:4.1, target:5, packaging:'Good', dateCheck:'Pass', vehicle:'Clean', by:'u_lena', at:hoursAgo(4), accepted:true, reason:'', items:'Milk, butter, cream' },
      { id:uid(), supplier:'Bidfood', site:'site_quay', category:'Ambient', temp:null, target:null, packaging:'Good', dateCheck:'Fail', vehicle:'Clean', by:'u_amy', at:hoursAgo(6), accepted:false, reason:'Two cases past best-before date — rejected those cases, rest accepted.', items:'Canned goods, oils' },
    ];

    // Incidents & corrective actions log
    const incidents = [
      { id:uid(), title:'Walk-in fridge over temperature', type:'Equipment', site:'site_quay', severity:'High', reportedBy:'u_amy', at:hoursAgo(6), status:'In progress', action:'Engineer called; stock moved to spare unit and temperatures logged hourly.' },
      { id:uid(), title:'Customer allergen complaint', type:'Complaint', site:'site_grove', severity:'High', reportedBy:'u_sarah', at:daysAgo(2), status:'Closed', action:'Reviewed allergen matrix, retrained server, apology issued. No reaction occurred.' },
      { id:uid(), title:'Minor burn — fryer station', type:'Accident', site:'site_dock', severity:'Low', reportedBy:'u_lena', at:daysAgo(4), status:'Closed', action:'First aid administered, accident book updated, splash guard fitted.' },
      { id:uid(), title:'Evidence of pests near bins', type:'Pest', site:'site_dock', severity:'Medium', reportedBy:'u_marco', at:daysAgo(1), status:'Open', action:'' },
    ];

    return {
      org: { name:'Kiteline', plan:'Complete Kiteline', currency:'GBP',
             products:{ fss:true, allerq:true, labels:true, waste:true },
             channels:{ sms:true, email:true, push:true } },
      sites, team, sensors, checklists, records, alerts, menus, labels, waste, recipes, activity, workflows,
      suppliers, training, incidents, maintenance, deliveries,
      assets, batches, cooling, phlogs, holding,
      allergens: ALLERGENS,
      currentSite: 'site_grove',
    };
  }

  // Ensure a loaded/synced db has every collection the current app expects.
  function ensureShape(db) {
    if (!db || typeof db !== 'object') return seed();
    const isPrivate = !!(db._tenantPrivate || db._isPrivate);
    const s = seed();
    ['sites','team','sensors','checklists','records','alerts','menus','labels','waste','recipes','activity','workflows','suppliers','training','incidents','maintenance','deliveries','assets','batches','cooling','phlogs','holding'].forEach(k => { if (!Array.isArray(db[k])) db[k] = s[k]; });
    if (!db.org) db.org = s.org;
    if (db.org && (db.org.name === 'Brigade' || db.org.plan === 'Complete Brigade')) {
      db.org.name = 'Kiteline';
      db.org.plan = 'Complete Kiteline';
    }
    if (!db.allergens) db.allergens = s.allergens;
    if (!db.currentSite) db.currentSite = s.currentSite;
    // Only upgrade to full demo datasets for the owner demo tenant — never for private workspaces
    if (!isPrivate) {
      if ((db.sites || []).length < 10) db.sites = s.sites;
      if ((db.sensors || []).length < 20) db.sensors = s.sensors;
      if ((db.checklists || []).length < 12) db.checklists = s.checklists;
      if ((db.team || []).length < 10) db.team = s.team;
      if (!db.workflows || db.workflows.length < 90) db.workflows = s.workflows;
      if ((db.recipes || []).length < 100) db.recipes = s.recipes;
    }
    return db;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return ensureShape(JSON.parse(raw));
    } catch (e) {}
    const db = seed();
    save(db);
    return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  const Store = {
    db: load(),
    uid, now, daysAgo, hoursAgo,
    ALLERGENS,
    siteOrigin: SITE_ORIGIN,
    siteUrl(path = '') {
      if (!path) return SITE_ORIGIN;
      return SITE_ORIGIN + (path.startsWith('/') ? path : '/' + path);
    },
    remote: false,            // set true when backed by the Node server
    persist() { save(this.db); this._pushRemote(); },
    reset() { localStorage.removeItem(KEY); this.db = load(); this._pushRemote(true); },

    // --- server sync (no-op when offline) ---
    async hydrateFromServer() {
      if (!window.Api || !this.remote) return;
      try {
        const serverState = await window.Api.getState();
        if (serverState) {
          const isPrivate = !!(serverState._tenantPrivate || serverState._isPrivate);
          const missing = !isPrivate && (['suppliers','training','incidents','maintenance','deliveries','recipes','assets','batches','cooling','phlogs','holding','workflows'].some(k => !Array.isArray(serverState[k]))
            || (serverState.sites || []).length < 10 || (serverState.sensors || []).length < 20
            || (serverState.workflows || []).length < 90);
          this.db = ensureShape(serverState);
          save(this.db);
          if (missing) await window.Api.putState(this.db).catch(() => {}); // persist newly-added collections
        } else {
          await window.Api.putState(this.db); // upload local seed on first run
        }
      } catch (e) { this.remote = false; }
    },
    // Pull only the live IoT data (sensors + alerts) from the server, without
    // disturbing local UI state. Returns true if anything changed.
    async pullLive() {
      if (!window.Api || !this.remote) return false;
      try {
        const serverState = await window.Api.getState();
        if (serverState && Array.isArray(serverState.sensors)) {
          const sig = () => JSON.stringify(this.db.sensors) + JSON.stringify(this.db.alerts || []) + JSON.stringify(this.db.maintenance || []);
          const before = sig();
          this.db.sensors = serverState.sensors;
          if (Array.isArray(serverState.alerts)) this.db.alerts = serverState.alerts;
          // Merge maintenance: keep local tickets, fold in server status + new dept updates.
          if (Array.isArray(serverState.maintenance)) {
            const local = this.db.maintenance || [];
            const byId = {}; local.forEach(t => byId[t.id] = t);
            serverState.maintenance.forEach(st => {
              const lt = byId[st.id];
              if (lt) {
                if ((st.thread || []).length >= (lt.thread || []).length) lt.thread = st.thread;
                lt.status = st.status; lt.ref = st.ref || lt.ref;
              } else { local.push(st); byId[st.id] = st; }
            });
            this.db.maintenance = local;
          }
          save(this.db);
          return sig() !== before;
        }
      } catch (e) {}
      return false;
    },
    _pushRemote(force) {
      if (!window.Api || !this.remote) return;
      clearTimeout(this._syncT);
      this._syncT = setTimeout(() => {
        window.Api.putState(this.db).catch(() => {});
      }, force ? 0 : 400);
    },
    // session
    login(email) {
      const session = { email: email || 'sarah@kiteline.uk', name:'Sarah Mitchell', at: now() };
      localStorage.setItem(SESSION, JSON.stringify(session));
      return session;
    },
    logout() { localStorage.removeItem(SESSION); },
    session() { try { return JSON.parse(localStorage.getItem(SESSION)); } catch(e){ return null; } },
    // helpers
    site(id) { return this.db.sites.find(s => s.id === (id||this.db.currentSite)); },
    member(id) { return this.db.team.find(m => m.id === id) || { name:'—', initials:'?' }; },
    sensorsForSite(id) { return this.db.sensors.filter(s => s.siteId === (id||this.db.currentSite)); },
    setSite(id) { this.db.currentSite = id; this.persist(); },
    logActivity(userId, action) {
      this.db.activity.unshift({ id: uid(), user:userId, action, at: now() });
      this.db.activity = this.db.activity.slice(0, 50);
      this.persist();
    },
    workflowsForSite(id) {
      return (this.db.workflows || []).filter(w => w.site === (id || this.db.currentSite));
    },
    tickWorkflows() {
      const site = this.db.currentSite;
      const wfs = this.workflowsForSite(site);
      if (!wfs.length) return false;
      let changed = false;
      const ts = Date.now();
      wfs.forEach(w => {
        if (w.status !== 'completed' && w.dueAt && new Date(w.dueAt).getTime() < ts && w.status !== 'overdue') {
          w.status = 'overdue'; w.updatedAt = now(); changed = true;
        }
      });
      const sched = wfs.filter(w => w.status === 'scheduled');
      if (sched.length && Math.random() < 0.45) {
        const w = sched[Math.floor(Math.random() * sched.length)];
        w.status = 'in_progress'; w.startedAt = now(); w.updatedAt = now(); changed = true;
      }
      const prog = wfs.filter(w => w.status === 'in_progress');
      if (prog.length && Math.random() < 0.5) {
        const w = prog[Math.floor(Math.random() * prog.length)];
        w.status = 'completed'; w.completedAt = now(); w.updatedAt = now();
        this.db.activity.unshift({ id: uid(), user: w.assignee, action: w.label, at: now() });
        this.db.activity = this.db.activity.slice(0, 50);
        changed = true;
      }
      if (changed) save(this.db);
      return changed;
    },
  };

  window.Store = Store;
})();
