// The hair: a wild white halo built from curling locks of loaded strokes over cool shadow pockets,
// finished with dry flyaway wisps over the background.
(function (G) {
  'use strict';
  G.__paintHair = function (P, plan, K, rng) {
    const F = G.Face, C = plan.C, RG = plan.RG, mix = plan.mix;
    const { S, regAt, nz, jit } = K;
    const hc = F.headCenter;
    const NB = 720, TAU = Math.PI * 2;
    const rIn = new Float32Array(NB), rOut = new Float32Array(NB);
    for (let b = 0; b < NB; b++) {
      const a = b / NB * TAU; const ca = Math.cos(a), sa = Math.sin(a);
      let inn = 0, out = 0;
      for (let r = 60; r < 600; r += 1) {
        const rg = regAt(hc[0] + ca * r, hc[1] + sa * r);
        if (rg === RG.HAIR) { if (!inn) inn = r; out = r; }
        else if (inn && rg === RG.BG) break;
      }
      rIn[b] = inn; rOut[b] = out;
    }
    const bin = (a) => (Math.round((((a % TAU) + TAU) % TAU) / TAU * NB)) % NB;
    const lightA = -2.3;
    const litF = (a) => 0.5 + 0.5 * Math.cos(a - lightA);
    function sweep(a) {
      const side = Math.cos(a);
      // crown hair lifts up and back; side masses flare outward and a little upward
      return -0.22 * side * Math.max(0, -Math.sin(a)) - 0.2 * Math.sign(side) * Math.max(0, Math.abs(side) - 0.5);
    }
    function wrap(d) { while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
    // a lock: a curling centre line from the scalp to just past the silhouette
    function lockPath(a0, u0, over, curl) {
      const b = bin(a0); const ri = rIn[b], ro = rOut[b]; if (!ri || ro - ri < 8) return null;
      const r = ri + (ro - ri) * u0;
      let x = hc[0] + Math.cos(a0) * r, y = hc[1] + Math.sin(a0) * r;
      const pts = [[x, y]];
      let dir = a0 + sweep(a0) + rng.gauss() * 0.3;
      const k0 = rng.gauss() * 0.004 * curl, k1 = (0.008 + rng.next() * 0.016) * curl, lam = 30 + rng.next() * 50, ph = rng.next() * TAU;
      const step = 3;
      for (let s = 0; s < 700; s += step) {
        const ra = Math.atan2(y - hc[1], x - hc[0]);
        dir += (k0 + k1 * Math.sin(s / lam + ph)) * step + 0.035 * wrap(ra + sweep(ra) - dir);
        const dev = wrap(dir - (ra + sweep(ra)));
        if (dev > 1.1) dir = ra + sweep(ra) + 1.1; else if (dev < -1.1) dir = ra + sweep(ra) - 1.1;
        x += Math.cos(dir) * step; y += Math.sin(dir) * step;
        pts.push([x, y]);
        const rr = Math.hypot(x - hc[0], y - hc[1]);
        if (rr > rOut[bin(ra)] * (1 + over)) break;
      }
      return pts.length > 3 ? pts : null;
    }
    function strandsOf(path, lockW, m) {
      const out = [];
      const n = path.length;
      for (let j = 0; j < m; j++) {
        const d = (m === 1 ? 0 : j / (m - 1) - 0.5) * lockW * (0.8 + 0.4 * rng.next());
        const conv = 0.45 + 0.5 * rng.next();
        const so = rng.next() * 100;
        const start = Math.floor(rng.next() * Math.min(6, n * 0.2));
        const end = n - Math.floor(rng.next() * n * 0.3);
        const pl = [];
        for (let i = start; i < end; i++) {
          const p = path[i], q = path[Math.min(n - 1, i + 1)], pp = path[Math.max(0, i - 1)];
          let tx = q[0] - pp[0], ty = q[1] - pp[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          const f = 1 - conv * (i / n);
          const dd = d * f + 1.6 * nz.n1(so + i * 0.15);
          pl.push([p[0] - ty * dd, p[1] + tx * dd]);
        }
        if (pl.length > 3) out.push(pl);
      }
      return out;
    }
    function hairCol(a, layer, x, y) {
      const lf = litF(a);
      const low = Math.max(0, (y - 560) / 120); // nape and behind the ears sit in shadow
      const r = rng.next();
      if (layer === 0) {
        if (r < 0.32) return mix(C.cobalt, C.ultramarine, rng.next());
        if (r < 0.55) return mix(C.violet, C.cobalt, rng.next());
        if (r < 0.75) return x > 520 ? C.cerulean : C.turquoise;
        return x > 520 ? C.crimson : C.viridian;
      }
      if (layer === 1) {
        if (lf - low * 0.4 > 0.6) return r < 0.35 ? C.lemon : r < 0.65 ? C.pink : mix(C.lilac, C.warmWhite, 0.4);
        return r < 0.4 ? C.lilac : r < 0.75 ? mix(C.cerulean, C.skyWhite, 0.5) : C.mint;
      }
      if (lf - low * 0.5 > 0.55) return r < 0.45 ? C.warmWhite : r < 0.75 ? C.lemonWhite : C.pinkWhite;
      if (lf - low * 0.5 > 0.3) return r < 0.5 ? C.white : r < 0.8 ? C.skyWhite : C.pinkWhite;
      return r < 0.45 ? C.skyWhite : r < 0.75 ? C.mint : mix(C.lilac, C.white, 0.5);
    }
    const A0 = Math.PI * 0.78, A1 = Math.PI * 2.22;
    const pickA = () => { // more hair on the sides than on the crown
      for (;;) { const a = A0 + rng.next() * (A1 - A0); const top = Math.max(0, -Math.sin(a)) * Math.max(0, 1 - Math.abs(Math.cos(a)) * 1.6); if (rng.next() > top * 0.1) return a; }
    };
    const base = { load: 1.05, opac: 0.97, imp: 0.7, rag: 0.16, bristle: 0.75, pick: 0.25, reach: 1.8, dryK: 0.5, touch: 0.25, endPile: 0.1 };

    // ---- layer 0: shadow pockets deep in the mass
    for (let i = 0; i < 130; i++) {
      const a = pickA();
      const path = lockPath(a, rng.next() * 0.35, -0.2 - rng.next() * 0.15, 1);
      if (!path) continue;
      S(path, 20 + rng.next() * 16, 'taper', Object.assign({}, base, { col: jit(hairCol(a, 0, path[0][0], path[0][1]), 0.04), imp: 0.45, pick: 0.1 }));
    }
    // ---- layers 1-2: locks of mid and light strands
    for (let layer = 1; layer <= 2; layer++) {
      const nL = layer === 1 ? 110 : 170;
      for (let c = 0; c < nL; c++) {
        const a = pickA();
        const over = layer === 1 ? -0.1 + rng.next() * 0.1 : -0.05 + rng.next() * 0.12;
        const path = lockPath(a, rng.next() * (layer === 1 ? 0.4 : 0.55), over, 1 + rng.next() * 0.8);
        if (!path) continue;
        const lockW = layer === 1 ? 22 + rng.next() * 18 : 14 + rng.next() * 16;
        const m = 1 + rng.int(0, 2);
        const colC = hairCol(a, layer, path[path.length >> 1][0], path[path.length >> 1][1]);
        for (const pl of strandsOf(path, lockW, m)) {
          const col = jit(rng.next() < 0.2 ? hairCol(a, layer, pl[0][0], pl[0][1]) : colC, 0.03);
          S(pl, (lockW / m) * (0.9 + rng.next() * 0.4), 'taper', Object.assign({}, base, { col, col2: jit(mix(col, C.white, 0.5), 0.02), mix2: 0.25, imp: layer === 1 ? 0.65 : 0.9 }));
        }
      }
    }
    // ---- lit crests: thick short loaded strokes on the upper-left of the mass
    for (let i = 0; i < 30; i++) {
      const a = pickA(); if (litF(a) < 0.45 && rng.next() < 0.7) continue;
      const path = lockPath(a, 0.2 + rng.next() * 0.4, -0.15, 1.2);
      if (!path || path.length < 8) continue;
      const s0 = Math.floor(path.length * (0.2 + rng.next() * 0.3));
      const pl = path.slice(s0, Math.min(path.length, s0 + 12 + rng.int(0, 14)));
      S(pl, 5 + rng.next() * 6, 'taper', Object.assign({}, base, { col: jit(litF(a) > 0.5 ? C.lemonWhite : C.white, 0.02), load: 1.2, imp: 1.0, pick: 0.1, endPile: 0, touch: 0.15 }));
    }
    // ---- flyaway wisps: thin and dry, out over the background
    for (let i = 0; i < 110; i++) {
      const a = A0 - 0.05 + rng.next() * (A1 - A0 + 0.1);
      const path = lockPath(a, 0.45 + rng.next() * 0.45, 0.03 + rng.next() * 0.1, 0.5 + rng.next() * 0.6);
      if (!path) continue;
      const col = jit(hairCol(a, 2, path[0][0], path[0][1]), 0.02);
      S(path, 2.0 + rng.next() * 2.6, 'taper', Object.assign({}, base, { col, load: 0.62, opac: 0.9, imp: 0.35, reach: 0.5, dryK: 0.85, bristle: 0.9, rag: 0.3, lift: 0.6 }));
    }
    // ---- crown: sparse strands swept back from the high forehead, scalp warmth between
    for (let i = 0; i < 110; i++) {
      const t = rng.next();
      const hl = F.hairlineCtl; const idx = Math.min(hl.length - 2, Math.floor(t * (hl.length - 1)));
      const f = t * (hl.length - 1) - idx;
      const x = hl[idx][0] + (hl[idx + 1][0] - hl[idx][0]) * f + rng.gauss() * 5, y = hl[idx][1] + (hl[idx + 1][1] - hl[idx][1]) * f - 2 - rng.next() * 30;
      const a = Math.atan2(y - hc[1], x - hc[0]);
      const pts = [[x, y]]; let px = x, py = y, d = a + sweep(a) * 0.5 + rng.gauss() * 0.2;
      const cs = rng.next() * 100;
      for (let s = 0; s < 40 + rng.next() * 80; s += 3) { d += 0.08 * nz.n2(cs + s / 40, 3); px += Math.cos(d) * 3; py += Math.sin(d) * 3; pts.push([px, py]); }
      const r = rng.next();
      const col = r < 0.12 ? C.pink : r < 0.2 ? C.cadYellow : hairCol(a, 2, x, y);
      S(pts, 2.5 + rng.next() * 4, 'taper', Object.assign({}, base, { col: jit(col, 0.03), imp: 0.6, endPile: 0, touch: 0.1 }));
    }
  };
})(window);
