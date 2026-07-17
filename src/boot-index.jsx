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
  // accentDark doubles as the fill under white CTA labels and as green text on
  // the tan/card surfaces, so it must clear WCAG AA (4.5:1) against all three:
  // white labels on it, and it on #ede9e0 / #fcfaf4. #4c7339 is the lightest
  // green in this hue that does. accentDeep is the .grg-press "foot" shadow
  // under accentDark fills (a foot the same color as its fill disappears).
  accentDark: '#4c7339',
  accentDeep: '#38542b',
};

function App() {
  return (
    <div className="grg-shell">
      <div className="grg-frame">
        <GreenRadiusGame variant="flat-playa" palette={PALETTE}/>
      </div>
      <FxLayer/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
