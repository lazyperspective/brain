// main.js -- the picture as a list of steps, in the order a hand would work: far to near, soft to sharp.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S;
  A.steps = function (W, H) {
    const C = new A.Canvas(W, H, '#2f2852', 20261113);
    const rng = A.rng(4711);
    const r = []; for (let i = 0; i < 40; i++) r.push(rng.fork());
    const all = [
      ['sky', () => { S.buildCloud(); S.drawSky(C, r[0]); }],
      ['cloud', () => { S.drawCloud(C, r[1]); S.drawWisps(C, r[2]); S.drawMoon(C, r[3]); }],
      ['far town', () => S.drawFar && S.drawFar(C, r[4])],
      ['near town', () => S.drawTown && S.drawTown(C, r[5])],
      ['roof', () => { S.drawRoof(C, r[6]); if (S.drawBack) S.drawBack(C, r[10]); }],
      ['wheel', () => S.drawWheel && S.drawWheel(C, r[7])],
      ['things on the roof', () => S.drawThings && S.drawThings(C, r[8])],
      ['last touches', () => S.finishing && S.finishing(C, r[9])],
    ];
    return { C, steps: all };
  };
  A.draw = function (W, H, opt) {
    opt = opt || {};
    const log = opt.log || (() => {}), stage = opt.stage === undefined ? 99 : opt.stage;
    const { C, steps } = A.steps(W, H);
    steps.forEach((st, i) => { if (i <= stage) { st[1](); log(st[0]); } });
    return C;
  };
})(typeof self !== 'undefined' ? self : globalThis);
