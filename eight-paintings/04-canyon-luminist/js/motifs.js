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
    const branches = [];
    const clumps = [];
    function limb(x, y, ang, len, w0, depth, kind, bendBias) {
      const pts = [x, y];
      const nseg = Math.max(3, Math.round(len / (16 * S)));
      let a = ang;
      for (let i = 1; i <= nseg; i++) {
        a += (rng() - 0.5) * 0.42 + bendBias;
        x += Math.cos(a) * len / nseg; y += Math.sin(a) * len / nseg;
        pts.push(x, y);
      }
      const w1 = w0 * (kind === 'dead' ? 0.2 : 0.42);
      branches.push({ pts, w0, w1, kind, depth });
      if (depth >= 3 || len < 40 * S) {
        if (kind !== 'dead') clumps.push({ x, y, r: (50 + rng() * 55) * S });
        return;
      }
      const nk = kind === 'dead' ? 2 : 2 + (rng() < 0.5 ? 1 : 0);
      for (let c = 0; c < nk; c++) {
        const t = 0.45 + 0.55 * rng();
        const idx = Math.max(1, Math.round(t * nseg));
        const bx = pts[idx * 2], by = pts[idx * 2 + 1];
        const side = c % 2 === 0 ? -1 : 1;
        const na = a + side * (0.35 + rng() * 0.6) - 0.15 * (a + Math.PI / 2);
        const nl = len * (0.5 + rng() * 0.25);
        const nw = mix(w0, w1, t) * (0.55 + rng() * 0.15);
        limb(bx, by, na, nl, nw, depth + 1, kind === 'dead' || rng() < 0.12 ? 'dead' : 'live', bendBias * 0.6);
      }
      if (kind !== 'dead') { const q = Math.round(nseg * (0.55 + 0.3 * rng())); clumps.push({ x: pts[q * 2], y: pts[q * 2 + 1] - 10 * S, r: (45 + rng() * 45) * S }); }
    }
    const rootX = px(0.80), rootY = py(0.925);
    // trunk: short, massive, twisted; it forks into three heavy limbs
    const trunk = [rootX, rootY];
    {
      let x = rootX, y = rootY, a = -Math.PI / 2 - 0.32;
      const nseg = 12;
      for (let i = 1; i <= nseg; i++) {
        a += Math.sin(i * 1.1) * 0.2 - 0.025;
        x += Math.cos(a) * 24 * S; y += Math.sin(a) * 24 * S;
        trunk.push(x, y);
      }
      branches.push({ pts: trunk, w0: 118 * S, w1: 74 * S, kind: 'trunk', depth: 0 });
      const tx = x, ty = y;
      limb(tx, ty, -Math.PI + 0.42, 360 * S, 50 * S, 1, 'live', 0.012);   // long arm reaching over the abyss
      limb(tx, ty, -Math.PI / 2 - 0.35, 260 * S, 46 * S, 1, 'live', -0.01); // up and left
      limb(tx + 10 * S, ty, -Math.PI / 2 + 0.35, 230 * S, 40 * S, 1, 'live', 0.02); // up and right
      limb(tx - 20 * S, ty + 30 * S, -Math.PI + 0.12, 420 * S, 22 * S, 2, 'dead', -0.006); // bleached snag, far out
      const mid = (trunk.length / 4 | 0) * 2;
      limb(trunk[mid], trunk[mid + 1], -0.55, 200 * S, 28 * S, 2, 'live', 0.03);
    }

    // the tree's shadow falls toward us and to the right across the ledge (a cool glaze)
    {
      for (let i = 0; i < 140; i++) {
        const t = rng();
        const x = rootX + (20 + 420 * t) * S + (rng() - 0.5) * 60 * S * t;
        const y = rootY + (6 + 150 * t) * S + (rng() - 0.5) * 50 * S * (0.3 + t);
        if (y > H || x > W) continue;
        const c = sampleC(x, y);
        stroke([x - 30 * S, y - 10 * S, x + 30 * S, y + 10 * S], (10 + rng() * 14) * S * (0.6 + t), [c[0] * 0.5, c[1] * 0.5, c[2] * 0.62],
          opt({ opacity: 0.3, soft: 0.8, bristleContrast: 0.2, thick: 0.1 }));
      }
    }

    // exposed roots gripping the rock
    for (let i = 0; i < 6; i++) {
      const pts = [rootX + (rng() - 0.5) * 60 * S, rootY - 10 * S];
      let x = pts[0], y = pts[1], a = (i % 2 ? 0.15 : Math.PI - 0.15) + (rng() - 0.5) * 0.4;
      for (let k = 0; k < 7; k++) { a += (rng() - 0.5) * 0.5; x += Math.cos(a) * 24 * S; y += Math.sin(a) * 7 * S + 3 * S; pts.push(x, y); }
      branches.push({ pts, w0: 30 * S, w1: 5 * S, kind: 'root', depth: 1 });
    }

    function paintBranch(b) {
      const pts = b.pts, n = pts.length / 2;
      for (let i = 0; i < n - 1; i++) {
        const t0 = i / (n - 1), t1 = (i + 1) / (n - 1);
        const ax = pts[i * 2], ay = pts[i * 2 + 1], bx = pts[i * 2 + 2], by = pts[i * 2 + 3];
        const w = mix(b.w0, b.w1, (t0 + t1) / 2);
        const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        const [lx, ly] = lightDir(ax, ay);
        const lit = nx * lx + ny * ly; // which side faces the light
        const sgn = lit >= 0 ? 1 : -1;
        const dead = b.kind === 'dead';
        // dark body
        const body = dead ? [0.30, 0.27, 0.26] : [0.12, 0.085, 0.065];
        stroke([ax, ay, bx, by], w * 0.5, body, opt({ opacity: 1, soft: 0.25, bristleContrast: 0.5, thick: 0.6, dry: 0.2 }));
        // twisted bark ridges: thin strokes spiralling along the limb
        const ridges = Math.max(1, Math.round(w / (7 * S)));
        for (let r = 0; r < ridges; r++) {
          const off = ((r + 0.5) / ridges - 0.5) * w * 0.85 + Math.sin(i * 0.7 + r) * w * 0.08;
          const facing = off * sgn / (w * 0.5);
          const v = clamp(0.5 + 0.5 * facing, 0, 1);
          let c = dead ? [mix(0.25, 0.80, v * v), mix(0.23, 0.70, v * v), mix(0.23, 0.56, v * v)]
            : [mix(0.10, 0.62, v * v * v), mix(0.075, 0.43, v * v * v), mix(0.06, 0.27, v * v * v)];
          const j = 0.9 + rng() * 0.2; c = [c[0] * j, c[1] * j, c[2] * j];
          stroke([ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off], Math.max(0.8 * S, w * 0.09 + rng() * 1.5 * S), c,
            opt({ opacity: 0.85, soft: 0.35, bristleContrast: 0.4, thick: 0.4 + 0.9 * v * v, dry: 0.5 }));
        }
        // sunlit rim
        if (w > 3 * S) {
          const off = sgn * w * 0.44;
          stroke([ax + nx * off, ay + ny * off, bx + nx * off, by + ny * off], Math.max(0.7 * S, w * 0.07),
            dead ? [0.95, 0.85, 0.66] : [0.86, 0.62, 0.36], opt({ opacity: 0.8, soft: 0.4, bristleContrast: 0.5, thick: 1.4, dry: 0.6 }));
        }
      }
    }
    // paint limbs from thin to thick? paint the far (thin) ones first, trunk last
    branches.sort((a, b) => b.depth - a.depth);
    for (const b of branches) if (b.kind !== 'trunk') paintBranch(b);
    paintBranch(branches.find((b) => b.kind === 'trunk'));

    // foliage clumps: dense, flattened sprays; dark core, golden backlit edges toward the sun
    for (const cl of clumps) {
      const R = cl.r, cx = cl.x, cy = cl.y;
      const [lx, ly] = lightDir(cx, cy);
      const nd = Math.round(R * R / (9 * S * S));
      const seed = rng() * 100;
      for (let i = 0; i < nd; i++) {
        const a = rng() * Math.PI * 2, rr = Math.sqrt(rng());
        let ox = Math.cos(a) * rr * R * 1.35, oy = Math.sin(a) * rr * R * 0.62;
        const edge = NZ.fbm((cx + ox) / (24 * S) + seed, (cy + oy) / (24 * S), 3);
        if (rr > 0.75 + 0.5 * edge) continue;
        const x = cx + ox, y = cy + oy;
        const f = (ox / (R * 1.35)) * lx + (oy / (R * 0.62)) * ly; // facing the light
        const v = clamp(f * rr, -1, 1);
        let c;
        if (v > 0.45) c = [mix(0.30, 0.78, (v - 0.45) / 0.55), mix(0.30, 0.62, (v - 0.45) / 0.55), mix(0.14, 0.26, (v - 0.45) / 0.55)];
        else if (v > -0.1) c = [0.17, 0.20, 0.11];
        else c = [0.075, 0.095, 0.075];
        const j = 0.85 + rng() * 0.3; c = [c[0] * j, c[1] * j, c[2] * j * (0.95 + rng() * 0.1)];
        const ang = -0.3 + (rng() - 0.5) * 1.2;
        const L = (3 + rng() * 6) * S;
        stroke([x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L], (1.6 + rng() * 2.6) * S, c,
          opt({ opacity: 0.92, soft: 0.4, bristleContrast: 0.3, thick: v > 0.45 ? 1.2 : 0.5, dry: 0.4 }));
      }
      // a few sky holes punched through the clump
      for (let i = 0; i < Math.round(R / (12 * S)); i++) {
        const a = rng() * Math.PI * 2, rr = 0.3 + 0.5 * rng();
        const x = cx + Math.cos(a) * rr * R * 1.2, y = cy + Math.sin(a) * rr * R * 0.5;
        const bg = P.ref ? (() => { const k = ((y | 0) * W + (x | 0)) * 3; return [P.ref[k], P.ref[k + 1], P.ref[k + 2]]; })() : sampleC(x, y);
        stroke([x, y], (1.2 + rng() * 1.8) * S, bg, opt({ opacity: 0.8, soft: 0.5, thick: 0.2 }));
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
