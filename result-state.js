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
    // `u` (the camp's stable campId) is additive and optional: it rides inside
    // the same v2 envelope, so links stay v2 and every existing decoder — old
    // browsers, the Worker OG path — ignores the extra key and still resolves
    // the card. Omitted when absent to keep legacy-style links byte-identical.
    var o = { v: 2, c: payload.campName || '', l: payload.leadName || '', y: payload.year | 0, p: p };
    if (payload.campId) o.u = String(payload.campId);
    // `cv` (content/question-set version, e.g. game-data.js CONTENT_VERSION)
    // is additive and optional too, same reasoning as `u`: lets a future
    // year-over-year comparison (ghost ring) tell whether two result links
    // answered the same question set. Omitted when the caller doesn't pass it.
    if (payload.contentVersion) o.cv = String(payload.contentVersion);
    return toB64Url(JSON.stringify(o));
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
      // campId is present only on newer v2 links (see encode). Legacy v1/v2
      // links have none, so it decodes to null — every caller must treat null
      // as "unknown camp" and mint a fresh id.
      // contentVersion (cv) is likewise optional: absent on every link minted
      // before this field existed, so it decodes to `undefined` — callers
      // must treat that as "unknown content version", not as a real value.
      return { campName: o.c || '', leadName: o.l || '', year: o.y | 0, fills: fills, campId: o.u || null, contentVersion: o.cv };
    } catch (e) { return null; }
  }

  // Rebuild a current-shape localStorage save from a decoded result so a camp
  // can resume on any device (the /result/ "Continue improving" action). Pure +
  // isomorphic: STORAGE_VERSION, a fallback campId, and the timestamp are passed
  // in by the caller (they live in the game's core scope, not here).
  //
  // Fills carry only per-question booleans (fixed Levels 1–3) and an advanced
  // COUNT (Level 4), so we map fixed answers positionally against the current
  // SECTORS and mark the first N advanced topics Yes to reproduce the count.
  // Notes are not in the payload, so they are simply absent (not faked).
  //
  // Schema-drift policy: import-what-aligns. If a sector's current fixed-question
  // count no longer matches the payload, only the positionally-aligned answers
  // are set (bounded by the shorter of the two) and any advanced count beyond the
  // available topics is dropped. This never throws and never corrupts — the game
  // recomputes every fill from `answers` — so a friendly partial import beats
  // refusing the whole card. A real question-schema change would ship its own
  // payload-format bump; positional drift within v2 degrades quietly.
  function reconstructSave(decoded, sectors, opts) {
    opts = opts || {};
    decoded = decoded || {};
    var fills = decoded.fills || {};
    var answers = {};
    var sectorCursor = {}, sectorClosed = {};
    (sectors || []).forEach(function (s) {
      var fill = fills[s.id] || { levels: [[], [], [], []] };
      var levels = fill.levels || [[], [], [], []];
      for (var li = 0; li < 3; li++) {
        var qs = (s.levels && s.levels[li]) || [];
        var bits = levels[li] || [];
        for (var i = 0; i < qs.length && i < bits.length; i++) {
          answers[qs[i].id] = bits[i] ? 'yes' : 'no';
        }
      }
      var advCount = (levels[3] || []).filter(Boolean).length;
      var topics = s.tier4Topics || [];
      for (var t = 0; t < advCount && t < topics.length; t++) answers[topics[t].id] = 'yes';
      sectorCursor[s.id] = 4;
      sectorClosed[s.id] = true;
    });
    return {
      version: opts.version,
      phase: 'done',
      camp: { campName: decoded.campName || '', leadName: decoded.leadName || '', email: '' },
      campId: decoded.campId || opts.campId,
      sectorCursor: sectorCursor,
      sectorClosed: sectorClosed,
      answers: answers,
      customNotes: {},
      mode: 'board',
      submittedAt: opts.now || (typeof Date !== 'undefined' ? new Date().toISOString() : null),
      resumed: true,
    };
  }

  var api = { encode: encode, decode: decode, reconstructSave: reconstructSave, SECTOR_IDS: SECTOR_IDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.ResultState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
