// admin/admin.jsx — gated viewer. Reuses RadialBadge (src/badge.jsx),
// fillsFromAnswers and LEVEL_COLORS (src/core.jsx) and window.AdminAggregate.
// City tab = community tally; Camps tab = full-width all-data rows.
const A = window.AdminAggregate;
const useMQ = (q) => {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => { const mm = window.matchMedia(q); const h = e => setM(e.matches);
    mm.addEventListener('change', h); return () => mm.removeEventListener('change', h); }, [q]);
  return m;
};

// Last good payload, cached for instant paint on the next visit (the page is
// Cloudflare-Access-gated and this is the admin's own browser, so holding the
// rows in localStorage is fine). Bump the key if the row shape changes.
const RESPONSES_CACHE_KEY = 'grg-admin-responses/v1';
function readCachedRows() {
  try {
    const c = JSON.parse(localStorage.getItem(RESPONSES_CACHE_KEY));
    return Array.isArray(c && c.rows) ? c.rows : [];
  } catch { return []; }
}

function useResponses() {
  // Two-part speedup, neither touching the Worker's always-fresh contract:
  // 1. The first request starts in index.html's inline kickoff, in parallel
  //    with the script downloads — this hook consumes that promise on mount.
  // 2. Stale-while-revalidate: the last good rows paint immediately (dimmed,
  //    via the existing refresh treatment) while the fresh fetch runs.
  // Refreshes keep the last rows on screen (dimmed) instead of blanking to a
  // spinner — the admin skims during launch-day monitoring; don't yank the page.
  const [state, setState] = React.useState(() => ({ status: 'loading', rows: readCachedRows() }));
  const load = React.useCallback((early) => {
    setState(s => ({ ...s, status: 'loading' }));
    Promise.resolve(early || fetch('/api/admin/responses', { headers: { 'Accept': 'application/json' } }))
      .then(r => r && r.ok ? r.json() : Promise.reject(new Error('http ' + (r ? r.status : 'failed'))))
      .then(d => {
        const rows = d.rows || [];
        try { localStorage.setItem(RESPONSES_CACHE_KEY, JSON.stringify({ rows })); } catch {}
        setState({ status: 'ready', rows });
      })
      .catch(e => setState(s => ({ status: 'error', rows: s.rows, error: String(e) })));
  }, []);
  // The early response body is single-use; null it so a retry does a real fetch.
  React.useEffect(() => { load(window.__earlyResponses); window.__earlyResponses = null; }, [load]);
  const reload = React.useCallback(() => load(), [load]);
  return { ...state, reload };
}

function AdminApp({ sectors }) {
  const { status, rows, error, reload } = useResponses();
  // Same breakpoint as CampsView's toolbar: below it the Refresh button goes
  // icon-only so the mobile control row fits on one line.
  const wide = useMQ('(min-width: 900px)');
  const [tab, setTab] = React.useState('city');
  // Set when a Top Camps row is clicked on the City tab: switches to Camps and
  // scroll-highlights that camp's row there.
  const [highlightCamp, setHighlightCamp] = React.useState(null);
  const [year, setYear] = React.useState(2026);
  const [source, setSource] = React.useState('all');
  const years = React.useMemo(() => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a), [rows]);
  const filtered = React.useMemo(() => rows.filter(r =>
    (!year || r.year === year) && (source === 'all' || r.source === source)), [rows, year, source]);
  // Dedup/supersede/suspect annotations, computed once over every row (not just
  // the year/source-filtered subset) so the year scoping inside dedupeInfo sees
  // the whole picture. Keyed by row object reference, so it still looks up
  // correctly once `filtered` narrows the array below. Camps-tab-only.
  const dedupeInfo = React.useMemo(() => A.dedupeInfo(rows), [rows]);

  // Big colorful tabs (replaces the old plain nav links) — each tab gets its
  // own hue so City/Camps read as distinct destinations, not just a toggle.
  // Colors keep white-on-saturated text for WCAG-AA contrast when active.
  const Tab = ({ id, label, name }) => {
    const m = TAB_META[id];
    const active = tab === id;
    return (
      <button data-tab={id} onClick={() => setTab(id)} title={`Switch to the ${name} tab`}
        style={{ fontWeight: 800, fontSize: 14, padding: '9px 22px', borderRadius: 12, cursor: 'pointer',
          border: `2px solid ${active ? m.border : '#26382e'}`,
          background: active ? m.activeBg : 'transparent',
          color: active ? m.text : m.mutedText,
          boxShadow: active ? '0 6px 16px rgba(0,0,0,0.35)' : 'none', transition: 'background .15s, border-color .15s' }}>
        {label}
      </button>
    );
  };

  // Year/source filters + Refresh scope BOTH tabs. On the Camps tab they embed
  // into the search toolbar (one row, no wasted vertical space); everywhere
  // else (City, loading/error, or an empty filter result — which must keep the
  // year select reachable to un-trap itself) they render as their own row.
  const filterSelects = (
    <React.Fragment>
      <select value={year} onChange={e => setYear(+e.target.value)} title="Filter by year" style={selStyle}>
        <option value={0}>All years</option>
        {years.length ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={2026}>2026</option>}
      </select>
      <select value={source} onChange={e => setSource(e.target.value)} title="Filter by submission source" style={selStyle}>
        <option value="all">All</option><option value="board">Board</option><option value="form">Form</option>
      </select>
    </React.Fragment>
  );
  const refreshBtn = (
    <button data-refresh type="button" onClick={reload} disabled={status === 'loading'} aria-label="Refresh responses"
      title="Reload responses" style={{ ...selStyle, cursor: status === 'loading' ? 'wait' : 'pointer', fontWeight: 700 }}>
      {status === 'loading' ? 'Loading…' : wide ? <React.Fragment><RefreshIcon/>Refresh</React.Fragment> : <RefreshIcon/>}
    </button>
  );
  const campsToolbarOwnsFilters = tab === 'camps' && filtered.length > 0;

  return (
    <div style={{ maxWidth: tab === 'camps' ? 1240 : 900, margin: '0 auto', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 6, paddingBottom: 10, borderBottom: '1px solid #26382e' }}>
        <b style={{ fontWeight: 800 }}>Green<span style={{ color: '#45c483' }}>Radius</span> · Admin</b>
        <a href="/" title="Back to the site" aria-label="Exit admin, back to the site"
          style={{ ...selStyle, textDecoration: 'none', fontWeight: 700, lineHeight: 1.4 }}>EXIT ↗</a>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 8 }}><Tab id="city" label="🌄 City" name="City" /><Tab id="visits" label="🥾 Visits" name="Visits" /><Tab id="camps" label="🎪 Camps" name="Camps" /></div>
      </header>

      {!campsToolbarOwnsFilters && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 0 0' }}>
          {filterSelects}{refreshBtn}
        </div>
      )}

      {status === 'loading' && rows.length === 0 && <Centered><LoadingWheel/><div style={{ marginTop: 10 }}>Loading the community tally…</div></Centered>}
      {status === 'error' && rows.length === 0 && <Centered>Couldn't load responses ({error}). <button onClick={reload} style={btnStyle}>Retry</button></Centered>}
      {rows.length > 0 && (
        <div style={{ opacity: status === 'loading' ? 0.55 : 1, transition: 'opacity .15s' }}>
          {status === 'error' && (
            <div style={{ background: '#2a1c14', border: '1px solid #573a26', borderRadius: 8, padding: '7px 11px', margin: '10px 0 0', fontSize: 12, color: '#e8c15a' }}>
              Refresh failed ({error}) — showing the previous data. <button onClick={reload} style={{ ...btnStyle, padding: '2px 8px', marginLeft: 6 }}>Retry</button>
            </div>
          )}
          {filtered.length === 0 && <Centered>No camps yet{year ? ` for ${year}` : ''}.</Centered>}
          {filtered.length > 0 && (
            tab === 'city'
              ? <CommunityTally sectors={sectors} rows={filtered} onCampClick={name => { setHighlightCamp(name); setTab('camps'); }} />
              : tab === 'visits'
                ? <VisitsView sectors={sectors} rows={filtered} reload={reload} onCampClick={name => { setHighlightCamp(name); setTab('camps'); }} />
                : <CampsView sectors={sectors} rows={filtered} filters={filterSelects} refreshBtn={refreshBtn}
                    highlight={highlightCamp} onClearHighlight={() => setHighlightCamp(null)} dedupeInfo={dedupeInfo} />
          )}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid #26382e', margin: '24px 0 12px' }}/>
      <div style={{ paddingBottom: 16, color: '#93a89b', fontSize: 12 }}>Let's go build a failed utopia.</div>
    </div>
  );
}

// Per-tab hues for the big colorful tab buttons: City stays teal (matches the
// /city/ hero), Camps gets the brand green. Muted text keeps ≥4.5:1 contrast
// on the page's near-black background when the tab is inactive.
const TAB_META = {
  city: { activeBg: 'linear-gradient(135deg,#155163,#1c6b82)', border: '#2a7d94', text: '#eaf7fb', mutedText: '#7fb8c9' },
  visits: { activeBg: 'linear-gradient(135deg,#6b4f14,#8a6a1e)', border: '#a8842e', text: '#fbf3df', mutedText: '#c9ad6b' },
  camps: { activeBg: 'linear-gradient(135deg,#1f5c32,#2f7a41)', border: '#3f9153', text: '#eafbea', mutedText: '#8fce9e' },
};

const selStyle = { background: '#101b15', color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '4px 8px', fontSize: 12 };

// Monotone line icons for the toolbar buttons (lucide file-down / mail), same
// stroke idiom as SectorIcon; currentColor follows the button's text color.
const iconProps = { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  style: { verticalAlign: '-2px', marginRight: 4 } };
const CsvIcon = () => (
  <svg {...iconProps}>
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
    <path d="M12 18v-6"/>
    <path d="m9 15 3 3 3-3"/>
  </svg>
);
const MailIcon = () => (
  <svg {...iconProps}>
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const RefreshIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M3 21v-5h5"/>
  </svg>
);
const btnStyle = { background: '#45c483', color: '#06140c', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer' };
const Centered = ({ children }) => <div style={{ textAlign: 'center', padding: '60px 0', color: '#93a89b' }}>{children}</div>;

// Spinning six-wedge wheel for cold loads — same art as the favicon and the
// static placeholder in index.html (which also owns the .grg-spin keyframes).
// The shade ramp around the circle is what makes the rotation visible.
const LoadingWheel = ({ size = 44 }) => (
  <svg className="grg-spin" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <g stroke="#0e1712" strokeWidth="1">
      <path d="M16 16 L16 2 A14 14 0 0 1 28.12 9 Z" fill="#A3D178"/>
      <path d="M16 16 L28.12 9 A14 14 0 0 1 28.12 23 Z" fill="#86C169"/>
      <path d="M16 16 L28.12 23 A14 14 0 0 1 16 30 Z" fill="#68B05C"/>
      <path d="M16 16 L16 30 A14 14 0 0 1 3.88 23 Z" fill="#56A85C"/>
      <path d="M16 16 L3.88 23 A14 14 0 0 1 3.88 9 Z" fill="#439F5B"/>
      <path d="M16 16 L3.88 9 A14 14 0 0 1 16 2 Z" fill="#31975B"/>
    </g>
    <circle cx="16" cy="16" r="2.2" fill="#0e1712"/>
  </svg>
);

// City tab: /city/'s teal "playa dusk" card language (see src/boot-city.jsx),
// admin-only data density stacked beside/beneath it.
const CITY_CARD_BG = 'linear-gradient(160deg, #0e2733 0%, #14323f 100%)';
const panelStyle = { background: '#111d16', border: '1px solid #26382e', borderRadius: 16, padding: '14px 16px' };

// Fill precedence for one camp row, shared by the leaderboard mini-badges,
// CampRow, and CampDetail: real per-question answers win, then legacy (0-4)
// or approximate (0-10) fills derived from the greens tallies.
function campFills(sectors, camp) {
  const hasAnswers = rowHasAnswers(camp);
  const legacy = A.isLegacy(camp);
  const fills = hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens));
  return { hasAnswers, legacy, fills, denom: legacy ? 4 : 10 };
}

function StatTile({ value, suffix, label }) {
  return (
    <div style={{ ...panelStyle, textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#7fc46a', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {value}{suffix && <span style={{ fontSize: 14, fontWeight: 700, color: '#93a89b' }}>{suffix}</span>}
      </div>
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

function CommunityTally({ sectors, rows, onCampClick }) {
  const agg = React.useMemo(() => A.computeAggregates(rows, sectors, Date.now()), [rows, sectors]);
  const sup = React.useMemo(() => A.superlatives(agg, sectors), [agg, sectors]);
  const wide = useMQ('(min-width: 760px)');
  const [sel, setSel] = React.useState(null); // {sector, level, qi}
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

  // Hovered Top Camps entry: the hero radius previews that camp's own wheel.
  const [peek, setPeek] = React.useState(null);
  // Clipboard digest of the city state (for pasting into GTCC email/chat).
  const [copied, setCopied] = React.useState(false);
  const copySummary = () => {
    const avg = agg.count ? (agg.totalYes / agg.count).toFixed(1) : '0';
    const text = [
      `Green Radius · Black Rock City ${new Date().getFullYear()}`,
      `${agg.count} ${agg.count === 1 ? 'camp' : 'camps'} · ${avg}/60 avg score` + (agg.hasAnswers ? ` · ${pct}% achieved` : ''),
      'Top camps: ' + agg.leaderboard.slice(0, 3).map((c, i) => `${i + 1}. ${c.campName} ${c.total}/60`).join(' · '),
      'https://greenradi.us/city/',
    ].join('\n');
    navigator.clipboard.writeText(text).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 1600); },
      () => {});
  };

  const Hero = (
    <div style={{ background: CITY_CARD_BG, borderRadius: 24, color: '#fff', padding: '14px 16px',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden', textAlign: 'center' }}>
      {/* dust glow, mirroring the /city/ card */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
          GREEN RADIUS · BLAST {new Date().getFullYear()}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.12 }}>Black Rock City</div>
        <div style={{ margin: '4px 0 8px' }}>
          <span style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{agg.hasAnswers ? `${pct}%` : agg.totalYes}</span>
          {agg.hasAnswers && <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.65 }}> achieved</span>}
        </div>
        {/* Centering wrapper: the badge's <svg> renders display:block, so it
            needs an explicit flex center — text-align:center alone doesn't
            center a block-level child. No center numeral here: the percent
            already reads above, so the badge just shows its hub dot. Hover a
            wedge to preview its question; click/tap still works (mobile). */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {/* +20px badge, offset by the tighter hero padding/margins above so
              the card's overall height stays put. Hovering a Top Camps row
              temporarily swaps the aggregate for that camp's own fills. */}
          <RadialBadge sectors={sectors} fills={peek ? campFills(sectors, peek).fills : {}} size={wide ? 284 : 276} dark
            intensities={peek ? null : agg.intensities}
            selected={sel}
            onSelectSegment={agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, fontSize: 13, color: '#d8cbb6', marginTop: 6 }}>
          {peek
            ? <span>Previewing <b style={{ color: '#fff' }}>{peek.campName}</b> · {peek.total}/60</span>
            : <span><b style={{ color: '#fff' }}>{agg.totalYes}</b> of {agg.totalPossible} green choices</span>}
        </div>
        {agg.legacyCount > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
            {agg.legacyCount} older {agg.legacyCount === 1 ? 'response' : 'responses'} on the old 0 to 4 scale excluded from the tally.
          </div>
        )}
        {!agg.hasAnswers && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Per-question detail appears once granular capture is live.</div>}
        {/* Always rendered (placeholder before the first hover) so the hero's
            height never jumps when a segment is first hovered. */}
        {agg.hasAnswers && (
          <div data-segment-detail style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '3px solid #7fc46a',
            borderRadius: 10, padding: '9px 11px', margin: '10px auto 0', maxWidth: 320, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#7fc46a', fontWeight: 800 }}>{detail ? detail.label.toUpperCase() : 'CITY RADIUS'}</div>
            {/* Fixed 4-line well so the box height never shifts between hovers. */}
            <div style={{ fontSize: 12.5, lineHeight: 1.35, margin: '2px 0 4px', height: '5.4em',
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              color: detail ? undefined : 'rgba(255,255,255,0.45)' }}>
              {detail ? detail.text : 'Hover or tap a segment on the wheel to see its question and the city-wide yes rate.'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
              {detail
                ? <React.Fragment><b style={{ color: '#fff', fontSize: 15 }}>{Math.round(detail.rate * 100)}%</b> of {detail.n} camps</React.Fragment>
                : <b style={{ fontSize: 15 }}>{' '}</b>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const Pulse = (
    <div data-pulse style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: wide ? 0 : 12 }}>
      <StatTile value={agg.count} label="Total camps" />
      <StatTile value={`+${agg.momentum.thisWeek}`} label="this week" />
      <StatTile value={agg.count ? (agg.totalYes / agg.count).toFixed(1) : 0} suffix="/60" label="Avg score" />
    </div>
  );

  const Superlatives = (sup.strongest || sup.hardest || sup.easiest || sup.topL4 || sup.topL3) ? (
    <div data-superlatives style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Superlatives</SecHead>
      {sup.strongest && <Superlative label="Strongest sector" value={sup.strongest.name} detail={`${sup.strongest.avg.toFixed(1)}/10 avg`} />}
      {sup.weakest && <Superlative label="Weakest sector" value={sup.weakest.name} detail={`${sup.weakest.avg.toFixed(1)}/10 avg`} />}
      {sup.hardest && <Superlative label="Hardest question" value={`${sup.hardest.title} (${sup.hardest.sector})`} detail={`${Math.round(sup.hardest.rate * 100)}% of ${sup.hardest.asked}`} />}
      {sup.easiest && <Superlative label="Easiest question" value={`${sup.easiest.title} (${sup.easiest.sector})`} detail={`${Math.round(sup.easiest.rate * 100)}% of ${sup.easiest.asked}`} />}
      {sup.topL4 && <Superlative label="Top level 4" value={`${sup.topL4.title} (${sup.topL4.sector})`} detail={`${sup.topL4.yes} ${sup.topL4.yes === 1 ? 'camp' : 'camps'}`} />}
      {sup.topL3 && <Superlative label="Top level 3" value={`${sup.topL3.title} (${sup.topL3.sector})`} detail={`${sup.topL3.yes} ${sup.topL3.yes === 1 ? 'camp' : 'camps'}`} />}
    </div>
  ) : null;

  const Leaderboard = (
    <div data-leaderboard style={{ ...panelStyle, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <SecHead style={{ marginTop: 0 }}>Top Camps</SecHead>
        {/* City digest for pasting into GTCC email/chat — lives up here because
            the top camps are most of what it copies. */}
        <button data-copy-summary type="button" onClick={copySummary} title="Copy a short text summary for sharing"
          style={{ background: 'transparent', color: '#8fd4ae', border: '1px solid #2e5b43',
            borderRadius: 99, padding: '2px 10px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>
          {copied ? 'Copied ✓' : '⧉ Copy Summary'}
        </button>
      </div>
      {agg.leaderboard.map((c, i) => (
        <div key={i} data-rank={i + 1} role="button" tabIndex={0} title="Hover previews on the radius; click opens the Camps tab"
          onClick={() => onCampClick && onCampClick(c.campName)}
          onKeyDown={e => { if (e.key === 'Enter' && onCampClick) onCampClick(c.campName); }}
          onMouseEnter={() => setPeek(c)} onMouseLeave={() => setPeek(null)}
          style={{ ...rowStyle, gap: 10, cursor: 'pointer' }}>
          <span style={{ width: 18, color: '#93a89b', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
          <span aria-hidden="true" title="Camp's green radius shape" style={{ flexShrink: 0, display: 'inline-flex' }}>
            <RadialBadge sectors={sectors} fills={campFills(sectors, c).fills} size={30} dark showLabels={false} showCenter={false}/>
          </span>
          <span style={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.campName} {i === 0 && <span title="Highest score right now" style={{ color: '#e8c15a' }}>★</span>}
            {c.timestamp && c.timestamp >= A.weekStartMs(now) ? <span title="New this week" style={{ color: '#7fc46a', marginLeft: 4 }}>●</span> : null}
          </span>
          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total}/60</b>
        </div>
      ))}
    </div>
  );

  const Standings = (
    <div style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Sector Averages</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0 18px' }}>
        {agg.sectorStandings.map(s => (
          <div key={s.id} style={rowStyle}>
            <span title={s.name} style={{ display: 'inline-flex' }}>
              <SectorIcon kind={(sectors.find(x => x.id === s.id) || {}).icon} size={13} color="#7f988a"/>
            </span>
            <span style={{ flex: 1, color: '#cdebd8' }}>{s.name}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.avg.toFixed(1)}</b>
          </div>
        ))}
      </div>
    </div>
  );

  // The map draws the same rows the aggregates count: deduped winners, hidden
  // rows excluded (computeAggregates does this internally; the map needs the
  // actual row list, so it repeats the two filters here).
  const mapRows = React.useMemo(() => A.dedupeRows(rows.filter(r => !A.isHidden(r))), [rows]);

  // Visit progress: same population and colors as the playa map legend, so
  // "how far through the visits are we?" reads without scrolling to the map.
  const visitCounts = React.useMemo(() => {
    const c = { none: 0, assigned: 0, done: 0 };
    mapRows.forEach(r => { c[A.visitState(r.visit)]++; });
    return c;
  }, [mapRows]);
  const totalCampers = React.useMemo(() =>
    mapRows.reduce((n, r) => n + (+r.campSize || 0), 0), [mapRows]);
  const VisitProgress = mapRows.length > 0 ? (
    <div data-visit-progress style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Visit Progress</SecHead>
      <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: '#1d2c24', margin: '8px 0 7px' }}>
        {visitCounts.done > 0 && <div style={{ flex: visitCounts.done, background: '#45c483' }}/>}
        {visitCounts.assigned > 0 && <div style={{ flex: visitCounts.assigned, background: '#e8c15a' }}/>}
        {visitCounts.none > 0 && <div style={{ flex: visitCounts.none, background: '#2c4234' }}/>}
      </div>
      <div style={{ fontSize: 12, color: '#cdebd8', display: 'flex', flexWrap: 'wrap', gap: '2px 10px' }}>
        <span><b style={{ color: '#45c483' }}>{visitCounts.done}</b> visited</span>
        <span><b style={{ color: '#e8c15a' }}>{visitCounts.assigned}</b> assigned</span>
        <span><b style={{ color: '#93a89b' }}>{visitCounts.none}</b> to visit</span>
      </div>
      {totalCampers > 0 && (
        <div style={{ fontSize: 11, color: '#7f988a', marginTop: 8, borderTop: '1px dashed #21332a', paddingTop: 7 }}>
          These camps represent about <b style={{ color: '#cdebd8' }}>{totalCampers.toLocaleString()}</b> campers.
        </div>
      )}
    </div>
  ) : null;

  // Left column: just the BRC radius box. Right column: the pulse tiles, then
  // Sector Averages (single column, already sorted descending by average) and
  // Top Camps as adjoining columns — together they roughly match the hero's
  // height. Superlatives, the analytics panel, and the playa map span full
  // width underneath. Narrow screens stack everything in the previous order.
  const Grid = wide
    ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 20, paddingTop: 16, alignItems: 'start' }}>
        <div>{Hero}</div>
        <div>
          {Pulse}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(190px, 240px) 1fr', gap: '0 14px', alignItems: 'start' }}><div>{Standings}{VisitProgress}</div>{Leaderboard}</div>
        </div>
      </div>
    : <div style={{ paddingTop: 12 }}>{Hero}{Standings}{VisitProgress}{Pulse}{Leaderboard}</div>;
  return <div>{Grid}{Superlatives}<AnalyticsPanel rows={rows} agg={agg} sectors={sectors} /><PlayaMap rows={mapRows} onCampClick={onCampClick} /></div>;
}

// ── City analytics (score spread, weekly submissions, opportunities) ─────────
// Three small reads of the already-fetched rows, stacked in one panel under
// Superlatives. Same population as the tiles above (activeRows), so the
// current-week bar always equals the "+N this week" tile.
function BarChart({ data, max, highlightLast, barTitle, testId }) {
  // Inline-block bars on a shared baseline; height scales to the busiest bar.
  const H = 56;
  return (
    <div data-chart={testId} style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: H + 30, marginTop: 6 }}>
      {data.map((d, i) => {
        const hot = highlightLast && i === data.length - 1;
        const h = max ? Math.max(d.count ? 3 : 1, Math.round((d.count / max) * H)) : 1;
        return (
          <div key={i} title={barTitle(d)} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 10, color: d.count ? '#cdebd8' : '#42574a', fontVariantNumeric: 'tabular-nums' }}>{d.count || ''}</div>
            <div data-bar style={{ height: h, borderRadius: '3px 3px 0 0', margin: '1px auto 0',
              background: d.count ? (hot ? '#7fc46a' : '#3f7a53') : '#1d2c24' }} />
            <div style={{ fontSize: 8.5, color: hot ? '#7fc46a' : '#5d7367', fontWeight: 700, marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}
function AnalyticsPanel({ rows, agg, sectors }) {
  const hist = React.useMemo(() => A.scoreHistogram(rows), [rows]);
  const weeks = React.useMemo(() => A.weeklyCounts(rows, Date.now()), [rows]);
  const opps = React.useMemo(() => A.opportunities(agg, sectors), [agg, sectors]);
  if (!agg.count) return null;
  const fmtWk = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const weekData = weeks.map(w => ({ ...w, label: fmtWk(w.start) }));
  const weekMax = weeks.reduce((m, w) => Math.max(m, w.count), 0);
  return (
    <div data-analytics style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Score Spread</SecHead>
      <BarChart testId="histogram" data={hist.bins} max={hist.max} highlightLast={false}
        barTitle={d => `${d.count} ${d.count === 1 ? 'camp' : 'camps'} scoring ${d.label}`} />
      <SecHead>Submissions by Week</SecHead>
      <BarChart testId="weekly" data={weekData} max={weekMax} highlightLast
        barTitle={d => `Week of ${fmtWk(d.start)}: ${d.count} ${d.count === 1 ? 'submission' : 'submissions'}`} />
      {opps.length > 0 && (
        <React.Fragment>
          <SecHead>Biggest Opportunities</SecHead>
          <div style={{ fontSize: 11, color: '#7f988a', margin: '-2px 0 4px' }}>
            Lowest city-wide yes rates. Good candidates for GTCC guidance or shared resources.
          </div>
          {opps.map(o => (
            <div key={o.id} data-opportunity style={rowStyle}>
              <span style={{ flex: 1, color: '#eaf2ec', minWidth: 0 }}>{o.title} <span style={{ color: '#7f988a' }}>({o.sector})</span></span>
              <b style={{ fontVariantNumeric: 'tabular-nums', color: '#e8c15a', flexShrink: 0 }}>{Math.round(o.rate * 100)}%</b>
              <span style={{ color: '#7f988a', fontSize: 11, flexShrink: 0 }}>of {o.asked}</span>
            </div>
          ))}
        </React.Fragment>
      )}
    </div>
  );
}

// ── Playa map (visit planning) ───────────────────────────────────────────────
// Pure-SVG Black Rock City fan — ring arcs Esplanade-K spanning 2:00-10:00,
// one pin per camp with a parseable playa address. No map service: a BRC
// address IS a polar coordinate (clock radial × lettered ring), so
// AdminAggregate.parsePlayaAddress/playaXY place pins directly. Pin color
// tracks the owner-typed Visit sheet column (blank / name / ✓ name); pin size
// tracks camp size. Clicking a pin jumps to that camp on the Camps tab.
// Renders nothing until at least one address parses.
const LABEL_FS = 9.5; // camp-name label font size on the playa map
const PIN_STYLE = {
  none: { fill: 'rgba(147,168,155,0.22)', stroke: '#93a89b' },
  assigned: { fill: '#e8c15a', stroke: '#b3923a' },
  done: { fill: '#45c483', stroke: '#2e5b43' },
};
// The assignee filter is uncontrolled by default (the City tab's dropdown);
// the Visits tab passes `assignee` to drive it from its own team picker, which
// also hides the dropdown and the inline route line (the tab's cards own both).
function PlayaMap({ rows, onCampClick, assignee: forced }) {
  const controlled = forced !== undefined;
  const [ownAssignee, setOwnAssignee] = React.useState('');
  const assignee = controlled ? forced : ownAssignee;
  const [tip, setTip] = React.useState(null); // hover tooltip, in viewBox coords
  // Unit space -> px: Man at (CX,CY), Esplanade r=0.40..K r=0.95 times S.
  const S = 330, CX = 360, CY = 180;
  const polar = (hour, r) => {
    const th = (hour / 12) * 2 * Math.PI;
    return { x: CX + r * S * Math.sin(th), y: CY - r * S * Math.cos(th) };
  };

  const camps = React.useMemo(() => rows.map(r => ({
    row: r, addr: A.parsePlayaAddress(r.campLocation),
    state: A.visitState(r.visit), who: A.visitAssignee(r.visit),
  })), [rows]);
  const mapped = camps.filter(c => c.addr);
  const unparsed = camps.filter(c => !c.addr && String(c.row.campLocation || '').trim());
  // Camps with no plottable coordinates (blank address or one that didn't
  // parse) go in the "Open camping" box in the bottom-left corner, outside
  // the city fan, so they still get a pin, a tooltip, and a visit state.
  const openCamps = camps.filter(c => !c.addr);
  const assignees = React.useMemo(() => Array.from(new Set(
    camps.filter(c => c.state !== 'none' && c.who).map(c => c.who))).sort(), [camps]);
  if (!mapped.length) return null;

  // One volunteer selected: their camps get walking-order numbers (a single
  // 2:00->10:00 sweep, see visitOrder) and everyone else's pins dim.
  const mine = assignee ? camps.filter(c => c.who === assignee) : [];
  const ordered = assignee ? A.visitOrder(mine.map(c => c.row)) : [];
  const stopNo = new Map(ordered.map((r, i) => [r, i + 1]));

  const counts = {
    none: mapped.filter(c => c.state === 'none').length,
    assigned: mapped.filter(c => c.state === 'assigned').length,
    done: mapped.filter(c => c.state === 'done').length,
  };

  // One pin, used both on the fan and in the Open camping box. Hover shows
  // the custom tooltip (instant, styled — the native <title> delay made pins
  // feel dead); click jumps to the camp on the Camps tab. The optional label
  // (fan pins only) rides inside the same <g>, so it dims, clicks, and
  // tooltips exactly like its pin.
  const renderPin = (c, x, y, key, label) => {
    const size = +c.row.campSize || 0;
    const pr = Math.max(4, Math.min(10, 4 + Math.sqrt(size) * 0.35));
    const dimmed = assignee && c.who !== assignee;
    const n = stopNo.get(c.row);
    const stateText = c.state === 'none' ? 'needs visit' : (c.state === 'done' ? 'visited' : `assigned: ${c.who}`);
    const loc = c.addr ? c.row.campLocation
      : (String(c.row.campLocation || '').trim() ? `"${c.row.campLocation}" (didn't parse)` : 'no address');
    return (
      <g key={key} data-pin data-visit-state={c.state} opacity={dimmed ? 0.22 : 1}
        role="img" aria-label={`${c.row.campName} · ${loc} · ${c.row.total}/60 · ${stateText}`}
        style={{ cursor: 'pointer' }} onClick={() => onCampClick && onCampClick(c.row.campName)}
        onMouseEnter={() => setTip({ x, y: y - pr - 3, name: c.row.campName, loc, score: `${c.row.total}/60`, state: stateText })}
        onMouseLeave={() => setTip(null)}>
        <circle cx={x} cy={y} r={pr} fill={PIN_STYLE[c.state].fill}
          stroke={PIN_STYLE[c.state].stroke} strokeWidth="1.5"/>
        {n && <text x={x} y={y - pr - 4} textAnchor="middle" fontSize="11"
          fontWeight="800" fill="#eaf2ec">{n}</text>}
        {label && <text data-pin-label x={label.x} y={label.y} textAnchor={label.anchor}
          dominantBaseline="middle" fontSize={LABEL_FS} fontWeight="600" fill="#a9bfb1"
          style={{ paintOrder: 'stroke', stroke: '#101c15', strokeWidth: 2.5, strokeLinejoin: 'round' }}>
          {label.text}
        </text>}
      </g>
    );
  };

  // Open camping box geometry: anchored to the bottom-left corner (free space
  // outside the 2:00-10:00 fan), grows upward if the pins need more rows.
  const OC = { cols: 5, gap: 26, x: 12 };
  const ocRows = Math.ceil(openCamps.length / OC.cols);
  const ocW = Math.max(122, 24 + Math.min(openCamps.length, OC.cols) * OC.gap);
  const ocH = 24 + ocRows * OC.gap + 4;
  const ocY = 526 - ocH;

  // Camp-name labels, greedy no-overlap placement: each fan pin tries a ring
  // of candidate spots (right, left, below, then the diagonals — straight
  // above is reserved for the walking-order numbers) and takes the first one
  // that stays on the canvas and clears every pin, every placed label, and
  // the Open camping box. A pin too crowded to label keeps its name in the
  // hover tooltip. Width is estimated (no DOM measuring in SVG pre-render);
  // the 0.62em/char heuristic is generous for Space Grotesk at this size.
  const fanPins = mapped.map(c => {
    const p = polar(c.addr.hour, A.playaRingRadius(c.addr.ring));
    const size = +c.row.campSize || 0;
    return { c, x: p.x, y: p.y, pr: Math.max(4, Math.min(10, 4 + Math.sqrt(size) * 0.35)) };
  });
  const labels = (() => {
    const obstacles = fanPins.map(p => ({ x0: p.x - p.pr - 1, y0: p.y - p.pr - 1, x1: p.x + p.pr + 1, y1: p.y + p.pr + 1 }));
    if (openCamps.length > 0) obstacles.push({ x0: OC.x, y0: ocY, x1: OC.x + ocW, y1: 526 });
    const hits = (r) => obstacles.some(o => r.x0 < o.x1 && r.x1 > o.x0 && r.y0 < o.y1 && r.y1 > o.y0);
    return fanPins.map(p => {
      const text = p.c.row.campName.length > 18 ? p.c.row.campName.slice(0, 17) + '…' : p.c.row.campName;
      const w = text.length * LABEL_FS * 0.62 + 4, h = LABEL_FS + 2;
      // Two rings of candidates: snug first, then a farther ring so camps in
      // a tight cluster can still push their label into nearby clear space.
      const ring = (d) => [
        { dx: p.pr + d, dy: 0, anchor: 'start' },
        { dx: -(p.pr + d), dy: 0, anchor: 'end' },
        { dx: 0, dy: p.pr + d + 5, anchor: 'middle' },
        { dx: p.pr + d - 1, dy: -(p.pr + d), anchor: 'start' },
        { dx: p.pr + d - 1, dy: p.pr + d, anchor: 'start' },
        { dx: -(p.pr + d - 1), dy: -(p.pr + d), anchor: 'end' },
        { dx: -(p.pr + d - 1), dy: p.pr + d, anchor: 'end' },
      ];
      const cands = [...ring(4), ...ring(14)];
      for (const cd of cands) {
        const x = p.x + cd.dx, y = p.y + cd.dy;
        const x0 = cd.anchor === 'start' ? x : (cd.anchor === 'end' ? x - w : x - w / 2);
        const rect = { x0, y0: y - h / 2, x1: x0 + w, y1: y + h / 2 };
        if (rect.x0 < 2 || rect.x1 > 718 || rect.y0 < 2 || rect.y1 > 530) continue;
        if (hits(rect)) continue;
        obstacles.push(rect);
        return { x, y, anchor: cd.anchor, text };
      }
      return null;
    });
  })();
  const legendDot = (state, label) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#93a89b' }}>
      <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={PIN_STYLE[state].fill} stroke={PIN_STYLE[state].stroke}/></svg>
      {label}
    </span>
  );

  return (
    <div data-playa-map style={{ ...panelStyle, marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <SecHead style={{ margin: 0 }}>Playa Map</SecHead>
        <span style={{ fontSize: 11, color: '#93a89b' }}>{mapped.length} of {camps.length} camps mapped</span>
        <div style={{ flex: 1 }} />
        {legendDot('none', `needs visit (${counts.none})`)}
        {legendDot('assigned', `assigned (${counts.assigned})`)}
        {legendDot('done', `visited (${counts.done})`)}
        {!controlled && assignees.length > 0 && (
          <select data-assignee value={assignee} onChange={e => setOwnAssignee(e.target.value)}
            title="Show one volunteer's visit route" style={selStyle}>
            <option value="">All volunteers</option>
            {assignees.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>
      <div style={{ position: 'relative' }}>
      <svg viewBox="0 0 720 532" style={{ width: '100%', height: 'auto', display: 'block', marginTop: 6 }}
        role="img" aria-label="Map of camps across the Black Rock City street grid">
        {/* radial streets: whole hours solid, half hours fainter */}
        {Array.from({ length: 17 }, (_, i) => 2 + i * 0.5).map(h => {
          const a = polar(h, 0.40), b = polar(h, 0.95);
          return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={h % 1 ? '#1a281f' : '#26382e'} strokeWidth="1"/>;
        })}
        {/* ring arcs, Esplanade (0) through K (11), 2:00 -> 10:00 via 6:00 */}
        {Array.from({ length: 12 }, (_, ring) => {
          const r = A.playaRingRadius(ring) * S;
          const a = polar(2, A.playaRingRadius(ring)), b = polar(10, A.playaRingRadius(ring));
          return <path key={ring} d={`M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`}
            fill="none" stroke={ring === 0 ? '#2e4436' : '#26382e'} strokeWidth="1"/>;
        })}
        {/* street labels: clock hours outside the fan, ring letters down 6:00 */}
        {Array.from({ length: 9 }, (_, i) => 2 + i).map(h => {
          const p = polar(h, 1.015);
          return <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="11" fill="#5d7367" fontWeight="700">{h}:00</text>;
        })}
        {Array.from({ length: 12 }, (_, ring) => (
          <text key={ring} x={CX + 6} y={CY + A.playaRingRadius(ring) * S - 3}
            fontSize="9" fill="#42574a" fontWeight="700">{ring === 0 ? 'ESP' : 'ABCDEFGHIJK'[ring - 1]}</text>
        ))}
        <circle cx={CX} cy={CY} r="3.5" fill="#d9885c"><title>The Man</title></circle>
        {/* Open camping: camps with no plottable address, pinned in a dashed
            box in the free corner so they keep visit-state color and clicks. */}
        {openCamps.length > 0 && (
          <g data-open-camping>
            <rect x={OC.x} y={ocY} width={ocW} height={ocH} rx="10"
              fill="rgba(147,168,155,0.05)" stroke="#26382e" strokeDasharray="4 3"/>
            <text x={OC.x + 12} y={ocY + 15} fontSize="9" letterSpacing="1.5"
              fill="#5d7367" fontWeight="700">OPEN CAMPING</text>
            {openCamps.map((c, i) => renderPin(c,
              OC.x + 24 + (i % OC.cols) * OC.gap,
              ocY + 24 + Math.floor(i / OC.cols) * OC.gap + OC.gap / 2 - 2,
              `open-${i}`))}
          </g>
        )}
        {/* camp pins — drawn last so they sit above the grid lines */}
        {fanPins.map((p, i) => renderPin(p.c, p.x, p.y, i, labels[i]))}
      </svg>
      {tip && (
        <div data-map-tip style={{
          position: 'absolute', left: `${tip.x / 7.2}%`, top: `${tip.y / 5.32}%`,
          transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 5,
          background: '#0b1410', border: '1px solid #2e5b43', borderRadius: 8,
          padding: '6px 10px', fontSize: 12, lineHeight: 1.45, color: '#eaf2ec',
          whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
        }}>
          <b>{tip.name}</b> <span style={{ color: '#93a89b' }}>{tip.score}</span>
          <div style={{ color: '#93a89b' }}>{tip.loc}</div>
          <div style={{ color: '#8fd4ae' }}>{tip.state}</div>
        </div>
      )}
      </div>
      {!controlled && assignee && ordered.length > 0 && (
        <div data-route style={{ fontSize: 12.5, color: '#cdebd8', marginTop: 8 }}>
          <b style={{ color: '#eaf2ec' }}>{assignee}'s route:</b>{' '}
          {ordered.map((r, i) => (
            <span key={i} style={{ whiteSpace: 'nowrap', marginRight: 10 }}>
              <b style={{ color: '#7fc46a' }}>{i + 1}.</b> {r.campName}
              <span style={{ color: '#93a89b' }}>{r.campLocation ? ` (${r.campLocation})` : ' (no address)'}</span>
              {A.visitState(r.visit) === 'done' ? ' ✓' : ''}
            </span>
          ))}
        </div>
      )}
      {unparsed.length > 0 && (
        <div data-unmapped style={{ fontSize: 11, color: '#93a89b', marginTop: 8, lineHeight: 1.5 }}>
          In Open camping because the address didn't parse:{' '}
          {unparsed.map((c, i) => (
            <span key={i}>{i > 0 && ' · '}{c.row.campName} <i>("{c.row.campLocation}" — fix the sheet cell)</i></span>
          ))}
        </div>
      )}
    </div>
  );
}
const SecHead = ({ children, style }) => <div style={{ fontSize: 14, letterSpacing: '.16em', color: '#93a89b', fontWeight: 800, margin: '16px 0 6px', ...style }}>{String(children).toUpperCase()}</div>;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed #21332a', fontSize: 13 };

// ── Visits: phone-first field view for the visit teams ───────────────────────
// A volunteer opens /admin/ on their phone, picks their team label once
// (remembered per device), and gets their camps in walking order with talking
// points, plus the playa map narrowed to their route. Read-only in this round:
// assignment and mark-done both live in the sheet's Visit column
// (docs/admin-setup.md sections 6-7). The team labels are whatever the owner
// types into that column; teams of 2-3 share one label.
const TEAM_KEY = 'grg-admin-visit-team/v1';
// Stable identity for one row across a reload: campId when the row has one
// (rides inside the answers blob, same field dedupeInfo keys on), else the
// camp name — matches the /api/admin/visit contract's { campId, campName }.
function visitRowKey(r) {
  const cid = r.answers && r.answers.campId;
  return (typeof cid === 'string' && cid.trim()) ? cid.trim() : r.campName;
}
function VisitsView({ sectors, rows, onCampClick, reload }) {
  // Same population as the City tab's map and tallies: deduped winners,
  // hidden rows excluded.
  const mapRows = React.useMemo(() => A.dedupeRows(rows.filter(r => !A.isHidden(r))), [rows]);
  const teams = React.useMemo(() => Array.from(new Set(
    mapRows.map(r => A.visitAssignee(r.visit)).filter(Boolean))).sort(), [mapRows]);
  const [team, setTeam] = React.useState(() => { try { return localStorage.getItem(TEAM_KEY) || ''; } catch { return ''; } });
  const [other, setOther] = React.useState('');
  const pick = (t) => { setTeam(t); try { localStorage.setItem(TEAM_KEY, t); } catch {} };
  // Mark-visited write path: which card's confirm row is open (one at a
  // time), which key is mid-save, which key just failed, and the set of
  // rows flipped to done locally so the card updates instantly instead of
  // waiting on the next sheet reload. An optimistic flag is never cleared
  // by an incoming reload that still says pending (Apps Script lag) — only
  // fresh data that itself says done makes it redundant.
  const [confirmKey, setConfirmKey] = React.useState(null);
  const [savingKey, setSavingKey] = React.useState(null);
  const [errorKey, setErrorKey] = React.useState(null);
  const [optimisticDone, setOptimisticDone] = React.useState(() => new Set());
  const markVisited = async (r, key) => {
    setSavingKey(key);
    try {
      const res = await fetch('/api/admin/visit', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ campId: (r.answers && r.answers.campId) || '', campName: r.campName, year: r.year, team }),
      });
      let data = null;
      try { data = await res.json(); } catch {}
      if (res.ok && data && data.ok) {
        setOptimisticDone(s => { const next = new Set(s); next.add(key); return next; });
        setConfirmKey(null);
        setErrorKey(null);
        reload && reload();
      } else {
        setConfirmKey(null);
        setErrorKey(key);
      }
    } catch {
      setConfirmKey(null);
      setErrorKey(key);
    } finally {
      setSavingKey(null);
    }
  };
  const mine = React.useMemo(() => team
    ? A.visitOrder(mapRows.filter(r => A.visitAssignee(r.visit) === team)) : [], [mapRows, team]);
  const doneCount = mine.filter(r => A.visitState(r.visit) === 'done' || optimisticDone.has(visitRowKey(r))).length;
  const unassigned = mapRows.filter(r => A.visitState(r.visit) === 'none').length;
  // A remembered label that no longer appears in the sheet still renders as a
  // chip (active), so the volunteer sees their pick instead of a mystery blank.
  const chipList = team && !teams.includes(team) ? [...teams, team] : teams;
  // Talking points: the camp's two weakest sectors by greens tally. Legacy
  // rows kept their 0-4 scale, so the denominator follows the row.
  const denomOf = (r) => A.isLegacy(r) ? 4 : 10;
  const weakest = (r) => sectors
    .map(s => ({ name: s.name, v: +((r.greens || {})[s.id]) || 0 }))
    .sort((a, b) => a.v - b.v).slice(0, 2);

  return (
    <div style={{ paddingTop: 12, maxWidth: 560, margin: '0 auto' }}>
      <div data-team-picker style={panelStyle}>
        <SecHead style={{ marginTop: 0 }}>{team ? 'Your team' : 'Which team are you?'}</SecHead>
        {chipList.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {chipList.map(t => {
              const active = t === team;
              return (
                <button key={t} data-team={t} type="button" onClick={() => pick(t)}
                  style={{ fontWeight: 700, fontSize: 13, padding: '8px 14px', borderRadius: 99, cursor: 'pointer',
                    border: `2px solid ${active ? '#a8842e' : '#26382e'}`,
                    background: active ? 'linear-gradient(135deg,#6b4f14,#8a6a1e)' : 'transparent',
                    color: active ? '#fbf3df' : '#c9ad6b' }}>
                  {t}
                </button>
              );
            })}
          </div>
        )}
        {teams.length === 0 && (
          <div style={{ fontSize: 12.5, color: '#93a89b', marginTop: 6, lineHeight: 1.5 }}>
            No teams assigned yet. Type a team label into the sheet's Visit column
            to build routes (docs/admin-setup.md, section 6).
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); const v = other.trim(); if (v) { pick(v); setOther(''); } }}
          style={{ marginTop: 10 }}>
          <input data-team-other value={other} onChange={e => setOther(e.target.value)}
            placeholder="or type your team label" aria-label="Type your team label"
            style={{ ...selStyle, borderRadius: 8, padding: '7px 10px', width: 180 }} />
        </form>
        <div data-visit-summary style={{ fontSize: 12, color: '#7f988a', marginTop: 10, borderTop: '1px dashed #21332a', paddingTop: 7 }}>
          {team && <span><b style={{ color: '#cdebd8' }}>{doneCount}</b> of <b style={{ color: '#cdebd8' }}>{mine.length}</b> on your route visited · </span>}
          Unassigned city-wide: <b style={{ color: unassigned ? '#e8c15a' : '#cdebd8' }}>{unassigned}</b> {unassigned === 1 ? 'camp' : 'camps'}
        </div>
      </div>

      {team && mine.length === 0 && (
        <div style={{ ...panelStyle, marginTop: 10, fontSize: 13, color: '#93a89b' }}>
          No camps assigned to <b style={{ color: '#eaf2ec' }}>{team}</b> yet.
        </div>
      )}
      {mine.map((r, i) => {
        const key = visitRowKey(r);
        const done = A.visitState(r.visit) === 'done' || optimisticDone.has(key);
        const wk = weakest(r);
        const saving = savingKey === key;
        return (
          <div key={i} data-visit-card style={{ ...panelStyle, marginTop: 10,
            borderLeft: `3px solid ${done ? '#45c483' : '#e8c15a'}`, opacity: done ? 0.72 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <b style={{ color: '#7fc46a', fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{i + 1}.</b>
              <b style={{ fontSize: 15, flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{r.campName}</b>
              <b style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{r.total}/60</b>
            </div>
            <div style={{ fontSize: 12.5, color: '#cdebd8', marginTop: 3 }}>
              {String(r.campLocation || '').trim() || 'no address, see the Open camping box on the map'}
              {+r.campSize > 0 && <span style={{ color: '#93a89b' }}> · about {r.campSize} campers</span>}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 5, color: done ? '#45c483' : '#e8c15a' }}>
              {done ? '✓ visited' : 'not visited yet'}
            </div>
            {!done && (
              confirmKey === key ? (
                <div data-confirm-visit style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #21332a' }}>
                  <div style={{ fontSize: 12.5, color: '#eaf2ec', marginBottom: 7 }}>Mark {r.campName} visited?</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button data-confirm-yes type="button" disabled={saving} onClick={() => markVisited(r, key)}
                      style={{ ...btnStyle, flex: 1, minHeight: 44, fontSize: 13,
                        opacity: saving ? 0.7 : 1, cursor: saving ? 'wait' : 'pointer' }}>
                      {saving ? 'Saving…' : 'Yes, visited'}
                    </button>
                    <button data-confirm-no type="button" disabled={saving} onClick={() => setConfirmKey(null)}
                      style={{ flex: 1, minHeight: 44, fontSize: 13, fontWeight: 700, borderRadius: 8,
                        background: 'transparent', color: '#93a89b', border: '1px solid #26382e',
                        cursor: saving ? 'wait' : 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button data-mark-visited type="button" onClick={() => { setConfirmKey(key); setErrorKey(null); }}
                  style={{ ...btnStyle, marginTop: 8, width: '100%', minHeight: 44, fontSize: 13 }}>
                  Mark visited
                </button>
              )
            )}
            {errorKey === key && (
              <div data-visit-error style={{ color: '#e8c15a', fontSize: 12, marginTop: 6 }}>
                Didn't save. Check signal and try again.
              </div>
            )}
            {!done && wk.length > 0 && (
              <div data-talking-points style={{ fontSize: 12, color: '#7f988a', marginTop: 6, borderTop: '1px dashed #21332a', paddingTop: 6 }}>
                Talking points: {wk.map((s, j) => (
                  <span key={j}>{j > 0 && ' · '}<b style={{ color: '#cdebd8' }}>{s.name}</b> {s.v}/{denomOf(r)}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <PlayaMap rows={mapRows} onCampClick={onCampClick} assignee={team} />
    </div>
  );
}

// ── Camps: full-width scannable rows ─────────────────────────────────────────
// Every row shows everything — identity, submitted date/time, all six sector
// scores with per-question fill bars, Level-4 picks and the camp's write-in —
// no click-to-reveal. Desktop-first: sectors align as columns across rows so
// the eye can scan one sector down the whole list.

// Wrap case-insensitive matches of the search query in a highlight mark so
// the eye lands on WHY a row matched (name, lead, email, or an idea note).
function Hi({ text, q }) {
  const t = String(text == null ? '' : text);
  if (!q || !t) return t;
  const lt = t.toLowerCase(), lq = q.toLowerCase();
  const parts = [];
  let i = 0, j;
  while ((j = lt.indexOf(lq, i)) !== -1) {
    if (j > i) parts.push(t.slice(i, j));
    parts.push(
      <mark key={j} style={{ background: '#e8c15a', color: '#06140c', borderRadius: 3, padding: '0 1px' }}>
        {t.slice(j, j + q.length)}
      </mark>
    );
    i = j + q.length;
  }
  if (!parts.length) return t;
  parts.push(t.slice(i));
  return parts;
}

// Small pill badge, shared by CampRow and CampDetail. Tones: neutral gray
// (source/legacy/hidden/dedup tags), amber heads-up ("possible dup", assigned
// visits — same warm tone as the refresh-error banner), green win ("visited",
// matching the idea-chip green).
const BADGE_TONES = {
  gray: { color: '#93a89b', border: '1px solid #26382e' },
  amber: { color: '#e8c15a', border: '1px solid #573a26', background: '#2a1c14' },
  green: { color: '#8fd4ae', border: '1px solid #2e5b43', background: '#15291e' },
};
function Badge({ text, title, tone = 'gray' }) {
  return (
    <span title={title} style={{ ...BADGE_TONES[tone], fontSize: 9, borderRadius: 99,
      padding: '1px 6px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{text}</span>
  );
}

function fmtWhen(ts) {
  if (!ts) return 'date unknown';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

// Whether a row carries real per-question yes/no data (an `X-camp-note` string
// alone must not count — same rule as aggregate.js's rowsWithAnswers).
function rowHasAnswers(camp) {
  return !!camp.answers && Object.keys(camp.answers).some(k =>
    camp.answers[k] === 'yes' || camp.answers[k] === 'no');
}

// Level-4 material per sector: chosen advanced topics + the write-in idea.
// The write-in topic ("Our Camp's Idea", id `X-camp`) may carry the camp's own
// text as an `X-camp-note` entry; it renders as a quoted idea (with its ✓/✕)
// instead of an anonymous title in the picks list. The Worker's sheetCell
// guard bakes a leading ' into notes starting with a formula trigger
// (= + - @); strip it so the camp's words render verbatim.
function campL4(sectors, camp) {
  if (!rowHasAnswers(camp)) return [];
  return sectors.map(s => {
    // All write-in slots, not just the base one: campIdeaIds (src/core.jsx)
    // covers the synthetic X-camp-2/3/4 ids the form adds on demand, which
    // live only in the answers map, never in tier4Topics.
    const ideas = campIdeaIds(s).map(id => {
      const noteVal = camp.answers[id + '-note'];
      const note = (typeof noteVal === 'string' ? noteVal.trim() : '').replace(/^'(?=[=+\-@\t\r])/, '');
      return note ? { id, note, yes: camp.answers[id] === 'yes' } : null;
    }).filter(Boolean);
    const noted = new Set(ideas.map(i => i.id));
    const picks = (s.tier4Topics || [])
      .filter(t => camp.answers[t.id] === 'yes' && !noted.has(t.id))
      .map(t => t.title);
    return { id: s.id, name: s.name, picks, ideas };
  }).filter(x => x.picks.length || x.ideas.length);
}

// One sector's four levels as yes-count digits in the ramp colors (dense
// text, no bars). The per-question detail lives in tooltips: an L1-3 digit
// lists that level's questions with ✓/✕; the L4 digit lists the answered
// advanced topics. Zero digits dim into the background.
function SectorDigits({ sector, fill, answers, hasAnswers, legacy }) {
  const counts = fill.levels.map(lvl => lvl.filter(Boolean).length);
  const titleFor = (li) => {
    if (!hasAnswers && !legacy) return 'approximate (no per-question data)';
    if (legacy) return `Level ${li + 1} ${counts[li] ? 'lit' : 'unlit'} (old 0-4 scale)`;
    if (li < 3) return (sector.levels[li] || [])
      .map(q => `${answers[q.id] === 'yes' ? '✓' : '✕'} ${q.prompt || q.title || q.id}`).join('\n');
    const lines = (sector.tier4Topics || [])
      .filter(t => answers[t.id] === 'yes' || answers[t.id] === 'no')
      .map(t => `${answers[t.id] === 'yes' ? '✓' : '✕'} ${t.title}`);
    return lines.join('\n') || 'no advanced picks';
  };
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, fontVariantNumeric: 'tabular-nums',
      opacity: hasAnswers || legacy ? 1 : 0.45, cursor: 'default' }}>
      {[0, 1, 2, 3].map(li => (
        <React.Fragment key={li}>
          {li > 0 && <span style={{ color: '#2a3d31' }}>·</span>}
          <span title={titleFor(li)} style={{ color: counts[li] ? LEVEL_COLORS[li] : '#2a3d31' }}>
            {counts[li]}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

function CampRow({ sectors, camp, wide, hi, dupCount, superseded, suspect }) {
  const hidden = !!camp.hidden;
  const { hasAnswers, legacy, fills, denom } = campFills(sectors, camp);
  const l4 = campL4(sectors, camp);

  const badge = (text, title) => <Badge text={text} title={title} />;
  const Identity = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
      {/* 44px radius thumbnail: round vs lopsided camps read at a glance */}
      <div data-mini-badge aria-hidden="true" title="Camp's green radius shape" style={{ flexShrink: 0 }}>
        <RadialBadge sectors={sectors} fills={fills} size={44} dark showLabels={false} showCenter={false}/>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><Hi text={camp.campName} q={hi}/></span>
          {camp.timestamp && camp.timestamp >= A.weekStartMs(Date.now()) ?
            <span title="New this week" style={{ color: '#7fc46a' }}>●</span> : null}
          {badge(camp.source, camp.source === 'board' ? 'Answered on the in-person board kiosk' : 'Answered via the public web form')}
          {legacy && badge('old scale', 'Submitted on the legacy 0-4 scale, shown here as an approximation')}
          {hidden && badge('hidden', 'Owner-flagged as junk or test data; excluded from every aggregate')}
          {superseded && badge('superseded', 'replaced by a newer submission from this camp')}
          {!superseded && dupCount > 1 && badge(`x${dupCount}`, `${dupCount} submissions, stats use this latest one`)}
          {suspect && <Badge tone="amber" text="possible dup" title="same contact email as another camp this year" />}
          {A.visitState(camp.visit) === 'assigned' &&
            <Badge tone="amber" text={`visit: ${A.visitAssignee(camp.visit) || 'assigned'}`} title="Assigned a camp visit (owner-typed Visit column)" />}
          {A.visitState(camp.visit) === 'done' &&
            <Badge tone="green" text="visited ✓" title="Camp visit completed (owner-typed Visit column)" />}
        </div>
        {(camp.campLocation || camp.campSize) && (
          <div data-loc style={{ fontSize: 11.5, color: '#93a89b', marginTop: 2, overflowWrap: 'anywhere' }}>
            {[camp.campLocation, camp.campSize && `${camp.campSize} campers`].filter(Boolean).join(' · ')}
          </div>
        )}
        <div style={{ fontSize: 11.5, color: '#93a89b', marginTop: 2, overflowWrap: 'anywhere' }}>
          <Hi text={camp.leadName} q={hi}/><br/>
          <a data-email href={`mailto:${camp.email}`} style={{ color: '#8fd4ae', textDecoration: 'none' }}><Hi text={camp.email} q={hi}/></a>
        </div>
        <div data-submitted style={{ fontSize: 11, color: '#7f988a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
          {fmtWhen(camp.timestamp)}
        </div>
      </div>
    </div>
  );
  const SectorCells = sectors.map(s => {
    const n = (camp.greens && camp.greens[s.id]) || 0;
    return (
      <div key={s.id} data-sector-cell title={s.name} style={{ textAlign: 'center', alignSelf: 'center' }}>
        <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
          <SectorIcon kind={s.icon} size={13} color="#7f988a"/>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: n === denom ? '#e8c15a' : '#eaf2ec', marginBottom: 2 }}>
          {n}<span style={{ color: '#5d7367', fontWeight: 600 }}>/{denom}</span>
        </div>
        <SectorDigits sector={s} fill={fills[s.id]} answers={camp.answers || {}} hasAnswers={hasAnswers} legacy={legacy} />
      </div>
    );
  });
  const Total = (
    <div style={{ textAlign: 'right', alignSelf: 'center' }}>
      <div style={{ fontVariantNumeric: 'tabular-nums' }}>
        <b style={{ fontSize: 19, color: '#fff' }}>{camp.total}</b>
        <span style={{ color: '#5d7367', fontSize: 12 }}>/{legacy ? 24 : 60}</span>
      </div>
      {camp.resultUrl && (
        <a data-result href={camp.resultUrl} target="_blank" rel="noreferrer" title="Open this camp's shareable result page"
          style={{ fontSize: 11, color: '#8fd4ae', textDecoration: 'none' }}>result ↗</a>
      )}
    </div>
  );
  // Only the write-in ideas surface on the row (the camp's own words are the
  // interesting part); chosen topic titles live in the L4 digit tooltip + CSV.
  const ideas = l4.flatMap(x => x.ideas.map(i => ({ ...i, name: x.name })));
  const IdeasLine = ideas.length > 0 && (
    <div style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
      borderTop: '1px dashed #1d2c24', paddingTop: 5, marginTop: 2 }}>
      <span style={{ color: '#45c483', fontWeight: 800, fontSize: 9.5, letterSpacing: '.12em' }}>IDEAS</span>
      {ideas.map(i => (
        <span key={i.id} data-camp-note style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, fontStyle: 'italic',
          border: '1px solid ' + (i.yes ? '#2e5b43' : '#26382e'),
          background: i.yes ? '#15291e' : 'transparent',
          color: i.yes ? '#8fd4ae' : '#93a89b' }}>
          {i.yes ? '✓' : '✕'} {i.name} · “<Hi text={i.note} q={hi}/>”
        </span>
      ))}
    </div>
  );

  // content-visibility lets the browser skip layout/paint for offscreen rows —
  // keeps a long list smooth without windowing machinery. Hidden (owner-flagged
  // junk/test) rows stay visible here for audit but dim, same pattern as the
  // status/loading dim elsewhere in this file.
  // Hidden rows dim the most (owner-flagged junk); superseded rows dim less
  // (0.72 vs 0.5) so the two read as distinct states rather than the same greyed-out treatment.
  const rowBase = { borderBottom: '1px solid #1a281f', padding: '8px 12px',
    contentVisibility: 'auto', containIntrinsicSize: 'auto 84px', opacity: hidden ? 0.5 : (superseded ? 0.72 : 1) };
  return wide ? (
    <div data-camp-row style={{ ...rowBase, display: 'grid', alignItems: 'center', columnGap: 10,
      gridTemplateColumns: 'minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px' }}>
      {Identity}{SectorCells}{Total}{IdeasLine}
    </div>
  ) : (
    <div data-camp-row style={rowBase}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{Identity}</div>{Total}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '7px 6px', marginTop: 6 }}>
        {SectorCells}
      </div>
      {IdeasLine && <div style={{ display: 'grid' }}>{IdeasLine}</div>}
    </div>
  );
}

// At 100+ camps a keystroke or sort click used to re-render every row's
// ~80-node badge SVG (measured: ~100ms main-thread blocks at ~370 rows).
// memo skips rows whose props didn't change — sorting then only reorders
// keyed children and filtering only unmounts; CampRow's props are all
// stable per row (sectors/camp identities, wide).
const MemoCampRow = React.memo(CampRow);

// CSV of the currently filtered/sorted list — everything a row shows, one line
// per camp. Cells starting with a formula trigger get the same ' guard the
// sheet uses (the export will be opened in Excel/Sheets).
function csvEscape(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(list, sectors) {
  const head = ['Submitted', 'Camp', 'Lead', 'Email', 'Source', 'Year', 'Scale',
    ...sectors.map(s => s.name), 'Total', 'Level 4', 'Result URL', 'Schema'];
  const lines = [head].concat(list.map(r => {
    const legacy = A.isLegacy(r);
    const l4 = campL4(sectors, r)
      .map(x => `${x.name}: ${x.picks.concat(x.ideas.map(i => `"${i.note}" (${i.yes ? 'yes' : 'no'})`)).join('; ')}`)
      .join(' | ');
    return [r.timestamp ? new Date(r.timestamp).toISOString() : '', r.campName, r.leadName, r.email,
      r.source, r.year, legacy ? '0-4 (old)' : '0-10',
      ...sectors.map(s => (r.greens && r.greens[s.id]) || 0), r.total, l4, r.resultUrl, r.schemaVersion];
  })).map(row => row.map(csvEscape).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + lines], { type: 'text/csv' }));
  a.download = 'green-radius-camps.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ── Camp detail modal ────────────────────────────────────────────────────────
// Focused view of one camp, opened by clicking its row: the full badge plus
// every question spelled out with its ✓/✕ (the row only fits digits with
// tooltips). Same fill precedence and modal a11y (useModalA11y, src/core.jsx)
// as the rest of the app; legacy/approx rows explain themselves instead of
// inventing per-question detail.
function CampDetail({ sectors, camp, onClose, dupCount, superseded }) {
  const { hasAnswers, legacy, fills, denom } = campFills(sectors, camp);
  const l4 = campL4(sectors, camp);
  const dialogRef = React.useRef(null);
  const closeRef = React.useRef(null);
  useModalA11y(dialogRef);
  React.useEffect(() => { if (closeRef.current) closeRef.current.focus(); }, []);
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mark = (yes, li) => (
    <span aria-hidden="true" style={{ color: yes ? LEVEL_COLORS[li] : '#5d7367', fontWeight: 700, flexShrink: 0 }}>{yes ? '✓' : '✕'}</span>
  );

  return (
    <div data-camp-detail onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(4,10,7,0.6)', backdropFilter: 'blur(5px)',
        display: 'flex', padding: 16 }}>
      {/* Non-scrolling positioning wrapper: it carries the dialog role and the
          focus trap so the corner-pinned ✕ stays inside both, and the card
          scrolls INSIDE it — an absolute ✕ on the scroller itself would ride
          the content out of view on small screens. */}
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${camp.campName} details`}
        onClick={e => e.stopPropagation()}
        style={{ position: 'relative', margin: 'auto', maxWidth: 880, width: '100%' }}>
        <div style={{ background: '#111d16', border: '1px solid #26382e', color: '#eaf2ec', borderRadius: 20,
          padding: '14px 16px', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
          boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', paddingRight: 30 }}>
          <RadialBadge sectors={sectors} fills={fills} size={112} dark />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{camp.campName}</span>
              {superseded && <Badge text="superseded" title="replaced by a newer submission from this camp" />}
              {!superseded && dupCount > 1 && <Badge text={`x${dupCount}`} title={`${dupCount} submissions, stats use this latest one`} />}
            </div>
            <div style={{ fontSize: 12.5, color: '#93a89b', marginTop: 3, overflowWrap: 'anywhere' }}>
              {camp.leadName} · <a href={`mailto:${camp.email}`} style={{ color: '#8fd4ae' }}>{camp.email}</a>
            </div>
            <div style={{ fontSize: 12, color: '#7f988a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {fmtWhen(camp.timestamp)} · {camp.source}{camp.year ? ` · ${camp.year}` : ''}
              {legacy ? ' · old 0-4 scale' : ''}{camp.hidden ? ' · flagged hidden' : ''}
              {A.visitState(camp.visit) === 'assigned' ? ` · visit: ${A.visitAssignee(camp.visit) || 'assigned'}` : ''}
              {A.visitState(camp.visit) === 'done' ? ' · visited ✓' : ''}
            </div>
            <div style={{ marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>
              <b style={{ fontSize: 26, color: '#fff' }}>{camp.total}</b>
              <span style={{ color: '#5d7367', fontSize: 14 }}>/{legacy ? 24 : 60}</span>
              {camp.resultUrl && (
                <a href={camp.resultUrl} target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: '#8fd4ae', textDecoration: 'none', marginLeft: 10 }}>result page ↗</a>
              )}
            </div>
          </div>
        </div>
        {!hasAnswers && (
          <div style={{ fontSize: 12, color: '#93a89b', marginTop: 12 }}>
            {legacy ? 'Submitted on the legacy 0-4 scale; per-question detail is not available.'
              : 'No per-question data for this row; the badge is an approximation from sector totals.'}
          </div>
        )}
        {hasAnswers && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(236px, 1fr))', gap: 10, marginTop: 12 }}>
            {sectors.map(s => {
              const sl4 = l4.find(x => x.id === s.id);
              const noted = new Set(sl4 ? sl4.ideas.map(i => i.id) : []);
              return (
                <div key={s.id} style={{ ...panelStyle, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                    <SectorIcon kind={s.icon} size={14} color="#7f988a"/>
                    <b style={{ fontSize: 13 }}>{s.name}</b>
                    <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums', fontSize: 12.5 }}>
                      <b style={{ color: ((camp.greens && camp.greens[s.id]) || 0) === denom ? '#e8c15a' : '#eaf2ec' }}>{(camp.greens && camp.greens[s.id]) || 0}</b>
                      <span style={{ color: '#5d7367' }}>/{denom}</span>
                    </span>
                  </div>
                  {/* Short titles keep each question to one line; the full
                      prompt rides on hover. Ellipsis handles the long ones. */}
                  {[0, 1, 2].map(li => (s.levels[li] || []).map(q => (
                    <div key={q.id} title={q.prompt || q.title}
                      style={{ display: 'flex', gap: 6, fontSize: 11.5, lineHeight: 1.4, padding: '1px 0', color: '#cdebd8' }}>
                      {mark(camp.answers[q.id] === 'yes', li)}
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.title || q.prompt}</span>
                    </div>
                  )))}
                  {(s.tier4Topics || [])
                    .filter(t => (camp.answers[t.id] === 'yes' || camp.answers[t.id] === 'no') && !noted.has(t.id))
                    .map(t => (
                      <div key={t.id} title={`Level 4 · ${t.title}`}
                        style={{ display: 'flex', gap: 6, fontSize: 11.5, lineHeight: 1.4, padding: '1px 0', color: '#b9d3c2' }}>
                        {mark(camp.answers[t.id] === 'yes', 3)}
                        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>L4 · {t.title}</span>
                      </div>
                    ))}
                  {sl4 && sl4.ideas.map(i => (
                    <div key={i.id} style={{ fontSize: 11, fontStyle: 'italic', marginTop: 3, padding: '2px 8px', borderRadius: 6,
                      border: '1px solid ' + (i.yes ? '#2e5b43' : '#26382e'), background: i.yes ? '#15291e' : 'transparent',
                      color: i.yes ? '#8fd4ae' : '#93a89b' }}>
                      {i.yes ? '✓' : '✕'} “{i.note}”
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        </div>
        <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details"
          style={{ ...selStyle, cursor: 'pointer', fontWeight: 700, lineHeight: 1.4,
            position: 'absolute', top: 8, right: 8 }}>✕</button>
      </div>
    </div>
  );
}

const EMPTY_DEDUPE_INFO = new Map();

function CampsView({ sectors, rows, filters, refreshBtn, highlight, onClearHighlight, dedupeInfo }) {
  const dInfo = dedupeInfo || EMPTY_DEDUPE_INFO;
  const wide = useMQ('(min-width: 900px)');
  const [q, setQ] = React.useState('');
  // The input echoes q instantly; filtering runs on the 120ms-trailing dq so
  // fast typing coalesces into one list re-render instead of one per keystroke.
  const [dq, setDq] = React.useState('');
  React.useEffect(() => { const t = setTimeout(() => setDq(q), 120); return () => clearTimeout(t); }, [q]);
  // Default view: time of receipt, newest first. Every column sorts both ways:
  // first click applies its natural direction (text ascends, numbers/dates
  // descend), clicking the same column again reverses it.
  const [sort, setSort] = React.useState('date');
  const [dir, setDir] = React.useState('desc');
  const defaultDir = (id) => (id === 'name' ? 'asc' : 'desc');
  const pickSort = (id) => {
    if (id === sort) setDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSort(id); setDir(defaultDir(id)); }
  };
  // Nonzero while the Email button's clipboard fallback confirmation shows.
  const [bccCopied, setBccCopied] = React.useState(0);
  // The camp whose detail modal is open, and whether owner-flagged junk/test
  // rows are tucked away (they stay visible by default for audit).
  const [detail, setDetail] = React.useState(null);
  const [hideFlagged, setHideFlagged] = React.useState(false);
  const flaggedCount = React.useMemo(() => rows.filter(r => r.hidden).length, [rows]);
  // "Dups" toggle: only rows that are part of a duplicate group (dup > 1) or
  // flagged suspect (superseded rows ride along automatically — they share
  // their group's dup > 1 count, so filtering on dup > 1 alone keeps a group's
  // winner and its superseded siblings together).
  const [dupsOnly, setDupsOnly] = React.useState(false);
  // Visit-status filter (needs visit / assigned / visited), shown only once
  // any row carries a Visit cell — dormant until the sheet column exists.
  const [visitSel, setVisitSel] = React.useState('all');
  const anyVisit = React.useMemo(() => rows.some(r => String(r.visit || '').trim()), [rows]);
  const dupsCount = React.useMemo(() => {
    let n = 0;
    rows.forEach(r => { const info = dInfo.get(r); if (info && (info.dup > 1 || info.suspect)) n++; });
    return n;
  }, [rows, dInfo]);
  // City-tab clickthrough target: scroll the highlighted camp into view once.
  const hlRef = React.useRef(null);
  React.useEffect(() => {
    if (highlight && hlRef.current) hlRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);
  // "/" jumps to search; Escape clears the search and any clickthrough ring.
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    const onKey = (e) => {
      if (detail) return; // the detail modal owns the keyboard while open
      const t = e.target;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
      if (e.key === '/' && !typing) { e.preventDefault(); if (searchRef.current) searchRef.current.focus(); }
      if (e.key === 'Escape') { setQ(''); if (typing && t.blur) t.blur(); if (onClearHighlight) onClearHighlight(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClearHighlight, detail]);
  // One lowercase haystack per row, rebuilt only when the rows change — not
  // per keystroke per row (each row's notes hide under ~64 answer keys).
  const hay = React.useMemo(() => {
    const m = new Map();
    rows.forEach(r => {
      const notes = Object.keys(r.answers || {})
        .filter(k => k.endsWith('-note')).map(k => r.answers[k]).join(' ');
      m.set(r, (r.campName + ' ' + r.leadName + ' ' + r.email + ' ' + notes).toLowerCase());
    });
    return m;
  }, [rows]);
  const list = React.useMemo(() => {
    const ql = dq.trim().toLowerCase();
    let xs = ql ? rows.filter(r => hay.get(r).includes(ql)) : rows;
    if (hideFlagged) xs = xs.filter(r => !r.hidden);
    if (dupsOnly) xs = xs.filter(r => { const info = dInfo.get(r); return !!(info && (info.dup > 1 || info.suspect)); });
    if (visitSel !== 'all') xs = xs.filter(r => A.visitState(r.visit) === visitSel);
    // Primary key ascending; `dir` flips only the primary so the name-A→Z
    // tiebreak stays stable in either direction.
    const bySector = sectors.some(s => s.id === sort);
    const key =
      sort === 'name' ? (a, b) => a.campName.localeCompare(b.campName)
        : sort === 'score' ? (a, b) => a.total - b.total
        : bySector ? (a, b) => (((a.greens && a.greens[sort]) || 0) - ((b.greens && b.greens[sort]) || 0)) || (a.total - b.total)
        : (a, b) => (a.timestamp || 0) - (b.timestamp || 0);
    const flip = dir === 'asc' ? key : (a, b) => key(b, a);
    xs = xs.slice().sort((a, b) => flip(a, b) || a.campName.localeCompare(b.campName));
    return xs;
  }, [rows, hay, dq, sort, dir, sectors, hideFlagged, dupsOnly, visitSel, dInfo]);

  const headBtn = (id, label, align) => (
    <button key={id} type="button" onClick={() => pickSort(id)}
      title={sort === id ? `Sorted by ${label}; click to reverse` : `Sort by ${label}`}
      style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: '2px 0',
        fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
        textAlign: align || 'center', color: sort === id ? '#45c483' : '#93a89b' }}>
      {label.toUpperCase()}{sort === id ? (dir === 'asc' ? ' ▴' : ' ▾') : ''}
    </button>
  );

  return (
    <div>
      {/* Toolbar pieces, composed per breakpoint below: desktop gets one row
          (search + count left, filters/sort/Refresh/actions right); narrow
          screens get two intentional rows — full-width search + count, then
          the pill controls — instead of accidental flex-wrap, and drop the
          CSV/Email actions (desk work; mailto/download are clunky on phones). */}
      {(() => {
        const searchEl = (
          <input data-search ref={searchRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search camps, emails, ideas…" title="Press / to search"
            style={{ flex: 1, minWidth: 170, ...(wide ? { maxWidth: 340 } : {}), ...selStyle, borderRadius: 7 }} />
        );
        const countEl = (
          <span style={{ color: '#93a89b', fontSize: 11, flexShrink: 0 }}>{list.length} of {rows.length} camps</span>
        );
        const flaggedBtn = flaggedCount > 0 && (
          <button data-hide-flagged type="button" onClick={() => setHideFlagged(h => !h)}
            title="Owner-flagged junk/test rows stay listed for audit; this tucks them away"
            style={{ ...selStyle, cursor: 'pointer', color: hideFlagged ? '#e8c15a' : selStyle.color }}>
            {hideFlagged ? 'Show flagged' : `Hide flagged (${flaggedCount})`}
          </button>
        );
        const dupsBtn = dupsCount > 0 && (
          <button data-dups-only type="button" onClick={() => setDupsOnly(d => !d)}
            title="Show only rows that are part of a duplicate or possible-dup group"
            style={{ ...selStyle, cursor: 'pointer', color: dupsOnly ? '#e8c15a' : selStyle.color }}>
            {dupsOnly ? 'All camps' : `Dups (${dupsCount})`}
          </button>
        );
        const visitSelEl = anyVisit && (
          <select data-visit-filter value={visitSel} onChange={e => setVisitSel(e.target.value)}
            title="Filter by visit status (owner-typed Visit column)" style={selStyle}>
            <option value="all">All visits</option><option value="none">Needs visit</option>
            <option value="assigned">Assigned</option><option value="done">Visited</option>
          </select>
        );
        const sortSel = (
          <select value={sort} onChange={e => { setSort(e.target.value); setDir(defaultDir(e.target.value)); }}
            title="Sort camps by" style={selStyle}>
            <option value="date">Date</option><option value="score">Score</option><option value="name">Name</option>
            {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        );
        const dirBtn = (
          <button data-sort-dir type="button" onClick={() => setDir(d => (d === 'asc' ? 'desc' : 'asc'))}
            title={dir === 'asc' ? 'Ascending; click for descending' : 'Descending; click for ascending'}
            aria-label="Reverse sort order" style={{ ...selStyle, cursor: 'pointer' }}>
            {dir === 'asc' ? '↑' : '↓'}
          </button>
        );
        const csvBtn = (
          <button data-export type="button" onClick={() => exportCsv(list, sectors)} title="Download all filtered camps as a CSV file"
            style={{ ...selStyle, cursor: 'pointer' }}>
            <CsvIcon/>CSV
          </button>
        );
        const emailBtn = (
          <button data-email type="button"
            title="Open an email draft BCC'd to every filtered camp lead (long lists copy the addresses instead)"
            onClick={() => {
              const emails = Array.from(new Set(list.map(r => r.email).filter(Boolean)));
              if (!emails.length) return;
              const href = 'mailto:?bcc=' + encodeURIComponent(emails.join(','));
              // Mail clients truncate or refuse long mailto: URLs (~2k chars is
              // roughly 75 addresses); past that, copy the list to paste into BCC.
              if (href.length <= 1800) { window.location.href = href; return; }
              navigator.clipboard.writeText(emails.join(', ')).then(
                () => { setBccCopied(emails.length); setTimeout(() => setBccCopied(0), 2000); },
                () => {});
            }}
            style={{ ...selStyle, cursor: 'pointer' }}>
            {bccCopied ? `Copied ${bccCopied} emails` : <React.Fragment><MailIcon/>Email</React.Fragment>}
          </button>
        );
        return wide ? (
          <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center', flexWrap: 'wrap' }}>
            {searchEl}{countEl}{flaggedBtn}{dupsBtn}{visitSelEl}
            <div style={{ flex: 1 }} />
            {filters}{sortSel}{dirBtn}{refreshBtn}{csvBtn}{emailBtn}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{searchEl}{countEl}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              {filters}{sortSel}{dirBtn}{refreshBtn}{flaggedBtn}{dupsBtn}{visitSelEl}
            </div>
          </div>
        );
      })()}
      {wide && (
        <div style={{ display: 'grid', columnGap: 10, padding: '4px 12px', position: 'sticky', top: 0,
          background: '#0e1712f2', backdropFilter: 'blur(2px)', zIndex: 1, borderBottom: '1px solid #26382e',
          gridTemplateColumns: 'minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {headBtn('name', 'Camp', 'left')}
            {headBtn('date', 'Submitted', 'left')}
          </div>
          {sectors.map(s => headBtn(s.id, s.name))}
          {headBtn('score', 'Total', 'right')}
        </div>
      )}
      {list.map(r => {
        const hl = highlight && r.campName === highlight;
        const info = dInfo.get(r);
        return (
          <div key={`${r.campName}|${r.timestamp}`} ref={hl ? hlRef : null}
            role="button" tabIndex={0} aria-label={`View full details for ${r.campName}`}
            title="Click for full details"
            onClick={e => {
              // Links inside the row (email, result) keep their own behavior.
              if (e.target.closest && e.target.closest('a')) return;
              if (hl && onClearHighlight) onClearHighlight();
              setDetail(r);
            }}
            onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) setDetail(r); }}
            style={{ cursor: 'pointer', ...(hl ? { outline: '2px solid #45c483', outlineOffset: 2, borderRadius: 12 } : {}) }}>
            <MemoCampRow sectors={sectors} camp={r} wide={wide} hi={dq.trim()}
              dupCount={info ? info.dup : 1} superseded={!!(info && info.superseded)} suspect={!!(info && info.suspect)} />
          </div>
        );
      })}
      {detail && (() => {
        const info = dInfo.get(detail);
        return <CampDetail sectors={sectors} camp={detail} onClose={() => setDetail(null)}
          dupCount={info ? info.dup : 1} superseded={!!(info && info.superseded)} />;
      })()}
    </div>
  );
}

// Legacy 0-4 rows: greens counts levels lit, not questions answered Yes. Fill whole levels.
function legacyFills(sectors, greens) {
  const out = {};
  sectors.forEach(s => {
    const count = Math.max(0, Math.min(4, (greens && greens[s.id]) | 0));
    const sizes = [1, 2, 3, 4];
    const levels = sizes.map((n, li) => Array.from({ length: n }, () => li < count));
    out[s.id] = { levels, totalYes: sizes.reduce((t, n, li) => t + (li < count ? n : 0), 0), played: count > 0 };
  });
  return out;
}

// Approximate radius when a camp has no per-answer data: fill totalYes contiguously per sector.
function approxFills(sectors, greens) {
  const out = {};
  sectors.forEach(s => {
    let n = (greens && greens[s.id]) || 0;
    const levels = [0, 1, 2].map(li => (s.levels[li] || []).map(() => { const on = n > 0; if (on) n--; return on; }));
    levels[3] = [0, 1, 2, 3].map(() => { const on = n > 0; if (on) n--; return on; });
    out[s.id] = { levels, totalYes: (greens && greens[s.id]) || 0, played: ((greens && greens[s.id]) || 0) > 0 };
  });
  return out;
}
