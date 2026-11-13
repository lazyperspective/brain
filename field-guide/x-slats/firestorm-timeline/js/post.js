// Post: bloom, tone curve, vertical vignette.
(function () {
  'use strict';
  const FS = window.FS;

  function bloom(g, div, blur, alpha, thr) {
    const PX = FS.PX;
    const w = Math.max(16, Math.round(PX / div));
    const c1 = FS.canvas(w, w);
    const g1 = c1.getContext('2d', { willReadFrequently: true });
    g1.imageSmoothingQuality = 'high';
    g1.drawImage(g.canvas, 0, 0, w, w);
    const id = g1.getImageData(0, 0, w, w);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = (d[i] * 0.3 + d[i + 1] * 0.55 + d[i + 2] * 0.15) / 255;
      const f = Math.max(0, l - thr) / (1 - thr);
      const k = Math.pow(f, 1.4);
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
    g1.putImageData(id, 0, 0);
    const c2 = FS.canvas(w, w);
    const g2 = c2.getContext('2d');
    g2.filter = `blur(${Math.max(1, w * blur)}px)`;
    g2.drawImage(c1, 0, 0);
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = alpha;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c2, 0, 0, PX, PX);
    g.restore();
  }

  FS.post = function (g) {
    bloom(g, 8, 0.004, 0.55, 0.5);
    bloom(g, 16, 0.012, 0.45, 0.45);
    bloom(g, 32, 0.03, 0.35, 0.4);
    // grade
    const PX = FS.PX;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const id = g.getImageData(0, 0, PX, PX);
    const d = id.data;
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      // gentle filmic S-curve keeping deep blacks
      const s = x < 0.5 ? 0.5 * Math.pow(2 * x, 1.18) : 1 - 0.5 * Math.pow(2 * (1 - x), 1.1);
      lut[i] = Math.round(s * 255);
    }
    for (let y = 0; y < PX; y++) {
      const v = y / PX;
      const vig = 1 - 0.28 * Math.pow(Math.abs(v - 0.55) / 0.55, 2.2);
      for (let x = 0; x < PX; x++) {
        const i = (y * PX + x) * 4;
        let r = lut[d[i]],
          gg = lut[d[i + 1]],
          b = lut[d[i + 2]];
        d[i] = r * vig;
        d[i + 1] = gg * vig;
        d[i + 2] = b * vig;
      }
    }
    g.putImageData(id, 0, 0);
    g.restore();
  };
})();
