# Changelog

All notable changes to the Green Radius Game, live at **https://greenradi.us**.

Format is loosely based on [Keep a Changelog](https://keepachangelog.com/). This project
has no separate release cadence: **merging a PR to `main` deploys to production instantly**,
so every squash-merged PR below is effectively a release. From PR #44 onward the in-app
`APP_VERSION` stamp (shown at the bottom of the home screen) equals the PR number, so `vNN`
and `#NN` refer to the same release. Entries are grouped newest-first by milestone.

## Roadmap round: reliability & delight (#82–)

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
