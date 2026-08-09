// green-radius.jsx — main game component (GreenRadiusGame) + intro and Green-Up Plan.
// Loads last: the src/*.jsx modules define everything else in the same shared Babel scope.

// Funnel analytics go through window.sendEvent (beacon.js, loaded first and
// un-deferred on every page); see docs/architecture.md.

// Green-Up Plan data: every "No" answer becomes a next-year step. Levels 1–3 come
// from sector.levels[0..2]; level 4 from sector.tier4Topics. Grouped by sector (board
// order), each group's steps in level order. Zero gaps → empty array (panel hides).
function greenUpSteps(sectors, answers, notes) {
  const groups = [];
  for (const s of sectors) {
    const steps = [];
    (s.levels || []).forEach((qs, i) => {
      (qs || []).forEach(q => { if (answers[q.id] === 'no') steps.push({ level: i + 1, title: q.title, link: q.link }); });
    });
    (s.tier4Topics || []).forEach(t => {
      if (answers[t.id] !== 'no') return;
      // A written-in idea the camp didn't pull off yet is the best next-year step
      // there is: show their own words.
      const note = notes && typeof notes[t.id] === 'string' && notes[t.id].trim();
      steps.push({ level: 4, title: note ? `${t.title}: ${note}` : t.title, link: t.link });
    });
    if (steps.length) groups.push({ sector: s.name, steps });
  }
  return groups;
}

// Done-screen-only panel: the camp's "No" answers as next-year steps. Always fully
// expanded; renders nothing when there are no gaps. Never mounted on /result/. Shows
// at most the 3 lowest-level ideas per sector (steps arrive level-ascending, L1→L4),
// so advanced camps whose only gaps are high-level still get concrete next steps.
// Soft color scheme: a pale leaf-green box (lighter than the score card's brown),
// with deep-forest text for contrast.
// `emailed` gates the "full list emailed" footnote so it can't contradict a
// delivery-failure message shown below the card.
function GreenUpPlan({ sectors, answers, notes, palette, emailed }) {
  const groups = greenUpSteps(sectors, answers, notes);
  if (!groups.length) return null;
  const ink = '#1f4a2c';
  return (
    <div style={{ marginTop: 20, textAlign: 'left', background: 'linear-gradient(160deg, #eaf6e2 0%, #dff0d4 100%)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 16px 16px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: ink, textAlign: 'center', margin: '0 0 18px' }}>Your Green-Up Plan</div>
        <div style={{ fontSize: 13, color: ink, opacity: 0.8, textAlign: 'center', margin: '0 0 14px' }}>Some ideas to grow your radius next year</div>
        {groups.map(g => (
          <div key={g.sector} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', fontWeight: 800, textTransform: 'uppercase', color: '#3d6b2e', marginBottom: 4 }}>{g.sector}</div>
            {g.steps.slice(0, 3).map((st, i) => (
              <div key={i} style={{ padding: '4px 0', fontSize: 14, color: ink }}>
                <span style={{ opacity: 0.85 }}>L{st.level} · </span>{st.title}
              </div>
            ))}
          </div>
        ))}
        {emailed && (
          <div style={{ fontSize: 12, fontStyle: 'italic', color: ink, opacity: 0.8, textAlign: 'center', margin: '10px 0 0' }}>
            The full list is in your email
          </div>
        )}
      </div>
    </div>
  );
}

// ─── intro / camp setup ───────────────────────────────────────────────────────
// `initial` prefills the fields from the running game's camp info, so stepping
// back from the board/form lets the player fix a typo'd detail and continue.
function Intro({ onStart, onBack, palette, description, initial }) {
  const [campName, setCampName] = useState((initial && initial.campName) || '');
  const [leadName, setLeadName] = useState((initial && initial.leadName) || '');
  const [email, setEmail] = useState((initial && initial.email) || '');
  const [campLocation, setCampLocation] = useState((initial && initial.campLocation) || '');
  const [campSize, setCampSize] = useState((initial && initial.campSize) || '');
  const [tried, setTried] = useState(false);
  // Soft playa-address nudge: only after the field loses focus (no nagging
  // mid-typing), never blocking, and fail-open if playa-address.js is absent.
  // Same grammar as the admin Playa Map, so a hint-free address always pins.
  const [locTouched, setLocTouched] = useState(false);
  const locationLooksOff = !!(locTouched && campLocation.trim() &&
    window.PlayaAddress && !window.PlayaAddress.parse(campLocation));

  const campOk = !!campName.trim();
  const leadOk = !!leadName.trim();
  const emailOk = isValidEmail(email);
  const campLocationOk = !!campLocation.trim();
  const campSizeTrim = campSize.trim();
  const campSizeNum = Number(campSizeTrim);
  const campSizeOk = campSizeTrim !== '' && Number.isInteger(campSizeNum) && campSizeNum > 0 && campSizeNum <= 2000;
  const canStart = campOk && leadOk && emailOk && campLocationOk && campSizeOk;

  function handleStart() {
    if (!canStart) { setTried(true); return; }
    onStart({ campName: campName.trim(), leadName: leadName.trim(), email: email.trim(), campLocation: campLocation.trim(), campSize: campSizeTrim });
  }

  const missing = [];
  if (!campOk) missing.push('a camp name');
  if (!leadOk) missing.push('your name');
  if (!emailOk) missing.push('a valid email');
  if (!campLocationOk) missing.push('your camp location');
  if (!campSizeOk) missing.push('your camp size');
  const missingMsg = `Please add ${new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(missing)} to continue.`;

  return (
    <div style={{ padding: '20px 24px 28px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ textAlign: 'left', marginBottom: 12 }}>
        <button
          onClick={onBack}
          aria-label="Back to mode picker"
          style={{ ...BACK_BTN_STYLE, cursor: 'pointer', color: palette.text + '99' }}
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
        <Field label="Camp location" value={campLocation} onChange={setCampLocation} placeholder="4:20 & D" palette={palette} required invalid={tried && !campLocationOk} maxLength={80}
          onBlur={() => setLocTouched(true)}
          hint={locationLooksOff ? "Hmm, that doesn't look like a playa address (like 7:30 & E). Totally fine if your camp is somewhere else, just double-check." : null}/>
        <Field label="Camp size" value={campSize} onChange={setCampSize} placeholder="Number of campers" palette={palette} required invalid={tried && !campSizeOk} type="number" min={1} max={2000}/>
      </div>

      <button
        onClick={handleStart}
        aria-label="Start"
        style={{
          width: '100%', padding: '16px', borderRadius: 14,
          border: 'none',
          background: palette.accentDark,
          color: '#fff',
          fontSize: 14, fontWeight: 800, letterSpacing: '0.15em',
          textTransform: 'uppercase', cursor: 'pointer',
          boxShadow: `0 4px 0 ${palette.accentDeep}`,
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
        By continuing, you agree the Green Theme Camp Community will email your results. We store your camp name, email, and answers to track community progress, and never share or sell them.
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
          color: palette.accentText, marginTop: 32, lineHeight: 1.5,
          textDecoration: 'none', display: 'block',
        }}
      >
        CREATED BY THE<br/>
        GREEN THEME CAMP COMMUNITY
      </a>
    </div>
  );
}

function Field({ label, value, onChange, onBlur, placeholder, palette, required, invalid, hint, type, min, max, maxLength }) {
  const isEmail = type === 'email';
  const isNumber = type === 'number';
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 4 }}>
        {label.toUpperCase()}{required && <span aria-hidden="true" style={{ color: palette.accentDark, marginLeft: 3 }}>*</span>}
      </div>
      <input
        type={type || 'text'}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        required={required}
        aria-invalid={invalid || undefined}
        autoComplete={isEmail ? 'email' : undefined}
        min={isNumber ? min : undefined}
        max={isNumber ? max : undefined}
        maxLength={maxLength}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: 10,
          border: `1.5px solid ${invalid ? '#B4463A' : palette.text + '22'}`,
          background: palette.card, color: palette.text,
          fontSize: 16,
          fontFamily: 'inherit',
        }}
      />
      {hint && (
        <div data-field-hint role="status" style={{
          fontSize: 11.5, lineHeight: 1.4, color: '#8a6d1f',
          marginTop: 4, fontWeight: 600, textWrap: 'pretty',
        }}>{hint}</div>
      )}
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
// PR46: drives the staged finished-screen reveal. `value` counts 0→total over a
// fixed ~1.5s window so a 12-wedge camp and a 24-wedge camp finish on the same
// beat; `done` flips at the end (triggers the rank slam). Reduced motion / not
// active → final values immediately (today's behavior).
function useResultReveal(total, active, reduceMotion) {
  const instant = !active || reduceMotion || total <= 0;
  const [value, setValue] = useState(instant ? total : 0);
  const [done, setDone] = useState(instant);
  useEffect(() => {
    if (!active || reduceMotion || total <= 0) { setValue(total); setDone(true); return; }
    setValue(0); setDone(false);
    const WINDOW = 1500;
    const step = Math.max(24, WINDOW / total);
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setValue(n);
      if (n >= total) { clearInterval(iv); setDone(true); }
    }, step);
    return () => clearInterval(iv);
  }, [active, reduceMotion, total]);
  return { value, done };
}

function GreenRadiusGame({ palette }) {
  const sectors = window.SECTORS;

  // Pull any saved game once on mount. If null, fall through to defaults.
  const saved = useMemo(() => loadSaved(sectors), [sectors]);

  const [phase, setPhase] = useState(saved?.phase || 'pick-mode'); // pick-mode | intro | playing | done | form-intro | form
  const [camp, setCamp] = useState(saved?.camp || { campName: '', leadName: '', email: '', campLocation: '', campSize: '' });
  // Stable per-camp id: reuse the saved one so a reload/redo keeps the same
  // identity; a fresh game (start over / exit) mints a new one (see freshProgress
  // + handleExit). Rides to the sheet inside the answers blob for read-time dedup.
  const [campId, setCampId] = useState(() => saved?.campId || genCampId());

  const [sectorClosed, setSectorClosed] = useState(() =>
    saved?.sectorClosed || Object.fromEntries(sectors.map(s => [s.id, false])));
  // Per-question answers, keyed by question id (Tier-4 keyed by picked topic id).
  // Both modes write this map; it drives scoring AND the backend-only granular record.
  const [answers, setAnswers] = useState(saved?.answers || {});
  // Write-in "Our Camp's Idea" text, keyed by the X-camp topic id. Backend-only
  // (submitted as `X-camp-note` answers entries); scoring only sees the Yes/No.
  const [customNotes, setCustomNotes] = useState(() =>
    (saved && saved.customNotes && typeof saved.customNotes === 'object') ? saved.customNotes : {});
  const [mode, setMode] = useState(saved?.mode || null); // 'board' | 'form'
  // Per-question fill (segment booleans per sector) — the single source for every
  // renderer. Derived from `answers`; an untouched sector is simply all-empty.
  const fills = useMemo(() => fillsFromAnswers(sectors, answers), [sectors, answers]);
  const [submittedAt, setSubmittedAt] = useState(saved?.submittedAt || null);
  // R4: per-submission idempotency nonce, persisted (additive key) so a reload
  // mid-POST replays with the SAME nonce and the backend can dedupe the row and
  // the email. Reused by Try Again; "edit & resend" mints a fresh one (that
  // send is meant to go out again). Cleared with the rest of the result state.
  const [submitNonce, setSubmitNonce] = useState(saved?.submitNonce || null);
  const [submitState, setSubmitState] = useState('idle'); // idle | sending | done | error
  const [submitResult, setSubmitResult] = useState(null); // { sheet:'ok'|'err', email:'sent'|'err' } from the last POST
  const [editingEmail, setEditingEmail] = useState(false); // done-screen "edit & resend" affordance
  const [emailDraft, setEmailDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const cardSvgRef = useRef(null);   // offscreen ResultCardSVG, serialized on Download
  const cardPngRef = useRef(null);   // pre-generated PNG Blob for Web Share L2 (Safari needs it ready in-gesture)
  const autoSentRef = useRef(false); // guards the one-shot auto-email on the done screen
  const submitGenRef = useRef(0);    // bumped on Exit/new game so a stale in-flight POST can't write back
  const spinTimerRef = useRef(null); // the spin->open-modal timeout; cleared on reset so it can't fire into the next game
  const [restored, setRestored] = useState(saved?.salvaged || false); // a save from an older version was salvaged
  // R-golden: one-time 60/60 full-board celebration (additive autosave key, no
  // STORAGE_VERSION bump). `goldenSeen` gates the trigger so a reload/replay of
  // an already-perfect save never re-fires it; `showGolden` is the in-session
  // overlay toggle. Both mode paths (board + form) land on the done screen the
  // same way, so gating on `phase === 'done'` covers either.
  const [goldenSeen, setGoldenSeen] = useState(saved?.goldenSeen || false);
  const [showGolden, setShowGolden] = useState(false);

  const revealArmedRef = useRef(false); // set only when we transition playing→done in-session (board mode)
  const rankRef = useRef(null);         // the finished-screen rank word, for the closing leaf burst
  const revealReduceMotion = prefersReducedMotion();
  const totalYesAll = sectors.reduce((n, s) => n + (fills[s.id] ? fills[s.id].totalYes : 0), 0);
  // The shareable card link. One source for both the done screen (share/copy)
  // and the submission POST, so the emailed link always matches what's on screen.
  const resultUrl = useMemo(() => window.location.origin + '/result/?r=' +
    window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year: new Date().getFullYear(), fills, campId }),
    [camp.campName, camp.leadName, fills, campId]);
  const revealActive = phase === 'done' && revealArmedRef.current && mode === 'board';
  const { value: revealValue, done: revealDone } = useResultReveal(totalYesAll, revealActive, revealReduceMotion);
  // Fire the closing leaf burst from the rank once the count-up finishes.
  useEffect(() => {
    if (revealActive && revealDone && rankRef.current) Fx.leafBurst(rankRef.current);
  }, [revealActive, revealDone]);

  // The 60th Yes can only land at the very last question of the very last
  // sector (every question everywhere must be Yes to hit 60), so the done
  // screen's first paint is the earliest reliable place to catch it for both
  // modes at once. isPerfectTotal/PERFECT_TOTAL live in src/core.jsx.
  useEffect(() => {
    if (phase === 'done' && isPerfectTotal(totalYesAll) && !goldenSeen) {
      setShowGolden(true);
      setGoldenSeen(true);
    }
  }, [phase, totalYesAll, goldenSeen]);

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
      const t = setTimeout(() => { revealArmedRef.current = true; setPhase('done'); }, 800);
      return () => clearTimeout(t);
    }
  }, [phase, allDone, celebration]);

  // U8: a phone back-swipe is a browser "back" gesture. With no history entry
  // of our own, that exits the site mid-sector. While the question modal is
  // open, push one history entry so back-swipe closes the modal instead
  // (already-given L1-3 answers are safe — they're written to `answers` as
  // given; see onAnswer). Consume that entry on any other close (sector
  // complete, reset) so it doesn't linger as a stray back-stack step. One
  // entry per open modal, guarded by modalHistoryRef.
  const modalHistoryRef = useRef(false);
  useEffect(() => {
    if (!activeQuestion) return;
    window.history.pushState({ grgModal: true }, '');
    modalHistoryRef.current = true;
    let closedByPop = false;
    const onPopState = () => {
      closedByPop = true;
      modalHistoryRef.current = false;
      setActiveQuestion(null);
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (modalHistoryRef.current && !closedByPop) {
        modalHistoryRef.current = false;
        window.history.back();
      }
    };
  }, [activeQuestion]);

  // POST the result: append the row + email the card. The Worker reports the two
  // outcomes independently ({sheet, email}), so we keep them separate and tell the
  // player the truth rather than collapsing both into "sent". A generation token
  // (submitGenRef) voids a stale in-flight request if the player exits mid-send.
  const runSubmit = useCallback((overrideEmail, freshNonce) => {
    const gen = ++submitGenRef.current;
    autoSentRef.current = true;
    // Reuse the persisted nonce (reload/Try Again = the same submission);
    // freshNonce (edit & resend) mints a new one so that email isn't deduped.
    const nonce = (!freshNonce && submitNonce) || genCampId();
    if (nonce !== submitNonce) setSubmitNonce(nonce);
    fontEmbedCss(); // warm the font cache so the Download button is snappy
    (async () => {
      const greens = Object.fromEntries(sectors.map(s => [s.id, fills[s.id].totalYes]));
      const year = new Date().getFullYear();
      // overrideEmail (from the done-screen "edit & resend") wins over camp.email,
      // which may not have flushed through setCamp yet when resend fires.
      const email = (overrideEmail != null ? overrideEmail : (camp.email || '')).trim();
      if (!isValidEmail(email)) { if (gen === submitGenRef.current) setSubmitState('error'); return; }
      setSubmitState('sending');
      const evMode = mode === 'form' ? 'form' : 'board';
      window.sendEvent('submit_attempted', { mode: evMode, sectors: Object.values(greens).filter(v => v > 0).length });
      // Write-in idea text rides the same answers map as `X-camp-note` entries
      // (only when its topic was answered), landing in the sheet's Answers JSON.
      const noteEntries = {};
      Object.keys(customNotes || {}).forEach(tid => {
        const t = String(customNotes[tid] || '').trim();
        if (t && (answers[tid] === 'yes' || answers[tid] === 'no')) noteEntries[tid + '-note'] = t.slice(0, 160);
      });
      try {
        const res = await fetch('/api/complete', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campName: camp.campName, leadName: camp.leadName, email,
            campLocation: camp.campLocation || '', campSize: camp.campSize || '',
            year, greens,
            mode: mode === 'form' ? 'form' : 'board',
            answers: { ...answers, ...noteEntries },
            campId,
            nonce,
            schemaVersion: window.SCHEMA_VERSION || '',
            resultUrl,
          }),
        });
        const j = await res.json();
        if (gen !== submitGenRef.current) return; // stale: player exited or started over
        setSubmitResult({ sheet: j.sheet, email: j.email });
        // "done" = at least one channel landed, so we stop auto-retrying on reload.
        // The per-channel copy + the Try-again button surface any partial failure.
        if (j.sheet === 'ok' || j.email === 'sent') { setSubmittedAt(new Date().toISOString()); setSubmitState('done'); window.sendEvent('submit_succeeded', { mode: evMode }); }
        else { setSubmitState('error'); window.sendEvent('submit_failed', { mode: evMode }); }
      } catch {
        if (gen === submitGenRef.current) setSubmitState('error');
        window.sendEvent('submit_failed', { mode: evMode });
      }
    })();
  }, [sectors, answers, customNotes, camp, fills, mode, campId, submitNonce, resultUrl]);

  // Fire the submit once when the done screen first appears. submittedAt (persisted)
  // prevents re-sending across reloads; autoSentRef guards a double-fire in-session.
  useEffect(() => {
    if (phase !== 'done') return;
    if (submittedAt) { setSubmitState('done'); return; }
    if (autoSentRef.current) return;
    runSubmit();
  }, [phase, submittedAt, runSubmit]);

  // The offscreen twin only mounts on the done screen, so this no-ops elsewhere.
  usePreRasterizedCard(cardSvgRef, cardPngRef, [phase, fills]);

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
        phase, camp, campId, sectorClosed, answers, customNotes, mode, submittedAt, submitNonce,
        goldenSeen,
        activeSectorId: (activeQuestion && activeQuestion.sector && activeQuestion.sector.id) || null,
      }));
    } catch {}
  }, [phase, camp, sectorClosed, answers, customNotes, mode, submittedAt, submitNonce, goldenSeen, activeQuestion]);

  function setFormAnswer(qid, value) {
    setAnswers(prev => ({ ...prev, [qid]: value }));
  }

  // Form-mode write-in: keep the note while it has text, drop it when cleared.
  function setCustomNote(tid, text) {
    setCustomNotes(prev => {
      const t = String(text || '');
      if (!t.trim()) {
        if (!(tid in prev)) return prev;
        const o = { ...prev }; delete o[tid]; return o;
      }
      return { ...prev, [tid]: t.slice(0, NOTE_MAX_LEN) };
    });
  }

  function submitForm({ sectorClosed: scl }) {
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
    // The wheel always spins clockwise (rotation only ever increases), so after
    // spinning, sector idx's middle sits under the top pointer when
    // (rotation + idx*sweep + sweep/2) ≡ 0 (mod 360). Solve for the rotation's
    // required value mod 360, then add just enough forward (positive) rotation
    // from the current angle to reach it, plus baseTurns full clockwise turns.
    const targetMid = idx * sweep + sweep / 2;
    const targetMod = ((-targetMid % 360) + 360) % 360;
    const baseTurns = 2; // full spins
    const currentMod = ((rotation % 360) + 360) % 360; // normalize; rotation may be negative
    const forwardDelta = ((targetMod - currentMod) % 360 + 360) % 360; // shortest forward hop to targetMod
    const jitter = (Math.random() - 0.5) * (sweep * 0.5); // land somewhere within sector
    const newRotation = rotation + baseTurns * 360 + forwardDelta + jitter;

    setSpinning(true);
    setRotation(newRotation);

    const reduceMotion = prefersReducedMotion();
    clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setActiveQuestion({ sector: target });
    }, reduceMotion ? 500 : 2300); // CSS transition (2.2s) + a beat to settle
  }, [sectors, sectorClosed, rotation]);

  // The player answered every question of a sector. Build the per-question
  // answer map (T1–T3 by question id; Tier-4 keyed by the picked topic id) and
  // merge it into the shared `answers` state. Scoring is per-question: each Yes
  // lights its own segment, gaps allowed, so totalYes is just the Yes count (0–10).
  function handleAnswers(answersByLevel, pickedTopicIds = [], notes = {}) {
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
    if (notes && Object.keys(notes).length) setCustomNotes(prev => ({ ...prev, ...notes }));

    const merged = { ...answers, ...sectorAns };
    setAnswers(merged);
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
    setCustomNotes({});
    setSectorClosed(Object.fromEntries(sectors.map(s => [s.id, false])));
    setSubmittedAt(null);
    setSubmitNonce(null);
    setSubmitState('idle');
    setSubmitResult(null);
    setEditingEmail(false);
    autoSentRef.current = false;
    submitGenRef.current++;
    revealArmedRef.current = false;
    setGoldenSeen(false); // a start-over is a new camp identity, so the golden moment can fire again
    setShowGolden(false);
    setCampId(genCampId()); // a start-over is a new camp identity, not the last one
  }

  function startGame(info) {
    if (mode !== 'board') freshProgress();
    setCamp(info);
    setMode('board');
    window.sendEvent('mode_chosen', { mode: 'board' });
    setPhase('playing');
  }

  function startForm(info) {
    if (mode !== 'form') freshProgress();
    setCamp(info);
    setMode('form');
    window.sendEvent('mode_chosen', { mode: 'form' });
    setPhase('form');
  }

  if (phase === 'pick-mode') {
    return (
      <ModePicker
        onPick={(mode) => { window.sendEvent('game_started'); setPhase(mode === 'board' ? 'intro' : 'form-intro'); }}
        palette={palette}
      />
    );
  }

  // Both modes share one intake screen; only the start handler and the one-line
  // description differ (the board game mentions the wheel).
  if (phase === 'intro' || phase === 'form-intro') {
    const board = phase === 'intro';
    return (
      <Intro
        onStart={board ? startGame : startForm}
        onBack={() => setPhase('pick-mode')}
        palette={palette}
        description={board
          ? "Spin the wheel and answer as best you can. Progress autosaves unless you reset."
          : "Answer as best you can. Progress autosaves unless you reset."}
        initial={camp}
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
          notes={customNotes}
          setNote={setCustomNote}
          onSubmit={submitForm}
          onBack={() => setPhase('form-intro')}
          onClear={() => { setAnswers({}); setCustomNotes({}); }}
          palette={palette}
        />
      </>
    );
  }

  if (phase === 'done') {
    const year = new Date().getFullYear();
    const email = (camp.email || '').trim();
    const needsRetry = submitState === 'error' || (submitResult && submitResult.email !== 'sent');

    const handleShare = () => shareResultCard({
      pngBlob: cardPngRef.current, campName: camp.campName, total: totalYesAll, url: resultUrl, setCopied,
    });
    async function handleDownload() {
      if (!cardSvgRef.current) return;
      try { await downloadSvgAsPng(cardSvgRef.current, cardFilename(camp.campName)); } catch {}
    }
    function handleRetry() {
      setSubmitResult(null);
      runSubmit(); // bumps the generation token, re-runs the POST
    }
    function handleResend() {
      const e = emailDraft.trim();
      if (!isValidEmail(e)) return; // ignore an obviously bad address
      setCamp(c => ({ ...c, email: e }));
      setEditingEmail(false);
      setSubmitResult(null);
      runSubmit(e, true); // corrected address directly (setCamp hasn't flushed) + a fresh nonce so the resend isn't deduped
    }
    const emailDraftOk = isValidEmail(emailDraft);
    function handleExit() {
      // Nothing landed yet (offline / total failure) and Exit wipes the save —
      // confirm first so a stray tap can't destroy the only copy of the result.
      const safe = submitState === 'done' || !!submittedAt;
      if (!safe && !confirm("Your results haven't been emailed yet. Exit and discard them?")) return;
      // freshProgress covers the whole in-progress wipe (answers, sector state,
      // submit/golden state, a new campId). Exit adds what it alone does: drop
      // the autosave, forget the mode + camp details, and go back to the picker.
      freshProgress();
      clearSaved();
      setMode(null);
      setCamp({ campName: '', leadName: '', email: '', campLocation: '', campSize: '' });
      setPhase('pick-mode');
    }

    return (
      <div style={{ padding: '32px 20px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.3em', fontWeight: 700, color: palette.accentText, marginBottom: 8 }}>YOUR GREEN RADIUS</div>
        <h2 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 24px', color: palette.heading, letterSpacing: '-0.01em' }}>
          {camp.campName}
        </h2>
        <div style={{
          fontSize: 18, fontWeight: 800, color: palette.heading, margin: '-16px 0 24px',
          ...(revealActive && !revealDone ? { visibility: 'hidden' } : {}),
        }}>
          <span ref={rankRef} style={{
            display: 'inline-block',
            animation: (revealActive && revealDone && !revealReduceMotion)
              ? 'grg-rankslam 0.7s cubic-bezier(.22,1,.36,1) both' : 'none',
          }}>{totalYesAll}/60 · Thanks for playing!</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <ShareCard sectors={sectors} fills={fills} campName={camp.campName} year={year} reveal={revealActive ? revealValue : null}/>
        </div>

        <OffscreenResultCard svgRef={cardSvgRef} sectors={sectors} fills={fills} campName={camp.campName} year={year}/>

        <div role="status" aria-live="polite" style={{ marginBottom: 16, color: palette.text, fontSize: 14, lineHeight: 1.5 }}>
          {submitState === 'sending'
            ? <>Emailing your results to <strong>{email}</strong>…</>
            : submitState === 'error'
              ? <>We couldn't reach the server, but your card is safe. Download it or copy the share link below, then tap Try Again.</>
              : submitResult && submitResult.email !== 'sent'
                ? <>You're in the community tally, but the email didn't go through. Download your card or copy the share link below.</>
                : <>{greenUpSteps(sectors, answers, customNotes).length
                    ? <>Your result and Green-Up Plan are in your inbox at <strong>{email}</strong>.</>
                    : <>Results sent to <strong>{email}</strong>.</>} Not there? Check spam.</>}
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
                style={{ padding: '0 16px', borderRadius: 10, border: 'none', background: palette.accentDark, color: '#fff',
                  fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
                  cursor: emailDraftOk ? 'pointer' : 'default', opacity: emailDraftOk ? 1 : 0.5, minHeight: 44 }}>Resend</button>
              <button onClick={() => setEditingEmail(false)} aria-label="Cancel editing email"
                style={{ padding: '0 12px', borderRadius: 10, border: `1.5px solid ${palette.text}22`, background: 'transparent',
                  color: palette.text, fontSize: 16, cursor: 'pointer', minHeight: 44 }}>✕</button>
            </div>
          ) : (
            <button onClick={() => { setEmailDraft(email); setEditingEmail(true); }}
              style={{ display: 'block', margin: '-6px auto 16px', background: 'none', border: 'none',
                color: palette.accentText, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Wrong email? Edit and resend
            </button>
          )
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleDownload}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              background: palette.accentDark, color: '#fff', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: `0 3px 0 ${palette.accentDeep}` }}>
            <DownloadIcon />
            Download
          </button>
          <button onClick={handleShare}
            style={{ flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              background: '#3B6FD4', color: '#fff', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer',
              boxShadow: '0 3px 0 #2b539e' }}>
            {copied === 'error' ? "Couldn't copy link" : copied ? 'Link copied!' : '↗ Share link'}
          </button>
        </div>

        {needsRetry && (
          <button onClick={handleRetry} disabled={submitState === 'sending'}
            style={{ marginTop: 12, width: '100%', padding: '13px 0', borderRadius: 12,
              border: 'none', background: '#C4483B', color: '#fff',
              fontSize: 13, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              boxShadow: '0 3px 0 #912F25',
              cursor: submitState === 'sending' ? 'default' : 'pointer', opacity: submitState === 'sending' ? 0.6 : 1 }}>
            {submitState === 'sending' ? 'Sending…' : '↻ Try Again'}
          </button>
        )}

        <GreenUpPlan sectors={sectors} answers={answers} notes={customNotes} palette={palette}
          emailed={!!(submitResult && submitResult.email === 'sent')} />

        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 14, color: palette.text, marginBottom: 16 }}>Thoughts? We'd love to hear them.</div>
          <a href={'mailto:' + REPORT_EMAIL}
            style={{ display: 'inline-block', padding: '14px 28px', borderRadius: 12, border: 'none',
              background: '#E07C39', color: '#fff', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.12em', textTransform: 'uppercase', textDecoration: 'none',
              boxShadow: '0 3px 0 #A9531C' }}>
            Send Feedback
          </a>
        </div>

        <button onClick={handleExit}
          style={{ marginTop: 24, background: 'none', border: 'none', color: `${palette.text}99`, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
          ✕ Exit
        </button>

        {showGolden && <GoldenCelebration onDone={() => setShowGolden(false)}/>}
      </div>
    );
  }

  // PLAYING
  const totalAttempted = sectors.reduce((acc, s) => acc + (sectorClosed[s.id] ? 1 : 0), 0);

  return (
    <div style={{ padding: '20px 16px 32px', maxWidth: 480, margin: '0 auto' }}>
      {restored && <div style={{ margin: '0 0 12px' }}><RestoredBanner onDismiss={() => setRestored(false)} /></div>}
      {/* back to intake (fix a typo'd detail, or step further back to home) + brand
          title, on one compact row. Progress is safe — the autosave persists and
          startGame only resets when the mode actually changes. The equal 1fr side
          columns keep the title centered regardless of the Back button's width. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          onClick={() => setPhase('intro')}
          aria-label="Back to your camp details"
          style={{ ...BACK_BTN_STYLE, cursor: 'pointer', color: palette.text + '99', justifySelf: 'start' }}
        >← Back</button>

        <div style={{ minWidth: 0, textAlign: 'center' }}>
          {/* Deliberate two-line lockup: the single-line title wraps mid-phrase
              at 390px, so the brand goes big and BLAST {year} is its eyebrow. */}
          <div style={{ fontSize: 17, fontWeight: 900, letterSpacing: '0.08em', color: palette.heading, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
            GREEN RADIUS
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.28em', color: palette.text + '99', lineHeight: 1.2, marginTop: 1 }}>
            BLAST {new Date().getFullYear()}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: palette.heading, lineHeight: 1.2, marginTop: 3, textWrap: 'balance' }}>
            {camp.campName}
          </div>
        </div>
      </div>

      {/* wheel (+ sector-done toast anchored above the center hub) */}
      <div style={{ position: 'relative' }}>
        <Wheel
          sectors={sectors}
          fills={fills}
          rotation={rotation}
          spinning={spinning}
          canSpin={!allDone}
          onSpin={onSpin}
          palette={palette}
          shinePaused={!!activeQuestion}
        />
        {toast && (
          <ResultToast kind={toast.kind} sector={toast.sector} greens={toast.greens} palette={palette} onClose={() => setToast(null)}/>
        )}
      </div>

      {/* score, in the gap between wheel and status bar */}
      <div style={{ textAlign: 'center', marginTop: 8 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: palette.accentDark, lineHeight: 1 }}>
          {totalYesAll}<span style={{ fontSize: 18, opacity: 0.5 }}>/60</span>
        </div>
      </div>

      {/* status / hint */}
      <div style={{
        marginTop: 8, padding: '10px 14px', borderRadius: 10,
        background: `linear-gradient(135deg, ${palette.card}, ${palette.accent}1e)`,
        border: `1px solid ${palette.accent}44`,
        boxShadow: `inset 0 1px 0 ${palette.accent}22`,
        fontSize: 12, fontWeight: 700, color: palette.accentDark, letterSpacing: '0.02em',
        textAlign: 'center', textWrap: 'pretty',
      }}>
        {(() => {
          if (totalAttempted === 0) return 'Tap Spin. The wheel picks a sector. Answer its 10 questions to score it. Six spins total.';
          if (allDone) return 'All six done. Behold your radius.';
          const left = sectors.filter(s => !sectorClosed[s.id]).length;
          return `${left} ${left === 1 ? 'sector' : 'sectors'} left. Spin again.`;
        })()}
      </div>

      {/* sector legend */}
      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
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

      <div style={{ textAlign: 'center', marginTop: 16 }}>
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
          onAnswer={(qid, v) => setAnswers(a => {
            const next = { ...a };
            if (v == null) delete next[qid]; else next[qid] = v;
            return next;
          })}
          existingAnswers={answers}
          palette={palette}
        />
      )}
      {celebration && (
        <Celebration sector={celebration.sector} palette={palette} onDone={() => setCelebration(null)}/>
      )}
    </div>
  );
}
