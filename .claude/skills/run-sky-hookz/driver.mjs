#!/usr/bin/env node
// Drives the Sky-hookz yard app: starts/stops the production server, runs API
// smoke checks, takes screenshots and does a crane pickup/drop through the UI.
// Usage (from the repo root): node .claude/skills/run-sky-hookz/driver.mjs <command> [args]
import { createRequire } from 'node:module';
import { execFile, execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const UNIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = 3000; // hardcoded in server.ts
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS_DIR || '/tmp/shots/sky-hookz';
const LOG = '/tmp/sky-hookz.log';

const [cmd, ...args] = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Playwright isn't a project dependency; use the container's global install
function playwright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* fall through */ }
  return require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

async function api(method, route, body) {
  const res = await fetch(BASE + route, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  let json = null;
  try { json = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, json };
}

async function up() {
  try { return (await fetch(BASE + '/api/health')).ok; } catch { return false; }
}

// Kill whatever listens on the port (never a broad pkill: it can match your own shell)
function stop() {
  execSync(`lsof -ti:${PORT} -sTCP:LISTEN | xargs -r kill`, { stdio: 'inherit', shell: '/bin/bash' });
}

async function start() {
  if (!existsSync(path.join(UNIT, 'dist/server.cjs'))) throw new Error('dist/server.cjs is missing: run `npm run build` first.');
  stop();
  for (let i = 0; i < 20 && await up(); i++) await sleep(250);
  const log = openSync(LOG, 'w');
  const child = spawn('node', ['dist/server.cjs'], { cwd: UNIT, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  for (let i = 0; i < 60; i++) {
    if (await up()) { console.log(`up: ${BASE} (pid ${child.pid}, log ${LOG})`); return; }
    await sleep(500);
  }
  throw new Error(`server did not answer /api/health within 30s; see ${LOG}`);
}

async function smoke() {
  const checks = [
    ['health answers ok', async () => (await api('GET', '/api/health')).json?.status === 'ok'],
    ['bundles listed', async () => (await api('GET', '/api/bundles')).json?.length > 0],
    ['unknown API route answers JSON 404', async () => {
      const r = await api('GET', '/api/nope');
      return r.status === 404 && /No API route/.test(r.json?.error);
    }],
    ['epoxy refused at a black-bar door', async () => {
      const r = await api('POST', '/api/bundles/TG-104/drop', { location: 'Door-8' });
      return r.status === 400 && /NW\/NE doors/.test(r.json?.error);
    }],
    ['black bar refused on a non-SW crane', async () => (await api('POST', '/api/bundles/TG-202/pickup', { craneId: 'Crane-NE' })).status === 400],
    ['dashboard metrics', async () => typeof (await api('GET', '/api/dashboard')).json?.loadedCount === 'number']
  ];
  let failed = 0;
  for (const [name, check] of checks) {
    const ok = await check().catch(() => false);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  }
  if (failed) throw new Error(`${failed} smoke check(s) failed`);
}

// Chromium doesn't trust this container's egress proxy CA, so Google Fonts fails with
// ERR_CERT_AUTHORITY_INVALID and pages fall back to system fonts. curl does trust it
// (it reads /root/.ccr/ca-bundle.crt), so fetch fonts with curl and hand them to the page.
async function fontsViaCurl(context) {
  const run = promisify(execFile);
  await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const req = route.request();
    try {
      const { stdout } = await run('curl', ['-sS', '--fail', '-m', '20', '-A', req.headers()['user-agent'] || 'Mozilla/5.0', req.url()],
        { encoding: 'buffer', maxBuffer: 20 << 20 });
      const contentType = req.url().includes('googleapis') ? 'text/css; charset=utf-8' : 'font/woff2';
      await route.fulfill({ status: 200, body: stdout, contentType, headers: { 'access-control-allow-origin': '*' } });
    } catch {
      await route.abort();
    }
  });
}

async function withPage(width, fn) {
  const { chromium } = playwright();
  const browser = await chromium.launch();
  // Plant time, so dates and shift labels match what operators see
  const context = await browser.newContext({ viewport: { width, height: 1000 }, timezoneId: 'America/Chicago', locale: 'en-US' });
  await fontsViaCurl(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
  // Chromium logs every refused API call ("status of 400") as a console error; the app handles those
  const refusals = errors.filter(e => /status of 4\d\d/.test(e));
  const real = errors.filter(e => !refusals.includes(e));
  if (refusals.length) console.log(`API refusals shown to the user: ${refusals.length}`);
  console.log(real.length ? `console errors:\n  ${real.join('\n  ')}` : 'console errors: none');
  if (real.length) process.exitCode = 1;
}

async function open(page, route) {
  await page.goto(BASE + route);
  // Never wait for 'networkidle': the /api/updates SSE stream keeps a request open forever
  await page.locator('#main-navigation-bar').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600); // let colour transitions settle before a screenshot
}

async function snap(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage: args.includes('--full') });
  console.log(`screenshot: ${file}`);
}

async function shot(route = '/') {
  const width = Number(flag('width', 1440));
  await withPage(width, async page => {
    await open(page, route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    console.log(`page: ${route} at ${width}px, horizontal overflow ${overflow}px`);
    await snap(page, `${route.replace(/\W+/g, '-').replace(/^-|-$/g, '') || 'home'}-${width}`);
  });
}

// Hoist a bundle with the active crane and set it down, the way an operator does
async function crane() {
  const tag = flag('tag');
  const target = flag('to', 'Rack K-1');
  const craneId = flag('crane'); // default is whatever the cab opens on (Crane-NW)
  await withPage(1440, async page => {
    await open(page, '/crane');
    // Success and refusal both land in this notice: "CONE STATUS LOCKED: ..." or "CRANE RIGGING EXCEPTION: ..."
    const notice = page.locator('div.flex-1').filter({ has: page.locator('span.font-bold', { hasText: /^(CONE STATUS LOCKED|CRANE RIGGING EXCEPTION):$/ }) }).first();
    const noticeText = async () => (await notice.isVisible()) ? (await notice.innerText()).replace(/\s+/g, ' ').trim() : '';
    if (craneId) await page.getByRole('button', { name: new RegExp(craneId, 'i') }).click();
    const hoists = page.getByRole('button', { name: /RIG \/ HOIST/ });
    await hoists.first().waitFor();
    let index = 0;
    if (tag) {
      const cards = await hoists.evaluateAll(bs => bs.map(b => b.parentElement.innerText));
      index = cards.findIndex(t => t.trim().startsWith(tag));
      if (index < 0) throw new Error(`${tag} is not waiting for a crane (not in the pickup list)`);
    }
    const picked = (await hoists.nth(index).evaluate(b => b.parentElement.innerText)).trim().split(/\s+/)[0];
    await hoists.nth(index).click();
    const select = page.locator('select').filter({ has: page.locator('option', { hasText: 'Click to Target Zone' }) });
    // A refused pickup (e.g. black bar on a non-SW crane) never shows the drop menu
    await Promise.race([select.waitFor(), notice.waitFor()]);
    await page.waitForTimeout(300);
    if (!(await select.isVisible())) {
      console.log(`crane: pickup of ${picked} refused: ${await noticeText()}`);
      await snap(page, 'crane');
      process.exitCode = 2;
      return;
    }
    const options = await select.locator('option').evaluateAll(os => os.map(o => o.value).filter(Boolean));
    if (!options.includes(target)) throw new Error(`${target} is not offered for ${picked}; choices: ${options.join(', ')}`);
    const before = await noticeText();
    await select.selectOption(target);
    await page.getByRole('button', { name: /RELEASE PRESSURE CLAMP/ }).click();
    let result = before;
    for (let i = 0; i < 40 && result === before; i++) { await page.waitForTimeout(250); result = await noticeText(); }
    console.log(`crane: ${picked} -> ${target}: ${result || '(no notice shown)'}`);
    const now = (await api('GET', '/api/bundles')).json.find(b => b.tagId === picked);
    console.log(`server says: ${picked} at ${now.location} (${now.status})`);
    await page.waitForTimeout(600);
    await snap(page, 'crane');
  });
}

const commands = { start, stop: async () => stop(), smoke, shot: () => shot(args.find(a => a.startsWith('/'))), crane };
if (!commands[cmd]) {
  console.log('commands: start | stop | smoke | shot [/route] [--width N] [--full] | crane [--tag TG-101] [--to "Rack K-1"] [--crane Crane-SW]');
  process.exit(cmd ? 1 : 0);
}
commands[cmd]().catch(e => { console.error(`error: ${e.message}`); process.exit(1); });
