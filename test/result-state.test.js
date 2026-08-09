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

// ─── campId in the result payload (additive, backward-compatible) ─────────────

test('round-trip: campId is carried through encode/decode when present', () => {
  const fills = {};
  for (const id of SECTOR_IDS) fills[id] = { levels: [[true], [true, false], [false, true, false], [true, false, false, false]] };
  const encoded = ResultState.encode({ fills, campName: 'Dusty Camp', leadName: 'Sandy', year: 2026, campId: 'abc-123-uuid' });
  const decoded = ResultState.decode(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded.campId).toBe('abc-123-uuid');
  // camp/fills still intact alongside the new field
  expect(decoded.campName).toBe('Dusty Camp');
  expect(decoded.fills.food.totalYes).toBe(fills.food.levels.flat().filter(Boolean).length);
});

test('backward-compat: a v2 link WITHOUT campId decodes with campId null (old links)', () => {
  const fills = {};
  for (const id of SECTOR_IDS) fills[id] = { levels: [[true], [false, false], [false, false, false], [false, false, false, false]] };
  const encoded = ResultState.encode({ fills, campName: 'No Id Camp', year: 2025 });
  const decoded = ResultState.decode(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded.campId).toBeNull();
});

test('backward-compat: a legacy v1 (g array) link decodes with campId null', () => {
  const legacy = { c: 'Legacy Camp', l: 'Old Lead', y: 2019, g: [1, 2, 3, 4, 0, 2] };
  const encoded = toB64Url(JSON.stringify(legacy));
  const decoded = ResultState.decode(encoded);
  expect(decoded).not.toBeNull();
  expect(decoded.campId).toBeNull();
});

// ─── retired `cv` stamp: links minted while it existed must still decode ──────
// The payload is a key-based JSON object, so an unknown key is inert — but these
// are shared, persistent URLs already sitting in people's inboxes, so pin it.

test('backward-compat: a v2 link CONTAINING the retired cv key still decodes', () => {
  const withCv = { v: 2, c: 'Stamped Camp', l: 'Sandy', y: 2026, p: [217, 5, 0, 319, 42, 100], u: 'abc-123-uuid', cv: '2026' };
  const decoded = ResultState.decode(toB64Url(JSON.stringify(withCv)));
  expect(decoded).not.toBeNull();
  // Every field still lands on the right key — no shifting from the dropped stamp.
  expect(decoded.campName).toBe('Stamped Camp');
  expect(decoded.leadName).toBe('Sandy');
  expect(decoded.year).toBe(2026);
  expect(decoded.campId).toBe('abc-123-uuid');
  // 217 = fixedBits 43 (bits 0,1,3,5 -> 4 fixed Yes) * 5 + advCount 2 => totalYes 6
  expect(decoded.fills.food.totalYes).toBe(6);
  // ...and it decodes identically to the same link without the stamp.
  const noCv = { ...withCv };
  delete noCv.cv;
  expect(decoded).toEqual(ResultState.decode(toB64Url(JSON.stringify(noCv))));
});

// ─── reconstructSave: rebuild a current-shape localStorage save from a result ──

import GameData from '../game-data.js';
const SECTORS = GameData.SECTORS;

// Count the Yes answers reconstructSave produced for one sector — should equal
// that sector's totalYes in the decoded result (fixed-question Yeses + advanced count).
function yesCountForSector(sector, answers) {
  const fixedIds = sector.levels.slice(0, 3).flat().map(q => q.id);
  const topicIds = (sector.tier4Topics || []).map(t => t.id);
  return fixedIds.concat(topicIds).filter(id => answers[id] === 'yes').length;
}

function decodedFixture(campId) {
  const fills = {};
  for (const id of SECTOR_IDS) fills[id] = { levels: [[true], [true, false], [true, false, true], [true, true, false, false]] };
  const p = { fills, campName: 'Rebuild Camp', leadName: 'Ari', year: 2026 };
  if (campId) p.campId = campId;
  return ResultState.decode(ResultState.encode(p));
}

test('reconstructSave: produces a done, all-sectors-closed current-shape save', () => {
  const save = ResultState.reconstructSave(decodedFixture('camp-xyz'), SECTORS, { version: 7, campId: 'fallback', now: 'T0' });
  expect(save.version).toBe(7);
  expect(save.phase).toBe('done');
  expect(save.mode).toBe('board');
  expect(save.submittedAt).toBe('T0');
  expect(save.camp.campName).toBe('Rebuild Camp');
  expect(save.camp.leadName).toBe('Ari');
  SECTORS.forEach(s => {
    expect(save.sectorClosed[s.id]).toBe(true);
    expect(save.sectorCursor[s.id]).toBe(4);
  });
});

test('reconstructSave: answers reproduce each sector totalYes from the fills', () => {
  const decoded = decodedFixture('camp-xyz');
  const save = ResultState.reconstructSave(decoded, SECTORS, { version: 7, campId: 'fallback' });
  SECTORS.forEach(s => {
    expect(yesCountForSector(s, save.answers)).toBe(decoded.fills[s.id].totalYes);
  });
});

test('reconstructSave: carries the payload campId when present', () => {
  const save = ResultState.reconstructSave(decodedFixture('camp-xyz'), SECTORS, { version: 7, campId: 'fallback' });
  expect(save.campId).toBe('camp-xyz');
});

test('reconstructSave: mints (uses fallback) campId when the payload has none (legacy link)', () => {
  const save = ResultState.reconstructSave(decodedFixture(null), SECTORS, { version: 7, campId: 'fresh-minted' });
  expect(save.campId).toBe('fresh-minted');
});

test('reconstructSave: schema drift — a sector with fewer fixed questions does not throw, imports what aligns', () => {
  const decoded = decodedFixture('camp-xyz');
  // Simulate drift: shorten the first sector to a single fixed question.
  const drifted = SECTORS.map((s, i) => i === 0 ? { ...s, levels: [s.levels[0]], tier4Topics: [] } : s);
  let save;
  expect(() => { save = ResultState.reconstructSave(decoded, drifted, { version: 7, campId: 'x' }); }).not.toThrow();
  // Aligned question still imported; the sector is still marked closed.
  expect(save.sectorClosed.food).toBe(true);
});
