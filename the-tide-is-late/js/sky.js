// sky.js -- the ceiling. A scribbled sky (three crayons, back and forth), and under it a whole field of
// small clouds laid out in rows that shrink toward the far shore. Then the far shore itself, and the
// thin line of water that is still there.
(function (G) {
  'use strict';
  const A = G.ART, Wd = A.W, K = Wd.K, T = A.TOOL, v = Wd.v, fbm = A.fbm, vn = A.vn, ss = A.ss, clamp = A.clamp;
  const S = (A.S = A.S || {});

  // light pencil lines put down before any colour: where things will go
  S.underdrawing = function (C, rng) {
    const g = K.graphite, hz = [], GP = T.graphite;
    for (let x = -10; x <= 1610; x += 40) hz.push(x, Wd.HZ + 0.5 + Math.sin(x / 300) * 0.8);
    C.line(rng, GP, g, hz, 1.4, 0.8, { wob: 0.9, wl: 120 });
    C.line(rng, GP, g, hz.map((q, i) => (i & 1 ? q + 1.6 : q + 3)), 1.2, 0.5, { wob: 1.2, wl: 90 });
    // the channel, found with a few loose S-curves
    const rl = Wd.riverLine, pts = [];
    for (let k = 0; k < rl.length / 3; k += 3) { const p = Wd.proj(rl[k * 3], 0, rl[k * 3 + 1]); if (p[1] < 960) pts.push(p[0], p[1]); }
    for (let r = 0; r < 3; r++) C.line(rng, GP, g, pts.map((q, i) => q + rng.g() * 3), 1.3, 0.62, { wob: 5, wl: 150, a0: 0.02, a1: 0.02 });
    // swells, as a few sweeping lines
    for (let i = 2; i < Wd.NB; i += 2) {
      const cl = [];
      for (let x = -20; x <= 1620; x += 40) cl.push(x, Wd.crest(i, x) + rng.g() * 1.5);
      C.line(rng, GP, g, cl, 1.3, 0.55, { wob: 2.5, wl: 200 });
    }
    // the boat, boxed in first, then her sheer found in two tries
    const B = Wd.boat, Pr = Wd.pier;
    if (B) {
      const hl = B.L / 2, a = B.at3(-hl - 0.5, 0, 0.3), b = B.at3(hl + 0.7, 0, 0.3);
      C.line(rng, GP, g, [a[0], a[1], b[0], b[1]], 1.3, 0.7, { wob: 0.8, wl: 120, pe: 0.2 });
      const box = [B.at3(-hl - 0.1, -0.86, 0.3), B.at3(hl + 0.25, -0.86, 0.3), B.at3(hl + 0.25, 0.86, 0.3), B.at3(-hl - 0.1, 0.86, 0.3), B.at3(-hl - 0.1, -0.86, 0.3)];
      for (let k = 0; k < 4; k++) C.line(rng, GP, g, [box[k][0], box[k][1], box[k + 1][0], box[k + 1][1]], 1.2, 0.55, { wob: 0.9, wl: 90, pe: 0.3, a0: 0.2, a1: 0.2 });
      const fl = q => { const o = []; for (const p of q) o.push(p[0] + rng.g() * 0.6, p[1] + rng.g() * 0.6); return o; };
      for (let r = 0; r < 2; r++) { C.line(rng, GP, g, fl(B.gN).map((z, j) => (j & 1 ? z - 2 + r * 3 : z)), 1.3, 0.7, { wob: 1.6, wl: 80 }); C.line(rng, GP, g, fl(B.gF).map((z, j) => (j & 1 ? z + 2 - r * 3 : z)), 1.3, 0.7, { wob: 1.6, wl: 80 }); }
      for (const u of [0.25, 0.5, 0.75]) { const p = B.SP(u, 1, 1), q = B.SP(u, -1, 1); C.line(rng, GP, g, [p[0], p[1] - 6, q[0], q[1] + 9], 1.1, 0.5, { wob: 0.5 }); }
    }
    if (Pr) {
      for (const off of [0.64, -0.64, 0]) { const p = Pr.at(-1.4, off, Pr.HD), q = Pr.at(Pr.LEN + 14, off, Pr.HD); C.line(rng, GP, g, [p[0], p[1], q[0], q[1]], 1.2, off ? 0.7 : 0.4, { wob: 0.7, wl: 140, pe: 0.15, a1: 0.45 }); }
      for (const p of Pr.posts) C.line(rng, GP, g, [p.base[0], p.base[1] + 8, p.top[0], p.top[1] - 12], 1.1, 0.5, { wob: 0.5 });
    }
  };

  S.sky = function (C, rng) {
    const top = x => Wd.hills(x) + 2.5;
    const R = (f) => A.region([0, 0, 1600, 212], f);
    // 1. pale all over
    A.scribble(C, rng, R((x, y) => y < top(x)), { tool: T.crayon, col: K.milk, w: 15, gap: 6.2, ang: 0.025, p: 0.95, over: 14, under: 0, run: 14, wob: 1.6 });
    A.scribble(C, rng, R((x, y) => y < top(x) - 14 - 0.012 * (1600 - x)), { tool: T.crayon, col: K.milk, w: 14, gap: 7.4, ang: -0.03, p: 0.85, over: 14, under: 2, run: 9, wob: 1.6, skip: 0.06 });
    // 2. the deeper blue comes down from the top, further on the right (away from the sun)
    const blue = (x, y) => 78 + 0.05 * x + 80 * (fbm(x / 420, y / 170, 3, 201) - 0.5);
    A.scribble(C, rng, R((x, y) => y < top(x) && y < blue(x, y) + 52), { tool: T.crayon, col: K.tile, w: 14, gap: 7.6, ang: -0.05, p: 0.5, over: 18, under: 4, run: 10, wob: 1.8, skip: 0.04 });
    A.scribble(C, rng, R((x, y) => y < blue(x, y)), { tool: T.crayon, col: K.tile, w: 14, gap: 6.2, ang: 0.07, p: 0.9, over: 20, under: 6, run: 9, wob: 1.8 });
    A.scribble(C, rng, R((x, y) => y < blue(x, y) - 55), { tool: T.crayon, col: v(K.tile, rng), w: 13, gap: 8, ang: -0.16, p: 0.9, over: 14, under: 6, run: 7, wob: 1.6 });
    // 3. warm low down, most of all on the sun's side
    const warm = (x, y) => 172 + 0.012 * x + 18 * (fbm(x / 300, y / 90, 2, 207) - 0.5);
    A.scribble(C, rng, R((x, y) => y < top(x) && y > warm(x, y)), { tool: T.crayon, col: K.cream, w: 14, gap: 7.6, ang: 0.0, p: 0.8, over: 20, under: 3, run: 12, wob: 1.4 });
    A.scribble(C, rng, R((x, y) => y < top(x) && y > warm(x, y) + 6 + x * 0.03), { tool: T.crayon, col: K.butter, w: 12, gap: 9, ang: 0.03, p: 0.42, over: 16, under: 6, run: 8, wob: 1.4, skip: 0.12 });
    // 4. a grown-up's pencil, evening the top right corner out
    A.hatch(C, rng, R((x, y) => y < blue(x, y) - 30 && fbm(x / 160, y / 80, 2, 211) > 0.42), { tool: T.pencil, col: K.bluepencil, w: 1.7, gap: 3.8, ang: 0.1, p: 0.5, seg: 60, skip: 0.2, jit: 0.1 });
  };

  // one small cloud
  function tuft(C, rng, x, y, w, h, hazed) {
    const wh = v(K.white, rng, 0.012);
    if (w < 9) {
      C.line(rng, T.chalk, wh, [x - w / 2, y + rng.g() * 0.3, x + w / 2, y + rng.g() * 0.3], Math.max(1.2, h), 0.8 - 0.3 * hazed, { wob: 0.3, pe: 0.5 });
      if (w > 4.5 && rng.chance(0.6)) C.line(rng, T.pencil, K.far, [x - w * 0.3, y + h * 0.6, x + w * 0.45, y + h * 0.65], 1.0, 0.45, { wob: 0.2 });
      return;
    }
    const n = Math.max(3, Math.round(w / (h * 1.05)));
    // the body: a child's cloud, looped without lifting
    const loop = [];
    for (let k = 0; k <= n * 6; k++) {
      const t = k / (n * 6), cx = x + (t - 0.5) * w * 0.82, a = t * n * 6.283 + 1;
      const rr = h * 0.36 * (0.75 + 0.35 * Math.sin(t * 3.14159));
      loop.push(cx + Math.cos(a) * rr * 1.25 + rng.g() * 0.4, y - Math.sin(t * 3.14159) * h * 0.16 + Math.sin(a) * rr + rng.g() * 0.4);
    }
    C.line(rng, T.chalk, wh, loop, h * 0.62, 0.86, { wob: 0.6, pe: 0.8, step: 3 });
    C.line(rng, T.chalk, wh, [x - w * 0.42, y + h * 0.05, x + w * 0.4, y + h * 0.02], h * 0.75, 0.7, { wob: 0.8, pe: 0.5 });
    // sun side, top left
    if (rng.chance(0.8)) C.line(rng, T.crayonTip, K.cream, A.curve([x - w * 0.44, y - h * 0.05, x - w * 0.2, y - h * 0.42, x + w * 0.1, y - h * 0.4]), h * 0.34, 0.6, { wob: 0.5 });
    if (rng.chance(0.35)) C.line(rng, T.pencil, K.butter, [x - w * 0.3, y - h * 0.3, x - w * 0.05, y - h * 0.42], 1.6, 0.6, { wob: 0.4 });
    // underside, away from the sun: a few pencil strokes
    const nh = 2 + Math.round(w / 9);
    for (let k = 0; k < nh; k++) {
      const hx = x - w * 0.3 + (k / nh) * w * 0.74 + rng.g() * 1.2, hy = y + h * (0.22 + 0.16 * rng());
      const L = rng.r(2.5, 5.5) + w * 0.05;
      C.line(rng, T.pencil, rng.chance(0.7) ? K.far : K.slate, [hx - L * 0.5, hy + 0.9, hx + L * 0.5, hy - 0.4], 1.4, 0.5, { wob: 0.3 });
    }
    // sometimes the outline gets drawn too, the way you're taught not to
    if (w > 26 && rng.chance(0.3)) {
      const sc = [];
      for (let k = 0; k <= n * 4; k++) { const t = k / (n * 4); sc.push(x + (t - 0.5) * w * 0.95, y - h * 0.3 - Math.abs(Math.sin(t * n * 3.14159)) * h * 0.3 - Math.sin(t * 3.14159) * h * 0.12); }
      C.line(rng, T.pencil, K.bluepencil, sc, 1.2, 0.42, { wob: 0.7 });
    }
  }

  S.clouds = function (C, rng) {
    // rows on a flat ceiling far overhead, running away to a vanishing line just above the hills
    const VY = 198, KC = 300;
    for (let Z = 20; Z > 1.42; Z -= (0.115 + 0.02 * rng()) * Math.pow(Z, 1.08)) {
      const y0 = VY - KC / Z, wd = 122 / Z, hazed = ss(6, 16, Z);
      const skew = Z * 0.9 + 3;
      for (let xw = -Z * 1.05 - 2; xw < Z * 1.05 + 2; xw += 0.2 * (0.8 + 0.4 * rng())) {
        const x = 800 + (xw + 0.03 * Math.sin(Z * 2.2 + xw * 1.3) + rng.g() * 0.035) * 900 / Z;
        if (x < -40 || x > 1640) continue;
        // where the ceiling is open: wide lanes of plain sky
        const n = 0.72 * fbm(xw * 0.3 + skew * 0.2, Z * 0.3, 3, 301) + 0.28 * fbm(xw * 1.5 + 7, Z * 1.7, 2, 307);
        const lane = 0.5 + 0.5 * Math.sin((xw * 0.8 + Z * 0.55) * 1.35);     // long diagonal ripples
        const here = n * 0.84 + lane * 0.16 + 0.05 - 0.05 * ss(1000, 1600, x) + 0.05 * hazed;
        if (here < 0.535) continue;
        const sz = clamp((here - 0.535) * 8, 0.25, 1) * (0.6 + 0.6 * rng());
        const big = 0.55 + 1.15 * Math.pow(fbm(xw * 0.6 + 40, Z * 0.55, 2, 331), 1.4);
        const y = y0 + rng.g() * wd * 0.1 + Math.sin(xw * 3.1 + Z) * wd * 0.07;
        if (y > Wd.hills(x) - 1 || y < -12) continue;
        const w = wd * sz * 1.08 * big, h = Math.max(1.4, wd * (0.30 - 0.06 * hazed) * (0.6 + 0.4 * sz) * (0.6 + 0.4 * big));
        tuft(C, rng, x, y, w, h, hazed);
      }
    }
    // haze where the rows run together, low down: a few long soft chalk passes rubbed with a finger
    for (let k = 0; k < 9; k++) {
      const y = 170 + k * 3.2 + rng.g() * 2, x0 = rng.r(-50, 900), x1 = x0 + rng.r(300, 800);
      if (y > Wd.hills((x0 + x1) / 2) - 3) continue;
      C.line(rng, T.chalk, K.white, [x0, y, (x0 + x1) / 2, y + rng.g() * 1.5, x1, y + rng.g()], rng.r(2, 4), 0.4, { wob: 1.2, wl: 200 });
    }
  };

  S.farShore = function (C, rng) {
    const hill = Wd.hills, shore = Wd.shore, HZ = Wd.HZ;
    // hills across the water: three crayons, small strokes
    const R = A.region([0, 176, 1600, 212], (x, y) => y > hill(x) && y < HZ + 1.5);
    A.scribble(C, rng, R, { tool: T.crayonTip, col: K.far, w: 5, gap: 3.1, ang: 0.02, p: 0.85, over: 3, under: 0, run: 8, wob: 0.5 });
    A.scribble(C, rng, A.region([0, 176, 1600, 212], (x, y) => y > hill(x) + 2 + 7 * fbm(x / 60, 2, 2, 401) && y < HZ + 1), { tool: T.crayonTip, col: K.sage, w: 4.5, gap: 3.6, ang: -0.04, p: 0.7, over: 2, under: 1, run: 6, wob: 0.5, skip: 0.1 });
    A.scribble(C, rng, A.region([0, 176, 1600, 212], (x, y) => y > hill(x) + 0.5 && y < hill(x) + 5 && vn(x / 50, 1, 409) > 0.45), { tool: T.crayonTip, col: K.haze, w: 3.2, gap: 3, ang: 0.03, p: 0.75, over: 2, under: 1, run: 4, wob: 0.4 });
    // a second, nearer rise on the right
    const h2 = x => 203.5 - 7 * ss(980, 1330, x) * (0.6 + 0.8 * fbm(x / 120, 5, 2, 411)) - 2.5 * ss(120, 0, x);
    A.scribble(C, rng, A.region([0, 190, 1600, 212], (x, y) => y > h2(x) && y < HZ + 1.5), { tool: T.crayonTip, col: K.sage, w: 4, gap: 2.8, ang: 0.0, p: 0.9, over: 2, under: 0, run: 8, wob: 0.4 });
    A.hatch(C, rng, A.region([900, 190, 1600, 212], (x, y) => y > h2(x) + 1 && y < HZ + 1), { tool: T.pencil, col: K.slate, w: 1.2, gap: 2.8, ang: 0.5, p: 0.5, seg: 9 });
    // the ridge line, said again in blue pencil
    const rl = [];
    for (let x = -10; x <= 1610; x += 9) rl.push(x, hill(x) + 0.3);
    C.line(rng, T.pencil, K.bluepencil, rl, 1.1, 0.42, { wob: 0.5, wl: 40 });
    // trees over there: dots, and a few a child insisted on drawing properly
    for (let x = -5; x < 1610; x += rng.r(2.5, 9)) {
      const n = fbm(x / 90, 3.3, 2, 421);
      if (n < 0.44) { x += rng.r(4, 30); continue; }
      const base = HZ - 0.5 - rng.r(0, 2.2) - (x > 980 ? 4 * ss(980, 1330, x) * rng() : 0), r = rng.r(1.4, 3.3);
      const col = rng.chance(0.55) ? K.spruce : rng.chance(0.5) ? K.moss : K.pine;
      C.line(rng, T.pencil, col, [x - r * 0.5, base - r * 0.5, x + r * 0.3, base - r * 0.9, x + r * 0.6, base - r * 0.3, x - r * 0.2, base - r * 0.2], r * 0.9, 0.7, { wob: 0.3, step: 2 });
    }
    for (let k = 0; k < 15; k++) {
      const x = rng.r(20, 1580), base = HZ - 0.3, hgt = rng.r(5.5, 10.5), r = hgt * rng.r(0.3, 0.42);
      C.line(rng, T.pencil, K.walnut, [x, base, x + rng.g() * 0.5, base - hgt * 0.6], 1.0, 0.7, { wob: 0.2 });
      const lp = [];
      for (let q = 0; q < 16; q++) { const a = q * 0.9, rr = r * (0.4 + 0.6 * (q / 16)); lp.push(x + Math.cos(a) * rr, base - hgt * 0.68 + Math.sin(a) * rr * 0.95); }
      C.line(rng, T.pencil, rng.chance(0.5) ? K.spruce : K.moss, lp, 1.5, 0.75, { wob: 0.3, step: 2, pe: 0.8 });
    }
    // out where the channel meets it, a row of old posts no bigger than eyelashes
    for (let k = 0; k < 17; k++) { const x = 838 + k * 7.3 + rng.g() * 1.2, y = 221.5 + k * 0.16 + rng.g() * 0.3, h = 2.6 + rng() * 1.8; C.line(rng, T.pencil, K.walnut, [x, y, x + rng.g() * 0.3, y - h], 1.1, 0.8, { wob: 0.1, step: 2 }); }
    // the water that is left: a pale band, glints, the far bank's dark edge lying on it
    const Rw = A.region([0, HZ - 1, 1600, 226], (x, y) => y > HZ + 0.3 && y < shore(x));
    A.scribble(C, rng, Rw, { tool: T.crayonTip, col: K.milk, w: 4.2, gap: 2.4, ang: 0.004, p: 0.95, over: 4, under: 0, run: 12, wob: 0.4 });
    A.scribble(C, rng, Rw, { tool: T.chalk, col: K.white, w: 3.2, gap: 3.4, ang: -0.006, p: 0.6, over: 3, under: 2, run: 5, wob: 0.4, skip: 0.25 });
    for (let k = 0; k < 150; k++) {
      const x = rng.r(0, 1600), y = HZ + 0.8 + rng.r(0, 2.4), L = rng.r(4, 26);
      C.line(rng, T.pencil, rng.chance(0.6) ? K.slate : K.spruce, [x, y, x + L, y + rng.g() * 0.3], 1.1, 0.55, { wob: 0.25 });
    }
    for (let k = 0; k < 190; k++) {
      const x = rng.r(0, 1600), y = rng.r(HZ + 3, shore(x) - 1), L = rng.r(3, 20) * (0.5 + (y - HZ) / 12);
      const c = rng.chance(0.55) ? K.white : rng.chance(0.5) ? K.tile : K.cream;
      C.line(rng, c === K.tile ? T.pencil : T.chalk, c, [x, y, x + L, y + rng.g() * 0.25], rng.r(1.1, 1.9), 0.75, { wob: 0.2 });
    }
    // and, very far out, two sails: the ones that went when the water did
    for (const q of [[1016, 216.4, 5.2], [1192, 213.2, 3.3]]) {
      const x = q[0], y = q[1], h = q[2];
      C.line(rng, T.crayonTip, K.tile, [x - h * 1.6, y + 0.6, x + h * 1.8, y + 0.7], 2.4, 0.9, { wob: 0.15, step: 2, pe: 0.5 });   // a bit of blue water for it to sit on
      C.line(rng, T.pencil, K.walnut, [x - h * 0.55, y + 0.2, x + h * 0.6, y + 0.2], 1.2, 0.9, { wob: 0.1, step: 2 });
      C.stroke([x - h * 0.02, y - h, 0.9, 0.45, x - h * 0.3, y - 0.5, 1, 1.25], T.chalk, K.white, h * 0.46, 0.98);
      C.stroke([x - h * 0.02, y - h, 0.9, 0.45, x - h * 0.3, y - 0.5, 1, 1.25], T.crayonTip, K.white, h * 0.4, 0.95);
      C.stroke([x + h * 0.12, y - h * 0.82, 0.9, 0.4, x + h * 0.34, y - 0.5, 1, 1], T.crayonTip, K.far, h * 0.3, 0.95);
      C.line(rng, T.pencil, K.slate, [x + h * 0.05, y - h * 1.05, x + h * 0.05, y], 1.0, 0.7, { wob: 0.05, step: 2 });
    }
  };
})(typeof self !== 'undefined' ? self : globalThis);
