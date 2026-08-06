import { test, expect, describe } from 'bun:test';
import A from '../admin/aggregate.js';

// Two tiny sectors: enough shape for perQuestion/standings without game-data.
const SECTORS = [
  { id: 'food', name: 'Food', levels: [[{ id: 'F1', title: 'Bulk buy' }], [], []],
    tier4Topics: [{ id: 'F-adv', title: 'Compost' }, { id: 'F-camp', title: "Our Camp's Idea" }] },
  { id: 'water', name: 'Water', levels: [[{ id: 'W1', title: 'Refill' }], [], [{ id: 'W3', title: 'Evap pond' }]],
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
    expect(empty.easiest).toBe(null);
    expect(empty.topL3).toBe(null);
  });

  test('easiest is the highest yes rate above minAsked; topL3 counts level-3 yes camps', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'yes', W1: 'no', W3: 'yes' }),
      row('b', { food: 6, water: 1 }, { F1: 'yes', W1: 'no', W3: 'yes' }),
      row('c', { food: 7, water: 3 }, { F1: 'yes', W1: 'yes' }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 3);
    expect(s.easiest.id).toBe('F1');   // 3/3 yes; W3 is 2/2 but under minAsked
    expect(s.easiest.rate).toBe(1);
    expect(s.topL3.id).toBe('W3');     // topL3 counts camps, no minAsked gate
    expect(s.topL3.yes).toBe(2);
  });
});

describe('momentum: "this week" resets Monday 00:00 Pacific', () => {
  const wedNoon = Date.UTC(2026, 6, 29, 12); // Wednesday Jul 29 2026

  test('weekStartMs pins the boundary to Monday 00:00 Pacific in any runner timezone', () => {
    // Mon Jul 27 2026 00:00 PDT (UTC-7) === Jul 27 07:00 UTC, exactly.
    expect(A.weekStartMs(wedNoon)).toBe(Date.UTC(2026, 6, 27, 7));
  });

  test('weekStartMs handles standard time too (PST, UTC-8)', () => {
    // Wed Jan 14 2026 12:00 UTC -> Mon Jan 12 2026 00:00 PST === Jan 12 08:00 UTC.
    expect(A.weekStartMs(Date.UTC(2026, 0, 14, 12))).toBe(Date.UTC(2026, 0, 12, 8));
  });

  test("last week's rows are excluded even when under 7 days old", () => {
    const rows = [
      row('this-tue', { food: 1, water: 0 }, {}, Date.UTC(2026, 6, 28, 12)), // Tuesday, this week
      row('last-fri', { food: 1, water: 0 }, {}, Date.UTC(2026, 6, 24, 12)), // Friday, 5 days before `now`
    ];
    const agg = A.computeAggregates(rows, SECTORS, wedNoon);
    expect(agg.momentum.thisWeek).toBe(1); // rolling 7-day window would say 2
  });
});

describe('playa address parsing (admin map)', () => {
  test('accepts the common formats in either order', () => {
    expect(A.parsePlayaAddress('7:30 & E')).toEqual({ hour: 7.5, ring: 5 });
    expect(A.parsePlayaAddress('E & 7:30')).toEqual({ hour: 7.5, ring: 5 });
    expect(A.parsePlayaAddress('7.30 and Esplanade')).toEqual({ hour: 7.5, ring: 0 });
    expect(A.parsePlayaAddress('730 & e')).toEqual({ hour: 7.5, ring: 5 });
    expect(A.parsePlayaAddress('  5:00 & A ')).toEqual({ hour: 5, ring: 1 });
    expect(A.parsePlayaAddress('10:00 & K')).toEqual({ hour: 10, ring: 11 });
    expect(A.parsePlayaAddress('2 & esp')).toEqual({ hour: 2, ring: 0 });
  });

  test('rejects garbage, out-of-range hours, bad minutes, missing halves', () => {
    expect(A.parsePlayaAddress('')).toBe(null);
    expect(A.parsePlayaAddress(null)).toBe(null);
    expect(A.parsePlayaAddress('Center Camp')).toBe(null);
    expect(A.parsePlayaAddress('12:00 & A')).toBe(null);  // outside 2:00-10:00
    expect(A.parsePlayaAddress('1:30 & B')).toBe(null);
    expect(A.parsePlayaAddress('10:30 & K')).toBe(null);  // past the city's edge
    expect(A.parsePlayaAddress('7:99 & E')).toBe(null);   // bad minutes
    expect(A.parsePlayaAddress('7:30')).toBe(null);       // no ring
    expect(A.parsePlayaAddress('E')).toBe(null);          // no hour
    expect(A.parsePlayaAddress('7:30 & Z')).toBe(null);   // ring past K
  });

  test('geometry: 6:00 points straight down, rings order outward, 2:00/10:00 mirror', () => {
    const six = A.playaXY({ hour: 6, ring: 5 });
    expect(Math.abs(six.x)).toBeLessThan(1e-9);
    expect(six.y).toBeCloseTo(A.playaRingRadius(5));
    expect(A.playaRingRadius(0)).toBeLessThan(A.playaRingRadius(11));
    const two = A.playaXY({ hour: 2, ring: 3 }), ten = A.playaXY({ hour: 10, ring: 3 });
    expect(two.x).toBeCloseTo(-ten.x);
    expect(two.y).toBeCloseTo(ten.y);
    expect(two.y).toBeLessThan(0); // 2:00 sits above the Man on screen
  });
});

describe('visit tracking (owner-typed Visit column)', () => {
  test('visitState: blank = none, name = assigned, check/done/visited = done', () => {
    expect(A.visitState('')).toBe('none');
    expect(A.visitState(undefined)).toBe('none');
    expect(A.visitState('Alice')).toBe('assigned');
    expect(A.visitState('✓ Alice')).toBe('done');
    expect(A.visitState('done')).toBe('done');
    expect(A.visitState('Visited 8/25')).toBe('done');
    expect(A.visitState('Donna')).toBe('assigned'); // "done" must not match inside a name
  });

  test('visitAssignee strips the done marker', () => {
    expect(A.visitAssignee('Alice')).toBe('Alice');
    expect(A.visitAssignee('✓ Alice')).toBe('Alice');
    expect(A.visitAssignee('done: Bob')).toBe('Bob');
    expect(A.visitAssignee('done')).toBe('');
  });

  test('visitOrder sweeps by hour then ring; unmappable camps go last', () => {
    const c = (name, loc) => ({ campName: name, campLocation: loc });
    const out = A.visitOrder([
      c('far', '9:00 & B'), c('mid', '4:30 & K'), c('near', '4:30 & A'),
      c('lost', 'no idea'), c('first', '3:00 & C'),
    ]).map(x => x.campName);
    expect(out).toEqual(['first', 'near', 'mid', 'far', 'lost']);
  });
});

describe('city analytics (admin panel)', () => {
  test('scoreHistogram buckets totals by ten, 60 lands in the top bucket', () => {
    const rows = [
      row('a', { food: 5, water: 0 }, { F1: 'yes' }, 1000),          // 5  -> 0-9
      row('b', { food: 10, water: 5 }, { F1: 'yes' }, 1000),         // 15 -> 10-19
      Object.assign(row('c', { food: 10, water: 10 }, { F1: 'yes' }, 1000), { total: 60 }), // 50-60
      Object.assign(row('d', { food: 10, water: 9 }, { F1: 'yes' }, 1000), { total: 58 }),  // 50-60
    ];
    const h = A.scoreHistogram(rows);
    expect(h.bins.map(b => b.count)).toEqual([1, 1, 0, 0, 0, 2]);
    expect(h.max).toBe(2);
  });

  test('scoreHistogram uses the aggregate population: hidden and legacy out, deduped', () => {
    const rows = [
      row('a', { food: 5, water: 0 }, { F1: 'yes' }, 1000),
      Object.assign(row('junk', { food: 9, water: 9 }, { F1: 'yes' }, 1000), { hidden: 'x' }),
      { campName: 'old', email: 'old@x.com', greens: { food: 2, water: 1 }, total: 3, answers: {}, timestamp: 900 }, // legacy 0-4 scale
      row('a', { food: 10, water: 5 }, { F1: 'yes' }, 2000), // same camp, newer -> only this one counts
    ];
    const h = A.scoreHistogram(rows);
    expect(h.bins.map(b => b.count)).toEqual([0, 1, 0, 0, 0, 0]); // just camp a's latest (15)
  });

  test('weeklyCounts groups by the Monday-Pacific week, oldest first, window-bounded', () => {
    const wedNoon = Date.UTC(2026, 6, 29, 12); // Wed Jul 29 2026; week starts Mon Jul 27 07:00 UTC
    const rows = [
      row('w1', { food: 1, water: 0 }, {}, Date.UTC(2026, 6, 28, 12)), // this week
      row('w2', { food: 1, water: 0 }, {}, Date.UTC(2026, 6, 29, 1)),  // this week
      row('p1', { food: 1, water: 0 }, {}, Date.UTC(2026, 6, 24, 12)), // prior week (Fri Jul 24)
      row('anc', { food: 1, water: 0 }, {}, Date.UTC(2026, 2, 1, 12)), // March: outside the 8-week window
    ];
    const weeks = A.weeklyCounts(rows, wedNoon);
    expect(weeks.length).toBe(8);
    expect(weeks[7].start).toBe(Date.UTC(2026, 6, 27, 7));
    expect(weeks[7].count).toBe(2);
    expect(weeks[6].count).toBe(1);
    expect(weeks.reduce((n, w) => n + w.count, 0)).toBe(3);
    expect(weeks[7].count).toBe(A.computeAggregates(rows, SECTORS, wedNoon).momentum.thisWeek);
  });

  test('opportunities: lowest yes-rate fixed questions, minAsked-gated, write-ins never appear', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'no', W1: 'yes', W3: 'yes', 'F-camp': 'no' }),
      row('b', { food: 6, water: 1 }, { F1: 'no', W1: 'yes', W3: 'yes' }),
      row('c', { food: 7, water: 3 }, { F1: 'yes', W1: 'no' }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const opps = A.opportunities(agg, SECTORS);
    expect(opps.map(o => o.id)).toEqual(['F1', 'W1']); // W3 asked twice, under minAsked; F-camp is a topic, not a fixed question
    expect(opps[0].rate).toBeCloseTo(1 / 3);
    expect(opps[0].asked).toBe(3);
  });
});
