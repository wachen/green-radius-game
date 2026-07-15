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
  });
});
