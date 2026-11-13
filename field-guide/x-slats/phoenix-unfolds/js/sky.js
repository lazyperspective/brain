// THE PHOENIX UNFOLDS — night sky, moon, light field, painterly cloud & smoke strokes.
(function (G) {
  const PU = G.PU;
  const { lerp, clamp, smooth } = PU;
  const TAU = Math.PI * 2;

  // warm light sources cast by the bird (logical coords) + cool moonlight
  PU.LIGHTS = [
    { x: 1900, y: 1750, r: 2100, c: [255, 130, 50], a: 0.9 },
    { x: 1950, y: 2950, r: 1000, c: [255, 120, 40], a: 0.9 }, // tail plume behind the city
    { x: 900, y: 900, r: 1300, c: [230, 90, 40], a: 0.45 },
    { x: 3050, y: 900, r: 1300, c: [230, 90, 40], a: 0.45 },
    { x: 3450, y: 2900, r: 1000, c: [255, 150, 60], a: 0.75 }, // ember rain
    { x: 2500, y: 2600, r: 700, c: [255, 190, 90], a: 0.5 }, // liquid-light fall
  ];
  PU.MOONLIGHT = { x: 700, y: 900, r: 1900, c: [80, 115, 190], a: 0.4 };

  PU.lightAt = function (x, y) {
    let r = 0,
      g = 0,
      b = 0;
    for (const L of PU.LIGHTS.concat([PU.MOONLIGHT])) {
      const d = Math.hypot(x - L.x, y - L.y) / L.r;
      if (d >= 1) continue;
      const k = L.a * Math.pow(1 - d, 2);
      r += L.c[0] * k;
      g += L.c[1] * k;
      b += L.c[2] * k;
    }
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  };

  PU.buildLightCanvas = function (S) {
    const L = PU.layer(S * 0.25);
    const ctx = L.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, PU.W, PU.H);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of PU.LIGHTS.concat([PU.MOONLIGHT])) {
      const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        gr.addColorStop(t, PU.rgba(l.c, l.a * Math.pow(1 - t, 2)));
      }
      ctx.fillStyle = gr;
      ctx.fillRect(l.x - l.r, l.y - l.r, 2 * l.r, 2 * l.r);
    }
    // upscale to full layer
    const F = PU.layer(S);
    F.ctx.setTransform(1, 0, 0, 1, 0, 0);
    F.ctx.imageSmoothingQuality = 'high';
    F.ctx.drawImage(L, 0, 0, F.width, F.height);
    return F;
  };

  // brushy stroke: a bundle of bristles following a polyline
  PU.bristleStroke = function (ctx, rng, pts, width, colorFn, alpha, nBr = 10) {
    const rs = PU.resample(pts, Math.max(6, Math.round(PU.polyLen(pts) / 18)));
    ctx.lineCap = 'round';
    for (let b = 0; b < nBr; b++) {
      const o = rng.r(-0.5, 0.5);
      const t0 = rng.r(0, 0.2),
        t1 = rng.r(0.75, 1);
      const col = colorFn(o, b);
      ctx.strokeStyle = PU.rgba(col, alpha * rng.r(0.5, 1));
      ctx.lineWidth = (width / nBr) * rng.r(1.2, 2.6);
      ctx.beginPath();
      const n = 16;
      for (let k = 0; k <= n; k++) {
        const t = lerp(t0, t1, k / n);
        const p = PU.at(rs, t);
        const taper = Math.sin(Math.PI * clamp((t - t0) / (t1 - t0))) ** 0.4;
        const x = p.x + p.nx * o * width * taper,
          y = p.y + p.ny * o * width * taper;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  };

  PU.renderSky = function (ctx, S, seed, light) {
    const rng = PU.rngFor(seed, 'sky');
    const noise = PU.makeNoise(PU.hashStr(seed + 'sky'));
    // base gradient: black-violet zenith to ember-maroon horizon
    const gr = ctx.createLinearGradient(0, 0, 0, PU.WATER);
    gr.addColorStop(0, '#040208');
    gr.addColorStop(0.3, '#0a0512');
    gr.addColorStop(0.6, '#170919');
    gr.addColorStop(0.82, '#2a0d1a');
    gr.addColorStop(1, '#3a1218');
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, PU.W, PU.WATER + 40);
    // sky lit by the bird
    PU.blit(ctx, light, 'lighter', 0.32);

    // painterly sky: long low-alpha horizontal brush bands
    for (let i = 0; i < 260; i++) {
      const y = rng.r(-50, PU.WATER - 200);
      const x = rng.r(-400, PU.W);
      const len = rng.r(500, 1600);
      const pts = [];
      const tilt = rng.r(-0.06, 0.04);
      for (let k = 0; k <= 6; k++) {
        const xx = x + (len * k) / 6;
        pts.push({ x: xx, y: y + tilt * (xx - x) + 30 * noise.n(xx * 0.0015, y * 0.002) });
      }
      const L = PU.lightAt(x + len / 2, y);
      const base = PU.mix3([22, 12, 34], [70, 30, 40], clamp(y / 3000));
      const col = PU.mix3(base, [L[0] * 0.5, L[1] * 0.4, L[2] * 0.5], 0.35);
      PU.bristleStroke(ctx, rng, pts, rng.r(40, 140), (o) => PU.mix3(col, [col[0] * 1.4, col[1] * 1.2, col[2] * 1.3], o + 0.5), 0.05, 8);
    }

    // stars, only in the darkest upper sky, sparse and structured
    ctx.save();
    for (let i = 0; i < 300; i++) {
      const x = rng.r(0, PU.W),
        y = rng.r(0, 1700) * rng.r(0.3, 1);
      const r = rng.chance(0.06) ? rng.r(2.2, 3.6) : rng.r(0.9, 1.8);
      const tw = rng.r(0.25, 0.9);
      ctx.fillStyle = `rgba(${rng.chance(0.3) ? '255,220,190' : '200,215,255'},${tw})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      if (r > 2.2) {
        ctx.strokeStyle = 'rgba(210,220,255,0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - r * 4, y);
        ctx.lineTo(x + r * 4, y);
        ctx.moveTo(x, y - r * 4);
        ctx.lineTo(x, y + r * 4);
        ctx.stroke();
      }
    }
    ctx.restore();
  };

  PU.renderMoon = function (ctx, seed) {
    const m = PU.MOON;
    const noise = PU.makeNoise(PU.hashStr(seed + 'moon'));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let gr = ctx.createRadialGradient(m.x, m.y, m.r * 0.8, m.x, m.y, m.r * 7);
    gr.addColorStop(0, 'rgba(120,160,230,0.32)');
    gr.addColorStop(0.25, 'rgba(70,100,180,0.12)');
    gr.addColorStop(1, 'rgba(40,60,120,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(m.x - m.r * 7, m.y - m.r * 7, m.r * 14, m.r * 14);
    ctx.globalCompositeOperation = 'source-over';
    gr = ctx.createRadialGradient(m.x - m.r * 0.3, m.y - m.r * 0.3, 0, m.x, m.y, m.r);
    gr.addColorStop(0, '#f4f7ff');
    gr.addColorStop(0.7, '#d8e2f4');
    gr.addColorStop(1, '#a9b9d8');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.fill();
    // maria
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, TAU);
    ctx.clip();
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996,
        rr = m.r * Math.sqrt(i / 70);
      const x = m.x + Math.cos(a) * rr,
        y = m.y + Math.sin(a) * rr;
      const v = noise.fbm(x * 0.03, y * 0.03, 3);
      if (v > 0.05) {
        ctx.fillStyle = `rgba(110,125,160,${Math.min(0.35, v * 0.8)})`;
        ctx.beginPath();
        ctx.arc(x, y, m.r * 0.22, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.restore();
  };

  // billowing smoke volumes around the bird, lit from inside by its fire
  PU.renderSmokeVolumes = function (mainCtx, seed, S) {
    const rng = PU.rngFor(seed, 'smokevol');
    const SL = PU.layer(S * 0.5);
    const ctx = SL.ctx;
    const zones = [
      { x0: 300, x1: 3700, y0: 60, y1: 520, n: 60, R: [120, 260] }, // above the wings
      { x0: 1450, x1: 2450, y0: 420, y1: 1000, n: 34, R: [100, 200] }, // between the raised wings
      { x0: 0, x1: 1500, y0: 1250, y1: 2150, n: 40, R: [110, 240] }, // under the left wing
      { x0: 2400, x1: 4000, y0: 1300, y1: 2250, n: 30, R: [110, 240] }, // under the right wing
    ];
    ctx.save();
    for (const z of zones) {
      for (let i = 0; i < z.n; i++) {
        const cx = rng.r(z.x0, z.x1),
          cy = rng.r(z.y0, z.y1);
        if (Math.hypot(cx - PU.MOON.x, cy - PU.MOON.y) < 220) continue;
        const R = rng.r(z.R[0], z.R[1]);
        const li = PU.lightAt(cx, cy);
        const lit = PU.mix3([34, 20, 38], [li[0] * 0.8, li[1] * 0.52, li[2] * 0.42], 0.75);
        const dark = [24, 14, 30];
        const arcs = 7;
        for (let k = 0; k < arcs; k++) {
          const a0 = rng.r(0, TAU),
            span = rng.r(1.2, 2.4);
          const rr = R * rng.r(0.35, 1);
          const ox = cx + rng.r(-R, R) * 0.5,
            oy = cy + rng.r(-R, R) * 0.3;
          const pts = [];
          for (let j = 0; j <= 10; j++) {
            const a = a0 + (span * j) / 10;
            pts.push({ x: ox + Math.cos(a) * rr * 1.4, y: oy + Math.sin(a) * rr * 0.8 });
          }
          const below = clamp((oy - cy) / R + 0.5);
          PU.bristleStroke(ctx, rng, pts, R * rng.r(0.35, 0.6), (o) => PU.mix3(dark, lit, clamp(below + o * 0.6)), 0.06, 7);
        }
      }
    }
    ctx.restore();
    PU.blitScaled(mainCtx, PU.blurred(SL, 1, 7), 'source-over', 1);
  };

  // the moon seen through the translucent wing: warm feather barbs cross its face
  PU.moonVeil = function (ctx, seed) {
    const rng = PU.rngFor(seed, 'veil');
    const m = PU.MOON;
    ctx.save();
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r + 1, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,150,90,0.16)';
    ctx.fillRect(m.x - m.r, m.y - m.r, 2 * m.r, 2 * m.r);
    // a feather shaft and its barbs, drawn across the disc
    const ang = 2.42;
    const dx = Math.cos(ang),
      dy = Math.sin(ang);
    for (const off of [-38, 22]) {
      const sx = m.x - dx * 140 + -dy * off,
        sy = m.y - dy * 140 + dx * off;
      ctx.strokeStyle = 'rgba(150,50,20,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + dx * 300, sy + dy * 300);
      ctx.stroke();
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const px = sx + dx * 300 * t,
          py = sy + dy * 300 * t;
        for (const side of [-1, 1]) {
          const ba = ang + side * 0.6;
          const bl = rng.r(30, 55);
          ctx.strokeStyle = `rgba(${rng.chance(0.5) ? '120,40,20' : '255,170,100'},${rng.r(0.12, 0.3)})`;
          ctx.lineWidth = rng.r(1, 2.2);
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.quadraticCurveTo(px + Math.cos(ba) * bl * 0.6, py + Math.sin(ba) * bl * 0.6, px + Math.cos(ba + side * 0.25) * bl, py + Math.sin(ba + side * 0.25) * bl);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  };

  // smoke from the bird: soft, lit by the light field
  PU.renderSmoke = function (S, smoke) {
    const L = PU.layer(S * 0.5);
    const ctx = L.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of smoke) {
      const p = s.pts[Math.floor(s.pts.length / 2)];
      const li = PU.lightAt(p.x, p.y);
      const col = PU.mix3([46, 34, 52], [li[0] * 0.55, li[1] * 0.42, li[2] * 0.4], 0.5);
      ctx.strokeStyle = PU.rgba(col, s.a);
      ctx.lineWidth = s.w;
      PU.poly(ctx, s.pts);
      ctx.stroke();
      ctx.lineWidth = s.w * 0.35;
      ctx.strokeStyle = PU.rgba(PU.mix3(col, [255, 170, 110], 0.25), s.a * 0.8);
      ctx.stroke();
    }
    return PU.blurred(L, 1, 6);
  };

  // drifting cloud banks below and between the wings (scale cue)
  PU.renderClouds = function (mainCtx, seed, S) {
    const rng = PU.rngFor(seed, 'clouds');
    const CL = PU.layer(S * 0.5);
    const ctx = CL.ctx;
    const noise = PU.makeNoise(PU.hashStr(seed + 'clouds'));
    const banks = [
      { y: 2230, x0: -200, x1: 1250, th: 60 },
      { y: 2060, x0: -200, x1: 1000, th: 40 },
      { y: 1880, x0: -200, x1: 700, th: 30 },
      { y: 2350, x0: 2650, x1: 4200, th: 60 },
      { y: 2120, x0: 3000, x1: 4200, th: 40 },
    ];
    for (const b of banks) {
      for (let i = 0; i < 34; i++) {
        const x = rng.r(b.x0, b.x1);
        const y = b.y + rng.g() * b.th;
        const len = rng.r(300, 900);
        const pts = [];
        for (let k = 0; k <= 6; k++) {
          const xx = x + (len * k) / 6;
          pts.push({ x: xx, y: y - Math.sin((k / 6) * Math.PI) * rng.r(0, 30) + 18 * noise.n(xx * 0.003, y * 0.01) });
        }
        const li = PU.lightAt(x + len / 2, y);
        const top = PU.mix3([40, 22, 46], [li[0] * 1.1, li[1] * 0.75, li[2] * 0.55], 0.6);
        const under = PU.mix3([26, 14, 32], top, 0.25);
        PU.bristleStroke(ctx, rng, pts, rng.r(26, 70), (o) => (o < -0.15 ? top : under), 0.2, 12);
      }
    }
    PU.blitScaled(mainCtx, PU.blurred(CL, 1, 3), 'source-over', 1);
  };
})(typeof window !== 'undefined' ? window : globalThis);
