// Seeded PRNG and a tileable value-noise texture (no Math.random anywhere in the piece).
(function () {
  const NS = window.NS || (window.NS = {});
  NS.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // size x size RGBA8, each channel an independent tileable fbm (value noise, 5 octaves, wraps at the edges)
  NS.noiseTexture = function (size, seed) {
    const out = new Uint8Array(size * size * 4);
    for (let ch = 0; ch < 4; ch++) {
      const rnd = NS.mulberry32(seed + ch * 7919);
      const acc = new Float32Array(size * size);
      let amp = 1, tot = 0;
      for (let o = 0; o < 5; o++) {
        const cells = 4 << o, grid = new Float32Array(cells * cells);
        for (let i = 0; i < grid.length; i++) grid[i] = rnd();
        const cs = size / cells;
        for (let y = 0; y < size; y++) {
          const gy = y / cs, y0 = Math.floor(gy), fy = gy - y0, sy = fy * fy * (3 - 2 * fy);
          const r0 = (y0 % cells) * cells, r1 = ((y0 + 1) % cells) * cells;
          for (let x = 0; x < size; x++) {
            const gx = x / cs, x0 = Math.floor(gx), fx = gx - x0, sx = fx * fx * (3 - 2 * fx);
            const c0 = x0 % cells, c1 = (x0 + 1) % cells;
            const a = grid[r0 + c0] + (grid[r0 + c1] - grid[r0 + c0]) * sx;
            const b = grid[r1 + c0] + (grid[r1 + c1] - grid[r1 + c0]) * sx;
            acc[y * size + x] += amp * (a + (b - a) * sy);
          }
        }
        tot += amp; amp *= 0.5;
      }
      let mn = 1e9, mx = -1e9;
      for (let i = 0; i < acc.length; i++) { mn = Math.min(mn, acc[i]); mx = Math.max(mx, acc[i]); }
      for (let i = 0; i < acc.length; i++) out[i * 4 + ch] = Math.round(255 * (acc[i] - mn) / (mx - mn));
    }
    return out;
  };
})();
