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

- **No-build static app.** `index.html` loads React 18 + ReactDOM +
  `@babel/standalone` from the committed **`vendor/`** directory (same-origin, no
  CDN at runtime); Babel compiles the JSX *in the browser*, then mounts
  `<GreenRadiusGame/>`.
- **One small Cloudflare Worker.** `worker/index.js` handles four dynamic routes —
  `POST /api/complete` (result capture), the Access-gated
  `GET /api/admin/responses` (admin viewer read path),
  `GET /api/health` (liveness probe for the external uptime monitor — returns
  `{ok:true}`, no secrets/upstreams, `no-store`), and
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
   (green-radius.jsx)              │
                                   └─►  POST /api/complete (worker/index.js)
                                          ├─► appendToSheet → Apps Script web app → "2026 Results" tab
                                          └─► sendEmail     → Resend → emails the /result/ link + the Green-Up Plan
                                        returns { sheet: ok|err, email: sent|err }

/result/ (result/index.html):  decode(?r= payload, legacy #hash fallback) → <ShareCard> (read-only, stateless)
```

1. **Play** (`green-radius.jsx`). Each spin plays a whole sector's 10 questions
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
   - **Share link** — `result-state.js` `encode({campName, leadName, year, fills})`
     → base64url payload (v2: per sector `fixedBits*5 + advCount`, ~88 chars) →
     `https://greenradi.us/result/?r=<payload>`. Carries the **exact per-question fill**
     so the shared page matches the in-app graphic. The payload now rides in the `?r=`
     **query** (so the Worker can read it for the per-camp OG unfurl — see below);
     `/result/` reads `?r=` first and falls back to the legacy `#<hash>` for older
     links. Pure client render; works with the Worker down. The done-screen
     **Share** button delivers it via Web Share L2 — `navigator.share({ files: [pngFile] })`
     hands the pre-rasterized result-card PNG to the OS share sheet — then degrades to
     sharing the `?r=` URL (Web Share L1), then to copying the link to the clipboard.
   - **`POST /api/complete`** — `{campName, email, year, greens, mode, answers,
     schemaVersion, resultUrl}`. `greens` is now 0–10 per sector; `answers` (the full
     map) is backend-only (→ sheet `answers_json`). Besides `qid:'yes'|'no'` entries,
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
  `greenradi.us`** — the site must never go offline.
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
  `defer` in all three HTML entry points, so a CDN outage or compromise can't
  blank or hijack the page and the playa-offline story improves. To upgrade, see
  `vendor/README.md` (download the pinned URL, verify the bytes, update all three
  entry points). Because the filenames are versioned, `_headers` serves `/vendor/*`
  with `Cache-Control: immutable, max-age=1y` (a new version is a new URL) — returning
  visitors skip ~7 RTTs; `og-card.png` is unversioned at root and deliberately not
  covered. `_headers` also sends `X-Frame-Options`/`frame-ancestors 'none'`
  and a minimal `Permissions-Policy`; a script CSP is deliberately absent because
  in-browser Babel needs eval and the boot scripts are inline.
- **Admin viewer read path.** `GET /api/admin/responses` (Worker) is gated by
  **Cloudflare Access** (edge, email allowlist on `/admin*` + `/api/admin*`) and
  additionally validates the Access JWT (`Cf-Access-Jwt-Assertion`, RS256 vs. the
  team JWKS, `aud === CF_ACCESS_AUD`). It proxies the Apps Script `doGet` (same
  `/exec`, shared secret) and returns sheet rows as JSON; the `/admin/` page
  (`admin/index.html` + `admin/admin.jsx`, reusing `RadialBadge` + `fillsFromAnswers`
  + `window.AdminAggregate`) shapes everything client-side. Read-only; the
  `CF_ACCESS_AUD`/`CF_ACCESS_TEAM_DOMAIN` vars live in `wrangler.jsonc`. See
  `docs/admin-setup.md`.
- **Per-camp OG (Worker `HTMLRewriter`).** `GET /result/?r=<payload>` decodes the
  payload server-side (reusing `result-state.js`) and rewrites `og:title`/`og:description`
  to the camp's name + score + playa-rank (`rank.js`). The OG image stays the static
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
- **`rank.js` and `game-data.js` are isomorphic** (`module.exports` + a `globalThis`
  assign) so the browser and the Worker share one source: `rank.js` for the playa-rank
  title (done-screen headline, Web Share text, OG description), `game-data.js` for the
  question content (game UI; the Worker's Green-Up Plan email section). `result-state.js`
  resolves its global via `globalThis` too, so all three import into the Worker bundle
  without a module-eval throw.

## Gotchas (hard-won)

- **Babel shared scope.** Every `<script type="text/babel">` runs in one shared
  scope, so components defined in `green-radius.jsx` (e.g. `ShareCard`) are
  referenced by **bare name** across babel scripts — they are **not** `window`
  properties. Only plain scripts that assign `window.X = …` create real globals
  (`window.SECTORS` in `game-data.js`, `window.ResultState` in `result-state.js`,
  `window.Rank` in `rank.js`).
  Mounting a component via `window.ShareCard` → `undefined` → renders nothing.
  *(This was the blank-`/result/` bug fixed in #19.)*
- **`/result/` must load the same web fonts as `index.html`.** `ShareCard` inherits
  its font (`Space Grotesk`), so the Google-Fonts `<link>` lives in **both**
  `index.html` and `result/index.html`; drop it from `result/index.html` and the
  shared card silently renders in a serif fallback.
- **`localStorage` versioning.** Bump `STORAGE_VERSION` whenever the saved shape
  changes; `loadSaved` drops any save whose `version` doesn't match.
- **No build, no tests, no CI.** The only compile gate is
  `bun build green-radius.jsx` (catches JSX/syntax errors — the "could not resolve
  react" message is *expected*; React is a global from `vendor/`, not a module).
  Verify gameplay by hand.
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
