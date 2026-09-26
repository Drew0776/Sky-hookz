import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Bundle } from '../src/types';
import { computeDashboardMetrics, daysOutdoors, getZoneCapacity, gradeZoneViolation, isUvHazard, isValidYardLocation, movementBlockedReason, plantLocalHour, slottingConflict, stagedAtAfterMove, statusAfterDrop, DEFAULT_ZONE_CAPACITY_LBS, gradePlacementViolation } from '../src/yardRules';
import { getRouteAnalysisByZones } from '../src/utils/yardMath';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-06-15T12:00:00Z');

function bundle(overrides: Partial<Bundle>): Bundle {
  const isEpoxy = overrides.grade !== 'Black';
  return {
    id: 'TG-1', tagId: 'TG-1', jobId: 'JOB-01', mark: 'MK-1',
    grade: isEpoxy ? 'Epoxy' : 'Black', barSize: '#8', length: 30, weight: 2000,
    isEpoxy, route: '', status: 'RACKED', location: 'Rack J-04',
    updatedAt: '2026-06-15T12:00:00Z', plantLocation: 'St. Paul, MN',
    heatNumber: 'HT-1', millCertUrl: '', specification: isEpoxy ? 'ASTM_A775' : 'ASTM_A615',
    shippingDate: '2026-06-20T00:00:00Z',
    ...overrides
  };
}

test('zone capacity defaults to 75,000 lb and honors custom limits', () => {
  assert.equal(getZoneCapacity('Raw-SW'), DEFAULT_ZONE_CAPACITY_LBS);
  assert.equal(getZoneCapacity('Raw-SW', { 'Raw-SW': 40000 }), 40000);
});

test('black bar stays in the SW zone but may visit processing stations', () => {
  assert.equal(gradeZoneViolation('Black', 'Rack J-22'), null);
  assert.equal(gradeZoneViolation('Black', 'Door-8'), null);
  assert.equal(gradeZoneViolation('Black', 'Shear-South'), null);
  assert.equal(gradeZoneViolation('Black', 'Bender-Old-Robo'), null);
  assert.match(gradeZoneViolation('Black', 'Rack K-1') ?? '', /SW-only/);
  assert.match(gradeZoneViolation('Black', 'North-End') ?? '', /SW-only/);
});

test('epoxy stays out of black-bar racks and SW shipping doors', () => {
  assert.equal(gradeZoneViolation('Epoxy', 'Rack J-04'), null);
  assert.equal(gradeZoneViolation('Epoxy', 'Rack L-1'), null);
  assert.match(gradeZoneViolation('Epoxy', 'Rack L-10') ?? '', /Black-bar SW racks/);
  assert.match(gradeZoneViolation('Epoxy', 'Door-7') ?? '', /NW\/NE doors/);
});

test('location names are validated by pattern', () => {
  assert.ok(isValidYardLocation('Rack J-22'));
  assert.ok(isValidYardLocation('Bender-Radius-Bender'));
  assert.ok(!isValidYardLocation('Moon'));
  assert.ok(!isValidYardLocation(42));
});

test('rejected bundles cannot move', () => {
  assert.equal(movementBlockedReason(bundle({ status: 'RACKED' })), null);
  assert.match(movementBlockedReason(bundle({ status: 'REJECTED' })) ?? '', /REJECTED/);
});

test('ships-first slotting finds the soonest bundle that would be buried', () => {
  const moving = bundle({ id: 'M', shippingDate: '2026-06-30T00:00:00Z' });
  const soon = bundle({ id: 'S', location: 'Door-1', shippingDate: '2026-06-16T00:00:00Z' });
  const later = bundle({ id: 'L', location: 'Door-1', shippingDate: '2026-07-10T00:00:00Z' });
  assert.equal(slottingConflict(moving, 'Door-1', [moving, soon, later])?.id, 'S');
  assert.equal(slottingConflict(moving, 'Door-1', [moving, later]), undefined);
});

test('drop status follows the destination', () => {
  assert.equal(statusAfterDrop('Rack J-04'), 'RACKED');
  assert.equal(statusAfterDrop('Door-2'), 'LOADED');
  assert.equal(statusAfterDrop('Coat-Station'), 'COATED');
  assert.equal(statusAfterDrop('Shear-North'), 'STAGED');
});

test('UV clock only runs for coated epoxy outdoors', () => {
  const old = new Date(NOW - 26 * DAY).toISOString();
  assert.ok(isUvHazard(bundle({ status: 'COATED', stagedAt: old }), NOW));
  assert.ok(!isUvHazard(bundle({ status: 'RAW', location: 'Raw-SW', stagedAt: old }), NOW), 'raw stock is not coated yet');
  assert.ok(!isUvHazard(bundle({ grade: 'Black', stagedAt: old }), NOW));
  assert.ok(!isUvHazard(bundle({ location: 'Shear-North', stagedAt: old }), NOW), 'indoors');
  assert.equal(Math.round(daysOutdoors(bundle({ stagedAt: old }), NOW) ?? 0), 26);
});

test('outdoor clock restarts, carries over, and clears', () => {
  assert.equal(stagedAtAfterMove(bundle({ location: 'Shear-North', stagedAt: 'T0' }), 'Rack J-04', 'NOW'), 'NOW');
  assert.equal(stagedAtAfterMove(bundle({ location: 'Rack J-04', stagedAt: 'T0' }), 'Door-1', 'NOW'), 'T0');
  assert.equal(stagedAtAfterMove(bundle({ location: 'Rack J-04', stagedAt: 'T0' }), 'Shear-North', 'NOW'), undefined);
});

test('shift hours use plant local time', () => {
  assert.equal(plantLocalHour('2026-05-24T14:30:00Z', 'St. Paul, MN'), 9.5);
  assert.equal(plantLocalHour('2026-05-24T14:30:00Z', 'Marion, OH'), 10.5);
  // UTC-based code swapped these two: 21:00Z is 4:00 PM in St. Paul (first shift)
  // and 08:00Z is 3:00 AM (second shift).
  const metrics = computeDashboardMetrics(
    [bundle({ status: 'LOADED', weight: 4000, updatedAt: '2026-05-24T21:00:00Z' }),
     bundle({ status: 'LOADED', weight: 2000, updatedAt: '2026-05-24T08:00:00Z' })],
    []
  );
  assert.equal(metrics.firstShiftThroughput, 2);
  assert.equal(metrics.secondShiftThroughput, 1);
});

test('route interlocks: A934 waiver follows the carried bundle', () => {
  const a775 = bundle({ id: 'A775', location: 'Rack L-8', weight: 1000 });
  const a934 = bundle({ id: 'A934', location: 'Rack L-8', weight: 1000, specification: 'ASTM_A934' });
  const pile = bundle({ id: 'PILE', grade: 'Black', location: 'Raw-SW', weight: 50000 }); // 67% of 75,000
  const all = [a775, a934, pile];
  const slow = getRouteAnalysisByZones('Rack L-8', 'Coat-Station', all, {}, 'A775');
  const waived = getRouteAnalysisByZones('Rack L-8', 'Coat-Station', all, {}, 'A934');
  assert.deepEqual(slow.obstructions.map(o => o.reason), ['HIGH LOAD DENSITY']);
  assert.deepEqual(waived.obstructions, []);
  const overloaded = getRouteAnalysisByZones('Rack L-8', 'Coat-Station', all, { 'Raw-SW': 55000 }, 'A934');
  assert.deepEqual(overloaded.obstructions.map(o => o.reason), ['MAX STORAGE CAPACITY EXCEEDED']);
});

test('route interlocks: parked cranes on the path are critical', () => {
  const r = getRouteAnalysisByZones('Raw-SW', 'Rack J-19', [], {});
  assert.ok(r.hasCriticalInterlock);
  assert.deepEqual(r.obstructions.map(o => o.zoneId), ['Crane-SW']);
});

test('coated epoxy never goes back into Raw-SW; uncoated bar waiting for the coat line may', () => {
  assert.match(gradeZoneViolation('Epoxy', 'Raw-SW', 'COATED') ?? '', /never go back into Raw-SW/);
  assert.match(gradeZoneViolation('Epoxy', 'Raw-SW') ?? '', /never go back into Raw-SW/, 'no status means treat it as coated');
  assert.equal(gradeZoneViolation('Black', 'Raw-SW'), null);
  assert.equal(gradeZoneViolation('Epoxy', 'Raw-SW', 'RAW'), null, 'epoxy-ordered bar is still black steel until coated');
});

test('black steel never touches coated steel, at any stage', () => {
  const b = (id: string, grade: 'Black' | 'Epoxy', location: string, status = 'STAGED') => ({ id, tagId: id, grade, location, status });
  const yard = [b('coated', 'Epoxy', 'Shear-North', 'STAGED'), b('black', 'Black', 'Shear-South', 'STAGED')];
  assert.match(gradePlacementViolation(b('m', 'Black', 'Raw-SW'), 'Shear-North', yard) ?? '', /never touch/);
  assert.match(gradePlacementViolation(b('m', 'Epoxy', 'Rack K-1', 'RACKED'), 'Shear-South', yard) ?? '', /never touch/);
  assert.equal(gradePlacementViolation(b('m', 'Epoxy', 'Rack K-1', 'RACKED'), 'Shear-North', yard), null, 'coated on coated is fine');
  assert.equal(gradePlacementViolation(b('m', 'Black', 'Raw-SW'), 'Shear-South', yard), null, 'black on black is fine');
  // All bar arrives black: raw epoxy-ordered bar waiting at the coat line is still black...
  const coatLine = [b('waiting', 'Epoxy', 'Coat-Station', 'STAGED')];
  assert.equal(gradePlacementViolation(b('m', 'Epoxy', 'Raw-SW', 'RAW'), 'Coat-Station', coatLine), null);
  assert.equal(gradePlacementViolation(b('m', 'Black', 'Raw-SW', 'RAW'), 'Coat-Station', coatLine), null);
  // ...and bar leaving the coat line has been coated
  assert.equal(gradePlacementViolation(b('m', 'Epoxy', 'Coat-Station', 'STAGED'), 'Shear-North', yard), null);
  assert.match(gradePlacementViolation(b('m', 'Epoxy', 'Coat-Station', 'STAGED'), 'Shear-South', yard) ?? '', /never touch/);
});
