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

// Placeholders — replaced in Tasks 5 & 6.
function CommunityTally({ rows }) { return <Centered>City view — {rows.length} camps</Centered>; }
function CampsView({ rows }) { return <Centered>Camps view — {rows.length} camps</Centered>; }
