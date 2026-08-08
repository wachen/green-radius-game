# Admin visit workflow + public city enrichment — design

Date: 2026-08-08. Approved by Wes in-session. Three PRs, in order.

## Context and field facts

- BLAST camp visits happen **Tue 9/1 and Wed 9/2, 10a–1p**. About a dozen
  volunteers each day, split into teams of 2 or 3. Everything below must be
  live well before 9/1.
- Volunteers are trusted: each verified volunteer's email goes on the
  **Cloudflare Access allowlist** and they use `/admin/` directly on their
  phone. No new auth surface.
- The sheet's owner-typed `Visit` cell is the single source of truth:
  blank = needs visit, a label = assigned, leading `✓`/`done`/`visited` =
  done (`visitState` / `visitAssignee` in `admin/aggregate.js`).
- **The assignee string is a team label.** Wes types whatever label he likes
  ("Team 1", "Alice + Bo"); the UI treats distinct labels as the roster.
  Everyone on a team picks the same label on their own phone.
- Assumption (confirmed direction, not blocking): each camp is visited once,
  by one team, on one of the two days. One cell models that. Day membership
  is a naming convention in the label if needed, not code.
- Public `/api/city` stays **aggregates only** — the allowlist rule in
  CLAUDE.md is not relaxed. No camp-identifying field is ever added.

## PR 1 — Visits tab (read-only volunteer view)

A third admin tab, phone-first, for the field.

- **Team picker.** First open asks "Which team are you?" listing the distinct
  assignee labels found in the data (plus free-type fallback), stored in
  localStorage. Changeable any time.
- **My route.** The team's camps ordered by the existing `visitOrder` sweep
  (clock hour ascending, then ring outward). One card per camp: camp name,
  playa address, camp size, score /60, the two weakest sectors as talking
  points, and done/pending state.
- **Route map.** The existing `PlayaMap` filtered to the team's camps, pins
  numbered in card order (the straight-above label slot was reserved for
  walking-order numbers in #104).
- **Coordinator strip.** "Unassigned: N camps" so gaps are visible without
  leaving the tab.
- **Docs.** `docs/admin-setup.md` gains an "Onboarding a volunteer" checklist:
  add email to the Access policy, type the team label into the Visit column,
  send them the URL.

## PR 2 — "Mark visited" write path

The one write in the admin system, deliberately the narrowest possible.

- **Apps Script** (Wes deploys; code stays local per the docs/apps-script
  rule): `doPost` gains an `action: "visit"` branch — locate the row by
  campId (fallback: exact normalized camp name + year for campId-less rows),
  overwrite **only the Visit cell** with `✓ <label>`. Same shared secret.
- **Worker:** `POST /api/admin/visit` — re-validate the Access JWT exactly
  like `GET /api/admin/responses`, forward to Apps Script, log the caller's
  Access email with each write (audit trail).
- **UI:** "Mark visited" button on the route card with an inline are-you-sure
  second step (custom, not native `confirm()`). Optimistic update, then
  refetch.
- **Blast radius:** one column, one value shape, one row per call. Cannot
  touch scores, emails, or hidden flags. Assignment stays sheet-side.

## PR 3 — Public /city enrichment (aggregates only)

- **Worker:** `GET /api/city` adds computed aggregate fields via the same
  isomorphic `admin/aggregate.js`: score histogram bins, weekly submission
  counts, top biggest-opportunity questions, camp count, and total campers
  (a sum, never per-camp sizes).
- **Page:** `/city/` renders the borrowed panels beneath the wheel —
  histogram, momentum, opportunities, counts — restyled to the public
  palette. Same 5-minute colo cache, stale-on-error.

## Non-goals

- No in-admin assignment (stays in the sheet).
- No visit notes field, no per-volunteer accounts, no email→name mapping.
- No camp names, addresses, or per-camp sizes on any public surface. The
  roadmap's "opt-in public camp wall" remains gated on the privacy page.

## Verification (every PR)

Compile gate (`bun run scripts/build.js` + clean `dist/` diff), `bun test`,
Playwright check via mock admin server with a fixture that includes team
labels and done states, phone viewport (390×667). PR 2 additionally gets
Worker tests for the new route (JWT gate, forwarding, error shapes).
