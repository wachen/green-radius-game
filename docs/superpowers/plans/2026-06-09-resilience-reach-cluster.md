# Resilience + Reach Cluster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the last deferred items from the 2026-06-09 review: vendor the React/Babel runtime same-origin (S5b/F4), add a real loading state (U7), add the free security headers (S6), make `/result/` unfurl and fail friendly (U9/F3), add a board-mode Back control (U4), make the ShareCard fluid at small widths (A5), make the admin viewer keyboard-operable (A6), and stop legacy 0–4 rows from corrupting admin aggregates (R2).

**Architecture:** No-build static app; all changes are direct edits to the served files. The runtime moves from unpkg CDN to a committed `vendor/` directory (bytes verified against the existing SRI hashes). Headers ship via the static-assets `_headers` file, not the Worker. Everything else is React-in-JSX edits inside the existing shared-Babel-scope files.

**Tech Stack:** React 18 UMD + @babel/standalone (in-browser JSX), Cloudflare Workers static assets, `bun build` parse gate, `bun -e` unit checks for pure logic.

**Out of scope (stays deferred):** A2 contrast palette pass (needs previewed mockups with the owner), R4 double-submit nonce (needs an Apps Script change), Google Fonts vendoring (graceful `display=swap` fallback already), all ranked feature ideas.

**File ownership for parallel work (do not cross):**
- **Cluster A (game file):** `green-radius.jsx` only — Tasks 5, 6, 7a.
- **Cluster B (admin):** `admin/index.html`, `admin/admin.jsx`, `admin/aggregate.js` — Tasks 2c, 7b, 8.
- **Cluster C (entry pages):** `index.html`, `result/index.html`, `_headers`, `vendor/README.md` — Tasks 1, 2a, 2b, 3, 4.
- `vendor/*.js` files are already downloaded and hash-verified; do not modify them.

---

### Task 1: Vendor the runtime (S5b/F4) — Cluster C

**Files:**
- Already present: `vendor/react-18.3.1.production.min.js`, `vendor/react-dom-18.3.1.production.min.js`, `vendor/babel-standalone-7.29.0.min.js` (sha384 verified identical to the SRI hashes in the current HTML)
- Create: `vendor/README.md`
- Modify: `index.html:94-96`, `result/index.html:12-14` (admin tags are Task 2c, Cluster B)

- [ ] **Step 1: Write `vendor/README.md`**

```markdown
# vendor/

Pinned third-party runtime, served same-origin so the site has no CDN
dependency at runtime (and so a CDN compromise or outage cannot blank the
page). Do not edit these files.

| File | Source (immutable pinned URL) |
|---|---|
| react-18.3.1.production.min.js | https://unpkg.com/react@18.3.1/umd/react.production.min.js |
| react-dom-18.3.1.production.min.js | https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js |
| babel-standalone-7.29.0.min.js | https://unpkg.com/@babel/standalone@7.29.0/babel.min.js |

To upgrade: download the new pinned URL into a new versioned filename,
verify the bytes (`openssl dgst -sha384 -binary <file> | openssl base64 -A`
against a second fetch), update the three HTML entry points, then delete the
old file. React and Babel are MIT-licensed; license headers ship inside the
minified files.
```

- [ ] **Step 2: Swap the CDN tags in `index.html`**

Replace lines 94–96 (the three unpkg script tags) with:

```html
<script defer src="/vendor/react-18.3.1.production.min.js"></script>
<script defer src="/vendor/react-dom-18.3.1.production.min.js"></script>
<script defer src="/vendor/babel-standalone-7.29.0.min.js"></script>
```

and add `defer` to the two app scripts that follow so the document can paint
the Task-2 placeholder while scripts download (`defer` preserves execution
order; the `text/babel` tags are inert to the browser and stay as-is):

```html
<script defer src="game-data.js"></script>
<script defer src="result-state.js"></script>
<script type="text/babel" src="green-radius.jsx"></script>
```

`integrity`/`crossorigin` go away: the files are first-party now and the
repo itself is the integrity story.

- [ ] **Step 3: Same swap in `result/index.html`** (lines 12–14 + the three `../` app scripts get `defer`; keep their current relative order).

- [ ] **Step 4: Parse-gate + local check**

Run: `bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo OK`
Expected: `OK` (no JSX was touched, this is the standing gate).

---

### Task 2: Loading state + noscript (U7)

- [ ] **Step 1 (2a, Cluster C): `index.html`** — add to the `<style>` block:

```css
.grg-loading {
  min-height: 100vh; min-height: 100dvh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; text-align: center; padding: 24px; color: #2a2620;
}
.grg-loading .grg-loading-dot {
  width: 34px; height: 34px; border-radius: 50%;
  background: conic-gradient(#7AB85C 0 50%, #2a2620 50% 100%);
  animation: grg-loading-spin 1.2s linear infinite;
}
.grg-loading .grg-loading-slow {
  opacity: 0; animation: grg-loading-reveal 0.4s ease 6s forwards;
  font-size: 13px; color: #2a2620aa; max-width: 280px;
}
@keyframes grg-loading-spin { to { transform: rotate(360deg); } }
@keyframes grg-loading-reveal { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .grg-loading .grg-loading-dot { animation: none; }
}
```

and replace `<div id="root"></div>` with:

```html
<div id="root">
  <div class="grg-loading">
    <div class="grg-loading-dot" aria-hidden="true"></div>
    <div style="font-weight:700">Loading the Green Radius Game…</div>
    <div class="grg-loading-slow">Still loading. On a slow connection the game can take a little while the first time.</div>
  </div>
</div>
<noscript>
  <div style="text-align:center;padding:40px 24px;font-family:system-ui">
    The Green Radius Game needs JavaScript to run. Please enable it and reload.
  </div>
</noscript>
```

React 18's `root.render()` clears the container's existing HTML on first
commit, so no teardown code is needed.

- [ ] **Step 2 (2b, Cluster C): `result/index.html`** — same pattern, copy "Loading your Green Radius…", inline styles are fine on this page (no stylesheet). Include the noscript.

- [ ] **Step 3 (2c, Cluster B): `admin/index.html`** — swap the three unpkg tags exactly as in Task 1 Step 2 (absolute `/vendor/...` paths, `defer`, drop integrity/crossorigin), add `defer` to `../game-data.js` and `./aggregate.js`, and give `#root` a one-line placeholder: `<div id="root"><div style="text-align:center;padding:60px 0;color:#93a89b">Loading the admin viewer…</div></div>`. Also add a focus style block for Task 7b: `<style>path:focus-visible{outline:2px solid #e8c15a}button:focus-visible{outline:2px solid #45c483;outline-offset:2px}</style>`.

---

### Task 3: Security headers (S6) — Cluster C

**Files:** Modify `_headers`

- [ ] **Step 1:** Append three headers to the existing `/*` block (keep the current three):

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  Content-Security-Policy: frame-ancestors 'none'
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

Deliberately **not** a script CSP: Babel-standalone needs eval and the boot
scripts are inline, so `script-src` would have to allow both — theater. The
review scoped S6 to exactly these free adds.

---

### Task 4: `/result/` fallback + OG tags (U9/F3) — Cluster C

**Files:** Modify `result/index.html`, `index.html` (head only)

- [ ] **Step 1: OG/Twitter tags in `index.html` head** (after the description meta):

```html
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://greenradi.us/"/>
<meta property="og:title" content="Green Radius Game"/>
<meta property="og:description" content="A self-ranking sustainability game for Burning Man theme camps. Spin the wheel, answer Yes/No, build your camp's green radius."/>
<meta property="og:image" content="https://greenradi.us/og-card.png"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt" content="Green Radius Game. A radial sustainability scorecard for Burning Man theme camps."/>
<meta name="twitter:card" content="summary_large_image"/>
```

- [ ] **Step 2: same block in `result/index.html`** with `og:url` `https://greenradi.us/result/`, `og:title` `Our Green Radius`, `og:description` `See how green this Burning Man theme camp went, sector by sector. Play your own at greenradi.us.` Add a `<meta name="description" .../>` with the same text too.

(`og-card.png` is generated separately by the integrator with Playwright; the
tags can land first.)

- [ ] **Step 3: replace the bare invalid-link `<p>`** in the boot script with a branded fallback (same shared-scope rules, plain React):

```jsx
if (!data) {
  root.render(
    <div style={{
      background: 'linear-gradient(155deg, #1c1410 0%, #2a1c14 100%)',
      borderRadius: 24, color: '#fff', padding: '36px 28px', maxWidth: 360,
      textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 10 }}>GREEN RADIUS</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>This result link looks incomplete.</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.75, marginBottom: 20 }}>
        Result links carry the whole scorecard after the # mark, so make sure the full link was copied. Or start fresh and build your own.
      </div>
      <a href="/" style={{
        display: 'inline-block', background: '#5BA84A', color: '#fff',
        padding: '12px 22px', borderRadius: 14, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', boxShadow: '0 3px 0 #3d7a31',
      }}>Play your own Green Radius</a>
    </div>
  );
}
```

Copy rule: no em dashes in user-facing strings.

---

### Task 5: Fluid ShareCard (A5) — Cluster A

**Files:** Modify `green-radius.jsx` (`ShareCard` ~line 956, `RadialBadge` ~line 858)

- [ ] **Step 1:** Add a `fluid` prop to `RadialBadge` so the SVG scales with its container while the viewBox keeps the layout math intact. Signature gains `fluid = false`; the `<svg>` opening tag becomes:

```jsx
<svg width={fluid ? '100%' : size} height={fluid ? undefined : size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
```

(All existing callers are unaffected; `height` omitted + viewBox keeps the aspect ratio.)

- [ ] **Step 2:** In `ShareCard`, change `width: 360` to `width: 'min(360px, 100%)'` and pass `fluid` to its badge: `<RadialBadge sectors={sectors} fills={fills} size={300} showGrid={true} fluid/>` wrapped so it cannot exceed the card: the existing flex wrapper gets `maxWidth: 300, margin: '0 auto'` via `<div style={{ width: '100%', maxWidth: 300 }}>` inside the centering div.
- [ ] **Step 3:** Parse gate (same `bun build` command). The offscreen SVG download card (`CARD_W`) is untouched on purpose — rasterization needs fixed coordinates.

---

### Task 6: Board-mode Back control (U4) — Cluster A

**Files:** Modify `green-radius.jsx` (`QuestionModal` ~line 473, footer ~line 733, modal usage ~line 2421)

- [ ] **Step 1: pure helper near `resumePosition`:**

```jsx
// One step back through the fixed levels (sizes 1/2/3). Returns null at the very start.
function stepBack(level, idx) {
  const levelSizes = [1, 2, 3, 4];
  if (idx > 0) return { level, idx: idx - 1 };
  if (level > 0) return { level: level - 1, idx: levelSizes[level - 1] - 1 };
  return null;
}
```

- [ ] **Step 2: `back()` inside `QuestionModal`:**

```jsx
function back() {
  if (isTier4) {
    if (topicId) { setTopicId(''); return; }          // leave the open topic, back to the picker
    if (idx > 0) {                                     // un-answer the previous advanced topic
      setAnswersByLevel(a => a.map((l, li) => li === 3 ? l.slice(0, -1) : l));
      setPickedTopicIds(p => p.slice(0, -1));
      setIdx(idx - 1);
      return;
    }
  }
  const prev = stepBack(level, idx);
  if (!prev) return;
  const pq = (sector.levels[prev.level] || [])[prev.idx];
  if (pq && onAnswer) onAnswer(pq.id, null);           // null = remove the persisted answer
  setAnswersByLevel(a => a.map((l, li) => li === prev.level ? l.slice(0, -1) : l));
  setLevel(prev.level);
  setIdx(prev.idx);
}
const canGoBack = isTier4 ? (!!topicId || idx > 0 || true) && !(level === 0 && idx === 0)
                          : !(level === 0 && idx === 0);
```

(Simplify: `const canGoBack = !(level === 0 && idx === 0 && !topicId);` — at the Tier-4 picker with idx 0, Back still returns to Level 3 Q3, which `stepBack(3, 0)` handles.)

- [ ] **Step 3: footer control** — replace the `{stepNumber} of 10` footer div with a flex row: a Back button on the left (hidden when `!canGoBack`), the counter centered:

```jsx
<div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
  <button type="button" onClick={back} aria-label="Go back to the previous question"
    style={{ visibility: canGoBack ? 'visible' : 'hidden', background: 'none', border: 'none',
      color: palette.text + '99', fontSize: 12, fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', padding: '6px 8px', minHeight: 32 }}>
    ‹ Back
  </button>
  <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: palette.text + '99' }}>
    {isTier4 ? 'Advanced' : `${stepNumber} of 10`}
  </div>
  <span style={{ visibility: 'hidden', fontSize: 12, fontWeight: 700, padding: '6px 8px' }} aria-hidden="true">‹ Back</span>
</div>
```

(The hidden right-side twin keeps the counter optically centered. Note the
current footer shows `{stepNumber} of 10` even on Tier 4 where stepNumber can
read `10 of 10` for all four topics; leave that exact behavior alone except
where this block replaces it — keep `{stepNumber} of 10` if unsure.)

- [ ] **Step 4: parent un-answer support** — the modal usage's `onAnswer` becomes:

```jsx
onAnswer={(qid, v) => setAnswers(a => {
  const next = { ...a };
  if (v == null) delete next[qid]; else next[qid] = v;
  return next;
})}
```

Without this, backing out of a question then refreshing would resume *past*
the un-answered question (`resumePosition` skips ids present in the map).

- [ ] **Step 5: unit-check the pure helper** via `bun -e` (stepBack from (0,0)→null, (1,0)→(0,0), (1,1)→(1,0), (2,0)→(1,1), (3,0)→(2,2)).
- [ ] **Step 6:** Parse gate.

---

### Task 7: Keyboard paths (A6)

- [ ] **Step 1 (7a, Cluster A): `RadialBadge` segments** — when `onSelectSegment` is set, make each `<path>` keyboard-operable:

```jsx
tabIndex={onSelectSegment ? 0 : undefined}
role={onSelectSegment ? 'button' : undefined}
aria-label={onSelectSegment ? `${sector.name}, level ${li + 1}, segment ${qi + 1}` : undefined}
onKeyDown={onSelectSegment ? (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectSegment(sector.id, li, qi); }
} : undefined}
```

Game/result pages never pass `onSelectSegment`, so their badges stay inert.

- [ ] **Step 2 (7b, Cluster B): `admin/admin.jsx`** — convert the two click-only controls to real buttons:
  - Camp row (`data-camp-row` div ~line 157): `<button type="button">` with the same flex styles plus `width: '100%'`, `textAlign: 'left'`, `font: 'inherit'`, `color: 'inherit'`, `border: 'none'`, keep `borderBottom: '1px solid #1a281f'` and the selected background.
  - `‹ All camps` back div (~line 173): `<button type="button">` with `background: 'none'`, `border: 'none'`, `font: 'inherit'`, `fontSize: 13`, same color/weight/padding/cursor.

---

### Task 8: Legacy rows in admin (R2) — Cluster B

**Files:** Modify `admin/aggregate.js`, `admin/admin.jsx`

- [ ] **Step 1: era tag in `aggregate.js`** (export it on the api object):

```js
// Pre-rework rows (before the 0-10 per-question capture) have no schema tag and
// no per-question answers; their greens mean levels-lit 0-4, not questions 0-10.
function isLegacy(row) {
  return !row.schemaVersion && (!row.answers || Object.keys(row.answers).length === 0);
}
```

- [ ] **Step 2: exclude from aggregates** — first lines of `computeAggregates`:

```js
const legacyCount = rows.filter(isLegacy).length;
rows = rows.filter(r => !isLegacy(r));
```

and add `legacyCount` to the returned object. Everything downstream (averages,
leaderboard, intensities, momentum, tallyPct) then only sees same-scale rows.

- [ ] **Step 3: City tab note** (`CommunityTally` hero, after the momentum line):

```jsx
{agg.legacyCount > 0 && (
  <div style={{ fontSize: 11, color: '#7f988a', marginTop: 4 }}>
    {agg.legacyCount} older {agg.legacyCount === 1 ? 'response' : 'responses'} on the old 0 to 4 scale excluded from the tally.
  </div>
)}
```

- [ ] **Step 4: Camps view honesty** — in the row list and `CampDetail`, compute `const legacy = A.isLegacy(camp)` (rows keep flowing to the list):
  - Row + detail totals render `{r.total}/24` with an `old scale` chip (same pill style as the `source` chip) when legacy.
  - `CampDetail` for legacy rows: per-sector `{camp.greens[s.id] || 0}/4`, skip the `maxed` star logic (`=== 10` is never true on 0–4 — make that explicit by guarding `!legacy`), and build fills level-based instead of question-based:

```jsx
function legacyFills(sectors, greens) {
  const out = {};
  sectors.forEach(s => {
    const count = Math.max(0, Math.min(4, (greens && greens[s.id]) | 0));
    const sizes = [1, 2, 3, 4];
    const levels = sizes.map((n, li) => Array.from({ length: n }, () => li < count));
    out[s.id] = { levels, totalYes: sizes.reduce((t, n, li) => t + (li < count ? n : 0), 0), played: count > 0 };
  });
  return out;
}
```

  used as: `hasAnswers ? fillsFromAnswers(...) : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens))`.

- [ ] **Step 5: unit-check** `isLegacy` + `legacyCount` + exclusion with `bun -e` requiring `admin/aggregate.js` (it has the CJS guard).

---

### Verification (integrator)

- [ ] Parse gates: `green-radius.jsx` and `admin/admin.jsx` via `bun build … > /dev/null`.
- [ ] `bun -e` unit checks: `stepBack`, `isLegacy`/`legacyCount`, `legacyFills` shape.
- [ ] `python3 -m http.server` + Playwright (bun): home loads with **zero unpkg requests**, placeholder visible on throttled load, spin → answer → Back restores the previous question, `/result/#<valid>` renders, `/result/#garbage` shows the branded fallback with a working CTA, 320 px viewport has no horizontal overflow on `/result/`.
- [ ] Generate `og-card.png` (1200×630) via Playwright screenshot; wire it (tags already in place).
- [ ] Docs: `docs/architecture.md` (vendored runtime + headers are wiring), `CLAUDE.md` (SRI gotcha becomes a vendoring gotcha), `CONTRIBUTING.md` file map, review-doc status flips.
- [ ] Adversarial review workflow over the full diff, fix confirmed findings, open PR #37.
