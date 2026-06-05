// result-state.js — encode/decode a Green Radius result into a URL hash.
// Used by the game (build the link) and /result/ (render it). No dependencies; runs in browser + node.
//
// v2 carries the exact per-question fill so the shared page matches the in-app
// graphic. Per sector we pack: fixedBits (6-bit pattern over the 6 fixed
// Level 1–3 questions) and advCount (0–4 advanced Yeses) as `fixedBits*5 + advCount`.
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

  // fills[sectorId] = { levels: [bool[1], bool[2], bool[3], bool[4]] }
  function packSector(fill) {
    var levels = (fill && fill.levels) || [[], [], [], []];
    var fixed = [].concat(levels[0] || [], levels[1] || [], levels[2] || []); // 6 bools
    var bits = 0;
    for (var i = 0; i < 6; i++) if (fixed[i]) bits |= (1 << i);
    var advCount = (levels[3] || []).filter(Boolean).length; // 0..4
    return bits * 5 + Math.min(4, advCount); // 0..319
  }

  function unpackSector(packed) {
    var p = packed | 0;
    var advCount = p % 5;
    var bits = Math.floor(p / 5);
    var fixed = [];
    for (var i = 0; i < 6; i++) fixed.push(!!(bits & (1 << i)));
    var levels = [[fixed[0]], [fixed[1], fixed[2]], [fixed[3], fixed[4], fixed[5]],
      [0, 1, 2, 3].map(function (j) { return j < advCount; })];
    var totalYes = fixed.filter(Boolean).length + advCount;
    return { levels: levels, totalYes: totalYes, played: true };
  }

  // Legacy v1: greens count 0–4 per sector → contiguous fill (level li full if li < count).
  function fromLegacyGreens(g) {
    var sizes = [1, 2, 3, 4];
    return SECTOR_IDS.reduce(function (acc, id, i) {
      var count = Math.max(0, Math.min(4, g[i] | 0));
      var levels = sizes.map(function (n, li) {
        return Array.from({ length: n }, function () { return li < count; });
      });
      var totalYes = sizes.reduce(function (s, n, li) { return s + (li < count ? n : 0); }, 0);
      acc[id] = { levels: levels, totalYes: totalYes, played: count > 0 };
      return acc;
    }, {});
  }

  function encode(payload) {
    var fills = payload.fills || {};
    var p = SECTOR_IDS.map(function (id) { return packSector(fills[id]); });
    return toB64Url(JSON.stringify({ v: 2, c: payload.campName || '', l: payload.leadName || '', y: payload.year | 0, p: p }));
  }

  function decode(hash) {
    var h = (hash || '').replace(/^#/, '');
    if (!h) return null;
    try {
      var o = JSON.parse(fromB64Url(h));
      if (!o) return null;
      var fills;
      if (Array.isArray(o.p) && o.p.length === 6) {
        fills = {};
        SECTOR_IDS.forEach(function (id, i) { fills[id] = unpackSector(o.p[i]); });
      } else if (Array.isArray(o.g) && o.g.length === 6) {
        fills = fromLegacyGreens(o.g);
      } else {
        return null;
      }
      return { campName: o.c || '', leadName: o.l || '', year: o.y | 0, fills: fills };
    } catch (e) { return null; }
  }

  var api = { encode: encode, decode: decode, SECTOR_IDS: SECTOR_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ResultState = api;
})(typeof window !== 'undefined' ? window : this);
