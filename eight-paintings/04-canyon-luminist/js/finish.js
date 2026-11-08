// Surface: the paint height field is lit by a raking studio light; canvas weave shows through
// where the paint film is thin; a thin varnish adds a soft sheen on impasto crests.
(function (G) {
  'use strict';
  const { makeNoise, makeRng, clamp, mix, smooth, blurPlane } = G.CORE;

  function weave(W, H, S) {
    // plain-weave linen: alternating over/under threads with slubs and uneven spacing
    const NZ = makeNoise(4242);
    const out = new Float32Array(W * H);
    const period = 4.6 * Math.max(0.5, S);
    // per-thread jitter tables
    const rng = makeRng(99);
    const nx = Math.ceil(W / period) + 4, ny = Math.ceil(H / period) + 4;
    const jx = new Float32Array(nx), jy = new Float32Array(ny), tx = new Float32Array(nx), ty = new Float32Array(ny);
    for (let i = 0; i < nx; i++) { jx[i] = (rng() - 0.5) * 0.25; tx[i] = 0.75 + rng() * 0.5; }
    for (let i = 0; i < ny; i++) { jy[i] = (rng() - 0.5) * 0.25; ty[i] = 0.75 + rng() * 0.5; }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const wob = NZ.n2(x / (60 * S), y / (60 * S)) * 0.35;
        const u = x / period + wob, v = y / period - wob * 0.6;
        const iu = Math.floor(u), iv = Math.floor(v);
        const fu = u - iu - 0.5 - jx[(iu % nx + nx) % nx], fv = v - iv - 0.5 - jy[(iv % ny + ny) % ny];
        // warp thread (vertical) and weft (horizontal) cross-sections
        const wt = Math.max(0, 1 - (fu * fu) * 4.2 / tx[(iu % nx + nx) % nx]);
        const ft = Math.max(0, 1 - (fv * fv) * 4.2 / ty[(iv % ny + ny) % ny]);
        const over = ((iu + iv) & 1) === 0;
        // the thread that is "over" bulges along its length
        const bulgeW = Math.cos((v - iv - 0.5) * Math.PI) * 0.5 + 0.5;
        const bulgeF = Math.cos((u - iu - 0.5) * Math.PI) * 0.5 + 0.5;
        const h = over ? Math.max(wt * (0.6 + 0.4 * bulgeW), ft * 0.55) : Math.max(ft * (0.6 + 0.4 * bulgeF), wt * 0.55);
        out[y * W + x] = h + 0.15 * NZ.n2(x / (9 * S), y / (2.5 * S));
      }
    }
    return out;
  }

  function finish(P, W, H, S, stage) {
    const t0 = performance.now();
    const { C, Hh, Th } = P;
    const N = W * H;
    const wv = weave(W, H, S);
    // combined surface height (in px units for normals)
    const hs = new Float32Array(N);
    const hsm = blurPlane(Hh, W, H, 1, 0.8 * S + 0.3, 1);
    for (let k = 0; k < N; k++) {
      const thin = 1 - smooth(0.25, 1.6, Th[k]);
      hs[k] = hsm[k] * 1.2 + wv[k] * (0.25 + 0.75 * thin) * 0.9;
    }
    // raking light from the upper left
    const L = [-0.55, -0.62, 0.56];
    const ll = Math.hypot(L[0], L[1], L[2]); L[0] /= ll; L[1] /= ll; L[2] /= ll;
    const Hv = [L[0], L[1], L[2] + 1]; const hl = Math.hypot(Hv[0], Hv[1], Hv[2]);
    Hv[0] /= hl; Hv[1] /= hl; Hv[2] /= hl;
    const out = new Float32Array(N * 3);
    const rng = makeRng(31337);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = y * W + x;
        const xm = x > 0 ? k - 1 : k, xp = x < W - 1 ? k + 1 : k;
        const ym = y > 0 ? k - W : k, yp = y < H - 1 ? k + W : k;
        const gx = (hs[xp] - hs[xm]) * 0.5, gy = (hs[yp] - hs[ym]) * 0.5;
        let nx = -gx, ny = -gy, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const ndl = nx * L[0] + ny * L[1] + nz * L[2];
        const shade = 1 + (ndl - L[2]) * 0.55;
        const ndh = Math.max(0, nx * Hv[0] + ny * Hv[1] + nz * Hv[2]);
        const spec = Math.pow(ndh, 60) * 0.10 * smooth(0.2, 1.2, Hh[k]);
        // paint sinks into the weave valleys where the film is thin
        const thin = 1 - smooth(0.2, 1.4, Th[k]);
        const valley = 1 - (1 - wv[k]) * 0.07 * thin;
        for (let c = 0; c < 3; c++) {
          let v = C[k * 3 + c] * shade * valley + spec;
          out[k * 3 + c] = v;
        }
      }
    }
    // gentle dither to avoid any banding in smooth glazes
    for (let k = 0; k < N * 3; k++) out[k] = clamp(out[k] + (rng() - 0.5) / 255, 0, 1);
    console.log('finish', Math.round(performance.now() - t0), 'ms');
    return out;
  }

  G.FINISH = { finish };
})(typeof window !== 'undefined' ? window : globalThis);
