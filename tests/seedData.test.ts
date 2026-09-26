import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_ACTIVITY, INITIAL_BUNDLES, INITIAL_EXCEPTIONS, INITIAL_JOBS, INITIAL_SHIFT_MESSAGES } from '../src/seedData';
import { isFirstShift, plantLocalHour } from '../src/yardRules';

const DAY = 24 * 60 * 60 * 1000;

test('sample history sits in the last day, never in the future', () => {
  const now = Date.now();
  const times = [
    ...INITIAL_ACTIVITY.map(a => a.timestamp),
    ...INITIAL_EXCEPTIONS.flatMap(e => [e.timestamp, e.resolvedAt].filter((t): t is string => !!t)),
    ...INITIAL_SHIFT_MESSAGES.map(m => m.timestamp),
    ...INITIAL_JOBS.map(j => j.createdAt),
    ...INITIAL_BUNDLES.map(b => b.updatedAt)
  ];
  assert.ok(times.length > 50);
  for (const t of times) {
    const age = now - Date.parse(t);
    assert.ok(age >= 0 && age < DAY, `${t} is ${Math.round(age / 60000)} min old`);
  }
});

test('sample lists are newest first, like entries the server adds', () => {
  for (const list of [INITIAL_ACTIVITY, INITIAL_EXCEPTIONS, INITIAL_SHIFT_MESSAGES]) {
    const times = list.map(item => Date.parse(item.timestamp));
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
  }
});

test('sample notes are filed under the shift of their plant time', () => {
  for (const m of INITIAL_SHIFT_MESSAGES) {
    const expected = isFirstShift(plantLocalHour(m.timestamp, 'St. Paul, MN')) ? 'First Shift' : 'Second Shift';
    assert.equal(m.shift, expected, m.id);
  }
});
