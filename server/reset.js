/* Wipe the JSON database so the app re-seeds fresh demo data on next start. */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
try {
  if (fs.existsSync(DB_FILE)) {
    fs.unlinkSync(DB_FILE);
    console.log('Database reset: deleted ' + DB_FILE);
  } else {
    console.log('Nothing to reset (no db.json found).');
  }
} catch (e) {
  console.error('Reset failed:', e.message);
  process.exit(1);
}
