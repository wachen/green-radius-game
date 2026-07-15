# Payload Diet Implementation Plan

**Goal:** Precompile game JSX to classic-runtime plain JS at commit time; drop @babel/standalone from the critical load path on all four HTML entry points.

**Architecture:** Bun.Transpiler (classic runtime, `React.createElement`) transforms each `.jsx` source into a committed `dist/` artifact mirroring the source path. HTML entry points load the compiled `.js` with `defer` instead of `type="text/babel"`. Per-page inline boot scripts are extracted to `src/boot-*.jsx` so they compile + CI-diff like the rest. CI recompiles and byte-diffs `dist/` to keep source and artifact in sync.

**Tech Stack:** Bun 1.3.14 (transpiler + test runner), React 18 UMD globals, Cloudflare Worker (untouched).

## Global Constraints
- No package.json / no npm / no bundler / no minifier. Bun only.
- Classic JSX runtime: `React.createElement`, no imports (scripts share one global scope).
- Never touch `vendor/react*`. Keep `vendor/babel-standalone` file (served) for in-flight old-HTML safety; just stop loading it.
- Compiled artifacts MUST be served (not in .assetsignore). Dev-only tooling stays ignored.
- Bump APP_VERSION in `src/core.jsx` to PR number, then recompile so artifact matches.
- Bun version pinned in CI to match local (1.3.14) for deterministic transpile+diff.
- Copy style: no em dashes in user-facing strings; surgical edits.

## Compile-output scheme (decided)
`dist/` mirrors source path with `.js`:
- `src/core.jsx` -> `dist/src/core.js` (and fx, badge, wheel, question-flow, share-card, home, form-mode)
- `green-radius.jsx` -> `dist/green-radius.js`
- boots: `src/boot-index.jsx|boot-result.jsx|boot-city.jsx|boot-admin.jsx` -> `dist/src/boot-*.js`
Build: `bun run scripts/build.js`. Deterministic fixed banner header, no timestamps.

## Window-semantics decision (decided)
No game component is read via `window.X` anywhere (verified sweep). All cross-script refs are bare names, which resolve in the shared global lexical scope of classic scripts. `window.SECTORS/SCHEMA_VERSION/ResultState/Rank/AdminAggregate` come from plain `.js` (unchanged). No `window.X = X` belt-and-braces needed; rely on E2E to confirm.

---

### Task 1: Build script + first compile
- Create `scripts/build.js` (Bun.Transpiler classic, glob sources, write dist mirror, banner).
- Create `src/boot-index.jsx`, `src/boot-result.jsx`, `src/boot-city.jsx`, `src/boot-admin.jsx` from the current inline boots (verbatim logic).
- Run build; commit `dist/` + boots.
- verify: `bun run scripts/build.js` exits 0; `dist/` populated; re-run -> `git diff --exit-code dist` clean.

### Task 2: Switch HTML entry points
- index/result/city/admin: drop babel-standalone script; swap each `text/babel src=*.jsx` for `defer src=dist/*.js`; replace inline boot with `defer src=dist/src/boot-*.js`.
- verify: parse gate + browser E2E (below).

### Task 3: CI + docs + .assetsignore
- ci.yml: pin bun 1.3.14; step = `bun run scripts/build.js` then `git diff --exit-code -- dist`; keep `bun test`.
- .assetsignore: add `scripts`; document `dist` must stay served.
- Update CLAUDE.md commands, CONTRIBUTING.md, README.md, docs/architecture.md: parse gate -> compile+diff.
- verify: `bun test` green; local diff clean.

### Task 4: APP_VERSION + recompile + PR
- Set `src/core.jsx` APP_VERSION to PR number; recompile; confirm diff clean; push; gh pr checks green.

## Verification bar (non-negotiable, all via haiku browser subagents)
(a) / plays board mode to done + Green-Up Plan; (b) form mode; (c) /result/?r= renders ShareCard; (d) /city/ renders or degrades; (e) /admin/ shell loads; (f) mobile 390x667 / and /result/; (g) zero console errors every page; (h) babel absent from waterfall + before/after gzip numbers.
