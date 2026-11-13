// main.js -- the picture as a list of steps, in the order a hand would work.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S, Wd = A.Wd;
  A.TITLE = 'Still Warm';
  A.steps = function (W, H) {
    const C = new A.Sheet(W, H, 19410923);
    const rng = A.rng(4127);
    const r = []; for (let i = 0; i < 40; i++) r.push(rng.fork());
    const all = [], add = (name, f) => all.push([name, f]);
    const nM = Wd.SM.length - 1, nS = Wd.SK.filter(s => s <= 2.75).length;
    add('the plan, in graphite', () => S.under(C, r[0]));
    for (let j = 0; j < nM; j++) add('the mound, ring ' + (j + 1) + ' of ' + nM, () => S.moundRing(C, r[1], j));
    for (let k = 0; k < 4; k++) add('rubbing it out', () => S.forget(C, r[2], k));
    for (let j = 0; j < nS; j++) add('night and morning', () => S.skyBase(C, r[3], j));
    add('the low light', () => S.skyGlow(C, r[3]));
    for (let j = 0; j < nS; j++) add('pencil in the sky', () => S.skyLines(C, r[3], j));
    add('sleet and stars', () => S.stars(C, r[4]));
    for (let i = 0; i < 6; i++) add('under the ground', () => S.earthLayer(C, r[5], i));
    add('stones and buried signs', () => S.earthThings(C, r[5]));
    add('the small hill', () => S.hill(C, r[6]));
    add('frost, stubble, the first green', () => S.surface(C, r[7]));
    add('the two threads', () => S.thread(C, r[8]));
    add('the outline, once more', () => S.outline(C, r[9]));
    add('the frieze', () => S.frieze(C, r[10]));
    add('time', () => S.time(C, r[11]));
    return { C, steps: all };
  };
  A.draw = function (W, H, o) {
    o = o || {};
    const log = o.log || (() => {}), stage = o.stage === undefined ? 999 : o.stage;
    const { C, steps } = A.steps(W, H);
    let last = '';
    steps.forEach((st, i) => { if (i <= stage) { st[1](); if (st[0] !== last) log(st[0]); last = st[0]; } });
    return C;
  };
})(typeof self !== 'undefined' ? self : globalThis);
