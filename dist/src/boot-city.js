// @generated from src/boot-city.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
const CARD_BG = "linear-gradient(160deg, #0e2733 0%, #14323f 100%)";
const playBtn = {
  display: "inline-block",
  background: "#558040",
  color: "#fff",
  padding: "12px 22px",
  borderRadius: 14,
  fontWeight: 700,
  fontSize: 14,
  textDecoration: "none",
  boxShadow: "0 3px 0 #38542b"
};
function fmtAsOf(ms) {
  return new Date(ms).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function CityCard({ children }) {
  return React.createElement("div", {
    style: {
      background: CARD_BG,
      borderRadius: 24,
      color: "#fff",
      padding: "28px 26px",
      width: "min(400px, 100%)",
      boxSizing: "border-box",
      textAlign: "center",
      boxShadow: "0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
      position: "relative",
      overflow: "hidden"
    }
  }, React.createElement("div", {
    style: { position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 30%, rgba(217,136,92,0.18), transparent 60%)", pointerEvents: "none" }
  }), React.createElement("div", {
    style: { position: "relative" }
  }, React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.25em", fontWeight: 700, opacity: 0.6, marginBottom: 4 }
  }, "GREEN RADIUS · BLAST ", new Date().getFullYear()), React.createElement("div", {
    style: { fontSize: 24, fontWeight: 800, lineHeight: 1.12, textWrap: "balance" }
  }, "Black Rock City"), children));
}
function BackLink() {
  return React.createElement("a", {
    href: "/",
    style: {
      display: "inline-block",
      padding: "8px 4px",
      color: "#2a262080",
      fontSize: 10.5,
      fontWeight: 600,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      textDecoration: "underline",
      textUnderlineOffset: "3px",
      textDecorationColor: "#2a262033"
    }
  }, "← Back");
}
function CityShell({ children }) {
  return React.createElement("div", {
    style: { width: "min(400px, 100%)", display: "flex", flexDirection: "column", gap: 6 }
  }, React.createElement("div", {
    style: { textAlign: "left" }
  }, React.createElement(BackLink, null)), children);
}
function CityStats({ sectors, data }) {
  const pct = Math.round((data.tallyPct || 0) * 100);
  const avgById = {};
  (data.sectorAverages || []).forEach((s) => {
    avgById[s.id] = +s.avg || 0;
  });
  return React.createElement(CityCard, null, React.createElement("div", {
    style: { marginTop: 8, marginBottom: 12 }
  }, React.createElement("span", {
    style: { fontSize: 34, fontWeight: 900, color: "#7fc46a", letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }
  }, pct, "%"), React.createElement("span", {
    style: { fontSize: 14, fontWeight: 700, opacity: 0.65 }
  }, " achieved")), React.createElement("div", {
    style: { display: "flex", justifyContent: "center", margin: "0 0 12px" }
  }, React.createElement("div", {
    style: { width: "100%", maxWidth: 300 }
  }, React.createElement(RadialBadge, {
    sectors,
    fills: {},
    size: 300,
    dark: true,
    intensities: data.intensities,
    showGrid: true,
    fluid: true
  }))), React.createElement("div", {
    style: { fontSize: 13.5, color: "#d8cbb6", marginBottom: 4 }
  }, React.createElement("b", {
    style: { color: "#fff" }
  }, data.totalYes), " of ", data.totalPossible, " green choices", " · ", React.createElement("b", {
    style: { color: "#fff" }
  }, data.count), " ", data.count === 1 ? "camp" : "camps", " · ", "+", data.thisWeek, " this week"), data.stale && React.createElement("div", {
    style: { fontSize: 11, color: "#b8a88f", marginBottom: 4 }
  }, "Live tally unavailable right now. Showing the count as of ", fmtAsOf(data.generatedAt), "."), React.createElement("div", {
    style: { fontSize: 10, letterSpacing: "0.22em", opacity: 0.55, fontWeight: 700, margin: "10px 0 6px" }
  }, "SECTOR AVERAGES"), React.createElement("div", {
    style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }
  }, sectors.map((s) => {
    const avg = avgById[s.id] || 0;
    const c = avg > 0 ? "#7fc46a" : "rgba(255,255,255,0.4)";
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
    }, avg.toFixed(1), React.createElement("span", {
      style: { fontSize: 9, opacity: 0.6 }
    }, "/10")));
  })), React.createElement("div", {
    style: { marginTop: 20 }
  }, React.createElement("a", {
    href: "/",
    style: playBtn
  }, "Add your camp's radius ↗")));
}
function CityEmpty() {
  return React.createElement(CityCard, null, React.createElement("div", {
    style: { fontSize: 13.5, lineHeight: 1.55, opacity: 0.8, margin: "14px 0 20px" }
  }, "No camps on the board yet this year. Every camp that plays lights up this page. Be the first."), React.createElement("a", {
    href: "/",
    style: playBtn
  }, "Play the Green Radius Game ↗"));
}
function CityDegraded() {
  return React.createElement(CityCard, null, React.createElement("div", {
    style: { fontSize: 16, fontWeight: 800, margin: "14px 0 6px" }
  }, "The tally is taking a breather."), React.createElement("div", {
    style: { fontSize: 13.5, lineHeight: 1.55, opacity: 0.8, marginBottom: 20 }
  }, "We couldn't load the city's numbers right now. The game itself is fine, and your play still counts toward the tally."), React.createElement("a", {
    href: "/",
    style: playBtn
  }, "Play the Green Radius Game ↗"));
}
function CityPage({ sectors }) {
  const [state, setState] = React.useState({ status: "loading", data: null });
  React.useEffect(() => {
    fetch("/api/city", { headers: { Accept: "application/json" } }).then((r) => r.ok ? r.json() : Promise.reject(new Error("http " + r.status))).then((data) => setState({ status: "ready", data })).catch(() => setState({ status: "error", data: null }));
  }, []);
  if (state.status === "loading")
    return React.createElement("div", {
      className: "grg-loading"
    }, React.createElement("svg", {
      width: "46",
      height: "46",
      viewBox: "0 0 64 64",
      "aria-hidden": "true"
    }, React.createElement("g", {
      className: "grg-loading-wheel"
    }, React.createElement("path", {
      fill: "#A3D178",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L32 10 A23 23 0 0 1 51.92 21.5 Z"
    }), React.createElement("path", {
      fill: "#86C169",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L51.92 21.5 A23 23 0 0 1 51.92 44.5 Z"
    }), React.createElement("path", {
      fill: "#68B05C",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L51.92 44.5 A23 23 0 0 1 32 56 Z"
    }), React.createElement("path", {
      fill: "#56A85C",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L32 56 A23 23 0 0 1 12.08 44.5 Z"
    }), React.createElement("path", {
      fill: "#439F5B",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L12.08 44.5 A23 23 0 0 1 12.08 21.5 Z"
    }), React.createElement("path", {
      fill: "#31975B",
      stroke: "#fff",
      strokeWidth: "1.5",
      strokeLinejoin: "round",
      d: "M32 33 L12.08 21.5 A23 23 0 0 1 32 10 Z"
    }), React.createElement("circle", {
      cx: "32",
      cy: "33",
      r: "23",
      fill: "none",
      stroke: "#2a2620",
      strokeWidth: "2.8"
    }), React.createElement("circle", {
      cx: "32",
      cy: "33",
      r: "3.4",
      fill: "#2a2620"
    })), React.createElement("polygon", {
      points: "32,12 26.8,3 37.2,3",
      fill: "#2a2620"
    })), React.createElement("div", {
      style: { fontWeight: 700 }
    }, "Adding up the city's progress…"));
  if (state.status === "error")
    return React.createElement(CityShell, null, React.createElement(CityDegraded, null));
  if (!state.data.count)
    return React.createElement(CityShell, null, React.createElement(CityEmpty, null));
  return React.createElement(CityShell, null, React.createElement(CityStats, {
    sectors,
    data: state.data
  }));
}
function Boot() {
  return React.createElement(CityPage, {
    sectors: window.SECTORS
  });
}
ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(Boot, null));
