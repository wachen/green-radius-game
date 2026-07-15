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

- **No-bundler static app.** `index.html` loads React 18 + ReactDOM from the
  committed **`vendor/`** directory (same-origin, no CDN at runtime) plus the
  precompiled **`dist/*.js`** game scripts — classic-runtime JS built from the
  `.jsx` sources by `scripts/build.js` (`bun run scripts/build.js`, using
  `Bun.Transpiler`) — then mounts `<GreenRadiusGame/>`. No in-browser Babel.
- **One small Cloudflare Worker.** `worker/index.js` handles six dynamic routes —
  `POST /api/complete` (result capture), `POST /api/event` (fail-closed funnel
  telemetry sink — see Analytics below), the Access-gated
  `GET /api/admin/responses` (admin viewer read path),
  `GET /api/health` (liveness probe for the external uptime monitor — returns
  `{ok:true}`, no secrets/upstreams, `no-store`),
  `GET /api/city` (public aggregate tally, colo-cached — see below), and
  `GET /result/?r=<payload>` (per-camp OG unfurl — see below) — and serves
  everything else as static assets (the `ASSETS` binding in `wrangler.jsonc`,
  directory `.`).
- **Deploy = merge to `main`.** Cloudflare Workers + Static Assets auto-deploys
  `main` to https://greenradi.us. No staging environment.

## End-to-end data flow

The game and the result-capture backend are wired through one shared shape: a
per-sector **green count** (`0–10`, total Yes).

```
play game / form  →  done screen  ─┬─►  result-state.encode()  →  /result/?r=<payload>   (share link; legacy #<hash> still decoded)
   (green-radius.jsx + src/*.jsx)  │
                                   └─►  POST /api/complete (worker/index.js)
                                          ├─► appendToSheet → Apps Script web app → "2026 Results" tab
                                          └─► sendEmail     → Resend → emails the /result/ link + the Green-Up Plan
                                        returns { sheet: ok|err, email: sent|err }

/result/ (result/index.html):  decode(?r= payload, legacy #hash fallback) → <ShareCard> (read-only)
                                └─► "Continue improving" → reconstructSave() → localStorage → / (resume at done screen)
```

1. **Play** (`green-radius.jsx` + the `src/*.jsx` modules). Each spin plays a whole sector's 10 questions
   across 4 levels (sized 1/2/3/4). **The radius mirrors the answers
   per-question:** each level's ring fills one segment per Yes, in that level's
   color (`LEVEL_COLORS`), gaps allowed — no compensation. Level 4's four segments
   show the count of advanced Yeses (capped at 4). `sectorFill(sector, answers)`
   derives the per-sector fill + `totalYes` (0–10); the `fills` memo is the single
   source for every renderer (board + form). Six spins complete the game. State
   lives in React + `localStorage` (`STORAGE_KEY = green-radius-game/v1`); bump
   `STORAGE_VERSION` when the saved shape changes (now stores `answers`, not levelStates).
2. **Done screen.** Required, validated email. `greens[sectorId] =
   sectorFill(...).totalYes` (0–10). Every individual answer lives in the shared
   `answers` map (`{questionId: 'yes'|'no'}`, Level 4 keyed by the picked topic id —
   including up to four per-sector write-in ids, base `X-camp` plus synthetic
   `X-camp-2/3/4` from `campIdeaIds`) — the source of both the fill and the backend
   record. The done screen also renders a collapsible **Green-Up Plan** — the
   player's `'no'` answers turned into suggested next-year steps
   (`greenUpSteps`/`<GreenUpPlan>`), grouped by sector and hidden when there are no
   gaps; client-only, sent nowhere and never mounted on `/result/`.
3. **Two outputs:**
   - **Share link** — `result-state.js` `encode({campName, leadName, year, fills, campId})`
     → base64url payload (v2: per sector `fixedBits*5 + advCount`, ~88 chars) →
     `https://greenradi.us/result/?r=<payload>`. Carries the **exact per-question fill**
     so the shared page matches the in-app graphic. **`campId`** rides in the payload
     as an **additive optional `u` field inside the same v2 envelope** — the format tag
     stays `v:2`, so every existing decoder (old browsers, the Worker OG path) ignores
     the extra key, and links minted before this change decode with `campId: null`.
     `decode` always returns `campId` (`null` for legacy v1/v2 links). The payload rides
     in the `?r=` **query** (so the Worker can read it for the per-camp OG unfurl — see below);
     `/result/` reads `?r=` first and falls back to the legacy `#<hash>` for older
     links. Pure client render; works with the Worker down. The done-screen
     **Share** button delivers it via Web Share L2 — `navigator.share({ files: [pngFile] })`
     hands the pre-rasterized result-card PNG to the OS share sheet — then degrades to
     sharing the `?r=` URL (Web Share L1), then to copying the link to the clipboard.
   - **`POST /api/complete`** — `{campName, email, year, greens, mode, answers,
     campId, schemaVersion, resultUrl}`. `greens` is now 0–10 per sector; `answers` (the full
     map) is backend-only (→ sheet `answers_json`). **`campId`** is a stable
     client-generated UUID (`crypto.randomUUID`, persisted in the localStorage save as an
     additive key, reused across reloads/redos, re-minted on start-over/exit). The Worker
     validates it (safe UUID chars, bounded) and writes it **inside the `answers` blob**
     (`answers.campId`) — no new sheet column — so the read side can dedup a camp's repeat
     submissions (see the dedup note under the city tally). It never leaves the JSON blob:
     the `/api/city` allowlist doesn't surface it and scoring/email code never reads it. Besides `qid:'yes'|'no'` entries,
     `answers` may carry up to four **`X-camp-note`**-style entries per sector: the
     free-text "Our Camp's Idea" write-ins (`campIdeaIds` — base `X-camp` plus
     synthetic `X-camp-2/3/4`), each note gated on its own slot's yes/no (client input
     caps 140 chars). The Worker's `NOTE_KEYS` whitelist enumerates all 24 valid keys
     (the base `*-camp-note` plus `*-camp-2/3/4-note` for each of the six sectors),
     so all four per-sector write-in notes reach the sheet/email, each still gated on
     its own slot's yes/no. The extra slots' yes/no answers score normally regardless
     (plain `'yes'/'no'` entries aren't note-gated). Any note gets trimmed, clamped to
     160, run through `sheetCell`, and dropped if its own yes/no isn't in the same
     payload. Scoring ignores notes — each idea's point rides its own yes/no, never
     its note.
4. **Worker** (`worker/index.js`) validates (**fail-closed** origin check —
   absent/foreign Origin is rejected — body-size cap, honeypot, required
   `campName`+`email`, email regex, per-field length caps, and
   spreadsheet-formula sanitization of the name/email cells via `sheetCell`),
   then does two things **independently, best-effort, in parallel**, and returns
   `{sheet, email}`. NOTE: these gates only deter casual scripted abuse; the
   actual rate-limit is a Cloudflare WAF rule (owner-side, not in-repo).
5. **`/result/`** (`result/index.html`) decodes the `?r=` payload (or legacy `#hash`)
   to `fills` and renders `<ShareCard fills=… >` read-only (legacy v1 `greens` links
   fall back to a contiguous fill). When the request carries `?r=`, the Worker first
   rewrites the OG tags (below); the client render is unchanged.
6. **Resume / "Continue improving"** (`result/index.html` + `ResultState.reconstructSave`).
   The result page also offers a **Continue improving** action so a camp can return on a
   new device or keep answering. It calls `reconstructSave(decoded, window.SECTORS, {version, campId, now})`
   — a **pure, isomorphic** helper in `result-state.js` — to rebuild a current-shape
   localStorage save (`STORAGE_VERSION`/`STORAGE_KEY`/`genCampId` are passed in from
   `src/core.jsx`'s shared Babel scope), then navigates to `/`, where `loadSaved` resumes
   the game at the **done screen** (`phase:'done'`, all sectors closed, `submittedAt` set so
   it does not auto-resubmit). Fixed answers map **positionally** to `SECTORS`; the advanced
   **count** is reproduced by marking the first N Tier-4 topics Yes. **Notes are not in the
   payload, so they are absent** (never faked). **campId:** carried from the payload when
   present, else freshly minted — so a returning camp keeps one identity for dedup.
   **Overwrite guard:** if the device already has a save with meaningful progress AND a
   different (or unknowable, i.e. legacy-link-`null`) campId, a confirm modal asks before
   replacing; same campId or an empty save imports silently. **Schema-drift policy:**
   *import-what-aligns* — the payload has no question-schema version (it is purely positional),
   so if a sector's fixed-question count no longer matches, only positionally-aligned answers
   are set and any advanced count beyond the available topics is dropped. This never throws or
   corrupts (the game recomputes every fill from `answers`); a real content-schema break would
   ship its own payload-format bump. Import fires a non-PII `result_resumed` funnel event
   (event name only) to `/api/event`.

## Integration contracts (don't break these)

- **The `greens` shape is the contract.** `{ food, water, waste, transport,
  shelter, power }`, each `0–10` (total Yes per sector), threads game → Worker →
  the sheet's per-sector columns + email. The *graphic* uses `fills` (per-question),
  carried in the `?r=` payload; `greens` is just the headline number for the tally.
- **Fill is per-question; gaps allowed.** A sector is NOT a contiguous depth any
  more — each level fills independently per question (e.g. L1 empty, L2 half, L3 full),
  in per-level colors. `result-state` v2 stores the per-sector pattern (`fixedBits` +
  advanced count), not a single count; `decode()` returns ready-to-render `fills`.
  (Replaced the contiguous/compensated model on 2026-06-05.)
- **The Worker degrades gracefully.** Missing secrets → `appendToSheet` /
  `sendEmail` return `false` → the endpoint returns `err`, but the static site
  still serves. The share/keepsake path never depends on the backend.
- **`safeResultUrl`** pins the emailed link to host `greenradi.us`/`localhost` +
  path `/result/` and escapes the href — don't loosen it (anti-XSS/phishing in the
  outbound email).
- **`sheetCell` / length caps** neutralize submitted free text before it reaches
  the sheet: campName/leadName ≤ 80, email ≤ 254, and any value starting with
  `= + - @` (a Google Sheets formula trigger) gets a leading `'`. Keep names
  flowing through `sheetCell` — it's the anti-formula-injection guard.
- **The email body is server-built.** `sendEmail` composes the result link plus a
  Green-Up Plan rebuilt from the *sanitized* `answers` map against `game-data.js`
  (`greenUpEmailHtml`, mirroring `greenUpSteps` in `green-radius.jsx`): every "No"
  becomes its question title; a "No" on the base `X-camp` write-in shows the camp's
  own note (HTML-escaped, `sheetCell` guard apostrophe stripped for display). Both
  `greenUpEmailHtml` and `greenUpSteps` iterate `sector.tier4Topics` only, so the
  Green-Up Plan (done screen and email alike) never surfaces the synthetic
  `X-camp-2/3/4` slots — only the base per-sector idea appears as a next-year step,
  even when an extra slot was answered "No". Client prose must never flow into the
  email directly — `/api/complete` mails any address the caller supplies, so
  free-form body text would turn it into a phishing relay.

## External integrations

- **Google Apps Script** (owner-side, *container-bound* to the master
  spreadsheet). `doPost` verifies a shared secret, then `appendRow` to the
  **`2026 Results`** tab (16 cols: Timestamp · Camp · Lead · Email · Year · 6
  sectors · Total · Source · Result URL · **Answers JSON** · **Schema Version**).
  The Worker sends `answers` (the full `{qid:'yes'|'no'}` map — now up to four
  write-in ids per sector via `campIdeaIds` — plus all four per-sector `X-camp-note`
  write-in text entries that pass the Worker's note whitelist; see the `/api/complete`
  contract above) + `schemaVersion`;
  these land in the last two columns (`Answers JSON` = `JSON.stringify(answers)`,
  `Schema Version` = the stamp), and the 6 per-sector columns + Total now carry
  0–10 / 0–60. The note entries need **no Apps Script change** — they ride inside
  the same stringified JSON, and the admin viewer reads them back out of it. A read-only **`doGet`** (added for the admin viewer) returns the
  rows to the Worker. See `docs/admin-setup.md` for the `doGet` source and the
  Cloudflare Access setup. Quirks: a `/exec` request returns
  **302 → script.googleusercontent.com**; Cloudflare's `fetch` follows it
  correctly (plain `curl` mishandles it). One `doPost`/`doGet` per project, and
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
  `greenradi.us`** — the site must never go offline. The Worker answers **only**
  on `greenradi.us`: `wrangler.jsonc` pins `workers_dev: false` (the persistent
  workers.dev route skipped the zone's WAF/rate-limiting/Access while running
  with production secrets — removed in PR #56) and `preview_urls: true`
  (branch-build preview URLs stay on for PR review, gated by a Cloudflare
  Access email allowlist on `*-green-radius-game.<account>.workers.dev`).
  Don't flip either flag — `preview_urls` must stay explicit because its
  default follows `workers_dev`.
- **`.assetsignore` gates what is served.** Because `assets.directory = "."`, the
  whole repo root would otherwise be public. `.assetsignore` (NOT `.gitignore` —
  wrangler ignores `.gitignore` for assets) excludes `.git`, `.dev.vars*`,
  `.claude/`, `.remember/`, `.superpowers/`, and editor junk, so neither the
  git-checkout deploy nor a local `wrangler deploy` can publish history or
  secrets. It also excludes the source/config/docs that have no reason to live on
  the live domain (`worker/`, `docs/`, `wrangler.jsonc`, `CLAUDE.md`) — prod-domain
  hygiene, since the repo is public on GitHub regardless. Runtime-fetched paths stay
  served (`vendor/`, the root `.js`/`.jsx`, `og-card.png`, `downloads/`). After any
  deploy, sanity-check `curl -sI https://greenradi.us/.git/config` returns 404.
- **The runtime is vendored, not CDN-loaded.** React/ReactDOM/`@babel/standalone`
  are committed under `vendor/` (versioned filenames) and loaded same-origin with
  `defer` in all four HTML entry points, so a CDN outage or compromise can't
  blank or hijack the page and the playa-offline story improves. To upgrade, see
  `vendor/README.md` (download the pinned URL, verify the bytes, update all four
  entry points). `vendor/babel-standalone-*.min.js` stays committed and served so
  an in-flight cached old page can still boot mid-deploy, but no entry point loads
  it anymore — the game scripts load from the precompiled `dist/*.js` (built from
  the `.jsx` sources by `scripts/build.js`) instead. Because the filenames are
  versioned, `_headers` serves `/vendor/*` with `Cache-Control: immutable,
  max-age=1y` (a new version is a new URL) — returning visitors skip ~7 RTTs;
  `og-card.png` is unversioned at root and deliberately not covered. `_headers`
  also sends `X-Frame-Options`/`frame-ancestors 'none'` and a minimal
  `Permissions-Policy`; a script CSP is still deliberately absent — the boot
  scripts are external `dist/src/boot-*.js` files now (no eval needed), but this
  change didn't add a CSP either.
- **Admin viewer read path.** `GET /api/admin/responses` (Worker) is gated by
  **Cloudflare Access** (edge, email allowlist on `/admin*` + `/api/admin*`) and
  additionally validates the Access JWT (`Cf-Access-Jwt-Assertion`, RS256 vs. the
  team JWKS, `aud === CF_ACCESS_AUD`). It proxies the Apps Script `doGet` (same
  `/exec`, shared secret) and returns sheet rows as JSON; the `/admin/` page
  (`admin/index.html` + `admin/admin.jsx`, reusing `RadialBadge` + `fillsFromAnswers`
  + `window.AdminAggregate`) shapes everything client-side. Read-only; the
  `CF_ACCESS_AUD`/`CF_ACCESS_TEAM_DOMAIN` vars live in `wrangler.jsonc`. See
  `docs/admin-setup.md`.
- **Public city tally.** `GET /api/city` (Worker) is the one **public** read
  path: it reuses the same Apps Script `doGet` proxy as the admin viewer
  (`fetchSheetRows`) and the same isomorphic aggregator
  (`admin/aggregate.js` imports into the Worker like `game-data.js` does),
  then rebuilds the response **field-by-field from an allowlist** — count,
  totalYes/totalPossible, tallyPct, sector averages, this-week momentum,
  per-question intensities — so camp names/emails/free text/leaderboard
  structurally cannot leak, even if `computeAggregates` grows new fields.
  Cached in the colo cache (`caches.default`) with freshness checked in code
  (5 min via the body's `generatedAt`; the stored entry lives a day) so the
  sheet sees at most ~1 hit per colo per 5 minutes and an Apps Script outage
  serves the stale entry flagged `stale:true` (the page shows "as of <time>").
  No cache + no upstream → 503 `{error:'unavailable'}` → `/city/` shows a
  degraded panel with the play CTA.
  **Duplicate-proof aggregates (latest-wins dedup).** `computeAggregates`
  (`admin/aggregate.js`, isomorphic — imported by both the Worker and the admin
  page) collapses repeat submissions to one row per camp *before any tally*, so
  `/api/city` and every admin aggregate (leaderboard, sector standings, momentum,
  intensities, per-question) count **camps, not rows**. It is the single shared
  choke point: both read paths reach the numbers through `computeAggregates`, and
  the raw admin response table (from `/api/admin/responses`) is left un-deduped as
  a full audit log. Identity precedence per row: `campId` (from the answers blob)
  → normalized email (trim+lowercase) → normalized camp name → none (a row with no
  identity is always kept). "Latest" = highest `timestamp`; ties keep the
  later-appended row. Legacy rows are dropped first, so only modern rows dedup.
  *Momentum note:* `momentum.thisWeek` counts distinct camps whose **latest**
  submission falls in the window. Dedup can never erase a camp from that window —
  latest-wins keeps each camp's most-recent timestamp, which is ≥ any earlier
  in-window one — it only stops same-week resubmissions from double-counting and
  correctly folds a returning camp (old + this-week rows) into one active camp.
  *Known limit:* a camp's pre-`campId` rows key on email while its post-`campId`
  rows key on `campId`, so those two eras don't merge (transition-window only).
  The page itself (`city/index.html`) is a
  static asset built like `/result/` (vendored runtime, `RadialBadge` in
  aggregate `intensities` mode); no `run_worker_first` entry is needed because
  `/api/city` matches no asset.
- **Per-camp OG (Worker `HTMLRewriter`).** `GET /result/?r=<payload>` decodes the
  payload server-side (reusing `result-state.js`) and rewrites `og:title`/`og:description`
  to the camp's name + score. The OG image stays the static
  `og-card.png` (no headless render in Workers). **Fail-open:** any missing param,
  decode error, or rewrite issue serves the unmodified static page — a generic unfurl
  is fine, a broken result page is not. **Routing requirement (load-bearing):** Workers +
  Static Assets serve assets *before* the Worker by default, and `/result/` matches the
  `result/index.html` asset — so without help the Worker never runs for it and this
  rewrite is dead code. `wrangler.jsonc` sets `assets.run_worker_first: ["/result/"]` so
  the Worker runs first for that one route (and just proxies `env.ASSETS.fetch` when there
  is no `?r=`). Do not remove it. `/api/*` needs no such entry — those paths match no
  asset, so the Worker already runs for them. (HTMLRewriter `setAttribute` HTML-escapes
  the value, so an attacker-supplied camp name cannot break out of the meta attribute —
  verified with a quote/`<script>` payload.) **Privacy:** `?r=` makes the result readable by
  the Worker (we don't log it, but Cloudflare may record request URLs); the same data
  already lands in the Sheet on completion and in any link the camp shares, so the
  marginal exposure is low-sensitivity. `safeResultUrl` still passes the emailed `?r=`
  link (it checks `pathname`, which the query doesn't change).
- **`game-data.js` is isomorphic** (`module.exports` + a `globalThis` assign) so the
  browser and the Worker share one source for the question content (game UI; the
  Worker's email headline + Green-Up Plan sections). `result-state.js` resolves its
  global via `globalThis` too, so both import into the Worker bundle without a
  module-eval throw. `rank.js` (playa-rank titles) was retired in #66 — no page loads
  it and the Worker no longer imports it; the file stays committed and served for
  cached pre-#66 pages, deletable once cached HTML ages out.

## Analytics (pageviews + funnel)

Two independent, privacy-conscious layers. Neither is load-bearing for gameplay.

- **Cloudflare Web Analytics (CWA).** A `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"..."}'>` beacon in the `<head>` of the three **public** pages only — `index.html`, `result/index.html`, `city/index.html` (**not** `admin/`, which is Access-gated and internal). It reports pageviews + Web Vitals to the Cloudflare dashboard; no cookies, no PII. The beacon token is **public by design** and committed to the repo (swap it via the CWA site in the Cloudflare dashboard). The CWA site is created out-of-band in the dashboard/API, not by this repo. The beacon has no Subresource Integrity hash on purpose — that matches Cloudflare's official snippet (Cloudflare rotates the file). No CSP change was needed: `_headers` only sets `frame-ancestors 'none'`, so there is no `script-src`/`connect-src` to widen for `cloudflareinsights.com`.
- **Funnel events → `POST /api/event` (Worker).** `green-radius.jsx`'s `trackEvent(event, props)` helper fires a fire-and-forget `navigator.sendBeacon` (keepalive `fetch` fallback), fully wrapped so a telemetry failure can never touch gameplay. It is called at exactly five funnel points: `game_started` (first interaction past the pick-mode landing), `mode_chosen` (`{mode:'board'|'form'}`), `submit_attempted` (`{mode, sectors}` = count of sectors with any Yes), `submit_succeeded`, `submit_failed` (both `{mode}`). A sixth event, `result_resumed` (event name only), is fired by `result/index.html` — which does not load `green-radius.jsx`, so it inlines its own `sendBeacon` — when a camp imports a result via "Continue improving". The Worker route mirrors `/api/complete`'s **fail-closed Origin check** (must be `https://greenradi.us` or `http://localhost:*`, absent Origin rejected → 403), caps the body at 1 KB, drops any event name not in the `ALLOWED_EVENTS` allowlist, then writes **one structured `console.log` line** (`{type:'funnel_event', event, mode?, sectors?}`) to Workers Logs and returns **204**. **No PII by contract:** event name + coarse props only — never emails, camp names, or free text. Every non-forbidden outcome returns 204 so a beacon never surfaces an error to the player.

## Gotchas (hard-won)

- **Shared global scope.** The compiled `dist/*.js` game scripts are plain
  classic `<script>`s (no modules, no imports), so they all run in one shared
  global scope — components defined in the game scripts (`src/*.jsx`,
  `green-radius.jsx`) — e.g. `ShareCard` in `src/share-card.jsx` — are
  referenced by **bare name** across scripts. Compiling with `Bun.Transpiler`
  still evaluates each script globally and downlevels `const` to `var`, so these
  top-level names do land on `window` — but only on pages whose `<script>` list
  includes the defining module, so nothing should rely on the `window`
  attachment. Plain scripts that assign `window.X = …` create the only
  intentional globals (`window.SECTORS` in `game-data.js`, `window.ResultState`
  in `result-state.js`).
  Mounting a component via `window.ShareCard` → `undefined` → renders nothing
  when the defining script isn't loaded on that page.
  *(This was the blank-`/result/` bug fixed in #19.)*
- **Game-script order matters.** The UI is split across `src/*.jsx` +
  `green-radius.jsx` (PR #55). `index.html` lists all nine in order —
  `src/core.jsx` first (declares the shared hooks/constants), `green-radius.jsx`
  last — while `result/`, `city/`, and `admin/` load only the modules they render
  (`core` + `badge`, plus `share-card` on `result/`), still core-first.
  Adding a new cross-module reference to one of those pages' components means
  adding the module's `<script>` tag there too.
  Top-level `const` initializers evaluate at script load, so a module may only
  reference an earlier module's names at eval time (render-time JSX references
  are fine in any order).
- **`/result/` must load the same web fonts as `index.html`.** `ShareCard` inherits
  its font (`Space Grotesk`), so the vendored `@font-face` block + the
  `/vendor/fonts/space-grotesk-v22-latin.woff2` preload live in **both**
  `index.html` and `result/index.html`; drop them from `result/index.html` and the
  shared card silently renders in a serif fallback.
- **`localStorage` versioning.** Bump `STORAGE_VERSION` whenever the saved shape
  changes; `loadSaved` drops any save whose `version` doesn't match.
- **`wrangler dev` can reload-loop from the repo root.** Its own Cache API
  state (used by `/api/city`) writes into `.wrangler/state`, which sits inside
  the watched assets directory and can truncate in-flight asset fetches. Run
  `npx wrangler dev --persist-to <dir outside the repo>` instead.
- **Tiny compile step; CI runs the compile+diff gate + `bun test`.** GitHub
  Actions (`.github/workflows/ci.yml`, bun pinned to `1.3.14`) runs on every PR:
  `bun run scripts/build.js` recompiles every game script (`src/*.jsx` and
  `green-radius.jsx`) to `dist/` via `Bun.Transpiler`, then the job fails if
  `git status --porcelain -- dist` is non-empty (the committed `dist/` must
  match what the sources compile to), plus `bun test` (pure-function unit tests
  in `test/` — no deps, Bun's built-in runner). Local verification is the same:
  run `bun run scripts/build.js`, confirm `dist/` is unchanged in git, then
  `bun test`. Still verify gameplay by hand.
- **Deploy = merge.** No staging. `main` is branch-protected (PR required).
  Preview with a local static server, or just push a branch — Workers Builds
  runs `wrangler versions upload` on every non-main push, producing a real
  Cloudflare preview URL (no prod impact). Preview URLs sit behind Cloudflare
  Access (a separate Access app/policy from `/admin`, kept in sync with
  its email allowlist manually); the Worker's persistent
  workers.dev route is disabled (PR #56), so prod answers only on
  `greenradi.us`. Fork PRs get **no** preview and can't run secret-bearing CI.

## Repo & deploy topology

- **`github.com/wachen/green-radius-game` is canonical** — the repo wired to
  Cloudflare / greenradi.us. `marcvl64/green-radius-game` is the legacy upstream
  (Marc's original; the fork relationship is effectively inverted now).
- **`main` is branch-protected:** PR required (0 approvals), no force-push or
  deletion; admins can bypass in an emergency.
- **Contributors** join as **collaborators** and push branches to this repo,
  opening PRs against `main`. (Forking works but loses previews + secret-CI, so
  prefer collaborator branches.)
