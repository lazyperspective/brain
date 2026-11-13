// river.js -- where the water was, there are flowers now: white ones, all the way down the channel to
// the far shore. Close to, each one is drawn (the way you learn to draw a flower: middle first, then
// petals all the way round). Far off they are dots, then dashes, then a chalk line.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});

  const inR = (x, y) => y > Wd.HZ + 6 && Wd.riv(x, y) > -0.03 && Wd.clear(x, y) && !Wd.silt(x, y);
  const lightR = (x, y) => Wd.light(x, y);

  // the green underneath
  function understory(C, rng) {
    const bands = [[214, 262, 3.2], [258, 330, 5], [326, 420, 7.5], [416, 540, 10.5], [536, 700, 14], [696, 905, 18]];
    for (const b of bands) {
      const R = A.region([-4, b[0], 1604, b[1]], (x, y) => y >= b[0] && y < b[1] && inR(x, y));
      const far = b[0] < 300;
      A.scribble(C, rng, R, { tool: far ? T.crayonTip : T.crayon, colAt: (x, y, r) => (lightR(x, y) + r.g() * 0.1 > 0.5 ? (r.chance(0.6) ? K.pist : K.sap) : (r.chance(0.5) ? K.sap : K.moss)), w: b[2], gap: b[2] * 0.48, ang: 0.04 + rng.g() * 0.04, p: 0.9, over: 2, under: 0, run: 6, wob: 0.8 });
      A.scribble(C, rng, R, { tool: far ? T.crayonTip : T.crayon, colAt: (x, y, r) => (lightR(x, y) + r.g() * 0.1 > 0.5 ? (r.chance(0.5) ? K.sap : K.moss) : (r.chance(0.5) ? K.spruce : r.chance(0.5) ? K.moss : K.slate)), w: b[2] * 0.9, gap: b[2] * 0.58, ang: -0.3 + rng.g() * 0.1, p: 0.7, over: 1, under: 1, run: 4, wob: 0.8, skip: 0.12 });
      if (!far) A.hatch(C, rng, R, { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.6) ? K.spruce : K.pine), w: 1.3 + b[2] * 0.04, gap: 2.5 + b[2] * 0.3, ang: 1.15 + rng.g() * 0.1, p: 0.6, seg: 6 + b[2] * 1.4, skip: 0.25 });
      A.scribble(C, rng, A.region(R.bbox, (x, y) => R.inside(x, y) && lightR(x, y) < 0.4), { tool: far ? T.crayonTip : T.crayon, colAt: (x, y, r) => (r.chance(0.5) ? K.spruce : K.slate), w: b[2] * 0.85, gap: b[2] * 0.62, ang: 0.22, p: 0.62, over: 1, under: 1, run: 4, wob: 0.8, skip: 0.1 });
      A.hatch(C, rng, A.region(R.bbox, (x, y) => R.inside(x, y) && lightR(x, y) < 0.45), { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.5) ? K.slate : K.spruce), w: 1.3 + b[2] * 0.04, gap: 2.2 + b[2] * 0.25, ang: -0.3, p: 0.65, seg: 8 + b[2] * 1.6, skip: 0.1 });
    }
  }

  // rushes along both banks: a dark, taller fringe that draws the channel's edge for you
  function rushes(C, rng) {
    for (let y = 232; y < 905; y += 0.7 + 5.5 * Wd.d(y)) {
      const d = Wd.d(y), stepx = 1.2 + 4.2 * d;
      for (let x = -4; x < 1604; x += stepx * (0.5 + rng())) {
        const e = Wd.riv(x, y);
        if (e < -0.2 || e > 0.16) continue;
        if (rng.chance(0.25) || !Wd.clear(x, y)) continue;
        const L = Wd.light(x, y), q = rng();
        const col = L > 0.5 ? (q < 0.35 ? K.moss : q < 0.6 ? K.sap : q < 0.78 ? K.olive : q < 0.9 ? K.spruce : K.straw) : (q < 0.5 ? K.spruce : q < 0.8 ? K.pine : K.moss);
        const len = (3 + 44 * Math.pow(d, 1.1)) * (0.5 + 0.8 * rng());
        Wd.flick(C, rng, rng.chance(0.45) ? T.crayonTip : T.pencil, v(col, rng, 0.02), x, y, len, Wd.lean(x, y) * 0.6 + rng.g() * 0.1, 1.2 + 2.0 * d, 0.88);
        if (d > 0.3 && rng.chance(0.12)) { // a brown rush-head
          const ln = Wd.lean(x, y) * 0.6;
          C.line(rng, T.crayonTip, K.umber, [x + Math.sin(ln) * len * 0.78, y - len * 0.78, x + Math.sin(ln) * len * 0.98, y - len * 0.98], 2 + 2.4 * d, 0.9, { wob: 0.2 });
        }
      }
    }
  }

  // ---- one flower, drawn middle first
  function flower(C, rng, x, y, s, L, plain) {
    const sq = 0.5 + 0.22 * rng() + 0.2 * Wd.d(y);      // flattened: we are looking across them
    const tilt = rng.g() * 0.3;
    const petal = L > 0.45 ? v(K.white, rng, 0.012) : rng.chance(0.6) ? K.shadew : rng.chance(0.6) ? K.far : K.milk;
    if (s < 3.2) { // a dot, and maybe its yellow
      C.dab(T.chalk, petal, x, y, s * 1.15, 0.9);
      if (s > 2.2 && rng.chance(0.4)) C.dab(T.pencil, K.mustard, x, y, 1.1, 0.9);
      return;
    }
    // stem first, a line down into the green
    if (!plain) {
      const sl = s * rng.r(0.9, 2.2), sx = x + rng.g() * s * 0.3;
      C.line(rng, T.pencil, L > 0.45 ? K.moss : K.spruce, A.curve([x, y + s * 0.1, (x + sx) / 2 + rng.g() * s * 0.15, y + sl * 0.5, sx, y + sl]), 1.1 + s * 0.03, 0.75, { wob: 0.3, step: 3 });
    }
    const n = s < 6 ? rng.i(5, 7) : rng.i(7, 11), a0 = rng() * 6.283;
    const pw = Math.max(1.3, s * (s < 6 ? 0.42 : 0.3));
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 6.283 / n + rng.g() * 0.12, r0 = s * 0.14, r1 = s * (0.5 + 0.12 * rng.g());
      const ca = Math.cos(a + tilt), sa = Math.sin(a + tilt) * sq;
      // a petal: out and back
      C.stroke([x + ca * r0, y + sa * r0, 0.9, 0.7, x + ca * r1 * 0.6, y + sa * r1 * 0.6, 1, 1, x + ca * r1, y + sa * r1, 0.8, 0.75], T.chalk, petal, pw, 0.92);
    }
    if (s > 9 && L > 0.45 && rng.chance(0.7)) { // one more go round with the crayon, pressing
      for (let k = 0; k < n; k += 2) {
        const a = a0 + k * 6.283 / n + rng.g() * 0.1, r1 = s * 0.42;
        C.stroke([x + Math.cos(a + tilt) * s * 0.2, y + Math.sin(a + tilt) * sq * s * 0.2, 1, 1, x + Math.cos(a + tilt) * r1, y + Math.sin(a + tilt) * sq * r1, 0.8, 0.8], T.crayonTip, K.white, pw * 0.8, 0.9);
      }
    }
    // the middle
    C.dab(T.crayonTip, L > 0.45 ? K.mustard : K.ochre, x + rng.g() * 0.2, y + rng.g() * 0.2, Math.max(1.5, s * 0.3), 0.95);
    if (s > 7) C.dab(T.pencil, K.ochre, x + s * 0.04, y + s * 0.04 * sq, s * 0.13, 0.9);
    // some get an outline, in whatever pencil was nearest
    if (s > 8 && rng.chance(0.22)) {
      const lp = [];
      for (let k = 0; k <= n * 4; k++) {
        const a = a0 + (k / (n * 4)) * 6.283, rr = s * (0.36 + 0.2 * Math.abs(Math.cos((k / 4) * 3.14159)));
        lp.push(x + Math.cos(a + tilt) * rr, y + Math.sin(a + tilt) * sq * rr);
      }
      C.line(rng, T.pencil, rng.chance(0.5) ? K.slate : K.olive, lp, 1.05, 0.5, { wob: 0.4, step: 2.5, pe: 0.8 });
    }
  }
  Wd.flower = flower;

  // every flower in the channel, decided once so that the boat and the jetty can stand among them
  function plant() {
    const rng = A.rng(7001), list = [];
    for (let y = 238; y < 912;) {
      const d = Wd.d(y), base = Wd.ppm(y) * 0.118;        // a child's flowers are always a bit too big
      const cell = Math.max(1.5, base * 1.02);
      for (let x = -8; x < 1608; x += cell) {
        const fx = x + rng() * cell, fy = y + rng() * cell * 0.62;
        const e = Wd.riv(fx, fy);
        if (e < 0.02) continue;
        if (Wd.silt(fx, fy) && rng.chance(0.93)) continue;
        // drifts and bare green places
        const dens = fbm(fx / (40 + 240 * d), fy / (10 + 110 * d), 3, 7103) + 0.14 * ss(0.0, 0.5, e) + 0.3 * ss(0.3, 0.0, d);
        if (dens < 0.43 && rng.chance(0.85)) continue;
        const s = base * (0.55 + 0.75 * rng()) * (dens > 0.62 ? 1.12 : 0.95);
        list.push({ x: fx, y: fy, s });
      }
      y += cell * 0.6;
    }
    return list;
  }
  Wd.flowers = null;
  Wd.drawFlowers = function (C, rng, pred) {
    const fl = Wd.flowers;
    for (let k = 0; k < fl.length; k++) {
      const f = fl[k];
      if (f.done || !pred(f)) continue;
      f.done = true;
      flower(C, rng, f.x, f.y, f.s, Wd.light(f.x, f.y) + rng.g() * 0.08, false);
    }
  };

  // dried silt, cracked into plates
  function silt(C, rng) {
    const R = A.region([-4, 340, 1604, 905], (x, y) => Wd.silt(x, y) && Wd.clear(x, y));
    A.scribble(C, rng, R, { tool: T.crayon, col: K.bone, w: 9, gap: 5, ang: 0.03, p: 0.6, over: 2, under: 1, run: 5, wob: 0.8 });
    A.scribble(C, rng, R, { tool: T.crayon, colAt: (x, y, r) => (Wd.light(x, y) > 0.5 ? K.cream : r.chance(0.6) ? K.far : K.slate), w: 8, gap: 5.4, ang: -0.08, p: 0.62, over: 1, under: 2, run: 3, wob: 0.8, skip: 0.2 });
    for (let k = 0; k < 2600; k++) {
      const x = rng.r(0, 1600), y = rng.r(340, 900);
      if (!R.inside(x, y)) continue;
      const d = Wd.d(y), L = 3 + 15 * d, a0 = rng() * 6.283;
      for (let b = 0; b < 3; b++) {
        if (rng.chance(0.2)) continue;
        const a = a0 + b * 2.094 + rng.g() * 0.3, ex = x + Math.cos(a) * L * rng.r(0.6, 1.3), ey = y + Math.sin(a) * L * 0.45 * rng.r(0.6, 1.3);
        C.line(rng, T.pencil, rng.chance(0.7) ? K.umber : K.walnut, [x, y, (x + ex) / 2 + rng.g() * L * 0.12, (y + ey) / 2 + rng.g() * L * 0.06, ex, ey], 1.0 + 0.6 * d, 0.6, { wob: 0.3, step: 2.5, pe: 0.3 });
      }
      if (rng.chance(0.3)) Wd.flick(C, rng, T.pencil, rng.pick([K.sap, K.moss, K.pist]), x + rng.g() * L, y + rng.g() * 2, (4 + 20 * d) * rng.r(0.5, 1), rng.g() * 0.4, 1.1 + d, 0.85);
    }
  }

  S.river = function (C, rng) {
    understory(C, rng.fork());
    silt(C, rng.fork());
    rushes(C, rng.fork());
    // the far reaches: chalk lines following the bends, then dashes
    const r2 = rng.fork();
    for (let y = 225; y < 300; y += 0.75 + 0.012 * (y - 225)) {
      for (let x = 0; x < 1600; x += 2.5) {
        if (Wd.riv(x, y) < 0.08) continue;
        const L = Wd.light(x, y), len = r2.r(2, 9);
        C.stroke([x, y + r2.g() * 0.3, 0.9, 1, x + len, y + r2.g() * 0.4, 0.8, 0.8], T.chalk, L > 0.45 ? K.white : K.milk, 1.5, 0.92);
        x += len * 0.6;
      }
    }
    Wd.flowers = plant();
    // everything that isn't hidden by, or in front of, the boat and jetty (they call drawFlowers again later)
    for (const f of Wd.flowers) { f.where = null; for (const o of Wd.occ || []) { const r = o(f); if (r) { f.where = r; break; } } if (f.where === 'skip') f.done = true; }
    Wd.drawFlowers(C, rng.fork(), f => !f.where);
  };
})(typeof self !== 'undefined' ? self : globalThis);
