# Green Radius Admin Viewer — Design

**Date:** 2026-06-05
**Status:** Approved 2026-06-05 (brainstormed with the visual companion). Building.
**Branch:** `admin-viewer` — its own branch/PR off `main`, separate from PR #32.

## Goal

A gated, internal tool for the GTCC team to **(B) recognize and reflect** the community's
collective progress and **(D) review camp submissions** one at a time. Two tabs at
`greenradi.us/admin/`, behind Cloudflare Access, reusing the game's components and the single
`window.SECTORS` schema:

- **Together** — the community tally (aggregate).
- **City** — per-camp review (the camps that make up Black Rock City).

## Audience & priorities

- **Internal GTCC team only**, behind Cloudflare Access. A public `/stats/` page may follow later,
  so the aggregate view is built **PII-free and standalone** for reuse.
- **Primary jobs:** B (recognize/reflect) + D (review applications).
- **De-prioritized** (confirmed): gap-finding (A), upward reporting (C), year-over-year trends
  (2026 is the baseline year).
- **Aesthetic:** dark, glowing, warm-communal — "quirky but optimized." Personality through copy
  and an explorable circle, not mascots/emojis. Grounded in the app's existing voice
  ("community tally," "celebrate progress together," the sector Celebration moment).

## Non-goals (YAGNI)

- No write-back (status / notes / flags) — **read-only**.
- No export (not yet).
- No roster / "not yet submitted" tracking — the list is **submissions to date**.
- No year-over-year trends.
- The public `/stats/` page itself (we only design the aggregate piece for reuse).

## Architecture

Follows the repo's no-build conventions: React 18 UMD + `@babel/standalone`; components in
`green-radius.jsx` are referenced by **bare name** in the shared Babel scope (not `window`
properties). Data shaping is **client-side** (chosen approach): the Worker is a thin,
authenticated proxy.

### Data flow

```
Cloudflare Access (edge, email allowlist) gates /admin* and /api/admin*
        │  (only allow-listed emails reach the Worker; adds Cf-Access-Jwt-Assertion header)
        ▼
Browser /admin/  ──fetch──▶  Worker  GET /api/admin/responses
        ▲                      │  1. verify Access JWT (aud + team certs); 403 if invalid
        │                      │  2. GET Apps Script doGet (shared secret, server-to-server)
        │                      │  3. return { rows:[…] } as JSON (no-store)
        └──────────────────────┘
Browser: compute aggregates (Together) + render City list/detail — all client-side, one fetch.
```

The static `/admin/` assets are gated by Access at the edge; the Worker additionally validates the
JWT on the API because the response carries PII (emails).

### Files

- **Create** `admin/index.html` — loads React + ReactDOM + Babel (CDN), then `game-data.js`,
  `green-radius.jsx` (for `RadialBadge`/`ShareCard` and the `sectorFill`/`fillsFromAnswers`
  helpers), and `admin/admin.jsx`; mounts `<AdminApp/>`. Mirrors `result/index.html`. (No
  `result-state.js`: the result link uses each row's stored `resultUrl`.)
- **Create** `admin/admin.jsx` — the admin UI (text/babel): shell + tabs, the Together view, the
  City view, the data hook, and pure aggregation helpers.
- **Modify** `green-radius.jsx` — extend `RadialBadge` with two **optional, backward-compatible**
  capabilities (see below): an aggregate "heatmap" mode and click interactivity.
- **Modify** `worker/index.js` — add `GET /api/admin/responses` (JWT verify + doGet proxy).
- **Modify** `wrangler.jsonc` — add non-secret vars `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`.
- **Modify** `docs/architecture.md` — document the admin read path + Access integration.
- **External (not in repo):** Apps Script `doGet`; the Cloudflare Access application.

## Components

- **`AdminApp`** — shell: header (brand, year filter defaulting to 2026, `Together | City` tabs),
  a `useResponses()` hook that fetches once and holds rows, tab routing, and loading / error /
  empty states. Owns the year + source filters (applied client-side).
- **`CommunityTally`** (PII-free, `/stats/`-reusable) — the **Together** view. Renders the
  collective `RadialBadge` (aggregate mode) with tap-through, the **Reaching Furthest** leaderboard,
  **Sector Standings**, the headline tally, and the momentum stat. Takes already-computed aggregates
  as props (no fetching, no PII beyond camp names — see note).
  - *`/stats/` note:* the **leaderboard names camps**, so it is a separable sub-piece that a public
    page can hide or anonymize; the radius + standings + tally are public-safe as-is.
- **`CityView`** — per-camp review. A searchable / sortable list (+ source filter) → a detail panel:
  the camp's own `RadialBadge` (boolean mode) + total, every answer as compact ✓/✗ tokens grouped by
  sector (gold ★ on maxed sectors), Level-4 picked topics named, and actions **Email** (mailto) +
  **Green Radius result link** (their `/result/#…` page — the `resultUrl` stored on the row).
- **Aggregation helpers** (pure functions in `admin.jsx`) — `rows → { tallyPct, totals, leaderboard,
  sectorStandings, perQuestionYesRate, momentum }`, using `window.SECTORS` for ids/labels. Pure and
  unit-testable; tolerate rows with missing `answers`.

## `RadialBadge` changes (optional props, backward-compatible)

Today `RadialBadge` renders one camp's boolean per-question fills in the level colors. Add:

1. **Aggregate / heatmap mode** — accept a per-segment **intensity (0–1)**; render each segment in
   its level color at opacity ∝ intensity. Used by the collective radius. Boolean mode is unchanged
   and still used by City detail (a single camp) and `result/`.
2. **Interactivity** — optional `onSelectSector` / `onSelectSegment` callbacks + a highlighted slice,
   for the Together tap-through (overview → sector → question). Non-interactive by default.

All new props are optional, so `result/index.html` and the game render exactly as before.

## Endpoint contract — `GET /api/admin/responses`

- **Edge:** behind Cloudflare Access; only allow-listed emails reach the Worker.
- **Worker:**
  1. Read `Cf-Access-Jwt-Assertion`. Verify the signature against
     `https://<CF_ACCESS_TEAM_DOMAIN>/cdn-cgi/access/certs`, that `aud === CF_ACCESS_AUD`, and that
     it is unexpired. On any failure → **403**.
  2. `GET` the Apps Script `doGet` with the shared secret (server-to-server; follows the 302 like
     the existing `doPost` call does).
  3. Return `{ rows: […], count }` as JSON with `Cache-Control: no-store`. Bound the row count
     defensively (data is small — low hundreds).
- **Row shape** (mirrors the `doPost` columns):
  `{ timestamp, campName, leadName, email, year, greens:{food,water,waste,transport,shelter,power}
  (0–10), total, source:'board'|'form', resultUrl, answers:{[qid]:'yes'|'no'}, schemaVersion }`.
  The Worker `JSON.parse`s `answers_json` inside try/catch and tolerates blanks (→ `{}`).

## Apps Script `doGet` (external — provided in the plan)

Same project/deployment as `doPost` (one `/exec` URL serves GET + POST). Shape:

```js
function doGet(e) {
  if (e.parameter.secret !== SHARED_SECRET)         // SHARED_SECRET lives only in the script
    return json_({ ok: false });
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('2026 Results');
  var values = sh.getDataRange().getValues();
  var header = values.shift();
  var rows = values.map(function (r) { /* map columns → object; JSON.parse the answers_json cell */ });
  return json_({ ok: true, rows: rows });
}
```

Exact column mapping goes in the implementation plan. The secret travels as a query param over
HTTPS, **server-to-server from the Worker only** — never exposed to the browser. The plan will note
keeping the web-app access setting unchanged from `doPost`; the shared secret + Access are the gates.

## Cloudflare Access setup (external — provided in the plan)

1. Zero Trust → Access → Applications → **Self-hosted**: domain `greenradi.us`, paths `/admin`
   and `/api/admin`.
2. Policy: **allow** specific GTCC emails (Google sign-in or one-time PIN).
3. Copy the Application **Audience (AUD)** tag and the team domain
   (`<team>.cloudflareaccess.com`).
4. Set Worker vars `CF_ACCESS_AUD` and `CF_ACCESS_TEAM_DOMAIN` (config, not secrets) for JWT
   validation.

## Responsive design

Mobile-first; desktop reflows to **denser**, not bigger.

- **Together:** mobile = circle then stacked text with tap-to-reveal question detail; desktop =
  circle beside an all-visible stats panel (less tapping).
- **City:** mobile = list → full-screen detail (back); desktop = two-pane (list + detail, mail-client
  style).
- Layout switches via CSS media queries / a width hook in `admin.jsx`.

## Error / empty / degraded states

- **Loading:** lightweight skeleton/spinner.
- **Fetch error** (Worker or Apps Script down): friendly message + **Retry**.
- **403** (defensive; shouldn't occur behind Access): "Not authorized."
- **No responses for the year:** empty state ("No camps yet for 2026").
- **Granular data absent** (before PR #32 + the Apps Script `doPost` update):
  - *City detail* — radius (an approximate contiguous fill from the sector totals when `answers`
    are absent), scores, metadata, and contact all render; the ✓/✗ token grid is replaced by
    "Per-answer detail appears once granular capture is live."
  - *Together* — leaderboard, Sector Standings, and the tally render from `greens`; the per-question
    Yes-rate detail and the radius heatmap shading show an "awaiting data" treatment (uniform shading
    + note).
- **Mixed schema** (legacy `greens` 0–4 rows vs. post-#32 0–10): the viewer targets the **0–10**
  model and keys off `schemaVersion`; older rows simply display low on the 0–10 scale. Acceptable
  given 2026 is the baseline.

## Dependencies & sequencing

- Own branch/PR off `main`, separate from PR #32.
- **Ships independently** and is useful day one from today's columns (scores, leaderboard, the
  radius, contact).
- **Full functionality** (✓/✗ detail, per-question rates, heatmap) requires the granular pipeline:
  PR #32 merged (Worker sends `answers` + `greens` 0–10) **+** the Apps Script `doPost` updated
  (`answers_json`, `schema_version`) **+** the new `doGet`.
- **Recommendation:** implement after PR #32 merges, so the post-#32 `RadialBadge` (per-question
  fills) + 0–10 scores are the baseline; cut/rebase `admin-viewer` on post-#32 `main`.

## Security

- PII (emails) gated by **Cloudflare Access** (edge) + **Worker JWT validation** (API).
- The Worker never exposes `SHEETS_WEBAPP_URL` or `SHEETS_SHARED_SECRET` to the client
  (server-to-server only). `CF_ACCESS_AUD` + `CF_ACCESS_TEAM_DOMAIN` are non-secret config.
- **No secret values in the repo** (hard rule) — only names. The response is `no-store`.

## Testing & verification

- **Parse gate:** `bun build admin/admin.jsx --external react … > /dev/null` (exit 0); same for
  `green-radius.jsx` and `worker/index.js`.
- **Aggregation helpers (pure):** unit checks — rows → expected tally %, leaderboard order, sector
  averages, per-question Yes-rates, momentum; include a row with empty `answers` (degraded) → no
  crash.
- **`RadialBadge`:** aggregate mode renders intensities; boolean mode unchanged (`result/` + game
  still render correctly).
- **Worker:** JWT verification unit (valid passes; bad `aud` / expired / missing → 403); doGet proxy
  shaping (maps columns, parses `answers_json`, tolerates blanks).
- **Playwright (bun + chromium):** load `/admin/` with a **mocked** `/api/admin/responses`
  (sample rows, with and without `answers_json`) → Together aggregates correct + tap-through works;
  City search/sort + detail (radius, ✓/✗ tokens, Email mailto href, result-link href); test at
  desktop **and** mobile viewports; assert no page errors.

## Open questions / assumptions

- **2026 baseline** (no year-over-year) — assumed; revisit if old BLAST/Forms data is imported.
- **Leaderboard names camps** internally (approved); anonymize for a future `/stats/`.
- **Momentum** ("+N this week") computed from row timestamps.
