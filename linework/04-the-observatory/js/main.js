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
    pineMid: H('#22504d'),
    pineHi: H('#4b8d84'),
    bark: H('#272a31'),
    barkHi: H('#7f939a'),
    juniperWood: H('#5f6b71'),
    juniperHi: H('#b9c7c9'),
    junFill: H('#13332f'),
    junMid: H('#2b5a52'),
    junHi: H('#5b968a'),
    mistFill: H('#7f9fb2'),
    mistLine: H('#bcd4dc'),
    crevice: H('#0a111d'),
    pathShade: H('#4d6672'),
  });
  C.skyTones = T([
    [0.12, '#060b1d'], [0.24, '#08102a'], [0.36, '#0b1533'], [0.47, '#0e1b3d'], [0.57, '#112247'],
    [0.66, '#152a51'], [0.74, '#1a335b'], [0.81, '#1f3d64'], [0.87, '#26486c'], [0.93, '#2e5473'], [9, '#37617b'],
  ]);
  C.massifTones = T([[0.25, '#4b6676'], [0.38, '#3f596a'], [0.5, '#344d5e'], [0.62, '#2a4253'], [0.75, '#213646'], [9, '#192a39']]);
  C.rockTones = T([[0.25, '#5a7280'], [0.38, '#4c6372'], [0.5, '#3f5665'], [0.62, '#334958'], [0.75, '#293c4b'], [9, '#1e2e3c']]);
  C.fgTones = T([[0.3, '#465b68'], [0.42, '#394d5b'], [0.54, '#2e404e'], [0.66, '#243442'], [0.78, '#1b2834'], [9, '#121b25']]);
  C.stoneTones = T([[0.25, '#6e7d86'], [0.38, '#5d6c76'], [0.5, '#4d5c67'], [0.62, '#404e59'], [0.75, '#34414c'], [9, '#28333e']]);
  C.domeTones = T([[0.25, '#6d8899'], [0.4, '#56707f'], [0.55, '#435b6c'], [0.7, '#354c5e'], [0.82, '#2a3e50'], [9, '#1f3041']]);

  // ------------------------------------------------------------------ composition
  OB.scene = () => {
    const S = {};
    S.pole = { x: 1260, y: 500 };
    S.mw = { ax: -250, ay: 2050, bx: 2450, by: 120, bend: 60, hw: 430 };
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

    // massif
    const crestCtrl = [[-40, 3010], [150, 2960], [330, 2890], [470, 2790], [560, 2680], [640, 2540], [700, 2400], [760, 2240], [820, 2090], [880, 1965], [950, 1868], [1030, 1806], [1100, 1772], [1160, 1758], [1300, 1754], [1500, 1752], [1700, 1756], [1770, 1768], [1860, 1806], [1960, 1868], [2070, 1935], [2200, 1995]];
    let crest = OB.spline(crestCtrl, 6);
    crest = OB.roughen(crest, false, 13, 0.011, 2, 5);
    crest = OB.roughen(crest, false, 3.5, 0.09, 3, 3);
    const mpoly = crest.concat([[2200, 3900], [-40, 3900]]);
    S.massif = { crestPts: crest, poly: mpoly, path: OB.path(mpoly), bbox: [0, 1700, W, OB.H], crest: OB.crestLookup(crest) };
    S.massif.mask = OB.mask((g) => g.fill(S.massif.path), 0.5);

    // path
    S.pathVerts = [
      [1070, 3920, 211], [1085, 3640, 180], [1030, 3380, 146], [1005, 3170, 121], [1080, 3040, 105], [1300, 2960, 93],
      [1560, 2880, 86], [1250, 2775, 77], [880, 2660, 69], [1150, 2560, 63], [1450, 2470, 58], [1200, 2385, 53],
      [960, 2300, 50], [1180, 2215, 45], [1380, 2140, 41], [1200, 2065, 37], [1020, 1990, 35], [1062, 1915, 32], [1042, 1856, 31],
    ];
    OB.buildPath(S);
    S.lanterns = [];
    for (const vi of [6, 8, 12, 16]) {
      const V = S.pathVerts[vi];
      let best = null, bd = Infinity;
      for (const p of S.path) { const d = Math.hypot(p.x - V[0], p.y - V[1]); if (d < bd) { bd = d; best = p; } }
      const ux = (V[0] - best.x) / (bd || 1), uy = (V[1] - best.y) / (bd || 1);
      const s = best.w / 46;
      S.lanterns.push({ x: best.x + ux * (best.w * 0.5 + 6 * s), y: best.y + uy * (best.w * 0.5 + 6 * s) + 4 * s, s });
    }
    for (const L of S.lanterns) OB.lights.push({ x: L.x + 12 * L.s, y: L.y - 20 * L.s, r: 120 * L.s + 60, i: 0.95, sy: 1.3, tags: ['path', 'massif', 'fg'] });

    S.village = { x0: 110, x1: 430, y: 2752, bow: 10, spread: 26, n: 28 };

    // ranges
    const pk = (arr) => arr.map(([x, h, wl, wr, e]) => ({ x, h, wl, wr, e }));
    S.ranges = [
      { seed: 101, base: 2330, bottom: 2720, rough: 26, peaks: pk([[-60, 230, 240, 260, 1.2], [180, 300, 260, 240, 1.3], [420, 190, 200, 220, 1.1], [640, 330, 270, 250, 1.25], [900, 230, 230, 260, 1.2], [1150, 270, 250, 250, 1.2], [1420, 220, 240, 240, 1.2], [1720, 260, 260, 240, 1.2], [2010, 310, 260, 260, 1.25], [2260, 210, 220, 220, 1.2]]),
        tones: T([[0.45, '#5f7f95'], [0.58, '#557589'], [9, '#4b6a80']]), dLit: 0.36, dShadow: 0.62, mistFade: 0.25, sepMin: 4.2, sepMax: 11, lw: [0.6, 1.15], blend: 160,
        lineCss: OB.css(H('#34536b'), 0.85), crestCss: OB.css(H('#2c4960')), crestW: 2.0 },
      { seed: 102, base: 2450, bottom: 2820, rough: 30, peaks: pk([[60, 190, 230, 250, 1.25], [330, 270, 250, 260, 1.3], [560, 160, 190, 200, 1.1], [800, 250, 250, 230, 1.3], [1100, 210, 240, 240, 1.2], [1500, 260, 260, 260, 1.2], [1900, 230, 250, 250, 1.2]]),
        tones: T([[0.45, '#4b6b82'], [0.58, '#425f76'], [9, '#38556b']]), dLit: 0.38, dShadow: 0.66, mistFade: 0.25, sepMin: 3.8, sepMax: 10, lw: [0.75, 1.4], blend: 170,
        lineCss: OB.css(H('#223e56'), 0.9), crestCss: OB.css(H('#1b3248')), crestW: 2.6 },
      { seed: 103, base: 2620, bottom: 2980, rough: 36, peaks: pk([[-50, 260, 250, 240, 1.3], [250, 320, 260, 280, 1.35], [520, 220, 220, 230, 1.2], [760, 210, 230, 240, 1.2], [1100, 240, 250, 250, 1.2]]),
        tones: T([[0.45, '#37546b'], [0.58, '#2e4a60'], [9, '#264156']]), dLit: 0.4, dShadow: 0.72, mistFade: 0.2, sepMin: 3.4, sepMax: 9, lw: [0.9, 1.7], blend: 190,
        lineCss: OB.css(H('#122539'), 0.95), crestCss: OB.css(H('#0e1c2d')), crestW: 3.2, trees: { n: 700, depth: 240, h: 15 } },
    ];
    S.mists = [
      { seed: 111, top: 2225, amp: 26, bottom: 2460, fill: C.mistFill, alpha: 0.42, lineCol: C.mistLine, lineA: 0.55, lw: 1.3, sp: [16, 6] },
      { seed: 112, top: 2390, amp: 30, bottom: 2600, fill: C.mistFill, alpha: 0.45, lineCol: C.mistLine, lineA: 0.6, lw: 1.5, sp: [15, 5.5] },
      { seed: 113, top: 2610, amp: 34, bottom: 2990, fill: C.mistFill, alpha: 0.5, lineCol: C.mistLine, lineA: 0.65, lw: 1.7, sp: [14, 5] },
    ];

    // foreground outcrops
    const fgL = [[-40, 2880], [60, 2852], [170, 2840], [290, 2862], [420, 2912], [550, 3000], [670, 3122], [770, 3282], [835, 3462], [870, 3662], [892, 3920]];
    const fgR = [[1300, 3920], [1312, 3700], [1347, 3530], [1432, 3392], [1562, 3282], [1732, 3202], [1932, 3142], [2200, 3100]];
    const mk = (ctrl, close, seed) => {
      let top = OB.spline(ctrl, 6);
      top = OB.roughen(top, false, 12, 0.012, seed, 5);
      top = OB.roughen(top, false, 3, 0.1, seed + 1, 3);
      const poly = top.concat(close);
      return { top, poly, path: OB.path(poly), bbox: OB.bbox(poly) };
    };
    S.fg = [
      Object.assign(mk(fgL, [[892, 3920], [-40, 3920]], 121), { side: 'L', d0: 0.5, dip: 0.24, aspect: 0.55, size: [150, 360], seed: 7 }),
      Object.assign(mk(fgR, [[2200, 3920], [1300, 3920]], 122), { side: 'R', d0: 0.52, dip: -0.2, aspect: 0.55, size: [140, 340], seed: 8 }),
    ];

    S.pines = [
      { x: 1872, y: 2335, h: 230, lean: 0.9, seed: 301 },
      { x: 762, y: 2478, h: 220, lean: 0.75, seed: 302 },
      { x: 1660, y: 2652, h: 300, lean: 0.85, seed: 303 },
      { x: 1585, y: 2108, h: 150, lean: 0.8, seed: 304 },
      { x: 2070, y: 2820, h: 380, lean: 0.85, seed: 305 },
    ];
    S.junipers = [
      { x: 958, y: 1912, h: 200, lean: 0.9, seed: 401, roots: 3 },
      { x: 1772, y: 1778, h: 165, lean: 0.85, seed: 402, roots: 3 },
    ];
    S.bigPine = {
      x: 150, y: 2856, h: 1180, lean: 0.95, seed: 501, roots: 6, thick: 0.064, branches: 7, needle: 21, padScale: 0.95, spread: 0.8,
      spine: [[150, 2856], [118, 2660], [146, 2470], [120, 2290], [150, 2110], [214, 1960], [300, 1850], [400, 1775], [500, 1735]],
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
      OB.drawRange(ctx, S, S.ranges[0]);
      OB.drawMist(ctx, S, S.mists[0]);
      OB.drawRange(ctx, S, S.ranges[1]);
      OB.drawMist(ctx, S, S.mists[1]);
      OB.drawRange(ctx, S, S.ranges[2]);
      OB.drawVillage(ctx, S);
      OB.drawMist(ctx, S, S.mists[2]);
    });
    await step('massif', () => OB.drawMassif(ctx, S));
    await step('path', () => {
      OB.drawPath(ctx, S);
      for (const L of S.lanterns) OB.drawLantern(ctx, L);
    });
    await step('pines', () => {
      for (const p of S.pines.slice().sort((a, b) => a.y - b.y)) OB.drawPine(ctx, S, p);
    });
    await step('observatory', () => OB.drawObservatory(ctx, S));
    await step('junipers', () => { for (const j of S.junipers) OB.drawJuniper(ctx, S, j); });
    await step('glows', () => {
      for (const L of S.lanterns) OB.lanternGlow(ctx, L);
      OB.observatoryGlow(ctx, S);
    });
    await step('foreground', () => OB.drawForeground(ctx, S));
    await step('bigpine', () => OB.drawPine(ctx, S, S.bigPine));
    await step('print', () => OB.printPass(ctx, canvas, scale));
    const ms = Math.round(performance.now() - t0);
    window.__drawing = { ready: true, ms, log, stats: { trails: S.trailCount, massifBlocks: S.massifBlocks } };
    return S;
  };
})();
