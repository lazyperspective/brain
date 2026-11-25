// Linocut that moves: carved block in raking light, paper peeled off revealing the print.
// Everything procedural. Picture coords: S x S canvas, row 0 = top of the printed picture.
const S = 2048;
const OUT = 1080;
const D = 0.02;          // carve depth (world units; block is 2 units wide ~ 20cm)
const TOPY = 0.15;       // block top height
const PW = 2.12;         // paper size (square)

function mulberry(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; }

// ---------------------------------------------------------------- picture
function wobblyPath(ctx, pts, amp, seed) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const n = (vnoise(p[0] * 0.02 + seed, p[1] * 0.02) - 0.5) * amp;
    const m = (vnoise(p[0] * 0.02, p[1] * 0.02 + seed + 7) - 0.5) * amp;
    if (i === 0) ctx.moveTo(p[0] + n, p[1] + m); else ctx.lineTo(p[0] + n, p[1] + m);
  });
  ctx.closePath();
}
// tapered gouge line (V-tool): polyline with width profile, drawn as filled polygon
function gouge(ctx, pts, w0, taper = 0.35) {
  const n = pts.length; if (n < 2) return;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const s = i / (n - 1);
    const w = w0 * Math.min(1, s / taper, (1 - s) / taper) * 0.5 + 0.3;
    L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  ctx.closePath(); ctx.fill();
}
function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rr = i % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
}

const MOON = [0.215 * S, 0.30 * S, 0.072 * S];
const LAMP = [0.80 * S, 0.185 * S];
const HOR = 0.60 * S;
const WL = 0.805 * S; // whale waterline

function drawPicture(ctx, t) {
  const W = '#fff', K = '#000';
  const R = mulberry(1234);
  ctx.fillStyle = K; ctx.fillRect(0, 0, S, S);
  // --- sky: carved horizontal sweeps, wider toward horizon (dusk glow)
  ctx.fillStyle = W;
  for (let y = 0.075 * S, k = 0; y < HOR - 6; k++) {
    const f = (y - 0.075 * S) / (HOR - 0.075 * S);
    const w = lerp(5, 24, Math.pow(f, 1.4));
    let x = 0.04 * S + R() * 60;
    while (x < 0.96 * S) {
      const len = 160 + R() * 480 * (0.4 + f);
      const pts = [];
      for (let i = 0; i <= 12; i++) {
        const xx = x + len * i / 12;
        pts.push([Math.min(xx, 0.965 * S), y + Math.sin(xx * 0.004 + k) * 6 * (1 - f) + (vnoise(xx * 0.01, k) - 0.5) * 6]);
      }
      gouge(ctx, pts, w);
      x += len + 20 + R() * 60 * (1 - f);
    }
    y += lerp(40, 27, f);
  }
  // stars
  const RS = mulberry(77);
  for (let i = 0; i < 14; i++) {
    const x = (0.06 + RS() * 0.55) * S, y = (0.06 + RS() * 0.18) * S;
    ctx.fillStyle = K; ctx.beginPath(); ctx.arc(x, y, 22, 0, 7); ctx.fill();
    ctx.fillStyle = W; star(ctx, x, y, 8 + RS() * 10);
  }
  // --- moon with halo rings
  const [mx, my, mr] = MOON;
  ctx.fillStyle = K; ctx.beginPath(); ctx.arc(mx, my, mr * 2.05, 0, 7); ctx.fill();
  ctx.fillStyle = W;
  for (let ring = 0; ring < 3; ring++) {
    const rr = mr * (1.32 + ring * 0.25);
    for (let a0 = R() * 0.5; a0 < Math.PI * 2; a0 += 0.55 + R() * 0.35) {
      const a1 = a0 + 0.35 + R() * 0.3, pts = [];
      for (let i = 0; i <= 10; i++) { const a = lerp(a0, a1, i / 10); pts.push([mx + Math.cos(a) * rr, my + Math.sin(a) * rr]); }
      gouge(ctx, pts, 9 - ring * 2);
    }
  }
  const mp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2; mp.push([mx + Math.cos(a) * mr, my + Math.sin(a) * mr]); }
  wobblyPath(ctx, mp, 10, 3); ctx.fill();
  ctx.fillStyle = K; // shading: thin uncarved crescents inside the lower-right rim
  for (let k = 0; k < 3; k++) {
    const rr = mr * (0.80 - k * 0.17), pts = [];
    for (let i = 0; i <= 12; i++) { const a = lerp(-0.1 + k * 0.15, 1.75 - k * 0.15, i / 12); pts.push([mx + 8 + Math.cos(a) * rr, my + 6 + Math.sin(a) * rr]); }
    gouge(ctx, pts, 9 - k * 2);
  }
  // --- lighthouse beam (rotating: long/narrow sideways -> short/wide toward viewer)
  const ph = lerp(0.86, 1.22, t / 3) * Math.PI;
  const len = Math.abs(Math.cos(ph)) * 0.85 * S + 0.08 * S;
  const half = 0.035 + 0.22 * Math.pow(Math.abs(Math.sin(ph)), 1.5);
  const dirA = Math.PI + 0.11 - 0.06 * Math.sin(ph);
  const [lx, ly] = LAMP;
  ctx.fillStyle = W;
  ctx.beginPath(); ctx.moveTo(lx, ly);
  ctx.lineTo(lx + Math.cos(dirA - half) * len, ly + Math.sin(dirA - half) * len);
  ctx.quadraticCurveTo(lx + Math.cos(dirA) * len * 1.07, ly + Math.sin(dirA) * len * 1.07, lx + Math.cos(dirA + half) * len, ly + Math.sin(dirA + half) * len);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = K; // uncarved ridges inside the beam
  for (let i = -3; i <= 3; i++) {
    const a = dirA + half * i / 4.2, pts = [];
    for (let j = 0; j <= 10; j++) { const r = lerp(0.12, 0.93, j / 10) * len; pts.push([lx + Math.cos(a) * r, ly + Math.sin(a) * r]); }
    gouge(ctx, pts, 7 - Math.abs(i), 0.45);
  }
  // radiant burst at the lamp
  ctx.fillStyle = W;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * 6.283 + 0.1, r0 = 70, r1 = 120 + (i % 2) * 70 + 60 * Math.abs(Math.sin(ph));
    gouge(ctx, [[lx + Math.cos(a) * r0, ly + Math.sin(a) * r0], [lx + Math.cos(a) * r1, ly + Math.sin(a) * r1]], 10, 0.5);
  }
  // --- cliff
  ctx.fillStyle = K;
  wobblyPath(ctx, [[0.585 * S, HOR + 40], [0.62 * S, 0.56 * S], [0.655 * S, 0.50 * S], [0.70 * S, 0.475 * S], [0.78 * S, 0.465 * S], [0.9 * S, 0.47 * S], [0.97 * S, 0.475 * S], [0.97 * S, S], [0.56 * S, S]], 18, 5);
  ctx.fill();
  ctx.fillStyle = W; // strata
  const RC = mulberry(99);
  for (let i = 0; i < 46; i++) {
    const y = (0.49 + RC() * 0.11) * S; const xl = lerp(0.70, 0.62, (y / S - 0.48) / 0.12) * S;
    const x = xl + 30 + RC() * (0.94 * S - xl - 60), l = 40 + RC() * 120, a = -0.35 + RC() * 0.2;
    gouge(ctx, [[x, y], [x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5 + 6], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 6 + RC() * 6);
  }
  for (let i = 0; i < 40; i++) { // grass ticks on the top edge
    const x = (0.66 + i * 0.0075) * S, y = (0.468 + (x / S < 0.7 ? (0.7 - x / S) * 0.6 : 0)) * S + 14;
    gouge(ctx, [[x, y], [x - 8 + RC() * 6, y - 26 - RC() * 16]], 5);
  }
  // --- lighthouse tower
  const bx = 0.80 * S, by = 0.47 * S, ty = 0.225 * S, wb = 0.04 * S, wt = 0.026 * S;
  ctx.fillStyle = K; ctx.beginPath(); ctx.moveTo(bx - wb - 14, by + 6); ctx.lineTo(bx - wt - 12, ty); ctx.lineTo(bx + wt + 12, ty); ctx.lineTo(bx + wb + 14, by + 6); ctx.fill();
  ctx.fillStyle = W; ctx.beginPath(); ctx.moveTo(bx - wb, by); ctx.lineTo(bx - wt, ty + 8); ctx.lineTo(bx + wt, ty + 8); ctx.lineTo(bx + wb, by); ctx.fill();
  ctx.fillStyle = K;
  [0.39, 0.30].forEach(f => { const y = f * S, w = lerp(wt, wb, (y - ty) / (by - ty)); ctx.fillRect(bx - w - 2, y - 22, 2 * w + 4, 44); });
  ctx.fillRect(bx - 12, 0.43 * S, 24, 40); // door
  ctx.fillRect(bx - wt - 26, ty - 14, 2 * wt + 52, 22); // gallery
  ctx.fillStyle = W; ctx.fillRect(bx - wt + 4, ly - 30, 2 * wt - 8, 62); // lantern glass
  ctx.fillStyle = K; ctx.fillRect(bx - 5, ly - 30, 10, 62);
  ctx.beginPath(); ctx.moveTo(bx - wt - 10, ly - 30); ctx.lineTo(bx, ly - 92); ctx.lineTo(bx + wt + 10, ly - 30); ctx.fill();
  ctx.fillRect(bx - 4, ly - 120, 8, 34);
  // --- sea
  ctx.fillStyle = W;
  gouge(ctx, [[0.035 * S, HOR + 3], [0.3 * S, HOR + 1], [0.6 * S, HOR + 4]], 16, 0.05); // horizon glow
  const RW = mulberry(555);
  for (let y = HOR + 26, k = 0; y < 0.965 * S; k++) {
    const f = (y - HOR) / (0.965 * S - HOR);
    let x = 0.035 * S - RW() * 100;
    while (x < 0.965 * S) {
      const l = lerp(50, 230, f) * (0.6 + RW() * 0.8), pts = [];
      for (let i = 0; i <= 8; i++) { const s = i / 8; pts.push([x + l * s, y - Math.sin(s * Math.PI) * lerp(4, 22, f)]); }
      const nearMoon = Math.exp(-Math.pow((x + l / 2 - mx) / 110, 2));
      gouge(ctx, pts, lerp(7, 18, f) + 12 * nearMoon);
      x += l + lerp(20, 80, f) * (1 - nearMoon * 0.8) * (0.5 + RW());
    }
    y += lerp(22, 52, f);
  }
  // --- boat (bobbing)
  const bxo = 0.50 * S + t * 14, byo = HOR + 10 + Math.sin(t * 2.6) * 6, rock = Math.sin(t * 2.6 + 1) * 0.06;
  ctx.save(); ctx.translate(bxo, byo); ctx.rotate(rock); ctx.scale(1.25, 1.25);
  ctx.fillStyle = K; ctx.beginPath(); ctx.moveTo(-100, -30); ctx.lineTo(100, -30); ctx.lineTo(70, 18); ctx.lineTo(-74, 18); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-14, -210); ctx.lineTo(-2, -210); ctx.lineTo(-2, -30); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-16, -200); ctx.lineTo(-96, -44); ctx.lineTo(-16, -44); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, -196); ctx.lineTo(72, -44); ctx.lineTo(0, -44); ctx.fill();
  ctx.fillStyle = W;
  ctx.beginPath(); ctx.moveTo(-24, -170); ctx.lineTo(-80, -54); ctx.lineTo(-24, -54); ctx.fill();
  ctx.beginPath(); ctx.moveTo(10, -166); ctx.lineTo(58, -54); ctx.lineTo(10, -54); ctx.fill();
  gouge(ctx, [[-80, -12], [70, -12]], 7, 0.2);
  ctx.restore();
  // --- whale back rising
  const rise = sm(0.1, 2.7, t);
  const x0 = 0.25 * S, x1 = 0.77 * S, H = rise * 0.165 * S;
  const back = [];
  for (let i = 0; i <= 60; i++) {
    const s = i / 60; const sh = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.75);
    back.push([lerp(x0, x1, s), WL - H * sh + 14]);
  }
  const fin = [[lerp(x0, x1, 0.66), WL - H * 0.86], [lerp(x0, x1, 0.74), WL - H * 1.25 - rise * 26], [lerp(x0, x1, 0.79), WL - H * 0.66]];
  if (rise > 0.01) {
    // carved halo
    ctx.fillStyle = W;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, S, WL + 6); ctx.clip();
    ctx.strokeStyle = W; ctx.lineWidth = 46; ctx.lineJoin = 'round';
    ctx.beginPath(); back.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.beginPath(); fin.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    ctx.fillStyle = K;
    ctx.beginPath(); back.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.lineTo(x1, WL + 40); ctx.lineTo(x0, WL + 40); ctx.fill();
    ctx.beginPath(); fin.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.fill();
    ctx.restore();
    // highlight gouges along the wet back
    ctx.fillStyle = W;
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const s = lerp(0.12 + k * 0.04, 0.6 - k * 0.05, i / 20); const sh = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.75);
        pts.push([lerp(x0, x1, s), WL - H * sh + 14 + 34 + k * 30 * Math.max(0.3, rise)]);
      }
      if (H > 50 + k * 30) gouge(ctx, pts, 15 - k * 2.5);
    }
    // barnacle dots
    const RB = mulberry(31);
    for (let i = 0; i < 14; i++) { const s = 0.25 + RB() * 0.4, sh = Math.pow(Math.sin(Math.PI * Math.pow(s, 0.8)), 0.75), yy = WL - H * sh + 50 + RB() * 70; if (yy < WL - 20) { ctx.beginPath(); ctx.arc(lerp(x0, x1, s), yy, 4 + RB() * 5, 0, 7); ctx.fill(); } }
    // water sheeting off the flanks
    for (let i = 0; i < 12; i++) {
      const s = 0.08 + i * 0.075 + RB() * 0.02, sh = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(s, 0.99), 0.8)), 0.75);
      const yt = WL - H * sh + 40, l = (WL - yt) * (0.4 + RB() * 0.5);
      if (l > 20) gouge(ctx, [[lerp(x0, x1, s), yt + 10], [lerp(x0, x1, s) + 4, yt + 10 + l]], 6);
    }
    // foam at the waterline
    const RF = mulberry(41);
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, s = side > 0 ? 0.92 + RF() * 0.2 : -0.1 + RF() * 0.16;
      const x = lerp(x0, x1, s), r = (30 + RF() * 70) * (0.4 + rise);
      const a0 = Math.PI * (1.05 + RF() * 0.3), pts = [];
      for (let j = 0; j <= 8; j++) { const a = a0 + j / 8 * 0.9; pts.push([x + Math.cos(a) * r * side * -1, WL + 4 + Math.sin(a) * r * 0.5]); }
      gouge(ctx, pts, 7 + RF() * 6);
    }
    gouge(ctx, [[x0 - 120, WL + 12], [lerp(x0, x1, 0.5), WL + 20], [x1 + 140, WL + 12]], 10 * rise + 4, 0.15);
    // spout
    const sp = 0;
    if (sp > 0) {
      const bxh = lerp(x0, x1, 0.26), byh = WL - H * 0.84 - 30;
      for (let j = -3; j <= 3; j++) {
        const pts = [], hh = sp * 280 * (1 - Math.abs(j) * 0.1), spread = j * 0.13;
        for (let i = 0; i <= 12; i++) { const s2 = i / 12; pts.push([bxh + Math.sin(spread) * hh * s2 + j * 30 * s2 * s2 * sp, byh - hh * s2 + (Math.abs(j) * 70 * s2 * s2 * sp)]); }
        gouge(ctx, pts, 11 - Math.abs(j), 0.3);
        const e = pts[pts.length - 1]; ctx.beginPath(); ctx.arc(e[0] + j * 6, e[1] + 26, 6, 0, 7); ctx.fill();
      }
    }
  }
  // --- frame: black border band with a carved keyline
  ctx.fillStyle = K;
  const b = 0.028 * S; ctx.fillRect(0, 0, S, b); ctx.fillRect(0, S - b, S, b); ctx.fillRect(0, 0, b, S); ctx.fillRect(S - b, 0, b, S);
  ctx.fillStyle = W;
  gouge(ctx, [[b + 6, b + 6], [S - b - 6, b + 6]], 6, 0.03); gouge(ctx, [[b + 6, S - b - 6], [S - b - 6, S - b - 6]], 6, 0.03);
  gouge(ctx, [[b + 6, b + 6], [b + 6, S - b - 6]], 6, 0.03); gouge(ctx, [[S - b - 6, b + 6], [S - b - 6, S - b - 6]], 6, 0.03);
}

// ---------------------------------------------------------------- static textures
function dirField(x, y) {
  const u = x / S, v = y / S;
  if (v > HOR / S) return 0.05 * Math.sin(u * 20);                      // sea: horizontal
  if (u > 0.6 && v > 0.47) return -0.6;                                 // cliff
  const dx = x - MOON[0], dy = y - MOON[1], d = Math.hypot(dx, dy) / S;
  const tang = Math.atan2(dy, dx) + Math.PI / 2;
  const w = Math.exp(-Math.pow(d / 0.2, 2));
  return lerp(0.03 * Math.sin(v * 30), tang, w);
}
let G = null; // gouge floor (0..1, 1 = deepest)
function buildGouge() {
  const c = mk(S), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(120,120,120)'; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'lighten'; ctx.lineCap = 'round';
  const R = mulberry(2024);
  for (let i = 0; i < 7000; i++) {
    let x = R() * S, y = R() * S; const L = 40 + R() * 140, w = 9 + R() * 12, v = 170 + R() * 85 | 0;
    ctx.strokeStyle = `rgb(${v},${v},${v})`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) { const a = dirField(x, y) + (R() - 0.5) * 0.25; x += Math.cos(a) * L / 5; y += Math.sin(a) * L / 5; ctx.lineTo(x, y); }
    ctx.stroke();
  }
  // fine chatter ridges across strokes
  const d = ctx.getImageData(0, 0, S, S).data; let g = new Float32Array(S * S);
  for (let i = 0; i < S * S; i++) g[i] = d[i * 4] / 255;
  G = blurBox(blurBox(g, S, S, 2), S, S, 2);
}
let NZ = null, NZ2 = null;
function buildNoise() {
  NZ = new Float32Array(S * S); NZ2 = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    NZ[y * S + x] = fbm(x / 160, y / 160, 4);
    NZ2[y * S + x] = vnoise(x / 2.2, y / 5.5) * 0.6 + vnoise(x / 1.3, y / 1.3) * 0.4;
  }
}
function blurBox(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), k = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) { let s = 0; const o = y * w;
    for (let x = -r; x <= r; x++) s += src[o + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[o + x] = s * k; s += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s * k; s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}

// ---------------------------------------------------------------- three.js scene
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(OUT, OUT);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0.012, 0.009, 0.007); scene.fog = new THREE.Fog(0x030201, 6.5, 13);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 50);

const LDIR = new THREE.Vector3(-0.66, 0.30, 0.56).normalize();
const key = new THREE.DirectionalLight(0xffd9a8, 3.3);
key.position.copy(LDIR).multiplyScalar(8); key.target.position.set(0, 0, 0);
key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01; key.shadow.radius = 6;
scene.add(key, key.target);
scene.add(new THREE.HemisphereLight(0x8aa0c0, 0x3a2614, 0.55));
const rim = new THREE.DirectionalLight(0xffe2c0, 1.6); rim.position.set(2.5, 3, -4); scene.add(rim);
const fill = new THREE.PointLight(0xffc488, 3.5, 0, 2); fill.position.set(1.8, 2.2, 3.2); scene.add(fill);

function canvasTex(c, srgb) {
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// table: warm wood
function woodCanvas() {
  const n = 1024, c = mk(n), ctx = c.getContext('2d'), im = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const w = fbm(x / 400, y / 40, 3), g = Math.sin((y + w * 160 + fbm(x / 90, y / 90, 2) * 30) * 0.09) * 0.5 + 0.5;
    const f = 0.55 + 0.25 * g + 0.2 * fbm(x / 6, y / 120, 2), i = (y * n + x) * 4;
    im.data[i] = 120 * f; im.data[i + 1] = 72 * f; im.data[i + 2] = 40 * f; im.data[i + 3] = 255;
  }
  ctx.putImageData(im, 0, 0); return c;
}
const woodT = canvasTex(woodCanvas(), true); woodT.wrapS = woodT.wrapT = THREE.RepeatWrapping; woodT.repeat.set(5, 5);
const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: woodT, roughness: 0.62 }));
table.rotation.x = -Math.PI / 2; table.receiveShadow = true; scene.add(table);
// block base: MDF + lino layer sides
const mdf = new THREE.Mesh(new THREE.BoxGeometry(2, TOPY - 0.03, 2), new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9 }));
mdf.position.y = (TOPY - 0.03) / 2; mdf.castShadow = true; mdf.receiveShadow = true; scene.add(mdf);
const linoSide = new THREE.Mesh(new THREE.BoxGeometry(2, 0.03 - D * 0.9, 2), new THREE.MeshStandardMaterial({ color: 0x6e5c4c, roughness: 0.8 }));
linoSide.position.y = TOPY - 0.03 + (0.03 - D * 0.9) / 2; linoSide.castShadow = true; linoSide.receiveShadow = true; scene.add(linoSide);
// brayer (ink roller) lying beside the block
(function () {
  const g = new THREE.Group();
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.0, 64), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.3 }));
  roll.rotation.z = Math.PI / 2; roll.position.y = 0.17; g.add(roll);
  const frameM = new THREE.MeshStandardMaterial({ color: 0x8a8f96, metalness: 0.9, roughness: 0.35 });
  [-0.53, 0.53].forEach(x => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 12), frameM); a.position.set(x, 0.32, 0.17); a.rotation.x = 1.2; g.add(a); });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.06, 12), frameM); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.44, 0.4); g.add(bar);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 32), new THREE.MeshStandardMaterial({ color: 0xa8743e, roughness: 0.5 }));
  handle.position.set(0, 0.6, 0.75); handle.rotation.x = 1.2; g.add(handle);
  g.traverse(o => { o.castShadow = o.receiveShadow = true; });
  g.position.set(-1.75, 0, 1.55); g.rotation.y = 0.75;
})();

// block top
const blockAlbedoC = mk(S), blockNormC = mk(S), blockRoughC = mk(S), blockDispC = mk(S);
const blockAlbedo = canvasTex(blockAlbedoC, true), blockNorm = canvasTex(blockNormC, false), blockRough = canvasTex(blockRoughC, false), blockDisp = canvasTex(blockDispC, false);
const blockGeo = new THREE.PlaneGeometry(2, 2, 600, 600); blockGeo.rotateX(-Math.PI / 2);
const blockMat = new THREE.MeshStandardMaterial({ map: blockAlbedo, normalMap: blockNorm, roughnessMap: blockRough, roughness: 1, displacementMap: blockDisp, displacementScale: D, displacementBias: -D });
blockMat.normalScale.set(1, -1);
const block = new THREE.Mesh(blockGeo, blockMat); block.position.y = TOPY; block.receiveShadow = true; scene.add(block);

// paper
const paperPrintC = mk(S), paperBackC = mk(S), paperNormC = mk(S);
const paperPrint = canvasTex(paperPrintC, true), paperBack = canvasTex(paperBackC, true), paperNorm = canvasTex(paperNormC, false);
const NX = 30, NS = 260;
const paperGeo = new THREE.PlaneGeometry(1, 1, NX, NS);
{
  const uv = paperGeo.attributes.uv;
  for (let j = 0; j <= NS; j++) for (let i = 0; i <= NX; i++) uv.setXY(j * (NX + 1) + i, i / NX, j / NS);
}
const printMat = new THREE.MeshStandardMaterial({ map: paperPrint, normalMap: paperNorm, roughness: 0.85, side: THREE.FrontSide });
const backMat = new THREE.MeshStandardMaterial({ map: paperBack, normalMap: paperNorm, roughness: 0.9, side: THREE.BackSide });
const paperA = new THREE.Mesh(paperGeo, printMat), paperB = new THREE.Mesh(paperGeo, backMat);
[paperA, paperB].forEach(m => { m.castShadow = true; m.receiveShadow = true; scene.add(m); });
paperA.customDepthMaterial = undefined;

// paper shape. Param j: v = j/NS, v=0 at near edge (z=+PW/2) v=1 far edge. s = distance from far edge.
function shapePaper(q) {
  const pos = paperGeo.attributes.position, L = PW, y0 = TOPY + 0.0015;
  for (let i = 0; i <= NX; i++) {
    const u = i / NX, x = (u - 0.5) * PW;
    const qq = Math.min(1, Math.max(0, q + (u - 0.5) * 0.16 * Math.sin(q * Math.PI))); // corner leads slightly
    const p = L * lerp(0.64, 0.07, qq);
    const th = lerp(1.45, 1.98, sm(0, 1, qq)), Rr = lerp(0.14, 0.30, qq);
    for (let j = 0; j <= NS; j++) {
      const v = j / NS, s = (1 - v) * L; let z, y;
      if (s <= p) { z = -L / 2 + s; y = y0; }
      else {
        const sg = s - p, zc = -L / 2 + p;
        if (sg <= Rr * th) { const ph = sg / Rr; z = zc + Rr * Math.sin(ph); y = y0 + Rr * (1 - Math.cos(ph)); }
        else {
          const e = sg - Rr * th; const ze = zc + Rr * Math.sin(th), ye = y0 + Rr * (1 - Math.cos(th));
          // free part relaxes slightly back toward the viewer near its end (held edge)
          const bend = -0.10 * e * e * qq;
          const a = th + bend;
          z = ze + e * Math.cos(th) * (1 - 0.02 * e) + 0.5 * e * e * (Math.cos(a) - Math.cos(th));
          y = ye + e * Math.sin(th) + 0.5 * e * e * (Math.sin(a) - Math.sin(th));
          y += 0.02 * Math.sin(u * Math.PI) * e; // slight sag/bow across the width
        }
      }
      pos.setXYZ(j * (NX + 1) + i, x, y, z);
    }
  }
  pos.needsUpdate = true; paperGeo.computeVertexNormals();
}

// ---------------------------------------------------------------- per-frame textures
const picC = mk(S), picCtx = picC.getContext('2d', { willReadFrequently: true });
let HF = null;
function buildFrameTextures(t) {
  drawPicture(picCtx, t);
  const d = picCtx.getImageData(0, 0, S, S).data, N = S * S;
  const ink = new Float32Array(N); for (let i = 0; i < N; i++) ink[i] = 1 - d[i * 4] / 255;
  const mb = blurBox(blurBox(ink, S, S, 3), S, S, 3);
  HF = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = sm(0.18, 0.82, mb[i]);
    HF[i] = -(0.55 + 0.45 * G[i]) * (1 - r) + r * (NZ2[i] - 0.5) * 0.02;
  }
  // baked groove shadows by marching toward the light
  const lh = Math.hypot(LDIR.x, LDIR.z), dc = LDIR.x / lh, dr = -LDIR.z / lh, tanE = LDIR.y / lh;
  const pxW = 2 / S, rise = tanE * pxW / D; // depth-fraction rise per pixel
  const sh = new Float32Array(N);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, h0 = HF[i]; let occ = 0;
    if (h0 < -0.05) {
      for (let k = 2; k < 120; k += 3) {
        const xx = (x + dc * k) | 0, yy = (y + dr * k) | 0; if (xx < 0 || yy < 0 || xx >= S || yy >= S) break;
        const rayh = h0 + k * rise; if (rayh > 0.02) break;
        const dd = HF[yy * S + xx] - rayh; if (dd > occ) occ = dd;
      }
    }
    sh[i] = 1 - sm(0.0, 0.12, occ);
  }
  const shb = blurBox(sh, S, S, 1);
  // albedo / roughness / normal / displacement
  const aC = blockAlbedoC.getContext('2d'), aI = aC.createImageData(S, S);
  const rC = blockRoughC.getContext('2d'), rI = rC.createImageData(S, S);
  const nC = blockNormC.getContext('2d'), nI = nC.createImageData(S, S);
  const dC = blockDispC.getContext('2d'), dI = dC.createImageData(S, S);
  const k = D * S / 4;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = y * S + x, o = i * 4, h = HF[i];
    const raised = sm(-0.35, -0.08, h), nz = NZ[i];
    // lino: warm tan, freshly cut paler; ink haze near edges and smudges
    const haze = sm(0.08, 0.5, mb[i]) * 0.35 + sm(0.66, 0.72, nz) * 0.08;
    let lr = 0.80 - 0.10 * G[i] + 0.06 * (nz - 0.5), lg = 0.60 - 0.08 * G[i] + 0.05 * (nz - 0.5), lb = 0.42 - 0.06 * G[i];
    lr = lerp(lr, 0.08, haze); lg = lerp(lg, 0.075, haze); lb = lerp(lb, 0.07, haze);
    // ink after a pull: uneven, partly lifted (greyer) where the paper took it
    const lift = 0.03 + 0.04 * sm(0.4, 0.7, nz) + 0.03 * NZ2[i];
    const ir = 0.02 + lift * 0.3, ig = 0.02 + lift * 0.28, ib = 0.024 + lift * 0.28;
    const s = lerp(0.38, 1.0, shb[i]);
    aI.data[o] = 255 * Math.pow(lerp(lr, ir, raised) * s, 1 / 2.2);
    aI.data[o + 1] = 255 * Math.pow(lerp(lg, ig, raised) * s, 1 / 2.2);
    aI.data[o + 2] = 255 * Math.pow(lerp(lb, ib, raised) * s, 1 / 2.2); aI.data[o + 3] = 255;
    const rough = lerp(0.82, 0.32 + 0.12 * sm(0.45, 0.75, nz), raised);
    rI.data[o] = rI.data[o + 1] = rI.data[o + 2] = 255 * rough; rI.data[o + 3] = 255;
    const xl = Math.max(0, x - 1), xr = Math.min(S - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(S - 1, y + 1);
    const gx = (HF[y * S + xr] - HF[y * S + xl]) * k, gy = (HF[yd * S + x] - HF[yu * S + x]) * k;
    const il = 1 / Math.hypot(gx, gy, 1);
    nI.data[o] = 127.5 + 127.5 * (-gx * il); nI.data[o + 1] = 127.5 + 127.5 * (-gy * il); nI.data[o + 2] = 127.5 + 127.5 * il; nI.data[o + 3] = 255;
    dI.data[o] = dI.data[o + 1] = dI.data[o + 2] = 255 * (1 + h); dI.data[o + 3] = 255;
  }
  aC.putImageData(aI, 0, 0); rC.putImageData(rI, 0, 0); nC.putImageData(nI, 0, 0); dC.putImageData(dI, 0, 0);
  blockAlbedo.needsUpdate = blockRough.needsUpdate = blockNorm.needsUpdate = blockDisp.needsUpdate = true;
  // print on paper (paper canvas covers PW; block occupies the centre)
  const pC = paperPrintC.getContext('2d'), pI = pC.createImageData(S, S);
  const bC = paperBackC.getContext('2d'), bI = bC.createImageData(S, S);
  const qC = paperNormC.getContext('2d'), qI = qC.createImageData(S, S);
  const emb = blurBox(HF, S, S, 4);
  const sc = PW / 2, off = (1 - sc) * 0.5 * S;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const o = (y * S + x) * 4, i = y * S + x;
    const bxp = Math.round(x * sc + off), byp = Math.round(y * sc + off);
    let cov = 0, e = 0;
    const fib = NZ2[i], grain = NZ[(x * 7 % S) + ((y * 5) % S) * S];
    if (bxp >= 0 && byp >= 0 && bxp < S && byp < S) {
      const bi = byp * S + bxp;
      cov = sm(-0.16, -0.03, HF[bi]) * (0.992 - 0.03 * NZ[bi] - 0.10 * sm(0.66, 0.74, NZ[(bi * 3 + 1234567) % (S * S)])) * (fib > 0.9 ? 0.75 : 1);
      cov = Math.min(1, Math.max(0, cov + (sm(0.66, 0.74, NZ[bi]) * 0.0)));
      e = emb[bi];
    }
    const pr = 0.94 - 0.03 * grain, pg = 0.90 - 0.03 * grain, pb = 0.80 - 0.04 * grain;
    const inkR = 0.012, inkG = 0.011, inkB = 0.014;
    pI.data[o] = 255 * Math.pow(lerp(pr, inkR, cov), 1 / 2.2); pI.data[o + 1] = 255 * Math.pow(lerp(pg, inkG, cov), 1 / 2.2); pI.data[o + 2] = 255 * Math.pow(lerp(pb, inkB, cov), 1 / 2.2); pI.data[o + 3] = 255;
    const showT = cov * 0.07;
    bI.data[o] = 255 * Math.pow(lerp(pr, 0.3, showT), 1 / 2.2); bI.data[o + 1] = 255 * Math.pow(lerp(pg, 0.3, showT), 1 / 2.2); bI.data[o + 2] = 255 * Math.pow(lerp(pb, 0.3, showT), 1 / 2.2); bI.data[o + 3] = 255;
    // emboss: paper pressed onto relief (normal from blurred height + fibres)
    const xl = Math.max(0, x - 1), xr = Math.min(S - 1, x + 1), yu = Math.max(0, y - 1), yd = Math.min(S - 1, y + 1);
    const gx = (NZ2[y * S + xr] - NZ2[y * S + xl]) * 0.25 + (bxp > 0 && bxp < S - 1 && byp > 0 && byp < S - 1 ? (emb[byp * S + bxp + 1] - emb[byp * S + bxp - 1]) * 2.2 : 0);
    const gy = (NZ2[yd * S + x] - NZ2[yu * S + x]) * 0.25 + (bxp > 0 && bxp < S - 1 && byp > 0 && byp < S - 1 ? (emb[(byp + 1) * S + bxp] - emb[(byp - 1) * S + bxp]) * 2.2 : 0);
    const il = 1 / Math.hypot(gx, gy, 1);
    qI.data[o] = 127.5 + 127.5 * (-gx * il); qI.data[o + 1] = 127.5 + 127.5 * (-gy * il); qI.data[o + 2] = 127.5 + 127.5 * il; qI.data[o + 3] = 255;
  }
  pC.putImageData(pI, 0, 0); bC.putImageData(bI, 0, 0); qC.putImageData(qI, 0, 0);
  paperPrint.needsUpdate = paperBack.needsUpdate = paperNorm.needsUpdate = true;
}

// ---------------------------------------------------------------- accumulation (AA + depth of field) and finishing
const rtS = new THREE.WebGLRenderTarget(OUT, OUT, { type: THREE.HalfFloatType, samples: 0 });
const rtA = new THREE.WebGLRenderTarget(OUT, OUT, { type: THREE.HalfFloatType });
const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const accMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, w: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: 'uniform sampler2D tex; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tex,vUv).rgb*w, 1.); }',
  blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true
});
const finMat = new THREE.ShaderMaterial({
  uniforms: { tex: { value: null }, seed: { value: 0 }, expo: { value: 0.85 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
  fragmentShader: `uniform sampler2D tex; uniform float seed, expo; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))+seed)*43758.5453); }
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
    void main(){
      vec3 c = texture2D(tex, vUv).rgb * expo;
      vec2 d = vUv-0.5; float vig = 1. - dot(d,d)*0.9;
      c *= vig;
      c = aces(c);
      c = pow(c, vec3(1./2.2));
      c += (h(vUv*1080.)-0.5)*0.035;
      gl_FragColor = vec4(c,1.);
    }`
});
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat); quad.frustumCulled = false;
const quadScene = new THREE.Scene(); quadScene.add(quad);

function camAt(t) {
  const e = sm(0, 3, t), e2 = e * e * (3 - 2 * e) * 0.5 + e * 0.5;
  const pos = new THREE.Vector3(lerp(-0.6, 0.2, e2), lerp(2.2, 3.0, e2), lerp(1.95, 4.6, e2));
  const tgt = new THREE.Vector3(lerp(-0.1, 0.0, e2), lerp(0.12, 0.74, e2), lerp(0.45, -0.38, e2));
  return { pos, tgt };
}
const SAMPLES = (window.location.hash.match(/s=(\d+)/) || [0, 6])[1] | 0;
function renderAt(t) {
  const { pos, tgt } = camAt(t);
  const focusD = pos.distanceTo(tgt);
  const fwd = tgt.clone().sub(pos).normalize(), right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, fwd);
  const ap = 0.035;
  renderer.setRenderTarget(rtA); renderer.setClearColor(0x000000, 1); renderer.clear();
  for (let sIdx = 0; sIdx < SAMPLES; sIdx++) {
    const a = sIdx * 2.39996, r = Math.sqrt((sIdx + 0.5) / SAMPLES) * ap;
    const off = right.clone().multiplyScalar(Math.cos(a) * r).add(up.clone().multiplyScalar(Math.sin(a) * r));
    camera.position.copy(pos).add(off); camera.lookAt(tgt);
    camera.setViewOffset(OUT, OUT, (((sIdx * 0.618) % 1) - 0.5), (((sIdx * 0.382 + 0.3) % 1) - 0.5), OUT, OUT);
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(rtS); renderer.setClearColor(scene.background, 1); renderer.clear(); renderer.render(scene, camera);
    quad.material = accMat; accMat.uniforms.tex.value = rtS.texture; accMat.uniforms.w.value = 1 / SAMPLES;
    renderer.setRenderTarget(rtA); renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = true;
  }
  quad.material = finMat; finMat.uniforms.tex.value = rtA.texture; finMat.uniforms.seed.value = t * 17.3;
  renderer.setRenderTarget(null); renderer.render(quadScene, quadCam);
}

let ready = false;
window.init = function () { let t0 = performance.now(); buildGouge(); console.log('gouge', performance.now() - t0); t0 = performance.now(); buildNoise(); console.log('noise', performance.now() - t0); ready = true; return 'ok'; };
window.frame = function (t, q) {
  buildFrameTextures(t);
  shapePaper(q === undefined ? sm(0, 3, t) : q);
  renderAt(t);
  return renderer.domElement.toDataURL('image/png');
};
window.picture = function (t) { drawPicture(picCtx, t); return picC.toDataURL('image/png'); };
