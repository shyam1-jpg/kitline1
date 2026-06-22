/* ============================================================
   Kiteline Kitchen Compliance — SafeServe / H&S / FSMS modules
   Separate from Kiteline Academy. Document codes:
   KFS, KHS, KRA, KHACCP, KCOSHH, KACC, KSSW
   ============================================================ */
(function () {
  const S = () => window.Store;

  const CODES = {
    KFS: 'Kiteline Food Safety',
    KHS: 'Kiteline Health & Safety',
    KRA: 'Kiteline Risk Assessment',
    KHACCP: 'Kiteline HACCP Plan',
    KCOSHH: 'Kiteline COSHH Record',
    KACC: 'Kiteline Accident Record',
    KSSW: 'Kiteline Safe System of Work',
  };

  const SENSITIVE_KEYS = ['accidents', 'foodComplaints', 'coshh', 'riskAssessments', 'haccpPlans', 'fsmsDocuments'];
  const MANAGER_EXPORT_KEYS = SENSITIVE_KEYS.concat(['thirdPartyEvents', 'probeCalibration', 'equipmentMaintenance']);

  const MODULES = [
    { id: 'overview', code: null, label: 'Overview', icon: 'grid', sensitive: false },
    { id: 'hsChecks', code: 'KHS', label: 'Health & Safety', icon: 'shield', sensitive: false },
    { id: 'riskAssessments', code: 'KRA', label: 'Risk Assessments', icon: 'alert', sensitive: true },
    { id: 'coshh', code: 'KCOSHH', label: 'COSHH', icon: 'droplet', sensitive: true },
    { id: 'accidents', code: 'KACC', label: 'Accident Reporting', icon: 'alert', sensitive: true },
    { id: 'inductions', code: 'KHS', label: 'Staff Training & Induction', icon: 'cap', sensitive: false },
    { id: 'manualHandling', code: 'KSSW', label: 'Manual Handling', icon: 'box', sensitive: false },
    { id: 'safetyChecks', code: 'KHS', label: 'Fire / PPE / First Aid', icon: 'shield', sensitive: false },
    { id: 'foodComplaints', code: 'KFS', label: 'Food Complaints & Allegations', icon: 'records', sensitive: true },
    { id: 'probeCalibration', code: 'KFS', label: 'Probe Calibration', icon: 'temp', sensitive: false },
    { id: 'thirdPartyEvents', code: 'KFS', label: 'Third-Party Caterer / Events', icon: 'truck', sensitive: false },
    { id: 'haccpPlans', code: 'KHACCP', label: 'HACCP Plan Builder', icon: 'check', sensitive: true },
    { id: 'fsmsDocuments', code: 'KFS', label: 'FSMS Documents', icon: 'records', sensitive: true },
    { id: 'equipmentMaintenance', code: 'KHS', label: 'Equipment Maintenance Records', icon: 'wrench', sensitive: false },
    { id: 'auditExport', code: null, label: 'Audit Exports', icon: 'download', sensitive: false, managerOnly: true },
  ];

  const RISK_AREAS = [
    'Slips, trips and falls', 'Manual handling', 'Burns and scalds', 'Cuts from knives',
    'Fire and explosion', 'Electrical equipment', 'Working at height', 'COSHH / hazardous substances',
    'Noise and vibration', 'Work-related stress', 'Violence and aggression', 'Lone working',
    'Machinery and equipment', 'Hot surfaces and steam', 'Food safety cross-contamination',
  ];

  const HACCP_STEPS = [
    { step: 1, hazard: 'Receiving chilled goods', ccp: false, limit: '≤5°C', monitor: 'Probe on delivery', corrective: 'Reject / quarantine', verify: 'Manager review', record: 'Delivery log' },
    { step: 2, hazard: 'Storage — chilled', ccp: true, limit: '0–5°C', monitor: 'Twice daily probe / sensor', corrective: 'Move stock, engineer call', verify: 'Temp log review', record: 'KFS temp log' },
    { step: 3, hazard: 'Storage — frozen', ccp: true, limit: '≤-18°C', monitor: 'Daily check', corrective: 'Discard if thawed', verify: 'Weekly audit', record: 'KFS temp log' },
    { step: 4, hazard: 'Cooking — high risk foods', ccp: true, limit: '≥75°C core / 70°C 2 min', monitor: 'Probe each batch', corrective: 'Continue cooking', verify: 'Spot check', record: 'Cooking log' },
    { step: 5, hazard: 'Hot holding', ccp: true, limit: '≥63°C', monitor: 'Every 2h service', corrective: 'Reheat to 75°C', verify: 'Service review', record: 'Holding log' },
    { step: 6, hazard: 'Cooling', ccp: true, limit: '60→21°C in 2h; →5°C in 4h', monitor: 'Timed probe checks', corrective: 'Blast chill / discard', verify: 'Cooling log audit', record: 'Cooling log' },
    { step: 7, hazard: 'Reheating', ccp: true, limit: '≥75°C once only', monitor: 'Probe', corrective: 'Continue heating', verify: 'Manager sign-off', record: 'Reheat log' },
    { step: 8, hazard: 'Allergen control', ccp: false, limit: 'Accurate matrix', monitor: 'Recipe review', corrective: 'Relabel / withdraw', verify: 'Menu audit', record: 'Allergen matrix' },
    { step: 9, hazard: 'Cleaning & sanitising', ccp: false, limit: 'Visual + ATP where used', monitor: 'Schedule', corrective: 'Re-clean', verify: 'Supervisor check', record: 'Cleaning schedule' },
    { step: 10, hazard: 'Personal hygiene', ccp: false, limit: 'Hand wash policy', monitor: 'Observation', corrective: 'Retrain', verify: 'Induction records', record: 'KHS induction' },
  ];

  const FSMS_TEMPLATES = [
    { title: 'Food Safety Policy', section: 'Policy', reviewMonths: 12 },
    { title: 'Food Safety Management System Manual', section: 'FSMS', reviewMonths: 12 },
    { title: 'Personal Hygiene Policy', section: 'Hygiene', reviewMonths: 12 },
    { title: 'Cleaning & Disinfection Schedule', section: 'Cleaning', reviewMonths: 6 },
    { title: 'Pest Control Policy & Contractor Details', section: 'Pest', reviewMonths: 12 },
    { title: 'Supplier Approval Procedure', section: 'Supply chain', reviewMonths: 12 },
    { title: 'Allergen Management Procedure', section: 'Allergens', reviewMonths: 6 },
    { title: 'Traceability & Recall Procedure', section: 'Traceability', reviewMonths: 12 },
    { title: 'Waste Management Procedure', section: 'Waste', reviewMonths: 12 },
    { title: 'Training & Competency Matrix', section: 'Training', reviewMonths: 6 },
  ];

  function emptyCompliance() {
    return {
      hsChecks: [], riskAssessments: [], coshh: [], accidents: [], inductions: [],
      manualHandling: [], safetyChecks: [], foodComplaints: [], probeCalibration: [],
      thirdPartyEvents: [], haccpPlans: [], fsmsDocuments: [], equipmentMaintenance: [],
    };
  }

  const SAMPLE_SITES = ['site_grove', 'site_dock', 'site_quay', 'site_vedanta'];
    const SAMPLE_VERSION = 3;

  function siteSuffix(siteId) {
    return String(siteId || 'site').replace('site_', '');
  }

  function seedCompliance(siteId, teamId) {
    const u = teamId || 'u_sarah';
    const sfx = siteSuffix(siteId);
    const ref = (code, n) => `${code}-${String(n).padStart(4, '0')}`;
    const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
    const rid = (p) => `${p}_${sfx}_${Math.random().toString(36).slice(2, 7)}`;
    return {
      hsChecks: [
        { id: rid('khs'), ref: ref('KHS', 1), site: siteId, type: 'Daily H&S walkthrough', areas: 'Kitchen, store, dry goods', findings: 'Floor wet near dishwasher — wet-floor sign placed', action: 'Signage checked; mop schedule confirmed', status: 'Closed', by: u, at: ago(1), code: 'KHS' },
        { id: rid('khs'), ref: ref('KHS', 2), site: siteId, type: 'Weekly H&S inspection', areas: 'All zones including yard', findings: 'No major issues — PPE stock OK, cables tidy', action: '', status: 'Closed', by: u, at: ago(7), code: 'KHS' },
        { id: rid('khs'), ref: ref('KHS', 3), site: siteId, type: 'Opening H&S check', areas: 'Hot line, prep, stores', findings: 'Extractor running; anti-slip mats in place', action: 'Log signed by duty manager', status: 'Closed', by: u, at: ago(0.5), code: 'KHS' },
      ],
      riskAssessments: [
        { id: rid('kra'), ref: ref('KRA', 1), site: siteId, area: 'Main kitchen — hot line', hazards: 'Burns, scalds, slips on wet floor', persons: 'Chefs, KP', existing: 'PPE, non-slip boots, splash guards', further: 'Review quarterly', likelihood: 2, severity: 3, risk: 6, residual: 3, reviewDate: ago(-90).slice(0, 10), by: u, at: ago(30), code: 'KRA', status: 'Active' },
        { id: rid('kra'), ref: ref('KRA', 2), site: siteId, area: 'Goods-in / stores', hazards: 'Manual handling — heavy crates', persons: 'Stores team', existing: 'Trollies, team lift policy, max 15kg carry', further: 'Weight labels on delivery notes', likelihood: 2, severity: 3, risk: 6, residual: 2, reviewDate: ago(-60).slice(0, 10), by: u, at: ago(45), code: 'KRA', status: 'Active' },
        { id: rid('kra'), ref: ref('KRA', 3), site: siteId, area: 'Knife & mandolin prep', hazards: 'Cuts and lacerations', persons: 'Prep staff', existing: 'Cut gloves, steel guards, colour-coded boards', further: 'Annual knife skills refresher', likelihood: 3, severity: 2, risk: 6, residual: 3, reviewDate: ago(-120).slice(0, 10), by: u, at: ago(60), code: 'KRA', status: 'Active' },
      ],
      coshh: [
        { id: rid('kc'), ref: ref('KCOSHH', 1), site: siteId, product: 'Kitchen degreaser', supplier: 'Evans Vanodine', hazard: 'Irritant — skin/eye', storage: 'Locked COSHH cupboard — dry store', ppe: 'Gloves, goggles', exposure: 'Dilute 1:40 — 5 min contact', emergency: 'Rinse eyes 15 min; seek medical advice', sdsDate: '2024-03-01', reviewDate: ago(-180).slice(0, 10), by: u, at: ago(20), code: 'KCOSHH' },
        { id: rid('kc'), ref: ref('KCOSHH', 2), site: siteId, product: 'Food-safe sanitiser (QAC)', supplier: 'Selden', hazard: 'Low toxicity when diluted', storage: 'Locked under prep sink', ppe: 'Gloves', exposure: 'Food contact surfaces — allow to air dry', emergency: 'Wash affected skin', sdsDate: '2023-11-15', reviewDate: ago(-90).slice(0, 10), by: u, at: ago(20), code: 'KCOSHH' },
        { id: rid('kc'), ref: ref('KCOSHH', 3), site: siteId, product: 'Grill / oven cleaner (caustic)', supplier: 'Diversey', hazard: 'Corrosive — burns', storage: 'COSHH cupboard — separate from food', ppe: 'Gloves, goggles, apron', exposure: 'Night clean only — ventilated', emergency: 'Flush with water; do not induce vomiting', sdsDate: '2024-01-10', reviewDate: ago(-200).slice(0, 10), by: u, at: ago(15), code: 'KCOSHH' },
      ],
      accidents: [
        { id: rid('kacc'), ref: ref('KACC', 1), site: siteId, injured: 'James O.', role: 'Sous Chef', date: ago(4).slice(0, 10), time: '14:30', location: 'Hot line — bain-marie', type: 'Burn — minor', description: 'Steam burn to forearm when lifting lid', firstAid: 'Cold water 10 min, burn gel, dressing applied', riddor: false, witness: 'Sarah M.', action: 'Lid holder fitted; steam safety refresher', status: 'Closed', by: u, at: ago(4), code: 'KACC' },
        { id: rid('kacc'), ref: ref('KACC', 2), site: siteId, injured: 'KP — temp staff', role: 'Kitchen Porter', date: ago(12).slice(0, 10), time: '08:15', location: 'Dry store', type: 'Slip — no injury', description: 'Slipped on spilled oil — no injury, near-miss logged', firstAid: 'None required', riddor: false, witness: 'Duty manager', action: 'Spill kit restocked; mop point reinforced', status: 'Closed', by: u, at: ago(12), code: 'KACC' },
      ],
      inductions: [
        { id: rid('ind'), ref: ref('KHS', 101), site: siteId, staff: 'Marco R.', topics: 'Hand washing, allergens, fire exits, COSHH overview, knife safety, reporting accidents', trainer: 'Sarah Mitchell', signed: true, at: ago(14), reviewDate: ago(-350).slice(0, 10), code: 'KHS' },
        { id: rid('ind'), ref: ref('KHS', 102), site: siteId, staff: 'Amy T. — new starter', topics: 'Site tour, dress code, temp logs, probe use, waste segregation', trainer: 'Manager on duty', signed: true, at: ago(3), reviewDate: ago(-362).slice(0, 10), code: 'KHS' },
        { id: rid('ind'), ref: ref('KHS', 103), site: siteId, staff: 'Seasonal hire checklist', topics: 'Emergency procedures, first aiders, guest allergy protocol', trainer: 'Compliance lead', signed: false, at: ago(0), reviewDate: ago(-365).slice(0, 10), code: 'KHS' },
      ],
      manualHandling: [
        { id: rid('kssw'), ref: ref('KSSW', 1), site: siteId, task: 'Moving 25 kg flour sacks to dry store', load: '25 kg', method: 'Sack truck only — no manual carry over 15 kg', teamLift: false, training: true, lastReview: ago(60).slice(0, 10), by: u, at: ago(60), code: 'KSSW' },
        { id: rid('kssw'), ref: ref('KSSW', 2), site: siteId, task: 'Walk-in fridge stock rotation', load: 'Crates up to 20 kg', method: 'Two-person lift over 15 kg; knees bent, load close to body', teamLift: true, training: true, lastReview: ago(30).slice(0, 10), by: u, at: ago(30), code: 'KSSW' },
        { id: rid('kssw'), ref: ref('KSSW', 3), site: siteId, task: 'Emptying waste bins to external store', load: 'Up to 15 kg', method: 'Use bin trolley; do not overfill bags', teamLift: false, training: true, lastReview: ago(14).slice(0, 10), by: u, at: ago(14), code: 'KSSW' },
      ],
      safetyChecks: [
        { id: rid('sc'), ref: ref('KHS', 201), site: siteId, checkType: 'Fire', items: 'Exits clear, extinguishers in date, alarm weekly test logged, assembly point signed', result: 'Pass', action: '', by: u, at: ago(1), code: 'KHS' },
        { id: rid('sc'), ref: ref('KHS', 202), site: siteId, checkType: 'PPE', items: 'Cut gloves, heat gloves, aprons, non-slip shoes — sizes stocked', result: 'Pass', action: 'Order medium cut gloves', by: u, at: ago(3), code: 'KHS' },
        { id: rid('sc'), ref: ref('KHS', 203), site: siteId, checkType: 'First Aid', items: 'Kit complete, accident book available, 2 trained first aiders on rota', result: 'Pass', action: 'Reorder blue plasters', by: u, at: ago(7), code: 'KHS' },
      ],
      foodComplaints: [
        { id: rid('kfs'), ref: ref('KFS', 501), site: siteId, type: 'Food complaint', customer: 'Guest — table 12', date: ago(2).slice(0, 10), product: 'Caesar salad', issue: 'Plastic fragment suspected in salad — batch traced', illness: false, notified: 'Manager on duty', action: 'Batch withdrawn; supplier contacted; apology issued', status: 'Closed', by: u, at: ago(2), code: 'KFS' },
        { id: rid('kfs'), ref: ref('KFS', 502), site: siteId, type: 'Food poisoning allegation', customer: 'Phone complaint — room 204', date: ago(8).slice(0, 10), product: 'Breakfast buffet — eggs', issue: 'Guest reported nausea 6h after meal', illness: true, notified: 'Head chef + hotel manager', action: 'Samples retained; EHO notified; investigation closed — no link found', status: 'Closed', by: u, at: ago(8), code: 'KFS' },
      ],
      probeCalibration: [
        { id: rid('pc'), ref: ref('KFS', 701), site: siteId, probe: 'Thermapen #1 — hot line', method: 'Ice bath 0°C / boiling 100°C', iceReading: 0.1, boilReading: 99.8, adjustment: 'Within ±1°C — no adjustment', nextDue: ago(-30).slice(0, 10), by: u, at: ago(2), code: 'KFS' },
        { id: rid('pc'), ref: ref('KFS', 702), site: siteId, probe: 'Pen probe #2 — goods-in', method: 'Ice bath / boiling verification', iceReading: -0.5, boilReading: 100.2, adjustment: 'Within tolerance', nextDue: ago(-28).slice(0, 10), by: u, at: ago(2), code: 'KFS' },
        { id: rid('pc'), ref: ref('KFS', 703), site: siteId, probe: 'Bluetooth logger #3', method: 'Calibrated against reference probe', iceReading: 0.0, boilReading: 99.9, adjustment: 'Offset +0.2°C applied in app', nextDue: ago(-25).slice(0, 10), by: u, at: ago(5), code: 'KFS' },
      ],
      thirdPartyEvents: [
        { id: rid('tp'), ref: ref('KFS', 801), site: siteId, event: 'Corporate dinner — 80 covers', caterer: 'In-house brigade', date: ago(-14).slice(0, 10), menuApproved: true, allergenBrief: true, tempChecks: true, signedOff: 'Sarah Mitchell', notes: 'Separate allergen prep area; delivery temps logged', by: u, at: ago(15), code: 'KFS' },
        { id: rid('tp'), ref: ref('KFS', 802), site: siteId, event: 'Wedding reception — external caterer', caterer: 'Premier Events Catering Ltd', date: ago(-3).slice(0, 10), menuApproved: true, allergenBrief: true, tempChecks: true, signedOff: 'Duty manager', notes: 'Contractor HACCP cert on file; fridge space allocated', by: u, at: ago(4), code: 'KFS' },
      ],
      haccpPlans: [
        { id: rid('hp'), ref: ref('KHACCP', 1), site: siteId, title: 'Main kitchen HACCP plan', version: '3.2', owner: 'Head Chef / Compliance lead', scope: 'Hot & cold kitchen — restaurant and banqueting', steps: HACCP_STEPS.map(s => Object.assign({}, s)), reviewDate: ago(-90).slice(0, 10), approvedBy: 'Sarah Mitchell', at: ago(10), code: 'KHACCP', status: 'Active' },
        { id: rid('hp'), ref: ref('KHACCP', 2), site: siteId, title: 'Pastry & dessert HACCP addendum', version: '1.1', owner: 'Pastry chef', scope: 'Dessert section — cooling and display', steps: HACCP_STEPS.filter((_, i) => [2, 4, 6, 8].includes(i)).map((s, i) => Object.assign({}, s, { step: i + 1 })), reviewDate: ago(-60).slice(0, 10), approvedBy: 'Sarah Mitchell', at: ago(20), code: 'KHACCP', status: 'Active' },
      ],
      fsmsDocuments: FSMS_TEMPLATES.map((t, i) => ({
        id: rid('fsms'), ref: ref('KFS', 900 + i + 1), site: siteId, title: t.title, section: t.section,
        version: '1.' + (i + 1), status: i < 8 ? 'Approved' : 'Draft', reviewDate: new Date(Date.now() + t.reviewMonths * 30 * 864e5).toISOString().slice(0, 10),
        owner: 'Compliance Lead', at: ago(20 + i), code: 'KFS',
      })),
      equipmentMaintenance: [
        { id: rid('em'), ref: ref('KHS', 301), site: siteId, equipment: 'Dishwasher — main pot wash', type: 'PPM service', due: ago(-7).slice(0, 10), completed: ago(5).slice(0, 10), provider: 'Facilities Team', result: 'Pass — wash temps 82°C verified', nextDue: ago(-180).slice(0, 10), by: u, at: ago(5), code: 'KHS' },
        { id: rid('em'), ref: ref('KHS', 302), site: siteId, equipment: 'Extraction hood & filters', type: 'Deep clean & filter change', due: ago(0).slice(0, 10), completed: '', provider: 'Grease-tek Ltd', result: 'Scheduled — 22 Jun', nextDue: ago(-90).slice(0, 10), by: u, at: ago(1), code: 'KHS' },
        { id: rid('em'), ref: ref('KHS', 303), site: siteId, equipment: 'Walk-in fridge compressor', type: 'Annual service', due: ago(-14).slice(0, 10), completed: ago(12).slice(0, 10), provider: 'CoolFix Refrigeration', result: 'Pass — gas levels OK', nextDue: ago(-350).slice(0, 10), by: u, at: ago(12), code: 'KHS' },
      ],
    };
  }

  function teamForSite(db, siteId) {
    const m = (db.team || []).find(t => t.siteId === siteId);
    return (m && m.id) || (db.team && db.team[0] && db.team[0].id) || 'u_sarah';
  }

  function ensureSiteModuleSamples(db, siteId) {
    if (!siteId) return;
    const batch = seedCompliance(siteId, teamForSite(db, siteId));
    Object.keys(batch).forEach(k => {
      if (!Array.isArray(db.compliance[k])) db.compliance[k] = [];
      const has = db.compliance[k].some(r => r.site === siteId);
      if (!has) db.compliance[k] = db.compliance[k].concat(batch[k]);
    });
  }

  function ensureSamples(db) {
    const isPrivate = !!(db._tenantPrivate || db._isPrivate);
    const sites = isPrivate
      ? [db.currentSite || 'site_grove'].filter(Boolean)
      : SAMPLE_SITES.filter(id => (db.sites || []).some(s => s.id === id));
    if (!sites.length) sites.push(db.currentSite || 'site_grove');
    if (db.currentSite && !sites.includes(db.currentSite)) sites.push(db.currentSite);
    sites.forEach(siteId => ensureSiteModuleSamples(db, siteId));
  }

  function ensure(db) {
    const empty = emptyCompliance();
    if (!db.compliance || typeof db.compliance !== 'object') db.compliance = Object.assign({}, empty);
    Object.keys(empty).forEach(k => { if (!Array.isArray(db.compliance[k])) db.compliance[k] = []; });
    const isPrivate = !!(db._tenantPrivate || db._isPrivate);
    const needsRefresh = db._complianceSampleVersion !== SAMPLE_VERSION;
    if (needsRefresh && !isPrivate) {
      db.compliance = Object.assign({}, empty);
      db._complianceSampleVersion = SAMPLE_VERSION;
    }
    ensureSamples(db);
    if (needsRefresh && window.Store && window.Store.persist) window.Store.persist();
    return db.compliance;
  }

  function nextRef(code, key) {
    const db = S().db;
    ensure(db);
    const list = db.compliance[key] || [];
    const nums = list.map(r => (r.ref || '').match(/-(\d+)$/)).filter(Boolean).map(m => +m[1]);
    const n = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${code}-${String(n).padStart(4, '0')}`;
  }

  function userRank() {
    if (window.App && window.App.currentUser) return window.App.currentUser().rank || 1;
    return 3;
  }

  function canViewModule(moduleId) {
    const mod = MODULES.find(m => m.id === moduleId);
    if (!mod) return true;
    if (mod.managerOnly && userRank() < 2) return false;
    return true;
  }

  function canViewSensitiveList(moduleId) {
    const mod = MODULES.find(m => m.id === moduleId);
    return !mod || !mod.sensitive || userRank() >= 2;
  }

  function canExport() {
    return userRank() >= 2;
  }

  function siteRecords(key, siteId) {
    const db = S().db;
    ensure(db);
    const site = siteId || db.currentSite;
    return (db.compliance[key] || []).filter(r => r.site === site).sort((a, b) => new Date(b.at || b.date || 0) - new Date(a.at || a.date || 0));
  }

  function counts(siteId) {
    const keys = Object.keys(emptyCompliance());
    const out = {};
    keys.forEach(k => { out[k] = siteRecords(k, siteId).length; });
    out.total = keys.reduce((n, k) => n + out[k], 0);
    return out;
  }

  function rowToCsv(row, fields) {
    return fields.map(f => {
      const v = row[f];
      if (v == null) return '';
      if (typeof v === 'object') return JSON.stringify(v);
      return String(v);
    });
  }

  function exportModuleCsv(key, siteId) {
    const { downloadCsv } = window.UI;
    const site = S().site(siteId || S().db.currentSite);
    const rows = siteRecords(key, siteId);
    const maps = {
      hsChecks: ['ref', 'type', 'areas', 'findings', 'action', 'status', 'at'],
      riskAssessments: ['ref', 'area', 'hazards', 'likelihood', 'severity', 'risk', 'residual', 'reviewDate', 'status'],
      coshh: ['ref', 'product', 'hazard', 'storage', 'ppe', 'sdsDate', 'reviewDate'],
      accidents: ['ref', 'injured', 'date', 'location', 'type', 'description', 'firstAid', 'riddor', 'status'],
      inductions: ['ref', 'staff', 'topics', 'trainer', 'signed', 'at', 'reviewDate'],
      manualHandling: ['ref', 'task', 'load', 'method', 'teamLift', 'lastReview'],
      safetyChecks: ['ref', 'checkType', 'items', 'result', 'action', 'at'],
      foodComplaints: ['ref', 'type', 'customer', 'date', 'product', 'issue', 'illness', 'status'],
      probeCalibration: ['ref', 'probe', 'method', 'iceReading', 'boilReading', 'adjustment', 'nextDue'],
      thirdPartyEvents: ['ref', 'event', 'caterer', 'date', 'menuApproved', 'allergenBrief', 'signedOff'],
      haccpPlans: ['ref', 'title', 'version', 'scope', 'reviewDate', 'status'],
      fsmsDocuments: ['ref', 'title', 'section', 'version', 'status', 'reviewDate'],
      equipmentMaintenance: ['ref', 'equipment', 'type', 'due', 'completed', 'provider', 'result', 'nextDue'],
    };
    const fields = maps[key] || ['ref', 'at'];
    downloadCsv(`kiteline-${key}-${site.name.replace(/\s+/g, '-').toLowerCase()}.csv`, [fields, ...rows.map(r => rowToCsv(r, fields))]);
  }

  function exportAuditZip(siteId) {
    if (!canExport()) return Promise.reject(new Error('Manager access required for audit exports'));
    const site = S().site(siteId || S().db.currentSite);
    const db = S().db;
    ensure(db);
    const pack = {
      exported: new Date().toISOString(),
      site: site.name,
      codes: CODES,
      compliance: {},
    };
    Object.keys(emptyCompliance()).forEach(k => {
      pack.compliance[k] = siteRecords(k, siteId);
    });
    pack.existingModules = {
      checklists: (db.checklists || []).filter(c => c.site === (siteId || db.currentSite)).length,
      temperatureLogs: (db.records || []).filter(r => r.site === (siteId || db.currentSite)).length,
      incidents: (db.incidents || []).filter(i => i.site === (siteId || db.currentSite)).length,
      training: (db.training || []).length,
    };
    const json = JSON.stringify(pack, null, 2);
    if (typeof JSZip === 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kiteline-audit-pack-${site.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      return Promise.resolve('json');
    }
    const zip = new JSZip();
    zip.file('README.txt', 'Kiteline Kitchen Compliance Audit Pack\nSite: ' + site.name + '\nCodes: ' + Object.entries(CODES).map(([k, v]) => k + ' = ' + v).join('\n'));
    zip.file('audit-pack.json', json);
    Object.keys(emptyCompliance()).forEach(k => {
      const rows = siteRecords(k, siteId);
      if (!rows.length) return;
      const maps = {
        hsChecks: ['ref', 'type', 'areas', 'findings', 'action', 'status', 'at'],
        riskAssessments: ['ref', 'area', 'hazards', 'risk', 'residual', 'reviewDate'],
        coshh: ['ref', 'product', 'hazard', 'storage', 'ppe'],
        accidents: ['ref', 'injured', 'date', 'type', 'description', 'status'],
        foodComplaints: ['ref', 'type', 'customer', 'product', 'issue', 'status'],
        haccpPlans: ['ref', 'title', 'version', 'status'],
        fsmsDocuments: ['ref', 'title', 'section', 'version', 'status'],
      };
      const fields = maps[k] || ['ref', 'at'];
      const csv = [fields.join(',')].concat(rows.map(r => rowToCsv(r, fields).map(v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v).join(','))).join('\n');
      zip.file(`csv/${k}.csv`, csv);
    });
    return zip.generateAsync({ type: 'blob' }).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `kiteline-audit-${site.name.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  window.Compliance = {
    CODES, MODULES, RISK_AREAS, HACCP_STEPS, FSMS_TEMPLATES,
    SENSITIVE_KEYS, emptyCompliance, seedCompliance, ensure, nextRef,
    canViewModule, canViewSensitiveList, canExport, siteRecords, counts, exportModuleCsv, exportAuditZip,
  };
  if (window.Store && window.Store.db) ensure(window.Store.db);
})();
