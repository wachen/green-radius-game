// @generated from src/wheel.jsx by scripts/build.js — DO NOT EDIT.
// Edit the .jsx source, then run: bun run scripts/build.js
function Wheel({ sectors, fills, rotation, spinning, onSpin, canSpin, variant, palette, shinePaused }) {
  const SIZE = 420;
  const cx = SIZE / 2, cy = SIZE / 2;
  const ringRadii = [60, 100, 140, 180];
  const ringOuter = [100, 140, 180, 200];
  const N = sectors.length;
  const sweep = 360 / N;
  const dim = variant === "dimensional";
  const reduceMotion = prefersReducedMotion();
  const svgRef = useRef(null);
  const prevFilledRef = useRef(null);
  const ringTint = ["#c9b89a", "#d3c4a8", "#dcd0b5", "#e4d9c1"];
  useEffect(() => {
    if (reduceMotion)
      return;
    if (shinePaused)
      return;
    const svg = svgRef.current;
    if (!svg)
      return;
    const cur = new Set;
    sectors.forEach((sector) => {
      const lv = fills[sector.id] && fills[sector.id].levels || [[], [], [], []];
      [0, 1, 2, 3].forEach((li) => (lv[li] || []).forEach((v, qi) => {
        if (v)
          cur.add(`${sector.id}-${li}-${qi}`);
      }));
    });
    const prev = prevFilledRef.current;
    prevFilledRef.current = cur;
    if (prev == null)
      return;
    const added = [];
    cur.forEach((k) => {
      if (!prev.has(k))
        added.push(k);
    });
    if (!added.length)
      return;
    const timers = [];
    added.forEach((key, i) => {
      timers.push(setTimeout(() => {
        const path = svg.querySelector(`path[data-cell="${key}"]`);
        if (!path)
          return;
        const clone = path.cloneNode(true);
        clone.setAttribute("fill", "#ffffff");
        clone.removeAttribute("data-cell");
        clone.setAttribute("class", "grg-shine");
        clone.style.pointerEvents = "none";
        path.parentNode.appendChild(clone);
        setTimeout(() => clone.remove(), 1000);
        const r = path.getBoundingClientRect();
        Fx.sparkle(r.left + r.width / 2, r.top + r.height / 2);
      }, i * 120));
    });
    return () => timers.forEach(clearTimeout);
  }, [fills, sectors, reduceMotion, shinePaused]);
  return React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      maxWidth: 380,
      aspectRatio: "1 / 1",
      margin: "0 auto"
    }
  }, dim && React.createElement("div", {
    style: {
      position: "absolute",
      inset: -14,
      borderRadius: "50%",
      background: "radial-gradient(circle, transparent 60%, rgba(217,136,92,0.15) 75%, transparent 100%)",
      filter: "blur(4px)"
    }
  }), React.createElement("svg", {
    ref: svgRef,
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    role: "img",
    "aria-label": `Green radius wheel. ${sectors.map((s) => `${s.name} ${fills[s.id] && fills[s.id].totalYes || 0} of 10`).join(", ")}.`,
    style: {
      display: "block",
      transform: `rotate(${rotation}deg)`,
      transition: spinning ? reduceMotion ? "transform 0.4s ease-out" : "transform 2.2s cubic-bezier(0.17, 0.67, 0.16, 0.99)" : "none",
      filter: dim ? "drop-shadow(0 12px 28px rgba(40,20,10,0.35))" : "drop-shadow(0 4px 12px rgba(40,20,10,0.18))"
    }
  }, React.createElement("defs", null, sectors.map((s, i) => React.createElement("radialGradient", {
    key: s.id,
    id: `grad-${s.id}`,
    cx: "50%",
    cy: "50%",
    r: "50%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: s.color,
    stopOpacity: "0.85"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: s.color,
    stopOpacity: "1"
  })))), sectors.map((sector, si) => {
    const a0 = si * sweep;
    const a1 = (si + 1) * sweep;
    const lv = fills[sector.id] && fills[sector.id].levels || [[], [], [], []];
    return [0, 1, 2, 3].map((li) => {
      const cells = lv[li] || [];
      return segAngles(a0, a1, cells.length || 1, 0).map(([s0, s1], qi) => {
        const filled = cells[qi];
        return React.createElement("g", {
          key: `${sector.id}-${li}-${qi}`
        }, React.createElement("path", {
          "data-cell": filled ? `${sector.id}-${li}-${qi}` : undefined,
          d: arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1),
          fill: filled ? LEVEL_COLORS[li] : ringTint[li],
          stroke: palette.bg,
          strokeWidth: dim ? 2 : 1.5
        }), filled && React.createElement("path", {
          d: arcPath(cx, cy, ringRadii[li], ringOuter[li], s0, s1),
          fill: "url(#greenShimmer)",
          fillOpacity: "0.25"
        }));
      });
    });
  }), sectors.map((_, si) => {
    const ang = si * sweep;
    const [x0, y0] = polar(cx, cy, 60, ang);
    const [x1, y1] = polar(cx, cy, 200, ang);
    return React.createElement("line", {
      key: si,
      x1: x0,
      y1: y0,
      x2: x1,
      y2: y1,
      stroke: palette.bg,
      strokeWidth: 2
    });
  }), sectors.map((sector, si) => {
    const ang = si * sweep + sweep / 2;
    const [x, y] = polar(cx, cy, 80, ang);
    return React.createElement("g", {
      key: `icon-${sector.id}`,
      transform: `translate(${x - 14} ${y - 14}) rotate(${-rotation} 14 14)`
    }, React.createElement(SectorIcon, {
      kind: sector.icon,
      size: 28,
      color: "#3a2a20"
    }));
  }), React.createElement("circle", {
    cx,
    cy,
    r: 56,
    fill: palette.hub,
    stroke: palette.hubStroke,
    strokeWidth: 2
  }), dim && React.createElement("circle", {
    cx,
    cy,
    r: 56,
    fill: "url(#hubGloss)"
  }), React.createElement("defs", null, React.createElement("radialGradient", {
    id: "hubGloss",
    cx: "40%",
    cy: "35%",
    r: "60%"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#fff",
    stopOpacity: "0.4"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#fff",
    stopOpacity: "0"
  })), React.createElement("linearGradient", {
    id: "greenShimmer",
    x1: "0",
    y1: "0",
    x2: "1",
    y2: "1"
  }, React.createElement("stop", {
    offset: "0%",
    stopColor: "#fff",
    stopOpacity: "0.5"
  }), React.createElement("stop", {
    offset: "100%",
    stopColor: "#fff",
    stopOpacity: "0"
  })))), React.createElement("button", {
    onClick: canSpin && !spinning ? onSpin : undefined,
    disabled: !canSpin || spinning,
    style: {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%,-50%)",
      width: 104,
      height: 104,
      borderRadius: "50%",
      border: "none",
      background: spinning ? palette.hub : palette.accentDark,
      color: palette.bg,
      fontSize: 14,
      fontWeight: 800,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      cursor: canSpin && !spinning ? "pointer" : "default",
      boxShadow: dim ? `0 6px 18px ${palette.accent}66, inset 0 -3px 0 rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.25)` : `0 3px 0 ${palette.accentDeep}`,
      transition: "transform 0.15s, box-shadow 0.15s",
      zIndex: 4
    },
    onMouseDown: (e) => canSpin && !spinning && (e.currentTarget.style.transform = "translate(-50%,-50%) scale(0.96)"),
    onMouseUp: (e) => e.currentTarget.style.transform = "translate(-50%,-50%)",
    onMouseLeave: (e) => e.currentTarget.style.transform = "translate(-50%,-50%)"
  }, spinning ? "..." : canSpin ? "Spin" : "Done"), React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: -6,
      transform: "translateX(-50%)",
      width: 0,
      height: 0,
      borderLeft: "14px solid transparent",
      borderRight: "14px solid transparent",
      borderTop: `22px solid ${palette.accent}`,
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
      zIndex: 3
    }
  }));
}
