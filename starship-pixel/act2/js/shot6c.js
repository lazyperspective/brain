// Shot 6c (47.2 - 60.3): wide, ground level at the coast. Mega bays in the foreground, the two
// towers on the shore, the sea beyond. The ship falls far above in belly-flop, flips upright,
// lights its engines and descends toward the catch tower. Camera trucks right and tilts down.
'use strict';
const SHOT6C = (function () {
  const T0 = 47.2, T1 = 60.3;
  const deg = Math.PI / 180;
  const HZ = 227;                 // horizon in world rows (screen row at tau = 0)
  const MIRROR = 257;             // water line the towers reflect about

  // ---- camera ----
  const pan = (tau) => keyed([[0, 0], [4.8, 0.17], [7.8, 0.43], [10.8, 0.78], [13.1, 1.0]], tau);
  const tilt = (tau) => keyed([[0, 0], [4.8, 3], [7.8, 12], [10.8, 20], [13.1, 25]], tau);
  const D = { cloud: 5, sea: 13, site: 24, lagoon: 34, build: 58 };

  // ---- static layers, generated once ----
  function layer(w, y0, y1) { return { w, y0, h: y1 - y0, data: new Uint8Array(w * (y1 - y0)).fill(TRANSP) }; }
  function lset(L, x, y, c) { const j = y - L.y0; if (x >= 0 && x < L.w && j >= 0 && j < L.h) L.data[j * L.w + x] = c; }
  function lget(L, x, y) { const j = y - L.y0; return (x >= 0 && x < L.w && j >= 0 && j < L.h) ? L.data[j * L.w + x] : TRANSP; }

  const TOWER_A = 302, TOWER_B = 366;   // site-layer x of the two towers
  const sea = layer(520, HZ - 3, 248);
  const site = layer(540, 205, 300);
  const lagoon = layer(580, 252, 300);
  const build = layer(620, 236, 300);
  const objMask = new Uint8Array(540 * 95);  // site-layer pixels that reflect (towers, mounts)

  (function genSea() {
    for (let y = sea.y0; y < sea.y0 + sea.h; y++) for (let x = 0; x < sea.w; x++) {
      const d = y - HZ;
      let c;
      if (d < 0) c = rampDither([SKY[8], SKY[9]], 0.5, x, y);           // haze line sitting on the horizon
      else if (d === 0) c = WA[3];
      else {
        const v = 4.4 - Math.min(1.1, d / 8) + (fbm(x / 40, d * 1.2, 3, 2) - 0.5) * 0.5;
        c = rampDither(WA, v, x, y, 4);
        // long swell lines
        const sw = Math.sin(x / (7 + d * 2.5) + d * 2.1) + Math.sin(d * 3.7);
        if (d > 3 && sw > 1.8) c = WA[2];
      }
      lset(sea, x, y, c);
    }
  })();

  (function genSite() {
    // beach + marsh flats with perspective texture
    for (let y = 243; y < 300; y++) for (let x = 0; x < site.w; x++) {
      const d = y - HZ;
      let c;
      if (y < 246) c = y === 243 ? MA[6] : rampDither([MA[5], MA[6]], 0.45, x, y);
      else {
        const u = (x - 300) / (2 + 0.8 * d), v = 80 / (d + 2);
        const n = fbm(u * 0.6 + 40, v * 1.6, 71, 3);
        c = n > 0.66 ? MA[3] : n < 0.34 ? MA[2] : (n > 0.5 ? MA[4] : MA[4]);
        if (y < 248) c = n > 0.5 ? MA[4] : MA[5];          // dry flats right behind the beach
        const n2 = vnoise(u * 2 + 90, v * 5, 72);
        if (n2 > 0.82 && c === MA[4]) c = MA[5];
      }
      lset(site, x, y, c);
    }
    // vegetation clumps in the near flats: short horizontal dashes
    for (let y = 252; y < 300; y++) for (let x = 0; x < site.w; x++) {
      const d = y - HZ, h = hash2(x >> 2, y, 515);
      if (h < 0.05 + d * 0.0015 && (x & 3) === 0) {
        const c = hash2(x, y, 516) < 0.6 ? MA[3] : MA[5];
        const len = 2 + Math.floor(d / 18);
        for (let k = 0; k < len; k++) if (lget(site, x + k, y) === MA[4]) lset(site, x + k, y, c);
      }
    }
    // road from the bays to the pads
    for (let y = 247; y < 300; y++) {
      const xr = 110 + (y - 247) * -1.9 + 0.012 * (y - 247) * (y - 247);
      for (let k = 0; k < 2 + (y - 247) / 14; k++) lset(site, Math.round(xr + k), y, k === 0 ? MA[6] : MA[5]);
    }
    // pad apron (dark concrete strip under the towers)
    for (let y = 252; y < 257; y++) for (let x = TOWER_A - 40; x < TOWER_B + 24; x++) {
      const edge = y === 252;
      lset(site, x, y, edge ? ST[5] : (y === 256 ? ST[2] : ST[3]));
    }
    // tank farm: short white horizontal tanks between the towers
    for (let i = 0; i < 6; i++) {
      const x0 = TOWER_A + 16 + i * 6;
      for (let x = x0; x < x0 + 5; x++) { lset(site, x, 250, ST[8]); lset(site, x, 251, ST[6]); }
    }
    for (let x = TOWER_A + 52; x < TOWER_A + 60; x++) { lset(site, x, 249, ST[7]); lset(site, x, 250, ST[7]); lset(site, x, 251, ST[5]); }
    const mark = (x, y) => { const j = y - site.y0; if (x >= 0 && x < site.w && j >= 0 && j < 95) objMask[j * 540 + x] = 1; };
    const sp = (x, y, c) => { lset(site, x, y, c); mark(x, y); };
    // lattice tower: 5 px wide, X-braced, lit from the left (sun behind the camera-left)
    function tower(x0, top, base, armsY, armsLen, cap) {
      for (let y = top; y <= base; y++) {
        const r = (y - top) % 4;
        sp(x0, y, ST[7]); sp(x0 + 4, y, ST[4]);
        if (r === 0) { sp(x0 + 1, y, ST[6]); sp(x0 + 2, y, ST[6]); sp(x0 + 3, y, ST[5]); }
        else if (r === 2) sp(x0 + 2, y, ST[5]);
        else { sp(x0 + 1, y, ST[6]); sp(x0 + 3, y, ST[5]); }
      }
      // top cap + rod
      for (let x = x0 - 1; x <= x0 + 5; x++) { sp(x, top - 1, x < x0 + 2 ? ST[8] : ST[6]); sp(x, top, ST[4]); }
      sp(x0 + 2, top - 2, ST[6]); sp(x0 + 2, top - 3, ST[6]); if (cap) sp(x0 + 2, top - 4, ST[5]);
      // carriage + chopsticks
      for (let y = armsY - 1; y <= armsY + 3; y++) for (let x = x0 - 1; x <= x0 + 5; x++) sp(x, y, x === x0 - 1 ? ST[7] : (y === armsY - 1 ? ST[7] : ST[4]));
      for (let k = 1; k <= armsLen; k++) {
        sp(x0 + 5 + k, armsY, ST[7]);
        sp(x0 + 5 + k, armsY + 2, k < armsLen ? ST[5] : ST[6]);
        if (k < armsLen - 1) sp(x0 + 5 + k, armsY + 1, ST[3]);
      }
      // launch mount at the base
      for (let y = base - 5; y <= base; y++) for (let x = x0 + 6; x <= x0 + 13; x++) {
        const leg = (x === x0 + 6 || x === x0 + 13 || y === base - 5 || (y === base - 4 && x > x0 + 6 && x < x0 + 13));
        if (leg) sp(x, y, x === x0 + 6 ? ST[7] : (y === base - 5 ? ST[6] : ST[4]));
      }
    }
    tower(TOWER_A, 220, 254, 224, 10, true);
    tower(TOWER_B, 217, 254, 236, 7, false);
    // small structures: hangar sheds, water tower
    for (let y = 247; y < 252; y++) for (let x = TOWER_A - 30; x < TOWER_A - 22; x++) sp(x, y, y === 247 ? ST[7] : ST[5]);
    for (let y = 240; y < 252; y++) { sp(TOWER_B - 10, y, ST[6]); sp(TOWER_B - 9, y, ST[4]); }
    for (let y = 245; y < 252; y++) for (let x = TOWER_B + 20; x < TOWER_B + 27; x++) sp(x, y, y === 245 ? ST[7] : (x === TOWER_B + 20 ? ST[6] : ST[4]));
  })();

  (function genLagoon() {
    for (let y = lagoon.y0; y < lagoon.y0 + lagoon.h; y++) for (let x = 0; x < lagoon.w; x++) {
      const d = y - HZ;
      const u = (x - 300) / (2 + 0.9 * d), v = 70 / (d + 2);
      const n = fbm(u * 0.5 + 40, v * 1.4, 91, 3);
      // the lagoon fills the right foreground, a few channels reach left
      const bias = clamp((x - 230) / 160, -1, 1) * 0.3 + (y - 262) / 40 * 0.08;
      const water = n + bias > 0.6;
      if (!water) continue;
      lset(lagoon, x, y, 1);   // marker; coloured per frame (reflections)
    }
    // marsh islands inside the water: keep a few
    for (let y = lagoon.y0; y < lagoon.y0 + lagoon.h; y++) for (let x = 0; x < lagoon.w; x++) {
      if (lget(lagoon, x, y) !== 1) continue;
      const d = y - HZ;
      const n2 = fbm((x - 300) / (2 + 0.9 * d) * 0.6 + 40, 40 / (d + 2) * 4, 97, 2);
      if (n2 > 0.74) lset(lagoon, x, y, n2 > 0.79 ? MA[3] : MA[2]);
    }
  })();

  (function genBuildings() {
    // [x, width, top] in build-layer coordinates
    const B = [[72, 21, 242, 1], [99, 25, 242, 1], [140, 54, 241, 0], [20, 14, 246, 0]];
    for (const [x0, w, top, ribs] of B) {
      for (let y = top; y < 300; y++) for (let x = x0; x < x0 + w; x++) {
        let c = DK[2];
        if (y === top) c = ST[5];
        else if (y === top + 1) c = ST[3];
        else if (x === x0) c = ST[4];
        else if (x === x0 + 1) c = ST[2];
        else if (ribs && (x - x0) % 4 === 0) c = DK[1];
        else if (!ribs && (y - top) % 6 === 0 && y < top + 30) c = ST[1];
        lset(build, x, y, c);
      }
      // roof clutter
      lset(build, x0 + 3, top - 1, ST[4]); lset(build, x0 + 4, top - 1, ST[4]);
    }
    // the tall door of the wide bay
    for (let y = 252; y < 300; y++) for (let x = 156; x < 174; x++) lset(build, x, y, (x - 156) % 3 === 0 ? ST[2] : ST[1]);
    // a light pole
    for (let y = 228; y < 300; y++) lset(build, 131, y, y < 230 ? ST[6] : ST[3]);
    lset(build, 130, 228, ST[6]); lset(build, 132, 228, ST[6]);
  })();

  // fair-weather cumulus
  const CLOUD_L = makePuffCloud(4711, 96, 26, { n: 14, rmin: 4, rmax: 10, tower: 0.5, cols: [SKY[7], SKY[7], SKY[8], SKY[9]] });
  const CLOUD_S = [makePuffCloud(4712, 40, 12, { n: 8, rmin: 3, rmax: 5, tower: 0.4, cols: [SKY[7], SKY[8], SKY[8], SKY[9]] }),
                   makePuffCloud(4713, 54, 14, { n: 9, rmin: 3, rmax: 6, tower: 0.4, cols: [SKY[7], SKY[8], SKY[8], SKY[9]] })];

  function drawLayer(L, ox, oy) {
    for (let j = 0; j < L.h; j++) {
      const y = L.y0 + j - oy; if (y < 0 || y >= H) continue;
      for (let i = 0; i < L.w; i++) {
        const c = L.data[j * L.w + i]; if (c === TRANSP) continue;
        const x = i + ox; if (x < 0 || x >= W) continue;
        FB[y * W + x] = c;
      }
    }
  }

  // ---- ship ----
  const shipX = (tau) => keyed([[0, 200], [0.3, 202], [4.8, 221], [7.8, 240], [10.8, 255], [13.1, 258]], tau);
  const shipY = (tau) => keyed([[0, 2], [0.3, 6], [4.8, 86], [7.8, 127], [10.8, 157], [13.1, 176]], tau);
  // attitude: belly-flop, flip at ~53.4-54.6 s, small overshoot, settles into a slight lean
  const shipTheta = (tau) => keyed([[0, -2], [3, 1], [5.4, -1], [5.9, 4], [6.6, 40], [7.2, 84], [7.6, 97], [8.3, 92], [9, 90], [13.1, 90]], tau);
  const IGN = 6.25;   // engine ignition (during the flip)

  const shade = makeShader({
    up: [0, Math.cos(0.3), -Math.sin(0.3)],
    sun: norm3([-0.5, 0.45, 0.75]),
    skyHor: 6.2, skyZen: 4.8, gndHor: 4.0, gndNad: 3.0, steelSun: 1.4,
    rimMin: 2, rimGraze: 2, rimLow: 9, rimWarm: 9, rimHot: 9, rimCol: [1, 2, 3],
    specHot: 0.97, specCol: ST[8],
    chrome: [ST[3], ST[4], ST[5], ST[5], ST[6], ST[6], ST[7], ST[8], ST[8]],
    tileFn: () => 1,
  });
  function shipSprite(tau) { return spriteAt(Math.round(shipTheta(tau))); }
  function spriteAt(th) { return cachedShip('6cm|' + th, () => miniShip(th, 15)); }

  function flame(tau, spr, bx, by) {
    if (tau < IGN) return;
    const f = Math.floor(tau * 30);
    const age = tau - IGN;
    const ex = spr.ox - spr.ax * (spr.Lp / 2 + 0.5), ey = spr.oy - spr.ay * (spr.Lp / 2 + 0.5);  // first pixel past the engines
    const dx = -spr.ax, dy = -spr.ay;                    // flame direction on screen
    const grow = clamp(age / 0.35, 0, 1);
    const flick = hash2(f, 3, 1);
    const len = 2.5 + 3 * grow + (flick < 0.5 ? 1 : 0) + (age < 0.5 ? 3 * (1 - age / 0.5) : 0);
    const cols = [WARM[6], WARM[6], WARM[5], WARM[5], WARM[4], WARM[3], WARM[2]];
    const ox = bx + ex, oy = by + ey;
    for (let k = -1; k < len; k++) {
      const x = Math.floor(ox + dx * k + 0.5), y = Math.floor(oy + dy * k + 0.5);
      px(x, y, cols[clamp(Math.floor(k / len * cols.length), 0, cols.length - 1)]);
      // 3-px wide hot base just under the engines
      if (k >= 0 && k < 2 && grow > 0.5) {
        const sx = Math.round(-dy), sy = Math.round(dx);
        px(x + sx, y + sy, k === 0 ? WARM[5] : WARM[4]); px(x - sx, y - sy, k === 0 ? WARM[5] : WARM[4]);
      }
    }
    // shimmer of hot gas around the plume tip (ordered, sparse)
    const tx = Math.floor(ox + dx * (len + 1) + 0.5), tyy = Math.floor(oy + dy * (len + 1) + 0.5);
    if (flick > 0.35) mapPx(tx, tyy, UP);
  }
  // ignition: a brief warm bloom at the engines, then a puff of exhaust that stays where it was
  // born (world-fixed against the panning camera), billows and thins out.
  function enginePosAt(tau) {
    const spr = shipSprite(tau);
    const ex = spr.ox - spr.ax * (spr.Lp / 2 + 0.5), ey = spr.oy - spr.ay * (spr.Lp / 2 + 0.5);
    return [Math.round(shipX(tau)) - Math.round(spr.ox) + ex, Math.round(shipY(tau)) - Math.round(spr.oy) + ey];
  }
  let IGNPOS = null;
  function ignitionFx(tau, camX, camY) {
    if (!IGNPOS) { const p = enginePosAt(IGN + 0.1); IGNPOS = [p[0] + Math.round(pan(IGN + 0.1) * D.site), p[1] + Math.round(tilt(IGN + 0.1))]; }
    const age = tau - IGN;
    if (age < 0 || age > 3.4) return;
    const cx = IGNPOS[0] + camX - age * 1.4, cy = IGNPOS[1] + camY + 1 + age * 0.9;
    const fade = clamp((3.4 - age) / 1.4, 0, 1);
    const g = 1 + age * 1.2;
    const blobs = [[0, 0, 2.2], [-2.2, 1, 1.8], [2, 1.4, 1.7], [-0.6, -1.6, 1.5], [1.2, -0.8, 1.4]].map(([ox, oy, r0]) => [cx + ox * g, cy + oy * g, r0 * g]);
    const inside = (x, y) => { for (const [bx2, by2, r] of blobs) if ((x + 0.5 - bx2) ** 2 + (y + 0.5 - by2) ** 2 <= r * r) return true; return false; };
    const R = 6 * g;
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {
      if (!inside(x, y)) continue;
      if (fade < 1 && !dens(x - camX, y - camY, fade)) continue;
      let c = ST[7];
      if (!inside(x, y - 1) || !inside(x + 1, y - 1)) c = SKY[9];
      else if (y + 0.5 > cy + 1.2 * g) c = ST[6];
      px(x, y, c);
    }
  }
  function ignitionBloom(tau, bx, by, spr) {
    const age = tau - IGN;
    if (age < 0 || age > 0.6) return;
    const ex = bx + spr.ox - spr.ax * (spr.Lp / 2 + 1.5), ey = by + spr.oy - spr.ay * (spr.Lp / 2 + 1.5);
    const r = 2 + 4 * (1 - age / 0.6);
    disc(ex, ey, r, (x, y, d) => { if (dens(x, y, 0.75 * (1 - d / r))) px(x, y, d < r * 0.4 ? WARM[6] : WARM[5]); });
  }
  // cold-gas RCS puffs at the nose while it swings upright
  function rcs(tau, bx, by, spr) {
    const pulses = [5.75, 6.0, 6.5, 7.35, 7.9];
    for (const p0 of pulses) {
      const age = tau - p0; if (age < 0 || age > 0.35) continue;
      const nx = bx + spr.ox + spr.ax * (spr.Lp / 2 - 2), ny = by + spr.oy + spr.ay * (spr.Lp / 2 - 2);
      const side = (p0 * 10) % 2 < 1 ? 1 : -1;
      const k = 2 + Math.floor(age * 12);
      px(Math.round(nx + spr.lx * side * k), Math.round(ny + spr.ly * side * k), age < 0.15 ? SKY[9] : SKY[8]);
      if (age < 0.2) px(Math.round(nx + spr.lx * side * (k - 1)), Math.round(ny + spr.ly * side * (k - 1)), SKY[9]);
    }
  }

  // pelicans gliding along the shore, right to left
  function pelicans(tau, oy) {
    for (let i = 0; i < 5; i++) {
      const x = Math.round(520 - tau * 15.5 - i * 9 - (i % 2) * 2);
      const y = Math.round(212 + i * 1.3 + Math.sin(tau * 0.8 + i * 0.6) * 1.2) - oy;
      const ph = Math.floor(tau * 6 + i * 2.3) % 12;     // mostly gliding, an occasional wingbeat
      const c = ST[3];
      px(x, y, c); px(x + 1, y, c);                         // body
      if (ph === 0 || ph === 1) { px(x - 1, y - 1, c); px(x - 2, y - 2, c); px(x + 2, y - 1, c); px(x + 3, y - 2, c); }
      else if (ph === 2) { px(x - 1, y + 1, c); px(x - 2, y + 1, c); px(x + 2, y + 1, c); px(x + 3, y + 1, c); }
      else { px(x - 1, y, c); px(x - 2, y + 1, c); px(x + 2, y, c); px(x + 3, y + 1, c); }
    }
  }

  function draw(t) {
    const tau = t - T0;
    const p = pan(tau), ty = Math.round(tilt(tau));
    // sky: pale, hazing to near-white at the horizon
    const hzS = HZ - ty;
    for (let y = 0; y < H; y++) {
      const dh = (hzS - y) / 150;     // 0 at horizon, 1 high up
      const v = 9.0 - 1.85 * Math.pow(clamp(dh, 0, 1.4), 0.7);
      for (let x = 0; x < W; x++) FB[y * W + x] = rampDither(SKY, v + (x / W) * 0.15, x, y + ty, 7);
    }
    // a thin band of warm morning haze lying on the sea horizon
    for (let k = 1; k <= 7; k++) {
      const y = hzS - k; if (y < 0 || y >= H) continue;
      const d = 0.62 - k * 0.085;
      for (let x = 0; x < W; x++) if (FB[y * W + x] === SKY[9] && dens(x, y + ty, d)) FB[y * W + x] = WARM[6];
    }
    // high cirrus veils drifting slowly, brightened through ordered densities
    const cirOff = Math.round(tau * 1.5 + p * D.cloud);
    for (let y = 0; y < hzS - 40; y++) for (let x = 0; x < W; x++) {
      const X = x + cirOff, Y = y + ty;
      const sweep = Y - X * 0.12;
      const c = fbm(X / 190, sweep / 11, 131, 3) * 0.75 + vnoise(X / 26, sweep / 3.5, 137) * 0.35;
      if (c > 0.8) { if (dens(X, Y, c > 0.87 ? 0.5 : 0.25)) mapPx(x, y, UP); }
    }
    // clouds
    const cOff = -Math.round(p * D.cloud);
    blit(CLOUD_L, 4 + cOff - Math.round(tau * 0.6), 138 - ty);
    blit(CLOUD_S[0], 300 + cOff - Math.round(tau * 0.4), 206 - ty);
    blit(CLOUD_S[1], 410 + cOff - Math.round(tau * 0.4), 199 - ty);
    blit(CLOUD_S[0], 140 + cOff - Math.round(tau * 0.5), 210 - ty);

    // ship (behind nothing: it is high above the horizon)
    const spr = shipSprite(tau);
    const sx = Math.round(shipX(tau)), sy = Math.round(shipY(tau));
    const bx = sx - Math.round(spr.ox), by = sy - Math.round(spr.oy);
    const camX = -Math.round(p * D.site), camY = -ty;
    ignitionFx(tau, camX, camY);
    ignitionBloom(tau, bx, by, spr);
    flame(tau, spr, bx, by);
    blit(spr, bx, by);
    rcs(tau, bx, by, spr);

    pelicans(tau, ty);
    // ground layers
    const oSea = -Math.round(p * D.sea), oSite = -Math.round(p * D.site), oLag = -Math.round(p * D.lagoon), oB = -Math.round(p * D.build);
    drawLayer(sea, oSea - 20, ty);
    // surf: three breaker lines rolling to the beach
    for (let k = 0; k < 2; k++) {
      const ph = ((tau * 0.2 + k / 2) % 1);
      const yw = Math.round(HZ + 11 + ph * 5) - ty;
      for (let x = 0; x < W; x++) {
        const wx = x - oSea;
        const on = vnoise(wx / 12, k * 7 + Math.floor(tau * 0.2 + k / 2) * 13, 444) > 0.42 + ph * 0.35;
        if (on) px(x, yw, ph < 0.6 ? SKY[9] : SKY[8]);
      }
    }
    drawLayer(site, oSite - 30, ty);
    // aviation lights on the tower tops (slow blink)
    if ((tau % 1.6) < 0.35) { px(TOWER_A + 2 + oSite - 30, 220 - 4 - ty, WARM[2]); }
    if (((tau + 0.8) % 1.6) < 0.35) { px(TOWER_B + 2 + oSite - 30, 217 - 4 - ty, WARM[2]); }
    // lagoon water with tower reflections
    const lx = oLag - 50;
    for (let j = 0; j < lagoon.h; j++) {
      const wy = lagoon.y0 + j, y = wy - ty; if (y < 0 || y >= H) continue;
      const rip = Math.round(Math.sin(wy * 1.3 + tau * 2.2) * 0.8);
      for (let i = 0; i < lagoon.w; i++) {
        const m = lagoon.data[j * lagoon.w + i]; if (m === TRANSP) continue;
        const x = i + lx; if (x < 0 || x >= W) continue;
        if (m !== 1) { FB[y * W + x] = m; continue; }
        // sky reflection: lighter further away
        const dd = wy - HZ;
        let c = rampDither([WA[3], WA[4], SKY[8], SKY[9]], 2.3 - dd / 40, i, wy, 2.5);
        // shoreline darkening (1px under land edge)
        if (j > 0 && lagoon.data[(j - 1) * lagoon.w + i] !== 1) c = WA[3];
        // reflections of the towers
        const sxl = x - (oSite - 30) + rip, syw = 2 * MIRROR - wy;
        const sj = syw - site.y0;
        if (sxl >= 0 && sxl < 540 && sj >= 0 && sj < 95 && objMask[sj * 540 + sxl]) c = WA[2];
        // ripple glints
        const g = hash2(i, j, Math.floor(tau * 3 + i * 0.37));
        if (g > 0.996) c = SKY[9];
        FB[y * W + x] = c;
      }
    }
    // sparkles on the sea
    for (let k = 0; k < 14; k++) {
      const life = Math.floor(tau * 2.2 + k * 0.37);
      const gx = Math.floor(hash2(k, life, 5) * W), gy = HZ + 2 + Math.floor(hash2(k, life, 6) * 9) - ty;
      if (((tau * 2.2 + k * 0.37) % 1) < 0.4) px(gx, gy, SKY[9]);
    }
    drawLayer(build, oB - 60, ty);
  }
  return { T0, T1, draw, sprite: spriteAt };
})();
