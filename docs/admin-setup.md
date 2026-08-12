# Admin viewer — one-time external setup

Two owner-side steps make `greenradi.us/admin/` work. Both are outside this repo.

> **The full deployed Apps Script lives at `docs/apps-script/Code.gs`** — that file
> is the paste-in source of truth (it includes the R4 nonce-dedup guard the
> snippets below omit). The sections here explain the setup around it.

## 1. Apps Script `doGet` (returns rows to the Worker)

In the **same** Apps Script project as `doPost` (container-bound to the master
spreadsheet), add the function below. It reuses the `jsonOut` helper already
defined by your `doPost`, and reads the same `SHARED_SECRET` Script Property.

```js
function doGet(e) {
  var secret = PropertiesService.getScriptProperties().getProperty('SHARED_SECRET');
  if (!secret || e.parameter.secret !== secret) return jsonOut({ ok: false });

  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('2026 Results');
  var values = sh.getDataRange().getValues();
  var header = values.shift();
  var col = {}; header.forEach(function (name, i) { col[name] = i; });

  var rows = values.filter(function (r) { return r[col['Camp']]; }).map(function (r) {
    return {
      timestamp: r[col['Timestamp']], campName: r[col['Camp']], leadName: r[col['Lead']],
      email: r[col['Email']], year: r[col['Year']],
      greens: { food: r[col['Food']], water: r[col['Water']], waste: r[col['Waste']],
                transport: r[col['Transport']], shelter: r[col['Shelter']], power: r[col['Power']] },
      total: r[col['Total']], source: r[col['Source']], resultUrl: r[col['Result URL']],
      answers_json: r[col['Answers JSON']] || '', schema_version: r[col['Schema Version']] || '',
      hidden: r[col['Hidden']] || '',
      campLocation: r[col['Location']] || '', campSize: r[col['Camp Size']] || '',
      visit: r[col['Visit']] || ''
    };
  });
  return jsonOut({ ok: true, rows: rows });
}
```

The `col` lookup maps by **header text**, so the names here must match the sheet's
header row exactly — including the pretty-printed **`Answers JSON`**, **`Schema
Version`**, **`Hidden`**, **`Location`**, **`Camp Size`**, and **`Visit`** columns. (The JSON keys
`answers_json`/`schema_version`/`hidden`/`campLocation`/`campSize`/`visit` are what the
Worker's `shapeAdminRows` reads — keep those as-is.) The `Hidden`, `Location`,
`Camp Size`, and `Visit` columns are added by sections 3–4 and 6 below; until a column exists on the
sheet, its `r[col[...]]` read is `undefined` and the field comes back `''`, which
`shapeAdminRows` treats as absent — a safe no-op. Re-deploy the web app (Manage
deployments → edit → New version) — same `/exec` URL, same secret.

## 2. Cloudflare Access (gates the page)

Zero Trust → Access → **Applications → Add an application → Self-hosted**. The current
dashboard uses a **Destinations** model (one app can have up to 5; they share one policy):

1. **Destinations** — add two *Public hostname* destinations on the same app. Leave
   Subdomain blank for both:
   - Domain `greenradi.us`, Path `admin`  → protects `/admin` and everything under it.
   - Domain `greenradi.us`, Path `api/admin`  → protects the Worker read route.

   ⚠️ **Never leave Path empty** — an empty path gates the *entire* site (the game,
   `/result/`, everything), which would break public play. Browser-rendered SSH/VNC/RDP
   stay **off**.
2. **Identity** — "Accept all available identity providers" is fine; the built-in
   **One-time PIN** (email code) works with no external IdP to configure.
3. **Policy** — Action **Allow**, Include → **Emails** → the specific GTCC admin
   addresses (do *not* use "Everyone"). Session duration ~24h.
4. After the app is created, open it (**Configure**) and copy the **Application Audience
   (AUD)** tag and your **team domain** (`<team>.cloudflareaccess.com`, bare host — no
   `https://`, no trailing slash).
5. Put both into `wrangler.jsonc` `vars` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`) and
   deploy. They are **not** secrets (they only let the Worker *verify* a token, never mint
   one), so committing them is fine.

A second Access app ("green-radius-game - Cloudflare Workers") gates the Worker's
**preview URLs** (`*-green-radius-game.<account>.workers.dev`). It isn't created
here in Zero Trust — it comes from the one-click **Enable Cloudflare Access**
toggle on the Worker's Preview URLs setting (Workers & Pages → green-radius-game →
Settings → Domains & Routes) and uses the account-wide reusable "Cloudflare
Workers Preview URLs" policy. Keep that policy's email list in sync with the
admin allowlist above.

Without these, the Worker returns 403 (Access not configured) and the page won't
load — by design. The viewer is also graceful: until `Answers JSON` has data, the
City heatmap / per-question detail and the Camps ✓/✗ tokens fall back to a
score-only approximation.

## 3. Flagging junk rows

Junk/test submissions (a teammate's manual test run, a spam entry, anything that
shouldn't count) can be excluded from every aggregate — the public `/api/city` tally
and the admin City tab — while staying visible on the Camps tab so you can audit them.
This is a read-side feature: there's no button in the admin UI to flag a row, you flag
it directly in the sheet.

**To flag a row as junk:**

1. Add a column header **`Hidden`** to the `2026 Results` sheet, **after** the
   `Location` and `Camp Size` columns (column S or later). `doGet` looks columns up
   by header text, so reads don't care where it sits — but `doPost`'s `appendRow`
   writes positionally, with Location and Camp Size landing in Q/R (see section 4).
   A `Hidden` column at Q or R would silently receive each new submission's
   location/size text and flag the row as hidden.
2. Update `doGet` to the version in step 1 above (it now reads the `Hidden` column) and
   re-deploy the web app (Manage deployments → edit → New version).
3. To flag a row, type anything truthy — `x`, `yes`, `1`, whatever's memorable — into
   that row's `Hidden` cell. Leave it blank for every row that should keep counting.

**What happens:**

- The row disappears from `/api/city`'s numbers and the admin City tab's tally,
  leaderboard, sector standings, and superlatives — same as if it were never
  submitted.
- The row still appears on the admin Camps tab, dimmed, with a small "hidden" chip,
  so you can find and double-check what you flagged.
- `/api/city` is colo-cached for freshness up to 5 minutes (see `docs/architecture.md`),
  so a flag can take up to 5 minutes to disappear from the public tally.
- Until step 1–2 above are done, the `Hidden` column doesn't exist and every row
  reads as not-hidden — flagging is a no-op, nothing breaks.

## 4. Camp location + size columns

The intro screen now collects a camp's playa location (e.g. "7:30 & E") and
headcount, required in both modes. The Worker forwards both to the Apps Script
row and the admin API;
they don't appear in the email or the public `/api/city` tally.

1. Add two column headers, **`Location`** (Q) and **`Camp Size`** (R), after
   `Schema Version` — and keep the owner-typed `Hidden` column **after both**
   (S or later; see section 3 for why the order matters).
2. Make sure the deployed `doGet` matches the full version in section 1 above —
   it already maps `Location` → `campLocation` and `Camp Size` → `campSize`.
3. Update `doPost`'s row build so the two new values land **last** (columns
   Q/R). The full 18-value order, matching the deployed script — note `total`
   in column L, computed in `doPost` from the clamped per-sector greens
   (`sectorCells`):

```js
  var rowValues = [
    new Date(),
    data.campName || '', data.leadName || '', data.email || '', data.year || ''
  ]
  .concat(sectorCells)                    // F–K: the six clamped greens
  .concat([
    total,                                // L Total (0–60, summed from sectorCells)
    data.source || '',                    // M Source
    data.resultUrl || '',                 // N Result URL
    JSON.stringify(data.answers || {}),   // O Answers JSON
    data.schemaVersion || '',             // P Schema Version
    data.campLocation || '',              // Q Location
    data.campSize || ''                   // R Camp Size
  ]);
  sheet.appendRow(rowValues);
```

Re-deploy the web app (Manage deployments → edit → New version) — same `/exec`
URL, same secret. Existing rows just read blank in the new columns, and
submissions from before this change (an older client, or before the sheet is
updated) are tolerated: the Worker sends `''` for both fields when absent.

## 5. Duplicate detection and resolution

The admin page shows badges on camps with repeated submissions within the same year.
On the Camps tab, multi-submission camps display an **xN** badge (e.g. x2, x3) showing
the count. Older, superseded rows are dimmed with a **"superseded"** badge. Rows that
share an email address with another camp in the same year get a **"possible dup"** badge —
these are flagged for your review but never auto-merged. A **"Dups"** toolbar filter shows
only the flagged entries for investigation.

Dedup merges rows within the same year when they share a `campId`, or the same normalized
camp name (trim+lowercase). Email only merges legacy rows without a `campId`, since one
person can legitimately run two different camps.

When you flag a row as hidden via the `Hidden` column (see "Flagging junk rows" above),
the latest submission for that camp becomes invisible to the aggregates, and the camp's
previous (older) submission automatically becomes the counted one in `/api/city` and the
admin City tab.

## 6. Visit tracking (`Visit` column)

The admin City tab draws a Playa Map — every camp with a parseable playa address
(e.g. `7:30 & E`) pinned on the Black Rock City street grid — and the Camps tab
gains a visit-status filter. Both read an owner-typed **`Visit`** column, same
pattern as `Hidden`: you type in the sheet, the UI reflects it on the next refresh.

**Setup (one time):**

1. Add a column header **`Visit`** to the `2026 Results` sheet, **after `Hidden`**
   (column T or later). Same positional-`appendRow` rule as `Hidden` (section 3):
   owner-typed columns must sit after every column `doPost` writes (A–R).
2. Make sure the deployed `doGet` matches section 1 above (it maps `Visit` → `visit`)
   and re-deploy the web app (Manage deployments → edit → New version).

**Cell convention** (free text, parsed tolerantly):

- **Blank** — camp still needs a visit (dim hollow pin).
- **A volunteer or team label** (`Alice`, `Team 1`) — visit assigned (amber pin).
  The label feeds the map's per-team route view and the Visits tab's team picker:
  pick a label to see just those camps, numbered in a suggested walking order
  (a 2:00 → 10:00 sweep).
- **A leading `✓`, or `done`/`visited`** (`✓ Alice`, `done`, `Visited 8/25`) — visit
  completed (green pin, "visited ✓" chip on the Camps tab).

Like `Hidden`, everything fails open: until the column exists the feature is dormant.
A camp whose address is blank or doesn't parse is never guessed onto the street grid;
it pins inside the dashed "Open camping" box in the map's bottom-left corner instead
(keeping its visit-state color, hover tooltip, and click-through to the Camps tab),
and unparseable-but-non-blank addresses also get a footnote under the map ("fix the
sheet cell"). `visit` is served on the Access-gated admin route only — never on the
public `/api/city`.

## 7. Onboarding a visit volunteer (Visits tab)

The admin **Visits** tab is the field view for the BLAST camp visits: a volunteer
opens `/admin/` on their phone, picks their team label once, and gets their camps
in a numbered walking order with address, headcount, score, and weakest-sector
talking points, plus the playa map narrowed to their route. Onboarding is three
steps, no new accounts:

1. **Access** — add the volunteer's email to the Access policy from section 2
   (and keep the preview-URL policy's list in sync if they'll review previews).
2. **Assign** — type the team's label (`Team 1`, `Alice + Bo`) into the `Visit`
   cell of every camp that team should visit (section 6). The distinct labels in
   that column are exactly what the tab's team picker offers.
3. **Send the link** — they open `greenradi.us/admin/`, complete the emailed
   one-time code, open the Visits tab, and tap their team.

Teams of 2 or 3 share one label; each person taps the same label on their own
phone (the pick is per-device, stored in localStorage, changeable any time).
The tab is read-only: marking a visit done is still a sheet edit (`✓ Team 1`)
until the mark-visited write path ships.

## 8. Mark visited from the Visits tab (one write)

The Worker now exposes `POST /api/admin/visit` (Access-JWT gated, same as
`/api/admin/responses`), which forwards `{ campId, campName, year, team }` to
the Apps Script web app so a volunteer can mark a camp visited from their
phone instead of editing the sheet by hand. It writes exactly one cell — the
`Visit` column (section 6) — and never touches anything else.

**In the same Apps Script project**, add the branch below near the top of
`doPost`, right after the existing shared-secret check (it reuses the
`SHEET_NAME` constant, the `col` header-lookup pattern from `doGet`, and the
`jsonOut` helper):

```js
    // Visit-write branch: POST /api/admin/visit forwards { action: 'visit',
    // campId, campName, year, team }. Locates the row by campId (parsed out
    // of the Answers JSON column) if present, else falls back to an exact
    // Camp name + Year match, then writes "✓ " + team into the Visit column
    // (found by header name, same as doGet). Never touches any other column.
    if (data.action === 'visit') {
      var vSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      if (!vSheet) return jsonOut({ ok: false, error: 'no_sheet' });

      var vValues = vSheet.getDataRange().getValues();
      var vHeader = vValues.shift();
      var vCol = {}; vHeader.forEach(function (name, i) { vCol[name] = i; });
      if (vCol['Visit'] === undefined) return jsonOut({ ok: false, error: 'no_visit_column' });

      var rowIndex = -1;
      if (data.campId && vCol['Answers JSON'] !== undefined) {
        for (var i = 0; i < vValues.length; i++) {
          try {
            var rowAnswers = JSON.parse(vValues[i][vCol['Answers JSON']] || '{}');
            if (rowAnswers.campId === data.campId) { rowIndex = i; break; }
          } catch (e) {}
        }
      }
      if (rowIndex === -1) {
        for (var j = 0; j < vValues.length; j++) {
          if (vValues[j][vCol['Camp']] === data.campName && String(vValues[j][vCol['Year']]) === String(data.year)) {
            rowIndex = j; break;
          }
        }
      }
      if (rowIndex === -1) return jsonOut({ ok: false, error: 'not_found' });

      // +2: vValues is 0-indexed after the header shift, and sheet rows are 1-indexed with row 1 = header.
      vSheet.getRange(rowIndex + 2, vCol['Visit'] + 1).setValue('✓ ' + (data.team || ''));
      return jsonOut({ ok: true });
    }
```

It verifies the shared secret the same way the rest of `doPost` already does
(the existing check above this branch, comparing `data.secret` against the
`SHARED_SECRET` Script Property) — nothing extra to add there.

**Re-deploy** the web app after pasting this in (Manage deployments → edit →
New version — same `/exec` URL, same secret). **Deploy this before wiring up
the "mark visited" button** — until this branch exists, `doPost` has no
`action === 'visit'` check, so a visit-write call falls through to the normal
row-append path instead of erroring: it appends a spurious row (the visit
call's `campName`/`year` filled in, everything else blank/zero) and still
reports `{ ok: true }`. Once this branch is deployed, a call that can't find
its row (bad campId/campName/year) or hits a sheet with no `Visit` column yet
(section 6 not done) cleanly returns `{ ok: false, ... }`, the Worker relays a
502, the button shows an error, and no row is touched — the "nothing breaks"
property only holds after this section is deployed.
