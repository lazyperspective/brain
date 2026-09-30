/* pen.js — the ink. Every mark is a tiny variable-width polygon laid on the sheet;
 * hatching follows the surface parametrisation (cross-contour rings, diagonals,
 * longitudinals), the tone buffer decides where and how heavily the pen presses. */
(function () {
  'use strict';
  const HS = window.HS;
  const { clamp, lerp, smooth, V, PI } = HS;
  const cos = Math.cos, sin = Math.sin, sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor;

  /* ---------------- ink accumulator ---------------- */
  class Ink {
    constructor(ctx) { this.ctx = ctx; this.n = 0; this.count = 0; ctx.beginPath(); }
    /* pts: flat [x,y,...] ; ws: full width at each point (px) */
    stroke(pts, ws) {
      const n = pts.length >> 1;
      if (n < 2) return;
      const ctx = this.ctx;
      const L = new Array(n * 2), R = new Array(n * 2);
      for (let i = 0; i < n; i++) {
        const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
        let tx = pts[i1 * 2] - pts[i0 * 2], ty = pts[i1 * 2 + 1] - pts[i0 * 2 + 1];
        const l = Math.hypot(tx, ty) || 1;
        tx /= l; ty /= l;
        const hw = ws[i] * 0.5;
        L[i * 2] = pts[i * 2] - ty * hw; L[i * 2 + 1] = pts[i * 2 + 1] + tx * hw;
        R[i * 2] = pts[i * 2] + ty * hw; R[i * 2 + 1] = pts[i * 2 + 1] - tx * hw;
      }
      ctx.moveTo(L[0], L[1]);
      for (let i = 1; i < n; i++) ctx.lineTo(L[i * 2], L[i * 2 + 1]);
      for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i * 2], R[i * 2 + 1]);
      ctx.closePath();
      this.count++;
      if (++this.n >= 3000) this.flush();
    }
    flush() { if (this.n) { this.ctx.fill(); this.ctx.beginPath(); this.n = 0; } }
  }
  HS.Ink = Ink;

  /* ---------------- helpers ---------------- */
  const S = { x: 0, y: 0, d: 0, F: 0, att: 1, cm: 1 };
  function sample(s, fi, fj, o) {
    let i0 = floor(fi), j0 = floor(fj);
    if (i0 >= s.nu - 1) i0 = s.nu - 2; if (i0 < 0) i0 = 0;
    if (j0 >= s.nv - 1) j0 = s.nv - 2; if (j0 < 0) j0 = 0;
    const tu = fi - i0, tv = fj - j0, nv = s.nv;
    const a = i0 * nv + j0, b = a + nv, c = a + 1, d = b + 1;
    const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
    o.x = s.Sx[a] * w00 + s.Sx[b] * w10 + s.Sx[c] * w01 + s.Sx[d] * w11;
    o.y = s.Sy[a] * w00 + s.Sy[b] * w10 + s.Sy[c] * w01 + s.Sy[d] * w11;
    o.d = s.Sd[a] * w00 + s.Sd[b] * w10 + s.Sd[c] * w01 + s.Sd[d] * w11;
    o.F = s.F[a] * w00 + s.F[b] * w10 + s.F[c] * w01 + s.F[d] * w11;
    o.att = s.att[a] * w00 + s.att[b] * w10 + s.att[c] * w01 + s.att[d] * w11;
    return o;
  }

  function visibleAt(tile, x, y, d, F, extra) {
    const px = Math.round(x - 0.5), py = Math.round(y - 0.5);
    if (px < 1 || py < 1 || px >= tile.w - 1 || py >= tile.h - 1) return false;
    const tanT = Math.min(8, sqrt(Math.max(0, 1 - F * F)) / Math.max(F, 0.05));
    const eps = 0.05 + (extra || 0) + (1.6 / tile.k) * tanT;
    return d <= tile.depth[py * tile.w + px] + eps;
  }
  function toneAt(tile, x, y) {
    const px = Math.round(x - 0.5), py = Math.round(y - 0.5), w = tile.w;
    const i = py * w + px;
    if (tile.id[i]) return tile.T[i];
    let m = 0;
    if (tile.id[i - 1]) m = Math.max(m, tile.T[i - 1]);
    if (tile.id[i + 1]) m = Math.max(m, tile.T[i + 1]);
    if (tile.id[i - w]) m = Math.max(m, tile.T[i - w]);
    if (tile.id[i + w]) m = Math.max(m, tile.T[i + w]);
    return m;
  }

  /* jittered, tapered emission of a stroke run */
  function emit(ink, tile, X, Y, W, ctx, rng, noise, wob) {
    const n = X.length;
    if (n < 2) return;
    const ox = tile.x0, oy = tile.y0;
    const pts = new Array(n * 2), ws = new Array(n);
    const off0 = (rng() - 0.5) * 0.7;
    const ph = rng() * 100;
    for (let i = 0; i < n; i++) {
      const i0 = i > 0 ? i - 1 : i, i1 = i < n - 1 ? i + 1 : i;
      let tx = X[i1] - X[i0], ty = Y[i1] - Y[i0];
      const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const o = off0 + wob * noise(i * 0.22 + ph, ph * 0.3, 1.7);
      pts[i * 2] = X[i] + ox - ty * o; pts[i * 2 + 1] = Y[i] + oy + tx * o;
      const u = n > 1 ? i / (n - 1) : 0;
      const tp = Math.min(1, 0.3 + u / 0.12 * 0.7) * Math.min(1, 0.22 + (1 - u) / 0.4 * 0.78);
      ws[i] = Math.max(0.28, W[i] * tp);
    }
    ink.stroke(pts, ws);
  }

  /* ---------------- hatch line families in the metric (cm) parameter plane ---------------- */
  function makeLines(s, alphaDeg, spc, rng) {
    const Sa = s.extU, Sb = s.extV;
    const al = (alphaDeg * PI) / 180;
    let ca = cos(al), sa = sin(al);
    const lines = [];
    const ph = rng();
    if (s.cyc) {
      if (abs(sa) > 0.985) {
        const n = Math.max(1, floor(Sa / spc));
        for (let k = 0; k < n; k++) {
          const X = (k + ph) * (Sa / n);
          lines.push({ X0: X, Y0: rng() * Sb, dx: 0, dy: 1, t0: 0, t1: Sb });
        }
      } else {
        if (ca < 0) { ca = -ca; sa = -sa; }
        const K = Math.max(1, Math.round((Sb * ca) / spc));
        if (abs(ca) >= abs(sa)) {
          for (let k = 0; k < K; k++) lines.push({ X0: 0, Y0: ((k + ph) * Sb) / K, dx: ca, dy: sa, t0: 0, t1: Sa / ca });
        } else {
          const Pp = (Sb * ca) / abs(sa);
          for (let k = 0; k < K; k++) {
            const X0 = ((k + ph) * Pp) / K;
            lines.push({ X0, Y0: 0, dx: ca, dy: sa, t0: -X0 / ca, t1: (Sa - X0) / ca });
          }
        }
      }
    } else {
      const nx = -sa, ny = ca;
      const cs = [0, Sa * nx, Sb * ny, Sa * nx + Sb * ny].map((v, i) => v);
      const cmin = Math.min(...cs), cmax = Math.max(...cs);
      for (let c = cmin + ph * spc; c < cmax; c += spc) {
        const bx = c * nx, by = c * ny;
        let t0 = -1e9, t1 = 1e9;
        const clip = (b, dv, lo, hi) => {
          if (abs(dv) < 1e-9) { if (b < lo || b > hi) { t0 = 1; t1 = 0; } return; }
          let ta = (lo - b) / dv, tb = (hi - b) / dv;
          if (ta > tb) { const t = ta; ta = tb; tb = t; }
          t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
        };
        clip(bx, ca, 0, Sa); clip(by, sa, 0, Sb);
        if (t1 > t0) lines.push({ X0: bx, Y0: by, dx: ca, dy: sa, t0, t1 });
      }
    }
    return lines;
  }

  /* ---------------- hatching one layer on one surface ---------------- */
  function hatchLayer(tile, s, L, ink, rng, noise, opt) {
    const k = tile.k, Sa = s.extU, Sb = s.extV;
    if (Sa < 0.05 || Sb < 0.05) return;
    const spc = (L.sp * (opt.spScale || 1)) / k;
    const lines = makeLines(s, L.a + (rng() - 0.5) * 2 * (L.jit || 6), spc, rng);
    const step = 0.9 / k;
    const nuM = s.nu - 1, nvM = s.nv - 1;
    const toneMul = s.toneMul || 1;
    const thrBase = L.thr + opt.thrShift;
    const lseed = rng() * 50;
    const lenLo = L.len[0], lenHi = L.len[1];

    for (const ln of lines) {
      const thrLine = thrBase + (rng() - 0.5) * 0.07;
      let X = [], Y = [], W = [];
      let acc = 0, target = lenLo + (lenHi - lenLo) * rng() * rng(), lastX = 0, lastY = 0, run = 0;
      const flush = () => {
        if (X.length >= 2 && acc > 2.2) emit(ink, tile, X, Y, W, null, rng, noise, 0.32);
        X = []; Y = []; W = []; acc = 0; run = 0;
        target = lenLo + (lenHi - lenLo) * (0.25 + 0.75 * rng()) * (0.5 + 0.5 * rng());
      };
      const t1 = ln.t1;
      for (let t = ln.t0; t <= t1; t += step) {
        const Xc = ln.X0 + t * ln.dx, Yc = ln.Y0 + t * ln.dy;
        const fi = clamp(Xc / Sa, 0, 1) * nuM;
        let bb = s.cyc ? (Yc / Sb) % 1 : Yc / Sb;
        if (bb < 0) bb += 1;
        const fj = clamp(bb, 0, 1) * nvM;
        sample(s, fi, fj, S);
        let ok = S.F > 0.02;
        let w = 0;
        if (ok) ok = visibleAt(tile, S.x, S.y, S.d, S.F);
        if (ok) {
          const tn = toneAt(tile, S.x, S.y) * toneMul;
          const thr = thrLine + 0.10 * noise(S.x * 0.021 + lseed, S.y * 0.021, lseed);
          w = L.w * smooth(thr - 0.03, thr + 0.22, tn);
          if (w < 0.3) ok = false;
        }
        if (ok) {
          const dx = S.x - lastX, dy = S.y - lastY;
          if (X.length === 0 || dx * dx + dy * dy >= 2.4) {
            if (X.length) { const dd = Math.sqrt(dx * dx + dy * dy); acc += dd; }
            X.push(S.x); Y.push(S.y); W.push(w);
            lastX = S.x; lastY = S.y;
            if (acc >= target) { const ex = X[X.length - 1], ey = Y[Y.length - 1], ew = W[W.length - 1]; flush(); if (rng() < 0.5) { X.push(ex); Y.push(ey); W.push(ew); lastX = ex; lastY = ey; } }
          }
        } else if (X.length) {
          flush();
        }
      }
      flush();
    }
  }

  /* ---------------- silhouette (marching squares on n·v) ---------------- */
  function silhouettes(s) {
    const { nu, nv, F } = s;
    const pts = new Map(), adj = new Map();
    const P = (key, a, b, f0, f1) => {
      if (!pts.has(key)) {
        const t = f0 / (f0 - f1);
        pts.set(key, {
          x: lerp(s.Sx[a], s.Sx[b], t), y: lerp(s.Sy[a], s.Sy[b], t), d: lerp(s.Sd[a], s.Sd[b], t),
          lam: lerp(s.Lam[a], s.Lam[b], t), att: lerp(s.att[a], s.att[b], t), cm: s.cm ? lerp(s.cm[a], s.cm[b], t) : 1,
        });
      }
      return key;
    };
    const link = (a, b) => {
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
      adj.get(a).push(b); adj.get(b).push(a);
    };
    for (let i = 0; i < nu - 1; i++) for (let j = 0; j < nv - 1; j++) {
      const a = i * nv + j, b = (i + 1) * nv + j, c = i * nv + j + 1, d = (i + 1) * nv + j + 1;
      const f00 = F[a], f10 = F[b], f01 = F[c], f11 = F[d];
      const e = [];
      if ((f00 < 0) !== (f10 < 0)) e.push(P(i + ',' + j + ',u', a, b, f00, f10));
      if ((f01 < 0) !== (f11 < 0)) e.push(P(i + ',' + (j + 1) + ',u', c, d, f01, f11));
      if ((f00 < 0) !== (f01 < 0)) e.push(P(i + ',' + j + ',v', a, c, f00, f01));
      if ((f10 < 0) !== (f11 < 0)) e.push(P((i + 1) + ',' + j + ',v', b, d, f10, f11));
      if (e.length === 2) link(e[0], e[1]);
      else if (e.length === 4) { link(e[0], e[2]); link(e[1], e[3]); }
    }
    const seen = new Set(), chains = [];
    const walk = (start) => {
      const ch = [start]; seen.add(start);
      let prev = null, cur = start;
      for (;;) {
        const nb = adj.get(cur).filter((k) => k !== prev && !seen.has(k));
        if (!nb.length) break;
        prev = cur; cur = nb[0]; seen.add(cur); ch.push(cur);
      }
      return ch;
    };
    for (const [key, nb] of adj) if (nb.length === 1 && !seen.has(key)) chains.push(walk(key));
    for (const [key] of adj) if (!seen.has(key)) { const ch = walk(key); ch.push(ch[0]); chains.push(ch); }
    return chains.map((ch) => ch.map((k) => pts.get(k))).filter((c) => c.length > 3);
  }

  function smoothPoly(p, iters) {
    for (let it = 0; it < iters; it++) {
      const out = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i], b = p[i + 1];
        const mk = (t) => { const o = {}; for (const kk in a) o[kk] = a[kk] + (b[kk] - a[kk]) * t; return o; };
        out.push(mk(0.25), mk(0.75));
      }
      out.push(p[p.length - 1]);
      p = out;
    }
    return p;
  }

  /* draw a polyline of {x,y,d,...} with visibility runs and a width function */
  function drawPolyline(tile, poly, ink, rng, noise, o) {
    let X = [], Y = [], W = [];
    const flush = () => {
      if (X.length >= 2) {
        for (let pass = 0; pass < (o.passes || 1); pass++) {
          const sc = pass === 0 ? 1 : 0.55;
          emit(ink, tile, X, Y, W.map((w) => w * sc), null, rng, noise, o.wob == null ? 0.4 : o.wob);
        }
      }
      X = []; Y = []; W = [];
    };
    let lx = -1e9, ly = -1e9;
    for (let i = 0; i < poly.length; i++) {
      const q = poly[i];
      let ok = q.att == null || q.att > 0.15;
      if (ok && q.cm != null && q.cm < 0.08) ok = false;
      if (ok) ok = visibleAt(tile, q.x, q.y, q.d, q.F == null ? 0.5 : q.F, o.eps);
      if (ok && q.nvis != null && q.nvis < 0.06) ok = false;
      if (ok) {
        const dx = q.x - lx, dy = q.y - ly;
        if (dx * dx + dy * dy >= 1.5 || !X.length) {
          X.push(q.x); Y.push(q.y); W.push(o.width(q, i));
          lx = q.x; ly = q.y;
        }
      } else flush();
    }
    flush();
  }

  /* ---------------- boundary edge of an open patch ---------------- */
  function boundary(s, which) {
    const out = [];
    const { nu, nv } = s;
    const push = (i, j) => {
      const a = i * nv + j;
      out.push({ x: s.Sx[a], y: s.Sy[a], d: s.Sd[a], F: 0.5, lam: s.Lam[a], att: s.att[a] });
    };
    if (which === 'u0') for (let j = 0; j < nv; j++) push(0, j);
    if (which === 'u1') for (let j = 0; j < nv; j++) push(nu - 1, j);
    if (which === 'v0') for (let i = 0; i < nu; i++) push(i, 0);
    if (which === 'v1') for (let i = 0; i < nu; i++) push(i, nv - 1);
    return out;
  }

  /* ---------------- the study ---------------- */
  HS.LAYERS = {
    tube: [
      { a: 90, sp: 3.7, thr: 0.13, w: 1.5, len: [16, 60], jit: 5 },
      { a: 38, sp: 3.9, thr: 0.31, w: 1.4, len: [10, 36], jit: 6 },
      { a: -42, sp: 3.9, thr: 0.5, w: 1.35, len: [10, 32], jit: 6 },
      { a: 6, sp: 3.4, thr: 0.66, w: 1.3, len: [8, 28], jit: 8 },
      { a: 78, sp: 2.7, thr: 0.8, w: 1.2, len: [6, 22], jit: 8 },
    ],
    palm: [
      { a: 76, sp: 3.8, thr: 0.13, w: 1.5, len: [16, 60], jit: 5 },
      { a: 30, sp: 3.9, thr: 0.31, w: 1.4, len: [10, 36], jit: 6 },
      { a: -48, sp: 3.9, thr: 0.5, w: 1.35, len: [10, 32], jit: 6 },
      { a: 4, sp: 3.4, thr: 0.66, w: 1.3, len: [8, 28], jit: 8 },
      { a: 86, sp: 2.7, thr: 0.8, w: 1.2, len: [6, 22], jit: 8 },
    ],
    web: [
      { a: 4, sp: 3.4, thr: 0.13, w: 1.4, len: [10, 40], jit: 6 },
      { a: 70, sp: 3.8, thr: 0.42, w: 1.3, len: [8, 26], jit: 8 },
      { a: -35, sp: 3.6, thr: 0.62, w: 1.2, len: [8, 24], jit: 8 },
    ],
    nail: [
      { a: 0, sp: 2.9, thr: 0.05, w: 1.1, len: [10, 40], jit: 3 },
      { a: 90, sp: 3.8, thr: 0.45, w: 1.0, len: [8, 24], jit: 5 },
    ],
    cut: [{ a: 20, sp: 3.4, thr: -1, w: 0.9, len: [20, 60], jit: 3 }],
  };

  HS.drawStudy = function* (tile, hand, pose, ctx, seed) {
    const rng = HS.rng(seed), noise = HS.makeNoise(seed + 5);
    const ink = new Ink(ctx);
    const finish = pose.finish == null ? 1 : pose.finish;
    const opt = { thrShift: (1 - finish) * 0.16, spScale: pose.spScale || 1 };
    const surfs = tile.surfs;
    const nLayers = finish > 0.85 ? 5 : finish > 0.7 ? 4 : finish > 0.5 ? 3 : finish > 0.3 ? 2 : 1;

    // --- construction lines first (underdrawing) ---
    if (pose.construction) { drawConstruction(tile, hand, ink, rng, noise); ink.flush(); yield; }

    // --- hatching ---
    for (const s of surfs) {
      let set = HS.LAYERS[s.kind === 'tube' ? 'tube' : s.kind] || HS.LAYERS.tube;
      const isSheet = s.kind === 'web' || s.kind === 'nail' || s.kind === 'cut';
      const nl = isSheet ? Math.min(set.length, nLayers) : nLayers;
      s.toneMul = s.kind === 'nail' ? 0.75 : s.kind === 'cut' ? 0 : 1;
      for (let li = 0; li < nl; li++) {
        const L = Object.assign({}, set[li]);
        if (s.kind === 'cut') { s.toneMul = 1; }
        if (s.kind === 'cut') { L.thr = -1; }
        hatchLayer(tile, s, L, ink, rng, noise, opt);
      }
      ink.flush();
      yield;
    }

    // --- stipple ---
    if (finish > 0.25) { stipple(tile, ink, rng, finish); ink.flush(); yield; }

    // --- contours ---
    for (const s of surfs) {
      if (s.noSil || s.kind === 'web' || s.kind === 'cut') continue;
      const chains = silhouettes(s);
      for (let ch of chains) {
        ch = smoothPoly(ch, 2);
        drawPolyline(tile, ch, ink, rng, noise, {
          eps: 0.22, passes: 2, wob: 0.45,
          width: (q) => {
            const sh = 1 - q.lam;
            const lost = 0.3 + 0.7 * smooth(-0.55, 0.15, noise(q.x * 0.011, q.y * 0.011, 9.1));
            const litSide = 0.55 + 0.45 * sh;
            return (0.8 + 1.7 * Math.pow(sh, 1.3) + 0.3) * (0.7 + 0.3 * (pose.line || 1)) * clamp(q.att * 1.3, 0.15, 1) * (q.cm == null ? 1 : q.cm) * lost * litSide * 1.15;
          },
        });
      }
      ink.flush();
    }
    // boundaries of nails and web free edges
    for (const s of surfs) {
      if (!s.edges) continue;
      for (const e of s.edges) {
        const poly = smoothPoly(boundary(s, e), 2);
        const web = s.kind === 'web';
        drawPolyline(tile, poly, ink, rng, noise, {
          eps: web ? 0.25 : 0.12, passes: 2, wob: 0.3,
          width: (q) => (web ? 1.5 : 1.05) * (0.7 + 0.5 * (1 - q.lam)),
        });
      }
    }
    ink.flush();
    yield;

    // --- anatomical lines (creases, wrinkles, veins) ---
    for (const ln of hand.lines) drawAnatomyLine(tile, ln, ink, rng, noise, pose);
    ink.flush();
    yield;
  };

  function drawAnatomyLine(tile, ln, ink, rng, noise, pose) {
    const pts = ln.S.map((p, i) => { const o = { x: p[0], y: p[1], d: p[2], F: 0.6, att: 1 }; if (ln.NV) o.nvis = ln.NV[i]; return o; });
    if (pts.length < 2) return;
    const dense = smoothPoly(pts, 2);
    const base = ln.w * (pose.line || 1) * (ln.kind === 'crease' ? 1.55 : 1);
    const kind = ln.kind;
    const lenSeed = rng() * 10;
    const width = (q, i) => base * (0.65 + 0.45 * noise(i * 0.3 + lenSeed, lenSeed, 3)) * (kind === 'wrinkle' ? 0.85 : 1);
    const eps = kind === 'vein' ? 0.16 : 0.1;
    if (kind === 'vein') {
      // double-contoured vein: two thin lines either side, ends tapering
      for (const sgn of [-1, 1]) {
        const off = (ln.off || 0.12) * tile.k * 0.5;
        const p2 = dense.map((q, i) => {
          const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)];
          let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1;
          const e = Math.sin(PI * i / (dense.length - 1)) ** 0.5;
          return Object.assign({}, q, { x: q.x - (ty / l) * off * sgn * e, y: q.y + (tx / l) * off * sgn * e });
        });
        drawPolyline(tile, p2, ink, rng, noise, { eps, passes: 1, wob: 0.3, width: (q, i) => 0.7 * (0.6 + 0.6 * Math.sin(PI * i / (p2.length - 1))) });
      }
      return;
    }
    drawPolyline(tile, dense, ink, rng, noise, {
      eps, passes: 1, wob: 0.25,
      width: (q, i) => width(q, i) * (0.35 + 0.65 * Math.sin(PI * clamp(i / (dense.length - 1), 0.02, 0.98)) ** 0.6),
    });
  }

  /* ---------------- stippling ---------------- */
  function stipple(tile, ink, rng, finish) {
    const { w, h } = tile;
    const tries = Math.floor(w * h * 0.3 * finish);
    const ox = tile.x0, oy = tile.y0;
    for (let n = 0; n < tries; n++) {
      const x = floor(rng() * (w - 2)) + 1, y = floor(rng() * (h - 2)) + 1;
      const i = y * w + x;
      if (!tile.id[i]) continue;
      const t = tile.T[i];
      const p = 0.16 * smooth(0.04, 0.2, t) * (1 - smooth(0.34, 0.55, t));
      if (rng() > p) continue;
      const px = x + rng(), py = y + rng();
      const r = 0.55 + rng() * 0.45, a = rng() * PI;
      const dx = Math.cos(a) * r * 0.9, dy = Math.sin(a) * r * 0.9;
      ink.stroke([px + ox - dx, py + oy - dy, px + ox, py + oy, px + ox + dx, py + oy + dy], [0.4, r * 1.25, 0.4]);
    }
  }

  /* ---------------- underdrawing: joint circles and bone axes ---------------- */
  function drawConstruction(tile, hand, ink, rng, noise) {
    const cam = tile.cam;
    const pr = (p) => { const q = cam.project(cam.toCam(p[0], p[1], p[2])); return q; };
    const line = (a, b, w) => {
      const n = 10, X = [], Y = [], W = [];
      for (let i = 0; i <= n; i++) { const t = i / n; X.push(lerp(a[0], b[0], t) + (rng() - 0.5) * 0.5); Y.push(lerp(a[1], b[1], t) + (rng() - 0.5) * 0.5); W.push(w); }
      emit(ink, tile, X, Y, W, null, rng, noise, 0.5);
    };
    const circle = (c, r, w) => {
      for (let pass = 0; pass < 2; pass++) {
        const X = [], Y = [], W = [];
        const a0 = rng() * 6.28, sq = 0.9 + rng() * 0.2;
        for (let i = 0; i <= 26; i++) {
          const a = a0 + (i / 26) * (6.28 + 0.4);
          const rr = r * (1 + (rng() - 0.5) * 0.06);
          X.push(c[0] + Math.cos(a) * rr); Y.push(c[1] + Math.sin(a) * rr * sq); W.push(w);
        }
        emit(ink, tile, X, Y, W, null, rng, noise, 0.5);
      }
    };
    const chains = hand.fingers.map((f) => ({ j: f.joints, w: f.def.W })).concat([{ j: hand.thumb.joints, w: 2.3 }]);
    for (const c of chains) {
      const P = c.j.map(pr);
      for (let i = 0; i < P.length - 1; i++) {
        const dx = P[i + 1][0] - P[i][0], dy = P[i + 1][1] - P[i][1], l = Math.hypot(dx, dy) || 1;
        const ext = 0.15 * l;
        line([P[i][0] - dx / l * ext, P[i][1] - dy / l * ext], [P[i + 1][0] + dx / l * ext, P[i + 1][1] + dy / l * ext], 0.55);
      }
      P.forEach((p, i) => circle(p, c.w * 0.5 * tile.k * (i === 0 ? 0.55 : 0.42), 0.55));
    }
  }
})();
