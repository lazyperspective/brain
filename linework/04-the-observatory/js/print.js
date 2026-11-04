// The Observatory: print texture. Paper grain, low-frequency ink density drift, ink-starved
// speckle in solid darks, and a slight plate-edge vignette. Works in device pixels.
'use strict';
(function () {
  const OB = window.OB;
  OB.printPass = (ctx, canvas, scale) => {
    const w = canvas.width, h = canvas.height;
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const s = 1 / scale; // native px per device px
    const cx = w / 2, cy = h / 2, rr = cx * cx + cy * cy;
    const hash = OB.hash, vn = OB.vnoise;
    for (let y = 0; y < h; y++) {
      const ny = y * s;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const nx = x * s;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        // grain: fine tooth + soft fibre clumps + broad density drift
        let gr = (hash(x, y) - 0.5) * 9 + (vn(nx, ny, 2.6) - 0.5) * 10 + (vn(nx + 999, ny, 31) - 0.5) * 7;
        // paper shows through ink a little more in the lights
        gr *= 0.55 + lum / 255;
        // ink starvation in dense darks: tiny pale pits
        if (lum < 50) {
          const k = vn(nx, ny + 777, 1.9);
          if (k > 0.86) gr += (k - 0.86) * 160;
        }
        const dx = x - cx, dy = y - cy;
        const v = 1 - 0.16 * Math.pow((dx * dx + dy * dy) / rr, 1.6);
        d[i] = Math.max(0, Math.min(255, (r + gr) * v));
        d[i + 1] = Math.max(0, Math.min(255, (g + gr) * v));
        d[i + 2] = Math.max(0, Math.min(255, (b + gr * 0.9) * v));
      }
    }
    ctx.putImageData(id, 0, 0);
  };
})();
