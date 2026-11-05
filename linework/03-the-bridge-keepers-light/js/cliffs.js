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
    // far wall at the bend
    {
      const edge = edgeFrom([[1060, 1930], [1110, 1880], [1170, 1862], [1230, 1878], [1300, 1930]], 41, 8, 1 / 60, 2);
      const poly = edge.concat([[1300, 2088], [1060, 2088]]);
      layers.push({ name: 'F', poly, edge, tier: 0, face: [0.1, 0.99], base: [[1060, 2087], [1300, 2087]], seed: 41 });
    }
    {
      const edge = edgeFrom([[880, 1540], [960, 1600], [1030, 1690], [1085, 1800], [1125, 1930], [1148, 2040], [1160, 2083]], 42, 16, 1 / 70, 3);
      const base = [[1160, 2083], [1110, 2092], [1020, 2100], [900, 2104]];
      const poly = edge.concat(base.slice(1), [[860, 2104], [860, 1540]]);
      layers.push({ name: 'L2', poly, edge, tier: 0, face: [0.62, 0.78], base, seed: 42 });
    }
    {
      const edge = edgeFrom([[1430, 1530], [1350, 1620], [1285, 1740], [1235, 1860], [1205, 1980], [1192, 2060], [1190, 2084]], 43, 16, 1 / 70, 3);
      const base = [[1190, 2084], [1250, 2092], [1350, 2100], [1450, 2106]];
      const poly = edge.concat(base.slice(1), [[1460, 2106], [1460, 1530]]);
      layers.push({ name: 'R2', poly, edge, tier: 0, face: [-0.6, 0.8], base, seed: 43 });
    }
    {
      const edge = edgeFrom([[760, 1210], [850, 1270], [925, 1370], [985, 1500], [1025, 1630], [1055, 1760], [1078, 1880], [1095, 1990], [1100, 2075], [1092, 2102]], 44, 24, 1 / 80, 4);
      const base = [[1092, 2102], [1040, 2128], [960, 2152], [880, 2172], [800, 2186]];
      const poly = edge.concat(base.slice(1), [[640, 2186], [640, 1210]]);
      layers.push({ name: 'L1', poly, edge, tier: 1, face: [0.6, 0.8], base, seed: 44 });
    }
    {
      const edge = edgeFrom([[1520, 1150], [1440, 1260], [1375, 1400], [1322, 1550], [1285, 1700], [1258, 1840], [1240, 1960], [1232, 2050], [1240, 2098]], 45, 24, 1 / 80, 4);
      const base = [[1240, 2098], [1300, 2116], [1390, 2140], [1480, 2162], [1560, 2172]];
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
  const TIER = [
    { dsep: [11, 30], w: [0.9, 1.5], ink: P.inkFar2, pal: [P.far0, P.far1, P.far2], pocket: 1.0, crack: 0, outline: 2.4, rim: 0.9 },
    { dsep: [8, 24], w: [1.1, 2.0], ink: P.inkFar, pal: [P.far1, P.far2, P.far3, LW.mix(P.far3, P.ink, 0.35)], pocket: 0.98, crack: 0.6, outline: 3.4, rim: 1 },
    { dsep: [5.5, 22], w: [1.3, 2.9], ink: P.ink, pal: [P.rock0, P.rock1, P.rock2, P.rock3, P.rock4], pocket: 1.0, crack: 1, outline: 5.5, rim: 1 },
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
    const LEDGES = {
      L0: [[700, -0.12], [1340, 0.1]], R0: [[560, 0.16], [1250, -0.12]],
      L1: [[1370, 0.08], [1600, -0.05], [1830, 0.06]], R1: [[1290, -0.12], [1500, 0.05], [1760, -0.06]],
      L2: [[1680, 0.12], [1880, -0.04]], R2: [[1660, -0.12], [1870, 0.05]],
    };
    const ledges = LEDGES[l.name] || [];
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
        const len = (70 + 90 * (0.5 + 0.5 * n.n2(x / 180, ly))) * (l.tier === 2 ? 1 : l.tier === 1 ? 0.55 : 0.4);
        if (t > -12 && t < 0) d -= 0.22 * gate;
        else if (t >= 0 && t < len) d += 0.32 * gate * Math.pow(1 - t / len, 1.6);
      }
      // gorge depth: lower = darker; far tiers lighter overall
      if (l.tier === 2) d += 0.2 * LW.smooth(900, 2600, y);
      if (l.tier === 1) d += 0.14 * LW.smooth(1500, 2150, y);
      if (l.tier === 0) d -= 0.08;
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
    const far = l.tier === 0;
    const sc = near ? 1 : far ? 0.4 : 0.62;
    const texOpts = near
      ? { tex: 1, moss: true, stains: true, pitBase: 0.12, lichenMix: 0.3, strata: { slope: l.face[0] > 0 ? -0.07 : 0.07, sp: 38, w: 0.95 } }
      : far
        ? { tex: 0.9, moss: false, stains: true, strata: { slope: l.face[0] > 0 ? -0.14 : 0.14, sp: 15, w: 0.7, amp: 10 }, pitStep: 4.8, lichenStep: 3.2, markBias: 0.3, texCell: 3.0, xStep: 1.1, xThresh: 0.5, fracture: 0.7 }
        : { tex: 1, moss: true, stains: true, strata: { slope: l.face[0] > 0 ? -0.1 : 0.1, sp: 21, w: 0.75, amp: 14 }, pitStep: 5.2, lichenStep: 3.2, markBias: 0.28, texCell: 3.2, xStep: 1.15, xThresh: 0.52, fracture: 0.7 };
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
      aniso: near ? 1.45 : 1.6,
      kind, pal,
      ink: far ? LW.mix(P.inkFar, P.ink, 0.25) : near ? T.ink : LW.mix(P.inkFar, P.ink, 0.4),
      lineW: near ? [1.15, 2.7] : far ? [0.8, 1.35] : [0.95, 1.8],
      step: near ? 5.6 : far ? 5.6 : 6.0,
      lumpRatio: l.name === 'R0' ? 0.55 : 0.74,
      light: [0.62, -0.78],
      flow: () => Math.PI / 2 + tilt,
      wedgeW: near ? 12 : far ? 5 : 7,
      black: near ? P.ink : far ? LW.mix(P.inkFar, P.ink, 0.5) : LW.mix(P.inkFar, P.ink, 0.6),
      rim, rimCol,
      ...texOpts,
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
    const black = near ? P.ink : far ? LW.mix(P.inkFar, P.ink, 0.5) : LW.mix(P.inkFar, P.ink, 0.6);
    LW.contours({ bbox: bb, step: 4, field: blackField, levels: [0] }, (pts) => {
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
    const lk = near ? 1 : far ? 0.45 : 0.62;
    const plantR = new LW.RNG('ledge-plants-' + l.name);
    const plants = [];
    for (const [ly, sl] of f.ledges) {
      let run = [];
      const flushRun = () => {
        if (run.length > 6) {
          ink.line(run, (x, y) => ink.st(ink.col(P.ink), 3.2 * lk), { taper: 30 });
          const under = run.map((p, i) => [p[0], p[1] + (4 + 12 * Math.pow(Math.sin(Math.PI * i / (run.length - 1)), 0.7) * (0.6 + 0.4 * cn.n2(p[0] / 50, ly))) * lk]);
          ink.fill(run.concat(under.slice().reverse()), black, 0.6);
          // ferns and small bushes rooted along the ledge lip
          if (!near) for (let i = 2; i < run.length - 2; i++) if (plantR.next() < 0.07) plants.push([run[i][0], run[i][1] - 1, plantR.next()]);
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
    // plants on the mid/far ledges (drawn unclipped so fronds can overhang the lip)
    if (plants.length) {
      const pi = new LW.Ink(l.seed + 950);
      const pd = new LW.Dots();
      const cDark = far ? LW.mix(P.tealDark, P.inkFar, 0.5) : LW.mix(P.tealDark, P.ink, 0.4);
      const cLit = far ? LW.mix(P.teal, P.far1, 0.4) : LW.mix(P.teal, P.far0, 0.25);
      const cF = pi.col(cDark), cF2 = pi.col(cLit);
      for (const [x, y, r] of plants) {
        const s = (far ? 9 : 14) * (0.7 + r * 0.7);
        if (r < 0.45) LW.fernTuft(pi, x, y, s, r < 0.2 ? cF2 : cF, plantR, { w: far ? 0.8 : 1.0, lean: (plantR.next() - 0.5) * 0.6 });
        else LW.shrub(pi, pd, x, y - s * 0.25, s * 0.55, plantR, cDark, LW.rgb(cLit));
      }
      pi.flush(ctx);
      pd.flush(ctx);
    }
    // silhouette outline
    const ink2 = new LW.Ink(l.seed + 901);
    ink2.wobble = 0.6;
    const oc = ink2.col(P.ink);
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
    const rimCol = l.tier === 0 ? P.water3 : P.water2;
    if (l.tier >= 0) {
      drawCellCliff(ctx, S, l, f, kind, pal, T, rimCol);
      LW.log('cliff', l.name, 'ms', Math.round(performance.now() - t0));
      return;
    }
    // ---- fill
    LW.shadeFill(ctx, S, l.path, l.bbox, (x, y, out) => {
      let d = f.dark.at(x, y);
      const by = f.baseY(x);
      let c = LW.stepPick(pal, LW.clamp(d, 0, 0.999), x, y, 0.05);
      // cyan bounce from the river along the foot of the wall
      const rimD = by - y;
      if (rimD < 34 * T.rim && rimD > -2) {
        const t = LW.smooth(34, 4, rimD + LW.lnoise.n2(x / 9, y / 9) * 7);
        if (t > 0.5) c = LW.mix(c, rimCol, 0.55);
      }
      if (kind !== 'far') {
        const wv = LW.warm(x, y, kind);
        const b = LW.warmBand(wv, x, y);
        if (b > 0) c = LW.warmFill[b];
      }
      out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
    });

    const ink = new LW.Ink(l.seed + 900);
    ink.wobble = l.tier === 2 ? 1.1 : 0.8;
    // ---- black crevices and pockets (contour fills)
    const cn = new LW.Noise(l.seed + 77);
    const bb = l.bbox;
    const blackField = (x, y) => {
      if (x < bb[0] + 9 || y < bb[1] + 9 || x > bb[2] - 9 || y > bb[3] - 9) return -1;
      if (!f.mask.in(x, y)) return -1;
      const d = f.dark.at(x, y);
      let v = d - T.pocket;
      if (T.crack > 0) {
        const wx = x + 40 * cn.fbm(x / 200, y / 200, 2);
        const r = cn.ridged(wx / 46, y / 430, 2);
        const env = LW.smooth(0.05, 0.55, cn.fbm(x / 160 + 9, y / 300, 2));
        const g = 0.35 + 0.65 * LW.smooth(0.25, 0.8, d);
        v = Math.max(v, (r - 0.94) * 4 * env * g * T.crack - 0.004);
      }
      if (kind !== 'far') v -= 0.1 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return v;
    };
    const black = l.tier === 2 ? P.ink : l.tier === 1 ? LW.mix(P.inkFar, P.ink, 0.6) : P.inkFar;
    LW.contours({ bbox: l.bbox, step: 4, field: blackField, levels: [0] }, (pts) => {
      if (pts.length < 4) return;
      let area = 0;
      for (let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
      if (Math.abs(area) < 60) return;
      const sm = LW.chaikin(pts, 1, true);
      // warm-lit crevices are dark rust rather than navy
      const cx = sm[0][0], cy = sm[0][1];
      const b = kind !== 'far' ? LW.warmBand(LW.warm(cx, cy, kind), cx, cy, 0) : 0;
      ink.fill(sm, b >= 3 ? P.warmInk2 : b >= 1 ? P.warmInk1 : black, 0.8);
    });

    // ---- streamline hatching
    const rng = new LW.RNG('cliff-' + l.name);
    const [ds0, ds1] = T.dsep;
    const dsep = (x, y) => {
      let d = LW.clamp(f.dark.at(x, y), 0, 1);
      if (kind !== 'far') d *= 1 - 0.35 * LW.clamp(LW.warm(x, y, kind), 0, 1);
      return ds1 + (ds0 - ds1) * Math.pow(d, 0.85);
    };
    const lines = LW.streamlines({
      bbox: l.bbox,
      dir: f.dir,
      inside: (x, y) => f.mask.in(x, y),
      dsep,
      dtest: 0.5,
      dmin: ds0,
      step: 2.6,
      maxLen: l.tier === 2 ? 1400 : 700,
      minLen: l.tier === 2 ? 26 : 18,
      rng,
      gapStep: ds1 * 0.8,
    });
    const baseInk = ink.col(T.ink);
    const rimInk = ink.col(LW.mix(T.ink, P.water1, 0.75));
    const warmInks = [0, 1, 2, 3, 4, 5, 6].map((b) => ink.col(LW.warmInkColor(b, T.ink)));
    const wn = new LW.Noise(l.seed + 55);
    const style = (x, y) => {
      const d = LW.clamp(f.dark.at(x, y), 0, 1);
      let w = T.w[0] + (T.w[1] - T.w[0]) * d;
      w *= 0.85 + 0.3 * (0.5 + 0.5 * wn.n2(x / 40, y / 40));
      let ci = baseInk;
      const by = f.baseY(x);
      if (by - y < 30 && by - y > -2) ci = rimInk;
      if (kind !== 'far') {
        const b = LW.warmBand(LW.warm(x, y, kind), x, y);
        if (b > 0) ci = warmInks[b];
      }
      return ink.st(ci, w);
    };
    for (const pts of lines) ink.line(pts, style, { taper: 16 });

    // ---- crack cross-strokes making the cell network
    if (T.crack > 0) {
      const perp = (x, y) => {
        const v = f.dir(x, y);
        if (!v) return null;
        const a = 1.1 + 0.6 * wn.n2(x / 90, y / 90);
        const c = Math.cos(a), s = Math.sin(a);
        return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
      };
      const cracks = LW.streamlines({
        bbox: l.bbox,
        dir: perp,
        inside: (x, y) => f.mask.in(x, y) && f.dark.at(x, y) > 0.3,
        dsep: (x, y) => (l.tier === 2 ? 30 : 52) + 44 * (1 - LW.clamp(f.dark.at(x, y), 0, 1)),
        dtest: 0.5,
        dmin: 28,
        step: 2.5,
        maxLen: l.tier === 2 ? 52 : 30,
        minLen: 10,
        rng: new LW.RNG('crack-' + l.name),
        gapStep: 50,
      });
      for (const pts of cracks) {
        if (rng.next() < 0.15) continue;
        ink.line(pts, (x, y) => {
          const s = style(x, y);
          const ci = Math.floor(s / 512);
          return ink.st(ci, ((s % 512) / 16) * 0.8);
        }, { taper: 10 });
      }
    }
    ctx.save();
    ctx.clip(l.path);
    ink.flush(ctx);
    ctx.restore();

    // ---- silhouette outline, heavier on shadow side
    const ink2 = new LW.Ink(l.seed + 901);
    ink2.wobble = 0.6;
    const oc = ink2.col(l.tier === 0 ? P.inkFar : P.ink);
    const ow = T.outline;
    ink2.line(l.edge, (x, y) => {
      const v = 0.75 + 0.5 * (0.5 + 0.5 * wn.n2(x / 60, y / 60));
      return ink2.st(oc, ow * v);
    }, { taper: 0 });
    if (l.base && l.tier > 0) {
      ink2.line(l.base, ink2.st(oc, ow * 0.7), { taper: 20 });
    }
    ink2.flush(ctx);
    LW.log('cliff', l.name, 'lines', lines.length, 'ms', Math.round(performance.now() - t0));
  };

  // ---------------------------------------------------------------- small details on the mid walls
  /* a thread of waterfall down the right mid wall, a cave mouth in the left
     mid wall, bats over the gorge notch */
  LW.drawGorgeDetails = function (ctx, S) {
    const R1 = LW.cliff('R1'), L1 = LW.cliff('L1');
    const rng = new LW.RNG('gorge-details');
    const N = new LW.Noise(4401);
    // ---- waterfall thread
    {
      const ink = new LW.Ink(4402);
      ink.wobble = 0.25;
      const dots = new LW.Dots();
      const path = [];
      for (let y = 1318; y < 1800; y += 4) {
        const t = (y - 1318) / 480;
        // the fall steps outward at two ledges, otherwise hugs the face
        const x = 1446 - 22 * t + 9 * LW.smooth(1446, 1462, y) - 6 * LW.smooth(1618, 1634, y) + 3.2 * N.n2(y / 30, 1.1) + 1.2 * N.n2(y / 7, 4.4);
        path.push([x, y]);
      }
      const wet = LW.mix(P.inkFar, P.ink, 0.55);
      // the wet dark rock band either side of the thread
      const band = path.map((p, i) => [p[0] - 7 - 3 * N.n2(i / 6, 2), p[1]]).concat(path.slice().reverse().map((p, i) => [p[0] + 8 + 3 * N.n2(i / 7, 5), p[1]]));
      ink.fill(band, wet, 0.5);
      const cs = [ink.col(LW.mix(P.water4, P.far0, 0.35)), ink.col(LW.mix(P.water3, P.far0, 0.45)), ink.col(LW.mix(P.water2, P.far0, 0.6))];
      // the thread is a braid of short broken strands, widening as it falls
      for (let k = 0; k < 6; k++) {
        const pts = path.map((p, i) => [p[0] + (k - 2.5) * (1.1 + i / path.length * 1.6) + 1.2 * N.n2(p[1] / 9, k * 3), p[1]]);
        ink.line(pts, (x, y, i) => {
          if (N.n2(i / 2.6 + k * 7, k * 1.3) > (k === 2 || k === 3 ? 0.3 : -0.05)) return -1;
          return ink.st(cs[k === 2 || k === 3 ? 0 : k % 2 ? 1 : 2], k === 2 || k === 3 ? 1.05 : 0.75);
        }, { taper: 8, minScale: 0.2 });
      }
      // spray where it strikes each ledge: a small fan of droplets and flicks
      for (const [sy, sx] of [[1462, 1447], [1634, 1428], [1778, 1416]]) {
        for (let i = 0; i < 34; i++) {
          const a = -Math.PI * (0.1 + 0.8 * rng.next());
          const r = 3 + Math.pow(rng.next(), 1.4) * 16;
          const px = sx + Math.cos(a) * r, py = sy + Math.sin(a) * r * 0.7 + 3;
          if (rng.next() < 0.4) dots.flick(px, py, a, 2 + rng.next() * 3, 0.9, LW.rgb(P.water4));
          else dots.dot(px, py, 0.45 + rng.next() * 0.6, LW.rgb(rng.next() < 0.4 ? P.water4 : LW.mix(P.water3, P.far0, 0.4)));
        }
      }
      ctx.save();
      ctx.clip(R1.path);
      ink.flush(ctx);
      dots.flush(ctx);
      ctx.restore();
    }
    // ---- cave mouth in the left mid wall
    {
      const ink = new LW.Ink(4403);
      ink.wobble = 0.3;
      const cx = 948, cy = 1700, w = 30, h = 46;
      // an irregular leaning cleft rather than a neat arch
      const rel = [[-24, 9], [-29, -6], [-25, -22], [-17, -36], [-9, -47], [0, -50], [7, -43], [12, -34], [20, -24], [27, -9], [26, 4], [14, 11], [-6, 13]];
      const base = LW.resample(rel.concat([rel[0]]).map(([u, v]) => [cx + u * (w / 28), cy + v * (h / 48)]), 3.5);
      const sm = base.map((p, i) => [p[0] + 2.4 * N.n2(i * 0.45, 9) + 1.1 * N.n2(i * 1.7, 2), p[1] + 2.4 * N.n2(i * 0.45, 4) + 1.1 * N.n2(i * 1.7, 6)]);
      // the opening: a dark recess with depth. Nested contours shrink toward a vanishing point up and to the back,
      // the inner rings darker, a dim moonlit floor along the bottom lip
      ink.fill(sm, LW.mix(P.ink, P.inkFar, 0.45), 0.3);
      {
        const vx = cx + 5, vy = cy - h * 0.42;
        for (let k = 1; k <= 7; k++) {
          const f = 1 - k * 0.12;
          const ring = sm.map((p) => [vx + (p[0] - vx) * f, vy + (p[1] - vy) * f]);
          ink.fill(ring, LW.mix(P.ink, [0, 0, 0], 0.08 * k), 0.15);
          ink.line(ring.concat([ring[0]]), (x, y, i) => (N.n2(i / 4, k * 3.1) > 0.35 ? -1 : ink.st(ink.col(LW.mix(P.inkFar, P.far0, 0.35)), 0.8)), { taper: 4, minScale: 0.2 });
        }
        // the rock floor running in, faintly lit
        for (let k = 0; k < 5; k++) {
          const f = 0.95 - k * 0.15, yy = cy + 9 - k * 6;
          ink.line([[vx + (cx - w * 0.6 - vx) * f, vy + (yy - vy) * f], [vx + (cx + w * 0.5 - vx) * f, vy + (yy + 2 - vy) * f]], ink.st(ink.col(LW.mix(P.far0, P.inkFar, 0.2 + k * 0.15)), 1.1 - k * 0.12), { taper: 6 });
        }
      }
      // overhanging brow: arcs of hatch above the opening
      const cl = ink.col(P.ink);
      // moonlight catching the upper-right lip, broken
      {
        const lip = [];
        for (const p of sm) {
          const ox = p[0] - cx, oy = p[1] - (cy - h * 0.45);
          const L0 = Math.hypot(ox, oy) || 1;
          lip.push([p[0] + ox / L0 * 2.4, p[1] + oy / L0 * 2.4, (ox / L0) * 0.6 - (oy / L0) * 0.8]);
        }
        ink.line(lip.map((p) => [p[0], p[1]]), (x, y, i) => (lip[i][2] < 0.25 || N.n2(i / 3, 7.7) > 0.3 ? -1 : ink.st(ink.col(P.far0), 1.5)), { taper: 6, minScale: 0.3 });
      }
      // brow: short tapered strokes radiating off the lip, longer over the crown, broken
      for (let i = 0; i < 46; i++) {
        const a = Math.PI * (1.06 + 0.88 * rng.next());
        const k = 1 + 0.12 * N.n2((a - Math.PI) * 40 / Math.PI / 5, 9);
        const r0 = 1.08 + rng.next() * 0.1;
        const len = (5 + rng.next() * 12) * (0.5 + Math.sin(a - Math.PI));
        const p0 = [cx + Math.cos(a) * w * k * r0, cy + Math.sin(a) * h * k * r0];
        const da = a + (rng.next() - 0.5) * 0.5;
        ink.line([p0, [p0[0] + Math.cos(da) * len * 0.6, p0[1] + Math.sin(da) * len]], ink.st(cl, 0.9 + rng.next() * 0.6), { taper: len * 0.6, minScale: 0.2 });
      }
      // a lit sill
      ink.line([[cx - w * 0.75, cy + 13], [cx - w * 0.2, cy + 17], [cx + w * 0.55, cy + 15]], ink.st(ink.col(P.far0), 1.5), { taper: 10 });
      // talus spilling from the sill
      for (let k = 0; k < 16; k++) {
        const x = cx - w * 0.6 + rng.next() * w * 1.6, y = cy + 14 + rng.next() * rng.next() * 40;
        const r = 1.5 + rng.next() * 2.5;
        ink.fill([[x - r, y], [x - r * 0.3, y - r * 0.8], [x + r, y - r * 0.3], [x + r * 0.6, y + r * 0.5]], LW.mix(P.inkFar, P.ink, 0.4), 0.2);
      }
      ctx.save();
      ctx.clip(L1.path);
      ink.flush(ctx);
      ctx.restore();
    }
  };
  LW.drawBats = function (ctx, S) {
    const bats = [[1182, 1436, 13, 0.1], [1252, 1388, 9, -0.3], [1118, 1494, 8, 0.4], [1296, 1478, 7, 0.2], [1066, 1398, 6, -0.2], [1210, 1300, 6.5, 0.5]];
    ctx.save();
    ctx.fillStyle = LW.rgb(P.ink);
    for (const [x, y, s, rot] of bats) {
      const c = Math.cos(rot), sn = Math.sin(rot);
      const T = (u, v) => [x + (u * c - v * sn) * s / 10, y + (u * sn + v * c) * s / 10];
      // wings raised in a V with a scalloped trailing edge
      const wing = [[0, -1], [-6, -6], [-12, -8], [-19, -5], [-24, -7], [-20, -2], [-17, 1], [-13, -1], [-10, 3], [-6, 0], [-3, 3], [0, 2], [3, 3], [6, 0], [10, 3], [13, -1], [17, 1], [20, -2], [24, -7], [19, -5], [12, -8], [6, -6]];
      ctx.beginPath();
      wing.forEach((p, i) => { const q = T(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.closePath();
      ctx.fill();
      const b = T(0, 1.5);
      ctx.beginPath();
      ctx.ellipse(b[0], b[1], s * 0.22, s * 0.38, rot, 0, Math.PI * 2);
      ctx.fill();
      const e1 = T(-1.6, -2.6), e2 = T(1.6, -2.6);
      ctx.beginPath(); ctx.arc(e1[0], e1[1], s * 0.1, 0, 7); ctx.arc(e2[0], e2[1], s * 0.1, 0, 7); ctx.fill();
    }
    ctx.restore();
  };
})();
