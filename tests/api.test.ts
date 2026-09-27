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
  assert.equal((await call('POST', '/api/bundles/TG-104/pickup', { craneId: 'Crane-NW' })).status, 200);
  assert.equal((await call('POST', '/api/bundles/TG-202/pickup', { craneId: 'Crane-SW' })).status, 200);
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
  await call('POST', '/api/bundles/TG-104/pickup', { craneId: 'Crane-NW' });
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

test('a coated epoxy bundle cannot be set down in Raw-SW black-bar stock', async () => {
  await call('POST', '/api/bundles/TG-104/pickup', { craneId: 'Crane-NW' });
  const r = await call('POST', '/api/bundles/TG-104/drop', { location: 'Raw-SW' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /never go back into Raw-SW/);
});

test('epoxy-ordered bar goes through the coat line before anything else', async () => {
  // Uncoated TG-303 next to black TG-504 used to become "coated" beside it once staged
  const shear = await call('POST', '/api/bundles/TG-303/stage', { location: 'Shear-South' });
  assert.equal(shear.status, 400);
  assert.match(shear.json.error, /coat line before/);
  assert.equal((await call('POST', '/api/bundles/TG-401/send-to-bender', { benderId: 'Bender-SE-Bender' })).status, 400);
  const bulk = await call('POST', '/api/bundles/bulk-action', { bundleIds: ['TG-601'], action: 'LOAD' });
  assert.equal(bulk.status, 400);
  assert.match(bulk.json.error, /coat line before/);
  assert.equal((await bundle('TG-601')).status, 'RAW');
});

test('raw stock moved within Raw-SW stays raw, and never turns coated there', async () => {
  const restaged = await call('POST', '/api/bundles/TG-304/stage', { location: 'Raw-SW' });
  assert.equal(restaged.status, 200);
  assert.equal(restaged.json.status, 'RAW');
  // TG-102 ships soonest, so setting it back down in Raw-SW buries nothing
  assert.equal((await call('POST', '/api/bundles/TG-102/pickup', { craneId: 'Crane-SW' })).status, 200);
  const back = await call('POST', '/api/bundles/TG-102/drop', { location: 'Raw-SW' });
  assert.equal(back.status, 200);
  assert.equal(back.json.status, 'RAW');
});

test('the coat line coats what reaches it and never blocks itself', async () => {
  const first = await call('POST', '/api/bundles/TG-303/stage', { location: 'Coat-Station' });
  assert.equal(first.status, 200);
  assert.equal(first.json.status, 'COATED');
  assert.equal((await call('POST', '/api/bundles/TG-304/stage', { location: 'Coat-Station' })).status, 200);
  // Raw TG-102 set on the line by crane is coated there too, beside the coated bundles already on it
  assert.equal((await call('POST', '/api/bundles/TG-102/pickup', { craneId: 'Crane-SW' })).status, 200);
  const dropped = await call('POST', '/api/bundles/TG-102/drop', { location: 'Coat-Station' });
  assert.equal(dropped.status, 200);
  assert.equal(dropped.json.status, 'COATED');
  const black = await call('POST', '/api/bundles/TG-203/stage', { location: 'Coat-Station' });
  assert.equal(black.status, 400);
  assert.match(black.json.error, /never goes through the epoxy coat line/);
});

test('only real map zones are routes and capacity targets', async () => {
  for (const name of ['constructor', '__proto__', 'toString']) {
    const r = await call('POST', '/api/gantry/execute-route', { originId: 'Rack J-04', destinationId: name, bundleId: 'TG-101' });
    assert.equal(r.status, 400, name);
    assert.equal((await call('PUT', `/api/zone-capacities/${name}`, { capacity: 50000 })).status, 400, name);
  }
  assert.equal((await bundle('TG-101')).location, 'Rack J-04');
});

test('coating audits need a real percentage and coated bar', async () => {
  const pct = await call('POST', '/api/exceptions', {
    tagId: 'TG-101', operatorName: 'QC', type: 'Quality Audit', description: 'x', qualityAudit: { coatingDamagePct: '5%', damagedFootSection: 'ft 1' }
  });
  assert.equal(pct.status, 400);
  assert.match(pct.json.error, /percentage between 0 and 100/);
  const raw = await call('POST', '/api/exceptions', {
    tagId: 'TG-102', operatorName: 'QC', type: 'Quality Audit', description: 'x', qualityAudit: { coatingDamagePct: 5, damagedFootSection: 'ft 1' }
  });
  assert.equal(raw.status, 400);
  assert.match(raw.json.error, /no coating to audit/);
  assert.equal((await bundle('TG-102')).status, 'RAW');
});

test('only a load on a crane hook can be set down, and nothing is lifted out of a bender', async () => {
  // Setting black TG-202 straight into an SW rack would skip the SW-crane rule
  const skipped = await call('POST', '/api/bundles/TG-202/drop', { location: 'Rack J-20' });
  assert.equal(skipped.status, 400);
  assert.match(skipped.json.error, /not on a crane hook/);
  assert.equal((await bundle('TG-202')).location, 'Raw-SW');

  // TG-106 is mid-bend at Bender-11-Bender
  const lift = await call('POST', '/api/bundles/TG-106/pickup', { craneId: 'Crane-NE' });
  assert.equal(lift.status, 400);
  assert.match(lift.json.error, /still in the bender/);
  const route = await call('POST', '/api/gantry/execute-route', { originId: 'Bender-11-Bender', destinationId: 'Rack L-1', bundleId: 'TG-106' });
  assert.equal(route.status, 400);
  assert.match(route.json.error, /still in the bender/);
  assert.equal((await call('POST', '/api/bundles/TG-106/mark-bent', {})).status, 200);
  assert.equal((await call('POST', '/api/bundles/TG-106/pickup', { craneId: 'Crane-NE' })).status, 200);
});

test('exceptions and shift notes stay bounded, and open exceptions outlast resolved ones', async () => {
  const seedOpen = (await call('GET', '/api/exceptions')).json.filter((e: any) => e.status === 'OPEN').map((e: any) => e.id);
  for (let i = 0; i < 510; i++) {
    const ex = await call('POST', '/api/exceptions', { tagId: 'TG-104', operatorName: 'QC', type: 'Misplaced Bar', description: `note ${i}` });
    if (i < 505) await call('POST', `/api/exceptions/${ex.json.id}/resolve`, { resolvedBy: 'QC' });
    await call('POST', '/api/shift-messages', { sender: 'Lead', content: `note ${i}`, shift: 'First Shift' });
  }
  const all = (await call('GET', '/api/exceptions')).json;
  assert.equal(all.length, 500);
  for (const id of seedOpen) assert.ok(all.some((e: any) => e.id === id), `open ${id} kept`);
  assert.equal(all.filter((e: any) => e.status === 'OPEN').length, seedOpen.length + 5);
  const notes = (await call('GET', '/api/shift-messages')).json;
  assert.equal(notes.length, 500);
  assert.equal(notes[0].content, 'note 509');
});

test('black bar cannot be staged where coated bar sits', async () => {
  // Shear-North holds coated TG-104; TG-203 is raw black bar
  const r = await call('POST', '/api/bundles/TG-203/stage', { location: 'Shear-North' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /never touch/);
});
