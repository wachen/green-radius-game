# Changelog

All notable changes to the Green Radius Game, live at **https://greenradi.us**.

Format is loosely based on [Keep a Changelog](https://keepachangelog.com/). This project
has no separate release cadence: **merging a PR to `main` deploys to production instantly**,
so every squash-merged PR below is effectively a release. From PR #44 onward the in-app
`APP_VERSION` stamp (shown at the bottom of the home screen) equals the PR number, so `vNN`
and `#NN` refer to the same release. Entries are grouped newest-first by milestone.

## Roadmap round: reliability & delight (#82–)

- Adds robots.txt, which had become the Worker's largest single source of
  invocations. With no file at that path, Cloudflare probed the origin to decide
  whether to merge with or create one, and the Worker answered 404 roughly 26
  times a day: 26 of the 42 404s still reaching it in the 24h after the scanner
  WAF rule landed (that rule cut total invocations 175 to 106 and 404s 150 to
  42). Crawlers never saw those 404s, because Cloudflare injects AI-crawler
  content at /robots.txt when the origin has no file of its own, but what it
  injected carries no Sitemap line, so the sitemap.xml added in #109 had no
  discovery path. The new file is deliberately minimal and takes over that
  injected slot: with "Manage your robots.txt" on, which is now the zone's
  setting, Cloudflare merges its managed AI-crawler block into ours and both
  survive. AI-crawler enforcement is a separate dashboard setting, unaffected
  either way, so the Disallow rules are deliberately not restated in the file.
  /result/ now sends X-Robots-Tag: noindex, keeping individual camps' names and
  scores out of search results while still letting link unfurlers fetch the page
  for the OG share card (a robots.txt Disallow would have blocked the fetch and
  broken previews). The sitemap gains the two print-and-play PDFs, which camps
  use once they have no connectivity on playa, and refreshed lastmod dates.
  /robots.txt is cached for a day alongside the other crawler files. (#110)

- GET /api/city serves stale-while-revalidate: past the 5-minute freshness
  window the cached tally is returned immediately and refreshed in the
  background, so a visitor never waits on the sheet round-trip. Cloudflare
  analytics for Aug 3-10 showed /api/city averaging 2.7s and twice dying at
  8.3s with a 502 while a usable cached entry sat unused. Only a cold cache
  still blocks. The "Live tally unavailable" banner now needs 30 minutes of
  failed refreshes (CITY_STALE_MS) rather than firing the moment data passes 5
  minutes, so it again means "upstream is down" and not "a few minutes behind".
  Two new funnel events, intro_engaged and intro_blocked, split the intro
  screen's drop-off (74 mode picks produced 15 starts over the same window)
  into bounced-on-sight versus refused-by-validation, the latter recording
  which required fields were missing (names only, never values). Adds
  favicon.ico, apple-touch-icon-precomposed.png, sitemap.xml, and llms.txt,
  all of which had been 404ing into the Worker.
  Also fixes a live outage class found while reviewing the above: funnel calls
  invoked beacon.js's window.sendEvent unguarded, so a beacon.js that failed to
  load (network blip, or an ad blocker matching its filename) threw from the
  mode picker's click handler and the game could not be started at all — and
  reported nothing, because the client-error beacon lives in that same blocked
  file. All ten call sites now route through a guarded trackEvent (src/core.jsx,
  loaded first on every page), and test/boot-smoke.mjs gains a beacon.js-blocked
  case that fails if it regresses. intro_engaged is once per page load rather
  than per mount, so stepping Back and returning no longer counts one player
  twice. (#109)

- Simplification sweep, no behaviour change: unified the share/download and
  telemetry-beacon blocks that were copy-pasted between green-radius.jsx and
  boot-result.jsx into share-card.jsx and beacon.js; dropped the dead debugFill
  branch, the unused variant/centerLabel props (the wheel's unreachable
  "dimensional" design direction went with them), and the write-only cv content
  version stamp from result links; folded the 1-line boot-admin.jsx into
  admin/admin.jsx; deduplicated admin idea-chips, question rows, the camps grid
  template and the pin-radius formula; replaced hand-rolled list grammar with
  Intl.ListFormat and a hand-rolled highlight scan with a split-on-capture-group.
  Old result links containing cv still decode identically, and saves written by
  the deployed build still resume — both now pinned by tests. (#108)

- Public /city page grows four aggregate-only panels: City pulse (camp count
  plus about-N-campers), Score spread (histogram), Momentum (submissions by
  week, current week highlighted), and Where the city can grow (the five
  lowest citywide yes-rate questions). GET /api/city now returns a computed
  `stats` key (campers sum, histogram bins, weekly counts, top opportunities)
  built from the same isomorphic aggregate.js population as the existing
  tally, so the numbers always agree; every field is an aggregate and the
  camp-identifying-fields allowlist rule stands (tests regex-sweep the
  serialized response to prove it). The page guards every field, so a stale
  cached old-shape response renders exactly as before. Also fixes the
  long-standing iPhone layout bug on /city/ and /result/ where the loading
  spinner and content sat too low with dead space up top: Safari centers
  flex children against the container's min-height instead of its grown
  height, so tall content overflowed upward; centering now rides on the
  child's margin auto (clamps to zero on overflow) and the pages use 100dvh
  so the visible-viewport center is the real center. And the result page's
  Download button goes keepsake terracotta so Continue improving is the only
  green button (#107)

- Mark visited from the Visits tab: the one write in the admin system. A
  pending route card gains a full-width "Mark visited" button with an inline
  are-you-sure step (no native dialogs); confirming POSTs to the new
  Access-JWT-gated Worker route POST /api/admin/visit, which forwards an
  action-discriminated payload to the Apps Script web app to write "✓ team"
  into that row's Visit cell (campId match first, exact camp+year fallback)
  and logs the caller's Access email per attempt. The card flips green
  optimistically and a failed save restores the button with a gentle retry
  note. Apps Script paste-in + deploy-order warning in docs/admin-setup.md
  section 8; 11 new Worker tests. Also: the home signup banner deadline pushed back to August 17 (auto-hide follows) (#106)

- Admin Visits tab: a third, phone-first tab for the Sept 1-2 BLAST camp
  visits. A volunteer picks their team label once (remembered per device,
  free-type fallback), then sees their camps in a numbered walking order with
  address, headcount, score, and weakest-sector talking points, plus the playa
  map narrowed to their route; the picker panel also shows route progress and
  the city-wide unassigned count. Volunteer onboarding checklist added to
  docs/admin-setup.md; design spec for this and the next two rounds committed
  under docs/superpowers/specs/ (#105)

- Admin Playa Map camp-name labels: every mapped pin now shows its camp name,
  placed greedily around the pin (right, left, below, diagonals) so labels
  never overlap a pin, another label, or the Open camping box; pins too
  crowded to label keep their name in the hover tooltip, which stays the
  deep-info surface (name, address, score, visit state); docs/apps-script/ is
  gitignored as a deliberately local-only reference; the City tab gains a
  Visit Progress panel under Sector Averages (stacked visited/assigned/to-visit
  bar in the map legend's colors, plus total campers represented), filling the
  dead space beside Top Camps (#104)
- Admin City desktop layout, round two: the left column is now just the city
  wheel, with Sector Averages (single column, sorted descending) and Top Camps
  as adjoining columns under the stat tiles, cutting the tab's vertical dead
  space; the wheel's question-detail box now always renders (dim placeholder
  before the first hover) so the hero height never jumps; button labels across
  all pages are no longer text-selectable on long-press (they are controls,
  not copy); the intro's Camp location placeholder is now "4:20 & D" (#103)
- Admin Playa Map: camps with no plottable address now pin inside a dashed
  "Open camping" box in the map's free corner (visit-state color, click-through
  to the Camps tab included), and all pins get instant styled hover tooltips
  (camp name, address, score, visit state) replacing the slow native ones
  (#102)
- Admin City tab: Superlatives and the analytics panel move out of the right
  column to span full width above the playa map, closing the dead gap that
  sat under Sector Averages (#102)
- Home banner restyled: a full-width light red strip across the top of the
  frame with shorter copy, "Sign up by August 10 to be included on printed
  signage!" (#102)
- Housekeeping round from a five-agent codebase review: shared isValidEmail /
  BACK_BTN_STYLE / campFills / Badge / withMockFetch / sectorTotal helpers
  replace copy-pasted logic, shared.css and favicon.svg replace per-page
  duplicates, dead ShareCard/ResultCardSVG props and unused aggregate.js
  exports removed, roadmap brought current through #101 (#102)

- Home-page signup-deadline banner: a small amber announcement at the top of the mode picker ("Signup deadline: August 10. Submit by then to be included in the printed signage. Playing stays open after that."), styled on the existing restored-save banner idiom; it auto-hides once the deadline passes in Pacific time (Aug 11 00:00 PDT) so no removal deploy is needed, and it is purely presentational (no state, no storage shape change) for a safe mid-season rollout (#101)
- Admin analytics panel: the City tab gains a compact three-part analytics panel under Superlatives - a Score Spread histogram (0-60 totals in six buckets of ten, so you can see where camps cluster), a Submissions by Week bar chart (last 8 calendar weeks on the same Monday-Pacific boundary as the momentum tile, current week highlighted and always equal to the "+N this week" number), and a Biggest Opportunities list (the 4 lowest city-wide yes-rate questions with at least 3 answers - what GTCC should teach or provision next); all computed client-side from the already-fetched rows over the same population as every other aggregate (hidden out, legacy out, deduped), no backend changes; the shipped entry is removed from the roadmap's Proposed list (#100)
- Intake playa-address hint: the intro's Camp location field shows a gentle non-blocking nudge after you leave the field if the text doesn't parse as a playa address ("Hmm, that doesn't look like a playa address (like 7:30 & E)..."), so more submissions land on the admin Playa Map without a sheet fix; the address grammar moved from `admin/aggregate.js` into a shared `playa-address.js` (`window.PlayaAddress`, same isomorphic IIFE pattern as `result-state.js`) loaded by the game and admin pages and required by the aggregate module under bun and the Worker bundle, so the hint and the map can never disagree; the new script joins the `_headers` stale-while-revalidate list (#99)
- Admin visit planning: the admin City tab gains a pure-SVG Playa Map - every camp with a parseable playa address (tolerant of "7:30 & E", "E & 7:30", "730 and Esplanade") pinned on the Black Rock City street grid (ring arcs Esplanade-K, radial streets 2:00-10:00), pin size tracking headcount and pin color tracking a new owner-typed `Visit` sheet column (blank = needs visit, volunteer name = assigned, leading ✓ or done/visited = visited; column T or later, after Hidden - same positional-appendRow rule); a volunteer picker numbers that person's camps in a suggested walking order (2:00→10:00 sweep) with a matching route list, unparseable addresses are listed under the map for a sheet fix instead of being guessed, and clicking a pin jumps to that camp on the Camps tab; the Camps tab adds a visit-status filter (needs visit / assigned / visited) plus "visit: name" and "visited ✓" row chips (also in the detail modal); the `visit` field is served on the Access-gated admin route only, never `/api/city`; setup steps in `docs/admin-setup.md` section 6, and the brainstormed follow-on ideas (intake address hint, admin analytics panel) are recorded in the roadmap (#98)
- Admin Camps tab: each row now shows the camp's playa address and headcount ("5:00 & A · 30 campers") under the camp name, and the submitter's name and email sit on separate lines (was one bulleted line) for uniform row heights; the "this week" momentum stat (admin City tab and /city page) now counts the current calendar week resetting Monday 00:00 Pacific (playa time, pinned in both the browser and the Worker) instead of a rolling 7-day window that never visibly reset, and the "new this week" row dots use the same boundary; admin guide fix: the `Hidden` column must sit after `Location` and `Camp Size` (column S or later) - `doGet` reads by header text but `doPost` appends positionally into Q/R since #94, so a `Hidden` column at Q or R would swallow location/size text and silently self-flag new rows; docs housekeeping pass: every Worker route list (README, CONTRIBUTING, CLAUDE.md, architecture) now includes `POST /api/event` and `POST /api/client-error` and architecture documents the client-error beacon, CLAUDE.md catches up on the `boot-*.jsx` mount scripts and CI's boot-smoke job, the admin guide's Apps Script snippets match the deployed 18-column sheet (the section-4 `appendRow` sketch was missing the Total column, which would have shifted every field after it one cell left), and the momentum week semantics are documented in the architecture map (#97)
- Consistency pass: Camp Location and Camp Size are now required on the intro in both modes (form mode previously left them optional; the always-true `locationSizeRequired` prop is gone and the Worker still tolerates their absence on older saves); the Worker validates `leadName` alongside the other required fields (it was required client-side but never checked server-side) and the documented `/api/complete` contract now lists it; the result and city pages gain the `theme-color` meta the home page already had; the completion email drops its em dashes (subject now "Your Green Radius: Camp") to match the site copy style; write-in idea notes now allow the full 160 chars the Worker and docs already specified (the UI cap was 140); and the og-card share image is redesigned on a lighter cream background (#E3DACB) with a thick dark-green border (#96)
- Duplicate handling overhaul: dedup now uses year-scoped union grouping (rows merge when they share a campId OR the same normalized camp name in the same year; email only merges legacy rows without campId since a shared address can legitimately mean one person running two camps); the admin badges winners as xN count, marks older rows as "superseded", flags shared-email rows as "possible dup", and a "Dups" filter shows flagged rows; a timestamp-comparison bug (32-bit wrap every ~49.7 days) is fixed; the Hidden-column behavior of resurrecting a camp's previous submission when its latest is hidden is now documented in the admin guide; `GET /api/city` filters to the latest season present (#95)
- Camp location and headcount are now collected on the intro screen (required on the board-game intro, optional on the form-mode intake, same shared `Intro` component gated by a `locationSizeRequired` prop); the Worker clamps/coerces both fields, tolerates their absence on older saves, and forwards them to two new Apps Script sheet columns and the admin API - they're excluded from the completion email and the public `/api/city` tally (#94)
- Fix the post-deploy verify script's version poll: it still grepped for the pre-minification `APP_VERSION = "vNN"` stamp (with spaces), so it could never match the minified dist that #90 started shipping and the post-deploy-verify workflow had failed silently on every merge since (#90, #91, #92); the match is now whitespace-tolerant (#93)
- Admin quality-of-life round: the City tab's Avg Score tile (and the Copy Summary digest) now show the /60 scale; every Camps column header sorts both ways (first click uses the column's natural direction - text A→Z, numbers/dates high-first - clicking again reverses, with ▴/▾ indicators and a ↑/↓ toggle beside the sort dropdown for narrow screens; the default view stays newest-first); the year/source filters and Refresh button moved from the page footer to a filter row under the header where they scope both tabs, leaving only the sign-off quote in the footer; the Camps toolbar reads search-first (search + live count left, sort controls and CSV/Email actions right); the og-card share image gains the sector icons and black hub dot so it matches the radius as the City tab presents it; and the Camps list is prepped for 100+ camps: rows are memoized and the search box filters through precomputed per-row haystacks on a 120ms debounce (measured at ~370 rows: sort clicks and typing dropped from ~100ms main-thread blocks to none), while the BCC Email button copies the address list to the clipboard when the mailto: URL would exceed what mail clients accept (~75 addresses); clicking any Camps row (or pressing Enter on it) opens a focused camp detail modal - badge, identity, submitted/source line, total, result link, and every question spelled out with its ✓/✕ per level plus quoted write-in ideas - closed by Escape, click-outside, or its ✕, with the shared modal focus trap; extra write-in idea slots 2-4 (the synthetic X-camp-2/3/4 ids) now surface in the row IDEAS line, the CSV export, and the modal instead of being silently dropped; a Submitted header joins Camp so date sorting is clickable on desktop; a "Hide flagged" toggle tucks owner-flagged junk/test rows away (they stay listed by default for audit); camp rows show the City tab's green new-this-week dot; search matches are highlighted in gold wherever they hit (camp name, lead, email, or an idea note) so the eye lands on why a row matched; and the detail modal slimmed down - one-line question titles (the full prompt moved to hover), a three-column sector grid in a wider card, and a smaller header badge - so a whole camp fits one desktop screen; the year/source/Refresh controls merge into the Camps search toolbar as a single row (the standalone filter row remains on the City tab and whenever the Camps toolbar is not shown, so an empty filter result can always un-trap itself); the CSV and Email buttons trade their emoji for monotone line-drawn SVG icons (file and envelope, matching the sector icon stroke style); the detail modal's ✕ is pinned to the card's absolute top-right corner, staying put while the content scrolls on mobile; the Refresh button gains the customary circling-arrows icon (icon-only below the desktop breakpoint); and the narrow-screen Camps toolbar is rebuilt as two intentional rows - full-width search with the count beside it, then the year/source/sort/direction/refresh pills on one line - with the CSV and Email actions dropped on mobile where they are not needed (#92)
- og-card refresh: the share/hero image (`og-card.png`, also the README hero) is redesigned to match the brand - the real 60-segment radius graphic (rendered by the live RadialBadge component in the game board's LEVEL_COLORS green ramp, showing a balanced 34/60 showcase fill (all of levels 1 and 2 lit, levels 3 and 4 scattered), pixel-verified after each render; the old off-brand colors are gone), the black spinner pointer on top, "GREEN THEME CAMP COMMUNITY" kicker, "Green Radius" in green with "Game" in ink, a one-sentence pitch, and a "greenradi.us ↗" pill; the card now has a committed source (`scripts/og-card.html`, never served) instead of being a source-less PNG, and the README hero links to https://greenradi.us/; runtime swap to Preact: the vendored React 18 + ReactDOM UMDs (~47KB gz, the biggest slice of cold-load payload) are replaced by Preact 10.29.7 core + hooks + compat UMDs plus a small first-party shim that exposes `preactCompat` as `window.React`/`window.ReactDOM` (incl. a `createRoot` mirrored from `preact/compat/client.js`) — ~10KB gz total, cutting the home page's JS payload by roughly a third; the precompiled game scripts are byte-identical, still calling `React.createElement` and hooks by those names, and all four entry points swap in the new script quartet (#91)
- Home page load speedup: the unversioned first-party scripts (`dist/*`, `game-data.js`, `result-state.js`, `beacon.js`, `admin/aggregate.js`) now serve `Cache-Control: max-age=300, stale-while-revalidate=86400` instead of `max-age=0` — a repeat visit used to pay 13 conditional-request round-trips before running scripts it already had cached; now they run instantly and revalidate in the background (the HTML stays `max-age=0`, so deploys still show up on the next navigation). `scripts/build.js` also emits the `dist/` artifacts whitespace-minified (`minifyWhitespace`, no identifier renaming so the shared-global bare-name contract is untouched), cutting the compiled game scripts ~23% raw / ~9% gzipped (#90)
- Admin viewer loading overhaul: the data fetch now starts from an inline kickoff in `admin/index.html` (in parallel with the script downloads) instead of waiting for React to mount, and the last good response is cached in `localStorage` so repeat visits paint the previous rows instantly (dimmed) while the fresh fetch runs; cold loads show a spinning six-wedge wheel (the favicon art) in both the static placeholder and the React loading state; the City tab's copy-digest button moved from the hero pill to the Top Camps panel's top-right corner, relabeled "Copy Summary"; docs caught up on the #85–#88 admin/result features (#89)
- Admin viewer (`/admin/`) refinement: big colorful City/Camps tabs replace the plain nav links; the year/source filters and Refresh button moved below a rule at the bottom of the page; the City tab's radius graphic lost its center percentage (already shown above it), got a thinner horizontally-centered content box, and now previews a question on hover (click/tap still works); "Top Camps" (was "Reaching Furthest") moved to the top of the stats column and shows all 10; "Sector Averages" (was "Standings") moved under the radius box; two new superlatives (easiest question, top level 3) plus title-attribute tooltips throughout; the Camps tab swaps the search/sort controls with the camp-count/CSV button and drops the redundant footer count; the home page's tiny version stamp quietly links to `/admin/` as an unadvertised team door; quality-of-life extras: an "All years" filter option, press-/-to-search with Escape to clear, a copy-summary button on the City hero, a BCC email-draft button beside CSV, and hovering a Top Camps row previews that camp's wheel on the big radius; roadmap refresh: 27 new Proposed ideas from the 2026-07-16 brainstorm, ordered by importance; the #82–#87 round recorded as done and the owner-side Apps Script step for #85 tracked under Waiting (#88)
- Fixed a gap from #82: the done-screen's result-link `encode()` call was missing `contentVersion`, so links minted from the done screen (rather than right after submit) lacked the `cv` content-version stamp; both call sites now match (#87)
- A one-time golden celebration fires when a camp reaches a perfect 60/60, bigger and gold-toned versus the existing per-sector splash; the downloaded ShareCard and result-page card get a matching gold ring/accent treatment, with every other total rendering unchanged (#86)
- Admin junk-row flagging: the owner can flag a junk/test submission (a typed value in a new sheet "Hidden" column) to exclude it from the public `/api/city` tally and the admin City tab, while it stays visible, dimmed with a "hidden" chip, on the admin Camps tab for audit; read-side only, tolerant of the sheet column not existing yet (#85)
- Result emails now send a plain-text alternative alongside the HTML body (headline, per-sector breakdown, result link, Green-Up Plan, footer) — a missing plain-text part is a common spam-filter signal; DNS check confirmed SPF/DKIM/DMARC are already fully configured for `greenradi.us` (#84)
- Added a client-side error beacon: `/beacon.js` installs `window.onerror`/`unhandledrejection` handlers and posts a bounded, log-only report to a new `POST /api/client-error` Worker route, so silent white screens on odd playa phones now surface in Workers Logs (#83)
- Stamped a `CONTENT_VERSION` ("2026") into the shared result link's `?r=` payload as an optional `cv` field, so a future year-over-year ghost-ring overlay can tell whether two result links answered the same question set; legacy links without it decode unchanged (#82)

## Hardening for the playa: save safety & accessibility (#68–)

- Added `docs/roadmap.md` as the single prioritized backlog, with a CLAUDE.md rule that only its Approved items get built (#80)
- A2 settled at the lightest WCAG-AA greens: button fills brighten back to the brand `#558040` (4.6:1 under white labels), small green text keeps `#4c7339` via a new `accentText` token, and the Spin label goes pure white (#81)
- Double-submit guard (review item R4): each submission carries a persisted idempotency nonce, reused when a reload replays the POST; the Worker passes it to the sheet backend and uses it as the Resend Idempotency-Key so a replay can't send the result email twice (#79)
- Contrast pass (review item A2): every white-labeled green button (Start, Yes, Submit, Download, Spin hub, mode tile, result/city page CTAs) and the green text links now use a single WCAG-AA action green `#4c7339`, with a deeper `#38542b` for the tactile button foot; the bright brand green stays on decorative accents (#76)
- Reduced-motion pass: the wheel spin, particle-FX bursts, and sector celebration already honored the OS `prefers-reduced-motion` setting (skip particles, near-instant spin, quiet celebration flash) — those checks are now consolidated into one shared `prefersReducedMotion()` helper in `src/core.jsx` instead of five duplicated inline reads (#75)
- CI now boots all four pages (`/`, `/result/`, `/city/`, `/admin/`) in headless Chromium on every PR, catching a page that loads but silently fails to render (the class of bug behind the #66-era `ShareCard`-undefined incident) before it can merge (#74)
- Added a post-deploy verify workflow that polls the live site for the new APP_VERSION stamp and checks a URL matrix (dist/ scripts 200, retired/excluded paths 404) after every push to `main`, catching regressions like #71 automatically (#73)
- Changelog debt paid for the #71 hotfix and the `.assetsignore` anchoring gotcha documented in CLAUDE.md (#72)
- Hotfix: anchored `/src` in `.assetsignore` — unanchored, it also matched `dist/src/` and briefly 404'd the compiled game scripts right after #70 deployed (#71)
- Vendor sweep — deleted the unloaded `vendor/babel-standalone` runtime and the retired `rank.js`, and stopped serving the `.jsx` sources (`src/`, `green-radius.jsx`) on the prod domain now that `dist/` is the only runtime load path (#70)
- Radial badge SVGs get a spoken `aria-label`, Yes/No/FAQ-close/PDF-link touch targets grow to 44px via invisible hit-expansion, not visual size (#69)
- Three ways to lose progress, closed: an older-version autosave is now salvaged (answers, camp info, and campId recovered) instead of wiped; a phone back-swipe during the question modal closes the modal instead of exiting the site (#68)

## Polish: presentation, keepsakes & small screens (#64–)

- Added this changelog, documenting every release since #1 (#64)
- Home screen fits above the fold on modern iPhones and the FAQ got a little shorter, spacing only (#67)
- Results email now opens with the result — X/60 achieved plus a per-sector table; playa-rank titles retired everywhere (#66)
- Admin City tab glow-up — the /city/ card look (teal hero, dust glow) plus pulse tiles, superlatives, and a top-10 mini-badge leaderboard (#65)

## Post-launch: safety net, analytics & payload diet (#56–#63)

- Payload diet — precompiled JSX with `babel-standalone` off the critical path, cutting cold load ~87% (756 KB → 98 KB gzip) for playa-grade connections (#63)
- The return loop — result links became portable saves, so a camp can resume anywhere and keep improving before the burn (#62)
- Activated Cloudflare Web Analytics with the real site token (#61)
- Docs: recorded the workers.dev-off / preview-URL posture as a #56 follow-up (#60)
- Camp identity + duplicate-proof aggregates — public and admin stats now count camps, not duplicate rows (latest-wins dedup) (#59)
- Analytics — Cloudflare Web Analytics pageviews plus funnel events in Workers Logs (#58)
- CI safety net — every PR now runs a compile/parse gate plus `bun test` before it can touch prod (#57)
- Disabled the persistent workers.dev route while keeping gated preview URLs (#56)

## BLAST 2025 content & the public city (#49–#55)

- Modularized the game UI — split the `green-radius.jsx` monolith into shared-scope `src/*.jsx` modules (#55)
- Logo: removed the residual "radioactive" read (ramp + white seams) (#54)
- BLAST 2025 re-check — parity tweaks to a few questions (#53)
- Community progress goes public — the `/city/` page plus a cached, aggregate-only `/api/city` (#52)
- Fixed Level-4 write-in note delivery and refreshed the living docs (#51)
- Question content overhaul — full alignment to BLAST 2025 with editorial passes (#49)

## Polish, fun & performance (#41–#48)

- Home + FAQ polish — field-guide About modal, monoline icons, inverted masthead, tactile buttons (#48)
- Edge perf + Worker hardening — compressed the JSX, vendored fonts, bounded upstream fetches (#47)
- Thanks-page overhaul — dropped ranks, redesigned the Green-Up Plan, added a feedback CTA and BLAST branding (#46)
- Visual polish — the `FxLayer` particle-juice pass (#45)
- Admin overhaul — full-width all-data camp rows, sorting, and CSV export (#44)
- Home page polish — About redesign, wheel hero, back flow, single download (#43)
- Added the `/api/health` liveness probe for uptime monitoring (#42)
- Faster spin, Level-4 write-in ideas, and board copy polish (#41)

## Launch hardening & reach (#35–#40)

- Docs: post-#39 documentation currency sweep (#40)
- Reach + Green-Up — Web Share L2, per-camp OG unfurls, playa-rank titles, and the Green-Up Plan (#39)
- Launch hardening — prod-domain hygiene, vendor caching, privacy copy, and a runbook (#38)
- Resilience + reach — vendored runtime, in-`#root` loading state, security headers, result fallback + OG, board Back, fluid card, admin a11y + legacy rows (#37)
- Data-safety + robustness cluster of fixes (#36)
- Security + usability + a11y hardening from review follow-up (#35)

## Admin viewer & granular capture (#31–#34)

- Docs: reflected the admin viewer in the summary docs (two Worker routes + `admin/`) (#34)
- Admin response viewer (City + Camps tabs) behind Cloudflare Access (#33)
- Per-question Level fill, level colors, and granular capture (Levels, not Tiers) (#32)
- Result screen — auto-email on completion, PNG download, Exit (#31)

## Results, sharing & content fixes (#18–#30)

- Fixed the Green Camp Resource Guide links (added `/resource-guide/`; transport→transportation) (#30)
- Email fields now use the email keyboard (no auto-capitalize) (#29)
- Fixed broken question/topic links in `game-data.js` (#28)
- Required camp fields; Tiers 1–3 mandatory, Tier 4 optional; game None button (#27)
- Paginated the application form one sector per page (#26)
- Added `CLAUDE.md` for Claude Code guidance (#25)
- Added the home-page FAQ modal; swapped sector icons to Lucide glyphs (#24)
- Documentation pass — post-#22 currency fixes plus an end-to-end architecture map (#23)
- Complete by sector — one spin answers all 10 questions and celebrates 4/4 sweeps (#22)
- Docs: refreshed README for Cloudflare, added CONTRIBUTING and a dev-secrets template (#21)
- Surfaced sector resource links in the quiz + JSX housekeeping (#20)
- Fixed the blank `/result/` page (missing `ShareCard` reference) (#19)
- Captured results and emailed players a Green Radius result link (#18)

## Two game modes take shape (#4–#17)

- Mobile + a11y polish; design-consistency pass (#17)
- Captured camp info on the form path + refreshed intro copy (#16)
- Added an unobtrusive wheel Reset and a diminutive form Clear (#15)
- Implemented the linear application-form mode (#14)
- Inlined the PDF download links on a single row (#13)
- Added a "How to Play" PDF download link (#12)
- Set the playa-dust background (#D8CBB6) outside the phone frame only (#11)
- Fixed SectorIcon clip, tightened mode-picker rhythm (#10)
- Added six sector icons as a visual divider on the mode picker (#9)
- Restored `www.` on the Green Theme Camp Community link (#8)
- Added the "6 SECTORS · 4 LEVELS" caption to the camp-info screen only (#7)
- Removed the "6 SECTORS · 4 LEVELS · 10 QUESTIONS" caption from the mode picker (#6)
- Intro revamp — PRESENTS line, Green Radius Game title, email field, Back button (#5)
- Mode picker — two-button intro (board game / form-based) (#4)

## Foundation (#1–#3)

- Persist game state to `localStorage` so a refresh resumes the game (#3)
- Added `_headers` for Cloudflare Workers static-asset compatibility (#2)
- Added the Cloudflare Workers configuration (#1)

---

_PR #50 (a docs refresh) was closed unmerged; its updates were folded into #51._
