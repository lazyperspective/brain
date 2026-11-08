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
    // ---- light on the hair as a volume: a thick ring around the head, lit from the upper left
    const Lx = -0.62, Ly = -0.55, Lz = 0.56;
    const radT = (x, y) => { const a = Math.atan2(y - hc[1], x - hc[0]); const b = bin(a); const ri = rIn[b] || 150, ro = Math.max(ri + 10, rOut[b] || 300); return (Math.hypot(x - hc[0], y - hc[1]) - ri) / (ro - ri); };
    function hairL(x, y) {
      const dx = x - hc[0], dy = y - hc[1]; const a = Math.atan2(dy, dx); const b = bin(a);
      const ri = rIn[b] || 150, ro = Math.max(ri + 10, rOut[b] || 300);
      const t = Math.max(0, Math.min(1.2, (Math.hypot(dx, dy) - ri) / (ro - ri)));
      const sgn = (t - 0.42) * 1.8;
      let nx = Math.cos(a) * (0.45 + 0.5 * sgn), ny = Math.sin(a) * (0.45 + 0.5 * sgn);
      const q = Math.min(0.95, nx * nx + ny * ny); const nzz = Math.sqrt(1 - q); const nn = Math.sqrt(nx * nx + ny * ny + nzz * nzz);
      let l = (nx * Lx + ny * Ly + nzz * Lz) / nn;
      l -= 0.28 * Math.max(0, 0.22 - t) / 0.22;          // occluded at the scalp
      l -= 0.2 * Math.min(1, Math.max(0, (y - 570) / 110));         // the masses behind the ears hang in shadow
      l += 0.06 * nz.n2(x / 70, y / 70);
      // clumps: shadowed gaps between the tufts, running out from the scalp
      const pk = nz.n2(a * 2.8 + 3.1, t * 1.1 + 0.6);
      l -= 0.55 * Math.max(0, Math.min(1, (pk - 0.05) / 0.35)) * (0.5 + 0.5 * Math.min(1, t * 2));
      return 0.4 + 0.6 * l; // hair is white: even its shadow side stays light
    }
    function hairC(l, x, y) {
      // white hair stays high in value; temperature does the turning, with only small dark accents
      const r = rng.next(); const right = x > 520;
      if (l > 0.68) return r < 0.4 ? C.lemonWhite : r < 0.7 ? C.warmWhite : r < 0.88 ? C.pinkWhite : C.lemon;
      if (l > 0.48) return r < 0.35 ? C.white : r < 0.6 ? (right ? C.skyWhite : C.pinkWhite) : r < 0.82 ? C.mint : C.pink;
      if (l > 0.28) return r < 0.35 ? mix(C.lilac, C.white, 0.45) : r < 0.65 ? mix(C.cerulean, C.white, 0.6) : r < 0.85 ? (right ? mix(C.lilac, C.pink, 0.4) : C.mint) : C.skyWhite;
      if (l > 0.1) return r < 0.4 ? C.lilac : r < 0.7 ? mix(C.cerulean, C.white, 0.3) : r < 0.85 ? (right ? mix(C.violet, C.lilac, 0.5) : mix(C.turquoise, C.mint, 0.5)) : C.cerulean;
      return r < 0.4 ? C.violet : r < 0.75 ? C.cobalt : (right ? C.crimson : C.emerald);
    }
    const A0 = Math.PI * 0.78, A1 = Math.PI * 2.22;
    const pickA = () => A0 + rng.next() * (A1 - A0);
    const base = { load: 1.1, opac: 0.97, imp: 0.8, rag: 0.2, bristle: 0.8, pick: 0.25, reach: 1.8, dryK: 0.5, touch: 0.3, endPile: 0.15, lift: 0.35 };
    // which side of a path faces the light
    function side(path, i, k) {
      const p = path[i], q = path[Math.min(path.length - 1, i + 1)], pp = path[Math.max(0, i - 1)];
      let tx = q[0] - pp[0], ty = q[1] - pp[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      let nx = -ty, ny = tx; if (nx * Lx + ny * Ly < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * k, p[1] + ny * k];
    }
    const shift = (path, k) => path.map((_, i) => side(path, i, k));

    // ---- 1. the mass blocked in: broad strokes, values only, darkest near the head and underneath
    for (const [x, y] of K.scatter(26, (x, y) => regAt(x, y) === RG.HAIR)) {
      const a = Math.atan2(y - hc[1], x - hc[0]);
      const l = hairL(x, y) - 0.05;
      const d = a + sweep(a) + rng.gauss() * 0.25;
      S(K.trace(x, y, () => d, 45 + rng.next() * 45, 4, (xx, yy, ss) => ss < 8 || (regAt(xx, yy) === RG.HAIR && radT(xx, yy) < 0.9), d), 26 + rng.next() * 16, 'loaded',
        Object.assign({}, base, { col: jit(hairC(l, x, y), 0.04), imp: 0.5, load: 0.9 }));
    }
    // ---- 2. locks: each a shadowed underside, a body, and a lit crest, laid deep-first
    const locks = [];
    for (let i = 0; i < 165; i++) {
      const a = pickA(); const u0 = rng.next() * 0.45;
      const ro = rng.next(); const over = ro < 0.18 ? -0.3 + rng.next() * 0.2 : ro < 0.8 ? -0.1 + rng.next() * 0.15 : 0.08 + rng.next() * 0.16;
      const path = lockPath(a, u0, over, 0.45 + rng.next() * 0.6);
      if (path && path.length > 6) locks.push({ a, u0, path, w: 22 + rng.next() * 20 });
    }
    locks.sort((p, q) => p.u0 - q.u0);
    for (const lk of locks) {
      const { path, w } = lk; const m = path[path.length >> 1];
      const l = hairL(m[0], m[1]);
      S(shift(path, -0.4 * w), w * 0.7, 'taper', Object.assign({}, base, { col: jit(hairC(l - 0.4, m[0], m[1]), 0.03), imp: 0.6 }));
      if (rng.next() < 0.45) { // the cool crevice under the lock, near the root
        const cr = shift(path.slice(0, Math.max(4, Math.floor(path.length * (0.3 + rng.next() * 0.25)))), -0.5 * w);
        const right = m[0] > 520, r = rng.next(), lit = l > 0.6;
        const cc = lit ? (r < 0.35 ? mix(C.violet, C.lilac, 0.4) : r < 0.65 ? mix(C.cerulean, C.lilac, 0.3) : r < 0.85 ? (right ? C.lilac : mix(C.emerald, C.mint, 0.4)) : C.cobalt)
                       : (r < 0.35 ? C.violet : r < 0.65 ? C.cobalt : r < 0.85 ? (right ? C.ultramarine : C.emerald) : C.cerulean);
        S(cr, w * (0.4 + rng.next() * 0.2), 'both', Object.assign({}, base, { col: jit(cc, 0.03), imp: 0.5, opac: 0.9 }));
      }
      const bc = hairC(l, m[0], m[1]);
      S(path, w, 'taper', Object.assign({}, base, { col: jit(bc, 0.03), col2: jit(hairC(l - 0.12, m[0], m[1]), 0.03), mix2: 0.3, imp: 0.95 }));
      if (l > 0.3) {
        const s0 = Math.floor(path.length * (0.08 + rng.next() * 0.15)), s1 = Math.floor(path.length * (0.5 + rng.next() * 0.3));
        if (s1 - s0 >= 8) S(shift(path.slice(s0, s1), 0.22 * w), w * 0.42, 'taper', Object.assign({}, base, { col: jit(hairC(l + 0.22, m[0], m[1]), 0.02), imp: 1.25, load: 1.25, pick: 0.15 }));
      }
    }
    // ---- 3. a few thick impasto lights where the hair faces the light
    for (let i = 0, n = 0; i < 400 && n < 18; i++) {
      const lk = locks[rng.int(0, locks.length - 1)]; const p = lk.path;
      const k = Math.floor(p.length * (0.2 + rng.next() * 0.4)); const q = p[k];
      if (hairL(q[0], q[1]) < 0.62) continue;
      const seg = shift(p.slice(k, Math.min(p.length, k + 14 + rng.int(0, 12))), 0.15 * lk.w);
      if (seg.length < 12) continue;
      S(seg, 7 + rng.next() * 5, 'taper', Object.assign({}, base, { col: jit(rng.next() < 0.6 ? C.lemonWhite : C.white, 0.02), load: 1.3, imp: 1.15, pick: 0.08, endPile: 0, touch: 0.3 }));
      n++;
    }
    // ---- 4. a handful of flyaways at the edge
    for (let i = 0; i < 50; i++) {
      const a = pickA();
      const path = lockPath(a, 0.55 + rng.next() * 0.3, 0.08 + rng.next() * 0.12, 1.2 + rng.next() * 0.6);
      if (!path) continue;
      const q = path[path.length >> 1];
      S(path, 3 + rng.next() * 3, 'taper', Object.assign({}, base, { col: jit(hairC(hairL(q[0], q[1]) + 0.1, q[0], q[1]), 0.02), load: 0.8, opac: 0.92, imp: 0.4, reach: 0.8, dryK: 0.75, bristle: 0.9, rag: 0.3, lift: 0.5 }));
    }
    // ---- 5. the thin crown: a few swept-back strokes over the scalp's warmth at the hairline
    for (let i = 0; i < 40; i++) {
      const t = rng.next();
      const hl = F.hairlineCtl; const idx = Math.min(hl.length - 2, Math.floor(t * (hl.length - 1)));
      const f = t * (hl.length - 1) - idx;
      const x = hl[idx][0] + (hl[idx + 1][0] - hl[idx][0]) * f + rng.gauss() * 4, y = hl[idx][1] + (hl[idx + 1][1] - hl[idx][1]) * f - 4 - rng.next() * 14;
      const a = Math.atan2(y - hc[1], x - hc[0]);
      const d = a + sweep(a) * 0.5 + rng.gauss() * 0.2;
      const r = rng.next();
      const col = r < 0.2 ? C.pink : r < 0.3 ? C.cadYellow : hairC(hairL(x, y) + 0.1, x, y);
      S(K.trace(x, y, () => d, 50 + rng.next() * 60, 3, null, d), 5 + rng.next() * 5, 'taper', Object.assign({}, base, { col: jit(col, 0.03), imp: 0.8, endPile: 0 }));
    }
  };
})(window);
