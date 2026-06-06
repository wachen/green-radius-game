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
      answers_json: r[col['Answers JSON']] || '', schema_version: r[col['Schema Version']] || ''
    };
  });
  return jsonOut({ ok: true, rows: rows });
}
```

The `col` lookup maps by **header text**, so the names here must match the sheet's
header row exactly — including the pretty-printed **`Answers JSON`** and **`Schema
Version`** columns. (The JSON keys `answers_json`/`schema_version` are what the
Worker's `shapeAdminRows` reads — keep those as-is.) Re-deploy the web app (Manage
deployments → edit → New version) — same `/exec` URL, same secret.

## 2. Cloudflare Access (gates the page)

1. Zero Trust → Access → Applications → **Add → Self-hosted**. Domain `greenradi.us`,
   paths `/admin` and `/api/admin`.
2. **Policy:** Allow → Emails → the GTCC team addresses (login via Google or one-time PIN).
3. Copy the application **Audience (AUD)** tag and your team domain
   (`<team>.cloudflareaccess.com`).
4. Put them in `wrangler.jsonc` `vars` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`) and
   deploy. They are **not** secrets.

Without these, the Worker returns 403 (Access not configured) and the page won't
load — by design. The viewer is also graceful: until `Answers JSON` has data, the
City heatmap / per-question detail and the Camps ✓/✗ tokens fall back to a
score-only approximation.
