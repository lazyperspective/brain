// tl.js — the timelines. Every cue (picture and sound) reads from here.
// Two cuts share the same scenes:
//   v2 (default) — 24 s, cold open on the mirror; the linear story below is rotated by OFF so the
//                  file starts at the first formed face and the short black sits near the end.
//   v1 (?cut=v1) — the original 46 s cut that opens on the black cursor.
// All times are "linear" story seconds (cursor -> library -> mirror -> city -> rooms -> dark -> cursor);
// film time = linear time - OFF (mod D).
(function (g) {
  'use strict';
  const V1 = {
    name: 'v1', D: 46, FPS: 30, OFF: 0,
    key: 3.2, slit: [3.3, 4.0], part: [4.0, 4.35], door: [4.35, 5.2], s2: 5.2,
    s2pre: 2.0, s2len: 12.5, turn: [9.2, 10.3],
    s23: [15.0, 15.9], gather: [15.6, 17.2], faces: [17.2, 22.4], collapse: [22.4, 23.5], lantern: [23.5, 24.5],
    regress: [24.3, 25.6], glassCity: [25.3, 26.1], mIris: [26.0, 27.0],
    s3rate: 0.016, faceShift: 0, faceScale: 1.18, faceOrder: [0, 1, 2, 3, 4, 5], swirl: 16,
    wIris: [30.8, 31.6], pan0: 31.6, rest: 1.42, move: 0.6, nTrack: 4, rooms: [0, 1, 2, 3, 4, 1], col0: 160,
    lapClose: 40.7, dim: [41.4, 42.6], toWide: [42.9, 43.5], curOn: 43.9, bIris: [44.7, 45.5],
    life: 1
  };
  V1.cursorOn = t => { const f = (t + 0.1) - Math.floor(t + 0.1); return f < 0.6; };
  const V2 = {
    name: 'v2', D: 24, FPS: 30, OFF: 5.25,
    key: 0.30, slit: [0.35, 0.75], part: [0.75, 1.0], door: [1.0, 1.55], s2: 1.55,
    s2pre: 0.6, s2len: 3.3, turn: [1.9, 2.7],
    s23: [3.75, 4.35], gather: [3.85, 5.25], faces: [5.25, 8.25], collapse: [8.25, 9.15], lantern: [9.15, 9.85],
    regress: [9.75, 10.55], glassCity: [10.35, 10.95], mIris: [10.85, 11.65],
    s3rate: 0.05, faceShift: 0.5, faceScale: 1.26, faceOrder: [2, 1, 0, 3, 4, 5], swirl: 26,
    wIris: [12.95, 13.65], pan0: 13.65, rest: 1.15, move: 1.05, nTrack: 3, rooms: [0, 2, 3, 4, 1, 2], col0: 180,
    lapClose: 20.75, dim: [21.15, 22.05], toWide: [22.15, 22.65], curOn: 22.85, bIris: [23.45, 24.0],
    life: 2
  };
  // cursor blink: 0.45 s on / 0.25 s off, phased from the moment it first appears in the dark window
  V2.cursorOn = t => { let u = t - V2.curOn; if (u < -1) u += V2.D; const f = u - Math.floor(u / 0.7) * 0.7; return f < 0.45; };
  let cut = g.CUT || 'v2';
  if (typeof location !== 'undefined') { const m = /[?&]cut=(v\d)/.exec(location.search); if (m) cut = m[1]; }
  const TL = cut === 'v1' ? V1 : V2;
  TL.arrive5 = TL.pan0 + TL.nTrack * (TL.rest + TL.move);
  TL.film = lin => (((lin - TL.OFF) % TL.D) + TL.D) % TL.D;   // linear -> film seconds
  g.TL = TL; g.TLS = { v1: V1, v2: V2 };
})(typeof window !== 'undefined' ? window : globalThis);
