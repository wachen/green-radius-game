# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Green Radius Game — a self-ranking sustainability game for Burning Man theme camps, live at **https://greenradi.us**. It's a **no-build static app** (React 18 via UMD CDN + in-browser JSX through `@babel/standalone`) fronted by one tiny Cloudflare Worker.

> **Merging to `main` deploys to production instantly.** There is no staging. `main` is branch-protected (PR required, 0 approvals), and **HSTS preload is active — the site must never go offline.** Never force-push or delete `main`. PRs are squash-merged.

## Start here

The deep knowledge already lives in three docs — read the relevant one before changing anything:

- **`docs/architecture.md`** — the end-to-end wiring map: data flow, the `/api/complete` contract, external integrations (Apps Script, Resend, Cloudflare), and hard-won gotchas. Read this before touching anything that crosses component/file boundaries. Update it when the *wiring* changes (not for UI-only tweaks).
- **`CONTRIBUTING.md`** — file-by-file layout, local-dev setup, and the contribution/branch flow.
- **`README.md`** — project overview, stack, deploy.

## Commands

There is **no package.json, no build step, no test runner, no linter, and no CI.** Verification is the parse gate below plus manual gameplay in a browser.

```bash
# Serve the UI (any static server; file:// will NOT work — browsers block cross-origin <script src> reads)
python3 -m http.server 8000        # → http://localhost:8000

# The only automated check: compile-gate the JSX. Exit 0 = clean parse.
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null

# Exercise the Worker / POST /api/complete locally (needs Node + a .dev.vars file; the UI does NOT need it)
npx wrangler dev

# Manual deploy, if ever needed (normally you just merge to main)
npx wrangler deploy
```

To "test" a change: run the parse gate, then load it in a browser and play through. Mobile layout bugs don't show at desktop widths — check a phone-sized viewport (e.g. 390×667).

## Architecture in one screen

Full map is in `docs/architecture.md`; the essentials:

- **Entry:** `index.html` loads React + `@babel/standalone`, defines `PALETTE`, and mounts `<GreenRadiusGame variant="flat-playa" palette={PALETTE}/>`.
- **The whole game UI is one file:** `green-radius.jsx` (~1850 lines) — wheel, question modal, form mode, result/share card, done+email screen, home FAQ modal. Components reference each other by **bare name** within a shared Babel scope (see gotcha below).
- **Two plain scripts create the only real globals:** `game-data.js` → `window.SECTORS` (6 sectors × 4 tiers of Yes/No content), `result-state.js` → `window.ResultState` (encode/decode a result to/from the URL hash).
- **One Worker, one dynamic route:** `worker/index.js` handles `POST /api/complete` and serves everything else as static assets (`ASSETS` binding, `wrangler.jsonc`). The completion does two things best-effort in parallel — append a row to a Google Sheet (via an Apps Script web app) and email the player their result link (via Resend) — and returns `{ sheet, email }`.
- **Shareable result page:** `result/index.html` decodes the URL hash client-side and renders a read-only `<ShareCard>`. Works even with the Worker down.

## Conventions & gotchas that will bite you

- **Babel shared scope.** Every `<script type="text/babel">` runs in one shared scope, so components in `green-radius.jsx` are referenced by **bare name** across babel scripts — they are **not** `window` properties. Only plain scripts that assign `window.X = …` create globals (`window.SECTORS`, `window.ResultState`). Mounting a component as `window.ShareCard` → `undefined` → renders nothing (this was a real bug).
- **The `greens` shape is the contract.** `{ food, water, waste, transport, shelter, power }`, each `0–10` (total Yes per sector), threads through game → Worker → sheet columns → email. The *graphic* uses per-question `fills` (carried in the v2 URL hash), not `greens`; `greens` is just the headline tally number. Change the shape in one place and you must change it everywhere.
- **`localStorage` versioning.** Save key is `green-radius-game/v1`; bump `STORAGE_VERSION` (in `green-radius.jsx`) whenever the saved shape changes — `loadSaved` discards any save whose version doesn't match.
- **Worker degrades gracefully — keep it that way.** Missing secrets → the sheet/email steps return `false` → the endpoint returns `err`, but the static site still serves and the share link still works. Don't make the share/keepsake path depend on the backend. `safeResultUrl` pins the emailed link to host `greenradi.us`/`localhost` + path `/result/` — don't loosen it (anti-XSS/phishing).
- **Match the existing copy style.** Recent FAQ/UI copy intentionally avoids em dashes; follow the surrounding tone and punctuation when editing user-facing strings.

## Secrets (hard rule)

The three Worker secrets — `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY` — and any of their **values** (the Apps Script `/exec` URL, the shared secret, the Resend key) must **never** be committed to the repo or written anywhere in it. They live only as Cloudflare Worker secrets (prod) or in a git-ignored `.dev.vars` (local). `.dev.vars.example` and `docs/architecture.md` contain only the secret **names**, never values.
