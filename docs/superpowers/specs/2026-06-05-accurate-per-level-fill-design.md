# Accurate Per-Level Fill + Level Colors + Tiers→Levels — Design

**Date:** 2026-06-05
**Status:** Approved — building on the PR #32 branch (`perpoint-scoring-granular-data`).
**Supersedes:** the *compensated contiguous fill* model from `2026-06-04-unified-perpoint-scoring-and-granular-data-design.md`. The granular-capture infrastructure from that spec (the `answers` map, `mode`, `schemaVersion`, Worker forwarding, sheet `answers_json`) **stays**; only the scoring→graphic mapping, the hash, and the renderers change.

## Goal

Make the radius literally mirror the answers: each level fills per-question (not compensated), with gaps allowed, in distinct per-level colors. Same accuracy live in the game and in every result graphic (done screen, downloaded PNG, and the shared link).

## Decisions (locked with the user)

- **Fill = per-question segments.** Each level's ring is split into one segment per question; a segment fills (in the level's color) only if that question is Yes. Fill direction = question order (segment 1 = the level's first question).
- **Level 4 = count of advanced Yeses.** Advanced topics are picked from a variable menu, so L4's 4 segments represent the *count* of advanced Yes answers (first N filled, capped at 4), not specific topics. Which topics were chosen still lives in `answers_json`.
- **Colors:** L1 `#B91C1C`, L2 `#EA580B`, L3 `#3B82F6`, L4 `#31975B`. Filled segment → its level color; empty → neutral. "No" and "unanswered" both render empty.
- **Shared link shows the exact fill** → the pattern is embedded in the URL hash (result-state v2). This reverses the earlier lean-hash decision.
- **Sector score = total Yes (0–10).** Replaces the 0–4 "depth" in the sheet's per-sector columns and the center total.
- **Compensation removed:** `SCORE_BANDS [1,3,6,10]` and the depth mapping are deleted.
- **Tiers → Levels** in all user-facing copy. Internal identifiers (`tier4Topics`, `isTier4`) stay to limit churn.

## Core representation: `fills`

One structure derived from the `answers` map drives every renderer:

```js
const LEVEL_COLORS = ['#B91C1C', '#EA580B', '#3B82F6', '#31975B'];

// Per-sector fill: levels[0..2] = one bool per fixed question (in order);
// levels[3] = 4 slots, the first (advanced Yes count, capped 4) set true.
function sectorFill(sector, answers) {
  const levels = [0, 1, 2].map(li => (sector.levels[li] || []).map(q => answers[q.id] === 'yes'));
  const advYes = Math.min(4, (sector.tier4Topics || []).filter(t => answers[t.id] === 'yes').length);
  levels[3] = [0, 1, 2, 3].map(i => i < advYes);
  const fixedYes = levels.slice(0, 3).reduce((n, a) => n + a.filter(Boolean).length, 0);
  const ids = [].concat(...sector.levels.slice(0, 3)).map(q => q.id).concat((sector.tier4Topics || []).map(t => t.id));
  const played = ids.some(id => answers[id] === 'yes' || answers[id] === 'no');
  return { levels, totalYes: fixedYes + advYes, played }; // totalYes 0..10
}

function fillsFromAnswers(sectors, answers) {
  const out = {}; sectors.forEach(s => { out[s.id] = sectorFill(s, answers); }); return out;
}
```

This **replaces** the #32 helpers `scoreSector` (depth), `sectorLevelStates`, `levelStatesFromAnswers`, and `SCORE_BANDS`. `levelStates` (the old `['green'|'failed'|'locked']×4` state) is **removed**; `fills` is computed via `useMemo` from `answers`.

## Renderers (all keyed off `fills`)

- **`RadialBadge`** — for each sector wedge and each level band (`RINGS[li]→RINGS[li+1]`), split the 60° sweep into `levels[li].length` angular segments (small gap between them); fill `LEVEL_COLORS[li]` if that segment is true, else the neutral base color. Drop `buildSilhouette`/`depths`. Center total (when shown) becomes `{sum totalYes}/60`. `showGrid` ring outlines stay.
- **`RadiusLogomark`** — unchanged wrapper; inherits the new badge (reads as a small multicolor glyph).
- **`ShareCard`** + **`ResultCardSVG` (PNG)** — pass `fills` instead of `levelStates`; both embed `RadialBadge`/`RadiusLogomark`, so the radius updates automatically. The per-sector breakdown cell shows `{totalYes}/10` (was `L{greens}`); icon/label tint = "has any Yes".
- **`Wheel`** — same per-question segmentation inside its 4 bands (`ringRadii`/`ringOuter`), `LEVEL_COLORS[li]` for filled, existing sandy `ringTint[li]` for empty; dividers, icons, hub, spin button unchanged. Unplayed sectors → all empty (same as today's locked).

## Hash: result-state v2

```
encode({campName, leadName, year, fills}):
  per sector (SECTOR_IDS order):
    fixedBits = 6-bit pattern over levels[0..2] flattened (bit i = segment i true) → 0..63
    advCount  = count of true in levels[3]                                        → 0..4
    packed    = fixedBits * 5 + advCount                                          → 0..319
  payload { v:2, c, l, y, p:[packed×6] }
decode(hash):
  if o.p → reconstruct per sector: fixedBits→[6 bools] split into levels [1,2,3]; advCount→levels[3]=[i<advCount].
  else if o.g (legacy) → contiguous fallback: level li fully filled if li < g[i].
  returns { campName, leadName, year, fills }   // fills usable directly by ShareCard
```

`greensToLevelStates` is removed. `result/index.html` uses `decode(...).fills` and renders `<ShareCard fills={...} .../>`.

## Scoring / data plumbing

- **POST `greens`** per sector = `sectorFill(...).totalYes` (0–10). The Worker clamp changes `Math.min(4,…)` → `Math.min(10,…)`. Sheet's 6 per-sector columns now hold 0–10 (no new columns; a wider range — heads-up for sheet readers).
- **Hash** carries `p` (pattern), built from `fills`.
- `answers_json` unchanged (already the full per-question record).
- **STORAGE_VERSION** 5 → 6 (`levelStates` dropped from the save; `answers`/`mode` already saved). `loadSaved` sanity check updated to validate `answers` is an object + `sectorCursor`/`sectorClosed` typed.
- **Celebration** fires when a completed sector hits `totalYes === 10`; the sector-done toast shows `{totalYes} of 10`.

## Copy: Tiers → Levels

User-facing strings: the modal's `Tier {n}` → `Level {n}`; the form's `Tier 4 · mark any 4+` → `Level 4 · …`; any FAQ/intro "tier" → "level". Keep `tier4Topics`/`isTier4` identifiers.

## Verification

- Parse gates (jsx, game-data, worker).
- Playwright: the Water example (No, Yes, No, YesYesYes, No×4) renders L1 empty / L2 first-half / L3 full / L4 empty (assert segment fills in the SVG); board + form parity; POST `greens.water` etc. now 0–10; result page renders the same fill from the hash. Screenshot the done-screen card for visual confirmation.

## Out of scope
- Admin viewer (still a later, separate PR).
- No question-content changes.
