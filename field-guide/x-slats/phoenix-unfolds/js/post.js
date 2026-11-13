// THE PHOENIX UNFOLDS — final light: bloom from the brightest areas, vignette, colour grade.
(function (G) {
  const PU = G.PU;
  const { clamp } = PU;

  PU.postProcess = function (canvas, S, seed) {
    const ctx = canvas.getContext('2d');
    const Wd = canvas.width,
      Hd = canvas.height;
    // --- bloom: threshold a small copy, blur at two radii, add back
    const sw = Math.round(Wd / 8),
      sh = Math.round(Hd / 8);
    const small = document.createElement('canvas');
    small.width = sw;
    small.height = sh;
    const sc = small.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(canvas, 0, 0, sw, sh);
    const id = sc.getImageData(0, 0, sw, sh);
    const d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.3 * d[i] + 0.55 * d[i + 1] + 0.15 * d[i + 2];
      const k = clamp((l - 120) / 135);
      d[i] *= k;
      d[i + 1] *= k;
      d[i + 2] *= k;
    }
    sc.putImageData(id, 0, 0);
    for (const [r, a] of [
      [6, 0.45],
      [22, 0.4],
      [60, 0.35],
    ]) {
      const b = document.createElement('canvas');
      b.width = sw;
      b.height = sh;
      const bc = b.getContext('2d');
      bc.filter = `blur(${((r * S * 4) / 8).toFixed(2)}px)`;
      bc.drawImage(small, 0, 0);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(b, 0, 0, Wd, Hd);
      ctx.restore();
    }
    // --- painterly surface: long low-contrast brush streaks, overlay-blended (structured, not noise)
    {
      const T = document.createElement('canvas');
      T.width = Math.round(Wd / 2);
      T.height = Math.round(Hd / 2);
      const tc = T.getContext('2d');
      tc.fillStyle = '#808080';
      tc.fillRect(0, 0, T.width, T.height);
      tc.setTransform(S / 2, 0, 0, S / 2, 0, 0);
      const rng = PU.rngFor(seed, 'canvas-tex');
      const noise = PU.makeNoise(PU.hashStr(seed + 'tex'));
      tc.lineCap = 'round';
      for (let i = 0; i < 9000; i++) {
        const x = rng.r(-100, 4100),
          y = rng.r(-100, 4100);
        const a = noise.n(x * 0.0007, y * 0.0007) * 1.6 + (y < 2400 ? 0 : 0.1);
        const len = rng.r(60, 260);
        const v = rng.chance(0.5) ? 255 : 0;
        tc.strokeStyle = `rgba(${v},${v},${v},${rng.r(0.03, 0.08).toFixed(3)})`;
        tc.lineWidth = rng.r(4, 18);
        tc.beginPath();
        tc.moveTo(x, y);
        tc.quadraticCurveTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5 + rng.r(-10, 10), x + Math.cos(a) * len, y + Math.sin(a) * len);
        tc.stroke();
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.5;
      ctx.drawImage(T, 0, 0, Wd, Hd);
      ctx.restore();
    }
    // --- vignette (gentle; keeps strip edges alive)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const vg = ctx.createRadialGradient(Wd * 0.5, Hd * 0.45, Wd * 0.35, Wd * 0.5, Hd * 0.5, Wd * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(4,0,8,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, Wd, Hd);
    ctx.restore();
    // --- grade: violet shadows, gold highlights, gentle S-curve (row chunks to limit memory)
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 255;
      const s = x < 0.5 ? 0.5 * Math.pow(2 * x, 1.22) : 1 - 0.5 * Math.pow(2 * (1 - x), 1.08);
      lut[i] = s * 255;
    }
    const chunk = 256;
    for (let y = 0; y < Hd; y += chunk) {
      const h = Math.min(chunk, Hd - y);
      const im = ctx.getImageData(0, y, Wd, h);
      const p = im.data;
      for (let i = 0; i < p.length; i += 4) {
        let r = lut[p[i]],
          g = lut[p[i + 1]],
          b = lut[p[i + 2]];
        const l = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        const sh = (1 - l) * (1 - l);
        // shadows lean violet
        r += 5 * sh;
        g += 1 * sh;
        b += 10 * sh;
        // highlights lean gold
        const hi = l * l;
        r += 6 * hi;
        g += 2 * hi;
        b -= 8 * hi;
        p[i] = r;
        p[i + 1] = g;
        p[i + 2] = b;
      }
      ctx.putImageData(im, 0, y);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
