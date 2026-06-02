# Design: Capture results + email a Green Radius result link

Status: **Approved** (2026-05-31) · Capture model: **Approach A (explicit action)** · Author: Wesley
Supersedes the earlier rough draft. Origin: Marc's feedback doc ("store results in a Google Sheet + email a certificate on completion").

## Intent (validated in brainstorming)

- **Purpose — both, equally:** organizer data capture AND a camp-facing keepsake.
- **The Sheet is a contact list** — GTCC will follow up with camps → **email is required**. **Consent to be contacted is implicit:** it's granted when the player begins (clicks **Start** to play the game or fill the form) and is disclosed on the Start screen. No separate consent field/column.
- **Append-only:** one row per completion; organizers dedupe in-sheet.
- **Terminology:** the app speaks in "Green Radius" / "your results", not "certificate" — so the shareable page lives at **`/result/`** and copy avoids the word "certificate".

## Locked decisions

| Choice | Decision |
|---|---|
| Sheet write | Apps Script web app (`doPost` → `appendRow`) bound to the existing master spreadsheet, appending to a **per-year tab** (`2026 Results`). No GCP / service account. |
| Email payload | A **link** to a hosted result page (reuses the on-screen `ShareCard`), not an attachment. |
| Send-from | From `hello@greenradi.us` (a real address — **Cloudflare Email Routing** forwards it to `greenthemecamps@burningman.org`), Reply-To `greenthemecamps@burningman.org` (direct path for clients that honor it). Via Resend; SPF/DKIM/DMARC all on greenradi.us. Replies reach the team in every client: honored Reply-To → direct; ignored → to `hello@` → forwarded. |
| Capture model | **Approach A** — explicit action on the done screen. |
| Result page URL | **`/result/`** (singular). Rationale below. |
| Build constraints | Client stays no-build (Babel-in-browser); the Worker is the only new server code. Structured process (feature-dev + code-review). Manual verification (no test toolchain). |

### Why `/result/` (not `/c/`)

- **Good:** matches the app's own vocabulary ("YOUR GREEN RADIUS", "save our results"), so no new jargon; human-readable and **trustworthy when shared** (an opaque `/c/<hash>` reads like a tracker and gets more spam-filtering); self-documenting later.
- **Cautions:** use the **singular** `/result/` — plural `/results/` implies a list/leaderboard and could collide with a future organizer dashboard route; "certificate" had a faint keepsake ring that "result" loses, but the card's "Green Radius" branding + visual carry that, not the URL word.

## Happy path

Consent to be contacted is granted up front by starting (the **Start** screen carries the disclosure). Camp finishes (board or form) → done screen shows the `ShareCard` + a primary CTA **"✉️ Email my Green Radius"** with a **required, validated** email (prefilled from the intro if present). Click → `POST /api/complete` → Worker appends a row **and** emails the `/result/` link. A secondary **"🔗 Copy share link"** is always available and works without submitting — the just-share path.

## Components (each isolated, one job)

- **`result-state.js`** *(new, ~30 lines)* — `encode({campName, leadName, year, greens[6]})` ⇄ `decode(hash)`. Shared by the game (build the link) and the result page (render it). No deps. *(Greens 0–4 per sector suffice — greens are always a contiguous prefix in this game, so `RadialBadge` depth = count.)*
- **`/result/` page** *(`result/index.html`)* — loads React/Babel + `game-data.js` + `green-radius.jsx` + `result-state.js`; decodes `location.hash` and renders the `ShareCard` read-only. **Implementation note (corrected in PR #19):** `ShareCard` (and the other `green-radius.jsx` components) are referenced by **bare name** in the shared Babel scope — they are *not* `window` properties. Only `window.SECTORS` (`game-data.js`) and `window.ResultState` (`result-state.js`) are `window`-exported; mounting `ShareCard` via `window.ShareCard` was the blank-page bug #19 fixed. **frontend-design pass happened here.**
- **Worker `worker/index.js`** *(new)* — `POST /api/complete`: validate → Apps Script append → Resend email → status JSON. All other requests → `env.ASSETS.fetch(request)`.
- **Apps Script `doPost`** *(owner-side)* — verify shared secret → `appendRow([...])`.
- **Client edits in `green-radius.jsx`** — implicit-consent disclosure on the Intro/**Start** screen; done-screen CTA + required email + submit guard + real Share button (replaces the `:1346` mock).

## Data shapes

**`POST /api/complete`:**
`{ campName (req), leadName, email (req, validated), year, greens {food..power: 0–4}, source "board"|"form", resultUrl }`
*(`displayStates` is render-only and is never sent.)*

**Sheet row (append-only):** `Timestamp · Camp · Lead · Email · Year · Food · Water · Waste · Transport · Shelter · Power · Total · Source · Result URL`

**Result URL:** `https://greenradi.us/result/#<base64url(JSON)>` — stateless, no server storage, not tamper-proof (fine for a game).

## Error handling (the keepsake half never depends on the backend)

- The result link is **client-encoded**, so "Copy share link" and the email link work even if the Worker is down.
- Worker does append + email **independently, best-effort**; returns `{ sheet: ok|err, email: sent|err }`.
- **Email is required at submit** → no empty-email branch; the CTA is disabled until a valid email is entered.
- **Double-submit:** fire from a guarded `useEffect` keyed on a new `submittedAt` flag in the existing localStorage save (survives refresh-on-done); the button also disables on click.
- **Abuse** (public endpoint): Origin check + body-size cap + honeypot; the Apps Script URL/secret stay server-side in the Worker.

## Consent / privacy

Consent is **implicit and disclosed up front**: the Intro/**Start** screen (shared by the board and form paths) carries the line *"By starting, you agree the Green Theme Camp Community may email your Green Radius and contact you about Green Theme Camp efforts."* Everyone who plays the game or fills the form has therefore consented before any data is captured — so there's no done-screen checkbox and no `consentContact` field/column. Anyone who'd rather not be on the list simply doesn't submit their email at the end (the **Copy share link** path needs no email and sends nothing to the server).

## Config / secrets

`wrangler.jsonc`: add `"main": "worker/index.js"` + `assets.binding: "ASSETS"` (`nodejs_compat` already present).
Secrets via `wrangler secret put`: `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY`.

## Testing / verification (Structured = manual, no toolchain)

Local `python3 -m http.server` → walk board + form → done → submit against a test Apps Script + Resend sandbox → confirm row appended + email received + `/result/` renders → preview deploy → `/deploy-verify` edge check.

## Out of scope (YAGNI)

Admin dashboard · PNG/PDF attachment · upsert/dedup · entry editing · auth.
**Folded in:** delete `vercel.json` (the app is fully Cloudflare after this).

## Build order

1. **You:** in the existing master spreadsheet, add a `2026 Results` tab + a bound Apps Script web app → send the `/exec` URL + a shared secret.
2. **You:** create the Resend account + add `greenradi.us` → I give you the exact DNS records.
3. **Me:** `result-state.js` + `/result/` page → 4. Worker + secrets wiring → 5. Start-screen consent notice + client CTA/required-email/share → 6. drop `vercel.json`.
7. Manual verify on a preview → **one PR** to wachen → `/deploy-verify`.
