# Roadmap

The single backlog for the Green Radius Game. **Nothing gets built unless it sits
under "Approved" here.** Priority = order within a section (top first). Edit this
file freely; reordering lines is how priorities are set.

Origin codes: `U5`/`A2`/`R4`-style ids come from
`docs/reviews/2026-06-09-security-usability-review.md` (S = security,
U = usability, A = accessibility, R = robustness); `FE-n` = that review's
"Feature & design enhancements" list; `SG` = its "Strategic gaps". All lettered
review findings are closed except where listed below.

## Approved — build next, in this order

_Approved 2026-09-12 as the 2027-prep batch; Task-1 ships item 5 (this PR)._

1. **Year-keyed question content** (new · med) — give `game-data.js` a year key
   and archive the current set when BLAST 2027 content lands, instead of
   overwriting; old result links keep decoding against the question set they
   were actually played on.
2. **Nightly sheet backup** (new · med) — the Google Sheet is the only datastore;
   one accidental deletion or Apps Script mishap loses every response ever
   submitted. A scheduled Worker cron pulls the admin feed and stores a dated CSV
   snapshot (R2 free tier, or simply emailed to the owner via Resend). Cheap
   insurance for irreplaceable data.
3. **Year-over-year ghost ring** (FE-6 · med) — "paste last year's result link"
   draws a dashed last-year arc + per-sector deltas. Zero migration (the emailed
   result link is the durable record). Build now, pays off at BLAST 2027.
4. **Surface and retry failed submits** (new · small-med) — `/api/complete` is
   best-effort and returns `{ sheet, email }`, but the done screen never tells the
   player when a leg failed; on playa connectivity that means silently lost rows
   and missing keepsake emails. Show a gentle "didn't go through — try again"
   state with a retry button (the R4 nonce already makes replays safe). A
   "didn't get the email? resend, or correct your address" affordance ships in
   the same PR — an email typo is invisible today: the player just never
   receives their result link, and the link is the durable record.
5. **Bus-factor / break-glass doc** (SG · small, mostly owner-side) — secrets and
   the Cloudflare/Resend/Google accounts are single-holder; HSTS means the site
   can't be casually retired. Document succession or add a co-owner.

## Proposed — needs Wes's call

_(ordered by descending importance; `new` = brainstormed 2026-07-16)_

- **Privacy page + retention/deletion path** (SG · small-med) (explicitly deferred 2026-09-12) — the game collects
  camp name, lead name, and email with one consent sentence and no privacy page,
  retention policy, or deletion route. Highest-value open gap for something
  holding real emails. Could be a single static page plus a documented "email us
  to delete" path.
- **Synthetic canary submission** (new · med) — a scheduled cron POSTs a flagged
  test completion through the real pipeline (Apps Script append + Resend email)
  and alerts when either leg fails, so an expired Apps Script deployment or dead
  API key breaks a canary instead of a camper. Needs an agreed flag so canaries
  stay out of the sheet aggregates.
- **On-playa offline story** (SG · med) — runtime is vendored, but there's no
  service worker or "needs signal" messaging. Decide the story before the burn:
  add a minimal service worker, or just honest messaging.
- **PDF version stamp / refresh** (SG · small) (explicitly deferred 2026-09-12) — the linked "v26 FINAL" board PDF
  (May 19) predates the Levels scoring rework, so paper players play a different
  game. Cheapest fix: stamp the web app's rules version on the download link and
  note the differences; fuller fix needs a regenerated PDF from GTCC.
- **Full-playthrough CI test** (new · med) — extend the #74 boot-smoke into one
  scripted headless run that spins, answers all 60 questions, reaches the done
  screen, and checks the encoded result payload; catches game-logic and scoring
  regressions the compile gate and boot-smoke can't.
- **"You vs the city" overlay** (new · small-med) — a toggle on the result screen
  that draws the city-average ring (from the public `/api/city`) behind your
  camp's wheel. Zero new data collection; turns the aggregate page into a
  personal motivator ("we're above the city on Waste, behind on Power").
- **QR code on the share card** (new · small) — the PNG keepsake gains a small QR
  of the result link, so a card taped to a camp board on playa becomes a
  scannable invite to play. Pure client-side (tiny vendored QR encoder).
- **Dark mode / playa-night theme** (new · med) — playa nights are dark; a
  `prefers-color-scheme` (or manual) night theme keeps the game from being a
  face-flashlight at 11pm. Needs a deliberate palette pass to keep WCAG-AA
  contrast (the A2 learnings apply directly).
- **Wheel keyboard + screen-reader audit** (new · med) — #69 covered labels and
  touch targets; the remaining a11y gap is a full pass proving spin-and-answer
  can be completed by keyboard or screen reader alone.
- **LICENSE / provenance fix** (SG · small, owner decision) — LICENSE says MIT
  (c) the legacy owner over BLAST framework content that may not be the repo's to
  relicense. Needs your call on the right holder/terms.
- **Weekly GTCC digest email** (new · small-med) — a cron-triggered summary (new
  camps, city tally movement, strongest/weakest sectors) mailed to the owner or
  GTCC, so nobody has to remember to check the admin page.
- **Booth kiosk mode** (new · small) — a `?kiosk` variant for a shared tablet at
  the BLAST booth or camp events: skips persistence, auto-resets to the intro
  after idle, and never pre-fills the previous camp's info.
- **Printable camp poster** (new · med) — a letter-size printable ("Our Green
  Radius" wheel + camp name + QR) generated from a result, for camps to post at
  their frontage; extends the share card into the physical playa.
- **Post-burn retrospective loop** (new · large) — after the burn, an email
  invites camps to a short "how did it actually go?" pass over the same sectors,
  rendering pledge-vs-reality on the wheel. Strong story for GTCC, but a real
  second flow (new mode, new email, new payload variant).
- **Pre-burn reminder opt-in** (new · med) — a "remind us to finish before the
  burn" checkbox; an early-August cron emails camps with saved-but-unsubmitted
  or improvable results. Needs storing an opt-in flag alongside the row.
- **Challenge a camp** (new · med) — a share variant that renders two result
  payloads side by side ("Camp A vs Camp B"), entirely client-side from two
  `?r=` params; friendly inter-camp rivalry is very Burning Man.
- **Opt-in public camp wall** (new · med-large; partly subsumed by the #114
  public city map, which shows name + address for every camp) — camps tick "show us publicly"
  and appear with name + badge on a public leaderboard-ish page. High
  engagement, but consent, moderation, and takedown handling make it dependent
  on the privacy page shipping first.
- **Embeddable badge endpoint** (new · med) — a Worker route that renders a
  camp's wheel as a standalone SVG from a result payload, for embedding on camp
  websites; must stay stateless (decode-and-render only) to preserve the
  no-data-stored model.
- **Dynamic per-camp OG image** (new · med-large) — replace the static
  `og-card.png` on `/result/` unfurls with a rendered per-camp card. The unfurl
  *text* has been per-camp since #39; the picture isn't. Needs a Workers-side
  image story (SVG-to-PNG or pre-rendered upload), so cost it before committing.
- **"Not sure" answer option** (new · med, content call) — a third answer that
  scores as No but bookmarks the question and surfaces its resource link in the
  Green-Up Plan; honesty beats guessing. Additive to the answers map, so no
  `greens`-contract change.
- **Tablet / landscape layout** (new · med) — the game is phone-first; a
  two-column landscape layout for iPads (likely at camp meetings and the booth)
  is unexplored territory.
- **Spin haptics + sound** (new · small) — an optional `navigator.vibrate` tick
  and a soft click as the wheel passes sectors, respecting reduced-motion and
  off-by-default sound; cheap tactile juice for the flagship interaction.
- **Sheets → D1 migration** (deferred idea · med) — only if analytics ever shows
  quota-driven submit failures. No signal yet.

## Waiting on something

- **Remove the post-Burn map banner** from the home screen before the 2027
  season opens. It has no auto-expiry by choice (#114), so this is the reminder.
  Also drop the literal year from the home copy if any remains, and bump
  `STORAGE_VERSION` when the 2027 question set lands so half-finished 2026
  saves do not resume into 2027.

- **Season rollover**: when the 2027 season opens, follow the runbook in
  `docs/admin-setup.md`'s "Season rollover" section for the new yearly
  sheet, fresh Apps Script deployment, and re-pointed `SHEETS_WEBAPP_URL`
  secret.

## Shelved — do not build without an explicit ask

- **U5 identity-at-end** — intro fields optional, "Get your results" card on the
  done screen. Fully built and Playwright-verified, then shelved by Wes
  2026-07-16 before deploy. The complete diff is preserved in closed PR #78.

## Recently done

- Public city map on `/city/` (camp name + parsed playa address per camp, the
  one deliberate per-camp carve-out from `/api/city`'s aggregate-only rule,
  consent copy updated), a permanent home banner linking to it, the Momentum
  chart anchored to the newest submission, and a "Where the city shines"
  companion to the opportunities panel (#114) - 2026-09-11

- Repoints the home banner at the post-Burn public map instead of the signup
  deadline; pairs `intro_engaged`'s reset with every `game_started` so the
  intro drop-off denominator is accurate instead of an upper bound; documents
  the admin Access session-length behavior in docs/admin-setup.md (#113) -
  2026-08-17

- Docs accuracy pass, no behavior change: corrected the Worker route count
  (eight, not seven) across CLAUDE.md/README, documented the
  `run_worker_first` trap that made #110 a no-op, added a crawler-surface
  section, and folded in pending doc edits (#112) - 2026-08-12

- Fixes the /result/ noindex from #110, which silently did nothing because
  that route is Worker-served and bypasses `_headers`; the noindex now lives
  as a `<meta>` tag in result/index.html instead (#111) - 2026-08-11

- Adds robots.txt (had become the Worker's largest invocation source),
  declaring a Content-Signal that allows crawl/index while blocking AI
  training, plus the two print-and-play PDFs added to sitemap.xml (#110) -
  2026-08-11

- `/api/city` serves stale-while-revalidate so a visitor never waits on a
  slow sheet round-trip; new `intro_engaged`/`intro_blocked` funnel events
  split the intro drop-off into bounced-on-sight vs refused-by-validation;
  all funnel calls now route through a guarded `trackEvent` after a
  beacon.js-blocked ad blocker was found to break game start entirely; adds
  favicon.ico, apple-touch-icon-precomposed.png, sitemap.xml, and llms.txt
  (#109) - 2026-08-10

- Simplification sweep: unified duplicated share/telemetry code into
  share-card.jsx and beacon.js, dropped dead code (debugFill, unused wheel
  props, the write-only `cv` stamp), folded boot-admin.jsx into
  admin/admin.jsx, and deduplicated several admin templates; no behavior
  change (#108) - 2026-08-09

- Public /city enrichment: `GET /api/city` grows a computed `stats` key
  (campers sum, score histogram, weekly counts, top opportunities) via the
  isomorphic aggregate.js; `/city/` renders the borrowed panels in the
  public palette. Aggregates only, per the allowlist rule (#107) -
  2026-08-09

- Mark-visited write path: the one admin write. Apps Script `doPost`
  `action: "visit"` updates only the Visit cell to `✓ <label>`; Worker
  `POST /api/admin/visit` re-validates the Access JWT and logs the caller
  email; inline are-you-sure button on the route card (#106) - 2026-08-09

- Admin Visits tab: third tab, phone-first, with a team picker (distinct
  Visit-column labels, localStorage), the team's camps in `visitOrder` with
  address/size/score/weakest-sector talking points, route map with numbered
  pins, "Unassigned: N" strip; volunteer-onboarding checklist in
  docs/admin-setup.md (#105) - 2026-08-08

- Admin Playa Map camp-name labels placed to avoid overlapping a pin,
  another label, or the Open camping box; the City tab gains a Visit
  Progress panel beside Sector Averages; docs/apps-script/ is gitignored as
  a deliberately local-only reference (#104) - 2026-08-07

- Admin City tab layout, round two: Sector Averages and Top Camps become
  adjoining columns under the stat tiles, the wheel hero holds a steady
  height, button labels are no longer text-selectable, and the intro's Camp
  location placeholder is "4:20 & D" (#103) - 2026-08-07

- Housekeeping round from a five-agent codebase review: shared helpers
  (isValidEmail, campFills, Badge tones, withMockFetch), shared.css +
  favicon.svg replacing per-page duplicates, trimmed dead exports/props,
  roadmap/doc corrections; plus three UI asks: full-width light red home
  banner with shorter copy, admin City analytics/Superlatives gone
  full-width, and the admin map's Open camping box + instant pin tooltips
  (#102) - 2026-08-07

- Home-page signup-deadline banner: August 10 printed-signage cutoff, playing
  stays open after; auto-hides once the deadline passes Pacific time (#101) -
  2026-08-05

- Admin analytics panel on the City tab: score histogram, Monday-Pacific
  submissions-by-week (current week matches the "+N this week" tile), and
  biggest-opportunity questions (#100) - 2026-08-05

- Intake playa-address hint: soft, non-blocking "doesn't look like a playa
  address" nudge on the intro location field, sharing one parser with the
  admin map via the new playa-address.js (#99) - 2026-08-05

- Admin visit planning: BRC Playa Map on the City tab (pin color = visit
  state), owner-typed Visit sheet column, Camps-tab visit filter and chips,
  walkable visit order (#98) - 2026-08-05

- Consistency pass: required intro fields everywhere, leadName validation,
  meta/copy alignment (#96); admin Camps row meta + Monday-reset week stat
  (#97) - 2026-07-24

- Duplicate handling upgrade: year-scoped union grouping (campId OR normalized
  name per year), admin badges (xN winner count, "superseded", "possible dup"
  for shared email), "Dups" filter, and the Hidden column now resurrects the
  previous submission; timestamp 32-bit wrap bug fixed (#95) - 2026-07-22

- Camp location + headcount intake (required on the board intro, optional on
  the form intake), two new sheet columns, excluded from `/api/city` and the
  email (#94)

- Admin QoL round (Wes's direct ask): /60 scale on Avg Score, two-way column
  sorting everywhere incl. a Submitted header, filters merged into a single
  Camps toolbar (two tidy rows on mobile, CSV/Email desktop-only), search-term
  highlighting, hide-flagged toggle, camp detail modal (all 60 answers + all
  write-in idea slots, corner-pinned close), 100+ camp perf pass (memoized
  rows, debounced search; ~100ms interaction blocks at ~370 rows -> zero),
  BCC clipboard fallback past mailto limits, monotone SVG toolbar icons, and
  the og-card gaining the City-tab sector icons + hub dot (#92) - 2026-07-19

- Load-time round: SWR cache headers + minified dist (#90), Preact runtime
  swap replacing React 18 (~37KB gz saved), and the og-card redesign with a
  committed source, scripts/og-card.html (#91) - 2026-07-18/19

- Admin loading overhaul (Wes's direct ask): early fetch kickoff + localStorage
  stale-while-revalidate, spinning-wheel loading state, Copy Summary moved to
  the Top Camps corner, docs catch-up (#89) — 2026-07-18
- Admin refinement round: colorful tabs, hover-preview radius, Top Camps first,
  all-years filter, "/" search, copy summary, email BCC (#88) — 2026-07-17
- Reliability & delight round shipped: content-version stamp in result links,
  client error beacon, plain-text email part, admin junk flagging, and the
  60/60 golden moment (#82–#86), plus the done-screen `cv` follow-up fix
  (#87) — 2026-07-17
- R4 closed end to end: Apps Script `doPost` dedupe deployed by Wes — 2026-07-16
- A2 settled at the lightest AA greens: fills back to `#558040`, small text
  keeps `#4c7339` via `accentText` (#81) — 2026-07-16
- A2 contrast pass (#76) and R4 double-submit nonce (#79) — 2026-07-16
- Hardening batch: save salvage, a11y, vendor sweep, CI boot-smoke, post-deploy
  verify, reduced-motion consolidation (#68–#75) — 2026-07-16/17
- Full history: `CHANGELOG.md`
