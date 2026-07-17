// @generated from src/core.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
const { useState, useEffect, useRef, useMemo, useCallback } = React;
function useModalA11y(ref) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useEffect(() => {
    const node = ref.current;
    if (!node)
      return;
    const onKey = (e) => {
      if (e.key !== "Tab")
        return;
      const f = Array.from(node.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => {
        const s = getComputedStyle(el);
        return s.visibility !== "hidden" && s.display !== "none";
      });
      if (!f.length)
        return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener("keydown", onKey);
    return () => node.removeEventListener("keydown", onKey);
  }, [ref]);
}
const STORAGE_KEY = "green-radius-game/v1";
const STORAGE_VERSION = 7;
const NOTE_MAX_LEN = 140;
const COMMUNITY_LINK_URL = "https://www.greenthemecampcommunity.org/";
const BOARD_GAME_PDF_URL = "/downloads/" + encodeURIComponent("2026.05.19 Green Radius Game -- Download for Players -- How-to-Play - Board Game - Matrix - Detail -- v 26 FINAL .pdf");
const RESOURCE_GUIDE_URL = "https://www.greenthemecampcommunity.org/resource-guide";
const REPORT_EMAIL = "greenthemecamps@burningman.org";
const APP_VERSION = "v73";
function validQidSet(sectors) {
  const set = new Set;
  sectors.forEach((s) => {
    s.levels.slice(0, 3).forEach((level) => (level || []).forEach((q) => set.add(q.id)));
    (s.tier4Topics || []).forEach((t) => set.add(t.id));
    campIdeaIds(s).slice(1).forEach((id) => set.add(id));
  });
  return set;
}
function isCurrentShape(data, sectors) {
  return data.version === STORAGE_VERSION && data.answers && typeof data.answers === "object" && sectors.every((s) => typeof (data.sectorCursor && data.sectorCursor[s.id]) === "number" && typeof (data.sectorClosed && data.sectorClosed[s.id]) === "boolean");
}
function migrateSaved(data, sectors) {
  if (!data || typeof data !== "object")
    return null;
  if (isCurrentShape(data, sectors))
    return data;
  if (data.phase === "done")
    return null;
  if (!data.answers || typeof data.answers !== "object")
    return null;
  const valid = validQidSet(sectors);
  const answers = {};
  for (const k of Object.keys(data.answers)) {
    const v = data.answers[k];
    if (valid.has(k) && (v === "yes" || v === "no"))
      answers[k] = v;
  }
  const customNotes = {};
  if (data.customNotes && typeof data.customNotes === "object") {
    for (const k of Object.keys(data.customNotes)) {
      const t = data.customNotes[k];
      if (valid.has(k) && answers[k] && typeof t === "string" && t.trim())
        customNotes[k] = t.slice(0, NOTE_MAX_LEN);
    }
  }
  const sectorClosed = {}, sectorCursor = {};
  sectors.forEach((s) => {
    const fixed = s.levels.slice(0, 3).reduce((a, lvl) => a.concat(lvl || []), []);
    const done = fixed.length > 0 && fixed.every((q) => answers[q.id] === "yes" || answers[q.id] === "no");
    sectorClosed[s.id] = done;
    sectorCursor[s.id] = done ? 4 : 0;
  });
  const str = (v) => typeof v === "string" ? v : "";
  const camp = data.camp && typeof data.camp === "object" ? { campName: str(data.camp.campName), leadName: str(data.camp.leadName), email: str(data.camp.email) } : { campName: "", leadName: "", email: "" };
  const campId = typeof data.campId === "string" && data.campId ? data.campId : genCampId();
  const mode = data.mode === "form" ? "form" : "board";
  return {
    version: STORAGE_VERSION,
    phase: mode === "form" ? "form" : "playing",
    camp,
    campId,
    sectorCursor,
    sectorClosed,
    answers,
    customNotes,
    mode,
    submittedAt: null,
    salvaged: true
  };
}
function loadSaved(sectors) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw)
      return null;
    return migrateSaved(JSON.parse(raw), sectors);
  } catch (e) {
    console.warn("loadSaved: could not read/parse saved game", e);
    return null;
  }
}
function clearSaved() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
function genCampId() {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID)
      return crypto.randomUUID();
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : r & 3 | 8).toString(16);
  });
}
const LEVEL_COLORS = ["#68B05C", "#56A85C", "#439F5B", "#31975B"];
function campIdeaIds(sector) {
  const base = (sector.tier4Topics || []).find((t) => /-camp$/.test(t.id));
  return base ? [base.id, base.id + "-2", base.id + "-3", base.id + "-4"] : [];
}
function sectorFill(sector, answers) {
  const levels = [0, 1, 2].map((li) => (sector.levels[li] || []).map((q) => answers[q.id] === "yes"));
  const extraCampIds = campIdeaIds(sector).slice(1);
  const advYes = Math.min(4, (sector.tier4Topics || []).filter((t) => answers[t.id] === "yes").length + extraCampIds.filter((id) => answers[id] === "yes").length);
  levels[3] = [0, 1, 2, 3].map((i) => i < advYes);
  const fixedYes = levels.slice(0, 3).reduce((n, a) => n + a.filter(Boolean).length, 0);
  const ids = [].concat(...sector.levels.slice(0, 3)).map((q) => q.id).concat((sector.tier4Topics || []).map((t) => t.id)).concat(extraCampIds);
  const played = ids.some((id) => answers[id] === "yes" || answers[id] === "no");
  return { levels, totalYes: fixedYes + advYes, played };
}
function fillsFromAnswers(sectors, answers) {
  const out = {};
  sectors.forEach((s) => {
    out[s.id] = sectorFill(s, answers);
  });
  return out;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { migrateSaved, isCurrentShape, validQidSet, STORAGE_VERSION };
}
