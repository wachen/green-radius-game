import ResultState from '../result-state.js';
import Rank from '../rank.js';

const SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];
// The six write-in note keys (one "Our Camp's Idea" per sector, game-data.js
// `X-camp` topics) — the only free-text answers entries accepted.
const NOTE_KEYS = new Set(['F-camp-note', 'H-camp-note', 'W-camp-note', 'T-camp-note', 'S-camp-note', 'P-camp-note']);
const ALLOWED_ORIGIN = 'https://greenradi.us';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/complete' && request.method === 'POST') return handleComplete(request, env);
    if (url.pathname === '/api/admin/responses' && request.method === 'GET') return handleAdminResponses(request, env);
    if (request.method === 'GET' && url.pathname === '/result/' && url.searchParams.has('r')) {
      return resultWithOg(request, env, url.searchParams.get('r'));
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleComplete(request, env) {
  const origin = request.headers.get('Origin') || '';
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
  // Fail closed: browsers always send Origin on a POST, so require it to match.
  // (An absent Origin used to slip through. This only deters casual scripted
  // abuse — the real rate-limit lives in a Cloudflare WAF rule, see docs.)
  if (origin !== ALLOWED_ORIGIN && !isLocalhost) return json({ error: 'forbidden' }, 403);

  const raw = await request.text();
  // 8 KB: 60 answers + six 160-char write-in notes + maxed name/email/url
  // fields still fit with headroom (worst case is ~4 KB).
  if (raw.length > 8192) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }
  if (!body || typeof body !== 'object') return json({ error: 'bad_json' }, 400);

  if (body.website) return json({ sheet: 'skipped', email: 'skipped' }); // honeypot -> bot
  if (!body.campName || !body.email) return json({ error: 'missing_fields' }, 400);
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
  const source = body.mode === 'form' ? 'form' : 'board';
  const schemaVersion = typeof body.schemaVersion === 'string' ? body.schemaVersion.slice(0, 32) : '';

  // Bound the free-text fields (prevents subject/row stuffing) and neutralize
  // spreadsheet formula injection before anything reaches the sheet or the email.
  const campName = clampField(body.campName, 80);
  const leadName = clampField(body.leadName, 80);
  const email = clampField(body.email, 254);

  const resultUrl = safeResultUrl(body.resultUrl);
  const row = {
    secret: env.SHEETS_SHARED_SECRET,
    campName: sheetCell(campName), leadName: sheetCell(leadName), email: sheetCell(email),
    year: Math.max(2000, Math.min(2100, body.year | 0)), greens, source,
    answers, schemaVersion,
    resultUrl,
  };

  const [sheetRes, emailRes] = await Promise.allSettled([
    appendToSheet(env, row),
    sendEmail(env, email, campName, resultUrl),
  ]);
  return json({
    sheet: sheetRes.status === 'fulfilled' && sheetRes.value ? 'ok' : 'err',
    email: emailRes.status === 'fulfilled' && emailRes.value ? 'sent' : 'err',
  });
}

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
  const desc = `A ${Rank.titleFor(total)} at ${total}/60. See the card and build your own at greenradi.us.`;
  return new HTMLRewriter()
    .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', desc); } })
    .transform(res);
}

async function appendToSheet(env, row) {
  if (!env.SHEETS_WEBAPP_URL) return false;
  const r = await fetch(env.SHEETS_WEBAPP_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
  if (!r.ok) return false;
  const j = await r.json().catch(() => ({}));
  return j.ok === true;
}

async function sendEmail(env, to, campName, resultUrl) {
  if (!env.RESEND_API_KEY || !resultUrl) return false;
  const href = escAttr(resultUrl);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Green Radius <hello@greenradi.us>',
      reply_to: 'greenthemecamps@burningman.org',
      to: [to],
      subject: `Your Green Radius — ${campName}`,
      html: `<p>Thanks for playing the Green Radius Game!</p><p><a href="${href}">View &amp; share your Green Radius →</a></p><p style="color:#888;font-size:12px">Questions? Just reply to this email — it reaches the Green Theme Camp Community team.</p><p style="color:#888;font-size:12px">greenthemecampcommunity.org</p>`,
    }),
  });
  return r.ok;
}

function safeResultUrl(raw) {
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

// Google Sheets treats a cell whose value starts with = + - @ (or a control char)
// as a formula, which would execute on view/recalc (e.g. =IMPORTXML exfiltrating
// the email column). Prefix a ' so submitted text always stays literal text.
function sheetCell(s) {
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

  if (!env.SHEETS_WEBAPP_URL) return json({ rows: [], count: 0, degraded: 'no_backend' });
  const u = `${env.SHEETS_WEBAPP_URL}?mode=responses&secret=${encodeURIComponent(env.SHEETS_SHARED_SECRET || '')}`;
  const r = await fetch(u, { redirect: 'follow' });
  if (!r.ok) return json({ error: 'sheet_unavailable' }, 502);
  const data = await r.json().catch(() => ({}));
  // A 200 with a non-array payload means the Apps Script returned an HTML error/
  // login page or {ok:false,...} (e.g. a rotated secret) — treat it as a failure
  // so the admin UI shows a retryable error instead of a misleading "No camps yet".
  if (!Array.isArray(data.rows)) return json({ error: 'sheet_bad_payload' }, 502);
  const rows = shapeAdminRows(data.rows);
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
