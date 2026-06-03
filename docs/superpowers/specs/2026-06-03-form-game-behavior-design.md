# Form / Game Behavior Changes Design Spec

**Date:** 2026-06-03
**Status:** Approved for implementation

All changes live in `green-radius.jsx`. No `game-data.js` content changes.

## 1. Camp setup (`Intro`, shared by the board-game and form intros)

- **All three fields required.** `Start →` is disabled until `campName`, `leadName`,
  and a **valid** email are all present. Email validity uses the existing regex
  `/^[^@\s]+@[^@\s]+\.[^@\s]+$/`. `onStart` only fires when all three pass.
- **Labels unchanged** ("Camp name", "Sustainability lead", "Email address"). A small
  required asterisk is appended to each (via a new `required` prop on `Field`).
- **Placeholders:**
  - Camp name: `Burners Without Orders` -> **`Your Theme Camp`**
  - Sustainability lead: `Wild N Wet` -> **`Your (Playa) Name`**
  - Email: `you@your.camp` (unchanged)
- **Consent line** (verbatim): "By continuing, you agree the Green Theme Camp
  Community will email your results on completion and may contact you."
- Button label stays "Start →".

## 2. Tier 1-3 required / Tier 4 optional

### Application form (`LinearForm` + `FormSectorBlock` + `YesNoRow`)

- **Required rule (submit-gate).** A sector is *complete* when all its Tier 1-3 fixed
  questions (`sector.levels.slice(0,3)`, 6 questions) are answered (yes or no). Tier 4
  never blocks. `Submit` is enabled only when **every** sector is complete.
  - Helper: `requiredAnswered(sector)`, `incompleteSectors`, `allComplete`,
    `firstIncompleteIndex`.
- **Jump to first incomplete.** On the last page, when `!allComplete`, show below the
  (disabled) Submit: "{n} sector(s) still need required answers" and a button
  "Go to {firstIncompleteName} ->" that calls `setPage(firstIncompleteIndex)` and
  sets `highlightMissing = true`.
- **Make it obvious:**
  - The progress **stepper now fills by completion**, not by pages visited: a sector's
    icon is full-opacity accent once `requiredAnswered` is true, the current page keeps
    its accent ring, and incomplete sectors stay faint. (Replaces the visited-based
    coloring from the pagination PR.)
  - `FormSectorBlock`: a small **REQUIRED** caption above the Tier 1-3 questions,
    mirroring the existing Tier 4 header which becomes **TIER 4 · OPTIONAL** (reworded
    from "Mark any 4+ for completion" to keep the 4+ hint while marking it optional).
  - `YesNoRow` gains a `missing` prop. When `highlightMissing` is on, unanswered Tier
    1-3 rows show a subtle amber left-border + "Needs an answer" hint. Tier 4 rows never
    set `missing`.
- No change to scoring: `computeLevelStates` already scores Tier 1-3 as all-yes and
  Tier 4 as `yeses >= 4 ? green : failed`, which already handles a partial/empty Tier 4.

### Game (`QuestionModal`)

- Tiers 1-3 are already unskippable (Yes/No required to advance) — no change.
- **Tier 4 None button.** In the topic-picker view (`isTier4 && !q`), add a button
  below the `<select>`: "None — skip advanced". It calls `onComplete(answersByLevel)`
  immediately with whatever Tier 4 picks exist so far (0-3), finishing the sector.
- **Make it obvious:** the picker kicker becomes "ADVANCED · OPTIONAL · TOPIC {n} OF 4"
  and the helper copy notes the tier can be skipped.

## 3. Game scoring fix (`GreenRadiusGame.handleAnswers`)

With Tier 4 now skippable, `answersByLevel[3]` may have fewer than 4 entries. Update the
level scoring so a level is green only when it is **complete and all-yes**:

```js
const sizes = [1, 2, 3, 4];
let chain = true;
const newLevelArr = [0, 1, 2, 3].map(li => {
  const ans = answersByLevel[li] || [];
  const complete = ans.length >= sizes[li];
  const allYes = complete && ans.every(a => a === true);
  if (chain && allYes) return 'green';
  chain = false;
  return 'failed';
});
```

This is a no-op for Tiers 1-3 (always full because they are forced) and for a fully
answered Tier 4; it only fixes the skipped/partial Tier 4 case (which must not score
green via `[].every(...) === true`).

## Verification (no test runner)

- **Parse gate:** `bun build green-radius.jsx --external react --external
  react/jsx-runtime --external react/jsx-dev-runtime > /dev/null` exits 0.
- **Browser** (headless Chromium via Bun + Playwright) at 390x667:
  - *Intro:* Start disabled with only camp filled; disabled with an invalid email;
    enabled once camp + lead + valid email present. New placeholders + consent text
    present.
  - *Form:* Submit disabled until all 6 sectors' Tier 1-3 answered; the jump button
    moves to the first incomplete sector and highlights its unanswered required rows;
    Tier 4 left blank never blocks; stepper fills as sectors complete; Tier 4 shows
    OPTIONAL.
  - *Game:* the Tier-4 None button finishes the sector; a sector with Tier 1-3 all-yes
    but Tier 4 skipped scores < 4 greens (no 4/4 celebration). Zero console errors.

## Out of scope

- No `game-data.js` content/URL changes (tracked separately by the URL worksheet).
- No change to the data contract, the done/email screen, share link, or the Worker.
- The Application form keeps Tier 4 as a flat list (no dropdown / no None button there;
  it is simply optional).
