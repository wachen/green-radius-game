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
        selected={sel}
        onSelectSegment={agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null} />
      <div style={{ fontSize: 13, color: '#cfe0d4', marginTop: 6 }}>
        <b style={{ color: '#fff' }}>{agg.totalYes}</b> of {agg.totalPossible} green choices · <b style={{ color: '#fff' }}>{agg.count}</b> camps · +{agg.momentum.thisWeek} this week
      </div>
      {agg.legacyCount > 0 && (
        <div style={{ fontSize: 11, color: '#7f988a', marginTop: 4 }}>
          {agg.legacyCount} older {agg.legacyCount === 1 ? 'response' : 'responses'} on the old 0 to 4 scale excluded from the tally.
        </div>
      )}
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

function CampsView({ sectors, rows }) {
  const wide = useMQ('(min-width: 760px)');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('score');
  const [selId, setSelId] = React.useState(null);
  const list = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    let xs = rows.filter(r => !ql || (r.campName + ' ' + r.leadName + ' ' + r.email).toLowerCase().includes(ql));
    xs = xs.slice().sort(sort === 'score' ? (a, b) => b.total - a.total : (a, b) => a.campName.localeCompare(b.campName));
    return xs;
  }, [rows, q, sort]);
  const selected = list.find((r, i) => (selId == null ? i === 0 : rowKey(r) === selId)) || list[0];

  const List = (
    <div style={{ borderRight: wide ? '1px solid #26382e' : 'none' }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #26382e' }}>
        <input data-search value={q} onChange={e => setQ(e.target.value)} placeholder="Search camps…"
          style={{ flex: 1, ...selStyle, borderRadius: 7 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle}><option value="score">Score</option><option value="name">Name</option></select>
      </div>
      {list.map(r => {
        const legacy = A.isLegacy(r);
        return (
          <button key={rowKey(r)} type="button" data-camp-row onClick={() => setSelId(rowKey(r))}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 11px', cursor: 'pointer',
              width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit', border: 'none',
              borderBottom: '1px solid #1a281f', background: selected && rowKey(selected) === rowKey(r) ? '#16271d' : 'transparent' }}>
            <div style={{ flex: 1 }}><b style={{ fontSize: 13 }}>{r.campName}</b><small style={{ display: 'block', color: '#93a89b', fontSize: 10 }}>{r.leadName}</small></div>
            {legacy && <span style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '1px 6px' }}>old scale</span>}
            <span style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '1px 6px' }}>{r.source}</span>
            <b style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{legacy ? `${r.total}/24` : r.total}</b>
          </button>
        );
      })}
      <div style={{ padding: '8px 11px', color: '#93a89b', fontSize: 10 }}>{list.length} camps · sorted by {sort}</div>
    </div>
  );

  const Detail = selected && <CampDetail sectors={sectors} camp={selected} />;

  return wide
    ? <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', minHeight: 400 }}>{List}{Detail}</div>
    : (selId ? <div><button type="button" onClick={() => setSelId(null)} style={{ background: 'none', border: 'none', font: 'inherit', fontSize: 13, color: '#45c483', fontWeight: 700, padding: '8px 4px', cursor: 'pointer' }}>‹ All camps</button>{Detail}</div> : List);
}
const rowKey = r => `${r.campName}|${r.timestamp}`;

function CampDetail({ sectors, camp }) {
  const hasAnswers = camp.answers && Object.keys(camp.answers).length > 0;
  const legacy = A.isLegacy(camp);
  const fills = React.useMemo(() => hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens)), [sectors, camp, hasAnswers, legacy]);
  const maxed = legacy ? [] : sectors.filter(s => (camp.greens[s.id] || 0) === 10).map(s => s.id);
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div><h3 style={{ margin: 0 }}>{camp.campName}</h3>
          <p style={{ margin: '2px 0 0', color: '#93a89b', fontSize: 12 }}>{camp.leadName} · {camp.email} · {camp.source}</p></div>
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          <a data-email href={`mailto:${camp.email}`} style={{ ...btnStyle, textDecoration: 'none' }}>✉ Email</a>
          {camp.resultUrl && <a data-result href={camp.resultUrl} target="_blank" rel="noreferrer"
            style={{ ...btnStyle, background: 'transparent', color: '#eaf2ec', border: '1px solid #26382e' }}>↗ Green Radius result</a>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', margin: '12px 0' }}>
        <RadialBadge sectors={sectors} fills={fills} size={128} dark showLabels={false} />
        <div style={{ fontSize: 13, color: '#cfe0d4' }}>
          <b style={{ color: '#fff' }}>{camp.total}/{legacy ? 24 : 60}</b> total{maxed.length ? ` · ${maxed.length} maxed` : ''}
          {legacy && <span style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99, padding: '1px 6px', marginLeft: 6 }}>old scale</span>}
        </div>
      </div>
      {!hasAnswers && !legacy && <div style={{ fontSize: 12, color: '#93a89b' }}>Per-answer detail appears once granular capture is live.</div>}
      {(hasAnswers || legacy) && sectors.map(s => {
        const ids = hasAnswers ? [].concat(...s.levels.slice(0, 3)).map(qq => qq.id) : [];
        const picks = hasAnswers ? (s.tier4Topics || []).filter(t => camp.answers[t.id] === 'yes') : [];
        return (
          <div key={s.id} style={{ marginTop: 10 }}>
            <div style={{ display: 'flex', gap: 6, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              {s.name} <span style={{ color: '#93a89b', fontWeight: 600 }}>{camp.greens[s.id] || 0}/{legacy ? 4 : 10}</span>
              {maxed.includes(s.id) && <span style={{ color: '#e8c15a' }}>★</span>}
            </div>
            {hasAnswers && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {ids.map(id => (
                  <span key={id} data-token style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6,
                    border: '1px solid ' + (camp.answers[id] === 'yes' ? '#2e5b43' : '#26382e'),
                    background: camp.answers[id] === 'yes' ? '#15291e' : 'transparent',
                    color: camp.answers[id] === 'yes' ? '#cdebd8' : '#93a89b' }}>
                    {camp.answers[id] === 'yes' ? '✓ ' : '✕ '}{id}</span>
                ))}
              </div>
            )}
            {picks.length > 0 && <div style={{ marginTop: 5, fontSize: 11, color: '#93a89b' }}>Level 4: {picks.map(t => t.title).join(', ')}</div>}
          </div>
        );
      })}
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
