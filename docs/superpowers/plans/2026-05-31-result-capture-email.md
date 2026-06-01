# Green Radius — Result Capture + Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On game completion, let a camp submit (required email) to append their results to a Google Sheet and email themselves a shareable Green Radius result link. Consent to be contacted is implicit — granted when the player clicks **Start** (to play the game or fill the form) and disclosed on the Start screen; no consent checkbox or column.

**Architecture:** Approach A (explicit action on the done screen). A new Cloudflare Worker handles `POST /api/complete` (Apps Script sheet append + Resend email) and forwards everything else to static assets. A new stateless `/result/` page renders the existing `ShareCard` from URL-hash-encoded state. The no-build client (`green-radius.jsx`) gains a done-screen CTA + real share button.

**Tech Stack:** Cloudflare Workers (Static Assets), Google Apps Script web app, Resend, vanilla ES modules + React 18 UMD/Babel-standalone (no build).

**Approved spec:** `docs/cert-email-design.md`

**Verification model:** No test framework. Pure logic → `node -e` round-trip; Worker → `npx wrangler dev` + `curl`; UI → browser walk-through. Commit each task to the feature branch.

---

### Task 0: Feature branch

**Files:** none

- [ ] **Step 1:** Create the branch off the synced main.

```bash
git fetch origin
git checkout -b result-capture-email origin/main
```

- [ ] **Step 2:** Confirm you're on it and it tracks origin.

Run: `git status -sb | head -1`
Expected: `## result-capture-email...origin/main` (or no upstream yet — fine; we set it on first push)

---

### Task 1: (YOU) Google Sheet + Apps Script web app

**Files:** none in repo (owner-side setup)

- [ ] **Step 1:** Create a Google Sheet named e.g. "Green Radius Completions". Add a tab named `Completions` with this header row:

`Timestamp | Camp | Lead | Email | Year | Food | Water | Waste | Transport | Shelter | Power | Total | Source | Result URL`

- [ ] **Step 2:** Extensions → Apps Script. Replace `Code.gs` with:

```javascript
// Deploy as Web App: Execute as = Me, Who has access = Anyone.
var SHARED_SECRET = 'CHOOSE_A_LONG_RANDOM_STRING'; // must match the Worker secret
var SHEET_NAME = 'Completions';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SHARED_SECRET) return json_({ ok: false, error: 'forbidden' });
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    var s = body.greens || {};
    var ids = ['food','water','waste','transport','shelter','power'];
    var total = ids.reduce(function (a, id) { return a + (s[id] | 0); }, 0);
    sheet.appendRow([
      new Date(), body.campName || '', body.leadName || '', body.email || '', body.year || '',
      s.food|0, s.water|0, s.waste|0, s.transport|0, s.shelter|0, s.power|0,
      total, body.source || '', body.resultUrl || ''
    ]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 3:** Deploy → New deployment → Web app. Copy the `/exec` URL.

- [ ] **Step 4:** Verify with curl (replace URL + secret):

```bash
curl -sS -L -X POST '<EXEC_URL>' -H 'Content-Type: application/json' \
  -d '{"secret":"CHOOSE_A_LONG_RANDOM_STRING","campName":"Test","email":"a@b.co","year":2026,"greens":{"food":4,"water":2,"waste":0,"transport":3,"shelter":1,"power":4},"source":"board","resultUrl":"https://greenradi.us/result/#x"}'
```
Expected: `{"ok":true}` and a new row in the sheet.

- [ ] **Step 5:** Hand off to the Worker step: the `/exec` URL → `SHEETS_WEBAPP_URL`, the secret → `SHEETS_SHARED_SECRET`.

---

### Task 2: (YOU) Resend account + greenradi.us sending domain

**Files:** none in repo (owner-side setup)

- [ ] **Step 1:** Create a Resend account. Add domain `greenradi.us` (or subdomain `send.greenradi.us`).
- [ ] **Step 2:** Resend shows SPF (TXT), DKIM (CNAME/TXT), and DMARC records. Add them in Cloudflare DNS for greenradi.us. Wait for Resend to mark the domain **Verified**.
- [ ] **Step 3:** Create an API key (sending scope) → this becomes `RESEND_API_KEY`.
- [ ] **Step 4:** Confirm the email identity: From = `noreply@greenradi.us`, Reply-To = `greenthemecamps@burningman.org` (GTCC team alias — replies reach the team even though the visible sender is no-reply). Only the From domain (greenradi.us) needs Resend verification; the reply-to can be any address. If different, update `worker/index.js` Task 6.

---

### Task 3: `result-state.js` — encode/decode the result into a URL hash

**Files:**
- Create: `result-state.js`

- [ ] **Step 1:** Create `result-state.js`:

```javascript
// result-state.js — encode/decode a Green Radius result into a URL hash.
// Used by the game (build the link) and /result/ (render it). No dependencies; runs in browser + node.
(function (global) {
  'use strict';
  var SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];

  function toB64Url(str) {
    var b64 = (typeof btoa === 'function')
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(s) {
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return (typeof atob === 'function')
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf8');
  }

  function encode(payload) {
    var greens = SECTOR_IDS.map(function (id) {
      return Math.max(0, Math.min(4, ((payload.greens || {})[id]) | 0));
    });
    return toB64Url(JSON.stringify({ c: payload.campName || '', l: payload.leadName || '', y: payload.year | 0, g: greens }));
  }

  function decode(hash) {
    var h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    try {
      var o = JSON.parse(fromB64Url(h));
      if (!o || !Array.isArray(o.g) || o.g.length !== 6) return null;
      var greens = {};
      SECTOR_IDS.forEach(function (id, i) { greens[id] = Math.max(0, Math.min(4, o.g[i] | 0)); });
      return { campName: o.c || '', leadName: o.l || '', year: o.y | 0, greens: greens };
    } catch (e) { return null; }
  }

  // Greens are always a contiguous prefix in this game, so count fully determines the visual.
  function greensToLevelStates(greens) {
    var ls = {};
    SECTOR_IDS.forEach(function (id) {
      var k = (greens[id]) | 0;
      ls[id] = [0, 1, 2, 3].map(function (i) { return i < k ? 'green' : 'locked'; });
    });
    return ls;
  }

  var api = { encode: encode, decode: decode, greensToLevelStates: greensToLevelStates, SECTOR_IDS: SECTOR_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ResultState = api;
})(typeof window !== 'undefined' ? window : this);
```

- [ ] **Step 2:** Round-trip verify with node:

```bash
node -e "const R=require('./result-state.js');const p={campName:'Camp Foo',leadName:'Ada',year:2026,greens:{food:4,water:2,waste:0,transport:3,shelter:1,power:4}};const d=R.decode('#'+R.encode(p));if(!(d.campName==='Camp Foo'&&d.greens.transport===3&&d.greens.waste===0))throw new Error('mismatch');console.log('OK round-trip');"
```
Expected: `OK round-trip`

- [ ] **Step 3:** Commit.

```bash
git add result-state.js && git commit -m "Add result-state: encode/decode Green Radius result into a URL hash"
```

---

### Task 4: `/result/` page

**Files:**
- Create: `result/index.html`

- [ ] **Step 1:** Create `result/index.html`. Copy the `<head>` + script tags for React/ReactDOM/Babel from `index.html` (same pinned versions), then load `game-data.js`, `green-radius.jsx` (for the `window`-exported `ShareCard`), and `result-state.js`. Mount script:

```html
<div id="root" style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#D8CBB6;padding:24px"></div>
<script type="text/babel" data-presets="react">
  const data = window.ResultState.decode(window.location.hash);
  const root = ReactDOM.createRoot(document.getElementById('root'));
  if (!data) {
    root.render(<p style={{fontFamily:'system-ui',color:'#3c2a1e'}}>This result link looks invalid or incomplete.</p>);
  } else {
    const levelStates = window.ResultState.greensToLevelStates(data.greens);
    root.render(
      <window.ShareCard sectors={window.SECTORS} levelStates={levelStates}
        campName={data.campName} leadName={data.leadName} year={data.year} palette={{}} />
    );
  }
</script>
```
Note: `green-radius.jsx` only defines components + does `window` exports at module scope (the game is mounted by `index.html`, not by the .jsx), so loading it here does NOT start a game. `ShareCard` renders with its own internal colors, so `palette={{}}` is safe.

- [ ] **Step 2:** Browser-verify. Generate a sample hash, then open the page:

```bash
node -e "console.log(require('./result-state.js').encode({campName:'Test Camp',leadName:'Ada',year:2026,greens:{food:4,water:2,waste:0,transport:3,shelter:1,power:4}}))"
python3 -m http.server 8000
# open http://localhost:8000/result/#<paste-hash>
```
Expected: the dark ShareCard renders with "Test Camp", the radial badge, and per-sector L0–L4.

- [ ] **Step 3:** Commit.

```bash
git add result/index.html && git commit -m "Add /result/ page rendering ShareCard from URL-hash state"
```

---

### Task 5: `wrangler.jsonc` — add the Worker entry + assets binding

**Files:**
- Modify: `wrangler.jsonc`

- [ ] **Step 1:** Add `"main"` and an assets `binding`. Result:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "green-radius-game",
  "compatibility_date": "2026-05-22",
  "main": "worker/index.js",
  "observability": { "enabled": true },
  "assets": { "directory": ".", "binding": "ASSETS" },
  "compatibility_flags": ["nodejs_compat"]
}
```
Note: with `main` set, the Worker handles all requests and must forward non-API ones to `env.ASSETS`. The worker source under `directory: "."` remains publicly fetchable (open-source repo — acceptable).

- [ ] **Step 2:** Commit.

```bash
git add wrangler.jsonc && git commit -m "Wire wrangler to a Worker entry + ASSETS binding"
```

---

### Task 6: `worker/index.js` — POST /api/complete

**Files:**
- Create: `worker/index.js`

- [ ] **Step 1:** Create `worker/index.js`:

```javascript
const SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];
const ALLOWED_ORIGIN = 'https://greenradi.us';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/complete' && request.method === 'POST') return handleComplete(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function handleComplete(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (origin && origin !== ALLOWED_ORIGIN && !origin.startsWith('http://localhost')) return json({ error: 'forbidden' }, 403);

  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }

  if (body.website) return json({ sheet: 'skipped', email: 'skipped' }); // honeypot → bot
  if (!body.campName || !body.email) return json({ error: 'missing_fields' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return json({ error: 'bad_email' }, 400);

  const greens = {};
  for (const id of SECTOR_IDS) greens[id] = Math.max(0, Math.min(4, (body.greens && body.greens[id]) | 0));
  const row = {
    secret: env.SHEETS_SHARED_SECRET,
    campName: body.campName, leadName: body.leadName || '', email: body.email,
    year: body.year | 0, greens, source: body.source === 'form' ? 'form' : 'board',
    resultUrl: body.resultUrl || '',
  };

  const [sheetRes, emailRes] = await Promise.allSettled([
    appendToSheet(env, row),
    sendEmail(env, body.email, body.campName, body.resultUrl),
  ]);
  return json({
    sheet: sheetRes.status === 'fulfilled' && sheetRes.value ? 'ok' : 'err',
    email: emailRes.status === 'fulfilled' && emailRes.value ? 'sent' : 'err',
  });
}

async function appendToSheet(env, row) {
  if (!env.SHEETS_WEBAPP_URL) return false;
  const r = await fetch(env.SHEETS_WEBAPP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
  if (!r.ok) return false;
  const j = await r.json().catch(() => ({}));
  return j.ok === true;
}

async function sendEmail(env, to, campName, resultUrl) {
  if (!env.RESEND_API_KEY) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Green Radius <noreply@greenradi.us>',
      reply_to: 'greenthemecamps@burningman.org',
      to: [to],
      subject: `Your Green Radius — ${campName}`,
      html: `<p>Thanks for playing the Green Radius Game!</p><p><a href="${resultUrl}">View &amp; share your Green Radius →</a></p><p style="color:#888;font-size:12px">Questions? Just reply to this email — it reaches the Green Theme Camp Community team.</p><p style="color:#888;font-size:12px">greenthemecampcommunity.org</p>`,
    }),
  });
  return r.ok;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 2:** Set the three secrets (needs `npx wrangler`; uses the values from Tasks 1–2):

```bash
npx wrangler secret put SHEETS_WEBAPP_URL
npx wrangler secret put SHEETS_SHARED_SECRET
npx wrangler secret put RESEND_API_KEY
```

- [ ] **Step 3:** Verify locally with `wrangler dev` + curl:

```bash
npx wrangler dev &      # serves assets + worker at http://localhost:8787
sleep 4
curl -sS -X POST http://localhost:8787/api/complete -H 'Content-Type: application/json' \
  -d '{"campName":"Test","leadName":"Ada","email":"you@your.camp","year":2026,"greens":{"food":4,"water":2,"waste":0,"transport":3,"shelter":1,"power":4},"source":"board","resultUrl":"https://greenradi.us/result/#x"}'
```
Expected: `{"sheet":"ok","email":"sent"}` (after secrets are set + domain verified), a new sheet row, and an email received. Before secrets: `{"sheet":"err","email":"err"}` is the expected degraded response.

- [ ] **Step 4:** Commit.

```bash
git add worker/index.js && git commit -m "Add Worker POST /api/complete: sheet append + Resend email"
```

---

### Task 7: Client — Start-screen consent notice, done-screen CTA + required email, real Share

**Files:**
- Modify: `index.html` (add `result-state.js` script tag before `green-radius.jsx`)
- Modify: `green-radius.jsx:10-11` (bump STORAGE_VERSION), `:1141-1158` (add submittedAt state), `:1177-1188` (persist submittedAt), `:1332-1362` (done block), `:1353` (New Camp resets submittedAt)

- [ ] **Step 1:** In `index.html`, add before the `green-radius.jsx` script tag:

```html
<script src="result-state.js"></script>
```

- [ ] **Step 2:** Bump the storage version (saved shape gains `submittedAt`). `green-radius.jsx:11`:

```javascript
const STORAGE_VERSION = 3;
```

- [ ] **Step 3:** Add `submittedAt` state near the other state (after `green-radius.jsx:1158`):

```javascript
const [submittedAt, setSubmittedAt] = useState(saved?.submittedAt || null);
```

- [ ] **Step 4:** Persist it — add `submittedAt` to the saved object in the persistence effect (`green-radius.jsx:1183-1186`):

```javascript
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        phase, camp, levelStates, sectorCursor, sectorClosed, formAnswers, submittedAt,
      }));
```
Add `submittedAt` to that effect's dependency array (`:1188`).

- [ ] **Step 5:** Replace the done block (`green-radius.jsx:1332-1362`) with the version below. It computes greens, builds the result URL, and adds the CTA (required email), the submit handler (guarded by `submittedAt`), and a real Share button. Match the existing button styling already used in this block (`palette.accent`, `boxShadow: 0 3px 0 ${palette.accentDark}`).

```jsx
  if (phase === 'done') {
    const greens = {};
    sectors.forEach(s => { greens[s.id] = levelStates[s.id].filter(x => x === 'green').length; });
    const year = new Date().getFullYear();
    const resultUrl = window.location.origin + '/result/#' +
      window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, greens });
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((doneEmail || '').trim());
    const canSubmit = emailOk && submitState === 'idle' && !submittedAt;

    async function handleSubmit() {
      setSubmitState('sending');
      try {
        const res = await fetch('/api/complete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campName: camp.campName, leadName: camp.leadName, email: doneEmail.trim(),
            year, greens, source: Object.keys(formAnswers).length ? 'form' : 'board',
            resultUrl,
          }),
        });
        const j = await res.json();
        if (j.sheet === 'ok' || j.email === 'sent') { setSubmittedAt(new Date().toISOString()); setSubmitState('done'); }
        else setSubmitState('error');
      } catch { setSubmitState('error'); }
    }

    async function handleShare() {
      try {
        if (navigator.share) await navigator.share({ title: 'Our Green Radius', url: resultUrl });
        else { await navigator.clipboard.writeText(resultUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      } catch {}
    }

    return (
      <div style={{ padding: '32px 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', fontWeight: 700, color: palette.accent, marginBottom: 8 }}>YOUR GREEN RADIUS</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px', color: palette.heading, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <RadiusLogomark sectors={sectors} levelStates={levelStates} size={32}/>{camp.campName}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ShareCard sectors={sectors} levelStates={levelStates} campName={camp.campName} leadName={camp.leadName} year={year} palette={palette}/>
        </div>

        {submittedAt || submitState === 'done' ? (
          <div style={{ marginBottom: 16, color: palette.text, fontSize: 14 }}>✓ Sent — check {doneEmail} for your Green Radius.</div>
        ) : (
          <div style={{ textAlign: 'left', marginBottom: 16 }}>
            <Field label="Email address (required)" value={doneEmail} onChange={setDoneEmail} placeholder="you@your.camp" palette={palette}/>
            {submitState === 'error' && <div style={{ color: '#b4463a', fontSize: 12, marginTop: 8 }}>Couldn't save just now — your share link below still works.</div>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {!(submittedAt || submitState === 'done') && (
            <button onClick={handleSubmit} disabled={!canSubmit}
              style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
                background: canSubmit ? palette.accent : `${palette.text}33`, color: '#fff', fontSize: 13, fontWeight: 800,
                letterSpacing: '0.12em', textTransform: 'uppercase', cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? `0 3px 0 ${palette.accentDark}` : 'none' }}>
              {submitState === 'sending' ? 'Sending…' : '✉ Email my Green Radius'}
            </button>
          )}
          <button onClick={handleShare}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: `1.5px solid ${palette.text}22`,
              background: 'transparent', color: palette.text, fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {copied ? 'Link copied!' : '🔗 Share link'}
          </button>
        </div>

        <button onClick={() => { setLevelStates(initState); setSectorCursor(() => { const o={}; sectors.forEach(s=>o[s.id]=0); return o; }); setSectorClosed(() => { const o={}; sectors.forEach(s=>o[s.id]=false); return o; }); setFormAnswers({}); setSubmittedAt(null); setSubmitState('idle'); setPhase('pick-mode'); }}
          style={{ marginTop: 16, background: 'none', border: 'none', color: `${palette.text}99`, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
          New Camp
        </button>
      </div>
    );
  }
```

- [ ] **Step 6:** Add the supporting state near the other `useState`s (after `:1158`), seeding the email from the intro:

```javascript
const [doneEmail, setDoneEmail] = useState(saved?.camp?.email || camp.email || '');
const [submitState, setSubmitState] = useState('idle'); // idle | sending | done | error
const [copied, setCopied] = useState(false);
```

- [ ] **Step 7:** Browser walk-through (board + form):

```bash
python3 -m http.server 8000   # game UI only; /api won't run here — use wrangler dev for the POST
```
Open `http://localhost:8000`. Verify: (a) the **Start** screen (both board and form) shows the implicit-consent line beneath the Start button; (b) board path → finish all sectors → done screen shows the email field (no checkbox); (c) form path → submit → done screen; (d) Email button stays disabled until a valid email is present; (e) "Share link" copies the URL and opening it renders `/result/`; (f) refresh on the done screen after a successful send shows the "✓ Sent" state (submittedAt persisted); (g) New Camp clears it. For the live POST, repeat under `npx wrangler dev` (localhost:8787).

- [ ] **Step 8:** Commit.

```bash
git add index.html green-radius.jsx && git commit -m "Done screen: required email capture + real share link; implicit consent disclosed on Start screen"
```

---

### Task 8: Decommission Vercel config

**Files:**
- Delete: `vercel.json`

- [ ] **Step 1:** Remove the inert Vercel config (app is fully Cloudflare now).

```bash
git rm vercel.json && git commit -m "Remove inert vercel.json (app is fully Cloudflare)"
```
(Separately, delete the Vercel project in the Vercel dashboard — owner-side, not a repo change. greenradi.us already serves from Cloudflare, so this is safe.)

---

### Task 9: End-to-end verify + ship

- [ ] **Step 1:** Push the branch.

```bash
git push -u origin result-capture-email
```

- [ ] **Step 2:** (Optional) preview test under `npx wrangler dev` once more: board finish → submit → confirm `{"sheet":"ok","email":"sent"}`, sheet row, received email, and the emailed `/result/` link renders.

- [ ] **Step 3:** Open ONE PR to wachen.

```bash
gh pr create --repo wachen/green-radius-game --base main --head result-capture-email \
  --title "Capture results + email a Green Radius result link" \
  --body "Implements docs/cert-email-design.md (Approach A). New Worker /api/complete (Apps Script append + Resend email), /result/ page, done-screen capture, drops vercel.json."
```

- [ ] **Step 4:** After merge, the push auto-deploys to greenradi.us. Run the `/deploy-verify` ritual (curl `--resolve` + `?cb=` + HSTS check). Confirm a real completion writes a row + sends the email + the link renders.

---

## Self-Review

- **Spec coverage:** Worker + /api/complete (T6) · Apps Script append-only (T1) · /result/ page reusing ShareCard (T4) · result-state encode/decode (T3) · required email + submit guard + real share + Start-screen implicit consent (T7) · wrangler + secrets (T5/T6) · vercel decommission (T8) · manual verification throughout · one-branch-one-PR (T0/T9). All spec sections map to a task.
- **Type/name consistency:** `ResultState.encode/decode/greensToLevelStates` used consistently across T3/T4/T7; payload field names (`campName, leadName, email, year, greens{6}, source, resultUrl`) match across client (T7), Worker (T6), and Apps Script (T1); `SHEETS_WEBAPP_URL / SHEETS_SHARED_SECRET / RESEND_API_KEY` consistent T6/T1/T2.
- **Gotchas honored:** STORAGE_VERSION bump (T7 Step 2); submittedAt dedupe survives refresh-on-done (T7); displayStates never sent; greens-as-contiguous-prefix assumption documented in T3.
