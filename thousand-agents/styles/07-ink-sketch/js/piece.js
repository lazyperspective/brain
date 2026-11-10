/* 1000 Agents — first 3 seconds, hand-drawn ink + gouache on dark indigo paper.
   Pure Canvas 2D. Every frame is a pure function of t (hash noise only). */
(function () {
'use strict';
const W = 1920, H = 1080, DUR = 3, FPS = 30, TAU = Math.PI * 2;
const C = { coral: '#d97757', shade: '#a8553b', light: '#f2a585', dark: '#6e2a1a', hot: '#ffd9b0',
            ink: '#efe6ff', lilac: '#a99aef', eye: '#120a16' };
const GROUND = 706;
const FX0 = 1000, FX1 = 1262, FY0 = 512, TABH = 26, TABW = 98, FY1 = GROUND, FYF = FY0 + TABH + 20;
const MOUTH = [1136, 566];
const BW = 250, BH = 150, LEG = 54, CHX = 790;

/* ------------------------------------------------------------ maths */
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, u) => a + (b - a) * u;
const ss = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
const backOut = u => { const c = 1.9; u = clamp(u, 0, 1) - 1; return 1 + (c + 1) * u * u * u + c * u * u; };
function h(n, seed) {
  let x = (n | 0) ^ Math.imul(seed | 0, 0x9E3779B1);
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B); x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  x ^= x >>> 16; return (x >>> 0) / 4294967296;
}
const h2 = (x, y, s) => h(Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263), s);
function vn(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(h(i, s), h(i + 1, s), u); }
function vn2(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(h2(ix, iy, s), h2(ix + 1, iy, s), ux), lerp(h2(ix, iy + 1, s), h2(ix + 1, iy + 1, s), ux), uy);
}
function fbm(x, y, o, s) { let a = 0, w = 0.5, t = 0; for (let i = 0; i < o; i++) { a += w * vn2(x, y, s + i * 17); t += w; x *= 2.03; y *= 2.03; w *= 0.5; } return a / t; }

/* ------------------------------------------------------------ canvases */
const mk = (w, hh) => { const c = document.createElement('canvas'); c.width = w; c.height = hh; return c; };
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const layer = mk(W, H), lx = layer.getContext('2d');
let paper, mottle, grain, ready = false;

/* ------------------------------------------------------------ geometry helpers */
function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1]]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-6) continue;
    let d = step - carry;
    while (d <= l) { out.push([a[0] + dx * d / l, a[1] + dy * d / l]); d += step; }
    carry = l - (d - step);
  }
  const e = pts[pts.length - 1], q = out[out.length - 1];
  if (Math.hypot(e[0] - q[0], e[1] - q[1]) > step * 0.4) out.push([e[0], e[1]]);
  return out;
}
function chaikin(pts) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
    out.push([lerp(a[0], b[0], 0.25), lerp(a[1], b[1], 0.25)], [lerp(a[0], b[0], 0.75), lerp(a[1], b[1], 0.75)]); }
  out.push(pts[pts.length - 1]); return out;
}
function ellipsePts(cx, cy, rx, ry, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU - 2.2; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; }
function rrectPts(cx, cy, w, hh, r) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - hh / 2, y1 = cy + hh / 2, o = [];
  const arc = (ax, ay, a0) => { for (let i = 1; i <= 5; i++) { const a = a0 + i / 5 * Math.PI / 2; o.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r]); } };
  const edge = (ax, ay, bx, by) => { const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / 14)); for (let i = 0; i < n; i++) o.push([lerp(ax, bx, i / n), lerp(ay, by, i / n)]); };
  edge(x0 + r, y0, x1 - r, y0); o.push([x1 - r, y0]); arc(x1 - r, y0 + r, -Math.PI / 2);
  edge(x1, y0 + r, x1, y1 - r); o.push([x1, y1 - r]); arc(x1 - r, y1 - r, 0);
  edge(x1 - r, y1, x0 + r, y1); o.push([x0 + r, y1]); arc(x0 + r, y1 - r, Math.PI / 2);
  edge(x0, y1 - r, x0, y0 + r); o.push([x0, y0 + r]); arc(x0 + r, y0 + r, Math.PI);
  return o;
}
/* displace a closed loop along its normals with seamless low-frequency noise */
function wob(pts, seed, amp, flen) {
  const n = pts.length; let total = 0; const L = [];
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; L.push(total); total += Math.hypot(q[0] - p[0], q[1] - p[1]); }
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], q = pts[(i + 1) % n];
    const tx = q[0] - a[0], ty = q[1] - a[1], l = Math.hypot(tx, ty) || 1, s = L[i], u = s / total;
    const d = amp * ((1 - u) * (vn(s / flen, seed) * 2 - 1) + u * (vn((s - total) / flen, seed) * 2 - 1));
    out.push([p[0] + ty / l * d, p[1] - tx / l * d]);
  }
  return out;
}
function smoothClosed(c, P) {
  const n = P.length; c.beginPath(); c.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
  for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  c.closePath();
}
function blob(c, pts, seed, amp, flen, col, alpha) {
  c.globalAlpha = alpha == null ? 1 : alpha; c.fillStyle = col; smoothClosed(c, wob(pts, seed, amp, flen)); c.fill(); c.globalAlpha = 1;
}
function rim(c, pts, seed, amp, flen, col, alpha, w) {
  c.save(); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = w;
  smoothClosed(c, wob(pts, seed, amp, flen)); c.stroke(); c.restore();
}

/* ------------------------------------------------------------ the ink line
   a ribbon of varying width (pen pressure) wandering off the true path */
function ink(c, pts, o) {
  const step = 4, P = resample(pts, step), n = P.length; if (n < 2) return;
  const seed = o.seed | 0, w = o.w || 3, wb = o.wob == null ? 2 : o.wob;
  const i0 = Math.floor((o.from || 0) * (n - 1)), i1 = Math.ceil((o.to == null ? 1 : o.to) * (n - 1));
  if (i1 - i0 < 1) return;
  const Lp = [], Rp = [];
  for (let i = i0; i <= i1; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)], p = P[i];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const s = i * step;
    const d = wb * ((vn(s / 34, seed) * 2 - 1) + 0.4 * (vn(s / 9, seed + 3) * 2 - 1));
    const e = wb * 0.5 * (vn(s / 26, seed + 5) * 2 - 1);
    const x = p[0] - ty * d + tx * e, y = p[1] + tx * d + ty * e;
    const ends = Math.min(1, 0.3 + (i - i0) * step / 22, 0.3 + (i1 - i) * step / 16);
    const hw = 0.5 * w * (0.55 + 0.9 * vn(s / 52, seed + 9)) * (o.taper === false ? 1 : ends);
    Lp.push([x - ty * hw, y + tx * hw]); Rp.push([x + ty * hw, y - tx * hw]);
  }
  c.globalAlpha = o.alpha == null ? 1 : o.alpha; c.fillStyle = o.col || C.ink;
  c.beginPath(); c.moveTo(Lp[0][0], Lp[0][1]);
  for (let i = 1; i < Lp.length; i++) c.lineTo(Lp[i][0], Lp[i][1]);
  for (let i = Rp.length - 1; i >= 0; i--) c.lineTo(Rp[i][0], Rp[i][1]);
  c.closePath(); c.fill(); c.globalAlpha = 1;
}
/* the sketcher goes over a line twice */
function ink2(c, pts, o) {
  ink(c, pts, o);
  ink(c, pts, Object.assign({}, o, { seed: o.seed + 71, w: (o.w || 3) * 0.55, wob: (o.wob == null ? 2 : o.wob) * 1.7, alpha: (o.alpha == null ? 1 : o.alpha) * 0.6 }));
}

/* ------------------------------------------------------------ paint layer */
function begin() { lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over'; lx.clearRect(0, 0, W, H); }
function finish(o) {
  o = o || {};
  lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'destination-out';
  if (o.mottle) { lx.globalAlpha = o.mottle; lx.drawImage(mottle, o.mx || 0, o.my || 0, W * 1.3, H * 1.3); }
  if (o.grain) { lx.globalAlpha = o.grain; lx.drawImage(grain, 0, 0); }
  lx.globalAlpha = 1; lx.globalCompositeOperation = 'source-over';
  const t = o.target || ctx;
  t.save(); t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = o.op || 'source-over';
  if (o.halo) { t.filter = 'blur(' + (o.haloR || 7) + 'px)'; t.globalAlpha = o.halo; t.drawImage(layer, o.dx || 0, o.dy || 0); t.filter = 'none'; }
  t.globalAlpha = o.alpha == null ? 1 : o.alpha; t.drawImage(layer, o.dx || 0, o.dy || 0);
  t.restore();
}

/* ------------------------------------------------------------ paper & textures (built once) */
function build() {
  // mottle: cloudy pigment density, half-res
  mottle = mk(960, 540);
  { const c = mottle.getContext('2d'), id = c.createImageData(960, 540), d = id.data;
    for (let y = 0, k = 0; y < 540; y++) for (let x = 0; x < 960; x++, k += 4) {
      const v = fbm(x / 46, y / 46, 3, 301) * 0.75 + vn2(x / 5, y / 5, 77) * 0.25;
      d[k + 3] = clamp((v - 0.36) * 2.4, 0, 1) * 255; }
    c.putImageData(id, 0, 0); }
  // grain: tooth of the paper, as dark-paper-coloured speckle
  grain = mk(W, H);
  { const c = grain.getContext('2d'), id = c.createImageData(W, H), d = id.data;
    for (let y = 0, k = 0; y < H; y++) for (let x = 0; x < W; x++, k += 4) {
      const v = vn2(x / 2.1, y / 2.1, 5) * 0.55 + h2(x, y, 9) * 0.3 + vn2(x / 7, y / 3.1, 13) * 0.15;
      d[k] = 9; d[k + 1] = 7; d[k + 2] = 24; d[k + 3] = clamp((v - 0.5) * 2.6, 0, 1) * 255; }
    c.putImageData(id, 0, 0); }
  // paper
  paper = mk(W, H);
  const c = paper.getContext('2d');
  { const id = c.createImageData(W, H), d = id.data;
    for (let y = 0, k = 0; y < H; y++) for (let x = 0; x < W; x++, k += 4) {
      const cloud = fbm(x / 380, y / 380, 3, 11), mid = fbm(x / 34, y / 34, 2, 23);
      const tooth = vn2(x / 2.2, y / 2.2, 5), px = h2(x, y, 7);
      const vx = (x - W / 2) / (W / 2), vy = (y - H / 2) / (H / 2);
      const vig = 1 - 0.42 * Math.pow(clamp(vx * vx * 0.75 + vy * vy * 0.9, 0, 1.6), 1.15);
      const l = (1 + (cloud - 0.5) * 0.55 + (mid - 0.5) * 0.2 + (tooth - 0.5) * 0.34 + (px - 0.5) * 0.3) * vig;
      d[k] = 13 * l + (cloud - 0.5) * 5; d[k + 1] = 10 * l; d[k + 2] = 36 * l + (cloud - 0.5) * 14; d[k + 3] = 255; }
    c.putImageData(id, 0, 0); }
  // big loose indigo/violet washes with tide lines and back-runs
  const W1 = ellipsePts(960, 548, 720, 360, 40), W2 = ellipsePts(1050, 500, 470, 300, 30), W3 = ellipsePts(700, 640, 420, 190, 26);
  begin();
  blob(lx, W1, 41, 70, 420, 'rgb(40,30,104)'); rim(lx, W1, 41, 70, 420, 'rgb(96,80,186)', 0.55, 7);
  finish({ target: c, alpha: 0.2, mottle: 0.9, grain: 0.5, halo: 0.3, haloR: 18 });
  begin();
  blob(lx, W2, 43, 55, 300, 'rgb(62,40,128)'); rim(lx, W2, 43, 55, 300, 'rgb(120,92,200)', 0.5, 6);
  blob(lx, W3, 47, 45, 260, 'rgb(34,34,118)'); rim(lx, W3, 47, 45, 260, 'rgb(92,90,196)', 0.5, 6);
  for (let i = 0; i < 7; i++) { // back-runs (cauliflower blooms)
    const bx = 330 + h(i, 51) * 1260, by = 250 + h(i, 52) * 560, r = 30 + h(i, 53) * 70, B = ellipsePts(bx, by, r, r * 0.8, 14);
    lx.globalCompositeOperation = 'destination-out'; blob(lx, B, 60 + i, r * 0.3, 60, '#000', 0.5);
    lx.globalCompositeOperation = 'source-over'; rim(lx, B, 60 + i, r * 0.3, 60, 'rgb(130,110,214)', 0.5, 4);
  }
  finish({ target: c, alpha: 0.17, mottle: 0.9, mx: -300, my: -120, grain: 0.5, halo: 0.3, haloR: 14 });
  // fibres and a little old spatter
  for (let i = 0; i < 1500; i++) {
    const x = h(i, 81) * W, y = h(i, 82) * H, a = h(i, 83) * TAU, l = 6 + h(i, 84) * 22, k = (h(i, 85) - 0.5) * 12;
    c.strokeStyle = 'rgba(170,160,235,' + (0.025 + h(i, 86) * 0.05) + ')'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l / 2 - Math.sin(a) * k, y + Math.sin(a) * l / 2 + Math.cos(a) * k, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  for (let i = 0; i < 46; i++) {
    c.fillStyle = 'rgba(190,178,246,' + (0.08 + h(i, 93) * 0.2) + ')';
    c.beginPath(); c.arc(h(i, 91) * W, h(i, 92) * H, 0.7 + h(i, 94) * h(i, 95) * 3, 0, TAU); c.fill();
  }
  ready = true;
}

/* ------------------------------------------------------------ hand-lettered stroke font (4 x 6 grid) */
const G = {
  '0': [[[1, 0], [3, 0], [4, 1.5], [4, 4.5], [3, 6], [1, 6], [0, 4.5], [0, 1.5], [1, 0], [1.6, -0.1]]],
  '1': [[[0.8, 1.4], [2, 0], [2, 6]], [[0.8, 6], [3.2, 6]]],
  '2': [[[0, 1.3], [1, 0], [3, 0], [4, 1.3], [4, 2.4], [0, 6], [4, 6]]],
  '3': [[[0, 0.8], [1, 0], [3, 0], [4, 1.2], [3, 2.8], [1.6, 2.9], [3, 3], [4, 4.4], [3, 6], [1, 6], [0, 5.1]]],
  '4': [[[3, 6], [3, 0], [0, 4], [4, 4]]],
  '5': [[[4, 0], [0.4, 0], [0.2, 2.6], [2.6, 2.4], [4, 3.6], [4, 4.8], [3, 6], [1, 6], [0, 5.1]]],
  '6': [[[3.8, 0.6], [2.6, 0], [1.2, 0.4], [0, 2.4], [0, 4.8], [1, 6], [3, 6], [4, 4.8], [4, 3.8], [3, 2.8], [1.2, 2.8], [0, 3.8]]],
  '7': [[[0, 0], [4, 0], [1.6, 6]]],
  '8': [[[2, 2.8], [0.4, 1.8], [0.6, 0.6], [2, 0], [3.4, 0.6], [3.6, 1.8], [2, 2.8], [0, 4.2], [0.4, 5.5], [2, 6], [3.6, 5.5], [4, 4.2], [2, 2.8]]],
  '9': [[[4, 2.4], [3, 3.3], [1.2, 3.3], [0, 2.2], [0, 1.2], [1, 0], [3, 0], [4, 1.2], [4, 3.6], [2.8, 5.6], [1.4, 6], [0.3, 5.4]]],
  A: [[[0, 6], [2, 0], [4, 6]], [[0.9, 4], [3.1, 4]]],
  G: [[[4, 1.2], [3, 0], [1, 0], [0, 1.5], [0, 4.5], [1, 6], [3, 6], [4, 4.8], [4, 3.2], [2.2, 3.2]]],
  E: [[[4, 0], [0, 0], [0, 6], [4, 6]], [[0, 3], [3, 3]]],
  N: [[[0, 6], [0, 0], [4, 6], [4, 0]]],
  T: [[[0, 0], [4, 0]], [[2, 0], [2, 6]]],
  S: [[[4, 1], [3, 0], [1, 0], [0, 1.2], [0.6, 2.6], [3.4, 3.4], [4, 4.8], [3, 6], [1, 6], [0, 5]]],
  I: [[[2, 0], [2, 6]], [[1, 0], [3, 0]], [[1, 6], [3, 6]]],
  M: [[[0, 6], [0, 0], [2, 3.4], [4, 0], [4, 6]]]
};
function text(c, str, x, y, s, o, reveal) {
  const n = str.length;
  for (let i = 0; i < n; i++) {
    const g = G[str[i]]; if (!g) continue;
    const r = reveal == null ? 1 : clamp(reveal * n - i, 0, 1); if (r <= 0) continue;
    const jy = (h(i, o.seed + 500) - 0.5) * s * 0.7, sl = (h(i, o.seed + 501) - 0.5) * 0.12;
    for (let k = 0; k < g.length; k++) {
      const pts = chaikin(g[k]).map(p => [x + i * 5.7 * s + (p[0] - (p[1] - 3) * (0.1 + sl)) * s, y + jy + p[1] * s]);
      ink(c, pts, { seed: o.seed + i * 13 + k * 5, w: o.w, wob: o.wob, col: o.col, alpha: o.alpha, to: clamp(r * g.length - k, 0, 1) });
    }
  }
}

/* ------------------------------------------------------------ the hero */
const HOPS = [[-0.12, 0.30, -150, 230, 122], [0.34, 0.72, 230, 530, 104], [0.76, 1.12, 530, CHX, 82], [1.95, 2.22, CHX, CHX, 60]];
function kf(K, t) { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t < K[i][0]) return lerp(K[i - 1][1], K[i][1], ss(K[i - 1][0], K[i][0], t)); return K[K.length - 1][1]; }
const EX = [[0, 7], [1.15, 7], [1.3, 11], [1.5, 11], [1.58, -11], [1.68, -11], [1.76, 9], [1.92, 10], [1.98, 3], [2.25, 8], [2.5, 10], [3, 10]];
const EY = [[0, 0], [1.15, 0], [1.3, 3], [1.5, 3], [1.58, 0], [1.68, 0], [1.76, -5], [1.92, 2], [1.98, -3], [2.25, -7], [2.5, -10], [3, -11]];
function pose(t) {
  let x = HOPS[0][2], lift = 0, sy = 1, lean = 0, air = 0, land = 0;
  for (let i = 0; i < HOPS.length; i++) {
    const [a, b, x0, x1, hh] = HOPS[i];
    if (t >= a && t < b) { const u = (t - a) / (b - a); x = lerp(x0, x1, u); lift = 4 * hh * u * (1 - u); air = Math.sin(Math.PI * u);
      sy += 0.1 * air * (u < 0.5 ? 1 : 0.5); lean += (x1 !== x0 ? 0.085 : -0.03) * Math.cos(Math.PI * u); }
    else if (t >= b) { x = x1; const dt = t - b; sy -= 0.17 * Math.exp(-dt * 15) * Math.cos(dt * 30); land = Math.max(land, 1 - dt / 0.22); }
  }
  sy -= 0.1 * ss(1.86, 1.94, t) * (1 - ss(1.94, 1.97, t));                 // anticipation before the call
  sy += 0.012 * Math.sin(t * 8.5) * ss(1.2, 1.3, t);                       // breathing
  lean += 0.035 * ss(1.25, 1.4, t) * (1 - ss(1.5, 1.6, t)) - 0.03 * ss(1.55, 1.62, t) * (1 - ss(1.68, 1.78, t));
  const blink = Math.max(1 - Math.abs(t - 1.85) / 0.055, 1 - Math.abs(t - 2.72) / 0.05, 0);
  const mouth = ss(1.94, 2.0, t) * (1 - ss(2.3, 2.42, t));
  const arm = ss(1.92, 2.03, t) * (1 - 0.25 * ss(2.5, 2.9, t)) + 0.06 * Math.sin(t * 11) * ss(2.2, 2.4, t);
  return { x, lift, sy, sx: 1 + (1 - sy) * 0.75, lean, air, land, blink: clamp(blink * 1.6, 0, 1), mouth, arm, ex: kf(EX, t), ey: kf(EY, t) };
}
function capsule(ax, ay, ang, len, hw, closed) {
  const dx = Math.cos(ang), dy = Math.sin(ang), o = [];
  o.push([ax - dy * hw * -1, ay + dx * hw * -1]);
  const tx = ax + dx * (len - hw), ty = ay + dy * (len - hw);
  for (let i = 0; i <= 8; i++) { const a = ang - Math.PI / 2 + i / 8 * Math.PI; o.push([tx + Math.cos(a) * hw, ty + Math.sin(a) * hw]); }
  o.push([ax - dy * hw, ay + dx * hw]);
  if (closed) o.push([ax - dx * hw, ay - dy * hw]);
  return o;
}
function drawHero(t, b, bw, open) {
  const p = pose(t), gx = p.x, gy = GROUND - p.lift;
  const w = BW * p.sx, hh = BH * p.sy, lg = LEG * p.sy, yb = -lg, yt = yb - hh, cy = (yb + yt) / 2;
  const foot = -lg * 0.32 * p.air;
  const T = c => { c.setTransform(1, 0, 0, 1, gx, gy); c.rotate(p.lean); };
  const legU = (x, far) => { const hw = far ? 18 : 20, bt = foot - (far ? 5 : 0), sw = (far ? -1 : 1) * 7 * p.air * (x < 0 ? -1 : 1), top = yb - 10;
    return [[x - hw, top], [x - hw + sw * 0.4, bt - 10], [x - hw + 4 + sw, bt - 2], [x - hw + 10 + sw, bt], [x + hw - 10 + sw, bt], [x + hw - 4 + sw, bt - 2], [x + hw + sw * 0.4, bt - 10], [x + hw, top]]; };
  const legs = [[-36, 1], [38, 1], [-90, 0], [90, 0]].map(l => [legU(l[0] * p.sx, l[1]), l[1]]);
  const la = capsule(-w / 2 + 12, cy + 8, Math.PI - 0.25 + 0.7 * p.air * (1 - p.arm), 46, 19);
  const ra = capsule(w / 2 - 12 - 8 * p.arm, lerp(cy + 8, yt + 36, p.arm), lerp(0.25 - 0.7 * p.air, -1.02, p.arm), lerp(46, 62, p.arm), 19);

  // --- limbs: paint, then ink
  begin(); T(lx);
  for (const [L, far] of legs) blob(lx, L, 200 + bw + (far ? 3 : 0), 1.6, 40, far ? '#8a4330' : C.coral);
  blob(lx, la, 210 + bw, 1.6, 40, C.shade); blob(lx, ra, 212 + bw, 1.6, 40, C.coral);
  lx.save(); lx.globalCompositeOperation = 'source-atop';
  ink(lx, [[ra[2][0], ra[2][1]], [ra[5][0], ra[5][1]]], { seed: 214 + bw, w: 9, col: C.light, alpha: 0.7, wob: 1 });
  for (const [L, far] of legs) if (!far) ink(lx, [[L[1][0] + 6, L[1][1] - 6], [L[3][0], L[3][1] - 5], [L[4][0] + 4, L[4][1] - 5]], { seed: 216 + bw, w: 9, col: C.shade, alpha: 0.55, wob: 1 });
  lx.restore();
  finish({ mottle: 0.12, mx: -gx * 0.15, grain: 0.22, dx: 2, dy: 3, halo: 0.3, haloR: 5 });
  T(ctx);
  for (const [L, far] of legs) ink2(ctx, L, { seed: 220 + b * 7 + (far ? 1 : 0) + Math.round(L[0][0]), w: far ? 2.6 : 3.4, wob: 1.5, alpha: far ? 0.8 : 1 });
  ink2(ctx, la, { seed: 230 + b * 7, w: 3.2, wob: 1.5 }); ink2(ctx, ra, { seed: 233 + b * 7, w: 3.4, wob: 1.5 });

  // --- body: gouache, slightly off-register, bleeding past the line
  const body = rrectPts(0, cy, w, hh, 36);
  begin(); T(lx);
  blob(lx, body, 240 + bw, 4.5, 90, C.coral);
  rim(lx, body, 240 + bw, 4.5, 90, C.shade, 0.45, 12);
  const band = [[-w / 2 - 5, yb - hh * 0.3], [-w * 0.2, yb - hh * 0.25], [w * 0.15, yb - hh * 0.3], [w / 2 + 5, yb - hh * 0.26], [w / 2 + 4, yb - 12], [w / 2 - 22, yb + 5], [0, yb + 6], [-w / 2 + 22, yb + 5], [-w / 2 - 4, yb - 12]];
  blob(lx, band, 244 + bw, 5, 70, C.shade, 0.62);
  ink(lx, [[-w / 2 + 30, yt + 17], [0, yt + 14], [w / 2 - 62, yt + 16]], { seed: 246 + bw, w: 13, col: C.light, alpha: 0.85, wob: 2 });
  ink(lx, [[w / 2 - 44, yt + 16], [w / 2 - 30, yt + 18]], { seed: 247 + bw, w: 11, col: C.light, alpha: 0.85, wob: 1 });
  ink(lx, [[-w / 2 + 16, yt + 40], [-w / 2 + 15, yt + 78]], { seed: 248 + bw, w: 8, col: C.light, alpha: 0.4, wob: 2 });
  if (open > 0.02) ink(lx, [[w / 2 - 13, yt + 34], [w / 2 - 11, cy + 10], [w / 2 - 14, yb - 22]], { seed: 249 + bw, w: 12, col: C.hot, alpha: 0.62 * open, wob: 2 });
  finish({ mottle: 0.12, mx: -gx * 0.15 - 90, my: -40, grain: 0.22, dx: 3, dy: 2, halo: 0.32, haloR: 6 });
  T(ctx);
  ink2(ctx, body.concat(body.slice(0, 5)), { seed: 250 + b * 7, w: 3.8, wob: 2.1 });

  // --- face
  const ecy = yt + hh * 0.36 + p.ey, eh = 14 * (1 - p.blink * 0.86);
  for (const sx of [-1, 1]) {
    const ex = sx * 56 * p.sx + p.ex;
    if (p.blink > 0.75) ink(ctx, [[ex - 10, ecy + 2], [ex, ecy + 5], [ex + 10, ecy + 2]], { seed: 260 + b + sx, w: 4, col: C.eye, wob: 0.8 });
    else {
      blob(ctx, ellipsePts(ex, ecy, 9.2, eh, 14), 262 + b * 3 + sx, 1.1, 14, C.eye);
      if (p.blink < 0.4) { ctx.fillStyle = '#fff6ee'; ctx.beginPath(); ctx.ellipse(ex - 3.2 + p.ex * 0.08, ecy - 5.5, 3, 3.4, 0.3, 0, TAU); ctx.fill(); }
    }
  }
  if (p.mouth > 0.04) {
    const mw = 22 + 3 * p.mouth, mh = 3 + 14 * p.mouth, my = yt + hh * 0.66, mx = p.ex * 0.5;
    const M = rrectPts(mx, my, mw * 2, mh * 2, Math.min(mh, 11) * 0.95);
    blob(ctx, M, 270 + b * 3, 1.2, 20, '#1b0a10');
    if (p.mouth > 0.6) blob(ctx, ellipsePts(mx + 2, my + mh * 0.62, mw * 0.55, mh * 0.34, 10), 272 + b * 3, 1, 12, C.shade, 0.9);
    ink(ctx, M.concat(M.slice(0, 3)), { seed: 274 + b * 5, w: 2.4, wob: 1, col: C.dark });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { p, tip: (() => { const q = ra[5], cs = Math.cos(p.lean), sn = Math.sin(p.lean); return [gx + q[0] * cs - q[1] * sn, gy + q[0] * sn + q[1] * cs]; })() };
}

/* ------------------------------------------------------------ agents: flicked gouache that finds its purpose */
const LANES = [-0.88, -0.52, -0.17, 0.19, 0.54, 0.9], NPOOL = 1000;
const tEmit = i => 2.12 + 0.88 * Math.pow((i + 1) / 250, 0.78);
const ACOL = [C.coral, C.coral, C.coral, C.light, C.light, C.shade, C.hot, C.coral, C.light, C.hot];
function agentPos(i, a) {
  const lane = i % LANES.length, th = LANES[lane];
  const a0 = th * 0.5 + (h(i, 602) - 0.5) * 0.52, sp = 1000 + h(i, 603) * 900, k = 3.3, g = 950;
  const e = (1 - Math.exp(-k * a)) / k;
  const bx = MOUTH[0] + (h(i, 606) - 0.5) * 70 + Math.sin(a0) * sp * e;
  const by = MOUTH[1] - Math.cos(a0) * sp * e + g * (a / k - e / k);
  // the lane: a curling stream the agents fall into, two abreast
  const ang = th * (0.72 + 0.42 * a), R = 170 + 300 * a, side = ((i / LANES.length | 0) % 2 ? 1 : -1) * 6;
  const lxp = MOUTH[0] + Math.sin(ang) * R + Math.cos(ang) * side, lyp = MOUTH[1] - 20 - Math.cos(ang) * R + Math.sin(ang) * side;
  const m = ss(0.3, 0.72, a);
  return [lerp(bx, lxp, m), lerp(by, lyp, m), m];
}
function drawAgents(t, b) {
  let n = 0;
  for (let i = 0; i < NPOOL; i++) {
    const te = tEmit(i); if (te > t) break; n++;
    const a = t - te, P = agentPos(i, a), Q = agentPos(i, Math.max(0, a - 0.012));
    let ux = P[0] - Q[0], uy = P[1] - Q[1]; const d = Math.hypot(ux, uy), sp = d / 0.012; if (d > 1e-6) { ux /= d; uy /= d; } else { ux = 0; uy = -1; }
    const big = h(i, 611), m = P[2], dot = h(i, 612) < 0.28;
    const r = lerp(1.5 + big * big * big * 4.6, 2.5, m * 0.8) * (0.9 + 0.2 * h(i, 620 + b)) * ss(0, 0.05, a + 0.02);
    const L = dot ? 0 : lerp(clamp(sp * 0.034, 0, 46) * (0.6 + 0.8 * h(i, 613)), 13, m);
    const x = P[0] + (h(i, 630 + b) - 0.5) * 1.6, y = P[1] + (h(i, 640 + b) - 0.5) * 1.6;
    ctx.fillStyle = a < 0.07 ? C.hot : ACOL[Math.floor(h(i, 614) * ACOL.length)];
    ctx.globalAlpha = 0.96;
    ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.84 + 0.16 * h(i, 615)), Math.atan2(uy, ux), 0, TAU); ctx.fill();
    if (L > r) { const tw = lerp(0.25, 0.8, m) * r; // flick: tapering tail; in the lane: an even dash
      ctx.beginPath(); ctx.moveTo(x - uy * r * 0.92, y + ux * r * 0.92); ctx.lineTo(x - ux * L - uy * tw, y - uy * L + ux * tw);
      ctx.lineTo(x - ux * L + uy * tw, y - uy * L - ux * tw); ctx.lineTo(x + uy * r * 0.92, y - ux * r * 0.92); ctx.fill();
      if (m > 0.3) { ctx.beginPath(); ctx.arc(x - ux * L, y - uy * L, tw, 0, TAU); ctx.fill(); } }
    if (h(i, 616) < 0.16 && a > 0.05 && m < 0.5) { ctx.beginPath(); ctx.arc(x - ux * (L + 6 + 8 * h(i, 617)) + uy * 3, y - uy * (L + 6) - ux * 3, r * 0.38, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  return n;
}

/* ------------------------------------------------------------ one frame */
function render(t) {
  if (!ready) build();
  t = clamp(t, 0, DUR);
  const f = Math.floor(t * FPS + 1e-6), b = Math.floor(f * 2 / 5), bw = Math.floor(f / 4);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.drawImage(paper, 0, 0);
  const open = backOut((t - 2.08) / 0.34) * (t > 2.08 ? 1 : 0);
  const P0 = pose(t);

  // ground: one loose pencil-ish line
  ink(ctx, [[330, GROUND + 3], [700, GROUND + 1], [1180, GROUND + 4], [1590, GROUND + 2]], { seed: 100 + bw, w: 2, wob: 2.4, col: C.lilac, alpha: 0.24 });

  // shadows
  begin();
  const shw = 150 * (1 - 0.4 * P0.lift / 122);
  blob(lx, ellipsePts(P0.x, GROUND + 9, shw, 13, 18), 110 + bw, 3, 50, '#04030d', 0.75);
  blob(lx, ellipsePts((FX0 + FX1) / 2 + 8, GROUND + 9, 150, 12, 18), 112 + bw, 3, 50, '#04030d', 0.7 * ss(0.15, 0.5, t));
  finish({ mottle: 0.35, grain: 0.3, halo: 0.4, haloR: 5 });
  for (let i = 0; i < 7; i++) { const x = P0.x - shw * 0.7 + i * shw * 0.22;
    ink(ctx, [[x, GROUND + 15], [x + 13, GROUND + 5]], { seed: 120 + i + b * 3, w: 1.6, wob: 1, col: C.lilac, alpha: 0.3 }); }

  // folder: wash first, then the quick ink sketch on top
  const fy = FYF + open * 62, sh = open * 26, dr = t / 0.5;
  const back = [[FX0, FY1], [FX0, FY0 + 5], [FX0 + 7, FY0], [FX0 + TABW, FY0], [FX0 + TABW + 20, FY0 + TABH], [FX1, FY0 + TABH], [FX1, FY1]];
  const front = [[FX0 + sh, fy], [FX1 + sh, fy], [FX1, FY1], [FX0, FY1]];
  const wr = ss(0.1, 0.55, t);
  if (wr > 0) {
    begin();
    lx.save(); lx.beginPath(); lx.rect(FX0 - 60, FY0 - 60, (FX1 - FX0 + 120) * wr * 1.05, 300); lx.clip();
    const bk = resample(back.concat([back[0]]), 22); bk.pop();
    blob(lx, bk, 130 + bw, 7, 110, 'rgb(66,54,146)'); rim(lx, bk, 130 + bw, 7, 110, 'rgb(150,132,240)', 0.55, 7);
    lx.restore();
    finish({ alpha: 0.42, mottle: 0.8, mx: -200, my: -200, grain: 0.4, dx: -5, dy: 4, halo: 0.3, haloR: 8 });
  }
  const FI = (pts, seed, a0, a1, o) => ink2(ctx, pts, Object.assign({ seed: seed + b * 7, w: 3, wob: 1.9, col: C.lilac, to: clamp((dr - a0) / (a1 - a0), 0, 1) }, o || {}));
  FI([[FX0 - 2, FY1 + 9], back[1], back[2], back[3], back[4], [FX1 + 12, FY0 + TABH - 1]], 140, 0, 0.55);
  FI([[FX1 + 1, FY0 + TABH - 9], [FX1 - 1, FY1 + 8]], 143, 0.5, 0.72);
  FI([[FX1 + 10, FY1], [FX0 - 11, FY1 + 1]], 146, 0.66, 0.9);

  // warm light inside
  if (open > 0.01) {
    begin();
    const g = clamp(open, 0, 1.1), cx = MOUTH[0], cyy = MOUTH[1];
    const gg = clamp(g, 0, 1);
    // soft bloom first (blurred), then two loose plumes of wash with tide lines, then the hot mouth
    lx.filter = 'blur(38px)';
    blob(lx, ellipsePts(cx + 4, cyy - 130 * g, 250 * g, 300 * g, 20), 150 + bw, 20, 200, C.shade, 0.5 * gg);
    blob(lx, ellipsePts(cx, cyy - 50 * g, 150 * g, 150 * g, 16), 151 + bw, 10, 200, C.coral, 0.6 * gg);
    lx.filter = 'none';
    const P1 = ellipsePts(cx + 14, cyy - 150 * g, 205 * g, 265 * g, 26), P2 = ellipsePts(cx - 6, cyy - 62 * g, 118 * g, 132 * g, 20);
    blob(lx, P1, 152 + bw, 34 * g, 170, C.shade, 0.2 * gg); rim(lx, P1, 152 + bw, 34 * g, 170, C.light, 0.16, 5);
    blob(lx, P2, 154 + bw, 20 * g, 120, C.coral, 0.26 * gg); rim(lx, P2, 154 + bw, 20 * g, 120, C.hot, 0.2, 4);
    const inner = resample([[FX0 + 10, FY0 + TABH + 10], [FX1 - 10, FY0 + TABH + 10], [FX1 + sh - 5, fy], [FX0 + sh + 5, fy], [FX0 + 10, FY0 + TABH + 10]], 18); inner.pop();
    blob(lx, inner, 158 + bw, 3, 60, C.light, 0.75 * gg);
    lx.filter = 'blur(10px)'; blob(lx, ellipsePts(cx, fy - 10, 80, 26 * g, 14), 159 + bw, 4, 60, C.hot, 0.9 * gg); lx.filter = 'none';
    finish({ op: 'screen', mottle: 0.5, mx: -420, my: -260, grain: 0.25 });
  }

  const count = drawAgents(t, b);

  // folder front panel
  if (wr > 0) {
    begin();
    lx.save(); lx.beginPath(); lx.rect(FX0 - 60, FY0 - 60, (FX1 - FX0 + 120) * wr * 1.05, 300); lx.clip();
    const fr = resample(front.concat([front[0]]), 20); fr.pop();
    blob(lx, fr, 160 + bw, 5, 90, 'rgb(86,72,176)'); rim(lx, fr, 160 + bw, 5, 90, 'rgb(170,150,250)', 0.6, 6);
    lx.restore();
    finish({ alpha: 0.42 + 0.2 * clamp(open, 0, 1), mottle: 0.7, mx: -500, my: -300, grain: 0.4, dx: 4, dy: 3, halo: 0.25, haloR: 6 });
  }
  FI([[FX0 - 7 + sh, fy + 1], [FX1 + 9 + sh, fy - 1]], 170, 0.72, 0.92, { col: open > 0.3 ? '#cfc2ff' : C.lilac });
  if (open > 0.05) { FI([[FX0 + sh, fy - 3], [FX0, FY1 + 3]], 173, 0, 0.1); FI([[FX1 + sh + 1, fy - 4], [FX1, FY1 + 4]], 176, 0, 0.1); }
  for (let i = 0; i < 6; i++) { const q = 14 + i * 15, top = Math.max(fy + 8, FY1 - 12 - q);
    ink(ctx, [[FX1 - 12 - q, FY1 - 9], [FX1 - 12 - q + (FY1 - 9 - top), top]].map((pp, k) => k ? [Math.min(pp[0], FX1 - 9), Math.max(pp[1], FY1 - 9 - (FX1 - 9 - (FX1 - 12 - q)))] : pp),
      { seed: 180 + i + b * 3, w: 1.7, wob: 1, col: C.lilac, alpha: 0.55, to: clamp((dr - 0.8 - i * 0.03) / 0.12, 0, 1) }); }

  // "0 ITEMS", hand-lettered under the folder
  const ta = 1 - ss(2.15, 2.5, t);
  if (ta > 0) text(ctx, '0 ITEMS', 1046, 736, 4.4, { seed: 300 + b * 7, w: 2.4, wob: 0.9, col: C.lilac, alpha: 0.85 * ta }, clamp((t - 0.22) / 0.33, 0, 1));

  // hero
  const hero = drawHero(t, b, bw, clamp(open, 0, 1));

  // landing ticks
  for (let i = 0; i < HOPS.length; i++) { const dt = t - HOPS[i][1]; if (dt < 0 || dt > 0.24) continue; const u = dt / 0.24, x = HOPS[i][3];
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const x0 = x + s * (150 + k * 22 + u * 30), y0 = GROUND - 6 - k * 13 - u * 10;
      ink(ctx, [[x0, y0], [x0 + s * (16 - 10 * u), y0 - 9 + 5 * u]], { seed: 400 + i * 9 + k + b, w: 2.4 * (1 - u * 0.5), wob: 0.8, col: C.ink, alpha: 0.7 }); } }

  // the call: three flicks of gouache off the raised arm
  const cu = (t - 1.97) / 0.4;
  if (cu > 0 && cu < 1) for (let k = 0; k < 3; k++) { const a = -1.5 + k * 0.48, r0 = 18 + 40 * ss(0, 1, cu), l = 34 * Math.sin(Math.PI * Math.min(1, cu * 1.15));
    ink(ctx, [[hero.tip[0] + Math.cos(a) * r0, hero.tip[1] + Math.sin(a) * r0], [hero.tip[0] + Math.cos(a) * (r0 + l), hero.tip[1] + Math.sin(a) * (r0 + l)]],
      { seed: 420 + k + b * 3, w: 5.5, wob: 0.8, col: k === 1 ? C.hot : C.light }); }

  // counter, like a note in the margin
  if (t > 2.1) {
    const r = clamp((t - 2.1) / 0.25, 0, 1);
    text(ctx, 'AGENTS', 96, 84, 4.2, { seed: 320 + b * 7, w: 2.3, wob: 0.9, col: C.lilac, alpha: 0.85 }, r);
    text(ctx, ('0000' + count).slice(-4), 96 + 7.1 * 5.7 * 4.2, 84, 4.2, { seed: 340 + b * 7, w: 2.6, wob: 0.9, col: C.light }, clamp((t - 2.2) / 0.15, 0, 1));
    ink(ctx, [[94, 122], [190, 124], [352, 121]], { seed: 350 + bw, w: 1.6, wob: 1.6, col: C.lilac, alpha: 0.4, to: r });
  }

  // paper tooth shows through everything
  ctx.globalAlpha = 0.13; ctx.drawImage(grain, 0, 0); ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ player */
const q = new URLSearchParams(location.search);
if (q.has('export')) { build(); render(0); window.__piece = { renderAt: render, duration: DUR, isReady: () => ready }; }
else if (q.has('t')) { render(parseFloat(q.get('t')) || 0); }
else { let t0 = null; const tick = ts => { if (t0 === null) t0 = ts; render(((ts - t0) / 1000) % DUR); requestAnimationFrame(tick); }; requestAnimationFrame(tick); }
})();
