import { test, expect, describe } from 'bun:test';
import A from '../admin/aggregate.js';

// Two tiny sectors: enough shape for perQuestion/standings without game-data.
const SECTORS = [
  { id: 'food', name: 'Food', levels: [[{ id: 'F1', title: 'Bulk buy' }], [], []],
    tier4Topics: [{ id: 'F-adv', title: 'Compost' }, { id: 'F-camp', title: "Our Camp's Idea" }] },
  { id: 'water', name: 'Water', levels: [[{ id: 'W1', title: 'Refill' }], [], []],
    tier4Topics: [] },
];
const row = (name, greens, answers, ts) => ({
  campName: name, email: name + '@x.com', timestamp: ts || 1000,
  greens, total: Object.values(greens).reduce((a, b) => a + b, 0),
  answers, schemaVersion: 'v2',
});

describe('leaderboard row data', () => {
  test('entries carry greens/answers/timestamp for mini badges', () => {
    const rows = [row('a', { food: 8, water: 2 }, { F1: 'yes' }, 1234)];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    expect(agg.leaderboard[0].greens).toEqual({ food: 8, water: 2 });
    expect(agg.leaderboard[0].answers).toEqual({ F1: 'yes' });
    expect(agg.leaderboard[0].timestamp).toBe(1234);
  });
});

describe('junk-row flagging (hidden)', () => {
  test('a row with hidden:true is excluded from every aggregate', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'yes' }, 1000),
      Object.assign(row('junk', { food: 10, water: 10 }, { F1: 'yes' }, 2000), { hidden: true }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 3000);
    expect(agg.count).toBe(1);
    expect(agg.leaderboard.length).toBe(1);
    expect(agg.leaderboard[0].campName).toBe('a');
    expect(agg.totalYes).toBe(10); // only the non-hidden row's total (8+2)
  });

  test('a falsy or absent hidden field is a no-op (sheet column not yet added)', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'yes' }, 1000),
      Object.assign(row('b', { food: 5, water: 5 }, { F1: 'no' }, 2000), { hidden: '' }),
      Object.assign(row('c', { food: 1, water: 1 }, { F1: 'no' }, 3000), { hidden: false }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 4000);
    expect(agg.count).toBe(3);
  });

  test('isHidden is truthy-only and null-safe', () => {
    expect(A.isHidden({ hidden: 'x' })).toBe(true);
    expect(A.isHidden({ hidden: true })).toBe(true);
    expect(A.isHidden({ hidden: '' })).toBe(false);
    expect(A.isHidden({ hidden: false })).toBe(false);
    expect(A.isHidden({})).toBe(false);
    expect(A.isHidden(null)).toBe(false);
    expect(A.isHidden(undefined)).toBe(false);
  });
});

describe('superlatives', () => {
  test('picks strongest/weakest sector, hardest question, top L4', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'yes', W1: 'no', 'F-adv': 'yes' }),
      row('b', { food: 6, water: 1 }, { F1: 'yes', W1: 'no', 'F-adv': 'yes' }),
      row('c', { food: 7, water: 3 }, { F1: 'no', W1: 'no', 'F-adv': 'no' }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 3);
    expect(s.strongest.id).toBe('food');
    expect(s.weakest.id).toBe('water');
    expect(s.hardest.id).toBe('W1');      // 0/3 yes
    expect(s.hardest.asked).toBe(3);
    expect(s.topL4.id).toBe('F-adv');     // 2 yes
    expect(s.topL4.yes).toBe(2);
  });

  test('minAsked keeps tiny samples from winning hardest', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'no' }),            // F1 asked once, 0%
      row('b', { food: 6, water: 1 }, { W1: 'no' }),
      row('c', { food: 7, water: 3 }, { W1: 'no' }),
      row('d', { food: 7, water: 3 }, { W1: 'yes' }),           // W1 asked 3x, 33%
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 3);
    expect(s.hardest.id).toBe('W1');
  });

  test('write-in camp topics never win topL4; empty data returns nulls', () => {
    const rows = [row('a', { food: 8, water: 2 }, { 'F-camp': 'yes' })];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 1);
    expect(s.topL4).toBe(null);
    const empty = A.superlatives(A.computeAggregates([], SECTORS, 2000), SECTORS, 3);
    expect(empty.strongest).toBe(null);
    expect(empty.hardest).toBe(null);
    expect(empty.bestBalance).toBe(null);
    expect(empty.fullSweep).toBe(null);
  });

  test('bestBalance picks the smallest spread across sectors; fullSweep needs a 10/10 sector', () => {
    const rows = [
      row('lopsided', { food: 10, water: 0 }, { F1: 'yes' }),
      row('balanced', { food: 5, water: 4 }, { F1: 'yes' }),
      row('swept', { food: 10, water: 3 }, { F1: 'yes' }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 1);
    expect(s.bestBalance.campName).toBe('balanced');
    expect(s.bestBalance.spread).toBe(1);
    expect(s.fullSweep.campName).toBe('swept');
    expect(s.fullSweep.count).toBe(1);
  });

  test('bestBalance/fullSweep helpers are null-safe on empty campRows', () => {
    expect(A.bestBalance([], SECTORS)).toBe(null);
    expect(A.fullSweep([], SECTORS)).toBe(null);
  });
});
