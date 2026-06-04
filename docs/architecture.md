# Architecture

How the Green Radius Game fits together end-to-end: the data flow, the contracts
between pieces, the external integrations, and the gotchas worth knowing before
you change anything.

This is the **current-state** map. It is *not* a changelog (see git history / PR
titles) or a per-feature design archive (see `docs/superpowers/plans/`).
**Update this doc when the wiring changes** — data flow, the `/api/complete`
contract, an external integration, or a gotcha — not for every feature tweak.

For the file-by-file layout and local-dev setup, see [CONTRIBUTING.md](../CONTRIBUTING.md).

## At a glance

- **No-build static app.** `index.html` loads React 18 + ReactDOM (UMD CDN) +
  `@babel/standalone`, which compiles the JSX *in the browser*, then mounts
  `<GreenRadiusGame/>`.
- **One small Cloudflare Worker.** `worker/index.js` handles exactly one dynamic
  route — `POST /api/complete` — and serves everything else as static assets (the
  `ASSETS` binding in `wrangler.jsonc`, directory `.`).
- **Deploy = merge to `main`.** Cloudflare Workers + Static Assets auto-deploys
  `main` to https://greenradi.us. No staging environment.

## End-to-end data flow

The game and the result-capture backend are wired through one shared shape: a
per-sector **green count** (`0–4`).

```
play game / form  →  done screen  ─┬─►  result-state.encode()  →  /result/#<hash>   (share link, client-only)
   (green-radius.jsx)              │
                                   └─►  POST /api/complete (worker/index.js)
                                          ├─► appendToSheet → Apps Script web app → "2026 Results" tab
                                          └─► sendEmail     → Resend → emails the /result/ link
                                        returns { sheet: ok|err, email: sent|err }

/result/ (result/index.html):  decode(location.hash) → <ShareCard> (read-only, stateless)
```

1. **Play** (`green-radius.jsx`). Each spin plays a whole sector's 10 questions
   across 4 tiers. **Scoring is per-point:** 1 point per Yes (up to 6 fixed +
   up to 4 Tier-4, capped at 4), and the sector's Yes count maps to a contiguous
   radius depth (0–4) via cumulative bands `[1,3,6,10]` (`scoreSector`). A single
   early No no longer zeroes the sector — later Yes answers compensate. Board and
   form share this one rule. Six spins (one per sector) complete the game. State
   lives in React and is persisted to `localStorage` (`STORAGE_KEY =
   green-radius-game/v1`); bump `STORAGE_VERSION` when the saved shape changes so
   old saves are discarded.
2. **Done screen.** Required, validated email. The submit builds
   `greens[sectorId] = count of 'green' levels` from `levelStates`. Every
   individual answer is also kept in the shared `answers` map
   (`{questionId: 'yes'|'no'}`, Tier-4 keyed by the picked topic id).
3. **Two outputs:**
   - **Share link (from `greens` only)** — `result-state.js`
     `encode({campName, leadName, year, greens})` → base64url in the URL hash →
     `https://greenradi.us/result/#<hash>`. Pure client; works even with the
     Worker down. **The hash never carries the granular answers.**
   - **`POST /api/complete`** — `{campName, email, year, greens, mode, answers,
     schemaVersion, resultUrl}`. `answers` is backend-only (→ sheet), never in the hash.
4. **Worker** (`worker/index.js`) validates (origin check, body-size cap,
   honeypot, required `campName`+`email`, email regex), then does two things
   **independently, best-effort, in parallel**, and returns `{sheet, email}`.
5. **`/result/`** (`result/index.html`) decodes the hash and renders `<ShareCard>`
   read-only, reconstructing `levelStates` from the green counts via
   `ResultState.greensToLevelStates`.

## Integration contracts (don't break these)

- **The `greens` shape is the contract.** `{ food, water, waste, transport,
  shelter, power }`, each `0–4`, threads through the game → `result-state`
  encoding → the Worker → the sheet's per-sector columns → the email. Change it in
  one place and you must change it everywhere.
- **Invariant: greens are a contiguous prefix.** A sector resolves to one depth
  (its Yes count banded via `[1,3,6,10]`), rendered as a contiguous green prefix —
  so radius depth == green count still holds, and `result-state` keeps storing only
  the *count* per sector. (Held through the #22 whole-sector redesign and the
  per-point scoring change: the count is now derived from the band map rather than
  a consecutive chain, but it is still a single contiguous depth — so the hash and
  the result page are unchanged. The full per-question detail lives only in the
  sheet, never the hash.)
- **The Worker degrades gracefully.** Missing secrets → `appendToSheet` /
  `sendEmail` return `false` → the endpoint returns `err`, but the static site
  still serves. The share/keepsake path never depends on the backend.
- **`safeResultUrl`** pins the emailed link to host `greenradi.us`/`localhost` +
  path `/result/` and escapes the href — don't loosen it (anti-XSS/phishing in the
  outbound email).

## External integrations

- **Google Apps Script** (owner-side, *container-bound* to the master
  spreadsheet). `doPost` verifies a shared secret, then `appendRow` to the
  **`2026 Results`** tab (now 16 cols: Timestamp · Camp · Lead · Email · Year · 6
  sectors · Total · Source · Result URL · **answers_json** · **schema_version**).
  The Worker sends `answers` (the full `{qid:'yes'|'no'}` map) + `schemaVersion`;
  the owner-side script must add those two columns and append them — a manual,
  external change (see `docs/superpowers/specs/2026-06-04-…-design.md`). Quirks: a `/exec` POST returns
  **302 → script.googleusercontent.com**; Cloudflare's `fetch` follows it
  correctly (plain `curl` mishandles it). One `doPost` per project, and
  `getActiveSpreadsheet()` requires a container-bound script.
- **Resend** (email). Domain `greenradi.us` is verified (SPF/DKIM/DMARC). Use the
  dedicated **`reply_to` field** — a `headers: {"Reply-To": …}` map is silently
  ignored. From is `hello@greenradi.us`, a **real** address that Cloudflare Email
  Routing forwards to the GTCC team, so replies reach the team whether or not the
  client honors `Reply-To`.
- **Cloudflare Workers + Static Assets.** `wrangler.jsonc`: `main = worker/index.js`,
  `assets.directory = "."`, `assets.binding = "ASSETS"`, `nodejs_compat`. Secrets —
  `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY` — are Worker secrets
  (dashboard in prod; `.dev.vars` locally). **HSTS preload is active on
  `greenradi.us`** — the site must never go offline.

## Gotchas (hard-won)

- **Babel shared scope.** Every `<script type="text/babel">` runs in one shared
  scope, so components defined in `green-radius.jsx` (e.g. `ShareCard`) are
  referenced by **bare name** across babel scripts — they are **not** `window`
  properties. Only plain scripts that assign `window.X = …` create real globals
  (`window.SECTORS` in `game-data.js`, `window.ResultState` in `result-state.js`).
  Mounting a component via `window.ShareCard` → `undefined` → renders nothing.
  *(This was the blank-`/result/` bug fixed in #19.)*
- **`localStorage` versioning.** Bump `STORAGE_VERSION` whenever the saved shape
  changes; `loadSaved` drops any save whose `version` doesn't match.
- **No build, no tests, no CI.** The only compile gate is
  `bun build green-radius.jsx` (catches JSX/syntax errors — the "could not resolve
  react" message is *expected*; it's a CDN-global app, not a module). Verify
  gameplay by hand.
- **Deploy = merge.** No staging. `main` is branch-protected (PR required).
  Preview with a local static server, or `wrangler versions upload` for a real
  Cloudflare preview URL (no prod impact). Fork PRs get **no** preview and can't
  run secret-bearing CI.

## Repo & deploy topology

- **`github.com/wachen/green-radius-game` is canonical** — the repo wired to
  Cloudflare / greenradi.us. `marcvl64/green-radius-game` is the legacy upstream
  (Marc's original; the fork relationship is effectively inverted now).
- **`main` is branch-protected:** PR required (0 approvals), no force-push or
  deletion; admins can bypass in an emergency.
- **Contributors** join as **collaborators** and push branches to this repo,
  opening PRs against `main`. (Forking works but loses previews + secret-CI, so
  prefer collaborator branches.)
