# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Green Radius Game — a self-ranking sustainability game for Burning Man theme camps, live at **https://greenradi.us**. It's a **no-bundler static app** (Preact + preact/compat UMD served same-origin from `vendor/`, exposed as `window.React`/`window.ReactDOM` by a shim; the game's `.jsx` sources are precompiled to classic-runtime JS under `dist/` by a small Bun script, `scripts/build.js`) fronted by one tiny Cloudflare Worker.

> **Merging to `main` deploys to production instantly.** There is no staging. `main` is branch-protected (PR required, 0 approvals), and **HSTS preload is active — the site must never go offline.** Never force-push or delete `main`. PRs are squash-merged.

## Start here

The deep knowledge already lives in three docs — read the relevant one before changing anything:

- **`docs/roadmap.md`** — the single backlog. Build only items listed under its
  "Approved" section, in order; Wes sets priority by editing that file. Don't
  start Proposed/Shelved items without an explicit ask, and record newly agreed
  work there rather than in session memory.
- **`docs/architecture.md`** — the end-to-end wiring map: data flow, the `/api/complete` contract, external integrations (Apps Script, Resend, Cloudflare), and hard-won gotchas. Read this before touching anything that crosses component/file boundaries. Update it when the *wiring* changes (not for UI-only tweaks).
- **`CONTRIBUTING.md`** — file-by-file layout, local-dev setup, and the contribution/branch flow.
- **`README.md`** — project overview, stack, deploy.

## Commands

There is **no package.json, no bundler, and no linter.** A tiny Bun compile step (`scripts/build.js`) builds the committed `dist/` artifacts from the `.jsx` sources, and CI (`.github/workflows/ci.yml`) enforces it via a compile+diff gate plus `bun test`. Verification is the compile gate below plus manual gameplay in a browser.

```bash
# Serve the UI (any static server; file:// will NOT work — browsers block cross-origin <script src> reads)
python3 -m http.server 8000        # → http://localhost:8000

# The only automated check: recompile every game script to dist/ and confirm the committed artifacts don't drift.
bun run scripts/build.js && git status --porcelain -- dist   # second command must print nothing — dirty dist = stale build
bun test

# Exercise the Worker / POST /api/complete locally (needs Node + a .dev.vars file; the UI does NOT need it)
npx wrangler dev

# Manual deploy, if ever needed (normally you just merge to main)
npx wrangler deploy
```

To "test" a change: run the compile gate (build + diff), then load it in a browser and play through. Mobile layout bugs don't show at desktop widths — check a phone-sized viewport (e.g. 390×667).

## Architecture in one screen

Full map is in `docs/architecture.md`; the essentials:

- **Entry:** `index.html` loads the Preact runtime (core + hooks + compat + shim, vendored, same-origin, no CDN; the shim exposes `window.React`/`window.ReactDOM`) plus the precompiled `dist/*.js` game scripts (classic `React.createElement` JS, built from the `.jsx` sources by `scripts/build.js` — no in-browser Babel), defines `PALETTE`, and mounts `<GreenRadiusGame variant="flat-playa" palette={PALETTE}/>`.
- **The game UI is nine compiled scripts in one shared global scope** (split from the old `green-radius.jsx` monolith in PR #55): `src/core.jsx` (hooks, constants, persistence, per-question scoring — loads **first**), `src/fx.jsx` (canvas particle FX), `src/badge.jsx` (`SectorIcon`, arc geometry, `RadialBadge`), `src/wheel.jsx`, `src/question-flow.jsx` (question modal, toast, celebration), `src/share-card.jsx` (PNG export, `ShareCard`, `ResultCardSVG`), `src/home.jsx` (FAQ modal, mode picker), `src/form-mode.jsx`, and `green-radius.jsx` (`GreenRadiusGame` + intro + done/email screen with the Green-Up Plan — loads **last**). Each compiles 1:1 to `dist/src/*.js` / `dist/green-radius.js`; `index.html` loads all nine `dist/` scripts in that order; `result/`, `city/`, and `admin/` load only the subset they render (`core` + `badge`, plus `share-card` on `result/`) — `src/core.jsx` always first. Components reference each other by **bare name** within the shared global scope (see gotcha below).
- **Two plain scripts create the only real globals:** `game-data.js` → `window.SECTORS` (6 sectors × 4 tiers of Yes/No content) and `result-state.js` → `window.ResultState` (encode/decode a result to/from the result-link payload). `game-data.js` is isomorphic and is also imported by the Worker (the completion email's headline + Green-Up Plan). (`rank.js` → `window.Rank`, retired in #66, was deleted in #70.)
- **One Worker, five dynamic routes:** `worker/index.js` handles `POST /api/complete`, `GET /api/admin/responses`, `GET /api/health` (uptime-monitor liveness probe), `GET /api/city` (public aggregate-only city tally, colo-cached 5 min, stale-on-error; allowlisted fields only — never add camp-identifying fields), and `GET /result/?r=<payload>` (per-camp OG unfurl — decodes the share payload with `result-state.js` and rewrites `og:title`/`og:description` via `HTMLRewriter`, fail-open; the image stays the static `og-card.png`), and serves everything else as static assets (`ASSETS` binding, `wrangler.jsonc`). Because Static Assets are served before the Worker by default, `wrangler.jsonc` sets `assets.run_worker_first: ["/result/"]` so the Worker runs first for that one route — drop it and the OG rewrite goes dead. `/api/complete` does two things best-effort in parallel — append a row to a Google Sheet (via an Apps Script web app) and email the player their result link (via Resend) — and returns `{ sheet, email }`.
- **Shareable result page:** `result/index.html` decodes the result payload from the `?r=` query param client-side (legacy `#hash` still accepted as a fallback) and renders a read-only `<ShareCard>`. Works even with the Worker down (the Worker only layers per-camp OG meta on top).
- **Public city page:** `city/` renders the whole city's aggregate wheel from `GET /api/city` (same `RadialBadge` aggregate mode as the admin City tab). Aggregate-only by design; the Worker allowlists every field it returns.
- **Admin viewer (internal):** `admin/` (`index.html` + `admin.jsx` + `aggregate.js`) is a read-only response viewer (City + Camps tabs) at `/admin/`, gated by **Cloudflare Access**; the Worker re-validates the Access JWT on `GET /api/admin/responses` before proxying the Apps Script `doGet`. Reuses `RadialBadge` like `result/` does. See `docs/admin-setup.md`.

## Conventions & gotchas that will bite you

- **Shared global scope.** The compiled `dist/*.js` game scripts are plain classic `<script>`s (no modules, no imports), so components in the game scripts (`src/*.jsx`, `green-radius.jsx`) are referenced by **bare name** across scripts. Compiling with `Bun.Transpiler` still evaluates each script globally with `const`→`var` downleveling under the hood, so these top-level names do technically land on `window` — but only on pages whose `<script>` list includes the module that defines them, so nothing should rely on the `window` attachment. Always reference by bare name, and make sure the defining script is loaded on that page; plain scripts that assign `window.X = …` (`window.SECTORS`, `window.ResultState`) remain the only intentional globals. Mounting a component as `window.ShareCard` on a page that never loads `green-radius.jsx` (like `result/`) → `undefined` → renders nothing (this was a real bug — the defining script simply wasn't loaded there).
- **The `greens` shape is the contract.** `{ food, water, waste, transport, shelter, power }`, each `0–10` (total Yes per sector), threads through game → Worker → sheet columns → email. The *graphic* uses per-question `fills` (carried in the v2 `?r=` result payload), not `greens`; `greens` is just the headline tally number. Change the shape in one place and you must change it everywhere.
- **`localStorage` versioning.** Save key is `green-radius-game/v1`; bump `STORAGE_VERSION` (in `src/core.jsx`, currently `7`) whenever the saved shape changes — `loadSaved` discards any save whose version doesn't match. Purely additive shape changes (e.g. new optional keys in the answers/notes maps) don't need a bump.
- **Tactile buttons: `.grg-press`/`.grg-press-sm`.** Shared CSS classes (`index.html`) give buttons a hard drop-shadow "foot" that compresses on press; the shadow color comes from a `--grg-sh` custom property set per-instance in the game scripts (a class's `box-shadow` can't otherwise be overridden per-instance). Add the class without setting `--grg-sh` and the button loses its shadow color.
- **Worker degrades gracefully — keep it that way.** Missing secrets → the sheet/email steps return `false` → the endpoint returns `err`, but the static site still serves and the share link still works. Don't make the share/keepsake path depend on the backend. `safeResultUrl` pins the emailed link to host `greenradi.us`/`localhost` + path `/result/` — don't loosen it (anti-XSS/phishing). Submitted free text is bounded + run through `sheetCell` (formula-injection guard) before it reaches the sheet; the origin check is **fail-closed** (absent Origin is rejected). Real abuse throttling is a Cloudflare WAF rule (owner-side), not in this file.
- **workers.dev is off; preview URLs are on and Access-gated.** `wrangler.jsonc` pins `workers_dev: false` (workers.dev hosts skip the zone's WAF/rate-limiting/Access while running with production secrets) and `preview_urls: true` (branch-push preview URLs for PR review, behind a Cloudflare Access email allowlist). Don't flip either flag: re-enabling `workers_dev` reopens the bypass host, and removing `preview_urls` kills branch previews because its default follows `workers_dev`.
- **`.assetsignore`, not `.gitignore`, controls what's served.** `assets.directory = "."` means the repo root is public; wrangler's asset uploader ignores `.gitignore`, so anything that must not be served belongs in `.assetsignore`: secrets/local state (`.git`, `.dev.vars*`, `.claude/`, `.remember/`, `.superpowers/`) plus — for prod-domain hygiene, since the repo is public on GitHub anyway — the source/config/docs that have no reason to be fetched from the live domain (`worker/`, `docs/`, `wrangler.jsonc`, `CLAUDE.md`, `src/`, the root `green-radius.jsx`). Leave the runtime-fetched paths in (`vendor/`, `game-data.js`, `result-state.js`, `dist/`, `og-card.png`, `downloads/`) — `dist/` must stay served, since the HTML entry points load the game from there. `scripts/` (the build tool) is excluded, same rationale as `worker/`/`docs/`. This is also what makes a local `npx wrangler deploy` safe. Verify `https://greenradi.us/.git/config` → 404 after deploys. **Anchor path patterns with a leading `/`** — entries follow gitignore semantics, so an unanchored name matches at any depth: unanchored `src` also matched `dist/src/` and took the game down for ~15 minutes (#70, hotfixed in #71). No local server reads this file, so after any change to it, verify the live URL matrix post-deploy (the `dist/` scripts still 200, every excluded path 404s).
- **The runtime is vendored.** Preact 10.29.7 (core + hooks + compat UMDs + the first-party `preact-compat-shim-*.js` that exposes `window.React`/`window.ReactDOM`, since #91) lives in `vendor/` (versioned filenames) and loads same-origin with `defer`, in that order, in all four HTML files — never edit the vendored files; to upgrade, follow `vendor/README.md` (download the pinned URLs, verify bytes, update all four entry points). `vendor/babel-standalone-*.min.js` was deleted in #70 (no entry point had loaded it since #63 — the game scripts load from `dist/` instead). The `defer` also lets the in-`#root` loading placeholder paint while scripts download — don't remove it.
- **Match the existing copy style.** Recent FAQ/UI copy intentionally avoids em dashes; follow the surrounding tone and punctuation when editing user-facing strings.
- **Add a `CHANGELOG.md` entry in every PR.** One bullet under the current (top) milestone section, newest first, ending with the PR number (`(#68)`); start a new `##` section when a new milestone begins. Same commit as the `APP_VERSION` stamp is a natural place for it.
- **Bump `APP_VERSION` in every PR.** It's the tiny deploy stamp at the bottom of the home screen (`src/core.jsx`); set it to the PR number (`v44`, `v45`, …) so anyone can tell which release is live. `APP_VERSION` lives in the `.jsx` source, so after editing it you must `bun run scripts/build.js` to refresh `dist/` — the deployed page reads the compiled artifact, not the source.

## Secrets (hard rule)

The three Worker secrets — `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY` — and any of their **values** (the Apps Script `/exec` URL, the shared secret, the Resend key) must **never** be committed to the repo or written anywhere in it. They live only as Cloudflare Worker secrets (prod) or in a git-ignored `.dev.vars` (local). `.dev.vars.example` and `docs/architecture.md` contain only the secret **names**, never values.
