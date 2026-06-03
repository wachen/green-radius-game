# Form Pagination Design Spec (LinearForm)

**Date:** 2026-06-03
**Status:** Approved for implementation

## Goal

Make the Application (form) path more digestible by paginating the six
sustainability sectors one per page instead of one long scroll. Remove the
running answer count, and add a sector progress stepper, per-page Back/Next
controls, and a per-page Clear Form action.

## Scope and constraints

- **Single component:** `LinearForm` in `green-radius.jsx`. Its props are
  unchanged (`sectors, answers, setAnswer, onSubmit, onBack, onClear, palette`),
  so `GreenRadiusGame`, the `form-intro` screen, and the `done` screen need no
  changes.
- **No change** to the data contract, the scoring (`computeLevelStates` /
  `handleSubmit`), `formAnswers` persistence, or the `FormSectorBlock` /
  `YesNoRow` children (reused as-is).
- The `form-intro` (Intro) screen already shows the large "What's Your Green
  Radius?" title immediately before the form, so the form pages themselves drop
  that H1 for a leaner wizard header.

## Page model

- 6 pages, one per sector, in data order (food, water, waste, transport,
  shelter, power). `const [page, setPage] = useState(0)` (0 to 5);
  `const sector = sectors[page]`.
- Page index is **in-memory only** (not persisted). Answers stay autosaved as
  today; a reload reopens at page 1. (Persisting the page would need a
  `STORAGE_VERSION` bump for marginal benefit, so it is out of scope.)
- **Free navigation:** Next never requires the current page to be answered.

## Per-page layout (top to bottom)

1. **Top bar:** a low-emphasis left-aligned "✕ Close" button calling `onBack()`
   (exits to the mode picker). Replaces the old "← Back".
2. **Sector progress stepper (icon stepper):**
   - A centered row of the six real `SectorIcon`s in data order, capped at
     ~320px wide so it fits the narrowest phone.
   - States: **visited** (`i < page`) = accent color, full opacity; **current**
     (`i === page`) = accent icon inside a soft accent ring/pill; **upcoming**
     (`i > page`) = muted (`palette.text` low alpha, reduced opacity).
   - Centered caption below: `{SECTOR.name.toUpperCase()} · {page+1} OF 6`
     (e.g. "WATER · 3 OF 6").
   - Indicator only (not tappable in v1).
3. **Page 1 only:** one subtitle line, "Answer yes/no for your camp. Progress is
   autosaved." (muted). Pages 2 to 6 omit it for consistency and vertical economy.
4. **Current sector:** the existing `<FormSectorBlock>` (unchanged), wrapped in a
   `key={page}` div so it re-mounts and re-animates on page change.
5. **Footer navigation:** a row of two equal pills:
   - Left "← Previous" calling `setPage(p-1)`; **disabled on page 1** (the
     two-pill layout is preserved so Next does not jump position).
   - Right pill is "Next →" calling `setPage(p+1)` on pages 1 to 5.
   - On **page 6** the right pill becomes the green primary "Submit →"
     (`palette.accent` background, `0 4px 0 accentDark` shadow) calling
     `handleSubmit()`; disabled when `totalAnswered === 0` (same rule as today).
   - Exit-to-menu lives in the top "✕ Close"; submit lives only on the last page.
6. Below the nav row, on **every page:** a subtle centered "Clear Form ✕" calling
   `confirm('Clear all answers?')` then `onClear()`; disabled when
   `totalAnswered === 0`. Clears the **whole** form (all sectors) and keeps the
   current page.
7. **Page 6 only:** the "CREATED BY THE GREEN THEME CAMP COMMUNITY" link, subtle,
   below the footer (kept once at the end rather than repeated on every page).

## Behavior

- On page change (`useEffect` on `[page]`): `window.scrollTo(0, 0)`, and re-run a
  subtle fade-up by keying the content wrapper `key={page}` with
  `animation: 'qm-up .25s ease both'`. `qm-up` is already reduced-motion-aware in
  `index.html`, so it becomes a no-op when the user prefers reduced motion.
- **Removed:** the `{totalAnswered} / {totalQuestions} ANSWERED` line and the big
  `<h1>`. `totalAnswered` is still computed (gates Submit and Clear);
  `totalQuestions` computation is removed (now unused).

## Accessibility

- Stepper wrapper: `role="group"` + `aria-label="Progress: sector {n} of 6,
  {name}"`; the icons are `aria-hidden`.
- Buttons carry explicit aria-labels: "Close form", "Previous sector", "Next
  sector", "Submit form answers", "Clear all form answers".
- Nav and Clear keep a >= 44px min touch target.

## Verification (no test runner)

- **Parse gate:** `bun build green-radius.jsx --external react --external
  react/jsx-runtime --external react/jsx-dev-runtime > /dev/null` exits 0.
- **Browser** (headless Chromium via Bun + Playwright) at 390x667: enter the form
  path; confirm exactly one sector shows per page; Next/Previous move through all
  6; the stepper fills and highlights correctly; Close exits; Clear empties
  answers (after confirm); page 6 shows Submit and submitting reaches the done
  screen. Zero console errors.

## Out of scope

- Tap-to-jump on stepper icons; persisting the current page across reloads;
  un-toggling a Yes/No answer; submitting from a page other than the last; any
  change to scoring, the data shape, or the done/email screen.
