// One frame of the pixel piece at time t: every pixel resolved to a palette index, as a pure function of t.
//   sign faces    ramp swaps per source: lit (rim g2, body #76B900, core g7, tube g8), dimmed down the ramp, dead
//                 (unlit acrylic); a brightness between steps is an ordered Bayer mix of the two neighbouring steps
//   glow          G = sum of brightness x per-source glow field; quantised into bands of the green ramp with Bayer
//                 dithering only across band seams; the halo in the sky, spill on surfaces, rim light on steel, the
//                 streak on the wet roof and the glass tower's reflection all read the same brightness values
//   living        mist layers moving whole pixels, rain streaks, puddle rings, beacons, rooms, bugs at the bulb
(function () {
  const NS = window.NS || (window.NS = {});
  const W = 480, H = 270, N = W * H;

  NS.PixelFrame = function (B) {
    const PAL = NS.PAL, R = PAL.ramp, K = NS.K, FL = NS.FLICKER, D = FL.D;
    const g = R.green, n = R.night, a = R.amber, s = R.steel, rd = R.red, c = R.cyan;
    const out = new Uint8Array(N), G = new Float32Array(N), GF = new Float32Array(N);
    const BY = new Float32Array(N); for (let i = 0; i < N; i++) BY[i] = PAL.bayer(i % W, (i / W) | 0);
    const gpos = PAL.gpos, npos = PAL.npos, step = PAL.step;
    const look = { halo: 0.8, far: 1.25, spill: 0.6, rim: 0.7, roof: 0.6, roofGlow: 0.17 };

    // ---- tileable mist fields (period 240 px across, 270 down): value noise, three octaves
    function tnoise(seed, cx, cy) {
      const r = NS.mulberry32(seed), gr = new Float32Array(cx * cy); for (let i = 0; i < gr.length; i++) gr[i] = r();
      return (x, y) => {
        const fx = x / 240 * cx, fy = y / 270 * cy, x0 = Math.floor(fx), y0 = Math.floor(fy), u = fx - x0, v = fy - y0;
        const su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
        const at = (i, j) => gr[(((j % cy) + cy) % cy) * cx + (((i % cx) + cx) % cx)];
        return (at(x0, y0) * (1 - su) + at(x0 + 1, y0) * su) * (1 - sv) + (at(x0, y0 + 1) * (1 - su) + at(x0 + 1, y0 + 1) * su) * sv;
      };
    }
    const mk = (seed, oct) => { const fs = oct.map(([cx, cy], k) => tnoise(seed + k * 31, cx, cy)); const wt = oct.map((_, k) => Math.pow(0.5, k)); const tot = wt.reduce((p, q) => p + q, 0);
      const f = new Float32Array(240 * 270); for (let y = 0; y < 270; y++) for (let x = 0; x < 240; x++) { let v = 0; fs.forEach((fn, k) => (v += wt[k] * fn(x, y))); f[y * 240 + x] = v / tot; } return f; };
    const mistA = mk(11, [[4, 6], [8, 12], [16, 24]]), mistB = mk(23, [[3, 9], [6, 18], [12, 36]]), cloudF = mk(37, [[2, 9], [4, 18], [8, 36]]);

    // ---- rain: three layers, each drop wraps a whole number of times per loop
    const rain = []; { const r = NS.mulberry32(2024);
      const layers = [[-4, 4.5, 2, n[4], 210], [-6, 6.75, 3, n[5], 140], [-9, 9, 4, n[6], 75]];
      layers.forEach(([vx, vy, len, col, cnt], L) => { for (let i = 0; i < cnt; i++) rain.push({ x0: r() * W, y0: r() * H, vx, vy, len, col, L }); }); }
    // ---- rain-drop rings: sprite frames of flat pixel ellipses growing over 8 frames, at sites well inside puddles
    const ringSprites = [[[0, 0]], [[-1, 0], [1, 0], [0, -1], [0, 1]]];
    for (let r = 2; r <= 6; r++) { const pts = new Set(); for (let k = 0; k < 64; k++) { const an = k / 64 * 2 * Math.PI; pts.add(Math.round(Math.cos(an) * r * 1.6) + ',' + Math.round(Math.sin(an) * r * 0.45)); } ringSprites.push([...pts].map((q) => q.split(',').map(Number))); }
    const rings = []; { const r = NS.mulberry32(77); let tries = 0;
      while (rings.length < 16 && tries++ < 20000) {
        const x = (r() * W) | 0, y = 220 + ((r() * 48) | 0), p = y * W + x;
        if (B.pud[p] < 0 || y - B.pudTop[p] < 2) continue;
        let ok = true; for (let d = -10; d <= 10 && ok; d++) for (let e = -3; e <= 3; e++) { const q = (y + e) * W + x + d; if (q < 0 || q >= N || B.pud[q] !== B.pud[p]) { ok = false; break; } }
        if (!ok || rings.some((o) => Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 4)) continue;
        rings.push({ x, y, n: 9 + ((r() * 7) | 0), ph: r() });
      } }
    // ---- the halo: a rounded-rectangle ellipse hugging the sign, strongest just above the letters
    const [SBX0, SBY0, SBX1, SBY1] = B.signBox, HCX = (SBX0 + SBX1) / 2, HHW = (SBX1 - SBX0) / 2 - 6, HCY = SBY0 + 9, HHH = 6;
    const haloR = new Float32Array(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = Math.max(0, Math.abs(x + 0.5 - HCX) - HHW) / 64, yy = y + 0.5 - HCY;
      const dy = Math.max(0, Math.abs(yy) - HHH) / (yy < 0 ? 46 : 30);
      haloR[y * W + x] = Math.sqrt(dx * dx + dy * dy);
    }
    const srcW = B.srcA.map((a0, k) => a0), wsum = new Float32Array(W), wk = B.srcX.map((cx) => { const f = new Float32Array(W); for (let x = 0; x < W; x++) f[x] = Math.exp(-Math.pow((x - cx) / 48, 2)); return f; });
    for (let x = 0; x < W; x++) for (let k = 0; k < 8; k++) wsum[x] += srcW[k] * wk[k][x];
    const Lb = new Float32Array(W), aTot = srcW.reduce((p, q) => p + q, 0);
    // ---- bugs: a few around the work bulb and along the bottom of the letters (integer frequencies: they loop)
    const bugs = [[B.bulb[0], B.bulb[1], 5, 3, 7, 5, 0.1], [B.bulb[0], B.bulb[1] - 1, 4, 4, 9, 6, 0.6], [B.bulb[0] + 1, B.bulb[1], 7, 3, 5, 8, 0.33],
      [215, 80, 30, 6, 2, 3, 0.2], [290, 78, 26, 7, 3, 2, 0.7], [170, 82, 22, 5, 2, 5, 0.45]];
    const beacons = [{ x: 382, y: 10, n: 10, ph: 0.15, duty: 0.42 }, { x: 85, y: 1, n: 12, ph: 0.55, duty: 0.4 }, { x: 24, y: 72, n: 0 }, { x: 61, y: 98, n: 9, ph: 0.8, duty: 0.4 }];
    // switchable rooms (window ids from the build): two warm, one cool, one with a television
    const rooms = [[60, 0], [131, 0], [102, 1], [32, 2]];

    function signCol(k, lvl, b, i) {
      const base = [0, 2, 6, 6, 7, 8, 6][lvl];
      if (b < 0.07) return lvl === 1 ? n[0] : lvl >= 4 ? s[1] : s[0];
      let pos;
      if (b > 1.04 && lvl >= 2) pos = Math.min(9, base + 1);
      else { const sh = Math.max(0, 0.92 - Math.min(1, b)) / 0.92 * 5.6; pos = base - Math.floor(sh + BY[i] * 0.999); }
      if (pos < 1) return lvl === 1 ? n[0] : s[1];
      return g[Math.max(1, pos)];
    }

    return function render(t) {
      t = ((t % D) + D) % D;
      const bs = FL.sources(t), rm = FL.rooms(t);
      const fr = Math.round(t * 30) % Math.round(D * 30);
      // glow field
      G.fill(0);
      GF.fill(0);
      for (let k = 0; k < 8; k++) { const gk = B.glow[k], gf = B.glowFar[k], bk = bs[k]; if (bk > 0.001) for (let i = 0; i < N; i++) { G[i] += bk * gk[i]; GF[i] += bk * gf[i]; } }
      const o1 = Math.floor(t / D * 240) % 240, o2 = Math.floor(t / D * 480) % 240;
      let Bavg = 0; for (let k = 0; k < 8; k++) Bavg += bs[k] * srcW[k] / aTot;
      for (let x = 0; x < W; x++) { let v = 0; for (let k = 0; k < 8; k++) v += bs[k] * srcW[k] * wk[k][x]; Lb[x] = v / wsum[x]; }
      // pass 1
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = y * W + x, kd = B.kind[i];
        let col = B.idx[i];
        if (kd === K.SKY || kd === K.SPILL || kd === K.RIM) {
          // mist (two whole layers drifting opposite ways) only in the band of air around the sign
          let mist = 0;
          if (y < 150) {
            const mv = mistA[y * 240 + ((x - o1 + 480) % 240)] * 0.62 + mistB[y * 240 + ((x + o2) % 240)] * 0.38;
            const env = y < 20 ? y / 20 : y > 110 ? Math.max(0, (150 - y) / 40) : 1;
            mist = (mv - 0.47) * 6.0 * env;
          }
          if (kd === K.SKY) {
            // halo: four concentric bands (g1..g4) of a soft rounded ellipse, scaled by the letters' brightness
            // around this column; tight Bayer seams; lit wisps of mist drifting through it lift a band
            const hr = haloR[i];
            let L = hr < 1 ? 3.25 * Math.pow(1 - hr, 1.8) * Lb[x] : 0;
            const wv = (y + 1.6 * Math.sin((x + o2) * 2 * Math.PI / 80)) / 6, wfr = wv - Math.floor(wv);
            const wisp = L > 1.0 && L < 2.9 && wfr < 0.2 && mistB[y * 240 + ((x + o2) % 240)] > 0.5 ? 1 : 0;
            const band = Math.floor(L + (BY[i] - 0.5) * 0.35);
            if (band >= 1) col = g[Math.min(3, band + wisp)];
            else {
              col = B.sky[i];
              // low cloud deck: whole dithered layers drifting; underlit green above the sign
              if (y < 120) {
                const cv = cloudF[y * 240 + ((x - o1 + 480) % 240)], env = y < 70 ? 1 : (120 - y) / 50;
                const cb = Math.floor((cv - 0.52) * 7 * env + (BY[i] - 0.5) * 0.9);
                if (cb >= 1) {
                  const ux = (x - HCX) / (HHW + 30), uy = (y - 12) / 22, under = Math.max(0, 1 - ux * ux - uy * uy) * Bavg * 1.8;
                  col = cb >= 2 && hr > 1.7 && Math.floor(under + (BY[i] - 0.5) * 0.35) >= 1 ? g[1] : step(col, Math.min(2, cb));
                }
              }
              const mb = Math.floor(mist + (BY[i] - 0.5) * 0.9); if (mb >= 1 && hr > 1.35) col = step(col, 1);
            }
          } else if (kd === K.SPILL) {
            if (B.lvl[i] > 0) {
              let L = G[i] * look.spill * B.lvl[i] + (mist > 0 && B.lvl[i] === 1 ? mist * 0.3 * Math.min(1, G[i]) : 0);
              if (B.hotel[i]) L = Math.max(L, Bavg * 1.25 * Math.exp(-(y - 102) / 11) * Math.min(1.3, B.lvl[i] * 0.45));
              const band = Math.floor(L + (BY[i] - 0.5) * 0.5);
              if (band >= 1) col = g[Math.min(5, Math.max(gpos[col], B.hotel[i] ? 0 : 1) + band)];
            }
          } else {
            const band = Math.floor(G[i] * look.rim * B.lvl[i] + 0.35);
            if (band >= 1) col = g[Math.min(8, 1 + band)];
          }
        } else if (kd === K.BRIM) {
          const band = Math.floor(Bavg * B.lvl[i] / 2.2 + 0.3);
          if (band >= 1) col = g[Math.min(6, 1 + band)];
        } else if (kd === K.FACE) col = signCol(B.src[i], B.lvl[i], bs[B.src[i]], i);
        out[i] = col;
      }
      // rooms switching (and one television)
      rooms.forEach(([id, kindR], j) => {
        const r = B.winRect[id]; if (!r) return;
        const [x0, y0, w, h] = r, on = rm[j];
        for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
          const i = y * W + x;
          let col;
          if (kindR === 2) { const lv = Math.floor(on * 3 + BY[i] * 0.999); col = x === x0 + (w >> 1) ? c[0] : (lv >= 3 ? c[2] : lv >= 2 ? c[1] : c[0]); if (y < y0 + 2) col = c[0]; }
          else if (on < 0.5) { col = n[1]; if (x === x0 && y === y0) col = n[3]; if (x === x0 + (w >> 1)) col = R.brick[0]; }
          else { const warm = kindR === 0; col = (x - x0) % 2 ? (warm ? a[3] : n[7]) : (warm ? a[4] : n[8]); if (x === x0 || x === x0 + w - 1) col = warm ? a[1] : n[5]; if (x === x0 + (w >> 1)) col = warm ? a[1] : n[5]; if (warm && x === x0 + 2 && y >= y0 + h - 3) col = a[6]; }
          out[i] = col;
        }
      });
      // beacons
      beacons.forEach((bk) => {
        const on = bk.n ? FL.beacon(bk, t) : 1, i = bk.y * W + bk.x;
        if (on > 0.5) { out[i] = rd[2]; for (const q of [i - 1, i + 1, i - W, i + W]) if (q >= 0) out[q] = rd[1]; }
        else out[i] = rd[0];
      });
      // pass 2: the glass tower's reflection of the sign, mirrored and broken by panes
      for (let i = 0; i < N; i++) {
        const m = B.gmap[i]; if (m < 0) continue;
        const sc = out[m], kd = B.kind[m];
        if (kd === K.FACE) { const p = gpos[sc] - 4; if (p >= 1) out[i] = g[Math.min(3, p)]; }
        else if (PAL.of[sc][0] === 'green' && gpos[sc] >= 3) out[i] = g[gpos[sc] - 2];
      }
      // the roof: water in the puddles. Each puddle's far edge is a crisp rim (green where the sign's light reaches
      // it); a band of sky just under the rim; below it the reflection, mirrored and squashed 3.4:1 from the parapet
      // up through the letters and their halo, broken by a dark water line every third row and a one-pixel shimmer;
      // lit windows come back as short amber vertical streaks.
      // lit windows above: one streak per window, at the middle of each run of lit columns
      const amberCol = new Uint8Array(W), litCol = new Uint8Array(W);
      for (let x = 0; x < W; x++) for (let y = 140; y < 210; y++) if (PAL.of[out[y * W + x]][0] === 'amber' && PAL.of[out[y * W + x]][1] >= 3) { litCol[x] = 1; break; }
      for (let x = 0; x < W; ) { if (!litCol[x]) { x++; continue; } let e = x; while (e + 1 < W && litCol[e + 1]) e++; amberCol[(x + e) >> 1] = 1; x = e + 1; }
      // the letters' silhouette per column (any lit face pixel in the column), for the squashed mirror image
      const letterCol = new Uint8Array(W);
      for (let x = SBX0; x <= SBX1; x++) { let best = 0; for (let y = SBY0; y <= SBY1; y++) { const q = y * W + x; if (B.kind[q] === K.FACE) best = Math.max(best, gpos[out[q]]); } letterCol[x] = best; }
      const wave = Math.floor(t / D * 32) % 4;
      for (let y = 217; y < H; y++) {
        const jit = Math.round(Math.sin(y * 1.3 + t / D * 2 * Math.PI * 4) * 0.8);
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (B.kind[i] !== K.PUDDLE) continue;
          const ry = y - B.pudTop[i], sx = Math.min(W - 1, Math.max(0, x + jit));
          const lb = sx > SBX0 - 30 && sx < SBX1 + 30 ? Lb[sx] : 0;
          let col = n[1];
          const LR = 7;                                                                // rows of the squashed letter image
          const lip = B.kind[i + W] !== K.PUDDLE || B.kind[i - 1] !== K.PUDDLE || B.kind[i + 1] !== K.PUDDLE;
          if (ry === 0) col = lb * Bavg > 0.55 ? g[3] : n[5];                         // the far edge, catching the light
          else if (lip && ry > 2) { out[i] = n[2]; continue; }                         // the near lip: a clean outline
          else if (ry <= 2) col = n[0];                                                // parapet and facade: dark
          else if (ry < 3 + LR && lb > 0) {                                            // the letters, mirrored and squashed
            const sy = Math.round(SBY1 - (ry - 3) * (SBY1 - SBY0) / (LR - 1)), q = sy * W + sx;
            col = n[0];
            if (B.kind[q] === K.FACE && gpos[out[q]] >= 4) col = g[Math.min(5, gpos[out[q]] - 2)];
            else if (PAL.of[out[q]][0] === 'green' && gpos[out[q]] >= 2) col = g[Math.max(1, gpos[out[q]] - 2)];
          } else if (lb > 0) {                                                         // the halo: broad bands fading toward us
            const L = lb * (2.4 - (ry - 3 - LR) * 0.4);
            const band = Math.floor(L + (BY[i] - 0.5) * 0.35);
            col = band >= 1 ? g[Math.min(2, band)] : n[0];
          } else col = ry < 5 ? n[2] : (ry < 7 ? n[1] : n[0]);                        // sky in the puddles away from the sign
          if (ry > 2 && (ry + wave) % 5 === 4) col = step(col, -1);                   // a darker water line, slowly travelling
          if (amberCol[x] && (x % 3 === 0) && ry >= 1 && ry <= 3) col = ry === 1 ? a[4] : ry === 2 ? a[3] : a[1];
          out[i] = col;
        }
      }
      // rain-drop rings on the puddles: sprite frames, two native frames each
      rings.forEach((r) => {
        const per = D / r.n, f = Math.floor(((t / per + r.ph) % 1) * per * 30 / 2);
        if (f >= ringSprites.length) return;
        const under = r.x > SBX0 && r.x < SBX1 ? Bavg : 0;
        const col = f < 2 ? n[7] : f < 4 ? (under > 0.6 ? g[4] : n[6]) : (under > 0.6 ? g[3] : n[5]);
        ringSprites[f].forEach(([dx, dy]) => { const x = r.x + dx, y = r.y + dy, i = y * W + x; if (x >= 0 && x < W && y >= 0 && y < H && B.kind[i] === K.PUDDLE && y > B.pudTop[i]) out[i] = col; });
      });
      // rain
      rain.forEach((d) => {
        const f = t * 30;
        const x = Math.floor(((d.x0 + d.vx * f) % W + W) % W), y = Math.floor(((d.y0 + d.vy * f) % H + H) % H);
        for (let k = 0; k < d.len; k++) {
          const xx = x + k, yy = y - k; if (xx < 0 || xx >= W || yy < 0 || yy >= H) continue;
          const i = yy * W + xx; if (B.kind[i] === K.FACE) continue;
          out[i] = G[i] > 0.9 ? g[Math.min(8, 4 + d.L + (k === 0 ? 1 : 0))] : d.col;
        }
      });
      // bugs around the bulb and under the letters
      bugs.forEach(([cx, cy, rx, ry, f1, f2, ph]) => {
        const x = Math.round(cx + rx * Math.sin(2 * Math.PI * (f1 * t / D + ph))), y = Math.round(cy + ry * Math.sin(2 * Math.PI * (f2 * t / D + ph * 1.7)));
        if (x < 0 || x >= W || y < 0 || y >= H) return; const i = y * W + x; if (B.kind[i] === K.FACE) return;
        out[i] = Math.abs(x - B.bulb[0]) + Math.abs(y - B.bulb[1]) < 9 ? a[6] : g[9];
      });
      return out;
    };
  };
  NS.hash2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
})();
