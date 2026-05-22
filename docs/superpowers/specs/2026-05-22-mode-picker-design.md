# Mode picker: two-button intro

**Status:** approved (pending user review of this document)
**Branch:** `mode-picker`
**Date:** 2026-05-22

## Goal

Replace the single `Begin →` CTA on the intro screen with two distinct entry points: a **board game** mode (the existing wheel-based experience) and a **form-based** mode (a placeholder stub for now). This sets up the architecture for adding more entry-point modes (e.g., a PDF download) later without re-plumbing the intro screen.

## Background

- The current intro screen renders a kicker label, the `Green Radius` headline, a tagline, a three-field camp-info form (camp name / sustainability lead / year), and a single full-width `Begin →` button.
- The "form-based" mode replaces a previously-used Google Form: a linear, all-60-questions yes/no version of the same sustainability content. In this branch the form-based mode is **a static stub only** — UI placeholder, no real implementation behind it.
- The localStorage persistence layer (`green-radius-game/v1`, schema version 1) hydrates the saved `phase` on mount. Any new phase values introduced here must be schema-compatible so existing saves continue to resume cleanly.

## In scope (this branch)

1. Replace the intro layout: mode picker comes first; camp-info form moves behind the "board game" entry point.
2. New `ModePicker` component using Direction B (vertical stack of two big poster tiles, icon-top + label-below).
3. New `FormComingSoon` stub component with a back affordance.
4. Extend the `GreenRadiusGame` phase state machine with `'pick-mode'` and `'form-coming-soon'`.
5. Update the tagline copy on the picker screen to be mode-agnostic.
6. Trim the existing `Intro` tagline to remove the now-redundant second sentence.

## Out of scope

- Implementing the actual form-based mode (60-question linear form, scoring, persistence).
- A potential third "PDF download" entry point — mentioned by the user as a future extension; design accommodates it but it is not built here.
- URL routing or History API integration.
- Automated tests — the project currently has none, and introducing a test harness is its own decision.
- Onboarding fields beyond what `Intro` already collects.

## Visual direction (Direction B)

Two full-width vertical poster tiles, stacked with a 12px gap. Icon centered at the top of each tile, label below.

```
┌────────────────────────────────────────┐
│            [wheel icon 56×56]          │  ← board tile
│              Play the Game             │     bg #7AB85C, color #fff
│         BOARD GAME · FUN               │     shadow 0 5px 0 #558040
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│           [clipboard icon 56×56]       │  ← form tile
│              Play the Game             │     bg #fcfaf4, color #2a2620
│         FORM-BASED · QUICK             │     shadow 0 5px 0 #d8d2c2
└────────────────────────────────────────┘
```

The board game tile uses the existing accent green; the form tile uses the lighter "card" background. Both reuse the layered drop-shadow press effect that the current `Begin →` button uses (`0 5px 0 ${accentDark}` for board, `0 5px 0 #d8d2c2` for form).

## State machine

Existing phases: `'intro' | 'playing' | 'done'`. Two new phases added:

```
fresh start            →  pick-mode
pick "board game"      →  pick-mode  →  intro (camp form)  →  playing  →  done
pick "form-based"      →  pick-mode  →  form-coming-soon
stub "← back"          →  form-coming-soon  →  pick-mode
"New Camp" anywhere    →  pick-mode    (resets all the way, not to intro)
```

`STORAGE_VERSION` stays at `1`. The saved-game shape is unchanged (only the set of valid string values for `phase` widens). Existing saves with `phase ∈ {'intro','playing','done'}` continue to validate and hydrate exactly as before — those users skip the picker and land where they left off. A fresh user with no save lands on `'pick-mode'`.

The existing `useEffect` that clears the save slot on `phase === 'intro'` widens to also clear on `phase === 'pick-mode'` (so going "back to the picker" via `New Camp` wipes the save).

## Components and file layout

All edits in `green-radius.jsx` (consistent with current single-file pattern). The file grows by approximately 150 lines.

| Component         | Status   | Purpose                                                                    | Props                         |
|-------------------|----------|----------------------------------------------------------------------------|-------------------------------|
| `ModePicker`      | new      | Renders the two big poster tiles plus kicker / headline / tagline / footer | `onPick(mode)`, `palette`     |
| `FormComingSoon`  | new      | Stub screen with hourglass icon, body copy, and back button                | `onBack()`, `palette`         |
| `Intro`           | existing | Camp-info form. Used only after picking "board". Tagline trimmed.          | `onStart`, `palette`          |
| `GreenRadiusGame` | existing | Default `phase` flips to `'pick-mode'`. Two new phase cases added.         | (unchanged)                   |

`onPick(mode)` receives `'board'` or `'form'` and advances `phase` to `'intro'` or `'form-coming-soon'` respectively.

## ModePicker spec

**Container:** same `padding: '40px 24px'`, `maxWidth: 480`, `textAlign: 'center'` as the current `Intro`. Sits inside `.grg-frame`.

**Above the tiles** (reuses existing `Intro` typography):
- Kicker label: `GREEN THEME CAMP COMMUNITY`
- H1: `Green` / `Radius` (44px, weight 900, with the existing line break)
- Tagline: `Find your camp's footprint across six sustainability sectors. Pick a way to play.`

**Each tile:**
- HTML element: `<button>` (semantic, focusable, keyboard-activatable)
- `width: 100%`, `padding: '22px 16px'`, `border-radius: 18px`, `border: none`, `cursor: pointer`
- Icon: 56×56 inline SVG, `marginBottom: 10px`, `stroke = currentColor`, `stroke-width: 3.5`, no fill except where used for emphasis
- Name (`Play the Game`): `fontSize: 22, fontWeight: 900, letterSpacing: -0.01em, marginBottom: 2`
- Vibe (`BOARD GAME · FUN` / `FORM-BASED · QUICK`): `fontSize: 10, fontWeight: 700, letterSpacing: 0.2em, textTransform: 'uppercase', opacity: 0.75`
- Tap target ≥ 80px tall (passes WCAG 2.5.5; actual height ~125px each)
- `:active` state reduces shadow to `0 1px 0 ...` and translates Y `+3px` — matches the existing `Begin →` press feel. Respects `prefers-reduced-motion` (skip the translate, keep the shadow change).

**Icons:**
- Board: stylized wheel — circle with cross-hatched radial lines and a small triangular pointer at top, centered dot. Inline SVG; uses `currentColor`.
- Form: clipboard — rectangle with rounded corners, top-attached tab, two filled small squares with horizontal lines next to them suggesting answered items.

**Accessibility:**
- `aria-label` per tile: `"Play the game in board game mode"`, `"Play the game in form-based mode"`.
- Icons marked `aria-hidden="true"`.

**Below the tiles:** keep the existing footer caption `6 SECTORS · 4 LEVELS · 10 QUESTIONS` (accurate for both modes).

## FormComingSoon spec

Lands here when `phase === 'form-coming-soon'`. Visually mirrors the picker container for continuity.

**Layout:**

```
GREEN THEME CAMP COMMUNITY    ← kicker (same)
   Green / Radius             ← H1 (same)

   [hourglass icon 64×64]     ← centered, currentColor stroke

   Form mode is coming soon   ← headline 22 / 900
   Sixty yes/no               ← body, 14 / 500, max-width 280
   sustainability questions
   in one linear form.
   No wheel, just speed.

   [  ← Back to mode picker  ] ← ghost button, full-width
```

**Styling:**
- Hourglass icon: 64×64 inline SVG, `stroke: currentColor`, `stroke-width: 3`.
- Headline: `fontSize: 22, fontWeight: 900, letterSpacing: -0.01em, margin: '20px 0 8px'`.
- Body: `fontSize: 14, lineHeight: 1.5, color: palette.text + 'aa', maxWidth: 280, margin: '0 auto 28px'`.
- Back button: ghost — `background: 'transparent'`, `border: 1.5px solid ${palette.text}22`, full-width, padding `16px`, `borderRadius: 14`, font matches the existing CTA (`fontSize: 14, fontWeight: 800, letterSpacing: 0.15em, textTransform: 'uppercase'`), text color `palette.text` (not white).

**Behavior:**
- Back button → `onBack()` sets `phase` back to `'pick-mode'`.
- `phase: 'form-coming-soon'` is persisted (treated as a real phase). A refresh on this screen returns to the stub, not the picker. Acceptable — this is a stable state, not transient.
- No camp info collected; no save-slot pollution.

**Footer:** the `6 SECTORS · 4 LEVELS · 10 QUESTIONS` caption is omitted on this screen — not relevant for a placeholder.

## Intro tweaks

When `phase === 'intro'` (camp-info form, after picking board):

- Trim tagline from `Spin the wheel. Answer honestly. Discover your camp's unique footprint across six sustainability sectors.` → `Spin the wheel. Answer honestly.` — the longer second sentence is now redundant with the picker tagline the user saw seconds earlier.
- Everything else on this screen stays exactly as today (fields, button label `Begin →`, footer caption).
- A `← Pick a different mode` ghost link above the kicker was considered and deferred — defaulting OFF to keep the diff minimal.

## Edge cases and compatibility

1. **Old localStorage saves** — `phase` values `'intro'`, `'playing'`, `'done'` remain valid; hydrate normally. Saved users skip the picker and land where they were. ✅
2. **Browser back button on `form-coming-soon`** — the app does not use the History API, so browser back exits the site rather than returning to the picker. Documented known limitation; the in-app `← Back to mode picker` button is the intended affordance.
3. **Refresh on `pick-mode`** — fresh user with no save, no in-flight state, lands on picker. ✅
4. **"New Camp" from done** — currently transitions to `'intro'`; updated to transition to `'pick-mode'` so the user gets the full re-choice. The save-slot clearing useEffect widens to fire on both `'intro'` and `'pick-mode'`.
5. **Private mode / disabled localStorage** — existing try/catch covers; no new failure modes.
6. **Cloudflare Bot Fight Mode** — unaffected (acts on HTML response, not the JSX runtime).

## Testing (manual, browser)

- Fresh load (cleared localStorage) → picker shown
- Pick board game → camp form → wheel game (existing flow unchanged)
- Pick form-based → coming-soon screen
- On coming-soon → click back → picker
- On coming-soon → refresh → still on coming-soon
- Mid-game (`phase: 'playing'`) refresh → resumes mid-wheel, no picker re-prompt
- Done screen → New Camp → picker (not the camp form)
- DevTools → emulate `prefers-reduced-motion` → tile press still feels appropriate (shadow change, no translate)
- Keyboard: Tab to tiles → focus visible → Enter activates

## Future considerations

- **Third mode — PDF download.** User has flagged this as a near-future addition. The vertical-stack design accommodates a third tile with no layout change; only ranking/grouping considerations to address when adding (e.g., does the PDF tile live alongside or visually grouped as "no game" vs the two "play" options).
- **Build out form-based mode for real.** Same 60 questions, linear, scoring, persistence via a separate `green-radius-game/v1-form` save slot (parallel to the wheel-mode save).
- **History API integration.** If browser-back becomes a real UX expectation, wrap phase transitions with `pushState` / `popstate`.
- **`← Pick a different mode` link on `Intro`.** Deferred this session; trivial to add later as a single ghost link.

## Open questions

None. Design is fully resolved.
