/* Print pass: ink-edge roughening (tiny displacement field), paper grain, ink mottling, specks. */
(function () {
  'use strict';
  const LW = window.LW;

  LW.printPass = function (ctx, S) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const src = ctx.getImageData(0, 0, w, h);
    const s = src.data;
    const out = ctx.createImageData(w, h);
    const d = out.data;
    // displacement lattice (every G px), smooth-interpolated
    const G = Math.max(2, Math.round(3 * S));
    const gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2;
    const dxs = new Float32Array(gw * gh), dys = new Float32Array(gw * gh);
    const amp = 0.75 * S + 0.1;
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      dxs[j * gw + i] = (LW.hash2(i, j, 11) - 0.5) * 2 * amp;
      dys[j * gw + i] = (LW.hash2(i, j, 23) - 0.5) * 2 * amp;
    }
    // low-frequency paper mottling lattice
    const M = Math.max(8, Math.round(40 * S));
    const mw = Math.ceil(w / M) + 2, mh = Math.ceil(h / M) + 2;
    const mot = new Float32Array(mw * mh);
    for (let j = 0; j < mh; j++) for (let i = 0; i < mw; i++) mot[j * mw + i] = LW.N1(i * 0.37, j * 0.37) * 0.6 + LW.N2(i * 1.3, j * 1.3) * 0.4;

    for (let y = 0; y < h; y++) {
      const gy = y / G, j0 = Math.floor(gy), fy = gy - j0;
      const my = y / M, m0 = Math.floor(my), mfy = my - m0;
      for (let x = 0; x < w; x++) {
        const gx = x / G, i0 = Math.floor(gx), fx = gx - i0;
        const a = j0 * gw + i0;
        const ddx = (dxs[a] * (1 - fx) + dxs[a + 1] * fx) * (1 - fy) + (dxs[a + gw] * (1 - fx) + dxs[a + gw + 1] * fx) * fy;
        const ddy = (dys[a] * (1 - fx) + dys[a + 1] * fx) * (1 - fy) + (dys[a + gw] * (1 - fx) + dys[a + gw + 1] * fx) * fy;
        let sx = x + ddx, sy = y + ddy;
        if (sx < 0) sx = 0; else if (sx > w - 1.001) sx = w - 1.001;
        if (sy < 0) sy = 0; else if (sy > h - 1.001) sy = h - 1.001;
        const x0 = sx | 0, y0 = sy | 0, ux = sx - x0, uy = sy - y0;
        const p00 = (y0 * w + x0) * 4, p10 = p00 + 4, p01 = p00 + w * 4, p11 = p01 + 4;
        const w00 = (1 - ux) * (1 - uy), w10 = ux * (1 - uy), w01 = (1 - ux) * uy, w11 = ux * uy;
        let r = s[p00] * w00 + s[p10] * w10 + s[p01] * w01 + s[p11] * w11;
        let g = s[p00 + 1] * w00 + s[p10 + 1] * w10 + s[p01 + 1] * w01 + s[p11 + 1] * w11;
        let b = s[p00 + 2] * w00 + s[p10 + 2] * w10 + s[p01 + 2] * w01 + s[p11 + 2] * w11;
        // paper + ink texture
        const mx = x / M, mi0 = mx | 0, mfx = mx - mi0, ma = m0 * mw + mi0;
        const mo = (mot[ma] * (1 - mfx) + mot[ma + 1] * mfx) * (1 - mfy) + (mot[ma + mw] * (1 - mfx) + mot[ma + mw + 1] * mfx) * mfy;
        const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255;
        const grain = LW.hash2(x, y, 7) - 0.5;
        const fib = LW.hash2(x >> 1, (y / 3) | 0, 5) - 0.5;
        let k = 1 + grain * (0.05 + 0.04 * lum) + fib * 0.02 + mo * (0.025 + 0.02 * lum);
        // ink voids in dark plates, rare dust in light plates
        const sp = LW.hash2(x, y, 99);
        if (lum < 0.22 && sp < 0.0016 + 0.002 * Math.max(0, mo)) k += 0.6;
        else if (lum > 0.6 && sp < 0.0005) k -= 0.35;
        r *= k; g *= k; b *= k;
        // warm the paper whites a touch
        if (lum > 0.8) { r += 2; b -= 3; }
        const o = (y * w + x) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  };
})();
