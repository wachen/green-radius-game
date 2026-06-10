# Data-safety + robustness cluster — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. This app has **no test runner**; the gates are (a) `bun build green-radius.jsx …` parse, (b) `bun -e` unit tests for pure logic, (c) a Playwright smoke for the persistence/resume flows, (d) the Cloudflare branch preview for visual/behavioral eyeballing.

**Goal:** Close the silent-data-loss and correctness bugs from the 2026-06-09 review (U3, R1, U6, U8, R3, R5, R6), add the U5 edit/resend affordance, and land the low-risk a11y polish (A4, A7, A8) — without a `STORAGE_VERSION` bump where avoidable and without changing the green aesthetic.

**Architecture:** Most work is in the one big `green-radius.jsx`. The risky parts are the **save lifecycle** (when we persist vs clear) and the **resume path** (rebuilding an in-progress sector from the saved `answers` map). Those get extracted into pure helpers (`migrateSaved`, `resumePosition`, `freshProgress`) so they're unit-testable; the React wiring around them is verified with a Playwright smoke. Mechanical fixes (worker 502, timer cleanup, copy, aria) are direct edits.

**Tech stack:** No-build React 18 (UMD) + in-browser Babel; Cloudflare Worker; bun for the parse gate + unit tests; Playwright (to be installed) for the smoke.

---

## Design decisions (the crux — read before coding)

### Save lifecycle (U3 + R1)
Today the persistence effect (`green-radius.jsx:1856`) **clears the save** whenever `phase ∈ {pick-mode, intro, form-intro}`. That's why the form's `✕ Close` (→ `pick-mode`) silently wipes the autosave it just promised. New rule:

- **Persist only on progress phases** (`playing | form | done`); on `pick-mode | intro | form-intro` the effect does **nothing** (it neither writes nor clears). So Close keeps the save and a reload resumes it.
- **Clearing becomes explicit:** `handleExit` already calls `clearSaved()`; add `clearSaved()` to the **Reset Game** handler. (Clear Form just empties `answers`, which re-persists an empty form — fine.)
- **Mode-aware reset (R1):** `startGame`/`startForm` reset progress **only when switching modes** (`mode !== 'board'` / `mode !== 'form'`). Same-mode re-entry preserves answers (in-session resume); switching form→board no longer carries the form's answers into the board (which `sectorFill` would otherwise count). A shared `freshProgress()` helper does the reset.

### Salvage on version bump (U6)
`loadSaved` returns `null` on any `version` mismatch — silent total loss mid-season. Extract a pure `migrateSaved(data, sectors)`:
- version matches + schema-sane → return as-is (today's behavior).
- version mismatches but `data.camp` + `data.answers` look right + `data.phase !== 'done'` → **salvage**: keep `camp`, keep `answers` filtered to qids that still exist, recompute `sectorClosed`/`sectorCursor` from those answers, set `phase` to `form` (if `mode==='form'`) else `playing`, mark `salvaged: true`.
- anything else → `null`.
A dismissible one-line banner shows when `salvaged` so the shift isn't silent.

### In-modal persistence + resume (U8) — bounded
QuestionModal accumulates answers locally and only commits at sector end, and `activeQuestion` isn't saved — a refresh/back-swipe mid-sector loses up to 9 answers. Bounded fix:
- QuestionModal calls a new `onAnswer(qid, 'yes'|'no')` prop for each **Level 1–3** answer → writes straight into the shared `answers`. Persist `activeSectorId`.
- On load, if `activeSectorId` is set and that sector isn't closed, reopen it; a pure `resumePosition(sector, answers)` puts the modal at the **first unanswered L1–3 question** (seeding the local `answersByLevel` for the dots).
- **Tier 4 (optional, 4 picks) stays local** and restarts from the picker on resume — recovering the costly L1–3 work, accepting the small optional-tier loss. (No History/pushState in this PR; noted as a follow-up.)
- No `STORAGE_VERSION` bump: the saved shape only **gains** an optional `activeSectorId`; `loadSaved` tolerates its absence. (We are NOT changing `answers`/`sectorClosed` shapes.)

### U5 edit/resend
Lift `editingEmail`/`emailDraft` to component-top state (hooks can't live in the `phase==='done'` block). Done screen shows the email with an **Edit** toggle → input + **Resend**. `runSubmit` gains an optional `overrideEmail` so resend uses the corrected address immediately (before `setCamp` flushes).

---

## File structure

- `green-radius.jsx` — all UI/state work (helpers `freshProgress`, `migrateSaved`, `resumePosition`; lifecycle effect; QuestionModal `onAnswer`/resume; done-screen edit/resend; a11y; copy).
- `worker/index.js` — R3 (admin non-array payload → 502).
- `tests/data-safety.test.mjs` *(new, gitignored-by-convention? no — committed)* — bun unit tests for the pure helpers. Actually: keep the repo's no-test posture by running tests via `bun -e` inline during execution and NOT committing a runner; the plan lists the assertions to run.
- `e2e/resume.smoke.mjs` *(new)* — Playwright smoke for the resume flow. Committed under `e2e/` (excluded from served assets via `.assetsignore` — add `e2e/`).
- `docs/reviews/2026-06-09-security-usability-review.md` — flip the status tags for the items shipped here.
- `.assetsignore` — add `e2e/` and `tests/`.

---

## Tasks

### Task 1 — Worker R3: admin masks Apps Script failure as empty success
**Files:** Modify `worker/index.js` (`handleAdminResponses`, ~line 116).

- [ ] **Unit test (bun -e):** a non-array `data.rows` must NOT become `{rows:[]}`.
```js
// simulate the guard
const shape = (data) => Array.isArray(data.rows) ? {ok:true,n:data.rows.length} : {ok:false,status:502};
console.assert(shape({rows:[1,2]}).ok === true, 'array ok');
console.assert(shape({ok:false,error:'bad secret'}).status === 502, 'json error -> 502');
console.assert(shape({}).status === 502, 'html/empty -> 502');
```
- [ ] **Edit:** after `const data = await r.json().catch(() => ({}));` add
```js
if (!Array.isArray(data.rows)) return json({ error: 'sheet_bad_payload' }, 502);
```
(The admin UI already renders a retryable error state for non-OK responses.)
- [ ] **Verify:** `bun build worker/index.js --target node >/dev/null` parses.

### Task 2 — R5: spin timer leaks into the next game
**Files:** Modify `green-radius.jsx` — `onSpin` (~1886), add a `spinTimerRef`, clear it in Reset + `freshProgress`.

- [ ] Add `const spinTimerRef = useRef(null);` near the other refs (~1772).
- [ ] In `onSpin`, store the id: `spinTimerRef.current = setTimeout(() => {... setActiveQuestion …}, …)`.
- [ ] In the Reset handler (2198) and in `freshProgress` (Task 7), `clearTimeout(spinTimerRef.current); setSpinning(false);`.
- [ ] **Verify:** parse gate.

### Task 3 — R6: stale contiguous/"compensates" copy
**Files:** Modify `green-radius.jsx` lines ~746 (RadialBadge comment), ~1910–1913 (handleAnswers comment), and the FAQ "How do I play?" answer (~1010, `FAQ_ITEMS`).

- [ ] Rewrite the two comments to describe **per-question fill, gaps allowed, no compensation**.
- [ ] FAQ copy → e.g. *"Spin the wheel to draw a sector, then answer its yes/no questions across four levels. Every yes lights its own segment, so an early no never blocks later progress. Six spins (one per sector) complete your Green Radius."* (no em dashes — house style).
- [ ] **Verify:** parse gate; `grep -n "compensate\|contiguous" green-radius.jsx` → none in live copy/comments.

### Task 4 — A8: form field semantics
**Files:** Modify `green-radius.jsx` — Tier-4 `<select>` (~518) and the Intro `Field` (~1713–1740).

- [ ] Add `aria-label="Pick an advanced topic"` to the Tier-4 `<select>`.
- [ ] On the Intro input add `required` and `aria-invalid={invalid}`; keep the visible `*` but add `aria-hidden` to the asterisk span (aria-required covers it).
- [ ] **Verify:** parse gate.

### Task 5 — A4: touch targets + SR readouts
**Files:** Modify `green-radius.jsx` — YesNoRow buttons (~1556), FAQ close (~1116), PDF links (~1240–1258), ResultToast container (~635), Wheel `<svg>` (~251) and RadialBadge `<svg>` (~765).

- [ ] YesNoRow button base: add `minHeight: 44`. FAQ close: `width:40,height:40`. PDF links: add `padding:'10px 4px'` to reach ~44px.
- [ ] ResultToast outer div: add `role="status"` (keep `aria-live` implicit) — but it has `pointerEvents:'none'`; that's fine for SR.
- [ ] Wheel `<svg>`: `role="img"` + dynamic `aria-label` summarizing per-sector totals (e.g. ```Green radius wheel: ${sectors.map(s=>`${s.name} ${fills[s.id].totalYes} of 10`).join(', ')}` ``). RadialBadge `<svg>` in the ShareCard usage can stay `aria-hidden` (the text grid duplicates it); give the standalone badge `role="img"` + a short label.
- [ ] **Verify:** parse gate.

### Task 6 — A7: FAQ modal focus trap + scroll lock
**Files:** Modify `green-radius.jsx` — `FaqModal` (~1072) and `QuestionModal` (~430, share the hook).

- [ ] Add a `useFocusTrap(ref)` helper near the top (Tab/Shift-Tab wrap within the dialog) and `useEffect(() => { const p = document.body.style.overflow; document.body.style.overflow='hidden'; return () => { document.body.style.overflow=p; }; }, [])` for scroll-lock; call both in FaqModal and QuestionModal.
- [ ] **Verify:** parse gate.

### Task 7 — U3 + R1: save lifecycle + mode-aware reset
**Files:** Modify `green-radius.jsx` — persistence effect (1856), Reset handler (2198), `startGame`/`startForm` (1939/1954); add `freshProgress` helper.

- [ ] **Unit test (bun -e)** the mode-reset decision:
```js
const shouldReset = (prevMode, next) => prevMode !== next;
console.assert(shouldReset(null,'board'), 'fresh resets (no-op on empty)');
console.assert(shouldReset('form','board'), 'switch resets');
console.assert(!shouldReset('board','board'), 'same mode keeps');
```
- [ ] Add helper inside the component:
```js
function freshProgress() {
  clearTimeout(spinTimerRef.current); setSpinning(false); setActiveQuestion(null);
  setAnswers({});
  setSectorCursor(() => { const o={}; sectors.forEach(s=>o[s.id]=0); return o; });
  setSectorClosed(() => { const o={}; sectors.forEach(s=>o[s.id]=false); return o; });
  setSubmittedAt(null); setSubmitState('idle'); setSubmitResult(null);
  autoSentRef.current = false; submitGenRef.current++;
}
```
- [ ] Persistence effect → persist only on progress phases, never auto-clear:
```js
useEffect(() => {
  if (phase !== 'playing' && phase !== 'form' && phase !== 'done') return; // navigating screens: keep the save
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      phase, camp, sectorCursor, sectorClosed, answers, mode, submittedAt,
      activeSectorId: activeQuestion?.sector?.id || null,   // Task 9
    }));
  } catch {}
}, [phase, camp, sectorCursor, sectorClosed, answers, mode, submittedAt, activeQuestion]);
```
- [ ] `startGame`: `if (mode !== 'board') freshProgress();` then set camp/mode/phase. `startForm`: `if (mode !== 'form') freshProgress();`.
- [ ] Reset handler: add `clearSaved();` and `clearTimeout(spinTimerRef.current);`.
- [ ] **Smoke (Playwright, Task 0):** fill 2 form answers → `✕ Close` → reload → answers still present (save not wiped). Then pick Board → answers reset (no contamination).

### Task 8 — U6: salvage on version mismatch
**Files:** Modify `green-radius.jsx` — extract `migrateSaved`; add a `salvaged` banner.

- [ ] **Unit test (bun -e)** `migrateSaved` with an old-version fixture (mocked sectors) → returns camp+filtered answers, `salvaged:true`, recomputed closed/cursor, phase `playing`; a `done` save → `null`; garbage → `null`.
- [ ] Implement `migrateSaved(data, sectors)` (pure) and call it from `loadSaved` (which keeps the try/catch + localStorage read). Filter answers to `validQids = new Set(all L1-3 ids + tier4 ids)`; `sectorClosed[s.id] = s.levels.slice(0,3).flat().every(q => data.answers[q.id] != null)`.
- [ ] Surface: `const [restored, setRestored] = useState(saved?.salvaged || false);` and render a dismissible banner on the playing/form screen.
- [ ] **Verify:** unit test passes; parse gate.

### Task 9 — U8: in-modal persistence + resume (bounded to L1–3)
**Files:** Modify `green-radius.jsx` — `QuestionModal` (384), `handleAnswers`/mount wiring; add `resumePosition`; persist `activeSectorId` (done in Task 7); init `activeQuestion` from saved on mount.

- [ ] **Unit test (bun -e)** `resumePosition(sector, answers)`: with L1 answered → starts at L2/idx0; all L1–3 answered → level 3 (Tier 4); none → level0/idx0. Assert seeded `answersByLevel` lengths match.
- [ ] Add `onAnswer` prop; QuestionModal calls `onAnswer(q.id, yes?'yes':'no')` inside `answer()` for L1–3 (not Tier 4). Wire `onAnswer={(qid,v)=>setAnswers(a=>({...a,[qid]:v}))}` at the modal usage (2220).
- [ ] QuestionModal initial state seeded via `resumePosition(sector, existingAnswers)` (new prop `existingAnswers={answers}`).
- [ ] On mount: `const [activeQuestion,setActiveQuestion]=useState(saved?.activeSectorId ? { sector: sectors.find(s=>s.id===saved.activeSectorId) } : null)` (guard the sector exists and isn't closed).
- [ ] **Smoke (Playwright):** board → spin → answer first 3 L1–3 → reload → modal reopens at Q4 of that sector with the first 3 still recorded (header count unchanged).

### Task 10 — U5: done-screen edit + resend
**Files:** Modify `green-radius.jsx` — component-top state, `runSubmit` override, done-screen UI (~2046).

- [ ] Lift `const [editingEmail,setEditingEmail]=useState(false); const [emailDraft,setEmailDraft]=useState('');` to the top with the other state.
- [ ] `runSubmit(overrideEmail)` → `const email=(overrideEmail ?? camp.email ?? '').trim();`.
- [ ] Done screen: render the email with an **Edit** button; when editing, an `<input type=email>` + **Resend** that validates, `setCamp(c=>({...c,email:emailDraft.trim()}))`, `setSubmitResult(null)`, `runSubmit(emailDraft.trim())`, `setEditingEmail(false)`.
- [ ] **Verify:** parse gate; preview the done screen.

### Task 0 — Verification harness (do first)
- [ ] `bun add -d playwright` then `bunx playwright install chromium` (local only; add `e2e/` + `tests/` to `.assetsignore`, and `node_modules/`/`playwright` are already gitignored).
- [ ] `e2e/resume.smoke.mjs`: launch chromium, `python3 -m http.server` on the repo, drive the flows in Tasks 7 & 9, assert via DOM. Run: `node e2e/resume.smoke.mjs` (or `bun`).
- [ ] If Playwright install fails in this environment, fall back to documenting the manual steps and verifying on the Cloudflare branch preview.

---

## Self-review

- **Spec coverage:** U3✓(T7) R1✓(T7) U6✓(T8) U8✓(T9) R3✓(T1) R5✓(T2) R6✓(T3) A4✓(T5) A7✓(T6) A8✓(T4) U5✓(T10). Deferred & noted: U4 (board undo), U7 (offline shell), R2 (legacy admin agg), U9/OG, features.
- **No STORAGE_VERSION bump:** only an additive optional `activeSectorId`; `loadSaved`/`migrateSaved` tolerate its absence. Confirmed in T7/T9.
- **Naming consistency:** `freshProgress`, `migrateSaved`, `resumePosition`, `spinTimerRef`, `onAnswer`, `activeSectorId`, `salvaged/restored` used identically across tasks.
- **Risk register:** T8 + T9 are the risky ones (persistence/resume) → covered by unit tests + Playwright smoke; everything else is parse-gate + preview. The green aesthetic is untouched (no palette/label color edits).
</content>
