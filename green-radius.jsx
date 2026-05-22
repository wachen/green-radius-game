// GreenRadius.jsx — main game component
// Two design directions are exposed via the `variant` prop ("dimensional" | "flat-playa").

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ─── persistence ──────────────────────────────────────────────────────────────
// Saves the in-progress game so a refresh resumes where you left off.
// Bump STORAGE_VERSION when the saved shape changes so old saves are discarded
// instead of trying to merge them in.
const STORAGE_KEY = 'green-radius-game/v1';
const STORAGE_VERSION = 1;

function loadSaved(sectors) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== STORAGE_VERSION) return null;
    // Schema sanity: every current sector id must be present and well-typed
    // in the saved arrays. If sectors changed, drop the save instead of
    // mixing shapes — better to start fresh than glitch.
    const ok = sectors.every(s =>
      Array.isArray(data.levelStates?.[s.id]) &&
      typeof data.sectorCursor?.[s.id] === 'number' &&
      typeof data.sectorClosed?.[s.id] === 'boolean'
    );
    return ok ? data : null;
  } catch {
    return null;
  }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── icons ────────────────────────────────────────────────────────────────────
function SectorIcon({ kind, size = 28, color = '#fff' }) {
  const s = size, sw = 1.8;
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (kind) {
    case 'water':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M12 3c-3 4-6 7-6 11a6 6 0 0 0 12 0c0-4-3-7-6-11z"/></svg>;
    case 'waste':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"/></svg>;
    case 'power':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M13 3 5 14h6l-1 7 8-11h-6z"/></svg>;
    case 'transport':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M4 16V8a2 2 0 0 1 2-2h8l4 5v5M4 16h16M4 16v2a1 1 0 0 0 1 1h2M20 16v2a1 1 0 0 1-1 1h-2M14 6v5h4"/><circle {...p} cx="8" cy="18" r="1.5"/><circle {...p} cx="17" cy="18" r="1.5"/></svg>;
    case 'food':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M12 21c5-5 8-9 8-13a8 8 0 0 0-16 0c0 4 3 8 8 13zM12 3v18M8 7c1 1.5 1 3 0 5M16 7c-1 1.5-1 3 0 5"/></svg>;
    case 'shelter':
      return <svg width={s} height={s} viewBox="0 0 24 24"><path {...p} d="M3 20 12 5l9 15M7 20v-5h10v5"/></svg>;
    default: return null;
  }
}

// ─── wheel geometry ───────────────────────────────────────────────────────────
function polar(cx, cy, r, deg) {
  const a = (deg - 90) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
function arcPath(cx, cy, rIn, rOut, a0, a1) {
  const [x0o, y0o] = polar(cx, cy, rOut, a0);
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const [x0i, y0i] = polar(cx, cy, rIn, a0);
  const large = (a1 - a0) > 180 ? 1 : 0;
  return `M ${x0o} ${y0o} A ${rOut} ${rOut} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${rIn} ${rIn} 0 ${large} 0 ${x0i} ${y0i} Z`;
}

// ─── the wheel ────────────────────────────────────────────────────────────────
// Sectors render as 4 stacked rings (level 1 inner → level 4 outer).
// Each ring cell has its own state: 'locked' | 'open' | 'green' | 'failed'.
function Wheel({ sectors, levelStates, rotation, spinning, onSpin, canSpin, variant, palette }) {
  // Internal SVG coordinate space. Wheel outer radius is 200, so SIZE needs at
  // least 400 + headroom for the drop-shadow filter and dust-ring glow.
  const SIZE = 420;
  const cx = SIZE / 2, cy = SIZE / 2;
  const ringRadii = [60, 100, 140, 180]; // inner edges; outer = next or 200
  const ringOuter = [100, 140, 180, 200];
  const N = sectors.length;
  const sweep = 360 / N;

  const dim = variant === 'dimensional';

  // Cell colors per state — neutral/sandy ramp; green is reserved for completion.
  // Outer rings are progressively lighter so the wheel still has visual rhythm,
  // but no per-sector color noise to compete with the green earned.
  const ringTint = ['#c9b89a', '#d3c4a8', '#dcd0b5', '#e4d9c1']; // L1 darkest → L4 lightest
  const cellFill = (sector, levelState, li) => {
    if (levelState === 'green') return '#5BA84A';
    if (levelState === 'failed') return 'rgba(60,40,30,0.16)';
    if (levelState === 'open') return '#b9a47e'; // current target ring — slightly warmer
    return ringTint[li]; // locked / pending
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%', maxWidth: 380, aspectRatio: '1 / 1',
      margin: '0 auto',
    }}>
      {/* outer dust ring */}
      {dim && (
        <div style={{
          position: 'absolute', inset: -14, borderRadius: '50%',
          background: 'radial-gradient(circle, transparent 60%, rgba(217,136,92,0.15) 75%, transparent 100%)',
          filter: 'blur(4px)',
        }} />
      )}

      <svg
        width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          display: 'block',
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 4.2s cubic-bezier(0.17, 0.67, 0.16, 0.99)' : 'none',
          filter: dim ? 'drop-shadow(0 12px 28px rgba(40,20,10,0.35))' : 'drop-shadow(0 4px 12px rgba(40,20,10,0.18))',
        }}
      >
        <defs>
          {sectors.map((s, i) => (
            <radialGradient key={s.id} id={`grad-${s.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.85"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="1"/>
            </radialGradient>
          ))}
        </defs>

        {/* cells */}
        {sectors.map((sector, si) => {
          const a0 = si * sweep;
          const a1 = (si + 1) * sweep;
          return [0, 1, 2, 3].map(li => {
            const state = levelStates[sector.id][li];
            const fill = cellFill(sector, state, li);
            return (
              <g key={`${sector.id}-${li}`}>
                <path
                  d={arcPath(cx, cy, ringRadii[li], ringOuter[li], a0, a1)}
                  fill={fill}
                  stroke={palette.bg}
                  strokeWidth={dim ? 2 : 1.5}
                />
                {state === 'green' && (
                  <path
                    d={arcPath(cx, cy, ringRadii[li], ringOuter[li], a0, a1)}
                    fill="url(#greenShimmer)"
                    fill-opacity="0.3"
                  />
                )}
              </g>
            );
          });
        })}

        {/* sector dividers (radial lines) */}
        {sectors.map((_, si) => {
          const ang = si * sweep;
          const [x0, y0] = polar(cx, cy, 60, ang);
          const [x1, y1] = polar(cx, cy, 200, ang);
          return <line key={si} x1={x0} y1={y0} x2={x1} y2={y1} stroke={palette.bg} strokeWidth={2} />;
        })}

        {/* sector icons (placed in level-1 ring) */}
        {sectors.map((sector, si) => {
          const ang = si * sweep + sweep / 2;
          const [x, y] = polar(cx, cy, 80, ang);
          return (
            <g key={`icon-${sector.id}`} transform={`translate(${x - 14} ${y - 14}) rotate(${-rotation} 14 14)`}>
              <SectorIcon kind={sector.icon} size={28} color="#3a2a20" />
            </g>
          );
        })}

        {/* center hub */}
        <circle cx={cx} cy={cy} r={56} fill={palette.hub} stroke={palette.hubStroke} strokeWidth={2} />
        {dim && <circle cx={cx} cy={cy} r={56} fill="url(#hubGloss)" />}

        {/* defs continued */}
        <defs>
          <radialGradient id="hubGloss" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </radialGradient>
          <linearGradient id="greenShimmer" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.5"/>
            <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>

      {/* center spin button (counter-rotates with wheel — sits on top, no rotation) */}
      <button
        onClick={canSpin && !spinning ? onSpin : undefined}
        disabled={!canSpin || spinning}
        style={{
          position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
          width: 96, height: 96, borderRadius: '50%', border: 'none',
          background: spinning ? palette.hub : palette.accent,
          color: palette.bg,
          fontSize: 13, fontWeight: 800, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: canSpin && !spinning ? 'pointer' : 'default',
          boxShadow: dim
            ? `0 6px 18px ${palette.accent}66, inset 0 -3px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.25)`
            : `0 3px 0 ${palette.accentDark}`,
          transition: 'transform 0.15s, box-shadow 0.15s',
          zIndex: 4,
        }}
        onMouseDown={e => canSpin && !spinning && (e.currentTarget.style.transform = 'translate(-50%,-50%) scale(0.96)')}
        onMouseUp={e => (e.currentTarget.style.transform = 'translate(-50%,-50%)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translate(-50%,-50%)')}
      >
        {spinning ? '...' : (canSpin ? 'Spin' : 'Done')}
      </button>

      {/* fixed pointer at top */}
      <div style={{
        position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '14px solid transparent',
        borderRight: '14px solid transparent',
        borderTop: `22px solid ${palette.accent}`,
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
        zIndex: 3,
      }} />
    </div>
  );
}

// ─── question modal ───────────────────────────────────────────────────────────
// Each question has: title, prompt (yes/no question), description, optional link.
// For tier 4 (level index 3), the question is generated from a topic the user
// picks via dropdown. `tier4Topics` is provided per-sector.
function QuestionModal({ sector, level, questions, tier4Topics, onComplete, palette, variant }) {
  const isTier4 = level === 3;
  const total = isTier4 ? 4 : questions.length;

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [pickedTopicIds, setPickedTopicIds] = useState([]); // for tier4
  const [topicId, setTopicId] = useState(''); // currently selected dropdown value

  // Available topics for this slot — exclude already-picked
  const availableTopics = isTier4
    ? (tier4Topics || []).filter(t => !pickedTopicIds.includes(t.id))
    : [];

  const q = isTier4
    ? (tier4Topics || []).find(t => t.id === topicId) || null
    : questions[idx];

  function answer(yes) {
    const next = [...answers, yes];
    setAnswers(next);
    if (isTier4) {
      const newPicked = [...pickedTopicIds, topicId];
      setPickedTopicIds(newPicked);
      setTopicId('');
    }
    if (idx + 1 >= total) {
      const allYes = next.every(a => a);
      onComplete(allYes, next);
    } else {
      setIdx(idx + 1);
    }
  }

  const tierLabels = ['Start Here', 'Beginner', 'Intermediate', 'Advanced'];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10,
      background: 'rgba(20,12,8,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      animation: 'qm-fade 0.25s ease',
      overflowY: 'auto',
    }}>
      <div style={{
        background: palette.card,
        color: palette.text,
        borderRadius: 24,
        padding: 26,
        maxWidth: 400, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        position: 'relative',
        animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* sector tag */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#3a2a20', color: '#f0eee9',
          padding: '6px 12px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <SectorIcon kind={sector.icon} size={14} color="#fff"/>
          {sector.name} · Tier {level + 1} · {tierLabels[level]}
        </div>

        {/* progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: i < idx ? (answers[i] ? '#5BA84A' : 'rgba(60,40,30,0.35)')
                       : i === idx ? '#3a2a20'
                       : 'rgba(0,0,0,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Tier 4: topic picker */}
        {isTier4 && !q && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 6 }}>
              CHOOSE A TOPIC ({idx + 1} OF 4)
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: palette.text + 'cc', marginBottom: 12, textWrap: 'pretty' }}>
              Pick an advanced {sector.name.toLowerCase()} idea your camp pursued — or one of "Our Camp's Idea" entries.
            </div>
            <select
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              style={{
                width: '100%', padding: '14px 14px', borderRadius: 12,
                border: `1.5px solid ${palette.text}22`,
                background: '#fff', color: palette.text,
                fontSize: 15, fontFamily: 'inherit', outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23666' d='M0 0h12L6 8z'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                paddingRight: 36,
              }}
            >
              <option value="">Select a topic…</option>
              {availableTopics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Question content */}
        {q && (
          <>
            <div style={{
              fontSize: 11, letterSpacing: '0.15em', fontWeight: 700,
              color: '#5BA84A', marginBottom: 6,
            }}>
              {isTier4 ? `STEP ${sector.code}${idx + 7}` : `STEP ${q.code}`}
            </div>
            <div style={{
              fontSize: 22, lineHeight: 1.2, fontWeight: 800,
              marginBottom: 10, textWrap: 'balance',
              letterSpacing: '-0.01em',
            }}>
              {q.title}
            </div>
            <div style={{
              fontSize: 17, lineHeight: 1.35, fontWeight: 600,
              marginBottom: 12, textWrap: 'pretty',
              color: palette.text,
            }}>
              {q.prompt || q.title + '?'}
            </div>
            <div style={{
              fontSize: 13, lineHeight: 1.5,
              color: palette.text + 'aa',
              marginBottom: q.link ? 10 : 20,
              textWrap: 'pretty',
              maxHeight: 140, overflowY: 'auto',
            }}>
              {q.description}
            </div>
            {q.link && (
              <a href={q.link.url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
                color: '#5BA84A', textDecoration: 'none',
                marginBottom: 20,
                borderBottom: '1px solid #5BA84A55',
                paddingBottom: 1,
              }}>
                {q.link.label} ↗
              </a>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => answer(false)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  border: `1.5px solid ${palette.text}22`,
                  background: 'transparent', color: palette.text,
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >No</button>
              <button
                onClick={() => answer(true)}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  border: 'none',
                  background: '#5BA84A', color: '#fff',
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: '0 3px 0 #3d7a31',
                }}
              >Yes</button>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: palette.text + '99' }}>
          {idx + 1} of {total}
        </div>
      </div>
    </div>
  );
}

// ─── result toast (between questions and next spin) ───────────────────────────
function ResultToast({ kind, sector, level, palette, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [onClose]);

  const isGreen = kind === 'green';
  const isFail = kind === 'failed';
  const isLockedOut = kind === 'locked-out';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'qm-fade 0.25s ease',
    }}>
      <div style={{
        background: isGreen ? '#5BA84A' : '#3a2a20',
        color: '#fff', padding: '22px 28px', borderRadius: 18,
        boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
        textAlign: 'center', maxWidth: 320,
        animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', opacity: 0.8, marginBottom: 6 }}>
          {sector?.name?.toUpperCase()} {level !== undefined && `· LEVEL ${level + 1}`}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>
          {isGreen && '✓ Level cleared — turning green'}
          {isFail && 'Sector closed — keep what you earned'}
          {isLockedOut && 'Already complete — re-spinning'}
        </div>
      </div>
    </div>
  );
}

// ─── radial badge (final result) ──────────────────────────────────────────────
// Grid of green ring-cells: each sector shows its 4 levels as concentric arcs.
// No gaps between sectors — a sector reads as a continuous radial wedge whose
// outer reach equals its consecutive-greens depth. Adjacent sectors share
// boundaries so the green area forms a single silhouette.
function RadialBadge({ sectors, levelStates, size = 320, dark = true, showLabels = true, showCenter = true, showGrid = false }) {
  const cx = size / 2, cy = size / 2;
  // [center, L1, L2, L3, L4]
  const RINGS = [0, 0.30, 0.50, 0.66, 0.82].map(f => f * size / 2);
  const N = sectors.length;
  const sweep = 360 / N;

  const depths = sectors.map(s => {
    const arr = levelStates[s.id];
    let d = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === 'green') d++;
      else break;
    }
    return d;
  });

  const greenCount = sectors.reduce((acc, s) =>
    acc + levelStates[s.id].filter(x => x === 'green').length, 0
  );

  const baseColor = dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const baseStroke = dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const gridStroke = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';

  // Solid pie wedges from center → reads as one continuous green shape.
  function buildSilhouette() {
    let d = '';
    for (let i = 0; i < N; i++) {
      const depth = depths[i];
      if (depth === 0) continue;
      const outerR = RINGS[depth];
      const a0 = i * sweep;
      const a1 = (i + 1) * sweep;
      const [x0, y0] = polar(cx, cy, outerR, a0);
      const [x1, y1] = polar(cx, cy, outerR, a1);
      const large = sweep > 180 ? 1 : 0;
      d += ` M ${cx} ${cy} L ${x0} ${y0} A ${outerR} ${outerR} 0 ${large} 1 ${x1} ${y1} Z`;
    }
    return d.trim();
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`grBadge-${size}`} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#7fc46a"/>
          <stop offset="60%" stopColor="#5BA84A"/>
          <stop offset="100%" stopColor="#3d7a31"/>
        </radialGradient>
      </defs>

      {showLabels && (
        <circle cx={cx} cy={cy} r={RINGS[4]} fill={baseColor} stroke={baseStroke} strokeWidth={1}/>
      )}

      <path d={buildSilhouette()} fill={`url(#grBadge-${size})`}/>

      {showGrid && (
        <g style={{ pointerEvents: 'none' }}>
          {[1,2,3,4].map(li => (
            <circle key={li} cx={cx} cy={cy} r={RINGS[li]}
              fill="none" stroke={gridStroke} strokeWidth={1}
              strokeDasharray={li === 4 ? 'none' : '2 3'}
            />
          ))}
          {sectors.map((_, si) => {
            const ang = si * sweep;
            const [xe, ye] = polar(cx, cy, RINGS[4], ang);
            return <line key={si} x1={cx} y1={cy} x2={xe} y2={ye} stroke={gridStroke} strokeWidth={1}/>;
          })}
        </g>
      )}

      {showLabels && sectors.map((sector, si) => {
        const ang = si * sweep + sweep / 2;
        const [x, y] = polar(cx, cy, RINGS[4] + 14, ang);
        const rotate = ang > 180 ? ang - 270 : ang - 90;
        return (
          <text key={sector.id} x={x} y={y}
            textAnchor="middle" dominantBaseline="middle"
            fontSize="9" fontWeight="700" letterSpacing="0.18em"
            fill={dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.5)'}
            transform={`rotate(${rotate} ${x} ${y})`}
          >
            {sector.name.toUpperCase()}
          </text>
        );
      })}

      {showCenter && (
        <text x={cx} y={cy + size*0.04} textAnchor="middle"
          fontSize={size*0.13} fontWeight="900" fill="#fff"
          style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 0.6 }}>
          {greenCount}
          <tspan fontSize={size*0.055} dx="2" opacity="0.75">/24</tspan>
        </text>
      )}
    </svg>
  );
}

// Mini logomark version — no labels, no center, no background ring.
// Just the camp's silhouette as a tiny logo glyph next to the camp name.
function RadiusLogomark({ sectors, levelStates, size = 32 }) {
  return <RadialBadge sectors={sectors} levelStates={levelStates} size={size} showLabels={false} showCenter={false} dark={false}/>;
}

// ─── shareable card ───────────────────────────────────────────────────────────
function ShareCard({ sectors, levelStates, campName, leadName, year, palette }) {
  return (
    <div style={{
      width: 360, padding: 28,
      background: 'linear-gradient(155deg, #1c1410 0%, #2a1c14 100%)',
      borderRadius: 24, color: '#fff',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* dust glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)', pointerEvents: 'none' }}/>

      <div style={{ position: 'relative' }}>
        {/* top block: large logomark left, 3-line text right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: '0 0 auto' }}>
            <RadiusLogomark sectors={sectors} levelStates={levelStates} size={84}/>
          </div>
          <div style={{ flex: '1 1 auto', minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 2 }}>
              GREEN RADIUS · {year}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, textWrap: 'balance', marginBottom: 4 }}>
              {campName || 'Theme Camp'}
            </div>
            <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.3 }}>
              Sustainability Lead · {leadName || '—'}
            </div>
          </div>
        </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 14px' }}>
          <RadialBadge sectors={sectors} levelStates={levelStates} size={300} showGrid={true}/>
        </div>

        {/* sector breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {sectors.map(s => {
            const greens = levelStates[s.id].filter(x => x === 'green').length;
            return (
              <div key={s.id} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <SectorIcon kind={s.icon} size={18} color={greens > 0 ? '#5BA84A' : 'rgba(255,255,255,0.4)'}/>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 }}>
                  {s.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: greens > 0 ? '#5BA84A' : 'rgba(255,255,255,0.4)' }}>
                  L{greens}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 9, letterSpacing: '0.18em', opacity: 0.5, fontWeight: 600, textAlign: 'center' }}>
          GREENTHEMECAMPCOMMUNITY.ORG
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── intro / camp setup ───────────────────────────────────────────────────────
function Intro({ onStart, palette }) {
  const [campName, setCampName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [year, setYear] = useState('2026');

  return (
    <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
        color: palette.accent, marginBottom: 12,
      }}>GREEN THEME CAMP COMMUNITY</div>
      <h1 style={{
        fontSize: 44, lineHeight: 1, fontWeight: 900, margin: '0 0 8px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        Green<br/>Radius
      </h1>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: palette.text + 'cc', marginBottom: 32, textWrap: 'pretty' }}>
        Spin the wheel. Answer honestly. Discover your camp's unique footprint across six sustainability sectors.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, textAlign: 'left' }}>
        <Field label="Camp name" value={campName} onChange={setCampName} placeholder="e.g. Hotel California" palette={palette}/>
        <Field label="Sustainability lead" value={leadName} onChange={setLeadName} placeholder="e.g. Ash Rivera" palette={palette}/>
        <Field label="Year" value={year} onChange={setYear} placeholder="2026" palette={palette}/>
      </div>

      <button
        onClick={() => campName.trim() && onStart({ campName: campName.trim(), leadName: leadName.trim(), year })}
        disabled={!campName.trim()}
        style={{
          width: '100%', padding: '16px', borderRadius: 14,
          border: 'none', background: campName.trim() ? palette.accent : '#aaa', color: '#fff',
          fontSize: 14, fontWeight: 800, letterSpacing: '0.15em',
          textTransform: 'uppercase', cursor: campName.trim() ? 'pointer' : 'default',
          boxShadow: campName.trim() ? `0 4px 0 ${palette.accentDark}` : 'none',
        }}
      >Begin →</button>

      <div style={{ fontSize: 10, letterSpacing: '0.15em', color: palette.text + '66', marginTop: 24, fontWeight: 600 }}>
        24 LEVELS · 60 QUESTIONS · 6 SECTORS
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, palette }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 4 }}>
        {label.toUpperCase()}
      </div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1.5px solid ${palette.text}22`,
          background: palette.card, color: palette.text,
          fontSize: 15, outline: 'none',
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

// ─── main game ────────────────────────────────────────────────────────────────
function GreenRadiusGame({ variant = 'dimensional', palette, debugFill = false }) {
  const sectors = window.SECTORS;

  // Pull any saved game once on mount. If null, fall through to defaults.
  const saved = useMemo(() => loadSaved(sectors), [sectors]);

  const [phase, setPhase] = useState(saved?.phase || 'intro'); // intro | playing | done
  const [camp, setCamp] = useState(saved?.camp || { campName: '', leadName: '', year: '2026' });

  // levelStates[sectorId] = ['locked'|'open'|'green'|'failed', x4]
  const initState = useMemo(() => {
    const o = {};
    sectors.forEach(s => o[s.id] = ['locked','locked','locked','locked']);
    return o;
  }, [sectors]);
  const [levelStates, setLevelStates] = useState(saved?.levelStates || initState);
  const [sectorCursor, setSectorCursor] = useState(() => {
    if (saved?.sectorCursor) return saved.sectorCursor;
    const o = {}; sectors.forEach(s => o[s.id] = 0); return o; // next level index
  });
  const [sectorClosed, setSectorClosed] = useState(() => {
    if (saved?.sectorClosed) return saved.sectorClosed;
    const o = {}; sectors.forEach(s => o[s.id] = false); return o;
  });

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(null); // {sector, level, questions}
  const [toast, setToast] = useState(null);

  // any sector still has a level to play?
  const allDone = sectors.every(s => sectorClosed[s.id] || sectorCursor[s.id] >= 4);

  useEffect(() => {
    if (phase === 'playing' && allDone) {
      setTimeout(() => setPhase('done'), 800);
    }
  }, [phase, allDone]);

  // Persist on every meaningful state change. On the intro screen there's
  // nothing in flight, so clear the slot — that way "New Camp" wipes the
  // save (it transitions phase back to 'intro').
  useEffect(() => {
    if (phase === 'intro') {
      clearSaved();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        phase, camp, levelStates, sectorCursor, sectorClosed,
      }));
    } catch {}
  }, [phase, camp, levelStates, sectorCursor, sectorClosed]);

  // pick a random sector that still has work
  function pickSector() {
    const eligible = sectors.filter(s => !sectorClosed[s.id] && sectorCursor[s.id] < 4);
    if (eligible.length === 0) return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  const onSpin = useCallback(() => {
    const target = pickSector();
    if (!target) return;
    const idx = sectors.findIndex(s => s.id === target.id);
    const sweep = 360 / sectors.length;
    // pointer is at top (0deg); align middle of target sector to top.
    // Wheel sectors are drawn starting at 0deg and going clockwise; the middle of sector idx is at idx*sweep + sweep/2.
    // We need to rotate the wheel so this angle aligns to the top (0deg); negative rotation.
    const targetAngle = -(idx * sweep + sweep/2);
    const baseTurns = 4; // full spins
    const jitter = (Math.random() - 0.5) * (sweep * 0.5); // land somewhere within sector
    const newRotation = rotation - (rotation % 360) + (-baseTurns * 360) + targetAngle + jitter;

    setSpinning(true);
    setRotation(newRotation);

    setTimeout(() => {
      setSpinning(false);
      const lvl = sectorCursor[target.id];
      const questions = target.levels[lvl];
      setActiveQuestion({ sector: target, level: lvl, questions });
    }, 4300);
  }, [sectors, sectorCursor, sectorClosed, rotation]);

  function handleAnswers(allYes, answers) {
    const { sector, level } = activeQuestion;
    const newStates = { ...levelStates, [sector.id]: [...levelStates[sector.id]] };
    if (allYes) {
      newStates[sector.id][level] = 'green';
      setLevelStates(newStates);
      const newCursor = { ...sectorCursor, [sector.id]: level + 1 };
      setSectorCursor(newCursor);
      // if that was level 4, sector is finished green
      if (level + 1 >= 4) {
        setSectorClosed({ ...sectorClosed, [sector.id]: true });
      }
      setActiveQuestion(null);
      setToast({ kind: 'green', sector, level });
    } else {
      // mark this and all higher levels as failed
      for (let i = level; i < 4; i++) newStates[sector.id][i] = 'failed';
      setLevelStates(newStates);
      setSectorClosed({ ...sectorClosed, [sector.id]: true });
      setActiveQuestion(null);
      setToast({ kind: 'failed', sector, level });
    }
  }

  function startGame(info) {
    setCamp(info);
    setPhase('playing');
    if (debugFill) {
      // demo: pre-fill some greens for screenshotting
      const demo = {};
      sectors.forEach((s, i) => demo[s.id] = ['green', i % 2 ? 'green' : 'failed', 'failed', 'failed']);
      setLevelStates(demo);
    }
  }

  // For wheel display: pretend cursor levels are "open" (current focus tinted brighter)
  const displayStates = useMemo(() => {
    const out = {};
    sectors.forEach(s => {
      out[s.id] = levelStates[s.id].map((st, li) => {
        if (st !== 'locked') return st;
        if (li === sectorCursor[s.id] && !sectorClosed[s.id]) return 'open';
        return 'locked';
      });
    });
    return out;
  }, [levelStates, sectorCursor, sectorClosed, sectors]);

  if (phase === 'intro') {
    return <Intro onStart={startGame} palette={palette}/>;
  }

  if (phase === 'done') {
    return (
      <div style={{ padding: '32px 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', fontWeight: 700, color: palette.accent, marginBottom: 8 }}>
          YOUR GREEN RADIUS
        </div>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px', color: palette.heading, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <RadiusLogomark sectors={sectors} levelStates={levelStates} size={32}/>
          {camp.campName}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ShareCard sectors={sectors} levelStates={levelStates} campName={camp.campName} leadName={camp.leadName} year={camp.year} palette={palette}/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => alert('Share link copied (mock)')}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              background: palette.accent, color: '#fff', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              boxShadow: `0 3px 0 ${palette.accentDark}` }}>
            Share
          </button>
          <button onClick={() => { setLevelStates(initState); setSectorCursor(() => { const o={}; sectors.forEach(s=>o[s.id]=0); return o; }); setSectorClosed(() => { const o={}; sectors.forEach(s=>o[s.id]=false); return o; }); setPhase('intro'); }}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12,
              border: `1.5px solid ${palette.text}22`, background: 'transparent',
              color: palette.text, fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
            New Camp
          </button>
        </div>
      </div>
    );
  }

  // PLAYING
  const totalGreens = sectors.reduce((acc, s) => acc + levelStates[s.id].filter(x=>x==='green').length, 0);
  const totalAttempted = sectors.reduce((acc, s) => acc + levelStates[s.id].filter(x=>x!=='locked').length, 0);

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: 480, margin: '0 auto' }}>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', fontWeight: 700, color: palette.text + '99' }}>
            GREEN RADIUS · {camp.year}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: palette.heading, lineHeight: 1.1, marginTop: 2, textWrap: 'balance' }}>
            {camp.campName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', fontWeight: 700, color: palette.text + '99' }}>GREEN</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#5BA84A', lineHeight: 1 }}>
            {totalGreens}<span style={{ fontSize: 12, opacity: 0.5 }}>/24</span>
          </div>
        </div>
      </div>

      {/* wheel */}
      <Wheel
        sectors={sectors}
        levelStates={displayStates}
        rotation={rotation}
        spinning={spinning}
        canSpin={!allDone}
        onSpin={onSpin}
        variant={variant}
        palette={palette}
      />

      {/* sector legend */}
      <div style={{ marginTop: 24, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {sectors.map(s => {
          const greens = levelStates[s.id].filter(x => x === 'green').length;
          const closed = sectorClosed[s.id];
          const allGreen = greens === 4;
          const anyGreen = greens > 0;
          const accentBorder = allGreen ? '#5BA84A' : anyGreen ? '#5BA84A88' : palette.text + '22';
          const iconColor = allGreen ? '#5BA84A' : palette.text + 'cc';
          return (
            <div key={s.id} style={{
              padding: '10px 8px', borderRadius: 10,
              background: palette.card,
              border: `1.5px solid ${accentBorder}`,
              opacity: closed && !anyGreen ? 0.55 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <SectorIcon kind={s.icon} size={20} color={iconColor}/>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: palette.text }}>
                {s.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0,1,2,3].map(li => (
                  <div key={li} style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: levelStates[s.id][li] === 'green' ? '#5BA84A'
                              : levelStates[s.id][li] === 'failed' ? 'rgba(60,40,30,0.18)'
                              : 'rgba(0,0,0,0.08)',
                  }}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* status / hint */}
      <div style={{
        marginTop: 16, padding: '10px 14px', borderRadius: 10,
        background: palette.card, border: `1px solid ${palette.text}11`,
        fontSize: 12, color: palette.text + 'cc', textAlign: 'center', textWrap: 'pretty',
      }}>
        {totalAttempted === 0
          ? 'Tap Spin to begin. The wheel chooses a sector — answer all questions Yes to turn that level green.'
          : allDone ? 'All sectors complete — see your radius.'
          : `${sectors.filter(s => !sectorClosed[s.id]).length} sectors still open · spin again`}
      </div>

      {activeQuestion && (
        <QuestionModal
          sector={activeQuestion.sector}
          level={activeQuestion.level}
          questions={activeQuestion.questions}
          tier4Topics={activeQuestion.sector.tier4Topics}
          onComplete={handleAnswers}
          palette={palette}
          variant={variant}
        />
      )}
      {toast && (
        <ResultToast kind={toast.kind} sector={toast.sector} level={toast.level} palette={palette} onClose={() => setToast(null)}/>
      )}
    </div>
  );
}

// expose
Object.assign(window, { GreenRadiusGame, RadialBadge, ShareCard, SectorIcon });
