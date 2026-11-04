/* Sky: posterised glow ground, stipple starfield + Milky Way, vortex streamlines. */
(function () {
  'use strict';
  const LW = window.LW, SC = LW.SC, P = LW.P, PL = SC.planet;

  // ---------------------------------------------------------------- background plates
  const BG = [
    [0.0, '#0a1220'], [0.17, '#0e192a'], [0.3, '#142133'], [0.4, '#2e2230'], [0.5, '#5a2b25'],
    [0.6, '#953d24'], [0.7, '#c95b29'], [0.8, '#e88a33'], [0.9, '#f6bb5f'], [1.0, '#fde3a2'], [1.12, '#fff3d0'],
  ].map((b) => [b[0], LW.hex(b[1])]);

  LW.skyValue = function (x, y) {
    return SC.glow(x, y) + 0.22 * SC.vortexLight(x, y) * (0.4 + 0.6 * SC.vortexFade(x, y));
  };

  LW.drawSkyBackground = function (ctx, S) {
    const w = ctx.canvas.width, h = ctx.canvas.height;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const night = BG[0][1];
    for (let py = 0; py < h; py++) {
      const y = (py + 0.5) / S;
      for (let px = 0; px < w; px++) {
        const x = (px + 0.5) / S;
        let c = night;
        if (y > 700) {
          const v = LW.skyValue(x, y) + 0.035 * LW.N1(x * 0.006, y * 0.009) + 0.015 * LW.N2(x * 0.05, y * 0.05);
          for (let k = BG.length - 1; k >= 0; k--) if (v >= BG[k][0]) { c = BG[k][1]; break; }
        }
        const o = (py * w + px) * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  // ---------------------------------------------------------------- stars
  function milky(x, y) {
    // band from lower-left to upper-right
    const ax = 0, ay = 1180, bx = 2160, by = 120;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const t = ((x - ax) * dx + (y - ay) * dy) / (L * L);
    const px = ax + dx * t, py = ay + dy * t;
    let dist = Math.hypot(x - px, y - py) * Math.sign((x - px) * -dy + (y - py) * dx);
    dist += 120 * LW.fbm(LW.N3, t * 3.2, 0.5, 3);
    const w = 260 + 90 * LW.N1(t * 2.1, 3.3);
    const band = Math.exp(-((dist / w) ** 2));
    const clumps = 0.55 + 0.45 * LW.fbm(LW.N2, x * 0.0035, y * 0.0035, 4);
    const rift = LW.smooth(0.18, 0.02, Math.abs(dist / w + 0.15 * LW.N4(t * 5, 1.7)) - 0.05) * 0.85;
    return Math.max(0, band * clumps * (1 - rift * LW.smooth(0.1, 0.9, t)));
  }
  LW.milky = milky;

  LW.drawStars = function (ctx) {
    const rng = new LW.RNG('stars');
    const fill = new LW.FillBatch();
    const glints = new LW.StrokeBatch();
    // nebular micro-stipple in the band
    const cell = 4;
    for (let y = 0; y < 1900; y += cell) {
      for (let x = 0; x < SC.W; x += cell) {
        const jx = x + rng.next() * cell, jy = y + rng.next() * cell;
        const m = milky(jx, jy);
        const vf = SC.vortexFade(jx, jy);
        const p = Math.min(0.95, m * m * 1.25) * (1 - vf * 0.95);
        if (rng.next() < p) {
          const r = rng.range(0.45, 0.9);
          const col = rng.next() < 0.6 ? '#5d7f86' : rng.next() < 0.6 ? '#8fa9a4' : '#3b5966';
          fill.p(col).moveTo(jx + r, jy); fill.p(col).arc(jx, jy, r, 0, 6.2832);
        }
      }
    }
    fill.flush(ctx);
    // stars: jittered-grid dart throwing driven by a density map
    const sc = 7;
    for (let y = 0; y < 2200; y += sc) {
      for (let x = 0; x < SC.W; x += sc) {
        const jx = x + rng.next() * sc, jy = y + rng.next() * sc;
        if (jy > SC.landTop(jx) - 4) continue;
        const g = SC.glow(jx, jy);
        if (g > 0.3) continue;
        const dxp = jx - PL.x, dyp = jy - PL.y;
        if (dxp * dxp + dyp * dyp < (PL.R + 4) ** 2) continue;
        const vf = SC.vortexFade(jx, jy);
        const m = milky(jx, jy);
        const base = 0.07 + 0.06 * LW.fbm(LW.N4, jx * 0.002, jy * 0.002, 3);
        let p = (base + 1.1 * m * m) * (1 - 0.88 * vf) * (1 - LW.smooth(0.12, 0.3, g));
        if (rng.next() > p) continue;
        const u = rng.next();
        let r = 0.5 + Math.pow(u, 5) * 3.9 + (m > 0.5 ? -0.05 : 0.15);
        if (vf > 0.5) r *= 0.8;
        const ct = rng.next();
        let col = ct < 0.55 ? P.cream : ct < 0.8 ? P.mist : ct < 0.93 ? P.pale : P.straw;
        if (r < 1.0 && rng.next() < 0.5) col = '#9fb6b0';
        const q = fill.p(col);
        q.moveTo(jx + r, jy); q.arc(jx, jy, r, 0, 6.2832);
        if (r > 4.0 && rng.next() < 0.22) {
          const L = r * rng.range(3.5, 7);
          const a = rng.range(-0.15, 0.15);
          for (let k = 0; k < 4; k++) {
            const ang = a + k * Math.PI / 2;
            const ll = k % 2 ? L * 0.7 : L;
            const pts = [jx + Math.cos(ang) * r * 0.6, jy + Math.sin(ang) * r * 0.6, jx + Math.cos(ang) * ll, jy + Math.sin(ang) * ll];
            LW.ribbon(fill.p(col), pts, (t) => (1 - t) * r * 0.32 + 0.1);
          }
          // a faint ring of dots around the brightest
          if (r > 3.9) {
            for (let k = 0; k < 10; k++) {
              const ang = (k / 10) * 6.283 + a;
              const rr = r * 2.4;
              const qq = fill.p('#9cb7b0');
              qq.moveTo(jx + Math.cos(ang) * rr + 0.5, jy + Math.sin(ang) * rr);
              qq.arc(jx + Math.cos(ang) * rr, jy + Math.sin(ang) * rr, 0.5, 0, 6.2832);
            }
          }
        }
      }
    }
    fill.flush(ctx, ['#9fb6b0', P.pale, P.mist, P.straw, P.cream]);
    glints.flush(ctx);
  };

  // ---------------------------------------------------------------- vortex streamlines
  function skyDir(x, y) {
    const e = SC.ell(x, y);
    const k = e.k, k2 = k * k;
    let tu = -e.v / k2, tv = e.u;
    let l = Math.hypot(tu, tv) || 1; tu /= l; tv /= l;
    let gu = e.u, gv = e.v / k2;
    l = Math.hypot(gu, gv) || 1; gu /= l; gv /= l;
    const sp = 0.05;
    tu -= sp * gu; tv -= sp * gv;
    const amp = 0.12 + 0.2 * LW.smooth(PL.R * 1.2, PL.R * 3.4, e.re);
    const a = amp * LW.fbm(LW.N1, x * 0.00105, y * 0.00125, 3) + 0.05 * LW.N3(x * 0.0045, y * 0.0045);
    const ca = Math.cos(a), sa = Math.sin(a);
    const ru = tu * ca - tv * sa, rv = tu * sa + tv * ca;
    const ox = ru * PL.ct - rv * PL.st, oy = ru * PL.st + rv * PL.ct;
    const m = Math.hypot(ox, oy) || 1;
    return [ox / m, oy / m];
  }
  LW.skyDir = skyDir;

  function skyInDomain(x, y) {
    if (x < -40 || x > SC.W + 40 || y < -40) return false;
    if (y > SC.landTop(Math.max(0, Math.min(SC.W, x))) + 30) return false;
    const dx = x - PL.x, dy = y - PL.y;
    if (dx * dx + dy * dy < (PL.R + 2) ** 2) return false;
    return true;
  }

  // colour of a sky line by local light
  function skyInk(x, y, r) {
    const g = SC.glow(x, y);
    const vl = SC.vortexLight(x, y);
    const val = LW.clamp(0.25 + 0.68 * vl + 0.75 * g + (r - 0.5) * 0.2, 0, 1.2);
    const warm = 1.35 * g - 0.12 + (r - 0.5) * 0.2;
    if (warm > 1.12) return ['#fff4d6', 0.5];
    if (warm > 1.0) return [P.cream, 0.7];
    if (warm > 0.84) return [P.cream, 1.0];
    if (warm > 0.66) return [P.straw, 0.95];
    if (warm > 0.5) return [P.amber, 0.85];
    if (warm > 0.38) return [r < 0.5 ? P.orange : P.sea, 0.7];
    if (val > 0.72) return [P.mist, 0.95];
    if (val > 0.56) return [P.pale, 0.85];
    if (val > 0.42) return [P.sea, 0.72];
    if (val > 0.29) return [P.teal, 0.62];
    return [P.deep, 0.55];
  }

  LW.drawVortex = function (ctx) {
    const t0 = performance.now();
    const seeds = [];
    const srng = new LW.RNG('sky-seeds');
    seeds.push([PL.x, PL.y - PL.R - 20]);
    for (let y = 40; y < 2280; y += 160) for (let x = 40; x < SC.W; x += 160) seeds.push([x + srng.range(-40, 40), y + srng.range(-40, 40)]);
    const lines = LW.streamlines({
      field: skyDir,
      inDomain: skyInDomain,
      dsep: (x, y) => {
        const e = SC.ell(x, y);
        return 10.5 + 3.5 * LW.smooth(PL.R * 1.6, PL.R * 4.5, e.re) - 1.2 * LW.smooth(0.3, 0.8, SC.glow(x, y));
      },
      bounds: [-60, -60, SC.W + 60, 2400],
      cell: 14, step: 2.2, dtest: 0.52, minLen: 24, seeds,
    });
    LW.log('sky streamlines: ' + lines.length + ' in ' + (performance.now() - t0).toFixed(0) + 'ms');
    const rng = new LW.RNG('sky-dash');
    const fill = new LW.FillBatch();
    for (const L of lines) {
      LW.dashes(L, rng, 70, 520, 3, 13, (sub) => {
        const n = sub.length >> 1;
        const mi = (n >> 1) * 2;
        const mx = sub[mi], my = sub[mi + 1];
        const fade = SC.vortexFade(mx, my);
        if (rng.next() > Math.pow(fade, 1.3) * 1.05) return;
        const r = rng.next();
        const [col, wmul] = skyInk(mx, my, r);
        const wseed = rng.next() * 100;
        const pts = LW.wobble(sub, 0.5, 0.05, wseed, false);
        LW.ribbon(fill.p(col), pts, (t, i, x, y) => {
          const g = SC.glow(x, y);
          const vl = SC.vortexLight(x, y);
          const f = SC.vortexFade(x, y);
          const v = LW.clamp(0.26 + 0.72 * vl + 0.7 * g, 0, 1.2);
          const w = (0.55 + 2.6 * v) * wmul * (0.35 + 0.65 * f) * (0.85 + 0.3 * LW.N2(x * 0.02 + wseed, y * 0.02));
          return Math.max(0.35, w) * LW.taper(t, 0.12, 0.12);
        });
      });
    }
    fill.flush(ctx, [P.deep, P.teal, P.sea, P.orange, P.pale, P.mist, P.amber, P.straw, P.cream, '#e99a3a']);
    LW.skyLines = lines;
  };

  // one meteor, low-angled, upper left
  LW.drawMeteor = function (ctx) {
    const rng = new LW.RNG('meteor');
    const x0 = 330, y0 = 250, x1 = 700, y1 = 430;
    const fill = new LW.FillBatch();
    const pts = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(t * 3) * 4); }
    LW.ribbon(fill.p(P.teal), pts, (t) => 0.4 + 2.4 * Math.pow(t, 2.2));
    const core = pts.slice(30);
    LW.ribbon(fill.p(P.mist), pts.slice(16), (t) => 0.3 + 1.5 * Math.pow(t, 2));
    LW.ribbon(fill.p(P.cream), core, (t) => 0.3 + 1.2 * t);
    for (let k = 0; k < 9; k++) {
      const t = rng.range(0.3, 0.95);
      const px = x0 + (x1 - x0) * t + rng.range(-6, 6), py = y0 + (y1 - y0) * t + rng.range(-6, 6);
      const q = fill.p(rng.next() < 0.5 ? P.mist : P.pale);
      const r = rng.range(0.6, 1.3);
      q.moveTo(px + r, py); q.arc(px, py, r, 0, 6.2832);
    }
    const head = fill.p('#fff6dc');
    head.moveTo(x1 + 3.2, y1); head.arc(x1, y1, 3.2, 0, 6.2832);
    fill.flush(ctx, [P.teal, P.pale, P.mist, P.cream, '#fff6dc']);
  };

  // a sparse sprinkle of stars that sit over the dissolving vortex lines
  LW.drawTopStars = function (ctx) {
    const rng = new LW.RNG('top-stars');
    const fill = new LW.FillBatch();
    for (let i = 0; i < 900; i++) {
      const x = rng.range(0, SC.W), y = rng.range(0, 1700);
      const f = SC.vortexFade(x, y);
      if (f < 0.08 || f > 0.85 || rng.next() > 0.6) continue;
      const dx = x - PL.x, dy = y - PL.y;
      if (dx * dx + dy * dy < (PL.R * 1.2) ** 2) continue;
      const r = 0.8 + Math.pow(rng.next(), 4) * 2.2;
      const col = rng.next() < 0.7 ? P.cream : P.mist;
      fill.p(P.night).moveTo(x + r + 1.6, y); fill.p(P.night).arc(x, y, r + 1.6, 0, 6.2832);
      fill.p(col).moveTo(x + r, y); fill.p(col).arc(x, y, r, 0, 6.2832);
    }
    fill.flush(ctx, [P.night, P.mist, P.cream]);
  };
})();
