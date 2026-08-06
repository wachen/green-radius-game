// playa-address.js — tolerant Black Rock City address parsing, shared by the
// game intro (soft "does this look like a playa address?" hint) and the admin
// Playa Map (via admin/aggregate.js). Same IIFE + global/CJS guard as
// result-state.js so it runs in the browser (window.PlayaAddress), under bun
// tests, and inside the Worker bundle.
(function (global) {
  // A BRC address is a polar coordinate: clock radial (2:00-10:00) by lettered
  // ring (Esplanade, then A-K). parse -> {hour, ring}; unparseable -> null so
  // callers surface the text for a fix instead of guessing.
  var RING_LETTERS = 'abcdefghijk'; // ring 1..11; ring 0 is Esplanade
  function parse(str) {
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

  var api = { parse: parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.PlayaAddress = api;
})(typeof window !== 'undefined' ? window : this);
