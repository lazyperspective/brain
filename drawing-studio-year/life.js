/* A YEAR, STILL WARM — small lives, and the small lights.
 *
 *   birds        far off, a pencil tick each: arriving in spring, wheeling on summer
 *                evenings, leaving in long skeins in autumn, almost none in winter
 *   butterflies  two or three, where the flowers are, on warm still days
 *   fireflies    over the grass on summer nights
 *   the lights   the ones the original drawing is about: they gather in the hollow
 *                when the day goes, and on warm nights when there is a moon to go
 *                to, they rise along the old trail towards it. In winter there are
 *                only two or three, and they stay close.
 */
'use strict';
const { c01, sstep, lerp, hash1, HOR, KY, ND } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');
const { createHand } = require('./hand.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, Sc = Wd.Sc, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS, REG = Wd.REG, DUR = K.DUR;
  const { hash2, PX, PY, PP, TOOLS } = E, H = createHand(E);
  const X0 = Wd.X0, X1 = Wd.X1, Y0 = Wd.Y0, Y1 = Wd.Y1, Wn = X1 - X0, NEST = Sc.NEST;
  const TWO_PI = 6.283185307;
  const frameAt = (day, h) => Math.round(K.tauAtD(K.at(day, h)) * FPS) % F;
  const col = [0, 0, 0], c2 = [0, 0, 0], q = [0, 0];

  // ---------- birds
  const FLOCKS = [];
  function flock(day, hour, secs, n, from, to, size, shape, seed) {
    const birds = [];
    for (let i = 0; i < n; i++) {
      const h = k => hash2(seed * 131 + i, k, 901);
      let ox, oy;
      if (shape === 'V') { const side = i % 2 ? 1 : -1, rank = Math.ceil(i / 2); ox = -rank * 11 * size + (h(1) - 0.5) * 4; oy = side * rank * 5.5 * size + (h(2) - 0.5) * 3; }
      else { ox = (h(1) - 0.5) * 30 * size * Math.sqrt(n); oy = (h(2) - 0.5) * 14 * size * Math.sqrt(n); }
      birds.push({ ox, oy, ph: h(3) * 6.283, fq: 3 + h(4) * 1.2, s: size * (0.8 + 0.4 * h(5)), wob: 2 + 4 * h(6) });
    }
    FLOCKS.push({ f0: frameAt(day, hour), nF: Math.round(secs * FPS), from, to, birds, shape, seed, arc: (hash2(seed, 1, 902) - 0.5) * 60 });
  }
  const L = X0 - 60, Rr = X1 + 60;
  flock(1, 9.5, 6.5, 9, [L, 330], [Rr, 250], 1.0, 'loose', 1);          // April: back from the south
  flock(1, 16, 6, 5, [L, 420], [Rr, 470], 0.7, 'loose', 2);
  flock(2, 13.5, 7, 13, [L, 200], [Rr, 300], 1.1, 'loose', 3);
  flock(2, 18.2, 6, 3, [Rr, 380], [L, 300], 0.9, 'loose', 4);
  flock(3, 18.1, 7, 4, [L, 470], [Rr, 430], 0.8, 'loose', 5);
  flock(4, 10.5, 7, 2, [Rr, 150], [L, 260], 1.2, 'loose', 6);
  flock(5, 17.5, 7, 6, [L, 320], [Rr, 400], 0.9, 'loose', 7);
  flock(6, 16.9, 8, 17, [Rr, 230], [L, 380], 1.0, 'V', 8);              // September: going
  flock(6, 9.5, 8, 11, [Rr, 420], [L, 480], 0.7, 'V', 9);
  flock(7, 12.5, 8, 23, [Rr, 120], [L, 300], 1.15, 'V', 10);
  flock(7, 16.6, 8.5, 15, [Rr, 330], [L, 440], 0.85, 'V', 11);
  flock(8, 16, 7, 7, [Rr, 440], [L, 500], 0.6, 'V', 12);
  flock(9, 12.5, 8, 1, [L, 300], [Rr, 360], 1.2, 'loose', 13);          // December: one, alone, in the cold
  flock(10, 9.5, 7.5, 2, [Rr, 260], [L, 330], 1.1, 'loose', 14);
  flock(0, 10.5, 7, 3, [L, 380], [Rr, 330], 0.9, 'loose', 15);
  function drawBirds() {
    const f = st.f;
    for (const fl of FLOCKS) {
      let df = f - fl.f0; if (df < 0) df += F; if (df >= fl.nF) continue;
      const u = df / fl.nF, t = df / FPS;
      const cx = lerp(fl.from[0], fl.to[0], u), cy = lerp(fl.from[1], fl.to[1], u) - fl.arc * Math.sin(Math.PI * u);
      const dir = fl.to[0] > fl.from[0] ? 1 : -1;
      // dark against the day, darker against the dusk; lost in mist
      const A = st.Av; Lk.grade(col, 0, 0.16 * (st.Sv[0] * 0.5 + A[0]), 0.16 * (st.Sv[1] * 0.5 + A[1]), 0.2 * (st.Sv[2] * 0.5 + A[2]));
      const vis = 1 - 0.8 * st.veil;
      for (const b of fl.birds) {
        const x = cx + dir * b.ox + b.wob * Math.sin(0.9 * t + b.ph), y = cy + b.oy + b.wob * 0.6 * Math.sin(1.3 * t + b.ph * 2);
        if (x < X0 - 10 || x > X1 + 10) continue;
        // far birds are small: they are over the sea
        const far = c01((y - 150) / 380), s = b.s * lerp(3.4, 1.7, far);
        const flap = Math.sin(TWO_PI * b.fq * t + b.ph), glide = Math.sin(0.7 * t + b.ph) > 0.55 ? 0.25 : 1;
        const wy = -s * (0.15 + 0.75 * flap * glide);
        PX[0] = x - s * 1.5; PY[0] = y + wy; PP[0] = 0.5; PX[1] = x - s * 0.6; PY[1] = y + wy * 0.35 - s * 0.1; PP[1] = 0.95; PX[2] = x; PY[2] = y; PP[2] = 1; PX[3] = x + s * 0.6; PY[3] = y + wy * 0.35 - s * 0.1; PP[3] = 0.95; PX[4] = x + s * 1.5; PY[4] = y + wy; PP[4] = 0.5;
        E.stroke(5, Math.max(0.9, s * 0.42), TOOLS.PENCIL, col, 0.9 * vis, fl.seed * 100 + (b.ph * 10 | 0));
      }
    }
  }

  // ---------- butterflies
  const BFLY = [];
  for (let i = 0; i < 4; i++) BFLY.push({ cx: [930, 1250, 700, 1100][i], cy: [800, 760, 860, 960][i], ph: i * 2.1 + 0.4, yel: i % 2, d0: 3.1 + 0.5 * i, d1: 8.4 - 0.4 * i });
  function drawButterflies() {
    const act = st.day * sstep(11, 16, st.T) * (1 - c01(st.rain * 5)) * sstep(0.75, 0.4, Math.abs(st.wind)) * sstep(0.2, 0.5, st.direct + 0.3); if (act < 0.05) return;
    const t = st.tau;
    for (const b of BFLY) {
      const on = sstep(b.d0, b.d0 + 0.2, st.cal) * (1 - sstep(b.d1, b.d1 + 0.2, st.cal)) * act; if (on < 0.05) continue;
      if (b.cx < X0 + 20 || b.cx > X1 - 20) continue;
      const x = b.cx + 90 * Math.sin(0.23 * t + b.ph) + 26 * Math.sin(1.31 * t + b.ph * 2) + 7 * Math.sin(5.2 * t + b.ph), y = b.cy - 26 + 30 * Math.sin(0.31 * t + b.ph * 1.7) + 12 * Math.sin(1.9 * t + b.ph) + 5 * Math.sin(6.1 * t + b.ph * 3);
      const sc = Math.max(0.6, (y - 520) / 222), s = 3.2 * sc, flap = Math.abs(Math.sin(11 * t + b.ph));
      const g = { wX: 0, wZ: 0, L0: 0, aux: 0.5, depth: 0.5 };
      Pt.lightGround(col, b.yel ? [1.15, 1.0, 0.35] : [1.2, 1.18, 1.1], x, y, 0, 0, 0, 0.5, 0.6);
      for (const sg of [-1, 1]) { PX[0] = x; PY[0] = y; PP[0] = 0.9; PX[1] = x + sg * s * (0.25 + 0.75 * flap); PY[1] = y - s * (0.9 - 0.3 * flap); PP[1] = 0.8; E.scratch(2, s * 0.62, 0.9 * on, col); }
    }
  }

  // ---------- fireflies
  const FF = [];
  for (let i = 0; i < 46; i++) { const h = k => hash2(i, k, 911); FF.push({ x: X0 + Wn * h(1), y: 650 + (Y1 - 700) * Math.pow(h(2), 1.2), ph: h(3) * 6.283, per: 2.4 + 2.6 * h(4), duty: 0.3 + 0.25 * h(5), a: 20 + 40 * h(6), b: 6 + 12 * h(7), thr: h(8) }); }
  function drawFireflies() {
    const act = st.night * sstep(12.5, 17, st.T) * (1 - c01(st.rain * 4)) * sstep(0.7, 0.3, Math.abs(st.wind)) * sstep(4.3, 5.0, st.cal) * (1 - sstep(8.2, 9.0, st.cal));
    if (act < 0.03) return;
    const t = st.tau; col[0] = 0.86; col[1] = 1.0; col[2] = 0.42; c2[0] = 0.99; c2[1] = 1.0; c2[2] = 0.78;
    for (const f of FF) {
      if (f.thr > act) continue;
      const cyc = (t / f.per + f.ph) % 1, on = cyc < f.duty ? Math.sin(Math.PI * cyc / f.duty) : 0; if (on < 0.05) continue;
      const sc = Math.max(0.5, (f.y - 520) / 222);
      const x = f.x + f.a * sc * Math.sin(0.27 * t + f.ph) + 8 * sc * Math.sin(1.1 * t + f.ph * 2), y = f.y - 12 * sc + f.b * sc * Math.sin(0.41 * t + f.ph * 1.3);
      H.rubDot(x, y, (5 + 4 * sc) * 1.0, 0.26 * on, col);
      H.pinDot(x, y, 1.2 * Math.min(1.8, sc + 0.3), 0.95 * on, c2);
    }
  }

  // ---------- the small lights going up
  const NM = 74, NLOW = 30, NWIN = 5;
  const MOTE = []; for (let i = 0; i < NM; i++) { const h = k => hash2(i, k, 921); MOTE.push({ T: DUR / Math.round(DUR / (15 + 9 * h(1))), ph: h(2), g1: (h(3) + h(4) + h(5) + h(6) - 2) * 0.87, g2: (h(7) + h(8) + h(9) + h(10) - 2) * 0.87, sz: 0.55 + 0.75 * h(11), tw: h(12) * 6.283 }); }
  const LOW = []; for (let i = 0; i < NLOW; i++) { const h = k => hash2(i, k, 922); const a = h(1) * 6.283, r = NEST.R * Math.sqrt(h(2)) * 0.95; Sc.w2s(r * Math.cos(a), r * Math.sin(a), q); LOW.push({ x: q[0], y: q[1], hgt: (6 + 64 * h(3)) * (0.4 + 0.6 * h(4)), sz: 0.6 + 0.9 * h(5), ph: h(6) * 6.283, per: DUR / Math.round(DUR / (5 + 5 * h(7))), rank: h(8) }); }
  const trail = new Float32Array(202);
  function buildTrail(mx, my) {
    // the original's trail, its far end tied to wherever the moon is tonight
    const lowm = c01((my - 120) / 380);
    const P = [[960, 730], [988, 652], [954, 566], [lerp(905, 930, lowm), lerp(476, 520, lowm)], [lerp(826, (905 + mx) / 2, lowm * 0.6), lerp(404, (476 + my) / 2 + 30, lowm)], [lerp(778, mx + 40, 0.35), lerp(322, my + 60, 0.5)], [mx + 5, my + 11]];
    let n = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(P.length - 1, i + 2)], steps = i === P.length - 2 ? 17 : 16;
      for (let j = 0; j < steps && n < 101; j++) { const t = j / 16, t2 = t * t, t3 = t2 * t;
        trail[n * 2] = 0.5 * ((2 * b[0]) + (-a[0] + c[0]) * t + (2 * a[0] - 5 * b[0] + 4 * c[0] - d[0]) * t2 + (-a[0] + 3 * b[0] - 3 * c[0] + d[0]) * t3);
        trail[n * 2 + 1] = 0.5 * ((2 * b[1]) + (-a[1] + c[1]) * t + (2 * a[1] - 5 * b[1] + 4 * c[1] - d[1]) * t2 + (-a[1] + 3 * b[1] - 3 * c[1] + d[1]) * t3); n++; }
    }
    return n;
  }
  const lemon = [1.0, 0.90, 0.44], butter = [1.0, 0.95, 0.74];
  function light(x, y, sz, a) {
    if (a < 0.04) return;
    H.rubDot(x, y, 5 + sz * 7, (0.2 + 0.12 * sz) * a, lemon);
    H.pinDot(x, y, sz * 1.6, 0.97 * a, butter);
  }
  function drawLights() {
    const gl = st.glow; if (gl < 0.06) return;
    const t = st.tau, warm = sstep(0.25, 0.8, st.warm), calm = sstep(1.0, 0.4, Math.abs(st.wind)) * (1 - c01(st.rain * 3)) * (1 - c01(st.snowf * 2));
    // the ones that only hang over the hollow: many in the warm months, a few always
    const nShow = lerp(NWIN, NLOW, warm);
    for (let i = 0; i < NLOW; i++) {
      const l = LOW[i]; if (l.rank * NLOW > nShow) continue;
      const cyc = (t / l.per + l.ph / 6.283) % 1, bob = Math.sin(TWO_PI * cyc), a = c01(gl * 1.4) * (0.55 + 0.45 * Math.sin(TWO_PI * cyc * 2 + l.ph)) * (0.4 + 0.6 * calm + 0.0);
      light(l.x + 3 * Math.sin(0.6 * t + l.ph), l.y - l.hgt * (0.75 + 0.25 * bob) * (0.5 + 0.5 * warm), l.sz * (0.7 + 0.3 * warm), a);
    }
    // the ones that go: only when there is a moon to go to, and the night is warm and still
    const go = c01(gl * 1.3) * warm * calm * c01(st.moonUp * 1.5) * sstep(0.4, 8, st.moonAlt) * (1 - st.ovc);
    if (go < 0.04) return;
    const mx = st.moonX, my = HOR - KY * st.moonAlt, n = buildTrail(mx, my);
    for (let i = 0; i < NM; i++) {
      const m = MOTE[i];
      const u = (t / m.T + m.ph) % 1, tt = 0.03 + 0.97 * Math.pow(u, 1.25), fi = tt * (n - 1), i0 = Math.min(n - 2, fi | 0), k = fi - i0;
      const x = trail[i0 * 2] + (trail[i0 * 2 + 2] - trail[i0 * 2]) * k, y = trail[i0 * 2 + 1] + (trail[i0 * 2 + 3] - trail[i0 * 2 + 1]) * k;
      const spread = 4 + 15 * Math.sin(Math.PI * tt) + 34 * Math.exp(-tt * 11);
      const a = go * sstep(0, 0.05, u) * (1 - sstep(0.93, 1, u)) * (0.7 + 0.3 * Math.sin(1.7 * t + m.tw));
      light(x + m.g1 * spread + 2 * Math.sin(0.8 * t + m.tw), y + m.g2 * spread * 0.55, (2.1 - 1.2 * tt) * m.sz, a);
    }
  }

  function drawFar() { drawBirds(); }
  function drawNear() { drawButterflies(); drawFireflies(); drawLights(); }
  return { drawFar, drawNear, FLOCKS };
}
module.exports = { create };
