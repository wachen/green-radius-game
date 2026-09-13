# 2026 season retrospective

A short look back at the Green Radius Game's first full BLAST season, for
reference going into 2027 prep. Sources: the observability-baseline memory
(Workers Logs funnel pulls) and `CHANGELOG.md`. Facts only: anything the
source data didn't cover is left out rather than guessed.

## Final tally

As of the post-burn pull (2026-09-11, 7 days to 2026-09-12 02:54Z): **64
camps, 2,116 campers, 65% average yes rate** (2,486/3,840 Yes answers
citywide). "Season is effectively over" as of that pull, with game_started
at 3 and submit_succeeded at 1 for the week.

## Funnel

- **Start-to-complete conversion climbed steadily pre-Burn**: 24% to 30% to
  33% to 36% across four weekly pulls (weeks to 2026-08-15/17/19/20), the
  best week being the final pre-Burn week.
- **Intro drop-off was the biggest leak**: in the Aug 3-10 window, 74 mode
  picks produced only 15 starts, an 80% drop between picking a mode and
  actually starting the game.
- **The GTCC newsletter produced a real lift**: sent 2026-08-15 at 4:20am
  PDT, that single day accounted for 57% of that week's starts and 79% of
  its completions, converting at 42% start-to-complete versus 15% on the
  other six days of the same week.

## What shipped when

- **May 2026.** Foundation and the two-mode build: Cloudflare Workers
  config, localStorage persistence, the mode picker, and the linear
  application form (#1-#17).
- **June 2026.** Result capture, sharing, and the first admin viewer:
  auto-emailed result links, the admin response viewer behind Cloudflare
  Access, granular per-question (Levels, not Tiers) capture, and a
  security/usability/a11y hardening pass (#18-#40).
- **July 2026.** Launch hardening through the reliability & delight round:
  vendored runtime, per-camp OG unfurls, the CHANGELOG itself, the CI
  compile-gate plus boot-smoke safety net, the Preact runtime swap, and
  admin visit-planning groundwork (#41-#97).
- **August 2026.** BLAST field-visit tooling and pre-Burn cleanup: the
  Admin Visits tab, the mark-visited write path, public `/city` stats
  enrichment, `/api/city` stale-while-revalidate, the crawler surface
  (robots.txt/sitemap), and docs accuracy passes (#98-#113).
- **September 2026.** Season close: the public city map on `/city/` and a
  permanent home banner linking to it (#114); the 2027-prep batch approved
  2026-09-12.

## What to change for 2027

- **Intro drop-off is the largest leak.** The funnel above shows most lost
  players never get past the intro form after picking a mode; worth a
  dedicated look before the 2027 launch push.
- **Year-keyed question content.** Give `game-data.js` a year key so 2027
  content lands without overwriting 2026's, and old result links keep
  decoding against the question set they were actually played on.
- **Nightly sheet backup.** The Google Sheet is still the only datastore;
  one accidental deletion or Apps Script mishap loses every response ever
  submitted.
- **Year-over-year ghost ring.** A "paste last year's result link" overlay
  showing a dashed prior-year arc and per-sector deltas, timed to pay off
  right at BLAST 2027.
- **Surface and retry failed submits** (plus a resend/fix-typo affordance).
  The done screen never tells a player when the sheet or email leg failed,
  which matters most on flaky playa connectivity.
- **Bus-factor / break-glass doc.** See `docs/break-glass.md`, shipped
  alongside this retrospective.
