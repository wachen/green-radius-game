// result-state.js — encode/decode a Green Radius result into a URL hash.
// Used by the game (build the link) and /result/ (render it). No dependencies; runs in browser + node.
(function (global) {
  'use strict';
  var SECTOR_IDS = ['food', 'water', 'waste', 'transport', 'shelter', 'power'];

  function toB64Url(str) {
    var b64 = (typeof btoa === 'function')
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf8').toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64Url(s) {
    var b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return (typeof atob === 'function')
      ? decodeURIComponent(escape(atob(b64)))
      : Buffer.from(b64, 'base64').toString('utf8');
  }

  function encode(payload) {
    var greens = SECTOR_IDS.map(function (id) {
      return Math.max(0, Math.min(4, ((payload.greens || {})[id]) | 0));
    });
    return toB64Url(JSON.stringify({ c: payload.campName || '', l: payload.leadName || '', y: payload.year | 0, g: greens }));
  }

  function decode(hash) {
    var h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    try {
      var o = JSON.parse(fromB64Url(h));
      if (!o || !Array.isArray(o.g) || o.g.length !== 6) return null;
      var greens = {};
      SECTOR_IDS.forEach(function (id, i) { greens[id] = Math.max(0, Math.min(4, o.g[i] | 0)); });
      return { campName: o.c || '', leadName: o.l || '', year: o.y | 0, greens: greens };
    } catch (e) { return null; }
  }

  // Greens are always a contiguous prefix in this game, so count fully determines the visual.
  function greensToLevelStates(greens) {
    var ls = {};
    SECTOR_IDS.forEach(function (id) {
      var k = (greens[id]) | 0;
      ls[id] = [0, 1, 2, 3].map(function (i) { return i < k ? 'green' : 'locked'; });
    });
    return ls;
  }

  var api = { encode: encode, decode: decode, greensToLevelStates: greensToLevelStates, SECTOR_IDS: SECTOR_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ResultState = api;
})(typeof window !== 'undefined' ? window : this);
