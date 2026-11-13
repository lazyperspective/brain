// THE PHOENIX UNFOLDS — the river: city reflection, the unburned blue bird, rippled light.
(function (G) {
  const PU = G.PU;
  const { lerp, clamp, smooth } = PU;
  const TAU = Math.PI * 2;
  const Y0 = 3300; // water layer origin
  const AXIS = 3334; // mirror axis for the city

  // ghost mapping: the whole bird, flipped and squashed into the river
  PU.GHOST_K = 0.29;
  PU.GHOST_A = 3986 + 240 * 0.29;
  PU.ghostY = (y) => PU.GHOST_A - PU.GHOST_K * y;

  PU.renderWater = function (S, seed, g, city, extras) {
    const rng = PU.rngFor(seed, 'water');
    const noise = PU.makeNoise(PU.hashStr(seed + 'water'));
    const W = PU.layer(S, PU.W, 700, 0, Y0);
    const ctx = W.ctx;
    // base: reflected horizon glow fading to deep water
    let gr = ctx.createLinearGradient(0, AXIS, 0, 4000);
    gr.addColorStop(0, '#2b0f1b');
    gr.addColorStop(0.25, '#150914');
    gr.addColorStop(1, '#06050c');
    ctx.fillStyle = gr;
    ctx.fillRect(0, Y0, PU.W, 700);
    // warm reflected tail glow (centre) & ember glow (right)
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, rx, ry, c, a) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(rx / ry, 1);
      const g2 = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
      g2.addColorStop(0, PU.rgba(c, a));
      g2.addColorStop(1, PU.rgba(c, 0));
      ctx.fillStyle = g2;
      ctx.fillRect(-ry, -ry, 2 * ry, 2 * ry);
      ctx.restore();
    };
    glow(1950, AXIS + 40, 700, 260, [255, 110, 40], 0.35);
    glow(3500, AXIS + 80, 700, 330, [255, 140, 50], 0.25);
    glow(2500, AXIS + 30, 160, 260, [255, 200, 110], 0.4);

    // the unburned bird, cool blue
    const GL = PU.layer(S, PU.W, 700, 0, Y0);
    GL.ctx.fillStyle = '#000';
    GL.ctx.fillRect(0, Y0, PU.W, 700);
    GL.ctx.setTransform(S, 0, 0, -PU.GHOST_K * S, 0, (PU.GHOST_A - Y0) * S);
    PU.renderGhostBird(GL.ctx, seed, g, false);
    // the head and crest, compressed less so they still read as a head
    {
      const k = 0.55,
        ey = PU.ghostY(PU.EYE.y);
      // y' = ey - k*(y - EYE.y)
      GL.ctx.setTransform(S, 0, 0, -k * S, 0, (ey + k * PU.EYE.y - Y0) * S);
      PU.renderGhostBird(GL.ctx, seed, g, true);
    }
    // moon reflection
    ctx.globalCompositeOperation = 'lighter';
    PU.blitScaled(ctx, PU.blurred(GL, 2, 6), 'lighter', 0.5);
    PU.blit(ctx, GL, 'lighter', 0.75);
    // the reflected eye: calm, open, blue — not burning
    {
      const ex = PU.EYE.x,
        ey = PU.ghostY(PU.EYE.y);
      glow(ex, ey, 60, 26, [120, 200, 255], 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#02060c';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 24, 13, 0, 0, TAU);
      ctx.fill();
      const ig = ctx.createRadialGradient(ex, ey, 1, ex, ey, 16);
      ig.addColorStop(0, '#f0fbff');
      ig.addColorStop(0.45, '#8fd0ff');
      ig.addColorStop(1, '#123a66');
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 16, 10, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#01040a';
      ctx.beginPath();
      ctx.ellipse(ex + 1, ey, 6, 6, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ex - 5, ey - 3, 2.5, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
    }
    const my = PU.ghostY(PU.MOON.y);
    glow(PU.MOON.x, my, 70, 26, [200, 220, 255], 0.75);
    glow(PU.MOON.x, my, 200, 60, [120, 150, 220], 0.25);

    // city reflection (dark, fading with depth)
    const R = PU.layer(S, PU.W, 700, 0, Y0);
    R.ctx.setTransform(1, 0, 0, -1, 0, (2 * AXIS - Y0) * S);
    for (const k of ['mid', 'near']) R.ctx.drawImage(city[k], 0, 0);
    R.ctx.setTransform(S, 0, 0, S, 0, -Y0 * S);
    R.ctx.globalCompositeOperation = 'destination-out';
    gr = R.ctx.createLinearGradient(0, AXIS, 0, AXIS + 420);
    gr.addColorStop(0, 'rgba(0,0,0,0.2)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.8)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    R.ctx.fillStyle = gr;
    R.ctx.fillRect(0, Y0, PU.W, 700);
    ctx.globalCompositeOperation = 'source-over';
    PU.blit(ctx, R, 'source-over', 0.7);

    for (const e of extras || []) glow(e.x, e.y, e.rx, e.ry, e.c, e.a);
    // ember rain meeting the river: warm glints and tiny rings on the right
    for (let i = 0; i < 520; i++) {
      const x = rng.r(2500, 4000);
      if (rng.next() > smooth(2500, 3700, x)) continue;
      const y = AXIS + 10 + Math.pow(rng.next(), 1.6) * 640;
      const c = PU.fire(rng.r(0.6, 0.95));
      ctx.fillStyle = PU.rgba(c, rng.r(0.25, 0.7));
      ctx.fillRect(x - rng.r(3, 12), y, rng.r(6, 24), rng.r(1.5, 3));
      if (rng.chance(0.15)) {
        ctx.strokeStyle = PU.rgba(c, 0.25);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(x, y, rng.r(8, 20), rng.r(2, 5), 0, 0, TAU);
        ctx.stroke();
      }
    }

    // ripple displacement (row slices)
    const RP = PU.layer(S, PU.W, 700, 0, Y0);
    const rc = RP.ctx;
    rc.setTransform(1, 0, 0, 1, 0, 0);
    const rows = W.height;
    const step = Math.max(1, Math.round(2 * S));
    for (let yd = 0; yd < rows; yd += step) {
      const yl = Y0 + yd / S;
      const depth = clamp((yl - AXIS) / 660);
      const amp = (2 + 14 * depth * depth) * S;
      const dx = amp * (0.7 * noise.n(yl * 0.03, 3.1) + 0.45 * Math.sin(yl * 0.16 + noise.n(yl * 0.008, 7) * 5));
      rc.drawImage(W, 0, yd, W.width, step, dx, yd, W.width, step);
    }
    // soften into horizontal brushed streaks (manual 1-D blur)
    {
      const tmp = PU.layer(S, PU.W, 700, 0, Y0);
      tmp.ctx.setTransform(1, 0, 0, 1, 0, 0);
      tmp.ctx.drawImage(RP, 0, 0);
      rc.globalAlpha = 0.16;
      for (const o of [-10, -6, -3, 3, 6, 10]) rc.drawImage(tmp, o * S, 0);
      rc.globalAlpha = 1;
    }
    rc.setTransform(S, 0, 0, S, 0, -Y0 * S);
    // lit windows → broken columns of light on the water
    rc.globalCompositeOperation = 'lighter';
    for (const k of ['midWindows', 'nearWindows']) {
      for (const w of city[k]) {
        if (w.lit < 0.55 || w.y < 2800) continue;
        const ry = 2 * AXIS - w.y;
        if (ry > 3980) continue;
        const n = rng.i(3, 7);
        for (let j = 0; j < n; j++) {
          const yy = ry - 20 + j * rng.r(7, 13);
          const ww = w.w * rng.r(0.6, 1.6);
          rc.fillStyle = `rgba(255,170,85,${(0.28 * w.lit * (1 - j / n)).toFixed(3)})`;
          rc.fillRect(w.x - ww / 2 + rng.r(-3, 3), yy, ww, rng.r(1.5, 3));
        }
      }
    }
    rc.globalCompositeOperation = 'source-over';
    // painterly surface: horizontal dashes catching light
    for (let i = 0; i < 6000; i++) {
      const x = rng.r(-50, 4050);
      const y = AXIS + 8 + Math.pow(rng.next(), 1.3) * 660;
      if (noise.n(x * 0.003, y * 0.012) < rng.r(-0.1, 0.4)) continue;
      const depth = clamp((y - AXIS) / 660);
      const li = PU.lightAt(x, Math.min(y, 3300) - 300);
      const len = rng.r(30, 120) * (0.6 + depth * 1.6);
      const bright = rng.next();
      let col;
      if (bright < 0.4) continue;
      col = PU.mix3([60, 80, 140], li, 0.7);
      rc.strokeStyle = PU.rgba(col, 0.08 + 0.16 * rng.next());
      rc.lineWidth = rng.r(1.2, 3.2) * (0.7 + depth);
      rc.beginPath();
      rc.moveTo(x, y);
      rc.lineTo(x + len, y + rng.r(-1, 1));
      rc.stroke();
    }
    return RP;
  };
})(typeof window !== 'undefined' ? window : globalThis);
