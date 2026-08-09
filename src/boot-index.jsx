// Page boot for index.html (the game). Compiled to dist/src/boot-index.js and
// loaded last, after the game-UI modules. GreenRadiusGame / FxLayer are defined
// in the other game scripts and referenced here by bare name (shared global
// scope), exactly as when this ran as an inline text/babel script.
const PALETTE = {
  label: 'Alkali Flat',
  bg: '#ede9e0',
  canvas: '#2a2620',
  card: '#fcfaf4',
  text: '#2a2620',
  heading: '#2a2620',
  hub: '#3a3128',
  hubStroke: '#4a4036',
  accent: '#7AB85C',
  // Two WCAG-AA action greens, each the LIGHTEST that passes its own use:
  // accentDark fills sit under white labels (4.62:1) and may carry large text
  // on the tan bg (3.83:1, >= 3:1); accentText is for small green text, where
  // the tan bg #ede9e0 is the binding surface (4.56:1; even accentDark fails
  // there at 3.83). accentDeep is the .grg-press "foot" shadow under
  // accentDark fills (a foot the same color as its fill disappears).
  accentDark: '#558040',
  accentText: '#4c7339',
  accentDeep: '#38542b',
};

function App() {
  return (
    <div className="grg-shell">
      <div className="grg-frame">
        <GreenRadiusGame palette={PALETTE}/>
      </div>
      <FxLayer/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
