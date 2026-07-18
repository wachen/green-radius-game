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

  // Read-time, latest-wins dedup so repeat submissions (retries, redos) count
  // once instead of permanently inflating every tally. Identity precedence:
  //   campId (rides inside the answers blob) → normalized email → normalized
  //   camp name → none (row kept as-is; no key means no merge).
  // "Latest" = highest timestamp; on a tie the later array position wins (sheet
  // rows are appended chronologically, so that is the more recent submission).
  // NOTE: a camp's pre-campId rows key on email while its post-campId rows key
  // on campId, so those two eras won't merge — that only affects the migration
  // window; the common retry-storm case (same client, same campId) collapses.
  function identityKey(row) {
    if (!row) return '';
    var cid = (row.answers && row.answers.campId) || row.campId;
    if (typeof cid === 'string' && cid.trim()) return 'id:' + cid.trim();
    var email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : '';
    if (email) return 'em:' + email;
    var name = typeof row.campName === 'string' ? row.campName.trim().toLowerCase() : '';
    if (name) return 'nm:' + name;
    return '';
  }
  function dedupeRows(rows) {
    var latest = new Map();
    var anon = [];
    (rows || []).forEach(function (r) {
      var key = identityKey(r);
      if (!key) { anon.push(r); return; }
      var prev = latest.get(key);
      if (!prev || (r.timestamp | 0) >= (prev.timestamp | 0)) latest.set(key, r);
    });
    return Array.from(latest.values()).concat(anon);
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

  function computeAggregates(rows, sectors, now, windowMs) {
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
    const wMs = windowMs || 7 * 864e5;
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
      momentum: { thisWeek: rows.filter(r => typeof r.timestamp === 'number' && now - r.timestamp <= wMs).length },
    };
  }

  const api = { computeAggregates, perQuestion, intensities, sectorStandings, leaderboard, superlatives, sectorIds, advYesCount, isLegacy, isHidden, dedupeRows, identityKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AdminAggregate = api;
})(typeof window !== 'undefined' ? window : this);
