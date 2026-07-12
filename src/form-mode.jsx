// src/form-mode.jsx — the linear application form (all 60 questions as Yes/No pages). Shared Babel scope; see src/core.jsx.

// ─── linear application form ─────────────────────────────────────────────────
// Renders the 60 board-game questions as a yes/no form, paginated one sector
// per page (6 pages, with a sector stepper and Back/Next; see the 2026-06-03 spec).
// Submit just marks every sector closed; the radius fill derives from `answers`,
// exactly like the board game — the 'done' phase + ShareCard need no special shape.
//
// Scoring is per-question and identical to the board game (see sectorFill):
// each level's ring fills per question, in its level color; Level 4 shows the
// count of advanced Yeses (capped at 4). totalYes (0–10) feeds the sheet.
function LinearForm({ sectors, answers, setAnswer, notes, setNote, onSubmit, onBack, onClear, palette }) {
  const [page, setPage] = useState(0);
  const [highlightMissing, setHighlightMissing] = useState(false);
  const lastPage = sectors.length - 1;
  const sector = sectors[page];

  // A sector is "complete" once every Tier 1-3 question is answered. Tier 4 is
  // optional, with one exception: a write-in with typed text needs its Yes/No,
  // otherwise runSubmit would silently drop the idea from the submission.
  const isAns = (id) => answers[id] === 'yes' || answers[id] === 'no';
  const requiredAnswered = (s) =>
    s.levels.slice(0, 3).every(lvl => lvl.every(qq => isAns(qq.id))) &&
    campIdeaIds(s).every(id => !((notes && notes[id]) || '').trim() || isAns(id));
  const incompleteSectors = sectors.filter(s => !requiredAnswered(s));
  const allComplete = incompleteSectors.length === 0;
  const firstIncompleteIndex = sectors.findIndex(s => !requiredAnswered(s));

  // Submission just marks every sector closed; scoring/fill derive from `answers`.
  function handleSubmit() {
    const sectorCursor = {};
    const sectorClosed = {};
    sectors.forEach(s => {
      sectorCursor[s.id] = 4;
      sectorClosed[s.id] = true;
    });
    onSubmit({ sectorCursor, sectorClosed });
  }

  const totalAnswered = Object.values(answers).filter(a => a === 'yes' || a === 'no').length;

  // A new page should always open at its header, not mid-scroll.
  useEffect(() => { try { window.scrollTo(0, 0); } catch {} }, [page]);

  // Equal-width neutral pill for Previous / Next. Submit is styled separately.
  const navPill = (enabled) => ({
    flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
    letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 52,
    cursor: enabled ? 'pointer' : 'default',
    background: enabled ? palette.text + '11' : palette.text + '08',
    color: enabled ? palette.text : palette.text + '40',
    '--grg-sh': palette.text + '22',
  });

  return (
    <div style={{ padding: '18px 24px 28px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={onBack}
          aria-label="Back to your camp details"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: palette.text + '99', fontSize: 12, fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 0', fontFamily: 'inherit',
          }}
        >← Back</button>
      </div>

      {/* sector progress stepper */}
      <div
        role="group"
        aria-label={`Progress: sector ${page + 1} of ${sectors.length}, ${sector.name}`}
        style={{ marginBottom: 18 }}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 4, maxWidth: 320, margin: '0 auto',
        }}>
          {sectors.map((s, i) => {
            const complete = requiredAnswered(s);
            const current = i === page;
            const iconColor = complete || current ? palette.accent : palette.text + '40';
            return (
              <div key={s.id} aria-hidden="true" style={{
                width: 40, height: 40, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: current ? palette.accent + '22' : 'transparent',
                border: `1.5px solid ${current ? palette.accent : 'transparent'}`,
                opacity: complete || current ? 1 : 0.55,
                transition: 'background .2s ease, border-color .2s ease, opacity .2s ease',
              }}>
                <SectorIcon kind={s.icon} size={20} color={iconColor}/>
              </div>
            );
          })}
        </div>
        <div style={{
          textAlign: 'center', marginTop: 8, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.18em', color: palette.text + '99',
        }}>
          {sector.name.toUpperCase()} · {page + 1} OF {sectors.length}
        </div>
      </div>

      {page === 0 && (
        <div style={{
          textAlign: 'center', fontSize: 13, lineHeight: 1.5,
          color: palette.text + 'cc', marginBottom: 4, textWrap: 'pretty',
        }}>
          Answer yes/no for your camp. Progress autosaves.
        </div>
      )}

      {/* one sector per page; key re-mounts + re-animates on page change */}
      <div key={page} style={{ animation: 'qm-up .25s ease both' }}>
        <FormSectorBlock
          sector={sector}
          answers={answers} setAnswer={setAnswer} palette={palette}
          notes={notes} setNote={setNote}
          highlightMissing={highlightMissing}
        />
      </div>

      {/* Back / Next, or Submit on the last page */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Previous sector"
          className={page !== 0 ? 'grg-press-sm' : undefined}
          style={navPill(page !== 0)}
        >← Previous</button>

        {page < lastPage ? (
          <button
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            aria-label="Next sector"
            className="grg-press-sm"
            style={navPill(true)}
          >Next →</button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allComplete}
            aria-label="Submit form answers"
            className={allComplete ? 'grg-press-sm' : undefined}
            style={{
              flex: 1, padding: '14px 0', borderRadius: 12, border: 'none',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 800,
              letterSpacing: '0.1em', textTransform: 'uppercase', minHeight: 52,
              cursor: !allComplete ? 'default' : 'pointer',
              background: !allComplete ? palette.text + '33' : palette.accent,
              color: '#fff',
              '--grg-sh': palette.accentDark,
            }}
          >Submit →</button>
        )}
      </div>

      {page === lastPage && !allComplete && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ fontSize: 12, color: palette.text + '99', marginBottom: 6, textWrap: 'pretty' }}>
            {incompleteSectors.length} {incompleteSectors.length === 1 ? 'sector' : 'sectors'} still need required answers.
          </div>
          <button
            type="button"
            onClick={() => { setHighlightMissing(true); setPage(firstIncompleteIndex); }}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: palette.accentDark, fontSize: 12, fontWeight: 800,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '6px 10px', minHeight: 44, fontFamily: 'inherit',
            }}
          >Go to {sectors[firstIncompleteIndex].name} →</button>
        </div>
      )}

      <div style={{ textAlign: 'center' }}>
        <button
          type="button"
          aria-label="Clear all form answers"
          onClick={() => {
            if (totalAnswered === 0) return;
            if (!confirm('Clear all answers?')) return;
            onClear();
          }}
          disabled={totalAnswered === 0}
          style={{
            background: 'transparent', border: 'none',
            cursor: totalAnswered === 0 ? 'default' : 'pointer',
            color: palette.text + (totalAnswered === 0 ? '33' : '66'),
            fontSize: 11, fontWeight: 600, letterSpacing: '0.18em',
            textTransform: 'uppercase', padding: '14px 12px',
            minHeight: 44, fontFamily: 'inherit',
          }}
        >Clear Form ✕</button>
      </div>

      {page === lastPage && (
        <a href={COMMUNITY_LINK_URL} target="_blank" rel="noopener noreferrer"
          style={{
            fontSize: 11, letterSpacing: '0.3em', fontWeight: 700,
            color: palette.accent, marginTop: 20, lineHeight: 1.5,
            textDecoration: 'none', display: 'block', textAlign: 'center',
          }}
        >
          CREATED BY THE<br/>
          GREEN THEME CAMP COMMUNITY
        </a>
      )}
    </div>
  );
}

// Level 4 write-ins: up to four "Our Camp's Idea" slots, each a described idea
// plus its own Yes/No ("did your camp pull it off?"). Every yes earns a Level-4
// point, so a camp can reach a full 4/4 on its own ideas. Slots past the first
// appear on demand via "Add another idea"; how many show is seeded from existing
// data on mount so a reload restores every idea the camp filled in.
function CampIdeasBlock({ sector, answers, setAnswer, notes, setNote, palette, highlightMissing }) {
  const ids = campIdeaIds(sector);
  const hasData = (id) => !!((notes && notes[id]) || '').trim() || answers[id] === 'yes' || answers[id] === 'no';
  const [shown, setShown] = useState(() => Math.min(4, Math.max(1, ids.filter(hasData).length)));
  if (!ids.length) return null;
  const visible = ids.slice(0, shown);
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: palette.text, marginBottom: 2 }}>Our Camp's Ideas</div>
      <div style={{ fontSize: 11, lineHeight: 1.4, color: palette.text + '88', marginBottom: 6 }}>
        List up to four of your own {sector.name.toLowerCase()} ideas and whether your camp pulled each one off. Every yes is a Level 4 point.
      </div>
      {visible.map((id, i) => {
        const answered = answers[id] === 'yes' || answers[id] === 'no';
        const missing = highlightMissing && !!((notes && notes[id]) || '').trim() && !answered;
        return (
          <div key={id} style={{
            padding: '10px 0',
            borderTop: `1px solid ${palette.text}${i === 0 ? '11' : '0d'}`,
            borderLeft: `3px solid ${missing ? '#C9821E' : 'transparent'}`,
            paddingLeft: missing ? 10 : 0,
            transition: 'border-color .2s ease, padding-left .2s ease',
          }}>
            <input
              value={(notes && notes[id]) || ''}
              onChange={e => setNote && setNote(id, e.target.value)}
              maxLength={140}
              placeholder={i === 0 ? "What did your camp try?" : `Another idea (${i + 1} of 4)`}
              aria-label={`Describe your camp's own ${sector.name.toLowerCase()} idea, number ${i + 1}`}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${palette.text}22`,
                background: '#fff', color: palette.text,
                fontSize: 16, fontFamily: 'inherit', marginBottom: 8,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: palette.text + '99' }}>
                Did your camp pull it off?
                {missing && <span style={{ color: '#C9821E', fontWeight: 700, marginLeft: 6 }}>Needs an answer</span>}
              </span>
              <div style={{ marginLeft: 'auto' }}>
                <YesNoButtons qid={id} answer={answers[id]} setAnswer={setAnswer} palette={palette}/>
              </div>
            </div>
          </div>
        );
      })}
      {shown < 4 && (
        <button
          type="button"
          onClick={() => setShown(n => Math.min(4, n + 1))}
          style={{
            marginTop: 10, background: 'transparent', cursor: 'pointer',
            border: `1.5px dashed ${palette.text}33`, borderRadius: 8,
            color: palette.accentDark, fontWeight: 700, fontSize: 12,
            letterSpacing: '0.04em', padding: '9px 12px', fontFamily: 'inherit',
            width: '100%',
          }}
        >+ Add another idea</button>
      )}
    </div>
  );
}

function FormSectorBlock({ sector, answers, setAnswer, notes, setNote, palette, highlightMissing }) {
  const fixedQs = [].concat(...sector.levels.slice(0, 3));
  const t4 = sector.tier4Topics || [];
  const isAnswered = (id) => answers[id] === 'yes' || answers[id] === 'no';
  return (
    <section style={{
      margin: '20px 0', padding: '18px 16px',
      background: palette.card, borderRadius: 16, textAlign: 'left',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <SectorIcon kind={sector.icon} size={28} color={palette.accent}/>
        <h2 style={{ fontSize: 18, fontWeight: 900, margin: 0, letterSpacing: '-0.01em', color: palette.heading }}>
          {sector.name}
        </h2>
      </div>
      <div style={{
        fontSize: 11, lineHeight: 1.4, color: palette.text + '99',
        marginBottom: 14,
      }}>
        {sector.bigGoal}
      </div>

      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: palette.text + '88',
        marginBottom: 2,
      }}>
        Required
      </div>
      {fixedQs.map(q => (
        <YesNoRow
          key={q.id} qid={q.id}
          text={q.prompt}
          answer={answers[q.id]} setAnswer={setAnswer} palette={palette}
          missing={highlightMissing && !isAnswered(q.id)}
        />
      ))}

      {t4.length > 0 && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginTop: 16, marginBottom: 4,
          }}>
            <span style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: palette.accentDark,
              background: palette.accent + '22', borderRadius: 999,
              padding: '2px 8px',
            }}>Optional</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: palette.text + '88',
            }}>Level 4 · every yes counts, max 4</span>
          </div>
          {t4.filter(t => !isCampTopic(t)).map(t => (
            <YesNoRow
              key={t.id}
              qid={t.id}
              text={t.title} subtext={t.description}
              answer={answers[t.id]} setAnswer={setAnswer} palette={palette}
            />
          ))}
          <CampIdeasBlock
            sector={sector}
            answers={answers} setAnswer={setAnswer}
            notes={notes} setNote={setNote}
            palette={palette} highlightMissing={highlightMissing}
          />
        </>
      )}
    </section>
  );
}

// The board-game Yes/No feel on the form: a hard drop-shadow on the active
// choice plus a spring-bounce on tap (grg-spring / grg-spring-soft, the same
// keyframes the board game uses; both collapse to no-op under reduced motion).
function YesNoButtons({ qid, answer, setAnswer, palette }) {
  const btnBase = {
    border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    padding: '8px 14px', borderRadius: 8, fontFamily: 'inherit',
    minWidth: 56, minHeight: 44, // WCAG 2.5.5 touch target
  };
  const bounce = (e, yes) => {
    const el = e.currentTarget;
    el.style.animation = 'none';
    void el.offsetWidth; // reflow so a repeat tap re-fires the animation
    el.style.animation = (yes ? 'grg-spring' : 'grg-spring-soft') + ' 0.42s cubic-bezier(.34,1.56,.64,1)';
  };
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button
        onClick={(e) => { bounce(e, true); setAnswer(qid, 'yes'); }}
        aria-pressed={answer === 'yes'}
        style={{
          ...btnBase,
          background: answer === 'yes' ? palette.accent : palette.text + '11',
          color: answer === 'yes' ? '#fff' : palette.text,
          boxShadow: answer === 'yes' ? `0 3px 0 ${palette.accentDark}` : 'none',
        }}
      >Yes</button>
      <button
        onClick={(e) => { bounce(e, false); setAnswer(qid, 'no'); }}
        aria-pressed={answer === 'no'}
        style={{
          ...btnBase,
          background: answer === 'no' ? palette.text : palette.text + '11',
          color: answer === 'no' ? '#fff' : palette.text,
        }}
      >No</button>
    </div>
  );
}

function YesNoRow({ qid, text, subtext, answer, setAnswer, palette, missing }) {
  return (
    <div style={{
      padding: '12px 0',
      borderTop: `1px solid ${palette.text}11`,
      borderLeft: `3px solid ${missing ? '#C9821E' : 'transparent'}`,
      paddingLeft: missing ? 10 : 0,
      transition: 'border-color .2s ease, padding-left .2s ease',
    }}>
      <div style={{ fontSize: 13, lineHeight: 1.4, color: palette.text, marginBottom: subtext ? 4 : 8 }}>
        {text}{missing && <span style={{ color: '#C9821E', fontWeight: 700, fontSize: 11, marginLeft: 6 }}>Needs an answer</span>}
      </div>
      {subtext && (
        <div style={{ fontSize: 11, lineHeight: 1.4, color: palette.text + '88', marginBottom: 8 }}>
          {subtext}
        </div>
      )}
      <YesNoButtons qid={qid} answer={answer} setAnswer={setAnswer} palette={palette}/>
    </div>
  );
}
