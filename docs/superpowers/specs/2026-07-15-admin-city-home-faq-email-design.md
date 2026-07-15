# Design: Admin City glow-up, Home/FAQ fold fit, richer results email

Date: 2026-07-15. Three independent PRs, shipped in this order: A (admin City), B (Home/FAQ), C (email). Approved via brainstorming session.

## Goals

- **PR A** — Make the `/admin/` City tab presentation-quality (it gets projected/screen-shared) while staying information-dense below the fold. Visually align it with the public `/city/` page (teal gradient card language).
- **PR B** — Home screen content (minus the version stamp) fits above the fold on an iPhone 17 Pro (402x874 CSS viewport). FAQ total scroll shrinks modestly (~10-15% of scrollHeight). No copy changes.
- **PR C** — The results email actually states the result: total score, playa-rank title, per-sector scores. The Green-Up Plan stays fully exhaustive (the email is the keepsake record; every "no" and write-in stays).

## PR A: Admin City tab

All changes inside the City tab rendering in `admin/admin.jsx`, plus small pure helpers in `admin/aggregate.js`. Camps tab, data fetch, Access gating, and `/city/` itself untouched. No new scripts, no load-order changes (admin already loads `dist/src/core.js` + `dist/src/badge.js`).

Top-to-bottom layout:

1. **Hero card** — centered card in `/city/`'s visual language: teal gradient `#0e2733 -> #14323f`, dust-glow radial highlight, 24px radius, deep soft shadow, Space Grotesk hierarchy, eyebrow "GREEN RADIUS · BLAST {year}". Contains the existing 300px aggregate RadialBadge (intensities mode), the citywide percentage as the big number (`#7fc46a`), and totalYes/totalPossible beneath.
2. **Pulse row** — three stat tiles: camps counted, total green points citywide, responses this week (`momentum.thisWeek`, already computed). Dark panel, hairline border, big number, small uppercase label.
3. **Superlatives** — one-line extremes: strongest sector, weakest sector (from the `sectorStandings` sort), hardest question (lowest yes-rate in `perQuestion`, with a minimum-asked threshold so tiny samples can't win), most-completed Level 4. Label + value + supporting number.
4. **Leaderboard** — "Reaching Furthest" extended to top 10, each row gains a 44px mini RadialBadge (same pattern as the Camps tab), rank number, camp name, total. Star stays on #1. A small "new" dot marks camps whose response landed in the last 7 days (from timestamps). Score deltas/movers are out of scope (no reliable score history).
5. **Sector Standings + per-question drill-down** — functionally unchanged, restyled to match the new panel/border/header treatment.

Data: everything derives from aggregates `admin/aggregate.js` already computes or can derive purely (superlatives extraction = new pure helpers, unit-testable with `bun test`).

Out of scope (deferred): distribution histogram, median/mean, score deltas over time.

## PR B: Home + FAQ above-the-fold

Surgical spacing pass in `src/home.jsx` (and only if necessary, shared styles in `index.html`). Measure first, then shave the biggest vertical spenders: title margins, mode-tile padding, container vertical padding, footer-link spacing; FAQ section margins/divider padding. No copy changes, no spacing-scale refactor, no structural changes.

Success criteria:
- At 402x874 (iPhone 17 Pro CSS viewport) in Playwright, the home screen's content through the footer links fits in the visible viewport without scrolling; only the version stamp may sit below the fold. Verify with headroom for Safari's bottom bar (~viewport minus ~80px).
- FAQ modal scrollHeight drops ~10-15% vs before, measured at the same viewport.
- Desktop (1280px) renders without regression.

Verification: before/after screenshots + measured pixel numbers via Playwright (`~/.claude/pw/browser.ts`), inspected by a subagent; numbers reported in the PR description.

## PR C: Results email headline

In `worker/index.js` email builder: after the intro paragraph and before the result link, add a headline block:

- Playa-rank title from `rank.js` (`titleFor(total)`) — already imported by the Worker, currently unused in the email body.
- Total: "{total} / 60 green points".
- Six-row per-sector table (Food 7/10, Water 4/10, ...), names/order from `game-data.js` SECTORS. Email-safe: inline CSS only, no images/SVG, dark-green accent readable on white.

`greens` and `total` come from the validated POST `/api/complete` payload. Green-Up Plan, link, and footer unchanged. All dynamic text goes through the existing escaping helpers.

Tests: extend the worker `bun test` suite — email HTML contains rank title, total, per-sector rows; malicious camp names stay escaped.

## Cross-cutting

- Each PR: bump `APP_VERSION` in `src/core.jsx` to the PR number after the PR number is known (open PR, then follow-up commit), run `bun run scripts/build.js` + compile-drift gate + `bun test`.
- Branch from `origin/main` (PR #64 / CHANGELOG.md still open — no changelog edits in these PRs; entries can be added after #64 merges).
- One git worktree per PR branch.
- Copy style: no em dashes in user-facing strings; match surrounding tone.
