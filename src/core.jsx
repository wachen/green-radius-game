// src/core.jsx — shared hooks, constants, persistence, and per-question scoring.
// First script in the shared Babel scope: every later module (and the inline
// mount scripts) uses the names declared here by bare name. Script order lives
// in the HTML entry points — src/core.jsx first, green-radius.jsx last.

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Single shared read of the OS `prefers-reduced-motion` setting. Read-once
// (no change listener — matches the rest of the reduced-motion gating, which
// is also read-once) so every animation surface (Fx particles, wheel spin
// timing, celebration/toast) checks the same thing the same way.
function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Shared modal a11y: lock background scroll while open, and trap Tab focus inside
// the dialog so keyboard/SR users can't wander onto the obscured page behind it.
function useModalA11y(ref) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      // Skip elements CSS hides (visibility/display): they match the selector but
      // can never hold focus, and a hidden "last" element breaks the wrap.
      const f = Array.from(node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; });
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [ref]);
}

// ─── persistence ──────────────────────────────────────────────────────────────
// Saves the in-progress game so a refresh resumes where you left off.
// Bump STORAGE_VERSION when the saved shape changes so old saves are discarded
// instead of trying to merge them in.
const STORAGE_KEY = 'green-radius-game/v1';
const STORAGE_VERSION = 7;

// Caps free-text notes (write-in ideas) UI-side, everywhere a player types one.
const NOTE_MAX_LEN = 140;

const COMMUNITY_LINK_URL = 'https://www.greenthemecampcommunity.org/';
// One player download on the home screen. The "How-to-Play" file is the
// superset PDF (how-to-play + board + coloring wheel + matrix), so the single
// "Board Game PDF" link serves it; the board-only PDF stays in /downloads/
// but is no longer linked.
const BOARD_GAME_PDF_URL = '/downloads/' + encodeURIComponent('2026.05.19 Green Radius Game -- Download for Players -- How-to-Play - Board Game - Matrix - Detail -- v 26 FINAL .pdf');
const RESOURCE_GUIDE_URL = 'https://www.greenthemecampcommunity.org/resource-guide';
const REPORT_EMAIL = 'greenthemecamps@burningman.org';

// Deploy stamp shown (tiny) at the bottom of the home screen so anyone can
// tell at a glance which release is live. No build step = no git SHA to
// inject, so the convention is manual: bump to the PR number in every PR.
const APP_VERSION = 'v92';

// Every valid question id in the current game (Levels 1–3 by question id +
// Tier-4 topic ids). Used to drop stale ids when salvaging an older save.
function validQidSet(sectors) {
  const set = new Set();
  sectors.forEach(s => {
    s.levels.slice(0, 3).forEach(level => (level || []).forEach(q => set.add(q.id)));
    (s.tier4Topics || []).forEach(t => set.add(t.id));
    campIdeaIds(s).slice(1).forEach(id => set.add(id)); // extra write-in slots 2-4
  });
  return set;
}

function isCurrentShape(data, sectors) {
  return data.version === STORAGE_VERSION && data.answers && typeof data.answers === 'object' &&
    sectors.every(s =>
      typeof (data.sectorCursor && data.sectorCursor[s.id]) === 'number' &&
      typeof (data.sectorClosed && data.sectorClosed[s.id]) === 'boolean'
    );
}

// Turn any saved blob into something usable. A current-shape save passes through.
// An OLDER save is SALVAGED instead of silently discarded on a version bump (the
// qid -> 'yes'/'no' answer map has been the stable contract): keep the camp + the
// answers whose question ids still exist, recompute per-sector progress, and flag
// `salvaged` so the UI can say so. A completed ('done') save or an unrecognizable
// one returns null.
function migrateSaved(data, sectors) {
  if (!data || typeof data !== 'object') return null;
  if (isCurrentShape(data, sectors)) return data;
  if (data.phase === 'done') return null;            // result already captured; don't resurrect
  if (!data.answers || typeof data.answers !== 'object') return null;

  const valid = validQidSet(sectors);
  const answers = {};
  for (const k of Object.keys(data.answers)) {
    const v = data.answers[k];
    if (valid.has(k) && (v === 'yes' || v === 'no')) answers[k] = v;
  }
  // Carry write-in idea text whose topic id still exists and was actually answered.
  const customNotes = {};
  if (data.customNotes && typeof data.customNotes === 'object') {
    for (const k of Object.keys(data.customNotes)) {
      const t = data.customNotes[k];
      if (valid.has(k) && answers[k] && typeof t === 'string' && t.trim()) customNotes[k] = t.slice(0, NOTE_MAX_LEN);
    }
  }
  const sectorClosed = {}, sectorCursor = {};
  sectors.forEach(s => {
    const fixed = s.levels.slice(0, 3).reduce((a, lvl) => a.concat(lvl || []), []);
    const done = fixed.length > 0 && fixed.every(q => answers[q.id] === 'yes' || answers[q.id] === 'no');
    sectorClosed[s.id] = done;
    sectorCursor[s.id] = done ? 4 : 0;
  });
  const str = (v) => typeof v === 'string' ? v : '';
  const camp = (data.camp && typeof data.camp === 'object')
    ? { campName: str(data.camp.campName), leadName: str(data.camp.leadName), email: str(data.camp.email) }
    : { campName: '', leadName: '', email: '' };
  // Keep the stable per-camp id (a plain string) if it survived; otherwise mint
  // a fresh one, same as a brand-new save would.
  const campId = typeof data.campId === 'string' && data.campId ? data.campId : genCampId();
  const mode = data.mode === 'form' ? 'form' : 'board';
  return {
    version: STORAGE_VERSION,
    phase: mode === 'form' ? 'form' : 'playing',
    camp, campId, sectorCursor, sectorClosed, answers, customNotes, mode,
    submittedAt: null, salvaged: true,
  };
}

function loadSaved(sectors) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateSaved(JSON.parse(raw), sectors);
  } catch (e) {
    console.warn('loadSaved: could not read/parse saved game', e);
    return null;
  }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// A stable per-camp id, generated once when a game's save is first created and
// carried for its lifetime (persisted as an additive `campId` key — no
// STORAGE_VERSION bump needed). It rides to the sheet inside the answers blob so
// the read side can dedup a camp's repeat submissions (retries/redos) instead
// of counting each as a new camp. crypto.randomUUID needs a secure context
// (prod is https, dev is localhost); the fallback covers anything else.
function genCampId() {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch {}
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ─── Scoring + fill (per-point, per-question) ──────────────────────────────────
// Every Yes is worth 1 point. A sector has 10 questions: 6 fixed (Levels 1–3,
// sized 1/2/3) + up to 4 advanced picks (Level 4). The radius mirrors the answers
// exactly — each level's ring fills per question — so a No just leaves its
// segment empty (no compensation, gaps allowed).
// A green ramp: Level 1 starts near the brand accent green (#7AB85C) and
// deepens per level to the Level-4 dark green, so a lit wheel reads as green
// radiating outward from the center. (The Spin hub itself uses accentDark so
// its white label passes WCAG AA.)
const LEVEL_COLORS = ['#68B05C', '#56A85C', '#439F5B', '#31975B'];

// Up to 4 write-in "Our Camp's Idea" slots per sector. The first is the
// data-defined X-camp topic (already in tier4Topics); slots 2-4 are synthetic
// ids (X-camp-2/3/4) the form can add on demand. Returns [] for a sector with
// no write-in topic. Each idea answered "yes" earns a Level-4 point.
function campIdeaIds(sector) {
  const base = (sector.tier4Topics || []).find(t => /-camp$/.test(t.id));
  return base ? [base.id, base.id + '-2', base.id + '-3', base.id + '-4'] : [];
}

/**
 * Per-sector fill: levels[0..2] = one bool per fixed question (in order);
 * levels[3] = 4 slots, the first (advanced-Yes count, capped at 4) set true.
 * totalYes is 0..10; `played` is true once any of the sector's questions is answered.
 * @typedef {Object} SectorFill
 * @property {boolean[][]} levels  per-level arrays of per-question Yes flags ([1],[2],[3],[4] long)
 * @property {number} totalYes     0-10, total Yes across the sector
 * @property {boolean} played      sector was opened at least once
 * fills: { [sectorId]: SectorFill }, one entry per id in `sectors`.
 */
function sectorFill(sector, answers) {
  const levels = [0, 1, 2].map(li => (sector.levels[li] || []).map(q => answers[q.id] === 'yes'));
  // Extra write-in ideas (slots 2-4) count toward Level 4 alongside the fixed
  // tier-4 topics (which already include the base X-camp slot).
  const extraCampIds = campIdeaIds(sector).slice(1);
  const advYes = Math.min(4,
    (sector.tier4Topics || []).filter(t => answers[t.id] === 'yes').length +
    extraCampIds.filter(id => answers[id] === 'yes').length);
  levels[3] = [0, 1, 2, 3].map(i => i < advYes);
  const fixedYes = levels.slice(0, 3).reduce((n, a) => n + a.filter(Boolean).length, 0);
  const ids = [].concat(...sector.levels.slice(0, 3)).map(q => q.id)
    .concat((sector.tier4Topics || []).map(t => t.id)).concat(extraCampIds);
  const played = ids.some(id => answers[id] === 'yes' || answers[id] === 'no');
  return { levels, totalYes: fixedYes + advYes, played };
}

function fillsFromAnswers(sectors, answers) {
  const out = {};
  sectors.forEach(s => { out[s.id] = sectorFill(s, answers); });
  return out;
}

// ─── perfect-total detection (60/60 golden moment) ─────────────────────────
// A camp's grand total is 0-60 (6 sectors x 10 questions each). Exactly 60
// means every question in every sector was answered Yes — the one-time
// golden celebration in green-radius.jsx and the golden card treatment in
// src/share-card.jsx both gate on this.
const PERFECT_TOTAL = 60;
function isPerfectTotal(total) {
  return total === PERFECT_TOTAL;
}

// Isomorphic export, same guarded pattern as game-data.js/result-state.js: a
// no-op in the browser (module is undefined there), lets bun test exercise
// the pure save-migration logic directly.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { migrateSaved, isCurrentShape, validQidSet, STORAGE_VERSION, PERFECT_TOTAL, isPerfectTotal };
}
