/* Sirena — a sheet of anatomical studies of a dead mermaid.
 * Silverpoint on a blue-grey bone-ash ground, heightened with lead white, notes in pen and brown ink.
 * Everything is drawn as individual strokes in sheet units (1000 x 690) and composited once
 * through the tooth of the prepared ground.
 */
(function () {
  'use strict';

  const SW = 1000, SH = 690;
  const TAU = Math.PI * 2, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hyp = Math.hypot;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let R = mulberry32(1);           // seeded: hatching, tremor, small details
  const rr = (a, b) => a + (b - a) * R();
  const rs = (a) => (R() * 2 - 1) * a;

  /* ------------------------------------------------------------ geometry */
  function catmull(P, closed, step) {
    const n = P.length, out = [];
    if (n < 2) return P.slice();
    const g = (i) => (closed ? P[(i + n) % n] : P[clamp(i, 0, n - 1)]);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
      const L = hyp(p2[0] - p1[0], p2[1] - p1[1]);
      const m = Math.max(1, Math.ceil(L / (step || 1.5)));
      for (let k = 0; k < m; k++) {
        const t = k / m, t2 = t * t, t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (closed) out.push(out[0].slice()); else out.push(P[n - 1].slice());
    return out;
  }
  const C = (P, s) => catmull(P, false, s || 1.2);
  const CC = (P, s) => catmull(P, true, s || 1.2);
  function plen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
  function resample(P, step) {
    const out = [P[0].slice()];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      let ax = P[i - 1][0], ay = P[i - 1][1];
      const bx = P[i][0], by = P[i][1];
      let d = hyp(bx - ax, by - ay);
      while (acc + d >= step) {
        const t = (step - acc) / d;
        ax += (bx - ax) * t; ay += (by - ay) * t;
        out.push([ax, ay]); d = hyp(bx - ax, by - ay); acc = 0;
      }
      acc += d;
    }
    const l = P[P.length - 1];
    if (hyp(out[out.length - 1][0] - l[0], out[out.length - 1][1] - l[1]) > step * 0.3) out.push(l.slice());
    return out;
  }
  function sub(P, t0, t1) { // sub-polyline by fraction of length
    const L = plen(P), a = t0 * L, b = t1 * L, out = [];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const d = hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      const s0 = acc, s1 = acc + d;
      if (s1 >= a && s0 <= b) {
        const u0 = clamp((a - s0) / (d || 1), 0, 1), u1 = clamp((b - s0) / (d || 1), 0, 1);
        if (!out.length) out.push([lerp(P[i - 1][0], P[i][0], u0), lerp(P[i - 1][1], P[i][1], u0)]);
        out.push([lerp(P[i - 1][0], P[i][0], u1), lerp(P[i - 1][1], P[i][1], u1)]);
      }
      acc = s1;
    }
    return out;
  }
  function at(P, t) { const s = sub(P, 0, clamp(t, 0.0001, 1)); return s[s.length - 1]; }
  function tangents(P) {
    const n = P.length, T = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = hyp(dx, dy) || 1;
      T.push([dx / l, dy / l]);
    }
    return T;
  }
  // offset a polyline: d(t) >0 to the left of travel (screen coords: left normal = (ty,-tx))
  function offset(P, d) {
    const T = tangents(P), n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const dd = typeof d === 'function' ? d(i / (n - 1), i) : d;
      out.push([P[i][0] + T[i][1] * dd, P[i][1] - T[i][0] * dd]);
    }
    return out;
  }
  function ribbon(P, wl, wr) {
    const A = offset(P, wl), Bp = offset(P, (t, i) => -(typeof wr === 'function' ? wr(t, i) : wr));
    return A.concat(Bp.reverse());
  }
  const rev = (P) => P.slice().reverse();
  function xf(P, ox, oy, sc, ang, flipX) {
    const c = Math.cos(ang || 0), s = Math.sin(ang || 0), fx = flipX ? -1 : 1;
    return P.map((p) => { const x = p[0] * sc * fx, y = p[1] * sc; return [ox + x * c - y * s, oy + x * s + y * c]; });
  }
  function ellipse(cx, cy, rx, ry, ang, n) {
    const out = [], c = Math.cos(ang || 0), s = Math.sin(ang || 0);
    n = n || 48;
    for (let i = 0; i <= n; i++) { const t = (i / n) * TAU, x = Math.cos(t) * rx, y = Math.sin(t) * ry; out.push([cx + x * c - y * s, cy + x * s + y * c]); }
    return out;
  }
  function bbox(polys) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const P of polys) for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    return [x0, y0, x1, y1];
  }

  /* ------------------------------------------------------------ the stroke engine
   * Three additive channels of one "layer" canvas: R = silverpoint, G = pen & ink, B = lead white.
   * Segments are bucketed by (channel, width, alpha) into Path2Ds and stroked with 'lighter'.
   */
  const NA = 30, A0 = 0.008;
  const ALEV = []; for (let k = 0; k < NA; k++) ALEV.push(A0 * Math.pow(1 / A0, k / (NA - 1)));
  const LNA = Math.log(1 / A0) / (NA - 1);
  const WLEV = [0.26, 0.32, 0.38, 0.45, 0.53, 0.62, 0.72, 0.84, 1.0, 1.2, 1.45, 1.75, 2.1, 2.6, 3.2, 4.0];
  const CH_COL = ['rgb(255,0,0)', 'rgb(0,255,0)', 'rgb(0,0,255)'];
  const CH_SC = [0.5, 0.55, 0.6];
  let LC = null, B = new Map(), SEGS = 0, HIER = 1, SEGOCC = null;
  function wIdx(w) { let i = 0; while (i < WLEV.length - 1 && w > (WLEV[i] + WLEV[i + 1]) * 0.5) i++; return i; }
  function seg(ch, x0, y0, x1, y1, a, w) {
    if (a < A0 * 0.75) return;
    if (SEGOCC && SEGOCC((x0 + x1) * 0.5, (y0 + y1) * 0.5)) return;
    let ai = Math.round(Math.log(a / A0) / LNA); if (ai >= NA) ai = NA - 1; if (ai < 0) ai = 0;
    const key = ((ch * 16 + wIdx(w)) << 5) + ai;
    let b = B.get(key);
    if (!b) { b = { p: new Path2D(), x: NaN, y: NaN, k: key }; B.set(key, b); }
    if (b.x !== x0 || b.y !== y0) b.p.moveTo(x0, y0);
    b.p.lineTo(x1, y1); b.x = x1; b.y = y1; SEGS++;
  }
  function flush() {
    if (!B.size) return;
    const c = LC;
    c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
    for (const b of B.values()) {
      const ai = b.k & 31, wi = (b.k >> 5) & 15, ch = b.k >> 9;
      c.globalAlpha = Math.min(1, ALEV[ai] * CH_SC[ch]);
      c.strokeStyle = CH_COL[ch]; c.lineWidth = WLEV[wi];
      c.stroke(b.p);
    }
    c.globalAlpha = 1;
    B = new Map();
  }
  function fillPoly(ch, P, a) { // immediate filled shape on a channel
    const c = LC; c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.min(1, a * CH_SC[ch]);
    c.fillStyle = CH_COL[ch]; c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]);
    c.closePath(); c.fill(); c.globalAlpha = 1;
  }

  function profile(type) {
    if (type === 'h') { // hatch: quick attack, long flick release
      const ta = rr(0.04, 0.16), tr = rr(0.25, 0.6), e = rr(0.0, 0.3), sag = rr(-0.1, 0.12);
      return (t) => (0.15 + 0.85 * sstep(0, ta, t)) * (1 - (1 - e) * sstep(1 - tr, 1, t)) * (1 + sag * Math.sin(t * PI));
    }
    if (type === 'c') { // contour: steady with slow pressure drift
      const ta = rr(0.03, 0.12), tr = rr(0.04, 0.2), ph = R() * TAU, fr = rr(0.6, 2.4), ph2 = R() * TAU;
      return (t) => (0.3 + 0.7 * sstep(0, ta, t)) * (1 - 0.8 * sstep(1 - tr, 1, t)) * (0.8 + 0.12 * Math.sin(t * fr * TAU + ph) + 0.08 * Math.sin(t * 7.3 + ph2));
    }
    if (type === 'f') { // feathery construction line
      const ph = R() * TAU;
      return (t) => sstep(0, 0.2, t) * (1 - sstep(0.7, 1, t)) * (0.7 + 0.3 * Math.sin(t * 5 + ph));
    }
    return () => 1;
  }

  // a single silverpoint stroke along a polyline (sheet units)
  function stroke(P, o) {
    const n = P.length; if (n < 2) return;
    const ch = o.ch || 0, w0 = o.w || 0.5;
    const cum = new Float32Array(n);
    let L = 0;
    for (let i = 1; i < n; i++) { L += hyp(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); cum[i] = L; }
    if (L < 0.25) return;
    const step = o.step || 1.5;
    const m = Math.max(1, Math.ceil(L / step));
    const tr = o.trem === undefined ? 0.16 : o.trem;
    const f1 = rr(0.09, 0.16), f2 = rr(0.45, 0.8), p1 = R() * TAU, p2 = R() * TAU;
    const pr = o.prof || profile(o.pt || 'h');
    const a0 = o.a * (ch === 0 ? HIER : 1), tone = o.tone, wf = o.wf;
    let j = 0, px = 0, py = 0, pa = 0;
    for (let k = 0; k <= m; k++) {
      const s = (L * k) / m;
      while (j < n - 2 && cum[j + 1] < s) j++;
      const d = cum[j + 1] - cum[j] || 1, u = (s - cum[j]) / d;
      const ax = P[j][0], ay = P[j][1], bx = P[j + 1][0], by = P[j + 1][1];
      const tx = (bx - ax) / d, ty = (by - ay) / d;
      const off = tr * (Math.sin(s * f1 + p1) * 0.7 + Math.sin(s * f2 + p2) * 0.3);
      const x = ax + (bx - ax) * u - ty * off, y = ay + (by - ay) * u + tx * off;
      let a = a0 * pr(k / m);
      if (tone) a *= tone(x, y);
      if (k > 0) seg(ch, px, py, x, y, (a + pa) * 0.5, wf ? w0 * wf(k / m) : w0);
      px = x; py = y; pa = a;
    }
  }

  // light: from the upper left, a little in front
  const LX = -0.62, LY = -0.78; // 2D direction towards the light
  const L3 = (() => { const v = [-0.5, -0.62, 0.6], l = hyp(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; })();

  /* contour: a path drawn as several overlapping restated strokes; heavier on the shadow side.
   * side: +1 if the outside of the form is on the left of travel (screen left normal (ty,-tx)), -1 right, 0 none */
  function contour(P0, o) {
    o = o || {};
    const P = resample(P0, 1.0), n = P.length;
    if (n < 2) return;
    const T = tangents(P);
    const side = o.side || 0, a = o.a === undefined ? 0.55 : o.a, lit = o.lit === undefined ? 0.45 : o.lit;
    const wt = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!side) { wt[i] = 1; continue; }
      const nx = T[i][1] * side, ny = -T[i][0] * side;
      const f = 0.5 - 0.5 * (nx * LX + ny * LY); // 1 on the side away from the light
      wt[i] = lerp(lit, 1, sstep(0.15, 0.95, f));
    }
    const segL = o.seg || 34;
    let i = 0;
    while (i < n - 1) {
      const len = Math.max(4, Math.round(segL * rr(0.55, 1.5)));
      const s0 = Math.max(0, i - (i > 0 ? Math.round(rr(0, 3)) : 0));
      const j = Math.min(n - 1, i + len);
      const ox = rs(o.jit === undefined ? 0.22 : o.jit), oy = rs(o.jit === undefined ? 0.22 : o.jit);
      const piece = [];
      for (let k = s0; k <= j; k++) piece.push([P[k][0] + ox, P[k][1] + oy]);
      const ws = wt.subarray(s0, j + 1), m = piece.length - 1;
      const tf = (x, y, t) => 1;
      const pr = profile('c');
      stroke(piece, { a, w: (o.w || 0.5) * 0.82, prof: (t) => pr(t) * ws[Math.round(t * m)] * (o.fade ? o.fade(piece[Math.round(t * m)]) : 1), trem: o.trem === undefined ? 0.12 : o.trem });
      if (o.re && R() < o.re) {
        const ox2 = rs(0.5), oy2 = rs(0.5), pc2 = piece.map((p) => [p[0] + ox2, p[1] + oy2]);
        const pr2 = profile('c');
        stroke(pc2, { a: a * 0.5, w: (o.w || 0.5) * 0.9, prof: (t) => pr2(t) * ws[Math.round(t * m)], trem: 0.2 });
      }
      i = j - (R() < 0.3 ? 0 : 0);
      if (j >= n - 1) break;
      i = j + (R() < 0.15 ? 1 : 0);
    }
  }

  /* ------------------------------------------------------------ forms (rasterised masks + height fields) */
  let SC = null; // scratch canvas
  function scratch(w, h) {
    if (!SC) SC = document.createElement('canvas');
    if (SC.width < w || SC.height < h) { SC.width = Math.max(SC.width, w); SC.height = Math.max(SC.height, h); }
    const c = SC.getContext('2d', { willReadFrequently: true });
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    return c;
  }
  function tracePath(c, P) { c.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); c.closePath(); }
  /* Form(add, subtract, opts): add/subtract are arrays of polygons. opts.res (px/unit), opts.blur (units) */
  function Form(add, subt, opts) {
    opts = opts || {};
    const res = opts.res || 1.25;
    const bb = bbox(add), pad = (opts.blur || 4) + 3;
    const x0 = bb[0] - pad, y0 = bb[1] - pad, x1 = bb[2] + pad, y1 = bb[3] + pad;
    const w = Math.max(2, Math.ceil((x1 - x0) * res)), h = Math.max(2, Math.ceil((y1 - y0) * res));
    const c = scratch(w, h);
    c.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    c.fillStyle = '#fff'; c.beginPath(); for (const P of add) tracePath(c, P); c.fill(opts.rule || 'nonzero');
    if (subt && subt.length) {
      c.globalCompositeOperation = 'destination-out'; c.beginPath();
      for (const P of subt) tracePath(c, P); c.fill('nonzero');
      c.globalCompositeOperation = 'source-over';
    }
    const d = c.getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    let cnt = 0;
    for (let i = 0; i < w * h; i++) { m[i] = d[i * 4 + 3]; if (m[i] > 127) cnt++; }
    const F = { x0, y0, x1, y1, res, w, h, m, area: cnt / (res * res), hf: null, bl: opts.blur || 4 };
    F.in = (x, y) => {
      const ix = ((x - x0) * res) | 0, iy = ((y - y0) * res) | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return false;
      return m[iy * w + ix] > 127;
    };
    F.cov = (x, y) => {
      const ix = ((x - x0) * res) | 0, iy = ((y - y0) * res) | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 0;
      return m[iy * w + ix] / 255;
    };
    F.height = (x, y) => { if (!F.hf) buildHF(F); const ix = clamp(((x - x0) * res) | 0, 0, w - 1), iy = clamp(((y - y0) * res) | 0, 0, h - 1); return F.hf[iy * w + ix]; };
    F.lam = (x, y, k) => { // lambert from the blurred-mask height field
      if (!F.hf) buildHF(F);
      const fx = (x - x0) * res, fy = (y - y0) * res;
      const ix = clamp(fx | 0, 1, w - 2), iy = clamp(fy | 0, 1, h - 2), H = F.hf;
      const gx = (H[iy * w + ix + 1] - H[iy * w + ix - 1]) * 0.5 * res, gy = (H[(iy + 1) * w + ix] - H[(iy - 1) * w + ix]) * 0.5 * res;
      const s = (k || 1) * F.bl * 1.4;
      let nx = -gx * s, ny = -gy * s, nz = 1; const l = hyp(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      return nx * L3[0] + ny * L3[1] + nz * L3[2];
    };
    return F;
  }
  function buildHF(F) {
    const { w, h, m } = F, n = w * h;
    let a = new Float32Array(n), b = new Float32Array(n);
    for (let i = 0; i < n; i++) a[i] = m[i] / 255;
    const r = Math.max(1, Math.round(F.bl * F.res));
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) { // horizontal
        let acc = 0; const row = y * w;
        for (let x = -r; x <= r; x++) acc += a[row + clamp(x, 0, w - 1)];
        for (let x = 0; x < w; x++) {
          b[row + x] = acc / (2 * r + 1);
          acc += a[row + Math.min(w - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
        }
      }
      for (let x = 0; x < w; x++) { // vertical
        let acc = 0;
        for (let y = -r; y <= r; y++) acc += b[clamp(y, 0, h - 1) * w + x];
        for (let y = 0; y < h; y++) {
          a[y * w + x] = acc / (2 * r + 1);
          acc += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x];
        }
      }
    }
    F.hf = a;
  }

  /* ------------------------------------------------------------ hatching */
  // straight-ish parallel strokes over a form, alpha modulated by tone(x,y) in 0..1
  function hatch(F, tone, o) {
    const ang = (o.ang * PI) / 180, ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    const sp = o.sp || 2.4, a = o.a || 0.4, len = o.len || [9, 22], t0 = o.t0 || 0.03, bend = o.bend === undefined ? 0.06 : o.bend;
    const cs = [[F.x0, F.y0], [F.x1, F.y0], [F.x0, F.y1], [F.x1, F.y1]];
    let vmin = 1e9, vmax = -1e9, umin = 1e9, umax = -1e9;
    for (const c of cs) { const v = c[0] * vx + c[1] * vy, u = c[0] * ux + c[1] * uy; vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); umin = Math.min(umin, u); umax = Math.max(umax, u); }
    const bendS = rs(1) > 0 ? 1 : 1; // the hand's arc is consistent
    const tf = (x, y) => { const t = tone(x, y); return t <= 0 ? 0 : Math.pow(Math.min(1, t), o.g || 0.7); };
    const du = 1.0;
    for (let v = vmin + R() * sp; v < vmax; v += sp * rr(0.8, 1.2)) {
      const vj = v + rs(sp * 0.12);
      let run = -1;
      const runs = [];
      for (let u = umin; u <= umax + du; u += du) {
        const x = ux * u + vx * vj, y = uy * u + vy * vj;
        const ok = u <= umax && F.in(x, y) && tone(x, y) > t0;
        if (ok && run < 0) run = u;
        else if (!ok && run >= 0) { runs.push([run, u - du]); run = -1; }
      }
      for (const [ra, rb] of runs) {
        let cur = ra + rr(0, 0.8);
        let first = true;
        while (cur < rb - 1.2) {
          let L = rr(len[0], len[1]);
          if (first) { L *= rr(0.3, 1); first = false; }
          const end = Math.min(rb - rr(0, 0.6), cur + L);
          if (end - cur < 1.2) break;
          const Ls = end - cur, nb = Math.max(2, Math.ceil(Ls / 2.5));
          const bb = bend * Ls * rr(0.4, 1.2) * bendS;
          const pts = [];
          for (let k = 0; k <= nb; k++) {
            const t = k / nb, u = cur + Ls * t, off = bb * (t * (1 - t) * 4);
            pts.push([ux * u + vx * (vj + off), uy * u + vy * (vj + off)]);
          }
          const rq = R();
          if (rq > 0.04) {
            stroke(pts, { ch: o.ch || 0, a: a * rr(0.75, 1.2), w: (o.w || 0.3) * rr(0.85, 1.15), tone: tf, pt: 'h', trem: o.trem === undefined ? 0.1 : o.trem, step: 2.2 });
            if (rq > 0.955) { const dd = rr(0.25, 0.5); stroke(pts.map((q) => [q[0] + vx * dd, q[1] + vy * dd]), { a: a * 0.6, w: (o.w || 0.3), tone: tf, pt: 'h', trem: 0.1, step: 2.2 }); }
          }
          cur = end + rr(-1.2, 1.8);
        }
      }
    }
  }
  // standard layered silverpoint shading: tone built only by superimposed hatching
  function shade(F, tone, o) {
    o = o || {};
    // silverpoint: hairlines, closely laid, tone built by many light passes at slowly turning angles
    const base = (o.ang === undefined ? 54 : o.ang) + rs(7);
    const spf = rr(0.85, 1.2), lf = rr(0.8, 1.25);
    const sp = (o.sp || 1.7) * 0.47 * spf, a = (o.a || 0.45) * 1.0, w = (o.w || 0.3) * (o.w ? 0.62 : 1);
    const len = (o.len || [9, 22]).map((v) => v * lf), len2 = (o.len2 || [6, 14]).map((v) => v * lf);
    const maxL = Math.min((o.layers || 2) + 2, F.area < 30 ? 2 : F.area < 140 ? 3 : 6);
    const passes = [[0, 0, 1], [-7, 0.16, 0.95], [8, 0.32, 0.9], [-15, 0.48, 0.85], [-72, 0.66, 0.75], [20, 0.8, 0.7]];
    for (let k = 0; k < maxL; k++) {
      const [da, th, af] = passes[k];
      const tf = th ? (x, y) => (tone(x, y) - th) / (1 - th) : tone;
      hatch(F, tf, { ang: base + da + rs(3), sp: sp * rr(0.95, 1.1), a: a * af, len: k >= 4 ? len2 : len, w, t0: 0.02, bend: k >= 4 ? 0.03 : o.bend });
    }
  }

  /* curved cross-contour hatching through a parametric map M(s,t) -> [x,y] */
  function hatchMap(M, o) {
    const s0 = o.s0 || 0, s1 = o.s1 === undefined ? 1 : o.s1, ds = o.ds, a = o.a || 0.4;
    for (let s = s0 + R() * ds; s < s1; s += ds * rr(0.8, 1.2)) {
      let t = o.t0 === undefined ? 0 : o.t0;
      const t1 = o.t1 === undefined ? 1 : o.t1;
      while (t < t1) {
        const span = rr(o.len[0], o.len[1]);
        const te = Math.min(t1, t + span);
        const pts = [];
        const nk = Math.max(2, Math.ceil((te - t) / (o.dt || 0.03)));
        for (let k = 0; k <= nk; k++) { const tt = t + ((te - t) * k) / nk; pts.push(M(s + rs(o.sj || 0) * 0, tt)); }
        const tone = (x, y) => { const v = o.tone(x, y, s); const m = o.mask ? (o.mask.in(x, y) ? 1 : 0) : 1; return v <= 0 ? 0 : Math.pow(Math.min(1, v), 0.9) * m; };
        stroke(pts, { a: a * rr(0.8, 1.15), w: o.w || 0.46, tone, pt: 'h', trem: 0.12 });
        t = te + rr(-0.01, 0.03);
      }
    }
  }

  /* ------------------------------------------------------------ the ground (paper + bone-ash ground) */
  const RF = mulberry32(90210); // fixed: the physical sheet never changes
  const rf = (a, b) => a + (b - a) * RF();
  const FOLD_X = 507;
  function sheetOutline() {
    const P = [];
    const edge = (x0, y0, x1, y1, n, amp) => {
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const w = Math.sin(t * PI * rf(1, 3) + rf(0, 6)) * amp + (RF() - 0.5) * amp * 0.5;
        const nx = -(y1 - y0), ny = x1 - x0, l = hyp(nx, ny);
        P.push([lerp(x0, x1, t) + (nx / l) * w, lerp(y0, y1, t) + (ny / l) * w]);
      }
    };
    const r = 5;
    edge(r, 0.6, SW - r, 0, 40, 0.7);
    edge(SW, r, SW - 0.8, SH - r, 30, 0.6);
    edge(SW - r, SH, r * 1.6, SH - 0.5, 40, 0.8);
    edge(0, SH - r * 1.6, 0.9, r, 30, 0.6);
    return P;
  }

  function drawGround(g) {
    const sheet = sheetOutline();
    g.save();
    g.beginPath(); tracePath(g, sheet); g.fillStyle = 'rgb(226,217,196)'; g.fill(); g.clip();
    // the bone-ash ground was brushed on with ragged edges
    const gp = [];
    const N = 220;
    for (let i = 0; i < N; i++) {
      const t = i / N; let x, y, inset = 2.2 + Math.abs(Math.sin(t * 41.3)) * 1.6 + RF() * 1.6;
      if (t < 0.25) { x = lerp(0, SW, t / 0.25); y = inset; }
      else if (t < 0.5) { x = SW - inset; y = lerp(0, SH, (t - 0.25) / 0.25); }
      else if (t < 0.75) { x = lerp(SW, 0, (t - 0.5) / 0.25); y = SH - inset; }
      else { x = inset; y = lerp(SH, 0, (t - 0.75) / 0.25); }
      gp.push([x, y]);
    }
    g.beginPath(); tracePath(g, gp); g.fillStyle = 'rgb(167,173,163)'; g.fill();
    g.save(); g.beginPath(); tracePath(g, gp); g.clip();
    // broad soft unevenness of the coat
    for (let i = 0; i < 22; i++) {
      const x = rf(-50, SW + 50), y = rf(-50, SH + 50), r = rf(120, 320);
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const lt = RF() < 0.5;
      gr.addColorStop(0, lt ? 'rgba(206,210,198,0.035)' : 'rgba(118,122,112,0.035)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // brush strokes of the ground: broad soft passes of a wide brush, a few bristle tracks in each
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (let coat = 0; coat < 2; coat++) {
      for (let b = 0; b < 34; b++) {
        const y = rf(-30, SH + 30), x0 = rf(-150, SW - 150), len = rf(240, 760), wid = rf(26, 70);
        const ang = coat === 0 ? rf(-0.035, 0.035) : rf(0.012, 0.05);
        const wav = rf(2, 9), wph = rf(0, 6), light = RF() < 0.5;
        const pts = [];
        for (let s = 0; s <= len; s += 16) pts.push([x0 + s * Math.cos(ang), y + s * Math.sin(ang) + Math.sin(s / 160 + wph) * wav]);
        const trace = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const q of pts) g.lineTo(q[0], q[1]); };
        g.strokeStyle = light ? 'rgba(208,212,200,0.022)' : 'rgba(116,122,112,0.02)'; g.lineWidth = wid; trace(); g.stroke();
        const nb = 0;
        for (let k = 0; k < nb; k++) {
          const off = (k / nb - 0.5) * wid * 0.95 + rf(-2, 2);
          g.strokeStyle = (RF() < 0.5) ? 'rgba(214,218,206,' + rf(0.018, 0.04).toFixed(3) + ')' : 'rgba(108,114,104,' + rf(0.016, 0.034).toFixed(3) + ')';
          g.lineWidth = rf(0.3, 1.1);
          g.beginPath();
          const s0 = (rf(0, 0.5) * pts.length) | 0, s1 = Math.min(pts.length - 1, s0 + 3 + ((rf(0, 0.4) * pts.length) | 0));
          for (let i = s0; i <= s1; i++) { const q = pts[i]; const x = q[0] - off * Math.sin(ang), yy = q[1] + off * Math.cos(ang); if (i === s0) g.moveTo(x, yy); else g.lineTo(x, yy); }
          g.stroke();
        }
      }
    }
    // handling grime toward the edges
    const eg = (x0, y0, x1, y1, a) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(70,64,52,' + a + ')'); gr.addColorStop(1, 'rgba(70,64,52,0)'); g.fillStyle = gr; g.fillRect(0, 0, SW, SH); };
    eg(0, 0, 0, 40, 0.10); eg(0, SH, 0, SH - 45, 0.14); eg(0, 0, 40, 0, 0.12); eg(SW, 0, SW - 35, 0, 0.09);
    g.restore();
    // rubbed corners: the ground worn through to the paper
    const rub = (cx, cy, r, a) => {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.3);
      gr.addColorStop(0, 'rgba(214,206,186,' + (a * 0.55).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(214,206,186,0)');
      g.fillStyle = gr; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
      for (let i = 0; i < 520; i++) {
        const ang = rf(0, TAU), d = Math.pow(RF(), 1.8) * r * 1.25;
        const x = cx + Math.cos(ang) * d, y = cy + Math.sin(ang) * d * rf(0.7, 1.2);
        const pr = 1 - d / (r * 1.25);
        if (RF() > pr * 1.2) continue;
        g.fillStyle = 'rgba(226,217,196,' + (a * rf(0.5, 1.4)).toFixed(3) + ')';
        g.beginPath(); g.ellipse(x, y, rf(0.25, 1.3), rf(0.2, 0.8), rf(0, 3), 0, TAU); g.fill();
      }
    };
    rub(4, 4, 34, 0.5); rub(SW - 6, 5, 26, 0.45); rub(SW - 5, SH - 6, 40, 0.55); rub(6, SH - 5, 30, 0.5);
    rub(260, SH - 2, 18, 0.35); rub(SW - 2, 330, 14, 0.3);
    // foxing: rust spots in loose clusters
    const fox = (cx, cy, n, spread) => {
      for (let i = 0; i < n; i++) {
        const x = cx + rf(-spread, spread), y = cy + rf(-spread, spread) * 0.8, r = rf(0.4, 2.4) * (RF() < 0.15 ? 2.2 : 1);
        const halo = r * rf(3, 7);
        const gr = g.createRadialGradient(x, y, 0, x, y, halo);
        gr.addColorStop(0, 'rgba(150,104,62,0.16)'); gr.addColorStop(1, 'rgba(150,104,62,0)');
        g.fillStyle = gr; g.fillRect(x - halo, y - halo, halo * 2, halo * 2);
        g.fillStyle = 'rgba(128,84,46,' + rf(0.25, 0.6).toFixed(2) + ')';
        g.beginPath(); g.ellipse(x, y, r, r * rf(0.7, 1), rf(0, 3), 0, TAU); g.fill();
      }
    };
    fox(930, 640, 9, 30); fox(70, 600, 6, 22); fox(640, 30, 5, 26); fox(420, 660, 4, 14); fox(975, 120, 4, 12); fox(150, 70, 3, 10);
    // a tide line where something wet once lay
    g.strokeStyle = 'rgba(132,108,76,0.10)'; g.lineWidth = 1.6;
    g.beginPath(); for (let i = 0; i <= 80; i++) { const t = (i / 80) * TAU * 0.8 + 2.2, rr2 = 46 + Math.sin(t * 5) * 4 + Math.sin(t * 11) * 1.5; const x = 948 + Math.cos(t) * rr2, y = 40 + Math.sin(t) * rr2 * 0.8; if (!i) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    // a drop of candle wax
    const wx = 618, wy = 662;
    let gr = g.createRadialGradient(wx, wy, 0, wx, wy, 6.5);
    gr.addColorStop(0, 'rgba(206,196,160,0.30)'); gr.addColorStop(0.75, 'rgba(196,186,150,0.26)'); gr.addColorStop(1, 'rgba(120,110,80,0.0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(wx, wy, 6.5, 5.2, 0.4, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(110,100,70,0.22)'; g.lineWidth = 0.4; g.beginPath(); g.ellipse(wx, wy, 6.2, 5.0, 0.4, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,240,0.25)'; g.beginPath(); g.ellipse(wx - 2, wy - 1.6, 1.6, 0.8, 0.5, 0, TAU); g.fill();
    // the old fold
    let fg = g.createLinearGradient(FOLD_X - 4, 0, FOLD_X + 4, 0);
    fg.addColorStop(0, 'rgba(60,60,50,0)'); fg.addColorStop(0.45, 'rgba(60,60,50,0.07)'); fg.addColorStop(0.52, 'rgba(240,240,230,0.10)'); fg.addColorStop(1, 'rgba(240,240,230,0)');
    g.fillStyle = fg; g.fillRect(FOLD_X - 4, 0, 8, SH);
    g.strokeStyle = 'rgba(70,66,56,0.18)'; g.lineWidth = 0.35;
    g.beginPath(); for (let y = 0; y <= SH; y += 6) { const x = FOLD_X + Math.sin(y * 0.02) * 0.6 + rf(-0.15, 0.15); if (!y) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
    // little losses of ground along the fold
    g.fillStyle = 'rgba(224,214,192,0.8)';
    g.fillStyle = 'rgba(224,214,192,0.45)'; for (let i = 0; i < 18; i++) { const y = rf(0, SH), l = rf(0.4, 2.2); g.beginPath(); g.ellipse(FOLD_X + rf(-0.5, 0.5), y, rf(0.15, 0.35), l, rf(-0.2, 0.2), 0, TAU); g.fill(); }
    g.restore();
    return sheet;
  }

  /* ------------------------------------------------------------ composite: layer channels x ground tooth */
  function makeTiles() {
    const r = mulberry32(4242);
    const P1 = 211, P2 = 197;
    const wn = new Float32Array(P1 * P1); for (let i = 0; i < wn.length; i++) wn[i] = r();
    let vn = new Float32Array(P2 * P2); for (let i = 0; i < vn.length; i++) vn[i] = r();
    // blur vn a little (wrap), twice
    for (let pass = 0; pass < 2; pass++) {
      const o = new Float32Array(P2 * P2);
      for (let y = 0; y < P2; y++) for (let x = 0; x < P2; x++) {
        let s = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += vn[((y + dy + P2) % P2) * P2 + ((x + dx + P2) % P2)];
        o[y * P2 + x] = s / 9;
      }
      vn = o;
    }
    let mn = 1, mx = 0; for (const v of vn) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
    for (let i = 0; i < vn.length; i++) vn[i] = (vn[i] - mn) / (mx - mn);
    // brush striations of the ground: a slowly wandering 1D grain
    const SN = 1009; let st = new Float32Array(SN); for (let i = 0; i < SN; i++) st[i] = r() - 0.5;
    for (let pass = 0; pass < 2; pass++) { const o = new Float32Array(SN); for (let i = 0; i < SN; i++) o[i] = (st[(i + SN - 1) % SN] + st[i] * 2 + st[(i + 1) % SN]) / 4; st = o; }
    return { wn, vn, P1, P2, st, SN };
  }
  const TILES = makeTiles();

  /* ------------------------------------------------------------ lettering: a cramped mirror-script hand in pen */
  // glyphs written left-to-right in unit x-height (baseline y=0, x-height y=-1); mirrored afterwards
  const GL = {
    o: [[0.7, -0.95], [0.3, -0.92], [0.06, -0.45], [0.3, 0.02], [0.72, -0.35], [0.7, -0.95], [0.95, -0.85]],
    a: [[0.78, -0.82], [0.35, -0.95], [0.05, -0.42], [0.28, 0.02], [0.72, -0.45], [0.82, -0.98], [0.76, -0.2], [0.98, 0.0]],
    e: [[0.08, -0.38], [0.66, -0.62], [0.48, -0.97], [0.1, -0.6], [0.2, -0.02], [0.82, -0.18]],
    c: [[0.72, -0.82], [0.42, -0.97], [0.08, -0.52], [0.26, 0.0], [0.78, -0.14]],
    i: [[0.02, -0.84], [0.22, -1.0], [0.18, -0.22], [0.32, 0.0], [0.5, -0.18]],
    n: [[0.0, -0.8], [0.16, -1.0], [0.14, 0.0], [0.2, -0.62], [0.52, -1.0], [0.74, -0.72], [0.7, -0.12], [0.92, 0.0]],
    m: [[0.0, -0.8], [0.14, -1.0], [0.12, 0.0], [0.18, -0.65], [0.44, -1.0], [0.6, -0.75], [0.58, 0.0], [0.64, -0.65], [0.9, -1.0], [1.08, -0.72], [1.04, -0.1], [1.26, 0.0]],
    u: [[0.0, -0.86], [0.1, -0.98], [0.1, -0.2], [0.38, 0.02], [0.68, -0.5], [0.7, -1.0], [0.7, -0.12], [0.9, 0.0]],
    r: [[0.0, -0.82], [0.15, -1.0], [0.14, 0.0], [0.22, -0.7], [0.5, -1.0], [0.68, -0.86]],
    l: [[0.0, -0.55], [0.42, -1.75], [0.36, -2.15], [0.14, -1.7], [0.16, -0.12], [0.4, 0.0], [0.58, -0.22]],
    d: [[0.74, -0.8], [0.34, -0.96], [0.06, -0.42], [0.28, 0.02], [0.7, -0.5], [0.86, -2.0], [0.76, -2.1], [0.74, -0.2], [0.98, 0.0]],
    b: [[0.0, -0.5], [0.36, -1.9], [0.24, -2.15], [0.12, -1.7], [0.12, -0.1], [0.46, 0.02], [0.74, -0.5], [0.5, -0.98], [0.16, -0.7]],
    h: [[0.0, -0.5], [0.36, -1.9], [0.24, -2.15], [0.12, -1.7], [0.12, 0.0], [0.2, -0.62], [0.52, -1.0], [0.72, -0.7], [0.7, -0.1], [0.92, 0.0]],
    p: [[0.0, -0.84], [0.2, -1.0], [0.2, 1.05], [0.18, 0.4], [0.2, -0.55], [0.56, -1.0], [0.82, -0.5], [0.5, 0.02], [0.2, -0.22]],
    q: [[0.74, -0.8], [0.34, -0.96], [0.06, -0.42], [0.28, 0.02], [0.7, -0.5], [0.76, -1.0], [0.72, 1.05], [0.9, 0.7]],
    g: [[0.74, -0.8], [0.34, -0.96], [0.06, -0.42], [0.28, 0.02], [0.7, -0.5], [0.76, -1.0], [0.72, 0.8], [0.4, 1.1], [0.15, 0.85], [0.6, 0.4], [0.9, 0.1]],
    s: [[0.0, -0.3], [0.3, -1.4], [0.56, -2.05], [0.82, -2.0], [0.62, -1.7], [0.34, -1.1], [0.2, 0.0], [0.08, 0.95]],
    t: [[0.1, -1.6], [0.12, -0.2], [0.34, 0.02], [0.56, -0.2]],
    v: [[0.0, -0.9], [0.16, -1.0], [0.3, 0.0], [0.56, -0.98], [0.76, -0.9]],
    f: [[0.0, -0.3], [0.3, -1.4], [0.52, -2.05], [0.8, -2.0], [0.62, -1.72], [0.36, -1.1], [0.22, 0.0], [0.1, 0.95]],
    z: [[0.0, -0.9], [0.62, -0.95], [0.04, 0.0], [0.7, 0.0]],
  };
  const GW = { o: 0.92, a: 1.0, e: 0.82, c: 0.78, i: 0.48, n: 0.96, m: 1.3, u: 0.94, r: 0.72, l: 0.6, d: 1.0, b: 0.82, h: 0.96, p: 0.88, q: 0.94, g: 0.94, s: 0.62, t: 0.58, v: 0.8, f: 0.62, z: 0.74 };
  const FREQ = 'eeeeooaaaaiiiinnnrrrllllssttcdduummpqhbgvfz e o a i n'.replace(/ /g, '');
  function makeWord(nl) {
    let w = '';
    for (let i = 0; i < nl; i++) w += FREQ[(R() * FREQ.length) | 0];
    return w;
  }
  /* write a block of mirror-script in pen: lines are right-aligned (they start at the right) */
  function writeBlock(o) {
    // o: x0, x1 (right edge where lines start), y0, lines, xh (x-height), lh (line height), a (ink), mask fn(x,y)->bool allowed
    const xh = o.xh || 3.4, lh = o.lh || xh * 2.7;
    let y = o.y0;
    const sl = o.sl === undefined ? 0.28 : o.sl; // slant (becomes leftward after mirroring)
    for (let li = 0; li < o.lines; li++) {
      const right = o.x1 - rr(0, xh * 1.2) - (li === 0 && o.indent ? xh * 3 : 0);
      const leftLim = (o.lx ? o.lx(li) : o.x0) + rr(0, xh * 4);
      let x = right; // writing proceeds right to left
      let flow = rr(0.75, 1.0);
      const base = y + rs(0.4), drift = rs(0.04);
      let first = true;
      while (x > leftLim + xh * 3) {
        const nl = 2 + ((R() * 7) | 0);
        const word = makeWord(nl);
        let wwid = 0; for (const ch of word) wwid += GW[ch] * xh;
        if (x - wwid < leftLim) break;
        const sc = xh * rr(0.92, 1.08);
        // build glyph point list for the whole word in mirrored space
        let gx = 0; const pts = []; const dots = [], bars = [];
        for (const ch of word) {
          const g = GL[ch];
          for (const p of g) pts.push([gx + (p[0] + rs(0.05)) * sc, (p[1] + rs(0.04)) * sc]);
          if (ch === 'i') dots.push([gx + 0.25 * sc, -1.6 * sc]);
          if (ch === 't' || ch === 'f') bars.push([gx - 0.1 * sc, -1.05 * sc, gx + 0.55 * sc]);
          gx += GW[ch] * sc;
        }
        // mirror: x' = x_right - x ; slant applied after mirror leans left
        const bl = base + (right - x) * drift;
        const mp = (p) => [x - p[0] - p[1] * -sl * -1 * 1 + p[1] * sl * 0, bl + p[1]];
        const tp = pts.map((p) => [x - p[0] + p[1] * sl, bl + p[1]]);
        if (o.mask) { let bad = 0; for (const p of tp) if (!o.mask(p[0], p[1])) bad++; if (bad > tp.length * (o.tol || 0)) { x -= wwid + xh * 0.9; continue; } }
        pen(C(tp, 0.5), { a: (o.a || 0.6) * flow, w: o.w || 0.62 });
        for (const d of dots) { const dx = x - d[0] + d[1] * sl, dy = bl + d[1]; pen([[dx, dy], [dx - 0.4, dy + 0.35]], { a: (o.a || 0.6) * flow, w: (o.w || 0.62) * 1.1 }); }
        for (const b of bars) { const ax = x - b[0] + b[1] * sl, bx = x - b[2] + b[1] * sl, yy = bl + b[1]; pen([[ax, yy], [bx, yy + 0.3]], { a: (o.a || 0.6) * flow * 0.9, w: o.w || 0.62 }); }
        if (R() < 0.12) { // abbreviation stroke over the word
          const ax = x - rr(0.2, 0.5) * wwid, yy = bl - 1.7 * sc;
          pen(C([[ax, yy], [ax - xh * 0.6, yy - 0.4], [ax - xh * 1.3, yy + 0.2]]), { a: (o.a || 0.6) * flow * 0.8, w: o.w || 0.62 });
        }
        flow *= rr(0.93, 0.99);
        if (flow < 0.55 || R() < 0.05) flow = rr(0.9, 1.05); // re-dip the pen
        x -= wwid + xh * rr(0.7, 1.3);
        first = false;
      }
      y += lh * rr(0.97, 1.03);
    }
  }
  // pen stroke: width follows the angle of a slightly oblique nib; ink pools at the start
  const NIB = 0.65;
  function pen(P, o) {
    const n = P.length; if (n < 2) return;
    const w0 = o.w || 0.6, a = o.a || 0.6;
    for (let i = 1; i < n; i++) {
      const dx = P[i][0] - P[i - 1][0], dy = P[i][1] - P[i - 1][1];
      const ang = Math.atan2(dy, dx);
      const wf = 0.38 + 0.62 * Math.abs(Math.sin(ang - NIB));
      const t = i / (n - 1);
      const fl = 1.15 - 0.3 * t;
      seg(1, P[i - 1][0], P[i - 1][1], P[i][0], P[i][1], a * fl, w0 * wf);
    }
  }
  // a single reference letter (pen), not mirrored glyph shapes but mirrored placement
  function letter(ch, x, y, xh, a) {
    const g = GL[ch]; if (!g) return;
    const sc = xh || 5, sl = 0.25;
    const pts = g.map((p) => [x - p[0] * sc + p[1] * sl * sc, y + p[1] * sc]);
    pen(C(pts, 0.5), { a: a || 0.7, w: 0.75 });
    if (ch === 'i') pen([[x - 0.25 * sc - 1.6 * sl * sc, y - 1.6 * sc], [x - 0.25 * sc - 1.6 * sl * sc - 0.5, y - 1.6 * sc + 0.4]], { a: a || 0.7, w: 0.9 });
  }

  /* ------------------------------------------------------------ white heightening: small brush, lead white */
  function white(P0, o) {
    const P = resample(P0, 0.8), n = P.length; if (n < 2) return;
    const w = o.w || 1.2, a = o.a || 0.7;
    const T = tangents(P);
    const ta = o.ta === undefined ? 0.25 : o.ta, tb = o.tb === undefined ? 0.4 : o.tb;
    const L = [], Rr = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const ww = w * (0.15 + 0.85 * sstep(0, ta, t)) * (1 - 0.9 * sstep(1 - tb, 1, t)) * (0.85 + 0.15 * Math.sin(t * 9 + n));
      L.push([P[i][0] + T[i][1] * ww * 0.5, P[i][1] - T[i][0] * ww * 0.5]);
      Rr.push([P[i][0] - T[i][1] * ww * 0.5, P[i][1] + T[i][0] * ww * 0.5]);
    }
    fillPoly(2, L.concat(Rr.reverse()), a);
    // a second, drier pass inside: brush bristles leave a brighter core
    if (o.core !== false) {
      const core = P.map((p, i) => [p[0] - T[i][1] * w * 0.08, p[1] + T[i][0] * w * 0.08]);
      for (let i = 1; i < n; i++) {
        const t = i / (n - 1), f = sstep(0, ta, t) * (1 - sstep(1 - tb, 1, t));
        seg(2, core[i - 1][0], core[i - 1][1], core[i][0], core[i][1], a * 0.6 * f, w * 0.4);
      }
    }
  }
  function dab(x, y, r, a) { white([[x - r * 0.6, y + r * 0.2], [x, y - r * 0.1], [x + r * 0.6, y + r * 0.15]], { w: r * 1.2, a: a || 0.7, ta: 0.4, tb: 0.5, core: false }); }

  /* ======================================================================
   *                         THE MAIN STUDY
   * ==================================================================== */
  // standing-body coords (cm): X lateral (+ toward viewer), Y superior, Z anterior
  const BX = 300, BY = 245, S = 6.2, PHI = (-22 * PI) / 180, PSI = (-21 * PI) / 180;
  const cP = Math.cos(PHI), sP = Math.sin(PHI), cQ = Math.cos(PSI), sQ = Math.sin(PSI);
  function P3(X, Y, Z) { const X1 = X * cP - Z * sP, Z1 = X * sP + Z * cP; const Yp = Y * cQ + X1 * sQ, Xp = X1 * cQ - Y * sQ; return [BX - Yp * S, BY + Z1 * S, Xp]; }
  function N3(nx, ny, nz) { const X1 = nx * cP - nz * sP, Z1 = nx * sP + nz * cP; return [-ny, Z1, X1]; } // to view (sheet x, sheet y, depth)
  const spineZ = (Y) => (Y > 0 ? 0 : Y > -26 ? -2.0 * Math.sin((PI * -Y) / 26) : 2.6 * Math.sin((PI * (-Y - 26)) / 18));
  const TV = []; for (let i = 0; i < 12; i++) TV.push(-1.0 - i * 2.27);   // thoracic body centres (Y)
  const LV = []; for (let i = 0; i < 5; i++) LV.push(-28.6 - i * 3.45);  // lumbar

  function thoraxGeometry() {
    const A = [5.4, 8.0, 10.0, 11.5, 12.6, 13.3, 13.7, 13.8, 13.6, 13.0, 12.0, 10.4];
    const Bd = [10.8, 13.0, 14.6, 15.6, 16.6, 17.2, 17.7, 17.9, 17.7, 17.0, 15.6, 13.4];
    const ZB = [-2.4, -3.1, -3.4, -3.6, -3.7, -3.8, -3.8, -3.8, -3.7, -3.6, -3.4, -3.0];
    const DB = [3.4, 5.4, 6.9, 8.3, 9.3, 10.2, 10.8, 11.0, 10.8, 10.2, 8.6, 6.6];
    const END = [9.0, 9.0, 9.0, 8.9, 8.8, 8.7, 8.55, 8.3, 7.95, 7.5, 6.3, 4.6];
    const HB = [1.35, 1.0, 1.04, 1.1, 1.14, 1.18, 1.2, 1.18, 1.12, 1.04, 0.9, 0.78];
    const TPL = [[0.08, 0.21], [0.2, 0.06], [0.38, 0.0], [0.62, 0.04], [0.84, 0.16], [0.97, 0.34], [1.0, 0.52], [0.93, 0.7], [0.78, 0.84], [0.58, 0.94], [0.34, 0.99], [0.1, 1.0]];
    const YATT = [-5.2, -7.3, -9.5, -11.7, -13.9, -16.2, -18.6];
    const zSt = (Y) => lerp(8.4, 13.4, clamp((-Y - 4.2) / 15.5, 0, 1));
    const ribs = [];
    for (let i = 0; i < 12; i++) {
      const yv = TV[i] + 0.55, zs = spineZ(TV[i]);
      const ctrl = [];
      const e = END[i];
      for (let k = 0; k <= Math.ceil(e); k++) {
        const kk = Math.min(k, e), k0 = Math.floor(kk), f = kk - k0;
        const p0 = TPL[k0], p1 = TPL[Math.min(TPL.length - 1, k0 + 1)];
        const xn = lerp(p0[0], p1[0], f), zn = lerp(p0[1], p1[1], f);
        const u = kk / 9;
        const g = 0.1 * u + 0.9 * Math.pow(sstep(0.06, 1.02, u), 1.15) - 0.05 * Math.sin(u * PI) * (1 - u);
        ctrl.push([A[i] * xn, yv - DB[i] * g, zs + ZB[i] + Bd[i] * zn]);
        if (kk === e) break;
      }
      // dense 3D centreline
      const c3 = [];
      for (let k = 0; k < ctrl.length - 1; k++) {
        const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
        for (let s = 0; s < 8; s++) {
          const t = s / 8, t2 = t * t, t3 = t2 * t;
          const q = [0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
          c3.push(q);
        }
      }
      c3.push(ctrl[ctrl.length - 1]);
      // cartilage (3D)
      let cart = null;
      const end = c3[c3.length - 1];
      if (i < 7) {
        const ya = YATT[i], za = zSt(ya);
        const mid = [lerp(end[0], 1.6, 0.55), lerp(end[1], ya, 0.7) - (i > 3 ? 0.6 : 0), lerp(end[2], za, 0.6) + 0.4];
        cart = [end, mid, [1.5, ya, za]];
      } else if (i < 10) {
        const tgt = ribs[i - 1].cart3 ? ribs[i - 1].cart3 : null;
        const tp = tgt ? tgt[Math.max(0, tgt.length - 2 - (i - 7))] : end;
        cart = [end, [lerp(end[0], tp[0], 0.5) + 0.3, lerp(end[1], tp[1], 0.5) - 0.8, lerp(end[2], tp[2], 0.5) + 0.3], tp];
      }
      const hb = HB[i];
      const hw = (u) => hb * (0.45 + 0.55 * sstep(0, 0.28, u)) * (1 + 0.18 * sstep(0.55, 0.95, u)) * (i >= 10 ? 1 - 0.65 * sstep(0.55, 1, u) : 1) * 0.5;
      const sideP = (sgn) => c3.map((q, k) => { const u = k / (c3.length - 1); return P3(sgn * q[0], q[1] + hw(u), q[2]); });
      const sideQ = (sgn) => c3.map((q, k) => { const u = k / (c3.length - 1); return P3(sgn * q[0], q[1] - hw(u), q[2]); });
      const r = { i, c3, cart3: cart ? dens3(cart) : null };
      for (const sgn of [1, -1]) {
        const up = sideP(sgn), lo = sideQ(sgn);
        const key = sgn > 0 ? 'near' : 'far';
        r[key] = { up, lo, poly: up.concat(rev(lo)), mid: c3.map((q) => P3(sgn * q[0], q[1], q[2])) };
        if (r.cart3) {
          const cw = 0.55;
          const cu = r.cart3.map((q) => P3(sgn * q[0], q[1] + cw, q[2])), cl = r.cart3.map((q) => P3(sgn * q[0], q[1] - cw, q[2]));
          r[key].cart = { up: cu, lo: cl, poly: cu.concat(rev(cl)), mid: r.cart3.map((q) => P3(sgn * q[0], q[1], q[2])) };
        }
      }
      ribs.push(r);
    }
    // sternum plate
    const st = [];
    const stW = (Y) => pwl([[4.0, 2.2], [4.6, 2.75], [6.0, 2.5], [8.3, 1.75], [8.8, 1.6], [10.5, 1.45], [14, 1.62], [17.5, 1.75], [19.4, 1.5], [20.2, 0.9], [21.6, 0.55], [22.8, 0.12]], -Y, 1);
    const stTop = [], stBot = [];
    for (let k = 0; k <= 60; k++) { const Y = -4.0 - (k / 60) * 18.8; const z = zSt(Y) + 0.45; stTop.push(P3(stW(Y), Y, z)); stBot.push(P3(-stW(Y), Y, z + 0.1)); }
    const notch = [P3(-2.2, -4.0, zSt(-4) + 0.5), P3(-1.0, -4.25, zSt(-4) + 0.5), P3(0, -4.7, zSt(-4.5) + 0.5), P3(1.0, -4.25, zSt(-4) + 0.5), P3(2.2, -4.0, zSt(-4) + 0.5)];
    const ridges = [-8.6, -11.2, -13.8, -16.4, -19.3].map((Y) => [P3(stW(Y) * 0.9, Y, zSt(Y) + 0.5), P3(0, Y - 0.15, zSt(Y) + 0.5), P3(-stW(Y) * 0.9, Y, zSt(Y) + 0.6)]);
    const sternum = { a: stTop, b: stBot, poly: notch.slice(1).concat(stTop.slice(1)).concat(rev(stBot.slice(1))), notch, ridges };
    return { ribs, sternum, zSt };
  }
  function dens3(ctrl) {
    const out = [];
    for (let k = 0; k < ctrl.length - 1; k++) {
      const p0 = ctrl[Math.max(0, k - 1)], p1 = ctrl[k], p2 = ctrl[k + 1], p3 = ctrl[Math.min(ctrl.length - 1, k + 2)];
      for (let s = 0; s < 10; s++) {
        const t = s / 10, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map((d) => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
      }
    }
    out.push(ctrl[ctrl.length - 1]);
    return out;
  }
  /*@@RENDER@@*/
  // a serrated suture: a fine zig-zag riding on a wandering path
  function suture(P0, amp, fade) {
    const P = resample(P0, 0.7), T = tangents(P), out = [];
    let ph = R() * 6;
    for (let i = 0; i < P.length; i++) {
      ph += rr(0.7, 1.5);
      const a = amp * (0.5 + 0.5 * Math.abs(Math.sin(i * 0.13 + ph * 0.05))) * Math.sin(ph);
      out.push([P[i][0] + T[i][1] * a, P[i][1] - T[i][0] * a]);
    }
    contour(out, { a: 0.3, side: 0, w: 0.38, seg: 14, jit: 0.1, trem: 0.05, fade });
  }
  // fast arc-length lookup along a polyline
  function LUT(P0) {
    const P = resample(P0, 1.0), T = tangents(P), n = P.length;
    const f = (s) => { const x = clamp(s, 0, n - 1.001), i = x | 0, u = x - i; return i; };
    return {
      n, L: n - 1,
      pt: (s) => { const x = clamp(s, 0, n - 1.0001), i = x | 0, u = x - i; return [lerp(P[i][0], P[i + 1][0], u), lerp(P[i][1], P[i + 1][1], u)]; },
      tan: (s) => { const x = clamp(s, 0, n - 1.0001), i = x | 0, u = x - i; return norm2(lerp(T[i][0], T[i + 1][0], u), lerp(T[i][1], T[i + 1][1], u)); },
    };
  }
  function pwl(tab, s, k) { // piecewise-linear table lookup: tab rows [s, v1, v2...]
    if (s <= tab[0][0]) return tab[0][k];
    for (let i = 1; i < tab.length; i++) if (s <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return lerp(a[k], b[k], sstep(0, 1, (s - a[0]) / (b[0] - a[0])) * 0.5 + 0.5 * ((s - a[0]) / (b[0] - a[0]))); }
    return tab[tab.length - 1][k];
  }

  // hatching that wraps round a cylinder: strokes across the axis, bowed, on the side turned from the light
  function cylHatch(axis, wfn, o) {
    o = o || {};
    const A = resample(axis, 1), T = tangents(A), n = A.length;
    let sideSum = 0; for (let i = 0; i < n; i++) sideSum += T[i][1] * LX - T[i][0] * LY;
    const sg = sideSum > 0 ? -1 : 1; // +u points away from the light
    for (let i = 1; i < n - 1; i += 1) {
      if (R() < 0.08) continue;
      const t = i / (n - 1), w = wfn(t); if (w < 1) continue;
      const nx = T[i][1] * sg, ny = -T[i][0] * sg, tx = T[i][0], ty = T[i][1];
      const u0 = rr(-0.35, 0.05), bow = (o.bow || 0.35) * w, pts = [];
      for (let k = 0; k <= 8; k++) { const u = lerp(1, u0, k / 8), q = A[i]; pts.push([q[0] + nx * u * w * 0.96 + tx * bow * (1 - u * u), q[1] + ny * u * w * 0.96 + ty * bow * (1 - u * u)]); }
      const tone = (x, y) => 1;
      stroke(pts, { a: (o.a || 0.34) * rr(0.75, 1.15), w: 0.3, pt: 'h', step: 1.6, trem: 0.05, prof: (q) => { const u = lerp(1, u0, q); return (sstep(-0.3, 0.55, u) * (1 - 0.45 * sstep(0.82, 1, u))) * (q < 0.06 ? q / 0.06 : 1); } });
    }
  }
  function whiteHatch(F, tone, o) {
    o = o || {};
    hatch(F, tone, { ch: 2, ang: o.ang === undefined ? -38 : o.ang, sp: (o.sp || 1.5) * 0.85, a: Math.min(1, (o.a || 0.5) * 1.35), len: o.len || [3, 9], w: o.w || 0.75, t0: 0.05, bend: 0.02, trem: 0.05 });
  }

  /* ------------------------------------------------------------ bone helpers */
  const norm2 = (x, y) => { const l = hyp(x, y) || 1; return [x / l, y / l]; };
  function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; }
  const closeP = (P) => P.concat([P[0]]);
  function VF(c, dir, sc) { const ex = dir[0], ey = dir[1], dx = ey, dy = -ex; return (P) => P.map((p) => [c[0] + (ex * p[0] + dx * p[1]) * sc, c[1] + (ey * p[0] + dy * p[1]) * sc]); }
  function pip(polys) {
    const bbs = polys.map((P) => bbox([P]));
    return (p) => {
      const x = p[0], y = p[1];
      for (let k = 0; k < polys.length; k++) {
        const b = bbs[k]; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
        const P = polys[k]; let c = false;
        for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
          if ((P[i][1] > y) !== (P[j][1] > y) && x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
        }
        if (c) return true;
      }
      return false;
    };
  }
  // visibility: hidden if inside any of the occluding masks / polygon sets
  function hider(list) { return (p) => { for (const o of list) { if (!o) continue; if (o.in ? o.in(p[0], p[1]) : o(p)) return 0; } return 1; }; }
  function outline(P, o) {
    o = o || {};
    const side = area(P) > 0 ? 1 : -1;
    contour(closeP(P), Object.assign({ side }, o));
  }
  function bone(P, o) {
    o = o || {};
    const F = Form([P], o.sub || [], { blur: o.blur || 2.5, res: o.res || 1.8 });
    const base = o.base === undefined ? 0.08 : o.base, amp = o.amp === undefined ? 0.5 : o.amp, k = o.k === undefined ? 0.85 : o.k;
    const bb = bbox([P]), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, rad = Math.max(4, hyp(bb[2] - bb[0], bb[3] - bb[1]) / 2), gr = o.g || 0;
    const gr2 = o.g === undefined ? 0.3 : gr;
    const tone = o.tone ? (x, y) => o.tone(x, y, F) : (x, y) => 0.05 + 1.3 * (base + amp * clamp(k - F.lam(x, y, o.lk || 1), 0, 1) + gr2 * clamp(((x - cx) * 0.62 + (y - cy) * 0.78) / rad * 0.8 + 0.4, 0, 1));
    if (!o.noShade && F.area > 1) shade(F, tone, { a: o.a || 0.42, sp: o.sp || 1.9, layers: o.layers || 2, len: o.len || [5, 12], ang: o.ang });
    if (!o.noLine) outline(P, { a: o.la || 0.55, w: o.lw || 0.5, re: o.re === undefined ? 0.25 : o.re, fade: o.fade, seg: o.seg || 26, lit: o.lit });
    return F;
  }
  const xy = (P) => P.map((p) => [p[0], p[1]]);

  /* ------------------------------------------------------------ the spine */
  function spineData() {
    const V = [];
    const dirAt = (Y) => { const a = P3(0, Y + 0.4, spineZ(Y + 0.4)), b = P3(0, Y - 0.4, spineZ(Y - 0.4)); return norm2(b[0] - a[0], b[1] - a[1]); };
    const CV = [[241.5, 222.5], [248.2, 230.6], [256.2, 237.8], [265.2, 243.0], [275.0, 246.0], [285.4, 247.0], [295.8, 246.0]];
    for (let i = 0; i < 7; i++) {
      const c = CV[i], nb = CV[Math.min(6, i + 1)], pb = CV[Math.max(0, i - 1)];
      V.push({ t: 'C', i, c, dir: norm2(nb[0] - pb[0], nb[1] - pb[1]), h: i === 1 ? 1.45 : 1.2, d: 1.5 + i * 0.06 });
    }
    for (let i = 0; i < 12; i++) {
      const Y = TV[i], p = P3(0, Y, spineZ(Y));
      V.push({ t: 'T', i, c: [p[0], p[1]], dir: dirAt(Y), h: lerp(1.55, 2.25, i / 11), d: lerp(1.75, 2.8, i / 11),
        spA: ([30, 40, 50, 58, 62, 64, 64, 62, 56, 46, 36, 26][i] * PI) / 180, spL: [3.0, 3.3, 3.5, 3.7, 3.8, 3.8, 3.8, 3.7, 3.4, 3.0, 2.7, 2.5][i] });
    }
    for (let i = 0; i < 5; i++) {
      const Y = LV[i], p = P3(0, Y, spineZ(Y));
      V.push({ t: 'L', i, c: [p[0], p[1]], dir: dirAt(Y), h: [2.55, 2.7, 2.8, 2.85, 2.7][i], d: [3.1, 3.3, 3.45, 3.5, 3.4][i] });
    }
    const L5 = V[V.length - 1];
    const path = C([L5.c, [590, 250.2], [642, 254.5], [700, 268.5], [753, 295], [798, 333], [833, 381], [855, 435], [865, 488], [868, 520]], 1.0);
    const total = plen(path);
    let s = (2.7 / 2 + 0.5) * S, k = 0;
    while (k < 60) {
      const l = k === 0 ? 2.6 : k === 1 ? 2.35 : 2.25 * (1 - 0.58 * Math.pow((k - 2) / 34, 1.15));
      const gap = k < 2 ? 0.42 : 0.26 * (l / 2.25) + 0.07;
      const c0 = s + (l * S) / 2;
      if (c0 + (l * S) / 2 > total - 4) break;
      const p = at(path, c0 / total), q = at(path, Math.min(1, (c0 + 2) / total)), q0 = at(path, Math.max(0.0001, (c0 - 2) / total));
      V.push({ t: k < 2 ? 'S' : 'Ca', i: k, c: p, dir: norm2(q[0] - q0[0], q[1] - q0[1]), h: l, d: k < 2 ? [2.9, 2.5][k] : Math.max(0.8, l * 0.92), s: c0 });
      s = c0 + (l * S) / 2 + gap * S;
      k++;
    }
    return { V, path, total };
  }
  const rrect = (h, d, w) => CC([[-h / 2 + 0.22, -d / 2], [0, -d / 2 + w], [h / 2 - 0.22, -d / 2], [h / 2 + 0.05, -d / 2 + 0.26], [h / 2 - 0.02, 0], [h / 2 + 0.04, d / 2 - 0.22], [h / 2 - 0.22, d / 2], [0, d / 2 + 0.02], [-h / 2 + 0.22, d / 2], [-h / 2 - 0.04, d / 2 - 0.22], [-h / 2 + 0.02, 0], [-h / 2 - 0.05, -d / 2 + 0.26]], 0.12);
  function spinous(base, ang, L, w0, w1) {
    const sx = Math.sin(ang), sy = Math.cos(ang), px = sy, py = -sx;
    const tip = [base[0] + sx * L, base[1] + sy * L];
    return { a: [base[0] - px * w0, base[1] - py * w0], tipA: [tip[0] - px * w1, tip[1] - py * w1], tip: [tip[0] + sx * w1 * 0.9, tip[1] + sy * w1 * 0.9], tipB: [tip[0] + px * w1, tip[1] + py * w1], b: [base[0] + px * w0, base[1] + py * w0] };
  }
  // vertebra parts in local cm (u toward the tail, v dorsal)
  function vParts(V) {
    const h = V.h, d = V.d, b0 = d / 2, out = { lines: [], dark: [] };
    if (V.t === 'T') {
      out.body = rrect(h, d, 0.13);
      const sp = spinous([0.35, b0 + 1.7], V.spA, V.spL, 0.48, 0.24);
      out.arch = CC([[-h / 2 + 0.2, b0 - 0.1], [-h / 2 + 0.12, b0 + 0.7], [-h / 2 - 0.38, b0 + 1.0], [-h / 2 - 0.45, b0 + 1.38], [-h / 2 - 0.05, b0 + 1.62], sp.a, sp.tipA, sp.tip, sp.tipB, sp.b, [h / 2 + 0.5, b0 + 1.3], [h / 2 + 0.55, b0 + 0.9], [h / 2 + 0.1, b0 + 0.8], [-h / 2 + 1.0, b0 + 0.72], [-h / 2 + 0.9, b0 - 0.1]], 0.12);
      out.tp = ellipse(-0.05, b0 + 1.3, 0.62, 0.55, 0, 24);
    } else if (V.t === 'L' || V.t === 'S') {
      const sac = V.t === 'S';
      out.body = rrect(h, d, 0.18);
      const top = sac ? b0 + 2.6 - V.i * 0.6 : b0 + 4.3;
      out.arch = CC([[-h / 2 + 0.25, b0 - 0.1], [-h / 2 + 0.2, b0 + 0.85], [-h / 2 - 0.45, b0 + 1.15], [-h / 2 - 0.55, b0 + 1.7], [-h / 2 - 0.15, b0 + 1.95], [-0.55, b0 + 2.0], [-0.8, top - 1.4], [-0.85, top - 0.2], [-0.55, top + 0.12], [0.65, top + 0.15], [1.15, top - 0.15], [1.05, top - 1.0], [0.9, b0 + 2.2], [h / 2 + 0.45, b0 + 1.85], [h / 2 + 0.7, b0 + 1.35], [h / 2 + 0.25, b0 + 1.0], [-h / 2 + 1.35, b0 + 0.9], [-h / 2 + 1.25, b0 - 0.1]], 0.12);
      out.tp = sac ? CC([[-1.2, b0 - 0.4], [-0.2, b0 - 0.9], [1.3, b0 - 0.5], [1.6, b0 + 0.7], [0.8, b0 + 1.5], [-0.9, b0 + 1.3]], 0.12) : ellipse(0.0, b0 + 1.15, 0.85, 0.6, 0.15, 24);
      out.dark.push(ellipse(h / 2 + 0.25, b0 + 0.5, 0.36, 0.42, 0, 16));
    } else if (V.t === 'C') {
      if (V.i === 0) { // atlas
        out.body = ellipse(0.1, -b0 + 0.35, 0.5, 0.55, 0, 20);
        out.arch = CC([[-0.5, -0.2], [0.1, -0.5], [0.7, -0.1], [0.8, 0.6], [0.55, b0 + 0.6], [0.4, b0 + 1.4], [0.2, b0 + 1.8], [-0.2, b0 + 1.7], [-0.25, b0 + 1.2], [-0.05, b0 + 0.5], [-0.6, 0.5]], 0.1);
        out.tp = ellipse(0.1, 0.35, 0.7, 0.55, 0.3, 20);
      } else {
        out.body = rrect(h, d, 0.1);
        const L = V.i === 6 ? 2.5 : V.i === 1 ? 1.8 : 1.15 + V.i * 0.1, ang = ((V.i === 6 ? 30 : V.i === 1 ? 10 : 18) * PI) / 180;
        const sp = spinous([0.15, b0 + 1.3], ang, L, 0.35, V.i === 6 ? 0.22 : 0.17);
        out.arch = CC([[-h / 2 + 0.15, b0 - 0.08], [-h / 2 + 0.1, b0 + 0.45], [-h / 2 - 0.25, b0 + 0.55], [-h / 2 - 0.3, b0 + 1.05], sp.a, sp.tipA, sp.tip, sp.tipB, sp.b, [h / 2 + 0.3, b0 + 1.15], [h / 2 + 0.38, b0 + 0.6], [-h / 2 + 0.75, b0 + 0.45], [-h / 2 + 0.7, b0 - 0.08]], 0.1);
        out.tp = CC([[-0.45, b0 - 0.55], [0.25, b0 - 0.7], [0.55, b0 - 0.2], [0.3, b0 + 0.3], [-0.4, b0 + 0.25]], 0.1);
        if (V.i === 1) out.lines.push([[-h / 2, -0.3], [-h / 2 - 0.8, -0.2], [-h / 2 - 0.95, 0.12], [-h / 2 - 0.1, 0.35]]);
        out.dark.push(ellipse(h / 2 + 0.15, b0 + 0.25, 0.18, 0.22, 0, 12));
      }
    } else { // caudal: amphicoelous centrum, neural and haemal arches
      const l = h, hc = d, k = V.i;
      const wa = 0.11 * hc;
      out.body = CC([[-l / 2, -hc / 2], [0, -hc / 2 + wa], [l / 2, -hc / 2], [l / 2 + 0.03 * l, 0], [l / 2, hc / 2], [0, hc / 2 - wa], [-l / 2, hc / 2], [-l / 2 - 0.03 * l, 0]], 0.08);
      const f = clamp((k - 2) / 38, 0, 1);
      const nsL = (2.9 * (1 - f) + 0.35) * (k < 4 ? 0.75 + 0.08 * k : 1), nsA = ((38 + 30 * f) * PI) / 180;
      const sp = spinous([-0.02 * l, hc / 2 + 0.28 * l], nsA, nsL, 0.24 * l, 0.07 * l + 0.05);
      out.arch = CC([[-0.36 * l, hc / 2 - 0.05], [-0.52 * l, hc / 2 + 0.26 * l], [-0.3 * l, hc / 2 + 0.25 * l], sp.a, sp.tipA, sp.tip, sp.tipB, sp.b, [0.5 * l, hc / 2 + 0.2 * l], [0.3 * l, hc / 2 - 0.05]], 0.08);
      if (k >= 3) {
        const hs = k === 3 ? 0.5 : k === 4 ? 0.85 : 1;
        const hsL = (2.6 * (1 - f) + 0.3) * hs, hsA = ((42 + 28 * f) * PI) / 180;
        const s2 = spinous([-0.02 * l, -hc / 2 - 0.26 * l], PI - hsA, hsL, 0.22 * l, 0.07 * l + 0.04);
        out.haem = CC([[-0.3 * l, -hc / 2 + 0.05], [-0.36 * l, -hc / 2 - 0.2 * l], s2.b, s2.tipB, s2.tip, s2.tipA, s2.a, [0.38 * l, -hc / 2 - 0.16 * l], [0.3 * l, -hc / 2 + 0.05]], 0.08);
      }
      out.rings = [0.62, 0.36].map((r) => CC([[-l / 2 * r, -hc / 2 * r * 0.9], [l / 2 * r, -hc / 2 * r * 0.9], [l / 2 * r, hc / 2 * r * 0.9], [-l / 2 * r, hc / 2 * r * 0.9]], 0.08));
    }
    return out;
  }

  /* ------------------------------------------------------------ the skull (local cm, facing left, origin at the ear) */
  const SK = { cond: [0.3, 2.5], anchor: [238.8, 219.1], th: (-39 * PI) / 180 };
  function sk(P) {
    const c = Math.cos(SK.th), s = Math.sin(SK.th);
    return P.map((p) => { const yy = p[1] < -2 ? -2 + (p[1] + 2) * 0.93 : p[1], xx = p[0] > 3 ? 3 + (p[0] - 3) * 0.95 : p[0]; const x = (xx - SK.cond[0]) * S, y = (yy - SK.cond[1]) * S; return [SK.anchor[0] + x * c - y * s, SK.anchor[1] + x * s + y * c]; });
  }
  const SKD = {
    vault: [[-9.0, -2.6], [-9.45, -3.6], [-9.32, -5.0], [-8.85, -6.6], [-7.9, -8.2], [-6.6, -9.6], [-5.0, -10.7], [-2.8, -11.6], [-0.5, -12.0], [1.8, -11.8], [3.9, -11.0], [5.6, -9.8], [6.9, -8.3], [7.8, -6.5], [8.3, -4.6], [8.1, -3.0], [7.4, -1.9], [6.4, -0.9], [5.0, 0.0], [3.8, 0.6], [2.6, 0.95]],
    craniumClose: [[1.4, 2.7], [0.6, 1.6], [0.1, 0.65], [-0.5, -0.6], [-1.5, -0.35], [-3.0, -0.15], [-4.5, -0.05], [-5.6, -0.3], [-6.2, -0.6], [-6.7, -2.8], [-7.2, -2.95], [-7.6, -3.3], [-8.4, -3.45], [-9.0, -3.2]],
    orbit: [[-7.2, -2.9], [-7.6, -3.3], [-8.4, -3.45], [-9.0, -3.2], [-9.2, -2.6], [-9.3, -1.7], [-9.25, -0.8], [-8.9, -0.2], [-8.2, 0.1], [-7.4, -0.3], [-7.05, -1.2], [-7.05, -2.2]],
    zyg: [[-7.2, -2.95], [-6.7, -2.8], [-6.35, -1.6], [-6.2, -0.6], [-5.6, -0.3], [-6.0, 1.4], [-7.0, 2.0], [-8.0, 1.6], [-8.4, 0.9], [-8.2, 0.1], [-7.4, -0.3], [-7.05, -1.2], [-7.05, -2.2]],
    arch: [[-0.5, -0.6], [-1.5, -0.35], [-3.0, -0.15], [-4.5, -0.05], [-5.7, -0.3], [-6.1, 1.35], [-5.2, 1.0], [-4.0, 0.85], [-2.5, 0.75], [-1.2, 0.55], [-0.75, 0.3]],
    gap: [[-1.25, 0.55], [-1.45, 0.95], [-2.3, 1.75], [-3.3, 0.95], [-2.5, 0.75]],
    maxilla: [[-8.2, 0.1], [-8.4, 0.9], [-8.0, 1.6], [-7.0, 2.0], [-6.0, 1.4], [-5.3, 1.7], [-4.6, 2.6], [-4.3, 3.8], [-5.5, 3.95], [-7.2, 4.05], [-8.7, 4.0], [-9.6, 3.9], [-9.65, 3.2], [-9.9, 2.5], [-10.4, 2.2], [-9.9, 2.0], [-9.55, 1.5], [-9.55, 0.8], [-9.85, 0.0], [-10.2, -0.5], [-9.75, -1.0], [-9.3, -1.9], [-9.0, -2.6], [-9.2, -2.6], [-9.3, -1.7], [-9.25, -0.8], [-8.9, -0.2]],
    nasal: [[-9.0, -2.6], [-9.3, -1.9], [-9.75, -1.0], [-10.22, -0.5], [-9.95, -0.42], [-9.55, -0.95], [-9.3, -1.6], [-9.15, -2.3]],
    nasalCav: [[-10.2, -0.5], [-9.85, 0.0], [-9.55, 0.8], [-9.55, 1.5], [-9.9, 2.0], [-10.4, 2.2], [-10.55, 1.2], [-10.45, 0.2]],
    mand: [[-9.2, 5.85], [-9.25, 6.4], [-9.1, 7.0], [-8.9, 7.6], [-8.2, 8.3], [-6.5, 8.2], [-4.5, 7.8], [-2.0, 7.35], [-0.7, 6.8], [-0.3, 6.0], [-0.35, 4.5], [-0.6, 2.8], [-0.85, 1.6], [-0.7, 1.0], [-0.95, 0.72], [-1.4, 0.95], [-2.3, 1.75], [-3.3, 0.95], [-3.55, 1.0], [-3.6, 1.6], [-3.9, 3.2], [-4.3, 4.6], [-4.7, 5.6], [-6.0, 5.85], [-7.8, 5.9]],
    mastoid: [[2.6, 0.95], [2.2, 1.9], [1.45, 2.8], [0.9, 2.5], [0.6, 1.6], [0.9, 0.9], [1.8, 0.7]],
    tline: [[-6.9, -3.0], [-6.0, -5.6], [-4.0, -7.5], [-1.0, -8.5], [2.5, -8.1], [5.0, -6.2], [5.8, -3.8], [5.0, -1.5], [2.8, -0.4], [0.6, -0.4]],
    fossa: [[-6.7, -2.8], [-6.0, -5.6], [-4.0, -7.5], [-1.0, -8.5], [2.5, -8.1], [5.0, -6.2], [5.8, -3.8], [5.0, -1.5], [2.8, -0.4], [0.6, -0.4], [-0.5, -0.6], [-3.0, -0.15], [-5.6, -0.3], [-6.2, -0.6]],
    coronal: [[-2.8, -11.6], [-3.3, -10.0], [-3.9, -8.3], [-4.4, -6.6], [-4.8, -5.0], [-5.3, -3.6]],
    squam: [[-5.2, -3.3], [-4.0, -4.9], [-1.6, -5.5], [0.9, -4.8], [2.5, -3.0], [2.9, -1.2]],
    lambd: [[5.6, -9.8], [5.8, -8.4], [5.9, -7.0], [6.0, -5.4], [5.6, -3.0], [4.4, -0.7]],
    brow: [[-7.3, -3.15], [-7.9, -3.6], [-8.7, -3.75], [-9.2, -3.5]],
  };
  function teeth() {
    const up = [], lo = [];
    const uw = [0.52, 0.5, 0.7, 0.66, 0.64, 1.0, 0.92, 0.8], ul = [1.08, 1.0, 1.15, 0.92, 0.88, 0.85, 0.82, 0.78];
    let x = -9.66;
    for (let i = 0; i < 8; i++) {
      const w = uw[i] * 0.92, top = 3.95 + (i > 4 ? -0.05 * (i - 4) : 0), bot = top + ul[i] * 0.9;
      const cusp = i === 2 ? 0.18 : i > 4 ? 0.06 : 0.03;
      up.push(CC([[x + 0.06, top], [x + w - 0.05, top + 0.02], [x + w, top + 0.45], [x + w - 0.08, bot - 0.06], [x + w * 0.5, bot + cusp], [x + 0.06, bot - 0.04], [x - 0.02, top + 0.4]], 0.06));
      x += w + 0.03;
    }
    const lw = [0.5, 0.5, 0.62, 0.64, 0.64, 1.05, 1.0, 0.9], ll = [0.95, 0.92, 1.0, 0.85, 0.82, 0.78, 0.75, 0.72];
    x = -9.4;
    for (let i = 0; i < 8; i++) {
      const w = lw[i] * 0.92, top = 4.92 + 0.01 * i, bot = top + ll[i] * 0.92;
      lo.push(CC([[x + 0.05, top + 0.05], [x + w * 0.5, top - 0.04], [x + w - 0.05, top + 0.04], [x + w + 0.02, top + 0.4], [x + w - 0.06, bot], [x + 0.06, bot], [x - 0.02, top + 0.45]], 0.06));
      x += w + 0.03;
    }
    return { up, lo };
  }
  function gillArches() {
    const A = [];
    for (let j = 0; j < 4; j++) {
      const d = [0.25 + 0.32 * j, 6.0 + 1.05 * j], m = [-1.0 + 0.35 * j, 8.4 + 0.95 * j], v = [-3.25 + 0.45 * j, 9.2 + 0.85 * j];
      A.push(C([d, [lerp(d[0], m[0], 0.5) + 0.25, lerp(d[1], m[1], 0.5) + 0.2], m, [lerp(m[0], v[0], 0.5), lerp(m[1], v[1], 0.5) + 0.35], v], 0.1));
    }
    return A;
  }

  /* ======================================================================
   *                         THE SATELLITE STUDIES
   * ==================================================================== */
  const frameF = (ox, oy, sc, ang) => { const c = Math.cos(ang), s = Math.sin(ang); return (P) => P.map((p) => [ox + (p[0] * c - p[1] * s) * sc, oy + (p[0] * s + p[1] * c) * sc]); };

  /* ---- the head in profile: eyes closed, wet hair, gill slits behind the jaw */
  async function headStudy(Y) {
    const H = frameF(424, 82, 5.1, -0.06);
    const sil = H(CC([[-8.2, -8.8], [-9.0, -7.0], [-9.45, -5.0], [-9.55, -3.6], [-9.25, -2.7], [-9.7, -1.6], [-10.35, -0.2], [-10.95, 0.95], [-10.9, 1.35], [-10.5, 1.65], [-9.9, 1.8], [-9.95, 2.3], [-10.2, 2.95], [-10.05, 3.35], [-9.75, 3.55], [-9.95, 3.85], [-9.95, 4.3], [-9.6, 4.7], [-9.25, 5.05], [-9.45, 5.7], [-9.4, 6.5], [-8.9, 7.2], [-8.0, 7.5], [-6.2, 7.6], [-4.6, 7.8], [-3.4, 8.4], [-3.2, 9.8], [-3.5, 11.5], [-3.9, 13.0], [5.4, 13.0], [5.0, 10.5], [5.2, 7.5], [5.9, 4.0], [7.2, 1.0], [8.2, -2.0], [8.4, -4.6], [7.4, -7.6], [5.3, -10.0], [2.2, -11.5], [-1.2, -11.7], [-4.5, -10.9], [-6.8, -9.9]], 0.08));
    const profL = H(C([[-8.2, -8.8], [-9.0, -7.0], [-9.45, -5.0], [-9.55, -3.6], [-9.25, -2.7], [-9.7, -1.6], [-10.35, -0.2], [-10.95, 0.95], [-10.9, 1.35], [-10.5, 1.65], [-9.9, 1.8], [-9.95, 2.3], [-10.2, 2.95], [-10.05, 3.35], [-9.75, 3.55], [-9.95, 3.85], [-9.95, 4.3], [-9.6, 4.7], [-9.25, 5.05], [-9.45, 5.7], [-9.4, 6.5], [-8.9, 7.2], [-8.0, 7.5], [-6.2, 7.6], [-4.6, 7.8], [-3.4, 8.4], [-3.2, 9.8], [-3.5, 11.5], [-3.9, 12.6]], 0.08));
    const nape = H(C([[5.1, 12.4], [5.0, 10.5], [5.2, 7.5], [5.9, 4.0], [7.2, 1.0]], 0.1));
    const jaw = H(C([[-8.4, 7.25], [-5.5, 6.85], [-2.2, 5.9], [-1.1, 5.0], [-0.7, 3.2]], 0.1));
    const F = Form([sil], [], { blur: 11, res: 1.2 });
    const eyeC = H([[-7.6, -1.6]])[0], underJaw = Form([H(CC([[-8.6, 7.3], [-5.5, 6.95], [-2.2, 6.0], [-1.1, 5.1], [0.5, 6.0], [0.8, 9.0], [-3.2, 9.0], [-3.4, 8.4], [-4.6, 7.8], [-6.2, 7.6], [-8.0, 7.5]], 0.1))], [], { blur: 4, res: 1 });
    const hairM = Form([H(CC([[-8.4, -8.6], [-7.0, -10.2], [-4.5, -11.4], [-1.2, -12.3], [2.4, -12.0], [5.6, -10.5], [7.9, -7.9], [9.0, -4.6], [8.8, -1.5], [7.8, 1.2], [6.6, 0.8], [7.3, -2.0], [7.2, -4.6], [6.2, -7.4], [4.6, -9.2], [2.0, -10.4], [-1.2, -10.6], [-4.4, -9.8], [-6.8, -8.8]], 0.1))], [], { blur: 3, res: 1 });
    const tone = (x, y) => {
      const lam = F.lam(x, y, 1.3);
      let t = 0.02 + 0.5 * clamp(0.9 - lam, 0, 1);
      t += 0.32 * sstep(9, 2, hyp((x - eyeC[0]) * 0.9, (y - eyeC[1]) * 1.3));
      t += 0.65 * underJaw.height(x, y);
      t += 0.22 * sstep(380, 470, x) * sstep(40, 140, y);
      return t * (1 - 0.8 * hairM.height(x, y));
    };
    shade(F, tone, { a: 0.4, sp: 1.5, layers: 3, len: [7, 16], ang: 56 });
    flush(); await Y();
    contour(profL, { a: 0.62, side: 1, w: 0.52, re: 0.5, seg: 22 });
    contour(nape, { a: 0.5, side: -1, w: 0.5, seg: 20 });
    contour(jaw, { a: 0.3, side: 0, w: 0.45, seg: 18 });
    // a pentimento: the nose was first drawn longer, the brow lower
    contour(H(C([[-9.3, -2.7], [-9.9, -1.4], [-10.75, 0.2], [-11.4, 1.2], [-10.8, 1.75]], 0.1)), { a: 0.16, side: 0, w: 0.42, jit: 0.4 });
    // the closed eye, brow, nostril, mouth
    contour(H(C([[-8.7, -1.38], [-8.1, -1.22], [-7.4, -1.22], [-6.6, -1.5]], 0.05)), { a: 0.62, side: 0, w: 0.5 });
    contour(H(C([[-8.55, -1.75], [-7.7, -2.2], [-6.9, -2.1], [-6.4, -1.75]], 0.05)), { a: 0.32, side: 0, w: 0.44 });
    for (let k = 0; k < 9; k++) { const t = k / 8, b = at(H(C([[-8.7, -1.38], [-8.1, -1.22], [-7.4, -1.22], [-6.6, -1.5]], 0.05)), 0.08 + t * 0.84); stroke([b, [b[0] - 1.6 + t * 0.4, b[1] + 1.4]], { a: 0.4, w: 0.42, pt: 'h' }); }
    for (let k = 0; k < 16; k++) { const t = k / 15, b = at(H(C([[-9.0, -3.2], [-7.8, -3.62], [-6.3, -3.35]], 0.05)), t); stroke([b, [b[0] + 2.2, b[1] - 0.6 + rs(0.4)]], { a: 0.32, w: 0.4, pt: 'h' }); }
    contour(H(C([[-10.15, 1.0], [-9.7, 0.55], [-9.25, 0.95], [-9.35, 1.5], [-9.8, 1.65]], 0.05)), { a: 0.5, side: 0, w: 0.46 });
    contour(H(C([[-9.4, 1.6], [-9.0, 2.4], [-8.7, 3.3]], 0.05)), { a: 0.16, side: 0, w: 0.42 });
    contour(H(C([[-9.78, 3.55], [-9.3, 3.62], [-8.75, 3.72]], 0.05)), { a: 0.58, side: 0, w: 0.5 });
    // the ear, small and half lost under the hair
    const ear = H(CC([[-0.3, -2.3], [0.7, -2.9], [1.5, -1.7], [1.6, 0.3], [1.0, 1.6], [0.2, 1.55], [-0.25, 0.7]], 0.06));
    bone(ear, { blur: 1.5, base: 0.08, amp: 0.45, a: 0.36, la: 0.45, sub: [] });
    contour(H(C([[0.2, -1.6], [0.9, -1.4], [1.0, -0.2], [0.5, 0.6]], 0.05)), { a: 0.32, side: 0, w: 0.42 });
    // gill slits: four crescents behind the angle of the jaw, each with its flap
    for (let j = 0; j < 4; j++) {
      const top = [0.9 + 1.25 * j, 4.9 + 0.3 * j], bot = [-0.4 + 1.25 * j, 10.4 + 0.25 * j], mid = [lerp(top[0], bot[0], 0.5) + 0.85, lerp(top[1], bot[1], 0.5)];
      const a1 = H(C([top, mid, bot], 0.05)), a2 = H(C([top, [mid[0] + 0.55, mid[1]], bot], 0.05));
      const slit = a1.concat(rev(a2));
      const Fs = Form([slit], [], { res: 2.4, blur: 0.6 });
      shade(Fs, () => 0.85, { a: 0.5, sp: 1.0, layers: 2, len: [2, 5] });
      contour(a1, { a: 0.6, side: 0, w: 0.5 });
      contour(H(C([top, [mid[0] + 1.0, mid[1] - 0.2], bot], 0.05)), { a: 0.3, side: 0, w: 0.44 });
      const fl = H(C([[top[0] + 0.3, top[1] + 0.6], [mid[0] + 1.6, mid[1]], [bot[0] + 0.6, bot[1] - 0.4]], 0.05));
      for (let t = 0.1; t < 0.95; t += 0.14) { const p = at(fl, t), q = at(a2, t); stroke([p, q], { a: 0.26, w: 0.4, pt: 'h' }); }
    }
    flush(); await Y();
    // wet hair, in locks: each lock a bundle of strands, its edges defined, darker in the clefts between
    const LOCKS = [
      { c: [[-8.1, -8.9], [-5.6, -10.7], [-1.5, -11.7], [3.5, -10.9], [7.2, -7.7], [8.9, -3.3], [9.3, 1.4], [9.9, 6.0], [11.2, 10.4], [12.4, 14.2]], w: 1.5 },
      { c: [[-7.9, -7.9], [-5.1, -9.4], [-1.0, -10.2], [3.4, -9.2], [6.3, -6.2], [7.7, -2.1], [8.1, 2.4], [8.7, 7.0], [9.4, 11.6], [9.0, 15.0]], w: 1.4 },
      { c: [[-7.5, -6.7], [-5.0, -7.4], [-2.0, -7.2], [1.4, -5.8], [4.0, -3.5], [6.0, -0.6], [6.8, 3.4], [7.4, 8.0], [7.1, 12.2]], w: 1.15 },
      { c: [[-6.6, -5.9], [-3.6, -5.3], [-1.1, -3.9], [2.3, -2.3], [4.6, 0.9], [5.6, 5.0], [6.0, 9.5], [5.7, 13.2]], w: 0.9 },
      { c: [[-2.2, -11.9], [2.0, -11.9], [5.7, -9.9], [8.1, -6.5], [9.5, -2.1], [10.7, 3.0], [12.5, 7.4], [14.2, 10.8]], w: 1.2 },
      { c: [[0.6, -12.1], [4.2, -11.3], [7.1, -8.5], [8.7, -4.9], [8.9, 0.0], [9.1, 5.0], [10.0, 10.2]], w: 1.1 },
      { c: [[4.2, -11.0], [7.7, -9.4], [9.9, -6.0], [11.1, -1.6], [12.7, 2.0], [15.2, 4.4]], w: 0.7 },
    ];
    for (const Lk of LOCKS) {
      const ax = C(Lk.c, 0.08), T = tangents(ax), n = ax.length;
      const wAt = (t) => Lk.w * (0.55 + 0.45 * Math.sin(Math.min(1, t * 2.2) * PI * 0.5)) * (1 - 0.65 * sstep(0.55, 1, t));
      const ns = Math.round(10 + Lk.w * 6);
      for (let j = 0; j < ns; j++) {
        const u = ns === 1 ? 0 : (j / (ns - 1)) * 2 - 1, edge = Math.abs(u) > 0.78;
        const ph = R() * 6, t0 = rr(0, 0.12), t1 = rr(0.72, 1);
        const pts = [];
        for (let i = Math.round(t0 * (n - 1)); i <= Math.round(t1 * (n - 1)); i += 2) {
          const t = i / (n - 1), w = wAt(t) * (u + 0.12 * Math.sin(t * 9 + ph));
          pts.push([ax[i][0] - T[i][1] * w, ax[i][1] + T[i][0] * w]);
        }
        if (pts.length > 2) stroke(H(pts), { a: (edge ? rr(0.38, 0.52) : rr(0.16, 0.3)), w: edge ? 0.5 : 0.44, pt: 'c', trem: 0.18, prof: ((pr) => (t) => pr(t) * (1 - 0.7 * sstep(0.7, 1, t)))(profile('c')) });
      }
      // the lock's shadowed side, hatched along its length
      const band = H(ax.map((p, i) => [p[0] - T[i][1] * wAt(i / (n - 1)) * 0.2, p[1] + T[i][0] * wAt(i / (n - 1)) * 0.2]).concat(rev(ax.map((p, i) => [p[0] - T[i][1] * wAt(i / (n - 1)) * -1, p[1] + T[i][0] * wAt(i / (n - 1)) * -1]))));
      const Fb = Form([band], [], { res: 1.4, blur: 1.5 });
      shade(Fb, (x, y) => 0.32, { a: 0.3, sp: 1.6, layers: 1, len: [6, 14], ang: 75 });
      Lk.ax = H(ax);
    }
    flush(); await Y();
    // guide lines of the profile canon
    for (const yy of [-8.8, -3.4, 1.8, 7.5]) { const a = H([[-13.5, yy]])[0], b = H([[-10.8 + (yy > 0 ? 0.6 : 0), yy]])[0]; stroke([a, b], { a: 0.2, w: 0.4, pt: 'f' }); }
    stroke(H([[-12.5, -9.5], [-12.4, 8.5]]), { a: 0.14, w: 0.4, pt: 'f' });
    return { locks: LOCKS.map((l) => l.ax), sil, ear: H([[1.0, -0.6]])[0], gill: H([[1.6, 7.0]])[0], forehead: H(C([[-8.6, -8.0], [-9.35, -5.6], [-9.45, -4.2]], 0.1)), nose: H(C([[-9.6, -1.8], [-10.2, -0.5], [-10.65, 0.6]], 0.1)), lip: H(C([[-9.9, 3.95], [-9.7, 4.3]], 0.1)), cheek: H([[-7.0, 0.8]])[0], H };
  }

  /* ---- the webbed hand, back view, its tendons and the web between the fingers */
  async function handStudy(Y) {
    const ang = (-127 * PI) / 180, sc = 9.6;
    const ox = 302, oy = 652;
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = dy, ny = -dx; // y+ toward the little finger (upper right)
    const hp = (x, y) => [ox + (dx * x + nx * y) * sc, oy + (dy * x + ny * y) * sc];
    const HP = (P) => P.map((q) => hp(q[0], q[1]));
    const fingers = [
      { b: [3.0, -1.45], h: [9.2, -2.5], ph: [4.5, 2.65, 1.95], spread: -0.2, w: 1.0 },
      { b: [3.05, -0.45], h: [9.75, -0.8], ph: [5.0, 3.05, 2.15], spread: -0.04, w: 1.03 },
      { b: [3.0, 0.52], h: [9.3, 0.95], ph: [4.7, 2.85, 2.05], spread: 0.13, w: 0.97 },
      { b: [2.9, 1.42], h: [8.35, 2.35], ph: [3.8, 2.25, 1.8], spread: 0.32, w: 0.86 },
      { b: [1.5, -2.0], h: [4.3, -5.0], ph: [3.1, 2.5], spread: -0.42, w: 1.12 },
    ];
    const chains = fingers.map((F) => {
      const pts = [F.b, F.h]; let a = Math.atan2(F.h[1] - F.b[1], F.h[0] - F.b[0]) + F.spread * 0.5, p = F.h;
      for (let k = 0; k < F.ph.length; k++) { a += (k === 0 ? F.spread * 0.5 : 0.05 * Math.sign(F.spread + 0.01)); p = [p[0] + Math.cos(a) * F.ph[k], p[1] + Math.sin(a) * F.ph[k]]; pts.push(p); }
      return pts;
    });
    const WT = [[0, 1.0], [0.06, 0.94], [0.22, 0.84], [0.4, 0.9], [0.47, 0.84], [0.62, 0.76], [0.71, 0.79], [0.78, 0.74], [0.9, 0.66], [0.955, 0.52], [0.985, 0.3], [1, 0.02]];
    const fingerSides = [], fingerPoly = [];
    chains.forEach((ch, fi) => {
      const F = fingers[fi];
      const ax = C(ch.slice(1), 0.12);
      const thumb = fi === 4;
      const wf = (t) => (thumb ? 1.05 : 0.95) * F.w * pwl(thumb ? [[0, 1.1], [0.1, 1.0], [0.45, 0.9], [0.55, 0.94], [0.75, 0.8], [0.92, 0.66], [0.98, 0.34], [1, 0.02]] : WT, t, 1);
      const left = offset(ax, (t) => wf(t) * (1 + 0.03 * Math.sin(t * 17))), right = offset(ax, (t) => -wf(t) * 0.96);
      fingerSides.push({ left: HP(left), right: HP(right), ax: HP(ax), ch, axL: ax });
      fingerPoly.push(HP(left.concat(rev(right))));
    });
    const dorsum = HP(CC([[-1.6, -2.55], [0.5, -2.45], [2.2, -3.0], [3.6, -3.75], [4.2, -4.8], [5.0, -4.4], [6.6, -3.2], [8.5, -3.35], [9.65, -2.2], [10.1, -0.8], [9.85, 0.95], [9.1, 2.45], [8.0, 3.2], [5.5, 2.95], [2.6, 2.5], [0.3, 2.25], [-1.6, 2.15]], 0.12));
    // webs reaching to the middle joints
    const webs = [];
    for (const [a, b, ta, tb] of [[4, 0, 0.62, 0.36], [0, 1, 0.4, 0.4], [1, 2, 0.4, 0.42], [2, 3, 0.42, 0.44]]) {
      const A = fingerSides[a], Bq = fingerSides[b];
      const ea = at(A.right, ta), eb = at(Bq.left, tb);
      const ra = at(A.right, 0.03), rb = at(Bq.left, 0.03);
      const root = [lerp(ra[0], rb[0], 0.5), lerp(ra[1], rb[1], 0.5)];
      const mid = [lerp(ea[0], eb[0], 0.5), lerp(ea[1], eb[1], 0.5)];
      const sag = [lerp(mid[0], root[0], 0.3), lerp(mid[1], root[1], 0.3)];
      const scal = (q, k) => [lerp(q[0], sag[0], k), lerp(q[1], sag[1], k)];
      const edge = C([ea, scal(ea, 0.45), [sag[0] + (mid[0] - root[0]) * 0.05, sag[1] + (mid[1] - root[1]) * 0.05], scal(eb, 0.45), eb], 0.6);
      const sideA = sub(A.right, 0.03, ta), sideB = rev(sub(Bq.left, 0.03, tb));
      webs.push({ poly: sideA.concat(edge.slice(1), sideB.slice(1)), edge, ra, rb, a, b, sideA, sideB });
    }
    const pipF = pip(fingerPoly);
    const WebF = Form(webs.map((w) => w.poly), fingerPoly, { blur: 4, res: 1.3 });
    const DorF = Form([dorsum], fingerPoly, { blur: 10, res: 1.0 });
    const kn = chains.map((c) => hp(c[1][0], c[1][1]));
    // the web: thin and pale, shadowed where a finger leans over it and toward its root
    shade(WebF, (x, y) => {
      let d = 1e9; for (const w of webs) d = Math.min(d, hyp(x - (w.ra[0] + w.rb[0]) / 2, y - (w.ra[1] + w.rb[1]) / 2));
      return 0.06 + 0.32 * sstep(30, 3, d);
    }, { a: 0.3, sp: 1.5, layers: 2, len: [6, 14] });
    for (const w of webs) {
      const n = 16;
      for (let k = 1; k < n; k++) {
        const t = k / n, e = at(w.edge, t);
        const r = at(w.sideA.concat(rev(w.sideB)), lerp(0.42, 0.58, t));
        const rr0 = [lerp(r[0], e[0], 0.08), lerp(r[1], e[1], 0.08)];
        stroke(C([rr0, [lerp(rr0[0], e[0], 0.5) + rs(0.6), lerp(rr0[1], e[1], 0.5) + rs(0.6)], [lerp(rr0[0], e[0], 0.94), lerp(rr0[1], e[1], 0.94)]], 1), { a: 0.2, w: 0.4, pt: 'f', trem: 0.12, tone: (x, y) => (pipF([x, y]) ? 0 : 1) });
      }
      for (let v = 0; v < 3; v++) { // fine veins branching through the membrane
        const r0 = at(w.sideA.concat(rev(w.sideB)), lerp(0.44, 0.56, (v + 0.5) / 3)), e0 = at(w.edge, lerp(0.2, 0.8, (v + 0.5) / 3));
        const mid = [lerp(r0[0], e0[0], 0.5) + rs(2), lerp(r0[1], e0[1], 0.5) + rs(2)];
        const V = C([r0, mid, [lerp(r0[0], e0[0], 0.9), lerp(r0[1], e0[1], 0.9)]], 0.6);
        stroke(V, { a: 0.3, w: 0.32, pt: 'c', trem: 0.35 });
        for (const bt of [0.45, 0.7]) { const b = at(V, bt), d = norm2(e0[0] - r0[0], e0[1] - r0[1]), sg = R() < 0.5 ? 1 : -1; stroke(C([b, [b[0] + d[0] * 4 + d[1] * sg * 3, b[1] + d[1] * 4 - d[0] * sg * 3], [b[0] + d[0] * 7 + d[1] * sg * 6, b[1] + d[1] * 7 - d[0] * sg * 6]], 0.5), { a: 0.22, w: 0.3, pt: 'h', trem: 0.3 }); }
      }
      contour(w.edge, { a: 0.5, side: 0, w: 0.48, re: 0.5 });
      const Te = tangents(w.edge);
      contour(w.edge.map((p, i) => [p[0] - Te[i][1] * 1.0, p[1] + Te[i][0] * 1.0]).slice(4, -4), { a: 0.18, side: 0, w: 0.4 });
    }
    flush(); await Y();
    // dorsum: the knuckles stand up, tendons run to them
    const knF = Form(kn.map((k, i) => ellipse(k[0], k[1], i === 4 ? 9 : 8.5, 7, ang, 20)), [], { blur: 4, res: 1 });
    const locX = (x, y) => ((x - ox) * dx + (y - oy) * dy) / sc;
    shade(DorF, (x, y) => sstep(-1.8, 1.8, locX(x, y)) * (0.08 + 0.5 * clamp(0.92 - DorF.lam(x, y, 1.1), 0, 1)) + 0.2 * clamp(0.6 - knF.lam(x, y, 1.6), 0, 1) * knF.height(x, y) * 2 + 0.18 * sstep(-30, 40, (x - ox) * 0.62 + (y - oy) * 0.78), { a: 0.36, sp: 1.5, layers: 3, len: [8, 18] });
    const tend = [];
    for (let fi = 0; fi < 5; fi++) {
      const ch = chains[fi];
      const s0 = fi === 4 ? [-0.6, -2.0] : [-1.4, lerp(-0.7, 0.8, fi / 3)];
      const e0 = [ch[1][0] - 0.35, ch[1][1]];
      const T = HP(C([s0, [lerp(s0[0], e0[0], 0.5), lerp(s0[1], e0[1], 0.5) + (fi - 1.5) * 0.12], e0], 0.12));
      tend.push(T);
      const Tt = tangents(T), side = (off) => T.map((p, i) => [p[0] + Tt[i][1] * off, p[1] - Tt[i][0] * off]);
      const inD = (p) => (DorF.in(p[0], p[1]) ? sstep(0, 0.25, 1) : 0);
      contour(side(-1.6), { a: 0.2, side: 0, w: 0.36, fade: inD, seg: 10, jit: 0.3 });
      { const band = side(-1.5).concat(rev(side(-4.2))); const Fb = Form([band], [], { res: 1.6, blur: 1.2 }); shade(Fb, (x, y) => (DorF.in(x, y) ? 0.42 : 0), { a: 0.4, sp: 1.2, layers: 2, len: [4, 9], ang: 45 }); }
    }
    for (const [a, b, t1, t2] of [[2, 1, 0.78, 0.66], [2, 3, 0.74, 0.84]]) { const pa = at(tend[a], t1), pb = at(tend[b], t2); stroke(C([pa, [lerp(pa[0], pb[0], 0.5) + dx * 3, lerp(pa[1], pb[1], 0.5) + dy * 3], pb], 0.5), { a: 0.3, w: 0.44, pt: 'c' }); }
    // the knuckles, and the mass of the first interosseous between thumb and index
    for (let fi = 0; fi < 4; fi++) { const k = kn[fi], e = ellipse(k[0], k[1], 7.2, 6.0, ang, 24); const Fk = Form([e], [], { res: 2, blur: 3 }); shade(Fk, (x, y) => clamp(0.8 - Fk.lam(x, y, 1.2), 0, 1) * 0.45, { a: 0.36, sp: 1.2, layers: 2, len: [3, 7] }); contour(sub(closeP(e), 0.05, 0.45), { a: 0.26, side: 0, w: 0.4 }); }
    { const th = HP(CC([[1.6, -2.3], [3.2, -2.9], [4.6, -4.4], [6.2, -3.4], [7.8, -2.8], [6.8, -2.2], [4.2, -1.9], [2.4, -1.7]], 0.12)); const Ft = Form([th], [], { res: 1.6, blur: 5 }); shade(Ft, (x, y) => 0.05 + 0.6 * clamp(0.85 - Ft.lam(x, y, 1.3), 0, 1), { a: 0.4, sp: 1.3, layers: 3, len: [5, 11] }); contour(sub(closeP(th), 0.45, 0.85), { a: 0.22, side: 0, w: 0.4 }); }
    // veins, faint
    stroke(HP(C([[-1.0, 1.5], [1.5, 0.9], [3.5, 1.3], [5.0, 0.4], [6.4, 0.6]], 0.2)), { a: 0.13, w: 0.42, pt: 'f', trem: 0.4 });
    stroke(HP(C([[-1.2, -1.2], [1.8, -0.6], [3.2, -1.6], [4.8, -1.2]], 0.2)), { a: 0.12, w: 0.42, pt: 'f', trem: 0.4 });
    const dSide = area(dorsum) > 0 ? 1 : -1, offF = hider([pip(fingerPoly.concat(webs.map((w) => w.poly)))]);
    contour(sub(dorsum, 0.0, 0.36), { a: 0.52, side: dSide, w: 0.5, re: 0.3, fade: offF });
    contour(sub(dorsum, 0.52, 0.92), { a: 0.5, side: dSide, w: 0.5, re: 0.3, fade: offF });
    flush(); await Y();
    // fingers
    for (let fi = 0; fi < 5; fi++) {
      const P = fingerPoly[fi], Fs = fingerSides[fi], ch = chains[fi];
      const Fm = Form([P], fingerPoly.filter((q, j) => j !== fi && (j === 4 ? fi === 0 : false)), { blur: 4.2, res: 1.5 });
      shade(Fm, (x, y) => 0.06 + 0.72 * clamp(0.9 - Fm.lam(x, y, 1.15), 0, 1), { a: 0.44, sp: 1.3, layers: 3, len: [6, 13], ang: 52 });
      const fadeW = (p) => (WebF.in(p[0], p[1]) ? 0.3 : 1);
      contour(Fs.left, { a: 0.55, side: 1, w: 0.5, re: 0.4, fade: fadeW, lit: 0.3 });
      contour(Fs.right, { a: 0.55, side: -1, w: 0.5, re: 0.4, fade: fadeW, lit: 0.3 });
      // tip: close the round of the fingertip a second time, slightly off
      contour(sub(Fs.left, 0.93, 1).concat(rev(sub(Fs.right, 0.93, 1))), { a: 0.3, side: 0, w: 0.46 });
      // creases over the joints: short folds across the back of the finger
      const Lax = plen(Fs.axL);
      let acc = 0; const js = [];
      for (let k = 1; k < ch.length - 1; k++) { acc += hyp(ch[k + 1][0] - ch[k][0], ch[k + 1][1] - ch[k][1]); js.push(acc / Lax); }
      js.forEach((t, j) => {
        if (j === js.length - 1) return;
        const i = Math.round(t * (Fs.ax.length - 1)), c = Fs.ax[i], Tt = tangents(Fs.ax)[i];
        const w = 0.9 * sc * 0.55, nk = j === 0 ? 4 : 2;
        for (let k = 0; k < nk; k++) {
          const o = (k - (nk - 1) / 2) * 1.5 + rs(0.3), span = w * (0.55 - Math.abs(k - (nk - 1) / 2) * 0.12) * rr(0.8, 1.1);
          const p0 = [c[0] + Tt[0] * o - Tt[1] * span, c[1] + Tt[1] * o + Tt[0] * span], p1 = [c[0] + Tt[0] * (o + 0.8), c[1] + Tt[1] * (o + 0.8)], p2 = [c[0] + Tt[0] * o + Tt[1] * span * 0.9, c[1] + Tt[1] * o - Tt[0] * span * 0.9];
          stroke(C([p0, p1, p2], 0.5), { a: 0.3, w: 0.4, pt: 'h' });
        }
      });
      // the nail, with its lunula
      const tt0 = js[js.length - 1] || 0.75;
      const nb = at(Fs.ax, lerp(tt0, 1, 0.3)), ne = at(Fs.ax, 0.975), Tt = norm2(ne[0] - nb[0], ne[1] - nb[1]);
      const wN = 0.6 * sc * fingers[fi].w * (fi === 4 ? 1.1 : 1) * 0.5;
      const nail = CC([[nb[0] - Tt[1] * wN, nb[1] + Tt[0] * wN], [nb[0] - Tt[0] * 0.8, nb[1] - Tt[1] * 0.8], [nb[0] + Tt[1] * wN, nb[1] - Tt[0] * wN], [ne[0] + Tt[1] * wN * 0.95, ne[1] - Tt[0] * wN * 0.95], [ne[0] + Tt[0] * 1.2, ne[1] + Tt[1] * 1.2], [ne[0] - Tt[1] * wN * 0.95, ne[1] + Tt[0] * wN * 0.95]], 0.4);
      bone(nail, { blur: 1.4, base: 0.0, amp: 0.25, a: 0.3, la: 0.4, lw: 0.42, res: 2.4, re: 0 });
      contour(C([[nb[0] - Tt[1] * wN * 0.6 + Tt[0] * 1.2, nb[1] + Tt[0] * wN * 0.6 + Tt[1] * 1.2], [nb[0] + Tt[0] * 2.0, nb[1] + Tt[1] * 2.0], [nb[0] + Tt[1] * wN * 0.6 + Tt[0] * 1.2, nb[1] - Tt[0] * wN * 0.6 + Tt[1] * 1.2]], 0.3), { a: 0.22, side: 0, w: 0.4 });
      flush(); await Y();
    }
    // a pentimento: the little finger first set wider
    contour(fingerSides[3].left.map((p) => [p[0] + 3.2, p[1] - 2.4]).slice(10), { a: 0.13, side: 0, w: 0.42, jit: 0.4 });
    // the wrist, a few lines running off into the forearm, and the first scales
    stroke(HP(C([[-1.6, -2.55], [-3.4, -2.2], [-5.6, -2.05], [-8.0, -2.15]], 0.2)), { a: 0.42, w: 0.48, pt: 'c', prof: (t) => 1 - 0.85 * sstep(0.4, 1, t) });
    stroke(HP(C([[-1.6, 2.15], [-3.3, 2.0], [-5.5, 2.1], [-7.6, 2.35]], 0.2)), { a: 0.36, w: 0.46, pt: 'c', prof: (t) => 1 - 0.85 * sstep(0.4, 1, t) });
    for (let k = 0; k < 26; k++) {
      const c = [rr(-6.8, -2.6), rr(-1.7, 1.7)];
      if (R() > sstep(-7.5, -3.0, c[0]) * 0.9 + 0.1) continue;
      const rS = rr(0.36, 0.5), arc = []; for (let i = 0; i <= 8; i++) { const a = PI * 0.6 + (i / 8) * PI * 0.8; arc.push([c[0] + Math.cos(a) * rS, c[1] + Math.sin(a) * rS * 0.9]); }
      stroke(HP(arc), { a: 0.3 * sstep(-7.5, -3.5, c[0]), w: 0.42, pt: 'c' });
    }
    for (const ch of chains) stroke(HP(C([[0.6, ch[0][1] * 0.5], ch[1], ch[ch.length - 1]], 0.3)), { a: 0.09, w: 0.4, pt: 'f' });
    flush(); await Y();
    return { fingerSides, chains, hp, tend, knuckles: kn, webs };
  }

  /* ---- transverse section of the tail, the muscle cones in rings */
  async function sectionStudy(Y) {
    const cx = 632, cy = 100, rx = 43, ry = 60;
    const outer = []; for (let i = 0; i <= 120; i++) { const t = (i / 120) * TAU; const k = 1 + 0.06 * Math.cos(2 * t) - 0.05 * Math.pow(Math.sin(t), 8); outer.push([cx + Math.cos(t) * rx * k * (1 + (Math.sin(t) > 0 ? -0.04 : 0.02)), cy + Math.sin(t) * ry * k]); }
    const inner = outer.map((p) => [cx + (p[0] - cx) * 0.965, cy + (p[1] - cy) * 0.97]);
    contour(outer, { a: 0.55, side: area(outer) > 0 ? 1 : -1, w: 0.5, re: 0.3 });
    contour(inner, { a: 0.22, side: 0, w: 0.42, seg: 16 });
    // vertebra in section
    const cen = ellipse(cx, cy, 8.5, 8.5, 0, 40);
    bone(cen, { blur: 2, base: 0.06, amp: 0.4, a: 0.4, la: 0.55 });
    for (const r of [6.6, 4.8, 3.2, 1.6]) contour(ellipse(cx + rs(0.2), cy + rs(0.2), r, r * 0.97, 0, 30), { a: 0.25, side: 0, w: 0.4 });
    const narch = CC([[cx - 6, cy - 6], [cx - 4.2, cy - 17], [cx - 1.2, cy - 22], [cx, cy - 48], [cx + 1.2, cy - 22], [cx + 4.2, cy - 17], [cx + 6, cy - 6], [cx, cy - 8.4]], 0.4);
    const harch = CC([[cx - 6, cy + 6], [cx - 4.6, cy + 16], [cx - 1.4, cy + 23], [cx, cy + 47], [cx + 1.4, cy + 23], [cx + 4.6, cy + 16], [cx + 6, cy + 6], [cx, cy + 8.4]], 0.4);
    bone(narch, { blur: 1.5, base: 0.06, amp: 0.4, a: 0.38, la: 0.5, sub: [cen] });
    bone(harch, { blur: 1.5, base: 0.06, amp: 0.4, a: 0.38, la: 0.5, sub: [cen] });
    for (const c of [[cx, cy - 14.5, 3.0, 0.8], [cx, cy + 13.6, 2.2, 0.9], [cx, cy + 18.6, 2.8, 0.55]]) bone(ellipse(c[0], c[1], c[2], c[2] * 0.92, 0, 20), { tone: () => c[3], a: 0.5, layers: 3, sp: 1.0, la: 0.5 });
    // septa
    contour([[cx, cy - 48], [cx + rs(0.5), cy - ry * 0.99]], { a: 0.42, side: 0 });
    contour([[cx, cy + 47], [cx + rs(0.5), cy + ry * 0.99]], { a: 0.42, side: 0 });
    contour(C([[cx - 8.5, cy], [cx - 22, cy + 1.2], [cx - rx * 0.97, cy - 0.5]], 0.5), { a: 0.45, side: 0 });
    contour(C([[cx + 8.5, cy], [cx + 22, cy + 1.2], [cx + rx * 0.97, cy - 0.5]], 0.5), { a: 0.38, side: 0 });
    // lateral line canals and the dark muscle beneath them
    for (const sx of [-1, 1]) { const l = ellipse(cx + sx * (rx - 3.2), cy - 0.4, 1.2, 1.1, 0, 12); bone(l, { tone: () => 0.8, a: 0.5, layers: 2, sp: 1.0, la: 0.45 }); }
    const red = CC([[cx - rx + 2, cy - 7], [cx - rx + 9, cy - 3], [cx - rx + 10, cy + 3], [cx - rx + 2, cy + 7], [cx - rx + 1, cy]], 0.4);
    const FR = Form([red], [], { res: 1.8, blur: 1 });
    shade(FR, () => 0.62, { a: 0.4, sp: 1.3, layers: 2, len: [3, 7] });
    // the cones of muscle: nested rings in each quarter (left half finished, right half only begun)
    const quads = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [qx, qy] of quads) {
      const ccx = cx + qx * 21, ccy = cy + qy * (qy < 0 ? 27 : 26);
      const nR = 7;
      const rings = [];
      for (let k = nR; k >= 1; k--) {
        const f = k / nR, pts = [];
        for (let i = 0; i <= 50; i++) {
          const t = (i / 50) * TAU;
          let x = Math.cos(t) * 17.5 * f, y = Math.sin(t) * 26 * f;
          // squeeze against the septa
          if (qx * x < 0) x *= 0.55; if (qy * y < 0) y *= 0.62;
          const wob = 1 + 0.06 * Math.sin(t * 3 + k + qx) + rs(0.015);
          pts.push([ccx + x * wob, ccy + y * wob]);
        }
        rings.push(pts);
      }
      const done = qx < 0 || (qx > 0 && qy < 0 && false);
      for (let k = 0; k < rings.length; k++) {
        const P = rings[k];
        const inside = (p) => { const dx = (p[0] - cx) / (rx * 0.94), dy = (p[1] - cy) / (ry * 0.95); return dx * dx + dy * dy < 1 && Math.abs(p[0] - cx) > 2.5 && Math.abs(p[1] - cy) > (Math.abs(p[0] - cx) < 9 ? 9 : 1.6) ? 1 : 0; };
        if (done || k < 3) contour(P, { a: done ? 0.36 : 0.2, side: 0, w: 0.42, seg: 14, fade: inside });
        if (done && k % 2 === 0 && k < rings.length - 1) {
          const Fa = Form([P], [rings[k + 1], narch, harch, cen, red], { res: 1.2, blur: 1 });
          shade(Fa, (x, y) => (inside([x, y]) ? 0.3 + 0.25 * (x > cx ? 0 : 1) * sstep(cy - 60, cy + 60, y) : 0), { a: 0.34, sp: 1.7, layers: 2, len: [5, 12], ang: 58 });
        }
      }
    }
    flush(); await Y();
    return { c: [cx, cy], rx, ry };
  }

  /* ---- a detail of the fin: the last vertebrae, the hypural fan, the rays jointed and forked */
  function finRays(o) {
    // o: m(u,v)->[x,y]; base: [u,v] pairs along the root; tips: polyline (local) of the trailing edge; lead (local) leading edge
    const rays = [];
    const n = o.n;
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1);
      const b = [lerp(o.b0[0], o.b1[0], f) + (o.bulge === undefined ? 3 : o.bulge) * Math.sin(f * PI), lerp(o.b0[1], o.b1[1], f)];
      const e = at(o.trail, f);
      const L = hyp(e[0] - b[0], e[1] - b[1]);
      const d = norm2(e[0] - b[0], e[1] - b[1]), nn = [d[1], -d[0]];
      const bend = o.bend(f) * L;
      const c1 = [b[0] + d[0] * L * 0.33 + nn[0] * bend * 0.35, b[1] + d[1] * L * 0.33 + nn[1] * bend * 0.35];
      const c2 = [b[0] + d[0] * L * 0.7 + nn[0] * bend, b[1] + d[1] * L * 0.7 + nn[1] * bend];
      rays.push(C([b, c1, c2, e], 1).map((q) => o.m(q[0], q[1])));
    }
    return rays;
  }
  function drawRay(ray, o) {
    // a lepidotrichium: two half-rays, jointed into segments, forking twice toward the tip
    const L = plen(ray), fin = o.fin, w0 = o.w0, w1 = o.w1;
    const split1 = o.s1 || 0.48, split2 = o.s2 || 0.76;
    const tube = (P, wa, wb, t0, segL, f) => {
      const n = P.length; if (n < 2) return;
      const Tt = tangents(P), LL = plen(P);
      const side = (sg) => P.map((p, i) => { const w = lerp(wa, wb, i / (n - 1)) / 2; return [p[0] + Tt[i][1] * w * sg, p[1] - Tt[i][0] * w * sg]; });
      const A = side(1), Bq = side(-1);
      let s0 = 0;
      while (s0 < LL - 0.8) {
        const sl = Math.max(2.2, segL * rr(0.85, 1.15) * (1 - 0.55 * (t0 + (s0 / LL) * (1 - t0))));
        const a = s0 / LL, b = Math.min(1, (s0 + sl - (o.gap || 0.7)) / LL);
        stroke(sub(A, a, b), { a: 0.5 * f, w: 0.44, pt: 'c', trem: 0.04 });
        stroke(sub(Bq, a, b), { a: 0.36 * f, w: 0.44, pt: 'c', trem: 0.04 });
        if (o.joints && f > 0.5 && b < 0.999) { const p = at(A, b), q = at(Bq, b); stroke([[p[0], p[1]], [q[0], q[1]]], { a: 0.22 * f, w: 0.4, pt: 'c', trem: 0.02 }); }
        s0 += sl;
      }
      if (o.shadeIt && f > 0.5 && wa > 1.4) { const F = Form([A.concat(rev(Bq))], [], { res: 2.4, blur: 0.7 }); shade(F, (x, y) => 0.06 + 0.4 * clamp(0.85 - F.lam(x, y), 0, 1), { a: 0.36, sp: 1.1, layers: 1, len: [3, 6] }); }
    };
    tube(sub(ray, 0, split1), w0, lerp(w0, w1, split1), 0, o.seg || 12, fin);
    if (fin < 0.55) return;
    const sp = at(ray, split1), e = ray[ray.length - 1], i1 = Math.round(split1 * (ray.length - 1)), d = tangents(ray)[i1];
    const rest = sub(ray, split1, 1), Lr = plen(rest);
    for (const sg of [-1, 1]) {
      const spread = (o.spread || 0.07) * Lr;
      const br = rest.map((p, i) => { const t = i / (rest.length - 1); return [p[0] + d[1] * sg * spread * t * 0.9, p[1] - d[0] * sg * spread * t * 0.9]; });
      const s2 = (split2 - split1) / (1 - split1);
      tube(sub(br, 0, s2), lerp(w0, w1, split1) * 0.6, lerp(w0, w1, split2) * 0.6, split1, (o.seg || 12) * 0.8, fin);
      if (fin < 0.85) continue;
      const rest2 = sub(br, s2, 1), d2 = tangents(br)[Math.round(s2 * (br.length - 1))];
      for (const sg2 of [-1, 1]) {
        const sp2 = 0.05 * plen(rest2);
        const b2 = rest2.map((p, i) => { const t = i / (rest2.length - 1); return [p[0] + d2[1] * sg2 * sp2 * t, p[1] - d2[0] * sg2 * sp2 * t]; });
        tube(b2, lerp(w0, w1, split2) * 0.38, 0.5, split2, (o.seg || 12) * 0.6, fin * 0.9);
      }
    }
  }
  async function rayStudy(Y) {
    const ox = 516, oy = 560, ang = -0.42;
    const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    const m = (u, v) => [ox + ux * u + vx * v, oy + uy * u + vy * v];
    // the last three vertebrae, the urostyle tipping up, the hypural plates splayed like the sticks of a fan
    for (let k = 0; k < 3; k++) {
      const V = { t: 'Ca', i: 30 + k * 2, c: m(-58 + k * 17, 1.0 - k * 1.6), dir: norm2(ux - k * 0.05 * vx, uy - k * 0.05 * vy), h: 2.0 - k * 0.15, d: 1.8 - k * 0.12 };
      const f = VF(V.c, V.dir, S * 1.4), pr = vParts(V);
      bone(f(pr.body), { blur: 1.8, base: 0.06, amp: 0.45, a: 0.38, la: 0.52, layers: 2, sp: 1.3 });
      bone(f(pr.arch), { blur: 1.3, base: 0.05, amp: 0.4, a: 0.34, la: 0.46, sub: [f(pr.body)], sp: 1.3 });
      if (pr.haem) bone(f(pr.haem), { blur: 1.3, base: 0.05, amp: 0.4, a: 0.34, la: 0.46, sub: [f(pr.body)], sp: 1.3 });
      for (const Rg of pr.rings) contour(f(Rg), { a: 0.18, side: 0, w: 0.4 });
    }
    const uro = CC([[-17, -2.5], [-6, -4.5], [2, -7.5], [3.5, -5.5], [-4, -0.5], [-6, 2.5], [-17, 3]].map((q) => m(q[0], q[1])), 0.5);
    bone(uro, { blur: 1.4, base: 0.05, amp: 0.45, a: 0.38, la: 0.5 });
    const plates = [];
    for (let k = 0; k < 6; k++) {
      const a0 = lerp(-1.0, 1.0, k / 6) + 0.025, a1 = lerp(-1.0, 1.0, (k + 1) / 6) - 0.025, r0 = 3, r1 = 22 + 3 * Math.cos((k - 2.5) * 0.5);
      const P = [[-4 + Math.cos(a0) * r0, Math.sin(a0) * r0]];
      for (let i = 0; i <= 6; i++) { const a = lerp(a0, a1, i / 6); P.push([-4 + Math.cos(a) * r1, Math.sin(a) * r1]); }
      P.push([-4 + Math.cos(a1) * r0, Math.sin(a1) * r0]);
      plates.push(CC(P.map((q) => m(q[0], q[1])), 0.5));
    }
    for (const P of plates) bone(P, { blur: 1.6, base: 0.06, amp: 0.45, g: 0.15, a: 0.38, la: 0.48, sp: 1.3, sub: [uro] });
    const plate = plates[0].concat(plates[5]);
    // the rays
    const trail = C([[178, -84], [160, -58], [140, -30], [122, -4], [112, 12], [124, 34], [144, 62], [160, 88]], 1);
    const rays = finRays({ m, n: 9, b0: [-4 + Math.cos(-0.92) * 29, Math.sin(-0.92) * 29], b1: [-4 + Math.cos(0.92) * 29, Math.sin(0.92) * 29], bulge: 12, trail, bend: (f) => (0.45 - f) * 0.16 });
    const fins = [0.45, 0.8, 1, 1, 1, 1, 0.9, 0.6, 0.35];
    // membrane first, faint striae following the rays, a split between two rays
    for (let k = 0; k < rays.length - 1; k++) {
      const A = rays[k], Bq = rays[k + 1], tear = k === 5;
      const n = 5;
      for (let j = 1; j < n; j++) {
        const u = j / n, end = tear ? lerp(0.5, 0.66, Math.abs(u - 0.5) * 2) : rr(0.86, 0.97), pts = [];
        for (let i = 0; i <= 26; i++) { const t = lerp(0.3, end, i / 26); const pa = at(A, t), pb = at(Bq, t); pts.push([lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u)]); }
        stroke(pts, { a: (0.15 + 0.08 * Math.min(fins[k], fins[k + 1])), w: 0.4, pt: 'f', trem: 0.1 });
      }
      const ta = tear ? 0.6 : 0.97, pa = at(A, ta), pb = at(Bq, ta), dm = norm2(pa[0] - ox, pa[1] - oy);
      contour(C([pa, [lerp(pa[0], pb[0], 0.5) - dm[0] * (tear ? 16 : 3), lerp(pa[1], pb[1], 0.5) - dm[1] * (tear ? 16 : 3)], pb], 0.8), { a: 0.32 * Math.min(fins[k], fins[k + 1]) + 0.08, side: 0, w: 0.42 });
    }
    // tone in the membrane near the root
    const FM = Form([rays[0].concat(rev(rays[rays.length - 1]))], plates, { res: 1, blur: 6 });
    shade(FM, (x, y) => 0.32 * sstep(90, 10, hyp(x - ox, y - oy)) + 0.12 * sstep(ox, ox + 120, x) * sstep(oy - 40, oy + 60, y), { a: 0.34, sp: 1.7, layers: 2, len: [6, 14], ang: 60 });
    flush(); await Y();
    for (let k = 0; k < rays.length; k++) {
      drawRay(rays[k], { fin: fins[k], w0: k === 0 || k === rays.length - 1 ? 5.2 : 4.4, w1: 1.3, seg: 14, joints: true, shadeIt: true, s1: 0.46 + rs(0.03), s2: 0.74 + rs(0.03) });
      flush(); await Y();
    }
    // the joint of one ray, enlarged in a little round
    const cx = 704, cy = 640, r = 21;
    const ring = ellipse(cx, cy, r, r, 0, 60);
    contour(ring, { a: 0.42, side: 0, w: 0.46 });
    for (const sg of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y0 = cy - 17 + k * 13.5;
        const xs = cx + sg * 5.5;
        const seg = C([[xs + sg * 0.6, y0], [xs + sg * 1.6, y0 + 6], [xs + sg * 0.8, y0 + 11.6]], 0.5);
        const F = Form([ribbon(seg, 2.2, 2.2)], [], { res: 3, blur: 0.8 });
        shade(F, (x, y) => (k === 2 && sg > 0 ? 0 : 0.15 + 0.45 * clamp(0.85 - F.lam(x, y), 0, 1)) * (hyp(x - cx, y - cy) < r - 1 ? 1 : 0), { a: 0.36, sp: 1.0, layers: 2, len: [2, 5] });
        if (!(k === 2 && sg > 0)) { contour(offset(seg, 2.2), { a: 0.45, side: 0, w: 0.42, fade: (p) => (hyp(p[0] - cx, p[1] - cy) < r - 1 ? 1 : 0) }); contour(offset(seg, -2.2), { a: 0.4, side: 0, w: 0.42, fade: (p) => (hyp(p[0] - cx, p[1] - cy) < r - 1 ? 1 : 0) }); }
      }
    }
    // the lines that tie the round to the ray it enlarges
    const target = at(rays[3], 0.3);
    stroke([[cx - r * 0.7, cy - r * 0.7], [target[0] + 3, target[1] + 3]], { a: 0.14, w: 0.4, pt: 'f' });
    flush(); await Y();
    return { m, rays };
  }

  /* ---- scales: one worked up, one outlined, a patch in place */
  async function scaleStudy(Y) {
    const one = (cx, cy, sc, ang, finish) => {
      const f = frameF(cx, cy, sc, ang);
      const out = [];
      for (let i = 0; i <= 90; i++) {
        const t = (i / 90) * TAU, c = Math.cos(t), s = Math.sin(t);
        let x = c * (c < 0 ? 1.0 : 0.92), y = s * 0.86;
        if (c < -0.2) x -= 0.035 * Math.abs(Math.sin(t * 13)); // crenulated embedded margin
        out.push([x, y]);
      }
      const O = f(out);
      contour(O, { a: 0.55, side: area(O) > 0 ? 1 : -1, w: 0.48, re: 0.3 });
      const foc = [0.22, 0.02];
      const post = (p) => (p[0] - foc[0]) > 0.15 * Math.abs(p[1]) + 0.1;
      const nC = Math.round(16 * finish);
      for (let k = 1; k <= nC; k++) {
        const r = k / 17, pts = [];
        for (let i = 0; i <= 70; i++) { const t = (i / 70) * TAU; const p = [foc[0] + Math.cos(t) * r * (Math.cos(t) < 0 ? 1.2 : 0.7), foc[1] + Math.sin(t) * r * 0.84 + rs(0.004)]; pts.push(p); }
        const P = f(pts), Pl = pts;
        let run = [];
        for (let i = 0; i < P.length; i++) { const ok = !post(Pl[i]) && Math.abs(Pl[i][1] - foc[1]) > 0.0 && !(Math.abs(Math.atan2(Pl[i][1] - foc[1], Pl[i][0] - foc[0])) > 2.5 && (i % 7 === 0)); if (ok) run.push(P[i]); else { if (run.length > 2) stroke(run, { a: 0.3, w: 0.4, pt: 'c', trem: 0.03 }); run = []; } }
        if (run.length > 2) stroke(run, { a: 0.3, w: 0.4, pt: 'c', trem: 0.03 });
      }
      if (finish > 0.6) {
        for (let k = 0; k < 7; k++) { const a = PI - 0.9 + (k / 6) * 1.8; stroke(f(C([foc, [foc[0] + Math.cos(a) * 1.05, foc[1] + Math.sin(a) * 0.9]], 0.02)), { a: 0.34, w: 0.42, pt: 'c' }); }
        const Fp = Form([f(CC([[0.38, -0.7], [0.75, -0.55], [0.93, 0], [0.75, 0.55], [0.38, 0.7], [0.3, 0]], 0.02))], [], { res: 2, blur: 3 });
        shade(Fp, (x, y) => 0.25 + 0.35 * clamp(0.9 - Fp.lam(x, y), 0, 1), { a: 0.36, sp: 1.3, layers: 2, len: [3, 7] });
        for (let k = 0; k < 60; k++) { const p = f([[rr(0.45, 0.88), rr(-0.6, 0.6)]])[0]; if (!Fp.in(p[0], p[1])) continue; stroke([p, [p[0] + 0.8, p[1] + 0.5]], { a: 0.4, w: 0.42, pt: 'c' }); }
      }
      return f;
    };
    const fA = one(934, 196, 24, -0.2, 1);
    await Y();
    one(952, 262, 15, 0.35, 0.35);
    // a patch of scales lying in their rows
    for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) {
      if ((r === 3 && k > 3) || (r === 0 && k === 5)) continue;
      const c = [902 + k * 13 + (r % 2) * 6.5, 300 + r * 9];
      const arc = []; for (let i = 0; i <= 12; i++) { const a = -1.25 + (i / 12) * 2.5; arc.push([c[0] + Math.cos(a) * 7.5, c[1] + Math.sin(a) * 6.5]); }
      stroke(arc, { a: 0.42 - r * 0.06, w: 0.44, pt: 'c' });
      const F = Form([arc.concat([[c[0] + 2, c[1]]])], [], { res: 1.8, blur: 1 });
      if (r < 3) shade(F, (x, y) => 0.25 * sstep(c[0] + 1, c[0] + 7, x), { a: 0.3, sp: 1.4, layers: 1, len: [3, 6] });
    }
    flush(); await Y();
    return { fA };
  }

  /* ---- one caudal vertebra, from the side and from before, barely begun */
  async function vertStudy(Y) {
    const f = frameF(752, 104, 0.92, -0.08);
    const cen = f(CC([[-10, -8.5], [0, -7.0], [10, -8.5], [10.7, 0], [10, 8.5], [0, 7.0], [-10, 8.5], [-10.7, 0]], 0.3));
    const nsp = f(CC([[-7, -7.6], [-8.6, -12.5], [-12.5, -15.2], [-7.2, -15.6], [-2.4, -18.5], [5.5, -32], [15.5, -48], [24, -58.5], [27.5, -61], [25, -55.5], [16, -43], [9, -28.5], [5.6, -19], [10.8, -15.6], [13, -12.4], [6.4, -9.8], [6, -7.6]], 0.3));
    const hsp = f(CC([[-6, 7.6], [-7.4, 12], [-2.6, 16.5], [4.5, 28], [12.5, 40], [19, 50], [21.5, 53], [18.4, 47.5], [10.2, 35.5], [6.2, 24], [4.6, 15.5], [7.6, 10.4], [5.2, 7.6]], 0.3));
    bone(cen, { blur: 3, base: 0.06, amp: 0.48, g: 0.2, a: 0.4, la: 0.55 });
    bone(nsp, { sub: [cen], fade: hider([pip([cen])]), blur: 2.4, base: 0.05, amp: 0.45, g: 0.25, a: 0.38, la: 0.52 });
    bone(hsp, { sub: [cen], fade: hider([pip([cen])]), blur: 2.4, base: 0.05, amp: 0.45, g: 0.25, a: 0.36, la: 0.5 });
    for (const r of [0.72, 0.48, 0.26]) contour(f(CC([[-10 * r, -6.5 * r], [10 * r, -6.5 * r], [10 * r, 6.5 * r], [-10 * r, 6.5 * r]], 0.3)), { a: 0.2, side: 0, w: 0.4 });
    contour(f(C([[0, -17], [8, -30], [18, -46], [25.5, -58]], 0.4)), { a: 0.18, side: 0, w: 0.4 });
    contour(f(C([[0, 16], [8, 30], [15, 42], [20, 51]], 0.4)), { a: 0.16, side: 0, w: 0.4 });
    flush(); await Y();
    // from before: the centrum's growth rings, the arches over the cord and under the vessels
    const cx = 858, cy = 102;
    const disc = ellipse(cx, cy, 10.5, 10, 0, 44);
    const Fd = Form([disc], [], { res: 2, blur: 2 });
    shade(Fd, (x, y) => (x < cx ? 0.12 + 0.3 * clamp(0.9 - Fd.lam(x, y), 0, 1) : 0), { a: 0.34, sp: 1.3, layers: 2, len: [3, 7] });
    contour(disc, { a: 0.5, side: 0, w: 0.48 });
    for (const r of [8.2, 6.2, 4.4, 2.6, 1.0]) contour(ellipse(cx + rs(0.2), cy + rs(0.2), r, r * 0.96, 0, 30), { a: 0.24, side: 0, w: 0.4 });
    const na = CC([[cx - 6.5, cy - 7.5], [cx - 7, cy - 15], [cx - 3, cy - 22.5], [cx - 0.9, cy - 46], [cx + 0.9, cy - 46], [cx + 3, cy - 22.5], [cx + 7, cy - 15], [cx + 6.5, cy - 7.5], [cx, cy - 9.6]], 0.4);
    const ha = CC([[cx - 6, cy + 7.5], [cx - 6.4, cy + 15], [cx - 2.6, cy + 22], [cx - 0.7, cy + 40], [cx + 0.7, cy + 40], [cx + 2.6, cy + 22], [cx + 6.4, cy + 15], [cx + 6, cy + 7.5], [cx, cy + 9.6]], 0.4);
    const Fn = Form([na], [disc, ellipse(cx, cy - 14.5, 3.4, 3.6, 0, 20)], { res: 2, blur: 1.2 });
    shade(Fn, (x, y) => (x < cx ? 0.3 : 0.06), { a: 0.34, sp: 1.3, layers: 1, len: [3, 7] });
    contour(na, { a: 0.46, side: 0, w: 0.46, fade: hider([pip([disc])]) });
    contour(ha, { a: 0.36, side: 0, w: 0.44, fade: (p) => (p[1] > cy + 30 && p[0] > cx ? 0 : pip([disc])(p) ? 0 : 1) });
    bone(ellipse(cx, cy - 14.5, 3.4, 3.6, 0, 20), { tone: () => 0.8, a: 0.45, layers: 2, sp: 1.0, la: 0.45 });
    bone(ellipse(cx - 1.4, cy + 14.2, 1.7, 1.8, 0, 14), { tone: () => 0.7, a: 0.45, layers: 2, sp: 1.0, la: 0.4 });
    contour(ellipse(cx + 1.8, cy + 15, 1.6, 1.7, 0, 14), { a: 0.3, side: 0, w: 0.4 });
    flush(); await Y();
  }

  /* ---- a thumbnail: as she was found, in the net, a few lines only */
  function thumb() {
    const T = frameF(36, 36, 1, 0);
    const L = (P, a) => stroke(C(T(P), 0.6), { a: a || 0.42, w: 0.46, pt: 'c', trem: 0.25 });
    L([[2, 64], [60, 76], [118, 70]], 0.3); L([[4, 70], [62, 82], [120, 76]], 0.22); // the plank
    L([[16, 52], [12, 47], [17, 42], [23, 45], [22, 52], [16, 52]], 0.5); // head
    for (let k = 0; k < 7; k++) L([[18 + k, 44], [8 - k * 2, 52 + k * 2.5], [2 - k, 62 + k * 1.5]], 0.25);
    L([[22, 52], [40, 58], [60, 61], [78, 58], [94, 49], [104, 36], [106, 24]], 0.5);
    L([[22, 55], [38, 64], [58, 67], [80, 64], [98, 54], [110, 40], [112, 26]], 0.38);
    L([[106, 24], [98, 12], [96, 8]], 0.45); L([[112, 26], [124, 16], [128, 10]], 0.45); L([[104, 22], [112, 20], [118, 18]], 0.3);
    L([[34, 57], [38, 70], [30, 76]], 0.35); // arm hanging over
    for (let k = 0; k < 6; k++) { L([[6 + k * 20, 30], [26 + k * 20, 80]], 0.16); L([[30 + k * 20, 30], [10 + k * 20, 80]], 0.14); }
  }

  // where has the stylus already been? (read back from the layer, coarse, dilated)
  function occupancy(pad) {
    flush();
    const gw = Math.ceil(SW / 2), gh = Math.ceil(SH / 2);
    const c = scratch(gw, gh);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    c.drawImage(LC.canvas, 0, 0, LC.canvas.width, LC.canvas.height, 0, 0, gw, gh);
    const d = c.getImageData(0, 0, gw, gh).data;
    const g = new Uint8Array(gw * gh), h = new Uint8Array(gw * gh);
    for (let i = 0; i < gw * gh; i++) g[i] = d[i * 4] > 7 || d[i * 4 + 1] > 5 ? 1 : 0;
    const r = pad || 2;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { if (!g[y * gw + x]) continue; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < gw && yy < gh) h[yy * gw + xx] = 1; } }
    return (x, y) => { if (x < 16 || y < 16 || x > SW - 14 || y > SH - 12) return false; const ix = (x / 2) | 0, iy = (y / 2) | 0; return !h[iy * gw + ix]; };
  }

  /* ------------------------------------------------------------ the renderer */
  async function renderAll(Y) {
    HIER = 1.32;
    const G = thoraxGeometry();
    const SP = spineData();
    const TL = LUT(SP.path), sEnd = TL.L, sCut = SP.total * 0.44;
    const TAILO = [[0, 36, 70], [40, 48, 68], [90, 49, 60], [140, 46, 52], [200, 40, 44], [280, 33, 35], [350, 26, 26], [410, 20, 20], [440, 18.5, 18], [470, 18, 17]];
    const tM = (s, t) => { const p = TL.pt(s), d = TL.tan(s), nx = d[1], ny = -d[0]; const o = t > 0 ? t * pwl(TAILO, s, 1) : t * pwl(TAILO, s, 2); return [p[0] + nx * o, p[1] + ny * o]; };
    const dorsal = [], ventral = [];
    for (let s0 = 0; s0 <= sEnd; s0 += 2) { dorsal.push(tM(s0, 1)); ventral.push(tM(s0, -1)); }
    const segSp = (s0) => lerp(13.5, 7.2, clamp(s0 / sEnd, 0, 1));
    const myoA = (s0) => segSp(s0) * 1.7;
    const sept = (t) => { const x = Math.abs(t); const tri = 1 - Math.abs(2 * x - 1); return -(tri * tri * (3 - 2 * tri)) * 0.9 - 0.3 * (1 - x) * (1 - x); };
    const tailShade = (s0, t) => {
      const d = TL.tan(s0), nx = d[1], ny = -d[0];
      const tt = clamp(t, -0.999, 0.999), nz = Math.sqrt(1 - tt * tt);
      const lam = nx * tt * L3[0] + ny * tt * L3[1] + nz * L3[2];
      return clamp(0.82 - lam, 0, 1);
    };
    const nearRib = G.ribs.map((r) => xy(r.near.poly));
    const nearCart = G.ribs.filter((r) => r.near.cart).map((r) => xy(r.near.cart.poly));
    const farRib = G.ribs.map((r) => xy(r.far.poly));
    const farCart = G.ribs.filter((r) => r.far.cart).map((r) => xy(r.far.cart.poly));
    const stern = xy(G.sternum.poly);

    // shoulder girdle and arm (3D landmarks projected)
    const p2 = (X, Yy, Z) => { const q = P3(X, Yy, Z); return [q[0], q[1]]; };
    const scap = CC([[318, 196], [334, 191], [362, 189], [392, 190], [409, 194], [403, 200], [380, 203], [362, 205.5], [355, 207.5], [349.5, 209], [346, 204], [330, 199]], 0.8);
    const scapSpine = CC([[353, 191.5], [343, 188.6], [335, 187.2], [329.5, 189.2], [328.5, 193], [333, 194.4], [341, 193.4], [353, 195]], 0.6);
    const corac = CC([[346, 202], [341, 204], [336.5, 208.5], [335.5, 212.5], [338.5, 212], [341.5, 207.5], [347, 205]], 0.5);
    const clavAx = C([[335.5, 293], [331, 272], [330, 250], [333, 228], [337.5, 212], [339.5, 202.5]], 0.8);
    const clav = ribbon(clavAx, (t) => pwl([[0, 4.2], [0.15, 3.0], [0.5, 2.3], [0.85, 2.9], [1, 3.6]], t, 1), (t) => pwl([[0, 3.6], [0.15, 2.6], [0.5, 2.1], [0.85, 2.6], [1, 2.8]], t, 1));
    const shoulder = p2(15.4, -3.4, -0.4), elbow = [303, 362], wrist = [181, 394];
    const hd = norm2(elbow[0] - shoulder[0], elbow[1] - shoulder[1]);
    const hum = (() => {
      const L = hyp(elbow[0] - shoulder[0], elbow[1] - shoulder[1]), k = L / 29;
      const n = [hd[1], -hd[0]];
      const m = (u, v) => [shoulder[0] + hd[0] * u * k + n[0] * v * S, shoulder[1] + hd[1] * u * k + n[1] * v * S];
      const out = [[1.0, 2.25], [2.6, 2.05], [4.6, 1.45], [7.5, 1.22], [10.5, 1.32], [12.4, 1.52], [14.2, 1.3], [19, 1.08], [23.5, 1.25], [26.2, 1.95], [27.9, 2.55], [28.7, 2.35], [29.25, 1.5], [29.7, 0.55], [29.65, -0.45], [29.35, -1.2], [28.9, -1.75], [28.4, -2.85], [27.6, -2.95], [26.6, -2.1], [24.4, -1.25], [19.5, -0.98], [13.5, -1.06], [8.5, -1.12], [4.8, -1.3], [2.8, -1.85], [1.4, -2.15]];
      const poly = CC(out, 0.2).map((q) => m(q[0], q[1]));
      const head = ellipse(m(0, 0.1)[0], m(0, 0.1)[1], 2.3 * S, 2.2 * S, Math.atan2(hd[1], hd[0]), 40);
      return { poly, head, m, fossa: CC([[26.4, 0.35], [27.6, 0.8], [28.2, 0.0], [27.6, -0.75], [26.5, -0.5]], 0.15).map((q) => m(q[0], q[1])), ridge: C([[13.5, 1.1], [18, 0.4], [24, 0.2], [27.5, 1.6]], 0.3).map((q) => m(q[0], q[1])) };
    })();
    const occNear = Form(nearRib.concat(nearCart, [scap, clav, hum.poly, hum.head]), [], { res: 1.4, blur: 1 });
    const occRibs = Form(nearRib.concat(nearCart), [], { res: 1.4, blur: 1 });
    const occGirdle = pip([scap, clav, hum.poly, hum.head]);
    /* ---- the flayed layer: geometry of the muscles laid over the near half of the chest and flank */
    const ribAt = (i, t) => at(xy(G.ribs[i].near.mid), t);
    const fan = (O, I, bul) => { // fibre field between an origin curve and an insertion curve
      const Ol = LUT(O), Il = LUT(I);
      return { O, I, Ol, Il, bul: bul || 0, fib: (f, n) => { const o = Ol.pt(f * Ol.L), e = Il.pt(f * Il.L), m = [lerp(o[0], e[0], 0.5), lerp(o[1], e[1], 0.5)], d = norm2(e[0] - o[0], e[1] - o[1]), L = hyp(e[0] - o[0], e[1] - o[1]); const bu = typeof bul === 'function' ? bul(f) : bul || 0; return C([o, [m[0] + d[1] * bu * L, m[1] - d[0] * bu * L], e], 0.8); }, poly: null };
    };
    const MUS = [];
    { // deltoid: from clavicle, acromion and spine of the scapula, converging on the humerus
      const M = fan(C([[336, 230], [332.5, 214], [332, 200], [338.5, 188.5], [351, 187], [363, 193], [369, 205]], 0.8), C([[327.5, 269], [331, 276], [334, 272]], 0.6), (f) => (f - 0.45) * -0.22);
      M.name = 'deltoid'; MUS.push(M);
    }
    { // pectoralis major, clavicular and sternocostal heads, twisting into one tendon under the deltoid
      MUS.push(Object.assign(fan(C([[333.5, 243], [331, 258], [331.2, 274], [334.5, 288]], 0.8), C([[345, 230], [342, 238], [340, 244]], 0.6), 0.05), { name: 'pectC' }));
      MUS.push(Object.assign(fan(C([[338, 293], [362, 301], [390, 309.5], [418, 317]], 0.8), C([[341, 241], [338, 249], [335.5, 256]], 0.6), (f) => 0.04 + 0.06 * f), { name: 'pectS' }));
    }
    for (let i = 2; i <= 7; i++) { // serratus anterior: a slip from each rib to the border of the scapula
      const a0 = ribAt(i, 0.6), a1 = ribAt(i, 0.7), tx = lerp(346, 404, (i - 2) / 5), ty = lerp(197, 199, (i - 2) / 5);
      MUS.push(Object.assign(fan(C([a0, [lerp(a0[0], a1[0], 0.5) + 1, lerp(a0[1], a1[1], 0.5) + 1.5], a1], 0.6), C([[tx - 3.2, ty], [tx + 3.2, ty + 0.4]], 0.6), -0.06), { name: 'serr' + i }));
    }
    { // external oblique: digitations on the lower ribs, fibres running down and forward into the flank and on into the tail
      const O = C([ribAt(5, 0.93), ribAt(6, 0.92), ribAt(7, 0.9), ribAt(8, 0.88), ribAt(9, 0.84), [500, 270], [506, 272], [532, 285], [560, 298], [590, 305]], 0.8);
      const I = C([[446, 300], [452, 312], [462, 326], [478, 337], [502, 331], [530, 325], [562, 321], [594, 318.5]], 0.8);
      MUS.push(Object.assign(fan(O, I, 0.03), { name: 'obl' }));
    }
    for (const M of MUS) M.poly = M.O.concat(rev(M.I));
    // the hypaxial band of the tail, continuing the oblique below the spine to where the tail is opened
    const tbS = (s0) => lerp(-0.74, -0.46, sstep(60, 150, s0));
    const bandTop = [], bandBot = [];
    for (let s0 = 0; s0 <= sCut + 2; s0 += 2) { bandTop.push(tM(s0, tbS(s0) + 0.04 * Math.sin(s0 * 0.21))); bandBot.push(tM(s0, -1)); }
    const bandPoly = bandTop.concat(rev(bandBot));
    const MusF = Form(MUS.map((M) => M.poly).concat([bandPoly]), [], { res: 1.3, blur: 1 });
    const DeltF = Form([MUS[0].poly], [], { res: 1.3, blur: 1 });
    const musOcc = (x, y) => MusF.in(x, y);

    SEGOCC = musOcc;
    /* ---- far ribs and the hollow of the cage */
    const gaps = [];
    for (let i = 0; i < 11; i++) {
      const a = G.ribs[i].near, b = G.ribs[i + 1].near;
      let lo = xy(a.lo); if (a.cart) lo = lo.concat(xy(a.cart.lo));
      let up = xy(b.up); if (b.cart) up = up.concat(xy(b.cart.up));
      gaps.push(lo.concat(rev(up)));
    }
    const spineBodies = [];
    for (const V of SP.V) if (V.t === 'T') { const f = VF(V.c, V.dir, S), pr = vParts(V); spineBodies.push(f(pr.body), f(pr.arch)); }
    const farMask = Form(farRib.concat(farCart), [], { blur: 2.4, res: 1.3 });
    const inner = Form(gaps, nearRib.concat(nearCart, [stern], spineBodies, [scap, clav, hum.poly, hum.head]), { blur: 8, res: 1.0 });
    const gapF = gaps.map((g) => Form([g], [], { res: 0.8, blur: 3 }));
    const GV = [1.0, 0.8, 1.12, 0.72, 1.18, 0.86, 1.06, 0.7, 1.0, 0.78, 0.9];
    const toneIn = (x, y) => {
      let gv = 0.85, h = 0;
      for (let i = 0; i < gapF.length; i++) if (gapF[i].in(x, y)) { gv = GV[i]; h = gapF[i].height(x, y); break; }
      const depth = sstep(BY + 85, BY - 8, y);
      return clamp((0.42 + 0.5 * depth + 0.08 * sstep(330, 450, x)) * gv + 0.18 * (1 - h) * depth - 0.42 * farMask.height(x, y) * (1.1 - depth * 0.5), 0, 1);
    };
    shade(inner, toneIn, { a: 0.7, sp: 1.4, layers: 4, len: [12, 28], len2: [10, 20] });
    flush(); await Y();
    for (const r of G.ribs) {
      const f = r.far, vis = (p) => (inner.in(p[0], p[1]) ? 1 : 0);
      contour(sub(xy(f.lo), 0.22, 1), { a: 0.26, side: -1, w: 0.42, fade: (p) => vis(p) * (0.35 + 0.65 * sstep(BY - 5, BY + 70, p[1])), lit: 0.6 });
      contour(sub(xy(f.up), 0.22, 1), { a: 0.14, side: 1, w: 0.4, fade: (p) => vis(p) * (0.3 + 0.7 * sstep(BY - 5, BY + 70, p[1])), lit: 0.6 });
      if (f.cart) { contour(xy(f.cart.lo), { a: 0.26, side: -1, w: 0.42, fade: vis }); contour(xy(f.cart.up), { a: 0.16, side: 1, w: 0.42, fade: vis }); }
    }
    flush(); await Y();

    /* ---- the spine, from atlas to the last caudal */
    for (const V of SP.V) {
      if (V.s && V.s > SP.total * 0.44 - 6) continue;
      const f = VF(V.c, V.dir, S), pr = vParts(V);
      const gl = V.t === 'T' ? [occNear] : [occGirdle];
      const tp = pr.tp ? f(pr.tp) : null, arch = f(pr.arch), body = f(pr.body), haem = pr.haem ? f(pr.haem) : null;
      const gOcc = V.t === 'T' ? nearRib.concat(nearCart, [scap, clav, hum.poly, hum.head]) : (V.t === 'C' || V.t === 'L') ? [scap, clav, hum.poly, hum.head] : [];
      const small = V.t === 'Ca' && V.i > 20;
      if (tp) bone(tp, { sub: gOcc, fade: hider(gl), blur: 1.2, res: 2.4, base: 0.06, amp: 0.45, a: 0.4, la: 0.5, sp: 1.6 });
      const tpH = tp ? pip([tp]) : null;
      bone(arch, { sub: gOcc.concat(tp ? [tp] : []), fade: hider(gl.concat([tpH])), blur: 1.6, res: 2.2, base: 0.1, amp: 0.5, a: 0.42, la: small ? 0.45 : 0.55, sp: 1.7 });
      const archH = pip([arch]);
      bone(body, { sub: gOcc.concat(tp ? [tp] : [], [arch]), fade: hider(gl.concat([tpH, archH])), blur: 2.0, res: 2.2, base: 0.08, amp: 0.55, a: 0.42, la: 0.58, sp: 1.7 });
      if (haem) bone(haem, { sub: gOcc, fade: hider(gl), blur: 1.4, res: 2.2, base: 0.1, amp: 0.45, a: 0.4, la: small ? 0.42 : 0.52, sp: 1.7 });
      for (const D of pr.dark) { const Pd = f(D); const Fd = Form([Pd], gOcc, { res: 3, blur: 0.6 }); shade(Fd, () => 0.85, { a: 0.5, sp: 1.2, layers: 3, len: [2, 4] }); }
      for (const Ln of pr.lines) contour(C(f(Ln), 0.5), { a: 0.45, side: 0 });
      if (pr.rings) for (const Rg of pr.rings) contour(f(Rg), { a: 0.18, side: 0, w: 0.4, fade: hider(gl) });
      flush(); await Y();
    }

    /* ---- near ribs, cartilages and sternum */
    const scapH = occGirdle;
    for (const r of G.ribs) {
      const n = r.near;
      const F = Form([xy(n.poly)], [scap, clav, hum.poly, hum.head], { blur: 2.0, res: 2.0 });
      // across the band: the upper border rounded and lit, the lower turned away into shadow
      const upL = LUT(xy(n.up)), loL = LUT(xy(n.lo));
      const across = (x, y) => { // 0 at the upper border .. 1 at the lower
        let best = 1e9, bu = 0, bl = 0;
        for (let k = 0; k <= 24; k++) { const t = (k / 24) * upL.L, pu = upL.pt(t), pl = loL.pt((k / 24) * loL.L); const du = hyp(x - pu[0], y - pu[1]), dl = hyp(x - pl[0], y - pl[1]); if (du + dl < best) { best = du + dl; bu = du; bl = dl; } }
        return bu / (bu + bl + 1e-6);
      };
      shade(F, (x, y) => 0.04 + 0.62 * sstep(0.3, 1.0, across(x, y)) + 0.2 * clamp(0.75 - F.lam(x, y, 0.8), 0, 1), { a: 0.42, sp: 1.35, layers: 2, len: [4, 9], ang: 60 });
      contour(xy(n.up), { a: 0.4, side: 1, w: 0.48, re: 0.3, fade: hider([scapH]), lit: 0.35 });
      contour(xy(n.lo), { a: 0.7, side: -1, w: 0.56, re: 0.5, fade: hider([scapH]) });
      if (n.cart) {
        const Fc = Form([xy(n.cart.poly)], [clav, hum.poly], { blur: 1.5, res: 2 });
        shade(Fc, (x, y) => 0.06 + 0.32 * clamp(0.72 - Fc.lam(x, y, 0.8), 0, 1), { a: 0.32, sp: 2.0, layers: 1, len: [4, 8] });
        contour(xy(n.cart.up), { a: 0.2, side: 1, w: 0.42, fade: hider([scapH]), jit: 0.3 });
        contour(xy(n.cart.lo), { a: 0.3, side: -1, w: 0.44, fade: hider([scapH]), jit: 0.3 });
      }
      flush(); await Y();
    }
    bone(stern, { sub: nearCart.concat([clav, hum.poly]), fade: hider([pip(nearCart), scapH]), blur: 2.5, res: 1.6, base: 0.06, amp: 0.4, g: 0.2, a: 0.36, la: 0.5 });
    for (const rg of G.sternum.ridges) contour(C(xy(rg), 0.5), { a: 0.3, side: 0, w: 0.42, fade: hider([pip(nearCart), scapH]) });
    flush(); await Y();

    /* ---- scapula, clavicle, humerus */
    bone(scap, { sub: [clav, hum.poly, hum.head], fade: hider([pip([clav, hum.poly, hum.head])]), blur: 3, base: 0.06, amp: 0.5, a: 0.4 });
    bone(scapSpine, { sub: [clav, hum.poly, hum.head], fade: hider([pip([clav, hum.poly, hum.head])]), blur: 1.4, base: 0.02, amp: 0.5, a: 0.42, res: 2.4 });
    bone(corac, { sub: [clav, hum.poly, hum.head], fade: hider([pip([clav, hum.poly, hum.head])]), blur: 1.0, base: 0.05, amp: 0.45, a: 0.4, res: 2.4 });
    bone(clav, { sub: [hum.poly, hum.head], fade: hider([pip([hum.poly, hum.head])]), blur: 2.0, base: 0.05, amp: 0.5, a: 0.4 });
    SEGOCC = (x, y) => DeltF.in(x, y);
    bone(hum.head, { blur: 5, base: 0.04, amp: 0.55, a: 0.42 });
    bone(hum.poly, { sub: [hum.head], fade: hider([pip([hum.head])]), blur: 4, base: 0.02, amp: 0.5, g: 0.25, a: 0.42 });
    bone(hum.fossa, { tone: () => 0.62, a: 0.45, layers: 2, sp: 1.3, la: 0.35, lw: 0.42 });
    contour(hum.ridge, { a: 0.22, side: 0, w: 0.42 });
    { const ax = []; for (let u = 1.5; u <= 28.5; u += 0.5) ax.push(hum.m(u, 0)); const hwt = [[0, 2.0], [0.1, 1.6], [0.2, 1.25], [0.45, 1.25], [0.7, 1.05], [0.85, 1.4], [1, 2.1]]; cylHatch(ax, (t) => pwl(hwt, t, 1) * S, { a: 0.36 }); cylHatch(ax, (t) => pwl(hwt, t, 1) * S * 0.92, { a: 0.24 }); }
    cylHatch(clavAx, (t) => 2.6, { a: 0.3, bow: 0.25 });
    flush(); await Y();

    /* ---- the flayed muscles, each hatched along its own fibres */
    const humOcc = Form([hum.poly, hum.head], [MUS[0].poly], { res: 1.3, blur: 1 }), scapOcc = Form([scap, scapSpine, corac], [], { res: 1.3, blur: 1 });
    const drawMuscle = (M, o) => {
      const per = plen(closeP(M.poly)), ar = Math.abs(area(M.poly)), wid = (2 * ar) / Math.max(1, per);
      const F = Form([M.poly], [], { res: 1.3, blur: clamp(wid * 0.45, 2.5, 11) });
      const bb = bbox([M.poly]), cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2, rad = Math.max(6, hyp(bb[2] - bb[0], bb[3] - bb[1]) / 2);
      const tone = (x, y) => { const e = F.height(x, y); return clamp((0.02 + 1.0 * Math.pow(clamp(0.97 - F.lam(x, y, 1.5), 0, 1), 1.15) + (o.g || 0.3) * clamp(((x - cx) * 0.62 + (y - cy) * 0.78) / rad * 0.8 + 0.3, 0, 1)) * sstep(0.08, 0.5, e), 0, 1); };
      const n = Math.max(5, Math.round(M.Ol.L / ((o.sp || 0.95) * 0.75)));
      for (let pass = 0; pass < 4; pass++) {
        const th = pass * 0.2;
        for (let k = 0; k <= n; k++) {
          const f = clamp((k + rr(-0.35, 0.35) + pass * 0.27) / n, 0, 1), fib = M.fib(f);
          const mid = at(fib, 0.45), tm = tone(mid[0], mid[1]);
          if (R() < 0.05 || (tm < 0.2 && R() < 0.6)) continue;
          const tEnd = 1 - (o.tendon || 0.12) * rr(0.7, 1.3);
          let t = rr(0, 0.08);
          while (t < tEnd) {
            const te = Math.min(tEnd, t + rr(0.16, 0.4));
            const piece = sub(fib, t, te);
            const taper = (u) => sstep(0, 0.12, u) * (1 - 0.7 * sstep(tEnd - 0.18, tEnd, u));
            if (piece.length > 1) stroke(piece, { a: (o.a || 0.42) * 1.5 * taper((t + te) / 2), w: 0.3, pt: 'h', trem: 0.08, step: 2, tone: (x, y) => Math.max(0, (tone(x, y) - th) / (1 - th)) });
            t = te + rr(-0.03, 0.05);
          }
          if (k % 2 === 0 && pass === 0) stroke(sub(fib, tEnd, 1), { a: 0.18, w: 0.28, pt: 'f' });
        }
      }
      const side = area(M.poly) > 0 ? 1 : -1;
      contour(M.poly.concat([M.poly[0]]), { a: o.la || 0.4, side, w: 0.44, re: 0.3, seg: 14, jit: 0.35, lit: 0.04 });
      M.F = F; M.crest = sub(M.fib(o.crest || 0.4), 0.22, 0.62);
      return F;
    };
    SEGOCC = (x, y) => humOcc.in(x, y) || DeltF.in(x, y);
    drawMuscle(MUS[2], { a: 0.4, sp: 0.85, g: 0.32 }); flush(); await Y();
    drawMuscle(MUS[1], { a: 0.4, sp: 0.85, g: 0.25 }); flush(); await Y();
    SEGOCC = (x, y) => humOcc.in(x, y) || DeltF.in(x, y) || scapOcc.in(x, y);
    for (const M of MUS) if (M.name.startsWith('serr')) { drawMuscle(M, { a: 0.38, sp: 0.8, g: 0.3, tendon: 0.18, blur: 2.5 }); }
    flush(); await Y();
    SEGOCC = null;
    { // the arm throws its shadow down and to the right across the chest
      const sh = (P, dx, dy) => P.map((q) => [q[0] + dx, q[1] + dy]);
      const cast = [sh(hum.poly, 7.5, 6), sh(hum.poly, 4, 3)];
      const body = Form(gaps.concat(nearRib, nearCart, MUS.map((M) => M.poly), [stern]), [], { res: 1, blur: 1 });
      const Fc = Form(cast, [hum.poly, hum.head, MUS[0].poly], { res: 1.3, blur: 3 });
      shade(Fc, (x, y) => (body.in(x, y) ? 0.55 * Fc.height(x, y) + 0.25 : 0), { a: 0.6, sp: 1.3, layers: 4, len: [6, 14], ang: 48 });
      flush(); await Y();
    }
    const oblF = drawMuscle(MUS[MUS.length - 1], { a: 0.4, sp: 0.85, g: 0.22, tendon: 0.08, blur: 7 });
    // aponeurosis of the oblique: pale sheet running on to the belly line
    for (let k = 0; k < 26; k++) { const f = k / 25, p0 = MUS[MUS.length - 1].Il.pt(f * 0.42 * MUS[MUS.length - 1].Il.L); stroke([p0, [p0[0] + 7 + rs(1), p0[1] + 11 + rs(1)]], { a: 0.14, w: 0.28, pt: 'f' }); }
    drawMuscle(MUS[0], { a: 0.44, sp: 0.8, g: 0.3, tendon: 0.1, blur: 6, amp: 0.6 });
    flush(); await Y();
    SEGOCC = musOcc;

    /* ---- skull */
    const vault = sk(C(SKD.vault, 0.1)), cran = sk(CC(SKD.vault.concat(SKD.craniumClose), 0.1));
    const orbit = sk(CC(SKD.orbit, 0.1)), zyg = sk(CC(SKD.zyg, 0.1)), arch = sk(CC(SKD.arch, 0.1)), gap = sk(CC(SKD.gap, 0.08)), maxi = sk(CC(SKD.maxilla, 0.1)), nas = sk(CC(SKD.nasal, 0.08));
    const ncav = sk(CC(SKD.nasalCav, 0.08)), mand = sk(CC(SKD.mand, 0.1)), mast = sk(CC(SKD.mastoid, 0.08)), fossa = sk(CC(SKD.fossa, 0.1));
    const T = teeth(), tUp = T.up.map(sk), tLo = T.lo.map(sk);
    const faceOcc = [zyg, arch, maxi, nas, mand, mast].concat(tUp, tLo);
    const skC = sk([[0, -5]])[0];
    // the vault: a dome lit from the upper left, darkening over the occiput and into the temporal hollow
    const Fcr = Form([cran], [], { blur: 26, res: 1.0 }), Fcl = Form([cran], [orbit, zyg, arch, maxi, nas, mand, mast, gap], { blur: 1, res: 1.4 });
    const inFossa = Form([fossa], [], { blur: 6, res: 1.0 });
    shade(Fcl, (x, y) => {
      const dx = (x - skC[0]) / 70, dy = (y - skC[1]) / 70;
      const lam = Fcr.lam(x, y, 1.6);
      return clamp(0.0 + 0.5 * clamp(0.92 - lam, 0, 1) + 0.45 * sstep(-0.1, 0.9, dx * 0.62 + dy * 0.78) + 0.1 * inFossa.height(x, y), 0, 1);
    }, { a: 0.42, sp: 1.8, layers: 3, len: [9, 20] });
    { // hatching laid round the vault, following its curve on the shadowed side
      for (let r = 18; r < 66; r += rr(0.9, 1.3)) {
        let a0 = rr(-0.9, -0.5);
        while (a0 < 2.4) {
          const a1 = a0 + rr(8, 20) / r, pts = [];
          for (let k = 0; k <= 8; k++) { const a = lerp(a0, a1, k / 8); pts.push([skC[0] + Math.cos(a) * r, skC[1] + Math.sin(a) * r]); }
          stroke(pts, { a: 0.36, w: 0.3, pt: 'h', step: 2, tone: (x, y) => { if (!Fcl.in(x, y)) return 0; const dx = (x - skC[0]) / 70, dy = (y - skC[1]) / 70; return Math.pow(clamp(0.5 * clamp(0.92 - Fcr.lam(x, y, 1.6), 0, 1) + 0.6 * sstep(0.0, 0.9, dx * 0.62 + dy * 0.78) - 0.15, 0, 1), 0.8); } });
          a0 = a1 + rr(0.02, 0.12);
        }
      }
      whiteHatch(Fcl, (x, y) => sstep(0.84, 0.97, Fcr.lam(x, y, 1.6)) * sstep(0.1, -0.5, ((x - skC[0]) * 0.62 + (y - skC[1]) * 0.78) / 60), { a: 0.55, sp: 1.3 });
    }
    contour(vault, { a: 0.6, side: area(cran) > 0 ? 1 : -1, re: 0.5, w: 0.55, fade: hider([pip([mand, mast])]) });
    contour(sk(C(SKD.brow, 0.1)), { a: 0.42, side: 0, w: 0.5 });
    flush(); await Y();
    const orbC = sk([[-8.0, -2.2]])[0];
    bone(orbit, { layers: 4, tone: (x, y) => 0.85 + 0.15 * sstep(-14, 10, (x - orbC[0]) * 0.3 - (y - orbC[1]) * 0.95), noLine: true, a: 0.55, layers: 3, sp: 1.3, sub: [zyg, nas, maxi] });
    contour(sk(C(SKD.orbit.slice(0, 5), 0.1)), { a: 0.5, side: 0, w: 0.5, fade: hider([pip([zyg])]) });
    bone(gap, { tone: () => 1, noLine: true, a: 0.65, layers: 4, sp: 1.3, sub: [arch, mand] });
    bone(ncav, { tone: () => 0.95, noLine: true, a: 0.65, layers: 4, sp: 1.3, sub: [maxi, nas] });
    bone(zyg, { blur: 3.0, base: 0.0, amp: 0.4, g: 0.25, a: 0.38, la: 0.45 });
    bone(arch, { sub: [zyg], fade: hider([pip([zyg])]), blur: 1.6, base: 0.02, amp: 0.45, g: 0.15, a: 0.38, la: 0.5 });
    bone(nas, { blur: 1.2, base: 0.04, amp: 0.4, a: 0.38, la: 0.45 });
    bone(maxi, { sub: [zyg, nas].concat(tUp), fade: hider([pip([zyg, nas])]), blur: 4, base: 0.08, amp: 0.4, g: 0.25, a: 0.38, la: 0.4 });
    bone(mand, { sub: tLo.concat([mast]), fade: hider([pip(tLo)]), blur: 6, base: 0.04, amp: 0.5, g: 0.35, a: 0.4, la: 0.55 });
    bone(mast, { blur: 2.4, base: 0.1, amp: 0.45, g: 0.2, a: 0.4, la: 0.45 });
    // teeth: pale crowns, the gaps between them dark
    for (const t of tUp.concat(tLo)) bone(t, { blur: 0.8, res: 3, base: 0.0, amp: 0.22, a: 0.3, la: 0.3, lw: 0.38, sp: 1.4, layers: 1, re: 0 });
    flush(); await Y();
    const inCr = hider([pip(faceOcc.concat([orbit, gap]))]);
    contour(sk(C(SKD.tline, 0.1)), { a: 0.12, side: 0, w: 0.42, seg: 18, jit: 0.3, fade: inCr });
    for (const k of ['coronal', 'squam', 'lambd']) suture(sk(C(SKD[k], 0.1)), k === 'squam' ? 0.25 : 0.65, inCr);
    const eam = sk(ellipse(0, 0, 0.48, 0.58, 0.2, 24));
    bone(eam, { tone: () => 0.95, a: 0.55, layers: 3, sp: 1.1, la: 0.55, sub: [mand] });
    for (const f of [[-6.6, 7.0, 0.17], [-8.6, 0.85, 0.14], [-7.6, 1.0, 0.09], [-8.6, -3.25, 0.12]]) { const e = sk(ellipse(f[0], f[1], f[2], f[2] * 0.8, 0, 12)); bone(e, { tone: () => 0.85, a: 0.55, layers: 3, sp: 1.0, la: 0.45, lw: 0.4 }); }
    contour(sk(C([[-0.3, 1.95], [-1.0, 3.0], [-1.7, 4.1]], 0.1)), { a: 0.4, side: 0, w: 0.45, fade: hider([pip([mand])]) });
    flush(); await Y();
    // branchial arches with their gill rakers
    const GA = gillArches();
    for (const A of GA) {
      const P = sk(A), band = ribbon(P, 1.6, 1.6);
      bone(band, { sub: [mand], fade: hider([pip([mand])]), blur: 1.0, res: 2.4, base: 0.05, amp: 0.5, a: 0.4, la: 0.5, sp: 1.5 });
      const Tg = tangents(P);
      for (let i = 4; i < P.length - 3; i += 2) {
        const q = P[i], nx = Tg[i][1], ny = -Tg[i][0];
        if (pip([mand])(q)) continue;
        const L = 3.2 + 1.2 * Math.sin(i * 0.7);
        stroke([[q[0] + nx * 1.4, q[1] + ny * 1.4], [q[0] + nx * (1.4 + L) - Tg[i][0] * 0.8, q[1] + ny * (1.4 + L) - Tg[i][1] * 0.8]], { a: 0.38, w: 0.4, pt: 'h' });
      }
    }
    flush(); await Y();
    if (/sirenaGeo/.test(location.search)) window.__geo = { ribs: G.ribs.map((r) => [0.3, 0.45, 0.55, 0.65, 0.75, 0.85, 1].map((t) => at(xy(r.near.mid), t).map((v) => +v.toFixed(1)))), cart: G.ribs.map((r) => r.near.cart ? xy(r.near.cart.mid).filter((q, i, a) => i % 5 === 0 || i === a.length - 1).map((q) => q.map((v) => +v.toFixed(1))) : null), V: SP.V.map((v) => [v.t + v.i, +v.c[0].toFixed(1), +v.c[1].toFixed(1)]), shoulder, elbow, wrist, ster: [at(xy(G.sternum.a), 0), at(xy(G.sternum.a), 1)] };
    /* ---- forearm */
    const fa = norm2(wrist[0] - elbow[0], wrist[1] - elbow[1]), fpn = [fa[1], -fa[0]];
    const FL = hyp(wrist[0] - elbow[0], wrist[1] - elbow[1]);
    const fax = (t, o) => [elbow[0] + fa[0] * FL * t + fpn[0] * o, elbow[1] + fa[1] * FL * t + fpn[1] * o];
    const limb = (t0, t1, off, wid, n) => { // ribbon along the forearm axis
      const ax = []; for (let i = 0; i <= n; i++) { const t = lerp(t0, t1, i / n); ax.push(fax(t, off(t))); }
      return ribbon(ax, (u) => wid(lerp(t0, t1, u)) / 2, (u) => wid(lerp(t0, t1, u)) / 2);
    };
    const tabW = (tab) => (t) => pwl(tab, t, 1);
    const ulna = limb(-0.1, 0.99, (t) => 5.6 - 1.6 * t, tabW([[-0.1, 11], [-0.04, 17], [0.06, 15.5], [0.14, 10.5], [0.4, 8.2], [0.85, 6.4], [0.95, 8.4], [0.99, 5]]), 50);
    const radius = limb(0.02, 1.0, (t) => -5.4 + 8.4 * t, tabW([[0.02, 11.5], [0.05, 12], [0.1, 8.2], [0.35, 9.2], [0.7, 10.8], [0.9, 15.5], [0.97, 18.5], [1.0, 15]]), 50);
    bone(ulna, { sub: [radius], fade: hider([pip([radius])]), blur: 2.4, base: 0.05, amp: 0.5, a: 0.4 });
    bone(radius, { blur: 2.4, base: 0.04, amp: 0.5, a: 0.4 });
    { const ax = [], ax2 = []; for (let t = 0.04; t <= 0.98; t += 0.01) { ax.push(fax(t, -5.4 + 8.4 * t)); ax2.push(fax(t, 5.6 - 1.6 * t)); }
      cylHatch(ax, (t) => pwl([[0, 5.5], [0.1, 4.2], [0.4, 4.6], [0.75, 5.6], [0.95, 8.5], [1, 7]], t, 1), { a: 0.34 });
      SEGOCC = pip([radius]); cylHatch(ax2, (t) => pwl([[0, 7], [0.12, 5.2], [0.4, 4.1], [0.85, 3.2], [1, 4]], t, 1), { a: 0.3 }); SEGOCC = null; }
    flush(); await Y();

    /* ---- the hand of the main study: bones, and the web between the fingers */
    const hdir = (() => { const a = Math.atan2(fa[1], fa[0]) - 0.32; return [Math.cos(a), Math.sin(a)]; })();
    const hn = [hdir[1], -hdir[0]];
    const W0 = fax(1.02, 0.5);
    const hp = (x, y) => [W0[0] + (hdir[0] * x + hn[0] * y) * S, W0[1] + (hdir[1] * x + hn[1] * y) * S];
    const carp = [[0.8, -1.55, 0.62], [0.85, -0.45, 0.58], [0.8, 0.6, 0.6], [0.95, 1.5, 0.45], [2.25, -1.85, 0.6], [2.2, -0.7, 0.62], [2.25, 0.45, 0.66], [2.1, 1.45, 0.62]];
    for (const c of carp) { const e = hp(c[0], c[1]); bone(ellipse(e[0], e[1], c[2] * S, c[2] * S * 0.82, Math.atan2(hdir[1], hdir[0]) + rs(0.4), 22), { blur: 1.4, res: 2.4, base: 0.06, amp: 0.45, a: 0.36, la: 0.45, sp: 1.6 }); }
    const fingers = [
      { b: [3.0, -1.6], h: [9.3, -2.25], ph: [4.3, 2.6, 1.9], cur: 0.04 },
      { b: [3.05, -0.55], h: [9.8, -0.7], ph: [4.9, 3.0, 2.1], cur: 0.07 },
      { b: [3.0, 0.45], h: [9.3, 0.85], ph: [4.6, 2.8, 2.0], cur: 0.11 },
      { b: [2.9, 1.4], h: [8.5, 2.1], ph: [3.7, 2.2, 1.7], cur: 0.15 },
      { b: [2.5, -2.2], h: [6.0, -4.1], ph: [3.3, 2.5], cur: 0.05 },
    ];
    const chains = [];
    for (const F of fingers) {
      const pts = [F.b, F.h];
      let dx = F.h[0] - F.b[0], dy = F.h[1] - F.b[1]; let a = Math.atan2(dy, dx);
      let p = F.h;
      for (const L of F.ph) { a += F.cur; p = [p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L]; pts.push(p); }
      chains.push(pts);
      for (let k = 0; k < pts.length - 1; k++) {
        const A = hp(pts[k][0], pts[k][1]), Bq = hp(pts[k + 1][0], pts[k + 1][1]);
        const L = hyp(Bq[0] - A[0], Bq[1] - A[1]), d = norm2(Bq[0] - A[0], Bq[1] - A[1]);
        const w0 = (k === 0 ? 0.62 : 0.5 - k * 0.07) * S, w1 = w0 * 0.62;
        const ax = []; for (let i = 0; i <= 16; i++) ax.push([A[0] + d[0] * L * i / 16, A[1] + d[1] * L * i / 16]);
        const P = ribbon(ax, (u) => lerp(w0 * 0.5, w0 * 0.32, sstep(0, 0.3, u)) * (1 + 0.45 * sstep(0.75, 1, u)), (u) => lerp(w0 * 0.5, w0 * 0.32, sstep(0, 0.3, u)) * (1 + 0.45 * sstep(0.75, 1, u)));
        bone(P, { blur: 1.2, res: 2.4, base: 0.05, amp: 0.45, a: 0.36, la: 0.5, sp: 1.6, layers: 1 });
      }
    }
    // the web: a faint membrane between the fingers, its free edge scalloped
    for (let j = 0; j < 4; j++) {
      const A = chains[j === 3 ? 4 : j], Bc = chains[j === 3 ? 0 : j + 1];
      const a1 = A[j === 3 ? 2 : 2], b1 = Bc[2];
      const a0 = A[1], b0 = Bc[1];
      const mid = [(a1[0] + b1[0]) / 2 - 0.9, (a1[1] + b1[1]) / 2];
      const edge = C([hp(a1[0], a1[1]), hp(mid[0], mid[1]), hp(b1[0], b1[1])], 0.8);
      contour(edge, { a: 0.3, side: 0, w: 0.42 });
      for (let k = 1; k < 6; k++) { const t = k / 6, e = at(edge, t), r = hp(lerp(a0[0], b0[0], t), lerp(a0[1], b0[1], t)); stroke([r, [lerp(r[0], e[0], 0.92), lerp(r[1], e[1], 0.92)]], { a: 0.16, w: 0.4, pt: 'f' }); }
    }
    flush(); await Y();

    /* ---- the vestigial pelvis, hung in the flesh below the sacrum */
    const S1 = SP.V.find((v) => v.t === 'S');
    const pf = VF(S1.c, S1.dir, S);
    const ilium = pf(CC([[-0.4, -1.6], [1.2, -1.2], [2.6, -2.6], [3.7, -4.6], [4.0, -5.7], [3.2, -6.0], [2.2, -5.0], [0.9, -3.4], [-0.5, -2.6]], 0.1));
    const pubis = pf(CC([[3.0, -5.3], [1.8, -6.2], [0.2, -7.3], [-0.6, -7.5], [-0.5, -7.0], [1.4, -5.7], [2.6, -4.9]], 0.1));
    const femur = pf(CC([[3.6, -5.6], [4.6, -6.1], [5.4, -6.9], [5.5, -7.4], [5.0, -7.5], [4.3, -6.8], [3.4, -6.2]], 0.1));
    bone(ilium, { blur: 1.6, res: 2.2, base: 0.06, amp: 0.5, a: 0.42, la: 0.55 });
    bone(pubis, { sub: [ilium], fade: hider([pip([ilium])]), blur: 1.2, res: 2.2, base: 0.08, amp: 0.45, a: 0.4 });
    bone(femur, { sub: [ilium], fade: hider([pip([ilium])]), blur: 1.2, res: 2.2, base: 0.06, amp: 0.5, a: 0.4 });
    const acet = pf(ellipse(3.35, -5.45, 0.45, 0.38, 0, 14));
    bone(acet, { tone: () => 0.7, a: 0.45, layers: 2, sp: 1.2, la: 0.4 });
    // the ligament that slings it to the sacrum, dotted
    const lig = C([pf([-0.2, -1.7]), pf([-0.6, -0.4]), pf([-0.3, 0.6])], 0.5);
    for (let t = 0; t < 1; t += 0.09) stroke(sub(lig, t, t + 0.045), { a: 0.32, w: 0.42, pt: 'c' });
    flush(); await Y();

    /* ---- the tail: flesh, myomeres, scales */
    SEGOCC = null;
    // flesh zone polygon (from the cut to the root of the fin)
    const zone = [];
    const cutEdge = [];
    for (let k = 0; k <= 40; k++) { const t = -1 + (2 * k) / 40; cutEdge.push(tM(sCut + 4 * sept(t) + 2.5 * Math.sin(t * 9) + rs(0.6), t)); }
    for (let s0 = sCut; s0 <= sEnd; s0 += 2) zone.push(tM(s0, 1));
    for (let s0 = sEnd; s0 >= sCut; s0 -= 2) zone.push(tM(s0, -1));
    const ZF = Form([zone], [], { res: 1.0, blur: 4 });
    const BandF = Form([bandPoly], [], { res: 1.0, blur: 4 });
    const inMus = (x, y) => ZF.in(x, y) || BandF.in(x, y);
    // the muscle is modelled as a turning cylinder; each myomere swells a little behind its septum
    const septS = [];
    for (let s0 = 8; s0 < sEnd - 5; s0 += segSp(s0) * rr(0.9, 1.1)) septS.push(s0);
    const tf = (() => {
      const bb = bbox([zone, bandPoly]), x0 = bb[0] - 2, y0 = bb[1] - 2, w = Math.ceil(bb[2] - bb[0] + 4), h = Math.ceil(bb[3] - bb[1] + 4);
      const g = new Float32Array(w * h).fill(-1);
      let k0 = 0;
      for (let s0 = 0; s0 <= sEnd; s0 += 0.5) {
        while (k0 < septS.length - 1 && septS[k0 + 1] < s0 - 30) k0++;
        const tTop = s0 < sCut ? tbS(s0) + 0.08 : 1.0001;
        for (let t = -1; t <= tTop; t += 0.02) {
          const p = tM(s0, t), ix = Math.round(p[0] - x0), iy = Math.round(p[1] - y0);
          if (ix < 0 || iy < 0 || ix >= w || iy >= h) continue;
          const A = myoA(s0), sp0 = s0 - A * sept(t);
          let ph = 1;
          for (let k = k0; k < septS.length; k++) { const d = sp0 - septS[k]; if (d < 0) break; if (d < segSp(s0) * 1.1) { ph = d / segSp(s0); break; } }
          const sw = 0.12 * Math.exp(-ph * 5) - 0.05 * Math.exp(-(1 - ph) * 7);
          g[iy * w + ix] = clamp(0.02 + 1.05 * Math.pow(tailShade(s0, t), 1.25) + 0.22 * sstep(-0.35, -0.95, t) + sw, 0, 1);
        }
      }
      return (x, y) => { const ix = Math.round(x - x0), iy = Math.round(y - y0); if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 0; const v = g[iy * w + ix]; return v < 0 ? 0 : v; };
    })();
    shade(ZF, tf, { a: 0.56, sp: 1.45, layers: 6, len: [10, 24] });
    shade(BandF, tf, { a: 0.56, sp: 1.45, layers: 6, len: [10, 24] });
    flush(); await Y();
    // hatching that curves round the tail on its shadowed underside, as if drawn across the cylinder
    for (let s0 = 6; s0 < sEnd - 4; s0 += rr(0.9, 1.4)) {
      const tTop = s0 < sCut ? tbS(s0) : 0.15, t0 = -1 + rr(0, 0.06), t1 = Math.min(tTop, rr(-0.35, 0.1));
      if (t1 <= t0 + 0.1) continue;
      const pts = []; for (let k = 0; k <= 10; k++) { const t = lerp(t0, t1, k / 10); pts.push(tM(s0 - 2.5 * (1 - t * t), t)); }
      stroke(pts, { a: 0.3, w: 0.3, pt: 'h', step: 2, tone: (x, y) => (inMus(x, y) ? Math.pow(tf(x, y), 1.4) : 0) });
    }
    flush(); await Y();
    // septa
    for (const s0 of septS) {
      const A = myoA(s0) * rr(0.9, 1.1), pts = [];
      const tTop = s0 < sCut ? tbS(s0) : 1;
      const ta = R() < 0.2 ? rr(-1, -0.6) : -1, tb = s0 < sCut ? tTop : R() < 0.25 ? rr(0.3, 1) : 1;
      for (let k = 0; k <= 60; k++) { const t = lerp(ta, tb, k / 60); pts.push(tM(s0 + A * sept(t) + Math.sin(t * 5 + s0) * 0.6, t)); }
      contour(pts, { a: 0.24, side: 0, w: 0.4, seg: 12, jit: 0.35, fade: (p) => (inMus(p[0], p[1]) ? 0.5 + 0.8 * tf(p[0], p[1]) : 0) });
    }
    // the upper border of the band, where it was lifted off the bones with the knife
    contour(bandTop, { a: 0.42, side: 1, w: 0.46, re: 0.4, jit: 0.4 });
    // lateral line with its pores
    const ll = []; for (let s0 = sCut; s0 < sEnd; s0 += 2) ll.push(tM(s0, 0.04 * Math.sin(s0 * 0.05)));
    contour(ll, { a: 0.3, side: 0, w: 0.4, seg: 30 });
    for (let s0 = sCut + 6; s0 < sEnd - 4; s0 += rr(4.5, 6)) { const p = tM(s0, 0.05); const e = ellipse(p[0], p[1], 0.7, 0.55, 0, 8); stroke(e, { a: 0.4, w: 0.4, pt: 'c', trem: 0.02 }); }
    // the cut: the knife's edge and a little of the cut face
    contour(cutEdge.filter((p, i) => i >= 6), { a: 0.6, side: 0, w: 0.5, re: 0.6 });
    const face = [];
    for (let k = 0; k <= 40; k++) { const t = -1 + (2 * k) / 40; face.push(tM(sCut - 7 * Math.sqrt(1 - t * t) + 4 * sept(t), t)); }
    contour(face.filter((p, i) => i >= 6), { a: 0.3, side: 0, w: 0.42 });
    for (const r of [0.75, 0.5, 0.25]) { const arc = []; for (let k = 0; k <= 30; k++) { const t = (-1 + (2 * k) / 30) * r; arc.push(tM(sCut - 7 * Math.sqrt(1 - t * t) * r + 4 * sept(t) - 1, t)); } contour(arc, { a: 0.18, side: 0, w: 0.4 }); }
    // scales: they begin, sparse and faint, over the lower belly and thicken toward the fin; the muscle shows through
    const scaleGlints = [];
    for (let s0 = 30; s0 < sEnd - 5; ) {
      const step = lerp(5.6, 4.2, s0 / sEnd);
      const row = Math.round(s0 / 5);
      for (let t = -0.94 + (row % 2) * 0.08; t < 0.96; t += lerp(0.17, 0.2, s0 / sEnd)) {
        if (s0 < sCut && t > tbS(s0) - 0.03) continue;
        const wb = Math.exp(-Math.pow((t - 0.5) / 0.3, 2));
        let pr = s0 < sCut ? sstep(30, sCut, s0) * sstep(tbS(s0), -0.95, t) * 0.5 : (0.1 + 0.9 * wb) * (0.7 + 0.3 * sstep(sCut, sEnd - 60, s0));
        if (s0 > sCut && s0 < sCut + 40) pr *= sstep(sCut, sCut + 40, s0);
        if (R() > pr) continue;
        const c = tM(s0, t), d = TL.tan(s0), r = lerp(3.6, 2.7, s0 / sEnd);
        const pts = [];
        for (let k = 0; k <= 10; k++) { const a = -1.15 + (2.3 * k) / 10; const dx = Math.cos(a) * r, dy = Math.sin(a) * r * 0.9; pts.push([c[0] + d[0] * dx + d[1] * dy, c[1] + d[1] * dx - d[0] * dy]); }
        stroke(pts, { a: 0.1 + 0.42 * pr, w: 0.34, pt: 'c', trem: 0.06 });
        if (pr > 0.6 && R() < 0.38) scaleGlints.push(pts);
      }
      s0 += step;
    }
    flush(); await Y();
    // the skin's outline runs unbroken from the nape and the throat to the fin
    contour(dorsal.filter((p, i) => i * 2 < sCut), { a: 0.32, side: 1, w: 0.46, seg: 20 });
    contour(dorsal.filter((p, i) => i * 2 >= sCut - 4), { a: 0.6, side: 1, w: 0.52, re: 0.4 });
    contour(ventral, { a: 0.6, side: -1, w: 0.52, re: 0.4 });
    const backLine = C([[256, 172], [276, 190], [306, 196], [345, 190], [392, 193], [440, 203], [505, 214], tM(0, 1)], 1.0);
    const frontLine = C([[214, 286], [236, 293], [262, 300], [296, 318], [322, 346], [352, 362], [390, 366], [430, 352], [480, 335], [530, 324], tM(0, -1)], 1.0);
    contour(backLine, { a: 0.3, side: 1, w: 0.44, seg: 20, jit: 0.3 }); contour(frontLine, { a: 0.36, side: -1, w: 0.44, seg: 20, jit: 0.3 });
    flush(); await Y();

    /* ---- the fin: jointed, forking rays, the membrane between them, torn in two places */
    const fe = TL.pt(sEnd - 3), fd = TL.tan(sEnd), fdn = [fd[1], -fd[0]];
    const fl = (q) => [fe[0] + fd[0] * q[0] + fdn[0] * q[1], fe[1] + fd[1] * q[0] + fdn[1] * q[1]];
    const trailL = C([[130, 78], [114, 61], [98, 41], [84, 19], [73, 2], [81, -16], [95, -38], [109, -58], [122, -75]], 1.0);
    const leadD = C([[-6, 19], [26, 31], [62, 49], [98, 65], [130, 78]], 1.0), leadV = C([[-6, -19], [24, -29], [58, -45], [92, -61], [122, -75]], 1.0);
    const finPoly = leadD.concat(trailL.slice(1), rev(leadV)).map(fl);
    const NR = 15;
    const rays = finRays({ m: (u, v) => fl([u, v]), n: NR, b0: [-2, 16], b1: [-2, -16], trail: trailL, bend: (f) => (0.5 - f) * 0.07 });
    rays[0] = leadD.map(fl); rays[NR - 1] = leadV.map(fl);
    const tear = { 4: 0.58, 10: 0.66 };
    const tearPolys = [];
    for (const k in tear) { const A = rays[+k], Bq = rays[+k + 1], te = tear[k]; tearPolys.push([at(A, te + 0.02), at(A, 1.0), at(Bq, 1.0), at(Bq, te + 0.02), [lerp(at(A, te)[0], at(Bq, te)[0], 0.5), lerp(at(A, te)[1], at(Bq, te)[1], 0.5)]]); }
    const FF = Form([finPoly], tearPolys, { res: 1.2, blur: 7 });
    // membrane tone: dark at the root, the lower lobe turned a little away from the light
    shade(FF, (x, y) => { const d = hyp(x - fe[0], y - fe[1]); const q = (x - fe[0]) * fdn[0] + (y - fe[1]) * fdn[1]; return clamp(0.26 + 0.36 * sstep(90, 0, d) + 0.28 * sstep(0, -60, q) - 0.08 * sstep(20, 70, q) + 0.35 * sstep(45, 0, d) * sstep(5, -30, q), 0, 1); }, { a: 0.48, sp: 1.4, layers: 4, len: [8, 18], ang: 64 });
    for (let k = 0; k < NR - 1; k++) {
      const A = rays[k], Bq = rays[k + 1], te = tear[k] || 0.97;
      for (const u of [0.33, 0.66]) { const pts = []; for (let i = 0; i <= 22; i++) { const t = lerp(0.12, te * rr(0.85, 0.98), i / 22); const pa = at(A, t), pb = at(Bq, t); pts.push([lerp(pa[0], pb[0], u), lerp(pa[1], pb[1], u)]); } stroke(pts, { a: 0.16, w: 0.28, pt: 'f', trem: 0.1 }); }
      const pa = at(A, te), pb = at(Bq, te), pm = [lerp(pa[0], pb[0], 0.5) - fd[0] * (tear[k] ? 16 : 5), lerp(pa[1], pb[1], 0.5) - fd[1] * (tear[k] ? 16 : 5)];
      contour(C([pa, pm, pb], 0.6), { a: tear[k] ? 0.6 : 0.55, side: 0, w: 0.5 });
    }
    flush(); await Y();
    contour(leadD.map(fl), { a: 0.66, side: 1, w: 0.56, re: 0.5 });
    contour(leadV.map(fl), { a: 0.68, side: -1, w: 0.56, re: 0.5 });
    for (let k = 1; k < NR - 1; k++) drawRay(sub(rays[k], 0.1, 1), { fin: k > 5 && k < 10 && R() < 0.3 ? 0.7 : 1, w0: 1.9, w1: 0.6, seg: 8.5, joints: true, shadeIt: false, gap: 0.55, spread: 0.05, s1: 0.5 + rs(0.04), s2: 0.78 + rs(0.03) });
    { const trailS = trailL.map(fl); contour(sub(trailS, 0, 0.36), { a: 0.5, side: -1, w: 0.5, re: 0.4, jit: 0.3 }); contour(sub(trailS, 0.64, 1), { a: 0.5, side: -1, w: 0.5, re: 0.4, jit: 0.3 }); }
    // procurrent rays: small spines along the edges of the root
    for (const sg of [1, -1]) for (let k = 0; k < 6; k++) { const b = fl([-30 + k * 5, sg * (17.5 + k * 0.2)]), e = fl([-23 + k * 5.4, sg * (19.5 + k * 0.5)]); stroke([b, e], { a: 0.4, w: 0.32, pt: 'h' }); }
    flush(); await Y();
    /* ---- satellites */
    HIER = 0.92;
    const HS = await headStudy(Y);
    const HD = await handStudy(Y);
    const TS = await sectionStudy(Y);
    const RS = await rayStudy(Y);
    const SS = await scaleStudy(Y);
    await vertStudy(Y);
    thumb(); flush(); await Y();
    HIER = 1;
    /* ---- construction lines, proportion marks, pentimenti */
    const faint = (P, a) => { const n = P.length; let i = 0; while (i < n - 2) { const k = Math.round(rr(14, 60)); stroke(P.slice(i, Math.min(n, i + k)), { a: a * rr(0.6, 1.2), w: 0.42, pt: 'f', trem: 0.1 }); i += k + Math.round(rr(2, 10)); } };
    faint(resample([[226, 233], [618, 251.5]], 1.5), 0.16);
    faint(resample([[146, 166], [612, 166]], 1.5), 0.14);
    for (let k = 0; k <= 8; k++) { const x = 150 + k * 57.6; stroke([[x, 162.5], [x + 0.3, 169.5]], { a: 0.26, w: 0.44, pt: 'c' }); if (k % 2 === 0) letter('i', x + 1.5, 160, 2.6, 0.4); }
    { const cc = sk([[0.5, -5.2]])[0], arc = []; for (let i = 0; i <= 90; i++) { const t = PI * 0.95 + (i / 90) * PI * 1.25; arc.push([cc[0] + Math.cos(t) * 52, cc[1] + Math.sin(t) * 52]); } faint(arc, 0.14); }
    contour(vault.map((p) => [SK.anchor[0] + (p[0] - SK.anchor[0]) * 1.045, SK.anchor[1] + (p[1] - SK.anchor[1]) * 1.045]).slice(20, -40), { a: 0.12, side: 0, w: 0.42, jit: 0.5 });
    { const e0 = [413, 353], d0 = norm2(e0[0] - shoulder[0], e0[1] - shoulder[1]), n0 = [d0[1], -d0[0]]; for (const o of [7, -6.5]) faint(resample([[shoulder[0] + d0[0] * 30 + n0[0] * o, shoulder[1] + d0[1] * 30 + n0[1] * o], [e0[0] - d0[0] * 12 + n0[0] * o, e0[1] - d0[1] * 12 + n0[1] * o]], 1.5), 0.13); }
    faint(C([fl([0, 18]), fl([40, 46]), fl([96, 82]), fl([134, 90])], 1), 0.13);
    // the stylus tried on the margin
    for (let k = 0; k < 9; k++) { const x = 968 + k * 2.1, y = 662 + rs(1); stroke([[x, y], [x + 4.5, y + 6.5]], { a: 0.3 + k * 0.03, w: 0.45, pt: 'h' }); }
    stroke(C([[962, 678], [966, 672], [971, 677], [975, 671], [980, 676]], 0.5), { a: 0.3, w: 0.45, pt: 'c' });
    // scale in old measure: half a braccio, in twelve parts
    { const x0 = 484, x1 = 484 + 0.5 * 58.4 * S, y0 = 671;
      stroke([[x0, y0], [x1, y0 + 0.4]], { a: 0.5, w: 0.48, pt: 'c' }); stroke([[x0, y0 + 2.6], [x1, y0 + 3.0]], { a: 0.4, w: 0.45, pt: 'c' });
      for (let k = 0; k <= 12; k++) { const x = lerp(x0, x1, k / 12); stroke([[x, y0 - (k % 6 === 0 ? 3.5 : 1.5)], [x + 0.2, y0 + 3.0]], { a: 0.45, w: 0.44, pt: 'c' }); }
      for (let k = 0; k < 6; k++) { const x = lerp(x0, x0 + (x1 - x0) / 12, k / 6); stroke([[x, y0 + 0.4], [x, y0 + 2.4]], { a: 0.3, w: 0.4, pt: 'c' }); }
      const F = Form([[[x0, y0 + 0.4], [lerp(x0, x1, 1 / 12), y0 + 0.4], [lerp(x0, x1, 1 / 12), y0 + 2.6], [x0, y0 + 2.6]], [[lerp(x0, x1, 2 / 12), y0 + 0.4], [lerp(x0, x1, 3 / 12), y0 + 0.4], [lerp(x0, x1, 3 / 12), y0 + 2.6], [lerp(x0, x1, 2 / 12), y0 + 2.6]]], [], { res: 2.5, blur: 0.5 });
      shade(F, () => 0.7, { a: 0.5, sp: 0.9, layers: 2, len: [2, 4] });
    }
    flush(); await Y();

    /* ---- the notes, in a cramped mirror hand, written around what is already there */
    const occ = occupancy(2);
    const blocks = [
      { x0: 170, x1: 340, y0: 36, lines: 10, L: 'a', xh: 3.2, sl: 0.3, a: 0.66, w: 0.6 },
      { x0: 497, x1: 584, y0: 34, lines: 17, xh: 2.8, sl: 0.4, a: 0.48, w: 0.52, tol: 0.25 },
      { x0: 684, x1: 894, y0: 168, lines: 5, L: 'c', xh: 3.6, sl: 0.18, a: 0.74, w: 0.68 },
      { x0: 908, x1: 990, y0: 352, lines: 15, L: 'f', xh: 3.0, sl: 0.34, a: 0.55, w: 0.56 },
      { x0: 340, x1: 476, y0: 452, lines: 23, L: 'g', xh: 3.3, sl: 0.26, a: 0.62, w: 0.6, tol: 0.2 },
      { x0: 594, x1: 792, y0: 352, lines: 9, L: 'd', xh: 3.8, sl: 0.22, a: 0.5, w: 0.66 },
      { x0: 700, x1: 868, y0: 612, lines: 7, L: 'e', xh: 2.9, sl: 0.36, a: 0.7, w: 0.55 },
    ];
    for (const b of blocks) {
      if (b.L) letter(b.L, b.x1 - 1, b.y0 + 1, 5.2, 0.75);
      writeBlock({ x0: b.x0, x1: b.x1 - (b.L ? 8 : 0), y0: b.y0, lines: Math.round(b.lines * 3.2 / b.xh), xh: b.xh, lh: b.xh * rr(2.55, 2.85), a: b.a, w: b.w, sl: b.sl, tol: b.tol || 0, mask: occ });
      flush(); await Y();
    }
    // reference letters on the drawings
    const RL = [['a', 284, 300], ['a', 452, 156], ['b', 618, 300], ['c', 666, 300], ['d', 760, 352], ['d', 690, 40], ['e', 840, 560], ['e', 486, 470], ['f', 893, 455], ['f', 960, 160], ['g', 120, 440], ['g', 180, 598]];
    for (const [ch, x, y] of RL) letter(ch, x, y, 4.6, 0.72);
    flush(); await Y();

    /* ---- lead white, laid on last with a small brush */
    const hi = (P, o) => { // along the run of an outline that faces the light
      o = o || {};
      const side = area(P) > 0 ? 1 : -1, Q = resample(closeP(P), 1), T = tangents(Q);
      let best = null, cur = null;
      for (let i = 0; i < Q.length; i++) {
        const nxx = T[i][1] * side, nyy = -T[i][0] * side, f = nxx * LX + nyy * LY;
        if (f > (o.thr || 0.55)) { if (!cur) cur = [i, i]; cur[1] = i; } else if (cur) { if (!best || cur[1] - cur[0] > best[1] - best[0]) best = cur; cur = null; }
      }
      if (cur && (!best || cur[1] - cur[0] > best[1] - best[0])) best = cur;
      if (!best || best[1] - best[0] < (o.min || 5)) return;
      const run = Q.slice(best[0], best[1] + 1).map((p, j) => { const i = best[0] + j; return [p[0] - T[i][1] * side * (o.inset || 1.1), p[1] + T[i][0] * side * (o.inset || 1.1)]; });
      const a0 = o.t0 === undefined ? rr(0.08, 0.25) : o.t0, a1 = o.t1 === undefined ? rr(0.7, 0.92) : o.t1;
      white(sub(run, a0, a1), { w: o.w || 1.1, a: o.a || 0.62 });
    };
    hi(cran, { w: 1.6, a: 0.7, min: 20, inset: 4, t0: 0.22, t1: 0.6 }); hi(cran, { w: 1.1, a: 0.5, min: 20, inset: 7.5, t0: 0.28, t1: 0.5 });
    hi(zyg, { w: 0.9, a: 0.6, inset: 1.5, t0: 0.2, t1: 0.6 }); hi(mand, { w: 0.9, a: 0.45, inset: 2.2, t0: 0.3, t1: 0.6 });
    for (const t of tUp.slice(0, 4)) { const c = bbox([t]); dab((c[0] + c[2]) / 2 - 0.4, (c[1] + c[3]) / 2 - 0.6, 0.6, 0.45); }
    hi(clav, { w: 0.9, a: 0.5, inset: 1.6, t0: 0.25, t1: 0.65 }); hi(hum.poly, { w: 1.5, a: 0.72, inset: 2.6, t0: 0.12, t1: 0.62 }); hi(hum.head, { w: 1.4, a: 0.7, inset: 3, t0: 0.2, t1: 0.75 }); hi(scapSpine, { w: 0.8, a: 0.55, inset: 1.0 }); hi(radius, { w: 0.8, a: 0.42, inset: 1.6, t0: 0.4, t1: 0.75 });
    for (const r of G.ribs) { if (r.i < 2 || r.i > 8 || r.i === 5) continue; const up = xy(r.near.up); white(sub(up, rr(0.34, 0.44), rr(0.55, 0.68)).map((p) => [p[0] + 1.4, p[1] + 0.6]), { w: rr(0.7, 1.0), a: rr(0.5, 0.65) }); }
    for (const V of SP.V) { if (!(V.t === 'L' && V.i % 2 === 0)) continue; const f = VF(V.c, V.dir, S), pr = vParts(V); hi(f(pr.body), { w: 0.8, a: 0.45, min: 4, inset: 1.5, t0: 0.3, t1: 0.7 }); }
    // the back of the tail catches the light along its length; the lateral line glints
    { const ridge = []; for (let s0 = sCut + 6; s0 < sEnd - 20; s0 += 2) ridge.push(tM(s0, 0.72)); let i = 0; while (i < ridge.length - 4) { const k = Math.round(rr(8, 22)); white(ridge.slice(i, Math.min(ridge.length, i + k)), { w: rr(0.9, 1.5), a: rr(0.35, 0.55) }); i += k + Math.round(rr(4, 14)); } }
    for (let s0 = sCut + 20; s0 < sEnd - 10; s0 += rr(16, 30)) { const p = tM(s0, 0.08); dab(p[0], p[1], 0.7, 0.4); }
    for (const k of [1, 2, 3, 5, 6, 8]) { const r = rays[k]; white(sub(r, 0.14, 0.5).map((p) => [p[0] - 0.7, p[1] - 0.7]), { w: 0.9, a: 0.62 }); }
    // brush hatching in lead white on the brightest planes
    whiteHatch(ZF, (x, y) => { const v = tf(x, y); return v > 0 ? sstep(0.2, 0.06, v) : 0; }, { a: 0.42, sp: 2.3, len: [6, 15], ang: -48 });
    whiteHatch(BandF, (x, y) => { const v = tf(x, y); return v > 0 ? sstep(0.24, 0.12, v) * 0.7 : 0; }, { a: 0.45, sp: 1.8 });
    for (const M of MUS) { if (!M.F) continue; const Fm = M.F; whiteHatch(Fm, (x, y) => sstep(0.9, 0.99, Fm.lam(x, y, 1.5)) * sstep(0.3, 0.7, Fm.height(x, y)), { a: 0.55, sp: 1.3, ang: -32 }); if (!M.name.startsWith('serr')) white(M.crest.map((q) => [q[0] - 1.2, q[1] - 1.2]), { w: 1.0, a: 0.6 }); }
    for (const g of scaleGlints) white(sub(g, 0.12, 0.6), { w: 0.75, a: 0.66, core: false });
    { const Fh = Form([HS.sil], [], { res: 1.2, blur: 10 }); whiteHatch(Fh, (x, y) => sstep(0.86, 0.97, Fh.lam(x, y, 1.3)) * (x < 410 ? 1 : 0.2), { a: 0.5, sp: 1.3, ang: -40 }); }
    // head study
    white(HS.forehead.map((p) => [p[0] + 1.3, p[1] + 0.4]), { w: 1.4, a: 0.66 }); white(HS.nose.map((p) => [p[0] + 0.9, p[1] + 0.2]), { w: 1.0, a: 0.66 });
    white(HS.lip.map((p) => [p[0] + 0.6, p[1]]), { w: 0.9, a: 0.6 }); dab(HS.cheek[0], HS.cheek[1], 1.4, 0.45); dab(HS.ear[0], HS.ear[1], 0.8, 0.4);
    for (const k of [0, 1, 4]) white(sub(HS.locks[k], 0.12, 0.38), { w: 0.8, a: 0.48 });
    // hand study: knuckles, tendons, nails, the edge of the webs
    for (const k of HD.knuckles.slice(0, 3)) dab(k[0] - 1.5, k[1] - 1.5, 1.1, 0.5);
    for (const T of HD.tend.slice(1, 3)) white(sub(T, 0.45, 0.72).map((p) => [p[0] - 0.8, p[1] - 0.8]), { w: 0.7, a: 0.4 });
    for (const F of HD.fingerSides) { const tip = at(F.ax, 0.9); if (R() < 0.7) dab(tip[0] - 0.4, tip[1] - 0.4, 0.7, 0.45); }
    for (const w of HD.webs.slice(1, 3)) white(sub(w.edge, 0.3, 0.6).map((p) => [p[0] - 0.6, p[1] - 0.4]), { w: 0.5, a: 0.34 });
    // scales and the section
    { const f = SS.fA; white(f(C([[0.5, -0.55], [0.82, -0.3], [0.9, 0.1]], 0.02)), { w: 1.4, a: 0.6 }); }
    dab(TS.c[0] - 3, TS.c[1] - 3, 1.5, 0.5);
    flush(); await Y();
    /*@@MORE@@*/
  }
  /* ------------------------------------------------------------ mount */
  (window.PIECES = window.PIECES || []).push({
    id: 'sirena',
    title: 'Studies of a Sirena, from the Life, over Three Nights',
    medium: 'Silverpoint, lead white and brown ink on prepared paper',
    note: 'Press and hold anywhere to bring a lens to the sheet',
    about: 'A left-handed anatomist was brought a dead mermaid by fishermen and drew her by candlelight. Every hatching stroke is placed one at a time along the forms, as a stylus would, and then passed through the tooth of a bone-ash ground that can neither forgive nor erase.',
    tone: 'dark',
    room: '#17150f',
    mount(el, api) {
      let dead = false, job = 0;
      el.style.background = 'radial-gradient(ellipse at 50% 40%, #2b2721 0%, #1b1915 58%, #110f0c 100%)';
      el.style.overflow = 'hidden';
      el.style.touchAction = 'none';
      el.style.cursor = 'default';
      const out = document.createElement('canvas');
      out.style.cssText = 'position:absolute;left:0;top:0;transform-origin:0 0;filter:drop-shadow(0 8px 22px rgba(0,0,0,.55)) drop-shadow(0 1px 2px rgba(0,0,0,.45));';
      el.appendChild(out);
      const lens = document.createElement('canvas');
      lens.style.cssText = 'position:absolute;left:0;top:0;border-radius:50%;pointer-events:none;display:none;box-shadow:0 14px 34px rgba(0,0,0,.6),0 0 0 1.5px rgba(30,26,20,.85),0 0 0 3px rgba(180,170,150,.18);';
      el.appendChild(lens);
      const lctx = lens.getContext('2d');

      let lay = null, K = 0, rendered = false, panX = 0;
      const stats = { maxChunk: 0 };
      function layout() {
        const W = el.clientWidth || innerWidth, H = el.clientHeight || innerHeight;
        const portrait = W / H < 0.9;
        let cw, chh;
        if (portrait) { chh = Math.min(H * 0.8, (W * 2.9 * SH) / SW); cw = (chh * SW) / SH; }
        else { const sc = Math.min((W * 0.94) / SW, (H * 0.85) / SH); cw = SW * sc; chh = SH * sc; }
        const l = { W, H, cw, ch: chh, portrait, x: (W - cw) / 2, y: portrait ? (H - chh) / 2 - H * 0.03 : Math.max(10, (H - chh) / 2 - H * 0.04) };
        if (portrait) { l.minX = W - cw - 14; l.maxX = 14; l.x = clamp(W / 2 - cw * 0.36, l.minX, l.maxX); }
        return l;
      }
      function place() {
        if (!lay) return;
        if (lay.portrait) lay.x = clamp(lay.x, lay.minX, lay.maxX);
        out.style.width = lay.cw + 'px'; out.style.height = lay.ch + 'px';
        out.style.transform = 'translate(' + lay.x.toFixed(1) + 'px,' + lay.y.toFixed(1) + 'px)';
      }
      const wantK = (l) => {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        let k = clamp((l.cw * Math.max(dpr, 2)) / SW, 1.6, 3.0);
        const qk = /[?&]sirenaK=([0-9.]+)/.exec(location.search); if (qk) k = +qk[1];
        return k;
      };
      const frame = () => new Promise((res) => requestAnimationFrame(() => res()));
      async function render() {
        const my = ++job;
        lay = layout();
        K = wantK(lay);
        const PW = Math.round(SW * K), PH = Math.round(SH * K);
        R = mulberry32(api.seed >>> 0 || 1);
        let t0 = performance.now();
        const Y = async () => {
          const dt = performance.now() - t0; if (dt > stats.maxChunk) stats.maxChunk = dt;
          if (dt > 36) { await frame(); t0 = performance.now(); }
          if (dead || my !== job) throw new Error('stop');
        };
        const layer = document.createElement('canvas'); layer.width = PW; layer.height = PH;
        LC = layer.getContext('2d', { willReadFrequently: true });
        LC.fillStyle = '#000'; LC.fillRect(0, 0, PW, PH);
        LC.setTransform(K, 0, 0, K, 0, 0);
        B = new Map(); SEGS = 0;
        const ground = document.createElement('canvas'); ground.width = PW; ground.height = PH;
        const gctx = ground.getContext('2d', { willReadFrequently: true });
        gctx.setTransform(K, 0, 0, K, 0, 0);
        drawGround(gctx);
        await Y();
        const tStart = performance.now();
        try { await renderAll(Y); } catch (e) { if (e.message === 'stop') throw e; console.error(e); }
        flush();
        await Y();
        // composite the three channels through the tooth of the ground
        const res = document.createElement('canvas'); res.width = PW; res.height = PH;
        const rc = res.getContext('2d');
        const { wn, vn, P1, P2, st, SN } = TILES; const stK = 1 / K;
        const strip = 64;
        const fx = Math.round(FOLD_X * K);
        for (let y0 = 0; y0 < PH; y0 += strip) {
          const h = Math.min(strip, PH - y0);
          const ya = Math.max(0, y0 - 1), yb = Math.min(PH, y0 + h + 1);
          const Ld = LC.getImageData(0, ya, PW, yb - ya).data;
          const Gd = gctx.getImageData(0, y0, PW, h).data;
          const img = rc.createImageData(PW, h), O = img.data;
          for (let y = 0; y < h; y++) {
            const gy = y0 + y, ly = gy - ya;
            const rowL = ly * PW, rowU = Math.max(0, ly - 1) * PW, rowD = Math.min(yb - ya - 1, ly + 1) * PW;
            const t1 = (gy % P1) * P1, t2 = (gy % P2) * P2;
            for (let x = 0; x < PW; x++) {
              const gi = (y * PW + x) * 4;
              const ga = Gd[gi + 3];
              if (!ga) { O[gi + 3] = 0; continue; }
              const li = (rowL + x) * 4;
              const sv = Ld[li], ik = Ld[li + 1], wh = Ld[li + 2];
              const tooth = wn[t1 + (x % P1)] * 0.45 + vn[t2 + (x % P2)] * 0.55;
              const gm = 1 + (tooth - 0.5) * 0.085 + st[(((gy + Math.sin(x * stK * 0.013) * 9 * K + ((x * stK * 0.004) | 0) * 37) | 0) % SN + SN) % SN] * 0.05;
              let r = Gd[gi] * gm, g = Gd[gi + 1] * gm, b = Gd[gi + 2] * gm;
              if (sv) {
                const sx = (sv / 255) * 2;
                let d = 1 - Math.exp(-3.3 * sx);
                const thr = 0.6 - 0.72 * d;
                let c = (tooth - thr) / 0.2 + 0.5; c = c < 0 ? 0 : c > 1 ? 1 : c;
                let dd = d * (0.32 + 0.68 * c) * 0.84;
                if (x - fx < 2 && fx - x < 2) dd *= 0.6;
                r += (102 - r) * dd; g += (90 - g) * dd; b += (78 - b) * dd;
              }
              const su = Ld[(rowU + (x > 0 ? x - 1 : 0)) * 4], sd = Ld[(rowD + (x < PW - 1 ? x + 1 : x)) * 4];
              if (su !== sd) { const e = (sd - su) * 0.045; r += e; g += e; b += e; }
              if (ik) {
                const sx = ik / 255 / 0.55;
                let d = 1 - Math.exp(-1.5 * sx);
                let c = (tooth - (0.5 - 0.6 * d)) / 0.3 + 0.5; c = c < 0 ? 0 : c > 1 ? 1 : c;
                d *= (0.55 + 0.45 * c) * 0.9;
                r += (96 - r) * d; g += (62 - g) * d; b += (36 - b) * d;
              }
              if (wh) {
                let d = Math.min(1, (wh / 255 / 0.6) * 1.6);
                let c = (tooth - (0.62 - 0.7 * d)) / 0.25 + 0.5; c = c < 0 ? 0 : c > 1 ? 1 : c;
                d *= 0.35 + 0.65 * c;
                r += (246 - r) * d; g += (243 - g) * d; b += (232 - b) * d;
              }
              O[gi] = r; O[gi + 1] = g; O[gi + 2] = b; O[gi + 3] = ga;
            }
          }
          rc.putImageData(img, 0, y0);
          await Y();
        }
        if (dead || my !== job) return;
        out.width = PW; out.height = PH;
        out.getContext('2d').drawImage(res, 0, 0);
        LC = null; layer.width = layer.height = 1; ground.width = ground.height = 1; res.width = res.height = 1;
        place();
        rendered = true;
        stats.ms = Math.round(performance.now() - tStart); stats.segs = SEGS; stats.size = [PW, PH];
        window.__sirena = stats;
        api.ready();
      }
      function go() { render().catch((e) => { if (e.message !== 'stop') { console.error(e); api.ready(); } }); }
      go();

      /* ---- the lens, and (on narrow screens) dragging the sheet sideways */
      const MAG = 2.4;
      let down = null, lensOn = false, holdT = 0;
      function showLens(cx, cy) {
        if (!rendered) return;
        const D = Math.round(Math.min(300, Math.max(170, Math.min(lay.W, lay.H) * 0.36)));
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        if (lens.width !== D * dpr || lens.height !== D * dpr) { lens.width = D * dpr; lens.height = D * dpr; } lens.style.width = D + 'px'; lens.style.height = D + 'px';
        const sx = ((cx - lay.x) / lay.cw) * out.width, sy = ((cy - lay.y) / lay.ch) * out.height;
        const sw = (D / MAG) * (out.width / lay.cw);
        lctx.fillStyle = '#16140f'; lctx.fillRect(0, 0, lens.width, lens.height);
        lctx.imageSmoothingEnabled = true; lctx.imageSmoothingQuality = 'high';
        lctx.drawImage(out, sx - sw / 2, sy - sw / 2, sw, sw, 0, 0, lens.width, lens.height);
        const g = lctx.createRadialGradient(lens.width / 2, lens.height / 2, lens.width * 0.36, lens.width / 2, lens.height / 2, lens.width * 0.5);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.28)');
        lctx.fillStyle = g; lctx.fillRect(0, 0, lens.width, lens.height);
        lens.style.transform = 'translate(' + (cx - D / 2).toFixed(1) + 'px,' + (cy - D / 2 - (down && down.touch ? D * 0.62 : 0)).toFixed(1) + 'px)';
        lens.style.display = 'block';
        lensOn = true;
      }
      function hideLens() { lens.style.display = 'none'; lensOn = false; }
      const rel = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      function onDown(e) {
        if (!lay) return;
        const [x, y] = rel(e), touch = e.pointerType !== 'mouse';
        down = { x, y, px: lay.x, touch, moved: false };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
        clearTimeout(holdT);
        if (!touch || !lay.portrait) showLens(x, y);
        else holdT = setTimeout(() => { if (down && !down.moved) showLens(down.x, down.y); }, 380);
      }
      function onMove(e) {
        if (!down) return;
        const [x, y] = rel(e);
        if (lensOn) { showLens(x, y); return; }
        if (hyp(x - down.x, y - down.y) > 6) down.moved = true;
        if (lay.portrait && down.moved) { lay.x = down.px + (x - down.x); place(); }
      }
      function onUp() { down = null; clearTimeout(holdT); hideLens(); }
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
      el.addEventListener('contextmenu', (e) => e.preventDefault());

      let rT = 0;
      const ro = new ResizeObserver(() => {
        if (!rendered) return;
        const keepX = lay && lay.portrait ? (lay.x - lay.minX) / Math.max(1, lay.maxX - lay.minX) : null;
        lay = layout();
        if (keepX !== null && lay.portrait) lay.x = lerp(lay.minX, lay.maxX, keepX);
        place();
        clearTimeout(rT);
        const nk = wantK(lay);
        if (Math.abs(nk - K) / K > 0.18) rT = setTimeout(go, 500);
      });
      ro.observe(el);

      return {
        destroy() {
          dead = true; job++; ro.disconnect(); clearTimeout(rT); clearTimeout(holdT);
          el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp);
          out.width = out.height = 1;
        },
      };
    },
  });
})();
