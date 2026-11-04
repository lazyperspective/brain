// The Observatory: core library.
// Seeded PRNG, simplex noise, colour helpers, geometry, ink primitives, masks,
// and the two hatching engines: threshold-level parallel engraving and
// Jobard-Lefer evenly spaced streamlines.
'use strict';
(function () {
  const OB = (window.OB = window.OB || {});
  OB.W = 2160;
  OB.H = 3840;
  OB.TAU = Math.PI * 2;
  const clamp = (OB.clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v));
  const lerp = (OB.lerp = (a, b, t) => a + (b - a) * t);
  OB.smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };

  // ---------------------------------------------------------------- PRNG (sfc32)
  OB.rng = function (seed) {
    let a = 0x9e3779b9 ^ seed,
      b = 0x243f6a88 ^ Math.imul(seed, 31),
      c = 0xb7e15162 ^ Math.imul(seed, 131),
      d = 0x12345678 ^ Math.imul(seed, 7);
    const next = function () {
      a |= 0; b |= 0; c |= 0; d |= 0;
      const t = (((a + b) | 0) + d) | 0;
      d = (d + 1) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
    for (let i = 0; i < 24; i++) next();
    const r = () => next();
    r.range = (lo, hi) => lo + (hi - lo) * next();
    r.int = (lo, hi) => lo + Math.floor((hi - lo + 1) * next());
    r.chance = (p) => next() < p;
    r.pick = (arr) => arr[Math.floor(next() * arr.length)];
    r.sign = () => (next() < 0.5 ? -1 : 1);
    r.norm = () => {
      let u = 0;
      while (u === 0) u = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(OB.TAU * next());
    };
    return r;
  };

  // integer hash -> [0,1)
  OB.hash = (x, y) => {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
  // smooth value noise on a lattice of `s` px, no tiling
  OB.vnoise = (x, y, s) => {
    const fx = x / s, fy = y / s;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy;
    tx = tx * tx * (3 - 2 * tx);
    ty = ty * ty * (3 - 2 * ty);
    const a = OB.hash(ix, iy), b = OB.hash(ix + 1, iy), c = OB.hash(ix, iy + 1), d = OB.hash(ix + 1, iy + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };

  // ---------------------------------------------------------------- simplex noise
  OB.noise = function (seed) {
    const r = OB.rng(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    const perm = new Uint8Array(512), pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] % 12; }
    const G = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1];
    const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
    function n2(xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { const g = pm[ii + perm[jj]] * 2; tt *= tt; n += tt * tt * (G[g] * x0 + G[g + 1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { const g = pm[ii + i1 + perm[jj + j1]] * 2; tt *= tt; n += tt * tt * (G[g] * x1 + G[g + 1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { const g = pm[ii + 1 + perm[jj + 1]] * 2; tt *= tt; n += tt * tt * (G[g] * x2 + G[g + 1] * y2); }
      return 70 * n;
    }
    n2.fbm = (x, y, oct = 4, lac = 2.03, gain = 0.5) => {
      let a = 1, f = 1, s = 0, nrm = 0;
      for (let o = 0; o < oct; o++) { s += a * n2(x * f + o * 17.31, y * f - o * 9.13); nrm += a; a *= gain; f *= lac; }
      return s / nrm;
    };
    n2.ridged = (x, y, oct = 4, lac = 2.1, gain = 0.5) => {
      let a = 1, f = 1, s = 0, nrm = 0;
      for (let o = 0; o < oct; o++) { s += a * (1 - Math.abs(n2(x * f + o * 31.7, y * f + o * 7.7))); nrm += a; a *= gain; f *= lac; }
      return s / nrm;
    };
    return n2;
  };
  OB.N = OB.noise(7);

  // ---------------------------------------------------------------- colour
  OB.hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  OB.mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  OB.css = (c, a) =>
    a === undefined || a >= 1
      ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
      : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, a).toFixed(3)})`;
  OB.C = {}; // palette, filled by main.js
  OB.col = (name) => OB.C[name];

  // ---------------------------------------------------------------- warm light
  // OB.lights: {x, y, r, i, sy (vertical squash), tags: [layer tags it reaches]}
  OB.lights = [];
  OB.warm = (x, y, tag) => {
    let s = 0;
    const L = OB.lights;
    for (let k = 0; k < L.length; k++) {
      const l = L[k];
      if (tag && l.tags && l.tags.indexOf(tag) < 0) continue;
      const dx = x - l.x, dy = (y - l.y) * (l.sy || 1);
      const d2 = dx * dx + dy * dy;
      if (d2 < l.r * l.r) {
        const t = 1 - Math.sqrt(d2) / l.r;
        s += l.i * t * t;
      }
    }
    return s > 1 ? 1 : s;
  };

  // ---------------------------------------------------------------- geometry
  OB.dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  OB.chaikin = (pts, it = 2, closed = false) => {
    let p = pts;
    for (let k = 0; k < it; k++) {
      const q = [];
      const n = p.length;
      if (!closed) q.push(p[0]);
      for (let i = 0; i < (closed ? n : n - 1); i++) {
        const a = p[i], b = p[(i + 1) % n];
        q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25, ...(a.length > 2 ? [a[2] * 0.75 + b[2] * 0.25] : [])]);
        q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75, ...(a.length > 2 ? [a[2] * 0.25 + b[2] * 0.75] : [])]);
      }
      if (!closed) q.push(p[n - 1]);
      p = q;
    }
    return p;
  };
  // resample a polyline to uniform spacing; carries a 3rd component if present
  OB.resample = (pts, sp, closed = false) => {
    const src = closed ? pts.concat([pts[0]]) : pts;
    const out = [src[0].slice()];
    let carry = 0;
    for (let i = 1; i < src.length; i++) {
      const a = src[i - 1], b = src[i];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L === 0) continue;
      let d = sp - carry;
      while (d <= L) {
        const t = d / L;
        const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        if (a.length > 2) q.push(a[2] + (b[2] - a[2]) * t);
        out.push(q);
        d += sp;
      }
      carry = L - (d - sp);
    }
    if (!closed) {
      const last = src[src.length - 1];
      if (OB.dist(out[out.length - 1], last) > sp * 0.3) out.push(last.slice());
    } else if (out.length > 2 && OB.dist(out[out.length - 1], out[0]) < sp * 0.5) out.pop();
    return out;
  };
  // displace a polyline along its normals with fbm, for hand-cut edges
  OB.roughen = (pts, closed, amp, freq, seed = 0, sp = 4) => {
    const r = OB.resample(pts, sp, closed);
    const n = r.length, N = OB.N;
    const out = [];
    let s = 0;
    for (let i = 0; i < n; i++) {
      const a = r[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = r[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      if (i > 0) s += OB.dist(r[i], r[i - 1]);
      let d = amp * N.fbm(s * freq + seed * 13.7, seed * 3.1, 3);
      if (closed) { const tail = (n - i) * sp; if (tail < 40) d *= tail / 40; if (s < 40) d *= s / 40; }
      out.push([r[i][0] + nx * d, r[i][1] + ny * d]);
    }
    return out;
  };
  OB.path = (pts, closed = true, P) => {
    const p = P || new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (closed) p.closePath();
    return p;
  };
  OB.bbox = (pts) => {
    let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
    for (const p of pts) { if (p[0] < a) a = p[0]; if (p[1] < b) b = p[1]; if (p[0] > c) c = p[0]; if (p[1] > d) d = p[1]; }
    return [a, b, c, d];
  };
  OB.area = (pts) => {
    let s = 0;
    for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  };
  OB.centroid = (pts) => {
    let x = 0, y = 0;
    for (const p of pts) { x += p[0]; y += p[1]; }
    return [x / pts.length, y / pts.length];
  };
  OB.inPoly = (x, y, pts) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i], b = pts[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };
  // keep the part of polygon where (q-m).n <= 0
  OB.clipHalf = (poly, mx, my, nx, ny) => {
    const out = [];
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const da = (a[0] - mx) * nx + (a[1] - my) * ny, db = (b[0] - mx) * nx + (b[1] - my) * ny;
      if (da <= 0) out.push(a);
      if ((da <= 0) !== (db <= 0)) {
        const t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return out;
  };
  // scale a polygon about a centre
  OB.scalePoly = (pts, cx, cy, s) => pts.map((p) => [cx + (p[0] - cx) * s, cy + (p[1] - cy) * s]);
  // point on a Catmull-Rom spline through pts at parameter t (0..1)
  OB.spline = (pts, segLen = 4) => {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
      const L = OB.dist(p1, p2);
      const steps = Math.max(2, Math.ceil(L / segLen));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        const f = (k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
        const q = [f(0), f(1)];
        if (p1.length > 2) q.push(lerp(p1[2], p2[2], t));
        out.push(q);
      }
    }
    out.push(pts[n - 1].slice());
    return out;
  };

  // ---------------------------------------------------------------- ink primitives
  // Adds a variable-width ribbon around polyline `pts` (widths `ws`) as a closed subpath of P.
  OB.ribbon = (P, pts, ws) => {
    const n = pts.length;
    if (n < 2) return;
    const L = new Array(n), Rr = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[i > 0 ? i - 1 : 0], b = pts[i < n - 1 ? i + 1 : n - 1];
      let nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const l = Math.hypot(nx, ny) || 1;
      const h = ws[i] * 0.5;
      nx = (nx / l) * h; ny = (ny / l) * h;
      L[i] = [pts[i][0] + nx, pts[i][1] + ny];
      Rr[i] = [pts[i][0] - nx, pts[i][1] - ny];
    }
    P.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) P.lineTo(L[i][0], L[i][1]);
    for (let i = n - 1; i >= 0; i--) P.lineTo(Rr[i][0], Rr[i][1]);
    P.closePath();
  };
  // Tapered, pressure-varying ink line. o: t0,t1 taper fractions; wn width noise; ph noise phase; min
  OB.inkWidths = (pts, w, o = {}) => {
    const n = pts.length;
    const t0 = o.t0 === undefined ? 0.12 : o.t0, t1 = o.t1 === undefined ? 0.18 : o.t1;
    const wn = o.wn === undefined ? 0.28 : o.wn, ph = o.ph || 0, mn = o.min === undefined ? 0.12 : o.min;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + OB.dist(pts[i], pts[i - 1]));
    const tot = cum[n - 1] || 1;
    const ws = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = cum[i] / tot;
      let p = 1;
      if (t0 > 0 && t < t0) p = Math.sqrt(t / t0);
      if (t1 > 0 && t > 1 - t1) p = Math.min(p, Math.sqrt((1 - t) / t1));
      p = Math.max(p, mn);
      ws[i] = w * p * (1 + wn * OB.N(cum[i] * 0.02 + ph, ph * 0.37));
    }
    return ws;
  };
  OB.ink = (P, pts, w, o) => OB.ribbon(P, pts, OB.inkWidths(pts, w, o));
  // a wobbly hand line between two points
  OB.wline = (x0, y0, x1, y1, seg = 6, amp = 0.8, ph = 0) => {
    const L = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.ceil(L / seg));
    const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const d = amp * OB.N(t * L * 0.02 + ph, ph * 1.7);
      out.push([x0 + (x1 - x0) * t + nx * d, y0 + (y1 - y0) * t + ny * d]);
    }
    return out;
  };
  // batch helper: Map<css, Path2D>
  OB.Batch = class {
    constructor() { this.m = new Map(); }
    get(k) { let p = this.m.get(k); if (!p) { p = new Path2D(); this.m.set(k, p); } return p; }
    fill(ctx) { for (const [k, p] of this.m) { ctx.fillStyle = k; ctx.fill(p); } this.m.clear(); }
    stroke(ctx, w) { for (const [k, p] of this.m) { ctx.strokeStyle = k; ctx.lineWidth = w; ctx.stroke(p); } this.m.clear(); }
  };
  // colour with warm light, quantised for batching
  OB.warmCss = (base, x, y, tag, amt = 1, alpha) => {
    const w = OB.warm(x, y, tag) * amt;
    const q = Math.round(w * 8) / 8;
    if (q <= 0) return OB.css(base, alpha);
    return OB.css(OB.mix(base, OB.C.amberLine, Math.min(1, q * 1.15)), alpha);
  };

  // ---------------------------------------------------------------- masks
  OB.mask = (drawFn, s = 0.5) => {
    const w = Math.ceil(OB.W * s), h = Math.ceil(OB.H * s);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.setTransform(s, 0, 0, s, 0, 0);
    g.fillStyle = '#fff';
    g.strokeStyle = '#fff';
    drawFn(g);
    const d = g.getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    c.width = 1; c.height = 1;
    const M = {
      w, h, s, m,
      inside(x, y) {
        const ix = (x * s) | 0, iy = (y * s) | 0;
        if (ix < 0 || iy < 0 || ix >= w || iy >= h) return false;
        return m[iy * w + ix] === 1;
      },
    };
    return M;
  };

  // ---------------------------------------------------------------- flat poster fill
  // Fills region `clip` (Path2D) with posterised tones of valueFn. tones: [[upperBound, rgb], ...]
  OB.posterFill = (ctx, clip, bbox, valueFn, tones, o = {}) => {
    const x0 = Math.floor(bbox[0]), y0 = Math.floor(bbox[1]);
    const w = Math.ceil(bbox[2]) - x0, h = Math.ceil(bbox[3]) - y0;
    if (w <= 0 || h <= 0) return;
    const st = o.step || 6;
    const gw = Math.ceil(w / st) + 2, gh = Math.ceil(h / st) + 2;
    const G = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) G[j * gw + i] = valueFn(x0 + i * st, y0 + j * st);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const id = g.createImageData(w, h);
    const d = id.data;
    const dither = o.dither === undefined ? 0.025 : o.dither;
    const T = tones.map((t) => t[0]), CC = tones.map((t) => t[1]);
    const nt = T.length;
    for (let y = 0; y < h; y++) {
      const gy = y / st, jy = Math.floor(gy), ty = gy - jy;
      for (let x = 0; x < w; x++) {
        const gx = x / st, ix = Math.floor(gx), tx = gx - ix;
        const k = jy * gw + ix;
        const a = G[k], b = G[k + 1], cc = G[k + gw], dd = G[k + gw + 1];
        let v = a + (b - a) * tx + (cc - a) * ty + (a - b - cc + dd) * tx * ty;
        v += (OB.vnoise(x + x0, y + y0, 5) - 0.5) * dither + (OB.hash(x + x0, y + y0) - 0.5) * dither * 0.35;
        let ti = 0;
        while (ti < nt - 1 && v > T[ti]) ti++;
        const col = CC[ti], p = (y * w + x) * 4;
        d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    ctx.save();
    const mr = o.noReg ? [0, 0] : OB.MR;
    ctx.translate(mr[0], mr[1]);
    ctx.clip(clip);
    ctx.drawImage(c, x0, y0);
    ctx.restore();
    c.width = 1; c.height = 1;
  };
  OB.MR = [1.8, 1.1]; // fill misregistration (native px)
  OB.flatFill = (ctx, path, css) => {
    ctx.save();
    ctx.translate(OB.MR[0], OB.MR[1]);
    ctx.fillStyle = css;
    ctx.fill(path);
    ctx.restore();
  };

  // ---------------------------------------------------------------- engraving engine
  // Parallel (optionally warped) lines; each line has a threshold level, so the number of
  // lines present at a point follows darkness D(x,y); lines swell where darker and taper
  // out where the tone drops below their level, the way burin lines do.
  const BR16 = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15];
  OB.engrave = (ctx, o) => {
    const a = o.angle || 0, ca = Math.cos(a), sa = Math.sin(a);
    const [x0, y0, x1, y1] = o.bbox;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hw = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    const step = o.step || 3, sp = o.sp, lv = o.levels || 8;
    const fade = o.fade || 0.2, w = o.w || 1.4, wmin = o.wmin || 0.35;
    const thr0 = o.thr0 || 0, thrR = o.thrRange === undefined ? 1 : o.thrRange;
    const R = OB.rng(o.seed || 1), N = OB.N;
    const wob = o.wob === undefined ? 0.7 : o.wob;
    const B = new OB.Batch();
    const seedPh = (o.seed || 1) * 0.731;
    const flush = (pts, ws) => {
      const n = pts.length;
      if (n < (o.minRun || 3)) return;
      for (let k = 0; k < n; k++) {
        const e = Math.min(1, (k + 1) / 3, (n - k) / 3);
        ws[k] *= Math.sqrt(e);
      }
      const m = pts[n >> 1];
      const key = o.colAt ? o.colAt(m[0], m[1]) : o.col;
      OB.ribbon(B.get(key), pts, ws);
    };
    let i = 0;
    for (let v = -hw; v <= hw; v += sp * (o.spJit ? 1 + (R() - 0.5) * o.spJit : 1), i++) {
      const lvl = BR16[i % lv] / (16 / lv);
      const thr = thr0 + ((lvl + 0.5) / lv) * thrR + (R() - 0.5) * 0.05;
      const ph = i * 7.13 + seedPh;
      let pts = null, ws = null;
      for (let u = -hw; u <= hw + step; u += step) {
        let vv = v + wob * N(u * 0.021 + ph, ph);
        if (o.warp) vv += o.warp(u, v);
        const x = cx + ca * u - sa * vv, y = cy + sa * u + ca * vv;
        let on = false, ww = 0;
        if (x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3 && (!o.inside || o.inside(x, y))) {
          const e = o.D(x, y) - thr + 0.06 * (OB.vnoise(u + ph * 50, v, 23) - 0.5);
          if (e > 0) {
            on = true;
            ww = Math.max(wmin, w * Math.min(1, e / fade)) * (o.wAt ? o.wAt(x, y) : 1);
          }
        }
        if (on) {
          if (!pts) { pts = []; ws = []; }
          pts.push([x, y]); ws.push(ww * (1 + 0.22 * N(u * 0.05, ph + 3)));
        } else if (pts) { flush(pts, ws); pts = null; }
      }
      if (pts) flush(pts, ws);
    }
    B.fill(ctx);
  };

  // ---------------------------------------------------------------- Jobard-Lefer streamlines
  OB.streamlines = (o) => {
    const { inside, angle, sep } = o;
    const R = OB.rng(o.seed || 3);
    const step = o.step || 2.5, dtest = o.dtest || 0.5, maxSteps = o.maxSteps || 600;
    const minLen = o.minLen || 10;
    const [bx0, by0, bx1, by1] = o.bbox;
    const cell = o.cell || 5;
    const gw = Math.ceil((bx1 - bx0) / cell) + 1, gh = Math.ceil((by1 - by0) / cell) + 1;
    const grid = new Array(gw * gh);
    const PX = [], PY = [];
    const lines = [];
    const free = (x, y, d) => {
      const r = Math.ceil(d / cell);
      const cx = ((x - bx0) / cell) | 0, cy = ((y - by0) / cell) | 0;
      const d2 = d * d;
      for (let j = cy - r; j <= cy + r; j++) {
        if (j < 0 || j >= gh) continue;
        for (let i = cx - r; i <= cx + r; i++) {
          if (i < 0 || i >= gw) continue;
          const a = grid[j * gw + i];
          if (!a) continue;
          for (let k = 0; k < a.length; k++) {
            const q = a[k], dx = PX[q] - x, dy = PY[q] - y;
            if (dx * dx + dy * dy < d2) return false;
          }
        }
      }
      return true;
    };
    const dirAt = (x, y, px, py) => {
      const a = angle(x, y);
      let dx = Math.cos(a), dy = Math.sin(a);
      if (dx * px + dy * py < 0) { dx = -dx; dy = -dy; }
      return [dx, dy];
    };
    const trace = (sx, sy, sgn) => {
      const pts = [];
      const a0 = angle(sx, sy);
      let x = sx, y = sy, px = Math.cos(a0) * sgn, py = Math.sin(a0) * sgn;
      for (let s = 0; s < maxSteps; s++) {
        let [dx, dy] = dirAt(x, y, px, py);
        [dx, dy] = dirAt(x + dx * step * 0.5, y + dy * step * 0.5, dx, dy);
        if (dx * px + dy * py < 0.6) break; // too sharp a turn
        const nx = x + dx * step, ny = y + dy * step;
        if (nx < bx0 || ny < by0 || nx > bx1 || ny > by1 || !inside(nx, ny)) break;
        if (!free(nx, ny, sep(nx, ny) * dtest)) break;
        pts.push([nx, ny]);
        x = nx; y = ny; px = dx; py = dy;
      }
      return pts;
    };
    const add = (pts) => {
      lines.push(pts);
      for (const p of pts) {
        const k = PX.length;
        PX.push(p[0]); PY.push(p[1]);
        const ci = (((p[1] - by0) / cell) | 0) * gw + (((p[0] - bx0) / cell) | 0);
        (grid[ci] || (grid[ci] = [])).push(k);
      }
    };
    const tryseed = (x, y) => {
      if (x < bx0 || y < by0 || x > bx1 || y > by1 || !inside(x, y)) return null;
      if (!free(x, y, sep(x, y))) return null;
      const f = trace(x, y, 1), b = trace(x, y, -1);
      const pts = b.reverse().concat([[x, y]], f);
      if (pts.length * step < minLen) return null;
      add(pts);
      return pts;
    };
    const queue = [];
    let qh = 0;
    const enqueue = (pts) => {
      for (let i = 0; i < pts.length; i += 3) {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b[1] - a[1]), ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l; ny /= l;
        const s = sep(pts[i][0], pts[i][1]);
        queue.push([pts[i][0] + nx * s, pts[i][1] + ny * s], [pts[i][0] - nx * s, pts[i][1] - ny * s]);
      }
    };
    const gs = o.seedGrid || 60;
    const seeds = [];
    for (let y = by0 + gs / 2; y < by1; y += gs) for (let x = bx0 + gs / 2; x < bx1; x += gs) seeds.push([x + (R() - 0.5) * gs, y + (R() - 0.5) * gs]);
    for (let i = seeds.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = seeds[i]; seeds[i] = seeds[j]; seeds[j] = t; }
    for (const s of seeds) {
      const L = tryseed(s[0], s[1]);
      if (!L) continue;
      enqueue(L);
      while (qh < queue.length) {
        const q = queue[qh++];
        const L2 = tryseed(q[0], q[1]);
        if (L2) enqueue(L2);
      }
    }
    return lines;
  };

  // ---------------------------------------------------------------- Voronoi cells
  OB.voronoi = (pts, bbox) => {
    const n = pts.length;
    const [x0, y0, x1, y1] = bbox;
    const cs = Math.max(4, Math.sqrt(((x1 - x0) * (y1 - y0)) / Math.max(1, n)));
    const gw = Math.ceil((x1 - x0) / cs) + 1, gh = Math.ceil((y1 - y0) / cs) + 1;
    const grid = new Array(gw * gh);
    const gx = (x) => Math.min(gw - 1, Math.max(0, ((x - x0) / cs) | 0));
    const gy = (y) => Math.min(gh - 1, Math.max(0, ((y - y0) / cs) | 0));
    pts.forEach((p, i) => { const k = gy(p[1]) * gw + gx(p[0]); (grid[k] || (grid[k] = [])).push(i); });
    const cells = [];
    for (let i = 0; i < n; i++) {
      const [px, py] = pts[i];
      let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      const cx = gx(px), cy = gy(py);
      for (let ring = 0; ring < Math.max(gw, gh); ring++) {
        for (let j = cy - ring; j <= cy + ring; j++) {
          if (j < 0 || j >= gh) continue;
          const edge = j === cy - ring || j === cy + ring;
          for (let ii = cx - ring; ii <= cx + ring; ii += edge ? 1 : 2 * ring || 1) {
            if (ii < 0 || ii >= gw) continue;
            const a = grid[j * gw + ii];
            if (!a) continue;
            for (const q of a) {
              if (q === i) continue;
              const [qx, qy] = pts[q];
              poly = OB.clipHalf(poly, (px + qx) / 2, (py + qy) / 2, qx - px, qy - py);
              if (poly.length < 3) break;
            }
          }
        }
        if (poly.length < 3) break;
        let md = 0;
        for (const v of poly) md = Math.max(md, Math.hypot(v[0] - px, v[1] - py));
        if (ring * cs >= 2 * md) break;
      }
      cells.push(poly);
    }
    return cells;
  };

  // ---------------------------------------------------------------- misc drawing
  // soft additive glow (the only gradients in the piece: light itself)
  OB.glow = (ctx, x, y, r, rgb, a, mode = 'lighter') => {
    ctx.save();
    ctx.globalCompositeOperation = mode;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, OB.css(rgb, a));
    g.addColorStop(0.25, OB.css(rgb, a * 0.45));
    g.addColorStop(0.6, OB.css(rgb, a * 0.12));
    g.addColorStop(1, OB.css(rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  };
  OB.yieldFrame = () => new Promise((r) => setTimeout(r, 0));
})();
