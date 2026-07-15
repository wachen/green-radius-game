// @generated from green-radius.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
function trackEvent(event, props) {
  try {
    const body = JSON.stringify({ event, ...props });
    if (navigator.sendBeacon)
      navigator.sendBeacon("/api/event", body);
    else
      fetch("/api/event", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch (e) {}
}
function greenUpSteps(sectors, answers, notes) {
  const groups = [];
  for (const s of sectors) {
    const steps = [];
    (s.levels || []).forEach((qs, i) => {
      (qs || []).forEach((q) => {
        if (answers[q.id] === "no")
          steps.push({ level: i + 1, title: q.title, link: q.link });
      });
    });
    (s.tier4Topics || []).forEach((t) => {
      if (answers[t.id] !== "no")
        return;
      const note = notes && typeof notes[t.id] === "string" && notes[t.id].trim();
      steps.push({ level: 4, title: note ? `${t.title}: ${note}` : t.title, link: t.link });
    });
    if (steps.length)
      groups.push({ sector: s.name, steps });
  }
  return groups;
}
function GreenUpPlan({ sectors, answers, notes, palette, emailed }) {
  const groups = greenUpSteps(sectors, answers, notes);
  if (!groups.length)
    return null;
  const ink = "#1f4a2c";
  return React.createElement("div", {
    style: { marginTop: 20, textAlign: "left", background: "linear-gradient(160deg, #eaf6e2 0%, #dff0d4 100%)", borderRadius: 12, overflow: "hidden" }
  }, React.createElement("div", {
    style: { padding: "20px 16px 16px" }
  }, React.createElement("div", {
    style: { fontSize: 20, fontWeight: 800, color: ink, textAlign: "center", margin: "0 0 18px" }
  }, "Your Green-Up Plan"), React.createElement("div", {
    style: { fontSize: 13, color: ink, opacity: 0.8, textAlign: "center", margin: "0 0 14px" }
  }, "Some ideas to grow your radius next year"), groups.map((g) => React.createElement("div", {
    key: g.sector,
    style: { marginBottom: 12 }
  }, React.createElement("div", {
    style: { fontSize: 11, letterSpacing: "0.12em", fontWeight: 800, textTransform: "uppercase", color: "#3d6b2e", marginBottom: 4 }
  }, g.sector), g.steps.slice(0, 3).map((st, i) => React.createElement("div", {
    key: i,
    style: { padding: "4px 0", fontSize: 14, color: ink }
  }, React.createElement("span", {
    style: { opacity: 0.85 }
  }, "L", st.level, " · "), st.title)))), emailed && React.createElement("div", {
    style: { fontSize: 12, fontStyle: "italic", color: ink, opacity: 0.8, textAlign: "center", margin: "10px 0 0" }
  }, "The full list is in your email")));
}
function Intro({ onStart, onBack, palette, description, initial }) {
  const [campName, setCampName] = useState(initial && initial.campName || "");
  const [leadName, setLeadName] = useState(initial && initial.leadName || "");
  const [email, setEmail] = useState(initial && initial.email || "");
  const [tried, setTried] = useState(false);
  const campOk = !!campName.trim();
  const leadOk = !!leadName.trim();
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const canStart = campOk && leadOk && emailOk;
  function handleStart() {
    if (!canStart) {
      setTried(true);
      return;
    }
    onStart({ campName: campName.trim(), leadName: leadName.trim(), email: email.trim() });
  }
  const missing = [];
  if (!campOk)
    missing.push("a camp name");
  if (!leadOk)
    missing.push("your name");
  if (!emailOk)
    missing.push("a valid email");
  const missingMsg = missing.length === 1 ? `Please add ${missing[0]} to continue.` : missing.length === 2 ? `Please add ${missing[0]} and ${missing[1]} to continue.` : `Please add ${missing.slice(0, -1).join(", ")}, and ${missing[missing.length - 1]} to continue.`;
  return React.createElement("div", {
    style: { padding: "20px 24px 28px", maxWidth: 480, margin: "0 auto", textAlign: "center" }
  }, React.createElement("div", {
    style: { textAlign: "left", marginBottom: 12 }
  }, React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back to mode picker",
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: palette.text + "99",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      padding: "4px 0",
      fontFamily: "inherit"
    }
  }, "← Back")), React.createElement("h1", {
    style: {
      fontSize: 44,
      lineHeight: 1,
      fontWeight: 900,
      margin: "0 0 8px",
      textWrap: "balance",
      color: palette.heading,
      letterSpacing: "-0.02em"
    }
  }, React.createElement("span", {
    style: { whiteSpace: "nowrap" }
  }, "What's Your"), " ", React.createElement("span", {
    style: { whiteSpace: "nowrap" }
  }, "Green Radius?")), React.createElement("div", {
    style: { fontSize: 15, lineHeight: 1.5, color: palette.text + "cc", marginBottom: 32, textWrap: "pretty" }
  }, description), React.createElement("div", {
    style: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 28, textAlign: "left" }
  }, React.createElement(Field, {
    label: "Camp name",
    value: campName,
    onChange: setCampName,
    placeholder: "Your Theme Camp",
    palette,
    required: true,
    invalid: tried && !campOk
  }), React.createElement(Field, {
    label: "Sustainability lead",
    value: leadName,
    onChange: setLeadName,
    placeholder: "Your (Playa) Name",
    palette,
    required: true,
    invalid: tried && !leadOk
  }), React.createElement(Field, {
    label: "Email address",
    value: email,
    onChange: setEmail,
    placeholder: "you@your.camp",
    palette,
    required: true,
    invalid: tried && !emailOk,
    type: "email"
  })), React.createElement("button", {
    onClick: handleStart,
    "aria-label": "Start",
    style: {
      width: "100%",
      padding: "16px",
      borderRadius: 14,
      border: "none",
      background: palette.accent,
      color: "#fff",
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: "0.15em",
      textTransform: "uppercase",
      cursor: "pointer",
      boxShadow: `0 4px 0 ${palette.accentDark}`,
      minHeight: 52
    }
  }, "Start →"), tried && !canStart && React.createElement("div", {
    role: "alert",
    style: {
      fontSize: 12,
      lineHeight: 1.4,
      color: "#B4463A",
      marginTop: 10,
      fontWeight: 700,
      textWrap: "pretty"
    }
  }, missingMsg), React.createElement("div", {
    style: {
      fontSize: 11,
      lineHeight: 1.45,
      color: palette.text + "99",
      marginTop: 16,
      textWrap: "pretty"
    }
  }, "By continuing, you agree the Green Theme Camp Community will email your results. We store your camp name, email, and answers to track community progress, and never share or sell them."), React.createElement("div", {
    style: {
      fontSize: 10,
      letterSpacing: "0.15em",
      color: palette.text + "66",
      marginTop: 24,
      fontWeight: 600
    }
  }, "6 SECTORS · 4 LEVELS · UP TO 60 QUESTIONS"), React.createElement("a", {
    href: COMMUNITY_LINK_URL,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      fontSize: 11,
      letterSpacing: "0.3em",
      fontWeight: 700,
      color: palette.accent,
      marginTop: 32,
      lineHeight: 1.5,
      textDecoration: "none",
      display: "block"
    }
  }, "CREATED BY THE", React.createElement("br", null), "GREEN THEME CAMP COMMUNITY"));
}
function Field({ label, value, onChange, placeholder, palette, required, invalid, type }) {
  const isEmail = type === "email";
  return React.createElement("label", {
    style: { display: "block" }
  }, React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.15em", fontWeight: 700, color: palette.text + "99", marginBottom: 4 }
  }, label.toUpperCase(), required && React.createElement("span", {
    "aria-hidden": "true",
    style: { color: palette.accentDark, marginLeft: 3 }
  }, "*")), React.createElement("input", {
    type: type || "text",
    value,
    onChange: (e) => onChange(e.target.value),
    placeholder,
    required,
    "aria-invalid": invalid || undefined,
    inputMode: isEmail ? "email" : undefined,
    autoCapitalize: isEmail ? "none" : undefined,
    autoCorrect: isEmail ? "off" : undefined,
    autoComplete: isEmail ? "email" : undefined,
    spellCheck: isEmail ? false : undefined,
    style: {
      width: "100%",
      padding: "12px 14px",
      borderRadius: 10,
      border: `1.5px solid ${invalid ? "#B4463A" : palette.text + "22"}`,
      background: palette.card,
      color: palette.text,
      fontSize: 16,
      fontFamily: "inherit"
    }
  }));
}
function RestoredBanner({ onDismiss }) {
  return React.createElement("div", {
    role: "status",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      background: "#FEF3C7",
      color: "#5b4a16",
      border: "1px solid #F4D67A",
      borderRadius: 10,
      padding: "10px 12px",
      margin: "12px 16px 0",
      fontSize: 12.5,
      lineHeight: 1.4
    }
  }, React.createElement("span", {
    style: { flex: 1 }
  }, "We updated the game and restored your saved answers. Some progress may have shifted."), React.createElement("button", {
    onClick: onDismiss,
    "aria-label": "Dismiss",
    style: {
      border: "none",
      background: "transparent",
      cursor: "pointer",
      color: "#5b4a16",
      fontSize: 16,
      lineHeight: 1,
      minWidth: 32,
      minHeight: 32
    }
  }, "✕"));
}
function useResultReveal(total, active, reduceMotion) {
  const instant = !active || reduceMotion || total <= 0;
  const [value, setValue] = useState(instant ? total : 0);
  const [done, setDone] = useState(instant);
  useEffect(() => {
    if (!active || reduceMotion || total <= 0) {
      setValue(total);
      setDone(true);
      return;
    }
    setValue(0);
    setDone(false);
    const WINDOW = 1500;
    const step = Math.max(24, WINDOW / total);
    let n = 0;
    const iv = setInterval(() => {
      n++;
      setValue(n);
      if (n >= total) {
        clearInterval(iv);
        setDone(true);
      }
    }, step);
    return () => clearInterval(iv);
  }, [active, reduceMotion, total]);
  return { value, done };
}
function GreenRadiusGame({ variant = "dimensional", palette, debugFill = false }) {
  const sectors = window.SECTORS;
  const saved = useMemo(() => loadSaved(sectors), [sectors]);
  const [phase, setPhase] = useState(saved?.phase || "pick-mode");
  const [camp, setCamp] = useState(saved?.camp || { campName: "", leadName: "", email: "" });
  const [campId, setCampId] = useState(() => saved?.campId || genCampId());
  const [sectorCursor, setSectorCursor] = useState(() => {
    if (saved?.sectorCursor)
      return saved.sectorCursor;
    const o = {};
    sectors.forEach((s) => o[s.id] = 0);
    return o;
  });
  const [sectorClosed, setSectorClosed] = useState(() => {
    if (saved?.sectorClosed)
      return saved.sectorClosed;
    const o = {};
    sectors.forEach((s) => o[s.id] = false);
    return o;
  });
  const [answers, setAnswers] = useState(saved?.answers || {});
  const [customNotes, setCustomNotes] = useState(() => saved && saved.customNotes && typeof saved.customNotes === "object" ? saved.customNotes : {});
  const [mode, setMode] = useState(saved?.mode || null);
  const fills = useMemo(() => fillsFromAnswers(sectors, answers), [sectors, answers]);
  const [submittedAt, setSubmittedAt] = useState(saved?.submittedAt || null);
  const [submitState, setSubmitState] = useState("idle");
  const [submitResult, setSubmitResult] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const cardSvgRef = useRef(null);
  const cardPngRef = useRef(null);
  const autoSentRef = useRef(false);
  const submitGenRef = useRef(0);
  const spinTimerRef = useRef(null);
  const [restored, setRestored] = useState(saved?.salvaged || false);
  const revealArmedRef = useRef(false);
  const rankRef = useRef(null);
  const revealReduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const totalYesAll = sectors.reduce((n, s) => n + (fills[s.id] ? fills[s.id].totalYes : 0), 0);
  const revealActive = phase === "done" && revealArmedRef.current && mode === "board";
  const { value: revealValue, done: revealDone } = useResultReveal(totalYesAll, revealActive, revealReduceMotion);
  useEffect(() => {
    if (revealActive && revealDone && rankRef.current)
      Fx.leafBurst(rankRef.current);
  }, [revealActive, revealDone]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState(() => {
    const id = saved && saved.activeSectorId;
    if (!id)
      return null;
    const s = sectors.find((x) => x.id === id);
    const closed = saved.sectorClosed && saved.sectorClosed[id];
    return s && !closed ? { sector: s } : null;
  });
  const [toast, setToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const allDone = sectors.every((s) => sectorClosed[s.id]);
  useEffect(() => {
    if (phase === "playing" && allDone && !celebration) {
      const t = setTimeout(() => {
        revealArmedRef.current = true;
        setPhase("done");
      }, 800);
      return () => clearTimeout(t);
    }
  }, [phase, allDone, celebration]);
  const runSubmit = useCallback((overrideEmail) => {
    const gen = ++submitGenRef.current;
    autoSentRef.current = true;
    fontEmbedCss();
    (async () => {
      const greens = {};
      sectors.forEach((s) => {
        greens[s.id] = sectorFill(s, answers).totalYes;
      });
      const year = new Date().getFullYear();
      const resultUrl = window.location.origin + "/result/?r=" + window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
      const email = (overrideEmail != null ? overrideEmail : camp.email || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        if (gen === submitGenRef.current)
          setSubmitState("error");
        return;
      }
      setSubmitState("sending");
      const evMode = mode === "form" ? "form" : "board";
      trackEvent("submit_attempted", { mode: evMode, sectors: Object.values(greens).filter((v) => v > 0).length });
      const noteEntries = {};
      Object.keys(customNotes || {}).forEach((tid) => {
        const t = String(customNotes[tid] || "").trim();
        if (t && (answers[tid] === "yes" || answers[tid] === "no"))
          noteEntries[tid + "-note"] = t.slice(0, 160);
      });
      try {
        const res = await fetch("/api/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campName: camp.campName,
            leadName: camp.leadName,
            email,
            year,
            greens,
            mode: mode === "form" ? "form" : "board",
            answers: { ...answers, ...noteEntries },
            campId,
            schemaVersion: window.SCHEMA_VERSION || "",
            resultUrl
          })
        });
        const j = await res.json();
        if (gen !== submitGenRef.current)
          return;
        setSubmitResult({ sheet: j.sheet, email: j.email });
        if (j.sheet === "ok" || j.email === "sent") {
          setSubmittedAt(new Date().toISOString());
          setSubmitState("done");
          trackEvent("submit_succeeded", { mode: evMode });
        } else {
          setSubmitState("error");
          trackEvent("submit_failed", { mode: evMode });
        }
      } catch {
        if (gen === submitGenRef.current)
          setSubmitState("error");
        trackEvent("submit_failed", { mode: evMode });
      }
    })();
  }, [sectors, answers, customNotes, camp, fills, mode, campId]);
  useEffect(() => {
    if (phase !== "done")
      return;
    if (submittedAt) {
      setSubmitState("done");
      return;
    }
    if (autoSentRef.current)
      return;
    runSubmit();
  }, [phase, submittedAt, runSubmit]);
  useEffect(() => {
    if (phase !== "done" || !cardSvgRef.current)
      return;
    let alive = true;
    svgToPngBlob(cardSvgRef.current).then((b) => {
      if (alive)
        cardPngRef.current = b;
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [phase, fills]);
  useEffect(() => {
    if (phase !== "playing" && phase !== "form" && phase !== "done")
      return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        phase,
        camp,
        campId,
        sectorCursor,
        sectorClosed,
        answers,
        customNotes,
        mode,
        submittedAt,
        activeSectorId: activeQuestion && activeQuestion.sector && activeQuestion.sector.id || null
      }));
    } catch {}
  }, [phase, camp, sectorCursor, sectorClosed, answers, customNotes, mode, submittedAt, activeQuestion]);
  function setFormAnswer(qid, value) {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  }
  function setCustomNote(tid, text) {
    setCustomNotes((prev) => {
      const t = String(text || "");
      if (!t.trim()) {
        if (!(tid in prev))
          return prev;
        const o = { ...prev };
        delete o[tid];
        return o;
      }
      return { ...prev, [tid]: t.slice(0, NOTE_MAX_LEN) };
    });
  }
  function submitForm({ sectorCursor: sc, sectorClosed: scl }) {
    setSectorCursor(sc);
    setSectorClosed(scl);
    setPhase("done");
  }
  function pickSector() {
    const eligible = sectors.filter((s) => !sectorClosed[s.id]);
    if (eligible.length === 0)
      return null;
    return eligible[Math.floor(Math.random() * eligible.length)];
  }
  const onSpin = useCallback(() => {
    const target = pickSector();
    if (!target)
      return;
    const idx = sectors.findIndex((s) => s.id === target.id);
    const sweep = 360 / sectors.length;
    const targetMid = idx * sweep + sweep / 2;
    const targetMod = (-targetMid % 360 + 360) % 360;
    const baseTurns = 2;
    const currentMod = (rotation % 360 + 360) % 360;
    const forwardDelta = ((targetMod - currentMod) % 360 + 360) % 360;
    const jitter = (Math.random() - 0.5) * (sweep * 0.5);
    const newRotation = rotation + baseTurns * 360 + forwardDelta + jitter;
    setSpinning(true);
    setRotation(newRotation);
    const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setActiveQuestion({ sector: target });
    }, reduceMotion ? 500 : 2300);
  }, [sectors, sectorClosed, rotation]);
  function handleAnswers(answersByLevel, pickedTopicIds = [], notes = {}) {
    const { sector } = activeQuestion;
    const sectorAns = {};
    for (let li = 0;li < 3; li++) {
      (sector.levels[li] || []).forEach((q, i) => {
        const a = (answersByLevel[li] || [])[i];
        if (a === true || a === false)
          sectorAns[q.id] = a ? "yes" : "no";
      });
    }
    (pickedTopicIds || []).forEach((tid, i) => {
      const a = (answersByLevel[3] || [])[i];
      if (tid && (a === true || a === false))
        sectorAns[tid] = a ? "yes" : "no";
    });
    if (notes && Object.keys(notes).length)
      setCustomNotes((prev) => ({ ...prev, ...notes }));
    const merged = { ...answers, ...sectorAns };
    setAnswers(merged);
    setSectorCursor({ ...sectorCursor, [sector.id]: 4 });
    setSectorClosed({ ...sectorClosed, [sector.id]: true });
    setActiveQuestion(null);
    const totalYes = sectorFill(sector, merged).totalYes;
    if (totalYes === 10)
      setCelebration({ sector });
    else
      setToast({ kind: "sector-done", sector, greens: totalYes });
  }
  function freshProgress() {
    clearTimeout(spinTimerRef.current);
    setSpinning(false);
    setActiveQuestion(null);
    setAnswers({});
    setCustomNotes({});
    setSectorCursor(() => {
      const o = {};
      sectors.forEach((s) => o[s.id] = 0);
      return o;
    });
    setSectorClosed(() => {
      const o = {};
      sectors.forEach((s) => o[s.id] = false);
      return o;
    });
    setSubmittedAt(null);
    setSubmitState("idle");
    setSubmitResult(null);
    setEditingEmail(false);
    autoSentRef.current = false;
    submitGenRef.current++;
    revealArmedRef.current = false;
    setCampId(genCampId());
  }
  function startGame(info) {
    if (mode !== "board")
      freshProgress();
    setCamp(info);
    setMode("board");
    trackEvent("mode_chosen", { mode: "board" });
    setPhase("playing");
    if (debugFill) {
      const demo = {};
      sectors.forEach((s, i) => {
        [].concat(...s.levels.slice(0, 3)).forEach((q, qi) => {
          demo[q.id] = qi <= i ? "yes" : "no";
        });
        (s.tier4Topics || []).slice(0, i % 4).forEach((t) => {
          demo[t.id] = "yes";
        });
      });
      setAnswers(demo);
    }
  }
  function startForm(info) {
    if (mode !== "form")
      freshProgress();
    setCamp(info);
    setMode("form");
    trackEvent("mode_chosen", { mode: "form" });
    setPhase("form");
  }
  const displayStates = fills;
  if (phase === "pick-mode") {
    return React.createElement(ModePicker, {
      onPick: (mode) => {
        trackEvent("game_started");
        setPhase(mode === "board" ? "intro" : "form-intro");
      },
      palette
    });
  }
  if (phase === "form-intro") {
    return React.createElement(Intro, {
      onStart: startForm,
      onBack: () => setPhase("pick-mode"),
      palette,
      description: "Answer as best you can. Progress autosaves unless you reset.",
      initial: camp
    });
  }
  if (phase === "form") {
    return React.createElement(React.Fragment, null, restored && React.createElement(RestoredBanner, {
      onDismiss: () => setRestored(false)
    }), React.createElement(LinearForm, {
      sectors,
      answers,
      setAnswer: setFormAnswer,
      notes: customNotes,
      setNote: setCustomNote,
      onSubmit: submitForm,
      onBack: () => setPhase("form-intro"),
      onClear: () => {
        setAnswers({});
        setCustomNotes({});
      },
      palette
    }));
  }
  if (phase === "intro") {
    return React.createElement(Intro, {
      onStart: startGame,
      onBack: () => setPhase("pick-mode"),
      palette,
      description: "Spin the wheel and answer as best you can. Progress autosaves unless you reset.",
      initial: camp
    });
  }
  if (phase === "done") {
    let handleRetry = function() {
      setSubmitResult(null);
      runSubmit();
    }, handleResend = function() {
      const e = emailDraft.trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
        return;
      setCamp((c) => ({ ...c, email: e }));
      setEditingEmail(false);
      setSubmitResult(null);
      runSubmit(e);
    }, handleExit = function() {
      const safe = submitState === "done" || !!submittedAt;
      if (!safe && !confirm("Your results haven't been emailed yet. Exit and discard them?"))
        return;
      submitGenRef.current++;
      clearSaved();
      autoSentRef.current = false;
      revealArmedRef.current = false;
      setSectorCursor(() => {
        const o = {};
        sectors.forEach((s) => o[s.id] = 0);
        return o;
      });
      setSectorClosed(() => {
        const o = {};
        sectors.forEach((s) => o[s.id] = false);
        return o;
      });
      setAnswers({});
      setCustomNotes({});
      setMode(null);
      setCamp({ campName: "", leadName: "", email: "" });
      setCampId(genCampId());
      setSubmittedAt(null);
      setSubmitState("idle");
      setSubmitResult(null);
      setEditingEmail(false);
      setPhase("pick-mode");
    };
    const year = new Date().getFullYear();
    const total = sectors.reduce((n, s) => n + (fills[s.id] ? fills[s.id].totalYes : 0), 0);
    const resultUrl = window.location.origin + "/result/?r=" + window.ResultState.encode({ campName: camp.campName, leadName: camp.leadName, year, fills });
    const email = (camp.email || "").trim();
    const slug = (camp.campName || "theme-camp").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "theme-camp";
    const needsRetry = submitState === "error" || submitResult && submitResult.email !== "sent";
    async function handleShare() {
      const shareText = `Our camp reached ${total}/60. Build your camp's Green Radius:`;
      const blob = cardPngRef.current;
      const file = blob ? new File([blob], `green-radius-${slug}.png`, { type: "image/png" }) : null;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Our Green Radius", text: shareText, url: resultUrl });
          return;
        } catch (e) {
          if (e && e.name === "AbortError")
            return;
        }
      }
      if (navigator.share) {
        try {
          await navigator.share({ title: "Our Green Radius", text: shareText, url: resultUrl });
          return;
        } catch (e) {
          if (e && e.name === "AbortError")
            return;
        }
      }
      try {
        await navigator.clipboard.writeText(resultUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        setCopied("error");
        setTimeout(() => setCopied(false), 1500);
      }
    }
    async function handleDownload() {
      if (!cardSvgRef.current)
        return;
      try {
        await downloadSvgAsPng(cardSvgRef.current, `green-radius-${slug}.png`);
      } catch {}
    }
    const emailDraftOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailDraft.trim());
    return React.createElement("div", {
      style: { padding: "32px 20px", maxWidth: 480, margin: "0 auto", textAlign: "center" }
    }, React.createElement("div", {
      style: { fontSize: 11, letterSpacing: "0.3em", fontWeight: 700, color: palette.accent, marginBottom: 8 }
    }, "YOUR GREEN RADIUS"), React.createElement("h2", {
      style: { fontSize: 28, fontWeight: 800, margin: "0 0 24px", color: palette.heading, letterSpacing: "-0.01em" }
    }, camp.campName), React.createElement("div", {
      style: {
        fontSize: 18,
        fontWeight: 800,
        color: palette.heading,
        margin: "-16px 0 24px",
        ...revealActive && !revealDone ? { visibility: "hidden" } : {}
      }
    }, React.createElement("span", {
      ref: rankRef,
      style: {
        display: "inline-block",
        animation: revealActive && revealDone && !revealReduceMotion ? "grg-rankslam 0.7s cubic-bezier(.22,1,.36,1) both" : "none"
      }
    }, total, "/60 · Thanks for playing!")), React.createElement("div", {
      style: { display: "flex", justifyContent: "center", marginBottom: 24 }
    }, React.createElement(ShareCard, {
      sectors,
      fills,
      campName: camp.campName,
      leadName: camp.leadName,
      year,
      palette,
      reveal: revealActive ? revealValue : null
    })), React.createElement("div", {
      "aria-hidden": "true",
      style: { position: "absolute", left: -99999, top: 0, width: CARD_W, height: CARD_H, overflow: "hidden", pointerEvents: "none" }
    }, React.createElement(ResultCardSVG, {
      svgRef: cardSvgRef,
      sectors,
      fills,
      campName: camp.campName,
      leadName: camp.leadName,
      year
    })), React.createElement("div", {
      role: "status",
      "aria-live": "polite",
      style: { marginBottom: 16, color: palette.text, fontSize: 14, lineHeight: 1.5 }
    }, submitState === "sending" ? React.createElement(React.Fragment, null, "Emailing your results to ", React.createElement("strong", null, email), "…") : submitState === "error" ? React.createElement(React.Fragment, null, "We couldn't reach the server, but your card is safe. Download it or copy the share link below, then tap Try Again.") : submitResult && submitResult.email !== "sent" ? React.createElement(React.Fragment, null, "You're in the community tally, but the email didn't go through. Download your card or copy the share link below.") : React.createElement(React.Fragment, null, greenUpSteps(sectors, answers, customNotes).length ? React.createElement(React.Fragment, null, "Your result and Green-Up Plan are in your inbox at ", React.createElement("strong", null, email), ".") : React.createElement(React.Fragment, null, "Results sent to ", React.createElement("strong", null, email), "."), " Not there? Check spam.")), submitState !== "sending" && (editingEmail ? React.createElement("div", {
      style: { display: "flex", gap: 8, marginBottom: 16 }
    }, React.createElement("input", {
      type: "email",
      value: emailDraft,
      onChange: (e) => setEmailDraft(e.target.value),
      "aria-label": "Your email address",
      placeholder: "you@camp.org",
      inputMode: "email",
      autoCapitalize: "none",
      autoCorrect: "off",
      spellCheck: false,
      style: {
        flex: 1,
        padding: "10px 12px",
        borderRadius: 10,
        fontSize: 16,
        fontFamily: "inherit",
        border: `1.5px solid ${emailDraftOk ? palette.text + "22" : "#B4463A"}`,
        background: palette.card,
        color: palette.text
      }
    }), React.createElement("button", {
      onClick: handleResend,
      disabled: !emailDraftOk,
      style: {
        padding: "0 16px",
        borderRadius: 10,
        border: "none",
        background: palette.accent,
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        cursor: emailDraftOk ? "pointer" : "default",
        opacity: emailDraftOk ? 1 : 0.5,
        minHeight: 44
      }
    }, "Resend"), React.createElement("button", {
      onClick: () => setEditingEmail(false),
      "aria-label": "Cancel editing email",
      style: {
        padding: "0 12px",
        borderRadius: 10,
        border: `1.5px solid ${palette.text}22`,
        background: "transparent",
        color: palette.text,
        fontSize: 16,
        cursor: "pointer",
        minHeight: 44
      }
    }, "✕")) : React.createElement("button", {
      onClick: () => {
        setEmailDraft(email);
        setEditingEmail(true);
      },
      style: {
        display: "block",
        margin: "-6px auto 16px",
        background: "none",
        border: "none",
        color: palette.accentDark,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        textDecoration: "underline",
        textUnderlineOffset: 3
      }
    }, "Wrong email? Edit and resend")), React.createElement("div", {
      style: { display: "flex", gap: 10 }
    }, React.createElement("button", {
      onClick: handleDownload,
      style: {
        flex: 1,
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: palette.accent,
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        boxShadow: `0 3px 0 ${palette.accentDark}`
      }
    }, React.createElement(DownloadIcon, null), "Download"), React.createElement("button", {
      onClick: handleShare,
      style: {
        flex: 1,
        padding: "14px 0",
        borderRadius: 12,
        border: "none",
        background: "#3B6FD4",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
        boxShadow: "0 3px 0 #2b539e"
      }
    }, copied === "error" ? "Couldn't copy link" : copied ? "Link copied!" : "↗ Share link")), needsRetry && React.createElement("button", {
      onClick: handleRetry,
      disabled: submitState === "sending",
      style: {
        marginTop: 12,
        width: "100%",
        padding: "13px 0",
        borderRadius: 12,
        border: "none",
        background: "#C4483B",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        boxShadow: "0 3px 0 #912F25",
        cursor: submitState === "sending" ? "default" : "pointer",
        opacity: submitState === "sending" ? 0.6 : 1
      }
    }, submitState === "sending" ? "Sending…" : "↻ Try Again"), React.createElement(GreenUpPlan, {
      sectors,
      answers,
      notes: customNotes,
      palette,
      emailed: !!(submitResult && submitResult.email === "sent")
    }), React.createElement("div", {
      style: { marginTop: 24 }
    }, React.createElement("div", {
      style: { fontSize: 14, color: palette.text, marginBottom: 16 }
    }, "Thoughts? We'd love to hear them."), React.createElement("a", {
      href: "mailto:" + REPORT_EMAIL,
      style: {
        display: "inline-block",
        padding: "14px 28px",
        borderRadius: 12,
        border: "none",
        background: "#E07C39",
        color: "#fff",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        textDecoration: "none",
        boxShadow: "0 3px 0 #A9531C"
      }
    }, "Send Feedback")), React.createElement("button", {
      onClick: handleExit,
      style: { marginTop: 24, background: "none", border: "none", color: `${palette.text}99`, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }
    }, "✕ Exit"));
  }
  const totalGreens = sectors.reduce((acc, s) => acc + (fills[s.id].totalYes || 0), 0);
  const totalAttempted = sectors.reduce((acc, s) => acc + (sectorClosed[s.id] ? 1 : 0), 0);
  const backBtn = {
    background: "transparent",
    border: "none",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "4px 0",
    fontFamily: "inherit"
  };
  return React.createElement("div", {
    style: { padding: "20px 16px 32px", maxWidth: 480, margin: "0 auto" }
  }, restored && React.createElement("div", {
    style: { margin: "0 0 12px" }
  }, React.createElement(RestoredBanner, {
    onDismiss: () => setRestored(false)
  })), React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 8, marginBottom: 12 }
  }, React.createElement("button", {
    onClick: () => setPhase("intro"),
    "aria-label": "Back to your camp details",
    style: { ...backBtn, cursor: "pointer", color: palette.text + "99", justifySelf: "start" }
  }, "← Back"), React.createElement("div", {
    style: { minWidth: 0, textAlign: "center" }
  }, React.createElement("div", {
    style: { fontSize: 17, fontWeight: 900, letterSpacing: "0.08em", color: palette.heading, lineHeight: 1.15, whiteSpace: "nowrap" }
  }, "GREEN RADIUS"), React.createElement("div", {
    style: { fontSize: 10, fontWeight: 800, letterSpacing: "0.28em", color: palette.text + "99", lineHeight: 1.2, marginTop: 1 }
  }, "BLAST ", new Date().getFullYear()), React.createElement("div", {
    style: { fontSize: 15, fontWeight: 800, color: palette.heading, lineHeight: 1.2, marginTop: 3, textWrap: "balance" }
  }, camp.campName)), React.createElement("button", {
    "aria-hidden": "true",
    tabIndex: -1,
    style: { ...backBtn, visibility: "hidden", justifySelf: "end" }
  }, "← Back")), React.createElement("div", {
    style: { position: "relative" }
  }, React.createElement(Wheel, {
    sectors,
    fills: displayStates,
    rotation,
    spinning,
    canSpin: !allDone,
    onSpin,
    variant,
    palette,
    shinePaused: !!activeQuestion
  }), toast && React.createElement(ResultToast, {
    kind: toast.kind,
    sector: toast.sector,
    greens: toast.greens,
    palette,
    onClose: () => setToast(null)
  })), React.createElement("div", {
    style: { textAlign: "center", marginTop: 8 }
  }, React.createElement("div", {
    style: { fontSize: 36, fontWeight: 900, color: "#5BA84A", lineHeight: 1 }
  }, totalGreens, React.createElement("span", {
    style: { fontSize: 18, opacity: 0.5 }
  }, "/60"))), React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "10px 14px",
      borderRadius: 10,
      background: `linear-gradient(135deg, ${palette.card}, ${palette.accent}1e)`,
      border: `1px solid ${palette.accent}44`,
      boxShadow: `inset 0 1px 0 ${palette.accent}22`,
      fontSize: 12,
      fontWeight: 700,
      color: palette.accentDark,
      letterSpacing: "0.02em",
      textAlign: "center",
      textWrap: "pretty"
    }
  }, (() => {
    if (totalAttempted === 0)
      return "Tap Spin. The wheel picks a sector. Answer its 10 questions to score it. Six spins total.";
    if (allDone)
      return "All six done. Behold your radius.";
    const left = sectors.filter((s) => !sectorClosed[s.id]).length;
    return `${left} ${left === 1 ? "sector" : "sectors"} left. Spin again.`;
  })()), React.createElement("div", {
    style: { marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }
  }, sectors.map((s) => {
    const f = fills[s.id];
    const ty = f.totalYes;
    const closed = sectorClosed[s.id];
    const accentBorder = ty === 10 ? LEVEL_COLORS[3] : ty > 0 ? LEVEL_COLORS[3] + "88" : palette.text + "22";
    const iconColor = ty > 0 ? LEVEL_COLORS[3] : palette.text + "cc";
    return React.createElement("div", {
      key: s.id,
      style: {
        padding: "10px 8px",
        borderRadius: 10,
        background: palette.card,
        border: `1.5px solid ${accentBorder}`,
        opacity: closed && ty === 0 ? 0.55 : 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4
      }
    }, React.createElement(SectorIcon, {
      kind: s.icon,
      size: 20,
      color: iconColor
    }), React.createElement("div", {
      style: { fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: palette.text }
    }, s.name.toUpperCase()), React.createElement("div", {
      style: { display: "flex", gap: 3 }
    }, [0, 1, 2, 3].map((li) => {
      const on = (f.levels[li] || []).some(Boolean);
      return React.createElement("div", {
        key: li,
        style: {
          width: 8,
          height: 8,
          borderRadius: 2,
          background: on ? LEVEL_COLORS[li] : "rgba(0,0,0,0.08)"
        }
      });
    })));
  })), React.createElement("div", {
    style: { textAlign: "center", marginTop: 16 }
  }, React.createElement("button", {
    type: "button",
    "aria-label": "Reset game progress",
    onClick: () => {
      if (totalAttempted === 0)
        return;
      if (!confirm("Reset progress and start over?"))
        return;
      freshProgress();
      clearSaved();
      setMode(null);
      setPhase("pick-mode");
    },
    disabled: totalAttempted === 0,
    style: {
      background: "transparent",
      border: "none",
      cursor: totalAttempted === 0 ? "default" : "pointer",
      color: palette.text + (totalAttempted === 0 ? "33" : "66"),
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.2em",
      textTransform: "uppercase",
      padding: "14px 12px",
      minHeight: 44,
      fontFamily: "inherit"
    }
  }, "Reset Game ↺")), activeQuestion && React.createElement(QuestionModal, {
    sector: activeQuestion.sector,
    onComplete: handleAnswers,
    onAnswer: (qid, v) => setAnswers((a) => {
      const next = { ...a };
      if (v == null)
        delete next[qid];
      else
        next[qid] = v;
      return next;
    }),
    existingAnswers: answers,
    palette,
    variant
  }), celebration && React.createElement(Celebration, {
    sector: celebration.sector,
    palette,
    onDone: () => setCelebration(null)
  }));
}
