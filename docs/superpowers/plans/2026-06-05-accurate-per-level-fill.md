# Accurate Per-Level Fill — Implementation Plan

> Executed inline on the `perpoint-scoring-granular-data` branch (PR #32). Verify each step with the parse gate; Playwright + screenshot at the end. Code details live in `docs/superpowers/specs/2026-06-05-accurate-per-level-fill-design.md`.

**Order (each commit parse-gates clean; the app stays runnable):**

1. **Helpers swap.** In `green-radius.jsx`, replace `SCORE_BANDS`/`scoreSector`/`sectorLevelStates`/`levelStatesFromAnswers` with `LEVEL_COLORS`, `sectorFill`, `fillsFromAnswers` (spec §Core representation). Add a tiny `arcSegments` note (reuse existing `arcPath`).

2. **result-state v2.** Rewrite `encode`/`decode` to carry `p` (per-sector packed `fixedBits*5+advCount`); remove `greensToLevelStates`; legacy `g` fallback. (spec §Hash)

3. **RadialBadge → segments + colors.** Rewrite to take `fills`; per-level per-question angular segments; center `{sum totalYes}/60`. `RadiusLogomark` inherits.

4. **ShareCard + ResultCardSVG.** Pass `fills`; per-sector cell `{totalYes}/10`.

5. **Wheel → segments + colors.** Subdivide each band into per-question segments; `LEVEL_COLORS` filled / `ringTint` empty; takes `fills`.

6. **GreenRadiusGame state.** Remove `levelStates`/`initState`; add `fills = useMemo(fillsFromAnswers(sectors, answers))`. Update `handleAnswers` (merge answers + closed + cursor; celebrate at totalYes===10), `submitForm` (closed all + done), POST `greens = sectorFill().totalYes`, persistence (drop levelStates; bump `STORAGE_VERSION` → 6), `loadSaved` sanity, reset paths, done-screen totals + mini grid, toast copy. Pass `fills` to `Wheel`/`ShareCard`.

7. **result/index.html.** Use `decode().fills`; `<ShareCard fills=... />`.

8. **worker/index.js.** greens clamp `Math.min(4,…)` → `Math.min(10,…)`.

9. **Tiers → Levels** user-facing copy (modal, form, FAQ).

10. **Docs.** Update `docs/architecture.md` (fill model, 0–10 sheet range, hash v2).

11. **Verify.** Parse gates; Playwright (Water example segment fills, board/form parity, greens 0–10, result page from hash); screenshot the done card → send to user.
