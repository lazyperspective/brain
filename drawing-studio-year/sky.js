/* A YEAR, STILL WARM — the sun, the moon and the stars.
 *
 * Everything bright in the sky is the paper itself, found again: the sun and the
 * moon are lifted with the eraser, the stars are single touches of the pin, as in
 * the original drawing. We are looking west, so everything sets — down and a
 * little to the right — and the sun's road moves along the horizon with the
 * seasons: far to the left in December, straight over the hollow at midsummer.
 */
'use strict';
const { c01, sstep, lerp, hash1, KX, KY, XC, HOR, ND } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');
const { createHand } = require('./hand.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS, REG = Wd.REG;
  const { hash2, PX, PY, PP, TOOLS } = E, H = createHand(E);
  const SKYBIT = 1 << REG.SKY, WATERBIT = 1 << REG.WATER;
  const TWO_PI = 6.283185307;

  // ---------- stars: a field that closes on itself, turning slowly all year
  const SPX = 1485, SPY = 1100, DRX = SPX * 1, DRY = SPY * 5;        // total drift over the year (whole periods, so the loop closes)
  const STARS = [];
  for (let i = 0; i < 460; i++) {
    const big = hash2(i, 1, 601) < 0.09;
    STARS.push({ u: hash2(i, 2, 601) * SPX, v: hash2(i, 3, 601) * SPY, s: big ? 1.35 + 0.5 * hash2(i, 4, 601) : 0.6 + 0.65 * hash2(i, 4, 601), mag: big ? 0.1 * hash2(i, 5, 601) : 0.1 + 0.9 * hash2(i, 5, 601), ph: hash2(i, 6, 601) * 6.283, fq: 3 + ((hash2(i, 7, 601) * 9) | 0) });
  }
  // the river of faint ones that crosses the summer sky
  for (let i = 0; i < 420; i++) {
    const t = hash2(i, 1, 602), across = (hash2(i, 2, 602) + hash2(i, 3, 602) + hash2(i, 4, 602) - 1.5) * 150;
    STARS.push({ u: (t * SPX + across * 0.8) % SPX, v: ((t * SPY * 1 + 300 - across * 0.6) % SPY + SPY) % SPY, s: 0.4 + 0.3 * hash2(i, 5, 602), mag: 2, river: 1, ph: hash2(i, 6, 602) * 6.283, fq: 5 });
  }
  const sk = [0, 0, 0], col = [0, 0, 0];
  const starCol = [1.0, 0.975, 0.90];
  function drawStars() {
    const dark = sstep(-2.5, -12, st.alt); if (dark < 0.02) return;
    const prog = st.d / ND, ox = DRX * prog, oy = DRY * prog;
    const Wn = Wd.X1 - Wd.X0, drift = C.Wint[st.f] * Pt.ADV.deck.k;
    // clearer air in the cold, a bright moon washes the faint ones out
    const limit = 0.52 + 0.4 * (1 - st.warm) - 0.38 * st.moonI - 0.25 * st.haze, deep = sstep(-12, -17, st.alt) * (1 - c01(st.moonI * 2.2)) * (1 - st.haze);
    const my = HOR - KY * st.moonAlt;
    for (let i = 0; i < STARS.length; i++) {
      const s = STARS[i];
      let a;
      if (s.river) { a = deep * sstep(0.35, 0.8, st.warm) * 0.8; if (a < 0.03) continue; }
      else { if (s.mag > limit) continue; a = dark * Math.min(1, (limit - s.mag) * 6); }
      const x = Wd.X0 - 100 + ((((s.u + ox) % SPX) + SPX) % SPX);
      if (x > Wd.X1 + 4) continue;
      const y = Wd.Y0 - 40 + ((((s.v + oy) % SPY) + SPY) % SPY);
      if (y > HOR - 6) continue;
      const altd = (HOR - y) / KY;
      a *= 0.35 + 0.65 * sstep(1, 18, altd);
      const oc = Pt.ovcLocal(x, y, drift); if (oc > 0.02) a *= 1 - c01(oc * 1.5);
      if (st.moonI > 0.05) { const r2 = (x - st.moonX) * (x - st.moonX) + (y - my) * (y - my); if (r2 < 60 * 60) continue; }
      a *= 0.72 + 0.28 * Math.sin(TWO_PI * s.fq / 16 * st.tau + s.ph);      // they breathe
      if (a < 0.04) continue;
      H.pinDot(x, y, s.s * 1.5, 0.95 * a, starCol);
      if (s.s > 1.3) {
        H.rubDot(x, y, 9, 0.25 * a, starCol);
        PX[0] = x - 3.2; PY[0] = y; PP[0] = 0.5; PX[1] = x + 3.2; PY[1] = y; PP[1] = 0.5; E.scratch(2, 0.45, 0.8 * a, starCol);
        PX[0] = x; PY[0] = y - 3.6; PP[0] = 0.5; PX[1] = x; PY[1] = y + 3.6; PP[1] = 0.5; E.scratch(2, 0.45, 0.8 * a, starCol);
        H.pinDot(x, y, 1.9, a, starCol);
      }
    }
    // a falling star: once in high summer, once on the longest night
    for (const m of METEORS) {
      let df = st.f - m.f0; if (df < 0 || df >= m.n) continue;
      const u = df / m.n, hd = Math.min(1, u * 1.5), tl = Math.max(0, hd - 0.42 - 0.2 * u), a = dark * (1 - u * u);
      PX[0] = m.x + m.dx * tl; PY[0] = m.y + m.dy * tl; PP[0] = 0.15; PX[1] = m.x + m.dx * (tl + hd) / 2; PY[1] = m.y + m.dy * (tl + hd) / 2; PP[1] = 0.6; PX[2] = m.x + m.dx * hd; PY[2] = m.y + m.dy * hd; PP[2] = 1;
      E.scratch(3, 1.1, 0.9 * a, starCol);
    }
  }
  const METEORS = [
    { f0: Math.round(K.tauAtD(K.at(5, 23.4)) * FPS), n: 13, x: Wd.X0 + (Wd.X1 - Wd.X0) * 0.16, y: Wd.Y0 + (HOR - Wd.Y0) * 0.24, dx: 150, dy: 118 },
    { f0: Math.round(K.tauAtD(K.at(9, 28.2)) * FPS), n: 11, x: Wd.X0 + (Wd.X1 - Wd.X0) * 0.46, y: Wd.Y0 + (HOR - Wd.Y0) * 0.2, dx: -120, dy: 96 },
  ];

  // ---------- the moon: a boat of a moon, scraped out one arc at a time
  const MR = 12.5;
  function drawMoon() {
    const up = st.moonUp; if (up < 0.02) return;
    const x = st.moonX, y = HOR - KY * st.moonAlt;
    if (x < Wd.X0 - 30 || x > Wd.X1 + 30 || y < Wd.Y0 - 30) return;
    const drift = C.Wint[st.f] * Pt.ADV.deck.k, oc = Pt.ovcLocal(x, y, drift);
    const night = 1 - st.day, vis = up * (1 - c01(oc * 1.25)) * (0.32 + 0.68 * night) * (1 - 0.6 * st.fog);
    if (vis < 0.03) return;
    const ph = st.moonPhase, low = sstep(9, 1, st.moonAlt);
    mix3([0.99, 0.975, 0.92], [1.0, 0.80, 0.50], low * 0.8, col);
    if (st.day > 0.5) mix3(col, [0.93, 0.95, 0.98], 0.6, col);
    // its breath on the air, and the whole dim disc
    H.rubDot(x, y, 110, 0.10 * vis * night, col); H.rubDot(x, y, 56, 0.08 * vis * night, col);
    for (let rad = 0.6; rad < MR - 0.3; rad += 0.62) { let n = 0; for (let a = 0; a <= 6.4; a += 0.25) { PX[n] = x + rad * Math.cos(a); PY[n] = y + rad * Math.sin(a); PP[n] = 1; n++; } E.scratch(n, 0.8, 0.09 * vis, col); }
    // the lit part faces the sun (which is below the sea to the right, or behind us before dawn)
    let sx, sy;
    if (ph < 0.5) { sx = st.sx - x; sy = Math.max(40, st.sy - y); } else { sx = -0.35; sy = -0.94; }
    const sl = Math.hypot(sx, sy); sx /= sl; sy /= sl;
    const cph = Math.cos(TWO_PI * ph), sa = Math.atan2(sy, sx);
    for (let rad = MR - 0.25; rad > 0.4; rad -= 0.5) {
      let n = 0;
      const flush = () => { if (n > 1) E.scratch(n, 0.75, 0.97 * vis, col); n = 0; };
      for (let a = -3.14; a <= 3.15; a += 0.045) {
        const u = rad / MR * Math.cos(a), v = rad / MR * Math.sin(a);          // u along the sun direction
        if (u > cph * Math.sqrt(Math.max(0, 1 - v * v)) + 0.02) { PX[n] = x + rad * Math.cos(sa + a); PY[n] = y + rad * Math.sin(sa + a); PP[n] = 0.75; n++; if (n > 60) { flush(); } } else flush();
      }
      flush();
    }
  }

  // ---------- the sun: bare paper, with the wax pushed back around it
  function drawSun() {
    if (st.alt < -2.5) return;
    const x = st.sx, y = st.sy;
    if (x < Wd.X0 - 60 || x > Wd.X1 + 60 || y < Wd.Y0 - 60) return;
    const drift = C.Wint[st.f] * Pt.ADV.deck.k, oc = Pt.ovcLocal(x, y, drift);
    const vis = (1 - c01(oc * 1.12)) * (1 - 0.65 * st.fog) * (1 - 0.8 * st.snowf) * (1 - 0.7 * st.rain);
    if (vis < 0.03) return;
    const low = sstep(14, 0.5, st.alt), r = 13.5 + 5.5 * low;
    const sc = st.sunCol;
    col[0] = 1.0; col[1] = lerp(0.985, sc[1] * 0.97 + 0.05, low); col[2] = lerp(0.90, sc[2] * 0.85 + 0.02, low);
    H.rubDot(x, y, r * 7.5, 0.20 * vis, col);
    H.rubDot(x, y, r * 3.6, 0.38 * vis, col);
    // the disc: rubbed clean, then burnished with the palest stick so its edge is a crayon's edge
    H.rubDot(x, y, r * 2.25, 0.95 * vis, col);
    PX[0] = x; PY[0] = y; PP[0] = 1; E.stroke(1, r * 2, TOOLS.CRAYON, col, 0.92 * vis, 7);
    PX[0] = x; PY[0] = y; PP[0] = 1; E.stroke(1, r * 1.95, TOOLS.PENCIL, col, 0.8 * vis, 8);
  }

  // ---------- glitter on the water under the sun or the moon
  const GL = []; for (let k = 0; k < 190; k++) GL.push({ g: (hash2(k, 1, 611) + hash2(k, 2, 611) + hash2(k, 3, 611) + hash2(k, 4, 611) - 2) * 0.87, yy: Math.pow(hash2(k, 5, 611), 1.4), L: 2.5 + 9.5 * hash2(k, 6, 611), w: 0.45 + 0.35 * hash2(k, 7, 611), ph: hash2(k, 8, 611) * 6.283, fq: 5 + ((hash2(k, 9, 611) * 14) | 0) });
  function drawGlitter() {
    let gx, I, c;
    if (st.direct > 0.03 && st.alt > -1.5) { gx = st.sx; I = st.direct * sstep(-1.5, 2, st.alt) * sstep(50, 22, st.alt); col[0] = 1; col[1] = 0.55 + 0.42 * st.sunCol[1]; col[2] = 0.3 + 0.55 * st.sunCol[2]; }
    else if (st.moonI > 0.05 && st.moonAlt > 0) { gx = st.moonX; I = st.moonI * 0.8; col[0] = 0.92; col[1] = 0.95; col[2] = 1.0; }
    else if (st.alt > -7 && st.alt <= -1.5 && st.pm) { gx = st.sx; I = 0.5 * sstep(-7, -2, st.alt) * (1 - st.ovc); mix3(st.horizon, [1, 0.9, 0.7], 0.5, col); }
    else return;
    I *= 1 - 0.6 * st.rough; if (I < 0.04) return;
    for (const g of GL) {
      const tw = 0.5 + 0.5 * Math.sin(TWO_PI * g.fq / 16 * st.tau + g.ph); if (tw < 0.35) continue;
      const y = HOR + 1.5 + 40 * g.yy, x = gx + g.g * (16 + (y - HOR) * 1.5), L = g.L * (0.6 + (y - HOR) / 40);
      PX[0] = x - L / 2; PY[0] = y; PP[0] = 0.4; PX[1] = x; PY[1] = y; PP[1] = 1; PX[2] = x + L / 2; PY[2] = y; PP[2] = 0.4;
      E.scratch(3, g.w, 0.92 * I * (tw - 0.35) / 0.65, col);
    }
  }

  function draw() {
    const clip = E.getClip();
    E.setClip(SKYBIT);
    drawStars(); drawMoon(); drawSun();
    E.setClip(WATERBIT); drawGlitter();
    E.setClip(clip);
  }
  return { draw };
}
module.exports = { create };
