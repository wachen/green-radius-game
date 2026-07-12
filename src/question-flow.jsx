// src/question-flow.jsx — question modal, result toast, celebration overlay. Shared Babel scope; see src/core.jsx.

// ─── question modal ───────────────────────────────────────────────────────────
// Each question has: title, prompt (yes/no question), description, optional link.
// For tier 4 (level index 3), the question is generated from a topic the user
// picks via dropdown, or written in via the per-sector "Our Camp's Idea" topic
// (id `X-camp`): a Custom button opens it with a free-text field, and the typed
// idea travels up through onComplete's third argument (notes, keyed by topic id).
// `tier4Topics` is provided per-sector.
// Plays all 10 questions of a sector in a single open modal: tier 1 (1q) →
// tier 2 (2q) → tier 3 (3q) → tier 4 (4 picks). The user always answers all
// 10 — failures don't end the sector early. Final scoring (which levels go
// green) is computed by the caller from the returned answersByLevel.
// Where to reopen a partly-answered sector: the first Level 1–3 question without
// an answer, with the already-answered ones seeded so the progress dots show them.
// If all six fixed questions are answered, reopen at the (optional) Tier 4.
function resumePosition(sector, answers) {
  const answersByLevel = [[], [], [], []];
  for (let li = 0; li < 3; li++) {
    const qs = sector.levels[li] || [];
    for (let i = 0; i < qs.length; i++) {
      const a = answers[qs[i].id];
      if (a === 'yes' || a === 'no') answersByLevel[li].push(a === 'yes');
      else return { level: li, idx: i, answersByLevel };
    }
  }
  return { level: 3, idx: 0, answersByLevel };
}

// The write-in Tier-4 topic ("Our Camp's Idea") — the only one with a text field.
const isCampTopic = (t) => !!t && /-camp$/.test(t.id);

// One step back through the fixed levels (sizes 1/2/3). Returns null at the very start.
function stepBack(level, idx) {
  const levelSizes = [1, 2, 3, 4];
  if (idx > 0) return { level, idx: idx - 1 };
  if (level > 0) return { level: level - 1, idx: levelSizes[level - 1] - 1 };
  return null;
}

function QuestionModal({ sector, onComplete, onAnswer, existingAnswers, palette, variant }) {
  const tierLabels = ['Start Here', 'Beginner', 'Intermediate', 'Advanced'];
  const levelSizes = [1, 2, 3, 4];
  const tier4Topics = sector.tier4Topics || [];

  // Resume at the first unanswered Level 1–3 question (a refresh/back-swipe
  // mid-sector no longer loses the answers already given). Computed once on mount.
  const initial = useRef(null);
  if (!initial.current) initial.current = resumePosition(sector, existingAnswers || {});
  const [level, setLevel] = useState(initial.current.level);
  const [idx, setIdx] = useState(initial.current.idx);
  const [answersByLevel, setAnswersByLevel] = useState(initial.current.answersByLevel);
  const [pickedTopicIds, setPickedTopicIds] = useState([]); // tier 4 only
  const [topicId, setTopicId] = useState(''); // tier 4 dropdown selection
  const [notes, setNotes] = useState({}); // write-in idea text, keyed by topic id
  const [customText, setCustomText] = useState(''); // draft text of the open write-in
  const cardRef = useRef(null);
  const yesBtnRef = useRef(null);
  const noBtnRef = useRef(null);
  useModalA11y(cardRef); // scroll-lock + Tab focus trap
  // Move focus into the dialog on open. The Spin button the player just pressed
  // gets disabled as the modal mounts, which otherwise drops focus to <body> and
  // strands keyboard / screen-reader users. aria-live on the question (below)
  // announces each new question as the player advances.
  useEffect(() => { cardRef.current?.focus(); }, []);

  const isTier4 = level === 3;
  const questions = sector.levels[level] || [];
  const total = levelSizes[level];

  // The write-in topic lives behind its own button, not in the dropdown.
  const availableTopics = isTier4
    ? tier4Topics.filter(t => !pickedTopicIds.includes(t.id) && !isCampTopic(t))
    : [];
  const campTopic = tier4Topics.find(isCampTopic) || null;
  // Up to four write-in slots: the base X-camp topic plus synthetic X-camp-2/3/4
  // ids (see campIdeaIds). Each earns its own Level-4 point, mirroring the form.
  // The button offers the next free slot until all four are used.
  const campIds = campIdeaIds(sector);
  const isCampIdea = (t) => !!t && campIds.includes(t.id);
  const nextCampId = campTopic ? campIds.find(id => !pickedTopicIds.includes(id)) : null;
  const campTopicOpen = isTier4 && !!nextCampId;

  const q = isTier4
    ? (tier4Topics.find(t => t.id === topicId)
       || (topicId && campTopic && campIds.includes(topicId)
           ? { ...campTopic, id: topicId,
               title: campIds.indexOf(topicId) > 0
                 ? campTopic.title + ' (' + (campIds.indexOf(topicId) + 1) + ' of 4)'
                 : campTopic.title }
           : null))
    : questions[idx];

  // The write-in needs its idea described before Yes/No makes sense.
  const needsIdeaText = isTier4 && isCampIdea(q);
  const canAnswer = !needsIdeaText || customText.trim().length > 0;

  function answer(yes) {
    // PR46 juice: spring the tapped button + fire particles from its rect.
    // Fire-and-forget — Fx draws to the body-level canvas, so it survives this
    // modal unmounting when the last answer calls onComplete. Reduced motion:
    // Fx.* is a no-op and the keyframes are neutralized, so this is silent.
    const btn = (yes ? yesBtnRef : noBtnRef).current;
    if (btn) {
      btn.style.animation = 'none';
      void btn.offsetWidth; // reflow so a repeat tap replays the keyframe
      btn.style.animation = (yes ? 'grg-spring' : 'grg-spring-soft') + ' 0.42s cubic-bezier(.34,1.56,.64,1)';
      if (yes) Fx.leafBurst(btn); else Fx.dustPuff(btn);
    }
    // ── existing logic below is UNCHANGED ──
    // Persist each Level 1–3 answer to the shared map immediately so a refresh
    // mid-sector resumes at the next question instead of losing the run. (Tier 4
    // is optional and restarts on resume, so it stays modal-local.)
    if (!isTier4 && q && onAnswer) onAnswer(q.id, yes ? 'yes' : 'no');
    const nextAnswers = answersByLevel.map((a, li) => li === level ? [...a, yes] : a);
    setAnswersByLevel(nextAnswers);
    const nextPicks = isTier4 ? [...pickedTopicIds, topicId] : pickedTopicIds;
    const nextNotes = (isTier4 && isCampIdea(q) && customText.trim())
      ? { ...notes, [q.id]: customText.trim() }
      : notes;
    if (isTier4) {
      setPickedTopicIds(nextPicks);
      setNotes(nextNotes);
      setTopicId('');
      setCustomText('');
    }
    if (idx + 1 >= total) {
      if (level + 1 >= 4) {
        onComplete(nextAnswers, nextPicks, nextNotes);
      } else {
        setLevel(level + 1);
        setIdx(0);
      }
    } else {
      setIdx(idx + 1);
    }
  }

  // Step one question back, un-answering it so a Yes/No can be changed.
  function back() {
    if (isTier4) {
      // Leave the open topic, back to the picker. A write-in draft stays in
      // customText so reopening the write-in button restores it.
      if (topicId) { setTopicId(''); return; }
      if (idx > 0) {                                     // un-answer the previous advanced topic
        const prevPick = pickedTopicIds[pickedTopicIds.length - 1];
        // The un-answered write-in's text would die with its note; keep it as
        // the draft so the player can reopen the write-in without retyping.
        if (prevPick && campIds.includes(prevPick) && typeof notes[prevPick] === 'string') {
          setCustomText(notes[prevPick]);
        }
        setAnswersByLevel(a => a.map((l, li) => li === 3 ? l.slice(0, -1) : l));
        setPickedTopicIds(p => p.slice(0, -1));
        setNotes(n => {
          if (!(prevPick in n)) return n;
          const o = { ...n }; delete o[prevPick]; return o;
        });
        setIdx(idx - 1);
        return;
      }
    }
    const prev = stepBack(level, idx);
    if (!prev) return;
    const pq = (sector.levels[prev.level] || [])[prev.idx];
    if (pq && onAnswer) onAnswer(pq.id, null);           // null = remove the persisted answer
    setAnswersByLevel(a => a.map((l, li) => li === prev.level ? l.slice(0, -1) : l));
    setLevel(prev.level);
    setIdx(prev.idx);
  }
  const canGoBack = !(level === 0 && idx === 0 && !topicId);

  // Overall position across all 10 questions, for the counter and dot grouping
  const stepNumber = levelSizes.slice(0, level).reduce((a, b) => a + b, 0) + idx + 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10,
      background: 'rgba(20,12,8,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
      animation: 'qm-fade 0.25s ease',
      overflowY: 'auto',
    }}>
      <div
        ref={cardRef} role="dialog" aria-modal="true" aria-labelledby="qm-tag" tabIndex={-1}
        style={{
        background: palette.card,
        color: palette.text,
        borderRadius: 24,
        padding: 26,
        maxWidth: 400, width: '100%',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
        position: 'relative',
        animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        {/* sector tag — also the dialog's accessible name (aria-labelledby) */}
        <div id="qm-tag" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: '#3a2a20', color: '#f0eee9',
          padding: '6px 12px', borderRadius: 999,
          fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <SectorIcon kind={sector.icon} size={14} color="#fff"/>
          {sector.name} · Level {level + 1} · {tierLabels[level]}
        </div>

        {/* sector intro — show only on the very first question of the sector
            (Tier 1, Q1) so it sets the frame once without repeating. */}
        {level === 0 && idx === 0 && sector.bigGoal && (
          <div style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 13, lineHeight: 1.45, color: palette.text + 'b3',
              fontStyle: 'italic', textWrap: 'pretty', marginBottom: 6,
            }}>
              {sector.bigGoal}
            </div>
            {sector.resourceLink && (
              <a href={sector.resourceLink.url} target="_blank" rel="noreferrer" style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                color: '#5BA84A', textDecoration: 'none',
                borderBottom: '1px solid #5BA84A55',
                paddingBottom: 1,
              }}>
                {sector.resourceLink.label} ↗
              </a>
            )}
          </div>
        )}

        {/* progress dots — 10 dots in 4 tier-groups (1 / 2 / 3 / 4) */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {levelSizes.map((n, li) => (
            <div key={li} style={{ display: 'flex', gap: 4, flex: n }}>
              {Array.from({ length: n }).map((_, i) => {
                const past = li < level || (li === level && i < idx);
                const current = li === level && i === idx;
                const answered = past && answersByLevel[li][i];
                return (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: current ? '#3a2a20'
                              : past ? (answered ? '#5BA84A' : 'rgba(60,40,30,0.35)')
                              : 'rgba(0,0,0,0.08)',
                    transition: 'background 0.3s',
                  }} />
                );
              })}
            </div>
          ))}
        </div>

        {/* Tier 4: topic picker */}
        {isTier4 && !q && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.15em', fontWeight: 700, color: palette.text + '99', marginBottom: 6 }}>
              ADVANCED · OPTIONAL · TOPIC {idx + 1} OF 4
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: palette.text + 'cc', marginBottom: 12, textWrap: 'pretty' }}>
              Pick an advanced {sector.name.toLowerCase()} idea your camp pursued from the list, or write in up to four of your own. Totally optional.
            </div>
            <select
              value={topicId}
              onChange={e => setTopicId(e.target.value)}
              aria-label="Pick an advanced topic"
              style={{
                width: '100%', padding: '14px 14px', borderRadius: 12,
                border: `1.5px solid ${palette.text}22`,
                background: '#fff', color: palette.text,
                fontSize: 16, fontFamily: 'inherit',
                appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'><path fill='%23666' d='M0 0h12L6 8z'/></svg>")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 14px center',
                paddingRight: 36,
              }}
            >
              <option value="">Pick a topic…</option>
              {availableTopics.map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
            {campTopicOpen && (
              <button
                type="button"
                onClick={() => setTopicId(nextCampId)}
                style={{
                  width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 12,
                  border: '1.5px dashed #5BA84A99', background: '#5BA84A14',
                  color: '#3d7a31', fontSize: 12, fontWeight: 800,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              ><span aria-hidden="true">✎ </span>{campIds.indexOf(nextCampId) > 0 ? 'Add another idea' : 'Write in your own idea'}</button>
            )}
            <button
              type="button"
              onClick={() => onComplete(answersByLevel, pickedTopicIds, notes)}
              aria-label="Skip the optional advanced tier"
              style={{
                width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 12,
                border: `1.5px solid ${palette.text}22`, background: 'transparent',
                color: palette.text + 'aa', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >None / skip advanced</button>
          </div>
        )}

        {/* Question content — aria-live so each new question is announced as the player advances */}
        {q && (
          <div aria-live="polite" aria-atomic="true">
            <div style={{
              fontSize: 11, letterSpacing: '0.15em', fontWeight: 700,
              color: '#5BA84A', marginBottom: 8,
            }}>
              {isTier4 ? `STEP ${sector.code}${idx + 7}` : `STEP ${q.code}`}
            </div>
            <div style={{
              fontSize: 22, lineHeight: 1.2, fontWeight: 800,
              marginBottom: 12, textWrap: 'balance',
              letterSpacing: '-0.01em',
            }}>
              {q.title}
            </div>
            <div style={{
              fontSize: 17, lineHeight: 1.35, fontWeight: 600,
              marginBottom: 18, textWrap: 'pretty',
              color: palette.text,
            }}>
              {q.prompt || q.title + '?'}
            </div>

            {/* write-in topic: describe the idea before answering Yes/No */}
            {needsIdeaText && (
              <input
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                maxLength={NOTE_MAX_LEN}
                placeholder="What did your camp try?"
                aria-label="Describe your camp's own idea"
                autoFocus
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  border: `1.5px solid ${palette.text}22`,
                  background: '#fff', color: palette.text,
                  fontSize: 16, fontFamily: 'inherit',
                  marginBottom: 16,
                }}
              />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                ref={noBtnRef}
                onClick={() => answer(false)}
                disabled={!canAnswer}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  border: `1.5px solid ${palette.text}22`,
                  background: 'transparent', color: palette.text,
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: canAnswer ? 'pointer' : 'default',
                  opacity: canAnswer ? 1 : 0.45,
                  textTransform: 'uppercase',
                }}
              >No</button>
              <button
                ref={yesBtnRef}
                onClick={() => answer(true)}
                disabled={!canAnswer}
                style={{
                  flex: 1, padding: '14px 0', borderRadius: 14,
                  border: 'none',
                  background: '#5BA84A', color: '#fff',
                  fontSize: 15, fontWeight: 700, letterSpacing: '0.05em',
                  cursor: canAnswer ? 'pointer' : 'default',
                  opacity: canAnswer ? 1 : 0.55,
                  textTransform: 'uppercase',
                  boxShadow: '0 3px 0 #3d7a31',
                }}
              >Yes</button>
            </div>

            {/* supporting detail sits below the Yes/No so the bold question
                keeps the focus; the hairline marks it as optional reading */}
            {(q.description || q.link) && (
              <div style={{ marginTop: 20, paddingTop: 14, borderTop: `1px solid ${palette.text}1f` }}>
                {q.description && (
                  <div style={{
                    fontSize: 13, lineHeight: 1.5,
                    color: palette.text + 'aa',
                    marginBottom: q.link ? 10 : 0,
                    textWrap: 'pretty',
                    maxHeight: 140, overflowY: 'auto',
                  }}>
                    {q.description}
                  </div>
                )}
                {q.link && (
                  <a href={q.link.url} target="_blank" rel="noreferrer" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 700, letterSpacing: '0.05em',
                    color: '#5BA84A', textDecoration: 'none',
                    borderBottom: '1px solid #5BA84A55',
                    paddingBottom: 1,
                  }}>
                    {q.link.label} ↗
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', marginTop: 16 }}>
          {canGoBack ? (
            <button type="button" onClick={back} aria-label="Go back to the previous question"
              style={{ background: 'none', border: 'none',
                color: palette.text + '99', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                letterSpacing: '0.1em', textTransform: 'uppercase',
                fontFamily: 'inherit', padding: '6px 8px', minHeight: 32 }}>
              ‹ Back
            </button>
          ) : (
            <span style={{ visibility: 'hidden', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 8px' }} aria-hidden="true">‹ Back</span>
          )}
          <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: palette.text + '99' }}>
            {isTier4 ? 'Advanced' : `${stepNumber} of 10`}
          </div>
          <span style={{ visibility: 'hidden', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '6px 8px' }} aria-hidden="true">‹ Back</span>
        </div>
      </div>
    </div>
  );
}

// ─── result toast (between questions and next spin) ───────────────────────────
// Anchored above the wheel's center hub button by its owner (see the wheel
// wrapper in green-radius.jsx). The offset below must clear the hub: hub
// radius 52px (src/wheel.jsx) + a small gap.
function ResultToast({ kind, sector, greens, palette, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [onClose]);

  const isDone = kind === 'sector-done';
  const anyGreen = isDone && greens > 0;

  return (
    <div role="status" aria-live="polite" style={{
      position: 'absolute', left: '50%', top: 'calc(50% - 62px)',
      transform: 'translate(-50%, -100%)',
      zIndex: 9, pointerEvents: 'none',
      animation: 'qm-fade 0.25s ease',
    }}>
      <div style={{
        background: anyGreen ? '#5BA84A' : '#3a2a20',
        color: '#fff', padding: '16px 20px', borderRadius: 16,
        boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
        textAlign: 'center', maxWidth: 260,
        animation: 'qm-up 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', opacity: 0.8, marginBottom: 5 }}>
          {sector?.name?.toUpperCase()} · DONE
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, textWrap: 'pretty' }}>
          {anyGreen
            ? `${greens} of 10 answered yes`
            : 'Sector done · no yeses this time. Room to grow!'}
        </div>
      </div>
    </div>
  );
}

// ─── celebration overlay (full sector cleared) ────────────────────────────────
// Burning-Man-flavored graffiti splatter + slogan. Auto-dismisses; honors
// prefers-reduced-motion by showing a quiet text-only flash instead.
function Celebration({ sector, palette, onDone }) {
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    const t = setTimeout(onDone, reduceMotion ? 1400 : 2600);
    return () => clearTimeout(t);
  }, [onDone, reduceMotion]);

  // Deterministic random per mount — splats stay in place for the duration
  // instead of jittering on re-render.
  const splats = useMemo(() => {
    const colors = ['#5BA84A', '#7AB85C', '#4A9639', '#A3D178', '#8FC96B', '#fbf7f0'];
    return Array.from({ length: 18 }, (_, i) => ({
      key: i,
      left: 6 + Math.random() * 88,
      top: 6 + Math.random() * 88,
      size: 36 + Math.random() * 110,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 0.35,
      blur: Math.random() < 0.3 ? 6 : 2,
    }));
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {!reduceMotion && splats.map(s => (
        <div key={s.key} style={{
          position: 'absolute',
          left: `${s.left}%`, top: `${s.top}%`,
          width: s.size, height: s.size,
          marginLeft: -s.size / 2, marginTop: -s.size / 2,
          background: s.color,
          borderRadius: '50%',
          opacity: 0,
          filter: `blur(${s.blur}px)`,
          mixBlendMode: 'multiply',
          animation: `grg-splat 1.9s cubic-bezier(0.2,0.8,0.2,1) ${s.delay}s forwards`,
        }}/>
      ))}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        animation: reduceMotion ? 'qm-fade 0.3s ease forwards' : 'grg-celeb 2.5s cubic-bezier(0.2,0.8,0.2,1) forwards',
      }}>
        <div style={{
          fontSize: 12, letterSpacing: '0.3em', fontWeight: 800,
          color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)', marginBottom: 12,
        }}>
          {sector?.name?.toUpperCase()} · 10 / 10
        </div>
        <div style={{
          fontSize: 'clamp(40px, 14vw, 72px)',
          fontWeight: 900,
          color: '#5BA84A',
          textShadow: '0 4px 20px rgba(0,0,0,0.45), 0 0 60px rgba(91,168,74,0.55)',
          textTransform: 'uppercase', letterSpacing: '-0.02em',
          lineHeight: 0.9,
          transform: reduceMotion ? 'none' : 'rotate(-3deg)',
          fontFamily: 'inherit',
        }}>
          All Green!
        </div>
      </div>
    </div>
  );
}
