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
  const isLocalhost = /^http:\/\/localhost(:\d+)?$/.test(origin);
  if (origin && origin !== ALLOWED_ORIGIN && !isLocalhost) return json({ error: 'forbidden' }, 403);

  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'too_large' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400); }

  if (body.website) return json({ sheet: 'skipped', email: 'skipped' }); // honeypot -> bot
  if (!body.campName || !body.email) return json({ error: 'missing_fields' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return json({ error: 'bad_email' }, 400);

  const greens = {};
  for (const id of SECTOR_IDS) greens[id] = Math.max(0, Math.min(4, (body.greens && body.greens[id]) | 0));

  // Granular per-question answers (backend-only). Keep it bounded and clean:
  // string keys <= 40 chars, values strictly 'yes'/'no', at most 120 entries.
  const answers = {};
  if (body.answers && typeof body.answers === 'object') {
    let n = 0;
    for (const k of Object.keys(body.answers)) {
      if (n >= 120) break;
      const v = body.answers[k];
      if (typeof k === 'string' && k.length <= 40 && (v === 'yes' || v === 'no')) { answers[k] = v; n++; }
    }
  }
  const source = body.mode === 'form' ? 'form' : 'board';
  const schemaVersion = typeof body.schemaVersion === 'string' ? body.schemaVersion.slice(0, 32) : '';

  const resultUrl = safeResultUrl(body.resultUrl);
  const row = {
    secret: env.SHEETS_SHARED_SECRET,
    campName: body.campName, leadName: body.leadName || '', email: body.email,
    year: Math.max(2000, Math.min(2100, body.year | 0)), greens, source,
    answers, schemaVersion,
    resultUrl,
  };

  const [sheetRes, emailRes] = await Promise.allSettled([
    appendToSheet(env, row),
    sendEmail(env, body.email, body.campName, resultUrl),
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

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
