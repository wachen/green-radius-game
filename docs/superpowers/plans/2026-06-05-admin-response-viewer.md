# Admin Response Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a gated internal `/admin/` tool with two tabs — **City** (aggregate community tally) and **Camps** (per-camp review) — reading the results sheet through an authenticated Worker proxy.

**Architecture:** A no-build static page (`admin/index.html` + `admin/admin.jsx`) that loads `game-data.js` + `green-radius.jsx` (reusing `RadialBadge` + `sectorFill`) exactly like `result/index.html`. A pure `admin/aggregate.js` module turns sheet rows into all the numbers. One new Worker route `GET /api/admin/responses` validates the Cloudflare Access JWT and proxies a new Apps Script `doGet`. All shaping is client-side.

**Tech Stack:** React 18 UMD + `@babel/standalone` (in-browser JSX), Cloudflare Workers (Web Crypto for JWT), Google Apps Script (external), Bun (parse-gate + checks + Playwright). No build, no committed test runner.

---

## Before you start

- **Branch:** work on `admin-viewer`. It was cut off pre-#32 `main`. This plan targets the **post-#32** code (per-question `fills`, `sectorFill`, `LEVEL_COLORS`, `RadialBadge` taking `fills`, `greens` 0–10, `answers_json`). **Rebase `admin-viewer` onto `main` after PR #32 merges** before implementing Task 2 onward, so the symbols below exist. (Line numbers cite the post-#32 `green-radius.jsx`; if they drift, locate by symbol name.)
- **The viewer ships useful without granular data.** Scores, leaderboard, the radius (approximate), and contact work from today's columns. The ✓/✗ detail, per-question rates, and the heatmap need `answers_json` flowing (post-#32 Worker + the Apps Script `doPost`/`doGet` changes in Task 7).
- **Testing convention (match the repo):** there is no committed test runner. "Tests" here are the **bun parse-gate**, **throwaway bun check scripts** (written under `/tmp/admincheck/`, never committed), and **bun-driven Playwright** against a mocked endpoint. Commits include source only. The bun+Playwright setup already exists at `/Users/wes/.claude/jobs/04f9ca36/tmp/pw/` (chromium installed); reuse it, or `cd /tmp/admincheck && bun add playwright` fresh.
- **Secrets hard-rule:** never write secret *values* into the repo. `CF_ACCESS_AUD` + `CF_ACCESS_TEAM_DOMAIN` are non-secret config (vars). `SHEETS_WEBAPP_URL`/`SHEETS_SHARED_SECRET` stay Worker secrets.
- **Local serve:** `python3 -m http.server 8791 --directory "<repo>"` then load `http://localhost:8791/admin/`.

## File structure

| File | New/Mod | Responsibility |
|------|---------|----------------|
| `admin/aggregate.js` | New | Pure: sheet rows → `{ tally, leaderboard, sectorStandings, perQuestion, intensities, momentum }`. Bun-testable (IIFE + `module.exports`, like `result-state.js`). |
| `admin/admin.jsx` | New | `AdminApp` shell (tabs, filters, fetch hook, states), `CommunityTally` (City), `CampsView` (Camps). |
| `admin/index.html` | New | Loads CDN React + Babel, `game-data.js`, `green-radius.jsx`, `admin/aggregate.js`, `admin/admin.jsx`; mounts `<AdminApp/>`. |
| `green-radius.jsx` | Mod (`RadialBadge` ~750) | Add optional `intensities` (heatmap), `onSelectSegment`, `selected`, `centerLabel` — backward-compatible. |
| `worker/index.js` | Mod (`fetch` ~4) | Add `GET /api/admin/responses`: Access-JWT verify + `doGet` proxy. |
| `wrangler.jsonc` | Mod | Add `vars`: `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`. |
| `docs/admin-setup.md` | New | External steps: Apps Script `doGet` + Cloudflare Access app. |
| `docs/architecture.md` | Mod | Document the admin read path. |

---

## Task 1: Pure aggregation module (`admin/aggregate.js`)

**Files:**
- Create: `admin/aggregate.js`
- Check (throwaway): `/tmp/admincheck/agg.mjs`

Row shape the Worker will deliver (Task 3): `{ timestamp, campName, leadName, email, year, greens:{food,water,waste,transport,shelter,power} (0–10), total, source:'board'|'form', resultUrl, answers:{[qid]:'yes'|'no'}, schemaVersion }`.

- [ ] **Step 1: Write the failing check**

Write `/tmp/admincheck/agg.mjs`:

```js
globalThis.window = {};
require('/ABS/REPO/game-data.js');           // sets window.SECTORS (+ SCHEMA_VERSION)
const SECTORS = globalThis.window.SECTORS;
const A = require('/ABS/REPO/admin/aggregate.js');

// Two camps. Camp A: perfect Food (F1-F6 yes + 4 advanced yes), nothing else.
// Camp B: Food F1 yes only. One row has NO answers (degraded).
const ids = s => [].concat(...s.levels.slice(0,3)).map(q=>q.id);
const food = SECTORS.find(s=>s.id==='food');
const aAns = {}; ids(food).forEach(id=>aAns[id]='yes'); food.tier4Topics.slice(0,4).forEach(t=>aAns[t.id]='yes');
const bAns = { [ids(food)[0]]:'yes' };
const rows = [
  { campName:'A', leadName:'a', total:10, greens:{food:10,water:0,waste:0,transport:0,shelter:0,power:0}, source:'form', answers:aAns, timestamp: 1000 },
  { campName:'B', leadName:'b', total:1,  greens:{food:1, water:0,waste:0,transport:0,shelter:0,power:0}, source:'board', answers:bAns, timestamp: 2000 },
  { campName:'C', leadName:'c', total:0,  greens:{food:0, water:0,waste:0,transport:0,shelter:0,power:0}, source:'form', answers:{},   timestamp: 3000 },
];
const r = A.computeAggregates(rows, SECTORS, 4000, 7*864e5);

const eq = (got, want, msg) => { if (JSON.stringify(got)!==JSON.stringify(want)) { console.error('FAIL',msg,'got',got,'want',want); process.exitCode=1; } else console.log('ok',msg); };
eq(r.count, 3, 'count');
eq(r.totalPossible, 180, 'possible = 3*60');
eq(r.totalYes, 11, 'sum totals');
eq(r.leaderboard[0].campName, 'A', 'leader is A');
eq(r.leaderboard[0].perfectSectors, 1, 'A has 1 maxed sector');
eq(r.sectorStandings[0].id, 'food', 'food leads standings');
eq(Math.round(r.sectorStandings.find(s=>s.id==='food').avg*10)/10, 3.7, 'food avg=(10+1+0)/3');
eq(r.hasAnswers, true, 'has answers');
// F1 answered yes by A and B (asked by both), C has none -> asked among answered = 2, yes 2
eq(r.perQuestion[ids(food)[0]].rate, 1, 'F1 rate 1');
eq(r.perQuestion[ids(food)[1]].rate, 0.5, 'F2 rate 0.5 (A yes, B no)');
// intensities: food L1 cell0 = 1 (both answered yes among answered rows A,B)
eq(r.intensities.food.levels[0][0], 1, 'food L1 intensity 1');
// food L4: A reached 4 advanced, B reached 0 -> cell0 = 1/2 = 0.5
eq(r.intensities.food.levels[3][0], 0.5, 'food L4 slot1 = 0.5');
eq(r.momentum.thisWeek, 3, 'all within 7d of now=4000');
console.log(process.exitCode ? 'RESULT: FAIL' : 'RESULT: PASS');
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `cd /tmp/admincheck && bun agg.mjs`
Expected: FAIL — `Cannot find module .../admin/aggregate.js`.

- [ ] **Step 3: Implement `admin/aggregate.js`**

```js
// admin/aggregate.js — pure aggregation of result rows. No DOM, no React.
// Mirrors result-state.js's IIFE + global/CJS guard so it runs in the browser
// (window.AdminAggregate) and under bun (require).
(function (global) {
  // Fixed question ids (Levels 1-3) and Tier-4 topic ids for a sector.
  function sectorIds(sector) {
    return {
      fixed: [].concat(...sector.levels.slice(0, 3)).map(q => q.id),
      topics: (sector.tier4Topics || []).map(t => t.id),
    };
  }
  function advYesCount(sector, answers) {
    return Math.min(4, (sector.tier4Topics || []).filter(t => answers[t.id] === 'yes').length);
  }
  function rowsWithAnswers(rows) {
    return rows.filter(r => r.answers && Object.keys(r.answers).length > 0);
  }

  function perQuestion(rows, sectors) {
    const out = {};
    const ans = rowsWithAnswers(rows);
    sectors.forEach(sector => {
      const { fixed, topics } = sectorIds(sector);
      fixed.concat(topics).forEach(id => {
        let yes = 0, asked = 0;
        ans.forEach(r => {
          const v = r.answers[id];
          if (v === 'yes' || v === 'no') { asked++; if (v === 'yes') yes++; }
        });
        out[id] = { yes, asked, rate: asked ? yes / asked : 0 };
      });
    });
    return out;
  }

  // Per sector: levels[0..2][i] = Yes-rate of that fixed question; levels[3][i] =
  // fraction of answered rows reaching advanced slot i+1. null if no answers at all.
  function intensities(rows, sectors, pq) {
    const ans = rowsWithAnswers(rows);
    if (!ans.length) return null;
    const out = {};
    sectors.forEach(sector => {
      const levels = [0, 1, 2].map(li => (sector.levels[li] || []).map(q => pq[q.id].rate));
      const adv = ans.map(r => advYesCount(sector, r.answers));
      levels[3] = [0, 1, 2, 3].map(i => adv.filter(c => c >= i + 1).length / ans.length);
      out[sector.id] = { levels };
    });
    return out;
  }

  function sectorStandings(rows, sectors) {
    return sectors.map(s => ({
      id: s.id, name: s.name,
      avg: rows.length ? rows.reduce((n, r) => n + ((r.greens && r.greens[s.id]) || 0), 0) / rows.length : 0,
    })).sort((a, b) => b.avg - a.avg);
  }

  function leaderboard(rows, sectors, n) {
    return rows.map(r => ({
      campName: r.campName, leadName: r.leadName, total: r.total || 0,
      perfectSectors: sectors.filter(s => ((r.greens && r.greens[s.id]) || 0) === 10).length,
      resultUrl: r.resultUrl || '',
    })).sort((a, b) => b.total - a.total).slice(0, n || 10);
  }

  function computeAggregates(rows, sectors, now, windowMs) {
    const pq = perQuestion(rows, sectors);
    const totalYes = rows.reduce((n, r) => n + (r.total || 0), 0);
    const totalPossible = rows.length * sectors.length * 10;
    const wMs = windowMs || 7 * 864e5;
    return {
      count: rows.length,
      totalYes, totalPossible,
      tallyPct: totalPossible ? totalYes / totalPossible : 0,
      sectorStandings: sectorStandings(rows, sectors),
      leaderboard: leaderboard(rows, sectors, 10),
      perQuestion: pq,
      intensities: intensities(rows, sectors, pq),
      hasAnswers: rowsWithAnswers(rows).length > 0,
      momentum: { thisWeek: rows.filter(r => typeof r.timestamp === 'number' && now - r.timestamp <= wMs).length },
    };
  }

  const api = { computeAggregates, perQuestion, intensities, sectorStandings, leaderboard, sectorIds, advYesCount };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AdminAggregate = api;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 4: Run the check, confirm PASS**

Run: `cd /tmp/admincheck && bun agg.mjs`
Expected: `RESULT: PASS`. (Edit the two `/ABS/REPO/` paths to the repo root first.)

- [ ] **Step 5: Parse-gate + commit**

```bash
bun build admin/aggregate.js > /dev/null && echo OK
git add admin/aggregate.js
git commit -m "feat(admin): pure aggregation module for the response viewer"
```

---

## Task 2: `RadialBadge` aggregate + interactive modes

**Files:**
- Modify: `green-radius.jsx` (`RadialBadge`, ~750–831)
- Check (throwaway): `/tmp/admincheck/badge.html` + `/tmp/admincheck/badge.mjs` (Playwright)

Add four optional props — `intensities`, `onSelectSegment`, `selected`, `centerLabel` — without touching the boolean `fills` path used by `result/` and the game.

- [ ] **Step 1: Write the failing Playwright check**

Write `/tmp/admincheck/badge.html` (loads the components and renders an aggregate badge):

```html
<!doctype html><html><head><meta charset="utf-8">
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js"></script>
<script src="/game-data.js"></script>
<script type="text/babel" src="/green-radius.jsx"></script>
</head><body><div id="r"></div>
<script type="text/babel" data-presets="react">
  window.__sel = null;
  const sectors = window.SECTORS;
  const intensities = {}; sectors.forEach((s,i)=>{ intensities[s.id]={levels:[[i/6],[1,0],[0.5,0.5,0.5],[1,0.5,0,0]]}; });
  ReactDOM.createRoot(document.getElementById('r')).render(
    <RadialBadge sectors={sectors} fills={{}} intensities={intensities}
      centerLabel="64%" onSelectSegment={(sid,li,qi)=>{window.__sel=[sid,li,qi];}} />
  );
</script></body></html>
```

Write `/tmp/admincheck/badge.mjs`:

```js
const { chromium } = require('playwright');
(async () => {
  // serve repo at :8791 first: python3 -m http.server 8791 --directory <repo>
  const b = await chromium.launch(); const p = await b.newContext().then(c=>c.newPage());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8791/admin-badge-check.html');  // symlink/copy badge.html into repo root for serving, or serve /tmp
  await p.waitForTimeout(400);
  const fills = await p.$$eval('path', ps => ps.map(p=>({op:p.getAttribute('fill-opacity'), fill:p.getAttribute('fill')})));
  const hasOpacity = fills.some(f => f.op && parseFloat(f.op) > 0 && parseFloat(f.op) < 1);
  const center = await p.$eval('text', t=>t.textContent);
  await p.$$eval('path', ps=>ps[ps.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true})));
  const sel = await p.evaluate(()=>window.__sel);
  console.log({hasOpacity, center, sel, errs});
  if (!hasOpacity) { console.error('FAIL: no graded opacity (aggregate mode not rendering)'); process.exitCode=1; }
  if (!center.includes('64%')) { console.error('FAIL: centerLabel not shown'); process.exitCode=1; }
  if (!sel) { console.error('FAIL: onSelectSegment not fired'); process.exitCode=1; }
  if (errs.length) { console.error('PAGE ERRORS', errs); process.exitCode=1; }
  console.log(process.exitCode ? 'RESULT: FAIL':'RESULT: PASS'); await b.close();
})();
```

(Serve `badge.html` by copying it to `<repo>/admin-badge-check.html` for the run, then delete it — it is never committed.)

- [ ] **Step 2: Run it, confirm it fails**

Run: serve the repo, then `cd /tmp/admincheck && bun badge.mjs`
Expected: FAIL — aggregate mode/centerLabel/callback don't exist yet (no graded opacity).

- [ ] **Step 3: Edit `RadialBadge`**

Change the signature (green-radius.jsx:750) to add the optional props:

```js
function RadialBadge({ sectors, fills, size = 320, dark = true, showLabels = true, showCenter = true, showGrid = false,
                       intensities = null, onSelectSegment = null, selected = null, centerLabel = null }) {
```

Replace the per-question segment block (the `sectors.map(...)` at ~772–787) with one that honors `intensities` and clicks:

```js
      {/* per-question segments: boolean fills, or graded opacity in aggregate mode */}
      {sectors.map((sector, si) => {
        const a0 = si * sweep, a1 = (si + 1) * sweep;
        const agg = intensities && intensities[sector.id];
        const lv = agg ? agg.levels : ((fills[sector.id] && fills[sector.id].levels) || [[], [], [], []]);
        return [0, 1, 2, 3].map(li => {
          const rIn = RINGS[li] + (li > 0 ? rGap : 0);
          const rOut = RINGS[li + 1];
          const cells = lv[li] || [];
          return segAngles(a0, a1, cells.length || 1, gap).map(([s0, s1], qi) => {
            const isSel = selected && selected.sector === sector.id && selected.level === li;
            const fillCol = agg ? LEVEL_COLORS[li] : (cells[qi] ? LEVEL_COLORS[li] : baseColor);
            const fillOp = agg ? Math.max(0.06, cells[qi]) : 1;
            return (
              <path key={`${sector.id}-${li}-${qi}`}
                d={arcPath(cx, cy, rIn, rOut, s0, s1)}
                fill={fillCol} fillOpacity={fillOp}
                stroke={isSel ? '#e8c15a' : baseStroke} strokeWidth={isSel ? 1.5 : 0.5}
                style={onSelectSegment ? { cursor: 'pointer' } : undefined}
                onClick={onSelectSegment ? () => onSelectSegment(sector.id, li, qi) : undefined}
              />
            );
          });
        });
      })}
```

Replace the center block (~821–828) to allow a label override:

```js
      {showCenter && (
        centerLabel != null ? (
          <text x={cx} y={cy + size*0.04} textAnchor="middle" fontSize={size*0.13} fontWeight="900" fill="#fff"
            style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 0.6 }}>{centerLabel}</text>
        ) : (
          <text x={cx} y={cy + size*0.04} textAnchor="middle" fontSize={size*0.13} fontWeight="900" fill="#fff"
            style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 0.6 }}>
            {totalYes}<tspan fontSize={size*0.055} dx="2" opacity="0.75">/60</tspan>
          </text>
        )
      )}
```

- [ ] **Step 4: Run the check, confirm PASS**

Run: serve repo + `cd /tmp/admincheck && bun badge.mjs` → `RESULT: PASS`.
Then **regression**: load `http://localhost:8791/result/#<any old hash>` and confirm the share card still renders (boolean path untouched).

- [ ] **Step 5: Parse-gate + commit**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo OK
git add green-radius.jsx
git commit -m "feat(admin): RadialBadge aggregate heatmap + segment-click (backward-compatible)"
```

---

## Task 3: Worker route `GET /api/admin/responses` (Access JWT + doGet proxy)

**Files:**
- Modify: `worker/index.js` (`fetch` ~4–10; add handlers + helpers)
- Modify: `wrangler.jsonc` (add `vars`)
- Check (throwaway): `/tmp/admincheck/worker.mjs`

- [ ] **Step 1: Add `vars` to `wrangler.jsonc`**

Insert after the `"assets"` block:

```jsonc
  "vars": {
    "CF_ACCESS_AUD": "REPLACE_WITH_ACCESS_AUD_TAG",
    "CF_ACCESS_TEAM_DOMAIN": "yourteam.cloudflareaccess.com"
  },
```

(These are non-secret config; the real values come from Task 7's Access setup. Placeholders are fine in the repo.)

- [ ] **Step 2: Write the failing check**

Write `/tmp/admincheck/worker.mjs` (generates a real RS256 JWT, stubs both fetches):

```js
import worker from '/ABS/REPO/worker/index.js';
const enc = new TextEncoder();
const b64u = buf => Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const kp = await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'}, true, ['sign','verify']);
const jwk = await crypto.subtle.exportKey('jwk', kp.publicKey); jwk.kid='k1'; jwk.alg='RS256';
async function mkJwt(payload){ const h=b64u(enc.encode(JSON.stringify({alg:'RS256',kid:'k1',typ:'JWT'}))); const pl=b64u(enc.encode(JSON.stringify(payload))); const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',kp.privateKey,enc.encode(h+'.'+pl)); return h+'.'+pl+'.'+b64u(sig); }
const now=Math.floor(Date.now()/1000);
const env={ CF_ACCESS_AUD:'AUD1', CF_ACCESS_TEAM_DOMAIN:'team.cloudflareaccess.com', SHEETS_WEBAPP_URL:'https://script/exec', SHEETS_SHARED_SECRET:'s' };
globalThis.fetch = async (u)=> String(u).includes('/cdn-cgi/access/certs')
  ? new Response(JSON.stringify({keys:[jwk]}),{status:200})
  : new Response(JSON.stringify({ok:true, rows:[{ timestamp:'2026-06-02T00:00:00Z', campName:'A', leadName:'x', email:'a@b.c', year:2026, greens:{food:10,water:0,waste:0,transport:0,shelter:0,power:0}, total:10, source:'form', resultUrl:'https://greenradi.us/result/#h', answers_json:'{"F1":"yes"}', schema_version:'frog-v12' }]}),{status:200});
const call = (hdrs)=>worker.fetch(new Request('https://greenradi.us/api/admin/responses',{headers:hdrs}), env);
let fail=0; const ck=(c,m)=>{ if(!c){console.error('FAIL',m);fail=1;} else console.log('ok',m); };
ck((await call({})).status===403, 'no token -> 403');
const good=await mkJwt({aud:'AUD1',exp:now+300}); const r1=await call({'Cf-Access-Jwt-Assertion':good});
ck(r1.status===200,'valid token -> 200'); const j=await r1.json();
ck(j.rows[0].campName==='A','row passthrough'); ck(j.rows[0].answers.F1==='yes','answers_json parsed');
const badAud=await mkJwt({aud:'NOPE',exp:now+300}); ck((await call({'Cf-Access-Jwt-Assertion':badAud})).status===403,'bad aud -> 403');
const expd=await mkJwt({aud:'AUD1',exp:now-10}); ck((await call({'Cf-Access-Jwt-Assertion':expd})).status===403,'expired -> 403');
console.log(fail?'RESULT: FAIL':'RESULT: PASS'); process.exitCode=fail;
```

- [ ] **Step 3: Run it, confirm it fails**

Run: `cd /tmp/admincheck && bun worker.mjs`
Expected: FAIL — route returns 404/`env.ASSETS.fetch` error (handler not added; `ASSETS` undefined under bun is fine because the route should branch before it).

- [ ] **Step 4: Implement the route in `worker/index.js`**

Add the route to `fetch` (after the existing `/api/complete` line):

```js
    if (url.pathname === '/api/admin/responses' && request.method === 'GET') return handleAdminResponses(request, env);
```

Append these functions (near the other handlers):

```js
// ── Admin read path: validate the Cloudflare Access JWT, then proxy the Apps Script doGet ──
async function handleAdminResponses(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const ok = await verifyAccessJwt(token, env);
  if (!ok) return json({ error: 'unauthorized' }, 403);

  if (!env.SHEETS_WEBAPP_URL) return json({ rows: [], count: 0, degraded: 'no_backend' });
  const u = `${env.SHEETS_WEBAPP_URL}?mode=responses&secret=${encodeURIComponent(env.SHEETS_SHARED_SECRET || '')}`;
  const r = await fetch(u, { redirect: 'follow' });
  if (!r.ok) return json({ error: 'sheet_unavailable' }, 502);
  const data = await r.json().catch(() => ({}));
  const rows = shapeAdminRows(data.rows || []);
  return new Response(JSON.stringify({ rows, count: rows.length }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function shapeAdminRows(raw) {
  return raw.slice(0, 2000).map(r => {
    let answers = {};
    try { answers = r.answers_json ? JSON.parse(r.answers_json) : (r.answers || {}); } catch { answers = {}; }
    return {
      timestamp: Date.parse(r.timestamp) || 0,
      campName: String(r.campName || ''), leadName: String(r.leadName || ''), email: String(r.email || ''),
      year: r.year | 0, greens: r.greens || {}, total: r.total | 0,
      source: r.source === 'form' ? 'form' : 'board', resultUrl: String(r.resultUrl || ''),
      answers, schemaVersion: String(r.schema_version || r.schemaVersion || ''),
    };
  });
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}

async function verifyAccessJwt(token, env) {
  if (!token || !env.CF_ACCESS_AUD || !env.CF_ACCESS_TEAM_DOMAIN) return false;
  const parts = token.split('.'); if (parts.length !== 3) return false;
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch { return false; }
  // claims
  const now = Math.floor(Date.now() / 1000);
  const auds = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!auds.includes(env.CF_ACCESS_AUD)) return false;
  if (!payload.exp || payload.exp < now) return false;
  // signature (RS256) against the team JWKS
  try {
    const certs = await fetch(`https://${env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`).then(r => r.json());
    const jwk = (certs.keys || []).find(k => k.kid === header.kid); if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), data);
  } catch { return false; }
}
```

- [ ] **Step 5: Run the check, confirm PASS**

Run: `cd /tmp/admincheck && bun worker.mjs` → `RESULT: PASS` (all five assertions).

- [ ] **Step 6: Parse-gate + commit**

```bash
bun build worker/index.js > /dev/null && echo OK
git add worker/index.js wrangler.jsonc
git commit -m "feat(admin): Worker GET /api/admin/responses — Access JWT verify + doGet proxy"
```

---

## Task 4: Admin shell — `admin/index.html` + `AdminApp` + data hook

**Files:**
- Create: `admin/index.html`, `admin/admin.jsx`
- Check (throwaway): `/tmp/admincheck/shell.mjs`

- [ ] **Step 1: Create `admin/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<title>Green Radius — Admin</title>
<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" crossorigin="anonymous"></script>
<script src="../game-data.js"></script>
<script type="text/babel" src="../green-radius.jsx"></script>
<script src="./aggregate.js"></script>
<script type="text/babel" src="./admin.jsx"></script>
</head>
<body style="margin:0;background:#0e1712;color:#eaf2ec;font-family:system-ui,sans-serif">
<div id="root"></div>
<script type="text/babel" data-presets="react">
  ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp sectors={window.SECTORS} />);
</script>
</body>
</html>
```

- [ ] **Step 2: Write the failing check**

Write `/tmp/admincheck/shell.mjs` — mocks `/api/admin/responses`, asserts tabs + loading→loaded:

```js
const { chromium } = require('playwright');
const SAMPLE = { rows: [{ timestamp: Date.now(), campName:'Dusty Acres', leadName:'Jo', email:'jo@x.org', year:2026,
  greens:{food:10,water:6,waste:6,transport:4,shelter:7,power:5}, total:38, source:'form',
  resultUrl:'https://greenradi.us/result/#h', answers:{F1:'yes'}, schemaVersion:'frog-v12' }], count:1 };
(async()=>{ const b=await chromium.launch(); const p=await b.newContext().then(c=>c.newPage());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/api/admin/responses*', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(SAMPLE)}));
  await p.goto('http://localhost:8791/admin/'); await p.waitForTimeout(500);
  const tabs = await p.$$eval('[data-tab]', els=>els.map(e=>e.textContent));
  const hasCity = tabs.some(t=>/City/.test(t)), hasCamps = tabs.some(t=>/Camps/.test(t));
  const body = await p.textContent('body');
  console.log({tabs, errs});
  if(!hasCity||!hasCamps){console.error('FAIL: missing tabs');process.exitCode=1;}
  if(!/Dusty Acres|128|camp/i.test(body)){console.error('FAIL: data not loaded');process.exitCode=1;}
  if(errs.length){console.error('PAGE ERRORS',errs);process.exitCode=1;}
  console.log(process.exitCode?'RESULT: FAIL':'RESULT: PASS'); await b.close(); })();
```

- [ ] **Step 3: Run it, confirm it fails**

Run: serve repo, `cd /tmp/admincheck && bun shell.mjs`
Expected: FAIL — `admin.jsx` 404 / `AdminApp is not defined`.

- [ ] **Step 4: Create `admin/admin.jsx` with the shell + hook (views are placeholders here)**

```jsx
// admin/admin.jsx — gated viewer. Reuses RadialBadge + sectorFill (bare names from
// green-radius.jsx) and window.AdminAggregate. CommunityTally + CampsView added in Tasks 5-6.
const A = window.AdminAggregate;
const useMQ = (q) => {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => { const mm = window.matchMedia(q); const h = e => setM(e.matches);
    mm.addEventListener('change', h); return () => mm.removeEventListener('change', h); }, [q]);
  return m;
};

function useResponses() {
  const [state, setState] = React.useState({ status: 'loading', rows: [] });
  const load = React.useCallback(() => {
    setState({ status: 'loading', rows: [] });
    fetch('/api/admin/responses', { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(d => setState({ status: 'ready', rows: d.rows || [] }))
      .catch(e => setState({ status: 'error', rows: [], error: String(e) }));
  }, []);
  React.useEffect(load, [load]);
  return { ...state, reload: load };
}

function AdminApp({ sectors }) {
  const { status, rows, error, reload } = useResponses();
  const [tab, setTab] = React.useState('city');
  const [year, setYear] = React.useState(2026);
  const [source, setSource] = React.useState('all');
  const years = React.useMemo(() => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a), [rows]);
  const filtered = React.useMemo(() => rows.filter(r =>
    (!year || r.year === year) && (source === 'all' || r.source === source)), [rows, year, source]);

  const Tab = ({ id, label }) => (
    <button data-tab={id} onClick={() => setTab(id)}
      style={{ fontWeight: 700, fontSize: 13, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: tab === id ? '#1d2c24' : 'transparent', color: tab === id ? '#eaf2ec' : '#93a89b' }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #26382e' }}>
        <b style={{ fontWeight: 800 }}>Green<span style={{ color: '#45c483' }}>Radius</span> · Admin</b>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}><Tab id="city" label="City" /><Tab id="camps" label="Camps" /></div>
        <select value={year} onChange={e => setYear(+e.target.value)} style={selStyle}>
          {years.length ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={2026}>2026</option>}
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} style={selStyle}>
          <option value="all">All</option><option value="board">Board</option><option value="form">Form</option>
        </select>
      </header>

      {status === 'loading' && <Centered>Loading the community tally…</Centered>}
      {status === 'error' && <Centered>Couldn't load responses ({error}). <button onClick={reload} style={btnStyle}>Retry</button></Centered>}
      {status === 'ready' && filtered.length === 0 && <Centered>No camps yet for {year}.</Centered>}
      {status === 'ready' && filtered.length > 0 && (
        tab === 'city'
          ? <CommunityTally sectors={sectors} rows={filtered} />
          : <CampsView sectors={sectors} rows={filtered} />
      )}
    </div>
  );
}

const selStyle = { background: '#101b15', color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '4px 8px', fontSize: 12 };
const btnStyle = { background: '#45c483', color: '#06140c', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer' };
const Centered = ({ children }) => <div style={{ textAlign: 'center', padding: '60px 0', color: '#93a89b' }}>{children}</div>;

// Placeholders — replaced in Tasks 5 & 6.
function CommunityTally({ rows }) { return <Centered>City view — {rows.length} camps</Centered>; }
function CampsView({ rows }) { return <Centered>Camps view — {rows.length} camps</Centered>; }
```

- [ ] **Step 5: Run the check, confirm PASS**

Run: serve repo, `cd /tmp/admincheck && bun shell.mjs` → `RESULT: PASS`.

- [ ] **Step 6: Parse-gate + commit**

```bash
bun build admin/admin.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo OK
git add admin/index.html admin/admin.jsx
git commit -m "feat(admin): shell, tabs (City|Camps), filters, fetch hook + states"
```

---

## Task 5: City view (`CommunityTally`)

**Files:**
- Modify: `admin/admin.jsx` (replace the `CommunityTally` placeholder)
- Check (throwaway): `/tmp/admincheck/city.mjs`

- [ ] **Step 1: Write the failing check**

Write `/tmp/admincheck/city.mjs` (reuses the Task 4 mock; asserts hero %, leaderboard order, standings, tap-detail):

```js
const { chromium } = require('playwright');
const rows = [
  { timestamp:Date.now(), campName:'Dusty Acres', leadName:'Jo', email:'j@x', year:2026, total:58, source:'form', resultUrl:'', schemaVersion:'frog-v12',
    greens:{food:10,water:9,waste:10,transport:9,shelter:10,power:10}, answers:{F1:'yes',F2:'yes'} },
  { timestamp:Date.now(), campName:'Camp Nimbus', leadName:'R', email:'r@x', year:2026, total:20, source:'board', resultUrl:'', schemaVersion:'frog-v12',
    greens:{food:4,water:3,waste:4,transport:2,shelter:4,power:3}, answers:{F1:'no',F2:'yes'} },
];
(async()=>{ const b=await chromium.launch(); const p=await b.newContext({viewport:{width:1000,height:900}}).then(c=>c.newPage());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/api/admin/responses*', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows,count:rows.length})}));
  await p.goto('http://localhost:8791/admin/'); await p.waitForTimeout(500);
  const body = await p.textContent('body');
  const lead = await p.$eval('[data-leaderboard] [data-rank="1"]', e=>e.textContent);
  if(!/Dusty Acres/.test(lead)){console.error('FAIL: leaderboard #1', lead);process.exitCode=1;}
  if(!/Reaching Furthest/i.test(body)){console.error('FAIL: no leaderboard heading');process.exitCode=1;}
  if(!/Sector Standings/i.test(body)){console.error('FAIL: no standings');process.exitCode=1;}
  // tap a segment -> detail text appears
  await p.$$eval('svg path', ps=>ps[ps.length-1].dispatchEvent(new MouseEvent('click',{bubbles:true})));
  await p.waitForTimeout(150);
  const detail = await p.$eval('[data-segment-detail]', e=>e.textContent).catch(()=>'');
  if(!/of \d+ camps/.test(detail)){console.error('FAIL: tap detail', detail);process.exitCode=1;}
  if(errs.length){console.error('PAGE ERRORS',errs);process.exitCode=1;}
  console.log(process.exitCode?'RESULT: FAIL':'RESULT: PASS'); await b.close(); })();
```

- [ ] **Step 2: Run it, confirm it fails**

Run: serve repo, `cd /tmp/admincheck && bun city.mjs` → FAIL (placeholder render).

- [ ] **Step 3: Replace `CommunityTally`**

```jsx
function CommunityTally({ sectors, rows }) {
  const agg = React.useMemo(() => A.computeAggregates(rows, sectors, Date.now()), [rows, sectors]);
  const wide = useMQ('(min-width: 760px)');
  const [sel, setSel] = React.useState(null); // {sector, level, qi}
  const pct = Math.round(agg.tallyPct * 100);

  const detail = (() => {
    if (!sel) return null;
    const sector = sectors.find(s => s.id === sel.sector);
    let label, q, rate;
    if (sel.level < 3) { q = (sector.levels[sel.level] || [])[sel.qi]; if (!q) return null;
      label = `${sector.name} · Level ${sel.level + 1}`; rate = agg.perQuestion[q.id]?.rate || 0;
      return { label, text: q.prompt || q.title, rate, n: agg.perQuestion[q.id]?.asked || 0 }; }
    label = `${sector.name} · Level 4`; rate = agg.intensities ? agg.intensities[sector.id].levels[3][sel.qi] : 0;
    return { label, text: `Camps reaching advanced step ${sel.qi + 1}`, rate, n: agg.count };
  })();

  const Hero = (
    <div style={{ textAlign: 'center', filter: 'drop-shadow(0 0 22px rgba(69,196,131,.3))' }}>
      <RadialBadge sectors={sectors} fills={{}} size={wide ? 300 : 264} dark
        intensities={agg.intensities} centerLabel={agg.hasAnswers ? `${pct}%` : `${agg.totalYes}`}
        onSelectSegment={agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null} />
      <div style={{ fontSize: 13, color: '#cfe0d4', marginTop: 6 }}>
        <b style={{ color: '#fff' }}>{agg.totalYes}</b> of {agg.totalPossible} green choices · <b style={{ color: '#fff' }}>{agg.count}</b> camps · +{agg.momentum.thisWeek} this week
      </div>
      {!agg.hasAnswers && <div style={{ fontSize: 11, color: '#7f988a', marginTop: 4 }}>Per-question detail appears once granular capture is live.</div>}
      {detail && (
        <div data-segment-detail style={{ background: '#13201a', border: '1px solid #26382e', borderLeft: '3px solid #45c483',
          borderRadius: 10, padding: '9px 11px', margin: '10px auto 0', maxWidth: 320, textAlign: 'left' }}>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#45c483', fontWeight: 800 }}>{detail.label.toUpperCase()}</div>
          <div style={{ fontSize: 12.5, margin: '2px 0 4px' }}>{detail.text}</div>
          <div style={{ color: '#93a89b', fontSize: 12 }}><b style={{ color: '#fff', fontSize: 15 }}>{Math.round(detail.rate * 100)}%</b> of {detail.n} camps</div>
        </div>
      )}
    </div>
  );

  const Stats = (
    <div>
      <SecHead>Reaching Furthest</SecHead>
      <div data-leaderboard>
        {agg.leaderboard.slice(0, 5).map((c, i) => (
          <div key={i} data-rank={i + 1} style={rowStyle}>
            <span style={{ width: 16, color: '#93a89b' }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{c.campName} {i === 0 && <span style={{ color: '#e8c15a' }}>★</span>}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total}/60</b>
          </div>
        ))}
      </div>
      <SecHead>Sector Standings</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '0 18px' }}>
        {agg.sectorStandings.map(s => (
          <div key={s.id} style={rowStyle}><span style={{ flex: 1, color: '#cdebd8' }}>{s.name}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.avg.toFixed(1)}</b></div>
        ))}
      </div>
    </div>
  );

  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, paddingTop: 16, alignItems: 'start' }}>{Hero}{Stats}</div>
    : <div style={{ paddingTop: 12 }}>{Hero}<div style={{ marginTop: 14 }}>{Stats}</div></div>;
}
const SecHead = ({ children }) => <div style={{ fontSize: 10.5, letterSpacing: '.16em', color: '#93a89b', fontWeight: 800, margin: '16px 0 6px' }}>{String(children).toUpperCase()}</div>;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed #21332a', fontSize: 13 };
```

- [ ] **Step 4: Run the check, confirm PASS**

Run: serve repo, `cd /tmp/admincheck && bun city.mjs` → `RESULT: PASS`.

- [ ] **Step 5: Parse-gate + commit**

```bash
bun build admin/admin.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo OK
git add admin/admin.jsx
git commit -m "feat(admin): City view — collective radius, leaderboard, standings, tap-detail"
```

---

## Task 6: Camps view (`CampsView`)

**Files:**
- Modify: `admin/admin.jsx` (replace the `CampsView` placeholder)
- Check (throwaway): `/tmp/admincheck/camps.mjs`

- [ ] **Step 1: Write the failing check**

Write `/tmp/admincheck/camps.mjs`:

```js
const { chromium } = require('playwright');
const ans = {}; ['F1','F2','F3','F4','F5','F6'].forEach((id,i)=>ans[id]= i<5?'yes':'no');
const rows = [
  { timestamp:Date.now(), campName:'Dusty Acres', leadName:'Jo Rivera', email:'jo@dusty.org', year:2026, total:41, source:'form',
    resultUrl:'https://greenradi.us/result/#hh', schemaVersion:'frog-v12',
    greens:{food:5,water:6,waste:6,transport:4,shelter:7,power:5}, answers:ans },
  { timestamp:Date.now(), campName:'Sunfish Co-op', leadName:'K', email:'k@s', year:2026, total:30, source:'board',
    resultUrl:'', schemaVersion:'frog-v12', greens:{food:3,water:3,waste:4,transport:2,shelter:4,power:3}, answers:{} },
];
(async()=>{ const b=await chromium.launch(); const p=await b.newContext({viewport:{width:1000,height:900}}).then(c=>c.newPage());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/api/admin/responses*', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rows,count:rows.length})}));
  await p.goto('http://localhost:8791/admin/'); await p.waitForTimeout(400);
  await p.click('[data-tab="camps"]'); await p.waitForTimeout(200);
  await p.fill('[data-search]','Dusty'); await p.waitForTimeout(150);
  const listed = await p.$$eval('[data-camp-row]', els=>els.map(e=>e.textContent));
  if(listed.length!==1 || !/Dusty/.test(listed[0])){console.error('FAIL: search', listed);process.exitCode=1;}
  await p.click('[data-camp-row]'); await p.waitForTimeout(200);
  const mail = await p.$eval('a[data-email]', a=>a.getAttribute('href'));
  const link = await p.$eval('a[data-result]', a=>a.getAttribute('href'));
  const tokens = await p.$$eval('[data-token]', els=>els.length);
  if(mail!=='mailto:jo@dusty.org'){console.error('FAIL: mailto', mail);process.exitCode=1;}
  if(link!=='https://greenradi.us/result/#hh'){console.error('FAIL: result link', link);process.exitCode=1;}
  if(tokens<6){console.error('FAIL: answer tokens missing', tokens);process.exitCode=1;}
  if(errs.length){console.error('PAGE ERRORS',errs);process.exitCode=1;}
  console.log(process.exitCode?'RESULT: FAIL':'RESULT: PASS'); await b.close(); })();
```

- [ ] **Step 2: Run it, confirm it fails**

Run: serve repo, `cd /tmp/admincheck && bun camps.mjs` → FAIL (placeholder).

- [ ] **Step 3: Replace `CampsView`**

```jsx
function CampsView({ sectors, rows }) {
  const wide = useMQ('(min-width: 760px)');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('score');
  const [selId, setSelId] = React.useState(null);
  const list = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    let xs = rows.filter(r => !ql || (r.campName + ' ' + r.leadName + ' ' + r.email).toLowerCase().includes(ql));
    xs = xs.slice().sort(sort === 'score' ? (a, b) => b.total - a.total : (a, b) => a.campName.localeCompare(b.campName));
    return xs;
  }, [rows, q, sort]);
  const selected = list.find((r, i) => (selId == null ? i === 0 : rowKey(r) === selId)) || list[0];

  const List = (
    <div style={{ borderRight: wide ? '1px solid #26382e' : 'none' }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #26382e' }}>
        <input data-search value={q} onChange={e => setQ(e.target.value)} placeholder="Search camps…"
          style={{ flex: 1, ...selStyle, borderRadius: 7 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle}><option value="score">Score</option><option value="name">Name</option></select>
      </div>
      {list.map(r => (
        <div key={rowKey(r)} data-camp-row onClick={() => setSelId(rowKey(r))}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', cursor: 'pointer',
            borderBottom: '1px solid #1a281f', background: selected && rowKey(selected) === rowKey(r) ? '#16271d' : 'transparent' }}>
          <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{r.campName}</b><small style={{ display: 'block', color: '#93a89b', fontSize: 10 }}>{r.leadName}</small></div>
          <span style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '1px 6px' }}>{r.source}</span>
          <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.total}</b>
        </div>
      ))}
      <div style={{ padding: '8px 11px', color: '#93a89b', fontSize: 10 }}>{list.length} camps · sorted by {sort}</div>
    </div>
  );

  const Detail = selected && <CampDetail sectors={sectors} camp={selected} />;

  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', minHeight: 400 }}>{List}{Detail}</div>
    : (selId ? <div><div onClick={() => setSelId(null)} style={{ color: '#45c483', fontWeight: 700, padding: '8px 4px', cursor: 'pointer' }}>‹ All camps</div>{Detail}</div> : List);
}
const rowKey = r => `${r.campName}|${r.timestamp}`;

function CampDetail({ sectors, camp }) {
  const hasAnswers = camp.answers && Object.keys(camp.answers).length > 0;
  const fills = React.useMemo(() => hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : approxFills(sectors, camp.greens), [sectors, camp, hasAnswers]);
  const maxed = sectors.filter(s => (camp.greens[s.id] || 0) === 10).map(s => s.id);
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div><h3 style={{ margin: 0 }}>{camp.campName}</h3>
          <p style={{ margin: '2px 0 0', color: '#93a89b', fontSize: 12 }}>{camp.leadName} · {camp.email} · {camp.source}</p></div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <a data-email href={`mailto:${camp.email}`} style={{ ...btnStyle, textDecoration: 'none' }}>✉ Email</a>
          {camp.resultUrl && <a data-result href={camp.resultUrl} target="_blank" rel="noreferrer"
            style={{ ...btnStyle, background: 'transparent', color: '#eaf2ec', border: '1px solid #26382e' }}>↗ Green Radius result</a>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '12px 0' }}>
        <RadialBadge sectors={sectors} fills={fills} size={128} dark showLabels={false} />
        <div style={{ fontSize: 13, color: '#cfe0d4' }}><b style={{ color: '#fff' }}>{camp.total}/60</b> total{maxed.length ? ` · ${maxed.length} maxed` : ''}</div>
      </div>
      {!hasAnswers && <div style={{ fontSize: 12, color: '#93a89b' }}>Per-answer detail appears once granular capture is live.</div>}
      {hasAnswers && sectors.map(s => {
        const ids = [].concat(...s.levels.slice(0, 3)).map(qq => qq.id);
        const picks = (s.tier4Topics || []).filter(t => camp.answers[t.id] === 'yes');
        return (
          <div key={s.id} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              {s.name} <span style={{ color: '#93a89b', fontWeight: 600 }}>{camp.greens[s.id] || 0}/10</span>
              {maxed.includes(s.id) && <span style={{ color: '#e8c15a' }}>★</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {ids.map(id => (
                <span key={id} data-token style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6,
                  border: '1px solid ' + (camp.answers[id] === 'yes' ? '#2e5b43' : '#26382e'),
                  background: camp.answers[id] === 'yes' ? '#15291e' : 'transparent',
                  color: camp.answers[id] === 'yes' ? '#cdebd8' : '#93a89b' }}>
                  {camp.answers[id] === 'yes' ? '✓ ' : '✕ '}{id}</span>
              ))}
            </div>
            {picks.length > 0 && <div style={{ marginTop: 5, fontSize: 11, color: '#93a89b' }}>Level 4: {picks.map(t => t.title).join(', ')}</div>}
          </div>
        );
      })}
    </div>
  );
}

// Approximate radius when a camp has no per-answer data: fill totalYes contiguously per sector.
function approxFills(sectors, greens) {
  const out = {};
  sectors.forEach(s => {
    let n = (greens && greens[s.id]) || 0;
    const levels = [0, 1, 2].map(li => (s.levels[li] || []).map(() => { const on = n > 0; if (on) n--; return on; }));
    levels[3] = [0, 1, 2, 3].map(() => { const on = n > 0; if (on) n--; return on; });
    out[s.id] = { levels, totalYes: (greens && greens[s.id]) || 0, played: ((greens && greens[s.id]) || 0) > 0 };
  });
  return out;
}
```

- [ ] **Step 4: Run the check, confirm PASS**

Run: serve repo, `cd /tmp/admincheck && bun camps.mjs` → `RESULT: PASS`.

- [ ] **Step 5: Parse-gate + commit**

```bash
bun build admin/admin.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo OK
git add admin/admin.jsx
git commit -m "feat(admin): Camps view — list/search/sort + per-camp detail (radius, tokens, contact)"
```

---

## Task 7: External setup doc + architecture update

**Files:**
- Create: `docs/admin-setup.md`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Create `docs/admin-setup.md`**

````markdown
# Admin viewer — one-time external setup

Two owner-side steps make `greenradi.us/admin/` work. Both are outside this repo.

## 1. Apps Script `doGet` (returns rows to the Worker)

In the same Apps Script project as `doPost`, add:

```js
function doGet(e) {
  if (e.parameter.secret !== SHARED_SECRET) return json_({ ok: false });   // SHARED_SECRET = the existing shared secret
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('2026 Results');
  var values = sh.getDataRange().getValues();
  var h = values.shift();
  var col = {}; h.forEach(function (name, i) { col[name] = i; });
  var rows = values.filter(function (r) { return r[col['Camp']]; }).map(function (r) {
    return {
      timestamp: r[col['Timestamp']], campName: r[col['Camp']], leadName: r[col['Lead']],
      email: r[col['Email']], year: r[col['Year']],
      greens: { food: r[col['Food']], water: r[col['Water']], waste: r[col['Waste']],
                transport: r[col['Transport']], shelter: r[col['Shelter']], power: r[col['Power']] },
      total: r[col['Total']], source: r[col['Source']], resultUrl: r[col['Result URL']],
      answers_json: r[col['answers_json']] || '', schema_version: r[col['schema_version']] || ''
    };
  });
  return json_({ ok: true, rows: rows });
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
```

Adjust header names to match the sheet. Re-deploy the web app (Manage deployments → edit → New version) — same `/exec` URL, same secret. (Depends on the `answers_json` + `schema_version` columns from the scoring change.)

## 2. Cloudflare Access (gates the page)

1. Zero Trust → Access → Applications → **Add → Self-hosted**. Domain `greenradi.us`, paths `/admin` and `/api/admin`.
2. **Policy:** Allow → Emails → the GTCC team addresses (login via Google or one-time PIN).
3. Copy the application **Audience (AUD)** tag and your team domain (`<team>.cloudflareaccess.com`).
4. Put them in `wrangler.jsonc` `vars` (`CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`) and deploy. They are not secrets.

Without these, the Worker returns 403 (Access not configured) and the page won't load — by design.
````

- [ ] **Step 2: Update `docs/architecture.md`**

Add a subsection under "External integrations" (after the Apps Script bullet):

```markdown
- **Admin viewer read path.** `GET /api/admin/responses` (Worker) is gated by **Cloudflare
  Access** (edge, email allowlist on `/admin*` + `/api/admin*`) and additionally validates the
  Access JWT (`Cf-Access-Jwt-Assertion`, RS256 vs. the team JWKS, `aud === CF_ACCESS_AUD`). It
  proxies a new Apps Script `doGet` (same `/exec`, shared secret) and returns sheet rows as JSON;
  the `/admin/` page (`admin/index.html` + `admin/admin.jsx`, reusing `RadialBadge` + `sectorFill`
  + `window.AdminAggregate`) shapes everything client-side. Read-only. See `docs/admin-setup.md`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/admin-setup.md docs/architecture.md
git commit -m "docs(admin): external setup (Apps Script doGet + Cloudflare Access) + architecture"
```

---

## Task 8: Full integration sweep + responsive check

**Files:**
- Check (throwaway): `/tmp/admincheck/integration.mjs`

- [ ] **Step 1: Write the integration check (desktop + mobile, with and without answers_json)**

```js
const { chromium } = require('playwright');
const withAns = { rows: [{ timestamp:Date.now(), campName:'Dusty Acres', leadName:'Jo', email:'jo@x.org', year:2026, total:58, source:'form',
  resultUrl:'https://greenradi.us/result/#h', schemaVersion:'frog-v12', greens:{food:10,water:9,waste:10,transport:9,shelter:10,power:10},
  answers:{F1:'yes',F2:'yes',F3:'yes',F4:'yes',F5:'yes',F6:'no'} }], count:1 };
const noAns = { rows: [{ ...withAns.rows[0], answers:{} }], count:1 };
async function run(view, data, w){ const b=await chromium.launch();
  const p=await b.newContext({viewport:{width:w,height:900}}).then(c=>c.newPage());
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.route('**/api/admin/responses*', r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)}));
  await p.goto('http://localhost:8791/admin/'); await p.waitForTimeout(400);
  if(view==='camps') await p.click('[data-tab="camps"]');
  await p.waitForTimeout(250);
  await p.screenshot({ path:`/tmp/admincheck/shot-${view}-${w}-${data===noAns?'noans':'ans'}.png` });
  await b.close(); return errs; }
(async()=>{ let fail=0;
  for (const w of [1000, 390]) for (const v of ['city','camps']) for (const d of [withAns, noAns]) {
    const e = await run(v, d, w); if (e.length){ console.error('ERRORS',v,w,e); fail=1; } else console.log('ok',v,w,d===noAns?'noans':'ans'); }
  console.log(fail?'RESULT: FAIL':'RESULT: PASS'); process.exitCode=fail; })();
```

- [ ] **Step 2: Run it**

Run: serve repo, `cd /tmp/admincheck && bun integration.mjs`
Expected: `RESULT: PASS` (no page errors in any of the 8 combos). Eyeball the 8 screenshots: City heatmap + leaderboard; City degraded (uniform + note); Camps detail with ✓/✗; Camps degraded (radius + note); all at 1000px and 390px.

- [ ] **Step 3: Final parse-gate sweep**

```bash
for f in green-radius.jsx admin/admin.jsx; do bun build "$f" --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo "OK $f"; done
bun build admin/aggregate.js > /dev/null && echo "OK aggregate"
bun build worker/index.js > /dev/null && echo "OK worker"
```

- [ ] **Step 4: Commit (if any screenshot fixes were needed) and open the PR**

```bash
git add -A && git commit -m "test(admin): integration sweep notes" --allow-empty
# Push + PR only when the user asks. Recommend after PR #32 has merged.
```

---

## Self-review (completed by plan author)

- **Spec coverage:** City (Task 5) + Camps (Task 6) + shell/tabs/filters (Task 4) + Access JWT & doGet proxy (Task 3) + aggregation (Task 1) + RadialBadge aggregate/interactive (Task 2) + external setup & architecture (Task 7) + responsive/degraded/error/empty + tests (Tasks 4–8). `/stats/` reuse: `CommunityTally` takes `rows`+`sectors` only and renders no PII except the leaderboard names — a future `/stats/` mounts `CommunityTally` and omits the leaderboard. ✓
- **Type consistency:** `computeAggregates(rows, sectors, now, windowMs?)` → `{count,totalYes,totalPossible,tallyPct,sectorStandings,leaderboard,perQuestion,intensities,hasAnswers,momentum}`; `intensities[sid].levels` is `number[][]` consumed by `RadialBadge`'s `intensities` prop; `fillsFromAnswers`/`approxFills` produce `{levels:bool[][],totalYes,played}` for the boolean path. Worker `shapeAdminRows` output matches the row shape consumed by `aggregate.js` and the views. ✓
- **No placeholders:** every code step is complete; the only literal placeholders are the `CF_ACCESS_*` config values (filled in Task 7) and the `/ABS/REPO/` paths in throwaway checks (engineer substitutes). ✓
- **Sequencing risk:** Tasks 2+ assume post-#32 symbols — rebase on merged `main` first (stated up top). ✓
