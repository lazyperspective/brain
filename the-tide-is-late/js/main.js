// main.js -- the picture as a list of steps, in the order a hand would work.
(function (G) {
  'use strict';
  const A = G.ART, S = A.S;
  A.steps = function (W, H) {
    const C = new A.Sheet(W, H, 19970412);
    const rng = A.rng(1107);
    const r = []; for (let i = 0; i < 40; i++) r.push(rng.fork());
    const opt = f => (...a) => f && f(...a);
    const all = [
      ['pencil underdrawing', () => S.underdrawing(C, r[0])],
      ['sky', () => { S.sky(C, r[1]); S.clouds(C, r[2]); }],
      ['far shore', () => S.farShore(C, r[3])],
      ['meadow', () => opt(S.meadow)(C, r[4])],
      ['channel', () => opt(S.river)(C, r[5])],
      ['markers and far bushes', () => opt(S.props)(C, r[11])],
      ['boat', () => opt(S.boat)(C, r[6])],
      ['jetty', () => opt(S.pier)(C, r[7])],
      ['in front', () => opt(S.front)(C, r[8])],
      ['the cloud shadow', () => opt(S.shade)(C, r[12])],
      ['near bank', () => opt(S.near)(C, r[9])],
      ['last touches', () => opt(S.last)(C, r[10])],
    ];
    return { C, steps: all };
  };
  A.draw = function (W, H, o) {
    o = o || {};
    const log = o.log || (() => {}), stage = o.stage === undefined ? 99 : o.stage;
    const { C, steps } = A.steps(W, H);
    steps.forEach((st, i) => { if (i <= stage) { st[1](); log(st[0]); } });
    return C;
  };
})(typeof self !== 'undefined' ? self : globalThis);
