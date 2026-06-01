# Design: Capture results + email a Green Radius result link

Status: **Approved** (2026-05-31) · Capture model: **Approach A (explicit action)** · Author: Wesley
Supersedes the earlier rough draft. Origin: Marc's feedback doc ("store results in a Google Sheet + email a certificate on completion").

## Intent (validated in brainstorming)

- **Purpose — both, equally:** organizer data capture AND a camp-facing keepsake.
- **The Sheet is a contact list** — GTCC will follow up with camps → **email is required** + explicit **consent-to-contact**.
- **Append-only:** one row per completion; organizers dedupe in-sheet.
- **Terminology:** the app speaks in "Green Radius" / "your results", not "certificate" — so the shareable page lives at **`/result/`** and copy avoids the word "certificate".

## Locked decisions

| Choice | Decision |
|---|---|
| Sheet write | Apps Script web app (`doPost` → `appendRow`). No GCP / service account. |
| Email payload | A **link** to a hosted result page (reuses the on-screen `ShareCard`), not an attachment. |
| Send-from | `results@greenradi.us` via Resend (final address chosen at Resend setup); SPF/DKIM/DMARC on greenradi.us. |
| Capture model | **Approach A** — explicit action on the done screen. |
| Result page URL | **`/result/`** (singular). Rationale below. |
| Build constraints | Client stays no-build (Babel-in-browser); the Worker is the only new server code. Structured process (feature-dev + code-review). Manual verification (no test toolchain). |

### Why `/result/` (not `/c/`)

- **Good:** matches the app's own vocabulary ("YOUR GREEN RADIUS", "save our results"), so no new jargon; human-readable and **trustworthy when shared** (an opaque `/c/<hash>` reads like a tracker and gets more spam-filtering); self-documenting later.
- **Cautions:** use the **singular** `/result/` — plural `/results/` implies a list/leaderboard and could collide with a future organizer dashboard route; "certificate" had a faint keepsake ring that "result" loses, but the card's "Green Radius" branding + visual carry that, not the URL word.

## Happy path

Camp finishes (board or form) → done screen shows the `ShareCard` + a primary CTA **"✉️ Email me my Green Radius & save our progress"** with a **required, validated** email (prefilled from the intro if present) and a **required** consent checkbox (covers email + save + GTCC-may-contact). Click → `POST /api/complete` → Worker appends a row **and** emails the `/result/` link. A secondary **"🔗 Copy share link"** is always available and works without submitting — the no-consent / just-share path.

## Components (each isolated, one job)

- **`result-state.js`** *(new, ~30 lines)* — `encode({campName, leadName, year, greens[6]})` ⇄ `decode(hash)`. Shared by the game (build the link) and the result page (render it). No deps. *(Greens 0–4 per sector suffice — greens are always a contiguous prefix in this game, so `RadialBadge` depth = count.)*
- **`/result/` page** *(new `result/index.html`)* — loads React/Babel + `game-data.js` + `green-radius.jsx` (for the `window`-exported `RadialBadge`/`SectorIcon`/`ShareCard`) + `result-state.js`; decodes `location.hash`, renders read-only. **frontend-design pass happens here.**
- **Worker `worker/index.js`** *(new)* — `POST /api/complete`: validate → Apps Script append → Resend email → status JSON. All other requests → `env.ASSETS.fetch(request)`.
- **Apps Script `doPost`** *(owner-side)* — verify shared secret → `appendRow([...])`.
- **Client edits in `green-radius.jsx`** — done-screen CTA + required email + required consent + submit guard + real Share button (replaces the `:1346` mock).

## Data shapes

**`POST /api/complete`:**
`{ campName (req), leadName, email (req, validated), year, greens {food..power: 0–4}, source "board"|"form", consentContact true, resultUrl }`
*(`displayStates` is render-only and is never sent.)*

**Sheet row (append-only):** `Timestamp · Camp · Lead · Email · Year · Food · Water · Waste · Transport · Shelter · Power · Total · Source · Consent · Result URL`

**Result URL:** `https://greenradi.us/result/#<base64url(JSON)>` — stateless, no server storage, not tamper-proof (fine for a game).

## Error handling (the keepsake half never depends on the backend)

- The result link is **client-encoded**, so "Copy share link" and the email link work even if the Worker is down.
- Worker does append + email **independently, best-effort**; returns `{ sheet: ok|err, email: sent|err }`.
- **Email is required at submit** → no empty-email branch; the CTA is disabled until a valid email + checked consent.
- **Double-submit:** fire from a guarded `useEffect` keyed on a new `submittedAt` flag in the existing localStorage save (survives refresh-on-done); the button also disables on click.
- **Abuse** (public endpoint): Origin check + body-size cap + honeypot; the Apps Script URL/secret stay server-side in the Worker.

## Consent / privacy

Required, unchecked-by-default checkbox: *"Email me my Green Radius and save our results so the Green Theme Camp Community can see our progress and get in touch."* + a short "how we use this" note. No submit (no email, no save) without it; camps who decline can still use **Copy share link**.

## Config / secrets

`wrangler.jsonc`: add `"main": "worker/index.js"` + `assets.binding: "ASSETS"` (`nodejs_compat` already present).
Secrets via `wrangler secret put`: `SHEETS_WEBAPP_URL`, `SHEETS_SHARED_SECRET`, `RESEND_API_KEY`.

## Testing / verification (Structured = manual, no toolchain)

Local `python3 -m http.server` → walk board + form → done → submit against a test Apps Script + Resend sandbox → confirm row appended + email received + `/result/` renders → preview deploy → `/deploy-verify` edge check.

## Out of scope (YAGNI)

Admin dashboard · PNG/PDF attachment · upsert/dedup · entry editing · auth.
**Folded in:** delete `vercel.json` (the app is fully Cloudflare after this).

## Build order

1. **You:** create the Sheet + Apps Script web app → send the `/exec` URL + a shared secret.
2. **You:** create the Resend account + add `greenradi.us` → I give you the exact DNS records.
3. **Me:** `result-state.js` + `/result/` page → 4. Worker + secrets wiring → 5. client CTA/consent/required-email/share → 6. drop `vercel.json`.
7. Manual verify on a preview → **one PR** to wachen → `/deploy-verify`.
