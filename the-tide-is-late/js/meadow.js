// meadow.js -- the ground. Seventeen swells from the far shore to our feet, each one coloured in on its
// own (crayon first, back and forth; then pencils; then the grass, blade by blade, leaning the way the
// wind combed it). Cloud shadows are not painted on top: you just reach for the cooler sticks there.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});
  const NB = Wd.NB;

  // crest lines sampled once
  const CR = [];
  for (let i = 0; i <= NB; i++) { const a = new Float32Array(803); for (let k = 0; k < 803; k++) a[k] = Wd.crest(i, k * 2); CR.push(a); }
  const cy = (i, x) => { const f = clamp(x / 2, 0, 801.99), k = f | 0, t = f - k; return CR[i][k] + (CR[i][k + 1] - CR[i][k]) * t; };
  Wd.cy = cy;
  // which band is a point in
  Wd.bandOf = (x, y) => { let i = 0; while (i < NB - 1 && y > cy(i + 1, x)) i++; return i; };

  // how lit is the ground here, 0..1 (cloud shadow, the trough behind the next swell, which way it tilts)
  function lit(i, x, y) {
    const t = cy(i, x), b = cy(i + 1, x), vf = clamp((y - t) / Math.max(1, b - t), 0, 1);
    const slope = (cy(i, x + 8) - cy(i, x - 8)) / 16;       // + means the crest falls away to the right: turned from the sun
    let L = Wd.light(x, y);
    L *= 1 - 0.34 * ss(0.62, 1.0, vf) - 0.5 * clamp(slope * 2.2, -0.25, 0.5);
    L += 0.16 * ss(0.22, 0.0, vf);
    return clamp(L, 0, 1.15);
  }
  Wd.lit = lit;

  // reach into the tin
  function base(i, x, y, rng) {
    const d = Wd.d(y), L = lit(i, x, y) + rng.g() * 0.09, dr = Wd.dry(x, y) + rng.g() * 0.04;
    if (d < 0.055) return L > 0.5 ? (dr > 0.6 ? K.straw : K.haze) : K.sage;
    if (d < 0.17) return L > 0.5 ? (dr > 0.62 ? K.straw : dr > 0.5 ? K.haze : K.pist) : (rng.chance(0.6) ? K.sage : K.pist);
    return L > 0.5 ? (dr > 0.64 ? K.straw : dr > 0.52 ? K.lemon : K.pist) : (L > 0.28 ? K.pist : K.sap);
  }
  function second(i, x, y, rng) {
    const d = Wd.d(y), L = lit(i, x, y) + rng.g() * 0.1, dr = Wd.dry(x, y) + rng.g() * 0.05;
    if (d < 0.055) return L > 0.55 ? (rng.chance(0.4) ? K.pist : null) : K.far;
    if (d < 0.17) return L > 0.55 ? (dr > 0.6 ? K.butter : rng.chance(0.5) ? K.lemon : K.pist) : (L > 0.3 ? K.sap : K.slate);
    if (L > 0.78) return dr > 0.66 ? K.butter : dr > 0.56 ? K.straw : dr > 0.44 ? K.lemon : K.sap;
    if (L > 0.5) return dr > 0.64 ? K.ochre : dr > 0.5 ? K.pist : K.sap;
    return L > 0.25 ? K.sap : rng.chance(0.6) ? K.moss : K.slate;
  }
  // drifts of colour lying across the grass: sorrel gone rusty, a pink-headed grass, buttercups
  const drift = (x, y, k) => { const d = Wd.d(y); return fbm(x / (130 + 520 * d) + k * 3.7, y / (26 + 190 * d) + k, 3, 571 + k * 6); };
  function blade(i, x, y, rng) {
    const d = Wd.d(y), L = lit(i, x, y) + rng.g() * 0.14, dr = Wd.dry(x, y) + rng.g() * 0.08, q = rng();
    if (L > 0.4 && d > 0.03) {
      const r1 = drift(x, y, 1), r2 = drift(x, y, 2), r3 = drift(x, y, 3);
      if (r1 > 0.6 && rng.chance((r1 - 0.6) * 3.2)) return rng.chance(0.5) ? K.rust : rng.chance(0.3) ? K.brick : K.ochre;
      if (r2 > 0.61 && rng.chance((r2 - 0.61) * 5)) return rng.chance(0.6) ? K.salmon : K.cream;
      if (r3 > 0.62 && rng.chance((r3 - 0.62) * 4)) return rng.chance(0.6) ? K.mustard : K.butter;
    }
    if (L > 0.72) return dr > 0.6 ? (q < 0.4 ? K.butter : q < 0.75 ? K.straw : K.ochre) : (q < 0.3 ? K.lemon : q < 0.62 ? K.pist : q < 0.9 ? K.sap : K.cream);
    if (L > 0.45) return dr > 0.62 ? (q < 0.5 ? K.straw : q < 0.8 ? K.ochre : K.olive) : (q < 0.45 ? K.sap : q < 0.75 ? K.pist : q < 0.93 ? K.moss : K.lemon);
    return q < 0.34 ? K.moss : q < 0.6 ? K.sap : q < 0.8 ? K.spruce : q < 0.92 ? K.slate : K.sage;
  }
  Wd.bladeCol = blade;

  // one blade of grass: a flick from the root
  function flick(C, rng, tool, col, x, y, len, lean, w, p) {
    const bend = lean + rng.g() * 0.22, c2 = bend * (1.3 + rng() * 0.8);
    const x1 = x + Math.sin(bend) * len * 0.5, y1 = y - Math.cos(bend) * len * 0.5;
    const x2 = x + Math.sin(c2) * len, y2 = y - Math.cos(c2) * len * (0.9 + 0.1 * rng());
    C.stroke([x, y, 1, 1, x1, y1, 0.85, 0.8, x2, y2, 0.35, 0.45], tool, col, w, p);
  }
  Wd.flick = flick;

  function band(C, rng, i) {
    let y0 = 1e9, y1 = -1e9;
    for (let k = 0; k < 803; k++) { if (CR[i][k] < y0) y0 = CR[i][k]; if (CR[i + 1][k] > y1) y1 = CR[i + 1][k]; }
    y0 = Math.max(Wd.HZ + 8, y0 - 2); y1 = Math.min(905, y1 + 3);
    if (y0 >= 900) return;
    const dm = Wd.d((y0 + y1) / 2), ov = 2 + 5 * dm;
    const dry = (x, y) => Wd.riv(x, y) < 0.04 && Wd.clear(x, y);
    const inB = (x, y) => y >= cy(i, x) - 0.5 && y <= cy(i + 1, x) + ov && dry(x, y);
    const R = A.region([-4, y0, 1604, y1 + ov], inB);
    const cw = 3.2 + 15 * dm;
    // crayon, two goes at slightly different slants, the second with gaps
    A.scribble(C, rng, R, { tool: dm < 0.1 ? T.crayonTip : T.crayon, colAt: (x, y, r) => base(i, x, y, r), w: cw, gap: cw * 0.46, ang: rng.g() * 0.05, p: 0.9, over: 2 + 4 * dm, under: 0, run: 5, wob: 0.6 + dm, step: 5 });
    A.scribble(C, rng, R, { tool: dm < 0.1 ? T.crayonTip : T.crayon, colAt: (x, y, r) => second(i, x, y, r), w: cw * 0.9, gap: cw * 0.6, ang: -0.13 + rng.g() * 0.1, p: 0.74, over: 2 + 3 * dm, under: 1, run: 4, wob: 0.6 + dm, skip: 0.14, step: 5 });
    // a third, quicker go across the grain, to close the stripes up
    A.scribble(C, rng, R, { tool: dm < 0.1 ? T.crayonTip : T.crayon, colAt: (x, y, r) => (r.chance(0.5) ? base(i, x, y, r) : second(i, x, y, r)), w: cw * 0.9, gap: cw * 0.8, ang: 0.42 + rng.g() * 0.1, p: 0.6, over: 1, under: 2, run: 3, wob: 0.8 + dm, skip: 0.2, step: 5 });
    // where it is shaded, a cooler stick over the top, lightly, on a different slant
    const Rs = A.region(R.bbox, (x, y) => inB(x, y) && lit(i, x, y) < 0.5);
    A.scribble(C, rng, Rs, { tool: dm < 0.1 ? T.crayonTip : T.crayon, colAt: (x, y, r) => (lit(i, x, y) < 0.22 ? (r.chance(0.5) ? K.slate : K.moss) : r.chance(0.5) ? K.sage : K.sap), w: cw * 0.85, gap: cw * 0.7, ang: 0.3 + rng.g() * 0.1, p: 0.6, over: 1, under: 2, run: 4, wob: 0.8, skip: 0.1 });
    // pencil shading in the shade, the long way a patient hand does it
    if (dm > 0.03) {
      A.hatch(C, rng, A.region(R.bbox, (x, y) => inB(x, y) && lit(i, x, y) < 0.42), { tool: T.pencil, colAt: (x, y, r) => (r.chance(0.55) ? K.spruce : r.chance(0.6) ? K.slate : K.bluepencil), w: 1.3 + 0.9 * dm, gap: 2.4 + 5.5 * dm, ang: -0.28 + rng.g() * 0.08, p: 0.62, seg: 10 + 34 * dm, skip: 0.12 });
      A.hatch(C, rng, A.region(R.bbox, (x, y) => inB(x, y) && lit(i, x, y) < 0.2), { tool: T.pencil, col: K.pine, w: 1.3 + 0.9 * dm, gap: 3.4 + 7 * dm, ang: 0.2 + rng.g() * 0.08, p: 0.55, seg: 9 + 24 * dm, skip: 0.2 });
    }
    // ---- grass. Jittered so no two tufts stand in line.
    const cell = 1.9 + 8.2 * dm;
    const todo = [];
    for (let gy = y0; gy < y1 + ov; gy += cell * (0.55 + 0.25 * dm)) for (let gx = -6; gx < 1606; gx += cell) {
      const x = gx + rng() * cell, y = gy + rng() * cell * 0.7;
      if (!inB(x, y)) continue;
      todo.push(x, y);
    }
    for (let q = 0; q < todo.length; q += 2) {
      const x = todo[q], y = todo[q + 1], d = Wd.d(y);
      const thick = fbm(x / (30 + 160 * d), y / (9 + 70 * d), 2, 517);    // tussocks and thin places
      if (thick < 0.3 && rng.chance(0.7)) continue;
      const nb = d < 0.1 ? 1 : 1 + (rng() < 0.55 ? 1 : 0) + (thick > 0.6 ? 1 : 0);
      const lean = Wd.lean(x, y);
      for (let b = 0; b < nb; b++) {
        const col = blade(i, x, y, rng);
        if (d < 0.045) { // very far: a dash
          const L = rng.r(1.5, 5);
          C.stroke([x, y, 1, 1, x + L, y + rng.g() * 0.3, 0.6, 0.8], T.pencil, col, 1.2, 0.7);
          continue;
        }
        const len = (2.2 + 30 * Math.pow(d, 1.15)) * (0.5 + 0.9 * rng()) * (0.75 + 0.5 * thick);
        const fat = rng.chance(0.32 + 0.2 * d);
        flick(C, rng, fat ? T.crayonTip : T.pencil, v(col, rng, 0.02), x + rng.g() * cell * 0.25, y + rng.g() * cell * 0.15, len, lean, fat ? 1.5 + 2.4 * d : 1.15 + 0.9 * d, fat ? 0.8 : 0.85);
      }
    }
    // ---- the crest: seed heads standing up against the trough behind
    if (i > 0) {
      const dc = Wd.d(cy(i, 800));
      for (let x = -4; x < 1604; x += (1.2 + 5.5 * dc) * (0.5 + rng())) {
        const y = cy(i, x) + rng.r(0, 2 + 6 * dc);
        if (!dry(x, y)) continue;
        const L = lit(i, x, y - 2), len = (2.5 + 24 * dc) * (0.5 + 0.8 * rng());
        const col = L > 0.6 ? rng.pick([K.butter, K.straw, K.cream, K.lemon, K.straw]) : L > 0.35 ? rng.pick([K.pist, K.straw, K.sap]) : rng.pick([K.sage, K.sap, K.moss]);
        flick(C, rng, rng.chance(0.5) ? T.crayonTip : T.pencil, col, x, y, len, Wd.lean(x, y), 1.2 + 1.6 * dc, 0.85);
      }
    }
    // ---- things in the grass
    const nAcc = Math.round(1600 * (y1 - y0) / Math.pow(7 + 30 * dm, 2));
    for (let q = 0; q < nAcc; q++) {
      const x = rng() * 1600, y = rng.r(y0, y1);
      if (!inB(x, y)) continue;
      const d = Wd.d(y), L = lit(i, x, y);
      const sor = fbm(x / (60 + 220 * d) + 31, y / (14 + 90 * d), 2, 541), but = fbm(x / (50 + 200 * d) + 77, y / (12 + 80 * d), 2, 547);
      if (sor > 0.6) { // sorrel going to seed: a rusty haze far off, rusty spires close to
        const col = L > 0.5 ? (rng.chance(0.6) ? K.rust : K.brick) : K.umber;
        if (d < 0.14) C.stroke([x, y, 1, 1, x + rng.r(1.5, 4), y + rng.g() * 0.3, 0.7, 0.8], T.pencil, col, 1.3, 0.7);
        else {
          const h = (5 + 26 * d) * (0.6 + 0.6 * rng()), ln = Wd.lean(x, y) * 0.5;
          flick(C, rng, T.pencil, K.olive, x, y, h, ln, 1.2 + 0.6 * d, 0.7);
          for (let s = 0; s < 4 + 5 * d; s++) { const t = 0.45 + 0.55 * rng(); C.dab(T.crayonTip, v(col, rng, 0.03), x + Math.sin(ln) * h * t + rng.g() * (0.6 + d), y - h * t, 1.3 + 1.7 * d, 0.85); }
        }
      } else if (but > 0.62 && L > 0.35) { // small yellow things
        C.dab(T.crayonTip, rng.chance(0.7) ? K.mustard : K.butter, x, y - (2 + 8 * d) * rng(), 1.3 + 2.6 * d, 0.9);
      } else if (rng.chance(0.07)) {
        C.dab(T.chalk, K.white, x, y - (2 + 8 * d) * rng(), 1.1 + 1.8 * d, 0.85);
      }
    }
    // ---- and here and there the grass is drawn the way you draw the sea
    if (dm > 0.035 && dm < 0.62) {
      const ns = Math.round(26 + 30 * (1 - dm));
      for (let q = 0; q < ns; q++) {
        const x = rng() * 1600, y = rng.r(y0, y1);
        if (!inB(x, y) || fbm(x / 240 + 3, y / 60, 2, 561) < 0.5) continue;
        const d = Wd.d(y), s = 3.5 + 20 * d, n = rng.i(3, 7), L = lit(i, x, y), pts = [];
        for (let k = 0; k <= n * 5; k++) { const t = k / 5; pts.push(x + t * s, y + Math.abs(Math.sin(t * 3.14159)) * s * 0.26 + rng.g() * 0.15); }
        C.line(rng, L > 0.5 ? T.chalk : T.pencil, L > 0.5 ? K.white : rng.chance(0.5) ? K.bluepencil : K.milk, pts, L > 0.5 ? 1.2 + 1.3 * d : 1.1 + 0.8 * d, 0.7, { wob: 0.3, step: 2.5, pe: 0.6 });
      }
    }
  }

  S.meadow = function (C, rng) {
    for (let i = 0; i < NB; i++) band(C, rng.fork(), i);
  };
})(typeof self !== 'undefined' ? self : globalThis);
