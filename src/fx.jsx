// src/fx.jsx — canvas particle-FX layer (Fx emitter + FxLayer). Shared Babel scope; see src/core.jsx.

// ─── particle FX (hand-rolled canvas layer, PR #46) ─────────────────────────
// One fixed full-viewport <canvas> (FxLayer) + a module-scope emitter (Fx).
// Bare names in the shared Babel scope — NOT window.* (repo convention).
// Guardrails all live here: reduced-motion no-op, loop stops when the pool
// empties, ~300 live-particle cap (drop oldest), DPR capped at 2, canvas
// re-fits on resize/orientation, pool cleared + loop halted when the tab hides.
const FX_TAU = Math.PI * 2;
const FX_LEAF_COLORS = ['#68B05C', '#7AB85C', '#A3D178', '#439F5B'];
const FX_SPARK = '#D9F2A8';
const FX_DUST = '#d8cbb6';
const FX_CAP = 300;

const _fx = { canvas: null, ctx: null, ps: [], running: false, w: 0, h: 0, dpr: 1 };

function _fxReduce() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function _fxDraw(ctx, p, a) {
  ctx.globalAlpha = a;
  if (p.kind === 'leaf') {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.48, 0, 0, FX_TAU); ctx.fill();
    ctx.restore();
  } else if (p.kind === 'spark') {
    ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 2.4, p.y - p.vy * 2.4); ctx.stroke();
  } else if (p.kind === 'ring') {
    ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(1, p.size * (1 - p.age / p.life));
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, FX_TAU); ctx.stroke();
  } else { // dust / dot
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, FX_TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function _fxTick() {
  const st = _fx;
  if (!st.ctx) { st.running = false; return; }
  st.ctx.clearRect(0, 0, st.w, st.h);
  if (!st.ps.length) { st.running = false; return; } // pool empty → stop the loop
  const alive = [];
  for (let i = 0; i < st.ps.length; i++) {
    const p = st.ps[i];
    p.age++;
    if (p.age >= p.life) continue;
    p.vx *= p.drag; p.vy = p.vy * p.drag + p.g;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.r += p.vrad;
    const a = p.kind === 'dust' ? 0.4 * (1 - p.age / p.life) : 1 - p.age / p.life;
    _fxDraw(st.ctx, p, a);
    alive.push(p);
  }
  st.ps = alive;
  requestAnimationFrame(_fxTick);
}

function _fxStart() {
  if (!_fx.running && _fx.ps.length && _fx.ctx) {
    _fx.running = true;
    requestAnimationFrame(_fxTick);
  }
}

const Fx = {
  burst(x, y, spec) {
    if (_fxReduce() || !_fx.ctx) return; // single reduced-motion gate for all juice
    const n = spec.n || 12;
    for (let i = 0; i < n; i++) {
      const ang = (spec.angle == null ? Math.random() * FX_TAU
        : spec.angle + (Math.random() - 0.5) * (spec.spread || 1.2));
      const sp = (spec.speed || 3) * (0.4 + Math.random() * 0.9);
      _fx.ps.push({
        kind: spec.kind, x: x, y: y,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (spec.up || 0),
        g: spec.g == null ? 0.12 : spec.g, drag: spec.drag == null ? 0.99 : spec.drag,
        age: 0, life: (spec.life || 40) * (0.7 + Math.random() * 0.6),
        size: (spec.size || 5) * (0.6 + Math.random() * 0.8),
        rot: Math.random() * FX_TAU, vr: (Math.random() - 0.5) * 0.3,
        color: spec.colors ? spec.colors[i % spec.colors.length] : (spec.color || '#fff'),
        r: spec.r || 0, vrad: spec.vrad || 0,
      });
    }
    if (_fx.ps.length > FX_CAP) _fx.ps.splice(0, _fx.ps.length - FX_CAP); // drop oldest
    _fxStart();
  },
  _center(el) {
    if (!el || !el.getBoundingClientRect) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  },
  leafBurst(el) {
    const c = this._center(el); if (!c) return;
    this.burst(c.x, c.y, { kind: 'leaf', n: 14, speed: 4.2, up: 2.2, g: 0.14, life: 46, size: 5, colors: FX_LEAF_COLORS });
    this.burst(c.x, c.y, { kind: 'spark', n: 8, speed: 5.5, up: 1.5, g: 0.05, life: 22, color: FX_SPARK });
  },
  dustPuff(el) {
    const c = this._center(el); if (!c) return;
    this.burst(c.x, c.y, { kind: 'dust', n: 10, speed: 1.6, up: 0.6, g: -0.01, drag: 0.96, life: 38, size: 7, color: FX_DUST });
  },
  sparkle(x, y) {
    this.burst(x - 6, y - 4, { kind: 'spark', n: 3, speed: 1.4, life: 20, color: '#ffffff' });
    this.burst(x + 8, y + 3, { kind: 'spark', n: 3, speed: 1.4, life: 20, color: '#F2EBAA' });
  },
  ringShock(x, y) {
    this.burst(x, y, { kind: 'ring', n: 1, life: 30, size: 5, r: 10, vrad: 4.5, color: FX_DUST });
    this.burst(x, y, { kind: 'dust', n: 12, speed: 2.6, g: 0.02, life: 36, size: 6, color: FX_DUST });
  },
  clear() {
    _fx.ps.length = 0;
    if (_fx.ctx) _fx.ctx.clearRect(0, 0, _fx.w, _fx.h);
  },
};

function FxLayer() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    _fx.canvas = canvas;
    _fx.ctx = ctx;
    function fit() {
      const dpr = Math.min(2, window.devicePixelRatio || 1); // DPR cap 2
      _fx.dpr = dpr;
      _fx.w = window.innerWidth;
      _fx.h = window.innerHeight;
      canvas.width = _fx.w * dpr;
      canvas.height = _fx.h * dpr;
      canvas.style.width = _fx.w + 'px';
      canvas.style.height = _fx.h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    fit();
    function onVis() { if (document.hidden) Fx.clear(); } // hidden → clear pool, loop self-stops
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      document.removeEventListener('visibilitychange', onVis);
      Fx.clear();
      _fx.canvas = null; _fx.ctx = null;
    };
  }, []);
  return (
    <canvas
      ref={ref}
      data-fx="1"
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 60 }}
    />
  );
}
