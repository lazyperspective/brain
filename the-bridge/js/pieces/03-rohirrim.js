/* Drawings from Middle-earth — 03 · "The Ride of the Rohirrim"
 * A battle cartoon in trois crayons (red, black and white chalk) on toned paper, made at runtime.
 *
 * How it is made: every mark is laid into one of two pigment layers, each holding the three chalks in
 * its three colour channels. The "stroke" layer is what the chalk deposits directly; at the end it is
 * filtered through a simulated paper tooth (with laid and chain lines), so light pressure catches only
 * the peaks of the grain. The "stump" layer is chalk rubbed in with a stump: smooth, soft-edged.
 * Figures in front reserve (wipe) the paper before they are drawn, as a draughtsman leaves paper bare.
 * Horses are articulated in profile on a four-beat transverse gallop with keyframed joint angles, and
 * hatched along a lighting field built from simple anatomical volumes. All randomness is seeded.
 */
(function () {
  'use strict';

  /* ============================================================== utilities */
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  function makeNoise(rand) {
    const P = new Uint16Array(512), G = new Float32Array(256);
    for (let i = 0; i < 256; i++) { P[i] = i; G[i] = rand(); }
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = P[i]; P[i] = P[j]; P[j] = t; }
    for (let i = 0; i < 256; i++) P[i + 256] = P[i];
    function v2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const X = xi & 255, Y = yi & 255;
      const a = G[P[X + P[Y]]], b = G[P[X + 1 + P[Y]]], c = G[P[X + P[Y + 1]]], d = G[P[X + 1 + P[Y + 1]]];
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, o) {
      let s = 0, a = 0.5, f = 1, n = 0;
      for (let i = 0; i < (o || 4); i++) { s += a * v2(x * f + i * 17.3, y * f - i * 9.1); n += a; a *= 0.5; f *= 2.03; }
      return s / n;
    }
    return { v2, fbm };
  }

  function spline(pts, closed, per) {
    const out = [], n = pts.length;
    const P = (i) => closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)];
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let j = 0; j < per; j++) {
        const t = j / per, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  function pathOf(pts, closed) {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (closed !== false) p.closePath();
    return p;
  }
  function addPoly(p, pts) { p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath(); }
  function bbox(pts, pad) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of pts) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    pad = pad || 0;
    return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
  }
  function ellipsePts(cx, cy, rx, ry, rot, n, a0, a1) {
    const out = [], c = Math.cos(rot), s = Math.sin(rot);
    a0 = a0 || 0; a1 = a1 === undefined ? TAU : a1;
    const full = Math.abs(a1 - a0 - TAU) < 1e-6;
    for (let i = 0; i <= n; i++) {
      if (full && i === n) break;
      const a = a0 + (a1 - a0) * (i / n), x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      out.push([cx + x * c - y * s, cy + x * s + y * c]);
    }
    return out;
  }
  /* a tapered limb between joints: pts, half-widths */
  function limb(pts, ws) {
    const l = [], r = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      const d = [p1[0] - p0[0], p1[1] - p0[1]]; const ll = Math.hypot(d[0], d[1]) || 1; const n = [-d[1] / ll, d[0] / ll];
      l.push([pts[i][0] + n[0] * ws[i], pts[i][1] + n[1] * ws[i]]); r.push([pts[i][0] - n[0] * ws[i], pts[i][1] - n[1] * ws[i]]);
    }
    return l.concat(r.reverse());
  }

  /* ======================================================= chalk machinery */
  const RED = 0, BLK = 1, WHT = 2;
  const CHS = ['255,0,0', '0,255,0', '0,0,255'];
  /* the dawn is low on the left: figures are lit from behind, rims white, fronts in shadow */
  const LIGHT = (() => { const v = [-0.78, -0.45, 0.46]; const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();
  const LD2 = (() => { const l = Math.hypot(LIGHT[0], LIGHT[1]); return [LIGHT[0] / l, LIGHT[1] / l]; })();

  class Batch {
    constructor(ctx) { this.c = ctx; this.m = new Map(); this.n = 0; }
    p(ch, a, w) {
      const qa = a >= 1 ? 24 : Math.max(1, Math.round(a * 24));
      const qw = Math.max(1, Math.min(1023, Math.round(w * 4)));
      const key = (ch * 32 + qa) * 1024 + qw;
      let p = this.m.get(key);
      if (!p) { p = new Path2D(); this.m.set(key, p); }
      this.n++;
      return p;
    }
    line(ch, a, w, x0, y0, x1, y1) { if (a < 0.03) return; const p = this.p(ch, a, w); p.moveTo(x0, y0); p.lineTo(x1, y1); }
    quad(ch, a, w, x0, y0, cx, cy, x1, y1) { if (a < 0.03) return; const p = this.p(ch, a, w); p.moveTo(x0, y0); p.quadraticCurveTo(cx, cy, x1, y1); }
    poly(ch, a, w, pts) {
      if (a < 0.03 || pts.length < 2) return;
      const p = this.p(ch, a, w);
      p.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    }
    flush() {
      if (!this.n) return;
      const c = this.c;
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [key, p] of this.m) {
        const qw = key % 1024, r = (key - qw) / 1024, qa = r % 32, ch = (r - qa) / 32;
        c.strokeStyle = 'rgba(' + CHS[ch] + ',' + (qa / 24).toFixed(3) + ')';
        c.lineWidth = qw / 4;
        c.stroke(p);
      }
      this.m.clear(); this.n = 0;
    }
  }

  /* one chalk stroke: a light full-length pass and a heavier, front-loaded core */
  function stroke(B, ch, x0, y0, x1, y1, bend, w, a) {
    if (a < 0.03) return;
    const dx = x1 - x0, dy = y1 - y0;
    const cx = (x0 + x1) / 2 - dy * bend, cy = (y0 + y1) / 2 + dx * bend;
    B.quad(ch, a * 0.62, w, x0, y0, cx, cy, x1, y1);
    const q = (t) => { const u = 1 - t; return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]; };
    const A = q(0.1), M = q(0.42), Z = q(0.78);
    B.quad(ch, a * 0.5, w * 0.78, A[0], A[1], 2 * M[0] - (A[0] + Z[0]) / 2, 2 * M[1] - (A[1] + Z[1]) / 2, Z[0], Z[1]);
  }

  /* parallel hatching over a box; fn(x, y, out) fills pressures for the three chalks.
     With o.st the stroke is also rubbed into the stump layer (soft tone beneath the lines). */
  const HO = new Float32Array(3);
  function hatch(R, o) {
    const B = R.B, BT = R.BT, rand = R.rand;
    const ca = Math.cos(o.ang), sa = Math.sin(o.ang), nx = -sa, ny = ca;
    const cx = (o.x0 + o.x1) / 2, cy = (o.y0 + o.y1) / 2;
    const rad = Math.hypot(o.x1 - o.x0, o.y1 - o.y0) / 2 + 2;
    const sp = o.sp, len = o.len, w = o.w, bend = o.bend || 0.04, jit = o.jit === undefined ? 0.5 : o.jit;
    const chs = o.chs || [RED, BLK, WHT], st = o.st || 0;
    let li = 0;
    for (let off = -rad; off <= rad; off += sp, li++) {
      let along = -rad - rand() * len;
      const dense = (li & 1) === 1;
      while (along < rad) {
        const L = len * (0.65 + rand() * 0.7);
        const j = (rand() - 0.5) * sp * jit;
        const mx = cx + nx * (off + j) + ca * (along + L / 2), my = cy + ny * (off + j) + sa * (along + L / 2);
        along += L * (0.9 + rand() * 0.45);
        if (mx < o.x0 || mx > o.x1 || my < o.y0 || my > o.y1) continue;
        HO[0] = HO[1] = HO[2] = 0;
        if (!o.fn(mx, my, HO)) continue;
        const hx = ca * L / 2, hy = sa * L / 2;
        const b = (rand() - 0.5) * bend * 2 + bend * 0.5;
        for (const ch of chs) {
          let p = HO[ch];
          if (st && !dense && p > 0.08 && ch !== WHT) BT.line(ch, p * st, w * 4, mx - hx, my - hy, mx + hx, my + hy);
          if (dense) { if (p < (o.dth || 0.42)) continue; p = Math.min(1, p * 0.9); }
          if (p > 0.035) stroke(B, ch, mx - hx, my - hy, mx + hx, my + hy, b, w * (0.8 + rand() * 0.4), Math.min(1, p));
        }
      }
    }
  }

  /* searching contour: several broken passes, pressure heavier on the side turned from the light */
  function contour(R, pts, o) {
    const n = pts.length; if (n < 3) return;
    const B = R.B, rand = R.rand, closed = o.closed !== false;
    let area = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; area += a[0] * b[1] - b[0] * a[1]; }
    const sg = (o.flip ? -1 : 1) * (area > 0 ? 1 : -1);
    const nrm = new Array(n), prs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const nx = ty * sg, ny = -tx * sg;
      nrm[i] = [nx, ny];
      const facing = nx * LD2[0] + ny * LD2[1];
      prs[i] = o.flat ? 1 : 0.22 + 0.78 * smooth(-0.6, 0.5, -facing);
    }
    const passes = o.passes || 2, wob = o.wob || 1.2, a0 = o.a || 0.6, w = o.w || 1.6, ch = o.ch === undefined ? RED : o.ch;
    for (let ps = 0; ps < passes; ps++) {
      const ph = rand() * 100, fr = 0.02 + rand() * 0.03;
      const shift = (ps === 0 ? 0 : (rand() - 0.5) * wob * 1.8);
      let i = o.from || 0; const end = o.to === undefined ? (closed ? n : n - 1) : o.to;
      while (i < end) {
        const run = 5 + ((rand() * 20) | 0);
        const seg = [];
        let pm = 0;
        for (let j = i; j <= Math.min(end, i + run); j++) {
          const q = pts[j % n], m = nrm[j % n];
          const off = shift + wob * (Math.sin(j * fr * 6 + ph) * 0.6 + (rand() - 0.5) * 0.35);
          seg.push([q[0] + m[0] * off, q[1] + m[1] * off]);
          pm += prs[j % n] * (o.pf ? o.pf(j % n) : 1);
        }
        pm /= seg.length;
        const a = a0 * pm * (ps === 0 ? 1 : 0.6) * (0.75 + rand() * 0.5);
        B.poly(ch, a, w * (ps === 0 ? 1 : 0.75) * (0.75 + pm * 0.5), seg);
        if (o.dark && pm > 0.55) B.poly(BLK, a0 * (pm - 0.5) * 1.5 * o.dark, w * 0.85, seg);
        if (o.rim && pm < 0.4) B.poly(WHT, o.rim * (0.45 - pm) * 2, w * 1.1, seg.map((p, q) => [p[0] - nrm[(i + q) % n][0] * w * 1.2, p[1] - nrm[(i + q) % n][1] * w * 1.2]));
        i += run - (rand() < 0.3 ? 2 : 0) + (rand() < 0.18 ? 2 : 0);
      }
    }
  }

  /* shading field from capsules: returns light dot product or null */
  function makeShader(parts) {
    return function (x, y) {
      let ws = 0, vs = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        const dx = p.bx - p.ax, dy = p.by - p.ay, l2 = dx * dx + dy * dy;
        let t = l2 > 0 ? ((x - p.ax) * dx + (y - p.ay) * dy) / l2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const r = p.ra + (p.rb - p.ra) * t;
        const ox = (x - p.ax - dx * t) / r, oy = (y - p.ay - dy * t) / r, d2 = ox * ox + oy * oy;
        if (d2 < 1) {
          const ins = (1 - d2), wgt = ins * ins * (p.w || 1);
          const nz = Math.sqrt(1 - d2);
          vs += wgt * (ox * LIGHT[0] + oy * LIGHT[1] + nz * LIGHT[2]);
          ws += wgt;
        }
      }
      return ws > 0 ? vs / ws : null;
    };
  }
  const cap = (a, b, ra, rb, w) => ({ ax: a[0], ay: a[1], bx: b[0], by: b[1], ra, rb: rb === undefined ? ra : rb, w: w || 1 });

  function blob(c, ch, x, y, rx, ry, rot, a) {
    if (a < 0.004 || rx <= 0 || ry <= 0) return;
    c.save();
    c.translate(x, y); if (rot) c.rotate(rot); c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + CHS[ch] + ',' + a.toFixed(4) + ')');
    g.addColorStop(0.55, 'rgba(' + CHS[ch] + ',' + (a * 0.5).toFixed(4) + ')');
    g.addColorStop(1, 'rgba(' + CHS[ch] + ',0)');
    c.fillStyle = g;
    c.fillRect(-rx, -rx, rx * 2, rx * 2);
    c.restore();
  }
  function fillCh(c, ch, path, a) {
    if (a < 0.004) return;
    c.fillStyle = 'rgba(' + CHS[ch] + ',' + Math.min(1, a).toFixed(4) + ')';
    c.fill(path);
  }
  function reserve(R, path, a) {
    R.B.flush(); R.BT.flush();
    for (const c of [R.cS, R.cT]) {
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = 'rgba(0,0,0,' + a + ')';
      c.fill(path);
      c.globalCompositeOperation = 'lighter';
    }
  }
  function clipFlush(R, path) {
    R.cS.save(); R.cS.clip(path); R.B.flush(); R.cS.restore();
    R.cT.save(); R.cT.clip(path); R.BT.flush(); R.cT.restore();
  }
  function flushAll(R) { R.B.flush(); R.BT.flush(); }
  /* modelling rubbed in with the stump: the tone field is evaluated at low resolution and smoothed up */
  let STMP = null;
  function stumpShade(R, pts, fn, f, scale) {
    const bb = bbox(pts, 2);
    f = f || 3; scale = scale || 1;
    const w = Math.max(2, Math.ceil((bb.x1 - bb.x0) / f) + 1), h = Math.max(2, Math.ceil((bb.y1 - bb.y0) / f) + 1);
    if (!STMP) STMP = document.createElement('canvas');
    if (STMP.width < w || STMP.height < h) { STMP.width = Math.max(w, STMP.width); STMP.height = Math.max(h, STMP.height); }
    const c = STMP.getContext('2d', { willReadFrequently: true });
    const img = c.createImageData(w, h), D = img.data;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      HO[0] = HO[1] = HO[2] = 0;
      const q = (j * w + i) * 4;
      if (fn(bb.x0 + i * f, bb.y0 + j * f, HO)) { D[q] = clamp(HO[0] * scale, 0, 1) * 255; D[q + 1] = clamp(HO[1] * scale, 0, 1) * 255; D[q + 2] = clamp(HO[2] * scale, 0, 1) * 255; }
      D[q + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    flushAll(R);
    R.cT.save(); R.cT.clip(pathOf(pts));
    R.cT.imageSmoothingEnabled = true;
    R.cT.drawImage(STMP, 0, 0, w, h, bb.x0, bb.y0, w * f, h * f);
    R.cT.restore();
  }
  /* a long stroke with the side of the chalk: swelling and thinning along its length */
  function sweep(B, ch, pts, w, a, ph) {
    const n = pts.length; if (n < 2) return;
    ph = ph || 0;
    for (let i = 0; i < n - 1; i++) {
      const t = (i + 0.5) / (n - 1);
      const sw = Math.sin(Math.PI * t) * (0.75 + 0.25 * Math.sin(t * 9 + ph));
      B.line(ch, a * (0.35 + 0.65 * sw), w * (0.3 + 0.9 * sw), pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    }
  }
  function lowres(R, f) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(R.W / f); c.height = Math.ceil(R.H / f);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.globalCompositeOperation = 'lighter';
    x.scale(1 / f, 1 / f);
    return { c, x, done() { R.cT.drawImage(c, 0, 0, R.W, R.H); c.width = c.height = 1; } };
  }

  /* ============================================================ the paper */
  function makeTooth(rand) {
    const N = 1024, M = N - 1;
    const per = (P) => {
      const t = new Float32Array(P * P); for (let i = 0; i < t.length; i++) t[i] = rand();
      const f = N / P;
      return (x, y) => {
        const gx = x / f, gy = y / f, xi = Math.floor(gx), yi = Math.floor(gy), xf = gx - xi, yf = gy - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const x0 = xi % P, y0 = yi % P, x1 = (xi + 1) % P, y1 = (yi + 1) % P;
        const a = t[y0 * P + x0], b = t[y0 * P + x1], c = t[y1 * P + x0], d = t[y1 * P + x1];
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
      };
    };
    const n3 = per(320), n6 = per(160), n16 = per(64);
    const wn = new Float32Array(N * N);
    for (let i = 0; i < wn.length; i++) wn[i] = rand();
    const v = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x;
      const bl = (wn[i] + wn[(y * N) + ((x + 1) & M)] + wn[(((y + 1) & M) * N) + x] + wn[(((y + 1) & M) * N) + ((x + 1) & M)]) / 4;
      const fib = (wn[(y * N) + ((x + 2) & M)] + wn[(y * N) + ((x - 2) & M)] + wn[(y * N) + ((x + 4) & M)]) / 3;
      v[i] = 0.16 * bl + 0.1 * fib + 0.4 * n3(x, y) + 0.24 * n6(x, y) + 0.1 * n16(x, y);
    }
    const H = new Uint32Array(1024);
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < v.length; i++) { if (v[i] < lo) lo = v[i]; if (v[i] > hi) hi = v[i]; }
    const sc = 1023 / (hi - lo);
    for (let i = 0; i < v.length; i++) H[((v[i] - lo) * sc) | 0]++;
    const cdf = new Float32Array(1024); let acc = 0;
    for (let i = 0; i < 1024; i++) { acc += H[i]; cdf[i] = acc / v.length; }
    const out = new Uint8Array(N * N);
    for (let i = 0; i < v.length; i++) out[i] = (cdf[((v[i] - lo) * sc) | 0] * 255) | 0;
    return out;
  }

  /* =============================================================== layout */
  function makeLayout(W, H) {
    const A = W / H;
    const t = smooth(0.55, 1.45, A), u = smooth(1.75, 2.45, A);
    const hy = H * lerp(0.42, 0.44, t);
    const camK = 1.75;
    const yT = H * (lerp(0.79, 0.9, t) - 0.02 * u);
    const xT = W * (lerp(0.46, 0.49, t) - 0.03 * u);
    const hhT = Math.min((yT - hy) / camK * 1.2, W * 0.42);
    const cityW = Math.min(H * lerp(0.38, 0.41, t) * (1 - 0.08 * u), W * 0.62);
    const cityX = W * (lerp(0.63, 0.8, t) - 0.01 * u);
    const farX = W * (lerp(0.06, 0.2, t) + 0.06 * u);
    return {
      W, H, A, t, u, hy, camK, yT, xT, hhT, farX, back: 2.1,
      sun: [W * lerp(0.06, 0.13, t), hy + H * 0.012],
      vp: [W * lerp(1.25, 1.12, t), hy + H * 0.012],
      city: { cx: cityX, cb: hy + H * 0.003, w: cityW, cs: cityW / 200 },
      k: Math.sqrt(W * H) / 2900,
    };
  }
  /* front edge of the wedge of riders at ground line y */
  function riderFront(L, y) {
    if (y <= L.yT) {
      const f = clamp((y - L.hy) / (L.yT - L.hy), 0, 1);
      return lerp(L.farX, L.xT, Math.pow(f, 0.8)) + Math.sin(f * 8.0 + 0.6) * L.hhT * 0.22 * f;
    }
    return L.xT - L.hhT * 1.05 - (y - L.yT) * L.back;
  }
  function hordeFront(L, y) {
    const f = clamp((y - L.hy) / (L.yT - L.hy), 0, 1.5);
    if (y <= L.yT) return riderFront(L, y) + lerp(L.W * 0.03, L.hhT * 1.7, f);
    return L.xT + L.hhT * 1.7 + (y - L.yT) * 2.2;
  }

  /* ============================================================ the horse */
  /* joint angles (degrees from vertical, + forward) through one stride of a leg; stance is p < 0.3 */
  const FORE_K = [
    [0.00, 16, 20, 34],
    [0.12, 2, 2, 62],
    [0.25, -24, -26, 24],
    [0.33, -32, -46, -55],
    [0.44, -8, -104, -150],
    [0.57, 38, -52, -100],
    [0.71, 70, 12, -14],
    [0.86, 52, 46, 40],
  ];
  const HIND_K = [
    [0.00, -8, 26, 36],
    [0.13, -30, 6, 62],
    [0.27, -56, -40, -12],
    [0.35, -60, -52, -64],
    [0.47, -42, 14, -46],
    [0.63, -12, 58, 8],
    [0.81, 4, 42, 38],
  ];
  function cr(a, b, c, d, t) { return 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); }
  function keyInterp(K, p) {
    const n = K.length;
    let i = n - 1; for (let j = 0; j < n; j++) if (K[j][0] <= p) i = j;
    const i0 = (i - 1 + n) % n, i2 = (i + 1) % n, i3 = (i + 2) % n;
    const pA = K[i][0], pB = i2 === 0 ? 1 : K[i2][0];
    const tt = (p - pA) / (pB - pA);
    return [1, 2, 3].map((c) => cr(K[i0][c], K[i][c], K[i2][c], K[i3][c], tt));
  }
  /* transverse gallop, right lead: left hind, right hind, left fore, right fore */
  const LEGDEF = [['LH', 1, 0, 0], ['RH', 1, 1, 0.085], ['LF', 0, 0, 0.24], ['RF', 0, 1, 0.33]];

  function legOutline(chain, hind, stance) {
    const segN = [9, 7, 6], front = [], back = [];
    const dirs = [];
    for (let i = 0; i < 3; i++) { const a = chain[i], b = chain[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; dirs.push([(b[0] - a[0]) / l, (b[1] - a[1]) / l]); }
    for (let sg = 0; sg < 3; sg++) {
      for (let j = 0; j <= segN[sg]; j++) {
        if (j === segN[sg] && sg < 2) continue;
        const t = j / segN[sg];
        const c = lp(chain[sg], chain[sg + 1], t);
        let d = dirs[sg];
        if (t < 0.2 && sg > 0) { const m = lerp(0.5, 1, t / 0.2); d = [lerp(dirs[sg - 1][0], d[0], m), lerp(dirs[sg - 1][1], d[1], m)]; }
        else if (t > 0.8 && sg < 2) { const m = lerp(1, 0.5, (t - 0.8) / 0.2); d = [lerp(dirs[sg + 1][0], d[0], m), lerp(dirs[sg + 1][1], d[1], m)]; }
        const dl = Math.hypot(d[0], d[1]) || 1; d = [d[0] / dl, d[1] / dl];
        const n = [-d[1], d[0]];
        let w, bb = 0, fb = 0;
        if (hind) {
          if (sg === 0) { w = lerp(24, 9.5, Math.pow(t, 0.5)) + Math.sin(t * Math.PI) * 2.5; if (t > 0.74) bb = (t - 0.74) * 17; if (t > 0.85) fb = (t - 0.85) * 6; }
          else if (sg === 1) { w = 6 + smooth(0.78, 1, t) * 2.6 - Math.sin(t * Math.PI) * 0.6; if (t < 0.25) bb = (0.25 - t) * 18; }
          else { w = t < 0.35 ? lerp(8.4, 5.2, t / 0.35) : t < 0.5 ? lerp(5.2, 6.8, (t - 0.35) / 0.15) : lerp(6.8, 8.6, (t - 0.5) / 0.5); if (t < 0.22) bb = (0.22 - t) * 9; }
        } else {
          if (sg === 0) { w = lerp(16, 7.6, Math.pow(t, 0.6)) + Math.sin(t * Math.PI * 0.8) * 1.5; if (t > 0.8) { fb = (t - 0.8) * 9; bb = (t - 0.8) * 7; } }
          else if (sg === 1) { w = 5.4 + smooth(0.78, 1, t) * 2.6 - Math.sin(t * Math.PI) * 0.4; if (t < 0.2) { fb = (0.2 - t) * 9; bb = (0.2 - t) * 6; } }
          else { w = t < 0.35 ? lerp(8, 5, t / 0.35) : t < 0.5 ? lerp(5, 6.6, (t - 0.35) / 0.15) : lerp(6.6, 8.4, (t - 0.5) / 0.5); if (t < 0.22) bb = (0.22 - t) * 10; }
        }
        back.push([c[0] + n[0] * (w / 2 + bb), c[1] + n[1] * (w / 2 + bb)]);
        front.push([c[0] - n[0] * (w / 2 + fb), c[1] - n[1] * (w / 2 + fb)]);
      }
    }
    if (stance) {
      const yb = Math.max(front[front.length - 1][1], back[back.length - 1][1]);
      front[front.length - 1][1] = yb; back[back.length - 1][1] = yb;
    }
    return { front, back, poly: front.concat(back.slice().reverse()) };
  }

  /* Local units: withers height 100, x forward, y down, ground at y = 100. Head ~40, legs ~50. */
  function buildHorse(o, gx, gy, s) {
    const pr = o.pitch * D2R, cp = Math.cos(pr), sp = Math.sin(pr);
    const rot = (x, y) => [-10 + (x + 10) * cp - (y - 28) * sp, 28 + (x + 10) * sp + (y - 28) * cp];
    const dir = (a) => [Math.sin(a * D2R), Math.cos(a * D2R)];
    const legs = {};
    for (const [id, hind, near, off] of LEGDEF) {
      const p = ((((o.phase - off) % 1) + 1) % 1);
      const a = keyInterp(hind ? HIND_K : FORE_K, p).map((v) => v * o.stride);
      const sh = near ? 0 : 1;
      const top = hind ? rot(-45 + (a[0] + 30) * 0.13 + sh * 3, 36 - sh * 2.5) : rot(22 + a[0] * 0.1 + sh * 3, 44 - Math.abs(a[0]) * 0.03 - sh * 2.5);
      const lens = hind ? [34, 25, 12] : [29, 18, 12];
      const ch = [top];
      for (let i = 0; i < 3; i++) { const d = dir(a[i]); const q = ch[i]; ch.push([q[0] + d[0] * lens[i], q[1] + d[1] * lens[i]]); }
      legs[id] = { id, hind: !!hind, near: !!near, p, a, chain: ch, stance: p < 0.3 };
    }
    let maxS = -1e9, maxA = -1e9;
    for (const id in legs) { const L = legs[id], y = L.chain[3][1]; if (y > maxA) maxA = y; if (L.stance && y > maxS) maxS = y; }
    const dy = maxS > -1e8 ? 100 - maxS : 100 - maxA - 4;
    const QL = (p) => [gx + p[0] * s, gy + (p[1] + dy - 100) * s];
    const Q = (x, y) => QL(rot(x, y));

    const na = (o.neck + 6 * Math.cos(TAU * (o.phase - 0.3))) * D2R;
    const ha = (o.head + 5 * Math.cos(TAU * (o.phase - 0.3))) * D2R;
    const P = [24 + o.neckLen * 1.18 * Math.cos(na), 4 - o.neckLen * 1.18 * Math.sin(na)];
    const hd = [Math.cos(ha), Math.sin(ha)], th = [-hd[1], hd[0]];
    const HS = 1.12;
    const Hp = (a, b) => [P[0] + hd[0] * a * HS + th[0] * b * HS, P[1] + hd[1] * a * HS + th[1] * b * HS];
    const W0 = [6, -1];
    const cdx = P[0] - W0[0], cdy = P[1] - W0[1], cl = Math.hypot(cdx, cdy);
    const cu = [cdy / cl, -cdx / cl];
    const arch = 7 + (o.arch || 0);
    const crC = [(W0[0] + P[0]) / 2 + cu[0] * arch * 1.7, (W0[1] + P[1]) / 2 + cu[1] * arch * 1.7];
    const crest = (u) => { const v = 1 - u; return [v * v * P[0] + 2 * v * u * crC[0] + u * u * W0[0], v * v * P[1] + 2 * v * u * crC[1] + u * u * W0[1]]; };
    const thr = Hp(2, 14.5), SH = [45, 21];
    const nu1 = lp(thr, SH, 0.33), nu2 = lp(thr, SH, 0.68);
    const ctl = [
      [-58, 7], [-50, 1], [-41, -1], [-32, 2], [-20, 5], [-7, 4.5], W0,
      crest(0.72), crest(0.45), crest(0.2),
      Hp(-1, -2), Hp(7, -3.2), Hp(20, -3), Hp(31, -1.8), Hp(37, -0.4), Hp(40.6, 3.2), Hp(39.8, 7.8), Hp(36, 10), Hp(27, 10.4), Hp(18, 17), Hp(8, 18), thr,
      [nu1[0] + cu[0] * 1.5, nu1[1] + cu[1] * 1.5], [nu2[0] - cu[0] * 1.5, nu2[1] - cu[1] * 1.5],
      SH, [44, 32], [38, 41], [28, 47], [14, 51], [0, 50], [-14, 47.5], [-26, 43.5], [-34, 42], [-40, 45], [-52, 45], [-61, 37], [-65, 25], [-63, 14],
    ];
    const body = spline(ctl, true, 5).map((p) => Q(p[0], p[1]));
    const legOut = {};
    for (const id in legs) {
      const L = legs[id];
      const lo = legOutline(L.chain, L.hind, L.stance);
      legOut[id] = { ...L, chainS: L.chain.map(QL), front: lo.front.map(QL), back: lo.back.map(QL), poly: lo.poly.map(QL) };
    }
    const S = (p) => QL(rot(p[0], p[1]));
    const parts = [
      cap(Q(-22, 24), Q(12, 25), 23 * s, 26 * s, 1),
      cap(Q(-46, 20), Q(-46, 21), 21 * s, 21 * s, 1.3),
      cap(Q(-47, 26), Q(-52, 40), 14 * s, 11 * s, 1.2),
      cap(Q(14, 6), Q(34, 34), 12 * s, 13 * s, 1.2),
      cap(Q(38, 30), Q(38, 31), 10 * s, 10 * s),
      cap(Q(26, 8), S(Hp(3, 7)), 19 * s, 10 * s),
      cap(S(Hp(9, 5)), S(Hp(36, 4)), 7.6 * s, 5.2 * s, 1.3),
      cap(S(Hp(12, 9)), S(Hp(13, 9)), 7.6 * s, 7.6 * s, 1.3),
    ];
    const legParts = {};
    for (const id in legOut) {
      const L = legOut[id], c = L.chainS;
      const w = L.hind ? [11, 4.6, 3.6] : [7.5, 3.4, 3.6];
      legParts[id] = [cap(c[0], c[1], w[0] * s, 5 * s), cap(c[1], c[2], 3.6 * s, w[1] * s), cap(c[2], c[3], w[2] * s, 4 * s)];
    }
    const rp = (a) => [a[0] * cp - a[1] * sp, a[0] * sp + a[1] * cp];
    return {
      o, s, gx, gy, Q, S, body, legs: legOut, parts, legParts,
      crest: (u) => S(crest(u)), poll: S(P), hd: rp(hd), th: rp(th), Hp: (a, b) => S(Hp(a, b)),
      dock: Q(-59, 7),
    };
  }

  /* -------------------------------------------- coats: tone -> pressures */
  const darkOf = (v, ao) => clamp(0.82 - 0.95 * v + ao, 0, 1);
  function coatPress(coat, v, ao, out) {
    const D = darkOf(v, ao);
    const rim = smooth(0.6, 0.85, v - ao);
    if (coat === 'grey') {
      out[RED] = 0.62 * smooth(0.2, 0.65, D);
      out[BLK] = 0.8 * smooth(0.6, 0.98, D);
      out[WHT] = 0.95 * smooth(0.4, 0.75, v - ao);
    } else if (coat === 'black') {
      out[RED] = 0.3 * smooth(0.1, 0.5, D) * (1 - D);
      out[BLK] = 0.3 + 0.65 * D;
      out[WHT] = 0.6 * rim;
    } else {
      const tone = coat === 'dun' ? 0.55 : coat === 'chestnut' ? 0.95 : 0.9;
      out[RED] = tone * (0.22 + 0.75 * smooth(0.0, 0.7, D));
      out[BLK] = (coat === 'bay' ? 0.9 : 0.65) * smooth(0.5, 1.0, D);
      out[WHT] = 0.75 * rim;
    }
  }
  const POINTS = { bay: true, dun: true, black: true };

  function horseUnion(hs) {
    const p = new Path2D();
    addPoly(p, hs.body);
    for (const id in hs.legs) addPoly(p, hs.legs[id].poly);
    return p;
  }

  /* wipe the paper under the near legs, but only where they leave the body */
  function reserveLegs(R, hs) {
    flushAll(R);
    const out = new Path2D();
    out.rect(-10, -10, R.W + 20, R.H + 20); addPoly(out, hs.body);
    const lp2 = new Path2D(); addPoly(lp2, hs.legs.RH.poly); addPoly(lp2, hs.legs.RF.poly);
    for (const c of [R.cS, R.cT]) {
      c.save(); c.clip(out, 'evenodd');
      c.globalCompositeOperation = 'source-over'; c.fillStyle = 'rgba(0,0,0,0.85)'; c.fill(lp2);
      c.restore();
    }
  }

  function drawLeg(R, hs, L, coat, far, detail) {
    const s = hs.s, k = R.k;
    const sh = makeShader(hs.legParts[L.id]);
    const c = L.chainS;
    const knee = c[1];
    const points = POINTS[coat];
    const ao = (far ? 0.32 : 0.04) + (hs.ao || 0);
    const path = pathOf(L.poly);
    if (far) fillCh(R.cT, coat === 'grey' ? RED : BLK, path, coat === 'grey' ? 0.1 : 0.16);
    const c0 = c[0], c1 = c[1], cl = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) || 1;
    const fn = (x, y, out) => {
      const v = sh(x, y); if (v === null) return false;
      const tt = ((x - c0[0]) * (c1[0] - c0[0]) + (y - c0[1]) * (c1[1] - c0[1])) / (cl * cl);
      if (!far && tt < 0.3) { const f0 = smooth(-0.05, 0.3, tt); if (f0 < 0.02) return false; HO.f = f0; } else HO.f = 1;
      const below = (y - knee[1]) > -s * 3;
      if (points && below) { out[BLK] = clamp(0.3 + 0.65 * darkOf(v, ao), 0.15, 0.95); out[WHT] = 0.55 * smooth(0.62, 0.88, v); out[RED] = 0.12; }
      else coatPress(coat, v, ao, out);
      if (far) { out[WHT] *= 0.35; out[BLK] = Math.max(out[BLK], coat === 'grey' ? 0.1 : 0.3); }
      if (HO.f < 1) { out[0] *= HO.f; out[1] *= HO.f; out[2] *= HO.f; }
      return true;
    };
    const sp = clamp(s * 0.95, 3, 5.5) * k, len = clamp(s * 5.5, 8, 34) * k, w = clamp(s * 0.55, 1.5, 3.2) * k;
    const bb = bbox(L.poly, 2);
    stumpShade(R, L.poly, fn, Math.max(2, s * 0.9), 0.45);
    const fnS = (x, y, out) => { if (!fn(x, y, out)) return false; const v = sh(x, y); const m = smooth(0.15, 0.7, darkOf(v, ao)); out[RED] *= m; out[BLK] *= m; out[WHT] *= 0.8; return true; };
    // strokes run along the leg, as a draughtsman follows bone and tendon
    const along = Math.atan2(c[2][1] - c[0][1], c[2][0] - c[0][0]);
    hatch(R, { ...bb, ang: along + 0.25, sp, len, w, fn: fnS, chs: [RED, BLK, WHT], dth: 0.6, bend: 0.02 });
    clipFlush(R, path);
    const f = L.front, b = L.back, nF = f.length;
    const hoof = [f[nF - 3], f[nF - 2], f[nF - 1], b[nF - 1], b[nF - 2], b[nF - 3]];
    fillCh(R.cT, BLK, pathOf(hoof), far ? 0.55 : 0.42);
    R.B.poly(BLK, 0.8, Math.max(1.2, s * 0.9) * k, [f[nF - 3], f[nF - 1]]);
    R.B.poly(BLK, 0.6, Math.max(1.2, s * 0.6) * k, [f[nF - 3], b[nF - 3]]);
    if (!far) R.B.poly(WHT, 0.5, Math.max(1, s * 0.5) * k, [b[nF - 3], b[nF - 1]]);
    const cw = clamp(s * 0.62, 1.4, 3.4) * k;
    const pf = (i) => smooth(1, 4, i);
    contour(R, f, { closed: false, ch: far ? BLK : RED, w: cw, a: far ? 0.6 : 0.85, wob: s * 0.35, passes: detail ? 3 : 2, pf, dark: 0.9, flip: true, rim: far ? 0 : 0.5 });
    contour(R, b, { closed: false, ch: far ? BLK : RED, w: cw, a: far ? 0.6 : 0.9, wob: s * 0.35, passes: detail ? 3 : 2, pf, dark: 0.9, rim: far ? 0 : 0.6 });
    if (detail) {
      const B = R.B;
      const kn = c[1], fe = c[2];
      stroke(B, BLK, kn[0] - s * 3, kn[1], kn[0] + s * 3, kn[1] + s * 1.5, 0.2, cw * 0.7, 0.45);
      stroke(B, RED, fe[0] - s * 3, fe[1] - s, fe[0] + s * 2, fe[1] + s * 2, -0.3, cw * 0.7, 0.5);
      if (L.hind) { const h = c[1]; stroke(B, BLK, h[0] - s * 1, h[1] - s * 8, h[0] - s * 3, h[1] + s * 1, 0.15, cw * 0.8, 0.55); }
      // the flexor tendon down the back of the cannon, and its light along the front
      const sw = (pa, pb, off, ch, a) => { const d = [pb[0] - pa[0], pb[1] - pa[1]], l = Math.hypot(d[0], d[1]) || 1, n = [-d[1] / l, d[0] / l]; const pts = []; for (let i = 0; i <= 6; i++) { const q = lp(pa, pb, 0.08 + i * 0.14); pts.push([q[0] + n[0] * off * s, q[1] + n[1] * off * s]); } sweep(B, ch, pts, cw * 1.1, a, i0); };
      const i0 = R.rand() * 6;
      sw(c[1], c[2], 1.6, BLK, 0.55);
      if (!far) sw(c[1], c[2], -1.8, WHT, 0.45);
      sw(c[0], c[1], L.hind ? 3.5 : 2.6, far ? BLK : RED, 0.4);
    }
    flushAll(R);
  }

  function drawTail(R, hs, coat, detail) {
    const B = R.B, s = hs.s, k = R.k, rand = R.rand, o = hs.o;
    const D = hs.dock;
    const lift = o.tailLift;
    const ch = coat === 'grey' ? WHT : (POINTS[coat] ? BLK : RED);
    const n = detail ? 60 : 20;
    const pr = o.pitch * D2R, ca = Math.cos(pr), sa = Math.sin(pr);
    const R2 = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    for (let i = 0; i < n; i++) {
      const u = rand();
      const len = (38 + rand() * 30) * s;
      const sx = D[0] + (rand() - 0.5) * 4 * s, sy = D[1] + (rand() - 0.2) * 5 * s;
      const fan = (rand() - 0.5) * 0.55;
      const v1 = R2(-0.5, -lift - 0.08 + fan * 0.5), v2 = R2(-1, -lift * 0.35 + 0.3 + fan);
      const wave = Math.sin(u * 7 + o.phase * TAU) * 6 * s;
      const c1 = [sx + v1[0] * len * 0.55, sy + v1[1] * len * 0.55 + wave];
      const e = [sx + v2[0] * len, sy + v2[1] * len - wave * 0.6];
      const a = (0.3 + rand() * 0.5);
      const w = clamp(s * (0.5 + rand() * 0.7), 1, 3) * k;
      B.quad(ch, a, w, sx, sy, c1[0], c1[1], e[0], e[1]);
      if (ch !== WHT && rand() < 0.35) B.quad(WHT, 0.4 * rand(), w * 0.7, sx, sy - s, c1[0], c1[1] - s * 2, e[0] * 0.5 + c1[0] * 0.5, e[1] * 0.5 + c1[1] * 0.5 - s * 2);
      if (ch === WHT && rand() < 0.4) B.quad(RED, 0.35 * rand(), w * 0.7, sx, sy + s, c1[0], c1[1] + s * 3, e[0], e[1] + s * 2);
    }
    flushAll(R);
  }

  function drawMane(R, hs, coat, detail) {
    const B = R.B, s = hs.s, k = R.k, rand = R.rand, o = hs.o;
    const ch = coat === 'grey' ? WHT : (POINTS[coat] ? BLK : RED);
    const n = detail ? 100 : 28;
    for (let i = 0; i < n; i++) {
      const u = 0.03 + rand() * 0.95;
      const r = hs.crest(u);
      const len = o.mane * (0.5 + rand() * 0.7) * (0.55 + 0.6 * Math.sin(u * Math.PI)) * s;
      const ang = Math.PI + (-0.42 + rand() * 0.5) + (u - 0.5) * 0.3 + o.pitch * D2R;
      const ex = r[0] + Math.cos(ang) * len, ey = r[1] + Math.sin(ang) * len;
      const cx = (r[0] + ex) / 2 + (rand() - 0.5) * len * 0.5, cy = (r[1] + ey) / 2 - len * 0.22;
      const w = clamp(s * (0.5 + rand() * 0.7), 1, 3) * k;
      B.quad(ch, 0.35 + rand() * 0.5, w, r[0], r[1] + s, cx, cy, ex, ey);
      if (ch === WHT && rand() < 0.4) B.quad(RED, 0.35, w * 0.7, r[0], r[1] + 2 * s, cx, cy + 2 * s, ex, ey + s);
      if (ch !== WHT && rand() < 0.3) B.quad(WHT, 0.4, w * 0.6, r[0], r[1], cx, cy - s, (cx + ex) / 2, (cy + ey) / 2 - s);
    }
    const p = hs.poll;
    for (let i = 0; i < (detail ? 12 : 3); i++) {
      const len = (8 + rand() * 7) * s;
      B.quad(ch, 0.55, clamp(s * 0.6, 1, 2.4) * k, p[0], p[1], p[0] - len * 0.2, p[1] - len * 0.6, p[0] - len * (0.7 + rand() * 0.4), p[1] - len * (0.2 + rand() * 0.4));
    }
    flushAll(R);
  }

  function drawHorseBody(R, hs, coat, detail) {
    const s = hs.s, k = R.k, B = R.B;
    const sh = makeShader(hs.parts);
    const path = pathOf(hs.body);
    const bb = bbox(hs.body, 2);
    const ao = hs.ao || 0;
    stumpShade(R, hs.body, (x, y, out) => { const v = sh(x, y); if (v === null) return false; coatPress(coat, v, ao, out); return true; }, Math.max(2, s * 1.2), 0.42);
    const sp = clamp(s * 1.0, 3, 6) * k, len = clamp(s * 7, 9, 44) * k, w = clamp(s * 0.6, 1.6, 3.6) * k;
    // hatching only in the shadows, as the master would put it
    const fn = (x, y, out) => { const v = sh(x, y); if (v === null) return false; coatPress(coat, v, ao, out); const D = darkOf(v, ao); const m = smooth(0.15, 0.7, D); out[RED] *= m; out[BLK] *= m; out[WHT] = 0; return true; };
    hatch(R, { ...bb, ang: 58 * D2R, sp, len, w, fn, chs: coat === 'grey' ? [RED, BLK] : [RED, BLK], dth: 0.55 });
    clipFlush(R, path);
    // white heightening laid along the lit planes, following the form
    const fnW = (x, y, out) => { const v = sh(x, y); if (v === null) return false; out[WHT] = (coat === 'grey' ? 0.95 : 0.7) * smooth(coat === 'grey' ? 0.4 : 0.6, 0.9, v - ao); return true; };
    hatch(R, { ...bb, ang: -16 * D2R, sp: sp * 0.9, len: len * 1.3, w: w * 1.1, fn: fnW, chs: [WHT], bend: 0.1, dth: 0.6 });
    clipFlush(R, path);
    const Q = hs.Q, cw = clamp(s * 0.55, 1.3, 3) * k;
    const an = (ch, pts, a, ww) => { const q = pts.map((p) => Q(p[0], p[1])); sweep(B, ch, spline(q, false, 5), (ww || cw) * 1.5, Math.min(1, a * 1.7), R.rand() * 6); };
    const ac = coat === 'grey' ? RED : (coat === 'black' ? WHT : BLK);
    if (detail) {
      an(ac, [[8, 2], [18, 17], [30, 33], [36, 40]], 0.34);          // the long sloping shoulder
      an(ac, [[38, 24], [31, 30], [24, 38], [24, 45]], 0.3);          // the mass of the triceps behind it
      an(ac, [[16, 36], [24, 42], [22, 48]], 0.4);                    // elbow
      an(RED, [[-2, 18], [0, 32], [-4, 44]], 0.28);                   // ribs
      an(RED, [[-10, 18], [-9, 30], [-12, 42]], 0.22);
      an(RED, [[-17, 20], [-17, 31], [-20, 41]], 0.16);
      an(ac, [[-31, 4], [-35, 11], [-33, 18]], 0.36);                 // point of hip
      an(ac, [[-33, 16], [-38, 28], [-37, 38], [-33, 44]], 0.34);     // stifle and the front of the thigh
      an(ac, [[-62, 14], [-58, 26], [-55, 36], [-50, 44]], 0.32);     // the hamstring groove
      an(ac, [[-26, 6], [-28, 20], [-27, 36]], 0.18);                 // flank
      const jg = [hs.Hp(8, 12), lp(hs.Hp(8, 12), Q(34, 24), 0.5), Q(34, 24)];
      B.poly(ac, 0.28, cw, spline(jg, false, 4));
      const ck = [hs.Hp(8, 3), hs.Hp(14, 4.5), hs.Hp(19, 9), hs.Hp(16, 13.5), hs.Hp(10, 13.5)];
      B.poly(ac, 0.5, cw, spline(ck, false, 4));
      B.poly(RED, 0.4, cw * 0.8, spline([hs.Hp(22, 2), hs.Hp(30, 1.5), hs.Hp(35, 3.5)], false, 3));
    }
    const eye = hs.Hp(11.5, 4.5), nos = hs.Hp(36, 3.6), mo = hs.Hp(37, 7.6);
    const er = 1.8 * s;
    flushAll(R);
    const c = R.cS;
    c.fillStyle = 'rgba(0,255,0,0.9)';
    c.beginPath(); c.ellipse(eye[0], eye[1], er, er * 0.72, Math.atan2(hs.hd[1], hs.hd[0]), 0, TAU); c.fill();
    if (detail) {
      stroke(B, BLK, eye[0] - er * 2, eye[1] - er * 1.3, eye[0] + er * 1.6, eye[1] - er * 1.2, -0.15, cw * 0.8, 0.6);
      B.line(WHT, 0.8, cw * 0.6, eye[0] - er * 0.4, eye[1] - er * 0.3, eye[0] - er * 0.1, eye[1] - er * 0.3);
    }
    stroke(B, BLK, nos[0] - s * 2.4, nos[1] - s * 1.2, nos[0] + s * 1.2, nos[1] + s * 1.6, 0.45, cw * 1.2, 0.9);
    stroke(B, BLK, mo[0] - s * 4.5, mo[1] + s * 0.4, mo[0] + s * 1.5, mo[1] + s * 1.2, -0.1, cw, 0.75);
    const p = hs.poll, ha = Math.atan2(hs.hd[1], hs.hd[0]);
    for (let e = 0; e < 2; e++) {
      const a = ha + Math.PI + 0.6 + e * 0.25, Le = (10 - e * 1.4) * s;
      const b0 = [p[0] + Math.cos(ha) * 2.4 * s * (e ? 0.4 : 1), p[1] + Math.sin(ha) * 2.4 * s];
      const tip = [b0[0] + Math.cos(a) * Le, b0[1] + Math.sin(a) * Le];
      const n = [-Math.sin(a) * 2.5 * s, Math.cos(a) * 2.5 * s];
      const ear = [[b0[0] + n[0], b0[1] + n[1]], [b0[0] + n[0] * 0.5 + Math.cos(a) * Le * 0.6, b0[1] + n[1] * 0.5 + Math.sin(a) * Le * 0.6], tip, [b0[0] - n[0], b0[1] - n[1]]];
      fillCh(R.cT, e ? BLK : (coat === 'grey' ? WHT : RED), pathOf(ear), e ? 0.55 : 0.5);
      B.poly(e ? BLK : RED, 0.8, cw * 0.8, ear);
    }
    flushAll(R);
    contour(R, hs.body, { ch: coat === 'black' ? BLK : RED, w: clamp(s * 0.95, 1.6, 4.6) * k, a: 1, wob: s * 0.45, passes: detail ? 3 : 2, dark: 1.1, rim: 0.8 });
    flushAll(R);
  }

  /* ===================================================== riders */
  function riderGeom(hs, ro) {
    const Q = hs.Q, s = hs.s;
    const th = ro.lean * D2R;
    const ax = [Math.sin(th), -Math.cos(th)], f = [Math.cos(th), Math.sin(th)];
    const hip = [-7 + ro.seat, -5];
    const at = (p, a, b) => [p[0] + ax[0] * a + f[0] * b, p[1] + ax[1] * a + f[1] * b];
    const QQ = (pts) => pts.map((p) => Q(p[0], p[1]));
    const sho = at(hip, 30, -1);
    // the head is held more upright than the back, looking ahead along the charge
    const hth = th * 0.35 - (ro.sword ? 0.12 : 0), hax = [Math.sin(hth), -Math.cos(hth)], hf = [Math.cos(hth), Math.sin(hth)];
    const head = [sho[0] + ax[0] * 5 + hax[0] * 7 + hf[0] * 3, sho[1] + ax[1] * 5 + hax[1] * 7 + hf[1] * 3];
    const H = (a, b) => [head[0] + hf[0] * a + hax[0] * b, head[1] + hf[1] * a + hax[1] * b];
    const knee = [hip[0] + 26 * Math.sin(52 * D2R), hip[1] + 26 * Math.cos(52 * D2R)];
    const ank = [knee[0] - 6, knee[1] + 24];
    const g = { s, th, ax, f, Q, hip, sho, head, knee, ank, at, H, hf, hax };
    // torso: a curved back, the chest swelling forward, a narrower waist
    g.torso = spline(QQ([at(hip, -1, -8.5), at(hip, 8, -9.8), at(hip, 17, -10.8), at(hip, 25, -10.2), at(hip, 30, -7.8), at(hip, 33.5, -3.5),
      at(hip, 34, 2), at(hip, 29.5, 7.5), at(hip, 23, 10), at(hip, 15, 8.2), at(hip, 8, 8.6), at(hip, 1, 9.6)]), true, 3);
    // the skirt of the hauberk over the thigh, flaring back in the wind
    const kn = lp(hip, knee, 0.78);
    g.skirt = spline(QQ([at(hip, 7.5, -10.4), at(hip, 7.5, 10), [kn[0] + 3, kn[1] - 2], [kn[0] - 2, kn[1] + 4], lp(hip, [hip[0] - 18, hip[1] + 14], 0.6), [hip[0] - 18, hip[1] + 11], [hip[0] - 14, hip[1] + 2]]), true, 3);
    g.leg = QQ(limb([hip, lp(hip, knee, 0.5), knee, lp(knee, ank, 0.5), ank], [7.8, 7, 5.2, 4.4, 3.6]));
    g.boot = QQ([[knee[0] - 4.5, knee[1] + 7], [knee[0] + 4.6, knee[1] + 7.5], [ank[0] + 3.6, ank[1] - 1], [ank[0] + 10, ank[1] + 1.2], [ank[0] + 9.5, ank[1] + 4.2], [ank[0] - 4.2, ank[1] + 4.2], [ank[0] - 4.8, ank[1] - 4]]);
    if (ro.sword) { g.elbow = at(sho, 11, 9); g.hand = at(g.elbow, 13, 6); }
    else if (ro.banner) { g.elbow = at(sho, -10, 7); g.hand = at(g.elbow, 2, 12); }
    else if (ro.horn) { g.elbow = at(sho, -2, 10); g.hand = at(g.elbow, 12, 3); }
    else { g.elbow = at(sho, -14, -4); g.hand = at(g.elbow, 2, 15); }
    g.arm = QQ(limb([sho, lp(sho, g.elbow, 0.5), g.elbow, g.hand], [5.6, 5, 4.2, 3.2]));
    g.handS = Q(g.hand[0], g.hand[1]);
    const sa = ro.spearAng * D2R;
    const sd = [Math.cos(sa), Math.sin(sa)];
    g.spear = null;
    if (!(ro.sword || ro.banner || ro.horn)) {
      const hS = Q(g.hand[0], g.hand[1]);
      if (ro.vp && ro.spearAng < 20) {
        let dx = ro.vp[0] - hS[0], dy = ro.vp[1] - hS[1]; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
        const tw = (ro.spearAng - 5) * D2R * 0.5, c = Math.cos(tw), sn = Math.sin(tw);
        const ux = dx * c - dy * sn, uy = dx * sn + dy * c;
        g.spear = { a: [hS[0] - ux * 50 * s, hS[1] - uy * 50 * s], b: [hS[0] + ux * ro.spearLen * s, hS[1] + uy * ro.spearLen * s] };
      } else g.spear = { a: Q(g.hand[0] - sd[0] * 50, g.hand[1] - sd[1] * 50), b: Q(g.hand[0] + sd[0] * ro.spearLen, g.hand[1] + sd[1] * ro.spearLen) };
    }
    if (ro.sword) { const sw = [Math.cos(-66 * D2R), Math.sin(-66 * D2R)]; g.sword = { a: Q(g.hand[0] - sw[0] * 5, g.hand[1] - sw[1] * 5), b: Q(g.hand[0] + sw[0] * 62, g.hand[1] + sw[1] * 62), d: sw }; }
    if (ro.horn) { g.hornPts = QQ([at(g.hand, 0, -1), at(g.hand, 5, 6), at(g.hand, 3, 12), at(g.hand, -2, 16)]); }
    if (ro.banner) {
      const top = [g.hand[0] - 24, g.hand[1] - 125], bot = [g.hand[0] + 3, g.hand[1] + 12];
      g.pole = { a: Q(bot[0], bot[1]), b: Q(top[0], top[1]) };
    }
    const sc = ro.shieldBig ? at(sho, -9, 21) : ro.backShield ? at(sho, -11, -9.5) : at(sho, -13, 11);
    g.shield = { c: Q(sc[0], sc[1]), rx: (ro.shieldBig ? 12.5 : ro.backShield ? 7.5 : 6) * s, ry: (ro.shieldBig ? 16.5 : ro.backShield ? 9.5 : 14.5) * s, rot: ro.shieldBig ? -0.15 : ro.backShield ? th : 0.1, back: !!ro.backShield };
    g.rein = Q(...at(sho, -15, 16));
    g.headS = Q(head[0], head[1]); g.hr = 6.2 * s;
    g.crown = Q(...H(-1, 6.8));
    // profile of the face under the helm: brow, nose, mouth (open, crying out, for the king), beard
    const open = ro.sword ? 1.6 : 0;
    g.face = QQ([H(4.6, 1.6), H(5.6, 0.4), H(8.2, -1.6), H(6.4, -2.6), H(6.6, -3.4), H(5.9, -3.9 - open * 0.4), H(6.3, -4.7 - open), H(5.8, -6.2 - open), H(3, -8.8 - open), H(-1, -6), H(-2.5, -1), H(0, 1.8)]);
    g.mouth = open ? QQ([H(6.1, -3.9), H(4.4, -4.6), H(6.0, -4.6 - open)]) : null;
    g.helm = spline(QQ([H(-6.6, -0.4), H(-6.4, 3.6), H(-3.6, 6.6), H(0.6, 7.4), H(4.4, 5.4), H(6.2, 1.8), H(5.6, 0.6), H(1.5, 0.9), H(-1, -3.2), H(-3.2, -3.6), H(-5.6, -2.4)]), true, 3);
    g.nasal = QQ([H(5.4, 1.2), H(6.9, -1.4)]);
    g.hairRoot = QQ([H(-5.6, -1), H(-5.2, -3), H(-4.2, -4.6)]);
    g.beardTip = Q(...H(0.5, -10 - open));
    const wv = ro.cloakWave, len = ro.cloak;
    g.cloak = null;
    if (len > 0) {
      const top = [], bot = [];
      const root = at(sho, 1, -6);
      for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        const c = [root[0] - len * u, root[1] - len * 0.22 * Math.sin(u * 2.2) + Math.sin(u * 5 + wv) * 4 * u + len * 0.3 * u * u];
        const wd = 6 + 30 * Math.pow(u, 0.7);
        const tilt = 0.5 + 0.35 * u + 0.2 * Math.sin(u * 3 + wv);
        const n = [Math.sin(tilt), Math.cos(tilt)];
        top.push([c[0] - n[0] * wd * 0.3 + Math.sin(u * 9 + wv) * 2 * u, c[1] - n[1] * wd * 0.3 + Math.sin(u * 11 + wv) * 2 * u]);
        bot.push([c[0] + n[0] * wd * 0.7 + Math.sin(u * 13 + wv) * 3 * u * u, c[1] + n[1] * wd * 0.7 + Math.sin(u * 8 + wv * 1.3) * 5 * u]);
      }
      g.cloakTop = QQ(top); g.cloakBot = QQ(bot);
      g.cloakRoot = Q(root[0], root[1]); g.cloakLen = len * s;
      g.cloak = spline(QQ(top.concat(bot.slice().reverse())), true, 2);
    }
    return g;
  }

  function riderUnion(g) {
    const p = new Path2D();
    addPoly(p, g.torso); addPoly(p, g.leg); addPoly(p, g.arm); addPoly(p, g.boot); addPoly(p, g.skirt); addPoly(p, g.helm); addPoly(p, g.face);
    if (g.cloak) addPoly(p, g.cloak);
    p.moveTo(g.shield.c[0] + g.shield.rx, g.shield.c[1]); p.ellipse(g.shield.c[0], g.shield.c[1], g.shield.rx, g.shield.ry, g.shield.rot, 0, TAU);
    return p;
  }

  /* a part of the rider: stumped modelling, shadow hatching, contour */
  function riderPart(R, pts, caps, tone, o) {
    const s = o.s, k = R.k;
    const sh = makeShader(caps);
    const fn = (x, y, out) => { const v = sh(x, y); tone(v === null ? 0 : v, out); return true; };
    const path = pathOf(pts);
    reserve(R, path, 0.92);
    stumpShade(R, pts, fn, Math.max(2, s * 0.8), 0.5);
    hatch(R, { ...bbox(pts, 2), ang: (o.ang || 58) * D2R, sp: clamp(s * 0.85, 2.8, 4.6) * k, len: clamp(s * 4.5, 7, 26) * k, w: clamp(s * 0.55, 1.5, 3) * k, fn: (x, y, out) => { fn(x, y, out); const v = sh(x, y); const m = smooth(0.2, 0.75, darkOf(v === null ? 0 : v, 0.1)); out[RED] *= m; out[BLK] *= m; return true; }, chs: [RED, BLK, WHT], dth: 0.6 });
    clipFlush(R, path);
    contour(R, pts, { ch: o.cch === undefined ? BLK : o.cch, w: clamp(s * 0.75, 1.4, 3.6) * k, a: 0.9, wob: s * 0.3, passes: 2, rim: o.rim === undefined ? 0.8 : o.rim, dark: 0.6 });
    flushAll(R);
    return sh;
  }

  function drawRider(R, hs, g, ro, detail) {
    const B = R.B, s = hs.s, k = R.k, rand = R.rand;
    const cw = clamp(s * 0.6, 1.3, 3.2) * k;
    const sp = clamp(s * 0.85, 2.6, 4.6) * k, len = clamp(s * 5, 7, 28) * k, w = clamp(s * 0.55, 1.5, 3.2) * k;
    const Q = g.Q;
    // cloak streaming behind
    if (g.cloak) {
      const path = pathOf(g.cloak);
      const cch = ro.cloakCh;
      const bb = bbox(g.cloak, 2);
      const T0 = g.cloakTop, B0 = g.cloakBot, nn = T0.length - 1;
      const ph = ro.cloakWave * 1.7;
      const uv = (x, y) => {
        const u = clamp((g.cloakRoot[0] - x) / g.cloakLen, 0, 1), i = Math.min(nn - 1, (u * nn) | 0), f = u * nn - i;
        const ty = lerp(T0[i][1], T0[i + 1][1], f), by = lerp(B0[i][1], B0[i + 1][1], f);
        return [u, clamp((y - ty) / Math.max(1, by - ty), 0, 1)];
      };
      const fold = (u, v) => Math.sin(v * 7.5 + u * 2.5 + ph) * 0.7 + Math.sin(v * 3.1 - u * 4 + ph * 0.6) * 0.3;
      const cfn = (x, y, o) => {
        const q = uv(x, y), f = fold(q[0], q[1]);
        o[cch] = 0.38 + 0.3 * q[1] + 0.2 * smooth(0.2, -0.8, f);
        o[BLK] = 0.75 * smooth(-0.1, -0.85, f) * (0.5 + 0.5 * q[1]) + 0.3 * smooth(0.5, 1, q[1]) + (ro.gold ? 0.25 : 0);
        o[WHT] = 0.75 * smooth(0.45, 0.9, f) * (1 - 0.6 * q[1]);
        return true;
      };
      reserve(R, path, 0.9);
      stumpShade(R, g.cloak, cfn, Math.max(2, s), 0.5);
      hatch(R, { ...bb, ang: 60 * D2R, sp: sp * 1.1, len: len * 1.2, w, chs: [cch, BLK], dth: 0.6, fn: (x, y, o) => { cfn(x, y, o); const q = uv(x, y), f = fold(q[0], q[1]); const m = smooth(0.3, -0.6, f); o[cch] *= m; o[BLK] *= m; return true; } });
      clipFlush(R, path);
      const nfold = detail ? 9 : 3;
      for (let i = 0; i < nfold; i++) {
        const v0 = (i + 0.5 + (rand() - 0.5) * 0.4) / nfold;
        const pts = [];
        for (let j = 1; j <= nn; j++) pts.push(lp(T0[j], B0[j], clamp(v0 + Math.sin(j * 0.7 + i) * 0.06, 0.05, 0.95)));
        sweep(B, fold(0.5, v0) < 0 ? BLK : WHT, spline(pts, false, 3).slice((rand() * 6) | 0), cw * 1.4, 0.5 + 0.3 * rand(), rand() * 6);
      }
      contour(R, g.cloak, { ch: BLK, w: cw * 1.2, a: 0.85, wob: s * 0.4, passes: 2, rim: 0.5 });
      flushAll(R);
    }
    // long hair streaming from under the helm
    {
      const nh = detail ? 26 : 7;
      for (let i = 0; i < nh; i++) {
        const r0 = g.hairRoot[(rand() * 3) | 0];
        const Lh = (14 + rand() * 20) * s, dy = (rand() - 0.3) * 9 * s;
        B.quad(ro.hairCh, 0.45 + rand() * 0.4, cw * (0.6 + rand() * 0.5), r0[0], r0[1], r0[0] - Lh * 0.5, r0[1] + dy * 0.2 - 2 * s, r0[0] - Lh, r0[1] + dy);
      }
      flushAll(R);
    }
    // shield on the far arm
    const sd = g.shield;
    const sp2 = new Path2D(); sp2.ellipse(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 0, TAU);
    const shieldFace = () => {
      // a round shield: painted rim, a boss catching the dawn
      reserve(R, sp2, 0.92);
      fillCh(R.cT, ro.shieldCh, sp2, 0.4); fillCh(R.cT, BLK, sp2, 0.15);
      hatch(R, { ...bbox(ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 12), 1), ang: 58 * D2R, sp, len: len * 0.6, w, chs: [ro.shieldCh, BLK], fn: (x, y, o) => { const t = (x - sd.c[0]) / sd.rx; o[ro.shieldCh] = 0.4; o[BLK] = 0.55 * smooth(-0.3, 1, t); return true; } });
      clipFlush(R, sp2);
      const rimP = new Path2D(); rimP.ellipse(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 0, TAU); rimP.ellipse(sd.c[0], sd.c[1], sd.rx * 0.8, sd.ry * 0.8, sd.rot, 0, TAU);
      R.cT.fillStyle = 'rgba(' + CHS[ro.shieldCh === RED ? BLK : RED] + ',0.4)'; R.cT.fill(rimP, 'evenodd');
      if (detail) for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.3; B.line(WHT, 0.45, cw * 0.7, sd.c[0] + Math.cos(a) * sd.rx * 0.25, sd.c[1] + Math.sin(a) * sd.ry * 0.25, sd.c[0] + Math.cos(a) * sd.rx * 0.78, sd.c[1] + Math.sin(a) * sd.ry * 0.78); }
      contour(R, ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 30), { ch: BLK, w: cw, a: 0.85, wob: s * 0.2, passes: 2, rim: 0.7 });
      const bp = new Path2D(); bp.ellipse(sd.c[0] - sd.rx * 0.05, sd.c[1], sd.rx * 0.24, sd.ry * 0.2, sd.rot, 0, TAU);
      fillCh(R.cT, BLK, bp, 0.6); blob(R.cT, WHT, sd.c[0] - sd.rx * 0.12, sd.c[1] - sd.ry * 0.07, sd.rx * 0.14, sd.rx * 0.14, 0, 0.9);
      flushAll(R);
    };
    if (sd.back) { /* drawn after the torso */ } else if (ro.gold) {
      const c = R.cT;
      blob(c, WHT, sd.c[0], sd.c[1], sd.ry * 4.4, sd.ry * 3.8, 0, 0.24);
      blob(c, RED, sd.c[0], sd.c[1], sd.ry * 2.6, sd.ry * 2.3, 0, 0.16);
      reserve(R, sp2, 0.95);
      fillCh(c, WHT, sp2, 0.66); fillCh(c, RED, sp2, 0.1);
      const rimP = new Path2D(); rimP.ellipse(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 0, TAU); rimP.ellipse(sd.c[0], sd.c[1], sd.rx * 0.84, sd.ry * 0.84, sd.rot, 0, TAU);
      c.fillStyle = 'rgba(255,0,0,0.45)'; c.fill(rimP, 'evenodd');
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU + rand() * 0.04, r0 = 0.22 + rand() * 0.12, r1 = 0.68 + rand() * 0.12;
        stroke(B, i % 2 ? RED : WHT, sd.c[0] + Math.cos(a) * sd.rx * r0, sd.c[1] + Math.sin(a) * sd.ry * r0, sd.c[0] + Math.cos(a) * sd.rx * r1, sd.c[1] + Math.sin(a) * sd.ry * r1, 0.04, cw * 0.75, i % 2 ? 0.45 : 0.85);
      }
      contour(R, ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 60), { ch: RED, w: cw * 1.4, a: 0.9, wob: s * 0.2, passes: 3, dark: 0.6 });
      B.poly(RED, 0.55, cw, ellipsePts(sd.c[0], sd.c[1], sd.rx * 0.2, sd.ry * 0.2, sd.rot, 16, 0, TAU + 0.3));
      blob(c, WHT, sd.c[0] - sd.rx * 0.15, sd.c[1] - sd.ry * 0.12, sd.rx * 0.55, sd.ry * 0.5, 0, 0.75);
      for (let i = 0; i < 60; i++) {
        const a = rand() * TAU, r0 = 1.1 + rand() * 0.12, r1 = r0 + 0.35 + rand() * 1.4;
        stroke(B, WHT, sd.c[0] + Math.cos(a) * sd.rx * r0, sd.c[1] + Math.sin(a) * sd.ry * r0, sd.c[0] + Math.cos(a) * sd.rx * r1, sd.c[1] + Math.sin(a) * sd.ry * r1, 0, cw * 0.7, 0.25 + rand() * 0.35);
      }
      flushAll(R);
    } else shieldFace();
    // the near leg: hose, a boot of dark leather, the stirrup
    const legTone = (v, o) => { const D = darkOf(v, 0.05); o[RED] = 0.3 + 0.5 * D; o[BLK] = 0.7 * smooth(0.5, 1, D); o[WHT] = 0.75 * smooth(0.6, 0.85, v); };
    riderPart(R, g.leg, [cap(Q(...g.hip), Q(...g.knee), 7.5 * s, 5.2 * s), cap(Q(...g.knee), Q(...g.ank), 5 * s, 3.6 * s)], legTone, { s, cch: RED });
    fillCh(R.cT, BLK, pathOf(g.boot), 0.55);
    B.poly(WHT, 0.5, cw, [g.boot[0], g.boot[6]]);
    const st = g.boot[4];
    B.poly(BLK, 0.9, cw * 1.1, [[st[0] - 5 * s, st[1] - 8 * s], [st[0] - 7 * s, st[1] + 1 * s], [st[0] + 1 * s, st[1] + 1 * s], [st[0] - 1 * s, st[1] - 8 * s]]);
    // torso in mail
    const mailTone = (v, o) => { const D = darkOf(v, 0.12); o[BLK] = 0.42 + 0.5 * D; o[WHT] = 0.85 * smooth(0.62, 0.9, v); o[RED] = 0.2; };
    const tcap = [cap(Q(...g.at(g.hip, 4, 0)), Q(...g.at(g.hip, 26, 0)), 9.5 * s, 10.5 * s)];
    const tsh = riderPart(R, g.torso, tcap, mailTone, { s, rim: ro.gold ? 1 : 0.85 });
    if (detail && s > 1.5) {
      const tb = bbox(g.torso, 1);
      R.cS.save(); R.cS.clip(pathOf(g.torso));
      const step = Math.max(2.4 * k, 1.8 * s);
      for (let y = tb.y0; y < tb.y1; y += step) for (let x = tb.x0 + ((y / step) & 1) * step * 0.5; x < tb.x1; x += step) {
        const v = tsh(x, y); if (v === null) continue;
        B.quad(v > 0.45 ? WHT : BLK, 0.3 + rand() * 0.35, w * 0.55, x - step * 0.38, y, x, y + step * 0.42, x + step * 0.38, y);
      }
      B.flush(); R.cS.restore();
    }
    // the skirt of mail over the thigh, belted at the waist
    riderPart(R, g.skirt, [cap(Q(...g.at(g.hip, 4, 0)), Q(...lp(g.hip, g.knee, 0.7)), 9 * s, 6 * s)], mailTone, { s, rim: 0.6 });
    { const w0 = Q(...g.at(g.hip, 7.5, 10)), w1 = Q(...g.at(g.hip, 7.5, -10.4)); for (let i = 0; i < (detail ? 7 : 2); i++) { const a = lp(w0, w1, (i + 0.5) / 7); B.line(BLK, 0.45, cw * 0.8, a[0], a[1], a[0] - 7 * s, a[1] + 11 * s); } }
    const bA = Q(...g.at(g.hip, 8, -10.4)), bB = Q(...g.at(g.hip, 8, 9.6));
    B.line(RED, 0.9, cw * 2.4, bA[0], bA[1], bB[0], bB[1]);
    B.line(BLK, 0.8, cw * 0.9, bA[0], bA[1] + cw, bB[0], bB[1] + cw);
    blob(R.cT, WHT, lp(bA, bB, 0.75)[0], lp(bA, bB, 0.75)[1], 1.6 * s, 1.6 * s, 0, 0.8);
    if (sd.back) shieldFace();
    // head: face in profile, helm with cheek-guard and nasal, horsehair crest
    const faceTone = (v, o) => { const D = darkOf(v, 0.1); o[RED] = 0.4 + 0.45 * D; o[BLK] = 0.5 * smooth(0.55, 1, D); o[WHT] = 0.5 * smooth(0.65, 0.9, v); };
    const hc = g.headS;
    riderPart(R, g.face, [cap(hc, hc, 7 * s, 7 * s)], faceTone, { s, cch: RED, rim: 0.4 });
    // beard
    for (let i = 0; i < (detail ? 14 : 4); i++) { const a = g.face[6 + ((rand() * 4) | 0)]; const t = g.beardTip; B.quad(ro.hairCh, 0.55, cw * 0.7, a[0], a[1], (a[0] + t[0]) / 2 - 2 * s, (a[1] + t[1]) / 2, t[0] - rand() * 5 * s, t[1] + rand() * 3 * s); }
    if (g.mouth) fillCh(R.cS, BLK, pathOf(g.mouth), 0.9);
    const eye = Q(...g.H(3.6, -0.4)); B.line(BLK, 0.9, cw * 1.1, eye[0] - 0.8 * s, eye[1], eye[0] + 0.8 * s, eye[1] + 0.2 * s);
    const helmTone = (v, o) => { const D = darkOf(v, 0); o[BLK] = 0.3 + 0.6 * D; o[WHT] = 0.95 * smooth(0.45, 0.85, v); o[RED] = ro.gold ? 0.3 : 0.1; };
    riderPart(R, g.helm, [cap(Q(...g.H(-0.5, 2.5)), Q(...g.H(-0.5, 2.6)), 7.5 * s, 7.5 * s)], helmTone, { s, rim: 1 });
    B.line(BLK, 0.95, cw * 1.6, g.nasal[0][0], g.nasal[0][1], g.nasal[1][0], g.nasal[1][1]);
    B.poly(BLK, 0.7, cw, [Q(...g.H(-1, 0.6)), Q(...g.H(0.5, -3.6)), Q(...g.H(3, -3.4))]);
    if (ro.gold) {
      const band = [Q(...g.H(-6.2, 1.4)), Q(...g.H(-3, 2.6)), Q(...g.H(1.5, 2.8)), Q(...g.H(5.4, 1.8))];
      sweep(B, RED, spline(band, false, 4), cw * 2.2, 1); B.poly(WHT, 0.9, cw * 0.7, spline(band, false, 4).map((p) => [p[0], p[1] - cw]));
      for (let i = 0; i < 4; i++) blob(R.cT, WHT, band[i][0], band[i][1] - cw, cw * 1.3, cw * 1.3, 0, 0.85);
    }
    const cr0 = g.crown;
    for (let i = 0; i < (ro.plume ? (detail ? 44 : 10) : 0); i++) {
      const Lp = ro.plume * (0.6 + rand() * 0.6) * s;
      const ang = Math.PI - 0.3 + rand() * 0.42;
      const ex = cr0[0] + Math.cos(ang) * Lp, ey = cr0[1] + Math.sin(ang) * Lp + Lp * 0.22;
      B.quad(ro.plumeCh, 0.45 + rand() * 0.45, cw * (0.7 + rand() * 0.5), cr0[0], cr0[1], cr0[0] - Lp * 0.4, cr0[1] - Lp * (0.12 + rand() * 0.25), ex, ey);
    }
    flushAll(R);
    // near arm in a mail sleeve, the hand gloved
    const armTone = (v, o) => { const D = darkOf(v, 0.12); o[BLK] = 0.4 + 0.5 * D; o[WHT] = 0.8 * smooth(0.6, 0.88, v); o[RED] = 0.15; };
    riderPart(R, g.arm, [cap(Q(...g.sho), Q(...g.elbow), 5.4 * s, 4.4 * s), cap(Q(...g.elbow), Q(...g.hand), 4.2 * s, 3.2 * s)], armTone, { s, rim: 0.9 });
    { const hp = new Path2D(); hp.arc(g.handS[0], g.handS[1], 3.3 * s, 0, TAU); reserve(R, hp, 0.9); fillCh(R.cT, RED, hp, 0.55); fillCh(R.cT, BLK, hp, 0.25); B.poly(BLK, 0.8, cw, ellipsePts(g.handS[0], g.handS[1], 3.3 * s, 3.3 * s, 0, 10, 0, TAU + 0.5)); }
    const sw = clamp(s * 1.05, 1.4, 4.6) * k;
    if (g.spear) {
      const a = g.spear.a, b = g.spear.b;
      stroke(B, BLK, a[0], a[1], b[0], b[1], 0.003, sw, 0.85);
      B.line(RED, 0.5, sw * 0.7, a[0], a[1] + sw * 0.4, b[0], b[1] + sw * 0.4);
      B.line(WHT, 0.6, sw * 0.5, a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25 - sw * 0.45, b[0], b[1] - sw * 0.45);
      const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); const u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
      const hl = 10 * s, hw = 1.5 * s;
      const head = [[b[0] - u[0] * hl * 0.15, b[1] - u[1] * hl * 0.15], [b[0] + u[0] * hl * 0.32 + n[0] * hw, b[1] + u[1] * hl * 0.32 + n[1] * hw], [b[0] + u[0] * hl, b[1] + u[1] * hl], [b[0] + u[0] * hl * 0.32 - n[0] * hw, b[1] + u[1] * hl * 0.32 - n[1] * hw]];
      fillCh(R.cS, WHT, pathOf(head), 0.6);
      B.poly(BLK, 0.75, cw * 0.6, head.concat([head[0]]));
      B.line(WHT, 0.9, cw * 0.6, head[0][0], head[0][1] - hw * 0.4, head[2][0], head[2][1]);
      if (ro.pennon) {
        const p0 = [b[0] - u[0] * 16 * s, b[1] - u[1] * 16 * s];
        const wv = ro.cloakWave;
        const pts = [p0, [p0[0] - u[0] * 2 * s, p0[1] - 5 * s], [p0[0] - 15 * s, p0[1] - 4 * s + Math.sin(wv) * 2 * s], [p0[0] - 10 * s, p0[1] - 1.5 * s], [p0[0] - 16 * s, p0[1] + 1 * s + Math.cos(wv) * 1.5 * s], [p0[0] - 4 * s, p0[1] + 0.5 * s]];
        fillCh(R.cT, ro.pennonCh, pathOf(pts), 0.55);
        B.poly(BLK, 0.6, cw * 0.7, pts.concat([pts[0]]));
      }
    }
    if (g.sword) {
      // the king's sword held high, catching the first light
      const a = g.sword.a, b = g.sword.b, d = g.sword.d;
      blob(R.cT, WHT, lp(a, b, 0.75)[0], lp(a, b, 0.75)[1], 34 * s, 34 * s, 0, 0.22);
      const n = [-d[1], d[0]];
      const blade = [[a[0] + n[0] * 1.6 * s, a[1] + n[1] * 1.6 * s], [b[0] + n[0] * 0.5 * s, b[1] + n[1] * 0.5 * s], [b[0] + d[0] * 4 * s, b[1] + d[1] * 4 * s], [b[0] - n[0] * 0.5 * s, b[1] - n[1] * 0.5 * s], [a[0] - n[0] * 1.6 * s, a[1] - n[1] * 1.6 * s]];
      fillCh(R.cS, WHT, pathOf(blade), 1);
      B.line(BLK, 0.6, cw * 0.6, a[0] - n[0] * 1.6 * s, a[1] - n[1] * 1.6 * s, b[0] - n[0] * 0.5 * s, b[1] - n[1] * 0.5 * s);
      B.line(BLK, 0.95, sw * 1.2, a[0] - n[0] * 6 * s, a[1] - n[1] * 6 * s, a[0] + n[0] * 6 * s, a[1] + n[1] * 6 * s);
      for (let i = 0; i < 18; i++) { const t = 0.55 + rand() * 0.45, q = lp(a, b, t), an = rand() * TAU, l = (6 + rand() * 16) * s; stroke(B, WHT, q[0] + Math.cos(an) * 3 * s, q[1] + Math.sin(an) * 3 * s, q[0] + Math.cos(an) * l, q[1] + Math.sin(an) * l, 0, cw * 0.6, 0.45); }
    }
    if (g.hornPts) {
      fillCh(R.cS, WHT, pathOf(limb(g.hornPts, [1.2 * s, 1.8 * s, 2.6 * s, 4 * s])), 0.7);
      B.poly(BLK, 0.8, cw, g.hornPts);
    }
    const bit = hs.Hp(35, 7);
    const rm = [(bit[0] + g.rein[0]) / 2, Math.max(bit[1], g.rein[1]) + 7 * s];
    B.quad(BLK, 0.7, cw * 0.8, g.rein[0], g.rein[1], rm[0], rm[1], bit[0], bit[1]);
    flushAll(R);
  }

  function drawTack(R, hs, ro, detail) {
    const B = R.B, s = hs.s, k = R.k, Q = hs.Q;
    const cw = clamp(s * 0.55, 1.3, 2.8) * k;
    const sc = [Q(-27, 0), Q(-12, 3), Q(4, 1.5), Q(10, 8), Q(9, 30), Q(-6, 33), Q(-24, 31), Q(-29, 13)];
    const spl = spline(sc, true, 4);
    const path = pathOf(spl);
    const bb = bbox(spl, 2);
    hatch(R, { ...bb, ang: 58 * D2R, sp: clamp(s * 0.75, 2.4, 4.2) * k, len: clamp(s * 4, 6, 24) * k, w: clamp(s * 0.5, 1.4, 3) * k, chs: [ro.clothCh, BLK, WHT], st: 0.35, fn: (x, y, o) => { const t = (y - bb.y0) / (bb.y1 - bb.y0); const tx = (x - bb.x0) / (bb.x1 - bb.x0); o[ro.clothCh] = 0.5; o[BLK] = 0.55 * smooth(0.2, 1, t * 0.6 + tx * 0.5); o[WHT] = 0.5 * smooth(0.5, 0, tx) * smooth(0.6, 0, t); return true; } });
    clipFlush(R, path);
    contour(R, spl, { ch: BLK, w: cw, a: 0.7, wob: s * 0.3, passes: 2 });
    if (detail) {
      const hem = spline([Q(10, 26), Q(-6, 29), Q(-24, 27)], false, 8);
      B.poly(WHT, 0.65, cw, hem);
      for (let i = 0; i < hem.length; i += 2) { const p = hem[i]; B.line(ro.clothCh === BLK ? WHT : RED, 0.65, cw * 0.7, p[0], p[1] + 3 * s, p[0] - s, p[1] + 7 * s); }
      for (let i = 1; i < hem.length - 1; i += 3) { const p = hem[i]; B.quad(WHT, 0.5, cw * 0.6, p[0] - 1.5 * s, p[1] - 2 * s, p[0], p[1] - 4 * s, p[0] + 1.5 * s, p[1] - 2 * s); }
    }
    const st = spline([Q(6, 18), Q(24, 30), Q(39, 30)], false, 6);
    B.poly(BLK, 0.75, cw * 1.4, st);
    if (detail) { const m = st[(st.length * 0.7) | 0]; blob(R.cT, WHT, m[0], m[1], 2.2 * s, 2.2 * s, 0, 0.8); }
    const Hp = hs.Hp;
    B.poly(BLK, 0.8, cw * 1.1, spline([Hp(1, 0), Hp(14, 6), Hp(32, 5)], false, 5));
    B.poly(BLK, 0.75, cw * 1.1, spline([Hp(29, -1.6), Hp(30, 4), Hp(31.5, 9.6)], false, 4));
    B.poly(BLK, 0.65, cw, spline([Hp(5, -3), Hp(7, 3), Hp(10, 11)], false, 4));
    const bit = Hp(35, 7);
    blob(R.cT, WHT, bit[0], bit[1], 1.8 * s, 1.8 * s, 0, 0.7);
    flushAll(R);
  }

  /* mid-distance horse and rider: reserve, a soft shadow, contour, a few lights */
  function drawRiderMid(R, rd) {
    const hs = rd.hs, s = hs.s, k = R.k, B = R.B, rand = R.rand, ro = rd.ro;
    const g = riderGeom(hs, ro);
    const up = horseUnion(hs);
    const ru = riderUnion(g);
    reserve(R, up, 0.88); reserve(R, ru, 0.88);
    const coat = ro.coat, ch = coat === 'grey' ? WHT : coat === 'black' ? BLK : RED;
    const fog = rd.fog;
    for (const id of ['LH', 'LF']) fillCh(R.cT, coat === 'grey' ? RED : BLK, pathOf(hs.legs[id].poly), 0.3 * (1 - fog));
    const bp = pathOf(hs.body);
    const bb = bbox(hs.body);
    const sh = makeShader(hs.parts);
    const fn = (x, y, out) => { const v = sh(x, y); if (v === null) return false; coatPress(coat, v, 0.05, out); out[BLK] *= 1 - fog * 0.6; return true; };
    hatch(R, { ...bb, ang: 58 * D2R, sp: Math.max(2.6 * k, s * 1.1), len: Math.max(6 * k, s * 4), w: Math.max(1.4 * k, s * 0.55), fn, chs: [ch, BLK, WHT], st: 0.5 });
    clipFlush(R, bp);
    for (const id of ['RH', 'RF']) {
      const L = hs.legs[id], p = pathOf(L.poly);
      if (POINTS[coat]) fillCh(R.cT, BLK, p, 0.35 * (1 - fog * 0.5)); else fillCh(R.cT, ch, p, 0.25);
    }
    const cw = clamp(s * 0.7, 1.2, 2.4) * k;
    const cch = coat === 'black' ? BLK : RED;
    contour(R, hs.body, { ch: cch, w: cw, a: 0.8 * (1 - fog * 0.4), wob: s * 0.4, passes: 1, dark: 0.8 * (1 - fog), rim: 0.7 });
    for (const id of ['LH', 'LF', 'RH', 'RF']) { const L = hs.legs[id]; const c2 = id[0] === 'L' ? BLK : cch; B.poly(c2, 0.65 * (1 - fog * 0.4), cw, L.front.slice(3)); B.poly(c2, 0.65 * (1 - fog * 0.4), cw, L.back.slice(3)); }
    const tc = coat === 'grey' ? WHT : POINTS[coat] ? BLK : RED;
    for (let i = 0; i < 7; i++) { const d = hs.dock; const Lt = (48 + rand() * 30) * s; B.quad(tc, 0.55, cw, d[0], d[1], d[0] - Lt * 0.5, d[1] - Lt * (0.15 + ro.tailLift * 0.4), d[0] - Lt, d[1] - Lt * (ro.tailLift * 0.2 - 0.25 + rand() * 0.2)); }
    for (let i = 0; i < 9; i++) { const r = hs.crest(0.08 + rand() * 0.86); const Lm = ro.mane * (0.5 + rand() * 0.5) * s; B.quad(tc, 0.55, cw, r[0], r[1], r[0] - Lm * 0.5, r[1] - Lm * 0.3, r[0] - Lm, r[1] - Lm * (rand() * 0.3)); }
    const eye = hs.Hp(11.5, 4.5); B.line(BLK, 0.8, cw, eye[0], eye[1], eye[0] + s, eye[1]);
    if (g.cloak) { fillCh(R.cT, ro.cloakCh, pathOf(g.cloak), 0.4); B.poly(BLK, 0.5, cw, g.cloak.slice(0, (g.cloak.length / 2) | 0)); }
    const sd = g.shield;
    if (!sd.back) blob(R.cT, ro.shieldCh, sd.c[0], sd.c[1], sd.rx, sd.ry, 0, 0.6);
    fillCh(R.cT, BLK, pathOf(g.torso), 0.42); fillCh(R.cT, RED, pathOf(g.leg), 0.35); fillCh(R.cT, BLK, pathOf(g.boot), 0.5); fillCh(R.cT, BLK, pathOf(g.arm), 0.35);
    contour(R, g.torso, { ch: BLK, w: cw, a: 0.7, wob: s * 0.3, passes: 1, rim: 0.8 });
    if (sd.back) {
      const se = new Path2D(); se.ellipse(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 0, TAU);
      reserve(R, se, 0.8); fillCh(R.cT, ro.shieldCh, se, 0.5); fillCh(R.cT, BLK, se, 0.2);
      B.poly(WHT, 0.6, cw, ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 8, Math.PI * 0.8, Math.PI * 1.5));
      blob(R.cT, WHT, sd.c[0], sd.c[1], sd.rx * 0.25, sd.rx * 0.25, 0, 0.6);
    }
    B.poly(RED, 0.5, cw, g.leg);
    const hc = g.headS;
    { const hp = new Path2D(); hp.arc(hc[0], hc[1], g.hr * 0.95, 0, TAU); fillCh(R.cT, BLK, hp, 0.62); }
    blob(R.cT, RED, hc[0] + g.hr * 0.8, hc[1] + g.hr * 0.4, g.hr * 0.22, g.hr * 0.36, 0, 0.6);
    B.quad(WHT, 0.55 + rand() * 0.3, cw, hc[0] - g.hr * 0.95, hc[1] + g.hr * 0.2, hc[0] - g.hr * 0.95, hc[1] - g.hr * 0.95, hc[0] + g.hr * 0.1, hc[1] - g.hr * 0.95);
    const cr0 = g.crown;
    if (ro.plume) for (let i = 0; i < 4; i++) B.quad(ro.plumeCh, 0.55, cw, cr0[0], cr0[1], cr0[0] - ro.plume * 0.4 * s, cr0[1] - 3 * s, cr0[0] - ro.plume * (0.8 + rand() * 0.4) * s, cr0[1] + rand() * 6 * s);
    if (g.spear) {
      const a = g.spear.a, b = g.spear.b;
      B.line(BLK, 0.8, clamp(s * 1.1, 1.1, 3) * k, a[0], a[1], b[0], b[1]);
      B.line(WHT, 0.95, clamp(s * 1.6, 1.3, 3.6) * k, b[0], b[1], b[0] + (b[0] - a[0]) * 0.07, b[1] + (b[1] - a[1]) * 0.07);
      if (ro.pennon) fillCh(R.cT, ro.pennonCh, pathOf([[b[0] - 12 * s, b[1] - 1 * s], [b[0] - 26 * s, b[1] - 4 * s], [b[0] - 23 * s, b[1] + 1 * s]]), 0.6);
    }
    if (g.pole) { B.line(BLK, 0.85, clamp(s * 1.3, 1.2, 3.4) * k, g.pole.a[0], g.pole.a[1], g.pole.b[0], g.pole.b[1]); }
    flushAll(R);
  }

  /* far riders: a handful of marks each */
  function drawRiderFar(R, rd) {
    const B = R.B, rand = R.rand, k = R.k;
    const x = rd.x, y = rd.y, h = rd.hh;
    const fog = rd.fog;
    const ch = rand() < 0.3 ? BLK : RED;
    const a = lerp(0.9, 0.5, fog);
    const w = Math.max(1.1 * k, h * 0.3);
    B.line(ch, a, w, x - h * 0.5, y - h * 0.62, x + h * 0.32, y - h * 0.6);
    B.line(ch, a, w * 0.7, x + h * 0.3, y - h * 0.62, x + h * 0.62, y - h * (0.92 + rand() * 0.1));
    const ph = rand();
    for (let i = 0; i < 4; i++) { const lx = x + (i < 2 ? -h * 0.38 : h * 0.2) + (i & 1) * h * 0.1; const sw = Math.sin(ph * TAU + i * 1.7) * h * 0.28; B.line(i & 1 ? ch : BLK, a * 0.85, Math.max(0.8 * k, w * 0.35), lx, y - h * 0.5, lx + sw, y - h * 0.02); }
    B.line(BLK, a, w * 0.8, x - h * 0.05, y - h * 0.72, x + h * 0.08, y - h * 1.22);
    if (rand() < 0.3) B.line(rand() < 0.6 ? RED : BLK, 0.6, w * 0.6, x - h * 0.1, y - h * 1.2, x - h * 0.5, y - h * 1.15);
    const sy0 = y - h * (0.9 + rd.sp * 0.6), sy1 = y - h * (0.85 - rd.sp * 0.5);
    B.line(BLK, a * 0.9, Math.max(0.8 * k, w * 0.3), x - h * 0.6, sy0, x + h * 1.3, sy1);
    if (rand() < 0.75) B.line(WHT, 0.9, Math.max(1.1 * k, w * 0.45), x + h * 1.25, sy1 - (sy1 - sy0) * 0.03, x + h * 1.45, sy1 + (sy1 - sy0) * 0.08);
    if (rand() < 0.15) B.line(WHT, 0.45, Math.max(1 * k, w * 0.4), x - h * 0.48, y - h * 0.72, x - h * 0.2, y - h * 0.71);
  }

  /* an orc of the host, drawn in black chalk; the dawn catches the side turned toward the charge */
  function drawOrc(R, x, y, h, o) {
    const B = R.B, k = R.k, rand = R.rand;
    const s = h / 100, f = o.face;
    const P = (ux, uy) => [x + ux * s * f, y + uy * s];
    const j = () => (rand() - 0.5) * 4;
    let hip, neck, head, kneeF, footF, kneeB, footB, elbF, handF, elbB, handB;
    if (o.pose === 'flee') {
      hip = P(0, -47); neck = P(17, -80); head = P(24, -89);
      kneeF = P(18 + j(), -27); footF = P(12, -1); kneeB = P(-14, -26); footB = P(-30, -14);
      elbF = P(28, -66); handF = P(40, -78 + j()); elbB = P(2, -64); handB = P(-12, -78);
    } else if (o.pose === 'brace') {
      hip = P(0, -42); neck = P(15, -74); head = P(21, -84);
      kneeF = P(22, -25 + j()); footF = P(30, 0); kneeB = P(-12, -21); footB = P(-26, 0);
      elbF = P(22, -55); handF = P(38, -57); elbB = P(3, -57); handB = P(16, -50);
    } else {
      hip = P(0, -44); neck = P(10 + j(), -76); head = P(15, -85);
      kneeF = P(14, -23); footF = P(13, 0); kneeB = P(-9, -23); footB = P(-15, 0);
      elbF = P(15, -60); handF = P(19, -50); elbB = P(-9, -60); handB = P(-11, -48);
    }
    const mid = lp(hip, neck, 0.5);
    const torso = limb([hip, mid, neck], [9.5 * s, 12.5 * s, 9.5 * s]);
    const parts = [
      limb([hip, kneeB, footB], [6 * s, 5 * s, 3.6 * s]),
      limb([neck, elbB, handB], [4.5 * s, 4 * s, 3.2 * s]),
      torso,
      limb([hip, kneeF, footF], [6.5 * s, 5 * s, 3.8 * s]),
      limb([neck, elbF, handF], [5 * s, 4.2 * s, 3.4 * s]),
    ];
    const caps = [cap(hip, kneeB, 6 * s, 5 * s), cap(kneeB, footB, 5 * s, 3.6 * s), cap(neck, elbB, 4.5 * s, 4 * s), cap(elbB, handB, 4 * s, 3.2 * s),
      cap(hip, neck, 11 * s, 10 * s, 1.4), cap(hip, kneeF, 6.5 * s, 5 * s), cap(kneeF, footF, 5 * s, 3.8 * s), cap(neck, elbF, 5 * s, 4.2 * s), cap(elbF, handF, 4.2 * s, 3.4 * s), cap(head, head, 8.5 * s, 8.5 * s, 1.4)];
    const u = new Path2D();
    for (const p of parts) addPoly(u, p);
    u.moveTo(head[0] + 8.5 * s, head[1]); u.arc(head[0], head[1], 8.5 * s, 0, TAU);
    reserve(R, u, 0.88);
    const cw = clamp(s * 1.05, 1.2, 3) * k;
    if (h > 34 * k) {
      fillCh(R.cT, BLK, u, 0.3 + 0.12 * o.dark);
      const sh = makeShader(caps);
      const bb = bbox(parts.flat(), 2);
      hatch(R, { ...bb, ang: 58 * D2R, sp: clamp(s * 1.2, 2.6, 4.2) * k, len: clamp(s * 5, 6, 22) * k, w: clamp(s * 0.7, 1.4, 2.8) * k, chs: [BLK, RED, WHT], st: 0.3, fn: (px, py, out) => {
        const v = sh(px, py); if (v === null) return false;
        const D = darkOf(v, 0.15 + 0.1 * o.dark);
        out[BLK] = 0.35 + 0.55 * D; out[RED] = 0.35 * smooth(0.2, 0.6, D) * (1 - D); out[WHT] = 0.75 * smooth(0.62, 0.88, v); return true; } });
      clipFlush(R, u);
    } else { fillCh(R.cT, BLK, u, 0.45 + 0.2 * o.dark); fillCh(R.cS, BLK, u, 0.55); }
    for (let i = 0; i < parts.length; i++) contour(R, parts[i], { ch: BLK, w: cw, a: 0.9, wob: s * 0.6, passes: h > 34 * k ? 2 : 1, rim: 0.7 });
    // helm: a dome with a crest or spike; a jutting jaw
    { const hp = new Path2D(); hp.ellipse(head[0], head[1] - 1 * s, 8.8 * s, 8.2 * s, 0, Math.PI * 0.9, Math.PI * 2.1); hp.closePath(); fillCh(R.cS, BLK, hp, 0.85); fillCh(R.cT, BLK, hp, 0.4); }
    B.poly(BLK, 0.95, cw * 1.3, ellipsePts(head[0], head[1] - 2 * s, 9 * s, 8 * s, 0, 10, Math.PI, TAU));
    if (rand() < 0.5) B.line(BLK, 0.9, cw, head[0], head[1] - 10 * s, head[0] - f * 3 * s, head[1] - 17 * s);
    else B.poly(BLK, 0.8, cw * 1.2, [[head[0] - 7 * s, head[1] - 7 * s], [head[0] - f * 2 * s, head[1] - 13 * s], [head[0] + 6 * s, head[1] - 8 * s]]);
    B.line(WHT, 0.75, cw * 0.9, head[0] - 8 * s, head[1] - 2 * s, head[0] - 4 * s, head[1] - 8 * s);
    if (h > 30 * k && o.pose !== 'flee') {
      const jx = head[0] + f * 7 * s, jy = head[1] + 3 * s;
      B.poly(BLK, 0.9, cw, [[head[0] + f * 3 * s, head[1] + 1 * s], [jx + f * 3 * s, jy], [jx, jy + 4 * s]]);
      B.line(WHT, 0.8, cw * 0.7, jx + f * 1 * s, jy - 1 * s, jx + f * 1.5 * s, jy - 3.5 * s); // tusk
      B.line(RED, 0.9, cw * 0.8, head[0] + f * 4 * s, head[1] - 1.5 * s, head[0] + f * 5.5 * s, head[1] - 1.5 * s); // eye
    }
    // rags hanging from the belt
    for (let i = 0; i < (h > 30 * k ? 5 : 2); i++) { const q = lp(hip, mid, rand() * 0.3); stroke(B, BLK, q[0] + (rand() - 0.5) * 12 * s, q[1], q[0] + (rand() - 0.5) * 14 * s, q[1] + (12 + rand() * 10) * s, 0.1, cw, 0.6); }
    if (o.pose === 'brace') {
      const ang = (-12 - rand() * 20) * D2R;
      const d = [Math.cos(ang) * f, Math.sin(ang)];
      const a = [handB[0] - d[0] * 40 * s, handB[1] - d[1] * 40 * s], b = [handF[0] + d[0] * 150 * s, handF[1] + d[1] * 150 * s];
      B.line(BLK, 0.9, Math.max(1.2 * k, 1.7 * s), a[0], a[1], b[0], b[1]);
      B.line(RED, 0.5, Math.max(1 * k, 1 * s), a[0], a[1] + 1.2 * s, b[0], b[1] + 1.2 * s);
      B.poly(BLK, 0.9, cw, [[b[0] - d[0] * 12 * s, b[1] - d[1] * 12 * s - 2 * s], [b[0], b[1]], [b[0] - d[0] * 12 * s, b[1] - d[1] * 12 * s + 2 * s]]);
      B.line(WHT, 0.85, Math.max(1.2 * k, 1.4 * s), b[0], b[1], b[0] - d[0] * 12 * s, b[1] - d[1] * 12 * s);
    } else if (o.pose === 'stand') {
      const ta = (rand() - 0.5) * 0.7 - 0.25 * f;
      const tx = handF[0] + Math.sin(ta) * 110 * s, ty = handF[1] - Math.cos(ta) * 110 * s;
      B.line(BLK, 0.9, Math.max(1.1 * k, 1.6 * s), handF[0] - Math.sin(ta) * 40 * s, handF[1] + Math.cos(ta) * 40 * s, tx, ty);
      B.line(WHT, 0.75, Math.max(1.1 * k, 1.8 * s), tx, ty, tx + Math.sin(ta) * 10 * s, ty - Math.cos(ta) * 10 * s);
      if (o.flag) {
        const fl = [[tx, ty + 6 * s], [tx - f * 38 * s, ty + 10 * s], [tx - f * 30 * s, ty + 20 * s], [tx - f * 40 * s, ty + 32 * s], [tx, ty + 30 * s]];
        const fp = pathOf(fl); reserve(R, fp, 0.85); fillCh(R.cT, BLK, fp, 0.7); B.poly(RED, 0.6, cw, fl);
        blob(R.cT, RED, tx - f * 18 * s, ty + 18 * s, 6 * s, 5 * s, 0, 0.9);
      }
    } else if (rand() < 0.6) {
      B.line(BLK, 0.85, Math.max(1 * k, 1.4 * s), handF[0], handF[1], handF[0] + f * 30 * s, handF[1] - 40 * s);
    }
    if (o.pose !== 'flee') {
      const sc = o.pose === 'brace' ? [handB[0], handB[1] - 4 * s] : [handB[0] - f * 4 * s, handB[1]];
      const se = new Path2D(); se.ellipse(sc[0], sc[1], 11 * s, 14 * s, 0, 0, TAU);
      reserve(R, se, 0.85); fillCh(R.cT, BLK, se, 0.7);
      B.poly(f < 0 ? WHT : RED, 0.65, cw, ellipsePts(sc[0], sc[1], 11 * s, 14 * s, 0, 10, Math.PI * 0.6, Math.PI * 1.4));
      blob(R.cT, WHT, sc[0] - 1.5 * s, sc[1] - 2 * s, 2.5 * s, 2.5 * s, 0, 0.5);
    }
    flushAll(R);
  }

  /* ============================================================= the scene */
  async function drawSky(R, L) {
    const { W, H, hy } = L, rand = R.rand, N = R.noise, k = R.k, B = R.B;
    const [sunX, sunY] = L.sun;
    const C = L.city;
    const edgeY = (x) => H * (0.05 + 0.25 * smooth(-0.15 * W, 0.95 * W, x)) + (N.fbm(x / (H * 0.2), 2.2, 3) - 0.5) * H * 0.1;
    const dark = (x, y, oct) => {
      const e = edgeY(x);
      const inC = smooth(e + H * 0.06, e - H * 0.05, y);
      const n = N.fbm(x / (H * 0.17), y / (H * 0.07), oct || 4);
      const top = smooth(hy, 0, y), right = smooth(W * 0.25, W, x);
      const streak = smooth(0.52, 0.72, N.fbm(x / (H * 0.45), y / (H * 0.022), 3)) * smooth(hy, hy - H * 0.22, y);
      let d = inC * (0.5 + 0.35 * top + 0.6 * (n - 0.5) + 0.15 * right) + (1 - inC) * (0.08 + 0.32 * right * (0.4 + top) + streak * 0.45);
      const ds = Math.hypot((x - sunX) / (W * 0.4), (y - sunY) / (H * 0.3));
      d -= 0.3 * Math.exp(-ds * ds);
      return clamp(d, 0, 1);
    };
    const lr = lowres(R, 6);
    for (let y = -H * 0.05; y < hy + H * 0.01; y += H * 0.018) {
      for (let x = -W * 0.05; x < W * 1.05; x += H * 0.026) {
        const xx = x + (rand() - 0.5) * H * 0.02, yy = y + (rand() - 0.5) * H * 0.012;
        const d = dark(xx, yy);
        const fade = smooth(hy + H * 0.01, hy - H * 0.06, yy);
        blob(lr.x, BLK, xx, yy, H * 0.045, H * 0.02, (rand() - 0.5) * 0.25, 0.2 * d * d * fade);
        const lt = 1 - d;
        blob(lr.x, WHT, xx, yy, H * 0.04, H * 0.016, 0, 0.1 * lt * lt * lt * smooth(0, hy * 0.6, yy));
      }
      await R.tick();
    }
    blob(lr.x, WHT, sunX, sunY - H * 0.02, W * 0.42, H * 0.08, 0, 0.5);
    blob(lr.x, WHT, sunX, sunY, W * 0.16, H * 0.035, 0, 0.6);
    blob(lr.x, RED, sunX + W * 0.1, hy - H * 0.03, W * 0.55, H * 0.07, 0, 0.32);
    blob(lr.x, RED, C.cx, C.cb - C.cs * 30, C.w * 0.9, C.cs * 70, 0, 0.28);
    for (let i = 0; i < 9; i++) {
      const a0 = (-168 + i * 15 + rand() * 7) * D2R, wdt = (1.4 + rand() * 2.6) * D2R;
      const Lr = W * 1.1;
      const gr = lr.x.createLinearGradient(sunX, sunY, sunX + Math.cos(a0) * Lr, sunY + Math.sin(a0) * Lr);
      gr.addColorStop(0, 'rgba(0,0,255,0)'); gr.addColorStop(0.08, 'rgba(0,0,255,0.16)'); gr.addColorStop(0.5, 'rgba(0,0,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,255,0)');
      lr.x.fillStyle = gr;
      lr.x.beginPath(); lr.x.moveTo(sunX, sunY);
      lr.x.lineTo(sunX + Math.cos(a0 - wdt) * Lr, sunY + Math.sin(a0 - wdt) * Lr);
      lr.x.lineTo(sunX + Math.cos(a0 + wdt) * Lr, sunY + Math.sin(a0 + wdt) * Lr);
      lr.x.closePath(); lr.x.fill();
    }
    lr.done();
    await R.tick();
    const fn = (x, y, o) => {
      if (y > hy) return false;
      const d = dark(x, y);
      const fade = smooth(hy + 2, hy - H * 0.03, y);
      const d2 = dark(x - H * 0.01, y + H * 0.01);
      o[BLK] = 0.8 * smooth(0.32, 0.95, d) * fade;
      o[WHT] = (0.42 * smooth(0.45, 0.05, d) * smooth(hy * 0.2, hy * 0.85, y) + 0.8 * clamp((d - d2) * 7, 0, 1)) * fade;
      o[RED] = (0.55 * clamp((d - d2) * 5, 0, 1) + 0.3 * smooth(hy - H * 0.15, hy, y) * (1 - d)) * fade;
      return true;
    };
    const fnDeep = (x, y, o) => { if (!fn(x, y, o)) return false; o[BLK] = 0.75 * smooth(0.5, 1, dark(x, y)); return true; };
    const step = H * 0.1;
    for (let y0 = 0; y0 < hy; y0 += step) {
      const bx = { x0: 0, y0, x1: W, y1: Math.min(hy, y0 + step) };
      hatch(R, { ...bx, ang: 62 * D2R, sp: 4.6 * k, len: 34 * k, w: 2.6 * k, fn: fnDeep, chs: [BLK], bend: 0.05 });
      hatch(R, { ...bx, ang: -6 * D2R, sp: 5.6 * k, len: 90 * k, w: 2.4 * k, fn, chs: [WHT, RED], dth: 0.5, bend: 0.02 });
      flushAll(R);
      await R.tick();
    }
    // long strokes swept along the wind that drives the darkness back: black in the cloud, white where it breaks
    const e = H * 0.006;
    const dS = (x, y) => dark(x, y, 2);
    const flow = (x, y) => (-14 + 46 * (N.fbm(x / (H * 0.55) + 3.3, y / (H * 0.3), 2) - 0.5) + 10 * smooth(W * 0.5, W, x)) * D2R;
    const stp = 9 * k;
    for (let i = 0; i < 2400; i++) {
      let x = rand() * W * 1.05 - W * 0.02, y = rand() * hy * 0.98;
      const d0 = dark(x, y);
      if (d0 < 0.18) continue;
      const pts = [[x, y]];
      const n = 10 + ((rand() * 34) | 0);
      let dm = 0, lit = 0;
      for (let j = 0; j < n; j++) {
        const a = flow(x, y);
        x += Math.cos(a) * stp; y += Math.sin(a) * stp;
        if (y > hy - 2 || y < -10 || x > W + 20) break;
        pts.push([x, y]);
        dm += dark(x, y, 3);
      }
      if (pts.length < 5) continue;
      dm /= pts.length - 1;
      const g = [(dS(x + e, y) - dS(x - e, y)), (dS(x, y + e) - dS(x, y - e))], gl = Math.hypot(g[0], g[1]) || 1;
      lit = (g[0] * LD2[0] + g[1] * LD2[1]) / gl;
      const fade = smooth(hy, hy - H * 0.05, y);
      const sm = spline(pts.filter((q, qi) => qi % 2 === 0 || qi === pts.length - 1), false, 2);
      if (lit < -0.3 && dm > 0.25 && dm < 0.62) {
        B.poly(WHT, (0.3 + 0.45 * rand()) * fade, 2.4 * k, sm);
        if (rand() < 0.4) B.poly(RED, 0.35 * fade, 2 * k, sm.map((p) => [p[0] + 2 * k, p[1] + 4 * k]));
      } else if (dm > 0.3) {
        B.poly(BLK, (0.1 + 0.55 * smooth(0.3, 1, dm)) * fade * (0.6 + 0.4 * rand()), (1.8 + rand()) * k, sm);
      }
      if (i % 300 === 0) { flushAll(R); await R.tick(); }
    }
    flushAll(R);
  }

  async function drawMountains(R, L) {
    const { W, H, hy } = L, rand = R.rand, N = R.noise, k = R.k, B = R.B;
    const C = L.city;
    const far = [];
    for (let x = -20; x <= C.cx; x += W * 0.008) far.push([x, hy - H * (0.008 + 0.018 * N.fbm(x / (H * 0.18), 3.3, 3)) - smooth(C.cx - C.w * 1.6, C.cx - C.w * 0.6, x) * H * 0.035]);
    const farPoly = far.concat([[C.cx, hy + 2], [-20, hy + 2]]);
    fillCh(R.cT, RED, pathOf(farPoly), 0.1);
    contour(R, far, { closed: false, ch: RED, w: 1.8 * k, a: 0.4, wob: 1.5 * k, passes: 1, flat: true });
    // Mindolluin: a great dark mass with shoulders, its snows catching the dawn
    const base = [
      [C.cx - C.w * 1.55, hy - H * 0.01], [C.cx - C.w * 1.05, hy - C.cs * 42], [C.cx - C.w * 0.72, C.cb - C.cs * 96], [C.cx - C.w * 0.5, C.cb - C.cs * 118],
      [C.cx - C.w * 0.22, C.cb - C.cs * 150], [C.cx + C.w * 0.05, C.cb - C.cs * 205], [C.cx + C.w * 0.28, C.cb - C.cs * 262], [C.cx + C.w * 0.46, C.cb - C.cs * 300],
      [C.cx + C.w * 0.62, C.cb - C.cs * 282], [C.cx + C.w * 0.85, C.cb - C.cs * 240], [C.cx + C.w * 1.1, C.cb - C.cs * 262], [W + C.w * 0.5, C.cb - C.cs * 228],
    ];
    let ridge = spline(base, false, 14);
    ridge = ridge.map((p, i) => [p[0], p[1] + (N.fbm(i * 0.08, 7.7, 4) - 0.5) * C.cs * 30 + (N.v2(i * 0.5, 3) - 0.5) * C.cs * 6]);
    const poly = ridge.concat([[W + C.w * 0.5, hy + 3], [C.cx - C.w * 1.55, hy + 3]]);
    const path = pathOf(poly);
    const bb = bbox(poly);
    reserve(R, path, 0.5);
    const ridgeY = (x) => { let lo = 0, hi = ridge.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ridge[m][0] < x) lo = m; else hi = m; } return ridge[lo][1]; };
    // the slope of the ground and which way it faces: valleys and spurs from a noise relief
    const relief = (x, y) => N.fbm(x / (C.cs * 50), y / (C.cs * 90), 4) + 0.3 * N.fbm(x / (C.cs * 12), y / (C.cs * 40), 3);
    const tone = (x, y, o) => {
      const ry = ridgeY(x); if (y < ry - 2) return false;
      const e = C.cs * 4, gx = relief(x + e, y) - relief(x - e, y);
      const facing = clamp(-gx * 9, -1, 1); // >0: turned to the dawn
      const dd = (y - ry) / (C.cs * 80);
      const snow = smooth(C.cb - C.cs * 200, C.cb - C.cs * 260, y) * smooth(-0.3, 0.5, facing) * smooth(1.2, 0.2, dd);
      o[BLK] = clamp(0.66 - 0.3 * facing - 0.35 * snow, 0.1, 0.92) * smooth(hy + 2, hy - C.cs * 40, y);
      o[WHT] = clamp(0.4 * snow + 0.12 * smooth(0.4, 0.9, facing) * smooth(1.2, 0, dd), 0, 0.7);
      o[RED] = 0.12 + 0.2 * smooth(hy - C.cs * 50, hy, y) + 0.15 * smooth(0, 0.8, facing) * (1 - snow);
      return true;
    };
    stumpShade(R, poly, tone, Math.max(3, C.cs * 2), 0.85);
    // long strokes with the side of the chalk down the gullies and along the spurs
    for (let i = 0; i < 900; i++) {
      let x = lerp(bb.x0, Math.min(W, bb.x1), rand()), y = lerp(bb.y0, hy, Math.pow(rand(), 0.8));
      if (y < ridgeY(x) + 2) continue;
      HO[0] = HO[1] = HO[2] = 0; tone(x, y, HO);
      const pts = [[x, y]];
      const nS = 6 + ((rand() * 10) | 0), st = C.cs * (2.5 + rand() * 2.5);
      for (let j = 0; j < nS; j++) {
        const e = C.cs * 3, g0 = relief(x + e, y) - relief(x - e, y), g1 = relief(x, y + e) - relief(x, y - e);
        // run down the fall line, bending along the relief
        const a = Math.atan2(1, -g0 * 6 + (x > C.cx ? 0.35 : -0.35)) + g1 * 2;
        x += Math.cos(a) * st * 0.6 * Math.sign(Math.sin(a) + 1e-3); y += Math.abs(Math.sin(a)) * st;
        if (y > hy) break;
        pts.push([x, y]);
      }
      if (pts.length < 3) continue;
      const ch = HO[WHT] > 0.35 && rand() < 0.75 ? WHT : (HO[BLK] > 0.45 ? BLK : RED);
      sweep(B, ch, spline(pts, false, 2), (2.2 + rand() * 3) * k, clamp((ch === WHT ? HO[WHT] : ch === BLK ? HO[BLK] : 0.5) * 0.9, 0.25, 0.9), rand() * 6);
      if (i % 80 === 0) { clipFlush(R, path); await R.tick(); }
    }
    clipFlush(R, path);
    // snow along the crest, lit
    for (let i = 0; i < ridge.length; i++) {
      const p = ridge[i];
      if (p[1] > C.cb - C.cs * 200 || rand() < 0.35) continue;
      const l = (8 + rand() * 26) * C.cs;
      sweep(B, WHT, [[p[0], p[1] + C.cs * 2], [p[0] - l * 0.2, p[1] + l * 0.5], [p[0] - l * 0.45, p[1] + l]], 3 * k, 0.75, rand() * 6);
    }
    contour(R, ridge, { closed: false, ch: BLK, w: 2.6 * k, a: 0.8, wob: 2.5 * k, passes: 2, flat: true });
    contour(R, ridge.filter((q) => q[1] < C.cb - C.cs * 190), { closed: false, ch: WHT, w: 2.2 * k, a: 0.6, wob: 2 * k, passes: 1, flat: true });
    flushAll(R);
    await R.tick();
  }

  async function drawCity(R, L) {
    const rand = R.rand, k = R.k, B = R.B, N = R.noise;
    const C = L.city, cs = C.cs;
    // seven circles, each set back into the mountain and higher than the last; seen from the east, a little above
    const al = 13 * D2R, ca = Math.cos(al), sa = Math.sin(al);
    const P3 = (x, y, z) => [C.cx + x * cs, C.cb + (-y * ca + (z - 100) * sa) * cs];
    const T = [];
    for (let i = 0; i < 7; i++) T.push({ r: 100 - i * 11.6, c: -i * 8, y: i * 13.2, h: i === 0 ? 15 : 12, tm: (112 - i * 7) * D2R });
    const LT = [-0.8, 0.25, 0.55];
    const litAt = (th) => clamp(Math.sin(th) * LT[0] + Math.cos(th) * LT[2], -1, 1);
    const lw = clamp(cs * 0.4, 1.3, 2.6) * k;
    const thOf = (i, x) => Math.asin(clamp((x - C.cx) / cs / T[i].r, -1, 1));
    const wallPts = (i, y0, y1, th0, th1) => {
      const t = T[i], n = 40, top = [], bot = [];
      for (let j = 0; j <= n; j++) { const th = lerp(th0, th1, j / n); const x = t.r * Math.sin(th), z = t.c + t.r * Math.cos(th); top.push(P3(x, y1, z)); bot.push(P3(x, y0, z)); }
      return { top, bot, poly: top.concat(bot.slice().reverse()) };
    };
    // the whole city is wiped clean of the mountain's chalk first
    {
      const o = [];
      for (let i = 0; i < 7; i++) { const t = T[i]; o.push(P3(-t.r * Math.sin(t.tm), t.y, t.c + t.r * Math.cos(t.tm))); }
      o.push(P3(0, T[6].y + 70, T[6].c));
      for (let i = 6; i >= 0; i--) { const t = T[i]; o.push(P3(t.r * Math.sin(t.tm), t.y, t.c + t.r * Math.cos(t.tm))); }
      const fr = wallPts(0, 0, 0, T[0].tm, -T[0].tm).top;
      reserve(R, pathOf(o.concat(fr)), 0.55);
    }
    const houses = (i) => {
      const t = T[i], tn = T[i + 1];
      const y0 = t.y + t.h - 2;
      const list = [];
      const n = Math.round(t.r * (i === 6 ? 1.0 : 1.9));
      for (let j = 0; j < n; j++) {
        const th = (rand() * 2 - 1) * t.tm * 0.92;
        const rin = tn ? Math.max(tn.r + 3, 0) : 0;
        const rr = lerp(rin, t.r - 3, Math.sqrt(rand()));
        const x = rr * Math.sin(th), z = t.c + rr * Math.cos(th);
        if (tn && Math.hypot(x, z - tn.c) < tn.r + 2) continue;
        const tower = rand() < 0.05;
        list.push({ x, z, th, w: tower ? 2 + rand() : 2 + rand() * 3.2, h: tower ? 10 + rand() * 6 : 3 + rand() * 5, roof: rand() });
      }
      list.sort((a, b) => a.z - b.z);
      for (const q of list) {
        const pb = P3(q.x, y0, q.z), pt = P3(q.x, y0 + q.h, q.z);
        const hw = q.w * cs / 2;
        const x0 = pb[0] - hw, x1 = pb[0] + hw, yb = pb[1], yt = pt[1];
        const lt = litAt(q.th - 0.3);
        const r = new Path2D(); r.rect(x0, yt, x1 - x0, yb - yt);
        reserve(R, r, 0.6);
        const split = lerp(x0, x1, clamp(0.55 + 0.35 * lt, 0.15, 0.9));
        const lr = new Path2D(); lr.rect(x0, yt, split - x0, yb - yt);
        fillCh(R.cT, WHT, lr, clamp(0.2 + 0.6 * lt, 0.05, 0.85)); fillCh(R.cT, RED, lr, 0.12 + 0.12 * Math.max(0, lt));
        const dr = new Path2D(); dr.rect(split, yt, x1 - split, yb - yt);
        fillCh(R.cT, BLK, dr, 0.3 + 0.35 * (1 - Math.max(0, lt)));
        if (q.roof < 0.35) B.poly(BLK, 0.75, lw, [[x0 - cs * 0.3, yt], [(x0 + x1) / 2, yt - cs * 1.6], [x1 + cs * 0.3, yt]]);
        else if (q.roof < 0.45) B.poly(BLK, 0.65, lw, ellipsePts((x0 + x1) / 2, yt, (x1 - x0) / 2, cs * 1.3, 0, 6, Math.PI, TAU));
        else B.line(BLK, 0.6, lw, x0, yt, x1, yt);
        const nw = Math.max(1, (q.w * q.h / 4) | 0);
        for (let m = 0; m < nw; m++) {
          const wx = lerp(x0, x1, 0.2 + rand() * 0.6), wy = lerp(yt, yb, 0.2 + rand() * 0.5);
          const fire = i < 2 && rand() < 0.35;
          B.line(fire ? RED : BLK, 0.9, Math.max(1.2 * k, cs * 0.55), wx, wy, wx, wy + cs * 0.8);
        }
        if (lt > 0.2) B.line(WHT, 0.8, lw * 0.8, x0, yt, x0, yb);
        B.line(BLK, 0.6, lw * 0.8, x1, yt, x1, yb);
      }
      flushAll(R);
    };
    const wall = (i) => {
      const t = T[i];
      const W0 = wallPts(i, t.y, t.y + t.h, -t.tm, t.tm);
      const path = pathOf(W0.poly);
      reserve(R, path, 0.88);
      const fn = (x, y, o) => {
        const lt = litAt(thOf(i, x));
        if (i === 0) { o[BLK] = 0.55 + 0.3 * smooth(0.4, -0.4, lt); o[WHT] = 0.45 * smooth(0.3, 0.9, lt); o[RED] = 0.25 + 0.15 * smooth(0, 0.6, lt); }
        else { o[WHT] = 0.85 * smooth(0.0, 0.8, lt); o[RED] = 0.12 + 0.3 * smooth(0.0, 0.5, lt) * (1 - 0.6 * smooth(0.5, 1, lt)); o[BLK] = 0.8 * smooth(0.25, -0.45, lt); }
        return true;
      };
      stumpShade(R, W0.poly, fn, Math.max(2, cs * 1.2), 0.85);
      // courses of masonry: long strokes along the curve of the wall
      for (let q = 1; q < 4; q++) {
        const ln = wallPts(i, 0, t.y + t.h * q / 4, -t.tm, t.tm).top;
        const pts = ln.filter((_, j) => j % 2 === 0);
        for (let j = 0; j < pts.length - 1; j++) {
          const lt = litAt(lerp(-t.tm, t.tm, j / (pts.length - 1)));
          if (rand() < 0.3) continue;
          B.line(lt > 0.2 ? (rand() < 0.5 ? WHT : RED) : BLK, 0.45, lw * 0.8, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]);
        }
      }
      for (let j = 0; j < t.r * 1.2; j++) {
        const th = (rand() * 2 - 1) * t.tm, yy = t.y + rand() * t.h;
        const p0 = P3(t.r * Math.sin(th), yy, t.c + t.r * Math.cos(th)), p1 = P3(t.r * Math.sin(th), yy - 1.6, t.c + t.r * Math.cos(th));
        B.line(litAt(th) > 0.3 ? RED : BLK, 0.4, lw * 0.7, p0[0], p0[1], p1[0], p1[1]);
      }
      // bastions
      for (let th = -t.tm + 0.25 + rand() * 0.15; th < t.tm - 0.2; th += 0.3 + rand() * 0.12) {
        if (Math.abs(th) < 0.12) continue;
        const lt = litAt(th);
        const x = (t.r + 1.5) * Math.sin(th), z = t.c + (t.r + 1.5) * Math.cos(th);
        const pb = P3(x, t.y, z), pt = P3(x, t.y + t.h + 3, z);
        const hw = 2.6 * cs * Math.max(0.3, Math.cos(th));
        const bt = new Path2D(); bt.rect(pb[0] - hw, pt[1], hw * 2, pb[1] - pt[1]);
        reserve(R, bt, 0.85);
        fillCh(R.cT, i === 0 ? BLK : WHT, bt, i === 0 ? 0.55 : clamp(0.15 + 0.75 * lt, 0.05, 0.9));
        const sx = pb[0] + hw * clamp(lt, -0.8, 0.8);
        const sr = new Path2D(); sr.rect(sx, pt[1], pb[0] + hw - sx, pb[1] - pt[1]);
        fillCh(R.cT, BLK, sr, 0.45);
        for (let m = -2; m <= 2; m++) B.line(lt > 0.25 ? WHT : BLK, 0.9, cs * 0.8, pb[0] + m * hw * 0.4, pt[1], pb[0] + m * hw * 0.4, pt[1] - cs * 1.3);
        B.line(BLK, 0.75, lw, pb[0] + hw, pt[1], pb[0] + hw, pb[1]);
      }
      // battlements along the top, lit gold-white on the east
      const top = W0.top;
      for (let j = 0; j < top.length - 1; j++) {
        const lt = litAt(lerp(-t.tm, t.tm, j / (top.length - 1)));
        for (let m = 0; m < 3; m++) { const q = lp(top[j], top[j + 1], m / 3); B.line(lt > 0.25 ? WHT : BLK, 0.9, cs * 0.8, q[0], q[1], q[0], q[1] - cs * 1.4); }
      }
      contour(R, W0.top, { closed: false, ch: BLK, w: lw, a: 0.6, wob: cs * 0.2, passes: 1, flat: true });
      contour(R, W0.bot, { closed: false, ch: BLK, w: lw * 1.3, a: 0.85, wob: cs * 0.2, passes: 1, flat: true });
      // gates, on alternate sides as the road winds up; the Great Gate broken
      const gth = i === 0 ? 0 : (i % 2 ? -0.42 : 0.42);
      const gp0 = P3(t.r * Math.sin(gth), t.y, t.c + t.r * Math.cos(gth));
      const gw = (i === 0 ? 5 : 2.4) * cs * Math.max(0.4, Math.cos(gth)), gh = (i === 0 ? 10 : 6) * cs;
      const gp = new Path2D();
      gp.moveTo(gp0[0] - gw, gp0[1]); gp.lineTo(gp0[0] - gw, gp0[1] - gh + gw); gp.arc(gp0[0], gp0[1] - gh + gw, gw, Math.PI, 0); gp.lineTo(gp0[0] + gw, gp0[1]); gp.closePath();
      fillCh(R.cS, BLK, gp, 0.95);
      if (i === 0) {
        blob(R.cT, RED, gp0[0], gp0[1] - gh * 0.4, gw * 2.4, gh * 0.9, 0, 0.75);
        for (let m = 0; m < 14; m++) stroke(B, m < 10 ? RED : WHT, gp0[0] + (rand() - 0.5) * gw * 1.6, gp0[1], gp0[0] + (rand() - 0.5) * gw * 2, gp0[1] - gh * (0.3 + rand() * 0.8), 0.25, lw, 0.85);
        // the broken leaves of the gate, and the towers that flank it
        B.line(BLK, 0.9, lw * 2, gp0[0] - gw * 0.9, gp0[1], gp0[0] - gw * 1.8, gp0[1] + cs * 1.5);
        B.line(BLK, 0.9, lw * 2, gp0[0] + gw * 0.7, gp0[1] - cs, gp0[0] + gw * 1.9, gp0[1] + cs * 1.2);
        for (const sx of [-1, 1]) {
          const tb = P3(sx * 10, 0, 100 - 0.5), tt = P3(sx * 10, t.h + 8, 100 - 0.5);
          const tw = new Path2D(); tw.rect(tb[0] - 4 * cs, tt[1], 8 * cs, tb[1] - tt[1]);
          reserve(R, tw, 0.85);
          fillCh(R.cT, BLK, tw, 0.6);
          if (sx < 0) fillCh(R.cT, WHT, tw, 0.22);
          B.line(WHT, 0.7, lw, tb[0] - 4 * cs, tt[1], tb[0] - 4 * cs, tb[1]);
          for (let u = -3; u <= 3; u += 1.75) B.line(BLK, 0.9, cs * 0.9, tb[0] + u * cs, tt[1], tb[0] + u * cs, tt[1] - cs * 1.5);
        }
      }
      flushAll(R);
    };
    // the citadel on the topmost circle, and the White Tower of Ecthelion
    const t6 = T[6], ytop = t6.y + t6.h - 2;
    {
      const bl = [];
      for (let j = 0; j < 12; j++) { const x = (rand() * 2 - 1) * t6.r * 0.75, z = t6.c + (rand() * 0.8 - 0.3) * t6.r * 0.6; bl.push({ x, z, w: 3 + rand() * 6, h: 4 + rand() * 7 }); }
      bl.push({ x: -10, z: t6.c + 6, w: 20, h: 9, hall: true });
      bl.sort((a, b) => a.z - b.z);
      for (const q of bl) {
        const pb = P3(q.x, ytop, q.z), pt = P3(q.x, ytop + q.h, q.z);
        const hw = q.w * cs / 2;
        const r = new Path2D(); r.rect(pb[0] - hw, pt[1], hw * 2, pb[1] - pt[1]);
        reserve(R, r, 0.8);
        const lt = litAt(Math.atan2(q.x, q.z - t6.c + 20) - 0.3);
        fillCh(R.cT, WHT, r, 0.3 + 0.5 * Math.max(0, lt));
        const sr = new Path2D(); sr.rect(pb[0] + hw * 0.3, pt[1], hw * 0.7, pb[1] - pt[1]); fillCh(R.cT, BLK, sr, 0.35);
        if (q.hall) { B.poly(BLK, 0.8, lw, [[pb[0] - hw - cs, pt[1]], [pb[0] - hw * 0.2, pt[1] - 4 * cs], [pb[0] + hw + cs, pt[1]]]); for (let u = -hw * 0.85; u < hw * 0.8; u += 2.2 * cs) B.line(BLK, 0.8, Math.max(1.2 * k, cs * 0.6), pb[0] + u, pt[1] + 3 * cs, pb[0] + u, pt[1] + 6 * cs); }
        else B.poly(BLK, 0.65, lw, [[pb[0] - hw, pt[1]], [pb[0] + hw, pt[1]], [pb[0] + hw, pb[1]]]);
      }
      const tx = 7, tz = t6.c + 12;
      const tb = P3(tx, ytop - 1, tz), th = 50;
      const Tw = (dx, dy) => [tb[0] + dx * cs, tb[1] - dy * cs];
      const tw = [Tw(-3.3, 0), Tw(-2.5, th), Tw(-3.8, th + 1), Tw(-3.8, th + 3.6), Tw(-2.3, th + 3.6), Tw(-1.5, th + 9), Tw(0, th + 18), Tw(1.5, th + 9), Tw(2.3, th + 3.6), Tw(3.8, th + 3.6), Tw(3.8, th + 1), Tw(2.5, th), Tw(3.3, 0)];
      const tp = pathOf(tw);
      blob(R.cT, WHT, tb[0], tb[1] - (th + 8) * cs, cs * 16, cs * 26, 0, 0.32);
      reserve(R, tp, 0.95);
      fillCh(R.cT, WHT, tp, 0.95);
      const half = pathOf([Tw(0.8, 0), Tw(0.6, th), Tw(2.5, th), Tw(3.3, 0)]);
      fillCh(R.cT, BLK, half, 0.3); fillCh(R.cT, RED, pathOf([Tw(-3.3, 0), Tw(-2.5, th), Tw(-1.2, th), Tw(-1.6, 0)]), 0.12);
      contour(R, tw, { ch: BLK, w: lw, a: 0.6, wob: cs * 0.1, passes: 1 });
      for (let v = 4; v < th - 2; v += 3.4) { const q = Tw(-0.6, v); B.line(BLK, 0.85, Math.max(1.2 * k, cs * 0.5), q[0], q[1], q[0], q[1] - cs * 1.2); }
      B.line(WHT, 1, cs * 0.9, ...Tw(-2, 1), ...Tw(-1.7, th - 1));
      B.line(BLK, 0.85, lw * 0.8, ...Tw(0, th + 18), ...Tw(0, th + 23));
      fillCh(R.cS, WHT, pathOf([Tw(0, th + 23), Tw(-5.5, th + 22.2), Tw(-5, th + 21), Tw(0, th + 21.2)]), 0.9);
      flushAll(R);
    }
    await R.tick();
    for (let i = 6; i >= 0; i--) {
      if (i < 6) houses(i);
      wall(i);
      await R.tick();
    }
    // the rock flanks of the mountain into which the circles are cut: their ends vanish into it
    for (const side of [-1, 1]) {
      const pts = [];
      for (let i = 0; i < 7; i++) { const t = T[i]; const th = side * t.tm * 0.97; pts.push(P3(t.r * Math.sin(th), t.y + (i === 0 ? 0 : -2), t.c + t.r * Math.cos(th))); }
      pts.push(P3(side * T[6].r * 0.55, T[6].y + 30, T[6].c - 10));
      pts.push(P3(side * (T[6].r + 16), T[6].y + 14, T[6].c - 20), P3(side * (T[2].r + 14), T[2].y + 4, T[2].c - 10), P3(side * (T[0].r + 10), 0, T[0].c + 30));
      const jag = [];
      for (let i = 0; i < pts.length; i++) {
        jag.push(pts[i]);
        if (i < 7) for (let j = 1; j < 3; j++) { const q = lp(pts[i], pts[i + 1], j / 3); jag.push([q[0] + side * (rand() * 3) * cs, q[1] + (rand() - 0.5) * 2 * cs]); }
      }
      const fp = pathOf(jag);
      reserve(R, fp, 0.88);
      const lit = side < 0;
      const bb = bbox(jag);
      stumpShade(R, jag, (x, y, o) => { const n = N.fbm(x / (cs * 5), y / (cs * 14), 3); o[BLK] = lit ? 0.35 + 0.3 * n : 0.62 + 0.3 * n; o[WHT] = lit ? 0.3 * smooth(0.5, 0.75, n) : 0.04; o[RED] = lit ? 0.3 : 0.15; return true; }, Math.max(2, cs), 0.9);
      for (let i = 0; i < 40; i++) {
        const q = [lerp(bb.x0, bb.x1, rand()), lerp(bb.y0, bb.y1, rand())];
        const l = cs * (6 + rand() * 16), a = (side < 0 ? 62 : 118) * D2R + (rand() - 0.5) * 0.4;
        sweep(B, lit ? (rand() < 0.5 ? WHT : RED) : BLK, [q, [q[0] + Math.cos(a) * l * 0.5, q[1] + Math.sin(a) * l * 0.5], [q[0] + Math.cos(a) * l, q[1] + Math.sin(a) * l]], 2.4 * k, 0.55, rand() * 6);
      }
      clipFlush(R, fp);
      contour(R, jag.slice(0, 22), { closed: false, ch: BLK, w: lw * 1.4, a: 0.85, wob: cs * 0.5, passes: 2, flat: true });
      flushAll(R);
    }
    // the prow: a spur of the mountain like the keel of a ship, its edge to the east, up through the circles
    {
      const foot = T[1], topT = T[6];
      const zr = (y) => lerp(foot.c + foot.r + 6, topT.c + topT.r + 4, (y - foot.y) / (ytop - foot.y));
      const yA = foot.y + 2, yB = ytop + 3;
      const ridge = [], lf = [], rf = [];
      for (let j = 0; j <= 10; j++) {
        const y = lerp(yA, yB, j / 10), z = zr(y), wv = 3 + 9 * (j / 10);
        ridge.push(P3(0.5, y, z)); lf.push(P3(-wv, y + 1, z - wv * 1.6)); rf.push(P3(wv, y + 1, z - wv * 1.6));
      }
      const L0 = ridge.concat(lf.slice().reverse()), R0 = ridge.concat(rf.slice().reverse());
      reserve(R, pathOf(L0), 0.9); reserve(R, pathOf(R0), 0.9);
      fillCh(R.cT, WHT, pathOf(L0), 0.75); fillCh(R.cT, RED, pathOf(L0), 0.2);
      fillCh(R.cT, BLK, pathOf(R0), 0.68);
      for (let j = 0; j < 40; j++) { const t = rand(), a = lp(ridge[(t * 10) | 0], lf[(t * 10) | 0], rand()); B.line(rand() < 0.6 ? WHT : RED, 0.6, lw, a[0], a[1], a[0] - cs * 1.5, a[1] + cs * 3); }
      for (let j = 0; j < 30; j++) { const t = rand(), a = lp(ridge[(t * 10) | 0], rf[(t * 10) | 0], rand()); B.line(BLK, 0.7, lw, a[0], a[1], a[0] + cs * 1.5, a[1] + cs * 3); }
      sweep(B, BLK, ridge, lw * 2.2, 0.95);
      sweep(B, WHT, ridge.map((q) => [q[0] - lw * 1.5, q[1]]), lw * 1.4, 0.8);
      flushAll(R);
    }
    // fires in the lower circles
    for (let j = 0; j < 18; j++) {
      const i = (rand() * 2) | 0, th = (rand() * 2 - 1) * T[i].tm * 0.8, rr = T[i].r - 3 - rand() * 5;
      const q = P3(rr * Math.sin(th), T[i].y + T[i].h, T[i].c + rr * Math.cos(th));
      blob(R.cT, RED, q[0], q[1], cs * (4 + rand() * 8), cs * (3 + rand() * 5), 0, 0.4 + rand() * 0.3);
      for (let f = 0; f < 7; f++) { const fx = q[0] + (rand() - 0.5) * 4 * cs; stroke(B, f < 5 ? RED : WHT, fx, q[1], fx + (rand() - 0.3) * cs * 2, q[1] - cs * (3 + rand() * 7), 0.2, lw, 0.85); }
    }
    flushAll(R);
  }

  async function drawSmoke(R, L, sources) {
    const { H } = L, rand = R.rand, k = R.k, B = R.B, N = R.noise;
    const lr = lowres(R, 4);
    for (const s of sources) {
      let x = s.x, y = s.y, r = s.r;
      for (let i = 0; i < 70 && y > -H * 0.1; i++) {
        const n = N.v2(i * 0.3 + s.seed, 1.7) - 0.5;
        blob(lr.x, BLK, x + n * r, y, r * 1.3, r * 0.9, 0, s.a * (0.6 + 0.4 * rand()) * (1 - i / 80));
        if (i < 7) blob(lr.x, RED, x, y + r * 0.3, r * 1.1, r * 0.6, 0, 0.22 * (1 - i / 7));
        y -= r * 0.42; x += s.lean * r * 0.3 * smooth(0, 20, i) + n * r * 0.2; r *= 1.04;
      }
    }
    lr.done();
    await R.tick();
    for (const s of sources) {
      let x = s.x, y = s.y, r = s.r;
      for (let i = 0; i < 30 && y > 0; i++) {
        if (rand() < 0.6 && y > L.hy - (L.hy * 0.45)) {
          const a0 = Math.PI * (0.9 + rand() * 0.5), sweep = 0.9 + rand() * 1.1;
          const pts = []; for (let j = 0; j <= 12; j++) { const a = a0 + sweep * j / 12; pts.push([x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.55]); }
          B.poly(BLK, 0.18 + rand() * 0.22, 2 * k, pts);
          if (i < 5) B.poly(RED, 0.4, 2 * k, pts.slice(0, 6).map((p) => [p[0], p[1] + r * 0.2]));
        }
        const st = 2.2;
        y -= r * 0.42 * st; x += s.lean * r * 0.3 * st * smooth(0, 10, i); r *= 1.09;
      }
    }
    flushAll(R);
  }

  async function drawGround(R, L) {
    const { W, H, hy } = L, rand = R.rand, k = R.k, B = R.B, N = R.noise;
    const lr = lowres(R, 6);
    for (let y = hy; y < H * 1.05; y += H * 0.018) {
      for (let x = -W * 0.05; x < W * 1.05; x += H * 0.032) {
        const d = (y - hy) / (H - hy);
        const right = smooth(L.xT, W, x);
        const nn = N.fbm(x / (H * 0.12), y / (H * 0.04), 3);
        blob(lr.x, RED, x, y, H * 0.06, H * 0.02, 0, 0.07 + 0.09 * d);
        blob(lr.x, BLK, x, y, H * 0.06, H * 0.02, 0, (0.03 + 0.12 * right * (1 - d * 0.4) + 0.08 * d) * (0.5 + nn));
      }
    }
    for (let i = 0; i < 70; i++) {
      const y = lerp(hy, L.yT + (H - L.yT) * 0.3, Math.pow(rand(), 1.4));
      const xf = riderFront(L, y);
      const x = xf - rand() * W * 0.5;
      const r = (y - hy) * (0.4 + rand() * 0.6) + H * 0.008;
      blob(lr.x, WHT, x, y - r * 0.25, r * 1.6, r * 0.42, 0, 0.06 + rand() * 0.06);
      blob(lr.x, RED, x, y, r * 1.3, r * 0.35, 0, 0.06);
    }
    lr.done();
    await R.tick();
    for (let y = hy + 1; y < H; ) {
      const d = (y - hy) / (H - hy);
      const len = (10 + 90 * d) * k;
      for (let x = rand() * len; x < W; x += len * (1 + rand() * 1.2)) {
        const n = N.fbm(x / (H * 0.08), y / (H * 0.03), 3);
        if (rand() < 0.35) continue;
        const ch = n > 0.56 ? BLK : RED;
        const a = (0.2 + 0.5 * n) * (0.6 + 0.6 * d);
        stroke(B, ch, x, y, x + len, y + (rand() - 0.5) * len * 0.05, (rand() - 0.5) * 0.04, (1.6 + 1.8 * d) * k, a);
      }
      y += Math.max(2 * k, (y - hy) * 0.032) * (0.7 + rand() * 0.6);
      if (B.n > 4000) { flushAll(R); await R.tick(); }
    }
    for (let i = 0; i < 700; i++) {
      const y = lerp(L.yT - (L.yT - hy) * 0.3, H, Math.sqrt(rand())), d = (y - hy) / (H - hy);
      const x = rand() * W;
      const l = (4 + rand() * 12) * d * 2.2 * k;
      const a = -Math.PI / 2 + (rand() - 0.5) * 0.9;
      stroke(B, rand() < 0.5 ? BLK : RED, x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, 0.15, (1.2 + d) * k, 0.4 + rand() * 0.3);
    }
    flushAll(R);
  }

  /* the litter of the night's battle on the plain ahead of the charge */
  function drawDebris(R, L) {
    const { W, H, hy } = L, rand = R.rand, k = R.k, B = R.B;
    for (let i = 0; i < 34; i++) {
      const y = lerp(hy + (L.yT - hy) * 0.5, L.yT + (H - L.yT) * 0.8, Math.pow(rand(), 0.9));
      const x0 = riderFront(L, y) + (y - hy) * 0.9;
      if (x0 > W) continue;
      const x = lerp(x0, W, rand()), h = (y - hy) / L.camK * 0.7;
      const s = h / 100, cw = clamp(s * 0.9, 1.2, 3) * k;
      const kind = rand();
      if (kind < 0.12) {
        blob(R.cT, BLK, x, y, 40 * s, 4 * s, 0, 0.3);
      } else if (kind < 0.66) {
        const a = (rand() - 0.5) * 0.5, l = (60 + rand() * 100) * s;
        B.line(BLK, 0.8, Math.max(1.1 * k, 1.5 * s), x, y, x + Math.cos(a) * l, y + Math.sin(a) * l * 0.3);
        if (rand() < 0.5) B.line(WHT, 0.7, Math.max(1.1 * k, 1.5 * s), x + Math.cos(a) * l, y + Math.sin(a) * l * 0.3, x + Math.cos(a) * (l + 10 * s), y + Math.sin(a) * (l + 10 * s) * 0.3);
      } else if (kind < 0.88) {
        const se = new Path2D(); se.ellipse(x, y - 2 * s, 9 * s, 3.5 * s, (rand() - 0.5) * 0.3, 0, TAU);
        reserve(R, se, 0.8); fillCh(R.cT, BLK, se, 0.5); fillCh(R.cS, BLK, se, 0.5);
        B.poly(WHT, 0.6, cw, ellipsePts(x, y - 2 * s, 9 * s, 3.5 * s, 0, 8, Math.PI * 0.9, Math.PI * 1.6));
        blob(R.cT, RED, x + 1.5 * s, y - 2 * s, 2 * s, 1 * s, 0, 0.7);
      } else {
        // a fire still smouldering in the grass
        blob(R.cT, RED, x, y - 4 * s, 30 * s, 8 * s, 0, 0.5);
        for (let j = 0; j < 8; j++) stroke(B, j < 6 ? RED : WHT, x + (rand() - 0.5) * 30 * s, y, x + (rand() - 0.5) * 30 * s, y - (10 + rand() * 20) * s, 0.2, cw, 0.8);
      }
    }
    flushAll(R);
  }

  /* a burning engine of war on the right, a dark frame for the charge to run into */
  function drawEngine(R, L, gx, gy) {
    const { hy } = L, rand = R.rand, k = R.k, B = R.B;
    const hh = (gy - hy) / L.camK, s = hh / 100 * 0.8;
    const P = (x, y) => [gx + x * s, gy + y * s];
    const beams = [
      [P(-90, 0), P(70, 0), 9], [P(-80, -12), P(60, -12), 7], [P(-60, -12), P(-20, -150), 8], [P(20, -12), P(-16, -150), 8],
      [P(-24, -146), P(-14, -146), 10], [P(-125, -205), P(40, -60), 7], [P(-50, -12), P(-40, -70), 5], [P(30, -60), P(60, -12), 5],
    ];
    const u = new Path2D();
    const polys = beams.map(([a, b, w]) => limb([a, b], [w * s / 2, w * s / 2]));
    for (const p of polys) addPoly(u, p);
    const box = [P(28, -70), P(62, -70), P(64, -30), P(26, -30)];
    addPoly(u, box);
    reserve(R, u, 0.85);
    blob(R.cT, RED, gx - 20 * s, gy - 40 * s, 140 * s, 90 * s, 0, 0.55);
    blob(R.cT, WHT, gx - 30 * s, gy - 20 * s, 50 * s, 30 * s, 0, 0.35);
    for (let i = 0; i < 90; i++) {
      const x = gx + (rand() - 0.6) * 160 * s, y = gy - rand() * 30 * s;
      const l = (20 + rand() * 70) * s;
      stroke(B, rand() < 0.75 ? RED : WHT, x, y, x + (rand() - 0.5) * 20 * s, y - l, (rand() - 0.5) * 0.4, (2 + rand() * 2) * k, 0.5 + rand() * 0.4);
    }
    flushAll(R);
    fillCh(R.cT, BLK, u, 0.6);
    for (const p of polys) contour(R, p, { ch: BLK, w: 2.6 * k, a: 0.9, wob: 1.5 * k, passes: 2, rim: 0.3 });
    contour(R, box, { ch: BLK, w: 2.6 * k, a: 0.9, wob: 1.5 * k, passes: 2 });
    for (const wx of [-60, 40]) {
      const c = P(wx, -6), r = 16 * s;
      const ring = ellipsePts(c[0], c[1], r * 0.45, r, 0, 24);
      const rp = pathOf(ring); reserve(R, rp, 0.8); fillCh(R.cT, BLK, rp, 0.55);
      contour(R, ring, { ch: BLK, w: 2.6 * k, a: 0.9, wob: 1 * k, passes: 2 });
      for (let j = 0; j < 4; j++) { const a = j * Math.PI / 4; B.line(BLK, 0.8, 2 * k, c[0] - Math.cos(a) * r * 0.45, c[1] - Math.sin(a) * r, c[0] + Math.cos(a) * r * 0.45, c[1] + Math.sin(a) * r); }
      B.poly(RED, 0.6, 2.2 * k, ellipsePts(c[0], c[1], r * 0.45, r, 0, 8, -1.2, 1.2));
    }
    B.quad(BLK, 0.6, 1.6 * k, ...P(-125, -205), ...P(-145, -140), ...P(-130, -95));
    B.line(BLK, 0.5, 1.4 * k, ...P(-20, -150), ...P(-125, -205));
    for (const [a, b] of beams) B.line(RED, 0.55, 2 * k, a[0] - 3 * k, a[1] + 2 * k, b[0] - 3 * k, b[1] + 2 * k);
    flushAll(R);
    return { x: gx - 10 * s, y: gy - 80 * s, r: 30 * s };
  }

  async function drawHorde(R, L) {
    const { W, H, hy } = L, rand = R.rand, k = R.k, B = R.B;
    const C = L.city;
    const maxY = hy + (L.yT - hy) * 0.44;
    const N = R.noise;
    const lr = lowres(R, 5);
    for (let y = hy; y < maxY; y += H * 0.004) {
      const x0 = hordeFront(L, y);
      const hh = (y - hy) / L.camK;
      for (let x = x0; x < W * 1.05; x += H * 0.012) blob(lr.x, BLK, x + rand() * H * 0.01, y - hh * 0.4, hh * 1.6 + H * 0.006, hh * 0.5 + H * 0.003, 0, (0.08 * smooth(hy + (maxY - hy) * 0.6, hy, y) + 0.015) * (0.4 + N.fbm(x / (H * 0.05), y / (H * 0.01), 2)));
    }
    for (let i = 0; i < 12; i++) {
      const y = lerp(hy + H * 0.002, maxY, rand()), x = lerp(hordeFront(L, y), W, rand());
      blob(lr.x, RED, x, y, (y - hy) * 2 + H * 0.02, (y - hy) * 0.2 + H * 0.003, 0, 0.5);
    }
    lr.done();
    await R.tick();
    for (let i = 0; i < 4; i++) {
      const u = [-62, -30, 34, 70][i] + (rand() - 0.5) * 8, x = C.cx + u * C.cs, yb = C.cb + C.cs * 3;
      const h = C.cs * (20 + rand() * 6), w0 = C.cs * 6, w1 = C.cs * 4.2;
      const tw = [[x - w0 / 2, yb], [x - w1 / 2, yb - h], [x + w1 / 2, yb - h], [x + w0 / 2, yb]];
      const p = pathOf(tw);
      reserve(R, p, 0.85);
      fillCh(R.cT, BLK, p, 0.7);
      for (let j = 1; j < 7; j++) { const yy = yb - h * j / 7; B.line(BLK, 0.85, 1.6 * k, x - w0 / 2, yy, x + w0 / 2, yy); }
      B.line(WHT, 0.45, 1.4 * k, x - w0 / 2, yb, x - w1 / 2, yb - h);
      blob(R.cT, RED, x, yb - h, C.cs * 5, C.cs * 4, 0, 0.6);
      for (let f = 0; f < 5; f++) stroke(B, f < 3 ? RED : WHT, x + (rand() - 0.5) * w1, yb - h, x + (rand() - 0.2) * w1, yb - h - C.cs * (3 + rand() * 4), 0.2, 1.8 * k, 0.85);
    }
    flushAll(R);
    let y = hy + H * 0.0015;
    let nOrc = 0;
    while (y < maxY) {
      const hh = (y - hy) / L.camK;
      const x0 = hordeFront(L, y) + (rand() - 0.3) * hh * 2;
      const spx = Math.max(1.8 * k, hh * 0.34);
      const near = (y - hy) / (maxY - hy);
      for (let x = x0; x < W + 10; x += spx * (0.6 + rand() * 0.8)) {
        const yy = y + (rand() - 0.5) * hh * 0.1;
        const h = (yy - hy) / L.camK;
        const cl = N.fbm(x / (H * 0.06), yy / (H * 0.02), 3);
        const depth = hy + (maxY - hy) * (0.45 + 0.75 * N.fbm(x / (W * 0.12), 4.4, 3));
        if (yy > depth || cl < 0.36 + 0.1 * near || (near > 0.5 && rand() < 0.35)) continue;
        if (h < 3 * k) {
          B.line(BLK, 0.65, Math.max(1.1 * k, h * 0.5), x, yy, x, yy - h * 0.8);
          if (rand() < 0.5) B.line(BLK, 0.55, 1 * k, x, yy - h * 0.5, x - h * 0.3 + rand() * h * 0.6, yy - h * 2.6);
          else if (rand() < 0.15) B.line(WHT, 0.6, 1.1 * k, x, yy - h * 1.6, x, yy - h * 2.2);
          continue;
        }
        if (h > 16 * k) {
          const dist = x - hordeFront(L, yy);
          const pose = dist < h * 3 && rand() < 0.6 ? 'brace' : (dist < h * 6 && rand() < 0.15 ? 'flee' : 'stand');
          flushAll(R);
          drawOrc(R, x, yy, h * (rand() < 0.05 ? 1.6 : 0.85 + rand() * 0.3), { pose, face: pose === 'flee' ? 1 : -1, dark: near, flag: pose === 'stand' && rand() < 0.12 });
          nOrc++;
          if (nOrc % 8 === 0) await R.tick();
          continue;
        }
        const lean = (rand() - 0.5) * 0.3;
        const w = Math.max(1.1 * k, h * 0.32);
        B.line(BLK, 0.88, w, x, yy - h * 0.05, x + lean * h, yy - h * 0.6);
        B.line(BLK, 0.9, w * 0.9, x + lean * h, yy - h * 0.62, x + lean * h + h * 0.06, yy - h * 0.82);
        if (rand() < 0.6) {
          const pa = (x - hordeFront(L, yy) < h * 6 ? -150 + rand() * 30 : -120 + rand() * 60) * D2R;
          B.line(BLK, 0.85, Math.max(0.9 * k, w * 0.22), x - Math.cos(pa) * h * 0.6, yy - h * 0.3 - Math.sin(pa) * h * 0.6, x + Math.cos(pa) * h * 2.2, yy - h * 0.3 + Math.sin(pa) * h * 2.2);
          if (rand() < 0.3) B.line(WHT, 0.6, Math.max(1 * k, w * 0.3), x + Math.cos(pa) * h * 2.2, yy - h * 0.3 + Math.sin(pa) * h * 2.2, x + Math.cos(pa) * h * 2.5, yy - h * 0.3 + Math.sin(pa) * h * 2.5);
        }
        if (h > 6 * k && rand() < 0.4) blob(R.cT, BLK, x - h * 0.12, yy - h * 0.4, h * 0.2, h * 0.24, 0, 0.6);
        if (rand() < 0.3) B.line(RED, 0.55, w * 0.5, x + lean * h + h * 0.1, yy - h * 0.5, x + lean * h + h * 0.12, yy - h * 0.2);
        if (rand() < 0.25) B.line(WHT, 0.5, w * 0.4, x + lean * h - h * 0.08, yy - h * 0.84, x + lean * h, yy - h * 0.88);
      }
      if (rand() < 0.3) {
        const bx = x0 + rand() * (W - x0), bh = hh * 2.1;
        B.line(BLK, 0.9, Math.max(1.2 * k, hh * 0.06), bx, y, bx, y - bh);
        const fl = [[bx, y - bh], [bx - hh * 0.8, y - bh + hh * 0.15], [bx - hh * 0.55, y - bh + hh * 0.3], [bx - hh * 0.75, y - bh + hh * 0.5], [bx, y - bh + hh * 0.48]];
        const red = rand() < 0.3;
        fillCh(R.cT, red ? RED : BLK, pathOf(fl), 0.75);
        if (red && hh > 6 * k) blob(R.cT, BLK, bx - hh * 0.6, y - bh + hh * 0.45, hh * 0.25, hh * 0.18, 0, 0.9);
        else if (hh > 6 * k) blob(R.cT, RED, bx - hh * 0.6, y - bh + hh * 0.45, hh * 0.18, hh * 0.13, 0, 0.9);
      }
      y += Math.max(1.3 * k, hh * 0.17);
      if (B.n > 5000) { flushAll(R); await R.tick(); }
    }
    flushAll(R);
    // the near flank of the host, already breaking before the charge
    const flank = [];
    for (let i = 0; i < 16; i++) {
      const yy = lerp(maxY, L.yT - (L.yT - hy) * 0.08, Math.pow(rand(), 0.8));
      const x0 = hordeFront(L, yy) + (yy - hy) * 0.8;
      const xx = lerp(x0, W * 1.02, Math.pow(rand(), 0.7));
      flank.push({ x: xx, y: yy, d: (xx - x0) / Math.max(1, W - x0) });
    }
    flank.sort((a, b) => a.y - b.y);
    for (const q of flank) {
      const h = (q.y - hy) / L.camK * (0.9 + rand() * 0.2);
      const pose = q.d < 0.3 ? (rand() < 0.7 ? 'brace' : 'stand') : (rand() < 0.55 ? 'flee' : 'stand');
      longShadow(R, q.x, q.y, h * 0.8, 0.3);
      drawOrc(R, q.x, q.y, h, { pose, face: pose === 'flee' ? 1 : -1, dark: 0.6, flag: pose === 'stand' && rand() < 0.3 });
      await R.tick();
    }
  }

  /* ========================================================= the army */
  function makeArmy(R, L) {
    const rand = R.rand, out = [];
    let z = 0.0028;
    const yMax = L.H * 1.35;
    while (true) {
      const y = L.hy + z * L.H;
      if (y > yMax) break;
      const hh = (y - L.hy) / L.camK;
      const xf = riderFront(L, y);
      const big = hh > L.hhT * 0.42;
      const sp = hh * (big ? 1.6 : 1.12);
      let x = xf - rand() * hh * 0.5;
      while (x > -hh * 2) {
        const yy = y + (rand() - 0.5) * (y - L.hy) * 0.1;
        const h = (yy - L.hy) / L.camK;
        const nearKing = Math.abs(yy - L.yT) < L.hhT * 0.3 && x > L.xT - L.hhT * 1.7;
        const tooBig = h > L.hhT * 0.7 && x > L.xT - L.hhT * 1.3;
        const offscreen = x - h * 1.5 > L.W || x + h * 2.5 < 0 || yy - h * 1.9 > L.H;
        if (!nearKing && !tooBig && !offscreen) out.push({ x, y: yy, hh: h, sp: (rand() - 0.5) });
        x -= sp * (0.7 + rand() * 0.65);
      }
      z *= (big ? 1.2 : 1.1) + rand() * 0.03;
    }
    out.push({ x: L.xT, y: L.yT, hh: L.hhT, king: true });
    const by = L.yT - L.hhT * 0.2;
    out.push({ x: L.xT - L.hhT * 1.3, y: by, hh: (by - L.hy) / L.camK, banner: true });
    out.sort((a, b) => a.y - b.y);
    return out;
  }

  function riderParams(rand, rd) {
    const coats = ['bay', 'bay', 'bay', 'chestnut', 'chestnut', 'grey', 'black', 'dun', 'bay'];
    const ro = {
      phase: [0.1, 0.14, 0.18, 0.22, 0.26, 0.62, 0.66, 0.7, 0.74, 0.92][(rand() * 10) | 0] + rand() * 0.03, pitch: (rand() - 0.5) * 6, stride: 0.95 + rand() * 0.12,
      neck: 14 + rand() * 18, head: 32 + rand() * 14, neckLen: 46 + rand() * 6, arch: rand() * 4,
      tailLift: 0.15 + rand() * 0.35, mane: 16 + rand() * 14,
      coat: coats[(rand() * coats.length) | 0],
      lean: 26 + rand() * 24, seat: (rand() - 0.5) * 4,
      spearAng: 1 + rand() * 9, spearLen: 105 + rand() * 30, pennon: rand() < 0.25, pennonCh: rand() < 0.75 ? RED : BLK,
      shieldCh: rand() < 0.5 ? RED : BLK, cloak: rand() < 0.7 ? 0 : 22 + rand() * 22, backShield: rand() < 0.25, cloakCh: rand() < 0.65 ? RED : BLK, cloakWave: rand() * 6,
      plume: rand() < 0.4 ? 0 : 12 + rand() * 12, plumeCh: rand() < 0.25 ? WHT : rand() < 0.5 ? RED : BLK, hairCh: rand() < 0.6 ? RED : WHT,
      clothCh: rand() < 0.55 ? RED : BLK,
    };
    if (rand() < 0.12) { ro.spearAng = -50 + rand() * 25; ro.spearLen = 90; }
    if (rand() < 0.04) ro.horn = true;
    if (rd.king) {
      Object.assign(ro, { phase: 0.15, pitch: -4, stride: 1.06, neck: 22, head: 34, neckLen: 50, arch: 4, tailLift: 0.45, mane: 34, coat: 'grey', lean: 18, seat: 0,
        sword: true, gold: true, shieldBig: true, backShield: false, cloak: 50, cloakCh: BLK, cloakWave: 1.2, plume: 36, plumeCh: WHT, hairCh: WHT, clothCh: RED, pennon: false, horn: false });
    }
    if (rd.banner) Object.assign(ro, { backShield: false, banner: true, coat: 'bay', phase: 0.62, cloak: 0, lean: 12, spearLen: 0, horn: false });
    return ro;
  }

  function drawBanner(R, hs, g) {
    const B = R.B, s = hs.s, k = R.k;
    const a = g.pole.a, b = g.pole.b;
    stroke(B, BLK, a[0], a[1], b[0], b[1], 0.003, 1.8 * s * k, 0.95);
    B.line(WHT, 0.5, 0.8 * s * k, a[0] - s, a[1], b[0] - s, b[1]);
    const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); const u = [d[0] / l, d[1] / l];
    const top = [b[0] - u[0] * 3 * s, b[1] - u[1] * 3 * s];
    const hgt = 48 * s, len = 96 * s;
    const pts = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([top[0] - len * t, top[1] + Math.sin(t * 7 + 0.5) * 9 * s * t + t * 12 * s]); }
    for (let i = 14; i >= 0; i--) { const t = i / 14; pts.push([top[0] - len * t * 0.9, top[1] + hgt * (1 - 0.2 * t) + Math.sin(t * 7 + 1.2) * 11 * s * t + t * 12 * s]); }
    const cloth = spline(pts, true, 3);
    const cp = pathOf(cloth);
    reserve(R, cp, 0.92);
    fillCh(R.cT, BLK, cp, 0.26);
    fillCh(R.cT, RED, cp, 0.08);
    const bb = bbox(cloth, 1);
    const bfold = (x, y) => { const t = (top[0] - x) / len; return Math.sin(t * 9 + 0.5 + (y - top[1]) / hgt * 0.8) * 0.65 + Math.sin(t * 4 - 1) * 0.35; };
    hatch(R, { ...bb, ang: 60 * D2R, sp: 3.2 * k, len: 16 * k, w: 2.2 * k, chs: [BLK, WHT, RED], st: 0.3, fn: (x, y, o) => { const f = bfold(x, y); o[BLK] = 0.3 + 0.5 * smooth(0.6, -0.6, f); o[WHT] = 0.55 * smooth(0.35, 0.9, f); o[RED] = 0.2; return true; } });
    for (let i = 0; i < 9; i++) { const t = (i + 0.5) / 9, x0 = top[0] - len * t; B.poly(BLK, 0.45, 1.8 * k, [[x0, top[1] + 12 * s * t + 4 * s], [x0 - 6 * s, top[1] + hgt * 0.5 + 12 * s * t], [x0 - 3 * s, top[1] + hgt * 0.95 + 10 * s * t]]); }
    clipFlush(R, cp);
    contour(R, cloth, { ch: BLK, w: 2.4 * k, a: 0.85, wob: 1.5 * k, passes: 2 });
    const hx = top[0] - len * 0.52, hy2 = top[1] + hgt * 0.8 + 6 * s;
    const em = buildHorse({ phase: 0.18, pitch: -14, stride: 1.15, neck: 48, head: 30, neckLen: 50, arch: 4, tailLift: 0.5, mane: 18 }, hx + 4 * s, hy2 + 2 * s, s * 0.4);
    const ep = horseUnion(em);
    flushAll(R);
    R.cT.save(); R.cT.clip(cp); fillCh(R.cT, WHT, ep, 0.85); R.cT.restore();
    R.cS.save(); R.cS.clip(cp);
    contour(R, em.body, { ch: WHT, w: 1.6 * k, a: 0.85, wob: 0.5 * k, passes: 1, flat: true });
    for (const id in em.legs) contour(R, em.legs[id].poly, { ch: WHT, w: 1.4 * k, a: 0.8, wob: 0.4 * k, passes: 1, flat: true });
    { const t = em.dock; for (let i = 0; i < 6; i++) R.B.quad(WHT, 0.8, 1.6 * k, t[0], t[1], t[0] - 14 * s * 0.4, t[1] - 10 * s * 0.4, t[0] - (22 + i * 3) * s * 0.4, t[1] + (i - 2) * 2 * s * 0.4); }
    R.B.flush(); R.cS.restore();
    flushAll(R);
  }

  /* the low sun throws each rider's shadow far ahead of him across the plain */
  function longShadow(R, x, y, hh, a) {
    if (a < 0.02) return;
    const c = R.cT;
    const pts = [[x - hh * 0.5, y - hh * 0.01], [x + hh * 0.45, y - hh * 0.035], [x + hh * 3.1, y + hh * 0.09], [x + hh * 2.9, y + hh * 0.17], [x + hh * 1.4, y + hh * 0.12]];
    const g = c.createLinearGradient(x, y, x + hh * 3.1, y + hh * 0.12);
    g.addColorStop(0, 'rgba(0,255,0,' + a.toFixed(3) + ')'); g.addColorStop(0.5, 'rgba(0,255,0,' + (a * 0.6).toFixed(3) + ')'); g.addColorStop(1, 'rgba(0,255,0,0)');
    c.fillStyle = g; c.fill(pathOf(spline(pts, true, 3)));
  }

  function dustVeil(R, L, y) {
    const rand = R.rand, c = R.cT;
    const d = y - L.hy, hh = d / L.camK;
    const f = clamp(d / (L.yT - L.hy), 0, 1);
    const x1 = riderFront(L, y) + hh * 0.6;
    for (let x = -hh * 2; x < x1; x += hh * (1.2 + rand())) {
      const yy = y - hh * (0.15 + rand() * 0.5);
      blob(c, WHT, x, yy, hh * (2.2 + rand() * 2), hh * (0.6 + rand() * 0.6), 0, (0.09 + 0.09 * rand()) * (1 - f * 0.7));
      if (rand() < 0.5) blob(c, RED, x, y - hh * 0.2, hh * 2.5, hh * 0.5, 0, 0.06);
    }
  }

  async function drawArmy(R, L, army) {
    const k = R.k;
    const FULL = 170 * k, DET = 46 * k, MID = 11 * k;
    let nD = 0, nM = 0, nF = 0;
    const only = R.only;
    let nextVeil = L.hy + (L.yT - L.hy) * 0.04;
    for (const rd of army) {
      if (rd.y > nextVeil && rd.y < L.yT + L.hhT * 0.3) {
        flushAll(R);
        dustVeil(R, L, nextVeil);
        nextVeil = L.hy + (nextVeil - L.hy) * 1.32;
        await R.tick();
      }
      if (only && !(only === 'king' ? rd.king : rd.hh > L.hhT * 0.5)) continue;
      rd.fog = smooth(L.hhT * 0.8, 4 * k, rd.hh) * 0.85;
      if (rd.hh < MID && !rd.king) { if (rd.hh > 4 * k) longShadow(R, rd.x, rd.y, rd.hh, 0.25 * (1 - rd.fog)); drawRiderFar(R, rd); nF++; if (R.B.n > 6000) { flushAll(R); await R.tick(); } continue; }
      flushAll(R);
      const ro = riderParams(R.rand, rd);
      ro.vp = L.vp;
      const s = rd.hh / 100;
      const hs = buildHorse(ro, rd.x, rd.y, s);
      rd.hs = hs; rd.ro = ro;
      hs.ao = smooth(L.yT + L.hhT * 0.1, L.H * 1.1, rd.y) * 0.35;
      longShadow(R, rd.x, rd.y, rd.hh, 0.34 * (1 - rd.fog));
      if (rd.hh < DET && !rd.king && !rd.banner) { drawRiderMid(R, rd); nM++; await R.checkpoint(); continue; }
      nD++;
      await drawRiderFull(R, rd, hs, ro, rd.hh > FULL || rd.king);
      await R.checkpoint();
    }
    return { nD, nM, nF };
  }

  async function drawRiderFull(R, rd, hs, ro, detail) {
    const k = R.k, s = hs.s;
    const g = riderGeom(hs, ro);
    reserve(R, horseUnion(hs), 0.92);
    reserve(R, riderUnion(g), 0.92);
    if (ro.banner) drawBanner(R, hs, g);
    drawLeg(R, hs, hs.legs.LH, ro.coat, true, detail);
    drawLeg(R, hs, hs.legs.LF, ro.coat, true, detail);
    drawTail(R, hs, ro.coat, detail);
    reserve(R, pathOf(hs.body), 0.9);
    drawHorseBody(R, hs, ro.coat, detail);
    await R.tick();
    if (detail) {
      const alt = buildHorse({ ...ro, phase: ro.phase + 0.04 + R.rand() * 0.04 }, rd.x, rd.y, s);
      for (const id of ['RF', 'RH']) contour(R, alt.legs[id].poly, { ch: RED, w: clamp(s * 0.45, 1.2, 2.4) * k, a: 0.3, wob: s * 0.5, passes: 1 });
      flushAll(R);
    }
    reserveLegs(R, hs);
    drawLeg(R, hs, hs.legs.RH, ro.coat, false, detail);
    drawLeg(R, hs, hs.legs.RF, ro.coat, false, detail);
    drawMane(R, hs, ro.coat, detail);
    drawTack(R, hs, ro, detail);
    drawRider(R, hs, g, ro, detail);
    hoofDust(R, hs, detail);
  }

  /* dust and clods kicked up by the hooves that are on the ground or just leaving it */
  function hoofDust(R, hs, detail) {
    const rand = R.rand, s = hs.s, k = R.k, B = R.B;
    for (const id in hs.legs) {
      const L = hs.legs[id];
      if (L.p > 0.42) continue;
      const h = L.chainS[3];
      const a = L.p < 0.3 ? 0.18 : 0.1;
      blob(R.cT, WHT, h[0] - 10 * s, h[1] - 4 * s, 26 * s, 9 * s, 0, a);
      blob(R.cT, RED, h[0] - 14 * s, h[1] - 2 * s, 20 * s, 6 * s, 0, a * 0.8);
      if (detail) for (let i = 0; i < 8; i++) {
        const x = h[0] - rand() * 30 * s, y = h[1] - rand() * 14 * s;
        B.line(rand() < 0.5 ? RED : BLK, 0.6, (1 + rand() * 1.5) * k, x, y, x - 2 * s, y + s);
      }
    }
    flushAll(R);
  }

  /* =========================================================== compositing */
  function makeComposer(R, tooth) {
    const N = R.noise, k = R.k, W = R.W, H = R.H;
    const MW = Math.ceil(W / 16) + 2, MH = Math.ceil(H / 16) + 2;
    const mott = new Float32Array(MW * MH);
    for (let j = 0; j < MH; j++) for (let i = 0; i < MW; i++) mott[j * MW + i] = N.fbm(i * 0.06, j * 0.06, 4) - 0.5 + (N.v2(i * 0.5 + 40, j * 0.5) - 0.5) * 0.3;
    const laidP = 4.6 * k, chainP = 118 * k, chainOff = R.rand() * chainP;
    const edge = 26 * k;
    const PR = 196, PG = 177, PB = 144;
    return function rows(S, T, D, w, y0, bh, sc) {
      for (let yy = 0; yy < bh; yy++) {
        const y = y0 + yy, fy = y * sc;
        const laid = 0.06 * Math.cos((fy / laidP) * TAU);
        const my = fy / 16, mj = my | 0, mfy = my - mj;
        const row = ((y & 1023) << 10);
        for (let x = 0; x < w; x++) {
          const i = (yy * w + x) * 4, fx = x * sc;
          let g = tooth[row | (x & 1023)] / 255 + laid;
          const cd = Math.abs(((fx + chainOff) % chainP) - chainP / 2);
          if (cd < 2.4 * k) g += 0.05;
          const mx = fx / 16, mi = mx | 0, mfx = mx - mi;
          const m0 = mott[mj * MW + mi], m1 = mott[mj * MW + mi + 1], m2 = mott[(mj + 1) * MW + mi], m3 = mott[(mj + 1) * MW + mi + 1];
          const m = m0 + (m1 - m0) * mfx + (m2 - m0) * mfy + (m0 - m1 - m2 + m3) * mfx * mfy;
          let r = PR * (1 + m * 0.07), gg = PG * (1 + m * 0.075), b = PB * (1 + m * 0.1);
          const qr = S[i] / 255, qk = S[i + 1] / 255, qw = S[i + 2] / 255;
          const sr = T[i] / 255, sk = T[i + 1] / 255, sw = T[i + 2] / 255;
          const gm = 0.78 + 0.34 * g;
          let dr = (qr * 1.25 - (1 - g)) * 2.7; dr = dr < 0 ? 0 : dr > 1 ? 1 : dr; dr *= 0.6 + 0.4 * Math.min(1, qr * 1.5);
          const cR = 1 - (1 - dr) * (1 - Math.min(1, sr * gm));
          let dk = (qk * 1.25 - (1 - g)) * 2.7; dk = dk < 0 ? 0 : dk > 1 ? 1 : dk; dk *= 0.6 + 0.4 * Math.min(1, qk * 1.5);
          const cK = 1 - (1 - dk) * (1 - Math.min(1, sk * gm));
          let dw = (qw * 1.25 - (1 - g)) * 2.7; dw = dw < 0 ? 0 : dw > 1 ? 1 : dw; dw *= 0.6 + 0.4 * Math.min(1, qw * 1.5);
          const cW = 1 - (1 - dw) * (1 - Math.min(1, sw * gm));
          if (cR > 0.002) {
            const t = cR * cR, rr = 184 - 66 * t, rg = 88 - 48 * t, rb = 56 - 30 * t, a = cR * 0.94;
            r += (rr - r) * a; gg += (rg - gg) * a; b += (rb - b) * a;
          }
          if (cK > 0.002) { const a = cK * 0.95; r += (30 - r) * a; gg += (25 - gg) * a; b += (23 - b) * a; }
          if (cW > 0.002) { const a = cW * 0.93; r += (249 - r) * a; gg += (244 - gg) * a; b += (231 - b) * a; }
          const ed = Math.min(fx, fy, W - 1 - fx, H - 1 - fy);
          let alpha = 255;
          if (ed < edge * 3) {
            const tone = smooth(edge * 3, 0, ed) * 0.14;
            r *= 1 - tone * 0.6; gg *= 1 - tone * 0.8; b *= 1 - tone;
            const en = N.v2(fx * 0.045 + fy * 0.045, (fx < fy ? 3.1 : 7.7)) * edge * 0.9 + N.v2(fx * 0.3 + fy * 0.3, 1.1) * edge * 0.25;
            alpha = 255 * smooth(en * 0.4, en * 0.4 + 2.5 * sc, ed);
          }
          D[i] = r; D[i + 1] = gg; D[i + 2] = b; D[i + 3] = alpha;
        }
      }
    };
  }

  async function composite(R, comp) {
    const { W, H } = R;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const co = out.getContext('2d', { willReadFrequently: true });
    const band = 48;
    for (let y0 = 0; y0 < H; y0 += band) {
      const bh = Math.min(band, H - y0);
      const S = R.cS.getImageData(0, y0, W, bh).data, T = R.cT.getImageData(0, y0, W, bh).data;
      const img = co.createImageData(W, bh);
      comp(S, T, img.data, W, y0, bh, 1);
      co.putImageData(img, 0, y0);
      await R.tick();
    }
    return out;
  }

  /* a quick look at the sheet while it is being drawn, at screen resolution */
  function previewer(R, comp, pw) {
    const sc = R.W / pw, ph = Math.round(R.H / sc);
    const a = document.createElement('canvas'); a.width = pw; a.height = ph;
    const b = document.createElement('canvas'); b.width = pw; b.height = ph;
    const ca = a.getContext('2d', { willReadFrequently: true }), cb = b.getContext('2d', { willReadFrequently: true });
    const out = document.createElement('canvas'); out.width = pw; out.height = ph;
    const co = out.getContext('2d');
    return function () {
      ca.drawImage(R.S, 0, 0, pw, ph); cb.drawImage(R.T, 0, 0, pw, ph);
      const S = ca.getImageData(0, 0, pw, ph).data, T = cb.getImageData(0, 0, pw, ph).data;
      const img = co.createImageData(pw, ph);
      comp(S, T, img.data, pw, 0, ph, sc);
      co.putImageData(img, 0, 0);
      return out;
    };
  }

  /* ============================================================ render */
  const yieldNow = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });

  async function renderSheet(W, H, seed, ok, log, onPreview, previewW) {
    const rand = mulberry32(seed ^ 0x5eed0003);
    const noise = makeNoise(mulberry32(seed ^ 0xa11ce));
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'lighter'; return [c, x]; };
    const [S, cS] = mk(), [T, cT] = mk();
    const L = makeLayout(W, H);
    let tSlice = performance.now(), tPrev = performance.now();
    const R = {
      W, H, k: L.k, S, T, cS, cT, rand, noise,
      B: new Batch(cS), BT: new Batch(cT), only: new URLSearchParams(location.search).get('rohonly'),
      async tick() {
        if (performance.now() - tSlice > 40) { await yieldNow(); tSlice = performance.now(); }
        if (!ok()) throw new Error('cancelled');
      },
      async checkpoint() {
        await R.tick();
        if (onPreview && performance.now() - tPrev > 1600) { flushAll(R); onPreview(R.preview()); tPrev = performance.now(); await yieldNow(); tSlice = performance.now(); }
      },
    };
    const times = [];
    let t0 = performance.now();
    const mark = (n) => { const t = performance.now(); times.push(n + ' ' + Math.round(t - t0)); if (log) console.warn('mark ' + n + ' ' + Math.round(t - t0)); t0 = t; };
    const tooth = makeTooth(mulberry32(seed ^ 0x70074));
    const comp = makeComposer(R, tooth);
    R.preview = previewer(R, comp, previewW);
    mark('tooth');
    if (new URLSearchParams(location.search).has('rohsheet')) {
      // a study sheet of horses through the stride
      const cols = 5, rows = 4, cw = W / cols, chh = H / rows;
      const coat = new URLSearchParams(location.search).get('rohsheet') || 'bay';
      for (let i = 0; i < cols * rows; i++) {
        const ph = i / (cols * rows);
        const gx = (i % cols + 0.55) * cw, gy = (((i / cols) | 0) + 0.92) * chh;
        const hh = chh * 0.5;
        const ro = riderParams(R.rand, {});
        Object.assign(ro, { phase: ph, coat, pitch: 0, stride: 1, neck: 20, head: 36, cloak: 0, backShield: false, vp: [gx + cw, gy - hh * 0.6] });
        const hs = buildHorse(ro, gx, gy, hh / 100);
        await drawRiderFull(R, { x: gx, y: gy, hh }, hs, ro, true);
        R.cS.fillStyle = 'rgba(0,255,0,1)'; R.cS.font = (30 * L.k) + 'px sans-serif'; R.cS.fillText(ph.toFixed(2), gx - cw * 0.5, gy - chh * 0.75);
        await R.tick();
      }
      flushAll(R);
      return await composite(R, comp);
    }
    await drawSky(R, L); mark('sky');
    await drawMountains(R, L); mark('mountain');
    await drawCity(R, L); mark('city');
    await R.checkpoint();
    const sources = [];
    for (let i = 0; i < 6; i++) {
      const y = L.hy + (L.yT - L.hy) * (0.02 + rand() * 0.3);
      sources.push({ x: lerp(hordeFront(L, y) + L.W * 0.04, L.W, rand()), y, r: L.H * (0.01 + rand() * 0.012), lean: -0.3 - rand() * 0.4, a: 0.2 + rand() * 0.15, seed: rand() * 50 });
    }
    sources.push({ x: L.city.cx - L.city.cs * 40, y: L.city.cb - L.city.cs * 16, r: L.city.cs * 9, lean: -0.45, a: 0.26, seed: 3 });
    sources.push({ x: L.city.cx + L.city.cs * 52, y: L.city.cb - L.city.cs * 8, r: L.city.cs * 11, lean: -0.7, a: 0.3, seed: 9 });
    sources.push({ x: L.city.cx + L.city.cs * 8, y: L.city.cb - L.city.cs * 4, r: L.city.cs * 7, lean: -0.55, a: 0.22, seed: 14 });
    await drawGround(R, L); mark('ground');
    drawDebris(R, L);
    const egx = L.W * lerp(0.95, 0.93, L.t), egy = L.hy + (L.yT - L.hy) * 0.5;
    sources.push({ x: egx - (egy - L.hy) * 0.05, y: egy - (egy - L.hy) * 0.35, r: (egy - L.hy) * 0.18, lean: -0.5, a: 0.3, seed: 21 });
    await drawSmoke(R, L, sources); mark('smoke');
    await drawHorde(R, L); mark('horde');
    drawEngine(R, L, egx, egy);
    await R.checkpoint();
    const army = makeArmy(R, L);
    const st = await drawArmy(R, L, army); mark('army D' + st.nD + ' M' + st.nM + ' F' + st.nF);
    flushAll(R);
    const out = await composite(R, comp); mark('composite');
    S.width = S.height = 1; T.width = T.height = 1;
    if (log) console.warn('rohirrim ' + W + 'x' + H + ' ' + times.join(' | '));
    return out;
  }

  /* ============================================================ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'rohirrim',
    title: 'The Ride of the Rohirrim',
    medium: 'Red, black and white chalk on toned paper',
    note: 'Press and hold anywhere to look closer',
    about: 'An original interpretation of Tolkien’s text, not of any film: at cockcrow on the Pelennor the horns of the Mark sound, and Théoden on white Snowmane, his golden shield shining like an image of the Sun, leads six thousand spears against the host of Mordor before the burning white city. It is drawn as a Renaissance battle cartoon in trois crayons, sanguine for horses and warm light, black chalk for the host and the smoke, white chalk for the dawn on steel and stone, so that every tone is a mark caught on the tooth of the paper.',
    tone: 'dark',
    room: '#14110e',
    mount,
  });

  function mount(el, api) {
    let alive = true, job = 0, lastKey = '', resizeTimer = 0, sheet = null, fit = null, readied = false;
    const qs = new URLSearchParams(location.search);
    const log = qs.has('rohlog');
    el.style.cssText += ';background:#14110e;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;cursor:zoom-in';
    const wall = document.createElement('div');
    wall.style.cssText = 'position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#2a231c 0%,#17130f 55%,#0b0907 100%)';
    el.appendChild(wall);
    const frame = document.createElement('div');
    frame.style.cssText = 'position:absolute;opacity:0;transition:opacity .8s ease;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5)) drop-shadow(0 18px 38px rgba(0,0,0,.55))';
    el.appendChild(frame);
    const view = document.createElement('canvas');
    view.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    frame.appendChild(view);
    const lens = document.createElement('canvas');
    lens.style.cssText = 'position:absolute;pointer-events:none;border-radius:50%;display:none;box-shadow:0 0 0 1px rgba(60,44,30,.8),0 0 0 6px rgba(14,11,9,.6),0 16px 46px rgba(0,0,0,.65);z-index:3';
    el.appendChild(lens);

    function sheetSize() {
      const vw = el.clientWidth || 1, vh = el.clientHeight || 1;
      const m = clamp(Math.min(vw, vh) * 0.03, 10, 34);
      return { vw, vh, m, sw: Math.max(50, vw - 2 * m), sh: Math.max(50, vh - 2 * m) };
    }
    function fitTo(W, H) {
      const z = sheetSize();
      const sc = Math.min(z.sw / W, z.sh / H);
      const w = W * sc, h = H * sc;
      fit = { sc, x: (z.vw - w) / 2, y: (z.vh - h) / 2, w, h };
      Object.assign(frame.style, { left: fit.x + 'px', top: fit.y + 'px', width: w + 'px', height: h + 'px' });
      return fit;
    }
    function paint(src) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vwp = Math.round(fit.w * dpr), vhp = Math.round(fit.h * dpr);
      if (view.width !== vwp || view.height !== vhp) { view.width = vwp; view.height = vhp; }
      const g = view.getContext('2d');
      g.clearRect(0, 0, vwp, vhp);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(src, 0, 0, vwp, vhp);
    }
    function place() {
      if (!sheet) return;
      const old = fit && fit.w;
      fitTo(sheet.W, sheet.H);
      if (!old || Math.abs(old - fit.w) > 0.5 || !view.width) paint(sheet.canvas);
    }
    async function start() {
      const z = sheetSize();
      const A = z.sw / z.sh;
      const key = A.toFixed(2);
      if (sheet && Math.abs(Math.log((sheet.W / sheet.H) / A)) < 0.07) { place(); return; }
      if (key === lastKey) { place(); return; }
      lastKey = key;
      const my = ++job;
      const target = +qs.get('rohres') || 8.4e6;
      const R2 = Math.sqrt(target / (z.sw * z.sh));
      const W = Math.round(z.sw * R2), H = Math.round(z.sh * R2);
      const t0 = performance.now();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const onPreview = (cv) => {
        if (!alive || my !== job) return;
        if (!sheet) { fitTo(W, H); paint(cv); frame.style.opacity = '1'; if (!readied) { readied = true; api.ready(); } }
      };
      let canvas = null;
      try { canvas = await renderSheet(W, H, api.seed >>> 0, () => alive && my === job, log, qs.has('rohnoprev') ? null : onPreview, Math.min(W, Math.round(z.sw * dpr))); }
      catch (e) { if (e && e.message === 'cancelled') return; throw e; }
      if (!alive || my !== job) return;
      if (sheet) sheet.canvas.width = sheet.canvas.height = 1;
      sheet = { canvas, W, H };
      fitTo(W, H); paint(canvas);
      frame.style.opacity = '1';
      if (log) console.warn('rohirrim total ms', Math.round(performance.now() - t0));
      if (!readied) { readied = true; api.ready(); }
      window.__rohDone = true;
    }
    const ro = new ResizeObserver(() => {
      place();
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { if (alive) start(); }, 450);
    });
    ro.observe(el);
    start();

    /* press-and-hold magnifier */
    let holding = false, holdTimer = 0, lastPt = null;
    function drawLens(cx, cy, touch) {
      if (!sheet || !fit) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const D = Math.round(clamp(Math.min(el.clientWidth, el.clientHeight) * 0.42, 180, 400));
      if (lens.width !== D * dpr) { lens.width = D * dpr; lens.height = D * dpr; }
      lens.style.width = D + 'px'; lens.style.height = D + 'px';
      const ly = touch ? cy - D * 0.7 : cy;
      lens.style.left = (cx - D / 2) + 'px'; lens.style.top = (ly - D / 2) + 'px';
      const sx = (cx - fit.x) / fit.sc, sy = (cy - fit.y) / fit.sc;
      const mag = Math.max(2.6, 1 / (fit.sc * dpr));
      const src = D / (fit.sc * mag);
      const g = lens.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#14110e'; g.fillRect(0, 0, lens.width, lens.height);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(sheet.canvas, sx - src / 2, sy - src / 2, src, src, 0, 0, lens.width, lens.height);
      lens.style.display = 'block';
    }
    const local = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.pointerType === 'touch' }; };
    function onDown(e) {
      if (!sheet || e.button > 0) return;
      lastPt = local(e);
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => { holding = true; if (lastPt) drawLens(lastPt.x, lastPt.y, lastPt.t); }, e.pointerType === 'touch' ? 150 : 60);
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
    function onMove(e) { if (!lastPt) return; lastPt = local(e); if (holding) drawLens(lastPt.x, lastPt.y, lastPt.t); }
    function onUp() { clearTimeout(holdTimer); holding = false; lastPt = null; lens.style.display = 'none'; }
    const noMenu = (e) => e.preventDefault();
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('contextmenu', noMenu);
    if (qs.has('rohlens')) {
      const [lx, ly] = qs.get('rohlens').split(',').map(Number);
      const iv = setInterval(() => { if (sheet && fit && window.__rohDone) { clearInterval(iv); drawLens(lx * el.clientWidth, ly * el.clientHeight, false); } }, 200);
    }
    return {
      destroy() {
        alive = false; job++;
        ro.disconnect();
        clearTimeout(resizeTimer); clearTimeout(holdTimer);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('contextmenu', noMenu);
        if (sheet) { sheet.canvas.width = sheet.canvas.height = 1; }
        sheet = null;
      },
    };
  }
})();
