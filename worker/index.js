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

  if (body.website) return json({ sheet: 'skipped', email: 'skipped' }); // honeypot -> bot
  if (!body.campName || !body.email || body.consentContact !== true) return json({ error: 'missing_fields' }, 400);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(body.email)) return json({ error: 'bad_email' }, 400);

  const greens = {};
  for (const id of SECTOR_IDS) greens[id] = Math.max(0, Math.min(4, (body.greens && body.greens[id]) | 0));
  const row = {
    secret: env.SHEETS_SHARED_SECRET,
    campName: body.campName, leadName: body.leadName || '', email: body.email,
    year: body.year | 0, greens, source: body.source === 'form' ? 'form' : 'board',
    consentContact: true, resultUrl: body.resultUrl || '',
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
      from: 'Green Radius <results@greenradi.us>',
      to: [to],
      subject: `Your Green Radius — ${campName}`,
      html: `<p>Thanks for playing the Green Radius Game!</p><p><a href="${resultUrl}">View &amp; share your Green Radius →</a></p><p style="color:#888;font-size:12px">greenthemecampcommunity.org</p>`,
    }),
  });
  return r.ok;
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
