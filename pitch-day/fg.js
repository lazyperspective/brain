'use strict';
const { T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm } = require('./engine');
const { wob, wobPath, arc, curve, fillPoly, outline, pick, grad, jit } = require('./lib');
const { HZ, SUN, skyCol } = require('./sky');
const { knollY, KNOLL } = require('./town');

// warm window-light lying across the grass (the house is behind us)
const PATCH = [[[640, 1092], [800, 1092], [905, 1012], [770, 1012]], [[822, 1092], [990, 1092], [1062, 1012], [925, 1012]],
[[782, 1003], [915, 1003], [985, 962], [868, 962]], [[935, 1003], [1070, 1003], [1118, 962], [1000, 962]]];
function inPoly(P, x, y) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i][1] > y) !== (P[j][1] > y)) && (x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0])) c = !c; } return c; }
const inPatch = (x, y) => PATCH.some(p => inPoly(p, x, y));

function drawKnoll(cv, seed, mid) {
  const R = rng32(seed);
  const crest = curve(KNOLL, 10);
  const poly = crest.concat([[1935, 1100], [420, 1100]]);
  // the verge between road and grass
  fillPoly(cv, [[300, 1100], [440, 1100], [540, 1030], [620, 992], [700, 966], [640, 972], [560, 1000], [450, 1052]], { tool: T.ptip, w: 6, col: hex('#262c60'), P: 1.08, ang: -0.6, sp: 0.5, cj: 0.015 }, R);
  // 1. the dark mass, blocked in with the side of the stick
  fillPoly(cv, poly, { tool: T.pastel, w: 15, colFn: (x, y) => mixc(mixc(hex('#17364c'), hex('#1e4a4c'), vnoise(x / 80, y / 50, 3)), hex('#2a3266'), 0.5 * vnoise(x / 130, y / 60, 9)), P: 1.02, ang: -0.11, sp: 0.55, cj: 0.015, maxLen: 200 }, R);
  fillPoly(cv, poly, { tool: T.pastel, w: 11, colFn: (x, y) => mixc(hex('#122c44'), hex('#235650'), vnoise(x / 60, y / 40, 13)), P: 0.8, ang: -0.3, sp: 1.2, cj: 0.015, maxLen: 120 }, R);
  for (let y = 880; y < 1080; y += 26) cv.smudge([[500, y + 60], [900, y + 20], [1400, y - 10], [1920, y - 40]], { r: 14, str: 0.1, pick: 0.3 });
  fillPoly(cv, poly, { tool: T.pencil, w: 1.5, col: hex('#101c44'), P: 0.5, ang: -1.05, sp: 3.4, jit: 0.5, maxLen: 60 }, R);
  for (let i = 0; i < 260; i++) {
    const x = 560 + R() * 1380, ky = knollY(x), y = ky + 30 + R() * (1090 - ky - 30), a = -1.2 + (R() - 0.5) * 0.5;
    let L = 40 + R() * 90; while (L > 8 && y + Math.sin(a) * L < knollY(x + Math.cos(a) * L) + 14) L -= 8; if (L <= 8) continue;
    const c = [hex('#2a2f70'), hex('#1b3f66'), hex('#16454a'), hex('#34306e'), hex('#1f5a52')][(R() * 5) | 0];
    cv.stroke(wob(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, R, 1, 0.05), { ...T.pastel, w: 8 + R() * 10, col: jit(c, 0.015, R), P: 0.62 + R() * 0.25, sa: 0.4, tin: 0.15, tout: 0.3 });
  }
  // 2. the light patch
  for (const p of PATCH) {
    fillPoly(cv, p, { tool: T.pastel, w: 8, colFn: (x, y) => mixc(hex('#a89a50'), hex('#d8bc68'), vnoise(x / 30, y / 20, 4)), P: 0.74, ang: -0.6, sp: 0.8, cj: 0.02, over: 3 }, R);
    const c = [(p[0][0] + p[2][0]) / 2, (p[0][1] + p[2][1]) / 2];
    cv.dust(c[0], c[1], 70, hex('#e8c878'), 0.13, 30);
  }
  // 3. grass, far to near
  const blade = (x, y, h, lean, col, w, P) => {
    const bend = (R() - 0.3) * h * 0.3;
    const pts = curve([[x, y], [x + lean * 0.35 + bend * 0.2, y - h * 0.5], [x + lean + bend, y - h]], 5);
    cv.stroke(pts, { ...T.pencil, w, col, P, tin: 0.02, tout: 0.5 });
  };
  const G = ['#1f5552', '#2a6a5a', '#1a4458', '#35786a', '#234a6a', '#2f5f78'].map(hex);
  const GL = ['#8fbf8a', '#c8d890', '#e8d898', '#ffc8a0', '#a8d0a0'].map(hex);
  const GW = ['#e8d080', '#f6e4a0', '#c8b860', '#ffe8b0', '#b8b060'].map(hex);
  const items = [];
  for (let i = 0; i < 9000; i++) {
    const x = 430 + R() * 1500, ky = knollY(x), y = ky + Math.pow(R(), 1.5) * (1090 - ky);
    if (y < ky - 1) continue;
    items.push({ x, y, ky });
  }
  items.sort((a, b) => a.y - b.y);
  let midDone = false;
  for (const it of items) {
    if (!midDone && it.y > it.ky + 16) { midDone = true; if (mid) mid(cv); }
    const { x, y, ky } = it;
    const dep = clamp((y - ky) / 200, 0, 1), sc = 0.55 + dep * 1.5 + (x > 1500 ? 0.1 : 0);
    const h = (12 + R() * 26) * sc, lean = (4 + R() * 12) * sc * (R() < 0.85 ? 1 : -0.6);
    const nearCrest = y - ky < 14;
    let col;
    if (inPatch(x, y) && R() < 0.8) col = GW[(R() * GW.length) | 0];
    else if (nearCrest && R() < 0.55) col = mixc(GL[(R() * GL.length) | 0], hex('#ffd0a0'), sstep(900, 1800, x) * 0.5);
    else if (R() < 0.13) col = mixc(GL[(R() * 3) | 0], G[1], 0.45);
    else col = G[(R() * G.length) | 0];
    blade(x, y, h, lean, jit(col, 0.02, R), (1.2 + R() * 1.4) * (0.7 + dep * 0.8), 0.7 + R() * 0.3);
  }
}

// tall seed heads, foxtails and evening flowers along the crest and through the grass
function drawFlora(cv, seed) {
  const R = rng32(seed);
  const stem = (x, y, h, lean, col, w) => { const pts = curve([[x, y], [x + lean * 0.3, y - h * 0.55], [x + lean, y - h]], 6); cv.stroke(pts, { ...T.pencil, w, col, P: 0.9, tin: 0, tout: 0.2 }); return pts[pts.length - 1]; };
  // foxtails catching the afterglow
  for (let i = 0; i < 70; i++) {
    const x = 470 + R() * 1450, ky = knollY(x), y = ky + R() * R() * 150, sc = 0.7 + clamp((y - ky) / 180, 0, 1) * 1.3;
    const h = (38 + R() * 46) * sc, lean = (8 + R() * 22) * sc;
    const tip = stem(x, y + 4, h, lean, hex('#1c3c48'), 1.3 * sc);
    const a0 = Math.atan2(-h * 0.45, lean * 0.7) + 0.5, L = (15 + R() * 10) * sc;
    const hp = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, a = a0 + t * 0.9; hp.push([tip[0] + Math.cos(a - 0.5) * L * t, tip[1] + Math.sin(a - 0.5) * L * t + t * t * L * 0.35]); }
    const warm = sstep(700, 1700, x);
    cv.stroke(hp, { ...T.ptip, w: 3.4 * sc, col: mixc(hex('#7f8a6a'), hex('#d8b070'), warm), P: 0.95, tin: 0.1, tout: 0.4 });
    for (let k = 0; k < 16; k++) { const q = hp[1 + ((R() * 5) | 0)], a = R() * 6.283, l = (2.5 + R() * 3) * sc; cv.stroke([[q[0], q[1]], [q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l]], { ...T.pencil, w: 0.8, col: mixc(hex('#e8e0a8'), hex('#ffd8a0'), warm), P: 0.75 }); }
    cv.stroke(hp.slice(0, 5).map(q => [q[0] + 0.8 * sc, q[1] - 0.8 * sc]), { ...T.oil, w: 1.1 * sc, col: mixc(hex('#f4f0c0'), hex('#ffe0b0'), warm), P: 0.8, tin: 0.2, tout: 0.4 });
  }
  // flowers: evening primrose (yellow), fleabane (white), wild pinks
  const kinds = [{ c: '#ffe070', c2: '#fff4b0', n: 4, r: 4.2 }, { c: '#e4dcf8', c2: '#ffffff', n: 9, r: 3.6 }, { c: '#f48ab4', c2: '#ffc0d4', n: 5, r: 3.8 }, { c: '#ff9a70', c2: '#ffd0a0', n: 5, r: 3.2 }];
  for (let g = 0; g < 26; g++) {
    const gx = 500 + R() * 1400, kind = kinds[(R() * R() * 4.2) | 0] || kinds[0], gk = knollY(gx), gy = gk + 8 + R() * R() * 170;
    const n = 4 + (R() * 9 | 0);
    for (let i = 0; i < n; i++) {
      const x = gx + (R() - 0.5) * 120, ky = knollY(x), y = Math.max(ky + 4, gy + (R() - 0.5) * 50), sc = 0.6 + clamp((y - ky) / 180, 0, 1) * 1.4;
      const h = (16 + R() * 34) * sc, tip = stem(x, y + 3, h, (2 + R() * 10) * sc, hex('#1f4a4c'), 1.1 * sc);
      const r = kind.r * sc * (0.8 + R() * 0.5), sq = 0.55 + R() * 0.35, rot = R() * 6.283;
      for (let k = 0; k < kind.n; k++) {
        const a = rot + k / kind.n * 6.283;
        cv.stroke([[tip[0] + Math.cos(a) * r * 0.25, tip[1] + Math.sin(a) * r * 0.25 * sq], [tip[0] + Math.cos(a) * r, tip[1] + Math.sin(a) * r * sq]], { ...T.oil, w: Math.max(1.2, r * (kind.n > 6 ? 0.32 : 0.62)), col: jit(hex(R() < 0.3 ? kind.c2 : kind.c), 0.03, R), P: 0.95 });
      }
      cv.stroke([[tip[0] - 0.3, tip[1]], [tip[0] + 0.3, tip[1]]], { ...T.oil, w: Math.max(1.2, r * 0.42), col: hex(kind.n > 6 ? '#ffd24a' : '#ff9a3a'), P: 1.1 });
    }
  }
  // a few big ones close to us, at the bottom edge
  const big = (x, y, r, kind, h) => {
    const tip = stem(x, y, h, r * 0.8, hex('#17404a'), 2.4);
    cv.stroke(curve([[x + 2, y - h * 0.3], [x + r * 1.4, y - h * 0.42], [x + r * 2.4, y - h * 0.36]], 5), { ...T.ptip, w: 4.5, col: hex('#2a6658'), P: 0.95, tin: 0.1, tout: 0.5 });
    const rot = R() * 6.283, sq = 0.62 + R() * 0.25;
    for (let k = 0; k < kind.n; k++) {
      const a = rot + k / kind.n * 6.283 + (R() - 0.5) * 0.15, ca = Math.cos(a), sa = Math.sin(a) * sq;
      const lit = ca * 0.7 - sa * 0.7 > 0.1;
      const p0 = [tip[0] + ca * r * 0.22, tip[1] + sa * r * 0.22], p1 = [tip[0] + ca * r, tip[1] + sa * r];
      cv.stroke(wob(p0[0], p0[1], p1[0], p1[1], R, 0.4, 0.05), { ...T.oil, w: r * (kind.n > 6 ? 0.3 : 0.56), col: jit(hex(lit ? kind.c2 : kind.c), 0.02, R), P: 0.95, tin: 0.15, tout: 0.1 });
      cv.stroke(wob(p0[0], p0[1], p1[0], p1[1], R, 0.3, 0.02), { ...T.pencil, w: 1, col: hex(kind.d), P: 0.5 });
    }
    cv.dust(tip[0], tip[1], r * 0.3, hex('#ffb040'), 0.8);
    for (let k = 0; k < 8; k++) { const a = R() * 6.283, rr = R() * r * 0.2; cv.stroke([[tip[0] + Math.cos(a) * rr, tip[1] + Math.sin(a) * rr * sq], [tip[0] + Math.cos(a) * rr + 0.6, tip[1] + Math.sin(a) * rr * sq]], { ...T.oil, w: 2, col: hex(R() < 0.5 ? '#ffd24a' : '#e8882a'), P: 1.05 }); }
  };
  const KB = [{ c: '#cfc6f0', c2: '#fbf6ff', d: '#8a80c8', n: 11 }, { c: '#f0c850', c2: '#fff0a0', d: '#b88a30', n: 4 }, { c: '#e87aa8', c2: '#ffb8d0', d: '#a84a80', n: 6 }];
  for (const [x, y, r, k, h] of [[1836, 1092, 25, 0, 96], [1762, 1098, 18, 1, 66], [1622, 1096, 21, 2, 70], [1890, 1050, 16, 1, 60], [1450, 1100, 19, 0, 62], [1284, 1098, 16, 1, 52], [1540, 1090, 13, 0, 40], [1130, 1100, 15, 2, 50], [1700, 1040, 12, 0, 44]]) big(x, y, r, KB[k], h);
  // fireflies
  for (let i = 0; i < 17; i++) {
    const x = 520 + R() * 1380, ky = knollY(x), y = ky - 30 + R() * 190;
    if (i % 3 === 0) { const a = R() * 6.283; cv.stroke(arc(x - Math.cos(a) * 14, y - Math.sin(a) * 9, 14, 9, a, a + 1.4 + R(), R, 0.5), { ...T.pencil, w: 0.9, col: hex('#d8f08a'), P: 0.5, tin: 0.6, tout: 0.1 }); }
    cv.dust(x, y, 7 + R() * 5, hex('#c8f070'), 0.3); cv.dust(x, y, 2.6, hex('#f4ffc0'), 0.7);
    cv.stroke([[x - 0.4, y], [x + 0.4, y]], { ...T.oil, w: 2.2, col: hex('#fbffe0'), P: 1.2 });
  }
}

// ---------------------------------------------------------------- the cat (seen from behind, looking up)
function drawCat(cv, seed) {
  const R = rng32(seed), cx = 1150, by = knollY(1150) + 9, k = 1.42;
  const dark = hex('#231f4c'), dark2 = hex('#3a2e72'), rim = hex('#ffb89c'), cool = hex('#7f8ce0');
  const Q = (dx, dy) => [cx + dx * k, by + dy * k], QS = a => a.map(p => Q(p[0], p[1]));
  // tail first, lying to the right and curling up
  const tail = curve(QS([[14, -6], [40, -2], [62, -8], [68, -24], [60, -35]]), 8);
  cv.stroke(tail, { ...T.conte, w: 8.5 * k, col: dark, P: 1.15, tin: 0, tout: 0.25 });
  cv.stroke(tail.map(p => [p[0] + 1.6 * k, p[1] - 2.6 * k]).slice(6), { ...T.oil, w: 1.5, col: rim, P: 0.75, tin: 0.3, tout: 0.3 });
  // body: pear shape
  const body = curve(QS([[-2, -60], [-15, -50], [-25, -28], [-29, -8], [-20, 4], [6, 6], [25, 2], [30, -12], [25, -34], [14, -54], [-2, -60]]), 6);
  fillPoly(cv, body, { tool: T.ptip, w: 6, col: dark, P: 1.15, ang: 1.45, sp: 0.5, cj: 0.01 }, R);
  fillPoly(cv, body, { tool: T.pencil, w: 1.4, col: dark2, P: 0.62, ang: 1.25, sp: 2.8, jit: 0.5, maxLen: 30 }, R);
  // head, tipped back toward the sky
  const [hx, hy] = Q(3, -71), hr = 18.5 * k;
  const head = arc(hx, hy, hr, hr * 0.9, 0, 6.283, R, 0.5);
  fillPoly(cv, head, { tool: T.ptip, w: 5, col: dark, P: 1.15, ang: 0.4, sp: 0.5 }, R);
  const H = (dx, dy) => [hx + dx * k, hy + dy * k];
  const earL = [H(-16, -6), H(-16.5, -27), H(-3, -14)], earR = [H(5, -15), H(18, -28), H(17.5, -5)];
  fillPoly(cv, earL, { tool: T.ptip, w: 3.4, col: dark, P: 1.15, ang: 1.2, sp: 0.5 }, R);
  fillPoly(cv, earR, { tool: T.ptip, w: 3.4, col: dark, P: 1.15, ang: 1.9, sp: 0.5 }, R);
  fillPoly(cv, head, { tool: T.pencil, w: 1.3, col: dark2, P: 0.55, ang: 1.0, sp: 2.8, jit: 0.5 }, R);
  fillPoly(cv, [H(4, -14), H(15, -24), H(15.5, -9)], { tool: T.pencil, w: 1.2, col: hex('#6a3a6a'), P: 0.6, ang: 1.9, sp: 2, jit: 0.3 }, R);
  // afterglow rim on the right, cool sky rim on the left
  cv.stroke([H(6, -14.5), H(18, -28), H(18.6, -6)], { ...T.oil, w: 1.7, col: rim, P: 0.85 });
  cv.stroke(arc(hx, hy, hr + 0.3, hr * 0.9 + 0.3, -0.35, 0.95, R, 0.3), { ...T.oil, w: 1.8, col: rim, P: 0.85, tin: 0.2, tout: 0.3 });
  cv.stroke(curve(QS([[15, -54], [26, -34], [31, -12], [26, 1]]), 6), { ...T.oil, w: 1.9, col: rim, P: 0.8, tin: 0.2, tout: 0.35 });
  cv.stroke([H(-16.5, -26), H(-16.6, -7)], { ...T.pencil, w: 1.3, col: cool, P: 0.6 });
  cv.stroke(arc(hx, hy, hr + 0.2, hr * 0.9 + 0.2, 2.5, 3.9, R, 0.3), { ...T.pencil, w: 1.2, col: cool, P: 0.45, tin: 0.2, tout: 0.3 });
  cv.stroke(curve(QS([[-15, -50], [-25.5, -28], [-29.5, -9]]), 6), { ...T.pencil, w: 1.3, col: cool, P: 0.5, tin: 0.2, tout: 0.4 });
  // whiskers catching light
  for (const [dx, dy] of [[17, -4], [18, 1], [16, 5]]) cv.stroke(wob(hx + hr * 0.82, hy + (3 + dy * 0.2) * k, hx + hr * 0.82 + dx * 0.8 * k, hy + dy * k, R, 0.2, 0.02), { ...T.pencil, w: 0.9, col: hex('#ffd8c0'), P: 0.6, tin: 0.1, tout: 0.5 });
  for (const [dx, dy] of [[-15, -3], [-16, 2]]) cv.stroke(wob(hx - hr * 0.85, hy + 3 * k, hx - hr * 0.85 + dx * 0.8 * k, hy + (2 + dy) * k, R, 0.2, 0.02), { ...T.pencil, w: 0.9, col: hex('#9aa0e8'), P: 0.45, tin: 0.1, tout: 0.5 });
}

// ---------------------------------------------------------------- the bicycle, left where it was dropped against the evening
function drawBike(cv, seed) {
  const R = rng32(seed);
  const ox = 1508, oy = knollY(1508) + 6, k = 41, sl = -0.118; // origin: rear tyre contact
  const cs = Math.cos(sl), sn = Math.sin(sl);
  const M = (x, y) => [ox + (x * cs - (-y) * sn) * k, oy + (x * sn + (-y) * cs) * k];
  const dark = hex('#1a1840'), frame = hex('#8c2a50'), frame2 = hex('#c04468'), rim = hex('#ffb89c'), steel = hex('#6a70b0');
  const L = (a, b, col, w, P, tool) => cv.stroke(wob(a[0], a[1], b[0], b[1], R, 0.35, 0.004), { ...(tool || T.conte), w, col, P: P || 1.05, tin: 0, tout: 0 });
  const A = [0, 1], B = [3.12, 1], BB = [1.22, 0.86], S = [0.92, 2.5], ST = [1.0, 2.22], HT = [2.52, 2.62], HB = [2.66, 2.12];
  const wheel = (c) => {
    const p = M(c[0], c[1]);
    // spokes
    for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + 0.1; cv.stroke([[p[0], p[1]], [p[0] + Math.cos(a) * k * 0.9, p[1] + Math.sin(a) * k * 0.9]], { ...T.pencil, w: 0.8, col: i % 3 === 0 ? hex('#c8a8c8') : steel, P: 0.55 }); }
    cv.stroke(arc(p[0], p[1], k * 0.93, k * 0.93, 0, 6.4, R, 0.5), { ...T.conte, w: 5.2, col: dark, P: 1.15, tin: 0, tout: 0 });
    cv.stroke(arc(p[0], p[1], k * 0.82, k * 0.82, 0, 6.4, R, 0.4), { ...T.pencil, w: 1.2, col: steel, P: 0.7, tin: 0, tout: 0 });
    cv.stroke(arc(p[0], p[1], k * 1.0, k * 1.0, -1.9, 0.25, R, 0.4), { ...T.oil, w: 1.5, col: rim, P: 0.8, tin: 0.25, tout: 0.25 });
    cv.stroke(arc(p[0], p[1], k * 0.84, k * 0.84, 0.6, 2.2, R, 0.4), { ...T.pencil, w: 1.1, col: hex('#ffd0b8'), P: 0.6, tin: 0.25, tout: 0.25 });
    cv.stroke([[p[0] - 1, p[1]], [p[0] + 1, p[1]]], { ...T.conte, w: 6, col: dark, P: 1.1 });
    // mudguard
    cv.stroke(arc(p[0], p[1], k * 1.13, k * 1.13, c === A ? -2.9 : -2.4, c === A ? -0.6 : -0.4, R, 0.4), { ...T.conte, w: 2.6, col: frame, P: 1.05, tin: 0, tout: 0 });
  };
  wheel(A); wheel(B);
  // kickstand
  L(M(0.2, 0.95), M(0.62, 0.02), steel, 2.2);
  // frame
  const tube = (a, b, w) => { L(M(...a), M(...b), frame, w); const pa = M(...a), pb = M(...b); cv.stroke(wob(pa[0] + 0.6, pa[1] - 1.2, pb[0] + 0.6, pb[1] - 1.2, R, 0.3, 0.004), { ...T.pencil, w: 1.1, col: frame2, P: 0.7 }); };
  tube(BB, A, 3.4); tube(ST, A, 2.8); tube(BB, S, 4.2); tube(ST, [2.56, 2.5], 4.2); tube(HB, BB, 4.4);
  L(M(...HT), M(...HB), frame, 5); L(M(...HB), M(...B), frame, 3.6); // head + fork
  // top-tube glow
  { const a = M(...ST), b = M(2.56, 2.5); cv.stroke(wob(a[0], a[1] - 2.6, b[0], b[1] - 2.6, R, 0.3, 0.004), { ...T.oil, w: 1.2, col: rim, P: 0.75, tin: 0.2, tout: 0.2 }); }
  // chainring, crank, pedals, chain
  { const p = M(...BB); cv.stroke(arc(p[0], p[1], k * 0.27, k * 0.27, 0, 6.4, R, 0.2), { ...T.conte, w: 2.4, col: dark, P: 1.1 }); L(p, M(1.5, 0.52), dark, 2.6); L(M(1.38, 0.5), M(1.66, 0.5), dark, 4); L(p, M(0.96, 1.18), dark, 2.4); L(M(0.82, 1.2), M(1.08, 1.2), dark, 3.6);
    const a = M(...A); L([p[0], p[1] + k * 0.26], [a[0], a[1] + k * 0.1], dark, 1.2, 0.8, T.pencil); L([p[0], p[1] - k * 0.26], [a[0], a[1] - k * 0.1], dark, 1.2, 0.8, T.pencil); }
  // saddle
  { const s = M(...S); L(M(0.62, 2.6), M(1.22, 2.56), dark, 7.5, 1.15); cv.stroke(wob(M(0.6, 2.7)[0], M(0.6, 2.7)[1], M(1.24, 2.65)[0], M(1.24, 2.65)[1], R, 0.3, 0.02), { ...T.oil, w: 1.4, col: rim, P: 0.8, tin: 0.2, tout: 0.2 }); }
  // stem + handlebar
  L(M(...HT), M(2.46, 2.98), steel, 2.6);
  cv.stroke(curve([M(2.46, 2.98), M(2.3, 3.08), M(2.06, 3.06), M(1.94, 2.94)], 6), { ...T.conte, w: 3, col: dark, P: 1.1, tin: 0, tout: 0 });
  cv.stroke(curve([M(2.44, 3.04), M(2.3, 3.14), M(2.08, 3.12)], 6), { ...T.oil, w: 1.2, col: rim, P: 0.8 });
  { const b = M(2.38, 3.1); cv.stroke(arc(b[0], b[1] - 4, 4.5, 4.5, 0, 6.3, R, 0.2), { ...T.conte, w: 2.4, col: steel, P: 1 }); cv.stroke(arc(b[0], b[1] - 4, 5, 5, -1.6, 0.3, R, 0.2), { ...T.oil, w: 1.2, col: hex('#ffe0c8'), P: 0.9 }); } // bell
  // front basket (wire)
  const q = [[2.78, 2.42], [3.42, 2.48], [3.5, 3.02], [2.74, 2.96]].map(p => M(...p));
  fillPoly(cv, q, { tool: T.pencil, w: 1.1, col: hex('#3a3470'), P: 0.75, ang: 0.9, sp: 3.4, jit: 0.2 }, R);
  fillPoly(cv, q, { tool: T.pencil, w: 1.1, col: hex('#3a3470'), P: 0.75, ang: -0.75, sp: 3.4, jit: 0.2 }, R);
  outline(cv, q, { tool: T.conte, col: dark, w: 2.2, P: 1.05 }, R, true);
  cv.stroke(wob(q[3][0], q[3][1] - 1.5, q[2][0], q[2][1] - 1.5, R, 0.3, 0.01), { ...T.oil, w: 1.3, col: rim, P: 0.8 });
  L(M(2.62, 2.5), q[0], steel, 1.8);
  // head lamp: off. reflector at the back: one small ember
  { const r = M(-0.5, 1.75); L(M(0.2, 2.0), r, steel, 1.6); cv.dust(r[0], r[1], 4, hex('#ff6a5a'), 0.35); cv.stroke([[r[0] - 1.2, r[1]], [r[0] + 1.2, r[1]]], { ...T.oil, w: 3.2, col: hex('#ff8a6a'), P: 1.1 }); }
}
// ---------------------------------------------------------------- hydrangeas in the near-left corner
function drawHedge(cv, seed) {
  const R = rng32(seed);
  const top = x => 1012 + 0.19 * x + 16 * Math.sin(x / 31) + 8 * Math.sin(x / 13 + 1);
  const poly = []; for (let x = -10; x <= 380; x += 10) poly.push([x, top(x)]); poly.push([380, 1100], [-10, 1100]);
  fillPoly(cv, poly, { tool: T.pastel, w: 12, colFn: (x, y) => mixc(hex('#15344a'), hex('#1f4c50'), vnoise(x / 40, y / 30, 8)), P: 1.05, ang: -0.3, sp: 0.5, cj: 0.015 }, R);
  // leaves
  for (let i = 0; i < 420; i++) {
    const x = R() * 370, y = top(x) - 4 + R() * (1090 - top(x)), a = -0.9 + (R() - 0.5) * 2.4, L = 8 + R() * 10;
    const c = [hex('#1c4a4e'), hex('#2a6658'), hex('#18395a'), hex('#3a7a66'), hex('#234a70')][(R() * 5) | 0];
    const tip = [x + Math.cos(a) * L, y + Math.sin(a) * L];
    cv.stroke(curve([[x, y], [x + Math.cos(a + 0.5) * L * 0.5, y + Math.sin(a + 0.5) * L * 0.5], tip], 4), { ...T.ptip, w: 4.5 + R() * 3, col: jit(c, 0.02, R), P: 0.95, tin: 0.1, tout: 0.5 });
    if (R() < 0.4) cv.stroke([[x, y], tip], { ...T.pencil, w: 0.9, col: hex(R() < 0.5 ? '#6aa88a' : '#0f2440'), P: 0.5 });
  }
  // flower heads: mops of small four-petalled florets
  const pal = [['#6f8ae8', '#a8b8ff', '#4a5ac0'], ['#9a7ae0', '#c8b0f8', '#6a4ab0'], ['#e88ac0', '#ffc0dc', '#b85a98'], ['#7fb0f0', '#c0dcff', '#4f78c8']];
  const heads = [[38, 1032, 26], [96, 1058, 22], [150, 1044, 25], [214, 1068, 21], [268, 1062, 19], [12, 1074, 20], [324, 1076, 16], [180, 1082, 18], [70, 1012, 15]];
  for (const [hx, hy0, hr] of heads) {
    const hy = hy0 - 6, p = pal[(R() * pal.length) | 0].map(hex);
    cv.dust(hx, hy, hr * 0.9, mixc(p[2], hex('#1a2a5a'), 0.3), 0.6);
    for (let i = 0; i < hr * 5.5; i++) {
      const a = R() * 6.283, rr = Math.sqrt(R()) * hr, x = hx + Math.cos(a) * rr, y = hy + Math.sin(a) * rr * 0.86;
      const up = (-Math.sin(a) * rr * 0.6 + Math.cos(a) * rr * 0.6) / hr; // upper-right faces the glow
      const col = up > 0.35 ? mixc(p[1], hex('#ffd8d0'), 0.25) : up > -0.2 ? p[0] : p[2];
      const s = 2.2 + R() * 1.6, rot = R() * 1.57;
      for (let k = 0; k < 4; k++) { const b = rot + k * 1.5708; cv.stroke([[x, y], [x + Math.cos(b) * s, y + Math.sin(b) * s]], { ...T.oil, w: 2 + R() * 0.8, col: jit(col, 0.03, R), P: 0.92 }); }
      if (R() < 0.3) cv.stroke([[x - 0.3, y], [x + 0.3, y]], { ...T.pencil, w: 1, col: hex('#fff0c0'), P: 0.7 });
    }
  }
}

// ---------------------------------------------------------------- the orange road mirror at the lip of the hill
function drawMirror(cv, seed) {
  const R = rng32(seed), x = 688, yb = knollY(688) + 16, yt = 868, mr = 19, my = yt - mr + 2;
  const or = hex('#ff8a3c'), orD = hex('#b8502c');
  cv.stroke(wob(x, yb, x + 1, my + mr, R, 0.4, 0.003), { ...T.conte, w: 4.2, col: orD, P: 1.1, tin: 0, tout: 0 });
  cv.stroke(wob(x + 1.6, yb - 4, x + 2.4, my + mr, R, 0.3, 0.003), { ...T.oil, w: 1.2, col: hex('#ffc08a'), P: 0.8 });
  const disc = arc(x, my, mr, mr, 0, 6.283, R, 0.4);
  // what it shows: the sky behind us, and one corner of the lit cloud
  fillPoly(cv, disc, { tool: T.ptip, w: 4, colFn: (px, py) => grad([[0, hex('#3a4aa8')], [0.5, hex('#6f8fd8')], [0.75, hex('#e8a0b8')], [1, hex('#ffc890')]], (py - my + mr) / (2 * mr)), P: 1.1, ang: 0.1, sp: 0.5 }, R);
  for (const [dx, dy, r] of [[-7, 3, 7], [-1, -1, 8], [5, 4, 6]]) cv.stroke(arc(x + dx, my + dy, r * 0.5, r * 0.4, 0, 6.3, R, 0.2), { ...T.ptip, w: r * 0.9, col: hex(dy < 0 ? '#fff0c8' : '#ffb8a8'), P: 1.0 });
  cv.stroke(arc(x, my, mr * 0.72, mr * 0.72, -2.6, -1.5, R, 0.3), { ...T.oil, w: 1.4, col: hex('#ffffff'), P: 0.7, tin: 0.3, tout: 0.3 });
  cv.stroke(arc(x, my, mr, mr, 0, 6.4, R, 0.4), { ...T.oil, w: 3.6, col: or, P: 1.05, tin: 0, tout: 0 });
  cv.stroke(arc(x, my, mr + 1.5, mr + 1.5, -1.3, 0.6, R, 0.3), { ...T.oil, w: 1.2, col: hex('#ffd8a8'), P: 0.85, tin: 0.2, tout: 0.2 });
  cv.stroke(arc(x, my, mr + 3.5, mr + 3.5, -2.75, -0.4, R, 0.3), { ...T.conte, w: 2.6, col: orD, P: 1.05 }); // hood
}
module.exports = { drawKnoll, drawFlora, drawCat, drawBike, drawHedge, drawMirror };
