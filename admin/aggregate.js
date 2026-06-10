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
  function rowsWithAnswers(rows) {
    return rows.filter(r => r.answers && Object.keys(r.answers).length > 0);
  }
  // Pre-rework rows (before the 0-10 per-question capture) have no schema tag and
  // no per-question answers; their greens mean levels-lit 0-4, not questions 0-10.
  function isLegacy(row) {
    return !row.schemaVersion && (!row.answers || Object.keys(row.answers).length === 0);
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
    })).sort((a, b) => b.total - a.total).slice(0, n || 10);
  }

  function computeAggregates(rows, sectors, now, windowMs) {
    const legacyCount = rows.filter(isLegacy).length;
    rows = rows.filter(r => !isLegacy(r));
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

  const api = { computeAggregates, perQuestion, intensities, sectorStandings, leaderboard, sectorIds, advYesCount, isLegacy };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.AdminAggregate = api;
})(typeof window !== 'undefined' ? window : this);
