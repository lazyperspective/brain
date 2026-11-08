// Shot 6b (39.0 - 47.2): tracking the ship from further away, nose up-right, turning slowly flatter;
// soft cumulus streams upward past it (falling), the sun off-frame upper right lights the steel.
'use strict';
const SHOT6B = (function () {
  const T0 = 39.0, T1 = 47.2;
  const deg = Math.PI / 180;
  const ELEV = 0.42;
  const SUN = norm3([0.55, 0.6, 0.58]);

  const shade = makeShader({
    up: [0, Math.cos(ELEV), -Math.sin(ELEV)],
    sun: SUN,
    skyHor: 5.4, skyZen: 4.0, gndHor: 3.2, gndNad: 2.2, steelSun: 1.7,
    rimMin: 0.4, rimGraze: 0.7, rimLow: 9, rimWarm: 9, rimHot: 9, rimCol: [1, 2, 3],
    specHot: 0.93, specCol: ST[8], flapDark: 0.5, tileJag: 3.2,
    chrome: [ST[2], ST[2], ST[3], ST[4], ST[5], ST[6], ST[7], ST[8], ST[8]],
    tileFn: (n, hit) => {
      let v = 1.0 + 2.0 * Math.max(0, dot3(n, SUN)) + 0.5 * n[1] + 0.4 * n[0];
      if (hit.mat !== 1) v += 0.6;
      return v;
    },
  });

  const theta = (tau) => keyed([[0, 48], [2.5, 42], [5.5, 32], [8.2, 27]], tau);
  function ship(tau) {
    const th = Math.round(theta(tau) * 4) / 4;   // quarter-degree steps
    const aft = Math.round(3 * Math.sin(tau * 2 * Math.PI / 2.9) * 2) / 2;
    const fwd = Math.round(4 * Math.sin(tau * 2 * Math.PI / 2.2 + 0.7) * 2) / 2;
    const key = `6b|${th}|${aft}|${fwd}`;
    return cachedShip(key, () => renderShip({ scale: 8.2, theta: th * deg, elev: ELEV, yaw: 0,
      aftDefl: [aft * deg, -aft * deg * 0.7], fwdDefl: [fwd * deg, -fwd * deg], shade,
      edges: [
        { dir: [1, -1], mats: [1, 5, 6], cols: [ST[8]] },
        { dir: [0, -1], mats: [2, 3, 4], cols: [ST[5]] },
        { dir: [-1, 1], mats: [2, 3, 4], cols: [ST[0]] },
        { dir: [1, 1], mats: [2], cols: [ST[3]] },
      ] }));
  }

  // cumulus field rising past the falling ship (two parallax layers)
  const CLOUDS = [];
  (function () {
    const rnd = mulberry32(606);
    for (let i = 0; i < 4; i++) CLOUDS.push({ layer: 0, x: rnd() * 520 - 40, y: i * 122 + rnd() * 30, spr: makePuffCloud(100 + i, 64 + Math.floor(rnd() * 30), 38, { n: 14, rmin: 6, rmax: 13, tower: 0.9, cols: [SKY[7], SKY[8], SKY[8], SKY[8]], t1: 0.35, t2: 0.55 }) });
    for (let i = 0; i < 4; i++) CLOUDS.push({ layer: 1, x: rnd() * 520 - 60, y: i * 142 + rnd() * 40, spr: makePuffCloud(200 + i, 90 + Math.floor(rnd() * 50), 60, { n: 16, rmin: 7, rmax: 17 }) });
  })();
  function sky(tau) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // pale blue, lighter toward the hazy upper-left where the flare lives
      let v = 7.2 + 0.55 * smooth(tau / 8.2) - 0.7 * (x * 0.6 + y) / (W * 0.6 + H) + 0.7 * Math.max(0, 1 - Math.hypot(x - 60, y + 30) / 300);
      const f1 = fbm(x / 150, (y + Math.round(tau * 3)) / 60, 41, 3);
      v += clamp((f1 - 0.5) * 1.6, -0.08, 0.3);
      FB[y * W + x] = rampDither(SKY, clamp(v, 5.8, 8.9), x, y, 4);
    }
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
    const tips = [[shipProject(spr, 0.6, 1.9 * Math.cos(-SHIP.aftPhi), 1.9 * Math.sin(-SHIP.aftPhi)), 0],
                  [shipProject(spr, 8.4, 1.55 * Math.cos(-SHIP.fwdPhi), 1.55 * Math.sin(-SHIP.fwdPhi)), 1]];
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
    const s = ship(tau);
    const cx = Math.round(keyed([[0, 236], [4, 242], [8.2, 246]], tau) + Math.sin(tau * 0.9) * 2);
    const cy = Math.round(keyed([[0, 150], [4, 144], [8.2, 141]], tau) + Math.sin(tau * 1.3 + 1) * 1.5);
    const bx = cx - Math.round(s.ox), by = cy - Math.round(s.oy);
    wisps(tau, s, bx, by);
    MASK.fill(0);
    blit(s, bx, by, true);
    for (let k = 0; k < 12; k++) {
      const sp = 150 + hash2(k, 1, 13) * 120, per = (H + 40) / sp;
      const q = tau + hash2(k, 2, 13) * per, cyc = Math.floor(q / per), ph = (q % per) / per;
      const x = Math.floor(hash2(k, cyc, 14) * W), y = Math.floor(H + 20 - ph * (H + 40));
      for (let j = 0; j < 3; j++) if (!MASK[(y + j) * W + x] && (j === 0 || dens(x, y + j, 0.5))) mapPx(x, y + j, UP);
    }
  }
  return { T0, T1, draw };
})();
