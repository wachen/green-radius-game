// GreenRadius.jsx — main game component
// Two design directions are exposed via the `variant` prop ("dimensional" | "flat-playa").

const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Shared modal a11y: lock background scroll while open, and trap Tab focus inside
// the dialog so keyboard/SR users can't wander onto the obscured page behind it.
function useModalA11y(ref) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const f = node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    node.addEventListener('keydown', onKey);
    return () => node.removeEventListener('keydown', onKey);
  }, [ref]);
}

// ─── persistence ──────────────────────────────────────────────────────────────
// Saves the in-progress game so a refresh resumes where you left off.
// Bump STORAGE_VERSION when the saved shape changes so old saves are discarded
// instead of trying to merge them in.
const STORAGE_KEY = 'green-radius-game/v1';
const STORAGE_VERSION = 6;

const COMMUNITY_LINK_URL = 'https://www.greenthemecampcommunity.org/';
const BOARD_GAME_PDF_URL = '/downloads/' + encodeURIComponent('2026.05.19 Green Radius Game -- Download for Players -- Board Game - Coloring Wheel - Matrix -- v 26 FINAL .pdf');
const HOW_TO_PLAY_PDF_URL = '/downloads/' + encodeURIComponent('2026.05.19 Green Radius Game -- Download for Players -- How-to-Play - Board Game - Matrix - Detail -- v 26 FINAL .pdf');
const RESOURCE_GUIDE_URL = 'https://www.greenthemecampcommunity.org/resource-guide';
const REPORT_EMAIL = 'greenthemecamps@burningman.org';

// Every valid question id in the current game (Levels 1–3 by question id +
// Tier-4 topic ids). Used to drop stale ids when salvaging an older save.
function validQidSet(sectors) {
  const set = new Set();
  sectors.forEach(s => {
    s.levels.slice(0, 3).forEach(level => (level || []).forEach(q => set.add(q.id)));
    (s.tier4Topics || []).forEach(t => set.add(t.id));
  });
  return set;
}

function isCurrentShape(data, sectors) {
  return data.version === STORAGE_VERSION && data.answers && typeof data.answers === 'object' &&
    sectors.every(s =>
      typeof (data.sectorCursor && data.sectorCursor[s.id]) === 'number' &&
      typeof (data.sectorClosed && data.sectorClosed[s.id]) === 'boolean'
    );
}

// Turn any saved blob into something usable. A current-shape save passes through.
// An OLDER save is SALVAGED instead of silently discarded on a version bump (the
// qid -> 'yes'/'no' answer map has been the stable contract): keep the camp + the
// answers whose question ids still exist, recompute per-sector progress, and flag
// `salvaged` so the UI can say so. A completed ('done') save or an unrecognizable
// one returns null.
function migrateSaved(data, sectors) {
  if (!data || typeof data !== 'object') return null;
  if (isCurrentShape(data, sectors)) return data;
  if (data.phase === 'done') return null;            // result already captured; don't resurrect
  if (!data.answers || typeof data.answers !== 'object') return null;

  const valid = validQidSet(sectors);
  const answers = {};
  for (const k of Object.keys(data.answers)) {
    const v = data.answers[k];
    if (valid.has(k) && (v === 'yes' || v === 'no')) answers[k] = v;
  }
  const sectorClosed = {}, sectorCursor = {};
  sectors.forEach(s => {
    const fixed = s.levels.slice(0, 3).reduce((a, lvl) => a.concat(lvl || []), []);
    const done = fixed.length > 0 && fixed.every(q => answers[q.id] === 'yes' || answers[q.id] === 'no');
    sectorClosed[s.id] = done;
    sectorCursor[s.id] = done ? 4 : 0;
  });
  const camp = (data.camp && typeof data.camp === 'object')
    ? { campName: data.camp.campName || '', leadName: data.camp.leadName || '', email: data.camp.email || '' }
    : { campName: '', leadName: '', email: '' };
  const mode = data.mode === 'form' ? 'form' : 'board';
  return {
    version: STORAGE_VERSION,
    phase: mode === 'form' ? 'form' : 'playing',
    camp, sectorCursor, sectorClosed, answers, mode,
    submittedAt: null, salvaged: true,
  };
}

function loadSaved(sectors) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return migrateSaved(JSON.parse(raw), sectors);
  } catch {
    return null;
  }
}

function clearSaved() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// ─── Scoring + fill (per-point, per-question) ──────────────────────────────────
// Every Yes is worth 1 point. A sector has 10 questions: 6 fixed (Levels 1–3,
// sized 1/2/3) + up to 4 advanced picks (Level 4). The radius mirrors the answers
// exactly — each level's ring fills per question — so a No just leaves its
// segment empty (no compensation, gaps allowed).
const LEVEL_COLORS = ['#B91C1C', '#EA580B', '#3B82F6', '#31975B'];

// Per-sector fill: levels[0..2] = one bool per fixed question (in order);
// levels[3] = 4 slots, the first (advanced-Yes count, capped at 4) set true.
// totalYes is 0..10; `played` is true once any of the sector's questions is answered.
function sectorFill(sector, answers) {
  const levels = [0, 1, 2].map(li => (sector.levels[li] || []).map(q => answers[q.id] === 'yes'));
  const advYes = Math.min(4, (sector.tier4Topics || []).filter(t => answers[t.id] === 'yes').length);
  levels[3] = [0, 1, 2, 3].map(i => i < advYes);
  const fixedYes = levels.slice(0, 3).reduce((n, a) => n + a.filter(Boolean).length, 0);
  const ids = [].concat(...sector.levels.slice(0, 3)).map(q => q.id)
    .concat((sector.tier4Topics || []).map(t => t.id));
  const played = ids.some(id => answers[id] === 'yes' || answers[id] === 'no');
  return { levels, totalYes: fixedYes + advYes, played };
}

function fillsFromAnswers(sectors, answers) {
  const out = {};
  sectors.forEach(s => { out[s.id] = sectorFill(s, answers); });
  return out;
}

// ─── PNG export (pure SVG → canvas, no dependency) ──────────────────────────────
// The result card is built as a self-contained <svg> (ResultCardSVG); we
// serialize it, draw it onto a 2× canvas, and hand back a PNG. No foreignObject,
// so it rasterizes reliably on iOS Safari. Best-effort: embed the app font so the
// PNG matches the screen typeface; if that fetch fails, text falls back to
// system-ui and the export still works.
let _fontEmbedCss = null;
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
async function fontEmbedCss() {
  if (_fontEmbedCss !== null) return _fontEmbedCss;
  try {
    const css = await fetch('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap')
      .then(r => (r.ok ? r.text() : Promise.reject()));
    const faces = css.match(/@font-face\s*{[^}]+}/g) || [];
    const out = [];
    for (const face of faces) {
      const m = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/);
      if (!m) continue;
      const b64 = bufToBase64(await fetch(m[1]).then(r => r.arrayBuffer()));
      out.push(face.replace(m[1], `data:font/woff2;base64,${b64}`));
    }
    _fontEmbedCss = out.join('\n');
  } catch {
    _fontEmbedCss = '';
  }
  return _fontEmbedCss;
}
async function downloadSvgAsPng(svgEl, filename, scale = 2) {
  const W = svgEl.viewBox.baseVal.width, H = svgEl.viewBox.baseVal.height;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const css = await fontEmbedCss();
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }
  const svgUrl = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
  );
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = svgUrl; });
    if (css) await new Promise(r => setTimeout(r, 60)); // let the embedded font settle before drawing
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, W, H);
    await new Promise(res => canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      res();
    }, 'image/png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

// ─── icons ────────────────────────────────────────────────────────────────────
function SectorIcon({ kind, size = 28, color = '#fff' }) {
  const s = size, sw = 1.8;
  const p = { fill: 'none', stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const svgProps = { width: s, height: s, viewBox: '0 0 24 24' };
  switch (kind) {
    case 'water': // lucide: droplet
      return <svg {...svgProps}><path {...p} d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>;
    case 'waste': // lucide: recycle
      return (
        <svg {...svgProps}>
          <path {...p} d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>
          <path {...p} d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>
          <path {...p} d="m14 16-3 3 3 3"/>
          <path {...p} d="M8.293 13.596 7.196 9.5 3.1 10.598"/>
          <path {...p} d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>
          <path {...p} d="m13.378 9.633 4.096 1.098 1.097-4.096"/>
        </svg>
      );
    case 'power': // lucide: zap
      return <svg {...svgProps}><path {...p} d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>;
    case 'transport': // lucide: bus-front
      return (
        <svg {...svgProps}>
          <path {...p} d="M4 6 2 7"/>
          <path {...p} d="M10 6h4"/>
          <path {...p} d="m22 7-2-1"/>
          <rect {...p} width="16" height="16" x="4" y="3" rx="2"/>
          <path {...p} d="M4 11h16"/>
          <path {...p} d="M8 15h.01"/>
          <path {...p} d="M16 15h.01"/>
          <path {...p} d="M6 19v2"/>
          <path {...p} d="M18 21v-2"/>
        </svg>
      );
    case 'food': // lucide: utensils
      return (
        <svg {...svgProps}>
          <path {...p} d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
          <path {...p} d="M7 2v20"/>
          <path {...p} d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
        </svg>
      );
    case 'shelter': // lucide: tent
      return (
        <svg {...svgProps}>
          <path {...p} d="M3.5 21 14 3"/>
          <path {...p} d="M20.5 21 10 3"/>
          <path {...p} d="M15.5 21 12 15l-3.5 6"/>
          <path {...p} d="M2 21h20"/>
        </svg>
      );
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
// Split sweep [a0,a1] into n angular segments, each inset by gap/2 on both sides
// (so per-question segments read as distinct cells). Returns [[s0,e0],…].
function segAngles(a0, a1, n, gap = 0) {
  const step = (a1 - a0) / n;
  return Array.from({ length: n }, (_, i) => [a0 + i * step + gap / 2, a0 + (i + 1) * step - gap / 2]);
}

// ─── the wheel ────────────────────────────────────────────────────────────────
// Sectors render as 4 stacked rings (level 1 inner → level 4 outer).
// Each ring cell has its own state: 'locked' | 'open' | 'green' | 'failed'.
function Wheel({ sectors, fills, rotation, spinning, onSpin, canSpin, variant, palette }) {
  // Internal SVG coordinate space. Wheel outer radius is 200, so SIZE needs at
  // least 400 + headroom for the drop-shadow filter and dust-ring glow.
  const SIZE = 420;
  const cx = SIZE / 2, cy = SIZE / 2;
  const ringRadii = [60, 100, 140, 180]; // inner edges; outer = next or 200
  const ringOuter = [100, 140, 180, 200];
  const N = sectors.length;
  const sweep = 360 / N;

  const dim = variant === 'dimensional';
  const reduceMotion = typeof window !== 'undefined' &&
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Empty cells use a neutral/sandy ramp (L1 darkest → L4 lightest); a Yes lights
  // the cell in its level color (LEVEL_COLORS). Each question is its own cell.
  const ringTint = ['#c9b89a', '#d3c4a8', '#dcd0b5', '#e4d9c1'];

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
        role="img"
        aria-label={`Green radius wheel. ${sectors.map(s => `${s.name} ${(fills[s.id] && fills[s.id].totalYes) || 0} of 10`).join(', ')}.`}
        style={{
          display: 'block',
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? (reduceMotion ? 'transform 0.4s ease-out' : 'transform 4.2s cubic-bezier(0.17, 0.67, 0.16, 0.99)')
            : 'none',
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
          const lv = (fills[sector.id] && fills[sector.id].levels) || [[], [], [], []];
          return [0, 1, 2, 3].map(li => {
            const cells = lv[li] || [];
            return segAngles(a0, a1, cells.length || 1, 0).map(([s0, s1], qi) => {
              const filled = cells[qi];
              return (
                <g key={`${sector.id}-${li}-${qi}`}>
                  <path
                    d={arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1)}
                    fill={filled ? LEVEL_COLORS[li] : ringTint[li]}
                    stroke={palette.bg}
                    strokeWidth={dim ? 2 : 1.5}
                  />
                  {filled && (
                    <path
                      d={arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1)}
                      fill="url(#greenShimmer)"
                      fillOpacity="0.25"
                    />
                  )}
                </g>
              );
            });
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
// Plays all 10 questions of a sector in a single open modal: tier 1 (1q) →
// tier 2 (2q) → tier 3 (3q) → tier 4 (4 picks). The user always answers all
// 10 — failures don't end the sector early. Final scoring (which levels go
// green) is computed by the caller from the returned answersByLevel.
// Where to reopen a partly-answered sector: the first Level 1–3 question without
// an answer, with the already-answered ones seeded so the progress dots show them.
// If all six fixed questions are answered, reopen at the (optional) Tier 4.
function resumePosition(sector, answers) {
  const answersByLevel = [[], [], [], []];
  for (let li = 0; li < 3; li++) {
    const qs = sector.levels[li] || [];
    for (let i = 0; i < qs.length; i++) {
      const a = answers[qs[i].id];
      if (a === 'yes' || a === 'no') answersByLevel[li].push(a === 'yes');
      else return { level: li, idx: i, answersByLevel };
    }
  }
  return { level: 3, idx: 0, answersByLevel };
}

function QuestionModal({ sector, onComplete, onAnswer, existingAnswers, palette, variant }) {
  const tierLabels = ['Start Here', 'Beginner', 'Intermediate', 'Advanced'];
  const levelSizes = [1, 2, 3, 4];
  const tier4Topics = sector.tier4Topics || [];

  // Resume at the first unanswered Level 1–3 question (a refresh/back-swipe
  // mid-sector no longer loses the answers already given). Computed once on mount.
  const initial = useRef(null);
  if (!initial.current) initial.current = resumePosition(sector, existingAnswers || {});
  const [level, setLevel] = useState(initial.current.level);
  const [idx, setIdx] = useState(initial.current.idx);
  const [answersByLevel, setAnswersByLevel] = useState(initial.current.answersByLevel);
  const [pickedTopicIds, setPickedTopicIds] = useState([]); // tier 4 only
  const [topicId, setTopicId] = useState(''); // tier 4 dropdown selection
  const cardRef = useRef(null);
  useModalA11y(cardRef); // scroll-lock + Tab focus trap
  // Move focus into the dialog on open. The Spin button the player just pressed
  // gets disabled as the modal mounts, which otherwise drops focus to <body> and
  // strands keyboard / screen-reader users. aria-live on the question (below)
  // announces each new question as the player advances.
  useEffect(() => { cardRef.current?.focus(); }, []);

  const isTier4 = level === 3;
  const questions = sector.levels[level] || [];
  const total = levelSizes[level];

  const availableTopics = isTier4
    ? tier4Topics.filter(t => !pickedTopicIds.includes(t.id))
    : [];

  const q = isTier4
    ? tier4Topics.find(t => t.id === topicId) || null
    : questions[idx];

  function answer(yes) {
    // Persist each Level 1–3 answer to the shared map immediately so a refresh
    // mid-sector resumes at the next question instead of losing the run. (Tier 4
    // is optional and restarts on resume, so it stays modal-local.)
    if (!isTier4 && q && onAnswer) onAnswer(q.id, yes ? 'yes' : 'no');
    const nextAnswers = answersByLevel.map((a, li) => li === level ? [...a, yes] : a);
    setAnswersByLevel(nextAnswers);
    const nextPicks = isTier4 ? [...pickedTopicIds, topicId] : pickedTopicIds;
    if (isTier4) {
      setPickedTopicIds(nextPicks);
      setTopicId('');
    }
    if (idx + 1 >= total) {
      if (level + 1 >= 4) {
        onComplete(nextAnswers, nextPicks);
      } else {
        setLevel(level + 1);
        setIdx(0);
      }
    } else {
      setIdx(idx + 1);
    }
  }

  // Overall position across all 10 questions, for the counter and dot grouping
  const stepNumber = levelSizes.slice(0, level).reduce((a, b) => a + b, 0) + idx + 1;

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
      <div
        ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="qm-tag" tabIndex={-1}
        style={{
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
        {/* sector tag — also the dialog's accessible name (aria-labelledby) */}
        <div id="qm-tag" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#3a2a20', color: '#f0eee9',
          padding: '6px 12px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <SectorIcon kind={sector.icon} size={14} color="#fff"/>
          {sector.name} · Level {level + 1} · {tierLabels[level]}
        </div>

        {/* sector intro — show only on the very first question of the sector
            (Tier 1, Q1) so it sets the frame once without repeating. */}
        {level === 0 && idx === 0 && sector.bigGoal && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 13, lineHeight: 1.45, color: palette.text + 'b3',
              fontStyle: 'italic', textWrap: 'pretty', marginBottom: 6,
            }}>
              {sector.bigGoal}
            </div>
            {sector.resourceLink && (
              <a href={sector.resourceLink.url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                color: '#5BA84A', textDecoration: 'none',
                borderBottom: '1px solid #5BA84A55',
                paddingBottom: 1,
              }}>
                {sector.resourceLink.label} ↗
              </a>
            )}
          </div>
        )}

        {/* progress dots — 10 dots in 4 tier-groups (1 / 2 / 3 / 4) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {levelSizes.map((n, li) => (
            <div key={li} style={{ display: 'flex', gap: 4, flex: n }}>
              {Array.from({ length: n }).map((_, i) => {
                const past = li < level || (li === level && i < idx);
                const current = li === level && i === idx;
                const answered = past && answersByLevel[li][i];
                return (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: current ? '#3a2a20'
                              : past ? (answered ? '#5BA84A' : 'rgba(60,40,30,0.35)')
                              : 'rgba(0,0,0,0.08)',
                    transition: 'background 0.3s',
                  }} />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tier 4: topic picker */}
        {isTier4 && !q && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 6 }}>
              ADVANCED · OPTIONAL · TOPIC {idx + 1} OF 4
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: palette.text + 'cc', marginBottom: 12, textWrap: 'pretty' }}>
              Pick an advanced {sector.name.toLowerCase()} idea your camp pursued — or one of "Our Camp's Idea" entries. This level is optional.
            </div>
            <select
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              aria-label="Pick an advanced topic"
              style={{
                width: '100%', padding: '14px 14px', borderRadius: 12,
                border: `1.5px solid ${palette.text}22`,
                background: '#fff', color: palette.text,
                fontSize: 16, fontFamily: 'inherit',
                appearance: 'none', WebkitAppearance: 'none',
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
            <button
              type="button"
              onClick={() => onComplete(answersByLevel, pickedTopicIds)}
              aria-label="Skip the optional advanced tier"
              style={{
                width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 12,
                border: `1.5px solid ${palette.text}22`, background: 'transparent',
                color: palette.text + 'aa', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >None / skip advanced</button>
          </div>
        )}

        {/* Question content — aria-live so each new question is announced as the player advances */}
        {q && (
          <div aria-live="polite" aria-atomic="true">
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
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: palette.text + '99' }}>
          {stepNumber} of 10
        </div>
      </div>
    </div>
  );
}

// ─── result toast (between questions and next spin) ───────────────────────────
function ResultToast({ kind, sector, greens, palette, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2400);
    return () => clearTimeout(t);
  }, [onClose]);

  const isDone = kind === 'sector-done';
  const anyGreen = isDone && greens > 0;

  return (
    <div role="status" aria-live="polite" style={{
      position: 'fixed', inset: 0, zIndex: 9, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'qm-fade 0.25s ease',
    }}>
      <div style={{
        background: anyGreen ? '#5BA84A' : '#3a2a20',
        color: '#fff', padding: '22px 28px', borderRadius: 18,
        boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
        textAlign: 'center', maxWidth: 320,
        animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', opacity: 0.8, marginBottom: 6 }}>
          {sector?.name?.toUpperCase()} · DONE
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>
          {anyGreen
            ? `${greens} of 10 answered yes`
            : 'Sector complete — no yeses this time'}
        </div>
      </div>
    </div>
  );
}

// ─── celebration overlay (full sector cleared) ────────────────────────────────
// Burning-Man-flavored graffiti splatter + slogan. Auto-dismisses; honors
// prefers-reduced-motion by showing a quiet text-only flash instead.
function Celebration({ sector, palette, onDone }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const t = setTimeout(onDone, reduceMotion ? 1400 : 2600);
    return () => clearTimeout(t);
  }, [onDone, reduceMotion]);

  // Deterministic random per mount — splats stay in place for the duration
  // instead of jittering on re-render.
  const splats = useMemo(() => {
    const colors = ['#5BA84A', '#7AB85C', '#D9885C', '#E0B85C', '#fbf7f0', '#3a2a20'];
    return Array.from({ length: 18 }, (_, i) => ({
      key: i,
      left: 6 + Math.random() * 88,
      top: 6 + Math.random() * 88,
      size: 36 + Math.random() * 110,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.35,
      blur: Math.random() < 0.3 ? 6 : 2,
    }));
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {!reduceMotion && splats.map(s => (
        <div key={s.key} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          marginLeft: -s.size / 2, marginTop: -s.size / 2,
          background: s.color,
          borderRadius: '50%',
          opacity: 0,
          filter: `blur(${s.blur}px)`,
          mixBlendMode: 'multiply',
          animation: `grg-splat 1.9s cubic-bezier(0.2,0.8,0.2,1) ${s.delay}s forwards`,
        }}/>
      ))}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        animation: reduceMotion ? 'qm-fade 0.3s ease forwards' : 'grg-celeb 2.5s cubic-bezier(0.2,0.8,0.2,1) forwards',
      }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.3em', fontWeight: 800,
          color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: 12,
        }}>
          {sector?.name?.toUpperCase()} · 10 / 10
        </div>
        <div style={{
          fontSize: 'clamp(40px, 14vw, 72px)',
          fontWeight: 900,
          color: '#5BA84A',
          textShadow: '0 4px 20px rgba(0,0,0,0.45), 0 0 60px rgba(91,168,74,0.55)',
          textTransform: 'uppercase', letterSpacing: '-0.02em',
          lineHeight: 0.9,
          transform: reduceMotion ? 'none' : 'rotate(-3deg)',
          fontFamily: 'inherit',
        }}>
          All Lit!
        </div>
      </div>
    </div>
  );
}

// ─── radial badge (final result) ──────────────────────────────────────────────
// Grid of green ring-cells: each sector shows its 4 levels as concentric arcs.
// Fill is per-question: each level's ring lights one segment per Yes in that
// level's color, gaps allowed (an early No just leaves its segment empty, no
// compensation). Adjacent sectors share boundaries so the lit area still reads
// as one silhouette.
function RadialBadge({ sectors, fills, size = 320, dark = true, showLabels = true, showCenter = true, showGrid = false,
                       intensities = null, onSelectSegment = null, selected = null, centerLabel = null }) {
  const cx = size / 2, cy = size / 2;
  // [hub edge, L1, L2, L3, L4] — the inner hub stays clear (total moved to the header), like the board
  const RINGS = [0.18, 0.34, 0.52, 0.68, 0.84].map(f => f * size / 2);
  const N = sectors.length;
  const sweep = 360 / N;
  const gap = size < 120 ? 0 : 2;   // angular gap between question-segments (deg)
  const rGap = size < 120 ? 0 : 1;  // tiny radial gap between level bands (px)

  const baseColor = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const baseStroke = dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)';
  const gridStroke = dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {showLabels && (
        <circle cx={cx} cy={cy} r={RINGS[4]} fill={baseColor} stroke={baseStroke} strokeWidth={1}/>
      )}

      {/* per-question segments: boolean fills, or graded opacity in aggregate mode */}
      {sectors.map((sector, si) => {
        const a0 = si * sweep, a1 = (si + 1) * sweep;
        const agg = intensities && intensities[sector.id];
        const lv = agg ? agg.levels : ((fills[sector.id] && fills[sector.id].levels) || [[], [], [], []]);
        return [0, 1, 2, 3].map(li => {
          const rIn = RINGS[li] + (li > 0 ? rGap : 0);
          const rOut = RINGS[li + 1];
          const cells = lv[li] || [];
          return segAngles(a0, a1, cells.length || 1, gap).map(([s0, s1], qi) => {
            const isSel = selected && selected.sector === sector.id && selected.level === li && selected.qi === qi;
            const fillCol = agg ? LEVEL_COLORS[li] : (cells[qi] ? LEVEL_COLORS[li] : baseColor);
            const fillOp = agg ? Math.max(0.06, cells[qi] || 0) : 1;
            return (
              <path key={`${sector.id}-${li}-${qi}`}
                d={arcPath(cx, cy, rIn, rOut, s0, s1)}
                fill={fillCol} fillOpacity={fillOp}
                stroke={isSel ? '#e8c15a' : baseStroke} strokeWidth={isSel ? 1.5 : 0.5}
                style={onSelectSegment ? { cursor: 'pointer' } : undefined}
                onClick={onSelectSegment ? () => onSelectSegment(sector.id, li, qi) : undefined}
              />
            );
          });
        });
      })}

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

      {/* sector glyphs seated in the L1 ring, mirroring the game board */}
      {showLabels && sectors.map((sector, si) => {
        const ang = si * sweep + sweep / 2;
        const iconSz = Math.round(size * 0.058);
        const [x, y] = polar(cx, cy, (RINGS[0] + RINGS[1]) / 2, ang);
        return (
          <g key={sector.id} transform={`translate(${x - iconSz / 2} ${y - iconSz / 2})`}>
            <SectorIcon kind={sector.icon} size={iconSz} color={dark ? 'rgba(255,255,255,0.92)' : '#3a2a20'}/>
          </g>
        );
      })}

      {/* center: a numeric label override (aggregate mode) or the board's hand-drawn dot hub */}
      {showCenter && (
        centerLabel != null ? (
          <text x={cx} y={cy + size * 0.045} textAnchor="middle" fontSize={size * 0.13} fontWeight="900"
            fill={dark ? '#fff' : '#2a2620'}
            style={{ paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 0.6 }}>{centerLabel}</text>
        ) : (
          <g>
            <circle cx={cx} cy={cy} r={size * 0.04} fill="#f3ece0"/>
            <circle cx={cx} cy={cy} r={size * 0.024} fill="#2a2620"/>
          </g>
        )
      )}
    </svg>
  );
}

// Mini logomark version — no labels, no center, no background ring.
// Just the camp's silhouette as a tiny logo glyph next to the camp name.
function RadiusLogomark({ sectors, fills, size = 32 }) {
  return <RadialBadge sectors={sectors} fills={fills} size={size} showLabels={false} showCenter={false} dark={false}/>;
}

// ─── shareable card ───────────────────────────────────────────────────────────
function ShareCard({ sectors, fills, campName, leadName, year, palette }) {
  const total = sectors.reduce((n, s) => n + ((fills[s.id] && fills[s.id].totalYes) || 0), 0);
  return (
    <div style={{
      width: 360, padding: 28,
      background: 'linear-gradient(155deg, #1c1410 0%, #2a1c14 100%)',
      borderRadius: 24, color: '#fff',
      fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* dust glow */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)', pointerEvents: 'none' }}/>

      <div style={{ position: 'relative' }}>
        {/* header: eyebrow + camp name, centered (logomark + lead line removed) */}
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 4 }}>
            GREEN RADIUS · {year}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.12, textWrap: 'balance' }}>
            {campName || 'Theme Camp'}
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em' }}>{total}</span>
            <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.65 }}> / 60 green</span>
          </div>
        </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 14px' }}>
          <RadialBadge sectors={sectors} fills={fills} size={300} showGrid={true}/>
        </div>

        {/* sector breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {sectors.map(s => {
            const ty = (fills[s.id] && fills[s.id].totalYes) || 0;
            const c = ty > 0 ? '#7fc46a' : 'rgba(255,255,255,0.4)';
            return (
              <div key={s.id} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 4px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <SectorIcon kind={s.icon} size={18} color={c}/>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', opacity: 0.8 }}>
                  {s.name.toUpperCase()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: c }}>
                  {ty}<span style={{ fontSize: 9, opacity: 0.6 }}>/10</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize: 10, letterSpacing: '0.22em', opacity: 0.55, fontWeight: 700, textAlign: 'center', marginTop: 14 }}>
          GREENRADI.US
        </div>
      </div>
      </div>
    </div>
  );
}

// ─── result card as a single SVG (for PNG download) ────────────────────────────
// Mirrors ShareCard's design but as one self-contained <svg>, so it can be
// serialized + rasterized to PNG (downloadSvgAsPng). Kept separate from the
// on-screen HTML ShareCard so the live card's wrapping/shadow are untouched; this
// version lays everything out at fixed coordinates and clamps long camp names.
const CARD_W = 360, CARD_H = 612;
function fitCampName(name) {
  const n = ((name || '').trim()) || 'Theme Camp';
  if (n.length <= 16) return { lines: [n], size: 22, ys: [80] };
  const words = n.split(/\s+/);
  let l1 = '', l2 = '';
  for (const w of words) {
    if (!l2 && (l1 ? `${l1} ${w}` : w).length <= 17) l1 = l1 ? `${l1} ${w}` : w;
    else l2 = l2 ? `${l2} ${w}` : w;
  }
  if (!l1) l1 = n.slice(0, 16);
  if (!l2) return { lines: [l1.length > 18 ? `${l1.slice(0, 17)}…` : l1], size: 18, ys: [80] };
  if (l2.length > 20) l2 = `${l2.slice(0, 19)}…`;
  return { lines: [l1, l2], size: 18, ys: [72, 94] };
}
function ResultCardSVG({ sectors, fills, campName, leadName, year, svgRef }) {
  const pad = 28;
  const name = fitCampName(campName);
  const total = sectors.reduce((n, s) => n + ((fills[s.id] && fills[s.id].totalYes) || 0), 0);
  const totalY = name.lines.length > 1 ? 122 : 106;
  const gridY = 440, gap = 6, cellH = 58;
  const cellW = (CARD_W - 2 * pad - 2 * gap) / 3;
  const cols = [pad, pad + cellW + gap, pad + 2 * (cellW + gap)];
  return (
    <svg ref={svgRef} width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ fontFamily: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }}>
      <defs>
        <linearGradient id="rcBg" x1="0" y1="0" x2="0.45" y2="1">
          <stop offset="0%" stopColor="#1c1410"/>
          <stop offset="100%" stopColor="#2a1c14"/>
        </linearGradient>
        <radialGradient id="rcGlow" cx="50%" cy="26%" r="62%">
          <stop offset="0%" stopColor="#D9885C" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#D9885C" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="24" fill="url(#rcBg)"/>
      <rect x="0" y="0" width={CARD_W} height={CARD_H} rx="24" fill="url(#rcGlow)"/>

      <text x={CARD_W / 2} y="46" textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="2.4" fill="#fff" opacity="0.6">
        GREEN RADIUS · {year}
      </text>
      {name.lines.map((ln, i) => (
        <text key={i} x={CARD_W / 2} y={name.ys[i]} textAnchor="middle" fontSize={name.size} fontWeight="800" fill="#fff">{ln}</text>
      ))}
      <text x={CARD_W / 2} y={totalY} textAnchor="middle">
        <tspan fontSize="30" fontWeight="900" fill="#7fc46a">{total}</tspan>
        <tspan fontSize="13" fontWeight="700" fill="#fff" opacity="0.65"> / 60 green</tspan>
      </text>

      <g transform={`translate(${(CARD_W - 300) / 2}, 124)`}>
        <RadialBadge sectors={sectors} fills={fills} size={300} showGrid={true}/>
      </g>

      {sectors.map((s, i) => {
        const ty = (fills[s.id] && fills[s.id].totalYes) || 0;
        const col = cols[i % 3], rowY = gridY + (i < 3 ? 0 : cellH + gap), cx = col + cellW / 2;
        const color = ty > 0 ? '#7fc46a' : 'rgba(255,255,255,0.4)';
        return (
          <g key={s.id}>
            <rect x={col} y={rowY} width={cellW} height={cellH} rx="10" fill="#ffffff" fillOpacity="0.05"/>
            <g transform={`translate(${cx - 9}, ${rowY + 9})`}>
              <SectorIcon kind={s.icon} size={18} color={color}/>
            </g>
            <text x={cx} y={rowY + 40} textAnchor="middle" fontSize="9" fontWeight="700" letterSpacing="0.7" fill="#fff" opacity="0.8">
              {s.name.toUpperCase()}
            </text>
            <text x={cx} y={rowY + 53} textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>
              {ty}/10
            </text>
          </g>
        );
      })}

      <text x={CARD_W / 2} y={gridY + 2 * cellH + gap + 38} textAnchor="middle" fontSize="10" fontWeight="700" letterSpacing="2" fill="#fff" opacity="0.55">
        GREENRADI.US
      </text>
    </svg>
  );
}

// ─── FAQ (home screen only) ─────────────────────────────────────────────────
// Content is data; FaqModal renders it all expanded. The two link answers are
// JSX with hard-coded accent colors (the app has a single fixed palette).
const FAQ_ITEMS = [
  {
    q: 'What is the Green Radius?',
    a: "A six-spoke snapshot of your camp's sustainability, one spoke each for food, water, waste, power, transport, and shelter. The more green choices you've already made in an area, the further that spoke reaches. Together, the six make up your camp's Green Radius.",
  },
  {
    q: 'How do I play?',
    a: 'Spin the wheel to draw a sector, then answer its yes/no questions across four levels from easiest to hardest. Every yes lights its own segment of that sector, so an early no never blocks later progress, and your score is simply how many segments you light. Six spins (one per sector) complete your Green Radius.',
  },
  {
    q: 'Do I need to both play the game and fill out the form?',
    a: "Nope! They're two ways through the same assessment, so just pick one. The game is the playful path; the form is the familiar one: the classic questionnaire in a single list. Either way, you end up with the same Green Radius.",
  },
  {
    q: 'What happens to my results?',
    a: "When you finish, you'll see your Green Radius and can email yourself a shareable results card. Add your camp's details and your results join the community tally, so we can celebrate progress together. It's an honor-system self-assessment: no proof required, just answer honestly.",
  },
  {
    q: "What's happening to BLAST?",
    a: (
      <>Nothing's disappearing; it's evolving. The Green Radius <em>is</em> BLAST, in a more playable form: the same six-area framework and the same goals. You're still measuring your camp's "blast radius," just with a wheel instead of a worksheet. All the original BLAST guidance lives on in the Resource Guide below.</>
    ),
  },
  {
    q: 'Where can I learn more?',
    a: (
      <>
        Dig into the full guidance for every area and level in the Green Theme Camp Community's Resource Guide.<br/>
        <a href={RESOURCE_GUIDE_URL} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-block', marginTop: 8,
          background: '#7AB85C', color: '#fff', fontWeight: 700, fontSize: 13,
          padding: '8px 13px', borderRadius: 11, boxShadow: '0 4px 0 #558040',
          textDecoration: 'none',
        }}>Open the Resource Guide →</a>
      </>
    ),
  },
  {
    q: 'How do I report an issue or suggest an improvement?',
    a: (
      <>Found a bug or have an idea to make this better? We'd love to hear it. Email <a href={'mailto:' + REPORT_EMAIL} style={{ color: '#558040', fontWeight: 700, textDecoration: 'none', borderBottom: '1.5px solid rgba(85,128,64,0.4)' }}>{REPORT_EMAIL}</a>.</>
    ),
  },
];

function FaqButton({ onClick, palette, btnRef, expanded }) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={!!expanded}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: '#3B7DD8', color: '#fff', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em',
        padding: '8px 17px', borderRadius: 999, boxShadow: '0 4px 0 #2C5DA0',
      }}
    >
      <span aria-hidden="true" style={{
        width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>?</span>
      FAQ
    </button>
  );
}

function FaqModal({ onClose, palette }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useModalA11y(dialogRef); // scroll-lock + Tab focus trap
  // Focus the close button once on open; keep the Escape listener in its own
  // effect so a changing onClose can't re-trigger the focus.
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(20,12,8,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex',
        padding: 16, animation: 'qm-fade 0.25s ease',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="faq-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.card, color: palette.text, textAlign: 'left',
          borderRadius: 24, padding: '0 22px 18px',
          maxWidth: 400, width: '100%', margin: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
          animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, background: palette.card,
          paddingTop: 22, paddingBottom: 10, marginBottom: 2,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, color: palette.accent, textTransform: 'uppercase' }}>Green Radius</div>
          <div id="faq-title" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 3, padding: '0 30px' }}>Frequently Asked Questions</div>
          <button
            ref={closeRef} onClick={onClose} aria-label="Close"
            style={{ position: 'absolute', top: 12, right: 0, border: 'none', background: palette.text + '0f', width: 40, height: 40, borderRadius: '50%', fontSize: 15, cursor: 'pointer', color: palette.text, lineHeight: 1 }}
          >✕</button>
        </div>

        {FAQ_ITEMS.map((item, i) => (
          <div key={i} style={{
            borderTop: i === 0 ? 'none' : '1px solid ' + palette.text + '1a',
            paddingTop: i === 0 ? 2 : 14, paddingBottom: 2,
          }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 5 }}>{item.q}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: palette.text + 'd1' }}>{item.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── mode picker ─────────────────────────────────────────────────────────────
function ModePicker({ onPick, palette }) {
  const tileBase = {
    display: 'block', width: '100%', border: 'none', cursor: 'pointer',
    padding: '18px 16px', borderRadius: 18, marginBottom: 12,
    textAlign: 'center', fontFamily: 'inherit',
  };
  const [faqOpen, setFaqOpen] = useState(false);
  const faqBtnRef = useRef(null);
  const closeFaq = useCallback(() => { setFaqOpen(false); faqBtnRef.current?.focus(); }, []);
  return (
    <div style={{ padding: '22px 24px 22px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{
        fontSize: 40, lineHeight: 1, fontWeight: 900, margin: '0 0 10px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>What's Your</span> <span style={{ whiteSpace: 'nowrap' }}>Green Radius?</span>
      </h1>

      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 14, margin: '12px 0 14px',
      }} aria-hidden="true">
        {window.SECTORS.map(s => (
          <SectorIcon key={s.id} kind={s.icon} size={24} color={palette.accent}/>
        ))}
      </div>

      <div style={{
        fontSize: 15, lineHeight: 1.45, color: palette.text + 'cc',
        maxWidth: 340, margin: '0 auto 24px', textWrap: 'pretty',
      }}>
        Participate in BLAST 2026 and track your camp's progress across all 6 sustainability sectors. Pick any way to play.
      </div>

      <button
        onClick={() => onPick('board')}
        aria-label="Play the game in board game mode"
        style={{
          ...tileBase,
          background: palette.accent, color: '#fff',
          boxShadow: `0 5px 0 ${palette.accentDark}`,
        }}
      >
        <svg viewBox="0 0 60 60" width="46" height="46" fill="none"
          stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
          aria-hidden="true" style={{ display: 'block', margin: '0 auto 8px' }}>
          <circle cx="30" cy="30" r="22"/>
          <line x1="30" y1="8" x2="30" y2="52"/>
          <line x1="8" y1="30" x2="52" y2="30"/>
          <line x1="14.5" y1="14.5" x2="45.5" y2="45.5"/>
          <line x1="14.5" y1="45.5" x2="45.5" y2="14.5"/>
          <circle cx="30" cy="30" r="5" fill="currentColor" stroke="none"/>
          <polygon points="30,3 24,12 36,12" fill="currentColor" stroke="none"/>
        </svg>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
          Play the Game
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', opacity: 0.75,
        }}>
          Board Game · Fun
        </div>
      </button>

      <button
        onClick={() => onPick('form')}
        aria-label="Fill the application form"
        style={{
          ...tileBase,
          background: palette.card, color: palette.text,
          boxShadow: `0 5px 0 ${palette.text}1f`,
        }}
      >
        <svg viewBox="0 0 60 60" width="46" height="46" fill="none"
          stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
          aria-hidden="true" style={{ display: 'block', margin: '0 auto 8px' }}>
          <rect x="14" y="12" width="32" height="42" rx="3"/>
          <rect x="22" y="6" width="16" height="10" rx="2" fill="currentColor" stroke="none"/>
          <rect x="19" y="24" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
          <line x1="30" y1="28" x2="42" y2="28"/>
          <rect x="19" y="36" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
          <line x1="30" y1="40" x2="42" y2="40"/>
          <rect x="19" y="48" width="7" height="7" rx="1.5"/>
        </svg>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
          Fill the Form
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', opacity: 0.75,
        }}>
          Application · Familiar
        </div>
      </button>

      <div style={{
        marginTop: 4, marginBottom: 14,
        display: 'flex', justifyContent: 'center', gap: 18,
        flexWrap: 'wrap', rowGap: 8,
      }}>
        <a
          href={BOARD_GAME_PDF_URL}
          download
          style={{
            display: 'inline-block', padding: '10px 4px',
            color: palette.text + '99', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: palette.text + '44',
          }}
        >Board Game PDF Download ↓</a>
        <a
          href={HOW_TO_PLAY_PDF_URL}
          download
          style={{
            display: 'inline-block', padding: '10px 4px',
            color: palette.text + '99', fontSize: 11, fontWeight: 600,
            letterSpacing: '0.12em', textTransform: 'uppercase',
            textDecoration: 'underline',
            textUnderlineOffset: '3px',
            textDecorationColor: palette.text + '44',
          }}
        >How to Play ↓</a>
      </div>

      <div style={{ margin: '9px 0' }}>
        <FaqButton btnRef={faqBtnRef} expanded={faqOpen} onClick={() => setFaqOpen(true)} palette={palette}/>
      </div>

      <a href={COMMUNITY_LINK_URL} target="_blank" rel="noopener noreferrer"
        style={{
          fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
          color: palette.accent, marginTop: 20, lineHeight: 1.5,
          textDecoration: 'none', display: 'block',
        }}
      >
        CREATED BY THE<br/>
        GREEN THEME CAMP COMMUNITY
      </a>

      {faqOpen && <FaqModal onClose={closeFaq} palette={palette}/>}
    </div>
  );
}

// ─── linear application form ─────────────────────────────────────────────────
// Renders the 60 board-game questions as a yes/no form, paginated one sector
// per page (6 pages, with a sector stepper and Back/Next; see the 2026-06-03 spec).
// Submit just marks every sector closed; the radius fill derives from `answers`,
// exactly like the board game — the 'done' phase + ShareCard need no special shape.
//
// Scoring is per-question and identical to the board game (see sectorFill):
// each level's ring fills per question, in its level color; Level 4 shows the
// count of advanced Yeses (capped at 4). totalYes (0–10) feeds the sheet.
function LinearForm({ sectors, answers, setAnswer, onSubmit, onBack, onClear, palette }) {
  const [page, setPage] = useState(0);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const lastPage = sectors.length - 1;
  const sector = sectors[page];

  // A sector is "complete" once every Tier 1-3 question is answered. Tier 4 is optional.
  const requiredAnswered = (s) => s.levels.slice(0, 3).every(
    lvl => lvl.every(qq => answers[qq.id] === 'yes' || answers[qq.id] === 'no')
  );
  const incompleteSectors = sectors.filter(s => !requiredAnswered(s));
  const allComplete = incompleteSectors.length === 0;
  const firstIncompleteIndex = sectors.findIndex(s => !requiredAnswered(s));

  // Submission just marks every sector closed; scoring/fill derive from `answers`.
  function handleSubmit() {
    const sectorCursor = {};
    const sectorClosed = {};
    sectors.forEach(s => {
      sectorCursor[s.id] = 4;
      sectorClosed[s.id] = true;
    });
    onSubmit({ sectorCursor, sectorClosed });
  }

  const totalAnswered = Object.values(answers).filter(a => a === 'yes' || a === 'no').length;

  // A new page should always open at its header, not mid-scroll.
  useEffect(() => { try { window.scrollTo(0, 0); } catch {} }, [page]);

  // Equal-width neutral pill for Previous / Next. Submit is styled separately.
  const navPill = (enabled) => ({
    flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
    letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 52,
    cursor: enabled ? 'pointer' : 'default',
    background: enabled ? palette.text + '11' : palette.text + '08',
    color: enabled ? palette.text : palette.text + '40',
  });

  return (
    <div style={{ padding: '18px 24px 28px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={onBack}
          aria-label="Close form"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: palette.text + '99', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 0', fontFamily: 'inherit',
          }}
        >✕ Close</button>
      </div>

      {/* sector progress stepper */}
      <div
        role="group"
        aria-label={`Progress: sector ${page + 1} of ${sectors.length}, ${sector.name}`}
        style={{ marginBottom: 18 }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 4, maxWidth: 320, margin: '0 auto',
        }}>
          {sectors.map((s, i) => {
            const complete = requiredAnswered(s);
            const current = i === page;
            const iconColor = complete || current ? palette.accent : palette.text + '40';
            return (
              <div key={s.id} aria-hidden="true" style={{
                width: 40, height: 40, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: current ? palette.accent + '22' : 'transparent',
                border: `1.5px solid ${current ? palette.accent : 'transparent'}`,
                opacity: complete || current ? 1 : 0.55,
                transition: 'background .2s ease, border-color .2s ease, opacity .2s ease',
              }}>
                <SectorIcon kind={s.icon} size={20} color={iconColor}/>
              </div>
            );
          })}
        </div>
        <div style={{
          textAlign: 'center', marginTop: 8, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.18em', color: palette.text + '99',
        }}>
          {sector.name.toUpperCase()} · {page + 1} OF {sectors.length}
        </div>
      </div>

      {page === 0 && (
        <div style={{
          textAlign: 'center', fontSize: 13, lineHeight: 1.5,
          color: palette.text + 'cc', marginBottom: 4, textWrap: 'pretty',
        }}>
          Answer yes/no for your camp. Progress is autosaved.
        </div>
      )}

      {/* one sector per page; key re-mounts + re-animates on page change */}
      <div key={page} style={{ animation: 'qm-up .25s ease both' }}>
        <FormSectorBlock
          sector={sector}
          answers={answers} setAnswer={setAnswer} palette={palette}
          highlightMissing={highlightMissing}
        />
      </div>

      {/* Back / Next, or Submit on the last page */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Previous sector"
          style={navPill(page !== 0)}
        >← Previous</button>

        {page < lastPage ? (
          <button
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            aria-label="Next sector"
            style={navPill(true)}
          >Next →</button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allComplete}
            aria-label="Submit form answers"
            style={{
              flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 52,
              cursor: !allComplete ? 'default' : 'pointer',
              background: !allComplete ? palette.text + '33' : palette.accent,
              color: '#fff',
              boxShadow: !allComplete ? 'none' : `0 4px 0 ${palette.accentDark}`,
            }}
          >Submit →</button>
        )}
      </div>

      {page === lastPage && !allComplete && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 12, color: palette.text + '99', marginBottom: 6, textWrap: 'pretty' }}>
            {incompleteSectors.length} {incompleteSectors.length === 1 ? 'sector' : 'sectors'} still need required answers.
          </div>
          <button
            type="button"
            onClick={() => { setHighlightMissing(true); setPage(firstIncompleteIndex); }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: palette.accentDark, fontSize: 12, fontWeight: 800,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '6px 10px', minHeight: 44, fontFamily: 'inherit',
            }}
          >Go to {sectors[firstIncompleteIndex].name} →</button>
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          aria-label="Clear all form answers"
          onClick={() => {
            if (totalAnswered === 0) return;
            if (!confirm('Clear all answers?')) return;
            onClear();
          }}
          disabled={totalAnswered === 0}
          style={{
            background: 'transparent', border: 'none',
            cursor: totalAnswered === 0 ? 'default' : 'pointer',
            color: palette.text + (totalAnswered === 0 ? '33' : '66'),
            fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
            textTransform: 'uppercase', padding: '14px 12px',
            minHeight: 44, fontFamily: 'inherit',
          }}
        >Clear Form ✕</button>
      </div>

      {page === lastPage && (
        <a href={COMMUNITY_LINK_URL} target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
            color: palette.accent, marginTop: 20, lineHeight: 1.5,
            textDecoration: 'none', display: 'block', textAlign: 'center',
          }}
        >
          CREATED BY THE<br/>
          GREEN THEME CAMP COMMUNITY
        </a>
      )}
    </div>
  );
}

function FormSectorBlock({ sector, answers, setAnswer, palette, highlightMissing }) {
  const fixedQs = [].concat(...sector.levels.slice(0, 3));
  const t4 = sector.tier4Topics || [];
  const isAnswered = (id) => answers[id] === 'yes' || answers[id] === 'no';
  return (
    <section style={{
      margin: '20px 0', padding: '18px 16px',
      background: palette.card, borderRadius: 16, textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <SectorIcon kind={sector.icon} size={28} color={palette.accent}/>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: '-0.01em', color: palette.heading }}>
          {sector.name}
        </h2>
      </div>
      <div style={{
        fontSize: 11, lineHeight: 1.4, color: palette.text + '99',
        marginBottom: 14,
      }}>
        {sector.bigGoal}
      </div>

      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: palette.text + '88',
        marginBottom: 2,
      }}>
        Required
      </div>
      {fixedQs.map(q => (
        <YesNoRow
          key={q.id} qid={q.id}
          text={q.prompt}
          answer={answers[q.id]} setAnswer={setAnswer} palette={palette}
          missing={highlightMissing && !isAnswered(q.id)}
        />
      ))}

      {t4.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 16, marginBottom: 4,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: palette.accentDark,
              background: palette.accent + '22', borderRadius: 999,
              padding: '2px 8px',
            }}>Optional</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: palette.text + '88',
            }}>Level 4 · mark any 4+ to go deeper</span>
          </div>
          {t4.map(t => (
            <YesNoRow
              key={t.id} qid={t.id}
              text={t.title} subtext={t.description}
              answer={answers[t.id]} setAnswer={setAnswer} palette={palette}
            />
          ))}
        </>
      )}
    </section>
  );
}

function YesNoRow({ qid, text, subtext, answer, setAnswer, palette, missing }) {
  const btnBase = {
    border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit',
    minWidth: 56, minHeight: 44, // WCAG 2.5.5 touch target (pressed up to 60x/game)
  };
  return (
    <div style={{
      padding: '12px 0',
      borderTop: `1px solid ${palette.text}11`,
      borderLeft: `3px solid ${missing ? '#C9821E' : 'transparent'}`,
      paddingLeft: missing ? 10 : 0,
      transition: 'border-color .2s ease, padding-left .2s ease',
    }}>
      <div style={{ fontSize: 13, lineHeight: 1.4, color: palette.text, marginBottom: subtext ? 4 : 8 }}>
        {text}{missing && <span style={{ color: '#C9821E', fontWeight: 700, fontSize: 11, marginLeft: 6 }}>Needs an answer</span>}
      </div>
      {subtext && (
        <div style={{ fontSize: 11, lineHeight: 1.4, color: palette.text + '88', marginBottom: 8 }}>
          {subtext}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => setAnswer(qid, 'yes')}
          aria-pressed={answer === 'yes'}
          style={{
            ...btnBase,
            background: answer === 'yes' ? palette.accent : palette.text + '11',
            color: answer === 'yes' ? '#fff' : palette.text,
            boxShadow: answer === 'yes' ? `0 2px 0 ${palette.accentDark}` : 'none',
          }}
        >Yes</button>
        <button
          onClick={() => setAnswer(qid, 'no')}
          aria-pressed={answer === 'no'}
          style={{
            ...btnBase,
            background: answer === 'no' ? palette.text : palette.text + '11',
            color: answer === 'no' ? '#fff' : palette.text,
          }}
        >No</button>
      </div>
    </div>
  );
}

// ─── intro / camp setup ───────────────────────────────────────────────────────
function Intro({ onStart, onBack, palette, description }) {
  const [campName, setCampName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [email, setEmail] = useState('');
  const [tried, setTried] = useState(false);

  const campOk = !!campName.trim();
  const leadOk = !!leadName.trim();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canStart = campOk && leadOk && emailOk;

  function handleStart() {
    if (!canStart) { setTried(true); return; }
    onStart({ campName: campName.trim(), leadName: leadName.trim(), email: email.trim() });
  }

  const missing = [];
  if (!campOk) missing.push('a camp name');
  if (!leadOk) missing.push('your name');
  if (!emailOk) missing.push('a valid email');
  const missingMsg = missing.length === 1
    ? `Please add ${missing[0]} to continue.`
    : missing.length === 2
      ? `Please add ${missing[0]} and ${missing[1]} to continue.`
      : `Please add ${missing.slice(0, -1).join(', ')}, and ${missing[missing.length - 1]} to continue.`;

  return (
    <div style={{ padding: '20px 24px 28px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: 12 }}>
        <button
          onClick={onBack}
          aria-label="Back to mode picker"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: palette.text + '99', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 0', fontFamily: 'inherit',
          }}
        >← Back</button>
      </div>
      <h1 style={{
        fontSize: 44, lineHeight: 1, fontWeight: 900, margin: '0 0 8px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>What's Your</span> <span style={{ whiteSpace: 'nowrap' }}>Green Radius?</span>
      </h1>
      <div style={{ fontSize: 15, lineHeight: 1.5, color: palette.text + 'cc', marginBottom: 32, textWrap: 'pretty' }}>
        {description}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, textAlign: 'left' }}>
        <Field label="Camp name" value={campName} onChange={setCampName} placeholder="Your Theme Camp" palette={palette} required invalid={tried && !campOk}/>
        <Field label="Sustainability lead" value={leadName} onChange={setLeadName} placeholder="Your (Playa) Name" palette={palette} required invalid={tried && !leadOk}/>
        <Field label="Email address" value={email} onChange={setEmail} placeholder="you@your.camp" palette={palette} required invalid={tried && !emailOk} type="email"/>
      </div>

      <button
        onClick={handleStart}
        aria-label="Start"
        style={{
          width: '100%', padding: '16px', borderRadius: 14,
          border: 'none',
          background: palette.accent,
          color: '#fff',
          fontSize: 14, fontWeight: 800, letterSpacing: '0.15em',
          textTransform: 'uppercase', cursor: 'pointer',
          boxShadow: `0 4px 0 ${palette.accentDark}`,
          minHeight: 52,
        }}
      >Start →</button>

      {tried && !canStart && (
        <div role="alert" style={{
          fontSize: 12, lineHeight: 1.4, color: '#B4463A',
          marginTop: 10, fontWeight: 700, textWrap: 'pretty',
        }}>
          {missingMsg}
        </div>
      )}

      <div style={{
        fontSize: 11, lineHeight: 1.45, color: palette.text + '99',
        marginTop: 16, textWrap: 'pretty',
      }}>
        By continuing, you agree the Green Theme Camp Community will email your results on completion and may contact you.
      </div>

      <div style={{
        fontSize: 10, letterSpacing: '0.15em',
        color: palette.text + '66', marginTop: 24, fontWeight: 600,
      }}>
        6 SECTORS · 4 LEVELS · UP TO 60 QUESTIONS
      </div>

      <a href={COMMUNITY_LINK_URL} target="_blank" rel="noopener noreferrer"
        style={{
          fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
          color: palette.accent, marginTop: 32, lineHeight: 1.5,
          textDecoration: 'none', display: 'block',
        }}
      >
        CREATED BY THE<br/>
        GREEN THEME CAMP COMMUNITY
      </a>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, palette, required, invalid, type }) {
  const isEmail = type === 'email';
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 4 }}>
        {label.toUpperCase()}{required && <span aria-hidden="true" style={{ color: palette.accentDark, marginLeft: 3 }}>*</span>}
      </div>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        inputMode={isEmail ? 'email' : undefined}
        autoCapitalize={isEmail ? 'none' : undefined}
        autoCorrect={isEmail ? 'off' : undefined}
        autoComplete={isEmail ? 'email' : undefined}
        spellCheck={isEmail ? false : undefined}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1.5px solid ${invalid ? '#B4463A' : palette.text + '22'}`,
          background: palette.card, color: palette.text,
          fontSize: 16,
          fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

// Shown once when a save from an older version was salvaged, so the shift isn't silent.
function RestoredBanner({ onDismiss }) {
  return (
    <div role="status" style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#FEF3C7', color: '#5b4a16', border: '1px solid #F4D67A',
      borderRadius: 10, padding: '10px 12px', margin: '12px 16px 0', fontSize: 12.5, lineHeight: 1.4,
    }}>
      <span style={{ flex: 1 }}>We updated the game and restored your saved answers. Some progress may have shifted.</span>
      <button onClick={onDismiss} aria-label="Dismiss" style={{
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: '#5b4a16', fontSize: 16, lineHeight: 1, minWidth: 32, minHeight: 32,
      }}>✕</button>
    </div>
  );
}

// ─── main game ────────────────────────────────────────────────────────────────
function GreenRadiusGame({ variant = 'dimensional', palette, debugFill = false }) {
  const sectors = window.SECTORS;

  // Pull any saved game once on mount. If null, fall through to defaults.
  const saved = useMemo(() => loadSaved(sectors), [sectors]);

  const [phase, setPhase] = useState(saved?.phase || 'pick-mode'); // pick-mode | intro | playing | done | form-intro | form
  const [camp, setCamp] = useState(saved?.camp || { campName: '', leadName: '', email: '' });

  const [sectorCursor, setSectorCursor] = useState(() => {
    if (saved?.sectorCursor) return saved.sectorCursor;
    const o = {}; sectors.forEach(s => o[s.id] = 0); return o; // next level index
  });
  const [sectorClosed, setSectorClosed] = useState(() => {
    if (saved?.sectorClosed) return saved.sectorClosed;
    const o = {}; sectors.forEach(s => o[s.id] = false); return o;
  });
  // Per-question answers, keyed by question id (Tier-4 keyed by picked topic id).
  // Both modes write this map; it drives scoring AND the backend-only granular record.
  const [answers, setAnswers] = useState(saved?.answers || {});
  const [mode, setMode] = useState(saved?.mode || null); // 'board' | 'form'
  // Per-question fill (segment booleans per sector) — the single source for every
  // renderer. Derived from `answers`; an untouched sector is simply all-empty.
  const fills = useMemo(() => fillsFromAnswers(sectors, answers), [sectors, answers]);
  const [submittedAt, setSubmittedAt] = useState(saved?.submittedAt || null);
  const [submitState, setSubmitState] = useState('idle'); // idle | sending | done | error
  const [submitResult, setSubmitResult] = useState(null); // { sheet:'ok'|'err', email:'sent'|'err' } from the last POST
  const [editingEmail, setEditingEmail] = useState(false); // done-screen "edit & resend" affordance
  const [emailDraft, setEmailDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const cardSvgRef = useRef(null);   // offscreen ResultCardSVG, serialized on Download
  const autoSentRef = useRef(false); // guards the one-shot auto-email on the done screen
  const submitGenRef = useRef(0);    // bumped on Exit/new game so a stale in-flight POST can't write back
  const spinTimerRef = useRef(null); // the spin->open-modal timeout; cleared on reset so it can't fire into the next game
  const [restored, setRestored] = useState(saved?.salvaged || false); // a save from an older version was salvaged

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(() => {
    // Reopen the in-progress sector after a refresh/back-swipe mid-sector.
    const id = saved && saved.activeSectorId;
    if (!id) return null;
    const s = sectors.find(x => x.id === id);
    const closed = saved.sectorClosed && saved.sectorClosed[id];
    return s && !closed ? { sector: s } : null;
  }); // { sector }
  const [toast, setToast] = useState(null);
  const [celebration, setCelebration] = useState(null); // { sector }

  // Every sector is touched in exactly one spin (10 questions each), so the
  // game ends once all six sectors are closed.
  const allDone = sectors.every(s => sectorClosed[s.id]);

  useEffect(() => {
    // Wait for an in-flight celebration to finish before clearing the playing
    // screen — otherwise the overlay vanishes mid-animation on the last sector.
    if (phase === 'playing' && allDone && !celebration) {
      const t = setTimeout(() => setPhase('done'), 800);
      return () => clearTimeout(t);
    }
  }, [phase, allDone, celebration]);

  // POST the result: append the row + email the card. The Worker reports the two
  // outcomes independently ({sheet, email}), so we keep them separate and tell the
  // player the truth rather than collapsing both into "sent". A generation token
  // (submitGenRef) voids a stale in-flight request if the player exits mid-send.
  const runSubmit = useCallback((overrideEmail) => {
    const gen = ++submitGenRef.current;
    autoSentRef.current = true;
    fontEmbedCss(); // warm the font cache so the Download button is snappy
    (async () => {
      const greens = {};
      sectors.forEach(s => { greens[s.id] = sectorFill(s, answers).totalYes; });
      const year = new Date().getFullYear();
      const resultUrl = window.location.origin + '/result/#' +
        window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
      // overrideEmail (from the done-screen "edit & resend") wins over camp.email,
      // which may not have flushed through setCamp yet when resend fires.
      const email = (overrideEmail != null ? overrideEmail : (camp.email || '')).trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (gen === submitGenRef.current) setSubmitState('error'); return; }
      setSubmitState('sending');
      try {
        const res = await fetch('/api/complete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campName: camp.campName, leadName: camp.leadName, email,
            year, greens,
            mode: mode === 'form' ? 'form' : 'board',
            answers,
            schemaVersion: window.SCHEMA_VERSION || '',
            resultUrl,
          }),
        });
        const j = await res.json();
        if (gen !== submitGenRef.current) return; // stale: player exited or started over
        setSubmitResult({ sheet: j.sheet, email: j.email });
        // "done" = at least one channel landed, so we stop auto-retrying on reload.
        // The per-channel copy + the Try-again button surface any partial failure.
        if (j.sheet === 'ok' || j.email === 'sent') { setSubmittedAt(new Date().toISOString()); setSubmitState('done'); }
        else setSubmitState('error');
      } catch {
        if (gen === submitGenRef.current) setSubmitState('error');
      }
    })();
  }, [sectors, answers, camp, fills, mode]);

  // Fire the submit once when the done screen first appears. submittedAt (persisted)
  // prevents re-sending across reloads; autoSentRef guards a double-fire in-session.
  useEffect(() => {
    if (phase !== 'done') return;
    if (submittedAt) { setSubmitState('done'); return; }
    if (autoSentRef.current) return;
    runSubmit();
  }, [phase, submittedAt, runSubmit]);

  // Persist only on the in-progress phases (playing / form / done). On the
  // navigation screens (pick-mode / intro / form-intro) we do NOTHING — neither
  // write nor clear — so tapping "✕ Close" to step back keeps the autosave the
  // form promised. Clearing is now explicit: Exit and Reset call clearSaved().
  // (activeSectorId lets a refresh mid-sector reopen that sector — see resume.)
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'form' && phase !== 'done') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        phase, camp, sectorCursor, sectorClosed, answers, mode, submittedAt,
        activeSectorId: (activeQuestion && activeQuestion.sector && activeQuestion.sector.id) || null,
      }));
    } catch {}
  }, [phase, camp, sectorCursor, sectorClosed, answers, mode, submittedAt, activeQuestion]);

  function setFormAnswer(qid, value) {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  }

  function submitForm({ sectorCursor: sc, sectorClosed: scl }) {
    setSectorCursor(sc);
    setSectorClosed(scl);
    setPhase('done');
  }

  // pick a random sector that hasn't been played yet
  function pickSector() {
    const eligible = sectors.filter(s => !sectorClosed[s.id]);
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

    const reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setActiveQuestion({ sector: target });
    }, reduceMotion ? 500 : 4300);
  }, [sectors, sectorClosed, rotation]);

  // The player answered every question of a sector. Build the per-question
  // answer map (T1–T3 by question id; Tier-4 keyed by the picked topic id) and
  // merge it into the shared `answers` state. Scoring is per-question: each Yes
  // lights its own segment, gaps allowed, so totalYes is just the Yes count (0–10).
  function handleAnswers(answersByLevel, pickedTopicIds = []) {
    const { sector } = activeQuestion;
    const sectorAns = {};
    for (let li = 0; li < 3; li++) {
      (sector.levels[li] || []).forEach((q, i) => {
        const a = (answersByLevel[li] || [])[i];
        if (a === true || a === false) sectorAns[q.id] = a ? 'yes' : 'no';
      });
    }
    (pickedTopicIds || []).forEach((tid, i) => {
      const a = (answersByLevel[3] || [])[i];
      if (tid && (a === true || a === false)) sectorAns[tid] = a ? 'yes' : 'no';
    });

    const merged = { ...answers, ...sectorAns };
    setAnswers(merged);
    setSectorCursor({ ...sectorCursor, [sector.id]: 4 });
    setSectorClosed({ ...sectorClosed, [sector.id]: true });
    setActiveQuestion(null);

    const totalYes = sectorFill(sector, merged).totalYes;
    if (totalYes === 10) setCelebration({ sector });
    else setToast({ kind: 'sector-done', sector, greens: totalYes });
  }

  // Wipe in-progress state for a clean start. Called when entering a DIFFERENT
  // mode than the answers belong to, so a part-filled form can't bleed into a
  // board game (sectorFill counts any Yes in the shared map) — but re-entering
  // the same mode keeps the answers so an in-session resume still works.
  function freshProgress() {
    clearTimeout(spinTimerRef.current);
    setSpinning(false);
    setActiveQuestion(null);
    setAnswers({});
    setSectorCursor(() => { const o = {}; sectors.forEach(s => o[s.id] = 0); return o; });
    setSectorClosed(() => { const o = {}; sectors.forEach(s => o[s.id] = false); return o; });
    setSubmittedAt(null);
    setSubmitState('idle');
    setSubmitResult(null);
    setEditingEmail(false);
    autoSentRef.current = false;
    submitGenRef.current++;
  }

  function startGame(info) {
    if (mode !== 'board') freshProgress();
    setCamp(info);
    setMode('board');
    setPhase('playing');
    if (debugFill) {
      // demo: pre-fill a varied answer pattern for screenshotting
      const demo = {};
      sectors.forEach((s, i) => {
        [].concat(...s.levels.slice(0, 3)).forEach((q, qi) => { demo[q.id] = qi <= i ? 'yes' : 'no'; });
        (s.tier4Topics || []).slice(0, i % 4).forEach(t => { demo[t.id] = 'yes'; });
      });
      setAnswers(demo);
    }
  }

  function startForm(info) {
    if (mode !== 'form') freshProgress();
    setCamp(info);
    setMode('form');
    setPhase('form');
  }

  // Wheel reads the per-question fill directly; an untouched sector is all-empty.
  const displayStates = fills;

  if (phase === 'pick-mode') {
    return (
      <ModePicker
        onPick={(mode) => setPhase(mode === 'board' ? 'intro' : 'form-intro')}
        palette={palette}
      />
    );
  }

  if (phase === 'form-intro') {
    return (
      <Intro
        onStart={startForm}
        onBack={() => setPhase('pick-mode')}
        palette={palette}
        description="Answer to your best ability. Progress is autosaved unless you reset."
      />
    );
  }

  if (phase === 'form') {
    return (
      <>
        {restored && <RestoredBanner onDismiss={() => setRestored(false)} />}
        <LinearForm
          sectors={sectors}
          answers={answers}
          setAnswer={setFormAnswer}
          onSubmit={submitForm}
          onBack={() => setPhase('pick-mode')}
          onClear={() => setAnswers({})}
          palette={palette}
        />
      </>
    );
  }

  if (phase === 'intro') {
    return (
      <Intro
        onStart={startGame}
        onBack={() => setPhase('pick-mode')}
        palette={palette}
        description="Spin the wheel and answer to your best ability. Progress is autosaved unless you reset."
      />
    );
  }

  if (phase === 'done') {
    const year = new Date().getFullYear();
    const resultUrl = window.location.origin + '/result/#' +
      window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
    const email = (camp.email || '').trim();
    const slug = (camp.campName || 'theme-camp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme-camp';
    const needsRetry = submitState === 'error' || (submitResult && submitResult.email !== 'sent');

    async function handleShare() {
      try {
        if (navigator.share) await navigator.share({ title: 'Our Green Radius', url: resultUrl });
        else { await navigator.clipboard.writeText(resultUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      } catch {}
    }
    async function handleDownload() {
      if (!cardSvgRef.current) return;
      try { await downloadSvgAsPng(cardSvgRef.current, `green-radius-${slug}.png`); } catch {}
    }
    function handleRetry() {
      setSubmitResult(null);
      runSubmit(); // bumps the generation token, re-runs the POST
    }
    function handleResend() {
      const e = emailDraft.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return; // ignore an obviously bad address
      setCamp(c => ({ ...c, email: e }));
      setEditingEmail(false);
      setSubmitResult(null);
      runSubmit(e); // pass the corrected address directly (setCamp hasn't flushed yet)
    }
    const emailDraftOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailDraft.trim());
    function handleExit() {
      // Nothing landed yet (offline / total failure) and Exit wipes the save —
      // confirm first so a stray tap can't destroy the only copy of the result.
      const safe = submitState === 'done' || !!submittedAt;
      if (!safe && !confirm("Your results haven't been emailed yet. Exit and discard them?")) return;
      submitGenRef.current++; // void any in-flight POST so it can't write back after reset
      clearSaved();
      autoSentRef.current = false;
      setSectorCursor(() => { const o = {}; sectors.forEach(s => o[s.id] = 0); return o; });
      setSectorClosed(() => { const o = {}; sectors.forEach(s => o[s.id] = false); return o; });
      setAnswers({});
      setMode(null);
      setCamp({ campName: '', leadName: '', email: '' });
      setSubmittedAt(null);
      setSubmitState('idle');
      setSubmitResult(null);
      setEditingEmail(false);
      setPhase('pick-mode');
    }

    return (
      <div style={{ padding: '32px 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', fontWeight: 700, color: palette.accent, marginBottom: 8 }}>YOUR GREEN RADIUS</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px', color: palette.heading, letterSpacing: '-0.01em' }}>
          {camp.campName}
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ShareCard sectors={sectors} fills={fills} campName={camp.campName} leadName={camp.leadName} year={year} palette={palette}/>
        </div>

        {/* offscreen SVG twin of the card — serialized to PNG by handleDownload */}
        <div aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: CARD_W, height: CARD_H, overflow: 'hidden', pointerEvents: 'none' }}>
          <ResultCardSVG svgRef={cardSvgRef} sectors={sectors} fills={fills} campName={camp.campName} leadName={camp.leadName} year={year}/>
        </div>

        <div role="status" aria-live="polite" style={{ marginBottom: 16, color: palette.text, fontSize: 14, lineHeight: 1.5 }}>
          {submitState === 'sending'
            ? <>Thank you for participating! Emailing your results to <strong>{email}</strong>…</>
            : submitState === 'error'
              ? <>Thank you for participating! We couldn't reach the server just now. Your card is safe: download it or copy the share link below, then tap Try again.</>
              : submitResult && submitResult.email !== 'sent'
                ? <>Thank you for participating! You're counted in the community tally, but we couldn't email your card just now. Download it or copy the share link below.</>
                : <>Thank you for participating! Your results were sent to <strong>{email}</strong> (please check spam).</>}
        </div>

        {submitState !== 'sending' && (
          editingEmail ? (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="email" value={emailDraft} onChange={e => setEmailDraft(e.target.value)}
                aria-label="Your email address" placeholder="you@camp.org"
                inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                style={{ flex: 1, padding: '10px 12px', borderRadius: 10, fontSize: 16, fontFamily: 'inherit',
                  border: `1.5px solid ${emailDraftOk ? palette.text + '22' : '#B4463A'}`, background: palette.card, color: palette.text }}
              />
              <button onClick={handleResend} disabled={!emailDraftOk}
                style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: palette.accent, color: '#fff',
                  fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: emailDraftOk ? 'pointer' : 'default', opacity: emailDraftOk ? 1 : 0.5, minHeight: 44 }}>Resend</button>
              <button onClick={() => setEditingEmail(false)} aria-label="Cancel editing email"
                style={{ padding: '0 12px', borderRadius: 10, border: `1.5px solid ${palette.text}22`, background: 'transparent',
                  color: palette.text, fontSize: 16, cursor: 'pointer', minHeight: 44 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setEmailDraft(email); setEditingEmail(true); }}
              style={{ display: 'block', margin: '-6px auto 16px', background: 'none', border: 'none',
                color: palette.accentDark, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Wrong email? Edit and resend
            </button>
          )
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownload}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              background: palette.accent, color: '#fff', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              boxShadow: `0 3px 0 ${palette.accentDark}` }}>
            ⬇ Download
          </button>
          <button onClick={handleShare}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: `1.5px solid ${palette.text}22`,
              background: 'transparent', color: palette.text, fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>
            {copied ? 'Link copied!' : '🔗 Share link'}
          </button>
        </div>

        {needsRetry && (
          <button onClick={handleRetry} disabled={submitState === 'sending'}
            style={{ marginTop: 12, width: '100%', padding: '12px 0', borderRadius: 12,
              border: `1.5px solid ${palette.text}33`, background: 'transparent', color: palette.text,
              fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              cursor: submitState === 'sending' ? 'default' : 'pointer', opacity: submitState === 'sending' ? 0.6 : 1 }}>
            {submitState === 'sending' ? 'Sending…' : '↻ Try again'}
          </button>
        )}

        <button onClick={handleExit}
          style={{ marginTop: 16, background: 'none', border: 'none', color: `${palette.text}99`, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
          Exit
        </button>
      </div>
    );
  }

  // PLAYING
  const totalGreens = sectors.reduce((acc, s) => acc + (fills[s.id].totalYes || 0), 0);
  const totalAttempted = sectors.reduce((acc, s) => acc + (sectorClosed[s.id] ? 1 : 0), 0);

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: 480, margin: '0 auto' }}>
      {restored && <div style={{ margin: '0 0 12px' }}><RestoredBanner onDismiss={() => setRestored(false)} /></div>}
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', fontWeight: 700, color: palette.text + '99' }}>
            GREEN RADIUS · {new Date().getFullYear()}
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: palette.heading, lineHeight: 1.1, marginTop: 2, textWrap: 'balance' }}>
            {camp.campName}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.25em', fontWeight: 700, color: palette.text + '99' }}>GREEN</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#5BA84A', lineHeight: 1 }}>
            {totalGreens}<span style={{ fontSize: 12, opacity: 0.5 }}>/60</span>
          </div>
        </div>
      </div>

      {/* wheel */}
      <Wheel
        sectors={sectors}
        fills={displayStates}
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
          const f = fills[s.id];
          const ty = f.totalYes;
          const closed = sectorClosed[s.id];
          const accentBorder = ty === 10 ? LEVEL_COLORS[3] : ty > 0 ? LEVEL_COLORS[3] + '88' : palette.text + '22';
          const iconColor = ty > 0 ? LEVEL_COLORS[3] : palette.text + 'cc';
          return (
            <div key={s.id} style={{
              padding: '10px 8px', borderRadius: 10,
              background: palette.card,
              border: `1.5px solid ${accentBorder}`,
              opacity: closed && ty === 0 ? 0.55 : 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <SectorIcon kind={s.icon} size={20} color={iconColor}/>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: palette.text }}>
                {s.name.toUpperCase()}
              </div>
              <div style={{ display: 'flex', gap: 3 }}>
                {[0,1,2,3].map(li => {
                  const on = (f.levels[li] || []).some(Boolean);
                  return (
                    <div key={li} style={{
                      width: 8, height: 8, borderRadius: 2,
                      background: on ? LEVEL_COLORS[li] : 'rgba(0,0,0,0.08)',
                    }}/>
                  );
                })}
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
        {(() => {
          if (totalAttempted === 0) return 'Tap Spin to begin. The wheel picks a sector — answer all 10 questions to score it. Six spins total.';
          if (allDone) return 'All sectors complete — see your radius.';
          const left = sectors.filter(s => !sectorClosed[s.id]).length;
          return `${left} ${left === 1 ? 'sector' : 'sectors'} left · spin again`;
        })()}
      </div>

      <div style={{ textAlign: 'center', marginTop: 4 }}>
        <button
          type="button"
          aria-label="Reset game progress"
          onClick={() => {
            if (totalAttempted === 0) return;
            if (!confirm('Reset progress and start over?')) return;
            freshProgress();
            clearSaved(); // explicit now that the persist effect no longer auto-clears on pick-mode
            setMode(null);
            setPhase('pick-mode');
          }}
          disabled={totalAttempted === 0}
          style={{
            background: 'transparent', border: 'none',
            cursor: totalAttempted === 0 ? 'default' : 'pointer',
            color: palette.text + (totalAttempted === 0 ? '33' : '66'),
            fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
            textTransform: 'uppercase', padding: '14px 12px',
            minHeight: 44,
            fontFamily: 'inherit',
          }}
        >Reset Game ↺</button>
      </div>

      {activeQuestion && (
        <QuestionModal
          sector={activeQuestion.sector}
          onComplete={handleAnswers}
          onAnswer={(qid, v) => setAnswers(a => ({ ...a, [qid]: v }))}
          existingAnswers={answers}
          palette={palette}
          variant={variant}
        />
      )}
      {toast && (
        <ResultToast kind={toast.kind} sector={toast.sector} greens={toast.greens} palette={palette} onClose={() => setToast(null)}/>
      )}
      {celebration && (
        <Celebration sector={celebration.sector} palette={palette} onDone={() => setCelebration(null)}/>
      )}
    </div>
  );
}

// expose
Object.assign(window, { GreenRadiusGame, RadialBadge, ShareCard, SectorIcon });
