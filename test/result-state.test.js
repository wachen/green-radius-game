import { test, expect } from 'bun:test';
import ResultState from '../result-state.js';

const SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];

function toB64Url(str) {
  const b64 = Buffer.from(str, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

test('round-trip: encode then decode preserves campName/leadName/year and per-sector totalYes', () => {
  // levels shape per sector: [bool[1], bool[2], bool[3], bool[4]] -> 1+2+3+4 = 10 booleans.
  const fills = {};
  let seed = 0;
  for (const id of SECTOR_IDS) {
    const levels = [
      [true],
      [true, false],
      [true, false, true],
      [true, true, false, false],
    ];
    fills[id] = { levels };
    seed++;
  }

  const payload = { fills, campName: 'Dusty Camp', leadName: 'Sandy', year: 2026 };
  const encoded = ResultState.encode(payload);
  expect(typeof encoded).toBe('string');

  const decoded = ResultState.decode(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded.campName).toBe('Dusty Camp');
  expect(decoded.leadName).toBe('Sandy');
  expect(decoded.year).toBe(2026);

  // Level 1-3 are "fixed" (6 bools: 1+2+3), level 4 (advanced) counts true bits, up to 4.
  // In our fixture: level1 true(1) + level2 true,false(1) + level3 true,false,true(2) = 4 fixed trues
  // plus advCount = level4 true,true,false,false -> 2 trues -> advCount 2.
  const expectedTotalYes = 4 + 2;
  for (const id of SECTOR_IDS) {
    expect(decoded.fills[id].totalYes).toBe(expectedTotalYes);
    expect(decoded.fills[id].played).toBe(true);
  }
});

test('legacy v1 payload (g array) is accepted by decode', () => {
  // Legacy encoder shape: { v: 1 (or omitted), c, l, y, g: [count0..4 per sector] }
  const counts = [0, 1, 2, 3, 4, 2];
  const legacy = { c: 'Legacy Camp', l: 'Old Lead', y: 2019, g: counts };
  const encoded = toB64Url(JSON.stringify(legacy));

  const decoded = ResultState.decode(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded.campName).toBe('Legacy Camp');
  expect(decoded.leadName).toBe('Old Lead');
  expect(decoded.year).toBe(2019);

  // sizes = [1,2,3,4]; totalYes for count c = sum of sizes[0..c-1]
  const sizes = [1, 2, 3, 4];
  const expectedTotals = counts.map(c => {
    let total = 0;
    for (let li = 0; li < 4; li++) if (li < c) total += sizes[li];
    return total;
  });
  SECTOR_IDS.forEach((id, i) => {
    expect(decoded.fills[id].totalYes).toBe(expectedTotals[i]);
    expect(decoded.fills[id].played).toBe(counts[i] > 0);
  });
});

test('decode of garbage string returns null, does not throw', () => {
  expect(ResultState.decode('not-valid-base64url-json!!!')).toBeNull();
  expect(ResultState.decode('')).toBeNull();
  expect(ResultState.decode(null)).toBeNull();
});
