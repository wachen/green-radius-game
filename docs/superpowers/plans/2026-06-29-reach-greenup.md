# Reach + Green-Up (#39) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Web Share Level 2 of the PNG card, per-camp OG unfurls, Expanding-Radius rank titles, and a done-screen-only Green-Up Plan — all additive, all degrading gracefully.

**Architecture:** A new isomorphic `rank.js` (shared by browser + Worker). The done screen pre-generates the card PNG and shares it as a file, builds result links with a `?r=<hash>` query, and renders the rank title + a collapsed Green-Up panel. The Worker decodes `?r=` server-side (reusing `result-state.js`) and rewrites the `/result/` OG tags via `HTMLRewriter`, fail-open to the static tags.

**Tech stack:** No-build React 18 (in-browser Babel), Cloudflare Worker (esbuild bundle via wrangler), Bun for the parse gate + isomorphic smoke tests. No Node, no `curl`, no test runner.

**Spec:** `docs/superpowers/specs/2026-06-29-reach-greenup-design.md`

**Branch:** `reach-greenup` (already holds the #38 doc-currency commit + this spec).

---

## File structure

- **Create** `rank.js` — isomorphic rank bands + `titleFor(total)`.
- **Create** `tests/rank.test.mjs` *(or inline `bun -e`)* — band-boundary assertions.
- **Modify** `result-state.js` — `globalThis` hardening (one line) for safe Worker import.
- **Modify** `green-radius.jsx` — `svgToPngBlob` refactor; pre-generate PNG; Share L2; `?r=` URLs; rank headline; `greenUpSteps()` + `<GreenUpPlan>`.
- **Modify** `index.html` — load `rank.js`.
- **Modify** `result/index.html` — read `?r=` then `#hash`.
- **Modify** `worker/index.js` — OG-rewrite route for `/result/?r=`.
- **Modify** `docs/architecture.md` — document the new wiring.

Verification commands used throughout:

```bash
# Parse gate (JSX compiles). "could not resolve react" is EXPECTED and fine.
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo PARSE_OK

# Worker bundles (imports resolve, no module-eval throw)
bunx wrangler deploy --dry-run --outdir "$CLAUDE_JOB_DIR/tmp/dry" 2>&1 | tail -5
```

---

### Task 1: `rank.js` — isomorphic rank module

**Files:**
- Create: `rank.js`
- Test: `bun -e` smoke (Step 1)

- [ ] **Step 1: Write the failing test**

Run this now (module doesn't exist yet → fails):

```bash
bun -e "
const { titleFor, BANDS } = require('./rank.js');
const cases = [[0,'First Spark'],[10,'First Spark'],[11,'Dusty Ember'],[20,'Dusty Ember'],[21,'Rising Glow'],[31,'Wide Beacon'],[41,'Solar Camp'],[50,'Solar Camp'],[51,'Green Supernova'],[60,'Green Supernova'],[-5,'First Spark'],[99,'Green Supernova']];
for (const [t,want] of cases) { const got = titleFor(t); if (got !== want) throw new Error(\`titleFor(\${t})=\${got}, want \${want}\`); }
if (BANDS.length !== 6) throw new Error('expected 6 bands');
console.log('RANK_OK');
"
```

- [ ] **Step 2: Run it to confirm it fails**

Expected: `Cannot find module './rank.js'`.

- [ ] **Step 3: Write `rank.js`**

```js
// rank.js — a camp's playa-rank title from its total Green Radius score (0–60).
// Isomorphic (browser + Worker): the done screen + share text read window.Rank;
// the Worker imports titleFor for the per-camp OG description. Resolve the global
// via globalThis (defined in browser, Worker, and Bun) so importing this into the
// Worker bundle never throws on an undefined top-level `this`.
(function (global) {
  'use strict';
  var BANDS = [
    { min: 0,  title: 'First Spark' },
    { min: 11, title: 'Dusty Ember' },
    { min: 21, title: 'Rising Glow' },
    { min: 31, title: 'Wide Beacon' },
    { min: 41, title: 'Solar Camp' },
    { min: 51, title: 'Green Supernova' },
  ];
  function titleFor(total) {
    var t = Math.max(0, Math.min(60, total | 0));
    var out = BANDS[0].title;
    for (var i = 0; i < BANDS.length; i++) if (t >= BANDS[i].min) out = BANDS[i].title;
    return out;
  }
  var api = { titleFor: titleFor, BANDS: BANDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Rank = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 4: Run the test to confirm it passes**

Run the Step 1 command. Expected: `RANK_OK`.

- [ ] **Step 5: Commit**

```bash
git add rank.js
git commit -m "feat: rank.js — isomorphic playa-rank titles (0–60 → title)"
```

---

### Task 2: Harden `result-state.js` for Worker import

**Files:**
- Modify: `result-state.js:89`

- [ ] **Step 1: Confirm current decode still works (baseline)**

```bash
bun -e "
const { encode, decode } = require('./result-state.js');
const fills = { food:{levels:[[true],[true,false],[false,false,false],[true,false,false,false]]} };
const h = encode({ campName:'Dusty Camp', leadName:'A', year:2026, fills });
const d = decode(h);
if (d.campName !== 'Dusty Camp') throw new Error('campName lost');
if (d.fills.food.totalYes !== 3) throw new Error('totalYes='+d.fills.food.totalYes);
console.log('DECODE_OK');
"
```
Expected: `DECODE_OK`.

- [ ] **Step 2: Change the IIFE global resolver**

In `result-state.js`, last line (currently):

```js
})(typeof window !== 'undefined' ? window : this);
```

becomes:

```js
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

- [ ] **Step 3: Re-run the Step 1 baseline**

Expected: still `DECODE_OK` (browser/Bun behavior unchanged; `globalThis === window` in a browser).

- [ ] **Step 4: Commit**

```bash
git add result-state.js
git commit -m "refactor: resolve result-state global via globalThis (safe Worker import)"
```

---

### Task 3: Extract `svgToPngBlob` (download behavior unchanged)

**Files:**
- Modify: `green-radius.jsx:177-211`

- [ ] **Step 1: Replace `downloadSvgAsPng` with `svgToPngBlob` + a thin download wrapper**

Replace the whole function (lines 177–211) with:

```js
// Rasterize the card SVG to a PNG Blob on a 2× canvas. Best-effort font embed so
// the PNG matches the screen typeface. Shared by the Download button and Web Share.
async function svgToPngBlob(svgEl, scale = 2) {
  const W = svgEl.viewBox.baseVal.width, H = svgEl.viewBox.baseVal.height;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = await fontEmbedCss();
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }
  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
  );
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl; });
    if (css) await new Promise(r => setTimeout(r, 60)); // let the embedded font settle before drawing
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, W, H);
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function downloadSvgAsPng(svgEl, filename, scale = 2) {
  const blob = await svgToPngBlob(svgEl, scale);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
```

- [ ] **Step 2: Parse gate**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo PARSE_OK
```
Expected: `PARSE_OK`.

- [ ] **Step 3: Manual check**

Serve (`python3 -m http.server 8000` or `bunx serve`), play a quick game, tap **Download** on the done screen → a `green-radius-<slug>.png` downloads and looks identical to before. (Behavior must be unchanged — this is a pure refactor.)

- [ ] **Step 4: Commit**

```bash
git add green-radius.jsx
git commit -m "refactor: split svgToPngBlob out of downloadSvgAsPng (no behavior change)"
```

---

### Task 4: Pre-generate the PNG + Web Share Level 2

**Files:**
- Modify: `green-radius.jsx` — add a ref + effect near `cardSvgRef` (jsx:1958); rewrite `handleShare` (jsx:2231-2236).

- [ ] **Step 1: Add a blob ref beside `cardSvgRef`**

After `const cardSvgRef = useRef(null);` (jsx:1958), add:

```js
  const cardPngRef = useRef(null);   // pre-generated PNG Blob for Web Share L2 (Safari needs it ready in-gesture)
```

- [ ] **Step 2: Pre-generate the blob when the done screen mounts**

Add this effect next to the existing submit effect (after the block ending jsx:2041):

```js
  // Pre-rasterize the card so Web Share has the file ready inside the tap gesture
  // (Safari blocks share() if the file is produced by a later async step). Best-effort.
  useEffect(() => {
    if (phase !== 'done' || !cardSvgRef.current) return;
    let alive = true;
    svgToPngBlob(cardSvgRef.current).then(b => { if (alive) cardPngRef.current = b; }).catch(() => {});
    return () => { alive = false; };
  }, [phase, fills]);
```

- [ ] **Step 3: Rewrite `handleShare` (jsx:2231-2236) for Level 2**

```js
    async function handleShare() {
      const shareText = `Our camp reached ${total}/60 — ${rankTitle}. Build your camp's Green Radius:`;
      try {
        const blob = cardPngRef.current;
        if (blob && navigator.canShare) {
          const file = new File([blob], `green-radius-${slug}.png`, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: 'Our Green Radius', text: shareText, url: resultUrl });
            return;
          }
        }
        if (navigator.share) { await navigator.share({ title: 'Our Green Radius', text: shareText, url: resultUrl }); return; }
        await navigator.clipboard.writeText(resultUrl); setCopied(true); setTimeout(() => setCopied(false), 1500);
      } catch {}
    }
```

- [ ] **Step 4: Make `total`/`rankTitle` real + load `rank.js` (handleShare's first use of the rank)**

  - In `index.html`, after line 129 (`<script defer src="result-state.js"></script>`), add:

    ```html
    <script defer src="rank.js"></script>
    ```

  - At the top of the `phase === 'done'` block (after jsx:2224 `const year = …`), add:

    ```js
    const total = sectors.reduce((n, s) => n + (fills[s.id] ? fills[s.id].totalYes : 0), 0);
    const rankTitle = (window.Rank ? window.Rank.titleFor(total) : '');
    ```

  These are the permanent definitions; Task 6 renders a headline from them and does **not** redefine them.

- [ ] **Step 5: Parse gate**

Run the parse gate. Expected: `PARSE_OK`.

- [ ] **Step 6: Manual check**

On a share-capable browser (or phone), tap **Share link**: on a phone you get the native sheet with the card image attached + the text; on desktop Chrome it shares title/text/url; with no Web Share it copies the link ("Link copied!"). No errors in console.

- [ ] **Step 7: Commit**

```bash
git add green-radius.jsx index.html
git commit -m "feat: Web Share Level 2 — share the card PNG as a file, pre-generated on done"
```

---

### Task 5: `?r=` result links (client side)

**Files:**
- Modify: `green-radius.jsx:2002-2003` and `green-radius.jsx:2225-2226` (both `resultUrl` builds)
- Modify: `result/index.html:75`

- [ ] **Step 1: Switch both `resultUrl` builds from `#` to `?r=`**

At jsx:2002-2003 (submit/email path) AND jsx:2225-2226 (done-screen share path), change:

```js
      const resultUrl = window.location.origin + '/result/#' +
        window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
```

to:

```js
      const resultUrl = window.location.origin + '/result/?r=' +
        window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
```

(Indentation differs slightly between the two sites — match each.)

- [ ] **Step 2: Make `/result/` read `?r=` then `#hash` (legacy)**

In `result/index.html`, line 75:

```js
const data = window.ResultState.decode(window.location.hash);
```

becomes:

```js
const data = window.ResultState.decode(
  new URLSearchParams(window.location.search).get('r') || window.location.hash
);
```

(`decode()` already strips a leading `#`; a raw `?r=` value has none, so both forms work.)

- [ ] **Step 3: Parse gate + decode smoke**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo PARSE_OK
bun -e "const {encode,decode}=require('./result-state.js'); const h=encode({campName:'X',year:2026,fills:{}}); if(!decode(h)) throw new Error('decode of raw r-value failed'); console.log('RVALUE_OK');"
```
Expected: `PARSE_OK` then `RVALUE_OK`.

- [ ] **Step 4: Manual check**

Play a game; after the done screen, copy the share link → it is `…/result/?r=<hash>`. Open it → the card renders. Also paste an OLD-style `…/result/#<hash>` link → still renders (legacy fallback).

- [ ] **Step 5: Commit**

```bash
git add green-radius.jsx result/index.html
git commit -m "feat: result links use ?r= query (crawler-visible) with #hash legacy fallback"
```

---

### Task 6: Rank headline on the done screen

**Files:**
- Modify: `green-radius.jsx` — render headline after the campName `<h2>` (jsx:2279)

> `rank.js` is already loaded (Task 4 Step 4) and `total`/`rankTitle` are already defined at the top of the done block (Task 4 Step 4). This task only renders them.

- [ ] **Step 1: Render the headline after the campName `<h2>`**

The campName `<h2>` ends at jsx:2279. Immediately after it, insert:

```jsx
        {rankTitle && (
          <div style={{ fontSize: 15, fontWeight: 700, color: palette.text, margin: '-16px 0 24px' }}>
            Your camp is a <span style={{ color: palette.accentDark }}>{rankTitle}</span> · {total}/60
          </div>
        )}
```

- [ ] **Step 2: Parse gate**

Expected: `PARSE_OK`.

- [ ] **Step 3: Manual check**

Finish a game → the done screen shows e.g. "Your camp is a **Wide Beacon** · 38/60" under the camp name; the number matches the card.

- [ ] **Step 4: Commit**

```bash
git add green-radius.jsx
git commit -m "feat: Expanding-Radius rank headline on the done screen"
```

---

### Task 7: Worker OG rewrite for `/result/?r=`

**Files:**
- Modify: `worker/index.js:1-11` (imports + route)

- [ ] **Step 1: Write the failing rewrite test**

```bash
bun -e "
const { titleFor } = require('./rank.js');
const html = '<meta property=\"og:title\" content=\"Our Green Radius\"/><meta property=\"og:description\" content=\"old\"/>';
const camp = 'Dusty Camp', total = 38;
const rw = new HTMLRewriter()
  .on('meta[property=\"og:title\"]', { element(e){ e.setAttribute('content', camp + \"'s Green Radius\"); } })
  .on('meta[property=\"og:description\"]', { element(e){ e.setAttribute('content', 'Reached ' + total + '/60 — ' + titleFor(total) + '. See the card and build your own at greenradi.us.'); } });
const out = await rw.transform(new Response(html)).text();
if (!out.includes(\"Dusty Camp's Green Radius\")) throw new Error('title not rewritten: ' + out);
if (!out.includes('Wide Beacon')) throw new Error('desc not rewritten: ' + out);
console.log('OG_OK');
"
```
Expected: `OG_OK` (this validates the rewrite shape Bun-side before wiring it into the Worker).

- [ ] **Step 2: Add imports at the top of `worker/index.js`**

Above `const SECTOR_IDS = …` (line 1), add:

```js
import ResultState from '../result-state.js';
import Rank from '../rank.js';
```

- [ ] **Step 3: Add the OG route in `fetch` (worker:4-11)**

Replace the `fetch` body so the new branch runs before the static-assets fallback:

```js
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/complete' && request.method === 'POST') return handleComplete(request, env);
    if (url.pathname === '/api/admin/responses' && request.method === 'GET') return handleAdminResponses(request, env);
    if (request.method === 'GET' && url.pathname === '/result/' && url.searchParams.has('r')) {
      return resultWithOg(request, env, url.searchParams.get('r'));
    }
    return env.ASSETS.fetch(request);
  },
```

- [ ] **Step 4: Add `resultWithOg` (after `handleComplete`, before `appendToSheet`)**

```js
// Per-camp OG: decode the ?r= hash, rewrite /result/'s og:title/description to the
// camp's name + score. Image stays the static og-card.png. Fail-open: any problem
// serves the unmodified static page (generic unfurl is fine; a broken page is not).
async function resultWithOg(request, env, r) {
  const res = await env.ASSETS.fetch(request);
  let data;
  try { data = ResultState.decode(r); } catch { data = null; }
  if (!data) return res;
  const total = ResultState.SECTOR_IDS.reduce((n, id) => n + ((data.fills[id] && data.fills[id].totalYes) | 0), 0);
  const camp = String(data.campName || '').slice(0, 80).trim();
  const title = camp ? `${camp}'s Green Radius` : 'Our Green Radius';
  const desc = `Reached ${total}/60 — ${Rank.titleFor(total)}. See the card and build your own at greenradi.us.`;
  return new HTMLRewriter()
    .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', desc); } })
    .transform(res);
}
```

- [ ] **Step 5: Verify the Worker bundles (import safety)**

```bash
bunx wrangler deploy --dry-run --outdir "$CLAUDE_JOB_DIR/tmp/dry" 2>&1 | tail -5
```
Expected: a successful dry-run bundle (e.g. "Total Upload: … " / no error). If `wrangler` is unavailable, fall back to confirming esbuild resolves the imports:
```bash
bun build worker/index.js --target=node --outfile "$CLAUDE_JOB_DIR/tmp/worker-bundle.js" 2>&1 | tail -5 && echo BUNDLE_OK
```
This proves the `globalThis` hardening (Tasks 1 + 2) makes both modules import without a module-eval throw.

- [ ] **Step 6: Commit**

```bash
git add worker/index.js
git commit -m "feat: per-camp OG unfurl — Worker rewrites /result/?r= og:title/description"
```

---

### Task 8: Green-Up Plan

**Files:**
- Modify: `green-radius.jsx` — add `greenUpSteps()` (top-level pure fn near `sectorFill`) + `<GreenUpPlan>` component; render it in the done block.

- [ ] **Step 1: Add the pure step-derivation function**

Add near the other top-level game-logic helpers (e.g. just below `downloadSvgAsPng`, before the icons section at jsx:213):

```js
// Green-Up Plan data: every "No" answer becomes a next-year step. Levels 1–3 come
// from sector.levels[0..2]; level 4 from sector.tier4Topics. Grouped by sector (board
// order), each group's steps in level order. Zero gaps → empty array (panel hides).
function greenUpSteps(sectors, answers) {
  const groups = [];
  for (const s of sectors) {
    const steps = [];
    (s.levels || []).forEach((qs, i) => {
      (qs || []).forEach(q => { if (answers[q.id] === 'no') steps.push({ level: i + 1, title: q.title, link: q.link }); });
    });
    (s.tier4Topics || []).forEach(t => { if (answers[t.id] === 'no') steps.push({ level: 4, title: t.title, link: t.link }); });
    if (steps.length) groups.push({ sector: s.name, steps });
  }
  return groups;
}
```

- [ ] **Step 2: Smoke-test the derivation (pure, Bun-runnable via a tiny inline copy)**

`greenUpSteps` is pure but lives in the JSX bundle. Verify its logic with an inline mirror against the real data:

```bash
bun -e "
global.window = {};
require('./game-data.js');
const sectors = global.window.SECTORS;
function greenUpSteps(sectors, answers){const g=[];for(const s of sectors){const st=[];(s.levels||[]).forEach((qs,i)=>{(qs||[]).forEach(q=>{if(answers[q.id]==='no')st.push({level:i+1,title:q.title,link:q.link});});});(s.tier4Topics||[]).forEach(t=>{if(answers[t.id]==='no')st.push({level:4,title:t.title,link:t.link});});if(st.length)g.push({sector:s.name,steps:st});}return g;}
const f = sectors[0].levels[0][0].id, t4 = sectors[0].tier4Topics[0].id;
const out = greenUpSteps(sectors, { [f]:'no', [t4]:'no' });
if (out.length !== 1) throw new Error('expected 1 group, got ' + out.length);
if (out[0].steps.length !== 2) throw new Error('expected 2 steps');
if (out[0].steps[0].level !== 1 || out[0].steps[1].level !== 4) throw new Error('level order wrong');
if (greenUpSteps(sectors, {}).length !== 0) throw new Error('empty should yield no groups');
console.log('GREENUP_OK');
"
```
Expected: `GREENUP_OK`. (If `game-data.js` assigns via `window`, the `global.window` shim above captures `SECTORS`.)

- [ ] **Step 3: Add the `<GreenUpPlan>` component**

Add near other small components (above `GreenRadiusGame`, e.g. before jsx:1958's component). It manages its own collapsed state:

```jsx
function GreenUpPlan({ sectors, answers, palette }) {
  const [open, setOpen] = React.useState(false);
  const groups = greenUpSteps(sectors, answers);
  if (!groups.length) return null;
  const count = groups.reduce((n, g) => n + g.steps.length, 0);
  return (
    <div style={{ marginTop: 20, textAlign: 'left', border: `1.5px solid ${palette.text}1a`, borderRadius: 12, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
          font: 'inherit', color: palette.heading, fontWeight: 800, fontSize: 14 }}>
        <span>🌱 Your Green-Up Plan · {count} {count === 1 ? 'idea' : 'ideas'}</span>
        <span aria-hidden="true" style={{ color: palette.accentDark }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 14px' }}>
          <div style={{ fontSize: 13, color: palette.text, opacity: 0.7, margin: '0 0 12px' }}>Ideas to grow your radius next year.</div>
          {groups.map(g => (
            <div key={g.sector} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase', color: palette.accentDark, marginBottom: 4 }}>{g.sector}</div>
              {g.steps.map((st, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', fontSize: 14, color: palette.text }}>
                  <span><span style={{ opacity: 0.55 }}>L{st.level} · </span>{st.title}</span>
                  {st.link && st.link.url && (
                    <a href={st.link.url} target="_blank" rel="noopener noreferrer"
                      aria-label={`${st.title} — guide`} style={{ color: palette.accentDark, textDecoration: 'none', fontWeight: 700, flexShrink: 0 }}>→</a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Render it in the done block**

After the action buttons / retry block in the done screen (after the `needsRetry` block that starts at jsx:2343), before the Exit control, add:

```jsx
        <GreenUpPlan sectors={sectors} answers={answers} palette={palette} />
```

- [ ] **Step 5: Parse gate + manual**

Run the parse gate (`PARSE_OK`). Then play a game answering **No** to a few questions across sectors → the done screen shows a collapsed "🌱 Your Green-Up Plan · N ideas"; expanding lists them grouped by sector, lowest level first, with → links. Play a perfect game (all Yes) → the panel does not appear. Confirm `/result/` pages never show it.

- [ ] **Step 6: Commit**

```bash
git add green-radius.jsx
git commit -m "feat: done-screen Green-Up Plan — collapsed next-year steps from No answers"
```

---

### Task 9: Document the new wiring

**Files:**
- Modify: `docs/architecture.md`

- [ ] **Step 1: Update the data-flow + integrations**

In `docs/architecture.md`:
- In **End-to-end data flow** (the share-link bullet ~line 57-60), note the link is now `/result/?r=<hash>` (query, crawler-visible) with `#hash` as a legacy fallback, and that the client reads `?r=` first.
- Add a short **External integrations** bullet for the OG rewrite:

```markdown
- **Per-camp OG (Worker `HTMLRewriter`).** `GET /result/?r=<hash>` decodes the hash
  server-side (reusing `result-state.js`) and rewrites `og:title`/`og:description` to
  the camp's name + score + playa-rank (`rank.js`). Image stays the static
  `og-card.png`. Fail-open: any decode/rewrite issue serves the unmodified page.
  Privacy: `?r=` makes the result readable by the Worker (it's not logged by us, but
  Cloudflare may record URLs) — the same data already lands in the Sheet on completion.
- **`rank.js`** is isomorphic (`window.Rank` + `module.exports`, resolved via
  `globalThis`) so the browser and the Worker compute the rank title from one source.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: architecture — ?r= result links, per-camp OG rewrite, rank.js"
```

---

### Task 10: Final verification

- [ ] **Step 1: Parse gate + Worker bundle + all smokes**

```bash
bun build green-radius.jsx --external react --external react/jsx-runtime --external react/jsx-dev-runtime > /dev/null && echo PARSE_OK
bunx wrangler deploy --dry-run --outdir "$CLAUDE_JOB_DIR/tmp/dry" 2>&1 | tail -3
bun -e "const {titleFor}=require('./rank.js'); if(titleFor(60)!=='Green Supernova'||titleFor(0)!=='First Spark') throw 0; console.log('RANK_OK')"
```
Expected: `PARSE_OK`, a clean dry-run, `RANK_OK`.

- [ ] **Step 2: Full manual playthrough (desktop + phone-sized viewport 390×667)**

  1. Board game, some No answers → rank headline correct; Green-Up lists the No's grouped/ordered; Download still works; Share offers the card file (phone) or text/url (desktop).
  2. Copy share link → `…/result/?r=…`; open → card renders. Old `#hash` link still renders.
  3. Perfect game → no Green-Up panel.
  4. Form mode → same behaviors.

- [ ] **Step 3: Confirm the branch is clean and the doc commit is present**

```bash
git log --oneline main..HEAD
git status -sb
```

---

## Notes for the implementer

- **No `window.` prefix for components.** `GreenUpPlan` is referenced by bare name (shared Babel scope) — never `window.GreenUpPlan`.
- **`React.useState`/`React.useRef`** — the file uses `useRef`/`useEffect` via destructured `React` hooks at top (e.g. `cardSvgRef = useRef(...)`). Match whatever the surrounding code uses (bare `useState` vs `React.useState`); the snippets above use `React.useState` in the new component — change to bare `useState` if that's the file's convention.
- **Per-channel honesty preserved.** Don't touch the `{sheet,email}` submit logic; the `?r=` change is only to the URL string.
- **Copy style:** no em dashes in user-facing strings (the rank headline + Green-Up copy above comply).
