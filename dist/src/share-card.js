// @generated from src/share-card.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
let _fontEmbedCss = null;
function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0;i < bytes.length; i += 32768) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
  }
  return btoa(bin);
}
async function fontEmbedCss() {
  if (_fontEmbedCss !== null)
    return _fontEmbedCss;
  try {
    const b64 = bufToBase64(await fetch("/vendor/fonts/space-grotesk-v22-latin.woff2").then((r) => r.ok ? r.arrayBuffer() : Promise.reject()));
    _fontEmbedCss = `@font-face { font-family: 'Space Grotesk'; font-style: normal; font-weight: 300 700; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
  } catch {
    _fontEmbedCss = "";
  }
  return _fontEmbedCss;
}
async function svgToPngBlob(svgEl, scale = 2) {
  const W = svgEl.viewBox.baseVal.width, H = svgEl.viewBox.baseVal.height;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const css = await fontEmbedCss();
  if (css) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = css;
    clone.insertBefore(style, clone.firstChild);
  }
  const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = svgUrl;
    });
    if (css)
      await new Promise((r) => setTimeout(r, 60));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, W, H);
    return await new Promise((res) => canvas.toBlob(res, "image/png"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
async function downloadSvgAsPng(svgEl, filename, scale = 2) {
  const blob = await svgToPngBlob(svgEl, scale);
  if (!blob)
    return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function DownloadIcon() {
  return React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, React.createElement("path", {
    d: "M8 2.5V9M4.5 6.5L8 9l3.5-2.5"
  }), React.createElement("path", {
    d: "M3 9H13"
  }));
}
const GOLD = "#D9A62A";
const GOLD_LIGHT = "#F4D488";
function ShareCard({ sectors, fills, campName, leadName, year, palette, reveal = null }) {
  const fullTotal = sectors.reduce((n, s) => n + (fills[s.id] && fills[s.id].totalYes || 0), 0);
  const total = reveal == null ? fullTotal : reveal;
  const isPerfect = isPerfectTotal(total);
  const totalRef = useRef(null);
  useEffect(() => {
    if (reveal == null || !totalRef.current)
      return;
    const el = totalRef.current;
    el.style.animation = "none";
    el.offsetWidth;
    el.style.animation = "grg-tick 0.18s ease";
  }, [reveal]);
  return React.createElement("div", {
    style: {
      width: "min(360px, 100%)",
      padding: 28,
      boxSizing: "border-box",
      background: "linear-gradient(155deg, #1c1410 0%, #2a1c14 100%)",
      borderRadius: 24,
      color: "#fff",
      fontFamily: "'Space Grotesk', system-ui, -apple-system, sans-serif",
      boxShadow: isPerfect ? `0 24px 60px rgba(0,0,0,0.5), 0 0 0 2px ${GOLD}, 0 0 40px rgba(217,166,42,0.35)` : "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)", pointerEvents: "none" }
  }), React.createElement("div", {
    style: { position: "relative" }
  }, React.createElement("div", {
    style: { textAlign: "center", marginBottom: 14 }
  }, React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.25em", fontWeight: 700, opacity: 0.6, marginBottom: 4 }
  }, "GREEN RADIUS · BLAST ", year), React.createElement("div", {
    style: { fontSize: 24, fontWeight: 800, lineHeight: 1.12, textWrap: "balance" }
  }, campName || "Theme Camp"), React.createElement("div", {
    style: { marginTop: 8 }
  }, React.createElement("span", {
    ref: totalRef,
    style: { fontSize: 34, fontWeight: 900, color: isPerfect ? GOLD_LIGHT : "#7fc46a", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }
  }, total), React.createElement("span", {
    style: { fontSize: 14, fontWeight: 700, opacity: 0.65 }
  }, " / 60 achieved")), isPerfect && React.createElement("div", {
    style: { fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: GOLD_LIGHT, marginTop: 6 }
  }, "A perfect 60/60")), React.createElement("div", {
    style: { textAlign: "center" }
  }, React.createElement("div", {
    style: { display: "flex", justifyContent: "center", margin: "0 0 14px" }
  }, React.createElement("div", {
    style: { width: "100%", maxWidth: 300, position: "relative" }
  }, isPerfect && React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: -8,
      borderRadius: "50%",
      boxShadow: `0 0 0 3px rgba(217,166,42,0.6), 0 0 24px rgba(217,166,42,0.35)`,
      pointerEvents: "none"
    }
  }), React.createElement(RadialBadge, {
    sectors,
    fills,
    size: 300,
    showGrid: true,
    fluid: true,
    revealCount: reveal
  }))), React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }
  }, sectors.map((s) => {
    const ty = fills[s.id] && fills[s.id].totalYes || 0;
    const c = isPerfect ? GOLD_LIGHT : ty > 0 ? "#7fc46a" : "rgba(255,255,255,0.4)";
    return React.createElement("div", {
      key: s.id,
      style: {
        background: "rgba(255,255,255,0.05)",
        borderRadius: 10,
        padding: "8px 4px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2
      }
    }, React.createElement(SectorIcon, {
      kind: s.icon,
      size: 18,
      color: c
    }), React.createElement("div", {
      style: { fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", opacity: 0.8 }
    }, s.name.toUpperCase()), React.createElement("div", {
      style: { fontSize: 14, fontWeight: 800, color: c }
    }, ty, React.createElement("span", {
      style: { fontSize: 9, opacity: 0.6 }
    }, "/10")));
  })), React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.22em", opacity: 0.55, fontWeight: 700, textAlign: "center", marginTop: 14 }
  }, "GREENRADI.US"))));
}
const CARD_W = 360, CARD_H = 612;
function fitCampName(name) {
  const n = (name || "").trim() || "Theme Camp";
  if (n.length <= 16)
    return { lines: [n], size: 22, ys: [80] };
  const words = n.split(/\s+/);
  let l1 = "", l2 = "";
  for (const w of words) {
    if (!l2 && (l1 ? `${l1} ${w}` : w).length <= 17)
      l1 = l1 ? `${l1} ${w}` : w;
    else
      l2 = l2 ? `${l2} ${w}` : w;
  }
  if (!l1)
    l1 = n.slice(0, 16);
  if (!l2)
    return { lines: [l1.length > 18 ? `${l1.slice(0, 17)}…` : l1], size: 18, ys: [80] };
  if (l2.length > 20)
    l2 = `${l2.slice(0, 19)}…`;
  return { lines: [l1, l2], size: 18, ys: [72, 94] };
}
function ResultCardSVG({ sectors, fills, campName, leadName, year, svgRef }) {
  const pad = 28;
  const name = fitCampName(campName);
  const total = sectors.reduce((n, s) => n + (fills[s.id] && fills[s.id].totalYes || 0), 0);
  const isPerfect = isPerfectTotal(total);
  const totalY = name.lines.length > 1 ? 122 : 106;
  const gridY = 440, gap = 6, cellH = 58;
  const cellW = (CARD_W - 2 * pad - 2 * gap) / 3;
  const cols = [pad, pad + cellW + gap, pad + 2 * (cellW + gap)];
  const badgeCx = (CARD_W - 300) / 2 + 150, badgeCy = 124 + 150;
  return React.createElement("svg", {
    ref: svgRef,
    width: CARD_W,
    height: CARD_H,
    viewBox: `0 0 ${CARD_W} ${CARD_H}`,
    xmlns: "http://www.w3.org/2000/svg",
    style: { fontFamily: "'Space Grotesk', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" }
  }, React.createElement("defs", null, React.createElement("linearGradient", {
    id: "rcBg",
    x1: "0",
    y1: "0",
    x2: "0.45",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#1c1410"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#2a1c14"
  })), React.createElement("radialGradient", {
    id: "rcGlow",
    cx: "50%",
    cy: "26%",
    r: "62%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#D9885C",
    stopOpacity: "0.18"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#D9885C",
    stopOpacity: "0"
  }))), React.createElement("rect", {
    x: "0",
    y: "0",
    width: CARD_W,
    height: CARD_H,
    rx: "24",
    fill: "url(#rcBg)"
  }), React.createElement("rect", {
    x: "0",
    y: "0",
    width: CARD_W,
    height: CARD_H,
    rx: "24",
    fill: "url(#rcGlow)"
  }), isPerfect && React.createElement("rect", {
    x: "1.5",
    y: "1.5",
    width: CARD_W - 3,
    height: CARD_H - 3,
    rx: "23",
    fill: "none",
    stroke: GOLD,
    strokeWidth: "2"
  }), React.createElement("text", {
    x: CARD_W / 2,
    y: "46",
    textAnchor: "middle",
    fontSize: "10",
    fontWeight: "700",
    letterSpacing: "2.4",
    fill: "#fff",
    opacity: "0.6"
  }, "GREEN RADIUS · BLAST ", year), name.lines.map((ln, i) => React.createElement("text", {
    key: i,
    x: CARD_W / 2,
    y: name.ys[i],
    textAnchor: "middle",
    fontSize: name.size,
    fontWeight: "800",
    fill: "#fff"
  }, ln)), React.createElement("text", {
    x: CARD_W / 2,
    y: totalY,
    textAnchor: "middle"
  }, React.createElement("tspan", {
    fontSize: "30",
    fontWeight: "900",
    fill: isPerfect ? GOLD_LIGHT : "#7fc46a"
  }, total), React.createElement("tspan", {
    fontSize: "13",
    fontWeight: "700",
    fill: "#fff",
    opacity: "0.65"
  }, " / 60 achieved")), isPerfect && React.createElement("circle", {
    cx: badgeCx,
    cy: badgeCy,
    r: "132",
    fill: "none",
    stroke: GOLD,
    strokeWidth: "3",
    opacity: "0.6"
  }), React.createElement("g", {
    transform: `translate(${(CARD_W - 300) / 2}, 124)`
  }, React.createElement(RadialBadge, {
    sectors,
    fills,
    size: 300,
    showGrid: true
  })), isPerfect && React.createElement("text", {
    x: CARD_W / 2,
    y: "584",
    textAnchor: "middle",
    fontSize: "11",
    fontWeight: "800",
    letterSpacing: "0.6",
    fill: GOLD_LIGHT
  }, "A perfect 60/60"), sectors.map((s, i) => {
    const ty = fills[s.id] && fills[s.id].totalYes || 0;
    const col = cols[i % 3], rowY = gridY + (i < 3 ? 0 : cellH + gap), cx = col + cellW / 2;
    const color = isPerfect ? GOLD_LIGHT : ty > 0 ? "#7fc46a" : "rgba(255,255,255,0.4)";
    return React.createElement("g", {
      key: s.id
    }, React.createElement("rect", {
      x: col,
      y: rowY,
      width: cellW,
      height: cellH,
      rx: "10",
      fill: "#ffffff",
      fillOpacity: "0.05"
    }), React.createElement("g", {
      transform: `translate(${cx - 9}, ${rowY + 9})`
    }, React.createElement(SectorIcon, {
      kind: s.icon,
      size: 18,
      color
    })), React.createElement("text", {
      x: cx,
      y: rowY + 40,
      textAnchor: "middle",
      fontSize: "9",
      fontWeight: "700",
      letterSpacing: "0.7",
      fill: "#fff",
      opacity: "0.8"
    }, s.name.toUpperCase()), React.createElement("text", {
      x: cx,
      y: rowY + 53,
      textAnchor: "middle",
      fontSize: "13",
      fontWeight: "800",
      fill: color
    }, ty, "/10"));
  }), React.createElement("text", {
    x: CARD_W / 2,
    y: gridY + 2 * cellH + gap + 38,
    textAnchor: "middle",
    fontSize: "10",
    fontWeight: "700",
    letterSpacing: "2",
    fill: "#fff",
    opacity: "0.55"
  }, "GREENRADI.US"));
}
