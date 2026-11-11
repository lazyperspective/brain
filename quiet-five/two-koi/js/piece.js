/* Two Koi, Ink on Rice Paper — a living sumi-e.
 * Deterministic: seeded PRNG, no Math.random / Date. All geometry in design
 * units (frame = 1000 x 1250), rendered at any pixel scale.
 * Loop: 12 s. Everything that moves is a periodic function of t.
 */
(function () {
  'use strict';

  const LOOP = 12;
  const DW = 1000, DH = 1250;
  const TAU = Math.PI * 2;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ------------------------------------------------------------------ */
  /* The one closed path both koi follow (arc-length parametrised).      */
  /* ------------------------------------------------------------------ */
  const PATH = (function () {
    const cx = 470, cy = 682, rot = -0.88;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const raw = (th) => {
      const x = 286 * Math.cos(th) + 26 * Math.cos(2 * th) + 10 * Math.sin(3 * th);
      const y = 206 * Math.sin(th) + 18 * Math.sin(2 * th) - 7 * Math.cos(3 * th);
      return [cx + cr * x - sr * y, cy + sr * x + cr * y];
    };
    const N = 8192;
    const px = new Float64Array(N + 1), py = new Float64Array(N + 1), cum = new Float64Array(N + 1);
    for (let i = 0; i <= N; i++) { const p = raw((i / N) * TAU); px[i] = p[0]; py[i] = p[1]; }
    for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1]);
    const P = cum[N];
    const M = 4096;
    const X = new Float64Array(M), Y = new Float64Array(M);
    let j = 0;
    for (let k = 0; k < M; k++) {
      const s = (k / M) * P;
      while (cum[j + 1] < s) j++;
      const f = (s - cum[j]) / (cum[j + 1] - cum[j]);
      X[k] = px[j] + (px[j + 1] - px[j]) * f;
      Y[k] = py[j] + (py[j + 1] - py[j]) * f;
    }
    const TX = new Float64Array(M), TY = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      const a = (k - 2 + M) % M, b = (k + 2) % M;
      const dx = X[b] - X[a], dy = Y[b] - Y[a], l = Math.hypot(dx, dy);
      TX[k] = dx / l; TY[k] = dy / l;
    }
    function at(s) {
      let u = ((s % P) + P) % P / P * M;
      const i0 = Math.floor(u) % M, i1 = (i0 + 1) % M, f = u - Math.floor(u);
      const x = X[i0] + (X[i1] - X[i0]) * f, y = Y[i0] + (Y[i1] - Y[i0]) * f;
      let tx = TX[i0] + (TX[i1] - TX[i0]) * f, ty = TY[i0] + (TY[i1] - TY[i0]) * f;
      const l = Math.hypot(tx, ty); tx /= l; ty /= l;
      return { x, y, tx, ty, nx: -ty, ny: tx };
    }
    return { P, at };
  })();

  /* ------------------------------------------------------------------ */
  /* Koi                                                                 */
  /* ------------------------------------------------------------------ */
  const FISH = [
    { // the sumi koi: deep ink, side-loaded strokes
      name: 'sumi', L: 296, W: 0.132, s0: 0, beats: 9, beatPh: 0.3, lat: () => 0, finL: 0.25, finW: 0.080, flankOff: 0.40, flankW: 0.66,
      flank: { ink: 3.6, inkEnd: 1.9, press: 0.45, load: 0.52, streak: 0.85, entry: 1.0, dry0: 0.42, dry1: 1.0, dryMax: 0.50, bristles: 22, fray: 0.12, bloom: 0.35, wet: 1.0, halo: 0.30, rim: 0.30, seed: 11 },
      tail: { ink: 2.7, inkEnd: 1.1, press: 0.2, load: 0.30, streak: 0.8, entry: 0.3, dry0: 0.12, dry1: 0.9, dryMax: 0.60, bristles: 14, fray: 0.30, bloom: 0.2, wet: 0.8, halo: 0.22, rim: 0.25, seed: 15 },
      fin: { ink: 1.55, inkEnd: 0.95, press: 0.0, load: 0.25, streak: 0.85, fadeIn: 0.22, entry: 0.0, dry0: 0.45, dry1: 1.0, dryMax: 0.48, bristles: 12, fray: 0.22, bloom: 0.4, wet: 1.0, halo: 0.28, rim: 0.35, seed: 13 },
      accent: { ink: 5.2, inkEnd: 3.0, press: 0.3, streak: 0.4, dry0: 0.45, dry1: 1.0, dryMax: 0.45, bristles: 5, fray: 0.25, wet: 0.45, halo: 0.10, rim: 0.10, seed: 17 },
      tailFlicks: [[-0.30, 0.42, 0.050], [0.03, 0.30, 0.040], [0.30, 0.40, 0.048]], gillW: 0, dorsW: 0.013,
      eyes: { ink: 4.2, s: 0.072, v: 0.72, r: 0.0068 }, patch: null,
      shadow: 0.42,
    },
    { // the tancho koi: a lighter load, one vermilion crown
      name: 'tancho', L: 268, W: 0.126, s0: 0.5, beats: 10, beatPh: 1.9, lat: (s) => 11 * Math.sin(TAU * s / PATH.P + 0.9), finL: 0.25, finW: 0.078, flankOff: 0.40, flankW: 0.66,
      flank: { ink: 1.30, inkEnd: 0.80, press: 0.35, load: 0.13, streak: 0.95, entry: 1.2, dry0: 0.38, dry1: 1.0, dryMax: 0.55, bristles: 21, fray: 0.12, bloom: 0.5, wet: 1.2, halo: 0.34, rim: 0.65, seed: 21 },
      tail: { ink: 1.05, inkEnd: 0.45, press: 0.15, load: 0.25, streak: 0.85, entry: 0.3, dry0: 0.12, dry1: 0.9, dryMax: 0.62, bristles: 13, fray: 0.30, bloom: 0.3, wet: 0.9, halo: 0.25, rim: 0.45, seed: 25 },
      fin: { ink: 0.70, inkEnd: 0.42, press: 0.0, load: 0.25, streak: 0.9, fadeIn: 0.22, entry: 0.0, dry0: 0.45, dry1: 1.0, dryMax: 0.45, bristles: 11, fray: 0.22, bloom: 0.5, wet: 1.2, halo: 0.32, rim: 0.6, seed: 23 },
      accent: { ink: 1.9, inkEnd: 0.9, press: 0.3, streak: 0.4, dry0: 0.45, dry1: 1.0, dryMax: 0.45, bristles: 5, fray: 0.25, wet: 0.5, halo: 0.10, rim: 0.15, seed: 27 },
      tailFlicks: [[-0.31, 0.42, 0.048], [0.02, 0.29, 0.038], [0.29, 0.40, 0.046]], gillW: 0.0052, dorsW: 0.008,
      eyes: { ink: 2.6, s: 0.072, v: 0.70, r: 0.0072 },
      patch: { ink: 1.35, s: 0.150, v: 0.022, r: 0.084, rim: 0.55, ph: [0.7, 2.1, 4.0] },
      shadow: 0.30,
    },
  ];

  const SPD_A = 0.11; // +-11% speed variation, two surges per loop
  function headS(f, t) {
    const ph = TAU * t / LOOP;
    return f.s0 * PATH.P + PATH.P * t / LOOP + SPD_A * PATH.P / (2 * TAU) * Math.sin(2 * ph + 0.4);
  }
  // Tail-beat amplitude envelope: peaks ~0.7 s before the speed surge (the tail leads).
  function beatEnv(t) {
    const ph = TAU * t / LOOP;
    return 0.58 + 0.42 * (0.5 + 0.5 * Math.cos(2 * ph + 0.4 + 2 * TAU * 0.7 / LOOP));
  }
  function spinePt(f, t, sigma) {
    const sh = headS(f, t);
    const sp = sh - sigma;
    const pp = PATH.at(sp);
    const xi = sigma / f.L;
    const ph = TAU * f.beats * t / LOOP + f.beatPh;
    const amp = f.L * (0.010 + 0.058 * xi * xi) * beatEnv(t);
    const lat = f.lat(sp) + amp * Math.sin(ph - TAU * xi / 1.0);
    return [pp.x + pp.nx * lat, pp.y + pp.ny * lat];
  }
  const TAIL_END = 1.36;   // stroke runs from the nose (0) through the peduncle (0.95) to the tail tips
  function fishHW(xi) {
    if (xi < 0.34) return Math.pow(Math.max(0, 1 - Math.pow((0.34 - xi) / 0.34, 2.2)), 0.5);
    if (xi < 0.95) return 1 - 0.82 * Math.pow(smooth(0.34, 0.95, xi), 0.95);
    const k = smooth(0.93, 1.33, xi);
    return 0.18 + 1.22 * Math.pow(k, 0.85);
  }

  /* Build a ribbon (triangle strip) around a polyline. hwFn(u) gives the half
   * width at normalised arc length u. Each vertex carries (x, y, s, v, hw, dhw). */
  function ribbon(pts, hwFn, pad, ext0, ext1) {
    const n = pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const len = cum[n - 1];
    const P = [], S = [];
    const t0 = norm(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]);
    const t1 = norm(pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]);
    const st = 2.0;
    for (let e = Math.ceil(ext0 / st); e >= 1; e--) { P.push([pts[0][0] - t0[0] * e * st, pts[0][1] - t0[1] * e * st]); S.push(-e * st); }
    for (let i = 0; i < n; i++) { P.push(pts[i]); S.push(cum[i]); }
    for (let e = 1; e <= Math.ceil(ext1 / st); e++) { P.push([pts[n - 1][0] + t1[0] * e * st, pts[n - 1][1] + t1[1] * e * st]); S.push(len + e * st); }
    const m = P.length;
    const out = new Float32Array(m * 2 * 6);
    const hwAt = (s) => {
      if (s < 0) return hwFn(0) + s * 1.5;
      if (s > len) return hwFn(1) - (s - len) * 1.5;
      return hwFn(s / len);
    };
    for (let i = 0; i < m; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(m - 1, i + 1)];
      const tg = norm(b[0] - a[0], b[1] - a[1]);
      const nx = -tg[1], ny = tg[0];
      const s = S[i];
      const hw = hwAt(s);
      const e = 0.5;
      const dhw = (hwAt(s + e) - hwAt(s - e)) / (2 * e);
      const w = Math.max(hw, 0) + pad;
      for (let k = 0; k < 2; k++) {
        const sg = k === 0 ? 1 : -1;
        const o = (i * 2 + k) * 6;
        out[o] = P[i][0] + nx * w * sg; out[o + 1] = P[i][1] + ny * w * sg;
        out[o + 2] = s; out[o + 3] = w * sg; out[o + 4] = hw; out[o + 5] = clamp(dhw, -4, 4);
      }
    }
    return { data: out, count: m * 2, len };
  }
  function norm(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  function rot(v, a) { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c - v[1] * s, v[0] * s + v[1] * c]; }

  // Walk a curved stroke from p0 in heading h0 with curvature function kFn(u).
  function walk(p0, h0, len, kFn, step) {
    const pts = [[p0[0], p0[1]]];
    let x = p0[0], y = p0[1], h = h0;
    const n = Math.ceil(len / step);
    for (let i = 1; i <= n; i++) {
      const u = (i - 0.5) / n;
      h += kFn(u) * (len / n);
      x += Math.cos(h) * (len / n); y += Math.sin(h) * (len / n);
      pts.push([x, y]);
    }
    return pts;
  }

  function tailHeading(f, t) {
    const a = spinePt(f, t, f.L), b = spinePt(f, t, f.L - 8);
    return Math.atan2(a[1] - b[1], a[0] - b[0]);
  }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }

  function normals(pts) {
    const n = pts.length, out = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      const tg = norm(b[0] - a[0], b[1] - a[1]);
      out.push([-tg[1], tg[0]]);
    }
    return out;
  }
  function bez(p0, p1, p2, n) {
    const o = [];
    for (let i = 0; i <= n; i++) { const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u; o.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]]); }
    return o;
  }

  function buildFish(f, t, draws) {
    const L = f.L, W = f.W * L;
    const step = 2.0;
    const total = L * TAIL_END;
    const spine = [];
    for (let sg = 0; sg <= total + 1e-6; sg += step) spine.push(spinePt(f, t, sg));
    const nrm = normals(spine);
    const hwB = (xi) => W * fishHW(xi);
    // a point in fish coordinates: sigma along the spine, lat across it
    const at = (sigma, lat) => {
      const k = clamp(sigma / step, 0, spine.length - 1.001), i = Math.floor(k), fr = k - i;
      const p = [spine[i][0] + (spine[i + 1][0] - spine[i][0]) * fr, spine[i][1] + (spine[i + 1][1] - spine[i][1]) * fr];
      const nn = norm(nrm[i][0] + (nrm[i + 1][0] - nrm[i][0]) * fr, nrm[i][1] + (nrm[i + 1][1] - nrm[i][1]) * fr);
      return [p[0] + nn[0] * lat, p[1] + nn[1] * lat];
    };

    // silhouette for the shadow on the pond bed, and the head frame for eyes / vermilion
    const fn = (u) => W * fishHW(u * TAIL_END);
    const bodyShadow = ribbon(spine, fn, 24, 20, 20);
    const headN = Math.ceil(0.36 * L / step) + 1;
    const head = ribbon(spine.slice(0, headN), (u) => fn(u * (headN - 1) * step / total), 11, 8, 2);
    head.len = total;

    // two side-loaded flank strokes, nose to peduncle; their wet seam is the spine
    const nB = Math.round(1.0 * L / step) + 1;
    const flanks = [];
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i < nB; i++) { const xi = (i * step) / L; pts.push(at(i * step, side * f.flankOff * hwB(xi) * smooth(0.0, 0.26, xi))); }
      const r = ribbon(pts, (u) => (f.flankW + (1 - f.flankW) * (1 - smooth(0.0, 0.26, u))) * hwB(u) + 0.4, 12, 8, 6);
      flanks.push({ r, side });
    }

    // tail: three fast flicks from the peduncle, riding the body wave
    const flicks = [];
    const s0 = 0.84 * L;
    for (const [th, len, w] of f.tailFlicks) {
      const Lk = len * L, pts = [];
      for (let sg = 0; sg <= Lk + 1e-6; sg += step) pts.push(at(s0 + sg, Math.tan(th) * sg * (1 + 0.25 * sg / Lk)));
      const Wt = w * L;
      flicks.push(ribbon(pts, (u) => Wt * (0.22 + 0.78 * Math.sin(0.5 * Math.PI * Math.min(1, u / 0.5))) * (1 - 0.55 * smooth(0.55, 1.0, u)), 12, 6, 8));
    }

    // pectoral fins: one pressed stroke each
    const fins = [];
    const sf = 0.25 * L;
    const pa = spinePt(f, t, sf), pb = spinePt(f, t, sf + 4), pc = spinePt(f, t, sf - 4);
    const bdir = norm(pb[0] - pc[0], pb[1] - pc[1]); // pointing tailward
    const bn = [-bdir[1], bdir[0]];
    const qa = spinePt(f, t, sf - 30);
    const curv = angDiff(Math.atan2(pb[1] - pa[1], pb[0] - pa[0]), Math.atan2(pa[1] - qa[1], pa[0] - qa[0]));
    const hwF = hwB(sf / L);
    const Lf = f.finL * L, Wf = f.finW * L;
    for (const side of [1, -1]) {
      const flap = 0.13 * Math.sin(TAU * 5 * t / LOOP + f.beatPh + (side > 0 ? 0 : 1.1));
      const turn = clamp(side * curv * 3.0, -0.22, 0.22);
      const ang = side * (1.0 + flap + turn);
      const h0 = Math.atan2(bdir[1], bdir[0]) - ang;
      const start = [pa[0] + bn[0] * side * -0.92 * hwF, pa[1] + bn[1] * side * -0.92 * hwF];
      const pts = walk(start, h0, Lf, (u) => side * 0.6 / Lf, 2.0);
      const ffn = (u) => Wf * (0.08 + 0.92 * Math.sin(0.5 * Math.PI * Math.min(1, u / 0.74))) * Math.sqrt(Math.max(0, 1 - Math.pow(smooth(0.66, 1.0, u), 2)));
      fins.push({ r: ribbon(pts, ffn, 12, 4, 6), side });
    }

    // calligraphic accents: gill lines, a dorsal flick
    const accents = [];
    for (const side of [1, -1]) {
      const h = hwB(0.2);
      const h2 = hwB(0.25);
      if (!f.gillW) continue;
      const pts = bez(at(0.215 * L, side * 0.45 * h2), at(0.292 * L, side * 0.66 * h2), at(0.262 * L, side * 0.93 * h2), 24);
      accents.push(ribbon(pts, (u) => f.gillW * L * Math.pow(Math.sin(Math.PI * clamp(u * 0.9 + 0.08, 0, 1)), 0.6) + 0.2, 8, 3, 3));
    }
    {
      const pts = [];
      for (let sg = 0.34 * L; sg <= 0.60 * L; sg += step) pts.push(at(sg, 0.05 * hwB(sg / L)));
      accents.push(ribbon(pts, (u) => f.dorsW * L * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.05, 0, 1)), 0.5) * (1 - 0.35 * u) + 0.2, 8, 3, 3));
    }

    const so = [15, 21];
    const R = [1, 0, 0, 0];
    draws.push({ kind: 1, rib: bodyShadow, st: { ink: f.shadow, blur: 12, seed: 3 }, mask: [0, 0, 1, 0], off: so });
    fins.forEach((fi, i) => draws.push({ kind: 0, rib: fi.r, st: Object.assign({}, f.fin, { seed: f.fin.seed + i * 50, loadDir: -fi.side }), mask: R }));
    flicks.forEach((r, i) => draws.push({ kind: 0, rib: r, st: Object.assign({}, f.tail, { seed: f.tail.seed + i * 37, loadDir: i === 1 ? 1 : (i === 0 ? 1 : -1) }), mask: R }));
    flanks.forEach((fl, i) => draws.push({ kind: 0, rib: fl.r, st: Object.assign({}, f.flank, { seed: f.flank.seed + i * 29, loadDir: -fl.side }), mask: R }));
    accents.forEach((r, i) => draws.push({ kind: 0, rib: r, st: Object.assign({}, f.accent, { seed: f.accent.seed + i * 13 }), mask: R }));
    if (f.eyes) draws.push({ kind: 3, rib: head, st: { ink: f.eyes.ink, wet: 0.45, seed: 31 }, p0: [f.eyes.s * L, f.eyes.v * W * fishHW(f.eyes.s), f.eyes.r * L, 0.3], mask: R });
    if (f.patch) draws.push({ kind: 2, rib: head, st: { ink: f.patch.ink, wet: 1.0, seed: 41 }, p0: [f.patch.s * L, f.patch.v * L, f.patch.r * L, f.patch.rim], p1: f.patch.ph.concat([0]), mask: [0, 1, 0, 0] });
  }

  /* ------------------------------------------------------------------ */
  /* Ginkgo leaf + events (fish passing under it)                        */
  /* ------------------------------------------------------------------ */
  const LEAF = { c: [0, 0], S: 74, rot0: 2.55, off: 42 };
  (function placeLeaf() {
    const p = PATH.at(PATH.P * 0.015);
    const out = Math.sign(p.nx * (p.x - 470) + p.ny * (p.y - 682)) || 1;
    LEAF.c = [p.x + p.nx * out * LEAF.off, p.y + p.ny * out * LEAF.off];
  })();
  const EVENTS = [];
  (function findEvents() {
    for (const f of FISH) {
      let best = 1e9, bt = 0;
      for (let i = 0; i < LOOP * 240; i++) {
        const t = i / 240;
        const q = spinePt(f, t, 0.40 * f.L);
        const d = Math.hypot(q[0] - LEAF.c[0], q[1] - LEAF.c[1]);
        if (d < best) { best = d; bt = t; }
      }
      const a = spinePt(f, bt, 0.2 * f.L), b = spinePt(f, bt, 0.45 * f.L);
      EVENTS.push({ t: bt - 0.15, str: clamp(1.25 - best / 110, 0.4, 1), dir: norm(a[0] - b[0], a[1] - b[1]), fish: f.name });
    }
  })();
  function eventAges(t, maxAge) {
    const out = [];
    for (const e of EVENTS) for (let n = -3; n <= 0; n++) {
      const age = t - (e.t + n * LOOP);
      if (age >= 0 && age < maxAge) out.push({ e, age });
    }
    return out;
  }
  function leafState(t) {
    const ph = TAU * t / LOOP;
    let x = LEAF.c[0] + 4.0 * Math.sin(ph + 0.3), y = LEAF.c[1] + 3.0 * Math.sin(ph + 1.4);
    let r = LEAF.rot0 + 0.035 * Math.sin(ph + 2.0);
    let tilt = 0, bob = 0;
    for (const { e, age } of eventAges(t, 40)) {
      const k = e.str;
      const push = 6.5 * k * (Math.exp(-age / 2.4) - Math.exp(-age / 0.45));
      x += e.dir[0] * push; y += e.dir[1] * push;
      r += 0.075 * k * Math.exp(-age / 1.7) * Math.sin(TAU * age / 1.35);
      tilt += 0.06 * k * Math.exp(-age / 1.5) * Math.sin(TAU * age / 0.95 + 0.4) * smooth(0, 0.25, age);
      bob += 0.10 * k * Math.exp(-age / 1.4) * Math.sin(TAU * age / 0.95) ;
    }
    return { x, y, r, tilt, bob };
  }
  function buildLeaf(t, draws) {
    const ls = leafState(t);
    const S = LEAF.S;
    const x0 = -1.15 * S, x1 = 1.15 * S, y0 = -0.78 * S, y1 = 1.05 * S;
    const c = Math.cos(ls.r), s = Math.sin(ls.r);
    const sx = 1 - Math.abs(ls.tilt) * 0.6, sy = 1 - Math.abs(ls.tilt) * 0.25;
    const mk = (off) => {
      const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
      const d = new Float32Array(4 * 6);
      corners.forEach((q, i) => {
        const lx = q[0] * sx, ly = q[1] * sy;
        d[i * 6] = ls.x + c * lx - s * ly + off[0];
        d[i * 6 + 1] = ls.y + s * lx + c * ly + off[1];
        d[i * 6 + 2] = q[0]; d[i * 6 + 3] = q[1]; d[i * 6 + 4] = 0; d[i * 6 + 5] = 0;
      });
      return { data: d, count: 4, len: 1 };
    };
    const so = 1 + ls.bob;
    draws.push({ kind: 5, rib: mk([0, 0]), st: { ink: 0.34, blur: 9.0, seed: 61 }, p0: [S, 1.08, 0.62 * S, 0.30], off: [11 * so, 15 * so], mask: [0, 0, 1, 0] });
    draws.push({ kind: 4, rib: mk([0, 0]), st: { ink: 0.95, wet: 0.6, rim: 0.75, dryMax: 0.22, halo: 0.22, seed: 62 }, p0: [S, 1.08, 0.62 * S, 0.30], p1: [0.0, 0, 0, 0], mask: [0, 0, 0, 1] });
    leafStrokes(ls, sx, sy, draws);
  }
  function leafR(a) {
    const S = LEAF.S, amax = 1.08;
    let R = S * (0.93 + 0.028 * Math.sin(a * 7 + 1.3) + 0.016 * Math.sin(a * 19 + 0.4) + 0.008 * Math.sin(a * 41 + 2.0));
    R -= S * 0.30 * Math.exp(-Math.pow(a / 0.075, 2)) * (1 + 0.2 * Math.sin(a * 3));
    R *= 1 - 0.14 * Math.pow(Math.abs(a) / amax, 4);
    return R;
  }
  function leafStrokes(ls, sx, sy, draws) {
    const S = LEAF.S, c = Math.cos(ls.r), s = Math.sin(ls.r);
    const W = (q) => { const lx = q[0] * sx, ly = q[1] * sy; return [ls.x + c * lx - s * ly, ls.y + s * lx + c * ly]; };
    // stem: one thin line, pressed where it meets the blade, lifting at the end
    const Ls = 0.64 * S, cc = 0.30, stem = [];
    for (let i = 0; i <= 30; i++) { const tt = -0.06 + 1.06 * i / 30; stem.push(W([cc * Ls * tt * Math.max(tt, 0), -tt * Ls])); }
    draws.push({ kind: 0, rib: ribbon(stem, (u) => 1.7 * (1 - 0.6 * u) * (0.6 + 0.4 * Math.min(1, u / 0.1)) + 0.15, 8, 3, 3),
      st: { ink: 2.3, inkEnd: 1.5, press: 0.3, streak: 0.5, dry0: 0.55, dry1: 1.0, dryMax: 0.4, bristles: 4, fray: 0.12, wet: 0.45, halo: 0.12, rim: 0.2, seed: 64 }, mask: [0, 0, 0, 1] });
    // a darker accent along part of one lobe's margin
    const acc = [];
    for (let i = 0; i <= 40; i++) { const a = -1.0 + 0.78 * i / 40; const r = leafR(a) - 2.2; acc.push(W([r * Math.sin(a), r * Math.cos(a)])); }
    draws.push({ kind: 0, rib: ribbon(acc, (u) => 1.5 * Math.pow(Math.sin(Math.PI * clamp(u * 0.92 + 0.04, 0, 1)), 0.5) + 0.1, 8, 3, 3),
      st: { ink: 2.0, inkEnd: 1.2, press: 0.2, streak: 0.6, dry0: 0.35, dry1: 1.0, dryMax: 0.55, bristles: 5, fray: 0.2, wet: 0.5, halo: 0.12, rim: 0.2, seed: 66 }, mask: [0, 0, 0, 1] });
  }
  function rings(t) {
    const out = [];
    for (const { e, age } of eventAges(t, 10)) {
      const R = 14 + 92 * age;
      const amp = e.str * Math.exp(-age / 2.8) * (1 - smooth(6.5, 10, age)) * smooth(0, 0.35, age);
      out.push([LEAF.c[0], LEAF.c[1], R, amp]);
    }
    return out.slice(0, 8);
  }

  /* ------------------------------------------------------------------ */
  /* WebGL                                                               */
  /* ------------------------------------------------------------------ */
  const NOISE = `
  uint hsh(uint x){ x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
  float h21(ivec2 p, uint s){ return float(hsh(uint(p.x) * 0x9E3779B1u ^ hsh(uint(p.y) ^ (s * 0x85EBCA77u)))) * (1.0/4294967296.0); }
  float vnoise(vec2 p, uint s){
    p += 8192.0;
    vec2 fl = floor(p); ivec2 i = ivec2(fl); vec2 f = p - fl;
    vec2 u = f*f*(3.0-2.0*f);
    float a = h21(i, s), b = h21(i+ivec2(1,0), s), c = h21(i+ivec2(0,1), s), d = h21(i+ivec2(1,1), s);
    return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
  }
  float fbm(vec2 p, uint s){ float a=0.5, r=0.0; for(int k=0;k<4;k++){ r += a*vnoise(p, s+uint(k)*101u); p = p*2.03 + vec2(17.1, 3.7); a*=0.5; } return r/0.9375; }
  float fibers(vec2 q, uint s){
    float f = 0.0;
    for(int k=0;k<3;k++){
      float a = float(s%97u)*0.37 + float(k)*2.09;
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
      float n = vnoise(r * vec2(0.075, 0.85) + float(k)*31.0, s + uint(k)*7u);
      float ridge = 1.0 - abs(2.0*n - 1.0);
      f = max(f, pow(ridge, 7.0));
    }
    return f;
  }
  float fiberSparse(vec2 q, uint s){
    float f = 0.0;
    for(int k=0;k<2;k++){
      float a = float(s%97u)*0.37 + float(k)*2.39;
      vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
      float n = vnoise(r * vec2(0.09, 0.8) + float(k)*31.0, s + uint(k)*7u);
      float ridge = 1.0 - abs(2.0*n - 1.0);
      f = max(f, pow(ridge, 14.0) * smoothstep(0.55, 0.85, vnoise(q * 0.06 + float(k)*5.0, s + 40u + uint(k))));
    }
    return f;
  }
  // uneven drying of a wash: soft pooling plus thin tide lines where a water front stopped
  float bloom(vec2 q, uint s, float amt){
    if (amt <= 0.0) return 1.0;
    vec2 w = q * 0.028 + 2.0 * vec2(vnoise(q * 0.02, s + 81u), vnoise(q * 0.02 + 7.0, s + 82u));
    float f = fbm(w, s + 83u);
    float tide = exp(-pow((f - 0.56) / 0.022, 2.0)) + 0.5 * exp(-pow((f - 0.38) / 0.016, 2.0));
    float pool = smoothstep(0.35, 0.65, f);
    return 1.0 + amt * (0.6 * (pool - 0.5) + 0.28 * tide);
  }
  float streakEntry(vec2 q, uint s){ return vnoise(q * 0.12, s + 91u); }
  vec3 toLin(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
  vec3 toSrgb(vec3 c){ c = max(c, 0.0); return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
  `;

  const VS_FULL = `#version 300 es
  in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS_PAPER = `#version 300 es
  precision highp float; precision highp int;
  uniform sampler2D uFib; uniform vec2 uRes; uniform float uScale; uniform int uMode;
  out vec4 o;
  ${NOISE}
  void main(){
    vec2 fc = gl_FragCoord.xy;
    vec2 p = vec2(fc.x, uRes.y - fc.y) / uScale;
    if (uMode == 1) { o = vec4(fbm(p * 0.9, 31u), 0.0, 0.0, 1.0); return; }
    vec4 fb = texelFetch(uFib, ivec2(fc), 0);
    // soft neighbourhood of fibres (paper formation follows them)
    float fl = fb.r, fk = fb.g;
    float mott = fbm(p / 120.0, 1u) - 0.5;
    float cloud = fbm(p / 13.0, 2u) - 0.5;
    float floc = fbm(p / 4.2, 5u) - 0.5;
    float grain = (vnoise(p * 1.7, 3u) - 0.5) + 0.6 * (vnoise(p * 4.3, 4u) - 0.5);
    // laid lines from the bamboo screen, and chain lines
    float laid = 0.5 + 0.5 * cos(6.2831853 * (p.y + 1.4 * vnoise(vec2(p.x * 0.015, 3.0), 9u)) / 2.35);
    float cx = p.x + 4.0 * (vnoise(vec2(1.0, p.y * 0.006), 10u) - 0.5);
    float chain = exp(-pow((mod(cx, 61.0) - 30.5) / 1.4, 2.0));
    float lum = 1.0 + 0.060 * mott + 0.050 * cloud + 0.036 * floc + 0.020 * grain
              + 0.15 * fl - 0.22 * fk + 0.006 * (laid - 0.5) + 0.008 * chain;
    // the light on the sheet: very gentle fall-off from upper left
    vec2 lq = (p - vec2(250.0, 180.0)) / vec2(1500.0, 1700.0);
    lum *= 1.012 - 0.03 * dot(lq, lq);
    vec3 base = toLin(vec3(0.940, 0.910, 0.850));
    vec3 col = base * lum;
    col *= vec3(1.0, 1.0 - 0.004 * mott, 1.0 - 0.016 * mott - 0.01 * cloud);
    col = mix(col, col * vec3(0.92, 0.82, 0.66), clamp(fk * 0.6, 0.0, 1.0));
    float absorb = clamp(0.96 + 0.26 * cloud + 0.16 * floc - 0.10 * fl + 0.06 * grain + 0.10 * mott, 0.75, 1.25);
    o = vec4(col, absorb);
  }`;

  const VS_INK = `#version 300 es
  in vec2 aPos; in vec4 aS;
  uniform vec2 uOff; uniform float uScale; uniform vec2 uRes;
  out vec4 vS;
  void main(){
    vec2 p = (aPos + uOff) * uScale;
    vec2 c = p / uRes * 2.0 - 1.0; c.y = -c.y;
    gl_Position = vec4(c, 0.0, 1.0);
    vS = aS;
  }`;

  const FS_INK = `#version 300 es
  precision highp float; precision highp int;
  in vec4 vS; out vec4 o;
  uniform int uKind; uniform vec4 uMask;
  uniform float uLen, uInk, uInkEnd, uPress, uDry0, uDry1, uDryMax, uBristles, uFray, uFork, uStreak, uFadeIn, uBloom, uLoad, uLoadDir, uEntry, uWet, uHalo, uRim, uCenter, uSide, uSeed, uAA, uBlur;
  uniform vec4 uP0, uP1;
  ${NOISE}
  void main(){
    float s = vS.x, v = vS.y, hw = vS.z, dhw = vS.w;
    uint sd = uint(uSeed);
    vec2 q = vec2(s, v);
    float D = 0.0;
    if (uKind == 0) {
      float u = s / uLen;
      float d = (abs(v) - hw) * inversesqrt(1.0 + dhw * dhw);
      float vn = v / max(hw, 0.6);
      float fib = fiberSparse(q, sd);
      float en = fbm(q * 0.15, sd + 7u);
      float en2 = vnoise(q * 0.85, sd + 17u);
      float dry = uDryMax * smoothstep(uDry0, uDry1, u);
      float uu = s / uLen;
      float entry = uEntry * exp(-max(uu, 0.0) / 0.07);
      float wv = (0.35 + 1.0 * vnoise(vec2(s * 0.011, 3.0 + float(sd)), sd + 61u)) * (1.0 + entry);
      float wet = uWet * wv * (1.0 - 0.85 * dry);
      float dE = d - wet * (1.7 * (en - 0.5) + 0.22 * (en2 - 0.5) + 1.1 * fib) - dry * 1.6 * (en - 0.5);
      float cov = 1.0 - smoothstep(-uAA, uAA, dE);
      float bx = (clamp(vn, -1.15, 1.15) * 0.5 + 0.5) * uBristles;
      float b1 = vnoise(vec2(bx * 0.55, s * 0.008), sd + 11u);
      float b2 = vnoise(vec2(bx * 2.6, s * 0.045), sd + 23u);
      float b3 = vnoise(vec2(bx * 6.1, s * 0.11), sd + 29u);
      float br = 0.58 * b1 + 0.30 * b2 + 0.12 * b3;
      float grain = vnoise(q * 1.35, sd + 71u);
      float dryMask = smoothstep(dry - 0.07, dry + 0.07, 0.82 * br + 0.18 * grain);
      float bid = floor(bx * 1.6);
      float avn = min(abs(vn), 1.0);
      float endU = 1.0 - uFray * (0.15 + 0.85 * h21(ivec2(int(bid) + 100, 7), sd)) - uFork * pow(1.0 - avn, 1.6);
      float fray = 1.0 - smoothstep(endU - 0.03, endU, u);
      float ink = mix(uInk, uInkEnd, smoothstep(0.15, 1.0, u));
      ink *= 1.0 + uPress * exp(-max(u, 0.0) / 0.06);
      if (uFadeIn > 0.0) ink *= 0.25 + 0.75 * smoothstep(0.0, uFadeIn, u);
      float tone = clamp(1.0 - uCenter * vn * vn + uSide * vn, 0.15, 2.5);
      if (uLoad > 0.0) { float tl = clamp(0.5 + 0.5 * uLoadDir * vn + 0.12 * (b2 - 0.5), 0.0, 1.0); tone = mix(uLoad, 1.0, pow(tl, 1.35)); }
      float rim = uRim * (1.0 + 1.5 * entry) * exp(-max(-dE, 0.0) / 1.7) * (1.0 - dry);
      float brs = smoothstep(0.18, 0.82, br);
      float streak = mix(1.0 - uStreak * 0.5 + uStreak * brs, 0.80 + 0.40 * br, smoothstep(0.0, 0.3, dry)) * (1.0 - 0.6 * entry * (1.0 - streakEntry(q, sd)));
      float core = ink * tone * streak * (1.0 + rim) * cov * dryMask * fray * bloom(q, sd, uBloom * (1.0 + 1.2 * entry));
      float halo = uHalo * ink * (1.0 - cov) * exp(-max(dE, 0.0) / (1.3 + 3.0 * wet)) * (0.65 + 0.3 * en2 + 0.5 * fib) * wv * (1.0 - dry) * fray * (1.0 - smoothstep(6.0, 10.0, dE));
      D = core + halo;
    } else if (uKind == 1) {
      float u = s / uLen;
      float d = (abs(v) - hw) * inversesqrt(1.0 + dhw * dhw);
      float en = fbm(q * 0.05, sd + 3u);
      D = uInk * (1.0 - smoothstep(-uBlur, uBlur, d + 3.0 * (en - 0.5))) * (0.85 + 0.3 * en) * (1.0 - smoothstep(0.80, 1.0, u)) * smoothstep(-0.03, 0.04, u);
    } else if (uKind == 2) {
      vec2 pq = vec2(s - uP0.x, v - uP0.y);
      float r = length(pq); float a = atan(pq.y, pq.x);
      float R = uP0.z * (1.0 + 0.07 * sin(2.0 * a + uP1.x) + 0.06 * sin(3.0 * a + uP1.y) + 0.025 * sin(5.0 * a + uP1.z) + 0.012 * sin(9.0 * a + 1.0));
      float fib = fibers(q * 1.1, sd);
      float en = fbm(q * 0.3, sd + 5u);
      float dE = r - R - uWet * (0.9 * fib + 1.6 * (en - 0.5));
      float cov = 1.0 - smoothstep(-0.9, 0.9, dE);
      float rim = uP0.w * exp(-max(-dE, 0.0) / 2.6);
      float gran = 0.80 + 0.30 * vnoise(q * 1.25, sd + 3u) + 0.12 * vnoise(q * 0.31, sd + 9u);
      float sweep = 0.92 + 0.16 * vnoise(vec2(s * 0.05, v * 0.7), sd + 13u);
      float center = 0.82 + 0.18 * smoothstep(0.0, R, r);
      float halo = 0.30 * (1.0 - cov) * exp(-max(dE, 0.0) / 2.6) * (0.6 + 0.8 * fib);
      D = uInk * (cov * (1.0 + rim) * gran * sweep * center + halo);
    } else if (uKind == 3) {
      float d1 = length(vec2(s - uP0.x, v - uP0.y)) - uP0.z;
      float d2 = length(vec2(s - uP0.x, v + uP0.y)) - uP0.z;
      float en = fbm(q * 0.5, sd);
      float d = min(d1, d2) - uWet * 1.2 * (en - 0.4);
      float cov = 1.0 - smoothstep(-uAA, uAA, d);
      D = uInk * cov * (1.0 + 0.4 * exp(-max(-d, 0.0) / 0.8)) + 0.15 * uInk * (1.0 - cov) * exp(-max(d, 0.0) / 1.5);
    } else {
      // ginkgo leaf, local coords: base at origin, blade toward +y
      vec2 lp = vS.xy; float S = uP0.x; float amax = uP0.y;
      float r = length(lp) + 1e-4; float a = atan(lp.x, lp.y);
      float R = S * (0.93 + 0.028 * sin(a * 7.0 + 1.3) + 0.016 * sin(a * 19.0 + 0.4) + 0.008 * sin(a * 41.0 + 2.0));
      R -= S * 0.30 * exp(-pow(a / 0.075, 2.0)) * (1.0 + 0.2 * sin(a * 3.0));
      R *= 1.0 - 0.14 * pow(abs(a) / amax, 4.0);
      float dOut = r - R;
      float dSide = (abs(a) - amax * (1.0 - 0.05 * smoothstep(0.0, 0.3 * S, r) + 0.035 * sin(r * 0.11 + sign(a) * 1.7) + 0.02 * sin(r * 0.31 + sign(a)))) * r;
      float dB = length(max(vec2(dOut, dSide) + 6.0, 0.0)) + min(max(dOut, dSide) + 6.0, 0.0) - 6.0;
      // stem
      float Ls = uP0.z, cc = uP0.w;
      float tt = clamp(-lp.y / Ls, 0.0, 1.0);
      float xc = cc * Ls * tt * tt;
      float slope = 2.0 * cc * tt;
      float hs = 1.55 * (1.0 - 0.5 * tt);
      float ds = abs(lp.x - xc) * inversesqrt(1.0 + slope * slope) - hs;
      ds = max(ds, max(-lp.y - Ls, lp.y - 0.10 * S));
      if (uKind == 5) {
        float dd = min(dB, ds + 0.5);
        D = uInk * (1.0 - smoothstep(-uBlur, uBlur, dd));
      } else {
        vec2 lq = lp + 300.0;
        float fib = fibers(lq, sd);
        float en = fbm(lq * 0.25, sd + 5u);
        float dE = dB - uWet * (0.8 * fib + 1.5 * (en - 0.5));
        float cov = 1.0 - smoothstep(-uAA, uAA, dE);
        float an = (a + 3.2) ;
        float v1 = vnoise(vec2(an * 60.0, r * 0.035), sd + 9u);
        float v2 = vnoise(vec2(an * 150.0, r * 0.08), sd + 19u);
        float v3 = vnoise(vec2(an * 330.0, r * 0.2), sd + 21u);
        float vv = 0.5 * v1 + 0.32 * v2 + 0.18 * v3;
        float lobe = a < 0.0 ? 1.0 : 0.86;
        float rr = r / R;
        float rim = uRim * exp(-max(-dE, 0.0) / 1.9);
        float grain = vnoise(lq * 1.35, sd + 71u);
        float dry = 0.62 * (1.0 - smoothstep(0.08, 0.62, rr)) + uDryMax * smoothstep(0.9, 1.03, rr);
        float dm = smoothstep(dry - 0.07, dry + 0.07, 0.8 * vv + 0.2 * grain);
        float split = 1.0 - 0.75 * exp(-pow(a * r / 1.4, 2.0)) * smoothstep(0.18 * S, 0.40 * S, r);
        float marg = pow(smoothstep(0.12, 1.0, rr), 1.25);
        float tone = mix(0.26, 1.2, marg) * (0.55 + 0.9 * smoothstep(0.2, 0.8, vv)) * lobe * split;
        float Db = uInk * tone * (1.0 + rim) * cov * dm * bloom(lq, sd, 0.4);
        float halo = uHalo * uInk * (1.0 - cov) * exp(-max(dE, 0.0) / 2.2) * (0.3 + 1.2 * fib);
        float covs = 1.0 - smoothstep(-uAA, uAA, ds - uWet * 0.9 * (fib - 0.2));
        float Ds = uP1.x * covs * (1.0 + 0.2 * exp(-tt / 0.1)) * (1.0 - 0.45 * smoothstep(-0.02 * S, 0.08 * S, lp.y)) * (0.85 + 0.3 * vnoise(vec2(lp.x * 0.8, lp.y * 0.06), sd + 2u));
        D = Db + halo + Ds;
      }
    }
    o = uMask * D;
  }`;

  const FS_COMP = `#version 300 es
  precision highp float; precision highp int;
  uniform sampler2D uInk, uPaper, uAux; uniform vec2 uRes; uniform float uScale;
  uniform vec4 uRing[8]; uniform int uNR;
  uniform vec3 uKB, uKV;
  out vec4 o;
  ${NOISE}
  void main(){
    vec2 fc = gl_FragCoord.xy;
    vec2 p = vec2(fc.x, uRes.y - fc.y) / uScale;
    vec4 paper = texelFetch(uPaper, ivec2(fc), 0);
    vec2 disp = vec2(0.0); float ringD = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= uNR) break;
      vec4 rg = uRing[i];
      vec2 dv = p - rg.xy; float r = length(dv) + 1e-3;
      float x = r - rg.z;
      if (abs(x) > 4.0 * (24.0 + 0.04 * rg.z) + 40.0) continue;
      float lam = 30.0, w = 24.0 + 0.04 * rg.z;
      float env = exp(-x * x / (w * w));
      float ph = 6.2831853 * x / lam;
      float A = rg.w / sqrt(1.0 + rg.z / 80.0);
      float dh = A * env * (cos(ph) * 6.2831853 / lam - sin(ph) * 2.0 * x / (w * w));
      disp += dv / r * dh;
      // a pale wash where the ring lifts: wavering, with a soft dried edge
      vec2 dir = dv / r;
      float brk = vnoise(dir * 2.4 + vec2(5.0, 9.0), 77u);
      float brk2 = vnoise(dir * 2.1 + vec2(1.0, 3.0), 79u);
      float wob = vnoise(dir * 5.0 + 11.0, 78u) - 0.5;
      float xw = x + 5.0 * wob;
      float wid = 2.2 + 0.010 * rg.z;
      float arc1 = smoothstep(0.40, 0.58, brk) * (1.0 - smoothstep(0.0, 0.15, (brk - 0.85)));
      float arc2 = smoothstep(0.50, 0.66, brk2);
      float streakA = vnoise(vec2(xw * 1.1 + 40.0, brk * 6.0), 80u);
      float c1 = exp(-pow(xw / wid, 2.0)) * (0.45 + 0.9 * streakA);
      float c2 = exp(-pow((xw + 15.0 + 3.0 * wob) / (0.8 * wid), 2.0));
      float pale = exp(-pow((xw + 5.0) / (4.0 * wid), 2.0));
      ringD += A * (arc1 * (c1 + 0.18 * pale) + 0.45 * arc2 * c2);
    }
    vec2 dpx = vec2(disp.x, -disp.y) * uScale * 14.0;
    vec4 inkU = texture(uInk, (fc + dpx) / uRes);
    vec4 inkS = texture(uInk, (fc + dpx * 1.8) / uRes);
    vec4 inkL = texelFetch(uInk, ivec2(fc), 0);
    float ab = paper.a;
    float fibr = texelFetch(uAux, ivec2(fc), 0).r;
    float Dw = (inkU.r + inkS.b) * ab + ringD * 0.55 * (0.6 + 0.8 * fibr) * ab;
    float Dv = inkU.g * mix(1.0, ab, 0.6);
    float Dl = inkL.a * mix(1.0, ab, 0.7);
    // under the water: fish, their shadows, the ring
    // vermilion is an opaque mineral pigment: where it is dense it sits on top of the grey
    float vc = smoothstep(0.25, 1.1, Dv);
    vec3 under = paper.rgb * exp(-(Dw * (1.0 - 0.72 * vc) * uKB + Dv * uKV));
    // the leaf floats on top and hides what passes beneath it (painted over a reserve)
    float lc = smoothstep(0.04, 0.42, inkL.a);
    vec3 leaf = paper.rgb * exp(-(Dl + 0.10 * Dw) * uKB - 0.10 * Dv * uKV);
    vec3 col = mix(under * exp(-Dl * uKB), leaf, lc);
    o = vec4(col, 1.0);
  }`;

  const FS_FINAL = `#version 300 es
  precision highp float; precision highp int;
  uniform sampler2D uSrc; uniform int uSS; uniform vec2 uOutRes;
  out vec4 o;
  ${NOISE}
  void main(){
    ivec2 pc = ivec2(gl_FragCoord.xy);
    vec3 acc = vec3(0.0);
    for (int j = 0; j < 4; j++) { if (j >= uSS) break;
      for (int i = 0; i < 4; i++) { if (i >= uSS) break;
        acc += texelFetch(uSrc, pc * uSS + ivec2(i, j), 0).rgb; } }
    acc /= float(uSS * uSS);
    vec3 c = toSrgb(acc);
    float dz = h21(pc, 5u) - h21(pc + ivec2(7, 3), 9u);
    c += dz / 255.0;
    o = vec4(c, 1.0);
  }`;

  function compile(gl, type, src) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
    return sh;
  }
  function program(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aS');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function tex(gl, w, h, ifmt, fmt, type, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function fbo(gl, t) { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; }

  /* Paper fibres drawn once with Canvas 2D (kozo-like long fibres, short
   * fines, a few bark flecks). R = light fibres, G = dark flecks. */
  function fiberCanvas(w, h, scale) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    const rnd = mulberry32(90210);
    const curve = (len, wid, alpha, col, wav) => {
      const x = rnd() * (DW + 60) - 30, y = rnd() * (DH + 60) - 30;
      const a = rnd() * TAU;
      const b1 = a + (rnd() - 0.5) * wav, b2 = b1 + (rnd() - 0.5) * wav;
      const p1 = [x + Math.cos(a) * len / 3, y + Math.sin(a) * len / 3];
      const p2 = [p1[0] + Math.cos(b1) * len / 3, p1[1] + Math.sin(b1) * len / 3];
      const p3 = [p2[0] + Math.cos(b2) * len / 3, p2[1] + Math.sin(b2) * len / 3];
      g.strokeStyle = `rgba(${col},${alpha.toFixed(3)})`;
      g.lineWidth = Math.max(0.35, wid * scale);
      if (wid * scale < 0.35) g.globalAlpha = (wid * scale) / 0.35; else g.globalAlpha = 1;
      g.beginPath(); g.moveTo(x * scale, y * scale);
      g.bezierCurveTo(p1[0] * scale, p1[1] * scale, p2[0] * scale, p2[1] * scale, p3[0] * scale, p3[1] * scale);
      g.stroke();
    };
    for (let i = 0; i < 17000; i++) curve(5 + 24 * rnd() * rnd(), 0.20 + 0.25 * rnd(), 0.10 + 0.25 * rnd(), '255,0,0', 1.6);
    for (let i = 0; i < 1700; i++) curve(30 + 90 * rnd(), 0.22 + 0.30 * rnd(), 0.10 + 0.20 * rnd(), '255,0,0', 0.9);
    for (let i = 0; i < 70; i++) curve(1.5 + 5 * rnd(), 0.35 + 0.5 * rnd(), 0.25 + 0.45 * rnd(), '0,255,0', 2.5);
    for (let i = 0; i < 9; i++) curve(8 + 20 * rnd(), 0.3 + 0.15 * rnd(), 0.18 + 0.2 * rnd(), '0,255,0', 1.2);
    g.globalAlpha = 1;
    return c;
  }

  function Renderer(canvas, outW, outH, ss) {
    const W = outW * ss, H = outH * ss;
    canvas.width = outW; canvas.height = outH;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 unavailable');
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('EXT_color_buffer_half_float'); gl.getExtension('OES_texture_float_linear');
    const scale = W / DW;
    const progPaper = program(gl, VS_FULL, FS_PAPER), progInk = program(gl, VS_INK, FS_INK), progComp = program(gl, VS_FULL, FS_COMP), progFinal = program(gl, VS_FULL, FS_FINAL);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    const dyn = gl.createBuffer();

    const paperT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST), paperF = fbo(gl, paperT);
    const auxT = tex(gl, W, H, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.NEAREST), auxF = fbo(gl, auxT);
    const inkT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR), inkF = fbo(gl, inkT);
    const compT = tex(gl, W, H, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.NEAREST), compF = fbo(gl, compT);

    function fullscreen() {
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0); gl.disableVertexAttribArray(1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    // paper (once)
    {
      const fc = fiberCanvas(W, H, scale);
      const ft = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ft);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, fc);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, paperF); gl.viewport(0, 0, W, H);
      gl.useProgram(progPaper.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ft);
      gl.uniform1i(progPaper.u.uFib, 0); gl.uniform2f(progPaper.u.uRes, W, H); gl.uniform1f(progPaper.u.uScale, scale);
      gl.disable(gl.BLEND);
      gl.uniform1i(progPaper.u.uMode, 0);
      fullscreen();
      gl.bindFramebuffer(gl.FRAMEBUFFER, auxF); gl.uniform1i(progPaper.u.uMode, 1);
      fullscreen();
      gl.deleteTexture(ft);
    }

    const K_BLACK = [1.035, 1.0, 0.955];
    const K_VERM = [0.06, 1.70, 2.30];

    function render(t, prof) {
      const T0 = prof ? performance.now() : 0;
      t = ((t % LOOP) + LOOP) % LOOP;
      const draws = [];
      for (const f of FISH) buildFish(f, t, draws);
      buildLeaf(t, draws);
      // ink pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, inkF); gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(progInk.p);
      const U = progInk.u;
      gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uScale, scale); gl.uniform1f(U.uAA, 0.75 / scale);
      gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, dyn);
      gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
      for (const d of draws) {
        if (window.__skip === 'ink') break;
        const st = d.st;
        gl.bufferData(gl.ARRAY_BUFFER, d.rib.data, gl.STREAM_DRAW);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
        gl.uniform1i(U.uKind, d.kind);
        gl.uniform4fv(U.uMask, d.mask);
        gl.uniform2fv(U.uOff, d.off || [0, 0]);
        gl.uniform1f(U.uLen, d.rib.len);
        gl.uniform1f(U.uInk, st.ink); gl.uniform1f(U.uInkEnd, st.inkEnd != null ? st.inkEnd : st.ink);
        gl.uniform1f(U.uPress, st.press || 0); gl.uniform1f(U.uDry0, st.dry0 || 0); gl.uniform1f(U.uDry1, st.dry1 || 1);
        gl.uniform1f(U.uDryMax, st.dryMax || 0); gl.uniform1f(U.uBristles, st.bristles || 12); gl.uniform1f(U.uFray, st.fray || 0); gl.uniform1f(U.uFork, st.fork || 0); gl.uniform1f(U.uStreak, st.streak != null ? st.streak : 0.28); gl.uniform1f(U.uFadeIn, st.fadeIn || 0); gl.uniform1f(U.uBloom, st.bloom || 0); gl.uniform1f(U.uLoad, st.load || 0); gl.uniform1f(U.uLoadDir, st.loadDir || 1); gl.uniform1f(U.uEntry, st.entry || 0);
        gl.uniform1f(U.uWet, st.wet || 0); gl.uniform1f(U.uHalo, st.halo || 0); gl.uniform1f(U.uRim, st.rim || 0);
        gl.uniform1f(U.uCenter, st.center || 0); gl.uniform1f(U.uSide, st.side || 0); gl.uniform1f(U.uSeed, st.seed || 1);
        gl.uniform1f(U.uBlur, st.blur || 1);
        gl.uniform4fv(U.uP0, d.p0 || [0, 0, 0, 0]); gl.uniform4fv(U.uP1, d.p1 || [0, 0, 0, 0]);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, d.rib.count);
      }
      gl.disable(gl.BLEND);
      if (prof) { gl.finish(); prof.ink = performance.now() - T0; }
      // composite
      gl.bindFramebuffer(gl.FRAMEBUFFER, compF); gl.viewport(0, 0, W, H);
      gl.useProgram(progComp.p);
      const C = progComp.u;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, inkT); gl.uniform1i(C.uInk, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, paperT); gl.uniform1i(C.uPaper, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, auxT); gl.uniform1i(C.uAux, 2); gl.activeTexture(gl.TEXTURE0);
      gl.uniform2f(C.uRes, W, H); gl.uniform1f(C.uScale, scale);
      const rs = rings(t);
      const rv = new Float32Array(32); rs.forEach((r, i) => rv.set(r, i * 4));
      gl.uniform4fv(C.uRing, rv); gl.uniform1i(C.uNR, rs.length);
      gl.uniform3fv(C.uKB, K_BLACK); gl.uniform3fv(C.uKV, K_VERM);
      fullscreen();
      if (prof) { gl.finish(); prof.comp = performance.now() - T0 - prof.ink; }
      // final: downsample + encode to the canvas
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, outW, outH);
      gl.useProgram(progFinal.p);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, compT);
      gl.uniform1i(progFinal.u.uSrc, 0); gl.uniform1i(progFinal.u.uSS, ss); gl.uniform2f(progFinal.u.uOutRes, outW, outH);
      fullscreen();
    }
    function readRGBA() {
      const px = new Uint8Array(outW * outH * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.readPixels(0, 0, outW, outH, gl.RGBA, gl.UNSIGNED_BYTE, px);
      return px; // bottom-up rows
    }
    return { render, readRGBA, gl, W, H };
  }

  function b64(bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }

  /* ------------------------------------------------------------------ */
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('c');
  if (params.has('export')) {
    let R = null;
    window.__piece = {
      LOOP, FPS: 30, events: EVENTS,
      init(opts) { opts = opts || {}; R = Renderer(canvas, opts.width || 1080, opts.height || 1350, opts.ss || 1); return true; },
      renderAt(t, opts) { if (!R) this.init(opts); R.render(t); R.gl.finish(); return true; },
      profile(t) { const p = {}; const a = performance.now(); R.render(t, p); R.gl.finish(); p.total = performance.now() - a; const b = performance.now(); this.pixels(); p.read = performance.now() - b; return p; },
      pixels() { return b64(R.readRGBA()); },
    };
  } else {
    const fitW = Math.min(1080, Math.round(Math.min(window.innerWidth, window.innerHeight * 0.8) * (window.devicePixelRatio || 1)));
    const w = Math.max(200, fitW - (fitW % 4)), h = Math.round(w * 1.25);
    const R = Renderer(canvas, w, h, 1);
    window.__piece = { renderAt(t) { R.render(t); } };
    if (params.has('t')) {
      R.render(parseFloat(params.get('t')) || 0);
    } else {
      let start = null;
      const frame = (now) => { if (start === null) start = now; R.render(((now - start) / 1000) % LOOP); requestAnimationFrame(frame); };
      requestAnimationFrame(frame);
    }
  }
})();
