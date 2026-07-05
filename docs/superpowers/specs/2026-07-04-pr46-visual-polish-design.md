# Green Radius — Visual Polish + Fun (#46) Design

**Status:** approved 2026-07-04 (effects chosen live in the Pizazz Playground demo:
answer = leaf burst, wedge = shine sweep, reveal = staged build-up, home = no ambient).

## Goal

Make playing feel like a game, not a survey: tactile feedback on every answer, a
visible payoff when a wheel wedge fills, and a proper game-show reveal at the end.
Pure UI juice — silent by design, zero scoring or data changes, and reduced-motion
users keep exactly today's quiet behavior.

Out of scope (explicitly decided): sound effects and haptics (revisit in a later PR
if ever), home-screen ambient motion (chose calm), any change to the sector-clear
graffiti Celebration overlay (stays as is), any change to the standalone `/result/`
share page.

## Context (current state)

- `green-radius.jsx` already has: wheel spin ease-out (2.2s cubic-bezier), the
  `Celebration` splat overlay for a 10/10 sector, `qm-fade`/`qm-up` modal entrances,
  and consistent `prefers-reduced-motion` gating (keyframes neutralized in
  `index.html`'s media query).
- Dead moments: `QuestionModal.answer()` advances state with zero feedback; newly
  filled wedges just change color when the modal closes; the finished screen's
  badge/total/rank simply appear.
- No particle machinery exists. The runtime is vendored, no-build, no dependencies;
  every `<script type="text/babel">` shares one Babel scope (components referenced
  by bare name, not `window`).

## Locked decisions

- **Architecture:** hand-rolled canvas particle layer (no vendored library, no
  DOM-node particles). Prototyped and validated in the brainstorm demo
  (`.superpowers/brainstorm/bun-20260704/content/effects-menu.html`).
- **Effect picks:** 1A leaf burst, 2B shine sweep, 3A staged reveal, 4B calm home.
- **Silent:** no audio of any kind in this PR.
- **Reveal scope:** in-session finish only; `/result/` share page stays static.

## 1 · FxLayer + Fx emitter (the only new architecture)

One fixed, full-viewport, `pointer-events: none` `<canvas>` component mounted once
at the root of `GreenRadiusGame`, z-indexed above modals. Next to it, a module-level
`Fx` object in the shared Babel scope (bare name, matching repo convention):

- `Fx.burst(x, y, spec)` — core API; viewport coordinates.
- Convenience wrappers used by call sites: `Fx.leafBurst(el)`, `Fx.dustPuff(el)`,
  `Fx.sparkle(x, y)`, `Fx.ringShock(x, y)` — each measures the element rect and
  fires the right particle mix.
- Particle shapes: `leaf` (rotating ellipse, green ramp `#68B05C/#7AB85C/#A3D178/#439F5B`),
  `spark` (bright streak `#D9F2A8`), `dust` (soft tan `#d8cbb6` dot, low alpha),
  `ring` (expanding stroked circle). Simple physics: velocity, gravity, drag, spin.

Guardrails (all in FxLayer, nowhere else):

- **Reduced motion:** if `prefers-reduced-motion: reduce`, every `Fx.*` call is a
  no-op. Single gate for all particle juice.
- **Idle cost:** the `requestAnimationFrame` loop runs only while particles exist;
  canvas is cleared and the loop stops when the pool empties.
- **Cap:** max ~300 live particles; overflow drops the oldest. DPR capped at 2.
- **Visibility:** `visibilitychange` hidden → clear pool, stop loop.
- **Resize:** canvas re-fits on window resize (and orientation change).

## 2 · Answer feedback (every Yes / Not-yet tap)

In `QuestionModal.answer(yes)` — Levels 1–3 and Tier-4 topics alike:

- **Yes:** leaf + spark burst from the tapped button's rect (`Fx.leafBurst`), plus a
  ~0.4s spring keyframe on the button (`scale 1 → 0.88 → 1.08 → 1`).
- **Not yet:** soft dust puff (`Fx.dustPuff`), gentler spring. Deliberately mild —
  the game never punishes a No.
- **Non-blocking contract:** state advances exactly as today, synchronously; the
  effect is fire-and-forget. No timing dependency, no answer-rate throttle needed
  (the particle cap absorbs mashing).
- Button spring keyframes live in `index.html` beside `qm-up`, neutralized in the
  existing reduced-motion media query.

## 3 · Wedge shine sweep (returning from a sector)

When the question modal closes and the wheel is visible again with newly filled
wedges:

- The wheel component diffs current per-level fills against the previous render via
  a ref (no new state threading, no prop changes for parents).
- Each newly filled wedge gets, staggered ~120ms apart (a cascade when several
  levels filled in one sitting):
  - a white clone of the wedge path appended to the SVG, fading in/out over ~0.95s
    (`opacity 0 → 0.8 → 0`), then removed;
  - two or three sparkle glints via `Fx.sparkle` at the wedge's screen position
    (`getBoundingClientRect` of the path).
- Skipped entirely under reduced motion (the clone is CSS-animated and its keyframe
  is neutralized; sparkles are already gated in FxLayer).

## 4 · Staged result reveal (the climax)

On entering the finished screen from live gameplay (in-session transition only —
not on reload, not on `/result/`):

- **Beat 1 — rings:** badge wedges start unlit and light up sector by sector with a
  small pop each; the cadence divides a fixed ~1.5s build window by the number of
  lit wedges, so a 12-wedge camp and a 24-wedge camp both finish on the same beat.
- **Beat 2 — count-up:** the total ticks 0 → N in sync with the wedges, with a
  small pulse per tick; `font-variant-numeric: tabular-nums` so layout never
  wiggles.
- **Beat 3 — rank slam:** the playa-rank title stamps in (scale-overshoot + slight
  rotate, ~0.7s) with a leaf burst from its position.
- Whole sequence ≈ 2.5s, **non-blocking**: buttons/actions render immediately;
  the reveal is purely visual layered on top of the real values.
- Reduced motion: no staging — badge, total, and rank render complete immediately
  (today's behavior).
- Implementation shape: a `reveal` mode on the finished screen's badge rendering
  (staggered wedge visibility) + a count-up hook for the total + a CSS slam class
  for the rank. The underlying data is final from frame one; only presentation is
  staged (a mid-animation screenshot or download still embeds correct values
  because the share/download card is the separate `ResultCardSVG` twin).

## Non-goals / invariants (unchanged)

- Scoring, `greens` shape, per-question `fills`, result payloads, `SCHEMA_VERSION`
  (`frog-v12.1`), `STORAGE_VERSION`, Worker, sheet, email: untouched.
- `/result/` share page and its Worker OG rewrite: untouched.
- Home screen, FAQ, form mode visuals: untouched (form mode gets no particles —
  it's the pragmatic path and stays quick and quiet).
- Existing `Celebration` overlay: untouched.

## Files touched

- `green-radius.jsx` — FxLayer + `Fx` emitter (~150 lines), three trigger sites
  (answer, wheel diff/shine, finished-screen reveal), `APP_VERSION` → `v46`.
- `index.html` — new keyframes (button spring, shine fade, rank slam, tick pulse)
  plus their reduced-motion neutralizers, following the existing pattern.

## Testing

- Parse gate: `bun build green-radius.jsx --external react --external
  react/jsx-runtime --external react/jsx-dev-runtime > /dev/null`.
- bun + playwright (existing rig in the job tmp dir):
  - full playthrough asserting zero console errors with effects firing;
  - finished screen shows the correct total/rank after the reveal settles;
  - `reducedMotion: 'reduce'` context pass: no canvas particles drawn, instant
    result render;
  - screenshots at 390×667 and desktop width for eyeball review.
- Manual: one phone-simulated playthrough before merge (mobile layout rule).

## Shipping

One branch (`pr46-visual-polish`), one PR (#46), squash-merge, deploy-verify via
the `v46` stamp probe on greenradi.us. Independent of PR #45 (question content);
only the `APP_VERSION` line can collide — whichever lands second rebases trivially.
