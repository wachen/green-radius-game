# Changelog

All notable changes to the Green Radius Game, live at **https://greenradi.us**.

Format is loosely based on [Keep a Changelog](https://keepachangelog.com/). This project
has no separate release cadence: **merging a PR to `main` deploys to production instantly**,
so every squash-merged PR below is effectively a release. From PR #44 onward the in-app
`APP_VERSION` stamp (shown at the bottom of the home screen) equals the PR number, so `vNN`
and `#NN` refer to the same release. Entries are grouped newest-first by milestone.

## Polish: presentation, keepsakes & small screens (#64–)

- Added this changelog, documenting every release since #1 (#64)
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
