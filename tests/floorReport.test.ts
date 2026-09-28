import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jsPDF } from 'jspdf';
import { INITIAL_BUNDLES } from '../src/seedData';
import { buildFloorReport, reportGrade } from '../src/utils/floorReport';
import type { Bundle } from '../src/types';

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;

/** Builds the report while recording every piece of text drawn: which page, where, and how wide. */
function drawReport(bundles: Bundle[]) {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const drawn: { text: string; x: number; y: number; right: number; page: number }[] = [];
  const text = doc.text.bind(doc);
  doc.text = ((t: string | string[], x: number, y: number, ...rest: unknown[]) => {
    const lines = Array.isArray(t) ? t : [t];
    const alignedRight = (rest[0] as { align?: string } | undefined)?.align === 'right';
    lines.forEach((line, i) => drawn.push({
      text: line, x, y: y + i * doc.getLineHeight() / doc.internal.scaleFactor,
      right: alignedRight ? x : x + doc.getTextWidth(line), page: doc.getCurrentPageInfo().pageNumber
    }));
    return text(t, x, y, ...(rest as []));
  }) as typeof doc.text;
  buildFloorReport(doc, bundles, 'Test Operator', new Date('2026-09-28T12:00:00Z'));
  return { doc, drawn };
}

/** The sample yard `times` over, each copy with its own tags. */
const bigYard = (times: number): Bundle[] =>
  Array.from({ length: times }, (_, i) =>
    INITIAL_BUNDLES.map(b => ({ ...b, id: `${b.id}-${i}`, tagId: i ? `${b.tagId}-${i}` : b.tagId }))
  ).flat();

test('every bundle gets a row, even when the yard runs to several pages', () => {
  const bundles = bigYard(8);
  const { doc, drawn } = drawReport(bundles);
  const tags = new Set(drawn.map(d => d.text));
  assert.ok(doc.getNumberOfPages() > 1);
  for (const b of bundles) assert.ok(tags.has(b.tagId), `${b.tagId} missing from the report`);
});

test('nothing is drawn off the page', () => {
  const { drawn } = drawReport(bigYard(8));
  for (const d of drawn) {
    assert.ok(d.right <= PAGE_WIDTH - 10, `"${d.text}" runs to ${d.right.toFixed(1)} mm`);
    assert.ok(d.y <= PAGE_HEIGHT - 8, `"${d.text}" sits at ${d.y.toFixed(1)} mm`);
  }
});

test('epoxy that has not been through the coat line is marked raw', () => {
  const raw = INITIAL_BUNDLES.find(b => b.grade === 'Epoxy' && b.status === 'RAW')!;
  const coated = INITIAL_BUNDLES.find(b => b.grade === 'Epoxy' && b.status !== 'RAW')!;
  const black = INITIAL_BUNDLES.find(b => b.grade === 'Black')!;
  assert.equal(reportGrade(raw), 'Epoxy (raw)');
  assert.equal(reportGrade(coated), 'Epoxy');
  assert.equal(reportGrade(black), 'Black');
});
