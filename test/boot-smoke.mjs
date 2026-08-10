// CI boot-smoke check.
//
// The game is nine precompiled scripts sharing one global scope; each page
// (/, /result/, /city/, /admin/) loads only the subset it needs, and
// components are referenced by bare name. Nothing today catches "page loads
// but a bare name is undefined on THIS page" (a real past bug: ShareCard was
// undefined on /result/ because the defining script wasn't loaded there) —
// the compile gate only checks that each script parses in isolation.
//
// This script drives real headless Chromium against a running static server
// and, for each of the four entry pages, asserts:
//   1. #root ends up showing rendered UI, not the pre-JS loading placeholder
//      (a bare-name ReferenceError during the first render leaves #root
//      empty or stuck on the placeholder — this is what would have caught
//      the ShareCard bug).
//   2. Zero console errors and zero uncaught page errors.
//   3. Zero failed network requests, except /api/* — those legitimately
//      404 under a bare static server (no Worker), and the /city/ and
//      /admin/ pages must still render a graceful shell/error state when
//      that happens. Assertion 1 covers that: their degraded state also
//      replaces the placeholder, so a silent crash still fails the check.
//
// Self-contained: only needs the `playwright` package, installed ad hoc by
// the CI workflow (this repo intentionally has no package.json). Run it
// locally against a server you started separately, e.g.:
//   python3 -m http.server 8000 &
//   node test/boot-smoke.mjs http://localhost:8000

import { chromium } from 'playwright';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// result-state.js is UMD (browser + node) — reuse its real encoder so /result/
// is exercised with an actual result payload, not a bare "incomplete link"
// state. A bare /result/ visit never reaches the ShareCard render branch at
// all, so it would NOT have caught the historical ShareCard-undefined bug.
const ResultState = require('../result-state.js');
const { SECTORS } = require('../game-data.js');

function sampleResultPath() {
  const fills = {};
  for (const s of SECTORS) fills[s.id] = { levels: [[true], [true, false], [true, false, true], [true, true, false, false]] };
  const payload = ResultState.encode({ fills, campName: 'Boot Smoke Camp', leadName: 'CI', year: 2026 });
  return `/result/?r=${payload}`;
}

const BASE_URL = (process.argv[2] || process.env.BOOT_SMOKE_URL || 'http://localhost:8000').replace(/\/$/, '');
const PAGES = ['/', sampleResultPath(), '/city/', '/admin/'];
const NAV_TIMEOUT_MS = 15000;
const SETTLE_TIMEOUT_MS = 15000;

// Requests that are *expected* to fail under a bare static server (no Worker
// backing /api/*). The city/admin pages must degrade gracefully when this
// happens — that's asserted separately via the #root content check below.
function isAllowlistedUrl(url) {
  try {
    return new URL(url).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

// Markers that only ever appear in a page's *pre-React* static placeholder.
// If either is still present in #root after the page settles, React either
// never mounted or crashed before replacing it.
const PLACEHOLDER_MARKERS = ['grg-loading', 'Loading the admin viewer'];

async function checkPage(browser, path) {
  const url = BASE_URL + path;
  const context = await browser.newContext();
  const page = await context.newPage();
  const issues = [];

  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    // Chrome also surfaces failed resource loads (e.g. the /api/* 404s) as a
    // console error whose location is the failed request's own URL — apply
    // the same allowlist so we don't double-flag those.
    const loc = msg.location()?.url;
    if (loc && isAllowlistedUrl(loc)) return;
    issues.push(`console error: ${msg.text()}`);
  });
  page.on('pageerror', err => {
    issues.push(`uncaught page error: ${err.message || err}`);
  });
  page.on('requestfailed', req => {
    if (!isAllowlistedUrl(req.url())) {
      issues.push(`request failed: ${req.url()} (${req.failure()?.errorText || 'unknown error'})`);
    }
  });
  page.on('response', res => {
    if (res.status() >= 400 && !isAllowlistedUrl(res.url())) {
      issues.push(`request failed: ${res.url()} (HTTP ${res.status()})`);
    }
  });

  // The Cloudflare Web Analytics beacon is a third-party CDN script unrelated
  // to the game's own wiring. Mock it locally so the smoke test is hermetic
  // (doesn't depend on CI runner internet access or a real analytics token)
  // instead of allowlisting a genuine failure.
  await page.route('https://static.cloudflareinsights.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  );

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });

    // Let React finish mounting and any in-flight /api/* fetch settle (it
    // fails fast under a static server) so city/admin reach their final
    // ready/degraded state, not just their own in-app loading state.
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});

    const rootHtml = await page.locator('#root').innerHTML();
    if (!rootHtml || !rootHtml.trim()) {
      issues.push('#root is empty after boot');
    }
    for (const marker of PLACEHOLDER_MARKERS) {
      if (rootHtml.includes(marker)) {
        issues.push(`#root still shows the loading placeholder after boot (found "${marker}")`);
      }
    }
  } catch (e) {
    issues.push(`navigation failed: ${e.message}`);
  }

  await context.close();
  return { path, ok: issues.length === 0, issues };
}

// Regression check for a bug that actually shipped: beacon.js installs
// window.sendEvent, the funnel calls used it unguarded, and beacon.js is not
// guaranteed to load (a network blip, or an ad blocker matching its name — a
// common filter-list target). The mode picker's click handler then threw and
// the game could not be started AT ALL, silently: the client-error beacon lives
// in that same blocked file, so nothing was ever reported. Funnel calls now go
// through trackEvent (src/core.jsx), which no-ops when window.sendEvent is
// missing. Asserts the intro screen is still reachable with beacon.js blocked.
async function checkPlayableWithoutBeacon(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const issues = [];

  page.on('pageerror', err => issues.push(`uncaught page error: ${err.message || err}`));
  await page.route('**/beacon.js', route => route.abort());
  await page.route('https://static.cloudflareinsights.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
  );

  try {
    await page.goto(BASE_URL + '/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});
    // A saved game would resume past the mode picker, which is the screen under test.
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: SETTLE_TIMEOUT_MS }).catch(() => {});

    await page.locator('button').filter({ hasText: /Play the Game/ }).click({ timeout: NAV_TIMEOUT_MS });
    // The intro screen is the five required camp-info fields.
    await page.waitForFunction(() => document.querySelectorAll('#root input').length === 5,
      null, { timeout: SETTLE_TIMEOUT_MS });
  } catch (e) {
    issues.push(`could not start the game with beacon.js blocked: ${e.message}`);
  }

  await context.close();
  return { path: '/ (beacon.js blocked)', ok: issues.length === 0, issues };
}

async function main() {
  const browser = await chromium.launch();
  const results = [];
  for (const path of PAGES) {
    results.push(await checkPage(browser, path));
  }
  results.push(await checkPlayableWithoutBeacon(browser));
  await browser.close();

  let allOk = true;
  for (const r of results) {
    console.log(`[${r.ok ? 'PASS' : 'FAIL'}] ${r.path}`);
    for (const issue of r.issues) console.log(`    - ${issue}`);
    if (!r.ok) allOk = false;
  }

  if (!allOk) {
    console.error('\nboot-smoke FAILED');
    process.exit(1);
  }
  console.log('\nboot-smoke passed for all pages');
}

main().catch(e => {
  console.error('boot-smoke crashed:', e);
  process.exit(1);
});
