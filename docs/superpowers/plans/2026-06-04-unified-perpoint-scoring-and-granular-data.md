# Unified Per-Point Scoring + Granular Answer Capture — Implementation Plan

> **For agentic workers:** Execute task-by-task. This repo has **no test runner**; verification is the parse gate + a standalone bun assertion for the pure scoring logic + Playwright (bun + chromium) for behavior. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the game's consecutive-chain scoring and the form's per-tier scoring with one cumulative-band rule, and capture every individual answer for backend-only recording — without touching the hash or result page.

**Architecture:** Both modes produce one `answers = {questionId: 'yes'|'no'}` map. Shared helpers turn that into a contiguous 0–4 depth per sector via bands `[1,3,6,10]`. The same map is POSTed (backend-only) to the Worker, sanitized, and forwarded to the sheet as `answers_json`.

**Tech Stack:** React 18 UMD + in-browser Babel (`green-radius.jsx`), plain scripts (`game-data.js`, `result-state.js`), Cloudflare Worker (`worker/index.js`). Verify with `bun build` (parse gate) + bun/playwright.

**Spec:** `docs/superpowers/specs/2026-06-04-unified-perpoint-scoring-and-granular-data-design.md`

---

## File structure

- `green-radius.jsx` — add shared scoring helpers; rewrite `handleAnswers`; replace `computeLevelStates`; thread `pickedTopicIds`; rename `formAnswers`→`answers`; add `mode`; extend POST; bump `STORAGE_VERSION`.
- `game-data.js` — add `window.SCHEMA_VERSION`.
- `worker/index.js` — accept + sanitize `answers`; forward `answers`, `schemaVersion`, `source` from `mode`.
- `docs/architecture.md` — document the new POST field + scoring rule.
- No change: `result-state.js`, `result/index.html`, `index.html`.

---

### Task 1: Shared scoring helpers + schema stamp

**Files:** Modify `green-radius.jsx` (top-level helpers, near `SECTOR_IDS`/other consts); Modify `game-data.js`.

- [ ] **Step 1 — add helpers to `green-radius.jsx`** (top-level, before components that use them):

```js
// ── Scoring (per-point, cumulative bands) ────────────────────────────────
// Every Yes is worth 1 point. A sector has 10 questions (tiers 1/2/3/4).
// The Yes count maps to a contiguous radius depth (0–4) via these cumulative
// bands: depth = how many thresholds the count clears.
const SCORE_BANDS = [1, 3, 6, 10];

// All answerable ids for a sector: 6 fixed (T1–T3) + its Tier-4 topic ids.
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

// Contiguous green prefix to `depth`; remainder 'failed' if the sector was
// played, 'locked' if untouched — preserves the existing wheel visuals.
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

- [ ] **Step 2 — add schema stamp to `game-data.js`** (after `window.SECTORS = [...]`):

```js
// Content schema stamp — recorded with each response so historical rows stay
// alignable if questions/topics change. Bump when question content changes.
window.SCHEMA_VERSION = 'frog-v12';
```

- [ ] **Step 3 — parse gate:**
  - `bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null` → exit 0
  - `bun build game-data.js > /dev/null` → exit 0

- [ ] **Step 4 — band logic assertion** (`$CLAUDE_JOB_DIR/tmp/score-check.mjs`): define the band fn standalone and assert the table; run `bun $CLAUDE_JOB_DIR/tmp/score-check.mjs`.

```js
const BANDS = [1, 3, 6, 10];
const depth = n => BANDS.filter(b => n >= b).length;
const cases = [[0,0],[1,1],[2,1],[3,2],[5,2],[6,3],[9,3],[10,4]];
for (const [n, want] of cases) {
  if (depth(n) !== want) { console.error(`FAIL ${n} -> ${depth(n)} want ${want}`); process.exit(1); }
}
// Reported bug: Water, No×4, Yes×1, skip advanced = 1 yes -> T1
if (depth(1) !== 1) { console.error('FAIL reported-case'); process.exit(1); }
console.log('OK band logic');
```
Expected: `OK band logic`.

- [ ] **Step 5 — commit:** `feat: add per-point cumulative-band scoring helpers + schema stamp`

---

### Task 2: Unify the game (board) capture + scoring

**Files:** Modify `green-radius.jsx` — `QuestionModal` (`onComplete` call sites) and `handleAnswers`.

- [ ] **Step 1 — pass picked topics up.** In `QuestionModal.answer()`, the natural completion currently calls `onComplete(nextAnswers)`. Change to pass picks. Because `pickedTopicIds` state hasn't yet included the just-picked topic at that point, compute the final list inline:

```js
function answer(yes) {
  const nextAnswers = answersByLevel.map((a, li) => li === level ? [...a, yes] : a);
  setAnswersByLevel(nextAnswers);
  const nextPicks = isTier4 ? [...pickedTopicIds, topicId] : pickedTopicIds;
  if (isTier4) { setPickedTopicIds(nextPicks); setTopicId(''); }
  if (idx + 1 >= total) {
    if (level + 1 >= 4) {
      onComplete(nextAnswers, nextPicks);
    } else {
      setLevel(level + 1);
      setIdx(0);
    }
  } else {
    setIdx(idx + 1);
  }
}
```

- [ ] **Step 2 — skip-advanced button** passes current picks too: `onClick={() => onComplete(answersByLevel, pickedTopicIds)}`.

- [ ] **Step 3 — rewrite `handleAnswers`** to build the answers map and score via the shared helper:

```js
// The player answered all questions of a sector. Build the per-question
// answer map (fixed ids in tier order; Tier-4 keyed by picked topic id),
// merge into the shared `answers` state, and score via cumulative bands.
function handleAnswers(answersByLevel, pickedTopicIds = []) {
  const { sector } = activeQuestion;
  const sectorAns = {};
  // T1–T3: positional ids from sector.levels
  for (let li = 0; li < 3; li++) {
    (sector.levels[li] || []).forEach((q, i) => {
      const a = (answersByLevel[li] || [])[i];
      if (a === true || a === false) sectorAns[q.id] = a ? 'yes' : 'no';
    });
  }
  // T4: picked topic id -> its yes/no (positionally aligned with answersByLevel[3])
  (pickedTopicIds || []).forEach((tid, i) => {
    const a = (answersByLevel[3] || [])[i];
    if (tid && (a === true || a === false)) sectorAns[tid] = a ? 'yes' : 'no';
  });

  const merged = { ...answers, ...sectorAns };
  setAnswers(merged);

  const newLevelArr = sectorLevelStates(sector, merged);
  setLevelStates({ ...levelStates, [sector.id]: newLevelArr });
  setSectorCursor({ ...sectorCursor, [sector.id]: 4 });
  setSectorClosed({ ...sectorClosed, [sector.id]: true });
  setActiveQuestion(null);

  const greens = newLevelArr.filter(s => s === 'green').length;
  if (greens === 4) setCelebration({ sector });
  else setToast({ kind: 'sector-done', sector, greens });
}
```

- [ ] **Step 4 — parse gate** (as Task 1, Step 3). Commit: `feat: board mode captures every answer + scores per-point`.

---

### Task 3: Unify the form scoring

**Files:** Modify `green-radius.jsx` — `LinearForm.computeLevelStates` → use shared helper.

- [ ] **Step 1 — replace `computeLevelStates`** body with the shared helper (keep the function name/call site, or inline). `LinearForm` receives `sectors` and `answers` props already:

```js
function computeLevelStates() {
  return levelStatesFromAnswers(sectors, answers);
}
```

- [ ] **Step 2 — parse gate.** Commit: `feat: form mode scores per-point (parity with board)`.

---

### Task 4: Rename `formAnswers`→`answers`, add `mode`, bump version

**Files:** Modify `green-radius.jsx` — `GreenRadiusGame` state, `setFormAnswer`, `LinearForm` invocation, persistence, `startGame`/`startForm`, `STORAGE_VERSION`.

- [ ] **Step 1 — `STORAGE_VERSION = 4` → `5`** (line ~11).

- [ ] **Step 2 — state:** rename `const [formAnswers, setFormAnswers] = useState(saved?.formAnswers || {})` → `const [answers, setAnswers] = useState(saved?.answers || {})`. Add `const [mode, setMode] = useState(saved?.mode || null)`.

- [ ] **Step 3 — `setFormAnswer`** uses `setAnswers`: `setAnswers(prev => ({ ...prev, [qid]: value }))`.

- [ ] **Step 4 — `LinearForm` invocation:** `answers={answers}` (was `answers={formAnswers}`); `setAnswer={setFormAnswer}` unchanged.

- [ ] **Step 5 — `startGame`/`startForm`:** `setMode('board')` in `startGame`; `setMode('form')` in `startForm`.

- [ ] **Step 6 — persistence object** (the `localStorage.setItem` payload): replace `formAnswers` with `answers`, add `mode`. The clearSaved / reset paths (`setLevelStates(initState)` etc.) also reset `setAnswers({})` and `setMode(null)`.

- [ ] **Step 7 — parse gate.** Commit: `refactor: unify answer map + explicit mode; bump STORAGE_VERSION to 5`.

---

### Task 5: Send granular data; Worker sanitizes + forwards

**Files:** Modify `green-radius.jsx` (auto-send effect) and `worker/index.js`.

- [ ] **Step 1 — POST body** (auto-send effect, ~line 1825): add `answers`, `mode`, `schemaVersion`; drop the `source` heuristic:

```js
body: JSON.stringify({
  campName: camp.campName, leadName: camp.leadName, email,
  year, greens,
  mode: mode === 'form' ? 'form' : 'board',
  answers,
  schemaVersion: window.SCHEMA_VERSION || '',
  resultUrl,
}),
```

- [ ] **Step 2 — Worker `handleComplete`:** sanitize `answers` and extend `row`. After the `greens` build:

```js
// Granular per-question answers (backend-only). Keep it bounded.
const answers = {};
if (body.answers && typeof body.answers === 'object') {
  let n = 0;
  for (const k of Object.keys(body.answers)) {
    if (n >= 120) break;
    const v = body.answers[k];
    if (typeof k === 'string' && k.length <= 40 && (v === 'yes' || v === 'no')) {
      answers[k] = v; n++;
    }
  }
}
const source = body.mode === 'form' ? 'form' : 'board';
const schemaVersion = typeof body.schemaVersion === 'string' ? body.schemaVersion.slice(0, 32) : '';
```

  Extend `row`: replace `source: body.source === 'form' ? 'form' : 'board'` with `source,` and add `answers, schemaVersion,`. (The 4096-byte body cap stays — payload ≈ 1.2 KB.)

- [ ] **Step 3 — parse gate** for the Worker: `bun build worker/index.js > /dev/null` → exit 0; plus the jsx parse gate.

- [ ] **Step 4 — commit:** `feat: POST granular answers; Worker sanitizes + forwards to sheet`.

---

### Task 6: Document the wiring change

**Files:** Modify `docs/architecture.md`.

- [ ] **Step 1** — in the `/api/complete` contract section, document the new POST fields (`answers`, `mode`, `schemaVersion`), that they are backend-only (not in the hash), the Worker sanitization, and the sheet's new `answers_json` / `schema_version` columns (note the Apps Script is external). Note the unified cumulative-band scoring rule replaces the old per-mode logic.

- [ ] **Step 2 — commit:** `docs: architecture — granular answers in /api/complete + per-point scoring`.

---

### Task 7: Behavioral verification (Playwright, bun + chromium)

**Files:** `$CLAUDE_JOB_DIR/tmp/pw/run-scoring.js` (scratch, not committed). Serve via `python3 -m http.server PORT --directory <repo>` (run_in_background).

- [ ] **Scenario A — board, reported bug:** play Water; answer T1 No, T2 No/No, T3 No/No/Yes (i.e. first 4 No, 5th Yes), skip advanced → assert that sector's rendered depth = 1 (one green ring). (1 Yes → T1.)
- [ ] **Scenario B — board, compensation:** a sector with a T1 No but enough later Yes to reach 6 → assert depth 3 (T3), proving non-consecutive Yes compensates.
- [ ] **Scenario C — form parity:** the same answer set via the form yields the same depth as board.
- [ ] **Scenario D — POST body:** route/mock `/api/complete`; complete a run; assert the captured body has `answers` containing the expected `{qid:'yes'|'no'}` entries **including a picked Tier-4 topic id**, plus `mode` and `schemaVersion`.
- [ ] **Scenario E — result page unchanged:** load `/result/#<hash>` and confirm it still renders sector totals (ShareCard present, no per-question detail).
- [ ] Kill the server (`pkill -f "http.server PORT"`; exit 144 = expected SIGTERM).

---

### Task 8: Finish

- [ ] Final full parse gate (jsx + game-data + worker).
- [ ] `git push -u origin perpoint-scoring-granular-data`.
- [ ] `gh pr create` with a summary (scoring rule, granular capture, backend-only, **sheet/Apps Script action required**, admin-viewer follow-up noted) + test plan. Do **not** merge (merging = production deploy; user's call).

---

## Self-review notes

- **Spec coverage:** scoring rule (T1), board capture + scoring (T2), form scoring (T3), state/version (T4), POST+Worker (T5), docs (T6), tests (T7) — all spec sections covered. Sheet/Apps Script is external (instructions in the spec; PR notes it).
- **Type consistency:** `answers` is `{id: 'yes'|'no'}` everywhere (game build, form, POST, Worker filter). `mode` is `'board'|'form'`. `sectorLevelStates` returns the 4-element state array used by `setLevelStates` and the radial. Helper names match across tasks (`sectorAnswerIds`, `scoreSector`, `sectorLevelStates`, `levelStatesFromAnswers`).
- **No placeholders:** all steps include the actual code or exact command.
