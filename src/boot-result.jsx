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
function ResultView({ sectors, fills, campName, year }) {
  const cardSvgRef = React.useRef(null);
  const cardPngRef = React.useRef(null);
  const [copied, setCopied] = React.useState(false);
  const [downloadFailed, setDownloadFailed] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
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

  // ── Continue improving: rebuild a local save from this result and resume on / ──
  // STORAGE_KEY / STORAGE_VERSION / genCampId live in src/core.jsx and are reachable
  // by bare name in the shared global scope. `data` (the decoded result, with campId
  // when the link carries one) is the module-scope const this page decoded on load.
  function readExistingSave() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  }
  function hasMeaningfulProgress(save) {
    return !!(save && save.answers && Object.keys(save.answers).length > 0);
  }
  function doImport() {
    const save = window.ResultState.reconstructSave(data, window.SECTORS, {
      version: STORAGE_VERSION, campId: genCampId(), now: new Date().toISOString(),
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(save)); } catch (e) {}
    // Non-PII resume signal (event name only); best-effort, must never block the nav.
    try {
      const beacon = JSON.stringify({ event: 'result_resumed' });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/event', beacon);
      else fetch('/api/event', { method: 'POST', body: beacon, keepalive: true }).catch(() => {});
    } catch (e) {}
    window.location.href = '/';
  }
  function handleContinue() {
    const existing = readExistingSave();
    // Same camp (matching campId), or no meaningful local progress: import silently.
    // A different camp's link landing over real in-progress work asks first. A legacy
    // link (no campId) can't prove identity, so it also asks when progress exists.
    const differentCamp = !(data && data.campId) || !!(existing && existing.campId && existing.campId !== data.campId);
    if (hasMeaningfulProgress(existing) && differentCamp) { setConfirmOpen(true); return; }
    doImport();
  }

  // margin auto, not the container's align-items: see city/index.html
  // (Safari min-height flex centering pushes tall content off the top).
  return (
    <div style={{ width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', gap: 14, margin: 'auto' }}>
      <ShareCard sectors={sectors} fills={fills} campName={campName} year={year} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleDownload} style={{ ...btn, background: '#558040', boxShadow: '0 3px 0 #38542b' }}>
          <DownloadIcon />
          {downloadFailed ? "Couldn't download" : 'Download'}
        </button>
        <button onClick={handleShare} style={{ ...btn, background: '#3B6FD4', boxShadow: '0 3px 0 #2b539e' }}>
          {copied === 'error' ? "Couldn't copy link" : copied ? 'Link copied!' : '↗ Share link'}
        </button>
      </div>
      <div style={{ borderTop: '1px solid #2a262022', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={handleContinue} style={{ ...btn, background: '#558040', boxShadow: '0 3px 0 #38542b', textTransform: 'uppercase' }}>
          Continue improving
        </button>
        <div style={{ fontSize: 12, lineHeight: 1.45, color: '#2a2620aa', textAlign: 'center' }}>
          Load this scorecard on this device to keep answering and raise your radius.
        </div>
      </div>
      {confirmOpen && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(20,16,12,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#F3ECDD', borderRadius: 20, maxWidth: 340, width: '100%',
            padding: '24px 22px', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', color: '#2a2620' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Replace your in-progress game?</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, opacity: 0.8, marginBottom: 18 }}>
              This device already has a game in progress. Loading this scorecard will replace it, and that progress will be lost.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmOpen(false)} style={{ ...btn, color: '#2a2620',
                background: '#DCD2BE', boxShadow: '0 3px 0 #b3a98a', textTransform: 'none', letterSpacing: 'normal', fontWeight: 700 }}>
                Keep mine
              </button>
              <button onClick={doImport} style={{ ...btn, background: '#558040', boxShadow: '0 3px 0 #38542b',
                textTransform: 'none', letterSpacing: 'normal', fontWeight: 800 }}>
                Replace it
              </button>
            </div>
          </div>
        </div>
      )}
      {/* offscreen SVG twin of the card — serialized to PNG by handleDownload/share */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -99999, top: 0, width: CARD_W, height: CARD_H, overflow: 'hidden', pointerEvents: 'none' }}>
        <ResultCardSVG svgRef={cardSvgRef} sectors={sectors} fills={fills} campName={campName} year={year}/>
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
        display: 'inline-block', background: '#558040', color: '#fff',
        padding: '12px 22px', borderRadius: 14, fontWeight: 700, fontSize: 14,
        textDecoration: 'none', boxShadow: '0 3px 0 #38542b',
      }}>Play your own Green Radius</a>
    </div>
  );
} else {
  root.render(
    <ResultView sectors={window.SECTORS} fills={data.fills}
      campName={data.campName} year={data.year} />
  );
}
