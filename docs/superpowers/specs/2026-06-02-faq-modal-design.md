# Home-page FAQ modal

**Status:** approved (pending user review of this document)
**Branch:** `faq-modal`
**Date:** 2026-06-02

## Goal

Add a Frequently Asked Questions modal to the home screen so newcomers can answer the obvious first questions without leaving the page: what this is, how to play, why there are two modes, what happens to their results, the BLAST → Green Radius transition, where to learn more, and how to report a problem. A small, distinct **FAQ** button on the home screen opens a dismissable popup with every answer expanded in one scroll.

## Background

- The home screen is the `ModePicker` (phase `'pick-mode'`, the default). It renders a kicker, the "What's Your Green Radius?" headline, a row of the six sector icons, a subtitle, then two big tiles ("Play the Game" / "Fill the Form"), then a footer of links.
- The program is moving away from the "BLAST" name toward "Green Radius," but still references BLAST for continuity with the Green Theme Camp Community's existing BLAST & Resources material. The FAQ is the natural place to explain that this is an evolution, not a departure.
- The app is a single-file, no-build React app (`green-radius.jsx`, compiled in-browser by `@babel/standalone`). There is an existing modal pattern, `QuestionModal`: a fixed full-screen overlay with a blurred backdrop and a cream card, animated with the `qm-fade` + `qm-up` keyframes (defined in `index.html`).
- This feature reuses that modal's visual shell but adds explicit dismissal. `QuestionModal` is closed by completing it; an informational modal needs a close button, a backdrop click, and Escape.

## In scope

1. `FaqButton`: a compact, centered button labeled "FAQ" (with a small "?" glyph) in a distinct blue, placed between the intro block and the first tile, on the home screen only.
2. `FaqModal`: a dismissable popup showing all seven Q&As expanded in a single vertical scroll, titled "Frequently Asked Questions."
3. The FAQ content (seven questions, copy below).
4. Dismissal via close button, backdrop click, and Escape, with basic focus management.

## Out of scope

- Showing the FAQ trigger on any screen other than the home screen.
- An accordion / collapsible layout (considered and rejected; all answers stay expanded).
- Routing or deep-linking to the FAQ (no URL change).
- Automated tests (the project has none; not introducing a harness here).
- Any change to `QuestionModal`'s existing behavior.

## Related change (same branch): sector icon swap

Separate from the FAQ, this branch also swaps the six `SectorIcon` glyphs for the cleaner set from the reference app (food fork & knife, power solid bolt, shelter tent, transport bus-front, waste recycle, water droplet), **lifted as-is rather than restyled**. Two details to lock at build time: (a) source the exact glyphs (the reference set matches Phosphor Icons, MIT-licensed: ForkKnife, Lightning, Tent, Bus, Recycle, Drop) or trace them from the reference; (b) render them in the wheel's existing single-color treatment. This is a small, self-contained edit to the `SectorIcon` component with no data or flow changes. It rides in this branch per the one-PR batching preference but is documented separately because it is orthogonal to the FAQ.

## Visual direction

### FaqButton (home screen)

- **Placement:** centered, in the vertical gap between the intro block (kicker / headline / icon row / subtitle) and the first tile ("Play the Game").
- **Style (solid):** a blue pill. Background `#3B7DD8`, white label, layered press shadow `0 4px 0 #2C5DA0` (the app's button convention), `border-radius: 999px`, compact padding (~`8px 17px`), `font-weight: 700`, `font-size: ~13px`. A small "?" glyph sits in a translucent-white circle before the word "FAQ".
- The blue is intentional: it lives outside the green/brown palette so the button reads as secondary "help," not a primary action, and it stays visibly smaller than the two tiles. The exact shade is easy to retune.
- `:active` mirrors the app's press feel (shadow collapses, slight `translateY`); respects `prefers-reduced-motion`.

### FaqModal

- Reuses the `QuestionModal` shell: fixed overlay `inset: 0`, backdrop `rgba(20,12,8,0.55)` + `backdrop-filter: blur(6px)`, a centered cream card (`#fcfaf4`, `border-radius: 24`, `padding: ~22-26`, `max-width: 400`, `box-shadow: 0 24px 60px rgba(0,0,0,0.4)`), `max-height: 92vh`, `overflow-y: auto`, animated with `qm-fade` (0.25s) + `qm-up` (0.3s).
- **Header** (sticky to the top of the scroll): kicker `GREEN RADIUS`, title **"Frequently Asked Questions"** (weight 700, ~21px), and a circular **✕** close button at top-right.
- **Body:** the seven Q&As, each a bold question followed by its answer paragraph, separated by thin dividers (`rgba(42,38,32,0.10)`). All expanded; the card scrolls.
- The Resource Guide answer ends with a green link-button ("Open the Resource Guide →") that opens the guide in a new tab. The report answer carries a `mailto:` link.

## Components and state

All in `green-radius.jsx` (single-file pattern).

| Component | Status | Purpose | Props |
|---|---|---|---|
| `FaqButton` | new | The blue FAQ pill | `onClick`, `palette` |
| `FaqModal` | new | The dismissable popup | `onClose`, `palette` |
| `ModePicker` | existing | Holds `faqOpen` state; renders `FaqButton` between the intro and the tiles, and `FaqModal` when open | (unchanged signature) |

- **State:** `const [faqOpen, setFaqOpen] = useState(false)`, local to `ModePicker`. Because `ModePicker` only mounts on the home screen, the FAQ is automatically home-only with no extra guards.
- `FaqButton` sets `faqOpen` true; every close path in `FaqModal` sets it false.
- The FAQ content is a module-level array `FAQ_ITEMS` of `{ q, a }`, where `a` is JSX (so the Resource Guide and email links render). `FaqModal` maps over it.

## Dismissal and accessibility

- **Close paths:** the ✕ button, a click on the backdrop (not the card), and the `Escape` key (a `keydown` listener mounted while open).
- **Focus:** on open, move focus into the dialog (the ✕ button); on close, return focus to `FaqButton`. Keep focus within the dialog while open where practical.
- `FaqButton`: a real `<button>` with `aria-haspopup="dialog"` and `aria-expanded={faqOpen}`.
- `FaqModal`: `role="dialog"`, `aria-modal="true"`, labelled by the title element; the ✕ has `aria-label="Close"`.
- **Links:** the Resource Guide link uses `target="_blank"` + `rel="noopener noreferrer"`; the report address is a `mailto:`.
- Respect `prefers-reduced-motion` for the open animation (the app already gates motion elsewhere).

## Babel scope note

`FaqButton` and `FaqModal` are defined and used only within `green-radius.jsx`, so they are referenced by bare name inside the same `text/babel` scope (no `window` export needed). This is the established pattern and sidesteps the shared-scope pitfall that previously bit the `/result/` page.

## FAQ content (final copy)

Seven items, in this order. No em dashes.

1. **What is the Green Radius?**
   A six-spoke snapshot of your camp's sustainability, one spoke each for food, water, waste, power, transport, and shelter. The more green choices you've already made in an area, the further that spoke reaches. Together, the six make up your camp's Green Radius.

2. **How do I play?**
   Spin the wheel to draw a sector, then answer its yes/no questions, working up four tiers from easiest to hardest. Your streak of consecutive "green" answers sets how far that sector reaches. Six spins (one per sector) complete your Green Radius.

3. **Do I need to both play the game and fill out the form?**
   Nope! They're two ways through the same assessment, so just pick one. The game is the playful path; the form is the familiar one: the classic questionnaire in a single list. Either way, you end up with the same Green Radius.

4. **What happens to my results?**
   When you finish, you'll see your Green Radius and can email yourself a shareable results card. Add your camp's details and your results join the community tally, so we can celebrate progress together. It's an honor-system self-assessment: no proof required, just answer honestly.

5. **What's happening to BLAST?**
   Nothing's disappearing; it's evolving. The Green Radius *is* BLAST, in a more playable form: the same six-area framework and the same goals. You're still measuring your camp's "blast radius," just with a wheel instead of a worksheet. All the original BLAST guidance lives on in the Resource Guide below.

6. **Where can I learn more?**
   Dig into the full guidance for every area and tier in the Green Theme Camp Community's Resource Guide.
   → link button "Open the Resource Guide →" to `https://www.greenthemecampcommunity.org/resource-guide`

7. **How do I report an issue or suggest an improvement?**
   Found a bug or have an idea to make this better? We'd love to hear it. Email `greenthemecamps@burningman.org`.
   → the address is a `mailto:greenthemecamps@burningman.org` link

## Edge cases

1. Open FAQ, then click the backdrop / press Escape / click ✕ → closes, focus returns to the button.
2. Long content on a short viewport → the card scrolls (`max-height: 92vh`, `overflow-y: auto`); the sticky header keeps the title and ✕ reachable.
3. The FAQ never appears mid-game (only `ModePicker` renders it), so it cannot collide with the wheel or other overlays.
4. localStorage: no schema change; `STORAGE_VERSION` is untouched (the FAQ holds no persisted state).
5. Reduced motion: the open animation is suppressed; the modal still appears and dismisses.

## Testing (manual, browser)

- Home screen shows the blue FAQ pill between the intro and the first tile; it does not appear once you enter a game mode or the form.
- Click FAQ → modal opens with all seven answers; scroll through them.
- Close via ✕, backdrop, and Escape; focus returns to the button each time.
- Resource Guide link opens the guide in a new tab; the email link opens a mail composer to `greenthemecamps@burningman.org`.
- Keyboard: Tab reaches the FAQ button; Enter opens it; focus lands in the dialog; Escape closes.
- Reduced-motion emulation: open and close still work without the slide.
- After the icon swap, the six sector icons render correctly on the wheel and labels (food reads as fork & knife, etc.).

## Future considerations

- If the FAQ grows much longer, revisit accordion vs. flat.
- A persistent "?" on other screens could be added later if users want help mid-flow (deliberately omitted now).
- A deep link (e.g. `#faq`) if sharing a specific answer ever matters.

## Open questions

None. The exact blue shade and the icon glyph source are minor implementation details to finalize during the build.
