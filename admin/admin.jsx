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
  const [tab, setTab] = React.useState('city');
  // Set when a Top Camps row is clicked on the City tab: switches to Camps and
  // scroll-highlights that camp's row there.
  const [highlightCamp, setHighlightCamp] = React.useState(null);
  const [year, setYear] = React.useState(2026);
  const [source, setSource] = React.useState('all');
  const years = React.useMemo(() => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a), [rows]);
  const filtered = React.useMemo(() => rows.filter(r =>
    (!year || r.year === year) && (source === 'all' || r.source === source)), [rows, year, source]);

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
      {status === 'loading' ? 'Loading…' : 'Refresh'}
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
        <div style={{ display: 'flex', gap: 8 }}><Tab id="city" label="🌄 City" name="City" /><Tab id="camps" label="🎪 Camps" name="Camps" /></div>
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
              : <CampsView sectors={sectors} rows={filtered} filters={filterSelects} refreshBtn={refreshBtn}
                  highlight={highlightCamp} onClearHighlight={() => setHighlightCamp(null)} />
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

// Mini-badge fills for a leaderboard entry — same precedence as CampRow.
function miniFills(sectors, entry) {
  const hasAns = entry.answers && Object.keys(entry.answers).some(k =>
    entry.answers[k] === 'yes' || entry.answers[k] === 'no');
  if (hasAns) return fillsFromAnswers(sectors, entry.answers);
  return A.isLegacy(entry) ? legacyFills(sectors, entry.greens) : approxFills(sectors, entry.greens);
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
          <RadialBadge sectors={sectors} fills={peek ? miniFills(sectors, peek) : {}} size={wide ? 284 : 276} dark
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
        {detail && (
          <div data-segment-detail style={{ background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.12)', borderLeft: '3px solid #7fc46a',
            borderRadius: 10, padding: '9px 11px', margin: '10px auto 0', maxWidth: 320, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#7fc46a', fontWeight: 800 }}>{detail.label.toUpperCase()}</div>
            {/* Fixed 4-line well so the box height never shifts between hovers. */}
            <div style={{ fontSize: 12.5, lineHeight: 1.35, margin: '2px 0 4px', height: '5.4em',
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{detail.text}</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}><b style={{ color: '#fff', fontSize: 15 }}>{Math.round(detail.rate * 100)}%</b> of {detail.n} camps</div>
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
            <RadialBadge sectors={sectors} fills={miniFills(sectors, c)} size={30} dark showLabels={false} showCenter={false}/>
          </span>
          <span style={{ flex: 1, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.campName} {i === 0 && <span title="Highest score right now" style={{ color: '#e8c15a' }}>★</span>}
            {c.timestamp && now - c.timestamp <= 7 * 864e5 ? <span title="New this week" style={{ color: '#7fc46a', marginLeft: 4 }}>●</span> : null}
          </span>
          <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total}/60</b>
        </div>
      ))}
    </div>
  );

  const Standings = (
    <div style={{ ...panelStyle, marginTop: 12 }}>
      <SecHead style={{ marginTop: 0 }}>Sector Averages</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '0 18px' }}>
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

  // Left column: the BRC radius box with Sector Averages sitting directly
  // under it (same color scheme, just relocated). Right column: Top Camps
  // leads (moved to the top of the stack), then the pulse tiles, then
  // Superlatives. Narrow screens stack both columns in the same order.
  const LeftCol = <div>{Hero}{Standings}</div>;
  const RightCol = <div>{Pulse}{Leaderboard}{Superlatives}</div>;
  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr', gap: 20, paddingTop: 16, alignItems: 'start' }}>{LeftCol}{RightCol}</div>
    : <div style={{ paddingTop: 12 }}>{LeftCol}{RightCol}</div>;
}
const SecHead = ({ children, style }) => <div style={{ fontSize: 14, letterSpacing: '.16em', color: '#93a89b', fontWeight: 800, margin: '16px 0 6px', ...style }}>{String(children).toUpperCase()}</div>;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed #21332a', fontSize: 13 };

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

function CampRow({ sectors, camp, wide, hi }) {
  const hasAnswers = rowHasAnswers(camp);
  const hidden = !!camp.hidden;
  const legacy = A.isLegacy(camp);
  const fills = hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens));
  const denom = legacy ? 4 : 10;
  const l4 = campL4(sectors, camp);

  const badge = (text, title) => (
    <span title={title} style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99,
      padding: '1px 6px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{text}</span>
  );
  const Identity = (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
      {/* 44px radius thumbnail: round vs lopsided camps read at a glance */}
      <div data-mini-badge aria-hidden="true" title="Camp's green radius shape" style={{ flexShrink: 0 }}>
        <RadialBadge sectors={sectors} fills={fills} size={44} dark showLabels={false} showCenter={false}/>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span><Hi text={camp.campName} q={hi}/></span>
          {camp.timestamp && Date.now() - camp.timestamp <= 7 * 864e5 ?
            <span title="New this week" style={{ color: '#7fc46a' }}>●</span> : null}
          {badge(camp.source, camp.source === 'board' ? 'Answered on the in-person board kiosk' : 'Answered via the public web form')}
          {legacy && badge('old scale', 'Submitted on the legacy 0-4 scale, shown here as an approximation')}
          {hidden && badge('hidden', 'Owner-flagged as junk or test data; excluded from every aggregate')}
        </div>
        <div style={{ fontSize: 11.5, color: '#93a89b', marginTop: 2, overflowWrap: 'anywhere' }}>
          <Hi text={camp.leadName} q={hi}/> · <a data-email href={`mailto:${camp.email}`} style={{ color: '#8fd4ae', textDecoration: 'none' }}><Hi text={camp.email} q={hi}/></a>
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
  const rowBase = { borderBottom: '1px solid #1a281f', padding: '8px 12px',
    contentVisibility: 'auto', containIntrinsicSize: 'auto 84px', opacity: hidden ? 0.5 : 1 };
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
function CampDetail({ sectors, camp, onClose }) {
  const hasAnswers = rowHasAnswers(camp);
  const legacy = A.isLegacy(camp);
  const fills = hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens));
  const denom = legacy ? 4 : 10;
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
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>{camp.campName}</div>
            <div style={{ fontSize: 12.5, color: '#93a89b', marginTop: 3, overflowWrap: 'anywhere' }}>
              {camp.leadName} · <a href={`mailto:${camp.email}`} style={{ color: '#8fd4ae' }}>{camp.email}</a>
            </div>
            <div style={{ fontSize: 12, color: '#7f988a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {fmtWhen(camp.timestamp)} · {camp.source}{camp.year ? ` · ${camp.year}` : ''}
              {legacy ? ' · old 0-4 scale' : ''}{camp.hidden ? ' · flagged hidden' : ''}
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

function CampsView({ sectors, rows, filters, refreshBtn, highlight, onClearHighlight }) {
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
  }, [rows, hay, dq, sort, dir, sectors, hideFlagged]);

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
      {/* One toolbar row (wraps on narrow screens): search (the primary filter)
          leads with the live count as feedback, then the right cluster groups
          the global year/source filters, view controls (sort + direction),
          Refresh, and bulk actions (CSV, Email). */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center', flexWrap: 'wrap' }}>
        <input data-search ref={searchRef} value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search camps, emails, ideas…" title="Press / to search"
          style={{ flex: 1, minWidth: 170, maxWidth: 340, ...selStyle, borderRadius: 7 }} />
        <span style={{ color: '#93a89b', fontSize: 11 }}>{list.length} of {rows.length} camps</span>
        {flaggedCount > 0 && (
          <button data-hide-flagged type="button" onClick={() => setHideFlagged(h => !h)}
            title="Owner-flagged junk/test rows stay listed for audit; this tucks them away"
            style={{ ...selStyle, cursor: 'pointer', color: hideFlagged ? '#e8c15a' : selStyle.color }}>
            {hideFlagged ? 'Show flagged' : `Hide flagged (${flaggedCount})`}
          </button>
        )}
        <div style={{ flex: 1 }} />
        {filters}
        <select value={sort} onChange={e => { setSort(e.target.value); setDir(defaultDir(e.target.value)); }}
          title="Sort camps by" style={selStyle}>
          <option value="date">Date</option><option value="score">Score</option><option value="name">Name</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button data-sort-dir type="button" onClick={() => setDir(d => (d === 'asc' ? 'desc' : 'asc'))}
          title={dir === 'asc' ? 'Ascending; click for descending' : 'Descending; click for ascending'}
          aria-label="Reverse sort order" style={{ ...selStyle, cursor: 'pointer' }}>
          {dir === 'asc' ? '↑' : '↓'}
        </button>
        {refreshBtn}
        <button data-export type="button" onClick={() => exportCsv(list, sectors)} title="Download all filtered camps as a CSV file"
          style={{ ...selStyle, cursor: 'pointer' }}>
          <CsvIcon/>CSV
        </button>
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
      </div>
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
            <MemoCampRow sectors={sectors} camp={r} wide={wide} hi={dq.trim()} />
          </div>
        );
      })}
      {detail && <CampDetail sectors={sectors} camp={detail} onClose={() => setDetail(null)} />}
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
