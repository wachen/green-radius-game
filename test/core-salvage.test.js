import { test, expect, describe } from 'bun:test';
import GameData from '../game-data.js';

const SECTORS = GameData.SECTORS;

// src/core.jsx is a shared-global-scope browser script: its very first line
// destructures hooks off a global `React`, which doesn't exist under bun test.
// Stub it before dynamically importing so the module body can run; the export
// block at the bottom (guarded by `typeof module !== 'undefined'`, same
// pattern as game-data.js/result-state.js) hands back the pure functions we
// actually want to exercise here — none of them touch React.
globalThis.React = { useState: () => {}, useEffect: () => {}, useRef: () => {}, useMemo: () => {}, useCallback: () => {} };
const Core = (await import('../src/core.jsx')).default;
const { migrateSaved, isCurrentShape, STORAGE_VERSION } = Core;

function freshSectorMap(fn) {
  const o = {};
  SECTORS.forEach(s => { o[s.id] = fn(s); });
  return o;
}

function currentShapeSave(overrides) {
  return Object.assign({
    version: STORAGE_VERSION,
    phase: 'playing',
    camp: { campName: 'Dusty Camp', leadName: 'Sandy', email: 'sandy@x.com' },
    campId: 'camp-current-1',
    sectorCursor: freshSectorMap(() => 0),
    sectorClosed: freshSectorMap(() => false),
    answers: { F1: 'yes' },
    customNotes: {},
    mode: 'board',
    submittedAt: null,
  }, overrides);
}

describe('migrateSaved: current-version save passes through untouched', () => {
  test('identical object is returned as-is (no re-derivation)', () => {
    const save = currentShapeSave();
    const out = migrateSaved(save, SECTORS);
    expect(out).toBe(save); // same reference: isCurrentShape short-circuits
  });
});

describe('migrateSaved: old-version save is salvaged, not wiped', () => {
  test('valid answers + camp info survive; shape is rebuilt at the current version', () => {
    const oldSave = {
      version: STORAGE_VERSION - 1, // e.g. v6 shape
      phase: 'playing',
      camp: { campName: 'Dusty Camp', leadName: 'Sandy', email: 'sandy@x.com' },
      campId: 'camp-old-1',
      answers: { F1: 'yes', F2: 'no' },
      customNotes: { 'F-camp': 'Composted everything' },
      mode: 'board',
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out).not.toBeNull();
    expect(out.version).toBe(STORAGE_VERSION);
    expect(out.salvaged).toBe(true);
    expect(out.answers).toEqual({ F1: 'yes', F2: 'no' });
    expect(out.camp).toEqual({ campName: 'Dusty Camp', leadName: 'Sandy', email: 'sandy@x.com' });
    expect(out.campId).toBe('camp-old-1'); // stable id carried through
    expect(out.mode).toBe('board');
    expect(out.phase).toBe('playing');
    // sectorClosed/sectorCursor are re-derived, not carried over blindly.
    expect(out.sectorClosed.food).toBe(false); // only F1/F2 of 6 answered
    expect(out.sectorCursor.food).toBe(0);
  });

  test('a fully-answered sector is marked closed after salvage', () => {
    const oldSave = {
      version: STORAGE_VERSION - 1,
      answers: { F1: 'yes', F2: 'no', F3: 'yes', F4: 'no', F5: 'yes', F6: 'no' },
      camp: { campName: 'Full Food', leadName: '', email: '' },
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.sectorClosed.food).toBe(true);
    expect(out.sectorCursor.food).toBe(4);
  });

  test('a missing/invalid campId mints a fresh one instead of leaking garbage', () => {
    const oldSave = { version: 3, answers: { F1: 'yes' }, campId: { evil: true } };
    const out = migrateSaved(oldSave, SECTORS);
    expect(typeof out.campId).toBe('string');
    expect(out.campId.length).toBeGreaterThan(0);
  });
});

describe('migrateSaved: unvalidated / garbage fields never leak through', () => {
  test('unknown question ids and stale ids are dropped from answers', () => {
    const oldSave = {
      version: 1,
      answers: { F1: 'yes', 'NOT-A-REAL-QID': 'yes', 'F1-legacy': 'no' },
      camp: {},
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.answers).toEqual({ F1: 'yes' });
  });

  test('non yes/no answer values are dropped even for a valid qid', () => {
    const oldSave = {
      version: 1,
      answers: { F1: '<script>alert(1)</script>', F2: 'maybe', F3: 'no' },
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.answers).toEqual({ F3: 'no' });
  });

  test('camp fields that are not strings collapse to empty string, not the raw value', () => {
    const oldSave = {
      version: 1,
      answers: { F1: 'yes' },
      camp: { campName: { toString: () => 'evil' }, leadName: 12345, email: ['a@x.com'] },
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.camp).toEqual({ campName: '', leadName: '', email: '' });
  });

  test('customNotes is dropped unless its topic id is valid AND actually answered', () => {
    const oldSave = {
      version: 1,
      answers: { 'F-camp': 'yes' },
      customNotes: { 'F-camp': 'Kept the note', 'F-unanswered': 'should be dropped', 'BOGUS-ID': 'nope' },
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.customNotes).toEqual({ 'F-camp': 'Kept the note' });
  });

  test('a completed ("done") old save is not resurrected', () => {
    const oldSave = { version: 1, phase: 'done', answers: { F1: 'yes' } };
    expect(migrateSaved(oldSave, SECTORS)).toBeNull();
  });

  test('a save with no usable answers map returns null', () => {
    expect(migrateSaved({ version: 1 }, SECTORS)).toBeNull();
    expect(migrateSaved({ version: 1, answers: 'not-an-object' }, SECTORS)).toBeNull();
  });

  test('totally garbage input (null, non-object, empty) is rejected safely', () => {
    expect(migrateSaved(null, SECTORS)).toBeNull();
    expect(migrateSaved(undefined, SECTORS)).toBeNull();
    expect(migrateSaved('not an object', SECTORS)).toBeNull();
    expect(migrateSaved(42, SECTORS)).toBeNull();
    expect(migrateSaved({}, SECTORS)).toBeNull();
  });

  test('unexpected extra top-level keys do not appear on the salvaged result', () => {
    const oldSave = {
      version: 1,
      answers: { F1: 'yes' },
      isAdmin: true,
      __proto__: { polluted: true },
      arbitraryJunk: { anything: 'goes here' },
    };
    const out = migrateSaved(oldSave, SECTORS);
    expect(out.isAdmin).toBeUndefined();
    expect(out.arbitraryJunk).toBeUndefined();
    expect(out.polluted).toBeUndefined();
  });
});

describe('isCurrentShape', () => {
  test('rejects a save missing per-sector cursor/closed entries', () => {
    const bad = currentShapeSave({ sectorCursor: {}, sectorClosed: {} });
    expect(isCurrentShape(bad, SECTORS)).toBe(false);
  });
});
