import { test, expect, describe, beforeAll, afterAll } from 'bun:test';
import { sheetCell, safeResultUrl, originAllowed, verifyAccessJwt, headlineEmailHtml, sendEmail } from '../worker/index.js';
import GameData from '../game-data.js';

function b64url(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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

describe('sendEmail body order', () => {
  test('intro, headline, link, plan, footer appear in order', async () => {
    const originalFetch = globalThis.fetch;
    let sent;
    globalThis.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return new Response('{}', { status: 200 }); };
    try {
      await sendEmail({ RESEND_API_KEY: 'k' }, 'a@b.co', 'Dusty', 'https://greenradi.us/result/?r=x',
        {}, { food: 1, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 });
    } finally { globalThis.fetch = originalFetch; }
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
});
