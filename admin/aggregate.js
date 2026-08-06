// admin/aggregate.js — pure aggregation of result rows. No DOM, no React.
// Mirrors result-state.js's IIFE + global/CJS guard so it runs in the browser
// (window.AdminAggregate) and under bun (require).
(function (global) {
  // Fixed question ids (Levels 1-3) and Tier-4 topic ids for a sector.
  function sectorIds(sector) {
    return {
      fixed: [].concat(...sector.levels.slice(0, 3)).map(q => q.id),
      topics: (sector.tier4Topics || []).map(t => t.id),
    };
  }
  function advYesCount(sector, answers) {
    return Math.min(4, (sector.tier4Topics || []).filter(t => answers[t.id] === 'yes').length);
  }
  // Only yes/no entries make a row "answered" — `X-camp-note` write-in strings
  // may share the answers map and must not inflate denominators.
  function rowsWithAnswers(rows) {
    return rows.filter(r => r.answers &&
      Object.keys(r.answers).some(function (k) { return r.answers[k] === 'yes' || r.answers[k] === 'no'; }));
  }
  // Pre-rework rows (before the 0-10 per-question capture) have no schema tag and
  // no per-question answers; their greens mean levels-lit 0-4, not questions 0-10.
  // The greens<=4 check keeps a modern row that merely lost its tag/answers cells
  // (hand-typed, or submitted before the sheet gained those columns) from being
  // misread as old-scale when its scores are visibly 0-10.
  function isLegacy(row) {
    if (row.schemaVersion || (row.answers && Object.keys(row.answers).length > 0)) return false;
    var g = row.greens || {};
    return (row.total | 0) <= 24 && Object.keys(g).every(function (k) { return (g[k] | 0) <= 4; });
  }

  // Read-time, latest-wins dedup so repeat submissions (retries, redos, a new
  // device that lost localStorage) count once instead of permanently inflating
  // every tally. Rows are merged by connected components (union-find), not a
  // single precedence key: each row contributes a set of "link keys", every
  // key scoped by year (a 2025 and a 2026 row never merge just because they
  // share a name/id/email), and any two rows sharing ANY key land in the same
  // group. Link keys per row:
  //   - campId (rides inside the answers blob) if present.
  //   - normalized camp name (trim + lowercase + collapse whitespace) if present.
  //   - normalized email, but ONLY when the row has no campId — a modern camp's
  //     campId already identifies it, so email must not also merge two distinct
  //     campId-bearing camps that happen to share an inbox; pre-campId legacy
  //     rows have nothing else to key on, so email is still how those merge.
  // A row with no keys at all (no campId, no name, no email) stays its own
  // group of one — no key means no merge, same as before.
  // Winner per group: highest numeric timestamp; on a tie the later array
  // position wins (sheet rows are appended chronologically, so that is the
  // more recent submission).
  function normCampName(name) {
    return typeof name === 'string' ? name.trim().toLowerCase().replace(/\s+/g, ' ') : '';
  }
  function yearScope(row) {
    var y = row && row.year;
    return (y === undefined || y === null || y === '') ? '' : String(y);
  }
  // Every link key this row contributes, each prefixed with its year scope.
  function rowLinkKeys(row) {
    if (!row) return [];
    var y = yearScope(row);
    var keys = [];
    var cid = (row.answers && row.answers.campId) || row.campId;
    var hasCampId = typeof cid === 'string' && !!cid.trim();
    if (hasCampId) keys.push(y + ':id:' + cid.trim());
    var name = normCampName(row.campName);
    if (name) keys.push(y + ':nm:' + name);
    if (!hasCampId) {
      var email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
      if (email) keys.push(y + ':em:' + email);
    }
    return keys;
  }
  // Union-find grouping: rows sharing any link key end up in the same group.
  // Returns an array of groups (each an array of the original row objects),
  // in the order each group first appears in `rows`; within a group the rows
  // keep their original relative order (so "later array position" is stable).
  function groupRows(rows) {
    rows = rows || [];
    var n = rows.length;
    var parent = new Array(n);
    for (var i = 0; i < n; i++) parent[i] = i;
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { var ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }
    var keyToIndex = {};
    rows.forEach(function (r, i) {
      rowLinkKeys(r).forEach(function (k) {
        if (Object.prototype.hasOwnProperty.call(keyToIndex, k)) union(i, keyToIndex[k]);
        else keyToIndex[k] = i;
      });
    });
    var groups = [];
    var rootToGroup = {};
    rows.forEach(function (r, i) {
      var root = find(i);
      if (!Object.prototype.hasOwnProperty.call(rootToGroup, root)) {
        rootToGroup[root] = groups.length;
        groups.push([]);
      }
      groups[rootToGroup[root]].push(r);
    });
    return groups;
  }
  // Highest numeric timestamp wins; ties go to the later array position.
  // `+r.timestamp` (not `| 0`) preserves ms-epoch magnitude — `| 0` truncates
  // to int32 and wraps every ~49.7 days, which silently picks the WRONG row
  // as "latest" once two submissions are that far apart.
  function pickWinner(group) {
    var winner = group[0];
    for (var i = 1; i < group.length; i++) {
      if ((+group[i].timestamp || 0) >= (+winner.timestamp || 0)) winner = group[i];
    }
    return winner;
  }
  function dedupeRows(rows) {
    return groupRows(rows).map(pickWinner);
  }
  // Admin-UI annotation pass: same grouping as dedupeRows, but returns a
  // per-row Map instead of collapsing the rows, so the Camps tab can badge
  // "duplicate of" / "superseded" without hiding anything. Hidden rows are
  // ignored entirely (they don't compete for a group and get no annotation).
  //   dup         — size of this row's group (1 = alone).
  //   superseded  — true for every non-winning row in a group of 2+.
  //   suspect     — true ONLY on a group's winner, when that winner shares a
  //                 normalized email with a DIFFERENT group's winner in the
  //                 same year scope. That's the case we deliberately do NOT
  //                 auto-merge (distinct campId/name, same person) but the
  //                 owner should still get a heads-up about.
  function dedupeInfo(rows) {
    var visible = (rows || []).filter(function (r) { return !isHidden(r); });
    var groups = groupRows(visible);
    var winners = groups.map(pickWinner);
    var emailBuckets = {};
    winners.forEach(function (w, gi) {
      var email = typeof w.email === 'string' ? w.email.trim().toLowerCase() : '';
      if (!email) return;
      var key = yearScope(w) + ':' + email;
      (emailBuckets[key] = emailBuckets[key] || []).push(gi);
    });
    var suspectGroups = {};
    Object.keys(emailBuckets).forEach(function (key) {
      if (emailBuckets[key].length > 1) emailBuckets[key].forEach(function (gi) { suspectGroups[gi] = true; });
    });
    var out = new Map();
    groups.forEach(function (g, gi) {
      var winner = winners[gi];
      g.forEach(function (r) {
        out.set(r, {
          dup: g.length,
          superseded: r !== winner,
          suspect: r === winner && !!suspectGroups[gi],
        });
      });
    });
    return out;
  }

  function perQuestion(rows, sectors) {
    const out = {};
    const ans = rowsWithAnswers(rows);
    sectors.forEach(sector => {
      const { fixed, topics } = sectorIds(sector);
      fixed.concat(topics).forEach(id => {
        let yes = 0, asked = 0;
        ans.forEach(r => {
          const v = r.answers[id];
          if (v === 'yes' || v === 'no') { asked++; if (v === 'yes') yes++; }
        });
        out[id] = { yes, asked, rate: asked ? yes / asked : 0 };
      });
    });
    return out;
  }

  // Per sector: levels[0..2][i] = Yes-rate of that fixed question; levels[3][i] =
  // fraction of answered rows reaching advanced slot i+1. null if no answers at all.
  function intensities(rows, sectors, pq) {
    const ans = rowsWithAnswers(rows);
    if (!ans.length) return null;
    const out = {};
    sectors.forEach(sector => {
      const levels = [0, 1, 2].map(li => (sector.levels[li] || []).map(q => pq[q.id].rate));
      const adv = ans.map(r => advYesCount(sector, r.answers));
      levels[3] = [0, 1, 2, 3].map(i => adv.filter(c => c >= i + 1).length / ans.length);
      out[sector.id] = { levels };
    });
    return out;
  }

  function sectorStandings(rows, sectors) {
    return sectors.map(s => ({
      id: s.id, name: s.name,
      avg: rows.length ? rows.reduce((n, r) => n + ((r.greens && r.greens[s.id]) || 0), 0) / rows.length : 0,
    })).sort((a, b) => b.avg - a.avg);
  }

  function leaderboard(rows, sectors, n) {
    return rows.map(r => ({
      campName: r.campName, leadName: r.leadName, total: r.total || 0,
      perfectSectors: sectors.filter(s => ((r.greens && r.greens[s.id]) || 0) === 10).length,
      resultUrl: r.resultUrl || '',
      // Render data for the admin mini badges + "new this week" dot. Stays
      // admin-only: /api/city rebuilds its body field-by-field and never
      // exposes the leaderboard.
      greens: r.greens || {}, answers: r.answers || {},
      timestamp: r.timestamp || 0, schemaVersion: r.schemaVersion || '',
    })).sort((a, b) => b.total - a.total).slice(0, n || 10);
  }

  // City-tab extremes. minAsked (default 3) keeps a question answered by one
  // or two camps from winning "hardest"/"easiest". Write-in X-camp topics are
  // excluded from topL4 (their shared title says nothing about what camps
  // actually do).
  function superlatives(agg, sectors, minAsked) {
    var min = minAsked == null ? 3 : minAsked;
    // Standings list every sector even with zero camps; no camps -> no extremes.
    var st = agg.count ? (agg.sectorStandings || []) : [];
    var hardest = null, easiest = null, topL4 = null, topL3 = null;
    sectors.forEach(function (sector) {
      [].concat.apply([], sector.levels.slice(0, 3)).forEach(function (q) {
        var pq = agg.perQuestion[q.id];
        if (!pq || pq.asked < min) return;
        if (!hardest || pq.rate < hardest.rate)
          hardest = { id: q.id, sector: sector.name, title: q.prompt || q.title, rate: pq.rate, asked: pq.asked };
        if (!easiest || pq.rate > easiest.rate)
          easiest = { id: q.id, sector: sector.name, title: q.prompt || q.title, rate: pq.rate, asked: pq.asked };
      });
      (sector.levels[2] || []).forEach(function (q) {
        var pq = agg.perQuestion[q.id];
        if (!pq || !pq.yes) return;
        if (!topL3 || pq.yes > topL3.yes)
          topL3 = { id: q.id, sector: sector.name, title: q.prompt || q.title, yes: pq.yes, asked: pq.asked };
      });
      (sector.tier4Topics || []).forEach(function (t) {
        if (/-camp(-\d+)?$/.test(t.id)) return;
        var pq = agg.perQuestion[t.id];
        if (!pq || !pq.yes) return;
        if (!topL4 || pq.yes > topL4.yes)
          topL4 = { id: t.id, sector: sector.name, title: t.title, yes: pq.yes, asked: pq.asked };
      });
    });
    return {
      strongest: st[0] || null,
      weakest: st.length ? st[st.length - 1] : null,
      hardest: hardest, easiest: easiest, topL4: topL4, topL3: topL3,
    };
  }

  // Owner-flagged junk/test rows (a truthy "Hidden" sheet cell, surfaced via
  // shapeAdminRows' `hidden` field) are excluded from every aggregate here —
  // this is the single shared choke point both /api/city and the admin City
  // tab compute through — but the raw admin response list (Camps tab) is
  // untouched so the owner can still see and audit them. No `hidden` field
  // (sheet not yet updated) is falsy, so nothing is excluded: a no-op.
  function isHidden(row) {
    return !!(row && row.hidden);
  }

  // "This week" means the current calendar week, resetting Monday 00:00
  // PACIFIC time (America/Los_Angeles, playa time) in every environment, so
  // the admin page (browser-local) and the Worker's /api/city (UTC isolate)
  // flip at the same moment. It was a rolling 7-day window before, which
  // never visibly resets — last week's camps lingered in the count.
  var WEEK_TZ = 'America/Los_Angeles';
  function tzOffsetMs(t) {
    var p = {};
    new Intl.DateTimeFormat('en-US', { timeZone: WEEK_TZ, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(t).forEach(function (x) { p[x.type] = x.value; });
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
      - Math.floor(t / 1000) * 1000;
  }
  function weekStartMs(now) {
    var off = tzOffsetMs(now);
    var clock = new Date(now + off); // Pacific wall clock, read via getUTC*
    var mondayClock = Date.UTC(clock.getUTCFullYear(), clock.getUTCMonth(), clock.getUTCDate())
      - ((clock.getUTCDay() + 6) % 7) * 864e5;
    // Resolve the boundary with its own offset, not `now`'s — they differ when
    // a DST flip (always a Sunday) sits between Monday 00:00 and `now`.
    return mondayClock - tzOffsetMs(mondayClock - off);
  }

  // ── Playa addresses + visit tracking (admin map) ──────────────────────────
  // A BRC address is a polar coordinate: clock radial (2:00-10:00) by lettered
  // ring (Esplanade, then A-K). parse -> {hour, ring}; unparseable -> null so
  // the map surfaces the row for a sheet fix instead of guessing.
  var RING_LETTERS = 'abcdefghijk'; // ring 1..11; ring 0 is Esplanade
  function parsePlayaAddress(str) {
    if (typeof str !== 'string') return null;
    var s = str.trim().toLowerCase();
    if (!s) return null;
    var hour = null, m;
    if ((m = s.match(/(^|\D)(\d{1,2})[:.](\d{2})(\D|$)/))) {
      if (+m[3] >= 60) return null;
      hour = +m[2] + (+m[3]) / 60;
    } else if ((m = s.match(/(^|\D)(\d{3,4})(\D|$)/))) { // "730" -> 7:30
      if (+m[2] % 100 >= 60) return null;
      hour = Math.floor(+m[2] / 100) + (+m[2] % 100) / 60;
    } else if ((m = s.match(/(^|\D)(\d{1,2})(\D|$)/))) { // bare "7" -> 7:00
      hour = +m[2];
    }
    if (hour == null || hour < 2 || hour > 10) return null;
    var ring = null;
    if (/\besp(lanade)?\b/.test(s)) ring = 0;
    else if ((m = s.match(/(^|[^a-z])([a-k])(?![a-z])/))) ring = RING_LETTERS.indexOf(m[2]) + 1;
    if (ring == null) return null;
    return { hour: hour, ring: ring };
  }
  // Unit-space geometry: Man at the origin, 12:00 up, SVG y-axis down, so
  // 6:00 (the gate) points straight down. Esplanade at 0.40, +0.05 per ring
  // (K = 0.95) — the map scales these to pixels.
  function playaRingRadius(ring) { return 0.40 + ring * 0.05; }
  function playaXY(addr) {
    var th = (addr.hour / 12) * 2 * Math.PI;
    var r = playaRingRadius(addr.ring);
    return { x: r * Math.sin(th), y: -r * Math.cos(th) };
  }
  // Owner-typed "Visit" sheet cell (column T or later — after Hidden, since
  // doPost's appendRow is positional): blank = needs visit, a volunteer name =
  // assigned, a leading check mark or done/visited = done. Fails open to
  // "assigned" for any other text.
  function visitState(visit) {
    var s = typeof visit === 'string' ? visit.trim() : '';
    if (!s) return 'none';
    return /^(✓|✔|done\b|visited\b)/i.test(s) ? 'done' : 'assigned';
  }
  function visitAssignee(visit) {
    var s = typeof visit === 'string' ? visit.trim() : '';
    return s.replace(/^[✓✔]\s*/, '').replace(/^(done|visited)\b[\s:,-]*/i, '').trim();
  }
  // Walking order for one volunteer's camps: a single sweep across the city —
  // clock hour ascending, then ring outward. Unmappable camps sort last, by name.
  function visitOrder(camps) {
    return (camps || []).slice().sort(function (a, b) {
      var pa = parsePlayaAddress(a.campLocation), pb = parsePlayaAddress(b.campLocation);
      if (!pa && !pb) return String(a.campName || '').localeCompare(String(b.campName || ''));
      if (!pa) return 1;
      if (!pb) return -1;
      return (pa.hour - pb.hour) || (pa.ring - pb.ring);
    });
  }

  function computeAggregates(rows, sectors, now) {
    rows = (rows || []).filter(function (r) { return !isHidden(r); });
    const legacyCount = rows.filter(isLegacy).length;
    rows = rows.filter(r => !isLegacy(r));
    // Collapse repeat submissions to one row per camp (latest wins) before ANY
    // tally, so /api/city and every admin aggregate count camps, not rows. This
    // is the single shared choke point: both the Worker's /api/city and the
    // admin page reach the aggregates through computeAggregates.
    rows = dedupeRows(rows);
    const pq = perQuestion(rows, sectors);
    const totalYes = rows.reduce((n, r) => n + (r.total || 0), 0);
    const totalPossible = rows.length * sectors.length * 10;
    const weekStart = weekStartMs(now);
    return {
      count: rows.length,
      legacyCount,
      totalYes, totalPossible,
      tallyPct: totalPossible ? totalYes / totalPossible : 0,
      sectorStandings: sectorStandings(rows, sectors),
      leaderboard: leaderboard(rows, sectors, 10),
      perQuestion: pq,
      intensities: intensities(rows, sectors, pq),
      hasAnswers: rowsWithAnswers(rows).length > 0,
      momentum: { thisWeek: rows.filter(r => typeof r.timestamp === 'number' && r.timestamp >= weekStart).length },
    };
  }

  const api = { computeAggregates, weekStartMs, perQuestion, intensities, sectorStandings, leaderboard, superlatives, sectorIds, advYesCount, isLegacy, isHidden, dedupeRows, dedupeInfo,
    parsePlayaAddress, playaRingRadius, playaXY, visitState, visitAssignee, visitOrder };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AdminAggregate = api;
})(typeof window !== 'undefined' ? window : this);
