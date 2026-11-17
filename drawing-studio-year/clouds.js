/* A YEAR, STILL WARM — clouds.
 *
 * A cloud is a heap of puffs, and a puff is a ball of short strokes that follow
 * its roundness, exactly as the great cumulus of the original was built. The
 * strokes belong to the puff: they ride with it on the wind, swell as it swells
 * and thin away stroke by stroke as it dries out. (The flat grey deck of an
 * overcast day is not here — that is the sky's own hatching changing colour.)
 *
 *   fair-weather cumulus  born wherever the day's script allows, live a few seconds
 *   the tower             the original's cumulus, puff for puff, built through the midsummer afternoon
 *   the storm's front     dark masses that arrive ahead of the rain
 *   bars                  long quiet lenses of stratus near the horizon at dusk
 *   cirrus                a few pale combed lines, very high
 */
'use strict';
const { c01, sstep, lerp, hash1, hz, KX, KY, XC, HOR, ND } = require('./clock.js');
const { PAPER, mix3 } = require('./look.js');
const { createHand } = require('./hand.js');

function create(ctx) {
  const { K, Wd, Lk, Pt, E } = ctx, Sc = Wd.Sc, st = Lk.st, C = K.C, F = K.F, FPS = K.FPS, REG = Wd.REG, DUR = K.DUR;
  const { hash2, fbm, PX, PY, PP, TOOLS } = E, H = createHand(E);
  const CRAYON = TOOLS.CRAYON, PENCIL = TOOLS.PENCIL, DUST = TOOLS.DUST;
  const SKYBIT = 1 << REG.SKY;
  const X0 = Wd.X0, X1 = Wd.X1, Y0 = Wd.Y0, Wn = X1 - X0;
  const frameAt = d => Math.round(K.tauAtD(d) * FPS) % F;

  // ---------- the strokes of one puff of radius 60; smaller puffs use fewer of them
  const RREF = 60, TPL = [];
  { let s = 0x1234567; const R = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const lay = (layer, tool, cell, w0, w1, l0, l1, aj, fixed) => {
      const n = Math.round(Math.PI * RREF * RREF / (cell * cell));
      for (let i = 0; i < n; i++) TPL.push({ layer, tool, rho: Math.sqrt(R()) * 0.985, th: R() * 6.283, w: w0 + (w1 - w0) * R(), len: l0 + (l1 - l0) * R(), aj: (R() - 0.5) * aj, fixed, pick: R(), p: 0.35 + 0.45 * (0.25 + 0.75 * R()), j0: R(), j1: R(), cut: R() });
    };
    lay(0, CRAYON, 6.6, 5, 8.5, 16, 50, 0.5, 0);
    lay(1, CRAYON, 5.0, 3, 5, 10, 34, 0.7, 0);
    lay(2, PENCIL, 3.1, 1.7, 2.5, 8, 28, 0.6, 0);
    lay(3, PENCIL, 3.1, 1.5, 2.2, 6, 22, 0.4, 1);
    TPL.sort((a, b) => a.layer - b.layer);
  }

  // ---------- the cast of the year
  const CLOUDS = [];
  function addPuff(cl, dx, dy, r, born, opt) { cl.puffs.push(Object.assign({ dx, dy, r, born, ry: 0.94, seed: (hash2(cl.puffs.length, cl.seed, 701) * 1e9) | 0, rot: hash2(cl.puffs.length, cl.seed, 702) * 6.283 }, opt || {})); }
  function finish(cl) {
    // lower puffs are drawn later and sit in front; each puff remembers who may cover it
    cl.puffs.sort((a, b) => (a.dy + a.r * 0.3) - (b.dy + b.r * 0.3));
    cl.puffs.forEach((p, i) => { p.over = []; for (let j = i + 1; j < cl.puffs.length; j++) { const q = cl.puffs[j]; if (Math.hypot(p.dx - q.dx, p.dy - q.dy) < p.r + q.r) p.over.push(j); } });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const p of cl.puffs) { x0 = Math.min(x0, p.dx - p.r); x1 = Math.max(x1, p.dx + p.r); y0 = Math.min(y0, p.dy - p.r); y1 = Math.max(y1, p.dy + p.r); }
    cl.bx = (x0 + x1) / 2; cl.by = (y0 + y1) / 2; cl.bw = (x1 - x0) / 2 + 1; cl.bh = (y1 - y0) / 2 + 1;
    CLOUDS.push(cl);
  }
  // a small fair-weather cumulus: a flat-bottomed row, a second storey, a cap
  function cumulus(seed, f0, life, x, y, S, speed, dark) {
    const h = k => hash2(seed, k, 711);
    const cl = { type: 'cum', seed, f0, nF: Math.round(life * FPS), x, y, speed, dark: dark || 0, puffs: [], sc: S };
    const nb = 3 + ((h(1) * 4) | 0), wdt = (20 + 9 * nb) * S;
    for (let i = 0; i < nb; i++) { const u = nb > 1 ? i / (nb - 1) : 0.5, r = (15 + 13 * Math.sin(Math.PI * (0.15 + 0.7 * u)) + 6 * h(10 + i)) * S; addPuff(cl, (u - 0.5) * 2 * wdt + (h(20 + i) - 0.5) * 8 * S, -r * 0.55, r, 0.05 + 0.25 * h(30 + i)); }
    const n2 = Math.max(1, nb - 2);
    for (let i = 0; i < n2; i++) { const u = (i + 0.5) / n2, r = (13 + 10 * h(40 + i)) * S; addPuff(cl, (u - 0.5) * 1.3 * wdt + (h(50 + i) - 0.5) * 10 * S, -(26 + 14 * h(60 + i)) * S - r * 0.3, r, 0.2 + 0.3 * h(70 + i)); }
    if (h(2) < 0.7) { const r = (10 + 8 * h(3)) * S; addPuff(cl, (h(4) - 0.5) * wdt * 0.8, -(48 + 16 * h(5)) * S, r, 0.4 + 0.25 * h(6)); }
    const base = cl.puffs.slice();
    for (const m of base) { const k = m.r > 22 * S ? 3 : 2; for (let i = 0; i < k; i++) { const a = -Math.PI * 1.05 + (0.05 + Math.PI * 1.05) * hash2(m.seed, i, 712), rad = m.r * (0.26 + 0.2 * hash2(m.seed, i, 713)); addPuff(cl, m.dx + Math.cos(a) * m.r * 0.82, m.dy + Math.sin(a) * m.r * 0.82, rad, m.born + 0.08 + 0.15 * hash2(m.seed, i, 714)); } }
    cl.baseY = 0;
    finish(cl);
  }
  // --- fair-weather cumulus, born where the script's `cum` channel lets them
  { let acc = 0, id = 0;
    for (let f = 0; f < F; f++) {
      acc += C.cum[f] * 4.2 / FPS;
      if (acc >= 1) {
        acc -= 1; id++;
        const h = k => hash2(id, k, 720), wsgn = C.windBase[f] >= 0 ? 1 : -1;
        const hi = Math.pow(h(1), 0.95);                                  // 0 = low on the horizon (far), 1 = high (near, larger, quicker)
        const y = lerp(505, Math.max(Y0 + 60, -260), hi), S = lerp(0.42, 1.55, hi) * (0.8 + 0.4 * h(2)), speed = lerp(26, 120, hi);
        const life = 3.6 + 4.4 * h(3);
        const enter = h(4) < 0.3 && Math.abs(C.windBase[f]) > 0.3;
        const x = enter ? (wsgn > 0 ? X0 - 80 * S - 30 : X1 + 80 * S + 30) : X0 + Wn * (0.02 + 0.96 * h(5)) - wsgn * 60;
        cumulus(1000 + id, f, life, x, y, S, speed, 0);
      }
    } }
  // --- the tower: the original's cumulus, built through the midsummer afternoon
  { const main = [[34, 540, 46], [96, 528, 56], [165, 520, 62], [243, 516, 70], [322, 522, 60], [392, 534, 46], [440, 543, 30], [128, 468, 58], [208, 452, 66], [290, 460, 60], [352, 486, 44],
      [168, 398, 54], [244, 382, 60], [306, 408, 48], [198, 332, 48], [262, 316, 52], [312, 348, 36], [228, 268, 42], [276, 258, 36], [200, 288, 32], [252, 232, 26]];
    const f0 = frameAt(K.at(3, 10.2)), f1 = frameAt(K.at(3, 28.2));          // it is gone, unseen, in the small hours
    const TS = 0.86, TX = 735, cl = { type: 'tower', seed: 5, f0, nF: (f1 - f0 + F) % F, x: 0, y: 0, speed: 16, dark: 0, puffs: [], slow: 1 };
    for (const m of main) {
      const born = 0.02 + 0.44 * c01((540 - m[1]) / 320) + 0.04 * hash2(m[0], m[1], 731);     // from the base up
      m[0] = TX + (m[0] - 236) * TS; m[1] = 556 + (m[1] - 556) * TS; m[2] *= TS;
      addPuff(cl, m[0], m[1], m[2], born, { main: 1 });
      const k = m[2] > 40 ? 4 : 2;
      for (let i = 0; i < k; i++) { const a = -Math.PI * 1.05 + (Math.PI * 1.05 + 0.05) * hash2(m[0] + i, m[1], 732), rad = m[2] * (0.26 + 0.2 * hash2(m[0] + i, m[1], 733)); addPuff(cl, m[0] + Math.cos(a) * m[2] * 0.82, m[1] + Math.sin(a) * m[2] * 0.82, rad, born + 0.03 + 0.05 * hash2(m[0] + i, m[1], 734)); }
    }
    cl.cx = TX; cl.cy = 556 - 156 * TS; cl.baseY = 556; cl.fadeOut = 0.26;
    finish(cl);
  }
  // --- the storm's front and the ragged scud under it
  { const f0 = frameAt(K.at(4, 11.6)), fEnd = frameAt(K.at(4, 19.3)), span = (fEnd - f0 + F) % F;
    // they rise where they stand, out over the sea and overhead, and darken as they come
    for (let i = 0; i < 9; i++) { const h = k => hash2(i, k, 741); cumulus(900 + i, (f0 + Math.round(span * 0.035 * i)) % F, (span * (0.62 + 0.3 * h(1))) / FPS, X0 - 120 + (Wn + 200) * ((i * 0.37 + 0.1 * h(2)) % 1), [470, 250, 520, 60, 380, -120, 500, 160, 330][i] + 40 * h(3), [1.7, 2.4, 1.5, 2.8, 2.0, 3.0, 1.6, 2.5, 2.1][i], 40 + 30 * h(5), 0.8); }
  }
  // --- long quiet bars of stratus near the horizon on clear evenings
  const BARS = [];
  for (let day = 0; day < ND; day++) {
    const fS = frameAt(K.at(day, 12 + sunsetHalf(day) - 0.2));
    if (C.ovc[fS] > 0.5) continue;
    const nb = 2 + ((hash2(day, 1, 751) * 3) | 0);
    for (let i = 0; i < nb; i++) { const h = k => hash2(day * 7 + i, k, 752); const f0 = (fS - Math.round((3 + 4 * h(1)) * FPS) + F) % F; BARS.push({ seed: day * 7 + i, f0, nF: Math.round((8 + 5 * h(2)) * FPS), x: X0 + Wn * (0.02 + 0.9 * h(3)), y: 462 + 74 * h(4), rx: 70 + 60 * h(5), ry: 3.4 + 2 * h(6), speed: 12 + 14 * h(7) }); }
  }
  function sunsetHalf(day) { const so = K.sunAt(day + 0.45, {}); return so.dayLen / 2; }
  for (const b of BARS) { b.s = []; const n = Math.round(b.rx * 1.1); for (let i = 0; i < n; i++) b.s.push({ u: hash2(b.seed, i, 753) * 2 - 1, v: hash2(b.seed, i, 754) * 2 - 1, L: 0.15 + 0.4 * hash2(b.seed, i, 755), j: hash2(b.seed, i, 756), tool: i % 3 ? PENCIL : CRAYON }); }
  // --- cirrus: high combed lines
  const CIRRI = [];
  { let acc = 0, id = 0;
    for (let f = 0; f < F; f++) { acc += C.cir[f] * 0.16 / FPS; if (acc >= 1) { acc -= 1; id++; const h = k => hash2(id, k, 761); const lines = [], n = 7 + ((h(1) * 9) | 0), ang = -0.18 - 0.3 * h(2);
      for (let i = 0; i < n; i++) lines.push({ ox: (hash2(id, i, 762) - 0.5) * 230, oy: (hash2(id, i, 763) - 0.5) * 90, L: 70 + 190 * hash2(id, i, 764), bend: (hash2(id, i, 765) - 0.3) * 44, w: 1.2 + 2.2 * hash2(id, i, 766), j: hash2(id, i, 767) });
      CIRRI.push({ id, f0: f, nF: Math.round((18 + 12 * h(3)) * FPS), x: X0 + Wn * (-0.1 + 1.1 * h(4)), y: lerp(Y0 + 40, 300, h(5) * h(5)), ang, lines, speed: 10 + 12 * h(6) }); } } }

  // ---------- colour of a cloud's lit and shadowed wax at this hour
  const sk = [0, 0, 0], col = [0, 0, 0], cLit = [0, 0, 0], cSh = [0, 0, 0], cRim = [0, 0, 0], t3 = [0, 0, 0];
  function cloudLight() {
    const alt = st.alt, day = st.day, A = st.Av;
    // high clouds keep the sun after the ground has lost it, and it reddens as it goes
    const k = sstep(-8.5, 1.5, alt) * (1 - 0.85 * st.ovc), fire = st.fire, cold = st.cold;
    const low = [lerp(1.0, 1.0, fire), lerp(0.50, 0.40, fire), lerp(0.56, 0.42, fire)], mid = [1.0, lerp(0.74, 0.66, fire), lerp(0.52, 0.40, fire)], hi = [1.0, 0.99, 0.95];
    if (cold > 0) { mix3(low, [0.98, 0.62, 0.66], cold * 0.6, low); mix3(mid, [1.0, 0.86, 0.68], cold * 0.6, mid); }
    mix3(low, mid, sstep(-5, 2.5, alt), cLit); mix3(cLit, hi, sstep(3, 20, alt), cLit);
    const I = k * (0.94 + 0.10 * sstep(3, 20, alt));
    cLit[0] *= I; cLit[1] *= I; cLit[2] *= I;
    // the shadow side takes the sky's colour, lifted towards white by day
    const lift = 0.30 * day + 0.03, zen = st.zenith, an = Math.max(0.05, 0.3 * zen[0] + 0.5 * zen[1] + 0.2 * zen[2]);
    const tw = Math.exp(-Math.pow((alt + 3) / 6, 2)) * (st.pm ? 1 : 0.5) * (1 - st.ovc);
    for (let c = 0; c < 3; c++) cSh[c] = lerp(A[c] * 1.15 + lift, (0.25 + 0.45 * day) * (0.8 + 0.2 * zen[c] / an), 0.45);
    // at dusk the shadows of the original were periwinkle and jacaranda
    mix3(cSh, [0.36, 0.36, 0.70], tw * 0.75, cSh);
    if (st.moonI > 0.02) { cLit[0] += 0.30 * st.moonI; cLit[1] += 0.34 * st.moonI; cLit[2] += 0.44 * st.moonI; }
    if (st.flashK > 0) { cLit[0] += st.flashK * 0.7; cLit[1] += st.flashK * 0.72; cLit[2] += st.flashK * 0.8; }
  }

  function wrapDf(f, f0) { let d = f - f0; if (d < 0) d += F; return d; }
  function cloudX(cl, f) { const dW = C.Wint[f] - C.Wint[cl.f0] + (f < cl.f0 ? C.Wint[F] : 0); return cl.x + cl.speed * dW * (cl.slow ? 0.35 : 1) + (cl.slow ? 0 : 13 * (wrapDf(f, cl.f0) / FPS) * (C.windBase[cl.f0] >= 0 ? 1 : -1) * (cl.speed / 80)); }

  function drawCloud(cl) {
    const f = st.f, df = wrapDf(f, cl.f0); if (df >= cl.nF) return;
    const u = df / cl.nF, cx0 = cloudX(cl, f), cy0 = cl.y;
    if (cx0 + cl.bx + cl.bw < X0 - 4 || cx0 + cl.bx - cl.bw > X1 + 4) return;
    const fo = cl.fadeOut || 0.3, dying = sstep(1 - fo, 1, u);
    const isCum = cl.type === 'cum', gAll = 0.6 + 0.4 * sstep(0, 0.4, u);     // a small cloud does not pop up as dots: it gathers, thin at first
    const np = cl.puffs.length, rad = cl._r || (cl._r = new Float32Array(np)), px = cl._x || (cl._x = new Float32Array(np)), py = cl._y || (cl._y = new Float32Array(np));
    // each puff swells in its turn, breathes, and at the end dries away
    const t = st.tau;
    for (let i = 0; i < np; i++) {
      const p = cl.puffs[i], g = isCum ? gAll * (0.75 + 0.25 * sstep(p.born * 0.6, p.born * 0.6 + 0.2, u)) : sstep(p.born, p.born + 0.2, u);
      const br = 1 + 0.035 * Math.sin(6.283185307 * hz(((p.seed & 3) + 1) / 16) * t + p.seed);
      rad[i] = p.r * g * br * (1 - 0.12 * dying);                  // a cloud does not shrink into beads as it goes: its hatching thins
      const rise = isCum ? 0 : (1 - g) * p.r * 0.7, sq = isCum ? 0.45 + 0.55 * gAll : 1;      // a small cloud swells as one thing, out of its own base
      px[i] = cx0 + p.dx * sq + 1.5 * Math.sin(6.283185307 * hz(((p.seed >> 2 & 3) + 1) / 16) * t + p.seed * 0.7); py[i] = cy0 + p.dy * (isCum ? gAll : 1) + rise;
    }
    // light
    const bcx = cx0 + (cl.cx !== undefined ? cl.cx : cl.bx), bcy = cy0 + (cl.cy !== undefined ? cl.cy : cl.by);
    let vx = st.sx + 40 - bcx, vy = st.sy + (st.alt < 2 ? 90 : 0) - bcy; const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
    const front = Math.max(0, st.lz) * sstep(-2, 6, st.alt);          // morning: the sun is behind us and the clouds are lit full in the face
    const dense = Math.min(1 - 0.97 * dying, isCum ? 0.12 + 0.88 * sstep(0, 0.28, u) : 1), darkK = cl.dark * (0.55 + 0.45 * st.storm);
    const drift = C.Wint[f] * Pt.ADV.deck.k;
    if (cl.type === 'cum') E.setFence(cy0 - 4);
    // the pale rim where the hand stopped short (the bare paper round every cloud of the original)
    for (let i = 0; i < np; i++) { if (rad[i] < 3) continue; const hz0 = c01(sstep(462, 556, py[i] + rad[i] * 0.3) * 0.9 + st.veil * 0.7); PX[0] = px[i]; PY[0] = py[i]; PP[0] = 1; E.erase(1, rad[i] * 2.12, 0.34 * dense * dense * dense * (1 - hz0) * (1 - 0.8 * darkK), null); }
    if (cl.type === 'cum') E.setFence(cy0 - 1.5);
    for (let i = 0; i < np; i++) {
      const r = rad[i]; if (r < 3) continue;
      const p = cl.puffs[i], x0 = px[i], y0 = py[i], frac = Math.min(1, (r / RREF) * (r / RREF)) * 1.0;
      if (x0 + r < X0 || x0 - r > X1 || y0 - r > HOR + 4) continue;
      const bx = (x0 - bcx) / (cl.bw * 0.95), by = (y0 - bcy) / (cl.bh * 0.95), bl = bx * vx + by * vy;
      const over = p.over, no = over.length, cr = Math.cos(p.rot), sr = Math.sin(p.rot);
      const oc = Pt.ovcLocal(x0, y0, drift), hzy = c01(sstep(462, 556, y0 + r * 0.3) * 0.72 + st.veil * 0.6 + oc * 0.5);
      Lk.skyAt(x0, Math.min(HOR - 2, y0 + r * 0.5), sk, oc);
      const kth = (p.seed >>> 3) % 97;
      for (let k = 0; k < TPL.length; k++) {
        const s = TPL[k];
        if (s.pick > frac) continue;
        if (s.cut > dense + 0.25 * (s.layer < 2 ? 1 : 0)) continue;
        // where on the ball
        const ct = Math.cos(s.th), sn = Math.sin(s.th), ux = (ct * cr - sn * sr) * s.rho, uy = (ct * sr + sn * cr) * s.rho;
        const sx = x0 + ux * r, sy = y0 + uy * r * p.ry;
        let hid = false;
        for (let j = 0; j < no; j++) { const o = over[j], rr2 = rad[o] * 0.9, ddx = sx - px[o], ddy = sy - py[o]; if (ddx * ddx + ddy * ddy < rr2 * rr2) { hid = true; break; } }
        if (hid) continue;
        // the stroke bends round the ball (or, for the last pass, keeps the sky's slant)
        const rho = Math.max(0.12, s.rho), circ = rho * r;
        const len = Math.min(s.len, circ * 2.2 + 4);
        let n;
        if (s.fixed) {
          const a = -0.55 + s.aj, hx = Math.cos(a) * len * 0.5, hy = Math.sin(a) * len * 0.5;
          let ax = sx - hx, ay = sy - hy, bx2 = sx + hx, by2 = sy + hy;
          // keep it inside the ball
          const cl2 = (qx, qy) => { const ex = (qx - x0) / r, ey = (qy - y0) / (r * p.ry), e = Math.hypot(ex, ey); return e > 0.97 ? 0.97 / e : 1; };
          const ka = cl2(ax, ay), kb = cl2(bx2, by2); ax = x0 + (ax - x0) * ka; ay = y0 + (ay - y0) * ka; bx2 = x0 + (bx2 - x0) * kb; by2 = y0 + (by2 - y0) * kb;
          PX[0] = ax; PY[0] = ay; PP[0] = s.p * 0.6; PX[1] = sx; PY[1] = sy; PP[1] = s.p; PX[2] = bx2; PY[2] = by2; PP[2] = s.p * 0.4; n = 3;
        } else {
          // a short stroke laid roughly along the roundness, never a ring: its own slant, its own slight bow
          const ta = Math.atan2(uy, ux) + 1.5708 + s.aj * 1.5, hl = Math.min(len, r * 0.9 + 4) * 0.5, hx = Math.cos(ta) * hl, hy = Math.sin(ta) * hl * p.ry;
          const bow = (s.j1 - 0.5) * hl * 0.45, bxv = -Math.sin(ta) * bow, byv = Math.cos(ta) * bow;
          const inb = (qx, qy) => { const ex = (qx - x0) / r, ey = (qy - y0) / (r * p.ry), e = Math.hypot(ex, ey); return e > 0.97 ? 0.97 / e : 1; };
          let ax = sx - hx, ay = sy - hy, bx2 = sx + hx, by2 = sy + hy, mx = sx + bxv, my = sy + byv;
          const ka = inb(ax, ay), kb = inb(bx2, by2), km = inb(mx, my);
          ax = x0 + (ax - x0) * ka; ay = y0 + (ay - y0) * ka; bx2 = x0 + (bx2 - x0) * kb; by2 = y0 + (by2 - y0) * kb; mx = x0 + (mx - x0) * km; my = y0 + (my - y0) * km;
          const m = 4;
          for (let q = 0; q <= m; q++) { const t = q / m, u2 = 1 - t; PX[q] = u2 * u2 * ax + 2 * u2 * t * mx + t * t * bx2; PY[q] = u2 * u2 * ay + 2 * u2 * t * my + t * t * by2; PP[q] = s.p * Math.min(1, t / 0.12 + 0.5) * Math.min(1, (1 - t) / 0.28 + 0.22); }
          n = m + 1;
        }
        // light on the ball: which way this spot faces, and where the puff sits in the heap
        const nz = Math.sqrt(Math.max(0, 1 - s.rho * s.rho));
        let lit = 0.36 + (0.40 * (ux * vx + uy * vy) + 0.30 * bl) * (1 - 0.7 * front) + 0.10 * nz + front * (0.22 + 0.30 * nz - 0.22 * uy) + 0.16 * (s.j0 - 0.5) * 1.6;
        if (isCum) lit -= 0.42 * sstep(cy0 - 26 * cl.sc - 6, cy0, sy);               // the flat grey underside
        lit = c01(lit * 1.25 - 0.08);
        const li = lit * lit * (3 - 2 * lit);
        let r_ = cSh[0] + (cLit[0] * 0.92 + 0.10 - cSh[0]) * li, g_ = cSh[1] + (cLit[1] * 0.92 + 0.10 - cSh[1]) * li, b_ = cSh[2] + (cLit[2] * 0.92 + 0.10 - cSh[2]) * li;
        if (darkK > 0) { const dk = 1 - darkK * (0.72 - 0.4 * li); r_ *= dk; g_ *= dk; b_ *= dk * 1.06; }
        r_ += (sk[0] - r_) * hzy; g_ += (sk[1] - g_) * hzy; b_ += (sk[2] - b_) * hzy;
        const jl = (s.j1 - 0.5) * 0.09, jh = (s.j0 - 0.5) * 0.06;
        Lk.crayon(r_ + jl + jh, g_ + jl, b_ + jl - jh, col, 0);
        E.stroke(n, s.w, s.tool, col, 1, k * 131 + kth);
      }
      // the pencil line round the top of the ball
      if (r > 9 && dense > 0.8 && (p.seed & 3) !== 0) {
        const a0 = -2.7 + 1.0 * hash1(p.seed, 5), a1 = a0 + 1.3 + 1.2 * hash1(p.seed, 6), m = 9; let n = 0, okc = 0;
        for (let q = 0; q <= m; q++) { const a = a0 + (a1 - a0) * q / m, xx = x0 + Math.cos(a) * r * 0.985, yy = y0 + Math.sin(a) * r * 0.985 * p.ry; let hid = false; for (let j = 0; j < no; j++) { const o = over[j]; if (Math.hypot(xx - px[o], yy - py[o]) < rad[o] * 0.98) { hid = true; break; } } if (hid) { if (n > 2) break; n = 0; continue; } PX[n] = xx; PY[n] = yy; PP[n] = 0.5 * Math.min(1, n / 2 + 0.4); n++; }
        if (n > 2) {
          PP[n - 1] *= 0.3;
          const lum = 0.5 * (cSh[0] + cLit[0]) * 0.5 + 0.3 * (cSh[1] + cLit[1]) * 0.5;
          t3[0] = cSh[0] * 0.72 + 0.10 * st.day; t3[1] = cSh[1] * 0.62; t3[2] = cSh[2] * 0.80;
          if (st.alt < 8 && st.alt > -9) mix3(t3, [0.75, 0.36, 0.38], 0.5 * (1 - st.ovc), t3);
          t3[0] += (sk[0] - t3[0]) * hzy; t3[1] += (sk[1] - t3[1]) * hzy; t3[2] += (sk[2] - t3[2]) * hzy;
          E.stroke(n, 1.15, PENCIL, t3, 0.6 * dense, p.seed);
        }
      }
    }
    if (cl.type === 'cum') {
      // the flat underside: one soft dark stroke of the pencil along the base
      E.setFence(null);
      const bw = cl.bw * 0.9 * (1 - 0.5 * dying), g0 = sstep(0.05, 0.35, u); if (bw > 6 && g0 > 0.1) { t3[0] = cSh[0] * 0.8; t3[1] = cSh[1] * 0.78; t3[2] = cSh[2] * 0.9; const hz2 = c01(sstep(462, 556, cy0) * 0.72 + st.veil * 0.6); Lk.skyAt(cx0 + cl.bx, cy0, sk, st.ovc); mix3(t3, sk, hz2, t3);
        H.line([[cx0 + cl.bx - bw, cy0 - 1], [cx0 + cl.bx - bw * 0.3, cy0 - 0.2], [cx0 + cl.bx + bw * 0.4, cy0 - 1.2], [cx0 + cl.bx + bw, cy0 - 0.6]], 1.3, PENCIL, t3, { press: 0.5 * g0 * dense, p0: 0.1, p1: 0.1, wob: 0.5 }, cl.seed); }
    }
  }

  function drawBars() {
    const f = st.f;
    for (const b of BARS) {
      const df = wrapDf(f, b.f0); if (df >= b.nF) continue;
      const u = df / b.nF, a = sstep(0, 0.25, u) * (1 - sstep(0.7, 1, u)); if (a < 0.03) continue;
      const dW = C.Wint[f] - C.Wint[b.f0] + (f < b.f0 ? C.Wint[F] : 0), cx = b.x + b.speed * dW + 3 * df / FPS;
      if (cx + b.rx < X0 || cx - b.rx > X1) continue;
      const dxg = (cx - st.sx) / 300, gl = Math.exp(-dxg * dxg);
      Lk.skyAt(cx, b.y, sk, st.ovc);
      for (let i = 0; i < b.s.length; i++) {
        const s = b.s[i]; if (s.u * s.u + s.v * s.v > 1) continue; if (s.j > a * 1.2) continue;
        const x = cx + s.u * b.rx, y = b.y + s.v * b.ry, L = b.rx * s.L * Math.sqrt(1 - s.v * s.v);
        const lit = c01(0.36 + s.v * 0.5 + 0.25 * gl + (s.j - 0.5) * 0.2), li = lit * lit * (3 - 2 * lit);
        let r_ = cSh[0] + (cLit[0] - cSh[0]) * li, g_ = cSh[1] + (cLit[1] - cSh[1]) * li, b_ = cSh[2] + (cLit[2] - cSh[2]) * li;
        r_ += (sk[0] - r_) * 0.3; g_ += (sk[1] - g_) * 0.3; b_ += (sk[2] - b_) * 0.3;
        Lk.crayon(r_, g_, b_, col, 0);
        PX[0] = x - L; PY[0] = y; PP[0] = 0.3; PX[1] = x; PY[1] = y + (s.j - 0.5); PP[1] = 0.8; PX[2] = x + L; PY[2] = y; PP[2] = 0.25;
        E.stroke(3, s.tool === CRAYON ? 2.6 : 1.7, s.tool, col, a, b.seed * 400 + i);
      }
    }
  }
  function drawCirrus() {
    const f = st.f;
    for (const c of CIRRI) {
      const df = wrapDf(f, c.f0); if (df >= c.nF) continue;
      const u = df / c.nF, a = sstep(0, 0.3, u) * (1 - sstep(0.65, 1, u)) * (1 - st.ovc); if (a < 0.03) continue;
      const dW = C.Wint[f] - C.Wint[c.f0] + (f < c.f0 ? C.Wint[F] : 0), cx = c.x + c.speed * dW + 2.5 * df / FPS;
      if (cx < X0 - 300 || cx > X1 + 300) continue;
      const ca = Math.cos(c.ang), sa = Math.sin(c.ang);
      Lk.skyAt(cx, c.y, sk, st.ovc);
      // thin ice: mostly the lit colour, never heavy
      mix3(cSh, cLit, 0.75, t3); mix3(sk, t3, 0.62, t3);
      for (let i = 0; i < c.lines.length; i++) {
        const l = c.lines[i], x = cx + l.ox, y = c.y + l.oy, hl = l.L * 0.5;
        const jl = (l.j - 0.5) * 0.06; col[0] = t3[0] + jl; col[1] = t3[1] + jl; col[2] = t3[2] + jl;
        H.line([[x - ca * hl, y - sa * hl], [x - ca * hl * 0.3 + sa * l.bend * 0.3, y - sa * hl * 0.3 - ca * l.bend * 0.3], [x + ca * hl * 0.4, y + sa * hl * 0.4 - l.bend * 0.5], [x + ca * hl, y + sa * hl - l.bend]], l.w, i % 3 === 0 ? CRAYON : PENCIL, col, { press: 0.42 * a, p0: 0.1, p1: 0.05, wob: 0.5, step: 3 }, c.id * 50 + i);
      }
    }
  }

  function draw() {
    const clip = E.getClip(); E.setClip(SKYBIT);
    cloudLight();
    drawCirrus();
    // far (low) clouds first
    for (const cl of ORDER) drawCloud(cl);
    drawBars();
    E.setClip(clip);
  }
  const ORDER = CLOUDS.slice().sort((a, b) => (a.type === 'tower' ? -1e6 : -a.y) - (b.type === 'tower' ? -1e6 : -b.y));
  return { draw, CLOUDS, BARS, CIRRI, cloudLight, cLit, cSh };
}
module.exports = { create };
