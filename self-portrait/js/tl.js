// tl.js — the timeline. Every cue (picture and sound) reads from here.
(function (g) {
  'use strict';
  const TL = {
    D: 46,            // loop length (s)
    FPS: 30,
    key: 3.2,         // first keystroke
    slit: [3.3, 4.0], // cursor stretches into a slit of light
    part: [4.0, 4.35],// slit parts into a doorway
    door: [4.35, 5.2],// camera goes through
    s2: 5.2,
    s23: [15.0, 15.9],// dither dissolve library -> mirror
    gather: [15.6, 17.2],
    faces: [17.2, 22.4],
    collapse: [22.4, 23.5],
    lantern: [23.5, 24.5],
    regress: [24.3, 25.6],
    glassCity: [25.3, 26.1],
    mIris: [26.0, 27.0],  // push through the mirror
    wIris: [30.8, 31.6],  // push into a window
    pan0: 31.6,
    rest: 1.42, move: 0.6, // per room
    lapClose: 40.7,
    dim: [41.4, 42.6],
    toWide: [42.9, 43.5],
    curOn: 43.9,
    bIris: [44.7, 45.5]
  };
  TL.arrive5 = TL.pan0 + 4 * (TL.rest + TL.move); // 39.68
  TL.cursorOn = t => { const f = (t + 0.1) - Math.floor(t + 0.1); return f < 0.6; };
  g.TL = TL;
})(typeof window !== 'undefined' ? window : globalThis);
