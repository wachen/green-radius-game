#!/usr/bin/env bun
// Post-deploy smoke test for https://greenradi.us — run in CI right after a
// merge to main (see .github/workflows/post-deploy-verify.yml), or by hand.
//
// Why: PR #70 shipped an unanchored .assetsignore pattern that also matched
// dist/src/ and 404'd the compiled game scripts on prod for ~15 minutes; it
// was only caught by a manual URL check. This script automates that check.
//
// Deliberately dependency-free: plain `fetch`, no Playwright/browser, no
// package.json. Two checks:
//   1. Poll dist/src/core.js until it contains the expected APP_VERSION
//      stamp, so we're not testing a stale cached/propagating deploy.
//   2. A URL matrix: every dist/ script the four HTML entry points reference
//      (parsed fresh from the checked-out HTML, so it can't go stale) plus
//      the other runtime files must 200; retired/excluded paths must 404.
//
// Env overrides (all optional):
//   BASE_URL          default https://greenradi.us
//   EXPECT_VERSION    default: read from the checked-out src/core.jsx
//   POLL_TIMEOUT_MS   default 300000 (5 min)
//   POLL_INTERVAL_MS  default 10000

import { join, dirname } from "node:path";

const ROOT = join(import.meta.dir, "..");
const BASE_URL = (process.env.BASE_URL || "https://greenradi.us").replace(/\/$/, "");
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS || 300_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 10_000);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

// ─── 1. figure out the expected APP_VERSION stamp ──────────────────────────
async function expectedVersion() {
  if (process.env.EXPECT_VERSION) return process.env.EXPECT_VERSION;
  const src = await Bun.file(join(ROOT, "src/core.jsx")).text();
  const m = src.match(/const APP_VERSION = ['"]([^'"]+)['"]/);
  if (!m) throw new Error("could not find APP_VERSION in src/core.jsx");
  return m[1];
}

// ─── 2. derive the dist/ URL matrix from the HTML entry points ─────────────
// Root-relative HTML files (index.html) reference dist/... directly;
// sub-page HTML files (result/, city/, admin/) reference ../dist/....
// Normalize both to a site-root-relative path.
const HTML_ENTRY_POINTS = ["index.html", "result/index.html", "city/index.html", "admin/index.html"];

async function distScriptPaths() {
  const paths = new Set();
  for (const rel of HTML_ENTRY_POINTS) {
    const html = await Bun.file(join(ROOT, rel)).text();
    const dir = dirname(rel); // "." or "result", "city", "admin"
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']*dist\/[^"']+)["']/g)) {
      const src = m[1];
      // Resolve relative to the HTML file's directory, then strip any leading "./".
      const resolved = dir === "." ? src : join(dir, src).replace(/^\.\//, "");
      paths.add("/" + resolved.replace(/^\/+/, ""));
    }
  }
  return [...paths].sort();
}

// ─── 3. the checks ──────────────────────────────────────────────────────────
async function pollForDeploy(expected) {
  console.log(`Polling ${BASE_URL}/dist/src/core.js for APP_VERSION "${expected}" (timeout ${POLL_TIMEOUT_MS}ms)...`);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/dist/src/core.js?cb=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const body = await res.text();
        // Whitespace-tolerant: since #90 the dist artifacts are minified, so
        // the served stamp reads APP_VERSION="vNN" (no spaces around =).
        if (new RegExp(`APP_VERSION\\s*=\\s*["']${expected}["']`).test(body)) {
          console.log(`OK: live dist/src/core.js reports ${expected}`);
          return true;
        }
        const found = body.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
        lastErr = `served core.js has APP_VERSION ${found ? found[1] : "(not found)"}, want ${expected}`;
      } else {
        lastErr = `dist/src/core.js returned ${res.status}`;
      }
    } catch (e) {
      lastErr = String(e);
    }
    if (Date.now() + POLL_INTERVAL_MS < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    } else {
      break;
    }
  }
  fail(`deploy did not propagate within ${POLL_TIMEOUT_MS}ms — ${lastErr}`);
  return false;
}

async function checkUrl(path, expectedStatus) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const ok = res.status === expectedStatus;
    console.log(`${ok ? "OK  " : "FAIL"} [${res.status}] ${path} (expected ${expectedStatus})`);
    if (!ok) fail(`${path} returned ${res.status}, expected ${expectedStatus}`);
    return ok;
  } catch (e) {
    console.log(`FAIL [ERR ] ${path}`);
    fail(`${path} threw: ${e}`);
    return false;
  }
}

const RUNTIME_200_PATHS = ["/game-data.js", "/result-state.js", "/og-card.png", "/", "/result/", "/city/"];

const EXCLUDED_404_PATHS = [
  "/src/core.jsx",
  "/green-radius.jsx",
  "/CLAUDE.md",
  "/wrangler.jsonc",
  "/worker/index.js",
  "/docs/architecture.md",
  "/scripts/build.js",
  "/test/core-salvage.test.js",
  "/.git/config",
  "/rank.js",
  "/vendor/babel-standalone-7.29.0.min.js",
];

async function main() {
  const expected = await expectedVersion();
  const propagated = await pollForDeploy(expected);
  if (!propagated) {
    // Still run the URL matrix so a single CI run surfaces every problem, but
    // the run is already a failure at this point.
  }

  const distPaths = await distScriptPaths();
  console.log(`\nURL matrix (${distPaths.length} dist/ scripts + ${RUNTIME_200_PATHS.length} runtime paths + ${EXCLUDED_404_PATHS.length} excluded paths):`);

  for (const p of distPaths) await checkUrl(p, 200);
  for (const p of RUNTIME_200_PATHS) await checkUrl(p, 200);
  for (const p of EXCLUDED_404_PATHS) await checkUrl(p, 404);

  if (process.exitCode) {
    console.error("\nverify-prod: FAILED");
  } else {
    console.log("\nverify-prod: all checks passed");
  }
}

await main();
