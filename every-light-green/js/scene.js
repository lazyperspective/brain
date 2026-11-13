// scene.js -- "Every Light Green". What is drawn, and in what order a hand would draw it.
// Design space is 1600 x 900 units; the engine scales to the sheet.
(function (G) {
  'use strict';
  const A = G.ART, hx = A.hex, M = A.MED, mix3 = A.mix3, ss = A.ss, clamp = A.clamp, mix = A.mix;

  // ------------------------------------------------------------------ the boxes of sticks
  const PAS = new A.Sticks([
    '#131040', '#1b1a58', '#252a78', '#2c3f9e', '#3857b6', '#4d76cc', '#6f94dc', '#9ab6ea', '#c6d8f4',
    '#0f5f72', '#1b8a98', '#3fb3b4', '#80d4c8', '#b8ecd8',
    '#3b2a6e', '#5a3f98', '#7a5cb8', '#9c84d2', '#bfaee6', '#ddd2f2',
    '#7e2c68', '#b23c84', '#de5c98', '#f283ae', '#f9abc4', '#fcd3dc',
    '#e2553e', '#f47a52', '#fb9d6c', '#fdbd8c', '#fedcbc',
    '#e59a1e', '#f7b63a', '#fdd05e', '#fee48e', '#fff4c6', '#fffbe8',
    '#0e0c22', '#2a2440', '#4a4460', '#7c7692', '#b9b3c8',
    '#7d80cc', '#6a5fb4', '#c890c0', '#a86aa4', '#8a4a80', '#ffb6a0', '#e8788c',
  ]);
  const PEN = new A.Sticks([
    '#0e0c22', '#17153f', '#232a6e', '#2c3f9e', '#4d76cc', '#9ab6ea', '#0f5f72', '#3fb3b4', '#a6f0dc',
    '#3b2a6e', '#7a5cb8', '#bfaee6', '#7e2c68', '#de5c98', '#f9abc4', '#e2553e', '#fb9d6c', '#f7b63a', '#fee48e', '#fffbe8',
    '#1f4a3c', '#2f6f4a', '#5a9a58', '#9cc37a', '#4a4460', '#b9b3c8',
  ]);
  const c = {
    white: hx('#fffdf2'), cream: hx('#fff4c6'), lemon: hx('#fff0a0'), gold: hx('#fdd05e'), amber: hx('#f7b63a'), orange: hx('#fb9d6c'),
    coral: hx('#f47a52'), red: hx('#e2553e'), pink: hx('#f283ae'), hot: hx('#de5c98'), rose: hx('#f9abc4'), magenta: hx('#b23c84'),
    plum: hx('#7e2c68'), lav: hx('#bfaee6'), violet: hx('#7a5cb8'), deepv: hx('#3b2a6e'), indigo: hx('#1b1a58'), night: hx('#131040'),
    black: hx('#0e0c22'), navy: hx('#252a78'), ultra: hx('#2c3f9e'), blue: hx('#4d76cc'), sky: hx('#9ab6ea'), ice: hx('#c6d8f4'),
    teal: hx('#1b8a98'), dteal: hx('#0f5f72'), aqua: hx('#3fb3b4'), mint: hx('#80d4c8'), go: hx('#3fe6ae'), goHi: hx('#c8ffe6'), goDeep: hx('#12a47c'),
    leaf: hx('#2f6f4a'), dleaf: hx('#1f4a3c'), grass: hx('#5a9a58'), lime: hx('#9cc37a'), grey: hx('#7c7692'), dgrey: hx('#4a4460'), slate: hx('#2a2440'),
  };

  // ------------------------------------------------------------------ the camera / the hill
  // We stand on the brow of a hill. The street runs flat to a crossing, then drops steeply to the sea.
  const F = 1100, VX = 680, HY = 500, EYE = 1.9, SUNX = 735, ZB = 11.5, ZT = 64.5;
  function gz(z) { // altitude of the ground (relative to the eye's level) at distance z down the street
    if (z <= ZB) return -(EYE + 0.02 * z);
    if (z <= ZT) return -(EYE + 0.23 + 0.22 * (z - ZB));
    return -(EYE + 11.89 + 0.035 * (z - ZT));
  }
  const SHORE = 520, SEA = gz(SHORE), YV = HY + F * 0.02, YB = HY - F * gz(ZB) / ZB;
  const gs = v => Math.exp(-v * v);
  const pr = (xw, alt, z) => [VX + F * xw / z, HY - F * alt / z];
  const gp = (xw, z, h) => pr(xw, gz(z) + (h || 0), z);

  // ------------------------------------------------------------------ what the eye wants: sky
  function grad(stops, t) {
    if (t <= stops[0][0]) return stops[0][1];
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const a = stops[i - 1], b = stops[i]; return mix3(a[1], b[1], (t - a[0]) / (b[0] - a[0])); }
    return stops[stops.length - 1][1];
  }
  const SKY = [[0, '#15134e'], [90, '#1d2877'], [180, '#2a4aa2'], [250, '#3b78ba'], [308, '#7890d4'], [358, '#b08ad0'], [404, '#ee86a8'], [444, '#ff9a78'], [478, '#ffc463'], [500, '#ffe59a']].map(s => [s[0], hx(s[1])]);
  const cTeal = hx('#3fb0b4'), cSun1 = hx('#fff6c0'), cSun2 = hx('#ffbe5c'), cDeep = hx('#17124a'), cPinkFar = hx('#f08aa6');
  function skyCol(x, y) {
    const dx = Math.abs(x - SUNX);
    const yy = y - 46 * ss(0, 850, dx) + 10 * (A.vn(x / 260, y / 90, 5) - 0.5);
    let col = grad(SKY, yy);
    const tw = Math.exp(-((yy - 262) / 50) * ((yy - 262) / 50)) * 0.42 * ss(1300, 300, x);
    col = mix3(col, cTeal, tw);
    // away from the sun the horizon goes rosy instead of gold
    col = mix3(col, cPinkFar, ss(250, 800, dx) * ss(430, 500, yy) * 0.55);
    const d = Math.hypot((x - SUNX) * 0.8, (y - HY) * 1.25);
    col = mix3(col, cSun2, 0.5 * Math.exp(-d / 130));
    col = mix3(col, cSun1, 0.9 * Math.exp(-d / 40));
    col = mix3(col, cDeep, ss(950, 1650, x) * ss(430, 60, y) * 0.3);
    return col;
  }

  // ------------------------------------------------------------------ the cloud: a tower of spheres, lit from behind-left by the sunken sun
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
      // far base along the horizon
      [820, 505, 46, -40], [900, 498, 62, -20], [1000, 490, 80, 0], [1120, 480, 100, 10], [1260, 470, 110, 0], [1400, 468, 105, 10], [1530, 470, 100, 0], [1640, 460, 90, 0],
      // left turret
      [950, 430, 60, 30], [985, 372, 46, 40], [930, 398, 38, 45],
      // the main column
      [1140, 395, 112, 40], [1205, 300, 118, 60], [1160, 210, 104, 70], [1235, 128, 108, 80], [1185, 52, 88, 85], [1100, 300, 62, 80], [1085, 190, 50, 85],
      // the right-hand mass
      [1400, 370, 120, 30], [1470, 268, 104, 40], [1380, 205, 78, 55], [1545, 190, 92, 35], [1600, 330, 90, 20],
      // the anvil spreading under the top edge
      [1075, 38, 58, 70], [1310, 30, 92, 60], [1430, 70, 84, 50], [1550, 60, 80, 40], [980, 20, 40, 60], [1640, 100, 80, 30],
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
      const wk = x < 800 ? 0.3 : 1;
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
    const litTop = hx('#fff6d6'), litMid = hx('#ffd9a0'), litLow = hx('#ffa678');
    const ltTop = hx('#ffcdb4'), ltMid = hx('#ffa890'), ltLow = hx('#f07a84');
    const mdTop = hx('#c79ad0'), mdMid = hx('#bb74b0'), mdLow = hx('#9a4c84');
    const shTopC = hx('#7f8cd8'), shMidC = hx('#6c66bc'), shLowC = hx('#5b448e');
    const shTopW = hx('#9486cc'), shMidW = hx('#8a62a8'), shLowW = hx('#7a4680');
    const dpTop = hx('#4a55a8'), dpMid = hx('#453c8e'), dpLow = hx('#40296a');
    const glow = hx('#ffe6cc');
    const g3 = (a, b, cc, y) => (y < 250 ? mix3(a, b, y / 250) : mix3(b, cc, clamp((y - 250) / 230, 0, 1)));
    const T = new Float32Array(N), FC = new Float32Array(N);
    for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
      const i2 = y * GW + x;
      if (wz[i2] < -1e8) { band[i2] = 0; T[i2] = -9; continue; }
      { const lx = SUNX - x, ly = HY + 50 - y, ll = Math.hypot(lx, ly) / 0.993; L[0] = lx / ll; L[1] = ly / ll; }
      const lam = wnx[i2] * L[0] + wny[i2] * L[1] + wnz[i2] * L[2];
      const xa = clamp(x - 5, 0, GW - 1), xb = clamp(x + 5, 0, GW - 1), ya = clamp(y - 5, 0, GH - 1), yb = clamp(y + 5, 0, GH - 1);
      const facing = -((big[y * GW + xb] - big[y * GW + xa]) * L[0] + (big[yb * GW + x] - big[ya * GW + x]) * L[1]) / 10;
      const mac = ss(-0.05, 0.6, facing * 0.9 + (wmx[i2] * L[0] + wmy[i2] * L[1]) * 0.3 + (A.vn(x / 70, y / 70, 87) - 0.5) * 0.35);
      let t = lam * (0.3 + 0.7 * mac) + (mac - 0.5) * 0.5;
      // cast shadow: march toward the light across the height field
      let shd = 0;
      { let px = x, py = y, pz = wz[i2] + 1.5; for (let k = 0; k < 9; k++) { px += L[0] * 3.2; py += L[1] * 3.2; pz += L[2] * 3.2; const qx = px | 0, qy = py | 0; if (qx < 0 || qy < 0 || qx >= GW || qy >= GH) break; const q = wz[qy * GW + qx]; if (q > pz + 7) { shd = 1; break; } } }
      const wob = (A.vn(x / 26, y / 26, 91) - 0.5) * 0.10 + (A.vn(x / 7, y / 7, 93) - 0.5) * 0.04;
      t += wob; if (shd) t = Math.min(t, 0.05) - 0.06;
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
      const g1 = gs(Math.hypot(x - 1300, y - 250) / 58) * 0.62 + gs(Math.hypot(x - 1452, y - 372) / 40) * 0.45 + gs(Math.hypot(x - 1135, y - 150) / 34) * 0.3;
      if (b <= 3) cc = mix3(cc, glow, g1 * (b === 1 ? 0.6 : 1));
      // distance haze near the horizon
      const hz = ss(400, 500, y) * 0.55;
      if (hz > 0) cc = mix3(cc, skyCol(x, Math.min(y, 498)), hz * (b >= 4 ? 0.35 : 1));
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

  // ------------------------------------------------------------------ sea
  const cSeaDeep = hx('#20307e'), cSeaNear = hx('#2a2a70');
  function seaCol(x, y) {
    const d = y - HY;
    let col = skyAll(x + (A.vn(x / 30, y / 4, 3) - 0.5) * 30, HY - 4 - d * 3.0);
    col = mix3(col, cSeaDeep, 0.22 + 0.35 * ss(0, 90, d));
    // the sun's road on the water
    const w = 12 + d * 1.5, g = gs((x - SUNX) / w);
    col = mix3(col, hx('#ffd27a'), g * 0.75);
    return col;
  }

  // ================================================================== DRAWING
  function drawSky(C, rng) {
    const skyDir = (x, y) => {
      const d = Math.hypot(x - SUNX, y - HY), w = Math.exp(-d / 170);
      const ring = Math.atan2(y - HY, x - SUNX) + Math.PI / 2;
      let r = ring; while (r > Math.PI / 2) r -= Math.PI; while (r < -Math.PI / 2) r += Math.PI;
      return (-0.07 + 0.05 * Math.sin(x / 210 + y / 130)) * (1 - w) + r * w * 0.8;
    };
    // 1. the side of the stick, broad and fast
    A.field(C, rng, { box: [-60, -30, 1660, 520], sp: 24, order: 'scan', col: skyCol, dir: skyDir, len: [90, 240], w: [26, 44], p: [0.85, 1.05], med: M.pastel, sticks: PAS, spread: 0.035, wob: 2.2, dj: 0.06 });
    // 2. rubbed in with the heel of the hand, in long sweeps
    for (let y = 6; y < 520; y += 13) {
      const xy = []; const ph = rng() * 9;
      for (let x = -30; x <= 1630; x += 14) xy.push(x, y + Math.sin(x / 190 + ph) * 5 + rng.g() * 1.5);
      C.rub(rng() < 0.5 ? A.rev(xy) : xy, rng.r(20, 30), 0.5, 0.5);
    }
    // 3. a second pass with the side of the stick, lighter, then rubbed again here and there
    A.field(C, rng, { box: [-40, -20, 1640, 512], sp: 22, col: skyCol, dir: skyDir, len: [70, 190], w: [14, 26], p: [0.6, 0.85], med: M.pastel, sticks: PAS, spread: 0.05, wob: 1.6, dj: 0.08, prob: (x, y) => (cloudMask(x, y) ? 0.15 : 0.7) });
    for (let y = 10; y < 515; y += 21) {
      const xy = []; const ph = rng() * 9;
      for (let x = -30; x <= 1630; x += 14) xy.push(x, y + Math.sin(x / 150 + ph) * 6 + rng.g() * 2);
      C.rub(xy, rng.r(16, 24), 0.42, 0.55);
    }
    // 4. open diagonal hatching left visible -- the grain of the hand
    A.field(C, rng, { box: [-40, -20, 1640, 505], sp: 21, col: (x, y) => skyCol(x, y - 14), dir: () => -0.52, len: [40, 105], w: [4.5, 9], p: [0.42, 0.62], med: M.pastel, sticks: PAS, spread: 0.07, wob: 1.0, dj: 0.07, prob: (x, y) => (cloudMask(x, y) ? 0 : 0.5 * ss(505, 380, y) + 0.12) });
    // 5. high thin cloud catching the last pink
    const wisp = (x0, y0, len, rise, col, n, w) => {
      for (let k = 0; k < n; k++) {
        const ox = rng.g() * len * 0.18, oy = rng.g() * 3.2, l2 = len * rng.r(0.35, 1);
        const xy = []; for (let q = 0; q <= 8; q++) { const u = q / 8; xy.push(x0 + ox + (u - 0.5) * l2, y0 + oy - rise * (u - 0.5) + Math.sin(u * 3.1) * -3); }
        C.stroke(A.hand(rng, A.curve(xy, 4), { wob: 0.8, t0: 0.4, t1: 0.4, pe: 0.1 }), M.pastelTip, PAS.near(mix3(col, c.white, rng.r(0, 0.25)), rng, 0.05), w * rng.r(0.5, 1.2), rng.r(0.55, 0.95));
      }
    };
    wisp(250, 332, 330, 14, hx('#f9abc4'), 16, 4.5); wisp(470, 300, 250, 10, hx('#f283ae'), 11, 3.6); wisp(120, 268, 240, 8, hx('#c890c0'), 9, 3.5);
    wisp(560, 372, 260, 12, hx('#fdbd8c'), 14, 4); wisp(330, 392, 300, 9, hx('#fb9d6c'), 12, 3.4); wisp(700, 338, 190, 6, hx('#f9abc4'), 8, 3);
    wisp(90, 205, 210, 10, hx('#9c84d2'), 7, 3.2); wisp(640, 232, 180, 9, hx('#bfaee6'), 6, 2.8); wisp(820, 405, 160, 5, hx('#fee48e'), 9, 3);
    for (let k = 0; k < 26; k++) { const x = rng.r(60, 860), y = rng.r(210, 400); C.rub([x - 30, y, x, y + rng.g() * 2, x + 30, y - 2], 9, 0.3, 0.7); }
    // small evening cumulus low over the water: dusky on top, lit from underneath
    const small = (x, y, w, h) => {
      const n = Math.max(3, Math.round(w / (h * 0.85))), toSun = Math.sign(SUNX - x);
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1), px = x + (u - 0.5) * w, r = h * (0.4 + 0.6 * Math.sin(Math.PI * u)) * rng.r(0.75, 1.2);
        A.dot(C, rng, px, y - r * 0.55, M.pastel, PAS.near(mix3(skyCol(px, y), hx('#6a56a8'), 0.62), rng, 0.04), r * 1.7, 0.95);
        if (rng() < 0.6) A.dot(C, rng, px + rng.g() * r * 0.4, y - r * 1.05, M.pastelTip, PAS.near(mix3(skyCol(px, y), hx('#8478c8'), 0.6), rng, 0.04), r * 0.9, 0.85);
      }
      C.rub([x - w * 0.4, y - h * 0.7, x, y - h * 0.9, x + w * 0.4, y - h * 0.7], h * 0.7, 0.3, 0.6);
      for (let k = 0; k < n * 2.2; k++) {
        const u = rng(), px = x + (u - 0.5) * w * 0.96, near = toSun > 0 ? u : 1 - u, len = rng.r(3, 9) * (h / 10);
        const col = mix3(hx('#f283ae'), hx('#ffe08a'), clamp(near * 0.8 + gs((px - SUNX) / 300) * 0.5, 0, 1));
        A.line(C, rng, [px - len, y + rng.r(-1.2, 0.8) - h * 0.1 * Math.sin(Math.PI * u), px + len, y + rng.r(-1.2, 0.8) - h * 0.1 * Math.sin(Math.PI * u)], near > 0.6 ? M.oil : M.pastelTip, col, rng.r(1.3, 2.6) * (h / 10), rng.r(0.7, 1.0), { wob: 0.3, step: 3 });
      }
      const ex = x + toSun * w * 0.48; // the end that faces the sun burns
      for (let k = 0; k < 4; k++) A.dot(C, rng, ex + rng.g() * 2, y - h * rng.r(0.1, 0.7), M.oil, hx('#fff0c0'), rng.r(1.5, 2.6) * (h / 10), 0.95);
    };
    small(150, 464, 200, 15); small(362, 446, 120, 11); small(522, 475, 86, 8); small(48, 424, 130, 10); small(258, 408, 88, 7); small(604, 440, 66, 6); small(868, 454, 72, 7); small(455, 418, 54, 5);
  }

  function drawCloud(C, rng) {
    // block in, following the swell of each mass
    let cb0 = 0;
    A.field(C, rng, { box: [0, -10, 1640, 506], sp: 8.0, begin: (x, y) => { cb0 = cloudBand(x, y); }, mask: (x, y) => (cb0 > 0 && Math.abs(cloudBand(x, y) - cb0) <= (cb0 <= 2 ? 1 : 0) && cloudBand(x, y) > 0 ? 1 : 0), clip: true, follow: true, col: cloudCol, dir: cloudAng, len: [14, 50], w: [8, 18], p: [0.88, 1.12], med: M.pastel, sticks: PAS, spread: 0.04, wob: 1.0, dj: 0.2, stepL: 4, overP: 0.12 });
    // soften only the shadow side with a fingertip
    for (let k = 0; k < 900; k++) {
      const x = rng.r(780, 1620), y = rng.r(0, 500), b = cloudBand(x, y);
      if (b !== 2 && b !== 1) continue;
      const a = cloudAng(x, y), xy = [];
      for (let s = -16; s <= 16; s += 5) { const px = x + Math.cos(a) * s, py = y + Math.sin(a) * s; if (cloudBand(px, py) && cloudBand(px, py) <= 3) xy.push(px, py); }
      if (xy.length >= 4) C.rub(xy, rng.r(7, 13), 0.42, 0.6);
    }
    // restate: smaller, crisper, the scalloped lights
    let cb = 0;
    for (const [lo, hi, prob, sp] of [[1, 2, 0.45, 5.2], [3, 3, 1, 4.6], [4, 4, 1, 4.4], [0, 0, 0, 0], [5, 5, 1, 4.2]]) {
      if (!lo) { // a fingertip along the turning edge, so light melts into shade before the last crisp marks go on
        for (let k = 0; k < 2600; k++) { const x = rng.r(780, 1620), y = rng.r(0, 500), b = cloudBand(x, y); if (b !== 3 && b !== 4) continue; const a = cloudAng(x, y), xy = []; for (let q = -8; q <= 8; q += 4) xy.push(x + Math.cos(a) * q, y + Math.sin(a) * q); C.rub(xy, rng.r(4, 7), 0.34, 0.6); }
        continue;
      }
      A.field(C, rng, { box: [0, -10, 1640, 506], sp, dots: true, begin: (x, y) => { cb = cloudBand(x, y); }, mask: (x, y) => (cb >= lo && cb <= hi && cloudBand(x, y) === cb ? 1 : 0), clip: true, follow: true, col: cloudCol, dir: cloudAng, len: [8, 30], w: [3.6, 8.5], p: [0.7, 0.98], med: M.pastelTip, sticks: PAS, spread: lo >= 4 ? 0.05 : 0.03, wob: 0.6, dj: 0.25, stepL: 2.5, overP: 0.03, prob: () => prob });
    }
    // the creases between the swells, found with a dark pencil
    A.field(C, rng, { box: [780, -10, 1640, 500], sp: 4.5, begin: (x, y) => { cb = cloudBand(x, y); }, mask: (x, y) => (cb === 1 && cloudBand(x, y) === 1 ? 1 : 0), clip: true, follow: true, col: () => hx('#34307e'), dir: cloudAng, len: [6, 22], w: [1.2, 2.0], p: [0.6, 0.9], med: M.pencil, wob: 0.4, dj: 0.3, stepL: 2.5, overP: 0, prob: () => 0.5 });
    // the outlines of the swells, restated lightly: blue in the shade, rose in the light
    const isEdge = (x, y) => (x < 0 || y < 0 || x >= GW || y >= HY ? 0 : CL.edge[(y | 0) * GW + (x | 0)]);
    A.field(C, rng, { box: [780, -10, 1640, 500], sp: 5.5, mask: isEdge, clip: true, follow: true, col: (x, y) => { const b = cloudBand(x, y); return b >= 4 ? hx('#e8788c') : b === 3 ? hx('#8a4a90') : hx('#3f3f9a'); }, dir: (x, y) => CL.eang[(clamp(y, 0, GH - 1) | 0) * GW + (clamp(x, 0, GW - 1) | 0)], len: [10, 34], w: [1.1, 1.9], p: [0.5, 0.85], med: M.pencil, wob: 0.5, dj: 0.15, stepL: 2, overP: 0.5, prob: () => 0.55 });
    // pencil hatching to model the shadows
    A.field(C, rng, { box: [780, -10, 1640, 500], sp: 6.5, mask: cloudMask, clip: true, col: (x, y) => { const b = cloudBand(x, y); const cc = cloudCol(x, y); return b <= 2 ? mix3(cc, b === 1 ? c.navy : c.sky, 0.45) : null; }, dir: () => -0.95, len: [10, 26], w: [1.1, 1.7], p: [0.55, 0.85], med: M.pencil, wob: 0.4, dj: 0.08, prob: () => 0.55 });
    // thick waxy light on the rims that face the sun
    A.field(C, rng, { box: [0, -10, 1640, 500], sp: 4.6, mask: (x, y) => (cloudBand(x, y) === 5 ? 1 : 0), clip: true, follow: true, col: (x, y) => mix3(cloudCol(x, y), c.white, 0.35), dir: cloudAng, len: [5, 18], w: [2.4, 5], p: [0.7, 0.98], med: M.oil, wob: 0.4, dj: 0.2, stepL: 2.5, overP: 0.0, prob: () => 0.14 });
  }

  function drawSeaSun(C, rng) {
    const seaBot = 580;
    A.field(C, rng, { box: [-40, HY + 2, 1640, seaBot], sp: 10, order: 'scan', col: seaCol, dir: () => 0, len: [40, 150], w: [6, 13], p: [0.8, 1.0], med: M.pastel, sticks: PAS, spread: 0.04, wob: 0.8, dj: 0.02 });
    for (let y = HY + 6; y < seaBot; y += 9) { const xy = []; for (let x = -20; x <= 1620; x += 12) xy.push(x, y + rng.g()); C.rub(xy, 9, 0.4, 0.75); }
    A.field(C, rng, { box: [-40, HY + 1, 1640, seaBot], sp: 7, col: seaCol, dir: () => 0, len: [14, 70], w: [2.2, 5.5], p: [0.55, 0.85], med: M.pastelTip, sticks: PAS, spread: 0.07, wob: 0.5, dj: 0.02, prob: () => 0.7 });
    // far shore: islands and a headland in the haze
    const isl = (x0, x1, top, seed, col) => {
      const poly = [x0, HY + 1];
      for (let x = x0; x <= x1; x += 6) { const u = (x - x0) / (x1 - x0); poly.push(x, HY - top * Math.sin(Math.PI * u) ** 0.7 * (0.6 + 0.8 * A.fbm(x / 40, 1.5, 3, seed))); }
      poly.push(x1, HY + 1);
      A.hatch(C, rng, poly, { ang: 0.02, gap: 1.6, med: M.pastelTip, col, w: 2.6, p: 1.0, over: 0.5 });
    };
    isl(-30, 250, 15, 3, hx('#8a5a98')); isl(300, 470, 7, 5, hx('#b0708c')); isl(1040, 1180, 6, 9, hx('#70508e'));
    // the sun, half gone
    const sr = 27;
    for (let k = 0; k < 3; k++) for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += 0.5) {
      const r = sr * (1.5 - k * 0.2) + rng.g();
      C.stroke(A.hand(rng, [SUNX + Math.cos(a) * r, HY + Math.sin(a) * r, SUNX + Math.cos(a + 0.5) * r, HY + Math.sin(a + 0.5) * r], { wob: 0.4 }), M.pastel, [c.gold, c.lemon, c.cream][k], 14, 0.8);
    }
    C.rub([SUNX - 40, HY - 18, SUNX, HY - 34, SUNX + 40, HY - 18], 22, 0.45, 0.4);
    const sun = []; for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += 0.12) sun.push(SUNX + Math.cos(a) * sr, HY + Math.sin(a) * sr);
    A.hatch(C, rng, sun, { ang: 0.15, gap: 2.2, med: M.oil, col: hx('#fffbe2'), w: 5, p: 1.15, over: 0.3 });
    A.hatch(C, rng, sun, { ang: -0.6, gap: 3.0, med: M.oil, col: c.white, w: 4, p: 1.1, over: 0.2 });
    // glitter: short waxy dashes, crowding toward the middle
    for (let k = 0; k < 1500; k++) {
      const d = Math.pow(rng(), 1.5) * (seaBot - HY - 2), y = HY + 2 + d, w = 9 + d * 1.25;
      const x = SUNX + rng.g() * w * 0.75, u = Math.abs(x - SUNX) / w, len = rng.r(2, 5 + d * 0.16) * (1.2 - 0.5 * Math.min(1, u));
      const col = u < 0.5 ? (rng() < 0.6 ? c.white : c.lemon) : u < 1.0 ? (rng() < 0.5 ? c.gold : c.cream) : rng() < 0.5 ? c.orange : c.rose;
      C.stroke(A.hand(rng, [x - len, y, x + len, y + rng.g() * 0.3], { wob: 0.15, step: 3 }), M.oil, col, rng.r(0.9, 1.5 + d * 0.022), rng.r(0.7, 1.0));
    }
    // sparse sparkle farther out, where the pink of the sky rides the swell
    for (let k = 0; k < 900; k++) {
      const y = HY + 2 + Math.pow(rng(), 1.3) * (seaBot - HY - 4), x = rng.r(-10, 1610), len = rng.r(3, 16);
      const sc = skyAll(x, HY - 6 - (y - HY) * 2.5);
      C.stroke(A.hand(rng, [x - len, y, x + len, y + rng.g() * 0.4], { wob: 0.2, step: 4 }), M.pastelTip, mix3(sc, c.white, 0.25), rng.r(1.0, 2.2), rng.r(0.6, 0.95));
    }
  }


  // ================================================================== helpers for things with edges
  function inPoly(poly, x, y) {
    let inside = false;
    for (let i = 0, n = poly.length >> 1, j = n - 1; i < n; j = i++) {
      const xi = poly[i * 2], yi = poly[i * 2 + 1], xj = poly[j * 2], yj = poly[j * 2 + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function polySize(poly) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (let i = 0; i < poly.length; i += 2) { x0 = Math.min(x0, poly[i]); x1 = Math.max(x1, poly[i]); y0 = Math.min(y0, poly[i + 1]); y1 = Math.max(y1, poly[i + 1]); } return [x0, y0, x1, y1, Math.min(x1 - x0, y1 - y0)]; }
  // lay a shape in solidly: two directions of hatching with a blunt stick
  function solid(C, rng, poly, col, o) {
    o = o || {};
    const sz = polySize(poly)[4];
    const w = o.w || clamp(sz * 0.35, 1.2, 7), gap = o.gap || w * 0.5, ang = o.ang === undefined ? -0.62 : o.ang, med = o.med || M.conte, p = o.p || 1.05, over = o.over === undefined ? Math.min(0.8, w * 0.2) : o.over;
    A.hatch(C, rng, poly, { ang, gap, med, col, w, p, over, wob: 0.4, step: 5 });
    if (!o.single) A.hatch(C, rng, poly, { ang: ang + (o.cross || 1.15), gap: gap * 1.6, med, col, w, p: p * 0.92, over, wob: 0.4, step: 5 });
  }
  // go round a shape edge by edge, the way a pencil does: each side its own stroke, corners overshot
  function outline(C, rng, poly, col, w, p, o) {
    o = o || {};
    const n = poly.length >> 1;
    for (let i = 0; i < n; i++) {
      if (o.open && i === n - 1) break;
      const k = (i + 1) % n, ax = poly[i * 2], ay = poly[i * 2 + 1], bx = poly[k * 2], by = poly[k * 2 + 1];
      const L = Math.hypot(bx - ax, by - ay) || 1, ov = (o.ov === undefined ? 1.2 : o.ov) * rng(), ux = (bx - ax) / L, uy = (by - ay) / L;
      A.line(C, rng, [ax - ux * ov, ay - uy * ov, bx + ux * ov * rng(), by + uy * ov * rng()], o.med || M.pencil, col, w, p, { wob: o.wob === undefined ? 0.35 : o.wob, reps: o.reps || 1, off: 0.4, pe: 0.5 });
    }
  }
  const P4 = (a, b, cc, d) => [a[0], a[1], b[0], b[1], cc[0], cc[1], d[0], d[1]];
  function glow(C, rng, x, y, r, col, n, p) { // a soft halo: pastel laid in rings and rubbed round and round with a fingertip
    p = p || 0.55;
    for (let ring = 0; ring < 3; ring++) {
      const rr = r * (1 - ring * 0.3), m = Math.round((n || 8) * (1.6 - ring * 0.3));
      for (let k = 0; k < m; k++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr * 0.75; A.dot(C, rng, x + Math.cos(a) * d, y + Math.sin(a) * d, M.pastel, col, r * rng.r(0.3, 0.5), p * (0.75 + ring * 0.3)); }
      const xy = []; for (let a = 0; a < 18.9; a += 0.45) { const q = rr * 0.62 * (0.25 + 0.75 * a / 18.9); xy.push(x + Math.cos(a) * q, y + Math.sin(a) * q); }
      if (r < 50) { C.rub(xy, rr * 0.5, 0.7, 0.5); C.rub(A.rev(xy), rr * 0.42, 0.5, 0.5); } else C.rub(xy, rr * 0.5, 0.55, 0.5);
    }
  }
  function glint(C, rng, x, y, r, col) { // a four-pointed sparkle, upright
    A.line(C, rng, [x - r, y, x + r, y], M.pencil, col, 0.9, 0.9, { wob: 0.1, t0: 0.5, t1: 0.5, pe: 0.05 });
    A.line(C, rng, [x, y - r * 1.25, x, y + r * 1.25], M.pencil, col, 0.9, 0.9, { wob: 0.1, t0: 0.5, t1: 0.5, pe: 0.05 });
  }

  // ================================================================== stars, moon
  function drawStars(C, rng) {
    for (let k = 0; k < 260; k++) {
      const x = rng.r(0, 1600), y = Math.pow(rng(), 1.7) * 300;
      if (cloudMask(x, y) || cloudMask(x + 6, y) || cloudMask(x - 6, y)) continue;
      const b = rng();
      A.dot(C, rng, x, y, b > 0.75 ? M.oil : M.pastelTip, rng() < 0.3 ? c.ice : rng() < 0.5 ? c.cream : c.white, b > 0.75 ? rng.r(1.6, 2.6) : rng.r(0.9, 1.7), rng.r(0.6, 1.0) * ss(330, 120, y) + 0.25);
      if (b > 0.93) glint(C, rng, x, y, rng.r(4, 8), c.white);
    }
    // the first star of the evening, and a thin new moon
    glow(C, rng, 772, 96, 20, hx('#5a6fc8'), 5, 0.4);
    const mx = 772, my = 96, mr = 15, cres = [];
    const ta = 0.62; // the lit limb faces down-left, toward the sun
    for (let a = -1.45; a <= 1.45; a += 0.12) cres.push(mx + Math.cos(a + Math.PI - ta) * mr, my - Math.sin(a + Math.PI - ta) * mr);
    for (let a = 1.45; a >= -1.45; a -= 0.12) { const k = 0.55 + 0.45 * Math.abs(a) / 1.45; cres.push(mx + Math.cos(a + Math.PI - ta) * mr * k + Math.cos(-ta) * mr * (1 - k) * 0.3, my - Math.sin(a + Math.PI - ta) * mr * k - Math.sin(-ta) * mr * (1 - k) * 0.3); }
    A.hatch(C, rng, cres, { ang: 0.9, gap: 0.9, med: M.oil, col: c.cream, w: 1.6, p: 1.1, over: 0.15 });
    A.dot(C, rng, 236, 88, M.oil, c.white, 3.4, 1.1); glint(C, rng, 236, 88, 11, c.white); glow(C, rng, 236, 88, 9, hx('#6f94dc'), 3, 0.3);
    A.dot(C, rng, 236, 88, M.oil, c.white, 3.0, 1.1);
    // one falling star
    A.line(C, rng, [468, 38, 520, 60, 548, 73], M.pencil, c.ice, 1.1, 0.75, { wob: 0.2, t0: 0.85, t1: 0.05, pe: 0.05 });
    A.line(C, rng, [520, 60, 549, 73.5], M.pencil, c.white, 1.5, 1.0, { wob: 0.1, t0: 0.6, t1: 0.05, pe: 0.1 });
    A.dot(C, rng, 550, 74, M.oil, c.white, 2.4, 1.1);
  }

  // ================================================================== the town below
  const roofTints = ['#3a4a9a', '#2f5f8a', '#4a3f88', '#5a4a8e', '#2e3f86', '#6a4a80', '#3f6a94'].map(hx);
  const wallTints = ['#221d4a', '#2a2458', '#1d2050', '#322a5e', '#3a2f66', '#26204e', '#44376e'].map(hx);
  const winWarm = ['#ffd86a', '#ffc24e', '#ffab4a', '#ffe9a0', '#ff9a52'].map(hx);
  function roofShine(x) { const w = gs((x - SUNX) / 300); return mix3(hx('#8f95e0'), hx('#ffb894'), w); }
  function house(C, rng, h) {
    const z = h.z, x0 = h.xw - h.wd / 2, x1 = h.xw + h.wd / 2, g = gz(z) - 0.6, eave = gz(z) + h.h, zr = z + h.dp * 0.5, ridge = gz(zr) + h.h + h.rise + (gz(z) - gz(zr)) * 0.75;
    const a = pr(x0, g, z), b = pr(x1, g, z), e0 = pr(x0, eave, z), e1 = pr(x1, eave, z);
    const sc = F / z; // design units per metre here
    if (e1[0] < -30 || e0[0] > 1630) return;
    const wallC = mix3(h.wall ? hx(h.wall) : rng.pick(wallTints), skyCol(e0[0], 470), h.haze || 0);
    const tint = h.tint || rng.pick(roofTints);
    const big = sc > 9;
    // wall facing us, in shadow
    const wall = P4(a, b, e1, e0);
    if (h.gable) { const pk = pr(h.xw, ridge + 0.2, z); wall.splice(6, 0, pk[0], pk[1]); }
    solid(C, rng, wall, wallC, { w: clamp(sc * 0.5, 1.4, 6), single: !big });
    if (big) A.hatch(C, rng, wall, { ang: Math.PI / 2, gap: sc * 0.22, med: M.pencil, col: mix3(wallC, c.violet, 0.5), w: 1.0, p: 0.5, over: 0.5 });
    // roof
    let roof;
    if (h.flat) {
      const t0 = pr(x0 + 0.2, eave + 0.02, z + h.dp), t1 = pr(x1 - 0.2, eave + 0.02, z + h.dp);
      roof = P4(e0, e1, t1, t0);
      solid(C, rng, roof, mix3(roofShine(e0[0]), wallC, 0.25 + (h.haze || 0) * 0.3), { w: clamp(sc * 0.35, 1.2, 4), ang: 0.03, single: true, med: M.pastelTip, p: 0.9 });
    } else if (h.gable) {
      const pk = pr(h.xw, ridge + 0.2, z);
      const ov = 0.35;
      const l0 = pr(x0 - ov, eave - 0.15, z - 0.1), r0 = pr(x1 + ov, eave - 0.15, z - 0.1);
      A.line(C, rng, [l0[0], l0[1], pk[0], pk[1]], M.pastelTip, mix3(tint, roofShine(pk[0]), 0.6), clamp(sc * 0.3, 1.2, 3.4), 0.95, { wob: 0.2 });
      A.line(C, rng, [pk[0], pk[1], r0[0], r0[1]], M.pastelTip, mix3(tint, roofShine(pk[0]), 0.35), clamp(sc * 0.3, 1.2, 3.4), 0.95, { wob: 0.2 });
    } else {
      const r0 = pr(x0 + (h.hip ? h.wd * 0.18 : -0.3), ridge, zr), r1 = pr(x1 - (h.hip ? h.wd * 0.18 : -0.3), ridge, zr);
      const f0 = pr(x0 - 0.4, eave - 0.1, z - 0.3), f1 = pr(x1 + 0.4, eave - 0.1, z - 0.3);
      roof = P4(f0, f1, r1, r0);
      const rc = (x, y) => { const u = clamp((f0[1] - y) / Math.max(0.5, f0[1] - r0[1]), 0, 1); return mix3(mix3(tint, wallC, 0.2 + (h.haze || 0) * 0.3), roofShine(x), 0.12 + 0.62 * u * u * u + (rng() < 0.12 ? 0.25 : 0) + (h.haze || 0) * 0.3); };
      solid(C, rng, roof, rc, { w: clamp(sc * 0.3, 1.2, 4.2), ang: 0.0, single: true, med: M.pastelTip, p: 0.92, gap: clamp(sc * 0.16, 0.9, 2.4) });
      if (big) {
        // tile courses, ridge cap, and the wet edge catching the sky
        A.hatch(C, rng, roof, { ang: Math.PI / 2 + 0.12 * Math.sign(VX - (e0[0] + e1[0]) / 2), gap: sc * 0.3, med: M.pencil, col: mix3(tint, c.night, 0.55), w: 0.9, p: 0.55, over: 0.3 });
        A.line(C, rng, [r0[0], r0[1], r1[0], r1[1]], M.oil, mix3(roofShine(r0[0]), c.cream, 0.45), 1.5, 0.9, { wob: 0.25 });
        A.line(C, rng, [f0[0], f0[1] + 0.8, f1[0], f1[1] + 0.8], M.pencil, c.night, 1.4, 0.9, { wob: 0.25, reps: 2 });
      } else A.line(C, rng, [r0[0], r0[1], r1[0], r1[1]], M.pencil, mix3(roofShine(r0[0]), c.cream, 0.3), 0.9, 0.8, { wob: 0.15 });
    }
    // windows on the wall we can see
    const wh = e0[1] - a[1], nfl = Math.max(1, Math.round(h.h / 2.9)), wd = e1[0] - e0[0];
    const ncol = Math.max(1, Math.round(h.wd / (big ? 2.2 : 3.2)));
    for (let fl = 0; fl < nfl; fl++) for (let k = 0; k < ncol; k++) {
      if (rng() < 0.3) continue;
      const u = (k + 0.5 + rng.g() * 0.1) / ncol, wx = e0[0] + wd * u, wy = e0[1] + (fl + 0.5) / nfl * (h.h * sc) * 0.9;
      if (wy > YB - 3) continue;
      const lit = rng() < (h.lit === undefined ? 0.5 : h.lit);
      const ww = clamp(sc * rng.r(0.55, 1.0), 0.9, 30), hh = clamp(sc * rng.r(0.55, 0.9), 0.9, 24);
      const col = lit ? (rng() < 0.12 ? hx('#c8f0e6') : rng() < 0.08 ? hx('#a8c8ff') : rng.pick(winWarm)) : mix3(wallC, hx('#3f6aa8'), 0.5);
      if (ww < 3.2) { A.dot(C, rng, wx, wy, lit ? M.oil : M.pencil, col, Math.max(1.1, ww), lit ? 1.05 : 0.7); }
      else {
        const wp = [wx - ww / 2, wy - hh / 2, wx + ww / 2, wy - hh / 2, wx + ww / 2, wy + hh / 2, wx - ww / 2, wy + hh / 2];
        if (lit) { A.hatch(C, rng, wp, { ang: Math.PI / 2, gap: 1.0, med: M.oil, col, w: 1.8, p: 1.0, over: 0.2 }); A.hatch(C, rng, [wx - ww / 2, wy - hh / 2, wx + ww / 2, wy - hh / 2, wx + ww / 2, wy, wx - ww / 2, wy], { ang: 0.1, gap: 1.6, med: M.oil, col: c.cream, w: 1.2, p: 0.8, over: 0.1, skip: 0.3 }); }
        else A.hatch(C, rng, wp, { ang: -0.7, gap: 1.3, med: M.pencil, col, w: 1.2, p: 0.75, over: 0.2 });
        outline(C, rng, wp, c.night, 0.9, 0.8, { ov: 0.6 });
        if (ww > 7) { A.line(C, rng, [wx, wy - hh / 2, wx, wy + hh / 2], M.pencil, c.night, 0.9, 0.8, { wob: 0.1 }); }
      }
    }
    if (big) {
      outline(C, rng, wall, c.black, 1.1, 0.75, { ov: 1.5 });
      // what lives on roofs: an aerial, a tank
      if (!h.flat && !h.gable && rng() < 0.6) {
        const r0 = pr(h.xw + rng.r(-0.3, 0.3) * h.wd, ridge, zr), th = sc * rng.r(1.6, 2.6);
        A.line(C, rng, [r0[0], r0[1], r0[0] + rng.g() * 0.5, r0[1] - th], M.pencil, c.black, 1.0, 0.9, { wob: 0.15 });
        for (let q = 0; q < 4; q++) { const yy = r0[1] - th * (0.55 + q * 0.14), hw = sc * (0.5 - q * 0.07); A.line(C, rng, [r0[0] - hw, yy + 0.4, r0[0] + hw, yy - 0.4], M.pencil, c.black, 0.8, 0.85, { wob: 0.1 }); }
      }
    }
  }
  function tree(C, rng, x, y, r, haze) {
    const dark = mix3(hx('#16233f'), skyCol(x, 480), haze || 0), mid = mix3(hx('#1f4a4a'), skyCol(x, 480), haze || 0);
    const n = Math.max(5, Math.round(r * 1.4));
    for (let k = 0; k < n; k++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * r, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8; C.stroke(A.hand(rng, [px, py, px + rng.g() * r * 0.25, py + rng.g() * r * 0.2], { step: 3 }), M.conte, rng() < 0.3 ? mid : dark, Math.max(1.6, r * rng.r(0.3, 0.6)), 1.0); }
    // rim of last light on the sunward edge
    const sdir = Math.atan2(HY - y, SUNX - x);
    for (let k = 0; k < n * 0.35; k++) { const a = sdir + rng.g() * 0.55, px = x + Math.cos(a) * r * rng.r(0.85, 1.0), py = y + Math.sin(a) * r * 0.8 * rng.r(0.85, 1.0); A.dot(C, rng, px, py, M.pastelTip, rng() < 0.5 ? hx('#c8709a') : hx('#3f9a8a'), Math.max(0.8, r * 0.07), 0.7); }
  }
  function drawTown(C, rng) {
    // the hillside itself, dark, where no roof covers it
    solid(C, rng, [-10, 558, 1610, 558, 1610, YB + 6, -10, YB + 6], (x, y) => mix3(hx('#1b1840'), skyCol(x, 480), 0.16 * ss(YB, 558, y)), { w: 8, ang: 0.05, med: M.pastel, p: 1.0 });
    const rows = [512, 470, 425, 384, 345, 308, 274, 243, 215, 190, 168, 148, 130, 114, 100, 88, 79];
    for (const z of rows) {
      const span = 830 * z / F, hz = clamp((z - 70) / 800, 0, 0.5);
      let xw = -span - 6 + rng() * 8;
      while (xw < span + 6) {
        const wd = rng.r(6.5, 11.5) * (rng() < 0.09 ? 1.9 : 1);
        const cx = xw + wd / 2, zz = z + rng.r(-0.04, 0.04) * z;
        if (Math.abs(cx - 0.2) > wd / 2 + 4.4) {
          if (rng() < 0.11) { const t = gp(cx, zz, 3.2); tree(C, rng, t[0], t[1], F / zz * rng.r(2.2, 3.8), hz * 0.7); }
          else house(C, rng, { xw: cx, z: zz, wd, dp: rng.r(6, 9), h: wd > 14 ? rng.r(8.5, 13) : rng.r(5.0, 7.4), rise: rng.r(1.3, 2.3), flat: wd > 14 || rng() < 0.1, gable: rng() < 0.2, hip: rng() < 0.4, haze: hz, lit: 0.62 });
        }
        xw += wd + rng.r(1.0, 4.5);
      }
      if (z === 148 || z === 345) farRoad(C, rng, z === 345 ? 520 : 345, z === 345 ? 345 : 148);
    }
    farRoad(C, rng, 148, 77);
    // a quay and harbour lights at the foot of the hill
    const q0 = pr(-18, SEA + 1.2, 524), q1 = pr(40, SEA + 1.2, 530), q2 = pr(62, SEA + 1.2, 700), q3 = pr(-70, SEA + 1.2, 540), q4 = pr(-100, SEA + 1.2, 760);
    A.line(C, rng, [q0[0], q0[1], q1[0], q1[1], q2[0], q2[1]], M.pencil, c.night, 1.8, 1.0, { wob: 0.2, reps: 2 });
    A.line(C, rng, [q3[0], q3[1], q4[0], q4[1]], M.pencil, c.night, 1.6, 1.0, { wob: 0.2, reps: 2 });
    A.line(C, rng, [q2[0], q2[1], q2[0], q2[1] - 7], M.pencil, c.night, 1.6, 1.0, { wob: 0.1 }); A.dot(C, rng, q2[0], q2[1] - 8, M.oil, hx('#ff6a5a'), 2.2, 1.1);
    A.line(C, rng, [q4[0], q4[1], q4[0], q4[1] - 6], M.pencil, c.night, 1.4, 1.0, { wob: 0.1 }); A.dot(C, rng, q4[0], q4[1] - 7, M.oil, c.go, 2.0, 1.1);
    for (const b of [[200, 536, 7], [470, 528, 5], [905, 531, 6], [1150, 540, 8], [1420, 530, 5], [330, 543, 6], [60, 531, 5]]) {
      A.line(C, rng, [b[0] - b[2], b[1], b[0] + b[2], b[1] + 0.3], M.pencil, c.night, 1.7, 1.0, { wob: 0.15, reps: 2 });
      A.line(C, rng, [b[0] - 1, b[1], b[0] - 1, b[1] - b[2] * 1.2], M.pencil, c.night, 0.8, 0.9, { wob: 0.1 });
      A.dot(C, rng, b[0] - 1, b[1] - b[2] * 1.2, M.oil, c.cream, 1.3, 1.0);
      A.line(C, rng, [b[0] - 2, b[1] + 2.5, b[0] + 3, b[1] + 2.5], M.pastelTip, c.gold, 0.9, 0.6, { wob: 0.1 });
    }
    // the evening train crossing on its viaduct, every window lit
    { const zt = 205, y0 = gp(0, zt, 7.2)[1], sc = F / zt;
      A.line(C, rng, [-10, y0 + 2 + sc * 0.6, 1610, y0 + 2 + sc * 0.6], M.conte, hx('#1a173e'), sc * 0.9, 1.05, { wob: 0.3, reps: 2 });
      A.line(C, rng, [-10, y0 + 1.5, 1610, y0 + 1.5], M.pencil, hx('#8f88c8'), 0.9, 0.6, { wob: 0.3 });
      for (let x = 20; x < 1600; x += sc * 9) { A.line(C, rng, [x, y0 + sc * 0.6, x, y0 + sc * 5.5], M.pencil, hx('#1a173e'), sc * 0.5, 1.0, { wob: 0.15, reps: 2 }); A.line(C, rng, [x + sc * 3, y0 - sc * 3.6, x + sc * 3, y0 + 1], M.pencil, hx('#1a173e'), 0.8, 0.9, { wob: 0.1 }); }
      A.line(C, rng, [-10, y0 - sc * 3.4, 1610, y0 - sc * 3.4], M.pencil, hx('#1a173e'), 0.7, 0.8, { wob: 0.25 });
      let x = 842; const cl = sc * 16.5, ch = sc * 2.5;
      for (let car = 0; car < 5; car++) {
        const bx = [x, y0 - ch, x + cl, y0 - ch, x + cl, y0, x, y0];
        solid(C, rng, bx, car % 5 === 0 ? hx('#c8c0e4') : hx('#b0a8d8'), { w: 2.2, med: M.pastelTip, ang: 0.0, single: true });
        A.line(C, rng, [x, y0 - ch * 0.26, x + cl, y0 - ch * 0.26], M.pencil, hx('#e2553e'), 1.0, 0.85, { wob: 0.15 });
        for (let k = 0; k < 9; k++) A.dot(C, rng, x + cl * (k + 0.75) / 9.5, y0 - ch * 0.62, M.oil, k % 4 === 3 ? hx('#fff4c6') : hx('#ffe08a'), Math.max(1.3, ch * 0.42), 1.05);
        x += cl + sc * 0.7;
      }
      A.dot(C, rng, 842 - 1, y0 - ch * 0.4, M.oil, c.white, 1.8, 1.1); glint(C, rng, 841, y0 - ch * 0.4, 5, c.cream);
    }
    // a few shop signs, the colours of soda
    for (let k = 0; k < 46; k++) { const z = rng.r(90, 420), xw = rng.r(-1, 1) * 800 * z / F, q = gp(xw, z, rng.r(2.5, 8)); if (q[1] > YB - 5 || Math.abs(xw) < 5) continue; const sc = F / z, col = rng.pick(['#ff5a8a', '#3fe0d0', '#ff7a4a', '#7fb0ff', '#fff07a'].map(hx)); A.line(C, rng, [q[0], q[1], q[0] + (rng() < 0.5 ? sc * rng.r(0.8, 2.2) : 0), q[1] + (rng() < 0.5 ? sc * rng.r(0.8, 2) : 0)], M.oil, col, Math.max(1.1, sc * 0.3), 1.0, { wob: 0.1, pe: 0.8 }); }
    // street lamps scattered through the town, a greenish white
    for (let k = 0; k < 330; k++) { const z = rng.r(80, 515), xw = rng.r(-1, 1) * 830 * z / F, q = gp(xw, z, 4.5); if (q[1] > YB - 4 || Math.abs(xw) < 4) continue; A.dot(C, rng, q[0], q[1], M.oil, rng() < 0.7 ? hx('#d6fff0') : hx('#ffe9a0'), clamp(F / z * 0.16, 0.9, 2.2), 1.0); }
  }
  // the street below: wet, and catching the sky
  function farRoad(C, rng, z0, z1) {
    const poly = P4(gp(-2.8, z0), gp(3.2, z0), gp(3.2, z1), gp(-2.8, z1));
    for (let i = 1; i < 8; i += 2) poly[i] = Math.min(poly[i], YB + 2);
    solid(C, rng, poly, (x, y) => mix3(skyCol(x + (x - VX) * 3, 478 - (y - 560) * 1.2), hx('#231d52'), 0.34 + 0.3 * ss(600, 700, y)), { w: clamp(F / z1 * 0.6, 1.4, 7), ang: Math.PI / 2 - 0.05, med: M.pastelTip, p: 1.0, single: true });
    const a = gp(0.2, z0), b = gp(0.2, z1);
    A.line(C, rng, [a[0], a[1], b[0], Math.min(b[1], YB)], M.oil, c.cream, clamp(F / z1 * 0.12, 0.9, 1.8), 0.85, { wob: 0.2 });
  }

  // signal heads: Japanese, horizontal; the left lamp is the green one
  function signalHead(C, rng, cx, cy, w, lit) {
    const h = w * 0.36, r = h * 0.36;
    if (w > 12) glow(C, rng, cx - w * 0.31, cy, w * 0.55, hx('#2fd0a0'), 9, 0.5);
    else { A.dot(C, rng, cx - w * 0.31, cy, M.pastel, hx('#2fd0a0'), Math.max(5, w * 1.5), 0.45); }
    const box = [cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2];
    if (w > 6) solid(C, rng, box, hx('#15133a'), { w: Math.max(1.2, h * 0.3) });
    else A.line(C, rng, [cx - w / 2, cy, cx + w / 2, cy], M.pencil, hx('#15133a'), Math.max(1.2, h), 1.0, { wob: 0.1 });
    if (w > 20) outline(C, rng, box, c.black, 1.2, 0.9, { reps: 2 });
    for (let k = 0; k < 3; k++) {
      const lx = cx + (k - 1) * w * 0.31;
      if (k === 0) {
        A.dot(C, rng, lx, cy, M.oil, c.goDeep, Math.max(1.6, r * 2.3), 1.1);
        A.dot(C, rng, lx, cy, M.oil, c.go, Math.max(1.3, r * 1.8), 1.1);
        A.dot(C, rng, lx - r * 0.1, cy - r * 0.1, M.oil, c.goHi, Math.max(0.9, r * 1.0), 1.1);
        if (w > 20) { A.dot(C, rng, lx - r * 0.2, cy - r * 0.25, M.oil, c.white, r * 0.5, 1.1); }
      } else if (w > 12) {
        A.dot(C, rng, lx, cy, M.pencil, k === 1 ? hx('#5a4a30') : hx('#5a2838'), r * 1.9, 0.9);
        if (w > 30) A.line(C, rng, [lx - r * 0.5, cy - r * 0.4, lx, cy - r * 0.6], M.pencil, hx('#8f88c0'), 0.8, 0.6, { wob: 0.1 });
      }
      if (w > 30) { // the hoods
        const hd = []; for (let a = Math.PI; a <= 2 * Math.PI + 0.01; a += 0.3) hd.push(lx + Math.cos(a) * r * 1.25, cy + Math.sin(a) * r * 1.25 - r * 0.1);
        A.line(C, rng, A.curve(hd, 3), M.pencil, c.black, 1.6, 1.0, { wob: 0.1, reps: 2 });
        A.line(C, rng, A.curve(hd.map((v, i) => (i % 2 ? v - 1.2 : v)), 3), M.pencil, hx('#ff9aa8'), 0.7, 0.55, { wob: 0.1 });
      }
    }
  }
  function signal(C, rng, z, k) {
    k = k || 1;
    const base = gp(-3.2, z, 0), top = gp(-3.2, z, 6.4), arm0 = gp(-3.2, z, 5.9), arm1 = gp(-0.25, z, 6.0), hd = gp(-1.0, z, 5.35), sc = F / z;
    const pc = hx('#1a1a40');
    A.line(C, rng, [base[0], Math.min(base[1], YB + 1), top[0], top[1]], M.conte, pc, Math.max(1.3, sc * 0.17), 1.05, { wob: 0.25, reps: 2, off: 0.3 });
    A.line(C, rng, A.curve([arm0[0], arm0[1], (arm0[0] + arm1[0]) / 2, arm0[1] - sc * 0.25, arm1[0], arm1[1]], 6), M.conte, pc, Math.max(1.1, sc * 0.1), 1.05, { wob: 0.2, reps: 2, off: 0.3 });
    A.line(C, rng, [base[0], top[1] + sc * 1.6, (arm0[0] + arm1[0]) / 2, arm0[1] - sc * 0.2], M.pencil, pc, Math.max(0.8, sc * 0.04), 0.9, { wob: 0.2 }); // the stay
    if (sc > 20) { // last light along the sunward side of the pole
      A.line(C, rng, [base[0] + sc * 0.07, Math.min(base[1], YB) - 4, top[0] + sc * 0.07, top[1] + 4], M.pencil, hx('#ff9a8a'), 0.9, 0.6, { wob: 0.25 });
      A.line(C, rng, [hd[0], arm1[1], hd[0], hd[1] - sc * 0.18], M.pencil, pc, 1.6, 1.0, { wob: 0.1, reps: 2 });
    }
    signalHead(C, rng, hd[0], hd[1], 1.25 * sc * k, true);
  }
  function drawFarSignals(C, rng) {
    for (const [z, k] of [[480, 1.55], [350, 1.5], [250, 1.45], [175, 1.35], [120, 1.25], [80, 1.15]]) {
      signal(C, rng, z, k);
      const g = gp(-1.2, z, 0), sc = F / z; // its green on the wet road
      A.line(C, rng, [g[0], g[1] - sc * 1.2, g[0] + 0.3, Math.min(YB, g[1] + sc * 2.6)], M.pastelTip, c.go, Math.max(1.0, sc * 0.32), 0.8, { wob: 0.2, t0: 0.1, t1: 0.6 });
    }
  }
  const POLEX = -4.4, pcol = hx('#17153a');
  function pole(C, rng, z) {
    const b = gp(POLEX, z, 0), t = gp(POLEX, z, 9.4), sc = F / z;
    A.line(C, rng, [b[0], Math.min(YB + 1, b[1]), t[0], t[1]], M.conte, pcol, Math.max(1.4, sc * 0.26), 1.05, { wob: 0.25, reps: 2, off: 0.3 });
    for (const hh of [8.7, 7.9]) { const m = gp(POLEX, z, hh); A.line(C, rng, [m[0] - sc * 0.8, m[1] + 0.5, m[0] + sc * 0.8, m[1] - 0.5], M.pencil, pcol, Math.max(1.0, sc * 0.09), 1.0, { wob: 0.1, reps: 2 }); }
    const tr = gp(POLEX, z, 6.6); if (sc > 20) { solid(C, rng, [tr[0] + sc * 0.2, tr[1] - sc * 0.5, tr[0] + sc * 0.75, tr[1] - sc * 0.5, tr[0] + sc * 0.75, tr[1] + sc * 0.45, tr[0] + sc * 0.2, tr[1] + sc * 0.45], pcol, { w: 2 }); }
  }
  function drawSlope(C, rng) {
    // tree tops rising from the steep ground just under the brow
    tree(C, rng, 470, 700, 26, 0); tree(C, rng, 905, 706, 30, 0); tree(C, rng, 1150, 690, 44, 0); tree(C, rng, 330, 712, 20, 0); tree(C, rng, 800, 712, 13, 0);
    pole(C, rng, 180); pole(C, rng, 128); pole(C, rng, 92); pole(C, rng, 64); pole(C, rng, 44);
    wires(C, rng, 180, 128); wires(C, rng, 128, 92); wires(C, rng, 92, 64); wires(C, rng, 64, 44);
    signal(C, rng, 44); signal(C, rng, 26);
    pole(C, rng, 26); wires(C, rng, 44, 26);
  }
  function wires(C, rng, za, zb, near) {
    const pc = pcol;
    for (const off of [-0.72, 0, 0.72]) for (const hh of [8.7, 7.9]) {
      if (hh === 7.9 && off === 0) continue;
      const a = gp(POLEX + off, za, hh), b = gp(POLEX + off, zb, hh), xy = [];
      for (let k = 0; k <= 14; k++) { const u = k / 14, sag = Math.sin(Math.PI * u) * Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.035; xy.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + sag); }
      A.line(C, rng, A.curve(xy, 3), M.pencil, pc, near ? 1.25 : 0.8, 0.95, { wob: 0.25, t0: 0.02, t1: 0.02, pj: 0.3 });
    }
  }


  // ================================================================== the brow of the hill: wet road
  function groundCol(x, y) {
    const z = F * EYE / Math.max(1, y - YV), xw = (x - VX) * z / F;
    const yr = 2 * YV - y;
    const rf = skyAll(x + (A.vn(x / 9, y / 50, 11) - 0.5) * 8, yr + (A.vn(x / 22, y / 9, 17) - 0.5) * 26);
    const pud = ss(0.47, 0.6, A.fbm(xw / 1.5 + 3, z / 2.0, 3, 23));
    const onRoad = (xw > -2.6 && xw < 3.0) || (z > 8.6 && z < 11.1);
    const far = ss(800, YB, y);
    let R = 0.08 + 0.36 * pud + 0.34 * far * far;
    let base = onRoad ? [0.07, 0.062, 0.165] : [0.115, 0.10, 0.215];
    if (!onRoad) R *= 0.65;
    let col = mix3(base, rf, R);
    if (xw < 4.4) { const w = gs((xw - 4.1) / 2.9) * ss(4.4, 5.6, z) * ss(9.8, 8.2, z); col = mix3(col, [1, 0.66, 0.34], w * 0.6 * (0.55 + 0.45 * pud)); }
    const vw = gs((x - 240) / 56) * ss(YB - 2, YB + 8, y) * ss(840, YB + 8, y); col = mix3(col, [0.62, 0.92, 1.0], vw * 0.42);
    const gw = gs((x - 545 - (y - YB) * 0.03) / (12 + (y - YB) * 0.1)) * ss(YB - 4, YB + 26, y); col = mix3(col, [0.2, 0.86, 0.66], gw * 0.3);
    const sw = gs((x - SUNX) / (34 + (y - YB) * 0.4)) * ss(895, YB, y); col = mix3(col, [1, 0.8, 0.5], sw * 0.6);
    return col;
  }
  const gq = (x0, x1, z0, z1) => P4(gp(x0, z0), gp(x1, z0), gp(x1, z1), gp(x0, z1));
  function drawGround(C, rng) {
    const toVP = (x, y) => Math.atan2(y - YV, x - VX);
    A.field(C, rng, { box: [-40, YB + 3, 1640, 930], sp: 12, col: groundCol, dir: (x, y) => (rng() < 0.5 ? 0.02 : toVP(x, y)), len: [40, 130], w: [8, 17], p: [0.85, 1.05], med: M.pastel, sticks: PAS, spread: 0.035, wob: 1.0, dj: 0.04, clip: true, overP: 0.04, mask: (x, y) => (y > YB + 1 ? 1 : 0) });
    for (let k = 0; k < 120; k++) { const x = rng.r(-10, 1610), y = rng.r(YB + 12, 900), xy = []; for (let q = -30; q <= 30; q += 10) xy.push(x + rng.g(), y + q); C.rub(xy, rng.r(8, 14), 0.4, 0.7); }
    // the reflections hang straight down
    A.field(C, rng, { box: [-40, YB + 4, 1640, 930], sp: 8, col: groundCol, dir: () => Math.PI / 2, len: [12, 58], w: [2.6, 6.5], p: [0.55, 0.85], med: M.pastelTip, sticks: PAS, spread: 0.04, wob: 0.5, dj: 0.03, prob: () => 0.5, clip: true, overP: 0.04, mask: (x, y) => (y > YB + 2 ? 1 : 0) });
    // the grain of the asphalt, the skin of the puddles
    A.field(C, rng, { box: [-40, YB + 4, 1640, 930], sp: 10, col: (x, y) => mix3(groundCol(x, y), hx('#b8b0e8'), 0.14), dir: () => 0.0, len: [6, 34], w: [1.2, 2.6], p: [0.45, 0.75], med: M.pastelTip, wob: 0.3, dj: 0.03, prob: () => 0.3, clip: true, overP: 0.04, mask: (x, y) => (y > YB + 2 ? 1 : 0) });
    // the sun's road carries on across the wet asphalt, broken into dashes
    for (let k = 0; k < 330; k++) {
      const d = Math.pow(rng(), 1.7) * 150, y = YB + 3 + d, w = 30 + d * 0.5, x = SUNX + rng.g() * w * 0.7, u = Math.abs(x - SUNX) / w, len = rng.r(3, 9 + d * 0.12);
      const col = u < 0.45 ? (rng() < 0.5 ? c.cream : c.gold) : u < 0.9 ? (rng() < 0.5 ? hx('#fdbd8c') : c.rose) : hx('#c890c0');
      A.line(C, rng, [x - len, y, x + len, y + rng.g() * 0.4], rng() < 0.4 ? M.oil : M.pastelTip, col, rng.r(1.0, 2.0 + d * 0.012), rng.r(0.55, 0.95) * (1 - d / 190), { wob: 0.2, step: 4 });
    }
    // dark things stand on their own reflections
    const refl = (x, y0, len, w, col, n) => { for (let k = 0; k < (n || 14); k++) { const px = x + rng.g() * w * 0.5, a = y0 + rng() * len * 0.5, b = a + rng.r(0.15, 0.6) * len; A.line(C, rng, [px, a, px + rng.g() * 1.5, Math.min(898, b)], M.conte, col, rng.r(1.6, 3.6), rng.r(0.5, 0.9) * (1 - (a - y0) / len * 0.6), { wob: 0.5, t1: 0.6 }); } };
    refl(gp(-3.2, 11.3)[0], YB + 4, 170, 9, hx('#12103a'), 20); refl(gp(3.5, 11.2)[0], YB + 6, 120, 5, hx('#3a1f3a'), 10);
    for (const zz of [8.4, 7.25, 6.15]) { const q = gp(4.1, zz, 0); refl(q[0] - 4, q[1] + 4, 90, 8, hx('#1a1230'), 10); }
    // paint on the road: worn, wet, taking the colour of the sky
    const paint = (x, y) => mix3(mix3(groundCol(x, y), hx('#cfc6ee'), 0.66), c.night, rng() < 0.1 ? 0.3 : 0);
    const mark = (poly, o) => { A.hatch(C, rng, poly, Object.assign({ ang: Math.atan2(poly[7] - poly[1], poly[6] - poly[0]), gap: 2.0, med: M.pastelTip, col: paint, w: 3.6, p: 0.85, over: 0.6, skip: 0.06 }, o || {})); };
    for (let k = 0; k < 6; k++) { const x0 = -2.25 + k * 0.92; mark(gq(x0, x0 + 0.46, 6.25, 8.2)); }
    mark(gq(-2.4, 0.1, 5.62, 5.95), { ang: 0.02 });                                   // stop line
    mark(gq(-2.52, -2.4, 5.4, 8.5)); mark(gq(2.8, 2.92, 5.4, 8.5));                    // edge lines
    A.hatch(C, rng, gq(0.14, 0.26, 5.4, 6.1), { ang: Math.PI / 2, gap: 1.6, med: M.pastelTip, col: (x, y) => mix3(groundCol(x, y), c.amber, 0.7), w: 3, p: 0.9, over: 0.5 }); // centre line
    for (let k = 0; k < 6; k++) { const x0 = -2.25 + k * 0.92; mark(gq(x0, x0 + 0.46, 11.15, 11.48), { w: 2 }); }
    // kerbs
    const kerb = (xw, z0, z1) => { const a = gp(xw, z0, 0.14), b = gp(xw, z1, 0.14); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, c.night, 2.2, 1.0, { wob: 0.4, reps: 2 }); A.line(C, rng, [a[0], a[1] - 2, b[0], b[1] - 1], M.pastelTip, hx('#9c84d2'), 1.6, 0.6, { wob: 0.4 }); };
    kerb(-2.62, 5.3, 8.55); kerb(3.02, 5.3, 8.55);
    // the lip of the hill, where the road lets go
    A.line(C, rng, [gp(-2.6, ZB)[0], YB, gp(3.0, ZB)[0], YB], M.pastelTip, hx('#ffd9a0'), 1.8, 0.8, { wob: 0.5 });
    for (const [xa, xb] of [[-60, -2.6], [3.0, 60]]) { const a = gp(xa, ZB - 0.2, 0.2), b = gp(xb, ZB - 0.2, 0.2); A.line(C, rng, [a[0], YB - 1, b[0], YB - 1], M.conte, hx('#141236'), 5, 1.05, { wob: 0.6, reps: 2 }); A.line(C, rng, [a[0], YB - 4, b[0], YB - 4], M.pencil, hx('#b08ad0'), 1.0, 0.6, { wob: 0.5 }); }
    // weeds along the edge
    for (let k = 0; k < 260; k++) { let x = rng.r(-10, 1610); if (x > gp(-2.6, ZB)[0] - 6 && x < gp(3.0, ZB)[0] + 6) continue; const hgt = rng.r(3, 13), y = YB - 1 + rng.r(-1, 2); A.line(C, rng, [x, y, x + rng.g() * 2.5, y - hgt], M.pencil, rng() < 0.3 ? hx('#5a9a58') : rng() < 0.5 ? hx('#1f4a3c') : c.night, rng.r(0.8, 1.4), 0.9, { wob: 0.3, t1: 0.6 }); }
  }

  // ================================================================== a vending machine, humming to itself; a cat
  function drawCorner(C, rng) {
    const z = 11.2, a = gp(-5.0, z, 0), b = gp(-4.0, z, 0), t0 = gp(-5.0, z, 1.83), t1 = gp(-4.0, z, 1.83), s1 = gp(-4.0, z + 0.7, 0), st = gp(-4.0, z + 0.7, 1.83);
    const X0 = a[0], X1 = b[0], Yb = a[1], Yt = t0[1], w = X1 - X0, hgt = Yb - Yt;
    solid(C, rng, [X1, Yb, s1[0], s1[1], st[0], st[1], X1, Yt], hx('#101035'), { w: 3 });
    solid(C, rng, [X0, Yb, X1, Yb, X1, Yt, X0, Yt], hx('#1c2a6a'), { w: 5 });
    // the lit window with its three shelves
    const wx0 = X0 + w * 0.09, wx1 = X1 - w * 0.09, wy0 = Yt + hgt * 0.1, wy1 = Yt + hgt * 0.58;
    const win = [wx0, wy0, wx1, wy0, wx1, wy1, wx0, wy1];
    A.hatch(C, rng, win, { ang: Math.PI / 2, gap: 1.5, med: M.pastelTip, col: hx('#d8fbff'), w: 3.2, p: 1.05, over: 0.3 });
    A.hatch(C, rng, win, { ang: 0.0, gap: 2.2, med: M.oil, col: hx('#f4ffff'), w: 2.4, p: 0.9, over: 0.2, skip: 0.15 });
    const cans = ['#e2553e', '#f7b63a', '#2f8f6a', '#3857b6', '#f283ae', '#fffbe8', '#7a5cb8', '#1b8a98', '#fb9d6c'].map(hx);
    for (let r = 0; r < 3; r++) {
      const yy = wy0 + (wy1 - wy0) * (r + 0.72) / 3;
      A.line(C, rng, [wx0, yy + 1.5, wx1, yy + 1.5], M.pencil, hx('#4d76cc'), 1.0, 0.8, { wob: 0.15 });
      for (let k = 0; k < 7; k++) { const xx = wx0 + (wx1 - wx0) * (k + 0.5) / 7; A.line(C, rng, [xx, yy, xx + rng.g() * 0.2, yy - (wy1 - wy0) * 0.19], M.oil, rng.pick(cans), w * 0.07, 1.05, { wob: 0.1, t0: 0.05, t1: 0.05, pe: 0.8 }); }
      for (let k = 0; k < 7; k++) { const xx = wx0 + (wx1 - wx0) * (k + 0.5) / 7; A.dot(C, rng, xx, yy + 4.2, M.oil, rng() < 0.85 ? hx('#7fe8ff') : hx('#ff6a5a'), 1.2, 1.0); }
    }
    outline(C, rng, win, c.night, 1.2, 0.9, { reps: 2 });
    // the band along the top, the coin slot, the hatch at the bottom
    A.hatch(C, rng, [X0 + 2, Yt + 2, X1 - 2, Yt + 2, X1 - 2, wy0 - 3, X0 + 2, wy0 - 3], { ang: 0.0, gap: 1.6, med: M.pastelTip, col: hx('#e2553e'), w: 2.6, p: 0.9, over: 0.3 });
    A.line(C, rng, [X0 + 6, (Yt + wy0) / 2, X1 - 6, (Yt + wy0) / 2], M.oil, c.white, 1.6, 0.9, { wob: 0.2 });
    A.dot(C, rng, X1 - w * 0.2, wy1 + hgt * 0.1, M.oil, hx('#ffb04a'), 2.6, 1.05); A.dot(C, rng, X1 - w * 0.2, wy1 + hgt * 0.16, M.oil, hx('#7fe8ff'), 1.8, 1.05);
    solid(C, rng, [X0 + w * 0.15, Yb - hgt * 0.2, X1 - w * 0.3, Yb - hgt * 0.2, X1 - w * 0.3, Yb - hgt * 0.09, X0 + w * 0.15, Yb - hgt * 0.09], hx('#0c0b28'), { w: 2.5 });
    outline(C, rng, [X0, Yb, X1, Yb, X1, Yt, X0, Yt], c.black, 1.5, 0.95, { reps: 2 });
    A.line(C, rng, [X1 + 0.5, Yt + 3, X1 + 0.5, Yb - 3], M.pencil, hx('#ff9a8a'), 1.0, 0.7, { wob: 0.25 });
    // its light on the wet ground
    for (let k = 0; k < 46; k++) { const x = rng.r(X0 - 6, X1 + 14), y0 = Yb + 2 + rng() * 10, len = rng.r(10, 70) * gs((x - (X0 + X1) / 2) / 60); A.line(C, rng, [x, y0, x + rng.g(), y0 + len], M.pastelTip, rng() < 0.5 ? hx('#c8f6ff') : hx('#7fd8e8'), rng.r(1.4, 3), rng.r(0.5, 0.85), { wob: 0.3, t1: 0.6 }); }
    // the cat, watching the sky
    const cz = 11.3, g = gp(-4.28, cz, 1.84), sc = F / cz, cx = g[0], cy = g[1], k = sc * 0.46;
    const body = [], cc = hx('#0d0b22');
    for (let q = 0; q <= 20; q++) { const a2 = q / 20 * 6.283; body.push(cx + Math.cos(a2) * k * 0.3 * (1 - 0.25 * Math.sin(a2)), cy - k * 0.36 + Math.sin(a2) * k * 0.38); }
    solid(C, rng, body, cc, { w: 3 });
    const hx0 = cx + k * 0.1, hy0 = cy - k * 0.86, hr = k * 0.19, head = [];
    for (let q = 0; q <= 14; q++) { const a2 = q / 14 * 6.283; head.push(hx0 + Math.cos(a2) * hr * 1.1, hy0 + Math.sin(a2) * hr); }
    solid(C, rng, head, cc, { w: 2.4 });
    solid(C, rng, [hx0 - hr * 1.0, hy0 - hr * 0.35, hx0 - hr * 0.75, hy0 - hr * 1.75, hx0 - hr * 0.1, hy0 - hr * 0.85], cc, { w: 1.6 });
    solid(C, rng, [hx0 + hr * 0.15, hy0 - hr * 0.85, hx0 + hr * 0.85, hy0 - hr * 1.7, hx0 + hr * 1.05, hy0 - hr * 0.3], cc, { w: 1.6 });
    A.line(C, rng, A.curve([cx - k * 0.22, cy - k * 0.06, cx - k * 0.55, cy - k * 0.02, cx - k * 0.72, cy - k * 0.2, cx - k * 0.62, cy - k * 0.42], 6), M.conte, cc, 2.6, 1.05, { wob: 0.2, reps: 2 });
    A.line(C, rng, A.curve([hx0 - hr * 0.9, hy0 - hr * 1.6, hx0 - hr * 1.15, hy0 - hr * 0.3, cx - k * 0.3, cy - k * 0.5, cx - k * 0.32, cy - k * 0.15], 6), M.pencil, hx('#b08ad0'), 0.9, 0.6, { wob: 0.2 }); // the cool of the evening on its back
    A.line(C, rng, A.curve([hx0 + hr * 0.9, hy0 - hr * 1.55, hx0 + hr * 1.15, hy0 - hr * 0.2, cx + k * 0.28, cy - k * 0.5], 6), M.pencil, hx('#ffb09a'), 0.9, 0.7, { wob: 0.2 }); // rim from the west
  }

  // ================================================================== the near signal, big against the sky
  function drawSignal1(C, rng) {
    const z = 11.3, sc = F / z, base = gp(-3.2, z, 0), top = gp(-3.2, z, 6.45), arm0 = gp(-3.2, z, 5.95), arm1 = gp(-0.2, z, 6.05), hd = gp(-1.0, z, 5.36);
    const pc = hx('#191942'), w = 1.25 * sc, h = w * 0.36, cx = hd[0], cy = hd[1];
    // glow first, so the dark metal sits in it
    const gx = cx - w * 0.31;
    glow(C, rng, gx, cy, 74, hx('#1fa890'), 16, 0.42); glow(C, rng, gx, cy, 44, hx('#3fd8ae'), 12, 0.5);
    // pole: a tapering steel tube, lit down one side
    const pw = sc * 0.2;
    solid(C, rng, [base[0] - pw / 2, base[1], base[0] + pw / 2, base[1], top[0] + pw * 0.36, top[1], top[0] - pw * 0.36, top[1]], pc, { w: 4, ang: Math.PI / 2 - 0.05 });
    A.line(C, rng, [base[0] + pw * 0.3, base[1] - 6, top[0] + pw * 0.22, top[1] + 6], M.pastelTip, hx('#ff9a8a'), 1.5, 0.6, { wob: 0.3 });
    A.line(C, rng, [base[0] - pw * 0.3, base[1] - 6, top[0] - pw * 0.22, top[1] + 6], M.pencil, hx('#4d76cc'), 1.0, 0.5, { wob: 0.3 });
    for (const hh of [0.5, 1.4]) { const q = gp(-3.2, z, hh); A.line(C, rng, [q[0] - pw * 0.55, q[1], q[0] + pw * 0.55, q[1]], M.pencil, c.black, 1.6, 1.0, { wob: 0.1, reps: 2 }); }
    solid(C, rng, [base[0] - pw * 1.1, gp(-3.2, z, 1.25)[1], base[0] - pw * 0.4, gp(-3.2, z, 1.25)[1], base[0] - pw * 0.4, gp(-3.2, z, 0.8)[1], base[0] - pw * 1.1, gp(-3.2, z, 0.8)[1]], hx('#22225a'), { w: 2 }); // the control box
    // arm with its stay
    const armc = A.curve([arm0[0], arm0[1], arm0[0] + 60, arm0[1] - 16, (arm0[0] + arm1[0]) / 2, arm0[1] - 19, arm1[0], arm1[1] - 3], 8);
    A.line(C, rng, armc, M.conte, pc, sc * 0.085, 1.05, { wob: 0.3, reps: 3, off: 0.5 });
    A.line(C, rng, armc.map((v, i) => (i % 2 ? v - 2.4 : v)), M.pencil, hx('#f283ae'), 0.9, 0.55, { wob: 0.3 });
    A.line(C, rng, [top[0], top[1] + 8, (arm0[0] + arm1[0]) / 2 + 30, arm0[1] - 20], M.pencil, pc, 1.3, 0.95, { wob: 0.3, reps: 2 });
    for (const ox of [-w * 0.3, w * 0.3]) A.line(C, rng, [cx + ox, arm1[1] - 12, cx + ox, cy - h * 0.5], M.pencil, pc, 2.2, 1.0, { wob: 0.15, reps: 2 });
    // the head: back plate, three hoods, one lamp alive
    const bx = [cx - w / 2, cy - h / 2, cx + w / 2, cy - h / 2, cx + w / 2, cy + h / 2, cx - w / 2, cy + h / 2];
    solid(C, rng, bx, hx('#12113a'), { w: 5 });
    A.hatch(C, rng, bx, { ang: -0.7, gap: 3.2, med: M.pencil, col: hx('#3b3a7e'), w: 1.1, p: 0.5, over: 0.4 });
    outline(C, rng, bx, c.black, 1.7, 1.0, { reps: 2, ov: 2 });
    A.line(C, rng, [cx - w / 2, cy - h / 2 - 1, cx + w / 2, cy - h / 2 - 1], M.pencil, hx('#f9abc4'), 1.0, 0.7, { wob: 0.25 });
    const r = h * 0.37;
    for (let k = 0; k < 3; k++) {
      const lx = cx + (k - 1) * w * 0.31, circ = (rr) => { const o = []; for (let a2 = 0; a2 < 6.2; a2 += 0.35) o.push(lx + Math.cos(a2) * rr, cy + Math.sin(a2) * rr); return o; };
      if (k === 0) {
        A.hatch(C, rng, circ(r * 1.02), { ang: 0.6, gap: 1.3, med: M.oil, col: c.goDeep, w: 2.6, p: 1.05, over: 0.3 });
        A.hatch(C, rng, circ(r * 0.86), { ang: -0.5, gap: 1.3, med: M.oil, col: c.go, w: 2.4, p: 1.05, over: 0.2 });
        A.hatch(C, rng, circ(r * 0.55), { ang: 0.2, gap: 1.2, med: M.oil, col: c.goHi, w: 2.2, p: 1.05, over: 0.2 });
        A.dot(C, rng, lx - r * 0.2, cy - r * 0.22, M.oil, c.white, r * 0.42, 1.1);
        glint(C, rng, lx - r * 0.2, cy - r * 0.22, r * 1.9, hx('#e8fff6'));
      } else {
        A.hatch(C, rng, circ(r), { ang: 0.6, gap: 1.4, med: M.pencil, col: k === 1 ? hx('#4a3e2c') : hx('#4a2236'), w: 1.8, p: 0.95, over: 0.2 });
        A.line(C, rng, A.curve([lx - r * 0.6, cy - r * 0.2, lx - r * 0.3, cy - r * 0.62, lx + r * 0.2, cy - r * 0.7], 4), M.pencil, hx('#9c84d2'), 0.9, 0.6, { wob: 0.1 });
      }
      const hd2 = []; for (let a2 = Math.PI * 0.96; a2 <= 2.04 * Math.PI; a2 += 0.2) hd2.push(lx + Math.cos(a2) * r * 1.22, cy + Math.sin(a2) * r * 1.22 - r * 0.08);
      A.line(C, rng, A.curve(hd2, 3), M.conte, c.black, 3.2, 1.05, { wob: 0.15, reps: 2 });
      A.line(C, rng, A.curve(hd2.map((v, i) => (i % 2 ? v - 2.2 : v)), 3), M.pencil, hx('#ff9aa8'), 0.9, 0.6, { wob: 0.15 });
    }
    // green spilling onto the plate and the pole
    A.line(C, rng, [gx - r * 1.5, cy + h / 2 + 1.5, gx + r * 1.6, cy + h / 2 + 1.5], M.pencil, c.go, 1.0, 0.7, { wob: 0.2 });
  }

  // ================================================================== the corner mirror
  function drawMirror(C, rng) {
    const z = 11.2, sc = F / z, b = gp(3.5, z, 0), m = gp(3.5, z, 2.72), t = gp(3.5, z, 3.2), r = 0.4 * sc, or = hx('#f47a52');
    A.line(C, rng, [b[0], b[1], t[0], t[1]], M.conte, hx('#7a3a3a'), sc * 0.075, 1.05, { wob: 0.25, reps: 2 });
    A.line(C, rng, [b[0] + 1.6, b[1] - 3, t[0] + 1.6, t[1] + 3], M.pencil, or, 1.2, 0.85, { wob: 0.25 });
    const circ = (rr, oy) => { const o = []; for (let a = 0; a < 6.2; a += 0.22) o.push(m[0] + Math.cos(a) * rr, m[1] + (oy || 0) + Math.sin(a) * rr); return o; };
    solid(C, rng, circ(r * 1.1), hx('#8a3f36'), { w: 3 });
    // what it holds: the sky behind us, bent
    A.hatch(C, rng, circ(r * 0.95), { ang: 0.05, gap: 1.5, med: M.pastelTip, col: (x, y) => grad(SKY, 60 + (y - (m[1] - r)) / (2 * r) * 330), w: 3, p: 1.05, over: 0.2 });
    A.hatch(C, rng, [m[0] - r * 0.9, m[1] + r * 0.36, m[0] + r * 0.9, m[1] + r * 0.36, m[0] + r * 0.62, m[1] + r * 0.75, m[0] - r * 0.62, m[1] + r * 0.75], { ang: 0.0, gap: 1.4, med: M.pencil, col: hx('#1b1a58'), w: 1.6, p: 0.95, over: 0.2 });
    A.line(C, rng, A.curve([m[0] - r * 0.25, m[1] + r * 0.8, m[0] - r * 0.1, m[1] + r * 0.45, m[0] + r * 0.05, m[1] + r * 0.36], 4), M.pencil, hx('#fee48e'), 1.0, 0.8, { wob: 0.1 });
    A.line(C, rng, A.curve(circ(r * 1.02), 2), M.oil, or, 2.4, 1.0, { wob: 0.25 });
    A.line(C, rng, A.curve(circ(r * 1.02).slice(40, 50), 3), M.oil, hx('#ffd9a0'), 1.4, 0.9, { wob: 0.2 });
    A.line(C, rng, A.curve([m[0] - r * 0.6, m[1] - r * 0.3, m[0] - r * 0.3, m[1] - r * 0.62, m[0] + r * 0.1, m[1] - r * 0.72], 4), M.oil, c.white, 1.3, 0.8, { wob: 0.1 });
  }

  // ================================================================== the little shop, still open
  function drawShop(C, rng) {
    const XW = 4.1, zs = [8.4, 7.25, 6.15, 5.0], wood = hx('#1f1838'), woodL = hx('#4a2f4e');
    const fq = (za, zb, h0, h1) => P4(gp(XW, za, h0), gp(XW, zb, h0), gp(XW, zb, h1), gp(XW, za, h1));
    // roof: tiles in the wet, taking the sky
    const e0 = gp(3.3, 8.85, 2.55), eN = gp(3.3, 3.9, 2.55), r0 = gp(7.3, 8.85, 4.35), rN = gp(7.3, 3.9, 4.35);
    const roof = [e0[0], e0[1], eN[0], eN[1], rN[0], rN[1], r0[0], r0[1]];
    solid(C, rng, roof, hx('#1d1a4c'), { w: 7, ang: 0.3 });
    for (let k = 0; k <= 15; k++) { // courses
      const u = k / 15, a = gp(3.3 + 4 * u, 8.85, 2.55 + 1.8 * u), b = gp(3.3 + 4 * u, 3.9, 2.55 + 1.8 * u);
      const sh = mix3(hx('#6f72c8'), hx('#f283ae'), 0.5 + 0.5 * Math.sin(k * 1.7));
      A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pastel, mix3(sh, hx('#1d1a4c'), 0.25), rng.r(4, 8), rng.r(0.4, 0.62), { wob: 0.6 });
      A.line(C, rng, [a[0], a[1] + 3, b[0], b[1] + 6], M.pencil, c.black, 1.3, 0.9, { wob: 0.4 });
    }
    for (let zz = 8.7; zz > 3.9; zz -= 0.2 + zz * 0.012) { const a = gp(3.3, zz, 2.55), b = gp(7.3, zz, 4.35); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#0e0c22'), 0.9, 0.6, { wob: 0.3 }); }
    A.line(C, rng, [e0[0], e0[1], r0[0], r0[1]], M.conte, c.black, 3.5, 1.05, { wob: 0.3, reps: 2 });
    A.line(C, rng, [e0[0] + 1, e0[1] - 3, r0[0] + 1, r0[1] - 3], M.pastelTip, hx('#ffb6a0'), 1.5, 0.7, { wob: 0.3 });
    // wall above the opening, soffit lit from below
    solid(C, rng, fq(8.4, 5.0, 2.05, 2.72), hx('#2a1f3e'), { w: 5 });
    const sof = P4(gp(3.3, 8.85, 2.5), gp(3.3, 3.9, 2.5), gp(XW, 3.9, 2.72), gp(XW, 8.6, 2.72));
    solid(C, rng, sof, hx('#6a3a3e'), { w: 4, ang: 0.2 });
    A.hatch(C, rng, sof, { ang: -0.25, gap: 3, med: M.pastelTip, col: hx('#e8803c'), w: 2.6, p: 0.5, over: 0.5 });
    A.line(C, rng, [e0[0], e0[1] + 1, eN[0], eN[1] + 1], M.conte, c.black, 4, 1.05, { wob: 0.3, reps: 2 });
    A.line(C, rng, [e0[0], e0[1] - 2.5, eN[0], eN[1] - 2.5], M.pastelTip, hx('#c890c0'), 1.4, 0.6, { wob: 0.3 });
    // the inside: lamplight, shelves, jars
    const inner = (x, y) => { const u = clamp((y - 500) / 300, 0, 1); return mix3(mix3(hx('#ffdf92'), hx('#f9a848'), ss(0, 0.5, u)), hx('#cf6232'), ss(0.45, 1, u)); };
    for (let k = 0; k < 3; k++) {
      const q = fq(zs[k], zs[k + 1], 0.1, 2.05);
      A.hatch(C, rng, q, { ang: Math.PI / 2, gap: 2.6, med: M.pastel, col: (x, y) => PAS.near(inner(x, y), rng, 0.05), w: 7, p: 1.05, over: 0.5 });
      A.hatch(C, rng, q, { ang: 0.1, gap: 3.4, med: M.pastel, col: (x, y) => PAS.near(inner(x, y - 20), rng, 0.05), w: 6, p: 0.8, over: 0.5 });
    }
    { const a = gp(XW, 8.3, 1.2), b = gp(XW, 5.1, 1.2); const xy = []; for (let u = 0; u <= 1; u += 0.1) xy.push(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u + rng.g() * 4); C.rub(xy, 30, 0.35, 0.5); C.rub(A.rev(xy).map((v, i) => (i % 2 ? v - 70 : v)), 28, 0.3, 0.5); }
    const jar = ['#e2553e', '#f283ae', '#3fb3b4', '#fdd05e', '#7a5cb8', '#fffbe8', '#5a9a58', '#f47a52', '#4d76cc'].map(hx);
    for (const hh of [0.78, 1.14, 1.48, 1.78]) {
      const a = gp(XW, 8.35, hh), b = gp(XW, 5.05, hh);
      A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, hx('#8a3f36'), 1.8, 0.95, { wob: 0.4, reps: 2 });
      for (let zz = 8.25; zz > 5.05; zz -= rng.r(0.07, 0.15)) {
        if (rng() < 0.25) continue;
        const sc = F / zz, q = gp(XW, zz, hh + 0.02), jh = sc * rng.r(0.07, 0.15);
        const col = mix3(rng.pick(jar), inner(q[0], q[1]), rng.r(0.35, 0.6));
        A.line(C, rng, [q[0], q[1] - 1, q[0], q[1] - jh], M.pastelTip, col, sc * rng.r(0.045, 0.075), rng.r(0.8, 1.0), { wob: 0.1, t0: 0.05, t1: 0.1, pe: 0.8, step: 3 });
        if (rng() < 0.35) A.dot(C, rng, q[0], q[1] - jh - 1, M.pencil, hx('#8a3f36'), sc * 0.04, 0.9);
      }
    }
    // things hung from the lintel on strings
    for (let zz = 8.1; zz > 5.2; zz -= rng.r(0.25, 0.5)) { if (zz < 7.3 && zz > 6.1) continue; const sc = F / zz, t = gp(XW, zz, 2.03), len = sc * rng.r(0.1, 0.32); A.line(C, rng, [t[0], t[1], t[0] + rng.g(), t[1] + len], M.pencil, hx('#5a2838'), 0.9, 0.9, { wob: 0.15 }); A.dot(C, rng, t[0], t[1] + len + sc * 0.03, M.pastelTip, mix3(rng.pick(jar), hx('#ffb650'), 0.3), sc * rng.r(0.06, 0.1), 0.95); }
    // crates on the floor, a low table of sweets: silhouettes against the lamp
    for (const [za, zb, hh] of [[8.2, 7.6, 0.55], [7.45, 6.7, 0.42], [6.05, 5.55, 0.62], [5.45, 5.02, 0.5]]) {
      solid(C, rng, fq(za, zb, 0.08, hh), hx('#3a1f34'), { w: 4 });
      const a = gp(XW, za, hh), b = gp(XW, zb, hh); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pastelTip, hx('#ffd27a'), 1.6, 0.8, { wob: 0.3 });
      for (let q = 0; q < 9; q++) { const u = rng(), zz = za + (zb - za) * u, pt = gp(XW, zz, hh + 0.04); A.dot(C, rng, pt[0], pt[1] - 2, M.pastelTip, mix3(rng.pick(jar), hx('#ffb650'), 0.35), F / zz * 0.055, 0.95); }
    }
    // the shop curtain over the middle bay, lamplight in the slits
    { const za = zs[1] - 0.08, zb = zs[2] + 0.08, n = 3;
      for (let k = 0; k < n; k++) { const z0 = za + (zb - za) * (k + 0.03) / n, z1 = za + (zb - za) * (k + 0.97) / n, lo = 1.64 + rng.r(-0.03, 0.03); const q = fq(z0, z1, lo, 2.03);
        solid(C, rng, q, hx('#262a78'), { w: 4, ang: Math.PI / 2 - 0.1 });
        A.hatch(C, rng, q, { ang: Math.PI / 2 + 0.05, gap: 3.5, med: M.pencil, col: hx('#6f72c8'), w: 1.0, p: 0.6, over: 0.4 });
        const a = gp(XW, z0, lo + 0.1), b = gp(XW, z1, lo + 0.1); A.line(C, rng, [a[0] + 2, a[1], b[0] - 2, b[1]], M.pastelTip, hx('#f4f0ea'), 2.2, 0.8, { wob: 0.4 });
        const a2 = gp(XW, z0, lo), b2 = gp(XW, z1, lo); A.line(C, rng, [a2[0], a2[1] + 1.5, b2[0], b2[1] + 1.5], M.pencil, hx('#ffe48e'), 1.0, 0.8, { wob: 0.3 }); } }
    // lattice door, half drawn across the far bay
    { const q = fq(zs[0] - 0.05, zs[0] - 0.66, 0.1, 2.03); A.hatch(C, rng, q, { ang: Math.PI / 2, gap: 6.5, med: M.pencil, col: wood, w: 1.8, p: 1.0, over: 0.3 }); for (const hh of [0.5, 0.95, 1.4, 1.85]) { const a = gp(XW, zs[0] - 0.05, hh), b = gp(XW, zs[0] - 0.66, hh); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, wood, 1.6, 1.0, { wob: 0.2 }); } outline(C, rng, q, wood, 2.4, 1.0, { reps: 2 }); }
    // posts and beams, edged by the lamp on one side and the dusk on the other
    for (let k = 0; k < 4; k++) {
      const sc = F / zs[k], a = gp(XW, zs[k], 0), b = gp(XW, zs[k], 2.72), pw = sc * 0.13;
      solid(C, rng, [a[0] - pw / 2, a[1], a[0] + pw / 2, a[1], b[0] + pw / 2, b[1], b[0] - pw / 2, b[1]], wood, { w: 3.4, ang: Math.PI / 2 });
      A.line(C, rng, [a[0] - pw / 2 - 0.5, a[1] - 4, b[0] - pw / 2 - 0.5, b[1] + 6], M.pencil, hx('#f283ae'), 1.0, 0.6, { wob: 0.3 });
      if (k < 3) A.line(C, rng, [a[0] + pw / 2 + 0.8, a[1] - 4, b[0] + pw / 2 + 0.8, gp(XW, zs[k], 2.05)[1]], M.pencil, hx('#ffd27a'), 1.2, 0.8, { wob: 0.3 });
    }
    { const a = gp(XW, 8.45, 2.05), b = gp(XW, 4.95, 2.05); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.conte, wood, 6, 1.05, { wob: 0.3, reps: 2 }); A.line(C, rng, [a[0], a[1] + 4.5, b[0], b[1] + 6], M.pencil, hx('#ffd27a'), 1.2, 0.8, { wob: 0.3 }); }
    // transom: small panes glowing dimly
    for (let zz = 8.3; zz > 5.05; zz -= 0.36) { const q = fq(zz, zz - 0.27, 2.17, 2.6); A.hatch(C, rng, q, { ang: Math.PI / 2, gap: 2.2, med: M.pastelTip, col: hx('#c8763c'), w: 2.6, p: 0.7, over: 0.2 }); outline(C, rng, q, wood, 1.4, 0.95, {}); }
    { const a = gp(XW, 8.45, 0.06), b = gp(XW, 4.95, 0.06); A.line(C, rng, [a[0], a[1], b[0], b[1]], M.conte, hx('#141030'), 5, 1.05, { wob: 0.3, reps: 2 }); }
    // a bench outside
    { const b0 = gp(3.55, 7.1, 0.42), b1 = gp(3.55, 6.25, 0.42), b2 = gp(3.85, 6.25, 0.42), b3 = gp(3.85, 7.1, 0.42);
      solid(C, rng, P4(b0, b1, b2, b3), hx('#17122c'), { w: 3 }); A.line(C, rng, [b0[0], b0[1], b1[0], b1[1]], M.pastelTip, hx('#ffb650'), 1.4, 0.8, { wob: 0.3 });
      for (const zz of [7.05, 6.3]) { const t = gp(3.57, zz, 0.42), g = gp(3.57, zz, 0); A.line(C, rng, [t[0], t[1], g[0], g[1]], M.conte, hx('#17122c'), 3, 1.05, { wob: 0.2, reps: 2 }); } }
    // one bare bulb under the eave, and a glass wind-bell with its paper tail
    { const b = gp(3.75, 6.7, 2.28), t = gp(3.75, 6.7, 2.6); glow(C, rng, b[0], b[1], 44, hx('#f7a03a'), 10, 0.75); glow(C, rng, b[0], b[1], 24, hx('#ffe48e'), 9, 1.0); A.line(C, rng, [t[0], t[1], b[0], b[1] - 4], M.pencil, c.black, 1.0, 0.9, { wob: 0.2 }); A.dot(C, rng, b[0], b[1], M.oil, hx('#fff4c6'), 7, 1.1); A.dot(C, rng, b[0], b[1], M.oil, c.white, 4, 1.1); glint(C, rng, b[0], b[1], 13, c.cream); }
    { const t = gp(3.5, 7.9, 2.5), b = gp(3.5, 7.9, 2.2), r = 7; A.line(C, rng, [t[0], t[1], b[0], b[1] - r], M.pencil, c.black, 0.8, 0.9, { wob: 0.15 });
      const dome = []; for (let a2 = Math.PI; a2 <= 2 * Math.PI + 0.01; a2 += 0.3) dome.push(b[0] + Math.cos(a2) * r, b[1] + Math.sin(a2) * r * 1.1); dome.push(b[0] + r, b[1] + 2, b[0] - r, b[1] + 2, b[0] - r, b[1]);
      A.line(C, rng, A.curve(dome, 3), M.pencil, hx('#c8f6ff'), 1.1, 0.9, { wob: 0.15, reps: 2 }); A.dot(C, rng, b[0] - 2.5, b[1] - 4, M.oil, c.white, 1.6, 1.0); A.dot(C, rng, b[0] + 2, b[1] - 1, M.pastelTip, hx('#f283ae'), 2.2, 0.8);
      A.line(C, rng, [b[0], b[1], b[0] + 2.5, b[1] + 13], M.pencil, c.black, 0.7, 0.9, { wob: 0.1 });
      solid(C, rng, [b[0] + 0.5, b[1] + 13, b[0] + 6.5, b[1] + 14.5, b[0] + 10.5, b[1] + 39, b[0] + 4.5, b[1] + 38], hx('#fcd3dc'), { w: 2.2, med: M.pastelTip, ang: 1.3 }); }
    // lamplight pulled down the wet road
    for (let k = 0; k < 150; k++) { const zz = rng.r(5.2, 8.5), xw = XW - Math.abs(rng.g()) * 1.5 - 0.05, g = gp(xw, zz, 0), len = rng.r(8, 60) * (1 - (XW - xw) / 4.2); if (len < 4) continue; A.line(C, rng, [g[0], g[1], g[0] + rng.g(), g[1] + len], M.pastelTip, rng() < 0.4 ? hx('#ffe48e') : rng() < 0.6 ? hx('#ffb650') : hx('#f47a52'), rng.r(1.5, 3.6), rng.r(0.5, 0.9), { wob: 0.3, t1: 0.6 }); }
  }

  // ================================================================== a bicycle, dropped where its rider stopped
  function drawBike(C, rng) {
    const z = 7.5, sc = F / z, gy = gp(0, z, 0)[1], X = xw => VX + F * xw / z, Y = h => gy - h * sc;
    const fx = X(1.72), rx = X(2.76), r = 0.275 * sc, wy = Y(0.275), ink = hx('#100e2a'), warm = hx('#ffb650'), rose = hx('#f283ae');
    // shadow and broken reflection underneath
    for (let k = 0; k < 26; k++) { const x = rng.r(fx - r, rx + r); A.line(C, rng, [x, gy + rng.r(1, 5), x + rng.g(), gy + rng.r(10, 44)], M.conte, hx('#0e0c24'), rng.r(2, 4), rng.r(0.45, 0.8), { wob: 0.3, t1: 0.7 }); }
    A.line(C, rng, [fx - r * 0.8, gy + 2, rx + r * 1.2, gy + 3], M.conte, hx('#0b0a1e'), 5, 0.95, { wob: 0.4, reps: 2 });
    const wheel = cx => {
      const o = []; for (let a = 0; a <= 6.3; a += 0.2) o.push(cx + Math.cos(a) * r, wy + Math.sin(a) * r);
      A.line(C, rng, A.curve(o, 3), M.conte, ink, 5.2, 1.25, { wob: 0.3, reps: 3, off: 0.6, pe: 0.8 });
      const o2 = []; for (let a = 0; a <= 6.3; a += 0.2) o2.push(cx + Math.cos(a) * r * 0.9, wy + Math.sin(a) * r * 0.9);
      A.line(C, rng, A.curve(o2, 3), M.pencil, hx('#7c7692'), 0.9, 0.7, { wob: 0.2 });
      for (let k = 0; k < 14; k++) { const a = k / 14 * 6.283 + 0.1; A.line(C, rng, [cx + Math.cos(a) * 3, wy + Math.sin(a) * 3, cx + Math.cos(a + 0.25) * r * 0.9, wy + Math.sin(a + 0.25) * r * 0.9], M.pencil, hx('#6a5fb4'), 0.8, 0.7, { wob: 0.1 }); }
      A.dot(C, rng, cx, wy, M.conte, ink, 7, 1.2);
      // rims of light: lamp from the right, dusk from the left
      const hl = (a0, a1, col) => { const q = []; for (let a = a0; a <= a1; a += 0.15) q.push(cx + Math.cos(a) * (r + 1.6), wy + Math.sin(a) * (r + 1.6)); A.line(C, rng, A.curve(q, 3), M.pencil, col, 1.1, 0.8, { wob: 0.15 }); };
      hl(-1.2, 0.2, warm); hl(3.4, 4.5, rose);
    };
    wheel(fx); wheel(rx);
    const L = (pts, w, col, reps) => A.line(C, rng, pts, M.conte, col || ink, w * 1.55, 1.25, { wob: 0.25, reps: reps || 3, off: 0.5, pe: 0.7 });
    const bb = [rx - r * 1.5, wy + 3], seat = [rx - r * 1.2, Y(0.8)], headT = [fx + r * 0.85, Y(0.9)], headB = [fx + r * 0.62, Y(0.6)];
    // mudguards
    for (const cx of [fx, rx]) { const q = []; for (let a = Math.PI * 1.05; a <= Math.PI * (cx === fx ? 1.9 : 2.1); a += 0.15) q.push(cx + Math.cos(a) * (r + 4.5), wy + Math.sin(a) * (r + 4.5)); L(A.curve(q, 3), 2.4); }
    L([headB[0], headB[1], fx, wy], 2.8);                                             // fork
    L([headT[0], headT[1] - 8, headB[0], headB[1]], 3.6);                              // head tube
    L(A.curve([headB[0], headB[1] - 6, (headB[0] + bb[0]) / 2, bb[1] - 26, bb[0], bb[1]], 6), 3.6); // the swooping step-through tube
    L(A.curve([headB[0] + 2, headB[1] + 6, (headB[0] + bb[0]) / 2 - 4, bb[1] - 6, bb[0], bb[1]], 6), 2.6);
    L([bb[0], bb[1], seat[0], seat[1] + 6], 3.4);                                       // seat tube
    L([seat[0] + 2, seat[1] + 26, rx, wy], 2.4); L([bb[0], bb[1], rx, wy], 2.6);         // stays
    L([seat[0] - 14, seat[1] + 2, seat[0] + 17, seat[1] - 2], 6, ink, 3);              // saddle
    L(A.curve([headT[0], headT[1] - 8, headT[0] + 4, headT[1] - 26, headT[0] + 22, headT[1] - 32, headT[0] + 38, headT[1] - 24], 6), 2.6); // bars sweeping back
    L([headT[0] + 30, headT[1] - 27, headT[0] + 42, headT[1] - 23], 4.4);
    // basket
    const bk = [fx - r * 0.75, Y(0.98), fx + r * 0.42, Y(0.98), fx + r * 0.3, Y(0.67), fx - r * 0.58, Y(0.67)];
    A.hatch(C, rng, bk, { ang: 0.7, gap: 4, med: M.pencil, col: ink, w: 1.7, p: 1.15, over: 0.3 }); A.hatch(C, rng, bk, { ang: -0.7, gap: 4, med: M.pencil, col: ink, w: 1.7, p: 1.15, over: 0.3 }); outline(C, rng, bk, ink, 3.2, 1.2, { reps: 3, med: M.conte });
    L([fx + r * 0.3, Y(0.7), headB[0] + 2, headB[1] - 14], 2.0);
    // rack, stand, crank, lamp, reflector
    L([seat[0] + 8, seat[1] + 30, rx + r * 0.95, seat[1] + 32], 2.6); L([rx + r * 0.8, seat[1] + 32, rx, wy], 1.8);
    L([rx - 4, wy + 4, rx + r * 0.55, gy], 2.6); L([rx + r * 0.3, gy, rx + r * 0.75, gy], 2.6);
    { const q = []; for (let a = 0; a <= 6.3; a += 0.4) q.push(bb[0] + Math.cos(a) * 9, bb[1] + Math.sin(a) * 9); L(A.curve(q, 3), 1.8); L([bb[0], bb[1], bb[0] - 12, bb[1] + 18], 2.4); L([bb[0] - 18, bb[1] + 19, bb[0] - 6, bb[1] + 18], 3); }
    A.dot(C, rng, rx + r + 5, wy - r * 0.55, M.oil, hx('#ff5a4a'), 4, 1.1); A.dot(C, rng, rx + r + 4.5, wy - r * 0.55 - 0.8, M.oil, hx('#ffb09a'), 1.6, 1.0);
    A.dot(C, rng, fx + r * 0.2, Y(0.62), M.oil, hx('#b9b3c8'), 4, 1.0);
    // light catching the frame
    A.line(C, rng, [seat[0] - 12, seat[1] - 2.5, seat[0] + 16, seat[1] - 6], M.pencil, warm, 1.1, 0.85, { wob: 0.15 });
    A.line(C, rng, A.curve([headB[0] + 2.5, headB[1] - 8, (headB[0] + bb[0]) / 2 + 2, bb[1] - 29, bb[0] + 2, bb[1] - 3], 6), M.pencil, warm, 1.0, 0.75, { wob: 0.2 });
    A.line(C, rng, [bk[0], bk[1] - 2, bk[2], bk[3] - 2], M.pencil, rose, 1.0, 0.8, { wob: 0.15 });
    A.line(C, rng, [headT[0] + 6, headT[1] - 29, headT[0] + 36, headT[1] - 27], M.pencil, warm, 1.0, 0.8, { wob: 0.15 });
  }

  // ================================================================== hydrangeas after rain
  function drawHedge(C, rng) {
    const XW = -3.3, z0 = 4.7, z1 = 8.45;
    const top = z => 1.22 + 0.2 * Math.sin(z * 4.1) + 0.12 * Math.sin(z * 9.7 + 1) + 0.1 * (A.vn(z * 3, 0.5, 5) - 0.5);
    const poly = [];
    for (let z = z1; z >= z0; z -= 0.1) { const p2 = gp(XW, z, top(z)); poly.push(p2[0], p2[1]); }
    poly.push(-30, gp(XW, z0, top(z0))[1], -30, 930); { const b = gp(XW - 0.15, 5.3, 0); poly.push(b[0], 930); }
    { const b = gp(XW + 0.1, z1, -0.02); poly.push(b[0], b[1]); }
    const inside = (x, y) => (inPoly(poly, x, y) ? 1 : 0);
    const leafD = ['#0f1f33', '#142a3c', '#1b3a44', '#151a40'].map(hx);
    A.field(C, rng, { box: [-40, 590, 270, 930], sp: 9, mask: inside, clip: true, col: (x, y) => rng.pick(leafD), dir: () => rng.r(0, 3.14), len: [10, 30], w: [8, 16], p: [0.95, 1.1], med: M.conte, wob: 0.8 });
    // leaves: broad, toothed, each a couple of strokes, the wet ones holding a scrap of sky
    const zOf = x => F * 3.3 / Math.max(20, VX - x);
    const leaf = (x, y, s, a, col, vein) => {
      const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
      const o = [x - dx * s, y - dy * s, x - dx * s * 0.2 + nx * s * 0.5, y - dy * s * 0.2 + ny * s * 0.5, x + dx * s * 1.05, y + dy * s * 1.05, x - dx * s * 0.2 - nx * s * 0.5, y - dy * s * 0.2 - ny * s * 0.5];
      A.hatch(C, rng, o, { ang: a + 0.3, gap: Math.max(1.2, s * 0.14), med: M.pastelTip, col, w: Math.max(1.6, s * 0.22), p: 0.95, over: 0.4 });
      if (vein) A.line(C, rng, [x - dx * s * 0.9, y - dy * s * 0.9, x + dx * s, y + dy * s], M.pencil, vein, 0.9, 0.7, { wob: 0.2 });
    };
    const leafC = ['#1f4a3c', '#2f6f4a', '#24584a', '#1b5a5a', '#2a4a6a'].map(hx);
    for (let k = 0; k < 520; k++) {
      const x = rng.r(-20, 262), y = rng.r(592, 915); if (!inside(x, y)) continue;
      const s = F / zOf(x) * rng.r(0.05, 0.085), a = rng.r(-2.6, -0.4) + (rng() < 0.3 ? 3.14 : 0);
      const lit = rng() < 0.3;
      leaf(x, y, s, a, lit ? mix3(rng.pick(leafC), hx('#7fb8a0'), rng.r(0.2, 0.5)) : rng.pick(leafC), lit ? hx('#b8ecd8') : hx('#0f1f33'));
      if (rng() < 0.22) A.line(C, rng, [x + Math.cos(a) * s, y + Math.sin(a) * s, x + Math.cos(a - 1.2) * s * 0.5, y + Math.sin(a - 1.2) * s * 0.5], M.pencil, rng() < 0.5 ? hx('#ff9a8a') : hx('#fee48e'), 1.0, 0.8, { wob: 0.15 });
    }
    // the flower heads
    const fam = [['#2a3a8e', '#4d76cc', '#7f9fe6', '#b8ccf6'], ['#3b2a7e', '#6a56b8', '#9c84d2', '#cdbcf0'], ['#7e2c68', '#c84e8e', '#f283ae', '#fbc0d2'], ['#1f5a7a', '#3f9ab8', '#80c8dc', '#c4ecf0'], ['#4a3f98', '#7a6ccc', '#a8a0e8', '#d6d2f8']].map(f => f.map(hx));
    const heads = [];
    for (let k = 0; k < 400 && heads.length < 62; k++) {
      const z = rng.r(4.75, 8.4), hh = rng.r(0.22, top(z) + 0.05), p2 = gp(XW + rng.r(-0.1, 0.25), z, hh), r = F / z * rng.r(0.085, 0.125);
      if (p2[0] < -r || p2[1] > 915) continue;
      let ok = true; for (const o of heads) if (Math.hypot(o[0] - p2[0], o[1] - p2[1]) < (o[2] + r) * 0.78) { ok = false; break; }
      if (ok) heads.push([p2[0], p2[1], r, z]);
    }
    heads.sort((a, b) => b[3] - a[3]);
    for (const hd of heads) {
      const [x, y, r] = hd, f = rng() < 0.5 ? fam[0] : rng() < 0.45 ? fam[1] : rng() < 0.4 ? fam[4] : rng() < 0.6 ? fam[2] : fam[3];
      const disc = []; for (let a = 0; a < 6.2; a += 0.4) disc.push(x + Math.cos(a) * r * (0.92 + 0.12 * rng()), y + Math.sin(a) * r * (0.84 + 0.12 * rng()));
      solid(C, rng, disc, f[0], { w: Math.max(2.4, r * 0.3), med: M.pastel, p: 1.05 });
      // florets: four small petals each, lighter toward the sun (up and to the right)
      const n = Math.round(r * r * 0.11) + 10;
      for (let q = 0; q < n; q++) {
        const a = rng() * 6.283, d = Math.sqrt(rng()) * r * 0.95, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.9;
        const lightness = clamp(0.5 + ((px - x) * 0.55 - (py - y) * 0.8) / r * 0.62 + rng.g() * 0.16, 0, 1);
        const col = lightness > 0.8 ? f[3] : lightness > 0.48 ? f[2] : lightness > 0.22 ? f[1] : mix3(f[0], f[1], 0.5);
        const ps = Math.max(1.3, r * 0.12);
        for (let e = 0; e < 4; e++) { const ea = e * 1.571 + a; A.dot(C, rng, px + Math.cos(ea) * ps * 0.75, py + Math.sin(ea) * ps * 0.75, M.pastelTip, col, ps * 1.25, 0.95); }
        if (r > 16 && rng() < 0.6) A.dot(C, rng, px, py, M.pencil, lightness > 0.6 ? c.cream : f[0], Math.max(0.9, ps * 0.4), 0.9);
      }
      // the rim that still has the sun on it, and one or two drops
      for (let q = 0; q < 5; q++) { const a = -0.75 + rng.g() * 0.5; A.dot(C, rng, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.82, M.oil, rng() < 0.5 ? hx('#ffd9c0') : hx('#fff4c6'), Math.max(1.3, r * 0.1), 0.95); }
      if (rng() < 0.5) A.dot(C, rng, x + rng.r(-0.5, 0.5) * r, y + rng.r(-0.5, 0.5) * r, M.oil, c.white, Math.max(1.1, r * 0.06), 1.05);
    }
    // a few leaves over the top of everything
    for (let k = 0; k < 70; k++) { const x = rng.r(-20, 258), y = rng.r(596, 915); if (!inside(x, y)) continue; const s = F / zOf(x) * rng.r(0.05, 0.08), a = rng.r(-2.4, -0.6); leaf(x, y, s, a, mix3(rng.pick(leafC), hx('#3a8a6a'), 0.3), hx('#9cc37a')); }
  }

  // ================================================================== the near pole and its lamp
  function drawPole1(C, rng) {
    const z = 8.5, sc = F / z, b = gp(POLEX, z, 0.9), pw = sc * 0.3, x = b[0];
    const colr = hx('#221f4e');
    solid(C, rng, [x - pw / 2, b[1], x + pw / 2, b[1], x + pw * 0.42, -20, x - pw * 0.42, -20], colr, { w: 7, ang: Math.PI / 2 - 0.03 });
    A.hatch(C, rng, [x - pw / 2, b[1], x - pw * 0.05, b[1], x - pw * 0.05, -20, x - pw * 0.42, -20], { ang: Math.PI / 2, gap: 2.6, med: M.conte, col: hx('#121036'), w: 3.4, p: 0.9, over: 0.5 });
    A.hatch(C, rng, [x + pw * 0.18, b[1], x + pw / 2, b[1], x + pw * 0.42, -20, x + pw * 0.16, -20], { ang: Math.PI / 2, gap: 3.2, med: M.pastelTip, col: (px, py) => mix3(hx('#4a4690'), hx('#c8709a'), ss(100, 560, py)), w: 2.4, p: 0.6, over: 0.5 });
    A.line(C, rng, [x + pw / 2 - 0.5, b[1] - 3, x + pw * 0.42 - 0.5, -10], M.pastelTip, hx('#ffb09a'), 1.5, 0.75, { wob: 0.4 });
    A.line(C, rng, [x - pw / 2, b[1], x - pw * 0.42, -10], M.pencil, c.black, 1.4, 0.9, { wob: 0.4, reps: 2 });
    // step bolts, straps, a number plate
    for (let hh = 2.2; hh < 9; hh += 0.45) { const q = gp(POLEX, z, hh), sd = Math.round(hh / 0.45) % 2 ? 1 : -1; A.line(C, rng, [q[0] + sd * pw * 0.45, q[1], q[0] + sd * (pw * 0.45 + sc * 0.17), q[1] - 1], M.pencil, c.black, 1.7, 1.0, { wob: 0.1, reps: 2 }); }
    for (const hh of [1.6, 3.4, 4.2]) { const q = gp(POLEX, z, hh); A.line(C, rng, [q[0] - pw * 0.5, q[1], q[0] + pw * 0.5, q[1] + 1], M.pencil, hx('#0e0c22'), 2.0, 1.0, { wob: 0.15, reps: 2 }); }
    { const q = gp(POLEX, z, 2.9); solid(C, rng, [q[0] - pw * 0.28, q[1] - 16, q[0] + pw * 0.24, q[1] - 16, q[0] + pw * 0.24, q[1] + 16, q[0] - pw * 0.28, q[1] + 16], hx('#b9b3c8'), { w: 2.4, med: M.pastelTip }); A.hatch(C, rng, [q[0] - pw * 0.2, q[1] - 11, q[0] + pw * 0.16, q[1] - 11, q[0] + pw * 0.16, q[1] + 11, q[0] - pw * 0.2, q[1] + 11], { ang: 0.0, gap: 4.5, med: M.pencil, col: hx('#2c3f9e'), w: 1.1, p: 0.8, over: 0.1 }); }
    // the street lamp: just come on
    const a0 = gp(POLEX, z, 5.55), lx = a0[0] + sc * 1.45, ly = a0[1] - 14;
    glow(C, rng, lx, ly + 10, 70, hx('#7fd8c8'), 14, 0.36); glow(C, rng, lx, ly + 8, 34, hx('#d6fff0'), 10, 0.5);
    A.line(C, rng, A.curve([a0[0], a0[1] + 30, a0[0] + 40, a0[1] - 8, a0[0] + 110, ly - 4, lx - 20, ly], 6), M.conte, colr, 3.4, 1.05, { wob: 0.3, reps: 2 });
    solid(C, rng, [lx - 24, ly - 5, lx + 26, ly - 4, lx + 30, ly + 3, lx - 22, ly + 4], hx('#17153a'), { w: 3 });
    A.hatch(C, rng, [lx - 19, ly + 3.5, lx + 26, ly + 3, lx + 22, ly + 9, lx - 15, ly + 9], { ang: 0, gap: 1.3, med: M.oil, col: hx('#f0fff8'), w: 2.4, p: 1.1, over: 0.2 });
    glint(C, rng, lx + 4, ly + 6, 16, c.white);
    // service wires dropping away to the left
    for (const hh of [6.6, 7.3]) { const q = gp(POLEX, z, hh), xy = []; for (let u = 0; u <= 1; u += 0.1) xy.push(q[0] - u * (q[0] + 30), q[1] + u * 40 + Math.sin(u * 3.14) * 22); A.line(C, rng, A.curve(xy, 3), M.pencil, pcol, 1.2, 0.95, { wob: 0.25 }); }
  }

  // ================================================================== paper planes
  function plane(C, rng, cx, cy, size, th, pitch, roll, bright) {
    const V = { N: [1, 0, 0], T: [-1, 0, 0], L: [-1, 0.74, 0.1], R: [-1, -0.74, 0.1], K: [-1, 0, -0.34] }, S = {};
    const cr = Math.cos(roll), sr = Math.sin(roll), cp = Math.cos(pitch), sp = Math.sin(pitch), ct = Math.cos(th), st = Math.sin(th);
    for (const k in V) { const v = V[k]; const y1 = v[1] * cr - v[2] * sr, z1 = v[1] * sr + v[2] * cr; const x2 = v[0] * cp + z1 * sp, z2 = -v[0] * sp + z1 * cp; S[k] = [cx + size * (x2 * ct - y1 * st), cy + size * (x2 * st + y1 * ct), z2]; }
    const tone = bright ? [hx('#fffaea'), size > 9 ? hx('#b9b2ee') : hx('#f6b9c6'), hx('#6f66c0'), hx('#ffd9a0')] : [hx('#c488b0'), hx('#8a62a8'), hx('#4a3a88'), hx('#ffe48e')];
    if (size < 3.2) {
      A.line(C, rng, [S.R[0], S.R[1], S.N[0], S.N[1]], M.oil, tone[1], Math.max(1.0, size * 0.5), 1.05, { wob: 0.05, step: 2, t0: 0.05, t1: 0.05, pe: 0.8 });
      A.line(C, rng, [S.L[0], S.L[1], S.N[0], S.N[1]], M.oil, tone[0], Math.max(1.0, size * 0.5), 1.05, { wob: 0.05, step: 2, t0: 0.05, t1: 0.05, pe: 0.8 });
      return;
    }
    const faces = [['L', tone[0]], ['R', tone[1]], ['K', tone[2]]].map(f => ({ k: f[0], col: f[1], d: S[f[0]][2] })).sort((a, b) => a.d - b.d);
    for (const f of faces) {
      const q = S[f.k], poly = [S.N[0], S.N[1], S.T[0], S.T[1], q[0], q[1]];
      if (size < 9) { A.hatch(C, rng, poly, { ang: th, gap: 0.9, med: M.oil, col: f.col, w: 1.6, p: 1.05, over: 0.2 }); continue; }
      solid(C, rng, poly, f.col, { med: bright ? M.oil : M.pastelTip, w: clamp(size * 0.11, 1.6, 4.2), ang: th + 0.25, cross: 0.5, p: 1.02 });
      if (size > 20) { // the grain of folded paper: a few pencil lines along the fold, a shadow under the wing root
        A.hatch(C, rng, poly, { ang: th + 0.02, gap: size * 0.13, med: M.pencil, col: f.k === 'K' ? hx('#5a4a9e') : f.k === 'R' ? hx('#e8a0a8') : hx('#f9d8c0'), w: 1.0, p: 0.6, over: 0.2, skip: 0.2 });
      }
    }
    const edge = bright ? hx('#6a5fb4') : hx('#2a2460');
    if (size > 9) {
      A.line(C, rng, [S.N[0], S.N[1], S.T[0], S.T[1]], M.pencil, edge, size > 30 ? 1.3 : 0.9, 0.85, { wob: 0.2, reps: size > 30 ? 2 : 1 });
      A.line(C, rng, [S.N[0], S.N[1], S.L[0], S.L[1], S.T[0], S.T[1]], M.pencil, edge, 0.9, 0.7, { wob: 0.2 });
      A.line(C, rng, [S.N[0], S.N[1], S.R[0], S.R[1], S.T[0], S.T[1]], M.pencil, edge, 0.9, 0.7, { wob: 0.2 });
      // the edge that has the sun
      const sunSide = (S.L[0] - cx) * (SUNX - cx) + (S.L[1] - cy) * (HY - cy) > (S.R[0] - cx) * (SUNX - cx) + (S.R[1] - cy) * (HY - cy) ? 'L' : 'R';
      A.line(C, rng, [S.N[0], S.N[1], S[sunSide][0], S[sunSide][1]], M.oil, tone[3], clamp(size * 0.035, 1.0, 2.2), 0.95, { wob: 0.15 });
    }
  }
  // a paper dart seen from behind and below: far wing in the light, near wing in the cool, the fold hanging between
  function dart(C, rng, cx, cy, size, th, flip, bright, k2) {
    const ux = Math.cos(th), uy = Math.sin(th), vx = -uy * flip, vy = ux * flip;
    const pt = (u, v) => [cx + size * (u * ux + v * vx), cy + size * (u * uy + v * vy)];
    k2 = k2 || 1;
    const N = pt(1.08, 0), Aw = pt(-0.95, -0.66 * k2), T = pt(-0.8, -0.03), K = pt(-0.93, 0.26), B = pt(-1.02, 0.54 * k2);
    const tone = bright ? [hx('#fffbee'), hx('#cbc4f2'), hx('#8176cc'), hx('#a79fe2')] : [hx('#d8a0bc'), hx('#9a70b0'), hx('#54428e'), hx('#7a5aa0')];
    const tri = (a, b, d, col, ang, med) => solid(C, rng, [a[0], a[1], b[0], b[1], d[0], d[1]], col, { med: med || M.pastelTip, w: clamp(size * 0.1, 1.4, 5), ang, cross: 0.45, p: 1.05, over: 0.3 });
    tri(N, T, B, tone[1], th + 0.2);
    tri(N, K, B, tone[3], th + 0.25);            // the shade the fold throws on the near wing
    tri(N, Aw, T, tone[0], th - 0.28, bright ? M.oil : M.pastelTip);
    tri(N, T, K, tone[2], th + 0.1);
    if (size > 16) {
      // paper is never quite flat: a little warmth near the root, pencil along the grain
      A.hatch(C, rng, [N[0], N[1], Aw[0], Aw[1], T[0], T[1]], { ang: th - 0.3, gap: size * 0.11, med: M.pencil, col: bright ? hx('#f6c8b8') : hx('#b07898'), w: 1.0, p: 0.55, over: 0.2, skip: 0.25 });
      A.hatch(C, rng, [N[0], N[1], T[0], T[1], B[0], B[1]], { ang: th + 0.24, gap: size * 0.1, med: M.pencil, col: bright ? hx('#8f86d8') : hx('#6a4a90'), w: 1.0, p: 0.6, over: 0.2, skip: 0.2 });
    }
    const edge = bright ? hx('#4a4496') : hx('#2a2460'), lw = size > 30 ? 1.3 : 0.9;
    const ln = (a, b, col, w, pp) => A.line(C, rng, [a[0], a[1], b[0], b[1]], M.pencil, col || edge, w || lw, pp || 0.85, { wob: 0.25, reps: size > 30 ? 2 : 1, off: 0.35 });
    ln(N, T); ln(N, K); ln(T, K); ln(Aw, T); ln(K, B); ln(N, B);
    // the long edge that still has the sun, and the rose of the horizon under the fold
    A.line(C, rng, [N[0], N[1], Aw[0], Aw[1]], M.oil, bright ? hx('#ffe9a8') : hx('#ffd27a'), clamp(size * 0.035, 1.0, 2.4), 1.0, { wob: 0.2 });
    A.line(C, rng, [pt(0.6, 0.1)[0], pt(0.6, 0.1)[1], pt(-0.9, 0.5 * k2)[0], pt(-0.9, 0.5 * k2)[1]], M.pencil, hx('#ff9aa8'), 1.0, 0.7, { wob: 0.2 });
  }
  const STREAM = A.curve([735, 484, 712, 462, 668, 428, 600, 384, 505, 322, 385, 250, 245, 186], 16);
  function streamAt(t) { const n = (STREAM.length >> 1) - 1, f = clamp(t, 0, 1) * n, i = Math.min(n - 1, Math.floor(f)), u = f - i; return [STREAM[i * 2] + (STREAM[i * 2 + 2] - STREAM[i * 2]) * u, STREAM[i * 2 + 1] + (STREAM[i * 2 + 3] - STREAM[i * 2 + 1]) * u, Math.atan2(STREAM[i * 2 + 1] - STREAM[i * 2 + 3], STREAM[i * 2] - STREAM[i * 2 + 2])]; }
  function isBright(x, y) { if (y > HY + 2) return true; const col = skyAll(x, y); return col[0] * 0.3 + col[1] * 0.55 + col[2] * 0.15 < 0.62; }
  function drawPlanes(C, rng) {
    const list = [];
    // rising out of the town, from windows and rooftops, to join
    for (let k = 0; k < 230; k++) {
      const left = rng() < 0.55, sx = left ? rng.r(250, 640) : rng.r(760, 1120), sy = rng.r(560, 700), jt = left ? rng.r(0.06, 0.34) : rng.r(0.0, 0.14), j = streamAt(jt);
      const u = Math.pow(rng(), 0.75), bow = Math.sin(u * 3.14) * rng.r(-26, 10);
      const x = sx + (j[0] - sx) * u + bow * (left ? -1 : 1) + rng.g() * 5, y = sy + (j[1] - sy) * u * u + rng.g() * 5;
      const th = Math.atan2((j[1] - sy) * (0.3 + 1.4 * u), j[0] - sx) + rng.g() * 0.35;
      list.push([x, y, rng.r(2.0, 4.2), th, rng.r(0.2, 1.0), rng.g() * 0.7]);
    }
    // the stream itself: a river of them, thinning toward us
    for (let k = 0; k < 620; k++) {
      const t = Math.pow(rng(), 1.5) * 0.92, p0 = streamAt(t), nx = -Math.sin(p0[2]), ny = Math.cos(p0[2]), spread = 5 + 80 * Math.pow(t, 1.2), off = rng.g() * spread;
      const size = (2.0 + 26 * Math.pow(t, 1.9)) * rng.r(0.6, 1.2);
      if (size > 9.5) continue;
      list.push([p0[0] + nx * off + rng.g() * 3, p0[1] + ny * off * 0.8 + rng.g() * 3, size, p0[2] + rng.g() * 0.3, rng.r(0.2, 1.0), rng.g() * 0.7]);
    }
    // a branch that peels away, loops over the sun and comes back -- the way a flock plays
    const LOOP = A.curve([735, 480, 792, 452, 842, 400, 846, 338, 800, 296, 728, 292, 664, 322, 618, 372], 14);
    for (let k = 0; k < 300; k++) {
      const n = (LOOP.length >> 1) - 1, t = rng(), f = t * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
      const x = LOOP[i * 2] + (LOOP[i * 2 + 2] - LOOP[i * 2]) * u, y = LOOP[i * 2 + 1] + (LOOP[i * 2 + 3] - LOOP[i * 2 + 1]) * u, th = Math.atan2(LOOP[i * 2 + 3] - LOOP[i * 2 + 1], LOOP[i * 2 + 2] - LOOP[i * 2]);
      const sp2 = 5 + 16 * Math.sin(Math.PI * t), off = rng.g() * sp2;
      list.push([x - Math.sin(th) * off + rng.g() * 2, y + Math.cos(th) * off + rng.g() * 2, rng.r(2.0, 3.4 + 3.2 * t), th + rng.g() * 0.3, rng.r(0.2, 1.0), rng.g() * 0.7]);
    }
    // stragglers, far and wide
    for (let k = 0; k < 70; k++) { const x = rng.r(20, 900), y = rng.r(250, 498); list.push([x, y, rng.r(2.0, 3.6), Math.atan2(HY - y, SUNX - x) + rng.g() * 0.5, rng.r(0.2, 1), rng.g() * 0.7]); }
    list.sort((a, b) => a[2] - b[2]);
    for (const p2 of list) if (Math.hypot(p2[0] - SUNX, (p2[1] - HY) * 1.2) > 62 || rng() < 0.12) plane(C, rng, p2[0], p2[1], p2[2], p2[3], p2[4], p2[5], isBright(p2[0], p2[1]));
    // the ones close enough to see the folds: placed by hand so they read
    const near = [[612, 410, 9, 0.5, 1], [560, 322, 11, 0.62, -1], [655, 352, 8, 0.9, 1], [480, 356, 14, 0.42, 1], [522, 258, 13, 0.75, -1], [432, 300, 19, 0.5, 1], [36, 300, 15, 0.3, -1], [318, 322, 23, 0.34, 1], [404, 196, 28, 0.6, -1], [176, 322, 17, 0.2, 1], [52, 150, 12, 0.5, 1], [700, 300, 7, 1.2, -1], [770, 380, 6, 2.0, 1], [840, 300, 6, 2.3, -1]];
    for (const p2 of near) dart(C, rng, p2[0], p2[1], p2[2], p2[3], p2[4], isBright(p2[0], p2[1]), rng.r(0.85, 1.1));
    // here and there a wing turns and flashes
    for (let k = 0; k < 16; k++) { const t = rng.r(0.05, 0.6), p0 = streamAt(t), sp2 = 10 + 60 * t; const x = p0[0] + rng.g() * sp2, y = p0[1] + rng.g() * sp2 * 0.7; A.dot(C, rng, x, y, M.oil, c.white, rng.r(1.4, 2.2), 1.1); glint(C, rng, x, y, rng.r(4, 8), hx('#fff4c6')); }
    // and ours
    dart(C, rng, 236, 190, 70, 0.5, 1, true, 1);
  }

  // ================================================================== the last things a hand does
  function finishing(C, rng) {
    // pastel dust that settled where it fell
    for (let k = 0; k < 700; k++) { const x = rng.r(0, 1600), y = rng.r(0, 900); A.dot(C, rng, x, y, M.pastelTip, PAS.c[rng.i(0, PAS.c.length - 1)], rng.r(0.5, 1.3), rng.r(0.3, 0.7)); }
    // construction lines never quite rubbed out: the vanishing point still pulls at the road
    for (const xb of [-140, 190, 520, 870, 1230, 1560]) { const y1 = rng.r(730, 760); A.line(C, rng, [VX + (xb - VX) * (y1 - YV) / 400, y1, xb, YV + 400], M.pencil, hx('#cfc6ee'), 0.7, 0.32, { wob: 0.5, pj: 0.4 }); }
    { const e = gp(3.3, 8.85, 2.55), v = [VX, YV - 60]; A.line(C, rng, [e[0] - 6, e[1] + 6 * (v[1] - e[1]) / (v[0] - e[0]) * -1 * -1, e[0] - 150, e[1] + (v[1] - e[1]) * 150 / (e[0] - v[0])], M.pencil, hx('#cfc6ee'), 0.7, 0.3, { wob: 0.4, pj: 0.4 }); }
    A.line(C, rng, [870, HY + 0.5, 1210, HY + 1.2], M.pencil, hx('#4a3a88'), 0.7, 0.35, { wob: 0.3, pj: 0.4 });
    // where the heel of the hand rested and dragged
    for (const [x, y, r] of [[1480, 872, 22], [560, 886, 18]]) C.rub([x - 26, y + 4, x, y, x + 30, y - 5], r, 0.22, 0.75);
    // sparkle on wet things
    for (let k = 0; k < 60; k++) { const x = rng.r(0, 1600), y = rng.r(YB + 6, 898); const g = groundCol(x, y); if (g[0] + g[1] + g[2] < 1.25) continue; A.dot(C, rng, x, y, M.oil, c.white, rng.r(0.9, 1.8), 1.0); }
  }

  A._plan = () => { if (!CL) buildCloud(); return { CL, skyAll, GW, GH }; };
  // ================================================================== main
  // The picture as a list of steps, in the order a hand would work: far to near, soft to sharp.
  A.steps = function (W, H) {
    const C = new A.Canvas(W, H, '#342a54', 20261113);
    const rng = A.rng(777);
    const r = [rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork(), rng.fork()];
    const steps = [
      ['sky', () => { if (!CL) buildCloud(); drawSky(C, r[0]); }],
      ['cloud', () => drawCloud(C, r[1])],
      ['sea and sun', () => drawSeaSun(C, r[2])],
      ['stars, town', () => { drawStars(C, r[3]); drawTown(C, r[4]); drawFarSignals(C, r[5]); drawSlope(C, r[6]); }],
      ['paper planes', () => drawPlanes(C, r[7])],
      ['wet road', () => drawGround(C, r[8])],
      ['corner, signal, mirror', () => { drawCorner(C, r[9]); drawSignal1(C, r[10]); drawMirror(C, r[11]); }],
      ['shop, bicycle', () => { drawShop(C, r[12]); drawBike(C, r[13]); }],
      ['hydrangeas, pole', () => { drawHedge(C, r[14]); drawPole1(C, r[15]); wires(C, r[16], 26, 8.5, true); }],
      ['last touches', () => finishing(C, r[17])],
    ];
    return { C, steps };
  };
  A.draw = function (W, H, opt) {
    opt = opt || {};
    const log = opt.log || (() => {}), stage = opt.stage === undefined ? 99 : opt.stage;
    const { C, steps } = A.steps(W, H);
    steps.forEach((st, i) => { if (i <= stage) { st[1](); log(st[0]); } });
    return C;
  };
})(typeof self !== 'undefined' ? self : globalThis);
