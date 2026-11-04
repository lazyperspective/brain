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
  function rift(x, y) {
    const ax = 0, ay = 1180, bx = 2160, by = 120;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    const t = ((x - ax) * dx + (y - ay) * dy) / (L * L);
    const px = ax + dx * t, py = ay + dy * t;
    let dist = Math.hypot(x - px, y - py) * Math.sign((x - px) * -dy + (y - py) * dx);
    dist += 120 * LW.fbm(LW.N3, t * 3.2, 0.5, 3);
    const w = 260 + 90 * LW.N1(t * 2.1, 3.3);
    const r1 = LW.smooth(0.2, 0.03, Math.abs(dist / w + 0.15 * LW.N4(t * 5, 1.7)) - 0.05) * LW.smooth(0.1, 0.9, t);
    // secondary lanes: filaments of dark dust
    const fil = LW.smooth(0.55, 0.75, LW.fbm(LW.N2, x * 0.004 + 7, y * 0.004, 3) + 0.5) * Math.exp(-((dist / w) ** 2));
    return Math.max(r1, fil * 0.8);
  }

  const WHORLS = [
    { x: 1720, y: 330, r: 210, s: 1 },
    { x: 600, y: 650, r: 170, s: -1 },
    { x: 1180, y: 170, r: 115, s: 1 },
  ];
  function whorlW(x, y) {
    let best = 0, bw = null;
    for (const w of WHORLS) { const dx = (x - w.x) / w.r, dy = (y - w.y) / (w.r * 0.55); const d = Math.hypot(dx * 0.9 + dy * 0.44, dy * 0.9 - dx * 0.44); const k = 0.7 * Math.exp(-d * d * 1.2); if (k > best) { best = k; bw = w; } }
    return [best, bw];
  }
  const BAND = (function () { const dx = 2160, dy = -1060, l = Math.hypot(dx, dy); return [dx / l, dy / l]; })();
  function galaxyDir(x, y) {
    let a = Math.atan2(BAND[1], BAND[0]) + 0.75 * LW.fbm(LW.N3, x * 0.0022, y * 0.0022, 3);
    let gx = Math.cos(a), gy = Math.sin(a);
    const [k, w] = whorlW(x, y);
    if (w) {
      const dx = x - w.x, dy = y - w.y, l = Math.hypot(dx, dy) || 1;
      let tx = (-dy / l) * w.s + (dx / l) * 0.12, ty = (dx / l) * w.s + (dy / l) * 0.12;
      if (tx * gx + ty * gy < 0 && k < 0.5) { tx = -tx; ty = -ty; }
      gx = gx * (1 - k) + tx * k; gy = gy * (1 - k) + ty * k;
    }
    const f = LW.smooth(0.05, 0.6, SC.vortexFade(x, y));
    if (f > 0) {
      const d = skyDir(x, y);
      let sx = d[0], sy = d[1];
      if (sx * gx + sy * gy < 0) { sx = -sx; sy = -sy; }
      gx = gx * (1 - f) + sx * f; gy = gy * (1 - f) + sy * f;
    }
    const l = Math.hypot(gx, gy) || 1;
    return [gx / l, gy / l];
  }

  LW.drawGalaxy = function (ctx) {
    const G = 5, gw = Math.ceil((SC.W + 80) / G) + 2, gh = Math.ceil(1600 / G) + 2;
    const DX = new Float32Array(gw * gh), DY = new Float32Array(gw * gh), DOM = new Uint8Array(gw * gh), SEP = new Float32Array(gw * gh);
    const inD0 = (x, y) => {
      if (x < -20 || x > SC.W + 20 || y < -20 || y > 1500) return false;
      if (SC.vortexFade(x, y) > 0.7) return false;
      const dx = x - PL.x, dy = y - PL.y;
      if (dx * dx + dy * dy < (PL.R * 1.15) ** 2) return false;
      for (const w of WHORLS) if (Math.hypot(x - w.x, y - w.y) < w.r * 0.22) return false;
      return milky(x, y) > 0.1 || whorlW(x, y)[0] > 0.12;
    };
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
      const x = -40 + i * G, y = -40 + j * G, o = j * gw + i;
      const d = galaxyDir(x, y); DX[o] = d[0]; DY[o] = d[1];
      DOM[o] = inD0(x, y) ? 1 : 0;
      SEP[o] = 6.5 + 6 * (1 - Math.min(1, milky(x, y) + whorlW(x, y)[0]));
    }
    const gi = (x, y) => { const fx = (x + 40) / G, fy = (y + 40) / G; return [Math.max(0, Math.min(gw - 2, Math.floor(fx))), Math.max(0, Math.min(gh - 2, Math.floor(fy))), fx, fy]; };
    const field = (x, y) => {
      const [i, j, fx, fy] = gi(x, y); const u = Math.min(1, Math.max(0, fx - i)), v = Math.min(1, Math.max(0, fy - j));
      const o = j * gw + i;
      let ax = DX[o], ay = DY[o], bx = DX[o + 1], by = DY[o + 1], cx = DX[o + gw], cy = DY[o + gw], ex = DX[o + gw + 1], ey = DY[o + gw + 1];
      if (ax * bx + ay * by < 0) { bx = -bx; by = -by; } if (ax * cx + ay * cy < 0) { cx = -cx; cy = -cy; } if (ax * ex + ay * ey < 0) { ex = -ex; ey = -ey; }
      const gx = (ax * (1 - u) + bx * u) * (1 - v) + (cx * (1 - u) + ex * u) * v, gy = (ay * (1 - u) + by * u) * (1 - v) + (cy * (1 - u) + ey * u) * v;
      const l = Math.hypot(gx, gy) || 1; return [gx / l, gy / l];
    };
    const inD = (x, y) => { if (x < -20 || x > SC.W + 20 || y < -20 || y > 1500) return false; const [i, j, fx, fy] = gi(x, y); return DOM[Math.round(fy) * gw + Math.round(fx)] === 1 || false; };
    const sepF = (x, y) => { const [i, j] = gi(x, y); return SEP[j * gw + i]; };
    void inD0;
    const seeds = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40; seeds.push([2160 * t, 1180 - 1060 * t]); }
    for (const w of WHORLS) seeds.push([w.x + w.r * 0.3, w.y]);
    const lines = LW.streamlines({
      field, inDomain: inD,
      dsep: sepF,
      bounds: [-40, -40, SC.W + 40, 1560], cell: 10, step: 2, dtest: 0.5, minLen: 16, seeds,
    });
    LW.log('galaxy streamlines: ' + lines.length);
    LW.galaxyLines = lines;
    const rng = new LW.RNG('galaxy');
    const fill = new LW.FillBatch();
    for (const Ls of lines) {
      LW.dashes(Ls, rng, 30, 260, 3, 18, (sub) => {
        const mi = ((sub.length >> 2) * 2);
        const x = sub[mi], y = sub[mi + 1];
        const m = milky(x, y), rf = rift(x, y), [wk] = whorlW(x, y);
        const fade = 1 - SC.vortexFade(x, y);
        let col, wm;
        if (rf > 0.4) { col = '#05090f'; wm = 1.2 + 1.6 * rf; }
        else {
          const v = Math.max(m, wk * 0.8) + (rng.next() - 0.5) * 0.2;
          if (v > 0.72) { col = '#5d8a8a'; wm = 1.0; }
          else if (v > 0.5) { col = '#3d6670'; wm = 0.9; }
          else if (v > 0.3) { col = '#284957'; wm = 0.75; }
          else { col = '#1b3243'; wm = 0.6; }
        }
        LW.ribbon(fill.p(col), sub, (t) => wm * fade * LW.taper(t, 0.2, 0.2) + 0.1);
      });
    }
    fill.flush(ctx, ['#1b3243', '#284957', '#3d6670', '#5d8a8a', '#05090f']);
  };

  // ruled plate tone in the dark night: fine broken lines a shade deeper than the ground
  function plateTone(ctx) {
    const rng = new LW.RNG('plate-tone');
    const fb = new LW.FillBatch();
    for (let y = 2; y < 1900; y += 3.4 + rng.range(-0.4, 0.4)) {
      const pts = [];
      for (let x = -10; x <= SC.W + 10; x += 12) pts.push(x, y + 1.2 * LW.N3(x * 0.002, y * 0.01) + 0.3 * rng.normal());
      let run = [];
      const flush = () => { if (run.length >= 4) LW.dashes(run, rng, 20, 260, 3, 30, (sub) => LW.ribbon(fb.p('#060b14'), sub, (t) => 0.55 * LW.taper(t, 0.15, 0.15))); run = []; };
      for (let i = 0; i < pts.length; i += 2) {
        const x = pts[i], yy = pts[i + 1];
        const ok = SC.glow(x, yy) < 0.12 && SC.vortexFade(x, yy) < 0.75 && (x - PL.x) ** 2 + (yy - PL.y) ** 2 > (PL.R + 8) ** 2 && milky(x, yy) < 0.55;
        if (ok) run.push(x, yy); else flush();
      }
      flush();
    }
    fb.flush(ctx);
  }

  LW.drawStars = function (ctx) {
    plateTone(ctx);
    LW.drawGalaxy(ctx);
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
        const p = Math.min(0.95, m * m * 1.25) * (1 - vf * 0.95) * (1 - 0.9 * rift(jx, jy));
        if (rng.next() < p) {
          const r = rng.range(0.45, 0.9);
          const col = rng.next() < 0.6 ? '#5d7f86' : rng.next() < 0.6 ? '#8fa9a4' : '#3b5966';
          fill.p(col).moveTo(jx + r, jy); fill.p(col).arc(jx, jy, r, 0, 6.2832);
        }
      }
    }
    fill.flush(ctx);
    // ---- texture: denser band stipple, knots of light, faint dust everywhere, layered dust lanes
    {
      const trng = new LW.RNG('stars-tex');
      const tex = new LW.FillBatch();
      const okSky = (x, y) => { const dx = x - PL.x, dy = y - PL.y; return dx * dx + dy * dy > (PL.R + 6) ** 2 && y < SC.landTop(Math.max(0, Math.min(SC.W, x))) - 6; };
      // second, finer band stipple
      for (let y = 0; y < 1700; y += 3) {
        for (let x = 0; x < SC.W; x += 3) {
          const jx = x + trng.next() * 3, jy = y + trng.next() * 3;
          const m = milky(jx, jy);
          if (m < 0.08) continue;
          const vf = SC.vortexFade(jx, jy);
          const p = Math.pow(m, 1.6) * 0.42 * (1 - vf * 0.9) * (1 - 0.95 * rift(jx, jy));
          if (trng.next() > p || !okSky(jx, jy)) continue;
          const u = trng.next();
          LW.dot(tex.p(u < 0.55 ? '#2f4c5a' : u < 0.85 ? '#4d6f78' : '#7d9c9b'), jx, jy, trng.range(0.35, 0.7));
        }
      }
      // knots and bright patches along the band
      let knots = 0;
      for (let it = 0; it < 4000 && knots < 26; it++) {
        const t = trng.next(), off = trng.range(-200, 200);
        const kx = 2160 * t + 0.44 * off, ky = 1180 - 1060 * t + 0.9 * off;
        const m = milky(kx, ky);
        if (m < 0.55 || rift(kx, ky) > 0.25 || SC.vortexFade(kx, ky) > 0.4 || !okSky(kx, ky)) continue;
        knots++;
        const sd = trng.range(14, 42), nd = Math.round(trng.range(90, 260) * m);
        for (let i = 0; i < nd; i++) {
          const x = kx + trng.normal() * sd * 1.3, y = ky + trng.normal() * sd * 0.8;
          if (!okSky(x, y) || rift(x, y) > 0.5) continue;
          const d = Math.hypot((x - kx) / sd, (y - ky) / sd);
          const col = d < 0.7 && trng.next() < 0.5 ? '#c3dacb' : d < 1.3 ? '#8fa9a4' : '#5d7f86';
          LW.dot(tex.p(col), x, y, trng.range(0.35, d < 0.8 ? 1.05 : 0.75));
        }
      }
      // faint dust over the whole night: clumpy, dim
      for (let y = 0; y < 2250; y += 3) {
        for (let x = 0; x < SC.W; x += 3) {
          const jx = x + trng.next() * 3, jy = y + trng.next() * 3;
          const g = SC.glow(jx, jy);
          if (g > 0.25) continue;
          const vf = SC.vortexFade(jx, jy);
          const clump = LW.smooth(-0.1, 0.5, LW.fbm(LW.N4, jx * 0.004 + 5, jy * 0.004, 4));
          const p = (0.03 + 0.13 * clump) * (1 - 0.85 * vf) * (1 - LW.smooth(0.1, 0.25, g));
          if (trng.next() > p || !okSky(jx, jy)) continue;
          const u = trng.next();
          LW.dot(tex.p(u < 0.55 ? '#22384a' : u < 0.88 ? '#34505f' : '#5d7f86'), jx, jy, trng.range(0.4, u > 0.88 ? 0.8 : 0.65));
        }
      }
      tex.flush(ctx, ['#22384a', '#34505f', '#2f4c5a', '#4d6f78', '#5d7f86', '#7d9c9b', '#8fa9a4', '#c3dacb']);
      // layered dust lanes: dark engraved strokes riding the galaxy flow through the rift, two layers
      const lanes = new LW.FillBatch();
      for (const layer of [0, 1]) {
        for (const Ls of LW.galaxyLines || []) {
          const pts = layer ? LW.offsetLine(Ls, 3.2) : Ls;
          let run = [];
          const flush = () => {
            if (run.length >= 8) LW.dashes(run, trng, 14, 90, 2, 9, (sub) => LW.ribbon(lanes.p(layer ? '#08101a' : '#05090f'), sub, (tt, i, x, y) => (layer ? 0.5 : 0.7) * (0.6 + 2 * rift(x, y)) * LW.taper(tt, 0.2, 0.2)));
            run = [];
          };
          for (let i = 0; i < pts.length; i += 4) {
            const x = pts[i], y = pts[i + 1];
            if (rift(x, y) > (layer ? 0.18 : 0.3) && okSky(x, y)) run.push(x, y); else flush();
          }
          flush();
        }
      }
      lanes.flush(ctx, ['#08101a', '#05090f']);
      // micro clusters of faint stars scattered through the dark sky
      const cl = new LW.FillBatch();
      let nc = 0;
      for (let it = 0; it < 3000 && nc < 34; it++) {
        const cx = trng.range(40, SC.W - 40), cy = trng.range(30, 1500);
        if (SC.glow(cx, cy) > 0.15 || SC.vortexFade(cx, cy) > 0.45 || !okSky(cx, cy)) continue;
        nc++;
        const rad = trng.range(12, 38), n = trng.int(6, 18);
        for (let i = 0; i < n; i++) {
          const a = trng.range(0, 6.283), d = Math.pow(trng.next(), 0.7) * rad;
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.85;
          const u = trng.next();
          LW.dot(cl.p(u < 0.15 ? P.cream : u < 0.45 ? '#9fb6b0' : '#5d7f86'), x, y, u < 0.15 ? trng.range(1.0, 1.7) : trng.range(0.45, 0.95));
        }
      }
      cl.flush(ctx, ['#5d7f86', '#9fb6b0', P.cream]);
    }
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
        const C = LW.smooth(0.05, 0.45, LW.fbm(LW.N1, jx * 0.0035 + 3, jy * 0.0035, 3));
        let r = 0.5 + Math.pow(u, 5 + 4 * (1 - C)) * 4.2 + (m > 0.5 ? -0.05 : 0.15);
        if (rift(jx, jy) > 0.5 && rng.next() < 0.6) continue;
        if (vf > 0.5) r *= 0.8;
        const ct = rng.next();
        let col = ct < 0.55 ? P.cream : ct < 0.8 ? P.mist : ct < 0.93 ? P.pale : P.straw;
        if (r < 1.0 && rng.next() < 0.5) col = '#9fb6b0';
        const q = fill.p(col);
        q.moveTo(jx + r, jy); q.arc(jx, jy, r, 0, 6.2832);
        if (r > 4.1 && rng.next() < 0.16) {
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
    // two tight open clusters
    for (const [cx, cy, n, rad] of [[1530, 560, 9, 46], [780, 175, 7, 34]]) {
      for (let i = 0; i < n; i++) {
        const a = rng.range(0, 6.283), d = Math.sqrt(rng.next()) * rad;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8;
        const r = rng.range(1.6, i < 3 ? 3.6 : 2.6);
        const q = fill.p(i % 3 ? P.cream : P.mist); q.moveTo(x + r, y); q.arc(x, y, r, 0, 6.2832);
        if (i < 3) for (let k = 0; k < 4; k++) { const ang = k * Math.PI / 2 + 0.1; LW.ribbon(fill.p(P.cream), [x, y, x + Math.cos(ang) * r * 4.5, y + Math.sin(ang) * r * 4.5], (t) => (1 - t) * r * 0.3 + 0.1); }
      }
      for (let i = 0; i < 40; i++) { const a = rng.range(0, 6.283), d = Math.sqrt(rng.next()) * rad * 1.6; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8; const q = fill.p('#9fb6b0'); q.moveTo(x + 0.7, y); q.arc(x, y, 0.7, 0, 6.2832); }
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
    const trng = new LW.RNG('sky-tex');
    const fill = new LW.FillBatch();
    const fine = new LW.FillBatch();
    const lineW = (x, y, wmul, wseed) => {
      const g = SC.glow(x, y);
      const vl = SC.vortexLight(x, y);
      const f = SC.vortexFade(x, y);
      const v = LW.clamp(0.26 + 0.72 * vl + 0.7 * g, 0, 1.2);
      return (0.55 + 2.6 * v) * wmul * (0.35 + 0.65 * f) * (0.85 + 0.3 * LW.N2(x * 0.02 + wseed, y * 0.02));
    };
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
        // engraver's variety: weight swells, dry broken strokes, the odd doubled line
        const kind = trng.next();
        const wv = 0.72 + 0.6 * trng.next();
        if (kind < 0.24 && n > 10) {
          LW.dashes(pts, trng, 6, 34, 1.4, 4.8, (s2) => LW.ribbon(fill.p(col), s2, (t, i, x, y) => Math.max(0.3, lineW(x, y, wmul, wseed) * 0.8 * wv) * LW.taper(t, 0.3, 0.3)));
        } else {
          LW.ribbon(fill.p(col), pts, (t, i, x, y) => Math.max(0.35, lineW(x, y, wmul, wseed) * wv) * LW.taper(t, 0.12, 0.12));
        }
        if (kind > 0.88 && fade > 0.35 && n > 14) {
          const dc = LW.darker(col);
          const side = trng.sign() * (2.3 + trng.next() * 0.9);
          const lo = Math.floor(n * trng.range(0, 0.3)), hi = Math.ceil(n * trng.range(0.6, 1));
          const twin = LW.offsetLine(pts, side).slice(lo * 2, hi * 2);
          if (twin.length >= 6) LW.ribbon(fine.p(dc), twin, (t, i, x, y) => Math.max(0.3, lineW(x, y, wmul, wseed) * 0.42) * LW.taper(t, 0.25, 0.25));
        }
      });
    }
    // fine stipple in the troughs between lines, one plate darker than the line it sits beside
    const grain = new LW.FillBatch();
    for (let y = 0; y < 2300; y += 4) {
      for (let x = 0; x < SC.W; x += 4) {
        const jx = x + trng.next() * 4, jy = y + trng.next() * 4;
        if (!skyInDomain(jx, jy) || jy > SC.landTop(jx) - 3) { trng.next(); continue; }
        const f = SC.vortexFade(jx, jy);
        const vl = SC.vortexLight(jx, jy), g = SC.glow(jx, jy);
        const patch = 0.55 + 0.45 * LW.fbm(LW.N4, jx * 0.006, jy * 0.006, 3);
        const p = (0.05 + 0.32 * vl + 0.08 * g) * f * patch * (1 - 0.6 * LW.smooth(0.5, 0.9, g));
        if (trng.next() > p) continue;
        const [lc] = skyInk(jx, jy, 0.5);
        const dc = LW.darker(lc, 1);
        LW.dot(grain.p(dc), jx, jy, trng.range(0.4, 0.85));
      }
    }
    grain.flush(ctx);
    fill.flush(ctx, [P.deep, P.teal, P.sea, P.orange, P.pale, P.mist, P.amber, P.straw, P.cream, '#e99a3a']);
    fine.flush(ctx);
    // faint cross-ripples: short dark ink strokes running across the flow, in patches
    const rip = new LW.FillBatch();
    for (let k = 0; k < 3400; k++) {
      let x = trng.range(0, SC.W), y = trng.range(200, 2290);
      const L0 = trng.range(10, 42), w0 = trng.range(0.32, 0.6);
      if (!skyInDomain(x, y)) continue;
      const f = SC.vortexFade(x, y), vl = SC.vortexLight(x, y);
      const patch = LW.fbm(LW.N3, x * 0.0035 + 11, y * 0.0035, 3);
      if (patch < 0.12 || f < 0.4 || vl < 0.18 || SC.glow(x, y) > 0.1) continue;
      const pts = [x, y];
      for (let s = 0; s < L0; s += 3) {
        const d = skyDir(x, y);
        x += -d[1] * 3; y += d[0] * 3;
        if (!skyInDomain(x, y)) break;
        pts.push(x, y);
      }
      if (pts.length < 8) continue;
      LW.ribbon(rip.p('#081018'), LW.wobble(pts, 0.6, 0.08, k * 0.37, false), (t, i, x, y) => w0 * LW.smooth(0.12, 0.4, patch) * (1 - LW.smooth(0.03, 0.1, SC.glow(x, y))) * LW.taper(t, 0.3, 0.3) + 0.1);
    }
    rip.flush(ctx);
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
