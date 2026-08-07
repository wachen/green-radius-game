// src/home.jsx — home-screen FAQ/About modal + mode picker. Shared Babel scope; see src/core.jsx.

// ─── FAQ / About (home screen only) ─────────────────────────────────────────
// The modal is a designed "About the Game": why-this-exists, the six sectors,
// the four levels (in their live LEVEL_COLORS), results, then leftover Q&A.
// Link answers hard-code accent colors (the app has a single fixed palette).
// Light-to-dark green ramp for the six-wedge wheel mark (FAQ medallion and
// the "Play the Game" tile share it).
const WEDGE_COLORS = ['#A3D178', '#86C169', '#68B05C', '#56A85C', '#439F5B', '#31975B'];

const SECTOR_ONE_LINERS = {
  food: 'Purchase mindfully, share cooking, cut food waste.',
  water: 'Drink it. Share it. Reuse it.',
  waste: 'Leave No Trace. Simple.',
  transport: 'Share rides, share stuff, shrink CO2e.',
  shelter: 'Sun, wind, dust, and a good sleep even by day.',
  power: 'Reduction first, alternative sources second.',
};

const LEVEL_ROWS = [
  { name: 'Start Here', count: '1 question', blurb: 'The one thing every camp can do' },
  { name: 'Beginner', count: '2 questions', blurb: 'Easy wins with big reach' },
  { name: 'Intermediate', count: '3 questions', blurb: 'Takes planning, pays off' },
  { name: 'Advanced', count: 'up to 4 topics', blurb: 'Pick your own, or write one in' },
];

const FAQ_ITEMS = [
  {
    q: 'Do I need to both play the game and fill out the form?',
    a: "Nope! Pick one; they're two paths through the same assessment. The game is the playful way, the form is the classic questionnaire in a single list. Same Green Radius either way.",
  },
  {
    q: "What's happening to BLAST?",
    a: (
      <>Nothing's disappearing; it's evolving. The Green Radius <em>is</em> BLAST in a more playable form: same six-area framework, same goals. You're still measuring your camp's "blast radius," just with a wheel instead of a worksheet. All the original BLAST guidance lives on in the Resource Guide below.</>
    ),
  },
  {
    q: 'How do I report an issue or suggest an improvement?',
    a: (
      <>Found a bug or have an idea? We'd love to hear it. Email <a href={'mailto:' + REPORT_EMAIL} style={{ color: '#4c7339', fontWeight: 700, textDecoration: 'none', borderBottom: '1.5px solid rgba(76,115,57,0.4)' }}>{REPORT_EMAIL}</a>.</>
    ),
  },
];

// Monoline icon set for the About modal's section headers, matching
// SectorIcon's exact stroke idiom so the guide reads as line icons rather
// than colorful emoji.
function AboutIcon({ kind, size = 15, color = '#558040' }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const svgProps = { width: size, height: size, viewBox: '0 0 24 24' };
  switch (kind) {
    case 'why': // lightbulb — purpose / the idea
      return <svg {...svgProps}><path {...p} d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path {...p} d="M9 18h6"/><path {...p} d="M10 22h4"/></svg>;
    case 'sectors': // hexagon — six sides = six sectors
      return <svg {...svgProps}><path {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
    case 'levels': // four ascending bars = four levels
      return <svg {...svgProps}><path {...p} d="M4 20V14"/><path {...p} d="M9.33 20V11"/><path {...p} d="M14.67 20V8"/><path {...p} d="M20 20V5"/></svg>;
    case 'results': // award rosette — your standing / result
      return <svg {...svgProps}><path {...p} d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle {...p} cx="12" cy="8" r="6"/></svg>;
    case 'questions': // chat bubble with a question mark
      return <svg {...svgProps}><path {...p} d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/><path {...p} d="M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3"/><path {...p} d="M12 17h.01"/></svg>;
    default: return null;
  }
}

// Section header for the About modal: a small tinted chip + title + a roman-
// numeral mark, echoing the sector-chip language used across the app. A
// hairline above each entry (after the first) gives the guide a bound,
// page-turning rhythm instead of a stack of divs.
function AboutSection({ icon, title, mark, divider, palette, children }) {
  return (
    <div style={{
      marginTop: 14, paddingTop: divider ? 14 : 0,
      borderTop: divider ? '1px solid ' + palette.text + '14' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
        <span aria-hidden="true" style={{
          width: 27, height: 27, borderRadius: 8, background: '#7AB85C26',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}><AboutIcon kind={icon} /></span>
        <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', flex: 1 }}>{title}</span>
        {mark && (
          <span aria-hidden="true" style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', color: palette.text + '59' }}>{mark}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function FaqButton({ onClick, palette, btnRef, expanded }) {
  return (
    <button
      ref={btnRef}
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={!!expanded}
      className="grg-press-sm"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        flex: 1,
        background: '#3B7DD8', color: '#fff', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em',
        padding: '8px 17px', borderRadius: 999, '--grg-sh': '#2C5DA0',
      }}
    >
      <span aria-hidden="true" style={{
        width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800,
      }}>?</span>
      FAQ
    </button>
  );
}

function CityStatsButton({ palette }) {
  return (
    <a
      href="/city/"
      aria-label="See the city's progress"
      className="grg-press-sm"
      style={{
        flex: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        // Terracotta echoes the city card's warm dust-glow (a warm counterpoint
        // to the green Play tile and blue FAQ beside it, and it pops on the tan).
        background: '#C36A3C', color: '#fff', border: 'none', cursor: 'pointer',
        fontFamily: 'inherit', fontWeight: 700, fontSize: 13, letterSpacing: '0.02em',
        padding: '8px 17px', borderRadius: 999, textDecoration: 'none',
        '--grg-sh': '#8C4726',
      }}
    >
      <span aria-hidden="true" style={{
        width: 16, height: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.28)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" width="10.5" height="10.5" fill="none" stroke="#fff"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true" style={{ display: 'block' }}>
          <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
          <polyline points="17 6 23 6 23 12"/>
        </svg>
      </span>
      City Stats
    </a>
  );
}

function FaqModal({ onClose, palette }) {
  const closeRef = useRef(null);
  const dialogRef = useRef(null);
  useModalA11y(dialogRef); // scroll-lock + Tab focus trap
  // Focus the close button once on open; keep the Escape listener in its own
  // effect so a changing onClose can't re-trigger the focus.
  useEffect(() => { closeRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(20,12,8,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex',
        padding: 16, animation: 'qm-fade 0.25s ease',
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog" aria-modal="true" aria-labelledby="faq-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: palette.card, color: palette.text, textAlign: 'left',
          borderRadius: 24, padding: '0 22px 14px',
          maxWidth: 400, width: '100%', margin: 'auto',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
          animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          position: 'sticky', top: 0, zIndex: 5, background: palette.accentDark,
          margin: '0 -22px', padding: '18px 22px 13px', borderRadius: '24px 24px 0 0',
          marginBottom: 4, textAlign: 'center',
          boxShadow: '0 8px 16px -10px rgba(0,0,0,0.35)',
        }}>
          {/* Small wheel mark: the app's signature radial motif, echoed once
              here as the modal's one deliberate flourish. Same wedge-path
              math and coloring as the "Play the Game" tile (minus its
              pointer notch), shrunk to a medallion so it reads clean on the
              cream card the way it does on the tile's solid green. */}
          <svg viewBox="0 0 64 64" width="26" height="26" aria-hidden="true" style={{ display: 'block', margin: '0 auto 6px' }}>
            <circle cx="32" cy="33" r="26" fill={palette.accent}/>
            {WEDGE_COLORS.map((c, i) => {
              const a0 = (i * 60 - 90) * Math.PI / 180;
              const a1 = ((i + 1) * 60 - 90) * Math.PI / 180;
              const r = 23;
              return (
                <path key={i} fill={c} stroke="#fff" strokeWidth="1.6" strokeLinejoin="round"
                  d={`M32 33 L${32 + r * Math.cos(a0)} ${33 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${32 + r * Math.cos(a1)} ${33 + r * Math.sin(a1)} Z`}/>
              );
            })}
            <circle cx="32" cy="33" r="23" fill="none" stroke="#fff" strokeWidth="2"/>
            <circle cx="32" cy="33" r="3.4" fill={palette.text}/>
          </svg>
          <div style={{ fontSize: 10, letterSpacing: '0.25em', fontWeight: 700, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase' }}>Green Radius</div>
          <div id="faq-title" style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 3, padding: '0 30px', color: palette.card }}>About the Game</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4, padding: '0 30px' }}>How the game works, in four parts</div>
          <button
            ref={closeRef} onClick={onClose} aria-label="Close" className="grg-hit44"
            style={{ position: 'absolute', top: 12, right: 22, border: 'none', background: 'rgba(255,255,255,0.16)', width: 40, height: 40, borderRadius: '50%', fontSize: 15, cursor: 'pointer', color: palette.card, lineHeight: 1 }}
          >✕</button>
        </div>

        <AboutSection icon="why" title="Why this exists" mark="#1" palette={palette}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: palette.text + 'd1', textWrap: 'pretty' }}>
            The playa doesn't need another form. The Green Radius is not a compliance
            audit; it's a mirror. See where your camp stands across six sustainability
            sectors, celebrate what you already do well, and discover what's possible
            next. The greener your choices, the further your radius reaches. And every
            segment one camp lights nudges the whole city greener.
          </div>
        </AboutSection>

        <AboutSection icon="sectors" title="The six sectors" mark="#2" divider palette={palette}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
            {window.SECTORS.map(s => (
              <div key={s.id} style={{
                border: '1px solid ' + palette.text + '14', borderRadius: 14,
                background: palette.text + '06', padding: '9px 11px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                  <span aria-hidden="true" style={{
                    width: 22, height: 22, borderRadius: 7, background: '#7AB85C1f',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <SectorIcon kind={s.icon} size={13} color="#558040"/>
                  </span>
                  <span style={{ fontWeight: 800, fontSize: 12.5 }}>{s.name}</span>
                </div>
                <div style={{ fontSize: 11.5, lineHeight: 1.45, color: palette.text + 'b3' }}>
                  {SECTOR_ONE_LINERS[s.id]}
                </div>
              </div>
            ))}
          </div>
        </AboutSection>

        <AboutSection icon="levels" title="Four levels per sector" mark="#3" divider palette={palette}>
          <div style={{ position: 'relative' }}>
            {/* A quiet progression rail strung behind the numbered chips,
                from Level 1's color through Level 4's, so the legend reads
                as a path rather than four unrelated rows. */}
            <div aria-hidden="true" style={{
              position: 'absolute', left: 11, top: 18, bottom: 18, width: 2,
              borderRadius: 2, background: 'linear-gradient(' + LEVEL_COLORS.join(',') + ')', opacity: 0.35,
            }}/>
            {LEVEL_ROWS.map((lv, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', position: 'relative' }}>
                <span aria-hidden="true" style={{
                  width: 24, height: 24, borderRadius: 7, background: LEVEL_COLORS[i],
                  color: '#fff', fontSize: 12, fontWeight: 800, flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 0 3px ' + palette.card,
                }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{lv.name}</div>
                  <div style={{ fontSize: 11, color: palette.text + '80', marginTop: 1 }}>{lv.blurb}</div>
                </div>
                <span style={{ fontSize: 11.5, color: palette.text + '99', flexShrink: 0, paddingLeft: 8, textAlign: 'right' }}>{lv.count}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.5, color: palette.text + 'b3', marginTop: 6, textWrap: 'pretty' }}>
            Every yes lights its own segment: 10 per sector, 60 total. An early no never
            blocks later progress, and Level 4 is optional extra credit with a write-in
            slot for your camp's own idea.
          </div>
        </AboutSection>

        <AboutSection icon="results" title="Your results" mark="#4" divider palette={palette}>
          <div style={{ fontSize: 13.5, lineHeight: 1.5, color: palette.text + 'd1', textWrap: 'pretty' }}>
            When you finish, you'll see your Green Radius and get your shareable results
            card plus a personal Green-Up Plan by email. Your results join the community
            tally, so we can celebrate progress together. It's an honor-system
            self-assessment: no proof, just honesty.
          </div>
        </AboutSection>

        <AboutSection icon="questions" title="More questions" divider palette={palette}>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} style={{
              borderTop: i === 0 ? 'none' : '1px solid ' + palette.text + '1a',
              paddingTop: i === 0 ? 0 : 10, paddingBottom: i === FAQ_ITEMS.length - 1 ? 0 : 10,
            }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{item.q}</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: palette.text + 'd1' }}>{item.a}</div>
            </div>
          ))}
        </AboutSection>

        {/* Back cover: closes the guide with the same hairline rhythm used
            between sections above, plus one small utility-label eyebrow to
            bookend the masthead at the top. */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid ' + palette.text + '14' }}>
          <div style={{
            padding: '14px 14px', borderRadius: 16, textAlign: 'center',
            background: '#7AB85C14', border: '1px solid #7AB85C33',
          }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', fontWeight: 700, color: '#4c7339', textTransform: 'uppercase', marginBottom: 6 }}>Learn More</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: palette.text + 'd1', marginBottom: 10, textWrap: 'pretty' }}>
              Full guidance for every sector and level lives in the Green Theme Camp
              Community's Resource Guide.
            </div>
            <a href={RESOURCE_GUIDE_URL} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-block',
              background: '#558040', color: '#fff', fontWeight: 700, fontSize: 13,
              padding: '9px 14px', borderRadius: 11, boxShadow: '0 4px 0 #38542b',
              textDecoration: 'none',
            }}>Open the Resource Guide →</a>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── mode picker ─────────────────────────────────────────────────────────────
// Signup-deadline announcement (BLAST 2026), home screen only: a full-width
// strip across the top of the frame. Auto-hides once the deadline passes in
// Pacific time (Aug 11 00:00 PDT), so no removal deploy is needed and a stale
// banner can't linger. Purely presentational: no state, no storage, safe to
// roll out mid-season.
const SIGNUP_DEADLINE_END_MS = Date.UTC(2026, 7, 11, 7); // end of Aug 10 2026, PDT
function DeadlineBanner() {
  if (Date.now() >= SIGNUP_DEADLINE_END_MS) return null;
  return (
    <div data-deadline-banner role="status" style={{
      background: '#FBE3DE', color: '#8a2f25', borderBottom: '1px solid #F1C3BB',
      padding: '9px 16px', textAlign: 'center',
      fontSize: 13, lineHeight: 1.4, fontWeight: 600, textWrap: 'pretty',
    }}>
      Sign up by <b>August 10</b> to be included on printed signage!
    </div>
  );
}

function ModePicker({ onPick, palette }) {
  const tileBase = {
    display: 'block', width: '100%', border: 'none', cursor: 'pointer',
    padding: '14px 16px', borderRadius: 18, marginBottom: 10,
    textAlign: 'center', fontFamily: 'inherit',
  };
  const [faqOpen, setFaqOpen] = useState(false);
  const faqBtnRef = useRef(null);
  const closeFaq = useCallback(() => { setFaqOpen(false); faqBtnRef.current?.focus(); }, []);
  return (
    <React.Fragment>
    <DeadlineBanner/>
    <div style={{ padding: '14px 24px 18px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h1 style={{
        fontSize: 40, lineHeight: 1, fontWeight: 900, margin: '0 0 8px',
        textWrap: 'balance', color: palette.heading,
        letterSpacing: '-0.02em',
      }}>
        <span style={{ whiteSpace: 'nowrap' }}>What's Your</span> <span style={{ whiteSpace: 'nowrap' }}>Green Radius?</span>
      </h1>

      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 12, margin: '6px 0 12px',
      }} aria-hidden="true">
        {window.SECTORS.map(s => (
          <SectorIcon key={s.id} kind={s.icon} size={24} color={palette.accent}/>
        ))}
      </div>

      <div style={{
        fontSize: 15, lineHeight: 1.45, color: palette.text + 'cc',
        maxWidth: 340, margin: '0 auto 16px', textWrap: 'pretty',
      }}>
        Join BLAST 2026 and track your camp's progress across all 6 sustainability sectors. Pick your path below.
      </div>

      <button
        onClick={() => onPick('board')}
        aria-label="Play the game in board game mode"
        className="grg-press"
        style={{
          ...tileBase,
          background: palette.accentDark, color: '#fff',
          '--grg-sh': palette.accentDeep,
        }}
      >
        <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true"
          style={{ display: 'block', margin: '0 auto 8px' }}>
          {/* Same wedge sequence as apple-touch-icon.png: a light-to-dark green
              ramp clockwise from the pointer with white seams and a plain dark
              hub dot — no light/dark alternation, no pale center disc, no dark
              spokes, the three cues that made it read as the radiation trefoil. */}
          {WEDGE_COLORS.map((c, i) => {
            const a0 = (i * 60 - 90) * Math.PI / 180;
            const a1 = ((i + 1) * 60 - 90) * Math.PI / 180;
            const r = 23;
            return (
              <path key={i} fill={c} stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"
                d={`M32 33 L${32 + r * Math.cos(a0)} ${33 + r * Math.sin(a0)} A${r} ${r} 0 0 1 ${32 + r * Math.cos(a1)} ${33 + r * Math.sin(a1)} Z`}/>
            );
          })}
          <circle cx="32" cy="33" r="23" fill="none" stroke={palette.text} strokeWidth="2.8"/>
          <circle cx="32" cy="33" r="3.4" fill={palette.text}/>
          <polygon points="32,12 26.8,3 37.2,3" fill={palette.text}/>
        </svg>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
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
        aria-label="Fill the application form"
        className="grg-press"
        style={{
          ...tileBase,
          background: palette.card, color: palette.text,
          '--grg-sh': palette.text + '1f',
        }}
      >
        <svg viewBox="0 0 64 64" width="48" height="48" aria-hidden="true"
          style={{ display: 'block', margin: '0 auto 8px' }}>
          <rect x="13" y="6" width="38" height="52" rx="6" fill="#fff" stroke="currentColor" strokeWidth="2.5"/>
          {[['#68B05C', 15], ['#56A85C', 26], ['#439F5B', 37]].map(([c, y]) => (
            <g key={y}>
              <rect x="19" y={y} width="9.5" height="9.5" rx="2.5" fill={c}/>
              <path d={`M${21.4} ${y + 5} l2 2.2 l3.7 -4.6`} stroke="#fff" strokeWidth="1.8"
                fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="33.5" y1={y + 4.8} x2="45" y2={y + 4.8} stroke="currentColor"
                strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
            </g>
          ))}
          <rect x="19" y="48" width="9.5" height="9.5" rx="2.5" fill="none"
            stroke="currentColor" strokeWidth="2" opacity="0.45"/>
          <line x1="33.5" y1="52.8" x2="45" y2="52.8" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
        </svg>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 2 }}>
          Fill the Form
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
          textTransform: 'uppercase', opacity: 0.75,
        }}>
          Application · Familiar
        </div>
      </button>

      <div style={{ marginTop: 4, marginBottom: 8, display: 'flex', gap: 10 }}>
        <FaqButton btnRef={faqBtnRef} expanded={faqOpen} onClick={() => setFaqOpen(true)} palette={palette}/>
        <CityStatsButton palette={palette}/>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 18, flexWrap: 'wrap' }}>
        {[
          { href: BOARD_GAME_PDF_URL, download: true, label: 'Board Game PDF Download ↓' },
        ].map(l => (
          <a
            key={l.href}
            href={l.href}
            {...(l.download ? { download: true } : {})}
            className="grg-hit44"
            style={{
              display: 'inline-block', padding: '8px 4px',
              color: palette.text + '80', fontSize: 10.5, fontWeight: 600,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              textDecorationColor: palette.text + '33',
            }}
          >{l.label}</a>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid ' + palette.text + '14' }}>
        <a href={COMMUNITY_LINK_URL} target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
            color: palette.accentText, lineHeight: 1.5,
            textDecoration: 'none', display: 'block',
          }}
        >
          CREATED BY THE<br/>
          GREEN THEME CAMP COMMUNITY
        </a>

        <div aria-hidden="true" style={{
          marginTop: 10, fontSize: 9, fontWeight: 600,
          letterSpacing: '0.18em', color: palette.text + '40',
          fontVariantNumeric: 'tabular-nums', userSelect: 'all',
        }}>
          {/* Quiet team door: the stamp doubles as the /admin/ link. Deliberately
              tiny target and unstyled (no 44px hit-expansion) so it reads as
              plain text; the admin page is Access-gated regardless. */}
          <a href="/admin/" tabIndex={-1} style={{ color: 'inherit', textDecoration: 'none', cursor: 'text' }}>
            {APP_VERSION}
          </a>
        </div>
      </div>

      {faqOpen && <FaqModal onClose={closeFaq} palette={palette}/>}
    </div>
    </React.Fragment>
  );
}
