'use strict';
// Painterly gouache storybook park — "abandoned to alive".
// Scene is drawn with a tiny 3D projector into Canvas2D (with seeded brush strokes),
// then a WebGL pass adds the gouache look (Kuwahara paint flattening, wobble, edge pooling,
// paper grain) and the abandoned->alive grade driven by a noisy "arrival" wave map.
const W = 1080, H = 1080, FPS = 30;

// ---------------------------------------------------------------- utils
function RNG(seed) { let s = (seed >>> 0) || 1; return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const hx = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const toC = c => typeof c === 'string' ? hx(c) : c;
const lit = (c, k) => { c = toC(c); return k > 0 ? mixc(c, [255, 246, 222], k) : mixc(c, [52, 36, 82], -k); };
let FOG = 0; const HAZE = hx('#e2d3c2');
const C = (c, a = 1) => { c = toC(c); const m = mixc(c, HAZE, FOG); return `rgba(${m[0] | 0},${m[1] | 0},${m[2] | 0},${a})`; };
function hash2(x, y) { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
function fbm(x, y, o = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f + i * 17.3, y * f); n += a; f *= 2; a *= 0.5; } return s / n; }
const v3 = { sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; } };

// ---------------------------------------------------------------- camera
const CAM = { pos: [0, 50, 100], tgt: [0, 3, -2.5], f: 870 };
let CR, CU, CF;
(function () { const f = v3.norm(v3.sub(CAM.tgt, CAM.pos)); const r = v3.norm(v3.cross(f, [0, 1, 0])); CF = f; CR = r; CU = v3.cross(r, f); })();
function P(x, y, z) { const dx = x - CAM.pos[0], dy = y - CAM.pos[1], dz = z - CAM.pos[2]; const xc = dx * CR[0] + dy * CR[1] + dz * CR[2], yc = dx * CU[0] + dy * CU[1] + dz * CU[2], zc = dx * CF[0] + dy * CF[1] + dz * CF[2]; const s = CAM.f / zc; return [W / 2 + xc * s, H / 2 - yc * s, zc, s]; }
const Pv = p => P(p[0], p[1], p[2]);
const fogAt = zc => sstep(70, 230, zc) * 0.5;
const SUN = v3.norm([-0.55, 0.75, -0.35]); // from back-left, golden hour
const shadowOff = h => [h * 0.62, 0, h * 0.38];

// ---------------------------------------------------------------- wake (abandoned -> alive)
const AW = 270, ARR = new Float32Array(AW * AW);
const ORIG = [540, 990];
(function () {
  for (let j = 0; j < AW; j++) for (let i = 0; i < AW; i++) {
    const x = (i + 0.5) * W / AW, y = (j + 0.5) * H / AW;
    const d = Math.hypot(x - ORIG[0], (y - ORIG[1]) * 1.08) / 1250;
    const n = fbm(x / 230, y / 230, 4);
    ARR[j * AW + i] = d + (n - 0.5) * 0.32;
  }
})();
function arrAt(sx, sy) { const fx = clamp(sx / W * AW - 0.5, 0, AW - 1.001), fy = clamp(sy / H * AW - 0.5, 0, AW - 1.001); const i = fx | 0, j = fy | 0, u = fx - i, v = fy - j; const a = ARR[j * AW + i], b = ARR[j * AW + i + 1], c = ARR[(j + 1) * AW + i], d = ARR[(j + 1) * AW + i + 1]; return lerp(lerp(a, b, u), lerp(c, d, u), v); }
const T0 = 0.12, TW = 1.4;
const prog = t => (t - T0) / TW * 1.22 - 0.1;
const wakeAt = (sx, sy, t) => sstep(0, 0.1, prog(t) - arrAt(sx, sy));
const wakeTime = (sx, sy) => T0 + (arrAt(sx, sy) + 0.05 + 0.1) / 1.22 * TW;
function ramp(t, ta, r = 0.6) { const d = t - ta; if (d <= 0) return 0; if (d < r) return d * d / (2 * r); return d - r / 2; }

// ---------------------------------------------------------------- canvases
const scv = document.createElement('canvas'); scv.width = W; scv.height = H; const sc = scv.getContext('2d');
const fxv = document.createElement('canvas'); fxv.width = W; fxv.height = H; const fx = fxv.getContext('2d');

// ---------------------------------------------------------------- brush helpers
function pathPoly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
// opaque fill + seeded brush strokes clipped to shape + darker pigment edge
function paint(ctx, pts, col, seed, o = {}) {
  col = toC(col);
  pathPoly(ctx, pts); ctx.fillStyle = C(col, o.a ?? 1); ctx.fill();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const area = (x1 - x0) * (y1 - y0);
  const bw = o.bw ?? clamp(Math.sqrt(area) * 0.12, 1.2, 9);
  const n = o.n ?? Math.min(60, Math.floor(area / (bw * bw * 3)));
  if (n > 0 && area > 12) {
    ctx.save(); pathPoly(ctx, pts); ctx.clip();
    const r = RNG(seed); ctx.lineCap = 'round'; ctx.lineWidth = bw;
    const ang = o.ang ?? -0.35, len = o.len ?? bw * 3.2, vr = o.vr ?? 0.22;
    for (let k = 0; k < n; k++) {
      const x = lerp(x0, x1, r()), y = lerp(y0, y1, r()); const a = ang + (r() - 0.5) * 0.7; const l = len * (0.5 + r());
      const gx = (x - x0) / (x1 - x0 + 1e-3) + (y - y0) / (y1 - y0 + 1e-3); // 0 = upper-left (lit) .. 2 = lower-right
      const sh = (r() - 0.5) * 2 * vr + (1 - gx) * 0.12; ctx.strokeStyle = C(lit(col, sh), 0.5);
      ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); ctx.quadraticCurveTo(x, y + (r() - 0.5) * bw, x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); ctx.stroke();
    }
    if (o.hi !== false && area > 60) { // opaque gouache highlight strokes
      const nh = Math.min(5, 1 + (area / 1500) | 0); ctx.lineWidth = bw * 0.8;
      for (let k = 0; k < nh; k++) { const x = lerp(x0, x1, 0.1 + r() * 0.4), y = lerp(y0, y1, 0.08 + r() * 0.35); const a = ang + (r() - 0.5) * 0.5; const l = len * (0.6 + r() * 0.8); ctx.strokeStyle = C(lit(col, 0.42 + r() * 0.2), 0.8); ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); ctx.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); ctx.stroke(); }
    }
    ctx.restore();
  }
  if (o.edge !== false) { pathPoly(ctx, pts); ctx.strokeStyle = C(lit(col, -0.35), 0.55); ctx.lineWidth = o.ew ?? 1; ctx.stroke(); }
}
function blob(ctx, x, y, r, col, seed, o = {}) { // painterly round mass from overlapping dabs
  const R = RNG(seed); col = toC(col); const n = o.n ?? 7;
  for (let k = 0; k < n; k++) {
    const a = R() * 6.283, d = R() * r * 0.45; const rr = r * (0.45 + R() * 0.4);
    ctx.fillStyle = C(lit(col, (R() - 0.5) * 0.18), o.a ?? 1);
    ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, rr, rr * (0.8 + R() * 0.3), R() * 3, 0, 6.283); ctx.fill();
  }
}
function line(ctx, a, b, w, col, alpha = 1) { ctx.strokeStyle = C(col, alpha); ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
function circlePts(cx, cy, cz, r, n, y = 0) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * 6.2832; o.push(P(cx + Math.cos(a) * r, cy + y, cz + Math.sin(a) * r)); } return o; }
function ribbon(pl, w) { // world xz polyline -> ground polygon (screen)
  const L = [], R = [];
  for (let i = 0; i < pl.length; i++) {
    const a = pl[Math.max(0, i - 1)], b = pl[Math.min(pl.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz); dx /= l; dz /= l;
    L.push(P(pl[i][0] - dz * w / 2, 0, pl[i][1] + dx * w / 2)); R.push(P(pl[i][0] + dz * w / 2, 0, pl[i][1] - dx * w / 2));
  }
  return L.concat(R.reverse());
}
function smoothPath(pts, per = 8) { // catmull-rom open
  const o = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < per; k++) { const t = k / per, t2 = t * t, t3 = t2 * t; o.push(p1.map((_, d) => 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3))); }
  }
  o.push(pts[pts.length - 1]); return o;
}
function polyLen(pl) { const c = [0]; for (let i = 1; i < pl.length; i++) c.push(c[i - 1] + Math.hypot(...pl[i].map((v, d) => v - pl[i - 1][d]))); return c; }
function along(pl, cum, s) { s = Math.max(0, Math.min(cum[cum.length - 1] - 1e-6, s)); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; } const u = (s - cum[lo]) / (cum[hi] - cum[lo] || 1); return pl[lo].map((v, d) => v + (pl[hi][d] - v) * u); }

// ---------------------------------------------------------------- palette
const PAL = {
  coral: '#e0503d', red: '#c8342f', cream: '#f6ead0', teal: '#2f9c95', tealD: '#1f6f73', mustard: '#eab43c', blue: '#3c6fb6', navy: '#2d3f74', pink: '#ec8aa0', lilac: '#9d82c4', mint: '#8fd1b5', orange: '#ef8a3a', wood: '#9a6338', woodD: '#6b4127', path: '#e8cf9c', grass: '#79a83f', grassD: '#4f7f36', water: '#4ea3c4', rust: '#8a4a22', vine: '#3f6a2a',
};
const SHIRTS = ['#e0503d', '#2f9c95', '#eab43c', '#3c6fb6', '#ec8aa0', '#9d82c4', '#f6ead0', '#ef8a3a', '#8fd1b5', '#c8342f', '#ffffff', '#5b8a3c'];
const SKIN = ['#f1c9a5', '#d9a07a', '#a8714c', '#7a4e32', '#f5d6bc'];

// ---------------------------------------------------------------- SKY + FAR layers (pre-rendered)
const skyv = document.createElement('canvas'); skyv.width = 1240; skyv.height = 520; const skc = skyv.getContext('2d');
function buildSky() {
  const g = skc.createLinearGradient(0, 0, 0, 520);
  g.addColorStop(0, '#6fa6cf'); g.addColorStop(0.35, '#a9cbd8'); g.addColorStop(0.62, '#efd6b2'); g.addColorStop(0.85, '#f6c48f'); g.addColorStop(1, '#f2b585');
  skc.fillStyle = g; skc.fillRect(0, 0, 1240, 520);
  const R = RNG(11); skc.lineCap = 'round';
  for (let k = 0; k < 900; k++) { // broad wash strokes
    const y = R() * 520, x = R() * 1240; const yy = y / 520; const base = yy < 0.4 ? mixc(hx('#6fa6cf'), hx('#b4d1db'), yy / 0.4) : mixc(hx('#efd6b2'), hx('#f4bd8a'), (yy - 0.4) / 0.6);
    skc.strokeStyle = C(lit(base, (R() - 0.5) * 0.22), 0.25); skc.lineWidth = 6 + R() * 14; skc.beginPath(); skc.moveTo(x, y); skc.quadraticCurveTo(x + 40, y + (R() - 0.5) * 10, x + 60 + R() * 80, y + (R() - 0.5) * 8); skc.stroke();
  }
  const clouds = [[150, 120, 1.15], [480, 60, 0.8], [770, 135, 1.3], [1090, 80, 0.95], [330, 225, 0.7], [960, 250, 0.7], [640, 290, 0.5]];
  clouds.forEach(([cx, cy, sz], ci) => {
    const r = RNG(100 + ci); const puffs = [];
    for (let k = 0; k < 22; k++) { const u = r() * 2 - 1; const hgt = (1 - u * u) * 80 * sz; puffs.push([cx + u * 200 * sz, cy - r() * hgt, (22 + r() * 34) * sz * (0.6 + 0.6 * (1 - u * u))]); }
    puffs.sort((a, b) => b[1] - a[1]);
    // underside shadow, body, sunlit tops: each built from curved brush strokes
    const layer = (dx, dy, kr, col, al, seed) => { const R2 = RNG(seed); for (const [x, y, rr] of puffs) for (let k = 0; k < 9; k++) { const a0 = R2() * 6.283; const rad = rr * kr * (0.55 + R2() * 0.5); skc.strokeStyle = C(lit(col, (R2() - 0.5) * 0.12), al); skc.lineWidth = rr * 0.28; skc.beginPath(); skc.arc(x + dx * rr, y + dy * rr, rad, a0, a0 + 1.2 + R2() * 1.5); skc.stroke(); skc.fillStyle = C(col, al * 0.6); skc.beginPath(); skc.arc(x + dx * rr, y + dy * rr, rad * 0.7, 0, 6.283); skc.fill(); } };
    layer(0.12, 0.3, 1, hx('#b7a3c3'), 0.8, ci * 3 + 1);
    layer(0, 0, 0.86, hx('#f6e6d2'), 0.85, ci * 3 + 2);
    layer(-0.25, -0.3, 0.5, hx('#fff7e8'), 0.9, ci * 3 + 3);
    skc.fillStyle = 'rgba(183,160,190,0.5)'; skc.beginPath(); skc.ellipse(cx, cy + 6 * sz, 190 * sz, 12 * sz, 0, 0, 6.283); skc.fill();
  });
  for (let k = 0; k < 40; k++) { const x = R() * 1240, y = 300 + R() * 200; skc.strokeStyle = `rgba(255,236,210,${0.3 + R() * 0.3})`; skc.lineWidth = 2 + R() * 4; skc.beginPath(); skc.moveTo(x, y); skc.lineTo(x + 80 + R() * 120, y + (R() - 0.5) * 4); skc.stroke(); }
}
const farv = document.createElement('canvas'); farv.width = 1160; farv.height = 600; const fac = farv.getContext('2d');
let HORIZON = 0, YBACK = 0;
function buildFar() {
  HORIZON = P(0, 0, -5000)[1]; YBACK = P(0, 0, -64)[1];
  const ox = 40; // canvas is wider than frame for parallax
  const ridge = (base, amp, fr, seed, col, hz) => {
    const pts = [[0, 600]]; for (let x = 0; x <= 1160; x += 8) pts.push([x, base - amp * fbm(x / fr, seed, 4) * 1.6]); pts.push([1160, 600]);
    paint(fac, pts, mixc(toC(col), hx('#e9d6c3'), hz), seed * 7 | 0, { n: 260, bw: 7, len: 30, ang: 0.05, vr: 0.12, edge: false });
  };
  ridge(HORIZON + 6, 60, 160, 3, '#8fa0c2', 0.55);
  ridge(HORIZON + 22, 48, 120, 5, '#7b9b8e', 0.42);
  ridge(HORIZON + 44, 36, 90, 8, '#86a65c', 0.3);
  // soft patchwork fields (broad washes)
  const R = RNG(21); const HZ = hx('#e9d6c3');
  for (let row = 0; row < 7; row++) {
    const y = HORIZON + 46 + row * row * 5 + row * 8; const h = 8 + row * 6;
    for (let x = -60; x < 1220;) {
      const w = 90 + R() * 160 + row * 30; const c = ['#a9b45e', '#cdbb6a', '#8fae55', '#b7b062', '#d6b066', '#9cb35c'][R() * 6 | 0];
      const hz = clamp(0.5 - row * 0.06);
      paint(fac, [[x, y], [x + w, y + (R() - 0.5) * 4], [x + w + 10, y + h], [x - 6, y + h + 3]], mixc(hx(c), HZ, hz), row * 100 + x | 0, { n: 14, bw: 4 + row, len: 40, ang: 0.04, edge: false, hi: false });
      x += w;
    }
  }
  // winding river with glints
  const riv = []; for (let i = 0; i <= 40; i++) { const u = i / 40; riv.push([lerp(-20, 700, u), HORIZON + 52 + u * u * 120 + Math.sin(u * 9) * 10]); }
  fac.lineCap = 'round'; fac.strokeStyle = C(mixc(hx('#8fbad0'), HZ, 0.35)); for (let i = 1; i < riv.length; i++) { fac.lineWidth = 3 + i * 0.35; fac.beginPath(); fac.moveTo(riv[i - 1][0], riv[i - 1][1]); fac.lineTo(riv[i][0], riv[i][1]); fac.stroke(); }
  for (let i = 0; i < 30; i++) { const q = riv[(R() * 40) | 0]; fac.fillStyle = 'rgba(255,245,220,0.7)'; fac.fillRect(q[0] - 4, q[1] - 0.6, 8, 1.2); }
  // woodland clumps, irregular, growing toward the park
  for (let k = 0; k < 520; k++) {
    const u = Math.pow(R(), 0.7); const y = lerp(HORIZON + 40, YBACK + 30, u); const x = R() * 1180 - 10;
    if (fbm(x / 140, y / 50, 3) < 0.5 - u * 0.25) continue;
    const r = 4 + u * 16 + R() * 5; const hz = clamp(0.62 - u * 0.5);
    const base = mixc(hx(['#3d6b45', '#4f7d43', '#5f8a45', '#365f48'][R() * 4 | 0]), HZ, hz);
    blob(fac, x, y, r, base, k * 7, { n: 4 }); blob(fac, x - r * 0.3, y - r * 0.3, r * 0.45, lit(base, 0.25), k * 7 + 1, { n: 2 });
  }
  // distant hazy village
  for (let k = 0; k < 14; k++) { const x = 760 + k * 14 + R() * 6, y = HORIZON + 42 - R() * 4; const c = mixc(hx(['#e6d2b7', '#d9b49a', '#c9a48a'][k % 3]), hx('#e9d6c3'), 0.4); fac.fillStyle = C(c); fac.fillRect(x, y - 9, 11, 9); fac.fillStyle = C(mixc(hx('#b0644e'), hx('#e9d6c3'), 0.45)); fac.beginPath(); fac.moveTo(x - 1, y - 9); fac.lineTo(x + 5.5, y - 15); fac.lineTo(x + 12, y - 9); fac.fill(); }
  fac.fillStyle = C(mixc(hx('#e0cdb4'), hx('#e9d6c3'), 0.4)); fac.fillRect(845, HORIZON + 6, 6, 30); fac.beginPath(); fac.moveTo(843, HORIZON + 6); fac.lineTo(848, HORIZON - 10); fac.lineTo(853, HORIZON + 6); fac.fill();
  // haze wash over the far land
  const g = fac.createLinearGradient(0, HORIZON - 40, 0, YBACK + 40); g.addColorStop(0, 'rgba(240,220,200,0.35)'); g.addColorStop(0.6, 'rgba(240,220,200,0.08)'); g.addColorStop(1, 'rgba(240,220,200,0.0)');
  fac.fillStyle = g; fac.fillRect(0, 0, 1160, 600);
}

// ---------------------------------------------------------------- park layout
const PATHS = [
  { pl: [[0, 74], [0, 46], [0, 30]], w: 9 },
  { pl: [[-6, 18], [-16, 21], [-24, 18], [-34, 10], [-40, -2]], w: 6 },
  { pl: [[-6, 10], [-18, 0], [-30, -14], [-42, -24], [-48, -28]], w: 6 },
  { pl: [[0, 6], [2, 3], [4, 1.5]], w: 6 },
  { pl: [[7, 16], [18, 15], [30, 16], [38, 22]], w: 6 },
  { pl: [[8, 8], [18, -2], [30, -16], [42, -30], [50, -38]], w: 5.5 },
  { pl: [[-4, 44], [-14, 40], [-22, 34]], w: 5.5 },
  { pl: [[4, 44], [14, 40], [21, 36]], w: 5.5 },
  { pl: [[-40, -2], [-44, 12], [-36, 26], [-28, 32]], w: 5 },
  { pl: [[38, 22], [34, 32], [26, 38]], w: 5 },
].map(p => { const pl = smoothPath(p.pl, 6); return { ...p, pl, cum: polyLen(pl) }; });
const PLAZA = { x: 0, z: 18, r: 13 };
const FLUME = (() => {
  const key = [[40, 0.6, 36], [52, 0.6, 34], [57, 0.6, 22], [57, 2.5, 8], [56, 9, -8], [53, 11, -17], [46, 11, -21], [41.5, 10.6, -15], [41, 9.6, -9], [40.5, 0.6, 7], [40, 0.6, 15], [37.5, 0.6, 26], [40, 0.6, 36]];
  const pl = smoothPath(key.map(p => [p[0] - 3, p[1], p[2]]), 10); return { pl, cum: polyLen(pl) };
})();
const COASTER = (() => {
  const key = [[-8, 2.5, -8], [4, 2.5, -8], [14, 2.5, -8], [22, 3, -11], [27, 5.5, -17], [28, 13, -25], [28, 24, -34], [27.4, 31, -41], [24, 32.5, -46.5], [18, 30, -49], [12, 16, -48], [6.5, 2.4, -44.2]];
  const R = 12.5, x0 = 0, z0 = -42.5, NL = 30, loop = [];
  for (let i = 0; i <= NL; i++) { const th = i / NL * 2 * Math.PI; loop.push([x0 - R * Math.sin(th) - 7 * i / NL, 1.6 + R * (1 - Math.cos(th)), z0 + 3.4 * i / NL]); }
  const tail = [[-15, 2.4, -38.5], [-21, 7, -35], [-25, 15, -28], [-24.5, 10, -20], [-20, 4.5, -13], [-14, 3, -9]];
  const SX = 1.08, SY = 1.32, tx = x => 6 + (x - 6) * SX;
  const ctrl = [...key, ...loop, ...tail].map(p => [tx(p[0]), p[1] * SY, p[2] + 5]); const n = ctrl.length;
  // centripetal catmull-rom, closed
  const dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
    const tj = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 0.5) || 1e-3;
    const t0 = 0, t1 = t0 + tj(p0, p1), t2 = t1 + tj(p1, p2), t3 = t2 + tj(p2, p3);
    for (let k = 0; k < 24; k++) {
      const t = lerp(t1, t2, k / 24);
      const A1 = p0.map((v, d) => (t1 - t) / (t1 - t0) * v + (t - t0) / (t1 - t0) * p1[d]);
      const A2 = p1.map((v, d) => (t2 - t) / (t2 - t1) * v + (t - t1) / (t2 - t1) * p2[d]);
      const A3 = p2.map((v, d) => (t3 - t) / (t3 - t2) * v + (t - t2) / (t3 - t2) * p3[d]);
      const B1 = A1.map((v, d) => (t2 - t) / (t2 - t0) * v + (t - t0) / (t2 - t0) * A2[d]);
      const B2 = A2.map((v, d) => (t3 - t) / (t3 - t1) * v + (t - t1) / (t3 - t1) * A3[d]);
      dense.push(B1.map((v, d) => (t2 - t) / (t2 - t1) * v + (t - t1) / (t2 - t1) * B2[d]));
    }
  }
  dense.push(dense[0]);
  const cum = polyLen(dense), L = cum[cum.length - 1], ds = 0.5, N = Math.floor(L / ds);
  const S = []; for (let i = 0; i < N; i++) S.push(along(dense, cum, i * L / N));
  const T = [], B = [], Nn = [];
  for (let i = 0; i < N; i++) T.push(v3.norm(v3.sub(S[(i + 1) % N], S[(i - 1 + N) % N])));
  let b = v3.norm(v3.cross(T[0], [0, 1, 0]));
  for (let i = 0; i < N; i++) { b = v3.norm(v3.sub(b, v3.mul(T[i], v3.dot(b, T[i])))); B.push(b); Nn.push(v3.cross(b, T[i])); }
  const inLoop = S.map(p => p[0] > tx(x0 - R - 8) && p[0] < tx(x0 + R + 1) && p[2] > z0 + 5 - 1.2 && p[2] < z0 + 5 + 4.6 && p[1] > 3.2 * SY);
  return { S, T, B, N: Nn, L, Nseg: N, ds: L / N, inLoop, loopC: [tx(x0 - 3.5), (1.6 + R) * SY, z0 + 6.7], R: R * SX };
})();
const sIndex = s => { const n = COASTER.Nseg; let f = s / COASTER.ds; f = ((f % n) + n) % n; return f; };
function trackAt(s) { const f = sIndex(s), i = f | 0, j = (i + 1) % COASTER.Nseg, u = f - i; const L = (A) => A[i].map((v, d) => v + (A[j][d] - v) * u); return { p: L(COASTER.S), T: v3.norm(L(COASTER.T)), B: v3.norm(L(COASTER.B)), N: v3.norm(L(COASTER.N)) }; }
// train dynamics (precomputed)
const TRAIN = { cars: 6, gap: 4.0 };
const TRAIN_S = [];
(function () {
  let top = 0, ti = 0; COASTER.S.forEach((p, i) => { if (p[1] > top) { top = p[1]; ti = i; } });
  const s0 = ti * COASTER.ds + 13; // head already tipped over the crest
  const crest = P(...COASTER.S[ti]); const tStart = wakeTime(crest[0], crest[1]) - 0.12;
  const avgY = s => { let y = 0; for (let c = 0; c < TRAIN.cars; c++) y += trackAt(s - c * TRAIN.gap).p[1]; return y / TRAIN.cars; };
  const yRef = avgY(s0) + 1.2, g = 120; let s = s0, v = 0; const dt = 1 / 600;
  for (let k = 0; k <= 3 * 600 + 10; k++) {
    const t = k * dt; if (k % 20 === 0) TRAIN_S.push(s);
    if (t > tStart) { const u = Math.min(1, (t - tStart) / 0.25); v = Math.sqrt(Math.max(4, 2 * g * (yRef - avgY(s)))) * (0.35 + 0.65 * u); s += v * dt; }
  }
  TRAIN.tStart = tStart;
})();

// trees
const TREES = [];
(function () {
  const R = RNG(5);
  const add = (x, z, sz, type) => TREES.push({ x, z, sz, type, seed: (R() * 1e6) | 0, ph: R() * 6 });
  for (let x = -96; x <= 96; x += 5 + R() * 4) add(x + R() * 2, -60 - R() * 8, 5 + R() * 3, R() < 0.25 ? 'poplar' : 'round');
  const zones = [[-60, -40, 30, 66, 22], [40, 62, 40, 68, 14], [-70, -54, -50, 30, 16], [60, 74, -50, 10, 10], [-18, -10, -24, -12, 3], [6, 12, 24, 30, 0], [-12, -4, 24, 30, 0], [-34, -24, 44, 56, 6], [24, 34, 46, 58, 5], [-58, -40, -14, -2, 4], [16, 22, -30, -22, 2], [-6, 4, -50, -46, 2], [30, 36, -48, -40, 3], [-34, -26, -52, -44, 3], [60, 70, 20, 40, 5]];
  for (const [xa, xb, za, zb, n] of zones) for (let k = 0; k < n; k++) { const r = R(); const zz = lerp(za, zb, R()); add(lerp(xa, xb, R()), zz, 3.4 + R() * 3, r < 0.18 && zz > 0 ? 'blossom' : r < 0.32 ? 'poplar' : r < 0.42 ? 'pine' : 'round'); }
})();
// stalls & tents
const STALLS = [];
(function () {
  const cols = [PAL.coral, PAL.teal, PAL.mustard, PAL.blue, PAL.pink, PAL.lilac];
  let k = 0;
  for (const z of [36, 42, 48, 54]) { STALLS.push({ x: -8.6, z, side: 1, c: cols[k++ % 6], kind: 'stall' }); STALLS.push({ x: 8.6, z: z + 2, side: -1, c: cols[k++ % 6], kind: 'stall' }); }
  STALLS.push({ x: -14, z: 8, c: PAL.red, kind: 'tent', r: 3.4 }); STALLS.push({ x: 15, z: 24, c: PAL.blue, kind: 'tent', r: 3.0 });
  STALLS.push({ x: -32, z: 46, c: PAL.mustard, kind: 'tent', r: 3.6 }); STALLS.push({ x: 30, z: 48, c: PAL.red, kind: 'tent', r: 4.2 });
  STALLS.push({ x: 12, z: 4, c: PAL.teal, kind: 'stall', side: -1 }); STALLS.push({ x: -12, z: 26, c: PAL.orange, kind: 'stall', side: 1 });
  STALLS.push({ x: -40, z: 22, c: PAL.pink, kind: 'tent', r: 2.6 }); STALLS.push({ x: 26, z: 22, c: PAL.lilac, kind: 'stall', side: 1 });
  STALLS.push({ x: 8, z: -18, c: PAL.mustard, kind: 'tent', r: 2.8 });
})();
const BLANKETS = [[-34, 54, 0.3], [-22, 60, -0.2], [26, 56, 0.4], [36, 52, -0.1], [-44, 30, 0.2], [48, 44, 0.3], [-14, 64, 0.1], [16, 64, -0.3]].map(([x, z, r], i) => ({ x, z, r, c: [PAL.red, PAL.blue, PAL.mustard, PAL.teal][i % 4], i }));
function drawBlanket(b, t, wk) {
  const vis = sstep(0.4, 0.7, wk); if (vis <= 0) return; const c = P(b.x, 0, b.z); FOG = fogAt(c[2]); const s = c[3];
  const ca = Math.cos(b.r), sa = Math.sin(b.r); const Q = (u, v) => P(b.x + u * ca - v * sa, 0.05, b.z + u * sa + v * ca);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const u0 = -2 + i, v0 = -1.5 + j; pathPoly(sc, [Q(u0, v0), Q(u0 + 1, v0), Q(u0 + 1, v0 + 1), Q(u0, v0 + 1)]); sc.fillStyle = C((i + j) % 2 ? b.c : PAL.cream, vis); sc.fill(); }
  const bk = Q(1.2, -0.6); sc.fillStyle = C('#b07a40', vis); sc.fillRect(bk[0] - s * 0.5, bk[1] - s * 0.5, s, s * 0.6);
  for (let k = 0; k < 3; k++) { const p = Q(-1.4 + k * 1.1, 0.4 - (k % 2) * 0.9); const bob = Math.sin(t * 3 + k + b.i) * s * 0.05; sc.fillStyle = C(SHIRTS[(b.i * 3 + k) % 12], vis); sc.beginPath(); sc.ellipse(p[0], p[1] - s * 0.5 + bob, s * 0.32, s * 0.42, 0, 0, 6.283); sc.fill(); sc.fillStyle = C(SKIN[(b.i + k) % 5], vis); sc.beginPath(); sc.arc(p[0], p[1] - s * 1.05 + bob, s * 0.21, 0, 6.283); sc.fill(); }
}
const UMBRELLAS = [[-17, 46], [-20, 50], [-15, 52], [17, 50], [20, 46], [-30, 16], [-28, 22], [16, 6], [-6, 4], [44, 40]].map(([x, z], i) => ({ x, z, c: [PAL.coral, PAL.teal, PAL.mustard, PAL.pink, PAL.blue][i % 5] }));
// guests
const GUESTS = [];
(function () {
  const R = RNG(77);
  const counts = [100, 26, 30, 10, 30, 22, 20, 20, 14, 12];
  PATHS.forEach((p, pi) => { for (let k = 0; k < counts[pi]; k++) GUESTS.push({ kind: 'path', pi, u: R(), dir: R() < 0.5 ? 1 : -1, sp: 0.9 + R() * 0.7, off: (R() - 0.5) * (p.w - 1.2), shirt: SHIRTS[R() * SHIRTS.length | 0], pants: ['#3b4a6b', '#5a4636', '#2f3b45', '#7a6a58', '#f6ead0'][R() * 5 | 0], skin: SKIN[R() * 5 | 0], ph: R() * 6, thr: 0.25 + R() * 0.6, child: R() < 0.2, balloon: R() < 0.1 ? SHIRTS[R() * 10 | 0] : null }); });
  for (let k = 0; k < 85; k++) { const r = 2.5 + Math.sqrt(R()) * 10; GUESTS.push({ kind: 'plaza', r, a: R() * 6.28, w: (R() - 0.5) * 0.22, shirt: SHIRTS[R() * SHIRTS.length | 0], pants: ['#3b4a6b', '#5a4636', '#2f3b45'][R() * 3 | 0], skin: SKIN[R() * 5 | 0], ph: R() * 6, thr: 0.25 + R() * 0.6, child: R() < 0.2, balloon: R() < 0.12 ? SHIRTS[R() * 10 | 0] : null }); }
  // queues
  const queues = [[[2, 2.5], [7, 1.2]], [[-18, 22], [-14, 24]], [[17, 32], [14, 35]], [[-30, 4], [-26, 8]], [[24, 6], [20, 10]], [[44, 28], [40, 31]], [[46, -36], [42, -32]], [[-40, -22], [-36, -18]]];
  for (const [a, b] of queues) for (let k = 0; k < 7; k++) { const u = k / 7; GUESTS.push({ kind: 'still', x: lerp(a[0], b[0], u) + (R() - 0.5) * 0.6, z: lerp(a[1], b[1], u) + (R() - 0.5) * 0.6, shirt: SHIRTS[R() * SHIRTS.length | 0], pants: '#3b4a6b', skin: SKIN[R() * 5 | 0], ph: R() * 6, thr: 0.25 + R() * 0.6, child: R() < 0.2 }); }
})();
const WEEDS = [];
(function () { const R = RNG(31); for (let k = 0; k < 150; k++) { const p = PATHS[R() * PATHS.length | 0]; const q = along(p.pl, p.cum, R() * p.cum[p.cum.length - 1]); WEEDS.push({ x: q[0] + (R() - 0.5) * p.w, z: q[1] + (R() - 0.5) * 2, h: 0.8 + R() * 1.4, seed: k }); } for (let k = 0; k < 40; k++) { const a = R() * 6.28, r = R() * PLAZA.r; WEEDS.push({ x: PLAZA.x + Math.cos(a) * r, z: PLAZA.z + Math.sin(a) * r, h: 0.8 + R() * 1.2, seed: 900 + k }); } })();

const IVY = [];
function buildIvy() {
  const R = RNG(4242); const add = (x, z, r, h = 1) => IVY.push({ x, z, r, h, seed: IVY.length * 13 + 1 });
  for (let i = 0; i < COASTER.Nseg; i += 16) { const p = COASTER.S[i]; if (p[1] > 2) add(p[0] + (R() - 0.5) * 2, p[2] + (R() - 0.5) * 2, 2 + R() * 1.5, 1.4); }
  const { c, yaw } = WHEEL; const E1 = [Math.cos(yaw), 0, -Math.sin(yaw)], A = [Math.sin(yaw), 0, Math.cos(yaw)];
  for (const e of [-1, 1]) for (const sd of [-1, 1]) add(c[0] + E1[0] * e * 9 + A[0] * sd * 4, c[2] + E1[2] * e * 9 + A[2] * sd * 4, 3.4, 1.6);
  add(-8, 64.5, 2.8, 2); add(8, 64.5, 2.6, 1.8); add(-11, 63, 2, 1); add(11.5, 63, 2.2, 1);
  STALLS.forEach(st => add(st.x + (R() - 0.5) * 2, st.z + 1.5, 2 + R(), 1.2));
  for (let k = 0; k < 5; k++) { const a = k * 1.3 + 0.5; add(CAROUSEL.x + Math.cos(a) * 7.5, CAROUSEL.z + Math.sin(a) * 7.5, 2.2, 1.3); }
  add(TOWER.x, TOWER.z + 3, 3, 1.5); add(SHIP.x - 8, SHIP.z + 3, 2.6, 1.4); add(SHIP.x + 8, SHIP.z + 3, 2.4, 1.2); add(SWING.x, SWING.z + 2, 2.6, 1.3);
  for (let k = 0; k < 8; k++) { const a = R() * 6.28, r = 5 + R() * 7; add(PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r, 1.6 + R(), 1); }
  for (let k = 0; k < 36; k++) { const p = PATHS[R() * PATHS.length | 0]; const q = along(p.pl, p.cum, R() * p.cum[p.cum.length - 1]); add(q[0] + (R() - 0.5) * p.w, q[1], 1.2 + R() * 1.4, 1); }
}
function drawIvy(v, g) {
  const b = P(v.x, 0, v.z); FOG = fogAt(b[2]); const s = b[3]; const r = v.r * s * g; if (r < 0.8) return;
  const R = RNG(v.seed); const cols = ['#3d5c30', '#557a3a', '#6b8a45', '#4a6a36', '#7a8a4a'];
  for (let k = 0; k < 22; k++) { const a = R() * 6.283, d = Math.sqrt(R()); const px = b[0] + Math.cos(a) * d * r, py = b[1] - r * v.h * 0.6 + Math.sin(a) * d * r * v.h * 0.6; sc.fillStyle = C(cols[R() * 5 | 0]); sc.beginPath(); sc.ellipse(px, py, s * 0.5 * (0.6 + R()) * Math.sqrt(g) + 0.6, s * 0.32 * (0.6 + R()) * Math.sqrt(g) + 0.4, R() * 3, 0, 6.283); sc.fill(); }
  for (let k = 0; k < 4; k++) { const px = b[0] + (R() - 0.5) * r * 1.6; line(sc, [px, b[1]], [px + (R() - 0.5) * s, b[1] - r * v.h * (1 + R())], Math.max(1, s * 0.15), '#5a6a32'); }
}
// ---------------------------------------------------------------- GROUND layer (pre-rendered)
const grv = document.createElement('canvas'); grv.width = W; grv.height = H; const grc = grv.getContext('2d');
function buildGround() {
  const R = RNG(3);
  // grass base: perspective bands
  const top = YBACK - 6;
  const g = grc.createLinearGradient(0, top, 0, H); g.addColorStop(0, '#93ad62'); g.addColorStop(0.3, '#82ad48'); g.addColorStop(1, '#6d9c3c');
  grc.fillStyle = g; grc.beginPath(); grc.moveTo(0, top + 10); for (let x = 0; x <= W; x += 20) grc.lineTo(x, top + 8 * fbm(x / 60, 3)); grc.lineTo(W, H); grc.lineTo(0, H); grc.fill();
  grc.lineCap = 'round';
  const gcol = (x, y) => { const n = fbm(x / 260, y / 140, 4); const lt = hx('#b4c45e'), md = hx('#78a844'), dk = hx('#3f7a3e'); return n > 0.5 ? mixc(md, lt, sstep(0.5, 0.72, n)) : mixc(dk, md, sstep(0.28, 0.5, n)); };
  for (let k = 0; k < 2600; k++) { // broad washes
    const y = lerp(top, H, Math.pow(R(), 0.9)), x = R() * W; const d = (y - top) / (H - top);
    grc.fillStyle = C(mixc(gcol(x, y), HAZE, (1 - d) * 0.3), 0.35); grc.beginPath(); grc.ellipse(x, y, 14 + d * 50, 5 + d * 16, (R() - 0.5) * 0.3, 0, 6.283); grc.fill();
  }
  for (let k = 0; k < 14000; k++) { // grass strokes, sized by depth
    const y = lerp(top + 4, H, Math.pow(R(), 0.85)), x = R() * W; const d = (y - top) / (H - top); const bw = 1.4 + d * 5.5;
    const base = mixc(lit(gcol(x, y), (R() - 0.5) * 0.35), HAZE, (1 - d) * 0.3);
    const a = (R() - 0.5) * 0.5 - 0.1; const l = bw * (2.5 + R() * 3);
    grc.strokeStyle = C(base, 0.5); grc.lineWidth = bw; grc.beginPath(); grc.moveTo(x, y); grc.quadraticCurveTo(x + l * 0.5, y - bw * 0.4, x + Math.cos(a) * l, y + Math.sin(a) * l); grc.stroke();
  }
  for (let k = 0; k < 900; k++) { // opaque sunlit flecks
    const y = lerp(top + 10, H, R()), x = R() * W; const d = (y - top) / (H - top); if (fbm(x / 260, y / 140, 4) < 0.48) continue;
    grc.strokeStyle = C('#e3e08a', 0.55); grc.lineWidth = 1 + d * 2.5; grc.beginPath(); grc.moveTo(x, y); grc.lineTo(x + 4 + d * 10, y - 1); grc.stroke();
  }
  // paths
  const pathCol = hx(PAL.path);
  const drawPathPoly = (pts, seed) => paint(grc, pts, pathCol, seed, { n: 120, bw: 3, len: 12, ang: 0.02, vr: 0.12, ew: 1.6 });
  // plaza
  drawPathPoly(circlePts(PLAZA.x, 0, PLAZA.z, PLAZA.r, 48).map(p => [p[0], p[1]]), 901);
  PATHS.forEach((p, i) => drawPathPoly(ribbon(p.pl, p.w).map(q => [q[0], q[1]]), 500 + i));
  // plaza pattern ring + cobble dabs
  const ring = circlePts(PLAZA.x, 0, PLAZA.z, PLAZA.r * 0.62, 40); grc.strokeStyle = 'rgba(190,150,100,0.45)'; grc.lineWidth = 3; pathPoly(grc, ring); grc.stroke();
  const ring2 = circlePts(PLAZA.x, 0, PLAZA.z, PLAZA.r * 0.9, 48); grc.strokeStyle = 'rgba(205,120,90,0.35)'; grc.lineWidth = 5; pathPoly(grc, ring2); grc.stroke();
  PATHS.forEach(p => { for (let k = 0; k < 60; k++) { const q = along(p.pl, p.cum, R() * p.cum[p.cum.length - 1]); const s = P(q[0] + (R() - 0.5) * p.w * 0.8, 0, q[1]); grc.fillStyle = `rgba(${R() < 0.5 ? '255,244,214' : '196,160,110'},0.4)`; grc.beginPath(); grc.ellipse(s[0], s[1], s[3] * 0.5, s[3] * 0.2, 0, 0, 6.283); grc.fill(); } });
  // flower beds & hedges
  const beds = [[-12, 66, 3.5], [12, 66, 3.5], [-6, 30, 2.5], [6, 30, 2.5], [0, 18, 0], [-46, 38, 4], [46, 30, 0], [-18, 58, 3], [18, 58, 3]];
  beds.forEach(([x, z, r], i) => { if (!r) return; const pts = circlePts(x, 0, z, r, 24).map(p => [p[0], p[1]]); paint(grc, pts, '#4d7d33', 700 + i, { n: 20 }); for (let k = 0; k < 40; k++) { const a = R() * 6.28, rr = Math.sqrt(R()) * r * 0.9; const s = P(x + Math.cos(a) * rr, 0.3, z + Math.sin(a) * rr); grc.fillStyle = ['#f4d35e', '#ee6c8a', '#ffffff', '#f08a4b', '#b28be0'][R() * 5 | 0]; grc.beginPath(); grc.ellipse(s[0], s[1], Math.max(1, s[3] * 0.22), Math.max(0.8, s[3] * 0.14), R() * 3, 0, 6.283); grc.fill(); } });
  // flume water channel on ground
  const gw = FLUME.pl.filter(p => p[1] < 1.2);
  const segs = []; let cur = []; FLUME.pl.forEach(p => { if (p[1] < 1.2) cur.push([p[0], p[2]]); else if (cur.length) { segs.push(cur); cur = []; } }); if (cur.length) segs.push(cur);
  segs.forEach((sg, i) => { if (sg.length < 2) return; paint(grc, ribbon(sg, 5.2).map(q => [q[0], q[1]]), '#8a6a48', 950 + i, { n: 10 }); paint(grc, ribbon(sg, 3.8).map(q => [q[0], q[1]]), PAL.water, 960 + i, { n: 40, ang: 0.1, vr: 0.2 }); });
  // splash pool + fountain basin + pond
  paint(grc, circlePts(37.4, 0, 9, 4.6, 30).map(p => [p[0], p[1]]), PAL.water, 971, { n: 30 });
  paint(grc, circlePts(-48, 0, 6, 7, 30).map(p => [p[0], p[1] + 0]), '#5aa9c2', 972, { n: 40 });
  for (let k = 0; k < 7; k++) { const a = R() * 6.28, r = R() * 5; const s = P(-48 + Math.cos(a) * r, 0, 6 + Math.sin(a) * r); blob(grc, s[0], s[1], s[3] * 0.7, '#5f9a48', 1000 + k, { n: 3 }); }
  // park boundary hedge + fence at back
  for (let x = -100; x < 100; x += 1.4) { const s = P(x, 0.6, -58); blob(grc, s[0], s[1], s[3] * 1.4, mixc(hx('#3f6d36'), HAZE, 0.3), 1200 + x * 10 | 0, { n: 3 }); }
  // soft blend of back edge into the far layer
  const eg = grc.createLinearGradient(0, top - 8, 0, top + 40); eg.addColorStop(0, 'rgba(0,0,0,1)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
  grc.globalCompositeOperation = 'destination-out'; grc.fillStyle = eg; grc.fillRect(0, top - 8, W, 48); grc.globalCompositeOperation = 'source-over';
}

// ---------------------------------------------------------------- drawables
let D = []; // {z, f}
const push = (z, f) => D.push({ z, f });

function shadowEllipse(x, z, rx, rz, a = 0.3) { const c = P(x, 0, z), e = P(x + rx, 0, z), f = P(x, 0, z + rz); sc.fillStyle = `rgba(60,40,100,${a})`; sc.beginPath(); sc.ellipse(c[0], c[1], Math.abs(e[0] - c[0]), Math.abs(f[1] - c[1]) + 0.5, 0, 0, 6.283); sc.fill(); }

function drawTree(tr, t, wk) {
  const { x, z, sz, type, seed, ph } = tr; const b = P(x, 0, z); const s = b[3]; FOG = fogAt(b[2]);
  const sway = Math.sin(t * 1.6 + ph) * 0.12 * sz * s * 0.08 * (0.4 + wk);
  if (type === 'poplar' || type === 'pine') {
    const h = sz * 2.2;
    line(sc, b, P(x, h * 0.3, z), s * 0.35, PAL.woodD);
    const tip = P(x, h, z);
    const col = type === 'pine' ? hx('#2f5a3a') : hx('#4b7b38');
    const pts = type === 'pine' ? [[b[0] - s * sz * 0.55, b[1] - s * 0.8], [tip[0] + sway, tip[1]], [b[0] + s * sz * 0.55, b[1] - s * 0.8]] : (() => { const o = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI; o.push([b[0] + Math.cos(a) * s * sz * 0.45 + sway * Math.sin(a), lerp(b[1] - s * 0.8, tip[1], Math.sin(a / 2) ** 0.8) ]); } return o; })();
    paint(sc, pts, col, seed, { ang: -1.4, bw: Math.max(1.4, s * 0.5), vr: 0.25 });
    return;
  }
  line(sc, b, P(x, sz * 0.7, z), s * 0.45, PAL.woodD);
  const c = P(x, sz * 1.15, z); const r = s * sz * 0.62;
  const base = type === 'blossom' ? hx('#e98fa8') : hx(['#4f8a3a', '#5e963d', '#3f7a3a'][seed % 3]);
  blob(sc, c[0] + sway, c[1] + r * 0.15, r, lit(base, -0.3), seed, { n: 6 });
  blob(sc, c[0] + sway - r * 0.1, c[1] - r * 0.05, r * 0.8, base, seed + 1, { n: 6 });
  blob(sc, c[0] + sway - r * 0.32, c[1] - r * 0.32, r * 0.42, lit(base, type === 'blossom' ? 0.45 : 0.32), seed + 2, { n: 4 });
}
function treeShadow(tr) { const { x, z, sz } = tr; const o = shadowOff(sz * 1.2); shadowEllipse(x + o[0] * 0.7, z + o[2] * 0.7, sz * 1.1, sz * 0.6, 0.3); }

function drawStall(st, t, wk) {
  const b = P(st.x, 0, st.z); FOG = fogAt(b[2]); const s = b[3];
  if (st.kind === 'tent') {
    const r = st.r, h = r * 1.5; const ap = P(st.x, h * 1.45, st.z);
    const ring = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; ring.push([st.x + Math.cos(a) * r, h * 0.55, st.z + Math.sin(a) * r, a]); }
    // walls
    const wall = []; for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI; wall.push(P(st.x + Math.cos(a) * r, 0, st.z + Math.sin(a) * r)); } for (let i = 8; i >= 0; i--) { const a = i / 8 * Math.PI; wall.push(P(st.x + Math.cos(a) * r, h * 0.55, st.z + Math.sin(a) * r)); }
    paint(sc, wall, PAL.cream, st.x * 13 | 0, { n: 12 });
    for (let i = 0; i < 8; i += 2) { const a0 = i / 8 * Math.PI, a1 = (i + 1) / 8 * Math.PI; paint(sc, [P(st.x + Math.cos(a0) * r, 0, st.z + Math.sin(a0) * r), P(st.x + Math.cos(a1) * r, 0, st.z + Math.sin(a1) * r), P(st.x + Math.cos(a1) * r, h * 0.55, st.z + Math.sin(a1) * r), P(st.x + Math.cos(a0) * r, h * 0.55, st.z + Math.sin(a0) * r)], st.c, i + st.z * 7 | 0, { n: 4 }); }
    // door
    const d0 = P(st.x - r * 0.3, 0, st.z + r * 0.96), d1 = P(st.x + r * 0.3, 0, st.z + r * 0.96), d2 = P(st.x, h * 0.45, st.z + r);
    pathPoly(sc, [d0, d2, d1]); sc.fillStyle = C('#3b2433', 0.8); sc.fill();
    // roof cone segments
    const segs = ring.map((p, i) => { const q = ring[(i + 1) % 16]; return { z: P((p[0] + q[0]) / 2, p[1], (p[2] + q[2]) / 2)[2], i, p, q }; }).sort((a, b) => b.z - a.z);
    for (const sg of segs) { const lt = Math.cos(sg.p[3] + 0.8) * 0.18; paint(sc, [P(sg.p[0], sg.p[1], sg.p[2]), P(sg.q[0], sg.q[1], sg.q[2]), ap], lit(sg.i % 2 ? st.c : PAL.cream, lt), sg.i * 31 + st.x | 0, { n: 3, ang: -1.2 }); }
    // scallops
    for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * 6.283; if (Math.sin(a) < -0.2) continue; const p = P(st.x + Math.cos(a) * r * 1.02, h * 0.55, st.z + Math.sin(a) * r * 1.02); sc.fillStyle = C(i % 2 ? st.c : PAL.cream); sc.beginPath(); sc.arc(p[0], p[1], s * 0.5, 0, Math.PI); sc.fill(); }
    // pennant
    const fl = Math.sin(t * 7 + st.x) * 0.3; line(sc, ap, [ap[0], ap[1] - s * 1.6], 1.2, '#5b4a3a');
    pathPoly(sc, [[ap[0], ap[1] - s * 1.6], [ap[0] + s * (1.3 + fl * 0.3), ap[1] - s * (1.3 + fl)], [ap[0], ap[1] - s * 1.0]]); sc.fillStyle = C(PAL.mustard); sc.fill();
    return;
  }
  // booth with striped awning; side=+1 faces +x
  const w = 4.4, d = 2.8, h = 2.1, x = st.x, z = st.z;
  const box = (x0, x1, z0, z1, y0, y1, col, seed) => {
    const fr = [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)]; paint(sc, fr, col, seed, { n: 6 });
    const sd = st.side > 0 ? [P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1)] : [P(x0, y0, z1), P(x0, y0, z0), P(x0, y1, z0), P(x0, y1, z1)];
    paint(sc, sd, lit(col, st.side > 0 ? 0.12 : -0.18), seed + 1, { n: 6 });
    paint(sc, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], lit(col, 0.2), seed + 2, { n: 4 });
  };
  box(x - d / 2, x + d / 2, z - w / 2, z + w / 2, 0, h, mixc(hx(st.c), hx(PAL.cream), 0.45), x * 7 + z | 0);
  // counter opening on the side facing the path
  const sx = st.side > 0 ? x + d / 2 : x - d / 2;
  pathPoly(sc, [P(sx, 1.1, z - w * 0.38), P(sx, 1.1, z + w * 0.38), P(sx, 2.0, z + w * 0.38), P(sx, 2.0, z - w * 0.38)]); sc.fillStyle = C('#4a2c34', 0.85); sc.fill();
  for (let i = 0; i < 4; i++) { const p = P(sx, 1.25, z - w * 0.3 + i * w * 0.2); sc.fillStyle = C(['#f4d35e', '#ee6c8a', '#ffffff', '#f08a4b'][i]); sc.beginPath(); sc.arc(p[0], p[1], s * 0.22, 0, 6.283); sc.fill(); }
  // awning: stripes sloping out toward the path
  const ax0 = sx, ax1 = sx + st.side * 1.4;
  for (let i = 0; i < 6; i++) { const z0 = z - w / 2 + i * w / 6, z1 = z0 + w / 6; paint(sc, [P(ax0, h + 0.1, z0), P(ax0, h + 0.1, z1), P(ax1, h - 0.6, z1), P(ax1, h - 0.6, z0)], lit(i % 2 ? st.c : PAL.cream, 0.08), i + x * 3 | 0, { n: 2 }); const m = P(ax1, h - 0.6, (z0 + z1) / 2); sc.fillStyle = C(i % 2 ? st.c : PAL.cream); sc.beginPath(); sc.arc(m[0], m[1], s * w / 12, 0, Math.PI); sc.fill(); }
  // roof sign shape (blank decorative)
  const sg = P(x, h + 1.6, z); line(sc, P(x, h, z), sg, Math.max(1, s * 0.12), '#5b4a3a'); const fl = Math.sin(t * 7 + z) * s * 0.25; pathPoly(sc, [sg, [sg[0] + s * 1.2, sg[1] + s * 0.3 + fl], [sg[0], sg[1] + s * 0.7]]); sc.fillStyle = C(st.c); sc.fill();
  if (wk > 0.7) fxBulb(sg[0], sg[1] - s * 0.6, s * 0.18, (wk - 0.7) / 0.3, '#ffe9a8');
}
function drawUmbrella(u, t) { const b = P(u.x, 0, u.z); FOG = fogAt(b[2]); const s = b[3]; const top = P(u.x, 2.6, u.z); line(sc, b, top, Math.max(1, s * 0.12), '#5b4a3a'); const tb = P(u.x, 0.8, u.z); sc.fillStyle = C(PAL.cream); sc.beginPath(); sc.ellipse(tb[0], tb[1], s * 0.9, s * 0.35, 0, 0, 6.283); sc.fill(); const pts = []; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; pts.push(P(u.x + Math.cos(a) * 1.8, 2.2, u.z + Math.sin(a) * 1.8)); } for (let i = 0; i < 10; i++) { pathPoly(sc, [pts[i], pts[(i + 1) % 10], P(u.x, 2.9, u.z)]); sc.fillStyle = C(lit(i % 2 ? u.c : PAL.cream, Math.cos(i / 10 * 6.283 + 0.8) * 0.15)); sc.fill(); } }

// fx helpers (lights, sparkles) — composited after the paint filter
function fxBulb(x, y, r, on, col = '#ffe7a0') { if (on <= 0) return; r = Math.max(1.1, r); const g = fx.createRadialGradient(x, y, 0, x, y, r * 5); const c = hx(col); g.addColorStop(0, `rgba(${c},${0.55 * on})`); g.addColorStop(1, `rgba(${c},0)`); fx.fillStyle = g; fx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10); fx.fillStyle = `rgba(255,252,236,${on})`; fx.beginPath(); fx.arc(x, y, r, 0, 6.283); fx.fill(); }
const bulbOn = (wk, seed, t) => clamp((wk - 0.55 - (seed % 7) * 0.035) * 6) * (0.9 + 0.1 * Math.sin(t * 9 + seed));

function drawVine(pts, grow, seed, s) { // pts: screen polyline of the structure; grow 0..1
  if (grow <= 0.02) return; const R = RNG(seed); const n = Math.max(2, Math.floor(pts.length * grow));
  sc.strokeStyle = C(PAL.vine, 0.9); sc.lineWidth = Math.max(1, s * 0.22); sc.lineCap = 'round'; sc.beginPath();
  for (let i = 0; i < n; i++) { const p = pts[i]; const wv = Math.sin(i * 1.7 + seed) * s * 0.5; if (i === 0) sc.moveTo(p[0] + wv, p[1]); else sc.lineTo(p[0] + wv, p[1]); }
  sc.stroke();
  for (let i = 0; i < n; i++) { const p = pts[i]; for (let k = 0; k < 2; k++) { sc.fillStyle = C(lit('#4f7f32', (R() - 0.5) * 0.4), 0.95); sc.beginPath(); sc.ellipse(p[0] + (R() - 0.5) * s * 1.6, p[1] + (R() - 0.5) * s * 1.2, s * 0.45, s * 0.25, R() * 3, 0, 6.283); sc.fill(); } }
}
function vineAlong(a, b, grow, seed, s) { const pts = []; for (let i = 0; i <= 14; i++) pts.push([lerp(a[0], b[0], i / 14), lerp(a[1], b[1], i / 14)]); drawVine(pts, grow, seed, s); }

// ---------------------------------------------------------------- rides
function drawCoasterSeg(i, t) {
  const { S, B, N, inLoop } = COASTER; const j = (i + 1) % COASTER.Nseg;
  const a = S[i], b = S[j]; const pa = Pv(a), pb = Pv(b); FOG = fogAt(pa[2]);
  const s = pa[3]; const sw = wakeAt(pa[0], pa[1], t);
  const ra1 = Pv(v3.add(a, v3.mul(B[i], 0.75))), rb1 = Pv(v3.add(b, v3.mul(B[j], 0.75)));
  const ra2 = Pv(v3.add(a, v3.mul(B[i], -0.75))), rb2 = Pv(v3.add(b, v3.mul(B[j], -0.75)));
  const sp1 = Pv(v3.add(a, v3.mul(N[i], -0.55))), sp2 = Pv(v3.add(b, v3.mul(N[j], -0.55)));
  const rs = 1 - sw; const RC = c => mixc(toC(c), hx('#7b4a2e'), rs * 0.85);
  line(sc, sp1, sp2, s * 1.5, RC('#7e2328'));
  line(sc, [sp1[0] - s * 0.15, sp1[1] - s * 0.2], [sp2[0] - s * 0.15, sp2[1] - s * 0.2], s * 0.35, RC('#b8463e'), 0.9);
  if (i % 2 === 0) line(sc, ra1, ra2, s * 0.32, '#4d3036');
  line(sc, ra2, rb2, s * 0.7, RC(PAL.red)); line(sc, ra1, rb1, s * 0.7, RC(PAL.coral));
  const hl = N[i][1] > 0 ? 0.6 : 0.2; line(sc, ra1, rb1, s * 0.18, lit(RC(PAL.coral), hl), 0.85);
  // rust (fades away with the wake)
  if (sw < 1 && (i * 7919 % 5) < 3) { const r = RNG(i); sc.fillStyle = C(['#6a2f14', '#9b5a2a', '#4e2a1a'][i % 3], 0.9 * (1 - sw)); for (let k = 0; k < 4; k++) { const u = r(); sc.beginPath(); sc.ellipse(lerp(ra1[0], rb2[0], u), lerp(ra1[1], rb2[1], r()), s * (0.35 + r() * 0.5), s * 0.3, r() * 3, 0, 6.283); sc.fill(); } }
}
function coasterSupports(i) { const { S, N, inLoop } = COASTER; const p = S[i]; return p[1] > 1.4 && N[i][1] > 0.5 && !inLoop[i]; }
function drawSupport(i, t) {
  const { S, B, N } = COASTER; const p = S[i]; const top = v3.add(p, v3.mul(N[i], -0.8)); const pt = Pv(top); FOG = fogAt(pt[2]); const s = pt[3];
  const sw = wakeAt(pt[0], pt[1] + (p[1] * s) * 0.5, t);
  const tall = p[1] > 10;
  const legs = tall ? [[v3.add(top, v3.mul(B[i], 0.5)), [p[0] + B[i][0] * 2.6, 0, p[2] + B[i][2] * 2.6]], [v3.add(top, v3.mul(B[i], -0.5)), [p[0] - B[i][0] * 2.6, 0, p[2] - B[i][2] * 2.6]]] : [[top, [p[0], 0, p[2]]]];
  for (const [a, b] of legs) { const A = Pv(a), Bb = Pv(b); line(sc, A, Bb, s * 0.75, mixc(hx('#a8977c'), hx('#6b5a48'), 1 - sw)); line(sc, [A[0] - s * 0.12, A[1]], [Bb[0] - s * 0.12, Bb[1]], s * 0.22, mixc(hx(PAL.cream), hx('#8a7a68'), 1 - sw), 0.95); }
  if (tall) { for (let h = 4; h < p[1] - 2; h += 7) { const f = h / p[1]; const l0 = legs[0], l1 = legs[1]; const q0 = Pv(l0[1].map((v, d) => lerp(v, l0[0][d], f))), q1 = Pv(l1[1].map((v, d) => lerp(v, l1[0][d], f + 0.12))); line(sc, q0, q1, s * 0.15, '#cbb89a'); } }
  if (sw < 1) { const base = Pv([p[0], 0, p[2]]); vineAlong(base, pt, (1 - sw) * (0.55 + 0.4 * ((i * 37) % 10) / 10), i, s); }
}
function drawLoopLegs(t) {
  const c = COASTER.loopC, R = COASTER.R;
  for (const sgn of [-1, 1]) { const top = [c[0] + sgn * R * 0.98, c[1] - 1, c[2]]; const a = Pv(top), b = Pv([top[0] + sgn * 2, 0, top[2]]); FOG = fogAt(a[2]); line(sc, a, b, a[3] * 0.45, '#bfae92'); line(sc, a, b, a[3] * 0.2, PAL.cream, 0.9); }
}
function drawCar(sHead, c, t, wk, riders) {
  const tr = trackAt(sHead - c * TRAIN.gap); const { p, T, B, N } = tr;
  const base = v3.add(p, v3.mul(N, 0.35)); const pc = Pv(base); FOG = fogAt(pc[2]); const s = pc[3];
  const hl = c === 0 ? 2.2 : 1.8, hw = 1.3, hh = 1.25;
  const corner = (a, b, h) => Pv(v3.add(v3.add(v3.add(base, v3.mul(T, a * hl)), v3.mul(B, b * hw)), v3.mul(N, h * hh)));
  const faces = [
    { n: B, pts: [corner(-1, 1, 0), corner(1, 1, 0), corner(1, 1, 1), corner(-1, 1, 1)], k: 0.1 },
    { n: v3.mul(B, -1), pts: [corner(-1, -1, 0), corner(1, -1, 0), corner(1, -1, 1), corner(-1, -1, 1)], k: -0.15 },
    { n: T, pts: [corner(1, -1, 0), corner(1, 1, 0), corner(1, 1, 1), corner(1, -1, 1)], k: 0 },
    { n: v3.mul(T, -1), pts: [corner(-1, -1, 0), corner(-1, 1, 0), corner(-1, 1, 1), corner(-1, -1, 1)], k: -0.1 },
    { n: N, pts: [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)], k: 0.25, top: true },
    { n: v3.mul(N, -1), pts: [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0)], k: -0.3 },
  ];
  const col = mixc(hx(['#f4c232', '#35b3a8', '#f4c232', '#4f86d6', '#f4c232', '#35b3a8'][c]), hx('#6b5a48'), (1 - wk) * 0.7);
  for (const f of faces) {
    const fc = v3.add(base, v3.mul(f.n, 1)); if (v3.dot(f.n, v3.sub(CAM.pos, fc)) <= 0) continue;
    if (f.top) { paint(sc, f.pts, '#3a2a3a', c, { n: 0 }); continue; }
    const lt = f.k + v3.dot(f.n, SUN) * 0.25; paint(sc, f.pts, lit(col, lt), c * 10 + 3, { n: 3, bw: Math.max(1, s * 0.35) });
  }
  // stripe
  const st = [corner(-1, 1, 0.55), corner(1, 1, 0.55)]; if (v3.dot(B, v3.sub(CAM.pos, base)) > 0) line(sc, st[0], st[1], Math.max(1, s * 0.22), PAL.cream, 0.9);
  if (riders > 0) for (const sb of [-0.45, 0.45]) for (const sa of [-0.4, 0.5]) {
    const hp = v3.add(v3.add(v3.add(base, v3.mul(T, sa * hl)), v3.mul(B, sb * hw)), v3.mul(N, hh + 0.55)); const q = Pv(hp);
    const arm = Pv(v3.add(hp, v3.mul(N, 1.1 + 0.2 * Math.sin(t * 12 + c + sb)))); line(sc, q, arm, Math.max(1, s * 0.16), SKIN[(c + (sb > 0)) % 5], riders);
    sc.fillStyle = C(SKIN[(c * 2 + (sa > 0) + (sb > 0)) % 5], riders); sc.beginPath(); sc.arc(q[0], q[1], Math.max(1.8, s * 0.4), 0, 6.283); sc.fill();
    sc.fillStyle = C(['#3a2618', '#e8c36a', '#6b3a1f', '#222'][(c + (sa > 0) * 2) % 4], riders); sc.beginPath(); sc.arc(q[0], q[1] - s * 0.12, Math.max(1, s * 0.25), Math.PI, 0); sc.fill();
  }
  if (c === 0) { const nose = Pv(v3.add(v3.add(base, v3.mul(T, hl * 1.1)), v3.mul(N, 0.4))); sc.fillStyle = C(PAL.red); sc.beginPath(); sc.arc(nose[0], nose[1], Math.max(1.5, s * 0.5), 0, 6.283); sc.fill(); }
  if (wk < 1) { const r = RNG(c * 3 + 1); sc.fillStyle = C('#7a3a1b', 0.8 * (1 - wk)); for (let k = 0; k < 4; k++) { sc.beginPath(); sc.arc(lerp(pc[0] - s * 1.2, pc[0] + s * 1.2, r()), pc[1] - s * r() * 0.8, s * (0.3 + r() * 0.3), 0, 6.283); sc.fill(); } }
}
function coasterStation(t, wk) {
  // platform + striped roof over track at x -9..15, z -8
  const x0 = -7, x1 = 7, z0 = -6.5, z1 = 0, h = 5.2; const c = P((x0 + x1) / 2, 0, -3); FOG = fogAt(c[2]); const s = c[3];
  paint(sc, [P(x0, 0, z0 - 2), P(x1, 0, z0 - 2), P(x1, 2, z0 - 2), P(x0, 2, z0 - 2)], '#d9c3a0', 41, { n: 12 });
  paint(sc, [P(x0, 2, z0 - 2), P(x1, 2, z0 - 2), P(x1, 2, z0 + 0.5), P(x0, 2, z0 + 0.5)], '#efe0c2', 42, { n: 10 });
  for (const x of [x0, (x0 + x1) / 2, x1]) for (const z of [z0 - 1.5, z1]) line(sc, P(x, 0, z), P(x, h, z), s * 0.4, PAL.cream);
  return () => { // roof drawn later (after track)
    const n = 9; for (let i = 0; i < n; i++) { const a = lerp(x0 - 1, x1 + 1, i / n), b = lerp(x0 - 1, x1 + 1, (i + 1) / n); paint(sc, [P(a, h, z0 - 2.5), P(b, h, z0 - 2.5), P(b, h + 1.8, (z0 + z1) / 2), P(a, h + 1.8, (z0 + z1) / 2)], i % 2 ? PAL.coral : PAL.cream, 50 + i, { n: 3 }); paint(sc, [P(a, h + 1.8, (z0 + z1) / 2), P(b, h + 1.8, (z0 + z1) / 2), P(b, h, z1 + 1), P(a, h, z1 + 1)], lit(i % 2 ? PAL.coral : PAL.cream, 0.15), 60 + i, { n: 3 }); const m = P((a + b) / 2, h, z1 + 1); sc.fillStyle = C(i % 2 ? PAL.coral : PAL.cream); sc.beginPath(); sc.arc(m[0], m[1], s * 1.2, 0, Math.PI); sc.fill(); if (wk > 0.5) fxBulb(m[0], m[1] + s * 1.3, s * 0.18, bulbOn(wk, i, t)); }
  };
}

const WHEEL = { c: [-50, 21, -36], R: 17, yaw: 0.42 };
function drawWheel(t, wk, rideT, front) {
  const { c, R, yaw } = WHEEL; const E1 = [Math.cos(yaw), 0, -Math.sin(yaw)], A = [Math.sin(yaw), 0, Math.cos(yaw)];
  const pc = Pv(c); FOG = fogAt(pc[2]); const s = pc[3];
  const legs = (side) => { const hub = v3.add(c, v3.mul(A, side * 2.2)); for (const e of [-1, 1]) { const g = v3.add([c[0], 0, c[2]], v3.add(v3.mul(E1, e * 9), v3.mul(A, side * 4))); const a = Pv(hub), b = Pv(g); line(sc, a, b, s * 0.9, '#d8c7a8'); line(sc, [a[0] - s * 0.2, a[1]], [b[0] - s * 0.2, b[1]], s * 0.35, '#f4ead6'); if (wk < 1) vineAlong(b, a, (1 - wk) * 0.85, 300 + e * 7 + side * 3, s); } };
  if (!front) { legs(-1); return; }
  const rot = rideT * 0.28;
  const rim = (off, n = 64) => { const o = []; for (let i = 0; i <= n; i++) { const a = i / n * 6.2832 + rot; o.push(Pv(v3.add(v3.add(c, v3.mul(A, off)), v3.add(v3.mul(E1, Math.cos(a) * R), [0, Math.sin(a) * R, 0])))); } return o; };
  const back = rim(-1.1), frontR = rim(1.1);
  sc.lineCap = 'round';
  const stroke = (pts, w, col, al = 1) => { sc.strokeStyle = C(col, al); sc.lineWidth = w; sc.beginPath(); pts.forEach((p, i) => i ? sc.lineTo(p[0], p[1]) : sc.moveTo(p[0], p[1])); sc.stroke(); };
  stroke(back, s * 0.55, '#c9b7d6');
  const hubB = Pv(v3.add(c, v3.mul(A, -1.1))), hubF = Pv(v3.add(c, v3.mul(A, 1.1)));
  for (let i = 0; i < 32; i++) { const q = back[i * 2]; line(sc, hubB, q, s * 0.16, '#d6c6e0', 0.9); }
  // gondolas hang below rim points
  const NG = 16;
  for (let g = 0; g < NG; g++) {
    const a = g / NG * 6.2832 + rot; const rp = v3.add(c, v3.add(v3.mul(E1, Math.cos(a) * R), [0, Math.sin(a) * R, 0]));
    const sway = Math.sin(t * 2 + g) * 0.08 * Math.min(1, rideT);
    const hang = Pv(rp), body = Pv(v3.add(rp, [sway * 3, -2.1, 0])); const gs = s * 1.25;
    line(sc, hang, [body[0], body[1] - gs * 0.6], Math.max(1, s * 0.15), '#7a6a6a');
    const col = [PAL.coral, PAL.teal, PAL.mustard, PAL.blue, PAL.pink, PAL.lilac, PAL.mint, PAL.orange][g % 8];
    // cabin: roof + body (rounded) + window band
    sc.fillStyle = C(lit(col, -0.1)); sc.beginPath(); sc.ellipse(body[0], body[1] - gs * 0.55, gs * 0.95, gs * 0.38, 0, Math.PI, 0); sc.fill();
    paint(sc, [[body[0] - gs * 0.85, body[1] - gs * 0.55], [body[0] + gs * 0.85, body[1] - gs * 0.55], [body[0] + gs * 0.75, body[1] + gs * 0.65], [body[0] - gs * 0.75, body[1] + gs * 0.65]], col, g * 3 + 7, { n: 4, bw: Math.max(1, gs * 0.3) });
    sc.fillStyle = C('#f6ead0', 0.95); sc.fillRect(body[0] - gs * 0.65, body[1] - gs * 0.35, gs * 1.3, gs * 0.42);
    if (wk > 0.6) { sc.fillStyle = C(SKIN[g % 5]); sc.beginPath(); sc.arc(body[0] - gs * 0.25, body[1] - gs * 0.12, gs * 0.18, 0, 6.283); sc.arc(body[0] + gs * 0.3, body[1] - gs * 0.12, gs * 0.16, 0, 6.283); sc.fill(); }
  }
  for (let i = 0; i < 32; i++) { const q = frontR[i * 2]; line(sc, hubF, q, s * 0.18, '#efe6f2'); }
  stroke(frontR, s * 0.75, '#f3ecf6'); stroke(frontR, s * 0.28, PAL.pink, 0.8);
  // inner decorative ring
  const inner = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * 6.2832 - rot * 1; inner.push(Pv(v3.add(v3.add(c, v3.mul(A, 1.2)), v3.add(v3.mul(E1, Math.cos(a) * R * 0.45), [0, Math.sin(a) * R * 0.45, 0])))); }
  stroke(inner, s * 0.3, PAL.mustard);
  sc.fillStyle = C(PAL.coral); sc.beginPath(); sc.arc(hubF[0], hubF[1], s * 1.4, 0, 6.283); sc.fill(); sc.fillStyle = C(PAL.mustard); sc.beginPath(); sc.arc(hubF[0], hubF[1], s * 0.7, 0, 6.283); sc.fill();
  if (wk < 1) { // rust + vines on rim
    const r = RNG(9); for (let k = 0; k < 26; k++) { const q = frontR[(r() * 64) | 0]; sc.fillStyle = C('#7a3a1b', 0.8 * (1 - wk)); sc.beginPath(); sc.ellipse(q[0], q[1], s * (0.4 + r() * 0.5), s * 0.35, r() * 3, 0, 6.283); sc.fill(); }
    const lower = frontR.slice(40, 64).concat(frontR.slice(0, 8)); drawVine(lower, (1 - wk), 77, s);
    const lower2 = frontR.slice(20, 44).reverse(); drawVine(lower2, (1 - wk) * 0.8, 78, s);
  }
  legs(1);
  if (wk > 0.5) for (let i = 0; i < 32; i++) { const q = frontR[i * 2]; fxBulb(q[0], q[1], s * 0.2, bulbOn(wk, i, t), i % 2 ? '#ffd9a0' : '#fff0c0'); }
}

const CAROUSEL = { x: -23, z: 28, r: 7.5 };
function drawCarousel(t, wk, rideT) {
  const { x, z, r } = CAROUSEL; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3];
  const rot = rideT * 0.9;
  // base skirt
  const sk = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; sk.push(P(x + Math.cos(a) * r, 0, z + Math.sin(a) * r)); } for (let i = 24; i >= 0; i--) { const a = i / 24 * Math.PI; sk.push(P(x + Math.cos(a) * r, 1.0, z + Math.sin(a) * r)); }
  paint(sc, sk, PAL.teal, 401, { n: 14 });
  paint(sc, circlePts(x, 1.0, z, r, 40), '#e9d2a8', 402, { n: 20 });
  // horses + poles
  const items = []; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.2832 + rot; const rr = i % 2 ? r * 0.82 : r * 0.6; const hx_ = x + Math.cos(a) * rr, hz = z + Math.sin(a) * rr; items.push({ a, hx: hx_, hz, i, zc: P(hx_, 2, hz)[2] }); }
  const col = P(x, 0, z)[2];
  const drawItem = it => {
    const bob = 2.0 + 0.45 * Math.sin(rideT * 4 + it.i * 1.3);
    const p0 = P(it.hx, 1, it.hz), p1 = P(it.hx, 6, it.hz); line(sc, p0, p1, Math.max(1, s * 0.18), '#e8c36a');
    const hb = P(it.hx, bob, it.hz); const dir = [-Math.sin(it.a), Math.cos(it.a)]; const hd = P(it.hx + dir[0] * 0.9, bob + 0.6, it.hz + dir[1] * 0.9); const tl = P(it.hx - dir[0] * 0.9, bob + 0.2, it.hz - dir[1] * 0.9);
    const hc = [PAL.cream, '#f3e0c4', '#ffffff', '#e8d0b8'][it.i % 4];
    line(sc, tl, hd, s * 0.75, hc); sc.fillStyle = C(hc); sc.beginPath(); sc.arc(hd[0], hd[1], s * 0.42, 0, 6.283); sc.fill();
    sc.fillStyle = C([PAL.coral, PAL.blue, PAL.mustard, PAL.lilac][it.i % 4]); sc.beginPath(); sc.arc(hb[0], hb[1] - s * 0.2, s * 0.35, 0, 6.283); sc.fill();
    if (wk > 0.6 && it.i % 3 !== 1) { sc.fillStyle = C(SKIN[it.i % 5]); sc.beginPath(); sc.arc(hb[0], hb[1] - s * 1.1, s * 0.3, 0, 6.283); sc.fill(); line(sc, [hb[0], hb[1] - s * 0.9], [hb[0], hb[1] - s * 0.3], s * 0.45, SHIRTS[it.i % 12]); }
  };
  items.filter(it => it.zc > col).sort((a, b) => b.zc - a.zc).forEach(drawItem);
  // central column
  paint(sc, [P(x - 1.6, 1, z), P(x + 1.6, 1, z), P(x + 1.6, 6, z), P(x - 1.6, 6, z)], PAL.mustard, 404, { n: 6 });
  for (let k = 0; k < 4; k++) { const q = P(x - 1.2 + k * 0.8, 3.5, z + 1.6); sc.fillStyle = C('#bfe3ea', 0.9); sc.fillRect(q[0] - s * 0.25, q[1] - s * 1.2, s * 0.5, s * 2.2); }
  items.filter(it => it.zc <= col).sort((a, b) => b.zc - a.zc).forEach(drawItem);
  // canopy
  const h0 = 6.2, h1 = 9.6, rr = r * 1.08, n = 18; const ap = P(x, h1, z);
  const segs = []; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832 + rot, a1 = (i + 1) / n * 6.2832 + rot; segs.push({ i, a0, a1, zc: P(x + Math.cos((a0 + a1) / 2) * rr, h0, z + Math.sin((a0 + a1) / 2) * rr)[2] }); }
  segs.sort((a, b) => b.zc - a.zc).forEach(sg => { const lt = Math.cos((sg.a0 + sg.a1) / 2 - 2.4) * 0.2; paint(sc, [P(x + Math.cos(sg.a0) * rr, h0, z + Math.sin(sg.a0) * rr), P(x + Math.cos(sg.a1) * rr, h0, z + Math.sin(sg.a1) * rr), ap], lit(sg.i % 2 ? PAL.red : PAL.cream, lt), 410 + sg.i, { n: 3, ang: -1.3 }); });
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 6.2832 + rot; if (Math.sin(a) < -0.3) continue; const p = P(x + Math.cos(a) * rr, h0, z + Math.sin(a) * rr); sc.fillStyle = C(i % 2 ? PAL.mustard : PAL.teal); sc.beginPath(); sc.arc(p[0], p[1], s * 1.25, 0, Math.PI); sc.fill(); if (wk > 0.5) fxBulb(p[0], p[1] + s * 1.0, s * 0.2, bulbOn(wk, i, t)); }
  line(sc, ap, [ap[0], ap[1] - s * 2], s * 0.2, '#6b5a40'); const fl = Math.sin(t * 8) * s * 0.3; pathPoly(sc, [[ap[0], ap[1] - s * 2], [ap[0] + s * 1.8, ap[1] - s * 1.6 + fl], [ap[0], ap[1] - s * 1.2]]); sc.fillStyle = C(PAL.coral); sc.fill();
  sc.fillStyle = C(PAL.mustard); sc.beginPath(); sc.arc(ap[0], ap[1], s * 0.6, 0, 6.283); sc.fill();
  if (wk < 1) { for (let k = 0; k < 4; k++) { const a = k * 1.6 + 0.4; const b0 = P(x + Math.cos(a) * r, 0, z + Math.sin(a) * r), b1 = P(x + Math.cos(a) * rr, h0, z + Math.sin(a) * rr); vineAlong(b0, b1, (1 - wk) * 0.8, 500 + k, s); } }
}

const TEACUPS = { x: 22, z: 31, r: 6.5 };
function drawTeacups(t, wk, rideT) {
  const { x, z, r } = TEACUPS; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3];
  paint(sc, circlePts(x, 0.3, z, r, 40), '#bfe0d6', 601, { n: 16 }); paint(sc, circlePts(x, 0.32, z, r * 0.55, 30), '#f3d9e2', 602, { n: 10 });
  const cups = []; for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + rideT * 0.7; cups.push({ i, x: x + Math.cos(a) * r * 0.66, z: z + Math.sin(a) * r * 0.66 }); }
  cups.push({ i: 6, x, z, center: true });
  cups.sort((a, b) => P(b.x, 0, b.z)[2] - P(a.x, 0, a.z)[2]).forEach(cp => {
    const cr = cp.center ? 1.6 : 1.5; const b = P(cp.x, 0.3, cp.z), tp = P(cp.x, 1.7, cp.z); const ex = cr * s, ey = cr * s * 0.42;
    const col = cp.center ? PAL.cream : [PAL.pink, PAL.mint, PAL.lilac, PAL.mustard, PAL.coral, PAL.blue][cp.i];
    if (cp.center) { paint(sc, [[b[0] - ex, b[1]], [b[0] + ex, b[1]], [tp[0] + ex * 0.7, tp[1] - s * 1.4], [tp[0], tp[1] - s * 2.6], [tp[0] - ex * 0.7, tp[1] - s * 1.4]], PAL.cream, 610, { n: 6 }); return; }
    sc.fillStyle = C(lit(col, -0.15)); sc.beginPath(); sc.moveTo(tp[0] - ex, tp[1]); sc.quadraticCurveTo(b[0] - ex * 0.9, b[1] + ey, b[0], b[1] + ey * 0.6); sc.quadraticCurveTo(b[0] + ex * 0.9, b[1] + ey, tp[0] + ex, tp[1]); sc.fill();
    sc.fillStyle = C(lit(col, 0.2)); sc.beginPath(); sc.ellipse(tp[0], tp[1], ex, ey, 0, 0, 6.283); sc.fill();
    sc.fillStyle = C(lit(col, -0.35)); sc.beginPath(); sc.ellipse(tp[0], tp[1] + ey * 0.15, ex * 0.8, ey * 0.7, 0, 0, 6.283); sc.fill();
    const sp = rideT * 3 + cp.i; const hd = [tp[0] + Math.cos(sp) * ex * 1.1, tp[1] + Math.sin(sp) * ey * 1.1];
    sc.strokeStyle = C(col); sc.lineWidth = s * 0.3; sc.beginPath(); sc.arc(hd[0], hd[1], s * 0.4, 0, 6.283); sc.stroke();
    if (wk > 0.6) for (let k = 0; k < 2; k++) { const aa = sp + k * 3; sc.fillStyle = C(SKIN[(cp.i + k) % 5]); sc.beginPath(); sc.arc(tp[0] + Math.cos(aa) * ex * 0.4, tp[1] + Math.sin(aa) * ey * 0.4 - s * 0.4, s * 0.32, 0, 6.283); sc.fill(); }
  });
}

const SWING = { x: 27, z: 12, h: 15 };
function drawSwing(t, wk, rideT, speed) {
  const { x, z, h } = SWING; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3];
  paint(sc, circlePts(x, 0.2, z, 3, 24), '#d8c3a0', 701, { n: 6 });
  paint(sc, [P(x - 0.8, 0, z), P(x + 0.8, 0, z), P(x + 0.6, h, z), P(x - 0.6, h, z)], PAL.navy, 702, { n: 6 });
  const rot = rideT * 1.6; const ang = speed * 0.95; const L = 6.5; const tilt = Math.sin(rideT * 0.8) * 0.12 * speed;
  const top = (a, rr, y) => [x + Math.cos(a) * rr, h + y + Math.cos(a - 0.6) * tilt * rr, z + Math.sin(a) * rr];
  const chairs = []; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832 + rot; const at = top(a, 4.6, -0.6); const out = Math.sin(ang) * L, dn = Math.cos(ang) * L; const ch = [at[0] + Math.cos(a) * out, at[1] - dn, at[2] + Math.sin(a) * out]; chairs.push({ i, at, ch, zc: Pv(ch)[2] }); }
  const drawCh = c => { const a = Pv(c.at), b = Pv(c.ch); line(sc, a, b, Math.max(0.8, s * 0.08), '#5d5560', 0.9); sc.fillStyle = C([PAL.coral, PAL.mustard, PAL.teal, PAL.pink][c.i % 4]); sc.fillRect(b[0] - s * 0.45, b[1] - s * 0.1, s * 0.9, s * 0.45); if (wk > 0.6) { sc.fillStyle = C(SHIRTS[c.i % 12]); sc.fillRect(b[0] - s * 0.25, b[1] - s * 0.8, s * 0.5, s * 0.7); sc.fillStyle = C(SKIN[c.i % 5]); sc.beginPath(); sc.arc(b[0], b[1] - s * 1.0, s * 0.3, 0, 6.283); sc.fill(); line(sc, [b[0], b[1] + s * 0.2], [b[0] + s * 0.2, b[1] + s * 0.9], Math.max(1, s * 0.2), '#3b4a6b'); } };
  chairs.filter(c => c.zc > pc[2]).sort((a, b) => b.zc - a.zc).forEach(drawCh);
  // canopy
  const n = 16, ap = Pv(top(0, 0, 3.2)); const segs = []; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832 + rot, a1 = (i + 1) / n * 6.2832 + rot; segs.push({ i, a0, a1, zc: Pv(top((a0 + a1) / 2, 5.2, 0))[2] }); }
  segs.sort((a, b) => b.zc - a.zc).forEach(sg => { paint(sc, [Pv(top(sg.a0, 5.2, 0)), Pv(top(sg.a1, 5.2, 0)), ap], lit(sg.i % 2 ? PAL.blue : PAL.mustard, Math.cos((sg.a0 + sg.a1) / 2 - 2.4) * 0.2), 720 + sg.i, { n: 2, ang: -1.3 }); });
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 6.2832 + rot; const p = Pv(top(a, 5.3, 0)); sc.fillStyle = C(i % 2 ? PAL.cream : PAL.coral); sc.beginPath(); sc.arc(p[0], p[1], s * 0.8, 0, Math.PI); sc.fill(); if (wk > 0.5 && Math.sin(a) > -0.4) fxBulb(p[0], p[1] + s * 0.6, s * 0.18, bulbOn(wk, i, t)); }
  sc.fillStyle = C(PAL.coral); sc.beginPath(); sc.arc(ap[0], ap[1], s * 0.7, 0, 6.283); sc.fill();
  chairs.filter(c => c.zc <= pc[2]).sort((a, b) => b.zc - a.zc).forEach(drawCh);
  if (wk < 1) vineAlong(pc, P(x, h * 0.9, z), (1 - wk) * 0.9, 730, s);
}

const TOWER = { x: 54, z: -42, h: 46 };
function towerY(t, ta) { const d = t - ta; if (d <= 0) return 2; const up = 0.95, hold = 0.25, drop = 0.32; if (d < up) return 2 + 36 * sstep(0, 1, d / up); if (d < up + hold) return 38; if (d < up + hold + drop) { const u = (d - up - hold) / drop; return 38 - 35 * u * u; } const u = d - up - hold - drop; return 3 + 2.2 * Math.exp(-u * 4) * Math.abs(Math.cos(u * 14)); }
function drawTower(t, wk, ta) {
  const { x, z, h } = TOWER; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3]; const w = 1.4;
  paint(sc, [P(x - 4, 0, z + 4), P(x + 4, 0, z + 4), P(x + 4, 1.2, z + 4), P(x - 4, 1.2, z + 4)], '#d8c3a0', 801, { n: 6 });
  paint(sc, [P(x - w, 0, z + w), P(x + w, 0, z + w), P(x + w, h, z + w), P(x - w, h, z + w)], '#e8e0ee', 802, { n: 18, ang: -1.5 });
  paint(sc, [P(x + w, 0, z + w), P(x + w, 0, z - w), P(x + w, h, z - w), P(x + w, h, z + w)], '#b6a8c8', 803, { n: 10, ang: -1.5 });
  for (let y = 4; y < h; y += 4) line(sc, P(x - w, y, z + w), P(x + w, y, z + w), Math.max(1, s * 0.12), '#c9bdd6');
  // crown
  paint(sc, [P(x - 2.4, h, z + 2.4), P(x + 2.4, h, z + 2.4), P(x + 2.4, h + 2.2, z + 2.4), P(x - 2.4, h + 2.2, z + 2.4)], PAL.coral, 804, { n: 4 });
  const sp = P(x, h + 6, z); pathPoly(sc, [P(x - 2.4, h + 2.2, z + 2.4), P(x + 2.4, h + 2.2, z + 2.4), sp]); sc.fillStyle = C(PAL.mustard); sc.fill();
  if (wk > 0.5) for (let k = 0; k < 5; k++) { const q = P(x - 2 + k, h + 1.1, z + 2.45); fxBulb(q[0], q[1], s * 0.25, bulbOn(wk, k, t) * (0.6 + 0.4 * Math.sin(t * 10 + k * 2)), '#ffcf9a'); }
  // carriage
  const cy = towerY(t, ta); const cr = 3.2;
  const ringB = [], ringF = []; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI; ringF.push(P(x + Math.cos(a) * cr, cy, z + Math.sin(a) * cr)); ringB.push(P(x + Math.cos(a) * cr, cy + 1.2, z + Math.sin(a) * cr)); }
  paint(sc, ringF.concat(ringB.reverse()), PAL.blue, 805, { n: 4 });
  if (wk > 0.6) for (let i = 0; i < 7; i++) { const a = (i + 0.5) / 7 * Math.PI; const p = P(x + Math.cos(a) * (cr + 0.3), cy, z + Math.sin(a) * (cr + 0.3)); line(sc, p, [p[0], p[1] + s * 1.3], Math.max(1, s * 0.25), '#3b4a6b'); sc.fillStyle = C(SKIN[i % 5]); sc.beginPath(); sc.arc(p[0], p[1] - s * 1.5, s * 0.3, 0, 6.283); sc.fill(); }
  if (wk < 1) vineAlong(pc, P(x, h * 0.75, z + w), (1 - wk), 830, s * 1.2);
}

const SHIP = { x: -38, z: 2, py: 13.5 };
function drawShip(t, wk, rideT) {
  const { x, z, py } = SHIP; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3];
  const amp = 0.95 * clamp(rideT / 1.4); const th = amp * Math.sin(rideT * 2.6);
  const frame = (dz, col) => { const top = P(x, py + 1, z + dz); for (const e of [-1, 1]) { const g = P(x + e * 8, 0, z + dz); line(sc, top, g, s * 0.6, col); } };
  frame(-3.2, '#a89a8a');
  const L = (u, v, dz) => { const c = Math.cos(th), sn = Math.sin(th); return P(x + u * c - v * sn, py + u * sn + v * c, z + dz); };
  const hull = dz => [L(-8, -7.2, dz), L(-5, -10.2, dz), L(5, -10.2, dz), L(8, -7.2, dz), L(6.5, -8.2, dz), L(-6.5, -8.2, dz)];
  line(sc, L(0, 0, -2.4), L(-6, -8.5, -2.4), s * 0.35, '#8a7a6a'); line(sc, L(0, 0, -2.4), L(6, -8.5, -2.4), s * 0.35, '#8a7a6a');
  paint(sc, hull(-2.2), '#5b3a26', 901, { n: 6 });
  // deck & riders
  paint(sc, [L(-6.5, -8.2, -2.2), L(6.5, -8.2, -2.2), L(6.5, -8.2, 2.2), L(-6.5, -8.2, 2.2)], '#c8a070', 902, { n: 6 });
  if (wk > 0.6) for (let i = 0; i < 8; i++) for (const dz of [-1, 0.6]) { const q = L(-5 + i * 1.4, -7.3, dz); sc.fillStyle = C(SKIN[(i + (dz > 0)) % 5]); sc.beginPath(); sc.arc(q[0], q[1], s * 0.33, 0, 6.283); sc.fill(); const ar = L(-5 + i * 1.4, -6.2 + 0.3 * Math.sin(t * 10 + i), dz); line(sc, q, ar, Math.max(1, s * 0.12), SKIN[i % 5]); }
  // mast + sail
  const m0 = L(0, -8.2, 0), m1 = L(0, -1.5, 0); line(sc, m0, m1, s * 0.4, '#5b3a26');
  paint(sc, [L(-0.2, -2.5, 0.2), L(3.6, -3.2, 0.2), L(3.2, -6.8, 0.2), L(-0.2, -7.2, 0.2)], PAL.cream, 903, { n: 4 });
  for (let k = 0; k < 2; k++) line(sc, L(0, -3.8 - k * 1.7, 0.3), L(3.5, -4.4 - k * 1.6, 0.3), s * 0.45, PAL.red, 0.9);
  const fl = L(0, -1.5, 0); pathPoly(sc, [fl, [fl[0] + s * 1.6, fl[1] + s * (0.4 + 0.3 * Math.sin(t * 9))], [fl[0], fl[1] + s * 0.9]]); sc.fillStyle = C('#2d2d3a'); sc.fill();
  // front hull side with stripes
  paint(sc, hull(2.2), '#7a4a2c', 904, { n: 8 });
  line(sc, L(-7.6, -7.6, 2.3), L(7.6, -7.6, 2.3), s * 0.5, PAL.mustard); line(sc, L(-5.5, -9.1, 2.3), L(5.5, -9.1, 2.3), s * 0.55, PAL.red);
  for (let k = -3; k <= 3; k++) { const q = L(k * 1.5, -8.6, 2.3); sc.fillStyle = C('#f6ead0'); sc.beginPath(); sc.arc(q[0], q[1], s * 0.22, 0, 6.283); sc.fill(); }
  const ar1 = L(-6, -8.5, 2.4), ar2 = L(6, -8.5, 2.4), pv = L(0, 0, 2.4); line(sc, pv, ar1, s * 0.35, '#8a7a6a'); line(sc, pv, ar2, s * 0.35, '#8a7a6a');
  frame(3.2, '#c9bba9');
  const pp = P(x, py + 1, z + 3.2); sc.fillStyle = C(PAL.mustard); sc.beginPath(); sc.arc(pp[0], pp[1], s * 0.5, 0, 6.283); sc.fill();
  if (wk < 1) { vineAlong(P(x - 8, 0, z + 3.2), pp, (1 - wk) * 0.9, 940, s); vineAlong(P(x + 8, 0, z + 3.2), pp, (1 - wk) * 0.6, 941, s); }
}

function flumeWater(t) { // animated highlights on ground channel + elevated trough
  const { pl, cum } = FLUME; const L = cum[cum.length - 1];
  for (let k = 0; k < 70; k++) { const s0 = ((k * 7.3 + t * 9) % L); const q = along(pl, cum, s0); if (q[1] > 1.2) continue; const p = P(q[0], q[1] + 0.05, q[2]); sc.strokeStyle = 'rgba(235,250,255,0.7)'; sc.lineWidth = Math.max(1, p[3] * 0.2); sc.beginPath(); sc.moveTo(p[0] - p[3] * 0.6, p[1]); sc.lineTo(p[0] + p[3] * 0.6, p[1]); sc.stroke(); }
}
function drawFlumeTrough(i0, i1) {
  const { pl } = FLUME; const a = pl[i0], b = pl[i1]; if (a[1] < 1.5 && b[1] < 1.5) return;
  const pa = P(a[0], a[1], a[2]), pb = P(b[0], b[1], b[2]); FOG = fogAt(pa[2]); const s = pa[3];
  if (i0 % 3 === 0 && a[1] > 1.5) { line(sc, P(a[0], 0, a[2]), P(a[0], a[1] - 0.6, a[2]), s * 0.35, '#8a6440'); }
  line(sc, P(a[0], a[1] - 0.4, a[2]), P(b[0], b[1] - 0.4, b[2]), s * 2.6, '#7d5434');
  line(sc, pa, pb, s * 1.9, '#6fbad6'); line(sc, pa, pb, s * 0.5, '#d8f2fb', 0.8);
}
function drawLog(sPos, t, wk, k) {
  const { pl, cum } = FLUME; const q = along(pl, cum, sPos), q2 = along(pl, cum, sPos + 2.4); const a = P(q[0], q[1] + 0.3, q[2]), b = P(q2[0], q2[1] + 0.3, q2[2]); FOG = fogAt(a[2]); const s = a[3];
  line(sc, a, b, s * 1.5, '#7a4a28'); line(sc, [a[0], a[1] - s * 0.3], [b[0], b[1] - s * 0.3], s * 0.6, '#a8703e');
  if (wk > 0.6) for (let r = 0; r < 3; r++) { const u = 0.2 + r * 0.3; const hp = [lerp(a[0], b[0], u), lerp(a[1], b[1], u) - s * 0.9]; sc.fillStyle = C(SKIN[(k + r) % 5]); sc.beginPath(); sc.arc(hp[0], hp[1], s * 0.32, 0, 6.283); sc.fill(); }
}
function drawGate(t, wk) {
  const z = 62; const pc = P(0, 0, z); FOG = 0; const s = pc[3];
  // fence
  for (const sg of [-1, 1]) { for (let x = 10; x < 60; x += 1.2) { const b = P(sg * x, 0, z + 0.5), tp = P(sg * x, 1.5, z + 0.5); line(sc, b, tp, Math.max(1, s * 0.16), '#f2e6cf'); } line(sc, P(sg * 10, 1.1, z + 0.5), P(sg * 60, 1.1, z + 0.5), s * 0.15, '#d9c7a8'); }
  const tower = (x) => {
    const w = 1.8, h = 9; paint(sc, [P(x - w, 0, z + w), P(x + w, 0, z + w), P(x + w, h, z + w), P(x - w, h, z + w)], '#f1e3c6', 1000 + x | 0, { n: 14, ang: -1.4 });
    paint(sc, [P(x + w, 0, z + w), P(x + w, 0, z - w), P(x + w, h, z - w), P(x + w, h, z + w)], '#cdb894', 1010 + x | 0, { n: 8, ang: -1.4 });
    for (let k = 0; k < 3; k++) line(sc, P(x - w, 2 + k * 2.6, z + w), P(x + w, 2 + k * 2.6, z + w), s * 0.3, PAL.coral, 0.8);
    const ap = P(x, h + 5.2, z); pathPoly(sc, [P(x - w - 0.5, h, z + w + 0.5), P(x + w + 0.5, h, z + w + 0.5), ap]); sc.fillStyle = C(PAL.teal); sc.fill();
    pathPoly(sc, [P(x + w + 0.5, h, z + w + 0.5), P(x + w + 0.5, h, z - w - 0.5), ap]); sc.fillStyle = C(PAL.tealD); sc.fill();
    const fl = Math.sin(t * 6 + x) * s * 0.4; line(sc, ap, [ap[0], ap[1] - s * 2.6], s * 0.15, '#4b3a2a'); pathPoly(sc, [[ap[0], ap[1] - s * 2.6], [ap[0] + s * 2.6, ap[1] - s * 2.1 + fl], [ap[0], ap[1] - s * 1.6]]); sc.fillStyle = C(PAL.coral); sc.fill();
    if (wk < 1) { const r = RNG(x + 99); for (let k = 0; k < 3; k++) vineAlong(P(x - w + k * 1.6, 0, z + w), P(x - w + k * 1.6 + (r() - 0.5) * 2, h * (0.6 + r() * 0.35), z + w), 1 - wk, 1050 + k + x | 0, s); }
  };
  tower(-8); tower(8);
  // arch
  const arch = []; for (let i = 0; i <= 24; i++) { const u = i / 24; arch.push(P(lerp(-6.2, 6.2, u), 8 + 2.6 * Math.sin(u * Math.PI), z + 1.8)); }
  sc.strokeStyle = C(PAL.coral); sc.lineWidth = s * 1.3; sc.beginPath(); arch.forEach((p, i) => i ? sc.lineTo(p[0], p[1]) : sc.moveTo(p[0], p[1])); sc.stroke();
  sc.strokeStyle = C(PAL.mustard); sc.lineWidth = s * 0.35; sc.stroke();
  // sunburst medallion (no text)
  const m = P(0, 11.6, z + 1.9); sc.fillStyle = C(PAL.mustard); sc.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283 + t * 0.3 * wk, rr = k % 2 ? s * 1.4 : s * 2.4; sc.lineTo(m[0] + Math.cos(a) * rr, m[1] + Math.sin(a) * rr); } sc.fill();
  sc.fillStyle = C(PAL.coral); sc.beginPath(); sc.arc(m[0], m[1], s * 1.0, 0, 6.283); sc.fill();
  // bunting under arch
  for (let i = 0; i < 12; i++) { const u = (i + 0.5) / 12; const p = P(lerp(-6.2, 6.2, u), 7.6 + 1.6 * Math.sin(u * Math.PI) - 0.6, z + 1.8); const fl = Math.sin(t * 8 + i) * s * 0.15; pathPoly(sc, [[p[0] - s * 0.4, p[1]], [p[0] + s * 0.4, p[1]], [p[0] + fl, p[1] + s * 0.9]]); sc.fillStyle = C([PAL.coral, PAL.mustard, PAL.teal, PAL.cream][i % 4]); sc.fill(); }
  if (wk > 0.5) arch.forEach((p, i) => { if (i % 2 === 0) fxBulb(p[0], p[1], s * 0.2, bulbOn(wk, i, t)); });
}
function drawFountain(t, wk) {
  const { x, z } = PLAZA; const pc = P(x, 0, z); FOG = fogAt(pc[2]); const s = pc[3];
  const rim = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI; rim.push(P(x + Math.cos(a) * 3.4, 0, z + Math.sin(a) * 3.4)); } for (let i = 24; i >= 0; i--) { const a = i / 24 * Math.PI; rim.push(P(x + Math.cos(a) * 3.4, 0.8, z + Math.sin(a) * 3.4)); }
  paint(sc, rim, '#e9dcc4', 1101, { n: 6 });
  paint(sc, circlePts(x, 0.8, z, 3.4, 30), '#e9dcc4', 1102, { n: 0 }); paint(sc, circlePts(x, 0.82, z, 2.9, 30), wk > 0.5 ? '#5fb3d0' : '#6f8a6a', 1103, { n: 6 });
  const c = P(x, 2.2, z); line(sc, P(x, 0.8, z), c, s * 0.7, '#e9dcc4');
  const R = RNG(5); const on = sstep(0.3, 0.8, wk);
  if (on > 0) for (let k = 0; k < 60; k++) { const a = R() * 6.28, v = 0.6 + R() * 0.6, ph = (t * 1.2 + R()) % 1; const rr = ph * 2.6 * v, yy = 2.2 + Math.sin(ph * Math.PI) * 3.4 * v * on; const p = P(x + Math.cos(a) * rr, yy, z + Math.sin(a) * rr); sc.fillStyle = `rgba(225,245,255,${0.75 * on})`; sc.beginPath(); sc.arc(p[0], p[1], Math.max(1, s * 0.18), 0, 6.283); sc.fill(); }
}
function drawGuest(g, t, wk) {
  let x, z, moving = 1;
  if (g.kind === 'path') { const p = PATHS[g.pi]; const L = p.cum[p.cum.length - 1]; let s = (g.u * L + g.dir * g.sp * 1.25 * t) % L; if (s < 0) s += L; const q = along(p.pl, p.cum, s), q2 = along(p.pl, p.cum, Math.min(L, s + 0.5)); let dx = q2[0] - q[0], dz = q2[1] - q[1]; const l = Math.hypot(dx, dz) || 1; x = q[0] - dz / l * g.off; z = q[1] + dx / l * g.off; }
  else if (g.kind === 'plaza') { const a = g.a + g.w * t; x = PLAZA.x + Math.cos(a) * g.r; z = PLAZA.z + Math.sin(a) * g.r; if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < 3.8) { x += 1.5; } }
  else { x = g.x; z = g.z; moving = 0; }
  const b = P(x, 0, z); const vis = sstep(g.thr, g.thr + 0.12, wk); if (vis <= 0.01) return; FOG = fogAt(b[2]);
  const s = b[3] * (g.child ? 0.7 : 1) * (0.6 + 0.4 * vis); const ph = t * 9 * g.sp + g.ph;
  const bob = moving ? Math.abs(Math.sin(ph)) * s * 0.08 : 0;
  sc.fillStyle = `rgba(60,40,100,${0.22 * vis})`; sc.beginPath(); sc.ellipse(b[0] + s * 0.25, b[1], s * 0.45, s * 0.15, 0, 0, 6.283); sc.fill();
  const sw = moving ? Math.sin(ph) * s * 0.18 : 0;
  line(sc, [b[0] - s * 0.1, b[1] - s * 0.75 - bob], [b[0] - s * 0.1 + sw, b[1]], Math.max(1, s * 0.2), g.pants, vis);
  line(sc, [b[0] + s * 0.1, b[1] - s * 0.75 - bob], [b[0] + s * 0.1 - sw, b[1]], Math.max(1, s * 0.2), g.pants, vis);
  sc.fillStyle = C(g.shirt, vis); sc.beginPath(); sc.ellipse(b[0], b[1] - s * 1.05 - bob, s * 0.28, s * 0.38, 0, 0, 6.283); sc.fill();
  sc.fillStyle = C(lit(g.shirt, 0.35), vis * 0.8); sc.beginPath(); sc.ellipse(b[0] - s * 0.1, b[1] - s * 1.15 - bob, s * 0.1, s * 0.2, 0, 0, 6.283); sc.fill();
  sc.fillStyle = C(g.skin, vis); sc.beginPath(); sc.arc(b[0], b[1] - s * 1.58 - bob, s * 0.2, 0, 6.283); sc.fill();
  sc.fillStyle = C(['#3a2618', '#e8c36a', '#6b3a1f', '#222', '#b5532d'][(g.ph * 10 | 0) % 5], vis); sc.beginPath(); sc.arc(b[0], b[1] - s * 1.62 - bob, s * 0.2, Math.PI * 1.05, Math.PI * 1.95); sc.fill();
  if (g.balloon) { const hb = [b[0] + s * 0.3, b[1] - s * 1.1 - bob]; const bt = [hb[0] + Math.sin(t * 2 + g.ph) * s * 0.3 + s * 0.2, hb[1] - s * 1.8]; line(sc, hb, bt, 0.8, '#ffffff', 0.7 * vis); sc.fillStyle = C(g.balloon, vis); sc.beginPath(); sc.ellipse(bt[0], bt[1] - s * 0.35, s * 0.32, s * 0.4, 0, 0, 6.283); sc.fill(); sc.fillStyle = `rgba(255,255,255,${0.7 * vis})`; sc.beginPath(); sc.arc(bt[0] - s * 0.1, bt[1] - s * 0.5, s * 0.08, 0, 6.283); sc.fill(); }
}
function drawLamp(x, z, t, wk, i) { const b = P(x, 0, z), tp = P(x, 4.5, z); FOG = fogAt(b[2]); const s = b[3]; line(sc, b, tp, Math.max(1, s * 0.2), '#3d4a4f'); sc.fillStyle = C('#3d4a4f'); sc.beginPath(); sc.arc(tp[0], tp[1], s * 0.4, 0, 6.283); sc.fill(); if (wk > 0.5) fxBulb(tp[0], tp[1], s * 0.3, bulbOn(wk, i, t), '#fff0c8'); return tp; }
const LAMPS = [[-6, 32], [6, 32], [-6, 44], [6, 44], [-6, 56], [6, 56], [-12, 12], [12, 12], [-8, 26], [8, 26], [-12, 22], [12, 22]];
function drawStrings(t, wk) { // string lights between lamps
  const pairs = [[0, 2], [1, 3], [2, 4], [3, 5], [0, 1], [2, 3], [4, 5], [6, 8], [7, 9], [8, 0], [9, 1]];
  for (const [a, b] of pairs) { const A = LAMPS[a], B = LAMPS[b]; const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(P(lerp(A[0], B[0], u), 4.4 - Math.sin(u * Math.PI) * 1.2, lerp(A[1], B[1], u))); } FOG = fogAt(pts[0][2]); sc.strokeStyle = C('#4a4040', 0.7); sc.lineWidth = 0.9; sc.beginPath(); pts.forEach((p, i) => i ? sc.lineTo(p[0], p[1]) : sc.moveTo(p[0], p[1])); sc.stroke(); pts.forEach((p, i) => { if (i % 2) { const c = ['#ffd27a', '#ff9a8a', '#a8e0ff', '#fff3c0'][i % 4]; if (wk > 0.5) fxBulb(p[0], p[1], p[3] * 0.18, bulbOn(wk, i + a, t), c); else { sc.fillStyle = C('#8a8070'); sc.beginPath(); sc.arc(p[0], p[1], 1.2, 0, 6.283); sc.fill(); } } }); }
}
const VENDORS = [[4, 26], [-30, 12], [16, 12]];
function drawVendor(v, t, wk, k) { const b = P(v[0], 0, v[1]); FOG = fogAt(b[2]); const s = b[3]; const vis = sstep(0.35, 0.6, wk); if (vis <= 0) return; const hand = [b[0] + s * 0.3, b[1] - s * 1.2]; const cols = [PAL.coral, PAL.mustard, PAL.teal, PAL.pink, PAL.blue, PAL.lilac, PAL.mint, PAL.orange, PAL.red]; drawGuest({ kind: 'still', x: v[0], z: v[1], shirt: '#f6ead0', pants: '#3b4a6b', skin: SKIN[k], ph: 1, thr: 0, child: false }, t, 1); for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.22; const L = s * (3.4 + (i % 3) * 0.5); const bx = hand[0] + Math.cos(a) * L + Math.sin(t * 2 + i) * s * 0.2, by = hand[1] + Math.sin(a) * L; line(sc, hand, [bx, by], 0.7, '#ffffff', 0.6 * vis); sc.fillStyle = C(cols[i], vis); sc.beginPath(); sc.ellipse(bx, by - s * 0.4, s * 0.45, s * 0.55, 0, 0, 6.283); sc.fill(); sc.fillStyle = `rgba(255,255,255,${0.75 * vis})`; sc.beginPath(); sc.arc(bx - s * 0.15, by - s * 0.6, s * 0.12, 0, 6.283); sc.fill(); } }

// ---------------------------------------------------------------- particles at the wake front
const FLAKES = [];
(function () { const R = RNG(123); for (let k = 0; k < 360; k++) { const i = (R() * COASTER.Nseg) | 0; const p = Pv(COASTER.S[i]); FLAKES.push({ x: p[0] + (R() - 0.5) * 6, y: p[1] + (R() - 0.5) * 4, ta: 0, vx: 30 + R() * 70, vy: -40 - R() * 60, rot: R() * 6, sz: 1.5 + R() * 2.5, c: ['#8a4a22', '#a35f2c', '#6b3a1e', '#c9783a'][k % 4], paint: [PAL.coral, PAL.cream, PAL.mustard][k % 3] }); }
  const { c, R: WR, yaw } = WHEEL; const E1 = [Math.cos(yaw), 0, -Math.sin(yaw)];
  for (let k = 0; k < 140; k++) { const a = R() * 6.283; const p = Pv(v3.add(c, v3.add(v3.mul(E1, Math.cos(a) * WR), [0, Math.sin(a) * WR, 0]))); FLAKES.push({ x: p[0], y: p[1], vx: 20 + R() * 60, vy: -30 - R() * 50, rot: R() * 6, sz: 1.5 + R() * 2, c: ['#8a4a22', '#a35f2c', '#6b3a1e'][k % 3], leaf: R() < 0.5 }); }
  for (let k = 0; k < 200; k++) { const x = R() * W, y = 300 + R() * 760; FLAKES.push({ x, y, vx: 10 + R() * 50, vy: -40 - R() * 70, rot: R() * 6, sz: 2 + R() * 3, c: ['#6f8a3a', '#8a7a3a', '#5a7a32'][k % 3], leaf: true }); }
  FLAKES.forEach(f => { f.ta = wakeTime(f.x, f.y) - 0.08; });
})();
const SPARK = [];
(function () { const R = RNG(456); for (let k = 0; k < 520; k++) { const x = R() * W, y = R() * H; SPARK.push({ x, y, ta: wakeTime(x, y) - 0.12 + (R() - 0.5) * 0.08, sz: 1 + R() * 2.4, ph: R() * 6 }); } })();
const LEAVES = []; (function () { const R = RNG(789); for (let k = 0; k < 40; k++) LEAVES.push({ x: R() * W, y: R() * H, vx: 15 + R() * 25, vy: 20 + R() * 30, ph: R() * 6, sz: 2 + R() * 3 }); })();
function drawParticles(t) {
  for (const f of FLAKES) { const d = t - f.ta; if (d < 0 || d > 0.9) continue; const u = d / 0.9; const x = f.x + f.vx * d + Math.sin(d * 8 + f.rot) * 6, y = f.y + f.vy * d + 60 * d * d; const a = (1 - u) * 0.95; fx.save(); fx.translate(x, y); fx.rotate(f.rot + d * 9); fx.fillStyle = `rgba(${hx(u > 0.4 && f.paint ? f.paint : f.c)},${a})`; if (f.leaf) { fx.beginPath(); fx.ellipse(0, 0, f.sz * 1.3, f.sz * 0.6, 0, 0, 6.283); fx.fill(); } else fx.fillRect(-f.sz, -f.sz * 0.6, f.sz * 2, f.sz * 1.2); fx.restore(); }
  for (const s of SPARK) { const d = t - s.ta; if (d < 0 || d > 0.6) continue; const a = Math.sin(d / 0.6 * Math.PI); const y = s.y - d * 40; const g = fx.createRadialGradient(s.x, y, 0, s.x, y, s.sz * 5); g.addColorStop(0, `rgba(255,236,170,${0.6 * a})`); g.addColorStop(1, 'rgba(255,236,170,0)'); fx.fillStyle = g; fx.fillRect(s.x - s.sz * 5, y - s.sz * 5, s.sz * 10, s.sz * 10); fx.fillStyle = `rgba(255,255,240,${a})`; fx.beginPath(); fx.moveTo(s.x, y - s.sz * 2.5); fx.lineTo(s.x + s.sz * 0.5, y); fx.lineTo(s.x, y + s.sz * 2.5); fx.lineTo(s.x - s.sz * 0.5, y); fx.fill(); fx.beginPath(); fx.moveTo(s.x - s.sz * 2.5, y); fx.lineTo(s.x, y + s.sz * 0.5); fx.lineTo(s.x + s.sz * 2.5, y); fx.lineTo(s.x, y - s.sz * 0.5); fx.fill(); }
  // drifting dead leaves in still-abandoned areas
  for (const l of LEAVES) { const x = (l.x + l.vx * t) % W, y = (l.y + l.vy * t + Math.sin(t * 2 + l.ph) * 10) % H; const wk = wakeAt(x, y, t); if (wk > 0.9) continue; sc.fillStyle = `rgba(150,120,70,${0.8 * (1 - wk)})`; sc.save(); sc.translate(x, y); sc.rotate(t * 3 + l.ph); sc.beginPath(); sc.ellipse(0, 0, l.sz * 1.4, l.sz * 0.6, 0, 0, 6.283); sc.fill(); sc.restore(); }
}
// floating balloons
const BALLOONS = []; (function () { const R = RNG(999); for (let k = 0; k < 14; k++) { const v = VENDORS[k % 3]; const p = P(v[0] + (R() - 0.5) * 6, 4, v[1] + (R() - 0.5) * 6); BALLOONS.push({ x: p[0], y: p[1], s: p[3], vy: 35 + R() * 35, ph: R() * 6, c: [PAL.coral, PAL.mustard, PAL.teal, PAL.pink, PAL.blue, PAL.lilac][k % 6], t0: 0.2 + R() * 1.4 }); } })();
function drawBalloon(ctx, x, y, r, col, a = 1, str = true) { ctx.fillStyle = C(lit(col, -0.15), a); ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.18, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = C(col, a); ctx.beginPath(); ctx.ellipse(x - r * 0.12, y - r * 0.12, r * 0.82, r * 0.98, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = `rgba(255,252,240,${0.85 * a})`; ctx.beginPath(); ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.18, r * 0.3, -0.5, 0, 6.283); ctx.fill(); ctx.fillStyle = C(lit(col, -0.3), a); ctx.beginPath(); ctx.moveTo(x - r * 0.15, y + r * 1.25); ctx.lineTo(x + r * 0.15, y + r * 1.25); ctx.lineTo(x, y + r * 1.1); ctx.fill(); if (str) { ctx.strokeStyle = `rgba(250,250,250,${0.6 * a})`; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x, y + r * 1.25); ctx.quadraticCurveTo(x + r * 0.5, y + r * 2.4, x - r * 0.2, y + r * 3.6); ctx.stroke(); } }

// foreground framing (painted at a nearer parallax plane)
function drawForeground(t, zoom) {
  sc.save(); const cx = 540, cy = 560; sc.translate(cx, cy); sc.scale(zoom, zoom); sc.translate(-cx, -cy); FOG = 0;
  const sway = Math.sin(t * 1.3) * 3;
  const bush = (x, y, r, seed, col) => { blob(sc, x, y + r * 0.1, r * 0.9, lit(col, -0.4), seed, { n: 7 }); const lv = RNG(seed); for (let k = 0; k < 260; k++) { const a = lv() * 6.283, d = Math.sqrt(lv()) * r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.85; const lt = clamp(((y - py) / r + (x - px) / r * 0.5) * 0.5 + (lv() - 0.5) * 0.4, -0.6, 0.6); sc.fillStyle = C(lit(col, lt * 0.8 - 0.05)); const sw2 = sway * (1 - (py - y + r) / (2 * r)); sc.beginPath(); sc.ellipse(px + sw2, py, 6 + lv() * 8, 3 + lv() * 4, lv() * 3, 0, 6.283); sc.fill(); } };
  bush(-30, 1050, 170, 1, hx('#3f7238')); bush(90, 1110, 120, 4, hx('#4d8a3a')); bush(1110, 1040, 170, 7, hx('#3a6a3a')); bush(990, 1110, 110, 9, hx('#4e8740'));
  bush(-40, 860, 90, 12, hx('#2f5d34'));
  const R = RNG(55); for (let k = 0; k < 40; k++) { const left = k < 20; const x = left ? R() * 200 - 20 : 880 + R() * 220, y = 960 + R() * 130; const fc = ['#f4d35e', '#ee6c8a', '#ffffff', '#f08a4b', '#c7a1ef'][k % 5]; for (let j = 0; j < 5; j++) { const a = j / 5 * 6.283; sc.fillStyle = C(fc); sc.beginPath(); sc.ellipse(x + sway + Math.cos(a) * 3, y + Math.sin(a) * 2.2, 2.6, 1.6, a, 0, 6.283); sc.fill(); } sc.fillStyle = C('#e0a020'); sc.beginPath(); sc.arc(x + sway, y, 1.4, 0, 6.283); sc.fill(); }
  // overhanging branch, top-left (nearest parallax plane)
  sc.save(); sc.translate(sway * 1.5, sway * 0.6);
  sc.strokeStyle = C('#4a3326'); sc.lineCap = 'round'; sc.lineWidth = 16; sc.beginPath(); sc.moveTo(-30, 40); sc.quadraticCurveTo(90, 60, 190, 30); sc.stroke(); sc.lineWidth = 8; sc.beginPath(); sc.moveTo(80, 52); sc.quadraticCurveTo(140, 100, 170, 120); sc.stroke();
  const lv = RNG(77); const leafC = [hx('#2f5d34'), hx('#3f7238'), hx('#58903f'), hx('#7fae4a')];
  const clusters = [[-10, 10, 120], [120, -10, 95], [200, 30, 60], [165, 115, 42], [40, 90, 60]];
  for (const [x, y, r] of clusters) for (let k = 0; k < 70; k++) { const a = lv() * 6.283, d = Math.sqrt(lv()) * r; const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.7; const ci = clamp(((py - y) / r * -1.2 + 1.2 + (lv() - 0.5)) * 1.5, 0, 3) | 0; sc.fillStyle = C(leafC[ci]); sc.beginPath(); sc.ellipse(px, py, 7 + lv() * 7, 3.5 + lv() * 3, lv() * 3, 0, 6.283); sc.fill(); }
  for (let k = 0; k < 10; k++) { const x = 30 + lv() * 170, y = 80 + lv() * 80; sc.fillStyle = C(['#f4d35e', '#f5b3c4', '#ffffff'][k % 3]); sc.beginPath(); sc.arc(x, y, 3 + lv() * 2, 0, 6.283); sc.fill(); }
  sc.restore();
  sc.restore();
}

// ---------------------------------------------------------------- frame
function drawScene(t) {
  D = [];
  const ez = sstep(0, 3, t);
  const zoom = 1 + 0.045 * ez;
  sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, W, H); fx.setTransform(1, 0, 0, 1, 0, 0); fx.clearRect(0, 0, W, H);
  // sky (slow) + far (medium) parallax
  sc.drawImage(skyv, -60 - t * 14, -100 - t * 2, 1240, 520);
  const fz = 1 + 0.02 * ez; sc.save(); sc.translate(540, 560); sc.scale(fz, fz); sc.translate(-540, -560); sc.drawImage(farv, -40, 0); sc.restore();
  // park plane
  const cx = 540, cy = 560; const T = (ctx) => { ctx.setTransform(zoom, 0, 0, zoom, cx * (1 - zoom), cy * (1 - zoom)); };
  T(sc); T(fx);
  sc.drawImage(grv, 0, 0);
  flumeWater(t);
  const wk = (x, z, y = 0) => { const p = P(x, y, z); return wakeAt(p[0], p[1], t); };
  const wt = (x, z, y = 0) => { const p = P(x, y, z); return wakeTime(p[0], p[1]); };
  // shadows
  TREES.forEach(treeShadow);
  { const sh = []; for (let i = 0; i < COASTER.Nseg; i += 2) { const p = COASTER.S[i]; const o = shadowOff(p[1]); sh.push(P(p[0] + o[0], 0, p[2] + o[2])); } sc.strokeStyle = 'rgba(60,40,100,0.2)'; sc.lineWidth = 7; sc.beginPath(); sh.forEach((p, i) => i ? sc.lineTo(p[0], p[1]) : sc.moveTo(p[0], p[1])); sc.closePath(); sc.stroke(); }
  { const o = shadowOff(WHEEL.c[1]); shadowEllipse(WHEEL.c[0] + o[0], WHEEL.c[2] + o[2], 15, 5, 0.16); }
  { const o = shadowOff(20); const a = P(TOWER.x, 0, TOWER.z), b = P(TOWER.x + o[0] * 2, 0, TOWER.z + o[2] * 2); line(sc, a, b, a[3] * 2.4, '#3c2864', 0.18); }
  shadowEllipse(CAROUSEL.x + 3, CAROUSEL.z + 2, 9, 9, 0.18); shadowEllipse(SWING.x + 4, SWING.z + 3, 8, 8, 0.12); shadowEllipse(SHIP.x + 3, SHIP.z + 2, 9, 4, 0.16); shadowEllipse(TEACUPS.x + 2, TEACUPS.z + 1.5, 7, 7, 0.14);
  STALLS.forEach(st => shadowEllipse(st.x + 1.6, st.z + 1, 3, 2.4, 0.18));
  // weeds (abandoned)
  WEEDS.forEach(wd => { const p = P(wd.x, 0, wd.z); const w = wakeAt(p[0], p[1], t); const g = 1 - sstep(0, 0.7, w); if (g <= 0) return; push(p[2], () => { FOG = fogAt(p[2]); const r = RNG(wd.seed); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.2; const h = wd.h * p[3] * g * (0.6 + r() * 0.6); line(sc, [p[0] + (r() - 0.5) * p[3], p[1]], [p[0] + Math.cos(a) * h, p[1] + Math.sin(a) * h], Math.max(1, p[3] * 0.18), lit('#6f7a3a', (r() - 0.5) * 0.4)); } }); });
  // drawables
  IVY.forEach(v => { const p = P(v.x, 0, v.z); const g = 1 - sstep(0.05, 0.75, wakeAt(p[0], p[1] - 10, t)); if (g <= 0.02) return; push(p[2] - 0.8, () => drawIvy(v, g)); });
  TREES.forEach(tr => { const p = P(tr.x, 0, tr.z); push(p[2], () => drawTree(tr, t, wakeAt(p[0], p[1], t))); });
  STALLS.forEach(st => { const p = P(st.x, 0, st.z); push(p[2], () => drawStall(st, t, wakeAt(p[0], p[1] - 20, t))); });
  BLANKETS.forEach(b => { const p = P(b.x, 0, b.z); push(p[2], () => drawBlanket(b, t, wakeAt(p[0], p[1], t))); });
  UMBRELLAS.forEach(u => { const p = P(u.x, 0, u.z); push(p[2], () => drawUmbrella(u, t)); });
  LAMPS.forEach((l, i) => { const p = P(l[0], 0, l[1]); push(p[2] - 0.5, () => drawLamp(l[0], l[1], t, wakeAt(p[0], p[1], t), i)); });
  push(P(0, 4, 40)[2] - 30, () => drawStrings(t, wk(0, 30, 4)));
  GUESTS.forEach(g => push(0, null)); D.length -= GUESTS.length; // placeholder (guests pushed below with real depth)
  for (const g of GUESTS) { let x, z; if (g.kind === 'path') { const p = PATHS[g.pi]; const L = p.cum[p.cum.length - 1]; let s = (g.u * L + g.dir * g.sp * 1.25 * t) % L; if (s < 0) s += L; const q = along(p.pl, p.cum, s); x = q[0]; z = q[1]; } else if (g.kind === 'plaza') { const a = g.a + g.w * t; x = PLAZA.x + Math.cos(a) * g.r; z = PLAZA.z + Math.sin(a) * g.r; } else { x = g.x; z = g.z; } const p = P(x, 0, z); push(p[2], () => drawGuest(g, t, wakeAt(p[0], p[1], t))); }
  VENDORS.forEach((v, k) => { const p = P(v[0], 0, v[1]); push(p[2], () => drawVendor(v, t, wakeAt(p[0], p[1], t), k)); });
  push(P(PLAZA.x, 0, PLAZA.z)[2], () => drawFountain(t, wk(PLAZA.x, PLAZA.z)));
  push(P(0, 0, 62)[2], () => drawGate(t, wk(0, 62, 6)));
  { const w = wk(CAROUSEL.x, CAROUSEL.z, 4); const rt = ramp(t, wt(CAROUSEL.x, CAROUSEL.z, 4), 0.7); push(P(CAROUSEL.x, 0, CAROUSEL.z)[2], () => drawCarousel(t, w, rt)); }
  { const w = wk(TEACUPS.x, TEACUPS.z); const rt = ramp(t, wt(TEACUPS.x, TEACUPS.z), 0.6); push(P(TEACUPS.x, 0, TEACUPS.z)[2], () => drawTeacups(t, w, rt)); }
  { const w = wk(SWING.x, SWING.z, 10); const ta = wt(SWING.x, SWING.z, 10); const rt = ramp(t, ta, 0.9); const sp = sstep(0, 1.1, t - ta); push(P(SWING.x, 0, SWING.z)[2], () => drawSwing(t, w, rt, sp)); }
  { const w = wk(SHIP.x, SHIP.z, 8); const rt = ramp(t, wt(SHIP.x, SHIP.z, 8), 0.3); push(P(SHIP.x, 0, SHIP.z)[2], () => drawShip(t, w, rt)); }
  { const w = wk(TOWER.x, TOWER.z, 20); const ta = wt(TOWER.x, TOWER.z, 20); push(P(TOWER.x, 0, TOWER.z)[2], () => drawTower(t, w, ta)); }
  { const w = wk(WHEEL.c[0], WHEEL.c[2], WHEEL.c[1]); const rt = ramp(t, wt(WHEEL.c[0], WHEEL.c[2], WHEEL.c[1]), 0.8); const A = [Math.sin(WHEEL.yaw), 0, Math.cos(WHEEL.yaw)]; push(Pv(v3.add(WHEEL.c, v3.mul(A, -3)))[2], () => drawWheel(t, w, rt, false)); push(Pv(WHEEL.c)[2], () => drawWheel(t, w, rt, true)); }
  // flume
  for (let i = 0; i < FLUME.pl.length - 1; i++) { const a = FLUME.pl[i]; if (a[1] < 1.5 && FLUME.pl[i + 1][1] < 1.5) continue; push(P(a[0], a[1], a[2])[2], () => drawFlumeTrough(i, i + 1)); }
  { const L = FLUME.cum[FLUME.cum.length - 1]; const ta = wt(46, 0, 5); for (let k = 0; k < 5; k++) { const rt = ramp(t, ta, 0.5); let sp = (k * L / 5 + rt * 9); const q = along(FLUME.pl, FLUME.cum, sp % L); const p = P(q[0], q[1], q[2]); push(p[2] - 0.5, () => drawLog(sp % L, t, wakeAt(p[0], p[1], t), k)); } }
  { const sp = P(37.5, 0.6, 8); const w = wk(37.5, 8); if (w > 0.3) push(sp[2] - 1, () => { const R = RNG(17); const on = sstep(0.3, 0.9, w); for (let k = 0; k < 70; k++) { const ph = (t * 1.4 + R()) % 1; const a = R() * 6.283; const v = 1 + R() * 2; const p = P(37.5 + Math.cos(a) * ph * v * 1.4, 0.6 + Math.sin(ph * Math.PI) * v * 1.6, 8 + Math.sin(a) * ph * v * 0.8 + 1.5); sc.fillStyle = `rgba(240,250,255,${0.8 * on * (1 - ph * 0.5)})`; sc.beginPath(); sc.arc(p[0], p[1], p[3] * (0.2 + R() * 0.25), 0, 6.283); sc.fill(); } }); }
  // coaster
  let roof = null;
  push(P(3, 0, -3)[2] + 3, () => { roof = coasterStation(t, wk(3, -3, 3)); });
  push(P(3, 8, -3)[2] - 1, () => { if (roof) roof(); });
  for (let i = 0; i < COASTER.Nseg; i++) { const p = Pv(COASTER.S[i]); push(p[2], () => drawCoasterSeg(i, t)); if (i % 8 === 0 && coasterSupports(i)) { const q = Pv([COASTER.S[i][0], 0, COASTER.S[i][2]]); push((p[2] + q[2]) / 2 + 0.3, () => drawSupport(i, t)); } }
  push(Pv(COASTER.loopC)[2] + 0.5, () => drawLoopLegs(t));
  { const fi = Math.min(TRAIN_S.length - 1, Math.round(t * 30)); const sHead = TRAIN_S[fi]; const hp = Pv(trackAt(sHead).p); const w = wakeAt(hp[0], hp[1], t); const riders = sstep(0.5, 0.9, w);
    for (let c = 0; c < TRAIN.cars; c++) { const tr = trackAt(sHead - c * TRAIN.gap); const p = Pv(v3.add(tr.p, v3.mul(tr.N, 0.8))); push(p[2] - 0.6, () => drawCar(sHead, c, t, w, riders)); } }
  D.sort((a, b) => b.z - a.z);
  for (const d of D) d.f && d.f();
  // released balloons
  for (const b of BALLOONS) { const w = wakeAt(b.x, b.y, t); const ta = wakeTime(b.x, b.y) + b.t0 * 0.3; const d = t - ta; if (d <= 0) continue; const y = b.y - d * b.vy, x = b.x + Math.sin(d * 2 + b.ph) * 6 + d * 8; FOG = 0.1; drawBalloon(sc, x, y, b.s * 0.55 + d * 0.3, b.c, Math.min(1, d * 4)); }
  sc.setTransform(1, 0, 0, 1, 0, 0); fx.setTransform(1, 0, 0, 1, 0, 0);
  drawParticles(t);
  // foreground plane + big near balloons
  drawForeground(t, 1 + 0.08 * ez);
  [[150, 0.95, PAL.coral, 0], [930, 1.15, PAL.mustard, 1], [820, 1.5, PAL.teal, 2]].forEach(([x, tt, c, k]) => { const d = t - tt; if (d <= 0) return; const y = 1150 - d * 190; const xx = x + Math.sin(d * 1.7 + k) * 14; FOG = 0; drawBalloon(sc, xx, y, 26 + k * 4, c, Math.min(1, d * 3)); });
}

// ---------------------------------------------------------------- WebGL gouache pass
const out = document.getElementById('out');
const gl = out.getContext('webgl', { preserveDrawingBuffer: true, antialias: false });
const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
const FS = `precision highp float;
uniform sampler2D uS, uF, uA; uniform float uP, uT; varying vec2 v;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
const vec2 PX = vec2(1./1080.);
vec3 S(vec2 uv){ return texture2D(uS, uv).rgb + (h(floor(uv*1080.))-.5)*.035; }
void main(){
  vec2 uv = v;
  vec2 wob = vec2(fbm(uv*38.), fbm(uv*38.+7.3)) - .5; uv += wob*PX*4.;
  // generalized Kuwahara, radius 2 (4 overlapping quadrants)
  vec3 m[4]; vec3 s2[4];
  for(int k=0;k<4;k++){ m[k]=vec3(0.); s2[k]=vec3(0.); }
  for(int j=-3;j<=3;j++) for(int i=-3;i<=3;i++){
    vec3 c = S(uv + vec2(float(i),float(j))*PX*1.0);
    if(i<=0 && j<=0){ m[0]+=c; s2[0]+=c*c; }
    if(i>=0 && j<=0){ m[1]+=c; s2[1]+=c*c; }
    if(i<=0 && j>=0){ m[2]+=c; s2[2]+=c*c; }
    if(i>=0 && j>=0){ m[3]+=c; s2[3]+=c*c; }
  }
  vec3 acc=vec3(0.); float wsum=0.;
  for(int k=0;k<4;k++){ vec3 mm=m[k]/16.; vec3 vv=abs(s2[k]/16.-mm*mm); float sg=vv.r+vv.g+vv.b; float w=1./(1.+pow(sg*500.,2.)); acc+=mm*w; wsum+=w; }
  vec3 c = acc/wsum;
  c = mix(c, S(uv), 0.15);
  // bristle streaks: anisotropic noise along a slowly varying stroke direction
  float ang = fbm(v*3.3)*6.2832; vec2 dv = vec2(cos(ang), sin(ang));
  vec2 q = vec2(dot(v,dv), dot(v,vec2(-dv.y,dv.x)));
  float br = n(q*vec2(60.,700.)) - .5;
  c *= 1. + br*.035;
  // pigment pooling at edges
  float l1=dot(S(uv+vec2(2.,0.)*PX),vec3(.3,.59,.11)), l2=dot(S(uv-vec2(2.,0.)*PX),vec3(.3,.59,.11));
  float l3=dot(S(uv+vec2(0.,2.)*PX),vec3(.3,.59,.11)), l4=dot(S(uv-vec2(0.,2.)*PX),vec3(.3,.59,.11));
  float g = length(vec2(l1-l2,l3-l4));
  c *= 1. - .18*smoothstep(.05,.35,g);
  // abandoned grade
  vec4 ar = texture2D(uA, v); float arr = (ar.r*255.*256.+ar.g*255.)/65535.*1.6-0.3;
  float w = smoothstep(0., .1, uP - arr + (fbm(v*22.)-.5)*.07);
  float lum = dot(c, vec3(.3,.59,.11));
  vec3 ab = mix(vec3(lum), c, .22); ab = ab*vec3(.86,.93,.9) + vec3(.01,.03,.03);
  ab = mix(ab, vec3(lum*.8+.06), .2);
  float mist = fbm(v*vec2(2.2,6.) + vec2(uT*.07, uT*.012));
  float band2 = fbm(v*vec2(1.5,14.) + vec2(uT*.1,0.));
  ab = mix(ab, vec3(.66,.70,.70), clamp(.08 + .5*mist*(.35+v.y) + .25*smoothstep(.45,.7,band2), 0., .78));
  ab *= .88;
  vec3 alive = c*vec3(1.03,1.0,.95); alive = mix(vec3(dot(alive,vec3(.3,.59,.11))), alive, 1.1);
  c = mix(ab, alive, w);
  float band = w*(1.-w)*4.;
  c += vec3(1.,.78,.42)*band*.28;
  // fx overlay (lights, sparkles, flakes)
  vec4 f = texture2D(uF, v);
  c = mix(c, f.rgb, f.a);
  // paper: fibres + granulation
  float grain = fbm(v*vec2(420.,400.)); float fib = n(v*vec2(1600.,90.))*n(v*vec2(80.,1500.));
  c *= .955 + .07*grain - .05*fib;
  c *= 1. - .07*(n(v*720.)-.5)*(1.-lum);
  // warm vignette
  float vg = length(v-vec2(.5,.48));
  c *= 1. - .32*pow(vg*1.25, 2.6);
  c = mix(c, c*vec3(1.04,.98,.9), .3);
  gl_FragColor = vec4(c,1.);
}`;
function mk(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
const prog_ = gl.createProgram(); gl.attachShader(prog_, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog_, mk(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog_); gl.useProgram(prog_);
const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog_, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
function tex(unit, name) { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.uniform1i(gl.getUniformLocation(prog_, name), unit); return t; }
gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
const tS = tex(0, 'uS'), tF = tex(1, 'uF'), tA = tex(2, 'uA');
(function () { // arrival map texture (16-bit in RG)
  const d = new Uint8Array(AW * AW * 4);
  for (let j = 0; j < AW; j++) for (let i = 0; i < AW; i++) { const a = ARR[j * AW + i]; const q = Math.round(clamp((a + 0.3) / 1.6) * 65535); const o = ((AW - 1 - j) * AW + i) * 4; d[o] = q >> 8; d[o + 1] = q & 255; d[o + 2] = 0; d[o + 3] = 255; }
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, tA); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, AW, AW, 0, gl.RGBA, gl.UNSIGNED_BYTE, d); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
})();
const uP = gl.getUniformLocation(prog_, 'uP'), uT = gl.getUniformLocation(prog_, 'uT');

window.renderFrame = async function (i) {
  const t = i / FPS;
  drawScene(t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tS); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scv);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tF); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fxv);
  gl.uniform1f(uP, prog(t)); gl.uniform1f(uT, t);
  gl.viewport(0, 0, W, H); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.finish();
};
window.rawScene = function (i) { drawScene(i / FPS); const c = out; };
buildSky(); buildFar(); buildGround(); buildIvy();
window.READY = true;
