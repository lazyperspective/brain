/* water.js: the glowing river.
   Reflections are kept as three small semantic buffers (darkness, firelight,
   moonlight) captured with mirror transforms as each element is drawn. The
   water shader samples them through horizontally-sheared ripple bands, which
   breaks every reflection into line fragments, then ripple dashes are inked. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P, L = LW.L;
  const N = new LW.Noise(601);
  const N2 = new LW.Noise(602);
  const RES = 0.5; // reflection buffer scale
  const HZ = L.VP[1];

  // ---------------------------------------------------------------- reflection buffers
  const R = (LW.refl = {});
  function mk() {
    const c = LW.mkCanvas(LW.W * RES, LW.H * RES);
    const x = c.getContext('2d', { willReadFrequently: true });
    return { c, x };
  }
  LW.reflInit = function () {
    R.dark = mk(); R.warm = mk();
    // sky reflection: lighter just under the horizon (the glow), darker toward us
    const g = R.dark.x.createLinearGradient(0, HZ * RES, 0, LW.H * RES);
    const gv = (v) => { const k = Math.round(v * 255); return `rgb(${k},${k},${k})`; };
    g.addColorStop(0, gv(0.08));
    g.addColorStop(0.25, gv(0.2));
    g.addColorStop(1, gv(0.34));
    R.dark.x.fillStyle = g;
    R.dark.x.fillRect(0, 0, LW.W * RES, LW.H * RES);
    R.warm.x.fillStyle = '#000';
    R.warm.x.fillRect(0, 0, LW.W * RES, LW.H * RES);
  };
  // mirror about the line y = a + b*x (vertical reflection), fill a path with a value
  LW.reflFill = function (which, path, a, b, value, fillStyle) {
    const t = R[which].x;
    t.save();
    t.setTransform(RES, RES * 2 * b, 0, -RES, 0, RES * 2 * a);
    if (fillStyle) t.fillStyle = fillStyle(t);
    else { const k = Math.round(value * 255); t.fillStyle = `rgb(${k},${k},${k})`; }
    t.fill(path);
    t.restore();
  };
  LW.reflFn = function (which, a, b, fn) {
    const t = R[which].x;
    t.save();
    t.setTransform(RES, RES * 2 * b, 0, -RES, 0, RES * 2 * a);
    fn(t);
    t.restore();
  };
  function readBuf(buf) {
    const d = buf.x.getImageData(0, 0, buf.c.width, buf.c.height).data;
    const out = new Float32Array(buf.c.width * buf.c.height);
    for (let i = 0, k = 0; i < out.length; i++, k += 4) out[i] = d[k] / 255;
    // horizontal box blur (twice): reflected edges ramp so fragments can taper
    const W = buf.c.width, Hh = buf.c.height, r = 5;
    const tmp = new Float32Array(W);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < Hh; y++) {
        const o = y * W;
        let acc = 0;
        for (let x = -r; x <= r; x++) acc += out[o + LW.clamp(x, 0, W - 1)];
        for (let x = 0; x < W; x++) {
          tmp[x] = acc / (2 * r + 1);
          acc += out[o + Math.min(W - 1, x + r + 1)] - out[o + Math.max(0, x - r)];
        }
        out.set(tmp, o);
      }
    }
    return { v: out, w: W, h: Hh };
  }
  function sampleBuf(b, x, y) {
    let fx = x * RES - 0.5, fy = y * RES - 0.5;
    fx = LW.clamp(fx, 0, b.w - 1.001); fy = LW.clamp(fy, 0, b.h - 1.001);
    const i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, w = b.w, v = b.v;
    return (v[j * w + i] * (1 - tx) + v[j * w + i + 1] * tx) * (1 - ty) + (v[(j + 1) * w + i] * (1 - tx) + v[(j + 1) * w + i + 1] * tx) * ty;
  }

  // fit y = a + b x through a base polyline's end points
  LW.baseLine = function (base) {
    const p = base[0], q = base[base.length - 1];
    const b = (q[1] - p[1]) / (q[0] - p[0] || 1);
    return [p[1] - b * p[0], b];
  };

  // ---------------------------------------------------------------- ripple bands
  const bands = (() => {
    const rng = new LW.RNG('bands');
    const ys = [HZ - 2];
    while (ys[ys.length - 1] < LW.H + 40) {
      const y = ys[ys.length - 1];
      const h = Math.max(2.2, (y - HZ + 10) / 62) * (0.65 + rng.next() * 0.7);
      ys.push(y + h);
    }
    const dx = ys.map((y) => (rng.next() - 0.5) * (5 + (y - HZ) * 0.05));
    const dy = ys.map((y, i) => (rng.next() - 0.5) * 1.3 * (ys[i + 1] - y || 2));
    const ph = ys.map(() => rng.next() * 100);
    const fx = ys.map(() => 14 + rng.next() * rng.next() * 70);
    return { ys, dx, dy, ph, fx };
  })();
  function bandIndex(y) {
    const ys = bands.ys;
    let lo = 0, hi = ys.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (ys[m] <= y) lo = m; else hi = m;
    }
    return lo;
  }
  // moon glitter path (in water coordinates)
  function moonGlitter(x, y) {
    const [mx, my] = L.moon;
    const ry = 2 * HZ - my; // mirror of the moon about the horizon
    const t = y - HZ;
    if (t < 0) return 0;
    const w = 22 + t * 0.095;
    const g = Math.exp(-Math.pow((x - mx) / w, 2));
    const along = LW.smooth(HZ + 60, ry - 300, y) * (0.55 + 0.45 * LW.smooth(ry + 600, ry - 100, y));
    return g * along;
  }
  LW.moonGlitter = moonGlitter;

  function waterBase(x, y) {
    // inner glow of the river: bright mid-channel and toward the far bend
    let v = 0.62;
    v += 0.16 * Math.exp(-Math.pow((x - 1230) / 520, 2));
    v += 0.12 * LW.smooth(2400, 2120, y);
    v -= 0.16 * LW.smooth(2800, 3840, y) * (0.5 + 0.5 * LW.smooth(900, 1900, Math.abs(x - 1230) + 900));
    return v;
  }

  // ---------------------------------------------------------------- water mask
  function waterMask(S) {
    const w = Math.round(LW.W * S), h = Math.round(LW.H * S);
    const c = LW.mkCanvas(w, h);
    const x = c.getContext('2d');
    x.setTransform(S, 0, 0, S, 0, 0);
    x.fillStyle = '#fff';
    x.fillRect(0, HZ - 4, LW.W, LW.H);
    x.globalCompositeOperation = 'destination-out';
    for (const l of LW.cliffLayers) x.fill(l.path);
    if (LW.bridgeGeom) { x.fill(LW.bridgeGeom.facePath); x.fill(LW.bridgeGeom.soffitPath); }
    return c;
  }

  // ---------------------------------------------------------------- draw
  const pal = [P.water0, P.water1, P.water2, P.water3, P.water4, P.water5];
  LW.drawWater = function (ctx, S) {
    const t0 = performance.now();
    const D = readBuf(R.dark), Wm = readBuf(R.warm);
    const w = Math.round(LW.W * S), h = Math.round(LW.H * S);
    const layer = LW.mkCanvas(w, h);
    const lx = layer.getContext('2d', { willReadFrequently: true });
    const py0 = Math.floor((HZ - 4) * S);
    const img = lx.createImageData(w, h - py0);
    const d = img.data;
    const off = LW.PLATE_OFF;
    for (let py = 0; py < h - py0; py++) {
      const y = (py0 + py + 0.5) / S - off[1];
      const j = bandIndex(y);
      const by0 = bands.ys[j], by1 = bands.ys[j + 1];
      const amp = 5 + (y - HZ) * 0.05;
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / S - off[0];
        const wav = Math.sin(x / (28 + (y - HZ) * 0.06) + bands.ph[j]) * amp * 0.35 + N2.n2(x / (14 + (y - HZ) * 0.02), j * 7.31) * amp * 0.55;
        const sx = x + bands.dx[j] + wav, sy = y + bands.dy[j];
        const dk = sampleBuf(D, sx, sy);
        const wm = sampleBuf(Wm, sx, sy);
        let mg = moonGlitter(sx, sy) * (1 - LW.smooth(0.45, 0.7, dk));
        const inBand = (y - by0) / (by1 - by0);
        const ib = inBand - 0.5;
        const edge = ib * ib * 4; // 0 mid-band .. 1 at band edges
        // reflections thin out toward each band edge -> lens-shaped fragments
        let v = waterBase(x, y) - dk * 0.62 * (1 - 0.32 * edge) + mg * 0.26 * (1 - 0.6 * edge);
        mg *= 1 - 0.55 * edge;
        v += (LW.hash2(px, py) - 0.5) * 0.04 + N.n2(x / 17, y / 9) * 0.03;
        let c = pal[Math.floor(LW.clamp(v, 0, 0.999) * pal.length)];
        const gate = N2.n2(x / (bands.fx[j] * (0.4 + (y - HZ) / 1400)) + bands.ph[j], j * 3.17) * 0.5 + 0.5;
        if (mg * (0.6 + gate) > 0.78) c = mg * (0.6 + gate) > 1.0 ? P.water6 : P.water5;
        const wb = LW.warmBand(wm * (0.75 + 0.75 * gate) * (1 - 0.5 * edge), x, y, 0.03);
        if (wb >= 2) c = LW.warmFill[Math.min(6, wb)];
        else if (wb === 1) c = LW.mix(c, P.warm2, 0.45);
        const k = (py * w + px) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
    lx.putImageData(img, 0, py0);
    LW.log('water fill ms', Math.round(performance.now() - t0));

    // ---- ripple dashes
    const ink = new LW.Ink(603);
    ink.wobble = 0.5;
    const rng = new LW.RNG('ripples');
    const cDeep = ink.col(P.waterInkDeep), cInk = ink.col(P.waterInk), cMid = ink.col(LW.mix(P.waterInk, P.water2, 0.35));
    const cHi = ink.col(P.water6), cHi2 = ink.col(P.water5);
    const cW = [ink.col(P.warm3), ink.col(P.warm4), ink.col(P.warm5), ink.col(P.warmInk2)];
    for (let j = 0; j < bands.ys.length - 1; j++) {
      const y = bands.ys[j];
      if (y < HZ || y > LW.H + 5) continue;
      const persp = LW.clamp((y - HZ + 30) / 900, 0.05, 2.2);
      let x = -20 + rng.next() * 30;
      while (x < LW.W + 20) {
        const len = (10 + rng.next() * rng.next() * 110) * (0.35 + persp);
        const gap = (6 + rng.next() * 50) * (0.3 + persp * 0.8);
        const cx = x + len / 2;
        const sx = cx + bands.dx[j], sy = y + bands.dy[j];
        const dk = sampleBuf(D, sx, sy);
        const wm = sampleBuf(Wm, sx, sy);
        const mg = moonGlitter(sx, sy) * (1 - LW.smooth(0.45, 0.7, dk));
        let ci = -1, wdt = 0.7 + persp * 1.0;
        const r = rng.next();
        if (wm > 0.32) {
          if (r < 0.75) { ci = wm > 0.75 ? cW[2] : wm > 0.5 ? cW[1] : cW[0]; wdt *= 1.25; }
        } else if (mg > 0.35) {
          if (r < 0.8) { ci = mg > 0.62 ? cHi : cHi2; wdt *= 1.35; }
        } else {
          const p = 0.32 + dk * 0.75;
          if (r < p) ci = dk > 0.6 ? cDeep : dk > 0.4 ? cInk : cMid;
        }
        if (ci >= 0) {
          const pts = [];
          const n = Math.max(2, Math.round(len / 7));
          const curv = (rng.next() - 0.5) * 1.6 * (0.4 + persp);
          for (let k = 0; k <= n; k++) {
            const t = k / n;
            const xx = x + len * t;
            pts.push([xx, y + Math.sin(t * Math.PI) * curv + N.n2(xx / 50, y / 20) * 0.8 * persp]);
          }
          ink.line(pts, ink.st(ci, wdt), { taper: Math.min(len * 0.35, 18), minScale: 0.25 });
        }
        x += len + gap;
      }
    }
    // the lantern's reflection: an engraver's column of tapered warm dashes
    {
      const [lx] = L.lantern;
      const rr = new LW.RNG('lantern-refl');
      const cols = [ink.col(P.warm6), ink.col(P.warm5), ink.col(P.warm4), ink.col(P.warm3), ink.col(P.warm2)];
      for (let i = 0; i < 520; i++) {
        const y = 2935 + Math.pow(rr.next(), 1.3) * 640;
        const t = (y - 2935) / 640;
        const spread = 16 + t * 70;
        const x = lx + 8 + rr.gauss() * spread * 0.55;
        const core = Math.exp(-Math.pow((x - lx - 8) / spread, 2));
        if (rr.next() > core * (1.05 - t * 0.6)) continue;
        const len = (8 + rr.next() * rr.next() * 70) * (0.6 + t);
        const ci = core > 0.8 && t < 0.4 ? 0 : core > 0.6 ? 1 : core > 0.35 ? 2 : core > 0.18 ? 3 : 4;
        const yy = y + (rr.next() - 0.5) * 2;
        const pts = [[x - len / 2, yy], [x - len / 6, yy + 0.6], [x + len / 6, yy - 0.4], [x + len / 2, yy]];
        ink.line(pts, ink.st(cols[ci], 1.6 + core * 3.2 * (0.5 + t)), { taper: len * 0.45, minScale: 0.15, wobble: 0.4 });
      }
    }
    // concentric ripple rings around the abutment feet and near-shore stones
    const rings = [[840, L.waterY + 4, 60, 9], [1480, L.waterY + 4, 60, 9], [1662, L.waterY + 6, 70, 8]];
    for (const [rx, ry, rr, cnt] of rings) {
      for (let k = 1; k <= cnt; k++) {
        const R0 = rr * (0.3 + k * 0.28), ry0 = R0 * 0.16;
        const pts = [];
        for (let a = 0; a <= Math.PI; a += 0.04) pts.push([rx + Math.cos(a) * R0, ry + Math.sin(a) * ry0 + 3]);
        ink.line(pts, (xx, yy) => (N.n2(xx / 25, k * 3.3) > 0.3 ? -1 : ink.st(cInk, 1.4 - k * 0.08)), { taper: 10 });
      }
    }
    lx.setTransform(S, 0, 0, S, 0, 0);
    ink.flush(lx);

    // ---- mask to visible water and composite (fills misregistered, ink not)
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.globalCompositeOperation = 'destination-in';
    lx.drawImage(waterMask(S), 0, 0);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
    LW.log('water ms', Math.round(performance.now() - t0));
  };
})();
