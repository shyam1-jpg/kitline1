/* Quick test: node server/test-notify.js */
'use strict';
const http = require('http');

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const d = JSON.stringify(body || {});
    const req = http.request({
      hostname: 'localhost', port: 4001, path: '/api' + path, method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(d),
        Authorization: token ? 'Bearer ' + token : '',
      },
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try { resolve({ code: res.statusCode, body: JSON.parse(b || '{}') }); }
        catch { resolve({ code: res.statusCode, body: b }); }
      });
    });
    req.on('error', reject);
    req.write(d);
    req.end();
  });
}

(async () => {
  const login = await post('/login', { email: 'shyam_1@hotmail.co.uk', password: 'shyam' });
  console.log('Login:', login.code);
  const token = login.body.token;
  const test = await post('/notify/test', {}, token);
  console.log('Test notify:', JSON.stringify(test, null, 2));
})().catch((e) => { console.error(e); process.exit(1); });
