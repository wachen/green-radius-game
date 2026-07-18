// @generated from admin/admin.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
const A = window.AdminAggregate;
const useMQ = (q) => {
  const [m, setM] = React.useState(() => window.matchMedia(q).matches);
  React.useEffect(() => {
    const mm = window.matchMedia(q);
    const h = (e) => setM(e.matches);
    mm.addEventListener("change", h);
    return () => mm.removeEventListener("change", h);
  }, [q]);
  return m;
};
function useResponses() {
  const [state, setState] = React.useState({ status: "loading", rows: [] });
  const load = React.useCallback(() => {
    setState((s) => ({ ...s, status: "loading" }));
    fetch("/api/admin/responses", { headers: { Accept: "application/json" } }).then((r) => r.ok ? r.json() : Promise.reject(new Error("http " + r.status))).then((d) => setState({ status: "ready", rows: d.rows || [] })).catch((e) => setState((s) => ({ status: "error", rows: s.rows, error: String(e) })));
  }, []);
  React.useEffect(load, [load]);
  return { ...state, reload: load };
}
function AdminApp({ sectors }) {
  const { status, rows, error, reload } = useResponses();
  const [tab, setTab] = React.useState("city");
  const [highlightCamp, setHighlightCamp] = React.useState(null);
  const [year, setYear] = React.useState(2026);
  const [source, setSource] = React.useState("all");
  const years = React.useMemo(() => Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => b - a), [rows]);
  const filtered = React.useMemo(() => rows.filter((r) => (!year || r.year === year) && (source === "all" || r.source === source)), [rows, year, source]);
  const Tab = ({ id, label, name }) => {
    const m = TAB_META[id];
    const active = tab === id;
    return React.createElement("button", {
      "data-tab": id,
      onClick: () => setTab(id),
      title: `Switch to the ${name} tab`,
      style: {
        fontWeight: 800,
        fontSize: 14,
        padding: "9px 22px",
        borderRadius: 12,
        cursor: "pointer",
        border: `2px solid ${active ? m.border : "#26382e"}`,
        background: active ? m.activeBg : "transparent",
        color: active ? m.text : m.mutedText,
        boxShadow: active ? "0 6px 16px rgba(0,0,0,0.35)" : "none",
        transition: "background .15s, border-color .15s"
      }
    }, label);
  };
  return React.createElement("div", {
    style: { maxWidth: tab === "camps" ? 1240 : 900, margin: "0 auto", padding: 14 }
  }, React.createElement("header", {
    style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 6, paddingBottom: 10, borderBottom: "1px solid #26382e" }
  }, React.createElement("b", {
    style: { fontWeight: 800 }
  }, "Green", React.createElement("span", {
    style: { color: "#45c483" }
  }, "Radius"), " · Admin"), React.createElement("a", {
    href: "/",
    title: "Back to the site",
    "aria-label": "Exit admin, back to the site",
    style: { ...selStyle, textDecoration: "none", fontWeight: 700, lineHeight: 1.4 }
  }, "EXIT ↗"), React.createElement("div", {
    style: { flex: 1 }
  }), React.createElement("div", {
    style: { display: "flex", gap: 8 }
  }, React.createElement(Tab, {
    id: "city",
    label: "\uD83C\uDF04 City",
    name: "City"
  }), React.createElement(Tab, {
    id: "camps",
    label: "\uD83C\uDFAA Camps",
    name: "Camps"
  }))), status === "loading" && rows.length === 0 && React.createElement(Centered, null, "Loading the community tally…"), status === "error" && rows.length === 0 && React.createElement(Centered, null, "Couldn't load responses (", error, "). ", React.createElement("button", {
    onClick: reload,
    style: btnStyle
  }, "Retry")), rows.length > 0 && React.createElement("div", {
    style: { opacity: status === "loading" ? 0.55 : 1, transition: "opacity .15s" }
  }, status === "error" && React.createElement("div", {
    style: { background: "#2a1c14", border: "1px solid #573a26", borderRadius: 8, padding: "7px 11px", margin: "10px 0 0", fontSize: 12, color: "#e8c15a" }
  }, "Refresh failed (", error, ") — showing the previous data. ", React.createElement("button", {
    onClick: reload,
    style: { ...btnStyle, padding: "2px 8px", marginLeft: 6 }
  }, "Retry")), filtered.length === 0 && React.createElement(Centered, null, "No camps yet", year ? ` for ${year}` : "", "."), filtered.length > 0 && (tab === "city" ? React.createElement(CommunityTally, {
    sectors,
    rows: filtered,
    onCampClick: (name) => {
      setHighlightCamp(name);
      setTab("camps");
    }
  }) : React.createElement(CampsView, {
    sectors,
    rows: filtered,
    highlight: highlightCamp,
    onClearHighlight: () => setHighlightCamp(null)
  }))), React.createElement("hr", {
    style: { border: "none", borderTop: "1px solid #26382e", margin: "24px 0 12px" }
  }), React.createElement("div", {
    style: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: 16 }
  }, React.createElement("span", {
    style: { marginRight: "auto", color: "#93a89b", fontSize: 12 }
  }, "Let's go build a failed utopia."), React.createElement("select", {
    value: year,
    onChange: (e) => setYear(+e.target.value),
    title: "Filter by year",
    style: selStyle
  }, React.createElement("option", {
    value: 0
  }, "All years"), years.length ? years.map((y) => React.createElement("option", {
    key: y,
    value: y
  }, y)) : React.createElement("option", {
    value: 2026
  }, "2026")), React.createElement("select", {
    value: source,
    onChange: (e) => setSource(e.target.value),
    title: "Filter by submission source",
    style: selStyle
  }, React.createElement("option", {
    value: "all"
  }, "All"), React.createElement("option", {
    value: "board"
  }, "Board"), React.createElement("option", {
    value: "form"
  }, "Form")), React.createElement("button", {
    "data-refresh": true,
    type: "button",
    onClick: reload,
    disabled: status === "loading",
    "aria-label": "Refresh responses",
    title: "Reload responses",
    style: { ...selStyle, cursor: status === "loading" ? "wait" : "pointer", fontWeight: 700 }
  }, status === "loading" ? "Loading…" : "Refresh")));
}
const TAB_META = {
  city: { activeBg: "linear-gradient(135deg,#155163,#1c6b82)", border: "#2a7d94", text: "#eaf7fb", mutedText: "#7fb8c9" },
  camps: { activeBg: "linear-gradient(135deg,#1f5c32,#2f7a41)", border: "#3f9153", text: "#eafbea", mutedText: "#8fce9e" }
};
const selStyle = { background: "#101b15", color: "#93a89b", border: "1px solid #26382e", borderRadius: 99, padding: "4px 8px", fontSize: 12 };
const btnStyle = { background: "#45c483", color: "#06140c", border: "none", borderRadius: 8, padding: "5px 10px", fontWeight: 700, cursor: "pointer" };
const Centered = ({ children }) => React.createElement("div", {
  style: { textAlign: "center", padding: "60px 0", color: "#93a89b" }
}, children);
const CITY_CARD_BG = "linear-gradient(160deg, #0e2733 0%, #14323f 100%)";
const panelStyle = { background: "#111d16", border: "1px solid #26382e", borderRadius: 16, padding: "14px 16px" };
function miniFills(sectors, entry) {
  const hasAns = entry.answers && Object.keys(entry.answers).some((k) => entry.answers[k] === "yes" || entry.answers[k] === "no");
  if (hasAns)
    return fillsFromAnswers(sectors, entry.answers);
  return A.isLegacy(entry) ? legacyFills(sectors, entry.greens) : approxFills(sectors, entry.greens);
}
function StatTile({ value, label }) {
  return React.createElement("div", {
    style: { ...panelStyle, textAlign: "center", padding: "12px 8px" }
  }, React.createElement("div", {
    style: { fontSize: 26, fontWeight: 900, color: "#7fc46a", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }
  }, value), React.createElement("div", {
    style: { fontSize: 9.5, letterSpacing: ".14em", color: "#93a89b", fontWeight: 800, marginTop: 2 }
  }, label.toUpperCase()));
}
function Superlative({ label, value, detail }) {
  return React.createElement("div", {
    style: { display: "flex", alignItems: "baseline", gap: 8, padding: "6px 0", borderBottom: "1px dashed #21332a", fontSize: 13 }
  }, React.createElement("span", {
    style: { fontSize: 9.5, letterSpacing: ".12em", color: "#93a89b", fontWeight: 800, flexShrink: 0, width: 118 }
  }, label.toUpperCase()), React.createElement("span", {
    style: { flex: 1, color: "#eaf2ec", minWidth: 0 }
  }, value), React.createElement("b", {
    style: { fontVariantNumeric: "tabular-nums", color: "#7fc46a", flexShrink: 0 }
  }, detail));
}
function CommunityTally({ sectors, rows, onCampClick }) {
  const agg = React.useMemo(() => A.computeAggregates(rows, sectors, Date.now()), [rows, sectors]);
  const sup = React.useMemo(() => A.superlatives(agg, sectors), [agg, sectors]);
  const wide = useMQ("(min-width: 760px)");
  const [sel, setSel] = React.useState(null);
  const pct = Math.round(agg.tallyPct * 100);
  const now = Date.now();
  const detail = (() => {
    if (!sel)
      return null;
    const sector = sectors.find((s) => s.id === sel.sector);
    let label, q, rate;
    if (sel.level < 3) {
      q = (sector.levels[sel.level] || [])[sel.qi];
      if (!q)
        return null;
      label = `${sector.name} · Level ${sel.level + 1}`;
      rate = agg.perQuestion[q.id]?.rate || 0;
      return { label, text: q.prompt || q.title, rate, n: agg.perQuestion[q.id]?.asked || 0 };
    }
    label = `${sector.name} · Level 4`;
    rate = agg.intensities ? agg.intensities[sector.id].levels[3][sel.qi] : 0;
    return { label, text: `Camps reaching advanced step ${sel.qi + 1}`, rate, n: agg.count };
  })();
  const [peek, setPeek] = React.useState(null);
  const [copied, setCopied] = React.useState(false);
  const copySummary = () => {
    const avg = agg.count ? (agg.totalYes / agg.count).toFixed(1) : "0";
    const text = [
      `Green Radius · Black Rock City ${new Date().getFullYear()}`,
      `${agg.count} ${agg.count === 1 ? "camp" : "camps"} · ${avg} avg score` + (agg.hasAnswers ? ` · ${pct}% achieved` : ""),
      "Top camps: " + agg.leaderboard.slice(0, 3).map((c, i) => `${i + 1}. ${c.campName} ${c.total}/60`).join(" · "),
      "https://greenradi.us/city/"
    ].join(`
`);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }, () => {});
  };
  const Hero = React.createElement("div", {
    style: {
      background: CITY_CARD_BG,
      borderRadius: 24,
      color: "#fff",
      padding: "14px 16px",
      boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
      position: "relative",
      overflow: "hidden",
      textAlign: "center"
    }
  }, React.createElement("div", {
    style: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)", pointerEvents: "none" }
  }), React.createElement("div", {
    style: { position: "relative" }
  }, React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.25em", fontWeight: 700, opacity: 0.6, marginBottom: 4 }
  }, "GREEN RADIUS · BLAST ", new Date().getFullYear()), React.createElement("div", {
    style: { fontSize: 22, fontWeight: 800, lineHeight: 1.12 }
  }, "Black Rock City"), React.createElement("div", {
    style: { margin: "4px 0 8px" }
  }, React.createElement("span", {
    style: { fontSize: 34, fontWeight: 900, color: "#7fc46a", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }
  }, agg.hasAnswers ? `${pct}%` : agg.totalYes), agg.hasAnswers && React.createElement("span", {
    style: { fontSize: 14, fontWeight: 700, opacity: 0.65 }
  }, " achieved")), React.createElement("div", {
    style: { display: "flex", justifyContent: "center" }
  }, React.createElement(RadialBadge, {
    sectors,
    fills: peek ? miniFills(sectors, peek) : {},
    size: wide ? 284 : 276,
    dark: true,
    intensities: peek ? null : agg.intensities,
    selected: sel,
    onSelectSegment: agg.hasAnswers ? (sector, level, qi) => setSel({ sector, level, qi }) : null
  })), React.createElement("div", {
    style: { display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontSize: 13, color: "#d8cbb6", marginTop: 6 }
  }, peek ? React.createElement("span", null, "Previewing ", React.createElement("b", {
    style: { color: "#fff" }
  }, peek.campName), " · ", peek.total, "/60") : React.createElement("span", null, React.createElement("b", {
    style: { color: "#fff" }
  }, agg.totalYes), " of ", agg.totalPossible, " green choices"), React.createElement("button", {
    type: "button",
    onClick: copySummary,
    title: "Copy a short text summary for sharing",
    style: {
      background: "rgba(255,255,255,0.08)",
      color: "#d8e9dd",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: 99,
      padding: "2px 9px",
      fontSize: 11,
      cursor: "pointer",
      flexShrink: 0
    }
  }, copied ? "Copied ✓" : "⧉ Copy")), agg.legacyCount > 0 && React.createElement("div", {
    style: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }
  }, agg.legacyCount, " older ", agg.legacyCount === 1 ? "response" : "responses", " on the old 0 to 4 scale excluded from the tally."), !agg.hasAnswers && React.createElement("div", {
    style: { fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 4 }
  }, "Per-question detail appears once granular capture is live."), detail && React.createElement("div", {
    "data-segment-detail": true,
    style: {
      background: "rgba(0,0,0,0.28)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderLeft: "3px solid #7fc46a",
      borderRadius: 10,
      padding: "9px 11px",
      margin: "10px auto 0",
      maxWidth: 320,
      textAlign: "left"
    }
  }, React.createElement("div", {
    style: { fontSize: 10, letterSpacing: ".1em", color: "#7fc46a", fontWeight: 800 }
  }, detail.label.toUpperCase()), React.createElement("div", {
    style: {
      fontSize: 12.5,
      lineHeight: 1.35,
      margin: "2px 0 4px",
      height: "5.4em",
      display: "-webkit-box",
      WebkitLineClamp: 4,
      WebkitBoxOrient: "vertical",
      overflow: "hidden"
    }
  }, detail.text), React.createElement("div", {
    style: { color: "rgba(255,255,255,0.65)", fontSize: 12 }
  }, React.createElement("b", {
    style: { color: "#fff", fontSize: 15 }
  }, Math.round(detail.rate * 100), "%"), " of ", detail.n, " camps"))));
  const Pulse = React.createElement("div", {
    "data-pulse": true,
    style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: wide ? 0 : 12 }
  }, React.createElement(StatTile, {
    value: agg.count,
    label: "Total camps"
  }), React.createElement(StatTile, {
    value: `+${agg.momentum.thisWeek}`,
    label: "this week"
  }), React.createElement(StatTile, {
    value: agg.count ? (agg.totalYes / agg.count).toFixed(1) : 0,
    label: "Avg score"
  }));
  const Superlatives = sup.strongest || sup.hardest || sup.easiest || sup.topL4 || sup.topL3 ? React.createElement("div", {
    "data-superlatives": true,
    style: { ...panelStyle, marginTop: 12 }
  }, React.createElement(SecHead, {
    style: { marginTop: 0 }
  }, "Superlatives"), sup.strongest && React.createElement(Superlative, {
    label: "Strongest sector",
    value: sup.strongest.name,
    detail: `${sup.strongest.avg.toFixed(1)}/10 avg`
  }), sup.weakest && React.createElement(Superlative, {
    label: "Weakest sector",
    value: sup.weakest.name,
    detail: `${sup.weakest.avg.toFixed(1)}/10 avg`
  }), sup.hardest && React.createElement(Superlative, {
    label: "Hardest question",
    value: `${sup.hardest.title} (${sup.hardest.sector})`,
    detail: `${Math.round(sup.hardest.rate * 100)}% of ${sup.hardest.asked}`
  }), sup.easiest && React.createElement(Superlative, {
    label: "Easiest question",
    value: `${sup.easiest.title} (${sup.easiest.sector})`,
    detail: `${Math.round(sup.easiest.rate * 100)}% of ${sup.easiest.asked}`
  }), sup.topL4 && React.createElement(Superlative, {
    label: "Top level 4",
    value: `${sup.topL4.title} (${sup.topL4.sector})`,
    detail: `${sup.topL4.yes} ${sup.topL4.yes === 1 ? "camp" : "camps"}`
  }), sup.topL3 && React.createElement(Superlative, {
    label: "Top level 3",
    value: `${sup.topL3.title} (${sup.topL3.sector})`,
    detail: `${sup.topL3.yes} ${sup.topL3.yes === 1 ? "camp" : "camps"}`
  })) : null;
  const Leaderboard = React.createElement("div", {
    "data-leaderboard": true,
    style: { ...panelStyle, marginTop: 12 }
  }, React.createElement(SecHead, {
    style: { marginTop: 0 }
  }, "Top Camps"), agg.leaderboard.map((c, i) => React.createElement("div", {
    key: i,
    "data-rank": i + 1,
    role: "button",
    tabIndex: 0,
    title: "Hover previews on the radius; click opens the Camps tab",
    onClick: () => onCampClick && onCampClick(c.campName),
    onKeyDown: (e) => {
      if (e.key === "Enter" && onCampClick)
        onCampClick(c.campName);
    },
    onMouseEnter: () => setPeek(c),
    onMouseLeave: () => setPeek(null),
    style: { ...rowStyle, gap: 10, cursor: "pointer" }
  }, React.createElement("span", {
    style: { width: 18, color: "#93a89b", fontVariantNumeric: "tabular-nums" }
  }, i + 1), React.createElement("span", {
    "aria-hidden": "true",
    title: "Camp's green radius shape",
    style: { flexShrink: 0, display: "inline-flex" }
  }, React.createElement(RadialBadge, {
    sectors,
    fills: miniFills(sectors, c),
    size: 30,
    dark: true,
    showLabels: false,
    showCenter: false
  })), React.createElement("span", {
    style: { flex: 1, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
  }, c.campName, " ", i === 0 && React.createElement("span", {
    title: "Highest score right now",
    style: { color: "#e8c15a" }
  }, "★"), c.timestamp && now - c.timestamp <= 7 * 86400000 ? React.createElement("span", {
    title: "New this week",
    style: { color: "#7fc46a", marginLeft: 4 }
  }, "●") : null), React.createElement("b", {
    style: { fontVariantNumeric: "tabular-nums" }
  }, c.total, "/60"))));
  const WEEKS = 10, WEEK_MS = 7 * 86400000;
  const weekCounts = React.useMemo(() => {
    const counts = new Array(WEEKS).fill(0);
    A.dedupeRows(rows).forEach((r) => {
      if (typeof r.timestamp !== "number" || !r.timestamp)
        return;
      const idx = Math.floor((now - r.timestamp) / WEEK_MS);
      if (idx >= 0 && idx < WEEKS)
        counts[WEEKS - 1 - idx]++;
    });
    return counts;
  }, [rows, now]);
  const weekMax = Math.max(1, ...weekCounts);
  const Momentum = React.createElement("div", {
    "data-momentum": true,
    style: { ...panelStyle, marginTop: 12 }
  }, React.createElement(SecHead, {
    style: { marginTop: 0 }
  }, "Momentum"), React.createElement("svg", {
    width: "100%",
    height: "40",
    viewBox: "0 0 100 30",
    preserveAspectRatio: "none",
    role: "img",
    "aria-label": "New camps per week, last 10 weeks"
  }, weekCounts.map((n, i) => {
    const h = n ? Math.max(2, n / weekMax * 26) : 1;
    return React.createElement("rect", {
      key: i,
      x: i * 10 + 1.5,
      y: 28 - h,
      width: 7,
      height: h,
      rx: 1,
      fill: i === WEEKS - 1 ? "#45c483" : n ? "#2f7a41" : "#26382e"
    }, React.createElement("title", null, `${n} ${n === 1 ? "camp" : "camps"}, ${i === WEEKS - 1 ? "this week" : `${WEEKS - 1 - i} ${WEEKS - 1 - i === 1 ? "week" : "weeks"} ago`}`));
  })), React.createElement("div", {
    style: { fontSize: 11, color: "#93a89b", marginTop: 4 }
  }, "New camps per week, last 10 weeks"));
  const Standings = React.createElement("div", {
    style: { ...panelStyle, marginTop: 12 }
  }, React.createElement(SecHead, {
    style: { marginTop: 0 }
  }, "Sector Averages"), React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: wide ? "1fr 1fr" : "1fr", gap: "0 18px" }
  }, agg.sectorStandings.map((s) => React.createElement("div", {
    key: s.id,
    style: rowStyle
  }, React.createElement("span", {
    title: s.name,
    style: { display: "inline-flex" }
  }, React.createElement(SectorIcon, {
    kind: (sectors.find((x) => x.id === s.id) || {}).icon,
    size: 13,
    color: "#7f988a"
  })), React.createElement("span", {
    style: { flex: 1, color: "#cdebd8" }
  }, s.name), React.createElement("b", {
    style: { fontVariantNumeric: "tabular-nums" }
  }, s.avg.toFixed(1))))));
  const LeftCol = React.createElement("div", null, Hero, Standings);
  const RightCol = React.createElement("div", null, Pulse, Momentum, Leaderboard, Superlatives);
  return wide ? React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: "minmax(280px, 320px) 1fr", gap: 20, paddingTop: 16, alignItems: "start" }
  }, LeftCol, RightCol) : React.createElement("div", {
    style: { paddingTop: 12 }
  }, LeftCol, RightCol);
}
const SecHead = ({ children, style }) => React.createElement("div", {
  style: { fontSize: 14, letterSpacing: ".16em", color: "#93a89b", fontWeight: 800, margin: "16px 0 6px", ...style }
}, String(children).toUpperCase());
const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "1px dashed #21332a", fontSize: 13 };
function fmtWhen(ts) {
  if (!ts)
    return "date unknown";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
function rowHasAnswers(camp) {
  return !!camp.answers && Object.keys(camp.answers).some((k) => camp.answers[k] === "yes" || camp.answers[k] === "no");
}
function campL4(sectors, camp) {
  if (!rowHasAnswers(camp))
    return [];
  return sectors.map((s) => {
    const campTopic = (s.tier4Topics || []).find((t) => /-camp$/.test(t.id));
    const noteVal = campTopic ? camp.answers[campTopic.id + "-note"] : "";
    const note = (typeof noteVal === "string" ? noteVal.trim() : "").replace(/^'(?=[=+\-@\t\r])/, "");
    const picks = (s.tier4Topics || []).filter((t) => camp.answers[t.id] === "yes" && !(note && t === campTopic)).map((t) => t.title);
    return { id: s.id, name: s.name, picks, note, noteYes: !!note && camp.answers[campTopic.id] === "yes" };
  }).filter((x) => x.picks.length || x.note);
}
function SectorDigits({ sector, fill, answers, hasAnswers, legacy }) {
  const counts = fill.levels.map((lvl) => lvl.filter(Boolean).length);
  const titleFor = (li) => {
    if (!hasAnswers && !legacy)
      return "approximate (no per-question data)";
    if (legacy)
      return `Level ${li + 1} ${counts[li] ? "lit" : "unlit"} (old 0-4 scale)`;
    if (li < 3)
      return (sector.levels[li] || []).map((q) => `${answers[q.id] === "yes" ? "✓" : "✕"} ${q.prompt || q.title || q.id}`).join(`
`);
    const lines = (sector.tier4Topics || []).filter((t) => answers[t.id] === "yes" || answers[t.id] === "no").map((t) => `${answers[t.id] === "yes" ? "✓" : "✕"} ${t.title}`);
    return lines.join(`
`) || "no advanced picks";
  };
  return React.createElement("div", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 1,
      fontVariantNumeric: "tabular-nums",
      opacity: hasAnswers || legacy ? 1 : 0.45,
      cursor: "default"
    }
  }, [0, 1, 2, 3].map((li) => React.createElement(React.Fragment, {
    key: li
  }, li > 0 && React.createElement("span", {
    style: { color: "#2a3d31" }
  }, "·"), React.createElement("span", {
    title: titleFor(li),
    style: { color: counts[li] ? LEVEL_COLORS[li] : "#2a3d31" }
  }, counts[li]))));
}
function CampRow({ sectors, camp, wide }) {
  const hasAnswers = rowHasAnswers(camp);
  const hidden = !!camp.hidden;
  const legacy = A.isLegacy(camp);
  const fills = hasAnswers ? fillsFromAnswers(sectors, camp.answers) : legacy ? legacyFills(sectors, camp.greens) : approxFills(sectors, camp.greens);
  const denom = legacy ? 4 : 10;
  const l4 = campL4(sectors, camp);
  const badge = (text, title) => React.createElement("span", {
    title,
    style: {
      fontSize: 9,
      color: "#93a89b",
      border: "1px solid #26382e",
      borderRadius: 99,
      padding: "1px 6px",
      whiteSpace: "nowrap",
      verticalAlign: "middle"
    }
  }, text);
  const Identity = React.createElement("div", {
    style: { display: "flex", gap: 10, alignItems: "center", minWidth: 0 }
  }, React.createElement("div", {
    "data-mini-badge": true,
    "aria-hidden": "true",
    title: "Camp's green radius shape",
    style: { flexShrink: 0 }
  }, React.createElement(RadialBadge, {
    sectors,
    fills,
    size: 44,
    dark: true,
    showLabels: false,
    showCenter: false
  })), React.createElement("div", {
    style: { minWidth: 0 }
  }, React.createElement("div", {
    style: { fontSize: 14.5, fontWeight: 800, lineHeight: 1.25, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }
  }, React.createElement("span", null, camp.campName), badge(camp.source, camp.source === "board" ? "Answered on the in-person board kiosk" : "Answered via the public web form"), legacy && badge("old scale", "Submitted on the legacy 0-4 scale, shown here as an approximation"), hidden && badge("hidden", "Owner-flagged as junk or test data; excluded from every aggregate")), React.createElement("div", {
    style: { fontSize: 11.5, color: "#93a89b", marginTop: 2, overflowWrap: "anywhere" }
  }, camp.leadName, " · ", React.createElement("a", {
    "data-email": true,
    href: `mailto:${camp.email}`,
    style: { color: "#8fd4ae", textDecoration: "none" }
  }, camp.email)), React.createElement("div", {
    "data-submitted": true,
    style: { fontSize: 11, color: "#7f988a", marginTop: 2, fontVariantNumeric: "tabular-nums" }
  }, fmtWhen(camp.timestamp))));
  const SectorCells = sectors.map((s) => {
    const n = camp.greens && camp.greens[s.id] || 0;
    return React.createElement("div", {
      key: s.id,
      "data-sector-cell": true,
      title: s.name,
      style: { textAlign: "center", alignSelf: "center" }
    }, React.createElement("div", {
      "aria-hidden": "true",
      style: { display: "flex", justifyContent: "center", marginBottom: 2 }
    }, React.createElement(SectorIcon, {
      kind: s.icon,
      size: 13,
      color: "#7f988a"
    })), React.createElement("div", {
      style: {
        fontSize: 12.5,
        fontWeight: 700,
        fontVariantNumeric: "tabular-nums",
        color: n === denom ? "#e8c15a" : "#eaf2ec",
        marginBottom: 2
      }
    }, n, React.createElement("span", {
      style: { color: "#5d7367", fontWeight: 600 }
    }, "/", denom)), React.createElement(SectorDigits, {
      sector: s,
      fill: fills[s.id],
      answers: camp.answers || {},
      hasAnswers,
      legacy
    }));
  });
  const Total = React.createElement("div", {
    style: { textAlign: "right", alignSelf: "center" }
  }, React.createElement("div", {
    style: { fontVariantNumeric: "tabular-nums" }
  }, React.createElement("b", {
    style: { fontSize: 19, color: "#fff" }
  }, camp.total), React.createElement("span", {
    style: { color: "#5d7367", fontSize: 12 }
  }, "/", legacy ? 24 : 60)), camp.resultUrl && React.createElement("a", {
    "data-result": true,
    href: camp.resultUrl,
    target: "_blank",
    rel: "noreferrer",
    title: "Open this camp's shareable result page",
    style: { fontSize: 11, color: "#8fd4ae", textDecoration: "none" }
  }, "result ↗"));
  const ideas = l4.filter((x) => x.note);
  const IdeasLine = ideas.length > 0 && React.createElement("div", {
    style: {
      gridColumn: "1 / -1",
      display: "flex",
      flexWrap: "wrap",
      gap: 5,
      alignItems: "center",
      borderTop: "1px dashed #1d2c24",
      paddingTop: 5,
      marginTop: 2
    }
  }, React.createElement("span", {
    style: { color: "#45c483", fontWeight: 800, fontSize: 9.5, letterSpacing: ".12em" }
  }, "IDEAS"), ideas.map((x) => React.createElement("span", {
    key: x.id,
    "data-camp-note": true,
    style: {
      fontSize: 10.5,
      padding: "2px 8px",
      borderRadius: 6,
      fontStyle: "italic",
      border: "1px solid " + (x.noteYes ? "#2e5b43" : "#26382e"),
      background: x.noteYes ? "#15291e" : "transparent",
      color: x.noteYes ? "#8fd4ae" : "#93a89b"
    }
  }, x.noteYes ? "✓" : "✕", " ", x.name, " · “", x.note, "”")));
  const rowBase = {
    borderBottom: "1px solid #1a281f",
    padding: "8px 12px",
    contentVisibility: "auto",
    containIntrinsicSize: "auto 84px",
    opacity: hidden ? 0.5 : 1
  };
  return wide ? React.createElement("div", {
    "data-camp-row": true,
    style: {
      ...rowBase,
      display: "grid",
      alignItems: "center",
      columnGap: 10,
      gridTemplateColumns: "minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px"
    }
  }, Identity, SectorCells, Total, IdeasLine) : React.createElement("div", {
    "data-camp-row": true,
    style: rowBase
  }, React.createElement("div", {
    style: { display: "flex", gap: 10, alignItems: "flex-start" }
  }, React.createElement("div", {
    style: { flex: 1, minWidth: 0 }
  }, Identity), Total), React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "7px 6px", marginTop: 6 }
  }, SectorCells), IdeasLine && React.createElement("div", {
    style: { display: "grid" }
  }, IdeasLine));
}
function csvEscape(v) {
  let s = String(v == null ? "" : v);
  if (/^[=+\-@\t\r]/.test(s))
    s = "'" + s;
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(list, sectors) {
  const head = [
    "Submitted",
    "Camp",
    "Lead",
    "Email",
    "Source",
    "Year",
    "Scale",
    ...sectors.map((s) => s.name),
    "Total",
    "Level 4",
    "Result URL",
    "Schema"
  ];
  const lines = [head].concat(list.map((r) => {
    const legacy = A.isLegacy(r);
    const l4 = campL4(sectors, r).map((x) => `${x.name}: ${x.picks.concat(x.note ? [`"${x.note}" (${x.noteYes ? "yes" : "no"})`] : []).join("; ")}`).join(" | ");
    return [
      r.timestamp ? new Date(r.timestamp).toISOString() : "",
      r.campName,
      r.leadName,
      r.email,
      r.source,
      r.year,
      legacy ? "0-4 (old)" : "0-10",
      ...sectors.map((s) => r.greens && r.greens[s.id] || 0),
      r.total,
      l4,
      r.resultUrl,
      r.schemaVersion
    ];
  })).map((row) => row.map(csvEscape).join(",")).join(`\r
`);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + lines], { type: "text/csv" }));
  a.download = "green-radius-camps.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function CampsView({ sectors, rows, highlight, onClearHighlight }) {
  const wide = useMQ("(min-width: 900px)");
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState("date");
  const hlRef = React.useRef(null);
  React.useEffect(() => {
    if (highlight && hlRef.current)
      hlRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlight]);
  const searchRef = React.useRef(null);
  React.useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA");
      if (e.key === "/" && !typing) {
        e.preventDefault();
        if (searchRef.current)
          searchRef.current.focus();
      }
      if (e.key === "Escape") {
        setQ("");
        if (typing && t.blur)
          t.blur();
        if (onClearHighlight)
          onClearHighlight();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClearHighlight]);
  const list = React.useMemo(() => {
    const ql = q.trim().toLowerCase();
    let xs = rows.filter((r) => {
      if (!ql)
        return true;
      const notes = Object.keys(r.answers || {}).filter((k) => k.endsWith("-note")).map((k) => r.answers[k]).join(" ");
      return (r.campName + " " + r.leadName + " " + r.email + " " + notes).toLowerCase().includes(ql);
    });
    const bySector = sectors.some((s) => s.id === sort);
    xs = xs.slice().sort(sort === "name" ? (a, b) => a.campName.localeCompare(b.campName) : sort === "score" ? (a, b) => b.total - a.total || a.campName.localeCompare(b.campName) : bySector ? (a, b) => (b.greens && b.greens[sort] || 0) - (a.greens && a.greens[sort] || 0) || b.total - a.total : (a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return xs;
  }, [rows, q, sort, sectors]);
  const headBtn = (id, label, align) => React.createElement("button", {
    key: id,
    type: "button",
    onClick: () => setSort(id),
    title: `Sort by ${label}`,
    style: {
      background: "none",
      border: "none",
      cursor: "pointer",
      font: "inherit",
      padding: "2px 0",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: ".1em",
      textAlign: align || "center",
      color: sort === id ? "#45c483" : "#93a89b"
    }
  }, label.toUpperCase(), sort === id ? " ▾" : "");
  return React.createElement("div", null, React.createElement("div", {
    style: { display: "flex", gap: 6, padding: "10px 0", alignItems: "center" }
  }, React.createElement("span", {
    style: { color: "#93a89b", fontSize: 11 }
  }, list.length, " of ", rows.length, " camps"), React.createElement("button", {
    "data-export": true,
    type: "button",
    onClick: () => exportCsv(list, sectors),
    title: "Download all filtered camps as a CSV file",
    style: { ...selStyle, cursor: "pointer" }
  }, "⬇ CSV"), React.createElement("button", {
    "data-email": true,
    type: "button",
    title: "Open an email draft BCC'd to every filtered camp lead",
    onClick: () => {
      const emails = Array.from(new Set(list.map((r) => r.email).filter(Boolean)));
      if (emails.length)
        window.location.href = "mailto:?bcc=" + encodeURIComponent(emails.join(","));
    },
    style: { ...selStyle, cursor: "pointer" }
  }, "✉ Email"), React.createElement("div", {
    style: { flex: 1 }
  }), React.createElement("input", {
    "data-search": true,
    ref: searchRef,
    value: q,
    onChange: (e) => setQ(e.target.value),
    placeholder: "Search camps, emails, ideas…",
    title: "Press / to search",
    style: { flex: 1, maxWidth: 340, ...selStyle, borderRadius: 7 }
  }), React.createElement("select", {
    value: sort,
    onChange: (e) => setSort(e.target.value),
    title: "Sort camps by",
    style: selStyle
  }, React.createElement("option", {
    value: "date"
  }, "Newest"), React.createElement("option", {
    value: "score"
  }, "Score"), React.createElement("option", {
    value: "name"
  }, "Name"), sectors.map((s) => React.createElement("option", {
    key: s.id,
    value: s.id
  }, s.name)))), wide && React.createElement("div", {
    style: {
      display: "grid",
      columnGap: 10,
      padding: "4px 12px",
      position: "sticky",
      top: 0,
      background: "#0e1712f2",
      backdropFilter: "blur(2px)",
      zIndex: 1,
      borderBottom: "1px solid #26382e",
      gridTemplateColumns: "minmax(230px, 1.4fr) repeat(6, minmax(72px, 1fr)) 88px"
    }
  }, headBtn("name", "Camp", "left"), sectors.map((s) => headBtn(s.id, s.name)), headBtn("score", "Total", "right")), list.map((r) => {
    const hl = highlight && r.campName === highlight;
    return React.createElement("div", {
      key: `${r.campName}|${r.timestamp}`,
      ref: hl ? hlRef : null,
      onClick: hl ? onClearHighlight : undefined,
      title: hl ? "Click to dismiss the highlight" : undefined,
      style: hl ? { outline: "2px solid #45c483", outlineOffset: 2, borderRadius: 12 } : undefined
    }, React.createElement(CampRow, {
      sectors,
      camp: r,
      wide
    }));
  }));
}
function legacyFills(sectors, greens) {
  const out = {};
  sectors.forEach((s) => {
    const count = Math.max(0, Math.min(4, (greens && greens[s.id]) | 0));
    const sizes = [1, 2, 3, 4];
    const levels = sizes.map((n, li) => Array.from({ length: n }, () => li < count));
    out[s.id] = { levels, totalYes: sizes.reduce((t, n, li) => t + (li < count ? n : 0), 0), played: count > 0 };
  });
  return out;
}
function approxFills(sectors, greens) {
  const out = {};
  sectors.forEach((s) => {
    let n = greens && greens[s.id] || 0;
    const levels = [0, 1, 2].map((li) => (s.levels[li] || []).map(() => {
      const on = n > 0;
      if (on)
        n--;
      return on;
    }));
    levels[3] = [0, 1, 2, 3].map(() => {
      const on = n > 0;
      if (on)
        n--;
      return on;
    });
    out[s.id] = { levels, totalYes: greens && greens[s.id] || 0, played: (greens && greens[s.id] || 0) > 0 };
  });
  return out;
}
