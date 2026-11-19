'use strict';
// A tiny dry-media drawing engine: paper tooth + strokes that deposit pigment on it.
// Everything the picture is made of goes through stroke rasterisation here.
const zlib = require('zlib');

// ---------------------------------------------------------------- noise
function hash2(ix, iy, s) {
  let h = (Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, s, oct) {
  let a = 0.5, f = 1, sum = 0, tot = 0;
  for (let i = 0; i < (oct || 4); i++) { sum += a * vnoise(x * f, y * f, s + i * 17); tot += a; a *= 0.5; f *= 2.03; }
  return sum / tot;
}
const N1 = new Float32Array(4096);
for (let i = 0; i < 4096; i++) N1[i] = hash2(i, 91, 7);
function n1(v) {
  const i = Math.floor(v), f = v - i;
  const a = N1[i & 4095], b = N1[(i + 1) & 4095];
  return a + (b - a) * f * f * (3 - 2 * f);
}

// ---------------------------------------------------------------- colour helpers
function hex(h) {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function ramp(stops, v) { // stops: [[v, [r,g,b]], ...] ascending
  if (v <= stops[0][0]) return stops[0][1];
  const n = stops.length;
  if (v >= stops[n - 1][0]) return stops[n - 1][1];
  for (let i = 1; i < n; i++) {
    if (v <= stops[i][0]) {
      let t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      t = t * t * (3 - 2 * t) * 0.5 + t * 0.5;
      return mix(stops[i - 1][1], stops[i][1], t);
    }
  }
  return stops[n - 1][1];
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function sstep(a, b, v) { let t = (v - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

const EMPTY = {};

class Engine {
  // W,H: full-size units. scale: device px per unit. rect: device px region to render.
  constructor(o) {
    this.W = o.W; this.H = o.H; this.s = o.scale;
    const r = o.rect;
    this.x0 = r[0]; this.y0 = r[1]; this.w = r[2] - r[0]; this.h = r[3] - r[1];
    // visible region in full units
    this.fx0 = r[0] / this.s; this.fy0 = r[1] / this.s; this.fx1 = r[2] / this.s; this.fy1 = r[3] / this.s;
    const n = this.w * this.h;
    this.R = new Float32Array(n); this.G = new Float32Array(n); this.B = new Float32Array(n);
    this.grain = new Float32Array(n);
    this.mask = new Float32Array(n);
    this.stamp = new Int32Array(n);
    this.touched = new Int32Array(n);
    this.sid = 0;
    this.ms = 12345; this.ls = 1;
    this.pb = new Float32Array(4 * 4096);
    this.tx = new Float32Array(4096); this.ty = new Float32Array(4096);
    this.nStrokes = 0;
    this._paper(o.paper || [0.5, 0.47, 0.55]);
  }

  // ---- paper: a height field (tooth). pigment lands on the peaks first.
  _paper(col) {
    // lattices are rotated against each other so the tooth never lines up with the pixel grid
    const raw = (X, Y) => 0.52 * vnoise((X * 0.891 - Y * 0.454) / 1.9, (X * 0.454 + Y * 0.891) / 1.9, 11) +
      0.29 * vnoise((X * 0.469 + Y * 0.883) / 4.1, (-X * 0.883 + Y * 0.469) / 4.1, 12) +
      0.13 * vnoise((X * 0.743 + Y * 0.669) / 10, (-X * 0.669 + Y * 0.743) / 10, 13) + 0.06 * vnoise(X / 47, Y / 47, 14);
    // equalise so the tooth heights are spread evenly 0..1
    const NB = 1024, hist = new Float64Array(NB);
    for (let i = 0; i < 120000; i++) {
      const v = raw(hash2(i, 1, 5) * 5000, hash2(i, 2, 5) * 5000);
      hist[Math.min(NB - 1, Math.floor(v * NB))]++;
    }
    const lut = new Float32Array(NB); let acc = 0;
    for (let i = 0; i < NB; i++) { acc += hist[i]; lut[i] = acc / 120000; }
    const { w, h, s, x0, y0, grain, R, G, B } = this;
    for (let y = 0; y < h; y++) {
      const Y = (y + y0 + 0.5) / s;
      for (let x = 0; x < w; x++) {
        const X = (x + x0 + 0.5) / s;
        let v = raw(X, Y);
        // long faint fibres in the sheet
        v += 0.035 * (vnoise(X / 90, Y / 3.1, 15) - 0.5) + 0.03 * (vnoise(X / 2.7, Y / 70, 16) - 0.5);
        const g = lut[clamp(Math.floor(v * NB), 0, NB - 1)];
        const i = y * w + x;
        grain[i] = g;
        const sh = 0.94 + 0.09 * g + 0.035 * (vnoise(X / 400, Y / 400, 17) - 0.5);
        R[i] = col[0] * sh; G[i] = col[1] * sh; B[i] = col[2] * sh;
      }
    }
  }

  // ---- rng. master rng drives placement; every stroke gets a private seed so
  // strokes can be culled without disturbing anything drawn after them.
  rnd() {
    let t = (this.ms = (this.ms + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  rr(a, b) { return a + (b - a) * this.rnd(); }
  reseed(n) { this.ms = (Math.imul(n | 0, 0x9e3779b1) ^ 0x51ed270b) | 0; this.rnd(); }
  lr() {
    let t = (this.ls = (this.ls + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  vis(x0, y0, x1, y1) { return !(x1 < this.fx0 || x0 > this.fx1 || y1 < this.fy0 || y0 > this.fy1); }

  _grow(n) {
    if (n * 4 > this.pb.length) {
      const m = n * 2;
      this.pb = new Float32Array(m * 4); this.tx = new Float32Array(m); this.ty = new Float32Array(m);
    }
  }
  _col(col, tool, o) {
    const j = o.jit === undefined ? (tool.jit || 0) : o.jit;
    if (j <= 0) { this.cr = col[0]; this.cg = col[1]; this.cb = col[2]; return; }
    const l = 1 + (this.lr() - 0.5) * 2 * j;
    this.cr = clamp(col[0] * l + (this.lr() - 0.5) * j * 0.6, 0, 1);
    this.cg = clamp(col[1] * l + (this.lr() - 0.5) * j * 0.6, 0, 1);
    this.cb = clamp(col[2] * l + (this.lr() - 0.5) * j * 0.6, 0, 1);
  }

  // a nearly straight hand stroke
  line(x0, y0, x1, y1, tool, col, o) {
    const seed = (this.rnd() * 4294967296) | 0;
    o = o || EMPTY;
    const wm = o.w === undefined ? 1 : o.w;
    const width = tool.width * wm * Math.max(1, o.w0 || 1, o.w1 || 1);
    const dx = x1 - x0, dy = y1 - y0, L = Math.sqrt(dx * dx + dy * dy);
    const wobA = (tool.wob || 0) * (o.wob === undefined ? 1 : o.wob);
    const mg = width * 0.5 + wobA * 2 + 6 + 0.06 * L + (o.edge || 0);
    if (Math.max(x0, x1) + mg < this.fx0 || Math.min(x0, x1) - mg > this.fx1 ||
      Math.max(y0, y1) + mg < this.fy0 || Math.min(y0, y1) - mg > this.fy1) return;
    this.ls = seed; this.lr();
    const s = this.s;
    const step = Math.max(width * 0.45, 2.5, 1.5 / s);
    const n = Math.max(2, Math.ceil(L / step) + 1);
    this._grow(n);
    const tx = this.tx, ty = this.ty;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); tx[i] = x0 + dx * t; ty[i] = y0 + dy * t; }
    this._finish(n, L, tool, col, o, wm, wobA);
  }

  // a curved stroke through points [[x,y],...] (Catmull-Rom)
  curve(pts, tool, col, o) {
    const seed = (this.rnd() * 4294967296) | 0;
    o = o || EMPTY;
    const wm = o.w === undefined ? 1 : o.w;
    const width = tool.width * wm * Math.max(1, o.w0 || 1, o.w1 || 1);
    const wobA = (tool.wob || 0) * (o.wob === undefined ? 1 : o.wob);
    let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p[0] < bx0) bx0 = p[0]; if (p[0] > bx1) bx1 = p[0]; if (p[1] < by0) by0 = p[1]; if (p[1] > by1) by1 = p[1];
    }
    const mg = width * 0.5 + wobA * 2 + 6 + 0.12 * Math.max(bx1 - bx0, by1 - by0);
    if (bx1 + mg < this.fx0 || bx0 - mg > this.fx1 || by1 + mg < this.fy0 || by0 - mg > this.fy1) return;
    this.ls = seed; this.lr();
    const s = this.s;
    const step = Math.max(width * 0.45, 2.5, 1.5 / s);
    let n = 0, L = 0;
    const np = pts.length;
    for (let i = 0; i < np - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(np - 1, i + 2)];
      const sl = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const k = Math.max(1, Math.ceil(sl / step));
      this._grow(n + k + 2);
      const tx = this.tx, ty = this.ty;
      for (let j = 0; j < k; j++) {
        const t = j / k, t2 = t * t, t3 = t2 * t;
        tx[n] = 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
        ty[n] = 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
        n++;
      }
      L += sl;
    }
    this.tx[n] = pts[np - 1][0]; this.ty[n] = pts[np - 1][1]; n++;
    this._finish(n, L, tool, col, o, wm, wobA);
  }

  // shared: wobble, pressure, width -> device points -> raster
  _finish(n, L, tool, col, o, wm, wobA) {
    const s = this.s, tx = this.tx, ty = this.ty, pb = this.pb;
    const P0 = (o.p === undefined ? 1 : o.p);
    const taper = o.taper === undefined ? (tool.taper === undefined ? 1 : tool.taper) : o.taper;
    const pv = tool.pv === undefined ? 0.18 : tool.pv;
    const bow = (o.bow !== undefined ? o.bow : (this.lr() - 0.5) * 2 * (tool.bow === undefined ? 0.012 : tool.bow)) * L;
    const f1 = this.lr() * 900, f2 = this.lr() * 900, f3 = this.lr() * 900;
    const wsc = Math.min(1, L / 110) * wobA;
    const w0 = o.w0 === undefined ? 1 : o.w0, w1 = o.w1 === undefined ? 1 : o.w1;
    const ti = o.ti || tool.ti || 0.18, to = o.to || tool.to || 0.22;
    const wp = tool.wp === undefined ? 0.4 : tool.wp;
    const W = tool.width * wm;
    const x0 = this.x0, y0 = this.y0;
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0, u = t * L;
      const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
      let nx = -(ty[b] - ty[a]), ny = tx[b] - tx[a];
      const nl = Math.sqrt(nx * nx + ny * ny) || 1; nx /= nl; ny /= nl;
      const off = bow * 4 * t * (1 - t) + wsc * ((n1(u / 120 + f1) - 0.5) * 2 + 0.3 * (n1(u / 15 + f2) - 0.5) * 2);
      let tp = 1;
      if (taper === 1) { const a1 = t / ti, a2 = (1 - t) / to; tp = Math.min(1, a1, a2); tp = 0.22 + 0.78 * tp; }
      else if (taper === 2) { tp = t < 0.08 ? 0.6 + 5 * t : 1 - Math.pow((t - 0.08) / 0.92, 1.6) * 0.9; }
      else if (taper === 3) { tp = 0.12 + 0.88 * Math.min(1, t / 0.7); }
      const p = P0 * tp * (1 + pv * (n1(u / 40 + f3) - 0.5) * 2);
      const wv = W * (w0 + (w1 - w0) * t) * (1 - wp + wp * tp);
      const k = i * 4;
      pb[k] = (tx[i] + nx * off) * s - x0; pb[k + 1] = (ty[i] + ny * off) * s - y0;
      pb[k + 2] = Math.max(0.7, wv * s); pb[k + 3] = p;
    }
    this._col(col, tool, o);
    this._raster(n, tool, o);
  }

  _raster(n, tool, o) {
    const W = this.w, H = this.h, mask = this.mask, stamp = this.stamp, grain = this.grain, touched = this.touched;
    const P = this.pb, s = this.s;
    const id = ++this.sid; this.nStrokes++;
    let nt = 0;
    const edge = Math.max(1, (o.edge === undefined ? tool.edge : o.edge) * s);
    const tooth = o.tooth === undefined ? tool.tooth : o.tooth, invSoft = 1 / tool.soft, flow = tool.flow * (o.flow === undefined ? 1 : o.flow);
    const streak = tool.streak || 0, sfreq = (tool.sfreq || 0.1) / s;
    const sseed = this.lr() * 3000;
    let u0 = 0;
    for (let i = 0; i < n - 1; i++) {
      const k = i * 4;
      const ax = P[k], ay = P[k + 1], aw = P[k + 2], ap = P[k + 3];
      const bx = P[k + 4], by = P[k + 5], bw = P[k + 6], bp = P[k + 7];
      const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy, len = Math.sqrt(len2);
      const inv = len2 > 1e-9 ? 1 / len2 : 0, invLen = len > 1e-6 ? 1 / len : 0;
      const rmax = Math.max(aw, bw) * 0.5 + edge;
      let xa = Math.floor(Math.min(ax, bx) - rmax), xb = Math.ceil(Math.max(ax, bx) + rmax);
      let ya = Math.floor(Math.min(ay, by) - rmax), yb = Math.ceil(Math.max(ay, by) + rmax);
      if (xa < 0) xa = 0; if (ya < 0) ya = 0; if (xb > W - 1) xb = W - 1; if (yb > H - 1) yb = H - 1;
      for (let y = ya; y <= yb; y++) {
        const py = y + 0.5 - ay;
        let idx = y * W + xa;
        for (let x = xa; x <= xb; x++, idx++) {
          const px = x + 0.5 - ax;
          let t = (px * dx + py * dy) * inv; if (t < 0) t = 0; else if (t > 1) t = 1;
          const qx = px - t * dx, qy = py - t * dy, d2 = qx * qx + qy * qy;
          const ro = (aw + (bw - aw) * t) * 0.5 + edge * 0.5;
          if (d2 >= ro * ro) continue;
          let c = (ro - Math.sqrt(d2)) / edge; if (c > 1) c = 1;
          let pr = ap + (bp - ap) * t;
          if (streak > 0) {
            const sg = (px * dy - py * dx) * invLen, u = u0 + t * len;
            pr *= 1 - streak * n1(sg * sfreq + sseed) * (0.55 + 0.9 * n1(u * sfreq * 0.07 + sseed * 1.7));
          }
          // pigment catches the peaks of the tooth first; pressure pushes it down into the valleys
          let cov = (grain[idx] - tooth * (1.15 - 1.3 * pr)) * invSoft + 1 - 0.5 * tooth; if (cov <= 0) continue; if (cov > 1) cov = 1;
          const a = c * cov * flow * (0.4 + 0.6 * (pr > 1 ? 1 : pr));
          if (stamp[idx] !== id) { stamp[idx] = id; mask[idx] = a; touched[nt++] = idx; }
          else if (a > mask[idx]) mask[idx] = a;
        }
      }
      u0 += len;
    }
    // lay the pigment down: cover = opaque pastel, glaze = waxy pencil over what is below
    const R = this.R, G = this.G, B = this.B, cr = this.cr, cg = this.cg, cb = this.cb;
    const cover = o.cover === undefined ? tool.cover : o.cover;
    if (cover >= 1) {
      for (let i = 0; i < nt; i++) {
        const idx = touched[i], a = mask[idx];
        R[idx] += a * (cr - R[idx]); G[idx] += a * (cg - G[idx]); B[idx] += a * (cb - B[idx]);
      }
    } else {
      const gl = 1 - cover;
      for (let i = 0; i < nt; i++) {
        const idx = touched[i], a = mask[idx];
        const r = R[idx], g = G[idx], b = B[idx];
        R[idx] = r + a * ((cr * cover + r * cr * gl) - r);
        G[idx] = g + a * ((cg * cover + g * cg * gl) - g);
        B[idx] = b + a * ((cb * cover + b * cb * gl) - b);
      }
    }
  }

  // a pressed dot / small dab
  dot(x, y, r, tool, col, o) {
    const a = this.rnd() * 6.283, l = r * 0.5;
    const oo = Object.assign({ taper: 0, wob: 0, bow: 0 }, o || EMPTY);
    oo.w = (2 * r) / tool.width;
    this.line(x - Math.cos(a) * l, y - Math.sin(a) * l, x + Math.cos(a) * l, y + Math.sin(a) * l, tool, col, oo);
  }

  // fill a region with hatching, the way a hand does: parallel-ish strokes in bursts,
  // starting and stopping near the edge but never exactly on it.
  hatch(o) {
    const seed = (this.rnd() * 4294967296) | 0;
    const bb = o.bbox, tool = o.tool;
    if (!this.vis(bb[0] - 40, bb[1] - 40, bb[2] + 40, bb[3] + 40)) { this.reseed(seed); return; }
    const ang = o.angle || 0, ca = Math.cos(ang), sa = Math.sin(ang);
    const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
    const hw = (bb[2] - bb[0]) / 2, hh = (bb[3] - bb[1]) / 2;
    const A = Math.abs(hw * ca) + Math.abs(hh * sa), O = Math.abs(hw * sa) + Math.abs(hh * ca);
    const sp = o.spacing, spJ = o.spJit === undefined ? 0.5 : o.spJit;
    const step = o.step || 3, endJ = o.endJit === undefined ? 4 : o.endJit, angJ = o.angJit === undefined ? 0.03 : o.angJit;
    const lmin = o.len ? o.len[0] : 80, lmax = o.len ? o.len[1] : 240;
    const inside = o.inside, colF = typeof o.color === 'function' ? o.color : null;
    const pF = typeof o.p === 'function' ? o.p : null, p0 = pF ? 1 : (o.p === undefined ? 0.8 : o.p);
    const so = { p: p0, w: o.w, wob: o.wob, taper: o.taper, jit: o.jit, cover: o.cover, tooth: o.tooth, flow: o.flow, bow: undefined };
    const skip = o.skip || 0;
    const mgn = tool.width + 30;
    let off = -O, j = 0;
    while (off < O) {
      j++;
      this.reseed(seed ^ Math.imul(j, 0x632be5ab));
      const oj = off + (this.rnd() - 0.5) * sp * spJ;
      off += sp;
      const da = (this.rnd() - 0.5) * 2 * angJ;
      const c2 = Math.cos(ang + da), s2 = Math.sin(ang + da);
      const bx = cx - sa * oj, by = cy + ca * oj;
      // cull this hatch line if it cannot touch the render rect
      const ex0 = bx - c2 * A, ey0 = by - s2 * A, ex1 = bx + c2 * A, ey1 = by + s2 * A;
      if (!this.vis(Math.min(ex0, ex1) - mgn, Math.min(ey0, ey1) - mgn, Math.max(ex0, ex1) + mgn, Math.max(ey0, ey1) + mgn)) continue;
      let a = -A, start = null;
      const phase = this.rnd() * step;
      a += phase;
      for (; a <= A + step; a += step) {
        const x = bx + c2 * a, y = by + s2 * a;
        const inb = x >= bb[0] && x <= bb[2] && y >= bb[1] && y <= bb[3] && a <= A;
        const ins = inb && (!inside || inside(x, y));
        if (ins && start === null) start = a;
        else if (!ins && start !== null) {
          // interval [start, a - step]
          let cur = start; const end = a - step;
          start = null;
          if (end - cur < step * 0.5 && this.rnd() < 0.6) continue;
          while (cur < end) {
            let e = cur + lmin + (lmax - lmin) * this.rnd();
            let last = false;
            if (end - e < lmin * 0.35) { e = end; last = true; }
            const q0 = cur + (this.rnd() - 0.5) * 2 * endJ, q1 = e + (this.rnd() - 0.5) * 2 * endJ;
            const sx = bx + c2 * q0, sy = by + s2 * q0, tx = bx + c2 * q1, ty = by + s2 * q1;
            const dn = (this.rnd() - 0.5) * sp * 0.25;
            if (this.rnd() >= skip) {
              const mx = (sx + tx) / 2, my = (sy + ty) / 2;
              if (pF) so.p = pF(mx, my);
              const col = colF ? colF(mx, my) : o.color;
              if (col && so.p > 0.02) this.line(sx - s2 * dn, sy + c2 * dn, tx - s2 * dn, ty + c2 * dn, tool, col, so);
              else this.rnd();
            } else this.rnd();
            cur = e - this.rnd() * 5;
            if (last) break;
          }
        }
      }
    }
    this.reseed(seed);
  }

  // a soft halo built from many small scumbled marks (never a smooth gradient)
  glow(cx, cy, R, tool, col, o) {
    const seed = (this.rnd() * 4294967296) | 0;
    o = o || EMPTY;
    const sq = o.squash === undefined ? 1 : o.squash;
    if (!this.vis(cx - R * 1.4 - 70, cy - R * 1.4 - 70, cx + R * 1.4 + 70, cy + R * 1.4 + 70)) { this.reseed(seed); return; }
    const n = o.n || 60, fall = o.fall || 1.7, P = o.p === undefined ? 0.6 : o.p, gam = o.gam || 1.3;
    const so = { p: 1, w: o.w, jit: o.jit, taper: 1, flow: o.flow, tooth: o.tooth };
    const colF = typeof col === 'function' ? col : null;
    for (let i = 0; i < n; i++) {
      const r = R * Math.pow(this.rnd(), 1 / fall) * (o.rmin === undefined ? 1 : 1) ;
      const rr = (o.rmin || 0) * R + r * (1 - (o.rmin || 0));
      const a = this.rnd() * 6.283;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * sq;
      const ta = o.radial ? a + (this.rnd() - 0.5) * 0.3 : a + 1.5708 + (this.rnd() - 0.5) * 1.3;
      const l = R * (o.len || 0.22) * (0.5 + this.rnd());
      so.p = P * Math.pow(1 - rr / R, gam) + (o.pmin || 0);
      const c = colF ? colF(rr / R) : col;
      this.line(x - Math.cos(ta) * l / 2, y - Math.sin(ta) * l / 2 * sq, x + Math.cos(ta) * l / 2, y + Math.sin(ta) * l / 2 * sq, tool, c, so);
    }
    this.reseed(seed);
  }

  toRGB8() {
    const n = this.w * this.h, out = new Uint8Array(n * 3), R = this.R, G = this.G, B = this.B;
    for (let i = 0; i < n; i++) {
      out[i * 3] = clamp(Math.round(R[i] * 255), 0, 255);
      out[i * 3 + 1] = clamp(Math.round(G[i] * 255), 0, 255);
      out[i * 3 + 2] = clamp(Math.round(B[i] * 255), 0, 255);
    }
    return out;
  }
}

// ---------------------------------------------------------------- PNG
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
// 2x box downscale in linear light
function half(rgb, w, h) {
  const w2 = w >> 1, h2 = h >> 1, out = new Uint8Array(w2 * h2 * 3);
  const lin = new Float32Array(256), inv = (v) => Math.round(255 * Math.pow(v, 1 / 2.2));
  for (let i = 0; i < 256; i++) lin[i] = Math.pow(i / 255, 2.2);
  for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) for (let c = 0; c < 3; c++) {
    const a = (y * 2 * w + x * 2) * 3 + c;
    const v = (lin[rgb[a]] + lin[rgb[a + 3]] + lin[rgb[a + w * 3]] + lin[rgb[a + w * 3 + 3]]) / 4;
    out[(y * w2 + x) * 3 + c] = inv(v);
  }
  return out;
}

module.exports = { Engine, hash2, vnoise, fbm, n1, hex, mix, ramp, clamp, sstep, encodePNG, half };
