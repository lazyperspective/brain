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
    const camK = 1.7;
    const yT = H * (lerp(0.66, 0.795, t) - 0.03 * u);
    const xT = W * (lerp(0.5, 0.52, t) - 0.04 * u);
    const hhT = (yT - hy) / camK;
    const cityW = Math.min(H * lerp(0.42, 0.47, t) * (1 - 0.1 * u), W * 0.82);
    const cityX = W * (lerp(0.63, 0.8, t) - 0.01 * u);
    const farX = W * (lerp(-0.05, 0.2, t) + 0.06 * u);
    return {
      W, H, A, t, u, hy, camK, yT, xT, hhT, farX,
      sun: [W * lerp(0.06, 0.13, t), hy + H * 0.012],
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
    return L.xT - L.hhT * 1.0 - (y - L.yT) * 2.1;
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
          if (sg === 0) { w = lerp(24, 10.5, Math.pow(t, 0.55)); if (t > 0.72) bb = (t - 0.72) * 15; }
          else if (sg === 1) { w = 6.8 + smooth(0.75, 1, t) * 1.8; if (t < 0.28) bb = (0.28 - t) * 15; }
          else { w = t < 0.35 ? lerp(8.4, 5.8, t / 0.35) : t < 0.5 ? lerp(5.8, 7.2, (t - 0.35) / 0.15) : lerp(7.2, 8.8, (t - 0.5) / 0.5); if (t < 0.2) bb = (0.2 - t) * 6; }
        } else {
          if (sg === 0) { w = lerp(16, 8.6, Math.pow(t, 0.7)); if (t > 0.82) fb = (t - 0.82) * 6; }
          else if (sg === 1) { w = 6.2 + smooth(0.75, 1, t) * 1.9; if (t < 0.15) fb = (0.15 - t) * 6; }
          else { w = t < 0.35 ? lerp(8.1, 5.6, t / 0.35) : t < 0.5 ? lerp(5.6, 7, (t - 0.35) / 0.15) : lerp(7, 8.8, (t - 0.5) / 0.5); if (t < 0.2) bb = (0.2 - t) * 7; }
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
      const top = hind ? rot(-47 + (a[0] + 30) * 0.13 + sh * 3, 39 - sh * 2.5) : rot(19 + a[0] * 0.1 + sh * 3, 49 - Math.abs(a[0]) * 0.03 - sh * 2.5);
      const lens = hind ? [30, 21, 11] : [26, 15, 11];
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
    const P = [22 + o.neckLen * Math.cos(na), 6 - o.neckLen * Math.sin(na)];
    const hd = [Math.cos(ha), Math.sin(ha)], th = [-hd[1], hd[0]];
    const Hp = (a, b) => [P[0] + hd[0] * a + th[0] * b, P[1] + hd[1] * a + th[1] * b];
    const W0 = [4, 0];
    const cdx = P[0] - W0[0], cdy = P[1] - W0[1], cl = Math.hypot(cdx, cdy);
    const cu = [cdy / cl, -cdx / cl];
    const arch = 5 + (o.arch || 0);
    const crC = [(W0[0] + P[0]) / 2 + cu[0] * arch * 1.7, (W0[1] + P[1]) / 2 + cu[1] * arch * 1.7];
    const crest = (u) => { const v = 1 - u; return [v * v * P[0] + 2 * v * u * crC[0] + u * u * W0[0], v * v * P[1] + 2 * v * u * crC[1] + u * u * W0[1]]; };
    const thr = Hp(3, 12.5), SH = [40, 24];
    const nu1 = lp(thr, SH, 0.33), nu2 = lp(thr, SH, 0.68);
    const ctl = [
      [-60, 9], [-53, 3], [-44, 0.5], [-34, 2.5], [-22, 5.5], [-10, 5], W0,
      crest(0.72), crest(0.45), crest(0.2),
      Hp(-1, -2), Hp(7, -3), Hp(20, -3), Hp(31, -1.8), Hp(37, -0.4), Hp(40.4, 3), Hp(39.6, 7.4), Hp(36, 9.6), Hp(28, 9.8), Hp(17, 15.5), Hp(8.5, 16), thr,
      [nu1[0] + cu[0] * 2.2, nu1[1] + cu[1] * 2.2], [nu2[0] + cu[0] * 0.6, nu2[1] + cu[1] * 0.6],
      SH, [38.5, 35], [30, 45], [14, 49.5], [-4, 50], [-20, 48.5], [-31, 45.5], [-39, 46], [-54, 47], [-61.5, 37], [-64, 24], [-63, 15],
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
      cap(Q(-26, 26), Q(14, 26), 24 * s, 24 * s, 1),
      cap(Q(-48, 22), Q(-48, 23), 21 * s, 21 * s, 1.3),
      cap(Q(-48, 28), Q(-51, 42), 15 * s, 12 * s),
      cap(Q(14, 10), Q(29, 38), 13 * s, 12 * s),
      cap(Q(33, 31), Q(33, 32), 10.5 * s, 10.5 * s),
      cap(Q(24, 10), S(Hp(3, 6)), 17 * s, 9 * s),
      cap(S(Hp(9, 5)), S(Hp(36, 4)), 7.6 * s, 5.2 * s, 1.3),
      cap(S(Hp(12, 9)), S(Hp(13, 9)), 7.6 * s, 7.6 * s, 1.3),
    ];
    const legParts = {};
    for (const id in legOut) {
      const L = legOut[id], c = L.chainS;
      const w = L.hind ? [11, 5, 3.8] : [7.5, 3.8, 3.8];
      legParts[id] = [cap(c[0], c[1], w[0] * s, 5 * s), cap(c[1], c[2], 3.6 * s, w[1] * s), cap(c[2], c[3], w[2] * s, 4 * s)];
    }
    const rp = (a) => [a[0] * cp - a[1] * sp, a[0] * sp + a[1] * cp];
    return {
      o, s, gx, gy, Q, S, body, legs: legOut, parts, legParts,
      crest: (u) => S(crest(u)), poll: S(P), hd: rp(hd), th: rp(th), Hp: (a, b) => S(Hp(a, b)),
      dock: Q(-61, 9),
    };
  }

  /* -------------------------------------------- coats: tone -> pressures */
  const darkOf = (v, ao) => clamp(0.82 - 0.95 * v + ao, 0, 1);
  function coatPress(coat, v, ao, out) {
    const D = darkOf(v, ao);
    const rim = smooth(0.6, 0.85, v - ao);
    if (coat === 'grey') {
      out[RED] = 0.5 * smooth(0.25, 0.7, D);
      out[BLK] = 0.75 * smooth(0.66, 1.0, D);
      out[WHT] = 0.95 * smooth(0.36, 0.72, v - ao);
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
    const fn = (x, y, out) => {
      const v = sh(x, y); if (v === null) return false;
      const below = (y - knee[1]) > -s * 3;
      if (points && below) { out[BLK] = clamp(0.3 + 0.65 * darkOf(v, ao), 0.15, 0.95); out[WHT] = 0.55 * smooth(0.62, 0.88, v); out[RED] = 0.12; }
      else coatPress(coat, v, ao, out);
      if (far) { out[WHT] *= 0.35; out[BLK] = Math.max(out[BLK], coat === 'grey' ? 0.1 : 0.3); }
      return true;
    };
    const sp = clamp(s * 0.8, 2.6, 4.6) * k, len = clamp(s * 4.5, 7, 28) * k, w = clamp(s * 0.55, 1.5, 3.2) * k;
    const bb = bbox(L.poly, 2);
    hatch(R, { ...bb, ang: 58 * D2R, sp, len, w, fn, chs: [RED, BLK, WHT], st: 0.22 });
    if (detail) hatch(R, { ...bb, ang: (L.hind ? 100 : 95) * D2R, sp: sp * 1.25, len: len * 0.8, w, fn, chs: [WHT, BLK], dth: 0.6 });
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
      const t0 = lp(c[1], c[2], 0.15), t1 = lp(c[1], c[2], 0.85);
      stroke(B, BLK, t0[0] - s * 1.6, t0[1], t1[0] - s * 1.8, t1[1], 0.02, cw * 0.6, 0.35);
    }
    flushAll(R);
  }

  function drawTail(R, hs, coat, detail) {
    const B = R.B, s = hs.s, k = R.k, rand = R.rand, o = hs.o;
    const D = hs.dock;
    const lift = o.tailLift;
    const ch = coat === 'grey' ? WHT : (POINTS[coat] ? BLK : RED);
    const n = detail ? 80 : 26;
    const pr = o.pitch * D2R, ca = Math.cos(pr), sa = Math.sin(pr);
    const R2 = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    for (let i = 0; i < n; i++) {
      const u = rand();
      const len = (50 + rand() * 38) * s;
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
    const fn = (x, y, out) => { const v = sh(x, y); if (v === null) return false; coatPress(coat, v, hs.ao || 0, out); return true; };
    const sp = clamp(s * 0.78, 2.6, 4.6) * k, len = clamp(s * 5, 7, 32) * k, w = clamp(s * 0.55, 1.5, 3.2) * k;
    hatch(R, { ...bb, ang: 58 * D2R, sp, len, w, fn, chs: coat === 'grey' ? [WHT, RED, BLK] : [RED, BLK, WHT], st: 0.22 });
    clipFlush(R, path);
    const fn2 = (x, y, out) => { const v = sh(x, y); if (v === null) return false; coatPress(coat, v, 0.06 + (hs.ao || 0), out); out[RED] *= 0.8; return true; };
    hatch(R, { ...bb, ang: (detail ? -24 : -30) * D2R, sp: sp * (detail ? 1.15 : 1.4), len: len * 1.1, w, fn: fn2, chs: coat === 'grey' ? [RED, BLK] : [BLK, WHT, RED], dth: 0.5, bend: 0.08 });
    clipFlush(R, path);
    const Q = hs.Q, cw = clamp(s * 0.55, 1.3, 3) * k;
    const an = (ch, pts, a, ww) => { const q = pts.map((p) => Q(p[0], p[1])); B.poly(ch, a, ww || cw, spline(q, false, 4)); };
    const ac = coat === 'grey' ? RED : (coat === 'black' ? WHT : BLK);
    if (detail) {
      an(ac, [[9, 4], [17, 19], [26, 33], [30, 41]], 0.32);
      an(ac, [[22, 40], [22, 46], [17, 49]], 0.4);
      an(RED, [[-4, 24], [-2, 36], [-6, 45]], 0.26);
      an(RED, [[-12, 24], [-11, 35], [-14, 44]], 0.2);
      an(ac, [[-35, 6], [-38, 13], [-36, 20]], 0.34);
      an(ac, [[-37, 28], [-40, 38], [-37, 45]], 0.32);
      an(ac, [[-56, 14], [-58, 28], [-54, 44]], 0.3);
      an(ac, [[-24, 8], [-30, 22], [-29, 40]], 0.18);
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
    contour(R, hs.body, { ch: coat === 'black' ? BLK : RED, w: clamp(s * 0.7, 1.5, 3.6) * k, a: 0.9, wob: s * 0.35, passes: detail ? 3 : 2, dark: 1, rim: 0.7 });
    flushAll(R);
  }

  /* ===================================================== riders */
  function riderGeom(hs, ro) {
    const Q = hs.Q, s = hs.s;
    const th = ro.lean * D2R;
    const ax = [Math.sin(th), -Math.cos(th)], f = [Math.cos(th), Math.sin(th)];
    const hip = [-8 + ro.seat, -3];
    const at = (p, a, b) => [p[0] + ax[0] * a + f[0] * b, p[1] + ax[1] * a + f[1] * b];
    const sho = at(hip, 31, 0);
    const head = at(sho, 10, 2.5);
    const knee = [hip[0] + 25 * Math.sin(50 * D2R), hip[1] + 25 * Math.cos(50 * D2R)];
    const ank = [knee[0] - 5, knee[1] + 23];
    const g = { s, th, ax, f, Q, hip, sho, head, knee, ank, at };
    const QQ = (pts) => pts.map((p) => Q(p[0], p[1]));
    g.torso = QQ([at(hip, -2, -8.5), at(hip, 12, -9.5), at(hip, 24, -9), at(sho, 2, -7.5), at(sho, 6.5, -3), at(sho, 6.5, 3), at(sho, 1, 7.5), at(hip, 22, 10.5), at(hip, 12, 9.5), at(hip, 1, 9)]);
    g.skirt = QQ([at(hip, 5, -9.5), at(hip, 4, 9.5), [knee[0] - 2, knee[1] - 3], [hip[0] - 8, hip[1] + 13]]);
    g.leg = QQ(limb([hip, knee, ank], [6.6, 5, 3.6]));
    g.boot = QQ([[knee[0] - 4, knee[1] + 9], [knee[0] + 4.5, knee[1] + 9], [ank[0] + 3.5, ank[1] - 1], [ank[0] + 10, ank[1] + 1.2], [ank[0] + 9.5, ank[1] + 4.2], [ank[0] - 4, ank[1] + 4], [ank[0] - 4.6, ank[1] - 4]]);
    if (ro.sword) { g.elbow = at(sho, 7, 10); g.hand = at(g.elbow, 9, 10); }
    else if (ro.banner) { g.elbow = at(sho, -10, 6); g.hand = at(g.elbow, 2, 12); }
    else if (ro.horn) { g.elbow = at(sho, -3, 9); g.hand = at(g.elbow, 12, 2); }
    else { g.elbow = at(sho, -15, -2); g.hand = at(g.elbow, 2, 15); }
    g.arm = QQ(limb([sho, g.elbow, g.hand], [5, 4, 3.2]));
    g.handS = Q(g.hand[0], g.hand[1]);
    const sa = ro.spearAng * D2R;
    const sd = [Math.cos(sa), Math.sin(sa)];
    g.spear = ro.sword || ro.banner || ro.horn ? null : { a: Q(g.hand[0] - sd[0] * 50, g.hand[1] - sd[1] * 50), b: Q(g.hand[0] + sd[0] * ro.spearLen, g.hand[1] + sd[1] * ro.spearLen) };
    if (ro.sword) { const sw = [Math.cos(-60 * D2R), Math.sin(-60 * D2R)]; g.sword = { a: Q(g.hand[0] - sw[0] * 4, g.hand[1] - sw[1] * 4), b: Q(g.hand[0] + sw[0] * 50, g.hand[1] + sw[1] * 50) }; }
    if (ro.horn) { g.hornPts = QQ([at(g.hand, 0, -1), at(g.hand, 5, 6), at(g.hand, 3, 12), at(g.hand, -2, 16)]); }
    if (ro.banner) {
      const top = [g.hand[0] - 24, g.hand[1] - 125], bot = [g.hand[0] + 3, g.hand[1] + 12];
      g.pole = { a: Q(bot[0], bot[1]), b: Q(top[0], top[1]) };
    }
    const sc = ro.shieldBig ? at(sho, -9, 20) : at(sho, -13, 10);
    g.shield = { c: Q(sc[0], sc[1]), rx: (ro.shieldBig ? 11.5 : 5.5) * s, ry: (ro.shieldBig ? 15.5 : 14) * s, rot: ro.shieldBig ? -0.15 : 0.1 };
    g.rein = Q(...at(sho, -15, 15));
    g.headS = Q(head[0], head[1]); g.hr = 6.4 * s;
    g.crown = Q(...at(head, 6.4, -1.5));
    const cl = [];
    const wv = ro.cloakWave, len = ro.cloak;
    const nb = at(sho, 4, -5), hb = at(hip, 8, -9.5);
    for (let i = 0; i <= 8; i++) { const u = i / 8; cl.push([nb[0] - len * u, nb[1] - 6 * u + Math.sin(u * 5 + wv) * 5 * u + 6 * u * u]); }
    for (let i = 8; i >= 0; i--) { const u = i / 8; cl.push([hb[0] - len * 0.92 * u, hb[1] + 8 * u + Math.sin(u * 5 + wv + 1) * 6 * u]); }
    g.cloak = len > 0 ? spline(QQ(cl), true, 3) : null;
    return g;
  }

  function riderUnion(g) {
    const p = new Path2D();
    addPoly(p, g.torso); addPoly(p, g.leg); addPoly(p, g.arm); addPoly(p, g.boot); if (g.cloak) addPoly(p, g.cloak);
    p.moveTo(g.headS[0] + g.hr * 1.2, g.headS[1]); p.arc(g.headS[0], g.headS[1], g.hr * 1.2, 0, TAU);
    p.moveTo(g.shield.c[0] + g.shield.rx, g.shield.c[1]); p.ellipse(g.shield.c[0], g.shield.c[1], g.shield.rx, g.shield.ry, g.shield.rot, 0, TAU);
    return p;
  }

  function drawRider(R, hs, g, ro, detail) {
    const B = R.B, s = hs.s, k = R.k, rand = R.rand;
    const cw = clamp(s * 0.55, 1.3, 3) * k;
    const sp = clamp(s * 0.75, 2.4, 4.2) * k, len = clamp(s * 4, 6, 24) * k, w = clamp(s * 0.5, 1.4, 3) * k;
    if (g.cloak) {
      const path = pathOf(g.cloak);
      const cch = ro.cloakCh;
      const bb = bbox(g.cloak, 2);
      const sh = makeShader([cap(lp(g.cloak[0], g.cloak[g.cloak.length - 1], 0.5), g.cloak[(g.cloak.length / 2) | 0], 14 * s, 9 * s)]);
      hatch(R, { ...bb, ang: 60 * D2R, sp, len, w, chs: [cch, BLK, WHT], st: 0.3, fn: (x, y, o) => { const t = (y - bb.y0) / (bb.y1 - bb.y0); const v = sh(x, y); const vv = v === null ? 0 : v; o[cch] = 0.4 + 0.4 * t; o[BLK] = 0.65 * smooth(0.3, 0.9, t - vv * 0.4); o[WHT] = 0.6 * smooth(0.45, 0.8, vv); return true; } });
      clipFlush(R, path);
      const nfold = detail ? 10 : 3;
      for (let i = 0; i < nfold; i++) {
        const a = g.cloak[(rand() * 5) | 0], b = g.cloak[(g.cloak.length * (0.3 + rand() * 0.3)) | 0];
        stroke(B, BLK, a[0], a[1] + (rand() - 0.3) * 10 * s, b[0], b[1] - rand() * 6 * s, (rand() - 0.5) * 0.3, cw, 0.45 + rand() * 0.3);
        if (rand() < 0.5) { const m = lp(a, b, 0.5); stroke(B, WHT, a[0], a[1] - 2 * s, m[0], m[1] - 3 * s, 0.1, cw * 0.8, 0.5); }
      }
      contour(R, g.cloak, { ch: BLK, w: cw, a: 0.75, wob: s * 0.4, passes: 2, rim: 0.4 });
      flushAll(R);
    }
    const sd = g.shield;
    const sp2 = new Path2D(); sp2.ellipse(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 0, TAU);
    if (ro.gold) {
      const c = R.cT;
      blob(c, WHT, sd.c[0], sd.c[1], sd.ry * 4.2, sd.ry * 3.6, 0, 0.22);
      blob(c, RED, sd.c[0], sd.c[1], sd.ry * 2.6, sd.ry * 2.3, 0, 0.16);
      reserve(R, sp2, 0.95);
      fillCh(c, WHT, sp2, 0.55);
      fillCh(c, RED, sp2, 0.12);
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU + rand() * 0.04, r0 = 0.22 + rand() * 0.12, r1 = 0.68 + rand() * 0.12;
        const ca = Math.cos(a), sa = Math.sin(a);
        stroke(B, i % 2 ? RED : WHT, sd.c[0] + ca * sd.rx * r0, sd.c[1] + sa * sd.ry * r0, sd.c[0] + ca * sd.rx * r1, sd.c[1] + sa * sd.ry * r1, 0.04, cw * 0.75, i % 2 ? 0.45 : 0.85);
      }
      contour(R, ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 60), { ch: RED, w: cw * 1.4, a: 0.9, wob: s * 0.2, passes: 3, dark: 0.6 });
      B.poly(RED, 0.6, cw, ellipsePts(sd.c[0], sd.c[1], sd.rx * 0.86, sd.ry * 0.86, sd.rot, 40, 0, TAU + 0.2));
      B.poly(RED, 0.55, cw, ellipsePts(sd.c[0], sd.c[1], sd.rx * 0.2, sd.ry * 0.2, sd.rot, 16, 0, TAU + 0.3));
      blob(c, WHT, sd.c[0] - sd.rx * 0.15, sd.c[1] - sd.ry * 0.12, sd.rx * 0.55, sd.ry * 0.5, 0, 0.75);
      for (let i = 0; i < 56; i++) {
        const a = rand() * TAU, r0 = 1.1 + rand() * 0.12, r1 = r0 + 0.35 + rand() * 1.3;
        stroke(B, WHT, sd.c[0] + Math.cos(a) * sd.rx * r0, sd.c[1] + Math.sin(a) * sd.ry * r0, sd.c[0] + Math.cos(a) * sd.rx * r1, sd.c[1] + Math.sin(a) * sd.ry * r1, 0, cw * 0.7, 0.25 + rand() * 0.35);
      }
    } else {
      fillCh(R.cT, ro.shieldCh, sp2, 0.3);
      fillCh(R.cT, BLK, sp2, 0.22);
      contour(R, ellipsePts(sd.c[0], sd.c[1], sd.rx, sd.ry, sd.rot, 30), { ch: BLK, w: cw, a: 0.7, wob: s * 0.2, passes: 2, rim: 0.5 });
      blob(R.cT, WHT, sd.c[0] + sd.rx * 0.2, sd.c[1], sd.rx * 0.35, sd.rx * 0.35, 0, 0.55);
    }
    flushAll(R);
    {
      // long hair streaming from under the helm, behind the shoulders
      const hc = g.headS, hr = g.hr;
      const nh = detail ? 22 : 6;
      for (let i = 0; i < nh; i++) {
        const y0 = hc[1] + (rand() - 0.1) * hr * 0.9, x0 = hc[0] - hr * 0.5;
        const Lh = (10 + rand() * 14) * s;
        B.quad(ro.hairCh, 0.4 + rand() * 0.4, cw * 0.75, x0, y0, x0 - Lh * 0.5, y0 + (rand() - 0.6) * 4 * s, x0 - Lh, y0 + (rand() - 0.1) * 9 * s);
      }
      flushAll(R);
    }
    const lsh = makeShader([cap(g.Q(...g.hip), g.Q(...g.knee), 6.5 * s, 5 * s), cap(g.Q(...g.knee), g.Q(...g.ank), 5 * s, 3.6 * s)]);
    const legFn = (x, y, o) => { const v = lsh(x, y); const D = darkOf(v === null ? 0.2 : v, 0.05); o[RED] = 0.3 + 0.55 * D; o[BLK] = 0.7 * smooth(0.5, 1, D); o[WHT] = 0.7 * smooth(0.6, 0.85, v === null ? 0 : v); return true; };
    const legP = pathOf(g.leg);
    reserve(R, legP, 0.9);
    hatch(R, { ...bbox(g.leg, 2), ang: 58 * D2R, sp, len, w, fn: legFn, chs: [RED, BLK, WHT], st: 0.25 });
    clipFlush(R, legP);
    fillCh(R.cT, BLK, pathOf(g.boot), 0.5);
    contour(R, g.leg, { ch: RED, w: cw, a: 0.8, wob: s * 0.3, passes: 2, dark: 0.8, rim: 0.5 });
    const st = g.boot[4];
    B.poly(BLK, 0.85, cw * 1.1, [[st[0] - 5 * s, st[1] - 7 * s], [st[0] - 7 * s, st[1] + 1 * s], [st[0] + 1 * s, st[1] + 1 * s], [st[0] - 1 * s, st[1] - 7 * s]]);
    const tp = pathOf(g.torso);
    reserve(R, tp, 0.92);
    const tb = bbox(g.torso, 2);
    const tsh = makeShader([cap(g.Q(...g.hip), g.Q(...g.sho), 10 * s, 10.5 * s)]);
    const tfn = (x, y, o) => { const v = tsh(x, y); const vv = v === null ? -0.3 : v; const D = darkOf(vv, 0.1); o[BLK] = 0.45 + 0.5 * D; o[WHT] = 0.75 * smooth(0.68, 0.9, vv); o[RED] = 0.22; return true; };
    hatch(R, { ...tb, ang: 58 * D2R, sp, len: len * 0.8, w, fn: tfn, chs: [BLK, RED, WHT], st: 0.25 });
    clipFlush(R, tp);
    if (detail && s > 1.6) {
      R.cS.save(); R.cS.clip(tp);
      const step = Math.max(2.2 * k, 1.9 * s);
      for (let y = tb.y0; y < tb.y1; y += step) for (let x = tb.x0 + ((y / step) & 1) * step * 0.5; x < tb.x1; x += step) {
        const v = tsh(x, y); if (v === null) continue;
        const ch = v > 0.35 ? WHT : BLK;
        B.quad(ch, 0.35 + rand() * 0.35, w * 0.6, x - step * 0.38, y, x, y + step * 0.42, x + step * 0.38, y);
      }
      B.flush(); R.cS.restore();
    }
    contour(R, g.torso, { ch: BLK, w: cw, a: 0.8, wob: s * 0.3, passes: 2, rim: 0.6 });
    const bA = g.Q(...g.at(g.hip, 7, -9.5)), bB = g.Q(...g.at(g.hip, 7, 10));
    B.line(BLK, 0.85, cw * 1.6, bA[0], bA[1], bB[0], bB[1]);
    const sk = g.skirt;
    B.poly(BLK, 0.6, cw, [sk[1], sk[2]]); B.poly(BLK, 0.5, cw, [sk[0], sk[3], sk[2]]);
    const hc = g.headS, hr = g.hr, fwd = g.f;
    const face = new Path2D(); face.ellipse(hc[0] + fwd[0] * hr * 0.3, hc[1] + hr * 0.2, hr * 0.8, hr * 0.95, 0, 0, TAU);
    const hd = new Path2D(); hd.arc(hc[0], hc[1], hr * 1.05, 0, TAU); reserve(R, hd, 0.9);
    fillCh(R.cT, RED, face, 0.45);
    fillCh(R.cT, BLK, face, 0.12);
    const chin = [hc[0] + fwd[0] * hr * 0.6, hc[1] + hr * 0.85];
    for (let i = 0; i < (detail ? 14 : 3); i++) B.quad(ro.hairCh, 0.55, cw * 0.8, chin[0] - rand() * hr * 0.6, chin[1] - rand() * hr * 0.3, chin[0] - hr * 0.6, chin[1] + hr * 0.6, chin[0] - hr * (1 + rand() * 1.6), chin[1] + hr * (0.4 + rand() * 0.7));
    const helm = new Path2D(); helm.ellipse(hc[0], hc[1] - hr * 0.15, hr * 1.06, hr * 1.02, 0, Math.PI * 0.95, Math.PI * 2.05); helm.closePath();
    fillCh(R.cT, BLK, helm, 0.38);
    flushAll(R);
    R.cS.save(); R.cS.clip(helm);
    for (let i = 0; i < 14; i++) { const a = Math.PI * (1.0 + i * 0.07); stroke(B, WHT, hc[0] + Math.cos(a) * hr, hc[1] + Math.sin(a) * hr - hr * 0.15, hc[0] + Math.cos(a) * hr * 0.25, hc[1] - hr * 0.5, 0.1, cw, i < 6 ? 0.85 : 0.15); }
    B.flush(); R.cS.restore();
    B.poly(BLK, 0.85, cw, ellipsePts(hc[0], hc[1] - hr * 0.15, hr * 1.06, hr * 1.02, 0, 12, Math.PI * 1.5, Math.PI * 2.05));
    B.line(BLK, 0.9, cw * 1.3, hc[0] - hr * 1.1, hc[1] - hr * 0.05, hc[0] + hr * 1.1, hc[1] - hr * 0.1);
    B.line(BLK, 0.85, cw * 1.5, hc[0] + fwd[0] * hr * 0.78, hc[1] - hr * 0.15, hc[0] + fwd[0] * hr * 0.82, hc[1] + hr * 0.6);
    B.poly(BLK, 0.7, cw, [[hc[0] - hr * 0.2, hc[1]], [hc[0] - hr * 0.05, hc[1] + hr * 0.95], [hc[0] + hr * 0.45, hc[1] + hr * 0.75]]);
    const cr0 = g.crown;
    for (let i = 0; i < (detail ? 40 : 9); i++) {
      const Lp = ro.plume * (0.6 + rand() * 0.6) * s;
      const ang = Math.PI - 0.3 + rand() * 0.42;
      const ex = cr0[0] + Math.cos(ang) * Lp, ey = cr0[1] + Math.sin(ang) * Lp + Lp * 0.22;
      B.quad(ro.plumeCh, 0.45 + rand() * 0.45, cw * (0.7 + rand() * 0.5), cr0[0], cr0[1], cr0[0] - Lp * 0.4, cr0[1] - Lp * (0.12 + rand() * 0.25), ex, ey);
    }
    flushAll(R);
    const ap = pathOf(g.arm);
    reserve(R, ap, 0.9);
    const ash = makeShader([cap(g.Q(...g.sho), g.Q(...g.elbow), 5 * s, 4 * s), cap(g.Q(...g.elbow), g.Q(...g.hand), 4 * s, 3.2 * s)]);
    hatch(R, { ...bbox(g.arm, 2), ang: 58 * D2R, sp, len: len * 0.7, w, fn: (x, y, o) => { const v = ash(x, y); const vv = v === null ? 0 : v; o[BLK] = 0.42 + 0.5 * darkOf(vv, 0.1); o[WHT] = 0.75 * smooth(0.68, 0.9, vv); return true; }, chs: [BLK, WHT], st: 0.25 });
    clipFlush(R, ap);
    contour(R, g.arm, { ch: BLK, w: cw, a: 0.75, wob: s * 0.25, passes: 2, rim: 0.5 });
    blob(R.cT, RED, g.handS[0], g.handS[1], 3 * s, 3 * s, 0, 0.7);
    const sw = clamp(s * 1.05, 1.4, 4.6) * k;
    if (g.spear) {
      const a = g.spear.a, b = g.spear.b;
      stroke(B, BLK, a[0], a[1], b[0], b[1], 0.003, sw, 0.85);
      B.line(RED, 0.5, sw * 0.7, a[0], a[1] + sw * 0.4, b[0], b[1] + sw * 0.4);
      B.line(WHT, 0.6, sw * 0.5, a[0] + (b[0] - a[0]) * 0.25, a[1] + (b[1] - a[1]) * 0.25 - sw * 0.45, b[0], b[1] - sw * 0.45);
      const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); const u = [d[0] / l, d[1] / l], n = [-u[1], u[0]];
      const hl = 9 * s, hw = 1.3 * s;
      const head = [[b[0] - u[0] * hl * 0.15, b[1] - u[1] * hl * 0.15], [b[0] + u[0] * hl * 0.32 + n[0] * hw, b[1] + u[1] * hl * 0.32 + n[1] * hw], [b[0] + u[0] * hl, b[1] + u[1] * hl], [b[0] + u[0] * hl * 0.32 - n[0] * hw, b[1] + u[1] * hl * 0.32 - n[1] * hw]];
      fillCh(R.cS, WHT, pathOf(head), 0.55);
      B.poly(BLK, 0.75, cw * 0.6, head.concat([head[0]]));
      B.line(WHT, 0.9, cw * 0.6, head[0][0], head[0][1] - hw * 0.4, head[2][0], head[2][1]);
      if (ro.pennon) {
        const p0 = [b[0] - u[0] * 16 * s, b[1] - u[1] * 16 * s];
        const wv = ro.cloakWave;
        const pts = [p0, [p0[0] - u[0] * 3 * s, p0[1] - 7 * s], [p0[0] - 24 * s, p0[1] - 5 * s + Math.sin(wv) * 3 * s], [p0[0] - 17 * s, p0[1] - 2 * s], [p0[0] - 25 * s, p0[1] + 1 * s + Math.cos(wv) * 2 * s], [p0[0] - 6 * s, p0[1] + 1 * s]];
        fillCh(R.cT, ro.pennonCh, pathOf(pts), 0.55);
        B.poly(BLK, 0.6, cw * 0.7, pts.concat([pts[0]]));
      }
    }
    if (g.sword) {
      const a = g.sword.a, b = g.sword.b;
      blob(R.cT, WHT, lp(a, b, 0.7)[0], lp(a, b, 0.7)[1], 26 * s, 26 * s, 0, 0.18);
      B.line(WHT, 1, sw * 1.3, a[0], a[1], b[0], b[1]);
      B.line(BLK, 0.7, sw * 0.4, a[0] + 1.4 * s, a[1] + 0.9 * s, b[0] + 0.9 * s, b[1] + 0.5 * s);
      const d = [b[0] - a[0], b[1] - a[1]]; const l = Math.hypot(d[0], d[1]); const n = [-d[1] / l, d[0] / l];
      B.line(BLK, 0.9, sw, a[0] - n[0] * 5 * s, a[1] - n[1] * 5 * s, a[0] + n[0] * 5 * s, a[1] + n[1] * 5 * s);
    }
    if (g.hornPts) {
      fillCh(R.cS, WHT, pathOf(limb(g.hornPts, [1.2 * s, 1.8 * s, 2.6 * s, 4 * s])), 0.7);
      B.poly(BLK, 0.8, cw, g.hornPts);
    }
    const bit = hs.Hp(35, 7);
    const rm = [(bit[0] + g.rein[0]) / 2, Math.max(bit[1], g.rein[1]) + 7 * s];
    B.quad(BLK, 0.65, cw * 0.8, g.rein[0], g.rein[1], rm[0], rm[1], bit[0], bit[1]);
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
    const sd = g.shield; blob(R.cT, ro.shieldCh, sd.c[0], sd.c[1], sd.rx, sd.ry, 0, 0.6);
    fillCh(R.cT, BLK, pathOf(g.torso), 0.42); fillCh(R.cT, RED, pathOf(g.leg), 0.35); fillCh(R.cT, BLK, pathOf(g.boot), 0.5); fillCh(R.cT, BLK, pathOf(g.arm), 0.35);
    contour(R, g.torso, { ch: BLK, w: cw, a: 0.7, wob: s * 0.3, passes: 1, rim: 0.8 });
    B.poly(RED, 0.5, cw, g.leg);
    const hc = g.headS;
    blob(R.cT, RED, hc[0] + g.hr * 0.2, hc[1] + g.hr * 0.3, g.hr * 0.8, g.hr * 0.9, 0, 0.6);
    blob(R.cT, BLK, hc[0], hc[1] - g.hr * 0.25, g.hr * 0.95, g.hr * 0.8, 0, 0.6);
    if (rand() < 0.6) B.quad(WHT, 0.7, cw, hc[0] - g.hr, hc[1] - g.hr * 0.3, hc[0] - g.hr * 0.7, hc[1] - g.hr * 1.2, hc[0] - g.hr * 0.05, hc[1] - g.hr * 1.15);
    B.line(BLK, 0.6, cw, hc[0] - g.hr, hc[1] - g.hr * 0.15, hc[0] + g.hr, hc[1] - g.hr * 0.2);
    const cr0 = g.crown;
    for (let i = 0; i < 5; i++) B.quad(ro.plumeCh, 0.6, cw, cr0[0], cr0[1], cr0[0] - ro.plume * 0.4 * s, cr0[1] - 4 * s, cr0[0] - ro.plume * (0.8 + rand() * 0.4) * s, cr0[1] + rand() * 7 * s);
    if (g.spear) {
      const a = g.spear.a, b = g.spear.b;
      B.line(BLK, 0.8, clamp(s * 1.1, 1.1, 3) * k, a[0], a[1], b[0], b[1]);
      B.line(WHT, 0.95, clamp(s * 1.6, 1.3, 3.6) * k, b[0], b[1], b[0] + (b[0] - a[0]) * 0.07, b[1] + (b[1] - a[1]) * 0.07);
      if (ro.pennon) fillCh(R.cT, ro.pennonCh, pathOf([[b[0] - 14 * s, b[1] - 1 * s], [b[0] - 34 * s, b[1] - 6 * s], [b[0] - 30 * s, b[1] + 1 * s]]), 0.6);
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
    if (rand() < 0.5) B.line(rand() < 0.75 ? RED : WHT, 0.6, w * 0.6, x - h * 0.1, y - h * 1.2, x - h * 0.6, y - h * 1.15);
    const sy0 = y - h * (0.9 + rd.sp * 0.6), sy1 = y - h * (0.85 - rd.sp * 0.5);
    B.line(BLK, a * 0.9, Math.max(0.8 * k, w * 0.3), x - h * 0.6, sy0, x + h * 1.3, sy1);
    if (rand() < 0.75) B.line(WHT, 0.9, Math.max(1.1 * k, w * 0.45), x + h * 1.25, sy1 - (sy1 - sy0) * 0.03, x + h * 1.45, sy1 + (sy1 - sy0) * 0.08);
    if (rand() < 0.15) B.line(WHT, 0.45, Math.max(1 * k, w * 0.4), x - h * 0.48, y - h * 0.72, x - h * 0.2, y - h * 0.71);
  }

  /* an orc of the host, drawn in black chalk with red glints of fire */
  function drawOrc(R, x, y, h, o) {
    const B = R.B, k = R.k, rand = R.rand;
    const s = h / 100, f = o.face;
    const P = (ux, uy) => [x + ux * s * f, y + uy * s];
    let hip, neck, head, kneeF, footF, kneeB, footB, elbF, handF, elbB, handB;
    if (o.pose === 'flee') {
      hip = P(0, -46); neck = P(16, -80); head = P(22, -90);
      kneeF = P(16, -26); footF = P(10, 0); kneeB = P(-14, -24); footB = P(-30, -12);
      elbF = P(26, -66); handF = P(36, -80); elbB = P(0, -64); handB = P(-14, -76);
    } else if (o.pose === 'brace') {
      hip = P(0, -44); neck = P(14, -76); head = P(19, -87);
      kneeF = P(20, -24); footF = P(28, 0); kneeB = P(-12, -22); footB = P(-24, 0);
      elbF = P(20, -56); handF = P(36, -58); elbB = P(2, -58); handB = P(14, -50);
    } else {
      hip = P(0, -46); neck = P(6, -79); head = P(9, -90);
      kneeF = P(10, -24); footF = P(12, 0); kneeB = P(-8, -24); footB = P(-12, 0);
      elbF = P(14, -60); handF = P(18, -50); elbB = P(-8, -60); handB = P(-10, -48);
    }
    const parts = [
      limb([hip, kneeB, footB], [6 * s, 5 * s, 3.5 * s]),
      limb([neck, elbB, handB], [4.5 * s, 4 * s, 3 * s]),
      limb([hip, lp(hip, neck, 0.5), neck], [9 * s, 12 * s, 9 * s]),
      limb([hip, kneeF, footF], [6.5 * s, 5 * s, 3.6 * s]),
      limb([neck, elbF, handF], [5 * s, 4 * s, 3.2 * s]),
    ];
    const u = new Path2D();
    for (const p of parts) addPoly(u, p);
    u.moveTo(head[0] + 8 * s, head[1]); u.arc(head[0], head[1], 8 * s, 0, TAU);
    reserve(R, u, 0.85);
    fillCh(R.cT, BLK, u, 0.36 + 0.18 * o.dark);
    const cw = clamp(s * 1.1, 1.2, 2.8) * k;
    for (let i = 0; i < parts.length; i++) contour(R, parts[i], { ch: BLK, w: cw, a: 0.85, wob: s * 0.6, passes: 1, rim: 0.6 });
    B.poly(BLK, 0.9, cw * 1.2, ellipsePts(head[0], head[1] - 2 * s, 8.5 * s, 7.5 * s, 0, 10, Math.PI, TAU));
    if (rand() < 0.5) B.line(BLK, 0.9, cw, head[0], head[1] - 9 * s, head[0] - f * 2 * s, head[1] - 15 * s);
    B.line(WHT, 0.7, cw * 0.9, head[0] - 7 * s, head[1] - 3 * s, head[0] - 3 * s, head[1] - 8 * s);
    if (o.pose !== 'flee') B.line(RED, 0.55, cw * 0.9, head[0] + f * 4 * s, head[1] + 1 * s, head[0] + f * 8 * s, head[1] + 2 * s);
    B.poly(RED, 0.4, cw, [lp(hip, neck, 0.2).map((v, i) => v + (i ? 0 : 7 * s)), lp(hip, neck, 0.9).map((v, i) => v + (i ? 0 : 6 * s))]);
    if (o.pose === 'brace') {
      const ang = (-14 - rand() * 18) * D2R;
      const d = [Math.cos(ang) * f, Math.sin(ang)];
      const a = [handB[0] - d[0] * 40 * s, handB[1] - d[1] * 40 * s], b = [handF[0] + d[0] * 150 * s, handF[1] + d[1] * 150 * s];
      B.line(BLK, 0.9, Math.max(1.1 * k, 1.6 * s), a[0], a[1], b[0], b[1]);
      B.line(WHT, 0.8, Math.max(1.2 * k, 2 * s), b[0], b[1], b[0] - d[0] * 10 * s, b[1] - d[1] * 10 * s);
      blob(R.cT, BLK, handB[0], handB[1] - 4 * s, 12 * s, 14 * s, 0, 0.8);
      B.poly(RED, 0.4, cw, ellipsePts(handB[0], handB[1] - 4 * s, 11 * s, 13 * s, 0, 8, -0.8, 0.8));
    } else if (o.pose === 'stand') {
      const ta = (rand() - 0.5) * 0.7 - 0.25 * f;
      const tx = handF[0] + Math.sin(ta) * 110 * s, ty = handF[1] - Math.cos(ta) * 110 * s;
      B.line(BLK, 0.9, Math.max(1.1 * k, 1.6 * s), handF[0] - Math.sin(ta) * 40 * s, handF[1] + Math.cos(ta) * 40 * s, tx, ty);
      B.line(WHT, 0.75, Math.max(1.1 * k, 1.8 * s), tx, ty, tx + Math.sin(ta) * 10 * s, ty - Math.cos(ta) * 10 * s);
      blob(R.cT, BLK, handB[0] - f * 4 * s, handB[1], 13 * s, 15 * s, 0, 0.8);
    } else {
      if (rand() < 0.5) B.line(BLK, 0.8, Math.max(1 * k, 1.4 * s), handF[0], handF[1], handF[0] + f * 30 * s, handF[1] - 40 * s);
    }
    flushAll(R);
  }

  /* ============================================================= the scene */
  async function drawSky(R, L) {
    const { W, H, hy } = L, rand = R.rand, N = R.noise, k = R.k, B = R.B;
    const [sunX, sunY] = L.sun;
    const C = L.city;
    const edgeY = (x) => H * (0.05 + 0.25 * smooth(-0.15 * W, 0.95 * W, x)) + (N.fbm(x / (H * 0.2), 2.2, 3) - 0.5) * H * 0.1;
    const dark = (x, y) => {
      const e = edgeY(x);
      const inC = smooth(e + H * 0.06, e - H * 0.05, y);
      const n = N.fbm(x / (H * 0.17), y / (H * 0.07), 4);
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
    const step = H * 0.1;
    for (let y0 = 0; y0 < hy; y0 += step) {
      const bx = { x0: 0, y0, x1: W, y1: Math.min(hy, y0 + step) };
      hatch(R, { ...bx, ang: 62 * D2R, sp: 4.4 * k, len: 36 * k, w: 2.6 * k, fn, chs: [BLK], bend: 0.05 });
      hatch(R, { ...bx, ang: -9 * D2R, sp: 5.2 * k, len: 80 * k, w: 2.4 * k, fn, chs: [WHT, RED, BLK], dth: 0.5, bend: 0.02 });
      flushAll(R);
      await R.tick();
    }
    for (let x = -W * 0.02; x < W * 1.02; x += H * (0.03 + rand() * 0.03)) {
      const e = edgeY(x);
      if (e > hy - H * 0.04) continue;
      const r = H * (0.018 + rand() * 0.035);
      const cx = x, cy = e - r * 0.4 + (rand() - 0.5) * r * 0.6;
      const lit = 1 - smooth(W * 0.3, W * 0.95, x) * 0.7;
      const arc = ellipsePts(cx, cy, r * 1.5, r, 0, 14, Math.PI * 0.15, Math.PI * 1.05);
      B.poly(WHT, 0.75 * lit, 2.6 * k, arc);
      B.poly(RED, 0.5 * lit, 2.2 * k, arc.map((p) => [p[0] + 2.5 * k, p[1] - 3 * k]));
      B.poly(BLK, 0.45, 2 * k, ellipsePts(cx, cy, r * 1.5, r, 0, 10, Math.PI * 1.1, Math.PI * 1.9));
      for (let j = 0; j < 7; j++) { const a = Math.PI * (1.15 + j * 0.1), q = [cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 0.9]; stroke(B, BLK, q[0], q[1], q[0] + r * 0.5, q[1] + r * 0.7, 0.05, 2 * k, 0.4); }
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
    const base = [
      [C.cx - C.w * 1.45, hy - H * 0.012], [C.cx - C.w * 0.95, hy - C.cs * 38], [C.cx - C.w * 0.64, C.cb - C.cs * 82], [C.cx - C.w * 0.36, C.cb - C.cs * 116],
      [C.cx - C.w * 0.08, C.cb - C.cs * 140], [C.cx + C.w * 0.22, C.cb - C.cs * 192], [C.cx + C.w * 0.5, C.cb - C.cs * 268], [C.cx + C.w * 0.7, C.cb - C.cs * 250],
      [C.cx + C.w * 0.93, C.cb - C.cs * 212], [C.cx + C.w * 1.25, C.cb - C.cs * 236], [W + C.w * 0.4, C.cb - C.cs * 205],
    ];
    let ridge = spline(base, false, 12);
    ridge = ridge.map((p, i) => [p[0], p[1] + (N.fbm(i * 0.09, 7.7, 4) - 0.5) * C.cs * 26 + (N.v2(i * 0.5, 3) - 0.5) * C.cs * 5]);
    const poly = ridge.concat([[W + C.w * 0.4, hy + 3], [C.cx - C.w * 1.45, hy + 3]]);
    const path = pathOf(poly);
    const bb = bbox(poly);
    reserve(R, path, 0.45);
    R.cT.save(); R.cT.clip(path);
    const g = R.cT.createLinearGradient(0, bb.y0, 0, hy);
    g.addColorStop(0, 'rgba(0,255,0,0.55)'); g.addColorStop(0.65, 'rgba(0,255,0,0.4)'); g.addColorStop(1, 'rgba(0,255,0,0.12)');
    R.cT.fillStyle = g; R.cT.fillRect(bb.x0, bb.y0, bb.x1 - bb.x0, hy - bb.y0);
    R.cT.restore();
    const ridgeY = (x) => { let lo = 0, hi = ridge.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ridge[m][0] < x) lo = m; else hi = m; } return ridge[lo][1]; };
    const fn = (x, y, o) => {
      const ry = ridgeY(x); if (y < ry) return false;
      const dd = (y - ry) / (C.cs * 60);
      const slope = (ridgeY(x + C.cs * 6) - ridgeY(x - C.cs * 6));
      const n = N.fbm(x / (C.cs * 28), y / (C.cs * 16), 3);
      const lit = clamp(slope / (C.cs * 8), -1, 1);
      o[BLK] = clamp(0.4 + 0.45 * n - 0.4 * lit - dd * 0.12, 0, 0.95) * smooth(hy + 1, hy - C.cs * 30, y);
      o[WHT] = clamp(0.55 * lit + (n - 0.55) * 0.8, 0, 0.75) * smooth(0.7, 0, dd);
      o[RED] = 0.22 * n + 0.2 * smooth(hy - C.cs * 40, hy, y);
      return true;
    };
    hatch(R, { x0: bb.x0, y0: bb.y0, x1: Math.min(W, bb.x1), y1: hy, ang: 64 * D2R, sp: 4.2 * k, len: 28 * k, w: 2.5 * k, fn, chs: [BLK, RED, WHT] });
    clipFlush(R, path);
    await R.tick();
    hatch(R, { x0: bb.x0, y0: bb.y0, x1: Math.min(W, bb.x1), y1: hy, ang: 112 * D2R, sp: 5 * k, len: 24 * k, w: 2.2 * k, fn, chs: [BLK], dth: 0.55 });
    clipFlush(R, path);
    for (let i = 0; i < ridge.length; i += 3) {
      const p = ridge[i];
      if (p[0] < 0 || p[0] > W || rand() < 0.45) continue;
      let x = p[0], y = p[1] + C.cs * 2;
      const pts = [[x, y]];
      const Lg = C.cs * (20 + rand() * 60);
      const dir = rand() < 0.5 ? -0.35 : 0.25;
      for (let j = 0; j < 8; j++) { x += dir * Lg / 8 + (rand() - 0.5) * C.cs * 3; y += Lg / 8; pts.push([x, y]); }
      if (y > hy) continue;
      B.poly(BLK, 0.5, 2 * k, pts);
      B.poly(WHT, 0.4, 1.8 * k, pts.map((q) => [q[0] - 3 * k, q[1]]));
    }
    for (let i = 0; i < ridge.length; i++) {
      const p = ridge[i];
      if (p[1] > C.cb - C.cs * 195 || rand() < 0.4) continue;
      const l = (6 + rand() * 18) * C.cs;
      stroke(B, WHT, p[0], p[1] + C.cs * 2, p[0] - l * 0.4, p[1] + l, 0.1, 2.4 * k, 0.65);
    }
    contour(R, ridge, { closed: false, ch: BLK, w: 2.4 * k, a: 0.75, wob: 2 * k, passes: 2, flat: true });
    flushAll(R);
    await R.tick();
  }

  async function drawCity(R, L) {
    const rand = R.rand, k = R.k, B = R.B;
    const C = L.city, cs = C.cs;
    const X = (u) => C.cx + u * cs, Y = (v) => C.cb + v * cs;
    const HW = [100, 93, 85, 76, 66, 55, 44], HT = [13, 9.5, 9, 9, 8.5, 8.5, 8];
    const T = []; let acc = 0;
    for (let i = 0; i < 7; i++) { acc += i === 0 ? 13 : (15.2 - i * 0.35); T.push({ hw: HW[i], top: -acc, h: HT[i], bend: HW[i] * 0.06, c: -i * 3.4 }); }
    const wt = (i, u) => { const q = (u - T[i].c) / T[i].hw; return T[i].top + T[i].bend * (1 - q * q); };
    const lw = clamp(cs * 0.4, 1.3, 2.6) * k;
    const light = (u, hw, c) => clamp(0.62 - 0.8 * ((u - (c || 0)) / hw), 0, 1);
    const outline = [];
    for (let i = 0; i < 7; i++) outline.push([X(T[i].c - T[i].hw), Y(wt(i, T[i].c - T[i].hw) + T[i].h)], [X(T[i].c - T[i].hw), Y(wt(i, T[i].c - T[i].hw) - 3)]);
    outline.push([X(T[6].c - T[6].hw * 0.6), Y(T[6].top - 14)], [X(8), Y(T[6].top - 64)], [X(T[6].c + T[6].hw * 0.6), Y(T[6].top - 14)]);
    for (let i = 6; i >= 0; i--) outline.push([X(T[i].c + T[i].hw), Y(wt(i, T[i].c + T[i].hw) - 3)], [X(T[i].c + T[i].hw), Y(wt(i, T[i].c + T[i].hw) + T[i].h)]);
    reserve(R, pathOf(outline), 0.5);
    const houses = (i) => {
      const hw = T[i].hw * 0.97;
      const n = Math.round(hw * (i === 6 ? 1.2 : 2.6));
      const list = [];
      for (let j = 0; j < n; j++) {
        const u = T[i].c + (rand() * 2 - 1) * hw;
        const tower = rand() < 0.05;
        list.push({ u, w: tower ? 1.6 + rand() : 1.1 + rand() * 2.2, h: tower ? 7 + rand() * 5 : 1.8 + rand() * (i === 6 ? 5 : 3.6), roof: rand(), tower });
      }
      list.sort((a, b) => b.h - a.h);
      for (const hz of list) {
        const base = wt(i, hz.u) + 0.5, top = base - hz.h;
        const x0 = X(hz.u - hz.w / 2), x1 = X(hz.u + hz.w / 2), y0 = Y(top), y1 = Y(base);
        const lt = light(hz.u, T[i].hw, T[i].c);
        const r = new Path2D(); r.rect(x0, y0, x1 - x0, y1 - y0);
        reserve(R, r, 0.5);
        fillCh(R.cT, WHT, r, 0.12 + 0.5 * lt * (0.6 + rand() * 0.4));
        const sx = lerp(x0, x1, 0.5 + 0.35 * lt);
        const sr = new Path2D(); sr.rect(sx, y0, x1 - sx, y1 - y0);
        fillCh(R.cT, BLK, sr, 0.18 + 0.3 * (1 - lt));
        if (hz.roof < 0.35) B.poly(BLK, 0.7, lw, [[x0 - cs * 0.3, y0], [(x0 + x1) / 2, y0 - cs * 1.5], [x1 + cs * 0.3, y0]]);
        else if (hz.roof < 0.45) B.poly(BLK, 0.6, lw, ellipsePts((x0 + x1) / 2, y0, (x1 - x0) / 2, cs * 1.2, 0, 6, Math.PI, TAU));
        else B.line(BLK, 0.55, lw, x0, y0, x1, y0);
        const nw = (hz.w * hz.h / 3) | 0;
        for (let q = 0; q < nw; q++) {
          const wx = lerp(x0, x1, 0.2 + rand() * 0.6), wy = lerp(y0, y1, 0.2 + rand() * 0.5);
          const fire = i < 3 && rand() < 0.3;
          B.line(fire ? RED : BLK, fire ? 0.95 : 0.85, Math.max(1.2 * k, cs * 0.55), wx, wy, wx, wy + cs * 0.7);
        }
        B.line(BLK, 0.55, lw * 0.8, x1, y0, x1, y1);
        if (lt > 0.4) B.line(WHT, 0.7, lw * 0.8, x0, y0, x0, y1);
      }
      flushAll(R);
    };
    const wall = (i) => {
      const t = T[i], n = 60;
      const topP = [], botP = [];
      for (let j = 0; j <= n; j++) { const u = t.c - t.hw + (2 * t.hw * j) / n; topP.push([X(u), Y(wt(i, u))]); botP.push([X(u), Y(wt(i, u) + t.h)]); }
      const poly = topP.concat(botP.slice().reverse());
      const path = pathOf(poly);
      reserve(R, path, 0.85);
      R.cT.save(); R.cT.clip(path);
      if (i === 0) {
        fillCh(R.cT, BLK, path, 0.5);
        const g = R.cT.createLinearGradient(X(t.c - t.hw), 0, X(t.c + t.hw), 0);
        g.addColorStop(0, 'rgba(0,0,255,0.3)'); g.addColorStop(0.45, 'rgba(0,0,255,0.08)'); g.addColorStop(1, 'rgba(0,0,255,0)');
        R.cT.fillStyle = g; R.cT.fillRect(X(t.c - t.hw), Y(t.top - 2), 2 * t.hw * cs, (t.h + t.bend + 4) * cs);
      } else {
        const g = R.cT.createLinearGradient(X(t.c - t.hw), 0, X(t.c + t.hw), 0);
        g.addColorStop(0, 'rgba(0,0,255,0.8)'); g.addColorStop(0.45, 'rgba(0,0,255,0.5)'); g.addColorStop(0.8, 'rgba(0,0,255,0.12)'); g.addColorStop(1, 'rgba(0,0,255,0.04)');
        R.cT.fillStyle = g; R.cT.fillRect(X(t.c - t.hw), Y(t.top - 2), 2 * t.hw * cs, (t.h + t.bend + 4) * cs);
        const g2 = R.cT.createLinearGradient(X(t.c - t.hw), 0, X(t.c + t.hw), 0);
        g2.addColorStop(0, 'rgba(0,255,0,0)'); g2.addColorStop(0.5, 'rgba(0,255,0,0.08)'); g2.addColorStop(1, 'rgba(0,255,0,0.5)');
        R.cT.fillStyle = g2; R.cT.fillRect(X(t.c - t.hw), Y(t.top - 2), 2 * t.hw * cs, (t.h + t.bend + 4) * cs);
      }
      R.cT.restore();
      const fn = (x, y, o) => {
        const u = (x - C.cx) / cs; const lt = light(u, t.hw, t.c);
        if (i === 0) { o[BLK] = 0.55 + 0.3 * (1 - lt); o[WHT] = 0.4 * lt; o[RED] = 0.25; }
        else { o[WHT] = 0.6 * lt + 0.1; o[BLK] = 0.6 * (1 - lt) * (1 - lt); o[RED] = 0.15; }
        return true;
      };
      const bb = bbox(poly, 1);
      hatch(R, { ...bb, ang: 2 * D2R, sp: Math.max(2.6 * k, cs * 1.2), len: cs * 4, w: lw, fn, chs: [WHT, BLK, RED], jit: 0.2, bend: 0.01 });
      clipFlush(R, path);
      for (let j = 0; j < t.hw * 1.4; j++) {
        const u = t.c + (rand() * 2 - 1) * t.hw, v = wt(i, u) + rand() * t.h;
        B.line(BLK, 0.4, lw * 0.7, X(u), Y(v), X(u), Y(v + 1.5));
      }
      for (let u = t.c - t.hw + 8 + rand() * 6; u < t.c + t.hw - 6; u += 15 + rand() * 8) {
        if (Math.abs(u) < 6) continue;
        const lt = light(u, t.hw, t.c);
        const bt = new Path2D(); bt.rect(X(u - 2.4), Y(wt(i, u) - 3), 4.8 * cs, (t.h + 3) * cs);
        reserve(R, bt, 0.8);
        fillCh(R.cT, i === 0 ? BLK : WHT, bt, i === 0 ? 0.55 : 0.3 + 0.5 * lt);
        const sr = new Path2D(); sr.rect(X(u + 2.4 * (lt * 2 - 1) * 0.5), Y(wt(i, u) - 3), (2.4 - 2.4 * (lt * 2 - 1) * 0.5) * cs, (t.h + 3) * cs);
        fillCh(R.cT, BLK, sr, 0.35);
        for (let q = -2; q <= 2; q += 1.3) B.line(lt > 0.4 ? WHT : BLK, 0.85, cs * 0.8, X(u + q), Y(wt(i, u) - 3), X(u + q), Y(wt(i, u) - 4.3));
        B.line(BLK, 0.7, lw, X(u + 2.4), Y(wt(i, u) - 3), X(u + 2.4), Y(wt(i, u) + t.h));
      }
      for (let u = t.c - t.hw + 1; u < t.c + t.hw; u += 1.7) {
        const lt = light(u, t.hw, t.c);
        B.line(lt > 0.4 ? WHT : BLK, 0.85, cs * 0.85, X(u), Y(wt(i, u) - 0.1), X(u), Y(wt(i, u) - 1.3));
      }
      contour(R, topP, { closed: false, ch: BLK, w: lw, a: 0.55, wob: cs * 0.2, passes: 1, flat: true });
      contour(R, botP, { closed: false, ch: BLK, w: lw * 1.2, a: 0.75, wob: cs * 0.2, passes: 1, flat: true });
      const gu = i === 0 ? 0 : t.c + (i % 2 ? -1 : 1) * t.hw * 0.42;
      const gw = i === 0 ? 4.5 : 2.2, gh = i === 0 ? 8.5 : 5;
      const gb = wt(i, gu) + t.h;
      const gp = new Path2D();
      gp.moveTo(X(gu - gw), Y(gb)); gp.lineTo(X(gu - gw), Y(gb - gh + gw)); gp.arc(X(gu), Y(gb - gh + gw), gw * cs, Math.PI, 0); gp.lineTo(X(gu + gw), Y(gb)); gp.closePath();
      fillCh(R.cS, BLK, gp, 0.92);
      if (i === 0) {
        blob(R.cT, RED, X(0), Y(gb - 3), gw * cs * 1.8, gh * cs * 0.8, 0, 0.7);
        for (const sx of [-1, 1]) {
          const tw = new Path2D(); tw.rect(X(sx * 9 - 3.5), Y(T[0].top - 7), 7 * cs, (T[0].h + 7 + T[0].bend) * cs);
          reserve(R, tw, 0.8);
          fillCh(R.cT, BLK, tw, 0.6);
          B.line(WHT, 0.6, lw, X(sx * 9 - 3.5), Y(T[0].top - 7), X(sx * 9 - 3.5), Y(T[0].top + 5));
          for (let u = -3; u <= 3; u += 1.75) B.line(BLK, 0.9, cs * 0.9, X(sx * 9 + u), Y(T[0].top - 7), X(sx * 9 + u), Y(T[0].top - 8.4));
        }
      }
      flushAll(R);
    };
    {
      const t6 = T[6];
      for (let j = 0; j < 10; j++) {
        const u = t6.c - t6.hw * 0.8 + rand() * t6.hw * 1.6, hh = 3 + rand() * 6, ww = 2 + rand() * 5;
        const r = new Path2D(); r.rect(X(u - ww / 2), Y(t6.top - hh), ww * cs, hh * cs);
        reserve(R, r, 0.7);
        fillCh(R.cT, WHT, r, 0.3 + 0.45 * light(u, t6.hw, t6.c));
        B.poly(BLK, 0.6, lw, [[X(u - ww / 2), Y(t6.top - hh)], [X(u + ww / 2), Y(t6.top - hh)], [X(u + ww / 2), Y(t6.top)]]);
      }
      const hl = new Path2D(); hl.rect(X(-16), Y(t6.top - 9), 20 * cs, 9 * cs);
      reserve(R, hl, 0.8); fillCh(R.cT, WHT, hl, 0.6);
      B.poly(BLK, 0.75, lw, [[X(-17), Y(t6.top - 9)], [X(-6), Y(t6.top - 13)], [X(5), Y(t6.top - 9)]]);
      for (let u = -14; u < 3; u += 2.2) B.line(BLK, 0.75, Math.max(1.2 * k, cs * 0.6), X(u), Y(t6.top - 6.5), X(u), Y(t6.top - 4));
      const tx = 8, tb = t6.top - 1, tt = t6.top - 46;
      const tw = [[X(tx - 3.1), Y(tb)], [X(tx - 2.4), Y(tt)], [X(tx - 3.6), Y(tt - 1)], [X(tx - 3.6), Y(tt - 3.4)], [X(tx - 2.2), Y(tt - 3.4)], [X(tx - 1.5), Y(tt - 9)], [X(tx), Y(tt - 17)], [X(tx + 1.5), Y(tt - 9)], [X(tx + 2.2), Y(tt - 3.4)], [X(tx + 3.6), Y(tt - 3.4)], [X(tx + 3.6), Y(tt - 1)], [X(tx + 2.4), Y(tt)], [X(tx + 3.1), Y(tb)]];
      const tp = pathOf(tw);
      reserve(R, tp, 0.95);
      fillCh(R.cT, WHT, tp, 0.95);
      const half = new Path2D(); half.moveTo(X(tx + 0.9), Y(tb)); half.lineTo(X(tx + 0.7), Y(tt)); half.lineTo(X(tx + 2.4), Y(tt)); half.lineTo(X(tx + 3.1), Y(tb)); half.closePath();
      fillCh(R.cT, BLK, half, 0.28);
      blob(R.cT, WHT, X(tx), Y(tt - 8), cs * 12, cs * 20, 0, 0.3);
      contour(R, tw, { ch: BLK, w: lw, a: 0.55, wob: cs * 0.1, passes: 1 });
      for (let v = tb - 4; v > tt + 2; v -= 3.2) B.line(BLK, 0.85, Math.max(1.2 * k, cs * 0.5), X(tx - 0.6), Y(v), X(tx - 0.6), Y(v + 1.1));
      B.line(WHT, 1, cs * 0.8, X(tx - 1.8), Y(tb - 1), X(tx - 1.5), Y(tt + 1));
      B.line(BLK, 0.85, lw * 0.8, X(tx), Y(tt - 17), X(tx), Y(tt - 22));
      fillCh(R.cS, WHT, pathOf([[X(tx), Y(tt - 22)], [X(tx - 5), Y(tt - 21.2)], [X(tx - 4.5), Y(tt - 20)], [X(tx), Y(tt - 20.2)]]), 0.85);
      flushAll(R);
    }
    await R.tick();
    wall(6);
    for (let i = 5; i >= 0; i--) {
      houses(i);
      if (i === 1) {
        const pr = [[X(-1), Y(T[1].top + 2)], [X(-10), Y(T[6].top + 1)], [X(-7), Y(T[6].top - 2.5)], [X(3), Y(T[6].top - 1.5)], [X(10), Y(T[6].top + 2)], [X(1.3), Y(T[1].top + 2)]];
        const pp = pathOf(pr);
        reserve(R, pp, 0.85);
        const lf = pathOf([pr[0], pr[1], pr[2], [X(-1.6), Y(T[6].top - 2)]]);
        fillCh(R.cT, WHT, lf, 0.7);
        const rf = pathOf([pr[5], [X(-1.6), Y(T[6].top - 2)], pr[3], pr[4]]);
        fillCh(R.cT, BLK, rf, 0.55);
        hatch(R, { ...bbox(pr), ang: 80 * D2R, sp: 2.6 * k, len: cs * 6, w: lw, fn: (x, y, o) => { o[x < X(0) ? WHT : BLK] = 0.6; o[RED] = 0.15; return true; } });
        clipFlush(R, pp);
        contour(R, pr, { ch: BLK, w: lw, a: 0.6, wob: cs * 0.2, passes: 1 });
        B.line(BLK, 0.9, lw * 1.3, X(-1), Y(T[1].top + 2), X(-1.6), Y(T[6].top - 2));
        flushAll(R);
      }
      wall(i);
      await R.tick();
    }
    for (let j = 0; j < 16; j++) {
      const i = (rand() * 3) | 0, u = T[i].c + (rand() * 2 - 1) * T[i].hw * 0.9, v = wt(i, u) - rand() * 6;
      blob(R.cT, RED, X(u), Y(v), cs * (4 + rand() * 8), cs * (3 + rand() * 5), 0, 0.35 + rand() * 0.3);
      for (let f = 0; f < 7; f++) { const fx = X(u + (rand() - 0.5) * 4); stroke(B, f < 5 ? RED : WHT, fx, Y(v), fx + (rand() - 0.3) * cs * 2, Y(v - 3 - rand() * 6), 0.2, lw, 0.85); }
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
        if (rand() < 0.7) {
          const a0 = rand() * TAU, sweep = 1.5 + rand() * 2.2;
          const pts = []; for (let j = 0; j <= 12; j++) { const a = a0 + sweep * j / 12; pts.push([x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.55]); }
          B.poly(BLK, 0.3 + rand() * 0.35, 2.2 * k, pts);
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

  /* a burning engine of war on the right, a dark frame for the charge to run into */
  function drawEngine(R, L) {
    const { W, hy } = L, rand = R.rand, k = R.k, B = R.B;
    const gx = W * lerp(0.88, 0.85, L.t), gy = L.hy + (L.yT - L.hy) * 0.62;
    const hh = (gy - hy) / L.camK, s = hh / 100;
    const P = (x, y) => [gx + x * s, gy + y * s];
    const beams = [
      [P(-90, 0), P(70, 0), 9], [P(-80, -12), P(60, -12), 7], [P(-60, -12), P(-20, -150), 8], [P(20, -12), P(-16, -150), 8],
      [P(-24, -146), P(-14, -146), 10], [P(-150, -230), P(40, -60), 7], [P(-50, -12), P(-40, -70), 5], [P(30, -60), P(60, -12), 5],
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
    B.quad(BLK, 0.6, 1.6 * k, ...P(-150, -230), ...P(-170, -150), ...P(-150, -100));
    B.line(BLK, 0.5, 1.4 * k, ...P(-20, -150), ...P(-150, -230));
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
        if (cl < 0.36 + 0.1 * near || (near > 0.5 && rand() < 0.35)) continue;
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
          drawOrc(R, x, yy, h, { pose, face: pose === 'flee' ? 1 : -1, dark: near });
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
        const bx = x0 + rand() * (W - x0), bh = hh * 2.6;
        B.line(BLK, 0.9, Math.max(1.2 * k, hh * 0.08), bx, y, bx, y - bh);
        const fl = [[bx, y - bh], [bx - hh * 1.4, y - bh + hh * 0.25], [bx - hh * 0.9, y - bh + hh * 0.5], [bx - hh * 1.3, y - bh + hh * 0.85], [bx, y - bh + hh * 0.8]];
        const red = rand() < 0.3;
        fillCh(R.cT, red ? RED : BLK, pathOf(fl), 0.75);
        if (red && hh > 6 * k) blob(R.cT, BLK, bx - hh * 0.6, y - bh + hh * 0.45, hh * 0.25, hh * 0.18, 0, 0.9);
        else if (hh > 6 * k) blob(R.cT, RED, bx - hh * 0.6, y - bh + hh * 0.45, hh * 0.18, hh * 0.13, 0, 0.9);
      }
      y += Math.max(1.3 * k, hh * 0.17);
      if (B.n > 5000) { flushAll(R); await R.tick(); }
    }
    flushAll(R);
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
      const sp = hh * (y > L.yT ? 1.2 : 0.9);
      let x = xf - rand() * hh * 0.5;
      while (x > -hh * 2) {
        const yy = y + (rand() - 0.5) * hh * 0.1;
        const h = (yy - L.hy) / L.camK;
        const nearKing = Math.abs(yy - L.yT) < L.hhT * 0.25 && x > L.xT - L.hhT * 1.6;
        const tooBig = h > L.hhT * 0.98 && x > L.xT - L.hhT * 1.2;
        const offscreen = x - h * 1.5 > L.W || x + h * 2.5 < 0 || yy - h * 1.9 > L.H;
        if (!nearKing && !tooBig && !offscreen) out.push({ x, y: yy, hh: h, sp: (rand() - 0.5) });
        x -= sp * (0.7 + rand() * 0.65);
      }
      z *= 1.1 + rand() * 0.03;
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
      phase: rand(), pitch: (rand() - 0.5) * 8, stride: 0.92 + rand() * 0.16,
      neck: 22 + rand() * 18, head: 38 + rand() * 18, neckLen: 46 + rand() * 6, arch: rand() * 4,
      tailLift: 0.15 + rand() * 0.35, mane: 16 + rand() * 14,
      coat: coats[(rand() * coats.length) | 0],
      lean: 14 + rand() * 22, seat: (rand() - 0.5) * 4,
      spearAng: 1 + rand() * 9, spearLen: 105 + rand() * 30, pennon: rand() < 0.3, pennonCh: rand() < 0.5 ? RED : WHT,
      shieldCh: rand() < 0.5 ? RED : BLK, cloak: rand() < 0.45 ? 0 : 30 + rand() * 30, cloakCh: rand() < 0.65 ? RED : BLK, cloakWave: rand() * 6,
      plume: 18 + rand() * 14, plumeCh: rand() < 0.45 ? WHT : rand() < 0.5 ? RED : BLK, hairCh: rand() < 0.6 ? RED : WHT,
      clothCh: rand() < 0.55 ? RED : BLK,
    };
    if (rand() < 0.12) { ro.spearAng = -50 + rand() * 25; ro.spearLen = 90; }
    if (rand() < 0.04) ro.horn = true;
    if (rd.king) {
      Object.assign(ro, { phase: 0.16, pitch: -5, stride: 1.06, neck: 30, head: 40, neckLen: 50, arch: 3, tailLift: 0.45, mane: 30, coat: 'grey', lean: 22, seat: 0,
        sword: true, gold: true, shieldBig: true, cloak: 64, cloakCh: RED, cloakWave: 1.2, plume: 36, plumeCh: WHT, hairCh: WHT, clothCh: RED, pennon: false, horn: false });
    }
    if (rd.banner) Object.assign(ro, { banner: true, coat: 'bay', phase: 0.62, cloak: 0, lean: 12, spearLen: 0, horn: false });
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
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([top[0] - len * t, top[1] + Math.sin(t * 5 + 0.5) * 7 * s * t + t * 12 * s]); }
    for (let i = 10; i >= 0; i--) { const t = i / 10; pts.push([top[0] - len * t * 0.92, top[1] + hgt * (1 - 0.15 * t) + Math.sin(t * 5 + 1.4) * 8 * s * t + t * 12 * s]); }
    const cloth = spline(pts, true, 3);
    const cp = pathOf(cloth);
    reserve(R, cp, 0.92);
    fillCh(R.cT, BLK, cp, 0.42);
    fillCh(R.cT, RED, cp, 0.1);
    const bb = bbox(cloth, 1);
    hatch(R, { ...bb, ang: 60 * D2R, sp: 3.4 * k, len: 18 * k, w: 2.2 * k, chs: [BLK, WHT], fn: (x, y, o) => { const t = (top[0] - x) / len; const f = Math.sin(t * 5 + 0.5 + (y - top[1]) / hgt * 0.4); o[BLK] = 0.5 + 0.3 * f; o[WHT] = 0.4 * smooth(0.4, 1, -f); return true; } });
    clipFlush(R, cp);
    contour(R, cloth, { ch: BLK, w: 2.4 * k, a: 0.85, wob: 1.5 * k, passes: 2 });
    const hx = top[0] - len * 0.52, hy2 = top[1] + hgt * 0.8 + 6 * s;
    const em = buildHorse({ phase: 0.75, pitch: -18, stride: 1.1, neck: 52, head: 28, neckLen: 50, arch: 4, tailLift: 0.5, mane: 18 }, hx, hy2, s * 0.34);
    const ep = horseUnion(em);
    flushAll(R);
    R.cT.save(); R.cT.clip(cp); fillCh(R.cT, WHT, ep, 0.85); R.cT.restore();
    R.cS.save(); R.cS.clip(cp);
    contour(R, em.body, { ch: WHT, w: 1.6 * k, a: 0.85, wob: 0.5 * k, passes: 1, flat: true });
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

  async function drawArmy(R, L, army) {
    const k = R.k;
    const FULL = 150 * k, DET = 34 * k, MID = 11 * k;
    let nD = 0, nM = 0, nF = 0;
    const only = R.only;
    for (const rd of army) {
      if (only && !(only === 'king' ? rd.king : rd.hh > L.hhT * 0.5)) continue;
      rd.fog = smooth(L.hhT * 0.8, 4 * k, rd.hh) * 0.85;
      if (rd.hh < MID && !rd.king) { if (rd.hh > 4 * k) longShadow(R, rd.x, rd.y, rd.hh, 0.25 * (1 - rd.fog)); drawRiderFar(R, rd); nF++; if (R.B.n > 6000) { flushAll(R); await R.tick(); } continue; }
      flushAll(R);
      const ro = riderParams(R.rand, rd);
      const s = rd.hh / 100;
      const hs = buildHorse(ro, rd.x, rd.y, s);
      rd.hs = hs; rd.ro = ro;
      hs.ao = smooth(L.yT + L.hhT * 0.1, L.H * 1.1, rd.y) * 0.35;
      longShadow(R, rd.x, rd.y, rd.hh, 0.34 * (1 - rd.fog));
      if (rd.hh < DET && !rd.king && !rd.banner) { drawRiderMid(R, rd); nM++; await R.checkpoint(); continue; }
      nD++;
      const detail = rd.hh > FULL || rd.king;
      const g = riderGeom(hs, ro);
      reserve(R, horseUnion(hs), 0.92);
      reserve(R, riderUnion(g), 0.92);
      if (ro.banner) drawBanner(R, hs, g);
      drawLeg(R, hs, hs.legs.LH, ro.coat, true, detail);
      drawLeg(R, hs, hs.legs.LF, ro.coat, true, detail);
      drawTail(R, hs, ro.coat, detail);
      drawHorseBody(R, hs, ro.coat, detail);
      await R.tick();
      if (detail) {
        const alt = buildHorse({ ...ro, phase: ro.phase + 0.05 + R.rand() * 0.05 }, rd.x, rd.y, s);
        for (const id of ['RF', 'RH']) contour(R, alt.legs[id].poly, { ch: RED, w: clamp(s * 0.45, 1.2, 2.4) * k, a: 0.34, wob: s * 0.5, passes: 1 });
        flushAll(R);
      }
      reserveLegs(R, hs);
      drawLeg(R, hs, hs.legs.RH, ro.coat, false, detail);
      drawLeg(R, hs, hs.legs.RF, ro.coat, false, detail);
      drawMane(R, hs, ro.coat, detail);
      drawTack(R, hs, ro, detail);
      drawRider(R, hs, g, ro, detail);
      await R.checkpoint();
    }
    return { nD, nM, nF };
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
      B: new Batch(cS), BT: new Batch(cT), only: new URLSearchParams(location.search).get('rohonly'), dbg: new URLSearchParams(location.search).has('rohdbg'),
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
    await drawSky(R, L); mark('sky');
    await drawMountains(R, L); mark('mountain');
    await drawCity(R, L); mark('city');
    await R.checkpoint();
    const sources = [];
    for (let i = 0; i < 6; i++) {
      const y = L.hy + (L.yT - L.hy) * (0.02 + rand() * 0.3);
      sources.push({ x: lerp(hordeFront(L, y) + L.W * 0.04, L.W, rand()), y, r: L.H * (0.01 + rand() * 0.012), lean: -0.3 - rand() * 0.4, a: 0.2 + rand() * 0.15, seed: rand() * 50 });
    }
    sources.push({ x: L.city.cx - L.city.cs * 40, y: L.city.cb - L.city.cs * 20, r: L.city.cs * 8, lean: -0.5, a: 0.2, seed: 3 });
    sources.push({ x: L.city.cx + L.city.cs * 30, y: L.city.cb - L.city.cs * 10, r: L.city.cs * 7, lean: -0.6, a: 0.18, seed: 9 });
    await drawGround(R, L); mark('ground');
    const eng = drawEngine(R, L);
    sources.push({ x: eng.x, y: eng.y, r: eng.r, lean: -0.5, a: 0.3, seed: 21 });
    await drawSmoke(R, L, sources); mark('smoke');
    await drawHorde(R, L); mark('horde');
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
