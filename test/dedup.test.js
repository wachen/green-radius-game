import { test, expect, describe } from 'bun:test';
import AdminAggregate from '../admin/aggregate.js';

const { dedupeRows } = AdminAggregate;

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
