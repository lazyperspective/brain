/* scene.js: palette, layout constants and the light model shared by every layer. */
(function () {
  'use strict';
  const LW = window.LW;
  const H = LW.hex;

  LW.W = 2160;
  LW.H = 3840;
  LW.PLATE_OFF = [2.4, 1.6]; // fill plate misregistration (native px)

  // ------------------------------------------------------------- palette
  const P = (LW.P = {
    paper: H('#e9e1cf'),
    ink: H('#11172a'),
    inkBlue: H('#1a2742'),
    inkFar: H('#22385c'),
    inkFar2: H('#2d4870'),
    // sky
    sky0: H('#08152b'),
    sky1: H('#0b1d3a'),
    sky2: H('#0f2a50'),
    sky3: H('#143a68'),
    sky4: H('#1b4c80'),
    sky5: H('#25608f'),
    milk1: H('#18406c'),
    milk2: H('#235683'),
    star: H('#f1f7ff'),
    starBlue: H('#bfe4ff'),
    starWarm: H('#ffe6bd'),
    moon: H('#f6eed5'),
    moonShade: H('#cfd9d6'),
    moonDark: H('#173a63'),
    // rock (near) light -> dark
    rock0: H('#7d8da3'),
    rock1: H('#67788f'),
    rock2: H('#526279'),
    rock3: H('#3e4b62'),
    rock4: H('#2c374c'),
    // far rock
    far0: H('#3f6189'),
    far1: H('#365579'),
    far2: H('#2e4a6d'),
    far3: H('#28405f'),
    // aerial-perspective steps: far bend (palest, bluest) and the walls behind the bridge
    air: [H('#5383ae'), H('#4a79a5'), H('#43709b'), H('#3c6791'), H('#355e87')],
    airInk: H('#2f5a88'),
    airEdge: H('#2a5280'),
    mid: [H('#405f87'), H('#37557c'), H('#2f4c70'), H('#284364'), H('#223b59')],
    midInk: H('#1a2d4b'),
    midBlack: H('#1f3454'),
    mist: H('#a6d3ee'),
    mistRule: H('#bfe3f6'),
    // water
    water0: H('#0a3f6e'),
    water1: H('#0d5d97'),
    water2: H('#127fc0'),
    water3: H('#1ba3e0'),
    water4: H('#3fc6f4'),
    water5: H('#9debff'),
    water6: H('#e3fbff'),
    waterInk: H('#0a3a68'),
    waterInkDeep: H('#0b2546'),
    // warm (firelight)
    warm0: H('#6e4a48'),
    warm1: H('#9c4d33'),
    warm2: H('#c8602c'),
    warm3: H('#e88334'),
    warm4: H('#f6ab4a'),
    warm5: H('#ffd27a'),
    warm6: H('#fff1c2'),
    warmInk1: H('#3b1d1a'),
    warmInk2: H('#5b2115'),
    warmInk3: H('#7a2a12'),
    // wood / misc
    wood0: H('#5b5a63'),
    wood1: H('#45444f'),
    teal: H('#1f5559'),
    tealDark: H('#173e45'),
  });

  // ------------------------------------------------------------- layout
  const L = (LW.L = {
    VP: [1150, 2085],
    waterY: 2255, // waterline at the bridge
    moon: [1335, 560, 104],
    lantern: [918, 2648],
    door: { x0: 404, x1: 486, y0: 2548, y1: 2706 },
    window: [292, 2468, 40],
    bridge: {
      cx: 1160,
      springY: 2215,
      r: 320,
      ring: 66,
      x0: 560,
      x1: 1760,
      crownTop: 1745,
      endTop: 1985,
      farScale: 0.86,
    },
  });
  L.bridge.topY = function (x) {
    const b = L.bridge;
    const t = Math.abs((x - b.cx) / 600);
    return b.crownTop + (b.endTop - b.crownTop) * Math.pow(t, 1.75);
  };

  // ------------------------------------------------------------- light model
  // warm firelight intensity (0..~1.5) at a point; kind tweaks occlusion
  const ln = new LW.Noise(991);
  LW.warm = function (x, y, kind) {
    const [lx, ly] = L.lantern;
    let dx = x - lx, dy = y - ly;
    let d = Math.hypot(dx, dy * 0.92);
    let I = 1.2 / (1 + Math.pow(d / 190, 2.6));
    // door spill: a wedge falling outward and down the steps
    const D = L.door;
    const dcx = (D.x0 + D.x1) / 2, dcy = D.y1 - 30;
    const ddx = x - dcx, ddy = y - dcy;
    const dd = Math.hypot(ddx * 0.85, ddy);
    let doorI = 1.0 / (1 + Math.pow(dd / 140, 2.6));
    // the wall the door is cut in blocks light going backwards / sideways up the facade
    if (kind === 'hutwall') doorI *= 0.35;
    if (ddy < -40 && kind !== 'hutwall') doorI *= LW.clamp(1 + (ddy + 40) / 160, 0.25, 1);
    // round window glow
    const [wx, wy] = L.window;
    const wd = Math.hypot(x - wx, y - wy);
    let winI = 0.55 / (1 + Math.pow(wd / 90, 2.8));
    if (kind === 'far') return 0;
    let k = 1;
    if (kind === 'rightcliff') k = 0.35;
    if (kind === 'bridge') k = 1.1;
    if (kind === 'soffit') k = 1.45;
    if (kind === 'tree') k = 0.9;
    if (kind === 'boat') k = 1.5;
    let v = (I + doorI + winI) * k;
    // light travelling across open water reaches the arch's underside and the bridge face
    if (kind === 'soffit' || kind === 'bridge') {
      const far = 1.3 / (1 + Math.pow(d / 390, 2.2));
      v += kind === 'soffit' ? far * (1.05 - 0.25 * LW.smooth(900, 1500, x)) : far * 0.32;
    }
    // gentle irregularity so bands are hand-cut, not compass-drawn
    v *= 1 + 0.12 * ln.fbm(x / 140, y / 140, 3);
    return v;
  };
  // stepped band index from warm intensity, with ragged edges
  LW.warmBand = function (v, x, y, jitter = 0.035) {
    const j = jitter ? ln.n2(x / 16, y / 16) * jitter * 0.45 + ln.n2(x / 47, y / 41) * jitter * 1.1 : 0;
    const t = v + j;
    if (t < 0.15) return 0;
    if (t < 0.25) return 1;
    if (t < 0.39) return 2;
    if (t < 0.58) return 3;
    if (t < 0.84) return 4;
    if (t < 1.15) return 5;
    return 6;
  };
  LW.warmFill = [null, P.warm0, P.warm1, P.warm2, P.warm3, P.warm4, P.warm5];
  // ink colour for a line under firelight
  LW.warmInkColor = function (band, base) {
    if (band <= 0) return base;
    if (band === 1) return LW.mix(base, P.warmInk1, 0.6);
    if (band === 2) return P.warmInk1;
    if (band === 3) return P.warmInk2;
    if (band === 4) return P.warmInk2;
    return P.warmInk3;
  };

  // moonlight lambert for a surface normal (nx, ny, nz) with ny screen-down
  const MOONDIR = (() => {
    const v = [0.5, -0.62, 0.6];
    const l = Math.hypot(v[0], v[1], v[2]);
    return [v[0] / l, v[1] / l, v[2] / l];
  })();
  LW.MOONDIR = MOONDIR;
  LW.lambert = (nx, ny, nz) => {
    const l = Math.hypot(nx, ny, nz) || 1;
    return Math.max(0, (nx * MOONDIR[0] + ny * MOONDIR[1] + nz * MOONDIR[2]) / l);
  };

  // generic stepped fill from a palette list using a value 0..1 with ragged edges
  LW.stepPick = function (pal, v, x, y, jit = 0.04) {
    const t = LW.clamp(v + (jit ? ln.n2(x / 7.3, y / 7.9) * jit + ln.n2(x / 33, y / 29) * jit : 0), 0, 0.9999);
    return pal[Math.floor(t * pal.length)];
  };
  LW.lnoise = ln;
})();
