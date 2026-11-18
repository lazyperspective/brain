'use strict';
// Dry-media drawing engine: paper tooth + pigment deposit. No dependencies.
const zlib = require('zlib'), fs = require('fs');

function rng32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hex(h) {
  h = h.replace('#', '');
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (a, b, x) => { let t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// lattice value noise in 2D (deterministic, hash based)
function hash2(ix, iy, s) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
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
  let v = 0, a = 0.5, t = 0;
  for (let i = 0; i < (oct || 4); i++) { v += a * vnoise(x, y, s + i * 17); t += a; x *= 2.03; y *= 2.03; a *= 0.5; }
  return v / t;
}

class Paper {
  constructor(VW, VH, S, paper, seed) {
    this.VW = VW; this.VH = VH; this.S = S;
    this.W = Math.round(VW * S); this.H = Math.round(VH * S);
    const n = this.W * this.H;
    this.px = new Float32Array(n * 3);
    this.grain = new Float32Array(n);
    this.fill = new Float32Array(n);
    this.sid = new Int32Array(n);
    this.scov = new Float32Array(n);
    this.id = 0; this.nstrokes = 0;
    this.rand = rng32(seed);
    this.paper = paper;
    this._grain(seed);
    const { px, grain, W, H } = this;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, g = grain[i];
      const lf = vnoise(x / S / 90, y / S / 90, 991) - 0.5;
      const k = 0.972 + 0.04 * g + 0.02 * lf;
      px[i * 3] = paper[0] * k; px[i * 3 + 1] = paper[1] * k; px[i * 3 + 2] = paper[2] * k;
    }
  }
  _grain(seed) {
    const { W, H, S, grain } = this;
    // octaves in virtual px: fine tooth, medium tooth, coarse, sheet undulation
    const oct = [[0.8, 0.30, 1], [1.7, 0.34, 1], [3.6, 0.2, 1], [1.3, 0.12, 9], [24, 0.04, 1]];
    let o = 0;
    for (const [per, wt, an] of oct) {
      const p = per * S, pxn = p * an, gw = Math.ceil(W / pxn) + 3, gh = Math.ceil(H / p) + 3;
      const lat = new Float32Array(gw * gh), r = rng32(seed * 7 + o * 131 + 5);
      for (let i = 0; i < lat.length; i++) lat[i] = r();
      for (let y = 0; y < H; y++) {
        const gy = y / p, iy = Math.floor(gy); let fy = gy - iy; fy = fy * fy * (3 - 2 * fy);
        const r0 = iy * gw, r1 = r0 + gw;
        for (let x = 0; x < W; x++) {
          const gx = x / pxn, ix = Math.floor(gx); let fx = gx - ix; fx = fx * fx * (3 - 2 * fx);
          const a = lat[r0 + ix], b = lat[r0 + ix + 1], c = lat[r1 + ix], d = lat[r1 + ix + 1];
          grain[y * W + x] += wt * (a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy);
        }
      }
      o++;
    }
    // equalise to uniform [0,1]
    const NB = 4096, hist = new Float64Array(NB);
    for (let i = 0; i < grain.length; i++) hist[Math.min(NB - 1, (grain[i] * NB) | 0)]++;
    let acc = 0; const cdf = new Float32Array(NB);
    for (let i = 0; i < NB; i++) { acc += hist[i]; cdf[i] = acc / grain.length; }
    for (let i = 0; i < grain.length; i++) grain[i] = cdf[Math.min(NB - 1, (grain[i] * NB) | 0)];
  }

  // pts: [[x,y,(p)]...] virtual coords. o: tool options.
  stroke(pts, o) {
    const n0 = pts.length; if (n0 < 2) return;
    const S = this.S, W = this.W, H = this.H, R = this.rand;
    const hw = Math.max(0.3, o.w * S * 0.5);
    const flat = o.flat ? 1 : 0;
    // cumulative length
    const cum = new Float32Array(n0); let total = 0;
    for (let i = 1; i < n0; i++) { total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * S; cum[i] = total; }
    if (total < 0.01) return;
    const step = Math.max(0.8, hw * (flat ? 0.45 : 0.5));
    const m = Math.max(2, Math.ceil(total / step) + 1);
    const xs = new Float32Array(m), ys = new Float32Array(m), ps = new Float32Array(m);
    const tin = o.tin === undefined ? 0.08 : o.tin, tout = o.tout === undefined ? 0.12 : o.tout;
    const pv = o.pv === undefined ? 0.12 : o.pv;
    const a1 = R() * 6.283, a2 = R() * 6.283, f1 = (0.035 + R() * 0.05) / S, f2 = (0.12 + R() * 0.12) / S;
    let j = 0;
    for (let k = 0; k < m; k++) {
      const d = total * k / (m - 1);
      while (j < n0 - 2 && cum[j + 1] < d) j++;
      const seg = cum[j + 1] - cum[j], t = seg > 1e-6 ? (d - cum[j]) / seg : 0;
      const A = pts[j], B = pts[j + 1];
      xs[k] = (A[0] + (B[0] - A[0]) * t) * S; ys[k] = (A[1] + (B[1] - A[1]) * t) * S;
      const pa = A[2] === undefined ? 1 : A[2], pb = B[2] === undefined ? 1 : B[2];
      const u = k / (m - 1);
      let tp = 1;
      if (tin > 0 && u < tin) tp = 0.35 + 0.65 * (u / tin);
      if (tout > 0 && u > 1 - tout) tp = Math.min(tp, 0.25 + 0.75 * ((1 - u) / tout));
      const nz = (Math.sin(a1 + d * f1) + 0.5 * Math.sin(a2 + d * f2)) / 1.5;
      ps[k] = o.P * (pa + (pb - pa) * t) * tp * (1 + pv * nz);
    }
    let tab = null; const TN = 40;
    if (flat) {
      tab = new Float32Array(TN);
      const sa = o.sa === undefined ? 0.3 : o.sa;
      let v = R();
      for (let i = 0; i < TN; i++) { v = v * 0.6 + R() * 0.4; tab[i] = 1 - sa * v * 1.4; }
      // worn stick edges
      tab[0] *= 0.55 + 0.3 * R(); tab[1] *= 0.8 + 0.2 * R(); tab[TN - 1] *= 0.55 + 0.3 * R(); tab[TN - 2] *= 0.8 + 0.2 * R();
    }
    const id = ++this.id; this.nstrokes++;
    const cr = o.col[0], cg = o.col[1], cb = o.col[2];
    const tr = o.tr || 0, op = o.op === undefined ? 0.9 : o.op, soft = o.soft || 0.2, load = o.load || 0.1, fk = o.fk === undefined ? 1 : o.fk;
    const isoft = 1 / (2 * soft), ga = o.ga === undefined ? 1 : o.ga, gb = 0.5 * (1 - ga);
    const { px, grain, fill, sid, scov } = this;
    const lim = (hw + 0.7) * (hw + 0.7);
    for (let k = 0; k < m - 1; k++) {
      const x0 = xs[k], y0 = ys[k], x1 = xs[k + 1], y1 = ys[k + 1];
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy;
      if (L2 < 1e-9) continue;
      const P0 = ps[k], P1 = ps[k + 1];
      let bx0 = Math.floor(Math.min(x0, x1) - hw - 1), bx1 = Math.ceil(Math.max(x0, x1) + hw + 1);
      let by0 = Math.floor(Math.min(y0, y1) - hw - 1), by1 = Math.ceil(Math.max(y0, y1) + hw + 1);
      if (bx0 < 0) bx0 = 0; if (by0 < 0) by0 = 0; if (bx1 > W - 1) bx1 = W - 1; if (by1 > H - 1) by1 = H - 1;
      const tlo = flat ? (k === 0 ? 0 : -0.3) : 0, thi = flat ? (k === m - 2 ? 1 : 1.3) : 1;
      const iL2 = 1 / L2;
      for (let y = by0; y <= by1; y++) {
        const py = y + 0.5 - y0; let i = y * W + bx0;
        for (let x = bx0; x <= bx1; x++, i++) {
          const pxx = x + 0.5 - x0;
          let t = (pxx * dx + py * dy) * iL2;
          if (flat) { if (t < tlo || t > thi) continue; }
          else { if (t < 0) t = 0; else if (t > 1) t = 1; }
          const ex = pxx - t * dx, ey = py - t * dy, d2 = ex * ex + ey * ey;
          if (d2 >= lim) continue;
          const d = Math.sqrt(d2);
          let aa = hw + 0.5 - d; if (aa <= 0) continue; if (aa > 1) aa = 1;
          const u = d / hw;
          const tt = t < 0 ? 0 : t > 1 ? 1 : t;
          let Pp = P0 + (P1 - P0) * tt;
          if (flat) {
            const sg = (pxx * -dy + py * dx) > 0 ? 1 : -1;
            let ix = ((sg * u * 0.5 + 0.5) * (TN - 1) + 0.5) | 0; if (ix < 0) ix = 0; else if (ix > TN - 1) ix = TN - 1;
            Pp *= tab[ix];
          } else Pp *= 1 - 0.3 * u * u;
          const ge = gb + grain[i] * ga + fill[i] * fk;
          let c = (ge - 1 + Pp) * isoft + 0.5;
          if (c <= 0) continue; if (c > 1) c = 1;
          c = c * c * (3 - 2 * c);
          const a = c * op * aa;
          let prev = 0;
          if (sid[i] === id) prev = scov[i]; else { sid[i] = id; scov[i] = 0; }
          if (a <= prev) continue;
          const inc = (a - prev) / (1 - prev + 1e-6);
          scov[i] = a;
          const q = i * 3, r0 = px[q], g0 = px[q + 1], b0 = px[q + 2];
          px[q] = r0 + (cr * (1 - tr + tr * r0) - r0) * inc;
          px[q + 1] = g0 + (cg * (1 - tr + tr * g0) - g0) * inc;
          px[q + 2] = b0 + (cb * (1 - tr + tr * b0) - b0) * inc;
          fill[i] += inc * load;
        }
      }
    }
  }

  // finger / stump smear along a path
  smudge(pts, o) {
    const S = this.S, W = this.W, H = this.H, { px, fill } = this;
    const r = o.r * S, str = o.str === undefined ? 0.25 : o.str, pick = o.pick === undefined ? 0.35 : o.pick;
    const r2 = r * r, step = Math.max(1, r * 0.3), st = Math.max(1, Math.floor(r / 7));
    let car = null;
    for (let s = 0; s < pts.length - 1; s++) {
      const ax = pts[s][0] * S, ay = pts[s][1] * S, bx = pts[s + 1][0] * S, by = pts[s + 1][1] * S;
      const L = Math.hypot(bx - ax, by - ay), nn = Math.max(1, Math.round(L / step));
      for (let k = 0; k < nn; k++) {
        const cx = ax + (bx - ax) * k / nn, cy = ay + (by - ay) * k / nn;
        const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(W - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(H - 1, Math.ceil(cy + r));
        if (x1 < x0 || y1 < y0) continue;
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let y = y0; y <= y1; y += st) for (let x = x0; x <= x1; x += st) {
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d2 >= r2) continue;
          const w = 1 - d2 / r2, q = (y * W + x) * 3;
          sr += px[q] * w; sg += px[q + 1] * w; sb += px[q + 2] * w; sw += w;
        }
        if (sw <= 0) continue;
        sr /= sw; sg /= sw; sb /= sw;
        if (!car) car = [sr, sg, sb];
        else { car[0] += (sr - car[0]) * pick; car[1] += (sg - car[1]) * pick; car[2] += (sb - car[2]) * pick; }
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy); if (d2 >= r2) continue;
          let f = 1 - d2 / r2; f = f * f * str;
          const i = y * W + x, q = i * 3;
          px[q] += (car[0] - px[q]) * f; px[q + 1] += (car[1] - px[q + 1]) * f; px[q + 2] += (car[2] - px[q + 2]) * f;
          fill[i] += f * 0.3;
        }
      }
    }
  }

  // rubbed-in pastel dust (soft, slightly grain dependent)
  dust(x, y, r, col, a, ry) {
    const S = this.S, W = this.W, H = this.H, { px, grain, fill } = this;
    const cx = x * S, cy = y * S, rx = r * S, ryy = (ry === undefined ? r : ry) * S;
    const x0 = Math.max(0, Math.floor(cx - rx * 2.4)), x1 = Math.min(W - 1, Math.ceil(cx + rx * 2.4));
    const y0 = Math.max(0, Math.floor(cy - ryy * 2.4)), y1 = Math.min(H - 1, Math.ceil(cy + ryy * 2.4));
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      const ux = (xx - cx) / rx, uy = (yy - cy) / ryy, d2 = ux * ux + uy * uy;
      if (d2 > 5.76) continue;
      const i = yy * W + xx, q = i * 3;
      let f = Math.exp(-d2 * 0.9) - 0.0056; if (f <= 0) continue;
      f *= a * (0.82 + 0.36 * grain[i]);
      if (f > 1) f = 1;
      px[q] += (col[0] - px[q]) * f; px[q + 1] += (col[1] - px[q + 1]) * f; px[q + 2] += (col[2] - px[q + 2]) * f;
      fill[i] += f * 0.2;
    }
  }

  toBytes(x0, y0, w, h, down) {
    const { px, W } = this; down = down || 1;
    const ow = Math.floor(w / down), oh = Math.floor(h / down);
    const out = Buffer.alloc(ow * oh * 3);
    const lin = v => v <= 0 ? 0 : v >= 1 ? 1 : Math.pow(v, 2.2);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      let r = 0, g = 0, b = 0;
      if (down === 1) { const q = ((y0 + y) * W + x0 + x) * 3; r = px[q]; g = px[q + 1]; b = px[q + 2]; }
      else {
        for (let j = 0; j < down; j++) for (let i = 0; i < down; i++) {
          const q = ((y0 + y * down + j) * W + x0 + x * down + i) * 3;
          r += lin(px[q]); g += lin(px[q + 1]); b += lin(px[q + 2]);
        }
        const k = 1 / (down * down);
        r = Math.pow(r * k, 1 / 2.2); g = Math.pow(g * k, 1 / 2.2); b = Math.pow(b * k, 1 / 2.2);
      }
      const o = (y * ow + x) * 3;
      out[o] = clamp(Math.round(r * 255), 0, 255); out[o + 1] = clamp(Math.round(g * 255), 0, 255); out[o + 2] = clamp(Math.round(b * 255), 0, 255);
    }
    return { data: out, w: ow, h: oh };
  }
  save(path, crop, down) {
    const c = crop || [0, 0, this.W, this.H];
    const { data, w, h } = this.toBytes(c[0], c[1], c[2], c[3], down || 1);
    writePNG(path, data, w, h);
  }
}

let CRC = null;
function crc32(buf) {
  if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function writePNG(path, rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]));
}

// ---- tool presets -------------------------------------------------------
const T = {
  pencil: { flat: 0, ga: 0.6, soft: 0.22, op: 0.86, tr: 0.32, load: 0.09, fk: 0.8, pv: 0.16, tin: 0.1, tout: 0.16 },
  pastel: { flat: 1, soft: 0.3, op: 0.93, tr: 0.04, load: 0.2, fk: 1, pv: 0.13, sa: 0.3, tin: 0.03, tout: 0.05 },
  ptip: { flat: 0, soft: 0.3, op: 0.92, tr: 0.04, load: 0.2, fk: 1, pv: 0.14, tin: 0.06, tout: 0.1 },
  oil: { flat: 0, ga: 0.8, soft: 0.11, op: 0.97, tr: 0.02, load: 0.45, fk: 1.2, pv: 0.1, tin: 0.04, tout: 0.06 },
  conte: { flat: 0, ga: 0.85, soft: 0.22, op: 0.9, tr: 0.12, load: 0.18, fk: 0.9, pv: 0.15, tin: 0.06, tout: 0.1 },
};

module.exports = { Paper, T, rng32, hex, clamp, lerp, mixc, sstep, vnoise, fbm, hash2, writePNG };
