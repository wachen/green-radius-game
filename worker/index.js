import ResultState from '../result-state.js';
import GameData from '../game-data.js';
import AdminAggregate from '../admin/aggregate.js';

const SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];
const SECTOR_CODES = ['F', 'H', 'W', 'T', 'S', 'P'];
// Up to four write-in "Our Camp's Idea" slots per sector (base X-camp plus
// X-camp-2/3/4): each may carry one free-text note. These are the only
// free-text answers entries accepted.
const NOTE_KEYS = new Set(
  SECTOR_CODES.flatMap(c => ['', '-2', '-3', '-4'].map(s => `${c}-camp${s}-note`))
);
const ALLOWED_ORIGIN = 'https://greenradi.us';

// Funnel analytics: the only event names POST /api/event will record. Anything
// else is silently dropped so a stray/forged name can't stuff Workers Logs.
const ALLOWED_EVENTS = new Set(['game_started', 'mode_chosen', 'submit_attempted', 'submit_succeeded', 'submit_failed', 'result_resumed']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/complete' && request.method === 'POST') return handleComplete(request, env);
    if (url.pathname === '/api/event' && request.method === 'POST') return handleEvent(request);
    if (url.pathname === '/api/client-error' && request.method === 'POST') return handleClientError(request);
    if (url.pathname === '/api/admin/responses' && request.method === 'GET') return handleAdminResponses(request, env);
    if (url.pathname === '/api/city' && request.method === 'GET') return handleCity(env, ctx);
    // Liveness probe for the external uptime monitor (Cloudflare Free has no
    // Worker-error alerting): proves routing + Worker execution, touches no
    // secrets or upstreams. no-store so the monitor always hits the Worker.
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }
    if (request.method === 'GET' && url.pathname === '/result/' && url.searchParams.has('r')) {
      return resultWithOg(request, env, url.searchParams.get('r'));
    }
    return env.ASSETS.fetch(request);
  },
};

// Fail closed: browsers always send Origin on a POST, so require it to match.
// (An absent Origin used to slip through. This only deters casual scripted
// abuse — the real rate-limit lives in a Cloudflare WAF rule, see docs.)
export function originAllowed(origin) {
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin || '');
  return origin === ALLOWED_ORIGIN || isLocalhost;
}

async function handleComplete(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin)) return json({ error: 'forbidden' }, 403);

  const raw = await request.text();
  // 8 KB: 60 yes/no answers + up to 24 160-char write-in notes (four per
  // sector) + maxed name/email/url fields still fit with headroom (realistic
  // worst case is ~6 KB).
  if (raw.length > 8192) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400);

  if (body.website) return json({ sheet: 'skipped', email: 'skipped' }); // honeypot -> bot
  if (!body.campName || !body.leadName || !body.email) return json({ error: 'missing_fields' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return json({ error: 'bad_email' }, 400);

  const greens = {};
  for (const id of SECTOR_IDS) greens[id] = Math.max(0, Math.min(10, (body.greens && body.greens[id]) | 0));

  // Granular per-question answers (backend-only). Keep it bounded and clean:
  // string keys <= 40 chars; values strictly 'yes'/'no' (at most 120 entries),
  // except the whitelisted NOTE_KEYS, the write-in "Our Camp's Idea" text:
  // free text, trimmed + clamped to 160 chars + formula-guarded.
  const answers = {};
  if (body.answers && typeof body.answers === 'object') {
    let n = 0;
    for (const k of Object.keys(body.answers)) {
      if (typeof k !== 'string' || k.length > 40) continue;
      const v = body.answers[k];
      if (v === 'yes' || v === 'no') {
        if (n < 120) { answers[k] = v; n++; }
      } else if (NOTE_KEYS.has(k) && typeof v === 'string' && v.trim()) {
        answers[k] = sheetCell(clampField(v.trim(), 160));
      }
    }
    // A note only means something alongside its topic's Yes/No — drop orphans
    // (also keeps forged note-only rows out of the sheet/admin).
    for (const k of Object.keys(answers)) {
      if (k.endsWith('-note') && answers[k.slice(0, -5)] !== 'yes' && answers[k.slice(0, -5)] !== 'no') delete answers[k];
    }
  }
  // Stable per-camp id (client-generated crypto.randomUUID). It rides INSIDE the
  // answers JSON blob (no new sheet column) so the read side can dedup repeat
  // submissions latest-wins. Bounded to safe UUID chars; anything else is dropped.
  if (typeof body.campId === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(body.campId)) {
    answers.campId = body.campId;
  }
  // R4 double-submit guard: a client-minted nonce that stays stable across a
  // reload mid-POST. It rides top-level to the Apps Script (which can dedupe
  // repeat appends on it; an older script just ignores the extra field) and
  // doubles as the Resend Idempotency-Key so a replayed POST can't send the
  // same email twice. Same bounded charset as campId.
  const nonce = (typeof body.nonce === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(body.nonce)) ? body.nonce : '';
  const source = body.mode === 'form' ? 'form' : 'board';
  const schemaVersion = typeof body.schemaVersion === 'string' ? body.schemaVersion.slice(0, 32) : '';

  // Bound the free-text fields (prevents subject/row stuffing) and neutralize
  // spreadsheet formula injection before anything reaches the sheet or the email.
  const campName = clampField(body.campName, 80);
  const leadName = clampField(body.leadName, 80);
  const email = clampField(body.email, 254);
  const campLocation = clampField(body.campLocation, 80);
  const campSize = campSizeCell(body.campSize);

  const resultUrl = safeResultUrl(body.resultUrl);
  const row = {
    secret: env.SHEETS_SHARED_SECRET,
    campName: sheetCell(campName), leadName: sheetCell(leadName), email: sheetCell(email),
    campLocation: sheetCell(campLocation), campSize,
    year: Math.max(2000, Math.min(2100, body.year | 0)), greens, source,
    answers, schemaVersion,
    resultUrl,
  };
  if (nonce) row.nonce = nonce;

  const [sheetRes, emailRes] = await Promise.allSettled([
    appendToSheet(env, row),
    sendEmail(env, email, campName, resultUrl, answers, greens, nonce),
  ]);
  if (sheetRes.status === 'rejected') console.error('sheet_append_failed', { outcome: 'exception' });
  if (emailRes.status === 'rejected') console.error('email_send_failed', { outcome: 'exception' });
  return json({
    sheet: sheetRes.status === 'fulfilled' && sheetRes.value ? 'ok' : 'err',
    email: emailRes.status === 'fulfilled' && emailRes.value ? 'sent' : 'err',
  });
}

// Funnel telemetry sink. Fire-and-forget from the client via sendBeacon: same
// fail-closed Origin check as /api/complete, a tight body cap, an event-name
// allowlist, and coarse non-PII props only (mode, sector count) — never emails,
// camp names, or free text. Writes one structured line to Workers Logs and 204s.
// Every non-forbidden outcome returns 204 so a beacon never surfaces an error.
function handleEvent(request) {
  const origin = request.headers.get('Origin') || '';
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (origin !== ALLOWED_ORIGIN && !isLocalhost) return new Response(null, { status: 403 });

  return request.text().then((raw) => {
    if (raw.length > 1024) return new Response(null, { status: 204 });
    let body;
    try { body = JSON.parse(raw); } catch { return new Response(null, { status: 204 }); }
    if (!body || typeof body !== 'object' || !ALLOWED_EVENTS.has(body.event)) return new Response(null, { status: 204 });

    const evt = { type: 'funnel_event', event: body.event };
    if (body.mode === 'board' || body.mode === 'form') evt.mode = body.mode;
    if (Number.isFinite(body.sectors)) evt.sectors = Math.max(0, Math.min(6, body.sectors | 0));
    console.log(JSON.stringify(evt));
    return new Response(null, { status: 204 });
  });
}

// Client-side error beacon (log-only, nothing stored): /beacon.js installs
// window.onerror + unhandledrejection handlers and POSTs here so a silent
// white screen on an odd playa phone shows up in Workers Logs. Same
// fail-closed Origin check as /api/complete/handleEvent, a tight body cap,
// and every field re-truncated server-side so a forged/oversize beacon can't
// stuff the logs. No storage, no upstream calls. Must never throw or hang —
// every non-forbidden outcome resolves fast with 204.
export function handleClientError(request) {
  const origin = request.headers.get('Origin') || '';
  if (!originAllowed(origin)) return Promise.resolve(new Response(null, { status: 403 }));

  return request.text().then((raw) => {
    if (raw.length > 4096) return new Response(null, { status: 204 });
    let body;
    try { body = JSON.parse(raw); } catch { return new Response(null, { status: 204 }); }
    if (!body || typeof body !== 'object') return new Response(null, { status: 204 });

    const evt = {
      type: 'client_error',
      message: clampField(body.message, 500),
      source: clampField(body.source, 300),
      line: Number.isFinite(body.line) ? Math.max(0, body.line | 0) : 0,
      col: Number.isFinite(body.col) ? Math.max(0, body.col | 0) : 0,
      path: clampField(body.path, 200),
    };
    if (typeof body.version === 'string' && body.version) evt.version = clampField(body.version, 32);
    console.log(JSON.stringify(evt));
    return new Response(null, { status: 204 });
  }).catch(() => new Response(null, { status: 204 }));
}

// Per-camp OG: decode the ?r= hash, rewrite /result/'s og:title/description to the
// camp's name + score. Image stays the static og-card.png. Fail-open: any problem
// serves the unmodified static page (generic unfurl is fine; a broken page is not).
async function resultWithOg(request, env, r) {
  const res = await env.ASSETS.fetch(request);
  let data;
  try { data = ResultState.decode(r); } catch { data = null; }
  if (!data) { console.log('og_rewrite_skipped', { outcome: 'decode_failed' }); return res; }
  const total = ResultState.SECTOR_IDS.reduce((n, id) => n + ((data.fills[id] && data.fills[id].totalYes) | 0), 0);
  const camp = String(data.campName || '').slice(0, 80).trim();
  const title = camp ? `${camp}'s Green Radius` : 'Our Green Radius';
  const desc = `${total}/60 achieved. See the card and build your own at greenradi.us.`;
  return new HTMLRewriter()
    .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', desc); } })
    .transform(res);
}

// Upstream calls are bounded so a hung Apps Script / Resend can't hold the
// player's request open to the platform ceiling; on abort the fetch rejects
// and the existing allSettled → 'err' degrade path fires. Observed max wall
// time is ~4s, so 8s is generous.
const UPSTREAM_TIMEOUT_MS = 8000;

async function appendToSheet(env, row) {
  if (!env.SHEETS_WEBAPP_URL) return false;
  const r = await fetch(env.SHEETS_WEBAPP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row), signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  if (!r.ok) { console.error('sheet_append_failed', { outcome: 'http_error', status: r.status }); return false; }
  const j = await r.json().catch(() => ({}));
  if (j.ok !== true) { console.error('sheet_append_failed', { outcome: 'bad_payload' }); return false; }
  return true;
}

export async function sendEmail(env, to, campName, resultUrl, answers, greens, nonce) {
  if (!env.RESEND_API_KEY || !resultUrl) return false;
  const href = escAttr(resultUrl);
  // The nonce doubles as a Resend idempotency key: a reload-replayed POST
  // reuses the nonce so Resend drops the duplicate send. An explicit resend
  // (edit & resend) mints a fresh nonce client-side, so it still goes out.
  const headers = { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' };
  if (nonce) headers['Idempotency-Key'] = 'grg/' + nonce;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers,
    body: JSON.stringify({
      from: 'Green Radius <hello@greenradi.us>',
      reply_to: 'greenthemecamps@burningman.org',
      to: [to],
      subject: `Your Green Radius: ${campName}`,
      html: `<p>Thanks for playing the Green Radius Game!</p>${headlineEmailHtml(greens)}<p><a href="${href}">View &amp; share your Green Radius →</a></p>${greenUpEmailHtml(answers)}<p style="color:#888;font-size:12px">Questions? Just reply to this email. It reaches the Green Theme Camp Community team.</p><p style="color:#888;font-size:12px">greenthemecampcommunity.org</p>`,
      text: buildEmailText(resultUrl, answers, greens),
    }),
  });
  if (!r.ok) { console.error('email_send_failed', { outcome: 'http_error', status: r.status }); return false; }
  return true;
}

// Total Yes across all sectors, shared by the HTML and plain-text headlines.
function sectorTotal(greens) {
  return GameData.SECTORS.reduce((n, s) => n + ((greens && greens[s.id]) | 0), 0);
}

// The email's headline: the result itself. Sector names/order come from
// game-data (the same source the sheet and UI use); inline CSS only so it
// renders in every client. Dark green (#3d7a31) stays readable on white.
// No playa-rank title here by decision: the score speaks for itself.
export function headlineEmailHtml(greens) {
  const total = sectorTotal(greens);
  const rows = GameData.SECTORS.map(s =>
    `<tr><td style="padding:2px 14px 2px 0;color:#555">${escAttr(s.name)}</td>` +
    `<td style="padding:2px 0;font-weight:bold;color:#3d7a31;font-variant-numeric:tabular-nums">${(greens && greens[s.id]) | 0}/10</td></tr>`
  ).join('');
  return `<p style="margin:18px 0 6px;font-size:15px"><strong>${total}</strong>/60 achieved</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:0 0 4px">${rows}</table>`;
}

// Plain-text counterpart to headlineEmailHtml: same total + per-sector lines, no markup.
export function headlineEmailText(greens) {
  const total = sectorTotal(greens);
  const lines = GameData.SECTORS.map(s => `${s.name}: ${(greens && greens[s.id]) | 0}/10`);
  return `${total}/60 achieved\n\n${lines.join('\n')}`;
}

// Plain-text alternative for the whole result email, same substance/order/tone
// as the html built in sendEmail: intro, headline + per-sector breakdown, the
// result link, the Green-Up Plan (if any), then the footer.
export function buildEmailText(resultUrl, answers, greens) {
  const plan = greenUpEmailText(answers);
  return [
    'Thanks for playing the Green Radius Game!',
    headlineEmailText(greens),
    `View & share your Green Radius: ${resultUrl}`,
    plan,
    'Questions? Just reply to this email. It reaches the Green Theme Camp Community team.\ngreenthemecampcommunity.org',
  ].filter(Boolean).join('\n\n');
}

// Derives the Green-Up Plan's sector groups from the sanitized answers map,
// mirroring greenUpSteps in green-radius.jsx: every "No" answer becomes a
// next-year step, grouped by sector; a written-in "Our Camp's Idea" answered
// No shows the camp's own words. Shared by both the HTML and plain-text email
// renderers below so the derivation logic lives in exactly one place. Built
// server-side from the sanitized answers map (never from client prose) so the
// only client-authored text an email can carry is the six bounded,
// HTML-escaped write-in notes. Empty plan (all Yes) → [].
function greenUpGroups(answers) {
  if (!answers) return [];
  const groups = [];
  for (const s of GameData.SECTORS) {
    const steps = [];
    (s.levels || []).forEach((qs, li) => {
      (qs || []).forEach(q => { if (answers[q.id] === 'no') steps.push({ level: li + 1, title: q.title, url: q.link && q.link.url }); });
    });
    (s.tier4Topics || []).forEach(t => {
      if (answers[t.id] !== 'no') return;
      const rawNote = answers[t.id + '-note'];
      // Display copy of the note: drop the sheetCell formula-guard apostrophe.
      const note = typeof rawNote === 'string' ? rawNote.replace(/^'(?=[=+\-@\t\r])/, '').trim() : '';
      steps.push({ level: 4, title: note ? `${t.title}: ${note}` : t.title, url: t.link && t.link.url });
    });
    if (steps.length) groups.push({ name: s.name, steps });
  }
  return groups;
}

function greenUpEmailHtml(answers) {
  const groups = greenUpGroups(answers);
  if (!groups.length) return '';
  const count = groups.reduce((n, g) => n + g.steps.length, 0);
  return `<p style="margin:22px 0 2px"><strong>🌱 Your Green-Up Plan</strong> · ${count} ${count === 1 ? 'idea' : 'ideas'} to grow your radius next year</p>` +
    groups.map(g =>
      `<p style="margin:12px 0 2px;font-size:12px;letter-spacing:0.08em;color:#558040"><strong>${escAttr(g.name.toUpperCase())}</strong></p>` +
      `<p style="margin:0;line-height:1.7">` +
      g.steps.map(st =>
        `<span style="color:#888">L${st.level} · </span>` +
        (st.url ? `<a href="${escAttr(st.url)}" style="color:#558040">${escAttr(st.title)}</a>` : escAttr(st.title))
      ).join('<br>') +
      `</p>`
    ).join('');
}

// Plain-text counterpart to greenUpEmailHtml, same groups/steps, no markup.
export function greenUpEmailText(answers) {
  const groups = greenUpGroups(answers);
  if (!groups.length) return '';
  const count = groups.reduce((n, g) => n + g.steps.length, 0);
  const header = `Your Green-Up Plan · ${count} ${count === 1 ? 'idea' : 'ideas'} to grow your radius next year`;
  const body = groups.map(g =>
    `${g.name.toUpperCase()}\n` +
    g.steps.map(st => `L${st.level} · ${st.title}${st.url ? ` (${st.url})` : ''}`).join('\n')
  ).join('\n\n');
  return `${header}\n\n${body}`;
}

export function safeResultUrl(raw) {
  try {
    const u = new URL(raw || '');
    const okHost = u.hostname === 'greenradi.us' || u.hostname === 'localhost';
    const okProto = u.protocol === 'https:' || u.protocol === 'http:';
    if (okProto && okHost && u.pathname === '/result/') return u.toString();
  } catch {}
  return '';
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#x27;');
}

function clampField(s, n) {
  return String(s == null ? '' : s).slice(0, n);
}

// Camp size (headcount): blank when absent/invalid, else a non-negative integer
// string capped at 99999 (a generous sheet-side ceiling — the intake form itself
// caps at 2000, this just tolerates any pre-cap/legacy value reaching the Worker).
function campSizeCell(v) {
  if (v === undefined || v === null || v === '') return '';
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? String(Math.max(0, Math.min(99999, n))) : '';
}

// Google Sheets treats a cell whose value starts with = + - @ (or a control char)
// as a formula, which would execute on view/recalc (e.g. =IMPORTXML exfiltrating
// the email column). Prefix a ' so submitted text always stays literal text.
export function sheetCell(s) {
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

// ── Admin read path: validate the Cloudflare Access JWT, then proxy the Apps Script doGet ──
async function handleAdminResponses(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  const ok = await verifyAccessJwt(token, env);
  if (!ok) return json({ error: 'unauthorized' }, 403);

  const read = await fetchSheetRows(env);
  if (read.reason === 'no_backend') return json({ rows: [], count: 0, degraded: 'no_backend' });
  if (!read.rows) return json({ error: read.reason }, 502);
  const rows = shapeAdminRows(read.rows);
  return new Response(JSON.stringify({ rows, count: rows.length }), {
    status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// `hidden` reflects the owner-typed "Hidden" sheet column (junk/test rows) —
// any truthy cell value flags the row. The doGet proxy omits the key entirely
// until the owner adds the column (see docs/admin-setup.md), so `r.hidden` is
// `undefined` there and this defaults to `false`: a no-op until deployed.
export function shapeAdminRows(raw) {
  return raw.slice(0, 2000).map(r => {
    let answers = {};
    try { answers = r.answers_json ? JSON.parse(r.answers_json) : (r.answers || {}); } catch { answers = {}; }
    return {
      timestamp: Date.parse(r.timestamp) || 0,
      campName: String(r.campName || ''), leadName: String(r.leadName || ''), email: String(r.email || ''),
      campLocation: String(r.campLocation || ''), campSize: String(r.campSize || ''),
      year: r.year | 0, greens: r.greens || {}, total: r.total | 0,
      source: r.source === 'form' ? 'form' : 'board', resultUrl: String(r.resultUrl || ''),
      answers, schemaVersion: String(r.schema_version || r.schemaVersion || ''),
      hidden: !!(r.hidden && String(r.hidden).trim()),
      // Owner-typed "Visit" sheet column (visit planning) — raw text; the
      // admin UI derives needs-visit/assigned/done from it. Admin route only,
      // never /api/city.
      visit: String(r.visit || ''),
    };
  });
}

// Shared read path for the admin viewer and the public city tally: proxy the
// Apps Script doGet and hand back the raw rows. Never throws — every failure
// mode collapses to { rows: null, reason } so both callers can degrade.
async function fetchSheetRows(env) {
  if (!env.SHEETS_WEBAPP_URL) return { rows: null, reason: 'no_backend' };
  const u = `${env.SHEETS_WEBAPP_URL}?mode=responses&secret=${encodeURIComponent(env.SHEETS_SHARED_SECRET || '')}`;
  const r = await fetch(u, { redirect: 'follow', signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }).catch(() => null);
  if (!r || !r.ok) return { rows: null, reason: 'sheet_unavailable' };
  const data = await r.json().catch(() => ({}));
  // A 200 with a non-array payload means the Apps Script returned an HTML error/
  // login page or {ok:false,...} (e.g. a rotated secret) — treat it as a failure
  // so callers show a retryable error instead of a misleading "No camps yet".
  if (!Array.isArray(data.rows)) return { rows: null, reason: 'sheet_bad_payload' };
  return { rows: data.rows, reason: null };
}

// ── Public city tally: aggregate-only, colo-cached ───────────────────────────
// GET /api/city is the one public read path. Two hard rules:
//  1. PRIVACY IS STRUCTURAL. The response is rebuilt field-by-field below —
//     never spread the aggregate (computeAggregates includes a leaderboard
//     with camp names/result URLs, and future fields must stay private by
//     default). Nothing identifying a camp may appear here. Rows the owner
//     flagged junk/test (the sheet's "Hidden" column) are filtered out of
//     every tally by computeAggregates itself (admin/aggregate.js), so this
//     response never reflects them; the flag itself never appears here either.
//  2. THE SHEET IS PROTECTED BY THE CACHE. Fresh responses are stored in the
//     colo cache for a day but treated as fresh for only 5 minutes (checked
//     in code via generatedAt — the Cache API can't serve entries past their
//     max-age, so freshness lives in the body). Result: at most ~1 sheet hit
//     per colo per 5 minutes, and an Apps Script outage serves the stale
//     entry (marked stale:true, client shows "as of <time>") instead of 503.
const CITY_FRESH_MS = 5 * 60 * 1000;
const CITY_CACHE_KEY = 'https://greenradi.us/api/city';

async function handleCity(env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(CITY_CACHE_KEY);
  const hit = await cache.match(cacheKey).catch(() => null);
  const cached = hit ? await hit.json().catch(() => null) : null;
  if (cached && Date.now() - cached.generatedAt < CITY_FRESH_MS) return cityJson(cached);

  const fresh = await computeCityBody(env);
  if (fresh) {
    ctx.waitUntil(cache.put(cacheKey, new Response(JSON.stringify(fresh), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    })));
    return cityJson(fresh);
  }
  if (cached) return cityJson({ ...cached, stale: true });
  return json({ error: 'unavailable' }, 503);
}

function cityJson(body) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
  });
}

// The allowlist. Aggregate numbers only; see the privacy rule above.
export async function computeCityBody(env) {
  const read = await fetchSheetRows(env);
  if (!read.rows) return null;
  let agg;
  try {
    let rows = shapeAdminRows(read.rows);
    // Scope the public tally to the current season only. Once a season rolls
    // over, camps resubmit fresh rows for the new year while last year's rows
    // are still sitting in the sheet — without this, a handful of early 2027
    // submissions would get averaged in with hundreds of 2026 rows and the
    // city tally would read as a near-empty city instead of a fresh season.
    // "Current season" = the max numeric year among real, visible rows;
    // hidden/legacy rows are excluded from that determination (same as they're
    // excluded from the tally itself) since they carry no useful year signal.
    const eligible = rows.filter(r => !AdminAggregate.isHidden(r) && !AdminAggregate.isLegacy(r));
    const maxYear = eligible.reduce((m, r) => Math.max(m, r.year | 0), 0);
    if (maxYear) rows = rows.filter(r => (r.year | 0) === maxYear);
    agg = AdminAggregate.computeAggregates(rows, GameData.SECTORS, Date.now());
  } catch { return null; }
  return {
    generatedAt: Date.now(),
    count: agg.count | 0,
    totalYes: agg.totalYes | 0,
    totalPossible: agg.totalPossible | 0,
    tallyPct: +agg.tallyPct || 0,
    hasAnswers: !!agg.hasAnswers,
    thisWeek: (agg.momentum && agg.momentum.thisWeek) | 0,
    sectorAverages: agg.sectorStandings.map(s => ({ id: String(s.id), avg: +s.avg || 0 })),
    intensities: agg.intensities ? Object.fromEntries(SECTOR_IDS.map(id => [id, {
      levels: ((agg.intensities[id] && agg.intensities[id].levels) || []).map(l => l.map(v => +v || 0)),
    }])) : null,
  };
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out;
}

// Access signing keys rotate rarely; cache the JWKS at module scope so each
// admin request doesn't pay a fresh certs round-trip. A kid miss (rotation)
// forces one refetch before failing.
let jwksCache = { keys: null, at: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchAccessJwks(teamDomain, force) {
  if (!force && jwksCache.keys && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  const certs = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }).then(r => r.json());
  jwksCache = { keys: certs.keys || [], at: Date.now() };
  return jwksCache.keys;
}

export async function verifyAccessJwt(token, env) {
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
    let keys = await fetchAccessJwks(env.CF_ACCESS_TEAM_DOMAIN, false);
    let jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) { keys = await fetchAccessJwks(env.CF_ACCESS_TEAM_DOMAIN, true); jwk = keys.find(k => k.kid === header.kid); }
    if (!jwk) return false;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const data = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), data);
  } catch { return false; }
}
