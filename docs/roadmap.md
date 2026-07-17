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

_(empty — move items up from Proposed to green-light them)_

## Proposed — needs Wes's call

- **Privacy page + retention/deletion path** (SG · small-med) — the game collects
  camp name, lead name, and email with one consent sentence and no privacy page,
  retention policy, or deletion route. Highest-value open gap for something
  holding real emails. Could be a single static page plus a documented "email us
  to delete" path.
- **PDF version stamp / refresh** (SG · small) — the linked "v26 FINAL" board PDF
  (May 19) predates the Levels scoring rework, so paper players play a different
  game. Cheapest fix: stamp the web app's rules version on the download link and
  note the differences; fuller fix needs a regenerated PDF from GTCC.
- **Year-over-year ghost ring** (FE-6 · med) — "paste last year's result link"
  draws a dashed last-year arc + per-sector deltas. Zero migration (the emailed
  result link is the durable record). Build now, pays off at BLAST 2027.
- **On-playa offline story** (SG · med) — runtime is vendored, but there's no
  service worker or "needs signal" messaging. Decide the story before the burn:
  add a minimal service worker, or just honest messaging.
- **LICENSE / provenance fix** (SG · small, owner decision) — LICENSE says MIT
  (c) the legacy owner over BLAST framework content that may not be the repo's to
  relicense. Needs your call on the right holder/terms.
- **City histogram / median** (deferred idea · small) — richer `/city/` stats
  once the camp count grows enough to be meaningful.
- **Sheets → D1 migration** (deferred idea · med) — only if analytics ever shows
  quota-driven submit failures. No signal yet.
- **Bus-factor / break-glass doc** (SG · small, mostly owner-side) — secrets and
  the Cloudflare/Resend/Google accounts are single-holder; HSTS means the site
  can't be casually retired. Document succession or add a co-owner.

## Waiting on something

- **R4 Apps Script dedupe** — owner action: paste the updated `doPost` (delivered
  2026-07-16) and redeploy the web app as a new version of the existing
  deployment. The Worker-side email dedupe is already live.
- **Funnel dashboard first look** — needs ~2 weeks of Web Analytics data; check
  in late July.
- **A2 shade tune** — optional; only if the darker AA green (`#4c7339`, shipped
  in #76) reads wrong in person. One palette token to change.

## Shelved — do not build without an explicit ask

- **U5 identity-at-end** — intro fields optional, "Get your results" card on the
  done screen. Fully built and Playwright-verified, then shelved by Wes
  2026-07-16 before deploy. The complete diff is preserved in closed PR #78.

## Recently done

- A2 contrast pass (#76) and R4 double-submit nonce (#79) — 2026-07-16
- Hardening batch: save salvage, a11y, vendor sweep, CI boot-smoke, post-deploy
  verify, reduced-motion consolidation (#68–#75) — 2026-07-16/17
- Full history: `CHANGELOG.md`
