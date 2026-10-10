/* 09 · Palimpsest — "One Hill, a Hundred Years"
 *
 * Charcoal and eraser on one sheet, redrawn. Nothing here is a picture: the sheet is a CPU
 * simulation of what charcoal does to paper — loose pigment sitting on the tooth, tone pushed
 * into the valleys by a finger, a ground-in residue no eraser fully lifts, a little red pastel —
 * advanced by a score of gestural strokes made at drawing speed by an unseen hand.
 * A WebGL2 shader lays that state over a procedural cold-press sheet pinned to a studio wall.
 *
 * Debug: ?pal_t=SECONDS fast-forwards deterministically; &pal_freeze stops the clock there.
 */
(function () {
  'use strict';

  /* ================================================================ utilities */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash32() {
    let h = 0x811c9dc5;
    for (let i = 0; i < arguments.length; i++) {
      h = Math.imul(h ^ (arguments[i] >>> 0), 0x01000193);
      h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    }
    return h >>> 0;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;

  function plen(p) { let s = 0; for (let i = 2; i < p.length; i += 2) s += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]); return s; }
  function rev(p) { const o = []; for (let i = p.length - 2; i >= 0; i -= 2) o.push(p[i], p[i + 1]); return o; }

  /* ================================================================ the sheet (simulation) */
  // Four float layers per pixel:
  //   A  loose pigment on the tooth (what a stick leaves; lifts easily)
  //   T  tone: pigment pushed into the valleys by smudging (lifts partly)
  //   G  ground-in residue (almost never lifts — the ghost)
  //   R  red pastel
  const TILE = 64;
  const AMAX = 1.9, GMAX = 1.0;
  function Sim(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.A = new Float32Array(n); this.T = new Float32Array(n);
    this.G = new Float32Array(n); this.R = new Float32Array(n);
    this.tw = Math.ceil(w / TILE); this.th = Math.ceil(h / TILE);
    this.tiles = new Uint8Array(this.tw * this.th);
  }
  Sim.prototype.mark = function (x0, y0, x1, y1) {
    const a = (x0 / TILE) | 0, b = (x1 / TILE) | 0, c = (y0 / TILE) | 0, d = (y1 / TILE) | 0;
    const tw = this.tw, t = this.tiles;
    for (let ty = c; ty <= d; ty++) for (let tx = a; tx <= b; tx++) t[ty * tw + tx] = 1;
  };
  Sim.prototype.clear = function () {
    this.A.fill(0); this.T.fill(0); this.G.fill(0); this.R.fill(0); this.tiles.fill(1);
  };

  // --- charcoal stick: deposits on the tooth, streaked across by the stick's own grain
  function kDraw(sim, cx, cy, r, tx, ty, fl, gf, prof, red) {
    const w = sim.w, h = sim.h;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x0 > x1 || y0 > y1) return;
    const ir = 1 / r, ir2 = ir * ir;
    const L = red ? sim.R : sim.A, G = sim.G, cap = red ? 1.3 : AMAX;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, dyy = dy * dy, dyt = dy * tx;
      let i = y * w + x0;
      for (let x = x0; x <= x1; x++, i++) {
        const dx = x + 0.5 - cx;
        const d2 = (dx * dx + dyy) * ir2;
        if (d2 >= 1) continue;
        const m = 1 - d2 * d2;
        let pi = ((dyt - dx * ty) * ir * 31.5 + 32) | 0;
        if (pi > 63) pi = 63; else if (pi < 0) pi = 0;
        const dep = fl * m * prof[pi];
        L[i] += dep * (cap - L[i]);
        if (!red) G[i] += dep * gf * (GMAX - G[i]);
      }
    }
    sim.mark(x0, y0, x1, y1);
  }

  // --- finger / rag: turns loose pigment into tone and drags it along (carried patch)
  function kSmudge(sim, cx, cy, r, str, conv, st) {
    const w = sim.w, h = sim.h, A = sim.A, T = sim.T, G = sim.G, R = sim.R;
    const P = st.P, half = st.half, cT = st.cT, cR = st.cR;
    const icx = Math.round(cx), icy = Math.round(cy);
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x0 > x1 || y0 > y1) return;
    if (!st.inited) {
      st.inited = true;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x, j = (y - icy + half) * P + (x - icx + half);
        cT[j] = T[i] + A[i] * conv * 0.5; cR[j] = R[i];
      }
    }
    const ir2 = 1 / (r * r);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, dyy = dy * dy;
      let i = y * w + x0, j = (y - icy + half) * P + (x0 - icx + half);
      for (let x = x0; x <= x1; x++, i++, j++) {
        const dx = x + 0.5 - cx;
        const d2 = (dx * dx + dyy) * ir2;
        if (d2 >= 1) continue;
        let m = 1 - d2; m = m * m * str;
        const a = A[i], cv = a * conv * m;
        A[i] = a - cv;
        const t = T[i] + cv * 0.8;
        G[i] += cv * 0.1 * (GMAX - G[i]);
        const c = cT[j];
        T[i] = t + (c - t) * m;
        cT[j] = c + (t - c) * m * 0.85;
        const rr = R[i], cr = cR[j];
        R[i] = rr + (cr - rr) * m * 0.8; cR[j] = cr + (rr - cr) * m * 0.7;
      }
    }
    sim.mark(x0, y0, x1, y1);
  }

  // --- kneaded eraser: lifts loose pigment hard, tone less, the ground-in residue hardly;
  //     streaked along its travel, and a little dirty (drags what it has picked up)
  function kErase(sim, cx, cy, r, tx, ty, lA, lT, lG, lR, prof, st) {
    const w = sim.w, h = sim.h, A = sim.A, T = sim.T, G = sim.G, R = sim.R;
    const P = st.P, half = st.half, cT = st.cT;
    const icx = Math.round(cx), icy = Math.round(cy);
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x0 > x1 || y0 > y1) return;
    if (!st.inited) {
      st.inited = true;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cT[(y - icy + half) * P + (x - icx + half)] = T[y * w + x] * 0.5;
    }
    const ir = 1 / r, ir2 = ir * ir;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy, dyy = dy * dy, dyt = dy * tx;
      let i = y * w + x0, j = (y - icy + half) * P + (x0 - icx + half);
      for (let x = x0; x <= x1; x++, i++, j++) {
        const dx = x + 0.5 - cx;
        const d2 = (dx * dx + dyy) * ir2;
        if (d2 >= 1) continue;
        const m = 1 - d2 * d2 * d2;
        let pi = ((dyt - dx * ty) * ir * 31.5 + 32) | 0;
        if (pi > 63) pi = 63; else if (pi < 0) pi = 0;
        const k = m * prof[pi];
        const t = T[i], c = cT[j];
        const tt = t + (c - t) * 0.08 * m;
        cT[j] = c + (t + A[i] * 0.3 - c) * 0.1 * m;
        A[i] *= 1 - lA * k; T[i] = tt * (1 - lT * k); G[i] *= 1 - lG * k; R[i] *= 1 - lR * k;
      }
    }
    sim.mark(x0, y0, x1, y1);
  }

  // --- a dirty fingerprint pressed onto the margin
  function kPrint(sim, cx, cy, r, ang, amt, rng) {
    const w = sim.w, h = sim.h, T = sim.T, G = sim.G;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
    if (x0 > x1 || y0 > y1) return;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const rings = Math.max(5, r / 2.1);
    const w1 = rng() * TAU, w2 = rng() * TAU, ox = (rng() - 0.5) * 0.3, oy = (rng() - 0.5) * 0.3 - 0.15;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const u = (dx * ca + dy * sa) / (r * 0.72), v = (-dx * sa + dy * ca) / r;
      const rho = Math.sqrt(u * u + v * v);
      if (rho >= 1) continue;
      const uu = u - ox, vv = v - oy;
      const ph = Math.sqrt(uu * uu + vv * vv * 1.3) * rings + 0.35 * Math.sin(Math.atan2(vv, uu) * 2 + w1) + 0.25 * Math.sin(u * 5 + w2);
      const ridge = 0.5 + 0.5 * Math.cos(ph * TAU);
      const e = (1 - rho * rho * rho) * (0.6 + 0.4 * (1 - rho));
      const i = y * w + x;
      T[i] += amt * ridge * ridge * e;
      G[i] += amt * 0.3 * ridge * e * (GMAX - G[i]);
    }
    sim.mark(x0, y0, x1, y1);
  }

  function speck(sim, x, y, a) {
    const w = sim.w, h = sim.h;
    const ix = x | 0, iy = y | 0;
    if (ix < 0 || iy < 0 || ix >= w - 1 || iy >= h - 1) return;
    const i = iy * w + ix;
    sim.A[i] += a * (AMAX - sim.A[i]);
    if (a > 0.45) { sim.A[i + 1] += a * 0.5 * (AMAX - sim.A[i + 1]); sim.A[i + w] += a * 0.4 * (AMAX - sim.A[i + w]); }
    sim.mark(ix, iy, ix + 1, iy + 1);
  }

  /* ================================================================ strokes */
  // tool kinds: 0 charcoal, 1 smudge, 2 eraser, 3 red pastel, 4 fingerprint
  const TOOL = {
    vine:   { k: 0, fl: 0.42, gf: 0.06, prof: 0, sp: 1150, wmin: 0.55, pj: 0.35, dust: 0.004 },
    comp:   { k: 0, fl: 1.3, gf: 0.12, prof: 1, sp: 900, wmin: 0.45, pj: 0.22, dust: 0.03 },
    side:   { k: 0, fl: 0.22, gf: 0.04, prof: 2, sp: 3600, wmin: 0.8, pj: 0.45, dust: 0.012 },
    smudge: { k: 1, fl: 0.3, conv: 0.6, sp: 2600, pj: 0.3 },
    erase:  { k: 2, lA: 0.93, lT: 0.72, lG: 0.1, lR: 0.75, prof: 3, sp: 3000, pj: 0.25 },
    red:    { k: 3, fl: 0.7, prof: 2, sp: 1000, wmin: 0.7, pj: 0.4 },
    print:  { k: 4, sp: 1 },
  };

  function makeProf(rng, type) {
    const p = new Float32Array(64);
    const cells = [9, 5, 15, 11][type];
    const lo = [0.32, 0.78, 0.1, 0.35][type], hi = [1.18, 1.1, 1.35, 1.12][type];
    const v = []; for (let i = 0; i <= cells + 1; i++) v.push(rng());
    for (let i = 0; i < 64; i++) {
      const f = (i / 63) * cells, k = f | 0, t = f - k, s = t * t * (3 - 2 * t);
      const n = lerp(v[k], v[k + 1], s) * 0.72 + rng() * 0.28;
      p[i] = lo + (hi - lo) * n;
    }
    if (type === 0 || type === 2 || type === 3) {
      for (let g = 0; g < 3; g++) { const c = 2 + ((rng() * 58) | 0); p[c] *= 0.25; p[c + 1] *= 0.4; }
    }
    return p;
  }

  function catmull(P, step) {
    const n = P.length >> 1, out = [];
    for (let i = 0; i < n - 1; i++) {
      const i0 = Math.max(0, i - 1), i3 = Math.min(n - 1, i + 2);
      const x0 = P[2 * i0], y0 = P[2 * i0 + 1], x1 = P[2 * i], y1 = P[2 * i + 1];
      const x2 = P[2 * i + 2], y2 = P[2 * i + 3], x3 = P[2 * i3], y3 = P[2 * i3 + 1];
      const d = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(1, Math.ceil(d / step));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, t2 = t * t, t3 = t2 * t;
        out.push(
          0.5 * (2 * x1 + (-x0 + x2) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (-x0 + 3 * x1 - 3 * x2 + x3) * t3),
          0.5 * (2 * y1 + (-y0 + y2) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (-y0 + 3 * y1 - 3 * y2 + y3) * t3));
      }
    }
    out.push(P[2 * n - 2], P[2 * n - 1]);
    return out;
  }
  function linsub(P, step) {
    const n = P.length >> 1, out = [];
    for (let i = 0; i < n - 1; i++) {
      const x1 = P[2 * i], y1 = P[2 * i + 1], x2 = P[2 * i + 2], y2 = P[2 * i + 3];
      const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let s = 0; s < steps; s++) out.push(lerp(x1, x2, s / steps), lerp(y1, y2, s / steps));
    }
    out.push(P[2 * n - 2], P[2 * n - 1]);
    return out;
  }

  // world-space stroke spec -> runnable stroke in sheet pixels
  function compile(sp, X) {
    const T = TOOL[sp.tool];
    const raw = sp.pts, n = raw.length >> 1;
    if (n < 1) return null;
    const P = new Array(raw.length);
    let mnx = 1e9, mny = 1e9, mxx = -1e9, mxy = -1e9;
    for (let i = 0; i < n; i++) {
      const x = (raw[2 * i] - X.ox) * X.k, y = (raw[2 * i + 1] - X.oy) * X.k;
      P[2 * i] = x; P[2 * i + 1] = y;
      if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y;
    }
    const r0 = Math.max(0.62, sp.w * X.k);
    const pad = r0 * 3 + 4;
    if (mxx < -pad || mny < -pad || mnx > X.w + pad || mxy > X.h + pad) return null;
    const rng = mulberry32(sp.seed);
    const st = { k: T.k, t0: sp.t0, t1: sp.t1, done: 0, seg: 0, rng, r: r0 };
    if (T.k === 4) {
      st.pts = new Float32Array([P[0], P[1], P[0] + 0.01, P[1]]); st.cum = new Float32Array([0, 0.01]);
      st.len = 0.01; st.nseg = 1; st.nd = 1; st.sp = 1; st.amt = 0.28 * sp.f; st.ang = rng() * TAU;
      return st;
    }
    let Q;
    if (n === 1) Q = [P[0], P[1], P[0] + 0.3, P[1] + 0.1];
    else Q = (sp.smooth && n > 2) ? catmull(P, 1.6) : linsub(P, 1.6);
    const m = Q.length >> 1;
    const pts = new Float32Array(Q), cum = new Float32Array(m);
    for (let i = 1; i < m; i++) cum[i] = cum[i - 1] + Math.hypot(Q[2 * i] - Q[2 * i - 2], Q[2 * i + 1] - Q[2 * i - 1]);
    st.pts = pts; st.cum = cum; st.len = cum[m - 1]; st.nseg = m - 1;
    const spacing = T.k === 1 ? 0.22 : T.k === 2 ? 0.3 : 0.26;
    st.sp = Math.max(0.33, r0 * spacing);
    st.nd = Math.max(1, Math.floor(st.len / st.sp) + 1);
    st.p0 = sp.p0 !== undefined ? sp.p0 : 0.45 + rng() * 0.5;
    st.p1 = sp.p1 !== undefined ? sp.p1 : 0.15 + rng() * 0.45;
    st.tin = sp.tin !== undefined ? sp.tin : 0.08 + rng() * 0.1;
    st.tout = sp.tout !== undefined ? sp.tout : 0.18 + rng() * 0.2;
    st.pj = T.pj;
    st.pn = new Float32Array(18);
    for (let i = 0; i < 18; i++) st.pn[i] = rng() * 2 - 1;
    st.wmin = T.wmin || 0.6;
    const f = sp.f;
    if (T.k === 0 || T.k === 3) {
      st.fl = T.fl * f; st.gf = T.gf || 0; st.prof = makeProf(rng, T.prof); st.dust = T.dust || 0;
    } else if (T.k === 1) {
      st.str = clamp(T.fl * f, 0, 0.9); st.conv = T.conv;
    } else if (T.k === 2) {
      // per-dab lift so one pass removes ~lA at the centre regardless of spacing
      const e = st.sp / (1.5 * r0);
      const ff = Math.max(0.02, f);
      const pa = 1 - Math.pow(1 - T.lA, ff), pt = 1 - Math.pow(1 - T.lT, ff), pg = 1 - Math.pow(1 - T.lG, ff), pr = 1 - Math.pow(1 - T.lR, ff);
      st.lA = 1 - Math.pow(1 - pa, e); st.lT = 1 - Math.pow(1 - pt, e); st.lG = 1 - Math.pow(1 - pg, e); st.lR = 1 - Math.pow(1 - pr, e);
      st.prof = makeProf(rng, 3);
    }
    if (T.k === 1 || T.k === 2) {
      const half = Math.ceil(r0) + 3;
      st.half = half; st.P = half * 2 + 1;
      st.cT = new Float32Array(st.P * st.P); st.cR = new Float32Array(st.P * st.P); st.inited = false;
    }
    return st;
  }

  function press(st, u) {
    let p;
    if (u < st.tin) p = lerp(st.p0, 1, sstep(0, 1, u / st.tin));
    else if (u > 1 - st.tout) p = lerp(1, st.p1, sstep(0, 1, (u - 1 + st.tout) / st.tout));
    else p = 1;
    const f = u * 16, k = f | 0, t = f - k;
    const nz = st.pn[k] + (st.pn[k + 1] - st.pn[k]) * t;
    return Math.max(0.02, p * (1 + st.pj * nz));
  }

  function applyDabs(sim, st, upto) {
    const pts = st.pts, cum = st.cum;
    let seg = st.seg;
    if (st.k === 4) { kPrint(sim, pts[0], pts[1], st.r, st.ang, st.amt, st.rng); st.done = 1; return; }
    for (let i = st.done; i < upto; i++) {
      const s = Math.min(i * st.sp, st.len);
      while (seg < st.nseg - 1 && cum[seg + 1] < s) seg++;
      const a = seg * 2, ds = cum[seg + 1] - cum[seg];
      const f = ds > 0 ? (s - cum[seg]) / ds : 0;
      const x0 = pts[a], y0 = pts[a + 1], x1 = pts[a + 2], y1 = pts[a + 3];
      const cx = x0 + (x1 - x0) * f, cy = y0 + (y1 - y0) * f;
      let tx = x1 - x0, ty = y1 - y0; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const p = press(st, st.len > 0 ? s / st.len : 0);
      if (st.k === 0 || st.k === 3) {
        const r = Math.max(0.6, st.r * (st.wmin + (1 - st.wmin) * Math.min(1.3, p)));
        const fl = Math.min(0.85, st.fl * p * st.sp / (1.5 * r));
        kDraw(sim, cx, cy, r, tx, ty, fl, st.gf, st.prof, st.k === 3);
        if (st.dust && st.rng() < st.dust * p) {
          const ang = st.rng() * TAU, d = r * (1 + st.rng() * 2.5);
          speck(sim, cx + Math.cos(ang) * d, cy + Math.sin(ang) * d, 0.2 + st.rng() * 0.6);
        }
      } else if (st.k === 1) {
        kSmudge(sim, cx, cy, st.r, st.str * Math.min(1.2, p), st.conv, st);
      } else {
        const q = Math.min(1.2, p);
        kErase(sim, cx, cy, st.r, tx, ty, st.lA * q, st.lT * q, st.lG * q, st.lR * q, st.prof, st);
      }
    }
    st.seg = seg; st.done = upto;
  }

  /* ================================================================ score (the hand) */
  function Score(rng, t) { this.r = rng; this.t = t; this.out = []; }
  Score.prototype.mk = function (tool, pts, w, o) {
    o = o || {};
    return { tool, pts, w, f: o.f === undefined ? 1 : o.f, p0: o.p0, p1: o.p1, tin: o.tin, tout: o.tout,
      smooth: o.smooth !== false, seed: (this.r() * 4294967296) >>> 0, t0: 0, t1: 0, main: false };
  };
  Score.prototype.go = function (tool, pts, w, o) {
    const s = this.mk(tool, pts, w, o);
    const gap = o && o.gap !== undefined ? o.gap : 0.015 + this.r() * 0.035;
    const v = (o && o.speed) || TOOL[tool].sp;
    s.t0 = this.t + gap; s.t1 = s.t0 + Math.max(0.025, plen(pts) / v);
    this.t = s.t1; s.main = true;
    this.out.push(s); return s;
  };
  Score.prototype.at = function (t, tool, pts, w, o) {
    const s = this.mk(tool, pts, w, o);
    const v = (o && o.speed) || TOOL[tool].sp;
    s.t0 = t; s.t1 = t + Math.max(0.025, plen(pts) / v);
    this.out.push(s); return s;
  };
  Score.prototype.wait = function (d) { this.t += d; };

  /* ---------------------------------------------------------------- drawing vocabulary */
  // a hand-ruled line: slight bow, overshoot at both ends
  function sl(S, x0, y0, x1, y1, bow, over) {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const e0 = (over || 0) * (0.2 + S.r()), e1 = (over || 0) * (0.2 + S.r());
    const b = (bow || 0) * (S.r() - 0.5) * 2;
    return [x0 - ux * e0, y0 - uy * e0, (x0 + x1) / 2 - uy * b, (y0 + y1) / 2 + ux * b, x1 + ux * e1, y1 + uy * e1];
  }
  function ell(S, cx, cy, rx, ry, a0, a1, n, wob) {
    const o = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n, k = 1 + (S.r() - 0.5) * (wob || 0);
      o.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
    }
    return o;
  }
  function rectPoly(x0, y0, x1, y1) { return [x0, y0, x1, y0, x1, y1, x0, y1]; }
  function ellPoly(cx, cy, rx, ry, n) { const o = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; o.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry); } return o; }

  // parallel lines at angle `ang` clipped to polygon -> [[x0,y0,x1,y1], ...]
  function clipLines(poly, ang, gap, jit, rng) {
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    const n = poly.length >> 1;
    let dmin = Infinity, dmax = -Infinity;
    for (let i = 0; i < n; i++) { const d = poly[2 * i] * nx + poly[2 * i + 1] * ny; if (d < dmin) dmin = d; if (d > dmax) dmax = d; }
    const segs = [];
    for (let d = dmin + gap * (0.25 + 0.5 * rng()); d < dmax; d += gap * (1 + (rng() - 0.5) * jit)) {
      const ts = [];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = poly[2 * i], ay = poly[2 * i + 1], bx = poly[2 * j], by = poly[2 * j + 1];
        const da = ax * nx + ay * ny - d, db = bx * nx + by * ny - d;
        if ((da < 0) !== (db < 0)) { const f = da / (da - db); ts.push((ax + (bx - ax) * f) * dx + (ay + (by - ay) * f) * dy); }
      }
      ts.sort((a, b) => a - b);
      for (let k = 0; k + 1 < ts.length; k += 2) segs.push([d * nx + ts[k] * dx, d * ny + ts[k] * dy, d * nx + ts[k + 1] * dx, d * ny + ts[k + 1] * dy]);
    }
    return segs;
  }
  function zig(segs) {
    const o = [];
    segs.forEach((s, i) => { if (i % 2) o.push(s[2], s[3], s[0], s[1]); else o.push(s[0], s[1], s[2], s[3]); });
    return o;
  }
  // quick hatching: separate flicked strokes
  function hatch(S, poly, ang, gap, w, tool, o) {
    o = o || {};
    const segs = clipLines(poly, ang, gap, 0.35, S.r);
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i];
      const L = Math.hypot(s[2] - s[0], s[3] - s[1]);
      if (L < 1.5) continue;
      const back = o.alt && i % 2;
      const a = back ? [s[2], s[3], s[0], s[1]] : s.slice();
      // flick: tiny hook at the end
      const hx = -(a[3] - a[1]) / L * L * 0.06 * (S.r() - 0.3), hy = (a[2] - a[0]) / L * L * 0.06 * (S.r() - 0.3);
      S.go(tool, [a[0], a[1], lerp(a[0], a[2], 0.6), lerp(a[1], a[3], 0.6), a[2] + hx, a[3] + hy], w,
        { f: o.f, p0: 0.9, p1: 0.15, tin: 0.05, tout: 0.45, gap: o.gap !== undefined ? o.gap : 0.012 + S.r() * 0.02, speed: o.speed || 1500 });
    }
  }
  function zigFill(S, tool, poly, ang, gap, w, o) {
    const segs = clipLines(poly, ang, gap, 0.25, S.r);
    if (!segs.length) return;
    S.go(tool, zig(segs), w, Object.assign({ smooth: false, p0: 0.8, p1: 0.6, tin: 0.05, tout: 0.1 }, o || {}));
  }
  function toneFill(S, poly, ang, w, f, o) {
    const segs = clipLines(poly, ang, w * 1.25, 0.3, S.r);
    segs.forEach((s, i) => S.go('side', i % 2 ? [s[2], s[3], s[0], s[1]] : s, w,
      Object.assign({ f, gap: 0.008, p0: 0.6, p1: 0.5, tin: 0.15, tout: 0.25 }, o || {})));
  }
  // meandering looped scribble filling an ellipse (foliage, wool, smoke)
  function loopsPts(S, cx, cy, rx, ry, lr, rows) {
    const out = [], r = S.r;
    rows = rows || Math.max(1, Math.round(ry * 2 / (lr * 2.1)));
    let ph = r() * TAU;
    for (let j = 0; j < rows; j++) {
      const v = rows === 1 ? 0 : (j / (rows - 1)) * 2 - 1;
      const half = Math.sqrt(Math.max(0.05, 1 - v * v * 0.8)) * Math.max(lr, rx - lr * 0.5);
      const yy = cy + v * Math.max(0, ry - lr * 0.7);
      const dir = j % 2 ? -1 : 1;
      const xs = cx - half * dir, xe = cx + half * dir;
      const n = Math.max(1, Math.round(Math.abs(xe - xs) / (lr * 1.15)));
      const sub = 5;
      for (let k = 0; k <= n * sub; k++) {
        const t = k / (n * sub);
        ph += (TAU / sub) * dir;
        const rr = lr * (0.55 + 0.6 * r());
        out.push(lerp(xs, xe, t) + Math.cos(ph) * rr, yy + Math.sin(ph) * rr * 0.8);
      }
    }
    return out;
  }
  function scumble(S, cx, cy, rx, ry, len, lr) {
    const r = S.r, o = [];
    let a = r() * TAU, x = cx + (r() - 0.5) * rx, y = cy + (r() - 0.5) * ry, curl = (r() - 0.5) * 0.9;
    const step = Math.max(0.6, lr * 0.45);
    const n = Math.max(4, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      if (i % 7 === 0) curl = (r() - 0.5) * 1.4;
      a += curl + (r() - 0.5) * 0.5;
      x += Math.cos(a) * step; y += Math.sin(a) * step * 0.85;
      const ex = (x - cx) / rx, ey = (y - cy) / ry;
      if (ex * ex + ey * ey > 1) a = Math.atan2(cy - y, cx - x) + (r() - 0.5) * 1.2;
      o.push(x, y);
    }
    return o;
  }
  function grassTuft(S, x, y, h, n, w, tool) {
    const r = S.r;
    const lean0 = (r() - 0.5) * 0.6;
    n = Math.round(n * 1.4) + 1;
    for (let i = 0; i < n; i++) {
      const bx = x + (r() - 0.5) * h * 0.4;
      const a = -Math.PI / 2 + lean0 + (i - (n - 1) / 2) * 0.12 + (r() - 0.5) * 0.35;
      const hh = h * (0.35 + r() * 0.75);
      const bend = (r() - 0.5) * 0.6;
      const mx = bx + Math.cos(a) * hh * 0.5, my = y + Math.sin(a) * hh * 0.5;
      const ex = bx + Math.cos(a + bend) * hh, ey = y + Math.sin(a + bend) * hh;
      S.go(tool || 'comp', [bx, y + 1, mx, my, ex, ey], w * (0.55 + r() * 0.4), { p0: 1, p1: 0.03, tin: 0.04, tout: 0.7, gap: 0.003, speed: 1800 });
    }
  }
  function smear(S, pts, w, f, o) { S.go('smudge', pts, w, Object.assign({ f, p0: 0.7, p1: 0.4, tin: 0.2, tout: 0.3 }, o || {})); }
  function rub(S, pts, w, f, o) { S.go('erase', pts, w, Object.assign({ f, p0: 0.8, p1: 0.7, tin: 0.05, tout: 0.1 }, o || {})); }
  // scrub an area out with a kneaded eraser
  function scrub(S, poly, ang, w, f, o) {
    const segs = clipLines(poly, ang, w * 1.05, 0.2, S.r);
    if (segs.length) rub(S, zig(segs), w, f, Object.assign({ smooth: false }, o || {}));
  }
  function scrubAt(S, t, poly, ang, w, f) {
    const segs = clipLines(poly, ang, w * 1.05, 0.2, S.r);
    if (segs.length) S.at(t, 'erase', zig(segs), w, { f, smooth: false, p0: 0.9, p1: 0.8, tin: 0.05, tout: 0.1 });
  }

  /* ---------------------------------------------------------------- lettering */
  const DIG = {
    '0': [[0.32, 0.02, 0.1, 0.18, 0.04, 0.55, 0.14, 0.9, 0.33, 1.0, 0.52, 0.82, 0.57, 0.42, 0.47, 0.08, 0.3, 0.03]],
    '1': [[0.1, 0.24, 0.34, 0.0, 0.32, 1.0]],
    '2': [[0.05, 0.22, 0.2, 0.03, 0.42, 0.03, 0.53, 0.2, 0.46, 0.45, 0.2, 0.75, 0.02, 1.0, 0.58, 0.97]],
    '3': [[0.05, 0.1, 0.3, 0.0, 0.5, 0.12, 0.46, 0.34, 0.24, 0.45, 0.5, 0.57, 0.56, 0.82, 0.36, 1.0, 0.04, 0.92]],
    '4': [[0.44, 1.0, 0.44, 0.0, 0.02, 0.68, 0.6, 0.68]],
    '5': [[0.54, 0.02, 0.13, 0.03, 0.08, 0.43, 0.34, 0.36, 0.55, 0.55, 0.52, 0.86, 0.3, 1.0, 0.03, 0.9]],
    '6': [[0.5, 0.04, 0.25, 0.12, 0.08, 0.45, 0.1, 0.86, 0.3, 1.0, 0.51, 0.85, 0.5, 0.6, 0.3, 0.48, 0.09, 0.62]],
    '7': [[0.02, 0.03, 0.57, 0.02, 0.33, 0.48, 0.22, 1.0]],
    '8': [[0.3, 0.47, 0.1, 0.32, 0.12, 0.09, 0.3, 0.0, 0.48, 0.1, 0.47, 0.31, 0.3, 0.47, 0.08, 0.66, 0.1, 0.92, 0.3, 1.0, 0.53, 0.9, 0.52, 0.66, 0.3, 0.47]],
    '9': [[0.52, 0.34, 0.32, 0.5, 0.1, 0.42, 0.08, 0.15, 0.28, 0.0, 0.5, 0.12, 0.53, 0.42, 0.46, 0.76, 0.28, 1.0, 0.08, 0.92]],
  };
  const LET = {
    O: [[0.36, 0.0, 0.08, 0.15, 0.02, 0.55, 0.16, 0.92, 0.38, 1.0, 0.6, 0.85, 0.68, 0.45, 0.56, 0.08, 0.34, 0.02]],
    A: [[0.0, 1.0, 0.35, 0.0, 0.7, 1.0], [0.16, 0.62, 0.56, 0.62]],
    K: [[0.06, 0.0, 0.06, 1.0], [0.6, 0.0, 0.08, 0.6], [0.26, 0.44, 0.64, 1.0]],
    H: [[0.06, 0.0, 0.06, 1.0], [0.6, 0.0, 0.6, 1.0], [0.06, 0.5, 0.6, 0.5]],
    I: [[0.15, 0.0, 0.15, 1.0]],
    L: [[0.06, 0.0, 0.06, 1.0, 0.56, 1.0]],
    E: [[0.56, 0.0, 0.06, 0.0, 0.06, 1.0, 0.56, 1.0], [0.06, 0.5, 0.46, 0.5]],
    N: [[0.06, 1.0, 0.06, 0.0, 0.62, 1.0, 0.62, 0.0]],
    W: [[0.0, 0.0, 0.18, 1.0, 0.38, 0.35, 0.58, 1.0, 0.76, 0.0]],
    M: [[0.05, 1.0, 0.05, 0.0, 0.36, 0.62, 0.67, 0.0, 0.67, 1.0]],
    S: [[0.56, 0.12, 0.32, 0.0, 0.08, 0.14, 0.14, 0.4, 0.46, 0.55, 0.58, 0.8, 0.36, 1.0, 0.04, 0.88]],
  };
  const ADV = { I: 0.42, M: 0.86, W: 0.9, ' ': 0.45 };
  function letters(S, str, x, y, hgt, w, glyphs, slant, tool) {
    let cx = x;
    for (const ch of str) {
      const g = glyphs[ch];
      if (g) for (const stroke of g) {
        const p = [];
        for (let i = 0; i < stroke.length; i += 2) {
          const gy = stroke[i + 1];
          p.push(cx + stroke[i] * hgt + (1 - gy) * hgt * slant + (S.r() - 0.5) * hgt * 0.04, y + gy * hgt + (S.r() - 0.5) * hgt * 0.04);
        }
        S.go(tool || 'comp', p, w, { p0: 1, p1: 0.4, tin: 0.06, tout: 0.3, speed: 520, smooth: stroke.length > 6, gap: 0.03 });
      }
      cx += (ADV[ch] || 0.74) * hgt;
    }
    return cx;
  }

  /* ================================================================ the land */
  function makeLand(seed, lay) {
    const r = mulberry32(hash32(seed, 101));
    const cx = 835 + (r() - 0.5) * 50;
    const top = 338 + (r() - 0.5) * 26;
    const sL = 290 + r() * 35, sR = 205 + r() * 30;
    const shX = cx - 260 - r() * 40, shH = 32 + r() * 22, shS = 95 + r() * 25;
    const kX = cx + 185 + r() * 40, kH = 8 + r() * 8;
    const p1 = r() * TAU, p2 = r() * TAU, p3 = r() * TAU;
    const base = 604;
    const hor = (x) => base + 3.2 * Math.sin(x * 0.0043 + p1) + 1.5 * Math.sin(x * 0.0131 + p2);
    const Hh = base - top;
    const hill = (x) => {
      const u = x - cx, s = u < 0 ? sL : sR;
      const g = Math.pow(Math.exp(-(u * u) / (2 * s * s)), 0.85);
      const g2 = Math.exp(-((x - shX) * (x - shX)) / (2 * shS * shS));
      const g3 = Math.exp(-((x - kX) * (x - kX)) / (2 * 40 * 40));
      return hor(x) - Hh * g - shH * g2 * (1 - g) - kH * g3 + 2.2 * Math.sin(x * 0.034 + p3) * g;
    };
    const L = {
      cx, top, hor, hill, seed,
      footL: cx - 2.5 * sL, footR: cx + 2.55 * sR,
      x0: lay.wx0, y0: lay.wy0, x1: lay.wx0 + lay.W, y1: lay.wy0 + lay.H, W: lay.W, H: lay.H,
    };
    L.treeX = cx + 16 + (r() - 0.5) * 18;
    L.treeY = hill(L.treeX) + 2;
    L.sc = (y) => clamp((y - 598) / 400, 0.03, 2.2);
    L.cxl = (x, m) => clamp(x, L.x0 + (m || 60), L.x1 - (m || 60));
    return L;
  }
  function hillPts(L, xa, xb, step, S, jit) {
    const o = [];
    for (let x = xa; x <= xb + 0.1; x += step) o.push(x, L.hill(x) + (S ? (S.r() - 0.5) * jit : 0));
    return o;
  }
  function hillPoly(L) {
    const p = hillPts(L, L.footL, L.footR, 12);
    for (let x = L.footR; x >= L.footL; x -= 24) p.push(x, L.hor(x) + 3);
    return p;
  }

  /* ---------------------------------------------------------------- motifs */
  function hatchGroup(S, x, y, ang, len, n, gap, w, tool, o) {
    o = o || {};
    const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * gap * (0.75 + S.r() * 0.5);
      const l = len * (0.6 + S.r() * 0.6);
      const s0 = (S.r() - 0.5) * len * 0.35;
      const ax = x + nx * off + dx * s0, ay = y + ny * off + dy * s0;
      const bx = ax + dx * l, by = ay + dy * l;
      const hk = (S.r() - 0.3) * l * 0.1;
      S.go(tool || 'comp', [ax, ay, lerp(ax, bx, 0.55) + nx * hk * 0.25, lerp(ay, by, 0.55) + ny * hk * 0.25, bx + nx * hk, by + ny * hk], w,
        { f: o.f, p0: 0.95, p1: 0.1, tin: 0.04, tout: 0.5, gap: 0.005 + S.r() * 0.012, speed: o.speed || 1800 });
    }
  }
  function hillContour(S, L, first) {
    const r = S.r;
    if (first) {
      // the first gestures: loose searching sweeps, then the decisive line
      S.go('vine', hillPts(L, L.footL + 20, L.footR - 10, 46, S, 9), 1.8, { p0: 0.5, p1: 0.4, speed: 1300, gap: 0.3 });
      S.go('vine', hillPts(L, L.footL + 90, L.footR - 70, 50, S, 12).map((v, i) => (i % 2 ? v - 4 : v)), 1.6, { p0: 0.4, p1: 0.5, speed: 1500 });
    }
    const mid = L.cx + (r() - 0.5) * 80;
    S.go('comp', hillPts(L, L.footL + 10 + r() * 40, mid + 40, 20, S, 2.2), 3.0, { p0: 0.5, p1: 0.9, tin: 0.15, tout: 0.1, speed: 800 });
    S.go('comp', hillPts(L, mid - 30, L.footR - r() * 40, 20, S, 2.2), 3.3, { p0: 1, p1: 0.3, tin: 0.04, tout: 0.35, speed: 800 });
    // a second, broken pass on the crest where the eye goes
    S.go('comp', hillPts(L, L.cx - 160 - r() * 40, L.cx + 120 + r() * 50, 18, S, 3).map((v, i) => (i % 2 ? v - 1.5 : v)), 2.2, { p0: 0.3, p1: 0.2, tin: 0.4, tout: 0.4, speed: 1100 });
  }
  function horizon(S, L) {
    const r = S.r;
    const segs = [[L.x0 + 30, L.footL + 60], [L.footR - 40, L.x1 - 30]];
    for (const [a, b] of segs) {
      if (b - a < 30) continue;
      let x = a;
      while (x < b) {
        const e = Math.min(b, x + 180 + r() * 300);
        const p = []; for (let xx = x; xx <= e; xx += 30) p.push(xx, L.hor(xx) + (r() - 0.5) * 2);
        if (p.length >= 4) S.go('comp', p, 1.3, { f: 0.8, p0: 0.7, p1: 0.3, speed: 1600 });
        x = e + 8 + r() * 40;
      }
      // hedges and far copses: small dark smudgy bumps sitting on the line
      let hx = a + r() * 50;
      while (hx < b - 20) {
        const hw = 8 + r() * 26, hh = 3 + r() * 6;
        S.go('side', loopsPts(S, hx, L.hor(hx) - hh * 0.5, hw, hh, 2.4, 1), 2.2, { f: 1.8, speed: 1600, gap: 0.01 });
        hx += 40 + r() * 120;
      }
    }
    // the far plain, a pale band
    for (const [a, b] of segs) if (b - a > 40) S.go('side', [a, L.hor(a) + 7, (a + b) / 2, L.hor((a + b) / 2) + 9, b, L.hor(b) + 7], 6, { f: 0.5, speed: 3000 });
  }
  function sky(S, L, amt) {
    const r = S.r;
    const X0 = L.x0 + 28, X1 = L.x1 - 28, Y0 = L.y0 + 30;
    const Hs = 585 - Y0;
    // broad strokes from the top, leaning with the wind, laid heaviest at the upper left
    for (let i = 0; i < 9; i++) {
      const y = Y0 + 4 + i * (Hs * 0.42 / 9) + r() * 14;
      const xa = X0 + r() * 60, xb = X1 - r() * 160 - i * 50;
      const tilt = -0.03 - r() * 0.04;
      const p = [xa, y, (xa + xb) / 2, y + (xb - xa) * tilt * 0.5 + (r() - 0.5) * 18, xb, y + (xb - xa) * tilt];
      S.go('side', p, 18 + r() * 9, { f: (1.25 - i * 0.11) * amt, p0: 1.0, p1: 0.15, tin: 0.08, tout: 0.75, gap: 0.01 });
    }
    // the rag, in long sweeps: the strokes become weather
    smear(S, zig(clipLines(rectPoly(X0, Y0, X1, Y0 + Hs * 0.55), -0.04, 46, 0.35, r)), 44, 1.0, { speed: 3600, smooth: true });
    // two or three cloud masses, soft, with lit tops and heavy bellies
    const nb = r() < 0.5 ? 1 : 2;
    for (let b = 0; b < nb; b++) {
      const cy = Y0 + Hs * (0.3 + 0.42 * (b + 0.15 + r() * 0.7) / nb);
      const cw = (X1 - X0) * (0.3 + r() * 0.2);
      let cx = X0 + cw * 0.5 + r() * (X1 - X0 - cw);
      if (Math.abs(cx - L.treeX) < cw * 0.5 + 220 && cy > Y0 + Hs * 0.35) cx = L.treeX + (cx < L.treeX ? -1 : 1) * (cw * 0.5 + 240);
      const ch = 18 + r() * 16;
      for (let k = 0; k < 6; k++) {
        const yy = cy - ch * 0.45 + k * ch * 0.2, xa = cx - cw * 0.5 + cw * (0.06 * k + r() * 0.2), xb = xa + cw * (0.35 + r() * 0.5);
        S.go('side', [xa, yy + (r() - 0.5) * 6, lerp(xa, xb, 0.4), yy - 3 + (r() - 0.5) * 6, xb, yy + (r() - 0.5) * 6], 9 + k * 2, { f: (0.3 + k * 0.16) * amt, p0: 0.5, p1: 0.4, tin: 0.3, tout: 0.5, speed: 3000, gap: 0.01 });
      }
      smear(S, [cx - cw * 0.5, cy - ch * 0.1, cx, cy + ch * 0.05, cx + cw * 0.7, cy + ch * 0.15], ch * 0.9, 1.0, { speed: 2000, p0: 1.0, p1: 0.5 });
      smear(S, [cx + cw * 0.6, cy + ch * 0.25, cx, cy + ch * 0.3, cx - cw * 0.6, cy + ch * 0.2], ch * 0.7, 0.8, { speed: 2000, p0: 1.0, p1: 0.5 });
      rub(S, [cx - cw * 0.45, cy - ch * 0.45, cx - cw * 0.1, cy - ch * 0.6, cx + cw * 0.2, cy - ch * 0.5], ch * 0.2, 0.7, { speed: 2400 });
    }
    // keep a breath of light behind the crest; a few long lifted streaks
    const tx = L.treeX, ty = L.treeY;
    rub(S, ell(S, tx, ty, 260, 200, Math.PI * 1.08, Math.PI * 1.92, 16, 0.05), 34, 0.6 * amt, { speed: 3000 });
    rub(S, ell(S, tx, ty, 170, 140, Math.PI * 1.1, Math.PI * 1.9, 12, 0.05), 28, 0.6 * amt, { speed: 3000 });
    for (let k = 0; k < 4; k++) {
      const yy = Y0 + Hs * (0.12 + r() * 0.4), xa = X0 + r() * (X1 - X0) * 0.7, xb = xa + 180 + r() * 420;
      rub(S, [xa, yy, (xa + xb) / 2, yy - 6 + r() * 8, xb, yy - 10 + (r() - 0.5) * 8], 3 + r() * 5, 0.9, { speed: 2800 });
    }
  }
  function hillTone(S, L, amt) {
    const r = S.r;
    // body: contour-following side strokes, heavier on the right flank
    for (let d = 6; d < 260; d += 13 + r() * 7) {
      const p = [];
      for (let x = L.footL + 30; x <= L.footR - 20; x += 22) {
        const y = L.hill(x) + d * (0.55 + 0.45 * sstep(L.footL, L.cx, x));
        if (y < L.hor(x) - 3) p.push(x, y + (r() - 0.5) * 3);
        else if (p.length) break;
      }
      if (p.length < 6) continue;
      S.go('side', p, 11 + r() * 6, { f: (1.0 + r() * 0.5) * amt, p0: 0.3, p1: 1.3, tin: 0.8, tout: 0.06, gap: 0.01 });
    }
    // rubbed into one mass down the slope
    S.go('smudge', zig(clipLines(hillPoly(L), -0.6, 26, 0.3, r)), 26, { f: 0.7, smooth: true, speed: 3600 });
    // hatching down the shadowed flank, in hand-sized groups along the fall line
    for (let x = L.cx + 20; x < L.footR - 70; x += 34 + r() * 26) {
      const y = L.hill(x) + 10 + r() * 30;
      const depth = L.hor(x) - y;
      if (depth < 20) continue;
      const slope = Math.atan2(L.hill(x + 8) - L.hill(x - 8), 16);
      hatchGroup(S, x, y + depth * 0.2, slope + 0.55 + (r() - 0.5) * 0.3, Math.min(46, depth * 0.45), 3 + ((r() * 4) | 0), 5, 1.0, 'comp', { f: 0.6 * amt });
    }
    // the lit left flank: lifted back toward the paper in long arcs
    for (let k = 0; k < 3; k++) {
      const xa = L.footL + 110 + k * 40 + r() * 30, xb = L.cx - 40 - k * 30;
      const p = []; for (let x = xa; x <= xb; x += 28) p.push(x, L.hill(x) + 14 + k * 20 + (r() - 0.5) * 6);
      if (p.length >= 4) rub(S, p, 10 + r() * 6, 0.45 * amt + 0.15, { speed: 2600 });
    }
    // a path climbs to the tree, kept open with the eraser's edge
    const pth = [];
    for (let k = 0; k <= 9; k++) {
      const t = k / 9, x = lerp(L.footL + 190, L.treeX - 8, t);
      pth.push(x + Math.sin(t * 8 + 1) * 22 * (1 - t), lerp(L.hor(x) - 3, L.treeY + 3, Math.pow(t, 0.75)) + 5 * (1 - t));
    }
    rub(S, pth, 3.6, 1.0, { speed: 1300, p0: 0.7, p1: 0.9 });
    // tussocks
    for (let i = 0; i < 24; i++) {
      const x = lerp(L.footL + 80, L.footR - 60, r());
      const y = L.hill(x) + 8 + r() * (L.hor(x) - L.hill(x) - 10);
      if (y > L.hor(x) - 4) continue;
      S.go('comp', [x, y, x + 1.5, y - 3 - r() * 4], 1.0, { f: 0.9, gap: 0.004, speed: 1600 });
    }
  }
  function bankEdge(L) {
    // the near bank rising to the left: y(x)
    const X0 = L.x0 + 26, Yb = L.y1 - 30;
    const xe = Math.min(L.x1 - 300, L.cx - 140);
    return (x) => {
      const t = clamp((xe - x) / Math.max(1, xe - X0), 0, 1);
      return Yb + 12 - (Yb - 770) * Math.pow(t, 1.15) * (0.88 + 0.12 * Math.sin(t * 6.3 + 0.5));
    };
  }
  function bankX(L) { return Math.min(L.x1 - 300, L.cx - 140); }
  function hedge(S, xa, xb, y, s) {
    const r = S.r;
    let x = xa;
    while (x < xb) {
      const len = 80 + r() * 300;
      const e = Math.min(xb, x + len);
      // a lumpy bank of bushes, rubbed with the side of the stick
      const p = [];
      let hgt = s * (0.6 + r() * 0.4);
      for (let k = x; k <= e; k += s * 1.1) { hgt = clamp(hgt + (r() - 0.5) * s * 0.7, s * 0.35, s * 1.3); p.push(k, y - hgt * 0.45 + (r() - 0.5) * s * 0.2); }
      if (p.length >= 4) S.go('side', p, s * 0.8, { f: 1.7, speed: 3200, gap: 0.004, p0: 0.5 + r() * 0.5, p1: 0.4 + r() * 0.6, tin: 0.2, tout: 0.3 });
      // now and then a tree stands out of it
      if (r() < 0.55) {
        const tx = lerp(x, e, 0.2 + r() * 0.6), ts = s * (1.5 + r() * 1.8);
        S.go('comp', [tx, y, tx + 0.5, y - ts * 0.9], 0.8 + s * 0.12, { gap: 0.004 });
        S.go('side', scumble(S, tx, y - ts * 1.25, ts * 0.85, ts * 0.75, ts * 7, ts * 0.45), ts * 0.28, { f: 1.7, speed: 2400, gap: 0.004 });
      }
      x = e + (r() < 0.3 ? 30 + r() * 80 : 4 + r() * 16);
    }
  }
  function field(S, L, amt, st) {
    const r = S.r;
    const X0 = L.x0 + 26, X1 = L.x1 - 26, Yb = L.y1 - 30;
    // far fields: soft bands rubbed in, hedges broken into lengths, a few copses
    const ys = [612, 626 + r() * 6, 648 + r() * 10, 688 + r() * 14];
    for (let i = 0; i < ys.length - 1; i++) {
      const y0 = ys[i] + r() * 4, y1 = ys[i + 1] + r() * 4;
      if (r() < 0.7) {
        const xa = X0 + r() * 300, xb = X1 - r() * 300;
        toneFill(S, [xa, y0, xb, y0, xb + 20, y1, xa - 20, y1], (r() - 0.5) * 0.06, 5 + i * 2, (0.3 + r() * 0.5) * amt, { speed: 4200 });
      }
      hedge(S, X0 + r() * 300, X1 - r() * 300, y1, 3.5 + i * 3);
    }
    S.go('smudge', zig(clipLines(rectPoly(X0, 612, X1, 712), 0.0, 22, 0.3, r)), 20, { f: 0.45, smooth: true, speed: 4200 });
    // the near bank on the left, dark with grass
    const be = bankEdge(L), xe = bankX(L);
    const poly = [X0, Yb];
    for (let x = X0; x <= xe; x += 24) poly.push(x, be(x));
    poly.push(xe, Yb);
    for (let k = 0; k < 7; k++) {
      const p = [];
      for (let x = X0; x <= xe - k * 34; x += 30) p.push(x, be(x) + 10 + k * 15 + (r() - 0.5) * 6);
      if (p.length >= 4) S.go('side', p, 14 + r() * 6, { f: (0.85 + k * 0.12) * amt, p0: 1.2, p1: 0.2, tin: 0.08, tout: 0.6, gap: 0.01 });
    }
    S.go('smudge', zig(clipLines(poly, 0.5, 26, 0.3, r)), 24, { f: 0.6, smooth: true, speed: 3600 });
    for (let x = X0 + 4; x < xe - 30; x += 14 + r() * 30) {
      const f = 1 - sstep(X0, xe, x);
      grassTuft(S, x, be(x) + 4 + r() * 10, 10 + 26 * f + r() * 14, 3 + ((r() * 5) | 0), 0.9 + f * 0.8);
      if (r() < 0.5) grassTuft(S, x + 8, be(x) + 30 + r() * 60, 8 + 14 * f, 3, 0.9 + f * 0.5);
    }
    // a few taller stalks with seed heads against the light
    for (let i = 0; i < 6; i++) {
      const x = lerp(X0 + 20, xe - 80, r()), y = be(x) + 6, h = 40 + r() * 40;
      S.go('comp', [x, y, x + 3, y - h * 0.6, x + 8 + r() * 6, y - h], 1.0, { p0: 1, p1: 0.4, speed: 1200 });
      S.go('comp', scumble(S, x + 9, y - h - 4, 3, 6, 16, 1.6), 1.1, { f: 1.2, speed: 900 });
    }
    // the open field: sparse marks, a shadow along the bottom
    const yb = st && st.year;
    for (let i = 0; i < 16; i++) {
      const x = lerp(xe - 60, X1 - 40, r()), yy = lerp(720, Yb - 10, Math.sqrt(r())), s = L.sc(yy);
      if (yb && x > yb[0] - 60 && x < yb[2] + 40 && yy > yb[1] - 50) continue;
      grassTuft(S, x, yy, 20 * s + 3, 2 + ((r() * 3) | 0), 0.8 + s * 0.6, s < 0.35 ? 'vine' : 'comp');
    }
    S.go('side', [xe - 40, Yb - 4, lerp(xe, X1, 0.5), Yb - 10, X1 - 10, Yb - 6], 12, { f: 0.45 * amt, p0: 0.8, p1: 0.2, tout: 0.6 });
  }

  function oak(S, L, st, H, young) {
    const r = S.r, x = L.treeX, y = L.treeY;
    st.oak = { x, y, H };
    const wl = Math.max(1.3, H * 0.012);
    const tw = H * (young ? 0.035 : 0.055);
    const th = H * (young ? 0.4 : 0.34);
    const lean = (r() - 0.5) * H * 0.05;
    const fx = x + lean, fy = y - th;
    // trunk with a root flare
    S.go('comp', [x - tw * 2.4, y + 3, x - tw * 1.1, y - th * 0.25, fx - tw * 0.85, fy + th * 0.2, fx - tw * 1.6, fy - th * 0.1], wl * 1.2, { p0: 1, p1: 0.5, speed: 700 });
    S.go('comp', [x + tw * 2.6, y + 3, x + tw * 1.05, y - th * 0.3, fx + tw * 0.8, fy + th * 0.12, fx + tw * 1.7, fy - th * 0.12], wl * 1.2, { p0: 1, p1: 0.5, speed: 700 });
    hatch(S, [x - tw * 0.4, y + 2, x + tw * 2.2, y + 2, fx + tw * 0.9, fy, fx - tw * 0.4, fy], -1.45, Math.max(1.2, wl * 0.85), wl, 'comp', { f: 1.5 });
    // limbs, thick to thin, each forking once
    const nl = young ? 5 : 7;
    const ends = [];
    for (let i = 0; i < nl; i++) {
      const a = lerp(-2.8, -0.34, (i + 0.25 + r() * 0.5) / nl);
      const len = H * (0.3 + r() * 0.14) * (Math.abs(a + 1.57) < 0.45 ? 0.8 : 1.0);
      const sx = fx + (r() - 0.5) * tw, sy = fy + tw * 0.6;
      const mx = sx + Math.cos(a) * len * 0.5 + (r() - 0.5) * H * 0.05, my = sy + Math.sin(a) * len * 0.4;
      const ex = sx + Math.cos(a) * len, ey = sy + Math.sin(a) * len * 0.72;
      S.go('comp', [sx, sy, mx, my, ex, ey], wl * (young ? 1.0 : 1.35), { p0: 1, p1: 0.08, tin: 0.04, tout: 0.65, speed: 800 });
      const ta = a + (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.4);
      S.go('comp', [mx, my, mx + Math.cos(ta) * len * 0.42, my + Math.sin(ta) * len * 0.35], wl * 0.7, { p0: 0.9, p1: 0.05, tout: 0.7, speed: 900 });
      ends.push([ex, ey]);
    }
    // crown: lobes of foliage, a broad dome wider than tall
    const ccx = fx + (r() - 0.5) * H * 0.04, ccy = y - H * 0.68, rx = H * (young ? 0.38 : 0.5), ry = H * (young ? 0.33 : 0.36);
    const nc = young ? 7 : 9;
    const cl = [];
    for (let i = 0; i < nc; i++) {
      const a = lerp(Math.PI * 0.82, Math.PI * 2.18, (i + (r() - 0.5) * 0.5) / (nc - 1));
      cl.push([ccx + Math.cos(a) * rx * 0.78, ccy + Math.sin(a) * ry * 0.78, H * 0.16 * (0.8 + r() * 0.4)]);
    }
    cl.push([ccx - rx * 0.3, ccy + ry * 0.1, H * 0.18], [ccx + rx * 0.3, ccy + ry * 0.14, H * 0.17], [ccx + (r() - 0.5) * rx * 0.3, ccy - ry * 0.15, H * 0.17]);
    // mass: the side of the stick, tangled
    for (const [cx, cy, cr] of cl) S.go('side', scumble(S, cx, cy, cr, cr * 0.8, cr * 10, cr * 0.5), cr * 0.22, { f: 1.5, speed: 2600, p0: 0.8, p1: 0.7 });
    S.go('smudge', scumble(S, ccx, ccy + ry * 0.1, rx * 0.9, ry * 0.75, rx * 6, H * 0.1), H * 0.07, { f: 0.5, speed: 2200 });
    // dark undersides scribbled hard with the compressed stick
    for (const [cx, cy, cr] of cl) S.go('comp', scumble(S, cx + cr * 0.1, cy + cr * 0.32, cr * 0.85, cr * 0.4, cr * 6, cr * 0.28), Math.max(1.0, H * 0.009), { f: 1.2, speed: 2000, p0: 0.9, p1: 0.6 });
    S.go('side', [ccx - rx * 0.8, ccy + ry * 0.62, ccx, ccy + ry * 0.85, ccx + rx * 0.85, ccy + ry * 0.58], H * 0.075, { f: 1.6 });
    // limbs read through the lower crown
    for (let i = 0; i < ends.length; i += 2) S.go('comp', [fx, fy + tw, lerp(fx, ends[i][0], 0.6), lerp(fy, ends[i][1], 0.6) + 3], wl * 0.9, { p0: 1, p1: 0.2, speed: 900 });
    // the leafy edge, broken, along the bottom and sides
    for (const [cx, cy, cr] of cl) if (cy > ccy - ry * 0.2) S.go('comp', scumble(S, cx, cy + cr * 0.55, cr * 0.7, cr * 0.18, cr * 2.5, cr * 0.2), Math.max(0.9, H * 0.007), { f: 1.0, speed: 2200 });
    // light on the upper left of the lobes, and holes of sky
    for (const [cx, cy, cr] of cl) {
      if (cx > ccx + rx * 0.35 || r() < 0.25) continue;
      rub(S, [cx - cr * 0.75, cy - cr * 0.05, cx - cr * 0.45, cy - cr * 0.5, cx + cr * 0.05, cy - cr * 0.68], cr * 0.18, 0.55, { speed: 1600 });
    }
    for (let k = 0; k < (young ? 3 : 6); k++) {
      const a = r() * TAU, d = 0.2 + r() * 0.5;
      const hx = ccx + Math.cos(a) * rx * d, hy = ccy + Math.sin(a) * ry * d;
      rub(S, [hx, hy, hx + 2, hy + 1.5], H * (0.015 + r() * 0.015), 1.0, { speed: 300 });
    }
    // ground shadow
    S.go('side', [x - H * 0.3, y + 4, x + H * 0.5, y + 6], H * 0.035, { f: 1.2 });
  }
  function eraseOak(S, st, f) {
    const o = st.oak; if (!o) return;
    const H = o.H;
    scrub(S, ellPoly(o.x, o.y - H * 0.66, H * 0.66, H * 0.42, 18), -0.6 + (S.r() - 0.5) * 0.5, H * 0.06, f, { speed: 2600 });
    scrub(S, rectPoly(o.x - H * 0.12, o.y - H * 0.42, o.x + H * 0.14, o.y + 2), 1.35, H * 0.035, f * 0.9, { speed: 2000 });
  }
  function stump(S, L, st) {
    const x = L.treeX, y = L.treeY, w = 15;
    S.go('comp', [x - w * 1.7, y + 3, x - w * 0.95, y - 6, x - w, y - 20], 2.0, { p0: 1, p1: 0.6 });
    S.go('comp', [x + w * 1.8, y + 3, x + w * 1.05, y - 7, x + w * 0.95, y - 21], 2.0, { p0: 1, p1: 0.6 });
    // the cut: a pale face with rings
    S.go('comp', ell(S, x, y - 20.5, w, 4.5, 0, TAU, 16, 0.08), 1.4, { p0: 0.9, p1: 0.9 });
    S.go('vine', ell(S, x, y - 20.5, w * 0.6, 2.6, 0, TAU, 12, 0.1), 0.9);
    S.go('vine', ell(S, x, y - 20.5, w * 0.28, 1.2, 0, TAU, 8, 0.1), 0.8);
    hatch(S, [x + 3, y + 2, x + w * 1.6, y + 2, x + w * 0.95, y - 18, x + 3, y - 18], -1.5, 1.8, 1.0, 'comp', { f: 1.3 });
    // the felled trunk lying down the slope, its limbs sawn
    const lx = x + 58, ly = L.hill(x + 58) + 6;
    S.go('comp', [lx - 40, ly - 14, lx + 44, ly - 3], 2.0, { p0: 1, p1: 0.5 });
    S.go('comp', [lx - 38, ly + 2, lx + 44, ly + 7], 2.0, { p0: 1, p1: 0.5 });
    S.go('comp', ell(S, lx - 40, ly - 6, 4.5, 8.5, 0, TAU, 12, 0.08), 1.3);
    S.go('vine', ell(S, lx - 40, ly - 6, 2, 4, 0, TAU, 8, 0.1), 0.8);
    toneFill(S, [lx - 36, ly - 12, lx + 44, ly - 2, lx + 44, ly + 6, lx - 36, ly + 1], -0.12, 2.5, 1.2);
    for (const k of [0.3, 0.65]) S.go('comp', [lx - 36 + k * 80, ly - 10 + k * 10, lx - 30 + k * 80, ly - 20 + k * 10], 1.6, { p0: 1, p1: 1 });
    S.go('side', [x - 30, y + 5, lx + 60, ly + 10], 4, { f: 1.0 });
  }
  function sapling(S, L, st, k, t) {
    const go = (tool, pts, w, o) => (t === undefined ? S.go(tool, pts, w, o) : S.at(t + (o.dt || 0), tool, pts, w, o));
    const r = S.r;
    const x = L.treeX - 3, y = L.treeY - 19;
    const h = 22 + k * 16;
    go('comp', [x, y, x - 2, y - h * 0.5, x + 2.5, y - h], 1.5, { p0: 1.2, p1: 0.4, speed: 120 });
    for (let i = 0; i < 2 + k * 2; i++) {
      const yy = y - h * (0.35 + 0.6 * ((i + r() * 0.5) / (2 + k * 2))), s = i % 2 ? -1 : 1, len = 8 + r() * 8 + k * 3;
      go('comp', [x + 0.5, yy, x + s * len * 0.5, yy - len * 0.35, x + s * len, yy - len * 0.4], 1.1, { p0: 1, p1: 0.4, speed: 120, dt: 0.25 + i * 0.25 });
      go('comp', scumble(S, x + s * len, yy - len * 0.45, 4.5, 3.2, 26, 1.8), 1.3, { f: 1.5, speed: 140, dt: 0.4 + i * 0.25 });
    }
  }
  function stumpGhost(S, L) {
    const x = L.treeX, y = L.treeY, w = 15;
    S.go('comp', [x - w * 1.6, y + 3, x - w * 0.95, y - 6, x - w, y - 19], 1.6, { p0: 1, p1: 0.6, f: 0.9 });
    S.go('comp', [x + w * 1.7, y + 3, x + w * 1.05, y - 7, x + w * 0.95, y - 20], 1.6, { p0: 1, p1: 0.6, f: 0.9 });
    S.go('comp', ell(S, x, y - 20, w, 4.5, 0, TAU, 16, 0.08), 1.2, { f: 0.9 });
    toneFill(S, [x + 3, y + 2, x + w * 1.6, y + 2, x + w * 0.95, y - 18, x + 3, y - 18], -1.5, 2.2, 1.2);
  }
  function shepherd(S, x, y, h) {
    const r = S.r;
    const w = Math.max(1.0, h * 0.02);
    // crook first: the long decisive line
    S.go('comp', [x + h * 0.25, y + 1, x + h * 0.235, y - h * 0.6, x + h * 0.22, y - h * 1.12, x + h * 0.25, y - h * 1.2, x + h * 0.31, y - h * 1.18, x + h * 0.31, y - h * 1.1], w, { p0: 1, p1: 0.5, tout: 0.1, speed: 500 });
    // coat: a dark bell
    const coat = [x - h * 0.09, y - h * 0.8, x + h * 0.1, y - h * 0.8, x + h * 0.16, y - h * 0.18, x - h * 0.19, y - h * 0.17];
    S.go('comp', [x - h * 0.09, y - h * 0.8, x - h * 0.14, y - h * 0.48, x - h * 0.2, y - h * 0.17], w, { p0: 1, p1: 0.6, speed: 500 });
    S.go('comp', [x + h * 0.1, y - h * 0.8, x + h * 0.13, y - h * 0.5, x + h * 0.17, y - h * 0.18], w, { p0: 1, p1: 0.6, speed: 500 });
    hatch(S, coat, -1.25 + (r() - 0.5) * 0.2, Math.max(1.3, h * 0.022), w * 0.9, 'comp', { f: 1.3 });
    S.go('comp', [x - h * 0.2, y - h * 0.17, x - h * 0.02, y - h * 0.2, x + h * 0.17, y - h * 0.17], w, { speed: 500 });
    // legs
    S.go('comp', [x - h * 0.06, y - h * 0.18, x - h * 0.075, y], w * 1.1, { p0: 1, p1: 0.8 });
    S.go('comp', [x + h * 0.05, y - h * 0.18, x + h * 0.075, y - h * 0.01], w * 1.1, { p0: 1, p1: 0.8 });
    // arm to the crook
    S.go('comp', [x + h * 0.07, y - h * 0.76, x + h * 0.17, y - h * 0.6, x + h * 0.235, y - h * 0.63], w, { p0: 1, p1: 0.7 });
    // head and broad hat
    S.go('comp', loopsPts(S, x + h * 0.01, y - h * 0.87, h * 0.05, h * 0.055, h * 0.03, 1), w, { f: 1.4, speed: 400 });
    S.go('comp', [x - h * 0.17, y - h * 0.925, x, y - h * 0.945, x + h * 0.18, y - h * 0.93], w * 1.1, { p0: 1, p1: 0.6, speed: 500 });
    S.go('comp', loopsPts(S, x, y - h * 0.98, h * 0.07, h * 0.035, h * 0.025, 1), w, { f: 1.5, speed: 400 });
    // shadow on the grass
    S.go('side', [x - h * 0.15, y + 2, x + h * 0.6, y + 4], h * 0.05, { f: 0.9 });
  }
  function sheep(S, x, y, s, face) {
    const r = S.r;
    const w = Math.max(0.8, s * 0.026);
    const bx = x - face * s * 0.04, by = y - s * 0.36, rx = s * 0.36, ry = s * 0.19;
    // fleece: a scalloped outline, the back left white
    const o = [];
    const ph = r() * 3;
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * 0.15 + (i / 40) * TAU;
      const k = 1 + 0.13 * Math.abs(Math.sin(a * 3.5 + ph)) + (r() - 0.5) * 0.05;
      o.push(bx + Math.cos(a) * rx * k, by + Math.sin(a) * ry * k);
    }
    S.go('vine', o, w * 1.15, { f: 1.1, p0: 0.7, p1: 0.9, speed: 1100 });
    S.go('side', [bx - rx * 0.85, by + ry * 0.45, bx, by + ry * 0.75, bx + rx * 0.85, by + ry * 0.4], s * 0.06, { f: 1.1, speed: 900 });
    S.go('vine', scumble(S, bx - face * rx * 0.2, by + ry * 0.2, rx * 0.5, ry * 0.4, s * 1.5, s * 0.06), w * 0.8, { f: 0.6, speed: 1200 });
    // head: grazing or looking up
    const down = r() < 0.5;
    const hx = x + face * s * 0.44, hy = y - s * (down ? 0.22 : 0.42);
    S.go('comp', [x + face * s * 0.3, y - s * 0.4, hx, hy], w * 2.2, { p0: 1, p1: 1, speed: 500 });
    S.go('comp', scumble(S, hx + face * s * 0.02, hy, s * 0.07, s * 0.055, s * 0.6, s * 0.05), w * 1.5, { f: 1.7, speed: 600 });
    S.go('comp', [hx - face * s * 0.03, hy - s * 0.05, hx - face * s * 0.12, hy - s * 0.07], w, { p0: 1, p1: 0.3 });
    for (const k of [-0.27, -0.17, 0.16, 0.25]) {
      const lx = x + k * s * face;
      S.go('comp', [lx, y - s * 0.2, lx + (r() - 0.5) * s * 0.05, y], w * 1.05, { p0: 1, p1: 0.8, gap: 0.01 });
    }
    S.go('side', [x - s * 0.45, y + 1, x + s * 0.6, y + 2], s * 0.05, { f: 0.8, gap: 0.01 });
  }
  function birdPts(S, x, y, s, flap) {
    if (flap) return [x - s, y - s * 0.55, x - s * 0.55, y - s * 0.38, x - s * 0.1, y + s * 0.02, x, y + s * 0.12, x + s * 0.12, y + s * 0.02, x + s * 0.55, y - s * 0.42, x + s * 1.0, y - s * 0.62];
    return [x - s, y + s * 0.12, x - s * 0.6, y - s * 0.22, x - s * 0.15, y - s * 0.02, x, y + s * 0.1, x + s * 0.15, y - s * 0.04, x + s * 0.6, y - s * 0.26, x + s * 1.05, y + s * 0.06];
  }
  function drawBirds(S, list, t) {
    for (const b of list) {
      if (t === undefined) S.go('comp', birdPts(S, b.x, b.y, b.s, b.f), Math.max(0.9, b.s * 0.12), { p0: 0.6, p1: 0.2, tin: 0.2, tout: 0.4, speed: 400, gap: 0.04 });
      else S.at(t + S.r() * 0.15, 'comp', birdPts(S, b.x, b.y, b.s, b.f), Math.max(0.9, b.s * 0.12), { p0: 0.6, p1: 0.2, tin: 0.2, tout: 0.4, speed: 300 });
    }
  }
  function flyBirds(S, st, a, b, dx, dy) {
    let t = a;
    while (t + 1.0 < b) {
      for (const bd of st.birds) S.at(t + S.r() * 0.1, 'erase', [bd.x - bd.s * 1.2, bd.y - bd.s * 0.25, bd.x + bd.s * 1.2, bd.y - bd.s * 0.15], bd.s * 0.85, { f: 1.4, speed: 260 });
      st.birds = st.birds.map((bd) => ({ x: bd.x + dx * (0.85 + S.r() * 0.3), y: bd.y + dy + (S.r() - 0.5) * 8, s: bd.s, f: !bd.f }));
      drawBirds(S, st.birds, t + 0.3);
      t += 1.1;
    }
  }

  function farmhouse(S, L, st) {
    const r = S.r;
    const hx = L.cxl(L.footL + 140 + r() * 30, 150), hy = L.hill(hx) + 26;
    const fw = 104, wh = 40, rh = 32, ge = 36;
    st.farm = { x0: hx - ge - 50, y0: hy - wh - rh - 50, x1: hx + fw + 80, y1: hy + 8, hx, hy, fw, wh, rh, ge };
    const w = 1.7;
    // a round tree behind the house first
    const tx = hx - ge - 22, ty = hy;
    S.go('comp', [tx, ty, tx + 1, ty - 30], 2.2, { p0: 1, p1: 0.6 });
    S.go('side', scumble(S, tx, ty - 52, 28, 30, 260, 14), 6, { f: 1.6, speed: 2400 });
    S.go('comp', scumble(S, tx + 4, ty - 42, 24, 16, 140, 6), 1.2, { f: 1.2, speed: 2200 });
    // walls
    S.go('comp', sl(S, hx, hy, hx + fw, hy, 1, 5), w, { speed: 800 });
    S.go('comp', sl(S, hx + fw, hy, hx + fw, hy - wh, 0.5, 3), w);
    S.go('comp', sl(S, hx, hy, hx, hy - wh, 0.5, 3), w * 1.3);
    // the gable end, catching the light
    S.go('comp', [hx, hy, hx - ge, hy - 5, hx - ge, hy - wh - 3, hx - ge * 0.5, hy - wh - rh, hx, hy - wh], w, { smooth: false, speed: 800 });
    // roof: ridge and eaves, dark hatching
    const rx0 = hx - ge * 0.5, ry0 = hy - wh - rh;
    S.go('comp', sl(S, rx0, ry0, rx0 + fw + 6, ry0 + 1, 1, 4), w * 1.3);
    S.go('comp', sl(S, hx - 3, hy - wh, hx + fw + 8, hy - wh, 1, 4), w);
    hatch(S, [rx0, ry0, rx0 + fw + 6, ry0 + 1, hx + fw + 8, hy - wh, hx, hy - wh], -0.9, 2.2, 1.2, 'comp', { f: 1.3 });
    S.go('side', [rx0 + 10, ry0 + rh * 0.7, rx0 + fw * 0.6, ry0 + rh * 0.75, hx + fw, hy - wh - 3], 6, { f: 1.2 });
    // the long wall in half shadow, the windows and door dark
    toneFill(S, rectPoly(hx + 2, hy - wh + 3, hx + fw - 2, hy - 1), 0.05, 5, 0.7, { speed: 3000 });
    for (const wx of [0.12, 0.38, 0.72]) {
      const x0 = hx + fw * wx, y0 = hy - wh * 0.74;
      S.go('comp', scumble(S, x0 + 5, y0 + 7, 5, 6, 40, 2.4), 1.3, { f: 1.6, speed: 700 });
    }
    S.go('comp', [hx + fw * 0.56, hy, hx + fw * 0.56, hy - 22, hx + fw * 0.64, hy - 22, hx + fw * 0.64, hy], 1.4, { smooth: false });
    hatch(S, rectPoly(hx + fw * 0.56, hy - 22, hx + fw * 0.64, hy), -1.5, 1.4, 1.0, 'comp', { f: 1.4 });
    S.go('comp', scumble(S, hx - ge * 0.5, hy - wh * 0.55, 5, 5, 30, 2.4), 1.2, { f: 1.4, speed: 700 });
    // chimney
    const cx = hx + fw * 0.74;
    S.go('comp', [cx, ry0 + 3, cx, ry0 - 18, cx + 11, ry0 - 18, cx + 11, ry0 + 3], 1.6, { smooth: false });
    hatch(S, rectPoly(cx, ry0 - 18, cx + 11, ry0 + 2), -1.3, 1.6, 1.0, 'comp', { f: 1.3 });
    st.chim = { x: cx + 5.5, y: ry0 - 21 };
    // the barn beside it
    const bx = hx + fw + 18, by = hy + 4;
    S.go('comp', [bx, by, bx, by - 32, bx + 26, by - 52, bx + 60, by - 35, bx + 60, by], 1.6, { smooth: false });
    S.go('comp', sl(S, bx - 2, by, bx + 62, by, 0.5, 4), 1.4);
    hatch(S, rectPoly(bx + 34, by - 33, bx + 60, by), -1.45, 2.0, 1.1, 'comp', { f: 1.3 });
    S.go('comp', [bx + 10, by, bx + 10, by - 20, bx + 24, by - 20, bx + 24, by], 1.3, { smooth: false });
    // the yard, a cast shadow
    S.go('side', [hx - ge, hy + 4, hx + fw * 0.5, hy + 5, bx + 80, by + 4], 5, { f: 1.0 });
    // smoke going off with the wind
    smokePlume(S, st.chim.x, st.chim.y, 1.0, 0.9);
  }
  function smokePlume(S, x, y, size, f, t) {
    const go = (tool, pts, w, o) => (t === undefined ? S.go(tool, pts, w, o) : S.at(t + (o.dt || 0), tool, pts, w, o));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const px = x + (k * 150 + k * k * 110) * size, py = y - (k * 70 - k * k * 20) * size;
      const pr = (5 + k * 20) * size;
      go('side', scumble(S, px, py, pr, pr * 0.65, pr * 6, pr * 0.45), Math.max(2, pr * 0.22), { f: f * (1.3 - k * 0.8), speed: 1600, dt: i * 0.12 });
    }
    go('smudge', [x, y, x + 60 * size, y - 30 * size, x + 150 * size, y - 50 * size, x + 260 * size, y - 50 * size], 12 * size, { f: 0.55, speed: 1200, dt: 0.8 });
  }
  function smokePuffs(S, x, y, n, t0, dt, dir, size) {
    for (let i = 0; i < n; i++) {
      const t = t0 + i * dt;
      // the old smoke drifts: drag it along, lift a little, add a fresh puff at the chimney
      S.at(t, 'smudge', [x + 20 * size, y - 10 * size, x + 120 * size, y - 40 * size, x + 240 * size, y - 50 * size], 14 * size, { f: 0.4, speed: 700 });
      S.at(t + dt * 0.3, 'erase', [x + 40 * size, y - 30 * size, x + 120 * size, y - 46 * size], 8 * size, { f: 0.25, speed: 600 });
      const pr = 6 * size;
      S.at(t + dt * 0.55, 'side', scumble(S, x + 4 * size, y - 6 * size, pr, pr * 0.8, pr * 6, pr * 0.45), pr * 0.3, { f: 1.2, speed: 900 });
    }
  }

  function furrows(S, L, st) {
    const r = S.r;
    const Yb = L.y1 - 28;
    const be = bankEdge(L);
    const FL = [L.footL + 190, 704], FR = [L.cx - 20, 704];
    const NL = [Math.max(L.x0 + 30, L.footL - 200), Yb], NR = [L.cx + 380, Yb];
    st.furrow = { poly: [FL[0], FL[1], FR[0], FR[1], NR[0], NR[1], NL[0], NL[1]] };
    // the turned earth: a darker patch
    toneFill(S, st.furrow.poly, 0.02, 9, 0.7, { speed: 4000 });
    const n = 15;
    for (let i = 0; i <= n; i++) {
      const u = (i + (r() - 0.5) * 0.25) / n;
      const ax = lerp(FL[0], FR[0], u), ay = FL[1], bx = lerp(NL[0], NR[0], u), by = NL[1];
      const p = [];
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const x = lerp(ax, bx, t * t * 0.3 + t * 0.7) + (r() - 0.5) * 4 * t, y = lerp(ay, by, t * t * 0.3 + t * 0.7);
        if (y > be(x) - 4) break;
        p.push(x, y);
      }
      if (p.length < 6) continue;
      S.go('comp', p, 1.3, { p0: 0.15, p1: 1.4, tin: 0.9, tout: 0.04, f: 1.0, speed: 1900, gap: 0.02 });
      // the furrow's shadow, broadening as it comes near
      const q = []; for (let k = 0; k < p.length; k += 2) { const s = L.sc(p[k + 1]); q.push(p[k] + 3 + 10 * s, p[k + 1]); }
      S.go('side', q, 4, { p0: 0.1, p1: 1.6, tin: 0.9, f: 1.2, speed: 2600, gap: 0.006 });
    }
    // clods in the near rows
    for (let i = 0; i < 40; i++) {
      const u = r(), v = 0.55 + r() * 0.45;
      const x = lerp(lerp(FL[0], FR[0], u), lerp(NL[0], NR[0], u), v), y = lerp(FL[1], NL[1], v);
      if (y > be(x) - 6) continue;
      const s = L.sc(y);
      S.go('comp', scumble(S, x, y, 3 + 5 * s, 2 + 2 * s, 14 + 20 * s, 1.6 + 2 * s), 0.9 + s, { f: 1.2, speed: 1200, gap: 0.004 });
    }
    S.go('smudge', zig(clipLines(st.furrow.poly, 0.05, 30, 0.3, r)), 26, { f: 0.35, smooth: true, speed: 4000 });
  }
  function fence(S, L, st) {
    const r = S.r;
    const be = bankEdge(L);
    const ax = L.x0 + 50, ay = be(L.x0 + 50) - 4;
    const bx = st.farm ? st.farm.hx - 70 : L.footL + 80, by = 622;
    const posts = [];
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(i / (n - 1), 0.6);
      const x = lerp(ax, bx, t), y = lerp(ay, by, t), s = L.sc(y);
      posts.push([x, y, 78 * s + 5]);
    }
    st.fence = posts;
    for (const [x, y, h] of posts) {
      S.go('comp', [x, y + h * 0.06, x + (r() - 0.5) * h * 0.08, y - h], Math.max(1, h * 0.05), { p0: 1, p1: 0.8, gap: 0.025, speed: 700 });
    }
    for (const lvl of [0.42, 0.85]) {
      const p = [];
      for (let i = 0; i < posts.length; i++) {
        const [x, y, h] = posts[i];
        p.push(x, y - h * lvl);
        if (i + 1 < posts.length) { const q = posts[i + 1]; p.push((x + q[0]) / 2, (y - h * lvl + q[1] - q[2] * lvl) / 2 + h * 0.06); }
      }
      S.go('comp', p, 1.1, { p0: 1.0, p1: 0.3, speed: 1300 });
    }
  }

  function pylon(S, bx, by, H) {
    const r = S.r;
    const w = clamp(H * 0.0055, 0.8, 2.4);
    const bw = H * 0.13, tw = H * 0.03, waistY = by - H * 0.55, ww = H * 0.048, topY = by - H * 0.9;
    const half = (y) => (y > waistY ? lerp(bw, ww, (by - y) / (by - waistY)) : lerp(ww, tw, (waistY - y) / (waistY - topY)));
    // legs
    S.go('comp', [bx - bw, by, bx - ww, waistY, bx - tw, topY], w * 1.3, { smooth: false, p0: 1, p1: 0.7, speed: 900 });
    S.go('comp', [bx + bw, by, bx + ww, waistY, bx + tw, topY], w * 1.3, { smooth: false, p0: 1, p1: 0.7, speed: 900 });
    // bracing: panels get shorter as they rise
    const ys = []; let y = by, ph = H * 0.12;
    while (y > topY + 2) { ys.push(y); y -= ph; ph = Math.max(H * 0.045, ph * 0.86); }
    ys.push(topY);
    const zz1 = [], zz2 = [];
    ys.forEach((yy, i) => { const hw = half(yy); zz1.push(bx + (i % 2 ? hw : -hw), yy); zz2.push(bx + (i % 2 ? -hw : hw), yy); });
    S.go('comp', zz1, w * 0.8, { smooth: false, p0: 0.8, p1: 0.6, speed: 1300 });
    S.go('vine', zz2, w * 0.85, { smooth: false, p0: 0.8, p1: 0.6, speed: 1400 });
    for (let i = 1; i < ys.length - 1; i += 2) S.go('vine', [bx - half(ys[i]), ys[i], bx + half(ys[i]), ys[i]], w * 0.7, { smooth: false, gap: 0.01 });
    // peak
    S.go('comp', [bx - tw, topY, bx, by - H, bx + tw, topY], w, { smooth: false });
    // cross-arms
    const arms = [[0.6, 0.15], [0.72, 0.19], [0.84, 0.14]];
    const pts = [];
    for (const [hy, al] of arms) {
      const yy = by - H * hy, hw = half(yy), d = H * 0.04;
      for (const s of [-1, 1]) {
        const tip = bx + s * (hw + H * al);
        S.go('comp', [bx + s * hw, yy, tip, yy - H * 0.004], w, { smooth: false, gap: 0.01, speed: 1100 });
        S.go('comp', [bx + s * half(yy + d), yy + d, tip, yy], w * 0.8, { smooth: false, gap: 0.01, speed: 1100 });
        // lacing inside the arm
        const z = []; const nz = 4;
        for (let k = 0; k <= nz; k++) { const t = k / nz; z.push(lerp(bx + s * hw, tip, t), k % 2 ? yy + d * (1 - t) : yy); }
        S.go('vine', z, w * 0.6, { smooth: false, gap: 0.005, speed: 1500 });
        // insulator string
        S.go('comp', [tip, yy, tip + (r() - 0.5) * 0.5, yy + H * 0.05], w * 1.1, { p0: 1, p1: 1, gap: 0.01 });
        pts.push([tip, yy + H * 0.05]);
      }
    }
    // a shadow at the feet
    S.go('side', [bx - bw * 1.2, by + 1, bx + bw * 2.2, by + 2], Math.max(2, H * 0.012), { f: 0.8 });
    return pts;
  }
  function wire(a, b, sag) {
    const p = [];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i <= 10; i++) { const t = i / 10; p.push(lerp(a[0], b[0], t), lerp(a[1], b[1], t) + 4 * sag * L * t * (1 - t)); }
    return p;
  }
  function pylonLine(S, L) {
    const P = [];
    // from the foreground right, up and over the hill, away to the far left
    const fx = L.cxl(L.cx + 470, 140);
    P.push([fx, L.y1 - 90 > 905 ? 905 : L.y1 - 90, 500]);
    P.push([L.cx + 250, L.hill(L.cx + 250) + 3, 165]);
    P.push([L.cx - 95, L.hill(L.cx - 95) + 2, 118]);
    P.push([L.cx - 410, L.hor(L.cx - 410) + 1, 66]);
    P.push([L.cx - 640, L.hor(L.cx - 640) + 1, 40]);
    P.push([L.cx - 820, L.hor(L.cx - 820) + 1, 26]);
    P.push([L.cx - 960, L.hor(L.cx - 960) + 1, 17]);
    P.push([L.cx - 1080, L.hor(L.cx - 1080) + 1, 11]);
    return P.filter((p) => p[0] > L.x0 - 300 && p[0] < L.x1 + 300);
  }
  function drawPylons(S, L, st) {
    const P = pylonLine(S, L);
    st.pylons = [];
    for (const [x, y, H] of P) st.pylons.push({ x, y, H, pts: pylon(S, x, y, H) });
    st.wires = [];
    for (let i = 0; i + 1 < st.pylons.length; i++) {
      const A = st.pylons[i].pts, B = st.pylons[i + 1].pts;
      for (let k = 0; k < A.length; k++) {
        const w = wire(A[k], B[k], 0.045 + S.r() * 0.01);
        st.wires.push(w);
        S.go(st.pylons[i].H > 200 ? 'comp' : 'vine', w, st.pylons[i].H > 200 ? 0.9 : 0.8, { p0: 0.8, p1: 0.4, speed: 2200, gap: 0.01 });
      }
    }
  }

  function roadPath(L) {
    const bx = L.cxl(L.cx - 20, 240);
    const c = [bx + 40, L.y1 + 30, bx - 30, 925, L.footL + 380, 800, L.footL + 210, 712, L.footL + 290, 648,
      L.footL + 430, L.hill(L.footL + 430) + 16, L.cx - 190, L.hill(L.cx - 190) + 12, L.cx - 70, L.hill(L.cx - 70) + 5];
    return catmull(c, 7);
  }
  function roadEdges(L, path) {
    const left = [], right = [];
    const n = path.length >> 1;
    for (let i = 0; i < n; i++) {
      const x = path[2 * i], y = path[2 * i + 1];
      const j = Math.min(n - 1, i + 1), k = Math.max(0, i - 1);
      let tx = path[2 * j] - path[2 * k], ty = path[2 * j + 1] - path[2 * k + 1];
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      const hw = Math.max(1.6, 125 * L.sc(y));
      const ox = -ty * hw, oy = tx * hw * 0.32;
      left.push(x + ox, y + oy); right.push(x - ox, y - oy);
    }
    return [left, right];
  }
  function road(S, L, st) {
    const r = S.r;
    const path = roadPath(L);
    const [le, ri] = roadEdges(L, path);
    st.road = { path, le, ri };
    const poly = le.concat(rev(ri));
    // the road is cut through whatever was there: furrows and grass go grey under it
    scrub(S, poly, 0.5, 13, 0.75, { speed: 3600 });
    // edges, heavy where they come close
    S.go('comp', le, 2.0, { p0: 1.3, p1: 0.2, tin: 0.05, tout: 0.6, speed: 1300 });
    S.go('comp', ri, 2.0, { p0: 1.3, p1: 0.2, tin: 0.05, tout: 0.6, speed: 1300 });
    // tarmac
    toneFill(S, poly, 0.35, 7, 0.75, { speed: 4200 });
    S.go('smudge', path, 26, { f: 0.5, p0: 1, p1: 0.3, speed: 2400 });
    // the white line, lifted out with the eraser's edge
    const n = path.length >> 1;
    for (let i = 6; i < n - 4; i += 1) {
      const y = path[2 * i + 1], s = L.sc(y);
      if (s < 0.07) break;
      const step = Math.max(2, Math.round(10 * s));
      const j = Math.min(n - 1, i + step);
      rub(S, [path[2 * i], path[2 * i + 1], path[2 * j], path[2 * j + 1]], Math.max(1.2, 3.2 * s), 1.2, { speed: 900, gap: 0.01 });
      i = j + step;
    }
    // verge grass on the near side
    for (let i = 0; i < n; i += 4) {
      const y = ri[2 * i + 1], s = L.sc(y);
      if (s < 0.3 || r() < 0.4) continue;
      grassTuft(S, ri[2 * i] + 8 * s, y + 2, 22 * s, 3, 1 + s * 0.6);
    }
  }
  function poles(S, L, st) {
    const path = st.road.ri;
    const n = path.length >> 1;
    const list = [];
    let i = 3;
    while (i < n) {
      const y = path[2 * i + 1], s = L.sc(y);
      if (s < 0.06) break;
      list.push([path[2 * i] + 70 * s + 6, y - 1, 240 * s + 8]);
      i += Math.max(4, Math.round(30 * s + 5));
    }
    const tops = [];
    for (const [x, y, h] of list) {
      const w = Math.max(0.9, h * 0.016);
      S.go('comp', [x, y, x + (S.r() - 0.5) * h * 0.03, y - h], w, { p0: 1, p1: 0.8, speed: 1000 });
      S.go('comp', [x - h * 0.13, y - h * 0.9, x + h * 0.13, y - h * 0.91], w * 0.9, { p0: 1, p1: 0.8 });
      S.go('side', [x + 2, y + 1, x + h * 0.25, y + 3], Math.max(1.5, h * 0.015), { f: 0.8 });
      tops.push([[x - h * 0.11, y - h * 0.9], [x + h * 0.11, y - h * 0.91]]);
    }
    st.poles = list;
    st.poleWires = [];
    for (let k = 0; k + 1 < tops.length; k++) for (const s of [0, 1]) {
      const w = wire(tops[k][s], tops[k + 1][s], 0.03);
      st.poleWires.push(w);
      S.go('vine', w, 0.8, { speed: 2400, gap: 0.01 });
    }
  }
  function carPts(x, y, s, dir) {
    const P = (u, v) => [x + dir * (u - 0.5) * s, y + v * s];
    const body = [[0, -0.12], [0.02, -0.27], [0.13, -0.34], [0.26, -0.5], [0.46, -0.57], [0.64, -0.52], [0.73, -0.37], [0.92, -0.33], [1.0, -0.23], [0.99, -0.12], [0.88, -0.09], [0.12, -0.09], [0, -0.12]];
    const win = [[0.3, -0.38], [0.33, -0.48], [0.47, -0.53], [0.62, -0.49], [0.68, -0.38]];
    const flat = (a) => { const o = []; for (const [u, v] of a) o.push(...P(u, v)); return o; };
    return { body: flat(body), win: flat(win), w1: P(0.22, -0.09), w2: P(0.79, -0.09), poly: flat(body.slice(0, 12)) };
  }
  function car(S, x, y, s, dir, t) {
    const c = carPts(x, y, s, dir);
    const w = Math.max(0.9, s * 0.022);
    const go = (tool, pts, ww, o) => (t === undefined ? S.go(tool, pts, ww, o) : S.at(t + (o && o.dt || 0), tool, pts, ww, Object.assign({ speed: 900 }, o)));
    go('comp', c.body, w, { p0: 1, p1: 0.7, tin: 0.02, tout: 0.05, speed: 800 });
    go('side', zig(clipLines(c.poly, -0.2, s * 0.06, 0.2, S.r)), s * 0.05, { f: 1.4, smooth: false, dt: 0.1, speed: 1600 });
    go('erase', c.win, s * 0.045, { f: 1.0, dt: 0.25 });
    go('comp', ell(S, c.w1[0], c.w1[1], s * 0.1, s * 0.1, 0, TAU, 10, 0.1), s * 0.045, { f: 1.7, dt: 0.3 });
    go('comp', ell(S, c.w2[0], c.w2[1], s * 0.1, s * 0.1, 0, TAU, 10, 0.1), s * 0.045, { f: 1.7, dt: 0.35 });
    go('side', [x - s * 0.55, y + 1, x + s * 0.6, y + 2], s * 0.045, { f: 1.1, dt: 0.4 });
  }
  function eraseCar(S, x, y, s, t, f) {
    S.at(t, 'erase', zig(clipLines(rectPoly(x - s * 0.58, y - s * 0.62, x + s * 0.58, y + s * 0.05), 0.3, s * 0.1, 0.2, S.r)), s * 0.1, { f, smooth: false, speed: 1800, p0: 0.9, p1: 0.9 });
  }
  function roadAt(st, u) {
    const p = st.road.path, n = p.length >> 1;
    const i = clamp(Math.round(u * (n - 1)), 0, n - 1), j = Math.min(n - 1, i + 1);
    return [p[2 * i], p[2 * i + 1], Math.sign(p[2 * j] - p[2 * i]) || -1];
  }

  function house(S, x, y, w, h, roof, dark, occlude) {
    const r = S.r, lw = Math.max(1.0, w * 0.034);
    const rh = h * (0.6 + r() * 0.25);
    if (occlude) rub(S, [x + w * 0.1, y - h * 0.55, x + w * 0.9, y - h * 0.55], (h + rh) * 0.42, 0.5, { speed: 2600, gap: 0.01 });
    let rp;
    if (roof === 0) rp = [x - 3, y - h, x + w * 0.5, y - h - rh, x + w + 3, y - h];
    else rp = [x - 3, y - h, x + w * 0.16, y - h - rh * 0.8, x + w * 0.84, y - h - rh * 0.8, x + w + 3, y - h];
    // roof first: the dark shape that makes a house read
    toneFill(S, rp, roof === 0 ? -1.0 : -0.2, Math.max(2.2, w * 0.1), dark ? 1.8 : 1.3, { speed: 2600 });
    S.go('comp', rp, lw * 1.1, { smooth: false, speed: 1000, gap: 0.01 });
    // walls
    S.go('comp', sl(S, x, y - h, x, y, 0.3, 1.5), lw, { speed: 1000, gap: 0.01 });
    S.go('comp', sl(S, x, y, x + w, y, 0.4, 2.5), lw, { speed: 1000, gap: 0.01 });
    S.go('comp', sl(S, x + w, y, x + w, y - h, 0.3, 1.5), lw, { speed: 1000, gap: 0.01 });
    // the shadowed end
    S.go('side', [x + w * 0.72, y - h * 0.5, x + w * 0.97, y - h * 0.5], h * 0.45, { f: dark ? 1.0 : 0.6, gap: 0.006 });
    // windows and a door
    const ww = w * 0.15, wh = h * 0.3;
    const nw = w > 34 ? 2 : 1;
    for (let k = 0; k < nw; k++) {
      const wx = x + w * (nw === 1 ? 0.22 : 0.14 + k * 0.38), wy = y - h * 0.62;
      S.go('comp', [wx, wy, wx + ww, wy], wh * 0.5, { f: 1.7, smooth: false, p0: 1, p1: 1, tin: 0.01, tout: 0.01, gap: 0.006, speed: 500 });
    }
    const dx = x + w * 0.62;
    S.go('comp', [dx, y - 1, dx, y - h * 0.55], w * 0.07, { f: 1.6, p0: 1, p1: 1, gap: 0.006, speed: 500 });
  }
  function townRows(L, rng, x0, x1, rows, skip, avoid) {
    const sites = [];
    for (let k = 0; k < rows.length; k++) {
      const d = rows[k];
      let x = x0 + rng() * 24;
      while (x < x1) {
        const w = 28 + rng() * 16, h = 17 + rng() * 7;
        const y = L.hill(x + w / 2) + d + (rng() - 0.5) * 6;
        const ok = y < L.hor(x + w / 2) + 12 && rng() > skip && !(avoid && avoid(x, y, w));
        if (ok) sites.push({ x, y, w, h, roof: rng() < 0.55 ? 0 : 1 });
        x += w * (1.02 + rng() * 0.45);
      }
    }
    sites.sort((a, b) => a.y - b.y);
    return sites;
  }
  function block(S, x, y, w, h) {
    const r = S.r;
    rub(S, [x + w * 0.5, y, x + w * 0.5, y - h], w * 0.55, 0.5, { speed: 2600 });
    toneFill(S, rectPoly(x, y - h, x + w, y), -1.4, 4, 0.7, { speed: 3000 });
    S.go('comp', [x, y, x, y - h, x + w, y - h, x + w, y], 1.6, { smooth: false, speed: 1000 });
    // the side face, deep in shadow
    const d = w * 0.3;
    S.go('comp', [x + w, y - h, x + w + d, y - h + d * 0.4, x + w + d, y + d * 0.2, x + w, y], 1.3, { smooth: false, speed: 1000 });
    toneFill(S, [x + w, y - h, x + w + d, y - h + d * 0.4, x + w + d, y + d * 0.2, x + w, y], -1.5, 3, 1.8, { speed: 3000 });
    const rows = Math.floor((h - 8) / 10), cols = Math.max(2, Math.floor(w / 11));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      if (r() < 0.12) continue;
      const wx = x + 4 + j * (w - 8) / cols, wy = y - h + 7 + i * 10;
      S.go('comp', [wx, wy, wx + (w - 8) / cols * 0.55, wy], 1.9, { f: 1.7, smooth: false, p0: 1, p1: 1, gap: 0.003, speed: 600 });
    }
  }
  function factory(S, L, st) {
    const r = S.r;
    const x0 = L.cxl(L.cx + 170, 260), y = L.hor(x0 + 80) + 16, w = 175, h = 36;
    // stack position fixed first so the smoke knows where to come from
    const cx = x0 + w * 0.78, top = Math.max(L.y0 + 130, 236);
    st.factory = { x0, y, w, h, top };
    rub(S, [x0 + w * 0.5, y - h * 0.5, x0 + w * 0.5 + 1, y - h * 0.5], w * 0.55, 0.6, { speed: 2600 });
    // saw-tooth roof
    const teeth = 5, tw = w / teeth, saw = [x0, y - h];
    for (let i = 0; i < teeth; i++) saw.push(x0 + i * tw, y - h - 20, x0 + (i + 1) * tw, y - h);
    for (let i = 0; i < teeth; i++) toneFill(S, [x0 + i * tw, y - h - 20, x0 + (i + 1) * tw, y - h, x0 + i * tw, y - h], -1.25, 3, 1.8, { speed: 2600 });
    S.go('comp', saw, 1.5, { smooth: false, speed: 1000 });
    // the shed, dark, a row of lit windows
    toneFill(S, rectPoly(x0, y - h, x0 + w, y), 0.05, 6, 1.6, { speed: 3000 });
    S.go('comp', sl(S, x0, y, x0 + w, y, 0.5, 5), 1.8);
    S.go('comp', sl(S, x0, y, x0, y - h, 0.4, 2), 1.6);
    S.go('comp', sl(S, x0 + w, y, x0 + w, y - h, 0.4, 2), 1.6);
    for (let i = 0; i < 8; i++) {
      const wx = x0 + 10 + i * (w - 20) / 8;
      rub(S, [wx, y - h * 0.62, wx + 7, y - h * 0.62], 3.6, 1.2, { gap: 0.01, speed: 600 });
    }
    // the stack: tapering, banded, black
    S.go('comp', [cx - 12, y - h, cx - 7, top], 2.0, { p0: 1, p1: 0.9, speed: 1000 });
    S.go('comp', [cx + 12, y - h, cx + 7, top], 2.0, { p0: 1, p1: 0.9, speed: 1000 });
    toneFill(S, [cx - 12, y - h, cx + 12, y - h, cx + 7, top, cx - 7, top], -1.5, 4, 1.9, { speed: 2600 });
    for (const t of [0.06, 0.12]) rub(S, [cx - 8, lerp(top, y - h, t), cx + 8, lerp(top, y - h, t)], 1.6, 1.0);
    S.go('side', [cx - 6, y - h, cx + 60, y - h + 2], 3, { f: 1.0 });
    st.stack = { x: cx, y: top - 4 };
  }
  function plumePath(st, k) {
    const { x, y } = st.stack;
    return [x - k * 470 - k * k * 230, y - k * 190 + k * k * 120];
  }
  function heavySmoke(S, st, amt, t, n, k0, k1) {
    const go = (tool, pts, w, o) => (t === undefined ? S.go(tool, pts, w, o) : S.at(t + (o.dt || 0), tool, pts, w, o));
    k0 = k0 || 0; k1 = k1 === undefined ? 1 : k1;
    const r = S.r;
    // the stick rolls along the plume in growing coils
    const coil = [], N = 12 * n;
    let th = r() * TAU;
    for (let i = 0; i <= N; i++) {
      const k = lerp(k0, k1, i / N), [px, py] = plumePath(st, k), pr = 12 + k * 64;
      th += TAU / 7 * (0.8 + r() * 0.4);
      coil.push(px + Math.cos(th) * pr * 0.8, py + Math.sin(th) * pr * 0.55);
    }
    const kw = 12 + 50 * k1;
    go('side', coil, kw * 0.32, { f: amt * 1.7, p0: 1.3, p1: 0.5, tin: 0.05, tout: 0.6, speed: 3000 });
    // rubbed across its length into one soft body
    const sm = [];
    for (let i = 0; i <= 3 * n; i++) {
      const k = lerp(k0, k1, i / (3 * n)), [px, py] = plumePath(st, k), pr = 12 + k * 64;
      sm.push(px, py + (i % 2 ? pr * 0.45 : -pr * 0.45));
    }
    go('smudge', sm, kw * 0.5, { f: 0.7, p0: 1, p1: 0.6, speed: 2600, dt: 0.3 });
    // light caught along its top, a darker belly
    const hi = [], lo = [];
    for (let i = 1; i <= 8; i++) {
      const k = lerp(k0, k1, i / 8), [px, py] = plumePath(st, k), pr = 12 + k * 64;
      hi.push(px + (r() - 0.5) * 10, py - pr * 0.5); lo.push(px, py + pr * 0.35);
    }
    go('erase', hi, kw * 0.14, { f: 0.5, speed: 2600, dt: 0.6 });
    go('side', lo, kw * 0.16, { f: amt * 1.2, p0: 1, p1: 0.3, speed: 2600, dt: 0.7 });
  }
  function billboard(S, L, st) {
    const r = S.r;
    const be = bankEdge(L);
    const x0 = L.cxl(L.x0 + 90, 40), w = 280, h = 100;
    const gy = be(x0 + w * 0.5);
    const y0 = gy - 80 - h;
    st.bill = { x0, y0, w, h };
    rub(S, [x0 + w * 0.5, y0 + h * 0.5, x0 + w * 0.5 + 1, y0 + h * 0.5], h * 0.62, 0.7, { speed: 2600 });
    // legs, braced
    for (const lx of [x0 + w * 0.22, x0 + w * 0.78]) {
      S.go('comp', [lx, y0 + h, lx + (r() - 0.5) * 2, be(lx) + 6], 3.0, { p0: 1, p1: 0.9 });
      S.go('comp', [lx - 14, be(lx) + 2, lx, y0 + h + 30], 1.4, { p0: 1, p1: 0.6 });
    }
    S.go('comp', sl(S, x0 + w * 0.2, y0 + h + 34, x0 + w * 0.8, y0 + h + 32, 0.5, 4), 1.6);
    // the board: a heavy frame, a white face
    S.go('comp', [x0, y0, x0 + w, y0 - 2, x0 + w, y0 + h, x0, y0 + h + 1, x0, y0 - 1], 2.6, { smooth: false, speed: 1000 });
    S.go('side', [x0 + 4, y0 + h + 6, x0 + w + 6, y0 + h + 4], 5, { f: 1.4 });
    // the advertised tree: a perfect lollipop, the one they cut
    const tx = x0 + w * 0.82, ty = y0 + h * 0.42;
    S.go('comp', ell(S, tx, ty, 26, 24, 0, TAU, 20, 0.02), 1.8, { speed: 800 });
    S.go('side', scumble(S, tx, ty + 4, 20, 16, 180, 7), 4, { f: 0.8, speed: 1600 });
    S.go('comp', [tx, ty + 24, tx, ty + 48], 3, { p0: 1, p1: 1 });
    S.go('comp', [tx - 20, ty + 49, tx + 22, ty + 48], 1.3);
    // the name of the estate
    letters(S, 'OAK HILL', x0 + 16, y0 + 14, 34, 2.4, LET, 0.04);
    letters(S, 'NEW HOMES', x0 + 18, y0 + 62, 18, 1.5, LET, 0.04);
  }

  function fingerprint(S, L, t) {
    const r = S.r;
    const side = (r() * 4) | 0, m = 14 + r() * 10;
    let x, y;
    if (side === 0) { x = lerp(L.x0, L.x1, 0.1 + r() * 0.8); y = L.y0 + m; }
    else if (side === 1) { x = lerp(L.x0, L.x1, 0.5 + r() * 0.3); y = L.y1 - m; }
    else if (side === 2) { x = L.x0 + m; y = lerp(L.y0, L.y1, 0.1 + r() * 0.5); }
    else { x = L.x1 - m; y = lerp(L.y0, L.y1, 0.1 + r() * 0.6); }
    S.at(t, 'print', [x, y], 13 + r() * 5, { f: 0.6 + r() * 0.6 });
  }

  /* ---------------------------------------------------------------- the year */
  function writeYear(S, L, st, year) {
    const r = S.r;
    const hgt = 38, adv = hgt * 0.7;
    if (st.year) {
      const b = st.year;
      scrub(S, rectPoly(b[0] - 6, b[1] - 6, b[2] + 6, b[3] + 6), -0.25 + (r() - 0.5) * 0.3, 9, 0.75, { speed: 2600 });
    }
    const x = L.x1 - 70 - adv * 4 + (r() - 0.5) * 16, y = L.y1 - 62 - hgt + (r() - 0.5) * 10;
    letters(S, String(year), x, y, hgt, 2.3, DIG, 0.06);
    st.year = [x, y, x + adv * 4, y + hgt];
  }

  /* ================================================================ the eras */
  function era1890(S, L, st, ci) {
    const r = S.r;
    if (ci === 0) {
      hillContour(S, L, true);
      writeYear(S, L, st, 1890);
      horizon(S, L);
      oak(S, L, st, 120, true);
      sky(S, L, 1);
      hillTone(S, L, 1);
      field(S, L, 1, st);
      hillContour(S, L, false);
    } else {
      writeYear(S, L, st, 1890);
      oak(S, L, st, 120, true);
      hillContour(S, L, false);
      hillTone(S, L, 0.35);
      sky(S, L, 0.3);
    }
    // the flock and the shepherd, out on the open field
    const fx = L.cxl(L.cx + 10 + (r() - 0.5) * 90, 260), fy = 792 + (r() - 0.5) * 30;
    st.flock = [];
    for (let i = 0; i < 9; i++) {
      const x = fx + 40 + i * 34 + (r() - 0.5) * 50, y = fy + (r() - 0.5) * 70 + Math.sin(i * 1.3) * 16;
      const s = 70 * L.sc(y) + 8;
      st.flock.push({ x, y, s, f: r() < 0.65 ? -1 : 1 });
    }
    st.flock.sort((a, b) => a.y - b.y);
    for (const sh of st.flock) sheep(S, sh.x, sh.y, sh.s, sh.f);
    st.shep = { x: fx - 40 - r() * 30, y: fy + 30 + r() * 20 };
    st.shep.h = 170 * L.sc(st.shep.y) + 12;
    shepherd(S, st.shep.x, st.shep.y, st.shep.h);
    // birds
    st.birds = [];
    const bx = L.cxl(L.cx - 420 + r() * 120, 120), by = L.y0 + (600 - L.y0) * 0.38;
    for (let i = 0; i < 5; i++) st.birds.push({ x: bx + i * 34 + (r() - 0.5) * 30, y: by + (r() - 0.5) * 60 + i * 6, s: 9 + r() * 6, f: r() < 0.5 });
    drawBirds(S, st.birds);
    return (a, b) => flyBirds(S, st, a, b, 70, -6);
  }
  function era1910(S, L, st) {
    writeYear(S, L, st, 1910);
    // the flock is gone: rubbed back into the grass
    for (const sh of st.flock) scrub(S, ellPoly(sh.x, sh.y - sh.s * 0.3, sh.s * 0.7, sh.s * 0.45, 10), 0.4, sh.s * 0.18, 0.8, { speed: 2400 });
    const sp = st.shep;
    scrub(S, rectPoly(sp.x - sp.h * 0.25, sp.y - sp.h * 1.22, sp.x + sp.h * 0.36, sp.y + 3), 1.2, sp.h * 0.07, 0.8, { speed: 2400 });
    for (const bd of st.birds) rub(S, [bd.x - bd.s, bd.y - 2, bd.x + bd.s, bd.y], bd.s * 0.6, 1.2);
    // the oak grows
    eraseOak(S, st, 0.7);
    oak(S, L, st, 165, false);
    farmhouse(S, L, st);
    furrows(S, L, st);
    fence(S, L, st);
    const c = st.chim;
    return (a, b) => { smokePuffs(S, c.x, c.y, 4, a, (b - a) / 4, 1, 1.0); };
  }
  function era1930(S, L, st) {
    writeYear(S, L, st, 1930);
    eraseOak(S, st, 0.4);
    oak(S, L, st, 190, false);
    drawPylons(S, L, st);
    // the field goes back to pasture: the furrows are rubbed half away
    if (st.furrow) scrub(S, st.furrow.poly, 0.08, 20, 0.45, { speed: 4000 });
    const c = st.chim;
    return (a, b) => { smokePuffs(S, c.x, c.y, 4, a, (b - a) / 4, 1, 1.0); };
  }
  function era1950(S, L, st) {
    writeYear(S, L, st, 1950);
    road(S, L, st);
    poles(S, L, st);
    eraseOak(S, st, 0.3);
    oak(S, L, st, 205, false);
    // the car drives up the road, leaving itself behind
    const u0 = 0.1;
    const [x, y, d] = roadAt(st, u0);
    const s = 110 * L.sc(y) + 8;
    car(S, x, y, s, d);
    st.car = { u: u0, x, y, s };
    return (a, b) => {
      let t = a, u = u0;
      while (t + 0.9 < b) {
        eraseCar(S, st.car.x, st.car.y, st.car.s, t, 0.75);
        u += 0.06;
        const [x2, y2, d2] = roadAt(st, u);
        const s2 = 110 * L.sc(y2) + 8;
        car(S, x2, y2, s2, d2, t + 0.25);
        st.car = { u, x: x2, y: y2, s: s2 };
        t += 0.95;
      }
    };
  }
  function era1970(S, L, st) {
    const r = S.r;
    writeYear(S, L, st, 1970);
    // the farm goes under the houses, the car's last ghost stays on the road
    const fm = st.farm;
    scrub(S, rectPoly(fm.x0, fm.y0 + 30, fm.x1, fm.y1), 0.9, 10, 0.7);
    if (st.fence) for (const [x, y, h] of st.fence) rub(S, [x, y - h, x, y], Math.max(2, h * 0.06), 0.9, { speed: 2600 });
    eraseCar(S, st.car.x, st.car.y, st.car.s, S.t, 0.7); S.t += 0.4;
    st.houses = townRows(L, r, L.footL + 110, L.treeX - 70, [12, 40, 68, 96], 0.3);
    for (const h of st.houses) house(S, h.x, h.y, h.w, h.h, h.roof, r() < 0.5, true);
    factory(S, L, st);
    heavySmoke(S, st, 1.0, undefined, 7, 0, 0.75);
    return (a, b) => {
      let t = a;
      while (t + 0.8 < b) { heavySmoke(S, st, 0.55, t, 3, 0, 0.9); t += 1.1; }
    };
  }
  function era1990(S, L, st) {
    const r = S.r;
    writeYear(S, L, st, 1990);
    // the oak comes down
    eraseOak(S, st, 1.0);
    eraseOak(S, st, 0.6);
    stump(S, L, st);
    st.oak = null;
    // the town thickens and climbs over the top
    const old = st.houses;
    const avoid = (x, y, w) => Math.abs(x + w / 2 - L.treeX) < 50 || old.some((q) => Math.abs(q.x - x) < (q.w + w) * 0.5 && Math.abs(q.y - y) < 22);
    const more = townRows(L, r, L.footL + 60, L.footR - 160, [6, 30, 56, 82, 110, 138], 0.28, avoid);
    for (const h of more) house(S, h.x, h.y, h.w * 0.95, h.h, h.roof, r() < 0.6, true);
    st.houses = old.concat(more);
    // blocks of flats on the far shoulder
    st.blocks = [];
    for (let i = 0; i < 3; i++) {
      const bx = L.treeX + 70 + i * 62 + r() * 16, by = L.hill(bx + 20) + 50 + r() * 26, bw = 34 + r() * 10, bh = 78 + r() * 46;
      st.blocks.push([bx, by, bw, bh]);
      block(S, bx, by, bw, bh);
    }
    billboard(S, L, st);
    heavySmoke(S, st, 0.8, undefined, 5, 0, 1);
    return (a, b) => {
      let t = a;
      while (t + 0.8 < b) { heavySmoke(S, st, 0.45, t, 3, 0, 1); t += 1.2; }
    };
  }
  function flame(S, fx, fy, fh, t, redF) {
    const go = (tool, pts, w, o) => (t === undefined ? S.go(tool, pts, w, o) : S.at(t + (o.dt || 0), tool, pts, w, o));
    const r = S.r;
    // tongues lifted out of the dark with the eraser, leaning off with the wind
    const nt = 3 + (r() < 0.5 ? 1 : 0);
    const tongues = [];
    for (let k = 0; k < nt; k++) {
      const h = fh * (0.45 + r() * 0.6) * (k === 1 ? 1.15 : 0.85);
      const x = fx + (k - (nt - 1) / 2) * fh * 0.14 + (r() - 0.5) * fh * 0.06;
      const ph = r() * 6, lean = -h * (0.2 + r() * 0.25);
      const p = [];
      for (let i = 0; i <= 7; i++) {
        const u = i / 7;
        p.push(x + lean * u * u + Math.sin(u * 8 + ph) * h * 0.08 * (1 - u * 0.4), fy - h * u);
      }
      tongues.push([p, h]);
      go('erase', p, h * 0.15, { f: 2.2, speed: 900, p0: 1.4, p1: 0.12, tin: 0.04, tout: 0.75, dt: k * 0.05 });
    }
    // a little red in their throats
    for (const [p, h] of tongues) if (r() < 0.8) go('red', p.slice(0, 8), h * 0.08, { f: redF === undefined ? 0.7 : redF, speed: 900, p0: 1.2, p1: 0.3, dt: 0.12 });
    // dark flicks between them, and smoke dragged off the tips
    const [p0, h0] = tongues[(r() * tongues.length) | 0];
    go('comp', p0.map((v, i) => (i % 2 ? v + 4 : v + h0 * 0.1)).slice(0, 10), 1.2, { p0: 1, p1: 0.05, tout: 0.7, speed: 1000, dt: 0.18 });
    const tip = tongues[1 % nt][0];
    go('smudge', [tip[14], tip[15], tip[14] - fh * 0.2, tip[15] - fh * 0.5], fh * 0.12, { f: 0.5, speed: 900, dt: 0.22 });
  }
  function era2010(S, L, st) {
    const r = S.r;
    writeYear(S, L, st, 2010);
    const X0 = L.x0 + 22, X1 = L.x1 - 22, Y0 = L.y0 + 24;
    // the sky is driven black with the side of the stick, hardest at the top;
    // the smoke comes down over the hill as well
    for (let y = Y0 + 4; y < 600; y += 15 + r() * 7) {
      const f = 1 - 0.3 * sstep(Y0, 600, y);
      const xa = X0 + r() * 30, xb = X1 - r() * 30, sag = r() * 6;
      const p = [];
      for (let i = 0; i <= 6; i++) {
        const x = lerp(xa, xb, i / 6), yy = y + Math.sin(i * 1.3 + sag) * 10 + (r() - 0.5) * 8;
        p.push(x, Math.min(yy, L.hor(x) - 4));
      }
      S.go('side', r() < 0.5 ? p : rev(p), 22 + r() * 8, { f: 2.3 * f, p0: 0.9, p1: 0.9, speed: 5200, gap: 0.004 });
    }
    S.go('smudge', zig(clipLines(rectPoly(X0, Y0, X1, 590), 0.08, 40, 0.3, r)), 38, { f: 0.75, smooth: true, speed: 5200 });
    // the smoke rolls: round rubbings, heavier billows high up
    for (let i = 0; i < 9; i++) {
      const bx = lerp(X0 + 60, X1 - 60, r()), by = lerp(Y0 + 40, 380, r()), br = 50 + r() * 70;
      S.go('side', scumble(S, bx, by, br, br * 0.6, br * 4, br * 0.5), br * 0.25, { f: 1.8, speed: 4200, gap: 0.004 });
      S.go('smudge', ell(S, bx, by, br * 0.8, br * 0.5, 0, TAU * 1.3, 18, 0.15), br * 0.3, { f: 0.6, speed: 3600 });
    }
    // the fire front along the town: a ragged light rising off the ridge
    st.flames = [];
    const sites = st.houses.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < sites.length; i++) {
      const h = sites[i];
      if (r() < 0.35) continue;
      const fx = h.x + h.w * (0.3 + r() * 0.4), fy = h.y - h.h * 0.4, fh = 70 + r() * 90;
      st.flames.push([fx, fy, fh]);
      flame(S, fx, fy, fh);
    }
    // what stands in front of the fire stands black
    for (const h of st.houses) {
      if (r() < 0.45) continue;
      const rp = [h.x - 2, h.y, h.x - 2, h.y - h.h, h.x + h.w * 0.5, h.y - h.h * 1.65, h.x + h.w + 2, h.y - h.h, h.x + h.w + 2, h.y];
      toneFill(S, rp, 1.3, 3, 2.0, { speed: 3600 });
      S.go('comp', rp, 1.3, { smooth: false, speed: 1600, gap: 0.005 });
      if (r() < 0.5) S.go('erase', [h.x + h.w * 0.25, h.y - h.h * 0.5, h.x + h.w * 0.32, h.y - h.h * 0.5], h.h * 0.12, { f: 1.4, gap: 0.004, speed: 400 });
    }
    // the glow under the smoke: soft, lifted, barely red
    const glow = (dy, j) => hillPts(L, L.footL + 40, L.treeX + 160, 30, S, j).map((v, i) => (i % 2 ? v + dy : v));
    rub(S, glow(-150, 30), 50, 0.35, { speed: 3400 });
    S.go('red', glow(-100, 40), 26, { f: 0.25, speed: 3400 });
    S.go('smudge', glow(-120, 20), 60, { f: 0.4, speed: 3400 });
    // sparks go up
    for (let i = 0; i < 50; i++) {
      const sx = lerp(L.footL + 60, L.treeX + 300, r()), sy = L.hill(sx) - 80 - r() * 300;
      S.go('erase', [sx, sy, sx - 2 - r() * 3, sy - 3 - r() * 4], 1.5 + r() * 1.2, { f: 1.8, gap: 0.003, speed: 200 });
    }
    return (a, b) => {
      let t = a;
      while (t + 0.4 < b) {
        const [fx, fy, fh] = st.flames[(S.r() * st.flames.length) | 0];
        S.at(t, 'side', scumble(S, fx - 20, fy - fh - 40, 34, 22, 160, 14), 7, { f: 1.5, speed: 1600 });
        flame(S, fx + (S.r() - 0.5) * 10, fy, fh * (0.8 + S.r() * 0.4), t + 0.12, 0.5);
        const sx = fx + (S.r() - 0.5) * 60, sy = fy - fh - 30 - S.r() * 160;
        S.at(t + 0.3, 'erase', [sx, sy, sx - 2, sy - 3], 1.8, { f: 1.8, speed: 200 });
        t += 0.34;
      }
    };
  }
  function era2040(S, L, st) {
    const r = S.r;
    writeYear(S, L, st, 2040);
    const X0 = L.x0 + 20, X1 = L.x1 - 20, Y0 = L.y0 + 24;
    // the smoke is lifted: long rubbings across, the dark stays in the paper
    S.go('erase', zig(clipLines(rectPoly(X0, Y0, X1, 545), 0.03, 30, 0.3, r)), 28, { f: 0.9, smooth: false, speed: 9000 });
    S.go('erase', zig(clipLines(rectPoly(X0, Y0 + 40, X1, 520), -0.1, 42, 0.3, r)), 38, { f: 0.5, smooth: false, speed: 9000 });
    // the wires come down, the red is rubbed back
    for (const w of st.wires || []) S.go('erase', w, 3.2, { f: 1.2, speed: 3600, gap: 0.004 });
    for (const w of st.poleWires || []) S.go('erase', w, 2.6, { f: 1.2, speed: 3600, gap: 0.004 });
    // the hill comes back as a shape
    hillContour(S, L, false);
    // ruins: burnt-out shells where the houses were, black walls, empty windows
    st.ruins = [];
    for (const h of st.houses) {
      if (r() < 0.45) continue;
      const x = h.x, y = h.y, w = h.w, hh = h.h;
      st.ruins.push([x, y, w, hh]);
      const gable = r() < 0.5;
      const a = 0.55 + r() * 0.45, b = 0.25 + r() * 0.5;
      const top = [x, y - hh * a, x + w * 0.18, y - hh * (a + (gable ? 0.45 : -0.1)), x + w * 0.3, y - hh * (a - 0.05), x + w * 0.42, y - hh * (b + 0.3), x + w * 0.55, y - hh * b, x + w * 0.7, y - hh * (b + 0.2), x + w * 0.82, y - hh * (b - 0.05), x + w, y - hh * (b + 0.35)];
      const wall = [x, y].concat(top, [x + w, y]);
      toneFill(S, wall, -1.35, Math.max(2.2, w * 0.08), 1.6, { speed: 3000 });
      S.go('comp', [x, y].concat(top.slice(0, 8)), 1.3, { smooth: false, speed: 1300, gap: 0.006 });
      S.go('comp', top.slice(6).concat([x + w, y]), 1.3, { smooth: false, speed: 1300, gap: 0.006 });
      // the window holes, lifted clean
      rub(S, [x + w * 0.16, y - hh * 0.42, x + w * 0.24, y - hh * 0.42], hh * 0.12, 1.4, { speed: 300, gap: 0.004 });
      if (b > 0.45) rub(S, [x + w * 0.6, y - hh * 0.32, x + w * 0.68, y - hh * 0.32], hh * 0.1, 1.4, { speed: 300, gap: 0.004 });
      // a charred beam, rubble at the foot
      if (r() < 0.5) S.go('comp', [x + w * 0.3, y - hh * 0.2, x + w * 0.75, y - hh * (0.9 + r() * 0.4)], 1.4, { p0: 1, p1: 0.6, speed: 900 });
      S.go('comp', scumble(S, x + w * 0.5, y - 2, w * 0.55, 3.5, w * 1.6, 2.4), 1.2, { f: 1.3, speed: 1800, gap: 0.004 });
    }
    // one pylon has lost its head
    if (st.pylons && st.pylons[1]) {
      const p = st.pylons[1];
      scrub(S, rectPoly(p.x - p.H * 0.25, p.y - p.H * 1.02, p.x + p.H * 0.25, p.y - p.H * 0.7), 1.3, Math.max(4, p.H * 0.035), 0.9);
      S.go('comp', [p.x - p.H * 0.05, p.y - p.H * 0.7, p.x + p.H * 0.12, p.y - p.H * 0.82, p.x + p.H * 0.3, p.y - p.H * 0.76], 1.4, { smooth: false });
    }
    // the billboard sags
    if (st.bill) {
      const b = st.bill;
      scrub(S, rectPoly(b.x0 + b.w * 0.45, b.y0 - 4, b.x0 + b.w + 4, b.y0 + b.h + 4), 0.8, 8, 0.7);
      S.go('comp', [b.x0 + b.w * 0.45, b.y0 + 2, b.x0 + b.w * 0.95, b.y0 + b.h * 0.9, b.x0 + b.w * 0.85, b.y0 + b.h + 50], 2.4, { smooth: false });
    }
    // grass, everywhere, taller as it comes near
    for (let i = 0; i < 60; i++) {
      const x = lerp(L.x0 + 40, L.x1 - 40, r());
      const gy = Math.max(L.hill(x), 612);
      const y = lerp(gy + 4, L.y1 - 36, Math.pow(r(), 0.8));
      const yb = st.year;
      if (yb && x > yb[0] - 50 && x < yb[2] + 30 && y > yb[1] - 60) continue;
      const s = L.sc(y);
      grassTuft(S, x, y, 46 * s + 5, 3 + ((r() * 4) | 0), 0.8 + s * 0.9, s < 0.2 ? 'vine' : 'comp');
    }
    return (a, b) => {
      let t = a;
      while (t < b - 0.2) {
        const x = lerp(L.x0 + 60, L.x1 - 60, S.r()), y = lerp(650, L.y1 - 60, Math.sqrt(S.r())), s = L.sc(y);
        S.at(t, 'comp', [x, y, x + (S.r() - 0.4) * 10 * s, y - (30 + S.r() * 30) * s - 3], 0.8 + s * 0.8, { p0: 1, p1: 0.05, tout: 0.6, speed: 500 });
        t += 0.1;
      }
    };
  }
  function era2090(S, L, st) {
    const r = S.r;
    writeYear(S, L, st, 2090);
    // ruins, pylons, poles, the billboard, the factory: all rubbed back into the hill
    scrub(S, hillPoly(L), 0.5, 15, 0.65, { speed: 4200 });
    for (const p of st.pylons || []) {
      scrub(S, [p.x - p.H * 0.4, p.y - p.H * 1.02, p.x + p.H * 0.4, p.y - p.H * 1.02, p.x + p.H * 0.2, p.y + 2, p.x - p.H * 0.2, p.y + 2], 1.35, Math.max(5, p.H * 0.04), 0.85, { speed: 4000 });
    }
    for (const [x, y, h] of st.poles || []) rub(S, [x, y - h, x, y + 2], Math.max(2.5, h * 0.05), 1.0, { speed: 3000 });
    if (st.bill) { const b = st.bill; scrub(S, rectPoly(b.x0 - 8, b.y0 - 8, b.x0 + b.w + 8, b.y0 + b.h + 90), 0.7, 12, 0.8); }
    if (st.factory) { const f = st.factory; scrub(S, rectPoly(f.x0 - 6, f.top - 12, f.x0 + f.w + 6, f.y + 4), 1.1, 12, 0.85, { speed: 4000 }); }
    if (st.road) scrub(S, st.road.le.concat(rev(st.road.ri)), 0.4, 14, 0.5, { speed: 4200 });
    st.pylons = null; st.wires = null; st.bill = null; st.factory = null; st.poles = null; st.poleWires = null;
    // the hill, said again; the field, sown with grass
    hillContour(S, L, false);
    hillTone(S, L, 0.45);
    stumpGhost(S, L);
    sapling(S, L, st, 0);
    st.birds = [];
    const bx = L.cxl(L.cx - 380 + r() * 120, 120), by = L.y0 + (600 - L.y0) * 0.42;
    for (let i = 0; i < 4; i++) st.birds.push({ x: bx + i * 36 + (r() - 0.5) * 30, y: by + (r() - 0.5) * 40, s: 9 + r() * 5, f: r() < 0.5 });
    drawBirds(S, st.birds);
    return (a, b) => {
      sapling(S, L, st, 1, a + 0.3);
      sapling(S, L, st, 2, a + (b - a) * 0.55);
      flyBirds(S, st, a, b, 64, -5);
    };
  }

  const ERAS = [
    { year: 1890, fn: era1890, dur: [28, 17] },
    { year: 1910, fn: era1910, dur: [16, 15] },
    { year: 1930, fn: era1930, dur: [15, 14] },
    { year: 1950, fn: era1950, dur: [16, 15] },
    { year: 1970, fn: era1970, dur: [16, 15] },
    { year: 1990, fn: era1990, dur: [18, 16] },
    { year: 2010, fn: era2010, dur: [20, 18] },
    { year: 2040, fn: era2040, dur: [17, 15] },
    { year: 2090, fn: era2090, dur: [16, 15] },
  ];
  const HOLD = 3.4;

  // one cycle = a century drawn on the sheet. returns specs sorted by start time
  function buildCycle(seed, cycle, t0, L, st, info) {
    const ci = cycle & 1;
    const S = new Score(mulberry32(hash32(seed, cycle, 0x5eed)), t0);
    const eraStarts = [];
    for (let e = 0; e < ERAS.length; e++) {
      const E = ERAS[e];
      const start = S.t;
      eraStarts.push(start);
      const i0 = S.out.length;
      const amb = E.fn(S, L, st, ci);
      // fit the drawing into the era's time, keeping the hand's rhythm
      const target = E.dur[ci] - HOLD;
      const natural = S.t - start;
      if (natural > target) {
        const k = target / natural;
        for (let i = i0; i < S.out.length; i++) {
          const s = S.out[i];
          s.t0 = start + (s.t0 - start) * k; s.t1 = start + (s.t1 - start) * k;
        }
        S.t = start + natural * k;
      }
      if (info) info.push({ cycle, year: E.year, natural: +natural.toFixed(2), n: S.out.length - i0 });
      const hs = S.t + 0.2, he = start + E.dur[ci];
      if (amb) amb(hs, he - 0.2);
      // a dirty thumb on the margin now and then
      if (S.r() < 0.45) fingerprint(S, L, start + S.r() * (E.dur[ci] - 1));
      S.t = he;
    }
    S.out.sort((a, b) => a.t0 - b.t0);
    return { specs: S.out, end: S.t, eraStarts };
  }

  /* ================================================================ engine */
  const DT = 1 / 60;
  const GAP = 3.5;          // fresh sheet pause
  function Engine(seed, L, X, sim) {
    this.seed = seed; this.L = L; this.X = X; this.sim = sim;
    this.specs = []; this.next = 0; this.active = [];
    this.t = 0; this.cycle = 0; this.builtTo = 0; this.st = {};
    this.events = []; this.info = [];
    this.marks = [];      // [{t, cycle, year}] for labels/debug
    this.onReset = null;
  }
  Engine.prototype.build = function () {
    const c = this.cycle;
    let t0 = this.builtTo;
    if (c > 0 && (c & 1) === 0) {
      // lay down a fresh sheet
      this.events.push({ t: t0 + 0.4, reset: true });
      t0 += GAP; this.st = {};
    } else if (c === 0) t0 = 0.35;
    const cyc = buildCycle(this.seed, c, t0, this.L, this.st, this.info);
    for (const s of cyc.specs) this.specs.push(s);
    cyc.eraStarts.forEach((t, e) => this.marks.push({ t, cycle: c, year: ERAS[e].year }));
    this.builtTo = cyc.end;
    this.cycle++;
  };
  Engine.prototype.step = function () {
    const t = (this.t += DT);
    while (this.builtTo < t + 8) this.build();
    while (this.events.length && this.events[0].t <= t) {
      const ev = this.events.shift();
      if (ev.reset) {
        // strokes still running belong to the old sheet
        this.active.length = 0;
        if (this.onReset) this.onReset(t);
        this.sim.clear();
      }
    }
    const L = this.specs;
    while (this.next < L.length && L[this.next].t0 <= t) {
      const st = compile(L[this.next], this.X);
      L[this.next] = null; this.next++;
      if (st) this.active.push(st);
    }
    if (this.next > 4096) { this.specs = L.slice(this.next); this.next = 0; }
    let w = 0;
    const act = this.active;
    for (let i = 0; i < act.length; i++) {
      const st = act[i];
      const u = clamp((t - st.t0) / Math.max(1e-4, st.t1 - st.t0), 0, 1);
      const e = 0.35 * u + 0.65 * u * u * (3 - 2 * u);
      const upto = u >= 1 ? st.nd : Math.min(st.nd, Math.ceil(e * st.nd));
      if (upto > st.done) applyDabs(this.sim, st, upto);
      if (st.done < st.nd) act[w++] = st;
    }
    act.length = w;
  };
  Engine.prototype.yearAt = function (t) {
    let y = null; for (const m of this.marks) if (m.t <= t) y = m; return y;
  };

  /* ================================================================ display (WebGL2) */
  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
  const NOISE = `
uvec2 pcg2d(uvec2 v){ v = v * 1664525u + 1013904223u; v.x += v.y * 1664525u; v.y += v.x * 1664525u; v = v ^ (v >> 16u);
  v.x += v.y * 1664525u; v.y += v.x * 1664525u; v = v ^ (v >> 16u); return v; }
vec2 rnd2(vec2 p){ uvec2 u = pcg2d(uvec2(ivec2(floor(p)) + 65536)); return vec2(u) / 4294967295.0; }
float rnd(vec2 p){ return rnd2(p).x; }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(rnd(i), rnd(i + vec2(1, 0)), u.x), mix(rnd(i + vec2(0, 1)), rnd(i + vec2(1, 1)), u.x), u.y); }
float wor(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y); vec2 r = g + rnd2(i + g) * 0.9 + 0.05 - f; d = min(d, dot(r, r)); }
  return sqrt(d); }
vec2 wor2(vec2 p){ vec2 i = floor(p), f = fract(p); float d1 = 9.0, d2 = 9.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y); vec2 r = g + rnd2(i + g) * 0.9 + 0.05 - f; float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return vec2(sqrt(d1), sqrt(d2)); }
`;
  const FS_TOOTH = `#version 300 es
precision highp float;
uniform vec2 uOff; uniform float uScale;
out vec4 o;
${NOISE}
void main(){
  vec2 q = gl_FragCoord.xy * uScale + uOff;
  vec2 wq = q + vec2(vn(q * 0.07), vn(q * 0.07 + 31.7)) * 5.0;
  vec2 f12 = wor2(wq / 2.4);
  float a = 1.0 - f12.x;
  float ridge = smoothstep(0.0, 0.35, f12.y - f12.x);
  float b = 1.0 - wor2(wq / 1.15 + 11.0).x;
  float c = vn(q / 0.7);
  float fib = vn(vec2(q.x * 0.25 + q.y * 0.55, q.y * 0.07 - q.x * 0.12) * 1.4);
  float h = a * 0.3 + ridge * 0.22 + b * 0.18 + c * 0.1 + fib * 0.1 + vn(q / 6.0) * 0.14 + vn(q / 19.0) * 0.12;
  float mot = vn(q / 150.0) * 0.55 + vn(q / 41.0) * 0.3 + vn(q / 9.0) * 0.15;
  o = vec4(clamp((h - 0.2) / 0.62, 0.0, 1.0), mot, 0.0, 1.0);
}`;
  const FS_SHADE = `#version 300 es
precision highp float;
uniform sampler2D uT;
out vec4 o;
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy); ivec2 s = textureSize(uT, 0) - 1;
  vec4 c = texelFetch(uT, p, 0);
  float l = texelFetch(uT, clamp(p + ivec2(-1, 0), ivec2(0), s), 0).r;
  float r = texelFetch(uT, clamp(p + ivec2(1, 0), ivec2(0), s), 0).r;
  float d = texelFetch(uT, clamp(p + ivec2(0, -1), ivec2(0), s), 0).r;
  float u = texelFetch(uT, clamp(p + ivec2(0, 1), ivec2(0), s), 0).r;
  float sh = 0.5 - ((r - l) * -0.7 + (u - d) * 0.7) * 0.9;
  o = vec4(c.r, clamp(sh, 0.0, 1.0), c.g, 1.0);
}`;
  const FS_SHOW = `#version 300 es
precision highp float;
uniform sampler2D uSim, uOld, uPap;
uniform vec2 uRes; uniform vec4 uSheet; uniform float uDpr, uMix;
uniform vec4 uTape[4];
out vec4 o;
${NOISE}
float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
vec3 marks(vec4 s, float h, float sh, vec3 paper){
  float A = s.r * s.r * 2.0;
  float T = s.g * s.g * 2.4;
  float R = s.b * s.b * 1.3;
  // loose pigment catches the peaks of the tooth first; pressure fills the valleys
  float th = 1.0 - 1.08 * pow(A, 0.6);
  float cov = smoothstep(th - 0.11, th + 0.11, h);
  float dA = cov * (0.5 + 0.5 * (1.0 - exp(-2.2 * A)));
  dA = max(dA, (1.0 - exp(-A * 0.9)) * 0.32);
  // tone sits in the valleys, softly
  float dT = clamp((1.0 - exp(-T * 1.55)) * (0.84 + 0.3 * (1.0 - h)), 0.0, 1.0);
  float d = 1.0 - (1.0 - dA) * (1.0 - dT);
  vec3 pc = paper * (1.0 + (sh - 0.5) * 0.085 * (1.0 - d));
  vec3 ink = mix(vec3(0.2, 0.19, 0.185), vec3(0.06, 0.055, 0.052), smoothstep(0.3, 0.95, d));
  vec3 c = mix(pc, ink, smoothstep(0.0, 1.0, d) * 0.4 + d * 0.6);
  float rth = 1.0 - clamp(1.1 * pow(R, 0.6), 0.0, 1.05);
  float rc = smoothstep(rth - 0.1, rth + 0.1, h) * clamp(R * 1.8, 0.0, 1.0);
  c = mix(c, vec3(0.76, 0.2, 0.11) * (1.0 - 0.55 * d), rc * 0.88);
  return c;
}
vec3 sheetCol(vec2 q, float e, bool old){
  vec2 uv = q / uSheet.zw;
  vec4 P = texture(uPap, old ? fract(uv + vec2(0.37, 0.61)) : uv);
  float h = P.r, sh = P.g, mot = P.b;
  vec3 paper = vec3(0.962, 0.944, 0.9) * (0.975 + 0.045 * mot);
  // light from the upper left, edges a little toasted
  vec2 suv = vec2(uv.x, 1.0 - uv.y);
  paper *= 1.03 - 0.075 * length((suv - vec2(0.15, 0.1)) * vec2(0.8, 1.0));
  float ed = min(min(suv.x, 1.0 - suv.x) * uSheet.z, min(suv.y, 1.0 - suv.y) * uSheet.w) / uDpr;
  paper *= mix(vec3(0.93, 0.9, 0.84), vec3(1.0), smoothstep(0.0, 14.0, ed));
  vec3 c = old ? marks(texture(uOld, suv), h, sh, paper) : marks(texture(uSim, suv), h, sh, paper);
  // the very edge catches a hair of shadow
  return c * (1.0 - 0.18 * (1.0 - smoothstep(-2.5 * uDpr, 0.0, e)));
}
void main(){
  vec2 fc = gl_FragCoord.xy;
  vec2 css = fc / uDpr;
  // the studio wall
  vec2 wv = fc / uRes;
  float lamp = 1.0 - 0.55 * length((wv - vec2(0.3, 1.05)) * vec2(0.9, 1.0));
  vec3 col = vec3(0.13, 0.118, 0.105) * (0.62 + 0.5 * clamp(lamp, 0.0, 1.0));
  col *= 0.93 + 0.1 * vn(css / 70.0) + 0.04 * vn(css / 6.0);
  vec2 hs = uSheet.zw * 0.5;
  float wob = (vn(css * 0.11) - 0.5) * 1.4 * uDpr + (vn(css * 0.9) - 0.5) * 0.5 * uDpr;
  // a fresh sheet is laid down over the old one: it slides in from above
  float k = 1.0 - uMix; k = k * k * (3.0 - 2.0 * k);
  vec2 off = vec2(-0.02 * uSheet.z * k, (uSheet.w + uSheet.y + 40.0 * uDpr) * k);
  vec2 q = fc - uSheet.xy - off;
  if (uMix < 1.0) {
    vec2 qo = fc - uSheet.xy;
    float so = sdBox(qo - hs - vec2(6.0, -10.0) * uDpr, hs);
    col *= 1.0 - 0.6 * (1.0 - smoothstep(-8.0 * uDpr, 30.0 * uDpr, so));
    float eo = sdBox(qo - hs, hs) + wob;
    if (eo < 0.0) col = sheetCol(qo, eo, true);
  }
  // shadow of the (top) sheet
  float sd = sdBox(q - hs - vec2(6.0, -10.0) * uDpr * (1.0 + 2.0 * k), hs);
  col *= 1.0 - (0.6 - 0.15 * k) * (1.0 - smoothstep(-8.0 * uDpr, (30.0 + 40.0 * k) * uDpr, sd));
  float e = sdBox(q - hs, hs) + wob;
  if (e < 0.0) col = sheetCol(q, e, false);
  // masking tape, holding the top sheet
  for (int i = 0; i < 4; i++) {
    vec4 t = uTape[i];
    if (t.w <= 0.0) continue;
    vec2 d = fc - t.xy - off;
    float ca = cos(t.z), sa = sin(t.z);
    vec2 l = vec2(d.x * ca + d.y * sa, -d.x * sa + d.y * ca) / uDpr;
    float tear = (vn(vec2(l.y * 0.7, float(i) * 13.0)) - 0.5) * 5.0 + (rnd(vec2(floor(l.y * 1.3), float(i))) - 0.5) * 1.6;
    if (abs(l.x) < t.w * 0.5 + tear && abs(l.y) < 12.5) {
      float g = 0.88 + 0.08 * vn(l * 0.6 + float(i) * 7.0) + 0.05 * vn(l * vec2(0.05, 1.4));
      vec3 tape = vec3(0.86, 0.81, 0.68) * g;
      col = mix(col, tape, 0.72) * (1.0 - 0.1 * smoothstep(9.0, 12.5, abs(l.y)));
    }
  }
  o = vec4(col, 1.0);
}`;

  function makeDisplay(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    function prog(fs) {
      const p = gl.createProgram();
      for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
        const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name); }
      return { p, u };
    }
    const D = { gl, pT: prog(FS_TOOTH), pS: prog(FS_SHADE), pD: prog(FS_SHOW), vao: gl.createVertexArray() };
    function tex(w, h, filter) {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }
    D.tex = tex;
    D.paper = function (w, h, scale, off) {
      if (D.pap) { gl.deleteTexture(D.pap); D.pap = null; }
      const t1 = tex(w, h, gl.NEAREST), t2 = tex(w, h, gl.LINEAR);
      const fb = gl.createFramebuffer();
      gl.bindVertexArray(D.vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t1, 0);
      gl.viewport(0, 0, w, h);
      gl.useProgram(D.pT.p);
      gl.uniform2f(D.pT.u.uOff, off[0], off[1]); gl.uniform1f(D.pT.u.uScale, scale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t2, 0);
      gl.useProgram(D.pS.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t1); gl.uniform1i(D.pS.u.uT, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(fb); gl.deleteTexture(t1);
      D.pap = t2;
    };
    D.simTex = function (w, h) {
      if (D.sim) gl.deleteTexture(D.sim);
      if (D.old) gl.deleteTexture(D.old);
      D.sim = tex(w, h, gl.LINEAR); D.old = tex(w, h, gl.LINEAR);
      D.sw = w; D.sh = h;
      D.buf = new Uint8Array(TILE * TILE * 4 * Math.ceil(w / TILE));
    };
    D.swapOld = function () { const t = D.old; D.old = D.sim; D.sim = t; };
    const LUT = new Uint8Array(4097);
    for (let i = 0; i <= 4096; i++) LUT[i] = Math.round(Math.sqrt(i / 4096) * 255);
    D.upload = function (sim, all) {
      const w = sim.w, tw = sim.tw, th = sim.th, tiles = sim.tiles, A = sim.A, T = sim.T, G = sim.G, R = sim.R;
      gl.bindTexture(gl.TEXTURE_2D, D.sim);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      const buf = D.buf;
      let n = 0;
      for (let ty = 0; ty < th; ty++) {
        let tx = 0;
        while (tx < tw) {
          if (!all && !tiles[ty * tw + tx]) { tx++; continue; }
          let te = tx;
          while (te + 1 < tw && (all || tiles[ty * tw + te + 1])) te++;
          const x0 = tx * TILE, x1 = Math.min(w, (te + 1) * TILE), y0 = ty * TILE, y1 = Math.min(sim.h, y0 + TILE);
          const rw = x1 - x0;
          let o = 0;
          for (let y = y0; y < y1; y++) {
            let i = y * w + x0;
            for (let x = 0; x < rw; x++, i++) {
              let a = A[i] * 2048; a = a > 4096 ? 4096 : a;
              let g = (T[i] + G[i]) * 1706.7; g = g > 4096 ? 4096 : g;
              let r = R[i] * 3150; r = r > 4096 ? 4096 : r;
              buf[o] = LUT[a | 0]; buf[o + 1] = LUT[g | 0]; buf[o + 2] = LUT[r | 0]; buf[o + 3] = 255; o += 4;
            }
          }
          gl.texSubImage2D(gl.TEXTURE_2D, 0, x0, y0, rw, y1 - y0, gl.RGBA, gl.UNSIGNED_BYTE, buf, 0);
          for (let k = tx; k <= te; k++) tiles[ty * tw + k] = 0;
          n += te - tx + 1;
          tx = te + 1;
        }
      }
      return n;
    };
    D.clearOld = function () {
      gl.bindTexture(gl.TEXTURE_2D, D.old);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, D.sw, D.sh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    };
    D.draw = function (cw, ch, dpr, sheet, mix, tapes) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, cw, ch);
      gl.useProgram(D.pD.p);
      gl.bindVertexArray(D.vao);
      const u = D.pD.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, D.sim); gl.uniform1i(u.uSim, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, D.old); gl.uniform1i(u.uOld, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, D.pap); gl.uniform1i(u.uPap, 2);
      gl.uniform2f(u.uRes, cw, ch);
      gl.uniform4f(u.uSheet, sheet[0], sheet[1], sheet[2], sheet[3]);
      gl.uniform1f(u.uDpr, dpr); gl.uniform1f(u.uMix, mix);
      gl.uniform4fv(u.uTape, tapes);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    D.destroy = function () {
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    };
    return D;
  }

  /* ================================================================ layout */
  function layoutFor(vw, vh, dpr) {
    const m = Math.round(clamp(Math.min(vw, vh) * 0.034, 12, 40));
    const sw = vw - 2 * m, sh = vh - 2 * m;
    const a = sw / sh;
    let W, H;
    if (a >= 0.9) { H = 1000; W = 1000 * a; } else { W = a > 0.62 ? 900 : 840; H = W / a; }
    const cy = H > 1000 ? 600 - 0.1 * H : 500;
    const wx0 = (a >= 1.2 ? 800 : 830) - W / 2;
    // simulation resolution: about one cell per css pixel, more on small screens, capped
    let s = Math.min(dpr, a < 0.9 ? 1.5 : 1.15);
    const maxPx = 2.1e6;
    if (sw * sh * s * s > maxPx) s = Math.sqrt(maxPx / (sw * sh));
    const simW = Math.max(64, Math.round(sw * s)), simH = Math.max(64, Math.round(sh * s));
    return { vw, vh, m, sw, sh, W, H, wx0, wy0: cy - H / 2, simW, simH, k: simW / W };
  }

  window.__palTest = { buildCycle, makeLand, layoutFor, Engine, Sim, compile };

  /* ================================================================ the piece */
  (window.PIECES = window.PIECES || []).push({
    id: 'palimpsest',
    title: 'One Hill, a Hundred Years',
    medium: 'Charcoal and eraser, one sheet, redrawn',
    note: 'Nothing drawn here is ever fully erased.',
    about: 'A hill, an oak and a century, drawn and rubbed out and drawn again on a single sheet, in the manner of drawings made for a rostrum camera. Every erased state stays in the paper as a grey ghost, so the sheet grows heavier with what it remembers.',
    tone: 'light',
    room: '#1a1714',
    mount(el, api) {
      const params = new URLSearchParams(location.search);
      const dbgT = params.has('pal_t') ? Math.max(0, parseFloat(params.get('pal_t')) || 0) : null;
      const freeze = params.has('pal_freeze');
      const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      const seed = api.seed >>> 0;

      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      el.appendChild(canvas);
      let D = null;
      try { D = makeDisplay(canvas); } catch (e) { console.error(e); D = null; }
      if (!D) {
        el.style.cssText += ';display:flex;align-items:center;justify-content:center;color:#cbbfae;font:italic 18px serif;background:#1a1714';
        el.textContent = 'This drawing needs WebGL2 to be shown.';
        api.ready();
        return { destroy() {} };
      }

      let alive = true, raf = 0, busy = false, lost = false;
      let lay = null, L = null, sim = null, eng = null, dpr = 1, cw = 0, ch = 0;
      let clock = 0, resetAt = -1e9, dirty = true;
      const tapes = new Float32Array(16);

      function placeTapes(rng) {
        const sx = lay.m * dpr, sy = lay.m * dpr, sw = lay.sw * dpr, sh = lay.sh * dpr;
        const top = ch - sy;
        const len = clamp(lay.sw * 0.06, 54, 96);
        const corners = [[sx + 6 * dpr, top - 6 * dpr, 0.75], [sx + sw - 6 * dpr, top - 6 * dpr, -0.75], [sx + 6 * dpr, sy + 6 * dpr, -0.72], [sx + sw - 6 * dpr, sy + 6 * dpr, 0.72]];
        for (let i = 0; i < 4; i++) {
          const c = corners[i];
          tapes[i * 4] = c[0]; tapes[i * 4 + 1] = c[1]; tapes[i * 4 + 2] = c[2] + (rng() - 0.5) * 0.25; tapes[i * 4 + 3] = len * (0.85 + rng() * 0.3);
        }
      }
      // the wall, the sheet, its tooth: everything but the drawing
      function frameSetup() {
        const vw = Math.max(1, el.clientWidth), vh = Math.max(1, el.clientHeight);
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cw = Math.round(vw * dpr); ch = Math.round(vh * dpr);
        canvas.width = cw; canvas.height = ch;
        const nl = layoutFor(vw, vh, dpr);
        const pw = Math.round(nl.sw * dpr), ph = Math.round(nl.sh * dpr);
        let ps = 1;
        if (pw * ph > 7e6) ps = Math.sqrt(7e6 / (pw * ph));
        const r = mulberry32(hash32(seed, 9));
        D.paper(Math.max(1, Math.round(pw * ps)), Math.max(1, Math.round(ph * ps)), 1 / (dpr * ps), [r() * 5000, r() * 5000]);
        const keep = lay && Math.abs(nl.W - lay.W) / lay.W < 0.03 && Math.abs(nl.H - lay.H) / lay.H < 0.03;
        if (keep) { nl.simW = lay.simW; nl.simH = lay.simH; nl.k = lay.k; }
        lay = nl;
        placeTapes(r);
        dirty = true;
        return keep;
      }
      // the drawing itself, from a blank sheet
      function simSetup() {
        L = makeLand(seed, lay);
        sim = new Sim(lay.simW, lay.simH);
        D.simTex(lay.simW, lay.simH);
        const X = { ox: lay.wx0, oy: lay.wy0, k: lay.k, w: lay.simW, h: lay.simH };
        eng = new Engine(seed, L, X, sim);
        // a fresh sheet: the old drawing stays in uOld while the new one fades in over it
        eng.onReset = (tt) => { D.upload(sim, false); D.swapOld(); resetAt = tt; };
        clock = 0; resetAt = -1e9;
      }

      function nextFrame() { return new Promise((res) => requestAnimationFrame(() => res())); }
      // run the score forward to T in slices, never holding the page for long
      async function fastForward(T, progressive) {
        busy = true;
        const my = eng;
        let shown = performance.now();
        while (my.t + DT <= T) {
          const t0 = performance.now();
          while (my.t + DT <= T && performance.now() - t0 < 30) my.step();
          if (progressive && t0 - shown > 160) { D.upload(sim, false); clock = my.t; show(); shown = performance.now(); }
          await nextFrame();
          if (!alive || my !== eng) return false;
        }
        D.upload(sim, true);
        clock = my.t;
        busy = false;
        dirty = true;
        return true;
      }

      function mixNow() { return clamp((clock - resetAt - 0.2) / 2.6, 0, 1); }
      function show() {
        if (lost) return;
        D.draw(cw, ch, dpr, [lay.m * dpr, lay.m * dpr, lay.sw * dpr, lay.sh * dpr], mixNow(), tapes);
      }

      let last = performance.now();
      function frame(now) {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
        if (!api.isCurrent() || lost) return;
        let changed = dirty;
        if (!busy && !freeze && !reduce) {
          clock += dt;
          if (clock > eng.t + 0.25) clock = eng.t + 0.25;
          const t0 = performance.now();
          while (eng.t + DT <= clock && performance.now() - t0 < 10) eng.step();
          if (D.upload(sim, false) > 0) changed = true;
          if (mixNow() < 1) changed = true;
        }
        if (changed && !busy) { show(); dirty = false; }
      }

      (async () => {
        frameSetup(); simSetup(); show();
        if (reduce) {
          // a single accumulated state: the end of the first century, all its ghosts
          api.ready();
          while (!eng.marks.length) eng.build();
          let T = 0; for (const m of eng.marks) if (m.cycle === 0 && m.year === 2090) T = m.t;
          await fastForward(T + ERAS[8].dur[0] - 0.4, false);
        } else if (dbgT !== null) {
          await fastForward(dbgT, false);
          show();
          api.ready();
        } else {
          api.ready();
        }
        document.documentElement.dataset.palDone = '1';
        if (alive) raf = requestAnimationFrame(frame);
      })();

      // resizing: the same sheet is simply re-laid; a differently shaped one is redrawn, quickly
      let rto = 0, lastW = el.clientWidth, lastH = el.clientHeight, lastD = Math.min(2, window.devicePixelRatio || 1);
      const ro = new ResizeObserver(() => {
        clearTimeout(rto);
        rto = setTimeout(() => {
          if (!alive || !eng) return;
          const w = el.clientWidth, h = el.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
          if (w === lastW && h === lastH && d === lastD) return;
          lastW = w; lastH = h; lastD = d;
          const t = eng.t;
          if (frameSetup()) { D.upload(sim, true); show(); return; }
          simSetup(); show();
          fastForward(t, true);
        }, 300);
      });
      ro.observe(el);

      canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
      canvas.addEventListener('webglcontextrestored', () => {
        if (!alive) return;
        try { D = makeDisplay(canvas); } catch (e) { console.error(e); return; }
        lost = false;
        const w = lay; lay = null; frameSetup(); lay.simW = w.simW; lay.simH = w.simH; lay.k = w.k;
        D.simTex(lay.simW, lay.simH); D.upload(sim, true); dirty = true;
      });

      window.__pal = { info: () => ({ t: eng && +eng.t.toFixed(2), year: eng && eng.yearAt(eng.t), sim: lay && [lay.simW, lay.simH], eras: eng && eng.info.slice(0, 18) }) };

      return {
        destroy() {
          alive = false;
          cancelAnimationFrame(raf);
          clearTimeout(rto);
          ro.disconnect();
          if (window.__pal) delete window.__pal;
          delete document.documentElement.dataset.palDone;
          D.destroy();
        },
      };
    },
  });
})();
