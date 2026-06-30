// rank.js — a camp's playa-rank title from its total Green Radius score (0–60).
// Isomorphic (browser + Worker): the done screen + share text read window.Rank;
// the Worker imports titleFor for the per-camp OG description. Resolve the global
// via globalThis (defined in browser, Worker, and Bun) so importing this into the
// Worker bundle never throws on an undefined top-level `this`.
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
