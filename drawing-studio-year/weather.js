/* A YEAR, STILL WARM — what falls and what hangs in the air.
 *
 *   rain     the pin, drawn fast and slanting with the wind, in three depths
 *   snow     the eraser and the pin: flakes that drift, far ones small, near ones soft
 *   fog      chalk dust rubbed in with the side of the thumb, in banks that slide
 *   lightning, spindrift, and the snow that slips off a branch in a thaw
 *
 * Every drop and flake follows a closed path in time (it loops with the film) and
 * is carried sideways by the same wind that bends the grass.
 */
'use strict';
const { c01, sstep, lerp, hash1, HOR, KY } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');
const { createHand } = require('./hand.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, Sc = Wd.Sc, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS, REG = Wd.REG, DUR = K.DUR;
  const { hash2, PX, PY, PP, TOOLS } = E, H = createHand(E);
  const X0 = Wd.X0, X1 = Wd.X1, Y0 = Wd.Y0, Y1 = Wd.Y1, Wn = X1 - X0, Hn = Y1 - Y0;
  const WT = C.Wint[F];
  const adv = (width, unitsPerWind) => { const n = Math.max(1, Math.round(Math.abs(unitsPerWind * WT) / width)); return n * width / WT; };
  const wrap = (v, a, w) => a + ((((v - a) % w) + w) % w);
  const col = [0, 0, 0], c2 = [0, 0, 0];

  // ---------- rain
  const RL = [   // depth layers: count, length, speed (units/s), pin width, strength, sideways carry
    { n: 620, len: [14, 26], sp: 430, w: 0.42, a: 0.22, kw: 60 },
    { n: 300, len: [30, 54], sp: 700, w: 0.55, a: 0.30, kw: 110 },
    { n: 100, len: [80, 140], sp: 1100, w: 0.8, a: 0.40, kw: 190 },
  ];
  for (const L of RL) { L.span = Hn + 200; L.sp = Math.round(L.sp * DUR / L.span) * L.span / DUR; L.k = adv(Wn + 200, L.kw); }
  function drawRain(near) {
    const r = st.rain; if (r < 0.01) return;
    const tau = st.tau, slant = Math.max(-0.9, Math.min(0.9, st.wind * 0.55));
    const b = 0.55 + 0.45 * st.day + st.flashK * 0.5; col[0] = 0.80 * b; col[1] = 0.86 * b; col[2] = 0.97 * b;
    for (let li = near ? 2 : 0; li < (near ? 3 : 2); li++) {
      const L = RL[li], dx = C.Wint[st.f] * L.k;
      for (let i = 0; i < L.n; i++) {
        const h = hash2(i, li, 801); if (h > r * 1.05) continue;
        const a = Math.min(1, (r * 1.05 - h) * 8);
        const y = Y0 - 100 + ((hash2(i, li, 802) * L.span + L.sp * tau * (0.85 + 0.3 * hash2(i, li, 803))) % L.span);
        const len = lerp(L.len[0], L.len[1], hash2(i, li, 804)) * (0.7 + 0.5 * r);
        const x = wrap(X0 - 100 + hash2(i, li, 805) * (Wn + 200) + dx + slant * (y - Y0), X0 - 100, Wn + 200);
        // far rain is only seen against the sky and the sea; near rain crosses everything
        if (li === 0 && y > 640) continue; if (li === 1 && y > 900) continue;
        PX[0] = x - slant * len; PY[0] = y - len; PP[0] = 0.3; PX[1] = x - slant * len * 0.4; PY[1] = y - len * 0.4; PP[1] = 0.9; PX[2] = x; PY[2] = y; PP[2] = 0.7;
        E.scratch(3, L.w, L.a * a, col);
      }
    }
    if (near) {
      // where it lands: quick small ticks on the path and the near grass
      const nS = Math.round(30 * r), fr = st.f;
      for (let k = 0; k < nS; k++) {
        const x = X0 + hash2(fr, k, 811) * Wn, y = 660 + (Y1 - 660) * Math.pow(hash2(fr, k, 812), 0.7), s = Math.max(0.5, (y - 520) / 222);
        PX[0] = x - 2.2 * s; PY[0] = y - 1.6 * s; PP[0] = 0.6; PX[1] = x; PY[1] = y; PP[1] = 0.3; PX[2] = x + 2.2 * s; PY[2] = y - 1.8 * s; PP[2] = 0.6;
        E.scratch(3, 0.5, 0.2, col);
      }
    }
  }

  // ---------- snow
  const SL = [
    { n: 700, sp: 34, r: 0.9, kw: 40, sway: 5, a: 0.75 },
    { n: 460, sp: 52, r: 1.3, kw: 70, sway: 8, a: 0.85 },
    { n: 230, sp: 78, r: 1.9, kw: 120, sway: 12, a: 0.9 },
    { n: 64, sp: 118, r: 3.0, kw: 200, sway: 18, a: 0.92 },
  ];
  for (const L of SL) { L.span = Hn + 120; L.sp = Math.max(1, Math.round(L.sp * DUR / L.span)) * L.span / DUR; L.k = adv(Wn + 240, L.kw); }
  function drawSnow(near) {
    const s = st.snowf; if (s < 0.01) return;
    const tau = st.tau, sc = ctx.tree ? ctx.tree.snowColour() : PAPER;
    // flakes are always a little lighter than the air they fall through
    const b = 0.42 + 0.58 * st.day; col[0] = Math.max(sc[0], 0.86 * b + 0.1); col[1] = Math.max(sc[1], 0.88 * b + 0.1); col[2] = Math.max(sc[2], 0.93 * b + 0.12);
    const gale = Math.abs(st.wind);
    for (let li = near ? 2 : 0; li < (near ? 4 : 2); li++) {
      const L = SL[li], dx = C.Wint[st.f] * L.k;
      for (let i = 0; i < L.n; i++) {
        const h = hash2(i, li, 821); if (h > s * 1.1) continue;
        const a = Math.min(1, (s * 1.1 - h) * 6) * L.a;
        const ph = hash2(i, li, 822) * 6.283, t = tau * (0.8 + 0.4 * hash2(i, li, 823));
        const y = Y0 - 60 + ((hash2(i, li, 824) * L.span + L.sp * t) % L.span);
        const x = wrap(X0 - 120 + hash2(i, li, 825) * (Wn + 240) + dx + L.sway * Math.sin(1.1 * t + ph) + L.sway * 0.4 * Math.sin(2.7 * t + ph * 2), X0 - 120, Wn + 240);
        if (li === 0 && y > 690) continue;
        const r = L.r * (0.75 + 0.5 * hash2(i, li, 826));
        if (gale > 0.7) { const sl = Math.sign(st.wind) * Math.min(1, gale - 0.5) * r * 3.2; PX[0] = x - sl; PY[0] = y - r * 0.7; PP[0] = 0.4; PX[1] = x; PY[1] = y; PP[1] = 1; E.scratch(2, r * 1.1, a * 0.85, col); }
        else { if (li >= 2) H.rubDot(x, y, r * 3.2, 0.42 * a, col); H.pinDot(x, y, r * 1.5, a, col); }
      }
    }
  }
  // spindrift: when it blows hard over lying snow, the surface smokes
  const SD = []; for (let i = 0; i < 26; i++) SD.push({ y: 640 + (Y1 - 640) * Math.pow(hash2(i, 1, 831), 0.8), x: hash2(i, 2, 831), L: 60 + 160 * hash2(i, 3, 831), w: 8 + 14 * hash2(i, 4, 831), ph: hash2(i, 5, 831) * 6.283, k: adv(Wn + 500, 420 + 260 * hash2(i, 6, 831)) });
  function drawSpindrift() {
    const g = Math.abs(st.wind); if (g < 0.6 || st.snow < 0.25) return;
    const sc = ctx.tree ? ctx.tree.snowColour() : PAPER, a0 = c01((g - 0.6) * 1.6) * c01(st.snow * 2);
    for (const s of SD) {
      const x = wrap(X0 - 250 + s.x * (Wn + 500) + C.Wint[st.f] * s.k, X0 - 250, Wn + 500), sc2 = Math.max(0.5, (s.y - 520) / 222);
      const a = a0 * (0.5 + 0.5 * Math.sin(st.tau * 1.7 + s.ph)); if (a < 0.05) continue;
      H.line([[x, s.y], [x + s.L * 0.5 * sc2, s.y - 2 * sc2 - 3 * Math.sin(st.tau * 2.3 + s.ph)], [x + s.L * sc2, s.y - 1]], s.w * sc2, TOOLS.DUST, sc, { press: 0.5, p0: 0.05, p1: 0.05, wob: 0.6, step: 4, op: 0.3 * a }, 8300 + (s.L | 0));
    }
  }

  // ---------- fog: banks of rubbed chalk
  const FOG = [];
  { const mk = (y0, y1, n, w0, w1, wt, near) => { for (let i = 0; i < n; i++) { const id = FOG.length; FOG.push({ y: lerp(y0, y1, hash2(id, 1, 841)), x: hash2(id, 2, 841), L: 180 + 360 * hash2(id, 3, 841), w: lerp(w0, w1, hash2(id, 4, 841)), ph: hash2(id, 5, 841) * 6.283, k: adv(Wn + 900, 40 + 50 * hash2(id, 6, 841)), wt, near, bend: (hash2(id, 7, 841) - 0.5) * 14 }); } };
    mk(520, 566, 9, 22, 46, 1.0, 0); mk(560, 612, 10, 20, 40, 0.95, 0); mk(606, 668, 10, 24, 50, 0.8, 0); mk(660, 760, 8, 34, 70, 0.55, 0); mk(790, Y1 - 60, 7, 60, 120, 0.33, 1); }
  function drawFog(near) {
    const fg = Math.max(st.fog, st.haze * 0.35, st.rain * 0.28, st.snowf * 0.5); if (fg < 0.03) return;
    const fc = st.fogCol;
    for (const b of FOG) {
      if (!!b.near !== !!near) continue;
      const x = wrap(X0 - 450 + b.x * (Wn + 900) + C.Wint[st.f] * b.k + 9 * Math.sin(st.tau * 6.283185307 * 2 / 96 + b.ph), X0 - 450, Wn + 900);
      const a = fg * b.wt * (0.65 + 0.35 * Math.sin(st.tau * 6.283185307 * 6 / 96 + b.ph)); if (a < 0.03) continue;
      H.line([[x - b.L / 2, b.y], [x, b.y + b.bend], [x + b.L / 2, b.y - b.bend * 0.4]], b.w, TOOLS.DUST, fc, { press: 0.62, p0: 0.05, p1: 0.05, wob: 1.5, step: 6, op: 0.34 * a }, 8400 + (b.L | 0));
    }
  }

  // ---------- lightning: one hard scratch of the pin, forked
  function drawLightning() {
    const fl = st.flash; if (fl < 0.12) return;
    const x0 = st.flashX, sd = Math.round(x0);
    col[0] = 1; col[1] = 0.99; col[2] = 0.93;
    const clip = E.getClip(); E.setClip((1 << REG.SKY) | (1 << REG.FAR));
    const bolt = (x, y, y1, w, sdd, depth) => {
      let n = 0, k = 0; const seg = 20;
      while (y < y1 && n < 60) { PX[n] = x; PY[n] = y; PP[n] = 1; n++; x += (hash2(sdd, k, 851) - 0.5) * 34 + (hash2(sdd, 99, 851) - 0.5) * 9; y += seg * (0.5 + hash2(sdd, k, 852)); k++;
        if (depth < 2 && hash2(sdd, k, 853) < 0.16) { const m = n; const sx = x, sy = y; E.scratch(n, w, fl, col); n = 0; bolt(sx, sy, Math.min(y1, sy + 60 + 110 * hash2(sdd, k, 854)), w * 0.55, sdd * 7 + k, depth + 1); PX[0] = sx; PY[0] = sy; PP[0] = 1; n = 1; x = sx + (hash2(sdd, k, 855) - 0.5) * 20; y = sy + 12; } }
      PX[n] = x; PY[n] = Math.min(y, y1); PP[n] = 0.6; n++;
      if (n > 1) E.scratch(n, w, fl, col);
    };
    H.rubDot(x0, 430, 300, 0.10 * fl, col);
    bolt(x0 - 30, 150 + 60 * hash2(sd, 1, 856), HOR - 2, 1.5, sd, 0);
    E.setClip(clip);
  }

  // ---------- snow letting go of a branch in the thaw (or shaken off by the wind)
  const PLOPS = [];
  if (ctx.tree) {
    const tr = ctx.tree;
    tr.branches.forEach((br, bi) => {
      const thr = 0.08 + 0.5 * hash1(bi, 72), nd = tr.nodes[br.nodes[br.nodes.length >> 1]];
      if (nd.x > X1 + 10) return;
      for (let f = 1; f < F; f++) if (C.snowB[f - 1] >= thr && C.snowB[f] < thr && hash2(bi, f, 861) < (C.T[f] > 0.5 ? 0.7 : 0.12)) PLOPS.push({ f0: f, x: nd.x, y: nd.y, r: 2 + 3.5 * hash1(bi, 73), vy: 150 + 120 * hash1(bi, 74), yL: 690 + 60 * hash1(bi, 75) });
    });
  }
  function drawPlops() {
    if (!PLOPS.length) return; const f = st.f, s0 = ctx.tree.snowColour(), b0 = 0.4 + 0.6 * st.day, sc = c2; sc[0] = 0.5 * s0[0] + 0.48 * b0; sc[1] = 0.5 * s0[1] + 0.48 * b0; sc[2] = 0.5 * s0[2] + 0.5 * b0;
    for (const p of PLOPS) {
      const df = f - p.f0; if (df < 0 || df > 50) continue;
      const t = df / FPS, y = p.y + 30 * t + 0.5 * 520 * t * t;
      if (y < p.yL) { PX[0] = p.x; PY[0] = y - p.r * 2.2; PP[0] = 0.4; PX[1] = p.x + 0.6; PY[1] = y; PP[1] = 1; E.stroke(2, p.r * 1.6, TOOLS.CRAYON, sc, 0.95, p.f0); for (let k = 0; k < 4; k++) H.pinDot(p.x + (hash2(p.f0, k, 862) - 0.5) * 12, y - 8 - 26 * hash2(p.f0, k, 863) * Math.min(1, t * 3), 1.1, 0.8, sc); }
      else { const u = (y - p.yL) / 120; if (u < 1) H.rubDot(p.x, p.yL - 3 - 8 * u, p.r * (4 + 10 * u), 0.3 * (1 - u), sc); }
    }
  }

  function drawFar() { drawFog(false); drawLightning(); drawRain(false); drawSnow(false); }
  function drawNear() { drawPlops(); drawSpindrift(); drawFog(true); drawRain(true); drawSnow(true); }
  return { drawFar, drawNear };
}
module.exports = { create };
