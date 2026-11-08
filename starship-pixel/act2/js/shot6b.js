// Shot 6b (39.0 - 47.2): tracking the ship from further away, nose up-right, turning slowly flatter;
// soft cumulus streams upward past it (falling), the sun off-frame upper right lights the steel.
'use strict';
const SHOT6B = (function () {
  const T0 = 39.0, T1 = 47.2;
  const deg = Math.PI / 180;
  const ELEV = 0.66;
  const SUN = norm3([0.55, 0.6, 0.58]);

  const shade = makeShader({
    up: [0, Math.cos(ELEV), -Math.sin(ELEV)],
    sun: SUN,
    skyHor: 5.4, skyZen: 4.0, gndHor: 3.2, gndNad: 2.2, steelSun: 1.7,
    rimMin: 0.4, rimGraze: 0.7, rimLow: 9, rimWarm: 9, rimHot: 9, rimCol: [1, 2, 3],
    specHot: 0.93, specCol: ST[8], flapDark: 0.5, tileJag: 3.2,
    chrome: [ST[2], ST[2], ST[3], ST[4], ST[5], ST[6], ST[7], ST[8], ST[8]],
    chromeFn: (rh, rs, v, hit) => {
      if (v < 3.2) return ST[3];
      if (rh < -0.1) return ST[4];
      if (rh < 0.06) return SUR[4];
      if (rh < 0.22) return SUR[5];
      if (rh < 0.45) return ST[7];
      if (rh < 0.56) return TEAL[2];
      return ST[6];
    },
    raceway: 2.62, ringPx: true, ringEvery: 1, ringDark: 0.6,
    tileFn: (n, hit) => {
      let v = 0.75 + 2.7 * Math.max(0, dot3(n, SUN)) + 0.6 * n[1] + 0.4 * n[0];
      if (hit.mat !== 1) v += 0.6;
      return v;
    },
  });

  const theta = (tau) => keyed([[0, 48], [2.5, 42], [5.5, 32], [8.2, 27]], tau);
  // re-rasterised every frame at its exact sub-pixel position: glides, rotates, trims its flaps
  function ship(tau, subx, suby) {
    const aft = 3 * Math.sin(tau * 2 * Math.PI / 2.9);
    const fwd = 4 * Math.sin(tau * 2 * Math.PI / 2.2 + 0.7);
    return renderShip({ scale: 8.2, theta: theta(tau) * deg, elev: ELEV, yaw: 0, subx, suby,
      aftDefl: [aft * deg, -aft * deg * 0.7], fwdDefl: [fwd * deg, -fwd * deg], shade,
      edges: [
        { dir: [1, -1], mats: [1, 5, 6], cols: [ST[8]] },
        { dir: [0, -1], mats: [2, 3, 4], cols: [ST[5]] },
        { dir: [-1, 1], mats: [2, 3, 4], cols: [ST[0]] },
        { dir: [1, 1], mats: [2], cols: [ST[3]] },
      ] });
  }

  // cumulus field rising past the falling ship (two parallax layers)
  const CLOUDS = [];
  (function () {
    const rnd = mulberry32(606);
    for (let i = 0; i < 4; i++) CLOUDS.push({ layer: 0, x: rnd() * 520 - 40, y: i * 122 + rnd() * 30, spr: rimCloud(makePuffCloud(100 + i, 64 + Math.floor(rnd() * 30), 38, { n: 14, rmin: 6, rmax: 13, tower: 0.9, cols: [SKY[7], SKY[8], SKY[8], SKY[8]], t1: 0.35, t2: 0.55 }), [1, -1], SKY[9], SUR[4]) });
    for (let i = 0; i < 4; i++) CLOUDS.push({ layer: 1, x: rnd() * 520 - 60, y: i * 142 + rnd() * 40, spr: rimCloud(makePuffCloud(200 + i, 90 + Math.floor(rnd() * 50), 60, { n: 16, rmin: 7, rmax: 17, cols: [SUR[4], SKY[8], SKY[9], SKY[9]] }), [1, -1], SUR[5], SUR[3]) });
  })();
  // banded dream sky: ultramarine at the top, blue, a teal seam, pale, apricot low down
  const BANDS = [[0, SKY[4]], [38, SKY[5]], [92, SKY[6]], [150, SKY[7]], [176, TEAL[2]], [183, SKY[7]], [215, SKY[8]], [262, SUR[5]], [400, SUR[5]]];
  function band(yy, x, y) {
    for (let i = BANDS.length - 2; i >= 0; i--) if (yy >= BANDS[i][0]) {
      const span = BANDS[i + 1][0] - BANDS[i][0], f = (yy - BANDS[i][0]) / span, seam = Math.min(6, span * 0.3) / span;
      return f > 1 - seam && ((f - (1 - seam)) / seam) > bayer(x, y) ? BANDS[i + 1][1] : BANDS[i][1];
    }
    return BANDS[0][1];
  }
  function sky(tau) {
    const lift = 26 * smooth(tau / 8.2);           // the pale bands rise as the shot goes on
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const f1 = fbm(x / 150, (y + Math.round(tau * 3)) / 60, 41, 3) - 0.5;
      const yy = y + lift - (x - 240) * 0.18 + f1 * 22;
      FB[y * W + x] = band(yy, x, y);
    }
    MASK.fill(0);
    auroraVeil(tau, { x0: 120, x1: 500, base: 66, amp: 8, f1: 0.022, s1: 0.45, f2: 0.05, s2: 0.3, h: 50, strength: 0.5, map: TEALTINT });
    // the planet, vast and close to the eastern horizon below the ship
    drawPlanet({ cx: 420, cy: 262, r: 96, rot: -0.3, tilt: 0.22, light: [0.6, -0.7],
      bands: [SKY[9], SKY[9], SUR[5], SKY[9], SKY[8], SKY[9], SUR[5], SKY[8], SKY[9]], fade: (y) => clamp((300 - y) / 110, 0.35, 1) });
    drawPlanet({ cx: 70, cy: 214, r: 8, rot: 0, tilt: 0.01, light: [0.7, -0.5], bands: [SKY[9], SUR[5], SKY[9]] });
    for (const c of CLOUDS) {
      const speed = c.layer ? 13 : 5.5, span = c.layer ? 570 : 488;
      let y = c.y - tau * speed; y = ((y % span) + span) % span - 60;
      blit(c.spr, Math.round(c.x), Math.round(y));
    }
  }

  function flareRemnant(tau) {
    // ghosts from the sun just off the top-left: faint rings, drifting a little
    const sx = 30 - tau * 2, sy = -40;
    flareRing(sx + 70, sy + 80, 42, 2, 0.2);
    flareDisc(sx + 120, sy + 125, 22, 0.08, 0.3, 1);
    flareDisc(sx + 150, sy + 152, 5, 0.3, 0.6, 1);
    flareHex(sx + 205, sy + 205, 12, 0.2, 0.06, 0.25);
  }

  function wisps(tau, spr, bx, by) {
    const tips = [[shipProject(spr, 0.5, 2.3 * Math.cos(-SHIP.aftPhi), 2.3 * Math.sin(-SHIP.aftPhi)), 0],
                  [shipProject(spr, 8.1, 1.78 * Math.cos(-SHIP.fwdPhi), 1.78 * Math.sin(-SHIP.fwdPhi)), 1]];
    for (const [tp, k] of tips) {
      const x0 = bx + tp[0], y0 = by + tp[1];
      const len = k ? 22 : 34;
      for (let j = 1; j < len; j++) {
        const scroll = j + Math.floor(tau * 36);
        if (hash2(Math.floor(scroll / 4), k, 9) < 0.3) continue;
        const wob = Math.round(Math.sin(scroll * 0.25 + k) * 0.9);
        const f = 1 - j / len;
        const x = Math.floor(x0 + wob - j * 0.2), y = Math.floor(y0 - j);
        if (dens(x, y, 0.95 * f + 0.05)) mapPx(x, y, UP);
        if (j < len * 0.4 && dens(x + 1, y, 0.5 * f)) mapPx(x + 1, y, UP);
      }
    }
  }

  function draw(t) {
    const tau = t - T0;
    sky(tau);
    flareRemnant(tau);
    const cxf = keyed([[0, 236], [4, 242], [8.2, 246]], tau) + Math.sin(tau * 0.9) * 2;
    const cyf = keyed([[0, 150], [4, 144], [8.2, 141]], tau) + Math.sin(tau * 1.3 + 1) * 1.5;
    const ix = Math.floor(cxf), iy = Math.floor(cyf);
    const s = ship(tau, cxf - ix, cyf - iy);
    const bx = ix - s.ox, by = iy - s.oy;
    wisps(tau, s, bx, by);
    MASK.fill(0);
    blit(s, bx, by, true);
    lightMotes(tau, 14, 47, [0, 0, W, H], [WARM[6], TEAL[2], SUR[5]]);
    for (let k = 0; k < 12; k++) {
      const sp = 150 + hash2(k, 1, 13) * 120, per = (H + 40) / sp;
      const q = tau + hash2(k, 2, 13) * per, cyc = Math.floor(q / per), ph = (q % per) / per;
      const x = Math.floor(hash2(k, cyc, 14) * W), y = Math.floor(H + 20 - ph * (H + 40));
      for (let j = 0; j < 3; j++) if (!MASK[(y + j) * W + x] && (j === 0 || dens(x, y + j, 0.5))) mapPx(x, y + j, UP);
    }
  }
  return { T0, T1, draw };
})();
