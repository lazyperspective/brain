'use strict';
const { T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm } = require('./engine');
const { wob, wobPath, arc, curve, fillPoly, outline, pick, grad, jit } = require('./lib');

const HZ = 626, SUN = [1640, 655];
const G = [[0, '#ffb24d'], [0.05, '#ffc673'], [0.11, '#ffdf9f'], [0.19, '#e4efbf'], [0.28, '#9fe0cb'], [0.38, '#5cb9d2'],
[0.50, '#3b88cf'], [0.64, '#3058ba'], [0.80, '#2b3692'], [0.98, '#1f1f68'], [1.3, '#17174e']].map(([t, c]) => [t, hex(c)]);
const ROSE = hex('#ee8aa4'), LAV = hex('#a690d8'), ESH = hex('#6c78b6'), CORAL = hex('#ff8668');
function skyCol(x, y) {
  const e = clamp((HZ - y) / HZ, -0.05, 1.1), az = (x - SUN[0]) / 1920, na = Math.max(0, -az);
  const t = Math.max(0, e) + 0.40 * Math.pow(Math.abs(az), 1.35) + 0.03 * (fbm(x / 260, y / 120, 5, 3) - 0.5);
  let c = grad(G, t);
  const cb = Math.exp(-Math.max(0, e) / 0.05) * sstep(0.04, 0.22, na) * (1 - sstep(0.3, 0.6, na));
  c = mixc(c, CORAL, 0.6 * cb);
  const pk = Math.exp(-Math.max(0, e - 0.035) / 0.085) * sstep(0.22, 0.62, na);
  c = mixc(c, ROSE, 0.8 * pk);
  const lv = Math.exp(-(((e - 0.17) / 0.085) ** 2)) * sstep(0.2, 0.65, na);
  c = mixc(c, LAV, 0.5 * lv);
  const es = (1 - sstep(0.0, 0.045, e)) * sstep(0.3, 0.7, na);
  c = mixc(c, ESH, 0.7 * es);
  return c;
}
const SKY_STICKS = ['#ffb24d', '#ffc673', '#ffdf9f', '#fff0c4', '#e4efbf', '#c4ead0', '#9fe0cb', '#7dcfd0', '#5cb9d2', '#4aa0d2', '#3b88cf', '#346fc6',
  '#3058ba', '#2d46a6', '#2b3692', '#252a7c', '#1f1f68', '#18184f', '#ee8aa4', '#f3a2a8', '#d98cb8', '#a690d8', '#8a86cc', '#6c78b6', '#ff8668', '#ff9f7c', '#c9a0d4', '#7f9fd8'].map(hex);

function drawSky(cv, seed) {
  const R = rng32(seed);
  // faint construction lines (the under-drawing)
  for (let i = 0; i < 3; i++) cv.stroke(wob(-5, HZ + (R() - 0.5) * 3, 1925, HZ + (R() - 0.5) * 3, R, 1.2, 0.002), { ...T.pencil, w: 1.1, col: hex('#7a5a6a'), P: 0.5 });
  // --- layer A: broad side-of-stick strokes
  for (let y = -14; y < HZ + 16; y += 13) {
    let x = -200 * R();
    while (x < 1930) {
      const L = 150 + R() * 260, yy = y + (R() - 0.5) * 12, tilt = (R() - 0.55) * 0.07;
      const mx = x + L / 2, col = jit(pick(skyCol(mx, yy), SKY_STICKS, R, 1.4), 0.012, R);
      const pts = wob(x, yy - tilt * L / 2, x + L, yy + tilt * L / 2, R, 2.5, 0.03);
      if (R() < 0.5) pts.reverse();
      cv.stroke(pts, { ...T.pastel, w: 30 + R() * 16, col, P: 0.8 + R() * 0.14, tin: 0.1, tout: 0.14 });
      x += L * (0.45 + R() * 0.25);
    }
  }
  // --- finger blending, long horizontal sweeps
  for (let y = 8; y < HZ + 10; y += 21) {
    let x = -40 + R() * 80; const dir = R() < 0.5;
    const P = [];
    for (let k = 0; k <= 16; k++) P.push([x + k * 125, y + Math.sin(k * 0.9 + R()) * 7 + (R() - 0.5) * 6]);
    if (dir) P.reverse();
    cv.smudge(P, { r: 25 + R() * 12, str: 0.2, pick: 0.3 });
  }
  // --- layer B: lighter, more open strokes left unblended (texture, direction)
  for (let y = -6; y < HZ + 8; y += 17) {
    let x = -160 * R();
    while (x < 1930) {
      const L = 90 + R() * 200, yy = y + (R() - 0.5) * 16, tilt = -0.02 + (R() - 0.6) * 0.16;
      const mx = x + L / 2, col = jit(mixc(pick(skyCol(mx, yy), SKY_STICKS, R, 2.2), skyCol(mx, yy), 0.45), 0.012, R);
      cv.stroke(wob(x, yy - tilt * L / 2, x + L, yy + tilt * L / 2, R, 2, 0.03), { ...T.pastel, w: 14 + R() * 14, col, P: 0.46 + R() * 0.18, tin: 0.22, tout: 0.3, sa: 0.45 });
      if (R() < 0.4) cv.smudge([[x, yy], [x + L, yy]], { r: 12, str: 0.12, pick: 0.4 });
      x += L * (0.9 + R() * 0.9);
    }
  }
  // --- crepuscular rays fanning from behind the big cloud (pastel dust rubbed in with a pad)
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (1.085 + i * 0.052 + (R() - 0.5) * 0.03), r0 = 380 + R() * 120, r1 = 760 + R() * 420;
    const ca = Math.cos(a), sa = Math.sin(a), wid = 0.012 + R() * 0.02;
    for (let r = r0; r < r1; r += 9) {
      const t = (r - r0) / (r1 - r0), x = SUN[0] + ca * r, y = SUN[1] + sa * r;
      const f = Math.sin(Math.PI * Math.pow(t, 0.7));
      cv.dust(x + (R() - 0.5) * 4, y + (R() - 0.5) * 4, r * wid + 4, mixc(skyCol(x, y), hex('#fff2c8'), 0.6), 0.075 * f);
    }
  }
  // --- pencil cross-hatching in the deep blue (keeps it a drawing)
  const pc = [hex('#232a86'), hex('#2a3aa0'), hex('#3a2c8c'), hex('#1c1c60')];
  for (let i = 0; i < 1500; i++) {
    const x = R() * 1500 - 80, y = R() * R() * 420 - 10;
    const dk = 1 - (skyCol(x, y)[0] + skyCol(x, y)[1]) * 1.2; if (dk < 0.15 || R() > dk * 1.3) continue;
    const L = 22 + R() * 40, a = -1.0 + (R() - 0.5) * 0.25;
    cv.stroke(wob(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, R, 0.6, 0.02), { ...T.pencil, w: 1.5 + R(), col: pc[(R() * 4) | 0], P: 0.42 + R() * 0.22 });
  }
  // warm pencil hatching near the glow
  const wc = [hex('#ff9a4a'), hex('#ffb86a'), hex('#ff8a6a'), hex('#ffd27a')];
  for (let i = 0; i < 520; i++) {
    const x = 900 + R() * 1040, y = HZ - R() * R() * 190;
    const L = 26 + R() * 50, a = -0.95 + (R() - 0.5) * 0.3;
    cv.stroke(wob(x, y, x + Math.cos(a) * L, y + Math.sin(a) * L, R, 0.6, 0.02), { ...T.pencil, w: 1.4 + R(), col: wc[(R() * 4) | 0], P: 0.42 + R() * 0.2 });
  }
}

// ---------------------------------------------------------------- cirrus + stars + moon
function drawHighSky(cv, seed) {
  const R = rng32(seed);
  // high cirrus still in sunlight: long hooked wisps
  const cc = ['#ff9fa6', '#ffb8a0', '#f58bb0', '#ffd0a8', '#e89ac8'].map(hex);
  const wisp = (x, y, L, a, w, col, P) => {
    const P0 = [];
    const n = 6;
    for (let k = 0; k <= n; k++) { const t = k / n; P0.push([x + Math.cos(a) * L * t + Math.sin(t * 3.0) * 6, y + Math.sin(a) * L * t - Math.pow(t, 2.2) * L * 0.16]); }
    const c = curve(P0, 8);
    cv.stroke(c, { ...T.pastel, w, col, P, tin: 0.25, tout: 0.5, sa: 0.5 });
  };
  const groups = [[120, 318, 20], [560, 232, 13], [40, 105, 10], [380, 430, 9]];
  for (const [gx, gy, n] of groups) {
    const a0 = -0.16 + (R() - 0.5) * 0.08;
    for (let i = 0; i < n; i++) {
      const x = gx + (R() - 0.3) * 420, y = gy + (R() - 0.5) * 70 + (x - gx) * Math.tan(a0) * 0.5;
      const L = 70 + R() * 260;
      const e = (HZ - y) / HZ, c = e > 0.6 ? mixc(cc[(R() * 5) | 0], hex('#c9a0e0'), 0.35) : cc[(R() * 5) | 0];
      wisp(x, y, L, a0 + (R() - 0.5) * 0.12, 2.5 + R() * R() * 12, c, 0.4 + R() * 0.3);
    }
    for (let i = 0; i < 4; i++) {
      const x = gx + (R() - 0.3) * 380, y = gy + (R() - 0.5) * 50;
      cv.smudge([[x, y], [x + 120, y - 16], [x + 240, y - 40]], { r: 9 + R() * 6, str: 0.16, pick: 0.25 });
    }
    // a few crisp pencil hairs on top
    for (let i = 0; i < n * 0.5; i++) {
      const x = gx + (R() - 0.3) * 420, y = gy + (R() - 0.5) * 60, L = 60 + R() * 150;
      wisp(x, y, L, a0 + (R() - 0.5) * 0.08, 1.4 + R(), hex(R() < 0.5 ? '#ffd9c0' : '#ffb0b8'), 0.6 + R() * 0.25);
    }
  }
  // stars
  for (let i = 0; i < 230; i++) {
    const x = R() * 1500, y = R() * R() * 430;
    const c = skyCol(x, y), lum = c[0] * 0.4 + c[1] * 0.6; if (lum > 0.42 + R() * 0.1) continue;
    const big = R() < 0.07, r = big ? 1.6 + R() * 1.2 : 0.5 + R() * 0.9;
    const col = hex(['#fff8e0', '#ffe9c0', '#d8f0ff', '#ffd6e6'][(R() * 4) | 0]);
    cv.stroke([[x - r * 0.3, y], [x + r * 0.3, y + 0.2]], { ...T.oil, w: r * 1.7, col, P: 0.9 + R() * 0.2 });
    if (big) {
      const s = 5 + R() * 7;
      cv.dust(x, y, 5, mixc(col, c, 0.4), 0.3);
      cv.stroke(wob(x - s, y, x + s, y, R, 0.2, 0), { ...T.pencil, w: 0.9, col, P: 0.75, tin: 0.45, tout: 0.45 });
      cv.stroke(wob(x, y - s * 1.2, x, y + s * 1.2, R, 0.2, 0), { ...T.pencil, w: 0.9, col, P: 0.75, tin: 0.45, tout: 0.45 });
      cv.stroke([[x - 0.6, y], [x + 0.6, y]], { ...T.oil, w: r * 2, col: hex('#ffffff'), P: 1.1 });
    }
  }
  // thin crescent moon, lit limb toward the vanished sun
  const mx = 612, my = 152, mr = 27;
  cv.dust(mx, my, 34, hex('#5a78c8'), 0.22);
  for (let i = 0; i < 60; i++) { // earthshine, barely there
    const a = R() * 6.283, rr = Math.sqrt(R()) * (mr - 2);
    cv.stroke(wob(mx + Math.cos(a) * rr - 4, my + Math.sin(a) * rr + 3, mx + Math.cos(a) * rr + 4, my + Math.sin(a) * rr - 3, R, 0.3, 0), { ...T.pencil, w: 1.6, col: hex('#5a6cc0'), P: 0.42 });
  }
  const la = Math.atan2(SUN[1] - my, SUN[0] - mx);
  for (let k = 0; k < 4; k++) {
    const rr = mr - k * 1.15, sp = 1.25 - k * 0.2;
    cv.stroke(arc(mx - Math.cos(la) * k * 0.3, my - Math.sin(la) * k * 0.3, rr, rr, la - sp, la + sp, R, 0.3), { ...T.oil, w: 2.6 - k * 0.3, col: hex(k < 2 ? '#fff6dc' : '#ffe9b8'), P: 1.0, tin: 0.3, tout: 0.3 });
  }
}

// ---------------------------------------------------------------- the great cloud
const LC = [[70, '#fff8dc'], [170, '#ffecb4'], [260, '#ffd69c'], [340, '#ffb890'], [420, '#fb9392'], [490, '#e4739e'], [560, '#b962a4']].map(([t, c]) => [t, hex(c)]);
const SC = [[70, '#c6b0ea'], [190, '#aa96de'], [320, '#8c7ccb'], [440, '#6f68b6'], [540, '#5a5fa6'], [600, '#565c9e']].map(([t, c]) => [t, hex(c)]);
const DC = [[70, '#9a86d6'], [250, '#7667bc'], [420, '#564fa0'], [560, '#434a8c']].map(([t, c]) => [t, hex(c)]);
const CL_STICKS = ['#fff8dc', '#ffecb4', '#ffd69c', '#ffb890', '#fb9392', '#e4739e', '#b962a4', '#c6b0ea', '#aa96de', '#8c7ccb', '#6f68b6', '#5a5fa6', '#9a86d6', '#7667bc',
  '#564fa0', '#434a8c', '#f7b6b0', '#f09ab4', '#d88cc0', '#ffe0c0', '#e8c4e6'].map(hex);
const LD = (() => { const v = [0.80, 0.22, 0.56], l = Math.hypot(...v); return v.map(a => a / l); })();

function buildCloud(seed) {
  const R = rng32(seed), puffs = [];
  const towers = [
    { x: 1400, base: 600, top: 128, w: 285, lean: -60 },
    { x: 1338, base: 340, top: 50, w: 150, lean: -18 },
    { x: 1478, base: 310, top: 138, w: 112, lean: 22 },
    { x: 1110, base: 604, top: 322, w: 185, lean: -34 },
    { x: 1694, base: 604, top: 384, w: 165, lean: 26 },
    { x: 902, base: 606, top: 482, w: 118, lean: -20 },
  ];
  for (const tw of towers) {
    const Ht = tw.base - tw.top;
    const prof = s => { // half width profile along height
      let p;
      if (s < 0.3) p = 1.0 - 0.6 * s; else if (s < 0.55) p = 0.82 - 0.35 * (s - 0.3) + 0.12 * Math.sin((s - 0.3) * 12); else p = 0.74 * Math.sqrt(Math.max(0, 1 - ((s - 0.55) / 0.45) ** 2)) + 0.03;
      return p * tw.w * (1 + 0.2 * Math.sin(s * 14 + tw.x));
    };
    const cxs = s => tw.x + tw.lean * s * s + 26 * Math.sin(s * 5 + tw.x * 0.01);
    tw.prof = prof; tw.cxs = cxs;
    const add = (s, off, rr, lvl) => { const hwid = prof(s); const x = cxs(s) + off * hwid, y = tw.base - s * Ht; puffs.push({ x, y, r: rr, lvl, gx: clamp(off * 0.9, -1, 1), tw, o: R() }); };
    // core
    for (let s = 0.02; s < 0.97; s += 0.04) { const hwid = prof(s); add(s, (R() - 0.5) * 0.7, hwid * (0.5 + R() * 0.22), 0); }
    // mid puffs
    const nm = Math.round(Ht * tw.w / 2500);
    for (let i = 0; i < nm; i++) { const s = Math.pow(R(), 0.8) * 0.99, hwid = prof(s); const off = (R() < 0.5 ? -1 : 1) * (0.25 + R() * 0.72); add(s, off, Math.max(18, hwid * (0.24 + R() * 0.26)), 1); }
    // small edge cauliflower
    const ns = Math.round(Ht * tw.w / 800);
    for (let i = 0; i < ns; i++) { const s = Math.pow(R(), 0.7) * 1.0, hwid = prof(s); const e = R() < 0.86; const off = e ? (R() < 0.5 ? -1 : 1) * (0.72 + R() * 0.36) : (R() - 0.5) * 1.5; add(Math.min(s, 0.995), off, 9 + R() * R() * Math.max(14, hwid * 0.2), 2); }
    // crown
    for (let i = 0; i < 16; i++) { const s = 0.86 + R() * 0.14, hwid = prof(s); add(s, (R() - 0.5) * 2.2, 8 + R() * 22, 2); }
  }
  puffs.sort((a, b) => (a.lvl - b.lvl) || (a.o - b.o));
  return puffs;
}
const prad = (p, a) => p.r * (1 + 0.09 * Math.sin(a * 3 + p.o * 40) + 0.055 * Math.sin(a * 5 + p.o * 90) + 0.03 * Math.sin(a * 9 + p.o * 17));
function parc(p, k, off, a0, a1) { const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * p.r / 4)), pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, r = prad(p, a) * k + off; pts.push([p.x + Math.cos(a) * r, p.y + Math.sin(a) * r]); } return pts; }
function toneClass(p, nx, ny, x, y) {
  const r2 = nx * nx + ny * ny, nz = Math.sqrt(Math.max(0, 1 - r2));
  let ax = nx * 0.74 + p.gx * 0.5, ay = ny * 0.9, az = nz * 0.8 + 0.22;
  const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l;
  const d = ax * LD[0] + ay * LD[1] + az * LD[2];
  const wv = (vnoise(x / 23, y / 23, 77) - 0.5);
  const term = 1 - sstep(450, 585, y + wv * 50);
  const lit = sstep(-0.02, 0.6, d + wv * 0.12) * term;
  if (lit > 0.6) return 0; if (lit > 0.3) return 1; if (d > -0.42) return 2; return 3;
}
function toneCol(c, x, y, R) {
  const lc = grad(LC, y), sc = grad(SC, y), dc = grad(DC, y);
  const term = 1 - sstep(450, 585, y);
  let col = c === 0 ? lc : c === 1 ? mixc(mixc(lc, sc, 0.5), hex('#f59ab4'), 0.4 * term + 0.05) : c === 2 ? sc : dc;
  const hz = sstep(540, 604, y); if (hz > 0) col = mixc(col, mixc(skyCol(x, 604), hex('#8a6fb4'), 0.45), hz * 0.85);
  return col;
}
function drawCloud(cv, seed) {
  const R = rng32(seed), puffs = buildCloud(seed + 1);
  const baseY = 604, X0 = 700, BW = 1220, BH = 612;
  const tid = new Int16Array(BW * BH).fill(-1), cls = new Uint8Array(BW * BH);
  puffs.forEach((p, pi) => {
    const x0 = Math.max(0, Math.floor(p.x - p.r * 1.2 - X0)), x1 = Math.min(BW - 1, Math.ceil(p.x + p.r * 1.2 - X0));
    const y0 = Math.max(0, Math.floor(p.y - p.r * 1.2)), y1 = Math.min(Math.min(BH - 1, baseY), Math.ceil(p.y + p.r * 1.2));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const dx = x + X0 - p.x, dy = y - p.y, d2 = dx * dx + dy * dy; if (d2 > p.r * p.r * 1.45) continue; const rr = prad(p, Math.atan2(dy, dx)); if (d2 < rr * rr) tid[y * BW + x] = pi; }
  });
  for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const i = y * BW + x, t = tid[i]; if (t < 0) continue; const p = puffs[t]; cls[i] = toneClass(p, (x + X0 - p.x) / p.r, (y - p.y) / p.r, x + X0, y); }
  const at = (x, y) => { const xi = Math.round(x - X0), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= BW || yi >= BH) return -1; return yi * BW + xi; };
  // plan strokes from the tone map: straight diagonal hatching that stops at tone edges
  const walk = (x, y, ux, uy, maxd, c) => { let d = 0; for (let t = 2; t <= maxd; t += 2) { const j = at(x + ux * t, y + uy * t); if (j < 0 || tid[j] < 0 || cls[j] !== c) break; d = t; } return d; };
  const layer = (dens, Pb, wk, smooth) => {
    const plan = [], cell = 5;
    for (let gy = 0; gy < BH; gy += cell) for (let gx = 0; gx < BW; gx += cell) {
      const x = gx + R() * cell + X0, y = gy + R() * cell, i = at(x, y); if (i < 0 || tid[i] < 0) continue;
      const p = puffs[tid[i]], c = cls[i];
      const w = clamp(p.r * 0.34, 4, 20) * (0.6 + 0.6 * R()) * wk, L = w * (2.2 + 3.2 * R());
      if (R() > cell * cell * dens / (w * L * 0.7)) continue;
      const ang = -0.62 + (c >= 2 ? 0.25 : 0) + (vnoise(x / 170, y / 170, 31) - 0.5) * 1.3 + (R() - 0.5) * 0.25;
      const ux = Math.cos(ang), uy = Math.sin(ang);
      const d0 = walk(x, y, -ux, -uy, L / 2, c), d1 = walk(x, y, ux, uy, L / 2, c);
      const o0 = Math.max(0.5, d0 - w * 0.3 + R() * 1.5), o1 = Math.max(0.5, d1 - w * 0.3 + R() * 1.5);
      let pts = wob(x - ux * o0, y - uy * o0, x + ux * o1, y + uy * o1, R, 0.9, 0.04);
      if (R() < 0.5) pts.reverse();
      plan.push({ pts, w: Math.min(w, Math.max(3, (d0 + d1) * 1.2 + 3)), c, x, y, k: -c + R() * 1.6 });
    }
    plan.sort((a, b) => a.k - b.k); // darks first, lights last (roughly)
    for (const q of plan) {
      const col = jit(pick(toneCol(q.c, q.x, q.y, R), CL_STICKS, R, smooth), 0.012, R);
      cv.stroke(q.pts, { ...T.pastel, w: q.w, col, P: Pb + R() * 0.2, sa: 0.24, tin: 0.08, tout: 0.1 });
    }
  };
  // underlayer: block in the whole mass with its shadow colour first
  {
    const walkM = (x, y, ux, uy, maxd) => { let d = 0; for (let t = 2; t <= maxd; t += 2) { const j = at(x + ux * t, y + uy * t); if (j < 0 || tid[j] < 0) break; d = t; } return d; };
    for (let gy = 0; gy < BH; gy += 6) for (let gx = 0; gx < BW; gx += 6) {
      const x = gx + R() * 6 + X0, y = gy + R() * 6, i = at(x, y); if (i < 0 || tid[i] < 0) continue;
      if (R() > 0.2) continue;
      const w = 9 + R() * 12, L = 30 + R() * 50, ang = -0.5 + (R() - 0.5) * 0.5, ux = Math.cos(ang), uy = Math.sin(ang);
      const d0 = Math.max(0, walkM(x, y, -ux, -uy, L / 2) - w * 0.35), d1 = Math.max(0, walkM(x, y, ux, uy, L / 2) - w * 0.35);
      const col = jit(mixc(toneCol(2, x, y, R), toneCol(cls[i], x, y, R), 0.4), 0.012, R);
      cv.stroke(wob(x - ux * d0, y - uy * d0, x + ux * d1, y + uy * d1, R, 1, 0.04), { ...T.pastel, w: Math.min(w, (d0 + d1) + 5), col, P: 0.95, sa: 0.2 });
    }
  }
  const edges = (Pb) => {
    for (let pi = 0; pi < puffs.length; pi++) {
      const p = puffs[pi], wE = clamp(p.r * 0.24, 3, 9), ro = -wE * 0.5 - 0.3, re0 = p.r + ro;
      const n = Math.ceil(6.283 * p.r / 11);
      for (let k = 0; k < n; k++) {
        const aa = (k + R()) / n * 6.283;
        const E = a => prad(p, a) + ro; let re = E(aa);
        const j = at(p.x + Math.cos(aa) * re, p.y + Math.sin(aa) * re); if (j < 0 || tid[j] !== pi) continue;
        const c = cls[j], da = 2.5 / p.r, ms = (8 + R() * 16) / p.r; let a0 = 0, a1 = 0;
        for (let a = da; a < ms; a += da) { const q = at(p.x + Math.cos(aa - a) * E(aa - a), p.y + Math.sin(aa - a) * E(aa - a)); if (q < 0 || tid[q] !== pi || cls[q] !== c) break; a0 = a; }
        for (let a = da; a < ms; a += da) { const q = at(p.x + Math.cos(aa + a) * E(aa + a), p.y + Math.sin(aa + a) * E(aa + a)); if (q < 0 || tid[q] !== pi || cls[q] !== c) break; a1 = a; }
        if (a0 + a1 < da) continue;
        const y = p.y + Math.sin(aa) * re, x = p.x + Math.cos(aa) * re;
        const col = jit(pick(toneCol(c, x, y, R), CL_STICKS, R, 2.6), 0.012, R);
        cv.stroke(parc(p, 1, ro, aa - a0, aa + a1), { ...T.ptip, w: wE * (0.8 + 0.4 * R()), col, P: Pb + R() * 0.15 });
      }
    }
  };
  layer(2.8, 0.92, 1, 2.6);
  edges(0.95);
  // fingertip softening, kept inside each tone shape so the cel edges stay crisp
  for (let k = 0; k < 520; k++) {
    const x = X0 + R() * BW, y = R() * (baseY - 12), i = at(x, y); if (i < 0 || tid[i] < 0) continue;
    const c = cls[i], ang = R() * 3.14, ux = Math.cos(ang), uy = Math.sin(ang);
    const d0 = walk(x, y, -ux, -uy, 50, c), d1 = walk(x, y, ux, uy, 50, c); if (d0 + d1 < 16) continue;
    const r = clamp(Math.min(d0 + d1, 60) * 0.2, 4, 11);
    cv.smudge([[x - ux * Math.max(0, d0 - r), y - uy * Math.max(0, d0 - r)], [x + ux * Math.max(0, d1 - r), y + uy * Math.max(0, d1 - r)]], { r, str: 0.16, pick: 0.25 });
  }
  layer(0.75, 0.62, 0.75, 1.6);
  // accents along visible puff edges
  for (let pi = 0; pi < puffs.length; pi++) {
    const p = puffs[pi];
    const n = Math.max(2, Math.round(p.r / 9));
    for (let k = 0; k < n; k++) {
      const aa = R() * 6.283, ca = Math.cos(aa), sa = Math.sin(aa);
      const pr0 = prad(p, aa);
      const ji = at(p.x + ca * (pr0 - 2), p.y + sa * (pr0 - 2)), jo = at(p.x + ca * (pr0 + 2.5), p.y + sa * (pr0 + 2.5));
      if (ji < 0 || tid[ji] !== pi) continue; // edge hidden
      const ci = cls[ji], sky = jo < 0 || tid[jo] < 0, y = p.y + sa * p.r;
      const sp = Math.min(1.1, (10 + R() * 26) / p.r);
      const pts = parc(p, 1, -0.8, aa - sp / 2, aa + sp / 2).filter(q => q[1] < baseY - 2);
      if (pts.length < 3) continue;
      if (sky && ci <= 1 && R() < 0.75) cv.stroke(pts, { ...T.oil, w: 1.4 + R() * 1.6, col: mixc(grad(LC, y - 80), hex('#fffdf0'), 0.55), P: 0.72 + R() * 0.25, tin: 0.3, tout: 0.3 });
      else if (sky && ci >= 2 && R() < 0.4) cv.stroke(pts, { ...T.pencil, w: 1.2 + R() * 0.7, col: hex(y < 300 ? '#6a58b4' : '#463f8e'), P: 0.45 + R() * 0.25, tin: 0.3, tout: 0.3 });
      else if (!sky && jo >= 0) {
        const co = cls[jo];
        if (co === ci && R() < 0.5) cv.stroke(pts, { ...T.pencil, w: 1.1 + R() * 0.7, col: ci <= 1 ? hex(y < 250 ? '#f0a070' : '#e0607e') : hex('#4a4296'), P: 0.42 + R() * 0.25, tin: 0.3, tout: 0.3 });
        else if (ci < co && R() < 0.3) cv.stroke(pts, { ...T.oil, w: 1.2 + R() * 1.2, col: mixc(grad(LC, y - 60), hex('#fffdf0'), 0.4), P: 0.65 + R() * 0.25, tin: 0.3, tout: 0.3 });
      }
    }
  }
  // base haze: the bottom of the tower dissolves into the evening band
  for (let i = 0; i < 150; i++) {
    const x = 720 + R() * 1200, y = 588 + R() * 36, L = 80 + R() * 200;
    const c = mixc(skyCol(x + L / 2, y + 4), hex('#8a6fb4'), (0.42 + R() * 0.2) * (1 - sstep(592, 622, y) * 0.85));
    cv.stroke(wob(x, y, x + L, y + (R() - 0.5) * 4, R, 1, 0.01), { ...T.pastel, w: 7 + R() * 9, col: c, P: 0.6 + R() * 0.2, tin: 0.2, tout: 0.3 });
  }
  for (let k = 0; k < 4; k++) cv.smudge([[740, 598 + k * 7], [1200, 600 + k * 7], [1920, 598 + k * 7]], { r: 11, str: 0.18, pick: 0.3 });
  return puffs;
}

// low stratus bars and small evening cumulus
function drawLowClouds(cv, seed) {
  const R = rng32(seed);
  const bars = [[230, 548, 520, 13], [60, 585, 380, 9], [640, 570, 330, 8], [1780, 520, 240, 9], [1480, 566, 420, 7], [420, 500, 250, 7], [1840, 455, 180, 7], [15, 470, 220, 8]];
  for (const [bx, by, bl, bh] of bars) {
    const warm = sstep(300, 1500, bx + bl / 2);
    for (let i = 0; i < bl / 6; i++) {
      const x = bx + R() * bl, t = (x - bx) / bl, env = Math.sin(Math.PI * t) ** 0.6;
      const yy = by + (R() - 0.5) * bh * env * 1.6, L = 30 + R() * 90;
      const up = (yy - by) / (bh * 0.8); // -1 top .. 1 bottom
      let c = up > 0.15 ? mixc(hex('#ff8f7a'), hex('#ffc27a'), warm * 0.8 + R() * 0.2) : mixc(hex('#7b6fc0'), hex('#a57fc6'), R());
      if (up > 0.5 && R() < 0.5) c = mixc(hex('#ffd9a0'), hex('#ff9fa0'), 1 - warm);
      cv.stroke(wob(x - L / 2, yy, x + L / 2, yy + (R() - 0.5) * 2, R, 0.8, 0.01), { ...T.pastel, w: 3 + R() * 6 * env + 1, col: jit(c, 0.02, R), P: 0.7 + R() * 0.25, tin: 0.2, tout: 0.3 });
    }
    cv.smudge([[bx, by], [bx + bl / 2, by + 1], [bx + bl, by]], { r: 6, str: 0.1, pick: 0.3 });
  }
}
module.exports = { HZ, SUN, skyCol, drawSky, drawHighSky, drawCloud, drawLowClouds, LD };
