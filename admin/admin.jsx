// admin/admin.jsx — gated viewer. Reuses RadialBadge, fillsFromAnswers and
// LEVEL_COLORS (bare names from green-radius.jsx) and window.AdminAggregate.
// City tab = community tally; Camps tab = full-width all-data rows.
const A = window.AdminAggregate;
const useMQ = (q) => {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => { const mm = window.matchMedia(q); const h = e => setM(e.matches);
    mm.addEventListener('change', h); return () => mm.removeEventListener('change', h); }, [q]);
  return m;
};

function useResponses() {
  // Refreshes keep the last rows on screen (dimmed) instead of blanking to a
  // spinner — the admin skims during launch-day monitoring; don't yank the page.
  const [state, setState] = React.useState({ status: 'loading', rows: [] });
  const load = React.useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    fetch('/api/admin/responses', { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(d => setState({ status: 'ready', rows: d.rows || [] }))
      .catch(e => setState(s => ({ status: 'error', rows: s.rows, error: String(e) })));
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
    <div style={{ maxWidth: tab === 'camps' ? 1240 : 900, margin: '0 auto', padding: 14 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', rowGap: 6, paddingBottom: 10, borderBottom: '1px solid #26382e' }}>
        <b style={{ fontWeight: 800 }}>Green<span style={{ color: '#45c483' }}>Radius</span> · Admin</b>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 4 }}><Tab id="city" label="City" /><Tab id="camps" label="Camps" /></div>
        <select value={year} onChange={e => setYear(+e.target.value)} style={selStyle}>
          {years.length ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={2026}>2026</option>}
        </select>
        <select value={source} onChange={e => setSource(e.target.value)} style={selStyle}>
          <option value="all">All</option><option value="board">Board</option><option value="form">Form</option>
        </select>
        <button data-refresh type="button" onClick={reload} disabled={status === 'loading'} aria-label="Refresh responses"
          style={{ ...selStyle, cursor: status === 'loading' ? 'wait' : 'pointer', fontWeight: 700 }}>
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {status === 'loading' && rows.length === 0 && <Centered>Loading the community tally…</Centered>}
      {status === 'error' && rows.length === 0 && <Centered>Couldn't load responses ({error}). <button onClick={reload} style={btnStyle}>Retry</button></Centered>}
      {rows.length > 0 && (
        <div style={{ opacity: status === 'loading' ? 0.55 : 1, transition: 'opacity .15s' }}>
          {status === 'error' && (
            <div style={{ background: '#2a1c14', border: '1px solid #573a26', borderRadius: 8, padding: '7px 11px', margin: '10px 0 0', fontSize: 12, color: '#e8c15a' }}>
              Refresh failed ({error}) — showing the previous data. <button onClick={reload} style={{ ...btnStyle, padding: '2px 8px', marginLeft: 6 }}>Retry</button>
            </div>
          )}
          {filtered.length === 0 && <Centered>No camps yet for {year}.</Centered>}
          {filtered.length > 0 && (
            tab === 'city'
              ? <CommunityTally sectors={sectors} rows={filtered} />
              : <CampsView sectors={sectors} rows={filtered} />
          )}
        </div>
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

// ── Camps: full-width scannable rows ─────────────────────────────────────────
// Every row shows everything — identity, submitted date/time, all six sector
// scores with per-question fill bars, Level-4 picks and the camp's write-in —
// no click-to-reveal. Desktop-first: sectors align as columns across rows so
// the eye can scan one sector down the whole list.

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
    const campTopic = (s.tier4Topics || []).find(t => /-camp$/.test(t.id));
    const noteVal = campTopic ? camp.answers[campTopic.id + '-note'] : '';
    const note = (typeof noteVal === 'string' ? noteVal.trim() : '').replace(/^'(?=[=+\-@\t\r])/, '');
    const picks = (s.tier4Topics || [])
      .filter(t => camp.answers[t.id] === 'yes' && !(note && t === campTopic))
      .map(t => t.title);
    return { id: s.id, name: s.name, picks, note, noteYes: !!note && camp.answers[campTopic.id] === 'yes' };
  }).filter(x => x.picks.length || x.note);
}

// One sector's 10 questions as a tiny bar chart: cell height steps up per
// level (the "radius grows outward" story in miniature), colored with the
// live LEVEL_COLORS ramp when Yes.
function SectorBar({ sector, fill, hasAnswers, legacy }) {
  const cellH = [7, 9, 11, 13];
  const cells = [];
  fill.levels.forEach((lvl, li) => lvl.forEach((on, qi) => {
    const q = li < 3 ? (sector.levels[li] || [])[qi] : null;
    const label = legacy ? `Level ${li + 1} ${on ? 'lit' : 'unlit'} (old 0-4 scale)`
      : q ? `${on ? '✓' : '✕'} ${q.prompt || q.title || q.id}`
      : `${on ? '✓' : '✕'} advanced pick ${qi + 1} of 4`;
    cells.push(
      <span key={li + '-' + qi} title={hasAnswers || legacy ? label : 'approximate (no per-question data)'}
        style={{ width: 5, height: cellH[li], borderRadius: 1.5,
          background: on ? LEVEL_COLORS[li] : '#1d2c24' }} />
    );
  }));
  return (
    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'flex-end',
      opacity: hasAnswers || legacy ? 1 : 0.45 }}>
      {cells}
    </div>
  );
}

function CampRow({ sectors, camp, wide }) {
  const hasAnswers = rowHasAnswers(camp);
  const legacy = A.isLegacy(camp);
  const fills = hasAnswers ? fillsFromAnswers(sectors, camp.answers)
    : (legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens));
  const denom = legacy ? 4 : 10;
  const l4 = campL4(sectors, camp);

  const badge = (text) => (
    <span style={{ fontSize: 9, color: '#93a89b', border: '1px solid #26382e', borderRadius: 99,
      padding: '1px 6px', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>{text}</span>
  );
  const Identity = (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span>{camp.campName}</span>
        {badge(camp.source)}{legacy && badge('old scale')}
      </div>
      <div style={{ fontSize: 11.5, color: '#93a89b', marginTop: 2, overflowWrap: 'anywhere' }}>
        {camp.leadName} · <a data-email href={`mailto:${camp.email}`} style={{ color: '#8fd4ae', textDecoration: 'none' }}>{camp.email}</a>
      </div>
      <div data-submitted style={{ fontSize: 11, color: '#7f988a', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {fmtWhen(camp.timestamp)}
      </div>
    </div>
  );
  const SectorCells = sectors.map(s => {
    const n = (camp.greens && camp.greens[s.id]) || 0;
    return (
      <div key={s.id} data-sector-cell style={{ textAlign: 'center', alignSelf: 'center' }}>
        {!wide && <div style={{ fontSize: 9, letterSpacing: '.08em', color: '#7f988a', fontWeight: 700 }}>{s.name.toUpperCase()}</div>}
        <div style={{ fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          color: n === denom ? '#e8c15a' : '#eaf2ec', marginBottom: 3 }}>
          {n}<span style={{ color: '#5d7367', fontWeight: 600 }}>/{denom}</span>
        </div>
        <SectorBar sector={s} fill={fills[s.id]} hasAnswers={hasAnswers} legacy={legacy} />
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
        <a data-result href={camp.resultUrl} target="_blank" rel="noreferrer"
          style={{ fontSize: 11, color: '#8fd4ae', textDecoration: 'none' }}>result ↗</a>
      )}
    </div>
  );
  const L4Line = l4.length > 0 && (
    <div style={{ gridColumn: '1 / -1', fontSize: 11.5, color: '#93a89b', lineHeight: 1.5,
      borderTop: '1px dashed #1d2c24', paddingTop: 6, marginTop: 2 }}>
      <span style={{ color: '#45c483', fontWeight: 800, fontSize: 9.5, letterSpacing: '.12em' }}>LEVEL 4</span>
      {l4.map(x => (
        <span key={x.id} style={{ marginLeft: 10, display: 'inline-block' }}>
          <b style={{ color: '#cdebd8', fontWeight: 700 }}>{x.name}:</b>{' '}
          {x.picks.join(', ')}
          {x.note && (
            <span data-camp-note style={{ color: '#8fd4ae', fontStyle: 'italic' }}>
              {x.picks.length ? ' · ' : ' '}{x.noteYes ? '✓' : '✕'} “{x.note}”
            </span>
          )}
        </span>
      ))}
    </div>
  );

  // content-visibility lets the browser skip layout/paint for offscreen rows —
  // keeps a long list smooth without windowing machinery.
  const rowBase = { borderBottom: '1px solid #1a281f', padding: '11px 12px',
    contentVisibility: 'auto', containIntrinsicSize: 'auto 96px' };
  return wide ? (
    <div data-camp-row style={{ ...rowBase, display: 'grid', alignItems: 'center', columnGap: 10,
      gridTemplateColumns: 'minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px' }}>
      {Identity}{SectorCells}{Total}{L4Line}
    </div>
  ) : (
    <div data-camp-row style={rowBase}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{Identity}</div>{Total}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 6px', marginTop: 8 }}>
        {SectorCells}
      </div>
      {L4Line && <div style={{ display: 'grid' }}>{L4Line}</div>}
    </div>
  );
}

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
      .map(x => `${x.name}: ${x.picks.concat(x.note ? [`"${x.note}" (${x.noteYes ? 'yes' : 'no'})`] : []).join('; ')}`)
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

function CampsView({ sectors, rows }) {
  const wide = useMQ('(min-width: 900px)');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('date');
  const list = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    let xs = rows.filter(r => {
      if (!ql) return true;
      const notes = Object.keys(r.answers || {})
        .filter(k => k.endsWith('-note')).map(k => r.answers[k]).join(' ');
      return (r.campName + ' ' + r.leadName + ' ' + r.email + ' ' + notes).toLowerCase().includes(ql);
    });
    const bySector = sectors.some(s => s.id === sort);
    xs = xs.slice().sort(
      sort === 'name' ? (a, b) => a.campName.localeCompare(b.campName)
        : sort === 'score' ? (a, b) => (b.total - a.total) || a.campName.localeCompare(b.campName)
        : bySector ? (a, b) => (((b.greens && b.greens[sort]) || 0) - ((a.greens && a.greens[sort]) || 0)) || (b.total - a.total)
        : (a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return xs;
  }, [rows, q, sort, sectors]);

  const headBtn = (id, label, align) => (
    <button key={id} type="button" onClick={() => setSort(id)} title={`Sort by ${label}`}
      style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: '2px 0',
        fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
        textAlign: align || 'center', color: sort === id ? '#45c483' : '#93a89b' }}>
      {label.toUpperCase()}{sort === id ? ' ▾' : ''}
    </button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, padding: '10px 0', alignItems: 'center' }}>
        <input data-search value={q} onChange={e => setQ(e.target.value)} placeholder="Search camps, emails, ideas…"
          style={{ flex: 1, maxWidth: 340, ...selStyle, borderRadius: 7 }} />
        <select value={sort} onChange={e => setSort(e.target.value)} style={selStyle}>
          <option value="date">Newest</option><option value="score">Score</option><option value="name">Name</option>
          {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <span style={{ color: '#93a89b', fontSize: 11 }}>{list.length} of {rows.length} camps</span>
        <button data-export type="button" onClick={() => exportCsv(list, sectors)} style={{ ...selStyle, cursor: 'pointer' }}>
          ⬇ CSV
        </button>
      </div>
      {wide && (
        <div style={{ display: 'grid', columnGap: 10, padding: '4px 12px', position: 'sticky', top: 0,
          background: '#0e1712f2', backdropFilter: 'blur(2px)', zIndex: 1, borderBottom: '1px solid #26382e',
          gridTemplateColumns: 'minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px' }}>
          {headBtn('name', 'Camp', 'left')}
          {sectors.map(s => headBtn(s.id, s.name))}
          {headBtn('score', 'Total', 'right')}
        </div>
      )}
      {list.map(r => <CampRow key={`${r.campName}|${r.timestamp}`} sectors={sectors} camp={r} wide={wide} />)}
      <div style={{ padding: '8px 0', color: '#93a89b', fontSize: 10 }}>{list.length} camps</div>
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
