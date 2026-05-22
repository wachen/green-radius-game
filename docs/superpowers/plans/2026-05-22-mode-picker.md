# Mode Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single `Begin →` CTA on the intro screen with two distinct entry points (board game / form-based), per the approved spec at `docs/superpowers/specs/2026-05-22-mode-picker-design.md`.

**Architecture:** Two new React components (`ModePicker`, `FormComingSoon`) added to `green-radius.jsx`. The existing `phase` state machine inside `GreenRadiusGame` widens by two values (`'pick-mode'`, `'form-coming-soon'`). The localStorage schema (version 1) is unchanged — existing saves continue to hydrate exactly as before.

**Tech Stack:** Inline JSX in `green-radius.jsx`, transpiled in-browser by `@babel/standalone`. No build step. No test framework. Manual verification by running `python3 -m http.server 8000` from the repo root and walking through the UI.

---

## File Structure

This work touches a single file:

- **Modified:** `green-radius.jsx` — adds two new components and updates the `GreenRadiusGame` phase state machine. File grows by approximately 150 lines.

No new files. No CSS extraction. Consistent with the existing single-file pattern.

## Verification approach

The project has no automated test framework, so each task ends with a **manual verification** step instead of a `pytest` run. Verification = serve `index.html` locally, walk through specific UI paths in a browser, and inspect `localStorage` in DevTools.

Start a local server in one terminal (leave it running through the whole plan):

```bash
cd /Users/wes/Library/Mobile\ Documents/com~apple~CloudDocs/All\ The\ Files/Claude/Green\ Radius\ Game/green-radius-game
python3 -m http.server 8000
```

Open http://localhost:8000 in a browser. Reload after every edit. Use DevTools → Application → Local Storage → `http://localhost:8000` to inspect / clear the `green-radius-game/v1` key as needed.

---

## Task 1: Add `FormComingSoon` component (isolated, not reachable yet)

This component is added first because it's small, has no side effects, and adding it without wiring proves the file is still syntactically valid before the bigger ModePicker change.

**Files:**
- Modify: `green-radius.jsx` — insert new component immediately before `function Intro({ onStart, palette })` (currently line 650).

- [ ] **Step 1: Insert the component**

Place the following code at the start of line 650 (so it precedes `function Intro`):

```jsx
// ─── form-coming-soon stub ───────────────────────────────────────────────────
function FormComingSoon({ onBack, palette }) {
  return (
    <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
        color: palette.accent, marginBottom: 12,
      }}>GREEN THEME CAMP COMMUNITY</div>
      <h1 style={{
        fontSize: 44, lineHeight: 1, fontWeight: 900, margin: '0 0 24px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        Green<br/>Radius
      </h1>

      <svg viewBox="0 0 60 60" width="64" height="64" fill="none"
        stroke={palette.text} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true" style={{ margin: '8px auto 0', display: 'block' }}>
        <line x1="14" y1="6" x2="46" y2="6"/>
        <line x1="14" y1="54" x2="46" y2="54"/>
        <path d="M16 6 L44 6 L44 18 L30 30 L44 42 L44 54 L16 54 L16 42 L30 30 L16 18 Z"/>
        <line x1="22" y1="48" x2="38" y2="48" strokeWidth="5"/>
      </svg>

      <div style={{
        fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em',
        color: palette.heading, margin: '20px 0 8px',
      }}>
        Form mode is coming soon
      </div>

      <div style={{
        fontSize: 14, lineHeight: 1.5, color: palette.text + 'aa',
        maxWidth: 280, margin: '0 auto 28px',
      }}>
        Sixty yes/no sustainability questions in one linear form. No wheel, just speed.
      </div>

      <button
        onClick={onBack}
        aria-label="Back to mode picker"
        style={{
          width: '100%', padding: '16px', borderRadius: 14,
          border: `1.5px solid ${palette.text}22`, background: 'transparent',
          color: palette.text, fontSize: 14, fontWeight: 800,
          letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >← Back to mode picker</button>
    </div>
  );
}

```

- [ ] **Step 2: Verify the page still loads cleanly**

Reload http://localhost:8000 in the browser. Expected behavior:
- Page renders exactly as before (intro screen with single Begin button — `FormComingSoon` is defined but not yet referenced).
- DevTools Console shows no syntax errors and no warnings from Babel/React.

If the page renders blank or the console shows a syntax error, the component is malformed — review the JSX before continuing.

- [ ] **Step 3: Commit**

```bash
git add green-radius.jsx
git commit -m "$(printf 'Add FormComingSoon stub component (not yet wired)\n\nPlaceholder screen for the upcoming form-based play mode. Component\nis defined but not yet reachable from the UI — wired up in the next\ncommit when the mode picker lands.\n')"
```

---

## Task 2: Add `ModePicker` component and wire the phase state machine

This is the largest task. It introduces the new picker, flips the default phase, adds two render branches, and widens the save-clearing effect.

**Files:**
- Modify: `green-radius.jsx` — insert `ModePicker` immediately before `FormComingSoon` (i.e., before the `// ─── form-coming-soon stub ───` comment from Task 1).
- Modify: `green-radius.jsx:726` — default phase value.
- Modify: `green-radius.jsx:763` — widen the `clearSaved` useEffect condition.
- Modify: `green-radius.jsx:854` — add new render branches before the existing `phase === 'intro'` check.

- [ ] **Step 1: Insert the `ModePicker` component**

Place this immediately before the `// ─── form-coming-soon stub ───` block from Task 1:

```jsx
// ─── mode picker ─────────────────────────────────────────────────────────────
function ModePicker({ onPick, palette }) {
  const tileBase = {
    display: 'block', width: '100%', border: 'none', cursor: 'pointer',
    padding: '22px 16px', borderRadius: 18, marginBottom: 12,
    textAlign: 'center', fontFamily: 'inherit',
  };
  return (
    <div style={{ padding: '40px 24px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
        color: palette.accent, marginBottom: 12,
      }}>GREEN THEME CAMP COMMUNITY</div>
      <h1 style={{
        fontSize: 44, lineHeight: 1, fontWeight: 900, margin: '0 0 8px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        Green<br/>Radius
      </h1>
      <div style={{
        fontSize: 15, lineHeight: 1.5, color: palette.text + 'cc',
        marginBottom: 32, textWrap: 'pretty',
      }}>
        Find your camp's footprint across six sustainability sectors. Pick a way to play.
      </div>

      <button
        onClick={() => onPick('board')}
        aria-label="Play the game in board game mode"
        style={{
          ...tileBase,
          background: palette.accent, color: '#fff',
          boxShadow: `0 5px 0 ${palette.accentDark}`,
        }}
      >
        <svg viewBox="0 0 60 60" width="56" height="56" fill="none"
          stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
          aria-hidden="true" style={{ display: 'block', margin: '0 auto 10px' }}>
          <circle cx="30" cy="30" r="22"/>
          <line x1="30" y1="8" x2="30" y2="52"/>
          <line x1="8" y1="30" x2="52" y2="30"/>
          <line x1="14.5" y1="14.5" x2="45.5" y2="45.5"/>
          <line x1="14.5" y1="45.5" x2="45.5" y2="14.5"/>
          <circle cx="30" cy="30" r="5" fill="currentColor" stroke="none"/>
          <polygon points="30,3 24,12 36,12" fill="currentColor" stroke="none"/>
        </svg>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
          Play the Game
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', opacity: 0.75,
        }}>
          Board Game · Fun
        </div>
      </button>

      <button
        onClick={() => onPick('form')}
        aria-label="Play the game in form-based mode"
        style={{
          ...tileBase,
          background: palette.card, color: palette.text,
          boxShadow: '0 5px 0 #d8d2c2',
        }}
      >
        <svg viewBox="0 0 60 60" width="56" height="56" fill="none"
          stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"
          aria-hidden="true" style={{ display: 'block', margin: '0 auto 10px' }}>
          <rect x="14" y="12" width="32" height="42" rx="3"/>
          <rect x="22" y="6" width="16" height="10" rx="2" fill="currentColor" stroke="none"/>
          <rect x="19" y="24" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
          <line x1="30" y1="28" x2="42" y2="28"/>
          <rect x="19" y="36" width="7" height="7" rx="1.5" fill="currentColor" stroke="none"/>
          <line x1="30" y1="40" x2="42" y2="40"/>
          <rect x="19" y="48" width="7" height="7" rx="1.5"/>
        </svg>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
          Play the Game
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', opacity: 0.75,
        }}>
          Form-based · Quick
        </div>
      </button>

      <div style={{
        fontSize: 10, letterSpacing: '0.15em',
        color: palette.text + '66', marginTop: 24, fontWeight: 600,
      }}>
        6 SECTORS · 4 LEVELS · 10 QUESTIONS
      </div>
    </div>
  );
}

```

- [ ] **Step 2: Flip the default phase to `'pick-mode'`**

In `green-radius.jsx` find line 726:

```jsx
  const [phase, setPhase] = useState(saved?.phase || 'intro'); // intro | playing | done
```

Replace with:

```jsx
  const [phase, setPhase] = useState(saved?.phase || 'pick-mode'); // pick-mode | intro | playing | done | form-coming-soon
```

- [ ] **Step 3: Widen the `clearSaved` effect condition**

In `green-radius.jsx` find line 763:

```jsx
    if (phase === 'intro') {
      clearSaved();
      return;
    }
```

Replace with:

```jsx
    if (phase === 'intro' || phase === 'pick-mode') {
      clearSaved();
      return;
    }
```

- [ ] **Step 4: Add the two new render branches**

In `green-radius.jsx` find line 854 (the existing `if (phase === 'intro')` check). Insert two new branches **before** it:

```jsx
  if (phase === 'pick-mode') {
    return (
      <ModePicker
        onPick={(mode) => setPhase(mode === 'board' ? 'intro' : 'form-coming-soon')}
        palette={palette}
      />
    );
  }

  if (phase === 'form-coming-soon') {
    return <FormComingSoon onBack={() => setPhase('pick-mode')} palette={palette}/>;
  }

  if (phase === 'intro') {
    return <Intro onStart={startGame} palette={palette}/>;
  }
```

- [ ] **Step 5: Manual verification**

Reload http://localhost:8000. With DevTools Console open:

1. `localStorage.clear()` then reload → expect the mode picker (NOT the camp form). Two big tiles visible: green "Play the Game / Board Game · Fun" and cream "Play the Game / Form-based · Quick".
2. Click the green tile → expect the existing camp-info form (still says `Begin →`).
3. `localStorage.clear()` then reload again. Click the cream tile → expect the "Form mode is coming soon" screen with hourglass icon.
4. Click `← Back to mode picker` → expect to land back on the picker.
5. With the picker shown, run `localStorage.getItem('green-radius-game/v1')` in the console → expect `null` (picker should not be persisted; the widened `clearSaved` effect fires immediately on `'pick-mode'`).
6. Pick board → fill camp name → click Begin → spin once. Refresh the page. Expect to land back on the wheel mid-game (the localStorage hydration path still works for saved `'playing'` state).

If any of these fail, do not commit — review the relevant step.

- [ ] **Step 6: Commit**

```bash
git add green-radius.jsx
git commit -m "$(printf 'Add ModePicker and wire pick-mode / form-coming-soon phases\n\nFresh users now land on a two-button picker (board game vs form-based)\ninstead of the camp-info form. Existing saves continue to hydrate\nstraight to their saved phase (intro / playing / done), so anyone\nmid-game keeps their progress. STORAGE_VERSION is unchanged.\n\n- New ModePicker and FormComingSoon components.\n- Default phase: pick-mode (was intro).\n- clearSaved effect now fires on both pick-mode and intro.\n- form-coming-soon is a persisted phase: refresh keeps you there.\n')"
```

---

## Task 3: Update "New Camp" handler and trim the Intro tagline

**Files:**
- Modify: `green-radius.jsx:879` — change `setPhase('intro')` inside the New Camp button handler to `setPhase('pick-mode')`.
- Modify: `green-radius.jsx:669` — trim the existing Intro tagline.

- [ ] **Step 1: Update the "New Camp" handler**

In `green-radius.jsx` find line 879 — it's a long inline arrow function on the New Camp button. Currently:

```jsx
          <button onClick={() => { setLevelStates(initState); setSectorCursor(() => { const o={}; sectors.forEach(s=>o[s.id]=0); return o; }); setSectorClosed(() => { const o={}; sectors.forEach(s=>o[s.id]=false); return o; }); setPhase('intro'); }}
```

Change the final `setPhase('intro')` to `setPhase('pick-mode')`:

```jsx
          <button onClick={() => { setLevelStates(initState); setSectorCursor(() => { const o={}; sectors.forEach(s=>o[s.id]=0); return o; }); setSectorClosed(() => { const o={}; sectors.forEach(s=>o[s.id]=false); return o; }); setPhase('pick-mode'); }}
```

- [ ] **Step 2: Trim the Intro tagline**

In `green-radius.jsx` find line 669:

```jsx
        Spin the wheel. Answer honestly. Discover your camp's unique footprint across six sustainability sectors.
```

Replace with:

```jsx
        Spin the wheel. Answer honestly.
```

- [ ] **Step 3: Manual verification**

Reload http://localhost:8000.

1. Pick board → confirm the camp-info screen shows the trimmed tagline `Spin the wheel. Answer honestly.` (no second sentence).
2. To verify the New Camp transition, you have two options:
   - **Quickest:** in DevTools Console run `localStorage.setItem('green-radius-game/v1', JSON.stringify({version: 1, phase: 'done', camp: {campName: 'Test Camp', leadName: '', year: '2026'}, levelStates: window.SECTORS.reduce((o,s) => (o[s.id]=['green','green','green','green'], o), {}), sectorCursor: window.SECTORS.reduce((o,s) => (o[s.id]=4, o), {}), sectorClosed: window.SECTORS.reduce((o,s) => (o[s.id]=true, o), {})}))` then reload — the page should land directly on the done screen.
   - **Slow:** actually play through the full game until you reach the done screen.
3. From the done screen click `New Camp` → expect to land on the **mode picker** (NOT the camp-info form). Run `localStorage.getItem('green-radius-game/v1')` → expect `null`.

- [ ] **Step 4: Commit**

```bash
git add green-radius.jsx
git commit -m "$(printf 'Route New Camp to mode picker; trim Intro tagline\n\nNew Camp now resets all the way to the mode picker so the player gets\nthe full re-choice between board game and form modes.\n\nIntros tagline drops the redundant second sentence (the picker tagline\nshown moments earlier already covered sustainability sectors framing).\n')"
```

---

## Task 4: Open the pull request

The branch is `mode-picker`, already pushed to `origin` with the gitignore and spec commits from the brainstorming session.

- [ ] **Step 1: Verify branch state**

```bash
git log --oneline origin/main..HEAD
```

Expected output (top to bottom is newest first; exact shas will differ):
```
<sha> Route New Camp to mode picker; trim Intro tagline
<sha> Add ModePicker and wire pick-mode / form-coming-soon phases
<sha> Add FormComingSoon stub component (not yet wired)
<sha> Add design spec: mode picker (two-button intro)
<sha> Ignore .superpowers/ brainstorming session directory
```

- [ ] **Step 2: Push and open the PR**

```bash
git push origin mode-picker
gh pr create --repo wachen/green-radius-game --base main --head mode-picker \
  --title "Mode picker: two-button intro (board game / form-based)" \
  --body "$(cat <<'PRBODY'
## Summary
Replaces the single \`Begin →\` CTA on the intro screen with two distinct entry points:
- **Play the Game / Board Game · Fun** — leads to the existing wheel-based experience.
- **Play the Game / Form-based · Quick** — currently a static "coming soon" placeholder. Will eventually be a linear 60-question form (replaces a previously-used Google Form).

Mode-first intro: camp-info collection moves behind the board game tile. Existing localStorage saves continue to hydrate straight to their saved phase, so anyone mid-game keeps progress.

## Design
Full spec: [\`docs/superpowers/specs/2026-05-22-mode-picker-design.md\`](../blob/mode-picker/docs/superpowers/specs/2026-05-22-mode-picker-design.md)

## Test plan
- [ ] Clear localStorage, reload → picker visible
- [ ] Pick board game → camp form → Begin → wheel game
- [ ] Pick form-based → coming soon screen → back to picker
- [ ] Mid-game refresh → resumes on wheel (no picker re-prompt)
- [ ] Complete game → New Camp → lands on picker (not camp form)
- [ ] Refresh on coming-soon screen → still on coming-soon
- [ ] Keyboard: Tab to tiles, Enter activates
- [ ] DevTools prefers-reduced-motion → tile press still feels OK
PRBODY
)"
```

- [ ] **Step 3: Verify Cloudflare Workers Build picks it up**

After merging the PR, the Workers Builds integration auto-deploys. Confirm by curl:

```bash
curl -s https://greenradi.us/green-radius.jsx | grep -c "function ModePicker"
```

Expected: `1` (the deployed JSX now includes `ModePicker`).

Manually test the live site at https://greenradi.us to confirm the picker works in the real Cloudflare cache environment.

---

## Self-review (already done during writing — included here for traceability)

1. **Spec coverage** — every section of the spec maps to at least one task:
   - State machine extension → Task 2 (steps 2, 3, 4)
   - ModePicker component → Task 2 (step 1)
   - FormComingSoon component → Task 1 (step 1)
   - Intro tagline trim → Task 3 (step 2)
   - New Camp transition update → Task 3 (step 1)
   - Footer caption updated to per-sector framing → Task 2 (step 1, inside ModePicker JSX; the existing Intro screen footer at line 691 stays as `24 LEVELS · 60 QUESTIONS · 6 SECTORS` since that screen is no longer the first thing fresh users see and changing both would be a wider-than-spec scope; flagged here as a deliberate plan decision)
   - localStorage compatibility → Task 2 (step 2 preserves `saved?.phase ||` fallback)

2. **Placeholder scan** — no TBDs, TODOs, "implement later", or "similar to Task N" references. All code blocks are complete.

3. **Type consistency** — `onPick(mode)` receives `'board' | 'form'`; ModePicker calls with literal `'board'` / `'form'`. `onBack()` takes no arguments. `palette` is the same object passed throughout.

4. **Open question flagged** — the footer caption on the existing `Intro` screen (line 691) is left at `24 LEVELS · 60 QUESTIONS · 6 SECTORS` while ModePicker uses `6 SECTORS · 4 LEVELS · 10 QUESTIONS`. Strictly speaking the spec implied the per-sector framing across the board, but updating the Intro footer too would surprise reviewers with a copy churn beyond the picker work. If you want both screens aligned, change line 691 to match the picker footer as a fifth commit before opening the PR.
