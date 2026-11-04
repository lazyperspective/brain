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
        // plate tone: faint horizontal wiping streaks left on the plate
        gr += (vn(nx * 0.07 + 333, ny * 1.1, 1.6) - 0.5) * 7 * (0.4 + lum / 255);
        // ink starvation in dense darks: tiny pale pits (rarer in the mid tones)
        if (lum < 90) {
          const k = vn(nx, ny + 777, 1.9);
          const th = lum < 50 ? 0.86 : 0.9;
          if (k > th) gr += (k - th) * 160;
        }
        // stray ink specks: tiny dark flecks in the lights and mid tones
        if (lum > 45) {
          const k2 = vn(nx + 555, ny, 1.7);
          if (k2 > 0.88) gr -= (k2 - 0.88) * 260;
        }
        const dx = x - cx, dy = y - cy;
        const ex = Math.abs(dx) / cx, ey = Math.abs(dy) / cy;
        const v = (1 - 0.2 * Math.pow((dx * dx + dy * dy) / rr, 1.5)) * (1 - 0.22 * Math.pow(Math.max(ex, ey), 6)) * (1 - 0.12 * Math.max(0, (y / h - 0.7) / 0.3));
        d[i] = Math.max(0, Math.min(255, (r + gr) * v));
        d[i + 1] = Math.max(0, Math.min(255, (g + gr) * v));
        d[i + 2] = Math.max(0, Math.min(255, (b + gr * 0.9) * v));
      }
    }
    ctx.putImageData(id, 0, 0);
  };
})();
