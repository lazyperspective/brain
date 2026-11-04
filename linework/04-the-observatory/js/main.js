// The Observatory: palette, composition and render order.
'use strict';
(function () {
  const OB = window.OB;
  const H = OB.hex;
  const W = OB.W;

  // ------------------------------------------------------------------ palette
  const C = OB.C;
  const T = (arr) => arr.map(([u, h]) => [u, H(h)]);
  Object.assign(C, {
    ink: H('#0b1221'),
    amberLine: H('#f2a443'),
    amber: H('#ffae45'),
    amberHot: H('#ffe3a6'),
    amberDeep: H('#e0712a'),
    ember: H('#7a3214'),
    warmStone: H('#b97a4c'),
    trailCream: H('#f3ead2'),
    trailBlue: H('#cde2ee'),
    trailTeal: H('#8ed8d4'),
    trailGold: H('#f4cd85'),
    trailOrange: H('#f39a56'),
    rangeInk3: H('#14263a'),
    rockHi: H('#a3bdc8'),
    grassHi: H('#86aaa2'),
    mortar: H('#18222e'),
    domeHi: H('#bcd5e0'),
    telescope: H('#121a28'),
    door: H('#24180f'),
    wall: H('#24384a'),
    pathFill: H('#6d8792'),
    pathWarm: H('#c88d55'),
    pathHi: H('#c7d8de'),
    pineFill: H('#0f2b2f'),
    pineMid: H('#234c4a'),
    pineHi: H('#4f877e'),
    bark: H('#272a31'),
    barkHi: H('#7f939a'),
    juniperWood: H('#5f6b71'),
    juniperHi: H('#b9c7c9'),
    junFill: H('#13332f'),
    junMid: H('#2b5a52'),
    junHi: H('#5b968a'),
    mistFill: H('#7f9fb2'),
    mistLine: H('#bcd4dc'),
    lichen: H('#a3b8a8'),
    flower: H('#e2e6d8'),
    scree: H('#4f6978'),
    screeStone: H('#7a909b'),
    snag: H('#87949a'),
    snagHi: H('#d0dadd'),
    valleyFloor: H('#2a4357'),
    water: H('#5a8499'),
    waterLine: H('#9dc1cf'),
    road: H('#b8c8cb'),
    crevice: H('#0a111d'),
    pathShade: H('#4d6672'),
    // depth: aerial haze over the massif, the gap mist, and the near-plane extremes
    haze: H('#3f6584'),
    gapMist: H('#88a8bc'),
    gapLine: H('#c9dde4'),
    nearInk: H('#060a13'),
    bigPineFill: H('#081a1d'),
    bigPineBark: H('#1c1e25'),
  });
  C.skyTones = T([
    [0.12, '#060b1d'], [0.24, '#08102a'], [0.36, '#0b1533'], [0.47, '#0e1b3d'], [0.57, '#112247'],
    [0.66, '#152a51'], [0.74, '#1a335b'], [0.81, '#1f3d64'], [0.87, '#26486c'], [0.93, '#2e5473'], [9, '#37617b'],
  ]);
  C.massifTones = T([[0.25, '#4b6676'], [0.38, '#3f596a'], [0.5, '#344d5e'], [0.62, '#2a4253'], [0.75, '#213646'], [9, '#192a39']]);
  C.rockTones = T([[0.25, '#5a7280'], [0.38, '#4c6372'], [0.5, '#3f5665'], [0.62, '#334958'], [0.75, '#293c4b'], [9, '#1e2e3c']]);
  C.fgTones = T([[0.28, '#5b7482'], [0.4, '#3e5462'], [0.52, '#2a3b48'], [0.64, '#1c2935'], [0.76, '#121b26'], [9, '#090f18']]);
  C.stoneTones = T([[0.25, '#6e7d86'], [0.38, '#5d6c76'], [0.5, '#4d5c67'], [0.62, '#404e59'], [0.75, '#34414c'], [9, '#28333e']]);
  C.domeTones = T([[0.25, '#6d8899'], [0.4, '#56707f'], [0.55, '#435b6c'], [0.7, '#354c5e'], [0.82, '#2a3e50'], [9, '#1f3041']]);

  // ------------------------------------------------------------------ composition
  OB.scene = () => {
    const S = {};
    S.pole = { x: 1260, y: 500 };
    S.mw = { ax: -250, ay: 2050, bx: 2450, by: 120, bend: 60, hw: 470 };
    S.meteor = { x0: 640, y0: 170, x1: 250, y1: 560 };
    const o = (S.obs = {
      cx: 1440, k: 0.09, terraceR: 300, terraceTop: 1712, terraceBot: 1808, drumR: 185, drumTop: 1405, courses: 12,
      domeR: 212, y0: 1368, slitPhi: 0.25, slitW: 40, winPhi: 0.42, winY: 1552, doorPhi: -0.62,
      stair: { x0: 1048, y0: 1844, x1: 1146, y1: 1712, n: 9 },
    });
    OB.obsGeom(S);
    // telescope along the slit, aimed at the pole, its dew shield poking out past the limb
    {
      // tube seen through the slit, laid along it and leaning toward the pole
      const p0 = o.slitPt(12, 0.14), p1 = o.slitPt(-20, 1.2);
      let dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const t = Math.hypot(dx, dy);
      dx /= t; dy /= t;
      o.tel = { p0, dx, dy, len: t, w: 11 };
    }
    S.slit = { x: o.slitMid[0], y: o.slitMid[1] };
    const winX = o.cx + o.drumR * Math.sin(o.winPhi), doorX = o.cx + o.drumR * Math.sin(o.doorPhi);
    OB.lights = [
      { x: o.slitMid[0], y: o.slitMid[1] - 60, r: 760, i: 0.95, tags: ['sky'] },
      { x: o.slitMid[0], y: o.slitMid[1], r: 150, i: 0.9, tags: ['dome'] },
      { x: winX, y: o.winY + 30, r: 110, i: 0.8, tags: ['rail', 'drum'] },
      { x: doorX + 16, y: 1680, r: 210, i: 0.9, sy: 1.1, tags: ['rail', 'stair', 'path', 'massif', 'terrace'] },
    ];

    // massif: the left flank pulled back to open the valley
    const crestCtrl = [[-40, 3070], [160, 3020], [330, 2965], [480, 2900], [590, 2810], [670, 2700], [730, 2560], [785, 2410], [835, 2250], [885, 2095], [940, 1965], [1005, 1865], [1075, 1795], [1160, 1760], [1300, 1754], [1500, 1752], [1700, 1756], [1770, 1768], [1860, 1806], [1960, 1868], [2070, 1935], [2200, 1995]];
    let crest = OB.spline(crestCtrl, 6);
    crest = OB.roughen(crest, false, 13, 0.011, 2, 5);
    crest = OB.roughen(crest, false, 3.5, 0.09, 3, 3);
    const mpoly = crest.concat([[2200, 3900], [-40, 3900]]);
    S.massif = { crestPts: crest, poly: mpoly, path: OB.path(mpoly), bbox: [0, 1700, W, OB.H], crest: OB.crestLookup(crest) };
    S.massif.mask = OB.mask((g) => g.fill(S.massif.path), 0.5);

    // path: legs of uneven length and width, steep zigs with steps, following the ground
    S.pathVerts = [
      [1080, 3920, 205], [1100, 3700, 178], [1045, 3470, 150], [1000, 3300, 118], [1045, 3160, 104],
      [1250, 3065, 94], [1450, 3010, 80], [1545, 2965, 84],
      [1360, 2905, 72], [1150, 2870, 80], [985, 2815, 70],
      [1060, 2745, 62], [1240, 2700, 58], [1420, 2630, 64],
      [1320, 2565, 52], [1160, 2525, 56], [1010, 2460, 49],
      [1080, 2395, 44], [1180, 2350, 46], [1270, 2300, 41],
      [1185, 2245, 40], [1050, 2195, 37],
      [995, 2130, 34], [1035, 2070, 35], [1120, 2020, 32],
      [1075, 1965, 31], [1062, 1910, 31], [1060, 1856, 30],
    ];
    OB.buildPath(S);
    // a chain of lanterns, shrinking with distance, leads the eye up to the dome
    S.lanterns = [];
    for (const vi of [7, 10, 13, 16, 19, 21, 24, 27]) {
      const V = S.pathVerts[vi];
      let best = null, bd = Infinity;
      for (const p of S.path) { const d = Math.hypot(p.x - V[0], p.y - V[1]); if (d < bd) { bd = d; best = p; } }
      const ux = (V[0] - best.x) / (bd || 1), uy = (V[1] - best.y) / (bd || 1);
      const s = Math.max(0.6, best.w / 46);
      if (vi === 27) S.lanterns.push({ x: best.x - best.w * 0.7, y: best.y + 2, s });
      else S.lanterns.push({ x: best.x + ux * (best.w * 0.5 + 6 * s), y: best.y + uy * (best.w * 0.5 + 6 * s) + 4 * s, s });
    }
    // depth: a lantern's reach and strength fall off with distance (s shrinks up the path)
    for (const L of S.lanterns) {
      L.near = OB.clamp((L.s - 0.6) / 1.1);
      L.dim = OB.lerp(0.5, 1, Math.pow(L.near, 0.7));
      OB.lights.push({ x: L.x + 12 * L.s, y: L.y - 20 * L.s, r: 110 * L.s + 50, i: 0.85 * L.dim, sy: 1.3, tags: ['path', 'massif', 'fg'] });
    }
    S.pathOccluders = [
      { t: 0.3, s: 0.75, dx: 0.15, dy: 0.42 },
      { t: 0.47, s: 0.7, dx: -0.2, dy: 0.4 },
      { t: 0.63, s: 0.8, dx: 0.25, dy: 0.38 },
      { t: 0.8, s: 0.7, dx: -0.1, dy: 0.42 },
    ];
    S.rockBands = [
      { x0: 820, x1: 2200, y: 2045, slope: 0.05, fold: 26, h: 62, gaps: -0.15 },
      { x0: 760, x1: 2200, y: 2330, slope: -0.04, fold: 34, h: 70, gaps: -0.05, occlude: true },
      { x0: 700, x1: 2200, y: 2590, slope: 0.06, fold: 38, h: 76, gaps: -0.1 },
      { x0: 560, x1: 2200, y: 2925, slope: -0.03, fold: 44, h: 80, gaps: 0.0 },
      { x0: 700, x1: 1400, y: 3260, slope: 0.07, fold: 40, h: 76, gaps: 0.1 },
    ];
    S.scree = [
      { x: 1720, y: 2085, len: 230, spread: 0.32, tilt: 0.1 },
      { x: 1330, y: 2385, len: 190, spread: 0.28, tilt: -0.12 },
      { x: 1880, y: 2650, len: 300, spread: 0.34, tilt: 0.15 },
      { x: 880, y: 2650, len: 200, spread: 0.3, tilt: -0.18 },
      { x: 1660, y: 2990, len: 300, spread: 0.3, tilt: 0.05 },
    ];

    // valley floor, lake, river, road, village
    S.valley = {
      y0: 2772, y1: 3010, x1: 760, n: 30, vx0: 120, vx1: 470, vy: 2822,
      lake: { x: 300, y: 2866, rx: 250, ry: 30 },
      river: [[780, 2945], [680, 2925], [600, 2905], [530, 2888], [480, 2874]], riverW: [12, 6],
      road: [[-20, 2800], [120, 2812], [260, 2806], [420, 2820], [520, 2846], [610, 2880], [760, 2905]],
    };

    // ranges, receding in blues with mist between
    const pk = (arr) => arr.map(([x, h, wl, wr, e]) => ({ x, h, wl, wr, e }));
    S.ranges = [
      { seed: 101, base: 2290, bottom: 2700, rough: 26, peaks: pk([[-60, 250, 240, 260, 1.2], [180, 320, 260, 240, 1.3], [420, 200, 200, 220, 1.1], [640, 330, 270, 250, 1.25], [900, 230, 230, 260, 1.2], [1150, 270, 250, 250, 1.2], [1420, 220, 240, 240, 1.2], [1720, 260, 260, 240, 1.2], [2010, 310, 260, 260, 1.25], [2260, 210, 220, 220, 1.2]]),
        tones: T([[0.45, '#7898ad'], [0.58, '#6f8ea4'], [9, '#65849a']]), dLit: 0.34, dShadow: 0.6, mistFade: 0.3, sepMin: 5.6, sepMax: 14, lw: [0.45, 0.8], blend: 160,
        lineCss: OB.css(H('#52718a'), 0.7), crestCss: OB.css(H('#48667e')), crestW: 1.2 },
      { seed: 102, base: 2420, bottom: 2800, rough: 30, peaks: pk([[60, 200, 230, 250, 1.25], [330, 250, 250, 260, 1.3], [560, 160, 190, 200, 1.1], [800, 240, 250, 230, 1.3], [1100, 210, 240, 240, 1.2], [1500, 260, 260, 260, 1.2], [1900, 230, 250, 250, 1.2]]),
        tones: T([[0.45, '#5b7a91'], [0.58, '#516f86'], [9, '#47657b']]), dLit: 0.38, dShadow: 0.66, mistFade: 0.25, sepMin: 4.6, sepMax: 11.5, lw: [0.6, 1.1], blend: 170,
        lineCss: OB.css(H('#2c485f'), 0.85), crestCss: OB.css(H('#243d53')), crestW: 1.9 },
      { seed: 103, base: 2560, bottom: 2900, rough: 32, peaks: pk([[-50, 200, 250, 240, 1.3], [250, 230, 240, 260, 1.35], [520, 170, 220, 230, 1.2], [760, 190, 230, 240, 1.2], [1100, 200, 250, 250, 1.2]]),
        tones: T([[0.45, '#3f5d73'], [0.58, '#365369'], [9, '#2e4a60']]), dLit: 0.4, dShadow: 0.7, mistFade: 0.2, sepMin: 3.6, sepMax: 9, lw: [0.8, 1.5], blend: 180,
        lineCss: OB.css(H('#152940'), 0.93), crestCss: OB.css(H('#11223a')), crestW: 2.8 },
      { seed: 104, base: 2705, bottom: 2960, rough: 18, peaks: pk([[-80, 110, 240, 260, 1.1], [190, 150, 230, 250, 1.2], [430, 90, 200, 220, 1.1], [640, 130, 220, 230, 1.2], [900, 120, 240, 240, 1.1]]),
        tones: T([[0.45, '#2b465b'], [0.58, '#243b4f'], [9, '#1d3245']]), dLit: 0.45, dShadow: 0.75, mistFade: 0.15, sepMin: 3.2, sepMax: 7.5, lw: [1.0, 1.8], blend: 140,
        lineCss: OB.css(H('#0c1a2b'), 0.97), crestCss: OB.css(H('#09152a')), crestW: 3.4, trees: { n: 900, depth: 160, h: 13 } },
    ];
    S.mists = [
      { seed: 111, top: 2205, amp: 24, bottom: 2430, fill: C.mistFill, alpha: 0.52, lineCol: C.mistLine, lineA: 0.66, lw: 1.0, sp: [16, 6] },
      { seed: 112, top: 2345, amp: 28, bottom: 2560, fill: C.mistFill, alpha: 0.47, lineCol: C.mistLine, lineA: 0.6, lw: 1.2, sp: [15, 5.5] },
      { seed: 113, top: 2490, amp: 30, bottom: 2700, fill: C.mistFill, alpha: 0.42, lineCol: C.mistLine, lineA: 0.55, lw: 1.4, sp: [14, 5.5] },
      { seed: 114, top: 2640, amp: 26, bottom: 2790, fill: C.mistFill, alpha: 0.36, lineCol: C.mistLine, lineA: 0.5, lw: 1.5, sp: [14, 5] },
      { seed: 115, top: 2768, amp: 14, bottom: 2812, fill: C.mistFill, alpha: 0.25, lineCol: C.mistLine, lineA: 0.45, lw: 1.3, sp: [10, 6] },
    ];

    // foreground: fractured granite outcrops either side of the path
    const fgL = [[-40, 2995], [80, 2968], [200, 2958], [330, 2980], [460, 3025], [580, 3095], [690, 3195], [780, 3335], [840, 3495], [875, 3680], [895, 3920]];
    const fgR = [[1300, 3920], [1312, 3700], [1347, 3530], [1432, 3392], [1562, 3282], [1732, 3202], [1932, 3142], [2200, 3100]];
    const mk = (ctrl, close, seed) => {
      let top = OB.spline(ctrl, 6);
      top = OB.roughen(top, false, 12, 0.012, seed, 5);
      top = OB.roughen(top, false, 3, 0.1, seed + 1, 3);
      const poly = top.concat(close);
      return { top, poly, path: OB.path(poly), bbox: OB.bbox(poly) };
    };
    S.fg = [
      Object.assign(mk(fgL, [[895, 3920], [-40, 3920]], 121), { side: 'L', d0: 0.3, size: [170, 420], seed: 7 }),
      Object.assign(mk(fgR, [[2200, 3920], [1300, 3920]], 122), { side: 'R', d0: 0.32, size: [160, 400], seed: 8 }),
    ];

    S.pines = [
      { x: 1880, y: 2340, h: 270, lean: 0.9, seed: 301, needle: 15, clusterScale: 1.3, twigGap: 2.4, thick: 0.08 },
      { x: 778, y: 2470, h: 230, lean: 0.8, seed: 302, needle: 14, clusterScale: 1.3, twigGap: 2.4, thick: 0.08 },
      { x: 1690, y: 2700, h: 330, lean: 0.9, seed: 303, needle: 17, clusterScale: 1.3, twigGap: 2.4, thick: 0.08 },
      { x: 1600, y: 2160, h: 170, lean: 0.85, seed: 304, needle: 11, clusterScale: 1.3, twigGap: 2.4, thick: 0.08 },
      { x: 2060, y: 2880, h: 420, lean: 0.9, seed: 305, needle: 20, clusterScale: 1.3, twigGap: 2.4, thick: 0.08 },
      { x: 1770, y: 2475, h: 250, lean: 0.7, seed: 306, dead: 1, deadTop: true, wood: C.snag, woodHi: C.snagHi },
    ];
    S.junipers = [
      { x: 950, y: 1915, h: 150, lean: 1.0, seed: 401, roots: 3, thick: 0.15, limbs: 7, f0: 0.15, spread: 1.3, needle: 12, clusterScale: 1.5, twigGap: 2, dead: 0.15,
        spine: [[950, 1915], [944, 1860], [962, 1815], [1000, 1785], [1050, 1775]] },
      { x: 1772, y: 1778, h: 140, lean: 0.85, seed: 402, roots: 3, thick: 0.14, limbs: 6, f0: 0.2, spread: 1.2, needle: 11, clusterScale: 1.5, twigGap: 2, deadTop: true },
    ];
    // the big framing pine: rooted in the left outcrop, thrown hard over to leeward
    S.bigPine = {
      x: 70, y: 2985, h: 1150, seed: 501, roots: 6, thick: 0.12, taper: 0.72, smooth: 2, limbs: 11, f0: 0.3, needle: 30, spread: 0.6, dead: 0.12, upwind: 0.12, twigGap: 2.2, clusterScale: 1.35,
      near: true, padFill: C.bigPineFill, wood: C.bigPineBark, needleW: 1.3, olwK: 1.5,
      spine: [[70, 2990], [52, 2820], [96, 2650], [74, 2500], [118, 2370], [214, 2300], [318, 2290], [392, 2225], [450, 2120], [560, 2060], [690, 2050], [790, 2005]],
    };
    return S;
  };

  // ------------------------------------------------------------------ render
  OB.render = async (canvas, scale, opts = {}) => {
    const t0 = performance.now();
    const log = [];
    window.__drawing = { ready: false, ms: 0, log };
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0a1324';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const skip = new Set((opts.skip || '').split(',').filter(Boolean));
    const S = OB.scene();
    OB.makeMW(S);
    const step = async (name, fn) => {
      if (skip.has(name)) return;
      const t = performance.now();
      fn();
      log.push([name, Math.round(performance.now() - t)]);
      await OB.yieldFrame();
    };
    await step('sky', () => OB.drawSky(ctx, S));
    await step('ranges', () => {
      for (let i = 0; i < 4; i++) {
        OB.drawRange(ctx, S, S.ranges[i]);
        OB.drawMist(ctx, S, S.mists[i]);
      }
      OB.drawValley(ctx, S);
      OB.drawMist(ctx, S, S.mists[4]);
    });
    await step('massif', () => OB.drawMassifBase(ctx, S));
    await step('path', () => OB.drawPath(ctx, S));
    await step('rocks', () => OB.drawMassifRocks(ctx, S));
    await step('pines', () => {
      for (const p of S.pines.slice().sort((a, b) => a.y - b.y)) OB.drawPine(ctx, S, p);
    });
    await step('haze', () => OB.drawMassifHaze(ctx, S));
    await step('lanterns', () => { for (const L of S.lanterns) OB.drawLantern(ctx, L); });
    await step('observatory', () => OB.drawObservatory(ctx, S));
    await step('junipers', () => { for (const j of S.junipers) OB.drawJuniper(ctx, S, j); });
    await step('glows', () => {
      for (const L of S.lanterns) OB.lanternGlow(ctx, L);
      OB.observatoryGlow(ctx, S);
    });
    await step('gapmist', () => OB.drawGapMist(ctx, S));
    await step('foreground', () => OB.drawForeground(ctx, S));
    await step('bigpine', () => OB.drawPine(ctx, S, S.bigPine));
    await step('print', () => OB.printPass(ctx, canvas, scale));
    const ms = Math.round(performance.now() - t0);
    window.__drawing = { ready: true, ms, log, stats: { trails: S.trailCount, massifBlocks: S.massifBlocks } };
    return S;
  };
})();
