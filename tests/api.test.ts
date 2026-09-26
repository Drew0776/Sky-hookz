import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Import the Express app without opening port 3000
process.env.SKYHOOK_NO_LISTEN = '1';
const { app, resetYardState } = await import('../server');

let server: Server;
let base = '';

before(async () => {
  server = app.listen(0);
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>(resolve => server.close(() => resolve())));
beforeEach(() => resetYardState());

async function call(method: string, path: string, body?: unknown, rawBody?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, json };
}

const bundle = async (id: string) => (await call('GET', '/api/bundles')).json.find((b: any) => b.id === id);

test('health check answers', async () => {
  const r = await call('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ok');
});

test('unknown API routes and malformed JSON answer in JSON', async () => {
  const missing = await call('GET', '/api/nope');
  assert.equal(missing.status, 404);
  assert.match(missing.json.error, /No API route/);

  const bad = await call('POST', '/api/bundles/TG-104/drop', undefined, '{not json');
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /not valid JSON/);
});

test('drop enforces grade zoning and moves a valid bundle', async () => {
  const epoxyAtSwDoor = await call('POST', '/api/bundles/TG-104/drop', { location: 'Door-8' });
  assert.equal(epoxyAtSwDoor.status, 400);
  assert.match(epoxyAtSwDoor.json.error, /NW\/NE doors/);

  const blackInNorthRack = await call('POST', '/api/bundles/TG-202/drop', { location: 'Rack K-1' });
  assert.equal(blackInNorthRack.status, 400);
  assert.match(blackInNorthRack.json.error, /SW-only/);

  const unknown = await call('POST', '/api/bundles/TG-104/drop', { location: 'Moon' });
  assert.equal(unknown.status, 400);

  const ok = await call('POST', '/api/bundles/TG-104/drop', { location: 'Rack J-12' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.location, 'Rack J-12');
  assert.equal(ok.json.status, 'RACKED');
});

test('resetting the yard restores the seed data', async () => {
  await call('POST', '/api/bundles/TG-104/drop', { location: 'Rack J-12' });
  assert.equal((await bundle('TG-104')).location, 'Rack J-12');
  resetYardState();
  assert.equal((await bundle('TG-104')).location, 'Shear-North');
});

test('force-load keeps black bar on the SW doors', async () => {
  const r = await call('POST', '/api/bundles/TG-202/force-load', { door: 'Door-1' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Door-7 or Door-8/);
});

test('pickup rules: black bar only on the SW crane, one load per hook', async () => {
  const wrongCrane = await call('POST', '/api/bundles/TG-202/pickup', { craneId: 'Crane-NE' });
  assert.equal(wrongCrane.status, 400);

  assert.equal((await call('POST', '/api/bundles/TG-104/pickup', { craneId: 'Crane-NE' })).status, 200);
  const second = await call('POST', '/api/bundles/TG-102/pickup', { craneId: 'Crane-NE' });
  assert.equal(second.status, 400);
  assert.match(second.json.error, /already has bundle TG-104/);
});

test('zone capacities are validated and drive the route interlock', async () => {
  assert.equal((await call('PUT', '/api/zone-capacities/Raw-SW', { capacity: 10 })).status, 400);
  assert.equal((await call('PUT', '/api/zone-capacities/Crane-SW', { capacity: 50000 })).status, 400);

  // Seed Raw-SW holds 35,579 lb: 47% of the default limit, 89% of 40,000 lb
  const route = { originId: 'Rack L-8', destinationId: 'Coat-Station' };
  assert.equal((await call('POST', '/api/gantry/execute-route', route)).status, 200);

  const set = await call('PUT', '/api/zone-capacities/Raw-SW', { capacity: 40000 });
  assert.deepEqual(set.json, { 'Raw-SW': 40000 });
  const blocked = await call('POST', '/api/gantry/execute-route', route);
  assert.equal(blocked.status, 400);
  assert.match(blocked.json.error, /MAX STORAGE CAPACITY EXCEEDED/);

  assert.deepEqual((await call('PUT', '/api/zone-capacities/Raw-SW', { capacity: null })).json, {});
});

test('execute-route moves the chosen bundle and checks placement', async () => {
  const notThere = await call('POST', '/api/gantry/execute-route', { originId: 'Rack J-04', destinationId: 'Door-1', bundleId: 'TG-102' });
  assert.equal(notThere.status, 400);
  assert.match(notThere.json.error, /not at Rack J-04/);

  const moved = await call('POST', '/api/gantry/execute-route', { originId: 'Rack J-04', destinationId: 'Door-1', bundleId: 'TG-101' });
  assert.equal(moved.status, 200);
  assert.equal(moved.json.bundle.location, 'Door-1');
  assert.equal(moved.json.bundle.status, 'LOADED');
});

test('a bundle rejected by coating QC can no longer move', async () => {
  const audit = await call('POST', '/api/exceptions', {
    tagId: 'TG-101', operatorName: 'QC Inspector', type: 'Quality Audit', description: 'Scraped coating',
    qualityAudit: { coatingDamagePct: 3.5, damagedFootSection: 'ft 4-5' }
  });
  assert.equal(audit.status, 201);
  assert.equal((await bundle('TG-101')).status, 'REJECTED');

  const drop = await call('POST', '/api/bundles/TG-101/drop', { location: 'Rack J-12' });
  assert.equal(drop.status, 400);
  assert.match(drop.json.error, /REJECTED/);

  const badPct = await call('POST', '/api/exceptions', {
    tagId: 'TG-102', operatorName: 'QC', type: 'Quality Audit', description: 'x', qualityAudit: { coatingDamagePct: 'lots' }
  });
  assert.equal(badPct.status, 400);
});

test('mill certificates and dashboard metrics', async () => {
  const cert = await call('GET', '/api/mill-certs/HT-2026-3410');
  assert.equal(cert.status, 200);
  assert.equal(cert.json.bundles[0].tagId, 'TG-101');
  assert.equal((await call('GET', '/api/mill-certs/HT-0000')).status, 404);

  const dash = await call('GET', '/api/dashboard');
  assert.equal(dash.status, 200);
  assert.equal(typeof dash.json.uvHazardsCount, 'number');
  assert.equal(dash.json.loadedCount, 9);
});

test('request bodies must carry text where the screens expect text', async () => {
  // One exception with an object for a name used to crash every open screen
  const objectTag = await call('POST', '/api/exceptions', { tagId: {}, operatorName: 'QC', type: 'Misplaced Bar', description: 'x' });
  assert.equal(objectTag.status, 400);
  assert.match(objectTag.json.error, /tagId must be text/);

  const numberName = await call('POST', '/api/shift-messages', { sender: 5, content: 'hi', shift: 'First Shift' });
  assert.equal(numberName.status, 400);

  const tooLong = await call('POST', '/api/exceptions', { tagId: 'TG-104', operatorName: 'QC', type: 'Misplaced Bar', description: 'x'.repeat(1001) });
  assert.equal(tooLong.status, 400);
  assert.match(tooLong.json.error, /1,000 characters/);

  const notAnObject = await call('POST', '/api/bundles/bulk-action', [1, 2, 3]);
  assert.equal(notAnObject.status, 400);

  const oversized = await call('POST', '/api/shift-messages', { sender: 'x', content: 'x'.repeat(200_000), shift: 'First Shift' });
  assert.equal(oversized.status, 413);

  const blank = await call('POST', '/api/exceptions', { tagId: '   ', operatorName: 'QC', type: 'Misplaced Bar', description: 'x' });
  assert.equal(blank.status, 400, 'a blank-but-spaces tag counts as missing');
});
