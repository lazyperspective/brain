/* First Snow, Orchard — composition and painting plan (haiku).
 * Blue-hour orchard in first snow. Horizon at y=1290, vanishing point at x=1010.
 * Farmhouse with one lit window sits right of centre at the horizon; a clear lane of
 * snow runs from the foreground to the house. Painted far to near, value first. */
(function () {
  'use strict';
  const E = window.ENGINE;
  const W = E.W, H = E.H;
  const rnd = E.mulberry32(2611);
  const rr = (a, b) => a + (b - a) * rnd();
  const clamp = E.clamp, smooth = E.smooth;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hex = (h) => [0, 2, 4].map((k) => parseInt(h.substr(1 + k, 2), 16) / 255);
  const jit = (c, a) => { const k = 1 + rr(-a, a); return [c[0] * k, c[1] * k, c[2] * k]; };
  let SEED = 100;
  const seed = () => (SEED += 17);

  /* ---------- geometry ---------- */
  const HOR = 1290, VPX = 1010, F = 1000, CAMH = 1.6;
  const HD = 10;                                  // house depth
  const hx = VPX + 5.0 * F / HD;                  // house centre x  (1510)
  const hy = HOR + CAMH * F / HD;                 // house base y    (1450)
  const wallTop = hy - 220;
  const roofPeakY = hy - 320;
  const winX = hx - 30, winY = hy - 118;          // the one lit window
  const winW = 58, winH = 76;
  const chimX = hx + 100;
  const roofY = (x) => roofPeakY + Math.abs(x - hx) * (100 / 170);
  const chimTopY = roofY(chimX) - 95;
  const glowAt = (x, y) => {
    const dx = x - winX, dy = y - winY;
    return Math.exp(-(dx * dx + dy * dy) / (2 * 420 * 420));
  };

  /* ---------- palette ---------- */
  const BARK = hex('#1c1721'), BARK_WARM = hex('#7a4a3c'), HAZE = hex('#6c70a0');
  const SNOW_HI = hex('#f1f4fc'), SNOW_SH = hex('#a3acd6'), SNOW_WARM = hex('#ffd9a6');
  const APPLE = hex('#a8231c'), APPLE_HI = hex('#ff9a7a'), APPLE_DK = hex('#4a0c12');
  const SHADOW = hex('#55567f');
  const SKY_STOPS = [
    [0.0, hex('#141935')],
    [0.45, hex('#2c3d69')],
    [0.8, hex('#6a769f')],
    [1.0, hex('#bdb9cc')],
  ];
  function skyCol(t) {
    for (let k = 0; k < SKY_STOPS.length - 1; k++) {
      const t0 = SKY_STOPS[k][0], c0 = SKY_STOPS[k][1];
      const t1 = SKY_STOPS[k + 1][0], c1 = SKY_STOPS[k + 1][1];
      if (t <= t1) return mix(c0, c1, clamp((t - t0) / (t1 - t0), 0, 1));
    }
    return SKY_STOPS[SKY_STOPS.length - 1][1];
  }
  // t: 0 at horizon, 1 at the bottom edge
  function snowBase(t) {
    return mix(hex('#9ea3c4'), hex('#d7ddf0'), smooth(0, 0.8, t));
  }
  function barkCol(x, y, T) {
    const g = glowAt(x, y);
    return mix(mix(BARK, BARK_WARM, g * 0.7), HAZE, T.haze);
  }
  function snowOn(x, y, T) {
    const g = glowAt(x, y);
    const base = mix(SNOW_SH, SNOW_HI, 0.8);
    return mix(mix(base, SNOW_WARM, g * 0.5), HAZE, T.haze * 0.7);
  }

  /* ---------- sky ---------- */
  function sky() {
    for (let k = 0; k < 420; k++) {
      const y = rr(-40, HOR + 10);
      const t = clamp(y / HOR, 0, 1);
      const x = rr(-300, W + 300);
      const len = rr(260, 900);
      const ang = rr(-0.05, 0.05);
      const pts = [
        [x, y],
        [x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5 + rr(-30, 30)],
        [x + Math.cos(ang) * len, y + Math.sin(ang) * len],
      ];
      E.stroke(pts, {
        c: jit(skyCol(t), 0.04),
        w0: rr(30, 110), w1: rr(30, 110),
        op: rr(0.25, 0.5), soft: rr(0.6, 0.95), dry: 0, imp: 0.02, bv: 0.04, seed: seed(),
      });
    }
  }

  /* ---------- far treeline on the horizon ---------- */
  function hills() {
    const pts = [];
    for (let x = -60; x <= W + 60; x += 30) {
      const n = E.fbm(x * 0.0022, 3.7, 901, 4);
      pts.push([x, HOR - 22 - n * 62]);
    }
    E.stroke(pts, { c: hex('#4b4f7c'), w0: 46, w1: 46, op: 0.9, soft: 0.3, imp: 0.05, bv: 0.04, seed: seed() });
    E.stroke(pts.map((p) => [p[0], p[1] - 12]), {
      c: hex('#a9afd0'), w0: 9, w1: 9, op: 0.55, soft: 0.5, dry: 0.3, imp: 0.5, bv: 0.05, seed: seed(),
    });
  }

  /* ---------- ground snow ---------- */
  function ground() {
    for (let k = 0; k < 1700; k++) {
      const y = HOR + 4 + rnd() * (H - HOR - 4);
      const t = (y - HOR) / (H - HOR);
      const x = rr(-150, W + 150);
      const len = (90 + 560 * t) * rr(0.6, 1.25);
      const wd = (6 + 60 * t) * rr(0.6, 1.3);
      const sl = rr(-0.035, 0.035) * (1 + t);
      const pts = [
        [x - len * 0.5, y - sl * len * 0.5],
        [x, y + rr(-wd * 0.12, wd * 0.12)],
        [x + len * 0.5, y + sl * len * 0.5],
      ];
      E.stroke(pts, {
        c: jit(snowBase(t), 0.035),
        w0: wd, w1: wd * rr(0.5, 0.9),
        op: rr(0.55, 0.9), soft: rr(0.25, 0.7), dry: rr(0.2, 0.5),
        imp: 0.12 + 0.25 * t, bv: 0.09, seed: seed(),
      });
    }
    // near snow: thick lit ridges and deep blue troughs for foreground structure
    for (let k = 0; k < 150; k++) {
      const y = rr(H * 0.6, H + 20);
      const t = (y - HOR) / (H - HOR);
      const x = rr(-150, W + 150);
      const len = (420 + 700 * t) * rr(0.6, 1.4);
      const sl = rr(-0.25, 0.25) * (0.4 + t);
      const pts = [[x - len * 0.5, y - sl * len * 0.5], [x + rr(-30, 30), y + rr(-10, 10)], [x + len * 0.5, y + sl * len * 0.5]];
      const lit = rnd() < 0.4;
      E.stroke(pts, {
        c: lit ? hex('#eef2fb') : hex('#6b6fa0'), w0: 18 + 40 * t, w1: 10 + 22 * t,
        op: lit ? rr(0.35, 0.6) : rr(0.15, 0.3), soft: 0.6, dry: 0.4,
        imp: lit ? 0.4 + 0.3 * t : 0.03, bv: 0.07, seed: seed(),
      });
    }
    // cool violet passages across the field, denser in the foreground
    for (let k = 0; k < 260; k++) {
      const y = rr(HOR + 30, H);
      const t = (y - HOR) / (H - HOR);
      const x = rr(-100, W + 100);
      const len = (160 + 520 * t) * rr(0.6, 1.2);
      E.stroke([[x - len * 0.5, y], [x + len * 0.5, y + rr(-6, 6)]], {
        c: hex('#6d6fa0'), w0: 8 + 30 * t, w1: 6 + 20 * t, op: rr(0.10, 0.22), soft: 0.7,
        dry: 0.3, imp: 0, bv: 0.05, seed: seed(),
      });
    }
    for (let k = 0; k < 90; k++) {
      const y = rr(HOR + 20, H);
      const t = (y - HOR) / (H - HOR);
      const x = rr(-200, W + 200);
      const len = (300 + 700 * t) * rr(0.7, 1.2);
      E.stroke([[x - len * 0.5, y], [x + len * 0.5, y + rr(-8, 8) * (0.4 + t)]], {
        c: hex('#7f80ad'), w0: (30 + 120 * t), w1: (20 + 90 * t), op: rr(0.08, 0.16), soft: 0.8,
        dry: 0.4, imp: 0, bv: 0.04, seed: seed(),
      });
    }
  }

  /* ---------- trees: layout ---------- */
  const trees = [];
  const ROWS = [-4.7, -3.2, -1.8, -0.4, 1.0, 2.4, 3.8, 5.2];
  const depths = [];
  for (let dep = 2.1; dep < 22; dep *= 1.13) depths.push(dep);
  for (const dep of depths) {
    for (let j = 0; j < ROWS.length; j++) {
      const X = ROWS[j] + rr(-0.2, 0.2);
      const d = dep * (1 + rr(-0.035, 0.035));
      const sx = VPX + X * F / d;
      const by = HOR + CAMH * F / d;
      if (sx < -700 || sx > W + 700) continue;
      if (d < 9 && Math.abs(sx - hx) < 260) continue;            // lane to the house
      if (d >= 6 && d < 16 && Math.abs(sx - hx) < 300) continue; // keep the house visible
      trees.push({
        sx, by, d,
        Hs: rr(1.6, 2.15) * F / d,
        haze: clamp((d - 4.5) / 15, 0, 1) * 0.6,
        seed: seed(),
        appleP: d < 7 ? 0.05 : 0.012,
      });
    }
  }
  const sorted = trees.slice().sort((a, b) => b.d - a.d);

  /* ---------- tree ground: cast shadow, contact shadow, snow mound ---------- */
  function treeGround(T) {
    const Ws = Math.max(1.3, 0.072 * F / T.d);
    const L = T.Hs * 0.85;
    E.stroke([[T.sx, T.by], [T.sx - 0.7 * L * 0.5, T.by + 0.22 * L * 0.5], [T.sx - 0.7 * L, T.by + 0.22 * L]], {
      c: SHADOW, w0: Ws * 2.4, w1: Ws * 0.6, op: 0.32, soft: 0.7, dry: 0.3, imp: 0, bv: 0.05, seed: T.seed + 1,
    });
    E.dab(T.sx, T.by - Ws * 0.1, Ws * 2.4 + 2, Ws * 0.5 + 1, { c: hex('#4a4a78'), op: 0.45, soft: 0.8, seed: T.seed + 2 });
    E.dab(T.sx, T.by - Ws * 0.2, Ws * 1.5 + 1, Ws * 0.32 + 1, { c: SNOW_HI, op: 0.9, soft: 0.45, imp: 0.9, bv: 0.04, seed: T.seed + 3 });
  }

  /* ---------- trees: branches ---------- */
  let applesPlaced = 0;
  function apple(x, y, T) {
    if (applesPlaced >= 24) return;
    applesPlaced++;
    const r = Math.max(3.2, 0.03 * F / T.d) * rr(0.9, 1.1);
    E.dab(x, y, r, r * 0.95, { c: APPLE, op: 0.95, soft: 0.22, imp: 0.5, bv: 0.12, seed: seed() });
    E.dab(x - r * 0.35, y - r * 0.38, r * 0.38, r * 0.3, { c: APPLE_HI, op: 0.75, soft: 0.6, imp: 0.3, bv: 0.05, seed: seed() });
    E.dab(x + r * 0.2, y + r * 0.5, r * 0.6, r * 0.35, { c: APPLE_DK, op: 0.5, soft: 0.8, bv: 0.05, seed: seed() });
  }

  function grow(x, y, ang, len, w, depth, T) {
    if (w < 0.7) return;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const x2 = x + ca * len, y2 = y + sa * len;
    const bend = len * rr(-0.14, 0.14);
    const mx = (x + x2) * 0.5 - sa * bend, my = (y + y2) * 0.5 + ca * bend;
    E.stroke([[x, y], [mx, my], [x2, y2]], {
      c: barkCol(mx, my, T), w0: w, w1: Math.max(0.45, w * 0.64), op: 0.97, soft: 0.1,
      imp: w > 3 ? 0.3 : 0.12, bv: 0.06, taperIn: 0.02, taperOut: 0.1,
      seed: T.seed + depth * 5 + (Math.floor(x) & 255),
    });
    // snow lying on the upper surface of the limb
    if (w > 1.6 && Math.abs(sa) < 0.7 && rnd() < 0.78) {
      let nx = -sa, ny = ca;
      if (ny > 0) { nx = -nx; ny = -ny; }
      const o = w * 0.4;
      E.stroke([
        [x + ca * len * 0.08 + nx * o, y + sa * len * 0.08 + ny * o],
        [mx + nx * o * 0.9, my + ny * o * 0.9],
        [x2 - ca * len * 0.06 + nx * o * 0.7, y2 - sa * len * 0.06 + ny * o * 0.7],
      ], {
        c: snowOn(mx, my, T), w0: w * 0.55, w1: w * 0.3, op: 0.9, soft: 0.3, dry: 0.2, imp: 0.85, bv: 0.05,
        seed: T.seed + 77 + depth,
      });
    }
    if (depth > 0 && len > 3) {
      const nc = rnd() < 0.45 ? 3 : 2;
      const spread = rr(0.28, 0.6);
      for (let k = 0; k < nc; k++) {
        const off = nc === 2 ? (k === 0 ? -spread : spread) : (k - 1) * spread * 0.95;
        let a2 = ang + off + rr(-0.12, 0.12);
        a2 += (-Math.PI / 2 - a2) * 0.07; // gentle upward pull
        grow(x2, y2, a2, len * rr(0.62, 0.78), w * 0.66, depth - 1, T);
      }
    } else if (depth === 0 && rnd() < T.appleP) {
      apple(x2, y2, T);
    }
  }

  function paintTree(T) {
    const Ws = Math.max(1.6, 0.11 * F / T.d);
    const lean = rr(-0.07, 0.07);
    const forkH = T.Hs * rr(0.3, 0.4);
    const ang0 = -Math.PI / 2 + lean;
    const fx = T.sx + Math.cos(ang0) * forkH, fy = T.by + Math.sin(ang0) * forkH;
    const tmid = [T.sx + (fx - T.sx) * 0.5 + rr(-0.03, 0.03) * T.Hs, T.by + (fy - T.by) * 0.5];
    E.stroke([[T.sx, T.by + 2], tmid, [fx, fy]], {
      c: barkCol(T.sx, T.by - forkH * 0.5, T), w0: Ws * 1.15, w1: Ws * 0.8, op: 0.97, soft: 0.1,
      imp: 0.22, bv: 0.05, taperIn: 0.02, taperOut: 0.04, seed: T.seed,
    });
    const nl = 3 + Math.floor(rnd() * 3);
    const depth = T.d < 5 ? 4 : (T.d < 9 ? 3 : 2);
    for (let k = 0; k < nl; k++) {
      const side = (k / (nl - 1)) * 2 - 1;
      const a = -Math.PI / 2 + side * rr(0.5, 1.15) + rr(-0.12, 0.12);
      const len = T.Hs * rr(0.26, 0.38);
      grow(fx, fy, a, len, Ws * 0.62, depth, T);
    }
  }

  /* ---------- farmhouse ---------- */
  function house() {
    const x0 = hx - 170, x1 = hx + 170;
    // walls, horizontal courses
    for (let y = wallTop; y < hy; y += 6) {
      const g = glowAt(hx, y);
      const c = mix(hex('#2d2a3c'), hex('#c98f55'), 0.42 * g);
      E.stroke([[x0 - 2, y + rr(-1, 1)], [hx, y + rr(-1, 1)], [x1 + 2, y + rr(-1, 1)]], {
        c: jit(c, 0.05), w0: 7, w1: 7, op: 0.96, soft: 0.25, imp: 0.2, bv: 0.05, seed: seed(),
      });
    }
    // roof: slate with snow
    for (let y = roofPeakY; y <= wallTop + 6; y += 5) {
      const hw = Math.min(170, (y - roofPeakY) / 100 * 170) + 14;
      const snowAmt = clamp(0.9 - (y - roofPeakY) / 160, 0.4, 0.9);
      const c = mix(hex('#26263a'), hex('#d3d9ec'), snowAmt);
      E.stroke([[hx - hw, y], [hx, y + rr(-1, 1)], [hx + hw, y]], {
        c: jit(c, 0.04), w0: 6, w1: 6, op: 0.97, soft: 0.2, imp: 0.6, bv: 0.04, seed: seed(),
      });
    }
    // ridge of snow along both roof slopes
    E.stroke([[hx - 170 - 8, wallTop - 2], [hx, roofPeakY - 4], [hx + 170 + 8, wallTop - 2]], {
      c: hex('#eef2fb'), w0: 9, w1: 9, op: 0.95, soft: 0.25, imp: 1.0, bv: 0.03, seed: seed(),
    });
    // chimney with snow cap
    for (let y = chimTopY; y < roofY(chimX) + 12; y += 4) {
      E.stroke([[chimX - 14, y], [chimX + 14, y]], {
        c: jit(hex('#3c2d37'), 0.06), w0: 5, w1: 5, op: 0.97, soft: 0.2, imp: 0.2, bv: 0.05, seed: seed(),
      });
    }
    E.dab(chimX, chimTopY - 1, 16, 4, { c: SNOW_HI, op: 0.95, soft: 0.3, imp: 0.9, bv: 0.03, seed: seed() });

    // window: dark frame, glowing glass, mullions
    const wx0 = winX - winW / 2, wx1 = winX + winW / 2;
    const wy0 = winY - winH / 2, wy1 = winY + winH / 2;
    for (let y = wy0 - 7; y <= wy1 + 7; y += 3) {
      E.stroke([[wx0 - 7, y], [wx1 + 7, y]], { c: hex('#1d1520'), w0: 4, w1: 4, op: 0.95, soft: 0.2, imp: 0.1, bv: 0.03, seed: seed() });
    }
    for (let y = wy0; y <= wy1; y += 2.5) {
      const v = 1 - Math.abs(y - winY) / (winH / 2); // 1 at the centre of the pane
      const c = mix(hex('#ff9a3c'), hex('#fff0b4'), clamp(v, 0, 1));
      E.stroke([[wx0, y], [wx1, y]], { c: jit(c, 0.02), w0: 3.2, w1: 3.2, op: 1, soft: 0.1, imp: 0, bv: 0.02, seed: seed() });
    }
    E.stroke([[winX - 2, wy0 - 2], [winX - 2, wy1 + 2]], { c: hex('#1d1520'), w0: 4, w1: 4, op: 0.95, soft: 0.2, bv: 0.02, seed: seed() });
    E.stroke([[wx0 - 2, winY], [wx1 + 2, winY]], { c: hex('#1d1520'), w0: 4, w1: 4, op: 0.95, soft: 0.2, bv: 0.02, seed: seed() });
    // sill with snow
    E.dab(winX, wy1 + 9, winW * 0.7, 5, { c: SNOW_HI, op: 0.95, soft: 0.35, imp: 0.9, bv: 0.03, seed: seed() });
  }

  /* ---------- smoke rising straight up from the chimney ---------- */
  function smoke() {
    for (let k = 0; k < 70; k++) {
      const u = k / 70;
      const y = chimTopY - 4 - k * 9;
      const x = chimX + Math.sin(k * 0.23) * k * 0.25 + rr(-2, 2);
      const r = 5 + k * 0.9;
      E.dab(x, y, r, r * 0.7, {
        c: jit(hex('#8c88a8'), 0.05), op: 0.24 * Math.pow(1 - u, 1.2), soft: 0.9, seed: seed(),
      });
    }
  }

  /* ---------- trees: paint in depth order ---------- */
  function paintTrees(pred) {
    for (const T of sorted) if (pred(T)) paintTree(T);
  }

  /* ---------- falling snow ---------- */
  function flakes() {
    for (let k = 0; k < 2200; k++) {
      const r = rr(0.7, 1.7);
      E.dab(rr(0, W), rr(0, H), r, r, { c: [0.95, 0.96, 1.0], op: rr(0.35, 0.85), soft: 0.3, seed: seed() });
    }
    for (let k = 0; k < 380; k++) {
      const r = rr(2.2, 4.2);
      E.dab(rr(0, W), rr(0, H), r, r, { c: [0.93, 0.95, 1.0], op: rr(0.22, 0.5), soft: 0.55, seed: seed() });
    }
    for (let k = 0; k < 16; k++) {
      const r = rr(13, 24);
      E.dab(rr(0, W), rr(H * 0.55, H), r, r, { c: [0.9, 0.92, 1.0], op: rr(0.12, 0.22), soft: 1.0, seed: seed() });
    }
  }

  /* ---------- assemble ---------- */
  function run() {
    E.base(0.34, 0.32, 0.41);             // warm-grey violet imprimatura
    sky();
    hills();
    ground();
    trees.forEach(treeGround);
    paintTrees((T) => T.d > 10);          // far rows, behind the house
    house();
    smoke();
    paintTrees((T) => T.d <= 10);         // nearer rows, in front of the house
    flakes();
    // light from the window: warm tint on snow and bark, then a soft halo
    E.light(winX, winY, 300, [1.0, 0.72, 0.42], 0.55, 1000, 'mul');
    E.light(winX, winY, 120, [1.0, 0.85, 0.6], 0.4, 400, 'mul');
    E.light(winX, winY, 60, [0.9, 0.55, 0.2], 0.35, 180, 'add');
    E.light(winX, winY, 650, [0.5, 0.35, 0.3], 0.18, 1500, 'add');
    E.finish(document.getElementById('c').getContext('2d'), { shade: 1.0, relief: 2.2, weave: 0.05 });
    window.__strokes = E.strokes();
    window.__done = true;
  }

  run();
})();
