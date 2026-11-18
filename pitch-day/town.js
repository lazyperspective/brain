'use strict';
const { T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm } = require('./engine');
const { wob, wobPath, arc, curve, fillPoly, outline, pick, grad, jit } = require('./lib');
const { HZ, SUN, skyCol } = require('./sky');

// ------------------------------------------------------------ camera
const CAM = [12, 9, 0], F = 1598;
const yawA = Math.atan(0.1), pitA = Math.atan(86 / 1598);
const cy = Math.cos(yawA), sy = Math.sin(yawA), cp = Math.cos(pitA), sp = Math.sin(pitA);
function proj(x, y, z) {
  const vx = x - CAM[0], vy = y - CAM[1], vz = z - CAM[2];
  const xc = vx * cy - vz * sy, zc = vx * sy + vz * cy;
  const yc = vy * cp - zc * sp, zz = vy * sp + zc * cp;
  return [960 + F * xc / zz, 540 - F * yc / zz, zz];
}
const sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const SEA = -53.6;
function hillGain(x, z) { return 82 * sm((-x - 66 - 0.03 * z) / 200) * (0.8 + 0.2 * Math.sin(z / 85 + 1)) * sm((z - 60) / 200) * (1 - 0.6 * sm((z - 560) / 140)); }
function terr(x, z) { return -52 * sm((z - 10) / 290) + hillGain(x, z); }
function shore(x) { return x < 30 ? 692 + 0.04 * (30 - x) : 692 - 0.86 * (x - 30) + 14 * Math.sin(x / 37); }
const HAZE_L = hex('#5c60ac'), HAZE_R = hex('#b47ca8');
function atm(col, d, X, k) {
  const fog = (1 - Math.exp(-Math.max(0, d - 50) / 560)) * (k === undefined ? 0.72 : k);
  return mixc(col, mixc(HAZE_L, HAZE_R, sstep(500, 1750, X)), fog);
}
const LS = (() => { const v = [0.50, 0.16, 0.85], l = Math.hypot(...v); return v.map(a => a / l); })();
function wallShade(alb, n) {
  const warm = Math.max(0, n[0] * LS[0] + n[1] * LS[1] + n[2] * LS[2]);
  const c = [alb[0] * 0.40 + 0.03, alb[1] * 0.43 + 0.04, alb[2] * 0.70 + 0.10];
  return mixc(c, [Math.min(1, alb[0] * 1.02 + 0.10), alb[1] * 0.80 + 0.03, alb[2] * 0.74 + 0.05], Math.min(1, warm * 1.5));
}
function roofShade(alb, n, X) {
  const base = [alb[0] * 0.42, alb[1] * 0.48, alb[2] * 0.76];
  let refl, wet = 0.42;
  if (n[1] > 0.97) { refl = mixc(skyCol(X, HZ - 110), hex('#ffe2b8'), 0.15); wet = 0.55; }
  else if (n[2] < -0.2) refl = hex('#3a58b6');
  else if (n[0] > 0.2) refl = hex('#c98aa6');
  else if (n[0] < -0.2) refl = hex('#3f62b8');
  else refl = hex('#8a80c0');
  return mixc(base, refl, wet);
}
const centroid = P => { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; };
const bbox = P => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const p of P) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; } return [a, b, c, d]; };
const pr3 = P3 => P3.map(p => proj(p[0], p[1], p[2]));

// knoll crest (foreground mound, drawn later in fg.js): y of crest at screen x
const KNOLL = [[430, 1100], [520, 1040], [600, 1000], [690, 972], [800, 961], [960, 948], [1150, 930], [1350, 908], [1540, 884], [1720, 862], [1930, 842]];
function knollY(X) { for (let i = 1; i < KNOLL.length; i++) if (X <= KNOLL[i][0]) { const a = KNOLL[i - 1], b = KNOLL[i]; return a[1] + (b[1] - a[1]) * (X - a[0]) / (b[0] - a[0]); } return 842; }
const underKnoll = (X, Y) => X > 440 && Y > knollY(X) + 6;

// generic face fill, level of detail by screen size
function face(cv, R, poly, col, o) {
  o = o || {};
  const b = bbox(poly), bw = b[2] - b[0], bh = b[3] - b[1], dim = Math.min(bw, bh);
  if (b[2] < -20 || b[0] > 1940 || b[3] < 0 || b[1] > 1100) return;
  if (dim < 1.6) {
    const c = centroid(poly);
    if (bw > bh) cv.stroke([[b[0], c[1]], [b[2], c[1]]], { ...T.ptip, w: Math.max(1, bh), col, P: 1.05 });
    else cv.stroke([[c[0], b[1]], [c[0], b[3]]], { ...T.ptip, w: Math.max(1, bw), col, P: 1.05 });
    return;
  }
  const w = clamp(dim * 0.3, 1.3, o.wmax || 6);
  fillPoly(cv, poly, { tool: T.ptip, w, col, P: o.P || 1.06, ang: o.ang || 0, sp: 0.6, over: 0.25, cj: 0.012, maxLen: 140 }, R);
  if (dim > 9 && o.tex) fillPoly(cv, poly, { tool: T.pencil, w: 1.15, col: o.tex, P: 0.5, ang: o.ang2 === undefined ? -0.9 : o.ang2, sp: o.tsp || 3.2, jit: 0.5, over: 0.2 }, R);
}
function pline(cv, R, a, b, col, w, P, tool) { cv.stroke(wob(a[0], a[1], b[0], b[1], R, Math.min(0.45, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.02), 0.006), { ...(tool || T.pencil), w: w || 1.2, col, P: P || 0.8 }); }

// ------------------------------------------------------------ far shore, sea
function drawFar(cv, seed) {
  const R = rng32(seed);
  // far ranges on the left
  const ridge = (x0, x1, yb, amp, sd, col, P) => {
    const top = []; for (let x = x0; x <= x1; x += 6) { const t = (x - x0) / (x1 - x0); const f = fbm(x / 210 + sd, sd, sd | 0, 4); top.push([x, yb - amp * (0.12 + 1.5 * Math.pow(f, 1.7) + 0.25 * Math.exp(-(((t - 0.3) / 0.12) ** 2))) * (1 - sstep(0.6, 1, t))]); }
    const poly = top.concat([[x1, HZ + 3], [x0, HZ + 3]]);
    fillPoly(cv, poly, { tool: T.pastel, w: 7, colFn: (x, y) => mixc(col, mixc(skyCol(x, HZ - 6), hex('#b9a0d0'), 0.5), sstep(yb - amp * 0.5, yb, y) * 0.6), P, ang: 0.02, sp: 0.55, cj: 0.012, maxLen: 160 }, R);
    for (let i = 0; i < (x1 - x0) / 9; i++) { const j = (R() * (top.length - 2)) | 0, p = top[j], dn = 3 + R() * (HZ - p[1]) * 0.7, L = 8 + R() * 22, sl = (R() < 0.5 ? 0.55 : -0.5) + (R() - 0.5) * 0.3; cv.stroke(wob(p[0], p[1] + dn, p[0] + L, p[1] + dn + L * sl, R, 0.4, 0.02), { ...T.pencil, w: 1.1, col: mixc(col, R() < 0.5 ? hex('#4a4296') : hex('#e0b8d8'), 0.35), P: 0.4 }); }
    cv.stroke(top.map(p => [p[0], p[1] + 0.5]), { ...T.pencil, w: 1.1, col: mixc(col, hex('#3c3a8a'), 0.5), P: 0.5 });
    return top;
  };
  ridge(-10, 1010, HZ, 62, 3.1, hex('#a590cf'), 0.95);
  ridge(-10, 760, HZ, 44, 7.7, hex('#7b74ba'), 1.0);
  for (let k = 0; k < 3; k++) cv.smudge([[-10, HZ - 4 - k * 5], [500, HZ - 5 - k * 5], [1000, HZ - 3 - k * 3]], { r: 6, str: 0.1, pick: 0.35 });
  // islands under the glow
  const isl = (x0, x1, amp, sd, col) => {
    const top = []; for (let x = x0; x <= x1; x += 4) { const t = (x - x0) / (x1 - x0); top.push([x, HZ + 1 - amp * Math.pow(Math.sin(Math.PI * t), 0.8) * (0.5 + 0.5 * fbm(x / 60 + sd, sd, 3, 3))]); }
    const poly = top.concat([[x1, HZ + 3], [x0, HZ + 3]]);
    fillPoly(cv, poly, { tool: T.ptip, w: 3.2, col, P: 1.0, ang: 0, sp: 0.6, cj: 0.015 }, R);
  };
  isl(1180, 1420, 13, 1.3, hex('#b983ae')); isl(1560, 1800, 20, 4.2, hex('#a56f9f')); isl(1730, 1935, 30, 9.9, hex('#7f5f9c')); isl(940, 1120, 9, 6.1, hex('#b592c4'));
  // lights of the far shore
  const lc = ['#ffe6a8', '#ffd08a', '#fff4dc', '#ffb890', '#bff0e0'].map(hex);
  for (let i = 0; i < 260; i++) {
    const x = R() * 990, y = HZ - 1 - R() * R() * 9;
    cv.stroke([[x - 0.5, y], [x + 0.5 + R(), y]], { ...T.oil, w: 0.9 + R() * 0.9, col: lc[(R() * 5) | 0], P: 0.9 + R() * 0.3 });
  }
  for (let i = 0; i < 46; i++) { const x = 1560 + R() * 360, y = HZ - 1 - R() * 5; cv.stroke([[x - 0.5, y], [x + 0.8, y]], { ...T.oil, w: 1 + R() * 0.8, col: lc[(R() * 4) | 0], P: 1 }); }
  // radio mast with its red lamps on the nearer range
  const tx = 318, ty = HZ - 24;
  pline(cv, R, [tx, ty + 8], [tx, ty - 44], hex('#4a4a8e'), 1.3, 0.8); pline(cv, R, [tx - 5, ty + 8], [tx, ty - 30], hex('#4a4a8e'), 0.9, 0.6); pline(cv, R, [tx + 5, ty + 8], [tx, ty - 30], hex('#4a4a8e'), 0.9, 0.6);
  for (const dy of [-44, -28, -12]) { cv.dust(tx, ty + dy, 3.2, hex('#ff5a5a'), 0.5); cv.stroke([[tx - 0.4, ty + dy], [tx + 0.4, ty + dy]], { ...T.oil, w: 1.9, col: hex('#ff8a70'), P: 1.1 }); }
}
function seaCol(x, y) {
  const t = clamp((y - HZ) / 230, 0, 1);
  let c = skyCol(x, HZ - 4 - (y - HZ) * 1.9);
  c = mixc(c, hex('#2b5a8a'), 0.18 + 0.4 * t);
  c = mixc(c, hex('#3a3f86'), 0.35 * t * t);
  return c;
}
function drawSea(cv, seed) {
  const R = rng32(seed);
  const yb = 900;
  for (let y = HZ + 1; y < yb; y += 3.2 + (y - HZ) * 0.018) {
    let x = -60 * R();
    const sc = 1 + (y - HZ) / 45;
    while (x < 1930) {
      const L = (22 + R() * 70) * Math.min(3, sc), yy = y + (R() - 0.5) * 3;
      if (!underKnoll(x + L / 2, yy)) cv.stroke(wob(x, yy, x + L, yy + (R() - 0.5) * 1.2, R, 0.5, 0.004), { ...T.pastel, w: 3 + sc * 1.1 + R() * 2, col: jit(seaCol(x + L / 2, yy), 0.016, R), P: 0.95 + R() * 0.1, sa: 0.25, tin: 0.12, tout: 0.15 });
      x += L * (0.42 + R() * 0.25);
    }
  }
  for (let y = HZ + 8; y < yb; y += 22) cv.smudge([[-10, y], [600, y + 2], [1300, y - 1], [1930, y + 1]], { r: 9, str: 0.12, pick: 0.4 });
  // darker swell lines and bright sky-lanes
  for (let i = 0; i < 520; i++) {
    const y = HZ + 3 + Math.pow(R(), 1.4) * 230, x = R() * 1920, sc = 1 + (y - HZ) / 40, L = (10 + R() * 40) * Math.min(3.5, sc);
    if (underKnoll(x, y)) continue;
    const base = seaCol(x, y), dark = R() < 0.55;
    cv.stroke(wob(x - L / 2, y, x + L / 2, y + (R() - 0.5), R, 0.4, 0.004), { ...T.pencil, w: 1.1 + R() * 0.9, col: dark ? mixc(base, hex('#2a2f7a'), 0.5) : mixc(base, hex('#fff0d0'), 0.45), P: 0.5 + R() * 0.3 });
  }
  // the gold road on the water under the afterglow
  for (let i = 0; i < 900; i++) {
    const t = Math.pow(R(), 1.5), y = HZ + 1.5 + t * 215;
    const spread = 60 + t * 330, x = SUN[0] - 60 + (R() + R() + R() - 1.5) * spread;
    if (x > 1925 || underKnoll(x, y)) continue;
    const L = 3 + R() * (8 + t * 26), near = Math.abs(x - SUN[0] + 60) / spread;
    const col = hex(['#fff2c0', '#ffd98a', '#ffbf7a', '#ff9f80', '#ffe6b0'][(R() * 5) | 0]);
    cv.stroke([[x - L / 2, y], [x + L / 2, y + (R() - 0.5) * 0.6]], { ...T.oil, w: 0.9 + t * 1.8 + R() * 0.8, col, P: 0.72 + R() * 0.35 - near * 0.2 });
  }
  cv.dust(SUN[0] - 60, HZ + 6, 150, hex('#ffd9a0'), 0.16, 9);
  // pink lane on the left reflecting the evening belt
  for (let i = 0; i < 260; i++) {
    const t = R(), y = HZ + 2 + t * 130, x = R() * 900, L = 6 + R() * 30;
    cv.stroke([[x - L / 2, y], [x + L / 2, y]], { ...T.oil, w: 0.9 + t * 1.2, col: hex(R() < 0.5 ? '#f6a6b6' : '#c9b4ec'), P: 0.5 + R() * 0.3 });
  }
}

// ------------------------------------------------------------ town model
const SXS = [-268, -212, -156, -102, -50, 0, 50, 104, 160, 218, 278, 340];
const SZS = [96, 172, 252, 336, 428, 536, 632];
const MR = 4.6, hwx = x => x === 0 ? MR + 0.5 : 2.2, HWZ = 2.6;
const WALLS = ['#e8dcc8', '#f0ece4', '#e6d8a8', '#c0c0c8', '#e2b4a4', '#bcdcc8', '#b08868', '#d8c8b0', '#e8d0d8', '#c8d4e8'].map(hex);
const ROOFS = ['#5a6a88', '#38908c', '#a85a50', '#505866', '#4a68a8', '#4f8a6a', '#7a5a78', '#38908c', '#6a7896', '#b0705a'].map(hex);
const CONC = ['#c8c4c0', '#d8d0c0', '#b0b8c8', '#d8b8b8', '#c0ccc0', '#e0d8d0'].map(hex);
const WLIT = ['#ffe9a0', '#ffd680', '#fff4d4', '#ffc878', '#ffe0a0', '#fff0c0', '#b4f0e4', '#ffb890'].map(hex);

function buildTown(seed) {
  const R = rng32(seed), objs = [];
  const add = (d, fn) => objs.push({ d, fn });
  const vis = (X, Y) => X > -60 && X < 1980 && Y > 400 && Y < 1140;
  const xb = [-330].concat(SXS).concat([400]), zb = [36].concat(SZS).concat([700]);
  // ---- ground cells and lots, block by block
  for (let bi = 0; bi < xb.length - 1; bi++) for (let bj = 0; bj < zb.length - 1; bj++) {
    const xa = xb[bi] + (bi > 0 ? hwx(xb[bi]) : 0), xe = xb[bi + 1] - (bi < xb.length - 2 ? hwx(xb[bi + 1]) : 0);
    const za = zb[bj] + (bj > 0 ? HWZ : 0), ze = zb[bj + 1] - (bj < zb.length - 2 ? HWZ : 0);
    const nxc = Math.ceil((xe - xa) / 14), nzc = Math.ceil((ze - za) / 13);
    for (let i = 0; i < nxc; i++) for (let j = 0; j < nzc; j++) {
      const x0 = xa + (xe - xa) * i / nxc, x1 = xa + (xe - xa) * (i + 1) / nxc, z0 = za + (ze - za) * j / nzc, z1 = za + (ze - za) * (j + 1) / nzc;
      const xm = (x0 + x1) / 2, zm = (z0 + z1) / 2;
      if (z0 > shore(xm) + 6) continue;
      const P3 = [[x0, terr(x0, z0), z0], [x1, terr(x1, z0), z0], [x1, terr(x1, z1), z1], [x0, terr(x0, z1), z1]];
      const P = pr3(P3); if (P.some(p => p[2] < 6)) continue;
      const c = centroid(P); if (!vis(c[0], c[1]) || underKnoll(c[0], c[1] - 30)) continue;
      const hg = hillGain(xm, zm);
      let col = mixc(hex('#2b3468'), hex('#1f4a52'), vnoise(xm / 30, zm / 30, 5) * 0.8 + (hg > 24 ? 0.3 : 0));
      col = atm(col, P[0][2], c[0]);
      add(Math.max(P[2][2], P[3][2]) + 1.5, (cv, R) => face(cv, R, P.map(p => [p[0], p[1]]), col, { wmax: 9, ang: 0.02 }));
    }
    // lots
    if (xe - xa < 7 || ze - za < 7) continue;
    const nx = Math.max(1, Math.floor((xe - xa) / 10.8)), nz = Math.max(1, Math.floor((ze - za) / 12.5));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const lx = xa + (xe - xa) * (i + 0.5) / nx, lz = za + (ze - za) * (j + 0.5) / nz;
      const lw = (xe - xa) / nx, ld = (ze - za) / nz;
      if (lz > shore(lx) - 14) continue;
      if (lx > 3 && lz < 128) continue;          // our mound: no houses
      if (lz < 44 && lx > -12) continue;
      const hg = hillGain(lx, lz);
      const p0 = proj(lx, terr(lx, lz), lz); if (p0[2] < 20 || !vis(p0[0], p0[1] - 20)) continue;
      const empty = R() < 0.1 || hg > 30;
      if (empty) { const nt = hg > 30 ? 3 : 1 + (R() * 2 | 0); for (let k = 0; k < nt; k++) objs.push(tree(lx + (R() - 0.5) * lw * 0.7, lz + (R() - 0.5) * ld * 0.7, 3 + R() * 3.5 + (hg > 30 ? 1.5 : 0), R)); continue; }
      const low = lz > 300 && hg < 4, big = low && R() < (Math.abs(lx) < 60 ? 0.3 : 0.1);
      const o = { x: lx + (R() - 0.5) * 1.2, z: lz + (R() - 0.5) * 1.5, w: Math.min(lw - 1.6, 6.4 + R() * 3.4), d: Math.min(ld - 2.4, 6 + R() * 3), seed: (R() * 1e9) | 0 };
      if (big) { o.roof = 'flat'; o.wallH = 8.4 + ((R() * 5) | 0) * 2.8; o.w = lw - 1.4; o.d = Math.min(ld - 2, 9 + R() * 3); o.alb = CONC[(R() * CONC.length) | 0]; o.ralb = hex('#8a8a96'); }
      else { o.roof = R() < 0.55 ? 'gx' : 'gz'; o.wallH = R() < 0.72 ? 5.5 : 3.0; o.alb = WALLS[(R() * WALLS.length) | 0]; o.ralb = ROOFS[(R() * ROOFS.length) | 0]; o.rh = 1.5 + R() * 1.1; if (R() < 0.06) { o.roof = 'flat'; o.ralb = hex('#8a8a96'); } }
      objs.push(house(o));
      if (R() < 0.3) objs.push(tree(lx + (R() < 0.5 ? -1 : 1) * lw * 0.42, lz - ld * 0.3 + R() * ld * 0.6, 1.8 + R() * 2.2, R));
    }
  }
  // ---- roads
  const roadCol = (X, Y, d, main) => {
    let c = hex('#474c88');
    const sheen = sstep(120, 520, d);
    c = mixc(c, mixc(skyCol(X, HZ - 90), hex('#ffd0b0'), 0.35), 0.18 + 0.5 * sheen * (main ? 1 : 0.7));
    return c;
  };
  for (let z = 30; z < 692; z += 9) {
    const z1 = Math.min(692, z + 9), hw = MR;
    const P = pr3([[-hw, terr(0, z), z], [hw, terr(0, z), z], [hw, terr(0, z1), z1], [-hw, terr(0, z1), z1]]); if (P[0][2] < 8) continue;
    const c = centroid(P), col = roadCol(c[0], c[1], P[0][2], true), zz = z;
    add(P[2][2] + 1.4, (cv, R) => {
      const poly = P.map(p => [p[0], p[1]]);
      const a = Math.atan2(poly[3][1] - poly[0][1], poly[3][0] - poly[0][0]);
      face(cv, R, poly, col, { wmax: 7, ang: a });
      // centre dashes + kerb lines
      const m0 = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2], m1 = [(P[2][0] + P[3][0]) / 2, (P[2][1] + P[3][1]) / 2];
      const lw = clamp(F * 0.16 / P[0][2], 0.7, 4);
      if (((zz / 9) | 0) % 2 === 0) pline(cv, R, m0, [m0[0] + (m1[0] - m0[0]) * 0.6, m0[1] + (m1[1] - m0[1]) * 0.6], mixc(col, hex('#fff0e0'), 0.75), lw, 0.8, T.oil);
      pline(cv, R, P[0], P[3], mixc(col, hex('#e8dcf0'), 0.5), lw * 0.7, 0.6);
      pline(cv, R, P[1], P[2], mixc(col, hex('#e8dcf0'), 0.5), lw * 0.7, 0.6);
    });
  }
  for (const sz of SZS) for (let x = -330; x < 400; x += 12) {
    if (x < 3.6 && x + 12 > -3.6) { /* crossing itself drawn by both */ }
    const x1 = x + 12; if (sz > shore((x + x1) / 2) - 4) continue;
    const P = pr3([[x, terr(x, sz - HWZ), sz - HWZ], [x1, terr(x1, sz - HWZ), sz - HWZ], [x1, terr(x1, sz + HWZ), sz + HWZ], [x, terr(x, sz + HWZ), sz + HWZ]]);
    const c = centroid(P); if (!vis(c[0], c[1]) || underKnoll(c[0], c[1] - 20)) continue;
    const col = roadCol(c[0], c[1], P[0][2], false);
    add(Math.max(P[2][2], P[3][2]) + 1.45, (cv, R) => face(cv, R, P.map(p => [p[0], p[1]]), col, { wmax: 6, ang: Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]) }));
  }
  for (const sx of SXS) { if (sx === 0) continue; for (let z = 40; z < 690; z += 12) {
    const z1 = z + 12, hw = 2.2; if (z1 > shore(sx) - 3) continue; if (sx > 3 && z < 128) continue;
    const P = pr3([[sx - hw, terr(sx - hw, z), z], [sx + hw, terr(sx + hw, z), z], [sx + hw, terr(sx + hw, z1), z1], [sx - hw, terr(sx - hw, z1), z1]]); if (P[0][2] < 8) continue;
    const c = centroid(P); if (!vis(c[0], c[1]) || underKnoll(c[0], c[1] - 20)) continue;
    const col = roadCol(c[0], c[1], P[0][2], false);
    add(P[2][2] + 1.4, (cv, R) => face(cv, R, P.map(p => [p[0], p[1]]), col, { wmax: 5, ang: Math.atan2(P[3][1] - P[0][1], P[3][0] - P[0][0]) }));
  } }
  // zebra crossings on the main road
  for (const sz of SZS) for (const side of [-1, 1]) {
    const zc = sz + side * (HWZ + 2.2);
    for (let k = 0; k < 7; k++) {
      const xa = -4.0 + k * 1.2, P = pr3([[xa, terr(0, zc - 1.4) + 0.02, zc - 1.4], [xa + 0.6, terr(0, zc - 1.4) + 0.02, zc - 1.4], [xa + 0.6, terr(0, zc + 1.4) + 0.02, zc + 1.4], [xa, terr(0, zc + 1.4) + 0.02, zc + 1.4]]);
      add(P[2][2] + 1.0, (cv, R) => face(cv, R, P.map(p => [p[0], p[1]]), atm(hex('#d8d4f0'), P[0][2], P[0][0], 0.5), { P: 0.9, ang: 1.5 }));
    }
  }
  // ---- poles, wires, lamps along the main road; signals at each crossing
  let prev = null;
  for (let z = 58; z < 680; z += 31) {
    const x = MR + 1.1, g = terr(x, z), top = g + 9.6;
    const a = proj(x, g, z), b = proj(x, top, z), sc = F / a[2];
    const lamp = ((z - 58) / 31 | 0) % 2 === 0;
    const me = { x, z, top, sc, a, b };
    const pv = prev;
    add(a[2], (cv, R) => {
      const col = atm(hex('#1b1d4c'), a[2], a[0], 0.6);
      cv.stroke(wob(a[0], a[1], b[0], b[1], R, 0.3, 0.003), { ...T.conte, w: clamp(0.3 * sc, 0.8, 9), col, P: 1.0 });
      for (const [dy, hw] of [[-0.5, 1.1], [-1.5, 0.9]]) { const l = proj(x - hw, top + dy, z), r = proj(x + hw, top + dy, z); pline(cv, R, l, r, col, clamp(0.12 * sc, 0.7, 4), 0.95, T.conte); }
      if (sc > 4 && R() < 0.6) { const t0 = proj(x + 0.45, top - 2.9, z), t1 = proj(x + 0.45, top - 2.0, z); cv.stroke([[t0[0], t0[1]], [t1[0], t1[1]]], { ...T.conte, w: 0.55 * sc, col: mixc(col, hex('#5a5a8a'), 0.3), P: 1.05 }); }
      if (lamp) {
        const l0 = proj(x - 0.2, top - 2.6, z), l1 = proj(x - 2.0, top - 2.3, z); pline(cv, R, l0, l1, col, clamp(0.1 * sc, 0.6, 3), 0.9, T.conte);
        const gp = proj(x - 2.4, g, z);
        cv.dust(gp[0], gp[1], 3.2 * sc, hex('#ffe9b0'), 0.2, 1.1 * sc * Math.max(0.25, (gp[1] - HZ) / 420));
        cv.dust(l1[0], l1[1], Math.max(3, 1.3 * sc), hex('#fff0b8'), 0.5); cv.dust(l1[0], l1[1], Math.max(1.5, 0.5 * sc), hex('#fffbe8'), 0.7);
        cv.stroke([[l1[0] - 0.25 * sc, l1[1]], [l1[0] + 0.25 * sc, l1[1]]], { ...T.oil, w: Math.max(1.2, 0.22 * sc), col: hex('#fffdf0'), P: 1.2 });
      }
      if (pv) for (const [dy, off] of [[-0.5, -1.0], [-0.5, 0], [-0.5, 1.0], [-1.5, -0.8], [-1.5, 0.8]]) {
        const p0 = [pv.x + off, pv.top + dy, pv.z], p1 = [x + off, top + dy, z], pts = [];
        for (let k = 0; k <= 8; k++) { const t = k / 8, q = proj(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t - 0.75 * Math.sin(Math.PI * t), p0[2] + (p1[2] - p0[2]) * t); pts.push([q[0], q[1]]); }
        cv.stroke(pts, { ...T.pencil, w: clamp(0.05 * pv.sc, 0.6, 1.6), col: atm(hex('#20225a'), a[2], a[0], 0.6), P: 0.72, tin: 0, tout: 0 });
      }
    });
    prev = me;
  }
  for (const sz of SZS) {
    const z = sz - HWZ - 0.6, x = -MR - 0.8, g = terr(x, z);
    const a = proj(x, g, z), b = proj(x, g + 6.6, z), sc = F / a[2];
    const e = proj(1.4, g + 6.4, z), l = proj(-0.2, g + 6.25, z);
    add(a[2] - 0.5, (cv, R) => {
      const col = atm(hex('#23265a'), a[2], a[0], 0.5), ws = Math.max(1, sc);
      cv.stroke(wob(a[0], a[1], b[0], b[1], R, 0.2, 0.003), { ...T.conte, w: clamp(0.2 * sc, 0.7, 6), col, P: 1.0 });
      pline(cv, R, b, e, col, clamp(0.12 * sc, 0.6, 4), 0.95, T.conte);
      // housing: three lamps, the left one lit (green)
      const hx0 = proj(-1.25, g + 6.25, z), hx1 = proj(0.75, g + 6.25, z), hh = Math.max(1.6, 0.52 * sc);
      cv.stroke([[hx0[0], hx0[1]], [hx1[0], hx1[1]]], { ...T.conte, w: hh, col: mixc(col, hex('#101238'), 0.5), P: 1.1 });
      const g0 = proj(-0.85, g + 6.25, z), y0 = proj(-0.25, g + 6.25, z), r0 = proj(0.35, g + 6.25, z);
      const lr = Math.max(0.8, 0.17 * sc);
      for (const q of [y0, r0]) cv.stroke([[q[0] - 0.1, q[1]], [q[0] + 0.1, q[1]]], { ...T.oil, w: lr * 1.5, col: hex('#3a3a5e'), P: 1 });
      const GC = hex('#2fe8bc');
      cv.dust(g0[0], g0[1], Math.max(11, 3.6 * sc), GC, 0.36); cv.dust(g0[0], g0[1], Math.max(4, 1.1 * sc), hex('#8cffe0'), 0.65);
      cv.stroke([[g0[0] - 0.15, g0[1]], [g0[0] + 0.15, g0[1]]], { ...T.oil, w: Math.max(2.4, lr * 2.2), col: hex('#e4fff6'), P: 1.2 });
      const sl = Math.max(9, 2.2 * sc);
      cv.stroke(wob(g0[0] - sl, g0[1], g0[0] + sl, g0[1], R, 0.2, 0), { ...T.pencil, w: 0.9, col: hex('#b8fff0'), P: 0.8, tin: 0.45, tout: 0.45 });
      cv.stroke(wob(g0[0], g0[1] - sl * 0.8, g0[0], g0[1] + sl * 0.8, R, 0.2, 0), { ...T.pencil, w: 0.9, col: hex('#b8fff0'), P: 0.8, tin: 0.45, tout: 0.45 });
    });
    // reflection of the green on the wet road, drawn toward us
    const len = 26;
    const far = proj(-0.85, terr(0, z - 1), z - 1), near = proj(-0.85, terr(0, z - len), z - len);
    add(near[2] - 3, (cv, R) => {
      const n = Math.max(4, Math.round(Math.abs(near[1] - far[1]) * 0.9)), ws = clamp(F * 0.5 / far[2], 1, 12);
      for (let k = 0; k < n; k++) {
        const t = R(), x = far[0] + (near[0] - far[0]) * t + (R() - 0.5) * ws * (0.6 + t), y = far[1] + (near[1] - far[1]) * t, L = (1.5 + R() * 4) * (1 + t) * Math.max(1, ws / 4);
        cv.stroke([[x - L * 0.5, y], [x + L * 0.5, y]], { ...T.oil, w: clamp(ws * 0.22 * (0.6 + R()), 0.8, 3), col: hex(R() < 0.3 ? '#b8fff0' : '#35e0b6'), P: (0.9 - t * 0.45) * (0.7 + 0.4 * R()) });
      }
      cv.dust((far[0] + near[0]) / 2, (far[1] + near[1]) / 2, ws * 1.6, hex('#35e0b6'), 0.16, Math.abs(near[1] - far[1]) * 0.45 + 2);
    });
  }
  // ---- raised railway with an evening train (low town)
  const RZ = 462, RY = -52 + 6.2;
  for (let x = -330; x < 330; x += 16) {
    const x1 = x + 16; if (RZ > shore(x1) - 20) continue;
    const A = proj(x, RY, RZ), B = proj(x1, RY, RZ);
    add(Math.min(A[2], B[2]) - 1, (cv, R) => {
      const col = atm(hex('#3a3f78'), A[2], A[0]);
      const A2 = proj(x, RY - 1.3, RZ), B2 = proj(x1, RY - 1.3, RZ);
      face(cv, R, [A, B, B2, A2].map(p => [p[0], p[1]]), col, {});
      pline(cv, R, A, B, mixc(col, hex('#f0b8c8'), 0.5), 1, 0.7);
      const pa = proj(x + 8, RY - 1.3, RZ), pb = proj(x + 8, -52, RZ);
      cv.stroke([[pa[0], pa[1]], [pb[0], pb[1]]], { ...T.conte, w: Math.max(1.2, F * 1.1 / A[2]), col: mixc(col, hex('#1c1f50'), 0.4), P: 1 });
      const c0 = proj(x + 2, RY, RZ), c1 = proj(x + 2, RY + 5.2, RZ), c2 = proj(x + 2, RY + 5.2, RZ - 2); // catenary mast
      pline(cv, R, c0, c1, mixc(col, hex('#1c1f50'), 0.5), 0.8, 0.8); pline(cv, R, c1, c2, mixc(col, hex('#1c1f50'), 0.5), 0.7, 0.7);
    });
  }
  for (let k = 0; k < 5; k++) {
    const x = -196 + k * 20.6, x1 = x + 20, A = proj(x, RY + 0.4, RZ - 1.4), B = proj(x1, RY + 0.4, RZ - 1.4), A2 = proj(x, RY + 3.5, RZ - 1.4), B2 = proj(x1, RY + 3.5, RZ - 1.4);
    add(Math.min(A[2], B[2]) - 2.5, (cv, R) => {
      const body = atm(hex(k % 2 ? '#c8d0e0' : '#d8dce8'), A[2], A[0], 0.5);
      face(cv, R, [A, B, B2, A2].map(p => [p[0], p[1]]), mixc(body, hex('#4a4f90'), 0.45), {});
      const band = t => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
      const hh = A[1] - A2[1];
      pline(cv, R, [A[0], A[1] - hh * 0.2], [B[0], B[1] - hh * 0.2], hex('#ff9a5a'), Math.max(0.8, hh * 0.1), 0.9, T.oil);
      for (let i = 0; i < 9; i++) { const p = band(0.07 + i * 0.105), q = band(0.07 + i * 0.105 + 0.07); cv.stroke([[p[0], p[1] - hh * 0.62], [q[0], q[1] - hh * 0.62]], { ...T.oil, w: Math.max(1.3, hh * 0.3), col: hex(i % 4 === 1 ? '#fff6d8' : '#ffe9a0'), P: 1.15 }); }
      cv.dust((A[0] + B[0]) / 2, A[1] - hh * 0.6, (B[0] - A[0]) * 0.55, hex('#ffe4a0'), 0.14, hh * 1.4);
      if (k === 4) { const h = proj(x1 + 0.3, RY + 1.2, RZ - 1.4); cv.dust(h[0], h[1], 6, hex('#fff6d0'), 0.6); cv.stroke([[h[0], h[1]], [h[0] + 0.6, h[1]]], { ...T.oil, w: 2, col: hex('#ffffff'), P: 1.2 }); }
    });
  }
  { let best = null; for (const q of objs) if (q.o && q.o.x < -6 && q.o.z < 70 && (!best || q.d < best.d)) best = q; if (best) { best.o.home = true; best.o.wallH = 5.5; } }
  objs.sort((a, b) => b.d - a.d);
  return objs;
}

// ------------------------------------------------------------ tree
function tree(x, z, r, R0) {
  const g = terr(x, z), c = proj(x, g + r * 1.15, z), sc = F / c[2], seed = (R0() * 1e9) | 0;
  return {
    d: c[2], fn: (cv) => {
      const R = rng32(seed), rp = r * sc;
      if (c[0] < -80 || c[0] > 2000 || underKnoll(c[0], c[1] - rp)) return;
      const dark = atm(hex('#15324e'), c[2], c[0]), mid = atm(hex('#1c5058'), c[2], c[0]), lit = atm(hex('#3f8674'), c[2], c[0], 0.6), rim = atm(hex('#d39aa0'), c[2], c[0], 0.5);
      const tb = proj(x, g, z);
      if (rp > 5) cv.stroke([[tb[0], tb[1]], [c[0], c[1]]], { ...T.conte, w: Math.max(1, rp * 0.12), col: atm(hex('#241c40'), c[2], c[0]), P: 1 });
      const n = Math.max(3, Math.round(rp * rp / 14) + 3);
      const blobs = [[0, 0, 1], [-0.5, 0.25, 0.7], [0.5, 0.2, 0.7], [0.1, -0.45, 0.75], [-0.3, -0.3, 0.6]];
      for (let i = 0; i < n; i++) {
        const b = blobs[(R() * blobs.length) | 0], a = R() * 6.283, rr = Math.sqrt(R()) * b[2] * rp * 0.95;
        const px = c[0] + b[0] * rp + Math.cos(a) * rr, py = c[1] + b[1] * rp + Math.sin(a) * rr * 0.9;
        const up = (c[1] - py) / rp + (px - c[0]) / rp * 0.7; // upper-right is lit by the afterglow
        const hi = up > 0.8, col = hi ? (R() < 0.22 ? rim : lit) : up > 0.2 ? mid : dark;
        const L = Math.max(1.2, rp * (0.2 + R() * 0.3)) * (hi ? 0.6 : 1), aa = R() * 6.283;
        cv.stroke(hi ? [[px - Math.cos(aa * 0.2 - 0.6) * L * 0.5, py - Math.sin(aa * 0.2 - 0.6) * L * 0.5], [px + Math.cos(aa * 0.2 - 0.6) * L * 0.5, py + Math.sin(aa * 0.2 - 0.6) * L * 0.5]] : arc(px, py, L * 0.6, L * 0.45, aa, aa + 2 + R() * 3, R, 0.3), { ...T.ptip, w: clamp(rp * 0.2, 1.1, 5) * (0.7 + 0.6 * R()), col: jit(col, 0.02, R), P: 0.95 + R() * 0.15 });
      }
    }
  };
}

// ------------------------------------------------------------ house
function house(o) {
  const g0 = terr(o.x, o.z);
  const x0 = o.x - o.w / 2, x1 = o.x + o.w / 2, z0 = o.z - o.d / 2, z1 = o.z + o.d / 2;
  const yb = Math.min(terr(x0, z0), terr(x1, z0), terr(x0, z1), terr(x1, z1)) - 0.3, yt = g0 + o.wallH;
  const pc = proj(o.x, g0, o.z);
  return { d: pc[2], o, fn: (cv) => drawHouse(cv, o, { g0, x0, x1, z0, z1, yb: Math.min(terr(x0, z0), terr(x1, z0), terr(x0, z1), terr(x1, z1)) - 0.3, yt: g0 + o.wallH, pc }) };
}
function drawHouse(cv, o, G) {
  const R = rng32(o.seed), { g0, x0, x1, z0, z1, yb, yt, pc } = G;
  const d = pc[2], sc = F / d, pw = o.w * sc;
  const top = proj(o.x, yt + 3, o.z);
  if (pc[0] + pw < -20 || pc[0] - pw > 1940 || underKnoll(pc[0], top[1] + 4)) return;
  const A = c => atm(c, d, pc[0]);
  const seen = (n, c) => n[0] * (CAM[0] - c[0]) + n[1] * (CAM[1] - c[1]) + n[2] * (CAM[2] - c[2]) > 0;
  const lod = pw < 12 ? 0 : pw < 34 ? 1 : pw < 90 ? 2 : 3;
  const P2 = P3 => P3.map(p => { const q = proj(p[0], p[1], p[2]); return [q[0], q[1]]; });
  const wallC = n => A(wallShade(o.alb, n));
  const flat = o.roof === 'flat';
  const lit = [];
  // ---- walls
  const walls = [];
  if (seen([-1, 0, 0], [x0, yt, o.z])) walls.push({ n: [-1, 0, 0], a: [x0, z1], b: [x0, z0] });
  if (seen([1, 0, 0], [x1, yt, o.z])) walls.push({ n: [1, 0, 0], a: [x1, z0], b: [x1, z1] });
  walls.push({ n: [0, 0, -1], a: [x0, z0], b: [x1, z0], front: 1 });
  for (const w of walls) {
    const col = wallC(w.n);
    const poly = P2([[w.a[0], yb, w.a[1]], [w.b[0], yb, w.b[1]], [w.b[0], yt, w.b[1]], [w.a[0], yt, w.a[1]]]);
    face(cv, R, poly, col, { ang: 1.5 + (R() - 0.5) * 0.2, tex: lod >= 2 ? mixc(col, hex('#1a1c50'), 0.35) : null, ang2: -1.0, tsp: 3 });
    if (o.roof === 'gx' && !w.front) { // gable triangle
      face(cv, R, P2([[w.a[0], yt, w.a[1]], [w.b[0], yt, w.b[1]], [w.a[0], yt + o.rh, o.z]]), col, { ang: 1.5 });
    }
    if (o.roof === 'gz' && w.front) face(cv, R, P2([[x0, yt, z0], [x1, yt, z0], [o.x, yt + o.rh, z0]]), col, { ang: 1.5 });
    // foundation / ground shadow line
    if (lod >= 2) pline(cv, R, poly[0], poly[1], mixc(col, hex('#12143c'), 0.6), 1.3, 0.7);
    // windows
    const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
    const floors = Math.max(1, Math.round(o.wallH / 2.8));
    const wp = (u, y) => { const q = proj(w.a[0] + (w.b[0] - w.a[0]) * u, y, w.a[1] + (w.b[1] - w.a[1]) * u); return [q[0], q[1]]; };
    const nw = flat && floors > 2 ? Math.max(2, Math.floor(len / 2.3)) : Math.max(1, Math.floor(len / 3.0));
    const litP = flat ? 0.4 : 0.4;
    for (let f = 0; f < floors; f++) for (let i = 0; i < nw; i++) {
      if (lod === 0 && R() < 0.5) continue;
      if (!flat && R() < 0.22) continue;
      const u = (i + 0.5) / nw + (flat ? 0 : (R() - 0.5) * 0.08), ww = (flat ? 1.5 : 1.25 + R() * 0.7) / len / 2;
      const yc = g0 + f * 2.8 + 1.55, wh = (flat ? 0.6 : (f === 0 && R() < 0.3 ? 0.95 : 0.62));
      const poly2 = [wp(u - ww, yc - wh), wp(u + ww, yc - wh), wp(u + ww, yc + wh), wp(u - ww, yc + wh)];
      const isLit = R() < litP, cw = Math.abs(poly2[1][0] - poly2[0][0]), ch = Math.abs(poly2[0][1] - poly2[3][1]);
      if (cw < 0.5 && ch < 1) continue;
      if (isLit) {
        const lc = WLIT[(R() * WLIT.length) | 0];
        const c2 = mixc(lc, col, clamp((d - 300) / 1400, 0, 0.3));
        if (lod <= 1) cv.stroke([[(poly2[0][0] + poly2[3][0]) / 2, (poly2[0][1] + poly2[3][1]) / 2], [(poly2[1][0] + poly2[2][0]) / 2, (poly2[1][1] + poly2[2][1]) / 2]], { ...T.oil, w: Math.max(1.1, ch), col: c2, P: 1.15 });
        else {
          face(cv, R, poly2, c2, { ang: 1.5, P: 1.15 });
          // warmer lower half, curtain, mullion
          if (lod >= 2) {
            fillPoly(cv, [poly2[0], poly2[1], [(poly2[1][0] + poly2[2][0]) / 2, (poly2[1][1] + poly2[2][1]) / 2], [(poly2[0][0] + poly2[3][0]) / 2, (poly2[0][1] + poly2[3][1]) / 2]], { tool: T.pencil, w: 1.2, col: hex('#ff9a50'), P: 0.5, ang: 1.5, sp: 2 }, R);
            const m0 = [(poly2[0][0] + poly2[1][0]) / 2, (poly2[0][1] + poly2[1][1]) / 2], m1 = [(poly2[2][0] + poly2[3][0]) / 2, (poly2[2][1] + poly2[3][1]) / 2];
            pline(cv, R, m0, m1, mixc(col, hex('#2a1c40'), 0.6), Math.max(0.8, cw * 0.06), 0.8);
            if (lod >= 3) { pline(cv, R, [(poly2[0][0] + poly2[3][0]) / 2, (poly2[0][1] + poly2[3][1]) / 2], [(poly2[1][0] + poly2[2][0]) / 2, (poly2[1][1] + poly2[2][1]) / 2], mixc(col, hex('#2a1c40'), 0.6), 1, 0.7); outline(cv, poly2, { col: mixc(col, hex('#1a1640'), 0.6), w: 1.3, P: 0.8 }, R, true); }
          }
        }
        const cc = centroid(poly2); lit.push([cc[0], cc[1], Math.max(cw, ch), lc]);
      } else if (lod >= 1) {
        const dk = mixc(col, hex('#141a4a'), 0.62);
        if (lod === 1) cv.stroke([[(poly2[0][0] + poly2[3][0]) / 2, (poly2[0][1] + poly2[3][1]) / 2], [(poly2[1][0] + poly2[2][0]) / 2, (poly2[1][1] + poly2[2][1]) / 2]], { ...T.ptip, w: Math.max(1, ch), col: dk, P: 1.0 });
        else { face(cv, R, poly2, dk, { ang: 1.5 }); pline(cv, R, [poly2[3][0] + cw * 0.15, poly2[3][1] + ch * 0.2], [poly2[3][0] + cw * 0.55, poly2[3][1] + ch * 0.75], mixc(dk, hex('#9ab0f0'), 0.5), 1, 0.6); }
      }
    }
    // door on the front wall for the bigger houses
    if (w.front && lod >= 2 && !flat) {
      const u = 0.18 + R() * 0.64, dw = 0.5 / len;
      const dp = [wp(u - dw, g0), wp(u + dw, g0), wp(u + dw, g0 + 2.0), wp(u - dw, g0 + 2.0)];
      if (o.home) {
        face(cv, R, dp, hex('#ffe6a0'), { ang: 1.5, P: 1.15 });
        fillPoly(cv, [dp[0], dp[1], [(dp[1][0] + dp[2][0]) / 2, (dp[1][1] + dp[2][1]) / 2], [(dp[0][0] + dp[3][0]) / 2, (dp[0][1] + dp[3][1]) / 2]], { tool: T.pencil, w: 1.3, col: hex('#ff9a48'), P: 0.6, ang: 1.5, sp: 2 }, R);
        const dz = [wp(u - dw, g0), wp(u + dw, g0)], q0 = proj(w.a[0] + (w.b[0] - w.a[0]) * u - 1.6, g0, w.a[1] - 3.6), q1 = proj(w.a[0] + (w.b[0] - w.a[0]) * u + 2.4, g0, w.a[1] - 3.6);
        const spill = [dz[0], dz[1], [q1[0], q1[1]], [q0[0], q0[1]]];
        fillPoly(cv, spill, { tool: T.pastel, w: 5, col: hex('#f0c070'), P: 0.62, ang: 0.3, sp: 0.8, cj: 0.02, over: 2 }, R);
        const sc2 = centroid(spill); cv.dust(sc2[0], sc2[1], 34, hex('#ffd890'), 0.22, 16); cv.dust((dp[0][0] + dp[2][0]) / 2, (dp[0][1] + dp[2][1]) / 2, 30, hex('#ffcf80'), 0.25);
        // the door itself, swung outward
        const hd = wp(u + dw, g0), he = proj(w.a[0] + (w.b[0] - w.a[0]) * u + 0.5 + 0.75, g0, w.a[1] - 0.62), ht = proj(w.a[0] + (w.b[0] - w.a[0]) * u + 0.5 + 0.75, g0 + 2.0, w.a[1] - 0.62);
        face(cv, R, [hd, [he[0], he[1]], [ht[0], ht[1]], dp[2]], mixc(col, hex('#5a3040'), 0.6), { ang: 1.5 });
        outline(cv, dp, { col: hex('#5a2a40'), w: 1.4, P: 0.8 }, R, true);
      } else face(cv, R, dp, mixc(col, hex('#2a1c44'), 0.55), { ang: 1.5 });
      const lp = wp(u + dw * 2.2, g0 + 2.15); cv.dust(lp[0], lp[1], Math.max(3, 0.9 * sc), hex('#ffd890'), 0.55); cv.stroke([[lp[0] - 0.4, lp[1]], [lp[0] + 0.4, lp[1]]], { ...T.oil, w: Math.max(1.4, 0.2 * sc), col: hex('#fff6dc'), P: 1.2 });
    }
    // edge lines
    if (lod >= 2) { pline(cv, R, poly[1], poly[2], mixc(col, hex('#141640'), 0.55), 1.2, 0.7); if (w.n[0] > 0) pline(cv, R, [poly[1][0], poly[1][1]], [poly[2][0], poly[2][1]], hex('#ffc0a8'), 1, 0.5); }
  }
  // ---- roof
  const e = 0.55, ye = yt - 0.22;
  const roofFace = (P3, n, slopeDir) => {
    const cc = [(P3[0][0] + P3[2][0]) / 2, (P3[0][1] + P3[2][1]) / 2, (P3[0][2] + P3[2][2]) / 2];
    if (!seen(n, cc)) return;
    const poly = P2(P3), c = centroid(poly), col = A(roofShade(o.ralb, n, c[0]));
    const a = Math.atan2(poly[3][1] - poly[0][1], poly[3][0] - poly[0][0]);
    face(cv, R, poly, col, { ang: flat ? 0.03 : a, tex: lod >= 2 ? mixc(col, hex('#141a50'), 0.4) : null, ang2: flat ? -0.8 : a, tsp: 2.6 });
    if (lod >= 2 && !flat) {
      // tile courses + wet sheen streaks down the slope
      const nc = lod === 3 ? 7 : 3;
      for (let k = 1; k < nc; k++) { const t = k / nc; pline(cv, R, [poly[0][0] + (poly[3][0] - poly[0][0]) * t, poly[0][1] + (poly[3][1] - poly[0][1]) * t], [poly[1][0] + (poly[2][0] - poly[1][0]) * t, poly[1][1] + (poly[2][1] - poly[1][1]) * t], mixc(col, hex('#12164a'), 0.45), 1, 0.55); }
      const ns = lod === 3 ? 22 : 7;
      for (let k = 0; k < ns; k++) {
        const u = R(), t0 = R() * 0.7, t1 = t0 + 0.12 + R() * 0.3;
        const bx = poly[0][0] + (poly[1][0] - poly[0][0]) * u, by = poly[0][1] + (poly[1][1] - poly[0][1]) * u, tx = poly[3][0] + (poly[2][0] - poly[3][0]) * u, ty = poly[3][1] + (poly[2][1] - poly[3][1]) * u;
        pline(cv, R, [bx + (tx - bx) * t0, by + (ty - by) * t0], [bx + (tx - bx) * Math.min(1, t1), by + (ty - by) * Math.min(1, t1)], mixc(col, n[0] > 0.2 ? hex('#ffd0b8') : hex('#b8c8ff'), 0.5 + R() * 0.3), 1 + R() * 0.8, 0.55);
      }
    }
    if (lod >= 1) {
      // ridge catches the last light; eave reads dark
      pline(cv, R, poly[3], poly[2], flat ? mixc(col, hex('#fff0d8'), 0.35) : mixc(col, hex('#ffd2c0'), 0.6), lod >= 2 ? 1.5 : 1, 0.75, lod >= 2 ? T.oil : T.pencil);
      if (lod >= 2) pline(cv, R, poly[0], poly[1], mixc(col, hex('#0f1238'), 0.6), 1.5, 0.8);
    }
    return poly;
  };
  if (flat) {
    const pol = roofFace([[x0, yt, z0], [x1, yt, z0], [x1, yt, z1], [x0, yt, z1]], [0, 1, 0]);
    if (pol && lod >= 1) {
      // parapet + rooftop clutter
      outline(cv, pol, { col: A(mixc(wallShade(o.alb, [0, 0, -1]), hex('#e8d8f0'), 0.35)), w: lod >= 2 ? 1.5 : 1, P: 0.8 }, R, true);
      if (R() < 0.7) { const tx = x0 + o.w * (0.2 + R() * 0.5), tz = z0 + o.d * 0.5, tw = 1.6, th = 1.9; // water tank
        const b0 = proj(tx, yt, tz), b1 = proj(tx + tw, yt, tz), t0 = proj(tx, yt + th, tz);
        face(cv, R, [[b0[0], b0[1]], [b1[0], b1[1]], [b1[0], t0[1]], [t0[0], t0[1]]], A(hex('#5a6aa0')), { ang: 1.5 });
        pline(cv, R, [t0[0], t0[1]], [b1[0], t0[1]], A(hex('#e8c8d8')), 1, 0.7); }
      if (R() < 0.45 && o.wallH > 10) { // roof sign: a little neon rectangle
        const sx0 = x0 + o.w * 0.15, sx1 = x0 + o.w * (0.6 + R() * 0.3), a0 = proj(sx0, yt + 0.8, z0), a1 = proj(sx1, yt + 0.8, z0), hh = Math.max(2, 1.6 * sc);
        const nc = hex(['#ff5aa0', '#3fe0d0', '#ffcf5a', '#ff7a5a', '#8a9aff'][(R() * 5) | 0]);
        cv.dust((a0[0] + a1[0]) / 2, a0[1] - hh / 2, (a1[0] - a0[0]) * 0.7, nc, 0.2, hh * 1.5);
        outline(cv, [[a0[0], a0[1]], [a1[0], a1[1]], [a1[0], a1[1] - hh], [a0[0], a0[1] - hh]], { tool: T.oil, col: nc, w: 1.2, P: 0.95 }, R, true);
        for (let k = 0; k < 3; k++) pline(cv, R, [a0[0] + 2 + R() * (a1[0] - a0[0] - 4), a0[1] - hh * (0.25 + R() * 0.5)], [a0[0] + 2 + R() * (a1[0] - a0[0] - 4), a0[1] - hh * (0.25 + R() * 0.5)], mixc(nc, hex('#ffffff'), 0.5), 1, 0.9, T.oil);
        pline(cv, R, [a0[0] + 1, a0[1]], [a0[0] + 1, a0[1] + 0.8 * sc], A(hex('#22244a')), 0.8, 0.8); pline(cv, R, [a1[0] - 1, a1[1]], [a1[0] - 1, a1[1] + 0.8 * sc], A(hex('#22244a')), 0.8, 0.8);
      }
    }
  } else if (o.roof === 'gx') {
    const s = Math.atan2(o.rh, o.d / 2), sn = Math.sin(s), cs = Math.cos(s);
    roofFace([[x0 - e, ye, z1 + e], [x1 + e, ye, z1 + e], [x1 + e, yt + o.rh, o.z], [x0 - e, yt + o.rh, o.z]], [0, cs, sn]);
    roofFace([[x0 - e, ye, z0 - e], [x1 + e, ye, z0 - e], [x1 + e, yt + o.rh, o.z], [x0 - e, yt + o.rh, o.z]], [0, cs, -sn]);
  } else {
    const s = Math.atan2(o.rh, o.w / 2), sn = Math.sin(s), cs = Math.cos(s);
    const L = () => roofFace([[x0 - e, ye, z1 + e], [x0 - e, ye, z0 - e], [o.x, yt + o.rh, z0 - e], [o.x, yt + o.rh, z1 + e]], [-sn, cs, 0]);
    const Rr = () => roofFace([[x1 + e, ye, z0 - e], [x1 + e, ye, z1 + e], [o.x, yt + o.rh, z1 + e], [o.x, yt + o.rh, z0 - e]], [sn, cs, 0]);
    if (o.x > CAM[0]) { Rr(); L(); } else { L(); Rr(); }
    if (lod >= 2) { const a = P2([[x0 - e, ye, z0 - e], [o.x, yt + o.rh, z0 - e], [x1 + e, ye, z0 - e]]); pline(cv, R, a[0], a[1], A(hex('#161a48')), 1.4, 0.8); pline(cv, R, a[1], a[2], A(hex('#161a48')), 1.4, 0.8); }
  }
  // ---- roof furniture on larger houses
  if (lod >= 2 && !flat && R() < 0.7) { // TV aerial
    const ax = o.x + (R() - 0.5) * o.w * 0.5, az = o.z, b = proj(ax, yt + o.rh * 0.9, az), t = proj(ax, yt + o.rh + 2.6, az), col = A(hex('#1c1e4c'));
    pline(cv, R, b, t, col, lod === 3 ? 1.4 : 0.9, 0.85);
    for (let k = 0; k < 4; k++) { const yy = t[1] + (b[1] - t[1]) * (0.04 + k * 0.1), hw = (0.9 - k * 0.12) * sc; pline(cv, R, [t[0] - hw, yy + hw * 0.12], [t[0] + hw, yy - hw * 0.12], col, lod === 3 ? 1.1 : 0.8, 0.8); }
  }
  // ---- window glow, last
  for (const [lx, ly, s, lc] of lit) { if (s > 1.2) cv.dust(lx, ly, s * (lod >= 2 ? 1.1 : 1.5) + 1.5, mixc(lc, hex('#ff9a50'), 0.35), lod >= 2 ? 0.2 : 0.26); }
}

function drawTown(cv, seed) {
  const objs = buildTown(seed), R = rng32(seed + 99);
  for (const o of objs) o.fn(cv, R);
  return objs.length;
}
module.exports = { proj, terr, shore, atm, drawFar, drawSea, drawTown, knollY, KNOLL, underKnoll, F, CAM, face, pline, seaCol, SZS };
