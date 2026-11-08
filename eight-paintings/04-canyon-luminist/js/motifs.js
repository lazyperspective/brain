// Motifs painted last, directly with the brush: the gnarled juniper on the ledge, the small
// figure at the brink, and ravens riding the air over the chasm. Coordinates are designed in
// picture space (fractions of width/height) so the composition is explicit.
(function (G) {
  'use strict';
  const { makeRng, makeNoise, clamp, mix, smooth } = G.CORE;

  function paintMotifs(P) {
    const { W, H, S, stroke, C, Hh } = P;
    const rng = makeRng(5150);
    const NZ = makeNoise(31);
    const sunX = 0.30 * W, sunY = 0.215 * H;
    const px = (fx) => fx * W, py = (fy) => fy * H;

    function lightDir(x, y) {
      let lx = sunX - x, ly = sunY - y;
      const l = Math.hypot(lx, ly); return [lx / l, ly / l];
    }
    function sampleC(x, y) {
      const k = (clamp(y | 0, 0, H - 1) * W + clamp(x | 0, 0, W - 1)) * 3;
      return [C[k], C[k + 1], C[k + 2]];
    }
    const opt = (o) => Object.assign({ opacity: 0.95, soft: 0.3, bristleDensity: 0.9, bristleContrast: 0.35, dry: 0.3, thick: 0.5, pickup: 0.05 }, o);

    // ---------------------------------------------------------------- the sun: a disc of loaded paint
    {
      const sx = sunX, sy = sunY, R0 = 21 * S;
      // the disc: overlapping dabs of pale, lightly loaded paint (no hard rim)
      for (let i = 0; i < 9; i++) {
        const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * R0 * 0.38;
        stroke([sx + Math.cos(a) * rr, sy + Math.sin(a) * rr], R0 * (0.55 + 0.1 * rng()), [1.0, 0.985, 0.93],
          opt({ opacity: 0.85, soft: 0.6, bristleContrast: 0.0, thick: 0.45, dry: 0 }));
      }
    }

    // ---------------------------------------------------------------- the ledge, up close
    // cracks with a lit lip, scattered stones, lichen: the crisp foreground detail
    {
      const isFG = (x, y) => P.mat[clamp(y | 0, 0, H - 1) * W + clamp(x | 0, 0, W - 1)] === 3;
      const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      // cracks
      for (let i = 0, made = 0; i < 4000 && made < 0; i++) {
        let x = rng() * W, y = py(0.8 + rng() * 0.2);
        if (!isFG(x, y)) continue;
        made++;
        const pts = [x, y];
        let a = (rng() - 0.5) * 0.35;
        const n = 5 + (rng() * 14 | 0);
        for (let k = 0; k < n; k++) {
          a += (rng() - 0.5) * 0.3;
          x += Math.cos(a) * 16 * S; y += Math.sin(a) * 5 * S;
          if (!isFG(x, y)) break;
          pts.push(x, y);
        }
        if (pts.length < 6) continue;
        const c = sampleC(pts[0], pts[1]);
        const w = (0.8 + rng() * 1.4) * S;
        stroke(pts, w, [c[0] * 0.32, c[1] * 0.3, c[2] * 0.3], opt({ opacity: 0.85, soft: 0.4, thick: 0.2, dry: 0.5 }));
        const lip = pts.map((v, j) => (j % 2 ? v - w * 1.8 : v));
        stroke(lip, w * 0.6, [Math.min(1, c[0] * 1.35 + 0.05), Math.min(1, c[1] * 1.3 + 0.04), Math.min(1, c[2] * 1.2 + 0.02)],
          opt({ opacity: 0.55, soft: 0.5, thick: 0.9, dry: 0.7 }));
      }
      // broad tonal variation: soft glazes so the rock surface is never one flat tone
      for (let i = 0, made = 0; i < 3000 && made < 70; i++) {
        const x = rng() * W, y = py(0.8 + rng() * 0.2);
        if (!isFG(x, y)) continue;
        made++;
        const c = sampleC(x, y);
        const k = 0.86 + rng() * 0.26, warm = (rng() - 0.5) * 0.06;
        const L = (40 + rng() * 120) * S, a = (rng() - 0.5) * 0.4;
        stroke([x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.4], (12 + rng() * 22) * S, [c[0] * k + warm, c[1] * k, c[2] * k - warm],
          opt({ opacity: 0.28, soft: 0.85, bristleContrast: 0.5, thick: 0.3, dry: 0.6 }));
      }
      // joints and cracks: irregular, tapering, with a lit lip on the sun side
      for (let i = 0, made = 0; i < 4000 && made < 0; i++) {
        let x = rng() * W, y = py(0.81 + rng() * 0.19);
        if (!isFG(x, y)) continue;
        const pts = [x, y];
        let a = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.5;
        const n = 6 + (rng() * 12 | 0);
        for (let k = 0; k < n; k++) {
          a += (rng() - 0.5) * 0.7;
          x += Math.cos(a) * 13 * S; y += Math.sin(a) * 4.5 * S;
          if (!isFG(x, y)) break;
          pts.push(x, y);
        }
        if (pts.length < 8) continue;
        made++;
        const np = pts.length / 2;
        const wid = []; for (let k = 0; k < np; k++) wid.push(0.35 + 0.9 * Math.sin(Math.PI * k / (np - 1)) * (0.7 + 0.5 * rng()));
        const c = sampleC(pts[0], pts[1]);
        const w = (1.4 + rng() * 1.8) * S;
        stroke(pts, w, [c[0] * 0.28, c[1] * 0.25, c[2] * 0.26], Object.assign(opt({ opacity: 0.85, soft: 0.35, thick: 0.15, dry: 0.4 }), { widths: wid }));
        const lip = pts.map((v, j) => (j % 2 ? v - w * 1.6 : v - w * 0.4));
        stroke(lip, w * 0.55, [Math.min(1, c[0] * 1.3 + 0.05), Math.min(1, c[1] * 1.25 + 0.04), Math.min(1, c[2] * 1.15 + 0.02)],
          Object.assign(opt({ opacity: 0.5, soft: 0.5, thick: 0.9, dry: 0.7 }), { widths: wid }));
      }
      // a few boulders resting on the ledge, each with its cast shadow
      for (let i = 0, made = 0; i < 4000 && made < 0; i++) {
        const x = px(0.6 + rng() * 0.4), y = py(0.82 + rng() * 0.16);
        if (!isFG(x, y) || !isFG(x + 30 * S, y + 20 * S) || !isFG(x - 30 * S, y)) continue;
        if (Math.hypot(x - px(0.872), (y - py(0.94)) * 1.5) < 120 * S) continue;
        made++;
        const r = (14 + rng() * 24) * S;
        const c = sampleC(x, y);
        stroke([x + r * 0.3, y + r * 0.35, x + r * 2.2, y + r * 0.7], r * 0.55, [c[0] * 0.42, c[1] * 0.4, c[2] * 0.46], opt({ opacity: 0.55, soft: 0.8, thick: 0.05 }));
        for (let q = 0; q < 7; q++) {
          const ox = (rng() - 0.5) * r * 0.9, oy = (rng() - 0.5) * r * 0.5;
          const up = -oy / r + 0.2;
          const v = clamp(0.5 + up - ox / r * 0.6, 0, 1);
          const col = [mix(c[0] * 0.45, Math.min(1, c[0] * 1.4 + 0.08), v), mix(c[1] * 0.42, Math.min(1, c[1] * 1.32 + 0.06), v), mix(c[2] * 0.45, Math.min(1, c[2] * 1.15 + 0.03), v)];
          stroke([x + ox - r * 0.25, y + oy, x + ox + r * 0.25, y + oy + r * 0.05], r * (0.25 + 0.25 * rng()), col, opt({ opacity: 0.9, soft: 0.35, thick: 0.6 + v, dry: 0.4 }));
        }
        stroke([x - r * 0.55, y + r * 0.42, x + r * 0.6, y + r * 0.46], r * 0.12, [c[0] * 0.25, c[1] * 0.22, c[2] * 0.24], opt({ opacity: 0.8, soft: 0.5, thick: 0.1 }));
      }
      // low desert shrubs: grey-green, dark at the base, backlit at the rim
      for (let i = 0, made = 0; i < 4000 && made < 0; i++) {
        const x = px(0.58 + rng() * 0.42), y = py(0.81 + rng() * 0.17);
        if (!isFG(x, y)) continue;
        made++;
        const r = (10 + rng() * 18) * S;
        const [lx, ly] = lightDir(x, y);
        for (let q = 0; q < r * r / (3 * S * S); q++) {
          const a = rng() * Math.PI * 2, rr = Math.sqrt(rng());
          const ox = Math.cos(a) * rr * r * 1.2, oy = Math.sin(a) * rr * r * 0.7 - r * 0.3;
          const f = clamp((Math.cos(a) * lx + Math.sin(a) * ly) * rr, -1, 1);
          const col = f > 0.62 ? [0.58, 0.52, 0.30] : f > 0.05 ? [0.22, 0.23, 0.15] : [0.085, 0.095, 0.065];
          stroke([x + ox, y + oy, x + ox + (rng() - 0.5) * 4 * S, y + oy - 3 * S], (1.0 + rng() * 1.6) * S, col, opt({ opacity: 0.9, soft: 0.45, thick: f > 0.62 ? 1.2 : 0.5, dry: 0.6 }));
        }
      }
      // stones and pebbles
      for (let i = 0, made = 0; i < 6000 && made < 170; i++) {
        const x = rng() * W, y = py(0.79 + rng() * 0.21);
        if (!isFG(x, y) || !isFG(x, y + 8 * S)) continue;
        made++;
        const r = (2 + Math.pow(rng(), 2.5) * 11) * S * (0.6 + 0.6 * (y / H - 0.79) / 0.21);
        const c = sampleC(x, y);
        const tone = 0.8 + rng() * 0.45;
        stroke([x + r * 0.5, y + r * 0.45, x + r * 1.6, y + r * 0.6], r * 0.7, [c[0] * 0.45, c[1] * 0.43, c[2] * 0.45], opt({ opacity: 0.5, soft: 0.7, thick: 0.05 }));
        stroke([x - r * 0.3, y, x + r * 0.3, y + r * 0.1], r * 0.75, [c[0] * tone * 0.85, c[1] * tone * 0.82, c[2] * tone * 0.8], opt({ opacity: 0.95, soft: 0.35, thick: 0.9 }));
        stroke([x - r * 0.45, y - r * 0.35, x, y - r * 0.45], r * 0.32, [Math.min(1, c[0] * 1.45 + 0.06), Math.min(1, c[1] * 1.35 + 0.05), Math.min(1, c[2] * 1.2 + 0.03)], opt({ opacity: 0.8, soft: 0.45, thick: 1.4 }));
      }
      // lichen
      for (let i = 0, made = 0; i < 6000 && made < 260; i++) {
        const x = rng() * W, y = py(0.79 + rng() * 0.21);
        if (!isFG(x, y)) continue;
        made++;
        const c = sampleC(x, y);
        const l = lum(c);
        const kind = rng();
        const col = kind < 0.45 ? [0.62 * (0.6 + l), 0.34 * (0.6 + l), 0.12 * (0.6 + l)] : kind < 0.8 ? [0.50 * (0.5 + l), 0.52 * (0.5 + l), 0.42 * (0.5 + l)] : [c[0] * 0.5, c[1] * 0.5, c[2] * 0.5];
        const r = (1 + rng() * 3) * S;
        stroke([x, y, x + (rng() - 0.5) * 6 * S, y + (rng() - 0.5) * 2 * S], r, col, opt({ opacity: 0.6, soft: 0.6, thick: 0.4, dry: 0.8 }));
      }
    }

    // ---------------------------------------------------------------- juniper
    // The tree is drawn like a painter would: a designed skeleton (trunk and main limbs placed in
    // picture space), wobbled and twisted; twigs and foliage grown from it. Bark is painted as
    // fibres spiralling round each limb, lit on the side facing the low sun; foliage as dense
    // olive masses with a backlit golden rim.
    {
    const rng = makeRng(8080);
    const limbs = [];
    const masses = [];
    function spline(ctrl, step) {
      // Catmull-Rom through picture-space control points (fractions), sampled every `step` px
      const P2 = ctrl.map(([fx, fy]) => [fx * W, fy * H]);
      const out = [];
      for (let i = 0; i < P2.length - 1; i++) {
        const p0 = P2[Math.max(0, i - 1)], p1 = P2[i], p2 = P2[i + 1], p3 = P2[Math.min(P2.length - 1, i + 2)];
        const segL = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const n = Math.max(2, Math.round(segL / step));
        for (let k = 0; k < n; k++) {
          const t = k / n, t2 = t * t, t3 = t2 * t;
          const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
          out.push(f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]));
        }
      }
      const last = P2[P2.length - 1]; out.push(last[0], last[1]);
      return out;
    }
    function addLimb(ctrl, r0, r1, kind, depth, opts) {
      const pts = spline(ctrl, 7 * S);
      const n = pts.length / 2;
      // gnarl: displace sideways with low-frequency noise proportional to thickness
      const seed = rng() * 50;
      for (let i = 1; i < n; i++) {
        const ax = pts[Math.max(0, i - 1) * 2], ay = pts[Math.max(0, i - 1) * 2 + 1];
        const bx = pts[Math.min(n - 1, i + 1) * 2], by = pts[Math.min(n - 1, i + 1) * 2 + 1];
        const l = Math.hypot(bx - ax, by - ay) || 1;
        const w = NZ.n2(i * 0.18 + seed, seed) * (r0 * 0.5 + 6 * S) * Math.min(1, i / 6);
        pts[i * 2] += (-(by - ay) / l) * w; pts[i * 2 + 1] += ((bx - ax) / l) * w;
      }
      const rad = [];
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        rad.push(mix(r0, r1, Math.pow(t, 0.85)) * W * (1 + 0.12 * NZ.n2(i * 0.3 + seed, 3.3)));
      }
      const L = Object.assign({ pts, rad, kind, depth }, opts || {});
      limbs.push(L);
      return L;
    }
    function twigs(L, count, lenPx, toward) {
      const n = L.pts.length / 2;
      for (let c = 0; c < count; c++) {
        const q = Math.round(n * (0.3 + 0.65 * rng()));
        const x0 = L.pts[q * 2], y0 = L.pts[q * 2 + 1];
        const tx = toward ? toward[0] * W : x0, ty = toward ? toward[1] * H : y0 - lenPx;
        let a = Math.atan2(ty - y0, tx - x0) + (rng() - 0.5) * 1.3;
        const ctrl = [[x0 / W, y0 / H]];
        let x = x0, y = y0;
        const segs = 3;
        for (let k = 0; k < segs; k++) {
          a += (rng() - 0.5) * 0.8;
          x += Math.cos(a) * lenPx / segs * (0.7 + rng() * 0.6); y += Math.sin(a) * lenPx / segs * (0.7 + rng() * 0.6);
          ctrl.push([x / W, y / H]);
        }
        const r0 = Math.max(1.4 * S, L.rad[q] * 0.45) / W;
        addLimb(ctrl, r0, r0 * 0.3, L.kind === 'dead' || rng() < 0.15 ? 'dead' : 'live', L.depth + 1);
        if (L.kind !== 'dead') masses.push({ x, y, r: (34 + rng() * 30) * S });
      }
    }
    // trunk and main limbs (fractions of width/height; radii as fraction of width)
    const rootX = px(0.872), rootY = py(0.94);
    const trunk = addLimb([[0.872, 0.94], [0.862, 0.90], [0.846, 0.86], [0.836, 0.825], [0.822, 0.792]], 0.034, 0.02, 'live', 0, { trunk: true });
    const armL = addLimb([[0.826, 0.80], [0.79, 0.772], [0.745, 0.757], [0.70, 0.736], [0.655, 0.722], [0.612, 0.70]], 0.0155, 0.0022, 'dead', 1);
    const up = addLimb([[0.824, 0.796], [0.815, 0.755], [0.796, 0.715], [0.79, 0.67], [0.772, 0.632]], 0.0135, 0.0018, 'dead', 1);
    const snag = addLimb([[0.836, 0.81], [0.858, 0.762], [0.872, 0.718], [0.893, 0.68], [0.905, 0.648]], 0.0105, 0.0016, 'dead', 1);
    const armR = addLimb([[0.832, 0.79], [0.862, 0.768], [0.89, 0.752], [0.915, 0.735], [0.935, 0.712]], 0.0105, 0.003, 'live', 1);
    const low = addLimb([[0.853, 0.875], [0.825, 0.868], [0.80, 0.874], [0.78, 0.884]], 0.007, 0.0015, 'dead', 2);
    // the one living strip carries a dense, ragged crown to the right; a smaller tuft lower down
    for (const [fx, fy, r] of [[0.922, 0.702, 58], [0.948, 0.690, 50], [0.895, 0.716, 46], [0.935, 0.722, 44], [0.958, 0.708, 36],
      [0.905, 0.688, 36], [0.868, 0.742, 30]]) masses.push({ x: px(fx), y: py(fy), r: r * S * 1.3 });
    // broken-off stubs along the trunk and main limbs
    for (const [L, t, ang, len] of [[trunk, 0.45, -0.4, 50], [trunk, 0.7, Math.PI + 0.3, 40], [armL, 0.35, -1.9, 45], [up, 0.5, -0.2, 35], [armL, 0.65, -1.4, 30]]) {
      const q = Math.round((L.pts.length / 2 - 1) * t);
      const x0 = L.pts[q * 2], y0 = L.pts[q * 2 + 1];
      const x1 = x0 + Math.cos(ang) * len * S, y1 = y0 + Math.sin(ang) * len * S;
      addLimb([[x0 / W, y0 / H], [(x0 + x1) / 2 / W, (y0 + y1) / 2 / H + 0.002], [x1 / W, y1 / H]], L.rad[q] * 0.42 / W, L.rad[q] * 0.3 / W, 'dead', 2);
    }
    twigs(armL, 6, 80 * S, null);
    twigs(up, 5, 70 * S, null);
    twigs(armR, 4, 55 * S, null);
    twigs(snag, 4, 70 * S, null);

    // the tree's shadow falls toward us and to the right across the ledge (a cool glaze)
    for (let i = 0; i < 220; i++) {
      const t = rng();
      const x = rootX + (10 + 380 * t) * S + (rng() - 0.5) * 50 * S * t;
      const y = rootY + (4 + 110 * t) * S + (rng() - 0.5) * 60 * S * (0.25 + t);
      if (y > H || x > W || P.mat[(clamp(y | 0, 0, H - 1)) * W + clamp(x | 0, 0, W - 1)] !== 3) continue;
      const c = sampleC(x, y);
      stroke([x - 26 * S, y - 9 * S, x + 26 * S, y + 9 * S], (8 + rng() * 12) * S, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.72],
        opt({ opacity: 0.22, soft: 0.85, bristleContrast: 0.15, thick: 0.05 }));
    }
    // roots gripping the rock
    for (let i = 0; i < 7; i++) {
      const dir = i % 2 ? 1 : -1;
      const x0 = rootX + dir * (24 + rng() * 30) * S, y0 = rootY - 10 * S;
      const ctrl = [[x0 / W, y0 / H]];
      let x = x0, y = y0, a = (dir > 0 ? 0.3 : Math.PI - 0.3) + (rng() - 0.5) * 0.5;
      for (let k = 0; k < 4; k++) { a += (rng() - 0.5) * 0.5; x += Math.cos(a) * 34 * S; y += Math.sin(a) * 10 * S + 7 * S; ctrl.push([x / W, y / H]); }
      addLimb(ctrl, (12 + rng() * 10) * S / W, 1.5 * S / W, 'live', 1, { root: true });
    }

    function paintLimb(L) {
      const { pts, rad } = L;
      const n = pts.length / 2;
      const dead = L.kind === 'dead';
      const r0 = rad[0];
      const wid = rad.map((r) => r / r0);
      // palettes: shadowed bark, warm bounce from the rock, light-struck rim
      const shC = dead ? [0.16, 0.14, 0.135] : [0.075, 0.055, 0.042];
      const bnC = dead ? [0.36, 0.30, 0.26] : [0.20, 0.12, 0.075];
      const ltC = dead ? [0.98, 0.86, 0.64] : [0.90, 0.62, 0.34];
      stroke(pts, r0, shC, Object.assign(opt({ opacity: 1, soft: 0.15, bristleContrast: 0.25, thick: 0.7, dry: 0.05 }), { widths: wid }));
      // normals along the limb
      const NX = new Float32Array(n), NY = new Float32Array(n), SL = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const ax = pts[Math.max(0, i - 1) * 2], ay = pts[Math.max(0, i - 1) * 2 + 1];
        const bx = pts[Math.min(n - 1, i + 1) * 2], by = pts[Math.min(n - 1, i + 1) * 2 + 1];
        const l = Math.hypot(bx - ax, by - ay) || 1;
        NX[i] = -(by - ay) / l; NY[i] = (bx - ax) / l;
        const [lx, ly] = lightDir(pts[i * 2], pts[i * 2 + 1]);
        SL[i] = NX[i] * lx + NY[i] * ly;
      }
      // cylinder modelling: longitudinal bands across the limb, backlit (light from behind)
      const nb = Math.max(3, Math.min(14, Math.round(r0 / (3.2 * S))));
      for (let bI = 0; bI < nb; bI++) {
        const t = ((bI + 0.5) / nb) * 2 - 1; // -1..1 across
        const st = Math.sin(Math.asin(clamp(t, -0.99, 0.99)));
        let run = [], runW = [], vs = 0, cnt = 0;
        const flush = () => {
          if (run.length >= 4) {
            const v = vs / cnt;
            const lit = clamp(v, 0, 1), bnc = clamp(-v, 0, 1);
            let c = [mix(shC[0], ltC[0], lit), mix(shC[1], ltC[1], lit), mix(shC[2], ltC[2], lit)];
            c = [mix(c[0], bnC[0], bnc * 0.7), mix(c[1], bnC[1], bnc * 0.7), mix(c[2], bnC[2], bnc * 0.7)];
            const j = 0.85 + rng() * 0.3; c = [c[0] * j, c[1] * j, c[2] * j];
            const bw = Math.max(0.7 * S, r0 / nb * 1.15);
            stroke(run, bw, c, Object.assign(opt({ opacity: 0.85, soft: 0.5, bristleContrast: 0.55, thick: 0.4 + 1.6 * lit * lit, dry: 0.55 }), { widths: runW.map((w) => w / bw) }));
          }
          run = []; runW = []; vs = 0; cnt = 0;
        };
        for (let i = 0; i < n; i++) {
          const wob = 0.12 * Math.sin(i * 0.6 + bI * 1.7);
          const off = (t + wob / nb) * rad[i] * 0.9;
          const side = Math.sign(SL[i]) || 1;
          // backlit: only the margin turned toward the sun is lit; the opposite margin gets bounce
          const facing = st * side * Math.min(1, Math.abs(SL[i]) * 2 + 0.25);
          const v = facing > 0 ? smooth(0.45, 0.95, facing) : -smooth(0.5, 1.0, -facing) * 0.8;
          run.push(pts[i * 2] + NX[i] * off, pts[i * 2 + 1] + NY[i] * off);
          runW.push(Math.max(0.7 * S, rad[i] / nb * 1.15));
          vs += v; cnt++;
          if (run.length > 6 && rng() < 0.1) { flush(); }
        }
        flush();
      }
      // twisted bark: dark grooves spiralling round the limb
      const nf = Math.max(1, Math.min(16, Math.round(r0 / (4.5 * S))));
      const twist = (L.root ? 0.004 : 0.012) / S;
      for (let f = 0; f < nf; f++) {
        const phi0 = (f / nf) * Math.PI * 2 + rng() * 0.6;
        let run = [], s = 0;
        const flush = () => {
          if (run.length >= 6) stroke(run, Math.max(0.5 * S, r0 * 0.035), [shC[0] * 0.6, shC[1] * 0.6, shC[2] * 0.6], opt({ opacity: 0.7, soft: 0.4, bristleContrast: 0.5, thick: 0.2, dry: 0.6 }));
          run = [];
        };
        for (let i = 0; i < n; i++) {
          if (i > 0) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
          const phi = phi0 + twist * s;
          if (Math.cos(phi) < 0.15) { flush(); continue; }
          const off = Math.sin(phi) * rad[i] * 0.88;
          run.push(pts[i * 2] + NX[i] * off, pts[i * 2 + 1] + NY[i] * off);
          if (run.length > 10 && rng() < 0.08) flush();
        }
        flush();
      }
      // a broken, splintered end on thick dead limbs
      if (dead && L.depth <= 1 && rad[n - 1] > 2.5 * S) {
        const ex = pts[n * 2 - 2], ey = pts[n * 2 - 1];
        stroke([ex, ey], rad[n - 1] * 1.1, [0.85, 0.75, 0.58], opt({ opacity: 0.8, soft: 0.5, thick: 1.0 }));
      }
    }
    // far, thin limbs first; trunk and roots last
    limbs.sort((a, b) => b.depth - a.depth || (a.trunk ? 1 : 0) - (b.trunk ? 1 : 0));
    for (const L of limbs) if (!L.trunk) paintLimb(L);

    // foliage: juniper sprays built from irregular tufts; dark olive cores, sky-lit tops,
    // a light-struck rim where the low sun comes through from behind, ragged sprigs at the edges
    masses.sort((a, b) => a.y - b.y);
    for (const cl of masses) {
      const R = cl.r, cx = cl.x, cy = cl.y;
      const [lx, ly] = lightDir(cx, cy);
      const nt = 4 + (rng() * 5 | 0);
      const tufts = [];
      for (let t = 0; t < nt; t++) {
        const a = rng() * Math.PI * 2, q = Math.sqrt(rng()) * 0.75;
        tufts.push([cx + Math.cos(a) * q * R * 1.15, cy + Math.sin(a) * q * R * 0.55, R * (0.35 + 0.35 * rng()), 0.45 + 0.25 * rng()]);
      }
      tufts.sort((a, b) => a[1] - b[1]);
      for (const [tx, ty, tr, asp] of tufts) {
        const nd = Math.round((tr * tr * asp) / (2.2 * S * S));
        const seed = rng() * 100;
        for (let i = 0; i < nd; i++) {
          const a = rng() * Math.PI * 2, rr = Math.pow(rng(), 0.55);
          const ox = Math.cos(a) * rr * tr, oy = Math.sin(a) * rr * tr * asp;
          const edge = NZ.fbm((tx + ox) / (12 * S) + seed, (ty + oy) / (12 * S), 3);
          if (rr > 0.78 + 0.45 * edge) continue;
          const x = tx + ox, y = ty + oy;
          // tuft-local facing + whole-mass facing; tops catch sky light
          const fT = (Math.cos(a) * lx + Math.sin(a) * ly) * rr;
          const fM = ((x - cx) * lx + (y - cy) * ly) / (R * 1.1);
          const f = 0.55 * fT + 0.65 * fM;
          const top = clamp(-Math.sin(a) * rr, 0, 1);
          let c;
          if (f > 0.55) { const q = smooth(0.55, 1.0, f); c = [mix(0.32, 0.92, q), mix(0.30, 0.70, q), mix(0.12, 0.30, q)]; }
          else c = [mix(0.05, 0.13, top * 0.8 + 0.2 * (f + 1) / 2), mix(0.06, 0.15, top * 0.8 + 0.2 * (f + 1) / 2), mix(0.045, 0.10, top * 0.8)];
          const j = 0.8 + rng() * 0.4; c = [c[0] * j, c[1] * j * (0.95 + 0.1 * rng()), c[2] * j];
          // a scale-leaf spray: a short curved flick, splaying outward
          const sa = Math.atan2(oy, ox) * 0.6 - 0.5 + (rng() - 0.5) * 1.2;
          const Ls = (2.5 + rng() * 6) * S;
          const mx = x + Math.cos(sa) * Ls * 0.5 + (rng() - 0.5) * 1.5 * S, my = y + Math.sin(sa) * Ls * 0.4;
          stroke([x, y, mx, my, x + Math.cos(sa + 0.3) * Ls, y + Math.sin(sa + 0.3) * Ls * 0.7], (0.8 + rng() * 1.5) * S, c,
            Object.assign(opt({ opacity: 0.9, soft: 0.5, bristleContrast: 0.4, thick: f > 0.55 ? 1.4 : 0.45, dry: 0.65 }), { widths: [1, 0.8, 0.3] }));
        }
        // ragged sprigs at the tuft's silhouette, lit when they face the sun
        for (let i = 0; i < Math.round(tr / (2.5 * S)); i++) {
          const a = rng() * Math.PI * 2;
          const x = tx + Math.cos(a) * tr * 0.95, y = ty + Math.sin(a) * tr * asp * 0.95;
          const f = Math.cos(a) * lx + Math.sin(a) * ly;
          const c = f > 0.4 ? [0.85, 0.66, 0.32] : [0.07, 0.08, 0.055];
          const L2 = (3 + rng() * 6) * S;
          stroke([x, y, x + Math.cos(a) * L2, y + Math.sin(a) * L2 * 0.8], 0.6 * S, c, Object.assign(opt({ opacity: 0.85, soft: 0.5, thick: f > 0.4 ? 1.1 : 0.3, dry: 0.7 }), { widths: [1, 0.4] }));
        }
      }
    }
    // the trunk and roots are painted over the lower foliage
    for (const L of limbs) if (L.trunk || L.root) paintLimb(L);

    // dry grass and small shrubs catching the light along the ledge brink and around the roots
    {
      const isFG = (x, y) => P.mat[clamp(y | 0, 0, H - 1) * W + clamp(x | 0, 0, W - 1)] === 3;
      let placed = 0;
      for (let tries = 0; tries < 9000 && placed < 34; tries++) {
        const x = px(0.55 + rng() * 0.45), y = py(0.78 + rng() * 0.2);
        if (!isFG(x, y)) continue;
        const brink = !isFG(x, y - 10 * S) || !isFG(x - 14 * S, y);
        const nearRoot = Math.hypot(x - rootX, (y - rootY) * 2) < 180 * S;
        if (!brink && !(nearRoot && rng() < 0.3)) continue;
        placed++;
        const depthK = clamp((y / H - 0.79) / 0.16, 0, 1); // nearer the bottom = closer = larger
        const nb = 6 + (rng() * 12 | 0), hgt = (5 + rng() * 7 + depthK * 12) * S;
        for (let b = 0; b < nb; b++) {
          const ang = -Math.PI / 2 + (rng() - 0.5) * 1.3;
          const hh = hgt * (0.5 + rng() * 0.6);
          const bx = x + (rng() - 0.5) * 8 * S;
          const ex = bx + Math.cos(ang) * hh, ey = y + Math.sin(ang) * hh;
          const mx = (bx + ex) / 2 + (rng() - 0.5) * 4 * S, my = (y + ey) / 2;
          const lit = rng() < 0.55;
          const c = lit ? [0.78 + rng() * 0.1, 0.60 + rng() * 0.1, 0.34 + rng() * 0.08] : [0.26, 0.21, 0.12];
          stroke([bx, y, mx, my, ex, ey], 0.6 * S, c, Object.assign(opt({ opacity: 0.6, soft: 0.4, thick: lit ? 1.0 : 0.4, dry: 0.7 }), { widths: [1.2, 0.9, 0.35] }));
        }
      }
    }

    }
    // ---------------------------------------------------------------- figure at the brink
    {
      const fx = px(0.598), fy = py(0.811); // feet
      const h = 52 * S;
      const [lx] = lightDir(fx, fy - h * 0.5);
      const ink = [0.07, 0.055, 0.05];
      // cast shadow on the rock, away from the sun (to the right, slightly up)
      stroke([fx + 2 * S, fy + 1 * S, fx + 30 * S, fy - 4 * S], 2.2 * S, [0.12, 0.09, 0.08], opt({ opacity: 0.55, soft: 0.6, thick: 0.1 }));
      // legs
      stroke([fx - 3 * S, fy, fx - 2 * S, fy - h * 0.42], 2.4 * S, ink, opt({ thick: 0.6 }));
      stroke([fx + 3 * S, fy, fx + 2 * S, fy - h * 0.42], 2.4 * S, ink, opt({ thick: 0.6 }));
      // coat
      stroke([fx, fy - h * 0.36, fx - 0.5 * S, fy - h * 0.78], 6.0 * S, [0.10, 0.075, 0.065], opt({ thick: 0.7 }));
      // red blanket over the shoulder (the small warm accent)
      stroke([fx - 4 * S, fy - h * 0.74, fx + 4.5 * S, fy - h * 0.52], 2.6 * S, [0.62, 0.13, 0.07], opt({ thick: 0.9 }));
      // head & hat
      stroke([fx - 0.5 * S, fy - h * 0.86], 3.3 * S, [0.16, 0.10, 0.08], opt({ thick: 0.8 }));
      stroke([fx - 6 * S, fy - h * 0.92, fx + 5 * S, fy - h * 0.92], 1.4 * S, ink, opt({ thick: 0.6 }));
      stroke([fx - 1 * S, fy - h * 0.98], 2.8 * S, ink, opt({ thick: 0.6 }));
      // staff
      stroke([fx - 9 * S, fy + 1 * S, fx - 8 * S, fy - h * 1.02], 0.9 * S, [0.12, 0.09, 0.06], opt({ thick: 0.5 }));
      // rim light on the sun side
      const sd = lx < 0 ? -1 : 1;
      stroke([fx + sd * 5.2 * S, fy - h * 0.40, fx + sd * 5.0 * S, fy - h * 0.76], 0.9 * S, [0.95, 0.70, 0.40], opt({ opacity: 0.9, thick: 1.5 }));
      stroke([fx + sd * 2.6 * S, fy - h * 0.82, fx + sd * 2.6 * S, fy - h * 0.9], 0.8 * S, [0.98, 0.76, 0.48], opt({ opacity: 0.85, thick: 1.5 }));
      stroke([fx + sd * 2.6 * S, fy - 2 * S, fx + sd * 2.4 * S, fy - h * 0.38], 0.7 * S, [0.80, 0.55, 0.32], opt({ opacity: 0.7, thick: 1.2 }));
    }

    // ---------------------------------------------------------------- ravens over the chasm
    const birds = [[0.375, 0.512, 15, 0.1], [0.43, 0.493, 11, -0.15], [0.335, 0.545, 9, 0.25], [0.255, 0.455, 22, -0.05], [0.47, 0.525, 7, 0.3]];
    for (const [bx0, by0, sz, tilt] of birds) {
      const x = px(bx0), y = py(by0), s = sz * S;
      const c = sampleC(x, y);
      const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
      // value relative to the air they fly in: dark, but softened by distance for the small ones
      const k = mix(0.25, 0.55, smooth(20, 7, sz));
      const col = [c[0] * k, c[1] * k * 0.95, c[2] * k * 1.05];
      const ca = Math.cos(tilt), sa = Math.sin(tilt);
      const rot = (u, v) => [x + u * ca - v * sa, y + u * sa + v * ca];
      const L1 = rot(-s, -s * 0.18), L0 = rot(-s * 0.45, -s * 0.22), B0 = rot(0, 0), R0 = rot(s * 0.45, -s * 0.2), R1 = rot(s, -s * 0.05);
      stroke([L1[0], L1[1], L0[0], L0[1], B0[0], B0[1]], Math.max(0.6 * S, s * 0.11), col, opt({ opacity: 0.95, soft: 0.45, thick: 0.4 }));
      stroke([B0[0], B0[1], R0[0], R0[1], R1[0], R1[1]], Math.max(0.6 * S, s * 0.11), col, opt({ opacity: 0.95, soft: 0.45, thick: 0.4 }));
      stroke([B0[0], B0[1]], Math.max(0.7 * S, s * 0.12), col, opt({ opacity: 0.95, soft: 0.4, thick: 0.4 }));
      void lum;
    }
  }

  G.MOTIFS = { paintMotifs };
})(typeof window !== 'undefined' ? window : globalThis);
