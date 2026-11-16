/* STILL WARM — the picture as it lives in the head before the hand starts.
 * Geometry, regions, and the colours the artist is reaching for.
 * (Design space is 1600 x 900 units; the engine scales it to any size.)
 */
(function (g) {
'use strict';

function createScene(E) {
  const { vnoise, fbm, c01, sstep, sq, hex, mkRamp, ramp, mix3, R, rr } = E;
  const HOR = 556;
  const GLOW = { x: 600, y: HOR };
  const NEST = { x: 960, y: 742, R: 88 };
  const MOON = { x: 492, y: 108, r: 12.5 };
  const ZF = 600 * 222;

  // ground plane <-> screen (a gentle perspective, eye level at y=520)
  function w2s(X, Zr, o) { const Z = 600 + Zr; o[0] = NEST.x + X * 600 / Z; o[1] = 520 + ZF / Z; return o; }
  function s2w(x, y, o) { const yy = y < 548 ? 548 : y; const Z = ZF / (yy - 520); o[0] = (x - NEST.x) * Z / 600; o[1] = Z - 600; return o; }
  const depthScale = y => Math.max(0.12, (y - 520) / 222);

  // ---------- land
  function groundY(x) { return 640 - 34 * Math.exp(-sq((x - 1130) / 430)) + 9 * Math.sin(x / 230 + 1.3) + 4 * Math.sin(x / 71 + 0.4); }
  function treeLine(x) { const pres = sstep(0.42, 0.62, vnoise(x / 130, 3.3, 41)); return pres * (2.5 + 5.5 * Math.abs(Math.sin(x / 8.3 + 5 * vnoise(x / 37, 0.5, 42)))) * (0.6 + 0.8 * vnoise(x / 21, 1.5, 43)); }
  function midY(x) { return 598 + 14 * Math.sin(x / 310 + 0.5) + 7 * Math.sin(x / 97 + 2) - treeLine(x); }
  function farH(x) { return Math.max(0, 14 * Math.sin(x / 380 + 2.0) + 8 * Math.sin(x / 141 + 1) + 6 - 34 * Math.exp(-sq((x - 600) / 170))) ; }

  // ---------- the path, worn by coming back
  const PATH = [];
  (function () {
    const A = [228, 916], B = [430, 826], C = [640, 842], D = [868, 763];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120, u = 1 - t;
      PATH.push([u * u * u * A[0] + 3 * u * u * t * B[0] + 3 * u * t * t * C[0] + t * t * t * D[0], u * u * u * A[1] + 3 * u * u * t * B[1] + 3 * u * t * t * C[1] + t * t * t * D[1]]);
    }
  })();
  const pathW = y => 9 + 74 * Math.pow(c01((y - 742) / 160), 1.25);

  // ---------- cloud puffs (cx, cy, rx, ry, kind)
  const PUFFS = [];
  (function () {
    const main = [
      [34, 540, 46], [96, 528, 56], [165, 520, 62], [243, 516, 70], [322, 522, 60], [392, 534, 46], [440, 543, 30],
      [128, 468, 58], [208, 452, 66], [290, 460, 60], [352, 486, 44],
      [168, 398, 54], [244, 382, 60], [306, 408, 48],
      [198, 332, 48], [262, 316, 52], [312, 348, 36],
      [228, 268, 42], [276, 258, 36], [200, 288, 32], [252, 232, 26],
      [716, 518, 24], [748, 509, 30], [786, 515, 25], [814, 524, 16],
    ];
    for (const m of main) {
      const kind = m[0] > 600 ? 2 : 0;
      PUFFS.push([m[0], m[1], m[2], m[2] * 0.94, kind]);
      const k = m[2] > 40 ? 4 : 2;
      for (let i = 0; i < k; i++) {
        const a = rr(-Math.PI * 1.05, 0.05), rad = m[2] * rr(0.26, 0.46);
        PUFFS.push([m[0] + Math.cos(a) * m[2] * 0.82, m[1] + Math.sin(a) * m[2] * 0.82, rad, rad * 0.92, kind]);
      }
    }
    // long quiet bars of stratus near the horizon
    const bars = [[648, 478, 112, 5.2], [468, 521, 124, 4.6], [905, 468, 86, 4.2], [1010, 530, 96, 3.6]];
    for (const b of bars) if (b[2] > 0) PUFFS.push([b[0], b[1], b[2], b[3], 1]);
  })();

  // generic "max of blobs" field on a half-res grid
  const FW = 800, FH = 450;
  function makeField() { return { v: new Float32Array(FW * FH).fill(-1), nx: new Float32Array(FW * FH), ny: new Float32Array(FW * FH), k: new Uint8Array(FW * FH) }; }
  function splat(F, cx, cy, rx, ry, kind) {
    const x0 = Math.max(0, Math.floor((cx - rx) / 2)), x1 = Math.min(FW - 1, Math.ceil((cx + rx) / 2));
    const y0 = Math.max(0, Math.floor((cy - ry) / 2)), y1 = Math.min(FH - 1, Math.ceil((cy + ry) / 2));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
      const dx = (gx * 2 + 1 - cx) / rx, dy = (gy * 2 + 1 - cy) / ry, v = 1 - Math.sqrt(dx * dx + dy * dy), i = gy * FW + gx;
      if (v > F.v[i]) { F.v[i] = v; F.nx[i] = dx; F.ny[i] = dy; F.k[i] = kind; }
    }
  }
  function fv(F, x, y) {
    const fx = clampf(x / 2 - 0.5, 0, FW - 1.001), fy = clampf(y / 2 - 0.5, 0, FH - 1.001), ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, i = iy * FW + ix;
    return (F.v[i] * (1 - tx) + F.v[i + 1] * tx) * (1 - ty) + (F.v[i + FW] * (1 - tx) + F.v[i + FW + 1] * tx) * ty;
  }
  function fi(x, y) { return (clampf(y / 2, 0, FH - 1) | 0) * FW + (clampf(x / 2, 0, FW - 1) | 0); }
  function clampf(v, a, b) { return v < a ? a : v > b ? b : v; }

  const CLF = makeField();
  for (const p of PUFFS) splat(CLF, p[0], p[1], p[2], p[3], p[4]);

  // ---------- the tree
  const BIG = [[1190, 232, 400, 212], [1480, 230, 270, 270], [925, 350, 150, 70], [1000, 142, 240, 150], [1395, 424, 200, 76]];
  function bigField(x, y, o) {
    let m = -9, bx = 0, by = 0;
    for (const b of BIG) {
      const dx = (x - b[0]) / b[2], dy = (y - b[1]) / b[3], v = 1 - Math.sqrt(dx * dx + dy * dy);
      if (v > m) { m = v; bx = dx / b[2]; by = dy / b[3]; }
    }
    if (o) { const l = Math.hypot(bx, by) || 1; const mag = c01(1.15 - m * 1.3); o[0] = bx / l * mag; o[1] = by / l * mag; }
    return m;
  }
  const HOLES = [[1058, 306, 30], [1296, 176, 26], [1236, 356, 26], [1420, 300, 24], [880, 318, 16], [1130, 120, 22], [1500, 120, 20], [985, 232, 20], [1340, 60, 18]];
  const CLUMPS = [];
  (function () {
    let tries = 0;
    while (CLUMPS.length < 330 && tries++ < 6000) {
      const b = BIG[(R() * BIG.length) | 0];
      const a = R() * 6.283, q = Math.sqrt(R()) * 1.0;
      const x = b[0] + Math.cos(a) * b[2] * q, y = b[1] + Math.sin(a) * b[3] * q;
      const bf = bigField(x, y);
      if (bf < 0.0) continue;
      const r = (16 + 26 * R()) * (0.6 + 0.9 * c01(bf * 2.2));
      let ok = true;
      for (const h of HOLES) if (Math.hypot(x - h[0], y - h[1]) < r * 0.9 + h[2]) { ok = false; break; }
      if (!ok) continue;
      CLUMPS.push([x, y, r]);
    }
  })();
  const CNF = makeField();
  for (const c of CLUMPS) splat(CNF, c[0], c[1], c[2], c[2] * 0.88, 0);
  // small scalloped tufts of leaves riding on the big clumps
  const CN2 = makeField();
  (function () {
    let n = 0, tries = 0;
    while (n < 3400 && tries++ < 40000) {
      const x = rr(760, 1610), y = rr(-10, 520);
      if (fv(CNF, x, y) < 0.03) continue;
      const r = rr(6.5, 15); splat(CN2, x, y, r, r * 0.86, 0); n++;
    }
  })();

  // trunk and limbs: [x0,y0,hw0, x1,y1,hw1]
  const LIMBS = [];
  (function () {
    const chains = [
      [[1150, 708, 46], [1142, 680, 27], [1128, 640, 22], [1122, 596, 20], [1126, 548, 19], [1124, 500, 18.5], [1116, 462, 18]],
      [[1144, 684, 20], [1124, 704, 9], [1110, 716, 3]], [[1150, 684, 20], [1172, 704, 9], [1186, 715, 3]],
      [[1118, 478, 15], [1090, 440, 12.5], [1050, 410, 10.5], [1004, 388, 8], [958, 366, 6], [910, 358, 4.2], [880, 356, 3]],
      [[1120, 470, 14], [1128, 426, 12], [1140, 380, 10.5], [1156, 330, 8.5], [1162, 286, 7], [1154, 236, 5], [1148, 200, 3.5]],
      [[1124, 486, 14.5], [1166, 452, 12.5], [1214, 424, 10.5], [1266, 404, 8.5], [1320, 394, 7], [1380, 396, 5], [1440, 404, 3.5]],
      [[1158, 326, 6.5], [1200, 292, 5.5], [1250, 262, 4.5], [1294, 236, 3.6], [1332, 212, 3]],
      [[1050, 410, 6], [1028, 366, 5], [1010, 330, 4], [996, 294, 3.2], [990, 262, 2.6]],
      [[1214, 424, 6], [1252, 374, 5], [1290, 332, 4], [1340, 306, 3.2], [1392, 290, 2.6]],
    ];
    for (const ch of chains) for (let i = 0; i < ch.length - 1; i++) LIMBS.push([ch[i][0], ch[i][1], ch[i][2], ch[i + 1][0], ch[i + 1][1], ch[i + 1][2], i === 0 && ch === chains[0] ? 1 : 0]);
  })();
  const TI = { q: 9, nx: 0, ny: 0, ang: 0 };
  function trunkInfo(x, y) {
    let best = 9, bnx = 0, bny = 0, bang = 0;
    for (const s of LIMBS) {
      const dx = s[3] - s[0], dy = s[4] - s[1], L2 = dx * dx + dy * dy;
      let t = ((x - s[0]) * dx + (y - s[1]) * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = s[0] + dx * t, qy = s[1] + dy * t;
      let hw = s[2] + (s[5] - s[2]) * (s[6] ? Math.pow(t, 0.55) : t);
      hw *= 1 + 0.07 * Math.sin(qy * 0.11 + qx * 0.05);
      const ox = x - qx, oy = y - qy, q = Math.hypot(ox, oy) / hw;
      if (q < best) { best = q; bnx = ox / hw; bny = oy / hw; bang = Math.atan2(dy, dx); }
    }
    TI.q = best; TI.nx = bnx; TI.ny = bny; TI.ang = bang; return TI;
  }

  // ---------- regions
  const REG = { NONE: 0, SKY: 1, CLOUD: 2, FAR: 3, WATER: 4, MID: 5, MEADOW: 6, PATH: 7, TRUNK: 8, CANOPY: 9 };
  const GW = 3200, GH = 1800, reg = new Uint8Array(GW * GH);
  function regAt(x, y) { if (x < 0 || y < 0 || x >= 1600 || y >= 900) return 0; return reg[((y * 2) | 0) * GW + ((x * 2) | 0)]; }
  function canopyV(x, y) { return fv(CNF, x, y) + 0.24 * (c01(fv(CN2, x, y)) - 0.3) + 0.12 * (fbm(x / 8, y / 8, 3, 3) - 0.5); }
  function cloudV(x, y) { const b = CLF.k[fi(x, y)] === 1; return fv(CLF, x, y) + (b ? 0.25 : 0.07) * (fbm(x / (b ? 30 : 16), y / (b ? 4 : 16), 5, 3) - 0.5) * 2; }
  function buildRegions() {
    const pathMask = new Uint8Array(GW * GH);
    for (let i = 0; i < PATH.length; i++) {
      const [px, py] = PATH[i]; const hw = pathW(py) / 2 + 3;
      const x0 = Math.max(0, ((px - hw) * 2) | 0), x1 = Math.min(GW - 1, ((px + hw) * 2) | 0), y0 = Math.max(0, ((py - hw * 0.6) * 2) | 0), y1 = Math.min(GH - 1, ((py + hw * 0.6) * 2) | 0);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) {
        const x = gx / 2, y = gy / 2;
        const d = Math.hypot(x - px, (y - py) * 2.1);
        if (d < (pathW(py) / 2) * (0.78 + 0.5 * fbm(x / 13, y / 5, 61, 2))) pathMask[gy * GW + gx] = 1;
      }
    }
    for (let gy = 0; gy < GH; gy++) {
      const y = gy / 2 + 0.25;
      for (let gx = 0; gx < GW; gx++) {
        const x = gx / 2 + 0.25, i = gy * GW + gx;
        // a ragged edge where the hand stopped before the sheet did
        const mL = 3.5 + 5 * vnoise(y / 34, 0.5, 91), mR = 1600 - 3.5 - 5 * vnoise(y / 31, 2.5, 92), mT = 3.5 + 5 * vnoise(x / 36, 4.5, 93), mB = 900 - 3.5 - 5 * vnoise(x / 33, 6.5, 94);
        if (x < mL || x > mR || y < mT || y > mB) { reg[i] = 0; continue; }
        let r;
        if (x > 760 && y < 520 && fv(CNF, x, y) > -0.25 && canopyV(x, y) > 0.1) r = REG.CANOPY;
        else if (x > 860 && x < 1470 && y > 180 && y < 730 && trunkInfo(x, y).q < 1) r = REG.TRUNK;
        else if (y > groundY(x) - 2.2 * fbm(x / 3.1, y / 9, 71, 2)) r = pathMask[i] ? REG.PATH : REG.MEADOW;
        else if (y > midY(x)) r = REG.MID;
        else if (y > HOR) r = REG.WATER;
        else if (y > HOR - farH(x)) r = REG.FAR;
        else if (fv(CLF, x, y) > -0.3 && cloudV(x, y) > 0) r = REG.CLOUD;
        else r = REG.SKY;
        reg[i] = r;
      }
    }
  }

  // ---------- the box of colours
  const SKY_NEAR = mkRamp([[0, '#141a52'], [0.22, '#1c2f7c'], [0.42, '#25509e'], [0.60, '#2f7fae'], [0.74, '#5fb0b4'], [0.84, '#c4cfaa'], [0.91, '#ffd596'], [0.965, '#ff9c70'], [1.0, '#ee7288']]);
  const SKY_FAR = mkRamp([[0, '#121747'], [0.25, '#1a2a72'], [0.45, '#27408f'], [0.62, '#4458a8'], [0.76, '#7068b4'], [0.86, '#a476b6'], [0.93, '#c97cac'], [0.975, '#d87a9c'], [1.0, '#c66c94']]);
  const CLOUD_R = mkRamp([[0.0, '#565cb2'], [0.2, '#8672c4'], [0.4, '#cc78b6'], [0.57, '#f5859c'], [0.73, '#ffb48e'], [0.9, '#ffe4b0']]);
  const MEADOW_R = mkRamp([[0, '#11244c'], [0.03, '#0f3852'], [0.07, '#124e58'], [0.13, '#1c6c60'], [0.22, '#3f9466'], [0.33, '#86b85a'], [0.46, '#c9d35c'], [0.62, '#f7dc6a'], [0.80, '#ffeb9c'], [1.0, '#fff5d6']]);
  const PATH_R = mkRamp([[0, '#2c316c'], [0.08, '#45457f'], [0.18, '#86687a'], [0.33, '#c79a6a'], [0.55, '#f1cc86'], [0.8, '#fde6ad'], [1, '#fff3d4']]);
  const CANOPY_R = mkRamp([[0, '#0f2545'], [0.06, '#0f3a4e'], [0.14, '#135256'], [0.24, '#2f7a55'], [0.36, '#7d9a45'], [0.5, '#c9a942'], [0.66, '#f2c45c'], [0.85, '#ffe59a']]);
  const TRUNK_R = mkRamp([[0, '#221a3e'], [0.18, '#3c2852'], [0.4, '#7a3e50'], [0.6, '#b9684a'], [0.8, '#e9a458'], [1.0, '#ffd98a']]);
  const UNDER_R = mkRamp([[0, '#8088dc'], [0.05, '#6fa6cf'], [0.11, '#5cc0ae'], [0.22, '#b4d862'], [0.42, '#ffe066'], [0.62, '#ffe890'], [0.8, '#fff1bd']]);

  const ta = [0, 0, 0], tb = [0, 0, 0], tc = [0, 0, 0], wv = [0, 0];
  const C_AMB = hex('#23487c'), C_FAR = hex('#5b56a6'), C_MID = hex('#2a3577'), C_MIDTOP = hex('#4a58a4'), C_MIDTREE = hex('#1d2762'),
    C_WTINT = hex('#2a4a8c'), C_GLIT = hex('#ffe9b0'), C_RIM = hex('#35509c'), C_COOL = hex('#33478c'), C_WHILL = hex('#46479a'), C_ROSE = hex('#b0608c');

  function skyT(x, y, o) {
    let t = y / HOR; t += 0.03 * (fbm(x / 260, y / 80, 11, 3) - 0.5); t = c01(t);
    const gl = Math.exp(-sq((x - GLOW.x) / 560));
    ramp(SKY_NEAR, t, ta); ramp(SKY_FAR, t, tb);
    return mix3(tb, ta, gl, o);
  }
  function cloudT(x, y, o) {
    const i = fi(x, y), nx = CLF.nx[i], ny = CLF.ny[i], kd = CLF.k[i], bar = kd === 1;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let vx = GLOW.x + 40 - x, vy = GLOW.y + 90 - y; const l = Math.hypot(vx, vy); vx /= l; vy /= l;
    let lit;
    if (bar) lit = 0.36 + ny * 0.5 + 0.25 * Math.exp(-sq((x - GLOW.x) / 300));
    else {
      const bx = kd === 2 ? (x - 765) / 60 : (x - 236) / 190, by = kd === 2 ? (y - 520) / 30 : (y - 400) / 190;
      lit = 0.36 + 0.40 * (nx * vx + ny * vy) + 0.10 * nz + 0.30 * (bx * vx + by * vy) + 0.16 * (fbm(x / 40, y / 40, 12, 3) - 0.5);
    }
    ramp(CLOUD_R, lit, o);
    const hz = sstep(bar ? 400 : 462, 556, y) * (bar ? 0.3 : 0.72);
    skyT(x, y, tc);
    return mix3(o, tc, hz, o);
  }
  function farT(x, y, o) {
    skyT(x, HOR - 2, tc);
    mix3(C_FAR, tc, 0.38, o);
    const k = 0.1 * (fbm(x / 30, y / 6, 13, 2) - 0.5); o[0] += k; o[1] += k; o[2] += k;
    return o;
  }
  function waterT(x, y, o) {
    const ry = HOR - (y - HOR) * 2.4;
    skyT(x + 5 * Math.sin(y * 1.3), Math.max(0, ry), o);
    mix3(o, C_WTINT, 0.20, o);
    o[0] *= 0.9; o[1] *= 0.9; o[2] *= 0.94;
    const h = farH(x);
    if (h > 0 && y < HOR + h * 0.95) mix3(o, C_WHILL, 0.55, o);
    const rp = vnoise(x / 46, y / 1.9, 21) - 0.5; o[0] += rp * 0.09; o[1] += rp * 0.09; o[2] += rp * 0.07;
    const gl = Math.exp(-sq((x - GLOW.x) / (22 + (y - HOR) * 1.5)));
    if (vnoise(x / 13, y / 1.5, 33) > 0.56 - 0.1 * gl) mix3(o, C_GLIT, gl * 0.85, o);
    return o;
  }
  function midT(x, y, o) {
    const top = midY(x), d = y - top;
    mix3(C_MIDTOP, C_MID, sstep(0, 9, d), o);
    if (d < treeLine(x) * 1.0 + 1.5) mix3(o, C_MIDTREE, 0.6, o);
    const gl = Math.exp(-sq((x - GLOW.x) / 300)) * (1 - sstep(0, 12, d));
    mix3(o, C_ROSE, gl * 0.3, o);
    const k = 0.07 * (fbm(x / 22, y / 7, 14, 2) - 0.5); o[0] += k; o[1] += k; o[2] += k;
    return o;
  }
  // how much of the small light reaches a spot on the ground (0..1)
  const TSH = { a: Math.atan2(140, 224.5), d: 264 };
  function nestLight(x, y) {
    s2w(x, y, wv);
    const d = Math.hypot(wv[0], wv[1]);
    let L;
    if (d < NEST.R) L = 0.50 + 0.24 * Math.pow(d / NEST.R, 2.6);
    else L = 0.74 * Math.pow(1 / (1 + sq((d - NEST.R) / 165)), 1.15);
    if (d > 215) {
      let da = Math.abs(Math.atan2(wv[1], wv[0]) - TSH.a);
      const sh = (1 - sstep(0.10, 0.27, da)) * sstep(222, 285, d);
      L *= 1 - 0.74 * sh;
    }
    return L;
  }
  function meadowT(x, y, o) {
    let L = nestLight(x, y);
    L *= 0.80 + 0.42 * fbm(x / 46, y / 15, 15, 3);
    ramp(MEADOW_R, L, o);
    const amb = c01(1 - (y - 600) / 260) * 0.24 * (1 - sstep(0.05, 0.3, L));
    mix3(o, C_AMB, amb, o);
    return o;
  }
  function pathT(x, y, o) {
    let L = nestLight(x, y) * (0.9 + 0.25 * fbm(x / 30, y / 9, 16, 2));
    ramp(PATH_R, L, o);
    return o;
  }
  function trunkT(x, y, o) {
    const ti = trunkInfo(x, y), nx = ti.nx, ny = ti.ny;
    let dx = NEST.x - x, dy = NEST.y - 14 - y; const dist = Math.hypot(dx, dy); dx /= dist; dy /= dist;
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
    let lit = c01(0.72 * (nx * dx + ny * dy) + 0.30 * nz + 0.02) * 1.55 / (1 + sq(dist / 290));
    lit += 0.16 * (fbm(x / 5, y / 26, 17, 3) - 0.5);
    ramp(TRUNK_R, lit, o);
    const cool = c01((nx * 0.95 - ny * 0.3) - 0.45) * 0.9;
    mix3(o, C_COOL, cool * 0.55, o);
    return o;
  }
  const bn = [0, 0];
  function canopyU(x, y) {
    const i = fi(x, y), nx = CNF.nx[i], ny = CNF.ny[i];
    bigField(x, y, bn);
    let dx = NEST.x - x, dy = NEST.y - y; const dist = Math.hypot(dx, dy); dx /= dist; dy /= dist;
    const n2x = CN2.nx[i], n2y = CN2.ny[i], v2 = CN2.v[i];
    let U = (0.18 + 0.20 * (nx * dx + ny * dy) + 0.30 * (n2x * dx + n2y * dy) + 0.52 * (bn[0] * dx + bn[1] * dy) + 0.26 * (fbm(x / 30, y / 30, 18, 3) - 0.5)) * 1.75 / (1 + sq(dist / 400));
    U *= 0.72 + 0.28 * sstep(0.0, 0.4, v2);
    return U;
  }
  function canopyT(x, y, o) {
    const i = fi(x, y), nx = CNF.nx[i], ny = CNF.ny[i];
    const U = canopyU(x, y);
    ramp(CANOPY_R, U, o);
    const sr = c01((nx * -0.5 + ny * -0.86) * 0.3 + (CN2.nx[i] * -0.5 + CN2.ny[i] * -0.86) * 0.45 + (bn[0] * -0.5 + bn[1] * -0.86) * 0.6 - 0.15);
    mix3(o, C_RIM, sr * 0.6 * (1 - sstep(0.1, 0.3, U)), o);
    return o;
  }
  function target(x, y, o) {
    switch (regAt(x, y)) {
      case 1: return skyT(x, y, o);
      case 2: return cloudT(x, y, o);
      case 3: return farT(x, y, o);
      case 4: return waterT(x, y, o);
      case 5: return midT(x, y, o);
      case 6: return meadowT(x, y, o);
      case 7: return pathT(x, y, o);
      case 8: return trunkT(x, y, o);
      case 9: return canopyT(x, y, o);
    }
    o[0] = E.PAPER[0]; o[1] = E.PAPER[1]; o[2] = E.PAPER[2]; return o;
  }
  // the first bright layer, laid down knowing it will be buried and found again
  function underT(x, y, o) {
    const r = regAt(x, y);
    if (r === 6 || r === 7) {
      const L = nestLight(x, y) * (0.85 + 0.3 * fbm(x / 60, y / 20, 19, 2));
      s2w(x, y, wv); const dd = Math.hypot(wv[0], wv[1]); if (dd > NEST.R * 0.62 && dd < NEST.R * 1.5) return false;
      ramp(UNDER_R, L, o); return true;
    }
    if (r === 9) { const U = canopyU(x, y); ramp(UNDER_R, c01(U * 0.9 + 0.02), o); return true; }
    if (r === 8) { trunkT(x, y, o); mix3(o, [1, 0.86, 0.5], 0.55, o); o[0] = Math.max(o[0], 0.62); o[1] = Math.max(o[1], 0.5); o[2] = Math.max(o[2], 0.55); return true; }
    if (r === 1 || r === 4) {
      const yy = r === 4 ? HOR - (y - HOR) * 2.4 : y;
      const t = yy / HOR, gl = Math.exp(-sq((x - GLOW.x) / 520));
      const k = sstep(0.80, 0.94, t) * gl;
      if (k < 0.12) return false;
      mix3(E.PAPER, [1, 0.90, 0.60], k, o); return true;
    }
    if (r === 2) {
      cloudT(x, y, o);
      if (o[0] < 0.93) return false;
      mix3(E.PAPER, [1, 0.91, 0.66], 0.8, o); return true;
    }
    return false;
  }

  return {
    HOR, GLOW, NEST, MOON, REG, PUFFS, CLUMPS, LIMBS, BIG, PATH, pathW, CLF, CNF, CN2, fv, fi, w2s, s2w, depthScale, groundY, midY, farH, treeLine,
    buildRegions, regAt, canopyV, cloudV, bigField, trunkInfo, nestLight, canopyU,
    skyT, cloudT, farT, waterT, midT, meadowT, pathT, trunkT, canopyT, target, underT,
  };
}

g.SW = g.SW || {};
g.SW.createScene = createScene;
if (typeof module !== 'undefined' && module.exports) module.exports = { createScene };
})(typeof self !== 'undefined' ? self : globalThis);
