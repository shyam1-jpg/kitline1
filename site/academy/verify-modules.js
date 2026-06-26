#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const dir = __dirname;
let failed = 0;

function fail(msg) {
  console.log('FAIL:', msg);
  failed++;
}

function pass(msg) {
  console.log('OK:', msg);
}

function loadBrowser(file, ctx) {
  vm.runInNewContext(fs.readFileSync(path.join(dir, file), 'utf8'), ctx, { filename: file });
}

const ctx = {
  window: {},
  document: {
    getElementById: () => null,
    querySelectorAll: () => [],
    body: { style: {} },
  },
  localStorage: {
    _: {},
    getItem(k) { return this._[k] || null; },
    setItem(k, v) { this._[k] = String(v); },
  },
  location: { hash: '', pathname: '/academy/' },
  history: { replaceState() {} },
  fetch: async () => ({ ok: false, json: async () => ({}) }),
};
ctx.window = ctx;
ctx.global = ctx;

for (const f of ['curriculum.js', 'learn.js']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(dir, f)], { stdio: 'pipe' });
    pass(f + ' syntax');
  } catch (e) {
    fail(f + ' syntax error');
  }
}

loadBrowser('curriculum.js', ctx);
loadBrowser('learn.js', ctx);

const CC = ctx.window.KA_CURRICULUM;
const LL = ctx.window.KA_LEARN;

if (!CC) fail('KA_CURRICULUM missing');
else pass('KA_CURRICULUM loaded');

if (!LL) fail('KA_LEARN missing');
else pass('KA_LEARN loaded - ' + Object.keys(LL).length + ' exports');

if (CC) {
  if (Object.keys(CC.COURSES || {}).length < 10) fail('expected 10+ courses');
  else pass('courses: ' + Object.keys(CC.COURSES).length);

  if ((CC.AI_TOOLS || []).length < 8) fail('expected 8 AI tools');
  else pass('AI tools: ' + CC.AI_TOOLS.length);

  if ((CC.SOURCES || []).length < 10) fail('expected 10+ sources');
  else pass('sources: ' + CC.SOURCES.length);

  const freeMinLessons = { 'html-starter': 20, 'css-starter': 15, 'js-starter': 30, 'python-starter': 25 };
  for (const id of CC.FREE_COURSE_IDS || []) {
    const c = CC.getCourse(id);
    if (!c) fail('free course missing: ' + id);
    else if (!c.lessons || !c.lessons.length) fail('no lessons: ' + id);
    else if (freeMinLessons[id] && c.lessons.length < freeMinLessons[id]) fail(id + ' expected >=' + freeMinLessons[id] + ' lessons, got ' + c.lessons.length);
    else {
      const bad = c.lessons.filter(l => !l.content || l.content.length < 50);
      if (bad.length) fail(id + ' thin lessons: ' + bad.map(x => x.id).join(', '));
      else pass(id + ': ' + c.lessons.length + ' lessons with content');
      const noObj = c.lessons.filter(l => !l.objective);
      if (noObj.length) fail(id + ' missing objectives: ' + noObj.map(x => x.id).join(', '));
      else pass(id + ': all lessons have objectives');
    }
  }
}

const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
if (/Staff area|loadAdminStudents|id="admin"/.test(html)) fail('public index.html still has staff area');
else pass('public page has no staff area');

if (!html.includes('checkoutModal')) fail('checkout modal missing from index');
else pass('checkout modal present');

if (!fs.existsSync(path.join(dir, 'learn.html'))) fail('learn.html missing');
else pass('learn.html present');

if (!html.includes('curriculum.js?v=6')) fail('bump cache version to v=6 for deploy');
else pass('cache bust v=6 set');

console.log('\n' + (failed ? failed + ' check(s) failed' : 'All module checks passed'));
process.exit(failed ? 1 : 0);