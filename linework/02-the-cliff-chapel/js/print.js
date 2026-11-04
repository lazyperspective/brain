// print.js - screen-print composite: paper, mis-registered colour plate with
// ink mottling, key-line plate with dry-brush breaks, paper tooth.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;

  function noiseCanvas(w, h, fn) {
    const c = LW.canvas(w, h);
    const g = c.getContext('2d');
    const id = g.createImageData(w, h);
    const d = id.data;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) fn(x, y, d, i);
    g.putImageData(id, 0, 0);
    return c;
  }
  // cheap integer hash -> [0,1)
  function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  LW.composite = function (cv) {
    const S = LW.S;
    const w = cv.width, h = cv.height;
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.paper;
    g.fillRect(0, 0, w, h);

    // ---- colour plate: mottle (low-frequency density variation) before placing
    const lw = Math.ceil(w / 8), lh = Math.ceil(h / 8);
    const mott = noiseCanvas(lw, lh, (x, y, d, i) => {
      const n = LW.fbm(x * 0.045 / S * 0.5, y * 0.045 / S * 0.5, 3) * 0.5 + 0.5 * LW.noise2(x * 0.3, y * 0.3) * 0.3;
      const v = 128 + n * 40;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    });
    const fg = LW.fill;
    fg.save();
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.globalCompositeOperation = 'soft-light';
    fg.globalAlpha = 0.35;
    fg.imageSmoothingEnabled = true;
    fg.drawImage(mott, 0, 0, w, h);
    fg.restore();
    // place it twice: unshifted underneath, shifted on top (internal mis-registration only)
    g.drawImage(fg.canvas, 0, 0);
    g.drawImage(fg.canvas, Math.round(2.4 * S), Math.round(-1.6 * S));

    // ---- key line plate: dry-brush breaks (tiny paper specks knocked out of the ink)
    const ig = LW.ink;
    const speck = noiseCanvas(w, h, (x, y, d, i) => {
      const r = hash(x, y, 7);
      const lf = LW.noise3(x * 0.02 / S, y * 0.02 / S) * 0.5 + 0.5;
      const a = r < 0.05 + 0.07 * lf ? 120 + 135 * hash(x, y, 9) : 0;
      d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = a;
    });
    ig.save();
    ig.setTransform(1, 0, 0, 1, 0, 0);
    ig.globalCompositeOperation = 'destination-out';
    ig.globalAlpha = 0.55;
    ig.drawImage(speck, 0, 0);
    ig.restore();
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.drawImage(ig.canvas, 0, 0);
    g.globalAlpha = 0.18; // slight ink spread / density
    g.drawImage(ig.canvas, 0.6 * S, 0.4 * S);
    g.restore();

    // ---- paper tooth over everything
    const tooth = noiseCanvas(w, h, (x, y, d, i) => {
      const fib = LW.noise(x * 0.9 / S, y * 0.06 / S) * 0.5 + LW.noise2(x * 0.08 / S, y * 0.8 / S) * 0.5;
      const v = 200 + 40 * hash(x, y, 3) + 15 * fib;
      d[i] = v; d[i + 1] = v * 0.985; d[i + 2] = v * 0.95; d[i + 3] = 255;
    });
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.16;
    g.drawImage(tooth, 0, 0);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = 0.05;
    g.drawImage(tooth, 0, 0);
    g.restore();
  };
})();
