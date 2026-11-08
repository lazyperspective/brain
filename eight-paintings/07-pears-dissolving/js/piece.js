// 07 — Pears, dissolving. A Chardin-like still life painted stroke by stroke from a ray-marched
// observation; left to right the painter's attention moves from seeing to painting:
// modelled form -> constructive planes -> knife-laid colour fields -> gesture.
(function (G) {
  'use strict';
  const P = G.Paint;
  const { clamp, smooth, mix, fbm, vnoise } = P;
  const PI = Math.PI;

  function lumOf(c, i) { return 0.3 * c[i] + 0.59 * c[i + 1] + 0.11 * c[i + 2]; }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function satv(c, s, v, pivot) {
    const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const o = [];
    for (let k = 0; k < 3; k++) { let x = l + (c[k] - l) * s; x = pivot + (x - pivot) * v; o.push(clamp(x, 0.004, 0.99)); }
    return o;
  }

  function render(W, H, scale, view, q) {
    const S = scale;
    const seed = 7071;
    const rnd = P.mulberry32(seed);
    const t0 = performance.now();
    const log = (m) => console.log(`[${((performance.now() - t0) / 1000).toFixed(1)}s] ${m}`);

    // ---------------------------------------------------------- observation
    const refO = G.Scene07.renderReference(W, H);
    const N = W * H;
    const R0 = new Float32Array(N * 3), ID = new Uint8Array(N), ANG = new Float32Array(N), FLAG = new Uint8Array(N), DIR = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      R0[i * 3] = refO.col[i * 4]; R0[i * 3 + 1] = refO.col[i * 4 + 1]; R0[i * 3 + 2] = refO.col[i * 4 + 2];
      ID[i] = Math.round(refO.aux[i * 4] * 16);
      ANG[i] = refO.aux[i * 4 + 1] * PI;
      FLAG[i] = refO.aux[i * 4 + 2] > 0.5 ? 1 : 0;
      DIR[i] = refO.aux[i * 4 + 3];
    }
    log('reference');
    if (view === 'ref' || view === 'aux') {
      const out = new Uint8ClampedArray(N * 4);
      for (let i = 0; i < N; i++) {
        if (view === 'aux') { out[i * 4] = ID[i] * 20; out[i * 4 + 1] = ANG[i] / PI * 255; out[i * 4 + 2] = DIR[i] * 255; }
        else for (let k = 0; k < 3; k++) out[i * 4 + k] = R0[i * 3 + k] * 255;
        out[i * 4 + 3] = 255;
      }
      return out;
    }
    const R1 = P.boxBlur3(R0, W, H, Math.max(1, Math.round(1.5 * S)), 3);
    const R2 = P.boxBlur3(R0, W, H, Math.max(1, Math.round(5 * S)), 3);
    const R3 = P.boxBlur3(R0, W, H, Math.max(1, Math.round(13 * S)), 3);
    const R4 = P.boxBlur3(R0, W, H, Math.max(1, Math.round(32 * S)), 3);
    const L2 = new Float32Array(N);
    for (let i = 0; i < N; i++) L2[i] = lumOf(R2, i * 3);
    const OR = P.orientationField(L2, W, H, Math.max(2, Math.round(9 * S)));
    log('blurs');

    // ---------------------------------------------------------- abstraction field
    const A = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const xn = x / W, yn = y / H;
      const id = ID[y * W + x];
      const bias = id === 3 ? 0.07 : id === 6 ? -0.03 : (id === 9 || id === 10) ? -0.06 : id === 4 ? -0.1 : 0;
      let t = (xn - 0.37 + 0.10 * (yn - 0.55) + 0.14 * (fbm(xn * 2.6, yn * 2.6, 31, 3) - 0.5) + bias) / 0.52;
      A[y * W + x] = clamp(t, 0, 1);
    }
    { const pk = new Float32Array(N * 3); for (let i = 0; i < N; i++) pk[i * 3] = A[i];
      const sm = P.boxBlur3(pk, W, H, Math.max(1, Math.round(10 * S)), 3); for (let i = 0; i < N; i++) A[i] = sm[i * 3]; }
    const aAt = (x, y) => A[(clamp(y | 0, 0, H - 1)) * W + clamp(x | 0, 0, W - 1)];
    if (view === 'amap') {
      const out = new Uint8ClampedArray(N * 4);
      for (let i = 0; i < N; i++) { const v = A[i] * 255; out[i * 4] = R0[i * 3] * 255 * 0.5 + v * 0.5; out[i * 4 + 1] = v; out[i * 4 + 2] = v; out[i * 4 + 3] = 255; }
      return out;
    }

    const cv = new P.PaintCanvas(W, H, seed, { scale: S, weavePeriod: 5.0 });
    const tmp = [0, 0, 0], tmp2 = [0, 0, 0];
    const idx = (x, y) => (clamp(y | 0, 0, H - 1)) * W + clamp(x | 0, 0, W - 1);
    const samp = (buf, x, y, out) => P.sampleBuf(buf, W, H, x, y, 3, out || [0, 0, 0]);
    const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    const clothEdgeY = 0.705 * H;
    // direction field: object-driven, isophotes on linen, scumbled crossing on the wall
    function dirAt(x, y) {
      const i = idx(x, y);
      if (FLAG[i]) {
        const id = ID[i];
        if (id === 4) {
          const yy = i / W;
          if (yy > clothEdgeY) return PI / 2 + 0.25 * (fbm(x / (200 * S), y / (200 * S), 9, 2) - 0.5);
          return OR.coh[i] > 0.6 ? OR.ang[i] : 0.22 + 0.5 * (fbm(x / (300 * S), y / (300 * S), 8, 2) - 0.5);
        }
        return 0.75 + 1.1 * (fbm(x / (420 * S), y / (420 * S), 5, 3) - 0.5);
      }
      return ANG[i];
    }
    function colDiff(a, b) { return Math.abs(a[0] - b[0]) * 0.35 + Math.abs(a[1] - b[1]) * 0.45 + Math.abs(a[2] - b[2]) * 0.2; }
    function jitterCol(c, amt) {
      const v = (rnd() - 0.5) * amt, w = (rnd() - 0.5) * amt * 0.6;
      return [clamp(c[0] + v + w, 0, 1), clamp(c[1] + v, 0, 1), clamp(c[2] + v - w, 0, 1)];
    }

    // generic layer: jittered grid of candidate strokes
    function layer(o) {
      const sp = o.spacing * S;
      const cand = [];
      for (let gy = -sp * 0.5; gy < H + sp * 0.5; gy += sp) for (let gx = -sp * 0.5; gx < W + sp * 0.5; gx += sp) {
        cand.push([gx + rnd() * sp, gy + rnd() * sp]);
      }
      shuffle(cand, rnd);
      let n = 0;
      for (const [x, y] of cand) {
        if (!inB(x, y)) continue;
        const a = aAt(x, y);
        if (o.prob && rnd() > o.prob(a, x, y)) continue;
        const target = samp(o.src, x, y, [0, 0, 0]);
        if (o.err != null) {
          cv.sample(x, y, tmp);
          if (colDiff(tmp, target) < o.err) continue;
        }
        const w = o.w * S * (0.8 + 0.4 * rnd());
        let c = o.colFn ? o.colFn(target, x, y, a) : target;
        c = jitterCol(c, o.jit == null ? 0.03 : o.jit);
        const id0 = ID[idx(x, y)];
        const lit0 = DIR[idx(x, y)] > 0.12;
        const dOff = o.wander ? (rnd() - 0.5) * o.wander : 0;
        const dfn0 = o.dir || dirAt;
        const dfn = dOff ? (px, py) => dfn0(px, py) + dOff : dfn0;
        const maxLen = o.len * w * (0.6 + 0.8 * rnd());
        const pts = P.traceSpine(x, y, dfn, maxLen, Math.max(1, w * 0.3), rnd, {
          inertia: o.inertia == null ? 0.6 : o.inertia,
          stop: (px, py, len) => {
            if (!inB(px, py)) return true;
            if (len < w * 0.6) return false;
            if (o.keepId && (lit0 || DIR[idx(px, py)] > 0.12) && ID[idx(px, py)] !== id0) return true;
            if (o.stopDiff != null) { samp(o.src, px, py, tmp2); if (colDiff(tmp2, c) > o.stopDiff) return true; }
            if (o.prob && aAt(px, py) > a + 0.25) return true;
            return false;
          }
        });
        if (pts.length < 4) pts.push(x + 1, y);
        const st = Object.assign({ pts, w, col: c, seed: (rnd() * 1e9) | 0 }, o.brush);
        if (o.brushFn) Object.assign(st, o.brushFn(x, y, a, c));
        cv.stroke(st);
        n++;
      }
      log(`${o.name}: ${n}`);
    }

    // ---------------------------------------------------------- 0 ground
    cv.fill(0.30, 0.185, 0.115);
    cv.snapshotGround();

    // ---------------------------------------------------------- 1 rub-in (brown monochrome)
    const brownMono = (t) => { const l = lumOf(t, 0); return [clamp(l * 1.25 + 0.02, 0, 1), clamp(l * 0.98, 0, 1), clamp(l * 0.70, 0, 1)]; };
    layer({
      name: 'rub-in', src: R4, spacing: 64, w: 120, len: 3.5, jit: 0.04,
      dir: (x, y) => 0.6 + 1.6 * (vnoise(x / (300 * S), y / (300 * S), 3) - 0.5),
      colFn: (t) => brownMono(t),
      brush: { alpha: 0.75, dry: 0.75, thick: 0.04, bristle: 0.75, load: 0.9, run: 260 * S, smear: 0.3, pick: 0.3, taper0: 0.2, taper1: 0.3 }
    });
    // ---------------------------------------------------------- 2 dead colouring
    layer({
      name: 'dead colour', src: R3, spacing: 30, w: 46, len: 5, stopDiff: 0.16, jit: 0.04,
      colFn: (t) => { const b = brownMono(t); return [mix(t[0], b[0], 0.45), mix(t[1], b[1], 0.45), mix(t[2], b[2], 0.45)]; },
      brush: { alpha: 0.85, dry: 0.45, thick: 0.12, bristle: 0.6, load: 1.0, run: 220 * S, smear: 0.25, pick: 0.25 }
    });
    // ---------------------------------------------------------- 3 block-in in full colour
    layer({
      name: 'block-in', src: R2, spacing: 15, w: 26, len: 6, stopDiff: 0.09, jit: 0.035, err: 0.02,
      brush: { alpha: 0.93, dry: 0.3, thick: 0.28, bristle: 0.55, load: 1.0, run: 200 * S, smear: 0.22, pick: 0.2 }
    });

    // ---------------------------------------------------------- 4 constructive planes
    // facet map: voronoi cells split by object id; colour = cell mean (flat planes)
    const fsp = 62 * S;
    const fcols = Math.ceil(W / fsp) + 1, frows = Math.ceil(H / fsp) + 1;
    const seeds = new Float32Array(fcols * frows * 2);
    const srnd = P.mulberry32(seed + 5);
    for (let j = 0; j < frows; j++) for (let i = 0; i < fcols; i++) {
      seeds[(j * fcols + i) * 2] = (i + 0.15 + 0.7 * srnd()) * fsp;
      seeds[(j * fcols + i) * 2 + 1] = (j + 0.15 + 0.7 * srnd()) * fsp;
    }
    const cellOf = new Int32Array(N);
    const acc = new Map();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ci = Math.floor(x / fsp), cj = Math.floor(y / fsp);
      let best = 1e18, bi = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const ii = ci + di, jj = cj + dj;
        if (ii < 0 || jj < 0 || ii >= fcols || jj >= frows) continue;
        const k = jj * fcols + ii;
        // anisotropic metric -> slanted, chiselled planes
        const dx = x - seeds[k * 2], dy = y - seeds[k * 2 + 1];
        const u = dx * 0.86 + dy * 0.5, v = -dx * 0.5 + dy * 0.86;
        const d = u * u * 0.55 + v * v;
        if (d < best) { best = d; bi = k; }
      }
      const i = y * W + x;
      const key = bi * 16 + ID[i];
      cellOf[i] = key;
      let e = acc.get(key);
      if (!e) { e = [0, 0, 0, 0]; acc.set(key, e); }
      e[0] += R2[i * 3]; e[1] += R2[i * 3 + 1]; e[2] += R2[i * 3 + 2]; e[3]++;
    }
    for (const e of acc.values()) { e[0] /= e[3]; e[1] /= e[3]; e[2] /= e[3]; }
    const facetCol = (x, y) => { const e = acc.get(cellOf[idx(x, y)]); return [e[0], e[1], e[2]]; };
    log('facets');

    // Cezanne-like constructive patches: groups of parallel flat strokes in a facet colour
    {
      const sp = 34 * S;
      const cand = [];
      for (let gy = 0; gy < H; gy += sp) for (let gx = W * 0.3; gx < W; gx += sp) cand.push([gx + rnd() * sp, gy + rnd() * sp]);
      shuffle(cand, rnd);
      let n = 0;
      for (const [x, y] of cand) {
        if (!inB(x, y)) continue;
        const a = aAt(x, y);
        const pr = smooth(0.12, 0.38, a) * (1 - smooth(0.70, 0.92, a));
        if (rnd() > pr) continue;
        const fc = facetCol(x, y);
        const t = samp(R3, x, y);
        const k = smooth(0.15, 0.45, a);
        let c = [mix(t[0], fc[0], k), mix(t[1], fc[1], k), mix(t[2], fc[2], k)];
        const pid = ID[idx(x, y)];
        const shift = pid === 3 ? [[0.17, 0.18, 0.19], [0.12, 0.08, 0.05], [0.22, 0.19, 0.12], [0.07, 0.06, 0.05], [0.2, 0.2, 0.13]]
          : (pid >= 6 && pid <= 8) ? [[0.78, 0.6, 0.18], [0.5, 0.52, 0.16], [0.62, 0.25, 0.1], [0.85, 0.72, 0.4]]
          : pid === 1 ? [[0.45, 0.33, 0.2], [0.3, 0.2, 0.12], [0.5, 0.42, 0.3]] : null;
        if (shift) {
          const sc = shift[(rnd() * shift.length) | 0];
          const lc = lumOf(c, 0), ls = lumOf(sc, 0);
          const scl = [sc[0] * lc / ls, sc[1] * lc / ls, sc[2] * lc / ls]; // keep the value, change the hue
          const f = 0.45 * k;
          c = [mix(c[0], scl[0], f), mix(c[1], scl[1], f), mix(c[2], scl[2], f)].map((v) => clamp(v, 0, 1));
        }
        c = satv(c, 1.0 + 0.2 * k, 1.0 + 0.08 * k, 0.32);
        const base = -0.62 + 0.35 * (rnd() - 0.5) + (rnd() < 0.18 ? PI / 2 : 0);
        const ux = Math.cos(base), uy = Math.sin(base);
        const nx = -uy, ny = ux;
        const m = 3 + ((rnd() * 3) | 0);
        const w = (17 + 9 * rnd()) * S, len = (40 + 30 * rnd()) * S;
        for (let s = 0; s < m; s++) {
          const off = (s - (m - 1) / 2) * w * 0.82;
          const cx = x + nx * off + (rnd() - 0.5) * 4 * S, cy = y + ny * off + (rnd() - 0.5) * 4 * S;
          const l2 = len * (0.75 + 0.5 * rnd());
          const cc = jitterCol(c, 0.05);
          cv.stroke({
            pts: [cx - ux * l2 / 2, cy - uy * l2 / 2, cx, cy, cx + ux * l2 / 2, cy + uy * l2 / 2],
            w, col: cc, alpha: 0.96, dry: 0.25, thick: 0.45, bristle: 0.35, load: 1.1, run: 400 * S,
            taper0: 0.08, taper1: 0.15, smear: 0.12, pick: 0.12, rag: 0.08, ridge: 0.7, seed: (rnd() * 1e9) | 0
          });
        }
        n++;
      }
      log('planes: ' + n);
    }

    // ---------------------------------------------------------- 5 modelling (realist zone)
    const realP = (lo, hi) => (a) => 1 - smooth(lo, hi, a);
    layer({
      name: 'modelling', src: R1, spacing: 10, w: 19, len: 4.5, stopDiff: 0.07, jit: 0.045, wander: 1.2, err: 0.03, keepId: true,
      prob: realP(0.22, 0.5),
      brush: { alpha: 0.9, dry: 0.25, thick: 0.3, bristle: 0.45, load: 1.0, run: 120 * S, smear: 0.3, pick: 0.35, cjit: 0.4 }
    });
    // ---------------------------------------------------------- 6 detail
    layer({
      name: 'detail', src: R1, spacing: 5, w: 9, len: 4, stopDiff: 0.06, jit: 0.03, wander: 0.9, err: 0.04, keepId: true,
      prob: realP(0.10, 0.34),
      brush: { alpha: 0.9, dry: 0.2, thick: 0.28, bristle: 0.4, load: 1.0, run: 80 * S, smear: 0.25, pick: 0.35, cjit: 0.35 }
    });
    layer({
      name: 'fine', src: R0, spacing: 3, w: 4, len: 5, stopDiff: 0.06, jit: 0.012, err: 0.08, keepId: true,
      prob: realP(0.05, 0.2),
      brush: { alpha: 0.95, dry: 0.12, thick: 0.25, bristle: 0.35, load: 1.0, run: 60 * S, smear: 0.15, pick: 0.15 }
    });

    // ---------------------------------------------------------- 6b the glass: crisp verticals, rim and glints
    layer({
      name: 'glass', src: R0, spacing: 3, w: 4.5, len: 9, stopDiff: 0.05, jit: 0.008, err: 0.022, keepId: true,
      prob: (a, x, y) => { const i = idx(x, y); return ID[i] === 5 || ID[idx(x - 6 * S, y)] === 5 || ID[idx(x + 6 * S, y)] === 5 ? 1 : 0; },
      dir: (x, y) => { const i = idx(x, y); const l = L2[i]; return OR.coh[i] > 0.4 ? OR.ang[i] : PI / 2; },
      brush: { alpha: 0.95, dry: 0.08, thick: 0.25, bristle: 0.3, load: 1.0, run: 90 * S, smear: 0.1, pick: 0.15, cjit: 0.2 }
    });
    {
      let n = 0;
      for (let k = 0; k < 2600; k++) {
        const x = rnd() * W, y = rnd() * H;
        const i = idx(x, y);
        if (ID[i] !== 5) continue;
        const t = samp(R0, x, y); const l = lumOf(t, 0);
        if (l < 0.5) continue;
        const c = [clamp(t[0] * 1.08 + 0.05, 0, 1), clamp(t[1] * 1.08 + 0.05, 0, 1), clamp(t[2] * 1.06 + 0.05, 0, 1)];
        const w = (2.5 + 3 * rnd()) * S;
        const pts = P.traceSpine(x, y, () => PI / 2, (20 + 50 * rnd()) * S, 2 * S, rnd, { inertia: 0.9, stop: (px, py) => !inB(px, py) || lumOf(samp(R0, px, py, tmp2), 0) < l - 0.15 });
        if (pts.length < 4) continue;
        cv.stroke({ pts, w, col: c, alpha: 0.95, dry: 0.05, thick: 0.9, bristle: 0.3, load: 1.2, run: 60 * S, smear: 0.05, pick: 0.05, taper0: 0.3, taper1: 0.6, seed: (rnd() * 1e9) | 0 });
        n++;
      }
      log('glints ' + n);
    }

    // ---------------------------------------------------------- 7 impasto lights
    {
      const sp = 7 * S; let n = 0;
      const cand = [];
      for (let gy = 0; gy < H; gy += sp) for (let gx = 0; gx < W; gx += sp) cand.push([gx + rnd() * sp, gy + rnd() * sp]);
      shuffle(cand, rnd);
      for (const [x, y] of cand) {
        const a = aAt(x, y);
        if (rnd() > 1 - smooth(0.2, 0.45, a)) continue;
        const t = samp(R1, x, y);
        const l = lumOf(t, 0);
        const lb = lumOf(samp(R3, x, y, tmp2), 0);
        const i0 = idx(x, y), e6 = 7 * S;
        if (DIR[i0] < 0.45 && ID[i0] !== 5) continue;
        if (ID[idx(x - e6, y)] !== ID[i0] || ID[idx(x + e6, y)] !== ID[i0] || ID[idx(x, y - e6)] !== ID[i0] || ID[idx(x, y + e6)] !== ID[i0]) continue;
        if (l < 0.6 || (l - lb < 0.04 && l < 0.86) || rnd() > smooth(0.6, 0.85, l) * 0.6) continue;
        const c = [clamp(t[0] * 1.04 + 0.02, 0, 1), clamp(t[1] * 1.04 + 0.02, 0, 1), clamp(t[2] * 1.02 + 0.015, 0, 1)];
        const w = (6 + 6 * rnd()) * S;
        const pts = P.traceSpine(x, y, dirAt, w * (2 + 3 * rnd()), Math.max(1, w * 0.3), rnd, {
          stop: (px, py) => !inB(px, py) || lumOf(samp(R1, px, py, tmp2), 0) < l - 0.12
        });
        if (pts.length < 4) continue;
        cv.stroke({ pts, w, col: c, alpha: 0.92, dry: 0.1, thick: 0.9, bristle: 0.6, load: 1.2, run: 80 * S, smear: 0.15, pick: 0.2, ridge: 0.8, seed: (rnd() * 1e9) | 0 });
        n++;
      }
      log('impasto: ' + n);
    }

    // ---------------------------------------------------------- 7b granular scumbles in the light (Chardin's crumbly lights)
    layer({
      name: 'scumble', src: R2, spacing: 14, w: 24, len: 3, jit: 0.03, wander: 2.0,
      prob: (a, x, y) => (1 - smooth(0.15, 0.4, a)) * smooth(0.15, 0.5, DIR[idx(x, y)]) * 0.8,
      colFn: (t) => [clamp(t[0] * 1.05 + 0.025, 0, 1), clamp(t[1] * 1.05 + 0.022, 0, 1), clamp(t[2] * 1.04 + 0.015, 0, 1)],
      brush: { alpha: 0.75, dry: 0.95, load: 0.55, run: 60 * S, thick: 0.15, bristle: 0.7, smear: 0.1, pick: 0.1, flatten: 0.2 }
    });

    // ---------------------------------------------------------- 8 glazes in the shadows (seeing zone)
    cv.glazeField([0.70, 0.58, 0.44], (x, y) => {
      const i = y * W + x;
      return smooth(0.30, 0.08, L2[i]) * (1 - smooth(0.35, 0.65, A[i]));
    }, 0.42, seed + 40);
    log('glaze');

    // ---------------------------------------------------------- 9 abstraction
    // camera projection (mirrors scene.js) to find the table edge
    const proj = (() => {
      const RO = [-0.12, 1.45, 6.4], TA = [-0.10, 0.66, 0.0], FOVT = 0.336;
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
      const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const f = nrm(sub(TA, RO)), r = nrm(cross(f, [0, 1, 0])), u = cross(r, f);
      return (p) => { const v = sub(p, RO); const z = dot(v, f); return [W / 2 + dot(v, r) / (z * FOVT) * H / 2, H / 2 - dot(v, u) / (z * FOVT) * H / 2]; };
    })();
    const edgeY = (xp) => { // table front edge y at image x
      const a = proj([-4, 0, 1.0]), b = proj([4, 0, 1.0]);
      return a[1] + (b[1] - a[1]) * (xp - a[0]) / (b[0] - a[0]);
    };

    // palette sampled from the observation itself
    const meanWhere = (fn) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < N; i += 2) if (fn(i)) { r += R3[i * 3]; g += R3[i * 3 + 1]; b += R3[i * 3 + 2]; n++; }
      return n ? [r / n, g / n, b / n] : null;
    };
    const isPear = (i) => ID[i] >= 6 && ID[i] <= 8;
    const yOf = (i) => (i / W) | 0, xOf = (i) => i % W;
    const palNamed = {
      pearLit: meanWhere((i) => isPear(i) && DIR[i] > 0.7),
      pearMid: meanWhere((i) => isPear(i) && DIR[i] > 0.3 && DIR[i] < 0.6),
      pearShadow: meanWhere((i) => isPear(i) && DIR[i] < 0.08),
      wallDark: meanWhere((i) => ID[i] === 3 && L2[i] < 0.14),
      wallLight: meanWhere((i) => ID[i] === 3 && L2[i] > 0.21),
      tableLit: meanWhere((i) => ID[i] === 1 && DIR[i] > 0.4 && yOf(i) < edgeY(xOf(i))),
      tableShadow: meanWhere((i) => ID[i] === 1 && DIR[i] < 0.08 && yOf(i) < edgeY(xOf(i))),
      front: meanWhere((i) => ID[i] === 1 && yOf(i) > edgeY(xOf(i)) + 10 * S),
      linen: meanWhere((i) => ID[i] === 4 && DIR[i] > 0.4),
      linenShadow: meanWhere((i) => ID[i] === 4 && DIR[i] < 0.25),
      leaf: meanWhere((i) => ID[i] === 11 && DIR[i] > 0.3),
      handle: meanWhere((i) => ID[i] === 10),
      glass: meanWhere((i) => ID[i] === 5),
    };
    for (const k in palNamed) if (!palNamed[k]) palNamed[k] = [0.2, 0.15, 0.1];
    const pn = palNamed;
    pn.black = [0.045, 0.034, 0.026];
    pn.umber = [0.16, 0.095, 0.05];
    pn.slate = satv(pn.glass, 0.6, 1.0, 0.3).map((v, k) => clamp(v * [0.92, 1.0, 1.1][k], 0, 1));
    pn.cream = [0.90, 0.86, 0.74];
    pn.slateDark = satv(pn.slate, 0.8, 1.0, 0.3).map((v) => v * 0.55);
    pn.olive = [0.17, 0.16, 0.09];
    pn.ochre = satv(pn.pearLit, 1.15, 1.0, 0.4);
    pn.green = satv(mix3(pn.pearMid, [0.42, 0.45, 0.14], 0.5), 1.1, 1.0, 0.3);
    pn.red = satv(mix3(pn.leaf, [0.55, 0.16, 0.06], 0.5), 1.2, 1.0, 0.3);
    function mix3(a, b, t) { return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)]; }
    const palette = Object.keys(pn).map((k) => ({ k, c: pn[k] }));
    log('palette ' + palette.map((p) => p.k + ':' + p.c.map((v) => v.toFixed(2)).join(',')).join(' | '));

    const lum3 = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    function nearestPal(m, exclude) {
      const lm = lum3(m);
      const arr = palette.filter((p) => !exclude || !exclude.includes(p.k)).map((p) => {
        const lp = lum3(p.c);
        const cd = Math.abs((p.c[0] - lp) - (m[0] - lm)) + Math.abs((p.c[2] - lp) - (m[2] - lm));
        return { p, d: Math.abs(lp - lm) * 2.2 + cd };
      });
      arr.sort((a, b) => a.d - b.d);
      return arr;
    }
    function rectMean(r) {
      let acc0 = [0, 0, 0], n = 0, v = 0;
      const sx = (r.x1 - r.x0) / 6, sy = (r.y1 - r.y0) / 6;
      const ls = [];
      for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) {
        const c = samp(R3, r.x0 + (i + 0.5) * sx, r.y0 + (j + 0.5) * sy);
        acc0[0] += c[0]; acc0[1] += c[1]; acc0[2] += c[2]; n++; ls.push(lum3(c));
      }
      const m = [acc0[0] / n, acc0[1] / n, acc0[2] / n];
      const lm = lum3(m);
      for (const l of ls) v += (l - lm) * (l - lm);
      return { m, v: v / n };
    }

    // ---- k-d split into colour fields, guided by the image (cuts snap to strong edges)
    const rects = [];
    const krnd = P.mulberry32(seed + 77);
    function splitRect(r, depth) {
      const w = r.x1 - r.x0, h = r.y1 - r.y0;
      const ac = aAt((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
      const minS = mix(36, 120, smooth(0.3, 1.0, ac)) * S;
      const st = rectMean(r);
      const canH = h > minS * 2, canV = w > minS * 2;
      const big = w * h > Math.pow(mix(200, 520, ac) * S, 2);
      const force = ac < 0.8 && (canH || canV);
      if ((!canH && !canV) || (depth > 2 && st.v < 0.002 && !big && !force)) { rects.push(Object.assign(r, { mean: st.m })); return; }
      let horiz = canH && (!canV || h * 1.25 > w || krnd() < 0.25);
      // choose cut maximising colour contrast across it
      let best = -1, bp = 0;
      for (let k = 0; k < 9; k++) {
        const t = 0.25 + 0.5 * (k / 8) + (krnd() - 0.5) * 0.05;
        let a1, b1;
        if (horiz) { const c = r.y0 + h * t; a1 = rectMean({ x0: r.x0, x1: r.x1, y0: Math.max(r.y0, c - minS), y1: c }).m; b1 = rectMean({ x0: r.x0, x1: r.x1, y0: c, y1: Math.min(r.y1, c + minS) }).m; }
        else { const c = r.x0 + w * t; a1 = rectMean({ y0: r.y0, y1: r.y1, x0: Math.max(r.x0, c - minS), x1: c }).m; b1 = rectMean({ y0: r.y0, y1: r.y1, x0: c, x1: Math.min(r.x1, c + minS) }).m; }
        const d = colDiff(a1, b1) + krnd() * 0.01;
        if (d > best) { best = d; bp = t; }
      }
      if (horiz) { const c = r.y0 + h * bp; splitRect({ x0: r.x0, x1: r.x1, y0: r.y0, y1: c }, depth + 1); splitRect({ x0: r.x0, x1: r.x1, y0: c, y1: r.y1 }, depth + 1); }
      else { const c = r.x0 + w * bp; splitRect({ x0: r.x0, x1: c, y0: r.y0, y1: r.y1 }, depth + 1); splitRect({ x0: c, x1: r.x1, y0: r.y0, y1: r.y1 }, depth + 1); }
    }
    splitRect({ x0: W * 0.34, x1: W + 6 * S, y0: -6 * S, y1: H + 6 * S }, 0);
    log('rects ' + rects.length);

    // ---- lay each field with the palette knife
    function rectClass(r) {
      const cnt = {};
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        const x = r.x0 + (i + 0.5) * (r.x1 - r.x0) / 5, y = r.y0 + (j + 0.5) * (r.y1 - r.y0) / 5;
        if (!inB(x, y)) continue;
        let id = ID[idx(x, y)];
        let k = id === 3 ? 'wall' : (id >= 6 && id <= 8) ? 'pear' : id === 11 ? 'leaf' : id === 1 ? (y > edgeY(x) ? 'front' : 'table') : id === 9 || id === 10 ? 'front' : 'table';
        cnt[k] = (cnt[k] || 0) + 1;
      }
      let best = 'wall', bn = -1; for (const k in cnt) if (cnt[k] > bn) { bn = cnt[k]; best = k; }
      return best;
    }
    const classPal = {
      wall: { black: 3, umber: 2.2, wallDark: 3, wallLight: 1.2, slateDark: 1.4, olive: 0.9 },
      pear: { ochre: 3, pearLit: 2, pearMid: 2, green: 1.6, red: 0.9, cream: 0.7, pearShadow: 1.2 },
      table: { tableLit: 3, ochre: 1, umber: 1, tableShadow: 2, cream: 0.4, slate: 0.4 },
      front: { front: 3, black: 2, umber: 2, red: 0.5, tableShadow: 1 },
      leaf: { red: 3, ochre: 1.2, pearShadow: 0.6 },
    };
    function pickPal(cls, m, rr) {
      const lm = lum3(m), tab = classPal[cls];
      let tot = 0; const arr = [];
      for (const k in tab) { const c = pn[k]; const wgt = tab[k] * Math.exp(-Math.abs(lum3(c) - lm) / 0.11); arr.push([k, wgt]); tot += wgt; }
      let u = rr() * tot;
      for (const [k, wgt] of arr) { u -= wgt; if (u <= 0) return k; }
      return arr[0][0];
    }
    function knifeSlab(x0, y0, x1, y1, c, c2, rr, o) {
      o = o || {};
      const w = x1 - x0, h = y1 - y0;
      const vert = o.vert != null ? o.vert : (h > w * 1.5 && rr() < 0.75);
      const span = vert ? w : h, len = vert ? h : w;
      const n = span < 170 * S ? 1 : Math.min(3, Math.round(span / (130 * S)));
      const kw = span / n * (1.08 + 0.15 * rr());
      const dirSign = rr() < 0.5 ? 1 : -1;
      const tilt = (rr() - 0.5) * 0.06 * (o.tilt == null ? 1 : o.tilt);
      for (let k = 0; k < n; k++) {
        const off = (k + 0.5) / n * span + (rr() - 0.5) * 0.12 * kw;
        const e0 = len * (rr() * 0.16 - 0.03), e1 = len * (rr() * 0.16 - 0.03);
        const pts = [];
        const steps = Math.max(2, Math.ceil(len / (16 * S)));
        for (let i = 0; i <= steps; i++) {
          let t = i / steps; if (dirSign < 0) t = 1 - t;
          const along = -e0 + t * (len + e0 + e1);
          const across = off + tilt * (along - len / 2) + Math.sin(t * 2.3 + k * 1.7) * 0.025 * kw;
          if (vert) pts.push(x0 + across, y0 + along); else pts.push(x0 + along, y0 + across);
        }
        cv.stroke(Object.assign({
          pts, w: kw, col: jitterCol(c, 0.02), col2: c2, cjit: 0.32, knife: true, square: true,
          alpha: 0.97, load: 1.15, run: len * mix(1.2, 3.0, rr()), dry: 0.05, thick: mix(1.0, 1.8, rr()),
          ridge: 0.55, bristle: 0.06, smear: 0.3, pick: 0.12, rag: 0.06, taper0: 0, taper1: 0,
          streak: len * 0.45, sfreq: 1.3, seed: (rr() * 1e9) | 0
        }, o.brush || {}));
      }
    }
    // broad flat brush laying a field: overlapping back-and-forth drags, load running out
    function brushField(x0, y0, x1, y1, c, c2, rr, o) {
      o = o || {};
      const w = x1 - x0, h = y1 - y0;
      const vert = o.vert != null ? o.vert : (h > w * 1.4 && rr() < 0.8);
      const span = vert ? w : h, len = vert ? h : w;
      const bw = Math.min(span * 1.1, (70 + 70 * rr()) * S);
      const n = Math.max(1, Math.ceil(span / (bw * 0.72)));
      for (let k = 0; k < n; k++) {
        const off = n === 1 ? span / 2 : bw * 0.45 + (span - bw * 0.9) * k / (n - 1);
        const dirSign = (k + (rr() < 0.5 ? 0 : 1)) % 2 ? 1 : -1;
        const e0 = len * (rr() * 0.1 - 0.02), e1 = len * (rr() * 0.12 - 0.02);
        const pts = [];
        const steps = Math.max(2, Math.ceil(len / (14 * S)));
        const bow = (rr() - 0.5) * 0.08 * bw;
        for (let i = 0; i <= steps; i++) {
          let t = i / steps; if (dirSign < 0) t = 1 - t;
          const along = -e0 + t * (len + e0 + e1);
          const across = off + bow * Math.sin(t * PI) + (rr() - 0.5) * 0.6 * S;
          if (vert) pts.push(x0 + across, y0 + along); else pts.push(x0 + along, y0 + across);
        }
        cv.stroke(Object.assign({
          pts, w: bw * (0.9 + 0.2 * rr()), col: jitterCol(c, 0.025), col2: c2, cjit: 0.45,
          alpha: 0.96, load: 1.25, run: len * mix(0.8, 1.6, rr()), dry: 0.3, thick: mix(0.6, 1.0, rr()),
          ridge: 0.35, bristle: 0.6, bfreq: bw / (4.5 * S), smear: 0.22, pick: 0.15, rag: 0.22, taper0: 0.05, taper1: 0.12, cap: 0.25,
          streak: len * 0.3, sfreq: 2.0, seed: (rr() * 1e9) | 0
        }, o.brush || {}));
      }
    }
    function knifeSlab(x0, y0, x1, y1, c, c2, rr, o) {
      o = o || {};
      const w = x1 - x0, h = y1 - y0;
      const vert = o.vert != null ? o.vert : (h > w * 1.5);
      const span = vert ? w : h, len = vert ? h : w;
      const pts = [];
      const steps = Math.max(2, Math.ceil(len / (16 * S)));
      const tilt = (rr() - 0.5) * 0.08;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, along = t * len, across = span / 2 + tilt * (along - len / 2);
        if (vert) pts.push(x0 + across, y0 + along); else pts.push(x0 + along, y0 + across);
      }
      cv.stroke({
        pts, w: span, col: c, col2: c2, cjit: 0.3, knife: true, square: true,
        alpha: 0.98, load: 1.2, run: len * 2.2, dry: 0.04, thick: 1.6, ridge: 0.5, bristle: 0.0, smear: 0.25, pick: 0.1,
        rag: 0.05, taper0: 0, taper1: 0, streak: len * 0.5, sfreq: 1.0, seed: (rr() * 1e9) | 0
      });
    }
    shuffle(rects, krnd);
    let nk = 0;
    for (const r of rects) {
      const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
      const ac = aAt(cx, cy);
      if (true) continue;
      const cls = rectClass(r);
      const k1 = pickPal(cls, r.mean, krnd), k2 = pickPal(cls, r.mean, krnd);
      const bold = smooth(0.42, 0.88, ac);
      const c = satv(mix3(r.mean, pn[k1], 0.25 + 0.65 * bold), 1.0 + 0.08 * bold, 1.0 + 0.05 * bold, 0.3);
      const c2 = mix3(c, pn[k2], 0.3 + 0.45 * bold);
      const sh = 1 - smooth(0.4, 0.75, ac);
      const insx = (r.x1 - r.x0) * sh * 0.2 * krnd(), insy = (r.y1 - r.y0) * sh * 0.2 * krnd();
      brushField(r.x0 + insx, r.y0 + insy, r.x1 - insx * krnd(), r.y1 - insy * krnd(), c, c2, krnd);
      nk++;
    }
    log('brush fields: ' + nk);
    // ---- designed planes: the far side of the table re-built as interlocking colour planes
    const eL = edgeY(W * 0.6) / H, eRr = edgeY(W) / H;
    const ey = (fx) => mix(eL, eRr, (fx - 0.6) / 0.4);
    const wl = 0.585; // back of the table
    function plane(polyF, c, c2, o) {
      o = o || {};
      if (!o.brushy) { o.knife = true; }
      const poly = polyF.map(([fx, fy]) => [fx * W, fy * H]);
      const clip = P.polyClip(poly, (o.edge == null ? 3 : o.edge) * S, (krnd() * 1e6) | 0, (o.soft || 1.2) * S);
      const th = o.dir == null ? 0 : o.dir;
      const ux = Math.cos(th), uy = Math.sin(th), vx = -uy, vy = ux;
      let umin = 1e9, umax = -1e9, vmin = 1e9, vmax = -1e9;
      for (const [x, y] of poly) { const u = x * ux + y * uy, v = x * vx + y * vy; umin = Math.min(umin, u); umax = Math.max(umax, u); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
      const bw = (o.bw || 80) * S;
      const n = Math.max(1, Math.ceil((vmax - vmin) / (bw * 0.68)));
      for (let k = 0; k < n; k++) {
        const v = vmin + (n === 1 ? (vmax - vmin) / 2 : bw * 0.3 + (vmax - vmin - bw * 0.6) * k / (n - 1)) + (krnd() - 0.5) * bw * 0.12;
        const over = bw * 0.6;
        let a0 = umin - over, a1 = umax + over;
        if (o.knife && (a1 - a0) > 320 * S) { // break long pulls into overlapping drags
          const segs = Math.ceil((a1 - a0) / (300 * S));
          const seg = (a1 - a0) / segs;
          for (let q2 = 0; q2 < segs; q2++) {
            const b0 = a0 + seg * q2 - seg * 0.12 * krnd(), b1 = a0 + seg * (q2 + 1) + seg * 0.15 * krnd();
            const pts2 = [];
            const vv = v + (krnd() - 0.5) * bw * 0.18, tl = (krnd() - 0.5) * 0.05;
            for (let i = 0; i <= 10; i++) { const u = b0 + (b1 - b0) * i / 10; const w2 = vv + tl * (u - (b0 + b1) / 2); pts2.push(u * ux + w2 * vx, u * uy + w2 * vy); }
            if (krnd() < 0.5) { for (let i = 0; i < pts2.length / 2; i += 2) { const j = pts2.length - 2 - i; [pts2[i], pts2[j]] = [pts2[j], pts2[i]]; [pts2[i + 1], pts2[j + 1]] = [pts2[j + 1], pts2[i + 1]]; } }
            const tone = mix3(c, c2 || c, krnd() * 0.4);
            cv.stroke({ pts: pts2, w: bw * (0.9 + 0.2 * krnd()), col: jitterCol(tone, 0.035), col2: mix3(c, c2 || c, 0.6), alpha: 0.97, clip,
              knife: true, square: true, bristle: 0.0, thick: mix(1.2, 1.9, krnd()), ridge: 0.5, dry: 0.03, load: 1.2, run: (b1 - b0) * 2.2, cjit: 0.35,
              smear: 0.25, pick: 0.08, rag: 0.04, taper0: 0, taper1: 0, streak: (b1 - b0) * 0.5, sfreq: 1.0, seed: (krnd() * 1e9) | 0 });
          }
          continue;
        }
        const rev = krnd() < 0.5;
        const pts = [];
        const steps = Math.max(2, Math.ceil((a1 - a0) / (16 * S)));
        const bow = (krnd() - 0.5) * bw * 0.15;
        for (let i = 0; i <= steps; i++) {
          const t = rev ? 1 - i / steps : i / steps;
          const u = a0 + (a1 - a0) * t, vv = v + bow * Math.sin(t * PI);
          pts.push(u * ux + vv * vx, u * uy + vv * vy);
        }
        const L = a1 - a0;
        const base = o.knife
          ? { knife: true, square: true, bristle: 0.0, thick: 1.5, ridge: 0.5, dry: 0.03, load: 1.2, run: L * 2.5, cjit: 0.35, smear: 0.2, pick: 0.08, rag: 0.04, taper0: 0, taper1: 0, streak: L * 0.5, sfreq: 1.0 }
          : { bristle: 0.6, bfreq: bw / (4.5 * S), thick: 0.9, ridge: 0.3, dry: 0.25, load: 1.3, run: o.fadeLeft ? L * mix(0.38, 0.55, krnd()) : L * mix(0.9, 1.6, krnd()), cjit: 0.3, smear: 0.2, pick: 0.12, rag: 0.15, taper0: 0.05, taper1: 0.1, cap: 0.3, streak: L * 0.3, sfreq: 2.0 };
        const tone = o.knife ? mix3(c, c2 || c, krnd() * 0.35) : c;
        cv.stroke(Object.assign(base, { pts, w: bw * (0.92 + 0.16 * krnd()), col: jitterCol(tone, o.knife ? 0.035 : 0.02), col2: mix3(c, c2 || c, 0.55), alpha: 0.97, clip, seed: (krnd() * 1e9) | 0 }, o.brush || {}));
      }
    }
    const D = (a, b) => satv(a, 1, 1, 0.3).map((v, i) => v * b);
    const mode = (q && q.get('ab')) || 'planes';
    if (mode === 'mosaic') {
      // de Stael-like mosaic of knife slabs, three sizes, laid big to small
      const layersM = [
        { sp: 120, w: [120, 190], l: [150, 280], lo: 0.58, hi: 0.85, src: R4, bold: 1.0 },
        { sp: 78, w: [62, 110], l: [90, 180], lo: 0.46, hi: 0.72, src: R3, bold: 0.8 },
        { sp: 50, w: [32, 58], l: [50, 105], lo: 0.36, hi: 0.58, src: R3, bold: 0.55, fadeHi: [0.8, 0.98] },
      ];
      for (const Ly of layersM) {
        const sp = Ly.sp * S, cand = [];
        for (let gy = -sp / 2; gy < H + sp / 2; gy += sp) for (let gx = W * 0.35; gx < W + sp / 2; gx += sp) cand.push([gx + krnd() * sp, gy + krnd() * sp]);
        shuffle(cand, krnd);
        let n = 0;
        for (const [x, y] of cand) {
          const ac = aAt(x, y);
          let pr = smooth(Ly.lo, Ly.hi, ac);
          if (Ly.fadeHi) pr *= 1 - 0.6 * smooth(Ly.fadeHi[0], Ly.fadeHi[1], ac);
          if (krnd() > pr) continue;
          const m = samp(Ly.src, x, y);
          const cls = rectClass({ x0: x - 15 * S, x1: x + 15 * S, y0: y - 15 * S, y1: y + 15 * S });
          const k1 = pickPal(cls, m, krnd), k2 = pickPal(cls, m, krnd);
          const bold = Ly.bold * smooth(0.35, 0.9, ac);
          const c = satv(mix3(m, pn[k1], 0.3 + 0.6 * bold), 1.0 + 0.1 * bold, 1.0 + 0.06 * bold, 0.3);
          const c2 = mix3(c, pn[k2], 0.5);
          const vert = cls === 'pear' ? krnd() < 0.45 : cls === 'wall' ? krnd() < 0.3 : krnd() < 0.12;
          const kw = mix(Ly.w[0], Ly.w[1], krnd()) * S, kl = mix(Ly.l[0], Ly.l[1], krnd()) * S;
          const th = (vert ? PI / 2 : 0) + (krnd() - 0.5) * 0.12;
          const ux = Math.cos(th), uy = Math.sin(th);
          const sgn = krnd() < 0.5 ? 1 : -1;
          const pts = [];
          for (let i = 0; i <= 8; i++) { const t = (i / 8 - 0.5) * kl * sgn; pts.push(x + ux * t, y + uy * t); }
          cv.stroke({
            pts, w: kw, col: jitterCol(c, 0.02), col2: c2, cjit: 0.35, knife: true, square: true,
            alpha: 0.98, load: 1.2, run: kl * mix(1.4, 3.0, krnd()), dry: 0.03, thick: mix(1.1, 1.9, krnd()),
            ridge: 0.5, bristle: 0.0, smear: 0.35, pick: 0.12, rag: 0.05, taper0: 0, taper1: 0,
            streak: kl * 0.55, sfreq: 1.1, seed: (krnd() * 1e9) | 0
          });
          n++;
        }
        log('mosaic layer ' + Ly.sp + ': ' + n);
      }
    } else {
    // wall
    plane([[0.70, -0.01], [1.01, -0.01], [1.01, 0.27], [0.72, 0.29]], pn.black, pn.wallDark, { dir: 1.25, bw: 110, brushy: true });
    plane([[0.60, 0.02], [0.712, 0.012], [0.716, 0.20], [0.612, 0.212]], mix3(pn.wallDark, pn.black, 0.35), pn.umber, { dir: PI / 2, bw: 120, edge: 4 });
    plane([[0.585, 0.212], [0.80, 0.20], [0.80, 0.30], [0.59, 0.31]], mix3(pn.wallDark, pn.olive, 0.4), pn.wallDark, { dir: 0, bw: 110, edge: 4 });
    plane([[0.62, 0.30], [1.01, 0.28], [1.01, 0.47], [0.635, 0.49]], mix3(pn.wallLight, pn.olive, 0.4), pn.wallDark, { dir: 0, bw: 115 });
    plane([[0.795, 0.165], [0.975, 0.155], [0.968, 0.238], [0.80, 0.246]], pn.slateDark, pn.slate, { bw: 130 });
    // ledge
    plane([[0.60, wl], [1.01, wl - 0.006], [1.01, eRr], [0.61, ey(0.61)]], pn.tableLit, pn.tableShadow, { dir: 0.0, bw: 95 });
    plane([[0.62, ey(0.62) + 0.004], [1.01, eRr + 0.002], [1.01, 1.01], [0.635, 1.01]], pn.front, pn.umber, { dir: 0.0, bw: 120, brushy: true });
    plane([[0.79, 0.835], [1.01, 0.825], [1.01, 1.01], [0.80, 1.01]], pn.black, pn.umber, { dir: -0.05, bw: 120 });
    plane([[0.685, 0.775], [0.752, 0.772], [0.748, 0.975], [0.69, 0.98]], pn.umber, pn.red, { dir: PI / 2, bw: 75 });
    // the pears, as planes
    plane([[0.765, 0.372], [0.94, 0.382], [0.945, 0.548], [0.755, 0.54]], pn.ochre, pn.pearLit, { knife: true, bw: 150 });
    plane([[0.905, 0.395], [1.01, 0.405], [1.01, 0.552], [0.912, 0.55]], mix3(pn.green, pn.pearShadow, 0.5), pn.green, { dir: PI / 2, bw: 80 });
    plane([[0.66, 0.515], [0.86, 0.495], [0.875, 0.625], [0.675, 0.645]], pn.pearLit, pn.cream, { dir: 0.05, bw: 95 });
    plane([[0.72, 0.52], [0.86, 0.505], [0.868, 0.60], [0.73, 0.612]], mix3(pn.pearLit, pn.ochre, 0.5), pn.cream, { knife: true, bw: 130 });
    plane([[0.855, 0.505], [1.01, 0.52], [1.01, 0.66], [0.865, 0.648]], mix3(pn.ochre, pn.red, 0.35), pn.ochre, { dir: 0.1, bw: 90 });
    plane([[0.655, 0.638], [1.01, 0.652], [1.01, 0.70], [0.675, 0.70]], mix3(pn.pearShadow, pn.olive, 0.4), pn.green, { dir: 0.0, bw: 70 });
    plane([[0.75, 0.668], [0.858, 0.662], [0.866, 0.703], [0.758, 0.708]], pn.red, pn.ochre, { knife: true, bw: 120 });
    plane([[0.735, 0.528], [0.80, 0.523], [0.803, 0.562], [0.738, 0.567]], pn.cream, pn.pearLit, { knife: true, bw: 90 });
    }
    log('planes laid');

    // ---- gesture
    function curve(ctrl, n) { // catmull-rom through control points (fractions of W,H)
      const p = ctrl.map(([x, y]) => [x * W, y * H]);
      const out = [];
      for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[Math.max(0, i - 1)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(p.length - 1, i + 2)];
        for (let k = 0; k < n; k++) {
          const t = k / n, t2 = t * t, t3 = t2 * t;
          for (let d = 0; d < 2; d++) out[out.length] = 0.5 * ((2 * p1[d]) + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3);
        }
      }
      out.push(p[p.length - 1][0], p[p.length - 1][1]);
      return out;
    }
    const eR = edgeY(W * 0.85) / H;
    const G1 = (ctrl, w, col, col2, o) => {
      const pts = curve(ctrl, 24);
      let L = 0; for (let i = 2; i < pts.length; i += 2) L += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
      cv.stroke(Object.assign({
        pts, w: w * S, col, col2: col2 || col, alpha: 0.98, load: 1.35, run: L * 0.9, dry: 0.2, thick: 1.3,
        bristle: 0.55, bfreq: Math.max(8, w / 4.5), ridge: 0.3, smear: 0.22, pick: 0.12, cjit: 0.6, taper0: 0.12, taper1: 0.3,
        streak: 220 * S, sfreq: 2.2, rag: 0.3, seed: (krnd() * 1e9) | 0
      }, o || {}));
    };
    // linen white carried along the ledge from the left
    G1([[0.64, eR - 0.022], [0.78, eR - 0.03], [0.91, eR - 0.019], [1.04, eR - 0.027]], 78, pn.linen, pn.cream, { load: 1.45, thick: 1.9, run: 1300 * S });
    // the knife, as one dark diagonal
    G1([[0.71, eR + 0.03], [0.84, eR + 0.11], [0.99, eR + 0.20]], 46, pn.black, pn.handle, { load: 1.4, thick: 1.2, taper1: 0.55, run: 900 * S });
    // leaf red, a short loaded touch
    G1([[0.855, eR - 0.085], [0.895, eR - 0.075]], 66, pn.red, pn.ochre, { load: 1.7, thick: 2.0, taper0: 0.05, taper1: 0.2, cap: 0.3 });
    log('gestures');

    // ---- the drawing survives: a broken calligraphic contour of the far pears
    function contourOf(id) {
      let sx = 0, sy = 0, n = 0;
      for (let i = 0; i < N; i += 3) if (ID[i] === id) { sx += xOf(i); sy += yOf(i); n++; }
      if (!n) return null;
      const cx = sx / n, cy = sy / n, pts = [];
      for (let k = 0; k <= 72; k++) {
        const th = k / 72 * PI * 2; let rr = 0;
        for (let r = 0; r < 700 * S; r += 2 * S) { const px = cx + Math.cos(th) * r, py = cy + Math.sin(th) * r; if (inB(px, py) && ID[idx(px, py)] === id) rr = r; }
        pts.push([cx + Math.cos(th) * rr, cy + Math.sin(th) * rr]);
      }
      return pts;
    }
    // ---- sgraffito: knife-edge scratches back to the red-brown ground
    for (let k = 0; k < 9; k++) {
      const y = H * (0.08 + 0.85 * krnd()), x0 = W * (0.62 + 0.2 * krnd()), len = W * (0.12 + 0.25 * krnd());
      const ang = (krnd() < 0.7 ? 0 : 0.5) * (krnd() - 0.5) + (krnd() - 0.5) * 0.08;
      const pts = [x0, y, x0 + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + (krnd() - 0.5) * 6 * S, x0 + Math.cos(ang) * len, y + Math.sin(ang) * len];
      if (aAt(x0, y) < 0.7) continue;
      cv.stroke({ pts, w: (2.2 + 2 * krnd()) * S, col: [0, 0, 0], mode: 2, alpha: 0.85, load: 1, bristle: 0.4, rag: 0.4, taper0: 0.3, taper1: 0.6, seed: (krnd() * 1e9) | 0 });
    }
    log('abstraction done');
    const rgba = cv.finish({ relief: 1.5, weaveAmp: 0.14, spec: 0.05 });
    log('finish');
    if (view === 'flat') {
      for (let i = 0; i < N; i++) for (let k = 0; k < 3; k++) rgba[i * 4 + k] = cv.col[i * 3 + k] * 255;
    }
    return rgba;
  }

  G.Piece07 = { render };
})(window);
