# Admin City Glow-Up, Home/FAQ Fold Fit, Email Headline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three PRs: (A) presentation-quality admin City tab in the `/city/` teal aesthetic with pulse stats, superlatives, and a top-10 mini-badge leaderboard; (B) home screen fits above the fold on iPhone 17 Pro and FAQ scroll shrinks ~10-15%; (C) results email states total, rank title, and per-sector scores.

**Architecture:** No new scripts or load-order changes. PR A edits `admin/admin.jsx` (UI) + `admin/aggregate.js` (pure helpers). PR B edits `src/home.jsx` only. PR C edits `worker/index.js` only. Each PR is its own branch off `origin/main`, its own worktree, squash-merged via GitHub PR.

**Tech Stack:** React 18 UMD, classic-runtime JSX compiled by `bun run scripts/build.js` to `dist/`, Cloudflare Worker, `bun test`, Playwright via `~/.claude/pw/browser.ts` (bunx) for visual verification.

## Global Constraints

- Merging to `main` deploys instantly; never force-push `main`. PRs squash-merge.
- Compile gate must pass in every PR touching `.jsx`: `bun run scripts/build.js && git status --porcelain -- dist` prints nothing dirty after committing dist.
- `bun test` must pass in every PR.
- Bump `APP_VERSION` (`src/core.jsx`) to the PR number in a follow-up commit once the PR number is known (open PR first), then rebuild `dist/`.
- No CHANGELOG.md edits (PR #64 not yet merged; file absent on main).
- Copy style: no em dashes in user-facing strings.
- Components referenced by bare name in shared global scope; admin pages load only `game-data.js`, `dist/src/core.js`, `dist/src/badge.js`, `admin/aggregate.js`, `dist/admin/admin.js`, `dist/src/boot-admin.js`.
- `/api/city` privacy: never add camp-identifying fields to `computeCityBody`'s allowlist (leaderboard row changes in Task A2 stay admin-only because of this allowlist — do not touch `computeCityBody`).
- Worker email path must keep degrading gracefully (missing key → `email: 'err'`, site still works).

---

## PR A — Admin City tab (branch `admin-city-glowup`, worktree already created)

### Task A1: `superlatives` helper in aggregate.js (TDD)

**Files:**
- Modify: `admin/aggregate.js` (add function + export, ~line 108 before `computeAggregates`)
- Create: `test/aggregate.test.js`

**Interfaces:**
- Consumes: `computeAggregates(rows, sectors, now)` output (`perQuestion`, `sectorStandings`).
- Produces: `AdminAggregate.superlatives(agg, sectors, minAsked?) -> { strongest, weakest, hardest, topL4 }` where `strongest`/`weakest` are `{ id, name, avg }` (from sectorStandings), `hardest` is `{ id, sector, title, rate, asked }` or null, `topL4` is `{ id, sector, title, yes, asked }` or null. Write-in `X-camp*` topics are excluded from `topL4` (their titles are generic). Questions with `asked < minAsked` (default 3) can't win `hardest`.

- [ ] **Step 1: Write the failing test** — create `test/aggregate.test.js`:

```js
import { test, expect, describe } from 'bun:test';
import A from '../admin/aggregate.js';

// Two tiny sectors: enough shape for perQuestion/standings without game-data.
const SECTORS = [
  { id: 'food', name: 'Food', levels: [[{ id: 'F1', title: 'Bulk buy' }], [], []],
    tier4Topics: [{ id: 'F-adv', title: 'Compost' }, { id: 'F-camp', title: "Our Camp's Idea" }] },
  { id: 'water', name: 'Water', levels: [[{ id: 'W1', title: 'Refill' }], [], []],
    tier4Topics: [] },
];
const row = (name, greens, answers, ts) => ({
  campName: name, email: name + '@x.com', timestamp: ts || 1000,
  greens, total: Object.values(greens).reduce((a, b) => a + b, 0),
  answers, schemaVersion: 'v2',
});

describe('superlatives', () => {
  test('picks strongest/weakest sector, hardest question, top L4', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'yes', W1: 'no', 'F-adv': 'yes' }),
      row('b', { food: 6, water: 1 }, { F1: 'yes', W1: 'no', 'F-adv': 'yes' }),
      row('c', { food: 7, water: 3 }, { F1: 'no', W1: 'no', 'F-adv': 'no' }),
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 3);
    expect(s.strongest.id).toBe('food');
    expect(s.weakest.id).toBe('water');
    expect(s.hardest.id).toBe('W1');      // 0/3 yes
    expect(s.hardest.asked).toBe(3);
    expect(s.topL4.id).toBe('F-adv');     // 2 yes
    expect(s.topL4.yes).toBe(2);
  });

  test('minAsked keeps tiny samples from winning hardest', () => {
    const rows = [
      row('a', { food: 8, water: 2 }, { F1: 'no' }),            // F1 asked once, 0%
      row('b', { food: 6, water: 1 }, { W1: 'no' }),
      row('c', { food: 7, water: 3 }, { W1: 'no' }),
      row('d', { food: 7, water: 3 }, { W1: 'yes' }),           // W1 asked 3x, 33%
    ];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 3);
    expect(s.hardest.id).toBe('W1');
  });

  test('write-in camp topics never win topL4; empty data returns nulls', () => {
    const rows = [row('a', { food: 8, water: 2 }, { 'F-camp': 'yes' })];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    const s = A.superlatives(agg, SECTORS, 1);
    expect(s.topL4).toBe(null);
    const empty = A.superlatives(A.computeAggregates([], SECTORS, 2000), SECTORS, 3);
    expect(empty.strongest).toBe(null);
    expect(empty.hardest).toBe(null);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `bun test test/aggregate.test.js` → FAIL, `A.superlatives is not a function`.

- [ ] **Step 3: Implement** — in `admin/aggregate.js`, after `leaderboard` (line ~108), add; also add `superlatives` to the `api` object on line 136:

```js
  // City-tab extremes. minAsked (default 3) keeps a question answered by one
  // or two camps from winning "hardest". Write-in X-camp topics are excluded
  // from topL4 (their shared title says nothing about what camps actually do).
  function superlatives(agg, sectors, minAsked) {
    var min = minAsked == null ? 3 : minAsked;
    var st = agg.sectorStandings || [];
    var hardest = null, topL4 = null;
    sectors.forEach(function (sector) {
      [].concat.apply([], sector.levels.slice(0, 3)).forEach(function (q) {
        var pq = agg.perQuestion[q.id];
        if (!pq || pq.asked < min) return;
        if (!hardest || pq.rate < hardest.rate)
          hardest = { id: q.id, sector: sector.name, title: q.prompt || q.title, rate: pq.rate, asked: pq.asked };
      });
      (sector.tier4Topics || []).forEach(function (t) {
        if (/-camp(-\d+)?$/.test(t.id)) return;
        var pq = agg.perQuestion[t.id];
        if (!pq || !pq.yes) return;
        if (!topL4 || pq.yes > topL4.yes)
          topL4 = { id: t.id, sector: sector.name, title: t.title, yes: pq.yes, asked: pq.asked };
      });
    });
    return {
      strongest: st[0] || null,
      weakest: st.length ? st[st.length - 1] : null,
      hardest: hardest, topL4: topL4,
    };
  }
```

- [ ] **Step 4: Run tests** — `bun test` → all pass (existing 20 + 3 new).
- [ ] **Step 5: Commit** — `git add admin/aggregate.js test/aggregate.test.js && git commit -m "Add AdminAggregate.superlatives for the City tab extremes"`

### Task A2: Leaderboard rows carry render data

**Files:**
- Modify: `admin/aggregate.js:102-108` (`leaderboard`)
- Modify: `test/aggregate.test.js` (one test)

**Interfaces:**
- Produces: each leaderboard entry gains `greens`, `answers`, `timestamp`, `schemaVersion` (straight off the deduped row) so the UI can build mini-badge fills and the "new" dot. `computeCityBody` in `worker/index.js` is NOT touched — its field-by-field allowlist keeps these private.

- [ ] **Step 1: Failing test** — add to `test/aggregate.test.js`:

```js
describe('leaderboard row data', () => {
  test('entries carry greens/answers/timestamp for mini badges', () => {
    const rows = [row('a', { food: 8, water: 2 }, { F1: 'yes' }, 1234)];
    const agg = A.computeAggregates(rows, SECTORS, 2000);
    expect(agg.leaderboard[0].greens).toEqual({ food: 8, water: 2 });
    expect(agg.leaderboard[0].answers).toEqual({ F1: 'yes' });
    expect(agg.leaderboard[0].timestamp).toBe(1234);
  });
});
```

- [ ] **Step 2: Verify fail** — `bun test test/aggregate.test.js` → FAIL (undefined).
- [ ] **Step 3: Implement** — in `leaderboard()`, extend the mapped object:

```js
  function leaderboard(rows, sectors, n) {
    return rows.map(r => ({
      campName: r.campName, leadName: r.leadName, total: r.total || 0,
      perfectSectors: sectors.filter(s => ((r.greens && r.greens[s.id]) || 0) === 10).length,
      resultUrl: r.resultUrl || '',
      greens: r.greens || {}, answers: r.answers || {},
      timestamp: r.timestamp || 0, schemaVersion: r.schemaVersion || '',
    })).sort((a, b) => b.total - a.total).slice(0, n || 10);
  }
```

- [ ] **Step 4: Run** — `bun test` → pass.
- [ ] **Step 5: Commit** — `git commit -am "Leaderboard entries carry row data for admin mini badges"`

### Task A3: Restyle CommunityTally (hero card, pulse, superlatives, leaderboard)

**Files:**
- Modify: `admin/admin.jsx:85-155` (`CommunityTally`, `SecHead`, `rowStyle`)
- Modify: `admin/index.html` (add Space Grotesk font-face + font-family, copied from `city/index.html`)

**Interfaces:**
- Consumes: `A.computeAggregates`, `A.superlatives`, `RadialBadge`, `SectorIcon`, `fillsFromAnswers` (core), `legacyFills`/`approxFills` (defined at admin.jsx:414-435 — reference by name, they hoist), `A.isLegacy`.
- Produces: no new exports; Camps tab untouched.

- [ ] **Step 1: Add Space Grotesk to `admin/index.html`** — copy the `@font-face` block + preload link exactly as they appear in `city/index.html` (grep `Space Grotesk` there); change `body` font-family to `'Space Grotesk',system-ui,sans-serif`.

- [ ] **Step 2: Replace `CommunityTally` and its style constants** in `admin/admin.jsx` with:

```jsx
// City tab: /city/'s teal "playa dusk" card language, admin-only data density.
const CITY_CARD_BG = 'linear-gradient(160deg, #0e2733 0%, #14323f 100%)';
const panelStyle = { background: '#111d16', border: '1px solid #26382e', borderRadius: 16, padding: '14px 16px' };

function miniFills(sectors, entry) {
  const hasAns = entry.answers && Object.keys(entry.answers).some(k =>
    entry.answers[k] === 'yes' || entry.answers[k] === 'no');
  if (hasAns) return fillsFromAnswers(sectors, entry.answers);
  return A.isLegacy(entry) ? legacyFills(sectors, entry.greens) : approxFills(sectors, entry.greens);
}

function StatTile({ value, label }) {
  return (
    <div style={{ ...panelStyle, textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#7fc46a', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 9.5, letterSpacing: '.14em', color: '#93a89b', fontWeight: 800, marginTop: 2 }}>{label.toUpperCase()}</div>
    </div>
  );
}

function Superlative({ label, value, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px dashed #21332a', fontSize: 13 }}>
      <span style={{ fontSize: 9.5, letterSpacing: '.12em', color: '#93a89b', fontWeight: 800, flexShrink: 0, width: 118 }}>{label.toUpperCase()}</span>
      <span style={{ flex: 1, color: '#eaf2ec', minWidth: 0 }}>{value}</span>
      <b style={{ fontVariantNumeric: 'tabular-nums', color: '#7fc46a', flexShrink: 0 }}>{detail}</b>
    </div>
  );
}

function CommunityTally({ sectors, rows }) {
  const agg = React.useMemo(() => A.computeAggregates(rows, sectors, Date.now()), [rows, sectors]);
  const sup = React.useMemo(() => A.superlatives(agg, sectors), [agg, sectors]);
  const wide = useMQ('(min-width: 760px)');
  const [sel, setSel] = React.useState(null);
  const pct = Math.round(agg.tallyPct * 100);
  const now = Date.now();

  const detail = (() => {
    if (!sel) return null;
    const sector = sectors.find(s => s.id === sel.sector);
    let label, q, rate;
    if (sel.level < 3) { q = (sector.levels[sel.level] || [])[sel.qi]; if (!q) return null;
      label = `${sector.name} · Level ${sel.level + 1}`; rate = agg.perQuestion[q.id]?.rate || 0;
      return { label, text: q.prompt || q.title, rate, n: agg.perQuestion[q.id]?.asked || 0 }; }
    label = `${sector.name} · Level 4`; rate = agg.intensities ? agg.intensities[sector.id].levels[3][sel.qi] : 0;
    return { label, text: `Camps reaching advanced step ${sel.qi + 1}`, rate, n: agg.count };
  })();

  const Hero = (
    <div style={{ background: CITY_CARD_BG, borderRadius: 24, color: '#fff', padding: '24px 22px',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
          GREEN RADIUS · BLAST {new Date().getFullYear()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.12 }}>Black Rock City</div>
        <div style={{ margin: '6px 0 10px' }}>
          <span style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{agg.hasAnswers ? `${pct}%` : agg.totalYes}</span>
          {agg.hasAnswers && <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.65 }}> achieved</span>}
        </div>
        <RadialBadge sectors={sectors} fills={{}} size={wide ? 300 : 256} dark
          intensities={agg.intensities} centerLabel={agg.hasAnswers ? `${pct}%` : `${agg.totalYes}`}
          selected={sel}
          onSelectSegment={agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null} />
        <div style={{ fontSize: 13, color: '#d8cbb6', marginTop: 8 }}>
          <b style={{ color: '#fff' }}>{agg.totalYes}</b> of {agg.totalPossible} green choices
        </div>
        {agg.legacyCount > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {agg.legacyCount} older {agg.legacyCount === 1 ? 'response' : 'responses'} on the old 0 to 4 scale excluded from the tally.
          </div>
        )}
        {!agg.hasAnswers && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Per-question detail appears once granular capture is live.</div>}
        {detail && (
          <div data-segment-detail style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '3px solid #7fc46a',
            borderRadius: 10, padding: '9px 11px', margin: '10px auto 0', maxWidth: 320, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#7fc46a', fontWeight: 800 }}>{detail.label.toUpperCase()}</div>
            <div style={{ fontSize: 12.5, margin: '2px 0 4px' }}>{detail.text}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}><b style={{ color: '#fff', fontSize: 15 }}>{Math.round(detail.rate * 100)}%</b> of {detail.n} camps</div>
          </div>
        )}
      </div>
    </div>
  );

  const Pulse = (
    <div data-pulse style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
      <StatTile value={agg.count} label={agg.count === 1 ? 'camp' : 'camps'} />
      <StatTile value={agg.totalYes} label="green points" />
      <StatTile value={`+${agg.momentum.thisWeek}`} label="this week" />
    </div>
  );

  const Superlatives = (sup.strongest || sup.hardest || sup.topL4) && (
    <div style={{ ...panelStyle, marginTop: 12 }} data-superlatives>
      <SecHead style={{ marginTop: 0 }}>Superlatives</SecHead>
      {sup.strongest && <Superlative label="Strongest sector" value={sup.strongest.name} detail={`${sup.strongest.avg.toFixed(1)}/10 avg`} />}
      {sup.weakest && <Superlative label="Weakest sector" value={sup.weakest.name} detail={`${sup.weakest.avg.toFixed(1)}/10 avg`} />}
      {sup.hardest && <Superlative label="Hardest question" value={`${sup.hardest.title} (${sup.hardest.sector})`} detail={`${Math.round(sup.hardest.rate * 100)}% of ${sup.hardest.asked}`} />}
      {sup.topL4 && <Superlative label="Top level 4" value={`${sup.topL4.title} (${sup.topL4.sector})`} detail={`${sup.topL4.yes} camps`} />}
    </div>
  );

  const Leaderboard = (
    <div style={{ ...panelStyle, marginTop: 12 }} data-leaderboard>
      <SecHead style={{ marginTop: 0 }}>Reaching Furthest</SecHead>
      {agg.leaderboard.map((c, i) => (
        <div key={i} data-rank={i + 1} style={{ ...rowStyle, gap: 10 }}>
          <span style={{ width: 18, color: '#93a89b', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
          <span aria-hidden="true" style={{ flexShrink: 0, display: 'inline-flex' }}>
            <RadialBadge sectors={sectors} fills={miniFills(sectors, c)} size={30} dark showLabels={false} showCenter={false}/>
          </span>
          <span style={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.campName} {i === 0 && <span style={{ color: '#e8c15a' }}>★</span>}
            {c.timestamp && now - c.timestamp <= 7 * 864e5 ? <span title="new this week" style={{ color: '#7fc46a', marginLeft: 4 }}>●</span> : null}
          </span>
          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total}/60</b>
        </div>
      ))}
    </div>
  );

  const Standings = (
    <div style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Sector Standings</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '0 18px' }}>
        {agg.sectorStandings.map(s => (
          <div key={s.id} style={rowStyle}>
            <SectorIcon kind={(sectors.find(x => x.id === s.id) || {}).icon} size={13} color="#7f988a"/>
            <span style={{ flex: 1, color: '#cdebd8' }}>{s.name}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.avg.toFixed(1)}</b>
          </div>
        ))}
      </div>
    </div>
  );

  const Stats = <div>{Pulse}{Superlatives}{Leaderboard}{Standings}</div>;
  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 400px) 1fr', gap: 20, paddingTop: 16, alignItems: 'start' }}>{Hero}{Stats}</div>
    : <div style={{ paddingTop: 12 }}>{Hero}{Stats}</div>;
}
const SecHead = ({ children, style }) => <div style={{ fontSize: 10.5, letterSpacing: '.16em', color: '#93a89b', fontWeight: 800, margin: '16px 0 6px', ...style }}>{String(children).toUpperCase()}</div>;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed #21332a', fontSize: 13 };
```

Notes: `SecHead` gains an optional `style` prop (existing call sites unaffected). `Pulse` sits ABOVE the fold on mobile too because Hero renders first. On wide, `Stats` no longer needs the `marginTop` wrapper.

- [ ] **Step 3: Compile gate** — `bun run scripts/build.js && git status --porcelain -- dist` (expect dist/admin/admin.js changed, add it), `bun test` → pass.

- [ ] **Step 4: Visual verify (subagent)** — serve the worktree (`python3 -m http.server 8014`), Playwright-route `/api/admin/responses` to a fixture of ~12 camps (varied totals, some with `answers`, timestamps spread across 3 weeks; write the fixture to the scratchpad, NOT the repo), screenshot `/admin/` at 1280×900 and 390×844. Dispatch a haiku subagent to run it and return: does the hero read as the /city/ card (teal gradient, glow, big % in green), are the three tiles/superlatives/top-10 leaderboard with mini badges visible, any overlap/clipping. Iterate on spacing until clean.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Admin City tab: teal hero card, pulse tiles, superlatives, top-10 mini-badge leaderboard"`

### Task A4: Open PR A, stamp version

- [ ] **Step 1:** Push branch, `gh pr create` with summary + verification notes; note the PR number N.
- [ ] **Step 2:** Set `APP_VERSION = 'vN'` in `src/core.jsx`, `bun run scripts/build.js`, commit `Stamp vN`, push.
- [ ] **Step 3:** Confirm CI green (`gh pr checks --watch`).

---

## PR B — Home/FAQ fold fit (branch `home-fold-fit`, new worktree off origin/main)

### Task B1: Measure baseline

- [ ] **Step 1:** Serve the worktree on :8015. Playwright script at viewport 402×874: load `/`, wait for `#root` content, evaluate for the home screen: `document.querySelector('h1').closest('div')` bounding box bottom, the bottom of the GTCC credit link (`a[href*="COMMUNITY" is not selectable — use the footer container: last div with borderTop]`, simplest: `Array.from(document.querySelectorAll('a')).find(a => a.textContent.includes('GREEN THEME CAMP'))`.getBoundingClientRect().bottom), and `document.documentElement.scrollHeight`. Then open FAQ (`click` the FAQ button) and record the dialog's `scrollHeight`. Save numbers + screenshots to the scratchpad. Run via haiku subagent returning the numbers as text.
- Success target: GTCC-link bottom ≤ 720px (874 minus generous Safari chrome); FAQ dialog scrollHeight reduced ≥10% by Task B2.

### Task B2: Tighten spacing

**Files:**
- Modify: `src/home.jsx` (ModePicker + FaqModal/AboutSection spacing only — values, not structure)

- [ ] **Step 1: Apply the first-pass diet** (exact edits; iterate after re-measuring):
  - `ModePicker` container `padding: '22px 24px 22px'` → `'14px 24px 18px'`
  - `h1` `margin: '0 0 10px'` → `'0 0 8px'`
  - sector-icon row `margin: '8px 0 18px'` → `'6px 0 12px'`
  - intro copy `margin: '0 auto 24px'` → `'0 auto 16px'`
  - `tileBase` `padding: '18px 16px'` → `'14px 16px'`; `marginBottom: 12` → `10`
  - both tile SVGs `width/height 54` → `48`; `margin: '0 auto 10px'` → `'0 auto 8px'`
  - FAQ/City row `marginTop: 6, marginBottom: 10` → `marginTop: 4, marginBottom: 8`
  - footer `marginTop: 22, paddingTop: 16` → `marginTop: 14, paddingTop: 12`
  - FAQ: `AboutSection` `marginTop: divider ? 20 : 22` → `divider ? 16 : 16`, `paddingTop: divider ? 20 : 0` → `divider ? 16 : 0`; sticky header `padding: '22px 22px 16px'` → `'18px 22px 13px'`; back cover `marginTop: 26, paddingTop: 20` → `marginTop: 18, paddingTop: 16`; FAQ item paddings `12` → `10`.
- [ ] **Step 2:** `bun run scripts/build.js`, re-run the B1 measurement, iterate values until the GTCC link bottom ≤ 720 and FAQ reduction ≥ 10%, with a subagent confirming nothing looks cramped or clipped at 402×874 and 1280×900.
- [ ] **Step 3:** `bun test` (guards against accidental syntax damage), commit: `git add -A && git commit -m "Home and FAQ spacing: fit the home screen above the fold on iPhone 17 Pro"` with the before/after numbers in the commit body.

### Task B3: Open PR B, stamp version (same steps as Task A4)

---

## PR C — Email headline (branch `email-headline`, new worktree off origin/main)

### Task C1: `headlineEmailHtml` (TDD)

**Files:**
- Modify: `worker/index.js` (new export + `sendEmail` wiring + `handleComplete` call)
- Modify: `test/worker.test.js` (new describes)

**Interfaces:**
- Produces: `export function headlineEmailHtml(greens)` → HTML string: `<p><strong>{Rank.titleFor(total)}</strong> · <strong>{total}</strong>/60 green points</p>` + a `<table>` of six `{sector.name} {n}/10` rows. `sendEmail(env, to, campName, resultUrl, answers, greens)` places it between the intro `<p>` and the result-link `<p>`.

- [ ] **Step 1: Failing tests** — add to `test/worker.test.js` (import `headlineEmailHtml` too; `Rank` from `../rank.js`, `GameData` from `../game-data.js`):

```js
describe('headlineEmailHtml', () => {
  const greens = { food: 7, water: 4, waste: 10, transport: 2, shelter: 5, power: 6 };
  test('states rank title, total, and all six sector scores', () => {
    const html = headlineEmailHtml(greens);
    expect(html).toContain('<strong>34</strong>/60 green points');
    expect(html).toContain(Rank.titleFor(34));
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
  test('intro, headline, link, plan, footer in order', async () => {
    const { sendEmail } = await import('../worker/index.js');
    const originalFetch = globalThis.fetch;
    let sent;
    globalThis.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return new Response('{}', { status: 200 }); };
    try {
      await sendEmail({ RESEND_API_KEY: 'k' }, 'a@b.co', 'Dusty', 'https://greenradi.us/result/?r=x',
        { F1: 'no' }, { food: 1, water: 0, waste: 0, transport: 0, shelter: 0, power: 0 });
    } finally { globalThis.fetch = originalFetch; }
    const html = sent.html;
    const iIntro = html.indexOf('Thanks for playing');
    const iHead = html.indexOf('/60 green points');
    const iLink = html.indexOf('View &amp; share');
    expect(iIntro).toBeGreaterThanOrEqual(0);
    expect(iHead).toBeGreaterThan(iIntro);
    expect(iLink).toBeGreaterThan(iHead);
  });
});
```

(Requires exporting `sendEmail`. If `F1` isn't a real question id the plan section is simply empty — the order assertions only need intro/headline/link.)

- [ ] **Step 2: Verify fail** — `bun test test/worker.test.js` → FAIL (no export).
- [ ] **Step 3: Implement** in `worker/index.js`:

```js
// The email's headline: the result itself. Sector names/order come from
// game-data (the same source the sheet and UI use); inline CSS only so it
// renders in every client. Dark green (#3d7a31) stays readable on white.
export function headlineEmailHtml(greens) {
  const total = GameData.SECTORS.reduce((n, s) => n + ((greens && greens[s.id]) | 0), 0);
  const rows = GameData.SECTORS.map(s =>
    `<tr><td style="padding:2px 14px 2px 0;color:#555">${escAttr(s.name)}</td>` +
    `<td style="padding:2px 0;font-weight:bold;color:#3d7a31;font-variant-numeric:tabular-nums">${(greens && greens[s.id]) | 0}/10</td></tr>`
  ).join('');
  return `<p style="margin:18px 0 6px;font-size:15px"><strong>${escAttr(Rank.titleFor(total))}</strong> · <strong>${total}</strong>/60 green points</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:0 0 4px">${rows}</table>`;
}
```

Change `sendEmail` to `export async function sendEmail(env, to, campName, resultUrl, answers, greens)` and its `html:` to:

```js
      html: `<p>Thanks for playing the Green Radius Game!</p>${headlineEmailHtml(greens)}<p><a href="${href}">View &amp; share your Green Radius →</a></p>${greenUpEmailHtml(answers)}<p style="color:#888;font-size:12px">Questions? Just reply to this email — it reaches the Green Theme Camp Community team.</p><p style="color:#888;font-size:12px">greenthemecampcommunity.org</p>`,
```

In `handleComplete` (line ~118): `sendEmail(env, email, campName, resultUrl, answers, greens)`.

- [ ] **Step 4: Run** — `bun test` → pass.
- [ ] **Step 5:** Optional live check with `npx wrangler dev` + fake `.dev.vars` (per memory: mock upstream, persist outside repo) — skip if tests are green; the email path is covered by the order test.
- [ ] **Step 6: Commit** — `git add worker/index.js test/worker.test.js && git commit -m "Results email opens with the result: rank title, total, per-sector scores"`

### Task C2: Open PR C, stamp version (same steps as Task A4; APP_VERSION bump requires the dist rebuild even though the feature is worker-only)

---

## Self-review notes

- Spec coverage: hero card (A3), pulse (A3), superlatives (A1+A3), top-10 mini-badge leaderboard + new-dot (A2+A3), standings restyle (A3), fold fit + FAQ (B1-B2), email headline (C1). Deferred items (histogram, deltas) intentionally absent.
- The existing note in the email ("Questions? Just reply to this email — ...") contains an em dash pre-dating this work; leave it (surgical-changes rule).
- `SecHead` signature change is backward-compatible (style optional).
- `miniFills` reuses `legacyFills`/`approxFills` — same-file function declarations, hoisted, safe to reference from earlier in the file.
