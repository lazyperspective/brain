/* A YEAR, STILL WARM — what grows on the ground.
 *
 * The meadow's mass is a patient layer; standing on it, and re-drawn every frame:
 *
 *   - some thirty thousand single blades, each with its own height, lean and
 *     patch of soil, growing through spring at the pace of that patch, bowing to
 *     the gusts that cross the field, slumping in autumn, buried or poking out
 *     of the snow;
 *   - the hollow: its pressed swirl of grass, the pale band, and the ring of
 *     daisies that come up where something small once slept — each one sprouting,
 *     budding, opening, closing a little at night, wilting and going to seed in
 *     its own week;
 *   - drifts of small wild flowers that take turns through the year;
 *   - dandelions that turn to clocks and are carried off seed by seed by the wind;
 *   - the tall dark grass at the very front, close enough to touch;
 *   - dew, frost, rain-drops, puddles on the worn path.
 */
'use strict';
const { c01, sstep, lerp, hash1, hz, HOR } = require('./clock.js');
const { PAPER, mix3, hex, BOX } = require('./look.js');
const { createHand } = require('./hand.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, Sc = Wd.Sc, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS, REG = Wd.REG;
  const { R, rr, gs, fbm, hash2, PX, PY, PP, TOOLS } = E;
  const CRAYON = TOOLS.CRAYON, PENCIL = TOOLS.PENCIL, DUST = TOOLS.DUST;
  const H = createHand(E);
  E.reseed(0x6ea550);
  const X0 = Wd.X0, X1 = Wd.X1, Y1 = Wd.Y1, NEST = Sc.NEST, Rn = NEST.R;
  const ds = Wd.ds, TWO_PI = 6.283185307;
  const stick = k => hex(BOX[k]);
  const wv = [0, 0], q = [0, 0];
  const TBX = 224.4, TBZ = 108.5;

  // what a thing standing at (x, y) needs to know about its patch of ground
  function geo(x, y) {
    const yy = Math.max(y, Sc.groundY(x) + 1);
    Sc.s2w(x, yy, wv);
    return { wX: wv[0], wZ: wv[1], pn: fbm(wv[0] / 150, wv[1] / 150, 201, 3), pn2: fbm(wv[0] / 34, wv[1] / 34, 202, 2), L0: Sc.nestLight(x, yy), dn: Math.hypot(wv[0], wv[1]), dt: Math.hypot(wv[0] - TBX, wv[1] - TBZ), depth: c01((yy - 610) / 330), aux: fbm(x / 46, yy / 15, 15, 3) };
  }
  const al = [0, 0, 0], col = [0, 0, 0], c2 = [0, 0, 0], c3 = [0, 0, 0];
  const lit = (o, a, g, x, y) => Pt.lightGround(o, a, x, y, g.wX, g.wZ, g.L0, g.aux, g.depth);
  function gustAt(g) { return st.wind * (0.5 + 1.0 * Pt.pv((g.wX * 0.55 + g.wZ * 0.3 - Pt.fs.dGust) / Pt.ADV.gust.cell, g.wZ / 300, 321, Pt.ADV.gust.P)); }

  // =============================================================== the things, made once
  const items = [];                               // everything that stands on the meadow, sorted far to near
  const lean = Wd.lean;
  // ---- single blades (dark ones standing against the ground, light ones that catch whatever light there is)
  function addBlade(x, y, h, ln, w, kind, extra) {
    if (x < X0 - 6 || x > X1 + 6 || y > Y1 + 30) return;
    const g = geo(x, y);
    items.push(Object.assign({ t: 0, x, y, h, ln, w, kind, g, seed: (R() * 1e9) | 0, j3: R(), dk: rr(0.62, 0.82), ph: R() * 6.283, fq: 3 + ((R() * 6) | 0), thg: 0.22 + 0.5 * g.pn + 0.12 * (R() - 0.5), dewy: R() < 0.16 }, extra || {}));
  }
  { const area = (X1 - X0) * (Y1 - 606), nDark = Math.round(area / 30), nGl = Math.round(area / 52);
    for (let k = 0; k < nDark; k++) {
      const x = rr(X0, X1), y = 606 + (Y1 - 606) * Math.pow(R(), 0.8);
      if (E.regAt(x, y) !== REG.MEADOW) continue;
      Sc.s2w(x, y, q); if (Math.hypot(q[0], q[1]) < Rn * 1.22) continue;
      const sc = ds(y);
      addBlade(x, y, rr(9, 24) * sc, Math.tan(lean(x, y) + 1.5708) * 0.8 + rr(-0.3, 0.3), rr(1.2, 2.1) * Math.max(0.6, Math.min(1.7, sc)), 0);
    }
    for (let k = 0; k < nGl; k++) {
      const x = rr(X0, X1), y = 614 + (Y1 - 614) * Math.pow(R(), 0.85);
      if (E.regAt(x, y) !== REG.MEADOW) continue;
      const sc = ds(y);
      addBlade(x, y, rr(6, 19) * sc, Math.tan(lean(x, y) + 1.5708) * 0.8 + rr(-0.35, 0.35), rr(0.5, 0.85) * Math.max(0.7, Math.min(1.6, sc)), 1, { thr: 0.04 + 0.96 * Math.pow(R(), 1.3) });
    }
    // tufts along the crest of the meadow, against the sea
    for (let x = X0 + 4; x < X1 - 4; x += rr(0.9, 2.6)) {
      const y = Sc.groundY(x), r = E.regAt(x, y + 4); if (r !== REG.MEADOW && r !== REG.PATH) continue;
      if (E.regAt(x, y - 6) === REG.TRUNK) continue;
      addBlade(x, y + 2, (rr(2.5, 7.5) * (R() < 0.07 ? 1.8 : 1) + 2), rr(-0.5, 0.5), rr(0.9, 1.5), 0, { crest: 1, dk: rr(0.42, 0.6) });
    }
    // tufts leaning over the path, where feet have not quite reached
    for (let i = 2; i < Wd.PATH.length - 3; i++) {
      const p = Wd.PATH[i], w = Wd.pathW(p[1]);
      for (const sgn of [-1, 1]) for (let k = 0; k < 2; k++) {
        if (R() < 0.3) continue;
        const x = p[0] + rr(-3, 3), y = p[1] + sgn * w * 0.25 * rr(0.8, 1.25); if (E.regAt(x, y) === 0) continue;
        const sc = ds(y);
        addBlade(x, y + 2, rr(6, 15) * sc, rr(-0.5, 0.5) - sgn * 0.1, rr(1.2, 2.0) * Math.max(0.6, Math.min(1.6, sc)), 0, { dk: rr(0.66, 0.8), edge: 1 });
      }
    }
    // grass round the ring of the hollow, and at the foot of the tree
    for (let k = 0; k < 260; k++) {
      const th = R() * 6.283, rho = Rn * rr(1.16, 1.8); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q);
      if (E.regAt(q[0], q[1]) !== REG.MEADOW) continue;
      const sc = Sc.depthScale(q[1]), front = Math.sin(th) < -0.05;
      addBlade(q[0], q[1], rr(9, 20) * sc, Math.cos(th) * 0.35 + rr(-0.25, 0.25), rr(1.1, 1.9) * sc, 0, { dk: front ? rr(0.6, 0.78) : rr(0.86, 1.0) });
    }
    for (let k = 0; k < 16; k++) { const th = rr(3.5, 5.9), rho = Rn * rr(1.1, 1.24); Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q); const sc = Sc.depthScale(q[1]); addBlade(q[0], q[1] + 3, rr(12, 26) * sc, rr(-0.4, 0.4), rr(1.2, 2.0) * sc, 0, { dk: rr(0.5, 0.66) }); }
    for (let k = 0; k < 170; k++) { const x = rr(1092, 1204), y = rr(702, 722) + Math.abs(x - 1148) * -0.04; addBlade(x, y + 4, rr(9, 20), rr(-0.4, 0.4), rr(1.3, 2.2), 0, { dk: rr(0.74, 0.9) }); }
  }
  // ---- the hollow's daisies
  E.reseed(0x0da151e5);                       // (its own dice, so both sheets grow the same ones)
  const RING = [];
  { const mk = (th, rho, sz) => { Sc.w2s(rho * Math.cos(th), rho * Math.sin(th), q); const sc = Sc.depthScale(q[1]), s = rr(6.6, 8.8) * sc * sz;
      const np = R() < 0.15 ? 6 : 5, ph = R() * 6.283, angs = [], lens = [];
      for (let k = 0; k < np; k++) { angs.push(ph + k * 6.283 / np + rr(-0.13, 0.13)); lens.push(s * rr(0.9, 1.1)); }
      // those on the far, sunward side of the ring open first; no two keep quite the same week
      const sun = 0.5 + 0.5 * Math.sin(th), open = 2.25 + 1.5 * (0.55 * (1 - sun) + 0.45 * R()) + (sz < 1 ? 0.5 : 0);
      const it = { t: 3, x: q[0], y: q[1], th, sc, s, hgt: s * rr(0.9, 1.7), bx: rr(-1.5, 1.5) * s * 0.3, by: s * 0.9, np, angs, lens, g: geo(q[0], q[1]), seed: (R() * 1e9) | 0, open, shut: open + rr(3.6, 5.4), lf: [R() < 0.6, R() < 0.6], oc: R(), ph };
      RING.push(it); items.push(it); };
    for (let i = 0; i < 27; i++) mk(i / 27 * 6.283 + rr(-0.07, 0.07), Rn * rr(0.93, 1.09), 1);
    for (let i = 0; i < 12; i++) mk(R() * 6.283, Rn * rr(1.14, 1.42), 0.6);
    for (let i = 0; i < 4; i++) mk(R() * 6.283, Rn * rr(0.66, 0.84), 0.6);
  }
  // ---- wild flowers in drifts, each kind with its weeks
  E.reseed(0x0f10e125);                       // (its own dice, so both sheets grow the same ones)
  const KINDS = [
    { name: 'first violets', pet: [0.74, 0.66, 0.95], d0: 0.55, d1: 2.3, n: 9, s: 0.8 },
    { name: 'white stars', pet: null, d0: 2.3, d1: 5.9, n: 14, s: 1 },
    { name: 'buttercups', pet: [1.1, 0.92, 0.22], d0: 3.3, d1: 7.3, n: 12, s: 0.9 },
    { name: 'clover pink', pet: [1.05, 0.60, 0.70], d0: 4.9, d1: 8.6, n: 9, s: 0.95 },
    { name: 'late asters', pet: [0.66, 0.50, 0.95], d0: 8.3, d1: 11.0, n: 11, s: 1.05 },
  ];
  { const drifts = [[420, 722, 60, 12], [246, 792, 70, 18], [566, 688, 50, 9], [1384, 762, 60, 14], [1486, 842, 60, 18], [116, 692, 50, 9], [770, 884, 60, 9], [1250, 690, 50, 8], [60, 850, 40, 20],
      [640, 760, 46, 12], [705, 700, 44, 8], [930, 930, 70, 22], [1100, 1000, 80, 26], [1330, 950, 70, 24], [620, 1050, 44, 26], [1010, 1120, 90, 30], [1280, 1130, 80, 30], [900, 668, 50, 7], [1420, 690, 50, 8], [1210, 800, 60, 14], [980, 840, 50, 10]];
    drifts.forEach((d, di) => {
      if (d[0] < X0 - 60 || d[0] > X1 + 60 || d[1] > Y1 + 20) return;
      KINDS.forEach((kd, ki) => {
        if (hash2(di, ki, 811) > 0.62) return;                       // not every kind lives in every drift
        for (let k = 0; k < kd.n; k++) {
          const x = d[0] + gs() * d[2], y = d[1] + gs() * d[3];
          if (E.regAt(x, y) !== REG.MEADOW) continue;
          const sc = ds(y) * 1.1;
          items.push({ t: 2, x, y, kd, s: rr(1.7, 2.9) * sc * kd.s, hy: rr(4, 10) * sc, sc, ph: R() * 6.283, g: geo(x, y), seed: (R() * 1e9) | 0, open: kd.d0 + rr(0, 0.9), shut: kd.d1 + rr(-0.9, 0.3) });
        }
      });
    });
  }
  // ---- dandelions: gold, then clocks, then gone on the wind
  E.reseed(0x0c10c5);                       // (its own dice, so both sheets grow the same ones)
  const CLOCKS = [];
  { const spots = [[1296, 838, 46, 7.4, 1], [1352, 866, 34, 6.2, 1], [668, 858, 42, 7.0, 1], [1050, 905, 50, 7.6, 0], [1180, 1010, 62, 9.2, 0], [905, 1030, 60, 9.0, 1], [1420, 1040, 66, 9.6, 0], [640, 990, 52, 8.0, 0], [1240, 760, 30, 5.2, 0], [760, 740, 26, 4.8, 0], [990, 1150, 78, 11, 1], [1380, 1160, 80, 11.5, 0], [1120, 800, 34, 5.6, 0]];
    spots.forEach((c, ci) => {
      if (c[0] < X0 + 8 || c[0] > X1 - 8 || c[1] > Y1 - 4) return;
      const late = c[4], ready = late ? 5.12 + 0.3 * R() : 3.72 + 0.3 * R();
      const it = { t: 4, x: c[0], y: c[1], stem: c[2], r: c[3], hxo: rr(-4, 4), g: geo(c[0], c[1]), seed: (R() * 1e9) | 0, gold0: ready - 1.25 - 0.3 * R(), ready, late, rays: [] };
      // every seed leaves when enough wind has passed since the clock was ready
      const fr = Math.round(K.tauAtCal(ready + 0.12) * FPS) % F;
      for (let k = 0; k < 30; k++) {
        const thr = (late ? 0.035 + 0.5 * Math.pow(R(), 1.4) : 0.05 + 1.1 * Math.pow(R(), 1.3)), a = k / 30 * 6.283 + rr(-0.08, 0.08);
        let fo = -1;
        for (let j = 0; j < F * 0.45; j++) { const f = (fr + j) % F; const dWa = C.Wabs[f] - C.Wabs[fr] + (f < fr ? C.Wabs[F] : 0); if (dWa >= thr) { fo = f; break; } }
        it.rays.push({ a, r1: rr(0.86, 1.08), fo, kw: rr(60, 150), up: rr(14, 60), sink: rr(3, 9), wob: rr(3, 9), om: rr(1.2, 2.6), ph: R() * 6.283, life: rr(5, 9) });
      }
      CLOCKS.push(it); items.push(it);
    });
  }
  // ---- the tall grass at the very front
  E.reseed(0x0f02e);                       // (its own dice, so both sheets grow the same ones)
  { const Wn = X1 - X0;
    const zones = [[X0 - 12, X0 + Wn * 0.17, 52, 50, 190], [X1 - Wn * 0.27, X1 + 12, 62, 50, 205], [X0 + Wn * 0.5, X1 - Wn * 0.27, 20, 24, 86], [X0 + Wn * 0.17, X0 + Wn * 0.24, 6, 16, 44], [X0 + Wn * 0.4, X0 + Wn * 0.5, 7, 14, 40]];
    for (const z of zones) for (let k = 0; k < z[2]; k++) {
      const x = rr(z[0], z[1]), y = Y1 + rr(-12, 14), h = rr(z[3], z[4]), ln = rr(-0.45, 0.45) + (x < X0 + Wn * 0.3 ? 0.12 : -0.1);
      items.push({ t: 5, x, y, h, ln, bw: rr(2.2, 4.2) * (h > 80 ? 1.35 : 1), k1: rr(-0.05, 0.05), head: h > 90 && R() < 0.5, g: geo(x, Y1 - 4), seed: (R() * 1e9) | 0, ph: R() * 6.283, fq: 2 + ((R() * 4) | 0), dk: rr(0.26, 0.4), tint: R() });
    }
  }
  items.sort((a, b) => a.y - b.y);
  // ---- the hollow's pressed swirl
  E.reseed(0x05e121);                       // (its own dice, so both sheets grow the same ones)
  const SWIRL = [];
  for (let k = 0; k < 150; k++) {
    const th = R() * 6.283, rho = Rn * (0.30 + 0.60 * Math.sqrt(R())), dth = rr(0.3, 0.95), pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12, r2 = rho * (1 - 0.25 * t); Sc.w2s(r2 * Math.cos(th + dth * t), r2 * Math.sin(th + dth * t), q); pts.push([q[0], q[1]]); }
    const far = rho / Rn, set = far > 0.7 ? ['oldGold', 'sandalwood', 'turmeric', 'jaggeryLight'] : ['oldGold', 'moss', 'sandalwood', 'grass', 'turmeric'];
    SWIRL.push({ pts, w: rr(1.0, 1.9) * Sc.depthScale(pts[0][1]), col: stick(set[(R() * set.length) | 0]), press: rr(0.16, 0.42) * (1.1 - 0.5 * far), seed: (R() * 1e9) | 0, g: geo(pts[6][0], pts[6][1]), green: R() });
  }
  const RINGPTS = []; for (let k = 0; k <= 60; k++) { const a = k / 60 * 6.283; Sc.w2s(Rn * Math.cos(a), Rn * Math.sin(a), q); RINGPTS.push([q[0], q[1]]); }
  const nestG = geo(NEST.x, NEST.y + 20);
  // ---- low places on the path where water stands
  E.reseed(0x0b0dd1e);                       // (its own dice, so both sheets grow the same ones)
  const PUDDLES = [];
  for (const [pi, thr, rw] of [[86, 0.16, 15], [120, 0.30, 21], [164, 0.22, 26], [200, 0.4, 30]]) {
    const p = Wd.PATH[Math.min(Wd.PATH.length - 1, pi)]; if (!p || p[1] > Y1 - 6 || p[0] < X0 + 10 || p[0] > X1 - 10) continue;
    const sc = Sc.depthScale(p[1]), strokes = [];
    for (let k = 0; k < 34; k++) { const a = R() * 6.283, r = Math.sqrt(R()); strokes.push({ u: Math.cos(a) * r, v: Math.sin(a) * r, r, L: rr(0.25, 0.6), seed: (R() * 1e9) | 0, j: R() }); }
    strokes.sort((a, b) => a.v - b.v);
    PUDDLES.push({ x: p[0] + rr(-0.1, 0.1) * Wd.pathW(p[1]), y: p[1], rx: rw * sc * 0.82, ry: rw * sc * 0.22, thr, strokes, g: geo(p[0], p[1]), rings: R() * 100 });
  }

  // =============================================================== drawing
  const PETW = [PAPER[0] * 1.2, PAPER[1] * 1.2, PAPER[2] * 1.2];
  const cGreen = [0.30, 0.56, 0.30], cTurmeric = stick('turmeric'), cTerra = stick('terracotta'), cTam = stick('tamarind');
  let sunPart = 0, sparkle = 0;

  function bladeAlbedo(b, o) {
    Pt.albedoGround(o, b.g.pn, b.g.pn2, b.j3, 999, b.g.dt, 4, false, b.g.aux);
    return o;
  }
  function drawBlade(b) {
    const g = b.g, sc = ds(b.y);
    // how tall this week: its patch decides when it gets going
    let grow = sstep(b.thg - 0.25, b.thg + 0.25, st.Hg);
    let hf = b.crest ? 0.7 + 0.3 * grow : (0.36 + 0.64 * grow) * (1 - 0.28 * st.sen);
    if (b.edge) hf *= 0.75 + 0.45 * grow * (1 - st.sen);
    let h = b.h * hf, y0 = b.y;
    const cov = st.snow > 0.002 ? Pt.snowCover(g.pn, g.pn2, b.j3, g.dn, g.dt, 0, false) : 0;
    if (cov > 0.02) { const sh = st.snow * 7.5 * sc * cov * (0.7 + 0.6 * b.j3); h -= sh; y0 -= sh * 0.5; if (h < 2.2 * Math.max(0.5, sc)) return; }
    const wl = gustAt(g), aw = Math.abs(wl);
    let bend = h * (0.20 * wl + 0.07 * aw * Math.sin(TWO_PI * hz(b.fq / 8) * st.tau + b.ph) + 0.012 * Math.sin(TWO_PI * hz((1 + (b.fq & 3)) / 16) * st.tau + b.ph));
    const lnv = b.ln + (b.ln > 0 ? 1 : -1) * 0.38 * st.sen + 0.25 * st.rain * (b.ln > 0 ? 1 : -1);
    const droop = 1 - 0.22 * Math.min(1, Math.abs(bend) / (h + 1)) - 0.12 * st.sen;
    const tx = b.x + lnv * h + bend, ty = y0 - h * droop;
    if (b.kind === 0) {
      bladeAlbedo(b, al);
      const dk = b.dk; al[0] *= dk; al[1] *= dk + 0.06; al[2] *= dk + 0.08;
      lit(col, al, g, b.x, b.y);
      const n = H.tri(b.x, y0, b.x + lnv * h * 0.28 + bend * 0.32, y0 - h * 0.58, tx, ty, 1, 0.85, 0.08);
      E.stroke(n, b.w, PENCIL, col, 0.9, b.seed);
    } else {
      // a blade that catches the light: the buried yellow, found again by the pin
      const sh = Pt.shadowAt(b.x, b.y);
      const gl = Math.max(g.L0 * st.glow * 3.4, sunPart * (1 - sh) * 0.85, st.moonI * 0.25) * (1 - cov);
      const a = c01((gl - b.thr) * 4); if (a < 0.04) return;
      bladeAlbedo(b, al); mix3(al, [1.05, 0.98, 0.56], 0.5, al); al[0] *= 1.35; al[1] *= 1.35; al[2] *= 1.25;
      lit(col, al, g, b.x, b.y);
      const n = H.tri(b.x, y0, b.x + lnv * h * 0.28 + bend * 0.32, y0 - h * 0.58, tx, ty, 0.9, 0.7, 0.1);
      E.scratch(n, b.w, 0.85 * a, col);
    }
    // a bead of dew, a rain-drop or a grain of frost at the tip, when there is light to wake it
    if (b.dewy && sparkle > 0.03) {
      const tw = 0.5 + 0.5 * Math.sin(TWO_PI * hz((2 + b.fq) / 8) * st.tau + b.ph * 3);
      const a = sparkle * tw * tw * (1 - cov); if (a > 0.06) H.pinDot(tx, ty + 1, 1.5 * Math.max(0.7, Math.min(1.5, sc)), Math.min(0.95, a), st.frost > st.dew ? [0.92, 0.96, 1.0] : null);
    }
  }

  function drawFore(b) {
    const g = b.g;
    const grow = sstep(0.1, 0.9, st.Hg + 0.25 * (b.tint - 0.5));
    let h = b.h * (0.42 + 0.58 * grow) * (1 - 0.2 * st.sen) * (1 - 0.3 * c01(st.snow * 1.5));
    const wl = gustAt(g), aw = Math.abs(wl);
    const bend = h * (0.24 * wl + 0.06 * aw * Math.sin(TWO_PI * hz(b.fq / 8) * st.tau + b.ph) + 0.014 * Math.sin(TWO_PI * hz((b.fq & 1 ? 1 : 3) / 16) * st.tau + b.ph));
    const ln = b.ln + (b.ln > 0 ? 1 : -1) * 0.3 * st.sen;
    Pt.albedoGround(al, g.pn, g.pn2, b.tint, 999, 999, 4, false, g.aux);
    al[0] *= b.dk; al[1] *= b.dk + 0.03; al[2] *= b.dk + 0.10;
    lit(col, al, g, b.x, Y1 - 4);
    const x = b.x, y = b.y, p1x = x + ln * h * 0.25 + b.k1 * h + bend * 0.2, p1y = y - h * 0.55, p2x = x + ln * h * 0.8 + bend * 0.7, p2y = y - h * 0.9, p3x = x + ln * h * 1.15 + bend, p3y = y - h * (1 - 0.1 * Math.min(1, Math.abs(bend) / h));
    const pts = [[x, y], [p1x, p1y], [p2x, p2y], [p3x, p3y]];
    H.line(pts, b.bw * 0.55, PENCIL, col, { press: 0.95, p0: 1, p1: 0.05, wob: 0.3 }, b.seed);
    H.line(pts.slice(0, 3), b.bw, CRAYON, col, { press: 0.95, p0: 1, p1: 0.3, wob: 0.3 }, b.seed + 1);
    H.line([pts[0], [(x + p1x) / 2, (y + p1y) / 2], pts[1]], b.bw * 1.5, CRAYON, col, { press: 0.95, p0: 1, p1: 0.4, wob: 0.3 }, b.seed + 2);
    // a seed-head, from high summer until the winter breaks it
    if (b.head) {
      const hd = sstep(5.6, 6.6, st.cal) * (1 - sstep(14.5, 15.6, st.cal)); if (hd > 0.05) {
        const dx = p3x - p2x, dy = p3y - p2y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
        const ripe = sstep(7.5, 9.5, st.cal); mix3(col, [col[0] * 1.6 + 0.12, col[1] * 1.4 + 0.08, col[2] * 0.9], ripe * 0.7, c2);
        for (let j = 0; j < 9; j++) { const t = j * 3.2 * hd, sg = j % 2 ? 1 : -1, sx = p3x - ux * t, sy = p3y - uy * t; PX[0] = sx; PY[0] = sy; PP[0] = 0.85; PX[1] = sx + (-uy * sg) * 3.4 * hd + ux * 3; PY[1] = sy + (ux * sg) * 3.4 * hd + uy * 3; PP[1] = 0.7; E.stroke(2, 1.9, PENCIL, c2, 1, b.seed + 5 + j); }
      }
    }
    // snow riding on the bent ones
    if (st.snowB > 0.25 && Math.abs(ln) > 0.2) { const sc_ = ctx.tree ? ctx.tree.snowColour() : PAPER; PX[0] = p1x; PY[0] = p1y - b.bw; PP[0] = 0.6; PX[1] = p2x; PY[1] = p2y - b.bw * 0.8; PP[1] = 0.9; E.stroke(2, b.bw * 1.1 * st.snowB, CRAYON, sc_, c01(st.snowB * 1.5), b.seed + 20); }
  }

  function petalColour(g, x, y, pet, o) { lit(o, pet || PETW, g, x, y); return o; }
  function drawRingFlower(f) {
    const d = st.cal, g = f.g;
    const sg = sstep(f.open - 0.75, f.open - 0.1, d) * (1 - sstep(f.shut + 0.9, f.shut + 1.8, d)); if (sg <= 0.01) return;
    let b = sstep(f.open - 0.05, f.open + 0.4, d);
    const wilt = sstep(f.shut, f.shut + 0.6, d);
    // they close a little when it is dark and when it rains — less so near the small light
    b *= 1 - 0.30 * st.night * (1 - c01(st.glow * 1.2)) - 0.25 * st.rain;
    const cov = st.snow > 0.002 ? Pt.snowCover(g.pn, g.pn2, 0.5, g.dn, g.dt, 0.1, false) : 0; if (cov > 0.6) return;
    const wl = gustAt(g), s = f.s, sway = (0.9 * wl + 0.25 * Math.abs(wl) * Math.sin(TWO_PI * hz(5 / 8) * st.tau + f.ph)) * s * 0.8;
    const droop = (0.35 * wilt + 0.2 * st.rain) * s;
    const bx = f.x + f.bx, by = f.y + f.by, fx = f.x + sway + droop * 0.6, fy = f.y - f.hgt * sg + droop;
    mix3(cGreen, [0.55, 0.45, 0.25], wilt * 0.8, al); lit(col, al, g, f.x, f.y);
    H.line([[bx, by], [(bx + fx) / 2 + sway * 0.3, (by + fy) / 2], [fx, fy + s * 0.2]], 1.0 * f.sc, PENCIL, col, { press: 0.6, wob: 0.15, p0: 0.8, p1: 0.6, step: 0.9 }, f.seed);
    if (sg > 0.5) for (let k = 0; k < 2; k++) if (f.lf[k]) { const sgn = k ? 1 : -1; H.line([[bx, by - s * 0.2], [bx + sgn * s * 0.5, by - s * 0.6], [bx + sgn * s * 0.85, by - s * 0.5]], 1.4 * f.sc, PENCIL, col, { press: 0.5, wob: 0.1, p0: 0.5, p1: 0.1, step: 0.8 }, f.seed + 1 + k); }
    if (b < 0.06) { if (wilt < 0.5) H.dot(fx, fy, s * 0.42 * sg, PENCIL, col, 0.9, 1, f.seed + 4); }
    if (b >= 0.06) {
      const pl = b * (1 - 0.55 * wilt);
      petalColour(g, f.x, f.y, null, c2); if (wilt > 0) mix3(c2, [c2[0] * 0.75, c2[1] * 0.6, c2[2] * 0.42], wilt, c2);
      H.rubDot(fx, fy, s * 3.6 * pl, 0.62 * pl * (1 - wilt), c2);
      const sq2 = 0.78, Pp = (aa, rad) => [fx + Math.cos(aa) * rad, fy + Math.sin(aa) * rad * sq2];
      for (let k = 0; k < f.np; k++) { const L = f.lens[k] * pl; H.pin([Pp(f.angs[k], s * 0.15), Pp(f.angs[k], L * 0.55), Pp(f.angs[k], L * 0.82)], s * 0.58, 1, c2, { p0: 0.55, p1: 0.85, wob: 0, step: 0.5 }, f.seed + 10 + k); }
      // the petals' pencil edge, in the orange of the original
      mix3(cTurmeric, cTerra, f.oc, al); lit(c3, [al[0] * 1.1, al[1] * 1.05, al[2]], g, f.x, f.y);
      for (let k = 0; k < f.np; k++) {
        const a = f.angs[k], L = f.lens[k] * pl, sp = 0.50;
        if (hash2(f.seed, k, 21) < 0.9) H.line([Pp(a - 0.1, s * 0.25), Pp(a - sp, L * 0.66), Pp(a - sp * 0.4, L * 0.98), Pp(a, L * 1.04), Pp(a + sp * 0.4, L * 0.98), Pp(a + sp, L * 0.66), Pp(a + 0.1, s * 0.25)], 0.8 * Math.max(0.85, f.sc), PENCIL, c3, { press: 0.68, wob: 0.1, p0: 0.5, p1: 0.4, step: 0.5 }, f.seed + 20 + k);
      }
      lit(c3, [1.05, 0.70, 0.30], g, f.x, f.y); H.dot(fx, fy, s * 0.5 * (0.6 + 0.4 * pl), PENCIL, c3, 0.95, 1, f.seed + 30);
      lit(c3, [0.80, 0.42, 0.26], g, f.x, f.y); H.dot(fx, fy + s * 0.06, s * 0.24, PENCIL, c3, 0.85, 1, f.seed + 31);
    }
  }
  function drawWild(f) {
    const d = st.cal;
    const b = sstep(f.open, f.open + 0.4, d) * (1 - sstep(f.shut, f.shut + 0.5, d)); if (b < 0.04) return;
    const g = f.g, cov = st.snow > 0.002 ? Pt.snowCover(g.pn, g.pn2, 0.5, g.dn, g.dt, 0, false) : 0; if (cov > 0.5) return;
    const wl = gustAt(g), sway = wl * f.hy * 0.35 + 0.08 * f.hy * Math.abs(wl) * Math.sin(TWO_PI * hz(5 / 8) * st.tau + f.ph);
    const x = f.x + sway, hy = f.y - f.hy * (0.5 + 0.5 * b), s = f.s * (0.45 + 0.55 * b);
    lit(col, cGreen, g, f.x, f.y);
    PX[0] = f.x; PY[0] = f.y; PP[0] = 0.7; PX[1] = x; PY[1] = hy; PP[1] = 0.5; E.stroke(2, 0.9 * Math.min(1.6, f.sc), PENCIL, col, 0.8, f.seed);
    petalColour(g, f.x, f.y, f.kd.pet, c2);
    for (let j = 0; j < 5; j++) { const a = f.ph + j * 1.2566; PX[0] = x + Math.cos(a) * s * 0.25; PY[0] = hy + Math.sin(a) * s * 0.2; PP[0] = 0.75; PX[1] = x + Math.cos(a) * s; PY[1] = hy + Math.sin(a) * s * 0.8; PP[1] = 0.85; E.scratch(2, s * 0.5, 0.9 * b, c2); }
    lit(c3, [1.0, 0.66, 0.30], g, f.x, f.y); H.dot(x, hy, s * 0.5, PENCIL, c3, 0.8, b, f.seed + 1);
  }
  function drawClock(c) {
    const d = st.cal, g = c.g;
    const up = sstep(c.gold0 - 0.5, c.gold0, d) * (1 - sstep(c.ready + 2.4, c.ready + 3.2, d)); if (up < 0.02) return;
    const wl = gustAt(g), sway = (0.5 * wl + 0.12 * Math.abs(wl) * Math.sin(TWO_PI * hz(3 / 8) * st.tau + c.seed)) * c.stem * 0.3;
    const hx = c.x + c.hxo + sway, hy = c.y - c.stem * up;
    lit(col, [0.22, 0.50, 0.36], g, c.x, c.y);
    H.line([[c.x, c.y], [(c.x + hx) / 2 + 2, c.y - c.stem * up * 0.5], [hx, hy]], 1.3 * Math.min(1.5, Math.max(0.8, c.r / 7)), PENCIL, col, { press: 0.8, wob: 0.2 }, c.seed);
    const gold = sstep(c.gold0, c.gold0 + 0.3, d) * (1 - sstep(c.ready - 0.5, c.ready - 0.25, d)), puff = sstep(c.ready - 0.15, c.ready + 0.1, d);
    if (gold > 0.03) {
      lit(c2, [1.12, 0.86, 0.16], g, c.x, c.y);
      for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283 + c.seed; PX[0] = hx; PY[0] = hy; PP[0] = 1; PX[1] = hx + Math.cos(a) * c.r * 0.6 * gold; PY[1] = hy + Math.sin(a) * c.r * 0.5 * gold; PP[1] = 0.8; E.stroke(2, c.r * 0.26, PENCIL, c2, 0.95, c.seed + k); }
      lit(c3, [1.0, 0.62, 0.14], g, c.x, c.y); H.dot(hx, hy, c.r * 0.45 * gold, PENCIL, c3, 0.9, 1, c.seed + 40);
    } else if (puff < 0.05 && d > c.gold0) { lit(c2, [0.30, 0.55, 0.34], g, c.x, c.y); H.dot(hx, hy - 1, c.r * 0.5, PENCIL, c2, 0.9, 1, c.seed + 41); }
    if (puff > 0.05) {
      petalColour(g, c.x, c.y, null, c2);
      let left = 0; const f = st.f;
      for (const ry of c.rays) { if (ry.fo < 0) { left++; continue; } let df = f - ry.fo; if (df < -F / 2) df += F; if (df > F / 2) df -= F; if (df < 0) left++; }
      H.rubDot(hx, hy, c.r * 2.6, 0.3 * puff * (left / 30), c2);
      for (const ry of c.rays) {
        let gone = false; if (ry.fo >= 0) { let df = f - ry.fo; if (df < -F / 2) df += F; if (df > F / 2) df -= F; gone = df >= 0; }
        if (gone) continue;
        const r1 = c.r * ry.r1 * puff, ca = Math.cos(ry.a), sa = Math.sin(ry.a);
        PX[0] = hx + ca * 1.2; PY[0] = hy + sa * 1.2; PP[0] = 0.5; PX[1] = hx + ca * r1; PY[1] = hy + sa * r1; PP[1] = 0.6; E.scratch(2, 0.5, 0.8, c2);
        H.pinDot(hx + ca * r1, hy + sa * r1, 1.1, 0.9, c2);
      }
      lit(c3, [0.48, 0.24, 0.31], g, c.x, c.y); H.dot(hx, hy, 1.8, PENCIL, c3, 0.8, 1, c.seed + 42);
    }
  }
  // the seeds, once they are away (drawn in front of everything on the ground)
  function drawSeeds() {
    const f = st.f;
    for (const c of CLOCKS) {
      const hx0 = c.x + c.hxo, hy0 = c.y - c.stem; let any = false;
      for (const ry of c.rays) {
        if (ry.fo < 0) continue;
        let df = f - ry.fo; if (df < 0) df += F; const t = df / FPS; if (t > ry.life) continue;
        if (!any) { Pt.lightGround(c2, PETW, c.x, 620, c.g.wX, c.g.wZ, 0, c.g.aux, 0); any = true; }
        const dW = C.Wint[f] - C.Wint[ry.fo] + (f < ry.fo ? C.Wint[F] : 0);
        const x = hx0 + ry.kw * dW + ry.wob * Math.sin(ry.om * t + ry.ph), y = hy0 - ry.up * (1 - Math.exp(-t * 0.9)) + ry.sink * t + 0.5 * ry.wob * Math.cos(ry.om * 1.3 * t + ry.ph);
        const a = Math.min(1, t * 4) * (1 - sstep(ry.life - 1.5, ry.life, t)); if (a < 0.03) continue;
        PX[0] = x; PY[0] = y; PP[0] = 0.8; PX[1] = x + 1.2; PY[1] = y + 3.2; PP[1] = 0.8; E.scratch(2, 0.45, 0.8 * a, c2);
        H.pinDot(x, y, 1.5, 0.9 * a, c2); H.pinDot(x - 1.1, y - 0.2, 0.8, 0.8 * a, c2); H.pinDot(x + 1.1, y - 0.3, 0.8, 0.8 * a, c2);
      }
    }
  }

  function drawHollow() {
    // the grass still pressed round, the way something small and warm left it
    const g = nestG, snowK = st.snow > 0.002 ? Pt.snowCover(0.5, 0.5, 0.5, 30, 300, 0, false) : 0;
    const live = st.G * (1 - st.sen);
    for (const s of SWIRL) {
      al[0] = s.col[0] * 1.05; al[1] = s.col[1] * 1.05; al[2] = s.col[2] * 1.05;
      if (s.green < live * 0.5) mix3(al, [0.40, 0.62, 0.30], 0.6, al);
      lit(col, al, s.g, s.pts[6][0], s.pts[6][1]);
      H.line(s.pts, s.w, PENCIL, col, { press: s.press * (1 - snowK), p0: 0.3, p1: 0.05, wob: 0.25 }, s.seed);
    }
    lit(c2, [1.0, 0.94, 0.74], g, NEST.x, NEST.y);
    H.rub([[NEST.x - 30, NEST.y + 2], [NEST.x + 30, NEST.y + 2]], 22, 0.22, c2);
    // a pale band lifted with the eraser all the way round
    lit(c2, [1.02, 0.97, 0.80], g, NEST.x, NEST.y + 30);
    H.rub(RINGPTS, 30, 0.34, c2); H.rub(RINGPTS, 15, 0.34, c2);
  }

  function drawPuddles() {
    if (st.puddle < 0.1) return;
    for (const p of PUDDLES) {
      const a = c01((st.puddle - p.thr) / 0.55); if (a < 0.03) continue;
      const cov = st.snow > 0.002 ? Pt.snowCover(p.g.pn, p.g.pn2, 0.4, p.g.dn, p.g.dt, 0, true) : 0; if (cov > 0.7) continue;
      const rad = Math.sqrt(a), frozen = sstep(0.5, -2.5, st.T);
      Lk.skyAt(p.x * 0.3 + 600, HOR - 300, c2, st.ovc);
      // water lying on earth: mostly the sky, some of the mud under it
      Pt.albedoGround(al, p.g.pn, p.g.pn2, 0.5, 999, 999, 4, true, p.g.aux); lit(c3, al, p.g, p.x, p.y);
      c2[0] = c2[0] * 0.50 + c3[0] * 0.36; c2[1] = c2[1] * 0.52 + c3[1] * 0.36; c2[2] = c2[2] * 0.56 + c3[2] * 0.40;
      if (frozen > 0) mix3(c2, [0.78 * (0.35 + 0.65 * st.day), 0.84 * (0.38 + 0.62 * st.day), 0.93 * (0.45 + 0.55 * st.day)], frozen * 0.7, c2);
      for (const s of p.strokes) {
        if (s.r > rad) continue;
        const e = c01((rad - s.r) * 6), x = p.x + s.u * p.rx, y = p.y + s.v * p.ry, L = p.rx * s.L * Math.sqrt(Math.max(0.05, 1 - s.v * s.v));
        const j = (s.j - 0.5) * 0.07; col[0] = c2[0] + j; col[1] = c2[1] + j; col[2] = c2[2] + j;
        PX[0] = x - L; PY[0] = y; PP[0] = 0.5; PX[1] = x; PY[1] = y + 0.3; PP[1] = 0.95; PX[2] = x + L; PY[2] = y; PP[2] = 0.5;
        E.stroke(3, 1.7 * Math.min(1.8, Math.max(0.8, p.rx / 22)), PENCIL, col, 0.8 * e * (1 - cov), s.seed);
      }
      // rain rings
      if (st.rain > 0.08 && frozen < 0.5) {
        const nR = Math.round(3 + 5 * st.rain);
        for (let k = 0; k < nR; k++) {
          const ph = st.tau * 2.4 + k * 0.37 + p.rings, cyc = Math.floor(ph), u = ph - cyc, h1 = hash2(cyc, k, 71 + (p.rings | 0)), h2 = hash2(cyc, k, 72);
          const a2 = h1 * 6.283, rr2 = Math.sqrt(h2) * rad * 0.8, cx = p.x + Math.cos(a2) * rr2 * p.rx, cy = p.y + Math.sin(a2) * rr2 * p.ry, R1 = (1 + 6 * u) * Math.max(0.8, p.rx / 30);
          let n = 0; for (let j = 0; j <= 10; j++) { const t = j / 10 * 6.283; PX[n] = cx + Math.cos(t) * R1; PY[n] = cy + Math.sin(t) * R1 * 0.3; PP[n] = 0.8; n++; }
          E.scratch(n, 0.5, 0.55 * (1 - u) * st.rain, null);
        }
      }
    }
  }

  function setFrame() {
    sunPart = st.direct * (0.4 + 0.6 * Math.max(0, -st.lz));
    sparkle = Math.max(st.dew, st.frost * 0.8, st.wet * 0.55 * (1 - st.rain)) * c01(st.direct * 2.5 + st.day * 0.35 + st.moonI * 0.5);
  }
  const SPLIT = 708;
  let splitIdx = items.findIndex(it => it.y >= SPLIT); if (splitIdx < 0) splitIdx = items.length;
  function drawRange(a, b) {
    for (let i = a; i < b; i++) { const it = items[i]; switch (it.t) { case 0: drawBlade(it); break; case 2: drawWild(it); break; case 3: drawRingFlower(it); break; case 4: drawClock(it); break; case 5: drawFore(it); break; } }
  }
  function drawBack() {
    setFrame();
    const clip = E.getClip();
    E.setClip(clip & ~(1 << REG.TRUNK));
    drawPuddles();
    if (ctx.tree) { ctx.tree.drawBranchShadows && ctx.tree.drawBranchShadows(); ctx.tree.drawLitter(); }
    drawHollow();
    drawRange(0, splitIdx);
    E.setClip(clip);
  }
  function drawFront() { drawRange(splitIdx, items.length); drawSeeds(); }
  return { drawBack, drawFront, items, RING, CLOCKS, geo, gustAt, lit };
}

module.exports = { create };
