// THE PHOENIX UNFOLDS — composition pipeline. PU.render(canvas, {seed, size}) is deterministic.
(function (G) {
  const PU = G.PU;

  PU.render = async function (canvas, opts = {}) {
    const seed = opts.seed != null ? opts.seed : 1789;
    const size = opts.size || 4000;
    const S = size / PU.W;
    const T0 = performance.now();
    const log = (m) => {
      const t = ((performance.now() - T0) / 1000).toFixed(1);
      (opts.log || console.log)(`[${t}s] ${m}`);
    };
    const tick = () => new Promise((r) => setTimeout(r, 0));
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(S, 0, 0, S, 0, 0);

    const light = PU.buildLightCanvas(S);
    PU.renderSky(ctx, S, seed, light);
    PU.renderSmokeVolumes(ctx, seed, S);
    PU.renderMoon(ctx, seed);
    log('sky');
    await tick();

    const g = PU.phoenixGeometry(seed);
    const fire = PU.renderPhoenixFire(S, seed, g);
    log('phoenix');
    await tick();
    // volumetric glow: blurred copies of the fire layer
    PU.blitScaled(ctx, PU.blurred(fire.layer, 16, 320), 'lighter', 0.4);
    PU.blitScaled(ctx, PU.blurred(fire.layer, 8, 90), 'lighter', 0.3);
    PU.blit(ctx, fire.layer, 'lighter', 1);
    PU.blitScaled(ctx, PU.blurred(fire.layer, 4, 18), 'lighter', 0.2);
    PU.blitScaled(ctx, PU.renderSmoke(S, fire.smoke), 'source-over', 1);
    PU.moonVeil(ctx, seed);
    PU.drawEye(ctx, g);
    PU.drawEmbers(ctx, fire.embers);
    log('phoenix composite');
    await tick();

    if (PU.renderStoriesSky) PU.renderStoriesSky(ctx, S, seed, g);
    PU.renderClouds(ctx, seed, S);
    log('clouds');

    const city = PU.buildCity(S, seed, light);
    log('city');
    await tick();

    PU.blit(ctx, city.far);
    // atmospheric fog lit by the bird, between far and mid
    {
      const F = PU.layer(S);
      const fc = F.ctx;
      const gr = fc.createLinearGradient(0, 2500, 0, 3320);
      gr.addColorStop(0, 'rgba(255,255,255,0)');
      gr.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      gr.addColorStop(1, 'rgba(255,255,255,0.85)');
      fc.fillStyle = gr;
      fc.fillRect(0, 2500, PU.W, 900);
      fc.save();
      fc.setTransform(1, 0, 0, 1, 0, 0);
      fc.globalCompositeOperation = 'source-in';
      fc.drawImage(light, 0, 0);
      fc.restore();
      PU.blit(ctx, F, 'lighter', 0.32);
      ctx.save();
      const vg = ctx.createLinearGradient(0, 2500, 0, 3330);
      vg.addColorStop(0, 'rgba(40,16,40,0)');
      vg.addColorStop(1, 'rgba(40,16,40,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 2500, PU.W, 840);
      ctx.restore();
    }
    if (PU.renderStoriesBehindMid) PU.renderStoriesBehindMid(ctx, S, seed, g);
    PU.blit(ctx, city.mid);
    // glowing mist pooled in the streets along the river (lit by the bird)
    {
      const M = PU.layer(S * 0.5);
      const mc = M.ctx;
      const mr = PU.rngFor(seed, 'mist');
      for (let i = 0; i < 160; i++) {
        const x = mr.r(-300, 4000),
          y = mr.r(3080, 3300);
        const len = mr.r(300, 900);
        const pts = [];
        for (let k = 0; k <= 5; k++) pts.push({ x: x + (len * k) / 5, y: y + Math.sin(k + i) * 8 });
        const li = PU.lightAt(x + len / 2, y - 200);
        PU.bristleStroke(mc, mr, pts, mr.r(30, 70), () => PU.mix3([70, 40, 70], li, 0.6), 0.05, 6);
      }
      PU.blitScaled(ctx, PU.blurred(M, 1, 8), 'lighter', 1);
    }

    // violet haze over the mid city so the near quay houses stand forward
    {
      ctx.save();
      const hz = ctx.createLinearGradient(0, 2300, 0, 3320);
      hz.addColorStop(0, 'rgba(70,34,70,0)');
      hz.addColorStop(1, 'rgba(70,34,70,0.22)');
      ctx.fillStyle = hz;
      ctx.fillRect(0, 2300, PU.W, 1020);
      ctx.restore();
    }
    if (PU.renderStoriesAfterMid) PU.renderStoriesAfterMid(ctx, S, seed, g);
    const water = PU.renderWater(S, seed, g, city, PU.waterExtras || []);
    PU.blit(ctx, water, 'source-over', 1, 0, Math.round(3300 * S));
    PU.blit(ctx, city.near);
    PU.blitScaled(ctx, city.glow, 'lighter', 1);
    log('water + near');
    await tick();

    if (PU.renderStoriesFront) PU.renderStoriesFront(ctx, S, seed, g, city);
    log('stories');
    await tick();

    PU.postProcess(canvas, S, seed);
    log('post');
    return canvas;
  };
})(typeof window !== 'undefined' ? window : globalThis);
