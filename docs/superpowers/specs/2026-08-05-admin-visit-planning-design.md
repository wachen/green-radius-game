# Admin visit planning: playa map + Visit column (design)

Date: 2026-08-05 · Status: approved (Wes, 2026-08-05) · Scope: one PR (#98)

## Goal

Admins will soon plan volunteer camp visits. Give the admin City tab a map of
Black Rock City with every mappable camp pinned from its submitted playa
address, and thread a lightweight visit-tracking state through the existing
owner-typed-sheet-column pattern so pins and rows show who still needs a visit,
who is assigned, and who is done.

Approved approach: pure client-side SVG (no map library, no tiles). A BRC
address like `7:30 & E` is already a polar coordinate — clock radial (angle)
by lettered ring (radius) — so the city renders as arcs and pins with zero
dependencies, matching the app's existing SVG-arc idiom (`RadialBadge`).

Rejected: Leaflet/geo tiles (dependency + network + against the no-bundler
ethos); table-only route list (its best part, sector grouping, folds into the
map's walking order instead).

## Data model

### New sheet column: `Visit` (owner-typed)

- Header `Visit`, placed **after `Hidden` — column T or later**. `doPost`'s
  `appendRow` is positional (writes A–R); owner-typed columns must sit after
  every written column, same rule as `Hidden`.
- Cell convention: blank = needs visit; a volunteer's name (`Alice`) =
  assigned; a leading `✓` or the word `done`/`visited` (`✓ Alice`, `done`) =
  visited. Free text, parsed tolerantly, fails open to "assigned".
- Apps Script `doGet` gains one mapping line: `visit: r[col['Visit']] || ''`.
  Header-addressed, so it fails open (key absent → feature dormant) until the
  column exists.
- Worker `shapeAdminRows` allowlists `visit` (admin route only — **never**
  `/api/city`, which stays aggregate-only).

### Address parsing + geometry (pure functions, `admin/aggregate.js`)

- `parsePlayaAddress(str)` → `{ hour, ring }` or `null`. Tolerant of both
  orders and common separators: `7:30 & E`, `E & 7:30`, `7.30 and Esplanade`,
  `730 & e`. `hour` is decimal clock hours, valid 2:00–10:00; `ring` is 0 for
  Esplanade (`esplanade`/`esp`), 1–11 for A–K. Unparseable → `null` (row goes
  to the unmapped list, never guessed).
- `playaXY(addr)` → `{ x, y }` in unit space: Man at origin, 12:00 up, SVG y
  down (θ = hour/12·2π; x = r·sinθ, y = −r·cosθ). Radius: Esplanade 0.40,
  +0.05 per ring (K = 0.95).
- `visitState(visit)` → `'none' | 'assigned' | 'done'`;
  `visitAssignee(visit)` → the name with any done-marker stripped.
- `visitOrder(camps)` → walking order for one volunteer: sort by hour
  ascending, then ring, a single sweep across the city.

All new functions ride the existing `AdminAggregate` IIFE (browser global +
CJS) so `bun test` covers them directly.

## UI

### City tab: Playa Map panel

Full-width panel below the existing City grid. SVG fan: ring arcs Esplanade–K
spanning 2:00–10:00, radial street ticks each half hour, hour labels, ring
letters. Input rows = the same deduped, non-hidden winners the aggregates use.

Pins: circle per mappable camp, radius scaled by `campSize` (sqrt scale,
clamped), color by visit state — dim hollow = needs visit, amber = assigned,
green = visited. Hover title = name · address · score · visit note. Click
opens the existing `CampDetail` modal.

Assignee picker: a select of distinct assignees (from `visit` values). Choosing
one dims other pins and numbers that volunteer's pins in walking order, with a
matching ordered text list (stop number, camp, address) under the map.

Unmapped fallback: camps with an address that failed to parse (and a count of
camps with no address at all) list under the map so the owner can fix the sheet
cell; the map re-renders on next refresh.

### Camps tab

- Visit filter select beside the Dups toggle: All / Needs visit / Assigned /
  Visited (shown once any row carries a `visit` value).
- Row + `CampDetail` show a visit badge: `visit: Alice` (amber tone) or
  `visited ✓` (green tone).

## Error handling

Everything fails open, matching the Hidden-column precedent: no `Visit` column
→ no `visit` key → feature dormant (no picker, no filter, pins all "needs
visit" only once the map itself has addresses to draw). Unparseable addresses
are surfaced, never guessed. The map renders nothing (panel hidden) when zero
camps parse.

## Testing

- `bun test`: parser accept/reject table, geometry sanity (6:00 points down,
  ring radii ordered, 2:00/10:00 symmetric), `visitState`/`visitAssignee`
  cases, `visitOrder` sweep.
- Compile gate (`bun run scripts/build.js` + clean `git status -- dist`).
- Browser verification against a mock `/api/admin/responses` fixture with
  addresses + visit states, at desktop and 390px widths (Playwright, subagent).

## Out of scope (recorded in docs/roadmap.md Proposed)

Intake address-format hint on the game intro; score histogram;
submissions-over-time chart; "biggest opportunities" callout; weekly digest
email + cron self-check ("cron utilities").
