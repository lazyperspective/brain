// sky.js -- what the eye wants from the sky after the sun has gone, and how the hand lays it down.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp;
  const S = A.S, PAS = S.PAS, c = S.c, HY = S.HY, GLX = S.GLX, gs = S.gs, grad = S.grad;
  const SUNX = GLX;

  // the afterglow: indigo, cobalt, a band of sea-green, straw, peach, rose, and magenta along the roofs
  const SKY = [[0, '#141247'], [55, '#181b60'], [120, '#1d3488'], [185, '#23609c'], [238, '#3597a4'], [278, '#7cc0a8'], [308, '#e4d69c'], [338, '#ffba86'], [366, '#f98d8c'], [388, '#e2649a'], [402, '#c4549a']].map(s => [s[0], hx(s[1])]);
  const cGlow1 = hx('#fff2b8'), cGlow2 = hx('#ffc47a'), cDeep = hx('#131044'), cFar = hx('#7a5aa8'), cFar2 = hx('#4a4a9c');
  function skyCol(x, y) {
    const dx = Math.abs(x - GLX);
    // away from the glow the bands sink toward the roofs and the night comes down sooner
    const yy = y - 78 * ss(0, 1050, dx) + 9 * (A.vn(x / 260, y / 90, 5) - 0.5);
    let col = grad(SKY, yy);
    col = mix3(col, cFar, ss(260, 900, dx) * ss(250, 345, yy) * 0.62);
    col = mix3(col, cFar2, ss(500, 1100, dx) * ss(200, 330, yy) * 0.35);
    const d = Math.hypot((x - GLX) * 0.62, (y - HY - 8) * 1.3);
    col = mix3(col, cGlow2, 0.45 * Math.exp(-d / 120));
    col = mix3(col, cGlow1, 0.85 * Math.exp(-d / 42));
    col = mix3(col, cDeep, ss(900, 1650, x) * ss(330, 40, y) * 0.35);
    return col;
  }
  S.skyCol = skyCol;

  const GW = 1600, GH = 900;
  let CL = null;
  function buildCloud() {
    const rng = A.rng(90210);
    const N = GW * GH;
    const zb = new Float32Array(N).fill(-1e9), nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N);
    const mzb = new Float32Array(N).fill(-1e9), mx = new Float32Array(N), my = new Float32Array(N);
    const sph = [];
    function grow(x, y, z, r, lvl) {
      sph.push(x, y, z, r, lvl);
      if (lvl >= 3 || r < 6) return;
      const n = lvl === 0 ? rng.i(17, 23) : lvl === 1 ? rng.i(8, 11) : rng.i(4, 6);
      for (let k = 0; k < n; k++) {
        let th = rng.r(-Math.PI, Math.PI);
        if (rng() > 0.3 + 0.7 * (0.5 - 0.5 * Math.sin(th))) th = rng.r(-Math.PI, 0);
        const ph = lvl === 0 ? Math.acos(rng.r(0.04, 0.97)) : rng.r(0.35, 1.5);
        const d = r * rng.r(0.72, 0.97), cr = r * rng.r(0.2, 0.42);
        grow(x + Math.sin(ph) * Math.cos(th) * d, y + Math.sin(ph) * Math.sin(th) * d * 0.9, z + Math.cos(ph) * d, cr, lvl + 1);
      }
    }
    // the big masses, placed by eye: [x, y, r, z]
    const majors = [
      // the far base, sunk in the haze along the roofs
      [196, 393, 34, -40], [268, 387, 48, -20], [350, 381, 62, 0], [440, 375, 76, 10], [536, 381, 66, 0], [622, 389, 48, -10], [692, 395, 32, -30],
      // the main column, leaning a little with the high wind
      [420, 318, 90, 40], [410, 238, 84, 60], [386, 162, 74, 70], [398, 100, 58, 80], [372, 64, 36, 85],
      // left shoulder
      [312, 312, 58, 30], [285, 264, 42, 40], [318, 206, 40, 55], [330, 130, 34, 60],
      // right shoulder, the side that faces the glow
      [520, 314, 56, 30], [542, 264, 40, 40], [492, 206, 44, 55], [462, 140, 36, 62], [586, 342, 36, 20],
    ];
    for (const m of majors) grow(m[0], m[1], m[3], m[2], 0);
    // small evening cumulus drifting over the sea to the left
    const flatBase = [];
    for (let i = 0; i < sph.length; i += 5) {
      const sx = sph[i], sy = sph[i + 1], sz = sph[i + 2], r = sph[i + 3], lvl = sph[i + 4];
      const fy = 1;
      const x0 = Math.max(0, Math.floor(sx - r)), x1 = Math.min(GW - 1, Math.ceil(sx + r)), y0 = Math.max(0, Math.floor(sy - r * fy)), y1 = Math.min(GH - 1, Math.ceil(sy + r * fy));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x - sx, dy = (y - sy) / fy, d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        const h = Math.sqrt(r * r - d2), zz = sz + h, i2 = y * GW + x;
        if (zz > zb[i2]) { zb[i2] = zz; nx[i2] = dx / r; ny[i2] = dy / r; nz[i2] = h / r; }
        if (lvl <= 0 && zz > mzb[i2]) { mzb[i2] = zz; mx[i2] = dx / r; my[i2] = dy / r; }
      }
    }
    for (const rw of flatBase) for (let y = rw[2] + 1; y < Math.min(GH, rw[2] + 40); y++) for (let x = Math.max(0, rw[0] - 40); x < Math.min(GW, rw[1] + 40); x++) zb[y * GW + x] = -1e9;
    // warp so nothing is a perfect circle
    const wz = new Float32Array(N), wnx = new Float32Array(N), wny = new Float32Array(N), wnz = new Float32Array(N), wmx = new Float32Array(N), wmy = new Float32Array(N);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const wk = 1;
      const ax = ((A.fbm(x / 80, y / 80, 2, 71) - 0.5) * 30 + (A.vn(x / 17, y / 17, 73) - 0.5) * 6) * wk;
      const ay = ((A.fbm(x / 80 + 40, y / 80, 2, 79) - 0.5) * 24 + (A.vn(x / 17, y / 17, 83) - 0.5) * 6) * wk * wk;
      const sx = clamp(Math.round(x + ax), 0, GW - 1), sy = clamp(Math.round(y + ay), 0, GH - 1), s = sy * GW + sx, i2 = y * GW + x;
      wz[i2] = zb[s]; wnx[i2] = nx[s]; wny[i2] = ny[s]; wnz[i2] = nz[s]; wmx[i2] = mx[s]; wmy[i2] = my[s];
    }
    // crevices: where the surface sits below its blurred self
    const bl = new Float32Array(N), tmp = new Float32Array(N), R = 9;
    for (let y = 0; y < GH; y++) { let s = 0, cnt = 0; for (let x = -R; x < GW + R; x++) { const xa = x + R, xr = x - R - 1; if (xa < GW) { const v = wz[y * GW + xa]; if (v > -1e8) { s += v; cnt++; } } if (xr >= 0) { const v = wz[y * GW + xr]; if (v > -1e8) { s -= v; cnt--; } } if (x >= 0 && x < GW) tmp[y * GW + x] = cnt ? s / cnt : -1e9; } }
    for (let x = 0; x < GW; x++) { let s = 0, cnt = 0; for (let y = -R; y < GH + R; y++) { const ya = y + R, yr = y - R - 1; if (ya < GH) { const v = tmp[ya * GW + x]; if (v > -1e8) { s += v; cnt++; } } if (yr >= 0) { const v = tmp[yr * GW + x]; if (v > -1e8) { s -= v; cnt--; } } if (y >= 0 && y < GH) bl[y * GW + x] = cnt ? s / cnt : -1e9; } }
    // the big form: a heavily blurred copy of the height field says which flank of the whole tower faces the sun
    const big = new Float32Array(N), t2 = new Float32Array(N);
    { let lo = 1e9; for (let i = 0; i < N; i++) if (wz[i] > -1e8 && wz[i] < lo) lo = wz[i];
      for (let i = 0; i < N; i++) big[i] = wz[i] > -1e8 ? wz[i] : lo - 70;
      const RB = 24;
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < GH; y++) { let sum = 0; for (let x = -RB; x <= RB; x++) sum += big[y * GW + clamp(x, 0, GW - 1)]; for (let x = 0; x < GW; x++) { t2[y * GW + x] = sum / (2 * RB + 1); sum += big[y * GW + clamp(x + RB + 1, 0, GW - 1)] - big[y * GW + clamp(x - RB, 0, GW - 1)]; } }
        for (let x = 0; x < GW; x++) { let sum = 0; for (let y = -RB; y <= RB; y++) sum += t2[clamp(y, 0, GH - 1) * GW + x]; for (let y = 0; y < GH; y++) { big[y * GW + x] = sum / (2 * RB + 1); sum += t2[clamp(y + RB + 1, 0, GH - 1) * GW + x] - t2[clamp(y - RB, 0, GH - 1) * GW + x]; } }
      } }
    // light
    const L = [0, 0, 0.12];
    const col = new Float32Array(N * 3), band = new Uint8Array(N), ang = new Float32Array(N);
    const litTop = hx('#ffe9d0'), litMid = hx('#ffd0a2'), litLow = hx('#ffb07c');
    const ltTop = hx('#ffb8b0'), ltMid = hx('#ff9a94'), ltLow = hx('#f27488');
    const mdTop = hx('#b48cd0'), mdMid = hx('#b070ac'), mdLow = hx('#a8508e');
    const shTopC = hx('#6474c4'), shMidC = hx('#5a60b0'), shLowC = hx('#5a4690');
    const shTopW = hx('#7c70c0'), shMidW = hx('#80589e'), shLowW = hx('#7c3f7e');
    const dpTop = hx('#36459a'), dpMid = hx('#3a3888'), dpLow = hx('#40296a');
    const glow = hx('#ffe6cc');
    const g3 = (a, b, cc, y) => (y < 210 ? mix3(a, b, y / 210) : mix3(b, cc, clamp((y - 210) / 180, 0, 1)));
    const T = new Float32Array(N), FC = new Float32Array(N);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i2 = y * GW + x;
      if (wz[i2] < -1e8) { band[i2] = 0; T[i2] = -9; continue; }
      { const lx = SUNX + 40 - x, ly = HY + 90 - y, ll = Math.hypot(lx, ly) / 0.993; L[0] = lx / ll; L[1] = ly / ll; }
      const lam = wnx[i2] * L[0] + wny[i2] * L[1] + wnz[i2] * L[2];
      const xa = clamp(x - 5, 0, GW - 1), xb = clamp(x + 5, 0, GW - 1), ya = clamp(y - 5, 0, GH - 1), yb = clamp(y + 5, 0, GH - 1);
      const facing = -((big[y * GW + xb] - big[y * GW + xa]) * L[0] + (big[yb * GW + x] - big[ya * GW + x]) * L[1]) / 10;
      const mac = ss(-0.05, 0.6, facing * 0.9 + (wmx[i2] * L[0] + wmy[i2] * L[1]) * 0.3 + (A.vn(x / 70, y / 70, 87) - 0.5) * 0.35);
      let t = lam * (0.3 + 0.7 * mac) + (mac - 0.5) * 0.5;
      // cast shadow: march toward the light across the height field
      let shd = 0;
      { let px = x, py = y, pz = wz[i2] + 1.5; for (let k = 0; k < 9; k++) { px += L[0] * 3.2; py += L[1] * 3.2; pz += L[2] * 3.2; const qx = px | 0, qy = py | 0; if (qx < 0 || qy < 0 || qx >= GW || qy >= GH) break; const q = wz[qy * GW + qx]; if (q > pz + 7) { shd = 1; break; } } }
      const wob = (A.vn(x / 26, y / 26, 91) - 0.5) * 0.10 + (A.vn(x / 7, y / 7, 93) - 0.5) * 0.04;
      t += wob; t += 0.4 * ss(215, 70, y) * ss(-0.45, 0.6, wnx[i2] * 0.8 - wny[i2] * 0.3); // the crown is still high enough to see the sun if (shd) t = Math.min(t, 0.05) - 0.06;
      T[i2] = t; FC[i2] = facing;
    }
    // let the light bleed a little, so every bright core sits in a halo of peach and rose
    for (let pass = 0; pass < 2; pass++) {
      const RT = 4;
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i2 = y * GW + x; if (T[i2] < -8) { t2[i2] = -9; continue; } let sum = 0, cnt = 0; for (let k = -RT; k <= RT; k++) { const xx = x + k; if (xx < 0 || xx >= GW) continue; const v = T[y * GW + xx]; if (v > -8) { sum += v; cnt++; } } t2[i2] = sum / cnt; }
      for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) { const i2 = y * GW + x; if (t2[i2] < -8) continue; let sum = 0, cnt = 0; for (let k = -RT; k <= RT; k++) { const yy = y + k; if (yy < 0 || yy >= GH) continue; const v = t2[yy * GW + x]; if (v > -8) { sum += v; cnt++; } } T[i2] = sum / cnt; }
    }
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i2 = y * GW + x;
      if (wz[i2] < -1e8) continue;
      const t = T[i2] * 1.12 + 0.02, facing = FC[i2];
      const ao = clamp((bl[i2] - wz[i2]) / 10, 0, 1);
      let b, cc;
      const warm = ss(-0.35, 0.55, wny[i2]);
      if (t > 0.6) { b = 5; cc = g3(litTop, litMid, litLow, y); }
      else if (t > 0.24) { b = 4; cc = g3(ltTop, ltMid, ltLow, y); }
      else if (t > -0.07) { b = 3; cc = g3(mdTop, mdMid, mdLow, y); }
      else if (ao > 0.55 || t < -0.62) { b = 1; cc = g3(dpTop, dpMid, dpLow, y); }
      else { b = 2; cc = mix3(mix3(g3(shTopC, shMidC, shLowC, y), g3(shTopW, shMidW, shLowW, y), warm), g3(dpTop, dpMid, dpLow, y), 0.5 * ss(0.15, -0.45, facing) * (0.6 + 0.8 * A.vn(x / 90, y / 90, 61))); }
      // a storm that has just passed still flickers inside
      const g1 = 0;
      if (b <= 3) cc = mix3(cc, glow, g1 * (b === 1 ? 0.6 : 1));
      // distance haze near the horizon
      const hz = ss(300, 400, y) * 0.62;
      if (hz > 0) cc = mix3(cc, skyCol(x, Math.min(y, 396)), hz * (b >= 4 ? 0.35 : 1));
      band[i2] = b; col[i2 * 3] = cc[0]; col[i2 * 3 + 1] = cc[1]; col[i2 * 3 + 2] = cc[2];
      ang[i2] = b >= 3 ? Math.atan2(wny[i2] * 0.5 + wmy[i2] * 0.5, wnx[i2] * 0.5 + wmx[i2] * 0.5) + Math.PI / 2 : -0.8 + (A.vn(x / 120, y / 120, 97) - 0.5) * 0.9;
    }
    // where one swell stands in front of another: the lines a pencil would find
    const edge = new Uint8Array(N), eang = new Float32Array(N);
    for (let y = 2; y < GH - 2; y++) for (let x = 2; x < GW - 2; x++) {
      const i2 = y * GW + x; if (wz[i2] < -1e8) continue;
      const a = wz[i2 - 2], b2 = wz[i2 + 2], u = wz[i2 - 2 * GW], d = wz[i2 + 2 * GW];
      if (a < -1e8 || b2 < -1e8 || u < -1e8 || d < -1e8) continue;
      const gx = b2 - a, gy = d - u, g = Math.hypot(gx, gy);
      if (g > 9) { edge[i2] = 1; eang[i2] = Math.atan2(gy, gx) + Math.PI / 2; }
    }
    CL = { band, col, ang, wz, edge, eang };
  }
  const cloudBand = (x, y) => (x < 0 || y < 0 || x >= GW || y >= HY ? 0 : CL.band[(y | 0) * GW + (x | 0)]);
  const cloudMask = (x, y) => (cloudBand(x, y) > 0 ? 1 : 0);
  function cloudCol(x, y) { if (!cloudBand(x, y)) return null; const i = ((y | 0) * GW + (x | 0)) * 3; return [CL.col[i], CL.col[i + 1], CL.col[i + 2]]; }
  const cloudAng = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? 0 : CL.ang[(y | 0) * GW + (x | 0)]);
  // sky as seen (cloud included) -- used for reflections
  function skyAll(x, y) { return cloudCol(x, y) || skyCol(x, y); }
  S.skyAll = skyAll; S.cloudBand = cloudBand; S.buildCloud = () => { if (!CL) buildCloud(); };

  // ================================================================== DRAWING
  S.drawSky = function (C, rng) {
    const skyDir = (x, y) => {
      const d = Math.hypot(x - GLX, y - HY), w = Math.exp(-d / 190);
      const ring = Math.atan2(y - HY, x - GLX) + Math.PI / 2;
      let r = ring; while (r > Math.PI / 2) r -= Math.PI; while (r < -Math.PI / 2) r += Math.PI;
      return (-0.05 + 0.06 * Math.sin(x / 230 + y / 120)) * (1 - w) + r * w * 0.7;
    };
    const BOT = 505;
    // 1. the side of the stick, broad and fast
    A.field(C, rng, { box: [-60, -30, 1660, BOT], sp: 24, order: 'scan', col: skyCol, dir: skyDir, len: [90, 240], w: [26, 44], p: [0.85, 1.05], med: M.pastel, sticks: PAS, spread: 0.035, wob: 2.2, dj: 0.06 });
    // 2. rubbed in with the heel of the hand, in long sweeps
    for (let y = 6; y < BOT; y += 13) {
      const xy = []; const ph = rng() * 9;
      for (let x = -30; x <= 1630; x += 14) xy.push(x, y + Math.sin(x / 190 + ph) * 5 + rng.g() * 1.5);
      C.rub(rng() < 0.5 ? A.rev(xy) : xy, rng.r(20, 30), 0.5, 0.5);
    }
    // 3. a second pass, lighter, then rubbed again here and there
    A.field(C, rng, { box: [-40, -20, 1640, BOT - 6], sp: 22, col: skyCol, dir: skyDir, len: [70, 190], w: [14, 26], p: [0.6, 0.85], med: M.pastel, sticks: PAS, spread: 0.05, wob: 1.6, dj: 0.08, prob: (x, y) => (cloudMask(x, y) ? 0.15 : 0.7) });
    for (let y = 10; y < BOT - 4; y += 21) {
      const xy = []; const ph = rng() * 9;
      for (let x = -30; x <= 1630; x += 14) xy.push(x, y + Math.sin(x / 150 + ph) * 6 + rng.g() * 2);
      C.rub(xy, rng.r(16, 24), 0.42, 0.55);
    }
    // 4. open diagonal hatching left visible -- the grain of the hand
    A.field(C, rng, { box: [-40, -20, 1640, 400], sp: 21, col: (x, y) => skyCol(x, y - 9), dir: () => -0.24, len: [40, 105], w: [4.5, 9], p: [0.36, 0.56], med: M.pastel, sticks: PAS, spread: 0.07, wob: 1.0, dj: 0.07, prob: (x, y) => (cloudMask(x, y) ? 0 : 0.42 * ss(400, 280, y) * ss(-40, 120, y) + 0.1) });
    // 5. the green band restated with the tip, in short level touches
    A.field(C, rng, { box: [-20, 150, 1620, 330], sp: 17, col: (x, y) => mix3(skyCol(x, y + 6), c.mint, 0.12), dir: () => -0.03, len: [26, 80], w: [2.6, 5], p: [0.4, 0.62], med: M.pastelTip, sticks: PAS, spread: 0.06, wob: 0.8, dj: 0.04, prob: (x, y) => (cloudMask(x, y) ? 0 : 0.42) });
  };

  // thin bars of cloud near the roofs: dusk on their backs, fire underneath
  S.drawWisps = function (C, rng) {
    const wisp = (x0, y0, len, rise, col, n, w, med) => {
      for (let k = 0; k < n; k++) {
        const ox = rng.g() * len * 0.18, oy = rng.g() * 2.6, l2 = len * rng.r(0.35, 1);
        const xy = []; for (let q = 0; q <= 8; q++) { const u = q / 8; xy.push(x0 + ox + (u - 0.5) * l2, y0 + oy - rise * (u - 0.5) + Math.sin(u * 3.1) * -2.4); }
        C.stroke(A.hand(rng, A.curve(xy, 4), { wob: 0.8, t0: 0.4, t1: 0.4, pe: 0.1 }), med || M.pastelTip, PAS.near(mix3(col, c.white, rng.r(0, 0.2)), rng, 0.05), w * rng.r(0.5, 1.2), rng.r(0.55, 0.95));
      }
    };
    const bar = (x, y, len, rise, k) => {
      const near = gs((x - GLX) / 420);
      wisp(x, y - 3.2 * k, len, rise, mix3(hx('#6a4a9c'), hx('#a05090'), near), Math.round(9 * k), 4.2 * k);
      wisp(x, y, len * 0.92, rise, mix3(hx('#de5c98'), hx('#ff9a80'), near), Math.round(8 * k), 3.2 * k);
      wisp(x + (GLX - x) * 0.04, y + 2.4 * k, len * 0.8, rise, mix3(hx('#f9abc4'), hx('#ffe6a0'), near), Math.round(7 * k), 2.2 * k, M.oil);
    };
    bar(770, 352, 300, 8, 1); bar(905, 322, 230, 10, 0.8); bar(690, 300, 190, 5, 0.7); bar(1090, 368, 330, 6, 0.9); bar(1330, 340, 300, 9, 0.85);
    bar(1480, 300, 240, 8, 0.7); bar(70, 356, 250, -7, 0.9); bar(140, 318, 180, -5, 0.6); bar(820, 378, 200, 3, 0.6); bar(1210, 300, 170, 6, 0.55);
    // high, thin, already cold
    wisp(960, 210, 300, 16, hx('#6a7cc8'), 10, 3.2); wisp(1240, 176, 260, 12, hx('#5a60b0'), 9, 3); wisp(110, 196, 200, -10, hx('#6a7cc8'), 7, 3); wisp(760, 150, 220, 12, hx('#463690'), 7, 3);
    wisp(1420, 232, 260, 10, hx('#8a74cc'), 8, 2.8); wisp(1150, 132, 360, 16, hx('#6650b0'), 10, 3.2); wisp(1400, 96, 300, 10, hx('#463690'), 9, 3.4); wisp(1060, 52, 280, 8, hx('#2f2466'), 8, 3.4); wisp(1500, 166, 220, 8, hx('#7a5aa8'), 7, 2.6); wisp(620, 96, 240, 10, hx('#2f2466'), 6, 3.2); wisp(1290, 208, 200, 7, hx('#c080b0'), 6, 2.2); wisp(700, 250, 160, 6, hx('#a6e0c0'), 6, 2.2); wisp(880, 268, 150, 5, hx('#d2efcf'), 5, 2);
    for (let k = 0; k < 30; k++) { const x = rng.r(660, 1600), y = rng.r(160, 390); C.rub([x - 30, y, x, y + rng.g() * 2, x + 30, y - 2], 8, 0.3, 0.7); }
  };

  S.drawCloud = function (C, rng) {
    const BX = [60, -10, 800, 404];
    let cb0 = 0;
    A.field(C, rng, { box: BX, sp: 8.0, begin: (x, y) => { cb0 = cloudBand(x, y); }, mask: (x, y) => (cb0 > 0 && Math.abs(cloudBand(x, y) - cb0) <= (cb0 <= 2 ? 1 : 0) && cloudBand(x, y) > 0 ? 1 : 0), clip: true, follow: true, col: cloudCol, dir: cloudAng, len: [14, 50], w: [8, 18], p: [0.88, 1.12], med: M.pastel, sticks: PAS, spread: 0.04, wob: 1.0, dj: 0.2, stepL: 4, overP: 0.12 });
    // soften only the shadow side with a fingertip
    for (let k = 0; k < 800; k++) {
      const x = rng.r(BX[0], BX[2]), y = rng.r(0, 400), b = cloudBand(x, y);
      if (b !== 2 && b !== 1) continue;
      const a = cloudAng(x, y), xy = [];
      for (let s = -16; s <= 16; s += 5) { const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; if (cloudBand(px, py) && cloudBand(px, py) <= 3) xy.push(px, py); }
      if (xy.length >= 4) C.rub(xy, rng.r(7, 13), 0.42, 0.6);
    }
    // the foot of the tower dissolves into the haze over the roofs
    for (let k = 0; k < 40; k++) { const x = rng.r(90, 760), y = rng.r(366, 398); C.rub([x - 40, y, x, y + rng.g(), x + 40, y - 1], rng.r(9, 14), 0.4, 0.7); }
    // restate: smaller, crisper, the scalloped lights
    let cb = 0;
    for (const [lo, hi, prob, sp] of [[1, 2, 0.45, 5.2], [3, 3, 1, 4.6], [4, 4, 1, 4.4], [0, 0, 0, 0], [5, 5, 1, 4.2]]) {
      if (!lo) { // a fingertip along the turning edge, so light melts into shade before the last crisp marks go on
        for (let k = 0; k < 2200; k++) { const x = rng.r(BX[0], BX[2]), y = rng.r(0, 400), b = cloudBand(x, y); if (b !== 3 && b !== 4) continue; const a = cloudAng(x, y), xy = []; for (let q = -8; q <= 8; q += 4) xy.push(x + Math.cos(a) * q, y + Math.sin(a) * q); C.rub(xy, rng.r(4, 7), 0.34, 0.6); }
        continue;
      }
      A.field(C, rng, { box: BX, sp, dots: true, begin: (x, y) => { cb = cloudBand(x, y); }, mask: (x, y) => (cb >= lo && cb <= hi && cloudBand(x, y) === cb ? 1 : 0), clip: true, follow: true, col: cloudCol, dir: cloudAng, len: [8, 30], w: [3.6, 8.5], p: [0.7, 0.98], med: M.pastelTip, sticks: PAS, spread: lo >= 4 ? 0.05 : 0.03, wob: 0.6, dj: 0.25, stepL: 2.5, overP: 0.03, prob: () => prob });
    }
    // the creases between the swells, found with a dark pencil
    A.field(C, rng, { box: BX, sp: 4.5, begin: (x, y) => { cb = cloudBand(x, y); }, mask: (x, y) => (cb === 1 && cloudBand(x, y) === 1 ? 1 : 0), clip: true, follow: true, col: () => hx('#2c2c78'), dir: cloudAng, len: [6, 22], w: [1.2, 2.0], p: [0.6, 0.9], med: M.pencil, wob: 0.4, dj: 0.3, stepL: 2.5, overP: 0, prob: () => 0.5 });
    // the outlines of the swells, restated lightly: blue in the shade, rose in the light
    const isEdge = (x, y) => (x < 0 || y < 0 || x >= GW || y >= HY ? 0 : CL.edge[(y | 0) * GW + (x | 0)]);
    A.field(C, rng, { box: BX, sp: 5.5, mask: isEdge, clip: true, follow: true, col: (x, y) => { const b = cloudBand(x, y); return b >= 4 ? hx('#e06a8c') : b === 3 ? hx('#8a4a90') : hx('#34389a'); }, dir: (x, y) => CL.eang[(clamp(y, 0, GH - 1) | 0) * GW + (clamp(x, 0, GW - 1) | 0)], len: [10, 34], w: [1.1, 1.9], p: [0.5, 0.85], med: M.pencil, wob: 0.5, dj: 0.15, stepL: 2, overP: 0.5, prob: () => 0.55 });
    // pencil hatching to model the shadows
    A.field(C, rng, { box: BX, sp: 6.5, mask: cloudMask, clip: true, col: (x, y) => { const b = cloudBand(x, y); const cc = cloudCol(x, y); return b <= 2 ? mix3(cc, b === 1 ? c.navy : c.sky, 0.45) : null; }, dir: () => -0.95, len: [10, 26], w: [1.1, 1.7], p: [0.55, 0.85], med: M.pencil, wob: 0.4, dj: 0.08, prob: () => 0.55 });
    // thick waxy light on the rims that still face the sun
    A.field(C, rng, { box: BX, sp: 4.6, mask: (x, y) => (cloudBand(x, y) === 5 ? 1 : 0), clip: true, follow: true, col: (x, y) => mix3(cloudCol(x, y), c.white, 0.3), dir: cloudAng, len: [5, 18], w: [2.4, 5], p: [0.7, 0.98], med: M.oil, wob: 0.4, dj: 0.2, stepL: 2.5, overP: 0.0, prob: () => 0.14 });
  };

  // a new moon, one planet, and something small and bright going away
  S.drawMoon = function (C, rng) {
    const mx = 940, my = 96, r = 15;
    S.glow(C, rng, mx, my, 30, hx('#22419a'), 5, 0.3);
    for (let k = 0; k < 3; k++) {
      const xy = []; for (let a = 0.55; a <= 2.75; a += 0.16) xy.push(mx + Math.cos(a + 0.35) * r, my + Math.sin(a + 0.35) * r);
      const pts = A.hand(rng, xy, { wob: 0.2, t0: 0.45, t1: 0.45, pe: 0.05, step: 2 });
      C.stroke(pts, k ? M.oil : M.pastelTip, k ? hx('#fffbe8') : hx('#fbe8a8'), k ? 2.6 : 3.6, 1.0);
    }
    // earthshine: the rest of the disc, barely there
    { const xy = []; for (let a = 3.3; a <= 6.0; a += 0.2) xy.push(mx + Math.cos(a + 0.35) * r * 0.97, my + Math.sin(a + 0.35) * r * 0.97); C.stroke(A.hand(rng, xy, { wob: 0.2, step: 2 }), M.pencil, hx('#4d7fd0'), 0.9, 0.45); }
    A.dot(C, rng, 872, 150, M.pastelTip, hx('#fff4c8'), 3.4, 0.9); A.dot(C, rng, 872, 150, M.oil, c.white, 2.1, 1);
    // the aeroplane: a thread of lit vapour sinking toward the glow, older and wider behind
    const p0 = [930, 236], p1 = [716, 322];
    for (let k = 0; k < 7; k++) {
      const u0 = rng.r(0, 0.6), u1 = u0 + rng.r(0.15, 0.4), off = rng.g() * 2.2 * (1 - u0);
      A.line(C, rng, [p0[0] + (p1[0] - p0[0]) * u0, p0[1] + (p1[1] - p0[1]) * u0 + off, p0[0] + (p1[0] - p0[0]) * u1, p0[1] + (p1[1] - p0[1]) * u1 + off * 0.6], M.pastelTip, hx(rng() < 0.5 ? '#f9abc4' : '#ffc6a8'), rng.r(2.5, 4.5) * (1 - u0 * 0.6), rng.r(0.3, 0.55), { wob: 1.2, t0: 0.4, t1: 0.4, pe: 0.1 });
    }
    C.rub([p0[0], p0[1], (p0[0] + p1[0]) / 2 + 30, (p0[1] + p1[1]) / 2 - 12], 7, 0.5, 0.6);
    A.line(C, rng, [p0[0] + (p1[0] - p0[0]) * 0.3, p0[1] + (p1[1] - p0[1]) * 0.3, p1[0] + 5, p1[1] - 2], M.pastelTip, hx('#ffe0c8'), 2.0, 0.85, { wob: 0.5, t0: 0.5, t1: 0.05, pe: 0.2 });
    A.line(C, rng, [p0[0] + (p1[0] - p0[0]) * 0.62, p0[1] + (p1[1] - p0[1]) * 0.62, p1[0] + 3, p1[1] - 1.2], M.oil, hx('#fffbe8'), 1.3, 0.95, { wob: 0.3, t0: 0.5, t1: 0.05, pe: 0.2 });
    A.dot(C, rng, p1[0] - 1, p1[1] + 0.6, M.oil, c.white, 1.7, 1);
    A.line(C, rng, [p1[0] - 4.5, p1[1] + 2.6, p1[0] + 1, p1[1] - 0.6], M.pencil, hx('#221d40'), 1.0, 0.9, { wob: 0.1 });
  };
})(typeof self !== 'undefined' ? self : globalThis);
