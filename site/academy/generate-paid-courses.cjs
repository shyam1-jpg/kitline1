#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const CURR = path.join(__dirname, 'curriculum.js');
function p(parts) { return parts.map(function (x) { return '<p>' + x + '</p>'; }).join(''); }
function lessonLine(id, title, mins, body, opts) {
  opts = opts || {};
  const bodyStr = Array.isArray(body) ? p(body) : body;
  const o = { objective: opts.objective || ('Learn and practice ' + title + '.'), tryIt: opts.tryIt || 'Edit the example and run preview.' };
  if (opts.editor) o.editor = opts.editor;
  if (opts.exercise) o.exercise = opts.exercise;
  if (opts.quiz) o.quiz = opts.quiz;
  if (opts.type) o.type = opts.type;
  return '        lesson("' + id + '", "' + title.replace(/"/g, '\\"') + '", ' + mins + ',\n          ' + JSON.stringify(bodyStr) + ',\n          ' + JSON.stringify(o) + '),';
}
function courseBlock(cfg) {
  const lines = cfg.lessons.map(function (l) { return lessonLine(l[0], l[1], l[2], l[3], l[4] || {}); });
  return "    '" + cfg.id + "': {\n      id: '" + cfg.id + "',\n      title: '" + cfg.title.replace(/'/g, "\\'") + "',\n      track: '" + cfg.track + "',\n      tier: 'paid',\n      teacher: 'Shyam Prasad',\n      icon: '" + cfg.icon + "',\n      duration: '" + cfg.duration + "',\n      lessonCount: " + cfg.lessons.length + ",\n      desc: '" + cfg.desc.replace(/'/g, "\\'") + "',\n      outcomes: " + JSON.stringify(cfg.outcomes) + ",\n      lessons: [\n" + lines.join('\n') + "\n      ],\n    },";
}
const PAID = [
  { id: 'excel-starter', title: 'Excel Starter', track: 'beginner', icon: '📊', duration: '~2 hours', desc: 'Spreadsheets for work and study: formulas, tables, charts, and Copilot-assisted reporting.', outcomes: ['Build clean tables and charts', 'Use SUM and IF formulas', 'Ask Copilot to draft formulas safely'], lessons: [
    ['xls-1','What is Excel?',8,['Spreadsheets store data in rows and columns.','Cells are addressed like A1, B2.'],{}],
    ['xls-2','Entering data',10,['Type in cells; Tab moves right; Enter moves down.'],{editor:{lang:'html',starter:'<table border="1"><tr><th>Item</th><th>Qty</th></tr><tr><td>Milk</td><td>2</td></tr></table>'}}],
    ['xls-3','SUM and basic formulas',12,['Formulas start with =.','SUM(A1:A10) adds a range.'],{tryIt:'Plan a SUM formula for cells B2 to B8.'}],
    ['xls-4','Formatting cells',10,['Bold, currency, and number formats make reports readable.'],{}],
    ['xls-5','Sort and filter',12,['Sort A-Z; filters hide rows that do not match.'],{}],
    ['xls-6','IF formulas',14,['=IF(test, value_if_true, value_if_false) for decisions.'],{tryIt:'Write an IF that shows Pass when score >= 70.'}],
    ['xls-7','Charts',12,['Select data, insert chart, choose bar or line.'],{}],
    ['xls-8','Tables',10,['Excel Tables add filter buttons automatically.'],{}],
    ['xls-9','Copilot in Excel',10,['Ask Copilot to explain a formula — always verify.'],{}],
    ['xls-10','Mini project: budget sheet',20,['Build income, expenses, and balance rows.'],{type:'try',exercise:'Add a chart for monthly expenses.',editor:{lang:'html',starter:'<h2>Monthly budget</h2><table border="1"><tr><th>Category</th><th>Amount</th></tr><tr><td>Rent</td><td>800</td></tr></table>'}}],
  ]},
  { id: 'sql-starter', title: 'SQL Starter', track: 'beginner', icon: '🗄️', duration: '~2.5 hours', desc: 'Query databases with SELECT, WHERE, JOIN, and GROUP BY.', outcomes: ['Read and write SQL queries', 'Filter and sort data', 'Combine tables with JOINs'], lessons: [
    ['sql-2','What is a database?',8,['Tables store rows with columns (fields).'],{}],
    ['sql-3','SELECT basics',12,['SELECT column FROM table; use * for all columns.'],{editor:{lang:'html',starter:'<pre>SELECT name, email FROM students;</pre>'}}],
    ['sql-4','WHERE filter',12,['WHERE age >= 18 filters rows.'],{editor:{lang:'html',starter:'<pre>SELECT * FROM products WHERE price < 10;</pre>'}}],
    ['sql-5','ORDER BY',10,['ORDER BY price DESC sorts results.'],{}],
    ['sql-6','INSERT and UPDATE',14,['INSERT adds rows; UPDATE changes existing rows.'],{}],
    ['sql-7','JOIN tables',15,['INNER JOIN links related tables on a key.'],{editor:{lang:'html',starter:'<pre>SELECT orders.id, customers.name FROM orders INNER JOIN customers ON orders.customer_id = customers.id;</pre>'}}],
    ['sql-8','GROUP BY',14,['GROUP BY with COUNT(*) for summaries.'],{}],
    ['sql-9','Keys and NULL',10,['PRIMARY KEY and NOT NULL keep data clean.'],{}],
    ['sql-10','Mini project: shop queries',18,['Write queries for a small shop.'],{type:'try',exercise:'List top 5 products by sales.'}],
  ]},
  { id: 'ai-tools-beginners', title: 'AI Tools for Beginners (paid path)', track: 'free', icon: '🧠', duration: '~2 hours', desc: 'Guided path beyond the free AI World track.', outcomes: ['Structured AI tool practice', 'Study workflows', 'Responsible AI habits'], lessons: [
    ['atb-2','Beyond free AI World',8,['Paid path adds structured projects and certificate support.'],{}],
    ['atb-3','ChatGPT for study',12,['Summarise, quiz yourself, explain simply.'],{}],
    ['atb-4','Claude for documents',12,['Upload PDFs; ask for outlines.'],{}],
    ['atb-5','Perplexity for research',10,['Cited answers for facts.'],{}],
    ['atb-6','Copilot in Office',12,['Excel, Word — verify AI output.'],{}],
    ['atb-7','Image tools',10,['Basics of AI image generators.'],{}],
    ['atb-8','Coding assistants',14,['Use AI to explain and debug code safely.'],{}],
    ['atb-9','Workflow automation',12,['Chain prompts: research, draft, review.'],{}],
    ['atb-10','Capstone: AI study plan',20,['Build a 4-week plan with tools and prompts.'],{type:'try',exercise:'Write 5 custom prompts for your goal.'}],
  ]},
  { id: 'react-starter', title: 'React Starter', track: 'intermediate', icon: '⚛️', duration: '~2.5 hours', desc: 'Components, props, state, hooks, and a small app.', outcomes: ['Build React components', 'Manage state with hooks', 'Fetch data into a UI'], lessons: [
    ['rx-2','What is React?',10,['React builds UIs from reusable components.'],{}],
    ['rx-3','JSX basics',12,['JSX looks like HTML inside JavaScript.'],{editor:{lang:'html',starter:'<div id="root"></div>'}}],
    ['rx-4','Components and props',14,['Props pass data into components.'],{}],
    ['rx-5','State with useState',15,['State lets components update when data changes.'],{}],
    ['rx-6','Events and forms',12,['onClick and controlled inputs.'],{}],
    ['rx-7','Lists and keys',10,['Map arrays to JSX with unique keys.'],{}],
    ['rx-8','useEffect intro',14,['Side effects after render.'],{}],
    ['rx-9','Fetch from an API',15,['fetch() in useEffect to load JSON.'],{}],
    ['rx-10','Mini project: task list',20,['Build add and complete tasks UI.'],{type:'try',exercise:'Add a delete button per task.'}],
  ]},
  { id: 'node-starter', title: 'Node.js Starter', track: 'intermediate', icon: '🟢', duration: '~2 hours', desc: 'Server-side JavaScript: APIs and Express basics.', outcomes: ['Create a simple API', 'Understand npm', 'Connect frontend to backend'], lessons: [
    ['nd-2','What is Node.js?',10,['JavaScript on the server for APIs and automation.'],{}],
    ['nd-3','npm basics',12,['npm install packages; scripts in package.json.'],{}],
    ['nd-4','Hello HTTP server',14,['Express listens on a port.'],{editor:{lang:'html',starter:'<pre>const express = require("express");\nconst app = express();\napp.get("/", (req, res) => res.send("Hello"));\napp.listen(3000);</pre>'}}],
    ['nd-5','Routes and JSON',12,['app.get/post; res.json({ ok: true }).'],{}],
    ['nd-6','Request body',12,['express.json() for POST JSON.'],{}],
    ['nd-7','Environment variables',10,['process.env.PORT — never commit secrets.'],{}],
    ['nd-8','Static files and CORS',12,['Serve frontend; CORS for local dev.'],{}],
    ['nd-9','Mini API project',18,['Build GET and POST /api/items.'],{type:'try',exercise:'Add DELETE /api/items/:id.'}],
  ]},
];
let src = fs.readFileSync(CURR, 'utf8');
PAID.forEach(function (cfg) {
  const key = "'" + cfg.id + "': {";
  const start = src.indexOf(key);
  if (start < 0) throw new Error('Course not found: ' + cfg.id);
  let depth = 0, end = start;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  src = src.slice(0, start) + courseBlock(cfg) + src.slice(end);
  console.log('Updated', cfg.id, cfg.lessons.length, 'lessons');
});
fs.writeFileSync(CURR, src, 'utf8');