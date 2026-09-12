// Page boot for city/index.html. Compiled to dist/src/boot-city.js and loaded
// last. RadialBadge and SectorIcon are defined in src/badge.jsx (loaded first)
// and referenced by bare name in the shared global scope — they are NOT window
// properties. window.SECTORS comes from the plain game-data.js script.

// City card owns a "playa dusk" teal-blue (its own identity, distinct from the
// warm-brown keepsake ShareCard) so the green wheel fills read as fresh growth.
const CARD_BG = 'linear-gradient(160deg, #0e2733 0%, #14323f 100%)';
const playBtn = {
  display: 'inline-block', background: '#558040', color: '#fff',
  padding: '12px 22px', borderRadius: 14, fontWeight: 700, fontSize: 14,
  textDecoration: 'none', boxShadow: '0 3px 0 #38542b',
};

function fmtAsOf(ms) {
  return new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function CityCard({ children }) {
  return (
    <div style={{
      background: CARD_BG, borderRadius: 24, color: '#fff', padding: '28px 26px',
      width: 'min(400px, 100%)', boxSizing: 'border-box', textAlign: 'center',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* dust glow, mirroring ShareCard */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
          GREEN RADIUS · BLAST {new Date().getFullYear()}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.12, textWrap: 'balance' }}>
          Black Rock City
        </div>
        {children}
      </div>
    </div>
  );
}

// Quiet back link above the card, styled like the home screen's underlined links
// (dark-on-tan: it sits on the page background, not the card).
function BackLink() {
  return (
    <a href="/" style={{
      display: 'inline-block', padding: '8px 4px', color: '#2a262080',
      fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
      textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: '#2a262033',
    }}>← Back</a>
  );
}

function CityShell({ children }) {
  // margin auto (not the container's align-items) does the centering:
  // Safari centers flex children against #root's min-height, shoving tall
  // content off the top; auto margins clamp to 0 on overflow.
  return (
    <div style={{ width: 'min(400px, 100%)', display: 'flex', flexDirection: 'column', gap: 6, margin: 'auto' }}>
      <div style={{ textAlign: 'left' }}><BackLink/></div>
      {children}
    </div>
  );
}

function CityStats({ sectors, data }) {
  const pct = Math.round((data.tallyPct || 0) * 100);
  const avgById = {};
  (data.sectorAverages || []).forEach(s => { avgById[s.id] = +s.avg || 0; });
  return (
    <CityCard>
      <div style={{ marginTop: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
        <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.65 }}> achieved</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 12px' }}>
        <div style={{ width: '100%', maxWidth: 300 }}>
          <RadialBadge sectors={sectors} fills={{}} size={300} dark intensities={data.intensities} showGrid={true} fluid/>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: '#d8cbb6', marginBottom: 4 }}>
        <b style={{ color: '#fff' }}>{data.totalYes}</b> of {data.totalPossible} green choices
        {' · '}<b style={{ color: '#fff' }}>{data.count}</b> {data.count === 1 ? 'camp' : 'camps'}
        {' · '}+{data.thisWeek} this week
      </div>
      {data.stale && (
        <div style={{ fontSize: 11, color: '#b8a88f', marginBottom: 4 }}>
          Live tally unavailable right now. Showing the count as of {fmtAsOf(data.generatedAt)}.
        </div>
      )}
      <div style={{ fontSize: 10, letterSpacing: '0.22em', opacity: 0.55, fontWeight: 700, margin: '10px 0 6px' }}>
        SECTOR AVERAGES
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
        {sectors.map(s => {
          const avg = avgById[s.id] || 0;
          const c = avg > 0 ? '#7fc46a' : 'rgba(255,255,255,0.4)';
          return (
            <div key={s.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 4px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <SectorIcon kind={s.icon} size={18} color={c}/>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 }}>{s.name.toUpperCase()}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: c }}>{avg.toFixed(1)}<span style={{ fontSize: 9, opacity: 0.6 }}>/10</span></div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <a href="/" style={playBtn}>Add your camp's radius ↗</a>
      </div>
    </CityCard>
  );
}

// ── Extra public stats panels (Score Spread / Momentum / opportunities) ─────
// Fed by the optional data.stats block on GET /api/city. The whole block is
// new and additive, so every field is guarded: a stale edge cache can still
// serve the old response shape (no `stats` key) for up to 5 minutes after a
// deploy, and any panel whose data doesn't check out just doesn't render
// rather than showing an empty or broken card.
const subPanelStyle = {
  background: CARD_BG, borderRadius: 20, color: '#fff', padding: '20px 20px 22px',
  width: 'min(400px, 100%)', boxSizing: 'border-box', textAlign: 'left',
  boxShadow: '0 16px 40px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
  position: 'relative', overflow: 'hidden',
};
const subPanelGlow = { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 0%, rgba(217,136,92,0.14), transparent 60%)', pointerEvents: 'none' };
const subPanelLabel = { fontSize: 10, letterSpacing: '0.22em', fontWeight: 700, opacity: 0.6, marginBottom: 10 };
const subPanelHint = { fontSize: 11.5, lineHeight: 1.55, opacity: 0.72, margin: '0 0 12px' };

function normalizeBins(histogram) {
  if (!histogram || !Array.isArray(histogram.bins)) return [];
  return histogram.bins
    .filter(b => b && typeof b.label === 'string' && Number.isFinite(Number(b.count)))
    .map(b => ({ label: b.label, count: Number(b.count) }));
}
function normalizeWeekly(weekly) {
  if (!Array.isArray(weekly)) return [];
  return weekly
    .filter(w => w && Number.isFinite(Number(w.start)) && Number.isFinite(Number(w.count)))
    .map(w => ({ start: Number(w.start), count: Number(w.count) }));
}
function normalizeOpportunities(opportunities) {
  if (!Array.isArray(opportunities)) return [];
  return opportunities
    .filter(o => o && typeof o.title === 'string' && typeof o.sector === 'string'
      && Number.isFinite(Number(o.rate)) && Number.isFinite(Number(o.asked)))
    .map(o => ({ id: o.id != null ? o.id : o.title, title: o.title, sector: o.sector, rate: Number(o.rate), asked: Number(o.asked) }))
    .slice(0, 5);
}

// Inline-block bars on a shared baseline; height scales to the busiest bar.
function CityBarChart({ data, max, highlightLast, barTitle }) {
  const H = 50;
  const m = max > 0 ? max : 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: H + 28, marginTop: 4 }}>
      {data.map((d, i) => {
        const hot = highlightLast && i === data.length - 1;
        const h = Math.max(d.count ? 3 : 1, Math.round((d.count / m) * H));
        return (
          <div key={i} title={barTitle(d)} style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
            <div style={{ fontSize: 9, color: d.count ? '#cdebd8' : 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>{d.count || ''}</div>
            <div style={{ height: h, borderRadius: '3px 3px 0 0', margin: '1px auto 0',
              background: d.count ? (hot ? '#7fc46a' : 'rgba(255,255,255,0.3)') : 'rgba(255,255,255,0.08)' }} />
            <div style={{ fontSize: 8, color: hot ? '#7fc46a' : 'rgba(255,255,255,0.55)', fontWeight: 700, marginTop: 3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function CityPulsePanel({ count, campers }) {
  return (
    <div data-city-pulse style={subPanelStyle}>
      <div style={subPanelGlow}/>
      <div style={{ position: 'relative' }}>
        <div style={subPanelLabel}>CITY PULSE</div>
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>
          <b style={{ color: '#7fc46a' }}>{count}</b> {count === 1 ? 'camp is' : 'camps are'} in the tally
        </div>
        {campers > 0 && (
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
            About {campers.toLocaleString()} campers represented
          </div>
        )}
      </div>
    </div>
  );
}

function CityHistogramPanel({ bins, max }) {
  const m = Number.isFinite(max) && max > 0 ? max : bins.reduce((mm, b) => Math.max(mm, b.count), 0);
  return (
    <div data-city-histogram style={subPanelStyle}>
      <div style={subPanelGlow}/>
      <div style={{ position: 'relative' }}>
        <div style={subPanelLabel}>SCORE SPREAD</div>
        <div style={subPanelHint}>How camps' final scores are spread across the city so far.</div>
        <CityBarChart data={bins} max={m} highlightLast={false}
          barTitle={d => `${d.count} ${d.count === 1 ? 'camp' : 'camps'} scoring ${d.label}`}/>
      </div>
    </div>
  );
}

function CityWeeklyPanel({ weeks }) {
  const fmtWk = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const data = weeks.map(w => ({ ...w, label: fmtWk(w.start) }));
  const max = weeks.reduce((m, w) => Math.max(m, w.count), 0);
  return (
    <div data-city-weekly style={subPanelStyle}>
      <div style={subPanelGlow}/>
      <div style={{ position: 'relative' }}>
        <div style={subPanelLabel}>MOMENTUM</div>
        <div style={subPanelHint}>New camps joining the tally, week by week. This week is highlighted.</div>
        <CityBarChart data={data} max={max} highlightLast
          barTitle={d => `Week of ${fmtWk(d.start)}: ${d.count} ${d.count === 1 ? 'camp' : 'camps'}`}/>
      </div>
    </div>
  );
}

function CityOppsPanel({ opps }) {
  return (
    <div data-city-opps style={subPanelStyle}>
      <div style={subPanelGlow}/>
      <div style={{ position: 'relative' }}>
        <div style={subPanelLabel}>WHERE THE CITY CAN GROW</div>
        <div style={subPanelHint}>These are the questions the fewest camps have said yes to, citywide. A little effort here goes a long way.</div>
        {opps.map(o => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#f2ece1' }}>{o.title} <span style={{ opacity: 0.6 }}>({o.sector})</span></span>
            <b style={{ fontVariantNumeric: 'tabular-nums', color: '#e0b25c', flexShrink: 0, fontSize: 13 }}>{Math.round(o.rate * 100)}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

// Public playa map (#114): one pin per camp this season at its parsed BRC
// address. Same fan geometry as the admin Playa Map (admin/admin.jsx); the
// polar math is four lines, inlined rather than shared so the admin map's
// fail-open PlayaAddress fallback stays untouched. /api/city sends only
// {name, hour, ring}; camps without coordinates sit in the Open camping box.
// No name labels: the card is 400px wide, so names live in the tap/hover tip.
const MAP_S = 330, MAP_CX = 360, MAP_CY = 180; // unit space -> 720x532 viewBox
function mapRingR(ring) { return 0.40 + ring * 0.05; }
function mapAt(hour, ring) {
  const th = (hour / 12) * 2 * Math.PI, r = mapRingR(ring) * MAP_S;
  return { x: MAP_CX + r * Math.sin(th), y: MAP_CY - r * Math.cos(th) };
}
function fmtPlaya(hour, ring) {
  const h = Math.floor(hour), m = Math.round((hour - h) * 60);
  return `${h}:${String(m).padStart(2, '0')} & ${ring === 0 ? 'Esplanade' : 'ABCDEFGHIJK'[ring - 1]}`;
}
function normalizeCamps(camps) {
  if (!Array.isArray(camps)) return [];
  return camps
    .filter(c => c && typeof c.name === 'string' && c.name.trim())
    .map(c => {
      const hour = Number(c.hour), ring = Number(c.ring);
      const placed = hour >= 2 && hour <= 10 && Number.isInteger(ring) && ring >= 0 && ring <= 11;
      return placed ? { name: c.name, hour, ring } : { name: c.name };
    });
}
function CityMapPanel({ camps }) {
  const [tip, setTip] = React.useState(null); // in viewBox coords
  const placed = camps.filter(c => c.hour != null);
  const open = camps.filter(c => c.hour == null);
  if (!placed.length) return null;
  const PIN_R = 6;
  // Open camping box: bottom-left corner, outside the 2:00-10:00 fan.
  const OC = { cols: 5, gap: 26, x: 12 };
  const ocRows = Math.ceil(open.length / OC.cols);
  const ocW = Math.max(122, 24 + Math.min(open.length, OC.cols) * OC.gap);
  const ocH = 24 + ocRows * OC.gap + 4;
  const ocY = 526 - ocH;
  const show = (x, y, c, loc) => setTip({ x, y: y - PIN_R - 3, name: c.name, loc });
  // Hover on desktop; tap on touch (the container click below hides it).
  const pin = (c, x, y, key, loc) => (
    <g key={key} data-pin role="img" aria-label={`${c.name} · ${loc}`} style={{ cursor: 'pointer' }}
      onClick={e => { e.stopPropagation(); show(x, y, c, loc); }}
      onMouseEnter={() => show(x, y, c, loc)} onMouseLeave={() => setTip(null)}>
      <circle cx={x} cy={y} r={PIN_R} fill="#7fc46a" stroke="#2f6b3a" strokeWidth="1.5"/>
    </g>
  );
  const grid = 'rgba(255,255,255,0.14)', gridFaint = 'rgba(255,255,255,0.07)', ink = 'rgba(255,255,255,0.5)';
  return (
    <div data-city-map style={subPanelStyle}>
      <div style={subPanelGlow}/>
      <div style={{ position: 'relative' }}>
        <div style={subPanelLabel}>THE CITY MAP</div>
        <div style={subPanelHint}>Every camp that played this year, pinned at its playa address. Tap a pin for the camp's name.</div>
        <div style={{ position: 'relative' }} onClick={() => setTip(null)}>
          <svg viewBox="0 0 720 532" style={{ width: '100%', height: 'auto', display: 'block' }}
            role="img" aria-label="Map of camps across the Black Rock City street grid">
            {/* radial streets: whole hours solid, half hours fainter */}
            {Array.from({ length: 17 }, (_, i) => 2 + i * 0.5).map(h => {
              const a = mapAt(h, 0), b = mapAt(h, 11);
              return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={h % 1 ? gridFaint : grid} strokeWidth="1"/>;
            })}
            {/* ring arcs, Esplanade (0) through K (11), 2:00 -> 10:00 via 6:00 */}
            {Array.from({ length: 12 }, (_, ring) => {
              const r = mapRingR(ring) * MAP_S;
              const a = mapAt(2, ring), b = mapAt(10, ring);
              return <path key={ring} d={`M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y}`}
                fill="none" stroke={ring === 0 ? 'rgba(255,255,255,0.24)' : grid} strokeWidth="1"/>;
            })}
            {Array.from({ length: 9 }, (_, i) => 2 + i).map(h => {
              const p = mapAt(h, 12.3);
              return <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
                fontSize="13" fill={ink} fontWeight="700">{h}:00</text>;
            })}
            {Array.from({ length: 12 }, (_, ring) => (
              <text key={ring} x={MAP_CX + 6} y={MAP_CY + mapRingR(ring) * MAP_S - 3}
                fontSize="11" fill={ink} fontWeight="700">{ring === 0 ? 'ESP' : 'ABCDEFGHIJK'[ring - 1]}</text>
            ))}
            <circle cx={MAP_CX} cy={MAP_CY} r="4" fill="#d9885c"><title>The Man</title></circle>
            {open.length > 0 && (
              <g data-open-camping>
                <rect x={OC.x} y={ocY} width={ocW} height={ocH} rx="10"
                  fill="rgba(255,255,255,0.04)" stroke={grid} strokeDasharray="4 3"/>
                <text x={OC.x + 12} y={ocY + 15} fontSize="10" letterSpacing="1.5" fill={ink} fontWeight="700">OPEN CAMPING</text>
                {open.map((c, i) => pin(c,
                  OC.x + 24 + (i % OC.cols) * OC.gap,
                  ocY + 24 + Math.floor(i / OC.cols) * OC.gap + OC.gap / 2 - 2,
                  `open-${i}`, 'Open camping'))}
              </g>
            )}
            {/* camp pins last, above the grid */}
            {placed.map((c, i) => { const p = mapAt(c.hour, c.ring); return pin(c, p.x, p.y, i, fmtPlaya(c.hour, c.ring)); })}
          </svg>
          {tip && (
            <div data-map-tip style={{
              // x clamped so an edge pin's tip stays inside the card (overflow is hidden)
              position: 'absolute', left: `${Math.min(Math.max(tip.x / 7.2, 22), 78)}%`, top: `${tip.y / 5.32}%`,
              transform: 'translate(-50%, -100%)', pointerEvents: 'none', zIndex: 5, maxWidth: '44%',
              background: '#0b1c24', border: '1px solid #7fc46a', borderRadius: 8,
              padding: '6px 10px', fontSize: 12, lineHeight: 1.45, color: '#fff',
              boxShadow: '0 6px 18px rgba(0,0,0,0.45)',
            }}>
              <b>{tip.name}</b>
              <div style={{ opacity: 0.7 }}>{tip.loc}</div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>{camps.length} {camps.length === 1 ? 'camp' : 'camps'} on the map</div>
      </div>
    </div>
  );
}

// Single guarded entry point: renders nothing at all if `stats` is missing or
// not an object (old cached /api/city shape), and each sub-panel only if its
// own slice of data survives normalization.
function CityStatsExtras({ stats, count }) {
  if (!stats || typeof stats !== 'object') return null;
  const campers = Number(stats.campers);
  const bins = normalizeBins(stats.histogram);
  const weeks = normalizeWeekly(stats.weekly);
  const opps = normalizeOpportunities(stats.opportunities);
  return (
    <React.Fragment>
      <CityPulsePanel count={count} campers={campers}/>
      {bins.length > 0 && <CityHistogramPanel bins={bins} max={stats.histogram && Number(stats.histogram.max)}/>}
      {weeks.length > 0 && <CityWeeklyPanel weeks={weeks}/>}
      {opps.length > 0 && <CityOppsPanel opps={opps}/>}
    </React.Fragment>
  );
}

function CityEmpty() {
  return (
    <CityCard>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.8, margin: '14px 0 20px' }}>
        No camps on the board yet this year. Every camp that plays lights up this page. Be the first.
      </div>
      <a href="/" style={playBtn}>Play the Green Radius Game ↗</a>
    </CityCard>
  );
}

function CityDegraded() {
  return (
    <CityCard>
      <div style={{ fontSize: 16, fontWeight: 800, margin: '14px 0 6px' }}>The tally is taking a breather.</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.55, opacity: 0.8, marginBottom: 20 }}>
        We couldn't load the city's numbers right now. The game itself is fine, and your play still counts toward the tally.
      </div>
      <a href="/" style={playBtn}>Play the Green Radius Game ↗</a>
    </CityCard>
  );
}

function CityPage({ sectors }) {
  const [state, setState] = React.useState({ status: 'loading', data: null });
  React.useEffect(() => {
    fetch('/api/city', { headers: { 'Accept': 'application/json' } })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status)))
      .then(data => setState({ status: 'ready', data }))
      .catch(() => setState({ status: 'error', data: null }));
  }, []);
  if (state.status === 'loading') return (
    <div className="grg-loading" style={{ margin: 'auto' }}>
      <svg width="46" height="46" viewBox="0 0 64 64" aria-hidden="true">
        <g className="grg-loading-wheel">
          <path fill="#A3D178" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L32 10 A23 23 0 0 1 51.92 21.5 Z"/>
          <path fill="#86C169" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L51.92 21.5 A23 23 0 0 1 51.92 44.5 Z"/>
          <path fill="#68B05C" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L51.92 44.5 A23 23 0 0 1 32 56 Z"/>
          <path fill="#56A85C" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L32 56 A23 23 0 0 1 12.08 44.5 Z"/>
          <path fill="#439F5B" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L12.08 44.5 A23 23 0 0 1 12.08 21.5 Z"/>
          <path fill="#31975B" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" d="M32 33 L12.08 21.5 A23 23 0 0 1 32 10 Z"/>
          <circle cx="32" cy="33" r="23" fill="none" stroke="#2a2620" strokeWidth="2.8"/>
          <circle cx="32" cy="33" r="3.4" fill="#2a2620"/>
        </g>
        <polygon points="32,12 26.8,3 37.2,3" fill="#2a2620"/>
      </svg>
      <div style={{ fontWeight: 700 }}>Adding up the city's progress…</div>
    </div>
  );
  if (state.status === 'error') return <CityShell><CityDegraded/></CityShell>;
  if (!state.data.count) return <CityShell><CityEmpty/></CityShell>;
  return (
    <CityShell>
      <CityStats sectors={sectors} data={state.data}/>
      <CityMapPanel camps={normalizeCamps(state.data.camps)}/>
      <CityStatsExtras stats={state.data.stats} count={state.data.count}/>
    </CityShell>
  );
}

// React mounts immediately and renders its own spinner during the fetch, so the
// swap from the static placeholder is seamless; final states replace it on settle.
function Boot() {
  return <CityPage sectors={window.SECTORS}/>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<Boot/>);
