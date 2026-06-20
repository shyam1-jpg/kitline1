'use strict';
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) return;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
}

const user = process.env.SMTP_USER || 'shyam.prasad@thevedanta.org';
const pass = process.env.SMTP_PASS || process.argv[2];
if (!pass) {
  console.log('Usage: node test-smtp.js <password-or-app-password>');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: +(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user, pass },
});

(async () => {
  try {
    await transporter.verify();
    console.log('SMTP verify OK');
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `The Vedanta Rota <${user}>`,
      to: process.env.VEDANTA_REPORT_EMAIL || 'Operation@thevedanta.org',
      subject: 'Vedanta Rota — test report email',
      text: 'This is a test from Kiteline. Weekly and monthly rota reports will be sent automatically.',
    });
    console.log('Sent:', info.messageId);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exit(1);
  }
})();
