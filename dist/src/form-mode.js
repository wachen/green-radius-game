// @generated from src/form-mode.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
function LinearForm({ sectors, answers, setAnswer, notes, setNote, onSubmit, onBack, onClear, palette }) {
  const [page, setPage] = useState(0);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const lastPage = sectors.length - 1;
  const sector = sectors[page];
  const isAns = (id) => answers[id] === "yes" || answers[id] === "no";
  const requiredAnswered = (s) => s.levels.slice(0, 3).every((lvl) => lvl.every((qq) => isAns(qq.id))) && campIdeaIds(s).every((id) => !(notes && notes[id] || "").trim() || isAns(id));
  const incompleteSectors = sectors.filter((s) => !requiredAnswered(s));
  const allComplete = incompleteSectors.length === 0;
  const firstIncompleteIndex = sectors.findIndex((s) => !requiredAnswered(s));
  function handleSubmit() {
    const sectorCursor = {};
    const sectorClosed = {};
    sectors.forEach((s) => {
      sectorCursor[s.id] = 4;
      sectorClosed[s.id] = true;
    });
    onSubmit({ sectorCursor, sectorClosed });
  }
  const totalAnswered = Object.values(answers).filter((a) => a === "yes" || a === "no").length;
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
    } catch {}
  }, [page]);
  const navPill = (enabled) => ({
    flex: 1,
    padding: "14px 0",
    borderRadius: 12,
    border: "none",
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    minHeight: 52,
    cursor: enabled ? "pointer" : "default",
    background: enabled ? palette.text + "11" : palette.text + "08",
    color: enabled ? palette.text : palette.text + "40",
    "--grg-sh": palette.text + "22"
  });
  return React.createElement("div", {
    style: { padding: "18px 24px 28px", maxWidth: 480, margin: "0 auto" }
  }, React.createElement("div", {
    style: { marginBottom: 14 }
  }, React.createElement("button", {
    onClick: onBack,
    "aria-label": "Back to your camp details",
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
  }, "← Back")), React.createElement("div", {
    role: "group",
    "aria-label": `Progress: sector ${page + 1} of ${sectors.length}, ${sector.name}`,
    style: { marginBottom: 18 }
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 4,
      maxWidth: 320,
      margin: "0 auto"
    }
  }, sectors.map((s, i) => {
    const complete = requiredAnswered(s);
    const current = i === page;
    const iconColor = complete || current ? palette.accent : palette.text + "40";
    return React.createElement("div", {
      key: s.id,
      "aria-hidden": "true",
      style: {
        width: 40,
        height: 40,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: current ? palette.accent + "22" : "transparent",
        border: `1.5px solid ${current ? palette.accent : "transparent"}`,
        opacity: complete || current ? 1 : 0.55,
        transition: "background .2s ease, border-color .2s ease, opacity .2s ease"
      }
    }, React.createElement(SectorIcon, {
      kind: s.icon,
      size: 20,
      color: iconColor
    }));
  })), React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 8,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.18em",
      color: palette.text + "99"
    }
  }, sector.name.toUpperCase(), " · ", page + 1, " OF ", sectors.length)), page === 0 && React.createElement("div", {
    style: {
      textAlign: "center",
      fontSize: 13,
      lineHeight: 1.5,
      color: palette.text + "cc",
      marginBottom: 4,
      textWrap: "pretty"
    }
  }, "Answer yes/no for your camp. Progress autosaves."), React.createElement("div", {
    key: page,
    style: { animation: "qm-up .25s ease both" }
  }, React.createElement(FormSectorBlock, {
    sector,
    answers,
    setAnswer,
    palette,
    notes,
    setNote,
    highlightMissing
  })), React.createElement("div", {
    style: { display: "flex", gap: 10, marginTop: 8 }
  }, React.createElement("button", {
    onClick: () => setPage((p) => Math.max(0, p - 1)),
    disabled: page === 0,
    "aria-label": "Previous sector",
    className: page !== 0 ? "grg-press-sm" : undefined,
    style: navPill(page !== 0)
  }, "← Previous"), page < lastPage ? React.createElement("button", {
    onClick: () => setPage((p) => Math.min(lastPage, p + 1)),
    "aria-label": "Next sector",
    className: "grg-press-sm",
    style: navPill(true)
  }, "Next →") : React.createElement("button", {
    onClick: handleSubmit,
    disabled: !allComplete,
    "aria-label": "Submit form answers",
    className: allComplete ? "grg-press-sm" : undefined,
    style: {
      flex: 1,
      padding: "14px 0",
      borderRadius: 12,
      border: "none",
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      minHeight: 52,
      cursor: !allComplete ? "default" : "pointer",
      background: !allComplete ? palette.text + "33" : palette.accentDark,
      color: "#fff",
      "--grg-sh": palette.accentDeep
    }
  }, "Submit →")), page === lastPage && !allComplete && React.createElement("div", {
    style: { textAlign: "center", marginTop: 12 }
  }, React.createElement("div", {
    style: { fontSize: 12, color: palette.text + "99", marginBottom: 6, textWrap: "pretty" }
  }, incompleteSectors.length, " ", incompleteSectors.length === 1 ? "sector" : "sectors", " still need required answers."), React.createElement("button", {
    type: "button",
    onClick: () => {
      setHighlightMissing(true);
      setPage(firstIncompleteIndex);
    },
    style: {
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: palette.accentDark,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: "6px 10px",
      minHeight: 44,
      fontFamily: "inherit"
    }
  }, "Go to ", sectors[firstIncompleteIndex].name, " →")), React.createElement("div", {
    style: { textAlign: "center" }
  }, React.createElement("button", {
    type: "button",
    "aria-label": "Clear all form answers",
    onClick: () => {
      if (totalAnswered === 0)
        return;
      if (!confirm("Clear all answers?"))
        return;
      onClear();
    },
    disabled: totalAnswered === 0,
    style: {
      background: "transparent",
      border: "none",
      cursor: totalAnswered === 0 ? "default" : "pointer",
      color: palette.text + (totalAnswered === 0 ? "33" : "66"),
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      padding: "14px 12px",
      minHeight: 44,
      fontFamily: "inherit"
    }
  }, "Clear Form ✕")), page === lastPage && React.createElement("a", {
    href: COMMUNITY_LINK_URL,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      fontSize: 11,
      letterSpacing: "0.3em",
      fontWeight: 700,
      color: palette.accentDark,
      marginTop: 20,
      lineHeight: 1.5,
      textDecoration: "none",
      display: "block",
      textAlign: "center"
    }
  }, "CREATED BY THE", React.createElement("br", null), "GREEN THEME CAMP COMMUNITY"));
}
function CampIdeasBlock({ sector, answers, setAnswer, notes, setNote, palette, highlightMissing }) {
  const ids = campIdeaIds(sector);
  const hasData = (id) => !!(notes && notes[id] || "").trim() || answers[id] === "yes" || answers[id] === "no";
  const [shown, setShown] = useState(() => Math.min(4, Math.max(1, ids.filter(hasData).length)));
  if (!ids.length)
    return null;
  const visible = ids.slice(0, shown);
  return React.createElement("div", {
    style: { marginTop: 14 }
  }, React.createElement("div", {
    style: { fontSize: 13, fontWeight: 700, color: palette.text, marginBottom: 2 }
  }, "Our Camp's Ideas"), React.createElement("div", {
    style: { fontSize: 11, lineHeight: 1.4, color: palette.text + "88", marginBottom: 6 }
  }, "List up to four of your own ", sector.name.toLowerCase(), " ideas and whether your camp pulled each one off. Every yes is a Level 4 point."), visible.map((id, i) => {
    const answered = answers[id] === "yes" || answers[id] === "no";
    const missing = highlightMissing && !!(notes && notes[id] || "").trim() && !answered;
    return React.createElement("div", {
      key: id,
      style: {
        padding: "10px 0",
        borderTop: `1px solid ${palette.text}${i === 0 ? "11" : "0d"}`,
        borderLeft: `3px solid ${missing ? "#C9821E" : "transparent"}`,
        paddingLeft: missing ? 10 : 0,
        transition: "border-color .2s ease, padding-left .2s ease"
      }
    }, React.createElement("input", {
      value: notes && notes[id] || "",
      onChange: (e) => setNote && setNote(id, e.target.value),
      maxLength: NOTE_MAX_LEN,
      placeholder: i === 0 ? "What did your camp try?" : `Another idea (${i + 1} of 4)`,
      "aria-label": `Describe your camp's own ${sector.name.toLowerCase()} idea, number ${i + 1}`,
      style: {
        width: "100%",
        padding: "10px 12px",
        borderRadius: 8,
        border: `1.5px solid ${palette.text}22`,
        background: "#fff",
        color: palette.text,
        fontSize: 16,
        fontFamily: "inherit",
        marginBottom: 8
      }
    }), React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }
    }, React.createElement("span", {
      style: { fontSize: 11, color: palette.text + "99" }
    }, "Did your camp pull it off?", missing && React.createElement("span", {
      style: { color: "#C9821E", fontWeight: 700, marginLeft: 6 }
    }, "Needs an answer")), React.createElement("div", {
      style: { marginLeft: "auto" }
    }, React.createElement(YesNoButtons, {
      qid: id,
      answer: answers[id],
      setAnswer,
      palette
    }))));
  }), shown < 4 && React.createElement("button", {
    type: "button",
    onClick: () => setShown((n) => Math.min(4, n + 1)),
    style: {
      marginTop: 10,
      background: "transparent",
      cursor: "pointer",
      border: `1.5px dashed ${palette.text}33`,
      borderRadius: 8,
      color: palette.accentDark,
      fontWeight: 700,
      fontSize: 12,
      letterSpacing: "0.04em",
      padding: "9px 12px",
      fontFamily: "inherit",
      width: "100%"
    }
  }, "+ Add another idea"));
}
function FormSectorBlock({ sector, answers, setAnswer, notes, setNote, palette, highlightMissing }) {
  const fixedQs = [].concat(...sector.levels.slice(0, 3));
  const t4 = sector.tier4Topics || [];
  const isAnswered = (id) => answers[id] === "yes" || answers[id] === "no";
  return React.createElement("section", {
    style: {
      margin: "20px 0",
      padding: "18px 16px",
      background: palette.card,
      borderRadius: 16,
      textAlign: "left"
    }
  }, React.createElement("div", {
    style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }
  }, React.createElement(SectorIcon, {
    kind: sector.icon,
    size: 28,
    color: palette.accent
  }), React.createElement("h2", {
    style: { fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: "-0.01em", color: palette.heading }
  }, sector.name)), React.createElement("div", {
    style: {
      fontSize: 11,
      lineHeight: 1.4,
      color: palette.text + "99",
      marginBottom: 14
    }
  }, sector.bigGoal), React.createElement("div", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: palette.text + "88",
      marginBottom: 2
    }
  }, "Required"), fixedQs.map((q) => React.createElement(YesNoRow, {
    key: q.id,
    qid: q.id,
    text: q.prompt,
    answer: answers[q.id],
    setAnswer,
    palette,
    missing: highlightMissing && !isAnswered(q.id)
  })), t4.length > 0 && React.createElement(React.Fragment, null, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
      marginBottom: 4
    }
  }, React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: palette.accentDark,
      background: palette.accent + "22",
      borderRadius: 999,
      padding: "2px 8px"
    }
  }, "Optional"), React.createElement("span", {
    style: {
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: palette.text + "88"
    }
  }, "Level 4 · every yes counts, max 4")), t4.filter((t) => !isCampTopic(t)).map((t) => React.createElement(YesNoRow, {
    key: t.id,
    qid: t.id,
    text: t.title,
    subtext: t.description,
    answer: answers[t.id],
    setAnswer,
    palette
  })), React.createElement(CampIdeasBlock, {
    sector,
    answers,
    setAnswer,
    notes,
    setNote,
    palette,
    highlightMissing
  })));
}
function YesNoButtons({ qid, answer, setAnswer, palette }) {
  const btnBase = {
    border: "none",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    padding: "8px 14px",
    borderRadius: 8,
    fontFamily: "inherit",
    minWidth: 56,
    minHeight: 44
  };
  const bounce = (e, yes) => {
    const el = e.currentTarget;
    el.style.animation = "none";
    el.offsetWidth;
    el.style.animation = (yes ? "grg-spring" : "grg-spring-soft") + " 0.42s cubic-bezier(.34,1.56,.64,1)";
  };
  return React.createElement("div", {
    style: { display: "flex", gap: 8 }
  }, React.createElement("button", {
    onClick: (e) => {
      bounce(e, true);
      setAnswer(qid, "yes");
    },
    "aria-pressed": answer === "yes",
    style: {
      ...btnBase,
      background: answer === "yes" ? palette.accentDark : palette.text + "11",
      color: answer === "yes" ? "#fff" : palette.text,
      boxShadow: answer === "yes" ? `0 3px 0 ${palette.accentDeep}` : "none"
    }
  }, "Yes"), React.createElement("button", {
    onClick: (e) => {
      bounce(e, false);
      setAnswer(qid, "no");
    },
    "aria-pressed": answer === "no",
    style: {
      ...btnBase,
      background: answer === "no" ? palette.text : palette.text + "11",
      color: answer === "no" ? "#fff" : palette.text
    }
  }, "No"));
}
function YesNoRow({ qid, text, subtext, answer, setAnswer, palette, missing }) {
  return React.createElement("div", {
    style: {
      padding: "12px 0",
      borderTop: `1px solid ${palette.text}11`,
      borderLeft: `3px solid ${missing ? "#C9821E" : "transparent"}`,
      paddingLeft: missing ? 10 : 0,
      transition: "border-color .2s ease, padding-left .2s ease"
    }
  }, React.createElement("div", {
    style: { fontSize: 13, lineHeight: 1.4, color: palette.text, marginBottom: subtext ? 4 : 8 }
  }, text, missing && React.createElement("span", {
    style: { color: "#C9821E", fontWeight: 700, fontSize: 11, marginLeft: 6 }
  }, "Needs an answer")), subtext && React.createElement("div", {
    style: { fontSize: 11, lineHeight: 1.4, color: palette.text + "88", marginBottom: 8 }
  }, subtext), React.createElement(YesNoButtons, {
    qid,
    answer,
    setAnswer,
    palette
  }));
}
