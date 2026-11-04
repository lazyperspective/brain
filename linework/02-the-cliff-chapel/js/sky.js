// sky.js - flat teal sky in three screen-print tones joined by ruled-line
// transitions, plus engraved horizontal rules thickening toward the zenith.
(function () {
  'use strict';
  const LW = window.LW, C = LW.C;

  // fill band transition: lines of colour `col` over the area, width shrinking downward
  function lineBlend(g, y0, y1, col, sp, seed) {
    g.save();
    g.fillStyle = col;
    const pen = new LW.Pen();
    for (let y = y0; y < y1; y += sp) {
      const t = (y - y0) / (y1 - y0); // 0 -> full colour, 1 -> none
      const w = sp * (1 - t) * 1.05;
      if (w < 0.3) continue;
      const pts = [];
      const a = LW.clamp(t * 3, 0, 1) * 2.5;
      for (let x = -20; x <= LW.W + 20; x += 24) pts.push([x, y + LW.noise3(x * 0.004 + seed, y * 0.05) * a]);
      pen.line(pts, (tt, i) => w * (t < 0.15 ? 1.15 : 0.75 + 0.5 * (0.5 + 0.5 * LW.noise2(pts[i][0] * 0.01, y * 0.1 + seed))), 0.0);
    }
    pen.draw(g, col);
    g.restore();
  }

  LW.drawSky = async function () {
    const g = LW.fill, W = LW.W, H = LW.H, HY = LW.HORIZON;
    g.fillStyle = C.sky;
    g.fillRect(-10, -10, W + 20, H + 20);
    // deep top band
    g.fillStyle = C.skyDeep;
    g.fillRect(-10, -10, W + 20, 386);
    lineBlend(g, 380, 860, C.skyDeep, 4.5, 1);
    // pale haze toward the horizon
    g.fillStyle = C.skyHaze;
    g.fillRect(-10, HY - 560, W + 20, 570);
    // haze transition: sky-coloured lines over haze, thinning downward
    lineBlend(g, HY - 560, HY - 200, C.sky, 4.5, 3);
    // ink rules in the upper sky (dark teal), density fading downward
    const pen = new LW.Pen();
    const bb = { x0: -10, y0: -10, x1: W + 10, y1: 330 };
    LW.hatchDither(pen, bb, -0.01, {
      spacing: 7.5,
      step: 8,
      wob: 2.2,
      seed: 7,
      jitter: 0.25,
      dark: (x, y) => 0.6 * Math.pow(LW.clamp(1 - y / 320, 0, 1), 1.4) + 0.1 * LW.noise(x * 0.0015, y * 0.01),
      w: (x, y, d) => 0.5 + 1.2 * d,
      taper: 0.4,
    });
    pen.draw(LW.ink, '#1a4c55', 0.9);
  };
})();
