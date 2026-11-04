/* cliffs.js: gorge walls from the far bend to the near framing cliffs.
   Each wall = flat stepped fill + evenly-spaced streamline hatching that flows
   down the rock and merges in Y-junctions + crack cross-strokes + black crevices. */
(function () {
  'use strict';
  const LW = window.LW;
  const P = LW.P;

  function edgeFrom(ctrl, seed, amp, freq, fine = 4) {
    const n = new LW.Noise(seed);
    let pts = LW.spline(ctrl, 14);
    pts = LW.resample(pts, 5);
    pts = LW.roughen(pts, n, amp, freq, 5, seed * 0.01);
    if (fine) pts = LW.roughen(pts, new LW.Noise(seed + 1), fine, 1 / 14, 3, 1.3);
    return pts;
  }

  // ---------------------------------------------------------------- layer specs
  function buildLayers() {
    const layers = [];
    // far wall at the bend (the farthest plane: a low rounded shoulder closing the gorge)
    {
      const edge = edgeFrom([[1050, 1930], [1100, 1868], [1160, 1840], [1225, 1852], [1300, 1920]], 41, 7, 1 / 60, 2);
      const poly = edge.concat([[1300, 2088], [1050, 2088]]);
      layers.push({ name: 'F', poly, edge, tier: 0, face: [0.1, 0.99], base: [[1050, 2087], [1300, 2087]], seed: 41, far: 1 });
    }
    // far bend walls: they stand clear of the walls behind the bridge so each plane reads as its own step
    {
      const edge = edgeFrom([[870, 1428], [940, 1478], [1000, 1560], [1050, 1660], [1090, 1770], [1120, 1880], [1142, 1980], [1155, 2050], [1160, 2083]], 42, 13, 1 / 70, 2.5);
      const base = [[1160, 2083], [1110, 2092], [1020, 2100], [900, 2104]];
      const poly = edge.concat(base.slice(1), [[800, 2104], [800, 1428]]);
      layers.push({ name: 'L2', poly, edge, tier: 0, face: [0.62, 0.78], base, seed: 42 });
    }
    {
      const edge = edgeFrom([[1445, 1398], [1372, 1488], [1310, 1590], [1265, 1700], [1230, 1820], [1208, 1940], [1196, 2030], [1190, 2084]], 43, 13, 1 / 70, 2.5);
      const base = [[1190, 2084], [1250, 2092], [1350, 2100], [1450, 2106]];
      const poly = edge.concat(base.slice(1), [[1520, 2106], [1520, 1398]]);
      layers.push({ name: 'R2', poly, edge, tier: 0, face: [-0.6, 0.8], base, seed: 43 });
    }
    // walls behind the bridge (one step nearer)
    {
      const edge = edgeFrom([[740, 1200], [810, 1260], [860, 1360], [895, 1480], [925, 1600], [955, 1720], [985, 1840], [1010, 1960], [1025, 2050], [1028, 2100], [1020, 2118]], 44, 22, 1 / 80, 4);
      const base = [[1020, 2118], [970, 2140], [900, 2164], [800, 2186]];
      const poly = edge.concat(base.slice(1), [[640, 2186], [640, 1200]]);
      layers.push({ name: 'L1', poly, edge, tier: 1, face: [0.6, 0.8], base, seed: 44 });
    }
    {
      const edge = edgeFrom([[1530, 1150], [1480, 1240], [1440, 1360], [1405, 1500], [1375, 1640], [1350, 1780], [1328, 1910], [1312, 2020], [1305, 2080], [1310, 2116]], 45, 22, 1 / 80, 4);
      const base = [[1310, 2116], [1370, 2134], [1450, 2155], [1560, 2172]];
      const poly = edge.concat(base.slice(1), [[1720, 2172], [1720, 1150]]);
      layers.push({ name: 'R1', poly, edge, tier: 1, face: [-0.62, 0.78], base, seed: 45 });
    }
    // near left cliff (moonlit face, warm at the foot)
    {
      const edge = edgeFrom([
        [705, -30], [668, 140], [716, 330], [688, 520], [748, 700], [726, 880], [790, 1060], [772, 1230],
        [828, 1400], [806, 1560], [866, 1700], [884, 1810], [862, 1868],
      ], 46, 34, 1 / 110, 6);
      // under the ledge the cliff steps back to where the bridge is keyed in
      const under = edgeFrom([[862, 1868], [790, 1898], [720, 1930], [690, 2020], [676, 2130], [664, 2230], [650, 2262]], 47, 10, 1 / 50, 3);
      const shore = edgeFrom([[650, 2262], [700, 2290], [770, 2330], [776, 2420], [752, 2520], [770, 2620], [820, 2730], [905, 2840], [960, 2905], [930, 2990], [860, 3080], [780, 3180], [700, 3320]], 48, 8, 1 / 60, 3);
      const poly = edge.concat(under.slice(1), shore.slice(1), [[600, 3500], [-40, 3500], [-40, -30]]);
      layers.push({ name: 'L0', poly, edge: edge.concat(under.slice(1)), shore, tier: 2, face: [0.58, 0.81], base: null, seed: 46, kind: 'rock' });
    }
    // near right cliff (shadow side, black rim against the sky)
    {
      const edge = edgeFrom([
        [1565, -30], [1612, 150], [1548, 330], [1588, 520], [1506, 700], [1560, 880], [1496, 1060], [1534, 1240],
        [1466, 1400], [1506, 1560], [1566, 1700], [1610, 1820], [1648, 1930], [1664, 2050], [1668, 2180], [1660, 2262],
      ], 49, 34, 1 / 110, 6);
      const base = edgeFrom([[1660, 2262], [1760, 2330], [1880, 2430], [2010, 2560], [2120, 2690], [2200, 2760]], 50, 10, 1 / 60, 3);
      const poly = edge.concat(base.slice(1), [[2200, -30]]);
      layers.push({ name: 'R0', poly, edge, tier: 2, face: [-0.62, 0.78], base, seed: 49, kind: 'rightcliff' });
    }
    for (const l of layers) {
      l.path = LW.polyPath(l.poly);
      l.bbox = LW.bbox(l.poly, 4);
      l.bbox[0] = Math.max(l.bbox[0], -10); l.bbox[1] = Math.max(l.bbox[1], -10);
      l.bbox[2] = Math.min(l.bbox[2], LW.W + 10); l.bbox[3] = Math.min(l.bbox[3], LW.H + 10);
    }
    return layers;
  }
  LW.cliffLayers = buildLayers();
  LW.cliff = (name) => LW.cliffLayers.find((l) => l.name === name);

  // ---------------------------------------------------------------- tier parameters
  /* Each receding plane is its own step: the far bend is palest and bluest with the
     finest, sparsest marks and the simplest cells; the walls behind the bridge are one
     step nearer; the near framing walls carry the heaviest ink and the full value range. */
  const TIER = [
    {
      ink: P.airInk, pal: P.air, outline: 1.25, outlineCol: P.airEdge, rim: 0.8, pocket: 9, black: null,
      cell: { sc: 0.82, lineW: [0.5, 0.85], step: 10, wedge: false, hatchCut: 0.2, crackW: 0.5, crackFill: 0.1, crackGap: 0.35, lump: 0.45, aniso: 1.7, wobble: 0.5 },
    },
    {
      ink: P.midInk, pal: P.mid, outline: 2.1, outlineCol: P.midInk, rim: 1, pocket: 1.04, black: P.midBlack,
      cell: { sc: 0.8, lineW: [0.8, 1.55], step: 6.6, wedgeW: 6, hatchCut: 0, crackW: 0.8, crackFill: 0.22, crackGap: 0.06, lump: 0.7, aniso: 1.6, wobble: 0.7 },
    },
    {
      ink: P.ink, pal: [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4], outline: 5.5, outlineCol: P.ink, rim: 1, pocket: 1.0, black: P.ink,
      cell: { sc: 1, lineW: [1.25, 2.9], step: 5.5, wedgeW: 12, hatchCut: 0, crackW: 1.05, crackFill: 0.3, crackGap: 0, lump: 0.74, aniso: 1.45, wobble: 0.8 },
    },
  ];

  // ---------------------------------------------------------------- per-layer fields
  function layerFields(l) {
    const n = new LW.Noise(l.seed * 13 + 5);
    const n2 = new LW.Noise(l.seed * 17 + 9);
    const T = TIER[l.tier];
    const mask = new LW.Mask(l.bbox, 4, (cx) => cx.fill(l.path));
    mask.edt();
    const scale = l.tier === 2 ? 1 : l.tier === 1 ? 0.7 : 0.5;
    // big form: vertical buttresses / columns (drives value); medium lumps drive line meander
    const formBig = (x, y) => {
      const wx = x + 160 * n.fbm(x / 700, y / 700, 2) * scale;
      return n.fbm(wx / (400 * scale), y / (980 * scale), 3);
    };
    const form = (x, y) => formBig(x, y) + 0.3 * n2.fbm(x / (130 * scale), y / (240 * scale), 3);
    const res = 6;
    const F = new LW.Grid(l.bbox, res, form);
    const FB = new LW.Grid(l.bbox, res, formBig);
    const baseY = l.base ? (x) => LW.yAt(l.base, x) : () => 1e9;
    // recess field: long vertical clefts between buttresses (shadowed), plus strata ledges
    const ledges = l.name === 'L0' ? [[700, -0.12], [1340, 0.1]] : l.name === 'R0' ? [[560, 0.16], [1250, -0.12]] : [];
    const ledgeY = (ly, sl, x) => ly + sl * (x - 900) + 70 * n.fbm(x / 300, ly, 3);
    const ledgeGate = (ly, x) => LW.smooth(-0.15, 0.25, n2.fbm(x / 340, ly * 0.01, 2));
    const cleftAt = (x, y) => {
      const wx = x + 90 * n.fbm(x / 400, y / 400, 2) * scale;
      return LW.smooth(0.12, 0.45, n2.fbm(wx / (210 * scale), y / (1400 * scale) + 3.3, 2));
    };
    const dark = new LW.Grid(l.bbox, res, (x, y) => {
      const e = 6;
      const gx = (FB.at(x + e, y) - FB.at(x - e, y)) / (2 * e);
      const gy = (FB.at(x, y + e) - FB.at(x, y - e)) / (2 * e);
      const k = 55 * scale;
      const nx = l.face[0] - gx * k, ny = -gy * k * 0.5, nz = l.face[1];
      const lit = LW.lambert(nx, ny, nz);
      let d = 0.12 + (1 - lit) * 0.62;
      // clefts
      const wx = x + 90 * n.fbm(x / 400, y / 400, 2) * scale;
      const cl = n2.fbm(wx / (210 * scale), y / (1400 * scale) + 3.3, 2);
      d += 0.3 * LW.smooth(0.12, 0.45, cl) * (l.tier === 0 ? 0.5 : 1);
      // ledges: a lit lip then a shadow band under it
      for (const [ly, sl] of ledges) {
        const yy = ledgeY(ly, sl, x);
        const gate = ledgeGate(ly, x);
        if (gate <= 0) continue;
        const t = y - yy;
        const len = 70 + 90 * (0.5 + 0.5 * n.n2(x / 180, ly));
        if (t > -12 && t < 0) d -= 0.22 * gate;
        else if (t >= 0 && t < len) d += 0.32 * gate * Math.pow(1 - t / len, 1.6);
      }
      // gorge depth: lower = darker; far tiers lighter overall
      if (l.tier === 2) d += 0.2 * LW.smooth(900, 2600, y);
      // far bend: the tops sink toward the sky's value, the feet pale out into the mist
      if (l.tier === 0) d += -0.1 + 0.32 * LW.smooth(1980, 1460, y);
      d += 0.05 * n2.fbm(x / 160, y / 240, 2);
      // black rim band along the right cliff's sky edge (its turned face)
      if (l.name === 'R0') {
        const ed = mask.edtAt(x, y);
        const band = 14 + 34 * Math.max(0, 0.5 + 0.7 * n.fbm(y / 300, 1.5, 3));
        if (ed < band && y < 2240) d = 1.05;
        else if (ed < band * 2.2) d = Math.max(d, 0.85);
      }
      if (l.name === 'L0') {
        const ed = mask.edtAt(x, y);
        const band = 4 + 16 * Math.max(0, n.fbm(y / 220, 4.5, 3) + 0.15);
        if (ed < band && y < 1880) d = 1.02;
      }
      // the right wall's cast shadow falls diagonally across the lower left wall
      if (l.name === 'L0') {
        const sx = (x - 860) / 600, sy = (y - 1500) / 780;
        d += 0.42 * (1 - Math.exp(-(sx * sx + sy * sy))) * LW.smooth(2000, 1250, y);
        const ys = 1880 - 0.6 * x + 70 * n.fbm(x / 240, 7.7, 3) + 25 * n2.n2(x / 60, 2.2);
        const t = y - ys;
        if (t > 0) d += 0.3 * LW.smooth(0, 26, t);
        else d -= 0.06;
      }
      // print-like falloff into the top corners
      if (l.tier === 2) d += 0.26 * LW.smooth(900, 0, y) + 0.12 * LW.smooth(300, 0, Math.min(x, LW.W - x));
      // under-ledge shadow
      if (l.name === 'L0' && y > 1860 && y < 2010 && x > 600) d += 0.3 * LW.smooth(2000, 1878, y);
      if (l.name === 'SC') d += 0.28;
      // grade the left wall darker toward the frame edges so the brightest rock sits by the bridge and hut
      if (l.name === 'L0') d += 0.22 * LW.smooth(1500, 150, y) + 0.2 * LW.smooth(520, 0, x);
      // the waterline is darker (wet rock)
      const by = baseY(x);
      if (y < by) d += 0.12 * LW.smooth(by - 70, by - 8, y);
      // walls behind the bridge: darks lifted and range compressed (aerial perspective)
      if (l.tier === 1) d = 0.1 + 0.84 * d;
      return LW.clamp(d, 0, 1.1);
    });
    // flow direction: down the face, hugging the silhouette, meandering
    const dirG = { vx: new LW.Grid(l.bbox, res), vy: new LW.Grid(l.bbox, res) };
    const tilt = l.face[0] > 0 ? 0.18 : -0.18;
    for (let j = 0; j < dirG.vx.h; j++) {
      for (let i = 0; i < dirG.vx.w; i++) {
        const x = l.bbox[0] + i * res, y = l.bbox[1] + j * res;
        const e = mask.edtAt(x, y);
        const gx = mask.edtAt(x + 8, y) - mask.edtAt(x - 8, y);
        const gy = mask.edtAt(x, y + 8) - mask.edtAt(x, y - 8);
        let tx = gy, ty = -gx;
        const tl = Math.hypot(tx, ty);
        if (tl > 1e-6) { tx /= tl; ty /= tl; } else { tx = 0; ty = 1; }
        if (ty < 0) { tx = -tx; ty = -ty; }
        const we = Math.exp(-e / (170 * scale + 40));
        let a = tilt + 0.55 * n.fbm(x / 520, y / 900, 2);
        let bx = Math.sin(a), byy = Math.cos(a);
        let vx = bx * (1 - we) + tx * we, vy = byy * (1 - we) + ty * we;
        // meander: rotate by a smooth noise angle; wider swings on the form slopes
        const fx = (F.at(x + 6, y) - F.at(x - 6, y)) / 12;
        const r = 0.6 * n2.fbm(x / (260 * scale + 40), y / (420 * scale + 60), 2) + fx * 55 * scale;
        const c = Math.cos(r), s = Math.sin(r);
        const rx = vx * c - vy * s, ry = vx * s + vy * c;
        const L = Math.hypot(rx, ry) || 1;
        dirG.vx.v[j * dirG.vx.w + i] = rx / L;
        dirG.vy.v[j * dirG.vx.w + i] = ry / L;
      }
    }
    const dir = (x, y) => {
      const vx = dirG.vx.at(x, y), vy = dirG.vy.at(x, y);
      const L = Math.hypot(vx, vy);
      if (L < 1e-4) return null;
      return [vx / L, vy / L];
    };
    return { mask, dark, dir, F, n, n2, T, baseY, ledges, ledgeY, ledgeGate, cleftAt, scale };
  }

  // ---------------------------------------------------------------- cellular rock wall (mid + near tiers)
  function drawCellCliff(ctx, S, l, f, kind, pal, T, rimCol) {
    const near = l.tier === 2;
    const C = T.cell;
    const sc = C.sc;
    const rim = l.base ? (x, y) => {
      const rimD = f.baseY(x) - y;
      if (rimD > 34 * T.rim || rimD < -2) return 0;
      return LW.smooth(34, 4, rimD + LW.lnoise.n2(x / 9, y / 9) * 7);
    } : null;
    const tilt = l.face[0] > 0 ? 0.15 : -0.15;
    LW.cellRock(ctx, S, {
      path: l.path, bbox: l.bbox, mask: f.mask, seed: l.name,
      dark: (x, y) => f.dark.at(x, y),
      size: (x, y) => {
        const cl = f.cleftAt(x, y);
        let s = (112 - 76 * cl) * (0.75 + 0.5 * (0.5 + 0.5 * f.n.n2(x / 260, y / 260)));
        // smaller, busier cells along the silhouette and at the foot
        s *= 0.7 + 0.3 * LW.smooth(0, 90, f.mask.edtAt(x, y));
        return s * sc;
      },
      maxSize: 140 * sc,
      aniso: C.aniso,
      kind, pal,
      ink: T.ink,
      lineW: C.lineW,
      step: C.step,
      lumpRatio: l.name === 'R0' ? 0.55 : C.lump,
      light: [0.62, -0.78],
      flow: () => Math.PI / 2 + tilt,
      wedge: C.wedge, wedgeW: C.wedgeW,
      hatchCut: C.hatchCut, crackW: C.crackW, crackFill: C.crackFill, crackGap: C.crackGap, wobble: C.wobble,
      black: T.black || T.ink,
      rim, rimCol,
    });
    const ink = new LW.Ink(l.seed + 900);
    ink.wobble = 0.9;
    // vertical fissures and deep pockets (contour fills)
    const cn = new LW.Noise(l.seed + 77);
    const bb = l.bbox;
    const blackField = (x, y) => {
      if (x < bb[0] + 9 || y < bb[1] + 9 || x > bb[2] - 9 || y > bb[3] - 9) return -1;
      if (!f.mask.in(x, y)) return -1;
      const d = f.dark.at(x, y);
      let v = d - T.pocket;
      const wx = x + 40 * cn.fbm(x / 200, y / 200, 2);
      const r = cn.ridged(wx / 52, y / 520, 2);
      const env = LW.smooth(0.1, 0.6, cn.fbm(x / 170 + 9, y / 340, 2));
      const g = 0.3 + 0.7 * LW.smooth(0.3, 0.85, d);
      v = Math.max(v, (r - 0.945) * 4 * env * g - 0.006);
      if (kind !== 'far') v -= 0.4 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return v;
    };
    const black = T.black;
    if (black) LW.contours({ bbox: bb, step: 4, field: blackField, levels: [0] }, (pts) => {
      if (pts.length < 4) return;
      let area = 0;
      for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
      if (Math.abs(area) < 60) return;
      const sm = LW.chaikin(pts, 1, true);
      const cx = sm[0][0], cy = sm[0][1];
      const b = kind !== 'far' ? LW.warmBand(LW.warm(cx, cy, kind), cx, cy, 0) : 0;
      ink.fill(sm, b >= 3 ? P.warmInk2 : b >= 1 ? P.warmInk1 : black, 0.8);
    });
    // strata ledges: a lit lip line with an undercut black shadow beneath
    for (const [ly, sl] of f.ledges) {
      let run = [];
      const flushRun = () => {
        if (run.length > 6) {
          ink.line(run, (x, y) => ink.st(ink.col(P.ink), 3.2), { taper: 30 });
          const under = run.map((p, i) => [p[0], p[1] + 4 + 12 * Math.pow(Math.sin(Math.PI * i / (run.length - 1)), 0.7) * (0.6 + 0.4 * cn.n2(p[0] / 50, ly))]);
          ink.fill(run.concat(under.slice().reverse()), P.ink, 0.6);
        }
        run = [];
      };
      for (let x = bb[0]; x <= bb[2]; x += 6) {
        const y = f.ledgeY(ly, sl, x);
        if (f.ledgeGate(ly, x) > 0.35 && f.mask.in(x, y) && f.mask.edtAt(x, y) > 14) run.push([x, y]);
        else flushRun();
      }
      flushRun();
    }
    ctx.save();
    ctx.clip(l.path);
    ink.flush(ctx);
    ctx.restore();
    // silhouette outline
    const ink2 = new LW.Ink(l.seed + 901);
    ink2.wobble = 0.6;
    const oc = ink2.col(T.outlineCol);
    const wn = new LW.Noise(l.seed + 55);
    ink2.line(l.edge, (x, y) => (l.name === 'SC' && x < 700 ? -1 : ink2.st(l.kind === 'rock' ? ink2.col(LW.warmInkColor(LW.warmBand(LW.warm(x, y, 'rock'), x, y, 0), P.ink)) : oc, T.outline * (0.75 + 0.5 * (0.5 + 0.5 * wn.n2(x / 60, y / 60))))), { taper: 0 });
    if (l.base) ink2.line(l.base, ink2.st(oc, T.outline * 0.7), { taper: 20 });
    ink2.flush(ctx);
  }

  // ---------------------------------------------------------------- draw one layer
  LW.drawCliffLayer = function (ctx, S, l) {
    const t0 = performance.now();
    const T = TIER[l.tier];
    const f = layerFields(l);
    const kind = l.kind || (l.tier === 2 ? 'rock' : 'far');
    const pal = l.name === 'R0' ? [P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.3), LW.mix(P.rock4, P.ink, 0.55)] : l.tier === 2 ? [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4, LW.mix(P.rock4, P.ink, 0.4)] : T.pal;
    const rimCol = l.tier === 0 ? LW.mix(P.water3, P.air[0], 0.5) : P.water2;
    drawCellCliff(ctx, S, l, f, kind, pal, T, rimCol);
    LW.log('cliff', l.name, 'ms', Math.round(performance.now() - t0));
  };
})();
