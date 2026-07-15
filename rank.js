// rank.js — a camp's playa-rank title from its total Green Radius score (0–60).
// RETIRED: rank titles were removed from all surfaces (email, OG description,
// UI) in #66; nothing loads or imports this anymore. The file stays committed
// and served (like vendor/babel-standalone) so cached pre-#66 pages that still
// request it keep working; delete once cached HTML has aged out.
(function (global) {
  'use strict';
  var BANDS = [
    { min: 0,  title: 'First Spark' },
    { min: 11, title: 'Dusty Ember' },
    { min: 21, title: 'Rising Glow' },
    { min: 31, title: 'Wide Beacon' },
    { min: 41, title: 'Solar Camp' },
    { min: 51, title: 'Green Supernova' },
  ];
  function titleFor(total) {
    var t = Math.max(0, Math.min(60, total | 0));
    var out = BANDS[0].title;
    for (var i = 0; i < BANDS.length; i++) if (t >= BANDS[i].min) out = BANDS[i].title;
    return out;
  }
  var api = { titleFor: titleFor, BANDS: BANDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Rank = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
