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
