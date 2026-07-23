# Admin viewer — one-time external setup

Two owner-side steps make `greenradi.us/admin/` work. Both are outside this repo.

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
      hidden: r[col['Hidden']] || ''
    };
  });
  return jsonOut({ ok: true, rows: rows });
}
```

The `col` lookup maps by **header text**, so the names here must match the sheet's
header row exactly — including the pretty-printed **`Answers JSON`**, **`Schema
Version`**, and **`Hidden`** columns. (The JSON keys `answers_json`/`schema_version`/
`hidden` are what the Worker's `shapeAdminRows` reads — keep those as-is.) The `Hidden`
column doesn't exist yet on the sheet — see "Flagging junk rows" below for adding it;
until it's added, `r[col['Hidden']]` is `undefined` and `hidden` comes back `''`, which
`shapeAdminRows` treats as "not hidden" (a safe no-op). Re-deploy the web app (Manage
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

1. Add a column header **`Hidden`** to the `2026 Results` sheet (any empty column;
   position doesn't matter — the Apps Script `doGet` looks it up by header text).
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
headcount, required on the board-game intro and optional on the form-mode
intake. The Worker forwards both to the Apps Script row and the admin API;
they don't appear in the email or the public `/api/city` tally.

1. Add two column headers, **`Location`** and **`Camp Size`**, at the **end** of
   the `2026 Results` sheet.
2. Update `doGet` to also map the new columns:

```js
  var rows = values.filter(function (r) { return r[col['Camp']]; }).map(function (r) {
    return {
      timestamp: r[col['Timestamp']], campName: r[col['Camp']], leadName: r[col['Lead']],
      email: r[col['Email']], year: r[col['Year']],
      greens: { food: r[col['Food']], water: r[col['Water']], waste: r[col['Waste']],
                transport: r[col['Transport']], shelter: r[col['Shelter']], power: r[col['Power']] },
      total: r[col['Total']], source: r[col['Source']], resultUrl: r[col['Result URL']],
      answers_json: r[col['Answers JSON']] || '', schema_version: r[col['Schema Version']] || '',
      hidden: r[col['Hidden']] || '',
      campLocation: r[col['Location']] || '', campSize: r[col['Camp Size']] || ''
    };
  });
```

3. Update `doPost`'s `appendRow` to append the two new values **last**, matching
   the column order from step 1:

```js
  sheet.appendRow([
    new Date(),
    data.campName, data.leadName, data.email, data.year,
    data.greens.food, data.greens.water, data.greens.waste,
    data.greens.transport, data.greens.shelter, data.greens.power,
    data.source, data.resultUrl,
    JSON.stringify(data.answers || {}),  // -> answers_json
    data.schemaVersion || '',            // -> schema_version
    data.campLocation || '',             // -> Location
    data.campSize || ''                  // -> Camp Size
  ]);
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
