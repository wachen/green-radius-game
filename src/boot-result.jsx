// Page boot for result/index.html. Compiled to dist/src/boot-result.js and
// loaded last. ShareCard, ResultCardSVG, downloadSvgAsPng, svgToPngBlob,
// CARD_W/H, DownloadIcon all live in src/share-card.jsx (loaded first) and are
// reachable by bare name in the shared global scope — they are NOT window
// properties (this mirrors how index.html mounts the game via a bare
// <GreenRadiusGame/>). window.ResultState / window.SECTORS come from the plain
// result-state.js / game-data.js scripts.
const data = window.ResultState.decode(
  new URLSearchParams(window.location.search).get('r') || window.location.hash
);

// Read-only card + the same Download / Share Link actions as the done screen.
function ResultView({ sectors, fills, campName, leadName, year }) {
  const cardSvgRef = React.useRef(null);
  const cardPngRef = React.useRef(null);
  const [copied, setCopied] = React.useState(false);
  const [downloadFailed, setDownloadFailed] = React.useState(false);
  const total = sectors.reduce((n, s) => n + ((fills[s.id] && fills[s.id].totalYes) || 0), 0);
  const slug = (campName || 'theme-camp').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'theme-camp';
  const resultUrl = window.location.href; // this page *is* the result link

  // Pre-rasterize the card so Web Share has the file ready inside the tap gesture.
  React.useEffect(() => {
    if (!cardSvgRef.current) return;
    let alive = true;
    svgToPngBlob(cardSvgRef.current).then(b => { if (alive) cardPngRef.current = b; }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function handleDownload() {
    if (!cardSvgRef.current) return;
    try { await downloadSvgAsPng(cardSvgRef.current, `green-radius-${slug}.png`); }
    catch { setDownloadFailed(true); setTimeout(() => setDownloadFailed(false), 1500); }
  }
  async function handleShare() {
    const shareText = `Our camp reached ${total}/60. Build your camp's Green Radius:`;
    const blob = cardPngRef.current;
    const file = blob ? new File([blob], `green-radius-${slug}.png`, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Our Green Radius', text: shareText, url: resultUrl }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (navigator.share) {
      try { await navigator.share({ title: 'Our Green Radius', text: shareText, url: resultUrl }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(resultUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch { setCopied('error'); setTimeout(() => setCopied(false), 1500); }
  }

  const btn = { flex: 1, padding: '14px 0', borderRadius: 12, border: 'none', color: '#fff',
    fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
  return (
    <div style={{ width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ShareCard sectors={sectors} fills={fills} campName={campName} leadName={leadName} year={year} palette={{}} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleDownload} style={{ ...btn, background: '#7AB85C', boxShadow: '0 3px 0 #558040' }}>
          <DownloadIcon />
          {downloadFailed ? "Couldn't download" : 'Download'}
        </button>
        <button onClick={handleShare} style={{ ...btn, background: '#3B6FD4', boxShadow: '0 3px 0 #2b539e' }}>
          {copied === 'error' ? "Couldn't copy link" : copied ? 'Link copied!' : '↗ Share link'}
        </button>
      </div>
      {/* offscreen SVG twin of the card — serialized to PNG by handleDownload/share */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: CARD_W, height: CARD_H, overflow: 'hidden', pointerEvents: 'none' }}>
        <ResultCardSVG svgRef={cardSvgRef} sectors={sectors} fills={fills} campName={campName} leadName={leadName} year={year}/>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
if (!data) {
  root.render(
    <div style={{
      background: 'linear-gradient(155deg, #1c1410 0%, #2a1c14 100%)',
      borderRadius: 24, color: '#fff', padding: '36px 28px', maxWidth: 360,
      textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, opacity: 0.6, marginBottom: 10 }}>GREEN RADIUS</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>This result link looks incomplete.</div>
      <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.75, marginBottom: 20 }}>
        Result links carry the whole scorecard after the # mark, so make sure the full link was copied. Or start fresh and build your own.
      </div>
      <a href="/" style={{
        display: 'inline-block', background: '#5BA84A', color: '#fff',
        padding: '12px 22px', borderRadius: 14, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', boxShadow: '0 3px 0 #3d7a31',
      }}>Play your own Green Radius</a>
    </div>
  );
} else {
  root.render(
    <ResultView sectors={window.SECTORS} fills={data.fills}
      campName={data.campName} leadName={data.leadName} year={data.year} />
  );
}
