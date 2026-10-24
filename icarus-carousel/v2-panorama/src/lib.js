// Shared painting toolkit. Everything is procedural: no textures, no assets.
// Coordinates inside paintings are "design units": the page is 1000 wide and
// 1777.78 tall, so every painting renders identically at any resolution.
(function () {
  const L = {};

  // ---------- randomness ----------
  L.Rand = class {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let t = (this.s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    r(a = 0, b = 1) { return a + (b - a) * this.next(); }
    int(a, b) { return Math.floor(this.r(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    gauss(m = 0, s = 1) {
      const u = 1 - this.next(), v = this.next();
      return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
  };

  // ---------- simplex noise ----------
  L.noise2 = function (seed) {
    const R = new L.Rand(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(R.next() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const gx = [1, -1, 1, -1, 1, -1, 0, 0], gy = [1, 1, -1, -1, 0, 0, 1, -1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    return function (xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
      const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = perm[ii + perm[jj]] & 7; tt *= tt; n += tt * tt * (gx[g] * x0 + gy[g] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = perm[ii + i1 + perm[jj + j1]] & 7; tt *= tt; n += tt * tt * (gx[g] * x1 + gy[g] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = perm[ii + 1 + perm[jj + 1]] & 7; tt *= tt; n += tt * tt * (gx[g] * x2 + gy[g] * y2); }
      return 70 * n;
    };
  };
  L.fbm = function (n, x, y, oct = 4, lac = 2, gain = 0.5) {
    let a = 1, f = 1, s = 0, norm = 0;
    for (let o = 0; o < oct; o++) { s += a * n(x * f + o * 17.3, y * f - o * 9.1); norm += a; a *= gain; f *= lac; }
    return s / norm;
  };

  // ---------- math / colour ----------
  L.clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  L.lerp = (a, b, t) => a + (b - a) * t;
  L.smooth = (e0, e1, x) => { const t = L.clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  L.hex = (h) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  L.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  L.css = (c, a = 1) => `rgba(${Math.round(L.clamp(c[0], 0, 255))},${Math.round(L.clamp(c[1], 0, 255))},${Math.round(L.clamp(c[2], 0, 255))},${a})`;
  L.toHsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6;
    }
    return [h, s, l];
  };
  L.fromHsl = ([h, s, l]) => {
    h = ((h % 1) + 1) % 1; s = L.clamp(s); l = L.clamp(l);
    if (s === 0) return [l * 255, l * 255, l * 255];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
  };
  L.vary = (c, R, dh = 0.02, ds = 0.05, dl = 0.05) => {
    const [h, s, l] = L.toHsl(c);
    return L.fromHsl([h + R.gauss(0, dh), s + R.gauss(0, ds), l + R.gauss(0, dl)]);
  };

  // ---------- geometry ----------
  L.catmull = function (pts, seg = 8, closed = false) {
    const out = [], n = pts.length;
    if (n < 3) return pts.slice();
    const P = (i) => closed ? pts[(i + n) % n] : pts[L.clamp(i, 0, n - 1)];
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < seg; k++) {
        const t = k / seg, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1].slice());
    return out;
  };
  L.polyLen = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s; };
  L.resample = function (pts, step) {
    if (pts.length < 2) return pts.slice();
    const out = [pts[0].slice()];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i];
      let d = Math.hypot(bx - ax, by - ay);
      while (acc + d >= step) {
        const t = (step - acc) / d;
        ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
        out.push([ax, ay]); d = Math.hypot(bx - ax, by - ay); acc = 0;
      }
      acc += d;
    }
    const lp = pts[pts.length - 1], lo = out[out.length - 1];
    if (Math.hypot(lp[0] - lo[0], lp[1] - lo[1]) > step * 0.3) out.push(lp.slice());
    return out;
  };
  L.normals = function (pts) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      out.push([-dy / d, dx / d]);
    }
    return out;
  };
  L.quad = (p0, p1, p2, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  };
  L.path = (ctx, pts, close = false) => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  };
  // Variable-width filled stroke. wfn(t) -> full width at fraction t.
  L.ribbon = function (ctx, pts, wfn) {
    if (pts.length < 2) return;
    const nr = L.normals(pts), n = pts.length, left = [], right = [];
    for (let i = 0; i < n; i++) {
      const w = wfn(i / (n - 1)) / 2;
      left.push([pts[i][0] + nr[i][0] * w, pts[i][1] + nr[i][1] * w]);
      right.push([pts[i][0] - nr[i][0] * w, pts[i][1] - nr[i][1] * w]);
    }
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i][0], left[i][1]);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
    ctx.closePath(); ctx.fill();
  };
  // Irregular blob outline around a centre.
  L.blob = function (cx, cy, r, R, rough = 0.25, n = 40, ex = 1, rot = 0) {
    const ph = [R.r(0, 6.28), R.r(0, 6.28), R.r(0, 6.28)], am = [R.r(0, rough), R.r(0, rough * 0.6), R.r(0, rough * 0.35)];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + am[0] * Math.sin(a * 2 + ph[0]) + am[1] * Math.sin(a * 3 + ph[1]) + am[2] * Math.sin(a * 5 + ph[2]);
      const x = Math.cos(a) * r * k * ex, y = Math.sin(a) * r * k;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  };

  // ---------- canvases ----------
  L.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  L.blurred = (src, px) => {
    const c = L.canvas(src.width, src.height), x = c.getContext('2d');
    x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); return c;
  };

  // ---------- oil brush ----------
  // Paints a bristle stroke along pts into ctx (colour) and hctx (paint height).
  L.bristle = function (ctx, hctx, pts, o) {
    const R = o.R;
    const width = o.width, nb = o.bristles || Math.max(4, Math.round(width / 2.2));
    const res = L.resample(pts, Math.max(1.2, width / 5));
    if (res.length < 2) return;
    const nr = L.normals(res), n = res.length;
    const taperA = o.taperA ?? 0.18, taperB = o.taperB ?? 0.25;
    const alpha = o.alpha ?? 1, hv = o.height ?? 0.6, dry = o.dry ?? 0.25;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (hctx) { hctx.lineCap = 'round'; hctx.lineJoin = 'round'; }
    for (let b = 0; b < nb; b++) {
      const off = ((b + 0.5) / nb - 0.5) * width + R.gauss(0, width * 0.04);
      const s0 = Math.floor(R.r(0, 0.12) * n);
      const e0 = Math.ceil((1 - R.r(0, dry) * (0.4 + Math.abs(off) / width)) * (n - 1));
      if (e0 - s0 < 2) continue;
      const col = o.colorFn ? o.colorFn(b / nb) : L.vary(o.color, R, o.dh ?? 0.008, o.ds ?? 0.03, o.dl ?? 0.035);
      const bw = (width / nb) * R.r(1.3, 2.3);
      ctx.beginPath(); if (hctx) hctx.beginPath();
      for (let i = s0; i <= e0; i++) {
        const t = i / (n - 1);
        const prof = Math.sqrt(L.smooth(0, taperA, t)) * Math.sqrt(L.smooth(1, 1 - taperB, t));
        const k = off * (0.35 + 0.65 * prof);
        const x = res[i][0] + nr[i][0] * k, y = res[i][1] + nr[i][1] * k;
        if (i === s0) { ctx.moveTo(x, y); if (hctx) hctx.moveTo(x, y); }
        else { ctx.lineTo(x, y); if (hctx) hctx.lineTo(x, y); }
      }
      ctx.strokeStyle = L.css(col, alpha * R.r(0.75, 1));
      ctx.lineWidth = bw; ctx.stroke();
      if (hctx) {
        const g = Math.round(255 * L.clamp(hv * R.r(0.55, 1.15)));
        hctx.strokeStyle = `rgba(${g},${g},${g},${o.halpha ?? 1})`;
        hctx.lineWidth = bw * 0.8; hctx.stroke();
      }
    }
  };
  // Follow a vector field from a seed point; returns a polyline.
  L.trace = function (x, y, len, step, field) {
    const pts = [[x, y]];
    let px = x, py = y, pa = null;
    for (let s = 0; s < len; s += step) {
      let a = field(px, py);
      if (pa !== null) { let d = a - pa; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) > Math.PI / 2) a += Math.PI; }
      pa = a; px += Math.cos(a) * step; py += Math.sin(a) * step; pts.push([px, py]);
    }
    return pts;
  };

  // Light a height map and apply it to the colour canvas (impasto relief).
  L.relief = function (ctx, hcanvas, o = {}) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const hb = o.blur ? L.blurred(hcanvas, o.blur) : hcanvas;
    const hd = hb.getContext('2d').getImageData(0, 0, W, H).data;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const k = o.depth ?? 2.0, sp = o.spec ?? 0.25, spow = o.specPow ?? 24, amb = o.strength ?? 0.6;
    let lx = o.lx ?? -0.55, ly = o.ly ?? -0.65, lz = o.lz ?? 0.55;
    const ll = Math.hypot(lx, ly, lz); lx /= ll; ly /= ll; lz /= ll;
    // half vector with viewer at (0,0,1)
    let hx = lx, hy = ly, hz = lz + 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
    const H0 = (x, y) => hd[(y * W + x) * 4] / 255;
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const dx = (H0(x + 1, y) - H0(x - 1, y)) * k, dy = (H0(x, y + 1) - H0(x, y - 1)) * k;
        const nl = Math.hypot(dx, dy, 1), nx = -dx / nl, ny = -dy / nl, nz = 1 / nl;
        const diff = nx * lx + ny * ly + nz * lz - lz;
        const nh = Math.max(0, nx * hx + ny * hy + nz * hz);
        const spec = sp * Math.pow(nh, spow) * (1 - nz) * 6;
        const i = (y * W + x) * 4, f = 1 + diff * amb;
        d[i] = d[i] * f + spec * 255; d[i + 1] = d[i + 1] * f + spec * 255; d[i + 2] = d[i + 2] * f + spec * 245;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  // Canvas weave + fine grain, scaled to design units so it is resolution-independent.
  L.weave = function (ctx, o = {}) {
    const W = ctx.canvas.width, H = ctx.canvas.height, S = o.S ?? W / 1000;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    const R = new L.Rand(o.seed ?? 9), N = L.noise2(o.seed ?? 9);
    const per = (o.period ?? 2.6) * S, amt = o.amount ?? 0.05, grain = o.grain ?? 6;
    for (let y = 0; y < H; y++) {
      const wy = Math.sin((y / per) * Math.PI * 2);
      for (let x = 0; x < W; x++) {
        const wx = Math.sin((x / per) * Math.PI * 2 + N(x / (40 * S), y / (40 * S)) * 0.8);
        const thread = (wx > 0 ? wy : -wy) * 0.5 + 0.5 * Math.abs(wx) * Math.abs(wy);
        const f = 1 + amt * (thread - 0.3);
        const g = (R.next() - 0.5) * grain;
        const i = (y * W + x) * 4;
        d[i] = d[i] * f + g; d[i + 1] = d[i + 1] * f + g; d[i + 2] = d[i + 2] * f + g;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  // Per-pixel tone curve / grain pass.
  L.post = function (ctx, fn) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; fn(d, i, x, y); }
    ctx.putImageData(img, 0, 0);
  };

  // Concentric "labyrinth" glyph used as a motif in I and II.
  L.labyrinth = function (cx, cy, r, rings, R, sy = 1) {
    const walls = [];
    const gaps = [];
    for (let k = 0; k < rings; k++) gaps.push(-Math.PI / 2 + (k % 2 ? Math.PI : 0) + R.r(-0.5, 0.5));
    for (let k = 0; k < rings; k++) {
      const rr = r * (k + 1) / rings, g = gaps[k], gw = 0.42 / (k + 1) + 0.12;
      const pts = [];
      for (let a = g + gw; a <= g + Math.PI * 2 - gw; a += 0.04) pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]);
      walls.push(pts);
      if (k > 0) {
        const a = gaps[k - 1] + Math.PI * (0.5 + R.r(-0.2, 0.2)), r0 = r * k / rings;
        walls.push([[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0 * sy], [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * sy]]);
      }
    }
    return walls;
  };

  window.L = L;
})();
