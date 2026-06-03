# Done-screen flow: auto-email, PNG download, Exit — design

**Date:** 2026-06-03
**Scope:** `green-radius.jsx` only (the `phase === 'done'` screen + supporting helpers). No `index.html` / Worker / data changes.

## Problem

The result screen re-asks for the player's email (an editable `Field` + an "✉ Email my Green Radius" button) even though they already entered it on the camp-setup screen before playing. Players also can't save the result graphic, and the reset control reads "New Camp" without clearing the saved game.

## Changes

### 1. Auto-email on completion (no re-ask)
- On entering the `done` phase, fire `POST /api/complete` **once**, using `camp.email` (captured at start via `startGame`/`startForm`). This is the same endpoint the manual button used; it emails the result link (Resend) and logs the community-tally row (Google Sheet). Auto-firing matches the consent text shown at start.
- Guards: `submittedAt` (persisted in localStorage) prevents re-send across reloads; a `useRef` prevents double-fire within a session.
- The editable email `Field` and `doneEmail` state are removed. The field area becomes status text:
  - success (`submitState === 'done'` / `submittedAt`): **"Thank you for participating! Your results were sent to {email} (please check spam)."**
  - in flight (`idle`/`sending`): "Thank you for participating! Emailing your results to {email}…"
  - failure (`error`, e.g. Worker/Resend down): a graceful line that does **not** falsely claim it sent, pointing to Download / Share instead. (Honors CLAUDE.md's graceful-degradation rule.)

### 2. Download button (PNG of the result card)
- Replaces the email button. Label **"⬇ Download"**; saves `green-radius-<camp-slug>.png`.
- **Pure-SVG export, no dependency** (chosen over a foreignObject rasterizer like html-to-image for iOS Safari reliability and to keep the no-build, zero-dependency stack):
  - New `ResultCardSVG` component renders the card as a single self-contained `<svg>` (mirrors `ShareCard`: bg/glow gradients, logomark, `RadialBadge`, 6-sector breakdown, footer), reusing `RadialBadge`/`RadiusLogomark`/`SectorIcon` nested via `<g transform>`. A `fitCampName` helper wraps/clamps long names (SVG `<text>` doesn't wrap).
  - It's rendered **offscreen** (the on-screen card stays the existing HTML `ShareCard`, so the live card's styling/wrapping is untouched). `downloadSvgAsPng` serializes the node → Blob → `Image` → 2× canvas → `toBlob('image/png')` → `<a download>`.
  - **Best-effort font embedding:** `fontEmbedCss()` fetches Space Grotesk woff2 from Google Fonts and inlines it as a data-URI `@font-face` so the PNG matches the screen typeface; on any failure the SVG falls back to `system-ui` (still clean). Warmed on done-screen mount so Download is snappy. Never blocks/breaks the export.

### 3. "New Camp" → "Exit"
- Renamed to **"Exit"**. Explicitly calls `clearSaved()` (wipe localStorage), resets in-memory state (levels, cursors, answers, camp, submit state, auto-send ref), and returns to the home/mode-picker (`phase = 'pick-mode'`).

## Verification
- Parse gate: `bun build green-radius.jsx --external react … > /dev/null` exits 0.
- Headless Chromium (Bun + Playwright), game + form paths to the done screen:
  - auto `POST /api/complete` fires once with the start email; thank-you text shows that email; no email field rendered.
  - Download produces a non-trivial `image/png` (data URL / download event); card content present.
  - Exit clears `localStorage['green-radius-game/v1']` and lands on the mode picker.

## Out of scope
The standalone `/result/#…` share page; the two home-screen local PDF download links.
