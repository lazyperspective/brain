/* print.js: overprint glow around the lights, then a paper/ink texture pass:
   grain, fibre mottling, dry-ink holidays in solid darks, faint plate edge. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(1001);
  const N2 = new LW.Noise(1002);

  LW.drawGlow = function (ctx, S) {
    // the lantern's halo as engraved stipple: dot density falls off with distance
    const [lx, ly] = L.lantern;
    const rng = new LW.RNG('halo-stipple');
    ctx.save();
    const cols = [P.warm5, P.warm6, P.warm4];
    for (let i = 0; i < 5200; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = 26 + Math.pow(rng.next(), 1.6) * 170;
      const p = Math.pow(1 - (r - 26) / 170, 2.2);
      if (rng.next() > p) continue;
      const x = lx + Math.cos(a) * r, y = ly + Math.sin(a) * r * 1.08;
      ctx.fillStyle = LW.rgb(cols[i % 3], 0.55 + 0.4 * p);
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rng.next() * 1.3 * (0.4 + p), 0, Math.PI * 2);
      ctx.fill();
    }
    // a tight bloom ring right at the glass
    ctx.strokeStyle = LW.rgb(P.warm5, 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(lx, ly + 2, 30, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  };


  /* Near-plane shadow plate: two flat overprint steps toward the ink along the bottom
     edge (ragged, hand-cut edges), so the nearest ground is the darkest thing in the
     print. Lights (glitter, lantern reflection) are left open. */
  LW.drawNearShade = function (ctx, S) {
    const y0 = 3380;
    const py0 = Math.floor(y0 * S), w = ctx.canvas.width, h = ctx.canvas.height - py0;
    const img = ctx.getImageData(0, py0, w, h);
    const d = img.data;
    const K = P.ink;
    for (let py = 0; py < h; py++) {
      const y = (py0 + py + 0.5) / S;
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / S;
        const k = (py * w + px) * 4;
        const r = d[k], g = d[k + 1], b = d[k + 2];
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        if (lum > 150 || r > g + 40) continue;
        // the boundary sags toward the corners
        const cx = Math.abs(x - 1180) / 1080;
        const e = y + 140 * cx * cx + 34 * N.fbm(x / 140, 3.3, 3) + 9 * N2.n2(x / 21, y / 17);
        const t = e > 3720 ? 0.3 : e > 3540 ? 0.17 : 0;
        if (!t) continue;
        d[k] = r + (K[0] - r) * t;
        d[k + 1] = g + (K[1] - g) * t;
        d[k + 2] = b + (K[2] - b) * t;
      }
    }
    ctx.putImageData(img, 0, py0);
  };

  LW.drawPrint = function (ctx, S) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const paper = P.paper;
    for (let py = 0; py < h; py++) {
      const y = py / S;
      for (let px = 0; px < w; px++) {
        const k = (py * w + px) * 4;
        const x = px / S;
        let r = d[k], g = d[k + 1], b = d[k + 2];
        const lum = 0.3 * r + 0.59 * g + 0.11 * b;
        // grain: fine white noise + soft mottling
        const hsh = LW.hash2(px * 1.7 + 3, py * 1.3 + 7);
        const grain = (hsh - 0.5) * 10 + N.n2(x / 3.1, y / 3.1) * 4 + N2.n2(x / 60, y / 60) * 3;
        r += grain; g += grain; b += grain * 0.9;
        // dry ink: tiny paper flecks in the darkest solids
        if (lum < 45) {
          const f = N.n2(x / 2.3, y / 2.3) + (hsh - 0.5) * 0.6;
          if (f > 0.62) {
            const t = Math.min(0.55, (f - 0.62) * 2.4);
            r += (paper[0] * 0.35 - r) * t * 0.5; g += (paper[1] * 0.35 - g) * t * 0.5; b += (paper[2] * 0.4 - b) * t * 0.5;
          }
        }
        d[k] = r < 0 ? 0 : r > 255 ? 255 : r;
        d[k + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        d[k + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
})();
