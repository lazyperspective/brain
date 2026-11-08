// Shot 6a (30.1 - 39.0): close on the falling ship in belly-flop, backlit, sun low right, lens flare.
'use strict';
const SHOT6A = (function () {
  const T0 = 30.1, T1 = 39.0;
  const deg = Math.PI / 180;
  const ELEV = 0.24;
  // sun drifts down-right and slips out of frame (as in the reference)
  const sunPos = (tau) => [298 + 0.7 * tau + 0.2 * tau * tau, 194 + 4.0 * tau + 0.62 * tau * tau];
  const SHIPX = 218, SHIPY = 136;

  const shade = makeShader({
    up: [0, Math.cos(ELEV), -Math.sin(ELEV)],
    sun: [0.35, -0.32, -0.88],
    skyHor: 6.3, skyZen: 4.4, gndHor: 3.6, gndNad: 2.4, steelSun: 0,
    tileBase: 0.3, tileFill: 2.6, tileSheen: 0.8, tileSun: 0, tilePx: 5, tileLight: 0.025, tileDarkP: 0.0, tileSeam: 1.6, tileMin: 1,
    rimMin: 0.05, rimGraze: 0.55, rimLow: 0.1, rimWarm: 0.22, rimHot: 0.34, rimCol: [1, 2, 3],
    specHot: 0.995, specCol: ST[8], streak: [2.12, 2.24, ST[8]], ringPx: true, flapDark: 0.3, ringEvery: 2, ringDark: 0.6, tileJag: 3.2,
    chrome: [ST[2], ST[2], ST[3], ST[4], ST[5], ST[6], ST[7], ST[8], ST[8]],
    // screen-space banding for the dark belly: lit top, core shadow, warm bounce near the bottom
    tileFn: (n, hit) => {
      const ny = n[1];
      let v = 1.25 + 1.6 * ny + 0.5 * n[2];
      if (hit.mat !== 1) v += 0.9;
      if (ny < -0.45) v += 3.4 * (-0.45 - ny) / 0.55;   // bounce light from the sunlit haze below
      return v;
    },
  });

  function flapAngles(tau) {
    // slow, deliberate flap trim (quantised to half degrees so frames re-use sprites)
    const aft = Math.round((2.5 * Math.sin(tau * 2 * Math.PI / 3.4)) * 2) / 2;
    const fwd = Math.round((3.5 * Math.sin(tau * 2 * Math.PI / 2.6 + 1.1)) * 2) / 2;
    return [aft, fwd];
  }
  // slow pitch drift (nose easing down a touch), quantised to quarter degrees
  const pitch = (tau) => 8;   // held rigid: re-rasterising a 236-px hull for tiny pitch changes shimmers
  function ship(tau) {
    const [aft, fwd] = flapAngles(tau);
    const th = pitch(tau);
    const key = `6a|${aft}|${fwd}|${th}`;
    return cachedShip(key, () => renderShip({ scale: 21.5, theta: th * deg, elev: ELEV, yaw: 0,
      aftDefl: [aft * deg, -aft * 0.6 * deg], fwdDefl: [fwd * deg, -fwd * deg], shade,
      edges: [
        { dir: [0, -1], mats: [1, 5, 6], cols: [ST[8], ST[7]] },
        { dir: [0, -1], mats: [3, 4], cols: [ST[5], ST[4]], over: [1, 2] },
        { dir: [0, 1], mats: [3, 4], cols: [ST[0]], over: [1, 2] },
        { dir: [0, 1], mats: [2, 3, 4], cols: [WARM[4], WARM[2]] },
        { dir: [1, 0], mats: [2], cols: [WARM[3], WARM[1]] },
      ] }));
  }

  // precomputed haze + cirrus textures (background drifts with the sun by whole pixels)
  const TW = 560, TH = 380;
  const HAZE = new Float32Array(TW * TH), CIR = new Uint8Array(TW * TH);
  (function () {
    for (let Y = 0; Y < TH; Y++) for (let X = 0; X < TW; X++) {
      const x = X - 60, y = Y - 100;          // texture coords relative to the start frame
      HAZE[Y * TW + X] = fbm(x / 70, y / 26, 11, 3) - 0.5;
      const sweep = y + x * 0.32;
      const c = fbm(x / 160, sweep / 9, 23, 3) * 0.8 + vnoise(x / 22, sweep / 3, 29) * 0.35;
      CIR[Y * TW + X] = c > 0.9 ? 2 : c > 0.83 ? 1 : 0;
    }
  })();
  function sky(tau, sx, sy) {
    const ox = Math.round(sx - 298), oy = Math.round(sy - 194);
    for (let y = 0; y < H; y++) {
      const Y = clamp(y - oy + 100, 0, TH - 1);
      for (let x = 0; x < W; x++) {
        const X = clamp(x - ox + 60, 0, TW - 1);
        const dx = x + 0.5 - sx, dy = y + 0.5 - sy;
        const d = Math.sqrt(dx * dx + dy * dy);
        const corner = Math.max(0, (300 - x - y) / 300);
        const v = 9.15 - 2.7 * Math.pow(d / 340, 0.9) - 0.75 * corner + 0.5 * HAZE[Y * TW + X];
        let c = rampDither(SKY, Math.max(5.2, v), x, y, 3.0);
        const ci = CIR[Y * TW + X];
        if (ci && dens(x, y, ci === 2 ? 0.5 : 0.25)) c = UP[c];
        FB[y * W + x] = c;
      }
    }
  }

  function flare(tau, sx, sy) {
    const cx = 240, cy = 135, vx = cx - sx, vy = cy - sy;
    const at = (k) => [sx + vx * k, sy + vy * k];
    // fade the whole flare as the sun slips out of frame
    const vis = clamp((H + 6 - sy) / 22, 0, 1);
    if (vis <= 0) return;
    let p;
    p = at(0.42); flareHex(p[0], p[1], 15, 0.3, 0.12 * vis, 0.5 * vis);
    p = at(0.92); flareRing(p[0], p[1], 49, 2, 0.5 * vis); flareDisc(p[0], p[1], 47, 0.1 * vis, 0, 1);
    p = at(1.22); flareDisc(p[0], p[1], 5, 0.5 * vis, 0.9 * vis, 1);
    p = at(1.66); flareDisc(p[0], p[1], 50, 0.32 * vis, 0.75 * vis, 2);
    p = at(1.78); flareDisc(p[0], p[1], 6, 0.6 * vis, 0.9 * vis, 1);
    p = at(1.9); flareDisc(p[0], p[1], 3, 0.9 * vis, 1, 1);
    p = at(2.35); flareHex(p[0], p[1], 24, 0.3, 0.1 * vis, 0.35 * vis);
    p = at(2.95); flareRing(p[0], p[1], 66, 3, 0.18 * vis);
    // big ice-halo arc around the sun
    flareRing(sx, sy, 128, 2, 0.22 * vis);
  }

  function sunAndRays(tau, sx, sy) {
    const tw = 0.5 + 0.5 * Math.sin(tau * 2.1);
    // soft glare: two dithered warm-white discs
    disc(sx, sy, 34, (x, y, d) => { if (dens(x, y, 0.55 * (1 - d / 34))) mapPx(x, y, UP); });
    const rays = [];
    for (let k = 0; k < 6; k++) {
      const ang = -0.35 + k * Math.PI / 3;
      rays.push({ ang, len: (k % 2 ? 40 : 62) + 6 * tw * (k % 2 ? -1 : 1), d0: 0.95 });
      rays.push({ ang: ang + Math.PI / 6, len: 16, d0: 0.6 });
    }
    starburst(sx, sy, rays);
    // warm cores of the long spikes (same look as the sun in the next acts)
    for (const r of rays) {
      const n = Math.round(r.len * (r.len > 30 ? 0.32 : 0.25));
      for (let k = 4; k < n; k++) px(Math.floor(sx + Math.cos(r.ang) * k), Math.floor(sy + Math.sin(r.ang) * k), k < n * 0.6 ? WARM[5] : WARM[4]);
    }
    // anamorphic streak
    for (let x = -130; x <= 130; x++) {
      const f = 1 - Math.abs(x) / 130;
      const X = Math.floor(sx + x), Y = Math.floor(sy);
      if (dens(X, Y, f * 0.95)) mapPx(X, Y, UP);
      if (Math.abs(x) < 26 && Math.abs(x) > 4) px(X, Y, Math.abs(x) < 14 ? WARM[5] : WARM[4]);
    }
    sunDisc(sx, sy, 3.6, 13);
  }

  // condensation wisps peeling off the flap tips, streaming upward (relative wind from below)
  function wisps(tau, spr, bx, by) {
    const tips = [[shipProject(spr, 0.6, 1.9 * Math.cos(-SHIP.aftPhi), 1.9 * Math.sin(-SHIP.aftPhi)), 0],
                  [shipProject(spr, 8.4, 1.55 * Math.cos(-SHIP.fwdPhi), 1.55 * Math.sin(-SHIP.fwdPhi)), 1]];
    for (const [tp, k] of tips) {
      const x0 = bx + tp[0], y0 = by + tp[1];
      const len = k ? 30 : 46;
      for (let j = 1; j < len; j++) {
        const scroll = j + Math.floor(tau * 42);
        if (hash2(Math.floor(scroll / 5), k, 5) < 0.3) continue;
        const wob = Math.round(Math.sin(scroll * 0.21 + k) * 1.2);
        const f = 1 - j / len;
        const x = Math.floor(x0 + wob - j * 0.12), y = Math.floor(y0 - j);
        if (dens(x, y, 0.95 * f + 0.05)) mapPx(x, y, UP);
        if (j < len * 0.45 && dens(x + 1, y, 0.6 * f)) mapPx(x + 1, y, UP);
      }
    }
  }

  // ice crystals / haze motes whipping upward past the lens: sells the fall speed
  function motes(tau) {
    for (let k = 0; k < 26; k++) {
      const sp = 260 + hash2(k, 1, 3) * 260;          // px per second
      const per = (H + 60) / sp;
      const cyc = Math.floor((tau + hash2(k, 2, 3) * per) / per);
      const ph = ((tau + hash2(k, 2, 3) * per) % per) / per;
      const x = Math.floor(hash2(k, cyc, 4) * W);
      const y = Math.floor(H + 30 - ph * (H + 60));
      const len = 2 + Math.floor(hash2(k, cyc, 5) * 4);
      for (let j = 0; j < len; j++) {
        if (MASK[(y + j) * W + x]) continue;
        if (j === 0 || dens(x, y + j, 1 - j / len)) mapPx(x, y + j, UP);
      }
    }
  }

  function draw(t) {
    const tau = t - T0;
    const [sx, sy] = sunPos(tau);
    sky(tau, sx, sy);
    sunAndRays(tau, sx, sy);
    const s = ship(tau);
    const bx = SHIPX - s.ox + Math.round(0.55 * tau), by = SHIPY - s.oy + (Math.sin(tau * 1.3) > 0.55 ? 1 : 0);
    wisps(tau, s, bx, by);
    MASK.fill(0);
    blit(s, bx, by, true);
    // sun glint riding the nose cap: a small four-point star that breathes
    const [gx0, gy0] = shipProject(s, SHIP.L - 0.02, 0.12, 0);
    const gx = Math.round(bx + gx0), gy = Math.round(by + gy0);
    const gl = 2 + Math.round(1.5 + 1.5 * Math.sin(tau * 1.7));
    px(gx, gy, WARM[6]);
    for (let k = 1; k <= gl; k++) {
      const c = k === 1 ? WARM[6] : WARM[5];
      px(gx + k, gy, c); px(gx - k, gy, c);
      if (k <= gl - 1) { px(gx, gy + k, c); px(gx, gy - k, c); }
    }
    flare(tau, sx, sy);
    motes(tau);
  }
  return { T0, T1, draw };
})();
