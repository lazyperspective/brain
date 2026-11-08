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

    // ---------------------------------------------------------------- juniper
    // Skeleton: limbs as polylines with per-point radius. Bark: fibres spiralling around each
    // limb, lit on the side that faces the low sun. Foliage: dense olive sprays, backlit edges.
    const limbs = [];
    const clumps = [];
    function grow(x, y, ang, len, r0, depth, kind, curl) {
      const nseg = Math.max(4, Math.round(len / (10 * S)));
      const pts = [x, y], rad = [r0];
      let a = ang;
      const taper = kind === 'dead' ? 0.18 : 0.45;
      for (let i = 1; i <= nseg; i++) {
        a += (NZ.n2(i * 0.35 + depth * 7.3 + x * 0.01, y * 0.01) * 0.5 + curl) * (14 / nseg) * 0.6;
        x += Math.cos(a) * len / nseg; y += Math.sin(a) * len / nseg;
        pts.push(x, y);
        const t = i / nseg;
        rad.push(r0 * mix(1, taper, Math.pow(t, 0.8)) * (1 + 0.12 * Math.sin(i * 1.7 + depth)));
      }
      limbs.push({ pts, rad, kind, depth });
      if (kind === 'dead') {
        if (depth < 3 && len > 90 * S) {
          const q = Math.round(nseg * (0.5 + 0.3 * rng()));
          grow(pts[q * 2], pts[q * 2 + 1], a + (rng() < 0.5 ? -1 : 1) * (0.5 + 0.4 * rng()), len * 0.45, rad[q] * 0.6, depth + 1, 'dead', curl);
        }
        return;
      }
      if (depth >= 3 || len < 60 * S) {
        clumps.push({ x, y: y - 6 * S, r: (42 + rng() * 40) * S, depth });
        return;
      }
      const nk = 2 + (rng() < 0.45 ? 1 : 0);
      for (let c = 0; c < nk; c++) {
        const q = Math.max(2, Math.round(nseg * (0.45 + 0.5 * rng())));
        const side = c % 2 === 0 ? -1 : 1;
        const na = a + side * (0.4 + rng() * 0.55) - 0.25 * Math.sin(a + Math.PI / 2);
        grow(pts[q * 2], pts[q * 2 + 1], na, len * (0.48 + rng() * 0.22), rad[q] * (0.55 + rng() * 0.15), depth + 1, rng() < 0.1 ? 'dead' : 'live', curl * 0.7);
      }
      const q = Math.round(nseg * (0.6 + 0.3 * rng()));
      clumps.push({ x: pts[q * 2], y: pts[q * 2 + 1] - 12 * S, r: (40 + rng() * 40) * S, depth });
    }
    const rootX = px(0.80), rootY = py(0.925);
    {
      // the trunk: short, massive, writhing
      const pts = [rootX, rootY], rad = [66 * S];
      let x = rootX, y = rootY, a = -Math.PI / 2 - 0.3;
      for (let i = 1; i <= 26; i++) {
        a += Math.sin(i * 0.55) * 0.08 - 0.012;
        x += Math.cos(a) * 11 * S; y += Math.sin(a) * 11 * S;
        pts.push(x, y); rad.push(66 * S * mix(1, 0.62, i / 26) * (1 + 0.08 * Math.sin(i * 1.3)));
      }
      limbs.push({ pts, rad, kind: 'live', depth: 0, trunk: true });
      grow(x, y, -Math.PI + 0.45, 380 * S, 32 * S, 1, 'live', 0.05);     // long arm over the abyss
      grow(x, y, -Math.PI / 2 - 0.42, 290 * S, 30 * S, 1, 'live', -0.02); // up and left
      grow(x + 8 * S, y, -Math.PI / 2 + 0.3, 250 * S, 27 * S, 1, 'live', 0.03); // up and right
      grow(pts[40], pts[41], -Math.PI + 0.75, 420 * S, 15 * S, 1, 'dead', -0.035); // bleached snag reaching up and out
      grow(pts[20], pts[21], -0.45, 200 * S, 18 * S, 2, 'live', 0.04);
    }

    // the tree's shadow falls toward us and to the right across the ledge (a cool glaze)
    for (let i = 0; i < 220; i++) {
      const t = rng();
      const x = rootX + (10 + 460 * t) * S + (rng() - 0.5) * 50 * S * t;
      const y = rootY + (4 + 120 * t) * S + (rng() - 0.5) * 70 * S * (0.25 + t);
      if (y > H || x > W || P.mat[(clamp(y | 0, 0, H - 1)) * W + clamp(x | 0, 0, W - 1)] !== 3) continue;
      const c = sampleC(x, y);
      stroke([x - 26 * S, y - 9 * S, x + 26 * S, y + 9 * S], (8 + rng() * 12) * S, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.72],
        opt({ opacity: 0.22, soft: 0.85, bristleContrast: 0.15, thick: 0.05 }));
    }

    // roots gripping the rock
    for (let i = 0; i < 7; i++) {
      const dir = i % 2 ? 1 : -1;
      const pts = [rootX + dir * (20 + rng() * 25) * S, rootY - 8 * S], rad = [24 * S];
      let x = pts[0], y = pts[1], a = (dir > 0 ? 0.25 : Math.PI - 0.25) + (rng() - 0.5) * 0.5;
      for (let k = 1; k <= 12; k++) {
        a += (rng() - 0.5) * 0.35; x += Math.cos(a) * 11 * S; y += Math.sin(a) * 4 * S + 2.4 * S;
        pts.push(x, y); rad.push(24 * S * (1 - k / 13) + 1.5 * S);
      }
      limbs.push({ pts, rad, kind: 'live', depth: 1, root: true });
    }

    function paintLimb(L) {
      const { pts, rad } = L;
      const n = pts.length / 2;
      const dead = L.kind === 'dead';
      const r0 = rad[0];
      // body
      const wid = rad.map((r) => r / r0);
      stroke(pts, r0, dead ? [0.20, 0.19, 0.19] : [0.085, 0.065, 0.05],
        Object.assign(opt({ opacity: 1, soft: 0.12, bristleContrast: 0.3, thick: 0.7, dry: 0.05 }), { widths: wid }));
      // fibres
      const nf = Math.max(2, Math.min(26, Math.round(r0 / (2.6 * S))));
      const twist = (L.root ? 0.004 : 0.011) / S * (dead ? 1.3 : 1);
      for (let f = 0; f < nf; f++) {
        const phi0 = (f / nf) * Math.PI * 2 + rng() * 0.4;
        let run = [], runW = [], runV = 0, cnt = 0;
        let s = 0;
        const flush = () => {
          if (run.length >= 4) {
            const v = runV / cnt;
            let c;
            if (dead) c = [mix(0.22, 0.95, v * v), mix(0.21, 0.86, v * v), mix(0.21, 0.70, v * v)];
            else c = [mix(0.07, 0.86, Math.pow(v, 2.4)), mix(0.055, 0.60, Math.pow(v, 2.4)), mix(0.045, 0.36, Math.pow(v, 2.4))];
            const j = 0.85 + rng() * 0.3; c = [c[0] * j, c[1] * j, c[2] * j];
            const fw = Math.max(0.55 * S, r0 * 0.07);
            stroke(run, fw, c, Object.assign(opt({ opacity: 0.9, soft: 0.35, bristleContrast: 0.4, thick: 0.35 + 1.2 * v * v, dry: 0.5 }), { widths: runW.map((w) => w / fw) }));
          }
          run = []; runW = []; runV = 0; cnt = 0;
        };
        for (let i = 0; i < n; i++) {
          const ax = pts[Math.max(0, i - 1) * 2], ay = pts[Math.max(0, i - 1) * 2 + 1];
          const bx = pts[Math.min(n - 1, i + 1) * 2], by = pts[Math.min(n - 1, i + 1) * 2 + 1];
          const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l, ny = dx / l;
          if (i > 0) s += Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
          const phi = phi0 + twist * s + 0.25 * Math.sin(s * 0.05 / S + f);
          const front = Math.cos(phi);
          if (front < 0.05) { flush(); continue; }
          const off = Math.sin(phi) * rad[i] * 0.92;
          const [lx, ly] = lightDir(pts[i * 2], pts[i * 2 + 1]);
          const sideL = nx * lx + ny * ly; // >0: +normal side faces the sun
          const v = clamp(0.5 + 0.5 * Math.sin(phi) * Math.sign(sideL) * Math.min(1, Math.abs(sideL) * 2.5 + 0.3), 0, 1) * (0.6 + 0.4 * front);
          run.push(pts[i * 2] + nx * off, pts[i * 2 + 1] + ny * off);
          runW.push(Math.max(0.55 * S, rad[i] * 0.07) * (0.6 + 0.6 * front));
          runV += v; cnt++;
        }
        flush();
      }
    }
    // far, thin limbs first; trunk and roots last
    limbs.sort((a, b) => b.depth - a.depth || (a.trunk ? 1 : 0) - (b.trunk ? 1 : 0));
    for (const L of limbs) if (!L.trunk) paintLimb(L);

    // foliage: dense olive sprays, backlit gold at edges facing the sun
    clumps.sort((a, b) => a.y - b.y);
    for (const cl of clumps) {
      const R = cl.r, cx = cl.x, cy = cl.y;
      const [lx, ly] = lightDir(cx, cy);
      const nd = Math.round((R * R) / (5.5 * S * S));
      const seed = rng() * 100;
      for (let i = 0; i < nd; i++) {
        const a = rng() * Math.PI * 2, rr = Math.pow(rng(), 0.6);
        const ox = Math.cos(a) * rr * R * 1.3, oy = Math.sin(a) * rr * R * 0.6 - rr * rr * R * 0.12;
        const edge = NZ.fbm((cx + ox) / (30 * S) + seed, (cy + oy) / (30 * S), 4);
        if (rr > 0.72 + 0.55 * edge) continue;
        const x = cx + ox, y = cy + oy;
        const facing = (Math.cos(a) * lx * 1.3 + Math.sin(a) * ly * 0.6) / 1.43;
        const v = clamp(facing * rr * 1.25, -1, 1);
        let c;
        if (v > 0.5) { const q = (v - 0.5) / 0.5; c = [mix(0.30, 0.86, q), mix(0.30, 0.68, q), mix(0.15, 0.30, q)]; }
        else if (v > 0.0) c = [0.15, 0.165, 0.10];
        else c = [0.06, 0.07, 0.05];
        const j = 0.85 + rng() * 0.3; c = [c[0] * j, c[1] * j, c[2] * j];
        // sprays point outward and a little upward
        const sa = a * 0.7 - Math.PI / 2 * 0.3 + (rng() - 0.5) * 0.8;
        const Ls = (4 + rng() * 9) * S;
        stroke([x, y, x + Math.cos(sa) * Ls, y + Math.sin(sa) * Ls * 0.7], (1.1 + rng() * 2.0) * S, c,
          opt({ opacity: 0.9, soft: 0.45, bristleContrast: 0.35, thick: v > 0.5 ? 1.3 : 0.45, dry: 0.6 }));
      }
    }
    // the trunk and roots are painted over the lower foliage
    for (const L of limbs) if (L.trunk || L.root) paintLimb(L);

    // dry grass and small shrubs catching the light along the ledge brink and around the roots
    {
      const isFG = (x, y) => P.mat[clamp(y | 0, 0, H - 1) * W + clamp(x | 0, 0, W - 1)] === 3;
      let placed = 0;
      for (let tries = 0; tries < 9000 && placed < 70; tries++) {
        const x = px(0.55 + rng() * 0.45), y = py(0.78 + rng() * 0.2);
        if (!isFG(x, y)) continue;
        const brink = !isFG(x, y - 10 * S) || !isFG(x - 14 * S, y);
        const nearRoot = Math.hypot(x - rootX, (y - rootY) * 2) < 180 * S;
        if (!brink && !(nearRoot && rng() < 0.3)) continue;
        placed++;
        const nb = 6 + (rng() * 14 | 0), hgt = (10 + rng() * 22) * S;
        for (let b = 0; b < nb; b++) {
          const ang = -Math.PI / 2 + (rng() - 0.5) * 1.3;
          const hh = hgt * (0.5 + rng() * 0.6);
          const bx = x + (rng() - 0.5) * 8 * S;
          const ex = bx + Math.cos(ang) * hh, ey = y + Math.sin(ang) * hh;
          const mx = (bx + ex) / 2 + (rng() - 0.5) * 4 * S, my = (y + ey) / 2;
          const lit = rng() < 0.55;
          const c = lit ? [0.88 + rng() * 0.1, 0.70 + rng() * 0.1, 0.40 + rng() * 0.08] : [0.30, 0.25, 0.14];
          stroke([bx, y, mx, my, ex, ey], 0.75 * S, c, Object.assign(opt({ opacity: 0.85, soft: 0.4, thick: lit ? 1.0 : 0.4, dry: 0.7 }), { widths: [1.2, 0.9, 0.35] }));
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
    const birds = [[0.375, 0.512, 15, 0.1], [0.43, 0.493, 11, -0.15], [0.335, 0.545, 9, 0.25], [0.21, 0.61, 24, -0.05], [0.47, 0.525, 7, 0.3]];
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
