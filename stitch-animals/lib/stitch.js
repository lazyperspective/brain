// Shared cross-stitch / pixel renderer. Every animal uses this unchanged so all three share one look.
// Grid: 108 x 153 cells, 10 px per cell -> 1080 x 1530 canvas (same ~1:1.42 portrait as the reference).
(function () {
  const GW = 108, GH = 153, CELL = 10, W = GW * CELL, H = GH * CELL;

  // Thread texture, matched to a photo of cross-stitch on aida cloth: thin light weave lines along the
  // cell edges, a slightly darker floss body, a 2x2 checker twist and fixed per-pixel grain (never flickers).
  const TEX = new Float32Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    let m = 0.97;
    if (x === 0 || y === 0) m += 0.2;                        // light weave line
    if (x === 0 && y === 0) m += 0.06;
    if (x === 5 || y === 5) m += 0.09;                        // fainter mid thread
    if (((x >> 1) + (y >> 1)) % 2 === 0) m += 0.08; else m -= 0.08;   // floss twist checker
    TEX[y * CELL + x] = m;
  }
  const GRAIN = new Float32Array(W * H);
  { let s = 12345; for (let i = 0; i < W * H; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; GRAIN[i] = 1 + ((s / 0x7fffffff) - 0.5) * 0.16; } }

  function hexToRgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  // deterministic per-cell jitter so threads vary slightly but never flicker
  function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  const JIT = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) JIT[y * GW + x] = 1 + (hash(x, y) - 0.5) * 0.07;

  function makeGrid() {
    const a = new Uint8Array(GW * GH);
    return {
      w: GW, h: GH, a,
      fill(i) { a.fill(i); },
      set(x, y, i) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < GW && y < GH) a[y * GW + x] = i; },
      get(x, y) { x |= 0; y |= 0; return (x >= 0 && y >= 0 && x < GW && y < GH) ? a[y * GW + x] : 0; },
    };
  }

  // grid (palette indices) -> canvas with stitch texture and a soft photographed-fabric blur
  function paint(canvas, grid, palette) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const rgb = palette.map(hexToRgb);
    const img = ctx.createImageData(W, H), d = img.data;
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const c = rgb[grid.a[gy * GW + gx]], j = JIT[gy * GW + gx];
      for (let y = 0; y < CELL; y++) {
        let p = ((gy * CELL + y) * W + gx * CELL) * 4;
        for (let x = 0; x < CELL; x++, p += 4) {
          const m = TEX[y * CELL + x] * j * GRAIN[p >> 2];
          d[p] = Math.min(255, c[0] * m);
          d[p + 1] = Math.min(255, c[1] * m);
          d[p + 2] = Math.min(255, c[2] * m);
          d[p + 3] = 255;
        }
      }
    }
    // soften like a phone photo of real stitching
    const tmp = document.createElement('canvas'); tmp.width = W; tmp.height = H;
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.filter = 'blur(0.45px)';
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = 'none';
  }

  window.STITCH = { GW, GH, CELL, W, H, makeGrid, paint, hash };
})();
