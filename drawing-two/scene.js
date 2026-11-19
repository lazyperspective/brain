'use strict';
// "Everything Was Ready" -- the picture itself.
const { hash2, vnoise, fbm, n1, hex, mix, ramp, clamp, sstep } = require('./engine.js');

const W = 3840, H = 2160;
const HY = 1420, VPX = 1480, F = 3000, EH = 1.25, SUNX = 1800;
const PAPER = hex('#7a7390');
const sq = (v) => v * v;
const gp = (X, Z) => [VPX + F * X / Z, HY + F * EH / Z];

// ---------------------------------------------------------------- the tools on the table
const T = {
  // soft pastel laid on its side and rubbed in with a finger
  rub: { width: 120, edge: 18, tooth: 0.30, soft: 0.4, flow: 0.92, cover: 1, streak: 0.22, sfreq: 0.045, wob: 8, bow: 0.02, jit: 0.03, pv: 0.1, wp: 0.15, ti: 0.1, to: 0.1 },
  // soft pastel, side of the stick, dragged so the tooth shows
  pastel: { width: 52, edge: 5, tooth: 0.85, soft: 0.42, flow: 0.8, cover: 1, streak: 0.6, sfreq: 0.12, wob: 4, jit: 0.05, wp: 0.2 },
  // pastel pressed firmly (cloud bodies)
  soft: { width: 34, edge: 4, tooth: 0.38, soft: 0.42, flow: 0.92, cover: 1, streak: 0.3, sfreq: 0.15, wob: 2, jit: 0.035, wp: 0.2 },
  // corner of the stick / pastel pencil
  tip: { width: 12, edge: 2.2, tooth: 0.7, soft: 0.4, flow: 0.9, cover: 1, streak: 0.35, sfreq: 0.4, wob: 1.5, jit: 0.04, wp: 0.35 },
  // wax coloured pencil
  pencil: { width: 3.4, edge: 1.5, tooth: 0.88, soft: 0.42, flow: 0.8, cover: 0.6, wob: 1.4, jit: 0.06, wp: 0.45, bow: 0.02 },
  sharp: { width: 2.2, edge: 1.2, tooth: 0.6, soft: 0.4, flow: 0.92, cover: 0.75, wob: 0.9, jit: 0.04, wp: 0.4 },
  // compressed charcoal / indigo conte
  char: { width: 8, edge: 2.2, tooth: 0.65, soft: 0.4, flow: 0.9, cover: 0.97, streak: 0.4, sfreq: 0.5, wob: 1.5, jit: 0.03, wp: 0.3 },
  // a fingertip of pastel dust worked into the tooth: how light is made to glow
  smudge: { width: 40, edge: 26, tooth: 0.04, soft: 0.6, flow: 0.2, cover: 1, wob: 0, jit: 0.02, wp: 0, pv: 0.05, taper: 0 },
  // white chalk pencil for lights
  chalk: { width: 5, edge: 1.6, tooth: 0.5, soft: 0.4, flow: 0.97, cover: 1, wob: 0.8, jit: 0.02, wp: 0.4 },
};

// ---------------------------------------------------------------- colour of the sky
const SKY = [
  [0, hex('#12143c')], [200, hex('#1a2262')], [430, hex('#213f86')], [640, hex('#2a6a98')],
  [820, hex('#46989f')], [960, hex('#8cc4ae')], [1070, hex('#ead6a2')], [1170, hex('#f8b183')],
  [1280, hex('#f0808a')], [1370, hex('#d0608a')], [1420, hex('#a8527f')],
];
const GLOW = hex('#ffe3a6'), WARM = hex('#ffb07a');
function skyCol(x, y) {
  const yy = y - 110 * (1 - Math.exp(-sq((x - SUNX) / 1700)));
  let c = ramp(SKY, yy);
  const g2 = Math.exp(-sq((x - SUNX) / 1700) - sq((y - HY) / 480));
  c = mix(c, WARM, 0.22 * g2);
  const g = Math.exp(-sq((x - SUNX) / 760) - sq((y - HY) / 230));
  c = mix(c, GLOW, 0.8 * g);
  return c;
}
// the box of sky pencils (a hand only owns so many)
const SKYP = ['#101440', '#1c2a7a', '#2a4a9a', '#2f6f9f', '#3f9aa0', '#7cc0b0', '#c8dcb0', '#f3d9a0', '#f7b58a', '#f48f8a', '#e0689a', '#b0588f', '#6a4a90', '#ffe9b8'].map(hex);
function nearPencil(box, c, E) {
  let b0 = 0, b1 = 0, d0 = 1e9, d1 = 1e9;
  for (let i = 0; i < box.length; i++) {
    const p = box[i], d = sq(p[0] - c[0]) + sq(p[1] - c[1]) + sq(p[2] - c[2]);
    if (d < d0) { d1 = d0; b1 = b0; d0 = d; b0 = i; } else if (d < d1) { d1 = d; b1 = i; }
  }
  return box[E.rnd() < 0.62 ? b0 : b1];
}

// ---------------------------------------------------------------- the cloud (a pile of soft spheres, read as 4 tones)
function mul32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const CBASE = 1345;
const SPH = [];
(function () {
  const r = mul32(4711);
  const BIG = [
    [3080, 1170, 300], [2990, 930, 270], [3130, 700, 250], [3050, 500, 200], [3210, 880, 220],
    [3600, 1180, 280], [3660, 930, 220], [3590, 740, 170],
    [2650, 1200, 240], [2590, 1010, 180], [2400, 1240, 170], [2270, 1290, 100],
    [3900, 1130, 260], [3890, 900, 180], [2840, 1080, 200], [3380, 1080, 220],
  ];
  const add = (x, y, rad, zb, lvl) => {
    SPH.push([x, y, rad, zb]);
    if (lvl >= 2) return;
    const n = lvl === 0 ? 9 : 4;
    for (let i = 0; i < n; i++) {
      const face = r() < (lvl === 0 ? 0.4 : 0.22);
      const a = -Math.PI / 2 + (r() - 0.5) * (face ? 6.28 : 3.9);
      const d = rad * (face ? r() * 0.62 : 0.62 + 0.38 * r());
      const cr = rad * (0.3 + 0.27 * r());
      add(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.9, cr, Math.sqrt(Math.max(0, rad * rad - d * d)) + zb - 0.35 * cr, lvl + 1);
    }
  };
  for (const b of BIG) add(b[0], b[1], b[2], r() * 40, 0);
})();
const CG = { x0: 2060, y0: 230, x1: 4000, y1: CBASE + 12, c: 3, w: 0, h: 0, tone: null, own: null };
const LX = -0.624, LY = -0.50, LZ = 0.60;
function buildCloud() {
  CG.w = Math.ceil((CG.x1 - CG.x0) / CG.c); CG.h = Math.ceil((CG.y1 - CG.y0) / CG.c);
  const n = CG.w * CG.h;
  CG.tone = new Uint8Array(n); CG.own = new Int16Array(n).fill(-1);
  const zm = new Float32Array(n).fill(-1e9), vm = new Float32Array(n);
  for (let k = 0; k < SPH.length; k++) {
    const s = SPH[k], r = s[2];
    const i0 = Math.max(0, Math.floor((s[0] - r - CG.x0) / CG.c)), i1 = Math.min(CG.w - 1, Math.ceil((s[0] + r - CG.x0) / CG.c));
    const j0 = Math.max(0, Math.floor((s[1] - r - CG.y0) / CG.c)), j1 = Math.min(CG.h - 1, Math.ceil((s[1] + r - CG.y0) / CG.c));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = CG.x0 + (i + 0.5) * CG.c - s[0], dy = CG.y0 + (j + 0.5) * CG.c - s[1], d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      const zz = Math.sqrt(r * r - d2), z = zz + s[3], q = j * CG.w + i;
      if (z > zm[q]) { zm[q] = z; CG.own[q] = k; vm[q] = (dx * LX + dy * LY + zz * LZ) / r; }
    }
  }
  const ux = LX / 0.8, uy = LY / 0.8;
  for (let j = 0; j < CG.h; j++) for (let i = 0; i < CG.w; i++) {
    const q = j * CG.w + i;
    if (CG.own[q] < 0) continue;
    const x = CG.x0 + (i + 0.5) * CG.c, y = CG.y0 + (j + 0.5) * CG.c;
    if (y > CBASE - 14 * vnoise(x / 60, 3, 31) - 6) { CG.own[q] = -1; continue; }
    let v = vm[q];
    // does a neighbouring puff stand between this spot and the light?
    for (let st = 1; st <= 9; st++) {
      const dist = st * 11, ii = Math.floor((x + ux * dist - CG.x0) / CG.c), jj = Math.floor((y + uy * dist - CG.y0) / CG.c);
      if (ii < 0 || jj < 0 || ii >= CG.w || jj >= CG.h) break;
      if (zm[jj * CG.w + ii] > zm[q] + 0.75 * dist + 5) { v = Math.min(v, -0.12 - 0.03 * st); break; }
    }
    const alt = clamp((1290 - y) / (1290 - 500), 0, 1);
    v = v + (alt - 1) * 1.6 + (fbm(x / 130, y / 130, 41, 3) - 0.5) * 0.14;
    CG.tone[q] = v > 0.48 ? 1 : v > 0.1 ? 2 : v > -0.72 ? 3 : 4;
  }
}
function cloudTone(x, y) {
  if (x < CG.x0 || x >= CG.x1 || y < CG.y0 || y >= CG.y1) return 0;
  if (!CG.tone) buildCloud();
  const q = Math.floor((y - CG.y0) / CG.c) * CG.w + Math.floor((x - CG.x0) / CG.c);
  return CG.own[q] < 0 ? 0 : CG.tone[q];
}
function cloudOwner(x, y) { return SPH[CG.own[Math.floor((y - CG.y0) / CG.c) * CG.w + Math.floor((x - CG.x0) / CG.c)]]; }
const CCOL = [null,
  [[300, hex('#ffe9c6')], [700, hex('#ffc4a2')], [1000, hex('#f79a96')]],
  [[300, hex('#f5a89c')], [700, hex('#de8aa0')], [1100, hex('#c4729e')]],
  [[300, hex('#9483bc')], [700, hex('#7669aa')], [1000, hex('#5f5c9e')], [1340, hex('#74588f')]],
  [[500, hex('#5a5a9e')], [900, hex('#454c8c')], [1200, hex('#4d4a88')], [1340, hex('#6a4f88')]],
];
function cloudCol(tone, y) { return ramp(CCOL[tone], y); }

// ---------------------------------------------------------------- the trail
const TRAIL = [[1486, 1142], [1290, 990], [1010, 762], [640, 452], [250, 118], [20, -90]];
function trailPt(t) {
  const n = TRAIL.length - 1, u = clamp(t, 0, 0.9999) * n, i = Math.floor(u), f = u - i;
  const p0 = TRAIL[Math.max(0, i - 1)], p1 = TRAIL[i], p2 = TRAIL[i + 1], p3 = TRAIL[Math.min(n, i + 2)];
  const f2 = f * f, f3 = f2 * f;
  const e = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f3);
  const d = (k) => 0.5 * ((-p0[k] + p2[k]) + 2 * (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f + 3 * (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f2);
  let tx = d(0), ty = d(1); const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return [e(0), e(1), tx, ty];
}
const trailW = (t) => 2.5 + 78 * Math.pow(t, 1.25);
const TRC = [[-0.5, hex('#9a78b4')], [-0.15, hex('#e58fa6')], [0.12, hex('#ffb3a0')], [0.5, hex('#ffe9c8')]];

// what the sky looks like at a point (for anything that mirrors it)
function skyScene(x, y) {
  const t = cloudTone(x, y);
  if (t) return cloudCol(t, y);
  return skyCol(x, y);
}

// ================================================================ SKY
function drawSky(E) {
  // 1. pastel on its side, long sweeps, rubbed in
  for (let pass = 0; pass < 2; pass++) {
    for (let y = -60 + pass * 19; y < HY + 60; y += 38) {
      E.reseed(1000 + pass * 5000 + y);
      if (!E.vis(-300, y - 150, W + 300, y + 150)) continue;
      let x = -300 - E.rnd() * 600;
      while (x < W + 100) {
        const near = Math.exp(-sq((x - SUNX) / 1100)) * sstep(700, 1300, y);
        const L = E.rr(500, 1500) * (1 - 0.6 * near);
        const a = E.rr(-0.035, 0.035), yy = y + E.rr(-14, 14);
        E.line(x, yy - a * L / 2, x + L, yy + a * L / 2, T.rub, skyCol(x + L / 2, yy), { p: E.rr(0.78, 0.95), w: E.rr(0.8, 1.1) });
        x += L * E.rr(0.55, 0.85);
      }
    }
  }
  // 2. dragged pastel so the tooth and the stick show
  E.reseed(77);
  for (let i = 0; i < 1100; i++) {
    const x = E.rr(-100, W + 100), y = E.rr(-40, HY + 20), L = E.rr(180, 620), a = -0.16 + E.rr(-0.1, 0.1);
    const c = skyCol(x, y + E.rr(-50, 50));
    const ca = Math.cos(a) * L / 2, sa = Math.sin(a) * L / 2;
    E.line(x - ca, y - sa, x + ca, y + sa, T.pastel, c, { p: E.rr(0.35, 0.7), w: E.rr(0.6, 1.2) });
  }
  // 3. coloured pencil hatching, patch by patch, wrist-arc strokes
  E.reseed(78);
  for (let i = 0; i < 620; i++) {
    const cx = E.rr(-50, W + 50), cy = E.rr(-50, HY + 10), rad = E.rr(110, 240);
    const cross = E.rnd() < 0.22;
    const ang = cross ? 0.5 + E.rr(-0.2, 0.2) : -0.62 + E.rr(-0.16, 0.16);
    const pc = nearPencil(SKYP, skyCol(cx, cy + E.rr(-60, 60)), E);
    patch(E, cx, cy, rad, ang, E.rr(8, 13), T.pencil, pc, E.rr(0.38, 0.62));
  }
}
function patch(E, cx, cy, rad, ang, sp, tool, col, p, o) {
  const ca = Math.cos(ang), sa = Math.sin(ang), bow = E.rr(-0.05, 0.05);
  const so = Object.assign({ p: 1, bow, taper: 1 }, o || {});
  for (let off = -rad; off < rad; off += sp * E.rr(0.7, 1.3)) {
    const hl = Math.sqrt(rad * rad - off * off) * E.rr(0.65, 1.05), sh = E.rr(-0.12, 0.12) * rad;
    const x = cx - sa * off + ca * sh, y = cy + ca * off + sa * sh;
    so.p = p * E.rr(0.8, 1.15);
    E.line(x - ca * hl, y - sa * hl, x + ca * hl, y + sa * hl, tool, col, so);
  }
}

function drawMoon(E) {
  E.reseed(4300);
  // a thin new moon, lit from below by the sun that has gone
  const mx = 2010, my = 500, R = 30, a0 = 0.95;
  for (let k = 0; k < 40; k++) { // earthshine: barely there
    const a = E.rnd() * 6.283, r = R * Math.sqrt(E.rnd()) * 0.9;
    E.line(mx + Math.cos(a) * r - 4, my + Math.sin(a) * r - 3, mx + Math.cos(a) * r + 4, my + Math.sin(a) * r + 3, T.pencil, hex('#5f8fa8'), { p: 0.35 });
  }
  for (let j = 0; j < 8; j++) {
    const pts = [], rr = R - j * 1.25, span = 1.32 - j * 0.15;
    for (let k = 0; k <= 12; k++) { const th = 1.85 - span + 2 * span * k / 12; pts.push([mx + Math.cos(th) * rr + j * 0.35, my + Math.sin(th) * rr - j * 0.2]); }
    E.curve(pts, T.chalk, j < 5 ? hex('#fff6dc') : hex('#ffe6b8'), { p: 1.1, w: 0.62, taper: 1, ti: 0.3, to: 0.3, tooth: 0.2 });
  }
}

// high thin ice cloud, the last thing up there still catching any colour
function drawCirrus(E) {
  E.reseed(4400);
  const G = [[1650, 830, 520, -0.12, 20], [2080, 700, 420, -0.2, 14], [560, 900, 480, -0.08, 16], [1180, 1010, 380, -0.05, 12]];
  for (const [cx, cy, len, ang, n] of G) {
    for (let k = 0; k < n; k++) {
      const off = (k - n / 2) * E.rr(9, 16), sh = E.rr(-0.3, 0.3) * len, L = len * E.rr(0.35, 1), a = ang + E.rr(-0.05, 0.05) + (k - n / 2) * 0.012;
      const x0 = cx + sh - Math.cos(a) * L / 2 - Math.sin(a) * off, y0 = cy - Math.sin(a) * L / 2 + Math.cos(a) * off;
      const x1 = x0 + Math.cos(a) * L, y1 = y0 + Math.sin(a) * L;
      const c = mix(skyCol((x0 + x1) / 2, (y0 + y1) / 2), cy > 600 ? hex('#ffc0b0') : hex('#c9a0d8'), E.rr(0.45, 0.8));
      E.curve([[x0, y0], [(x0 + x1) / 2, (y0 + y1) / 2 - L * 0.03], [x1 + L * 0.06, y1 - L * 0.07]], E.rnd() < 0.5 ? T.tip : T.pencil, c, { p: E.rr(0.3, 0.6), w: E.rr(0.5, 0.9), taper: 1, ti: 0.4, to: 0.5, tooth: 0.9 });
    }
  }
}

function drawStars(E) {
  E.reseed(4242);
  const white = hex('#fff6e0'), blue = hex('#cfe0ff'), peach = hex('#ffd9c0');
  for (let i = 0; i < 130; i++) {
    const x = E.rr(0, W), y = 800 * Math.pow(E.rnd(), 1.9), b = E.rnd(), k = E.rnd();
    if (cloudTone(x, y) || Math.hypot(x - 2010, y - 500) < 60) continue;
    const r = 1.2 + 3.0 * Math.pow(b, 9);
    const col = k < 0.5 ? white : k < 0.8 ? blue : peach;
    const p = clamp(1.0 - y / 800, 0.12, 1) * (0.45 + 0.55 * b);
    E.dot(x, y, r, T.chalk, col, { p: p });
    if (b > 0.955) {
      const l = r * 3.4;
      E.line(x - l, y, x + l, y, T.sharp, col, { p: 0.45 * p, taper: 1, ti: 0.5, to: 0.5 });
      E.line(x, y - l, x, y + l, T.sharp, col, { p: 0.45 * p, taper: 1, ti: 0.5, to: 0.5 });
    }
  }
}

// thin flat clouds lying along the horizon, lit from underneath
function drawStrata(E) {
  E.reseed(555);
  const L = [[520, 1262, 430, 15], [980, 1318, 540, 12], [300, 1354, 340, 9], [1500, 1248, 360, 11], [1250, 1378, 300, 7],
    [2060, 1296, 300, 11], [1760, 1352, 420, 8], [760, 1202, 260, 9], [140, 1182, 300, 11], [1050, 1150, 200, 6], [2300, 1380, 260, 7]];
  for (const [cx, cy, hl, th] of L) {
    const nearSun = Math.exp(-sq((cx - SUNX) / 900));
    const dark = mix(hex('#74508e'), hex('#a25a88'), nearSun), lite = mix(hex('#f7868c'), hex('#ffd9a0'), nearSun);
    const mid = mix(hex('#b0608f'), hex('#e3837f'), nearSun);
    const n = Math.round(th * 1.6);
    for (let k = 0; k < n; k++) {
      const v = (k + E.rnd()) / n * 2 - 1; // -1 top .. 1 bottom
      const half = hl * Math.sqrt(Math.max(0.02, 1 - v * v)) * E.rr(0.7, 1.05), sh = E.rr(-0.15, 0.15) * hl;
      const y = cy + v * th + E.rr(-2, 2);
      const c = v > 0.45 ? lite : v > 0.0 ? mid : dark;
      E.line(cx + sh - half, y + E.rr(-3, 3), cx + sh + half, y + E.rr(-3, 3), T.tip, c, { p: E.rr(0.6, 0.95), w: E.rr(0.5, 0.9), taper: 1, ti: 0.3, to: 0.3 });
    }
    // a bright scratch of light under it
    for (let k = 0; k < 3; k++) {
      const half = hl * E.rr(0.3, 0.7), sh = E.rr(-0.3, 0.3) * hl;
      E.line(cx + sh - half, cy + th * 1.05 + k, cx + sh + half, cy + th * 1.05 + k + E.rr(-2, 2), T.pencil, hex('#ffe9b8'), { p: 0.8, taper: 1, ti: 0.4, to: 0.4 });
    }
  }
}

function drawCloud(E) {
  const bb = [CG.x0, CG.y0, CG.x1, CG.y1];
  E.reseed(600);
  if (!E.vis(bb[0] - 50, bb[1] - 50, bb[2] + 50, bb[3] + 50)) return;
  // the whole mass first, in its shadow colour, so no sky peeps through between the tones
  const any = (x, y) => cloudTone(x, y) > 0;
  E.hatch({ inside: any, bbox: bb, angle: 0.2, spacing: 18, tool: T.soft, color: (x, y) => cloudCol(3, y), p: 0.97, len: [80, 260], endJit: 3, step: 3, tooth: 0.12 });
  E.hatch({ inside: any, bbox: bb, angle: -1.1, spacing: 9, tool: T.tip, color: (x, y) => cloudCol(3, y), p: 0.95, len: [30, 130], endJit: 2, step: 2.5, tooth: 0.15 });
  const angs = [0, -0.55, -0.5, 0.42, 0.3];
  for (const tone of [4, 3, 2, 1]) {
    const ins = (x, y) => cloudTone(x, y) === tone;
    const col = (x, y) => cloudCol(tone, y);
    E.hatch({ inside: ins, bbox: bb, angle: angs[tone], spacing: 19, tool: T.soft, color: col, p: 0.92, len: [70, 240], endJit: 3, step: 3 });
    E.hatch({ inside: ins, bbox: bb, angle: angs[tone] + 1.45, spacing: 8, tool: T.tip, color: col, p: 0.8, len: [30, 130], endJit: 2.2, step: 2.5, w: 0.9 });
  }
  // pencil over the pastel: each tone gets hatching from neighbouring pencils
  const PC = [null,
    ['#fff3d6', '#ffd9a8', '#ffc0b0'], ['#f08a9a', '#ffb09a', '#d77aa8'],
    ['#5a56a6', '#8a7cc0', '#6a4a90', '#4a6aa8'], ['#343a80', '#4a4a96', '#2f5a8f', '#5a3f84']].map((a) => a && a.map(hex));
  for (const tone of [4, 3, 2, 1]) {
    const ins = (x, y) => cloudTone(x, y) === tone;
    for (let k = 0; k < 2; k++) {
      const pcs = PC[tone];
      E.hatch({ inside: ins, bbox: bb, angle: (k ? 0.75 : -0.62) + (tone > 2 ? 0.25 : 0), spacing: k ? 17 : 10, tool: T.pencil,
        color: () => pcs[Math.floor(E.rnd() * pcs.length)], p: k ? 0.5 : 0.62, len: [40, 150], endJit: 4, step: 3 });
    }
  }
  // rim light: little arcs of chalk where a puff turns to the light against the sky
  E.reseed(601);
  const rimC = hex('#fff6dc'), rimP = hex('#ffc9b4');
  for (let i = 0; i < 26000; i++) {
    const x = E.rr(bb[0], bb[2]), y = E.rr(bb[1], bb[3]);
    const t = cloudTone(x, y);
    if (!t || t > 2) continue;
    if (cloudTone(x + LX * 9, y + LY * 9) !== 0) continue;
    const s = cloudOwner(x, y);
    let tx = -(y - s[1]), ty = x - s[0]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const hl = E.rr(5, 14);
    E.line(x - tx * hl, y - ty * hl, x + tx * hl, y + ty * hl, T.chalk, y < 800 ? rimC : rimP, { p: E.rr(0.5, 0.95), w: E.rr(0.6, 1.1), bow: 0.08 });
  }
  // and the cool reflected edge on the dark side
  for (let i = 0; i < 12000; i++) {
    const x = E.rr(bb[0], bb[2]), y = E.rr(bb[1], bb[3]);
    const t = cloudTone(x, y);
    if (t < 3) continue;
    if (cloudTone(x - LX * 8, y - LY * 8) !== 0) continue;
    const s = cloudOwner(x, y);
    let tx = -(y - s[1]), ty = x - s[0]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const hl = E.rr(5, 12);
    E.line(x - tx * hl, y - ty * hl, x + tx * hl, y + ty * hl, T.pencil, hex('#9c9ad6'), { p: E.rr(0.4, 0.7), bow: 0.08 });
  }
}

function drawTrail(E) {
  E.reseed(699);
  // body rubbed in first
  for (let i = 0; i < 260; i++) {
    const t = 0.05 + 0.95 * (i + E.rnd()) / 260, r = E.rnd();
    const dens = 0.3 + 0.7 * sstep(0.2, 0.55, n1(t * 17 + 2));
    if ((t > 0.43 && t < 0.468) || r > dens + 0.2) { continue; }
    const [px, py, tx, ty] = trailPt(t), w = trailW(t) * (0.6 + 0.85 * n1(t * 46 + 5) * (0.5 + 0.8 * n1(t * 110 + 9)));
    const hl = 10 + w * 0.8, o = (E.rnd() - 0.5) * w * 0.3;
    E.line(px - ty * o - tx * hl, py + tx * o - ty * hl, px - ty * o + tx * hl, py + tx * o + ty * hl, T.smudge, mix(hex('#e58fa6'), hex('#ffc0a8'), E.rnd()), { w: Math.max(3, w * 0.75) / T.smudge.width, edge: Math.max(2, w * 0.4), p: 0.9, flow: 2.2, taper: 1, ti: 0.3, to: 0.3 });
  }
  E.reseed(700);
  const N = 3600;
  for (let i = 0; i < N; i++) {
    const t = Math.pow((i + E.rnd()) / N, 0.9), q0 = E.rnd() + E.rnd() - 1, r1 = E.rnd(), r2 = E.rnd(), r3 = E.rnd();
    if (t < 0.035) continue;
    // the beaded, vertebra look of a trail that has been hanging a while
    const bil = 0.6 + 0.85 * n1(t * 46 + 5) * (0.5 + 0.8 * n1(t * 110 + 9));
    let dens = 0.3 + 0.7 * sstep(0.2, 0.55, n1(t * 17 + 2));
    if (t > 0.43 && t < 0.468) dens *= 0.1;
    if (t > 0.78 && t < 0.8) dens *= 0.3;
    if (r1 > dens) continue;
    const [px, py, tx, ty] = trailPt(t), w = trailW(t) * bil;
    const q = q0 * 0.5;
    const drift = t * t * 26 * (n1(t * 37 + 1) - 0.4);
    const x = px + (-ty) * (q * w + drift), y = py + tx * (q * w + drift);
    const rot = (r2 - 0.5) * 0.22 + (r3 < 0.25 ? t * 0.8 * (r2 - 0.3) : 0);
    const ca = Math.cos(rot), sa = Math.sin(rot);
    const dx = tx * ca - ty * sa, dy = tx * sa + ty * ca;
    const hl = 7 + w * (0.3 + 0.8 * r3);
    let c = ramp(TRC, q + (r2 - 0.5) * 0.3);
    c = mix(c, hex('#fff0cc'), 0.55 * (1 - t) * (1 - t));
    const edgeFade = 1 - Math.pow(Math.abs(q0), 2.2) * 0.75;
    const tool = w < 12 ? T.chalk : T.tip;
    E.line(x - dx * hl, y - dy * hl, x + dx * hl, y + dy * hl, tool, c,
      { p: (0.5 + 0.5 * r3) * edgeFade * (1 - 0.3 * t), w: w < 12 ? 0.7 : 0.45 + 0.5 * r2, tooth: 0.55 });
  }
  // the fresh end: two fine lines closing to one bright point
  const head = trailPt(0);
  for (const sd of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 8; k++) { const t = 0.003 + k * 0.007; const [px, py, tx, ty] = trailPt(t); const o = sd * (1.0 + 30 * t); pts.push([px - ty * o, py + tx * o]); }
    E.curve(pts, T.chalk, hex('#fff3d2'), { p: 0.95, w: 0.55, taper: 3 });
    E.curve(pts, T.sharp, hex('#ffd0a8'), { p: 0.8, taper: 3 });
  }
  E.glow(head[0], head[1], 20, T.pencil, hex('#fff0c0'), { n: 16, p: 0.8, len: 0.5 });
  E.dot(head[0] + 2, head[1] + 3, 3.4, T.chalk, hex('#ffffff'), { p: 1.2 });
  E.line(head[0] - 11, head[1] + 3, head[0] + 15, head[1] + 3, T.sharp, hex('#fff6da'), { p: 0.8, taper: 1, ti: 0.5, to: 0.5 });
  E.line(head[0] + 2, head[1] - 9, head[0] + 2, head[1] + 15, T.sharp, hex('#fff6da'), { p: 0.8, taper: 1, ti: 0.5, to: 0.5 });
}

function draw(E, only) {
  const S = [['sky', drawSky], ['stars', drawStars], ['moon', drawMoon], ['cirrus', drawCirrus], ['strata', drawStrata], ['cloud', drawCloud], ['trail', drawTrail]];
  const on = (n) => !only || only.split(',').indexOf(n) >= 0;
  for (const [name, fn] of S) if (on(name)) fn(E);
  require('./ground.js')(E, { T, W, H, HY, VPX, F, EH, SUNX, SKYP, skyCol, skyScene, cloudTone, trailPt, trailW, patch, nearPencil }, on);
}

module.exports = { draw, PAPER };
