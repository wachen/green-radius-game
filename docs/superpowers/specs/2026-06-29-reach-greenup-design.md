# Green Radius — Reach + Green-Up (#39) Design

**Status:** approved 2026-06-29. Combines roadmap moves 2+3 into one PR (per the
locked decision in [[next-moves-roadmap-2026-06-10]]: combined, not stacked).

## Goal

Help shared results spread, and give every camp a concrete way to grow next year.
Four additive features on the existing done screen + result page:

1. **Web Share Level 2** — share the PNG result card as a *file*, not just a link.
2. **Per-camp OG unfurl** — pasted result links preview with the camp's name + score.
3. **Playa-rank titles** — a fun title derived from the camp's 0–60 total.
4. **Green-Up Plan** — a collapsed, done-screen-only list of next-year steps built
   from the camp's "No" answers.

Everything is additive and degrades gracefully; nothing here may weaken the existing
"works with the Worker down / result lives in the URL" guarantees.

## Context (current state)

- Done screen (`green-radius.jsx`): `handleShare()` is **Web Share Level 1** —
  `navigator.share({ title, url })`, clipboard fallback. `handleDownload()` calls
  `downloadSvgAsPng(cardSvgRef.current, …)`, which serializes the offscreen
  `ResultCardSVG` twin → 2× canvas → PNG blob → anchor download.
- Share/result URL today: `/result/#<hash>` (fragment only — never sent to a server).
- `/result/` (`result/index.html`) decodes `location.hash` client-side → `<ShareCard>`.
  OG tags are **static** (`og:title = "Our Green Radius"`, image = static
  `og-card.png`); the page deliberately omits `og:url` because crawlers strip the
  `#fragment`.
- `result-state.js` is **isomorphic** (`module.exports` + `Buffer` fallbacks) and the
  hash carries `campName` + packed per-sector fills → derivable total. The Worker can
  reuse its `decode()` server-side with no logic duplication.
- The Worker (`worker/index.js`) serves `/result/` straight from `env.ASSETS`; it has
  no `HTMLRewriter` today.

## Locked decisions

- **OG privacy:** new share/email links carry the hash in a `?r=<hash>` **query**
  param so the Worker can read it. The `#fragment` path is kept for backward-compat
  (legacy links still render). Disclosed tradeoff — see Privacy below.
- **Rank voice:** "Expanding Radius" (see bands). Shown on the **done screen + OG
  description**; the shared **card image is unchanged**.
- **Green-Up Plan:** the **full** plan (every "No"), grouped by sector, level-ascending;
  **collapsed by default**; **done-screen only** (never on public `/result/`); the
  panel **does not render at all** when there are no gaps; **zero new copy** (reuses
  each question's existing title + link).

## Rank bands (the only net-new copy in this PR)

| Total (0–60) | Title           |
|--------------|-----------------|
| 0–10         | First Spark     |
| 11–20        | Dusty Ember     |
| 21–30        | Rising Glow     |
| 31–40        | Wide Beacon     |
| 41–50        | Solar Camp      |
| 51–60        | Green Supernova |

`titleFor(total)`: clamp to 0–60, return the title of the highest band whose lower
bound ≤ total. The bands are the single source of truth — never inline these strings
elsewhere.

## Architecture & files

| File | Change |
|------|--------|
| **`rank.js`** (new) | Isomorphic module mirroring `result-state.js`: `module.exports` + a global assign, body `(function(global){…})(typeof globalThis!=='undefined'?globalThis:this)` — **note `globalThis`, not `this`** (see Worker-import safety below). Sets `global.Rank = api`. Exposes `titleFor(total)` and `BANDS`. One source of truth shared by the browser (done screen, share text) and the Worker (OG description). |
| **`green-radius.jsx`** | Extract `svgToPngBlob(svgEl, scale=2) → Promise<Blob>` from `downloadSvgAsPng` (which then calls it + does the anchor download — behavior unchanged). Pre-generate the PNG blob on done-phase entry into a ref. Upgrade `handleShare` to Level 2. Build `resultUrl` with `?r=`. Render the rank title on the done screen. Add a `GreenUpPlan` component (defined in this file, referenced by bare name like the other components). |
| **`worker/index.js`** | New branch: `GET` + `url.pathname === '/result/'` + `url.searchParams.has('r')` → decode the hash (import `result-state.js`), compute total + rank (import `rank.js`), fetch the asset via `env.ASSETS`, and `HTMLRewriter` the `og:title`/`og:description`. No `?r=` or decode failure → pass through untouched (fail-open to the static tags). All other routing unchanged. |
| **`result-state.js`** | One-line hardening: change the IIFE argument from `typeof window!=='undefined'?window:this` to `typeof globalThis!=='undefined'?globalThis:this` so it imports into the Worker bundle without throwing (see below). Browser behavior is identical (`globalThis === window`). |
| **`index.html`** | Add `<script defer src="rank.js"></script>` (alongside `game-data.js` / `result-state.js`) so the done screen can read `window.Rank`. |
| **`result/index.html`** | Client decode reads the query first, hash as fallback: `decode(new URLSearchParams(location.search).get('r') || location.hash)`. Legacy `#hash` links keep working. (Does **not** need `rank.js` — the card shows no rank.) |
| **`docs/architecture.md`** | Document the new `?r=` path, the OG-rewrite route, `rank.js`, and Share L2 — this is a wiring change. |
| **`.assetsignore` / `_headers`** | No change. `rank.js` is a runtime-fetched root `.js`, already served (not ignored). |

### Worker-import safety (verify early)

The Worker reuses `result-state.js` + `rank.js` by importing them into its bundle
(wrangler/esbuild). Both files use the UMD-ish pattern
`(function(global){…})(<resolve global>)`. In an ESM/Worker bundle the module's
top-level `this` is `undefined`, so resolving the global via `this` would throw at
module-eval and crash the Worker. Resolving via **`globalThis`** (defined in browsers,
Workers, and Bun) is always a real object, so the global-assign is a harmless no-op
property set and the `module.exports` provides the import. This is why both modules
must use `globalThis`. **Verify this first** in the implementation (a `bun build` of
`worker/index.js`, or `wrangler deploy --dry-run`, must succeed and the imported
`decode`/`titleFor` must be callable) before building the rest of the Worker route.

## Feature 1 — Web Share Level 2

- `svgToPngBlob(svgEl, scale=2)` returns the PNG `Blob`; `downloadSvgAsPng` keeps its
  current download behavior by calling it then triggering the anchor.
- **Pre-generate** the blob in an effect when `phase === 'done'` (and the offscreen
  `ResultCardSVG` twin is mounted), storing it in a ref. Safari requires the file to
  exist *inside* the user's tap gesture; generating on click is async and WebKit may
  block the share sheet.
- `handleShare()`:
  1. Build `new File([blob], 'green-radius-<slug>.png', { type: 'image/png' })`.
  2. If `navigator.canShare?.({ files: [file] })` → `navigator.share({ files: [file], title, text, url })`.
  3. Else if `navigator.share` → `navigator.share({ title, text, url })` (Level-1 fallback).
  4. Else → copy `url` to clipboard (existing fallback).
  - If the blob isn't ready yet, fall straight to step 3 (never block on generation).
- **Share text** ties in the rank: `Our camp reached <total>/60 — <rankTitle>. Build your camp's Green Radius:` (url passed separately).

## Feature 2 — Per-camp OG unfurl

- **URL format:** share/email URL becomes `/result/?r=<hash>`. The client reads `?r=`
  first, `#hash` as fallback (Feature is backward-compatible with old `#`-only links,
  which simply won't get a rich unfurl).
- **Worker route:** on `GET /result/?r=<hash>`:
  - `decode(hash)` via the imported `result-state.js`; on `null`, pass through.
  - `campName` from the decode; `total = Σ fills[sectorId].totalYes` (0–60);
    `rank = Rank.titleFor(total)`.
  - Fetch the asset (`env.ASSETS.fetch(request)`), pipe through `HTMLRewriter`:
    - `meta[property="og:title"]` content → `<Camp>'s Green Radius` (or `Our Green
      Radius` when campName is empty).
    - `meta[property="og:description"]` content → `Reached <total>/60 — <rank>. See the
      card and build your own at greenradi.us.`
  - `og:image` stays the static `og-card.png` (no headless render available in
    Workers; per-camp image is explicitly out of scope).
- **Safety:** `HTMLRewriter.setAttribute` escapes the attribute value, so the camp
  name needs no manual HTML-escaping; still **length-cap** campName (e.g. ≤ 80) before
  inserting. `safeResultUrl` is unaffected — it checks `pathname === '/result/'`, and
  the query/fragment don't change the pathname, so emailed `?r=` links still validate.
- **Fail-open everywhere:** any missing param, decode error, or rewrite issue → serve
  the unmodified static page. The unfurl degrading to the generic card is acceptable;
  a broken result page is not.

## Feature 3 — Playa-rank titles

- `Rank.titleFor(total)` where `total` = sum of the six `greens` (each 0–10) on the
  done screen, and `Σ fills[sectorId].totalYes` in the Worker. Same function, same
  bands, both sides.
- **Done-screen placement:** a headline near the result summary, e.g.
  "Your camp is a **Wide Beacon** · 38/60". In-app only — the card image is untouched.
- Reused verbatim in the Share text (Feature 1) and the OG description (Feature 2).

## Feature 4 — Green-Up Plan

- **Derivation:** walk `window.SECTORS` in board order. For each sector, iterate
  `sector.levels` (index `i` → level `i+1`; indices 0–2 hold the fixed L1–L3 questions)
  plus `sector.tier4Topics` (level 4). For any item whose id has `answers[id] === 'no'`,
  emit a step `{ sectorName, level, title, link }`.
- **Presentation:** grouped by sector (sectors with ≥1 gap only), within a sector
  ordered by level ascending. Each step renders `L<n> · <title>` and, when the item
  has a `link`, a trailing link affordance (→). Matches the approved "Full plan" mock.
  - Step **descriptions are NOT shown inline** in this MVP (keeps the panel scannable;
    the link leads to detail). Listed under Deferred.
- **Collapse:** a single toggle for the whole panel, **collapsed by default**, with an
  accessible button (`aria-expanded`). Collapsed label includes the count, e.g.
  "Your Green-Up Plan · 4 ideas".
- **Empty state:** if there are zero `'no'` answers, the component renders `null` — no
  panel, no copy.
- **Scope guard:** mounted only in the done-screen (`green-radius.jsx`) render path —
  **never** imported or rendered by `result/index.html`. The plan is private to the
  player; it is not part of the shareable result.

## Privacy (disclosed tradeoff)

Moving the hash into `?r=` means the result (campName + per-sector yes/no counts)
becomes readable by the Worker, where today it lives only in the `#fragment` and never
reaches a server. We will **not** add any logging of `?r=`, but Cloudflare's platform
request logs may still record full request URLs — so "never logged" cannot be fully
guaranteed. This is acceptable because the same data already lands in the Google Sheet
on completion and is visible to anyone the camp shares the link with; the marginal new
exposure is Worker-log visibility of low-sensitivity data. This will be stated in
`docs/architecture.md` alongside the route.

## Testing & verification (repo norms: Bun only — no Node, no `curl`)

- **Parse gate:** `bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null` (exit 0).
- **Isomorphic smoke (`bun -e`):**
  - `Rank.titleFor` at band boundaries (0, 10, 11, 50, 51, 60) and clamps (-5, 99).
  - Round-trip: `decode(encode({campName, fills}))` and confirm the Worker's
    `total = Σ totalYes` matches the client's `greens` sum for a sample.
- **Worker OG:** unit-test the rewrite logic with a `bun -e` harness feeding a sample
  HTML string through `HTMLRewriter` (available in `workerd`/Bun) and asserting the
  rewritten `og:title`/`og:description`; plus reasoning for the routing guard.
- **Manual / real-device:** the existing T-1 launch drill already covers PNG share on
  a real iPhone (the Safari export net) and the OG unfurl in iMessage — see
  [[runbook-day-one]] §2 steps 4 and 6.

## Out of scope / deferred

- **Per-camp OG image** — stays the static `og-card.png` (no headless render in Workers).
- **Rank title on the shared card image** — card is unchanged this PR.
- **Green-Up step descriptions inline** — title + link only for now.
- **A2 palette pass, R4 nonce** — separate roadmap items, not bundled here.
