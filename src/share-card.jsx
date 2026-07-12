// src/share-card.jsx — SVG→PNG export, ShareCard, ResultCardSVG. Shared Babel scope; see src/core.jsx.

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
    const b64 = bufToBase64(
      await fetch('/vendor/fonts/space-grotesk-v22-latin.woff2').then(r => (r.ok ? r.arrayBuffer() : Promise.reject()))
    );
    _fontEmbedCss = `@font-face { font-family: 'Space Grotesk'; font-style: normal; font-weight: 300 700; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
  } catch {
    _fontEmbedCss = '';
  }
  return _fontEmbedCss;
}
async function svgToPngBlob(svgEl, scale = 2) {
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
    return await new Promise(res => canvas.toBlob(res, 'image/png'));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function downloadSvgAsPng(svgEl, filename, scale = 2) {
  const blob = await svgToPngBlob(svgEl, scale);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ─── shareable card ───────────────────────────────────────────────────────────
function ShareCard({ sectors, fills, campName, leadName, year, palette, reveal = null }) {
  const fullTotal = sectors.reduce((n, s) => n + ((fills[s.id] && fills[s.id].totalYes) || 0), 0);
  const total = reveal == null ? fullTotal : reveal;
  const totalRef = useRef(null);
  useEffect(() => {
    if (reveal == null || !totalRef.current) return; // no-op for the static result page
    const el = totalRef.current;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'grg-tick 0.18s ease';
  }, [reveal]);
  return (
    <div style={{
      width: 'min(360px, 100%)', padding: 28, boxSizing: 'border-box',
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
            GREEN RADIUS · BLAST {year}
          </div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.12, textWrap: 'balance' }}>
            {campName || 'Theme Camp'}
          </div>
          <div style={{ marginTop: 8 }}>
            <span ref={totalRef} style={{ fontSize: 34, fontWeight: 900, color: '#7fc46a', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{total}</span>
            <span style={{ fontSize: 14, fontWeight: 700, opacity: 0.65 }}> / 60 achieved</span>
          </div>
        </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 0 14px' }}>
          <div style={{ width: '100%', maxWidth: 300 }}>
            <RadialBadge sectors={sectors} fills={fills} size={300} showGrid={true} fluid revealCount={reveal}/>
          </div>
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
        GREEN RADIUS · BLAST {year}
      </text>
      {name.lines.map((ln, i) => (
        <text key={i} x={CARD_W / 2} y={name.ys[i]} textAnchor="middle" fontSize={name.size} fontWeight="800" fill="#fff">{ln}</text>
      ))}
      <text x={CARD_W / 2} y={totalY} textAnchor="middle">
        <tspan fontSize="30" fontWeight="900" fill="#7fc46a">{total}</tspan>
        <tspan fontSize="13" fontWeight="700" fill="#fff" opacity="0.65"> / 60 achieved</tspan>
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
