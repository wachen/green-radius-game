# Unified Per-Point Scoring + Granular Answer Capture — Design

**Date:** 2026-06-04
**Status:** Awaiting user spec review
**Branch (planned):** one branch off `origin/main`, one PR.

## Goal

Replace the two divergent, all-or-nothing scoring paths with a single **per-point** rule, and capture **every individual answer** for backend analysis — without changing the share link or the result page.

## Background — current behavior

- **Game** (`handleAnswers`, green-radius.jsx:1899): a consecutive `chain`. A tier greens only if every question in it is Yes **and** every earlier tier greened. One early No zeroes the rest of the sector. Raw answers (and which Tier-4 topics were picked) are discarded after scoring.
- **Form** (`computeLevelStates`, green-radius.jsx:1293): scores each tier independently (all-Yes per tier). Keeps every answer in `formAnswers` (`{qid: 'yes'|'no'}`), but never sends it anywhere.
- **Result contract:** `greens` = `{food,water,waste,transport,shelter,power}`, each 0–4. Threaded game → `result-state` encode → Worker → sheet → email. `result-state` stores only the per-sector **count**, relying on greens being a contiguous prefix.
- **Sheet** records only the 6 sector totals (plus camp metadata). No per-question data.

## The unified scoring rule — cumulative bands

Every Yes is worth **1 point**. Each sector has exactly 10 questions (tiers sized 1 / 2 / 3 / 4). Sum the sector's Yes answers, then map the total to a **contiguous radius depth (0–4)** via cumulative bands **[1, 3, 6, 10]**:

| Yes answers in a sector (of 10) | Depth |
|---|---|
| 0 | empty (0) |
| 1–2 | T1 (1) |
| 3–5 | T2 (2) |
| 6–9 | T3 (3) |
| 10 | full radius (4) |

`depth = [1,3,6,10].filter(b => yesCount >= b).length`.

- The radius stays a **single contiguous wedge** per sector (no scattered greens). The existing `RadialBadge` depth logic and the result page work unchanged.
- Full radius (T4) requires a **perfect sector** (all 10 Yes, including all 4 advanced picks). This is the strict reading chosen by the user; "skip advanced" caps a sector at T3. *Tunable:* moving the top band 10 → 9 would allow one miss. Default: keep `[1, 3, 6, 10]`.
- **Validation of the reported bug:** Water, No to the first 4, Yes to the 5th, skip advanced = 1 Yes → depth 1 (T1). Previously 0. Fixed.

## Canonical per-question answers map

Both modes converge on **one structure**: `answers = { [questionId]: 'yes' | 'no' }`.

- Fixed questions (T1–T3) are keyed by their question id (`F1`, `F2`, …).
- Tier-4 picks are keyed by the **chosen topic id** (`F-reusable`, …). A topic that was never picked simply has no key (distinct from a `'no'`).
- **Form** already produces this exact shape (`formAnswers`). It is renamed to `answers` (the bump to `STORAGE_VERSION` makes the rename safe). `LinearForm`'s internal prop is already named `answers`.
- **Game** currently drops it. `QuestionModal.onComplete` will pass **both** `answersByLevel` and `pickedTopicIds` (they are positionally aligned — both pushed together in `answer()`). `handleAnswers` zips them into the same `{qid: 'yes'|'no'}` shape (fixed ids from `sector.levels[0..2]`, Tier-4 ids from `pickedTopicIds`) and merges into the shared `answers` state.

## Shared scoring helpers (new, used by both modes)

```js
const SCORE_BANDS = [1, 3, 6, 10];

// All question ids for a sector: 6 fixed (T1-T3) + its Tier-4 topic ids.
function sectorAnswerIds(sector) {
  const fixed = [].concat(...sector.levels.slice(0, 3)).map(q => q.id);
  const t4 = (sector.tier4Topics || []).map(t => t.id);
  return fixed.concat(t4);
}

function scoreSector(sector, answers) {
  const ids = sectorAnswerIds(sector);
  const answered = ids.filter(id => answers[id] === 'yes' || answers[id] === 'no');
  const yeses = ids.filter(id => answers[id] === 'yes').length;
  const depth = SCORE_BANDS.filter(b => yeses >= b).length; // 0..4
  return { yeses, depth, played: answered.length > 0 };
}

// Contiguous prefix of greens; remainder 'failed' if the sector was played,
// 'locked' if untouched — preserves the current wheel visuals.
function sectorLevelStates(sector, answers) {
  const { depth, played } = scoreSector(sector, answers);
  return [0, 1, 2, 3].map(i => i < depth ? 'green' : (played ? 'failed' : 'locked'));
}

function levelStatesFromAnswers(sectors, answers) {
  const out = {};
  sectors.forEach(s => { out[s.id] = sectorLevelStates(s, answers); });
  return out;
}
```

Both `handleAnswers` (game) and `computeLevelStates`→`handleSubmit` (form) call these. The greens count fed to the hash/POST is still `levelStates[id].filter(x => x === 'green').length` (unchanged downstream — it now equals the depth).

## Data flow

```
ANSWER CAPTURE (both modes)  ->  answers: {qid: 'yes'|'no'}
        |                                   |
        v                                   v
  scoring (cumulative bands)          POST /api/complete  (backend only)
        |                                   |
        v                                   v
  levelStates (contiguous)            Worker sanitizes -> row.answers (JSON)
        |                                   |
        v                                   v
  greens count (0-4)  ----> hash (UNCHANGED)   -> Apps Script -> Sheet (new columns)
        |
        v
  result page / share card (sector totals only — UNCHANGED)
```

The hash and the sheet are independent channels. Granular data rides only the POST → sheet path.

## What changes, file by file

1. **green-radius.jsx**
   - Add `SCORE_BANDS` + the four shared helpers above (near other top-level helpers).
   - `QuestionModal`: `onComplete(answersByLevel, pickedTopicIds)` at both call sites (the natural completion at ~388 and the "None / skip advanced" button at ~511).
   - `handleAnswers(answersByLevel, pickedTopicIds)`: build the sector's `{qid:'yes'|'no'}`, merge into shared `answers` state, set `levelStates[sector.id] = sectorLevelStates(...)`. Keep the celebration/toast (still keyed on green count).
   - `computeLevelStates` (form) → replaced by `levelStatesFromAnswers(sectors, answers)`.
   - Rename state `formAnswers` → `answers`; update `setFormAnswer`, the `LinearForm answers={...}` prop, and the persistence list.
   - Add explicit `mode` state (`'board' | 'form'`), set in `startGame` / `startForm`; use it for the POST `mode` instead of the `Object.keys(formAnswers).length` heuristic.
   - Auto-send effect (~1813): include `answers`, `mode`, and `schemaVersion` in the POST body.
   - Bump `STORAGE_VERSION` 4 → 5; persist `answers` (replacing `formAnswers`).
2. **worker/index.js**
   - Accept and sanitize `body.answers` (object; keys are strings ≤ 40 chars; values strictly `'yes'|'no'`; cap at ≤ 120 entries). Pass into `row.answers`. Add `row.schemaVersion` and set `row.source = body.mode === 'form' ? 'form' : 'board'`.
   - Keep the 4096-byte body cap (granular payload ≈ 1.2 KB, comfortably under).
3. **game-data.js** — add a single exported content stamp `window.SCHEMA_VERSION = 'frog-v12'` (or similar) used for the POST `schemaVersion`. No question changes.
4. **Google Apps Script + Sheet** — external, see next section.
5. **docs/architecture.md** — update the data-flow / `/api/complete` contract section to note the `answers` field + the scoring rule (wiring change).

## What does NOT change

- `result-state.js` encode/decode and the hash format (still `{c,l,y,g[6]}`, greens 0–4).
- `result/index.html` and `ShareCard` — the share page still shows sector totals only.
- The `greens` 0–4 contract and the existing 6 sector-total sheet columns.
- The email and `safeResultUrl` host/path pinning.
- Form completion gating (T1–T3 required, T4 optional) and the game's "answer all 10" flow.

## Google Sheet / Apps Script changes (the external piece)

The Apps Script web app (behind `SHEETS_WEBAPP_URL`) is **not in this repo** and is owned externally — these are instructions to apply there, not code in the PR. The Worker will start sending two new fields: `answers` (the full `{qid: 'yes'|'no'}` map) and `schemaVersion`.

**Recommended (minimal, lossless): one JSON column + a version stamp.**

1. In the responses sheet, add two header columns to the right of the existing ones:
   - `answers_json`
   - `schema_version`
2. In the Apps Script `doPost`, append the two new values when writing the row:

```js
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  // ...existing shared-secret check and sheet lookup...
  sheet.appendRow([
    new Date(),
    data.campName, data.leadName, data.email, data.year,
    data.greens.food, data.greens.water, data.greens.waste,
    data.greens.transport, data.greens.shelter, data.greens.power,
    data.source, data.resultUrl,
    JSON.stringify(data.answers || {}),  // -> answers_json
    data.schemaVersion || ''             // -> schema_version
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Adapt the column order / sheet name to the actual script. Existing rows simply have the two new columns blank. Re-deploy the web app (same `/exec` URL if you "Manage deployments → edit → New version"; the Worker secret is unchanged).

Why a JSON column rather than ~100 per-question columns: the T1–T3 questions are stable, but Tier-4 answers are **picked** from an ~11-option menu per sector, so a fully columnar layout needs a column for every possible topic and breaks whenever the topic list changes. The JSON column is lossless, survives content edits, and can be expanded into columns later in-sheet. `schema_version` lets you align historical rows if questions change.

**Alternative (if you want Forms-style pivots now):** add 36 fixed-question columns (one per T1–T3 question id) plus a single `tier4_json` column for the variable advanced picks. More setup, more pivotable. Say the word and the plan will target this instead.

## Visual note

Under the compensated model there is no per-tier "fail" — only a reached depth. The wheel still distinguishes a played-but-unreached ring (`'failed'`, faint wash) from an untouched sector (`'locked'`, sandy), so played sectors look as they do today; only the *depth* is computed differently. The result badge keys solely off the leading-green count, so it is visually identical to today for any given depth.

## Edge cases

- **Skip advanced / partial Tier-4:** unpicked topics contribute 0 points and no answer key. A sector that skips all of Tier 4 maxes at 6 Yes → T3.
- **Blank form answers:** a question left blank is neither Yes nor No; it scores 0 and is omitted from `answers` (so blank ≠ No in the data). Form submission still requires all T1–T3 answered, so every submitted sector is "played."
- **Bot honeypot / missing fields / oversized body:** Worker behavior unchanged.

## Testing & verification

- **Parse gate:** `bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null` (exit 0); `bun build game-data.js > /dev/null`.
- **Unit-ish checks of the scoring helper** against the band table and the reported test case (1 Yes → T1; 5 Yes → T2; 6 Yes → T3; 10 Yes → full; 0 Yes → empty).
- **Playwright (bun + chromium):**
  1. Board mode: play a sector answering a non-consecutive mix (e.g. No, No, Yes, Yes, Yes, …) and assert the rendered depth matches the band table — specifically reproduce the original Water case and assert depth 1.
  2. Form mode: same answers via the form produce the **same** depth (game/form parity).
  3. Mock `/api/complete`; assert the POST body carries `answers` with the expected `{qid:'yes'|'no'}` entries (including a picked Tier-4 topic id) and `mode`.
  4. Result page: load a hash and confirm it still renders sector totals (unchanged).
- **Worker:** sanitization unit check (drops non-`yes/no` values, caps entry count, stays under 4 KB).

## Out of scope / risks

- The Apps Script change is manual and external; the PR cannot verify it. The Worker degrades gracefully if the sheet write fails (returns `err`, site/email unaffected), so shipping the code before the sheet is updated only means `answers_json` is sent-but-not-recorded until the script is updated — no breakage.
- No change to question content, the share link, or the result page.
```