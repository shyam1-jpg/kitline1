'use strict';
/**
 * Trigger Render deploy for kitline1 and save GitHub RENDER_DEPLOY_HOOK secret.
 * Usage: set RENDER_API_KEY=rnd_... && node server/scripts/setup-render-deploy.js
 */
const https = require('https');
const { execSync } = require('child_process');
const path = require('path');

const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'kitline1';

function api(method, urlPath, body) {
  const key = process.env.RENDER_API_KEY;
  if (!key) throw new Error('Set RENDER_API_KEY (Render → Account → API Keys)');
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: 'api.render.com',
        path: urlPath,
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          let parsed = raw;
          try { parsed = raw ? JSON.parse(raw) : null; } catch { /* text */ }
          if (res.statusCode >= 400) {
            reject(new Error(`Render API ${res.statusCode}: ${typeof parsed === 'object' ? JSON.stringify(parsed) : raw}`));
          } else resolve(parsed);
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function findServiceId() {
  if (process.env.RENDER_SERVICE_ID) return process.env.RENDER_SERVICE_ID;
  const list = await api('GET', '/v1/services?limit=100');
  const items = Array.isArray(list) ? list : (list.items || []);
  const svc = items.find((s) => (s.service?.name || s.name) === SERVICE_NAME);
  const id = svc?.service?.id || svc?.id;
  if (!id) {
    const names = items.map((s) => s.service?.name || s.name).filter(Boolean);
    throw new Error(`Service "${SERVICE_NAME}" not found. Found: ${names.join(', ') || 'none'}`);
  }
  return id;
}

async function getOrCreateDeployHook(serviceId) {
  const list = await api('GET', `/v1/services/${serviceId}/deploy-hooks`);
  const hooks = Array.isArray(list) ? list : (list.items || list.deployHooks || []);
  const existing = hooks.find((h) => (h.deployHook?.url || h.url));
  if (existing) {
    return existing.deployHook?.url || existing.url;
  }
  const created = await api('POST', `/v1/services/${serviceId}/deploy-hooks`, {
    name: 'github-actions',
  });
  return created.deployHook?.url || created.url;
}

async function main() {
  console.log('Finding Render service:', SERVICE_NAME);
  const serviceId = await findServiceId();
  console.log('Service ID:', serviceId);

  console.log('Creating deploy on Render...');
  const deploy = await api('POST', `/v1/services/${serviceId}/deploys`, { clearCache: 'do_not_clear' });
  const deployId = deploy.deploy?.id || deploy.id;
  console.log('Deploy started:', deployId || 'ok');

  console.log('Getting deploy hook URL...');
  const hookUrl = await getOrCreateDeployHook(serviceId);
  console.log('Deploy hook ready');

  const root = path.join(__dirname, '..', '..');
  try {
    execSync(`gh secret set RENDER_DEPLOY_HOOK --body "${hookUrl.replace(/"/g, '\\"')}"`, {
      cwd: root,
      stdio: 'inherit',
    });
    console.log('GitHub secret RENDER_DEPLOY_HOOK saved.');
  } catch (e) {
    console.warn('Could not save GitHub secret (run gh auth login):', e.message);
    console.log('\nAdd this manually at github.com/shyam1-jpg/kitline1/settings/secrets/actions');
    console.log('Name: RENDER_DEPLOY_HOOK');
    console.log('Value:', hookUrl);
  }

  console.log('\nDone. Wait 2-3 minutes then open:');
  console.log('  https://kiteline.uk/vedanta-ordering/');
}

main().catch((e) => {
  console.error('Setup failed:', e.message);
  process.exit(1);
});
