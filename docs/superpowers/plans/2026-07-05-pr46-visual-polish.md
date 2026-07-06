# PR #46 Visual Polish + Fun Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure-presentation "game juice" — a leaf/dust burst on every answer, a shine sweep on newly filled wheel wedges, and a staged game-show reveal on the finished screen — with zero changes to scoring, data, the Worker, or the `/result/` share page, and with reduced-motion users keeping today's quiet behavior.

**Architecture:** One hand-rolled canvas particle layer. A module-scope `Fx` emitter (bare name in the shared Babel scope) pushes particles into a singleton pool; a thin React `FxLayer` component owns the single fixed full-viewport `<canvas>`, the `requestAnimationFrame` loop, and all guardrails. Three call sites fire effects fire-and-forget: `QuestionModal.answer()`, the `Wheel` post-commit diff, and the finished-screen reveal. CSS keyframes (added to `index.html`, each with a reduced-motion neutralizer beside the existing `qm-*` ones) drive the DOM-side springs, wedge pop, shine fade, tick pulse, and rank slam.

**Tech Stack:** No-build static React 18 UMD + in-browser JSX via `@babel/standalone` (all vendored, same-origin). No package.json, no bundler, no test runner. Verification = the JSX parse gate + a bun + Playwright browser rig.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec and `CLAUDE.md`.

- **No-build / vendored runtime.** Never edit `vendor/`. No new dependencies, no `<script src>` to a CDN. Everything ships as plain source files.
- **Babel shared scope, bare names.** Every `<script type="text/babel">` on the page shares one scope. `FxLayer` and `Fx` are referenced by **bare name**, never `window.*`. Only plain scripts create `window.*` globals. Hooks are already destructured at the top of `green-radius.jsx`: `const { useState, useEffect, useRef, useMemo, useCallback } = React;`.
- **Silent.** No audio of any kind in this PR. No haptics.
- **Reduced motion is a single gate.** If `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, every `Fx.*` call is a no-op, and each new keyframe is neutralized in `index.html`'s existing `@media (prefers-reduced-motion: reduce)` block. Reduced-motion users get exactly today's behavior.
- **Non-blocking contract.** State advances exactly as today, synchronously. Effects are fire-and-forget. No new timing dependency, no answer-rate throttle (the 300-particle cap absorbs mashing).
- **Invariants that must NOT change:** scoring, the `greens` shape `{ food, water, waste, transport, shelter, power }` (each 0–10), per-question `fills`, result payloads, `SCHEMA_VERSION` (`frog-v12.1`), `STORAGE_VERSION` (currently `6`), the Worker, the sheet, the email, the standalone `/result/` page and its Worker OG rewrite, the home screen, the FAQ, form-mode visuals (form mode gets **no** particles), and the existing `Celebration` splat overlay. Do not touch `game-data.js`, `result-state.js`, `rank.js`, `worker/`, or any file under `result/`, `admin/`, or `vendor/`.
- **Copy style:** no em dashes in user-facing strings (there are no new user-facing strings in this PR, but keep the rule if any label is touched).
- **APP_VERSION.** Bump the deploy stamp in `green-radius.jsx` from `'v44'` to `'v46'` (PR number). It is set manually — there is no build step.
- **The only automated check (parse gate), run from repo root, exit 0 = pass:**
  ```bash
  bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
  ```
- **Browser rig:** `bun` + Playwright is preinstalled at `/Users/wes/.claude/jobs/1920a528/tmp/pw/`. Run scripts with `bun <name>.mjs` from that dir. The house pattern (see `board-test.mjs`) launches headless Chromium against `http://localhost:8000/`, so a static server must be running: from the repo root, `python3 -m http.server 8000`. Button accessible-name matchers return 0 for these buttons — click through in-page DOM by `innerText` (the `clickByText` helper in `board-test.mjs`).
- **Git:** branch `pr46-visual-polish` is already checked out. Commit as each task lands. **Never** touch `main`, never push.

---

## File Structure

Only two files change. No new files in the repo (the verification `.mjs` scripts live in the git-ignored rig dir, not the repo).

- **`green-radius.jsx`** (~2860 lines, the whole game UI). Gains:
  - a new self-contained FX block (module-scope `Fx` emitter + `FxLayer` component, ~150 lines) inserted just after `LEVEL_COLORS` (line 140);
  - three trigger sites: `QuestionModal.answer()` (~616), the `Wheel` component (~375–533), the finished-screen `done` render (~2540–2704) plus one new top-level hook call and one arming line in `GreenRadiusGame`;
  - a `revealCount` prop threaded through `RadialBadge` (~1062) and `ShareCard` (~1166);
  - `APP_VERSION` (~52) → `'v46'`.
- **`index.html`.** Gains: the `<FxLayer/>` mount inside `App` (it is fixed-position, so tree placement is cosmetic), and new keyframes with reduced-motion neutralizers in the existing `<style>` block, following the `qm-*` pattern.

Everything else — `RadialBadge` in aggregate/admin mode, `ResultCardSVG` (the download/share twin), `result/`, the Worker — is untouched by construction: new behavior is gated behind opt-in props that default to today's rendering.

---

### Task 1: FxLayer + Fx emitter (the engine)

**Files:**
- Modify: `green-radius.jsx` — insert the FX block after `LEVEL_COLORS` (line 140).
- Modify: `index.html` — mount `<FxLayer/>` in `App` (lines 163–171).
- Test: `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-engine-test.mjs` (new, in the rig dir).

**Interfaces:**
- Produces (used by Tasks 2–4, all bare names in the shared scope):
  - `Fx.burst(x, y, spec)` — viewport coords. `spec = { kind:'leaf'|'spark'|'dust'|'ring', n, angle?, spread?, speed?, up?, g?, drag?, life?, size?, color?, colors?, r?, vrad? }`.
  - `Fx.leafBurst(el)` — measures `el` rect center, fires a leaf + spark burst.
  - `Fx.dustPuff(el)` — measures `el` rect center, fires a soft dust puff.
  - `Fx.sparkle(x, y)` — two small spark glints near a point.
  - `Fx.ringShock(x, y)` — a dust ring + dust puff (available; not required by a later task).
  - `Fx.clear()` — empties the pool and clears the canvas.
  - `FxLayer` — React component; renders the single `<canvas data-fx="1">`, owns the loop and guardrails. Mounted once in `App`.
- Every `Fx.*` particle-producing call is a no-op when `prefers-reduced-motion: reduce` or when no canvas is registered.

- [ ] **Step 1: Insert the FX block in `green-radius.jsx` right after the `LEVEL_COLORS` line (line 140).**

Add this complete block. It is self-contained; nothing above it depends on it.

```jsx
// ─── particle FX (hand-rolled canvas layer, PR #46) ─────────────────────────
// One fixed full-viewport <canvas> (FxLayer) + a module-scope emitter (Fx).
// Bare names in the shared Babel scope — NOT window.* (repo convention).
// Guardrails all live here: reduced-motion no-op, loop stops when the pool
// empties, ~300 live-particle cap (drop oldest), DPR capped at 2, canvas
// re-fits on resize/orientation, pool cleared + loop halted when the tab hides.
const FX_TAU = Math.PI * 2;
const FX_LEAF_COLORS = ['#68B05C', '#7AB85C', '#A3D178', '#439F5B'];
const FX_SPARK = '#D9F2A8';
const FX_DUST = '#d8cbb6';
const FX_CAP = 300;

const _fx = { canvas: null, ctx: null, ps: [], running: false, w: 0, h: 0, dpr: 1 };

function _fxReduce() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function _fxDraw(ctx, p, a) {
  ctx.globalAlpha = a;
  if (p.kind === 'leaf') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, FX_TAU); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'spark') {
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke();
  } else if (p.kind === 'ring') {
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, p.size * (1 - p.age / p.life));
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, FX_TAU); ctx.stroke();
  } else { // dust / dot
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, FX_TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function _fxTick() {
  const st = _fx;
  if (!st.ctx) { st.running = false; return; }
  st.ctx.clearRect(0, 0, st.w, st.h);
  if (!st.ps.length) { st.running = false; return; } // pool empty → stop the loop
  const alive = [];
  for (let i = 0; i < st.ps.length; i++) {
    const p = st.ps[i];
    p.age++;
    if (p.age >= p.life) continue;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.r += p.vrad;
    const a = p.kind === 'dust' ? 0.4 * (1 - p.age / p.life) : 1 - p.age / p.life;
    _fxDraw(st.ctx, p, a);
    alive.push(p);
  }
  st.ps = alive;
  requestAnimationFrame(_fxTick);
}

function _fxStart() {
  if (!_fx.running && _fx.ps.length && _fx.ctx) {
    _fx.running = true;
    requestAnimationFrame(_fxTick);
  }
}

const Fx = {
  burst(x, y, spec) {
    if (_fxReduce() || !_fx.ctx) return; // single reduced-motion gate for all juice
    const n = spec.n || 12;
    for (let i = 0; i < n; i++) {
      const ang = (spec.angle == null ? Math.random() * FX_TAU
        : spec.angle + (Math.random() - 0.5) * (spec.spread || 1.2));
      const sp = (spec.speed || 3) * (0.4 + Math.random() * 0.9);
      _fx.ps.push({
        kind: spec.kind, x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (spec.up || 0),
        g: spec.g == null ? 0.12 : spec.g, drag: spec.drag == null ? 0.99 : spec.drag,
        age: 0, life: (spec.life || 40) * (0.7 + Math.random() * 0.6),
        size: (spec.size || 5) * (0.6 + Math.random() * 0.8),
        rot: Math.random() * FX_TAU, vr: (Math.random() - 0.5) * 0.3,
        color: spec.colors ? spec.colors[i % spec.colors.length] : (spec.color || '#fff'),
        r: spec.r || 0, vrad: spec.vrad || 0,
      });
    }
    if (_fx.ps.length > FX_CAP) _fx.ps.splice(0, _fx.ps.length - FX_CAP); // drop oldest
    _fxStart();
  },
  _center(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  leafBurst(el) {
    const c = this._center(el); if (!c) return;
    this.burst(c.x, c.y, { kind: 'leaf', n: 14, speed: 4.2, up: 2.2, g: 0.14, life: 46, size: 5, colors: FX_LEAF_COLORS });
    this.burst(c.x, c.y, { kind: 'spark', n: 8, speed: 5.5, up: 1.5, g: 0.05, life: 22, color: FX_SPARK });
  },
  dustPuff(el) {
    const c = this._center(el); if (!c) return;
    this.burst(c.x, c.y, { kind: 'dust', n: 10, speed: 1.6, up: 0.6, g: -0.01, drag: 0.96, life: 38, size: 7, color: FX_DUST });
  },
  sparkle(x, y) {
    this.burst(x - 6, y - 4, { kind: 'spark', n: 3, speed: 1.4, life: 20, color: '#ffffff' });
    this.burst(x + 8, y + 3, { kind: 'spark', n: 3, speed: 1.4, life: 20, color: '#F2EBAA' });
  },
  ringShock(x, y) {
    this.burst(x, y, { kind: 'ring', n: 1, life: 30, size: 5, r: 10, vrad: 4.5, color: FX_DUST });
    this.burst(x, y, { kind: 'dust', n: 12, speed: 2.6, g: 0.02, life: 36, size: 6, color: FX_DUST });
  },
  clear() {
    _fx.ps.length = 0;
    if (_fx.ctx) _fx.ctx.clearRect(0, 0, _fx.w, _fx.h);
  },
};

function FxLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _fx.canvas = canvas;
    _fx.ctx = ctx;
    function fit() {
      const dpr = Math.min(2, window.devicePixelRatio || 1); // DPR cap 2
      _fx.dpr = dpr;
      _fx.w = window.innerWidth;
      _fx.h = window.innerHeight;
      canvas.width = _fx.w * dpr;
      canvas.height = _fx.h * dpr;
      canvas.style.width = _fx.w + 'px';
      canvas.style.height = _fx.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fit();
    function onVis() { if (document.hidden) Fx.clear(); } // hidden → clear pool, loop self-stops
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      document.removeEventListener('visibilitychange', onVis);
      Fx.clear();
      _fx.canvas = null; _fx.ctx = null;
    };
  }, []);
  return (
    <canvas
      ref={ref}
      data-fx="1"
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }}
    />
  );
}
```

- [ ] **Step 2: Mount `<FxLayer/>` once in `App` in `index.html`.**

The `Celebration` overlay is `zIndex: 20` and the question modal is `zIndex: 10`; `FxLayer`'s `zIndex: 60` sits above both so bursts render over them. It is `position: fixed`, so its place in the tree is cosmetic. Mount it in `App` (its immediate parent renders exactly once for every phase, so the canvas and rAF loop persist across phase changes — see the note below the checklist).

Replace lines 163–171:

```jsx
function App() {
  return (
    <div className="grg-shell">
      <div className="grg-frame">
        <GreenRadiusGame variant="flat-playa" palette={PALETTE}/>
      </div>
    </div>
  );
}
```

with:

```jsx
function App() {
  return (
    <div className="grg-shell">
      <div className="grg-frame">
        <GreenRadiusGame variant="flat-playa" palette={PALETTE}/>
      </div>
      <FxLayer/>
    </div>
  );
}
```

- [ ] **Step 3: Run the parse gate.**

Run (from repo root):
```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
```
Expected: exit 0, no output.

- [ ] **Step 4: Write the engine smoke test.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-engine-test.mjs`. It asserts the canvas mounts, the page has zero errors, and (because bursts are internal to the Babel scope, unreachable from `page.evaluate`) drives one real burst through the DOM by dispatching a synthetic burst via a temporary listener is NOT possible — instead it asserts the canvas exists and stays blank at rest (the loop is idle until a real trigger fires in Task 2).

```js
import { chromium } from 'playwright';
const SHOTS = '/Users/wes/.claude/jobs/1920a528/tmp/shots';
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ok -', name); else { failures++; console.log('  FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } };

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 667 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('button', { timeout: 15000 });

check('fx canvas mounted', await page.locator('canvas[data-fx]').count() === 1);
check('fx canvas is fixed + pointer-events none', await page.evaluate(() => {
  const c = document.querySelector('canvas[data-fx]');
  const s = getComputedStyle(c);
  return s.position === 'fixed' && s.pointerEvents === 'none';
}));
check('fx canvas blank at rest', await page.evaluate(() => {
  const c = document.querySelector('canvas[data-fx]');
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
  return true;
}));
check('no page errors', errs.length === 0, errs);

await browser.close();
console.log(failures ? `\nFX ENGINE: ${failures} FAILED` : '\nFX ENGINE: all passed');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 5: Run the engine smoke test.**

Start a static server in the repo root, then run the test:
```bash
# terminal A (repo root)
python3 -m http.server 8000
# terminal B (rig dir)
cd /Users/wes/.claude/jobs/1920a528/tmp/pw && bun fx-engine-test.mjs
```
Expected: `FX ENGINE: all passed`, exit 0.

- [ ] **Step 6: Commit.**

```bash
git add green-radius.jsx index.html
git commit -m "PR46: add FxLayer canvas + Fx particle emitter (engine, no triggers yet)"
```

> **Note for the implementer (mount site):** the spec says "mounted once at the root of `GreenRadiusGame`." `GreenRadiusGame` has six phase-based early `return`s (`pick-mode`, `form-intro`, `form`, `intro`, `done`, playing), so mounting inside it would remount `FxLayer` — and destroy the canvas + rAF loop — on every phase change, or require editing all six returns. Mounting in `App` (its immediate parent, same shared Babel scope) renders `FxLayer` exactly once for the app's lifetime and keeps it above every phase and overlay. This is the correct reading of "mounted once."

---

### Task 2: Answer feedback in QuestionModal

**Files:**
- Modify: `green-radius.jsx` — `QuestionModal` (~573–643): add button refs, fire effects + spring in `answer()`.
- Modify: `index.html` — add `grg-spring` + `grg-spring-soft` keyframes and their reduced-motion neutralizers.
- Test: `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-answer-test.mjs` (new).

**Interfaces:**
- Consumes: `Fx.leafBurst(el)`, `Fx.dustPuff(el)` from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the two keyframes to `index.html`.**

After the `@keyframes grg-celeb { ... }` block (ends line 63), add:

```css
  @keyframes grg-spring      { 0% { transform: scale(1); } 35% { transform: scale(0.88); } 70% { transform: scale(1.08); } 100% { transform: scale(1); } }
  @keyframes grg-spring-soft { 0% { transform: scale(1); } 45% { transform: scale(0.95); } 100% { transform: scale(1); } }
```

Inside the existing `@media (prefers-reduced-motion: reduce) { ... }` block (currently lines 64–69), add neutralizers beside the `qm-*` ones:

```css
    @keyframes grg-spring      { from { transform: none; } to { transform: none; } }
    @keyframes grg-spring-soft { from { transform: none; } to { transform: none; } }
```

- [ ] **Step 2: Add refs to the Yes/No buttons in `QuestionModal`.**

In `QuestionModal`, add the refs near the other refs (after `const cardRef = useRef(null);` at line 589):

```jsx
  const yesBtnRef = useRef(null);
  const noBtnRef = useRef(null);
```

Attach `ref={noBtnRef}` to the No button (opening tag at line 864) and `ref={yesBtnRef}` to the Yes button (opening tag at line 877). The No button becomes:

```jsx
              <button
                ref={noBtnRef}
                onClick={() => answer(false)}
                disabled={!canAnswer}
```

and the Yes button becomes:

```jsx
              <button
                ref={yesBtnRef}
                onClick={() => answer(true)}
                disabled={!canAnswer}
```

- [ ] **Step 3: Fire the spring + particles at the top of `answer()`.**

`answer()` currently begins at line 616 with the comment and `if (!isTier4 && q && onAnswer) ...`. Insert the effect block as the very first statements of the function body, before that line. It is fire-and-forget; the existing state-advance logic below is unchanged.

Setting `el.style.animation` imperatively is safe: the buttons' `style` object never contains an `animation` key, so React will not clear it on re-render. The `animation:'none' + reflow + set` dance restarts the keyframe if the same button is tapped again.

```jsx
  function answer(yes) {
    // PR46 juice: spring the tapped button + fire particles from its rect.
    // Fire-and-forget — Fx draws to the body-level canvas, so it survives this
    // modal unmounting when the last answer calls onComplete. Reduced motion:
    // Fx.* is a no-op and the keyframes are neutralized, so this is silent.
    const btn = (yes ? yesBtnRef : noBtnRef).current;
    if (btn) {
      btn.style.animation = 'none';
      void btn.offsetWidth; // reflow so a repeat tap replays the keyframe
      btn.style.animation = (yes ? 'grg-spring' : 'grg-spring-soft') + ' 0.42s cubic-bezier(.34,1.56,.64,1)';
      if (yes) Fx.leafBurst(btn); else Fx.dustPuff(btn);
    }
    // ── existing logic below is UNCHANGED ──
    if (!isTier4 && q && onAnswer) onAnswer(q.id, yes ? 'yes' : 'no');
    const nextAnswers = answersByLevel.map((a, li) => li === level ? [...a, yes] : a);
    setAnswersByLevel(nextAnswers);
    const nextPicks = isTier4 ? [...pickedTopicIds, topicId] : pickedTopicIds;
    const nextNotes = (isTier4 && isCampTopic(q) && customText.trim())
      ? { ...notes, [q.id]: customText.trim() }
      : notes;
    if (isTier4) {
      setPickedTopicIds(nextPicks);
      setNotes(nextNotes);
      setTopicId('');
      setCustomText('');
    }
    if (idx + 1 >= total) {
      if (level + 1 >= 4) {
        onComplete(nextAnswers, nextPicks, nextNotes);
      } else {
        setLevel(level + 1);
        setIdx(0);
      }
    } else {
      setIdx(idx + 1);
    }
  }
```

- [ ] **Step 4: Run the parse gate.**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
```
Expected: exit 0.

- [ ] **Step 5: Write the answer-feedback test.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-answer-test.mjs`. It opens the board, starts a game, spins once, opens the question modal, taps Yes, and asserts the fx canvas paints ink within a short window (particles alive). It reuses the `clickByText` helper pattern from `board-test.mjs`. The `/api/complete` route is mocked so no real POST happens.

```js
import { chromium } from 'playwright';
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ok -', name); else { failures++; console.log('  FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const canvasInk = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-fx]'); if (!c) return false;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
  return false;
});
const clickByText = (page, txt, exact = false) => page.evaluate(([t, ex]) => {
  const b = [...document.querySelectorAll('button')].find(x => { const s = (x.innerText || '').trim(); return ex ? s === t : s.includes(t); });
  if (!b) return false; b.click(); return true;
}, [txt, exact]);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 667 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.route('**/api/complete', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sheet":"ok","email":"sent"}' }));

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('Play the Game')), null, { timeout: 15000 });
await clickByText(page, 'Play the Game');
await page.waitForSelector('input[placeholder="Your Theme Camp"]');
await page.fill('input[placeholder="Your Theme Camp"]', 'Dusty Sprouts');
await page.fill('input[placeholder="Your (Playa) Name"]', 'Fern');
await page.fill('input[type="email"]', 'fern@example.org');
await clickByText(page, 'START');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'SPIN'));
await clickByText(page, 'SPIN', true);
// modal opens after the spin settles (~2.3s); wait for a Yes button
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'), null, { timeout: 8000 });

check('canvas blank before answering', !(await canvasInk(page)));
await clickByText(page, 'YES', true);
// particles are short-lived; poll for ink for up to 1s
let inked = false;
for (let i = 0; i < 20 && !inked; i++) { inked = await canvasInk(page); if (!inked) await page.waitForTimeout(50); }
check('canvas painted particles after Yes', inked);
check('no page errors', errs.length === 0, errs);

await browser.close();
console.log(failures ? `\nFX ANSWER: ${failures} FAILED` : '\nFX ANSWER: all passed');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 6: Run the answer-feedback test (server running from Task 1 Step 5).**

```bash
cd /Users/wes/.claude/jobs/1920a528/tmp/pw && bun fx-answer-test.mjs
```
Expected: `FX ANSWER: all passed`, exit 0.

- [ ] **Step 7: Commit.**

```bash
git add green-radius.jsx index.html
git commit -m "PR46: leaf/dust burst + spring on every Yes/Not-yet answer"
```

---

### Task 3: Wedge shine sweep on returning from a sector

**Files:**
- Modify: `green-radius.jsx` — `Wheel` (~375–533): add an svg ref, a `data-cell` attribute on filled cells, and a post-commit diff effect.
- Modify: `index.html` — add `grg-shine` keyframe + reduced-motion neutralizer.
- Test: `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-shine-test.mjs` (new).

**Interfaces:**
- Consumes: `Fx.sparkle(x, y)` from Task 1.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add the `grg-shine` keyframe to `index.html`.**

After the `grg-spring-soft` keyframe added in Task 2, add:

```css
  @keyframes grg-shine { 0% { opacity: 0; } 22% { opacity: 0.8; } 100% { opacity: 0; } }
```

Inside the reduced-motion `@media` block, add:

```css
    @keyframes grg-shine { from { opacity: 0; } to { opacity: 0; } }
```

- [ ] **Step 2: Add an svg ref and a previous-fills ref to `Wheel`.**

`Wheel` already computes `reduceMotion` at line 386. Add these refs just after that (before the `return`):

```jsx
  const svgRef = useRef(null);
  const prevFilledRef = useRef(null); // Set of filled cell keys from the last commit; null = first commit
```

- [ ] **Step 3: Attach the ref to the wheel `<svg>` and tag filled cells.**

On the `<svg>` opening tag (line 408) add `ref={svgRef}`:

```jsx
      <svg
        ref={svgRef}
        width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}
```

On the filled cell `<path>` (the first path inside the `<g>`, line 441), add a `data-cell` attribute so the diff effect can find newly filled cells. Replace:

```jsx
                  <path
                    d={arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1)}
                    fill={filled ? LEVEL_COLORS[li] : ringTint[li]}
                    stroke={palette.bg}
                    strokeWidth={dim ? 2 : 1.5}
                  />
```

with:

```jsx
                  <path
                    data-cell={filled ? `${sector.id}-${li}-${qi}` : undefined}
                    d={arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1)}
                    fill={filled ? LEVEL_COLORS[li] : ringTint[li]}
                    stroke={palette.bg}
                    strokeWidth={dim ? 2 : 1.5}
                  />
```

- [ ] **Step 4: Add the post-commit diff effect to `Wheel`.**

Add this `useEffect` right after the two refs from Step 2 (still before the `return`). On first commit it records the filled set and shines nothing (so a reload with a part-filled wheel is quiet). On later commits it clones each newly filled cell path to a white, fading overlay and fires sparkles at its screen position, staggered 120ms so a full sector cascades.

```jsx
  useEffect(() => {
    if (reduceMotion) return; // clone is CSS-animated (neutralized) + sparkles are gated; skip the work entirely
    const svg = svgRef.current;
    if (!svg) return;
    const cur = new Set();
    sectors.forEach(sector => {
      const lv = (fills[sector.id] && fills[sector.id].levels) || [[], [], [], []];
      [0, 1, 2, 3].forEach(li => (lv[li] || []).forEach((v, qi) => { if (v) cur.add(`${sector.id}-${li}-${qi}`); }));
    });
    const prev = prevFilledRef.current;
    prevFilledRef.current = cur;
    if (prev == null) return; // first commit: establish baseline, no shine
    const added = [];
    cur.forEach(k => { if (!prev.has(k)) added.push(k); });
    if (!added.length) return;
    const timers = [];
    added.forEach((key, i) => {
      timers.push(setTimeout(() => {
        const path = svg.querySelector(`path[data-cell="${key}"]`);
        if (!path) return;
        const clone = path.cloneNode(true);
        clone.setAttribute('fill', '#ffffff');
        clone.removeAttribute('data-cell');
        clone.setAttribute('class', 'grg-shine'); // opacity 0→0.8→0 over 0.95s
        clone.style.pointerEvents = 'none';
        path.parentNode.appendChild(clone); // append last in the <g> → drawn on top
        const rm = setTimeout(() => clone.remove(), 1000);
        timers.push(rm);
        const r = path.getBoundingClientRect();
        Fx.sparkle(r.left + r.width / 2, r.top + r.height / 2); // 2–3 glints
      }, i * 120));
    });
    return () => timers.forEach(clearTimeout);
  }, [fills, sectors, reduceMotion]);
```

Note: `grg-shine` is 0.95s in intent; the CSS keyframe runs `0.95s` — set the animation duration in CSS if you prefer, but the `class="grg-shine"` above relies on the keyframe declaration carrying its own duration. Declare the class in `index.html` alongside the keyframe so the duration is explicit:

Add to `index.html`'s `<style>` (right after the `grg-shine` keyframe from Step 1):

```css
  .grg-shine { animation: grg-shine 0.95s ease forwards; }
```

- [ ] **Step 5: Run the parse gate.**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
```
Expected: exit 0.

- [ ] **Step 6: Write the shine test.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-shine-test.mjs`. It plays one full sector (10 answers) so the modal closes and the wheel gains filled cells, then asserts at least one `.grg-shine` clone appears in the wheel SVG during the cascade. Reuse `board-test.mjs` for the exact per-question click loop (Levels 1–3 have 1/2/3 questions; Tier 4 can be skipped via "None / skip advanced"). The minimal reliable path: answer Level 1–3 (6 taps) then click "None / skip advanced".

```js
import { chromium } from 'playwright';
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ok -', name); else { failures++; console.log('  FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const clickByText = (page, txt, exact = false) => page.evaluate(([t, ex]) => {
  const b = [...document.querySelectorAll('button')].find(x => { const s = (x.innerText || '').trim(); return ex ? s === t : s.includes(t); });
  if (!b) return false; b.click(); return true;
}, [txt, exact]);
const hasYes = (page) => page.evaluate(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 667 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.route('**/api/complete', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sheet":"ok","email":"sent"}' }));

// Detect a shine clone the instant it is appended.
let sawShine = false;
await page.exposeFunction('__reportShine', () => { sawShine = true; });

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('Play the Game')), null, { timeout: 15000 });
await clickByText(page, 'Play the Game');
await page.waitForSelector('input[placeholder="Your Theme Camp"]');
await page.fill('input[placeholder="Your Theme Camp"]', 'Dusty Sprouts');
await page.fill('input[placeholder="Your (Playa) Name"]', 'Fern');
await page.fill('input[type="email"]', 'fern@example.org');
await clickByText(page, 'START');
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'SPIN'));
await clickByText(page, 'SPIN', true);
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'), null, { timeout: 8000 });

// Watch the wheel SVG for appended .grg-shine nodes.
await page.evaluate(() => {
  const obs = new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes)
      if (n.nodeType === 1 && n.classList && n.classList.contains('grg-shine')) window.__reportShine();
  });
  obs.observe(document.body, { subtree: true, childList: true });
});

// answer Levels 1–3 (6 taps), then skip Tier 4
for (let i = 0; i < 6; i++) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES')); await clickByText(page, 'YES', true); await page.waitForTimeout(60); }
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('skip advanced')), null, { timeout: 4000 });
await clickByText(page, 'skip advanced');
await page.waitForTimeout(1600); // let the 120ms cascade + clones appear

check('shine clone appeared on filled wedges', sawShine);
check('no page errors', errs.length === 0, errs);

await browser.close();
console.log(failures ? `\nFX SHINE: ${failures} FAILED` : '\nFX SHINE: all passed');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 7: Run the shine test.**

```bash
cd /Users/wes/.claude/jobs/1920a528/tmp/pw && bun fx-shine-test.mjs
```
Expected: `FX SHINE: all passed`, exit 0. If the sector that spun happens to have a Tier-4 write-in flow, the "skip advanced" button still closes it; the assertion only needs one filled cell to shine.

- [ ] **Step 8: Commit.**

```bash
git add green-radius.jsx index.html
git commit -m "PR46: shine-sweep + sparkle on newly filled wheel wedges"
```

---

### Task 4: Staged result reveal on the finished screen

**Files:**
- Modify: `green-radius.jsx` — `RadialBadge` (~1062–1112): add optional `revealCount` prop. `ShareCard` (~1166–1231): add optional `reveal` prop (badge count + header count-up + tick pulse). `GreenRadiusGame` (~2206+): add the reveal hook, the arming ref, and wire the `done` render (~2540–2704).
- Modify: `index.html` — add `grg-wpop`, `grg-tick`, `grg-rankslam` keyframes + neutralizers.
- Test: `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-reveal-test.mjs` (new).

**Interfaces:**
- Consumes: `Fx.leafBurst(el)` from Task 1.
- Produces:
  - `RadialBadge` prop `revealCount?: number|null` — when a number, only the first `revealCount` *filled* segments (in sector→level→qi render order) draw lit; the rest draw as base. `null`/absent = today's behavior (all filled cells lit). Aggregate/admin mode (`intensities`) is unaffected.
  - `ShareCard` prop `reveal?: number|null` — when a number, the header total shows `reveal` (with a tick pulse on change) and passes `revealCount={reveal}` to its badge. `null`/absent = today's behavior. Used only by the done screen; `result/index.html` passes nothing.
  - Hook `useResultReveal(total, active, reduceMotion) → { value, done }` — `value` counts `0→total` over a fixed ~1500ms window (cadence = window/total, min 24ms/step); `done` flips true at the end. When `!active` or `reduceMotion` or `total<=0`, returns `{ value: total, done: true }` immediately.

- [ ] **Step 1: Add the keyframes to `index.html`.**

After the `.grg-shine` rule from Task 3, add:

```css
  @keyframes grg-wpop     { 0% { transform: scale(1); } 40% { transform: scale(1.25); } 100% { transform: scale(1); } }
  @keyframes grg-tick     { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
  @keyframes grg-rankslam { 0% { opacity: 0; transform: scale(2.2) rotate(-10deg); } 55% { opacity: 1; transform: scale(0.95) rotate(-3deg); } 75% { transform: scale(1.04) rotate(-3deg); } 100% { opacity: 1; transform: scale(1) rotate(-3deg); } }
```

Inside the reduced-motion `@media` block, add:

```css
    @keyframes grg-wpop     { from { transform: none; } to { transform: none; } }
    @keyframes grg-tick     { from { transform: none; } to { transform: none; } }
    @keyframes grg-rankslam { from { opacity: 1; transform: none; } to { opacity: 1; transform: none; } }
```

- [ ] **Step 2: Add the `useResultReveal` hook to `green-radius.jsx`.**

Place it just above `function GreenRadiusGame(` (line 2206), at module scope:

```jsx
// PR46: drives the staged finished-screen reveal. `value` counts 0→total over a
// fixed ~1.5s window so a 12-wedge camp and a 24-wedge camp finish on the same
// beat; `done` flips at the end (triggers the rank slam). Reduced motion / not
// active → final values immediately (today's behavior).
function useResultReveal(total, active, reduceMotion) {
  const instant = !active || reduceMotion || total <= 0;
  const [value, setValue] = useState(instant ? total : 0);
  const [done, setDone] = useState(instant);
  useEffect(() => {
    if (!active || reduceMotion || total <= 0) { setValue(total); setDone(true); return; }
    setValue(0); setDone(false);
    const WINDOW = 1500;
    const step = Math.max(24, WINDOW / total);
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setValue(n);
      if (n >= total) { clearInterval(iv); setDone(true); }
    }, step);
    return () => clearInterval(iv);
  }, [active, reduceMotion, total]);
  return { value, done };
}
```

- [ ] **Step 3: Add `revealCount` staging to `RadialBadge`.**

Change the signature (line 1062–1063) to add the prop:

```jsx
function RadialBadge({ sectors, fills, size = 320, dark = true, showLabels = true, showCenter = true, showGrid = false,
                       intensities = null, onSelectSegment = null, selected = null, centerLabel = null, fluid = false,
                       revealCount = null }) {
```

Immediately before the `return (` (line 1076), add a render-scoped running counter of lit segments:

```jsx
  let _litSeen = 0; // running index of filled segments in render order (sector→level→qi)
```

Inside the innermost `segAngles(...).map(([s0, s1], qi) => { ... })` (starting line 1091), replace the `fillCol`/`fillOp` computation (lines 1092–1094) and the returned `<path>` `fill`/`style` so a filled cell only draws lit once its lit-index is below `revealCount`, and the just-crossed cell pops. Replace:

```jsx
            const isSel = selected && selected.sector === sector.id && selected.level === li && selected.qi === qi;
            const fillCol = agg ? LEVEL_COLORS[li] : (cells[qi] ? LEVEL_COLORS[li] : baseColor);
            const fillOp = agg ? Math.max(0.06, cells[qi] || 0) : 1;
            return (
              <path key={`${sector.id}-${li}-${qi}`}
                d={arcPath(cx, cy, rIn, rOut, s0, s1)}
                fill={fillCol} fillOpacity={fillOp}
                stroke={isSel ? '#e8c15a' : baseStroke} strokeWidth={isSel ? 1.5 : 0.5}
                style={onSelectSegment ? { cursor: 'pointer' } : undefined}
                onClick={onSelectSegment ? () => onSelectSegment(sector.id, li, qi) : undefined}
                tabIndex={onSelectSegment ? 0 : undefined}
                role={onSelectSegment ? 'button' : undefined}
                aria-label={onSelectSegment ? `${sector.name}, level ${li + 1}, segment ${qi + 1}` : undefined}
                onKeyDown={onSelectSegment ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment(sector.id, li, qi); }
                } : undefined}
              />
            );
```

with:

```jsx
            const isSel = selected && selected.sector === sector.id && selected.level === li && selected.qi === qi;
            const litNow = !agg && !!cells[qi];
            let shown = litNow;
            if (revealCount != null && litNow) { shown = _litSeen < revealCount; _litSeen++; }
            const pop = revealCount != null && shown && _litSeen === revealCount; // the just-lit segment
            const fillCol = agg ? LEVEL_COLORS[li] : (shown ? LEVEL_COLORS[li] : baseColor);
            const fillOp = agg ? Math.max(0.06, cells[qi] || 0) : 1;
            const style = {
              ...(onSelectSegment ? { cursor: 'pointer' } : {}),
              ...(pop ? { animation: 'grg-wpop 0.4s cubic-bezier(.34,1.56,.64,1)', transformBox: 'fill-box', transformOrigin: 'center' } : {}),
            };
            return (
              <path key={`${sector.id}-${li}-${qi}`}
                d={arcPath(cx, cy, rIn, rOut, s0, s1)}
                fill={fillCol} fillOpacity={fillOp}
                stroke={isSel ? '#e8c15a' : baseStroke} strokeWidth={isSel ? 1.5 : 0.5}
                style={Object.keys(style).length ? style : undefined}
                onClick={onSelectSegment ? () => onSelectSegment(sector.id, li, qi) : undefined}
                tabIndex={onSelectSegment ? 0 : undefined}
                role={onSelectSegment ? 'button' : undefined}
                aria-label={onSelectSegment ? `${sector.name}, level ${li + 1}, segment ${qi + 1}` : undefined}
                onKeyDown={onSelectSegment ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment(sector.id, li, qi); }
                } : undefined}
              />
            );
```

- [ ] **Step 4: Add `reveal` to `ShareCard` (header count-up + tick pulse + badge staging).**

Change the signature (line 1166) to accept the prop:

```jsx
function ShareCard({ sectors, fills, campName, leadName, year, palette, reveal = null }) {
```

Replace the total computation (line 1167) and add a ref + tick-pulse effect:

```jsx
  const fullTotal = sectors.reduce((n, s) => n + ((fills[s.id] && fills[s.id].totalYes) || 0), 0);
  const total = reveal == null ? fullTotal : reveal;
  const totalRef = useRef(null);
  useEffect(() => {
    if (reveal == null || !totalRef.current) return; // no-op for the static result page
    const el = totalRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'grg-tick 0.18s ease';
  }, [reveal]);
```

Update the header total span (line 1190) to carry the ref and tabular-nums (so the layout never wiggles as digits change):

```jsx
            <span ref={totalRef} style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
```

Pass the reveal count into the badge (line 1198):

```jsx
            <RadialBadge sectors={sectors} fills={fills} size={300} showGrid={true} fluid revealCount={reveal}/>
```

The sector-breakdown grid (lines 1203–1222) intentionally keeps showing final per-sector totals — the spec stages only the badge wedges, the headline total, and the rank.

- [ ] **Step 5: Add the reveal state + arming to `GreenRadiusGame` (top-level hooks).**

Hooks must be unconditional, so they go at the top of `GreenRadiusGame`, not inside the `if (phase === 'done')` block. After the existing refs (after line 2245, `const [restored, setRestored] = ...` region), add:

```jsx
  const revealArmedRef = useRef(false); // set only when we transition playing→done in-session (board mode)
  const rankRef = useRef(null);         // the finished-screen rank word, for the closing leaf burst
  const revealReduceMotion = typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const totalYesAll = sectors.reduce((n, s) => n + (fills[s.id] ? fills[s.id].totalYes : 0), 0);
  const revealActive = phase === 'done' && revealArmedRef.current && mode === 'board';
  const { value: revealValue, done: revealDone } = useResultReveal(totalYesAll, revealActive, revealReduceMotion);
  // Fire the closing leaf burst from the rank once the count-up finishes.
  useEffect(() => {
    if (revealActive && revealDone && rankRef.current) Fx.leafBurst(rankRef.current);
  }, [revealActive, revealDone]);
```

- [ ] **Step 6: Arm the reveal on the in-session board finish; disarm on reset/exit.**

In the allDone → done transition effect (lines 2264–2271), set the flag right before `setPhase('done')`. Replace:

```jsx
  useEffect(() => {
    if (phase === 'playing' && allDone && !celebration) {
      const t = setTimeout(() => setPhase('done'), 800);
      return () => clearTimeout(t);
    }
  }, [phase, allDone, celebration]);
```

with:

```jsx
  useEffect(() => {
    if (phase === 'playing' && allDone && !celebration) {
      const t = setTimeout(() => { revealArmedRef.current = true; setPhase('done'); }, 800);
      return () => clearTimeout(t);
    }
  }, [phase, allDone, celebration]);
```

In `freshProgress()` (line 2446), add a disarm line (so a later reload/new game does not falsely reveal), after `submitGenRef.current++;`:

```jsx
    revealArmedRef.current = false;
```

In `handleExit()` (line 2589), add the same disarm line, next to `autoSentRef.current = false;`:

```jsx
      revealArmedRef.current = false;
```

Form mode is intentionally excluded: `submitForm()` sets `phase = 'done'` without arming, and `revealActive` also requires `mode === 'board'`, so a form finish renders the result instantly (matching "form mode stays quick and quiet").

- [ ] **Step 7: Wire the `done` render to the reveal.**

In the `done` block (line 2540 onward), two edits.

(a) The rank line (lines 2616–2620): hide it (layout preserved) until the reveal finishes, then slam the rank word in. Replace:

```jsx
        {rankTitle && (
          <div style={{ fontSize: 15, fontWeight: 700, color: palette.text, margin: '-16px 0 24px' }}>
            Your camp is a <span style={{ color: palette.accentDark }}>{rankTitle}</span> · {total}/60
          </div>
        )}
```

with:

```jsx
        {rankTitle && (
          <div style={{
            fontSize: 15, fontWeight: 700, color: palette.text, margin: '-16px 0 24px',
            ...(revealActive && !revealDone ? { visibility: 'hidden' } : {}),
          }}>
            Your camp is a <span ref={rankRef} style={{
              color: palette.accentDark, display: 'inline-block',
              animation: (revealActive && revealDone && !revealReduceMotion)
                ? 'grg-rankslam 0.7s cubic-bezier(.22,1,.36,1) both' : 'none',
            }}>{rankTitle}</span> · {total}/60
          </div>
        )}
```

(b) The on-screen `ShareCard` (line 2622): pass the reveal count when active. The offscreen `ResultCardSVG` twin (line 2627) is left exactly as-is, so any mid-reveal screenshot/download still embeds the final values. Replace:

```jsx
          <ShareCard sectors={sectors} fills={fills} campName={camp.campName} leadName={camp.leadName} year={year} palette={palette}/>
```

with:

```jsx
          <ShareCard sectors={sectors} fills={fills} campName={camp.campName} leadName={camp.leadName} year={year} palette={palette} reveal={revealActive ? revealValue : null}/>
```

Do not change the `total`/`rankTitle`/`resultUrl` computations at the top of the block (lines 2542–2545) — they must stay final so the share link, email, and download are always correct.

- [ ] **Step 8: Run the parse gate.**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
```
Expected: exit 0.

- [ ] **Step 9: Write the reveal test.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-reveal-test.mjs`. It plays all six sectors (copy the per-sector loop from `board-test.mjs`), lands on the finished screen, waits for the reveal to settle, and asserts the ShareCard header total and the rank line match the true values (from the summed per-sector `/10` cells). It also asserts zero console/page errors. Because the reveal window is ~1.5s + a 0.7s slam, wait ~3s after the done screen appears before reading.

```js
import { chromium } from 'playwright';
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ok -', name); else { failures++; console.log('  FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const clickByText = (page, txt, exact = false) => page.evaluate(([t, ex]) => {
  const b = [...document.querySelectorAll('button')].find(x => { const s = (x.innerText || '').trim(); return ex ? s === t : s.includes(t); });
  if (!b) return false; b.click(); return true;
}, [txt, exact]);
const btnTexts = (page) => page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 667 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.route('**/api/complete', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sheet":"ok","email":"sent"}' }));

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('Play the Game')), null, { timeout: 15000 });
await clickByText(page, 'Play the Game');
await page.waitForSelector('input[placeholder="Your Theme Camp"]');
await page.fill('input[placeholder="Your Theme Camp"]', 'Dusty Sprouts');
await page.fill('input[placeholder="Your (Playa) Name"]', 'Fern');
await page.fill('input[type="email"]', 'fern@example.org');
await clickByText(page, 'START');

for (let round = 0; round < 6; round++) {
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'SPIN'); return b && !b.disabled; });
  await clickByText(page, 'SPIN', true);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'), null, { timeout: 8000 });
  for (let i = 0; i < 6; i++) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES')); await clickByText(page, 'YES', true); await page.waitForTimeout(40); }
  // Tier 4: skip if the picker is showing
  const texts = await btnTexts(page);
  if (texts.some(t => t.includes('skip advanced'))) { await clickByText(page, 'skip advanced'); }
  await page.waitForTimeout(400); // let toast/celebration settle before next spin
}

// finished screen
await page.waitForFunction(() => document.body.innerText.includes('/ 60 green'), null, { timeout: 8000 });
await page.waitForTimeout(3000); // reveal (~1.5s) + rank slam (~0.7s) + margin

const shown = await page.evaluate(() => {
  const card = document.body.innerText;
  const totalM = card.match(/(\d+)\s*\/\s*60 green/);
  const rankM = card.match(/Your camp is a\s+(.+?)\s+·\s+(\d+)\/60/);
  return { header: totalM ? +totalM[1] : null, rank: rankM ? rankM[1] : null, rankTotal: rankM ? +rankM[2] : null };
});
// All-yes playthrough → 60. (Answering only Levels 1–3 = 6 per sector; Tier 4 skipped = 0.)
check('header total counted up to final', shown.header === 36, shown);
check('rank line total matches', shown.rankTotal === 36, shown);
check('rank title present after slam', !!shown.rank && shown.rank.length > 0, shown);
check('no page errors', errs.length === 0, errs);

await browser.close();
console.log(failures ? `\nFX REVEAL: ${failures} FAILED` : '\nFX REVEAL: all passed');
process.exit(failures ? 1 : 0);
```

Note on the expected number: answering only Levels 1–3 (1+2+3 = 6 Yes) on all six sectors and skipping Tier 4 gives 6×6 = **36**. If the implementer's loop also answers Tier-4 topics, adjust the two `=== 36` assertions to the real sum. The assertion's purpose is that the animated header/rank totals equal the true score after the reveal settles.

- [ ] **Step 10: Run the reveal test.**

```bash
cd /Users/wes/.claude/jobs/1920a528/tmp/pw && bun fx-reveal-test.mjs
```
Expected: `FX REVEAL: all passed`, exit 0.

- [ ] **Step 11: Commit.**

```bash
git add green-radius.jsx index.html
git commit -m "PR46: staged finished-screen reveal (wedge build, count-up, rank slam)"
```

---

### Task 5: Version stamp + full verification

**Files:**
- Modify: `green-radius.jsx` — `APP_VERSION` (line 52).
- Test: `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-reduced-test.mjs` (new) + `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-shots.mjs` (new); plus re-running Tasks 1–4 tests.

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: nothing.

- [ ] **Step 1: Bump `APP_VERSION`.**

Line 52 currently reads:

```jsx
const APP_VERSION = 'v44';
```

Change to:

```jsx
const APP_VERSION = 'v46';
```

(The file is at `v44`; the spec says jump straight to `v46`. If PR #45 lands first and this line is `v45`, this is still a one-line rebase to `v46` — that line is the only expected collision with PR #45.)

- [ ] **Step 2: Run the parse gate.**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null
```
Expected: exit 0.

- [ ] **Step 3: Write the reduced-motion pass.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-reduced-test.mjs`. Same flow as the reveal test but the context sets `reducedMotion: 'reduce'`. Asserts: (a) after tapping Yes the fx canvas stays blank (no particles), and (b) the finished screen shows the correct total immediately with no count-up (read within ~150ms of the done screen appearing).

```js
import { chromium } from 'playwright';
let failures = 0;
const check = (name, cond, extra) => { if (cond) console.log('  ok -', name); else { failures++; console.log('  FAIL -', name, extra !== undefined ? JSON.stringify(extra) : ''); } };
const clickByText = (page, txt, exact = false) => page.evaluate(([t, ex]) => {
  const b = [...document.querySelectorAll('button')].find(x => { const s = (x.innerText || '').trim(); return ex ? s === t : s.includes(t); });
  if (!b) return false; b.click(); return true;
}, [txt, exact]);
const canvasInk = (page) => page.evaluate(() => {
  const c = document.querySelector('canvas[data-fx]'); if (!c) return false;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
  return false;
});
const btnTexts = (page) => page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 667 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.route('**/api/complete', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sheet":"ok","email":"sent"}' }));

await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('Play the Game')), null, { timeout: 15000 });
await clickByText(page, 'Play the Game');
await page.waitForSelector('input[placeholder="Your Theme Camp"]');
await page.fill('input[placeholder="Your Theme Camp"]', 'Dusty Sprouts');
await page.fill('input[placeholder="Your (Playa) Name"]', 'Fern');
await page.fill('input[type="email"]', 'fern@example.org');
await clickByText(page, 'START');

for (let round = 0; round < 6; round++) {
  await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'SPIN'); return b && !b.disabled; });
  await clickByText(page, 'SPIN', true);
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'), null, { timeout: 8000 });
  if (round === 0) {
    check('canvas stays blank after Yes under reduced motion', !(await (async () => { await clickByText(page, 'YES', true); let ink = false; for (let i = 0; i < 10 && !ink; i++) { ink = await canvasInk(page); await page.waitForTimeout(40); } return ink; })()));
    for (let i = 0; i < 5; i++) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES')); await clickByText(page, 'YES', true); await page.waitForTimeout(30); }
  } else {
    for (let i = 0; i < 6; i++) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES')); await clickByText(page, 'YES', true); await page.waitForTimeout(30); }
  }
  const texts = await btnTexts(page);
  if (texts.some(t => t.includes('skip advanced'))) { await clickByText(page, 'skip advanced'); }
  await page.waitForTimeout(300);
}

await page.waitForFunction(() => document.body.innerText.includes('/ 60 green'), null, { timeout: 8000 });
await page.waitForTimeout(150); // reduced motion → result should already be final
const header = await page.evaluate(() => { const m = document.body.innerText.match(/(\d+)\s*\/\s*60 green/); return m ? +m[1] : null; });
check('reduced-motion result renders final total immediately', header === 36, header);
check('no page errors', errs.length === 0, errs);

await browser.close();
console.log(failures ? `\nFX REDUCED: ${failures} FAILED` : '\nFX REDUCED: all passed');
process.exit(failures ? 1 : 0);
```

- [ ] **Step 4: Write the screenshot script.**

Create `/Users/wes/.claude/jobs/1920a528/tmp/pw/fx-shots.mjs`. It plays through to the finished screen at 390×667 and again at a desktop width (1200×900), and captures the done screen after the reveal settles for eyeball review. Reuse the same play loop as the reveal test; save PNGs to the rig's shots dir.

```js
import { chromium } from 'playwright';
const SHOTS = '/Users/wes/.claude/jobs/1920a528/tmp/shots';
const clickByText = (page, txt, exact = false) => page.evaluate(([t, ex]) => {
  const b = [...document.querySelectorAll('button')].find(x => { const s = (x.innerText || '').trim(); return ex ? s === t : s.includes(t); });
  if (!b) return false; b.click(); return true;
}, [txt, exact]);
const btnTexts = (page) => page.evaluate(() => [...document.querySelectorAll('button')].map(b => (b.innerText || '').trim()));

async function run(width, height, out) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  await page.route('**/api/complete', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"sheet":"ok","email":"sent"}' }));
  await page.goto('http://localhost:8000/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').includes('Play the Game')), null, { timeout: 15000 });
  await clickByText(page, 'Play the Game');
  await page.waitForSelector('input[placeholder="Your Theme Camp"]');
  await page.fill('input[placeholder="Your Theme Camp"]', 'Dusty Sprouts');
  await page.fill('input[placeholder="Your (Playa) Name"]', 'Fern');
  await page.fill('input[type="email"]', 'fern@example.org');
  await clickByText(page, 'START');
  for (let round = 0; round < 6; round++) {
    await page.waitForFunction(() => { const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === 'SPIN'); return b && !b.disabled; });
    await clickByText(page, 'SPIN', true);
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES'), null, { timeout: 8000 });
    for (let i = 0; i < 6; i++) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => (b.innerText || '').trim() === 'YES')); await clickByText(page, 'YES', true); await page.waitForTimeout(40); }
    const texts = await btnTexts(page);
    if (texts.some(t => t.includes('skip advanced'))) { await clickByText(page, 'skip advanced'); }
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => document.body.innerText.includes('/ 60 green'), null, { timeout: 8000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  console.log('shot ->', out);
}

await run(390, 667, `${SHOTS}/pr46-done-mobile.png`);
await run(1200, 900, `${SHOTS}/pr46-done-desktop.png`);
```

- [ ] **Step 5: Run the full verification suite (server running from Task 1).**

```bash
cd /Users/wes/.claude/jobs/1920a528/tmp/pw
bun fx-engine-test.mjs
bun fx-answer-test.mjs
bun fx-shine-test.mjs
bun fx-reveal-test.mjs
bun fx-reduced-test.mjs
bun fx-shots.mjs
```
Expected: every test prints `all passed` and exits 0; `fx-shots.mjs` writes `pr46-done-mobile.png` and `pr46-done-desktop.png`. Eyeball the two PNGs: the badge is fully lit, the headline total is the true score, the rank title is present, and the card matches today's layout (the juice is transient and will not appear in a settled screenshot — that is expected and correct).

- [ ] **Step 6: Verify the deploy stamp locally.**

Load `http://localhost:8000/` in a browser (or a Playwright `page.evaluate`) and confirm the footer stamp reads `v46`:
```bash
cd /Users/wes/.claude/jobs/1920a528/tmp/pw && bun -e "const {chromium}=await import('playwright');const b=await chromium.launch();const p=await b.newPage();await p.goto('http://localhost:8000/',{waitUntil:'domcontentloaded'});await p.waitForSelector('button');const has=await p.evaluate(()=>document.body.innerText.includes('v46'));console.log('v46 stamp present:',has);await b.close();process.exit(has?0:1);"
```
Expected: `v46 stamp present: true`, exit 0.

- [ ] **Step 7: Commit.**

```bash
git add green-radius.jsx
git commit -m "PR46: bump APP_VERSION to v46"
```

---

## Self-Review (run by the plan author; recorded for the implementer)

**1. Spec coverage.**
- §1 FxLayer + Fx emitter with all five guardrails → Task 1 (reduced-motion no-op, loop stops on empty pool, 300 cap drop-oldest, DPR≤2, visibilitychange clear, resize/orientation refit — all present).
- §2 Answer feedback (Yes = leaf+spark from button rect + spring; Not-yet = dust + gentler spring; non-blocking; keyframes beside `qm-up` with neutralizers) → Task 2.
- §3 Wedge shine sweep (ref-diff of newly filled cells, white clone fade ~0.95s, 2–3 `Fx.sparkle` glints, ~120ms stagger, skipped under reduced motion) → Task 3.
- §4 Staged reveal (fixed ~1.5s window ÷ lit-wedge count, synced count-up with tabular-nums + tick pulse, rank slam + leaf burst, non-blocking, in-session only, reduced motion instant, `ResultCardSVG` twin untouched) → Task 4.
- §5 APP_VERSION → v46 → Task 5.
- §6 Verification (parse gate, full playthrough zero console errors + correct total/rank after reveal, reducedMotion pass, 390×667 + desktop screenshots) → Task 5 (plus per-task gates in Tasks 1–4).
- Non-goals/invariants respected: no audio, no home ambient, `Celebration` untouched, `/result/` and Worker untouched, form mode gets no particles (double-gated by `mode === 'board'`), scoring/`greens`/`fills`/payloads/schema/storage untouched (props default to today's rendering; only presentation added).

**2. Placeholder scan.** No TBD/TODO/"add error handling"/"similar to Task N". Every code step shows complete code; every command shows expected output.

**3. Type consistency.** `Fx.burst/leafBurst/dustPuff/sparkle/ringShock/clear` and `FxLayer` are defined in Task 1 and used by exact name in Tasks 2–4. `RadialBadge` prop `revealCount` (Task 4 Step 3) and `ShareCard` prop `reveal` (Task 4 Step 4) match their consumers. `useResultReveal(total, active, reduceMotion) → { value, done }` (Task 4 Step 2) matches its single call site (Step 5). Keyframe names `grg-spring`, `grg-spring-soft`, `grg-shine`, `grg-wpop`, `grg-tick`, `grg-rankslam` are declared and neutralized in `index.html` and referenced by the same names in the JSX.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-05-pr46-visual-polish.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**2. Inline Execution** — execute tasks in this session with checkpoints. REQUIRED SUB-SKILL: superpowers:executing-plans.

Which approach?
