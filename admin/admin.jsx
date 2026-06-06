// admin/admin.jsx — gated viewer. Reuses RadialBadge + sectorFill (bare names from
// green-radius.jsx) and window.AdminAggregate. CommunityTally + CampsView added in Tasks 5-6.
const A = window.AdminAggregate;
const useMQ = (q) => {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => { const mm = window.matchMedia(q); const h = e => setM(e.matches);
    mm.addEventListener('change', h); return () => mm.removeEventListener('change', h); }, [q]);
  return m;
};

function useResponses() {
  const [state, setState] = React.useState({ status: 'loading', rows: [] });
  const load = React.useCallback(() => {
    setState({ status: 'loading', rows: [] });
    fetch('/api/admin/responses', { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(d => setState({ status: 'ready', rows: d.rows || [] }))
      .catch(e => setState({ status: 'error', rows: [], error: String(e) }));
  }, []);
  React.useEffect(load, [load]);
  return { ...state, reload: load };
}

function AdminApp({ sectors }) {
  const { status, rows, error, reload } = useResponses();
  const [tab, setTab] = React.useState('city');
  const [year, setYear] = React.useState(2026);
  const [source, setSource] = React.useState('all');
  const years = React.useMemo(() => Array.from(new Set(rows.map(r => r.year))).sort((a, b) => b - a), [rows]);
  const filtered = React.useMemo(() => rows.filter(r =>
    (!year || r.year === year) && (source === 'all' || r.source === source)), [rows, year, source]);

  const Tab = ({ id, label }) => (
    <button data-tab={id} onClick={() => setTab(id)}
      style={{ fontWeight: 700, fontSize: 13, padding: '6px 13px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: tab === id ? '#1d2c24' : 'transparent', color: tab === id ? '#eaf2ec' : '#93a89b' }}>{label}</button>
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #26382e' }}>
        <b style={{ fontWeight: 800 }}>Green<span style={{ color: '#45c483' }}>Radius</span> · Admin</b>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}><Tab id="city" label="City" /><Tab id="camps" label="Camps" /></div>
        <select value={year} onChange={e => setYear(+e.target.value)} style={selStyle}>
          {years.length ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={2026}>2026</option>}
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} style={selStyle}>
          <option value="all">All</option><option value="board">Board</option><option value="form">Form</option>
        </select>
      </header>

      {status === 'loading' && <Centered>Loading the community tally…</Centered>}
      {status === 'error' && <Centered>Couldn't load responses ({error}). <button onClick={reload} style={btnStyle}>Retry</button></Centered>}
      {status === 'ready' && filtered.length === 0 && <Centered>No camps yet for {year}.</Centered>}
      {status === 'ready' && filtered.length > 0 && (
        tab === 'city'
          ? <CommunityTally sectors={sectors} rows={filtered} />
          : <CampsView sectors={sectors} rows={filtered} />
      )}
    </div>
  );
}

const selStyle = { background: '#101b15', color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '4px 8px', fontSize: 12 };
const btnStyle = { background: '#45c483', color: '#06140c', border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, cursor: 'pointer' };
const Centered = ({ children }) => <div style={{ textAlign: 'center', padding: '60px 0', color: '#93a89b' }}>{children}</div>;

function CommunityTally({ sectors, rows }) {
  const agg = React.useMemo(() => A.computeAggregates(rows, sectors, Date.now()), [rows, sectors]);
  const wide = useMQ('(min-width: 760px)');
  const [sel, setSel] = React.useState(null); // {sector, level, qi}
  const pct = Math.round(agg.tallyPct * 100);

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
    <div style={{ textAlign: 'center', filter: 'drop-shadow(0 0 22px rgba(69,196,131,.3))' }}>
      <RadialBadge sectors={sectors} fills={{}} size={wide ? 300 : 264} dark
        intensities={agg.intensities} centerLabel={agg.hasAnswers ? `${pct}%` : `${agg.totalYes}`}
        onSelectSegment={agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null} />
      <div style={{ fontSize: 13, color: '#cfe0d4', marginTop: 6 }}>
        <b style={{ color: '#fff' }}>{agg.totalYes}</b> of {agg.totalPossible} green choices · <b style={{ color: '#fff' }}>{agg.count}</b> camps · +{agg.momentum.thisWeek} this week
      </div>
      {!agg.hasAnswers && <div style={{ fontSize: 11, color: '#7f988a', marginTop: 4 }}>Per-question detail appears once granular capture is live.</div>}
      {detail && (
        <div data-segment-detail style={{ background: '#13201a', border: '1px solid #26382e', borderLeft: '3px solid #45c483',
          borderRadius: 10, padding: '9px 11px', margin: '10px auto 0', maxWidth: 320, textAlign: 'left' }}>
          <div style={{ fontSize: 10, letterSpacing: '.1em', color: '#45c483', fontWeight: 800 }}>{detail.label.toUpperCase()}</div>
          <div style={{ fontSize: 12.5, margin: '2px 0 4px' }}>{detail.text}</div>
          <div style={{ color: '#93a89b', fontSize: 12 }}><b style={{ color: '#fff', fontSize: 15 }}>{Math.round(detail.rate * 100)}%</b> of {detail.n} camps</div>
        </div>
      )}
    </div>
  );

  const Stats = (
    <div>
      <SecHead>Reaching Furthest</SecHead>
      <div data-leaderboard>
        {agg.leaderboard.slice(0, 5).map((c, i) => (
          <div key={i} data-rank={i + 1} style={rowStyle}>
            <span style={{ width: 16, color: '#93a89b' }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 600 }}>{c.campName} {i === 0 && <span style={{ color: '#e8c15a' }}>★</span>}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{c.total}/60</b>
          </div>
        ))}
      </div>
      <SecHead>Sector Standings</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: '0 18px' }}>
        {agg.sectorStandings.map(s => (
          <div key={s.id} style={rowStyle}><span style={{ flex: 1, color: '#cdebd8' }}>{s.name}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums' }}>{s.avg.toFixed(1)}</b></div>
        ))}
      </div>
    </div>
  );

  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, paddingTop: 16, alignItems: 'start' }}>{Hero}{Stats}</div>
    : <div style={{ paddingTop: 12 }}>{Hero}<div style={{ marginTop: 14 }}>{Stats}</div></div>;
}
const SecHead = ({ children }) => <div style={{ fontSize: 10.5, letterSpacing: '.16em', color: '#93a89b', fontWeight: 800, margin: '16px 0 6px' }}>{String(children).toUpperCase()}</div>;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px dashed #21332a', fontSize: 13 };

// Placeholder — replaced in Task 6.
function CampsView({ rows }) { return <Centered>Camps view — {rows.length} camps</Centered>; }
