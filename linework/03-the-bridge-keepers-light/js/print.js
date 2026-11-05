/* print.js: overprint glow around the lights, then a paper/ink texture pass:
   grain, fibre mottling, dry-ink holidays in solid darks, faint plate edge. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(1001);
  const N2 = new LW.Noise(1002);

  LW.drawGlow = function (ctx, S) {
    // the lantern's halo as engraving: broken concentric rings, tighter and brighter near the glass,
    // crossed by fine tapered rays
    const [lx, ly] = L.lantern;
    const rng = new LW.RNG('halo-rings');
    const ink = new LW.Ink(1003);
    ink.wobble = 0.25;
    const cR = [ink.col(P.warm6), ink.col(P.warm5), ink.col(P.warm4), ink.col(P.warm3)];
    ctx.save();
    const NR = 17;
    for (let k = 0; k < NR; k++) {
      const r = 32 + k * 4 + k * k * 0.18;
      const fall = 1 - k / NR;
      const ph = rng.next() * 6.283;
      const pts = [];
      for (let a = 0; a <= Math.PI * 2 + 0.001; a += 0.03) pts.push([lx + Math.cos(a + ph) * r, ly + 2 + Math.sin(a + ph) * r * 1.08]);
      ink.line(pts, (x, y, i) => {
        // the inner rings are nearly whole; further out they break into short engraved dashes
        if (N.n2(i / (2.2 + 3.5 * fall) + k * 4.1, k * 1.7) > 0.62 - 0.95 * (1 - fall)) return -1;
        return ink.st(cR[k < 4 ? 0 : k < 8 ? 1 : k < 12 ? 2 : 3], 0.6 + 2.2 * Math.pow(fall, 1.4));
      }, { taper: 8, minScale: 0.2 });
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
      const r0 = 30 + rng.next() * 4;
      const len = (i % 3 === 0 ? 62 : 30) * (0.7 + rng.next() * 0.6);
      const p0 = [lx + Math.cos(a) * r0, ly + 2 + Math.sin(a) * r0 * 1.08];
      const p1 = [lx + Math.cos(a) * (r0 + len), ly + 2 + Math.sin(a) * (r0 + len) * 1.08];
      ink.line([p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], p1], ink.st(cR[0], i % 3 === 0 ? 2.0 : 1.4), { taper: len * 0.9, minScale: 0.05 });
    }
    ink.flush(ctx);
    // a tight bloom ring right at the glass
    ctx.strokeStyle = LW.rgb(P.warm5, 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(lx, ly + 2, 30, 36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
        // plate wiping: a faint horizontal drag in the grain
        const wipe = N2.n2(x / 1.4, y / 9) * 1.6;
        r += wipe; g += wipe; b += wipe;
        // stray ink specks and starved-ink holidays (2x2 px), balanced so value holds
        const hb = LW.hash2((px >> 1) * 7 + 11, (py >> 1) * 5 + 3);
        if (hb < 0.0018 && lum > 55) { r *= 0.62; g *= 0.62; b *= 0.66; }
        else if (hb > 0.9982 && lum > 30 && lum < 110) { r += (paper[0] * 0.5 - r) * 0.22; g += (paper[1] * 0.5 - g) * 0.22; b += (paper[2] * 0.5 - b) * 0.22; }
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
