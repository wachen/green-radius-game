import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import worker, { sheetCell, safeResultUrl, originAllowed, verifyAccessJwt, accessJwtEmail, headlineEmailHtml, headlineEmailText, greenUpEmailText, buildEmailText, sendEmail, handleClientError, shapeAdminRows, computeCityBody } from '../worker/index.js';
import GameData from '../game-data.js';

function b64url(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Swap globalThis.fetch for a stub while body() runs, restoring it after.
async function withMockFetch(stub, body) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stub;
  try { return await body(); } finally { globalThis.fetch = originalFetch; }
}

describe('sheetCell', () => {
  test('formula-leading strings get a guarding leading quote', () => {
    expect(sheetCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(sheetCell('+x')).toBe("'+x");
    expect(sheetCell('-x')).toBe("'-x");
    expect(sheetCell('@x')).toBe("'@x");
    expect(sheetCell('\tx')).toBe("'\tx");
    expect(sheetCell('\rx')).toBe("'\rx");
  });

  test('normal strings pass through unchanged', () => {
    expect(sheetCell('Dusty Camp')).toBe('Dusty Camp');
  });
});

describe('safeResultUrl', () => {
  test('allows the prod host at the /result/ path', () => {
    expect(safeResultUrl('https://greenradi.us/result/')).toBe('https://greenradi.us/result/');
  });

  test('allows localhost', () => {
    expect(safeResultUrl('http://localhost:8000/result/')).toBe('http://localhost:8000/result/');
  });

  test('rejects other hosts', () => {
    expect(safeResultUrl('https://evil.com/result/')).toBe('');
  });

  test('rejects the wrong path on an allowed host', () => {
    expect(safeResultUrl('https://greenradi.us/admin/')).toBe('');
  });

  test('rejects non-http(s) protocols and garbage', () => {
    expect(safeResultUrl('javascript:alert(1)')).toBe('');
    expect(safeResultUrl('not a url')).toBe('');
  });
});

describe('originAllowed', () => {
  test('allows the prod origin', () => {
    expect(originAllowed('https://greenradi.us')).toBe(true);
  });

  test('allows localhost with or without a port', () => {
    expect(originAllowed('http://localhost')).toBe(true);
    expect(originAllowed('http://localhost:8000')).toBe(true);
  });

  test('rejects other origins', () => {
    expect(originAllowed('https://evil.com')).toBe(false);
  });

  test('fails closed on an absent origin', () => {
    expect(originAllowed('')).toBe(false);
  });
});

describe('verifyAccessJwt', () => {
  let privateKey;
  let jwk;
  const AUD = 'test-aud';
  const TEAM_DOMAIN = 'example.cloudflareaccess.com';
  const originalFetch = globalThis.fetch;

  beforeAll(async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    );
    privateKey = keyPair.privateKey;
    jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    jwk.kid = 'test-kid';
    jwk.alg = 'RS256';

    globalThis.fetch = async (url) => {
      if (String(url).includes('/cdn-cgi/access/certs')) {
        return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    };
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  async function makeToken({ aud = AUD, exp = Math.floor(Date.now() / 1000) + 3600, kid = 'test-kid', tamper = false } = {}) {
    const header = { alg: 'RS256', kid };
    const payload = { aud, exp };
    const headerB64 = b64url(JSON.stringify(header));
    const payloadB64 = b64url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput));
    let sigB64 = b64url(sigBuf);
    if (tamper) {
      // Flip a character to invalidate the signature.
      const idx = 0;
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const replacement = chars[(chars.indexOf(sigB64[idx]) + 1) % chars.length] || 'A';
      sigB64 = replacement + sigB64.slice(1);
    }
    return `${signingInput}.${sigB64}`;
  }

  const env = { CF_ACCESS_AUD: AUD, CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN };

  test('valid token verifies', async () => {
    const token = await makeToken();
    expect(await verifyAccessJwt(token, env)).toBe(true);
  });

  test('expired token fails', async () => {
    const token = await makeToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(await verifyAccessJwt(token, env)).toBe(false);
  });

  test('wrong audience fails', async () => {
    const token = await makeToken({ aud: 'someone-else' });
    expect(await verifyAccessJwt(token, env)).toBe(false);
  });

  test('tampered signature fails', async () => {
    const token = await makeToken({ tamper: true });
    expect(await verifyAccessJwt(token, env)).toBe(false);
  });

  test('missing or empty token fails', async () => {
    expect(await verifyAccessJwt(null, env)).toBe(false);
    expect(await verifyAccessJwt('', env)).toBe(false);
  });

  test('token with only 2 parts fails', async () => {
    const token = await makeToken();
    const twoParts = token.split('.').slice(0, 2).join('.');
    expect(await verifyAccessJwt(twoParts, env)).toBe(false);
  });
});

describe('shapeAdminRows hidden flag', () => {
  test('a truthy Hidden sheet cell shapes to hidden:true', () => {
    const rows = shapeAdminRows([{ campName: 'Junk', hidden: 'x' }]);
    expect(rows[0].hidden).toBe(true);
  });

  test('a blank Hidden sheet cell shapes to hidden:false', () => {
    const rows = shapeAdminRows([{ campName: 'Real', hidden: '' }]);
    expect(rows[0].hidden).toBe(false);
  });

  test('an absent Hidden column (doGet not yet updated) shapes to hidden:false — no-op', () => {
    const rows = shapeAdminRows([{ campName: 'Real' }]);
    expect(rows[0].hidden).toBe(false);
  });
});

describe('headlineEmailHtml', () => {
  const greens = { food: 7, water: 4, waste: 10, transport: 2, shelter: 5, power: 6 };
  test('states the total and all six sector scores, no rank title', () => {
    const html = headlineEmailHtml(greens);
    expect(html).toContain('<strong>34</strong>/60 achieved');
    expect(html).not.toContain('Wide Beacon');
    for (const s of GameData.SECTORS) {
      expect(html).toContain(s.name);
    }
    expect(html).toContain('7/10');
    expect(html).toContain('10/10');
  });
  test('missing greens degrade to 0 without throwing', () => {
    const html = headlineEmailHtml(undefined);
    expect(html).toContain('<strong>0</strong>/60');
  });
});

describe('headlineEmailText', () => {
  const greens = { food: 7, water: 4, waste: 10, transport: 2, shelter: 5, power: 6 };
  test('states the total and all six sector scores as plain text, no tags', () => {
    const text = headlineEmailText(greens);
    expect(text).toContain('34/60 achieved');
    for (const s of GameData.SECTORS) {
      expect(text).toContain(s.name);
    }
    expect(text).toContain('Food: 7/10');
    expect(text).toContain('Waste: 10/10');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });
  test('missing greens degrade to 0 without throwing', () => {
    expect(headlineEmailText(undefined)).toContain('0/60 achieved');
  });
});

describe('greenUpEmailText', () => {
  test('empty answers produce an empty plan', () => {
    expect(greenUpEmailText({})).toBe('');
    expect(greenUpEmailText(null)).toBe('');
  });

  test('a level "no" answer becomes a step, no HTML tags leak', () => {
    const text = greenUpEmailText({ F1: 'no' });
    expect(text).toContain('1 idea to grow your radius next year');
    expect(text).toContain('FOOD');
    expect(text).toContain('L1 · Meal Plan');
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  test('a write-in note answered "no" includes the camp\'s own words', () => {
    const text = greenUpEmailText({ 'F-camp': 'no', 'F-camp-note': "Solar oven" });
    expect(text).toContain("Our Camp's Idea: Solar oven");
  });
});

describe('buildEmailText', () => {
  test('mirrors the html: intro, headline, link, plan, footer in order, no markup', () => {
    const text = buildEmailText('https://greenradi.us/result/?r=x', { F1: 'no' },
      { food: 3, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 });
    const iIntro = text.indexOf('Thanks for playing');
    const iHead = text.indexOf('/60 achieved');
    const iLink = text.indexOf('https://greenradi.us/result/?r=x');
    const iPlan = text.indexOf('Green-Up Plan');
    const iFooter = text.indexOf('Questions? Just reply');
    expect(iIntro).toBeGreaterThanOrEqual(0);
    expect(iHead).toBeGreaterThan(iIntro);
    expect(iLink).toBeGreaterThan(iHead);
    expect(iPlan).toBeGreaterThan(iLink);
    expect(iFooter).toBeGreaterThan(iPlan);
    expect(text).not.toContain('<');
    expect(text).not.toContain('>');
  });

  test('an all-Yes result omits the plan section entirely', () => {
    const text = buildEmailText('https://greenradi.us/result/?r=x', {},
      { food: 10, water: 10, waste: 10, transport: 10, shelter: 10, power: 10 });
    expect(text).not.toContain('Green-Up Plan');
  });
});

describe('sendEmail body order', () => {
  test('intro, headline, link, plan, footer appear in order', async () => {
    let sent;
    await withMockFetch(async (url, opts) => { sent = JSON.parse(opts.body); return new Response('{}', { status: 200 }); },
      () => sendEmail({ RESEND_API_KEY: 'k' }, 'a@b.co', 'Dusty', 'https://greenradi.us/result/?r=x',
        {}, { food: 1, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 }));
    const html = sent.html;
    const iIntro = html.indexOf('Thanks for playing');
    const iHead = html.indexOf('/60 achieved');
    const iLink = html.indexOf('View &amp; share');
    const iFooter = html.indexOf('Questions? Just reply');
    expect(iIntro).toBeGreaterThanOrEqual(0);
    expect(iHead).toBeGreaterThan(iIntro);
    expect(iLink).toBeGreaterThan(iHead);
    expect(iFooter).toBeGreaterThan(iLink);
  });

  test('a plain-text alternative rides alongside the html, with the same result link', async () => {
    let sent;
    await withMockFetch(async (url, opts) => { sent = JSON.parse(opts.body); return new Response('{}', { status: 200 }); },
      () => sendEmail({ RESEND_API_KEY: 'k' }, 'a@b.co', 'Dusty', 'https://greenradi.us/result/?r=x',
        {}, { food: 1, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 }));
    expect(sent.text).toBeTruthy();
    expect(typeof sent.text).toBe('string');
    expect(sent.text).toContain('https://greenradi.us/result/?r=x');
    expect(sent.text).not.toContain('<');
    expect(sent.text).not.toContain('>');
  });
});

describe('sendEmail idempotency (R4 nonce)', () => {
  const send = async (nonce) => {
    let headers;
    await withMockFetch(async (url, opts) => { headers = opts.headers; return new Response('{}', { status: 200 }); },
      () => sendEmail({ RESEND_API_KEY: 'k' }, 'a@b.co', 'Dusty', 'https://greenradi.us/result/?r=x',
        {}, { food: 0, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 }, nonce));
    return headers;
  };
  test('nonce rides as the Resend Idempotency-Key', async () => {
    const headers = await send('1f2e3d4c-aaaa-bbbb-cccc-1234567890ab');
    expect(headers['Idempotency-Key']).toBe('grg/1f2e3d4c-aaaa-bbbb-cccc-1234567890ab');
  });
  test('no nonce, no Idempotency-Key header', async () => {
    const headers = await send('');
    expect('Idempotency-Key' in headers).toBe(false);
  });
});

describe('handleClientError', () => {
  function req({ origin = 'https://greenradi.us', body = '{}' } = {}) {
    return new Request('https://greenradi.us/api/client-error', {
      method: 'POST',
      headers: origin ? { Origin: origin } : {},
      body,
    });
  }

  test('rejects a request with a disallowed Origin', async () => {
    const res = await handleClientError(req({ origin: 'https://evil.com' }));
    expect(res.status).toBe(403);
  });

  test('fails closed on an absent Origin', async () => {
    const res = await handleClientError(req({ origin: '' }));
    expect(res.status).toBe(403);
  });

  test('an oversize body is dropped but still 204s', async () => {
    const res = await handleClientError(req({ body: JSON.stringify({ message: 'x'.repeat(5000) }) }));
    expect(res.status).toBe(204);
  });

  test('malformed JSON still 204s', async () => {
    const res = await handleClientError(req({ body: 'not json' }));
    expect(res.status).toBe(204);
  });

  test('happy path logs one structured line and 204s', async () => {
    const originalLog = console.log;
    let logged;
    console.log = (line) => { logged = line; };
    try {
      const res = await handleClientError(req({
        body: JSON.stringify({ message: 'boom', source: 'app.js', line: 12, col: 3, path: '/result/', version: 'v82' }),
      }));
      expect(res.status).toBe(204);
    } finally { console.log = originalLog; }
    const evt = JSON.parse(logged);
    expect(evt).toMatchObject({ type: 'client_error', message: 'boom', source: 'app.js', line: 12, col: 3, path: '/result/', version: 'v82' });
  });

  test('oversize fields are re-truncated server-side', async () => {
    const originalLog = console.log;
    let logged;
    console.log = (line) => { logged = line; };
    try {
      await handleClientError(req({
        body: JSON.stringify({ message: 'm'.repeat(600), source: 's'.repeat(400), path: 'p'.repeat(300), version: 'v'.repeat(50) }),
      }));
    } finally { console.log = originalLog; }
    const evt = JSON.parse(logged);
    expect(evt.message.length).toBe(500);
    expect(evt.source.length).toBe(300);
    expect(evt.path.length).toBe(200);
    expect(evt.version.length).toBe(32);
  });
});

describe('handleComplete campLocation/campSize', () => {
  async function submit(extra) {
    let sentRow;
    const env = { SHEETS_WEBAPP_URL: 'https://script.google.com/fake', SHEETS_SHARED_SECRET: 's' };
    const res = await withMockFetch(async (url, opts) => {
      sentRow = JSON.parse(opts.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }, () => worker.fetch(new Request('https://greenradi.us/api/complete', {
      method: 'POST',
      headers: { Origin: 'https://greenradi.us', 'Content-Type': 'application/json' },
      body: JSON.stringify({ campName: 'Dusty Camp', leadName: 'Dusty Lead', email: 'a@b.co', year: 2026, greens: {}, ...extra }),
    }), env, {}));
    return { res, sentRow };
  }

  test('a campLocation over 80 chars clamps to 80', async () => {
    const { sentRow } = await submit({ campLocation: 'x'.repeat(100) });
    expect(sentRow.campLocation.length).toBe(80);
  });

  test('a campLocation starting with = gets the sheetCell formula guard', async () => {
    const { sentRow } = await submit({ campLocation: '=SUM(A1)' });
    expect(sentRow.campLocation).toBe("'=SUM(A1)");
  });

  test('an oversize campSize clamps to the 99999 cap', async () => {
    const { sentRow } = await submit({ campSize: '500000' });
    expect(sentRow.campSize).toBe('99999');
  });

  test('a fractional campSize truncates to an integer', async () => {
    const { sentRow } = await submit({ campSize: '42.9' });
    expect(sentRow.campSize).toBe('42');
  });

  test('a non-numeric campSize becomes blank', async () => {
    const { sentRow } = await submit({ campSize: 'lots' });
    expect(sentRow.campSize).toBe('');
  });

  test('both fields absent still succeed, both blank in the row', async () => {
    const { res, sentRow } = await submit({});
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.sheet).toBe('ok');
    expect(sentRow.campLocation).toBe('');
    expect(sentRow.campSize).toBe('');
  });

  test('a missing leadName is rejected like the other required fields', async () => {
    const { res } = await submit({ leadName: '' });
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(j.error).toBe('missing_fields');
  });
});

describe('computeCityBody season scoping', () => {
  // Raw sheet-row shape (pre-shapeAdminRows); schemaVersion marks these as
  // modern rows so isLegacy doesn't misread the small test greens as the old 0-4 scale.
  function sheetRow(overrides) {
    return { campName: 'Camp', leadName: 'Lead', email: 'a@b.co', greens: {}, total: 0,
      source: 'board', schemaVersion: 'v2', ...overrides };
  }
  async function cityBody(sheetRows) {
    const env = { SHEETS_WEBAPP_URL: 'https://script.google.com/fake', SHEETS_SHARED_SECRET: 's' };
    return withMockFetch(async () => new Response(JSON.stringify({ rows: sheetRows }), { status: 200 }),
      () => computeCityBody(env));
  }

  test('a returning next season does not blend with the prior year', async () => {
    const body = await cityBody([
      sheetRow({ campName: 'Old Camp', year: 2026 }),
      sheetRow({ campName: 'Another Old Camp', year: 2026 }),
      sheetRow({ campName: 'New Camp', year: 2027 }),
    ]);
    expect(body.count).toBe(1);
  });

  test('a hidden row with a higher year does not pull the season forward', async () => {
    const body = await cityBody([
      sheetRow({ campName: 'Real Camp', year: 2026 }),
      sheetRow({ campName: 'Junk Camp', year: 2027, hidden: 'x' }),
    ]);
    expect(body.count).toBe(1);
  });
});

describe('computeCityBody stats', () => {
  // Same raw sheet-row shape as the season-scoping suite above.
  function sheetRow(overrides) {
    return { campName: 'Camp', leadName: 'Lead', email: 'a@b.co', year: 2026, greens: {}, total: 0,
      source: 'board', schemaVersion: 'v2', timestamp: new Date().toISOString(), ...overrides };
  }
  async function cityBody(sheetRows) {
    const env = { SHEETS_WEBAPP_URL: 'https://script.google.com/fake', SHEETS_SHARED_SECRET: 's' };
    return withMockFetch(async () => new Response(JSON.stringify({ rows: sheetRows }), { status: 200 }),
      () => computeCityBody(env));
  }

  test('stats reflects the same deduped, hidden-excluded population as the tally', async () => {
    const body = await cityBody([
      // Superseded resubmission for Camp A — the earlier of the two, must not count.
      sheetRow({ campName: 'Camp A', email: 'a@a.co', campSize: '10', total: 3,
        answers: { F1: 'yes' }, timestamp: new Date(Date.now() - 60000).toISOString() }),
      // Winner for Camp A (later timestamp) — this is the one that should count.
      sheetRow({ campName: 'Camp A', email: 'a@a.co', campSize: '20', total: 8,
        answers: { F1: 'yes' } }),
      sheetRow({ campName: 'Camp B', email: 'b@b.co', campSize: '30', total: 15,
        answers: { F1: 'no' } }),
      sheetRow({ campName: 'Camp C', email: 'c@c.co', campSize: '40', total: 25,
        answers: { F1: 'yes' } }),
      // Owner-flagged junk row: must not contribute campers, histogram, or weekly counts.
      sheetRow({ campName: 'Junk Camp', email: 'junk@x.co', campSize: '500', total: 50,
        answers: { F1: 'yes' }, hidden: 'x' }),
    ]);

    // Population parity: stats and the existing tally describe the same 3 camps.
    expect(body.count).toBe(3);
    expect(body.stats.campers).toBe(20 + 30 + 40); // Junk Camp's 500 and Camp A's superseded 10 excluded

    expect(body.stats.histogram.bins).toEqual([
      { label: '0-9', count: 1 },   // Camp A: total 8
      { label: '10-19', count: 1 }, // Camp B: total 15
      { label: '20-29', count: 1 }, // Camp C: total 25
      { label: '30-39', count: 0 },
      { label: '40-49', count: 0 },
      { label: '50-60', count: 0 },
    ]);
    expect(body.stats.histogram.max).toBe(1);

    expect(Array.isArray(body.stats.weekly)).toBe(true);
    const weeklyTotal = body.stats.weekly.reduce((n, w) => n + w.count, 0);
    expect(weeklyTotal).toBe(3); // every fixture row's timestamp is "now"
    expect(typeof body.stats.weekly[body.stats.weekly.length - 1].start).toBe('number');

    // F1 was asked of all 3 active camps (2 yes, 1 no) — enough to clear the
    // minAsked=3 floor and appear as an opportunity.
    const f1 = body.stats.opportunities.find(o => o.id === 'F1');
    expect(f1).toBeTruthy();
    expect(f1.asked).toBe(3);
    expect(f1.rate).toBeCloseTo(2 / 3, 5);
    expect(body.stats.opportunities.length).toBeLessThanOrEqual(5);
  });

  test('the serialized response never carries camp-identifying fields', async () => {
    const body = await cityBody([
      sheetRow({ campName: 'Identifiable Camp', email: 'owner@identifiable.co',
        campLocation: '3:00 & E', campSize: '15', leadName: 'Some Lead',
        answers: { F1: 'yes' } }),
      sheetRow({ campName: 'Another Camp', email: 'x@y.co', campLocation: '6:00 & K',
        campSize: '22', answers: { F1: 'no' } }),
      sheetRow({ campName: 'Third Camp', email: 'z@z.co', campLocation: '9:00 & G',
        campSize: '9', answers: { F1: 'yes' } }),
    ]);
    const raw = JSON.stringify(body);
    for (const forbidden of [/campName/, /leadName/, /"email"/, /campLocation/, /campSize/, /Identifiable Camp/, /owner@identifiable\.co/]) {
      expect(raw).not.toMatch(forbidden);
    }
  });
});

describe('accessJwtEmail', () => {
  test('extracts the email claim from a token payload', async () => {
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'x' }));
    const payload = b64url(JSON.stringify({ email: 'volunteer@example.com', aud: 'a' }));
    const token = `${header}.${payload}.sig`;
    expect(accessJwtEmail(token)).toBe('volunteer@example.com');
  });

  test('falls back to "unknown" for a malformed or email-less token', () => {
    expect(accessJwtEmail('not-a-jwt')).toBe('unknown');
    expect(accessJwtEmail(null)).toBe('unknown');
    const header = b64url(JSON.stringify({ alg: 'RS256', kid: 'x' }));
    const payload = b64url(JSON.stringify({ aud: 'a' }));
    expect(accessJwtEmail(`${header}.${payload}.sig`)).toBe('unknown');
  });
});

describe('POST /api/admin/visit', () => {
  let privateKey;
  let jwk;
  const AUD = 'visit-aud';
  const TEAM_DOMAIN = 'visit-example.cloudflareaccess.com';
  const originalFetch = globalThis.fetch;
  const KID = 'visit-kid';

  beforeAll(async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify']
    );
    privateKey = keyPair.privateKey;
    jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    jwk.kid = KID;
    jwk.alg = 'RS256';
  });

  afterAll(() => { globalThis.fetch = originalFetch; });

  async function makeToken({ email = 'volunteer@example.com', aud = AUD, exp = Math.floor(Date.now() / 1000) + 3600, kid = KID, tamper = false } = {}) {
    const header = { alg: 'RS256', kid };
    const payload = { aud, exp, email };
    const headerB64 = b64url(JSON.stringify(header));
    const payloadB64 = b64url(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;
    const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(signingInput));
    let sigB64 = b64url(sigBuf);
    if (tamper) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      sigB64 = chars[(chars.indexOf(sigB64[0]) + 1) % chars.length] + sigB64.slice(1);
    }
    return `${signingInput}.${sigB64}`;
  }

  // Routes certs requests to the JWKS stub and everything else to `sheetStub`
  // (or errors if no sheet call is expected in that test).
  function mockFetch(sheetStub) {
    return async (url, opts) => {
      if (String(url).includes('/cdn-cgi/access/certs')) return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 });
      return sheetStub(url, opts);
    };
  }

  const env = { CF_ACCESS_AUD: AUD, CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN, SHEETS_WEBAPP_URL: 'https://script.google.com/fake', SHEETS_SHARED_SECRET: 'shh' };

  function req({ token, body }) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Cf-Access-Jwt-Assertion'] = token;
    return new Request('https://greenradi.us/api/admin/visit', { method: 'POST', headers, body: JSON.stringify(body) });
  }

  test('missing JWT -> 403, no upstream call', async () => {
    let sheetCalled = false;
    const res = await withMockFetch(mockFetch(() => { sheetCalled = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
      () => worker.fetch(req({ body: { campName: 'Dusty Camp', year: 2026, team: 'Team 1' } }), env, {}));
    expect(res.status).toBe(403);
    expect((await res.json()).ok).toBe(false);
    expect(sheetCalled).toBe(false);
  });

  test('invalid (tampered) JWT -> 403, no upstream call', async () => {
    const token = await makeToken({ tamper: true });
    let sheetCalled = false;
    const res = await withMockFetch(mockFetch(() => { sheetCalled = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
      () => worker.fetch(req({ token, body: { campName: 'Dusty Camp', year: 2026, team: 'Team 1' } }), env, {}));
    expect(res.status).toBe(403);
    expect((await res.json()).ok).toBe(false);
    expect(sheetCalled).toBe(false);
  });

  test('valid JWT + bad body (blank team) -> 400, no upstream call', async () => {
    const token = await makeToken();
    let sheetCalled = false;
    const res = await withMockFetch(mockFetch(() => { sheetCalled = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
      () => worker.fetch(req({ token, body: { campName: 'Dusty Camp', year: 2026, team: '' } }), env, {}));
    expect(res.status).toBe(400);
    expect((await res.json()).ok).toBe(false);
    expect(sheetCalled).toBe(false);
  });

  test('valid JWT + valid body forwards the correct payload and returns ok', async () => {
    const token = await makeToken({ email: 'admin@gtcc.org' });
    let sentBody;
    const res = await withMockFetch(mockFetch((url, opts) => { sentBody = JSON.parse(opts.body); return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
      () => worker.fetch(req({ token, body: { campId: 'abc12345', campName: 'Dusty Camp', year: 2026, team: 'Team 1' } }), env, {}));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(sentBody.secret).toBe('shh');
    expect(sentBody.action).toBe('visit');
    expect(sentBody.team).toBe('Team 1');
    expect(sentBody.campName).toBe('Dusty Camp');
    expect(sentBody.campId).toBe('abc12345');
    expect(sentBody.year).toBe(2026);
  });

  test('upstream failure -> 502', async () => {
    const token = await makeToken();
    const res = await withMockFetch(mockFetch(() => new Response('boom', { status: 500 })),
      () => worker.fetch(req({ token, body: { campName: 'Dusty Camp', year: 2026, team: 'Team 1' } }), env, {}));
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBe(false);
  });

  test('missing SHEETS_WEBAPP_URL degrades to 503, no upstream call', async () => {
    const token = await makeToken();
    let sheetCalled = false;
    const noBackendEnv = { CF_ACCESS_AUD: AUD, CF_ACCESS_TEAM_DOMAIN: TEAM_DOMAIN };
    const res = await withMockFetch(mockFetch(() => { sheetCalled = true; return new Response(JSON.stringify({ ok: true }), { status: 200 }); }),
      () => worker.fetch(req({ token, body: { campName: 'Dusty Camp', year: 2026, team: 'Team 1' } }), noBackendEnv, {}));
    expect(res.status).toBe(503);
    expect(sheetCalled).toBe(false);
  });
});

describe('GET /api/city stale-while-revalidate', () => {
  const CITY_ENV = { SHEETS_WEBAPP_URL: 'https://script.google.com/fake', SHEETS_SHARED_SECRET: 's' };

  // Stand in for caches.default with a single pre-seeded entry, recording puts.
  function mockCaches(cachedBody) {
    const puts = [];
    globalThis.caches = {
      default: {
        match: async () => (cachedBody ? new Response(JSON.stringify(cachedBody)) : undefined),
        put: async (_k, res) => { puts.push(await res.json()); },
      },
    };
    return puts;
  }

  // Age a cached entry by backdating generatedAt, then serve GET /api/city with
  // an upstream that NEVER resolves. Anything that comes back therefore proves
  // the handler did not wait on the sheet. waitUntil promises are collected but
  // deliberately not awaited (the hanging fetch would never settle).
  async function cityGet(ageMinutes) {
    const cached = { count: 7, generatedAt: Date.now() - ageMinutes * 60 * 1000 };
    const puts = mockCaches(cached);
    const waits = [];
    try {
      const res = await withMockFetch(
        () => new Promise(() => {}),
        () => worker.fetch(new Request('https://greenradi.us/api/city'), CITY_ENV,
          { waitUntil: (p) => waits.push(p) }),
      );
      return { res, body: await res.json(), waits, puts };
    } finally { delete globalThis.caches; }
  }

  test('a fresh entry is served without touching the sheet', async () => {
    const { res, body, waits } = await cityGet(1);
    expect(res.status).toBe(200);
    expect(body.count).toBe(7);
    expect(waits.length).toBe(0);
  });

  test('a stale entry is served immediately and refreshed in the background', async () => {
    const { res, body, waits } = await cityGet(10);
    expect(res.status).toBe(200);
    expect(body.count).toBe(7);
    expect(waits.length).toBe(1); // the background refresh, not the visitor's wait
  });

  test('a merely stale entry is NOT flagged stale (that banner means upstream is down)', async () => {
    const { body } = await cityGet(10);
    expect(body.stale).toBeUndefined();
  });

  test('an entry old enough to mean failing refreshes is flagged stale', async () => {
    const { body } = await cityGet(45);
    expect(body.stale).toBe(true);
  });
});
