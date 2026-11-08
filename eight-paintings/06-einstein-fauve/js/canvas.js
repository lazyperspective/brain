// The support: a plain-weave linen with a thin cream gesso, and the final raking-light "photograph".
(function (G) {
  'use strict';
  function hash(i) { i = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); i ^= i >>> 13; i = Math.imul(i, 0xc2b2ae35); i ^= i >>> 16; return (i >>> 0) / 4294967296; }

  // Weave height ("tooth") in 0..1.
  G.makeWeave = function (W, H, sc, seed) {
    const nz = G.Noise(seed);
    const tooth = new Float32Array(W * H);
    const p = 4.4 * sc; // thread pitch in px
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wx = x + 1.6 * sc * nz.n2(x / (70 * sc), y / (70 * sc)) + 0.5 * sc * nz.n2(x / (9 * sc), y / (31 * sc));
        const wy = y + 1.6 * sc * nz.n2(x / (70 * sc) + 40, y / (70 * sc)) + 0.5 * sc * nz.n2(x / (31 * sc) + 9, y / (9 * sc));
        let fx = wx / p, fy = wy / p;
        const i0 = Math.floor(fx), j0 = Math.floor(fy);
        fx += 0.18 * (hash(i0 * 31 + 7) - 0.5); fy += 0.18 * (hash(j0 * 17 + 11) - 0.5);
        const i = Math.floor(fx), j = Math.floor(fy);
        const ux = fx - i, uy = fy - j;
        // thread thickness varies thread to thread and slowly along each thread (slubs)
        const ti = 0.7 + 0.45 * hash(i * 7 + 3) + 0.35 * Math.max(0, nz.n2(i * 3.1, y / (40 * sc)) - 0.2);
        const tj = 0.7 + 0.45 * hash(j * 13 + 5) + 0.35 * Math.max(0, nz.n2(x / (40 * sc), j * 2.7 + 50) - 0.2);
        const warp = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (ux - 0.5) / Math.min(1, ti) + 0.5)))), 0.7);
        const weft = Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, (uy - 0.5) / Math.min(1, tj) + 0.5)))), 0.7);
        const over = (i + j) & 1;
        let hw, hf;
        if (over) { hw = warp * (0.62 + 0.38 * Math.sin(Math.PI * uy)); hf = weft * 0.55; }
        else { hf = weft * (0.62 + 0.38 * Math.sin(Math.PI * ux)); hw = warp * 0.55; }
        let h = Math.max(hw * ti, hf * tj) / 1.25;
        h += 0.08 * nz.n2(x / (1.3 * sc), y / (1.3 * sc)) + 0.06 * nz.n2(x / (14 * sc), y / (14 * sc)); // fibres, gesso drag
        h = 0.18 + 0.82 * Math.min(1, Math.max(0, h)); // gesso half-fills the valleys
        tooth[y * W + x] = h;
      }
    }
    return tooth;
  };

  // Light the painted surface: raking light from the upper left, oil sheen on thick paint.
  G.lightSurface = function (P, opt) {
    const { W, H, R, Gc, B, Ht, tooth } = P;
    const N = W * H;
    const sc = P.sc;
    const hgt = new Float32Array(N);
    const wA = opt.weaveAmp;
    for (let i = 0; i < N; i++) {
      const h = Ht[i];
      hgt[i] = h * opt.paintAmp + tooth[i] * wA * Math.exp(-h * 2.5);
    }
    // slight levelling (paint flows a little)
    const sm = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - 1) * W, y1 = y * W, y2 = Math.min(H - 1, y + 1) * W;
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - 1), x2 = Math.min(W - 1, x + 1);
        sm[y1 + x] = (hgt[y1 + x] * 4 + hgt[y0 + x] + hgt[y2 + x] + hgt[y1 + x0] + hgt[y1 + x2]) / 8;
      }
    }
    const L = [-0.58, -0.62, 0.53]; const ln = Math.hypot(L[0], L[1], L[2]); L[0] /= ln; L[1] /= ln; L[2] /= ln;
    const Hv = [L[0], L[1], L[2] + 1]; const hn = Math.hypot(Hv[0], Hv[1], Hv[2]); Hv[0] /= hn; Hv[1] /= hn; Hv[2] /= hn;
    const specFlat = Math.pow(Hv[2], opt.specPow);
    const out = new Uint8ClampedArray(N * 4);
    const gs = opt.gradScale / sc;
    // cast shadow direction (toward the light) in px
    const sdx = -L[0] / Math.hypot(L[0], L[1]), sdy = -L[1] / Math.hypot(L[0], L[1]);
    const tanE = L[2] / Math.hypot(L[0], L[1]);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const xl = x > 0 ? i - 1 : i, xr = x < W - 1 ? i + 1 : i;
        const yu = y > 0 ? i - W : i, yd = y < H - 1 ? i + W : i;
        const gx = (sm[xr] - sm[xl]) * 0.5 * gs, gy = (sm[yd] - sm[yu]) * 0.5 * gs;
        const nl = 1 / Math.sqrt(gx * gx + gy * gy + 1);
        const nx = -gx * nl, ny = -gy * nl, nz = nl;
        const d = (nx * L[0] + ny * L[1] + nz * L[2]) / L[2];
        let sh = 1 + (d - 1) * opt.diffuse;
        // short cast shadows behind impasto ridges
        let occ = 0;
        const h0 = sm[i];
        for (let k = 1; k <= 6; k++) {
          const xx = Math.round(x - sdx * k * 1.5 * sc), yy = Math.round(y - sdy * k * 1.5 * sc);
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
          const dh = (sm[yy * W + xx] - h0) * opt.shadowScale - k * 1.5 * tanE;
          if (dh > occ) occ = dh;
        }
        sh *= 1 - Math.min(0.32, occ * 0.22);
        const nh = nx * Hv[0] + ny * Hv[1] + nz * Hv[2];
        const gloss = Math.min(1, Ht[i] * 1.4) * opt.gloss;
        const sp = Math.max(0, Math.pow(Math.max(0, nh), opt.specPow) - specFlat) * gloss * 255;
        sh = Math.max(0.45, Math.min(1.45, sh));
        out[i * 4] = R[i] * 255 * sh + sp;
        out[i * 4 + 1] = Gc[i] * 255 * sh + sp;
        out[i * 4 + 2] = B[i] * 255 * sh + sp;
        out[i * 4 + 3] = 255;
      }
    }
    return out;
  };
})(window);
