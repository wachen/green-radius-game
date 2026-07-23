import { test, expect, describe } from 'bun:test';
import AdminAggregate from '../admin/aggregate.js';

const { dedupeRows, dedupeInfo } = AdminAggregate;

// Convenience: a row carrying a campId (which lives inside the answers blob,
// exactly where shapeAdminRows parses it back out of answers_json).
function row(overrides) {
  return Object.assign({ campName: '', email: '', timestamp: 0, answers: {} }, overrides);
}
function withCampId(id, overrides) {
  const r = row(overrides);
  r.answers = Object.assign({}, r.answers, { campId: id });
  return r;
}

describe('dedupeRows identity + latest-wins', () => {
  test('campId collapses repeat submissions to the latest by timestamp', () => {
    const rows = [
      withCampId('cid-1', { campName: 'Dusty', email: 'a@x.com', timestamp: 100, total: 10 }),
      withCampId('cid-1', { campName: 'Dusty', email: 'a@x.com', timestamp: 300, total: 42 }),
      withCampId('cid-1', { campName: 'Dusty', email: 'a@x.com', timestamp: 200, total: 20 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(42); // the timestamp:300 row wins
  });

  test('campId takes precedence over a shared email', () => {
    // Two DIFFERENT camps that happen to share one inbox but each have a campId
    // must NOT be merged.
    const rows = [
      withCampId('cid-a', { email: 'shared@x.com', timestamp: 100, total: 10 }),
      withCampId('cid-b', { email: 'shared@x.com', timestamp: 200, total: 20 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(2);
  });

  test('falls back to normalized email when no campId (trim + lowercase)', () => {
    const rows = [
      row({ email: '  Camp@Example.COM ', timestamp: 100, total: 10 }),
      row({ email: 'camp@example.com', timestamp: 200, total: 55 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(55);
  });

  test('falls back to normalized camp name when no campId and no email', () => {
    const rows = [
      row({ campName: 'Solar Camp', email: '', timestamp: 100, total: 10 }),
      row({ campName: '  solar camp  ', email: '', timestamp: 200, total: 33 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(33);
  });

  test('rows with no identity at all are all preserved', () => {
    const rows = [
      row({ campName: '', email: '', timestamp: 100 }),
      row({ campName: '', email: '', timestamp: 200 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(2);
  });

  test('equal timestamps: later array position (more recently appended) wins', () => {
    const rows = [
      withCampId('cid-1', { timestamp: 500, total: 11 }),
      withCampId('cid-1', { timestamp: 500, total: 22 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(22);
  });

  test('distinct identities are all kept', () => {
    const rows = [
      withCampId('cid-1', { timestamp: 100 }),
      row({ email: 'b@x.com', timestamp: 100 }),
      row({ campName: 'Third', email: '', timestamp: 100 }),
    ];
    expect(dedupeRows(rows).length).toBe(3);
  });

  test('empty / missing input yields an empty array', () => {
    expect(dedupeRows([]).length).toBe(0);
    expect(dedupeRows(undefined).length).toBe(0);
  });

  test('int32 timestamp wrap: a truly-later row must still win once the two are >50 days apart', () => {
    // T1 and T2 are ordinary ms-epoch-shaped numbers, ~50 days + 1hr apart,
    // chosen so `(T2 | 0) < (T1 | 0)` (the int32 truncation flips their sign
    // and reverses the comparison) even though T2 is numerically larger.
    const T1 = 2147483000;
    const T2 = T1 + 50 * 86400000 + 3600000;
    expect(T2 | 0).toBeLessThan(T1 | 0); // sanity check: the old bug would misorder these
    const rows = [
      withCampId('cid-1', { timestamp: T1, total: 10 }),
      withCampId('cid-1', { timestamp: T2, total: 99 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(99); // the numerically-later row must win
  });

  test('different campIds, same normalized name, same year: merged', () => {
    const rows = [
      withCampId('cid-x', { campName: 'Dusty Camp', year: 2026, timestamp: 100, total: 5 }),
      withCampId('cid-y', { campName: 'dusty camp', year: 2026, timestamp: 200, total: 9 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(9);
  });

  test('same campId, different years: NOT merged', () => {
    const rows = [
      withCampId('cid-1', { year: 2025, timestamp: 100, total: 5 }),
      withCampId('cid-1', { year: 2026, timestamp: 200, total: 9 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(2);
  });

  test('same name with different internal whitespace/case: merged', () => {
    const rows = [
      row({ campName: 'Solar   Camp', email: '', timestamp: 100, total: 10 }),
      row({ campName: ' solar camp ', email: '', timestamp: 200, total: 33 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1);
    expect(out[0].total).toBe(33);
  });

  test('shared email does not merge two distinct campId+name rows, but both are legacy-mergeable when campId-less', () => {
    const rows = [
      row({ email: '  Camp@Example.COM ', timestamp: 100, total: 10 }),
      row({ email: 'camp@example.com', timestamp: 200, total: 55 }),
    ];
    const out = dedupeRows(rows);
    expect(out.length).toBe(1); // legacy (no campId) rows still merge on email
    expect(out[0].total).toBe(55);
  });
});

describe('dedupeInfo (admin annotation)', () => {
  test('shared email across two distinct campId+name groups does not merge them, but flags both winners suspect', () => {
    const rowA = withCampId('cid-a', { campName: 'Alpha Camp', email: 'person@x.com', year: 2026, timestamp: 100, total: 10 });
    const rowB = withCampId('cid-b', { campName: 'Beta Camp', email: 'person@x.com', year: 2026, timestamp: 200, total: 20 });
    const rows = [rowA, rowB];
    expect(dedupeRows(rows).length).toBe(2); // not merged
    const info = dedupeInfo(rows);
    expect(info.get(rowA)).toEqual({ dup: 1, superseded: false, suspect: true });
    expect(info.get(rowB)).toEqual({ dup: 1, superseded: false, suspect: true });
  });

  test('dup count and superseded flags for a collapsed group', () => {
    const r1 = withCampId('cid-1', { timestamp: 100, total: 10 });
    const r2 = withCampId('cid-1', { timestamp: 200, total: 20 });
    const r3 = withCampId('cid-1', { timestamp: 300, total: 30 });
    const rows = [r1, r2, r3];
    const info = dedupeInfo(rows);
    expect(info.get(r1)).toEqual({ dup: 3, superseded: true, suspect: false });
    expect(info.get(r2)).toEqual({ dup: 3, superseded: true, suspect: false });
    expect(info.get(r3)).toEqual({ dup: 3, superseded: false, suspect: false }); // ts:300 is the winner
  });

  test('hidden rows are absent from the result and do not inflate other rows\' dup counts', () => {
    const visible = withCampId('cid-1', { timestamp: 100, total: 10 });
    const hidden = Object.assign(withCampId('cid-1', { timestamp: 200, total: 999 }), { hidden: true });
    const rows = [visible, hidden];
    const info = dedupeInfo(rows);
    expect(info.has(hidden)).toBe(false);
    expect(info.get(visible)).toEqual({ dup: 1, superseded: false, suspect: false });
  });
});

describe('computeAggregates dedups before tallying', () => {
  test('leaderboard, count and momentum count camps, not rows', () => {
    const sectors = [{ id: 'food', name: 'Food', levels: [[], [], [], []], tier4Topics: [] }];
    const now = 1_000_000;
    const rows = [
      withCampId('cid-1', { campName: 'Dusty', timestamp: now - 1000, total: 10, greens: { food: 5 }, schemaVersion: 'v2' }),
      withCampId('cid-1', { campName: 'Dusty', timestamp: now - 500, total: 40, greens: { food: 8 }, schemaVersion: 'v2' }),
    ];
    const agg = AdminAggregate.computeAggregates(rows, sectors, now);
    expect(agg.count).toBe(1);
    expect(agg.momentum.thisWeek).toBe(1);
    expect(agg.leaderboard.length).toBe(1);
    expect(agg.leaderboard[0].total).toBe(40); // latest submission
  });
});
